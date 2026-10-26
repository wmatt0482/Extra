// Fraction Fright gameplay engine (SPEC §3). Canvas 2D, procedural art, no physics library: the grenade flies a
// closed-form arc (grenade.js), the zombies shuffle on a lane behind the road (zombies.js), the road is the number
// line (road.js). Fixed 60 Hz sim step with an accumulator; drawing in css px (render.js).
//
// Contract: createGame(canvas, { onEvent, reducedMotion?, simSpeed? }) → { start, setAim, throw, throwAt, pause,
//   resume, stop, destroy, getState, updateItem }.
//   start({ road: { from: 0, to: 1 | 2 | 3, labels: ['0','½','1'] | [{ at, text }], ticks: [{ at, label? }] (the
//     fine ticks, drawn only while the hint ladder asks), landmarks: [{ at, kind: 'grave'|'tree'|'lantern'|'well',
//     label? }] }, wave: { street (id or { id, name, weather: 'clear'|'fog'|'bats'|'stars'|'rain' }), number (1..5),
//     zombies: [item...], big: bool, final: bool, shuffleSec? }, look: { goo (css colour), fence: 'picket'|'stone'|
//     'iron', pumpkins (count, default 5), kid: { shirt, cap, skin, hair }?, sky? }, stats: { radius (tolerance as a
//     share of the road when an item has none; default 0.10), power (throw speed, 1) }, seed })
//   item = { id, kind: 'locate'|'bounce'|'compare'|'equivalent'|'sum'|'decimal', say, show, target (number on the
//     road), jumps?: { unit, count } (the bounce scaffold; derived from `show` for kind 'bounce' when missing),
//     options?, tolerance? (share of the road), hints?: the ladder after a miss on the same item, in order
//     (default ['arrow', 'ticks']: a nudge arrow toward the spot for the next throw, then the denominator's ticks for
//     one throw), ticks? (the item's own fine ticks), den? }. The engine only runs items; the app makes them.
//   setAim(x01): the reticle on the road at x01 (0 = road.from, 1 = road.to); emits aim { x01, value }.
//   throw() → bool: throws the aimed grenade (only in phase 'wave', with an aim set). throwAt(x01) → bool: aim + throw.
//   pause() / resume() freeze and resume the sim (drawing continues). stop(): ends the wave now and emits
//   waveEnd { ..., stopped: true } once. destroy() releases the canvas loop and observers.
//   updateItem(id, patch) (extension): the app may change an unresolved item's hints / tolerance / ticks mid-wave.
//   getState() → { phase: 'idle'|'wave'|'beat'|'calm'|'done' (a throw is allowed only in 'wave'), street, number,
//     big, final, total, resolved, cured, reached, throws, bulls, hits, pae (mean so far), accuracy (100 - pae),
//     cash (running total), pumpkins, aim (x01 | null), aimValue, target (the called item: { id, kind, say, show,
//     target, attempt, hint, tolerance } | null), roadPx: { left, right, y } (the road's on-screen span in css px:
//     the app maps pointer drags to setAim itself), road: { from, to }, live: [{ id, item, p (0..1 along the
//     lane), state, look, hat, cured }], lastThrow: { result, pae, close, aimed, err } | null, inFlight, timeSec }.
// Events (onEvent({ type, ... })):
//   target { item }        the called item changed (the app speaks item.say); also at start.
//   aim { x01, value }     the reticle moved.
//   toss { item, aimed, aimed01 }   the grenade left the hand.
//   throw { item, aimed, aimed01, err (aimed - target, road units), pae (|err| as % of the road), close
//          (round(100 - pae), the "N % close" wording), result: 'bull' (≤ 1.5 % of the road) | 'hit' (≤ tolerance)
//          | 'near' (≤ 2 × tolerance) | 'miss', tolerance, attempt, hint (the hint the next throw on this item will
//          show, or null), cash { cure, bull, effort } (this throw's parts; the app computes its own rows) }
//   cured { item, result, pae }   the zombie turned back into a neighbour (≈ 0.25 s after the thunk).
//   knock { item }          a zombie reached the fence and knocks (it can still be cured while knocking).
//   reached { item, pumpkins }   it took a pumpkin and shuffles off; the wave continues (no other penalty).
//   bigWave { count }, finalWave    at the start of such a wave.   calm    the calm beat after the last zombie.
//   waveEnd { street, number, big, final, cured, reached, throws, bulls, hits, nears, misses, pae, accuracy, hitRate,
//            results: [{ id, kind, show, say, target, attempts, result, pae, bestPae, cured, reached, bull,
//            results }], cash: { cure, bull, effort, final, total } (parts add up; cure = $120 × accuracy factor,
//            bull +$60, effort +$40 for a near followed by a hit on the same item, final wave ×2 as `final`; the
//            app computes its own cash rows from the `throw` events and ignores this summary's cash),
//            pumpkins, pumpkinsTaken, durationSec, stopped }
//   App-side additions folded in (SPEC §3): getState().roadPx / target / phase as above, the `target` event, and
//   stop() → waveEnd { stopped: true }.
//   sound { name, vol }     audio hooks (the app owns audio): toss, boing, thunkBig, thunk, thunkSmall, plop, splat,
//                           cure, knock, pumpkin, bigWave, finalWave, calm, waveEnd.
// Juice (success-dependent, SPEC §0 / §3): bull = 0.4 s slow-mo + the big thunk + full splat + confetti + a small
//   shake; hit = thunk + splat; near = edge splat + a nudge arrow toward the spot; miss = a plop only. After EVERY
//   throw: the true-spot flag, the fraction drawn as unit jumps from 0, and "N % close" (never "wrong"). Effects
//   never cover the number line or its labels (labels are drawn above every effect). reducedMotion: no shake, no
//   slow-mo, fewer particles. Zombies: one at a time (3 at once in a big wave), ≈ 20 s spawn → fence on wave 1
//   (−1.5 s a wave, never under 14 s), a cure or a reach spawns the next.
// Debug (not contract): debugStep(n) (n sim ticks of 1/60 s), debugPerf(reset), debugInfo().

import { TAU, clamp, lerp, mulberry32, hashStr, withAlpha, shade, easeOut, denominatorOf } from './util.js';
import { makeRoad, ticksForItem, drawRoadBand, drawNumberLine, drawRoadLabels, drawLandmarks, drawReticle, drawFlag, jumpPlan, drawJumps, drawNudge, roadPalette } from './road.js';
import { planThrow, grenadeAt, arcPreview } from './grenade.js';
import { makeZombie, stepZombie, cureZombie, drawZombie, drawCallMarker, drawBubble, pickLooks } from './zombies.js';
import * as R from './render.js';

const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 4;
const MAX_PARTICLES = 320;
const SPARKS = ['#ffd23f', '#ff8a1f', '#ffffff', '#ffb347', '#ff5d2e'];

export const TUNING = {
  bull: 0.015, tolerance: 0.10,
  shuffleSec: 20, shuffleStep: 1.5, shuffleMin: 14,
  beatSec: 1.35, cureDelay: 0.25, calmSec: 2.4,
  slowmo: 0.3, slowmoSec: 0.4,
  cash: { cure: 120, bull: 60, effort: 40 },
  bigCount: 3, staggerP: 0.09,
  flagSec: 0.35, jumpsSec: 0.75,
};
const T = TUNING;

function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function itemArg(src, i) {
  if (!src || typeof src !== 'object') return null;
  const target = Number(src.target);
  if (!Number.isFinite(target)) return null;
  const kind = typeof src.kind === 'string' ? src.kind : 'locate';
  let jumps = src.jumps && Number(src.jumps.unit) > 0 ? { unit: Number(src.jumps.unit), count: Math.max(0, Math.round(num(src.jumps.count, 0))) } : null;
  if (!jumps && kind === 'bounce') {
    const den = num(src.den, 0) || denominatorOf(src.show) || 0;
    if (den > 1) jumps = { unit: 1 / den, count: Math.round(target * den) };
  }
  if (jumps && !jumps.count) jumps.count = Math.max(1, Math.round(target / jumps.unit));
  return {
    id: src.id != null ? String(src.id) : 'item' + i, kind, say: src.say != null ? String(src.say) : '', show: src.show != null ? String(src.show) : String(target),
    target, jumps, options: Array.isArray(src.options) ? src.options.slice() : null,
    tolerance: Number(src.tolerance) > 0 ? Number(src.tolerance) : null,
    hints: Array.isArray(src.hints) ? src.hints.filter((h) => typeof h === 'string') : ['arrow', 'ticks'],
    ticks: Array.isArray(src.ticks) ? src.ticks : null, den: num(src.den, 0) || null,
    // run state
    attempts: 0, results: [], paes: [], cured: false, reached: false, bull: false, misses: 0, lastLanded: null, cashCure: 0, cashBull: 0, cashEffort: 0,
  };
}

export function createGame(canvas, opts = {}) {
  const emitTo = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
  const reducedMotion = !!opts.reducedMotion;
  const simSpeed = Math.max(0.1, Number(opts.simSpeed) || 1);
  const ctx = canvas.getContext('2d');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  const view = { W: 1, H: 1, dpr: 1 };

  let run = null;
  let paused = false;
  let destroyed = false;
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  const perf = { frames: 0, sim: 0, draw: 0, max: 0, ticks: 0, maxTick: 0, maxDraw: 0 };
  const gpos = { x: 0, y: 0, rot: 0, seg: 0, u: 0, done: false };
  const preview = new Float32Array(2 * 25);

  function emit(evt) {
    try { emitTo(evt); } catch (e) { console.error('[engine] onEvent handler threw', e); }
  }
  const sound = (name, vol = 1) => emit({ type: 'sound', name, vol });

  // ---------- sizing ----------
  function resize() {
    const el = canvas.parentElement || canvas;
    const rect = el.getBoundingClientRect();
    const W = Math.max(1, Math.round(rect.width || canvas.clientWidth || 1));
    const H = Math.max(1, Math.round(rect.height || canvas.clientHeight || 1));
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const changed = W !== view.W || H !== view.H || dpr !== view.dpr;
    view.W = W; view.H = H; view.dpr = dpr;
    const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    if (changed && run) layout(run);
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  if (ro) ro.observe(canvas.parentElement || canvas);
  resize();

  // (re)build everything that depends on the view size
  function layout(r) {
    r.road = makeRoad(r.roadSpec, view);
    r.pal = roadPalette(r.look);
    r.scene = R.palette(r.look);
    r.bd = R.buildBackdrop(view, r.road, r.scene, r.seed, r.look);
    r.fl = R.fenceLayout(view, r.road);
    r.lw = clamp(Math.min(view.W, view.H) * 0.006, 1.6, 3);
    r.zh = clamp(Math.min(view.W, view.H) * 0.19, 46, 84);
    r.laneY = r.road.y - r.road.band - 4;
    r.laneX0 = -r.zh * 0.6;
    const kh = clamp(view.H * 0.21, 56, 84);
    // the kid stands in the yard in front of the fence: feet just above the bottom edge in landscape, lower in portrait
    r.kid = { x: view.W * (r.road.portrait ? 0.22 : 0.5), y: Math.min(view.H - 4, r.fl.bottom + kh * 1.15), h: kh };
    r.kid.hand = R.kidMuzzle(r.kid); // the grenade lobs from the cannon's muzzle
    r.gr = clamp(Math.min(view.W, view.H) * 0.03, 8, 14);
    // splats keep their road value
    for (const sp of r.splats) { sp.x = r.road.toPx(sp.v); sp.y = r.road.y; }
    if (r.throwState) r.throwState.plan = buildPlan(r, r.throwState.item, r.throwState.aimed);
    r.particles.n = 0;
  }
  const laneX = (r, p) => lerp(r.laneX0, r.fl.laneEnd, p);

  // ---------- start ----------
  function start(cfg = {}) {
    const seed = Number.isFinite(Number(cfg.seed)) ? Number(cfg.seed) >>> 0 : hashStr(String(cfg.wave && cfg.wave.street) + ':' + (cfg.wave && cfg.wave.number));
    const rand = mulberry32(seed);
    const wave = cfg.wave || {};
    const streetObj = wave.street && typeof wave.street === 'object' ? wave.street : { id: wave.street != null ? String(wave.street) : 'maple', name: wave.street != null ? String(wave.street) : 'Maple Street' };
    const items = [];
    for (let i = 0; i < (Array.isArray(wave.zombies) ? wave.zombies.length : 0); i++) { const it = itemArg(wave.zombies[i], i); if (it) items.push(it); }
    const number = clamp(Math.round(num(wave.number, 1)), 1, 99);
    const look = { goo: '#8cff1a', fence: 'iron', pumpkins: 5, ...(cfg.look || {}) };
    if (typeof look.goo !== 'string') look.goo = '#8cff1a';
    const stats = { radius: clamp(num(cfg.stats && cfg.stats.radius, T.tolerance), 0.01, 0.5), power: clamp(num(cfg.stats && cfg.stats.power, 1), 0.6, 2) };
    const r = (run = {
      seed, rand, roadSpec: cfg.road || { from: 0, to: 1 }, wave, street: streetObj, number, big: !!wave.big, final: !!wave.final, look, stats, items,
      weather: streetObj.weather || 'clear',
      shuffleSec: clamp(num(wave.shuffleSec, T.shuffleSec - (number - 1) * T.shuffleStep), T.shuffleMin, 60),
      looks: pickLooks(rand, items.length),
      phase: 'wave', t: 0, realT: 0, timeScale: 1, slowmoT: 0,
      zombies: [], nextSpawn: 0, liveTarget: 3,
      aim: null, aimValue: null, throwState: null, feedback: null, pending: [],
      target: null, beatT: 0, calmT: 0,
      throws: [], cured: 0, reached: 0, bulls: 0, hits: 0, nears: 0, misses: 0, cash: { cure: 0, bull: 0, effort: 0 },
      pumpkins: Math.max(0, Math.round(num(look.pumpkins, 5))), pumpkinsTaken: 0, pumpkinGlow: 0,
      popups: [], particles: R.makeParticles(MAX_PARTICLES), splats: [], bolt: null,
      shake: 0, sx: 0, sy: 0, flash: 0, flashCol: '#ffffff', banner: null, bubble: null,
      kidArm: 0, kidArmT: -1, ticksAlpha: 0, ticksCache: null, previewPlan: null, nudge: null, summary: null, ended: false, lastThrow: null,
      road: null, pal: null, scene: null, bd: null, fl: null, lw: 2, zh: 60, laneY: 0, laneX0: 0, kid: null, gr: 10,
    });
    paused = false;
    acc = 0;
    last = performance.now();
    layout(r);
    r.liveTarget = r.big ? T.bigCount : 1;
    if (r.big) { emit({ type: 'bigWave', count: T.bigCount }); sound('bigWave'); banner(r, 'BIG WAVE!', '#c77dff', '3 at once!', 2.0); }
    if (r.final) { emit({ type: 'finalWave' }); sound('finalWave'); banner(r, 'FINAL WAVE!', '#ff8a1f', r.big ? '3 at once!' : null, 2.2); }
    fillSpawns(r);
    if (!items.length) { beginCalm(r); }
    else updateTarget(r, true);
  }
  function banner(r, text, color, sub, life) { r.banner = { text, color, sub, t: 0, life }; }

  // ---------- zombies ----------
  function fillSpawns(r) {
    let k = 0;
    while (liveCount(r) < r.liveTarget && r.nextSpawn < r.items.length) {
      const i = r.nextSpawn++;
      const z = makeZombie(r.items[i], i, r.rand, { look: r.looks[i], walkSec: r.shuffleSec });
      z.p = -0.02 - T.staggerP * k;
      k++;
      r.zombies.push(z);
    }
  }
  function liveCount(r) { let n = 0; for (const z of r.zombies) if (z.alive) n++; return n; }
  function currentZombie(r) { for (const z of r.zombies) if (z.alive && !z.resolved) return z; return null; }
  // the called item changes: emit target (when aiming is possible)
  function updateTarget(r, force = false) {
    const z = currentZombie(r);
    const item = z ? z.item : null;
    if (item !== r.target || force) {
      r.target = item;
      if (item) {
        emit({ type: 'target', item: itemOut(item) });
        r.bubble = { text: item.show, t: 0, life: 1.6 };
      }
    }
  }
  function itemOut(it) {
    return { id: it.id, kind: it.kind, say: it.say, show: it.show, target: it.target, jumps: it.jumps, options: it.options, tolerance: tolOf(run, it), hints: it.hints.slice(), attempt: it.attempts + 1, hint: hintFor(it) };
  }
  const tolOf = (r, it) => (it.tolerance != null ? it.tolerance : r.stats.radius);
  // the hint the NEXT throw on this item shows (null before the first miss)
  function hintFor(it) {
    if (it.misses <= 0 || !it.hints.length) return null;
    return it.hints[Math.min(it.misses - 1, it.hints.length - 1)];
  }
  function resolveZombieItem(r, z) {
    fillSpawns(r);
    if (r.phase === 'wave') updateTarget(r);
  }

  // ---------- throw ----------
  function buildPlan(r, item, aimed) {
    const road = r.road;
    const xLand = road.toPx(aimed);
    const hops = [];
    if (item.jumps && item.jumps.count >= 1) {
      hops.push(road.toPx(road.from));
      for (let i = 1; i < item.jumps.count; i++) hops.push(road.toPx(road.from + item.jumps.unit * i));
    }
    return planThrow({ x0: r.kid.hand.x, y0: r.kid.hand.y, xLand, yLand: road.y, hops, H: view.H, power: r.stats.power });
  }
  function doThrow(r, x01) {
    if (!r || r.phase !== 'wave' || r.throwState) return false;
    const z = currentZombie(r);
    if (!z) return false;
    const item = z.item;
    const aimed01 = clamp(num(x01, 0), 0, 1);
    const aimed = r.road.fromX01(aimed01);
    r.aim = aimed01; r.aimValue = aimed;
    r.throwState = { plan: buildPlan(r, item, aimed), t: 0, item, zombie: z, aimed, aimed01, nextTouch: 0 };
    r.phase = 'beat';
    r.kidArmT = 0;
    r.nudge = null; r.feedback = null;
    emit({ type: 'toss', item: itemOut(item), aimed, aimed01 });
    sound('toss', 0.7);
    return true;
  }
  function land(r) {
    const ts = r.throwState;
    const item = ts.item, road = r.road;
    const err = ts.aimed - item.target;
    const share = Math.abs(err) / road.span;
    const pae = Math.round(share * 1000) / 10;
    const tol = tolOf(r, item);
    const result = share <= T.bull + 1e-9 ? 'bull' : share <= tol + 1e-9 ? 'hit' : share <= 2 * tol + 1e-9 ? 'near' : 'miss';
    const close = clamp(Math.round(100 - pae), 0, 100);
    const prev = item.results.length ? item.results[item.results.length - 1] : null;
    item.attempts++;
    item.results.push(result);
    item.paes.push(pae);
    item.lastLanded = ts.aimed;
    const success = result === 'bull' || result === 'hit';
    const cash = { cure: 0, bull: 0, effort: 0 };
    if (success) {
      const factor = result === 'bull' ? 1 : clamp(1 - 0.5 * (share / tol), 0.5, 1);
      cash.cure = Math.round(T.cash.cure * factor);
      if (result === 'bull') { cash.bull = T.cash.bull; item.bull = true; r.bulls++; }
      if (prev === 'near') cash.effort = T.cash.effort;
      r.hits++;
      item.cashCure += cash.cure; item.cashBull += cash.bull; item.cashEffort += cash.effort;
      r.cash.cure += cash.cure; r.cash.bull += cash.bull; r.cash.effort += cash.effort;
    } else {
      item.misses++;
      if (result === 'near') r.nears++; else r.misses++;
    }
    const rec = { item: item.id, aimed: ts.aimed, aimed01: ts.aimed01, err, pae, result, close, attempt: item.attempts };
    r.throws.push(rec);
    r.lastThrow = { result, pae, close, aimed: ts.aimed, err };
    // effects
    const x = road.toPx(ts.aimed), y = road.y;
    fxLanding(r, x, y, result);
    // feedback beat: flag + jumps + "% close"
    r.feedback = { item, t: 0, target: item.target, landed: ts.aimed, result, plan: jumpPlan(road, item), close };
    const label = result === 'bull' ? 'BULL\'S-EYE!' : result === 'hit' ? `SPLAT! ${close} % close` : `${close} % close`;
    popup(r, label, x, y - road.band * 3.3 - 10, result === 'bull' ? '#ffb020' : result === 'hit' ? '#9dff2e' : result === 'near' ? '#5ff0ff' : '#ffffff', result === 'bull' ? 1.5 : result === 'hit' ? 1.15 : 1, 1.6, 28, result === 'bull' ? -0.09 : result === 'hit' ? -0.04 : 0);
    if (result === 'near' || (!success && hintFor(item) === 'arrow')) r.nudge = { from: ts.aimed, to: item.target, t: 0 };
    emit({ type: 'throw', item: itemOut(item), aimed: ts.aimed, aimed01: ts.aimed01, err, pae, close, result, tolerance: tol, attempt: item.attempts, hint: success ? null : hintFor(item), cash });
    if (success) {
      // the zombie this item belongs to, or (if it just took its pumpkin mid-flight) the next one in line
      const z = ts.zombie.alive ? ts.zombie : currentZombie(r);
      if (z) {
        const zx = laneX(r, z.p), zy = r.laneY;
        r.bolt = { x0: x, y0: y, x1: zx, y1: zy - r.zh * 0.5, t: 0, life: T.cureDelay };
        r.pending.push({ at: r.t + T.cureDelay, fn: () => cureNow(r, z, result, pae) });
      }
    }
    r.throwState = null;
    r.beatT = 0;
  }
  function cureNow(r, z, result, pae) {
    if (!z.alive) return;
    const zx = laneX(r, z.p), zy = r.laneY;
    cureZombie(z, { x: zx, y: zy - r.zh * 1.05 });
    z.hatFly.vx *= z.face;
    r.cured++;
    z.item.cured = true;
    sound('cure');
    // a goo burst on the zombie + stars
    const ps = r.particles, n = reducedMotion ? 8 : 16;
    for (let i = 0; i < n; i++) { const a = r.rand() * TAU, v = 60 + r.rand() * 160; R.spawnParticle(ps, i % 3 === 0 ? R.P_STAR : R.P_GOO, zx, zy - r.zh * 0.5, Math.cos(a) * v, Math.sin(a) * v - 80, 0.6 + r.rand() * 0.4, i % 3 === 0 ? 5 : 2 + r.rand() * 3, i % 3 === 0 ? '#ffd23f' : r.look.goo, 500, r.laneY + 2); }
    emit({ type: 'cured', item: itemOut(z.item), result, pae });
    resolveZombieItem(r, z);
  }
  function fxLanding(r, x, y, result) {
    const road = r.road, goo = r.look.goo, ps = r.particles;
    const seed = (r.rand() * 1e9) >>> 0;
    const floor = road.y + road.band * 0.85;
    const few = reducedMotion ? 0.5 : 1;
    if (result === 'bull') {
      sound('thunkBig'); sound('splat');
      r.splats.push({ v: r.road.fromPx(x), x, y, r: road.band * 1.05, kind: 'full', seed, t: 0, life: 7, goo });
      burst(r, x, y, 26 * few, goo, floor, 280);
      dust(r, x, y, 14 * few, floor);
      cracks(r, x, y, 6, road.band * 2.2);
      for (let i = 0; i < 36 * few; i++) { const a = -Math.PI * (0.1 + r.rand() * 0.8), v = 220 + r.rand() * 420; R.spawnParticle(ps, R.P_SPARK, x, y - 2, Math.cos(a) * v, Math.sin(a) * v, 0.5 + r.rand() * 0.6, 1.5 + r.rand() * 2, SPARKS[i % SPARKS.length], 700, floor); }
      R.spawnParticle(ps, R.P_RING, x, y, 0, 0, 0.5, road.band * 2.4, '#ffffff', 0);
      R.spawnParticle(ps, R.P_RING, x, y, 0, 0, 0.7, road.band * 3.2, goo, 0);
      if (!reducedMotion) { r.shake = 1; r.slowmoT = T.slowmoSec; r.timeScale = T.slowmo; }
      r.flash = 0.35; r.flashCol = '#e9ffd0';
    } else if (result === 'hit') {
      sound('thunk'); sound('splat', 0.8);
      r.splats.push({ v: r.road.fromPx(x), x, y, r: road.band * 0.85, kind: 'full', seed, t: 0, life: 6, goo });
      burst(r, x, y, 16 * few, goo, floor, 230);
      dust(r, x, y, 10 * few, floor);
      cracks(r, x, y, 4, road.band * 1.6);
      for (let i = 0; i < 10 * few; i++) { const a = -Math.PI * (0.15 + r.rand() * 0.7), v = 160 + r.rand() * 260; R.spawnParticle(ps, R.P_SPARK, x, y - 2, Math.cos(a) * v, Math.sin(a) * v, 0.4 + r.rand() * 0.4, 1.5 + r.rand(), SPARKS[i % SPARKS.length], 700, floor); }
      R.spawnParticle(ps, R.P_RING, x, y, 0, 0, 0.45, road.band * 1.9, goo, 0);
    } else if (result === 'near') {
      sound('thunkSmall');
      r.splats.push({ v: r.road.fromPx(x), x, y, r: road.band * 0.6, kind: 'edge', seed, t: 0, life: 5, goo });
      burst(r, x, y, 8 * few, goo, floor, 150);
      dust(r, x, y, 5 * few, floor);
    } else {
      sound('plop');
      r.splats.push({ v: r.road.fromPx(x), x, y, r: road.band * 0.3, kind: 'plop', seed, t: 0, life: 4, goo });
      for (let i = 0; i < 5 * few; i++) R.spawnParticle(ps, R.P_DUST, x + (r.rand() - 0.5) * 10, y, (r.rand() - 0.5) * 60, -20 - r.rand() * 40, 0.5, 3 + r.rand() * 3, withAlpha('#c9b8d8', 0.6), 60, floor);
    }
    if (r.splats.length > 10) r.splats.shift();
  }
  function dust(r, x, y, n, floor) {
    for (let i = 0; i < n; i++) R.spawnParticle(r.particles, R.P_DUST, x + (r.rand() - 0.5) * 16, y, (r.rand() - 0.5) * 160, -30 - r.rand() * 70, 0.5 + r.rand() * 0.4, 3 + r.rand() * 4, withAlpha('#b7aac4', 0.5), 120, floor);
  }
  function cracks(r, x, y, n, len) {
    for (let i = 0; i < n; i++) { const p = R.spawnParticle(r.particles, R.P_CRACK, x, y, 0, 0, 1.6 + r.rand() * 0.6, len * (0.6 + r.rand() * 0.6), '#0d0b12', 0); if (p) p.a = (i / n) * TAU + r.rand() * 0.5; }
  }
  function burst(r, x, y, n, goo, floor, v) {
    for (let i = 0; i < n; i++) { const a = -Math.PI * (0.15 + r.rand() * 0.7), s = v * (0.4 + r.rand() * 0.9); R.spawnParticle(r.particles, R.P_GOO, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.6 + r.rand() * 0.5, 2 + r.rand() * 3.5, i % 4 === 0 ? shade(goo, 0.35) : goo, 900, floor); }
  }
  function popup(r, text, x, y, color, scale = 1, life = 1.2, rise = 28, tilt = 0) {
    r.popups.push({ text, x, y, t: 0, life, color, scale, rise, tilt });
    if (r.popups.length > 8) r.popups.shift();
  }

  // ---------- wave end ----------
  function allResolved(r) { return r.nextSpawn >= r.items.length && r.zombies.every((z) => z.resolved); }
  function beginCalm(r) {
    if (r.phase === 'calm' || r.phase === 'done') return;
    r.phase = 'calm'; r.calmT = 0; r.target = null;
    r.aim = null;
    emit({ type: 'calm' });
    sound('calm');
  }
  function finish(r, stopped) {
    if (r.ended) return;
    // a hit whose cure is still travelling counts: flush the pending cures first
    const pend = r.pending.splice(0);
    for (const p of pend) p.fn();
    r.ended = true;
    r.phase = 'done';
    r.target = null; r.throwState = null; r.aim = null;
    r.summary = summarize(r, stopped);
    sound('waveEnd');
    emit({ type: 'waveEnd', ...r.summary });
  }
  function summarize(r, stopped) {
    const n = r.throws.length;
    const meanPae = n ? Math.round((r.throws.reduce((a, t) => a + t.pae, 0) / n) * 10) / 10 : 0;
    const results = r.items.map((it) => ({
      id: it.id, kind: it.kind, show: it.show, say: it.say, target: it.target, attempts: it.attempts,
      result: it.results.length ? it.results[it.results.length - 1] : null, pae: it.paes.length ? it.paes[it.paes.length - 1] : null,
      bestPae: it.paes.length ? Math.min(...it.paes) : null, cured: it.cured, reached: it.reached, bull: it.bull, results: it.results.slice(),
      cash: { cure: it.cashCure, bull: it.cashBull, effort: it.cashEffort },
    }));
    const base = r.cash.cure + r.cash.bull + r.cash.effort;
    const final = r.final ? base : 0;
    return {
      street: r.street.id, streetName: r.street.name, number: r.number, big: r.big, final: r.final,
      cured: r.cured, reached: r.reached, throws: n, bulls: r.bulls, hits: r.hits, nears: r.nears, misses: r.misses,
      pae: meanPae, accuracy: n ? clamp(Math.round(100 - meanPae), 0, 100) : 0, hitRate: n ? Math.round((r.hits / n) * 100) / 100 : 0,
      results, cash: { cure: r.cash.cure, bull: r.cash.bull, effort: r.cash.effort, final, total: base + final },
      pumpkins: r.pumpkins, pumpkinsTaken: r.pumpkinsTaken, durationSec: Math.round(r.t * 10) / 10, stopped: !!stopped,
    };
  }

  // ---------- sim tick (1/60 s) ----------
  function tick() {
    const r = run;
    if (!r || r.phase === 'done') return;
    // slow-mo runs on real time
    if (r.slowmoT > 0) { r.slowmoT -= STEP; if (r.slowmoT <= 0) { r.slowmoT = 0; r.timeScale = 1; } }
    const dt = STEP * r.timeScale;
    r.t += dt;
    // pending timed callbacks
    for (let i = 0; i < r.pending.length; i++) if (r.t >= r.pending[i].at) { const p = r.pending[i]; r.pending.splice(i, 1); i--; p.fn(); }
    // zombies
    for (let i = 0; i < r.zombies.length; i++) {
      const z = r.zombies[i];
      const ev = stepZombie(z, dt);
      if (ev === 'arrive') { sound('knock'); emit({ type: 'knock', item: itemOut(z.item) }); }
      else if (ev === 'reached') {
        if (r.pumpkins > 0) { r.pumpkins--; r.pumpkinsTaken++; z.pumpkin = true; sound('pumpkin'); }
        r.reached++;
        z.item.reached = true;
        emit({ type: 'reached', item: itemOut(z.item), pumpkins: r.pumpkins });
        resolveZombieItem(r, z);
      } else if (ev === 'gone') { r.zombies.splice(i, 1); i--; }
    }
    // the grenade
    const ts = r.throwState;
    if (ts) {
      ts.t += dt;
      const td = ts.plan.touchdowns;
      while (ts.nextTouch < td.length && ts.t >= td[ts.nextTouch].t) {
        const h = td[ts.nextTouch++];
        sound('boing', 0.6 + 0.1 * ts.nextTouch);
        for (let i = 0; i < (reducedMotion ? 2 : 5); i++) R.spawnParticle(r.particles, R.P_DUST, h.x, r.road.y, (r.rand() - 0.5) * 70, -30 - r.rand() * 40, 0.4, 2.5 + r.rand() * 2, withAlpha('#d8cfe8', 0.7), 100, r.road.y + r.road.band * 0.8);
        popup(r, 'boing', h.x, r.road.y - r.road.band * 1.3, '#ffd23f', 0.6, 0.5, 14);
      }
      if (ts.t >= ts.plan.total) land(r);
    }
    // feedback beat -> back to aiming
    if (r.phase === 'beat' && !r.throwState) {
      r.beatT += dt;
      if (r.beatT >= T.beatSec) {
        if (allResolved(r)) beginCalm(r);
        else { r.phase = 'wave'; updateTarget(r); }
      }
    } else if (r.phase === 'wave' && allResolved(r)) beginCalm(r);
    if (r.phase === 'calm') {
      r.calmT += dt;
      r.pumpkinGlow = Math.min(1, r.calmT / 0.8);
      if (r.calmT >= T.calmSec) finish(r, false);
    }
    // fx
    if (r.feedback) r.feedback.t += dt;
    if (r.nudge) r.nudge.t += dt;
    if (r.bolt) { r.bolt.t += dt; if (r.bolt.t >= r.bolt.life) r.bolt = null; }
    if (r.bubble) { r.bubble.t += dt; if (r.bubble.t >= r.bubble.life) r.bubble = null; }
    if (r.banner) { r.banner.t += dt; if (r.banner.t >= r.banner.life) r.banner = null; }
    for (let i = 0; i < r.popups.length; i++) { const p = r.popups[i]; p.t += dt; if (p.t >= p.life) { r.popups.splice(i, 1); i--; } }
    for (let i = 0; i < r.splats.length; i++) { const sp = r.splats[i]; sp.t += dt; if (sp.t >= sp.life) { r.splats.splice(i, 1); i--; } }
    R.stepParticles(r.particles, dt);
    if (r.kidArmT >= 0) { r.kidArmT += STEP; r.kidArm = clamp(r.kidArmT / 0.35, 0, 1); if (r.kidArmT > 0.9) { r.kidArmT = -1; r.kidArm = 0; } }
    const want = r.target && hintFor(r.target) === 'ticks' && r.phase === 'wave' ? 1 : 0;
    r.ticksAlpha += (want - r.ticksAlpha) * Math.min(1, STEP * 6);
    r.shake = Math.max(0, r.shake - STEP * 3.2);
    r.flash = Math.max(0, r.flash - STEP * 2.2);
    if (r.shake > 0) { r.sx = (r.rand() - 0.5) * 10 * r.shake; r.sy = (r.rand() - 0.5) * 8 * r.shake; } else { r.sx = 0; r.sy = 0; }
  }

  // ---------- render ----------
  function render() {
    const r = run;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    if (!r) { ctx.fillStyle = '#1b1033'; ctx.fillRect(0, 0, view.W, view.H); return; }
    const road = r.road, lw = r.lw, t = r.realT;
    ctx.save();
    if (r.sx || r.sy) ctx.translate(r.sx, r.sy);
    R.drawBackdrop(ctx, r.bd, view);
    R.drawStorm(ctx, view, r.bd, t, r.scene);
    R.drawWeather(ctx, r.weather, view, r.bd, t);
    // the scout crow on the gate arch + its call bubble
    const g = r.bd.gate;
    R.drawCrow(ctx, g.x, g.y - g.h - 16, Math.min(18, r.zh * 0.25), t, !!r.bubble, lw);
    if (r.bubble) { const k = r.bubble.t < 0.3 ? r.bubble.t / 0.3 : r.bubble.t > r.bubble.life - 0.25 ? (r.bubble.life - r.bubble.t) / 0.25 : 1; drawBubble(ctx, r.bubble.text, g.x + 14, g.y - g.h - 36, road.fontPx * 0.95, k, lw); }
    if (r.final) drawGateFlag(ctx, g.x + 23, g.y - g.h - 2, t, lw);
    drawLandmarks(ctx, road, r.pal, t, lw);
    // zombies (the one nearest the fence drawn last)
    const cur = r.phase === 'wave' || r.phase === 'beat' ? currentZombie(r) : null;
    for (let i = 0; i < r.zombies.length; i++) {
      const z = r.zombies[i];
      const x = laneX(r, z.p);
      drawZombie(ctx, z, x, r.laneY, r.zh, t, lw);
      if (z.state === 'knock') drawBubble(ctx, 'knock knock', x, r.laneY - r.zh - 10, road.fontPx * 0.7, z.t / 0.25, lw, view.W);
      if (z.state === 'thanks') drawBubble(ctx, 'Thanks!', x, r.laneY - r.zh - 10, road.fontPx * 0.8, z.t / 0.25, lw, view.W);
      if (z === cur && r.zombies.length > 1) drawCallMarker(ctx, x, r.laneY - r.zh - 10, t, lw, '#ffd23f');
    }
    // the road (the asphalt is baked into the backdrop; low fog lies along it)
    R.drawLowFog(ctx, view, road, t, r.scene);
    drawRoadBand(ctx, road, r.pal, t, view.W);
    R.drawPuddleGlints(ctx, r.bd.puddles, t);
    drawParticlePass(r, true); // cracks, dust and ground goo under the splats
    for (let i = 0; i < r.splats.length; i++) R.drawSplat(ctx, r.splats[i], lw);
    let ticks = null;
    if (r.ticksAlpha > 0.02 && r.target) {
      if (!r.ticksCache || r.ticksCache.item !== r.target || r.ticksCache.road !== road) r.ticksCache = { item: r.target, road, list: ticksForItem(road, r.target) };
      ticks = r.ticksCache.list;
    }
    drawNumberLine(ctx, road, r.pal, ticks, r.ticksAlpha, lw);
    // feedback: jumps + flag; nudge; reticle
    const fb = r.feedback;
    if (fb) {
      const jk = clamp((fb.t - 0.15) / T.jumpsSec, 0, 1);
      drawJumps(ctx, road, fb.plan, jk, r.pal, lw);
    }
    if (r.nudge) drawNudge(ctx, road, r.nudge.from, r.nudge.to, r.pal, t, lw, clamp(r.nudge.t / 0.3, 0, 1));
    if (r.phase === 'wave' && r.aim != null) drawReticle(ctx, road, r.aimValue, r.pal, t, lw);
    drawRoadLabels(ctx, road, r.pal, lw);
    // fence, pumpkins, kid
    R.drawFence(ctx, view, road, r.fl, r.scene, r.look.fence, r.pumpkins, lw, t, r.pumpkinGlow);
    R.drawKid(ctx, r.kid.x, r.kid.y, r.kid.h, lw, r.kidArm, t, r.look.kid || {}, r.look.goo);
    // aim preview + grenade + bolt
    const ts = r.throwState;
    if (r.phase === 'wave' && r.aim != null && r.target) {
      if (!r.previewPlan || r.previewPlan.aim !== r.aimValue || r.previewPlan.item !== r.target || r.previewPlan.road !== road) r.previewPlan = { aim: r.aimValue, item: r.target, road, plan: buildPlan(r, r.target, r.aimValue) };
      R.drawArcPreview(ctx, arcPreview(r.previewPlan.plan, 24, preview), 24, '#ffffff', 0.35);
      R.drawGrenade(ctx, r.kid.hand.x, r.kid.hand.y, r.gr, 0, r.look.goo, lw, t);
    }
    if (ts) {
      grenadeAt(ts.plan, ts.t, gpos);
      // shadow on the road
      ctx.fillStyle = withAlpha('#000000', 0.25);
      ctx.beginPath(); ctx.ellipse(gpos.x, road.y, r.gr * 0.9, r.gr * 0.35, 0, 0, TAU); ctx.fill();
      R.drawGrenade(ctx, gpos.x, gpos.y, r.gr, gpos.rot, r.look.goo, lw, t);
    }
    if (r.bolt) drawBolt(ctx, r.bolt, r.look.goo, lw);
    drawParticlePass(r, false);
    // the true-spot flag reads above every effect
    if (fb) drawFlag(ctx, road, fb.target, fb.item.show, clamp(fb.t / T.flagSec, 0, 1), r.pal, lw, t);
    // popups, banner, flash
    R.drawPopups(ctx, r.popups, clamp(Math.min(view.W, view.H) * 0.07, 18, 34), view.W);
    ctx.restore();
    if (r.banner) R.drawBanner(ctx, r.banner.text, view, r.banner.t / r.banner.life, r.banner.color, r.banner.sub);
    if (r.flash > 0) R.drawFlash(ctx, view, r.flash * 0.6, r.flashCol);
    if (r.phase === 'calm' || r.phase === 'done') {
      // a calm vignette: the night settles
      const k = r.phase === 'done' ? 1 : clamp(r.calmT / T.calmSec, 0, 1);
      ctx.fillStyle = withAlpha('#0d0820', 0.25 * easeOut(k));
      ctx.fillRect(0, 0, view.W, view.H);
    }
  }
  // particles: ground pass (on the road band, under the line) / air pass (above the road; never on the labels)
  function drawParticlePass(r, ground) {
    const road = r.road, lim = road.y - road.band;
    if (r.particles.n === 0) return;
    ctx.save();
    ctx.beginPath();
    if (ground) ctx.rect(0, lim, view.W, road.band * 2); else ctx.rect(0, 0, view.W, lim);
    ctx.clip();
    R.drawParticles(ctx, r.particles, r.lw);
    ctx.restore();
  }
  function drawBolt(ctx, b, goo, lw) {
    const k = clamp(b.t / b.life, 0, 1);
    const x = lerp(b.x0, b.x1, k), y = lerp(b.y0, b.y1, k) - Math.sin(k * Math.PI) * 60;
    ctx.strokeStyle = withAlpha(goo, 0.8); ctx.lineWidth = lw * 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.x0, b.y0);
    for (let i = 1; i <= 8; i++) { const u = (i / 8) * k; ctx.lineTo(lerp(b.x0, b.x1, u) + Math.sin(u * 30 + b.t * 50) * 5, lerp(b.y0, b.y1, u) - Math.sin(u * Math.PI) * 60); }
    ctx.stroke();
    ctx.fillStyle = goo; ctx.strokeStyle = R.OUT; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); ctx.stroke();
  }
  function drawGateFlag(ctx, x, y, t, lw) {
    ctx.lineWidth = lw * 1.5; ctx.strokeStyle = R.OUT; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 34); ctx.stroke();
    const w = Math.sin(t * 5) * 2;
    ctx.fillStyle = '#ff8a1f';
    ctx.beginPath(); ctx.moveTo(x, y - 34); ctx.lineTo(x + 24, y - 28 + w); ctx.lineTo(x, y - 20); ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // ---------- loop ----------
  function frame(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.1);
    const r = run;
    const tA = performance.now();
    if (r && !paused) {
      acc += dt * simSpeed;
      let n = 0;
      const maxSteps = MAX_STEPS_PER_FRAME * Math.ceil(simSpeed);
      while (acc >= STEP && n < maxSteps && run === r) {
        const t0 = performance.now();
        tick(); acc -= STEP; n++;
        const tt = performance.now() - t0;
        if (tt > perf.maxTick) perf.maxTick = tt;
      }
      perf.ticks += n;
      if (n >= maxSteps) acc = 0;
      if (run === r) r.realT += dt;
    }
    const tB = performance.now();
    try { render(); } catch (e) { console.error('[engine] render failed', e); }
    const tC = performance.now();
    perf.frames++; perf.sim += tB - tA; perf.draw += tC - tB;
    if (tC - tA > perf.max) perf.max = tC - tA;
    if (tC - tB > perf.maxDraw) perf.maxDraw = tC - tB;
  }
  raf = requestAnimationFrame(frame);

  // ---------- public API ----------
  function getState() {
    const r = run;
    if (!r) return { phase: 'idle', street: null, number: 0, big: false, final: false, total: 0, resolved: 0, cured: 0, reached: 0, throws: 0, bulls: 0, hits: 0, pae: 0, accuracy: 0, cash: 0, pumpkins: 0, aim: null, aimValue: null, target: null, roadPx: { left: 0, right: view.W, y: Math.round(view.H * 0.64) }, road: { from: 0, to: 1 }, live: [], lastThrow: null, inFlight: false, timeSec: 0 };
    const n = r.throws.length;
    const meanPae = n ? r.throws.reduce((a, t) => a + t.pae, 0) / n : 0;
    const base = r.cash.cure + r.cash.bull + r.cash.effort;
    return {
      phase: r.phase, street: r.street.id, number: r.number, big: r.big, final: r.final,
      total: r.items.length, resolved: r.items.filter((it) => it.cured || it.reached).length,
      cured: r.cured, reached: r.reached, throws: n, bulls: r.bulls, hits: r.hits,
      pae: Math.round(meanPae * 10) / 10, accuracy: n ? clamp(Math.round(100 - meanPae), 0, 100) : 0,
      cash: base + (r.final ? base : 0), pumpkins: r.pumpkins,
      aim: r.aim, aimValue: r.aimValue, target: r.target ? itemOut(r.target) : null,
      roadPx: { left: Math.round(r.road.x0), right: Math.round(r.road.x1), y: Math.round(r.road.y) },
      road: { from: r.road.from, to: r.road.to },
      live: r.zombies.map((z) => ({ id: z.id, item: z.item.id, p: Math.round(z.p * 1000) / 1000, state: z.state, look: z.look.id, hat: z.hat, cured: z.cured })),
      lastThrow: r.lastThrow || null, inFlight: !!r.throwState, timeSec: Math.round(r.t * 100) / 100,
    };
  }

  return {
    start,
    setAim(x01) {
      const r = run;
      if (!r || r.phase === 'calm' || r.phase === 'done') return;
      const u = clamp(num(x01, 0), 0, 1);
      if (r.aim === u) return;
      r.aim = u; r.aimValue = r.road.fromX01(u);
      emit({ type: 'aim', x01: u, value: r.aimValue });
    },
    throw() { const r = run; return !!r && r.aim != null && doThrow(r, r.aim); },
    throwAt(x01) { return doThrow(run, x01); },
    updateItem(id, patch = {}) {
      const r = run;
      if (!r) return false;
      const it = r.items.find((x) => x.id === String(id));
      if (!it || it.cured || it.reached) return false;
      if (Array.isArray(patch.hints)) it.hints = patch.hints.filter((h) => typeof h === 'string');
      if (Number(patch.tolerance) > 0) it.tolerance = Number(patch.tolerance);
      if (Array.isArray(patch.ticks) || patch.ticks === null) it.ticks = patch.ticks;
      if (patch.jumps !== undefined) it.jumps = patch.jumps && Number(patch.jumps.unit) > 0 ? { unit: Number(patch.jumps.unit), count: Math.max(1, Math.round(num(patch.jumps.count, 1))) } : null;
      return true;
    },
    pause() { paused = true; },
    resume() { paused = false; last = performance.now(); acc = 0; },
    stop() {
      if (run && run.phase !== 'done') finish(run, true);
      paused = true;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      run = null;
    },
    getState,
    // --- not part of the contract: test / debug helpers ---
    debugStep(n = 1) {
      for (let i = 0; i < n && run; i++) { tick(); if (run) run.realT += STEP; }
      return getState();
    },
    debugPerf(reset = false) {
      const out = { ...perf };
      if (reset) { perf.frames = 0; perf.sim = 0; perf.draw = 0; perf.max = 0; perf.ticks = 0; perf.maxTick = 0; perf.maxDraw = 0; }
      return out;
    },
    debugInfo() {
      const r = run;
      if (!r) return null;
      return {
        t: r.t, phase: r.phase, timeScale: r.timeScale, zombies: r.zombies.map((z) => ({ id: z.id, item: z.item.id, p: z.p, state: z.state, alive: z.alive, resolved: z.resolved, look: z.look.id, hat: z.hat })),
        nextSpawn: r.nextSpawn, liveTarget: r.liveTarget, shuffleSec: r.shuffleSec, particles: r.particles.n, splats: r.splats.length, popups: r.popups.length,
        throwState: r.throwState ? { t: r.throwState.t, total: r.throwState.plan.total, touchdowns: r.throwState.plan.touchdowns.map((h) => ({ t: h.t, x: h.x, v: r.road.fromPx(h.x) })), hops: r.throwState.plan.segs.length - 1, aimed: r.throwState.aimed, land: r.throwState.plan.land } : null,
        grenade: r.throwState ? { ...grenadeAt(r.throwState.plan, r.throwState.t, {}) } : null,
        feedback: r.feedback ? { t: r.feedback.t, target: r.feedback.target, landed: r.feedback.landed, result: r.feedback.result, jumps: r.feedback.plan ? r.feedback.plan.arcs.length : 0, unit: r.feedback.plan ? r.feedback.plan.unit : null } : null,
        nudge: r.nudge ? { from: r.nudge.from, to: r.nudge.to } : null, ticksAlpha: r.ticksAlpha,
        road: { from: r.road.from, to: r.road.to, x0: r.road.x0, x1: r.road.x1, y: r.road.y, labels: r.road.labels.map((l) => ({ at: l.at, text: l.text })), ticks: r.road.ticks.length },
        view: { W: view.W, H: view.H }, cash: { ...r.cash }, pumpkins: r.pumpkins, summary: r.summary, perf: { ...perf }, items: r.items.map((it) => ({ id: it.id, attempts: it.attempts, results: it.results, misses: it.misses, cured: it.cured, reached: it.reached, jumps: it.jumps })),
      };
    },
  };
}

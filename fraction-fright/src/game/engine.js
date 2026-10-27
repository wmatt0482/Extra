// Fraction Fright gameplay engine (SPEC §3 + §13 "The Horde"). Canvas 2D, procedural art, no physics library: the
// grenade flies a closed-form arc (grenade.js), the zombies rise out of the graveyard fog AT THEIR FRACTION'S SPOT and
// shuffle straight toward the road and the fence (zombies.js: a column per zombie, drawn with depth), the road is the
// number line (road.js). Fixed 60 Hz sim step with an accumulator; drawing in css px (render.js).
//
// Contract: createGame(canvas, { onEvent, reducedMotion?, simSpeed? }) → { start, setAim, throw, throwAt, setFocus,
//   pause, resume, stop, destroy, getState, updateItem }.
//   start({ road: { from: 0, to: 1 | 2 | 3, labels: ['0','½','1'] | [{ at, text }], ticks: [{ at, label? }] (the
//     fine ticks, drawn only while the hint ladder asks), landmarks: [{ at, kind: 'grave'|'tree'|'lantern'|'well',
//     label? }] }, wave: { street (id or { id, name, weather: 'clear'|'fog'|'bats'|'stars'|'rain' }), number (1..5),
//     zombies: [item...], big: bool, final: bool, live? (max live at once: default 2, 4 on a big wave, 3 on a final
//     wave; the boss is extra), shuffleSec? }, look: { goo (css colour), fence: 'picket'|'stone'|'iron', pumpkins
//     (count, default 5), kid: { shirt, cap, skin, hair }?, sky?, grenade: 'slime'|'lava'|'frost'|'disco' (cosmetic,
//     default slime), dog: bool (a dog by the ½ post), lantern: bool (a lantern on the graveyard gate) }, stats:
//     { radius (tolerance as a share of the road when an item has none; default 0.10), power (throw speed, 1) }, seed })
//   item = { id, kind: 'locate'|'bounce'|'compare'|'equivalent'|'sum'|'decimal'|'boss', say, show, target (number on
//     the road), jumps?: { unit, count } (the bounce scaffold; derived from `show` for kind 'bounce' when missing),
//     options?, tolerance? (share of the road), hints?: the ladder after a miss on the same item, in order (default
//     ['arrow', 'ticks']), ticks? (the item's own fine ticks), den?, twin? (the other twin's id; cosmetic: twins at the
//     same spot are cured by one grenade through the resolution rule anyway), and for a boss: name, hits (3), forms:
//     [{ show, say }, …] (the same number three ways; the first defaults to show/say) }. The app makes items.
//   Geometry (§13.1): a zombie spawns hidden in the fog at x = road.toPx(item.target) with p = 0 and walks to p = 1 (the
//     lane in front of the road), drawn with depth (scale 0.5 → 1). Hidden entirely while p < EMERGE (0.6; the boss
//     0.5): nothing is drawn (no eyes, no shadow). A zombie is `seen` once p ≥ EMERGE. At p = 1 it knocks, takes a
//     pumpkin and shuffles off sideways (`knock`, `reached`; no other penalty). A cure happens under the grenade: launch,
//     land as the neighbour, a line, walk home into the fog.
//   Focus: the called zombie = the unresolved live one nearest the fence (largest p) unless setFocus(itemId) picked
//     another; `target` fires on every change (and on a boss form change). setFocus(itemId) → bool.
//   setAim(x01): the reticle on the road at x01 (0 = road.from, 1 = road.to); emits aim { x01, value }.
//   throw() → bool: throws the aimed grenade (phase 'wave', an aim set, nothing in flight). throwAt(x01) → bool.
//   Resolution (§13.1): the landing spot is measured against EVERY live zombie: best = the smallest |aimed − target|;
//     the throw resolves against best when its share ≤ 2 × tol(best), else against the focused item (a miss). Result
//     bands and PAE are against the resolved item: 'bull' (≤ 1.5 % of the road) | 'hit' (≤ tolerance) | 'near'
//     (≤ 2 × tolerance) | 'miss'. Every live zombie within its own tolerance of the landing spot is cured by the same
//     throw: every other live zombie standing on the resolved spot (within the bull band) is cured too (twins); a boss
//     takes a hit instead (3 to cure).
//   getState() → { phase: 'idle'|'wave'|'beat'|'finale'|'calm'|'done', street, number, big, final, total, resolved, cured,
//     reached, throws, bulls, hits, pae, accuracy, cash, pumpkins, aim, aimValue, target (the focused item or null),
//     combo, roadPx: { left, right, y }, road: { from, to }, live: [{ id, item, p, state, look, hat, cured, x01, seen,
//     target, focus, boss, hitsLeft }], lastThrow, inFlight, timeSec }.
//   updateItem(id, { hints?, tolerance?, ticks?, jumps? }) patches an unresolved item.
// Events (onEvent({ type, ... })):
//   target { item }        the called item changed (the app speaks item.say); also at start; item.boss / hitsLeft / name
//                          on a boss (show / say = its current form).
//   aim { x01, value }     the reticle moved.
//   toss { item, aimed, aimed01 }   the grenade left the hand.
//   throw { item (the resolved item), aimed, aimed01, err, pae, close, result, tolerance, attempt, hint, cash { cure,
//          bull, effort }, seen (the resolved zombie was visible when the grenade left the hand), combo (hits in a row
//          after this throw), cures: [item ids cured by this throw], fog (= success && !seen) }
//   cured { item, result, pae }   a zombie turned back into a neighbour (≈ 0.25 s after the thunk; one per cure).
//   bossHit { item, left }  the boss took a hit and shows its next form.
//   combo { n }             the combo count changed (0 on a miss).
//   knock { item }          a zombie reached the fence and knocks (it can still be cured while knocking).
//   reached { item, pumpkins }   it took a pumpkin and shuffles off; the wave continues (no other penalty).
//   bigWave { count }, finalWave    at the start of such a wave.   finale   the final wave's last cure (fireworks).
//   calm    the calm beat after the last zombie.
//   waveEnd { street, number, big, final, cured, reached, throws, bulls, hits, nears, misses, pae, accuracy, hitRate,
//            bestCombo, results: [{ id, kind, show, say, target, attempts, result, pae, bestPae, cured, reached, bull,
//            results, seen }], cash: { cure, bull, effort, final, total } (parts add up; the app computes its own cash
//            rows from the `throw` events and ignores this summary's cash), pumpkins, pumpkinsTaken, durationSec, stopped }
//   1.3 Blast (SPEC §15): look.gentle (default false). Blast: a hit squashes the zombie and blasts it into cartoon parts
//   (hat, boots, arms, head; the boss's sash) that bounce on the lane and fade; the torso melts into a goo puddle that
//   stays for the wave (max 8); popups ZAPPED! / SPLAT! / BLASTED!; the boss loses its hat on hit 1 and an arm on hit 2;
//   the finale is a goo lake with the hats bobbing. Gentle: the cure, the walk home, the neighbour line-up. Same
//   events and cash either way; getState().gentle echoes the mode. Sounds added: blast, blastBig (boss / bull), melt,
//   part (a part lands; ≤ 3 per blast).
//   sound { name, vol }     audio hooks (the app owns audio): toss, boing, thunkBig, thunk, thunkSmall, plop, splat,
//                           cure, knock, pumpkin, bigWave, finalWave, calm, waveEnd, lava, frost, shatter, disco, combo,
//                           mega, bossStomp, bossHit, fireworks, mutter, bark.
// Juice (success-dependent, SPEC §0 / §3 / §13.3): bull = 0.4 s slow-mo + the big thunk + full splat + confetti + a
//   small shake; hit = thunk + splat; near = edge splat + a nudge arrow toward the spot; miss = a plop only. After
//   EVERY throw: the true-spot flag, the fraction drawn as unit jumps from 0, and "N % close" (never "wrong"). Combo
//   from ×2 (bigger bursts), the mega splat from ×4. Effects never cover the number line or its labels (labels are
//   drawn above every effect). reducedMotion: no shake, no slow-mo, fewer particles. Pace: the phase is back to 'wave'
//   as soon as the grenade lands; the feedback keeps drawing underneath for 1.6 s.
// Debug (not contract): debugStep(n) (n sim ticks of 1/60 s), debugPerf(reset), debugInfo().

import { TAU, clamp, lerp, mulberry32, hashStr, withAlpha, shade, easeOut, denominatorOf } from './util.js';
import { makeRoad, ticksForItem, drawRoadBand, drawNumberLine, drawRoadLabels, drawLandmarks, drawReticle, drawFlag, jumpPlan, drawJumps, drawNudge, roadPalette } from './road.js';
import { planThrow, grenadeAt, arcPreview } from './grenade.js';
import { makeZombie, stepZombie, cureZombie, drawZombie, drawCallMarker, drawBubble, pickLooks, MUTTERS, THANKS, BOSS_LINES, blastZombie, makeParts, stepParts, drawParts, drawPuddle, drawHat, nextBlastWord } from './zombies.js';
import * as R from './render.js';

const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 4;
const MAX_PARTICLES = 420;
const SPARKS = ['#ffd23f', '#ff8a1f', '#ffffff', '#ffb347', '#ff5d2e'];
const RAINBOW = ['#ff3cac', '#ffd23f', '#4dd2ff', '#9dff2e', '#ff8a1f', '#c77dff', '#ffffff'];
const GRENADES = ['slime', 'lava', 'frost', 'disco'];
// the splat / burst colour per grenade type (slime = the yard's goo colour)
const TYPE_COLOR = { lava: '#ff7a1a', frost: '#9fe8ff', disco: '#ff3cac' };

export const TUNING = {
  maxPuddles: 8,
  bull: 0.015, tolerance: 0.10,
  shuffleSec: 20, shuffleStep: 1.5, shuffleMin: 14, bossSec: 45,
  emerge: 0.6, bossEmerge: 0.5, fadeP: 0.08,
  beatSec: 0.9, feedbackSec: 1.6, cureDelay: 0.25, calmSec: 2.4, finaleSec: 2.5,
  slowmo: 0.3, slowmoSec: 0.4,
  cash: { cure: 120, bull: 60, effort: 40 },
  live: 2, bigLive: 4, finalLive: 3, staggerP: 0.12,
  bossKnock: 0.15, bossDizzy: 1.0, megaCombo: 4,
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
  const show = src.show != null ? String(src.show) : String(target), say = src.say != null ? String(src.say) : '';
  const boss = kind === 'boss';
  let forms = null;
  if (boss) {
    forms = (Array.isArray(src.forms) ? src.forms : []).filter((f) => f && typeof f === 'object').map((f) => ({ show: f.show != null ? String(f.show) : show, say: f.say != null ? String(f.say) : say }));
    if (!forms.length) forms = [{ show, say }];
  }
  return {
    id: src.id != null ? String(src.id) : 'item' + i, kind, say, show, target, jumps, options: Array.isArray(src.options) ? src.options.slice() : null,
    tolerance: Number(src.tolerance) > 0 ? Number(src.tolerance) : null,
    hints: Array.isArray(src.hints) ? src.hints.filter((h) => typeof h === 'string') : ['arrow', 'ticks'],
    ticks: Array.isArray(src.ticks) ? src.ticks : null, den: num(src.den, 0) || null,
    twin: src.twin != null ? String(src.twin) : null,
    boss, name: boss ? (src.name != null ? String(src.name) : 'The Mayor') : null, hits: boss ? Math.max(1, Math.round(num(src.hits, 3))) : 1, forms,
    // run state
    attempts: 0, results: [], paes: [], cured: false, reached: false, bull: false, misses: 0, lastLanded: null, cashCure: 0, cashBull: 0, cashEffort: 0,
    hitsLeft: boss ? Math.max(1, Math.round(num(src.hits, 3))) : 1, form: 0, seenThrows: 0,
  };
}
// the current show / say (a boss cycles through its forms)
const showOf = (it) => (it.forms ? it.forms[Math.min(it.form, it.forms.length - 1)].show : it.show);
const sayOf = (it) => (it.forms ? it.forms[Math.min(it.form, it.forms.length - 1)].say : it.say);

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
    // the column: p = 0 at the far hill line (small, in the fog), p = 1 at the lane in front of the road (full size)
    r.laneY = r.road.y - r.road.band - 4;
    r.farY = r.bd.horizon + 10; // the hill line: nothing ever walks on the sky
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
  // depth helpers: where a zombie at p stands, how big it is, where it is on the road
  const yAt = (r, p) => lerp(r.farY, r.laneY, clamp(p, 0, 1));
  const scaleAt = (p) => lerp(0.45, 1, clamp(p, 0, 1));
  const zx = (r, z) => r.road.toPx(z.item.target) + z.dx;
  const zh = (r, z) => r.zh * scaleAt(z.p) * (z.boss ? 1.6 : 1);
  const isSeen = (z) => z.p >= z.emerge;
  // the engine's own grenade / splat colour for the look
  const gooOf = (r) => (r.look.grenade === 'slime' ? r.look.goo : TYPE_COLOR[r.look.grenade] || r.look.goo);

  // ---------- start ----------
  function start(cfg = {}) {
    const seed = Number.isFinite(Number(cfg.seed)) ? Number(cfg.seed) >>> 0 : hashStr(String(cfg.wave && cfg.wave.street) + ':' + (cfg.wave && cfg.wave.number));
    const rand = mulberry32(seed);
    const wave = cfg.wave || {};
    const streetObj = wave.street && typeof wave.street === 'object' ? wave.street : { id: wave.street != null ? String(wave.street) : 'maple', name: wave.street != null ? String(wave.street) : 'Maple Street' };
    const items = [];
    for (let i = 0; i < (Array.isArray(wave.zombies) ? wave.zombies.length : 0); i++) { const it = itemArg(wave.zombies[i], i); if (it) items.push(it); }
    const number = clamp(Math.round(num(wave.number, 1)), 1, 99);
    const look = { goo: '#8cff1a', fence: 'iron', pumpkins: 5, grenade: 'slime', dog: false, lantern: false, gentle: false, ...(cfg.look || {}) };
    look.gentle = !!look.gentle;   // 1.3 (SPEC §15): Gentle mode cures; the default blasts
    if (typeof look.goo !== 'string') look.goo = '#8cff1a';
    if (!GRENADES.includes(look.grenade)) look.grenade = 'slime';
    const stats = { radius: clamp(num(cfg.stats && cfg.stats.radius, T.tolerance), 0.01, 0.5), power: clamp(num(cfg.stats && cfg.stats.power, 1), 0.6, 2) };
    const big = !!wave.big, final = !!wave.final;
    const r = (run = {
      seed, rand, roadSpec: cfg.road || { from: 0, to: 1 }, wave, street: streetObj, number, big, final, look, stats, items,
      weather: streetObj.weather || 'clear',
      shuffleSec: clamp(num(wave.shuffleSec, T.shuffleSec - (number - 1) * T.shuffleStep), T.shuffleMin, 60),
      looks: pickLooks(rand, items.length),
      phase: 'wave', t: 0, realT: 0, timeScale: 1, slowmoT: 0,
      zombies: [], nextSpawn: 0, liveTarget: clamp(Math.round(num(wave.live, big ? T.bigLive : final ? T.finalLive : T.live)), 1, 6),
      aim: null, aimValue: null, throwState: null, feedback: null, pending: [],
      target: null, targetKey: '', focusId: null, calmT: 0, finaleT: 0,
      throws: [], cured: 0, reached: 0, bulls: 0, hits: 0, nears: 0, misses: 0, cash: { cure: 0, bull: 0, effort: 0 }, combo: 0, bestCombo: 0,
      pumpkins: Math.max(0, Math.round(num(look.pumpkins, 5))), pumpkinsTaken: 0, pumpkinGlow: 0,
      popups: [], particles: R.makeParticles(MAX_PARTICLES), splats: [], curedLooks: [], parts: [], puddles: [], blastHats: [],
      shake: 0, sx: 0, sy: 0, flash: 0, flashCol: '#ffffff', banner: null, bubble: null, megaT: 0, bark: 0, fireT: 0,
      kidArm: 0, kidArmT: -1, ticksAlpha: 0, ticksCache: null, previewPlan: null, nudge: null, summary: null, ended: false, lastThrow: null,
      road: null, pal: null, scene: null, bd: null, fl: null, lw: 2, zh: 60, laneY: 0, farY: 0, kid: null, gr: 10,
    });
    paused = false;
    acc = 0;
    last = performance.now();
    layout(r);
    if (r.big) { emit({ type: 'bigWave', count: r.liveTarget }); sound('bigWave'); banner(r, 'BIG WAVE!', '#c77dff', `${r.liveTarget} at once!`, 2.0); }
    if (r.final) { emit({ type: 'finalWave' }); sound('finalWave'); banner(r, 'FINAL WAVE!', '#ff8a1f', items.some((it) => it.boss) ? 'the boss is coming' : r.big ? `${r.liveTarget} at once!` : null, 2.2); }
    fillSpawns(r);
    if (!items.length) { beginCalm(r); }
    else updateTarget(r, true);
  }
  function banner(r, text, color, sub, life) { r.banner = { text, color, sub, t: 0, life }; }

  // ---------- zombies ----------
  function spawnOne(r, i, k) {
    const it = r.items[i];
    const z = makeZombie(it, i, r.rand, { look: r.looks[i], walkSec: it.boss ? T.bossSec : r.shuffleSec, boss: it.boss, emerge: it.boss ? T.bossEmerge : T.emerge, hats: r.look.hats });
    z.p = -0.02 - T.staggerP * k;
    r.zombies.push(z);
    if (it.boss) sound('bossStomp');
  }
  // Keep the live count up. A zombie only rises onto a spot no live zombie already stands on (the road has few spots
  // on Maple Street: with duplicates one throw would cure a pile and the wave would be over in five throws); the
  // exception is a designated twin (item.twin names a live zombie): equivalent fractions share their spot on purpose.
  // Items are taken in order but a blocked one waits for the next free slot.
  function fillSpawns(r) {
    let k = 0;
    for (let i = r.nextSpawn; i < r.items.length; i++) if (r.items[i].boss && !r.items[i].spawned) { r.items[i].spawned = true; spawnOne(r, i, 0); }
    const taken = (it) => r.zombies.some((z) => z.alive && !z.resolved && !z.boss && Math.abs(z.item.target - it.target) < 1e-6 && !(it.twin && it.twin === z.item.id));
    while (liveCount(r) < r.liveTarget) {
      let i = -1;
      for (let j = r.nextSpawn; j < r.items.length; j++) { const it = r.items[j]; if (!it.spawned && !it.boss && !taken(it)) { i = j; break; } }
      if (i < 0) break;
      r.items[i].spawned = true;
      spawnOne(r, i, k);
      k++;
      while (r.nextSpawn < r.items.length && r.items[r.nextSpawn].spawned) r.nextSpawn++;
    }
  }
  function liveCount(r) { let n = 0; for (const z of r.zombies) if (z.alive && !z.boss) n++; return n; }
  // a zombie that can still be aimed at (a landed hit claims it at once: its cure plays 0.25 s later)
  const targetable = (z) => z.alive && !z.resolved && !z.claimed;
  // the focused zombie: the one picked with setFocus while it is live, else the live one nearest the fence
  function focusZombie(r) {
    if (r.focusId) {
      const f = r.zombies.find((z) => z.item.id === r.focusId);
      if (f && targetable(f)) return f;
      if (!f || !f.alive || f.resolved) r.focusId = null; // a claimed zombie (its hit is landing) keeps the pick
    }
    // nearest the fence; the boss leads only when it is well ahead of the others
    let best = null, bestK = -Infinity;
    for (const z of r.zombies) { if (!targetable(z)) continue; const k = z.p - (z.boss ? 0.25 : 0); if (k > bestK) { bestK = k; best = z; } }
    return best;
  }
  // the called item changes: emit target (also when a boss shows its next form)
  function updateTarget(r, force = false) {
    const z = focusZombie(r);
    const item = z ? z.item : null;
    const key = item ? item.id + ':' + item.form : '';
    if (key !== r.targetKey || force) {
      r.target = item; r.targetKey = key;
      r.ticksCache = null;
      if (item) {
        emit({ type: 'target', item: itemOut(item) });
        r.bubble = { text: showOf(item), t: 0, life: 1.6 };
      }
    }
  }
  function itemOut(it) {
    const o = { id: it.id, kind: it.kind, say: sayOf(it), show: showOf(it), target: it.target, jumps: it.jumps, options: it.options, tolerance: tolOf(run, it), hints: it.hints.slice(), attempt: it.attempts + 1, hint: hintFor(it), twin: it.twin };
    if (it.boss) { o.boss = true; o.name = it.name; o.hitsLeft = it.hitsLeft; o.hits = it.hits; o.form = it.form; }
    return o;
  }
  const tolOf = (r, it) => (it.tolerance != null ? it.tolerance : r.stats.radius);
  // the hint the NEXT throw on this item shows (null before the first miss)
  function hintFor(it) {
    if (it.misses <= 0 || !it.hints.length) return null;
    return it.hints[Math.min(it.misses - 1, it.hints.length - 1)];
  }
  function resolveZombieItem(r) {
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
    const z = focusZombie(r);
    if (!z) return false;
    const item = z.item;
    const aimed01 = clamp(num(x01, 0), 0, 1);
    const aimed = r.road.fromX01(aimed01);
    r.aim = aimed01; r.aimValue = aimed;
    // who was visible when the grenade left the hand (the `seen` flag of the throw)
    const seen = {};
    for (const q of r.zombies) if (targetable(q)) seen[q.item.id] = isSeen(q);
    r.throwState = { plan: buildPlan(r, item, aimed), t: 0, item, zombie: z, aimed, aimed01, nextTouch: 0, seen };
    r.phase = 'beat';
    r.kidArmT = 0;
    r.nudge = null;
    emit({ type: 'toss', item: itemOut(item), aimed, aimed01 });
    sound('toss', 0.7);
    return true;
  }
  function land(r) {
    const ts = r.throwState;
    const road = r.road;
    // resolve against every live zombie (§13.1)
    let best = null, bestShare = Infinity;
    for (const q of r.zombies) {
      if (!targetable(q)) continue;
      const sh = Math.abs(ts.aimed - q.item.target) / road.span;
      if (sh < bestShare) { bestShare = sh; best = q; }
    }
    const focused = targetable(ts.zombie) ? ts.zombie : focusZombie(r);
    const zr = best && bestShare <= 2 * tolOf(r, best.item) + 1e-9 ? best : focused || best;
    const item = zr ? zr.item : ts.item;
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
    const seen = !!ts.seen[item.id];
    if (seen) item.seenThrows++;
    const success = result === 'bull' || result === 'hit';
    const cash = { cure: 0, bull: 0, effort: 0 };
    const cures = [];
    if (success) {
      const factor = result === 'bull' ? 1 : clamp(1 - 0.5 * (share / tol), 0.5, 1);
      cash.cure = Math.round(T.cash.cure * factor);
      if (result === 'bull') { cash.bull = T.cash.bull; item.bull = true; r.bulls++; }
      if (prev === 'near') cash.effort = T.cash.effort;
      r.hits++;
      r.combo++;
      if (r.combo > r.bestCombo) r.bestCombo = r.combo;
      item.cashCure += cash.cure; item.cashBull += cash.bull; item.cashEffort += cash.effort;
      // every other live zombie standing on the SAME spot (within the bull band of the resolved target) is cured too (twins)
      for (const q of r.zombies) {
        if (!targetable(q) || q === zr) continue;
        const sh = Math.abs(ts.aimed - q.item.target) / road.span;
        if (Math.abs(q.item.target - item.target) / road.span <= T.bull + 1e-9 && !q.boss) {
          const it2 = q.item, f2 = sh <= T.bull + 1e-9 ? 1 : clamp(1 - 0.5 * (sh / tolOf(r, it2)), 0.5, 1);
          it2.attempts++; it2.results.push('hit'); it2.paes.push(Math.round(sh * 1000) / 10);
          const c2 = Math.round(T.cash.cure * f2);
          it2.cashCure += c2; cash.cure += c2;
          cures.push(q);
        }
      }
      r.cash.cure += cash.cure; r.cash.bull += cash.bull; r.cash.effort += cash.effort;
    } else {
      item.misses++;
      if (result === 'near') r.nears++; else { r.misses++; r.combo = 0; }
    }
    const rec = { item: item.id, aimed: ts.aimed, aimed01: ts.aimed01, err, pae, result, close, attempt: item.attempts, seen, combo: r.combo };
    r.throws.push(rec);
    r.lastThrow = { result, pae, close, aimed: ts.aimed, err, seen, combo: r.combo };
    // effects
    const x = road.toPx(ts.aimed), y = road.y;
    fxLanding(r, x, y, result);
    // feedback: flag + jumps + "% close" (drawn underneath while the kid aims again)
    r.feedback = { item, t: 0, target: item.target, landed: ts.aimed, result, plan: jumpPlan(road, item), close, show: showOf(item) };
    const label = result === 'bull' ? 'BULL\'S-EYE!' : result === 'hit' ? `SPLAT! ${close} % close` : `${close} % close`;
    popup(r, label, x, y - road.band * 3.3 - 10, result === 'bull' ? '#ffb020' : result === 'hit' ? '#9dff2e' : result === 'near' ? '#5ff0ff' : '#ffffff', result === 'bull' ? 1.5 : result === 'hit' ? 1.15 : 1, 1.6, 28, result === 'bull' ? -0.09 : result === 'hit' ? -0.04 : 0);
    if (result === 'near' || (!success && hintFor(item) === 'arrow')) r.nudge = { from: ts.aimed, to: item.target, t: 0 };
    if (success) {
      if (r.combo >= 2) { popup(r, `COMBO ×${r.combo}`, x, y - road.band * 4.4 - 10, r.combo >= T.megaCombo ? '#ff3cac' : '#c77dff', 1 + Math.min(0.6, r.combo * 0.1), 1.4, 36, 0.06); sound('combo', Math.min(1, 0.6 + r.combo * 0.1)); }
      if (r.combo >= T.megaCombo) megaSplat(r, x, y);
      if (r.look.dog) { r.bark = result === 'bull' ? 0.9 : 0; if (result === 'bull') sound('bark', 0.8); }
      if (cures.length && zr) {
        const a = showOf(zr.item), b = showOf(cures[0].item);
        popup(r, `TWINS! ${a} = ${b}`, x, y - road.band * 5.5 - 10, '#ffd23f', 1.2, 2.0, 30, -0.05);
      }
      const all = zr ? [zr, ...cures] : cures;
      for (const q of all) {
        q.claimed = true;
        r.pending.push({ at: r.t + T.cureDelay, fn: () => hitZombie(r, q, q === zr ? result : 'hit', q === zr ? pae : Math.abs(ts.aimed - q.item.target) / road.span * 100) });
        geyser(r, x, y, q);
      }
    }
    const curedIds = success ? [...(zr && (!zr.boss || zr.item.hitsLeft <= 1) ? [item.id] : []), ...cures.map((q) => q.item.id)] : [];
    const prevCombo = r.lastCombo == null ? 0 : r.lastCombo;
    if (r.combo !== prevCombo) emit({ type: 'combo', n: r.combo });
    r.lastCombo = r.combo;
    emit({ type: 'throw', item: itemOut(item), aimed: ts.aimed, aimed01: ts.aimed01, err, pae, close, result, tolerance: tol, attempt: item.attempts, hint: success ? null : hintFor(item), cash, seen, combo: r.combo, cures: curedIds, fog: success && !seen });
    r.throwState = null;
    r.phase = 'wave';
    updateTarget(r);
  }
  // a hit on a zombie: a boss takes it and shows its next form; anyone else is cured
  function hitZombie(r, z, result, pae) {
    z.claimed = false;
    if (!targetable(z)) return;
    if (z.boss && z.item.hitsLeft > 1) {
      const it = z.item;
      it.hitsLeft--;
      it.form = Math.min(it.form + 1, it.forms.length - 1);
      z.p = Math.max(0.05, z.p - T.bossKnock);
      z.dizzyT = T.bossDizzy;
      z.say = { text: BOSS_LINES[(it.hits - it.hitsLeft - 1) % BOSS_LINES.length], t: 0, life: 1.4 };
      sound('bossHit');
      const x = zx(r, z), y = yAt(r, z.p), h = zh(r, z);
      if (!r.look.gentle) { // Blast: the first hit knocks the hat off, the second an arm
        const lost = !z.hatGone ? 'hat' : !z.armGone ? 'armL' : null;
        if (lost) {
          const parts = makeParts(z, x, y, h, r.rand, true, y + 2).filter((q) => q.kind === lost);
          if (lost === 'hat') z.hatGone = true; else z.armGone = true;
          r.parts.push(...parts);
          popup(r, lost === 'hat' ? 'HAT OFF!' : 'ARM OFF!', x - h * 0.4, y - h - 6, '#9dff2e', 0.9, 1.1, 24, -0.06);
        }
      }
      popup(r, `${it.hitsLeft} TO GO`, x, y - h - 26, '#ff8a1f', 1.1, 1.3, 26, 0.05);
      burst(r, x, y - h * 0.5, reducedMotion ? 8 : 18, gooOf(r), y + 2, 240);
      if (!reducedMotion) r.shake = Math.max(r.shake, 0.6);
      emit({ type: 'bossHit', item: itemOut(it), left: it.hitsLeft });
      updateTarget(r);
      return;
    }
    cureNow(r, z, result, pae);
  }
  function cureNow(r, z, result, pae) {
    if (!targetable(z)) return;
    if (!r.look.gentle) { blastNow(r, z, result, pae); return; }
    const x = zx(r, z), h = zh(r, z), y = yAt(r, z.p);
    const type = r.look.grenade;
    cureZombie(z, { x, y: y - h * 1.05 }, { freeze: type === 'frost', dance: type === 'disco', big: z.boss });
    if (z.boss) z.item.hitsLeft = 0;
    r.cured++;
    z.item.cured = true;
    r.curedLooks.push(z.look);
    sound('cure');
    if (type === 'disco') sound('disco');
    if (type === 'frost') sound('frost');
    // a burst on the zombie + stars (frost: the shatter comes 0.5 s later, from stepZombie)
    const ps = r.particles, n = (reducedMotion ? 8 : 16) * (z.boss ? 2 : 1);
    const col = type === 'disco' ? null : gooOf(r);
    for (let i = 0; i < n; i++) { const a = r.rand() * TAU, v = 60 + r.rand() * 160; R.spawnParticle(ps, i % 3 === 0 ? R.P_STAR : type === 'disco' ? R.P_CONFETTI : R.P_GOO, x, y - h * 0.5, Math.cos(a) * v, Math.sin(a) * v - 80, 0.6 + r.rand() * 0.4, i % 3 === 0 ? 5 : 2 + r.rand() * 3, i % 3 === 0 ? '#ffd23f' : col || RAINBOW[i % RAINBOW.length], 500, y + 2); }
    emit({ type: 'cured', item: itemOut(z.item), result, pae });
    resolveZombieItem(r);
  }
  // 1.3 Blast (SPEC §15.1): the zombie squashes, bursts into cartoon parts and melts into a puddle. Same events and
  // cash as the cure; frost freezes first and the parts fly at the shatter.
  function blastNow(r, z, result, pae) {
    const x = zx(r, z), h = zh(r, z), y = yAt(r, z.p);
    const type = r.look.grenade;
    blastZombie(z, { freeze: type === 'frost', big: z.boss, goo: gooOf(r), floorY: y + 2 });
    if (z.boss) z.item.hitsLeft = 0;
    r.cured++;
    z.item.cured = true;
    r.curedLooks.push(z.look);
    r.blastHats.push({ hat: z.hat, look: z.look, x, u: h / 60 });
    if (type === 'frost') sound('frost');
    else blastFx(r, z, result, x, y, h);
    emit({ type: 'cured', item: itemOut(z.item), result, pae });
    resolveZombieItem(r);
  }
  function blastFx(r, z, result, x, y, h) {
    const big = !!z.boss, type = r.look.grenade, goo = gooOf(r);
    r.parts.push(...makeParts(z, x, y, h, r.rand, big, y + 2));
    if (r.parts.length > 60) r.parts.splice(0, r.parts.length - 60);
    z.partSounds = 0;
    sound(big || result === 'bull' ? 'blastBig' : 'blast');
    if (type === 'disco') sound('disco');
    if (type === 'lava') sound('lava', 0.6);
    const ps = r.particles, n = (reducedMotion ? 10 : 22) * (big ? 1.6 : 1);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.05 + r.rand() * 0.9), v = (120 + r.rand() * 260) * (big ? 1.3 : 1);
      if (type === 'disco') R.spawnParticle(ps, R.P_CONFETTI, x, y - h * 0.5, Math.cos(a) * v, Math.sin(a) * v, 0.9 + r.rand() * 0.6, 3 + r.rand() * 3, RAINBOW[i % RAINBOW.length], 500, y + 2);
      else R.spawnParticle(ps, R.P_GOO, x, y - h * 0.5, Math.cos(a) * v, Math.sin(a) * v, 0.6 + r.rand() * 0.5, 2.5 + r.rand() * 3.5, i % 4 === 0 ? shade(goo, -0.35) : goo, 900, y + 2);
    }
    for (let i = 0; i < (reducedMotion ? 4 : 10) * (big ? 2 : 1); i++) { const a = r.rand() * TAU, v = 100 + r.rand() * 200; R.spawnParticle(ps, R.P_STAR, x, y - h * 0.5, Math.cos(a) * v, Math.sin(a) * v - 60, 0.5 + r.rand() * 0.4, 4, '#ffd23f', 500, y + 2); }
    R.spawnParticle(ps, R.P_RING, x, y - h * 0.45, 0, 0, 0.45, h * (big ? 1.4 : 0.9), goo, 0);
    if (!reducedMotion) r.shake = Math.max(r.shake, big ? 0.9 : 0.5);
    if (result === 'bull' || big) { r.flash = Math.max(r.flash, 0.3); r.flashCol = '#e9ffd0'; }
    popup(r, big ? 'BLASTED!' : nextBlastWord(), x, y - h - 22, big ? '#ff8a1f' : '#9dff2e', big ? 1.5 : 1.15, 1.3, 30, (r.rand() - 0.5) * 0.16);
  }
  // the explosion reaches up the column from the road to the zombie: a goo geyser
  function geyser(r, x, y, z) {
    const ps = r.particles, zy = yAt(r, z.p) - zh(r, z) * 0.3, n = reducedMotion ? 5 : 12, col = r.look.grenade === 'disco' ? null : gooOf(r);
    for (let i = 0; i < n; i++) {
      const k = i / n, py = lerp(y, zy, k);
      R.spawnParticle(ps, col ? R.P_GOO : R.P_CONFETTI, x + (r.rand() - 0.5) * 8, py, (r.rand() - 0.5) * 50, -120 - r.rand() * 120, 0.35 + k * 0.3, 2.5 + r.rand() * 3, col || RAINBOW[i % RAINBOW.length], 700, y + r.road.band * 0.85);
    }
  }
  function megaSplat(r, x, y) {
    r.megaT = 0.3;
    r.flash = Math.max(r.flash, 0.5); r.flashCol = gooOf(r);
    sound('mega');
    if (!reducedMotion) r.shake = 1;
    const ps = r.particles, col = gooOf(r), floor = r.road.y + r.road.band * 0.85;
    for (let i = 0; i < (reducedMotion ? 10 : 30); i++) { const px = r.rand() * view.W; R.spawnParticle(ps, R.P_GOO, px, y - 4, (r.rand() - 0.5) * 80, -200 - r.rand() * 260, 0.6 + r.rand() * 0.5, 3 + r.rand() * 4, col, 900, floor); }
  }
  function fxLanding(r, x, y, result) {
    const road = r.road, goo = gooOf(r), ps = r.particles, type = r.look.grenade;
    const seed = (r.rand() * 1e9) >>> 0;
    const floor = road.y + road.band * 0.85;
    const few = reducedMotion ? 0.5 : 1;
    const more = 1 + Math.min(1, Math.max(0, r.combo - 1) * 0.25); // bigger bursts with the combo
    const success = result === 'bull' || result === 'hit';
    if (success) {
      if (type === 'lava') sound('lava', result === 'bull' ? 1 : 0.8);
      else if (type === 'frost') sound('frost', result === 'bull' ? 1 : 0.8);
    }
    if (result === 'bull') {
      sound('thunkBig'); sound('splat');
      r.splats.push({ v: r.road.fromPx(x), x, y, r: road.band * 1.05 * more, kind: 'full', seed, t: 0, life: 7, goo, type });
      burst(r, x, y, 26 * few * more, goo, floor, 280, type);
      dust(r, x, y, 14 * few, floor);
      cracks(r, x, y, 6, road.band * 2.2);
      for (let i = 0; i < 36 * few; i++) { const a = -Math.PI * (0.1 + r.rand() * 0.8), v = 220 + r.rand() * 420; R.spawnParticle(ps, R.P_SPARK, x, y - 2, Math.cos(a) * v, Math.sin(a) * v, 0.5 + r.rand() * 0.6, 1.5 + r.rand() * 2, sparkColor(type, i), 700, floor); }
      R.spawnParticle(ps, R.P_RING, x, y, 0, 0, 0.5, road.band * 2.4, '#ffffff', 0);
      R.spawnParticle(ps, R.P_RING, x, y, 0, 0, 0.7, road.band * 3.2 * more, goo, 0);
      if (!reducedMotion) { r.shake = 1; r.slowmoT = T.slowmoSec; r.timeScale = T.slowmo; }
      r.flash = 0.35; r.flashCol = type === 'lava' ? '#ffe3c0' : type === 'frost' ? '#e3f6ff' : '#e9ffd0';
    } else if (result === 'hit') {
      sound('thunk'); sound('splat', 0.8);
      r.splats.push({ v: r.road.fromPx(x), x, y, r: road.band * 0.85 * more, kind: 'full', seed, t: 0, life: 6, goo, type });
      burst(r, x, y, 16 * few * more, goo, floor, 230, type);
      dust(r, x, y, 10 * few, floor);
      cracks(r, x, y, 4, road.band * 1.6);
      for (let i = 0; i < 10 * few; i++) { const a = -Math.PI * (0.15 + r.rand() * 0.7), v = 160 + r.rand() * 260; R.spawnParticle(ps, R.P_SPARK, x, y - 2, Math.cos(a) * v, Math.sin(a) * v, 0.4 + r.rand() * 0.4, 1.5 + r.rand(), sparkColor(type, i), 700, floor); }
      R.spawnParticle(ps, R.P_RING, x, y, 0, 0, 0.45, road.band * 1.9 * more, goo, 0);
    } else if (result === 'near') {
      sound('thunkSmall');
      r.splats.push({ v: r.road.fromPx(x), x, y, r: road.band * 0.6, kind: 'edge', seed, t: 0, life: 5, goo, type });
      burst(r, x, y, 8 * few, goo, floor, 150, type);
      dust(r, x, y, 5 * few, floor);
    } else {
      sound('plop');
      r.splats.push({ v: r.road.fromPx(x), x, y, r: road.band * 0.3, kind: 'plop', seed, t: 0, life: 4, goo, type });
      for (let i = 0; i < 5 * few; i++) R.spawnParticle(ps, R.P_DUST, x + (r.rand() - 0.5) * 10, y, (r.rand() - 0.5) * 60, -20 - r.rand() * 40, 0.5, 3 + r.rand() * 3, withAlpha('#c9b8d8', 0.6), 60, floor);
    }
    if (type === 'lava' && success) R.spawnParticle(ps, R.P_SCORCH, x, y, 0, 0, 5, road.band * (result === 'bull' ? 1.6 : 1.2), '#1a0d0a', 0);
    if (r.splats.length > 10) r.splats.shift();
  }
  const sparkColor = (type, i) => (type === 'frost' ? (i % 2 ? '#ffffff' : '#9fe8ff') : type === 'disco' ? RAINBOW[i % RAINBOW.length] : SPARKS[i % SPARKS.length]);
  function dust(r, x, y, n, floor) {
    for (let i = 0; i < n; i++) R.spawnParticle(r.particles, R.P_DUST, x + (r.rand() - 0.5) * 16, y, (r.rand() - 0.5) * 160, -30 - r.rand() * 70, 0.5 + r.rand() * 0.4, 3 + r.rand() * 4, withAlpha('#b7aac4', 0.5), 120, floor);
  }
  function cracks(r, x, y, n, len) {
    for (let i = 0; i < n; i++) { const p = R.spawnParticle(r.particles, R.P_CRACK, x, y, 0, 0, 1.6 + r.rand() * 0.6, len * (0.6 + r.rand() * 0.6), '#0d0b12', 0); if (p) p.a = (i / n) * TAU + r.rand() * 0.5; }
  }
  // the goo burst: drops (slime / lava), crystals (frost) or confetti (disco)
  function burst(r, x, y, n, goo, floor, v, type = r.look.grenade) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.15 + r.rand() * 0.7), s = v * (0.4 + r.rand() * 0.9);
      if (type === 'frost') R.spawnParticle(r.particles, R.P_STAR, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.6 + r.rand() * 0.5, 3 + r.rand() * 4, i % 3 ? '#cfefff' : '#ffffff', 900, floor);
      else if (type === 'disco') R.spawnParticle(r.particles, R.P_CONFETTI, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.9 + r.rand() * 0.6, 3 + r.rand() * 3, RAINBOW[i % RAINBOW.length], 500, floor);
      else R.spawnParticle(r.particles, R.P_GOO, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.6 + r.rand() * 0.5, 2 + r.rand() * 3.5, i % 4 === 0 ? shade(goo, type === 'lava' ? 0.3 : -0.35) : goo, 900, floor);
    }
  }
  function popup(r, text, x, y, color, scale = 1, life = 1.2, rise = 28, tilt = 0) {
    r.popups.push({ text, x, y, t: 0, life, color, scale, rise, tilt });
    if (r.popups.length > 8) r.popups.shift();
  }
  // a firework burst in the sky (the finale)
  function firework(r) {
    const x = view.W * (0.1 + r.rand() * 0.8), y = r.bd.horizon * (0.15 + r.rand() * 0.55);
    const col = RAINBOW[Math.floor(r.rand() * RAINBOW.length)], n = reducedMotion ? 12 : 26;
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, v = 90 + r.rand() * 70; R.spawnParticle(r.particles, i % 4 === 0 ? R.P_STAR : R.P_SPARK, x, y, Math.cos(a) * v, Math.sin(a) * v, 0.9 + r.rand() * 0.5, i % 4 === 0 ? 4 : 2, i % 3 === 0 ? '#ffffff' : col, 110, r.laneY); }
    R.spawnParticle(r.particles, R.P_RING, x, y, 0, 0, 0.5, 40, col, 0);
  }

  // ---------- wave end ----------
  function allResolved(r) { return r.items.every((it) => it.cured || it.reached) && r.zombies.every((z) => z.resolved); }
  function beginCalm(r) {
    if (r.phase === 'calm' || r.phase === 'done') return;
    r.phase = 'calm'; r.calmT = 0; r.target = null; r.targetKey = '';
    r.aim = null;
    emit({ type: 'calm' });
    sound('calm');
  }
  // the final wave's last cure: fireworks, the neighbours line up, the kid cheers; then the calm beat
  function beginFinale(r) {
    if (r.phase === 'finale' || r.phase === 'calm' || r.phase === 'done') return;
    if (!r.final || r.cured === 0) { beginCalm(r); return; }
    r.phase = 'finale'; r.finaleT = 0; r.fireT = 0; r.target = null; r.targetKey = ''; r.aim = null;
    emit({ type: 'finale' });
    sound('fireworks');
    r.pending.push({ at: r.t + 0.5, fn: () => banner(r, 'STREET CLEARED!', '#9dff2e', null, 2.0) });
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
      bestPae: it.paes.length ? Math.min(...it.paes) : null, cured: it.cured, reached: it.reached, bull: it.bull, results: it.results.slice(), seen: it.seenThrows,
      cash: { cure: it.cashCure, bull: it.cashBull, effort: it.cashEffort }, boss: it.boss || undefined,
    }));
    const base = r.cash.cure + r.cash.bull + r.cash.effort;
    const final = r.final ? base : 0;
    return {
      street: r.street.id, streetName: r.street.name, number: r.number, big: r.big, final: r.final,
      cured: r.cured, reached: r.reached, throws: n, bulls: r.bulls, hits: r.hits, nears: r.nears, misses: r.misses,
      pae: meanPae, accuracy: n ? clamp(Math.round(100 - meanPae), 0, 100) : 0, hitRate: n ? Math.round((r.hits / n) * 100) / 100 : 0, bestCombo: r.bestCombo,
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
    let focusChanged = false;
    for (let i = 0; i < r.zombies.length; i++) {
      const z = r.zombies[i];
      const wasSeen = isSeen(z);
      const ev = stepZombie(z, dt);
      if (ev === 'arrive') { sound('knock'); emit({ type: 'knock', item: itemOut(z.item) }); }
      else if (ev === 'reached') {
        if (r.pumpkins > 0) { r.pumpkins--; r.pumpkinsTaken++; z.pumpkin = true; sound('pumpkin'); }
        r.reached++;
        z.item.reached = true;
        if (z.boss) z.item.hitsLeft = 0;
        emit({ type: 'reached', item: itemOut(z.item), pumpkins: r.pumpkins });
        resolveZombieItem(r);
        focusChanged = true;
      } else if (ev === 'shatter') {
        // frost: the ice block shatters into the neighbour (Gentle) or into parts (Blast)
        sound('shatter');
        const x = zx(r, z), y = yAt(r, z.p), h = zh(r, z);
        for (let k = 0; k < (reducedMotion ? 8 : 18); k++) { const a = r.rand() * TAU, v = 80 + r.rand() * 180; R.spawnParticle(r.particles, R.P_STAR, x, y - h * 0.5, Math.cos(a) * v, Math.sin(a) * v - 60, 0.5 + r.rand() * 0.4, 3 + r.rand() * 4, k % 2 ? '#ffffff' : '#9fe8ff', 700, y + 2); }
        if (z.state === 'blast') blastFx(r, z, 'hit', x, y, h);
      } else if (ev === 'melt') {
        sound('melt', 0.7);
      } else if (ev === 'puddle') {
        const x = zx(r, z), h = zh(r, z);
        r.puddles.push({ x, y: z.floorY, r: h * 0.42 * (z.big ? 1.5 : 1), goo: z.goo, t: 0, life: 0 });
        while (r.puddles.filter((q) => !q.life).length > T.maxPuddles) { const old = r.puddles.find((q) => !q.life); old.life = old.t + 1; }
        r.zombies.splice(i, 1); i--; continue;
      } else if (ev === 'gone') { r.zombies.splice(i, 1); i--; continue; }
      // chatter: visible zombies mutter every 5–9 s; a cured neighbour says its line once
      if (z.state === 'walk' && isSeen(z) && !z.say) {
        if (!wasSeen || z.nextMutter == null) z.nextMutter = r.t + 1.2 + r.rand() * 2;
        if (r.t >= z.nextMutter) {
          z.say = { text: z.boss ? BOSS_LINES[BOSS_LINES.length - 1] : MUTTERS[Math.floor(r.rand() * MUTTERS.length)], t: 0, life: 1.6 };
          z.nextMutter = r.t + 5 + r.rand() * 4;
          sound('mutter', 0.5);
        }
      }
      if (z.say) { z.say.t += dt; if (z.say.t >= z.say.life) { z.say = null; if (z.state === 'walk') z.nextMutter = r.t + 5 + r.rand() * 4; } }
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
    if (r.phase === 'wave') {
      if (allResolved(r)) beginFinale(r);
      else if (focusChanged || !r.target || !r.zombies.some((z) => targetable(z) && z.item === r.target)) updateTarget(r);
    }
    if (r.phase === 'finale') {
      r.finaleT += dt;
      r.fireT -= dt;
      if (r.fireT <= 0) { firework(r); r.fireT = 0.3 + r.rand() * 0.25; }
      if (r.finaleT >= T.finaleSec) beginCalm(r);
    }
    if (r.phase === 'calm') {
      r.calmT += dt;
      r.pumpkinGlow = Math.min(1, r.calmT / 0.8);
      if (r.calmT >= T.calmSec) finish(r, false);
    }
    // fx
    if (r.feedback) { r.feedback.t += dt; if (r.feedback.t >= T.feedbackSec + T.jumpsSec) r.feedback = null; }
    if (r.nudge) r.nudge.t += dt;
    if (r.bubble) { r.bubble.t += dt; if (r.bubble.t >= r.bubble.life) r.bubble = null; }
    if (r.banner) { r.banner.t += dt; if (r.banner.t >= r.banner.life) r.banner = null; }
    if (r.megaT > 0) r.megaT -= STEP;
    if (r.bark > 0) r.bark -= dt;
    for (let i = 0; i < r.popups.length; i++) { const p = r.popups[i]; p.t += dt; if (p.t >= p.life) { r.popups.splice(i, 1); i--; } }
    for (let i = 0; i < r.splats.length; i++) { const sp = r.splats[i]; sp.t += dt; if (sp.t >= sp.life) { r.splats.splice(i, 1); i--; } }
    R.stepParticles(r.particles, dt);
    if (r.parts.length) {
      const landed = stepParts(r.parts, dt);
      if (landed) { r.partSounds = (r.partSounds || 0) + landed; if (r.partSounds <= 3) sound('part', 0.5); }
      for (let i = 0; i < r.parts.length; i++) if (r.parts[i].t >= r.parts[i].life) { r.parts.splice(i, 1); i--; }
      if (!r.parts.length) r.partSounds = 0;
    }
    for (let i = 0; i < r.puddles.length; i++) { const q = r.puddles[i]; q.t += dt; if (q.life && q.t >= q.life) { r.puddles.splice(i, 1); i--; } }
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
    // the scout crow on the gate arch + its call bubble (+ the yard's lantern)
    const g = r.bd.gate;
    if (r.look.lantern) R.drawGateLantern(ctx, g.x + 34, g.y - g.h + 4, Math.min(16, r.zh * 0.22), t, lw);
    R.drawCrow(ctx, g.x, g.y - g.h - 16, Math.min(18, r.zh * 0.25), t, !!r.bubble, lw);
    if (r.bubble) { const k = r.bubble.t < 0.3 ? r.bubble.t / 0.3 : r.bubble.t > r.bubble.life - 0.25 ? (r.bubble.life - r.bubble.t) / 0.25 : 1; drawBubble(ctx, r.bubble.text, g.x + 74, g.y - g.h + 4, road.fontPx * 0.95, k, lw); } // beside the crow, clear of the HUD's street box
    if (r.final) drawGateFlag(ctx, g.x + 23, g.y - g.h - 2, t, lw);
    drawLandmarks(ctx, road, r.pal, t, lw);
    // Blast: the puddles on the lane (under the zombies); the finale's goo lake
    for (const q of r.puddles) drawPuddle(ctx, q, lw, t);
    if (!r.look.gentle && (r.phase === 'finale' || (r.phase === 'calm' && r.final && r.blastHats.length))) drawGooLake(r, t, lw);
    // zombies in their columns, far ones first (hidden while p < EMERGE: drawZombie draws nothing at alpha 0)
    const cur = r.phase === 'wave' || r.phase === 'beat' ? focusZombie(r) : null;
    const order = r.zombies.slice().sort((a, b) => a.p - b.p);
    for (let i = 0; i < order.length; i++) {
      const z = order[i];
      const x = zx(r, z), y = yAt(r, z.p), h = zh(r, z);
      drawZombie(ctx, z, x, y, h, t, lw);
      if (!isSeen(z) && z.alive) continue;
      const fz = road.fontPx * (0.55 + 0.25 * scaleAt(z.p));
      if (z.state === 'knock') drawBubble(ctx, 'knock knock', x, y - h - 10, fz, z.t / 0.25, lw, view.W);
      else if (z.state === 'thanks') drawBubble(ctx, z.line || 'Thanks!', x, y - h - 10, fz * 1.1, z.t / 0.25, lw, view.W);
      else if (z.say) { const k = z.say.t < 0.25 ? z.say.t / 0.25 : z.say.t > z.say.life - 0.2 ? (z.say.life - z.say.t) / 0.2 : 1; drawBubble(ctx, z.say.text, x, y - h - 10, fz, k, lw, view.W); }
      if (z === cur && r.zombies.some((q) => q !== z && targetable(q) && isSeen(q))) drawCallMarker(ctx, x, y - h - (z.say || z.state === 'knock' ? fz * 2.2 : 0) - 10, t, lw, '#ffd23f');
    }
    // the fog bank the zombies rise out of (over the far lane; soft toward the emerge line)
    R.drawFogBank(ctx, view, r.bd.horizon - 30, yAt(r, T.emerge) + r.zh * 0.1, t, r.scene);
    // the road (the asphalt is baked into the backdrop; low fog lies along it)
    R.drawLowFog(ctx, view, road, t, r.scene);
    drawRoadBand(ctx, road, r.pal, t, view.W);
    R.drawPuddleGlints(ctx, r.bd.puddles, t);
    drawParticlePass(r, true); // cracks, dust and ground goo under the splats
    for (let i = 0; i < r.splats.length; i++) R.drawSplat(ctx, r.splats[i], lw);
    if (r.megaT > 0) R.drawMegaWave(ctx, view, road, 1 - r.megaT / 0.3, gooOf(r), t);
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
      const fade = fb.t > T.feedbackSec ? 1 - (fb.t - T.feedbackSec) / T.jumpsSec : 1;
      ctx.globalAlpha = clamp(fade, 0, 1);
      drawJumps(ctx, road, fb.plan, jk, r.pal, lw);
      ctx.globalAlpha = 1;
    }
    if (r.nudge) drawNudge(ctx, road, r.nudge.from, r.nudge.to, r.pal, t, lw, clamp(r.nudge.t / 0.3, 0, 1));
    if (r.phase === 'wave' && r.aim != null) drawReticle(ctx, road, r.aimValue, r.pal, t, lw);
    drawRoadLabels(ctx, road, r.pal, lw);
    // fence, pumpkins, the dog, kid
    R.drawFence(ctx, view, road, r.fl, r.scene, r.look.fence, r.pumpkins, lw, t, r.pumpkinGlow);
    if (r.look.dog) {
      const dx = road.toPx(road.from + road.span * 0.25), dy = r.fl.y0 - 2; // by the fence at the ¼ mark (the kid stands at ½ in landscape)
      R.drawDog(ctx, dx, dy, clamp(r.zh * 0.34, 16, 30), t, lw, r.bark > 0);
      if (r.bark > 0) drawBubble(ctx, 'Woof!', dx, dy - r.zh * 0.36 - 8, road.fontPx * 0.7, r.bark / 0.9 > 0.7 ? (0.9 - r.bark) / 0.27 : 1, lw, view.W);
    }
    if (r.look.gentle && (r.phase === 'finale' || (r.phase === 'calm' && r.final && r.curedLooks.length))) drawNeighbours(r, t, lw);
    const hop = r.phase === 'finale' ? Math.abs(Math.sin(t * 7)) * r.kid.h * 0.12 : 0;
    R.drawKid(ctx, r.kid.x, r.kid.y - hop, r.kid.h, lw, r.kidArm, t, r.look.kid || {}, r.look.goo, r.phase === 'finale');
    // aim preview + grenade
    const ts = r.throwState;
    if (r.phase === 'wave' && r.aim != null && r.target) {
      if (!r.previewPlan || r.previewPlan.aim !== r.aimValue || r.previewPlan.item !== r.target || r.previewPlan.road !== road) r.previewPlan = { aim: r.aimValue, item: r.target, road, plan: buildPlan(r, r.target, r.aimValue) };
      R.drawArcPreview(ctx, arcPreview(r.previewPlan.plan, 24, preview), 24, '#ffffff', 0.35);
      R.drawGrenade(ctx, r.kid.hand.x, r.kid.hand.y, r.gr, 0, r.look.goo, lw, t, r.look.grenade);
    }
    if (ts) {
      grenadeAt(ts.plan, ts.t, gpos);
      // shadow on the road
      ctx.fillStyle = withAlpha('#000000', 0.25);
      ctx.beginPath(); ctx.ellipse(gpos.x, road.y, r.gr * 0.9, r.gr * 0.35, 0, 0, TAU); ctx.fill();
      R.drawGrenade(ctx, gpos.x, gpos.y, r.gr, gpos.rot, r.look.goo, lw, t, r.look.grenade);
    }
    if (r.parts.length) drawParts(ctx, r.parts, lw, t);
    drawParticlePass(r, false);
    // the true-spot flag reads above every effect
    if (fb) { const fade = fb.t > T.feedbackSec ? 1 - (fb.t - T.feedbackSec) / T.jumpsSec : 1; ctx.globalAlpha = clamp(fade, 0, 1); drawFlag(ctx, road, fb.target, fb.show, clamp(fb.t / T.flagSec, 0, 1), r.pal, lw, t); ctx.globalAlpha = 1; }
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
  // the finale in Blast: the lane is a goo lake with the blasted zombies' hats bobbing in it
  function drawGooLake(r, t, lw) {
    const road = r.road, goo = gooOf(r), y = r.laneY + 2, hh = r.zh * 0.3;
    const k = r.phase === 'finale' ? clamp(r.finaleT / 0.8, 0, 1) : 1;
    const x0 = road.x0 - 20, x1 = road.x1 + 20;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineWidth = lw * 1.2; ctx.strokeStyle = R.OUT;
    for (const [col, dy, amp] of [[shade(goo, -0.3), 0, 1], [goo, -3, 0.7]]) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(x0, y + 4);
      for (let x = x0; x <= x1; x += 18) ctx.lineTo(x, y + dy - hh * k * (0.6 + 0.4 * Math.sin(x * 0.05 + t * 2.2) * amp));
      ctx.lineTo(x1, y + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // bubbles
    for (let i = 0; i < 6; i++) { const b = (t * 0.5 + i * 0.17) % 1; const bx = lerp(x0 + 30, x1 - 30, ((i * 0.37 + 0.1) % 1)); ctx.fillStyle = withAlpha(shade(goo, 0.3), 0.8 * (1 - b)); ctx.beginPath(); ctx.arc(bx, y - hh * k * 0.5 - b * 8, 2 + b * 4, 0, TAU); ctx.fill(); }
    // the hats bob on the surface
    const hats = r.blastHats.slice(-10), n = hats.length;
    for (let i = 0; i < n; i++) {
      const hx = clamp(hats[i].x, road.x0 + 10, road.x1 - 10), hy = y - hh * k * 0.8 + Math.sin(t * 2.4 + i) * 3;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(Math.sin(t * 1.7 + i) * 0.12); ctx.lineWidth = lw * 1.3; ctx.strokeStyle = R.OUT;
      drawHat(ctx, hats[i].hat, 0, 0, hats[i].u * 0.9, lw, t, hats[i].look);
      ctx.restore();
    }
    ctx.restore();
  }
  // the finale: the wave's cured neighbours line up along the fence, waving
  function drawNeighbours(r, t, lw) {
    const looks = r.curedLooks.slice(0, 10), n = looks.length;
    if (!n) return;
    const h = r.zh * 0.62, y = r.fl.bottom + h * 0.95;
    const x0 = view.W * 0.06, x1 = view.W * 0.94;
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? view.W * 0.3 : lerp(x0, x1, i / (n - 1));
      if (Math.abs(x - r.kid.x) < r.kid.h * 0.5) continue; // not on top of the kid
      const fake = { look: looks[i], hat: looks[i].hat, state: 'thanks', cured: true, t: 1, wobble: i * 1.3, bob: 1, gait: 1, limp: 1, face: 1, hatFly: null, pumpkin: null, alive: false, boss: false, dance: r.look.grenade === 'disco', wave: true, seenK: 1 };
      drawZombie(ctx, fake, x, y - Math.abs(Math.sin(t * 6 + i)) * h * 0.08, h, t + i, lw);
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
    if (!r) return { phase: 'idle', street: null, number: 0, big: false, final: false, total: 0, resolved: 0, cured: 0, reached: 0, throws: 0, bulls: 0, hits: 0, pae: 0, accuracy: 0, cash: 0, pumpkins: 0, aim: null, aimValue: null, target: null, combo: 0, gentle: false, roadPx: { left: 0, right: view.W, y: Math.round(view.H * 0.64) }, road: { from: 0, to: 1 }, live: [], lastThrow: null, inFlight: false, timeSec: 0 };
    const n = r.throws.length;
    const meanPae = n ? r.throws.reduce((a, t) => a + t.pae, 0) / n : 0;
    const base = r.cash.cure + r.cash.bull + r.cash.effort;
    const cur = focusZombie(r);
    return {
      phase: r.phase, street: r.street.id, number: r.number, big: r.big, final: r.final,
      total: r.items.length, resolved: r.items.filter((it) => it.cured || it.reached).length,
      cured: r.cured, reached: r.reached, throws: n, bulls: r.bulls, hits: r.hits,
      pae: Math.round(meanPae * 10) / 10, accuracy: n ? clamp(Math.round(100 - meanPae), 0, 100) : 0,
      cash: base + (r.final ? base : 0), pumpkins: r.pumpkins,
      aim: r.aim, aimValue: r.aimValue, target: r.target ? itemOut(r.target) : null, combo: r.combo, gentle: !!r.look.gentle,
      roadPx: { left: Math.round(r.road.x0), right: Math.round(r.road.x1), y: Math.round(r.road.y) },
      road: { from: r.road.from, to: r.road.to },
      live: r.zombies.map((z) => ({ id: z.id, item: z.item.id, p: Math.round(z.p * 1000) / 1000, state: z.state, look: z.look.id, hat: z.hat, cured: z.cured, x01: Math.round(r.road.toX01(z.item.target) * 1000) / 1000, target: z.item.target, seen: isSeen(z), focus: z === cur, boss: !!z.boss, hitsLeft: z.item.hitsLeft })),
      lastThrow: r.lastThrow || null, inFlight: !!r.throwState, timeSec: Math.round(r.t * 100) / 100,
    };
  }

  return {
    start,
    setAim(x01) {
      const r = run;
      if (!r || r.phase === 'calm' || r.phase === 'done' || r.phase === 'finale') return;
      const u = clamp(num(x01, 0), 0, 1);
      if (r.aim === u) return;
      r.aim = u; r.aimValue = r.road.fromX01(u);
      emit({ type: 'aim', x01: u, value: r.aimValue });
    },
    throw() { const r = run; return !!r && r.aim != null && doThrow(r, r.aim); },
    throwAt(x01) { return doThrow(run, x01); },
    setFocus(itemId) {
      const r = run;
      if (!r || r.phase === 'calm' || r.phase === 'done' || r.phase === 'finale') return false;
      const id = String(itemId);
      const z = r.zombies.find((q) => targetable(q) && q.item.id === id);
      if (!z) return false;
      r.focusId = id;
      updateTarget(r);
      return true;
    },
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
        t: r.t, phase: r.phase, timeScale: r.timeScale, combo: r.combo, bestCombo: r.bestCombo, focusId: r.focusId,
        zombies: r.zombies.map((z) => ({ id: z.id, item: z.item.id, p: z.p, state: z.state, alive: z.alive, resolved: z.resolved, look: z.look.id, hat: z.hat, seen: isSeen(z), x: zx(r, z), y: yAt(r, z.p), boss: !!z.boss, hitsLeft: z.item.hitsLeft, form: z.item.form, dizzy: z.dizzyT })),
        nextSpawn: r.nextSpawn, liveTarget: r.liveTarget, shuffleSec: r.shuffleSec, particles: r.particles.n, splats: r.splats.length, popups: r.popups.map((p) => p.text),
        gentle: !!r.look.gentle, parts: r.parts.map((q) => ({ kind: q.kind, x: Math.round(q.x), y: Math.round(q.y), bounced: q.bounced })), puddles: r.puddles.map((q) => ({ x: Math.round(q.x), y: Math.round(q.y), r: Math.round(q.r) })), blastHats: r.blastHats.length,
        throwState: r.throwState ? { t: r.throwState.t, total: r.throwState.plan.total, touchdowns: r.throwState.plan.touchdowns.map((h) => ({ t: h.t, x: h.x, v: r.road.fromPx(h.x) })), hops: r.throwState.plan.segs.length - 1, aimed: r.throwState.aimed, land: r.throwState.plan.land, seen: r.throwState.seen } : null,
        grenade: r.throwState ? { ...grenadeAt(r.throwState.plan, r.throwState.t, {}) } : null,
        feedback: r.feedback ? { t: r.feedback.t, target: r.feedback.target, landed: r.feedback.landed, result: r.feedback.result, jumps: r.feedback.plan ? r.feedback.plan.arcs.length : 0, unit: r.feedback.plan ? r.feedback.plan.unit : null, item: r.feedback.item.id } : null,
        nudge: r.nudge ? { from: r.nudge.from, to: r.nudge.to } : null, ticksAlpha: r.ticksAlpha, megaT: r.megaT, finaleT: r.finaleT,
        road: { from: r.road.from, to: r.road.to, x0: r.road.x0, x1: r.road.x1, y: r.road.y, labels: r.road.labels.map((l) => ({ at: l.at, text: l.text })), ticks: r.road.ticks.length },
        lane: { farY: r.farY, laneY: r.laneY, emergeY: yAt(r, T.emerge) },
        view: { W: view.W, H: view.H }, cash: { ...r.cash }, pumpkins: r.pumpkins, summary: r.summary, perf: { ...perf }, look: { grenade: r.look.grenade, dog: !!r.look.dog, lantern: !!r.look.lantern },
        items: r.items.map((it) => ({ id: it.id, attempts: it.attempts, results: it.results, misses: it.misses, cured: it.cured, reached: it.reached, jumps: it.jumps, seen: it.seenThrows, boss: it.boss, hitsLeft: it.hitsLeft, form: it.form })),
      };
    },
  };
}

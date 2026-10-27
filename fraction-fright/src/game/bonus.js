// Fraction Fright bonus round: the Critter Stampede (SPEC §14). A short pure-arcade reward the math earns: zombie
// critters (squirrels, raccoons, bunnies, chickens, bats, crows) pour across the same yard; the kid holds a finger
// down and the Slime Sprayer streams goo pellets at the finger; a pellet that touches a zombie critter cures it (pop,
// goo burst, a party hat, a happy scamper off). The round ends when the stampede has passed: no timer, no countdown,
// no ammo or energy gauge, no pressure text, nothing stops a critter from running on.
//
// Contract: createBonus(canvas, { onEvent, reducedMotion?, simSpeed? }) → { start, aim, fire, stop, destroy, getState,
//   debugStep }.
//   start({ look: { goo, fence, fenceColor, sky, grenade, kid, pumpkins }, seed, stampede: { count (30), goldAt (0.6) },
//     street: { id, name } })
//   aim(x, y)           the finger, css px on the canvas (the cannon tracks it).
//   fire(on)            true while the finger is down: ≈ 12 pellets/s toward the aim point; false on release.
//   stop()              ends at once: bonusEnd { stopped: true } with what was cured so far.
//   destroy()           cancels the loop.
//   getState() → { phase: 'idle'|'intro'|'run'|'outro'|'done', cured, total, passed, cash, gold, combo, bestCombo,
//     firing, aim: { x, y } | null, timeSec, critters: [{ kind, x, y, zombie }] }
// Events (onEvent): bonusStart, cure { kind, gold, cash, combo, cured, total }, bonusEnd { cured, total, cash, gold,
//   bestCombo, durationSec, stopped }, sound { name, vol } with names bonusStart, stampede, sprayOn, sprayOff (the app
//   loops the spray between them), pop, gold, bonusEnd.
// Cash: $15 a cure, $150 the golden critter. Combo: cures in a row; it resets when a stray pellet lands and no cure
// happened in the last 0.5 s (so the tail of a burst that just cured does not break the chain); popups from ×3; no
// cash for it. Big effects only on success: pops and bursts on a cure, confetti + a small shake on the golden one.
// reducedMotion: fewer particles, no shake. Fixed 60 Hz sim step with an accumulator; simSpeed > 1 for tests;
// debugStep(n) runs n ticks.

import { TAU, clamp, lerp, mulberry32, hashStr, withAlpha, shade, easeOut } from './util.js';
import { makeRoad, drawRoadBand, drawNumberLine, roadPalette } from './road.js';
import * as R from './render.js';
import { KINDS, AIR, drawCritter, hitRadius } from './critters.js';

const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 4;
const MAX_PARTICLES = 220;
const SPARKS = ['#ffd23f', '#ff8a1f', '#ffffff', '#ffb347', '#ff5d2e'];
const CONFETTI = ['#ff3cac', '#ffd23f', '#4dd2ff', '#9dff2e', '#c77dff', '#ffffff'];

export const TUNING = {
  count: 30, goldAt: 0.6,
  introSec: 1.2, outroSec: 1.6, herdSec: 14, maxLive: 5, minLive: 2,
  pelletsPerSec: 12, pelletSpeed: 1300, spread: 0.06, pelletR: 5, assist: 1.25,   // assist: aim within assist × critter size snaps to the critter
  cash: { cure: 15, gold: 150 },
  comboGrace: 0.5, comboPopFrom: 3,
  speedGround: [150, 260], speedAir: [170, 290],
};
const T = TUNING;

function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }

export function createBonus(canvas, opts = {}) {
  const emitTo = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
  const reducedMotion = !!opts.reducedMotion;
  const simSpeed = Math.max(0.1, num(opts.simSpeed, 1));
  const ctx = canvas.getContext('2d');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  const view = { W: 1, H: 1, dpr: 1 };

  let run = null;
  let destroyed = false;
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  const perf = { frames: 0, sim: 0, draw: 0, max: 0, ticks: 0, maxTick: 0, maxDraw: 0 };

  function emit(evt) { try { emitTo(evt); } catch (e) { console.error('[bonus] onEvent handler threw', e); } }
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

  // everything that depends on the view size (critters keep their lane share and x share)
  function layout(r) {
    const W = view.W, H = view.H;
    r.road = makeRoad({ from: 0, to: 1 }, view);
    r.pal = roadPalette(r.look);
    r.scene = R.palette(r.look);
    r.bd = R.buildBackdrop(view, r.road, r.scene, r.seed, r.look);
    r.fl = R.fenceLayout(view, r.road);
    r.lw = clamp(Math.min(W, H) * 0.006, 1.6, 3);
    const kh = clamp(H * 0.21, 56, 84);
    r.kid = { x: W * (r.road.portrait ? 0.22 : 0.5), y: Math.min(H - 4, r.fl.bottom + kh * 1.15), h: kh };
    r.kid.hand = R.kidMuzzle(r.kid);
    r.scale = clamp(Math.min(W, 844) / 844, 0.55, 1);
    r.cs = clamp(Math.min(W, H) * 0.11, 30, 52);              // critter size (body length)
    // lanes: the graveyard lane behind the road, the grass between the road and the fence, the air
    r.lanes = {
      back: r.road.y - r.road.band - 4,
      front: r.fl.y0 - 3,
      airTop: Math.max(24, r.bd.horizon * 0.45),
      airBottom: r.road.y - r.road.band - r.cs * 1.2,
    };
    for (const c of r.critters) placeCritter(r, c);
    r.particles.n = 0;
  }
  function placeCritter(r, c) {
    const W = view.W;
    c.x = c.u * (W + c.s * 3) - c.s * 1.5;
    if (AIR[c.kind]) { c.baseY = lerp(r.lanes.airTop, r.lanes.airBottom, c.v); c.y = c.baseY; }
    else { c.baseY = c.lane === 'back' ? r.lanes.back : r.lanes.front; c.y = c.baseY; }
  }

  // ---------- start ----------
  function start(cfg = {}) {
    const seed = Number.isFinite(Number(cfg.seed)) ? Number(cfg.seed) >>> 0 : hashStr('stampede:' + String(cfg.street && cfg.street.id));
    const rand = mulberry32(seed);
    const look = { goo: '#8cff1a', fence: 'iron', pumpkins: 5, ...(cfg.look || {}) };
    if (typeof look.goo !== 'string') look.goo = '#8cff1a';
    const st = cfg.stampede || {};
    const count = clamp(Math.round(num(st.count, T.count)), 1, 120);
    const goldAt = clamp(num(st.goldAt, T.goldAt), 0, 1);
    const r = (run = {
      seed, rand, look, street: cfg.street || { id: 'maple', name: 'Maple Street' },
      phase: 'intro', t: 0, phaseT: 0, realT: 0,
      count, goldIndex: Math.min(count - 1, Math.floor(goldAt * count)), herdSec: T.herdSec * (count / T.count),
      spawned: 0, nextSpawnAt: 0, critters: [], pellets: [], splats: [],
      cured: 0, passed: 0, cash: 0, gold: false, goldOut: false, combo: 0, bestCombo: 0, lastCureAt: -1,
      aim: null, firing: false, pelletAcc: 0, sprayOn: false, kidArm: 0,
      popups: [], particles: R.makeParticles(MAX_PARTICLES), shake: 0, sx: 0, sy: 0, flash: 0, flashCol: '#ffffff',
      banner: null, ended: false, summary: null, pumpkins: Math.max(0, Math.round(num(look.pumpkins, 5))),
      road: null, pal: null, scene: null, bd: null, fl: null, lw: 2, kid: null, scale: 1, cs: 40, lanes: null,
    });
    acc = 0;
    last = performance.now();
    layout(r);
    banner(r, 'BONUS ROUND', '#ffd23f', 'CRITTER STAMPEDE!', T.introSec);
    emit({ type: 'bonusStart', total: count });
    sound('bonusStart');
  }
  function banner(r, text, color, sub, life) { r.banner = { text, color, sub, t: 0, life }; }

  // ---------- critters ----------
  function spawnCritter(r) {
    const i = r.spawned++;
    const rand = r.rand;
    const kind = KINDS[Math.floor(rand() * KINDS.length)];
    const air = !!AIR[kind];
    const dir = rand() < 0.5 ? 1 : -1;
    const [lo, hi] = air ? T.speedAir : T.speedGround;
    const c = {
      id: 'c' + i, kind, air, dir, lane: rand() < 0.5 ? 'back' : 'front',
      u: dir > 0 ? 0 : 1, v: rand(), x: 0, y: 0, baseY: 0,
      s: r.cs * (air ? 0.85 : 1) * (0.9 + rand() * 0.2),
      speed: lerp(lo, hi, rand()) * r.scale,
      ph: rand() * TAU, gait: 0.85 + rand() * 0.3, seed: Math.floor(rand() * 1e6),
      zombie: true, gold: i === r.goldIndex, cured: false, popT: 9, bob: 0, gone: false, t: 0,
    };
    if (c.gold) { c.s *= 1.15; c.speed *= 0.9; }
    placeCritter(r, c);
    r.critters.push(c);
    return c;
  }
  const liveCount = (r) => r.critters.length;
  function stepCritter(r, c, dt) {
    const W = view.W;
    c.t += dt;
    c.popT += dt;
    const v = c.speed * (c.cured ? 1.7 : 1);
    c.x += c.dir * v * dt;
    c.u = (c.x + c.s * 1.5) / (W + c.s * 3);
    c.ph += dt * (c.cured ? 11 : 7.5 * c.gait);
    if (c.air) {
      const amp = c.s * (c.cured ? 0.25 : 0.4);
      c.y = c.baseY + Math.sin(c.t * (c.cured ? 4.5 : 2.2) + c.seed) * amp + (c.zombie ? Math.max(0, Math.sin(c.t * 5.1)) * c.s * 0.12 : 0);
    } else if (c.cured) {
      c.y = c.baseY - Math.abs(Math.sin(c.ph * 0.5)) * c.s * 0.3;  // happy hops
    } else c.y = c.baseY;
    if (c.x < -c.s * 2 || c.x > W + c.s * 2) { c.gone = true; if (c.zombie) r.passed++; }
  }
  function cureCritter(r, c, px, py) {
    c.zombie = false; c.cured = true; c.popT = 0;
    const gold = c.gold;
    const cash = gold ? T.cash.gold : T.cash.cure;
    r.cured++;
    r.cash += cash;
    if (gold) r.gold = true;
    r.combo++;
    r.bestCombo = Math.max(r.bestCombo, r.combo);
    r.lastCureAt = r.t;
    // effects: pop + goo burst (+ confetti and a small shake on the golden one)
    const goo = r.look.goo, ps = r.particles, few = reducedMotion ? 0.5 : 1;
    const cx = c.x, cy = c.air ? c.y : c.y - c.s * 0.35;
    for (let i = 0; i < 14 * few; i++) { const a = r.rand() * TAU, s = 90 + r.rand() * 220; R.spawnParticle(ps, R.P_GOO, cx, cy, Math.cos(a) * s, Math.sin(a) * s - 60, 0.45 + r.rand() * 0.4, 2 + r.rand() * 3, i % 4 === 0 ? shade(goo, 0.3) : goo, 700, c.air ? 1e9 : c.baseY + 2); }
    for (let i = 0; i < 6 * few; i++) { const a = r.rand() * TAU, s = 120 + r.rand() * 200; R.spawnParticle(ps, R.P_STAR, cx, cy, Math.cos(a) * s, Math.sin(a) * s - 80, 0.5 + r.rand() * 0.3, 4, '#ffd23f', 500, 1e9); }
    R.spawnParticle(ps, R.P_RING, cx, cy, 0, 0, 0.35, c.s * 1.1, goo, 0);
    sound('pop', gold ? 1 : 0.8);
    popup(r, gold ? `+$${cash} GOLDEN!` : `+$${cash}`, cx, cy - c.s * 0.6, gold ? '#ffd23f' : '#9dff2e', gold ? 1.3 : 0.85, gold ? 1.5 : 0.9, 30, gold ? -0.06 : 0);
    if (gold) {
      sound('gold');
      for (let i = 0; i < 40 * few; i++) { const a = -Math.PI * (0.1 + r.rand() * 0.8), s = 160 + r.rand() * 320; R.spawnParticle(ps, R.P_CONFETTI, cx, cy, Math.cos(a) * s, Math.sin(a) * s, 1.1 + r.rand() * 0.8, 3 + r.rand() * 3, CONFETTI[i % CONFETTI.length], 420, view.H + 20); }
      for (let i = 0; i < 24 * few; i++) { const a = r.rand() * TAU, s = 200 + r.rand() * 300; R.spawnParticle(ps, R.P_SPARK, cx, cy, Math.cos(a) * s, Math.sin(a) * s, 0.4 + r.rand() * 0.5, 1.5 + r.rand() * 2, SPARKS[i % SPARKS.length], 600, 1e9); }
      if (!reducedMotion) r.shake = 0.8;
      r.flash = 0.3; r.flashCol = '#fff2b0';
    }
    if (r.combo >= T.comboPopFrom) popup(r, `×${r.combo}`, cx + c.s * 0.5, cy - c.s * 1.1, '#ff3cac', 1.05, 0.9, 24, -0.08);
    emit({ type: 'cure', kind: c.kind, gold, cash, combo: r.combo, cured: r.cured, total: r.count });
    void px; void py;
  }

  // ---------- the sprayer ----------
  // aim assist (a finger is not a crosshair): a zombie critter near the aim point is the target, at the spot it
  // will be when the pellet arrives
  function assistedAim(r) {
    const m = r.kid.hand, v = T.pelletSpeed * r.scale;
    let best = null, bestD = Infinity;
    for (const c of r.critters) {
      if (!c.zombie || c.gone) continue;
      const cx = c.x, cy = c.air ? c.y : c.y - c.s * 0.4;
      const d = Math.hypot(r.aim.x - cx, r.aim.y - cy);
      if (d <= c.s * T.assist && d < bestD) { bestD = d; best = c; }
    }
    if (!best) return r.aim;
    const cy = best.air ? best.y : best.y - best.s * 0.4;
    const flight = Math.hypot(best.x - m.x, cy - m.y) / v;
    return { x: best.x + best.dir * best.speed * flight, y: cy };
  }
  function spawnPellet(r) {
    if (!r.aim) return;
    const m = r.kid.hand;
    const aim = assistedAim(r);
    const dx = aim.x - m.x, dy = aim.y - m.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx) + (r.rand() - 0.5) * 2 * T.spread;
    const v = T.pelletSpeed * r.scale;
    r.pellets.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, dist: d, trav: 0, r: T.pelletR * (0.8 + r.rand() * 0.4), seed: (r.rand() * 1e9) >>> 0 });
    if (r.pellets.length > 60) r.pellets.shift();
    r.kidArm = 1;
  }
  function stepPellets(r, dt) {
    const W = view.W, H = view.H;
    for (let i = 0; i < r.pellets.length; i++) {
      const p = r.pellets[i];
      const step = Math.hypot(p.vx, p.vy) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.trav += step;
      // a zombie critter in the way? (ground critters: the body sits above the feet)
      let hit = null;
      for (const c of r.critters) {
        if (!c.zombie || c.gone) continue;
        const cx = c.x, cy = c.air ? c.y : c.y - c.s * 0.4;
        const rr = hitRadius(c.kind, c.s) + p.r;
        const ddx = p.x - cx, ddy = p.y - cy;
        if (ddx * ddx + ddy * ddy <= rr * rr) { hit = c; break; }
      }
      if (hit) { cureCritter(r, hit, p.x, p.y); r.pellets.splice(i, 1); i--; continue; }
      if (p.trav >= p.dist || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) {
        // a stray: a small splat that fades
        if (p.trav >= p.dist) {
          r.splats.push({ x: p.x, y: p.y, r: p.r * 1.6, t: 0, life: 1.2, seed: p.seed });
          if (r.splats.length > 40) r.splats.shift();
          if (r.combo > 0 && r.t - r.lastCureAt > T.comboGrace) r.combo = 0;
        }
        r.pellets.splice(i, 1); i--;
      }
    }
  }
  function popup(r, text, x, y, color, scale = 1, life = 1, rise = 26, tilt = 0) {
    r.popups.push({ text, x, y, t: 0, life, color, scale, rise, tilt });
    if (r.popups.length > 8) r.popups.shift();
  }

  // ---------- phases ----------
  function beginRun(r) {
    r.phase = 'run'; r.phaseT = 0;
    r.nextSpawnAt = r.t;
    sound('stampede');
  }
  function beginOutro(r) {
    r.phase = 'outro'; r.phaseT = 0;
    r.aim = null; setFiring(r, false);
    banner(r, 'STAMPEDE OVER', '#9dff2e', `${r.cured} cured · $${r.cash}`, T.outroSec);
  }
  function finish(r, stopped) {
    if (r.ended) return;
    r.ended = true;
    r.phase = 'done';
    setFiring(r, false);
    r.aim = null;
    r.summary = { cured: r.cured, total: r.count, cash: r.cash, gold: r.gold, bestCombo: r.bestCombo, durationSec: Math.round(r.t * 10) / 10, stopped: !!stopped, passed: r.passed };
    sound('bonusEnd');
    emit({ type: 'bonusEnd', ...r.summary });
  }
  function setFiring(r, on) {
    on = !!on && !!r.aim && r.phase === 'run';
    if (on === r.firing) return;
    r.firing = on;
    if (on) { r.pelletAcc = 1 / T.pelletsPerSec; sound('sprayOn'); } else sound('sprayOff');
  }

  // ---------- sim tick (1/60 s) ----------
  function tick() {
    const r = run;
    if (!r || r.phase === 'done') return;
    const dt = STEP;
    r.t += dt; r.phaseT += dt;
    if (r.phase === 'intro' && r.phaseT >= T.introSec) beginRun(r);
    if (r.phase === 'run') {
      // the herd: spaced over herdSec, 2–5 on screen (a slot opens when one leaves)
      const interval = r.herdSec / r.count;
      while (r.spawned < r.count && r.t >= r.nextSpawnAt && liveCount(r) < T.maxLive) {
        spawnCritter(r);
        r.nextSpawnAt = r.t + interval * (0.6 + r.rand() * 0.8);
      }
      if (r.spawned < r.count && liveCount(r) < T.minLive && r.nextSpawnAt > r.t + 0.15) r.nextSpawnAt = r.t + 0.15;
      // the sprayer
      if (r.firing && r.aim) {
        r.pelletAcc += dt;
        const per = 1 / T.pelletsPerSec;
        while (r.pelletAcc >= per) { r.pelletAcc -= per; spawnPellet(r); }
      }
      if (r.spawned >= r.count && liveCount(r) === 0 && !r.pellets.length) beginOutro(r);
    } else if (r.phase === 'outro' && r.phaseT >= T.outroSec) { finish(r, false); return; }
    for (let i = 0; i < r.critters.length; i++) { const c = r.critters[i]; stepCritter(r, c, dt); if (c.gone) { r.critters.splice(i, 1); i--; } }
    stepPellets(r, dt);
    for (let i = 0; i < r.splats.length; i++) { const sp = r.splats[i]; sp.t += dt; if (sp.t >= sp.life) { r.splats.splice(i, 1); i--; } }
    for (let i = 0; i < r.popups.length; i++) { const p = r.popups[i]; p.t += dt; if (p.t >= p.life) { r.popups.splice(i, 1); i--; } }
    if (r.banner) { r.banner.t += dt; if (r.banner.t >= r.banner.life) r.banner = null; }
    R.stepParticles(r.particles, dt);
    r.kidArm = Math.max(0, r.kidArm - dt * 9);
    r.shake = Math.max(0, r.shake - dt * 3.5);
    r.flash = Math.max(0, r.flash - dt * 2.4);
    if (r.shake > 0) { r.sx = (r.rand() - 0.5) * 9 * r.shake; r.sy = (r.rand() - 0.5) * 7 * r.shake; } else { r.sx = 0; r.sy = 0; }
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
    // air critters, then the back lane (far first), the road, the front lane, the fence, the kid
    const air = [], back = [], front = [];
    for (const c of r.critters) (c.air ? air : c.lane === 'back' ? back : front).push(c);
    air.sort((a, b) => a.y - b.y);
    for (const c of air) drawCritter(ctx, c, c.x, c.y, c.s, t, lw);
    for (const c of back) drawCritter(ctx, c, c.x, c.y, c.s, t, lw);
    R.drawLowFog(ctx, view, road, t, r.scene);
    drawRoadBand(ctx, road, r.pal, t, view.W);
    R.drawPuddleGlints(ctx, r.bd.puddles, t);
    drawNumberLine(ctx, road, r.pal, null, 0, lw);
    for (const sp of r.splats) drawStray(ctx, sp, r.look.goo, lw);
    for (const c of front) drawCritter(ctx, c, c.x, c.y, c.s, t, lw);
    R.drawFence(ctx, view, road, r.fl, r.scene, r.look.fence, r.pumpkins, lw, t, 0.4);
    R.drawKid(ctx, r.kid.x, r.kid.y, r.kid.h, lw, r.kidArm, t, r.look.kid || {}, r.look.goo, r.phase === 'outro');
    // the stream: pellets (+ a muzzle pulse while firing) and the aim mark
    drawPellets(r, lw);
    if (r.firing) { const m = r.kid.hand; const g = 0.6 + 0.4 * Math.sin(t * 40); ctx.fillStyle = withAlpha(r.look.goo, 0.55 * g); ctx.beginPath(); ctx.arc(m.x, m.y, 7 + 3 * g, 0, TAU); ctx.fill(); }
    if (r.aim && r.phase === 'run') drawAim(ctx, r.aim.x, r.aim.y, t, lw, r.firing);
    R.drawParticles(ctx, r.particles, lw);
    R.drawPopups(ctx, r.popups, clamp(Math.min(view.W, view.H) * 0.07, 18, 34), view.W);
    ctx.restore();
    drawTally(r);
    if (r.banner) R.drawBanner(ctx, r.banner.text, view, r.banner.t / r.banner.life, r.banner.color, r.banner.sub);
    if (r.flash > 0) R.drawFlash(ctx, view, r.flash * 0.6, r.flashCol);
    if (r.phase === 'done') { ctx.fillStyle = withAlpha('#0d0820', 0.25); ctx.fillRect(0, 0, view.W, view.H); }
  }
  function drawPellets(r, lw) {
    const goo = r.look.goo;
    ctx.lineWidth = lw; ctx.strokeStyle = R.OUT;
    for (const p of r.pellets) {
      // a short motion streak, then the blob
      ctx.strokeStyle = withAlpha(goo, 0.45); ctx.lineWidth = p.r * 1.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.fillStyle = goo; ctx.strokeStyle = R.OUT; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = withAlpha('#ffffff', 0.5); ctx.beginPath(); ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.3, 0, TAU); ctx.fill();
    }
  }
  function drawStray(ctx2, sp, goo, lw) {
    const k = sp.t / sp.life;
    ctx2.globalAlpha = k > 0.5 ? 1 - (k - 0.5) / 0.5 : 1;
    const rand = mulberry32(sp.seed);
    ctx2.fillStyle = goo; ctx2.strokeStyle = R.OUT; ctx2.lineWidth = lw;
    ctx2.beginPath(); ctx2.ellipse(sp.x, sp.y, sp.r * 1.4, sp.r * 0.7, 0, 0, TAU); ctx2.fill(); ctx2.stroke();
    for (let i = 0; i < 3; i++) { const a = rand() * TAU, d = sp.r * (1.3 + rand()); ctx2.beginPath(); ctx2.arc(sp.x + Math.cos(a) * d, sp.y + Math.sin(a) * d * 0.5, sp.r * 0.3, 0, TAU); ctx2.fill(); }
    ctx2.globalAlpha = 1;
  }
  function drawAim(ctx2, x, y, t, lw, firing) {
    const r = 13 + (firing ? Math.sin(t * 25) * 2 : 0);
    ctx2.strokeStyle = withAlpha('#5ff0ff', firing ? 0.95 : 0.7); ctx2.lineWidth = lw * 1.4; ctx2.lineCap = 'round';
    ctx2.beginPath(); ctx2.arc(x, y, r, 0, TAU); ctx2.stroke();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx2.beginPath(); ctx2.moveTo(x + dx * r * 0.55, y + dy * r * 0.55); ctx2.lineTo(x + dx * r * 1.35, y + dy * r * 1.35); ctx2.stroke(); }
  }
  // the tally: "CURED 12 / 30" at the top (no timer, no gauge)
  function drawTally(r) {
    if (r.phase === 'idle') return;
    const fz = clamp(Math.min(view.W, view.H) * 0.06, 14, 24);
    const x = view.W / 2, y = Math.max(18, fz * 0.9) + (r.road.portrait ? 52 : 0);
    const text = `CURED ${r.cured} / ${r.count}`;
    const w = R.textWidth(text, fz) + fz * 1.2, h = fz * 1.6;
    ctx.fillStyle = withAlpha(R.OUT, 0.6); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - h / 2, w, h, 6) : ctx.rect(x - w / 2, y - h / 2, w, h); ctx.fill();
    R.spriteText(ctx, text, fz, x, y, r.cured && r.phase !== 'intro' ? '#9dff2e' : '#ffffff', true);
    if (r.combo >= T.comboPopFrom && r.phase === 'run') R.spriteText(ctx, `×${r.combo}`, fz * 0.8, x + w / 2 + fz * 0.9, y, '#ff3cac', true, -0.08);
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
    if (r && r.phase !== 'done') {
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
    try { render(); } catch (e) { console.error('[bonus] render threw', e); }
    const tC = performance.now();
    perf.frames++; perf.sim += tB - tA; perf.draw += tC - tB;
    if (tC - tA > perf.max) perf.max = tC - tA;
    if (tC - tB > perf.maxDraw) perf.maxDraw = tC - tB;
  }
  raf = requestAnimationFrame(frame);

  // ---------- public API ----------
  function getState() {
    const r = run;
    if (!r) return { phase: 'idle', cured: 0, total: 0, passed: 0, cash: 0, gold: false, combo: 0, bestCombo: 0, firing: false, aim: null, timeSec: 0, critters: [] };
    return {
      phase: r.phase, cured: r.cured, total: r.count, passed: r.passed, cash: r.cash, gold: r.gold, combo: r.combo, bestCombo: r.bestCombo,
      firing: r.firing, aim: r.aim ? { x: r.aim.x, y: r.aim.y } : null, timeSec: Math.round(r.t * 100) / 100,
      critters: r.critters.map((c) => ({ kind: c.kind, x: Math.round(c.x), y: Math.round(c.air ? c.y : c.y - c.s * 0.4), zombie: c.zombie, gold: c.gold })),
    };
  }
  return {
    start,
    aim(x, y) {
      const r = run;
      if (!r || r.phase === 'done' || r.phase === 'outro') return;
      const X = Number(x), Y = Number(y);
      if (!Number.isFinite(X) || !Number.isFinite(Y)) return;
      r.aim = { x: clamp(X, 0, view.W), y: clamp(Y, 0, view.H) };
    },
    fire(on) { const r = run; if (!r) return; setFiring(r, on); },
    stop() { if (run && run.phase !== 'done') finish(run, true); },
    destroy() { destroyed = true; cancelAnimationFrame(raf); if (ro) ro.disconnect(); run = null; },
    getState,
    // --- not part of the contract: test / debug helpers ---
    debugStep(n = 1) { for (let i = 0; i < n && run; i++) { tick(); if (run) run.realT += STEP; } return getState(); },
    debugPerf(reset = false) { const out = { ...perf }; if (reset) { perf.frames = 0; perf.sim = 0; perf.draw = 0; perf.max = 0; perf.ticks = 0; perf.maxTick = 0; perf.maxDraw = 0; } return out; },
    debugInfo() {
      const r = run;
      if (!r) return null;
      return { t: r.t, phase: r.phase, spawned: r.spawned, count: r.count, goldIndex: r.goldIndex, critters: r.critters.map((c) => ({ id: c.id, kind: c.kind, x: c.x, y: c.y, s: c.s, zombie: c.zombie, gold: c.gold, air: c.air, lane: c.lane, dir: c.dir, speed: c.speed })), pellets: r.pellets.length, splats: r.splats.length, particles: r.particles.n, lanes: r.lanes, hand: r.kid.hand, view: { W: view.W, H: view.H }, summary: r.summary, perf: { ...perf } };
    },
  };
}

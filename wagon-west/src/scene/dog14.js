// Wagon West v1.4 dog vignettes (SPEC §1.1 and §4.1, scene stream): Frodo's nose on the trail. Vignettes of 2-6 s that
// play over the day: they do not own the pointer (the app's own buttons answer for them) and the view stays 'trail'.
//   dogRun(kind, { emoji })  the dog dashes off-screen (left or right, by the call count) and trots back with the emoji
//                            in a bubble over his head → { type: 'dogBack', kind } when he is back at the wagon
//   dogWarn()                the dog plants his feet and barks (twice), the wagon halts, a small cartoon snake (no
//                            fangs, no strike) sunning on the trail slides off into the grass → { type: 'dogWarnEnd' }
//   startChase({ seed })     the dog runs after a jackrabbit toward the horizon (4.5 s to a dot), the wagon rolling;
//   chaseCall()              the app's name button: he skids round and trots straight back. Never shown as a countdown.
//     events { type: 'chase', dist } at the call · { type: 'chaseEnd', called, dist } (dist 0..1 how far he had run; 1 =
//     he came back on his own, muddy at the app's say-so: the scene only draws the mud when setParty says muddy)
// Kid rules: a hiss-free, fang-free snake that slides away; a dog that comes home. Nothing is hurt, caught or lost.

import { TAU, OUT, clamp, lerp, ease, mulberry32 } from './util.js';
import { drawGameAnimal } from './sprites.js';
import { drawSnake, drawBubble } from './sprites14.js';
import { paint } from './biomes.js';

const home = (L, S) => ({ x: S.wagonX + 190 * L.k, y: L.gy + 30 * L.k });

function base(kind) {
  return { kind, view: 'keep', input: false, done: false, t: 0, halt: false, ph: 0 };
}

// ---------------------------------------------------------------- the nose: dash off, trot back with a find
export const RUN = { out: 1.5, gone: 0.6, back: 1.9, show: 1.1 };
export function createDogRun(what, o, emit, S, hooks, n) {
  const emoji = (o && typeof o.emoji === 'string' && o.emoji) || (what === 'berries' ? '🫐' : what === 'quest' ? '📿' : '🪶');
  const side = n % 2 === 0 ? 1 : -1; // seeded by the call count: right, left, right …
  const M = { ...base('dogRun'), what, emoji, side, sent: false, pos: { x: 0, y: 0, dir: 1, amp: 1, ph: 0 } };
  M.dogPose = (L) => {
    const h = home(L, S), k = L.k, off = side > 0 ? L.W + 110 * k : -110 * k;
    const t = M.t, p = M.pos;
    if (t < RUN.out) { const u = ease(t / RUN.out); p.x = lerp(h.x, off, u); p.y = h.y - Math.sin(Math.PI * u) * 10 * k; p.dir = side; p.amp = 1; }
    else if (t < RUN.out + RUN.gone) { p.x = off; p.y = h.y; p.dir = -side; p.amp = 1; }
    else if (t < RUN.out + RUN.gone + RUN.back) { const u = ease((t - RUN.out - RUN.gone) / RUN.back); p.x = lerp(off, h.x, u); p.y = h.y; p.dir = -side; p.amp = 1; }
    else { p.x = h.x; p.y = h.y; p.dir = 1; p.amp = S.walkAmp > 0.05 ? 1 : 0; }
    p.ph = M.ph; p.sc = 1;
    return p;
  };
  M.update = (L, dt) => {
    M.t += dt; M.ph += dt * 11;
    if (!M.sent && M.t >= RUN.out + RUN.gone + RUN.back) { M.sent = true; emit({ type: 'dogBack', kind: what }); }
    if (M.t >= RUN.out + RUN.gone + RUN.back + RUN.show) { M.done = true; }
  };
  M.drawOver = (c, L) => {
    const t0 = RUN.out + RUN.gone + 0.25;
    if (M.t < t0) return;
    const p = M.pos, k = L.k;
    if (p.x < -20 * k || p.x > L.W + 20 * k) return;
    const grow = ease(clamp((M.t - t0) / 0.35, 0, 1)), fade = M.t > RUN.out + RUN.gone + RUN.back + RUN.show - 0.25 ? clamp((RUN.out + RUN.gone + RUN.back + RUN.show - M.t) / 0.25, 0, 1) : 1;
    const bob = S.rm ? 0 : Math.sin(M.t * 9) * 2 * k;
    drawBubble(c, emoji, p.x + p.dir * 8 * k, p.y - 44 * k + bob, k * 1.15 * grow, fade);
  };
  M.state = () => ({ kind: 'dogRun', what, phase: M.t < RUN.out ? 'out' : M.t < RUN.out + RUN.gone ? 'gone' : M.t < RUN.out + RUN.gone + RUN.back ? 'back' : 'show', side });
  M.summary = () => ({ finished: M.sent });
  M.debug = () => ({ ...M.state(), t: M.t, pos: { ...M.pos }, emoji });
  return M;
}

// ---------------------------------------------------------------- the snake warning
export const WARN = { plant: 0.55, bark1: 0.7, bark2: 1.55, slide: 2.2, end: 4.0 };
export function createDogWarn(emit, S, hooks) {
  const M = { ...base('dogWarn'), barked: 0, sent: false, pos: { x: 0, y: 0, dir: 1, amp: 0, ph: 0 } };
  const geo = (L) => { const k = L.k, sx = Math.min(L.W - 74 * k, S.wagonX + 350 * k); return { sx, sy: L.gy + 22 * k, dx: sx - 104 * k, h: home(L, S) }; };
  M.dogPose = (L) => {
    const g = geo(L), p = M.pos, t = M.t;
    if (t < WARN.plant) { const u = ease(t / WARN.plant); p.x = lerp(g.h.x, g.dx, u); p.y = g.h.y; p.amp = 1; }
    else { p.x = g.dx; p.y = g.h.y; p.amp = 0; }
    p.dir = 1; p.ph = M.ph; p.sc = 1; p.snake = null;
    return p;
  };
  M.update = (L, dt) => {
    M.t += dt; M.ph += dt * 11;
    M.halt = M.t > 0.25 && M.t < WARN.end;               // the wagon halts while the dog plants his feet
    if (M.barked < 1 && M.t >= WARN.bark1) { M.barked = 1; hooks.bark(); }
    if (M.barked < 2 && M.t >= WARN.bark2) { M.barked = 2; hooks.bark(); }
    if (!M.sent && M.t >= WARN.end) { M.sent = true; M.done = true; emit({ type: 'dogWarnEnd' }); }
  };
  // the snake sits on the trail, then slides away into the grass: it shrinks, drifts up and right and the grass hides it
  function snakeAt(L) {
    const g = geo(L), k = L.k;
    const u = ease(clamp((M.t - WARN.slide) / (WARN.end - WARN.slide - 0.2), 0, 1));
    return { x: g.sx + u * 70 * k, y: g.sy - u * 26 * k, s: k * 1.45 * (1 - u * 0.45), u };
  }
  M.drawBehind = (c, L, t, rm) => {
    const s = snakeAt(L);
    if (s.u >= 1) return;
    c.save();
    c.beginPath(); c.rect(0, 0, L.W, s.y + 12 * L.k); c.clip();   // sinking into the grass: the lower edge is cut
    c.globalAlpha = 1 - s.u * 0.5;
    drawSnake(c, s.x, s.y, s.s, rm ? 0 : t, s.u > 0 ? 1 : 0);
    c.restore();
    c.globalAlpha = 1;
  };
  M.drawOver = (c, L) => {
    const s = snakeAt(L), k = L.k;
    if (s.u <= 0 || s.u >= 1) return;
    for (let i = 0; i < 4; i++) paint.grass(c, s.x - 36 * k + i * 16 * k, s.y + 12 * k, (16 + (i % 2) * 6) * k, '#4f7a3a', 2.6 * k);
  };
  M.state = () => ({ kind: 'dogWarn', phase: M.t < WARN.plant ? 'run' : M.t < WARN.slide ? 'bark' : 'slide', barks: M.barked });
  M.summary = () => ({ finished: M.sent });
  M.debug = (L) => ({ ...M.state(), t: M.t, snake: snakeAt(L), dog: { ...M.pos }, halted: M.halt });
  return M;
}

// ---------------------------------------------------------------- the rabbit chase
export const CHASE = { out: 4.5, skid: 0.3, backMin: 0.9, backMax: 2.4, linger: 0.5 };
export function createChase(o, emit, S, hooks) {
  const seed = (o && Number.isFinite(+o.seed) ? +o.seed : 1) >>> 0;
  const rand = mulberry32((seed ^ 0xc4a5e) || 1);
  const bias = (rand() - 0.5) * 0.04; // a slightly different line to the horizon each time
  const M = { ...base('chase'), phase: 'out', pt: 0, p: 0, from: 0, called: false, dist: 0, backT: 1, sent: false, pos: { x: 0, y: 0, dir: 1, amp: 1, ph: 0, sc: 1 } };
  const vp = (L) => ({ x: L.W * (0.9 + bias), y: L.H * (0.705 + bias * 0.5) });
  // a point along the way to the horizon: u 0 = the dog's place beside the wagon, 1 = the vanishing point
  const along = (L, u) => { const h = home(L, S), v = vp(L), e = 1 - Math.pow(1 - u, 1.25); return { x: lerp(h.x, v.x, e), y: lerp(h.y, v.y, e), sc: lerp(1, 0.13, e) }; };
  function place(L, u, dir) { const a = along(L, u), p = M.pos; p.x = a.x; p.y = a.y; p.sc = a.sc; p.dir = dir; p.amp = 1; p.ph = M.ph; return p; }
  M.dogPose = (L) => {
    if (M.phase === 'out') return place(L, M.p, 1);
    if (M.phase === 'skid') { const p = place(L, M.p, -1); p.amp = 0.4; return p; }
    if (M.phase === 'back') return place(L, M.p * (1 - ease(M.pt / M.backT)), -1);
    const h = home(L, S), p = M.pos; p.x = h.x; p.y = h.y; p.dir = 1; p.amp = S.walkAmp > 0.05 ? 1 : 0; p.sc = 1; p.ph = M.ph;
    return p;
  };
  // the dog turns back (called, or he reached the dot and gave up by himself)
  function turn(L, called) {
    M.called = called; M.dist = called ? M.p : 1; M.from = M.p;
    M.phase = called ? 'skid' : 'back'; M.pt = 0;
    M.backT = clamp(CHASE.backMin + (CHASE.backMax - CHASE.backMin) * M.p, CHASE.backMin, CHASE.backMax);
    if (called) { emit({ type: 'chase', dist: M.dist }); hooks.bark(); }
  }
  M.call = () => {
    if (M.phase !== 'out' || !S.L) return false;
    turn(S.L, true);
    return true;
  };
  M.update = (L, dt) => {
    M.t += dt; M.pt += dt; M.ph += dt * (M.phase === 'skid' ? 4 : 12);
    if (M.phase === 'out') {
      M.p = clamp(M.t / CHASE.out, 0, 1);
      if (M.p >= 1) turn(L, false);
    } else if (M.phase === 'skid') {
      if (M.pt >= CHASE.skid) { M.phase = 'back'; M.pt = 0; }
    } else if (M.phase === 'back') {
      if (M.pt >= M.backT) { M.phase = 'end'; M.pt = 0; }
    } else if (M.phase === 'end') {
      if (!M.sent) { M.sent = true; emit({ type: 'chaseEnd', called: M.called, dist: M.dist }); }
      if (M.pt >= CHASE.linger) M.done = true;
    }
  };
  M.drawBehind = (c, L, t, rm) => {
    // the jackrabbit zig-zags ahead of the dog toward the horizon, then is a dot, then gone
    if (M.phase === 'end') return;
    const ru = M.phase === 'out' ? Math.min(1, M.p + 0.16) : Math.min(1, M.from + 0.16 + (M.phase === 'back' ? ease(M.pt / M.backT) * 0.3 : 0));
    if (ru >= 1 && M.phase !== 'out') return;
    const a = along(L, ru), k = L.k, zig = rm ? 0 : Math.sin(t * 7) * 4 * k * a.sc;
    const al = M.phase === 'out' ? 1 : clamp(1 - (M.pt / Math.max(0.4, M.backT)) * 1.5, 0, 1);
    c.globalAlpha = al;
    drawGameAnimal(c, 'rabbit', a.x, a.y + zig, k * 0.95 * a.sc, 1, M.ph * 0.5 + 2, 0, t);
    c.globalAlpha = 1;
  };
  M.state = () => ({ kind: 'chase', phase: M.phase, dist: Math.round(M.p * 1000) / 1000, called: M.called });
  M.summary = () => ({ called: M.called, dist: M.called ? M.dist : M.p, finished: M.sent });
  M.debug = () => ({ ...M.state(), t: M.t, pos: { ...M.pos } });
  void TAU; void OUT;
  return M;
}

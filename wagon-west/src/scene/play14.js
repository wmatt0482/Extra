// Wagon West v1.4 play at the river, at night and on the trail (SPEC §1.4 and §4.2, scene stream): skipping stones, the
// falling stars and the dust devil's hats. Pure fun: the worst outcome is a stone that sinks, a star that fades or a hat
// in the sagebrush (the dog or the party gets it back). No timer or countdown is ever drawn.
//   startStones({ seed, throws: 3, bonus: 0 })  the river bank; tap to throw, then tap each time the stone kisses the water
//     (a target ring pulses where it will touch; the window is +-180 ms) to keep it skipping; a missed kiss: it sinks with a
//     plunk. The first startSkips (1) + bonus skips are free. At most 12 skips. → { type: 'skip', n } per skip ·
//     { type: 'stone', throw, skips } per throw · { type: 'stonesEnd', throws: [skips…], best }
//   startMeteors({ seed, n: 8 })                the camp at night: falling stars streak across (slow, long trails, a
//     generous hit box); a tap on one makes a wish → { type: 'meteor', n } (the running count) · { type: 'meteorsEnd',
//     tapped, of }
//   startDustDevil({ seed, hats: [{ id, hat, color }] })  on the trail: a dust column crosses and the hats fly up and tumble
//     down along seeded arcs (>= 1.4 s each in reach); a tap on one drops it back on its owner → { type: 'hat', id, caught:
//     true }; one that lands → { type: 'hat', id, caught: false } · { type: 'dustDevilEnd', caught, of }

import { TAU, OUT, mulberry32, clamp, lerp, ease, shade, mkCanvas, drawText, rrect } from './util.js';
import { BIOMES, biomeOf, paint } from './biomes.js';
import { drawStone, drawStar } from './sprites14.js';
import { drawHat } from './sprites.js';
import { drawSplash } from './sprites12.js';

// ================================================================= skipping stones
export const STONES = { window: 0.18, maxSkips: 12, startSkips: 1, first: 0.62, shrink: 0.93, minGap: 0.34, sink: 1.1, ready: 0.5, linger: 2 };
export function createStones(o, emit, S, hooks) {
  const seed = (o && Number.isFinite(+o.seed) ? +o.seed : 1) >>> 0;
  const throws = clamp(Math.round(o && o.throws != null ? +o.throws : 3) || 3, 1, 9);
  const bonus = clamp(Math.round(o && o.bonus != null ? +o.bonus : 0) || 0, 0, 6);
  const pal = BIOMES[biomeOf(S.biome)];
  const M = {
    kind: 'stones', view: 'fish', input: true, done: false, t: 0, n: 0, throws, res: [], phase: 'ready', pt: 0, skips: 0, free: 0, seg: null, tapped: false, dipT: 0,
    rings: [], splashes: [], texts: [], bg: null, bgKey: '', hint: true, hint2: true, best: 0, sent: false, sunk: null,
  };
  const rand = mulberry32((seed ^ 0x5710) >>> 0 || 1);
  const gapAt = (n) => Math.max(STONES.minGap, STONES.first * Math.pow(STONES.shrink, n - 1)); // seconds in the air before kiss n
  // where kiss n lands on the water: a run away from the thrower, shrinking toward the far bank
  const kissPos = (L, n) => {
    const x0 = L.W * 0.24, x1 = L.W * 0.93, r = 0.87, f = (1 - Math.pow(r, n)) / (1 - Math.pow(r, 13));
    return { x: lerp(x0, x1, f), y: lerp(L.H * 0.74, L.H * 0.585, f) + (rand() - 0.5) * 0 };
  };
  const hand = (L) => ({ x: L.W * 0.13, y: L.H * 0.74 });
  function startThrow(L) {
    M.n++; M.skips = 0; M.free = STONES.startSkips + (M.n === 1 ? bonus : 0);
    M.phase = 'air'; M.pt = 0; M.hint = false; M.tapped = false;
    M.seg = { n: 1, ts: M.t, from: hand(L), to: kissPos(L, 1), dur: gapAt(1) };
    hooks.sfx('whoosh');
  }
  function sink(L) {
    const p = M.seg.to;
    M.phase = 'sink'; M.pt = 0;
    M.splashes.push({ x: p.x, y: p.y, t: 0, r: 22 * L.k });
    M.texts.push({ text: 'PLUNK!', sub: M.skips ? M.skips + (M.skips === 1 ? ' SKIP' : ' SKIPS') : '', x: clamp(p.x, 90 * L.k, L.W - 90 * L.k), y: p.y - 56 * L.k, t: 0, col: '#ffffff' });
    hooks.sfx('plunk');
    M.res.push(M.skips); M.best = Math.max(M.best, M.skips);
    emit({ type: 'stone', throw: M.n, skips: M.skips });
  }
  function kiss(L, late) {
    const sg = M.seg, p = sg.to;
    M.skips++; M.rings.push({ x: p.x, y: p.y, t: 0 });
    hooks.sfx('skip');
    M.texts.push({ text: String(M.skips), x: p.x, y: p.y - 34 * L.k, t: 0, col: M.skips >= 7 ? '#ffd23f' : '#ffffff', small: true });
    emit({ type: 'skip', n: M.skips });
    M.tapped = false;
    if (M.skips >= STONES.maxSkips) { M.seg = { ...sg, n: sg.n }; sink(L); M.texts.push({ text: 'WHAT A THROW!', x: L.W * 0.5, y: L.H * 0.3, t: 0, col: '#ffd23f' }); return; }
    const nn = sg.n + 1;
    M.seg = { n: nn, ts: late ? M.t : sg.ts + sg.dur, from: p, to: kissPos(L, nn), dur: gapAt(nn) };
    M.phase = 'air';
  }
  // a tap: throws when ready; in the air it is a tap for the next kiss when inside its window
  M.pointer = (L) => {
    if (M.phase === 'ready' && M.pt >= STONES.ready * 0.3) { startThrow(L); return true; }
    if (M.phase === 'air' || M.phase === 'dip') {
      const left = M.seg.ts + M.seg.dur - M.t;                   // seconds to the kiss
      if (M.phase === 'dip') { kiss(L, true); return true; }
      if (left <= STONES.window && M.skips >= M.free) { M.tapped = true; M.hint2 = false; return true; } // early enough: it counts at the kiss
    }
    return false;
  };
  M.key = (L) => M.pointer(L);
  M.move = () => {};
  M.update = (L, dt) => {
    M.t += dt; M.pt += dt;
    for (const r of M.rings) r.t += dt; M.rings = M.rings.filter((r) => r.t < 0.8);
    for (const s of M.splashes) s.t += dt; M.splashes = M.splashes.filter((s) => s.t < 0.9);
    for (const tx of M.texts) tx.t += dt; M.texts = M.texts.filter((tx) => tx.t < 1.4);
    if (M.phase === 'air') {
      const sg = M.seg;
      if (M.t >= sg.ts + sg.dur) {
        if (M.skips < M.free || M.tapped) kiss(L, false);
        else { M.phase = 'dip'; M.dipT = 0; }                      // it touches: the window closes 180 ms later
      }
    } else if (M.phase === 'dip') {
      M.dipT += dt;
      if (M.dipT >= STONES.window) sink(L);
    } else if (M.phase === 'sink' && M.pt >= STONES.sink) {
      if (M.n >= throws) { M.phase = 'over'; M.pt = 0; }
      else { M.phase = 'ready'; M.pt = 0; }
    } else if (M.phase === 'over' && !M.sent) {
      M.sent = true;
      emit({ type: 'stonesEnd', throws: M.res.slice(), best: M.best });
    } else if (M.phase === 'over' && M.pt >= STONES.linger) M.done = true;
  };

  M.drawBackground = (c, L) => {
    const key = L.W + 'x' + L.H + '@' + L.dpr;
    if (!M.bg || M.bgKey !== key) {
      const { W, H, k, dpr } = L, y0 = H * 0.5;
      const cv = mkCanvas(W * dpr, (H - y0 + 2) * dpr), g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, -y0 * dpr);
      g.fillStyle = pal.water; g.fillRect(0, y0, W, H - y0);
      g.fillStyle = shade(pal.water, 0.1); g.fillRect(0, y0 + (H - y0) * 0.4, W, (H - y0) * 0.6);
      g.fillStyle = shade(pal.water, 0.18); g.fillRect(0, y0 + (H - y0) * 0.75, W, (H - y0) * 0.25);
      const r = mulberry32(17);
      g.beginPath(); for (let i = 0; i < 26; i++) { const x = r() * W, y = y0 + 10 * k + r() * (H - y0 - 20 * k); g.moveTo(x, y); g.lineTo(x + (10 + r() * 20) * k, y); }
      g.lineWidth = 2 * k; g.strokeStyle = shade(pal.water, 0.35); g.stroke();
      g.beginPath(); g.moveTo(0, y0 + 6 * k); for (let x = 0; x <= W; x += 10) g.lineTo(x, y0 + 4 * k + Math.sin(x * 0.03) * 3 * k); g.lineTo(W, y0 - 2); g.lineTo(0, y0 - 2); g.closePath();
      g.fillStyle = pal.near; g.fill(); g.lineWidth = 2; g.strokeStyle = shade(pal.near, -0.35); g.stroke();
      for (let i = 0; i < 12; i++) paint.grass(g, r() * W, y0 + 8 * k, (12 + r() * 10) * k, '#4f7a3a', 2.2 * k);
      g.beginPath(); g.moveTo(0, H + 2); g.lineTo(0, H * 0.8); g.quadraticCurveTo(W * 0.14, H * 0.77, W * 0.26, H + 2); g.closePath();
      g.fillStyle = pal.ground; g.fill(); g.lineWidth = 2.4; g.strokeStyle = shade(pal.ground, -0.4); g.stroke();
      for (let i = 0; i < 5; i++) { const x = W * (0.02 + i * 0.045), yy = H * 0.9 + (i % 2) * 14 * k; g.beginPath(); g.ellipse(x, yy, (8 + (i % 3) * 3) * k, (4 + (i % 2)) * k, 0, 0, TAU); g.fillStyle = '#9a9ca4'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke(); }
      M.bg = { cv, y0 }; M.bgKey = key;
    }
    c.drawImage(M.bg.cv, 0, M.bg.y0, L.W, L.H - M.bg.y0 + 2);
  };
  M.draw = (c, L, t, rm) => {
    const k = L.k, h = hand(L);
    for (const s of M.splashes) { c.globalAlpha = clamp(1 - s.t / 0.9, 0, 1); drawSplash(c, s.x, s.y, s.r, s.t / 0.9); }
    c.globalAlpha = 1;
    for (const r of M.rings) {
      c.globalAlpha = clamp(1 - r.t / 0.8, 0, 1) * 0.9;
      c.beginPath(); c.ellipse(r.x, r.y, (10 + r.t * 50) * k, (4 + r.t * 18) * k, 0, 0, TAU); c.lineWidth = 2.6 * k; c.strokeStyle = '#ffffff'; c.stroke();
    }
    c.globalAlpha = 1;
    // the next kiss: a ring on the water that flashes when the beat is here (no clock, just the water)
    if ((M.phase === 'air' || M.phase === 'dip') && M.seg) {
      const sg = M.seg, left = sg.ts + sg.dur - M.t, need = M.skips >= M.free;
      const open = need && left <= STONES.window + 0.02, p = sg.to;
      c.globalAlpha = need ? 0.9 : 0.35;
      c.beginPath(); c.ellipse(p.x, p.y, (open ? 22 : 15) * k, (open ? 8 : 5.5) * k, 0, 0, TAU);
      c.lineWidth = (open ? 4 : 2.4) * k; c.strokeStyle = open ? '#ffd23f' : '#ffffff'; c.stroke();
      if (open) { c.fillStyle = 'rgba(255,210,63,0.28)'; c.fill(); }
      c.globalAlpha = 1;
    }
    // the stone
    let sx = h.x + 14 * k, sy = h.y - 20 * k, ang = 0, hop = 0;
    if (M.phase === 'air' || M.phase === 'dip') {
      const sg = M.seg, u = clamp((M.t - sg.ts) / sg.dur, 0, 1);
      sx = lerp(sg.from.x, sg.to.x, u);
      const arcH = (sg.n === 1 ? 46 : 30 * Math.pow(0.9, sg.n)) * k;
      sy = lerp(sg.from.y, sg.to.y, u) - Math.sin(Math.PI * u) * arcH - (sg.n === 1 ? (1 - u) * 14 * k : 0);
      ang = (rm ? 0 : t * 18) * 0.04; hop = 1;
      const sc = lerp(1.9, 0.9, clamp((sg.to.x - L.W * 0.24) / (L.W * 0.7), 0, 1));
      c.beginPath(); c.ellipse(sx, lerp(sg.from.y, sg.to.y, u) + 2 * k, 9 * k * sc, 3 * k * sc, 0, 0, TAU); c.fillStyle = 'rgba(20,40,60,0.25)'; c.fill();
      drawStone(c, sx, sy, k * sc, ang);
    }
    // the thrower's hand and arm, bottom left
    c.beginPath(); c.moveTo(-10 * k, L.H); c.quadraticCurveTo(h.x - 30 * k, h.y + 40 * k, h.x, h.y); c.lineWidth = 16 * k; c.lineCap = 'round'; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 11 * k; c.strokeStyle = '#e8b98f'; c.stroke(); c.lineCap = 'butt';
    c.beginPath(); c.arc(h.x, h.y, 9 * k, 0, TAU); c.fillStyle = '#e8b98f'; c.fill(); c.lineWidth = 2 * k; c.strokeStyle = OUT; c.stroke();
    if (M.phase === 'ready') drawStone(c, h.x + 8 * k, h.y - 7 * k, k * 1.9, -0.2);
    // the throws left (stones) and the skips so far
    for (let i = 0; i < throws; i++) { c.globalAlpha = i < throws - M.n ? 1 : 0.28; drawStone(c, 30 * k + i * 34 * k, 24 * k, k * 1.4, -0.2); }
    c.globalAlpha = 1;
    if (M.phase !== 'ready' || M.n > 0) drawText(c, M.skips + (M.skips === 1 ? ' SKIP' : ' SKIPS'), 20 * k, L.W * 0.5, 36 * k, M.skips >= 7 ? '#ffd23f' : '#ffffff', OUT, L.W * 0.6);
    if (M.hint && M.phase === 'ready') { c.globalAlpha = rm ? 0.95 : 0.78 + 0.22 * Math.sin(t * 4); drawText(c, 'TAP TO THROW!', 20 * k, L.W * 0.5, 36 * k, '#ffffff', OUT, L.W * 0.9); c.globalAlpha = 1; }
    else if (M.hint2 && M.n === 1 && M.skips >= M.free && M.phase !== 'sink' && M.phase !== 'over') { c.globalAlpha = rm ? 0.95 : 0.78 + 0.22 * Math.sin(t * 5); drawText(c, 'TAP WHEN IT TOUCHES THE WATER!', 15 * k, L.W * 0.5, 64 * k, '#ffffff', OUT, L.W * 0.92); c.globalAlpha = 1; }
    for (const tx of M.texts) {
      c.globalAlpha = clamp(tx.t < 1.0 ? 1 : (1.4 - tx.t) / 0.4, 0, 1);
      drawText(c, tx.text, (tx.small ? 20 : 26) * k, tx.x, tx.y - (rm ? 0 : tx.t * 22 * k), tx.col, OUT, L.W * 0.9);
      if (tx.sub) drawText(c, tx.sub, 14 * k, tx.x, tx.y - (rm ? 0 : tx.t * 22 * k) + 24 * k, '#ffffff');
    }
    c.globalAlpha = 1;
  };
  M.state = () => ({ kind: 'stones', phase: M.phase, throw: M.n, throws, left: throws - M.n, skips: M.skips, best: M.best, free: M.free });
  M.summary = () => ({ throws: M.res.slice(), best: M.best, finished: M.sent });
  M.debug = () => ({ ...M.state(), nextKissIn: M.seg && (M.phase === 'air' || M.phase === 'dip') ? M.seg.ts + M.seg.dur - M.t : null, needTap: M.skips >= M.free, window: STONES.window, res: M.res.slice() });
  void rrect;
  return M;
}

// ================================================================= falling stars
export function createMeteors(o, emit, S, hooks) {
  const seed = (o && Number.isFinite(+o.seed) ? +o.seed : 1) >>> 0;
  const n = clamp(Math.round(o && o.n != null ? +o.n : 8) || 8, 1, 20);
  const rand = mulberry32((seed ^ 0x3e7e0) >>> 0 || 1);
  const M = { kind: 'meteors', view: 'keep', input: true, done: false, t: 0, n, stars: [], tapped: 0, gone: 0, sparks: [], texts: [], hint: true, ended: false, endT: 0, bgStars: null, ov: null, ovKey: '' };
  for (let i = 0; i < n; i++) {
    M.stars.push({ i, at: 0.9 + i * 2.15 + rand() * 0.5, life: 2.6 + rand() * 0.6, x0: 0.5 + rand() * 0.45, y0: 0.06 + rand() * 0.22, ang: 0.45 + rand() * 0.35, speed: 0.13 + rand() * 0.06, state: 'wait', len: 0.2 + rand() * 0.08, wt: 0 });
  }
  const fire = (L) => (S.piece && S.piece.anchors && S.piece.anchors.fireX) || L.W * 0.62;
  // a star's place: it drifts down and to the left along its angle
  const pos = (L, s) => { const u = clamp((M.t - s.at) / s.life, 0, 1.2) * s.life; return { x: (s.x0 - Math.cos(s.ang) * s.speed * u) * L.W, y: (s.y0 + Math.sin(s.ang) * s.speed * u * (L.W / L.H) * 0.55) * L.H }; };
  M.pointer = (L, x, y) => {
    let best = null, bd = Infinity;
    for (const s of M.stars) {
      if (s.state !== 'fly') continue;
      const p = pos(L, s), d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) { bd = d; best = s; best.p = p; }
    }
    M.hint = false;
    if (best && bd <= 64 * L.k + 14) {
      best.state = 'wish'; best.wt = 0; M.tapped++;
      for (let i = 0; i < (S.rm ? 8 : 18); i++) { const a = rand() * TAU, v = (40 + rand() * 120) * L.k; M.sparks.push({ x: best.p.x, y: best.p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30 * L.k, t: 0 }); }
      M.texts.push({ text: 'MAKE A WISH!', x: clamp(best.p.x, 100 * L.k, L.W - 100 * L.k), y: best.p.y + 50 * L.k, t: 0 });
      hooks.sfx('twinkle');
      emit({ type: 'meteor', n: M.tapped });
      return true;
    }
    return false;
  };
  M.key = () => false;
  M.move = () => {};
  M.update = (L, dt) => {
    M.t += dt;
    for (const s of M.stars) {
      if (s.state === 'wait' && M.t >= s.at) s.state = 'fly';
      else if (s.state === 'fly' && M.t >= s.at + s.life) { s.state = 'gone'; M.gone++; }
      else if (s.state === 'wish') { s.wt += dt; if (s.wt > 0.9) { s.state = 'done'; M.gone++; } }
    }
    for (const p of M.sparks) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * L.k * dt; }
    M.sparks = M.sparks.filter((p) => p.t < 0.9);
    for (const tx of M.texts) tx.t += dt; M.texts = M.texts.filter((tx) => tx.t < 1.4);
    if (!M.ended && M.gone >= n) { M.endT += dt; if (M.endT >= 0.8) { M.ended = true; M.endT = 0; emit({ type: 'meteorsEnd', tapped: M.tapped, of: n }); } }
    else if (M.ended) { M.endT += dt; if (M.endT >= 1.6) M.done = true; }
  };
  // the night: a deep sky with many stars and a thin moon (replaces the day's sky), a blue tint over the hills, and a
  // soft blue dark around the fire's circle of light over everything
  M.drawSky = (c, L, t, rm) => {
    const { W, H, k } = L;
    const g = c.createLinearGradient(0, 0, 0, H * 0.72);
    g.addColorStop(0, '#0b1538'); g.addColorStop(0.6, '#1d2f66'); g.addColorStop(1, '#4a4f86');
    c.fillStyle = g; c.fillRect(0, 0, W, H * 0.75);
    if (!M.bgStars || M.bgStars.W !== W) { const r = mulberry32(88); M.bgStars = { W, list: Array.from({ length: 110 }, () => ({ x: r(), y: r() * 0.62, s: 0.7 + r() * 1.8, p: r() * TAU })) }; }
    c.fillStyle = '#fff6d8';
    for (const s of M.bgStars.list) { c.globalAlpha = 0.5 + 0.5 * (rm ? 0.8 : Math.sin(t * 2 + s.p)); c.fillRect(s.x * W, s.y * H, s.s * k, s.s * k); }
    c.globalAlpha = 1;
    c.beginPath(); c.arc(W * 0.16, H * 0.2, 16 * k, 0, TAU); c.fillStyle = 'rgba(255,246,204,0.18)'; c.fill();
    c.beginPath(); c.arc(W * 0.16, H * 0.2, 11 * k, 0, TAU); c.fillStyle = '#fff4cc'; c.fill();
    c.beginPath(); c.arc(W * 0.16 + 5 * k, H * 0.2 - 3 * k, 10 * k, 0, TAU); c.fillStyle = '#16235a'; c.fill();
  };
  M.drawBehind = (c, L) => {
    if (!M.tint || M.tintH !== L.H) { const g = c.createLinearGradient(0, L.H * 0.28, 0, L.H * 0.48); g.addColorStop(0, 'rgba(13,26,74,0)'); g.addColorStop(1, 'rgba(13,26,74,0.55)'); M.tint = g; M.tintH = L.H; }
    c.fillStyle = M.tint; c.fillRect(0, L.H * 0.28, L.W, L.H * 0.72);
  };
  M.drawOver = (c, L, t, rm) => {
    const k = L.k, fx = fire(L), key = L.W + 'x' + L.H + '|' + Math.round(fx);
    if (!M.ov || M.ovKey !== key) {
      const gy = L.gy - 20 * k, g = c.createRadialGradient(fx, gy, 40 * k, fx, gy, Math.max(L.W, 380) * 0.6);
      g.addColorStop(0, 'rgba(10,16,60,0)'); g.addColorStop(1, 'rgba(10,16,60,0.3)'); M.ov = g; M.ovKey = key;
    }
    c.fillStyle = M.ov; c.fillRect(0, 0, L.W, L.H);
    // the falling stars (on top of everything: they are the game)
    for (const s of M.stars) {
      if (s.state === 'fly') {
        const p = pos(L, s), life = (M.t - s.at) / s.life, a = clamp(Math.min(life * 6, (1 - life) * 4, 1), 0, 1);
        drawStar(c, p.x, p.y, k * 1.35, Math.atan2(Math.sin(s.ang) * 0.55 * L.W / L.H, -Math.cos(s.ang)), s.len * L.W, a);
        void rm;
      } else if (s.state === 'wish') {
        const p = s.p || pos(L, s), u = s.wt / 0.9;
        drawStar(c, p.x, p.y - u * 30 * k, k * (1.35 + u * 0.8), -Math.PI / 2, 40 * k, 1 - u);
      }
    }
    c.fillStyle = '#fff2a8';
    for (const p of M.sparks) { c.globalAlpha = clamp(1 - p.t / 0.9, 0, 1); c.fillRect(p.x - 2 * k, p.y - 2 * k, 4 * k, 4 * k); }
    c.globalAlpha = 1;
    if (M.hint && M.t < 6) { c.globalAlpha = rm ? 0.95 : 0.78 + 0.22 * Math.sin(t * 4); drawText(c, 'TAP A FALLING STAR!', 18 * k, L.W * 0.5, 34 * k, '#ffffff', OUT, L.W * 0.9); c.globalAlpha = 1; }
    for (let i = 0; i < n; i++) { c.globalAlpha = i < M.tapped ? 1 : 0.3; drawStar(c, 24 * k + i * 22 * k, L.H - 24 * k, k * 0.9, Math.PI, 0, 1); }
    c.globalAlpha = 1;
    for (const tx of M.texts) { c.globalAlpha = clamp(tx.t < 1.0 ? 1 : (1.4 - tx.t) / 0.4, 0, 1); drawText(c, tx.text, 24 * k, tx.x, tx.y - (rm ? 0 : tx.t * 14 * k), '#ffe9b0', OUT, L.W * 0.9); }
    c.globalAlpha = 1;
  };
  M.state = () => ({ kind: 'meteors', phase: M.ended ? 'end' : 'play', tapped: M.tapped, of: n, left: n - M.gone });
  M.summary = () => ({ tapped: M.tapped, of: n, finished: M.ended });
  M.debug = (L) => ({ ...M.state(), stars: M.stars.filter((s) => s.state === 'fly').map((s) => ({ i: s.i, ...pos(L, s) })) });
  return M;
}

// ================================================================= the dust devil
export const DEVIL = { cross: 5.2, reach: 1.4 };
export function createDustDevil(o, emit, S, hooks) {
  const seed = (o && Number.isFinite(+o.seed) ? +o.seed : 1) >>> 0;
  const rand = mulberry32((seed ^ 0xd057) >>> 0 || 1);
  const list = (o && Array.isArray(o.hats) ? o.hats : []).filter((h) => h && h.hat && h.hat !== 'none').slice(0, 6);
  const M = {
    kind: 'dustDevil', view: 'keep', input: true, done: false, t: 0, of: list.length, caught: 0, landed: 0, hats: [], texts: [], sparks: [], ended: false, endT: 0, hint: true, started: false,
  };
  list.forEach((h, i) => {
    const owner = (S.party && S.party.ids || []).indexOf(String(h.id || ''));
    M.hats.push({
      id: h.id, hat: h.hat, color: h.color || '#7d5ba6', owner, i, state: 'head', at: 0, T: 2.0 + rand() * 0.7, ha: 0.2 + rand() * 0.18, dx: (rand() - 0.5) * 2, spin: (rand() < 0.5 ? -1 : 1) * (2.5 + rand() * 3),
      ph: rand() * 6, t0: 0, x0: 0, y0: 0, x: 0, y: 0, rot: 0, ret: 0, rx: 0, ry: 0,
    });
  });
  const colX = (L) => lerp(-0.12 * L.W, 1.12 * L.W, clamp(M.t / DEVIL.cross, 0, 1));
  const headOf = (L, h) => {
    const k = L.k;
    if (h.owner >= 0 && S.partyPos[h.owner]) { const p = S.partyPos[h.owner]; return { x: p.x, y: p.y - 66 * k * (p.s || 1) }; }
    return { x: S.wagonX + 36 * k, y: L.gy - 112 * k };   // the child's own hat sits on the wagon seat
  };
  // when the column reaches a hat's owner it flies up (seeded arc: ha = the apex height in screen heights, T = its airtime)
  function lift(L, h) {
    const p = headOf(L, h), k = L.k;
    h.state = 'air'; h.t0 = M.t; h.x0 = p.x; h.y0 = p.y; h.x = p.x; h.y = p.y; h.land = L.gy + (6 + rand() * 24) * k;
    hooks.sfx('whoosh');
  }
  const arc = (L, h, u) => {
    // an up-and-down arc with a sideways drift, ending on the ground (h.land); u = seconds since the lift
    const k = L.k, T = h.T, apex = h.ha * L.H, up = apex * 4 * (u / T) * (1 - u / T) * 1;
    const w = u / T;
    return { x: h.x0 + h.dx * 150 * k * w + Math.sin(u * 4 + h.ph) * 14 * k * (1 - w) + w * 40 * k, y: lerp(h.y0, h.land, w * w) - up * (1 - 0.15 * w) };
  };
  const hit = (L, x, y) => {
    let best = null, bd = Infinity;
    for (const h of M.hats) { if (h.state !== 'air') continue; const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } }
    return bd <= 60 * L.k + 14 ? best : null;
  };
  M.pointer = (L, x, y) => {
    M.hint = false;
    const h = hit(L, x, y);
    if (!h) return false;
    h.state = 'back'; h.ret = 0; h.rx = h.x; h.ry = h.y; M.caught++;
    for (let i = 0; i < (S.rm ? 6 : 14); i++) { const a = rand() * TAU, v = (30 + rand() * 90) * L.k; M.sparks.push({ x: h.x, y: h.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0 }); }
    M.texts.push({ text: 'GOT IT!', x: clamp(h.x, 80 * L.k, L.W - 80 * L.k), y: h.y - 40 * L.k, t: 0 });
    hooks.sfx('twinkle');
    emit({ type: 'hat', id: h.id, caught: true });
    return true;
  };
  M.key = () => false;
  M.move = () => {};
  M.hideHat = (i) => M.hats.some((h) => h.owner === i && h.state !== 'head' && h.state !== 'home');
  M.update = (L, dt) => {
    M.t += dt;
    if (!M.started) { M.started = true; hooks.sfx('whoosh'); }
    const cx = colX(L);
    for (const h of M.hats) {
      if (h.state === 'head') { const p = headOf(L, h); if (cx >= p.x - 10 * L.k && M.t > 0.4) lift(L, h); }
      else if (h.state === 'air') {
        const u = M.t - h.t0, p = arc(L, h, Math.min(u, h.T));
        h.x = p.x; h.y = p.y; h.rot = u * h.spin;
        if (u >= h.T) { h.state = 'landed'; h.rot = h.spin * 0.4; M.landed++; emit({ type: 'hat', id: h.id, caught: false }); }
      } else if (h.state === 'back') {
        h.ret += dt / 0.4; const e = ease(Math.min(1, h.ret)), t = headOf(L, h);
        h.x = lerp(h.rx, t.x, e); h.y = lerp(h.ry, t.y, e) - Math.sin(Math.PI * e) * 30 * L.k; h.rot = lerp(h.rot, 0, e);
        if (h.ret >= 1) h.state = 'home';
      }
    }
    for (const p of M.sparks) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; } M.sparks = M.sparks.filter((p) => p.t < 0.7);
    for (const tx of M.texts) tx.t += dt; M.texts = M.texts.filter((tx) => tx.t < 1.3);
    const open = M.hats.some((h) => h.state === 'head' || h.state === 'air' || h.state === 'back');
    if (!M.ended && !open && (M.of === 0 || M.t > 0.6)) { M.endT += dt; if (M.endT >= (M.of ? 0.5 : 0.1)) { M.ended = true; M.endT = 0; emit({ type: 'dustDevilEnd', caught: M.caught, of: M.of }); } }
    else if (M.ended) { M.endT += dt; if (M.endT >= 1.8) M.done = true; }
  };
  M.drawOver = (c, L, t, rm) => {
    const k = L.k, cx = colX(L), gy = L.gy + 6 * k, top = Math.max(L.H * 0.22, 60 * k);
    // the dust column: a stack of tan swirls, wider toward the top, swaying
    if (cx > -60 * k && cx < L.W + 60 * k) {
      c.fillStyle = '#d8c08a';
      for (let i = 0; i < 12; i++) {
        const u = i / 11, y = lerp(gy, top, u), sway = Math.sin(t * 5 + u * 6) * (rm ? 4 : 12) * k * u, w = (14 + u * 40) * k, a = 0.5 - u * 0.2;
        c.globalAlpha = a; c.beginPath(); c.ellipse(cx + sway, y, w, (7 + u * 5) * k, Math.sin(t * 4 + i) * 0.1, 0, TAU); c.fill();
        c.globalAlpha = a * 0.6; c.beginPath(); c.ellipse(cx + sway + Math.cos(t * 7 + i) * w * 0.5, y, w * 0.5, 4 * k, 0, 0, TAU); c.fillStyle = '#f2e0b4'; c.fill(); c.fillStyle = '#d8c08a';
      }
      c.globalAlpha = 1;
    }
    for (const h of M.hats) {
      if (h.state === 'head' || h.state === 'home') {
        if (h.owner < 0 && (h.state === 'home' || false)) { const p = headOf(L, h); drawHat(c, h.hat, p.x, p.y, k * 1.15, h.color, 0); }
        continue;
      }
      const s = k * 1.6 * (h.state === 'air' && !rm ? 1 + Math.sin(t * 9 + h.ph) * 0.04 : 1);
      if (h.state === 'landed') { c.beginPath(); c.ellipse(h.x, h.y + 4 * k, 20 * k, 5 * k, 0, 0, TAU); c.fillStyle = 'rgba(60,70,30,0.35)'; c.fill(); paint.sage(c, h.x - 26 * k, h.y + 8 * k, 14 * k, '#8aa070', OUT, 1.8 * k); }
      else if (h.state === 'air') { c.beginPath(); c.ellipse(h.x, lerpGround(L, h) + 4 * k, 16 * k * 0.8, 4 * k, 0, 0, TAU); c.fillStyle = 'rgba(40,25,10,0.18)'; c.fill(); }
      drawHat(c, h.hat, h.x, h.y, s, h.color, h.rot);
    }
    c.fillStyle = '#fff2a8';
    for (const p of M.sparks) { c.globalAlpha = clamp(1 - p.t / 0.7, 0, 1); c.fillRect(p.x - 2 * k, p.y - 2 * k, 4 * k, 4 * k); }
    c.globalAlpha = 1;
    if (M.hint && M.of && M.t < 8) { c.globalAlpha = rm ? 0.95 : 0.78 + 0.22 * Math.sin(t * 4); drawText(c, 'TAP THE HATS!', 20 * k, L.W * 0.5, 34 * k, '#ffffff', OUT, L.W * 0.9); c.globalAlpha = 1; }
    for (const tx of M.texts) { c.globalAlpha = clamp(tx.t < 1.0 ? 1 : (1.3 - tx.t) / 0.3, 0, 1); drawText(c, tx.text, 24 * k, tx.x, tx.y - (rm ? 0 : tx.t * 16 * k), '#ffd23f', OUT, L.W * 0.9); }
    c.globalAlpha = 1;
  };
  function lerpGround(L, h) { return h.land; }
  M.state = () => ({ kind: 'dustDevil', phase: M.ended ? 'end' : 'play', caught: M.caught, of: M.of, left: M.hats.filter((h) => h.state === 'head' || h.state === 'air').length });
  M.summary = () => ({ caught: M.caught, of: M.of, finished: M.ended });
  M.debug = (L) => ({ ...M.state(), column: colX(L), hats: M.hats.map((h) => ({ id: h.id, state: h.state, x: h.x, y: h.y, T: h.T, inReach: h.state === 'air' })) });
  void BIOMES; void shade;
  return M;
}

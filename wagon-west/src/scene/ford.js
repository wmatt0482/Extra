// Wagon West ford (SPEC v1.2 §3, scene stream): the wagon wades a river at the current biome, side-on. The current
// PULSES: a wave swell rolls through every 1.4 s (0.7 s of heaving water and foam, then 0.7 s of calm). The child taps
// (or presses Space) on the calm beat to push the team forward; 4 pushes cross a narrow river, 6 a wide one. A tap on a
// swell is a wobble and a splash (the push still moves the wagon: nothing gets stuck); two swell taps soak the sack of
// flour on the tailgate, never more. No clock and no countdown are drawn: the water itself is the cue (flat and green
// "PUSH!" on the calm, heaving and orange "WAIT!" on a swell).
//
// Taps are decided against the drawn swell: a tap is a swell tap when the swell's height is above 35 % of its peak
// (0.08 s into a swell until 0.62 s), so the calm beat is ~0.78 s of every 1.4 s. After a push the team rests 0.5 s
// (taps in that moment are ignored, so one calm beat is one push and mashing does not win).
//
// Events (via emit): { type: 'ford', good } per counted tap · { type: 'fordEnd', soaked, pushes, good } when the wagon
// climbs out on the far bank (soaked = 1 when two or more taps were on swells, else 0). The scene goes back to its
// backdrop 2 s later (or at once on endMiniGame()).

import { TAU, OUT, mulberry32, clamp, lerp, ease, shade, rgba, mkCanvas, drawText, rrect } from './util.js';
import { BIOMES, biomeOf, paint } from './biomes.js';
import { drawWagon, drawTeam, drawPerson } from './sprites.js';
import { drawSplash } from './sprites12.js';

export const FORD = {
  period: 1.4, // s from one swell to the next
  swell: 0.7, // s of swell in each period (the rest is the calm beat)
  lead: 0.9, // s of calm water before the first swell
  thresh: 0.35, // a tap while the swell is higher than this share of its peak is a swell tap
  rest: 0.5, // s the team rests after a push
  move: 0.55, // s a push takes
  linger: 2, // s after the far bank before the scene goes back
  narrow: 4, wide: 6, // pushes to cross
};

export function createFord(opts, emit, S, hooks, biomeId) {
  const o = opts || {};
  const seed = (Number.isFinite(+o.seed) ? +o.seed : 1) >>> 0;
  const width = o.width === 'wide' ? 'wide' : 'narrow';
  const need = FORD[width];
  const rand = mulberry32((seed ^ 0xf07d) || 1);
  const pal = BIOMES[biomeOf(biomeId)];
  const D = {
    kind: 'ford', width, need, pushes: 0, good: 0, bad: 0, log: [],
    clock: 0, off: rand() * 0.35, restT: 0, from: 0, to: 0, mv: 1, prog: 0,
    phase: 'cross', landT: 0, ended: false, done: false,
    wob: 0, wobT: 0, wet: 0, splashes: [], texts: [], hintT: 0,
    bg: null, bgKey: '', grad: null, gradKey: '', t: 0,
  };
  const swellAt = (c) => { const p = c - FORD.lead - D.off; if (p < 0) return 0; const q = p % FORD.period; return q < FORD.swell ? Math.sin((Math.PI * q) / FORD.swell) : 0; };
  const soaked = () => (D.bad >= 2 ? 1 : 0);

  // ---- geometry (css px) ----
  function geo(L) {
    const { W, k, gy } = L;
    const s = Math.min(0.58 * k, (0.27 * W) / 310);
    const c0 = 0.03 * W + 75 * s, c1 = 0.9 * W - 236 * s;
    const lFlat = c0 + 30 * s, rFlat = c1 - 75 * s - 0.02 * W; // starts at the water's edge: the team wades in first
    const sl = Math.max(0.07 * W, 24 * k);
    return { s, c0, c1, lFlat, rFlat, lWater: lFlat + sl, rWater: rFlat - sl, ys: gy + 10 * k, wet: gy + 22 * k };
  }
  const centerX = (g) => lerp(g.c0, g.c1, D.prog);
  function depthAt(g, xm) {
    const d = Math.min((xm - g.lFlat) / (g.lWater - g.lFlat), (g.rFlat - xm) / (g.rFlat - g.rWater));
    return ease(clamp(d, 0, 1));
  }
  // the ground the wheels stand on: the bank's top, down its slope (the same bezier the bank is painted with), the bed
  function terrain(L, g, x) {
    const { W, k, gy } = L;
    const mirror = x > W * 0.5, xx = mirror ? W - x : x, fl = mirror ? W - g.rFlat : g.lFlat, wt = mirror ? W - g.rWater : g.lWater;
    if (xx <= fl) return gy;
    if (xx >= wt) return gy + 20 * k;
    let lo = 0, hi = 1;
    const c1 = fl + (wt - fl) * 0.55, c2 = wt - (wt - fl) * 0.15;
    for (let n = 0; n < 9; n++) {
      const t = (lo + hi) / 2, u = 1 - t, bx = u * u * u * fl + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * wt;
      if (bx < xx) lo = t; else hi = t;
    }
    const t = (lo + hi) / 2, u = 1 - t;
    return u * u * u * gy + 3 * u * u * t * gy + 3 * u * t * t * (gy + 8 * k) + t * t * t * (gy + 20 * k);
  }
  const feetY = (L, g) => terrain(L, g, centerX(g));
  const teamY = (L, g) => terrain(L, g, centerX(g) + 150 * g.s);

  function text(L, s, sub, x, y, col = '#ffffff') { D.texts.push({ text: s, sub, x: clamp(x, 90 * L.k, L.W - 90 * L.k), y, col, t: 0 }); }

  // ---- input ----
  function tap(L) {
    if (D.ended || D.phase !== 'cross' || D.pushes >= need) return false;
    if (D.restT > 0) return false;
    const good = swellAt(D.clock) <= FORD.thresh;
    D.pushes++;
    if (good) D.good++; else D.bad++;
    D.log.push(good);
    D.from = D.prog; D.to = D.pushes / need; D.mv = 0; D.restT = FORD.rest;
    const g = geo(L), wx = centerX(g), fy = feetY(L, g);
    if (good) {
      if (terrain(L, g, wx + 70 * g.s) > L.gy + 10 * L.k) D.splashes.push({ x: wx + 70 * g.s, y: g.ys + 6 * L.k, t: 0, r: 20 * L.k, soft: true }); // a ripple, only where there is water
    } else {
      D.wob = 1; D.wobT = 0;
      const sx = clamp(wx + 130 * g.s, g.lWater + 14 * L.k, g.rWater - 14 * L.k); // always on the water, even at the bank
      D.splashes.push({ x: sx, y: g.ys + 2 * L.k, t: 0, r: 34 * L.k, soft: false }, { x: clamp(sx - 50 * g.s, g.lWater, g.rWater), y: g.ys + 4 * L.k, t: -0.1, r: 26 * L.k, soft: false });
      text(L, 'SPLASH!', '', wx + 60 * g.s, fy - 150 * g.s);
      if (D.bad === 2) { D.wet = 1; text(L, 'SOGGY SACK!', '', wx - 20 * g.s, fy - 190 * g.s, '#bfe3ff'); }
    }
    emit({ type: 'ford', good });
    return true;
  }
  D.pointer = (L) => tap(L);
  D.key = (L) => tap(L);
  D.move = () => {};

  // ---- update ----
  D.update = (L, dt) => {
    D.t += dt; D.clock += dt; D.restT = Math.max(0, D.restT - dt);
    D.hintT = Math.max(0, D.hintT - dt);
    if (D.mv < 1) D.mv = Math.min(1, D.mv + dt / FORD.move);
    D.prog = lerp(D.from, D.to, ease(D.mv));
    if (D.wob > 0) { D.wobT += dt; D.wob = Math.max(0, 1 - D.wobT / 0.9); }
    for (const sp of D.splashes) sp.t += dt;
    D.splashes = D.splashes.filter((sp) => sp.t < 0.85);
    for (const tx of D.texts) tx.t += dt;
    D.texts = D.texts.filter((tx) => tx.t < 1.6);
    if (D.phase === 'cross' && D.pushes >= need && D.mv >= 1) {
      D.phase = 'landed'; D.landT = 0; D.ended = true;
      const g = geo(L);
      emit({ type: 'fordEnd', soaked: soaked(), pushes: D.pushes, good: D.good });
      if (hooks && hooks.celebrate) hooks.celebrate('star', centerX(g) + 80 * g.s, feetY(L, g) - 90 * g.s);
      text(L, 'MADE IT!', '', L.W * 0.5, L.H * 0.3, '#ffd23f');
    } else if (D.phase === 'landed') {
      D.landT += dt;
      if (D.landT >= FORD.linger) D.done = true;
    }
  };

  // ---- the banks: painted once per size (a cutaway of the river: grass, dirt, pebbles) ----
  function paintBank(c, L, flat, waterX, mirror) {
    const { W, H, k, gy } = L;
    c.save();
    if (mirror) { c.translate(W, 0); c.scale(-1, 1); }
    const bx = flat, wx = waterX;
    c.beginPath();
    c.moveTo(-4, H + 4); c.lineTo(-4, gy); c.lineTo(bx, gy);
    c.bezierCurveTo(bx + (wx - bx) * 0.55, gy, wx - (wx - bx) * 0.15, gy + 8 * k, wx, gy + 20 * k);
    c.bezierCurveTo(wx + 0.02 * W, gy + 40 * k, wx + 0.035 * W, H * 0.9, wx + 0.04 * W, H + 4);
    c.closePath();
    const dirt = shade(pal.ground, -0.38);
    c.fillStyle = dirt; c.fill();
    // strata and pebbles in the dirt
    c.save(); c.clip();
    const r = mulberry32(mirror ? 17 : 29);
    c.beginPath();
    for (let i = 0; i < 4; i++) { const yy = gy + (H - gy) * (0.18 + i * 0.2); c.moveTo(-4, yy); for (let x = 0; x <= wx + 0.05 * W; x += 20) c.lineTo(x, yy + Math.sin(x * 0.05 + i) * 3 * k); }
    c.lineWidth = 2 * k; c.strokeStyle = shade(dirt, -0.18); c.stroke();
    for (let i = 0; i < 9; i++) paint.rock(c, r() * (wx + 0.02 * W), gy + (H - gy) * (0.1 + r() * 0.85), (5 + r() * 6) * k, shade(dirt, 0.18), shade(dirt, -0.4), 1.4 * k);
    c.restore();
    // the grassy lip
    c.beginPath(); c.moveTo(-4, gy); c.lineTo(bx, gy);
    c.bezierCurveTo(bx + (wx - bx) * 0.55, gy, wx - (wx - bx) * 0.15, gy + 8 * k, wx, gy + 20 * k);
    c.lineCap = 'round'; c.lineWidth = 9 * k; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 6 * k; c.strokeStyle = pal.near; c.stroke(); c.lineCap = 'butt';
    for (let i = 0; i < 9; i++) paint.grass(c, 6 * k + r() * (bx + (wx - bx) * 0.5), gy + 1 * k, (10 + r() * 9) * k, '#4f7a3a', 2 * k);
    if (mirror) { // the far bank: trees behind and reeds at the edge
      for (let i = 0; i < 3; i++) paint.blobTree(c, 8 * k + i * 22 * k, gy - 4 * k, (60 + (i % 2) * 20) * k, '#6a4a2a', shade(pal.near, i % 2 ? -0.1 : 0.05), OUT, 2 * k);
      for (let i = 0; i < 5; i++) { const x = bx + (wx - bx) * (0.3 + i * 0.16), h = (26 + (i % 3) * 8) * k; c.beginPath(); c.moveTo(x, gy + 14 * k); c.quadraticCurveTo(x + 2 * k, gy + 14 * k - h * 0.5, x + (i - 2) * 2 * k, gy + 14 * k - h); c.lineWidth = 2.4 * k; c.strokeStyle = '#4f7a3a'; c.stroke(); }
    } else {
      for (let i = 0; i < 4; i++) { const x = bx + (wx - bx) * (0.35 + i * 0.15), h = (22 + (i % 3) * 8) * k; c.beginPath(); c.moveTo(x, gy + 14 * k); c.quadraticCurveTo(x + 2 * k, gy + 14 * k - h * 0.5, x + (i - 2) * 2 * k, gy + 14 * k - h); c.lineWidth = 2.4 * k; c.strokeStyle = '#4f7a3a'; c.stroke(); }
      paint.rock(c, bx * 0.45, gy, 14 * k, '#9a9aa0', OUT, 2 * k);
    }
    c.restore();
  }
  function banks(L) {
    const key = L.W + 'x' + L.H + '@' + L.dpr;
    if (D.bg && D.bgKey === key) return D.bg;
    const { W, H, dpr, k, gy } = L, g = geo(L);
    const yb = Math.max(0, gy - 100 * k);
    const cv = mkCanvas(W * dpr, (H - yb + 2) * dpr), c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, -yb * dpr);
    paintBank(c, L, g.lFlat, g.lWater, false);
    paintBank(c, L, W - g.rFlat, W - g.rWater, true);
    D.bg = { cv, yb }; D.bgKey = key;
    return D.bg;
  }
  function gradients(c, L) {
    const key = L.W + 'x' + L.H;
    if (D.grad && D.gradKey === key) return D.grad;
    const g = geo(L), W = L.W;
    const v = c.createLinearGradient(0, g.ys - 12 * L.k, 0, L.H);
    v.addColorStop(0, shade(pal.water, 0.12)); v.addColorStop(0.35, pal.water); v.addColorStop(1, shade(pal.water, -0.32));
    const hz = c.createLinearGradient(g.lWater - 10 * L.k, 0, g.rWater + 10 * L.k, 0);
    hz.addColorStop(0, rgba(pal.water, 0)); hz.addColorStop(0.16, rgba(pal.water, 0.5)); hz.addColorStop(0.84, rgba(pal.water, 0.5)); hz.addColorStop(1, rgba(pal.water, 0));
    const sh = c.createLinearGradient(0, H0(L), 0, g.ys + 22 * L.k);
    sh.addColorStop(0, rgba(pal.mid, 0)); sh.addColorStop(0.22, pal.mid); sh.addColorStop(0.6, pal.near); sh.addColorStop(1, shade(pal.near, -0.3));
    D.grad = { v, hz, shore: sh }; D.gradKey = key;
    void W;
    return D.grad;
  }

  const H0 = (L) => L.H * 0.68;
  const surf = (L, x, t, i, rm) => {
    const g = geo(L), k = L.k, a = rm ? 0.55 : 1;
    return g.ys - a * ((1.1 * k + i * 11 * k) * (0.55 * Math.sin(x * 0.02 + t * 2.1) + 0.45 * Math.sin(x * 0.033 - t * 3.3 + 1)) + i * 7 * k * Math.sin(x * 0.0075 - t * 4.2));
  };
  function waterPath(c, L, x0, x1, t, i, rm, closeTo) {
    const step = Math.max(8, L.W / 70);
    c.beginPath(); c.moveTo(x0, surf(L, x0, t, i, rm));
    for (let x = x0 + step; x < x1; x += step) c.lineTo(x, surf(L, x, t, i, rm));
    c.lineTo(x1, surf(L, x1, t, i, rm));
    if (closeTo != null) { c.lineTo(x1, closeTo); c.lineTo(x0, closeTo); c.closePath(); }
  }

  // drawn under the wagon: the water behind it, then the banks over its edges and the party on the far bank
  D.drawBackground = (c, L, t, rm) => {
    const { W, H, k } = L, g = geo(L), i = swellAt(D.clock), gr = gradients(c, L);
    // the far shore between the hills and the water: grass, with the waterline's dark edge
    const top = H * 0.68;
    c.fillStyle = gr.shore; c.fillRect(0, top, W, g.ys - top + 22 * k);
    waterPath(c, L, -4, W + 4, t, i, rm, H + 4);
    c.fillStyle = gr.v; c.fill();
    // streaks of current, quicker in a swell
    c.beginPath();
    const sp = (30 + i * 140) * k;
    for (let n = 0; n < 12; n++) {
      const y = g.ys + 14 * k + ((n * 53) % 100) / 100 * (H - g.ys - 22 * k), x = (((n * 211) - t * sp * (0.6 + (n % 4) * 0.3)) % (W + 80) + W + 80) % (W + 80) - 40;
      c.moveTo(x, y); c.lineTo(x + (16 + (n % 3) * 8) * k, y);
    }
    c.lineWidth = 2 * k; c.strokeStyle = 'rgba(255,255,255,0.35)'; c.stroke();
    const bg = banks(L);
    c.drawImage(bg.cv, 0, bg.yb, W, H - bg.yb + 2);
    // the party waits on the far bank
    const P = S.party;
    if (P && P.looks) {
      const cheer = S.cheerT > 0 ? 1.8 - S.cheerT : 0;
      for (let n = 0; n < 3 && n < P.looks.length; n++) drawPerson(c, W * (0.93 + n * 0.022), L.gy + 2 * k, k * 0.5, P.looks[n], 0, 0, cheer > 0 ? cheer + n * 0.12 : 0, -1);
    }
  };

  function drawSack(c, wet, t) {
    // a flour sack on the tailgate (wagon units, origin at the wagon's ground point)
    c.save(); c.translate(-70, -34);
    c.beginPath(); c.moveTo(-9, 12); c.bezierCurveTo(-13, 0, -9, -12, -3, -13); c.lineTo(3, -13); c.bezierCurveTo(9, -12, 13, 0, 9, 12); c.closePath();
    c.fillStyle = wet ? '#a9a48e' : '#f0e4c2'; c.fill(); c.lineWidth = 2.4; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.moveTo(-4, -13); c.lineTo(0, -19); c.lineTo(4, -13); c.fillStyle = wet ? '#8e8a76' : '#e0d2a8'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-6, -3); c.lineTo(6, -3); c.lineWidth = 1.6; c.strokeStyle = wet ? '#6f6b5a' : '#c9b98a'; c.stroke();
    if (wet) {
      const ph = (t * 1.6) % 1;
      c.beginPath(); c.arc(-4, 14 + ph * 14, 2.4, 0, TAU); c.arc(5, 14 + ((ph + 0.5) % 1) * 14, 2, 0, TAU); c.fillStyle = '#5aa6d8'; c.fill();
    }
    c.restore();
  }

  D.draw = (c, L, t, rm) => {
    const { W, H, k } = L, g = geo(L), i = swellAt(D.clock), s = g.s;
    const wx = centerX(g), fy = feetY(L, g);
    // the train (wobbles on a swell tap)
    const walking = D.mv < 1 ? 0.45 : 0;
    const wob = D.wob > 0 && !rm ? Math.sin(D.wobT * 22) * 0.07 * D.wob : D.wob > 0 ? Math.sin(D.wobT * 10) * 0.025 * D.wob : 0;
    c.save();
    if (wob) { c.translate(wx + 40 * s, fy); c.rotate(wob); c.translate(-(wx + 40 * s), -fy); }
    const bob = rm ? 0 : Math.sin(t * 3 + i * 2) * (1 + 2 * i) * 0.5 * (depthAt(g, wx + 80 * s) + 0.1);
    const ph = D.prog * need * 5;
    drawTeam(c, wx + 96 * s, teamY(L, g), s, S.party ? S.party.animal : 'oxen', ph, walking, false);
    const wag = S.party ? S.party.wagon : { box: '#a0612b', wheel: '#7a4a26', cover: '#f6efdc', flag: null, name: '' };
    drawWagon(c, wx, fy, s, wag, D.prog * need * 4, bob, t);
    c.save(); c.translate(wx, fy); c.scale(s, s); drawSack(c, D.wet > 0, t); c.restore();
    c.restore();
    // the water in front, over the wheels
    const gr = gradients(c, L);
    c.beginPath();
    const x0 = g.lWater - 10 * k, x1 = g.rWater + 10 * k, step = Math.max(8, W / 70);
    c.moveTo(x0, surf(L, x0, t, i, rm) + 2 * k);
    for (let x = x0 + step; x < x1; x += step) c.lineTo(x, surf(L, x, t, i, rm) + 2 * k);
    c.lineTo(x1, surf(L, x1, t, i, rm) + 2 * k); c.lineTo(x1, g.ys + 34 * k); c.lineTo(x0, g.ys + 34 * k); c.closePath();
    c.fillStyle = gr.hz; c.fill();
    // foam on the crest: bright in a swell
    waterPath(c, L, x0, x1, t, i, rm, null);
    c.lineWidth = (2 + i * 3) * k; c.strokeStyle = `rgba(255,255,255,${0.35 + 0.55 * i})`; c.stroke();
    if (i > 0.2) {
      c.beginPath();
      for (let n = 0; n < 10; n++) { const x = x0 + ((n * 97 + t * 90) % (x1 - x0)); c.moveTo(x + 7 * k, surf(L, x, t, i, rm) - 2 * k); c.arc(x, surf(L, x, t, i, rm) - 2 * k, 7 * k * i, 0, TAU); }
      c.globalAlpha = 0.8 * i; c.fillStyle = '#ffffff'; c.fill(); c.globalAlpha = 1;
    }
    // splashes
    for (const sp of D.splashes) {
      if (sp.t < 0) continue;
      const kk = sp.t / 0.85;
      c.globalAlpha = clamp(1 - kk, 0, 1);
      if (sp.soft) { c.beginPath(); c.ellipse(sp.x, sp.y, sp.r * (0.5 + kk * 1.4), sp.r * (0.18 + kk * 0.35), 0, 0, TAU); c.lineWidth = 2.4 * k; c.strokeStyle = '#ffffff'; c.stroke(); }
      else drawSplash(c, sp.x, sp.y, sp.r, kk);
    }
    c.globalAlpha = 1;
    // the HUD: the pushes (wheel icons, gold when good, blue when a swell tap)
    for (let n = 0; n < need; n++) {
      const x = 24 * k + n * 24 * k, y = 24 * k, done = n < D.pushes;
      c.beginPath(); c.arc(x, y, 9 * k, 0, TAU); c.fillStyle = done ? (D.log[n] ? '#ffd23f' : '#8ac4f0') : 'rgba(255,246,230,0.25)'; c.fill();
      c.lineWidth = 2 * k; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); for (let a = 0; a < 3; a++) { const an = (a * TAU) / 6; c.moveTo(x - Math.cos(an) * 7 * k, y - Math.sin(an) * 7 * k); c.lineTo(x + Math.cos(an) * 7 * k, y + Math.sin(an) * 7 * k); }
      c.lineWidth = 1.2 * k; c.strokeStyle = 'rgba(43,29,20,0.7)'; c.stroke();
    }
    if (D.phase === 'cross') {
      if (D.pushes < 3) {
        c.globalAlpha = rm ? 0.95 : 0.78 + 0.22 * Math.sin(t * 4);
        drawText(c, 'TAP ON THE CALM!', 18 * k, W * 0.5, (W < 560 ? 56 : 30) * k, '#ffffff');
        c.globalAlpha = 1;
      }
      // the cue over the wagon: green PUSH! on the calm beat, orange WAIT! on a swell, nothing while the team rests
      if (D.restT <= 0) {
        const calm = i <= FORD.thresh, bx = wx + 40 * s, by = fy - 190 * s - 14 * k;
        const pulse = rm ? 1 : 1 + (calm ? 0.07 * Math.sin(t * 9) : 0.04 * Math.sin(t * 14));
        c.save(); c.translate(bx, by); c.scale(pulse, pulse);
        c.beginPath(); rrect(c, -46 * k, -16 * k, 92 * k, 32 * k, 14 * k);
        c.fillStyle = calm ? '#3ddc84' : '#ff9a3a'; c.fill(); c.lineWidth = 3 * k; c.strokeStyle = OUT; c.stroke();
        c.beginPath(); c.moveTo(-8 * k, 16 * k); c.lineTo(0, 27 * k); c.lineTo(8 * k, 16 * k); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(-9 * k, 15 * k); c.lineTo(9 * k, 15 * k); c.lineWidth = 4 * k; c.strokeStyle = calm ? '#3ddc84' : '#ff9a3a'; c.stroke();
        drawText(c, calm ? 'PUSH!' : 'WAIT!', 17 * k, 0, 0, '#ffffff', OUT, 80 * k);
        c.restore();
      }
    }
    for (const tx of D.texts) {
      const a = clamp(tx.t < 1.2 ? 1 : (1.6 - tx.t) / 0.4, 0, 1), rise = rm ? 0 : tx.t * 16 * k;
      c.globalAlpha = a;
      drawText(c, tx.text, 22 * k, tx.x, tx.y - rise, tx.col);
      if (tx.sub) drawText(c, tx.sub, 14 * k, tx.x, tx.y - rise + 22 * k, '#ffffff');
    }
    c.globalAlpha = 1;
    void H;
  };

  const r3 = (v) => Math.round(clamp(v, 0, 1) * 1000) / 1000;
  const phaseNow = () => (D.phase === 'landed' ? 'landed' : swellAt(D.clock) > FORD.thresh ? 'swell' : 'calm');
  D.state = () => ({
    kind: 'ford', width, left: need - D.pushes, need, pushes: D.pushes, good: D.good, hits: D.good, bad: D.bad, soaked: soaked(),
    phase: phaseNow(), progress: r3(D.prog),
  });
  D.summary = () => ({ ...D.state(), finished: D.phase === 'landed' });
  D.debug = () => {
    const i = swellAt(D.clock), p = D.clock - FORD.lead - D.off;
    const q = p < 0 ? p : p % FORD.period;
    return { ...D.state(), clock: D.clock, intensity: i, calm: i <= FORD.thresh, ready: D.restT <= 0 && D.phase === 'cross', rest: D.restT, sinceSwell: q, off: D.off, wob: D.wob, wet: D.wet };
  };
  return D;
}

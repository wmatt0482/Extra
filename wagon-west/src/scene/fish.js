// Wagon West fishing (SPEC §1, §11 startFish): a timing tap at a still pool. Each cast: the bobber flies out and
// floats; after a seeded wait (sometimes a little nibble first, to teach the difference) it DIPS under with a splash
// and a "!": a tap (or Space) inside that window hooks a fish (2-6 lb, seeded per cast), which jumps out onto the bank
// with "Got one!". A tap too early only gets "Wait for the dip!" (never a penalty); a missed window is "It got away!"
// and the cast is used. The pool and banks are painted once into an off-screen canvas per size.
//
// Events (via emit): { type: 'fish', size: 'small' | 'medium' | 'big', lb } per fish caught (when it lands);
// { type: 'fishEnd', fishLb, caught, casts } after the last cast.

import { TAU, OUT, mulberry32, clamp, ease, shade, mkCanvas, drawText } from './util.js';
import { BIOMES, biomeOf, paint } from './biomes.js';
import { drawFish } from './sprites.js';

const T_CAST = 0.75, T_BITE = 1.15, T_REEL = 1.0, T_AWAY = 1.0, T_END = 1.0;
const FISH_COLS = ['#6a9c5a', '#7a8fb0', '#b08a4a', '#5a8a8a'];

export function sizeFor(lb) { return lb <= 3 ? 'small' : lb === 4 ? 'medium' : 'big'; }

export function createFish(opts, emit, biomeId) {
  const seed = (opts && Number.isFinite(+opts.seed) ? +opts.seed : 1) >>> 0;
  const casts = clamp(Math.round(opts && opts.casts != null ? +opts.casts : 4) || 4, 1, 20);
  const rand = mulberry32((seed ^ 0x5f1a) || 1);
  const pal = BIOMES[biomeOf(biomeId)];
  const F = {
    kind: 'fish', casts, left: casts, hits: 0, fishLb: 0, cast: 0,
    phase: 'cast', pt: 0, waitT: 0, nibbleAt: -1, cur: null, texts: [], rings: [], fly: null,
    hintCool: 0, ended: false, done: false, t: 0, bg: null, bgKey: '',
  };
  function newCast() {
    F.cast++;
    const lb = 2 + Math.floor(rand() * 5);
    F.cur = { u: 0.5 + rand() * 0.28, v: 0.66 + rand() * 0.14, lb, size: sizeFor(lb), col: FISH_COLS[Math.floor(rand() * FISH_COLS.length)] };
    F.waitT = 1.3 + rand() * 2.2;
    F.nibbleAt = rand() < 0.6 ? F.waitT * (0.3 + rand() * 0.35) : -1;
    F.phase = 'cast'; F.pt = 0;
  }
  newCast();
  const tip = (L) => ({ x: L.W * 0.27, y: L.H * 0.36 });
  const bobPos = (L) => ({ x: F.cur.u * L.W, y: F.cur.v * L.H });
  const basket = (L) => ({ x: L.W * 0.19, y: L.H - 20 * L.k });

  function text(L, s, sub, x, y, col = '#ffd23f') { F.texts.push({ text: s, sub, x: clamp(x, 100 * L.k, L.W - 100 * L.k), y, col, t: 0 }); }
  function nextOrEnd() {
    F.left--;
    if (F.left <= 0) { F.phase = 'end'; F.pt = 0; } else newCast();
  }
  function tap(L) {
    if (F.ended) return false;
    if (F.phase === 'bite') {
      F.phase = 'reel'; F.pt = 0;
      const b = bobPos(L);
      F.fly = { sx: b.x, sy: b.y, ...basket(L) };
      F.rings.push({ x: b.x, y: b.y, t: 0 }, { x: b.x, y: b.y, t: -0.12 });
      return true;
    }
    if ((F.phase === 'wait' || F.phase === 'cast') && F.hintCool <= 0) {
      const b = bobPos(L);
      text(L, 'WAIT FOR THE DIP!', '', b.x, b.y - 60 * L.k, '#ffffff');
      F.hintCool = 1.2;
    }
    return false;
  }
  F.pointer = (L) => tap(L);
  F.key = (L) => tap(L);
  F.move = () => {};

  F.update = (L, dt) => {
    F.t += dt; F.pt += dt; F.hintCool -= dt;
    const b = bobPos(L);
    if (F.phase === 'cast' && F.pt >= T_CAST) { F.phase = 'wait'; F.pt = 0; F.rings.push({ x: b.x, y: b.y, t: 0 }); }
    else if (F.phase === 'wait') {
      if (F.nibbleAt > 0 && F.pt >= F.nibbleAt && !F.nibbled) { F.nibbled = true; F.rings.push({ x: b.x, y: b.y, t: 0 }); }
      if (F.pt >= F.waitT) { F.phase = 'bite'; F.pt = 0; F.nibbled = false; F.rings.push({ x: b.x, y: b.y, t: 0 }, { x: b.x, y: b.y, t: -0.15 }); }
    } else if (F.phase === 'bite' && F.pt >= T_BITE) {
      F.phase = 'away'; F.pt = 0;
      text(L, 'IT GOT AWAY!', 'NEXT CAST', b.x, b.y - 70 * L.k, '#ffffff');
    } else if (F.phase === 'reel' && F.pt >= T_REEL) {
      F.hits++; F.fishLb += F.cur.lb;
      const bk = basket(L);
      text(L, 'GOT ONE!', F.cur.lb + ' LB ' + F.cur.size.toUpperCase(), bk.x + 90 * L.k, bk.y - 80 * L.k);
      emit({ type: 'fish', size: F.cur.size, lb: F.cur.lb });
      F.fly = null;
      nextOrEnd();
    } else if (F.phase === 'away' && F.pt >= T_AWAY) nextOrEnd();
    else if (F.phase === 'end' && F.pt >= T_END && !F.ended) {
      F.ended = true; F.done = true;
      emit({ type: 'fishEnd', fishLb: F.fishLb, caught: F.hits, casts: F.casts });
    }
    for (const r of F.rings) r.t += dt;
    F.rings = F.rings.filter((r) => r.t < 1);
    for (const tx of F.texts) tx.t += dt;
    F.texts = F.texts.filter((tx) => tx.t < 1.6);
  };

  // the pool: far bank, water, reeds, the near bank where the child stands (painted once per size)
  function background(L) {
    const key = L.W + 'x' + L.H + '@' + L.dpr;
    if (F.bg && F.bgKey === key) return F.bg;
    const { W, H, k, dpr } = L;
    const y0 = H * 0.52;
    const cv = mkCanvas(W * dpr, (H - y0 + 2) * dpr), c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, -y0 * dpr);
    c.fillStyle = pal.water; c.fillRect(0, y0, W, H - y0);
    c.fillStyle = shade(pal.water, 0.1); c.fillRect(0, y0 + (H - y0) * 0.35, W, (H - y0) * 0.65);
    c.fillStyle = shade(pal.water, 0.18); c.fillRect(0, y0 + (H - y0) * 0.7, W, (H - y0) * 0.3);
    const r = mulberry32(99);
    c.beginPath(); for (let i = 0; i < 26; i++) { const x = r() * W, y = y0 + 10 * k + r() * (H - y0 - 20 * k); c.moveTo(x, y); c.lineTo(x + (10 + r() * 20) * k, y); }
    c.lineWidth = 2 * k; c.strokeStyle = shade(pal.water, 0.35); c.stroke();
    // far bank
    c.beginPath(); c.moveTo(0, y0 + 6 * k); for (let x = 0; x <= W; x += 10) c.lineTo(x, y0 + 4 * k + Math.sin(x * 0.03) * 3 * k); c.lineTo(W, y0 - 2); c.lineTo(0, y0 - 2); c.closePath();
    c.fillStyle = pal.near; c.fill(); c.lineWidth = 2; c.strokeStyle = shade(pal.near, -0.35); c.stroke();
    for (let i = 0; i < 12; i++) paint.grass(c, r() * W, y0 + 8 * k, (12 + r() * 10) * k, '#4f7a3a', 2.2 * k);
    // the near bank (bottom left) and cattails
    c.beginPath(); c.moveTo(0, H + 2); c.lineTo(0, H * 0.8); c.quadraticCurveTo(W * 0.2, H * 0.78, W * 0.34, H + 2); c.closePath();
    c.fillStyle = pal.ground; c.fill(); c.lineWidth = 2.4; c.strokeStyle = shade(pal.ground, -0.4); c.stroke();
    for (let i = 0; i < 6; i++) {
      const x = W * (0.3 + i * 0.012) + (i % 2) * 6 * k, y = H - 4 * k, h = (46 + (i % 3) * 12) * k;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 3 * k, y - h * 0.5, x + (i - 2) * 2 * k, y - h); c.lineWidth = 2.4 * k; c.strokeStyle = '#4f7a3a'; c.stroke();
      if (i % 2 === 0) { c.beginPath(); c.ellipse(x + (i - 2) * 2 * k, y - h + 6 * k, 3.2 * k, 8 * k, 0, 0, TAU); c.fillStyle = '#7a4a26'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke(); }
    }
    for (let i = 0; i < 4; i++) paint.grass(c, W * (0.04 + i * 0.07), H, 24 * k, shade(pal.near, 0.05), 3 * k);
    F.bg = { cv, y0 }; F.bgKey = key;
    return F.bg;
  }

  F.drawBackground = (c, L) => {
    const bg = background(L);
    c.drawImage(bg.cv, 0, bg.y0, L.W, L.H - bg.y0 + 2);
  };

  F.draw = (c, L, t, rm) => {
    const k = L.k, tp = tip(L), b = bobPos(L);
    // ripples
    for (const r of F.rings) {
      if (r.t < 0) continue;
      c.globalAlpha = clamp(1 - r.t, 0, 1) * 0.8;
      c.beginPath(); c.ellipse(r.x, r.y + 2 * k, (8 + r.t * 46) * k, (3 + r.t * 14) * k, 0, 0, TAU);
      c.lineWidth = 2 * k; c.strokeStyle = '#ffffff'; c.stroke();
    }
    c.globalAlpha = 1;
    // the bobber's place this frame
    let bx = b.x, by = b.y, under = 0;
    if (F.phase === 'cast') {
      const p = ease(F.pt / T_CAST);
      bx = tp.x + (b.x - tp.x) * p; by = tp.y + (b.y - tp.y) * p - Math.sin(Math.PI * p) * 70 * k;
    } else if (F.phase === 'wait') {
      by += Math.sin(t * 3) * (rm ? 0.6 : 1.6) * k;
      if (F.nibbled && F.pt - F.nibbleAt < 0.3) by += 3 * k;
    } else if (F.phase === 'bite') {
      under = Math.min(1, F.pt / 0.12); by += under * 7 * k + Math.sin(t * 30) * (rm ? 0.5 : 1.5) * k;
    } else if (F.phase === 'away') by += Math.max(0, 1 - F.pt * 3) * 6 * k;
    const showBob = F.phase !== 'reel' && F.phase !== 'end';
    // the rod (bottom left) and the line
    const bend = F.phase === 'reel' ? Math.max(0, 1 - F.pt * 1.5) * 22 * k : F.phase === 'bite' ? 6 * k : 0;
    const hx = L.W * 0.06, hy = L.H + 6 * k;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo((hx + tp.x) / 2 + bend * 0.6, (hy + tp.y) / 2 - bend * 0.2, tp.x, tp.y + bend);
    c.lineWidth = 8 * k; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 4.6 * k; c.strokeStyle = '#a0612b'; c.stroke();
    c.beginPath(); c.arc(hx + (tp.x - hx) * 0.18, hy + (tp.y - hy) * 0.18, 7 * k, 0, TAU); c.fillStyle = '#8f9aa6'; c.fill(); c.lineWidth = 1.6 * k; c.strokeStyle = OUT; c.stroke();
    let ex = bx, ey = by;
    if (F.fly) { const p = ease(F.pt / T_REEL); ex = F.fly.sx + (F.fly.x - F.fly.sx) * p; ey = F.fly.sy + (F.fly.y - F.fly.sy) * p - Math.sin(Math.PI * p) * 110 * k; }
    if (showBob || F.fly) {
      c.beginPath(); c.moveTo(tp.x, tp.y + bend); c.quadraticCurveTo((tp.x + ex) / 2, Math.max(tp.y, ey) + (F.phase === 'wait' ? 26 * k : 6 * k), ex, ey - 6 * k);
      c.lineWidth = 1.2 * k; c.strokeStyle = 'rgba(255,255,255,0.85)'; c.stroke();
    }
    c.lineCap = 'butt';
    if (showBob) {
      // the bobber: red cap, white base; under water its lower half is hidden by a water-coloured lip
      c.beginPath(); c.arc(bx, by - 6 * k, 7 * k, Math.PI, 0); c.closePath(); c.fillStyle = '#e04a3a'; c.fill();
      c.beginPath(); c.arc(bx, by - 6 * k, 7 * k, 0, Math.PI); c.closePath(); c.fillStyle = '#ffffff'; c.fill();
      c.beginPath(); c.arc(bx, by - 6 * k, 7 * k, 0, TAU); c.lineWidth = 1.8 * k; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.moveTo(bx, by - 13 * k); c.lineTo(bx, by - 18 * k); c.lineWidth = 2 * k; c.stroke();
      if (under > 0 || F.phase === 'wait' || F.phase === 'away') {
        c.beginPath(); c.ellipse(bx, by, 11 * k, 3.2 * k, 0, 0, TAU); c.fillStyle = shade(pal.water, 0.12); c.fill();
      }
      if (F.phase === 'bite') {
        const pop = rm ? 1 : 1 + 0.15 * Math.sin(t * 16);
        drawText(c, '!', 30 * k * pop, bx, by - 42 * k, '#ffd23f');
      }
    }
    if (F.fly) {
      const p = clamp(F.pt / T_REEL, 0, 1);
      drawFish(c, ex, ey, k * (0.9 + F.cur.lb * 0.08), -0.6 + p * 1.6, t * 22, F.cur.col);
    }
    // the creel at the bank with the catch count
    const bk = basket(L);
    c.beginPath(); c.moveTo(bk.x - 22 * k, bk.y - 20 * k); c.lineTo(bk.x + 22 * k, bk.y - 20 * k); c.lineTo(bk.x + 18 * k, bk.y + 10 * k); c.lineTo(bk.x - 18 * k, bk.y + 10 * k); c.closePath();
    c.fillStyle = '#c8a060'; c.fill(); c.lineWidth = 2 * k; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); for (let i = 1; i < 3; i++) { c.moveTo(bk.x - 21 * k, bk.y - 20 * k + i * 10 * k); c.lineTo(bk.x + 21 * k, bk.y - 20 * k + i * 10 * k); }
    c.lineWidth = 1.4 * k; c.strokeStyle = '#8a6030'; c.stroke();
    if (F.hits > 0) drawText(c, String(F.hits), 16 * k, bk.x, bk.y - 6 * k, '#ffffff');
    // casts left (bobber icons) and the pounds so far
    for (let i = 0; i < F.casts; i++) {
      const x = 22 * k + i * 22 * k, y = 22 * k;
      c.globalAlpha = i < F.left ? 1 : 0.28;
      c.beginPath(); c.arc(x, y, 7 * k, Math.PI, 0); c.closePath(); c.fillStyle = '#e04a3a'; c.fill();
      c.beginPath(); c.arc(x, y, 7 * k, 0, Math.PI); c.closePath(); c.fillStyle = '#ffffff'; c.fill();
      c.beginPath(); c.arc(x, y, 7 * k, 0, TAU); c.lineWidth = 1.6 * k; c.strokeStyle = OUT; c.stroke();
    }
    c.globalAlpha = 1;
    if (F.fishLb > 0) drawText(c, F.fishLb + ' LB', 14 * k, 22 * k + F.casts * 22 * k + 26 * k, 22 * k, '#ffffff');
    if (F.cast === 1 && (F.phase === 'cast' || F.phase === 'wait')) {
      c.globalAlpha = rm ? 0.95 : 0.75 + 0.25 * Math.sin(t * 4);
      drawText(c, 'TAP WHEN IT DIPS!', 18 * k, L.W * 0.5, 30 * k, '#ffffff');
      c.globalAlpha = 1;
    }
    for (const tx of F.texts) {
      const a = clamp(tx.t < 1.2 ? 1 : (1.6 - tx.t) / 0.4, 0, 1), rise = rm ? 0 : tx.t * 16 * k;
      c.globalAlpha = a;
      drawText(c, tx.text, 22 * k, tx.x, tx.y - rise, tx.col);
      if (tx.sub) drawText(c, tx.sub, 14 * k, tx.x, tx.y - rise + 22 * k, '#ffffff');
    }
    c.globalAlpha = 1;
  };

  F.state = () => ({ kind: 'fish', left: F.left, hits: F.hits, fishLb: F.fishLb, phase: F.phase });
  F.summary = () => ({ fishLb: F.fishLb, caught: F.hits, casts: F.casts - F.left });
  F.debug = (L) => ({ ...F.state(), cast: F.cast, bobber: bobPos(L), waitT: F.waitT, pt: F.pt, lb: F.cur.lb });
  return F;
}

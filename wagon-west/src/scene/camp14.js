// Wagon West v1.4 camp games (SPEC §1.2 and §4.2, scene stream): fetch and the grasshoppers. Pure fun: nothing here asks a
// question, runs a clock or can be failed.
//   startFetch({ seed, throws: 3 })   the camp at dusk (the app sets the camp backdrop): the child drags back from the
//     stick like a slingshot (the farther back, the farther the throw; a dotted ghost arc shows where it will land) and
//     lets go; or holds Space to wind up and lets go. → { type: 'fetchThrow', n, dist } (0..1 of the field) when the stick
//     lands; the dog waits for the app's scene.fetchBring({ item: 'stick' | 'find', emoji }) → true, then races out and
//     back (<= 2.5 s) → { type: 'fetchBack', n }; after the last return the dog flops down by the fire →
//     { type: 'fetchEnd', throws, best }.
//   startHoppers({ seed, n: 6 })      grasshoppers hop through the meadow a few at a time; a tap catches one (they hop
//     off the far edge when not caught; no timer is drawn) → { type: 'hopper', caught } (the running total) per catch,
//     { type: 'hoppersEnd', caught } when the last one has been caught or has gone.

import { TAU, OUT, mulberry32, clamp, lerp, ease, shade, mkCanvas, drawText, rrect } from './util.js';
import { BIOMES, biomeOf, paint } from './biomes.js';
import { drawStick, drawHopper, drawBubble } from './sprites14.js';

// ================================================================= fetch
export const FETCH = { flight: 0.85, out: 1.0, grab: 0.2, back: 1.1, flop: 1.6, minPull: 0.14, windUp: 1.2 };
export function createFetch(o, emit, S, hooks) {
  const throws = clamp(Math.round(o && o.throws != null ? +o.throws : 3) || 3, 1, 9);
  const M = {
    kind: 'fetch', view: 'keep', input: true, done: false, t: 0, n: 0, throws, best: 0, phase: 'ready', pt: 0, ptr: null, aim: 0, wind: false, windT: 0,
    dist: 0, item: 'stick', emoji: '', ph: 0, sent: false, hint: true, texts: [], res: [], landX: 0, dogFrom: 0,
  };
  const fireX = (L) => (S.piece && S.piece.anchors && S.piece.anchors.fireX) || L.W * 0.62;
  const anchor = (L) => ({ x: fireX(L) + 30 * L.k, y: L.gy - 96 * L.k });
  const maxPull = (L) => Math.max(60, Math.min(130 * L.k, L.W - anchor(L).x - 8));
  const landAt = (L, d) => { const a = anchor(L); const near = a.x - 90 * L.k, far = Math.max(L.W * 0.06, 20 * L.k); return { x: lerp(near, far, d), y: L.gy + 22 * L.k }; };
  const dogHome = (L) => ({ x: fireX(L) - 120 * L.k, y: L.gy + 24 * L.k });
  function text(L, s, x, y, col = '#ffd23f') { M.texts.push({ text: s, x: clamp(x, 90 * L.k, L.W - 90 * L.k), y, col, t: 0 }); }

  function power(L) {
    if (M.wind) return M.aim;
    if (!M.ptr) return 0;
    const a = anchor(L), len = Math.hypot(M.ptr.x - a.x, M.ptr.y - a.y);
    return clamp(len / maxPull(L), 0, 1);
  }
  function launch(L) {
    const p = power(L);
    M.ptr = null; M.wind = false;
    if (p < FETCH.minPull) { M.phase = 'ready'; return false; }
    M.n++; M.dist = Math.round(p * 1000) / 1000; M.best = Math.max(M.best, M.dist);
    M.phase = 'flight'; M.pt = 0; M.hint = false; M.item = 'stick'; M.emoji = '';
    M.landX = landAt(L, M.dist).x;
    hooks.sfx('whoosh');
    return true;
  }
  M.pointer = (L, x, y) => {
    if (M.phase !== 'ready') return false;
    const a = anchor(L);
    if (Math.hypot(x - a.x, y - a.y) > Math.max(110 * L.k, 70)) return false; // pointer down near the stick
    M.ptr = { x, y }; M.phase = 'aim';
    return true;
  };
  M.drag = (L, x, y) => { if (M.phase === 'aim' && M.ptr) M.ptr = { x, y }; };
  M.release = () => { if (M.phase === 'aim' && S.L) launch(S.L); };
  M.move = () => {};
  M.key = (L) => { if (M.phase === 'ready') { M.phase = 'aim'; M.wind = true; M.windT = 0; M.aim = 0; return true; } return false; };
  M.keyUp = (L, name) => { if (name === 'space' && M.phase === 'aim' && M.wind) launch(L); };
  // the app's answer to fetchThrow: the dog runs out and back
  M.bring = (o2) => {
    if (M.phase !== 'wait') return false;
    M.item = o2 && o2.item === 'find' ? 'find' : 'stick';
    M.emoji = (o2 && typeof o2.emoji === 'string' && o2.emoji) || (M.item === 'find' ? '❓' : '');
    M.phase = 'run'; M.pt = 0;
    return true;
  };

  M.dogPose = (L) => {
    const k = L.k, h = dogHome(L), land = landAt(L, M.dist);
    const p = { x: h.x, y: h.y, dir: 1, sit: true, amp: 0, sc: 1, ph: M.ph };
    if (M.phase === 'run') {
      const T = M.pt;
      p.sit = false; p.amp = 1;
      if (T < FETCH.out) { const u = ease(T / FETCH.out); p.x = lerp(h.x, land.x, u); p.y = lerp(h.y, land.y, u); p.dir = -1; }
      else if (T < FETCH.out + FETCH.grab) { p.x = land.x; p.y = land.y; p.dir = -1; p.amp = 0; p.sit = false; }
      else { const u = ease(clamp((T - FETCH.out - FETCH.grab) / FETCH.back, 0, 1)); p.x = lerp(land.x, h.x, u); p.y = lerp(land.y, h.y, u); p.dir = 1; }
    } else if (M.phase === 'back') { p.sit = true; }
    else if (M.phase === 'flop') { p.sit = true; p.sc = 1; }
    return p;
  };

  M.update = (L, dt) => {
    M.t += dt; M.pt += dt; M.ph += dt * 12;
    for (const tx of M.texts) tx.t += dt;
    M.texts = M.texts.filter((tx) => tx.t < 1.5);
    if (M.wind) { M.windT += dt; const u = (M.windT / FETCH.windUp) % 2; M.aim = u < 1 ? u : 2 - u; }  // the key's power swings out and back
    if (M.phase === 'flight' && M.pt >= FETCH.flight) {
      M.phase = 'wait'; M.pt = 0;
      M.res.push(M.dist);
      const l = landAt(L, M.dist);
      text(L, M.dist > 0.66 ? 'WHAT A THROW!' : M.dist > 0.33 ? 'NICE!' : 'A LITTLE ONE!', l.x, L.gy - 90 * L.k);
      emit({ type: 'fetchThrow', n: M.n, dist: M.dist });
    } else if (M.phase === 'run' && M.pt >= FETCH.out + FETCH.grab + FETCH.back) {
      M.phase = 'back'; M.pt = 0;
      emit({ type: 'fetchBack', n: M.n });
    } else if (M.phase === 'back' && M.pt >= 0.9) {
      if (M.n >= throws) { M.phase = 'flop'; M.pt = 0; hooks.sfx('twinkle'); }
      else { M.phase = 'ready'; M.pt = 0; M.dist = 0; }
    } else if (M.phase === 'flop' && M.pt >= FETCH.flop && !M.sent) {
      M.sent = true; M.done = true;
      emit({ type: 'fetchEnd', throws: M.n, best: M.best });
    }
  };

  // the arc: a parabola from the stick to where it will land, the apex higher for harder throws
  function arc(L, a, land, u, apex) { return { x: lerp(a.x, land.x, u), y: lerp(a.y, land.y, u) - Math.sin(Math.PI * u) * apex }; }
  M.drawOver = (c, L, t, rm) => {
    const k = L.k, a = anchor(L), p = power(L);
    // the stick in the child's hand (or pulled back on the band)
    if (M.phase === 'ready' || M.phase === 'aim') {
      let sx = a.x, sy = a.y;
      if (M.phase === 'aim') {
        if (M.wind) { sx = a.x + p * maxPull(L); sy = a.y + p * 18 * k; }
        else if (M.ptr) { const len = Math.hypot(M.ptr.x - a.x, M.ptr.y - a.y) || 1, cl = Math.min(len, maxPull(L)); sx = a.x + (M.ptr.x - a.x) / len * cl; sy = a.y + (M.ptr.y - a.y) / len * cl; }
        // the band
        c.beginPath(); c.moveTo(a.x - 4 * k, a.y - 10 * k); c.lineTo(sx, sy); c.lineTo(a.x - 4 * k, a.y + 10 * k);
        c.lineWidth = 3 * k; c.strokeStyle = '#f4ecd8'; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
        // the dotted ghost arc where it will land
        const land = landAt(L, p), apex = (40 + 90 * p) * k;
        c.fillStyle = '#ffffff';
        for (let i = 1; i <= 14; i++) { const q = arc(L, a, land, i / 14, apex); c.globalAlpha = 0.85 - i * 0.03; c.beginPath(); c.arc(q.x, q.y, (2.2 + (i % 2) * 0.6) * k, 0, TAU); c.fill(); }
        c.globalAlpha = 1;
        c.beginPath(); c.ellipse(land.x, land.y + 3 * k, 16 * k, 5 * k, 0, 0, TAU); c.lineWidth = 2.4 * k; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.stroke();
      } else if (!rm) { sy += Math.sin(t * 3) * 2 * k; }
      // two little posts for the band, then the stick
      for (const dy of [-10, 10]) { c.beginPath(); c.arc(a.x - 4 * k, a.y + dy * k, 4 * k, 0, TAU); c.fillStyle = '#8a5a2e'; c.fill(); c.lineWidth = 1.6 * k; c.strokeStyle = OUT; c.stroke(); }
      drawStick(c, sx, sy, k * 1.4, -0.25);
      if (M.hint && M.phase === 'ready') {
        c.globalAlpha = rm ? 0.95 : 0.78 + 0.22 * Math.sin(t * 4);
        drawText(c, 'PULL BACK AND LET GO!', 17 * k, clamp(a.x - 40 * k, L.W * 0.3, L.W * 0.7), a.y - 44 * k, '#ffffff', OUT, L.W * 0.9);
        c.globalAlpha = 1;
      }
    }
    // the stick flies, lies where it fell, or is carried
    if (M.phase === 'flight') {
      const u = clamp(M.pt / FETCH.flight, 0, 1), land = landAt(L, M.dist);
      const q = arc(L, a, land, ease(u), (40 + 90 * M.dist) * k);
      drawStick(c, q.x, q.y, k * 1.4, -0.25 + u * TAU * 1.5);
    } else if (M.phase === 'wait' || (M.phase === 'run' && M.pt < FETCH.out + FETCH.grab)) {
      const land = landAt(L, M.dist);
      if (M.phase === 'wait' || M.item === 'stick' || M.pt < FETCH.out) drawStick(c, land.x, land.y - 2 * k, k * 1.4, 0.12);
    }
    if (M.phase === 'run' && M.pt >= FETCH.out) {
      const pose = M.dogPose(L);
      if (M.item === 'stick') drawStick(c, pose.x + 24 * k * pose.dir, pose.y - 24 * k, k * 1.2, 0);
      else if (M.emoji) drawBubble(c, M.emoji, pose.x + 8 * k * pose.dir, pose.y - 40 * k, k * 1.1, 1);
    }
    if (M.phase === 'back') {
      const pose = M.dogPose(L), fade = clamp(1 - (M.pt - 0.5) / 0.4, 0, 1);
      if (M.item === 'find' && M.emoji) drawBubble(c, M.emoji, pose.x + 8 * k, pose.y - 44 * k, k * 1.1, fade);
    }
    if (M.phase === 'flop' && !rm) { const q = (M.pt * 0.8) % 1; c.globalAlpha = 1 - q; drawText(c, 'Z z z', 16 * k, dogHome(L).x + 6 * k, dogHome(L).y - 46 * k - q * 18 * k, '#ffffff'); c.globalAlpha = 1; }
    // the throws left (sticks), top left
    for (let i = 0; i < throws; i++) { c.globalAlpha = i < throws - M.n ? 1 : 0.28; drawStick(c, 30 * k + i * 38 * k, 26 * k, k * 0.9, -0.3); }
    c.globalAlpha = 1;
    for (const tx of M.texts) { c.globalAlpha = clamp(tx.t < 1.1 ? 1 : (1.5 - tx.t) / 0.4, 0, 1); drawText(c, tx.text, 24 * k, tx.x, tx.y - (rm ? 0 : tx.t * 16 * k), tx.col, OUT, L.W * 0.9); }
    c.globalAlpha = 1;
  };

  M.state = () => ({ kind: 'fetch', phase: M.phase, n: M.n, throws, left: throws - M.n, best: M.best, dist: M.dist });
  M.summary = () => ({ throws: M.n, best: M.best, finished: M.sent });
  M.debug = (L) => ({ ...M.state(), anchor: anchor(L), maxPull: maxPull(L), power: power(L), landX: M.landX, dog: M.dogPose(L), field: { near: landAt(L, 0), far: landAt(L, 1) } });
  void shade; void rrect; void mkCanvas; void BIOMES; void biomeOf; void paint; void lerp;
  return M;
}

// ================================================================= grasshoppers
export function createHoppers(o, emit, S, hooks) {
  const seed = (o && Number.isFinite(+o.seed) ? +o.seed : 1) >>> 0;
  const n = clamp(Math.round(o && o.n != null ? +o.n : 6) || 6, 1, 24);
  const rand = mulberry32((seed ^ 0x40b9e5) || 1);
  const pal = BIOMES[biomeOf(S.biome)];
  const M = {
    kind: 'hoppers', view: 'fish', input: true, done: false, t: 0, n, made: 0, caught: 0, gone: 0, hs: [], pops: [], texts: [], spawnT: 0.4,
    ended: false, endT: 0, bg: null, bgKey: '', hint: true, hintT: 0, tin: [],
  };
  const lane = (L) => [L.H * 0.6, L.H * 0.9];
  function spawn(L) {
    const dir = rand() < 0.75 ? 1 : -1, [y0, y1] = lane(L), k = L.k;
    M.made++;
    M.hs.push({
      x: dir > 0 ? -30 * k : L.W + 30 * k, y: y0 + rand() * (y1 - y0), dir, state: 'wait', st: 0.1 + rand() * 0.4, hop: 0, hopT: 0, fx: 0, fy: 0, tx: 0, ph: rand() * 6,
      hopLen: (80 + rand() * 50) * k, hopH: (34 + rand() * 24) * k, pause: 0.22 + rand() * 0.3, caught: false, id: M.made,
    });
  }
  M.pointer = (L, x, y) => {
    let best = null, bd = Infinity;
    for (const h of M.hs) {
      if (h.caught) continue;
      const d = Math.hypot(h.x - x, h.y - 10 * L.k - y);
      if (d < bd) { bd = d; best = h; }
    }
    M.hint = false;
    if (best && bd <= 52 * L.k + 12) {
      best.caught = true; best.pop = 0; M.caught++;
      M.pops.push({ x: best.x, y: best.y - 14 * L.k, t: 0 });
      M.texts.push({ text: 'GOT ONE!', x: clamp(best.x, 80 * L.k, L.W - 80 * L.k), y: best.y - 60 * L.k, t: 0 });
      hooks.sfx('twinkle');
      emit({ type: 'hopper', caught: M.caught });
      return true;
    }
    return false;
  };
  M.key = () => false;
  M.move = () => {};
  M.update = (L, dt) => {
    M.t += dt;
    if (M.made < n) { M.spawnT -= dt; if (M.spawnT <= 0 && M.hs.filter((h) => !h.caught).length < 3) { spawn(L); M.spawnT = 0.9 + rand() * 0.9; } }
    for (const h of M.hs) {
      if (h.caught) { h.pop += dt; continue; }
      if (h.state === 'wait') { h.st -= dt; if (h.st <= 0) { h.state = 'hop'; h.hopT = 0; h.fx = h.x; h.fy = h.y; h.ty = h.fy + (rand() - 0.5) * 36 * L.k; h.ty = clamp(h.ty, lane(L)[0], lane(L)[1]); } }
      else { h.hopT += dt / 0.55; const u = Math.min(1, h.hopT); h.x = h.fx + h.dir * h.hopLen * u; h.y = lerp(h.fy, h.ty, u); if (h.hopT >= 1) { h.state = 'wait'; h.st = h.pause; } }
      h.ph += dt * 12;
      if (h.x < -60 * L.k || h.x > L.W + 60 * L.k) { if (h.state === 'hop' || h.state === 'wait') { if ((h.dir > 0 && h.x > L.W) || (h.dir < 0 && h.x < 0)) { h.gone = true; M.gone++; } } }
    }
    M.hs = M.hs.filter((h) => !h.gone && !(h.caught && h.pop > 0.7));
    for (const p of M.pops) p.t += dt;
    M.pops = M.pops.filter((p) => p.t < 0.6);
    for (const tx of M.texts) tx.t += dt;
    M.texts = M.texts.filter((tx) => tx.t < 1.2);
    if (!M.ended && M.made >= n && M.hs.length === 0) { M.endT += dt; if (M.endT >= 0.6) { M.ended = true; emit({ type: 'hoppersEnd', caught: M.caught }); } }
    if (M.ended) { M.endT += dt; if (M.endT >= 2.2) M.done = true; }
  };
  // the meadow (painted once): tall grass in bands, tufts and flowers; the sky and far hills come from the engine
  M.drawBackground = (c, L) => {
    const key = L.W + 'x' + L.H + '@' + L.dpr;
    if (!M.bg || M.bgKey !== key) {
      const { W, H, k, dpr } = L, y0 = H * 0.5;
      const cv = mkCanvas(W * dpr, (H - y0 + 2) * dpr), g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, -y0 * dpr);
      const grad = g.createLinearGradient(0, y0, 0, H); grad.addColorStop(0, shade(pal.near, 0.05)); grad.addColorStop(0.5, pal.ground); grad.addColorStop(1, shade(pal.ground, -0.15));
      g.fillStyle = grad; g.fillRect(0, y0, W, H - y0 + 2);
      const r = mulberry32(31);
      for (let i = 0; i < 90; i++) { const x = r() * W, y = y0 + 8 * k + r() * (H - y0 - 10 * k), hh = (10 + (y - y0) / (H - y0) * 26 + r() * 10) * k; paint.grass(g, x, y, hh, shade(pal.ground, -0.1 + r() * 0.3), (1.6 + (y - y0) / (H - y0) * 1.6) * k); }
      for (let i = 0; i < 18; i++) { const x = r() * W, y = y0 + 20 * k + r() * (H - y0 - 30 * k); g.beginPath(); g.arc(x, y, 2.6 * k, 0, TAU); g.fillStyle = i % 3 === 0 ? '#ffe36a' : i % 3 === 1 ? '#ffffff' : '#f59ab0'; g.fill(); }
      M.bg = { cv, y0 }; M.bgKey = key;
    }
    c.drawImage(M.bg.cv, 0, M.bg.y0, L.W, L.H - M.bg.y0 + 2);
  };
  M.draw = (c, L, t, rm) => {
    const k = L.k;
    const sorted = M.hs.slice().sort((a, b) => a.y - b.y);
    for (const h of sorted) {
      if (h.caught) {
        const u = clamp(h.pop / 0.5, 0, 1), jar = { x: 38 * k, y: L.H - 44 * k };
        drawHopper(c, lerp(h.x, jar.x, ease(u)), lerp(h.y, jar.y, ease(u)) - Math.sin(Math.PI * u) * 60 * k, k * 1.5 * (1 - u * 0.5), h.ph, h.dir);
        continue;
      }
      const hopU = h.state === 'hop' ? Math.min(1, h.hopT) : 0;
      const lift = Math.sin(Math.PI * hopU) * h.hopH;
      c.beginPath(); c.ellipse(h.x, h.y + 2 * k, 13 * k, 3.6 * k, 0, 0, TAU); c.fillStyle = 'rgba(30,45,20,0.28)'; c.fill();
      drawHopper(c, h.x, h.y - lift, k * 1.5, h.state === 'hop' ? 1.6 : Math.sin(h.ph) * 0.3, h.dir);
    }
    for (const p of M.pops) { c.globalAlpha = clamp(1 - p.t / 0.6, 0, 1); c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; c.moveTo(p.x + Math.cos(a) * (6 + p.t * 20) * k, p.y + Math.sin(a) * (6 + p.t * 20) * k); c.lineTo(p.x + Math.cos(a) * (12 + p.t * 40) * k, p.y + Math.sin(a) * (12 + p.t * 40) * k); } c.lineWidth = 3 * k; c.strokeStyle = '#fff2a8'; c.stroke(); }
    c.globalAlpha = 1;
    // the bait tin (bottom left) with the count, and the grasshoppers still to come (icons, top left)
    const jx = 38 * k, jy = L.H - 36 * k;
    c.beginPath(); rrect(c, jx - 26 * k, jy - 20 * k, 52 * k, 40 * k, 6 * k); c.fillStyle = '#b8bcc4'; c.fill(); c.lineWidth = 2.4 * k; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); rrect(c, jx - 30 * k, jy - 26 * k, 60 * k, 10 * k, 4 * k); c.fillStyle = '#d8dce2'; c.fill(); c.stroke();
    drawText(c, String(M.caught), 20 * k, jx, jy + 4 * k, '#ffffff');
    for (let i = 0; i < n; i++) { c.globalAlpha = i < n - M.made ? 1 : 0.25; c.beginPath(); c.ellipse(24 * k + i * 20 * k, 24 * k, 6 * k, 3 * k, 0, 0, TAU); c.fillStyle = '#7ec850'; c.fill(); c.lineWidth = 1.4 * k; c.strokeStyle = OUT; c.stroke(); }
    c.globalAlpha = 1;
    if (M.hint && M.t > 0.3) { c.globalAlpha = rm ? 0.95 : 0.78 + 0.22 * Math.sin(t * 4); drawText(c, 'TAP THE GRASSHOPPERS!', 18 * k, L.W * 0.5, 54 * k, '#ffffff', OUT, L.W * 0.9); c.globalAlpha = 1; }
    for (const tx of M.texts) { c.globalAlpha = clamp(1.2 - tx.t, 0, 1); drawText(c, tx.text, 20 * k, tx.x, tx.y - (rm ? 0 : tx.t * 20 * k), '#ffd23f'); }
    c.globalAlpha = 1;
  };
  M.state = () => ({ kind: 'hoppers', phase: M.ended ? 'end' : 'play', caught: M.caught, left: n - M.caught - M.gone, n });
  M.summary = () => ({ caught: M.caught, n, finished: M.ended });
  M.debug = (L) => ({ ...M.state(), hoppers: M.hs.filter((h) => !h.caught).map((h) => ({ id: h.id, x: h.x, y: h.y - 10 * L.k, state: h.state })), made: M.made, gone: M.gone });
  void lane;
  return M;
}

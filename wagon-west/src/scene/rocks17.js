// Wagon West v1.7: flip the rocks by the water for bait. Pure fun: nothing here asks a question, runs a clock or can be failed.
//   startRocks({ seed, rocks: [{ i, kind }] })   a gravel bank by the water with five rocks. `kind` is what lies under each one, decided by the journey
//     (journey/rocks.js rocksPlan): 'worm' | 'beetle' | 'cricket' | 'crawdad' | 'mud' | 'arrowhead' (without `rocks` the scene draws its own seeded five,
//     for the dev page). A tap on a rock (or Space, which flips the next one) tips it over and shows what is under it:
//       a critter wriggles, then hops into the bait tin at the bottom left; "just mud" ripples; an arrowhead lifts into the light, a page of the
//       journal sketches it, and it stays right where it lay.
//     → { type: 'rock', i, kind } at each flip · { type: 'rocksEnd', flipped } after the last flip has played out. The app can end it early
//     (endMiniGame()): no end event. No timer, nothing to lose; "just mud" is a laugh.
import { TAU, OUT, mulberry32, clamp, lerp, ease, shade, mkCanvas, drawText, rrect } from './util.js';
import { BIOMES, biomeOf, paint } from './biomes.js';
import { drawCritter } from './sprites17.js';

const KINDS = ['worm', 'beetle', 'cricket', 'crawdad', 'mud'];
const T_FLIP = 0.55, T_SHOW = 1.0, T_TIN = 0.65, T_SKETCH = 2.4;
const NAMES = { worm: 'A FAT WORM!', beetle: 'A BEETLE!', cricket: 'A CRICKET!', crawdad: 'A CRAWDAD!', mud: 'JUST MUD', arrowhead: 'AN ARROWHEAD!' };
// the five rocks: two behind, three in front (fractions of the picture)
const SPOTS = [[0.22, 0.7], [0.5, 0.66], [0.78, 0.7], [0.36, 0.86], [0.66, 0.86]];

export function createRocks(o, emit, S, hooks) {
  const seed = (o && Number.isFinite(+o.seed) ? +o.seed : 1) >>> 0;
  const rand = mulberry32((seed ^ 0x70c4) >>> 0 || 1);
  const pal = BIOMES[biomeOf(S.biome)];
  const plan = Array.isArray(o && o.rocks) && o.rocks.length
    ? o.rocks.slice(0, SPOTS.length).map((r, i) => ({ i, kind: r && r.kind }))
    : SPOTS.map((_, i) => ({ i, kind: KINDS[Math.floor(rand() * KINDS.length)] }));
  const N = plan.length;
  const M = {
    kind: 'rocks', view: 'fish', input: true, done: false, t: 0, n: N, flipped: 0, caught: 0, ended: false, endT: 0, bg: null, bgKey: '', hint: true,
    rocks: plan.map((p, i) => ({ i, kind: ['worm', 'beetle', 'cricket', 'crawdad', 'arrowhead'].includes(p.kind) ? p.kind : 'mud', st: 'idle', t: 0, tinned: false,
      tilt: (rand() - 0.5) * 0.3, size: 0.92 + rand() * 0.2, side: i % 2 ? 1 : -1 })), texts: [], sparks: [], sketch: null,
  };
  const spot = (L, r) => ({ x: SPOTS[r.i][0] * L.W, y: SPOTS[r.i][1] * L.H });
  const tinPos = (L) => ({ x: 38 * L.k, y: L.H - 38 * L.k });
  const reach = (L) => 58 * L.k + 8;

  function flip(r, L) {
    if (r.st !== 'idle') return false;
    r.st = 'flip'; r.t = 0; M.flipped++; M.hint = false;
    const p = spot(L, r);
    M.texts.push({ text: NAMES[r.kind], x: clamp(p.x, 100 * L.k, L.W - 100 * L.k), y: p.y - 78 * L.k, t: 0, col: r.kind === 'mud' ? '#ffffff' : '#ffd23f' });
    hooks.sfx(r.kind === 'mud' ? 'plop' : 'twinkle');
    emit({ type: 'rock', i: r.i, kind: r.kind });
    return true;
  }
  M.pointer = (L, x, y) => {
    let best = null, bd = Infinity;
    for (const r of M.rocks) {
      if (r.st !== 'idle') continue;
      const p = spot(L, r), d = Math.hypot(p.x - x, p.y - 8 * L.k - y);
      if (d < bd) { bd = d; best = r; }
    }
    return !!best && bd <= reach(L) && flip(best, L);
  };
  M.key = (L) => { const r = M.rocks.find((q) => q.st === 'idle'); return !!r && flip(r, L); };
  M.move = () => {};
  M.update = (L, dt) => {
    M.t += dt;
    for (const r of M.rocks) {
      if (r.st === 'idle') continue;
      r.t += dt;
      if (r.st === 'flip' && r.t >= T_FLIP) { r.st = 'show'; r.t = 0; if (r.kind === 'arrowhead') M.sketch = { t: 0 }; }
      else if (r.st === 'show' && r.t >= (r.kind === 'arrowhead' ? T_SKETCH : T_SHOW)) {
        if (r.kind === 'mud' || r.kind === 'arrowhead') { r.st = 'done'; r.t = 0; } else { r.st = 'tin'; r.t = 0; }
      } else if (r.st === 'tin' && r.t >= T_TIN) { r.st = 'done'; r.t = 0; M.caught++; for (let i = 0; i < 6; i++) M.sparks.push({ a: i * TAU / 6, t: 0 }); }
    }
    if (M.sketch) M.sketch.t += dt;
    for (const tx of M.texts) tx.t += dt;
    M.texts = M.texts.filter((tx) => tx.t < 1.6);
    for (const s of M.sparks) s.t += dt;
    M.sparks = M.sparks.filter((s) => s.t < 0.5);
    if (!M.ended && M.flipped >= N && M.rocks.every((r) => r.st === 'done')) {
      M.endT += dt;
      if (M.endT >= 0.7) { M.ended = true; M.endT = 0; emit({ type: 'rocksEnd', flipped: M.flipped }); }
    } else if (M.ended) { M.endT += dt; if (M.endT >= 2) M.done = true; }
  };

  // the bank (painted once per size): a strip of water along the top, then gravel and grass to the bottom
  M.drawBackground = (c, L) => {
    const key = L.W + 'x' + L.H + '@' + L.dpr;
    if (!M.bg || M.bgKey !== key) {
      const { W, H, k, dpr } = L, y0 = H * 0.46;
      const cv = mkCanvas(W * dpr, (H - y0 + 2) * dpr), g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, -y0 * dpr);
      const wy = H * 0.15;                                                                                // the water strip
      const wg = g.createLinearGradient(0, y0, 0, y0 + wy); wg.addColorStop(0, '#6cc0d2'); wg.addColorStop(1, '#4aa0b6');
      g.fillStyle = wg; g.fillRect(0, y0, W, wy);
      const r = mulberry32(17);
      g.beginPath(); for (let i = 0; i < 16; i++) { const x = r() * W, y = y0 + 6 * k + r() * (wy - 12 * k); g.moveTo(x, y); g.lineTo(x + (12 + r() * 22) * k, y); }
      g.lineWidth = 2 * k; g.strokeStyle = 'rgba(255,255,255,0.5)'; g.stroke();
      g.beginPath(); g.moveTo(0, y0 + wy); for (let x = 0; x <= W; x += 12) g.lineTo(x, y0 + wy - 2 * k + Math.sin(x * 0.04) * 4 * k); g.lineTo(W, H + 2); g.lineTo(0, H + 2); g.closePath();   // the bank
      const bg = g.createLinearGradient(0, y0 + wy, 0, H); bg.addColorStop(0, shade(pal.near, 0.08)); bg.addColorStop(0.4, '#b9a98a'); bg.addColorStop(1, '#9d8d70');
      g.fillStyle = bg; g.fill(); g.lineWidth = 2.4; g.strokeStyle = shade(pal.ground, -0.4); g.stroke();
      for (let i = 0; i < 90; i++) { const x = r() * W, y = y0 + wy + 8 * k + r() * (H - y0 - wy - 10 * k); g.beginPath(); g.ellipse(x, y, (2 + r() * 4) * k, (1.4 + r() * 2) * k, 0, 0, TAU); g.fillStyle = r() < 0.5 ? '#cdbf9f' : '#8a7a5e'; g.fill(); }
      for (let i = 0; i < 18; i++) paint.grass(g, r() * W, y0 + wy + 4 * k + r() * 10 * k, (10 + r() * 12) * k, '#5a8a3e', 2.2 * k);
      M.bg = { cv, y0 }; M.bgKey = key;
    }
    c.drawImage(M.bg.cv, 0, M.bg.y0, L.W, L.H - M.bg.y0 + 2);
  };

  function drawRock(c, x, y, s, tilt, under, shine) {
    c.save(); c.translate(x, y); c.rotate(tilt); c.scale(s, s);
    c.beginPath(); c.moveTo(-46, 0); c.bezierCurveTo(-50, -22, -28, -36, 0, -34); c.bezierCurveTo(30, -36, 52, -20, 46, 0); c.bezierCurveTo(30, 8, -30, 8, -46, 0); c.closePath();
    c.fillStyle = under ? '#6f6556' : '#9a9588'; c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
    if (!under) {
      c.beginPath(); c.moveTo(-30, -22); c.quadraticCurveTo(-12, -32, 10, -30); c.lineWidth = 3.4; c.strokeStyle = 'rgba(255,255,255,0.4)'; c.stroke();
      c.beginPath(); c.ellipse(24, -22, 11, 5, -0.2, 0, TAU); c.fillStyle = '#6f9a4e'; c.fill();                          // a patch of moss
      c.beginPath(); c.moveTo(-8, -6); c.lineTo(-2, -16); c.lineWidth = 1.4; c.strokeStyle = 'rgba(43,29,20,0.4)'; c.stroke();
      if (shine) { c.beginPath(); c.arc(0, -16, 38, 0, TAU); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,0.35)'; c.stroke(); }
    }
    c.restore();
  }

  M.draw = (c, L, t, rm) => {
    const k = L.k, sorted = M.rocks.slice().sort((a, b) => spot(L, a).y - spot(L, b).y);
    for (const r of sorted) {
      const p = spot(L, r), sz = k * 1.25 * r.size;
      // the dent the rock leaves, and the shadow of an unflipped one
      c.beginPath(); c.ellipse(p.x, p.y + 4 * k, 44 * sz, 10 * sz, 0, 0, TAU); c.fillStyle = r.st === 'idle' ? 'rgba(30,25,15,0.3)' : '#6e5d44'; c.fill();
      if (r.st === 'idle') {
        const bob = !rm && M.hint ? Math.sin(t * 3 + r.i) * 2 * k : 0;
        drawRock(c, p.x, p.y + bob, sz, r.tilt, false, M.hint && M.t > 1.2 && r.i === M.rocks.findIndex((q) => q.st === 'idle'));
        continue;
      }
      // what is under it (drawn first), then the rock tipped over to the side
      const u = clamp(r.t / T_FLIP, 0, 1), e = ease(u);
      if (r.st !== 'flip' || u > 0.25) drawUnder(c, L, r, p, sz, t, rm);
      const away = r.st === 'flip' ? e : 1;
      drawRock(c, p.x + r.side * (58 * away) * k, p.y - 6 * k * (1 - away) - 4 * k * away, sz * (1 - 0.1 * away), r.tilt + r.side * (0.2 + 0.55 * away) * (r.st === 'flip' ? 1 : 1), away > 0.5);
    }
    // sparkles where a critter drops into the tin
    for (const s of M.sparks) { const tp = tinPos(L); c.globalAlpha = clamp(1 - s.t / 0.5, 0, 1); c.beginPath(); c.arc(tp.x + Math.cos(s.a) * (12 + s.t * 40) * k, tp.y - 12 * k + Math.sin(s.a) * (12 + s.t * 40) * k, 3 * k, 0, TAU); c.fillStyle = '#ffd23f'; c.fill(); }
    c.globalAlpha = 1;
    // the bait tin (bottom left) with the count
    const jx = tinPos(L).x, jy = tinPos(L).y;
    c.beginPath(); rrect(c, jx - 26 * k, jy - 20 * k, 52 * k, 40 * k, 6 * k); c.fillStyle = '#b8bcc4'; c.fill(); c.lineWidth = 2.4 * k; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); rrect(c, jx - 30 * k, jy - 26 * k, 60 * k, 10 * k, 4 * k); c.fillStyle = '#d8dce2'; c.fill(); c.stroke();
    drawText(c, String(M.caught), 20 * k, jx, jy + 4 * k, '#ffffff');
    // the rocks still to flip (little stones, top left)
    for (let i = 0; i < N; i++) { c.globalAlpha = M.rocks[i].st === 'idle' ? 1 : 0.25; c.beginPath(); c.ellipse(24 * k + i * 22 * k, 24 * k, 8 * k, 5.6 * k, 0, 0, TAU); c.fillStyle = '#9a9588'; c.fill(); c.lineWidth = 1.6 * k; c.strokeStyle = OUT; c.stroke(); }
    c.globalAlpha = 1;
    if (M.sketch) drawSketch(c, L, t, rm);
    if (M.hint && M.t > 0.3) { c.globalAlpha = rm ? 0.95 : 0.78 + 0.22 * Math.sin(t * 4); drawText(c, 'TAP A ROCK TO FLIP IT!', 18 * k, L.W * 0.5, 54 * k, '#ffffff', OUT, L.W * 0.9); c.globalAlpha = 1; }
    for (const tx of M.texts) { c.globalAlpha = clamp(1.6 - tx.t, 0, 1); drawText(c, tx.text, 22 * k, tx.x, tx.y - (rm ? 0 : tx.t * 18 * k), tx.col, OUT, L.W * 0.9); }
    c.globalAlpha = 1;
  };

  // the critter (or the arrowhead, or the mud) in the dent
  function drawUnder(c, L, r, p, sz, t, rm) {
    const k = L.k, wig = rm ? 0 : t + r.i;
    if (r.st === 'flip') { const u = clamp((r.t / T_FLIP - 0.25) / 0.75, 0, 1); c.globalAlpha = u; drawCritter(c, r.kind, p.x, p.y + 2 * k, k * 1.5, wig, r.side); c.globalAlpha = 1; return; }
    if (r.st === 'show') {
      if (r.kind === 'arrowhead') { const u = ease(clamp(r.t / 0.6, 0, 1)); drawCritter(c, 'arrowhead', p.x, p.y - 4 * k - u * 18 * k, k * (1.4 + u * 0.3), 0, 1); return; }
      const hop = r.kind === 'mud' ? 0 : rm ? 0 : Math.abs(Math.sin(r.t * 7)) * 8 * k;
      drawCritter(c, r.kind, p.x, p.y + 2 * k - hop, k * 1.5, wig, r.side);
      return;
    }
    if (r.st === 'tin') {
      const u = ease(clamp(r.t / T_TIN, 0, 1)), tp = tinPos(L);
      drawCritter(c, r.kind, lerp(p.x, tp.x, u), lerp(p.y, tp.y - 14 * k, u) - Math.sin(Math.PI * u) * 70 * k, k * 1.5 * (1 - u * 0.55), wig * 3, r.side);
      return;
    }
    // done
    if (r.kind === 'arrowhead') drawCritter(c, 'arrowhead', p.x, p.y - 8 * k, k * 1.3, 0, 1);          // it stays right where it lay
    else if (r.kind === 'mud') drawCritter(c, 'mud', p.x, p.y + 2 * k, k * 1.5, wig, 1);
  }
  // the journal page that sketches the arrowhead (top right); "left where it lay"
  function drawSketch(c, L, t, rm) {
    const k = L.k, u = ease(clamp(M.sketch.t / 0.5, 0, 1)), w = 92 * k, h = 112 * k, x = L.W - w - 18 * k, y = 18 * k + (1 - u) * -40 * k;
    c.save(); c.globalAlpha = u; c.translate(x + w / 2, y + h / 2); c.rotate(0.05);
    c.beginPath(); rrect(c, -w / 2, -h / 2, w, h, 5 * k); c.fillStyle = '#fbf3dc'; c.fill(); c.lineWidth = 2.4 * k; c.strokeStyle = OUT; c.stroke();
    c.save(); c.translate(0, 6 * k); c.scale(0.62, 0.62); c.globalAlpha = 0.9; c.beginPath(); c.rect(-w, -h, w * 2, h * 2); c.clip();
    c.lineWidth = 2; c.strokeStyle = '#5a4a38'; c.setLineDash([5, 3]);
    c.beginPath(); c.moveTo(0, -30 * k); c.bezierCurveTo(9 * k, -20 * k, 15 * k, -8 * k, 12 * k, 2 * k); c.lineTo(5 * k, -1 * k); c.lineTo(4 * k, 7 * k); c.lineTo(-4 * k, 7 * k); c.lineTo(-5 * k, -1 * k); c.lineTo(-12 * k, 2 * k); c.bezierCurveTo(-15 * k, -8 * k, -9 * k, -20 * k, 0, -30 * k); c.stroke();
    c.setLineDash([]); c.restore();
    drawText(c, 'JOURNAL', 11 * k, 0, -h / 2 + 14 * k, '#5a4a38', 'rgba(0,0,0,0)', w * 0.9);
    drawText(c, 'LEFT WHERE IT LAY', 8.6 * k, 0, h / 2 - 10 * k, '#5a4a38', 'rgba(0,0,0,0)', w * 0.95);
    c.restore(); c.globalAlpha = 1; void t; void rm;
  }

  M.state = () => ({ kind: 'rocks', phase: M.ended ? 'end' : 'play', flipped: M.flipped, caught: M.caught, left: N - M.flipped, n: N });
  M.summary = () => ({ flipped: M.flipped, n: N, finished: M.ended });
  M.debug = (L) => ({ ...M.state(), rocks: M.rocks.map((r) => { const p = spot(L, r); return { i: r.i, kind: r.kind, st: r.st, x: p.x, y: p.y - 8 * L.k }; }), sketch: !!M.sketch });
  return M;
}

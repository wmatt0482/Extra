// Wagon West float and the Columbia raft (SPEC v1.2 §3 and §4, scene stream): the wagon on a raft of lashed logs
// drifts DOWN the screen, top to bottom, through a run of river; the child steers it sideways past rocks (drag a finger
// or the mouse across the screen, or hold the left / right arrow keys). One module, two games:
//   float: ONE short run, 6 s (narrow) or 9 s (wide) from the top of the view to the landing at the bottom, rocks in lanes.
//   raft:  the Columbia finale: `length` bends (default 4), each a 7 s run with rocks AND eddies that spin the raft and a
//          calm lane of smooth water to follow; at the bottom of every bend the raft pauses in calm water, emits
//          raftMarker and WAITS for scene.raftGo() (the app asks a fact meanwhile); after the last bend a 4.5 s stretch
//          opens into the valley: the landing, the party cheering and a vista.
// Every run is built from the seed (same seed, same rocks) with one guaranteed clear route (the calm lane: drawn on the
// raft, hidden on the float) and a rock in the middle lane early on, so a raft left alone always bumps once and a raft
// steered along the calm lane never does. A bump is a thud, a splash and a rocking raft, never a loss; no clock, no
// countdown and no score is drawn.
//
// Events (via emit): float: { type: 'float', bump: true } per rock hit, { type: 'floatEnd', bumps } at the landing.
//   raft: { type: 'raft', bump: true } per rock hit (an extra, same shape), { type: 'raftMarker', n, of } at each bend,
//   { type: 'raftEnd', bumps, bends } at the valley.

import { TAU, OUT, mulberry32, clamp, lerp, ease, approach, shade, rgba, mkCanvas, drawText, rrect } from './util.js';
import { BIOMES, biomeOf, paint, buildLayers } from './biomes.js';
import { buildSetPiece } from './backdrops.js';
import { drawWagon, drawTeam, drawPerson } from './sprites.js';
import { drawRaft, drawRock, drawEddy, drawSplash, ROCK_R } from './sprites12.js';

export const RUN = {
  ready: 0.7, // s at the top before the drift starts
  float: { narrow: 6, wide: 9 }, // s of river, top to bottom
  seg: 7, // s a Columbia bend takes
  valley: 4.5, // s of the final stretch into the valley
  land: 1.0, // s the raft takes to glide onto the beach
  turn: 1.1, // s of the camera panning on to the next bend
  settle: 0.5, // s in the pool before the marker is emitted
  vmax: 0.62, // steering speed, channel widths per second
  linger: 2, // s after the landing before the scene goes back (the raft's vista holds longer)
  vista: 3.4,
};
const WA = 0.22; // how far (in run fractions) a rock reaches along the river when the route is planned

export function createRun(kind, opts, emit, S, hooks, biomeId) {
  const o = opts || {};
  const raft = kind === 'raft';
  const seed = (Number.isFinite(+o.seed) ? +o.seed : 1) >>> 0;
  const width = raft ? 'wide' : o.width === 'wide' ? 'wide' : 'narrow';
  const length = raft ? clamp(Math.round(o.length != null && Number.isFinite(+o.length) ? +o.length : 4), 1, 8) : 1;
  const palId = raft ? 'gorge' : biomeOf(biomeId);
  const pal = BIOMES[palId];
  const R = {
    kind, width, length, seed, input: true,
    phase: 'ready', pt: 0, seg: null, next: null, segIdx: 0, bend: 0, waiting: false, markerSent: false, bumps: 0,
    u: 0.5, tu: null, dragging: false, keyDir: 0, vb: 0, ang: 0, tilt: 0, tiltT: 9, spins: 0, inEddy: 0,
    splashes: [], texts: [], t: 0, landY: 0, landT: 0, ended: false, done: false, turnT: 0, vistaT: 0, flow: 1,
    streaks: Array.from({ length: 34 }, (_, i) => ({ u: ((i * 0.6180339) % 1), a: (i * 0.3819) % 1, v: 0.18 + ((i * 7) % 5) * 0.05, len: 12 + (i % 4) * 5 })),
    bgs: new Map(), bgKey: '', vista: null, hintT: 0,
  };

  // ---------------------------------------------------------------- geometry (css px)
  function geo(L) {
    const { W, H } = L;
    const ref = clamp(Math.min(W * 0.9, H * 1.25), 240, 640);
    const chan = ref * (width === 'narrow' ? 0.78 : 1);
    const rs = (0.1 * ref) / 66; // raft sprite scale: half width 66 units = 10 % of the reference channel
    const hwPx = 66 * rs, rockS = 0.0021 * ref;
    return {
      ref, chan, rs, rockS, hwPx, hwU: hwPx / chan, rhPx: 48 * rs * 0.62, yTop: H * 0.28, yBot: H * 0.78, yBeach: H * 0.835,
      uMin: (hwPx * 0.85) / chan,
    };
  }
  // the channel's centre line: it bows to one side in the middle of the screen (the bend) and is centred at both ends
  function cxAt(L, G, seg, y) {
    const shift = Math.max(0, Math.min(L.W * 0.14, L.W * 0.5 - G.chan * 0.55 - 12 * L.k));
    return L.W * 0.5 + seg.bend * shift * Math.sin(Math.PI * clamp(y / L.H, 0, 1));
  }
  const xOf = (L, G, seg, u, y) => cxAt(L, G, seg, y) + (u - 0.5) * G.chan;
  const yOfA = (G, a) => lerp(G.yTop, G.yBot, a);

  // the calm lane: smooth between key points (a = 0, .25, .5, .75, 1)
  function corridor(seg, a) {
    const ks = seg.keys, f = clamp(a, 0, 1) * 4, i = Math.min(3, Math.floor(f));
    return lerp(ks[i], ks[i + 1], ease(f - i));
  }

  // ---------------------------------------------------------------- the river of one bend, from the seed
  function genSeg(L, idx) {
    const G = geo(L), valley = raft && idx === length;
    const rnd = mulberry32(((seed ^ 0xa11f) + idx * 7919 + 1) >>> 0);
    const side = rnd() < 0.5 ? -1 : 1;
    const seg = {
      idx, valley, seed: (seed + idx * 131) >>> 0, rocks: [], eddies: [], dur: raft ? (valley ? RUN.valley : RUN.seg) : RUN.float[width],
      bend: valley ? 0.35 * side : raft ? (idx % 2 ? -1 : 1) * (side < 0 ? -1 : 1) : (rnd() < 0.5 ? -1 : 1) * 0.55,
      keys: [0.5 + side * 0.3, 0.5 + side * 0.3, 0.5 + side * 0.3, 0.5, 0.5], bg: null, bgKey: '',
    };
    // the way through
    const lanes = [0.28, 0.5, 0.72];
    seg.keys[3] = lanes[Math.floor(rnd() * 3)];
    if (valley) { seg.keys.fill(0.5); return seg; }
    const hwU = G.hwU, block = (big) => 0.8 * hwU + 0.85 * ((ROCK_R[big ? 1 : 0] * G.rockS) / G.chan) + 0.04;
    const clearOfRoute = (u, a, need) => { for (let j = -4; j <= 4; j++) if (Math.abs(u - corridor(seg, a + (j / 4) * WA)) < need) return false; return true; };
    // a rock in the middle lane early: a raft left alone always bumps
    seg.rocks.push({ a: 0.3, u: 0.5, big: true, hit: false, ph: rnd() * 6 });
    // eddies first (raft): away from the way through
    const nEddy = raft ? 2 : 0;
    const rEu = (0.15 * G.ref) / G.chan;
    for (let n = 0, tries = 0; n < nEddy && tries < 30; tries++) {
      const a = n === 0 ? 0.52 + rnd() * 0.1 : 0.74 + rnd() * 0.1, u = clamp(0.2 + rnd() * 0.6, 0.2, 0.8);
      let ok = true;
      for (let j = -4; j <= 4 && ok; j++) if (Math.abs(u - corridor(seg, a + (j / 4) * (WA + 0.04))) < rEu + 0.8 * hwU + 0.05) ok = false;
      if (ok && seg.rocks.some((r) => Math.abs(r.a - a) < 0.22 && Math.abs(r.u - u) < 0.3)) ok = false;
      if (ok) { seg.eddies.push({ a, u, dir: n % 2 ? -1 : 1, ph: rnd() * 6 }); n++; }
    }
    // the rest of the rocks, in lanes
    const total = raft ? 8 : width === 'wide' ? 8 : 5;
    const laneU = [0.12, 0.3, 0.5, 0.7, 0.88];
    for (let n = 1; n < total; n++) {
      for (let tries = 0; tries < 14; tries++) {
        const a = 0.2 + (raft ? 0.64 : 0.72) * ((n + rnd() * 0.8) / total), u = clamp(laneU[Math.floor(rnd() * 5)] + (rnd() - 0.5) * 0.08, 0.08, 0.92), big = rnd() < 0.5;
        if (!clearOfRoute(u, a, block(big))) continue;
        if (seg.rocks.some((r) => Math.hypot((r.u - u) * G.chan, (r.a - a) * (G.yBot - G.yTop) * 1.5) < (ROCK_R[r.big ? 1 : 0] + ROCK_R[big ? 1 : 0]) * G.rockS * 1.25 + 10)) continue;
        if (seg.eddies.some((e) => Math.abs(e.a - a) < 0.24 && Math.abs(e.u - u) < 0.3)) continue;
        seg.rocks.push({ a, u, big, hit: false, ph: rnd() * 6 });
        break;
      }
    }
    seg.rocks.sort((p, q) => p.a - q.a);
    return seg;
  }
  const ensure = (L) => { if (!R.seg) R.seg = genSeg(L, R.segIdx); return R.seg; };

  // ---------------------------------------------------------------- the painted river (once per bend and size)
  function bgFor(L, seg) {
    const key = L.W + 'x' + L.H + '@' + L.dpr;
    if (seg.bg && seg.bgKey === key) return seg.bg;
    const { W, H, k, dpr } = L, G = geo(L);
    const cv = mkCanvas(W * dpr, H * dpr), c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = mulberry32(seg.seed);
    const rocky = palId === 'gorge' || palId === 'mountains';
    const land = rocky ? shade(pal.near, -0.08) : pal.ground;
    c.fillStyle = land; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 36; i++) { c.beginPath(); c.ellipse(r() * W, r() * H, (18 + r() * 40) * k, (6 + r() * 14) * k, 0, 0, TAU); c.fillStyle = shade(land, r() < 0.5 ? -0.07 : 0.06); c.fill(); }
    const edge = (y, s) => cxAt(L, G, seg, y) + s * (G.chan / 2) * (1 + (Math.sin(y * 0.021 + s) * 0.04 + Math.sin(y * 0.047 + seg.idx) * 0.025) * Math.sin(Math.PI * clamp(y / H, 0, 1)));
    const poolBulge = (y) => { const q = (y / H - 0.62) / 0.32; return seg.valley || !raft || q <= 0 || q >= 1 ? 0 : 0.22 * Math.sin(Math.PI * q); }; // the pool widens around the pause, and is back to normal at both ends of the bend
    const eL = (y) => edge(y, -1) - G.chan * 0.5 * poolBulge(y), eR = (y) => edge(y, 1) + G.chan * 0.5 * poolBulge(y);
    const strip = (fn, w) => { c.beginPath(); for (let y = -6; y <= H + 6; y += 8) { const x = fn(y); if (y === -6) c.moveTo(x, y); else c.lineTo(x, y); } c.lineWidth = w; c.lineCap = 'butt'; c.lineJoin = 'round'; };
    // cliffs in the gorge, a sandy shore everywhere
    if (rocky) {
      for (const [fn, s] of [[eL, -1], [eR, 1]]) {
        c.beginPath(); for (let y = -6; y <= H + 6; y += 8) { const x = fn(y) + s * 8 * k; if (y === -6) c.moveTo(x, y); else c.lineTo(x, y); }
        c.lineTo(fn(H + 6) + s * 56 * k, H + 6); for (let y = H + 6; y >= -6; y -= 8) c.lineTo(fn(y) + s * (50 + Math.sin(y * 0.03 + s) * 12) * k, y);
        c.closePath(); c.fillStyle = pal.mid; c.fill(); c.lineWidth = 2.4 * k; c.strokeStyle = OUT; c.stroke();
        c.beginPath(); for (let y = 30; y < H; y += 46) { const x = fn(y) + s * 8 * k; c.moveTo(x + s * 4 * k, y); c.lineTo(x + s * (30 + (y % 5) * 3) * k, y + 3 * k); }
        c.lineWidth = 2 * k; c.strokeStyle = shade(pal.mid, -0.25); c.stroke();
      }
    }
    for (const fn of [eL, eR]) { strip(fn, 22 * k); c.strokeStyle = shade(pal.trail, 0.08); c.stroke(); }
    // the water
    c.beginPath();
    for (let y = -6; y <= H + 6; y += 8) { const x = eL(y); if (y === -6) c.moveTo(x, y); else c.lineTo(x, y); }
    for (let y = H + 6; y >= -6; y -= 8) c.lineTo(eR(y), y);
    c.closePath();
    c.fillStyle = pal.water; c.fill();
    c.save(); c.clip();
    for (const f of [0.62, 0.44, 0.26]) { strip((y) => cxAt(L, G, seg, y), G.chan * f); c.strokeStyle = rgba(shade(pal.water, -0.3), 0.15); c.stroke(); } // deeper in the middle, in soft steps
    for (const fn of [eL, eR]) { strip(fn, 34 * k); c.strokeStyle = 'rgba(255,255,255,0.2)'; c.stroke(); } // shallows at the edges
    if (raft && !seg.valley) { // the calm lane: smooth, pale water along the way through
      c.beginPath();
      for (let n = 0; n <= 24; n++) { const a = n / 24, y = yOfA(G, a), x = xOf(L, G, seg, corridor(seg, a), y); if (n === 0) c.moveTo(x, y - 40 * k); c.lineTo(x, y); }
      c.lineTo(xOf(L, G, seg, corridor(seg, 1), G.yBot + 60 * k), G.yBot + 60 * k);
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.lineWidth = G.hwPx * 2.1; c.strokeStyle = 'rgba(214,242,255,0.2)'; c.stroke();
      c.lineWidth = G.hwPx * 1.3; c.strokeStyle = 'rgba(224,248,255,0.22)'; c.stroke();
      c.lineCap = 'butt';
    }
    c.restore();
    for (const fn of [eL, eR]) { strip(fn, 3 * k); c.strokeStyle = 'rgba(255,255,255,0.85)'; c.stroke(); } // the foam line along each shore
    // things on the land
    const props = [];
    for (let i = 0; i < 26; i++) props.push({ y: r() * H, s: r() < 0.5 ? -1 : 1, d: (18 + r() * 200) * k, h: (30 + r() * 38) * k, kind: r() });
    props.sort((p, q) => p.y - q.y);
    for (const p of props) {
      const x = (p.s < 0 ? eL(p.y) - (rocky ? 52 * k : 14 * k) : eR(p.y) + (rocky ? 52 * k : 14 * k)) + p.s * p.d;
      if (x < -20 || x > W + 20) continue;
      if (rocky) paint.pine(c, x, p.y, p.h * 0.62, p.h * 1.5, shade(pal.near, p.kind * 0.15), OUT, 2 * k);
      else if (p.kind < 0.55) paint.blobTree(c, x, p.y, p.h * 1.5, '#6a4a2a', shade(pal.near, p.kind * 0.2 - 0.1), OUT, 2 * k);
      else if (p.kind < 0.8) paint.rock(c, x, p.y, p.h * 0.34, '#9a9aa0', OUT, 2 * k);
      else paint.grass(c, x, p.y, p.h * 0.5, '#4f7a3a', 2.2 * k);
    }
    // the bend marker (a post and a board with the bend's number) on the right bank by the pool
    if (raft && !seg.valley) {
      const y = H * 0.74, x = Math.min(eR(y) + (rocky ? 70 : 34) * k, W - 36 * k);
      c.beginPath(); c.moveTo(x, y + 20 * k); c.lineTo(x, y - 46 * k); c.lineWidth = 6 * k; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.4 * k; c.strokeStyle = '#8a5a2e'; c.stroke();
      c.beginPath(); rrect(c, x - 30 * k, y - 78 * k, 60 * k, 36 * k, 6 * k); c.fillStyle = '#f4ead0'; c.fill(); c.lineWidth = 2.6 * k; c.strokeStyle = OUT; c.stroke();
      drawText(c, 'BEND ' + (seg.idx + 1), 12 * k, x, y - 66 * k, '#8a2b1b', null, 50 * k);
      drawText(c, 'OF ' + length, 11 * k, x, y - 52 * k, '#3a2a1e', null, 40 * k);
    }
    // the landing: sand across the bottom of the last run (the float's, the valley's)
    if (!raft || seg.valley) {
      c.beginPath(); c.moveTo(-4, H + 4); c.lineTo(-4, H * 0.9);
      for (let x = 0; x <= W; x += 24) c.lineTo(x, H * 0.885 + Math.sin(x * 0.02) * 3 * k);
      c.lineTo(W + 4, H * 0.9); c.lineTo(W + 4, H + 4); c.closePath();
      c.fillStyle = '#f0dca8'; c.fill(); c.lineWidth = 3 * k; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.stroke();
      c.beginPath(); for (let i = 0; i < 14; i++) { const x = r() * W, y = H * (0.93 + r() * 0.06); c.moveTo(x, y); c.lineTo(x + (5 + r() * 8) * k, y + 1.5 * k); }
      c.lineWidth = 2 * k; c.strokeStyle = '#d3bd84'; c.stroke();
      c.beginPath(); rrect(c, W * 0.62, H * 0.945, 70 * k, 10 * k, 5 * k); c.fillStyle = '#9a6a3c'; c.fill(); c.lineWidth = 2 * k; c.strokeStyle = OUT; c.stroke(); // driftwood
    }
    seg.bg = cv; seg.bgKey = key;
    return cv;
  }

  // the valley vista (a side view of the homestead and the party), built when the last stretch begins
  function buildVista(L) {
    const lay = buildLayers('valley', L);
    const piece = buildSetPiece('valley', { id: 'willamette-valley', biome: 'valley', miles: 100, stop: { kind: 'home' } }, L);
    const sky = BIOMES.valley.sky;
    const cv = mkCanvas(L.W * L.dpr, L.H * L.dpr), c = cv.getContext('2d');
    c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, L.H * 0.72);
    g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); c.fillStyle = g; c.fillRect(0, 0, L.W, L.H);
    c.beginPath(); c.arc(L.W * 0.84, L.H * 0.16, 24 * L.k, 0, TAU); c.fillStyle = '#ffe36a'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#f0b400'; c.stroke();
    for (const key of ['far', 'mid', 'near', 'ground']) { const l = lay[key]; for (let x = 0; x < L.W; x += L.P) c.drawImage(l.cv, 0, 0, l.cv.width, l.cv.height, x, l.y0, L.P, l.h); }
    if (piece) c.drawImage(piece.cv, piece.x0, piece.y0, piece.w, piece.h);
    R.vista = { cv, props: lay.props, key: L.W + 'x' + L.H + '@' + L.dpr };
  }

  // ---------------------------------------------------------------- input
  const clampU = (G, u) => clamp(u, G.uMin, 1 - G.uMin);
  function aim(L, x) {
    const G = geo(L), seg = ensure(L);
    const y = R.phase === 'ready' ? G.yTop : yNow(L, G);
    R.tu = clampU(G, (x - (cxAt(L, G, seg, y) - G.chan / 2)) / G.chan);
  }
  R.pointer = (L, x) => { if (R.ended) return false; R.dragging = true; aim(L, x); return true; };
  R.drag = (L, x) => { if (R.ended || !R.dragging) return; aim(L, x); };
  R.release = () => { R.dragging = false; R.tu = null; };
  R.move = () => {};
  R.key = () => false;
  R.keyDown = (L, name) => { if (name === 'left') R.keyDir = -1; else if (name === 'right') R.keyDir = 1; else return false; return true; };
  R.keyUp = (L, name) => { if ((name === 'left' && R.keyDir < 0) || (name === 'right' && R.keyDir > 0)) R.keyDir = 0; };
  R.go = () => {
    if (!raft || !R.waiting) return false;
    R.waiting = false; R.phase = 'turn'; R.turnT = 0;
    return true;
  };

  // ---------------------------------------------------------------- update
  const yNow = (L, G) => {
    if (R.phase === 'land' || R.phase === 'landed' || R.phase === 'vista') return lerp(G.yBot, G.yBeach, ease(R.landT / RUN.land));
    if (R.phase === 'drift') return yOfA(G, clamp(R.pt / R.seg.dur, 0, 1));
    if (R.phase === 'bend') return G.yBot;
    if (R.phase === 'turn') return lerp(G.yBot, G.yTop, ease(R.turnT / RUN.turn));
    return G.yTop;
  };
  function text(L, s, x, y, col = '#ffffff', sub = '') { R.texts.push({ text: s, sub, x: clamp(x, 90 * L.k, L.W - 90 * L.k), y, col, t: 0 }); }
  function bump(L, G, seg, rock, y) {
    rock.hit = true; R.bumps++;
    const away = R.u >= rock.u ? 1 : -1;
    R.vb = away * 0.5; R.tilt = -away * 0.3; R.tiltT = 0;
    const rx = xOf(L, G, seg, rock.u, yOfA(G, rock.a)), px = xOf(L, G, seg, R.u, y);
    R.splashes.push({ x: (rx + px) / 2, y: yOfA(G, rock.a) + 8 * L.k, t: 0, r: 30 * L.k * (rock.big ? 1.2 : 0.9) }, { x: px - away * G.hwPx * 0.6, y: y + 14 * L.k, t: -0.08, r: 22 * L.k });
    text(L, 'BUMP!', px, y - 70 * L.k, '#ffffff');
    emit(raft ? { type: 'raft', bump: true } : { type: 'float', bump: true });
  }
  function steer(L, G, dt, seg, y) {
    const vmax = RUN.vmax;
    if (R.keyDir) { R.u += R.keyDir * vmax * dt; R.tu = null; }
    else if (R.tu != null) R.u += clamp(R.tu - R.u, -vmax * dt, vmax * dt);
    R.u += R.vb * dt; R.vb *= Math.exp(-5 * dt);
    // eddies pull toward their middle and spin the raft
    let inside = 0;
    for (const e of seg.eddies) {
      const dx = (R.u - e.u) * G.chan, dy = (y - yOfA(G, e.a)) / 0.66, rr = 0.15 * G.ref, d = Math.hypot(dx, dy);
      if (d < rr) { const f = 1 - d / rr; inside = Math.max(inside, f); R.u += clamp(e.u - R.u, -1, 1) * 0.9 * f * dt; R.ang += e.dir * 3.6 * f * dt; }
    }
    if (inside > 0.05 && R.inEddy <= 0.05) R.spins++;
    R.inEddy = inside;
    if (!inside) R.ang = approach(R.ang, Math.round(R.ang / TAU) * TAU, 2.6, dt);
    R.u = clampU(G, R.u);
    // collisions
    if (R.phase === 'drift' && !seg.valley) {
      const a = R.pt / seg.dur;
      for (const rk of seg.rocks) {
        if (rk.hit || Math.abs(rk.a - a) > 0.2) continue;
        const rp = ROCK_R[rk.big ? 1 : 0] * G.rockS;
        const dx = Math.abs(R.u - rk.u) * G.chan, dy = Math.abs(y - yOfA(G, rk.a));
        if (dx < G.hwPx * 0.8 + rp * 0.85 && dy < G.rhPx * 0.8 + rp * 0.55) bump(L, G, seg, rk, y);
      }
    }
  }
  function startSeg(L, idx) {
    R.segIdx = idx; R.seg = R.next && R.next.idx === idx ? R.next : genSeg(L, idx); R.next = null;
    R.pt = 0; R.phase = 'ready'; R.markerSent = false; R.prebuilt = false;
    for (const rk of R.seg.rocks) rk.hit = false;
  }

  R.update = (L, dt) => {
    R.t += dt; R.pt += dt; R.hintT += dt;
    const G = geo(L), seg = ensure(L);
    if (raft && !R.next && R.phase === 'drift' && R.segIdx < length && R.pt > 1) R.next = genSeg(L, R.segIdx + 1);
    const y = yNow(L, G);
    R.flow = R.phase === 'bend' || R.phase === 'landed' || R.phase === 'vista' ? 0.2 : R.phase === 'land' ? 0.45 : 1;
    // the phases
    if (R.phase === 'ready') {
      if (R.pt >= (R.segIdx === 0 ? RUN.ready : 0.35)) { R.phase = 'drift'; R.pt = 0; }
    } else if (R.phase === 'drift') {
      if (R.pt >= seg.dur) {
        R.pt = 0;
        if (raft && !seg.valley) { R.phase = 'bend'; } else { R.phase = 'land'; R.landT = 0; }
      }
    } else if (R.phase === 'bend') {
      if (!R.prebuilt && R.pt >= 0.1) { // paint the next bend (and the valley's vista) now, while the raft rests
        R.prebuilt = true;
        R.next = R.next && R.next.idx === R.segIdx + 1 ? R.next : genSeg(L, R.segIdx + 1);
        bgFor(L, R.next);
        if (R.segIdx + 1 === length && !R.vista) buildVista(L);
      }
      if (!R.markerSent && R.pt >= RUN.settle) {
        R.markerSent = true; R.waiting = true; R.bend++;
        emit({ type: 'raftMarker', n: R.bend, of: length });
        text(L, 'CALM WATER', L.W * 0.5, L.H * 0.3, '#ffffff');
      }
    } else if (R.phase === 'turn') {
      R.turnT += dt;
      if (R.turnT >= RUN.turn) { R.turnT = 0; startSeg(L, R.segIdx + 1); }
    } else if (R.phase === 'land') {
      R.landT += dt;
      if (R.landT >= RUN.land) {
        R.phase = 'landed'; R.pt = 0; R.ended = true;
        if (raft) emit({ type: 'raftEnd', bumps: R.bumps, bends: length });
        else emit({ type: 'floatEnd', bumps: R.bumps });
        if (hooks && hooks.celebrate) hooks.celebrate(raft ? 'arrived' : 'star', R.landX, R.landY);
        text(L, raft ? 'THE VALLEY!' : 'LANDED!', L.W * 0.5, L.H * 0.26, '#ffd23f');
      }
    } else if (R.phase === 'landed') {
      if (raft && R.pt >= 0.8) { R.phase = 'vista'; R.vistaT = 0; if (!R.vista) buildVista(L); }
      else if (!raft && R.pt >= RUN.linger) R.done = true;
    } else if (R.phase === 'vista') {
      R.vistaT += dt;
      if (R.vistaT >= RUN.vista) R.done = true;
    }
    // the raft itself
    const still = R.phase === 'bend' || R.phase === 'turn' || R.phase === 'landed' || R.phase === 'vista' || R.phase === 'land';
    if (R.phase === 'ready' || R.phase === 'drift') steer(L, G, dt, seg, y);
    else if (R.phase === 'bend' || R.phase === 'land' || R.phase === 'landed') { R.u = approach(R.u, 0.5, R.phase === 'bend' ? 2.2 : 1.8, dt); R.ang = approach(R.ang, Math.round(R.ang / TAU) * TAU, 3, dt); R.vb = 0; }
    R.tiltT += dt;
    R.tiltNow = R.tiltT < 1 ? R.tilt * Math.exp(-3.2 * R.tiltT) * Math.cos(R.tiltT * 13) : 0;
    if (R.phase === 'ready' || R.phase === 'drift') R.tiltNow += (S.rm ? 0 : Math.sin(R.t * 1.9) * 0.025);
    else if (!still) R.tiltNow += 0;
    const yy = yNow(L, G);
    R.landX = xOf(L, G, seg, R.u, yy); R.landY = yy;
    for (const sp of R.splashes) sp.t += dt;
    R.splashes = R.splashes.filter((sp) => sp.t < 0.85);
    for (const tx of R.texts) tx.t += dt;
    R.texts = R.texts.filter((tx) => tx.t < 1.7);
  };

  // ---------------------------------------------------------------- draw
  function drawBeachParty(c, L, G) {
    const P = S.party;
    if (!P || !P.looks) return;
    const cheer = S.cheerT > 0 ? 1.8 - S.cheerT : 0;
    for (let n = 0; n < 3 && n < P.looks.length; n++) drawPerson(c, L.W * [0.17, 0.3, 0.8][n], L.H * 0.965, L.k * 0.7, P.looks[n], 0, 0, cheer > 0 ? cheer + n * 0.12 : 0, n === 2 ? -1 : 1);
  }
  function drawWorld(c, L, G, seg, offY, t, rm, withObstacles) {
    c.drawImage(bgFor(L, seg), 0, offY, L.W, L.H);
    c.save(); c.translate(0, offY);
    // the current: streaks flowing down
    c.beginPath();
    const span = L.H + 60 * L.k;
    for (const s of R.streaks) {
      const y = (((s.a + t * s.v * R.flow * 0.5) % 1) * span) - 30 * L.k;
      if (raft && !seg.valley) { const aa = clamp((y - G.yTop) / (G.yBot - G.yTop), 0, 1); if (Math.abs(s.u - corridor(seg, aa)) < 0.13) continue; }
      const x = cxAt(L, G, seg, y) + (s.u - 0.5) * G.chan * 0.92;
      c.moveTo(x, y); c.lineTo(x, y + s.len * L.k);
    }
    c.lineWidth = 2 * L.k; c.strokeStyle = 'rgba(255,255,255,0.4)'; c.stroke();
    if (withObstacles) {
      for (const e of seg.eddies) drawEddy(c, xOf(L, G, seg, e.u, yOfA(G, e.a)), yOfA(G, e.a), 0.15 * G.ref, rm ? 0 : t * 2.2 * e.dir + e.ph, e.dir);
      for (const rk of seg.rocks) drawRock(c, xOf(L, G, seg, rk.u, yOfA(G, rk.a)), yOfA(G, rk.a), G.rockS, rk.big, rm ? 0 : t * 2 + rk.ph);
    }
    c.restore();
  }
  R.draw = (c, L, t, rm) => {
    const { W, H, k } = L, G = geo(L), seg = ensure(L);
    const turning = R.phase === 'turn', e = turning ? ease(R.turnT / RUN.turn) : 0;
    if (turning) {
      drawWorld(c, L, G, seg, H * e, t, rm, false);
      const nx = R.next && R.next.idx === R.segIdx + 1 ? R.next : (R.next = genSeg(L, R.segIdx + 1));
      drawWorld(c, L, G, nx, H * e - H, t, rm, true);
    } else drawWorld(c, L, G, seg, 0, t, rm, true);
    if (!raft || seg.valley) { if (R.phase !== 'turn') drawBeachParty(c, L, G); }
    // the raft
    const y = turning ? lerp(G.yBot, G.yTop, e) : yNow(L, G);
    const x = turning ? xOf(L, G, seg, R.u, G.yBot) : xOf(L, G, seg, R.u, y);
    const bob = rm ? 0 : Math.sin(t * 2.4) * 1.2;
    // a soft wake at the bow and sides
    c.beginPath();
    c.moveTo(x - G.hwPx * 1.05, y - G.rhPx * 0.4); c.quadraticCurveTo(x - G.hwPx * 1.2, y + G.rhPx * 1.2, x - G.hwPx * 0.8, y + G.rhPx * 2.2);
    c.moveTo(x + G.hwPx * 1.05, y - G.rhPx * 0.4); c.quadraticCurveTo(x + G.hwPx * 1.2, y + G.rhPx * 1.2, x + G.hwPx * 0.8, y + G.rhPx * 2.2);
    c.lineWidth = 2.6 * k; c.strokeStyle = 'rgba(255,255,255,0.6)'; c.stroke();
    drawRaft(c, x, y, G.rs, S.party ? S.party.wagon : { box: '#a0612b', wheel: '#7a4a26', cover: '#f6efdc', flag: null, name: '' }, R.ang, R.tiltNow || 0, bob, t, 0);
    // splashes
    for (const sp of R.splashes) { if (sp.t < 0) continue; const kk = sp.t / 0.85; c.globalAlpha = clamp(1 - kk, 0, 1); drawSplash(c, sp.x, sp.y, sp.r, kk); }
    c.globalAlpha = 1;
    // HUD: the hint to steer, chevrons at the raft's sides, the bends passed
    if (R.phase === 'ready' || (R.phase === 'drift' && R.bumps === 0 && R.segIdx === 0 && R.pt < 3)) {
      c.globalAlpha = rm ? 0.95 : 0.78 + 0.22 * Math.sin(t * 4);
      drawText(c, 'STEER!', 22 * k, W * 0.5, 30 * k, '#ffffff');
      c.globalAlpha = 1;
    }
    if (R.phase === 'ready' || (R.phase === 'drift' && R.pt < 2.4 && R.segIdx === 0)) {
      const pul = rm ? 0 : Math.sin(t * 5) * 4 * k;
      for (const d of [-1, 1]) {
        const ax = x + d * (G.hwPx + 30 * k + pul * d);
        c.beginPath(); c.moveTo(ax + d * 14 * k, y); c.lineTo(ax - d * 6 * k, y - 14 * k); c.lineTo(ax - d * 6 * k, y + 14 * k); c.closePath();
        c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 2.4 * k; c.strokeStyle = OUT; c.stroke();
      }
    }
    if (raft) {
      for (let n = 0; n < length; n++) {
        const fx = 22 * k + n * 22 * k, fy = 24 * k, done = n < R.bend;
        c.beginPath(); c.moveTo(fx, fy + 12 * k); c.lineTo(fx, fy - 12 * k); c.lineWidth = 2.4 * k; c.strokeStyle = OUT; c.stroke();
        c.beginPath(); c.moveTo(fx, fy - 12 * k); c.lineTo(fx + 14 * k, fy - 7 * k); c.lineTo(fx, fy - 1 * k); c.closePath();
        c.fillStyle = done ? '#ffd23f' : 'rgba(255,246,230,0.3)'; c.fill(); c.lineWidth = 1.8 * k; c.strokeStyle = OUT; c.stroke();
      }
    }
    if (R.phase === 'bend' && R.waiting) {
      c.globalAlpha = rm ? 0.9 : 0.7 + 0.3 * Math.sin(t * 3);
      drawText(c, 'BEND ' + R.bend + ' OF ' + length, 20 * k, W * 0.5, 30 * k, '#ffffff');
      c.globalAlpha = 1;
    }
    for (const tx of R.texts) {
      const a = clamp(tx.t < 1.4 ? 1 : (1.7 - tx.t) / 0.3, 0, 1), rise = rm ? 0 : tx.t * 16 * k;
      c.globalAlpha = a;
      drawText(c, tx.text, 24 * k, tx.x, tx.y - rise, tx.col);
      if (tx.sub) drawText(c, tx.sub, 14 * k, tx.x, tx.y - rise + 22 * k, '#ffffff');
    }
    c.globalAlpha = 1;
    // the vista: a side view of the valley fades in over the beach, the party cheering in front of it
    if (R.phase === 'vista' && R.vista) {
      const a = ease(R.vistaT / 1.1);
      c.globalAlpha = a;
      c.drawImage(R.vista.cv, 0, 0, W, H);
      const gy = L.gy, wx = Math.max(112 * k, W * 0.3 - 86 * k);
      drawTeam(c, wx + 96 * k, gy, k, S.party ? S.party.animal : 'oxen', 0, 0, false);
      drawWagon(c, wx, gy, k, S.party ? S.party.wagon : { box: '#a0612b', wheel: '#7a4a26', cover: '#f6efdc', flag: null, name: '' }, 0, 0, t);
      const P = S.party, cheer = S.cheerT > 0 ? 1.8 - S.cheerT : 0;
      if (P && P.looks) {
        const spots = [[wx + 268 * k, gy + 15 * k, 1], [wx + 312 * k, gy + 17 * k, -1], [wx - 92 * k, gy + 14 * k, 1]];
        for (let n = 0; n < 3 && n < P.looks.length; n++) drawPerson(c, spots[n][0], spots[n][1], k, P.looks[n], 0, 0, cheer > 0 ? cheer + n * 0.12 : 0.01 + ((t * 0.9 + n * 0.3) % 1) * 0.5 + 0.3, spots[n][2]);
      }
      drawText(c, 'OREGON!', 30 * k, W * 0.5, H * 0.2, '#ffd23f');
      c.globalAlpha = 1;
    }
  };

  // ---------------------------------------------------------------- state
  const r3 = (v) => Math.round(clamp(v, 0, 1) * 1000) / 1000;
  R.progress = () => {
    const total = raft ? length + 1 : 1;
    const inSeg = R.phase === 'drift' ? clamp(R.pt / (R.seg ? R.seg.dur : 1), 0, 1) : R.phase === 'ready' ? 0 : 1;
    if (R.ended) return 1;
    return r3((R.segIdx + inSeg) / total);
  };
  R.state = () => {
    if (!raft) return { kind: 'float', width, bumps: R.bumps, hits: R.bumps, progress: R.progress(), phase: R.phase, left: R.ended ? 0 : 1 };
    return { kind: 'raft', length, bend: R.bend, bumps: R.bumps, progress: R.progress(), phase: R.phase, waiting: R.waiting, left: length - R.bend };
  };
  R.summary = () => ({ ...R.state(), finished: R.ended });
  R.debug = (L) => {
    const G = geo(L), seg = ensure(L), y = yNow(L, G), a = R.phase === 'drift' ? R.pt / seg.dur : R.phase === 'ready' ? 0 : 1;
    return {
      ...R.state(), u: R.u, tu: R.tu, y, a, ang: R.ang, spins: R.spins, inEddy: R.inEddy, dur: seg.dur, seg: R.segIdx, valley: seg.valley,
      chan: G.chan, x0: cxAt(L, G, seg, y) - G.chan / 2, x: xOf(L, G, seg, R.u, y), hwU: G.hwU, uMin: G.uMin,
      route: Array.from({ length: 21 }, (_, i) => Math.round(corridor(seg, i / 20) * 1000) / 1000),
      rocks: seg.rocks.map((r) => ({ a: Math.round(r.a * 1000) / 1000, u: Math.round(r.u * 1000) / 1000, big: r.big, hit: r.hit })),
      eddies: seg.eddies.map((e) => ({ a: Math.round(e.a * 1000) / 1000, u: Math.round(e.u * 1000) / 1000, dir: e.dir })),
      yTop: G.yTop, yBot: G.yBot,
    };
  };
  return R;
}

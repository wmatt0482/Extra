// Trail geometry: pure functions of (trail, seed, opts), meters, +y UP, x = 0 at the trail head.
// Deterministic: the same trail + seed always gives the same hills, features, coins and props.
//
// The trail is a sequence of pieces: flat runs and hills (a cosine rise to a crest, a cosine fall to the next
// level). Hills get steeper with distance (trail.terrain.steep [start, end] = uphill max slope). Flat runs host
// the features: water crossings (a dip filled with water), wooden bridges over a ravine, kickers, and gates.
//
// groundY(x)  = the drivable surface (physics): terrain + water dips + kickers + bridge decks.
// terrainY(x) = the earth drawn under it (ravines under the bridges, no kicker).

import { TAU, mulberry32, hash2, clamp, smoothstep, lerp } from './util.js';
import { OBSTACLE_KINDS, SURFACES, trailGates } from '../data/trails.js';

export const CHUNK = 40; // physics / prop chunk (m)
export const SEG = 2; // terrain segment length (m)
export const START_X = 0; // the vehicle's centre at the trail head
// kicker: a circular ramp (radius R) rising to a lip at `ang`, then a short drop back to the ground
export const KICK = (() => {
  const R = 13, a = (21 * Math.PI) / 180;
  return { R, len: R * Math.sin(a), h: R * (1 - Math.cos(a)), back: 1.2, ang: a };
})();
export const SURF_IDS = ['dirt', 'mud', 'sand', 'ice', 'water'];
const SURF_INDEX = { dirt: 0, mud: 1, sand: 2, ice: 3, water: 4 };
const WATER_W = 17, WATER_D = 1.7, WATER_LEVEL = 0.4; // dip width, depth; water surface below the brim
const BRIDGE_DEPTH = 5.5;

export function createCourse(trail, seed, opts = {}) {
  const L = trail.length;
  const T = trail.terrain || {};
  const rng = mulberry32(hash2(seed | 0, 0x7a11));
  const [s0, s1] = T.steep || [0.25, 0.85];
  const amp = T.amplitude || 14;
  const rough = T.roughness || 0;

  // ---- features: evenly spread target positions (seeded order); each goes on the first flat run past it ----
  const feats = [];
  for (let i = 0; i < (trail.water | 0); i++) feats.push('water');
  for (let i = 0; i < (trail.bridges | 0); i++) feats.push('bridge');
  for (let i = 0; i < (trail.kickers | 0); i++) feats.push('kicker');
  for (let i = feats.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = feats[i]; feats[i] = feats[j]; feats[j] = t; }
  const featAt = feats.map((f, k) => ({ f, x: 70 + ((L - 150) * (k + 0.3 + rng() * 0.4)) / Math.max(1, feats.length) }));
  // gate slots: a longer flat run near each default gate position (the terrain is the same whatever gates
  // count a ride uses; with gates: 0 they are just flat stretches)
  const slotN = trailGates(trail);
  const slotAt = [];
  for (let k = 0; k < slotN; k++) slotAt.push((L * (k + 1)) / (slotN + 1));
  const gateSlots = [];

  // ---- lay out runs and hills until the trail is full ----
  const HEAD = 26; // flat trail head (x 0 .. HEAD)
  const featLen = { water: WATER_W + 14, bridge: 30, kicker: 34 };
  const pieces = [];
  const zones = []; // feature zones {x0, x1, type, ...}
  const waters = [], bridges = [], kickers = [];
  pieces.push({ x0: -1e4, x1: HEAD, kind: 'flat', a: 0, b: 0 });
  let x = HEAD, level = 0, fi = 0, si = 0;
  for (let i = 0; i < 200; i++) {
    if (i > 0) {
      let f = null, F = 6 + rng() * 12, gateSlot = false;
      let slotX = x + 15;
      if (fi < featAt.length && featAt[fi].x <= x + 30) { f = featAt[fi].f; F = featLen[f]; }
      if (si < slotAt.length && slotAt[si] <= x + 50) {
        // a gate slot (after the feature when this run has one)
        gateSlot = true;
        if (f) { slotX = x + F + 12; F += 28; } else F = Math.max(F, 30);
      }
      if (x + F > L - 20) break; // the final run takes what is left
      if (f) fi++;
      if (gateSlot) si++;
      pieces.push({ x0: x, x1: x + F, kind: 'flat', a: level, b: level, feat: f, gateSlot });
      if (gateSlot) gateSlots.push(slotX);
      if (f === 'water') {
        const w0 = x + (F - WATER_W) / 2;
        waters.push({ x0: w0, x1: w0 + WATER_W, level: level - WATER_LEVEL, base: level });
        zones.push({ x0: w0 - 4, x1: w0 + WATER_W + 4, type: 'water' });
      } else if (f === 'bridge') {
        const g0 = x + 7, g1 = x + F - 7;
        bridges.push({ x0: g0, x1: g1, y: level, depth: BRIDGE_DEPTH });
        zones.push({ x0: g0 - 3, x1: g1 + 3, type: 'bridge' });
      } else if (f === 'kicker') {
        const k0 = x + 3;
        kickers.push({ x0: k0, x1: k0 + KICK.len, x2: k0 + KICK.len + KICK.back, h: KICK.h, y: level });
        zones.push({ x0: k0 - 4, x1: x + F, type: 'kicker' });
      }
      x += F;
    }
    // the hill: height grows with distance (amplitude), so does the uphill slope (steep [start, end])
    const prog = clamp(x / L, 0, 1);
    let H = amp * (0.3 + 0.7 * Math.pow(prog, 0.9)) * (0.85 + rng() * 0.3);
    let s = lerp(s0, s1, Math.pow(prog, 1.1)) * (0.9 + rng() * 0.2);
    if (i === 0) { s = Math.min(s, s0); H = Math.min(H, amp * 0.3); }
    s = Math.min(s, 0.95);
    // the climb: eases in, a long straight pitch at slope s, eases out (momentum alone won't carry it)
    const run = H / s, ease = Math.min(0.5 * run, 4 + 0.15 * run);
    const up = run + ease;
    // where it comes down: drift the level a little, pulled back toward 0 (the trail stays in a band)
    let drop = H * (0.6 + rng() * 0.6) + level * 0.15;
    drop = clamp(drop, H * 0.4, H + 12);
    const down = Math.max(up * 0.8, (Math.PI * drop) / (2 * 0.72));
    if (x + up + down > L - 50) break; // no room left: the last run carries on to the finish
    pieces.push({ x0: x, x1: x + up + down, kind: 'hill', a: level, H, xc: x + up, up, down, b: level + H - drop, s, e: ease, m: run - ease });
    x += up + down;
    level = level + H - drop;
  }
  // features and gate slots that did not fit before the last hill go on the final run, in order
  let tail = x + 8;
  while (fi < featAt.length || si < slotAt.length) {
    const gateNext = si < slotAt.length && (fi >= featAt.length || slotAt[si] <= featAt[fi].x);
    if (gateNext) {
      if (tail + 12 > L - 10) break;
      gateSlots.push(tail + 12);
      si++;
      tail += 34;
      continue;
    }
    const f = featAt[fi++].f, F = featLen[f];
    if (tail + F > L - 10) continue;
    if (f === 'water') { const w0 = tail + (F - WATER_W) / 2; waters.push({ x0: w0, x1: w0 + WATER_W, level: level - WATER_LEVEL, base: level }); zones.push({ x0: w0 - 4, x1: w0 + WATER_W + 4, type: 'water' }); }
    else if (f === 'bridge') { bridges.push({ x0: tail + 7, x1: tail + F - 7, y: level, depth: BRIDGE_DEPTH }); zones.push({ x0: tail + 4, x1: tail + F - 4, type: 'bridge' }); }
    else { kickers.push({ x0: tail + 3, x1: tail + 3 + KICK.len, x2: tail + 3 + KICK.len + KICK.back, h: KICK.h, y: level }); zones.push({ x0: tail - 1, x1: tail + F, type: 'kicker' }); }
    tail += F + 2;
  }
  // last run to the finish and beyond
  const endX = x;
  pieces.push({ x0: x, x1: 1e6, kind: 'flat', a: level, b: level, end: true });
  const finishLevel = level;
  const finishX = L;

  // roughness: two small octaves, faded in and out across each hill
  const rp1 = rng() * TAU, rp2 = rng() * TAU;
  const rA1 = 0.32 * rough, rA2 = 0.16 * rough;

  // piece lookup (pieces are contiguous and sorted)
  let lastPi = 0;
  function pieceAt(xx) {
    let i = lastPi;
    if (xx < pieces[i].x0 || xx >= pieces[i].x1) {
      let lo = 0, hi = pieces.length - 1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pieces[m].x0 <= xx) lo = m; else hi = m - 1; }
      i = lo;
      lastPi = i;
    }
    return pieces[i];
  }

  function baseY(xx) {
    const p = pieceAt(xx);
    let y;
    if (p.kind === 'flat') {
      y = p.a;
      if (waters.length) {
        const w = waterAt(xx);
        if (w) y -= (WATER_D * (1 - Math.cos(((xx - w.x0) / WATER_W) * TAU))) / 2;
      }
    } else {
      if (xx < p.xc) {
        const t = xx - p.x0, e = p.e, sl = p.s;
        if (t < e) y = p.a + (sl / 2) * (t - (e / Math.PI) * Math.sin((Math.PI * t) / e));
        else if (t < e + p.m) y = p.a + (sl * e) / 2 + sl * (t - e);
        else { const t2 = t - e - p.m; y = p.a + (sl * e) / 2 + sl * p.m + (sl / 2) * (t2 + (e / Math.PI) * Math.sin((Math.PI * t2) / e)); }
      } else {
        const v = (xx - p.xc) / p.down;
        y = p.a + p.H - ((p.a + p.H - p.b) * (1 - Math.cos(Math.PI * v))) / 2;
      }
      if (rough > 0) {
        const fade = Math.sin((Math.PI * (xx - p.x0)) / (p.x1 - p.x0));
        y += fade * (rA1 * Math.sin(xx * 0.676 + rp1) + rA2 * Math.sin(xx * 1.23 + rp2));
      }
    }
    // berms: behind the trail head and well past the finish
    if (xx < -14) y += 0.09 * (-14 - xx) * (-14 - xx);
    if (xx > finishX + 90) y += 0.06 * (xx - finishX - 90) * (xx - finishX - 90);
    return y;
  }

  function kickH(xx) {
    for (let i = 0; i < kickers.length; i++) {
      const k = kickers[i];
      if (xx <= k.x0 || xx >= k.x2) continue;
      if (xx <= k.x1) { const d = xx - k.x0; return KICK.R - Math.sqrt(KICK.R * KICK.R - d * d); }
      return k.h * (1 - (xx - k.x1) / KICK.back);
    }
    return 0;
  }
  const groundY = (xx) => baseY(xx) + kickH(xx);
  // the earth under it: a ravine under each bridge
  function terrainY(xx) {
    const y = baseY(xx);
    for (let i = 0; i < bridges.length; i++) {
      const b = bridges[i];
      if (xx > b.x0 - 0.2 && xx < b.x1 + 0.2) {
        const m = smoothstep(b.x0 - 0.2, b.x0 + 1.6, xx) * (1 - smoothstep(b.x1 - 1.6, b.x1 + 0.2, xx));
        return y - b.depth * m;
      }
    }
    return y;
  }
  // slope for control logic: over a kicker's back drop it keeps the lip's slope
  function groundSlope(xx) {
    for (let i = 0; i < kickers.length; i++) {
      const k = kickers[i];
      if (xx > k.x1 - 0.05 && xx < k.x2 + 0.05) xx = k.x1 - 0.06;
    }
    return (groundY(xx + 0.05) - groundY(xx - 0.05)) / 0.1;
  }
  function kickerAt(xx, margin = 0) {
    for (const k of kickers) if (xx >= k.x0 - margin && xx <= k.x2 + margin) return k;
    return null;
  }
  function waterAt(xx) {
    for (let i = 0; i < waters.length; i++) { const w = waters[i]; if (xx > w.x0 && xx < w.x1) return w; }
    return null;
  }
  function bridgeAt(xx) {
    for (let i = 0; i < bridges.length; i++) { const b = bridges[i]; if (xx > b.x0 && xx < b.x1) return b; }
    return null;
  }
  function inZone(xx, pad = 0) {
    for (const z of zones) if (xx > z.x0 - pad && xx < z.x1 + pad) return z;
    return null;
  }
  const maxAbsSlope = (xa, xb) => {
    let m = 0;
    for (let xx = xa; xx <= xb; xx += 1) m = Math.max(m, Math.abs(groundSlope(xx)));
    return m;
  };

  // ---- surface patches (mud / sand / ice) ----
  const patches = [];
  {
    const kinds = (trail.patches || []).filter((k) => SURFACES[k]);
    const pr = mulberry32(hash2(seed | 0, 0x9a7c));
    let px = 55 + pr() * 40;
    while (kinds.length && px < finishX - 30) {
      const len = 8 + pr() * 12;
      const kind = kinds[Math.floor(pr() * kinds.length)];
      let ok = !inZone(px, 3) && !inZone(px + len, 3) && maxAbsSlope(px, px + len) < 0.42;
      if (ok) patches.push({ x0: px, x1: px + len, kind, id: SURF_INDEX[kind] });
      px += ok ? 70 + pr() * 80 : 9;
    }
  }
  // surface index under x (see SURF_IDS); water wins over patches
  function surfaceAt(xx) {
    if (waters.length) { const w = waterAt(xx); if (w && groundY(xx) < w.level + 0.05) return 4; }
    for (let i = 0; i < patches.length; i++) { const p = patches[i]; if (xx >= p.x0 && xx <= p.x1) return p.id; }
    return 0;
  }

  // ---- gates: evenly spaced targets, nudged onto the flattest nearby ground ----
  const gateCount = trailGates(trail, opts.gates);
  const gates = [];
  {
    // candidates: the gate slots, then any other plain flat run long enough to park on
    const cands = gateSlots.slice();
    for (const p of pieces) {
      if (p.kind !== 'flat' || p.feat || p.gateSlot || p.x0 < 40 || p.x1 > finishX - 30 || p.x1 - p.x0 < 12) continue;
      cands.push(p.x0 + Math.min(15, p.x1 - p.x0 - 4));
    }
    const used = new Set();
    for (let k = 0; k < gateCount; k++) {
      const target = (finishX * (k + 1)) / (gateCount + 1);
      const prevX = gates.length ? gates[gates.length - 1].x : -1e9;
      let best = -1, bd = Infinity;
      for (let i = 0; i < cands.length; i++) {
        const cx = cands[i];
        if (used.has(i) || cx - prevX < 60 || cx > finishX - 10) continue;
        const d = Math.abs(cx - target);
        if (d < bd && d < 130) { bd = d; best = i; }
      }
      let gx = null;
      if (best >= 0) { used.add(best); gx = cands[best]; }
      else {
        // fallback: the flattest ground near the target
        let bestCost = 0.2; // nothing steeper than this: a gate is never parked on a climb
        for (let tx = Math.round(target - 90); tx <= target + 90; tx += 1) {
          if (tx < 45 || tx > finishX - 30 || tx - prevX < 60) continue;
          if (inZone(tx, 12) || inZone(tx - 14, 2)) continue;
          const cost = maxAbsSlope(tx - 8, tx + 3) + 0.001 * Math.abs(tx - target);
          if (cost < bestCost) { bestCost = cost; gx = tx; }
        }
      }
      if (gx == null) continue;
      gates.push({ index: gates.length, x: gx, y: groundY(gx) });
      zones.push({ x0: gx - 16, x1: gx + 5, type: 'gate' });
    }
  }

  // ---- trail coins: rows hovering over the ground, every ~55-85 m, plus an arc over each kicker ----
  const coins = [];
  {
    const cr = mulberry32(hash2(seed | 0, 0xc017));
    let cx = 34 + cr() * 10;
    let id = 0;
    while (cx < finishX - 12) {
      const n = 4 + Math.floor(cr() * 3);
      for (let j = 0; j < n; j++) {
        const xx = cx + j * 2.3;
        if (xx > finishX - 6) break;
        const z = inZone(xx, 1);
        if (z && z.type !== 'bridge') continue;
        coins.push({ id: id++, x: xx, y: groundY(xx) + 1.05, r: 0.42 });
      }
      cx += 55 + cr() * 30;
    }
    for (const k of kickers) {
      const ang = KICK.ang;
      let px = k.x1, py = k.y + KICK.h + 1.0, vx = 12 * Math.cos(ang), vy = 12 * Math.sin(ang);
      const h = 0.05;
      let n = 0;
      for (let t = 0; t < 3 && n < 6; t += h) {
        px += vx * h; py += vy * h; vy -= 9.81 * h;
        if (t > 0.12 && Math.round(t / h) % 4 === 0) { coins.push({ id: id++, x: px, y: py, r: 0.42, air: true }); n++; }
        if (py < groundY(px) + 1) break;
      }
    }
    coins.sort((a, b) => a.x - b.x);
  }

  // ---- props per chunk (order-independent seed), kept clear of features and gates ----
  const pkinds = (trail.props || []).filter((k) => OBSTACLE_KINDS[k]);
  function propsInChunk(ci) {
    const out = [];
    if (ci < 0 || !pkinds.length) return out;
    const x0 = ci * CHUNK, x1 = x0 + CHUNK;
    const rand = mulberry32(hash2(seed | 0, ci * 7919 + 17));
    let px = x0 + rand() * 22;
    let n = 0;
    while (px < x1) {
      if (px > 30 && px < finishX - 10) {
        const kind = pkinds[Math.floor(rand() * pkinds.length)];
        const def = OBSTACLE_KINDS[kind];
        const sl = Math.abs(groundSlope(px));
        const ok = !inZone(px, def.w + 2) && !kickerAt(px, 3) && sl < (def.flat ? 0.12 : 0.4);
        if (ok) out.push({ id: ci * 100 + n++, kind, x: px });
      }
      px += 16 + rand() * 26;
    }
    return out;
  }

  // physics polyline breakpoints in [xa, xb): the SEG grid, refined on kickers and water dips
  function terrainXs(xa, xb) {
    const out = [];
    for (let xx = xa; xx < xb - 1e-6; xx += SEG) {
      const fine = kickerAt(xx + SEG / 2, SEG) || waterAt(xx) || waterAt(xx + SEG);
      if (!fine) { out.push(xx); continue; }
      for (let u = xx; u < xx + SEG - 1e-6; u += 0.5) out.push(u);
      const k = kickerAt(xx + SEG / 2, SEG);
      if (k) for (const e of [k.x1, k.x1 + 0.02]) if (e > xx && e < xx + SEG) out.push(e);
    }
    out.sort((a, b) => a - b);
    out.push(xb);
    return out;
  }

  return {
    trail, seed, length: L, finishX, finishLevel, startX: START_X,
    pieces, zones, waters, bridges, kickers, gates, coins, patches,
    groundY, terrainY, baseY, groundSlope, surfaceAt, waterAt, bridgeAt, kickerAt, inZone,
    propsInChunk, terrainXs,
  };
}

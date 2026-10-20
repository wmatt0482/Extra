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
  if (opts.race && trail.mx) { const c = createMxCourse(trail, seed, opts); return opts.mirror ? mirrorCourse(c) : c; }
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

// =====================================================================================================
// v1.1 race mode: motocross tracks (trail.mx). A rhythm of features built for speed and air: start straight
// with a drop gate, doubles, tabletops, step-ups / step-downs, whoops, one big jump, berms (flat, speed-holding
// banked turns), sprints, checkpoints every ~100 m and the finish line. The profile is sampled every DX m.
// Every jump is shaped for a *design rider* (trail.mx.design = upgrade level) that this generator simulates in
// 1-D with the engine's race drive model as it lays the track out: the landing slope sits where that rider's
// full-throttle arc comes down, so the design rider clears it, slower riders case it, faster ones land deeper.
// =====================================================================================================

export const RACE = { driveA: 9, driveExp: 0.6, curve: 3, vTop: 26.4, vTopExp: 0.5, mu: 1.0, roll: 0.25, drag: 0.002 };
// stats for an upgrade level 0..10 (the same mapping dev.html uses; main.js owns the real one)
export function levelStats(L) {
  return { power: 1 + 0.12 * L, grip: 1 + 0.06 * L, suspension: 1 + 0.14 * L, boostPower: 1 + 0.15 * L, boostCapacity: 1 + 0.15 * L, coinMult: 1 + 0.05 * L };
}
export function raceTop(stats) { return RACE.vTop * Math.pow(stats.power, RACE.vTopExp); }
const DX = 0.25;
const G9 = 9.81;
export const GAP_DEPTH = 11; // v1.5 Sky Bridge: a double whose gap is a pit this deep (falling in = crash + respawn)

function createMxCourse(trail, seed, opts) {
  const L = trail.length;
  const mx = trail.mx;
  const rng = mulberry32(hash2(seed | 0, 0x3c55));
  const X0 = -80, X1 = L + 300;
  const N = Math.ceil((X1 - X0) / DX) + 2;
  const H = new Float32Array(N);
  const fi = (x) => (x - X0) / DX;
  function hAt(x) {
    const f = fi(x);
    let i = Math.floor(f);
    if (i < 0) return H[0];
    if (i >= N - 1) return H[N - 1];
    const t = f - i;
    return H[i] * (1 - t) + H[i + 1] * t;
  }
  // write y = fn(x) over [xa, xb]
  function fill(xa, xb, fn) {
    const i0 = Math.max(0, Math.ceil(fi(xa) - 1e-6)), i1 = Math.min(N - 1, Math.floor(fi(xb) + 1e-6));
    for (let i = i0; i <= i1; i++) H[i] = fn(X0 + i * DX);
  }
  // integrate a slope profile k(u) (u = x - x0, slope = dy/dx) from y0 over [x0, x0 + len]; returns the end y
  function fillSlope(x0, len, y0, k) {
    let y = y0;
    const i0 = Math.ceil(fi(x0) - 1e-6), i1 = Math.min(N - 1, Math.floor(fi(x0 + len) + 1e-6));
    let xPrev = x0;
    for (let i = i0; i <= i1; i++) {
      const x = X0 + i * DX;
      y += k((x + xPrev) / 2 - x0) * (x - xPrev);
      H[i] = y;
      xPrev = x;
    }
    return y + k(len) * (x0 + len - xPrev);
  }
  const ease01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  // v1.5: low-gravity worlds (Moon Base) fly far: the arcs use the trail's gravity and the takeoffs are shallower
  const grav = clamp(Number(trail.gravity) || 1, 0.25, 1.5);
  const gEff = G9 * grav;
  const lowG = grav < 0.85;
  let gapsLeft = trail.gaps | 0;

  // ---- the design rider (1-D, the engine's race drive model) ----
  const dLvl = mx.design || 0;
  const dS = levelStats(dLvl);
  const dTop = raceTop(dS), dA = RACE.driveA * Math.pow(dS.power, RACE.driveExp);
  const dMu = RACE.mu * dS.grip * (trail.grip || 1);
  let v = 0;
  function simGround(xa, xb) {
    for (let x = xa; x < xb; x += DX) {
      const sl = (hAt(x + DX) - hAt(x)) / DX;
      const c = 1 / Math.sqrt(1 + sl * sl), sn = sl * c;
      const aEng = dA * Math.max(0, 1 - Math.pow(v / dTop, RACE.curve));
      const a = Math.min(aEng, dMu * gEff * c) - gEff * sn - RACE.roll - RACE.drag * v * v;
      v = Math.sqrt(Math.max(0.5, v * v + (2 * a * DX) / c));
    }
  }
  // ballistic arc of the contact point from (x, y) at speed vv, angle ang; points every 1/120 s
  function arc(x, y, vv, ang) {
    const pts = [];
    let vx = vv * Math.cos(ang), vy = vv * Math.sin(ang);
    const h = 1 / 120;
    for (let t = 0; t < 5; t += h) {
      pts.push(x, y, vx, vy);
      const sp = Math.hypot(vx, vy), k = RACE.drag * sp;
      vx -= k * vx * h; vy -= (gEff + k * vy) * h;
      x += vx * h; y += vy * h;
      if (vy < 0 && y < -60) break;
    }
    return pts;
  }

  const features = [], zones = [], checkCands = [], berms = [], waters = [], bridges = [], arcs = [];
  let x = -80, level = 0;
  // start straight (the drop gate stands at START_GATE)
  fill(-80, 40, (xx) => (xx < -20 ? 0.12 * (-20 - xx) * (-20 - xx) * 0.5 : 0));
  x = 40;
  simGround(0, 40);
  checkCands.push({ x: 0, y: 0 });

  function sprint(len, opt = {}) {
    // gentle rise or fall that steers the level back toward 0 (the track stays in a band)
    const rise = opt.flat ? 0 : clamp(-level * 0.5 + (rng() - 0.5) * 2, -4, 4);
    const y0 = level;
    fill(x, x + len, (xx) => y0 + rise * ease01((xx - x) / len));
    const f = { type: opt.type || 'sprint', x0: x, x1: x + len };
    features.push(f);
    if (opt.type === 'water') {
      const w0 = x + (len - 14) / 2;
      fill(w0, w0 + 14, (xx) => y0 + rise * ease01((xx - x) / len) - 0.75 * (1 - Math.cos(((xx - w0) / 14) * TAU)) / 2);
      waters.push({ x0: w0, x1: w0 + 14, level: y0 + rise * ease01((w0 + 7 - x) / len) - 0.2, base: y0 });
      zones.push({ x0: w0 - 3, x1: w0 + 17, type: 'water' });
    } else if (opt.type === 'bridge') {
      bridges.push({ x0: x + 5, x1: x + len - 5, y: y0, depth: 5.5 });
      zones.push({ x0: x + 2, x1: x + len - 2, type: 'bridge' });
      fill(x, x + len, () => y0);
    } else if (opt.type === 'berm') {
      berms.push({ x0: x, x1: x + len, y: y0 });
      zones.push({ x0: x, x1: x + len, type: 'berm' });
    }
    if (opt.type !== 'water' && opt.type !== 'bridge') checkCands.push({ x: x + len * 0.5 });
    simGround(x, x + len);
    if (opt.type === 'water') v = Math.max(4, v - 0.7 * 14 * (1 + 0.05 * v) / Math.max(4, v));
    x += len;
    level = y0 + (opt.type === 'bridge' ? 0 : rise);
  }
  function whoops(n) {
    const wl = 4.6, h = 0.7, y0 = level, xs = x;
    const len = n * wl;
    fill(xs, xs + len, (xx) => y0 + h * (1 - Math.cos(((xx - xs) / wl) * TAU)) / 2);
    features.push({ type: 'whoops', x0: xs, x1: xs + len, n });
    zones.push({ x0: xs - 2, x1: xs + len + 2, type: 'whoops' });
    simGround(xs, xs + len);
    v *= 0.9; // the real ranger skips across them and loses a little more
    x += len;
  }
  // takeoff ramp: circular face of height ht ending at angle th; returns the lip
  function takeoff(ht, th) {
    const R = ht / (1 - Math.cos(th)), Lt = R * Math.sin(th), y0 = level, xs = x;
    fill(xs, xs + Lt, (xx) => { const d = xx - xs; return y0 + R - Math.sqrt(Math.max(0, R * R - d * d)); });
    simGround(xs, xs + Lt);
    x = xs + Lt;
    return { x: xs + Lt, y: y0 + ht, th, x0: xs };
  }
  // the landing downslope from (xp, yp): slope eases in over 2 m, holds sd, eases out over the last 5 m
  function downslope(xp, yp, Ld, sd) {
    return fillSlope(xp, Ld, yp, (u) => -sd * (u < 2 ? u / 2 : u > Ld - 5 ? Math.max(0, (Ld - u) / 5) : 1));
  }
  // where the arc comes down through height yt (descending); null if it never reaches it
  function arcCross(pts, yt) {
    for (let i = 4; i < pts.length; i += 4) if (pts[i + 3] < 0 && pts[i + 1] <= yt) return { x: pts[i], vx: pts[i + 2], vy: pts[i + 3] };
    return null;
  }
  function apexY(pts) { let m = -1e9; for (let i = 1; i < pts.length; i += 4) m = Math.max(m, pts[i]); return m; }

  function jump(kind) {
    const big = kind === 'big';
    const ht = (big ? 3.2 : kind === 'stepdown' ? 1.1 : 1.6 + rng() * 0.8) * (lowG ? Math.sqrt(grav) : 1);
    const th = (((big ? 30 : kind === 'stepdown' ? 16 : 22 + rng() * 6) * Math.PI) / 180) * (lowG ? Math.pow(grav, 0.75) : 1);
    const xStart = x, lvl0 = level;
    const lip = takeoff(ht, th);
    // design lip speed: the sim, a touch under (margin), capped at what the real Ranger reaches between jumps
    const vd = Math.min(v * 0.96, 24.5 + 0.35 * Math.min(dLvl, 22));
    // the real Ranger leaves a little flatter than the lip (wheelbase, suspension): calibrated from probe flights
    const pts = arc(lip.x, lip.y, vd, th - 0.035);
    arcs.push({ x: lip.x, y: lip.y, v: vd, th, pts });
    const sd = 0.42 + rng() * 0.08;
    const f = 0.32; // aim a third of the way down the landing slope
    let land = null, xEnd;
    if (kind === 'double' || big) {
      const hl = ht * (0.85 + rng() * 0.15) + (big ? 0.6 : 0);
      const yp = lvl0 + hl;
      const g0 = arcCross(pts, lvl0);
      const Ld = clamp((g0 ? g0.x - lip.x : 30) * 0.55 + (big ? 4 : 0), 14, 28);
      land = arcCross(pts, yp - sd * f * Ld);
      const backLen = ht / 1.4;
      if (land) {
        const xpe = land.x - f * Ld;
        const faceLen = (1.5 * hl) / 0.6;
        const xls = xpe - 1.2 - faceLen;
        if (xls > lip.x + backLen + 2) {
          fill(lip.x, lip.x + backLen, (xx) => lip.y - ht * ease01((xx - lip.x) / backLen));
          // v1.5 Sky Bridge: some doubles have no ground between the lip and the landing (a pit with steep walls)
          const pit = gapsLeft > 0 && !big && xls - (lip.x + backLen) > 8 && rng() < 0.75;
          if (pit) {
            gapsLeft--;
            const g0 = lip.x + backLen, g1 = xls;
            fill(g0, g1, (xx) => lvl0 - GAP_DEPTH * ease01((xx - g0) / 2.5) * ease01((g1 - xx) / 2.5));
            zones.push({ x0: g0, x1: g1, type: 'gap', floor: lvl0 - GAP_DEPTH });
          } else fill(lip.x + backLen, xls, () => lvl0);
          fill(xls, xls + faceLen, (xx) => lvl0 + hl * ease01((xx - xls) / faceLen));
          fill(xls + faceLen, xpe, () => yp);
          const yEnd = downslope(xpe, yp, Ld, sd);
          xEnd = xpe + Ld;
          features.push({ type: big ? 'big' : 'double', x0: xStart, x1: xEnd, lip: lip.x, land: land.x, gap: xls - lip.x, pit });
          level = yEnd;
        } else kind = 'table';
      } else kind = 'table';
    }
    if (kind === 'table' || kind === 'stepdown') {
      const top = kind === 'stepdown' ? lip.y - 0.4 : lip.y;
      const Ld = kind === 'stepdown' ? 18 : 14;
      land = arcCross(pts, top - sd * f * Ld);
      let xpe = land ? land.x - f * Ld : lip.x + 8;
      xpe = Math.max(xpe, lip.x + 5);
      fill(lip.x, xpe, (xx) => (kind === 'stepdown' ? lip.y - 0.4 * ease01((xx - lip.x) / 2) : lip.y));
      const yEnd = downslope(xpe, top, Ld, sd);
      xEnd = xpe + Ld;
      features.push({ type: kind, x0: xStart, x1: xEnd, lip: lip.x, land: land ? land.x : xpe });
      level = yEnd;
    } else if (kind === 'stepup') {
      let yp = lip.y + 1.2 + rng() * 0.8;
      const apex = apexY(pts);
      if (apex < yp + 0.8) yp = apex - 0.8;
      land = arcCross(pts, yp);
      const xl = land ? land.x : lip.x + 10;
      const xf = Math.max(lip.x + 1.5 + Math.max(4, (1.5 * (yp - lvl0)) / 0.6), xl - 7); // the arc lands ~7 m onto the top
      const faceLen = Math.max(4, (1.5 * (yp - lvl0)) / 0.6); // climbable when you come up short
      fill(lip.x, lip.x + 1.5, (xx) => lip.y - (lip.y - lvl0) * ease01((xx - lip.x) / 1.5));
      fill(lip.x + 1.5, xf - faceLen, () => lvl0);
      fill(xf - faceLen, xf, (xx) => lvl0 + (yp - lvl0) * ease01((xx - xf + faceLen) / faceLen));
      fill(xf, xl + 14, () => yp);
      xEnd = xl + 14;
      features.push({ type: 'stepup', x0: xStart, x1: xEnd, lip: lip.x, land: xl });
      level = yp;
    }
    zones.push({ x0: xStart - 3, x1: xEnd + 2, type: 'jump' });
    // the design rider lands: keeps the speed along the ground, then rolls on
    if (land) {
      const sl = (hAt(land.x + 0.2) - hAt(land.x - 0.2)) / 0.4, n = Math.hypot(1, sl);
      v = Math.max(4, (land.vx + land.vy * sl) / n);
      simGround(land.x, xEnd);
    } else simGround(lip.x, xEnd);
    x = xEnd;
  }

  // ---- the feature schedule ----
  const W = mx.mix || { double: 3, table: 2, stepup: 1, stepdown: 1, whoops: 1.5, berm: 1.2 };
  const keys = Object.keys(W), wsum = keys.reduce((a, k) => a + W[k], 0);
  const pick = () => { let r = rng() * wsum; for (const k of keys) { if ((r -= W[k]) <= 0) return k; } return keys[0]; };
  let waterLeft = trail.water | 0, bridgeLeft = trail.bridges | 0;
  let bigDone = false, lastKind = 'sprint';
  sprint(16 + rng() * 8, { flat: true });
  while (x < L - 70) {
    if (!bigDone && x > L * 0.58) { sprint(50 + rng() * 15); jump('big'); bigDone = true; lastKind = 'big'; continue; }
    let k = pick();
    if (k === lastKind && (k === 'whoops' || k === 'berm')) k = 'double';
    if (k === 'berm') { sprint(18 + rng() * 6, { type: 'berm', flat: true }); }
    else if (k === 'whoops') { sprint(14 + rng() * 10); whoops(6 + Math.floor(rng() * 5)); }
    else {
      // a creek or a bridge now and then, always a clean run-up before the jump
      if (waterLeft > 0 && rng() < 0.4) { sprint(28, { type: 'water' }); waterLeft--; }
      else if (bridgeLeft > 0 && rng() < 0.35) { sprint(30, { type: 'bridge', flat: true }); bridgeLeft--; }
      sprint(24 + rng() * 18);
      if (x > L - 70) break;
      jump(k);
    }
    lastKind = k;
  }
  // the finish straight and the runout (a berm wall well past the line)
  const yF = level;
  fill(x, X1, (xx) => yF + (xx > L + 120 ? 0.08 * (xx - L - 120) * (xx - L - 120) : 0));
  features.push({ type: 'finish', x0: x, x1: L + 120 });
  checkCands.push({ x: (x + L) / 2 });
  simGround(x, L);

  // ---- checkpoints: on flat stretches near every 100 m ----
  const checkpoints = [{ index: 0, x: 0, y: 0 }];
  for (let k = 1; k * 100 < L - 30; k++) {
    let best = null, bd = 60;
    for (const c of checkCands) {
      const d = Math.abs(c.x - k * 100);
      if (d < bd && c.x > checkpoints[checkpoints.length - 1].x + 40 && c.x < L - 15) { bd = d; best = c; }
    }
    if (best) checkpoints.push({ index: checkpoints.length, x: best.x, y: hAt(best.x) });
  }

  const groundY = (xx) => hAt(xx);
  function groundSlope(xx) { return (hAt(xx + 0.15) - hAt(xx - 0.15)) / 0.3; }
  function terrainY(xx) {
    const y = hAt(xx);
    for (let i = 0; i < bridges.length; i++) {
      const b = bridges[i];
      if (xx > b.x0 - 0.2 && xx < b.x1 + 0.2) {
        const m = smoothstep(b.x0 - 0.2, b.x0 + 1.6, xx) * (1 - smoothstep(b.x1 - 1.6, b.x1 + 0.2, xx));
        return y - b.depth * m;
      }
    }
    return y;
  }
  function waterAt(xx) { for (let i = 0; i < waters.length; i++) { const w = waters[i]; if (xx > w.x0 && xx < w.x1) return w; } return null; }
  function bridgeAt(xx) { for (let i = 0; i < bridges.length; i++) { const b = bridges[i]; if (xx > b.x0 && xx < b.x1) return b; } return null; }
  function bermAt(xx) { for (let i = 0; i < berms.length; i++) { const b = berms[i]; if (xx > b.x0 && xx < b.x1) return b; } return null; }
  function inZone(xx, pad = 0) { for (const z of zones) if (xx > z.x0 - pad && xx < z.x1 + pad) return z; return null; }
  const kickerAt = () => null;

  // ---- surface patches on sprints ----
  const patches = [];
  {
    const kinds = (trail.patches || []).filter((k) => SURFACES[k]);
    const pr = mulberry32(hash2(seed | 0, 0x9a7d));
    for (const f of features) {
      if (f.type !== 'sprint' || !kinds.length || f.x1 - f.x0 < 20 || pr() > 0.35) continue;
      const len = Math.min(12, f.x1 - f.x0 - 8), a = f.x0 + 4;
      const kind = kinds[Math.floor(pr() * kinds.length)];
      patches.push({ x0: a, x1: a + len, kind, id: SURF_INDEX[kind] });
    }
  }
  function surfaceAt(xx) {
    if (waters.length) { const w = waterAt(xx); if (w && hAt(xx) < w.level + 0.05) return 4; }
    for (let i = 0; i < patches.length; i++) { const p = patches[i]; if (xx >= p.x0 && xx <= p.x1) return p.id; }
    return 0;
  }

  // ---- math gates (v1.2: only when a race asks for them): on flat sprints near evenly spaced targets, never on a
  // jump face or a landing; the engine glides the player to a stop in front of the sign, so a gate can follow a jump
  const gateCount = opts.gates == null ? 0 : trailGates(trail, opts.gates);
  const gates = [];
  {
    const cands = [];
    for (const f of features) {
      if (f.type !== 'sprint' || f.x1 - f.x0 < 22 || f.x0 < 60 || f.x1 > L - 12) continue;
      const len = f.x1 - f.x0;
      cands.push(f.x0 + clamp(len * 0.55, 12, len - 6));
    }
    const used = new Set();
    for (let k = 0; k < gateCount; k++) {
      const target = (L * (k + 1)) / (gateCount + 1);
      const prev = gates.length ? gates[gates.length - 1].x : -1e9;
      let best = -1, bd = Infinity;
      for (let i = 0; i < cands.length; i++) {
        if (used.has(i) || cands[i] - prev < 50) continue;
        const d = Math.abs(cands[i] - target);
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) continue;
      used.add(best);
      gates.push({ index: gates.length, x: cands[best], y: hAt(cands[best]) });
    }
  }

  // ---- coins: rows on sprints, arcs over the jumps along the design line ----
  const coins = [];
  {
    const cr = mulberry32(hash2(seed | 0, 0xc018));
    let id = 0;
    for (const f of features) {
      if (f.type !== 'sprint' || f.x1 - f.x0 < 18 || cr() > 0.6) continue;
      const n = 4 + Math.floor(cr() * 2), x0 = f.x0 + 4;
      for (let j = 0; j < n; j++) { const xx = x0 + j * 2.4; if (!waterAt(xx)) coins.push({ id: id++, x: xx, y: hAt(xx) + 1.05, r: 0.42 }); }
    }
    for (const a of arcs) {
      const P = a.pts, n = P.length / 4;
      for (let j = 0; j < 5; j++) {
        const i = Math.floor(n * (0.12 + j * 0.07)) * 4;
        if (i + 1 < P.length && P[i + 1] > hAt(P[i]) + 1.5) coins.push({ id: id++, x: P[i], y: P[i + 1] + 0.9, r: 0.42, air: true });
      }
    }
    coins.sort((p, q) => p.x - q.x);
  }

  // ---- props: a cone or a hay bale here and there on the sprints ----
  const pkinds = (trail.props || []).filter((k) => OBSTACLE_KINDS[k] && !OBSTACLE_KINDS[k].flat);
  const propList = [];
  {
    const pr = mulberry32(hash2(seed | 0, 0x9709));
    let id = 0;
    for (const f of features) {
      if (f.type !== 'sprint' || f.x1 - f.x0 < 20 || pr() > 0.45 || !pkinds.length) continue;
      const px = f.x0 + 6 + pr() * (f.x1 - f.x0 - 12);
      if (Math.abs(groundSlope(px)) < 0.2 && !waterAt(px) && !bridgeAt(px)) propList.push({ id: id++, kind: pkinds[Math.floor(pr() * pkinds.length)], x: px });
    }
  }
  function propsInChunk(ci) {
    const x0 = ci * CHUNK, x1 = x0 + CHUNK;
    return propList.filter((p) => p.x >= x0 && p.x < x1).map((p) => ({ ...p, id: 5e5 + p.id }));
  }

  function terrainXs(xa, xb) {
    const out = [];
    for (let xx = xa; xx < xb - 1e-6; xx += SEG) {
      const z = inZone(xx + SEG / 2, 1);
      if (!z || z.type === 'berm' || z.type === 'bridge') { out.push(xx); continue; }
      for (let u = xx; u < xx + SEG - 1e-6; u += 0.5) out.push(u);
    }
    out.push(xb);
    return out;
  }

  return {
    trail, seed, length: L, finishX: L, finishLevel: hAt(L), startX: START_X, mx: true, design: dLvl, designTop: dTop,
    pieces: [], zones, waters, bridges, kickers: [], gates, coins, patches, features, checkpoints, berms, arcs,
    startGateX: 3.3, designFinishSpeed: v, gravity: grav, mirrored: false,
    groundY, terrainY, baseY: groundY, groundSlope, surfaceAt, waterAt, bridgeAt, kickerAt, bermAt, inZone,
    propsInChunk, terrainXs,
  };
}

// =====================================================================================================
// v1.5 Mirror mutator: the same track ridden backwards (x -> L - x): the finish straight comes first, every landing
// slope is a takeoff and every takeoff a landing. Pure wrapper over a race course; deterministic like the original.
// =====================================================================================================
export function mirrorCourse(c) {
  const L = c.length;
  const m = (x) => L - x;
  const span = (z) => ({ ...z, x0: m(z.x1), x1: m(z.x0) });
  const y0 = c.groundY(0);
  const wall = (x) => (x > L + 120 ? 0.08 * (x - L - 120) * (x - L - 120) : 0);
  const groundY = (x) => (x <= L ? c.groundY(m(x)) : y0 + wall(x));
  const groundSlope = (x) => (x <= L ? -c.groundSlope(m(x)) : x > L + 120 ? 0.16 * (x - L - 120) : 0);
  const terrainY = (x) => (x <= L ? c.terrainY(m(x)) : groundY(x));
  const waters = c.waters.map(span), bridges = c.bridges.map(span), berms = (c.berms || []).map(span), zones = c.zones.map(span);
  const patches = c.patches.map(span);
  const features = c.features.map((f) => ({ ...span(f), lip: f.lip != null ? m(f.lip) : undefined, land: f.land != null ? m(f.land) : undefined }));
  const arcs = c.arcs.map((a) => ({ ...a, x: m(a.x) }));
  const cps = c.checkpoints.map((p) => m(p.x)).filter((x) => x > 30 && x < L - 15).sort((a, b) => a - b);
  const checkpoints = [{ index: 0, x: 0, y: groundY(0) }];
  for (const x of cps) if (x > checkpoints[checkpoints.length - 1].x + 40) checkpoints.push({ index: checkpoints.length, x, y: groundY(x) });
  const gates = c.gates.map((g) => m(g.x)).sort((a, b) => a - b).map((x, i) => ({ index: i, x, y: groundY(x) }));
  const coins = c.coins.map((cn) => ({ ...cn, x: m(cn.x) })).sort((p, q) => p.x - q.x);
  const waterAt = (x) => { for (let i = 0; i < waters.length; i++) { const w = waters[i]; if (x > w.x0 && x < w.x1) return w; } return null; };
  const bridgeAt = (x) => { for (let i = 0; i < bridges.length; i++) { const b = bridges[i]; if (x > b.x0 && x < b.x1) return b; } return null; };
  const bermAt = (x) => { for (let i = 0; i < berms.length; i++) { const b = berms[i]; if (x > b.x0 && x < b.x1) return b; } return null; };
  const inZone = (x, pad = 0) => { for (const z of zones) if (x > z.x0 - pad && x < z.x1 + pad) return z; return null; };
  const surfaceAt = (x) => (x >= 0 && x <= L ? c.surfaceAt(m(x)) : 0);
  function propsInChunk(ci) {
    const x0 = ci * CHUNK, x1 = x0 + CHUNK;
    const out = [];
    const j0 = Math.floor(m(x1) / CHUNK), j1 = Math.floor(m(x0) / CHUNK);
    for (let cj = j0; cj <= j1; cj++) for (const p of c.propsInChunk(cj)) { const x = m(p.x); if (x >= x0 && x < x1) out.push({ ...p, x }); }
    return out;
  }
  function terrainXs(xa, xb) {
    const out = [];
    for (let xx = xa; xx < xb - 1e-6; xx += SEG) {
      const z = inZone(xx + SEG / 2, 1);
      if (!z || z.type === 'berm' || z.type === 'bridge') { out.push(xx); continue; }
      for (let u = xx; u < xx + SEG - 1e-6; u += 0.5) out.push(u);
    }
    out.push(xb);
    return out;
  }
  return {
    trail: c.trail, seed: c.seed, length: L, finishX: L, finishLevel: groundY(L), startX: START_X, mx: true, design: c.design, designTop: c.designTop,
    pieces: [], zones, waters, bridges, kickers: [], gates, coins, patches, features, checkpoints, berms, arcs,
    startGateX: 3.3, designFinishSpeed: c.designFinishSpeed, gravity: c.gravity, mirrored: true,
    groundY, terrainY, baseY: groundY, groundSlope, surfaceAt, waterAt, bridgeAt, kickerAt: () => null, bermAt, inZone,
    propsInChunk, terrainXs,
  };
}

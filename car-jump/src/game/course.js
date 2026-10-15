// Course geometry: pure functions of (track, seed), meters, +y UP, x = 0 at the ramp lip.
// Everything here is deterministic so the same seed always produces the same terrain and props.

import { TAU, mulberry32, hash2, clamp, smoothstep } from './util.js';
import { OBSTACLE_KINDS } from '../data/tracks.js';

export const CHUNK = 40; // terrain/prop generation chunk (m)
export const SEG = 2; // terrain segment length (m)
// v2 kicker ramp: circular profile (radius R) rising to a 28 deg lip, then a short drop
export const KICK = (() => {
  const R = 30, a = (26 * Math.PI) / 180;
  return { R, len: R * Math.sin(a), h: R * (1 - Math.cos(a)), back: 1.6, ang: a };
})();

export function createCourse(track, seed) {
  const H = track.ramp.height;
  const L = track.ramp.length;

  // The ramp stands on a plateau; the lip overhangs a landing hill that runs down to the
  // far terrain baseline (y = 0). The hill catches a good jump at a shallow angle.
  const gk = track.gravity || 1;
  const plateau = Math.round(Math.max(30, H * 0.45));
  const gapDrop = 6; // lip height above the plateau
  const lipY = plateau + gapDrop;
  const kickA = (15 * Math.PI) / 180;
  const kickLen = clamp(L * 0.12, 8, 16);
  const R = kickLen / Math.sin(kickA);
  const rise = R * (1 - Math.cos(kickA));
  const bottomY = lipY - rise;
  const topY = bottomY + H;
  const padLen = 8;
  // Profile: start pad -> short rounded edge -> straight steep slope -> long concave
  // transition -> short flat -> circular kicker (15 deg) ending at the lip (x = 0).
  const roundA = 16; // rounded top edge length (car is still slow there)
  const transB = 30; // concave bottom transition length
  const slope = clamp(H / Math.max(10, L - padLen - 6 - roundA / 2 - transB / 2 - kickLen), Math.tan(0.6), Math.tan(0.96));
  const straight = Math.max(0, H / slope - roundA / 2 - transB / 2);
  const rampStart = -L;
  const dropStart = rampStart + padLen;
  const x1 = dropStart + roundA; // end of rounded edge
  const x2 = x1 + straight; // end of straight slope
  const x3 = x2 + transB; // bottom reached
  const dropEnd = -kickLen;
  // Landing hill: a cubic knoll that steepens to a 0.6 slope (so a level-0 jump meets it
  // nearly tangentially), a straight run, then a concave outrun onto the rolling terrain.
  const hc = 4.4e-5 * gk;
  const sMax = 0.6;
  const xk = Math.sqrt(sMax / (3 * hc));
  const dropK = hc * xk * xk * xk;
  const outrun = 34;
  const lin = Math.max(0, (plateau - dropK - (sMax * outrun) / 2) / sMax);
  const xs = xk + lin;
  const xL = xs + outrun; // hill end
  function hill(x) {
    if (x <= 0) return plateau;
    if (x <= xk) return plateau - hc * x * x * x;
    if (x <= xs) return plateau - dropK - sMax * (x - xk);
    if (x <= xL) { const d = xL - x; return (sMax * d * d) / (2 * outrun); }
    return 0;
  }

  function rampY(x) {
    if (x <= dropStart) return topY;
    if (x <= x1) { const d = x - dropStart; return topY - (slope * d * d) / (2 * roundA); }
    if (x <= x2) return topY - (slope * roundA) / 2 - slope * (x - x1);
    if (x <= x3) { const d = x3 - x; return bottomY + (slope * d * d) / (2 * transB); }
    if (x <= dropEnd) return bottomY;
    const dx = Math.min(x, 0) - dropEnd;
    return bottomY + R - Math.sqrt(Math.max(0, R * R - dx * dx));
  }
  function rampSlope(x) {
    return (rampY(x + 0.05) - rampY(x - 0.05)) / 0.1;
  }

  // Terrain noise: a few seeded sine octaves, each clamped to a max slope so roughness
  // reads as bumps, not walls.
  const rng = mulberry32((seed ^ 0x5eed1234) >>> 0);
  const A = track.terrain.amplitude, W = track.terrain.wavelength, r = track.terrain.roughness;
  const spec = [
    [A * 0.65, W * (0.9 + 0.2 * rng()), 0.22],
    [A * 0.35, W * 0.47 * (0.9 + 0.2 * rng()), 0.12],
    [A * r * 0.6, W * 0.19 * (0.9 + 0.2 * rng()), 0.06],
    [A * r * 0.3, W * 0.083 * (0.9 + 0.2 * rng()), 0.03],
  ];
  const comps = spec.map(([amp, wl, maxSlope]) => ({
    amp: Math.min(amp, (maxSlope * wl) / TAU),
    k: TAU / wl,
    ph: rng() * TAU,
  }));

  function noise(x) {
    let s = 0;
    for (let i = 0; i < comps.length; i++) s += comps[i].amp * Math.sin(comps[i].k * x + comps[i].ph);
    return s;
  }
  const b0 = xL - 10, b1 = xL + 30;
  // terrain without kickers (the renderer draws kickers as structures on top of this)
  function baseY(x) {
    if (x <= 0) return plateau;
    return hill(x) + noise(x) * smoothstep(b0, b1, x);
  }
  function baseSlope(x) {
    if (x <= 0) return 0;
    return (baseY(x + 0.05) - baseY(x - 0.05)) / 0.1;
  }

  // ---- v2 kicker ramps: 1-3 seeded circular kickers in the landing zone (after the landing hill) ----
  const kicks = [];
  {
    const kr = mulberry32(hash2(seed, 0x4b1c));
    const k0 = Math.max(40, xL + 12);
    const k1 = Math.max(k0 + 60, track.finish * 0.8);
    const n = 1 + Math.floor(kr() * 3);
    const span = (k1 - k0) / n;
    for (let i = 0; i < n; i++) {
      let x0 = k0 + span * i + kr() * span * 0.55;
      for (let tries = 0; tries < 12; tries++) {
        const sl = (baseY(x0 + KICK.len) - baseY(x0)) / KICK.len;
        if (Math.abs(sl) < 0.22 && Math.abs(baseSlope(x0)) < 0.25) break;
        x0 += 4;
      }
      kicks.push({ x0, x1: x0 + KICK.len, x2: x0 + KICK.len + KICK.back, h: KICK.h, i });
    }
  }
  function kickH(x) {
    for (let i = 0; i < kicks.length; i++) {
      const k = kicks[i];
      if (x <= k.x0 || x >= k.x2) continue;
      if (x <= k.x1) { const d = x - k.x0; return KICK.R - Math.sqrt(KICK.R * KICK.R - d * d); }
      return k.h * (1 - (x - k.x1) / KICK.back);
    }
    return 0;
  }
  function groundY(x) {
    if (x <= 0) return plateau;
    return baseY(x) + kickH(x);
  }
  // Slope for control/landing logic: over a kicker's short back drop it keeps the lip's slope
  // (the drop is a step the car flies off, not a surface it should align to or be stopped by).
  function groundSlope(x) {
    if (x <= 0) return 0;
    for (let i = 0; i < kicks.length; i++) {
      const k = kicks[i];
      if (x > k.x1 - 0.05 && x < k.x2 + 0.05) x = k.x1 - 0.06;
    }
    return (groundY(x + 0.05) - groundY(x - 0.05)) / 0.1;
  }
  // Surface the car is over: ramp deck for x in [rampStart, 0], else terrain.
  function surfaceY(x) {
    return x >= rampStart && x <= 0 ? rampY(x) : groundY(x);
  }
  function kickerAt(x, margin = 0) {
    for (const k of kicks) if (x >= k.x0 - margin && x <= k.x2 + margin) return k;
    return null;
  }
  // Breakpoints for the physics polyline in [xa, xb): the SEG grid, refined on kickers.
  function terrainXs(xa, xb) {
    const out = [];
    for (let x = xa; x < xb - 1e-6; x += SEG) {
      const k = kickerAt(x + SEG / 2, SEG);
      if (!k) { out.push(x); continue; }
      for (let u = x; u < x + SEG - 1e-6; u += 0.5) out.push(u);
      for (const e of [k.x1, k.x1 + 0.02]) if (e > x && e < x + SEG) out.push(e);
    }
    out.sort((a, b) => a - b);
    out.push(xb);
    return out;
  }

  // Ramp deck polyline (finer on the kicker).
  const rampPts = [];
  for (let x = rampStart; x < dropEnd; x += 1.5) rampPts.push([x, rampY(x)]);
  for (let x = dropEnd; x < 0; x += 0.75) rampPts.push([x, rampY(x)]);
  rampPts.push([0, rampY(0)]);

  // ---- v2 formations: structures placed on a seeded schedule (at least one per 60 m) ----
  const ob = track.obstacles;
  const kinds = ob.kinds.filter((k) => OBSTACLE_KINDS[k]);
  const has = (k) => kinds.includes(k);
  const formTypes = [];
  if (has('crate')) formTypes.push(['pyramid', 1.0]);
  if (has('glass')) formTypes.push(['tower', 1.0]);
  if (has('barrel')) formTypes.push(['barrels', 0.8]);
  if (has('fuel')) formTypes.push(['depot', 0.7]);
  formTypes.push(['bridge', 0.9]);
  const formW = formTypes.reduce((a, f) => a + f[1], 0);
  const frand = mulberry32(hash2(seed, 0xf0a3));
  const forms = [];
  let formNext = ob.start + 4 + frand() * 8;
  const density = Math.max(0.2, ob.density);

  function placeFrame(x0, width) {
    // straight frame fitted under the formation; lifted so no piece digs into a bump
    const xb = x0 + width;
    const ya = groundY(x0), yb = groundY(xb);
    const sl = (yb - ya) / width;
    let lift = 0;
    for (let x = x0; x <= xb + 1e-6; x += 0.5) lift = Math.max(lift, groundY(x) - (ya + sl * (x - x0)));
    return { x0, y0: ya + lift - 0.05, ang: Math.atan(sl), sl };
  }

  function buildForm(type, x0, rnd, fid) {
    const P = []; // pieces: kind, lx, ly (centre, frame-local), w, h, sup (indices), role
    let width = 0;
    if (type === 'pyramid') {
      const n = 3 + Math.floor(Math.pow(rnd(), 1.6) * 4); // 3..6 wide, mostly 3-4
      const d = OBSTACLE_KINDS.crate, gap = 0.05;
      const idx = [];
      for (let row = 0; row < n; row++) {
        idx.push([]);
        for (let j = 0; j < n - row; j++) {
          const sup = row ? [idx[row - 1][j], idx[row - 1][j + 1]] : [];
          idx[row].push(P.length);
          P.push({ kind: 'crate', lx: (j + row / 2) * (d.w + gap) + d.w / 2, ly: row * d.h + d.h / 2, w: d.w, h: d.h, sup });
        }
      }
      if (has('tnt') && rnd() < 0.6) P[idx[Math.min(1, n - 2)][0]].kind = 'tnt'; // a TNT core
      width = n * (d.w + gap);
    } else if (type === 'tower') {
      const m = 3 + Math.floor(rnd() * 3); // 3..5 storeys
      const cols = rnd() < 0.5 ? 2 : 1;
      const bw = 1.6, bh = 1.5;
      for (let c = 0; c < cols; c++) {
        for (let i = 0; i < m - (c ? 1 : 0); i++) {
          P.push({ kind: 'glass', lx: c * bw + bw / 2, ly: i * bh + bh / 2, w: bw, h: bh, sup: i ? [P.length - 1] : [], tower: true });
        }
      }
      width = cols * bw;
    } else if (type === 'bridge') {
      const span = 6.5 + rnd() * 2, uh = 3.3, uw = 0.8, dh = 0.42;
      P.push({ kind: 'scaffold', lx: uw / 2, ly: uh / 2, w: uw, h: uh, sup: [], role: 'upright' });
      P.push({ kind: 'scaffold', lx: span - uw / 2, ly: uh / 2, w: uw, h: uh, sup: [], role: 'upright' });
      P.push({ kind: 'scaffold', lx: span / 2, ly: uh + dh / 2, w: span + 0.6, h: dh, sup: [0, 1], role: 'deck' });
      width = span;
    } else if (type === 'barrels' || type === 'row') {
      // barrel row (or, on tracks without barrels / steep ground, a low crate row)
      const n = 4 + Math.floor(rnd() * 4);
      const k0 = type === 'barrels' && has('barrel') ? 'barrel' : 'crate';
      const d = OBSTACLE_KINDS[k0];
      for (let j = 0; j < n; j++) P.push({ kind: has('fuel') && rnd() < 0.1 ? 'fuel' : k0, lx: j * (d.w + 0.06) + d.w / 2, ly: d.h / 2, w: d.w, h: d.h, sup: [] });
      width = n * (d.w + 0.06);
    } else if (type === 'depot') {
      const n = 4 + Math.floor(rnd() * 5); // 4..8 drums
      const d = OBSTACLE_KINDS.fuel, gap = 0.04;
      const bottom = Math.max(Math.ceil(n * 0.6), Math.ceil((n + 1) / 2));
      for (let j = 0; j < bottom; j++) P.push({ kind: 'fuel', lx: j * (d.w + gap) + d.w / 2, ly: d.h / 2, w: d.w, h: d.h, sup: [] });
      for (let j = 0; j < n - bottom; j++) P.push({ kind: 'fuel', lx: (j + 1) * (d.w + gap), ly: d.h * 1.5 - 0.02, w: d.w, h: d.h, sup: [j, j + 1] });
      width = bottom * (d.w + gap);
    }
    return { fid, type, x0, width, x1: x0 + width, pieces: P };
  }

  function genFormsUntil(xMax) {
    while (formNext < xMax) {
      let pick = frand() * formW, type = formTypes[0][0];
      for (const [t, w] of formTypes) { if ((pick -= w) <= 0) { type = t; break; } }
      const sub = mulberry32(hash2(seed ^ 0x77, forms.length * 131 + 7));
      let x0 = formNext;
      let f = buildForm(type, x0, sub, forms.length);
      const prevX = forms.length ? forms[forms.length - 1].x1 : -1e9;
      // keep clear of kickers: go just before the kicker if there is room, else just after it
      const k = kicks.find((k) => f.x1 > k.x0 - 6 && x0 < k.x2 + 12);
      if (k) x0 = k.x0 - 6 - f.width > prevX + 8 ? k.x0 - 6 - f.width : k.x2 + 12;
      // steep ground (the landing hill): tall structures become a low row that can sit on a slope
      const limit = (t) => (t === 'tower' || t === 'bridge' ? 0.2 : t === 'barrels' || t === 'row' ? 0.65 : 0.4);
      if (Math.abs(placeFrame(x0, f.width).sl) > limit(type)) {
        type = has('barrel') ? 'barrels' : 'row';
        f = buildForm(type, x0, sub, forms.length);
      }
      for (let tries = 0; tries < 6 && Math.abs(placeFrame(x0, f.width).sl) > limit(type); tries++) x0 += 3;
      const k2 = kicks.find((k) => x0 + f.width > k.x0 - 6 && x0 < k.x2 + 12);
      if (k2) x0 = k2.x2 + 12;
      f.x0 = x0; f.x1 = x0 + f.width;
      const fr = placeFrame(x0, f.width);
      const c = Math.cos(fr.ang), s = Math.sin(fr.ang);
      f.frame = fr;
      f.props = f.pieces.map((p, i) => ({
        id: 1e7 + f.fid * 100 + i, kind: p.kind, form: f.fid, role: p.role || null,
        x: fr.x0 + c * p.lx - s * p.ly, y: fr.y0 + s * p.lx + c * p.ly, ang: fr.ang, w: p.w, h: p.h,
        sup: p.sup.map((j) => 1e7 + f.fid * 100 + j),
      }));
      forms.push(f);
      const step = clamp((52 + frand() * 14) / Math.sqrt(density), f.width + 12, 58);
      formNext = x0 + step;
    }
  }

  // Props, generated per chunk with an order-independent seed (formations come from their own
  // sequential schedule and are handed out by the chunk their anchor falls in).
  const singleKinds = kinds.filter((k) => !OBSTACLE_KINDS[k].explosive);
  const boomKinds = kinds.filter((k) => OBSTACLE_KINDS[k].explosive);
  function propsInChunk(ci) {
    const out = [];
    if (ci < 0 || !kinds.length) return out;
    const x0c = ci * CHUNK, x1 = (ci + 1) * CHUNK;
    genFormsUntil(x1 + 1);
    const busy = [];
    for (const f of forms) {
      if (f.x1 > x0c - 30 && f.x0 < x1 + 30) busy.push([f.x0 - 3, f.x1 + 3]);
      if (f.x0 >= x0c && f.x0 < x1) for (const p of f.props) out.push(p);
    }
    for (const k of kicks) busy.push([k.x0 - 5, k.x2 + 10]);
    const rand = mulberry32(hash2(seed, ci * 7919 + 17));
    const spacing = (24 / Math.max(0.2, ob.density)) * 2.2; // sparser singles: formations carry the destruction
    let x = x0c + rand() * spacing * 0.8;
    let n = 0;
    while (x < x1) {
      if (x >= ob.start) {
        const boom = boomKinds.length && rand() < 0.08;
        const pool = boom ? boomKinds : singleKinds.length ? singleKinds : kinds;
        const kind = pool[Math.floor(rand() * pool.length)];
        const def = OBSTACLE_KINDS[kind];
        const small = def.w <= 1.3 && !def.segments;
        const count = small && rand() < 0.3 ? 2 + Math.floor(rand() * 2) : 1;
        for (let k = 0; k < count; k++) {
          const px = x + k * (def.w + 0.25);
          const slope = groundSlope(px);
          if (Math.abs(slope) > 0.45) continue;
          if (busy.some(([a, b]) => px + def.w / 2 > a && px - def.w / 2 < b)) continue;
          out.push({ id: ci * 1000 + n++, kind, x: px });
        }
      }
      x += spacing * (0.55 + rand() * 0.9);
    }
    return out;
  }
  function formationsIn(xa, xb) {
    const out = [];
    for (const f of forms) if (f.x1 > xa && f.x0 < xb) out.push(f);
    return out;
  }

  // ---- v2 air targets along the flight arc a mid-upgrade car gets off this ramp ----
  // Reference launch: ~13.5 deg off the lip at a speed that scales with the ramp (low gravity
  // tracks launch faster). Arcs at several speed factors so weaker and stronger cars both find
  // things, a high tier that needs nitro/upgrades, and a short arc over each kicker.
  const air = [];
  {
    const ar = mulberry32(hash2(seed, 0xa1e7));
    const g = 9.81 * gk;
    const refV = (34 + 0.11 * H) * (gk < 0.6 ? 1.2 : 1);
    const launchY = lipY + 1.0;
    const arcOf = (v, ang, x0, y0, clear = 1.0) => {
      const pts = [];
      let x = x0, y = y0, vx = v * Math.cos(ang), vy = v * Math.sin(ang);
      const h = 1 / 30;
      for (let t = 0; t < 30; t += h) {
        pts.push([x, y, t]);
        if (t > 0.3 && y < groundY(x) + clear) break;
        const sp = Math.hypot(vx, vy), k = 0.0005 * sp;
        vx -= k * vx * h; vy -= (g + k * vy) * h;
        x += vx * h; y += vy * h;
      }
      return pts;
    };
    const lip = (13.5 * Math.PI) / 180;
    const tiers = [0.8, 0.9, 1.0, 1.1, 1.25].map((f) => arcOf(refV * f, lip, 0, launchY));
    const at = (pts, u) => pts[clamp(Math.round(u * (pts.length - 1)), 0, pts.length - 1)];
    let id = 0;
    const tooClose = (x, y, d) => air.some((a) => Math.abs(a.x - x) < d && Math.abs(a.y - y) < 8);
    const add = (kind, x, y, extra = {}) => air.push({ id: id++, kind, x, y, ...extra });
    // rings: one per tier-ish, a couple of extra on the main arc, one high one for nitro
    const nR = 4 + Math.floor(ar() * 3);
    for (let i = 0, guard = 0; i < nR && guard < 60; guard++) {
      const ti = i < 5 ? [1, 2, 0, 3, 4][i] : Math.floor(ar() * 5);
      const p = at(tiers[ti], 0.22 + ar() * 0.56);
      const y = p[1] + (ar() - 0.5) * 2;
      if (p[1] - groundY(p[0]) < 5 || tooClose(p[0], y, 9)) continue;
      add('ring', p[0], y, { r: 2.3 });
      i++;
    }
    {
      const p = at(tiers[2], 0.35 + ar() * 0.25);
      if (!tooClose(p[0], p[1] + 8, 6)) add('ring', p[0], p[1] + 7 + ar() * 3, { r: 2.3, high: true });
    }
    // coin arcs (5-9 coins riding an arc exactly)
    const nC = 2 + Math.floor(ar() * 2);
    for (let i = 0; i < nC; i++) {
      const pts = tiers[Math.floor(ar() * 4)];
      const cnt = 5 + Math.floor(ar() * 5);
      const u0 = 0.12 + ar() * 0.55;
      const du = 2.3 / Math.max(1, Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])) / (pts.length - 1);
      for (let j = 0; j < cnt; j++) {
        const p = at(pts, u0 + j * du);
        if (tooClose(p[0], p[1], 1.6)) continue;
        add('coin', p[0], p[1], { r: 0.55 });
      }
    }
    // balloons a little above the arcs
    const nB = 3 + Math.floor(ar() * 3);
    for (let i = 0, guard = 0; i < nB && guard < 40; guard++) {
      const p = at(tiers[1 + Math.floor(ar() * 3)], 0.25 + ar() * 0.6);
      const x = p[0] + (ar() - 0.5) * 4, y = p[1] + 1 + ar() * 3;
      if (tooClose(x, y, 4)) continue;
      add('balloon', x, y, { r: 0.95, hue: Math.floor(ar() * 5) });
      i++;
    }
    // a blimp above the main arc's apex on tracks that ask for one (city, moon, neon, sky)
    if (track.blimp || track.id === 'city' || track.id === 'moon') {
      const pts = tiers[3];
      let apex = pts[0];
      for (const p of pts) if (p[1] > apex[1]) apex = p;
      add('blimp', apex[0] * (1.05 + ar() * 0.25), apex[1] + 7 + ar() * 3, { r: 8, rh: 2.6 });
    }
    // over each kicker: a ring at the top of a typical kicker hop and a short coin trail
    for (const k of kicks) {
      const ang = Math.atan((KICK.len / Math.sqrt(KICK.R * KICK.R - KICK.len * KICK.len))) + Math.atan(baseSlope(k.x1));
      const pts = arcOf(20 + ar() * 3, ang, k.x1, groundY(k.x1) + 1.0, 0.8);
      const top = at(pts, 0.45);
      add('ring', top[0], top[1] + 0.5, { r: 2.3, kicker: true });
      for (let j = 0; j < 5; j++) { const p = at(pts, 0.12 + j * 0.05); add('coin', p[0], p[1], { r: 0.55 }); }
    }
    air.sort((a, b) => a.x - b.x);
  }

  return {
    track, seed, H, L, plateau, lipY, topY, bottomY, rampStart, dropStart, dropEnd, kickLen, xL,
    finish: track.finish,
    rampY, rampSlope, groundY, groundSlope, surfaceY, rampPts, propsInChunk,
    startX: rampStart + 3.2,
    // v2
    baseY, kickers: kicks, kickerAt, terrainXs, formationsIn, airTargets: air,
  };
}

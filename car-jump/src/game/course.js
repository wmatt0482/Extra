// Course geometry: pure functions of (track, seed), meters, +y UP, x = 0 at the ramp lip.
// Everything here is deterministic so the same seed always produces the same terrain and props.

import { TAU, mulberry32, hash2, clamp, smoothstep } from './util.js';
import { OBSTACLE_KINDS } from '../data/tracks.js';

export const CHUNK = 40; // terrain/prop generation chunk (m)
export const SEG = 2; // terrain segment length (m)

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
  function groundY(x) {
    if (x <= 0) return plateau;
    return hill(x) + noise(x) * smoothstep(b0, b1, x);
  }
  function groundSlope(x) {
    if (x <= 0) return 0;
    return (groundY(x + 0.05) - groundY(x - 0.05)) / 0.1;
  }
  // Surface the car is over: ramp deck for x in [rampStart, 0], else terrain.
  function surfaceY(x) {
    return x >= rampStart && x <= 0 ? rampY(x) : groundY(x);
  }

  // Ramp deck polyline (finer on the kicker).
  const rampPts = [];
  for (let x = rampStart; x < dropEnd; x += 1.5) rampPts.push([x, rampY(x)]);
  for (let x = dropEnd; x < 0; x += 0.75) rampPts.push([x, rampY(x)]);
  rampPts.push([0, rampY(0)]);

  // Props, generated per chunk with an order-independent seed.
  const ob = track.obstacles;
  const kinds = ob.kinds.filter((k) => OBSTACLE_KINDS[k]);
  function propsInChunk(ci) {
    const out = [];
    if (ci < 0 || !kinds.length) return out;
    const rand = mulberry32(hash2(seed, ci * 7919 + 17));
    const spacing = 24 / Math.max(0.2, ob.density);
    const x1 = (ci + 1) * CHUNK;
    let x = ci * CHUNK + rand() * spacing * 0.8;
    let n = 0;
    while (x < x1) {
      if (x >= ob.start) {
        const kind = kinds[Math.floor(rand() * kinds.length)];
        const def = OBSTACLE_KINDS[kind];
        const small = def.w <= 1.3 && !def.segments;
        const count = small && rand() < 0.3 ? 2 + Math.floor(rand() * 2) : 1;
        for (let k = 0; k < count; k++) {
          const px = x + k * (def.w + 0.25);
          const slope = groundSlope(px);
          if (Math.abs(slope) > 0.45) continue;
          out.push({ id: ci * 1000 + n++, kind, x: px });
        }
      }
      x += spacing * (0.55 + rand() * 0.9);
    }
    return out;
  }

  return {
    track, seed, H, L, plateau, lipY, topY, bottomY, rampStart, dropStart, dropEnd, kickLen, xL,
    finish: track.finish,
    rampY, rampSlope, groundY, groundSlope, surfaceY, rampPts, propsInChunk,
    startX: rampStart + 3.2,
  };
}

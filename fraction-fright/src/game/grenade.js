// The slime grenade's flight: a closed-form arc (no physics) from the thrower to the aimed x, with optional unit
// hops (the bounce scaffold: touch down at the road's start, hop `count - 1` units, then the last hop lands on the
// aim). Every segment is a parabola in screen space, so the landing x is exactly the aim and the timing is fixed.
// planThrow(...) -> plan; grenadeAt(plan, t) -> the position / rotation at time t; plan.touchdowns are the hop
// landings ("boing" moments), plan.total the flight time, plan.land the final landing point.

import { lerp, clamp } from './util.js';

export const FLIGHT = { arcSec: 0.9, hopSec: 0.34, minArcSec: 0.55, apex: 0.3, hopApex: 0.55 };

// opts: { x0, y0 (thrower), xLand, yLand (the road), hops: [x...] (intermediate touchdown xs, in px, from the first
// touchdown to the last-but-one; the final landing is xLand), H (view height for the apex), power (1 = default) }
export function planThrow({ x0, y0, xLand, yLand, hops = [], H = 400, power = 1 }) {
  const p = clamp(Number(power) || 1, 0.6, 2);
  const arcSec = Math.max(FLIGHT.minArcSec, FLIGHT.arcSec / Math.sqrt(p));
  const hopSec = FLIGHT.hopSec / Math.sqrt(p);
  const segs = [];
  const touchdowns = [];
  let t = 0;
  const points = hops.length ? [...hops, xLand] : [xLand];
  // the first segment: thrower -> first touchdown; the apex clears the road comfortably and scales with distance
  const firstX = points[0];
  const dist = Math.abs(firstX - x0);
  const apex = Math.max(H * FLIGHT.apex, (y0 - yLand) * 0.35) + dist * 0.08;
  segs.push({ t0: t, t1: t + arcSec, xa: x0, ya: y0, xb: firstX, yb: yLand, h: apex, kind: 'arc', index: 0 });
  t += arcSec;
  const hopH = Math.max(14, H * 0.07) * (0.9 + 0.1 * p);
  for (let i = 1; i < points.length; i++) {
    const xa = points[i - 1], xb = points[i];
    touchdowns.push({ t, x: xa });
    const d = Math.abs(xb - xa);
    const sec = hopSec * clamp(0.75 + d / 220, 0.8, 1.35);
    segs.push({ t0: t, t1: t + sec, xa, ya: yLand, xb, yb: yLand, h: hopH + d * 0.12, kind: 'hop', index: i });
    t += sec;
  }
  return { segs, total: t, touchdowns, land: { x: xLand, y: yLand }, start: { x: x0, y: y0 } };
}

// position at t: { x, y, rot, seg, u, done }
export function grenadeAt(plan, t, out = {}) {
  const segs = plan.segs;
  if (t >= plan.total) { out.x = plan.land.x; out.y = plan.land.y; out.rot = t * 9; out.seg = segs.length - 1; out.u = 1; out.done = true; return out; }
  let s = segs[0];
  for (let i = 0; i < segs.length; i++) { if (t < segs[i].t1) { s = segs[i]; break; } }
  const u = clamp((t - s.t0) / Math.max(1e-6, s.t1 - s.t0), 0, 1);
  out.x = lerp(s.xa, s.xb, u);
  out.y = lerp(s.ya, s.yb, u) - s.h * 4 * u * (1 - u);
  out.rot = t * 9 * (s.xb >= s.xa ? 1 : -1);
  out.seg = s.index;
  out.u = u;
  out.done = false;
  return out;
}

// a dotted preview of the main arc (for the aim): n points along segment 0
export function arcPreview(plan, n, out) {
  const s = plan.segs[0];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    out[i * 2] = lerp(s.xa, s.xb, u);
    out[i * 2 + 1] = lerp(s.ya, s.yb, u) - s.h * 4 * u * (1 - u);
  }
  return out;
}

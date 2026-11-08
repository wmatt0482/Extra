// The Sandbox's optional "Site goals": eight small things to try, each checked automatically from the real yard (settled
// toy poses, the terrain stamps and where the machines are) and each worth a star. There is no timer, nothing is lost by
// ignoring them, and a goal once earned stays earned. Pure functions of a yard-shaped object ({ poses(), stamps, machines,
// groundAt(x, z), round }), so the Node tests and the browser read the very same rules. The numbers on the card are
// the ones the game shows in metres (a build's height) and its count of materials.
import { TOYS } from './content.mjs';

/** How fast a toy may still be moving and count as standing (the same limits as the jobs' mission check). */
const settled = (p) =>
  Math.hypot(p.velocity?.x || 0, p.velocity?.y || 0, p.velocity?.z || 0) < 0.65 &&
  Math.hypot(p.angular?.x || 0, p.angular?.y || 0, p.angular?.z || 0) < 0.7;

/** A toy's top and bottom and its footprint radius, from its real orientation (a beam rolled on its side is 1.15 m tall). */
function extent(p) {
  const d = TOYS[p.type]?.size;
  if (!d) return null;
  const { x, y, z, w } = p.rotation,
    up = (Math.abs(2 * (x * y + z * w)) * d[0] + Math.abs(1 - 2 * (x * x + z * z)) * d[1] + Math.abs(2 * (y * z - x * w)) * d[2]) / 2;
  return { bottom: p.position.y - up, top: p.position.y + up, r: Math.hypot(d[0], d[2]) / 2 };
}

/** The tallest column of stacked toys standing on the ground: how many toys in it and how high its top is. A toy is in a
 *  column when it rests on the toy below (that toy's top within a hand of its bottom, and their middles close enough that
 *  one carries the other); a toy resting on a machine or in the air is not counted. */
export function stackStats(poses, groundAt = () => 0) {
  const items = poses
    .filter(settled)
    .map((p) => ({ p, e: extent(p) }))
    .filter((i) => i.e)
    .sort((a, b) => a.e.bottom - b.e.bottom);
  let blocks = 0,
    height = 0;
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    let chain = a.e.bottom - groundAt(a.p.position.x, a.p.position.z) < 0.3 ? 1 : 0;
    for (let j = 0; j < i; j++) {
      const b = items[j];
      if (!b.chain) continue;
      const near = Math.hypot(a.p.position.x - b.p.position.x, a.p.position.z - b.p.position.z) < (a.e.r + b.e.r) * 0.7;
      if (near && Math.abs(b.e.top - a.e.bottom) < 0.3) chain = Math.max(chain, b.chain + 1);
    }
    a.chain = chain;
    if (chain) {
      blocks = Math.max(blocks, chain);
      height = Math.max(height, a.e.top);
    }
  }
  return { blocks, height };
}

/** True when a ramp stamp is placed and a machine stands up on it (the ramp climbs 1.8 m, so 0.8 m up is well onto it). */
function droveUpRamp(yard) {
  const ramps = (yard.stamps || []).filter((s) => s.kind === 'ramp');
  return ramps.some((s) =>
    yard.machines.some(
      (m) => Math.abs(m.x - s.x) < 2.2 && Math.abs(m.z - s.z) < 2.2 && yard.groundAt(m.x, m.z) >= 0.8,
    ),
  );
}

/** True when a beam lies across two other toys: its underside is a block's height off the ground and two toys stand under
 *  it, well apart (one under each end). */
function beamBridge(poses) {
  const items = poses
    .filter(settled)
    .map((p) => ({ p, e: extent(p) }))
    .filter((i) => i.e);
  return items.some(({ p, e }) => {
    if (p.type !== 'beam' || e.bottom < 0.9) return false;
    const under = items.filter(
      (o) => o.p !== p && o.p.type !== 'beam' && Math.abs(o.e.top - e.bottom) < 0.3 && Math.abs(o.p.position.z - p.position.z) < 1.4 && Math.abs(o.p.position.x - p.position.x) < 2.6,
    );
    return under.some((a) => under.some((b) => Math.abs(a.p.position.x - b.p.position.x) > 1.5));
  });
}

/** The eight goals, in card order: an id (saved), the words on the card and a check that returns true when it is met. */
export const GOALS = [
  { id: 'tower3', text: 'Build a 3-block tower', check: (y, s) => s.blocks >= 3 },
  { id: 'tall2', text: 'Stack blocks 2 m tall', check: (y, s) => s.blocks >= 2 && s.height >= 2 },
  { id: 'tall4', text: 'Stack blocks 4 m tall', check: (y, s) => s.blocks >= 3 && s.height >= 4 },
  {
    id: 'pallets4',
    text: 'Fill the delivery bay with 4 pallets',
    check: (y) => {
      const pad = y.round.pad;
      return (
        y
          .poses()
          .filter((p) => p.type === 'pallet' && settled(p) && Math.abs(p.position.x - pad.x) < pad.w / 2 && Math.abs(p.position.z - pad.z) < pad.d / 2).length >= 4
      );
    },
  },
  { id: 'ramp', text: 'Make a ramp and drive up it', check: (y) => droveUpRamp(y) },
  {
    id: 'pit',
    text: 'Dig a pit and drop a block in it',
    check: (y) => {
      const pits = (y.stamps || []).filter((s) => s.kind === 'pit');
      return y.poses().some((p) => settled(p) && p.position.y < -0.1 && pits.some((s) => Math.abs(p.position.x - s.x) < 2 && Math.abs(p.position.z - s.z) < 2));
    },
  },
  { id: 'bridge', text: 'Lay a beam across two blocks', check: (y) => beamBridge(y.poses()) },
  {
    id: 'shape',
    text: 'Shape the site: a hill, a pit, a ramp and water',
    check: (y) => ['hill', 'pit', 'ramp', 'water'].every((k) => (y.stamps || []).some((s) => s.kind === k)),
  },
];
export const GOAL_IDS = GOALS.map((g) => g.id);

/** Which goals are met right now, and the two numbers the card shows: the tallest stack in metres and the materials on
 *  site. A goal that was earned earlier is not checked again by the caller; this only reads the yard. */
export function evaluateGoals(yard) {
  const poses = yard.poses(),
    stats = stackStats(poses, (x, z) => yard.groundAt(x, z)),
    done = GOALS.filter((g) => g.check(yard, stats)).map((g) => g.id);
  return { done, tallest: +stats.height.toFixed(1), stacked: stats.blocks, materials: poses.length };
}

// Pure mission checks on real settled poses: no rendering, storage or test-only completion path. The app and the Node
// tests feed the same pose list (from Yard.poses()) into the same functions, so a job can only be finished by moving
// real toys with real physics.
import { TOYS } from './content.mjs';
// The length of a velocity vector; a missing vector counts as still.
const speed = (v) => Math.hypot(v?.x || 0, v?.y || 0, v?.z || 0);
/** Matches toys to the job. A held toy or a moving one never counts. Blueprint jobs need a distinct toy of the right
 *  type close to each ghost, level, and (for anything but a cube) square to the yard; delivery jobs need every toy
 *  wholly inside the pad, with its footprint's half-diagonal as the margin. Returns the per-ghost (or per-toy) match
 *  ids, the count, the total and whether everything matches. */
export function evaluate(round, blocks, held = null) {
  const eligible = blocks.filter(
    (b) => b.id !== held && !b.broken && speed(b.velocity) < 0.65 && speed(b.angular) < 0.7,
  );
  const matches = [];
  if (round.ghosts) {
    const used = new Set();
    for (const g of round.ghosts) {
      const b = eligible.find(
        (b) =>
          !used.has(b.id) &&
          b.type === g.type &&
          Math.hypot(b.position.x - g.x, b.position.z - g.z) < 0.48 &&
          Math.abs(b.position.y - g.y) < 0.28 &&
          Math.abs(b.rotation.x) < 0.16 &&
          Math.abs(b.rotation.z) < 0.16 &&
          (b.type === 'cube' || Math.abs(b.rotation.y) < 0.16),
      );
      matches.push(b?.id ?? null);
      if (b) used.add(b.id);
    }
  } else {
    const p = round.pad;
    for (const b of blocks) {
      const t = TOYS[b.type],
        margin = Math.hypot(t.size[0], t.size[2]) / 2;
      matches.push(
        eligible.includes(b) &&
          Math.abs(b.position.x - p.x) + margin < p.w / 2 &&
          Math.abs(b.position.z - p.z) + margin < p.d / 2
          ? b.id
          : null,
      );
    }
  }
  return {
    matches,
    count: matches.filter((x) => x !== null).length,
    total: round.ghosts?.length ?? blocks.length,
    done: matches.length > 0 && matches.every((x) => x !== null),
  };
}
/** One job's completion state. step() runs every physics step; the job completes once everything has matched
 *  continuously for 0.9 s, so a toy that is still wobbling into place does not finish the job early. */
export class Mission {
  constructor(round) {
    this.round = round;
    this.settled = 0;
    this.complete = false;
    this.status = { count: 0, total: round.ghosts?.length ?? round.toys.length, matches: [] };
  }
  step(blocks, held, dt) {
    this.status = evaluate(this.round, blocks, held);
    this.settled = this.status.done ? this.settled + dt : 0;
    if (this.settled >= 0.9) this.complete = true;
    return this.complete;
  }
}
/** The tallest top of any settled block, in metres: how high the build stands right now. A block counts when it is
 *  not held or broken and has nearly stopped; its vertical half-extent follows its real orientation. */
export function standingHeight(blocks, held = null) {
  let top = 0;
  for (const b of blocks) {
    if (b.id === held || b.broken || speed(b.velocity) >= 0.65 || speed(b.angular) >= 0.7) continue;
    const d = TOYS[b.type]?.size;
    if (!d) continue;
    const { x, y, z, w } = b.rotation,
      // the middle row of the rotation matrix gives the world-up share of each local axis
      r0 = 2 * (x * y + z * w),
      r1 = 1 - 2 * (x * x + z * z),
      r2 = 2 * (y * z - x * w);
    top = Math.max(top, b.position.y + (Math.abs(r0) * d[0] + Math.abs(r1) * d[1] + Math.abs(r2) * d[2]) / 2);
  }
  return top;
}
/** A blueprint's build challenge: a target and never a clock. { kind: 'grabs', par } is met by finishing with no more
 *  than `par` grab-and-release moves (a grab counts when it picks something up); { kind: 'height', metres } is met once
 *  a settled block's top has stood at `metres` or higher (it stays met). step() runs with the mission check; `grabs`
 *  is the yard's count. The text is what the HUD shows, with the numbers the child can steer by. */
export class Challenge {
  constructor(round) {
    this.spec = round.challenge || null;
    this.met = false;
    this.height = 0;
    this.grabs = 0;
    this.best = 0;
  }
  get active() {
    return !!this.spec;
  }
  step(blocks, held, grabs) {
    if (!this.spec) return;
    this.grabs = grabs;
    if (this.spec.kind === 'height') {
      this.height = standingHeight(blocks, held);
      this.best = Math.max(this.best, this.height);
      if (this.best >= this.spec.metres) this.met = true;
    }
  }
  /** For a 'grabs' challenge the verdict is given when the job completes (the count only matters at the end). */
  finish(grabs) {
    if (this.spec?.kind === 'grabs') this.met = grabs <= this.spec.par;
    return this.met;
  }
  /** "Grabs 4 · par 9" or "Height 3.6 m · target 6.4 m" ("" with no challenge). */
  label() {
    const c = this.spec;
    if (!c) return '';
    if (c.kind === 'grabs') return `Grabs ${this.grabs} · par ${c.par}`;
    return `Height ${(this.met ? this.best : this.height).toFixed(1)} m · target ${c.metres.toFixed(1)} m`;
  }
}

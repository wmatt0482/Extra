// The Pace Director (SPEC §16): the horde's tempo follows the kid, never the other way round. Pure: no DOM, no clock.
//
// The kid's **think time** is the seconds from a fraction being called (the card shows) to the throw. The horde is
// supply and demand (Hunicke's Hamlet): with L zombies walking at once, each taking W seconds to the fence, the kid
// has W / L seconds per zombie in the steady state. The director keeps that at about twice the think time plus the
// feedback beat, so a slow thinker meets one slow zombie and a quick one meets the full horde, and a dip in accuracy
// brings a valley (fewer, slower) before anything else goes wrong (Rosenshine's ~80 % success; L4D's director backs
// off when the player is stressed). Speed is never a reward: a fast, accurate kid gets *more* zombies, not faster ones.
//
//   planPace({ think, known, hitRate, number, big, final, mode }) → { live, walkSec, perZombie, think, mode }
//   updateThink(pace, seconds, at) → the skills' pace record { think, n, updatedAt } (an EMA; the first sample sets it)
//   medianOf(list)
export const DEFAULT_THINK = 8;        // s, a new player (until 4 throws are measured)
export const THINK_MIN = 1.5, THINK_MAX = 40;
export const PER_ZOMBIE_FACTOR = 2.2;  // W / L ≈ 2.2 × think + the beat
export const BEAT_SEC = 2;             // the feedback beat and the next card
export const WALK_MIN = 16, WALK_MAX = 60;
export const LOW_HIT_RATE = 0.7;       // under it: one fewer at once, a slower walk (the valley)
export const KNOWN_AFTER = 4;          // throws before the think time counts as known
export const EMA = 0.3;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = (x) => Math.round(x * 10) / 10;

export function medianOf(list) {
  const a = (list || []).filter((x) => Number.isFinite(x)).slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** The most zombies a wave may have walking at once (the 1.1 shape: 2, the big wave 4, the final wave 3). */
export const maxLiveFor = ({ big = false, final = false } = {}) => (big ? 4 : final ? 3 : 2);

/**
 * The plan for the spawns from now on.
 *   think: seconds per throw (the run's median when ≥ 4 throws, else the player's stored EMA); known: whether it is
 *   measured (false → single file); hitRate: the last 12 throws' hit rate (null = unknown); number: the wave (1–5);
 *   big / final: the wave's shape; mode: 'auto' (default) | 'calm' (always single file, slow) | 'quick' (the 1.1 horde).
 */
export function planPace({ think = DEFAULT_THINK, known = true, hitRate = null, number = 1, big = false, final = false, mode = 'auto' } = {}) {
  const t = clamp(Number(think) || DEFAULT_THINK, THINK_MIN, THINK_MAX);
  const max = maxLiveFor({ big, final });
  if (mode === 'quick') {
    const walkSec = clamp(20 - (Math.max(1, number) - 1) * 1.5, 14, 60);
    return { live: max, walkSec, perZombie: r1(walkSec / max), think: r1(t), mode };
  }
  const per = PER_ZOMBIE_FACTOR * t + BEAT_SEC;   // seconds the kid needs per zombie
  if (mode === 'calm') {
    const walkSec = clamp(per * 1.5, 24, WALK_MAX);
    return { live: 1, walkSec, perZombie: r1(walkSec), think: r1(t), mode };
  }
  let live = clamp(Math.min(max, Math.floor(WALK_MAX / per)), 1, max);
  if (!known) live = 1;
  let walk = live * per;
  if (hitRate != null && Number.isFinite(hitRate) && hitRate < LOW_HIT_RATE) { live = Math.max(1, live - 1); walk = live * per * 1.25; }
  const walkSec = r1(clamp(walk, WALK_MIN, WALK_MAX));
  return { live, walkSec, perZombie: r1(walkSec / live), think: r1(t), mode: 'auto' };
}

/** Fold one measured think time into the player's record (an EMA; clamped so one long pause cannot swamp it). */
export function updateThink(pace, seconds, at = 0) {
  const s = clamp(Number(seconds) || 0, THINK_MIN, THINK_MAX);
  const p = pace && typeof pace === 'object' ? pace : { think: 0, n: 0, updatedAt: 0 };
  const n = Math.max(0, Math.floor(Number(p.n) || 0));
  const think = n > 0 && Number(p.think) > 0 ? (1 - EMA) * Number(p.think) + EMA * s : s;
  return { think: r1(clamp(think, THINK_MIN, THINK_MAX)), n: n + 1, updatedAt: at };
}

/** One line for the Parent Zone. */
export function paceText(plan) {
  if (!plan) return '';
  return `about ${plan.think} s a throw · ${plan.live} at once, ${plan.perZombie} s each`;
}

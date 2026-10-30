// Seeded randomness for the journey (SPEC §10): the sim never calls Math.random or the clock, so the same seed and the
// same answers give the same journey (the unit tests and the economy sim rely on it, and a synced save replays the
// same leg on another device). mulberry32 is the house generator (trail-blazer/tools/economy-sim.mjs); its whole state
// is one 32-bit integer, so it can live inside the JSON-safe journey object (J.trip.rng) and survive a save.

/** A 32-bit seed from anything (a number, a string, several parts): FNV-1a over the parts joined by '|'. Why: seeds
 *  are mixed from the journey seed, the leg id and the replay count, and a string hash keeps each leg's plan independent. */
export function hashSeed(...parts) {
  let h = 0x811c9dc5;
  const s = parts.map((p) => String(p)).join('|');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** One mulberry32 step from a state: returns [float in [0, 1), the next state]. Why: a pure step lets the sim keep the
 *  state in J (plain JSON) instead of in a closure. */
export function step(state) {
  const s = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

/** A closure generator (the tests' and the tools' `rand`): mulberry32(seed)() → [0, 1). A string seed is hashed. */
export function mulberry32(seed) {
  let state = (typeof seed === 'number' ? seed : hashSeed(seed)) | 0;
  return () => { const [r, s] = step(state); state = s; return r; };
}

/** Draw from a state kept on a plain object (obj[key]), advancing it in place. Why: tickDay without a `rand` still
 *  needs to be deterministic and resumable from a save. */
export function drawFrom(obj, key) {
  const [r, s] = step(obj[key] | 0);
  obj[key] = s;
  return r;
}

/** An integer in [lo, hi] from a rand. */
export const randInt = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
/** One element of a list from a rand (undefined for an empty list). */
export const pick = (rand, list) => list[Math.floor(rand() * list.length)];

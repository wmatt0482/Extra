// The ladder (SPEC §5-§6): one tier per street, its state from the records, the unlock rule, the ★ recommended street
// and the tolerance a tier plays at. Pure.
//   new       no throws yet
//   practice  some throws
//   working   ≥ 6 of the tier's last 12 throws, ≥ 60 % hits
//   secure    ≥ 8 plain-locate throws among the last 12, ≥ 80 % hits, mean PAE ≤ 3.5 % of the road (finger aim on a phone), and
//             no slip (the last two plain throws both missed): a slip brings a secure tier back to working
// A street unlocks when the one before is working (not secure), so there is always a choice of two; the first
// street opens with the Zombie Lab; an opened street stays open (skills.opened, stamped by the store). The ★ is the lowest open street that is not secure (else the highest open one).
import { PLAYABLE, TIERS, TOL_STEPS, TIER_BY_ID, isHit, toleranceFor } from './items.js';

export const RECORD_KEPT = 12;
export const WORKING_MIN = 6, WORKING_RATE = 0.6;
export const SECURE_MIN = 8, SECURE_RATE = 0.8, SECURE_PAE = 3.5;   // mean % of the road; 2.5 was too tight for finger aim on a phone
export const STATES = Object.freeze(['new', 'practice', 'working', 'secure']);
const CODE = { b: 'bull', h: 'hit', n: 'near', m: 'miss' };
export const resultOf = (code) => CODE[code] || 'miss';

/** The tier's throws, newest last: [{ at, pae, result, kind }] (the last 12 of every kind, merged by time). */
export function tierThrows(skills, tierId) {
  const out = [];
  for (const [key, list] of Object.entries((skills && skills.records) || {})) {
    const [t, kind] = key.split('.');
    if (t !== tierId || !Array.isArray(list)) continue;
    for (const x of list) out.push({ at: x[0], pae: x[1], result: resultOf(x[2]), kind });
  }
  return out.sort((a, b) => a.at - b.at);
}
const stats = (list) => {
  const n = list.length;
  const hits = list.filter((x) => isHit(x.result)).length;
  return { n, hits, rate: n ? hits / n : 0, pae: n ? list.reduce((a, x) => a + x.pae, 0) / n : null };
};
/** { n, hits, rate, pae (mean), locate: { … }, slip } over the tier's last 12 throws. */
export function tierStats(skills, tierId) {
  const all = tierThrows(skills, tierId);
  const last = all.slice(-RECORD_KEPT);
  const loc = all.filter((x) => x.kind === 'locate').slice(-RECORD_KEPT);
  const tail = loc.slice(-2);
  return { ...stats(last), locate: stats(loc), slip: tail.length === 2 && tail.every((x) => x.result === 'miss') };
}
export function tierState(skills, tierId) {
  const s = tierStats(skills, tierId);
  if (!s.n) return 'new';
  const l = s.locate;
  if (l.n >= SECURE_MIN && l.rate >= SECURE_RATE && l.pae <= SECURE_PAE + 1e-9 && !s.slip) return 'secure';
  if (s.n >= WORKING_MIN && s.rate >= WORKING_RATE) return 'working';
  return 'practice';
}
export const tierTolerance = (skills, tierId) => toleranceFor(tierState(skills, tierId));
const labDone = (skills) => !!(skills && skills.lab && skills.lab.done);

/** Is this tier's street open? T1 after the Lab; each next one once the one before is working or secure. */
export function isUnlocked(skills, tierId) {
  const i = PLAYABLE.indexOf(tierId);
  if (i < 0) return false;
  if (!labDone(skills)) return false;
  if (i === 0) return true;
  // once open, a street stays open (a slip on the street before never closes it: SPEC §6 "never auto-closed")
  return !!(skills.opened && skills.opened[tierId]) || ['working', 'secure'].includes(tierState(skills, PLAYABLE[i - 1]));
}
export const unlockedTiers = (skills) => PLAYABLE.filter((t) => isUnlocked(skills, t));
/** The ★ street's tier (null before the Lab). */
export function recommended(skills) {
  const open = unlockedTiers(skills);
  if (!open.length) return null;
  return open.find((t) => tierState(skills, t) !== 'secure') || open[open.length - 1];
}
/** The ladder in order with each tier's state (tiers not in this version: 'later'). */
export function ladderView(skills) {
  return TIERS.map((t) => ({ id: t.id, name: t.name, what: t.what, playable: t.playable,
    state: t.playable ? tierState(skills, t.id) : 'later', open: t.playable && isUnlocked(skills, t.id) }));
}
/** Oak Lane adds fifths, tenths and twelfths once its first denominators work. */
export const moreDenominators = (skills, tierId) => !!(TIER_BY_ID[tierId] && TIER_BY_ID[tierId].more) && ['working', 'secure'].includes(tierState(skills, tierId));
/** The tier before (for spaced review in a wave), or null. */
export const reviewTierOf = (tierId) => { const i = PLAYABLE.indexOf(tierId); return i > 0 ? PLAYABLE[i - 1] : null; };

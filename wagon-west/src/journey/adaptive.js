// Adaptive math (SPEC v1.5 §3.9): Wagon West reads the child's Trail Blazer facts store (the shared fact ladder; `facts` below is that store, or null) and
//  (a) offers the Pit Crew Check placement when the ladder is untouched (needsPlacement; placementSetup hands the app what Trail Blazer's createCheck needs), and
//  (b) scales the SHAPE of word problems with the ladder tier (problemTierFor → problemFor's `tier` option).
// Pure: no DOM, no clock (the caller passes `now`), no storage, no Math.random. The ladder's own functions are imported from Trail Blazer, never copied.
import { tierOf as ladderTierOf } from '../../../trail-blazer/src/facts/adaptive.js';
import { tiersFor, START_TIER } from '../../../trail-blazer/src/facts/placement.js';
import { recheckStart } from '../../../trail-blazer/src/facts/scouts.js';

/** The placement offer: it is made at most `maxOffers` times (Trail Blazer's MAX_CHECK_OFFERS is 3), never again once the check is done. */
export const PLACEMENT = { maxOffers: 3 };
/** The problem tiers: 0 = the table's first families (+ − ×2 ×5 ×10 ×3 ×4), 1 = ×6 to ×9 (T3 and T4 on the ladder), 2 = above ×6–×9 (×11 ×12, tens, teens, big numbers).
 *  Tier 0 and 1 are the shapes of 1.3.3; tier 2 is two-step ration and distance problems and a change-back step on a buy. */
export const PROBLEM_TIERS = { low: 0, mid: 1, high: 2 };
/** The highest ladder tier (Trail Blazer's tierOf: 0 = + −, 1 = ×2 ×5 ×10, 2 = ×3 ×4, 3 = ×6 ×9, 4 = ×7 ×8, 5 = ×11 ×12, 8 … 10 = tens, teens, big) of the mid band. */
const MID_MAX = 4;

const isObj = (x) => !!x && typeof x === 'object';
/** Has the child any history on the fact ladder (an answered fact, a race, XP, a placement)? */
export function hasFactsHistory(facts) {
  if (!isObj(facts)) return false;
  return !!facts.placement || Object.keys(isObj(facts.records) ? facts.records : {}).length > 0 || (Array.isArray(facts.races) && facts.races.length > 0)
    || (Number(facts.xp) || 0) > 0 || (Array.isArray(facts.gateLog) && facts.gateLog.length > 0) || (Number(facts.raceCount) || 0) > 0;
}
/** Should Wagon West offer the Pit Crew Check now (on the first store or marker)? True when the child's Trail Blazer ladder is untouched: a store exists, no placement and
 *  no facts history. False for a child who has a ladder (their frontier decides the problems), when there is no store to read, and after `PLACEMENT.maxOffers` offers
 *  (`offered`, the app's count). The app shows the check (Trail Blazer's pitCheck.js `run`, or `placementSetup` for its own panel). */
export function needsPlacement(facts, { offered = 0 } = {}) {
  if (!isObj(facts)) return false;
  if ((Number(offered) || 0) >= PLACEMENT.maxOffers) return false;
  return !hasFactsHistory(facts);
}
/** What Trail Blazer's `createCheck` needs to run the check for this child: { tiers, start, division } (the tiers the staircase walks for the parent's choices, where it
 *  starts, whether the ÷ twins are asked): tiersFor(facts.sets, facts, now) and 'T3' for a first check, the frontier's lowest tier for a re-check. */
export function placementSetup(facts, now = 0) {
  const sets = (facts && facts.sets) || {};
  return { tiers: tiersFor(sets, facts || null, now), start: facts && facts.placement ? recheckStart(facts) : START_TIER, division: sets.division !== false };
}

// the ladder tier of a frontier family: a ÷ family sits at its × family's tier ('d7' as 'x7'), so a child on ÷2 is not mistaken for one on big numbers
const familyTier = (fam) => {
  const f = String(fam || '');
  const t = ladderTierOf(f[0] === 'd' ? 'x' + f.slice(1) : f);
  return Number.isFinite(t) && t < 99 ? t : 0;
};
/** The problem tier for a child's ladder: from the highest family of their frontier (`facts.frontier.families`): 0 through ×5, 1 for ×6–×9, 2 above (×11 ×12, tens, teens,
 *  big numbers). 1 when there is no store (the shapes of 1.3.3); a child with no history has the first families on the frontier, so 0. */
export function problemTierFor(facts) {
  if (!isObj(facts)) return PROBLEM_TIERS.mid;
  const fam = facts.frontier && Array.isArray(facts.frontier.families) ? facts.frontier.families : [];
  if (!fam.length) return PROBLEM_TIERS.low;
  const top = Math.max(...fam.map(familyTier));
  return top > MID_MAX ? PROBLEM_TIERS.high : top >= 3 ? PROBLEM_TIERS.mid : PROBLEM_TIERS.low;
}

// The three stars of a leg (SPEC §3 "Arriving", §10): arrived, everyone happy, every marker right. Why these three:
// arriving is free (no fail state, so every leg earns at least one star and a bronze crate), everyone happy rewards
// running the party well (the pace and rations dials), and every marker right rewards the fact ladder. Stars are
// what right answers and good choices earn; nothing is ever taken away for a miss.
import { legOf } from './route.js';

export const STAR_NAMES = ['Arrived', 'Everyone happy', 'Every marker right'];
export const STAR_IDS = ['arrived', 'everyoneHappy', 'allMarkersRight'];

/** Has the party reached the leg's stop? */
export function hasArrived(J) {
  const leg = legOf(J && J.legId);
  return !!leg && J.milesDone >= leg.miles;
}
/** Is every member of the party happy right now (the companions' faces on the HUD)? */
export const everyoneHappy = (J) => Array.isArray(J.party) && J.party.length > 0 && J.party.every((p) => p.mood === 'happy');
/** Was every mile marker of this leg answered right (at least one asked)? */
export const allMarkersRight = (J) => J.legStats.markers > 0 && J.legStats.markersRight === J.legStats.markers;

/** The leg's stars as three booleans [arrived, everyoneHappy, allMarkersRight]. */
export function starsFor(J) {
  return [hasArrived(J), everyoneHappy(J), allMarkersRight(J)];
}
/** How many stars are lit. */
export const starCount = (stars) => (stars || []).filter(Boolean).length;

// The cliffhanger (The Lab, lab/SPEC.md §4.4 "Quick win: D4"): every leg's results end on a preview of the next stop, so a child always has a reason to come back and never a reason
// to hurry. PURE: no DOM, no clock, no storage.
//
//   nextStopPreview(J) → { legId, name, kind, painting, line, say, phrase, sayPhrase } or null
//     the stop the party is heading for next: its painting (the scene's `paintingFor(leg)` id), ONE true line (the first sentence of the stop's lookout fact: the same words the
//     child will read there, so nothing is invented; a leg may carry an optional `teaser` that wins), and the phrase "Next time: the ferry at the Kansas River" (a river with a ferry),
//     "the crossing at the Snake River" (any other river), "Fort Kearny" (a fort), "Chimney Rock" (a landmark, the diggings, the end of a trail).
//     Nothing is locked: the preview is a promise, and "Next leg" is always there. At a trail's end (nothing after the leg) there is no preview: null.
//   STOP_LINE, stopToday(play, day)   after the third leg finished on a local day the card adds "That's a good place to stop for today." (a kindness, never a gate)
import { LOOKOUTS } from '../content/lookouts.js';
import { LEG_BY_ID, ALL_LEGS } from '../content/legs.js';
import { legAt, legOf, planOf } from './route.js';

export const STOP_LINE = "That's a good place to stop for today.";
export const NEXT_TIME = 'Next time:';
/** How many legs make a good day (the third leg finished on a local day adds the stop line). */
export const LEGS_A_DAY = 3;

/** The first sentence of a text ("A. B." → "A."): up to the first full stop, question or exclamation mark that is followed by a space or the end. */
export function firstSentence(t) {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  const m = s.match(/^.*?[.!?](?=\s|$)/);
  return m ? m[0] : s;
}

/** "the ferry at the Kansas River" · "the crossing at the Snake River" · "Fort Kearny" · "Chimney Rock". */
export function phraseFor(leg) {
  const stop = (leg && leg.stop) || {};
  const name = stop.name || (leg && leg.name) || 'the next stop';
  if (stop.kind === 'river') return `${leg.ferry === false ? 'the crossing' : 'the ferry'} at the ${name}`;
  return name;
}

/** The leg the preview is about: the one after the leg just finished (the journey has already moved on to it by the time the results show), or the next one in the plan while
 *  the party is still at the stop. null at a trail's end. */
export function upcomingLeg(J) {
  if (!J || J.done) return null;
  if (J.trip && J.trip.arrived) { const plan = planOf(J); const i = plan.findIndex((p) => p.id === J.legId); return i >= 0 && plan[i + 1] ? legOf(plan[i + 1].id) : null; }
  return legOf(J.legId) || legAt(J.legIndex | 0) || null;
}

export function nextStopPreview(J) {
  const leg = upcomingLeg(J);
  if (!leg) return null;
  const look = LOOKOUTS[leg.lookout] || LOOKOUTS[leg.id] || null;
  const text = leg.teaser ? (leg.teaser.text || leg.teaser) : firstSentence(look && look.text);
  const say = leg.teaser ? (leg.teaser.say || text) : firstSentence(look && (look.say || look.text));
  const phrase = phraseFor(leg);
  return { legId: leg.id, name: (leg.stop && leg.stop.name) || leg.name, kind: (leg.stop && leg.stop.kind) || 'landmark', painting: leg.painting || leg.id,
    line: text, say, phrase, sayPhrase: `${NEXT_TIME} ${phrase}.` };
}

/** Have three legs been finished on this local day (save.play[day].legs)? */
export const stopToday = (play, day) => !!play && (play[day] ? play[day].legs | 0 : 0) >= LEGS_A_DAY;

/** Every line the preview of a leg can say (for the natural voice): "Next time: the ferry at the Kansas River." and the lookout's first sentence. */
export function previewTexts(legId) {
  const leg = LEG_BY_ID[legId];
  if (!leg) return [];
  const look = LOOKOUTS[leg.lookout] || LOOKOUTS[leg.id] || null;
  return [`${NEXT_TIME} ${phraseFor(leg)}.`, leg.teaser ? (leg.teaser.say || leg.teaser.text || leg.teaser) : firstSentence(look && (look.say || look.text))].filter(Boolean);
}
/** The preview lines of every leg of every route, and the stop line. */
export const allPreviewTexts = () => [STOP_LINE, ...ALL_LEGS.flatMap((l) => previewTexts(l.id))];

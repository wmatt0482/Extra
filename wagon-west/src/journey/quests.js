// Side quests (SPEC v1.4 §1.5, §3.4): one state machine for every quest, driven by the table in src/content/quests.js. A quest is an
// item that is found (by the dog's nose, a fished-up bottle, a fetch), clues (people at stops with two lines each), an owner (a person
// at a stop) and a reward. States, per season (J.quests[id] = { state, step, foundLeg, season, doneLeg? }):
//   none --(found: the nose slot, adoptDog at find.atStop, a fishing junk 'bottle', a fetch item)--> carried (step = the first clue
//          whose stop is not behind the party)
//   carried --(questTalk at a clue's stop)--> carried (step + 1)         clues whose stop is already behind are skipped ("heard on the way")
//   carried --(questTalk at the owner's stop, any step)--> returned      tokens, food (as 'other'), the card id for the app
//   carried --(questMail at a post office after the owner's stop)--> mailed   the card id; no tokens, no food
// A quest runs once a season; J.questsDone (ever) keeps the ones given back or mailed for the journal. The card is awarded by the app
// (awardCard: new once ever, a duplicate pays a trade token as every card does). Pure: no DOM, no clock, no storage, no Math.random.
import { QUESTS } from '../content/quests.js';
import { legIndexOf, legOf } from './route.js';
import { newQuestRecord } from './collections.js';
import { addFoodKind } from './supplies.js';

let table = QUESTS;
/** Swap the quest table (tests only: a synthetic 'glove' quest found by fetch proves the shape); null or empty restores the content. */
export function useQuests(list) { table = Array.isArray(list) && list.length ? list : QUESTS; return table; }
/** The quests in order. */
export const questList = () => table;
const questById = (id) => table.find((q) => q.id === id) || null;

const stepAt = (q) => (Array.isArray(q.steps) ? q.steps : []);
const recordOf = (J, id) => (J && J.quests && J.quests[id]) || newQuestRecord();
function idxOf(stopId) { return legIndexOf(stopId); }
const legIdx = (J) => (J.legIndex | 0);
// a stop is ahead of the party while it is on this leg's way or further: the stop of the leg being travelled counts until the party
// has left it; a stop of an earlier leg is behind
const stopBehind = (J, stopId) => { const i = idxOf(stopId); return i >= 0 && i < legIdx(J); };
const ownerAhead = (J, q) => { const i = idxOf(q.owner.at); return i > legIdx(J) || (i === legIdx(J) && !(J.trip && J.trip.arrived)); };

/** The quest (id) that can start by `via` ('nose' | 'fish' | 'fetch') right now: state 'none' this season, that way of being found,
 *  the current leg among the quest's find legs, and the owner's stop still ahead. null when none. */
export function questFindable(J, via) {
  if (!J) return null;
  const leg = legOf(J.legId);
  for (const q of table) {
    if (!q.find || q.find.via !== via) continue;
    if (recordOf(J, q.id).state !== 'none') continue;
    if (Array.isArray(q.find.legs) && !(leg && q.find.legs.includes(leg.id))) continue;
    if (!ownerAhead(J, q)) continue;
    return q.id;
  }
  return null;
}

/** The quest whose item the dog brings back when the dog is named at this stop (find.atStop), if it can start now (the owner ahead);
 *  null otherwise. Used by adoptDog. */
export function questAtStop(J, stopId) {
  for (const q of table) {
    if (!q.find || q.find.atStop !== stopId) continue;
    if (recordOf(J, q.id).state !== 'none') continue;
    if (!ownerAhead(J, q)) continue;
    return q.id;
  }
  return null;
}

/** The quest's item has been found: the quest is carried, its first clue the first stop not behind the party. Returns { quest, item },
 *  or null when the quest is unknown or already started this season (nothing changes then). */
export function findQuestItem(J, id) {
  const q = questById(id);
  if (!J || !q || recordOf(J, id).state !== 'none') return null;
  if (!J.quests || typeof J.quests !== 'object') J.quests = {};
  const steps = stepAt(q);
  let step = 0;
  while (step < steps.length && stopBehind(J, steps[step].at)) step++;
  J.quests[id] = { state: 'carried', step, foundLeg: J.legId, season: J.season };
  return { quest: q, item: q.item };
}

/** The people at a stop who belong to a quest (the Talk row's ❓ and 💛 portraits): a carried quest's pending clues here (every clue
 *  from its next one on that is at this stop) and its owner here. [{ questId, role: 'clue' | 'owner', person, lines, badge }]. */
export function questAt(J, stopId) {
  const out = [];
  if (!J) return out;
  for (const q of table) {
    const r = recordOf(J, q.id);
    if (r.state !== 'carried') continue;
    stepAt(q).forEach((s, i) => { if (i >= r.step && s.at === stopId) out.push({ questId: q.id, role: 'clue', person: s.person, lines: s.lines, badge: '❓', step: i }); });
    if (q.owner.at === stopId) out.push({ questId: q.id, role: 'owner', person: q.owner.person, lines: q.owner.lines, badge: '💛' });
  }
  return out;
}

const noteDone = (J, q, state) => {
  const r = J.quests[q.id];
  r.state = state; r.doneLeg = J.legId;
  if (!J.questsDone.includes(q.id)) J.questsDone.push(q.id);
  if (state === 'returned') J.totals.questsDone = (J.totals.questsDone | 0) + 1;
};

/** Talk to the person of a carried quest at the stop the party is at (J.legId; the app calls it from the Talk row). A clue advances the
 *  quest; the owner gives the item back: returns { role, lines, step, of, done, reward? } with reward = { tokens, food?, card } (tokens
 *  and food are already applied: the owner's gift goes into the wagon's 'other' food; the app awards the card). Idempotent: the same
 *  person again gives { …, again: true } and changes nothing. null when the quest has no person here. */
export function questTalk(J, id) {
  const q = questById(id);
  if (!J || !q) return null;
  const r = recordOf(J, id), here = J.legId;
  const steps = stepAt(q), of = steps.length;
  if (q.owner.at === here) {
    if (r.state === 'carried') {
      const reward = { tokens: (q.reward && q.reward.tokens) | 0, card: q.card };
      J.tokens = (J.tokens | 0) + reward.tokens;
      if (q.reward && q.reward.food) {
        reward.food = { ...q.reward.food };
        addFoodKind(J, 'other', q.reward.food.lb | 0);
      }
      noteDone(J, q, 'returned');
      return { role: 'owner', lines: q.owner.lines, step: of, of, done: true, reward };
    }
    if (r.state === 'returned' || r.state === 'mailed') return { role: 'owner', lines: q.owner.lines, step: of, of, done: true, again: true };
    return null;
  }
  if (r.state !== 'carried' && r.state !== 'returned' && r.state !== 'mailed') return null;
  const i = steps.findIndex((s) => s.at === here);
  if (i < 0) return null;
  if (r.state === 'carried' && i >= r.step) { r.step = i + 1; return { role: 'clue', lines: steps[i].lines, step: r.step, of, done: false }; }
  return { role: 'clue', lines: steps[i].lines, step: r.step, of, done: false, again: true };
}

/** At a fort's post office: every carried quest whose owner's stop is behind the party is mailed ahead (the card, no tokens, no food).
 *  `leg` defaults to the current leg. [{ questId, text, card }] and the quests are now 'mailed'. */
export function questMail(J, { leg } = {}) {
  const out = [];
  if (!J) return out;
  const here = legOf(leg || J.legId);
  const hi = here ? idxOf(here.id) : legIdx(J);
  for (const q of table) {
    const r = recordOf(J, q.id);
    if (r.state !== 'carried') continue;
    const oi = idxOf(q.owner.at);
    if (!(oi >= 0 && oi < hi)) continue;
    noteDone(J, q, 'mailed');
    J.quests[q.id].doneLeg = here ? here.id : J.legId;
    out.push({ questId: q.id, text: (q.mailed && q.mailed.text) || '', card: q.card });
  }
  return out;
}

/** The journal's quest list: this season's state of each quest ('none' | 'carried' | 'returned' | 'mailed'), the item, the clue step
 *  and the number of clues, the owner (name and stop), and `ever` (given back or mailed in some season). */
export function questStatus(J) {
  return table.map((q) => {
    const r = recordOf(J, q.id);
    return { questId: q.id, name: q.name, state: r.state, item: q.item, step: r.step | 0, of: stepAt(q).length,
      owner: { name: q.owner.person.name, at: q.owner.at }, ever: !!(J && Array.isArray(J.questsDone) && J.questsDone.includes(q.id)),
      foundLeg: r.foundLeg || null, doneLeg: r.doneLeg || null };
  });
}

/** The quest letter keys that belong to a leg (the leg a quest was returned or mailed on), for the journey letters. */
export function questLetterKeys(J, legId) {
  const out = [];
  for (const q of table) { const r = recordOf(J, q.id); if (q.letter && (r.state === 'returned' || r.state === 'mailed') && r.doneLeg === legId) out.push(q.letter); }
  return out;
}

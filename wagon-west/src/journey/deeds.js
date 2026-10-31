// Deeds (SPEC v1.2 §4): twenty things a family can do on the trail that are worth a badge in the Journal's "Deeds" page and
// a trade token. None of them is a gate (SPEC §1): they are all things the trail rewards by playing it well, and none is
// ever taken away. Each is a pure test over the journey's counters (J.totals, J.cards, J.animals, J.met), so a deed is
// earned the moment its counter says so, whichever way the child got there.
//   DEEDS = [{ id, name, emoji, how, say }]   how: the one line the Journal shows; say: the spoken line when earned
//   checkDeeds(J) → the ids earned by this call (also pushed to J.deeds, +1 token each); [] when nothing new.
// The app calls checkDeeds after an arrival, a river, a repair, a camp, a derby, a raft, a stampede, a person met.
import { legList } from './route.js';

export const DEEDS = [
  { id: 'dry-feet', name: 'Dry feet', emoji: '👣', how: 'Cross every river of a year without soaking a sack of flour.', say: 'Dry feet! Every river crossed, and not one sack of flour got wet.' },
  { id: 'mail-beater', name: 'Mail beater', emoji: '🏁', how: 'Win three races against the mail wagon at the forts.', say: 'Mail beater! Three wins against the mail wagon.' },
  { id: 'full-wagon', name: 'Full wagon', emoji: '🧺', how: 'Finish a leg without the food running low.', say: 'Full wagon! A whole leg with plenty to eat.' },
  { id: 'card-shark', name: 'Card shark', emoji: '🃏', how: 'Collect twenty trail cards.', say: 'Card shark! Twenty trail cards in the album.' },
  { id: 'people-person', name: 'People person', emoji: '🗣️', how: 'Talk to twelve people along the trail.', say: 'People person! Twelve people met along the trail.' },
  { id: 'cold-proof', name: 'Cold proof', emoji: '🧣', how: 'Cross the Blue Mountains with a blanket for every two people.', say: 'Cold proof! Everyone stayed warm in the Blue Mountains.' },
  { id: 'fixer', name: 'Fixer', emoji: '🔧', how: 'Mend the wagon three times.', say: 'Fixer! Three repairs, and the wagon rolls on.' },
  { id: 'angler', name: 'Angler', emoji: '🎣', how: 'Catch fifty pounds of fish.', say: 'Angler! Fifty pounds of fish caught.' },
  { id: 'archer', name: 'Archer', emoji: '🏹', how: 'Bring home one hundred pounds of game.', say: 'Archer! One hundred pounds of game brought home.' },
  { id: 'spelling-ferry', name: 'Spelling ferry', emoji: '⛴️', how: 'Pay a ferry fare with every word spelled right.', say: 'Spelling ferry! The ferryman got every word right.' },
  { id: 'marker-master', name: 'Marker master', emoji: '📍', how: 'Answer every mile marker right in one leg.', say: 'Marker master! Every marker right in one leg.' },
  { id: 'summiteer', name: 'Summiteer', emoji: '⛰️', how: 'Reach South Pass.', say: 'Summiteer! You made it to South Pass.' },
  { id: 'homesteader', name: 'Homesteader', emoji: '🏡', how: 'Reach the Willamette Valley.', say: 'Homesteader! You reached the Willamette Valley.' },
  { id: 'raft-rider', name: 'Raft rider', emoji: '🛶', how: 'Run the Columbia on the raft without a single bump.', say: 'Raft rider! Down the Columbia without a bump.' },
  { id: 'bison-brake', name: 'Bison brake', emoji: '🦬', how: 'Hold the wagon steady through a bison stampede.', say: 'Bison brake! The wagon held through the stampede.' },
  { id: 'yoke-up', name: 'Yoke up', emoji: '🐂', how: 'Buy a second yoke and hitch up four animals.', say: 'Yoke up! Four animals pull the wagon now.' },
  { id: 'camper', name: 'Camper', emoji: '🏕️', how: 'Make camp five times.', say: 'Camper! Five nights by the campfire.' },
  { id: 'wait-it-out', name: 'Wait it out', emoji: '⛈️', how: 'Wait out a storm at camp.', say: 'Wait it out! You let the storm pass.' },
  { id: 'gold-rush', name: 'Gold rush', emoji: '🥇', how: 'Earn a gold crate on three legs.', say: 'Gold rush! Three golden legs.' },
  { id: 'trader', name: 'Trader', emoji: '🤝', how: 'Trade for ten goods at the trading posts.', say: 'Trader! Ten goods traded fairly.' },
];
export const DEED_BY_ID = Object.fromEntries(DEEDS.map((d) => [d.id, d]));
/** Tokens a deed pays when it is earned. */
export const DEED_TOKENS = 1;

const n = (x) => (Number.isFinite(x) ? x : 0);
const reached = (T, id) => Array.isArray(T.reached) && T.reached.includes(id);
// the river legs of the current trail: 'dry-feet' needs every one of them crossed
const riverLegs = () => legList().filter((l) => l.stop && l.stop.kind === 'river').map((l) => l.id);

const TESTS = {
  'dry-feet': (J, T) => { const ids = riverLegs(); return ids.length > 0 && ids.every((id) => Array.isArray(T.crossed) && T.crossed.includes(id)) && n(T.soakedCrossings) === 0; },
  'mail-beater': (J, T) => n(T.derbyWon) >= 3,
  'full-wagon': (J, T) => n(T.fullWagonLegs) >= 1,
  'card-shark': (J) => Array.isArray(J.cards) && J.cards.length >= 20,
  'people-person': (J, T) => n(T.peopleMet) >= 12,
  'cold-proof': (J, T) => n(T.blueProof) >= 1,
  fixer: (J, T) => n(T.repairs) >= 3,
  angler: (J, T) => n(T.fishLb) >= 50,
  archer: (J, T) => n(T.meatLb) >= 100,
  'spelling-ferry': (J, T) => n(T.ferryPerfect) >= 1,
  'marker-master': (J, T) => n(T.markersPerfectLegs) >= 1,
  summiteer: (J, T) => reached(T, 'south-pass'),
  homesteader: (J, T) => reached(T, 'willamette-valley') || !!(J.done && n(T.legs) >= legList().length),
  'raft-rider': (J, T) => n(T.raftClean) >= 1,
  'bison-brake': (J, T) => n(T.stampedesHeld) >= 1,
  'yoke-up': (J) => !!(J.animals && J.animals.n >= 4),
  camper: (J, T) => n(T.camps) >= 5,
  'wait-it-out': (J, T) => n(T.waitedOut) >= 1,
  'gold-rush': (J, T) => n(T.goldLegs) >= 3,
  trader: (J, T) => n(T.traded) >= 10,
};

/** Is this deed's test true right now (earned or not)? */
export function deedMet(J, id) {
  const test = TESTS[id];
  return !!(J && test && test(J, J.totals || {}));
}

/** Earn every deed whose test is now true and that the journey does not have yet: pushes the ids to J.deeds, adds a token
 *  each, and returns the new ids in DEEDS order. Idempotent: a second call returns []. */
export function checkDeeds(J) {
  if (!J) return [];
  if (!Array.isArray(J.deeds)) J.deeds = [];
  const out = [];
  for (const d of DEEDS) {
    if (J.deeds.includes(d.id) || !deedMet(J, d.id)) continue;
    J.deeds.push(d.id);
    J.tokens = (J.tokens | 0) + DEED_TOKENS;
    out.push(d.id);
  }
  return out;
}

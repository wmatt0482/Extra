// Deeds (SPEC v1.2 §4, v1.4 §3.8, v1.5 §3.7: fifty-three now: v1.2's twenty, v1.4's eight and v1.5's twenty-five): twenty things a family can do on the trail that are worth a badge in the Journal's "Deeds" page and
// a trade token. None of them is a gate (SPEC §1): they are all things the trail rewards by playing it well, and none is
// ever taken away. Each is a pure test over the journey's counters (J.totals, J.cards, J.animals, J.met), so a deed is
// earned the moment its counter says so, whichever way the child got there.
//   DEEDS = [{ id, name, emoji, how, say }]   how: the one line the Journal shows; say: the spoken line when earned
//   checkDeeds(J, ledger?, farm?) → the ids earned by this call (also pushed to J.deeds, +1 token each); [] when nothing new.
// The app calls checkDeeds after an arrival, a river, a repair, a camp, a derby, a raft, a stampede, a person met.
import { legList, usePlan, siteOfLeg } from './route.js';
import { FISH } from '../content/fish.js';
import { CARD_SETS } from '../content/cards.js';
import { PIECE_BY_ID } from '../content/homestead.js';
import { homesteadView } from './homestead.js';

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
  { id: 'spelling-ferry', name: 'Spelling ferry', emoji: '🚣', how: 'Pay a ferry fare with every word spelled right.', say: 'Spelling ferry! The ferryman got every word right.' },
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
  // v1.4: Frodo and the river (pure fun; each +1 token, once)
  { id: 'good-nose', name: 'Good nose', emoji: '🐕', how: 'The dog brings back six different finds.', say: 'Good nose! Six different finds from the dog.' },
  { id: 'fetch-champ', name: 'Fetch champ', emoji: '🥎', how: 'Earn twenty-five treats at fetch.', say: 'Fetch champ! Twenty-five treats earned at fetch.' },
  { id: 'big-one', name: 'The big one', emoji: '🐋', how: 'Land a white sturgeon.', say: 'The big one! A white sturgeon, landed at last.' },
  { id: 'river-guide', name: 'River guide', emoji: '🎣', how: 'Catch all six kinds of fish.', say: 'River guide! All six kinds of fish are in the log.' },
  { id: 'skipper', name: 'Skipper', emoji: '🪨', how: 'Skip a stone seven times in one throw.', say: 'Skipper! Seven skips in a single throw.' },
  { id: 'keeper', name: 'Keeper', emoji: '📿', how: 'Give a treasure back to the person it belongs to.', say: 'Keeper! You gave it back to its owner.' },
  { id: 'wish-maker', name: 'Wish maker', emoji: '🌠', how: 'Make six wishes on falling stars.', say: 'Wish maker! Six wishes on falling stars.' },
  { id: 'hat-trick', name: 'Hat trick', emoji: '🎩', how: 'Catch every hat in a dust devil.', say: 'Hat trick! Every hat caught in the dust devil.' },
  // v1.5: The Long Trail (each +1 token, once)
  { id: 'long-trail', name: 'The long trail', emoji: '🛤️', how: 'Reach the Willamette Valley on the full trail of twenty stops.', say: 'The long trail! All the way to Oregon, the long way round.' },
  { id: 'california-bound', name: 'California bound', emoji: '🌄', how: 'Reach the Sacramento Valley.', say: 'California bound! You made it over the mountains to the Sacramento Valley.' },
  { id: 'barlow', name: 'Barlow Road', emoji: '🚧', how: 'Take the Barlow Road, toll paid or toll owed.', say: 'Barlow Road! Over the shoulder of Mount Hood.' },
  { id: 'laurel-hill', name: 'Laurel Hill', emoji: '🪢', how: 'Let the wagon down Laurel Hill smoothly.', say: 'Laurel Hill! Down the steep slope on the ropes, nice and smooth.' },
  { id: 'shortcut', name: 'The shortcut', emoji: '✂️', how: 'Take the Sublette Cutoff.', say: 'The shortcut! Across the dry sage on the Sublette Cutoff.' },
  { id: 'lander', name: 'Lander Road', emoji: '🛣️', how: 'Take the Lander Road.', say: 'Lander Road! One of the first roads the government built for wagons.' },
  { id: 'dry-drive', name: 'Dry drive', emoji: '🛢️', how: 'Cross a dry stretch with the water barrel on board.', say: 'Dry drive! The barrel kept everyone cool across the dry stretch.' },
  { id: 'ice-in-july', name: 'Ice in July', emoji: '🧊', how: 'Dig ice at Ice Slough.', say: 'Ice in July! Real ice, under the grass.' },
  { id: 'axle-grease', name: 'Axle grease', emoji: '✍️', how: 'Write the wagon\'s name at City of Rocks.', say: 'Axle grease! Your wagon\'s name is on the rock at City of Rocks.' },
  { id: 'gold-road', name: 'The Gold Road', emoji: '🪙', how: 'Reach Coloma.', say: 'The Gold Road! You reached Coloma, where the gold was found.' },
  { id: 'first-flake', name: 'First flake', emoji: '✨', how: 'Find your first gold.', say: 'First flake! Something glints at the bottom of the pan.' },
  { id: 'nugget', name: 'Nugget!', emoji: '🟡', how: 'Find a nugget.', say: 'A nugget! A real one, as big as a bean.' },
  { id: 'gold-fever', name: 'Gold fever', emoji: '💰', how: 'Bring home ten nuggets in all.', say: 'Gold fever! Ten nuggets brought home.' },
  { id: 'rocker', name: 'Rock the cradle', emoji: '🪣', how: 'Rock the cradle on the beat for a whole round.', say: 'Rock the cradle! A whole round right on the beat.' },
  { id: 'home-by-sea', name: 'Home by sea', emoji: '⛵', how: 'Sail home over the Columbia bar.', say: 'Home by sea! Over the Columbia bar and into the river.' },
  { id: 'beaver-money', name: 'Beaver money', emoji: '🦫', how: 'Bring gold home to be made into Beaver money.', say: 'Beaver money! Your gold is coins with a beaver on them.' },
  { id: 'every-way', name: 'Every way', emoji: '🧭', how: 'Reach both homesteads and Coloma.', say: 'Every way! Two homesteads, and you have panned at Coloma.' },
  { id: 'veteran', name: 'Veteran', emoji: '🥈', how: 'Finish a Veteran journey.', say: 'Veteran! A whole journey on the harder trail.' },
  { id: 'pioneer', name: 'Pioneer', emoji: '🏔️', how: 'Finish a Pioneer journey.', say: 'Pioneer! The hardest trail, and you made it.' },
  { id: 'cabin', name: 'A cabin of your own', emoji: '🛖', how: 'Build a cabin.', say: 'A cabin of your own! Smoke from the chimney.' },
  { id: 'barn-raising', name: 'Barn raising', emoji: '🪵', how: 'Raise a barn.', say: 'Barn raising! Everyone hammered together.' },
  { id: 'name-plate', name: 'Name plate', emoji: '🪧', how: 'Hang the name plate with your farm\'s name.', say: 'Name plate! Your farm has its name at the gate.' },
  { id: 'full-farm', name: 'Full farm', emoji: '🚜', how: 'Build every piece at one homestead.', say: 'Full farm! Nothing is left to build.' },
  { id: 'two-homes', name: 'Two homes', emoji: '🏘️', how: 'Have a homestead at both ends of the trail.', say: 'Two homes! A farm in Oregon and a claim in California.' },
  { id: 'set-collector', name: 'Set collector', emoji: '🗂️', how: 'Complete three card sets.', say: 'Set collector! Three card sets complete.' },
];
export const DEED_BY_ID = Object.fromEntries(DEEDS.map((d) => [d.id, d]));
/** Tokens a deed pays when it is earned. */
export const DEED_TOKENS = 1;

const n = (x) => (Number.isFinite(x) ? x : 0);
const reached = (T, id) => Array.isArray(T.reached) && T.reached.includes(id);
// the river legs of the current trail: 'dry-feet' needs every one of them crossed
const riverLegs = () => legList().filter((l) => l.stop && l.stop.kind === 'river').map((l) => l.id);

// v1.5: the farm, the ledger and the cards (checkDeeds(J) alone still works: without them the farm and ledger deeds are simply not earned yet)
const piece = (farm, id) => !!farm && !!farm.sites && Object.values(farm.sites).some((st) => st && st.pieces && n(st.pieces[id]) > 0);
const sitesOf = (farm) => (farm && farm.sites ? Object.keys(farm.sites) : []);
const lastSite = (J) => { const p = Array.isArray(J.plan) && J.plan.length ? J.plan[J.plan.length - 1] : legList()[legList().length - 1]; return p ? siteOfLeg(p.id) : null; };
// gold brought home, in flakes: the farm's (banked) plus this journey's when it is over and not banked yet; the ledger's lifetime when there is no farm
const goldHome = (J, ledger, farm) => Math.max(farm ? n(farm.goldIn) : 0, ledger && ledger.lifetime ? n(ledger.lifetime.flakes) : 0) + (J.done && !J.banked && !J.closed ? n(J.gold) : 0);
const tierDone = (J, ledger, t) => (ledger && ledger.tiersDone && n(ledger.tiersDone[t]) > 0) || (!!J.done && J.tier === t) || (t === 'veteran' && !!J.done && J.tier === 'pioneer');
/** The sets whose cards the journey holds all of (CARD_SETS), in the content's order: [setId]. */
export const completedSets = (cards) => CARD_SETS.filter((st) => st.cards.length > 0 && st.cards.every((c) => Array.isArray(cards) && cards.includes(c))).map((st) => st.id);
/** The sets that are complete now and not yet in `setsDone` (the save's list): the app pays each one's decoration once and records it. Pure. */
export function checkSets(J, setsDone = []) {
  const done = Array.isArray(setsDone) ? setsDone : [];
  return completedSets(J && J.cards).filter((id) => !done.includes(id));
}

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
  homesteader: (J, T) => reached(T, 'willamette-valley') || reached(T, 'barlow-road') || !!(J.done && n(T.legs) >= legList().length && lastSite(J) === 'willamette'),
  'raft-rider': (J, T) => n(T.raftClean) >= 1,
  'bison-brake': (J, T) => n(T.stampedesHeld) >= 1,
  'yoke-up': (J) => !!(J.animals && J.animals.n >= 4),
  camper: (J, T) => n(T.camps) >= 5,
  'wait-it-out': (J, T) => n(T.waitedOut) >= 1,
  'gold-rush': (J, T) => n(T.goldLegs) >= 3,
  trader: (J, T) => n(T.traded) >= 10,
  // v1.4
  'good-nose': (J) => J.finds && Object.values(J.finds).filter((x) => n(x) > 0).length >= 6,
  'fetch-champ': (J, T) => Math.max(n(T.treats), J.dog ? n(J.dog.treats) : 0) >= 25,
  'big-one': (J, T) => n(T.sturgeon) >= 1 || !!(J.fishLog && J.fishLog['white-sturgeon'] && n(J.fishLog['white-sturgeon'].n) > 0),
  'river-guide': (J) => !!J.fishLog && FISH.length > 0 && FISH.every((f) => J.fishLog[f.id] && n(J.fishLog[f.id].n) > 0),
  skipper: (J) => !!J.skips && n(J.skips.best) >= 7,
  keeper: (J, T) => n(T.questsDone) >= 1,
  'wish-maker': (J) => Array.isArray(J.wishes) && J.wishes.length >= 6,
  'hat-trick': (J, T) => n(T.hatsAll) >= 1,
  // v1.5
  'long-trail': (J, T) => (reached(T, 'willamette-valley') || reached(T, 'barlow-road')) && (J.route || 'emigrant') === 'emigrant' && Array.isArray(J.plan) && J.plan.length >= 20,
  'california-bound': (J, T) => reached(T, 'sacramento-valley'),
  barlow: (J, T) => n(T.tolls) >= 1,
  'laurel-hill': (J, T) => n(T.snubsSmooth) >= 1,
  shortcut: (J, T) => reached(T, 'sublette-cutoff'),
  lander: (J, T) => reached(T, 'lander-road'),
  'dry-drive': (J, T) => n(T.dryDrives) >= 1,
  'ice-in-july': (J, T) => n(T.iceDug) >= 1,
  'axle-grease': (J, T) => n(T.axleGrease) >= 1,
  'gold-road': (J, T) => reached(T, 'coloma'),
  'first-flake': (J, T) => n(T.flakes) >= 1 || n(J.gold) >= 1,
  nugget: (J, T) => n(T.nuggets) >= 1,
  'gold-fever': (J, T, ledger, farm) => goldHome(J, ledger, farm) >= 100,
  rocker: (J, T) => n(T.rockerBeat) >= 1,
  'home-by-sea': (J, T) => reached(T, 'home-by-sea'),
  'beaver-money': (J, T, ledger, farm) => goldHome(J, ledger, farm) > 0,
  'every-way': (J, T, ledger, farm) => sitesOf(farm).includes('willamette') && sitesOf(farm).includes('sacramento')
    && (reached(T, 'coloma') || (!!ledger && Array.isArray(ledger.routesDone) && ledger.routesDone.includes('gold-road'))),
  veteran: (J, T, ledger) => tierDone(J, ledger, 'veteran'),
  pioneer: (J, T, ledger) => tierDone(J, ledger, 'pioneer'),
  cabin: (J, T, ledger, farm) => piece(farm, 'cabin'),
  'barn-raising': (J, T, ledger, farm) => piece(farm, 'barn'),
  'name-plate': (J, T, ledger, farm) => !!farm && sitesOf(farm).some((id) => farm.sites[id].name && n(farm.sites[id].pieces['name-plate']) > 0),
  'full-farm': (J, T, ledger, farm) => sitesOf(farm).some((id) => homesteadView(farm, id).complete),
  'two-homes': (J, T, ledger, farm) => sitesOf(farm).includes('willamette') && sitesOf(farm).includes('sacramento'),
  'set-collector': (J) => completedSets(J.cards).length >= 3,
};

/** Is this deed's test true right now (earned or not)? The ledger and the farm (save-level) are only needed by the farm, gold-at-home and tier deeds. */
export function deedMet(J, id, ledger = null, farm = null) {
  const test = TESTS[id];
  return !!(J && test && test(J, J.totals || {}, ledger, farm));
}

/** Earn every deed whose test is now true and that the journey does not have yet: pushes the ids to J.deeds, adds a token
 *  each, and returns the new ids in DEEDS order. Idempotent: a second call returns []. */
export function checkDeeds(J, ledger = null, farm = null) {
  if (!J) return [];
  if (!Array.isArray(J.deeds)) J.deeds = [];
  usePlan(J);
  const out = [];
  for (const d of DEEDS) {
    if (J.deeds.includes(d.id) || !deedMet(J, d.id, ledger, farm)) continue;
    J.deeds.push(d.id);
    J.tokens = (J.tokens | 0) + DEED_TOKENS;
    out.push(d.id);
  }
  return out;
}

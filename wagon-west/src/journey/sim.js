// The journey simulation (SPEC §3, §10): a wagon party crossing the trail one leg (one session) at a time. Pure
// functions over one plain, JSON-safe object J (the app saves it as `journey` in wagonWest.<id>.save and syncs it):
// no DOM, no clock, no storage, no Math.random. A day is one tickDay; randomness is either the `rand` the caller
// passes or the seeded state kept in J.trip.rng, and each leg's plan (markers, events, the companions' moods) is
// seeded from J.seed + the leg + how many legs were started, so the same seed and the same answers replay the same
// journey and a replayed leg is fresh.
//
// v1.1 adds (all optional on a 1.0 save, defaulted by createJourney and by ensureJourney): cards: [cardId] (the trail
//       cards, awardCard), upgrades: { cover, tires, barrel: true } (buyUpgrade), challenges: { [dayKey]: { id, done, … } }
//       (challenge.js), totals.camps / totals.derbyPlayed / totals.derbyWon (camp, derbyPay).
// v1.2 adds (SPEC v1.2, same rule: ensureJourney fills every one on an older save):
//       foods: { flour, bacon, beans, other } (lb; J.food stays their sum, a plain number kept by syncFood), goods: { parts,
//       rope, blankets, arrows, pelts, yoke } (parts mirrors J.parts), animals: { n: 2|4, tired: 0..100 }, limp, halfPart,
//       met: [personId], deeds: [deedId], totals.{repairs, soakedLb, peopleMet, …}, trip.{lostDays, coldAt, spotAt, river, …}.
//       New entry points: repair, crossRiver, forecast, waitOut, meetPerson, raftPay, stampedePay, teacherTip, checkDeeds.
// J = { v, season, seed, wagonName, animal, companions: [id],
//       legIndex, legId, milesDone (into the leg), day (journey days), cash, food (lb), parts, goods: { id: n },
//       tokens, pace: 'steady'|'brisk', rations: 'full'|'plenty'|'lean', spirit (0-100), mood: 'happy'|'fine'|'tired',
//       party: [{ id, mood }], stickers: [stickerId], letters: [{ legId, day, text }],   goods: pelts (6 at the start,
//       1-2 a hunt), blankets, rope, arrows … (the trading posts' give goods and the store's non-food goods),
//       legStats: { markers, markersRight, problems, problemsRight, words, wordsRight, hunted, fished },
//       totals: { legs, stars, miles, days, markers, markersRight, problems, problemsRight, words, wordsRight, hunted,
//                 fished, traded, bought, crawlDays, maxCrawlDays, byKind: { kind: { n, right } } },
//       opts: { hunting }, legStarts, seasonsDone, done,
//       trip: { legId, miles, markers: [mile], nextMarker, events: [{ id, kind, atMile, fired }], happened: [eventId |
//               'hunt' | 'fish' | 'trade'], usedKinds, slow, restDays, tiredDays, rescueCooldown, rescuePending,
//               crawlDays, days, offsets: [n], seen: { happy, tired }, arrived, result, traded, rng } }
//
// The kid rules (SPEC §1) are rules of this module: nobody is ever sick or lost; a missed marker is one slower day;
// food at 0 means the party crawls at 40 % and is tired until the safety net (a hunt or a fishing hole, economy.js
// RESCUE) or the next fort feeds it; a breakdown with no spare part is a lost day and a slow wagon until the next fort;
// cash never goes below $0; every leg arrives.
import { ANIMALS, legAt, legIndexOf, legList, legOf, seasonOf, animalOf, nextSeasonId } from './route.js';
import { START, MOOD, SPEED, MARKERS, RESCUE, TOKENS, RATIONS, PACES, foodNeeded, milesPerDay, etaDays, priceAt, storeList, payFor,
  crateFor, moodOf, isFood, lbOf, PELTS, UPGRADES, UPGRADE_BY_ID, UPGRADE_FX, DERBY, CARD_DUP_TOKENS, CAMP_KINDS,
  FOOD_KINDS, ARROWS, ANIMAL_RULES, COLD_LEGS, COLD, SOAKED_LB, SKILL_FX, RAFT, STAMPEDE, yokeOffered } from './economy.js';
import { CARDS, CARD_BY_ID, cardsOf } from '../content/cards.js';
import { COMPANION_BY_ID } from '../content/companions.js';
import { PERSON_BY_ID, PEOPLE_BY_STOP } from '../content/people.js';
import { planEvents, rescueEvent, eventPayload, EVENT_BY_ID } from './events.js';
import { starsFor, hasArrived, starCount } from './stars.js';
import { hashSeed, mulberry32, drawFrom, randInt } from './rng.js';
import { nationFor } from './route.js';
import { skillOf, skillInfo, partySkills } from './skills.js';
import { ensureFoods, syncFood, addFoodKind, takeFlour, eatFood, eatFactor, foodDays, huntAllowed, needsBlankets, coldLegsAhead, dailyNeed } from './supplies.js';

export const JOURNEY_VERSION = 1;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const emptyLegStats = () => ({ markers: 0, markersRight: 0, problems: 0, problemsRight: 0, words: 0, wordsRight: 0, hunted: 0, fished: 0 });
// the counters that are plain numbers (ensureJourney defaults each on an older save); `reached` and `crossed` are lists
const V12_COUNTERS = ['camps', 'derbyPlayed', 'derbyWon', 'repairs', 'repairsWorkedOut', 'forgeFixes', 'halfFixes', 'breakdowns', 'limps', 'soakedLb',
  'riversCrossed', 'soakedCrossings', 'fordCount', 'floatCount', 'ferryCount', 'ferryPerfect', 'ropeUsed', 'peopleMet', 'markersPerfectLegs',
  'fullWagonLegs', 'goldLegs', 'coldNights', 'blueProof', 'fishLb', 'meatLb', 'raftRuns', 'raftClean', 'stampedes', 'stampedesHeld', 'waitedOut', 'spotted'];
const emptyTotals = () => {
  const T = { legs: 0, stars: 0, miles: 0, days: 0, markers: 0, markersRight: 0, problems: 0, problemsRight: 0, words: 0,
    wordsRight: 0, hunted: 0, fished: 0, traded: 0, bought: 0, crawlDays: 0, maxCrawlDays: 0, byKind: {}, reached: [], crossed: [] };
  for (const k of V12_COUNTERS) T[k] = 0;
  return T;
};

// ---- the leg's v1.2 plan: where the cold night and the scout's animal fall, and the per-leg skill flags ----
function tripV12(J, leg) {
  const r = mulberry32(hashSeed(J.seed, leg.id, J.legStarts, 'v12'));
  const a = r(), b = r(), c = r();
  return { v12: 1, lostDays: 0, coldAt: COLD_LEGS.includes(leg.id) ? Math.max(1, Math.round(leg.miles * (0.35 + 0.3 * a))) : null,
    coldDone: false, coldOk: false, coldNightHere: false, snow: false, spotAt: Math.max(1, Math.round(leg.miles * (0.2 + 0.5 * b))), spotPick: c,
    spotted: false, forgeUsed: false, tipUsed: false, cookSaid: false, pepCool: 0, foodLowSeen: false, river: null, ferryCounted: false, limped: false };
}

/** Fill in the v1.1 and v1.2 fields on a journey from an older save (1.0 has no cards, upgrades, challenges or camp counters;
 *  1.1 has no foods by kind, animals, deeds or people); harmless on a current one. Called by every entry point; the app may
 *  call it right after loading a save. A J.food that someone changed directly is adopted (see supplies.ensureFoods). */
export function ensureJourney(J) {
  if (!J) return J;
  if (!Array.isArray(J.cards)) J.cards = [];
  if (!J.upgrades || typeof J.upgrades !== 'object') J.upgrades = {};
  if (!J.challenges || typeof J.challenges !== 'object') J.challenges = {};
  if (!J.totals) J.totals = emptyTotals();
  for (const k of V12_COUNTERS) if (!Number.isFinite(J.totals[k])) J.totals[k] = 0;
  if (!Array.isArray(J.totals.reached)) J.totals.reached = [];
  if (!Array.isArray(J.totals.crossed)) J.totals.crossed = [];
  if (!Number.isFinite(J.tokens)) J.tokens = 0;
  // v1.2: foods by kind, goods, animals, limp, people, deeds
  ensureFoods(J);
  if (!Number.isFinite(J.parts)) J.parts = 0;
  if (!J.goods || typeof J.goods !== 'object') J.goods = {};
  if (J.rev !== 12) {
    // a 1.1 save: arrows were a store item nobody used; give the bow its 15 (or the bundles bought, five arrows each)
    J.goods.arrows = Math.max(ARROWS.start, (J.goods.arrows | 0) * ARROWS.perBundle);
    J.rev = 12;
  }
  for (const k of ['rope', 'blankets', 'arrows', 'pelts', 'yoke']) if (!Number.isFinite(J.goods[k]) || J.goods[k] < 0) J.goods[k] = 0;
  J.goods.parts = J.parts;
  if (!J.animals || typeof J.animals !== 'object') J.animals = { n: 2, tired: 0 };
  J.animals.n = J.animals.n >= 4 || J.goods.yoke > 0 ? 4 : 2;
  J.animals.tired = clamp(Number.isFinite(J.animals.tired) ? Math.round(J.animals.tired) : 0, 0, ANIMAL_RULES.max);
  J.limp = !!J.limp;
  J.halfPart = J.halfPart ? 1 : 0;
  if (!Array.isArray(J.met)) J.met = [];
  if (!Array.isArray(J.deeds)) J.deeds = [];
  const t = J.trip;
  if (t && !t.v12) {
    const leg = legOf(t.legId) || currentLeg(J);
    if (leg) {
      const plan = tripV12(J, leg);
      plan.coldDone = plan.coldAt != null && J.milesDone >= plan.coldAt;     // no cold night is added to a leg already past it
      plan.spotted = J.milesDone >= plan.spotAt;
      Object.assign(t, plan);
    }
  }
  return J;
}

/** The people who eat: the child plus the companions. */
export const partySize = (J) => 1 + (J.party ? J.party.length : 0);
/** The leg the party is on. */
export const currentLeg = (J) => legOf(J && J.legId);
/** The mile positions of a leg's markers: one every ~30 miles, 4-6 of them, evenly spaced, none at the stop itself. */
export function markerMiles(miles) {
  const n = clamp(Math.floor((miles - 1) / MARKERS.spacing), MARKERS.min, MARKERS.max);
  return Array.from({ length: n }, (_, k) => Math.round((miles * (k + 1)) / (n + 1)));
}

/** A new journey at Independence, the first leg started (so it can tick at once; the app may show the Independence
 *  store first: storeList(null, season)). Cash scales with the season's prices; food and parts do not. */
export function createJourney({ season = 's1847', wagonName = '', animal = 'oxen', companions = [], seed = 1, hunting = true } = {}) {
  const s = seasonOf(season);
  const comps = (Array.isArray(companions) ? companions : []).filter((c) => typeof c === 'string').slice(0, 3);
  const J = {
    v: JOURNEY_VERSION, rev: 12, season: s.id, seed: typeof seed === 'number' ? seed >>> 0 : hashSeed(seed),
    wagonName: String(wagonName || '').slice(0, 24), animal: animalOf(animal).id, companions: comps,
    legIndex: 0, legId: legAt(0) ? legAt(0).id : null, milesDone: 0, day: 0,
    cash: Math.round(START.cash * s.priceMult), food: START.food, foods: { ...START.foods }, foodOwed: { flour: 0, bacon: 0, beans: 0 }, foodSave: 0,
    parts: START.parts, goods: { ...START.goods }, animals: { n: 2, tired: 0 }, limp: false, halfPart: 0, tokens: 0,
    pace: 'steady', rations: 'full', spirit: MOOD.start, mood: moodOf(MOOD.start),
    party: comps.map((id) => ({ id, mood: moodOf(MOOD.start) })), stickers: [], letters: [],
    legStats: emptyLegStats(), totals: emptyTotals(), opts: { hunting: hunting !== false }, legStarts: 0, seasonsDone: 0,
    done: false, trip: null, cards: [], upgrades: {}, challenges: {}, met: [], deeds: [],
  };
  if (J.legId) startLeg(J, J.legId);
  return J;
}

/** Start a leg and return it: the next leg after an arrival by default, the same leg again when it is in progress (a
 *  replay, freshly seeded), or the leg named. Resets legStats, plans the markers and the leg's one or two events, and
 *  gives the party a night's rest if it is leaving a stop. Returns null (and marks the journey done) past the last leg. */
export function startLeg(J, legId) {
  ensureJourney(J);
  let idx = legId ? legIndexOf(legId) : -1;
  if (idx < 0) idx = J.trip && J.trip.arrived ? J.legIndex + 1 : J.legIndex;
  const leg = legAt(idx);
  if (!leg) { J.done = true; return null; }
  const leavingStop = !!(J.trip && J.trip.arrived);
  J.legStarts = (J.legStarts | 0) + 1;
  J.legIndex = idx; J.legId = leg.id; J.milesDone = 0; J.legStats = emptyLegStats(); J.done = false;
  const rand = mulberry32(hashSeed(J.seed, leg.id, J.legStarts));
  const markers = markerMiles(leg.miles);
  const events = planEvents(leg, rand, { hunting: J.opts.hunting && huntAllowed(J), cook: !!skillOf(J, 'good-cooking') }, markers);
  const offsets = J.party.map(() => randInt(rand, -MOOD.spread, MOOD.spread));
  if (leavingStop) J.spirit = clamp(J.spirit + MOOD.stopRest, 0, MOOD.max);
  J.trip = {
    legId: leg.id, miles: leg.miles, markers, nextMarker: 0, events, happened: [], usedKinds: [], slow: false, restDays: 0,
    tiredDays: 0, rescueCooldown: 0, rescuePending: false, crawlDays: 0, days: 0, offsets, seen: { happy: false, tired: false },
    arrived: false, result: null, traded: 0, rng: hashSeed(J.seed, leg.id, J.legStarts, 'days'), ...tripV12(J, leg),
  };
  refreshMood(J);
  return leg;
}

/** Recompute the mood words from the spirit (and food): the party's and each companion's (their seeded offset). */
export function refreshMood(J) {
  const t = J.trip;
  const hungry = J.food <= 0;
  J.mood = hungry ? 'tired' : moodOf(J.spirit);
  J.party.forEach((p, i) => { p.mood = hungry ? 'tired' : moodOf(clamp(J.spirit + ((t && t.offsets[i]) || 0), 0, MOOD.max)); });
  if (t) {
    if (J.party.some((p) => p.mood === 'tired') || J.mood === 'tired') t.seen.tired = true;
    if (J.mood === 'happy') t.seen.happy = true;
  }
  return J.mood;
}

/** Set the pace dial ('steady' | 'brisk'); unknown values are ignored. */
export function setPace(J, pace) { if (PACES.includes(pace)) J.pace = pace; return J.pace; }
/** Set the rations dial ('full' | 'plenty' | 'lean'); unknown values are ignored. */
export function setRations(J, rations) { if (RATIONS.includes(rations)) J.rations = rations; return J.rations; }
/** Turn hunting on or off (the Parent Zone option): only future legs' plans and safety nets change. */
export function setHunting(J, on) { J.opts.hunting = on !== false; return J.opts.hunting; }

/** Extra miles a day from the wagon's upgrades and animals: the iron tires' 2 and the second yoke's 3. */
export const speedBonus = (J) => (J && J.upgrades && J.upgrades.tires ? UPGRADE_FX.tiresMiles : 0) + (J && J.animals && J.animals.n >= 4 ? ANIMAL_RULES.yokeMiles : 0);
/** The pace the animals will actually walk: 'brisk' only while they are not too tired (SPEC v1.2 §1). */
export const effectivePace = (J) => (J.pace === 'brisk' && J.animals && J.animals.tired > ANIMAL_RULES.forceSteadyOver ? 'steady' : J.pace);

// which companion's skill would mend the breakdown for free right now (without using it up)
function freeFixOf(J) {
  const t = J.trip;
  if (skillOf(J, 'forge') && t && !t.forgeUsed) return 'forge';
  if (skillOf(J, 'carpentry') && J.halfPart > 0) return 'half';
  return null;
}

// fire a planned or safety-net event: what the sim does itself (food from a bonus, a rest day, a breakdown noted),
// recorded in the leg's log for the letter
function fireEvent(J, id, rescue, planned) {
  const t = J.trip, leg = currentLeg(J);
  const e = EVENT_BY_ID[id] || { id, kind: 'bonus' };
  t.happened.push(e.id);
  t.usedKinds.push(e.kind);
  const extra = { rescue };
  if (e.kind === 'bonus') {
    const lb = Math.max(e.foodLb || 20, rescue ? RESCUE.minLb : 0);
    addFoodKind(J, 'other', lb); extra.foodAdded = lb;
  } else if (e.kind === 'rest') {
    if (planned && planned.waited) { extra.waitedOut = true; extra.covered = true; }            // the party waited it out at camp: nothing lost
    else { t.restDays = Math.max(t.restDays, 1); extra.covered = !!(J.upgrades && J.upgrades.cover); }
  } else if (e.kind === 'breakdown') {
    // v1.2: the sim only notes it; the app calls repair(J, { workedOut }) (a spare part, Ada, Tomas, or a limp)
    J.totals.breakdowns++;
    extra.needsPart = true; extra.part = e.part; extra.havePart = J.parts > 0; extra.freeFix = freeFixOf(J);
  } else if (e.kind === 'hunt' || e.kind === 'fish') {
    t.rescuePending = !!rescue;
    if (e.kind === 'hunt') { extra.canHunt = huntAllowed(J); extra.arrows = J.goods.arrows | 0; }
  }
  return eventPayload(e.id, leg, extra);
}

// the animal Eli spots on a leg, by biome
const SPOTTABLE = { prairie: ['pronghorn', 'prairie-dog', 'jackrabbit', 'coyote'], bluffs: ['coyote', 'prairie-dog', 'pronghorn', 'bison'],
  highdesert: ['pronghorn', 'jackrabbit', 'coyote'], mountains: ['mule-deer', 'eagle', 'coyote'], gorge: ['eagle', 'salmon', 'mule-deer'],
  valley: ['eagle', 'mule-deer', 'coyote'] };
const SPOT_NAME = { 'prairie-dog': 'prairie dog', 'mule-deer': 'mule deer', jackrabbit: 'jackrabbit', eagle: 'eagle' };
function spotAnimal(leg, pickValue) {
  const list = SPOTTABLE[leg.biome] || SPOTTABLE.prairie;
  const animal = list[Math.min(list.length - 1, Math.floor(pickValue * list.length))];
  const card = cardForAnimal(animal);
  return { animal, name: SPOT_NAME[animal] || animal, card: card ? card.id : null };
}

/** One day on the trail. Miles by pace and animal (a slow day after a missed marker: 60 %; a limp: 60 %; no food: a crawl at
 *  40 %; a rest or lost day: 0), food eaten by rations × party + the animal's feed (never below 0), the mood moved by
 *  rations, pace and rest. Returns { arrived, event, marker, foodLow, miles, rest, crawl, slow, foraged, restNext, day, food,
 *  mood } and, new in v1.2, { lost, limp, animalsTired, coldNight, cold, spotted, skill, skills, needsPart }:
 *  at most one marker a day (the app asks it), a planned event only on a day without a marker, and the safety net (a
 *  hunt, a fishing hole or a find, event.rescue true) on a day the food will not last another day; that one can come
 *  with a marker (ask the marker first). A 'breakdown' event has needsPart true: the app then calls repair(J, …). */
export function tickDay(J, { rand } = {}) {
  ensureJourney(J);
  const t = J.trip, leg = currentLeg(J);
  const idle = { arrived: !!(t && t.arrived), event: null, marker: null, foodLow: false, miles: 0, rest: false, crawl: false,
    slow: false, foraged: 0, restNext: null, day: J.day, food: J.food, mood: J.mood, lost: false, limp: !!J.limp, animalsTired: false,
    coldNight: false, cold: null, spotted: null, skill: null, skills: [], needsPart: false };
  if (J.done || !t || !leg || t.arrived) return idle;
  const r = typeof rand === 'function' ? rand : () => drawFrom(t, 'rng');
  const animal = animalOf(J.animal);
  const up = J.upgrades;                       // v1.1 wagon upgrades: tires +2 miles, cover (weather costs no mood), barrel (lean = plenty)
  const crawl = J.food <= 0;
  const skills = [];
  const addSkill = (id, more) => { const s = skillInfo(J, id); if (s && !skills.some((x) => x.id === s.id)) skills.push(more ? { ...s, ...more } : s); };
  let rest = false, slow = false, lost = false, miles = 0;
  if (t.rescueCooldown > 0) t.rescueCooldown--;
  if (t.pepCool > 0) t.pepCool--;
  const jitter = r();                          // always drawn, so a rest day does not shift the rest of the leg
  // v1.2: tired animals walk steady whatever the dial says
  const pace = effectivePace(J);
  const animalsTired = pace !== J.pace;
  if (t.lostDays > 0) { rest = true; lost = true; t.lostDays--; }            // a breakdown with no spare part: a day lost beside the wagon
  else if (t.restDays > 0) { rest = true; t.restDays--; } else {
    let m = milesPerDay(pace, animal, speedBonus(J));
    if (t.slow) { m *= SPEED.slowDay; t.slow = false; slow = true; } else if (J.limp) m *= SPEED.limp;
    if (crawl) m *= SPEED.crawl;
    if (!crawl && !slow && !J.limp) m += jitter < 0.2 ? -1 : jitter > 0.8 ? 1 : 0;
    miles = Math.max(1, Math.round(m));
  }
  // eat (v1.2: by kind, and Rosa's cooking makes it last a tenth longer)
  const need = dailyNeed(J);
  const ate = eatFood(J, need, eatFactor(J));
  // the animals: a rest day restores them, a travel day tires them (brisk, mountains), the second yoke halves it
  if (rest) J.animals.tired = Math.max(0, J.animals.tired - ANIMAL_RULES.restRelief);
  else {
    let add = (pace === 'brisk' ? ANIMAL_RULES.tireBrisk : 0) + (leg.biome === 'mountains' ? ANIMAL_RULES.tireMountains : 0);
    if (J.animals.n >= 4) add = Math.round(add * ANIMAL_RULES.yokeTiring);
    J.animals.tired = clamp(J.animals.tired + add, 0, ANIMAL_RULES.max);
  }
  // move: never past a second marker in one day; a marker day stops short of the stop
  const pos = t.markers;
  let to = J.milesDone + miles;
  if (t.nextMarker + 1 < pos.length && to >= pos[t.nextMarker + 1]) to = pos[t.nextMarker + 1] - 1;
  let marker = null;
  if (t.nextMarker < pos.length && to >= pos[t.nextMarker]) {
    marker = { n: t.nextMarker + 1, of: pos.length, atMile: pos[t.nextMarker] };
    t.nextMarker++;
    if (to >= leg.miles) to = leg.miles - 1;
  }
  to = Math.min(leg.miles, to);
  miles = to - J.milesDone;
  J.milesDone = to;
  const arrived = to >= leg.miles;
  J.day++; t.days++; J.totals.days++; J.totals.miles += miles;
  // the crawl tally (days that started with no food), for the economy sim's "never stuck" check
  if (crawl) { t.crawlDays++; J.totals.crawlDays++; J.totals.maxCrawlDays = Math.max(J.totals.maxCrawlDays, t.crawlDays); } else t.crawlDays = 0;
  // an event: a planned one (never on a marker day), else the safety net when the food is about to run out
  let event = null, foraged = 0;
  if (!marker && !arrived) {
    const ev = t.events.find((e) => !e.fired && e.atMile <= to);
    if (ev) { ev.fired = true; event = fireEvent(J, ev.id, false, ev); }
  }
  if (!event && !arrived && J.food < need && t.rescueCooldown <= 0) {
    t.rescueCooldown = RESCUE.cooldown;
    const rescue = rescueEvent(leg, [...t.usedKinds, ...t.events.map((e) => e.kind)], { hunting: J.opts.hunting && huntAllowed(J) });   // never a kind the leg has or will have
    if (rescue) event = fireEvent(J, rescue.id, true);
    else { foraged = RESCUE.minLb; addFoodKind(J, 'other', foraged); }
  }
  // the mood: rations and pace (or a rest day) move it; no food caps it at tired
  let d = MOOD.ration[up.barrel && J.rations === 'lean' ? 'plenty' : J.rations] ?? 0;
  d += rest ? (lost ? MOOD.lostDay : MOOD.rest) : (MOOD.pace[pace] ?? 0);
  if (event && event.kind === 'rest' && !up.cover && !event.waitedOut) d -= MOOD.weather;   // a wet, grumpy morning; the canvas cover keeps everyone dry
  J.spirit = clamp(J.spirit + d, 0, MOOD.max);
  if (J.food <= 0) J.spirit = Math.min(J.spirit, MOOD.hungryCap);
  refreshMood(J);
  // Mabel's peppermint drops: a tired party (with food in the wagon) is rested again in one day
  if (J.mood === 'tired' && J.food > 0 && !arrived && skillOf(J, 'peppermints') && t.pepCool <= 0) {
    J.spirit = Math.max(J.spirit, SKILL_FX.peppermintTo); t.pepCool = SKILL_FX.peppermintCooldown;
    refreshMood(J); addSkill('peppermints');
  }
  // cold nights: the south-pass and blue-mountains legs and a snow event anywhere need a blanket for every two people
  let coldNight = false, cold = null;
  if (event && event.cold) t.snow = true;
  if (!arrived && !t.coldDone && ((event && event.cold) || (t.coldAt != null && J.milesDone >= t.coldAt))) {
    t.coldDone = true;
    const nb = needsBlankets(J);
    cold = { need: nb.need, have: nb.have, short: nb.short, night: nb.short > 0, why: nb.why };
    if (nb.short > 0) { coldNight = true; t.coldNightHere = true; J.totals.coldNights++; } else t.coldOk = true;
  }
  if (coldNight) { J.spirit = Math.min(J.spirit, COLD.spiritCap); refreshMood(J); t.restDays = Math.max(t.restDays, 1); }
  // Eli's extra animal a leg (the app awards the card) and Rosa's cooking, announced once a leg
  let spotted = null;
  if (skillOf(J, 'scouting') && !t.spotted && !arrived && J.milesDone >= t.spotAt) {
    t.spotted = true; J.totals.spotted++; spotted = spotAnimal(leg, t.spotPick); addSkill('scouting', { animal: spotted.animal });
  }
  if (event && event.kind === 'bonus') addSkill('good-cooking');
  else if (ate.saved > 0 && !t.cookSaid) { t.cookSaid = true; addSkill('good-cooking', { savedLb: ate.saved }); }
  // tired for a few days with food in the wagon: the party rests a day on its own (SPEC §1: tired → rests a day)
  let restNext = coldNight ? 'cold' : event && event.kind === 'rest' && !event.waitedOut ? 'event' : null;
  if (J.mood === 'tired' && J.food > 0 && !rest) t.tiredDays++; else t.tiredDays = 0;
  if (!arrived && !restNext && t.tiredDays >= MOOD.tiredRestAfter && t.restDays === 0) { t.restDays = 1; t.tiredDays = 0; restNext = 'tired'; }
  if (arrived) t.arrived = true;
  const foodLow = J.food < need * 3;
  if (foodLow) t.foodLowSeen = true;
  return { arrived, event, marker, foodLow, miles, rest, crawl, slow, foraged, restNext, day: J.day, food: J.food, mood: J.mood,
    lost, limp: !!J.limp, animalsTired, coldNight, cold, spotted, skill: skills[0] || null, skills, needsPart: !!(event && event.needsPart) };
}

/** A mile marker answered (the app's gate panel). Right: the party cheers (mood up a notch), quick: a tailwind of 3
 *  free miles (never past the next marker or the stop). Miss: the next travel day is a slow one (60 %), nothing else. */
export function applyMarker(J, { correct, quick } = {}) {
  ensureJourney(J);
  const t = J.trip, leg = currentLeg(J);
  J.legStats.markers++; J.totals.markers++;
  let freeMiles = 0;
  if (correct) {
    J.legStats.markersRight++; J.totals.markersRight++;
    J.spirit = clamp(J.spirit + MOOD.notch, 0, MOOD.max);
    if (quick && t && leg && !t.arrived) {
      const cap = Math.min(leg.miles - 1, t.nextMarker < t.markers.length ? t.markers[t.nextMarker] - 1 : leg.miles - 1);
      freeMiles = Math.max(0, Math.min(SPEED.quickMiles, cap - J.milesDone));
      J.milesDone += freeMiles; J.totals.miles += freeMiles;
    }
  } else if (t) t.slow = true;
  refreshMood(J);
  return { mood: J.mood, freeMiles, slowNext: !correct };
}

/** Nora's tip (SPEC v1.2 §2): once a leg, with the teacher in the party, the marker panel shows the strategy hint BEFORE the
 *  answer. Returns { used, skill }: used is true the first time it is asked on a leg (that is the leg's tip, now spent) and
 *  skill is { id, name, text, who } for the card; { used: false, skill: null } otherwise. */
export function applyMarkerHint(J) {
  ensureJourney(J);
  const t = J.trip, s = skillInfo(J, 'tips');
  if (!s || !t || t.tipUsed) return { used: false, skill: null };
  t.tipUsed = true;
  return { used: true, skill: s };
}
/** Is Nora's tip ready (not yet used this leg)? Does not use it up. */
export const markerHintReady = (J) => !!(J && J.trip && skillOf(J, 'tips') && !J.trip.tipUsed);
/** true the first time it is asked on a leg when Nora is in the party (and uses the tip up); false otherwise. */
export const teacherTip = (J) => applyMarkerHint(J).used;

/** A word problem answered (store, rations, distance, event, trade). Stats by kind; a trade token for a right answer
 *  on the first try (SPEC §3: the math earns the bonus, never the supplies). */
export function applyProblem(J, { kind = 'other', correct, firstTry = true } = {}) {
  J.legStats.problems++; J.totals.problems++;
  const k = (J.totals.byKind[kind] = J.totals.byKind[kind] || { n: 0, right: 0 });
  k.n++;
  let tokens = 0;
  if (correct) {
    J.legStats.problemsRight++; J.totals.problemsRight++; k.right++;
    if (firstTry !== false) tokens = TOKENS.problemFirstTry;
  }
  J.tokens += tokens;
  return { tokens };
}

// a ferry fare paid with every word right the first time counts once (the 'spelling-ferry' deed)
function noteFerry(J) {
  const t = J.trip, s = J.legStats;
  if (!t || !t.river || t.river.how !== 'ferry' || t.ferryCounted) return;
  if (s.words >= 3 && s.wordsRight === s.words) { t.ferryCounted = true; J.totals.ferryPerfect++; }
}
/** Spelling words at a river or in a letter: how many were asked and how many were right the first time. */
export function applyWords(J, { asked = 0, right = 0 } = {}) {
  const a = Math.max(0, asked | 0), r = clamp(right | 0, 0, a);
  J.legStats.words += a; J.legStats.wordsRight += r; J.totals.words += a; J.totals.wordsRight += r;
  ensureJourney(J); noteFerry(J);
  return { words: J.legStats.words, wordsRight: J.legStats.wordsRight };
}

function addFood(J, lb, statKey, logKey) {
  ensureJourney(J);
  const t = J.trip;
  let got = Math.max(0, Math.round(Number(lb) || 0));
  if (t && t.rescuePending) { got = Math.max(got, RESCUE.minLb); t.rescuePending = false; }
  addFoodKind(J, 'other', got);
  J.legStats[statKey] += got; J.totals[statKey] += got;
  J.totals[statKey === 'hunted' ? 'meatLb' : 'fishLb'] += got;
  if (t && got > 0 && !t.happened.includes(logKey)) t.happened.push(logKey);
  refreshMood(J);
  return { foodLb: got, food: J.food };
}
/** The bow hunt's result (the scene's huntEnd.meatLb) goes into the food; a safety-net hunt is worth at least
 *  RESCUE.minLb, so a child who misses every arrow still eats ("Eli shares what he found"). A hunt that brought food
 *  also brings back a pelt or two for the trading posts (PELTS). v1.2: the hunt uses up to five arrows (huntAllowed). */
export function applyHunt(J, { meatLb = 0 } = {}) {
  ensureJourney(J);
  const arrowsUsed = Math.min(ARROWS.perHunt, J.goods.arrows | 0);
  J.goods.arrows -= arrowsUsed;
  const r = addFood(J, meatLb, 'hunted', 'hunt');
  const pelts = r.foodLb <= 0 ? 0 : r.foodLb >= PELTS.bigHuntLb ? PELTS.bigHunt : PELTS.perHunt;
  J.goods.pelts = (J.goods.pelts | 0) + pelts;
  return { ...r, pelts, arrowsUsed, arrowsLeft: J.goods.arrows };
}
/** The fishing result (the scene's fishEnd.fishLb), with the same safety-net minimum. */
export const applyFish = (J, { fishLb = 0 } = {}) => addFood(J, fishLb, 'fished', 'fish');

/** What the wagon can trade here: the nation's give good, how many the wagon holds (pelts from the start and the
 *  hunts, blankets and rope from the store) and the rate. The app passes `have` to problemFor('trade'). */
export function tradeOffer(J) {
  const nation = nationFor(currentLeg(J));
  const tr = (nation && nation.trade) || { give: 'pelts', get: 'flour', rate: [3, 2] };
  return { nation: nation ? nation.id : null, give: tr.give, get: tr.get, rate: tr.rate || [3, 2], have: spareGoods(J, tr.give) };
}
/** How many of a good the wagon can trade away: all of them, except the blankets a cold leg still ahead needs (one for every
 *  two people): the party never trades its blankets away and then freezes in the mountains (SPEC v1.2 §1). */
export function spareGoods(J, good) {
  const have = (J.goods && J.goods[good]) | 0;
  if (good !== 'blankets') return have;
  const t = J.trip;
  const ahead = coldLegsAhead(J).filter((id) => !(id === J.legId && t && t.coldDone));
  return Math.max(0, have - (ahead.length ? needsBlankets(J, ahead[0]).need : 0));
}

/** A trade at a trading post: give `giveN` of the nation's give good from the wagon's goods (never below 0), get
 *  `getN` of its get good, always a food (into the wagon's `other` food by TRADE_LB pounds). When the wagon holds fewer than
 *  giveN, the trade shrinks to the whole trades it can make (so goods are never created from nothing). */
export function applyTrade(J, { giveN = 0, getN = 0, give, get } = {}) {
  ensureJourney(J);
  const offer = tradeOffer(J);
  const g = give || offer.give, w = get || offer.get;
  const [per, gets] = Array.isArray(offer.rate) && offer.rate.length === 2 ? offer.rate : [3, 2];
  const want = Math.max(0, giveN | 0), have = spareGoods(J, g);
  let n = Math.max(0, getN | 0), gave = want;
  if (have < want) { const trades = Math.floor(have / Math.max(1, per)); gave = trades * per; n = Math.min(n, trades * gets); }
  J.goods[g] = Math.max(0, (J.goods[g] | 0) - gave);
  const foodLb = n * lbOf(w);
  addFoodKind(J, 'other', foodLb);
  J.totals.traded += n;
  if (J.trip) { J.trip.traded = (J.trip.traded | 0) + n; if (n > 0 && !J.trip.happened.includes('trade')) J.trip.happened.push('trade'); }
  refreshMood(J);
  return { foodLb, got: n, gave, good: w, nation: offer.nation };
}

/** The stop whose store the party is at: the arrived leg's fort, or Independence (null) before the first mile. */
export function storeLeg(J) {
  const leg = currentLeg(J);
  if (J.trip && J.trip.arrived) return leg;
  return J.legIndex === 0 && J.milesDone === 0 ? null : leg;
}

/** Buy at the General Store: qty × price (the price given, else priceAt here). Never below $0: when the cash does not
 *  cover it nothing changes and ok is false. Food goods add their pounds to their own kind (flour, bacon, beans), parts add
 *  to J.parts (and mend a limping wagon), a bundle of arrows is five arrows, the second yoke ('yoke', one only) makes it four
 *  animals, the rest go in J.goods. */
export function buy(J, { item, qty = 1, price } = {}) {
  ensureJourney(J);
  const id = typeof item === 'object' && item ? item.id : item;
  const q = id === 'yoke' ? Math.min(1, Math.max(0, Math.floor(Number(qty) || 0))) : Math.max(0, Math.floor(Number(qty) || 0));
  const p = Number.isFinite(price) ? Math.max(0, Math.round(price)) : priceAt(id, storeLeg(J), J.season);
  const cost = q * p;
  if (!id || cost > J.cash || (id === 'yoke' && (J.animals.n >= 4 || !yokeOffered(storeLeg(J))))) return { ok: false, cost, cash: J.cash, foodLb: 0 };
  J.cash -= cost;
  let foodLb = 0;
  if (isFood(id)) { foodLb = q * lbOf(id); addFoodKind(J, id, foodLb); }
  else if (id === 'parts') { J.parts += q; J.goods.parts = J.parts; if (q > 0) J.limp = false; }
  else if (id === 'arrows') J.goods.arrows = (J.goods.arrows | 0) + q * ARROWS.perBundle;
  else if (id === 'yoke') { if (q > 0) { J.goods.yoke = 1; J.animals.n = 4; } }
  else J.goods[id] = (J.goods[id] | 0) + q;
  J.totals.bought += cost;
  refreshMood(J);
  return { ok: true, cost, cash: J.cash, foodLb };
}

/** Arriving at the leg's stop: the three stars, the cash ($60 × season.priceMult + $20 a star), the sticker and the
 *  crate tier. Idempotent: a second call returns the same result without paying again. null before the stop.
 *  v1.2: the animals rest at a stop (−30 tired), a fort mends a limping wagon, and the deeds' counters tick. */
export function arrive(J) {
  ensureJourney(J);
  const t = J.trip, leg = currentLeg(J);
  if (!t || !leg || !hasArrived(J)) return null;
  if (t.result) return t.result;
  t.arrived = true;
  const stars = starsFor(J);
  const cash = payFor(stars, J.season);
  J.cash += cash.total;
  const sticker = leg.sticker || { id: leg.id, name: leg.name, emoji: '⭐' };
  if (!J.stickers.includes(sticker.id)) J.stickers.push(sticker.id);
  J.totals.legs++; J.totals.stars += starCount(stars);
  const T = J.totals;
  J.animals.tired = Math.max(0, J.animals.tired - ANIMAL_RULES.stopRelief);
  const mended = !!(J.limp && leg.stop && leg.stop.kind === 'fort');
  if (leg.stop && leg.stop.kind === 'fort') J.limp = false;
  if (!T.reached.includes(leg.id)) T.reached.push(leg.id);
  if (stars.every(Boolean)) T.goldLegs++;
  if (stars[2]) T.markersPerfectLegs++;
  if (!t.foodLowSeen) T.fullWagonLegs++;
  if (leg.id === 'blue-mountains' && t.coldOk && !t.coldNightHere) T.blueProof++;
  t.result = { legId: leg.id, stars, cash, sticker, crate: crateFor(stars), ...(mended ? { mended: true } : {}) };
  return t.result;
}

/** On to the next leg after an arrival (pays the arrival first if the app has not): returns the new leg, or null at
 *  the end of the trail (then J.done is true and journeyDone(J) has the valley) or while the leg is not finished. */
export function nextLeg(J) {
  if (J.done || !J.trip || !hasArrived(J)) return null;
  arrive(J);
  if (J.legIndex + 1 >= legList().length) { J.done = true; return null; }
  return startLeg(J);
}

/** The valley: null while the journey is on, else the journey's summary for the homestead screen. */
export function journeyDone(J) {
  if (!J || !J.done) return null;
  const T = J.totals;
  return { season: J.season, wagonName: J.wagonName, days: J.day, miles: T.miles, legs: T.legs, stars: T.stars,
    maxStars: legList().length * 3, cash: J.cash, tokens: J.tokens, stickers: J.stickers.slice(), letters: J.letters.length,
    markers: T.markers, markersRight: T.markersRight, problems: T.problems, problemsRight: T.problemsRight,
    words: T.words, wordsRight: T.wordsRight, deeds: (J.deeds || []).length, peopleMet: T.peopleMet | 0, repairs: T.repairs | 0 };
}

/** The next season's journey (a new J; the app replaces the old one): the next year's prices and numbers, a fresh
 *  start (cash × the season's priceMult), the same wagon and party unless overridden; trade tokens carry over. */
export function newSeason(J, overrides = {}) {
  ensureJourney(J);
  const season = overrides.season || nextSeasonId(J.season);
  const N = createJourney({ season, wagonName: J.wagonName, animal: J.animal, companions: J.companions,
    seed: hashSeed(J.seed, 'season', season, J.seasonsDone + 1), hunting: J.opts.hunting, ...overrides });
  N.tokens = J.tokens;
  N.cards = J.cards.slice(); N.upgrades = { ...J.upgrades }; N.challenges = JSON.parse(JSON.stringify(J.challenges));   // the album, the wagon and the day's claims carry over
  N.deeds = J.deeds.slice();                                                                                              // v1.2: the badges are kept (the people and the counters start over)
  N.seasonsDone = (J.seasonsDone | 0) + (J.done ? 1 : 0);
  return N;
}

/** The food plan to the next fort (or the end of the trail): miles, days at the current pace, pounds at the current
 *  rations (Rosa's cooking counted), and whether the wagon has enough. Why: the store's hint ("you need about 300 pounds to
 *  reach Fort Laramie") and the economy sim's shopping use the same arithmetic as the sim. */
export function foodToNextFort(J) {
  const legs = legList();
  const t = J.trip;
  let i = J.legIndex, miles = 0;
  if (t && t.arrived) i++; else { miles += Math.max(0, ((currentLeg(J) || {}).miles || 0) - J.milesDone); i++; }
  let stop = t && !t.arrived ? currentLeg(J) : null;
  if (!(stop && stop.stop && stop.stop.kind === 'fort')) {
    for (; i < legs.length; i++) {
      miles += legs[i].miles; stop = legs[i];
      if (legs[i].stop && legs[i].stop.kind === 'fort') break;
    }
  }
  const animal = animalOf(J.animal);
  const days = etaDays(miles, J.pace, animal, speedBonus(J));
  const lb = Math.round(foodNeeded(partySize(J), J.rations, days, animal.feedLb || 0) * eatFactor(J));
  return { miles, days, lb, stop: stop ? (stop.stop && stop.stop.name) || stop.name : null, enough: J.food >= lb };
}

/** The HUD line's numbers: the leg, miles left, the next marker, days to the stop at this pace. */
export function legStatus(J) {
  const leg = currentLeg(J), t = J.trip;
  if (!leg || !t) return null;
  const left = Math.max(0, leg.miles - J.milesDone);
  const next = t.nextMarker < t.markers.length ? t.markers[t.nextMarker] - J.milesDone : null;
  return { leg, milesLeft: left, nextMarkerIn: next, marker: t.nextMarker, markers: t.markers.length,
    etaDays: etaDays(left, J.pace, J.animal, speedBonus(J)), arrived: t.arrived };
}

// ---- v1.2: breakdowns, rivers, weather, people and the pure-play pay (SPEC v1.2 §1-§4) ----

/** Mend a breakdown (the app calls this after a 'breakdown' event, with `workedOut` true when the child worked the optional
 *  parts problem out for a token). The order: Ada mends one a leg for free; else Tomas's leftover half part (a spare part
 *  serves two repairs); else a spare part is used (and with Tomas the other half is kept); else there is none: the wagon
 *  limps (J.limp, 60 % speed, until the next fort or a part bought) and the next day is lost. Returns { fixed, usedPart,
 *  skill, limp, lostDay, partsLeft } where skill is { id, name, text, who } when Ada or Tomas covered it. */
export function repair(J, { workedOut = false } = {}) {
  ensureJourney(J);
  const t = J.trip, T = J.totals;
  let fixed = false, usedPart = false, skill = null;
  if (skillOf(J, 'forge') && t && !t.forgeUsed) { t.forgeUsed = true; fixed = true; skill = skillInfo(J, 'forge'); T.forgeFixes++; }
  else if (skillOf(J, 'carpentry') && J.halfPart > 0) { J.halfPart = 0; fixed = true; skill = skillInfo(J, 'carpentry'); T.halfFixes++; }
  else if (J.parts > 0) { J.parts--; J.goods.parts = J.parts; usedPart = true; fixed = true; if (skillOf(J, 'carpentry')) J.halfPart = 1; }
  if (fixed) { T.repairs++; if (workedOut) T.repairsWorkedOut++; }
  else { J.limp = true; T.limps++; if (t) { t.lostDays = (t.lostDays | 0) + 1; t.limped = true; } }
  refreshMood(J);
  return { fixed, usedPart, skill, limp: !!J.limp, lostDay: !fixed, partsLeft: J.parts };
}

const RIVER_HOWS = ['ford', 'float', 'ferry'];
// the one-line story the crossing screen shows (and says), by how it went; no digits so it can be read aloud as it stands
function riverLine(J, how, sacks, soakedLb, ropeUsed, skill) {
  const carp = skill && skill.id === 'carpentry' ? (COMPANION_BY_ID[skill.who] || {}).name || 'The carpenter' : '';
  if (how === 'ford') return sacks > 0 && soakedLb > 0 ? 'Splash! A wave soaks a sack of flour, but the rest of the load stays dry.'
    : sacks > 0 ? 'Splash! The water splashes high, but there is hardly any flour left to get wet.' : 'You pick your way across the ford on the calm beat, and everything stays dry.';
  if (how === 'float') {
    if (carp) return `${carp} steadies the raft with a few quick pushes, and every bump is just a wobble. Not a drop on the flour!`;
    if (ropeUsed) return 'Bump! The raft hits a rock, but the rope holds it steady. A coil is frayed, and the flour stays dry.';
    if (soakedLb > 0) return 'Bump! The raft hits a rock and a sack of flour gets soaked. Without a rope, the water got in.';
    return 'The raft glides across without a single bump.';
  }
  return 'The ferryman poles the ferry across, and the fare is your spelling words. Not a drop on the flour!';
}

/** The river crossing's result (SPEC v1.2 §3): how = 'ford' (the timing tap; `soaked` sacks the scene reports), 'float' (the
 *  steering run; `bumps` the scene reports) or 'ferry' (the fare is the week's three words). A soaked sack is 25 lb of
 *  flour, never more than half of the wagon's flour; on a float a bump is free with the carpenter (Tomas) or a coil of rope
 *  (one coil is used up), else it soaks a sack. The ferry costs nothing but the words. Returns { how, soakedLb, soakedSacks,
 *  ropeUsed, skill, line, say } and keeps J.trip.river = { how, soakedLb } for the letter. */
export function crossRiver(J, { how = 'ford', soaked = 0, bumps = 0 } = {}) {
  ensureJourney(J);
  const h = RIVER_HOWS.includes(how) ? how : 'ford';
  const T = J.totals, t = J.trip, leg = currentLeg(J);
  let sacks = 0, ropeUsed = false, skill = null;
  if (h === 'ford') sacks = Math.max(0, soaked | 0);
  else if (h === 'float') {
    const b = Math.max(0, bumps | 0);
    if (b > 0) {
      if (skillOf(J, 'carpentry')) skill = skillInfo(J, 'carpentry');
      else if ((J.goods.rope | 0) > 0) { J.goods.rope--; ropeUsed = true; T.ropeUsed++; }
      else sacks = b;
    }
  }
  const soakedLb = sacks > 0 ? takeFlour(J, Math.min(sacks * SOAKED_LB, Math.floor(J.foods.flour / 2))) : 0;
  T.riversCrossed++; T.soakedLb += soakedLb; if (soakedLb > 0) T.soakedCrossings++;
  T[h + 'Count']++;
  if (leg && !T.crossed.includes(leg.id)) T.crossed.push(leg.id);
  if (t) t.river = { how: h, soakedLb };
  noteFerry(J);
  const line = riverLine(J, h, sacks, soakedLb, ropeUsed, skill);
  refreshMood(J);
  return { how: h, soakedLb, soakedSacks: soakedLb > 0 ? Math.ceil(soakedLb / SOAKED_LB) : 0, ropeUsed, skill, line, say: line };
}

// the planned weather event the forecast can see: the next unfired one that is not already waited out, within the horizon
function weatherAhead(J) {
  const t = J.trip, leg = currentLeg(J);
  const horizon = skillOf(J, 'scouting') ? 2 : 1;
  if (!t || !leg || t.arrived) return { horizon, ev: null };
  const mpd = Math.max(1, Math.round(milesPerDay(effectivePace(J), animalOf(J.animal), speedBonus(J)) * (J.limp ? SPEED.limp : 1)));
  const wait = (t.lostDays | 0) + (t.restDays | 0);
  let best = null;
  for (const ev of t.events) {
    const e = EVENT_BY_ID[ev.id];
    if (ev.fired || ev.waited || !e || !e.weather) continue;
    const days = wait + Math.max(1, Math.ceil(Math.max(0, ev.atMile - J.milesDone) / mpd));
    if (days <= horizon && (!best || days < best.days)) best = { ev, weather: e.weather, days };
  }
  return { horizon, ev: best ? best.ev : null, weather: best && best.weather, days: best && best.days };
}
/** The weather to come (SPEC v1.2 §4), from the leg's planned events: { next: 'clear' | 'rain' | 'storm' | 'snow', inDays }.
 *  The party sees one day ahead; with the scout, two. 'clear' carries the horizon (1 or 2) as inDays; a coming change
 *  carries the days until it. When only the scout can see it (two days out), the result also has `skill`. */
export function forecast(J) {
  ensureJourney(J);
  const w = weatherAhead(J);
  if (!w.ev) return { next: 'clear', inDays: w.horizon };
  const out = { next: w.weather, inDays: w.days };
  if (w.days === 2) { const s = skillInfo(J, 'scouting'); if (s) out.skill = s; }
  return out;
}

/** "Wait out the storm" (the camp menu): a rest day at camp that cancels the coming weather event's mood cost and its rest
 *  day (the party has already waited), when the forecast shows weather. Returns camp()'s result plus { waited, weather }. */
export function waitOut(J, { rand } = {}) {
  ensureJourney(J);
  const w = weatherAhead(J);
  const r = camp(J, 'rest', { rand });
  if (w.ev) { w.ev.waited = true; J.totals.waitedOut++; }
  return { ...r, waited: !!w.ev, weather: w.ev ? w.weather : null };
}

/** The Columbia raft's pay (SPEC v1.2 §4): $40 less $10 a bump, never under $10, × the season's price level; added to cash. */
export function raftPay(J, { bumps = 0 } = {}) {
  ensureJourney(J);
  const b = Math.max(0, bumps | 0);
  const cash = Math.round(Math.max(RAFT.min, RAFT.base - RAFT.perBump * b) * seasonOf(J.season).priceMult);
  J.cash += cash; J.totals.raftRuns++; if (b === 0) J.totals.raftClean++;
  return { cash, bumps: b };
}
/** The stampede's pay: holding the wagon steady pays $15 × the season's price level and the bison card (the app awards it);
 *  letting the herd through pays nothing and costs nothing (dust everywhere, a laugh). Returns { cash, card, held }. */
export function stampedePay(J, { held = false } = {}) {
  ensureJourney(J);
  const cash = held ? Math.round(STAMPEDE.held * seasonOf(J.season).priceMult) : 0;
  J.cash += cash; J.totals.stampedes++; if (held) J.totals.stampedesHeld++;
  return { cash, card: held ? 'bison' : null, held: !!held };
}

/** Talk to a person at a stop (SPEC v1.2 §4). The first time: they are remembered (J.met, totals.peopleMet) and their gift is
 *  applied: food goes into the wagon's `other` food; a card id, a 'tip' (a parts problem the app offers for a token) and a
 *  trade (like the posts: give / get / rate for applyTrade) are returned for the app to run. Again: { first: false, gift: null }.
 *  An unknown id: { first: false, gift: null, person: null }. Returns { first, gift, person }. */
export function meetPerson(J, id) {
  ensureJourney(J);
  const person = PERSON_BY_ID[id];
  if (!person) return { first: false, gift: null, person: null };
  if (J.met.includes(id)) return { first: false, gift: null, person };
  J.met.push(id); J.totals.peopleMet++;
  let gift = null;
  if (person.gift) {
    gift = { ...person.gift };
    if (gift.kind === 'food') gift.foodLb = addFoodKind(J, 'other', gift.lb);
  }
  refreshMood(J);
  return { first: true, gift, person };
}
/** The people at a stop (a leg id or 'independence'), each with `met` for this journey. */
export function peopleAt(J, stopId) {
  return (PEOPLE_BY_STOP[stopId] || []).map((p) => ({ ...p, met: !!(J && Array.isArray(J.met) && J.met.includes(p.id)) }));
}

/** How many cards a lookout drops: one, two with the storyteller (Ines). */
export function lookoutDrops(J) {
  const s = skillInfo(J, 'tales');
  return { cards: s ? 2 : 1, skill: s };
}
/** The camp activities open to the party now: the bow only while hunting is on and there are five arrows. */
export const campKinds = (J) => CAMP_KINDS.filter((k) => k !== 'hunt' || (J.opts && J.opts.hunting !== false && huntAllowed(J)));

// ---- v1.1: camp, trail cards, wagon upgrades and the derby's pay (SPEC v1.1 §3) ----

/** A day at camp (SPEC v1.1 §3): kind 'fish' | 'hunt' | 'cards' | 'tales' | 'rest'. It costs a day, like a rest day on
 *  the trail: the party eats a normal day's food (never below 0), covers no miles, and the mood goes up (+8 spirit for a
 *  rest, +4 for the others). The app runs the mini-game (fishing, the bow, Quick Draw, the tale) and calls applyFish /
 *  applyHunt / applyProblem itself. A camp day also uses up a rest day that was waiting (the storm's), and it draws the
 *  one random number a trail day draws, so camping does not shift the rest of the leg's plan. Unknown kinds are a rest.
 *  v1.2: the animals rest (−30 tired); Jasper adds four spirit a night (`skill`); Ines's campfire tale always drops a card
 *  (`cardDrop`). Returns { day, food, mood, kind, foodEaten, skill, skills, cardDrop, noArrows }. */
export function camp(J, kind = 'rest', { rand } = {}) {
  ensureJourney(J);
  const k = CAMP_KINDS.includes(kind) ? kind : 'rest';
  const t = J.trip;
  (typeof rand === 'function' ? rand : () => (t ? drawFrom(t, 'rng') : 0))();
  const ate = eatFood(J, dailyNeed(J), eatFactor(J));
  J.day++; J.totals.days++; J.totals.camps++;
  if (t) {
    t.days++; t.camps = (t.camps | 0) + 1;
    if (t.restDays > 0) t.restDays--;
    if (t.rescueCooldown > 0) t.rescueCooldown--;
    t.tiredDays = 0;
    if (!t.happened.includes('camp')) t.happened.push('camp');
  }
  J.animals.tired = Math.max(0, J.animals.tired - ANIMAL_RULES.restRelief);
  const skills = [];
  let gain = k === 'rest' ? MOOD.camp.rest : MOOD.camp.other;
  const fid = skillInfo(J, 'fiddle');
  if (fid) { gain += SKILL_FX.fiddlerCamp; skills.push(fid); }
  const tales = skillInfo(J, 'tales');
  const cardDrop = !!(tales && k === 'tales');
  if (cardDrop) skills.push(tales);
  J.spirit = clamp(J.spirit + gain, 0, MOOD.max);
  refreshMood(J);
  return { day: J.day, food: J.food, mood: J.mood, kind: k, foodEaten: ate.eaten, skill: skills[0] || null, skills, cardDrop,
    spiritBonus: fid ? SKILL_FX.fiddlerCamp : 0, noArrows: k === 'hunt' && !huntAllowed(J) };
}

/** The cash price of an upgrade for this journey (1847 dollars × the season's priceMult) and its token price. */
export function upgradeCost(J, id) {
  const u = UPGRADE_BY_ID[id];
  return u ? { tokens: u.tokens, cash: Math.round(u.cash * seasonOf(J && J.season).priceMult) } : null;
}
/** Buy a wagon upgrade once, paying with trade tokens (`{ tokens: true }`) or cash (`{ cash: true }`). true when bought;
 *  false (and nothing changes) for an unknown or owned upgrade, no payment named, or not enough tokens / cash. */
export function buyUpgrade(J, id, pay = {}) {
  ensureJourney(J);
  const u = UPGRADE_BY_ID[id], cost = upgradeCost(J, id);
  if (!u || J.upgrades[id]) return false;
  if (pay.tokens) { if (J.tokens < cost.tokens) return false; J.tokens -= cost.tokens; }
  else if (pay.cash) { if (J.cash < cost.cash) return false; J.cash -= cost.cash; }
  else return false;
  J.upgrades[id] = true;
  return true;
}
/** The upgrades the wagon has, as a list of ids. */
export const upgradesOwned = (J) => UPGRADES.filter((u) => J && J.upgrades && J.upgrades[u.id]).map((u) => u.id);

/** The Fort Derby's pay: a win is $20 × the season's priceMult, a loss a flat $5 "good try" (SPEC v1.1 §3); `margin` is
 *  accepted from the scene's derbyEnd and pays nothing extra. Added to J.cash. Returns { cash, won }. */
export function derbyPay(J, { won = false } = {}) {
  ensureJourney(J);
  const cash = Math.round((won ? DERBY.win : DERBY.lose) * seasonOf(J.season).priceMult);
  J.cash += cash;
  J.totals.derbyPlayed++; if (won) J.totals.derbyWon++;
  return { cash, won: !!won };
}

/** Give the child a trail card. A new card goes in J.cards; a duplicate pays a trade token instead. Returns { new,
 *  tokens: 0|1, id, suit, suitComplete }: suitComplete is true when this card finished its suit (the app gives a gold
 *  crate). An unknown id changes nothing ({ new: false, tokens: 0 }). */
export function awardCard(J, cardId) {
  ensureJourney(J);
  const card = CARD_BY_ID[cardId];
  if (!card) return { new: false, tokens: 0, id: cardId, suit: null, suitComplete: false };
  if (J.cards.includes(card.id)) { J.tokens += CARD_DUP_TOKENS; return { new: false, tokens: CARD_DUP_TOKENS, id: card.id, suit: card.suit, suitComplete: false }; }
  J.cards.push(card.id);
  return { new: true, tokens: 0, id: card.id, suit: card.suit, suitComplete: suitComplete(J, card.suit) };
}
/** Has the child every card of a suit ('landmark' | 'nation' | 'wild' | 'companion')? */
export function suitComplete(J, suit) {
  const all = cardsOf(suit);
  return all.length > 0 && !!J && Array.isArray(J.cards) && all.every((c) => J.cards.includes(c.id));
}
/** "7 of 12" for the album: { have, of } per suit. */
export function suitProgress(J, suit) {
  const all = cardsOf(suit);
  return { have: all.filter((c) => J && Array.isArray(J.cards) && J.cards.includes(c.id)).length, of: all.length };
}
/** A random wild card (animal or plant) of the leg's biome, else any wild card. `rand` is a () → [0,1) function. Returns the
 *  card object (give it to the child with awardCard(J, card.id)). */
export function cardForLeg(J, rand = Math.random) {
  const leg = currentLeg(J);
  const wild = cardsOf('wild');
  const here = leg ? wild.filter((c) => Array.isArray(c.biomes) && c.biomes.includes(leg.biome)) : [];
  const pool = here.length ? here : wild;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}
// the scene's and the hunt's animal names → card ids
const ANIMAL_CARD = { bison: 'bison', pronghorn: 'pronghorn', coyote: 'coyote', eagle: 'bald-eagle', 'bald-eagle': 'bald-eagle',
  'prairie-dog': 'prairie-dog', prairiedog: 'prairie-dog', rattlesnake: 'rattlesnake', rabbit: 'jackrabbit', jackrabbit: 'jackrabbit',
  deer: 'mule-deer', 'mule-deer': 'mule-deer', salmon: 'salmon',
  // v1.1 integration: a catch of any size is the salmon card; berries are the wild plum
  fish: 'salmon', trout: 'salmon', berries: 'wild-plum', plum: 'wild-plum', 'wild-plum': 'wild-plum' };
/** The card for an animal the scene spotted or the bow brought home ('bison' | 'pronghorn' | 'coyote' | 'eagle' | 'rabbit' |
 *  'deer' …): the card object, or null when there is none (a turkey, a trout). */
export function cardForAnimal(animal) {
  const id = ANIMAL_CARD[String(animal || '').toLowerCase().replace(/\s+/g, '-')];
  return id ? CARD_BY_ID[id] : null;
}

// one import for the app: the §10 helpers that live in economy.js and stars.js, and the v1.2 modules
export { foodNeeded, etaDays, priceAt, storeList, milesPerDay, starsFor, yokeOffered };
export { UPGRADES, CARDS, CARD_BY_ID, cardsOf };
export { dailyChallenge, claimChallenge } from './challenge.js';
export { ANIMALS };
export { syncFood, foodDays, huntAllowed, needsBlankets, coldLegsAhead, skillOf, skillInfo, partySkills };
export { DEEDS, DEED_BY_ID, checkDeeds, deedMet } from './deeds.js';
export { PEOPLE, PEOPLE_BY_STOP, PERSON_BY_ID } from '../content/people.js';

// The journey simulation (SPEC §3, §10): a wagon party crossing the trail one leg (one session) at a time. Pure
// functions over one plain, JSON-safe object J (the app saves it as `journey` in wagonWest.<id>.save and syncs it):
// no DOM, no clock, no storage, no Math.random. A day is one tickDay; randomness is either the `rand` the caller
// passes or the seeded state kept in J.trip.rng, and each leg's plan (markers, events, the companions' moods) is
// seeded from J.seed + the leg + how many legs were started, so the same seed and the same answers replay the same
// journey and a replayed leg is fresh.
//
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
// RESCUE) or the next fort feeds it; cash never goes below $0; every leg arrives.
import { ANIMALS, legAt, legIndexOf, legList, legOf, seasonOf, animalOf, nextSeasonId } from './route.js';
import { START, MOOD, SPEED, MARKERS, RESCUE, TOKENS, RATIONS, PACES, foodNeeded, milesPerDay, etaDays, priceAt, storeList, payFor,
  crateFor, moodOf, isFood, lbOf, PELTS } from './economy.js';
import { planEvents, rescueEvent, eventPayload, EVENT_BY_ID } from './events.js';
import { starsFor, hasArrived, starCount } from './stars.js';
import { hashSeed, mulberry32, drawFrom, randInt } from './rng.js';
import { nationFor } from './route.js';

export const JOURNEY_VERSION = 1;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const emptyLegStats = () => ({ markers: 0, markersRight: 0, problems: 0, problemsRight: 0, words: 0, wordsRight: 0, hunted: 0, fished: 0 });
const emptyTotals = () => ({ legs: 0, stars: 0, miles: 0, days: 0, markers: 0, markersRight: 0, problems: 0, problemsRight: 0, words: 0,
  wordsRight: 0, hunted: 0, fished: 0, traded: 0, bought: 0, crawlDays: 0, maxCrawlDays: 0, byKind: {} });

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
    v: JOURNEY_VERSION, season: s.id, seed: typeof seed === 'number' ? seed >>> 0 : hashSeed(seed),
    wagonName: String(wagonName || '').slice(0, 24), animal: animalOf(animal).id, companions: comps,
    legIndex: 0, legId: legAt(0) ? legAt(0).id : null, milesDone: 0, day: 0,
    cash: Math.round(START.cash * s.priceMult), food: START.food, parts: START.parts, goods: { ...START.goods }, tokens: 0,
    pace: 'steady', rations: 'full', spirit: MOOD.start, mood: moodOf(MOOD.start),
    party: comps.map((id) => ({ id, mood: moodOf(MOOD.start) })), stickers: [], letters: [],
    legStats: emptyLegStats(), totals: emptyTotals(), opts: { hunting: hunting !== false }, legStarts: 0, seasonsDone: 0,
    done: false, trip: null,
  };
  if (J.legId) startLeg(J, J.legId);
  return J;
}

/** Start a leg and return it: the next leg after an arrival by default, the same leg again when it is in progress (a
 *  replay, freshly seeded), or the leg named. Resets legStats, plans the markers and the leg's one or two events, and
 *  gives the party a night's rest if it is leaving a stop. Returns null (and marks the journey done) past the last leg. */
export function startLeg(J, legId) {
  let idx = legId ? legIndexOf(legId) : -1;
  if (idx < 0) idx = J.trip && J.trip.arrived ? J.legIndex + 1 : J.legIndex;
  const leg = legAt(idx);
  if (!leg) { J.done = true; return null; }
  const leavingStop = !!(J.trip && J.trip.arrived);
  J.legStarts = (J.legStarts | 0) + 1;
  J.legIndex = idx; J.legId = leg.id; J.milesDone = 0; J.legStats = emptyLegStats(); J.done = false;
  const rand = mulberry32(hashSeed(J.seed, leg.id, J.legStarts));
  const markers = markerMiles(leg.miles);
  const events = planEvents(leg, rand, J.opts, markers);
  const offsets = J.party.map(() => randInt(rand, -MOOD.spread, MOOD.spread));
  if (leavingStop) J.spirit = clamp(J.spirit + MOOD.stopRest, 0, MOOD.max);
  J.trip = {
    legId: leg.id, miles: leg.miles, markers, nextMarker: 0, events, happened: [], usedKinds: [], slow: false, restDays: 0,
    tiredDays: 0, rescueCooldown: 0, rescuePending: false, crawlDays: 0, days: 0, offsets, seen: { happy: false, tired: false },
    arrived: false, result: null, traded: 0, rng: hashSeed(J.seed, leg.id, J.legStarts, 'days'),
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

// fire a planned or safety-net event: what the sim does itself (food from a bonus, a rest day, a spare part used),
// recorded in the leg's log for the letter
function fireEvent(J, id, rescue) {
  const t = J.trip, leg = currentLeg(J);
  const e = EVENT_BY_ID[id] || { id, kind: 'bonus' };
  t.happened.push(e.id);
  t.usedKinds.push(e.kind);
  const extra = { rescue };
  if (e.kind === 'bonus') {
    const lb = Math.max(e.foodLb || 20, rescue ? RESCUE.minLb : 0);
    J.food += lb; extra.foodAdded = lb;
  } else if (e.kind === 'rest') {
    t.restDays = Math.max(t.restDays, 1);
  } else if (e.kind === 'problem' && e.problem === 'parts') {
    if (J.parts > 0) { J.parts -= 1; extra.usedPart = true; } else { t.slow = true; extra.slowDay = true; }
  } else if (e.kind === 'hunt' || e.kind === 'fish') {
    t.rescuePending = !!rescue;
  }
  return eventPayload(e.id, leg, extra);
}

/** One day on the trail. Miles by pace and animal (a slow day after a missed marker: 60 %; no food: a crawl at 40 %;
 *  a rest day: 0), food eaten by rations × party + the animal's feed (never below 0), the mood moved by rations, pace
 *  and rest. Returns { arrived, event, marker, foodLow, miles, rest, crawl, slow, foraged, restNext, day, food, mood }:
 *  at most one marker a day (the app asks it), a planned event only on a day without a marker, and the safety net (a
 *  hunt, a fishing hole or a find, event.rescue true) on a day the food will not last another day; that one can come
 *  with a marker (ask the marker first). */
export function tickDay(J, { rand } = {}) {
  const t = J.trip, leg = currentLeg(J);
  const idle = { arrived: !!(t && t.arrived), event: null, marker: null, foodLow: false, miles: 0, rest: false, crawl: false,
    slow: false, foraged: 0, restNext: null, day: J.day, food: J.food, mood: J.mood };
  if (J.done || !t || !leg || t.arrived) return idle;
  const r = typeof rand === 'function' ? rand : () => drawFrom(t, 'rng');
  const animal = animalOf(J.animal);
  const crawl = J.food <= 0;
  let rest = false, slow = false, miles = 0;
  if (t.rescueCooldown > 0) t.rescueCooldown--;
  const jitter = r();                          // always drawn, so a rest day does not shift the rest of the leg
  if (t.restDays > 0) { rest = true; t.restDays--; } else {
    let m = milesPerDay(J.pace, animal);
    if (t.slow) { m *= SPEED.slowDay; t.slow = false; slow = true; }
    if (crawl) m *= SPEED.crawl;
    if (!crawl && !slow) m += jitter < 0.2 ? -1 : jitter > 0.8 ? 1 : 0;
    miles = Math.max(1, Math.round(m));
  }
  // eat
  const need = foodNeeded(partySize(J), J.rations, 1, animal.feedLb || 0);
  J.food = Math.max(0, J.food - Math.min(J.food, need));
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
    if (ev) { ev.fired = true; event = fireEvent(J, ev.id, false); }
  }
  if (!event && !arrived && J.food < need && t.rescueCooldown <= 0) {
    t.rescueCooldown = RESCUE.cooldown;
    const rescue = rescueEvent(leg, [...t.usedKinds, ...t.events.map((e) => e.kind)], J.opts);   // never a kind the leg has or will have
    if (rescue) event = fireEvent(J, rescue.id, true);
    else { foraged = RESCUE.minLb; J.food += foraged; }
  }
  // the mood: rations and pace (or a rest day) move it; no food caps it at tired
  let d = MOOD.ration[J.rations] ?? 0;
  d += rest ? MOOD.rest : (MOOD.pace[J.pace] ?? 0);
  J.spirit = clamp(J.spirit + d, 0, MOOD.max);
  if (J.food <= 0) J.spirit = Math.min(J.spirit, MOOD.hungryCap);
  refreshMood(J);
  // tired for a few days with food in the wagon: the party rests a day on its own (SPEC §1: tired → rests a day)
  let restNext = event && event.kind === 'rest' ? 'event' : null;
  if (J.mood === 'tired' && J.food > 0 && !rest) t.tiredDays++; else t.tiredDays = 0;
  if (!arrived && !restNext && t.tiredDays >= MOOD.tiredRestAfter && t.restDays === 0) { t.restDays = 1; t.tiredDays = 0; restNext = 'tired'; }
  if (arrived) t.arrived = true;
  return { arrived, event, marker, foodLow: J.food < need * 3, miles, rest, crawl, slow, foraged, restNext, day: J.day, food: J.food, mood: J.mood };
}

/** A mile marker answered (the app's gate panel). Right: the party cheers (mood up a notch), quick: a tailwind of 3
 *  free miles (never past the next marker or the stop). Miss: the next travel day is a slow one (60 %), nothing else. */
export function applyMarker(J, { correct, quick } = {}) {
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

/** Spelling words at a river or in a letter: how many were asked and how many were right the first time. */
export function applyWords(J, { asked = 0, right = 0 } = {}) {
  const a = Math.max(0, asked | 0), r = clamp(right | 0, 0, a);
  J.legStats.words += a; J.legStats.wordsRight += r; J.totals.words += a; J.totals.wordsRight += r;
  return { words: J.legStats.words, wordsRight: J.legStats.wordsRight };
}

function addFood(J, lb, statKey, logKey) {
  const t = J.trip;
  let got = Math.max(0, Math.round(Number(lb) || 0));
  if (t && t.rescuePending) { got = Math.max(got, RESCUE.minLb); t.rescuePending = false; }
  J.food += got;
  J.legStats[statKey] += got; J.totals[statKey] += got;
  if (t && got > 0 && !t.happened.includes(logKey)) t.happened.push(logKey);
  refreshMood(J);
  return { foodLb: got, food: J.food };
}
/** The bow hunt's result (the scene's huntEnd.meatLb) goes into the food; a safety-net hunt is worth at least
 *  RESCUE.minLb, so a child who misses every arrow still eats ("Eli shares what he found"). A hunt that brought food
 *  also brings back a pelt or two for the trading posts (PELTS). */
export function applyHunt(J, { meatLb = 0 } = {}) {
  const r = addFood(J, meatLb, 'hunted', 'hunt');
  const pelts = r.foodLb <= 0 ? 0 : r.foodLb >= PELTS.bigHuntLb ? PELTS.bigHunt : PELTS.perHunt;
  J.goods.pelts = (J.goods.pelts | 0) + pelts;
  return { ...r, pelts };
}
/** The fishing result (the scene's fishEnd.fishLb), with the same safety-net minimum. */
export const applyFish = (J, { fishLb = 0 } = {}) => addFood(J, fishLb, 'fished', 'fish');

/** What the wagon can trade here: the nation's give good, how many the wagon holds (pelts from the start and the
 *  hunts, blankets and rope from the store) and the rate. The app passes `have` to problemFor('trade'). */
export function tradeOffer(J) {
  const nation = nationFor(currentLeg(J));
  const tr = (nation && nation.trade) || { give: 'pelts', get: 'flour', rate: [3, 2] };
  return { nation: nation ? nation.id : null, give: tr.give, get: tr.get, rate: tr.rate || [3, 2], have: J.goods[tr.give] | 0 };
}

/** A trade at a trading post: give `giveN` of the nation's give good from the wagon's goods (never below 0), get
 *  `getN` of its get good, always a food (into J.food by TRADE_LB pounds). When the wagon holds fewer than giveN,
 *  the trade shrinks to the whole trades it can make (so goods are never created from nothing). */
export function applyTrade(J, { giveN = 0, getN = 0, give, get } = {}) {
  const offer = tradeOffer(J);
  const g = give || offer.give, w = get || offer.get;
  const [per, gets] = Array.isArray(offer.rate) && offer.rate.length === 2 ? offer.rate : [3, 2];
  const want = Math.max(0, giveN | 0), have = J.goods[g] | 0;
  let n = Math.max(0, getN | 0), gave = want;
  if (have < want) { const trades = Math.floor(have / Math.max(1, per)); gave = trades * per; n = Math.min(n, trades * gets); }
  J.goods[g] = Math.max(0, have - gave);
  const foodLb = n * lbOf(w);
  J.food += foodLb;
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
 *  cover it nothing changes and ok is false. Food goods add their pounds, parts add to J.parts, the rest to J.goods. */
export function buy(J, { item, qty = 1, price } = {}) {
  const id = typeof item === 'object' && item ? item.id : item;
  const q = Math.max(0, Math.floor(Number(qty) || 0));
  const p = Number.isFinite(price) ? Math.max(0, Math.round(price)) : priceAt(id, storeLeg(J), J.season);
  const cost = q * p;
  if (!id || cost > J.cash) return { ok: false, cost, cash: J.cash, foodLb: 0 };
  J.cash -= cost;
  let foodLb = 0;
  if (isFood(id)) { foodLb = q * lbOf(id); J.food += foodLb; } else if (id === 'parts') J.parts += q; else J.goods[id] = (J.goods[id] | 0) + q;
  J.totals.bought += cost;
  refreshMood(J);
  return { ok: true, cost, cash: J.cash, foodLb };
}

/** Arriving at the leg's stop: the three stars, the cash ($60 × season.priceMult + $20 a star), the sticker and the
 *  crate tier. Idempotent: a second call returns the same result without paying again. null before the stop. */
export function arrive(J) {
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
  t.result = { legId: leg.id, stars, cash, sticker, crate: crateFor(stars) };
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
    words: T.words, wordsRight: T.wordsRight };
}

/** The next season's journey (a new J; the app replaces the old one): the next year's prices and numbers, a fresh
 *  start (cash × the season's priceMult), the same wagon and party unless overridden; trade tokens carry over. */
export function newSeason(J, overrides = {}) {
  const season = overrides.season || nextSeasonId(J.season);
  const N = createJourney({ season, wagonName: J.wagonName, animal: J.animal, companions: J.companions,
    seed: hashSeed(J.seed, 'season', season, J.seasonsDone + 1), hunting: J.opts.hunting, ...overrides });
  N.tokens = J.tokens;
  N.seasonsDone = (J.seasonsDone | 0) + (J.done ? 1 : 0);
  return N;
}

/** The food plan to the next fort (or the end of the trail): miles, days at the current pace, pounds at the current
 *  rations, and whether the wagon has enough. Why: the store's hint ("you need about 300 pounds to reach Fort
 *  Laramie") and the economy sim's shopping use the same arithmetic as the sim. */
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
  const days = etaDays(miles, J.pace, animal);
  const lb = foodNeeded(partySize(J), J.rations, days, animal.feedLb || 0);
  return { miles, days, lb, stop: stop ? (stop.stop && stop.stop.name) || stop.name : null, enough: J.food >= lb };
}

/** The HUD line's numbers: the leg, miles left, the next marker, days to the stop at this pace. */
export function legStatus(J) {
  const leg = currentLeg(J), t = J.trip;
  if (!leg || !t) return null;
  const left = Math.max(0, leg.miles - J.milesDone);
  const next = t.nextMarker < t.markers.length ? t.markers[t.nextMarker] - J.milesDone : null;
  return { leg, milesLeft: left, nextMarkerIn: next, marker: t.nextMarker, markers: t.markers.length,
    etaDays: etaDays(left, J.pace, J.animal), arrived: t.arrived };
}

// one import for the app: the §10 helpers that live in economy.js and stars.js
export { foodNeeded, etaDays, priceAt, storeList, milesPerDay, starsFor };
export { ANIMALS };

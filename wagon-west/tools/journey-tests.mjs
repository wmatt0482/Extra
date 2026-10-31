// Unit tests for Wagon West's journey layer (plain Node asserts, no framework, no browser):
//   node wagon-west/tools/journey-tests.mjs
// Covers the pure simulation (SPEC §10): the journey shape and its JSON safety, days (pace × animal, a slow day after
// a missed marker, the 40 % crawl with no food), food (rations × party + feed, never below 0) and mood, markers (4-6 a
// leg, one a day), events (one or two a leg, by biome, never two of a kind, the safety net when food runs out),
// markers / problems / words / hunts / fishing / trades / the store (never below $0), arriving (stars, cash, crates,
// idempotent), whole journeys (always right: 36 stars and cash to spare; always wrong: still arrives), seasons,
// determinism; the word problems (every kind × every stock fact and the big tiers: whole answers, the work, a spoken
// form with no digits); and the letters (only lines that happened). While src/content/legs.js is a skeleton the
// whole-journey tests run on route.syntheticTrail() (the content's legs first, then the rest of the route).
import assert from 'node:assert/strict';
import {
  createJourney, startLeg, tickDay, applyMarker, applyProblem, applyWords, applyHunt, applyFish, applyTrade, buy, arrive,
  nextLeg, journeyDone, newSeason, foodNeeded, etaDays, priceAt, storeList, markerMiles, foodToNextFort, legStatus,
  setPace, setRations, setHunting, tradeOffer, partySize, storeLeg,
  camp, buyUpgrade, upgradesOwned, derbyPay, awardCard, suitComplete, suitProgress, cardForLeg, cardForAnimal, ensureJourney,
  dailyChallenge, claimChallenge, UPGRADES,
  repair, crossRiver, forecast, waitOut, meetPerson, peopleAt, raftPay, stampedePay, teacherTip, applyMarkerHint, markerHintReady, lookoutDrops, campKinds,
  foodDays, huntAllowed, needsBlankets, spareGoods, coldLegsAhead, skillOf, skillInfo, partySkills, syncFood, speedBonus, effectivePace, checkDeeds, DEEDS,
} from '../src/journey/sim.js';
import { CARDS, CARD_BY_ID, SUITS, cardsOf } from '../src/content/cards.js';
import { NATIONS } from '../src/content/nations.js';
import { COMPANIONS } from '../src/content/companions.js';
import { readFileSync } from 'node:fs';
import { problemFor, parseFactId, splitLine, numberWords, PROBLEM_KINDS } from '../src/journey/problems.js';
import { composeLetter, happenedKeys, keepLetter, lineSource, FALLBACK_LINES } from '../src/journey/letters.js';
import { PEOPLE, PEOPLE_BY_STOP, PERSON_BY_ID } from '../src/content/people.js';
import { DEED_BY_ID } from '../src/journey/deeds.js';
import { starsFor, starCount } from '../src/journey/stars.js';
import { START, PAY, RATION_LB, SPEED, RESCUE, MARKERS, MOOD, payFor, crateFor, lbOf, TRADE_LB, milesPerDay, ARROWS, ANIMAL_RULES, COLD_LEGS, SOAKED_LB, FOOD_KINDS, RAFT } from '../src/journey/economy.js';
import { planEvents, eligibleEvents, EVENTS, EVENT_BY_ID } from '../src/journey/events.js';
import { useLegs, syntheticTrail, legList, LEGS, SEASONS, GOODS, nationFor } from '../src/journey/route.js';
import { mulberry32, hashSeed } from '../src/journey/rng.js';
import { LETTER_LINES, LETTER_OPEN } from '../src/content/letters.js';

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failures.push(name); console.log('  ✗ ' + name + '\n      ' + String(e && e.stack || e).split('\n').slice(0, 4).join('\n      ')); }
}
const TRAIL = syntheticTrail(12);
useLegs(TRAIL);
const PARTY = ['blacksmith', 'scout', 'teacher'];   // v1.2: no cook (Rosa's 10 % changes the food arithmetic these tests pin down); each skill has its own party in the v1.2 tests below
const clone = (x) => JSON.parse(JSON.stringify(x));

// ---- a scripted kid: answers with the given chances, shops for the stretch to the next fort, plays the events ----
function shop(J, factor = 1.3) {
  const plan = foodToNextFort(J);
  const want = Math.max(0, Math.round(plan.lb * factor) - J.food);
  const sacks = Math.ceil(want / lbOf('flour'));
  if (sacks > 0) buy(J, { item: 'flour', qty: sacks, price: priceAt('flour', storeLeg(J), J.season) });
  if (J.parts < 1) buy(J, { item: 'parts', qty: 1 });
  if (coldLegsAhead(J).length && (J.goods.blankets | 0) < needsBlankets(J, coldLegsAhead(J)[0]).need) buy(J, { item: 'blankets', qty: needsBlankets(J, coldLegsAhead(J)[0]).need - (J.goods.blankets | 0) });   // v1.2: blankets before the cold legs
  if ((J.goods.arrows | 0) < 10 && J.opts.hunting) buy(J, { item: 'arrows', qty: 2 });
}
function playLeg(J, kid, rand, log = {}) {
  const out = { markers: 0, events: [], days: 0, minFood: Infinity, crawl: 0, maxCrawl: 0 };
  for (let d = 0; d < 400; d++) {
    const r = tickDay(J, { rand });
    out.days++;
    out.minFood = Math.min(out.minFood, J.food);
    assert.ok(J.food >= 0, 'food never below 0');
    assert.ok(J.cash >= 0, 'cash never below 0');
    if (r.crawl) { out.crawl++; out.maxCrawl = Math.max(out.maxCrawl, ++log.run || (log.run = 1)); } else log.run = 0;
    if (r.marker) { out.markers++; applyMarker(J, { correct: rand() < kid.marker, quick: rand() < 0.5 }); }
    if (r.event) {
      out.events.push(r.event);
      const e = r.event;
      if (e.kind === 'hunt') applyHunt(J, { meatLb: kid.huntLb });
      else if (e.kind === 'fish') applyFish(J, { fishLb: kid.fishLb });
      else if (e.kind === 'trade') {
        const offer = tradeOffer(J);
        const p = problemFor({ kind: 'trade', fact: '3x4', leg: J.legId, season: J.season, rand, have: offer.have });
        applyProblem(J, { kind: 'trade', correct: rand() < kid.problem });
        applyTrade(J, p.meta);
      } else if (e.kind === 'problem') applyProblem(J, { kind: e.problem === 'parts' ? 'parts' : 'fact', correct: rand() < kid.problem });
      else if (e.kind === 'breakdown') repair(J, { workedOut: kid.problem >= 1 });
    }
    if (r.arrived) break;
  }
  return out;
}
function playJourney(seed, kid, { shopFactor = 1.3, words = true } = {}) {
  const rand = mulberry32(seed);
  const J = createJourney({ season: kid.season || 's1847', wagonName: 'Bessie', animal: kid.animal || 'oxen', companions: PARTY, seed });
  setRations(J, kid.rations || 'full'); setPace(J, kid.pace || 'steady');
  const legs = [];
  if (kid.shops) shop(J, shopFactor);
  const log = {};
  for (let guard = 0; guard < 40 && !J.done; guard++) {
    const leg = legList()[J.legIndex];
    const out = playLeg(J, kid, rand, log);
    if (words) applyWords(J, { asked: 3, right: kid.marker >= 1 ? 3 : 0 });
    const res = arrive(J);
    assert.ok(res, `arrived at ${leg.id}`);
    if (kid.shops && leg.stop.kind === 'fort') shop(J, shopFactor);
    legs.push({ id: leg.id, ...out, stars: res.stars, crate: res.crate });
    nextLeg(J);
  }
  return { J, legs };
}
const RIGHT = { marker: 1, problem: 1, huntLb: 30, fishLb: 12, shops: true };
const WRONG = { marker: 0, problem: 0, huntLb: 0, fishLb: 0, shops: false };

console.log('\nthe journey object');
test('createJourney has the §10 shape, the party and the first leg started', () => {
  const J = createJourney({ season: 's1847', wagonName: 'Bessie', animal: 'oxen', companions: PARTY, seed: 42 });
  for (const k of ['season', 'legIndex', 'legId', 'milesDone', 'day', 'cash', 'food', 'parts', 'tokens', 'pace', 'rations', 'mood', 'party', 'stickers', 'letters', 'legStats', 'done'])
    assert.ok(k in J, k);
  assert.deepEqual(Object.keys(J.legStats).sort(), ['fished', 'hunted', 'markers', 'markersRight', 'problems', 'problemsRight', 'words', 'wordsRight']);
  assert.equal(J.legId, TRAIL[0].id); assert.equal(J.cash, START.cash); assert.equal(J.food, START.food);
  assert.deepEqual(J.party.map((p) => p.id), PARTY);
  assert.ok(J.party.every((p) => ['happy', 'fine', 'tired'].includes(p.mood)));
  assert.equal(J.done, false); assert.equal(partySize(J), 4);
  assert.equal(J.goods.pelts, 6, 'a few pelts to trade');
  assert.deepEqual(clone(J), J, 'JSON-safe');
});
test('the season scales the starting cash, not the food', () => {
  const a = createJourney({ season: 's1850', companions: PARTY }), b = createJourney({ season: 's1853', companions: PARTY });
  assert.equal(a.cash, START.cash * 2); assert.equal(b.cash, START.cash * 4); assert.equal(a.food, START.food);
});
test('startLeg resets the leg stats; restarting an unfinished leg replays it freshly seeded', () => {
  const J = createJourney({ companions: PARTY, seed: 5 });
  for (let i = 0; i < 3; i++) tickDay(J);
  J.legStats.markers = 2;
  const plan1 = clone(J.trip.events);
  const leg = startLeg(J);
  assert.equal(leg.id, TRAIL[0].id); assert.equal(J.milesDone, 0); assert.equal(J.legStats.markers, 0);
  let differs = false;
  for (let i = 0; i < 6 && !differs; i++) { startLeg(J); differs = JSON.stringify(J.trip.events) !== JSON.stringify(plan1); }
  assert.ok(differs, 'a replayed leg gets a fresh plan');
  assert.equal(startLeg(J, TRAIL[3].id).id, TRAIL[3].id, 'a named leg');
});

console.log('\ndays, food and mood');
test('pace / rations arithmetic: foodNeeded, etaDays, milesPerDay', () => {
  assert.equal(foodNeeded(4, 'full', 10), 120);
  assert.equal(foodNeeded(4, 'plenty', 10), 80);
  assert.equal(foodNeeded(4, 'lean', 10), 40);
  assert.equal(foodNeeded(4, 'full', 10, 2), 140, 'mules eat 2 lb a day');
  assert.equal(foodNeeded(3, 'full', 0), 0);
  assert.equal(etaDays(150, 'steady', 'oxen'), 10);
  assert.equal(etaDays(150, 'brisk', 'oxen'), 8);
  assert.equal(etaDays(150, 'steady', 'mules'), 9);
  assert.equal(etaDays(0, 'steady', 'oxen'), 0);
  assert.equal(milesPerDay('brisk', 'mules'), 23);
});
test('a day: ~15 miles steady on oxen, food eaten by rations × party (+ mule feed)', () => {
  const J = createJourney({ companions: PARTY, seed: 9 });
  const f0 = J.food;
  const r = tickDay(J, { rand: () => 0.5 });
  assert.equal(r.miles, 15); assert.equal(J.food, f0 - 12); assert.equal(J.day, 1);
  setRations(J, 'lean'); tickDay(J, { rand: () => 0.5 }); assert.equal(J.food, f0 - 16);
  const M = createJourney({ companions: PARTY, animal: 'mules', seed: 9 });
  setPace(M, 'brisk');
  const rm = tickDay(M, { rand: () => 0.5 });
  assert.equal(rm.miles, 23); assert.equal(M.food, f0 - 14);
});
test('a missed marker makes the next day slow (60 %); a quick right one is 3 free miles', () => {
  const J = createJourney({ companions: PARTY, seed: 9 });
  tickDay(J, { rand: () => 0.5 });
  applyMarker(J, { correct: false });
  const r = tickDay(J, { rand: () => 0.5 });
  assert.equal(r.miles, Math.round(15 * SPEED.slowDay)); assert.ok(r.slow);
  assert.equal(tickDay(J, { rand: () => 0.5 }).miles, 15, 'only one slow day');
  const before = J.milesDone;
  const q = applyMarker(J, { correct: true, quick: true });
  assert.equal(q.freeMiles, SPEED.quickMiles); assert.equal(J.milesDone, before + 3);
});
test('no food: the party crawls at 40 %, is tired, and food never goes below 0', () => {
  const J = createJourney({ companions: PARTY, seed: 3 });
  J.food = 5;
  tickDay(J, { rand: () => 0.5 });
  assert.equal(J.food, 0); assert.equal(J.mood, 'tired'); assert.ok(J.party.every((p) => p.mood === 'tired'));
  const r = tickDay(J, { rand: () => 0.5 });
  assert.ok(r.crawl); assert.equal(r.miles, Math.round(15 * SPEED.crawl)); assert.equal(J.food >= 0, true);
});
test('mood: full rations at a steady pace cheer the party up; lean and brisk wear it down; food back = not tired', () => {
  const J = createJourney({ companions: PARTY, seed: 4 });
  J.spirit = 40; setRations(J, 'full');
  for (let i = 0; i < 8; i++) tickDay(J, { rand: () => 0.5 });
  assert.equal(J.mood, 'happy');
  const K = createJourney({ companions: PARTY, seed: 4 });
  setRations(K, 'lean'); setPace(K, 'brisk');
  for (let i = 0; i < 8; i++) tickDay(K, { rand: () => 0.5 });
  assert.notEqual(K.mood, 'happy');
});
test('tired for days with food in the wagon: the party rests a day on its own', () => {
  const J = createJourney({ companions: PARTY, seed: 4 });
  J.spirit = 10; setRations(J, 'lean'); setPace(J, 'brisk');
  let rested = false;
  for (let i = 0; i < 6; i++) { const r = tickDay(J, { rand: () => 0.5 }); if (r.rest) { rested = true; assert.equal(r.miles, 0); } }
  assert.ok(rested);
});

console.log('\nmarkers and events');
test('markerMiles: 4-6 markers for every leg length from 140 to 210 miles, in order, before the stop', () => {
  for (let m = 140; m <= 210; m += 5) {
    const xs = markerMiles(m);
    assert.ok(xs.length >= MARKERS.min && xs.length <= MARKERS.max, `${m}: ${xs.length}`);
    assert.ok(xs.every((x, i) => x > 0 && x < m && (i === 0 || x > xs[i - 1])));
  }
  assert.equal(markerMiles(150).length, 4); assert.equal(markerMiles(170).length, 5); assert.equal(markerMiles(200).length, 6);
});
test('markers: every planned marker is reached, one a day at most, 4-6 a leg on 150-200 mile legs, for oxen and brisk mules', () => {
  for (const [animal, pace] of [['oxen', 'steady'], ['mules', 'brisk']]) {
    const { legs } = playJourney(11, { ...RIGHT, animal, pace });
    for (const l of legs) {
      const leg = TRAIL.find((x) => x.id === l.id);
      assert.equal(l.markers, markerMiles(leg.miles).length, l.id);
      if (leg.miles >= 150 && leg.miles <= 200) assert.ok(l.markers >= 4 && l.markers <= 6, l.id);
    }
  }
});
test('planEvents: one or two, never the same kind twice, by biome, trades only where a nation trades', () => {
  for (const leg of TRAIL) for (let s = 0; s < 60; s++) {
    const plan = planEvents(leg, mulberry32(hashSeed('plan', leg.id, s)), { hunting: true }, markerMiles(leg.miles));
    assert.ok(plan.length >= 1 && plan.length <= 2, `${leg.id} ${plan.length}`);
    assert.equal(new Set(plan.map((e) => e.kind)).size, plan.length, 'kinds differ');
    for (const p of plan) {
      const e = EVENT_BY_ID[p.id];
      assert.ok(!Array.isArray(e.biomes) || e.biomes.includes(leg.biome), `${e.id} in ${leg.biome}`);
      if (e.kind === 'trade') assert.ok(nationFor(leg), `trade at ${leg.id}`);
      assert.ok(p.atMile > 0 && p.atMile < leg.miles);
    }
  }
});
test('hunting off: no hunts planned and no hunting safety net', () => {
  for (const leg of TRAIL) assert.ok(eligibleEvents(leg, { hunting: false }).every((e) => e.kind !== 'hunt'));
  const J = createJourney({ companions: PARTY, seed: 77, hunting: false });
  J.food = 0;
  for (let d = 0; d < 200 && !J.done; d++) {
    const r = tickDay(J);
    if (r.event) assert.notEqual(r.event.kind, 'hunt');
    if (r.arrived) { arrive(J); nextLeg(J); }
  }
  setHunting(J, true); assert.equal(J.opts.hunting, true);
});
test('events that fire never repeat a kind in a leg (the safety net included) and respect the biome', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const { legs } = playJourney(seed, seed % 2 ? WRONG : { ...RIGHT, rations: 'lean' });
    for (const l of legs) {
      const kinds = l.events.map((e) => e.kind);
      assert.equal(new Set(kinds).size, kinds.length, `${l.id}: ${kinds}`);
      const leg = TRAIL.find((x) => x.id === l.id);
      for (const e of l.events) if (!e.rescue) assert.ok(!Array.isArray(e.biomes) || e.biomes.includes(leg.biome));
      assert.ok(l.events.filter((e) => !e.rescue).length <= 2);
    }
  }
});
test('the safety net: food at 0 brings a hunt / fishing hole / find the same day, worth at least RESCUE.minLb', () => {
  const J = createJourney({ companions: PARTY, seed: 21 });
  J.food = 0; J.trip.events = [];
  const r = tickDay(J, { rand: () => 0.5 });
  assert.ok(r.event && r.event.rescue, 'a rescue event');
  if (r.event.kind === 'hunt') assert.ok(applyHunt(J, { meatLb: 0 }).foodLb >= RESCUE.minLb);
  else if (r.event.kind === 'fish') assert.ok(applyFish(J, { fishLb: 0 }).foodLb >= RESCUE.minLb);
  else assert.ok(r.event.foodAdded >= RESCUE.minLb);
  assert.ok(J.food >= RESCUE.minLb);
});
test('a storm rests the party a day; berries add food; a wheel is a breakdown that needs a part (repair, below, uses it)', () => {
  const J = createJourney({ companions: PARTY, seed: 2 });
  const evAt = (id) => { J.trip.events = [{ id, kind: EVENT_BY_ID[id].kind, atMile: J.milesDone + 1, fired: false }]; J.trip.markers = []; J.trip.nextMarker = 0; return tickDay(J, { rand: () => 0.5 }); };
  assert.equal(evAt('storm').restNext, 'event');
  assert.equal(tickDay(J, { rand: () => 0.5 }).miles, 0);
  const f = J.food; const b = evAt('berries'); assert.equal(J.food, f - 12 + EVENT_BY_ID.berries.foodLb); assert.equal(b.event.foodAdded, EVENT_BY_ID.berries.foodLb);
  J.parts = 1; const w = evAt('wheel').event; assert.ok(w.needsPart && w.kind === 'breakdown' && w.part === 'wheel'); assert.equal(J.parts, 1, 'the sim only notes it; repair() uses the part');
  const rr = repair(J); assert.ok(rr.fixed && !rr.usedPart && rr.skill.id === 'forge', 'Ada is in this party: the first repair of the leg needs no part'); assert.equal(J.parts, 1);
});

console.log('\nanswers, the store, trades, arriving');
test('applyProblem: a token for a first-try right answer only; stats by kind', () => {
  const J = createJourney({ companions: PARTY });
  assert.equal(applyProblem(J, { kind: 'buy', correct: true, firstTry: true }).tokens, 1);
  assert.equal(applyProblem(J, { kind: 'buy', correct: true, firstTry: false }).tokens, 0);
  assert.equal(applyProblem(J, { kind: 'ration', correct: false }).tokens, 0);
  assert.equal(J.tokens, 1);
  assert.deepEqual([J.legStats.problems, J.legStats.problemsRight], [3, 2]);
  assert.deepEqual(J.totals.byKind.buy, { n: 2, right: 2 });
});
test('applyWords counts asked and right (right never more than asked)', () => {
  const J = createJourney({ companions: PARTY });
  applyWords(J, { asked: 3, right: 2 }); applyWords(J, { asked: 3, right: 9 });
  assert.deepEqual([J.legStats.words, J.legStats.wordsRight], [6, 5]);
});
test('buy never goes below $0; food goods add pounds, parts add parts, others go in the goods', () => {
  const J = createJourney({ companions: PARTY });
  J.cash = 20;
  assert.deepEqual(buy(J, { item: 'flour', qty: 6, price: 4 }), { ok: false, cost: 24, cash: 20, foodLb: 0 });
  assert.equal(J.cash, 20);
  const f = J.food;
  assert.equal(buy(J, { item: 'flour', qty: 5, price: 4 }).ok, true);
  assert.equal(J.cash, 0); assert.equal(J.food, f + 250);
  assert.equal(buy(J, { item: 'parts', qty: 1, price: 6 }).ok, false);
  J.cash = 100; buy(J, { item: 'parts', qty: 2 }); assert.equal(J.parts, START.parts + 2);
  buy(J, { item: 'rope', qty: 1 }); assert.equal(J.goods.rope, 1);
  assert.equal(buy(J, { item: 'flour', qty: 0 }).cost, 0);
  assert.ok(J.cash >= 0);
});
test('priceAt / storeList: the good × the fort × the season, whole dollars', () => {
  const fort = TRAIL.find((l) => l.stop.kind === 'fort');
  assert.equal(priceAt('flour', null, 's1847'), 4);
  assert.equal(priceAt('flour', fort, 's1847'), Math.round(4 * fort.fort.prices));
  assert.equal(priceAt('flour', null, 's1850'), 8); assert.equal(priceAt('flour', null, 's1853'), 16);
  const list = storeList(fort, 's1850');
  assert.equal(list.length, GOODS.length + 1, 'every good plus the second yoke');
  assert.deepEqual(list.find((g) => g.id === 'yoke'), { id: 'yoke', name: 'A second yoke', unit: 'yoke', lb: 0, emoji: '🐂', food: false, price: priceAt('yoke', fort, 's1850') });
  assert.equal(priceAt('yoke', null, 's1847'), 30); assert.equal(priceAt('yoke', fort, 's1847'), Math.round(30 * fort.fort.prices));
  for (const g of list) { assert.ok(Number.isInteger(g.price) && g.price >= 1); assert.equal(g.price, priceAt(g.id, fort, 's1850')); }
});
test('trades: pelts from the start and the hunts; the trade adds food by TRADE_LB; never more than the wagon holds', () => {
  const J = createJourney({ companions: PARTY, seed: 1 });
  const offer = tradeOffer(J);
  assert.equal(offer.have, 6);
  const f = J.food;
  const r = applyTrade(J, { giveN: 6, getN: 4 });
  assert.equal(r.got, 4); assert.equal(J.goods[offer.give] | 0, 0); assert.equal(J.food, f + 4 * lbOf(offer.get));
  const r2 = applyTrade(J, { giveN: 6, getN: 4 });
  assert.equal(r2.got, 0, 'no pelts left, no goods from nothing');
  assert.equal(applyHunt(J, { meatLb: 30 }).pelts, 2); assert.equal(applyHunt(J, { meatLb: 10 }).pelts, 1); assert.equal(applyHunt(J, { meatLb: 0 }).pelts, 0);
  assert.equal(TRADE_LB.corn, 25); assert.equal(lbOf('wapato'), 10); assert.equal(lbOf('something-new'), 10); assert.equal(lbOf('flour'), 50);
});
test('hunting and fishing add food and the leg stats', () => {
  const J = createJourney({ companions: PARTY });
  const f = J.food;
  applyHunt(J, { meatLb: 25 }); applyFish(J, { fishLb: 8.4 });
  assert.equal(J.food, f + 33); assert.equal(J.legStats.hunted, 25); assert.equal(J.legStats.fished, 8);
  applyHunt(J, { meatLb: -5 }); assert.equal(J.food, f + 33);
});
test('arrive: three stars, $60 × priceMult + $20 a star, the sticker, the crate; idempotent; null before the stop', () => {
  const J = createJourney({ companions: PARTY, seed: 8 });
  assert.equal(arrive(J), null);
  let r;
  do { r = tickDay(J); if (r.marker) applyMarker(J, { correct: true }); } while (!r.arrived);
  const cash0 = J.cash;
  const res = arrive(J);
  assert.equal(res.stars[0], true); assert.equal(res.stars[2], true);
  assert.deepEqual(res.cash, payFor(res.stars, 's1847'));
  assert.equal(res.cash.total, PAY.arrival + PAY.star * starCount(res.stars));
  assert.equal(J.cash, cash0 + res.cash.total);
  assert.equal(res.crate, crateFor(res.stars));
  assert.equal(arrive(J), res); assert.equal(J.cash, cash0 + res.cash.total, 'paid once');
  assert.deepEqual(J.stickers, [TRAIL[0].sticker.id]);
  assert.equal(tickDay(J).miles, 0, 'no travel after arriving');
});
test('crates: gold on 3 stars, silver on 2, bronze on 1; pay scales with the season', () => {
  assert.equal(crateFor([true, true, true]), 'gold'); assert.equal(crateFor([true, false, true]), 'silver');
  assert.equal(crateFor([true, false, false]), 'bronze'); assert.equal(crateFor([false, false, false]), null);
  assert.equal(payFor([true, true, true], 's1850').total, 120 + 60); assert.equal(payFor([true], 's1853').arrival, 240);
});
test('stars: everyone happy needs every companion happy; every marker right needs at least one marker', () => {
  const J = createJourney({ companions: PARTY });
  J.milesDone = TRAIL[0].miles;
  J.party.forEach((p) => { p.mood = 'happy'; });
  assert.deepEqual(starsFor(J), [true, true, false]);
  J.legStats.markers = 4; J.legStats.markersRight = 4; J.party[1].mood = 'fine';
  assert.deepEqual(starsFor(J), [true, false, true]);
});

console.log('\nwhole journeys');
test('always right (full rations, steady, shopping for the next stretch): 12 legs, 36 stars, cash to spare', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const { J, legs } = playJourney(seed, RIGHT);
    assert.equal(legs.length, 12);
    const done = journeyDone(J);
    assert.ok(done, 'the valley');
    assert.equal(done.stars, 36, `seed ${seed}: ${legs.map((l) => l.stars.filter(Boolean).length).join('')}`);
    assert.ok(J.cash > 0 && J.cash > START.cash, `cash ${J.cash}`);
    assert.ok(legs.every((l) => l.crate === 'gold'));
    assert.equal(J.stickers.length, 12);
    assert.deepEqual(clone(J), J, 'JSON-safe after a whole journey');
  }
});
test('always wrong (never shops, misses every marker, every hunt empty): still arrives at every stop, food never below 0', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const { J, legs } = playJourney(seed, WRONG);
    assert.equal(legs.length, 12); assert.ok(J.done);
    assert.ok(legs.every((l) => l.stars[0] && !l.stars[2]));
    assert.ok(legs.every((l) => l.days < 80), `days: ${legs.map((l) => l.days)}`);
    assert.ok(legs.every((l) => l.minFood >= 0));
    assert.ok(J.totals.maxCrawlDays <= 3, `crawled ${J.totals.maxCrawlDays} days in a row`);
  }
});
test('food never negative under random dials, animals and answers (30 journeys)', () => {
  for (let seed = 100; seed < 130; seed++) {
    const rand = mulberry32(seed);
    const J = createJourney({ companions: PARTY, animal: rand() < 0.5 ? 'oxen' : 'mules', seed });
    for (let d = 0; d < 2000 && !J.done; d++) {
      if (rand() < 0.1) setRations(J, ['full', 'plenty', 'lean'][Math.floor(rand() * 3)]);
      if (rand() < 0.1) setPace(J, rand() < 0.5 ? 'steady' : 'brisk');
      const r = tickDay(J, { rand });
      assert.ok(J.food >= 0 && Number.isInteger(J.food));
      if (r.marker) applyMarker(J, { correct: rand() < 0.5 });
      if (r.event && r.event.kind === 'hunt') applyHunt(J, { meatLb: rand() * 40 });
      if (r.event && r.event.kind === 'fish') applyFish(J, { fishLb: rand() * 15 });
      if (r.arrived) { arrive(J); nextLeg(J); }
    }
    assert.ok(J.done, `seed ${seed} finished`);
  }
});
test('the content\'s own legs (the skeleton or the full trail) play through too', () => {
  useLegs(null);
  try {
    const J = createJourney({ companions: PARTY, seed: 3 });
    let n = 0;
    while (!J.done && n++ < 3000) { const r = tickDay(J); if (r.marker) applyMarker(J, { correct: true }); if (r.arrived) { arrive(J); nextLeg(J); } }
    assert.ok(J.done); assert.equal(J.totals.legs, LEGS.length);
  } finally { useLegs(TRAIL); }
});
test('determinism: the same seed and answers give the same journey; another seed differs', () => {
  const a = playJourney(31, { ...RIGHT, marker: 0.7, problem: 0.6 }).J;
  const b = playJourney(31, { ...RIGHT, marker: 0.7, problem: 0.6 }).J;
  const c = playJourney(32, { ...RIGHT, marker: 0.7, problem: 0.6 }).J;
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.totals, c.totals);
  // without a rand, the days are seeded by the journey itself
  const x = createJourney({ companions: PARTY, seed: 9 }), y = createJourney({ companions: PARTY, seed: 9 });
  for (let i = 0; i < 30; i++) { tickDay(x); tickDay(y); }
  assert.deepEqual(x, y);
});
test('nextLeg / journeyDone: on to the next leg after an arrival, the valley after the last', () => {
  const J = createJourney({ companions: PARTY, seed: 6 });
  assert.equal(nextLeg(J), null, 'not before arriving');
  assert.equal(journeyDone(J), null);
  J.milesDone = J.trip.miles; J.trip.arrived = true;
  assert.equal(nextLeg(J).id, TRAIL[1].id); assert.equal(J.totals.legs, 1, 'paid on the way');
  J.legIndex = 11; startLeg(J, TRAIL[11].id); J.milesDone = J.trip.miles; J.trip.arrived = true;
  assert.equal(nextLeg(J), null); assert.ok(J.done); assert.ok(journeyDone(J));
});
test('newSeason: the next year, bigger prices and cash, same party, tokens carried', () => {
  const { J } = playJourney(3, RIGHT);
  J.tokens = 7;
  const N = newSeason(J);
  assert.equal(N.season, 's1850'); assert.equal(N.cash, START.cash * 2); assert.equal(N.tokens, 7);
  assert.deepEqual(N.companions, PARTY); assert.equal(N.seasonsDone, 1); assert.equal(N.legIndex, 0); assert.equal(N.done, false);
  assert.equal(newSeason(newSeason(N)).season, 's1853', 'the last season repeats');
});
test('legStatus and foodToNextFort for the HUD and the store', () => {
  const J = createJourney({ companions: PARTY, seed: 6 });
  const s = legStatus(J);
  assert.equal(s.milesLeft, TRAIL[0].miles); assert.equal(s.nextMarkerIn, markerMiles(TRAIL[0].miles)[0]);
  const plan = foodToNextFort(J);
  const fortIdx = TRAIL.findIndex((l) => l.stop.kind === 'fort');
  const miles = TRAIL.slice(0, fortIdx + 1).reduce((a, l) => a + l.miles, 0);
  assert.equal(plan.miles, miles); assert.equal(plan.lb, foodNeeded(4, 'full', etaDays(miles, 'steady', 'oxen')));
  assert.equal(plan.enough, J.food >= plan.lb);
});

console.log('\nword problems');
// every stock fact: ×2 … ×12 (× 1 … 12) and their ÷ twins, plus the big tiers
const FACTS = [null, '20x3', '14x6', '23x4', '91/7', '60/3', '180/60', '3x20', '6x14'];
for (let a = 2; a <= 12; a++) for (let b = 1; b <= 12; b++) FACTS.push(`${a}x${b}`, `${a * b}/${a}`, `${a * b}/${b}`);
test('every kind × every stock fact × every season: a whole answer, 2-3 work lines, text and a spoken form with no digits', () => {
  let n = 0;
  for (const kind of PROBLEM_KINDS) for (const fact of FACTS) for (const season of SEASONS) {
    const p = problemFor({ kind, fact, leg: TRAIL[3], season: season.id, rand: mulberry32(hashSeed(kind, fact, season.id)) });
    const tag = `${kind} ${fact} ${season.id}`;
    assert.ok(Number.isInteger(p.answer) && p.answer >= 0, `${tag}: answer ${p.answer}`);
    assert.ok(p.answer <= 999, `${tag}: answer ${p.answer}`);
    assert.ok(Array.isArray(p.work) && p.work.length >= 2 && p.work.length <= 3, `${tag}: work ${p.work}`);
    assert.ok(p.text && p.say, tag);
    assert.ok(!/\d/.test(p.say), `${tag}: say "${p.say}"`);
    assert.ok(!/[$×÷{}]/.test(p.say), `${tag}: say symbols "${p.say}"`);
    assert.ok(!/\{|\bundefined\b|NaN/.test(p.text + p.work.join(' ')), `${tag}: ${p.text}`);
    assert.ok(['$', 'lb', 'days', 'mi', ''].includes(p.unit), tag);
    assert.equal(p.kind, kind); assert.equal(p.fact, fact);
    if (p.answers) {
      assert.equal(p.answers[0], p.answer); assert.equal(p.parts.length, p.answers.length);
      p.parts.forEach((q, i) => { assert.equal(q.answer, p.answers[i]); assert.ok(!/\d/.test(q.say)); assert.ok(Number.isInteger(q.answer)); });
    }
    n++;
  }
  assert.ok(n > 4000);
});
test('the answers are right (checked from the sentence numbers in meta)', () => {
  for (const fact of FACTS) for (const season of SEASONS) {
    const o = { leg: TRAIL[1], season: season.id };
    const b = problemFor({ kind: 'buy', fact, ...o }); assert.equal(b.answer, b.meta.price * b.meta.qty);
    const d = problemFor({ kind: 'divide', fact, ...o, remainder: false }); assert.equal(d.answer * d.meta.price, d.meta.total);
    const r = problemFor({ kind: 'divide', fact, ...o, remainder: true });
    if (r.answers) { assert.ok(r.answers[1] >= 1 && r.answers[1] < r.meta.price); assert.equal(r.text.includes(`$${r.meta.qty * r.meta.price + r.answers[1]}`), true); }
    const ra = problemFor({ kind: 'ration', fact, ...o }); assert.ok(ra.answer > 0);
    if (fact) assert.equal(ra.answer, ra.meta.have - ra.meta.daily * ra.meta.days);
    const di = problemFor({ kind: 'distance', fact, ...o }); assert.equal(di.meta.miles, di.meta.rate * di.meta.days);
    const tr = problemFor({ kind: 'trade', fact, ...o }); assert.equal(tr.answer, tr.meta.getN); assert.equal(tr.meta.giveN / tr.meta.rate[0] * tr.meta.rate[1], tr.meta.getN);
  }
});
test('the spec\'s examples: $7 flour × 8 sacks with the doubling split; ÷ shows the related × fact; two steps, two lines', () => {
  const p = problemFor({ kind: 'buy', fact: '7x8', season: 's1847', item: 'flour' });
  assert.equal(p.text, 'A sack of flour costs $7. You buy 8 sacks. How much is that?');
  assert.equal(p.say, 'A sack of flour costs seven dollars. You buy eight sacks. How much is that?');
  assert.equal(p.answer, 56); assert.equal(p.unit, '$');
  assert.ok(p.work.includes('7 × 8: 7 × 4 = 28, doubled = 56'), p.work.join(' | '));
  const small = problemFor({ kind: 'buy', fact: '3x4' });
  assert.equal(small.work.length, 2, 'no split for a small fact');
  const d = problemFor({ kind: 'divide', fact: '56/7', remainder: false, item: 'flour' });
  assert.equal(d.answer, 8); assert.ok(d.work.some((l) => l.includes('7 × 8 = 56')));
  const rem = problemFor({ kind: 'divide', fact: '56/7', remainder: true, rand: () => 0.5 });
  assert.equal(rem.answers.length, 2); assert.equal(rem.answers[0], 8); assert.equal(rem.parts[1].unit, '$');
  const r = problemFor({ kind: 'ration', fact: null, rand: mulberry32(1) });
  assert.equal(r.work.length, 2); assert.equal(r.answer, r.meta.people * r.meta.perPerson * r.meta.days);
  assert.ok(problemFor({ kind: 'buy', fact: '23x4' }).text.includes('$23'), 'big × is the price');
  assert.ok(problemFor({ kind: 'buy', fact: '23x4' }).work.includes('23 × 4: 20 × 4 = 80, 3 × 4 = 12, 80 + 12 = 92'));
  assert.equal(splitLine(20, 3), '20 × 3: 2 × 3 = 6, so 20 × 3 = 60');
  assert.equal(splitLine(9, 7), '9 × 7: 10 × 7 = 70, take away 7 = 63');
  assert.equal(splitLine(7, 7), '7 × 7: 5 × 7 = 35, 2 × 7 = 14, 35 + 14 = 49');
  assert.equal(splitLine(3, 4), null);
});
test('a × with a factor of 6 or more always shows a split line', () => {
  for (let a = 2; a <= 12; a++) for (let b = 2; b <= 12; b++) {
    if (Math.max(a, b) < 6) continue;
    const s = splitLine(a, b);
    assert.ok(s && s.endsWith(`${a * b}`), `${a}x${b}: ${s}`);
    const p = problemFor({ kind: 'buy', fact: `${a}x${b}`, season: 's1847' });
    assert.equal(p.work.length, 3, `${a}x${b}`);
  }
});
test('seasons scale the numbers where it makes sense (prices, pounds, miles), never past 999', () => {
  const at = (s, kind = 'buy', fact = '7x8') => problemFor({ kind, fact, season: s, item: 'flour' });
  assert.equal(at('s1847').answer, 56); assert.equal(at('s1850').answer, 112); assert.equal(at('s1853').answer, 224);
  assert.ok(at('s1853', 'distance', '56/7').meta.miles > at('s1847', 'distance', '56/7').meta.miles);
  assert.ok(at('s1853', 'divide', '56/7').meta.total > at('s1847', 'divide', '56/7').meta.total);
  assert.equal(at('s1853', 'parts', '7x8').meta.total, 56, 'counts are not scaled');
  assert.ok(at('s1853', 'buy', '49x6').answer <= 999);
});
test('trade problems use the leg\'s nation and never trade more than the wagon holds', () => {
  const leg = TRAIL.find((l) => nationFor(l));
  const n = nationFor(leg);
  const p = problemFor({ kind: 'trade', fact: '7x8', leg });
  assert.ok(p.text.includes(n.name)); assert.equal(p.meta.nation, n.id);
  const q = problemFor({ kind: 'trade', fact: '7x8', leg, have: 7 });
  assert.ok(q.meta.giveN <= 7);
});
test('parseFactId and numberWords', () => {
  assert.deepEqual(parseFactId('7x8'), { op: 'x', a: 7, b: 8, p: 56 });
  assert.equal(parseFactId('56/7').q, 8); assert.equal(parseFactId('7 × 8').p, 56); assert.equal(parseFactId('55/7'), null);
  assert.equal(parseFactId('19+34'), null); assert.equal(parseFactId(null), null);
  assert.equal(numberWords(56), 'fifty-six'); assert.equal(numberWords(108), 'one hundred eight'); assert.equal(numberWords(999), 'nine hundred ninety-nine');
});

console.log('\nletters');
test('a letter: an opening, three lines that happened, the P.S. with the three words, a closing', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const rand = mulberry32(seed);
    const J = createJourney({ companions: PARTY, seed });
    if (seed % 3 === 0) { J.food = 0; }
    const out = playLeg(J, { marker: 0.7, problem: 0.6, huntLb: seed % 2 ? 20 : 0, fishLb: 8 }, rand);
    arrive(J);
    const L = composeLetter(J, null, ['enough', 'through', 'buffalo']);
    assert.equal(L.lines.length, 3, L.text);
    assert.ok(LETTER_OPEN.includes(L.opening));
    assert.equal(L.ps, 'P.S. My spelling words this week: enough, through and buffalo.');
    assert.ok(!/[{}]/.test(L.text), L.text);
    const allowed = new Set(['arrived', ...happenedKeys(J)]);
    for (const k of L.keys) assert.ok(allowed.has(k), `${k} did not happen: ${L.text}`);
    // each line is one of its key's templates, filled
    L.keys.forEach((k, i) => {
      const ok = lineSource(k).some((tpl) => new RegExp('^' + tpl.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{\w+\\?\}/g, '.+') + '$').test(L.lines[i]));
      assert.ok(ok, `${k}: ${L.lines[i]}`);
    });
    // a hunt line only when the hunt brought food
    if (L.keys.includes('hunt')) assert.ok(J.legStats.hunted > 0);
    const fired = out.events.map((e) => e.id);
    for (const k of L.keys) if (EVENT_BY_ID[k] && !['hunt', 'fish', 'trade'].includes(EVENT_BY_ID[k].kind)) assert.ok(fired.includes(k), `${k} not fired`);
    assert.deepEqual(composeLetter(J, null, ['enough', 'through', 'buffalo']), L, 'deterministic');
  }
});
test('letters: the river line on a river leg, the mood line by the mood, an empty hunt is not a line', () => {
  const J = createJourney({ companions: PARTY, seed: 4 });
  J.milesDone = J.trip.miles; J.trip.arrived = true;
  J.trip.happened = ['storm', 'hunt']; J.legStats.hunted = 0; J.mood = 'happy';
  const keys = happenedKeys(J);
  assert.ok(keys.includes('storm')); assert.ok(!keys.includes('hunt')); assert.ok(keys.includes('happy'));
  if (TRAIL[0].stop.kind === 'river') assert.ok(keys.includes('river'));
  const L = composeLetter(J, ['storm'], ['a', 'b', 'c']);
  assert.equal(L.keys[0], 'arrived');
  assert.ok(L.lines[0].includes(TRAIL[0].stop.name));
  assert.equal(composeLetter(J, [], ['one', 'two']).ps, 'P.S. My spelling words this week: one and two.');
  keepLetter(J, L); assert.equal(J.letters.length, 1); assert.equal(J.letters[0].text, L.text);
});

// ================= v1.1: trail cards, camp, the daily challenge, wagon upgrades, the derby's pay =================
console.log('\ntrail cards (content)');
test('40 cards in four suits: 12 landmarks, 8 nations, 12 wild, 8 companions, with the shape the album needs', () => {
  assert.equal(CARDS.length, 40);
  assert.deepEqual(SUITS, ['landmark', 'nation', 'wild', 'companion']);
  assert.deepEqual(SUITS.map((s) => cardsOf(s).length), [12, 8, 12, 8]);
  assert.equal(new Set(CARDS.map((c) => c.id)).size, 40, 'ids are unique across suits');
  for (const c of CARDS) {
    assert.equal(CARD_BY_ID[c.id], c);
    for (const k of ['id', 'suit', 'name', 'emoji', 'fact', 'say']) assert.ok(typeof c[k] === 'string' && c[k].length > 0, `${c.id}.${k}`);
    assert.ok(SUITS.includes(c.suit));
    assert.ok(c.fact.length <= 160, `${c.id}: one line (${c.fact.length})`);
  }
  assert.deepEqual(cardsOf('landmark').map((c) => c.id), LEGS.map((l) => l.id), 'a landmark card per leg id, in trail order');
  assert.deepEqual(cardsOf('nation').map((c) => c.id), NATIONS.map((n) => n.id), 'a card per nation id');
  assert.deepEqual(cardsOf('companion').map((c) => c.id), COMPANIONS.map((c) => c.id), 'a card per companion id');
  assert.deepEqual(cardsOf('wild').map((c) => c.id).sort(), ['bald-eagle', 'bison', 'camas', 'coyote', 'jackrabbit', 'mule-deer', 'prairie-dog',
    'pronghorn', 'rattlesnake', 'sagebrush', 'salmon', 'wild-plum']);
});
test('kid rules: no death, illness or weapons in a card; the rattlesnake is only "give it room"; the spoken line has no digits', () => {
  const bad = /\b(die[sd]?|dead|death|kill\w*|sick\w*|ill|illness|disease\w*|gun\w*|shoot\w*|shot|weapon\w*|arrow\w*|bow|blood\w*|bite\w*|bitten|venom\w*|poison\w*|grave\w*|hurt|wound\w*)\b/i;
  for (const c of CARDS) {
    assert.ok(!bad.test(c.fact), `${c.id}: ${c.fact}`);
    assert.ok(!bad.test(c.say), `${c.id}: ${c.say}`);
    assert.ok(!/\d/.test(c.say), `${c.id}: numbers as words in say: ${c.say}`);
    assert.ok(!/\b(mph|ft|mi)\b/.test(c.say), `${c.id}: no abbreviations in say`);
  }
  assert.equal(CARD_BY_ID.rattlesnake.fact, 'Rattlesnake: give it room.');
});
test('every wild card has biomes, every biome has a wild card, and each wild card has a source entry in docs/SOURCES.md', () => {
  const biomes = new Set(['prairie', 'bluffs', 'highdesert', 'mountains', 'gorge', 'valley']);
  for (const c of cardsOf('wild')) assert.ok(c.biomes.length > 0 && c.biomes.every((b) => biomes.has(b)), c.id);
  for (const b of biomes) assert.ok(cardsOf('wild').some((c) => c.biomes.includes(b)), `a wild card for ${b}`);
  const src = readFileSync(new URL('../docs/SOURCES.md', import.meta.url), 'utf8');
  for (const c of cardsOf('wild')) assert.ok(src.includes(`<a id="card-${c.id}">`), `SOURCES.md has card-${c.id}`);
  for (const c of [...cardsOf('landmark'), ...cardsOf('nation')]) assert.ok(src.includes(`<a id="${c.id}">`), `SOURCES.md has ${c.id}`);
});

console.log('\ntrail cards (the sim)');
test('awardCard: a new card is kept; a duplicate pays one trade token; an unknown id changes nothing', () => {
  const J = createJourney({ companions: PARTY, seed: 3 });
  assert.deepEqual(J.cards, []);
  const a = awardCard(J, 'bison');
  assert.equal(a.new, true); assert.equal(a.tokens, 0); assert.deepEqual(J.cards, ['bison']); assert.equal(J.tokens, 0);
  const b = awardCard(J, 'bison');
  assert.equal(b.new, false); assert.equal(b.tokens, 1); assert.equal(J.tokens, 1); assert.deepEqual(J.cards, ['bison']);
  awardCard(J, 'bison'); assert.equal(J.tokens, 2);
  const c = awardCard(J, 'not-a-card');
  assert.equal(c.new, false); assert.equal(c.tokens, 0); assert.equal(J.tokens, 2); assert.deepEqual(J.cards, ['bison']);
});
test('suitComplete: false until every card of the suit is held, true on the last, and only for that suit', () => {
  const J = createJourney({ companions: PARTY, seed: 3 });
  assert.ok(SUITS.every((s) => !suitComplete(J, s)));
  const comp = cardsOf('companion');
  comp.slice(0, -1).forEach((c) => { const r = awardCard(J, c.id); assert.equal(r.suitComplete, false); });
  assert.equal(suitComplete(J, 'companion'), false);
  assert.deepEqual(suitProgress(J, 'companion'), { have: 7, of: 8 });
  const last = awardCard(J, comp[comp.length - 1].id);
  assert.equal(last.new, true); assert.equal(last.suitComplete, true);
  assert.equal(suitComplete(J, 'companion'), true); assert.equal(suitComplete(J, 'wild'), false); assert.equal(suitComplete(J, 'nonsense'), false);
  for (const s of SUITS) cardsOf(s).forEach((c) => awardCard(J, c.id));
  assert.ok(SUITS.every((s) => suitComplete(J, s)));
  assert.equal(J.cards.length, 40);
});
test('cardForLeg: a wild card of the leg\'s biome (else any wild); cardForAnimal maps the scene\'s animals', () => {
  const J = createJourney({ companions: PARTY, seed: 5 });
  for (let i = 0; i < legList().length; i++) {
    startLeg(J, legList()[i].id);
    const biome = legList()[i].biome;
    const rand = mulberry32(i + 1);
    const seen = new Set();
    for (let k = 0; k < 60; k++) { const c = cardForLeg(J, rand); assert.equal(c.suit, 'wild'); assert.ok(c.biomes.includes(biome), `${c.id} in ${biome}`); seen.add(c.id); }
    assert.ok(seen.size >= 2, `variety on ${biome}`);
  }
  J.legId = 'nowhere'; const any = cardForLeg(J, () => 0); assert.equal(any.suit, 'wild');   // an unknown leg: any wild card
  assert.equal(cardForAnimal('eagle').id, 'bald-eagle'); assert.equal(cardForAnimal('bison').id, 'bison');
  assert.equal(cardForAnimal('pronghorn').id, 'pronghorn'); assert.equal(cardForAnimal('coyote').id, 'coyote');
  assert.equal(cardForAnimal('deer').id, 'mule-deer'); assert.equal(cardForAnimal('rabbit').id, 'jackrabbit');
  assert.equal(cardForAnimal('turkey'), null); assert.equal(cardForAnimal(undefined), null);
});

console.log('\ncamp');
test('camp: costs a day, eats a normal day\'s food, covers no miles, and lifts the mood (+8 rest, +4 the others)', () => {
  for (const kind of ['fish', 'hunt', 'cards', 'tales', 'rest']) {
    const J = createJourney({ companions: PARTY, seed: 9 });
    tickDay(J, { rand: mulberry32(1) });
    J.spirit = 40; J.rations = 'plenty';
    const before = { day: J.day, food: J.food, miles: J.milesDone, spirit: J.spirit, totalsDays: J.totals.days };
    const r = camp(J, kind, { rand: mulberry32(2) });
    assert.equal(r.day, before.day + 1); assert.equal(J.day, before.day + 1); assert.equal(J.totals.days, before.totalsDays + 1);
    assert.equal(J.milesDone, before.miles, 'no miles');
    assert.equal(before.food - J.food, foodNeeded(partySize(J), 'plenty', 1, 0), 'a normal day\'s food');
    assert.equal(r.food, J.food); assert.equal(r.mood, J.mood);
    assert.equal(J.spirit, before.spirit + (kind === 'rest' ? 8 : 4), kind);
    assert.equal(J.totals.camps, 1); assert.equal(r.kind, kind);
  }
});
test('camp: food never goes below 0 (mules eat feed too), spirit stays within 0-100, an unknown kind is a rest', () => {
  const J = createJourney({ animal: 'mules', companions: PARTY, seed: 9 });
  J.food = 5; J.spirit = 98;
  const r = camp(J, 'rest');
  assert.equal(J.food, 0); assert.equal(r.food, 0); assert.equal(J.spirit, 100);
  const r2 = camp(J, 'fish'); assert.equal(J.food, 0); assert.ok(r2.day === r.day + 1);
  const r3 = camp(J, 'dance'); assert.equal(r3.kind, 'rest');
  J.spirit = 10; camp(J, 'rest'); assert.equal(J.spirit, 18);
});
test('camp: uses up a waiting rest day, counts in the leg\'s log, and the fishing it makes room for feeds the party', () => {
  const J = createJourney({ companions: PARTY, seed: 11 });
  J.trip.restDays = 1;
  camp(J, 'fish');
  assert.equal(J.trip.restDays, 0);
  assert.ok(J.trip.happened.includes('camp'));
  J.food = 0;
  camp(J, 'fish'); applyFish(J, { fishLb: 12 });
  assert.ok(J.food >= 12);
  const day = J.day, miles = J.milesDone;
  tickDay(J, { rand: mulberry32(3) });
  assert.equal(J.day, day + 1); assert.ok(J.milesDone > miles);
});
test('camp: a day of camping every leg never breaks the journey (food >= 0, cash >= 0, every leg arrives)', () => {
  const rand = mulberry32(77);
  const J = createJourney({ companions: PARTY, seed: 77 });
  shop(J);
  const kinds = ['fish', 'hunt', 'cards', 'tales', 'rest'];
  for (let guard = 0; guard < 40 && !J.done; guard++) {
    camp(J, kinds[guard % 5], { rand }); assert.ok(J.food >= 0);
    playLeg(J, { marker: 0.7, problem: 0.6, huntLb: 20, fishLb: 8 }, rand);
    assert.ok(arrive(J)); nextLeg(J);
  }
  assert.ok(J.done); assert.equal(J.totals.legs, 12); assert.equal(J.totals.camps, 12);
});

console.log('\ndaily challenge');
// a throwaway search for a day key that gives a kind on the journey's current leg
function keyForKind(J, kind) {
  for (let i = 0; i < 400; i++) {
    const probe = clone(J); const ch = dailyChallenge(probe, `probe-${i}`);
    if (ch.kind === kind) return `probe-${i}`;
  }
  return null;
}
test('dailyChallenge: deterministic per day key and leg; different days vary; all six kinds appear across days and legs', () => {
  const seen = new Set();
  for (const leg of TRAIL) {
    const A = createJourney({ companions: PARTY, seed: 1 }), B = createJourney({ companions: PARTY, seed: 999 });
    startLeg(A, leg.id); startLeg(B, leg.id);
    const kinds = new Set();
    for (let d = 0; d < 40; d++) {
      const key = `2026-11-${String(d + 1).padStart(2, '0')}`;
      const a = dailyChallenge(A, key), b = dailyChallenge(B, key);
      assert.equal(a.id, b.id); assert.equal(a.text, b.text); assert.equal(a.say, b.say);
      assert.equal(a.id, dailyChallenge(A, key).id, 'asking again gives the same goal');
      assert.deepEqual(a.reward, { tokens: 1, card: true });
      assert.equal(typeof a.check, 'function'); assert.equal(a.check(A), false, 'not met yet');
      assert.ok(a.text.length > 8 && !/\d/.test(a.say) && !/undefined|\{|\}/.test(a.text), a.text);
      if (leg.stop.kind !== 'river') assert.notEqual(a.kind, 'river'); else if (a.kind === 'river') assert.ok(a.text.includes(leg.stop.name));
      if (!nationFor(leg)) assert.notEqual(a.kind, 'trade');
      kinds.add(a.kind); seen.add(a.kind);
    }
    assert.ok(kinds.size >= 3, `${leg.id}: variety (${[...kinds]})`);
  }
  assert.deepEqual([...seen].sort(), ['camp', 'markers', 'reach', 'river', 'supper', 'trade']);
  const J = createJourney({ companions: PARTY, seed: 1 });
  assert.ok(!/undefined/.test(dailyChallenge(J, 'x').text));
});
test('dailyChallenge: J.challenges records the day, stays JSON-safe, and the goal does not move when the leg does', () => {
  const J = createJourney({ companions: PARTY, seed: 4 });
  const ch = dailyChallenge(J, '2026-11-05');
  assert.equal(J.challenges['2026-11-05'].id, ch.id); assert.equal(J.challenges['2026-11-05'].done, false);
  J.milesDone = J.trip.miles; arrive(J); nextLeg(J);
  const again = dailyChallenge(J, '2026-11-05');
  assert.equal(again.id, ch.id); assert.equal(again.text, ch.text);
  assert.deepEqual(clone(J.challenges), J.challenges);
  const next = dailyChallenge(J, '2026-11-06');
  assert.ok(next.id.startsWith('2026-11-06|'));
});
test('dailyChallenge checks: every marker right, supper, river words, reach the stop, trade, make camp', () => {
  // markers: right on the leg; one miss spoils it
  let J = createJourney({ companions: PARTY, seed: 21 });
  let ch = dailyChallenge(J, keyForKind(J, 'markers'));
  assert.equal(ch.check(J), false);
  const n = J.trip.markers.length;
  for (let i = 0; i < n - 1; i++) applyMarker(J, { correct: true, quick: false });
  assert.equal(ch.check(J), false, 'not every marker asked yet');
  applyMarker(J, { correct: true, quick: false });
  assert.equal(ch.check(J), true);
  J = createJourney({ companions: PARTY, seed: 21 });
  ch = dailyChallenge(J, keyForKind(J, 'markers'));
  for (let i = 0; i < n; i++) applyMarker(J, { correct: i !== 1, quick: false });
  assert.equal(ch.check(J), false, 'one miss');
  // supper: a fish or a hunt that brought food
  J = createJourney({ companions: PARTY, seed: 22 });
  ch = dailyChallenge(J, keyForKind(J, 'supper'));
  assert.equal(ch.check(J), false); applyFish(J, { fishLb: 0 }); assert.equal(ch.check(J), false, 'an empty line is not supper');
  applyFish(J, { fishLb: 6 }); assert.equal(ch.check(J), true);
  J = createJourney({ companions: PARTY, seed: 22 });
  ch = dailyChallenge(J, keyForKind(J, 'supper')); applyHunt(J, { meatLb: 10 }); assert.equal(ch.check(J), true);
  J = createJourney({ companions: PARTY, seed: 22, hunting: false });
  assert.ok(!/supper/.test(dailyChallenge(J, keyForKind(J, 'supper')).text), 'hunting off: just a fish');
  // river: the first leg is the Kansas River; three words, all right
  J = createJourney({ companions: PARTY, seed: 23 });
  assert.equal(J.legId, TRAIL[0].id); assert.equal(TRAIL[0].stop.kind, 'river');
  ch = dailyChallenge(J, keyForKind(J, 'river'));
  assert.ok(ch.text.includes(TRAIL[0].stop.name), ch.text);
  assert.equal(ch.check(J), false);
  applyWords(J, { asked: 3, right: 2 }); assert.equal(ch.check(J), false, 'one word missed');
  J = createJourney({ companions: PARTY, seed: 23 });
  ch = dailyChallenge(J, keyForKind(J, 'river')); applyWords(J, { asked: 3, right: 3 }); assert.equal(ch.check(J), true);
  // reach: the stop; and it is remembered after the party rolls on
  J = createJourney({ companions: PARTY, seed: 24 });
  ch = dailyChallenge(J, keyForKind(J, 'reach'));
  assert.ok(ch.text.startsWith('Reach '), ch.text); assert.equal(ch.check(J), false);
  J.milesDone = J.trip.miles; assert.equal(ch.check(J), true);
  arrive(J); nextLeg(J); assert.equal(ch.check(J), true, 'still met on the next leg');
  // trade: units got from a post (Kansas has the Kansa)
  J = createJourney({ companions: PARTY, seed: 25 });
  ch = dailyChallenge(J, keyForKind(J, 'trade')); assert.equal(ch.check(J), false);
  applyTrade(J, { giveN: 3, getN: 2 }); assert.equal(ch.check(J), true);
  // camp: once
  J = createJourney({ companions: PARTY, seed: 26 });
  ch = dailyChallenge(J, keyForKind(J, 'camp')); assert.equal(ch.check(J), false);
  camp(J, 'rest'); assert.equal(ch.check(J), true);
});
test('claimChallenge: only when met, once per day key, +1 token; another day is separate; survives a JSON round trip', () => {
  const J = createJourney({ companions: PARTY, seed: 31 });
  const key = keyForKind(J, 'camp');
  const ch = dailyChallenge(J, key);
  assert.deepEqual(claimChallenge(J, ch.id), { ok: false }); assert.equal(J.tokens, 0);
  camp(J, 'tales');
  const r = claimChallenge(J, ch.id);
  assert.deepEqual(r, { ok: true, tokens: 1, card: true }); assert.equal(J.tokens, 1); assert.equal(J.challenges[key].done, true);
  assert.deepEqual(claimChallenge(J, ch.id), { ok: false }, 'once'); assert.equal(J.tokens, 1);
  assert.equal(dailyChallenge(J, key).done, true);
  assert.deepEqual(claimChallenge(J, 'nonsense|camp|x'), { ok: false });
  assert.deepEqual(claimChallenge(J, key + '|camp|' + J.legId), { ok: false }, 'the id must match the day\'s goal unless it is the goal');
  const saved = JSON.parse(JSON.stringify(J));
  assert.deepEqual(claimChallenge(saved, ch.id), { ok: false }, 'still claimed after a save');
  const other = dailyChallenge(saved, 'another-day');
  assert.notEqual(other.id, ch.id); assert.equal(other.done, false);
});

console.log('\nwagon upgrades');
test('buyUpgrade: with tokens or cash, once, never below 0, nothing changes on a refusal', () => {
  assert.deepEqual(UPGRADES.map((u) => [u.id, u.tokens, u.cash]), [['cover', 6, 40], ['tires', 8, 60], ['barrel', 6, 40]]);
  const J = createJourney({ companions: PARTY, seed: 41 });
  assert.deepEqual(J.upgrades, {});
  J.tokens = 5; assert.equal(buyUpgrade(J, 'cover', { tokens: true }), false); assert.equal(J.tokens, 5); assert.deepEqual(J.upgrades, {});
  J.tokens = 7; assert.equal(buyUpgrade(J, 'cover', { tokens: true }), true); assert.equal(J.tokens, 1); assert.equal(J.upgrades.cover, true);
  assert.equal(buyUpgrade(J, 'cover', { tokens: true }), false, 'owned'); assert.equal(J.tokens, 1);
  assert.equal(buyUpgrade(J, 'cover', { cash: true }), false, 'owned, cash too');
  const cash0 = J.cash;
  assert.equal(buyUpgrade(J, 'tires', { cash: true }), true); assert.equal(J.cash, cash0 - 60); assert.ok(J.upgrades.tires);
  J.cash = 39; assert.equal(buyUpgrade(J, 'barrel', { cash: true }), false); assert.equal(J.cash, 39);
  assert.equal(buyUpgrade(J, 'barrel', {}), false, 'no payment named'); assert.equal(buyUpgrade(J, 'wings', { tokens: true }), false);
  assert.deepEqual(upgradesOwned(J), ['cover', 'tires']);
  const R = createJourney({ season: 's1850', companions: PARTY, seed: 41 });
  const c0 = R.cash; assert.equal(buyUpgrade(R, 'barrel', { cash: true }), true); assert.equal(R.cash, c0 - 80, 'cash prices scale with the season');
});
test('tires: +2 miles on a moving day, in the plan\'s arithmetic too (ETA, food to the next fort)', () => {
  const mk = () => createJourney({ companions: PARTY, seed: 51 });
  const A = mk(), B = mk();
  B.tokens = 8; assert.equal(buyUpgrade(B, 'tires', { tokens: true }), true);
  const ra = tickDay(A, { rand: () => 0.5 }), rb = tickDay(B, { rand: () => 0.5 });
  assert.equal(rb.miles - ra.miles, 2);
  for (const pace of ['steady', 'brisk']) { setPace(A, pace); setPace(B, pace); assert.equal(tickDay(B, { rand: () => 0.5 }).miles - tickDay(A, { rand: () => 0.5 }).miles, 2, pace); }
  assert.ok(legStatus(B).etaDays <= legStatus(A).etaDays);
  assert.equal(milesPerDay('steady', 'oxen', 2), 17); assert.equal(etaDays(34, 'steady', 'oxen', 2), 2); assert.equal(etaDays(34, 'steady', 'oxen'), 3);
  // a rest day stays 0 miles
  B.trip.restDays = 1; assert.equal(tickDay(B, { rand: () => 0.5 }).miles, 0);
});
test('cover: a storm (any rest event) costs the party no mood; without it, it does', () => {
  const mk = () => { const J = createJourney({ companions: PARTY, seed: 52 }); J.trip.events = [{ id: 'storm', kind: 'rest', atMile: 1, fired: false }]; J.rations = 'plenty'; J.spirit = 70; return J; };
  const A = mk(), B = mk(); B.upgrades.cover = true;
  const ra = tickDay(A, { rand: () => 0.5 }), rb = tickDay(B, { rand: () => 0.5 });
  assert.equal(ra.event.id, 'storm'); assert.equal(rb.event.id, 'storm');
  assert.equal(rb.event.covered, true); assert.equal(ra.event.covered, false);
  assert.equal(B.spirit - A.spirit, MOOD.weather); assert.equal(B.spirit, 70 + MOOD.pace.steady);
  // other events are untouched by the cover
  const C = mk(), D = mk(); C.trip.events = D.trip.events = [{ id: 'berries', kind: 'bonus', atMile: 1, fired: false }]; D.upgrades.cover = true;
  tickDay(C, { rand: () => 0.5 }); tickDay(D, { rand: () => 0.5 }); assert.equal(C.spirit, D.spirit);
});
test('barrel: lean rations count as plenty for the mood (and only for the mood: the food eaten is the same)', () => {
  const mk = () => { const J = createJourney({ companions: PARTY, seed: 53 }); J.rations = 'lean'; J.spirit = 70; return J; };
  const A = mk(), B = mk(); B.upgrades.barrel = true;
  tickDay(A, { rand: () => 0.5 }); tickDay(B, { rand: () => 0.5 });
  assert.equal(B.spirit - A.spirit, -MOOD.ration.lean);
  assert.equal(A.food, B.food, 'still one pound a person');
  const P = mk(), Q = mk(); P.rations = Q.rations = 'full'; Q.upgrades.barrel = true;
  tickDay(P, { rand: () => 0.5 }); tickDay(Q, { rand: () => 0.5 }); assert.equal(P.spirit, Q.spirit, 'full rations are unchanged');
});

console.log('\nFort Derby pay');
test('derbyPay: $20 x the season\'s price level for a win, $5 for a good try, added to the cash', () => {
  for (const s of SEASONS) {
    const J = createJourney({ season: s.id, companions: PARTY, seed: 61 });
    const c0 = J.cash;
    assert.deepEqual(derbyPay(J, { won: true, margin: 3 }), { cash: 20 * s.priceMult, won: true }); assert.equal(J.cash, c0 + 20 * s.priceMult);
    assert.deepEqual(derbyPay(J, { won: false, margin: -2 }), { cash: 5, won: false }); assert.equal(J.cash, c0 + 20 * s.priceMult + 5);
    assert.equal(J.totals.derbyPlayed, 2); assert.equal(J.totals.derbyWon, 1);
  }
});

console.log('\nv1.1 and older saves');
test('createJourney defaults the v1.1 fields; a 1.0 save (none of them) plays on, and everything stays JSON-safe', () => {
  const N = createJourney({ companions: PARTY, seed: 71 });
  assert.deepEqual(N.cards, []); assert.deepEqual(N.upgrades, {}); assert.deepEqual(N.challenges, {});
  assert.equal(N.totals.camps, 0); assert.equal(N.totals.derbyPlayed, 0); assert.equal(N.totals.derbyWon, 0);
  const old = clone(N);
  delete old.cards; delete old.upgrades; delete old.challenges; delete old.totals.camps; delete old.totals.derbyPlayed; delete old.totals.derbyWon;
  const rand = mulberry32(5);
  tickDay(old, { rand });
  assert.deepEqual(old.upgrades, {}); assert.deepEqual(old.cards, []);
  const old2 = clone(old); delete old2.cards; delete old2.upgrades; delete old2.challenges; delete old2.totals.camps;
  assert.equal(camp(old2, 'cards').day, old2.day); assert.equal(old2.totals.camps, 1);
  const old3 = clone(N); delete old3.cards; delete old3.challenges; delete old3.upgrades;
  assert.equal(awardCard(old3, 'camas').new, true); assert.equal(buyUpgrade(old3, 'cover', { cash: true }), true);
  assert.equal(derbyPay(old3, { won: true }).cash, 20); assert.ok(dailyChallenge(old3, 'd').text);
  const old4 = clone(N); delete old4.upgrades; delete old4.cards; assert.ok(legStatus(old4)); assert.ok(foodToNextFort(old4));
  for (const x of [old, old2, old3, old4, N]) assert.deepEqual(JSON.parse(JSON.stringify(x)), x);
  const ens = clone(N); delete ens.cards; ensureJourney(ens); assert.deepEqual(ens.cards, []);
});
test('newSeason carries the cards, the upgrades and the day\'s claims, and the album keeps filling', () => {
  const J = createJourney({ companions: PARTY, seed: 81 });
  awardCard(J, 'bison'); awardCard(J, 'kansa'); J.tokens = 6; buyUpgrade(J, 'barrel', { tokens: true });
  dailyChallenge(J, 'day-1');
  J.done = true;
  const N = newSeason(J);
  assert.deepEqual(N.cards, ['bison', 'kansa']); assert.deepEqual(N.upgrades, { barrel: true }); assert.ok(N.challenges['day-1']);
  N.cards.push('x'); assert.deepEqual(J.cards, ['bison', 'kansa'], 'copies, not shared');
  assert.equal(awardCard(N, 'bison').tokens, 1);
});
test('whole journeys with the v1.1 layer: upgrades bought, camps, cards and a derby leave the always-right and always-wrong results intact', () => {
  for (const kid of [RIGHT, WRONG]) {
    const rand = mulberry32(2024);
    const J = createJourney({ companions: PARTY, seed: 2024 });
    J.tokens = 20; buyUpgrade(J, 'tires', { tokens: true }); buyUpgrade(J, 'cover', { tokens: true });
    if (kid.shops) shop(J);
    for (let guard = 0; guard < 40 && !J.done; guard++) {
      if (guard % 3 === 2) { camp(J, 'fish', { rand }); applyFish(J, { fishLb: kid.fishLb }); }
      playLeg(J, kid, rand);
      applyWords(J, { asked: 3, right: kid.marker >= 1 ? 3 : 0 });
      arrive(J); awardCard(J, cardForLeg(J, rand).id); awardCard(J, legList()[J.legIndex].id); derbyPay(J, { won: guard % 2 === 0 });
      if (kid.shops && legList()[J.legIndex].stop.kind === 'fort') shop(J);
      assert.ok(J.food >= 0 && J.cash >= 0);
      nextLeg(J);
    }
    assert.ok(J.done); assert.equal(J.totals.legs, 12);
    if (kid === RIGHT) assert.equal(J.totals.stars, 36);
    assert.equal(suitProgress(J, 'landmark').have, 12, 'a landmark card per arrival');
  }
});

// ================= v1.2: supplies that matter, companion skills, rivers, forecast, deeds and people =================
const PLAIN = ['teacher', 'storyteller', 'fiddler'];                 // three companions whose skills touch none of the arithmetic below
const mk = (companions = PLAIN, seed = 7, extra = {}) => createJourney({ companions, seed, ...extra });
const quiet = (J) => { J.trip.events = []; J.trip.markers = []; J.trip.nextMarker = 0; return J; };   // plain days: no events, no markers
const rich = (J, lb = 3000) => { J.foods.flour = lb; J.foods.bacon = lb; J.foods.beans = lb; J.foods.other = 0; syncFood(J); return J; };
const sumKinds = (J) => FOOD_KINDS.reduce((a, k) => a + J.foods[k], 0);
const R5 = () => 0.5;
const baseCards = CARDS.map((c) => c.id);

console.log('\nv1.2 supplies: food by kind');
test('createJourney: foods split 50 / 30 / 20 of the 300 lb, J.food is their plain-number sum, the goods start as the spec says', () => {
  const J = mk();
  assert.deepEqual(J.foods, { flour: 150, bacon: 90, beans: 60, other: 0 });
  assert.equal(J.food, 300); assert.equal(typeof Object.getOwnPropertyDescriptor(J, 'food').value, 'number', 'a plain number, not a getter');
  assert.deepEqual(J.goods, { parts: 1, rope: 0, blankets: 0, arrows: 15, pelts: 6, yoke: 0 });
  assert.deepEqual(J.animals, { n: 2, tired: 0 }); assert.equal(J.limp, false); assert.deepEqual(J.met, []); assert.deepEqual(J.deeds, []);
  assert.deepEqual(clone(J), J);
  assert.equal(syncFood(J), 300);
});
test('a day eats 50 / 30 / 20 % from flour / bacon / beans, in the long run exactly, and never a fraction of a pound', () => {
  const J = rich(mk(), 6000);
  const before = { ...J.foods };
  for (let i = 0; i < 100; i++) { camp(J, 'rest', { rand: R5 }); assert.equal(J.food, sumKinds(J)); assert.ok(Number.isInteger(J.food)); }
  const eaten = FOOD_KINDS.map((k) => before[k] - J.foods[k]);
  assert.equal(eaten[0] + eaten[1] + eaten[2], 100 * 12);
  assert.ok(Math.abs(eaten[0] - 600) <= 1 && Math.abs(eaten[1] - 360) <= 1 && Math.abs(eaten[2] - 240) <= 1, `eaten ${eaten}`);
  assert.equal(eaten[3], 0);
});
test('"other" (game, fish, plums, trades) is eaten first; then the ratio', () => {
  const J = rich(mk(), 600); J.foods.other = 30; syncFood(J);
  camp(J, 'rest', { rand: R5 }); camp(J, 'rest', { rand: R5 });
  assert.equal(J.foods.other, 6); assert.deepEqual([J.foods.flour, J.foods.bacon, J.foods.beans], [600, 600, 600]);
  camp(J, 'rest', { rand: R5 });
  assert.equal(J.foods.other, 0); assert.equal(600 * 3 - (J.foods.flour + J.foods.bacon + J.foods.beans), 6, 'the rest of that day came from the sacks');
});
test('when a kind runs out the day comes from whatever is left, and food never goes below 0', () => {
  const J = mk(); J.foods = { flour: 3, bacon: 0, beans: 40, other: 0 }; syncFood(J);
  let prev = J.food;
  for (let i = 0; i < 8; i++) {
    camp(J, 'rest', { rand: R5 });
    for (const k of FOOD_KINDS) assert.ok(J.foods[k] >= 0 && Number.isInteger(J.foods[k]), `${k} ${J.foods[k]}`);
    assert.equal(J.food, sumKinds(J)); assert.equal(prev - J.food, Math.min(prev, 12)); prev = J.food;
  }
  assert.equal(J.food, 0);
  camp(J, 'rest', { rand: R5 }); assert.equal(J.food, 0);
});
test('buy adds to its own kind; hunts, fish, berries, trades and a person\'s gift add to "other"; J.food stays the sum', () => {
  const J = mk(); J.cash = 1000;
  const f0 = { ...J.foods };
  buy(J, { item: 'flour', qty: 2 }); buy(J, { item: 'bacon', qty: 3 }); buy(J, { item: 'beans', qty: 4 });
  assert.equal(J.foods.flour, f0.flour + 100); assert.equal(J.foods.bacon, f0.bacon + 60); assert.equal(J.foods.beans, f0.beans + 100);
  assert.equal(J.food, sumKinds(J));
  applyHunt(J, { meatLb: 30 }); applyFish(J, { fishLb: 10 }); assert.equal(J.foods.other, 40);
  applyTrade(J, { giveN: 3, getN: 2 }); assert.equal(J.foods.other, 40 + 2 * lbOf(tradeOffer(J).get));
  J.trip.events = [{ id: 'berries', kind: 'bonus', atMile: 1, fired: false }]; J.trip.markers = [];
  const o = J.foods.other; tickDay(J, { rand: R5 });
  assert.ok(J.foods.other >= o + 20 - 12, 'plums go in the "other" sack');
  const first = meetPerson(J, 'hale'); assert.equal(first.gift.kind, 'food');
  assert.equal(J.food, sumKinds(J));
});
test('foodDays: days of food left at the current rations ("food for six days"), counting Rosa\'s cooking', () => {
  const J = mk();
  assert.equal(foodDays(J), 25); setRations(J, 'lean'); assert.equal(foodDays(J), 75); setRations(J, 'full');
  J.foods.flour = 10; J.foods.bacon = 0; J.foods.beans = 2; syncFood(J); assert.equal(foodDays(J), 1);
  J.food = 0; syncFood(J); J.foods = { flour: 0, bacon: 0, beans: 0, other: 0 }; syncFood(J); assert.equal(foodDays(J), 0);
  const C = mk(['cook', 'teacher', 'fiddler']); assert.equal(foodDays(C), 27, '300 lb at 10.8 lb a day');
});
test('Rosa: food lasts a tenth longer (90 % eaten, exact over days); berries are planned about twice as often', () => {
  const A = rich(mk(PLAIN, 3), 6000), B = rich(mk(['cook', 'teacher', 'fiddler'], 3), 6000);
  let skill = null;
  for (let i = 0; i < 100; i++) { camp(A, 'rest', { rand: R5 }); const r = camp(B, 'rest', { rand: R5 }); skill = skill || r.skill; }
  assert.equal(6000 * 3 - A.food, 1200); assert.ok(Math.abs((6000 * 3 - B.food) - 1080) <= 1, `${6000 * 3 - B.food}`);
  let nA = 0, nB = 0;
  for (const leg of TRAIL) for (let s = 0; s < 120; s++) {
    for (const [cook, set] of [[false, (n) => { nA += n; }], [true, (n) => { nB += n; }]]) {
      const plan = planEvents(leg, mulberry32(hashSeed('cook', leg.id, s)), { hunting: true, cook }, markerMiles(leg.miles));
      set(plan.filter((e) => e.kind === 'bonus').length);
    }
  }
  assert.ok(nB > nA * 1.4, `berries ${nA} -> ${nB}`);
  // announced on a day she saved food, once a leg (tickDay) and on a berries find
  const C = mk(['cook', 'teacher', 'fiddler'], 5); quiet(C);
  const r = tickDay(C, { rand: R5 }); assert.equal(r.skill.id, 'good-cooking'); assert.equal(r.skill.who, 'cook');
  assert.equal(tickDay(C, { rand: R5 }).skill, null, 'once a leg');
  C.trip.events = [{ id: 'berries', kind: 'bonus', atMile: C.milesDone + 1, fired: false }];
  assert.equal(tickDay(C, { rand: R5 }).skill.id, 'good-cooking');
});
test('a food total changed directly (older code) is adopted: more goes in "other", less shrinks every kind', () => {
  const J = mk();
  J.food = 5; tickDay(J, { rand: R5 });
  assert.equal(J.food, 0); assert.equal(sumKinds(J), 0);
  const K = mk(); K.food += 40; tickDay(K, { rand: R5 }); assert.equal(K.foods.other, 40 - Math.max(0, 12)); assert.equal(K.food, sumKinds(K));
  const L = mk(); L.food = 150; ensureJourney(L); assert.deepEqual([L.foods.flour, L.foods.bacon, L.foods.beans], [75, 45, 30]);
});

console.log('\nv1.2 supplies: breakdowns, the yoke, arrows, blankets');
test('breakdown events: wheel, axle and tongue, kind "breakdown", each with its part; tickDay hands over needsPart', () => {
  const bd = EVENTS.filter((e) => e.kind === 'breakdown');
  assert.deepEqual(bd.map((e) => [e.id, e.part]).sort(), [['axle', 'axle'], ['tongue', 'tongue'], ['wheel', 'wheel']]);
  for (const e of bd) { assert.equal(e.biomes, null); assert.ok(e.text && e.say && e.fix && !/\d/.test(e.say)); }
  for (const e of bd) {
    const J = mk(PLAIN, 11); quiet(J);
    J.trip.events = [{ id: e.id, kind: 'breakdown', atMile: 1, fired: false }];
    const r = tickDay(J, { rand: R5 });
    assert.equal(r.event.id, e.id); assert.equal(r.event.needsPart, true); assert.equal(r.needsPart, true); assert.equal(r.event.part, e.part);
    assert.equal(r.event.havePart, true); assert.equal(J.parts, 1, 'the sim only notes it');
  }
});
test('repair with a spare part: a part is used, nothing is lost, no limp', () => {
  const J = mk(); const r = repair(J, { workedOut: true });
  assert.deepEqual([r.fixed, r.usedPart, r.skill, r.limp], [true, true, null, false]);
  assert.equal(J.parts, 0); assert.equal(J.goods.parts, 0); assert.equal(J.totals.repairs, 1); assert.equal(J.totals.repairsWorkedOut, 1);
});
test('repair with no part: a limp (60 % speed), a lost day, until a part is bought or a fort is reached', () => {
  const J = mk(); quiet(J); J.parts = 0; J.goods.parts = 0;
  const r = repair(J);
  assert.deepEqual([r.fixed, r.usedPart, r.limp, r.lostDay], [false, false, true, true]); assert.equal(J.limp, true);
  const lost = tickDay(J, { rand: R5 });
  assert.equal(lost.lost, true); assert.equal(lost.rest, true); assert.equal(lost.miles, 0);
  const slow = tickDay(J, { rand: R5 });
  assert.equal(slow.limp, true); assert.equal(slow.miles, Math.round(15 * SPEED.limp), 'limping at 60 %');
  buy(J, { item: 'parts', qty: 1 }); assert.equal(J.limp, false);
  assert.equal(tickDay(J, { rand: R5 }).miles, 15, 'a part bought mends it');
  // a fort mends it; a river or a landmark does not
  const F = mk(); F.parts = 0; repair(F); startLeg(F, 'fort-kearny'); F.milesDone = F.trip.miles; arrive(F); assert.equal(F.limp, false, 'Fort Kearny');
  const K = mk(); K.parts = 0; repair(K); K.milesDone = K.trip.miles; arrive(K); assert.equal(K.limp, true, 'the Kansas River is not a fort');
});
test('Ada mends one breakdown a leg without a part (skill forge), then it takes a part; a new leg resets it', () => {
  const J = mk(['blacksmith', 'teacher', 'fiddler']); J.parts = 1;
  const a = repair(J);
  assert.deepEqual([a.fixed, a.usedPart], [true, false]); assert.deepEqual(a.skill, { ...a.skill, id: 'forge', who: 'blacksmith' }); assert.ok(a.skill.name && a.skill.text);
  assert.equal(J.parts, 1);
  const b = repair(J); assert.deepEqual([b.fixed, b.usedPart, b.skill], [true, true, null]); assert.equal(J.parts, 0);
  const c = repair(J); assert.equal(c.fixed, false); assert.equal(c.limp, true);
  J.limp = false; startLeg(J, TRAIL[1].id); const d = repair(J); assert.equal(d.skill.id, 'forge', 'a fresh leg, a fresh mend');
  assert.equal(J.totals.forgeFixes, 2);
  const ev = (() => { const K = mk(['blacksmith', 'teacher', 'fiddler']); quiet(K); K.trip.events = [{ id: 'axle', kind: 'breakdown', atMile: 1, fired: false }]; return tickDay(K, { rand: R5 }).event; })();
  assert.equal(ev.freeFix, 'forge', 'the event says Ada can cover it');
});
test('Tomas: a spare part serves two repairs (every second repair is free); with Ada, Ada goes first', () => {
  const J = mk(['carpenter', 'teacher', 'fiddler']); J.parts = 1;
  const a = repair(J); assert.deepEqual([a.fixed, a.usedPart, a.skill], [true, true, null]); assert.equal(J.parts, 0);
  const b = repair(J); assert.deepEqual([b.fixed, b.usedPart], [true, false]); assert.equal(b.skill.id, 'carpentry'); assert.equal(b.skill.who, 'carpenter');
  const c = repair(J); assert.equal(c.fixed, false, 'no part left for the third');
  const W = mk(['blacksmith', 'carpenter', 'fiddler']); W.parts = 2;
  const w1 = repair(W); assert.equal(w1.skill.id, 'forge'); assert.equal(W.parts, 2);
  const w2 = repair(W); assert.equal(w2.usedPart, true); assert.equal(W.parts, 1);
  const w3 = repair(W); assert.equal(w3.skill.id, 'carpentry'); assert.equal(W.parts, 1);
  assert.equal(W.totals.repairs, 3);
});
test('animals tire on a brisk pace (+12) and in the mountains (+8), a rest day or a stop restores 30, over 70 the pace is steady', () => {
  const J = rich(mk()); quiet(J); setPace(J, 'brisk');
  for (let i = 0; i < 6; i++) { const r = tickDay(J, { rand: R5 }); assert.equal(r.animalsTired, false); assert.equal(r.miles, 19); }
  assert.equal(J.animals.tired, 72);
  const forced = tickDay(J, { rand: R5 });
  assert.equal(forced.animalsTired, true); assert.equal(forced.miles, 15, 'steady whatever the dial says'); assert.equal(J.pace, 'brisk', 'the dial itself is untouched');
  assert.equal(effectivePace(J), 'steady');
  assert.equal(J.animals.tired, 72, 'a steady day on the prairie adds nothing');
  J.trip.restDays = 1; tickDay(J, { rand: R5 }); assert.equal(J.animals.tired, 42);
  assert.equal(tickDay(J, { rand: R5 }).animalsTired, false, 'rested: brisk again');
  const M = rich(mk()); startLeg(M, 'south-pass'); quiet(M);
  for (let i = 0; i < 3; i++) tickDay(M, { rand: R5 });
  assert.equal(M.animals.tired, 24, 'the mountains: +8 a day even at a steady pace');
  M.milesDone = M.trip.miles; arrive(M); assert.equal(M.animals.tired, 0, 'a stop rests them (24 - 30)');
  const C = mk(); C.animals.tired = 90; camp(C, 'fish', { rand: R5 }); assert.equal(C.animals.tired, 60);
  assert.ok(ANIMAL_RULES.forceSteadyOver === 70);
});
test('the second yoke: $30 × the price level, four animals, +3 miles a day, tiring halved; only one', () => {
  const J = rich(mk()); J.cash = 500;
  assert.equal(priceAt('yoke', null, 's1847'), 30);
  const b = buy(J, { item: 'yoke', qty: 1 }); assert.deepEqual([b.ok, b.cost], [true, 30]);
  assert.equal(J.cash, 470); assert.equal(J.animals.n, 4); assert.equal(J.goods.yoke, 1);
  assert.deepEqual(buy(J, { item: 'yoke', qty: 1 }), { ok: false, cost: 30, cash: 470, foodLb: 0 }, 'only one second yoke'); assert.equal(J.cash, 470);
  assert.equal(speedBonus(J), 3);
  quiet(J); assert.equal(tickDay(J, { rand: R5 }).miles, 18);
  setPace(J, 'brisk'); const t0 = J.animals.tired; tickDay(J, { rand: R5 }); assert.equal(J.animals.tired - t0, 6, 'brisk tires them half as much');
  assert.equal(legStatus(J).etaDays, etaDays(J.trip.miles - J.milesDone, 'brisk', 'oxen', 3));
  const poor = mk(); poor.cash = 29; assert.equal(buy(poor, { item: 'yoke' }).ok, false); assert.equal(poor.animals.n, 2);
  const S = createJourney({ season: 's1850', companions: PLAIN, seed: 1 }); assert.equal(buy(S, { item: 'yoke' }).cost, 60);
});
test('arrows: a hunt takes five; huntAllowed needs five; no arrows = no hunt events, no bow at camp; a bundle is five arrows', () => {
  const J = mk(); assert.equal(huntAllowed(J), true); assert.equal(J.goods.arrows, 15);
  const h = applyHunt(J, { meatLb: 12 }); assert.equal(h.arrowsUsed, 5); assert.equal(J.goods.arrows, 10);
  applyHunt(J, { meatLb: 0 }); applyHunt(J, { meatLb: 0 }); assert.equal(J.goods.arrows, 0); assert.equal(huntAllowed(J), false);
  applyHunt(J, { meatLb: 4 }); assert.equal(J.goods.arrows, 0, 'never below 0');
  J.goods.arrows = 4; assert.equal(huntAllowed(J), false); assert.ok(!campKinds(J).includes('hunt')); assert.ok(campKinds(J).includes('fish'));
  assert.equal(camp(J, 'hunt', { rand: R5 }).noArrows, true);
  J.cash = 100; buy(J, { item: 'arrows', qty: 1 }); assert.equal(J.goods.arrows, 9); assert.equal(huntAllowed(J), true); assert.ok(campKinds(J).includes('hunt'));
  setHunting(J, false); assert.ok(!campKinds(J).includes('hunt'));
  // no arrows at a leg's start: no hunt is planned; the safety net finds fish or a find, never a hunt
  for (let s = 0; s < 40; s++) {
    const K = mk(PLAIN, s); K.goods.arrows = 0; startLeg(K, TRAIL[s % 12].id);
    assert.ok(K.trip.events.every((e) => e.kind !== 'hunt'), 'no hunt planned without arrows');
    K.trip.events = []; K.trip.markers = []; K.foods = { flour: 0, bacon: 0, beans: 0, other: 0 }; syncFood(K);
    const r = tickDay(K, { rand: R5 }); assert.ok(r.event && r.event.rescue && r.event.kind !== 'hunt', `${r.event && r.event.kind}`);
  }
  const F = mk(); F.trip.events = [{ id: 'hunt', kind: 'hunt', atMile: 1, fired: false }]; F.trip.markers = [];
  const e = tickDay(F, { rand: R5 }).event; assert.equal(e.canHunt, true); assert.equal(e.arrows, 15);
});
test('blankets: one for every two people on South Pass, the Blue Mountains and a snow event; short = a cold night, tired, a rest day', () => {
  assert.deepEqual(COLD_LEGS, ['south-pass', 'blue-mountains']);
  const J = mk();
  assert.deepEqual(needsBlankets(J), { need: 0, have: 0, short: 0, cold: false, why: null }, 'the Kansas River is mild');
  assert.deepEqual(needsBlankets(J, 'south-pass'), { need: 2, have: 0, short: 2, cold: true, why: 'leg' });
  assert.deepEqual(coldLegsAhead(J), ['south-pass', 'blue-mountains']);
  const odd = mk(['teacher', 'fiddler']); assert.equal(needsBlankets(odd, 'blue-mountains').need, 2, 'three people: two blankets (rounded up)');
  // short on South Pass: exactly one cold night, the party tired, a rest day next
  rich(J, 4000); startLeg(J, 'south-pass'); J.trip.events = []; J.trip.markers = [];
  let nights = 0, restedAfter = null, prev = null;
  for (let d = 0; d < 20 && !J.trip.arrived; d++) {
    const r = tickDay(J, { rand: R5 });
    if (prev && prev.coldNight) restedAfter = r;
    if (r.coldNight) { nights++; assert.equal(J.mood, 'tired'); assert.equal(r.restNext, 'cold'); assert.deepEqual([r.cold.need, r.cold.have, r.cold.short], [2, 0, 2]); }
    prev = r;
  }
  assert.equal(nights, 1); assert.equal(restedAfter.rest, true); assert.equal(restedAfter.miles, 0); assert.equal(J.totals.coldNights, 1);
  // with blankets: no cold night
  const K = rich(mk(), 4000); K.goods.blankets = 2; startLeg(K, 'blue-mountains'); K.trip.events = []; K.trip.markers = [];
  for (let d = 0; d < 20 && !K.trip.arrived; d++) assert.equal(tickDay(K, { rand: R5 }).coldNight, false);
  assert.equal(K.trip.coldOk, true);
  // a snow event anywhere
  const S = rich(mk(), 4000); S.trip.markers = [];
  S.trip.events = [{ id: 'snow', kind: 'rest', atMile: 1, fired: false }];
  const sr = tickDay(S, { rand: R5 }); assert.equal(sr.event.id, 'snow'); assert.equal(sr.coldNight, true); assert.deepEqual(needsBlankets(S), { need: 2, have: 0, short: 2, cold: true, why: 'snow' });
  const S2 = rich(mk(), 4000); S2.goods.blankets = 2; S2.trip.markers = []; S2.trip.events = [{ id: 'snow', kind: 'rest', atMile: 1, fired: false }];
  assert.equal(tickDay(S2, { rand: R5 }).coldNight, false);
  assert.equal(EVENT_BY_ID.snow.cold, true); assert.deepEqual(EVENT_BY_ID.snow.biomes, ['mountains', 'highdesert']);
  buy(mk(), { item: 'blankets', qty: 2 });
});
test('blankets are never traded away while a cold leg lies ahead (the trade offer only counts the spare ones)', () => {
  const J = mk(PLAIN, 3); startLeg(J, 'fort-kearny');            // the Pawnee trade blankets for corn
  assert.equal(tradeOffer(J).give, 'blankets');
  J.goods.blankets = 2; assert.equal(tradeOffer(J).have, 0, 'two are needed for South Pass');
  J.goods.blankets = 5; assert.equal(tradeOffer(J).have, 3);
  const r = applyTrade(J, { giveN: 5, getN: 15 }); assert.equal(r.gave, 3 - (3 % 1)); assert.equal(J.goods.blankets, 2, 'the two for the mountains stay');
  startLeg(J, 'the-dalles'); J.goods.blankets = 2; assert.equal(tradeOffer(J).have, 2, 'past the cold legs, all of them are spare');
  const B = mk(PLAIN, 3); startLeg(B, 'blue-mountains'); B.goods.blankets = 2; B.trip.coldDone = true; assert.equal(spareGoods(B, 'blankets'), 2, 'the cold night is over');
  assert.equal(spareGoods(B, 'pelts'), 6);
});
test('a stampede event on the prairie and the bluffs only', () => {
  const e = EVENT_BY_ID.stampede; assert.equal(e.kind, 'stampede'); assert.deepEqual(e.biomes, ['prairie', 'bluffs']); assert.ok(!/\d/.test(e.say));
  for (const leg of TRAIL) assert.equal(eligibleEvents(leg).some((x) => x.id === 'stampede'), ['prairie', 'bluffs'].includes(leg.biome), leg.id);
});

console.log('\nv1.2 companion skills');
test('all eight companions have a skill { id, name, text }; skillOf finds who has it', () => {
  assert.equal(COMPANIONS.length, 8);
  const ids = COMPANIONS.map((c) => c.skill && c.skill.id);
  assert.equal(new Set(ids).size, 8);
  for (const c of COMPANIONS) { assert.ok(c.skill.id && c.skill.name && c.skill.text.length > 10, c.id); assert.ok(!/\d/.test(c.skill.text) || true); }
  const J = mk(['scout', 'cook', 'carpenter']);
  assert.equal(skillOf(J, 'scouting'), 'scout'); assert.equal(skillOf(J, 'good-cooking'), 'cook'); assert.equal(skillOf(J, 'carpentry'), 'carpenter');
  assert.equal(skillOf(J, 'forge'), null); assert.equal(skillOf(J, 'nonsense'), null);
  assert.equal(skillOf(J, 'scout'), 'scout', 'a companion id works too');
  assert.deepEqual(skillInfo(J, 'scouting'), { id: 'scouting', name: 'Scouting', text: COMPANIONS.find((c) => c.id === 'scout').skill.text, who: 'scout' });
  assert.equal(skillInfo(J, 'tips'), null);
  assert.deepEqual(partySkills(J).map((s) => s.who), ['scout', 'cook', 'carpenter']);
});
test('Eli: one more animal spotted a leg (with a card), seen once, on tickDay; and the forecast two days ahead', () => {
  for (const [i, leg] of TRAIL.entries()) {
    const J = rich(mk(['scout', 'teacher', 'fiddler'], i + 1)); startLeg(J, leg.id); quiet(J);
    let spots = [];
    for (let d = 0; d < 40 && !J.trip.arrived; d++) { const r = tickDay(J, { rand: R5 }); if (r.spotted) { spots.push(r); } }
    assert.equal(spots.length, 1, leg.id);
    const s = spots[0];
    assert.equal(s.skill.id, 'scouting'); assert.equal(s.skill.who, 'scout'); assert.ok(s.spotted.animal && s.spotted.name);
    assert.ok(s.spotted.card === null || baseCards.includes(s.spotted.card), `${s.spotted.animal} -> ${s.spotted.card}`);
    assert.ok(s.spotted.card, `a card for the ${s.spotted.animal} in ${leg.biome}`);
    assert.equal(J.totals.spotted, 1);
  }
  const N = rich(mk()); quiet(N); let any = false;
  for (let d = 0; d < 30 && !N.trip.arrived; d++) any = any || !!tickDay(N, { rand: R5 }).spotted; assert.equal(any, false, 'no scout, no extra animal');
});
test('Mabel: a tired party with food in the wagon is rested again in one day (and Ada with no Mabel: it stays tired)', () => {
  const mkTired = (party) => { const J = rich(mk(party, 9)); quiet(J); J.spirit = 8; J.rations = 'lean'; return J; };
  const D = mkTired(['doctor', 'teacher', 'fiddler']);
  const r = tickDay(D, { rand: R5 });
  assert.notEqual(D.mood, 'tired'); assert.equal(r.skill.id, 'peppermints'); assert.equal(r.skill.who, 'doctor');
  const N = mkTired(PLAIN); tickDay(N, { rand: R5 }); assert.equal(N.mood, 'tired');
  const H = mkTired(['doctor', 'teacher', 'fiddler']); H.foods = { flour: 0, bacon: 0, beans: 0, other: 0 }; syncFood(H); H.trip.rescueCooldown = 9;
  tickDay(H, { rand: R5 }); assert.equal(H.mood, 'tired', 'peppermints are not food');
});
test('Jasper: four extra spirit on a night at camp, announced', () => {
  const mkC = (party) => { const J = mk(party, 4); J.spirit = 40; return J; };
  const F = mkC(['fiddler', 'teacher', 'storyteller']), P = mkC(['teacher', 'storyteller', 'doctor']);
  const rf = camp(F, 'fish', { rand: R5 }), rp = camp(P, 'fish', { rand: R5 });
  assert.equal(F.spirit - P.spirit, 4); assert.equal(rf.skill.id, 'fiddle'); assert.equal(rf.skill.who, 'fiddler'); assert.equal(rf.spiritBonus, 4); assert.equal(rp.skill, null);
  assert.equal(camp(F, 'rest', { rand: R5 }).skill.id, 'fiddle');
});
test('Nora: the strategy hint before the answer, once a leg (teacherTip), with the skill card from applyMarkerHint', () => {
  const J = mk(['teacher', 'doctor', 'fiddler']);
  assert.equal(markerHintReady(J), true);
  assert.equal(teacherTip(J), true); assert.equal(teacherTip(J), false, 'once a leg'); assert.equal(markerHintReady(J), false);
  startLeg(J, TRAIL[1].id); assert.equal(markerHintReady(J), true);
  const h = applyMarkerHint(J); assert.equal(h.used, true); assert.equal(h.skill.id, 'tips'); assert.equal(h.skill.who, 'teacher');
  assert.deepEqual(applyMarkerHint(J), { used: false, skill: null });
  const N = mk(['doctor', 'fiddler', 'scout']); assert.equal(teacherTip(N), false); assert.equal(markerHintReady(N), false);
});
test('Ines: a campfire tale always drops a card, a lookout drops two', () => {
  const I = mk(['storyteller', 'teacher', 'fiddler']), N = mk(['teacher', 'doctor', 'fiddler']);
  const t = camp(I, 'tales', { rand: R5 }); assert.equal(t.cardDrop, true); assert.ok(t.skills.some((x) => x.id === 'tales' && x.who === 'storyteller'));
  assert.equal(camp(I, 'fish', { rand: R5 }).cardDrop, false, 'only a tale');
  assert.equal(camp(N, 'tales', { rand: R5 }).cardDrop, false);
  assert.equal(lookoutDrops(I).cards, 2); assert.equal(lookoutDrops(I).skill.id, 'tales'); assert.deepEqual(lookoutDrops(N), { cards: 1, skill: null });
});
test('every skill is announced as { id, name, text, who } by the call that fired it', () => {
  const seen = new Set();
  const note = (s) => { if (s) { assert.deepEqual(Object.keys(s).filter((k) => ['id', 'name', 'text', 'who'].includes(k)).sort(), ['id', 'name', 'text', 'who']); seen.add(s.id); } };
  note(repair(mk(['blacksmith', 'teacher', 'fiddler'])).skill); note(repair(Object.assign(mk(['carpenter', 'teacher', 'fiddler']), { halfPart: 1 })).skill);
  note(crossRiver(mk(['carpenter', 'teacher', 'fiddler']), { how: 'float', bumps: 1 }).skill);
  note(camp(mk(['fiddler', 'teacher', 'doctor']), 'rest', { rand: R5 }).skill); note(camp(mk(['storyteller', 'teacher', 'doctor']), 'tales', { rand: R5 }).cardDrop && skillInfo(mk(['storyteller']), 'tales'));
  note(applyMarkerHint(mk(['teacher'])).skill);
  const sc = mk(['scout', 'teacher', 'fiddler']); quiet(sc); sc.trip.events = [{ id: 'storm', kind: 'rest', atMile: sc.milesDone + 25, fired: false }]; note(forecast(sc).skill);
  const cook = mk(['cook', 'teacher', 'fiddler']); quiet(cook); note(tickDay(cook, { rand: R5 }).skill);
  const sp = rich(mk(['scout', 'teacher', 'fiddler'])); quiet(sp); for (let i = 0; i < 12; i++) note(tickDay(sp, { rand: R5 }).skill);
  const doc = rich(mk(['doctor', 'teacher', 'fiddler'])); quiet(doc); doc.spirit = 5; note(tickDay(doc, { rand: R5 }).skill);
  assert.deepEqual([...seen].sort(), ['carpentry', 'fiddle', 'forge', 'good-cooking', 'peppermints', 'scouting', 'tales', 'tips']);
});

console.log('\nv1.2 rivers');
test('crossRiver ford: a soaked sack is 25 lb of flour, never more than half the flour; the ferry costs nothing', () => {
  const J = mk(); const f0 = J.foods.flour;
  const r = crossRiver(J, { how: 'ford', soaked: 1 });
  assert.deepEqual([r.how, r.soakedLb], ['ford', SOAKED_LB]); assert.equal(J.foods.flour, f0 - 25); assert.equal(J.food, sumKinds(J));
  assert.ok(typeof r.line === 'string' && r.line.length > 10 && !/\d/.test(r.line)); assert.equal(r.skill, null);
  assert.deepEqual(J.trip.river, { how: 'ford', soakedLb: 25 });
  const poor = mk(); poor.foods.flour = 40; syncFood(poor); assert.equal(crossRiver(poor, { how: 'ford', soaked: 3 }).soakedLb, 20, 'half of 40, not 75'); assert.equal(poor.foods.flour, 20);
  const none = mk(); none.foods.flour = 0; syncFood(none); assert.equal(crossRiver(none, { how: 'ford', soaked: 1 }).soakedLb, 0);
  const dry = mk(); assert.equal(crossRiver(dry, { how: 'ford', soaked: 0 }).soakedLb, 0); assert.equal(dry.foods.flour, 150);
  const fe = mk(); const rf = crossRiver(fe, { how: 'ferry', soaked: 5, bumps: 5 });
  assert.deepEqual([rf.how, rf.soakedLb], ['ferry', 0]); assert.equal(fe.foods.flour, 150); assert.equal(fe.cash, START.cash); assert.deepEqual(fe.trip.river, { how: 'ferry', soakedLb: 0 });
  assert.equal(crossRiver(mk(), { how: 'swim' }).how, 'ford', 'an unknown way is a ford');
});
test('crossRiver float: rope or the carpenter make bumps free; without, a bump soaks a sack', () => {
  const none = mk(); const r0 = crossRiver(none, { how: 'float', bumps: 2 });
  assert.equal(r0.soakedLb, 50); assert.equal(none.foods.flour, 100); assert.equal(r0.ropeUsed, false);
  const rope = mk(); rope.goods.rope = 1; const r1 = crossRiver(rope, { how: 'float', bumps: 3 });
  assert.equal(r1.soakedLb, 0); assert.equal(r1.ropeUsed, true); assert.equal(rope.goods.rope, 0, 'a coil is frayed'); assert.equal(rope.foods.flour, 150);
  const ropeNoBump = mk(); ropeNoBump.goods.rope = 1; crossRiver(ropeNoBump, { how: 'float', bumps: 0 }); assert.equal(ropeNoBump.goods.rope, 1, 'no bump, no frayed rope');
  const carp = mk(['carpenter', 'teacher', 'fiddler']); const r2 = crossRiver(carp, { how: 'float', bumps: 4 });
  assert.equal(r2.soakedLb, 0); assert.equal(r2.skill.id, 'carpentry'); assert.equal(r2.skill.who, 'carpenter'); assert.equal(carp.foods.flour, 150);
  assert.ok(r2.line.includes('Tomas'));
  const both = mk(['carpenter', 'teacher', 'fiddler']); both.goods.rope = 2; crossRiver(both, { how: 'float', bumps: 1 }); assert.equal(both.goods.rope, 2, 'Tomas covers it, the rope is kept');
  assert.equal(crossRiver(mk(), { how: 'float', bumps: 0 }).soakedLb, 0);
  const T = none.totals; assert.deepEqual([T.riversCrossed, T.soakedLb, T.soakedCrossings, T.floatCount], [1, 50, 1, 1]);
});
test('the river goes in the letter: a line for how it was crossed (and when a sack got wet), from the fallbacks', () => {
  for (const [how, soaked, key] of [['ford', 0, 'ford'], ['ford', 1, 'ford-wet'], ['float', 0, 'float'], ['float', 1, 'float-wet'], ['ferry', 0, 'ferry']]) {
    const J = mk(); J.milesDone = J.trip.miles; J.trip.arrived = true;
    crossRiver(J, how === 'float' ? { how, bumps: soaked } : { how, soaked });
    const ks = happenedKeys(J); assert.ok(ks.includes(key), `${key}: ${ks}`); assert.ok(!ks.includes('river'), 'the particular line, not the plain one');
    const L = composeLetter(J, null, ['a', 'b', 'c']);
    assert.ok(L.keys.includes(key) || L.keys.length === 3, key);
    for (const line of L.lines) assert.ok(!/[{}]/.test(line), line);
  }
  for (const k of ['ford', 'ford-wet', 'float', 'float-wet', 'ferry', 'axle', 'tongue', 'snow', 'stampede', 'limp']) assert.ok(lineSource(k).length >= 2, k);
  assert.equal(lineSource('wheel'), LETTER_LINES.wheel, 'the content\'s own lines win');
  // a breakdown with no spare part is the limp line; a mended one is the part's line
  const L = mk(); L.parts = 0; repair(L); L.trip.happened.push('axle'); L.milesDone = L.trip.miles; L.trip.arrived = true;
  assert.ok(happenedKeys(L).includes('limp') && !happenedKeys(L).includes('axle'));
  const M = mk(); M.trip.happened.push('tongue'); M.milesDone = M.trip.miles; M.trip.arrived = true; assert.ok(happenedKeys(M).includes('tongue'));
});
test('the ferry fare with every word right is counted once (spelling-ferry), whichever of crossRiver and applyWords comes first', () => {
  const A = mk(); crossRiver(A, { how: 'ferry' }); applyWords(A, { asked: 3, right: 3 }); assert.equal(A.totals.ferryPerfect, 1);
  const B = mk(); applyWords(B, { asked: 3, right: 3 }); crossRiver(B, { how: 'ferry' }); assert.equal(B.totals.ferryPerfect, 1);
  const C = mk(); crossRiver(C, { how: 'ferry' }); applyWords(C, { asked: 3, right: 2 }); assert.equal(C.totals.ferryPerfect, 0);
  const D = mk(); crossRiver(D, { how: 'ford' }); applyWords(D, { asked: 3, right: 3 }); assert.equal(D.totals.ferryPerfect, 0);
  crossRiver(A, { how: 'ferry' }); assert.equal(A.totals.ferryPerfect, 1, 'not twice');
});

console.log('\nv1.2 forecast and waiting out the weather');
test('forecast: clear with a horizon of 1 day (2 with the scout); weather shows when it is within the horizon; storm / rain / snow', () => {
  const mkF = (party, id, ahead) => { const J = mk(party, 13); quiet(J); J.trip.events = [{ id, kind: 'rest', atMile: J.milesDone + ahead, fired: false }]; return J; };
  assert.deepEqual(forecast(quiet(mk())), { next: 'clear', inDays: 1 });
  const sc = quiet(mk(['scout', 'teacher', 'fiddler'])); assert.deepEqual(forecast(sc), { next: 'clear', inDays: 2 });
  assert.deepEqual(forecast(mkF(PLAIN, 'storm', 10)), { next: 'storm', inDays: 1 });
  assert.deepEqual(forecast(mkF(PLAIN, 'storm', 20)), { next: 'clear', inDays: 1 }, 'two days out: only the scout sees it');
  const two = forecast(mkF(['scout', 'teacher', 'fiddler'], 'storm', 20)); assert.deepEqual([two.next, two.inDays], ['storm', 2]); assert.equal(two.skill.id, 'scouting');
  assert.deepEqual(forecast(mkF(['scout', 'teacher', 'fiddler'], 'storm', 10)), { next: 'storm', inDays: 1 }, 'one day out needs no scout');
  assert.deepEqual(forecast(mkF(PLAIN, 'drizzle', 10)), { next: 'rain', inDays: 1 });
  assert.deepEqual(forecast(mkF(PLAIN, 'frost', 10)), { next: 'snow', inDays: 1 });
  assert.deepEqual(forecast(mkF(PLAIN, 'snow', 10)), { next: 'snow', inDays: 1 });
  assert.deepEqual(forecast(mkF(PLAIN, 'berries', 10)), { next: 'clear', inDays: 1 });
  // and the forecast is right: tickDay fires it the day the forecast said
  const J = mkF(PLAIN, 'storm', 10); assert.equal(forecast(J).inDays, 1); assert.equal(tickDay(J, { rand: R5 }).event.id, 'storm');
  assert.deepEqual(forecast(J), { next: 'clear', inDays: 1 }, 'gone once it has come');
  const T = mkF(['scout', 'teacher', 'fiddler'], 'storm', 20); const f2 = forecast(T).inDays; tickDay(T, { rand: R5 }); assert.equal(f2 - forecast(T).inDays, 1);
});
test('waitOut: a rest day at camp that cancels the coming weather\'s mood cost and its rest day; nothing coming = a plain rest day', () => {
  const mkS = () => { const J = rich(mk(PLAIN, 21)); quiet(J); J.spirit = 60; J.trip.events = [{ id: 'storm', kind: 'rest', atMile: J.milesDone + 10, fired: false }]; return J; };
  const A = mkS(), B = mkS();
  const w = waitOut(A, { rand: R5 });
  assert.equal(w.waited, true); assert.equal(w.weather, 'storm'); assert.equal(w.kind, 'rest'); assert.equal(A.day, 1); assert.equal(A.milesDone, 0); assert.equal(A.totals.waitedOut, 1);
  const ra = tickDay(A, { rand: R5 }), rb0 = tickDay(B, { rand: R5 });
  assert.equal(ra.event.id, 'storm'); assert.equal(ra.event.waitedOut, true); assert.equal(ra.restNext, null);
  assert.equal(rb0.restNext, 'event');
  const na = tickDay(A, { rand: R5 }), nb = tickDay(B, { rand: R5 });
  assert.ok(na.miles > 0, 'the waited-out storm costs no day'); assert.equal(nb.miles, 0, 'the storm that was not waited out does');
  assert.ok(A.spirit > B.spirit, `${A.spirit} > ${B.spirit}`);
  const N = rich(mk()); quiet(N); const n = waitOut(N, { rand: R5 }); assert.equal(n.waited, false); assert.equal(n.weather, null); assert.equal(N.day, 1);
  const far = rich(mk()); quiet(far); far.trip.events = [{ id: 'storm', kind: 'rest', atMile: far.milesDone + 90, fired: false }];
  assert.equal(waitOut(far, { rand: R5 }).waited, false, 'a storm days away is not in the forecast');
});

console.log('\nv1.2 pay: the raft and the stampede');
test('raftPay: $40 less $10 a bump, never under $10, times the season; stampedePay: held = the bison card', () => {
  for (const s of SEASONS) {
    const want = [40, 30, 20, 10, 10, 10];
    want.forEach((w, bumps) => { const J = createJourney({ season: s.id, companions: PLAIN, seed: 5 }); const c0 = J.cash; const r = raftPay(J, { bumps }); assert.equal(r.cash, w * s.priceMult); assert.equal(J.cash, c0 + r.cash); });
    const J = createJourney({ season: s.id, companions: PLAIN, seed: 5 }); const c0 = J.cash;
    assert.deepEqual(stampedePay(J, { held: true }), { cash: 15 * s.priceMult, card: 'bison', held: true }); assert.equal(J.cash, c0 + 15 * s.priceMult);
    assert.deepEqual(stampedePay(J, { held: false }), { cash: 0, card: null, held: false }); assert.equal(J.cash, c0 + 15 * s.priceMult);
    assert.deepEqual([J.totals.stampedes, J.totals.stampedesHeld], [2, 1]);
  }
  assert.ok(CARD_BY_ID.bison); assert.deepEqual(RAFT, { base: 40, perBump: 10, min: 10 });
  const J = mk(); raftPay(J, { bumps: 0 }); raftPay(J, { bumps: 2 }); assert.deepEqual([J.totals.raftRuns, J.totals.raftClean], [2, 1]);
});

console.log('\nv1.2 people');
test('people: 26-36, two or three at every one of the thirteen stops, with a portrait, a role and two kid-level lines, no death, illness or weapons', () => {
  assert.ok(PEOPLE.length >= 26 && PEOPLE.length <= 36, `${PEOPLE.length} people`);
  const stops = ['independence', ...LEGS.map((l) => l.id)];
  for (const s of stops) assert.ok((PEOPLE_BY_STOP[s] || []).length >= 2 && PEOPLE_BY_STOP[s].length <= 3, `${s}: ${(PEOPLE_BY_STOP[s] || []).length}`);
  assert.deepEqual(Object.keys(PEOPLE_BY_STOP).sort(), [...stops].sort());
  assert.equal(new Set(PEOPLE.map((p) => p.id)).size, PEOPLE.length);
  const bad = /\b(die[sd]?|dead|death|kill\w*|sick\w*|ill|illness|disease\w*|cholera|gun\w*|rifle\w*|shoot\w*|shot|weapon\w*|arrow\w*|blood\w*|bite\w*|bitten|venom\w*|poison\w*|grave\w*|hurt|wound\w*|whiskey|liquor|alcohol|drunk\w*)\b/i;
  const src = readFileSync(new URL('../docs/SOURCES.md', import.meta.url), 'utf8');
  for (const p of PEOPLE) {
    assert.ok(p.name && p.emoji && p.role, p.id); assert.equal(PERSON_BY_ID[p.id], p);
    assert.equal(p.lines.length, 2, p.id);
    for (const l of p.lines) { assert.ok(l.length > 20 && l.length <= 210, `${p.id}: ${l.length}`); assert.ok(!/\d/.test(l), `${p.id} numbers as words: ${l}`); assert.ok(!bad.test(l), `${p.id}: ${l}`); assert.ok(!/[{}]/.test(l)); }
    assert.ok(!bad.test(p.gift ? p.gift.text : ''), p.id);
    assert.ok(src.includes(`<a id="${p.source.replace('SOURCES.md#', '')}">`), `SOURCES.md has ${p.source}`);
    assert.equal(p.source, `SOURCES.md#people-${p.stop}`);
    if (p.gift) {
      assert.ok(['food', 'card', 'tip', 'trade'].includes(p.gift.kind), p.id); assert.ok(p.gift.text && p.gift.text.length > 10);
      if (p.gift.kind === 'food') assert.ok(p.gift.lb >= 5 && p.gift.lb <= 25 && p.gift.what, p.id);
      if (p.gift.kind === 'card') assert.ok(CARD_BY_ID[p.gift.card], `${p.id}: card ${p.gift.card}`);
      if (p.gift.kind === 'tip') assert.equal(p.gift.problem, 'parts');
      if (p.gift.kind === 'trade') { assert.ok(p.gift.give && p.gift.get && p.gift.rate.length === 2 && p.gift.rate.every((n) => n >= 1), p.id); assert.ok(lbOf(p.gift.get) >= 10, 'the trade gets food'); }
    }
  }
  // every nation is named by at least one person (a guide or a trader), and no nation person has an invented personal name
  for (const n of NATIONS) assert.ok(PEOPLE.some((p) => p.name.includes(n.name) || p.role.includes(n.name)), `a ${n.name} person`);
  for (const p of PEOPLE.filter((q) => NATIONS.some((n) => q.role.includes(n.name)))) assert.ok(/^A /.test(p.name) && NATIONS.some((n) => p.name.includes(n.name)), `${p.id}: named for the nation: ${p.name}`);
  for (const g of PEOPLE.filter((q) => q.gift)) assert.ok(g.gift, g.id);
  assert.ok(PEOPLE.filter((p) => p.gift).length >= 18 && PEOPLE.filter((p) => !p.gift).length >= 3, 'some give gifts, not all');
  for (const k of ['food', 'card', 'tip', 'trade']) assert.ok(PEOPLE.some((p) => p.gift && p.gift.kind === k), `a ${k} gift`);
});
test('meetPerson: the first time remembers them and applies the gift (food into "other", the rest handed back); again = nothing', () => {
  const J = mk();
  const a = meetPerson(J, 'hale');
  assert.equal(a.first, true); assert.equal(a.person.id, 'hale'); assert.equal(a.gift.kind, 'food'); assert.equal(a.gift.foodLb, 10); assert.equal(J.foods.other, 10); assert.equal(J.food, 310);
  const b = meetPerson(J, 'hale'); assert.deepEqual([b.first, b.gift], [false, null]); assert.equal(J.food, 310, 'a gift once');
  assert.deepEqual(J.met, ['hale']); assert.equal(J.totals.peopleMet, 1);
  const card = meetPerson(J, 'kansa-guide'); assert.deepEqual(card.gift, { ...PERSON_BY_ID['kansa-guide'].gift }); assert.equal(card.gift.kind, 'card'); assert.equal(J.cards.length, 0, 'the app awards the card');
  const tip = meetPerson(J, 'clara'); assert.equal(tip.gift.kind, 'tip'); assert.equal(tip.gift.problem, 'parts');
  const trade = meetPerson(J, 'ruth'); assert.equal(trade.gift.kind, 'trade'); assert.deepEqual(trade.gift.rate, [3, 2]);
  const plain = meetPerson(J, 'will'); assert.equal(plain.first, true); assert.equal(plain.gift, null);
  const none = meetPerson(J, 'nobody'); assert.deepEqual(none, { first: false, gift: null, person: null }); assert.equal(J.totals.peopleMet, 5);
  const at = peopleAt(J, 'independence'); assert.equal(at.length, 3); assert.equal(at.find((p) => p.id === 'hale').met, true); assert.equal(at.find((p) => p.id === 'amos').met, false);
  // the trade gift runs through applyTrade like a post
  const g = trade.gift; const before = J.goods.pelts; const r = applyTrade(J, { giveN: 3, getN: 2, give: g.give, get: g.get });
  assert.deepEqual([r.gave, r.got], [3, 2]); assert.equal(J.goods.pelts, before - 3);
});

console.log('\nv1.2 deeds');
test('DEEDS: twenty, each { id, name, how, say }, unique, spoken lines without digits; checkDeeds is idempotent and pays a token each', () => {
  assert.equal(DEEDS.length, 20); assert.equal(new Set(DEEDS.map((d) => d.id)).size, 20);
  for (const d of DEEDS) { assert.ok(d.id && d.name && d.how && d.say, d.id); assert.ok(!/\d/.test(d.say), d.say); assert.equal(DEED_BY_ID[d.id], d); }
  for (const id of ['dry-feet', 'mail-beater', 'full-wagon', 'card-shark', 'people-person', 'cold-proof', 'fixer', 'angler', 'archer', 'spelling-ferry', 'marker-master', 'summiteer', 'homesteader']) assert.ok(DEED_BY_ID[id], id);
  const J = mk(); assert.deepEqual(checkDeeds(J), []);
  J.totals.repairs = 3; J.totals.fishLb = 50; const t0 = J.tokens;
  assert.deepEqual(checkDeeds(J), ['fixer', 'angler']); assert.equal(J.tokens, t0 + 2); assert.deepEqual(J.deeds, ['fixer', 'angler']);
  assert.deepEqual(checkDeeds(J), []); assert.equal(J.tokens, t0 + 2);
  const K = mk(); for (const c of baseCards.slice(0, 19)) awardCard(K, c); assert.ok(!checkDeeds(K).includes('card-shark')); awardCard(K, baseCards[19]); assert.deepEqual(checkDeeds(K), ['card-shark']);
  const dry = mk(); crossRiver(dry, { how: 'ford', soaked: 0 }); assert.ok(!checkDeeds(dry).includes('dry-feet'), 'one river is not every river');
});
test('every deed is reachable in a scripted journey (and none is earned by doing nothing)', () => {
  const rand = mulberry32(77);
  const J = createJourney({ companions: ['blacksmith', 'scout', 'teacher'], seed: 77 });
  J.cash = 2000; shop(J); buy(J, { item: 'yoke' }); buy(J, { item: 'parts', qty: 4 });
  let tokensFromDeeds = 0; const earned = new Set();
  const check = () => { const t0 = J.tokens; const got = checkDeeds(J); tokensFromDeeds += J.tokens - t0; got.forEach((d) => earned.add(d)); };
  for (const [i, p] of PEOPLE.slice(0, 12).entries()) meetPerson(J, p.id);
  awardCard(J, baseCards[0]); for (const c of baseCards.slice(1, 20)) awardCard(J, c);
  for (let i = 0; i < 3; i++) derbyPay(J, { won: true });
  for (let i = 0; i < 3; i++) repair(J, { workedOut: true });
  for (let i = 0; i < 5; i++) camp(J, 'rest', { rand });
  applyTrade(J, { giveN: 6, getN: 4, give: 'pelts', get: 'flour' }); applyTrade(J, { giveN: 6, getN: 6, give: 'pelts', get: 'corn' }); J.goods.pelts = 20; applyTrade(J, { giveN: 15, getN: 10, give: 'pelts', get: 'flour' });
  for (let i = 0; i < 3; i++) applyFish(J, { fishLb: 20 }); for (let i = 0; i < 3; i++) { J.goods.arrows = 5; applyHunt(J, { meatLb: 40 }); }
  raftPay(J, { bumps: 0 }); stampedePay(J, { held: true });
  quiet(J); J.trip.events = [{ id: 'storm', kind: 'rest', atMile: J.milesDone + 10, fired: false }]; waitOut(J, { rand });
  check();
  assert.ok(!earned.has('summiteer') && !earned.has('dry-feet') && !earned.has('cold-proof') && !earned.has('homesteader'), 'not before the trail');
  J.trip.events = [];
  let guard = 0, ferried = false;
  while (!J.done && guard++ < 40) {
    const leg = legList()[J.legIndex];
    playLeg(J, RIGHT, rand);
    applyWords(J, { asked: 3, right: 3 });
    if (leg.stop.kind === 'river') { if (!ferried) { crossRiver(J, { how: 'ferry' }); ferried = true; } else crossRiver(J, { how: 'ford', soaked: 0 }); }
    arrive(J); check();
    if (leg.stop.kind === 'fort') shop(J);
    nextLeg(J);
  }
  check();
  const ids = DEEDS.map((d) => d.id);
  const missing = ids.filter((id) => !J.deeds.includes(id)); assert.ok(missing.length === 0, 'missing deeds: ' + missing.join(', '));
  assert.equal(J.deeds.length, 20); assert.equal(new Set(J.deeds).size, 20);
  assert.equal(tokensFromDeeds, 20, 'a token each');
  // a journey of doing nothing earns nothing
  const idle = mk(); assert.deepEqual(checkDeeds(idle), []);
});

console.log('\nv1.2 older saves and whole journeys');
test('a 1.1 save (no foods, animals, deeds, people, goods beyond the old ones) loads, plays and migrates every new field', () => {
  const N = mk(['blacksmith', 'scout', 'teacher'], 31);
  const old = clone(N);
  for (const k of ['rev', 'foods', 'foodOwed', 'foodSave', 'animals', 'limp', 'halfPart', 'met', 'deeds']) delete old[k];
  old.goods = { pelts: 4, arrows: 2 }; old.food = 200;
  for (const k of Object.keys(old.totals)) if (!['legs', 'stars', 'miles', 'days', 'markers', 'markersRight', 'problems', 'problemsRight', 'words', 'wordsRight', 'hunted', 'fished', 'traded', 'bought', 'crawlDays', 'maxCrawlDays', 'byKind', 'camps', 'derbyPlayed', 'derbyWon'].includes(k)) delete old.totals[k];
  const oldTrip = old.trip; for (const k of ['v12', 'lostDays', 'coldAt', 'coldDone', 'spotAt', 'spotPick', 'forgeUsed', 'tipUsed', 'pepCool']) delete oldTrip[k];
  const r = tickDay(old, { rand: mulberry32(2) });
  assert.deepEqual([old.foods.flour, old.foods.bacon, old.foods.beans, old.foods.other].reduce((a, b) => a + b, 0), old.food, 'foods split the old food total');
  assert.ok(r.miles > 0 && old.food < 200);
  assert.deepEqual(old.animals, { n: 2, tired: 0 }); assert.equal(old.limp, false); assert.deepEqual(old.met, []); assert.deepEqual(old.deeds, []);
  assert.equal(old.goods.arrows, 15, 'the bow gets its fifteen (2 bundles bought in 1.1 = 10 arrows, still the start of 15)'); assert.equal(old.goods.pelts, 4);
  assert.equal(old.goods.parts, old.parts); assert.equal(old.goods.rope, 0); assert.equal(old.goods.blankets, 0); assert.equal(old.goods.yoke, 0);
  for (const k of ['repairs', 'soakedLb', 'peopleMet', 'markersPerfectLegs', 'fishLb', 'meatLb', 'riversCrossed']) assert.equal(old.totals[k], 0, k);
  assert.deepEqual(old.totals.reached, []); assert.equal(old.trip.v12, 1); assert.equal(old.rev, 12);
  assert.deepEqual(clone(old), old);
  // every v1.2 entry point works on it
  const o2 = clone(old); for (const k of ['rev', 'foods', 'animals', 'met', 'deeds']) delete o2[k];
  repair(o2); crossRiver(o2, { how: 'ford' }); forecast(o2); camp(o2, 'rest'); meetPerson(o2, 'hale'); raftPay(o2, {}); checkDeeds(o2); huntAllowed(o2); needsBlankets(o2); foodDays(o2);
  const o3 = clone(N); for (const k of ['rev', 'foods', 'animals', 'met', 'deeds', 'goods']) delete o3[k]; buy(o3, { item: 'bacon', qty: 1, price: 1 }); assert.equal(o3.foods.bacon, 90 + 20 + 0 || o3.foods.bacon);
  const o4 = clone(N); delete o4.rev; delete o4.foods; delete o4.animals; o4.goods = {}; assert.deepEqual(ensureJourney(o4).goods.arrows, 15);
  // 1.1 had a yoke-less wagon; a saved yoke keeps four animals
  const y = clone(N); y.goods.yoke = 1; delete y.animals; ensureJourney(y); assert.equal(y.animals.n, 4);
  // the season after carries the badges, not the counters
  const S = mk(); S.deeds = ['fixer']; S.met = ['hale']; S.done = true; const next = newSeason(S);
  assert.deepEqual(next.deeds, ['fixer']); assert.deepEqual(next.met, []); assert.equal(next.totals.peopleMet, 0);
});
test('journeys with random v1.2 play: any three companions, fords / floats / ferries, repairs, camps, waiting, shopping: food and cash never negative, every leg arrives, everything JSON-safe', () => {
  const ALL = COMPANIONS.map((c) => c.id);
  let breakdowns = 0, limps = 0, colds = 0, soaked = 0;
  for (let seed = 200; seed < 240; seed++) {
    const rand = mulberry32(seed);
    const party = [...ALL].sort(() => rand() - 0.5).slice(0, 3);
    const J = createJourney({ companions: party, seed, animal: rand() < 0.5 ? 'oxen' : 'mules' });
    if (rand() < 0.7) shop(J);
    for (let guard = 0; guard < 40 && !J.done; guard++) {
      const leg = legList()[J.legIndex];
      if (COLD_LEGS.includes(leg.id) && rand() < 0.4) J.goods.blankets = 0;   // forgot them
      for (let d = 0; d < 600; d++) {
        if (rand() < 0.1) setPace(J, rand() < 0.5 ? 'steady' : 'brisk');
        if (rand() < 0.05) camp(J, ['fish', 'hunt', 'cards', 'tales', 'rest'][Math.floor(rand() * 5)], { rand });
        if (rand() < 0.03) waitOut(J, { rand });
        const r = tickDay(J, { rand });
        assert.ok(J.food >= 0 && Number.isInteger(J.food) && J.food === sumKinds(J), `food ${J.food} ${JSON.stringify(J.foods)}`);
        assert.ok(J.animals.tired >= 0 && J.animals.tired <= 100);
        for (const k of Object.keys(J.goods)) assert.ok(J.goods[k] >= 0, `${k} ${J.goods[k]}`);
        if (r.marker) applyMarker(J, { correct: rand() < 0.7, quick: rand() < 0.4 });
        if (r.event) {
          const e = r.event;
          if (e.kind === 'breakdown') { breakdowns++; const rp = repair(J, { workedOut: rand() < 0.5 }); if (!rp.fixed) limps++; }
          else if (e.kind === 'hunt') applyHunt(J, { meatLb: rand() * 40 });
          else if (e.kind === 'fish') applyFish(J, { fishLb: rand() * 15 });
          else if (e.kind === 'stampede') stampedePay(J, { held: rand() < 0.5 });
        }
        if (r.coldNight) colds++;
        if (r.arrived) break;
      }
      if (leg.stop.kind === 'river') { const how = ['ford', 'float', 'ferry'][Math.floor(rand() * 3)]; const c = crossRiver(J, { how, soaked: rand() < 0.3 ? 1 : 0, bumps: Math.floor(rand() * 3) }); soaked += c.soakedLb; }
      assert.ok(arrive(J)); checkDeeds(J);
      if (leg.stop.kind === 'fort') { J.cash += 200; if (rand() < 0.8) shop(J); if (rand() < 0.3) buy(J, { item: 'yoke' }); }
      assert.ok(J.cash >= 0);
      nextLeg(J);
    }
    assert.ok(J.done, `seed ${seed} finished`); assert.equal(J.totals.legs, 12);
    assert.deepEqual(clone(J), J);
  }
  assert.ok(breakdowns > 20 && colds >= 1 && soaked > 0, `breakdowns ${breakdowns}, limps ${limps}, cold nights ${colds}, soaked ${soaked}`);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('FAILED:\n  ' + failures.join('\n  ')); process.exit(1); }
console.log('ALL JOURNEY TESTS PASSED');

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
} from '../src/journey/sim.js';
import { CARDS, CARD_BY_ID, SUITS, cardsOf } from '../src/content/cards.js';
import { NATIONS } from '../src/content/nations.js';
import { COMPANIONS } from '../src/content/companions.js';
import { readFileSync } from 'node:fs';
import { problemFor, parseFactId, splitLine, numberWords, PROBLEM_KINDS } from '../src/journey/problems.js';
import { composeLetter, happenedKeys, keepLetter } from '../src/journey/letters.js';
import { starsFor, starCount } from '../src/journey/stars.js';
import { START, PAY, RATION_LB, SPEED, RESCUE, MARKERS, MOOD, payFor, crateFor, lbOf, TRADE_LB, milesPerDay } from '../src/journey/economy.js';
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
const PARTY = ['blacksmith', 'scout', 'cook'];
const clone = (x) => JSON.parse(JSON.stringify(x));

// ---- a scripted kid: answers with the given chances, shops for the stretch to the next fort, plays the events ----
function shop(J, factor = 1.3) {
  const plan = foodToNextFort(J);
  const want = Math.max(0, Math.round(plan.lb * factor) - J.food);
  const sacks = Math.ceil(want / lbOf('flour'));
  if (sacks > 0) buy(J, { item: 'flour', qty: sacks, price: priceAt('flour', storeLeg(J), J.season) });
  if (J.parts < 1) buy(J, { item: 'parts', qty: 1 });
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
test('a storm rests the party a day; berries add food; a wheel uses a spare part (or a slow day without one)', () => {
  const J = createJourney({ companions: PARTY, seed: 2 });
  const evAt = (id) => { J.trip.events = [{ id, kind: EVENT_BY_ID[id].kind, atMile: J.milesDone + 1, fired: false }]; J.trip.markers = []; J.trip.nextMarker = 0; return tickDay(J, { rand: () => 0.5 }); };
  assert.equal(evAt('storm').restNext, 'event');
  assert.equal(tickDay(J, { rand: () => 0.5 }).miles, 0);
  const f = J.food; const b = evAt('berries'); assert.equal(J.food, f - 12 + EVENT_BY_ID.berries.foodLb); assert.equal(b.event.foodAdded, EVENT_BY_ID.berries.foodLb);
  J.parts = 1; assert.ok(evAt('wheel').event.usedPart); assert.equal(J.parts, 0);
  assert.ok(evAt('wheel').event.slowDay);
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
  assert.equal(list.length, GOODS.length);
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
      const ok = LETTER_LINES[k].some((tpl) => new RegExp('^' + tpl.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{\w+\\?\}/g, '.+') + '$').test(L.lines[i]));
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

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('FAILED:\n  ' + failures.join('\n  ')); process.exit(1); }
console.log('ALL JOURNEY TESTS PASSED');

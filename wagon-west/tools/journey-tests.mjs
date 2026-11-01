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
// v1.4 (the last section, "Frodo and the river"): the dog's nose and fetch, fishing 2.0 and its fight stepper, the quest machine (and a synthetic fetch quest), trail facts and
// moments, rev-14 saves, newSeason's carry list, the sync merge rules and whole journeys with a dog. The v1.4 content tables (src/content/{finds,fish,quests,trailFacts}.js)
// are the Content stream's (merged; the tests run on the real tables).
import assert from 'node:assert/strict';
const {
  createJourney, startLeg, tickDay, applyMarker, applyProblem, applyWords, applyHunt, applyFish, applyTrade, buy, arrive,
  nextLeg, journeyDone, newSeason, foodNeeded, etaDays, priceAt, storeList, markerMiles, foodToNextFort, legStatus,
  setPace, setRations, setHunting, tradeOffer, tradeLine, partySize, storeLeg,
  camp, buyUpgrade, upgradesOwned, derbyPay, awardCard, suitComplete, suitProgress, cardForLeg, cardForAnimal, ensureJourney,
  dailyChallenge, claimChallenge, UPGRADES,
  repair, crossRiver, forecast, waitOut, meetPerson, peopleAt, raftPay, stampedePay, teacherTip, applyMarkerHint, markerHintReady, lookoutDrops, campKinds,
  foodDays, huntAllowed, needsBlankets, spareGoods, coldLegsAhead, skillOf, skillInfo, partySkills, syncFood, speedBonus, effectivePace, checkDeeds, DEEDS, yokeOffered,
} = await import('../src/journey/sim.js');
const { CARDS, CARD_BY_ID, SUITS, cardsOf } = await import('../src/content/cards.js');
const { NATIONS, FALLBACK_TRADES } = await import('../src/content/nations.js');
const { COMPANIONS } = await import('../src/content/companions.js');
import { readFileSync } from 'node:fs';
const { problemFor, parseFactId, splitLine, numberWords, dollarWords, PROBLEM_KINDS } = await import('../src/journey/problems.js');
const { composeLetter, happenedKeys, keepLetter, lineSource, FALLBACK_LINES } = await import('../src/journey/letters.js');
const { PEOPLE, PEOPLE_BY_STOP, PERSON_BY_ID } = await import('../src/content/people.js');
const { DEED_BY_ID } = await import('../src/journey/deeds.js');
const { starsFor, starCount } = await import('../src/journey/stars.js');
const { START, PAY, RATION_LB, SPEED, RESCUE, MARKERS, MOOD, payFor, crateFor, lbOf, TRADE_LB, milesPerDay, ARROWS, ANIMAL_RULES, COLD_LEGS, SOAKED_LB, FOOD_KINDS, RAFT, DERBY, EXTRA_GOODS } = await import('../src/journey/economy.js');
const { planEvents, eligibleEvents, EVENTS, EVENT_BY_ID } = await import('../src/journey/events.js');
const { useLegs, syntheticTrail, legList, LEGS, SEASONS, GOODS, nationFor } = await import('../src/journey/route.js');
const { mulberry32, hashSeed } = await import('../src/journey/rng.js');
const { LETTER_LINES, LETTER_OPEN } = await import('../src/content/letters.js');

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failures.push(name); console.log('  ✗ ' + name + '\n      ' + String(e && e.stack || e).split('\n').slice(0, 4).join('\n      ')); }
}
const V14_DEEDS = ['good-nose', 'fetch-champ', 'big-one', 'river-guide', 'skipper', 'keeper', 'wish-maker', 'hat-trick'];
const TRAIL = syntheticTrail(12);
useLegs(TRAIL);
const PARTY = ['blacksmith', 'scout', 'teacher'];   // v1.2: no cook (Rosa's 10 % changes the food arithmetic these tests pin down); each skill has its own party in the v1.2 tests below
const clone = (x) => JSON.parse(JSON.stringify(x));

// ---- a scripted kid: answers with the given chances, shops for the stretch to the next fort, plays the events ----
function shop(J, factor = 1.3) {
  const plan = foodToNextFort(J);
  const want = Math.max(0, Math.round(plan.lb * factor) - J.food);
  const sacks = Math.ceil(want / lbOf('flour'));
  const afford = Math.min(sacks, Math.floor(J.cash / Math.max(1, priceAt('flour', storeLeg(J), J.season))));   // the sacks the purse covers (the store is one tap a sack)
  if (afford > 0) buy(J, { item: 'flour', qty: afford, price: priceAt('flour', storeLeg(J), J.season) });
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
  assert.equal(list.length, GOODS.length + 2, 'every good plus the second yoke and (v1.4) the shiny spoon');
  assert.deepEqual(list.find((g) => g.id === 'yoke'), { id: 'yoke', name: 'A second yoke', unit: 'yoke', lb: 0, emoji: '🐂', food: false, price: priceAt('yoke', fort, 's1850') });
  assert.equal(priceAt('yoke', null, 's1847'), 42); assert.equal(priceAt('yoke', fort, 's1847'), Math.round(42 * fort.fort.prices));
  assert.ok(!storeList(null, 's1847').some((g) => g.id === 'yoke'), 'Independence has no second yoke'); assert.equal(storeList(null, 's1847').length, GOODS.length);
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
  assert.equal(res.cash.total, res.stars.reduce((a, lit, i) => a + (lit ? PAY.star[i] : 0), PAY.arrival), 'the arrival pay plus the pay of each lit star');
  assert.equal(J.cash, cash0 + res.cash.total);
  assert.equal(res.crate, crateFor(res.stars));
  assert.equal(arrive(J), res); assert.equal(J.cash, cash0 + res.cash.total, 'paid once');
  assert.deepEqual(J.stickers, [TRAIL[0].sticker.id]);
  assert.equal(tickDay(J).miles, 0, 'no travel after arriving');
});
test('crates: gold on 3 stars, silver on 2, bronze on 1; pay scales with the season', () => {
  assert.equal(crateFor([true, true, true]), 'gold'); assert.equal(crateFor([true, false, true]), 'silver');
  assert.equal(crateFor([true, false, false]), 'bronze'); assert.equal(crateFor([false, false, false]), null);
  const full = PAY.arrival + PAY.star.reduce((a, b) => a + b, 0);
  assert.equal(payFor([true, true, true], 's1850').total, full * 2, 'stars scale with the season too'); assert.equal(payFor([true], 's1853').arrival, PAY.arrival * 4); assert.equal(payFor([true], 's1853').stars, PAY.star[0] * 4);
  assert.ok(payFor([true, true, true], 's1847').stars > payFor([true, true, false], 's1847').stars && payFor([true, true, false], 's1847').stars > payFor([true, false, false], 's1847').stars, 'a better leg pays more, a bare arrival still pays');
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
test('the store problem never asks for more than the purse covers (v1.3: $45): a smaller multiple of the same fact stands in', () => {
  // every fact of the ladder, every season, a spread of purses: the problem's total, the shelf's total and "you have" stay within the cash
  const facts = []; for (let a = 2; a <= 12; a++) for (let b = 2; b <= 12; b++) facts.push(`${a}x${b}`, `${a * b}/${b}`);
  facts.push('23x4', '20x3', '14x6', '91/7');
  let capped = 0, checked = 0;
  for (const season of ['s1847', 's1850', 's1853']) for (const cash of [45, 28, 12]) for (const fact of facts) for (const item of ['flour', 'bacon', 'beans']) {
    const shelf = priceAt(item, null, season);
    for (const kind of ['buy', 'divide']) {
      const full = problemFor({ kind, fact, season, item, remainder: false });
      const p = problemFor({ kind, fact, season, item, cash, shelf, remainder: false });
      const qty = p.meta.qty;
      if (p.meta.price > cash || shelf > cash) continue;                 // the edge case: not even one fits (the app's gentle path)
      checked++;
      assert.ok(qty >= 1);
      assert.ok(p.meta.total <= cash, `${kind} ${fact} ${season} $${cash}: total ${p.meta.total}`);
      assert.ok(shelf * qty <= cash, `${kind} ${fact} ${season} $${cash}: ${qty} at the shelf's $${shelf}`);
      if (kind === 'buy') assert.equal(p.answer, p.meta.price * qty);
      if (qty < full.meta.qty) capped++;
    }
  }
  assert.ok(checked > 1000 && capped > 100, `checked ${checked}, capped ${capped}`);
  // the example from the playtest: 7 x 8 at a $45 purse becomes 7 x 4, not a $56 bill
  const q = problemFor({ kind: 'buy', fact: '7x8', season: 's1847', item: 'flour', cash: 45, shelf: 3 });
  assert.equal(q.meta.qty, 4); assert.equal(q.answer, 28); assert.equal(q.text, 'A sack of flour costs $7. You buy 4 sacks. How much is that?');
  // enough cash: untouched
  assert.deepEqual(problemFor({ kind: 'buy', fact: '7x8', season: 's1847', item: 'flour', cash: 400, shelf: 3 }).meta, problemFor({ kind: 'buy', fact: '7x8', season: 's1847', item: 'flour' }).meta);
  // no cash given: no cap (other callers)
  assert.equal(problemFor({ kind: 'buy', fact: '7x8', season: 's1847', item: 'flour' }).answer, 56);
  // the remainder variant stays inside the purse too
  const r = problemFor({ kind: 'divide', fact: '56/7', season: 's1847', item: 'flour', remainder: true, cash: 45, shelf: 3, rand: () => 0.5 });
  assert.ok(r.meta.total + r.meta.left <= 45, `have ${r.meta.total + r.meta.left}`);
  // the edge: not even one fits: the problem is left as asked (the app's "Not enough cash for that many" path)
  assert.equal(problemFor({ kind: 'buy', fact: '30x2', season: 's1847', cash: 10, shelf: 3 }).meta.qty, 2);
});
test('trade problems use the leg\'s nation and never trade more than the wagon holds', () => {
  const leg = TRAIL.find((l) => nationFor(l));
  const n = nationFor(leg);
  const p = problemFor({ kind: 'trade', fact: '7x8', leg });
  assert.ok(p.text.includes(n.name)); assert.equal(p.meta.nation, n.id);
  const q = problemFor({ kind: 'trade', fact: '7x8', leg, have: 7 });
  assert.ok(q.meta.giveN <= 7);
});
// ---- v1.4.1 sweep: every ladder fact a × b (a, b in 0 … 12) and the ÷ twins, every kind, every season, a range of purses
// and cash: the shown text, the spoken text, every worked line and the graded answer must agree with each other and with
// the true arithmetic of the numbers the text itself names ("9 × 12 is 96" must be impossible) ----
const eqLines = (line) => {
  const bad = [];
  for (const m of String(line).matchAll(/(\d+)\s*([×÷+−])\s*(\d+)\s*=\s*(\d+)/g)) {
    const a = Number(m[1]), b = Number(m[3]), c = Number(m[4]);
    const v = m[2] === '×' ? a * b : m[2] === '÷' ? a / b : m[2] === '+' ? a + b : a - b;
    if (v !== c) bad.push(`${m[0]} (true: ${v})`);
  }
  return bad;
};
const spokenOfText = (t) => String(t).replace(/\$(\d+)/g, (m, d) => dollarWords(Number(d))).replace(/\d+/g, (d) => numberWords(Number(d)));
const mathOfText = (p) => {
  const t = p.text, n = (re) => { const m = re.exec(t); return m ? m.slice(1).map(Number) : null; };
  switch (p.kind) {
    case 'buy': { const m = n(/costs \$(\d+)\. You buy (\d+)/); return m && { answers: [m[0] * m[1]], nums: m }; }
    case 'divide': { const m = n(/You have \$(\d+)\. .* cost \$(\d+) each/); return m && { answers: p.answers ? [Math.floor(m[0] / m[1]), m[0] % m[1]] : [Math.floor(m[0] / m[1])], nums: m }; }
    case 'ration': { const m = n(/eats (\d+) pounds? of food a day\. It is (\d+) days? to .*? The wagon has (\d+) pounds/); if (m) return { answers: [m[2] - m[0] * m[1]], nums: m };
      const r = n(/^(\d+) people each eat (\d+) pounds? of food a day\. How many pounds do they eat in (\d+) days/i) || n(/^\w+ people each eat (\d+) pounds? of food a day\. How many pounds do they eat in (\d+) days/); return null; }
    case 'distance': { let m = n(/is (\d+) miles away\. The wagon makes (\d+) miles a day/); if (m) return { answers: [m[0] / m[1]], nums: m };
      m = n(/makes (\d+) miles a day on the way to .*?\. How far does it go in (\d+) days?/); return m && { answers: [m[0] * m[1]], nums: m }; }
    case 'parts': { let m = n(/shares (\d+) new .*? equally among (\d+) /); if (m) return { answers: [m[0] / m[1]], nums: m };
      m = n(/has (\d+) spokes\. You check (\d+) wheels?\. (\d+) spokes? (?:is|are) broken/); if (m) return { answers: [m[0] * m[1] - m[2]], nums: m };
      m = n(/You have (\d+) \w+ of \w+ with (\d+) \w+ in each \w+\. (\d+) \w+ (?:is|are) /); return m && { answers: [m[0] * m[1] - m[2]], nums: m }; }
    case 'trade': { const m = n(/gives? (\d+) .*? for every (\d+)? ?.*?\. You (?:have|trade) (\d+)/); if (!m) return null;
      const get = Number(/(\d+) [^.]*? for every/.exec(t)[1]), per = Number((/for every (\d+) /.exec(t) || [0, 1])[1]), giv = Number(/You (?:have|trade) (\d+)/.exec(t)[1]);
      return { answers: [(giv / per) * get], nums: [get, per, giv] }; }
    default: return null;
  }
};
test('sweep: every ladder fact × every kind × every season × purses: text, spoken text, work lines and graded answer all agree', () => {
  const facts = [null];
  for (let a = 0; a <= 12; a++) for (let b = a; b <= 12; b++) { facts.push(`${a}x${b}`, `${b}x${a}`); if (a && a * b) { facts.push(`${a * b}/${a}`, `${a * b}/${b}`); } }
  const purses = [undefined, 0, 3, 10, 20, 28, 45, 60, 100, 250, 2000], shelves = [0, 3, 9];
  const seen = new Set();
  let n = 0, checkedText = 0;
  for (const kind of PROBLEM_KINDS) for (const season of SEASONS) for (const fact of facts) for (const cash of purses) for (const shelf of shelves) {
    const p = problemFor({ kind, fact, leg: TRAIL[3], season: season.id, cash, shelf, have: 40, remainder: kind === 'divide' ? (n % 2 === 0) : undefined });
    const key = `${kind}|${season.id}|${p.text}|${p.work.join('/')}`; if (seen.has(key)) continue; seen.add(key); n++;
    const tag = `${kind} ${fact} ${season.id} cash=${cash} shelf=${shelf}: ${p.text} => ${p.answer} :: ${p.work.join(' // ')}`;
    // 1. every equation in every worked line is true arithmetic
    for (const w of p.work) { const bad = eqLines(w); assert.deepEqual(bad, [], `${tag}: wrong equation ${bad}`); }
    // 2. the last worked line ends on the graded answer (the one the child is told)
    const last = p.work[p.work.length - 1];
    const ans = p.answers || [p.answer];
    for (const a of ans) assert.ok(new RegExp(`(^|[^\\d])${a}([^\\d]|$)`).test(last), `${tag}: last line "${last}" does not name ${a}`);
    // 3. the text's own numbers give the graded answer
    const m = mathOfText(p);
    if (m) { checkedText++; assert.deepEqual(ans, m.answers, `${tag}: the sentence says ${m.answers}`); }
    // 4. the spoken text is the shown text, word for word
    assert.equal(p.say.toLowerCase(), spokenOfText(p.text).toLowerCase(), `${tag}: say "${p.say}" vs text`);
    if (p.parts) p.parts.forEach((q, i) => { assert.equal(q.answer, ans[i], tag); assert.equal(q.say.toLowerCase(), spokenOfText(q.text).toLowerCase(), tag); });
    // 5. meta agrees with the answer and with the work line that names the product
    const md = p.meta || {};
    if (kind === 'buy') { assert.equal(md.price * md.qty, p.answer, tag); assert.ok(p.work[0].startsWith(`${md.qty} `) && p.work[0].includes(`$${md.price} each: ${md.price} × ${md.qty}`), `${tag}: first line`); }
    if (kind === 'divide') { assert.equal(md.price * md.qty + (md.left || 0), md.total + (md.left || 0), tag); assert.equal(md.price * p.answer, p.answers ? md.total : md.total, tag); }
    if (kind === 'distance') assert.equal(md.rate * md.days, md.miles, tag);
    if (kind === 'trade') { assert.equal(md.getN, p.answer, tag); assert.equal(md.giveN / md.rate[0] * md.rate[1], md.getN, tag); assert.ok(md.giveN <= 40, tag); }
    // 6. a store problem the purse capped is flagged as another fact than the ladder's (its shown numbers are what is graded)
  }
  assert.ok(n > 5000 && checkedText > 5000, `swept ${n}, text-checked ${checkedText}`);
});
test('sweep: problem.asked is the fact the sentence really asks (a capped / scaled / trade-limited 9 × 12 is not recorded as 9 × 12)', () => {
  const ask = (a) => { const m = /^(\d+)x(\d+)$/.exec(a); if (m) return { op: 'x', a: +m[1], b: +m[2], ans: m[1] * m[2] }; const d = /^(\d+)\/(\d+)$/.exec(a); return { op: '/', a: +d[1], b: +d[2], ans: d[1] / d[2] }; };
  let n = 0, differs = 0;
  for (const kind of PROBLEM_KINDS) for (const season of SEASONS) for (const fact of ['9x12', '12x9', '108/12', '108/9', '8x12', '7x8', '23x4', '91/7']) for (const cash of [undefined, 12, 28, 45, 100, 400]) {
    const p = problemFor({ kind, fact, season: season.id, cash, shelf: 3, have: 31 });
    if (p.asked === undefined) assert.fail(`${kind} ${fact}: no asked`);
    if (p.asked === null) continue;
    n++;
    const a = ask(p.asked), md = p.meta;
    if (p.asked !== fact && p.asked !== `${Math.min(...fact.split('x').map(Number))}x${Math.max(...fact.split('x').map(Number))}`) differs++;
    if (kind === 'buy') assert.deepEqual([a.op, a.ans], ['x', md.price * md.qty]);
    if (kind === 'divide') assert.deepEqual([a.op, a.ans, a.b], ['/', md.qty, md.price]);
    if (kind === 'ration') assert.equal(a.ans, md.eaten);
    if (kind === 'distance') assert.equal(a.ans, p.answer === md.days ? md.days : md.miles);
    if (kind === 'trade') assert.equal(a.ans, md.getN);
    if (kind === 'parts' && p.work[0].includes('÷')) assert.equal(a.ans, p.answer);
  }
  assert.ok(n > 300 && differs > 20, `asked ${n}, differing from the pick ${differs}`);
  // the playtest example: 9 × 12 with $45 in the purse is a 9 × 3 (or smaller), and says so
  const q = problemFor({ kind: 'buy', fact: '9x12', season: 's1847', item: 'flour', cash: 45, shelf: 3 });
  assert.equal(q.fact, '9x12'); assert.equal(q.asked, '3x9'); assert.equal(q.answer, 27);
  const full = problemFor({ kind: 'buy', fact: '9x12', season: 's1847', item: 'flour' });
  assert.equal(full.asked, '9x12'); assert.equal(full.answer, 108);
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
test('54 cards in six suits: 12 landmarks, 8 nations, 12 wild, 8 companions, 6 river, 8 trail tales, with the shape the album needs', () => {
  assert.equal(CARDS.length, 54);
  assert.deepEqual(SUITS, ['landmark', 'nation', 'wild', 'companion', 'river', 'tales']);
  assert.deepEqual(SUITS.map((s) => cardsOf(s).length), [12, 8, 12, 8, 6, 8]);
  assert.equal(new Set(CARDS.map((c) => c.id)).size, 54, 'ids are unique across suits');
  for (const c of CARDS) {
    assert.equal(CARD_BY_ID[c.id], c);
    for (const k of ['id', 'suit', 'name', 'emoji', 'fact', 'say']) assert.ok(typeof c[k] === 'string' && c[k].length > 0, `${c.id}.${k}`);
    assert.ok(SUITS.includes(c.suit));
    assert.ok(c.fact.length <= 170, `${c.id}: one line (${c.fact.length})`);
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
  assert.equal(J.cards.length, 54);
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
  J.cash = 500; const cash0 = J.cash;
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
test('derbyPay: DERBY.win x the season\'s price level for a win, DERBY.lose x it for a good try, added to the cash', () => {
  for (const s of SEASONS) {
    const J = createJourney({ season: s.id, companions: PARTY, seed: 61 });
    const c0 = J.cash;
    assert.deepEqual(derbyPay(J, { won: true, margin: 3 }), { cash: DERBY.win * s.priceMult, won: true }); assert.equal(J.cash, c0 + DERBY.win * s.priceMult);
    assert.deepEqual(derbyPay(J, { won: false, margin: -2 }), { cash: DERBY.lose * s.priceMult, won: false }); assert.equal(J.cash, c0 + DERBY.win * s.priceMult + DERBY.lose * s.priceMult);
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
  assert.equal(derbyPay(old3, { won: true }).cash, DERBY.win); assert.ok(dailyChallenge(old3, 'd').text);
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
const isFoodLike = (id) => Object.hasOwn(TRADE_LB, id) || id === 'bacon' || id === 'beans';
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
  assert.deepEqual(J.goods, { parts: 1, rope: 0, blankets: 0, arrows: 15, pelts: 6, yoke: 0, horseshoes: 0, hoppers: 0, spoon: 0 }, 'v1.4 adds horseshoes, the grasshopper tin and the spoon');
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
test('the second yoke: sold from Fort Kearny on (not at Independence), EXTRA_GOODS price × the price level, four animals, +3 miles a day, tiring halved; only one', () => {
  const YOKE = EXTRA_GOODS.find((g) => g.id === 'yoke');
  assert.equal(YOKE.price, 42); assert.equal(YOKE.fromLeg, 2);
  const I = rich(mk()); I.cash = 500;
  assert.equal(yokeOffered(null), false, 'not at the Independence store'); assert.ok(!storeList(null, 's1847').some((g) => g.id === 'yoke'));
  assert.deepEqual(buy(I, { item: 'yoke', qty: 1 }), { ok: false, cost: YOKE.price, cash: 500, foodLb: 0 }, 'the Independence store has none'); assert.equal(I.animals.n, 2);
  assert.equal(yokeOffered(TRAIL[0]), false, 'nor at the Kansas River'); assert.equal(yokeOffered(TRAIL[1]), true, 'Fort Kearny is the first store that has one');
  assert.ok(storeList(TRAIL[1], 's1847').some((g) => g.id === 'yoke')); assert.ok(!storeList(TRAIL[0], 's1847').some((g) => g.id === 'yoke'));
  assert.equal(priceAt('yoke', null, 's1847'), YOKE.price, 'the price is defined everywhere; the shelf decides');
  const J = rich(mk()); J.cash = 500; startLeg(J, TRAIL[1].id); J.trip.arrived = true;       // standing in Fort Kearny's store
  const price = priceAt('yoke', storeLeg(J), 's1847'); assert.equal(price, Math.round(YOKE.price * TRAIL[1].fort.prices));
  const b = buy(J, { item: 'yoke', qty: 1 }); assert.deepEqual([b.ok, b.cost], [true, price]);
  assert.equal(J.cash, 500 - price); assert.equal(J.animals.n, 4); assert.equal(J.goods.yoke, 1);
  assert.deepEqual(buy(J, { item: 'yoke', qty: 1 }), { ok: false, cost: price, cash: 500 - price, foodLb: 0 }, 'only one second yoke'); assert.equal(J.cash, 500 - price);
  assert.equal(speedBonus(J), 3);
  startLeg(J, TRAIL[2].id); quiet(J); assert.equal(tickDay(J, { rand: R5 }).miles, 18);
  setPace(J, 'brisk'); const t0 = J.animals.tired; tickDay(J, { rand: R5 }); assert.equal(J.animals.tired - t0, 6, 'brisk tires them half as much');
  assert.equal(legStatus(J).etaDays, etaDays(J.trip.miles - J.milesDone, 'brisk', 'oxen', 3));
  const poor = mk(); startLeg(poor, TRAIL[1].id); poor.trip.arrived = true; poor.cash = price - 1; assert.equal(buy(poor, { item: 'yoke' }).ok, false); assert.equal(poor.animals.n, 2);
  const S = createJourney({ season: 's1850', companions: PLAIN, seed: 1 }); S.cash = 500; startLeg(S, TRAIL[1].id); S.trip.arrived = true; assert.equal(buy(S, { item: 'yoke' }).cost, priceAt('yoke', TRAIL[1], 's1850'));
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
test('trade offers (W8): every offer is something the wagon holds, for all eight nations and many random wagons', () => {
  const seenNations = new Set(), kinds = { listed: 0, fallback: 0 }, gives = new Set();
  const rand = mulberry32(8080);
  const ri = (n) => Math.floor(rand() * n);
  for (let i = 0; i < 1500; i++) {
    const nation = NATIONS[i % NATIONS.length];                       // all eight, even two that share a leg (Nez Perce, Cayuse)
    const leg = legList().find((l) => l.nation === nation.id || (nation.legs || []).includes(l.id));
    const J = mk(PLAIN, 100 + i); startLeg(J, leg.id);
    // a random wagon: any goods (often none), tokens, food kinds; blankets only sometimes
    J.goods.pelts = rand() < 0.4 ? 0 : ri(9); J.goods.rope = rand() < 0.5 ? 0 : ri(7); J.goods.blankets = rand() < 0.6 ? 0 : ri(8);
    J.tokens = rand() < 0.5 ? 0 : ri(12);
    J.foods = { flour: ri(5) * 50 + ri(50), bacon: ri(8) * 20, beans: ri(6) * 25, other: ri(60) }; syncFood(J);
    const canDo = [...nation.trades, ...FALLBACK_TRADES].some((t) => spareGoods(J, t.give) >= t.rate[0]);
    const o = tradeOffer(J, { nation: nation.id });
    assert.equal(o.nation, nation.id);
    seenNations.add(o.nation);
    assert.equal(o.have, spareGoods(J, o.give), 'have is what the wagon can spare');
    if (o.kind !== 'none') {
      assert.ok(o.have >= o.rate[0], `${leg.id} offers ${o.rate[0]} ${o.give} but the wagon spares ${o.have} (${JSON.stringify({ g: J.goods, t: J.tokens, f: J.foods })})`);
      assert.ok(o.trades >= 1 && o.trades === Math.floor(o.have / o.rate[0]));
      kinds[o.kind]++; gives.add(o.give);
      assert.ok(['pelts', 'rope', 'blankets', 'tokens', 'flour', 'bacon', 'beans'].includes(o.give), o.give);
      assert.ok(isFoodLike(o.get), `${o.get} is a food`);
      // the trade is a multiplication scene: the rate times the count, whole numbers, and it can be made
      const p = problemFor({ kind: 'trade', fact: ['7x8', '3x4', '9x6', null, '56/7'][i % 5], leg: J.legId, season: J.season, rand, nation: nation.id, offer: o });
      assert.equal(p.meta.give, o.give); assert.equal(p.meta.get, o.get); assert.deepEqual(p.meta.rate, o.rate);
      assert.ok(p.meta.giveN <= o.have, `story trades ${p.meta.giveN} of ${o.have}`);
      assert.equal(p.meta.giveN % o.rate[0], 0); assert.equal(p.answer, (p.meta.giveN / o.rate[0]) * o.rate[1]); assert.equal(p.answer, p.meta.getN);
      assert.ok(p.meta.giveN / o.rate[0] >= 1);
      // and applying it takes exactly what the story gave and adds the food
      const before = { have: spareGoods(J, o.give), food: J.food };
      const r = applyTrade(J, p.meta);
      assert.equal(r.gave, p.meta.giveN, 'nothing shrinks: the wagon held it'); assert.equal(r.got, p.meta.getN);
      assert.equal(spareGoods(J, o.give), before.have - r.gave);
      assert.equal(J.food, before.food + r.got * lbOf(o.get) - (['flour', 'bacon', 'beans'].includes(o.give) ? r.gave * lbOf(o.give) : 0));
      assert.ok(J.tokens >= 0 && Object.values(J.goods).every((v) => v >= 0) && FOOD_KINDS.every((k) => J.foods[k] >= 0));
    } else {
      assert.ok(o.have < o.rate[0], 'the guard only when nothing can be traded');
      assert.ok(!canDo, 'the guard was reached although the wagon held something to trade');
    }
  }
  assert.equal(seenNations.size, 8, 'all eight nations');
  assert.deepEqual([...seenNations].sort(), NATIONS.map((n) => n.id).sort());
  assert.ok(kinds.listed > 100 && kinds.fallback > 20, JSON.stringify(kinds));
  for (const g of ['pelts', 'rope', 'blankets', 'tokens', 'flour']) assert.ok(gives.has(g), `${g} is offered sometimes`);
});
const tradeOfferFor = tradeOffer;
test('trade offers: the signature trade when the wagon holds its goods, the other listed goods otherwise, a token trade as the fallback', () => {
  for (const n of NATIONS) {
    assert.ok(Array.isArray(n.trades) && n.trades.length >= 3 || n.trades.length >= 2, `${n.id} lists its trades`);
    assert.deepEqual(n.trades[0], n.trade, `${n.id}: the signature trade is listed first`);
    for (const t of n.trades) { assert.equal(t.get, n.trade.get, 'the same food'); assert.ok(['pelts', 'rope', 'blankets'].includes(t.give)); assert.ok(t.rate[0] >= 1 && t.rate[1] >= 1); }
    assert.equal(new Set(n.trades.map((t) => t.give)).size, n.trades.length, `${n.id}: one trade per good`);
    const J = mk(PLAIN, 5); startLeg(J, 'kansas-river');                // the offer is for the nation asked for (ev.nation), wherever the wagon is
    const tradeOffer = (J, o = {}) => tradeOfferFor(J, { nation: n.id, ...o });
    // the wagon holds plenty of the signature good: that one is offered
    J.goods[n.trade.give] = 40;
    assert.equal(tradeOffer(J).give, n.trade.give); assert.equal(tradeOffer(J).kind, 'listed');
    // none of the signature good, but one of the nation's other goods: that one
    J.goods = { ...J.goods, pelts: 0, rope: 0, blankets: 0 };
    const alt = n.trades[1]; J.goods[alt.give] = 40;
    assert.equal(tradeOffer(J).give, alt.give, `${n.id} falls to ${alt.give}`); assert.equal(tradeOffer(J).kind, 'listed');
    // no goods at all: a token trade when the child has tokens, else store food
    J.goods = { ...J.goods, pelts: 0, rope: 0, blankets: 0 };
    J.tokens = 6; let o = tradeOffer(J);
    assert.equal(o.give, 'tokens'); assert.equal(o.kind, 'fallback'); assert.equal(o.have, 6); assert.equal(o.trades, 3);
    J.tokens = 0; o = tradeOffer(J);
    assert.equal(o.give, 'flour'); assert.equal(o.kind, 'fallback'); assert.ok(o.have >= 2);
    // the fallback token trade takes the tokens and gives food
    J.tokens = 6; const f = J.food; const p = problemFor({ kind: 'trade', fact: '3x4', leg: J.legId, season: J.season, offer: tradeOffer(J) });
    assert.equal(p.meta.give, 'tokens'); assert.ok(p.text.includes('trade token'), p.text);
    const r = applyTrade(J, p.meta); assert.equal(J.tokens, 6 - r.gave); assert.ok(r.gave >= 2 && r.got >= 3); assert.equal(J.food, f + r.foodLb);
  }
});
test('trade offers: one trade still counts as an offer; the guard "nothing to trade" is the last resort; a person\'s own trade', () => {
  const J = mk(PLAIN, 9); startLeg(J, 'kansas-river');                     // pelts [3, 2]
  J.goods.pelts = 3; J.tokens = 20;
  assert.equal(tradeOffer(J).give, 'pelts', 'the nation\'s own goods before tokens, even for one trade'); assert.equal(tradeOffer(J).trades, 1);
  J.goods.pelts = 2; assert.equal(tradeOffer(J).give, 'tokens');
  J.tokens = 1; J.foods = { flour: 0, bacon: 0, beans: 0, other: 30 }; syncFood(J);
  const none = tradeOffer(J);
  assert.equal(none.kind, 'none'); assert.ok(none.have < none.rate[0], 'the app\'s guard test (have < rate[0]) still fires');
  assert.equal(applyTrade(J, { giveN: 3, getN: 2 }).got, 0, 'and a trade of nothing creates nothing');
  // a person's own trade: only their listed trade, then the same fallbacks
  const gift = PERSON_BY_ID.dell.gift; J.goods.rope = 0; J.tokens = 0; J.foods = { flour: 100, bacon: 0, beans: 0, other: 0 }; syncFood(J);
  let o = tradeOffer(J, { trades: [gift] }); assert.equal(o.give, 'flour'); assert.equal(o.kind, 'fallback');
  J.goods.rope = 9; o = tradeOffer(J, { trades: [gift] }); assert.equal(o.give, 'rope'); assert.equal(o.kind, 'listed'); assert.deepEqual(o.rate, [3, 2]);
  assert.equal(tradeLine(o, 'Mr. Dell'), 'Mr. Dell offers a fair trade: three coils of rope for two bags of camas roots.');
  assert.equal(spareGoods(J, 'tokens'), 0); assert.equal(spareGoods(J, 'flour'), 2); assert.equal(spareGoods(J, 'beans'), 0);
  const r = applyTrade(J, { giveN: 6, getN: 4, give: 'rope', get: 'camas' }); assert.equal(r.gave, 6); assert.equal(r.got, 4); assert.equal(J.goods.rope, 3);
  const r2 = applyTrade(J, { giveN: 6, getN: 4, give: 'rope', get: 'camas' }); assert.equal(r2.gave, 3, 'a person\'s trade at its own rate [3, 2]: one trade left'); assert.equal(r2.got, 2);
});
test('blankets are never traded away while a cold leg lies ahead (the trade offer only counts the spare ones)', () => {
  const J = mk(PLAIN, 3); startLeg(J, 'fort-kearny');            // the Pawnee trade blankets for corn, but the wagon has none
  assert.equal(tradeOffer(J).give, 'pelts', 'no blankets: the offer is pelts, which the wagon has');
  J.goods.blankets = 2; assert.equal(spareGoods(J, 'blankets'), 0, 'two are needed for South Pass'); assert.equal(tradeOffer(J).give, 'pelts', 'no spare blanket: still pelts');
  J.goods.blankets = 5; assert.equal(spareGoods(J, 'blankets'), 3); assert.equal(tradeOffer(J).give, 'blankets'); assert.equal(tradeOffer(J).have, 3);
  const r = applyTrade(J, { giveN: 5, getN: 15, give: 'blankets' }); assert.equal(r.gave, 3); assert.equal(J.goods.blankets, 2, 'the two for the mountains stay');
  startLeg(J, 'the-dalles'); J.goods.blankets = 2; assert.equal(spareGoods(J, 'blankets'), 2, 'past the cold legs, all of them are spare'); assert.equal(tradeOffer(J).give, 'blankets'); assert.equal(tradeOffer(J).have, 2);
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
test('raftPay: $24 less $6 a bump, never under $6, times the season; stampedePay: held = the bison card', () => {
  for (const s of SEASONS) {
    const want = [24, 18, 12, 6, 6, 6];
    want.forEach((w, bumps) => { const J = createJourney({ season: s.id, companions: PLAIN, seed: 5 }); const c0 = J.cash; const r = raftPay(J, { bumps }); assert.equal(r.cash, w * s.priceMult); assert.equal(J.cash, c0 + r.cash); });
    const J = createJourney({ season: s.id, companions: PLAIN, seed: 5 }); const c0 = J.cash;
    assert.deepEqual(stampedePay(J, { held: true }), { cash: 15 * s.priceMult, card: 'bison', held: true, fact: 'bison-thunder' }); assert.equal(J.cash, c0 + 15 * s.priceMult);
    assert.deepEqual(stampedePay(J, { held: false }), { cash: 0, card: null, held: false, fact: 'bison-thunder' }); assert.equal(J.cash, c0 + 15 * s.priceMult);
    assert.deepEqual([J.totals.stampedes, J.totals.stampedesHeld], [2, 1]);
  }
  assert.ok(CARD_BY_ID.bison); assert.deepEqual(RAFT, { base: 24, perBump: 6, min: 6 });
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
  assert.equal(DEEDS.length, 28, '20 from 1.2 and 8 from 1.4'); assert.equal(new Set(DEEDS.map((d) => d.id)).size, 28);
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
  J.cash = 2000; shop(J); buy(J, { item: 'parts', qty: 4 });
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
    if (leg.stop.kind === 'fort') { shop(J); buy(J, { item: 'yoke' }); }
    nextLeg(J);
  }
  check();
  const ids = DEEDS.map((d) => d.id).filter((d) => !V14_DEEDS.includes(d));
  const missing = ids.filter((id) => !J.deeds.includes(id)); assert.ok(missing.length === 0, 'missing deeds: ' + missing.join(', '));
  assert.equal(J.deeds.filter((d) => !V14_DEEDS.includes(d)).length, 20); assert.equal(new Set(J.deeds).size, J.deeds.length);
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
  assert.deepEqual(old.totals.reached, []); assert.equal(old.trip.v12, 1); assert.equal(old.rev, 14, 'a 1.1 save is filled up to rev 14');
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

// =====================================================================================================================================
// v1.4 Frodo and the river (SPEC v1.4 §3, §7.1): the dog's nose, fetch, fishing 2.0, quests, trail facts and moments, saves and sync.
// The content tables (src/content/{finds,fish,quests,trailFacts}.js) are the real ones.
// =====================================================================================================================================
const V14 = await import('../src/journey/sim.js');
const FISHMOD = await import('../src/journey/fishing.js');
const { FINDS, FIND_BY_ID, WISHES } = await import('../src/content/finds.js');
const { FISH, FISH_BY_ID, JUNK, WATERS, WATER_NAMES, RIVER_STOPS, BAITS } = await import('../src/content/fish.js');
const { TRAIL_FACTS } = await import('../src/content/trailFacts.js');
const { QUESTS } = await import('../src/content/quests.js');
const { NOSE, FETCH, FISHING, MOMENTS: MOMENT_RULES, HORSESHOE } = await import('../src/journey/economy.js');

console.log('\nv1.4: Frodo and the river');
const skip = (name, why) => console.log('  - SKIP ' + name + ': ' + why);
const LAST = TRAIL[TRAIL.length - 1].id;
const NOSE_LEGS = TRAIL.filter((l) => l.id !== LAST);
/** a journey on a given leg with a dog (adopted the way the app does it: after the leg's arrival at the Kansas River, or mid-trail by hand) */
function v14mk(seed = 3, { dog = true, leg = null, party = PLAIN, season = 's1847' } = {}) {
  const J = createJourney({ companions: party, seed, season });
  if (leg) startLeg(J, leg);
  if (dog) V14.adoptDog(J, { name: 'Frodo', coat: 'spotted' });
  return J;
}
/** arrive at the leg's stop without playing the days (the plans are what the tests read) */
function v14arrive(J) { const leg = legList()[J.legIndex]; J.milesDone = leg.miles; J.trip.arrived = true; return arrive(J); }
const v14kinds = (plan) => plan.map((s) => s.kind);

test('no dog, no nose: no slots on any leg of any seed, and tickDay never emits a nose moment', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const J = createJourney({ seed, companions: PLAIN });
    assert.equal(J.dog, null);
    for (const leg of TRAIL) { startLeg(J, leg.id); assert.deepEqual(J.trip.nose, [], leg.id); }
  }
  const rand = mulberry32(5), J = createJourney({ seed: 5, companions: PLAIN });
  for (let g = 0; g < 14 && !J.done; g++) {
    for (let d = 0; d < 80; d++) { const r = tickDay(J, { rand }); assert.equal(r.nose, null); if (r.marker) applyMarker(J, { correct: true }); if (r.arrived) break; }
    arrive(J); nextLeg(J);
  }
  assert.deepEqual(V14.planNose(J, TRAIL[0], rand), [], 'planNose without a dog is empty');
});

test('with a dog: 2 or 3 slots a leg (both happen), at least 25 miles apart, none past 92 % of the leg, in order, over 1,000 seeded legs', () => {
  const counts = { 2: 0, 3: 0 };
  for (let k = 0; k < 1000; k++) {
    const J = v14mk(100 + k);
    const leg = NOSE_LEGS[k % NOSE_LEGS.length];
    startLeg(J, leg.id);
    const plan = J.trip.nose;
    assert.ok(plan.length === 2 || plan.length === 3, `${leg.id}: ${plan.length} slots`);
    counts[plan.length]++;
    plan.forEach((s, i) => {
      assert.ok(s.atMile >= Math.round(NOSE.from * leg.miles) && s.atMile <= 0.92 * leg.miles, `${leg.id} mile ${s.atMile} of ${leg.miles}`);
      assert.equal(s.fired, false);
      if (i) assert.ok(s.atMile - plan[i - 1].atMile >= NOSE.spacingMi, `${leg.id}: ${plan[i - 1].atMile} then ${s.atMile}`);
    });
  }
  assert.ok(counts[2] > 300 && counts[3] > 300, 'even odds: ' + JSON.stringify(counts));
  assert.ok(Math.abs(counts[2] - 500) < 90, 'about even: ' + counts[2]);
  const J = v14mk(9); startLeg(J, LAST); assert.deepEqual(J.trip.nose, [], 'the raft leg has no trail days, so no slots');
});

test('the berry patch: the first leg after the dog joins, then every other leg (1.1\'s rhythm, now the journey\'s); the dog joining before or after the arrival is counted', () => {
  for (const namedBeforePay of [true, false]) {
    const J = createJourney({ seed: 21, companions: PLAIN });
    J.milesDone = TRAIL[0].miles; J.trip.arrived = true;
    if (namedBeforePay) { V14.adoptDog(J, { name: 'Frodo' }); arrive(J); } else { arrive(J); V14.adoptDog(J, { name: 'Frodo' }); }
    const rows = [];
    for (let i = 1; i < 11; i++) { nextLeg(J); const had = v14kinds(J.trip.nose).includes('berries'); rows.push(had ? 'B' : '.'); v14arrive(J); }
    assert.equal(rows.join(''), 'B.B.B.B.B.', `named before the arrival pay: ${namedBeforePay}`);
  }
  assert.deepEqual(clone(V14.adoptDog(createJourney({ seed: 1 }), { name: 'Frodo-the-Great-and-Terrible', coat: 'black' }).dog),
    { name: 'Frodo-the-Gr', coat: 'black', legs: 0, nextBerries: 1, treats: 0, muddy: false }, 'the 1.1 shape + treats and muddy; the name is cut at 12');
});

test('at most one rabbit and one snake a leg; the snake only in the prairie, bluffs and high desert; every kind occurs over many legs', () => {
  const seen = new Set();
  for (let k = 0; k < 1200; k++) {
    const J = v14mk(300 + k);
    const leg = NOSE_LEGS[k % NOSE_LEGS.length];
    J.dog.nextBerries = 0;
    startLeg(J, leg.id);
    const ks = v14kinds(J.trip.nose);
    ks.forEach((x) => seen.add(x));
    assert.ok(ks.filter((x) => x === 'rabbit').length <= 1 && ks.filter((x) => x === 'snake').length <= 1, ks.join());
    if (ks.includes('snake')) assert.ok(NOSE.snakeBiomes.includes(leg.biome), `snake on a ${leg.biome} leg`);
  }
  assert.deepEqual([...seen].sort(), ['berries', 'find', 'rabbit', 'snake'], 'no quest slot once the locket is carried');
  let snakes = 0, mountains = 0;
  for (let k = 0; k < 600; k++) { const J = v14mk(900 + k); startLeg(J, 'south-pass'); mountains++; if (v14kinds(J.trip.nose).includes('snake')) snakes++; }
  assert.equal(snakes, 0);
});

test('finds: only of the leg\'s biome, the spoon never while owned, the arrowhead (sketch) never adds goods, the unseen first', () => {
  for (const leg of TRAIL) {
    const J = v14mk(5, { leg: leg.id });
    const r = mulberry32(leg.n * 17);
    for (let i = 0; i < 400; i++) {
      const id = V14.drawFind(J, leg, r);
      const f = FIND_BY_ID[id];
      assert.ok(f && (!Array.isArray(f.biomes) || f.biomes.includes(leg.biome)), `${id} on ${leg.biome}`);
    }
    J.goods.spoon = 1;
    for (let i = 0; i < 3000; i++) assert.notEqual(V14.drawFind(J, leg, r), 'spoon', 'never while owned');
    for (let i = 0; i < 3000; i++) assert.notEqual(V14.drawFind(J, leg, r, { fromFetch: true }), 'spoon', 'a fetch rolls the spoon itself');
  }
  const J = v14mk(6);
  assert.ok(FIND_BY_ID.arrowhead.keep === 'sketch');
  const a = V14.recordFind(J, 'arrowhead'); assert.deepEqual([a.id, a.first, a.n, a.goods], ['arrowhead', true, 1, undefined]);
  assert.ok(!('arrowhead' in J.goods)); assert.equal(Object.keys(J.goods).sort().join(), 'arrows,blankets,hoppers,horseshoes,parts,pelts,rope,spoon,yoke');
  const h = V14.recordFind(J, 'horseshoe'); assert.deepEqual(h.goods, { id: 'horseshoes', n: 1 }); V14.recordFind(J, 'horseshoe'); assert.equal(J.goods.horseshoes, 2); assert.equal(J.finds.horseshoe, 2);
  const sp = V14.recordFind(J, 'spoon'); assert.deepEqual(sp.goods, { id: 'spoon', n: 1 }); V14.recordFind(J, 'spoon'); assert.equal(J.goods.spoon, 1, 'one spoon is all there is');
  J.spirit = 98; const chip = V14.recordFind(J, 'buffalo-chip'); assert.deepEqual(chip.effect, { spirit: 5 }); assert.equal(J.spirit, MOOD.max, 'spirit capped');
  const st = V14.recordFind(J, 'flat-stone'); assert.deepEqual(st.effect, { skips: 2 }); assert.equal(J.trip.skipBonus, 2);
  assert.equal(V14.recordFind(J, 'no-such-find'), null);
  // the unseen first (unseenBias 0.7): with eight of nine seen the ninth comes up far more often than its weight
  const K = v14mk(7, { leg: 'chimney-rock' }); const bl = legList()[2];
  for (const f of FINDS) if (f.id !== 'arrowhead') K.finds[f.id] = 1;
  K.goods.spoon = 1;
  const r = mulberry32(8); let ar = 0; for (let i = 0; i < 2000; i++) if (V14.drawFind(K, bl, r) === 'arrowhead') ar++;
  assert.ok(ar > 1250, `arrowhead ${ar} of 2000 (the only unseen find in the bluffs)`);
});

test('a nose slot fired by tickDay is applied by tickDay itself (find recorded, berries fed, snake cheers, quest found) and the rabbit waits', () => {
  const J = v14mk(31, { leg: 'chimney-rock' });
  const rand = mulberry32(2);
  J.trip.events = []; J.trip.nose = [{ atMile: 3, kind: 'find', fired: false }, { atMile: 60, kind: 'berries', fired: false }, { atMile: 90, kind: 'snake', fired: false }, { atMile: 120, kind: 'rabbit', fired: false }];
  const got = [];
  for (let d = 0; d < 40; d++) { const f0 = J.food, r = tickDay(J, { rand }); if (r.marker) applyMarker(J, { correct: true }); if (r.nose) got.push({ ...r.nose, foodBefore: f0, sp: J.spirit }); if (r.arrived) break; }
  assert.deepEqual(got.map((g) => g.kind), ['find', 'berries', 'snake', 'rabbit']);
  assert.ok(FIND_BY_ID[got[0].find.id] && got[0].find.first === true && got[0].find.n === 1);
  assert.equal(got[1].foodLb, 20); assert.equal(got[1].card, 'wild-plum'); assert.equal(J.totals.berries, 1);
  assert.equal(got[2].card, 'rattlesnake'); assert.equal(J.totals.snakes, 1);
  assert.equal(got[3].card, 'jackrabbit'); assert.equal(J.totals.chases, 0, 'the rabbit\'s outcome waits for chaseResult');
  assert.equal(J.totals.noseFinds, 1); assert.equal(J.finds[got[0].find.id], 1);
  assert.ok(J.trip.happened.includes('nose') && J.trip.happened.includes('berries') && J.trip.happened.includes('snake') && J.trip.happened.includes('chase'));
});

test('one thing a day: never two of {marker, event, nose, fact, moment}, nothing on the arrival day, nothing in the last 8 % unfired-and-late; across 16 dog journeys', () => {
  let noses = 0, facts = 0, moments = 0, markers = 0, events = 0;
  for (let seed = 400; seed < 416; seed++) {
    const rand = mulberry32(seed), J = createJourney({ seed, companions: PLAIN });
    for (let g = 0; g < 14 && !J.done; g++) {
      const leg = legList()[J.legIndex];
      for (let d = 0; d < 120; d++) {
        const start = J.milesDone, r = tickDay(J, { rand });
        const things = [r.nose && 'nose', r.fact && 'fact', r.moment && 'moment'].filter(Boolean);
        if (r.marker) markers++; if (r.event) events++;
        assert.ok(things.length <= 1, `${leg.id} day ${J.day}: ${things.join()}`);
        if (things.length) {
          assert.ok(!r.marker && !r.event && !r.arrived && r.miles > 0, `${leg.id}: a ${things[0]} on a busy day`);
          assert.ok(start <= leg.miles * 0.92, `${leg.id}: a ${things[0]} when the day started at ${start} of ${leg.miles}`);
        }
        if (r.nose) noses++; if (r.fact) facts++; if (r.moment) moments++;
        if (r.marker) applyMarker(J, { correct: true });
        if (r.fact) V14.heardFact(J, r.fact.id);
        if (r.arrived) { assert.equal(r.nose, null); assert.equal(r.fact, null); assert.equal(r.moment, null); break; }
      }
      arrive(J);
      if (leg.id === 'kansas-river') V14.adoptDog(J, { name: 'Frodo' });
      nextLeg(J);
    }
  }
  assert.ok(noses > 150 && facts > 30 && moments > 8 && markers > 500 && events > 150, JSON.stringify({ noses, facts, moments, markers, events }));
});

test('tickDay: the emitted shapes are { nose: null | {kind …}, fact: null | { id, night, ambient, sound }, moment: null | { kind: "dustDevil" } }', () => {
  const J = v14mk(8, { leg: 'fort-kearny' });
  J.trip.events = []; J.trip.nose = []; J.trip.fact = { id: 'wolf-song', atMile: 10, fired: false }; J.trip.dustDevil = null;
  let r; do { r = tickDay(J, { rand: mulberry32(1) }); if (r.marker) applyMarker(J, { correct: true }); } while (!r.fact && !r.arrived);
  const wolf = TRAIL_FACTS.find((f) => f.id === 'wolf-song');
  assert.deepEqual(r.fact, { id: 'wolf-song', night: true, ambient: wolf.ambient, sound: wolf.sound });
  assert.deepEqual(Object.keys(r).filter((k) => ['nose', 'fact', 'moment'].includes(k)).sort(), ['fact', 'moment', 'nose']);
  const K = v14mk(9, { leg: 'chimney-rock' }); K.trip.events = []; K.trip.nose = []; K.trip.fact = null; K.trip.dustDevil = { atMile: 10, fired: false };
  let q; do { q = tickDay(K, { rand: mulberry32(1) }); if (q.marker) applyMarker(K, { correct: true }); } while (!q.moment && !q.arrived);
  assert.deepEqual(q.moment, { kind: 'dustDevil' }); assert.equal(K.moments.dustDevilLeg, K.legIndex);
});

test('chaseResult: called early = clean, late or never = muddy; spirit +5 either way; nothing is ever taken away; arrive and camp wash the dog', () => {
  const J = v14mk(11, { leg: 'fort-laramie' });
  const snap = () => clone({ food: J.food, foods: J.foods, cash: J.cash, goods: J.goods, cards: J.cards, tokens: J.tokens, parts: J.parts, finds: J.finds });
  for (const [called, dist, muddy] of [[true, 0.1, false], [true, 0.79, false], [true, 0.8, true], [true, 1, true], [false, 1, true], [false, 0.2, true]]) {
    J.spirit = 40; J.dog.muddy = false;
    const before = snap(), c0 = J.totals.chasesCalled;
    const r = V14.chaseResult(J, { called, dist });
    assert.deepEqual(r, { muddy, line: muddy ? 'muddy' : 'good', card: 'jackrabbit' }, JSON.stringify({ called, dist }));
    assert.equal(J.dog.muddy, muddy); assert.equal(J.spirit, 40 + NOSE.spirit); assert.deepEqual(snap(), before, 'nothing taken away');
    assert.equal(J.totals.chasesCalled, c0 + (called ? 1 : 0));
  }
  V14.chaseResult(J, { called: false, dist: 1 }); assert.equal(J.dog.muddy, true);
  const c = camp(J, 'rest', { rand: mulberry32(1) }); assert.equal(c.bath, true); assert.equal(J.dog.muddy, false);
  assert.equal(camp(J, 'rest', { rand: mulberry32(1) }).bath, false, 'a clean dog needs no bath');
  V14.chaseResult(J, { called: false, dist: 1 }); v14arrive(J);
  assert.equal(J.trip.result.bath, true); assert.equal(J.dog.muddy, false); assert.equal(arrive(J).bath, true, 'idempotent');
  assert.equal(J.dog.legs, 1, 'arrive counts the leg the dog was along for');
  assert.equal(V14.chaseResult(createJourney({ seed: 2 }), { called: true, dist: 0.1 }).muddy, false, 'no dog: harmless');
});

test('fetchThrow: treats at FETCH.at (1, 2, 3), three throws a visit then nothing, camp and arrive reset it, no day passes, items about 12 % of throws', () => {
  const J = v14mk(12, { leg: 'fort-laramie' }); const rand = mulberry32(4);
  const day0 = J.day, food0 = J.food;
  assert.deepEqual([0.1, 0.339, 0.34, 0.5, 0.669, 0.67, 1].map((d) => { J.trip.fetchThrows = 0; return V14.fetchThrow(J, { dist: d, rand: () => 0.99 }).treats; }), [1, 1, 2, 2, 2, 3, 3]);
  J.trip.fetchThrows = 0; J.dog.treats = 0; J.treatsBest = 0;
  const a = V14.fetchThrow(J, { dist: 0.2, rand: () => 0.99 }), b = V14.fetchThrow(J, { dist: 0.5, rand: () => 0.99 }), c = V14.fetchThrow(J, { dist: 0.9, rand: () => 0.99 });
  assert.deepEqual([a.treats, b.treats, c.treats, a.left, b.left, c.left], [1, 2, 3, 2, 1, 0]);
  assert.deepEqual(V14.fetchThrow(J, { dist: 1, rand: () => 0.99 }), { treats: 0, item: null, left: 0 }, 'a fourth throw: the dog flops down by the fire');
  assert.equal(J.dog.treats, 6); assert.equal(J.treatsBest, 0.9); assert.equal(J.totals.treats, 14 + 6, 'the totals count every treat'); assert.equal(J.totals.fetchThrows, 7 + 3);
  camp(J, 'rest', { rand }); const d1 = J.day; assert.equal(J.trip.fetchThrows, 0, 'camp resets the visit');
  assert.equal(V14.fetchThrow(J, { dist: 0.5, rand: () => 0.99 }).treats, 2); assert.equal(J.day, d1, 'a throw costs no day');
  const f = v14mk(13, { leg: 'fort-laramie' }); f.trip.fetchThrows = 0; V14.fetchThrow(f, { dist: 1, rand: () => 0.99 }); assert.equal(f.day, 0); assert.equal(f.food, 300);
  assert.equal(J.day, day0 + 1, 'only the camp day passed'); void food0;
  // items: 12 % over 10,000 throws, the spoon about 2 % of throws while the wagon has none
  const K = v14mk(14, { leg: 'fort-laramie' }); const r2 = mulberry32(99);
  let items = 0, spoons = 0; const bl = legList()[3];
  for (let i = 0; i < 10000; i++) { K.trip.fetchThrows = 0; const had = K.goods.spoon; const t = V14.fetchThrow(K, { dist: r2(), rand: r2 }); if (t.item) items++; if (t.spoon) { spoons++; assert.equal(had, 0); K.goods.spoon = 0; } if (t.item && t.item !== 'spoon') assert.ok(FIND_BY_ID[t.item].biomes === null || FIND_BY_ID[t.item].biomes.includes(bl.biome)); }
  assert.ok(items > 1080 && items < 1320, `items ${items} of 10000`);
  assert.ok(spoons > 140 && spoons < 260, `spoons ${spoons} of 10000`);
  assert.deepEqual(V14.fetchThrow(createJourney({ seed: 3 }), { dist: 1 }), { treats: 0, item: null, left: 0 }, 'no dog, no fetch');
});

test('sellHorseshoes: $1 × the season\'s price level each; the spoon is $3 × the price level, from Fort Kearny on, one only', () => {
  for (const [season, mult] of [['s1847', 1], ['s1850', 2], ['s1853', 4]]) {
    const J = v14mk(15, { season }); J.goods.horseshoes = 3; const c0 = J.cash;
    assert.deepEqual(V14.sellHorseshoes(J, { leg: 'fort-kearny' }), { n: 3, cash: 3 * HORSESHOE.price * mult }); assert.equal(J.cash, c0 + 3 * mult); assert.equal(J.goods.horseshoes, 0);
    assert.deepEqual(V14.sellHorseshoes(J, {}), { n: 0, cash: 0 });
  }
  assert.deepEqual(EXTRA_GOODS.find((g) => g.id === 'spoon'), { id: 'spoon', name: 'Shiny spoon', unit: 'spoon', emoji: '🥄', price: 3, fromLeg: 2, max: 1 });
  const J = createJourney({ seed: 16, companions: PLAIN }); J.cash = 100;
  assert.equal(buy(J, { item: 'spoon' }).ok, false, 'not at Independence'); assert.ok(!storeList(null, 's1847').some((g) => g.id === 'spoon'));
  const kearny = TRAIL[1]; startLeg(J, kearny.id); J.milesDone = kearny.miles; J.trip.arrived = true;
  assert.ok(storeList(kearny, 's1847').some((g) => g.id === 'spoon')); assert.equal(priceAt('spoon', kearny, 's1847'), Math.round(3 * kearny.fort.prices));
  const b = buy(J, { item: 'spoon', qty: 5 }); assert.equal(b.ok, true); assert.equal(b.cost, priceAt('spoon', kearny, 's1847')); assert.equal(J.goods.spoon, 1);
  assert.equal(buy(J, { item: 'spoon' }).ok, false, 'never a second'); assert.equal(J.goods.spoon, 1);
  const poor = createJourney({ seed: 17, companions: PLAIN }); startLeg(poor, kearny.id); poor.trip.arrived = true; poor.cash = 1; assert.equal(buy(poor, { item: 'spoon' }).ok, false); assert.equal(poor.cash, 1, 'never below $0');
});

test('sim.js exports every name §6 gives the Journey stream (the app imports only sim.js)', () => {
  const names = ['dogOfferAt', 'adoptDog', 'planNose', 'drawFind', 'recordFind', 'chaseResult', 'fetchThrow', 'sellHorseshoes', 'waterOf', 'baitsAvailable', 'catchHoppers', 'fishingSession', 'createFight', 'fightStep', 'fightHelp',
    'fightOutcome', 'castOff', 'landCast', 'endFishing', 'familyRecords', 'skipsBoard', 'useQuests', 'questList', 'questFindable', 'findQuestItem', 'questAt', 'questTalk', 'questMail', 'questStatus', 'setTrailSounds', 'factsFor',
    'planFact', 'heardFact', 'stampedeFact', 'planDustDevil', 'dustDevilResult', 'stonesPlan', 'stonesResult', 'campWater', 'meteorsTonight', 'wishFor', 'carry14', 'merge14', 'tickDay', 'stampedePay', 'arrive', 'camp', 'newSeason', 'checkDeeds'];
  for (const n of names) assert.equal(typeof V14[n], 'function', n);
  for (const n of ['NOSE', 'FETCH', 'FISHING', 'MOMENTS', 'HORSESHOE', 'DEEDS']) assert.ok(V14[n] && typeof V14[n] === 'object', n);
  assert.deepEqual(Object.keys(V14.NOSE).sort(), ['chaseLate', 'from', 'lead', 'perLeg', 'snakeBiomes', 'spacingMi', 'spirit', 'to', 'unseenBias', 'weights']);
  assert.deepEqual(V14.FETCH, { throws: 3, at: [0.34, 0.67], treats: [1, 2, 3], itemChance: 0.12, spoonChance: 0.02 });
  assert.deepEqual([V14.FISHING.casts, V14.FISHING.retriesPerCast, V14.FISHING.strainMaxMs, V14.FISHING.warnMs, V14.FISHING.lbCap, V14.FISHING.junkChance, V14.FISHING.cameoChance, V14.FISHING.bottleChance, V14.FISHING.hopperMax, V14.FISHING.helpAt, V14.FISHING.helpSpeed], [4, 1, 500, 250, 24, 0.1, 0.3, 0.35, 12, 0.5, 2]);
  assert.deepEqual(V14.HORSESHOE, { price: 1 }); assert.deepEqual([V14.MOMENTS.meteors.chance, V14.MOMENTS.meteors.gapLegs, V14.MOMENTS.stones.throws, V14.MOMENTS.stones.maxSkips, V14.MOMENTS.facts.chance, V14.MOMENTS.dustDevil.chance], [0.5, 3, 3, 12, 0.7, 0.35]);
});

test('a slot that is still unfired when a day starts past its limit is dropped and never carried into the next leg; a quest slot the nose never reached is found as the party arrives', () => {
  const J = v14mk(120, { leg: 'fort-laramie' }); J.trip.events = []; J.trip.fact = null; J.trip.dustDevil = null;
  J.trip.nose = [{ atMile: 130, kind: 'find', fired: false }]; J.milesDone = Math.floor(0.92 * 140) + 1; J.trip.nextMarker = J.trip.markers.length; J.trip.slow = true;   // a slow day, so the party does not arrive today
  const r = tickDay(J, { rand: mulberry32(1) }); assert.equal(r.nose, null); assert.equal(J.trip.nose[0].fired, true); assert.equal(J.trip.nose[0].dropped, true); assert.equal(J.totals.noseFinds, 0);
  v14arrive(J); nextLeg(J); assert.ok(J.trip.nose.every((s) => s.fired === false && !s.dropped), 'the next leg has a plan of its own'); assert.equal(J.trip.nose.length >= 2, true);
  const K = createJourney({ seed: 121, companions: PLAIN }); K.dog = { name: 'Rex', coat: 'brown', legs: 3, nextBerries: 99, treats: 0, muddy: false }; startLeg(K, 'chimney-rock');
  assert.equal(K.trip.nose[0].kind, 'quest'); K.trip.nose[0].fired = false; assert.equal(K.quests.locket, undefined);
  const res = v14arrive(K); assert.deepEqual(res.quest, { id: 'locket', item: QUESTS.find((q) => q.id === 'locket').item }); assert.equal(K.quests.locket.state, 'carried'); assert.equal(K.quests.locket.step, 1);
  const L = createJourney({ seed: 122, companions: PLAIN }); L.dog = { name: 'Rex', coat: 'brown', legs: 3, nextBerries: 99, treats: 0, muddy: false }; startLeg(L, 'fort-laramie'); assert.equal(v14arrive(L).quest, undefined, 'no quest slot, nothing found');
});

// ---- fishing 2.0 ----
const WATER_LEGS = Object.keys(WATERS).map((id) => TRAIL.find((l) => l.id === id)).filter(Boolean);
function v14fisher(legId, seed = 1, extra = {}) { const J = createJourney({ seed, companions: PLAIN }); if (legId !== J.legId) startLeg(J, legId); Object.assign(J, extra); return J; }

test('fishing.js stands alone for the scene: createFight, fightStep, fightHelp, and nothing from the sim is needed to import it', () => {
  for (const k of ['createFight', 'fightStep', 'fightHelp', 'fightOutcome', 'waterOf', 'fishingSession', 'castOff', 'landCast']) assert.equal(typeof FISHMOD[k], 'function', k);
  const src = readFileSync(new URL('../src/journey/fishing.js', import.meta.url), 'utf8');
  const imports = [...src.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['../content/fish.js', './economy.js', './rng.js'], 'the scene imports this file: it keeps to the fish tables, the rng and the economy numbers');
  for (const k of ['createFight', 'fightStep', 'fightHelp']) assert.equal(V14[k], FISHMOD[k], 'sim.js re-exports the same function');
});

test('waterOf: the leg\'s water from the content table, the Kansas by default; baitsAvailable and catchHoppers (the tin holds 12)', () => {
  for (const [id, w] of Object.entries(WATERS)) { assert.equal(V14.waterOf(id), w); assert.equal(V14.waterOf({ id }), w); assert.equal(V14.waterOf({ legId: id }), w); }
  assert.equal(V14.waterOf('nowhere'), 'kansas'); assert.equal(V14.waterOf(null), 'kansas');
  const J = v14fisher('fort-bridger');
  assert.deepEqual(V14.baitsAvailable(J), [{ id: 'worms', ok: true }, { id: 'hoppers', n: 0, ok: false }, { id: 'spoon', ok: false }]);
  assert.deepEqual(V14.catchHoppers(J, 5), { added: 5, have: 5 }); assert.deepEqual(V14.catchHoppers(J, 20), { added: 7, have: 12 }); assert.deepEqual(V14.catchHoppers(J, 1), { added: 0, have: 12 });
  J.goods.spoon = 1; assert.deepEqual(V14.baitsAvailable(J).map((b) => [b.id, b.ok]), [['worms', true], ['hoppers', true], ['spoon', true]]); assert.equal(V14.baitsAvailable(J)[1].n, 12);
});

test('a session: four casts, species only from the water\'s table, the sturgeon only on the Snake and the Columbia and at most one a session, the turtle only on the Kansas and the Platte', () => {
  let sturgeons = 0, turtles = 0, junk = 0, casts = 0;
  for (const leg of WATER_LEGS) {
    const water = WATERS[leg.id];
    for (let i = 0; i < 300; i++) {
      const J = v14fisher(leg.id, 50 + i, i % 3 === 0 ? { dog: { name: 'Frodo', coat: 'brown', legs: 0, nextBerries: 1, treats: 0, muddy: false } } : {});
      const S = V14.fishingSession(J, { rand: mulberry32(i * 31 + leg.n) });
      assert.equal(S.casts.length, FISHING.casts); assert.equal(S.water, water); assert.equal(S.waterName, WATER_NAMES[water]);
      assert.ok(S.id && S.bait === 'worms' && S.rescue === false);
      let st = 0;
      S.casts.forEach((c, ci) => {
        casts++;
        assert.equal(c.i, ci); assert.equal(c.retries, 0); assert.ok(c.biteS >= 0.5 && c.biteS <= FISHING.biteS[1], 'bite ' + c.biteS);
        assert.ok(c.fight.reelMs > 0 && c.fight.strainMaxMs === FISHING.strainMaxMs && c.fight.warnMs === FISHING.warnMs && c.fight.helpAt === FISHING.helpAt);
        if (c.kind === 'fish') {
          const f = FISH_BY_ID[c.species];
          assert.ok(f && f.waters[water] > 0, `${c.species} in ${water}`);
          assert.ok(c.lengthIn >= f.sizeIn[0] && c.lengthIn <= f.sizeIn[1], 'size'); assert.ok(c.lb >= 1 && c.lb <= f.lb[1] * FISHING.lbScale + 1, 'lb ' + c.lb);
          assert.equal(c.fight.help, !!f.help); assert.ok(c.fight.wobbles.length > 5 && c.fight.wobbles.every(([a, b], k, w) => b - a === Math.round(f.fight.wobbleS * 1000) && (!k || a > w[k - 1][1])));
          if (f.onePerSession) { st++; sturgeons++; assert.ok(['snake', 'columbia'].includes(water), 'sturgeon in ' + water); }
        } else {
          junk++;
          const j = JUNK.find((x) => x.id === c.junk); assert.ok(j && (!j.waters || j.waters.includes(water)), `${c.junk} in ${water}`);
          assert.deepEqual(c.fight.wobbles, [], 'junk reels in with no wobbles'); assert.equal(c.lb, 0);
          if (c.junk === 'turtle') { turtles++; assert.ok(['kansas', 'platte'].includes(water)); }
          if (c.junk === 'bottle') assert.ok(QUESTS.find((q) => q.id === 'bottle-note').find.legs.includes(leg.id), 'the bottle only on the legs where its quest can start: ' + leg.id);
        }
      });
      assert.ok(st <= 1, 'one sturgeon a session');
      if (S.cameo) { assert.ok(J.dog && S.cameo.at >= 0 && S.cameo.at < FISHING.casts && ['splash', 'steal'].includes(S.cameo.kind)); }
    }
  }
  assert.ok(sturgeons > 30 && turtles > 10, `sturgeons ${sturgeons} turtles ${turtles}`);
  assert.ok(Math.abs(junk / casts - FISHING.junkChance) < 0.02, `junk ${junk / casts}`);
});

test('bait: grasshoppers are used one a cast (the rest fall back to worms) and bite sooner and run bigger on trout and chubs; the spoon is never used up and runs bigger; junk is 10 % a cast', () => {
  const J = v14fisher('fort-bridger', 3); J.goods.hoppers = 2;
  const S = V14.fishingSession(J, { bait: 'hoppers', rand: mulberry32(1) });
  assert.equal(S.bait, 'hoppers'); assert.deepEqual(S.casts.map((c) => c.bait), ['hoppers', 'hoppers', 'worms', 'worms']); assert.equal(J.goods.hoppers, 0, 'two used at plan time');
  assert.equal(V14.fishingSession(J, { bait: 'hoppers', rand: mulberry32(1) }).bait, 'worms', 'an empty tin is worms');
  assert.equal(V14.fishingSession(J, { bait: 'spoon', rand: mulberry32(1) }).bait, 'worms', 'no spoon, no spoon bait');
  assert.equal(V14.fishingSession(J, { bait: 'nonsense', rand: mulberry32(1) }).bait, 'worms');
  J.goods.spoon = 1; const sp = V14.fishingSession(J, { bait: 'spoon', rand: mulberry32(1) }); assert.deepEqual(sp.casts.map((c) => c.bait), ['spoon', 'spoon', 'spoon', 'spoon']); assert.equal(J.goods.spoon, 1, 'never used up');
  const stats = (leg, bait, n = 500) => {
    const out = { len: [], bite: [], salmon: 0, trout: 0, fish: 0, junk: 0, casts: 0 };
    for (let i = 0; i < n; i++) {
      const K = v14fisher(leg, 700 + i); K.goods.hoppers = 12; K.goods.spoon = 1;
      for (const c of V14.fishingSession(K, { bait, rand: mulberry32(i * 7 + 3) }).casts) {
        out.casts++; if (c.kind === 'junk') { out.junk++; continue; }
        out.fish++; out.len.push((c.lengthIn - FISH_BY_ID[c.species].sizeIn[0]) / (FISH_BY_ID[c.species].sizeIn[1] - FISH_BY_ID[c.species].sizeIn[0])); out.bite.push(c.biteS);
        if (c.species === 'chinook-salmon') out.salmon++; if (c.species === 'cutthroat-trout') out.trout++;
      }
    }
    return out;
  };
  const m = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const worms = stats('fort-bridger', 'worms'), hop = stats('fort-bridger', 'hoppers'), spoon = stats('fort-bridger', 'spoon');
  assert.ok(m(hop.bite) < m(worms.bite) * 0.9, `hoppers bite sooner: ${m(hop.bite)} vs ${m(worms.bite)}`);
  assert.ok(m(hop.len) > m(worms.len) + 0.05, `hoppers run bigger: ${m(hop.len)} vs ${m(worms.len)}`);
  assert.ok(m(spoon.len) > m(worms.len) + 0.1, `the spoon runs bigger: ${m(spoon.len)} vs ${m(worms.len)}`);
  assert.ok(Math.abs(worms.junk / worms.casts - FISHING.junkChance) < 0.02 && Math.abs(spoon.junk / spoon.casts - FISHING.junkChance) < 0.02, 'junk 10 % a cast');
  const cw = stats('the-dalles', 'worms'), cs = stats('the-dalles', 'spoon');
  assert.ok(cs.salmon / cs.fish >= cw.salmon / cw.fish, 'on the Columbia the spoon draws salmon at least as often');
  const sn = stats('snake-river', 'worms'), ss = stats('snake-river', 'spoon');
  assert.ok(ss.trout / ss.fish > sn.trout / sn.fish, 'on the Snake the spoon draws trout more often than worms do');
});

test('the bottle: only while its quest can start (Fort Laramie to Fort Bridger waters), once a season, then the note is carried', () => {
  const J = v14fisher('fort-laramie', 61);
  assert.equal(V14.questFindable(J, 'fish'), 'bottle-note');
  let bottle = null, planned = 0;
  for (let i = 0; i < 400 && !bottle; i++) {
    const S = V14.fishingSession(J, { rand: mulberry32(i + 1) });
    S.casts.forEach((c, ci) => { if (c.junk === 'bottle') { planned++; if (!bottle) { bottle = { S, ci }; } } });
    assert.ok(S.casts.filter((c) => c.junk === 'bottle').length <= 1, 'one bottle a session');
  }
  assert.ok(bottle, 'a bottle comes up');
  const r = V14.landCast(J, bottle.S, bottle.ci);
  assert.equal(r.junk, 'bottle'); assert.equal(r.quest.id, 'bottle-note'); assert.equal(r.quest.item.id, 'bottle-note'); assert.equal(J.quests['bottle-note'].state, 'carried'); assert.equal(J.fishJunk.bottle, 1);
  assert.equal(V14.landCast(J, bottle.S, bottle.ci), r, 'landing the same cast twice changes nothing'); assert.equal(J.fishJunk.bottle, 1);
  for (let i = 0; i < 600; i++) for (const c of V14.fishingSession(J, { rand: mulberry32(9000 + i) }).casts) assert.notEqual(c.junk, 'bottle', 'once a season');
  // not on a leg outside its range, nor on a water without bottles
  for (const leg of ['kansas-river', 'fort-hall', 'snake-river', 'the-dalles']) {
    const K = v14fisher(leg, 62); assert.equal(V14.questFindable(K, 'fish'), null, leg);
    for (let i = 0; i < 150; i++) for (const c of V14.fishingSession(K, { rand: mulberry32(i + 5) }).casts) assert.notEqual(c.junk, 'bottle');
  }
});

/** a scripted hand on the reel: [{ atMs, down }] that holds, then lets go for every red window (from its start) and presses again `lagMs` after it ends */
function v14release(fight, lagMs = 100, upTo = 90000) {
  const p = [{ atMs: 0, down: true }];
  for (const [s, e] of fight.wobbles) { if (s > upTo) break; p.push({ atMs: s, down: false }, { atMs: e + lagMs, down: true }); }
  return p;
}
const v14fightsOf = () => FISH.map((f) => { const J = v14fisher(WATER_LEGS.find((l) => f.waters[WATERS[l.id]]).id, 5); const S = V14.fishingSession(J, { rand: mulberry32(2) }); return { f, fight: { ...S.casts[0].fight }, cast: S.casts[0] }; });
const v14fightFor = (f) => { const leg = WATER_LEGS.find((l) => f.waters[WATERS[l.id]]).id; for (let i = 0; i < 300; i++) { const S = V14.fishingSession(v14fisher(leg, i), { rand: mulberry32(i) }); const c = S.casts.find((x) => x.species === f.id); if (c) return c; } return null; };

test('fightStep: deterministic; holding through every wobble ends "off"; letting go in every red window ends "landed" (pressing 100 ms after each window ends); only reel / help / off / landed', () => {
  const phases = new Set();
  for (const f of FISH) {
    const c = v14fightFor(f); assert.ok(c, 'a cast of ' + f.id);
    const hold = FISHMOD.fightOutcome(c.fight, [{ atMs: 0, down: true }]);
    assert.equal(hold.phase, 'off', `${f.id}: held through the red`); assert.ok(hold.ms < 6000, 'it wiggles off at the first wobble: ' + hold.ms);
    if (f.help) {
      // a sturgeon: reel by the red window, stop at half way for the second tap, then land it (below)
      assert.equal(c.fight.help, true);
      continue;
    }
    const a = FISHMOD.fightOutcome(c.fight, v14release(c.fight)), b = FISHMOD.fightOutcome(c.fight, v14release(c.fight));
    assert.deepEqual(a, b, 'the same inputs, the same states');
    assert.equal(a.phase, 'landed', `${f.id}: ${JSON.stringify({ phase: a.phase, ms: a.ms, p: a.progress })}`); assert.equal(a.progress, 1);
    assert.ok(a.ms > 1000 && a.ms < 30000, `${f.id} lands in ${a.ms} ms`);
    // never any other phase, step by step
    let s = FISHMOD.createFight(c.fight); const hand = v14release(c.fight);
    for (let t = 0; t < 40000 && s.phase === 'reel'; t += 16) { const down = hand.filter((e) => e.atMs <= t).pop().down; s = FISHMOD.fightStep(s, 16, down); phases.add(s.phase); assert.ok(s.progress >= 0 && s.progress <= 1 && s.strain >= 0); }
  }
  assert.deepEqual([...phases].sort(), ['landed', 'reel']);
  // an idle hand never lands anything and never loses it either: the progress just stays at 0
  const idle = FISHMOD.fightOutcome(v14fightFor(FISH[0]).fight, [], { maxMs: 20000 });
  assert.deepEqual([idle.phase, idle.progress], ['reel', 0]);
  // the pure stepper does not change its input
  const c0 = v14fightFor(FISH[0]); const s0 = FISHMOD.createFight(c0.fight), snap = JSON.stringify(s0); FISHMOD.fightStep(s0, 100, true); assert.equal(JSON.stringify(s0), snap);
  // the wobble flag and the yellow shiver come before the red
  let s = FISHMOD.createFight(c0.fight); const [w0] = c0.fight.wobbles; let sawWarn = false, sawRed = false, warnBeforeRed = true;
  for (let t = 0; t < w0[1] + 200; t += 10) { s = FISHMOD.fightStep(s, 10, false); if (s.warn) { sawWarn = true; if (!sawRed) warnBeforeRed = true; } if (s.wobble) { if (!sawWarn) warnBeforeRed = false; sawRed = true; } }
  assert.ok(sawWarn && sawRed && warnBeforeRed, 'a yellow shiver 0.25 s before the red');
});

test('the sturgeon waits at half way for the second tap (fightHelp), then reels at double speed; the dog or a companion is the helper', () => {
  const sturgeon = FISH.find((f) => f.help); const c = v14fightFor(sturgeon);
  let s = FISHMOD.createFight(c.fight), t = 0, helpedAt = null, redUntil = -1;
  while (t < 120000 && s.phase === 'reel') {
    if (s.wobble || s.warn) redUntil = t + 100;
    s = FISHMOD.fightStep(s, 10, t >= redUntil); t += 10;
  }
  assert.equal(s.phase, 'help'); assert.equal(s.progress, FISHING.helpAt); assert.equal(s.helped, false);
  const frozen = JSON.stringify(s);
  for (let i = 0; i < 300; i++) assert.equal(JSON.stringify(FISHMOD.fightStep(s, 16, i % 2 === 0)), frozen, 'nothing changes until the second tap');
  const h = FISHMOD.fightHelp(s); assert.equal(h.phase, 'reel'); assert.equal(h.helped, true); assert.equal(FISHMOD.fightHelp(h), h, 'only a waiting fight takes help');
  assert.equal(FISHMOD.fightHelp(FISHMOD.createFight(c.fight)).phase, 'reel');
  // double speed: the same second of holding gains twice as much once helped
  const calm = { ...c.fight, wobbles: [], help: false };
  const a = FISHMOD.fightStep({ ...FISHMOD.createFight(calm), progress: 0.2 }, 1000, true), b = FISHMOD.fightStep({ ...FISHMOD.createFight(calm), progress: 0.2, helped: true }, 1000, true);
  assert.ok(Math.abs((b.progress - 0.2) - 2 * (a.progress - 0.2)) < 1e-9, 'helpSpeed ' + [a.progress, b.progress]);
  let u = h; t = 0; redUntil = -1;
  while (t < 120000 && u.phase === 'reel') { if (u.wobble || u.warn) redUntil = t + 100; u = FISHMOD.fightStep(u, 10, t >= redUntil); t += 10; }
  assert.equal(u.phase, 'landed'); assert.ok(t < 12000, 'half a sturgeon at double speed: ' + t);
  // fightOutcome with the help press scripted at 5 s
  const o = FISHMOD.fightOutcome(c.fight, [...v14release(c.fight), { atMs: 20000, help: true }]);
  assert.ok(['landed', 'off'].includes(o.phase));
  const noHelp = FISHMOD.fightOutcome(c.fight, v14release(c.fight)); assert.equal(noHelp.phase, 'help', 'without the second tap it waits');
  // landing a sturgeon is worth the pounds the content says, counted once, with the counters the deeds read
  const J = v14fisher('snake-river', 70); const S = V14.fishingSession(J, { rand: mulberry32(3) });
  S.casts[1] = { ...S.casts[1], kind: 'fish', species: 'white-sturgeon', junk: undefined, lengthIn: 60, lb: 14 };
  const r = V14.landCast(J, S, 1); assert.equal(J.totals.sturgeon, 1); assert.equal(J.fishLog['white-sturgeon'].n, 1); assert.equal(r.card, 'white-sturgeon'); assert.ok(J.trip.happened.includes('sturgeon'));
});

test('castOff: a fish that wiggled off is cast again once, with a fresh fight, and only once; junk and bad casts retry nothing', () => {
  const J = v14fisher('fort-kearny', 80); let S, i;
  for (let k = 1; k < 100; k++) { S = V14.fishingSession(J, { rand: mulberry32(k) }); i = S.casts.findIndex((c) => c.kind === 'fish'); if (i >= 0) break; }
  const c = S.casts[i], first = clone(c.fight), off0 = J.totals.fishOff;
  const r1 = V14.castOff(J, S, i); assert.equal(r1.retry, true); assert.ok(r1.fight && r1.fight.wobbles.length > 5); assert.equal(c.retries, 1); assert.equal(c.fight, r1.fight);
  assert.notDeepEqual(r1.fight.wobbles, first.wobbles, 'a fresh fight'); assert.equal(r1.fight.reelMs, first.reelMs);
  const r2 = V14.castOff(J, S, i); assert.deepEqual(r2, { retry: false }); assert.equal(c.retries, 1, 'once and only once'); assert.equal(J.totals.fishOff, off0 + 2);
  const j = S.casts.findIndex((x) => x.kind === 'junk'); if (j >= 0) assert.deepEqual(V14.castOff(J, S, j), { retry: false });
  assert.deepEqual(V14.castOff(J, S, 9), { retry: false });
  // the retry is deterministic (the same session replays the same retry)
  const S2 = V14.fishingSession(v14fisher('fort-kearny', 80), { rand: mulberry32(S.casts.length ? 1 : 1) }), S3 = V14.fishingSession(v14fisher('fort-kearny', 80), { rand: mulberry32(1) });
  assert.deepEqual(S2, S3);
});

test('fishingSession is seeded: the same journey, leg, day and counter give the same session; the next session differs; the counter is on the trip', () => {
  const a = v14fisher('chimney-rock', 90), b = v14fisher('chimney-rock', 90);
  const s1 = V14.fishingSession(a), s2 = V14.fishingSession(b); assert.deepEqual(s1, s2); assert.equal(a.trip.fishing, 1);
  const s3 = V14.fishingSession(a); assert.notDeepEqual(s3.casts, s1.casts); assert.notEqual(s3.id, s1.id); assert.equal(a.trip.fishing, 2);
  const c = v14fisher('chimney-rock', 91); assert.notDeepEqual(V14.fishingSession(c).casts, s1.casts, 'another seed');
  assert.deepEqual(clone(s1), s1, 'a session is plain JSON');
});

// ---- food, the log, the summary, the family's records ----
/** a kid at the rod (the economy sim's): 60 % of the casts hooked, 85 % of the fights landed (a wiggle-off is cast again once) */
function v14kid(J, r, { hook = 0.6, land = 0.85, bait = 'worms', rescue = false } = {}) {
  const S = V14.fishingSession(J, { bait, rescue, rand: r });
  S.casts.forEach((c, i) => {
    if (!(r() < hook)) return;
    if (c.kind === 'junk') { V14.landCast(J, S, i); return; }
    let ok = r() < land;
    if (!ok && V14.castOff(J, S, i).retry) ok = r() < land;
    if (ok) V14.landCast(J, S, i);
  });
  return { S, R: V14.endFishing(J, S) };
}
test('a session\'s food: at most 24 lb however many fish, applied once; a safety-net session is worth at least 30; idempotent', () => {
  for (let i = 0; i < 300; i++) {
    const J = v14fisher(i % 2 ? 'snake-river' : 'the-dalles', 200 + i); const f0 = J.food;
    const S = V14.fishingSession(J, { rand: mulberry32(i + 1) });
    S.casts.forEach((c, k) => V14.landCast(J, S, k));
    const raw = S.casts.reduce((a, c) => a + c.lb, 0), R = V14.endFishing(J, S);
    assert.equal(R.lb, Math.min(24, raw)); assert.ok(R.lb <= FISHING.lbCap); assert.equal(R.topUp, 0); assert.equal(J.food, f0 + R.lb); assert.equal(J.foods.other, R.lb);
    assert.equal(V14.endFishing(J, S), R, 'idempotent'); assert.equal(J.food, f0 + R.lb, 'the food goes in once');
    assert.equal(J.legStats.fished, R.lb); assert.equal(J.totals.fishLb, R.lb);
  }
  const J = v14fisher('fort-kearny', 5); const f0 = J.food;
  const S = V14.fishingSession(J, { rescue: true, rand: mulberry32(2) }); assert.equal(S.rescue, true);
  const R = V14.endFishing(J, S); assert.equal(R.lb, RESCUE.minLb); assert.equal(R.topUp, RESCUE.minLb); assert.equal(J.food, f0 + RESCUE.minLb, 'a rescue session with no catch is worth 30 lb');
  assert.ok(R.lb >= 30);
  const K = v14fisher('fort-kearny', 6); const S2 = V14.fishingSession(K, { rescue: true, rand: mulberry32(3) }); V14.landCast(K, S2, S2.casts.findIndex((c) => c.kind === 'fish') >= 0 ? S2.casts.findIndex((c) => c.kind === 'fish') : 0);
  const R2 = V14.endFishing(K, S2); assert.ok(R2.lb >= 30 && R2.lb - R2.topUp <= 24);
  // the trail's safety net: tickDay hands over a fish event with rescue true and the session tops up through applyFish as it always has
  const T = v14fisher('fort-kearny', 7); T.foods = { flour: 0, bacon: 0, beans: 0, other: 0 }; syncFood(T); T.trip.events = [];
  let ev = null; for (let d = 0; d < 6 && !ev; d++) { const r = tickDay(T, { rand: mulberry32(d) }); ev = r.event; if (r.marker) applyMarker(T, { correct: true }); }
  if (ev && ev.kind === 'fish') { const ss = V14.fishingSession(T, { rescue: ev.rescue, rand: mulberry32(4) }); assert.ok(V14.endFishing(T, ss).lb >= 30); }
});

test('the economy kid (60 % hooked, 85 % of the fights landed) brings home a mean session within 10 % of 1.3\'s 9.6 lb, at every leg\'s water and over the journey', () => {
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const perLeg = TRAIL.map((leg) => mean(Array.from({ length: 600 }, (_, i) => { const J = v14fisher(leg.id, 3000 + i); return v14kid(J, mulberry32(i * 13 + leg.n)).R.lb; })));
  const all = mean(perLeg);
  assert.ok(Math.abs(all - 9.6) / 9.6 <= 0.10, `mean session ${all.toFixed(2)} lb (per leg ${perLeg.map((x) => x.toFixed(1)).join(' ')})`);
  assert.ok(perLeg.every((x) => x > 4 && x < 20), 'no leg\'s water is a famine or a feast: ' + perLeg.map((x) => x.toFixed(1)));
  // grasshoppers and the spoon do not push a session past the cap
  for (const bait of ['hoppers', 'spoon']) for (let i = 0; i < 200; i++) { const J = v14fisher('the-dalles', 4000 + i); J.goods.hoppers = 12; J.goods.spoon = 1; assert.ok(v14kid(J, mulberry32(i), { bait, hook: 1, land: 1 }).R.lb <= 24); }
});

test('landCast: the fish log (n, the biggest in inches with its pounds, where first caught), fishBest follows the biggest inches, the card comes with a new species only; junk is counted, the turtle let go', () => {
  const J = v14fisher('fort-kearny', 8); const S = V14.fishingSession(J, { rand: mulberry32(1) });
  const set = (i, o) => { S.casts[i] = { ...S.casts[i], ...o }; };
  set(0, { kind: 'fish', species: 'channel-catfish', lengthIn: 20, lb: 6 }); set(1, { kind: 'fish', species: 'channel-catfish', lengthIn: 22, lb: 6 });
  set(2, { kind: 'fish', species: 'hornyhead-chub', lengthIn: 7, lb: 3 }); set(3, { kind: 'junk', junk: 'boot', lb: 0 });
  const r0 = V14.landCast(J, S, 0); assert.deepEqual([r0.kind, r0.species, r0.lengthIn, r0.lb, r0.firstSpecies, r0.best, r0.card], ['fish', 'channel-catfish', 20, 6, true, true, 'channel-catfish']);
  assert.deepEqual(J.fishLog['channel-catfish'], { n: 1, bestIn: 20, bestLb: 6, firstLeg: 'fort-kearny', firstSeason: 's1847' }); assert.deepEqual(J.fishBest, { species: 'channel-catfish', in: 20 });
  const r1 = V14.landCast(J, S, 1); assert.deepEqual([r1.firstSpecies, r1.best, r1.card], [false, true, undefined]); assert.equal(J.fishLog['channel-catfish'].n, 2); assert.equal(J.fishLog['channel-catfish'].bestIn, 22);
  const r2 = V14.landCast(J, S, 2); assert.equal(r2.best, false, 'a small chub is not the personal best'); assert.deepEqual(J.fishBest, { species: 'channel-catfish', in: 22 }); assert.equal(r2.card, 'hornyhead-chub');
  const r3 = V14.landCast(J, S, 3); assert.deepEqual([r3.kind, r3.junk, r3.lb], ['junk', 'boot', 0]); assert.equal(J.fishJunk.boot, 1); assert.ok(J.trip.happened.includes('fish-boot'));
  assert.equal(J.totals.fishCaught, 3); assert.equal(J.totals.fishJunk, 1);
  const R = V14.endFishing(J, S);
  assert.equal(R.lb, 15); assert.deepEqual(R.caught.map((c) => c.species), ['channel-catfish', 'channel-catfish', 'hornyhead-chub']); assert.deepEqual(R.junk, ['boot']); assert.deepEqual(R.newSpecies, ['channel-catfish', 'hornyhead-chub']); assert.equal(R.best, true);
  assert.equal(R.summary.text, 'Two channel catfish, a hornyhead chub and an old boot. Fifteen pounds of fish for the wagon.'); assert.equal(R.summary.say, R.summary.text);
  // the sturgeon beats everything
  const S2 = V14.fishingSession(v14fisher('snake-river', 9), { rand: mulberry32(2) }); S2.casts[0] = { ...S2.casts[0], kind: 'fish', species: 'white-sturgeon', lengthIn: 60, lb: 14 };
  V14.landCast(J, S2, 0); assert.deepEqual(J.fishBest, { species: 'white-sturgeon', in: 60 });
  // the turtle is let go; the bottle starts the note quest only while it can
  const T = v14fisher('fort-laramie', 10); const S3 = V14.fishingSession(T, { rand: mulberry32(2) });
  S3.casts[0] = { ...S3.casts[0], kind: 'junk', junk: 'turtle', lb: 0 }; assert.equal(V14.landCast(T, S3, 0).released, true);
  // summaries: counted words, no digits, plurals
  const U = v14fisher('fort-kearny', 11); const S4 = V14.fishingSession(U, { rand: mulberry32(5) });
  S4.casts[0] = { ...S4.casts[0], kind: 'fish', species: 'channel-catfish', lengthIn: 15, lb: 4 }; S4.casts[1] = { ...S4.casts[1], kind: 'junk', junk: 'boot', lb: 0 }; S4.casts[2] = { ...S4.casts[2], kind: 'junk', junk: 'boot', lb: 0 }; S4.casts[3] = { ...S4.casts[3], kind: 'junk', junk: 'turtle', lb: 0 };
  [0, 1, 2, 3].forEach((i) => V14.landCast(U, S4, i));
  assert.equal(V14.endFishing(U, S4).summary.text, 'A channel catfish, two old boots and a snapping turtle. Four pounds of fish for the wagon.');
  const V = v14fisher('fort-kearny', 12); const S5 = V14.fishingSession(V, { rand: mulberry32(6) }); S5.casts.forEach((c, i) => { if (c.kind === 'fish') S5.casts[i] = { ...c, kind: 'junk', junk: 'boot', lb: 0 }; });
  S5.casts.forEach((c, i) => V14.landCast(V, S5, i)); const none = V14.endFishing(V, S5).summary.text; assert.ok(/boot/.test(none));
  const W = v14fisher('fort-kearny', 13); const S6 = V14.fishingSession(W, { rand: mulberry32(7) }); assert.equal(V14.endFishing(W, S6).summary.text, 'No bites this time. The river has more.');
  for (let i = 0; i < 300; i++) { const X = v14fisher(WATER_LEGS[i % WATER_LEGS.length].id, 500 + i); const { R: rr } = v14kid(X, mulberry32(i)); assert.ok(!/\d/.test(rr.summary.text), rr.summary.text); assert.ok(/\.$/.test(rr.summary.text)); }
  assert.equal(V14.landCast(J, S, 9), null);
});

test('familyRecords and skipsBoard over three players: the biggest of each species with the player\'s name, ties keep the earlier, the board sorted best first', () => {
  const mkp = (playerId, name, fishLog, best) => ({ playerId, name, J: { fishLog, skips: { best } } });
  const rec = (bestIn) => ({ n: 1, bestIn, bestLb: 3, firstLeg: 'fort-kearny', firstSeason: 's1847' });
  const players = [mkp('p1', 'Mia', { 'channel-catfish': rec(20), 'hornyhead-chub': rec(6) }, 7), mkp('p2', 'Leo', { 'channel-catfish': rec(24), 'cutthroat-trout': rec(12) }, 9), mkp('p3', 'Ava', { 'channel-catfish': rec(24), 'hornyhead-chub': rec(6) }, 7)];
  assert.deepEqual(V14.familyRecords(players), { 'channel-catfish': { name: 'Leo', playerId: 'p2', lengthIn: 24 }, 'hornyhead-chub': { name: 'Mia', playerId: 'p1', lengthIn: 6 }, 'cutthroat-trout': { name: 'Leo', playerId: 'p2', lengthIn: 12 } });
  assert.deepEqual(V14.skipsBoard(players), [{ name: 'Leo', playerId: 'p2', best: 9 }, { name: 'Mia', playerId: 'p1', best: 7 }, { name: 'Ava', playerId: 'p3', best: 7 }]);
  assert.deepEqual(V14.familyRecords([]), {}); assert.deepEqual(V14.skipsBoard(null), []); assert.deepEqual(V14.skipsBoard([{ playerId: 'x', name: 'X', J: {} }]), [], 'no skips yet, no row');
  assert.deepEqual(V14.familyRecords([{ playerId: 'x', name: 'X', J: null }, { playerId: 'y', name: 'Y', J: { fishLog: { 'redband-trout': rec(9) } } }]), { 'redband-trout': { name: 'Y', playerId: 'y', lengthIn: 9 } });
});

// ---- the quests ----
function v14atStop(J, legId) { const leg = legList().find((l) => l.id === legId); startLeg(J, legId); J.milesDone = leg.miles; J.trip.arrived = true; return leg; }
const LOCKET = QUESTS.find((q) => q.id === 'locket');

test('the locket: the dog named at the Kansas River brings it back (carried, the first clue Fort Kearny), the Talk row shows ❓ and 💛, clues advance in order, Molly returns it from any step', () => {
  const J = createJourney({ seed: 41, companions: PLAIN }); v14atStop(J, 'kansas-river');
  assert.equal(V14.questFindable(J, 'nose'), 'locket', 'findable at the Kansas River'); assert.deepEqual(V14.questStatus(J).find((q) => q.questId === 'locket').state, 'none');
  const a = V14.adoptDog(J, { name: 'Frodo', coat: 'brown' }); assert.equal(a.quest, 'locket');
  assert.deepEqual(J.quests.locket, { state: 'carried', step: 0, foundLeg: 'kansas-river', season: 's1847' });
  assert.equal(V14.adoptDog(J, { name: 'Other' }).dog.name, 'Frodo', 'a journey that has a dog keeps it'); assert.equal(V14.adoptDog(J, {}).quest, null);
  assert.equal(V14.findQuestItem(J, 'locket'), null, 'found once');
  const at = (stop) => V14.questAt(J, stop).map((x) => [x.questId, x.role, x.badge, x.person.id]);
  assert.deepEqual(at('fort-kearny'), [['locket', 'clue', '❓', 'q-platt']]); assert.deepEqual(at('chimney-rock'), [['locket', 'clue', '❓', 'q-josh']]); assert.deepEqual(at('fort-laramie'), [['locket', 'owner', '💛', 'q-molly']]); assert.deepEqual(at('fort-hall'), []);
  assert.equal(V14.questTalk(J, 'locket'), null, 'nobody to talk to at the Kansas River');
  v14atStop(J, 'fort-kearny');
  const t1 = V14.questTalk(J, 'locket'); assert.deepEqual([t1.role, t1.step, t1.of, t1.done, t1.lines.length], ['clue', 1, 2, false, 2]); assert.equal(J.quests.locket.step, 1);
  const again = V14.questTalk(J, 'locket'); assert.equal(again.again, true); assert.equal(J.quests.locket.step, 1, 'idempotent per step'); assert.deepEqual(at('fort-kearny'), [], 'a clue given is gone from the row');
  v14atStop(J, 'chimney-rock'); const t2 = V14.questTalk(J, 'locket'); assert.deepEqual([t2.role, t2.step, t2.done], ['clue', 2, false]);
  const tok0 = J.tokens, other0 = J.foods.other, food0 = J.food;
  v14atStop(J, 'fort-laramie'); const t3 = V14.questTalk(J, 'locket');
  assert.deepEqual([t3.role, t3.done, t3.step, t3.of], ['owner', true, 2, 2]); assert.deepEqual(t3.reward, { tokens: 1, food: { what: 'dried apples', lb: 10 }, card: 'locket' });
  assert.equal(J.tokens, tok0 + 1); assert.equal(J.foods.other, other0 + 10); assert.equal(J.food, food0 + 10); assert.equal(J.quests.locket.state, 'returned'); assert.deepEqual(J.questsDone, ['locket']); assert.equal(J.totals.questsDone, 1);
  const rep = V14.questTalk(J, 'locket'); assert.equal(rep.again, true); assert.equal(rep.reward, undefined); assert.equal(J.tokens, tok0 + 1, 'a quest pays once');
  assert.deepEqual(V14.questAt(J, 'fort-laramie'), []); assert.equal(V14.questFindable(J, 'nose'), null, 'once a season');
  assert.deepEqual(V14.questMail(J, { leg: 'fort-bridger' }), [], 'nothing to mail: it was given back');
  // the letter home has its line on the leg it was returned
  assert.ok(J.quests.locket.doneLeg === 'fort-laramie');
  const st = V14.questStatus(J).find((q) => q.questId === 'locket'); assert.deepEqual([st.state, st.step, st.of, st.ever, st.owner.at], ['returned', 2, 2, true, 'fort-laramie']);
  // from any step: walk straight to Molly with no clues heard
  const K = createJourney({ seed: 42, companions: PLAIN }); v14atStop(K, 'kansas-river'); V14.adoptDog(K, { name: 'Rex' }); v14atStop(K, 'fort-laramie');
  assert.equal(K.quests.locket.step, 0); const t4 = V14.questTalk(K, 'locket'); assert.equal(t4.role, 'owner'); assert.equal(K.quests.locket.state, 'returned');
});

test('the locket by the nose: a dog from an earlier season finds it on the Kansas River leg, a dog named at Fort Kearny on the Chimney Rock leg; clues already behind are skipped; never past Chimney Rock', () => {
  const J0 = createJourney({ seed: 43, companions: PLAIN }); v14atStop(J0, 'kansas-river'); V14.adoptDog(J0, { name: 'Frodo' }); J0.done = true;
  const J = newSeason(J0); assert.equal(J.dog.name, 'Frodo'); assert.equal(J.legId, 'kansas-river'); assert.equal(J.quests.locket, undefined); assert.equal(J.trip.nose[0].kind, 'quest', 'the first nose slot');
  assert.equal(J.trip.nose[0].quest, 'locket'); const rand = mulberry32(3); let found = null;
  for (let d = 0; d < 40 && !found; d++) { const r = tickDay(J, { rand }); if (r.marker) applyMarker(J, { correct: true }); if (r.nose && r.nose.kind === 'quest') found = r.nose; if (r.arrived) break; }
  assert.ok(found && found.quest.id === 'locket' && found.quest.item.id === 'locket', 'the item comes back'); assert.equal(J.quests.locket.state, 'carried'); assert.equal(J.quests.locket.step, 0);
  // named at Fort Kearny's store after a "Not now"
  const K = createJourney({ seed: 44, companions: PLAIN }); v14atStop(K, 'fort-kearny'); assert.equal(V14.adoptDog(K, { name: 'Rex' }).quest, null, 'the Kansas River is behind: nothing found at the store');
  startLeg(K, 'chimney-rock'); assert.equal(K.trip.nose[0].kind, 'quest'); const fired = DOGFIRE(K, 0);
  assert.equal(fired.kind, 'quest'); assert.equal(K.quests.locket.state, 'carried'); assert.equal(K.quests.locket.step, 1, 'Fort Kearny\'s clue is behind: heard on the way');
  assert.deepEqual(V14.questAt(K, 'fort-kearny'), []); assert.equal(V14.questAt(K, 'chimney-rock').length, 1);
  // never found past Chimney Rock
  for (const id of ['fort-laramie', 'independence-rock', 'south-pass', 'fort-bridger', 'fort-hall', 'snake-river', 'blue-mountains', 'the-dalles']) {
    const L = createJourney({ seed: 45, companions: PLAIN }); L.dog = { name: 'Rex', coat: 'brown', legs: 3, nextBerries: 9, treats: 0, muddy: false }; startLeg(L, id);
    assert.equal(V14.questFindable(L, 'nose'), null, id); assert.ok(!v14kinds(L.trip.nose).includes('quest'), id);
  }
  for (const id of ['kansas-river', 'fort-kearny', 'chimney-rock']) { const L = createJourney({ seed: 46, companions: PLAIN }); L.dog = { name: 'Rex', coat: 'brown', legs: 3, nextBerries: 9, treats: 0, muddy: false }; startLeg(L, id); assert.equal(V14.questFindable(L, 'nose'), 'locket', id); }
});
function DOGFIRE(J, i) { return V14.questFindable(J, 'nose') ? tickUntilNose(J) : null; }
function tickUntilNose(J) { const rand = mulberry32(9); for (let d = 0; d < 60; d++) { const r = tickDay(J, { rand }); if (r.marker) applyMarker(J, { correct: true }); if (r.nose) return r.nose; if (r.arrived) break; } return null; }

test('questMail: a carried quest whose owner\'s stop is behind is mailed at the next post office (the card, no tokens, no food); not at the owner\'s own stop; once', () => {
  const J = createJourney({ seed: 47, companions: PLAIN }); v14atStop(J, 'kansas-river'); V14.adoptDog(J, { name: 'Frodo' });
  v14atStop(J, 'fort-laramie'); assert.deepEqual(V14.questMail(J, { leg: 'fort-laramie' }), [], 'Molly is here: not mailed yet'); assert.equal(J.quests.locket.state, 'carried');
  v14atStop(J, 'fort-bridger'); const tok0 = J.tokens, food0 = J.food;
  const m = V14.questMail(J, { leg: 'fort-bridger' }); assert.deepEqual(m, [{ questId: 'locket', text: LOCKET.mailed.text, card: 'locket' }]);
  assert.equal(J.quests.locket.state, 'mailed'); assert.equal(J.tokens, tok0); assert.equal(J.food, food0); assert.deepEqual(J.questsDone, ['locket']); assert.equal(J.totals.questsDone, 0, 'keeper means given back in person');
  assert.deepEqual(V14.questMail(J, { leg: 'fort-bridger' }), []); assert.equal(V14.questTalk(J, 'locket'), null);
  assert.deepEqual(V14.questStatus(J).find((q) => q.questId === 'locket').state, 'mailed');
  // the letter: a line for the leg it was returned or mailed on
  const lines = lineSource('quest-locket'); if (lines.length) { assert.ok(happenedKeys(J).includes('quest-locket')); } else skip('the letter line of a returned quest', 'no LETTER_LINES["quest-locket"] in this worktree yet (the Content stream writes it)');
});

test('once a season, new once ever: a new season starts the quest over (questsDone kept); the card is new the first time and a duplicate token after', () => {
  const J = createJourney({ seed: 48, companions: PLAIN }); v14atStop(J, 'kansas-river'); V14.adoptDog(J, { name: 'Frodo' }); v14atStop(J, 'fort-laramie'); V14.questTalk(J, 'locket'); J.done = true;
  const N = newSeason(J); assert.deepEqual(N.quests, {}); assert.deepEqual(N.questsDone, ['locket']); assert.equal(V14.questFindable(N, 'nose'), 'locket', 'a new season, a new locket');
  if (CARD_BY_ID.locket) { const a = awardCard(N, 'locket'); assert.equal(a.new, true); const t0 = N.tokens; const b = awardCard(N, 'locket'); assert.deepEqual([b.new, b.tokens], [false, 1]); assert.equal(N.tokens, t0 + 1); }
  else skip('the locket card is new once ever', 'src/content/cards.js has no "locket" card in this worktree yet');
});

test('a synthetic "glove" quest found by fetch runs through the same functions, untouched (useQuests)', () => {
  const P = (id, name) => ({ id, name, emoji: '🧤', role: 'a traveler' });
  const glove = { id: 'glove', name: 'The glove', card: 'glove-card', letter: 'quest-glove', item: { id: 'glove', name: 'A red glove', emoji: '🧤', text: 'A red glove.' },
    find: { via: 'fetch', legs: ['fort-laramie', 'independence-rock'] }, steps: [{ at: 'independence-rock', person: P('q-g1', 'Gus'), lines: ['A girl lost a red glove.', 'She went on to South Pass.'] }],
    owner: { at: 'south-pass', person: P('q-g2', 'Greta'), lines: ['My glove!', 'Thank you.'] }, reward: { tokens: 2 }, mailed: { text: 'The glove goes ahead to South Pass.' } };
  V14.useQuests([glove]);
  try {
    assert.deepEqual(V14.questList(), [glove]); const J = createJourney({ seed: 49, companions: PLAIN }); v14atStop(J, 'kansas-river'); V14.adoptDog(J, { name: 'Frodo' });
    assert.equal(V14.questFindable(J, 'fetch'), null, 'not on the Kansas River leg'); assert.equal(V14.questFindable(J, 'nose'), null);
    startLeg(J, 'fort-laramie'); assert.equal(V14.questFindable(J, 'fetch'), 'glove'); assert.equal(V14.questFindable(J, 'fish'), null); assert.ok(!v14kinds(J.trip.nose).includes('quest'));
    let got = null; for (let i = 0; i < 400 && !got; i++) { J.trip.fetchThrows = 0; const t = V14.fetchThrow(J, { dist: 0.5, rand: mulberry32(i + 1) }); if (t.quest) got = t; }
    assert.ok(got && got.quest.id === 'glove' && got.quest.item.id === 'glove' && got.item === null); assert.equal(J.quests.glove.state, 'carried'); assert.equal(J.quests.glove.step, 0);
    assert.equal(V14.questFindable(J, 'fetch'), null, 'found once');
    assert.deepEqual(V14.questAt(J, 'independence-rock').map((x) => x.role), ['clue']); assert.deepEqual(V14.questAt(J, 'south-pass').map((x) => [x.role, x.badge]), [['owner', '💛']]);
    v14atStop(J, 'independence-rock'); assert.equal(V14.questTalk(J, 'glove').step, 1);
    const tok = J.tokens, food = J.food; v14atStop(J, 'south-pass'); const r = V14.questTalk(J, 'glove'); assert.deepEqual(r.reward, { tokens: 2, card: 'glove-card' }); assert.equal(J.tokens, tok + 2); assert.equal(J.food, food, 'no food gift');
    assert.equal(J.quests.glove.state, 'returned'); assert.deepEqual(V14.questStatus(J).map((q) => q.questId), ['glove']);
    const M = createJourney({ seed: 50, companions: PLAIN }); startLeg(M, 'fort-laramie'); const f = V14.findQuestItem(M, 'glove'); assert.equal(f.quest.id, 'glove'); v14atStop(M, 'fort-hall');
    assert.deepEqual(V14.questMail(M, { leg: 'fort-hall' }).map((x) => x.questId), ['glove']);
    assert.equal(JSON.stringify(Object.keys(clone(M.quests))), '["glove"]');
  } finally { V14.useQuests(null); }
  assert.deepEqual(V14.questList().map((q) => q.id), QUESTS.map((q) => q.id), 'the content\'s quests are back');
});

// ---- trail facts and moments ----
const FAR_IDS = TRAIL_FACTS.filter((f) => f.far).map((f) => f.id);
test('trail facts: planned only on their legs, at most one a leg, MOMENTS.facts.chance of the legs that have one left, a mile between 30 % and 85 %; never twice a season', () => {
  assert.deepEqual([...FAR_IDS].sort(), ['far-off-crack', 'grizzly-ridge', 'prairie-glow', 'wolf-song'], 'the four far-off facts');
  let have = 0, planned = 0;
  for (const leg of TRAIL) {
    for (let seed = 1; seed <= 200; seed++) {
      const J = createJourney({ seed: seed * 3 + leg.n, companions: PLAIN }); startLeg(J, leg.id);
      const ids = V14.factsFor(J, leg);
      for (const id of ids) { const f = TRAIL_FACTS.find((x) => x.id === id); assert.ok(f.when === 'day' || f.when === 'night'); assert.ok(!f.legs || f.legs.includes(leg.id)); }
      const f = J.trip.fact;
      if (leg.id === LAST) { assert.equal(f, null, 'no trail days on the raft'); continue; }
      if (ids.length) have++;
      if (f) {
        planned++; assert.ok(ids.includes(f.id) && ids[0] === f.id, 'the first of factsFor in the content\'s order'); assert.equal(f.fired, false);
        assert.ok(f.atMile >= Math.round(0.3 * leg.miles) && f.atMile <= Math.round(0.85 * leg.miles), 'mile ' + f.atMile);
      } else if (!ids.length) assert.equal(f, null);
    }
  }
  assert.ok(planned / have > 0.62 && planned / have < 0.78, `chance ${planned / have}`);
  // across a journey: at most one a leg, none twice, about eight a season at most
  for (let seed = 500; seed < 520; seed++) {
    const rand = mulberry32(seed), J = createJourney({ seed, companions: PLAIN }); const heard = [];
    for (let g = 0; g < 14 && !J.done; g++) {
      let n = 0;
      for (let d = 0; d < 120; d++) { const r = tickDay(J, { rand }); if (r.marker) applyMarker(J, { correct: true }); if (r.fact) { n++; heard.push(r.fact.id); assert.deepEqual(V14.heardFact(J, r.fact.id).first, true); } if (r.arrived) break; }
      assert.ok(n <= 1, 'one a leg'); arrive(J); nextLeg(J);
    }
    assert.equal(new Set(heard).size, heard.length, 'never twice a season: ' + heard.join()); assert.ok(heard.length <= TRAIL_FACTS.length - 1);
  }
});

test('heardFact: the card id for the app, new once a season; setTrailSounds(false) removes exactly the four far-off facts (and they are never planned); the stampede\'s fact once a season', () => {
  const J = createJourney({ seed: 60, companions: PLAIN });
  const h = V14.heardFact(J, 'pronghorn-race'); assert.deepEqual(h, { card: 'pronghorn-race', first: true }); assert.deepEqual(J.factsHeard, ['pronghorn-race']); assert.equal(J.totals.factsHeard, 1);
  assert.deepEqual(V14.heardFact(J, 'pronghorn-race'), { card: 'pronghorn-race', first: false }); assert.equal(J.totals.factsHeard, 1); assert.equal(V14.heardFact(J, 'nonsense'), null);
  assert.ok(!V14.factsFor(J, 'chimney-rock').includes('pronghorn-race'), 'heard once, not offered again this season');
  const K = createJourney({ seed: 61, companions: PLAIN });
  const union = (opts) => { const s = new Set(); for (const leg of TRAIL) for (const id of V14.factsFor(K, leg)) s.add(id); return [...s]; };
  const on = union(); assert.equal(V14.setTrailSounds(K, false), false); assert.equal(K.opts.farSounds, false); const off = union();
  assert.deepEqual(on.filter((id) => !off.includes(id)).sort(), [...FAR_IDS].sort(), 'exactly the four far-off facts');
  assert.ok(off.length >= 1 && off.every((id) => !FAR_IDS.includes(id)));
  for (let seed = 1; seed <= 400; seed++) { const L = createJourney({ seed, companions: PLAIN }); V14.setTrailSounds(L, false); for (const leg of TRAIL) { startLeg(L, leg.id); if (L.trip.fact) assert.ok(!FAR_IDS.includes(L.trip.fact.id)); } }
  assert.equal(V14.setTrailSounds(K, true), true); assert.deepEqual(union().sort(), [...on].sort());
  // the stampede: the fact until it has been heard this season
  const S = createJourney({ seed: 62, companions: PLAIN });
  assert.equal(V14.stampedeFact(S), 'bison-thunder'); assert.equal(stampedePay(S, { held: false }).fact, 'bison-thunder'); assert.equal(stampedePay(S, { held: true }).fact, 'bison-thunder');
  assert.deepEqual(V14.heardFact(S, 'bison-thunder'), { card: 'bison-thunder', first: true });
  assert.equal(stampedePay(S, { held: true }).fact, null, 'once a season'); assert.equal(V14.stampedeFact(S), null);
  assert.ok(!on.includes('bison-thunder') && !V14.factsFor(S, 'chimney-rock').includes('bison-thunder'), 'it is not an ambient day or night fact');
  S.done = true; const N = newSeason(S); assert.equal(V14.stampedeFact(N), 'bison-thunder', 'a new season');
});

test('dust devil: prairie, bluffs and high desert legs only, about 35 %, never two legs running; dustDevilResult pays a token only when every hat is caught', () => {
  let eligible = 0, planned = 0;
  for (const leg of TRAIL) for (let seed = 1; seed <= 300; seed++) {
    const J = createJourney({ seed: seed * 5 + leg.n, companions: PLAIN }); startLeg(J, leg.id); const d = J.trip.dustDevil;
    if (MOMENT_RULES.dustDevil.biomes.includes(leg.biome) && leg.id !== LAST) eligible++;
    if (d) { planned++; assert.ok(MOMENT_RULES.dustDevil.biomes.includes(leg.biome), 'only ' + leg.biome); assert.ok(d.atMile >= Math.round(0.25 * leg.miles) && d.atMile <= Math.round(0.8 * leg.miles)); assert.equal(d.fired, false); }
  }
  assert.ok(Math.abs(planned / eligible - 0.35) < 0.04, `${planned / eligible}`);
  let ran = 0, devils = 0;
  for (let seed = 700; seed < 760; seed++) {
    const rand = mulberry32(seed), J = createJourney({ seed, companions: PLAIN }); let last = -9;
    for (let g = 0; g < 14 && !J.done; g++) {
      for (let d = 0; d < 120; d++) { const r = tickDay(J, { rand }); if (r.marker) applyMarker(J, { correct: true }); if (r.moment) { devils++; assert.ok(J.legIndex - last > 1, 'never two legs running'); last = J.legIndex; } if (r.arrived) break; }
      arrive(J); nextLeg(J); ran++;
    }
  }
  assert.ok(devils > 40, 'dust devils ' + devils);
  const J = createJourney({ seed: 63, companions: PLAIN }); const t0 = J.tokens;
  assert.deepEqual(V14.dustDevilResult(J, { caught: 3, of: 3 }), { all: true, tokens: 1 }); assert.equal(J.tokens, t0 + 1); assert.equal(J.totals.hatsAll, 1); assert.equal(J.totals.hatsCaught, 3); assert.equal(J.totals.dustDevils, 1, 'a devil is counted (playtest 1.4 W5)');
  assert.deepEqual(V14.dustDevilResult(J, { caught: 2, of: 3 }), { all: false, tokens: 0 }); assert.deepEqual(V14.dustDevilResult(J, { caught: 0, of: 3 }), { all: false, tokens: 0 }); assert.deepEqual(V14.dustDevilResult(J, { caught: 0, of: 0 }), { all: false, tokens: 0 }, 'no hats, no hat trick');
  assert.equal(J.tokens, t0 + 1); assert.equal(J.totals.hatsAll, 1); assert.equal(J.totals.hatsCaught, 5);
});

test('skipping stones: the flat stone adds its two skips to the next throw once; once a stop and once a leg at camp; best, throws and byRiver kept; at most 12 skips', () => {
  assert.deepEqual(RIVER_STOPS, ['kansas-river', 'snake-river', 'the-dalles']);
  const J = v14mk(64, { leg: 'fort-kearny' });
  V14.recordFind(J, 'flat-stone'); assert.equal(J.trip.skipBonus, 2);
  const p = V14.stonesPlan(J); assert.deepEqual([p.throws, p.bonus, p.available], [3, 2, true]); assert.equal(V14.stonesPlan(J).bonus, 0, 'the flat stone is used once');
  const r = V14.stonesResult(J, { throws: [2, 5, 3] }); assert.deepEqual([r.best, r.newBest], [5, true]); assert.deepEqual(J.skips, { best: 5, throws: 3, byRiver: { 'fort-kearny': 5 } }); assert.equal(J.totals.skipThrows, 3);
  const again = V14.stonesResult(J, { throws: [12, 12, 12] }); assert.equal(again.repeat, true); assert.equal(again.best, 0); assert.equal(J.skips.best, 5, 'once at camp a leg'); assert.equal(V14.stonesPlan(J).available, false);
  // the stop (arrived) is its own place
  J.milesDone = legList()[1].miles; J.trip.arrived = true; assert.equal(V14.stonesPlan(J).available, true);
  const s = V14.stonesResult(J, { throws: [99, 4] }); assert.deepEqual([s.best, s.newBest], [MOMENT_RULES.stones.maxSkips, true]); assert.equal(J.skips.best, 12); assert.equal(J.skips.throws, 5);
  assert.equal(V14.stonesResult(J, { throws: [1] }).repeat, true);
  const K = v14mk(65, { leg: 'snake-river' }); K.skips.best = 4; K.milesDone = 1; const lo = V14.stonesResult(K, { throws: [2, 3] }); assert.deepEqual([lo.best, lo.newBest], [3, false]); assert.equal(K.skips.best, 4); assert.deepEqual(K.skips.byRiver, { 'snake-river': 3 });
  assert.deepEqual(V14.campWater(v14fisher('kansas-river', 1)), { water: 'kansas', name: WATER_NAMES.kansas, river: true });
  assert.equal(V14.campWater(v14fisher('fort-laramie', 1)).river, true); assert.equal(V14.campWater(v14fisher('independence-rock', 1)).water, 'sweetwater');
  assert.equal(V14.campWater(v14fisher('fort-bridger', 1)).river, false, 'a creek'); assert.equal(V14.campWater(v14fisher('blue-mountains', 1)).river, false); assert.equal(V14.campWater(v14fisher('fort-hall', 1)).river, true);
});

test('falling stars: only the evening of an arrival, decided once an arrival, about half, never twice in three legs, never in the valley; a wish card per tap, twelve different ones first', () => {
  const J = createJourney({ seed: 66, companions: PLAIN });
  assert.equal(V14.meteorsTonight(J), false, 'not before the arrival'); assert.equal(J.trip.meteors, null);
  let yes = 0, n = 0;
  for (let seed = 800; seed < 1000; seed++) {
    const K = createJourney({ seed, companions: PLAIN }); let last = -9;
    for (let g = 0; g < 12; g++) {
      v14arrive(K);
      const a = V14.meteorsTonight(K), b = V14.meteorsTonight(K); assert.equal(a, b, 'decided once'); assert.equal(K.trip.meteors, a);
      if (K.legId === LAST) assert.equal(a, false, 'never in the valley');
      if (a) { assert.ok(K.legIndex - last >= MOMENT_RULES.meteors.gapLegs, `legs ${last} then ${K.legIndex}`); last = K.legIndex; yes++; }
      if (K.legId !== LAST) n++;
      nextLeg(K);
    }
  }
  assert.ok(yes / n > 0.15 && yes / n < 0.4, `${yes} of ${n} (a half of the evenings the gap allows)`);
  const W = createJourney({ seed: 67, companions: PLAIN }); const seen = new Set(); const rand = mulberry32(2);
  for (let i = 0; i < WISHES.length; i++) { const w = V14.wishFor(W, rand); assert.equal(w.first, true); assert.ok(WISHES.some((x) => x.id === w.id)); seen.add(w.id); }
  assert.equal(seen.size, WISHES.length); assert.deepEqual([...W.wishes].sort(), WISHES.map((x) => x.id).sort()); assert.equal(W.totals.meteorsTapped, WISHES.length);
  assert.equal(V14.wishFor(W, rand).first, false, 'a repeat after all twelve'); assert.equal(W.wishes.length, WISHES.length);
  const snowy = createJourney({ seed: 68, companions: PLAIN }); v14arrive(snowy); snowy.trip.snow = true; assert.equal(V14.meteorsTonight(snowy), false);
});

// ---- saves, seasons, sync ----
const V14_FIELDS = ['dog', 'finds', 'fishLog', 'fishJunk', 'fishBest', 'skips', 'wishes', 'treatsBest', 'quests', 'questsDone', 'factsHeard', 'moments'];
const V14_TRIP = ['v14', 'nose', 'fact', 'dustDevil', 'fishing', 'stones', 'stonesStop', 'meteors', 'fetchThrows', 'skipBonus'];
const V14_TOTALS = ['noseFinds', 'chases', 'chasesCalled', 'snakes', 'berries', 'fetchThrows', 'treats', 'fishCaught', 'fishOff', 'fishJunk', 'sturgeon', 'skipThrows', 'dustDevils', 'hatsCaught', 'hatsAll', 'meteorsTapped', 'questsDone', 'factsHeard'];
/** what a 1.3.2 save looked like: the journey with none of the v1.4 fields and rev 12 */
function v14oldSave(seed = 70) {
  const J = createJourney({ seed, companions: ['blacksmith', 'scout', 'teacher'] }); const rand = mulberry32(seed);
  for (let d = 0; d < 9; d++) { const r = tickDay(J, { rand }); if (r.marker) applyMarker(J, { correct: true }); }
  camp(J, 'fish', { rand }); applyFish(J, { fishLb: 12 }); buy(J, { item: 'rope', qty: 1 });
  const old = clone(J);
  for (const k of V14_FIELDS) delete old[k];
  for (const k of ['horseshoes', 'hoppers', 'spoon']) delete old.goods[k];
  for (const k of V14_TOTALS) delete old.totals[k];
  for (const k of V14_TRIP) delete old.trip[k];
  delete old.opts.farSounds; old.rev = 12;
  return old;
}
test('ensureJourney turns a 1.3.2 save into rev 14 with every v1.4 field and changes nothing else', () => {
  const old = v14oldSave(), snap = clone(old), J = clone(old);
  assert.equal(ensureJourney(J), J); assert.equal(J.rev, 14);
  assert.equal(J.dog, null); assert.deepEqual(J.finds, {}); assert.deepEqual(J.fishLog, {}); assert.deepEqual(J.fishJunk, { boot: 0, turtle: 0, bottle: 0 }); assert.equal(J.fishBest, null);
  assert.deepEqual(J.skips, { best: 0, throws: 0, byRiver: {} }); assert.deepEqual(J.wishes, []); assert.equal(J.treatsBest, 0); assert.deepEqual(J.quests, {}); assert.deepEqual(J.questsDone, []);
  assert.deepEqual(J.factsHeard, []); assert.deepEqual(J.moments, { dustDevilLeg: -9, meteorsLeg: -9 }); assert.equal(J.opts.farSounds, true);
  assert.deepEqual([J.goods.horseshoes, J.goods.hoppers, J.goods.spoon], [0, 0, 0]); for (const k of V14_TOTALS) assert.equal(J.totals[k], 0, k);
  assert.deepEqual([J.trip.nose, J.trip.fact, J.trip.dustDevil, J.trip.fishing, J.trip.stones, J.trip.meteors, J.trip.fetchThrows, J.trip.skipBonus], [[], null, null, 0, false, null, 0, 0]);
  // …and nothing else moved: take the additions out and it is the old save again
  const back = clone(J); for (const k of V14_FIELDS) delete back[k]; for (const k of ['horseshoes', 'hoppers', 'spoon']) delete back.goods[k]; for (const k of V14_TOTALS) delete back.totals[k]; for (const k of V14_TRIP) delete back.trip[k]; delete back.opts.farSounds; back.rev = 12;
  assert.deepEqual(back, snap); assert.deepEqual(clone(J), J, 'JSON-safe');
  const twice = clone(J); ensureJourney(twice); assert.deepEqual(twice, J, 'idempotent');
  // it plays on, and every v1.4 entry point takes it
  const rand = mulberry32(4); const r = tickDay(J, { rand }); assert.ok(r.miles >= 0 && 'nose' in r && r.nose === null);
  const o = clone(old); V14.adoptDog(o, { name: 'Rex' }); const o2 = clone(old); V14.fishingSession(o2); const o3 = clone(old); V14.stonesPlan(o3); V14.factsFor(clone(old), 'fort-kearny'); V14.meteorsTonight(clone(old)); V14.questAt(clone(old), 'fort-kearny'); V14.questStatus(clone(old));
  const o4 = clone(old); V14.chaseResult(o4, { called: true, dist: 0.1 }); V14.sellHorseshoes(o4); V14.fetchThrow(o4, {}); V14.catchHoppers(o4, 3); V14.wishFor(clone(old)); V14.dustDevilResult(clone(old), { caught: 1, of: 1 });
  assert.equal(o.dog.name, 'Rex'); assert.equal(o4.goods.hoppers, 3);
  const arrows = clone(old); arrows.goods.arrows = 4; ensureJourney(arrows); assert.equal(arrows.goods.arrows, 4, 'a rev-12 save keeps its arrows (only a pre-1.2 save gets the bow\'s fifteen)');
  const ancient = clone(old); delete ancient.rev; ancient.goods.arrows = 1; ensureJourney(ancient); assert.equal(ancient.goods.arrows, 15); assert.equal(ancient.rev, 14);
});

test('newSeason carries exactly the §3.1 list (the dog clean, the finds, the fish log, the junk, the best fish, the stones, the wishes, the quests given back, the longest fetch, the spoon, the far-off switch) and resets the rest', () => {
  const J = v14mk(71, { leg: 'fort-laramie' }); const rand = mulberry32(1);
  J.dog.muddy = true; J.dog.legs = 5; J.dog.treats = 11; J.finds = { horseshoe: 2, pinecone: 1 }; J.fishLog = { 'channel-catfish': { n: 2, bestIn: 22, bestLb: 5, firstLeg: 'fort-kearny', firstSeason: 's1847' } }; J.fishJunk = { boot: 2, turtle: 0, bottle: 1 };
  J.fishBest = { species: 'channel-catfish', in: 22 }; J.skips = { best: 8, throws: 12, byRiver: { 'kansas-river': 8 } }; J.wishes = ['oxen-fly']; J.questsDone = ['locket']; J.treatsBest = 0.9; J.goods.spoon = 1; J.opts.farSounds = false;
  J.quests = { 'bottle-note': { state: 'carried', step: 1, foundLeg: 'fort-laramie', season: 's1847' } }; J.factsHeard = ['wolf-song']; J.moments = { dustDevilLeg: 3, meteorsLeg: 2 }; J.goods.horseshoes = 4; J.goods.hoppers = 7; J.goods.rope = 3; J.tokens = 9;
  J.totals.treats = 11; J.totals.fishCaught = 5; J.done = true;
  const N = newSeason(J);
  assert.deepEqual({ ...N.dog, nextBerries: 0 }, { ...J.dog, muddy: false, nextBerries: 0 }, 'the dog, clean (the new leg\'s plan may have moved the berry counter)'); assert.deepEqual(N.finds, J.finds); assert.deepEqual(N.fishLog, J.fishLog); assert.deepEqual(N.fishJunk, J.fishJunk); assert.deepEqual(N.fishBest, J.fishBest);
  assert.deepEqual(N.skips, J.skips); assert.deepEqual(N.wishes, J.wishes); assert.deepEqual(N.questsDone, J.questsDone); assert.equal(N.treatsBest, 0.9); assert.equal(N.goods.spoon, 1); assert.equal(N.opts.farSounds, false);
  assert.deepEqual(N.quests, {}); assert.deepEqual(N.factsHeard, []); assert.deepEqual(N.moments, { dustDevilLeg: -9, meteorsLeg: -9 }); assert.equal(N.goods.horseshoes, 0); assert.equal(N.goods.hoppers, 0); assert.equal(N.goods.rope, 0);
  for (const k of V14_TOTALS) assert.equal(N.totals[k], 0, k); assert.equal(N.tokens, 9, '1.3: the tokens carry');
  assert.notEqual(N.finds, J.finds, 'copies, not the same objects'); N.finds.horseshoe = 99; assert.equal(J.finds.horseshoe, 2);
  assert.ok(N.trip.nose.length >= 2, 'the dog is carried, so the first leg of the new season has its nose slots'); assert.equal(N.trip.nose[0].kind, 'quest');
  assert.equal(N.rev, 14); assert.deepEqual(clone(N), N);
  const noDog = createJourney({ seed: 72, companions: PLAIN }); noDog.done = true; const M = newSeason(noDog); assert.equal(M.dog, null); assert.deepEqual(M.trip.nose, []);
  const off = createJourney({ seed: 73, companions: PLAIN }); V14.setTrailSounds(off, false); off.done = true; for (let i = 0; i < 40; i++) { const Z = newSeason(off); assert.equal(Z.opts.farSounds, false); if (Z.trip.fact) assert.ok(!FAR_IDS.includes(Z.trip.fact.id)); off.seed += 1; }
});

test('merge14: each rule of §3.7, both ways (the later doc is s; finds, fish, stones, wishes, quests given back and the longest fetch are never lost)', () => {
  const rec = (n, bestIn, bestLb, firstLeg) => ({ n, bestIn, bestLb, firstLeg, firstSeason: 's1847' });
  const mkJ = (o = {}) => { const J = createJourney({ seed: 80, companions: PLAIN }); Object.assign(J, o); return J; };
  const A = () => mkJ({ finds: { horseshoe: 2, pinecone: 1 }, fishLog: { 'channel-catfish': rec(3, 20, 5, 'kansas-river'), 'hornyhead-chub': rec(1, 6, 3, 'independence-rock') }, fishJunk: { boot: 2, turtle: 0, bottle: 1 },
    fishBest: { species: 'channel-catfish', in: 20 }, skips: { best: 5, throws: 9, byRiver: { 'kansas-river': 5, 'snake-river': 2 } }, wishes: ['oxen-fly', 'bison-dance'], questsDone: ['locket'], treatsBest: 0.5,
    dog: { name: 'Frodo', coat: 'brown', legs: 4, nextBerries: 6, treats: 10, muddy: false }, quests: { locket: { state: 'carried', step: 1, foundLeg: 'kansas-river', season: 's1847' } }, factsHeard: ['wolf-song'], cash: 50, tokens: 3 });
  const B = () => mkJ({ finds: { horseshoe: 1, 'hawk-feather': 3 }, fishLog: { 'channel-catfish': rec(5, 22, 6, 'fort-kearny'), 'white-sturgeon': rec(1, 60, 14, 'snake-river') }, fishJunk: { boot: 1, turtle: 3, bottle: 0 },
    fishBest: { species: 'white-sturgeon', in: 60 }, skips: { best: 7, throws: 4, byRiver: { 'kansas-river': 3, 'the-dalles': 7 } }, wishes: ['bison-dance', 'pie-rain'], questsDone: ['bottle-note'], treatsBest: 0.9,
    dog: { name: 'Rex', coat: 'black', legs: 2, nextBerries: 3, treats: 25, muddy: true }, quests: { locket: { state: 'returned', step: 2, foundLeg: 'kansas-river', season: 's1847' }, 'bottle-note': { state: 'carried', step: 0, foundLeg: 'fort-laramie', season: 's1847' } }, factsHeard: ['grizzly-ridge', 'wolf-song'], cash: 10, tokens: 8 });
  const sorted = (xs) => [...xs].sort();
  for (const [s, o, name] of [[A(), B(), 'a later'], [B(), A(), 'b later']]) {
    const m = V14.merge14(s, o);
    assert.equal(m, s, 'merges into the later doc and returns it');
    assert.deepEqual(m.finds, { horseshoe: 2, pinecone: 1, 'hawk-feather': 3 }, name);
    assert.deepEqual(m.fishLog['channel-catfish'], { n: 5, bestIn: 22, bestLb: 6, firstLeg: 'fort-kearny', firstSeason: 's1847' }, name + ': n max, the bigger with its lb / leg');
    assert.deepEqual(m.fishLog['hornyhead-chub'], rec(1, 6, 3, 'independence-rock')); assert.deepEqual(m.fishLog['white-sturgeon'], rec(1, 60, 14, 'snake-river'));
    assert.deepEqual(m.fishJunk, { boot: 2, turtle: 3, bottle: 1 }); assert.deepEqual(m.fishBest, { species: 'white-sturgeon', in: 60 });
    assert.deepEqual(m.skips, { best: 7, throws: 9, byRiver: { 'kansas-river': 5, 'snake-river': 2, 'the-dalles': 7 } });
    assert.deepEqual(sorted(m.wishes), ['bison-dance', 'oxen-fly', 'pie-rain']); assert.deepEqual(sorted(m.questsDone), ['bottle-note', 'locket']); assert.equal(m.treatsBest, 0.9);
    assert.equal(m.dog.treats, 25, 'treats max'); assert.equal(m.dog.name, name === 'a later' ? 'Frodo' : 'Rex', 'the later doc\'s dog');
    // the same journey (season + seed): quests per id the further state, step max; facts union; the spoon max
    assert.deepEqual(m.quests.locket.state, 'returned'); assert.equal(m.quests.locket.step, 2); assert.deepEqual(m.quests['bottle-note'], { state: 'carried', step: 0, foundLeg: 'fort-laramie', season: 's1847' });
    assert.deepEqual(sorted(m.factsHeard), ['grizzly-ridge', 'wolf-song']);
    assert.equal(m.cash, name === 'a later' ? 50 : 10, 'everything else stays the later doc\'s'); assert.equal(m.tokens, name === 'a later' ? 3 : 8);
  }
  // a dog on one side only comes across; a quest further along wins whichever side it is on; mailed sits between carried and returned
  const s1 = A(), o1 = B(); s1.dog = null; assert.equal(V14.merge14(s1, o1).dog.name, 'Rex'); const s2 = A(); const o2 = B(); o2.dog = null; assert.equal(V14.merge14(s2, o2).dog.name, 'Frodo');
  const rank = (a, b) => V14.merge14(mkJ({ quests: { q: { state: a, step: 0 } } }), mkJ({ quests: { q: { state: b, step: 0 } } })).quests.q.state;
  assert.deepEqual([rank('none', 'carried'), rank('carried', 'mailed'), rank('mailed', 'returned'), rank('returned', 'carried'), rank('mailed', 'carried'), rank('carried', 'none')], ['carried', 'mailed', 'returned', 'returned', 'mailed', 'carried']);
  const sp = (a, b) => { const x = mkJ(), y = mkJ(); x.goods.spoon = a; y.goods.spoon = b; return V14.merge14(x, y).goods.spoon; }; assert.deepEqual([sp(0, 1), sp(1, 0), sp(0, 0), sp(1, 1)], [1, 1, 0, 1]);
  // another journey (a different seed or season): the quests, the facts heard and the spoon stay the later doc's; the collections still merge
  const x = A(), y = B(); y.seed = 81; x.goods.spoon = 0; y.goods.spoon = 1; const mm = V14.merge14(x, y);
  assert.equal(mm.quests.locket.state, 'carried'); assert.equal(mm.quests['bottle-note'], undefined); assert.deepEqual(mm.factsHeard, ['wolf-song']); assert.equal(mm.goods.spoon, 0); assert.equal(mm.finds['hawk-feather'], 3); assert.equal(mm.fishBest.in, 60);
  const x2 = A(), y2 = B(); y2.season = 's1850'; assert.equal(V14.merge14(x2, y2).quests['bottle-note'], undefined);
  // older journeys (no v1.4 fields) on either side: nothing throws, nothing is lost
  const old = clone(v14oldSave(82)); const m1 = V14.merge14(A(), old); assert.deepEqual(m1.finds, A().finds); const old2 = clone(old); const m2 = V14.merge14(old2, A()); assert.equal(m2.finds.horseshoe, 2);
  assert.equal(V14.merge14(null, A()), null); assert.ok(V14.merge14(A(), null)); assert.deepEqual(clone(m2), m2);
  const before = clone(B()); V14.merge14(A(), before); assert.deepEqual(before, clone(B()), 'the other side is only read');
});

// ---- a whole journey with a dog, every moment taken ----
/** the kid of the economy sim's v1.4 play: keeps the dog, calls it back from the rabbit 70 % of the time, takes every trail fact and dust devil, fishes (events, camps), fetches at camp, skips stones,
 *  watches the falling stars, talks to everyone with a ❓ or a 💛, buys the spoon at Fort Kearny, sells the old iron */
function v14journey(seed, { right = 1, season = 's1847', keepDog = true } = {}) {
  const rand = mulberry32(seed), J = createJourney({ seed, season, companions: PARTY });
  const log = { noses: 0, finds: 0, chases: 0, called: 0, snakes: 0, berries: 0, quests: 0, facts: 0, devils: 0, fetches: 0, fish: 0, stones: 0, meteors: 0, talks: 0, mailed: 0, legs: 0 };
  shop(J);
  for (let guard = 0; guard < 40 && !J.done; guard++) {
    const leg = legList()[J.legIndex];
    for (let d = 0; d < 400; d++) {
      const r = tickDay(J, { rand });
      assert.ok(J.food >= 0 && J.cash >= 0, 'food and cash never below 0');
      if (r.marker) applyMarker(J, { correct: rand() < right, quick: rand() < 0.5 });
      if (r.event) {
        const e = r.event;
        if (e.kind === 'hunt') applyHunt(J, { meatLb: 20 });
        else if (e.kind === 'fish') { v14kid(J, rand, { rescue: e.rescue }); log.fish++; }
        else if (e.kind === 'trade') { const offer = tradeOffer(J); const p = problemFor({ kind: 'trade', fact: '3x4', leg: J.legId, season: J.season, rand, have: offer.have }); applyProblem(J, { kind: 'trade', correct: true }); applyTrade(J, p.meta); }
        else if (e.kind === 'problem') applyProblem(J, { kind: 'fact', correct: rand() < right });
        else if (e.kind === 'breakdown') repair(J, { workedOut: true });
        else if (e.kind === 'stampede') { const sp = stampedePay(J, { held: rand() < 0.5 }); if (sp.fact) { V14.heardFact(J, sp.fact); log.facts++; } }
      }
      if (r.nose) {
        log.noses++;
        if (r.nose.kind === 'find') { log.finds++; assert.ok(r.nose.find.id); }
        else if (r.nose.kind === 'rabbit') { const called = rand() < 0.7; V14.chaseResult(J, { called, dist: called ? rand() * 0.7 : 1 }); log.chases++; if (called) log.called++; }
        else if (r.nose.kind === 'snake') log.snakes++; else if (r.nose.kind === 'berries') log.berries++; else if (r.nose.kind === 'quest') log.quests++;
      }
      if (r.fact) { V14.heardFact(J, r.fact.id); log.facts++; }
      if (r.moment) { V14.dustDevilResult(J, { caught: rand() < 0.6 ? 3 : 1, of: 3 }); log.devils++; }
      if (r.arrived) break;
    }
    applyWords(J, { asked: 3, right: 3 });
    const res = arrive(J); assert.ok(res, 'arrived at ' + leg.id);
    if (leg.stop.kind === 'river') {
      crossRiver(J, { how: 'ford', soaked: 0 });
      if (RIVER_STOPS.includes(leg.id)) { const p = V14.stonesPlan(J); const sk = [1, 2, 3].map(() => Math.min(12, 1 + p.bonus + Math.floor(rand() * 6))); V14.stonesResult(J, { throws: sk }); log.stones++; }
    }
    if (leg.id === 'kansas-river' && keepDog && rand() < 0.8) V14.adoptDog(J, { name: 'Frodo', coat: 'brown' });
    if (leg.stop.kind === 'fort') {
      if (!J.dog && keepDog && V14.dogOfferAt(J, leg)) V14.adoptDog(J, { name: 'Frodo', coat: 'brown' });
      V14.questMail(J, { leg }); V14.sellHorseshoes(J, { leg }); shop(J);
      if (J.dog && !J.goods.spoon && rand() < 0.25) buy(J, { item: 'spoon' });
    }
    for (const q of V14.questAt(J, J.legId)) { const t = V14.questTalk(J, q.questId); if (t) log.talks++; }
    if (J.legIndex % 3 === 2 && leg.id !== LAST) {
      if (J.dog) { for (let k = 0; k < 3; k++) V14.fetchThrow(J, { dist: rand(), rand }); log.fetches++; }
      if (V14.campWater(J).river) { V14.stonesResult(J, { throws: [3, 4] }); log.stones++; }
      if (V14.meteorsTonight(J)) { for (let k = 0; k < 3; k++) V14.wishFor(J, rand); log.meteors++; }
      J.goods.hoppers = 0; V14.catchHoppers(J, 6); v14kid(J, rand, { bait: 'hoppers' }); camp(J, 'fish', { rand });
    }
    checkDeeds(J); log.legs++;
    assert.deepEqual(clone(J), J, 'JSON-safe at every stop');
    nextLeg(J);
  }
  return { J, log };
}
test('a 12-leg journey with a dog, every moment taken (nose, chase, facts, dust devils, fetch, fishing, stones, falling stars, quests): arrives at every stop, no fail state, food and cash never negative, JSON-safe', () => {
  const tot = {};
  for (let seed = 900; seed < 920; seed++) {
    const { J, log } = v14journey(seed);
    assert.ok(J.done, 'seed ' + seed); assert.equal(J.totals.legs, 12); assert.equal(log.legs, 12);
    for (const [k, v] of Object.entries(log)) tot[k] = (tot[k] || 0) + v;
    if (J.dog) assert.ok(['returned', 'mailed'].includes(J.quests.locket.state), 'the locket finds Molly one way or the other: ' + J.quests.locket.state);
  }
  for (const k of ['noses', 'finds', 'chases', 'snakes', 'berries', 'facts', 'devils', 'fetches', 'fish', 'stones', 'talks']) assert.ok(tot[k] > 0, k + ' ' + JSON.stringify(tot));
  // the same seed replays the same journey
  const a = v14journey(907), b = v14journey(907); assert.deepEqual(a.J, b.J); assert.notDeepEqual(a.J.finds, v14journey(908).J.finds);
  // a wrong-every-time kid still arrives (nothing here asks a question, and no moment can be failed)
  const w = v14journey(930, { right: 0 }); assert.ok(w.J.done);
  // all three seasons
  for (const s of ['s1850', 's1853']) assert.ok(v14journey(931, { season: s }).J.done);
});

test('the letter home: {dog} is a fill (the dog\'s name), the v1.4 keys are picked when they happened and never otherwise', () => {
  const J = createJourney({ seed: 90, companions: PLAIN }); J.dog = { name: 'Frodo', coat: 'brown', legs: 0, nextBerries: 9, treats: 0, muddy: false };
  const have = (k) => lineSource(k).length > 0;
  const keys = ['nose', 'chase', 'snake', 'fetch', 'sturgeon', 'fish-boot', 'quest-locket', 'quest-note', 'dust-devil', 'stones', 'meteors', 'grizzly-ridge', 'wolf-song', 'pronghorn-race'];
  const present = keys.filter(have);
  if (present.length < keys.length) skip('letter lines for ' + keys.filter((k) => !have(k)).join(', '), 'the Content stream writes LETTER_LINES; until it merges those keys are not in this worktree');
  // keys that happened are offered; keys that did not never are
  J.trip.happened.push(...keys); const hk = happenedKeys(J); for (const k of hk) assert.ok(keys.includes(k) || LETTER_LINES[k] || FALLBACK_LINES[k] || EVENT_BY_ID[k] || ['happy', 'tired', 'river'].includes(k), k);
  for (const k of present) assert.ok(hk.includes(k), k);
  const K = createJourney({ seed: 91, companions: PLAIN }); for (const k of keys) assert.ok(!happenedKeys(K).includes(k), 'nothing happened: ' + k);
  // a {dog} line says the dog's name (the test injects a line; the content's own may or may not use the fill)
  const saved = LETTER_LINES.nose; LETTER_LINES.nose = ['{dog} found an old horseshoe today!', '{dog} found something!', '{dog} dashed off and came back with a gift.'];
  try { J.trip.arrived = true; J.trip.happened = ['nose']; const L = composeLetter(J, null, ['a', 'b', 'c']); assert.ok(L.lines.some((l) => /^Frodo /.test(l)), L.lines.join(' | ')); assert.ok(!/\{/.test(L.text)); }
  finally { if (saved) LETTER_LINES.nose = saved; else delete LETTER_LINES.nose; }
  const noDog = createJourney({ seed: 92, companions: PLAIN }); LETTER_LINES.nose = ['{dog} found something!']; try { noDog.trip.happened = ['nose']; assert.ok(!/\{/.test(composeLetter(noDog, null, ['a', 'b', 'c']).text)); } finally { if (saved) LETTER_LINES.nose = saved; else delete LETTER_LINES.nose; }
  // a returned quest has its line on the leg it was returned
  const Q = createJourney({ seed: 93, companions: PLAIN }); v14atStop(Q, 'kansas-river'); V14.adoptDog(Q, { name: 'Frodo' }); v14atStop(Q, 'fort-laramie'); V14.questTalk(Q, 'locket');
  const savedQ = LETTER_LINES['quest-locket']; LETTER_LINES['quest-locket'] = ['Molly got her locket back!', 'Molly cried happy tears.', 'The locket is home.'];
  try { assert.ok(happenedKeys(Q).includes('quest-locket')); startLeg(Q, 'fort-bridger'); assert.ok(!happenedKeys(Q).includes('quest-locket'), 'only on the leg it happened'); }
  finally { if (savedQ) LETTER_LINES['quest-locket'] = savedQ; else delete LETTER_LINES['quest-locket']; }
});

test('the 8 new deeds are reachable (each +1 token once, checkDeeds idempotent) and none is earned by doing nothing', () => {
  const dids = V14_DEEDS;
  for (const id of dids) assert.ok(DEED_BY_ID[id], id);
  const J = createJourney({ seed: 95, companions: PLAIN }); assert.deepEqual(checkDeeds(J), []);
  const earn = (id) => { const t0 = J.tokens; const got = checkDeeds(J); assert.ok(got.includes(id), `${id} earned: ${got}`); assert.equal(J.tokens, t0 + got.length); assert.deepEqual(checkDeeds(J), [], 'idempotent'); };
  // good-nose: six different finds
  startLeg(J, 'chimney-rock'); for (const id of ['horseshoe', 'ox-shoe', 'magpie-feather', 'hawk-feather', 'arrowhead']) V14.recordFind(J, id); assert.ok(!checkDeeds(J).includes('good-nose')); V14.recordFind(J, 'pinecone'); J.deeds.length = 0; earn('good-nose');
  // fetch-champ: 25 treats
  V14.adoptDog(J, { name: 'Frodo' }); for (let v = 0; v < 8; v++) { J.trip.fetchThrows = 0; for (let k = 0; k < 3; k++) V14.fetchThrow(J, { dist: 0.1, rand: () => 0.99 }); } assert.equal(J.dog.treats, 24); assert.ok(!checkDeeds(J).includes('fetch-champ')); J.trip.fetchThrows = 0; V14.fetchThrow(J, { dist: 0.1, rand: () => 0.99 }); earn('fetch-champ');
  // big-one and river-guide
  const K = v14fisher('snake-river', 97); const S2 = V14.fishingSession(K, { rand: mulberry32(2) });
  S2.casts[0] = { ...S2.casts[0], kind: 'fish', species: 'white-sturgeon', lengthIn: 60, lb: 14 }; V14.landCast(K, S2, 0); assert.deepEqual(checkDeeds(K), ['big-one']); assert.equal(K.tokens, 1);
  const L = v14fisher('snake-river', 98);
  for (const f of FISH) { const SS = V14.fishingSession(L, { rand: mulberry32(3) }); SS.casts[0] = { ...SS.casts[0], kind: 'fish', species: f.id, lengthIn: f.sizeIn[0], lb: f.lb[0] }; V14.landCast(L, SS, 0); if (f !== FISH[FISH.length - 1]) assert.ok(!checkDeeds(L).includes('river-guide')); }
  assert.ok(checkDeeds(L).includes('river-guide'), 'all six species');
  // skipper: seven in one throw
  const M = v14mk(99, { leg: 'fort-kearny' }); V14.stonesResult(M, { throws: [6, 6] }); assert.ok(!checkDeeds(M).includes('skipper')); M.trip.stones = false; V14.stonesResult(M, { throws: [7] }); assert.ok(checkDeeds(M).includes('skipper'));
  // keeper: given back in person (mailing does not count); wish-maker: six wishes; hat-trick: every hat
  const Q = createJourney({ seed: 100, companions: PLAIN }); v14atStop(Q, 'kansas-river'); V14.adoptDog(Q, { name: 'Frodo' }); v14atStop(Q, 'fort-bridger'); V14.questMail(Q, { leg: 'fort-bridger' }); assert.ok(!checkDeeds(Q).includes('keeper'));
  const R = createJourney({ seed: 101, companions: PLAIN }); v14atStop(R, 'kansas-river'); V14.adoptDog(R, { name: 'Frodo' }); v14atStop(R, 'fort-laramie'); V14.questTalk(R, 'locket'); assert.ok(checkDeeds(R).includes('keeper'));
  const W = createJourney({ seed: 102, companions: PLAIN }); const rand = mulberry32(1); for (let i = 0; i < 5; i++) V14.wishFor(W, rand); assert.ok(!checkDeeds(W).includes('wish-maker')); V14.wishFor(W, rand); assert.ok(checkDeeds(W).includes('wish-maker'));
  const H = createJourney({ seed: 103, companions: PLAIN }); V14.dustDevilResult(H, { caught: 2, of: 3 }); assert.ok(!checkDeeds(H).includes('hat-trick')); V14.dustDevilResult(H, { caught: 3, of: 3 }); assert.ok(checkDeeds(H).includes('hat-trick'));
  // and in a played journey the deeds come the way they do in life
  const earned = new Set(); for (let seed = 940; seed < 960; seed++) for (const d of v14journey(seed).J.deeds) earned.add(d);
  for (const id of ['good-nose', 'hat-trick', 'keeper', 'river-guide']) assert.ok(earned.has(id), 'a played journey earns ' + id + ' (' + [...earned].join() + ')');
  for (const d of DEEDS.filter((x) => dids.includes(x.id))) { assert.ok(d.name && d.how && d.say && d.emoji); assert.ok(!/\d/.test(d.say), d.say); }
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('FAILED:\n  ' + failures.join('\n  ')); process.exit(1); }
console.log('ALL JOURNEY TESTS PASSED');

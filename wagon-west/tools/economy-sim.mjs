// Wagon West economy simulator (SPEC §5, §10), in the house style of Trail Blazer's: 40 simulated kids play the
// journey through the real sim (src/journey/*), a leg a session (12 minutes; a leg that does not fit carries over to
// the next session, the journey waits), answering 70 % of the mile markers right (half of those quick), 60 % of the
// word problems, 2 of 3 spelling words. Kids differ the way kids do: oxen or mules, a careful or a carefree hand on
// the rations dial, a brisk pace now and then, and shopping by eye (60 %-140 % of what the next stretch needs). They
// hunt (5 arrows, half hit: a rabbit, a turkey or a deer), fish (4 casts), trade what pelts they have, and write a
// letter at each fort. Prints, per season: sessions to finish, the cash at the end, tokens per leg, the food margin
// at arrivals, stars, crawl days and the safety nets; then the checks.
//   node wagon-west/tools/economy-sim.mjs            the table (40 kids, 3 seasons)
//   node wagon-west/tools/economy-sim.mjs --check    exit 1 if a kid gets stuck (food 0 for more than 3 days in a row)
//                                                    or the first season takes more than 16 or fewer than 9 sessions
//                                                    (and the target: the first season's mean is 12 ± 2 sessions)
// While src/content/legs.js is a skeleton the sim runs on route.syntheticTrail() (12 legs).
import {
  createJourney, tickDay, applyMarker, applyProblem, applyWords, applyHunt, applyFish, applyTrade, buy, arrive, nextLeg,
  newSeason, priceAt, foodToNextFort, setPace, setRations, tradeOffer, storeLeg, partySize,
} from '../src/journey/sim.js';
import { problemFor } from '../src/journey/problems.js';
import { composeLetter, keepLetter } from '../src/journey/letters.js';
import { foodNeeded, lbOf, START, RESCUE } from '../src/journey/economy.js';
import { useLegs, syntheticTrail, legList, LEGS, SEASONS, animalOf } from '../src/journey/route.js';
import { mulberry32 } from '../src/journey/rng.js';

const CHECK = process.argv.includes('--check');
const KIDS = 40;
if (LEGS.length < 12) useLegs(syntheticTrail(12));
const TRAIL = legList();

// ---- the kid ----
const KID = { marker: 0.7, quickOfRight: 0.5, problem: 0.6, words: 2 / 3, trailProblems: [2, 3], storeProblems: [2, 4],
  huntHit: 0.5, castHit: 0.6, sessionS: 12 * 60 };
// seconds a thing takes on screen (SPEC §5: a day ≈ 6 s, a marker ≈ 15 s, the stop scene ≈ 3 min)
const SEC = { day: 6, marker: 15, markerFix: 12, problem: 25, problemFix: 20, word: 20, wordFix: 15, event: 10, hunt: 60,
  fish: 45, trade: 30, lookout: 15, store: 40, rope: 30, post: 20, results: 30, landmark: 30, home: 90 };
const FACTS = ['3x4', '6x7', '7x8', '4x9', '8x6', '56/7', '42/6', '5x12', '9x9', '72/8'];
const ANIMALS_HUNTED = [[4, 0.45], [10, 0.35], [40, 0.2]];    // rabbit, turkey, deer: lb and how often

function huntLb(rand) {
  let lb = 0;
  for (let s = 0; s < 5; s++) if (rand() < KID.huntHit) { let r = rand(); for (const [w, p] of ANIMALS_HUNTED) { if (r < p) { lb += w; break; } r -= p; } }
  return lb;
}
function fishLb(rand) { let lb = 0; for (let c = 0; c < 4; c++) if (rand() < KID.castHit) lb += 2 + Math.floor(rand() * 5); return lb; }

// one sim kid's whole history over `seasons` journeys
function simulateKid(seed, seasons = 3) {
  const rand = mulberry32(seed);
  const careful = rand() < 0.5;
  const animal = rand() < 0.5 ? 'oxen' : 'mules';
  const out = [];
  let J = createJourney({ season: SEASONS[0].id, wagonName: 'Kid ' + seed, animal, companions: ['blacksmith', 'scout', 'cook'], seed });
  let clock = 0;                     // seconds into the current session
  let legTime = 0;                   // seconds spent on the current leg (across sessions)
  let sessions = 1;
  const spend = (s) => { clock += s; legTime += s; };
  const ask = (kind, fact) => {      // a word problem: right first try, or fixed
    const p = problemFor({ kind, fact, leg: J.legId, season: J.season, rand });
    const ok = rand() < KID.problem;
    applyProblem(J, { kind, correct: ok, firstTry: true });
    spend(SEC.problem + (ok ? 0 : SEC.problemFix));
    return p;
  };
  const words = () => { let right = 0; for (let w = 0; w < 3; w++) { const ok = rand() < KID.words; right += ok; spend(SEC.word + (ok ? 0 : SEC.wordFix)); } applyWords(J, { asked: 3, right }); };
  const shop = () => {
    spend(SEC.store);
    const plan = foodToNextFort(J);
    const want = Math.max(0, Math.round(plan.lb * (0.6 + 0.8 * rand())) - J.food);
    const sacks = Math.ceil(want / lbOf('flour'));
    const n = KID.storeProblems[0] + Math.floor(rand() * (KID.storeProblems[1] - KID.storeProblems[0] + 1));
    for (let i = 0; i < n; i++) ask(i % 2 ? 'divide' : 'buy', FACTS[Math.floor(rand() * FACTS.length)]);
    if (sacks > 0) buy(J, { item: 'flour', qty: sacks, price: priceAt('flour', storeLeg(J), J.season) });
    if (J.parts < 1) buy(J, { item: 'parts', qty: 1 });
  };
  const dials = () => {
    if (careful) {
      const plan = foodToNextFort({ ...J, rations: 'full' });
      setRations(J, J.food >= plan.lb * 1.05 ? 'full' : J.food >= plan.lb * 0.7 ? 'plenty' : 'lean');
    } else setRations(J, rand() < 0.8 ? 'full' : 'plenty');
    setPace(J, rand() < 0.3 ? 'brisk' : 'steady');
  };
  for (let s = 0; s < seasons; s++) {
    const rec = { season: J.season, sessionsStart: sessions, legs: 0, tokens0: J.tokens, arriveFoodDays: [], stars: 0, crawl: 0,
      maxCrawl: 0, rescues: 0, legSeconds: [], leftovers: 0, happy: 0, allRight: 0 };
    shop();                                        // the Independence store
    for (let guard = 0; guard < 40 && !J.done; guard++) {
      const leg = legList()[J.legIndex];
      legTime = 0;
      dials();
      let trailProblemsLeft = KID.trailProblems[0] + Math.floor(rand() * (KID.trailProblems[1] - KID.trailProblems[0] + 1));
      for (let d = 0; d < 400; d++) {
        if (clock >= KID.sessionS) { sessions++; clock = 0; rec.leftovers++; }   // the session ends mid-leg; the journey waits
        const r = tickDay(J, { rand });
        spend(SEC.day);
        if (r.crawl) { rec.crawl++; }
        if (r.marker) { const ok = rand() < KID.marker; applyMarker(J, { correct: ok, quick: ok && rand() < KID.quickOfRight }); spend(SEC.marker + (ok ? 0 : SEC.markerFix)); }
        if (r.event) {
          const e = r.event;
          if (e.rescue) rec.rescues++;
          spend(SEC.event);
          if (e.kind === 'hunt') { applyHunt(J, { meatLb: huntLb(rand) }); spend(SEC.hunt); }
          else if (e.kind === 'fish') { applyFish(J, { fishLb: fishLb(rand) }); spend(SEC.fish); }
          else if (e.kind === 'trade') { const o = tradeOffer(J); const p = problemFor({ kind: 'trade', fact: FACTS[Math.floor(rand() * FACTS.length)], leg: J.legId, season: J.season, rand, have: o.have }); applyProblem(J, { kind: 'trade', correct: rand() < KID.problem }); applyTrade(J, p.meta); spend(SEC.trade); }
          else if (e.kind === 'problem') ask(e.problem === 'parts' ? 'parts' : 'buy', FACTS[Math.floor(rand() * FACTS.length)]);
          else if (e.kind === 'lookout') spend(SEC.lookout);
        }
        // the trail problems: one when the rations dial moves or a landmark is sighted, a few a leg
        if (trailProblemsLeft > 0 && d > 0 && d % 3 === 0) { ask(trailProblemsLeft % 2 ? 'ration' : 'distance', FACTS[Math.floor(rand() * FACTS.length)]); trailProblemsLeft--; }
        if (d % 4 === 3) dials();
        if (r.arrived) break;
      }
      // the stop
      const res = arrive(J);
      const kind = leg.stop.kind;
      if (kind === 'river') { words(); spend(SEC.rope); }
      else if (kind === 'fort') { shop(); spend(SEC.post); words(); keepLetter(J, composeLetter(J, null, ['enough', 'through', 'buffalo'])); }
      else if (kind === 'home') spend(SEC.home);
      else spend(SEC.landmark);
      spend(SEC.results);
      rec.legSeconds.push(legTime);
      rec.legs++; rec.stars += res.stars.filter(Boolean).length; rec.happy += res.stars[1]; rec.allRight += res.stars[2];
      const daily = foodNeeded(partySize(J), 'full', 1, animalOf(J.animal).feedLb || 0);
      rec.arriveFoodDays.push(J.food / daily);
      rec.maxCrawl = Math.max(rec.maxCrawl, J.totals.maxCrawlDays);
      nextLeg(J);
      sessions++; clock = 0;                      // a leg a session
    }
    rec.sessions = sessions - rec.sessionsStart;
    rec.cash = J.cash;
    rec.tokensPerLeg = (J.tokens - rec.tokens0) / Math.max(1, rec.legs);
    rec.done = J.done;
    out.push(rec);
    J = newSeason(J);
  }
  return out;
}

// ---- run ----
const runs = Array.from({ length: KIDS }, (_, i) => simulateKid(1000 + i * 7919));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const pad = (s, n) => String(s).padStart(n);

console.log(`\nWagon West economy: ${KIDS} kids, ${TRAIL.length} legs a season${LEGS.length < 12 ? ' (synthetic trail: content is a skeleton)' : ''}, ` +
  `markers ${KID.marker * 100}% · problems ${KID.problem * 100}% · words ${Math.round(KID.words * 3)}/3, ${KID.sessionS / 60}-min sessions\n`);
console.log('season   sessions (mean min-max)   cash at end (mean / p10 / min)   tokens/leg   stars/leg   food at arrival, days (mean / p10 / min)   crawl days/journey   max run   safety nets   leg minutes (mean / max)');
const rows = [];
for (let s = 0; s < SEASONS.length; s++) {
  const recs = runs.map((r) => r[s]);
  const sess = recs.map((r) => r.sessions), cash = recs.map((r) => r.cash), food = recs.flatMap((r) => r.arriveFoodDays);
  const legMin = recs.flatMap((r) => r.legSeconds.map((x) => x / 60));
  const row = { season: recs[0].season, sessMean: mean(sess), sessMin: Math.min(...sess), sessMax: Math.max(...sess), cashMean: mean(cash), cashP10: pct(cash, 0.1),
    cashMin: Math.min(...cash), tokens: mean(recs.map((r) => r.tokensPerLeg)), stars: mean(recs.map((r) => r.stars / r.legs)), foodMean: mean(food), foodP10: pct(food, 0.1),
    foodMin: Math.min(...food), crawl: mean(recs.map((r) => r.crawl)), maxRun: Math.max(...recs.map((r) => r.maxCrawl)), rescues: mean(recs.map((r) => r.rescues)),
    legMean: mean(legMin), legMax: Math.max(...legMin), allDone: recs.every((r) => r.done),
    happyShare: mean(recs.map((r) => r.happy / r.legs)), allRightShare: mean(recs.map((r) => r.allRight / r.legs)) };
  rows.push(row);
  console.log(`${row.season}    ${pad(f1(row.sessMean), 5)} ${pad(row.sessMin, 3)}-${row.sessMax}              $${pad(Math.round(row.cashMean), 5)} / $${pad(row.cashP10, 5)} / $${pad(row.cashMin, 5)}       ` +
    `${pad(f1(row.tokens), 5)}        ${pad(f1(row.stars), 4)}        ${pad(f1(row.foodMean), 5)} / ${pad(f1(row.foodP10), 4)} / ${pad(f1(row.foodMin), 4)}                     ` +
    `${pad(f1(row.crawl), 5)}           ${pad(row.maxRun, 3)}       ${pad(f1(row.rescues), 5)}       ${pad(f1(row.legMean), 5)} / ${pad(f1(row.legMax), 5)}`);
}
console.log('\nstars: ' + rows.map((r) => `${r.season} everyone happy on ${Math.round(r.happyShare * 100)} % of legs, every marker right on ${Math.round(r.allRightShare * 100)} %`).join(' · '));
console.log(`(start: $${START.cash} × the season's price level and ${START.food} lb; a safety net is a hunt / fishing hole / find when the food runs out, worth ≥ ${RESCUE.minLb} lb)`);

if (CHECK) {
  const problems = [];
  const stuck = runs.flat().filter((r) => r.maxCrawl > 3);
  if (stuck.length) problems.push(`${stuck.length} kid-seasons crawled with no food for more than 3 days in a row (max ${Math.max(...stuck.map((r) => r.maxCrawl))})`);
  if (!rows.every((r) => r.allDone)) problems.push('a kid did not finish a season');
  const first = runs.map((r) => r[0].sessions);
  if (Math.max(...first) > 16) problems.push(`the first season took ${Math.max(...first)} sessions (> 16)`);
  if (Math.min(...first) < 9) problems.push(`the first season took ${Math.min(...first)} sessions (< 9)`);
  if (Math.abs(rows[0].sessMean - 12) > 2) problems.push(`the first season's mean is ${f1(rows[0].sessMean)} sessions (target 12 ± 2)`);
  if (rows.some((r) => r.cashMin < 0)) problems.push('cash went below $0');
  if (problems.length) { console.log('\nCHECK FAILED:\n  ' + problems.join('\n  ')); process.exit(1); }
  console.log('\nCHECK PASSED: nobody stuck, first season ' + f1(rows[0].sessMean) + ` sessions (${Math.min(...first)}-${Math.max(...first)})`);
}

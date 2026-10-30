// Wagon West economy simulator (SPEC §5, §10), in the house style of Trail Blazer's: 40 simulated kids play the
// journey through the real sim (src/journey/*), a leg a session (12 minutes; a leg that does not fit carries over to
// the next session, the journey waits), answering 70 % of the mile markers right (half of those quick), 60 % of the
// word problems, 2 of 3 spelling words. Kids differ the way kids do: oxen or mules, a careful or a carefree hand on
// the rations dial, a brisk pace now and then, and shopping by eye (60 %-140 % of what the next stretch needs). They
// hunt (5 arrows, half hit: a rabbit, a turkey or a deer), fish (4 casts), trade what pelts they have, and write a
// letter at each fort. Prints, per season: sessions to finish, the cash at the end, tokens per leg, the food margin
// at arrivals, stars, crawl days and the safety nets; then the checks.
// v1.1 adds the side layer: a camp every third leg (fishing, the bow, Quick Draw, campfire tales, a rest), the daily
// challenge (a kid goes for it 70 % of the time when it is a camp / supper goal; the rest it meets by playing), the trail
// cards (landmark, nation, animal and companion drops; a duplicate pays a token), the Fort Derby at each fort (a coin
// flip), and the token sinks: the three wagon upgrades, bought with tokens when the kid has enough (else, once cash is
// plentiful, with cash). It prints the token flow per leg (earned by source, spent, the balance) and the album.
//   node wagon-west/tools/economy-sim.mjs            the table (40 kids, 3 seasons)
//   node wagon-west/tools/economy-sim.mjs --check    exit 1 if a kid gets stuck (food 0 for more than 3 days in a row)
//                                                    or the first season takes more than 16 or fewer than 9 sessions
//                                                    (and the target: the first season's mean is 12 ± 2 sessions)
// While src/content/legs.js is a skeleton the sim runs on route.syntheticTrail() (12 legs).
import {
  createJourney, tickDay, applyMarker, applyProblem, applyWords, applyHunt, applyFish, applyTrade, buy, arrive, nextLeg,
  newSeason, priceAt, foodToNextFort, setPace, setRations, tradeOffer, storeLeg, partySize,
  camp, awardCard, cardForLeg, cardForAnimal, buyUpgrade, upgradeCost, derbyPay, dailyChallenge, claimChallenge, suitComplete, UPGRADES,
} from '../src/journey/sim.js';
import { SUITS } from '../src/content/cards.js';
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
const KID = { goal: 0.7, quickDrawWin: 0.5, derbyWin: 0.5, campEvery: 3, cashRich: 6, cashFrom: 5,
  marker: 0.7, quickOfRight: 0.5, problem: 0.6, words: 2 / 3, trailProblems: [2, 3], storeProblems: [2, 4],
  huntHit: 0.5, castHit: 0.6, sessionS: 12 * 60 };
// seconds a thing takes on screen (SPEC §5: a day ≈ 6 s, a marker ≈ 15 s, the stop scene ≈ 3 min)
const SEC = { day: 6, marker: 15, markerFix: 12, problem: 25, problemFix: 20, word: 20, wordFix: 15, event: 10, hunt: 60,
  fish: 45, trade: 30, lookout: 15, store: 40, rope: 30, post: 20, results: 30, landmark: 30, home: 90,
  quickDraw: 120, tales: 40, rest: 10, derby: 40, claim: 5 };
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
  let lt = { problems: 0, camp: 0, challenge: 0, dup: 0, spent: 0 };   // the current leg's token flow
  const card = (c) => { if (c) lt.dup += awardCard(J, c.id).tokens; };
  const ask = (kind, fact) => {      // a word problem: right first try, or fixed
    const p = problemFor({ kind, fact, leg: J.legId, season: J.season, rand });
    const ok = rand() < KID.problem;
    lt.problems += applyProblem(J, { kind, correct: ok, firstTry: true }).tokens;
    spend(SEC.problem + (ok ? 0 : SEC.problemFix));
    return p;
  };
  // a camp activity (SPEC v1.1 §3): the sim's day, then what the app's mini-game would add
  const campOut = (kind) => {
    camp(J, kind, { rand });
    spend(SEC.day);
    if (kind === 'fish') { applyFish(J, { fishLb: fishLb(rand) }); spend(SEC.fish); }
    else if (kind === 'hunt' && J.opts.hunting) { const lb = huntLb(rand); applyHunt(J, { meatLb: lb }); if (lb > 0) card(cardForAnimal(rand() < 0.5 ? 'deer' : 'rabbit')); spend(SEC.hunt); }
    else if (kind === 'cards') { if (rand() < KID.quickDrawWin) { J.tokens++; lt.camp++; } spend(SEC.quickDraw); }
    else if (kind === 'tales') { J.tokens++; lt.camp++; card(CARD_OF_PARTY(rand)); spend(SEC.tales); }
    else spend(SEC.rest);
  };
  const CARD_OF_PARTY = (r) => ({ id: J.companions[Math.floor(r() * J.companions.length)] });
  // the Outfit's upgrade shelf: tokens first, then cash once it is plentiful
  const outfit = () => {
    for (const u of UPGRADES) {
      if (J.upgrades[u.id]) continue;
      const c = upgradeCost(J, u.id);
      if (J.tokens >= c.tokens) { if (buyUpgrade(J, u.id, { tokens: true })) { lt.spent += c.tokens; rec_.upTokens++; } }
      else if (J.legIndex >= KID.cashFrom && J.cash >= c.cash * KID.cashRich) { if (buyUpgrade(J, u.id, { cash: true })) rec_.upCash++; }
    }
  };
  let rec_ = null;
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
    rec_ = rec; rec.flow = []; rec.upTokens = 0; rec.upCash = 0; rec.challenges = 0; rec.challengesDone = 0; rec.camps = 0; rec.derbyCash = 0;
    shop();                                        // the Independence store
    for (let guard = 0; guard < 40 && !J.done; guard++) {
      const leg = legList()[J.legIndex];
      legTime = 0;
      // today's challenge (a session is a day); a camp / supper goal is gone for on purpose most of the time
      const ch = dailyChallenge(J, `kid${seed}-${s}-${J.legIndex}`);
      rec.challenges++;
      if ((ch.kind === 'camp' || ch.kind === 'supper') && rand() < KID.goal) { campOut('fish'); rec.camps++; }
      // a camp every third leg: the kid cycles fish, Quick Draw, the bow, tales, a rest
      if (J.legIndex % KID.campEvery === KID.campEvery - 1) { campOut(['fish', 'cards', 'hunt', 'tales', 'rest'][Math.floor(J.legIndex / KID.campEvery) % 5]); rec.camps++; }
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
          else if (e.kind === 'lookout') { card(cardForAnimal(e.animal)); spend(SEC.lookout); }
          else if (e.kind === 'bonus') card(cardForLeg(J, rand));
          if (e.kind === 'hunt' && J.legStats.hunted > 0) card(cardForAnimal(rand() < 0.5 ? 'deer' : 'rabbit'));
          if (e.kind === 'trade' && tradeOffer(J).nation) card({ id: tradeOffer(J).nation });
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
      // trail cards: the lookout's landmark card and one random card of the leg's biome at every arrival; the derby at a fort
      card({ id: leg.id }); card(cardForLeg(J, rand));
      if (kind === 'fort') {
        const won = rand() < KID.derbyWin;
        rec.derbyCash += derbyPay(J, { won, margin: 1 }).cash; spend(SEC.derby);
        if (won) card(cardForLeg(J, rand));
      }
      if (ch.check(J)) { const r = claimChallenge(J, ch.id); if (r.ok) { lt.challenge += r.tokens; card(cardForLeg(J, rand)); rec.challengesDone++; spend(SEC.claim); } }
      outfit();
      spend(SEC.results);
      rec.flow.push({ ...lt, bal: J.tokens }); lt = { problems: 0, camp: 0, challenge: 0, dup: 0, spent: 0 };
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
    rec.earned = rec.flow.reduce((a, f) => a + f.problems + f.camp + f.challenge + f.dup, 0);
    rec.tokensPerLeg = rec.earned / Math.max(1, rec.legs);
    rec.tokensEnd = J.tokens; rec.cards = J.cards.length; rec.suits = SUITS.filter((x) => suitComplete(J, x));
    rec.upgrades = Object.keys(J.upgrades).length;
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

// ---- v1.1: the token flow and the side layer ----
const src = (recs, k) => mean(recs.map((r) => r.flow.reduce((a, f) => a + f[k], 0) / Math.max(1, r.legs)));
console.log('\ntoken flow per leg (mean over the ' + KIDS + ' kids; problems = first-try word problems, camp = Quick Draw wins and campfire tales, challenge = the daily goal, dup = duplicate cards)');
for (let s = 0; s < SEASONS.length; s++) {
  const recs = runs.map((r) => r[s]);
  console.log(`\n${recs[0].season}   leg   problems   camp   challenge   dup   earned   spent   balance after`);
  for (let i = 0; i < TRAIL.length; i++) {
    const fl = recs.map((r) => r.flow[i]).filter(Boolean);
    const m = (k) => mean(fl.map((f) => f[k]));
    console.log(`        ${pad(i + 1, 3)}   ${pad(f1(m('problems')), 8)}   ${pad(f1(m('camp')), 4)}   ${pad(f1(m('challenge')), 9)}   ${pad(f1(m('dup')), 3)}   ${pad(f1(m('problems') + m('camp') + m('challenge') + m('dup')), 6)}   ${pad(f1(m('spent')), 5)}   ${pad(f1(m('bal')), 13)}`);
  }
}
console.log('\nseason   tokens earned/leg: problems / camp / challenge / dup   upgrades (by tokens / by cash / all three)   tokens left at end (mean / max)   cards (of 40)   full suits   challenge done   camps   derby cash');
const side = [];
for (let s = 0; s < SEASONS.length; s++) {
  const recs = runs.map((r) => r[s]);
  const row = { season: recs[0].season, problems: src(recs, 'problems'), camp: src(recs, 'camp'), challenge: src(recs, 'challenge'), dup: src(recs, 'dup'),
    upTok: mean(recs.map((r) => r.upTokens)), upCash: mean(recs.map((r) => r.upCash)), all3: recs.filter((r) => r.upgrades === 3).length / recs.length,
    endMean: mean(recs.map((r) => r.tokensEnd)), endMax: Math.max(...recs.map((r) => r.tokensEnd)), cards: mean(recs.map((r) => r.cards)),
    suits: mean(recs.map((r) => r.suits.length)), done: mean(recs.map((r) => r.challengesDone / Math.max(1, r.challenges))), camps: mean(recs.map((r) => r.camps)),
    derby: mean(recs.map((r) => r.derbyCash)), anyUp: recs.filter((r) => r.upgrades > 0).length / recs.length };
  side.push(row);
  console.log(`${row.season}    ${f1(row.problems)} / ${f1(row.camp)} / ${f1(row.challenge)} / ${f1(row.dup)}                              ${f1(row.upTok)} / ${f1(row.upCash)} / ${Math.round(row.all3 * 100)} %` +
    `                      ${f1(row.endMean)} / ${row.endMax}                 ${f1(row.cards)}        ${f1(row.suits)} of 4      ${Math.round(row.done * 100)} %          ${f1(row.camps)}     $${Math.round(row.derby)}`);
}
console.log('(camps: the scheduled one every third leg plus the camp a kid makes to go for a camp / supper goal; the three upgrades cost 20 tokens in all; cards and upgrades carry into the next season)');

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
  if (runs.flat().some((r) => r.flow.some((f) => f.bal < 0))) problems.push('the token balance went below 0');
  if (side[0].anyUp < 0.9) problems.push(`only ${Math.round(side[0].anyUp * 100)} % of kids bought an upgrade in the first season (< 90 %)`);
  if (side[0].done < 0.25 || side[0].done > 0.9) problems.push(`the daily challenge was done ${Math.round(side[0].done * 100)} % of days (want 25-90 %)`);
  const earned1 = side[0].problems + side[0].camp + side[0].challenge + side[0].dup;
  if (earned1 < 2 || earned1 > 8) problems.push(`${f1(earned1)} tokens earned a leg in the first season (want 2-8)`);
  if (problems.length) { console.log('\nCHECK FAILED:\n  ' + problems.join('\n  ')); process.exit(1); }
  console.log('\nCHECK PASSED: nobody stuck, first season ' + f1(rows[0].sessMean) + ` sessions (${Math.min(...first)}-${Math.max(...first)})`);
}

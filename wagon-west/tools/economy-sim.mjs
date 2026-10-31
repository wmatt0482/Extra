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
// v1.2 adds the trail as a game (SPEC v1.2): every kid picks three of the eight companions at random (so every skill is
// in play), eats by kind, shops for blankets / arrows / rope / spare parts (and forgets some of them now and then),
// crosses each river by a random choice of ford / float / ferry with a random number of soaked sacks or bumps, fixes the
// breakdowns the trail throws (working the optional problem out half the time), waits out some storms, brakes (or not) at
// a stampede, rafts the Columbia, talks to one or two people at every stop, buys the second yoke when it can, and earns
// deeds. It prints rivers, breakdowns, limps, cold nights, tired animals, people and deeds besides the economy.
//   node wagon-west/tools/economy-sim.mjs            the table (40 kids, 3 seasons)
//   node wagon-west/tools/economy-sim.mjs --check    exit 1 if a kid gets stuck (food 0 for more than 3 days in a row),
//                                                    the first season takes more than 16 or fewer than 9 sessions (the
//                                                    target: the first season's mean is 12 ± 2 sessions), soaked sacks
//                                                    average a leg or more, a season averages a limp or more, or the
//                                                    tokens earned a leg are outside 3-10
// While src/content/legs.js is a skeleton the sim runs on route.syntheticTrail() (12 legs).
import {
  createJourney, tickDay, applyMarker, applyProblem, applyWords, applyHunt, applyFish, applyTrade, buy, arrive, nextLeg,
  newSeason, priceAt, foodToNextFort, setPace, setRations, tradeOffer, storeLeg, partySize,
  camp, awardCard, cardForLeg, cardForAnimal, buyUpgrade, upgradeCost, derbyPay, dailyChallenge, claimChallenge, suitComplete, UPGRADES,
  repair, crossRiver, forecast, waitOut, meetPerson, peopleAt, raftPay, stampedePay, checkDeeds, needsBlankets, coldLegsAhead, huntAllowed, lookoutDrops,
  applyMarkerHint, skillOf, DEEDS,
} from '../src/journey/sim.js';
import { SUITS } from '../src/content/cards.js';
import { COMPANIONS } from '../src/content/companions.js';
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
  huntHit: 0.5, castHit: 0.6, sessionS: 12 * 60,
  // v1.2
  remembersBlankets: 0.5, remembersArrows: 0.75, remembersRope: 0.6, extraPart: 0.4, buysYoke: 0.8, yokeReserve: 120,
  river: { ford: 0.4, float: 0.3, ferry: 0.3 }, fordSoak: 0.35, floatBumps: [0.4, 0.3, 0.2, 0.1],   // chances of 0, 1, 2, 3 bumps
  workRepairOut: 0.5, waitStorm: 0.4, stampedeHold: 0.5, raftBumps: [0.25, 0.3, 0.25, 0.15, 0.05], talks: [1, 2], tipWork: 0.6 };
// seconds a thing takes on screen (SPEC §5: a day ≈ 6 s, a marker ≈ 15 s, the stop scene ≈ 3 min)
const SEC = { day: 6, marker: 15, markerFix: 12, problem: 25, problemFix: 20, word: 20, wordFix: 15, event: 10, hunt: 60,
  fish: 45, trade: 30, lookout: 15, store: 40, rope: 30, post: 20, results: 30, landmark: 30, home: 90,
  quickDraw: 120, tales: 40, rest: 10, derby: 40, claim: 5,
  // v1.2
  ford: 25, float: 45, ferryTalk: 10, repair: 12, stampede: 40, raft: 90, person: 12, deed: 6, wait: 8 };
const FACTS = ['3x4', '6x7', '7x8', '4x9', '8x6', '56/7', '42/6', '5x12', '9x9', '72/8'];
const ANIMALS_HUNTED = [[4, 0.45], [10, 0.35], [40, 0.2]];    // rabbit, turkey, deer: lb and how often
const ALL_COMPANIONS = COMPANIONS.map((c) => c.id);

function huntLb(rand) {
  let lb = 0;
  for (let s = 0; s < 5; s++) if (rand() < KID.huntHit) { let r = rand(); for (const [w, p] of ANIMALS_HUNTED) { if (r < p) { lb += w; break; } r -= p; } }
  return lb;
}
function fishLb(rand) { let lb = 0; for (let c = 0; c < 4; c++) if (rand() < KID.castHit) lb += 2 + Math.floor(rand() * 5); return lb; }
// a pick from a list of chances (index i with chance list[i])
function chance(rand, list) { let r = rand(); for (let i = 0; i < list.length; i++) { if (r < list[i]) return i; r -= list[i]; } return list.length - 1; }

// one sim kid's whole history over `seasons` journeys
function simulateKid(seed, seasons = 3) {
  const rand = mulberry32(seed);
  const careful = rand() < 0.5;
  const animal = rand() < 0.5 ? 'oxen' : 'mules';
  const party = [...ALL_COMPANIONS].map((id) => [rand(), id]).sort((a, b) => a[0] - b[0]).slice(0, 3).map((x) => x[1]);
  const out = [];
  let J = createJourney({ season: SEASONS[0].id, wagonName: 'Kid ' + seed, animal, companions: party, seed });
  let clock = 0;                     // seconds into the current session
  let legTime = 0;                   // seconds spent on the current leg (across sessions)
  let sessions = 1;
  const spend = (s) => { clock += s; legTime += s; };
  let lt = { problems: 0, camp: 0, challenge: 0, dup: 0, spent: 0, deed: 0 };   // the current leg's token flow
  const card = (c) => { if (c) lt.dup += awardCard(J, c.id).tokens; };
  const cardId = (id) => { if (id) lt.dup += awardCard(J, id).tokens; };
  const ask = (kind, fact) => {      // a word problem: right first try, or fixed
    const p = problemFor({ kind, fact, leg: J.legId, season: J.season, rand });
    const ok = rand() < KID.problem;
    lt.problems += applyProblem(J, { kind, correct: ok, firstTry: true }).tokens;
    spend(SEC.problem + (ok ? 0 : SEC.problemFix));
    return p;
  };
  // a camp activity (SPEC v1.1 §3): the sim's day, then what the app's mini-game would add
  const campOut = (kind) => {
    let k = kind;
    if (k === 'hunt' && !(J.opts.hunting && huntAllowed(J))) k = 'fish';   // no arrows: the camp offers fishing only
    const c = camp(J, k, { rand });
    spend(SEC.day);
    if (k === 'fish') { applyFish(J, { fishLb: fishLb(rand) }); spend(SEC.fish); }
    else if (k === 'hunt') { const lb = huntLb(rand); applyHunt(J, { meatLb: lb }); if (lb > 0) card(cardForAnimal(rand() < 0.5 ? 'deer' : 'rabbit')); spend(SEC.hunt); }
    else if (k === 'cards') { if (rand() < KID.quickDrawWin) { J.tokens++; lt.camp++; } spend(SEC.quickDraw); }
    else if (k === 'tales') { J.tokens++; lt.camp++; card(CARD_OF_PARTY(rand)); if (c.cardDrop) card(cardForLeg(J, rand)); spend(SEC.tales); }
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
    // v1.2: a spare part (some buy two), blankets before a cold leg, arrows for the bow, a coil of rope, the second yoke
    if (J.parts < 1 || (J.parts < 2 && rand() < KID.extraPart)) { if (buy(J, { item: 'parts', qty: 1 }).ok) rec_.partsBought++; }
    const cold = coldLegsAhead(J);
    if (cold.length) { const need = needsBlankets(J, cold[0]).need; if ((J.goods.blankets | 0) < need && rand() < KID.remembersBlankets) buy(J, { item: 'blankets', qty: need - (J.goods.blankets | 0) }); }
    if (J.opts.hunting && (J.goods.arrows | 0) < 10 && rand() < KID.remembersArrows) buy(J, { item: 'arrows', qty: 2 });
    if ((J.goods.rope | 0) < 1 && rand() < KID.remembersRope) buy(J, { item: 'rope', qty: 1 });
    if (J.animals.n < 4 && rand() < KID.buysYoke) {
      const p = priceAt('yoke', storeLeg(J), J.season);
      if (J.cash >= p + KID.yokeReserve * SEASONS.find((x) => x.id === J.season).priceMult && buy(J, { item: 'yoke', qty: 1 }).ok) { rec_.yoke = true; rec_.yokeLeg = rec_.yokeLeg ?? J.legIndex; }
    }
  };
  const dials = () => {
    if (careful) {
      const plan = foodToNextFort({ ...J, rations: 'full' });
      setRations(J, J.food >= plan.lb * 1.05 ? 'full' : J.food >= plan.lb * 0.7 ? 'plenty' : 'lean');
    } else setRations(J, rand() < 0.8 ? 'full' : 'plenty');
    setPace(J, rand() < 0.3 ? 'brisk' : 'steady');
  };
  // a person at a stop: the Talk row; a gift of food is applied, a card awarded, a tip is a parts problem, a trade runs like a post
  const talk = () => {
    const here = peopleAt(J, J.legId);
    const n = Math.min(here.length, KID.talks[0] + Math.floor(rand() * (KID.talks[1] - KID.talks[0] + 1)));
    const pool = here.filter((p) => !p.met);
    for (let i = 0; i < n && pool.length; i++) {
      const p = pool.splice(Math.floor(rand() * pool.length), 1)[0];
      const m = meetPerson(J, p.id); spend(SEC.person); rec_.people++;
      const g = m.gift;
      if (!g) continue;
      if (g.kind === 'card') cardId(g.card);
      else if (g.kind === 'tip') { if (rand() < KID.tipWork) ask('parts', FACTS[Math.floor(rand() * FACTS.length)]); }
      else if (g.kind === 'trade') { const have = J.goods[g.give] | 0; if (have >= g.rate[0]) { const k = Math.floor(have / g.rate[0]); applyTrade(J, { giveN: k * g.rate[0], getN: k * g.rate[1], give: g.give, get: g.get }); spend(SEC.trade); } }
    }
  };
  for (let s = 0; s < seasons; s++) {
    const rec = { season: J.season, sessionsStart: sessions, legs: 0, tokens0: J.tokens, arriveFoodDays: [], stars: 0, crawl: 0,
      maxCrawl: 0, rescues: 0, legSeconds: [], leftovers: 0, happy: 0, allRight: 0,
      // v1.2 counters
      rivers: { ford: 0, float: 0, ferry: 0 }, soakedSacks: 0, soakedRivers: 0, breakdowns: 0, repairs: 0, limps: 0, freeFixes: 0, partsBought: 0, coldNights: 0,
      coldLegs: 0, tiredDays: 0, days: 0, yoke: false, yokeLeg: null, people: 0, stampedes: 0, stampedesHeld: 0, raftBumps: null, waits: 0, spotted: 0, deedTokens: 0,
      hinted: 0, arrowsOut: 0, limpDays: 0 };
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
      // Nora's tip: the hint before the answer, once a leg (the sim counts it; the marker odds do not change)
      let trailProblemsLeft = KID.trailProblems[0] + Math.floor(rand() * (KID.trailProblems[1] - KID.trailProblems[0] + 1));
      if (leg.id === 'willamette-valley') {
        // the last leg runs as the Columbia raft (SPEC v1.2 §4): a few bumps, four markers' worth of play, the pay
        const bumps = chance(rand, KID.raftBumps); raftPay(J, { bumps }); spend(SEC.raft); rec.raftBumps = bumps;
      }
      for (let d = 0; d < 400; d++) {
        if (clock >= KID.sessionS) { sessions++; clock = 0; rec.leftovers++; }   // the session ends mid-leg; the journey waits
        // the weather forecast: some kids wait a storm out at camp
        const f = forecast(J);
        if (f.next !== 'clear' && rand() < KID.waitStorm) { waitOut(J, { rand }); spend(SEC.day + SEC.wait); rec.waits++; }
        const r = tickDay(J, { rand });
        spend(SEC.day); rec.days++;
        if (r.crawl) { rec.crawl++; }
        if (r.animalsTired) rec.tiredDays++;
        if (r.coldNight) rec.coldNights++;
        if (r.spotted) { rec.spotted++; cardId(r.spotted.card); }
        if (J.limp) rec.limpDays++;
        if (r.marker) {
          if (skillOf(J, 'tips') && applyMarkerHint(J).used) rec.hinted++;
          const ok = rand() < KID.marker; applyMarker(J, { correct: ok, quick: ok && rand() < KID.quickOfRight }); spend(SEC.marker + (ok ? 0 : SEC.markerFix));
        }
        if (r.event) {
          const e = r.event;
          if (e.rescue) rec.rescues++;
          spend(SEC.event);
          if (e.kind === 'hunt') { applyHunt(J, { meatLb: e.canHunt === false ? 0 : huntLb(rand) }); spend(SEC.hunt); }
          else if (e.kind === 'fish') { applyFish(J, { fishLb: fishLb(rand) }); spend(SEC.fish); }
          else if (e.kind === 'trade') { const o = tradeOffer(J); const p = problemFor({ kind: 'trade', fact: FACTS[Math.floor(rand() * FACTS.length)], leg: J.legId, season: J.season, rand, have: o.have }); applyProblem(J, { kind: 'trade', correct: rand() < KID.problem }); applyTrade(J, p.meta); spend(SEC.trade); }
          else if (e.kind === 'breakdown') {
            rec.breakdowns++;
            const worked = rand() < KID.workRepairOut;
            if (worked) ask('parts', FACTS[Math.floor(rand() * FACTS.length)]);
            const rp = repair(J, { workedOut: worked }); spend(SEC.repair);
            if (rp.fixed) { rec.repairs++; if (!rp.usedPart) rec.freeFixes++; } else rec.limps++;
          }
          else if (e.kind === 'problem') ask(e.problem === 'parts' ? 'parts' : 'buy', FACTS[Math.floor(rand() * FACTS.length)]);
          else if (e.kind === 'stampede') { const held = rand() < KID.stampedeHold; const sp = stampedePay(J, { held }); rec.stampedes++; if (held) { rec.stampedesHeld++; cardId(sp.card); } spend(SEC.stampede); }
          else if (e.kind === 'lookout') { card(cardForAnimal(e.animal)); spend(SEC.lookout); }
          else if (e.kind === 'bonus') card(cardForLeg(J, rand));
          if (e.kind === 'hunt' && J.legStats.hunted > 0) card(cardForAnimal(rand() < 0.5 ? 'deer' : 'rabbit'));
          if (e.kind === 'trade' && tradeOffer(J).nation) card({ id: tradeOffer(J).nation });
        }
        // the trail problems: one when the rations dial moves or a landmark is sighted, a few a leg (optional now: Ask Eli, for a token)
        if (trailProblemsLeft > 0 && d > 0 && d % 3 === 0) { ask(trailProblemsLeft % 2 ? 'ration' : 'distance', FACTS[Math.floor(rand() * FACTS.length)]); trailProblemsLeft--; }
        if (d % 4 === 3) dials();
        if (r.arrived) break;
      }
      // the stop
      const res = arrive(J);
      const kind = leg.stop.kind;
      if (kind === 'river') {
        // SPEC v1.2 §3: ford, float or ferry, by chance; a soaked sack (a missed beat) or bumps (a missed rock); the ferry's fare is the words
        const way = ['ford', 'float', 'ferry'][chance(rand, [KID.river.ford, KID.river.float, KID.river.ferry])];
        let c;
        if (way === 'ford') { c = crossRiver(J, { how: 'ford', soaked: rand() < KID.fordSoak ? 1 : 0 }); spend(SEC.ford); }
        else if (way === 'float') { c = crossRiver(J, { how: 'float', bumps: chance(rand, KID.floatBumps) }); spend(SEC.float); }
        else { words(); c = crossRiver(J, { how: 'ferry' }); spend(SEC.ferryTalk); }
        rec.rivers[way]++; if (c.soakedLb > 0) { rec.soakedSacks += Math.ceil(c.soakedLb / 25); rec.soakedRivers++; }
      } else if (kind === 'fort') { shop(); spend(SEC.post); words(); keepLetter(J, composeLetter(J, null, ['enough', 'through', 'buffalo'])); }
      else if (kind === 'home') spend(SEC.home);
      else spend(SEC.landmark);
      // people at the stop, then trail cards: the lookout's landmark card (two with Ines) and one random card of the leg's biome at every arrival; the derby at a fort
      talk();
      for (let i = 0; i < lookoutDrops(J).cards; i++) { if (i === 0) card({ id: leg.id }); else card(cardForLeg(J, rand)); }
      card(cardForLeg(J, rand));
      if (kind === 'fort') {
        const won = rand() < KID.derbyWin;
        rec.derbyCash += derbyPay(J, { won, margin: 1 }).cash; spend(SEC.derby);
        if (won) card(cardForLeg(J, rand));
      }
      if (ch.check(J)) { const r = claimChallenge(J, ch.id); if (r.ok) { lt.challenge += r.tokens; card(cardForLeg(J, rand)); rec.challengesDone++; spend(SEC.claim); } }
      const deeds = checkDeeds(J); lt.deed += deeds.length; rec.deedTokens += deeds.length; if (deeds.length) spend(SEC.deed);
      outfit();
      spend(SEC.results);
      rec.flow.push({ ...lt, bal: J.tokens }); lt = { problems: 0, camp: 0, challenge: 0, dup: 0, spent: 0, deed: 0 };
      rec.legSeconds.push(legTime);
      rec.legs++; rec.stars += res.stars.filter(Boolean).length; rec.happy += res.stars[1]; rec.allRight += res.stars[2];
      const daily = foodNeeded(partySize(J), 'full', 1, animalOf(J.animal).feedLb || 0);
      rec.arriveFoodDays.push(J.food / daily);
      rec.maxCrawl = Math.max(rec.maxCrawl, J.totals.maxCrawlDays);
      if ((J.goods.arrows | 0) < 5) rec.arrowsOut++;
      nextLeg(J);
      sessions++; clock = 0;                      // a leg a session
    }
    rec.sessions = sessions - rec.sessionsStart;
    rec.cash = J.cash;
    rec.earned = rec.flow.reduce((a, f) => a + f.problems + f.camp + f.challenge + f.dup + f.deed, 0);
    rec.tokensPerLeg = rec.earned / Math.max(1, rec.legs);
    rec.tokensEnd = J.tokens; rec.cards = J.cards.length; rec.suits = SUITS.filter((x) => suitComplete(J, x));
    rec.upgrades = Object.keys(J.upgrades).length;
    rec.deeds = J.deeds.length; rec.met = J.met.length; rec.party = party.slice();
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
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
const pad = (s, n) => String(s).padStart(n);

console.log(`\nWagon West economy: ${KIDS} kids, ${TRAIL.length} legs a season${LEGS.length < 12 ? ' (synthetic trail: content is a skeleton)' : ''}, ` +
  `markers ${KID.marker * 100}% · problems ${KID.problem * 100}% · words ${Math.round(KID.words * 3)}/3, ${KID.sessionS / 60}-min sessions, a random party of three each\n`);
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
console.log('\ntoken flow per leg (mean over the ' + KIDS + ' kids; problems = first-try word problems, camp = Quick Draw wins and campfire tales, challenge = the daily goal, dup = duplicate cards, deed = deeds earned)');
for (let s = 0; s < SEASONS.length; s++) {
  const recs = runs.map((r) => r[s]);
  console.log(`\n${recs[0].season}   leg   problems   camp   challenge   dup   deed   earned   spent   balance after`);
  for (let i = 0; i < TRAIL.length; i++) {
    const fl = recs.map((r) => r.flow[i]).filter(Boolean);
    const m = (k) => mean(fl.map((f) => f[k]));
    console.log(`        ${pad(i + 1, 3)}   ${pad(f1(m('problems')), 8)}   ${pad(f1(m('camp')), 4)}   ${pad(f1(m('challenge')), 9)}   ${pad(f1(m('dup')), 3)}   ${pad(f1(m('deed')), 4)}   ${pad(f1(m('problems') + m('camp') + m('challenge') + m('dup') + m('deed')), 6)}   ${pad(f1(m('spent')), 5)}   ${pad(f1(m('bal')), 13)}`);
  }
}
console.log('\nseason   tokens earned/leg: problems / camp / challenge / dup / deed   upgrades (by tokens / by cash / all three)   tokens left at end (mean / max)   cards (of 40)   full suits   challenge done   camps   derby cash');
const side = [];
for (let s = 0; s < SEASONS.length; s++) {
  const recs = runs.map((r) => r[s]);
  const row = { season: recs[0].season, problems: src(recs, 'problems'), camp: src(recs, 'camp'), challenge: src(recs, 'challenge'), dup: src(recs, 'dup'), deed: src(recs, 'deed'),
    upTok: mean(recs.map((r) => r.upTokens)), upCash: mean(recs.map((r) => r.upCash)), all3: recs.filter((r) => r.upgrades === 3).length / recs.length,
    endMean: mean(recs.map((r) => r.tokensEnd)), endMax: Math.max(...recs.map((r) => r.tokensEnd)), cards: mean(recs.map((r) => r.cards)),
    suits: mean(recs.map((r) => r.suits.length)), done: mean(recs.map((r) => r.challengesDone / Math.max(1, r.challenges))), camps: mean(recs.map((r) => r.camps)),
    derby: mean(recs.map((r) => r.derbyCash)), anyUp: recs.filter((r) => r.upgrades > 0).length / recs.length };
  side.push(row);
  console.log(`${row.season}    ${f1(row.problems)} / ${f1(row.camp)} / ${f1(row.challenge)} / ${f1(row.dup)} / ${f1(row.deed)}                       ${f1(row.upTok)} / ${f1(row.upCash)} / ${Math.round(row.all3 * 100)} %` +
    `                      ${f1(row.endMean)} / ${row.endMax}                 ${f1(row.cards)}        ${f1(row.suits)} of 4      ${Math.round(row.done * 100)} %          ${f1(row.camps)}     $${Math.round(row.derby)}`);
}
console.log('(camps: the scheduled one every third leg plus the camp a kid makes to go for a camp / supper goal; the three upgrades cost 20 tokens in all; cards, deeds and upgrades carry into the next season)');

// ---- v1.2: the trail as a game ----
console.log('\nv1.2 per season, mean over the ' + KIDS + ' kids: rivers (ford / float / ferry), soaked sacks a leg, breakdowns, repairs (free by Ada or Tomas), limps, limp days, cold nights, forced-steady days, spare parts bought, yoke bought, people met, stampedes held, waited-out storms, spotted animals, deeds');
const v12 = [];
for (let s = 0; s < SEASONS.length; s++) {
  const recs = runs.map((r) => r[s]);
  const row = { season: recs[0].season, ford: mean(recs.map((r) => r.rivers.ford)), float: mean(recs.map((r) => r.rivers.float)), ferry: mean(recs.map((r) => r.rivers.ferry)),
    soakedPerLeg: mean(recs.map((r) => r.soakedSacks / Math.max(1, r.legs))), breakdowns: mean(recs.map((r) => r.breakdowns)), repairs: mean(recs.map((r) => r.repairs)),
    free: mean(recs.map((r) => r.freeFixes)), limps: mean(recs.map((r) => r.limps)), limpDays: mean(recs.map((r) => r.limpDays)), cold: mean(recs.map((r) => r.coldNights)),
    tired: mean(recs.map((r) => r.tiredDays)), parts: mean(recs.map((r) => r.partsBought)), yoke: recs.filter((r) => r.yoke).length / recs.length,
    people: mean(recs.map((r) => r.people)), held: mean(recs.map((r) => r.stampedesHeld)), stampedes: mean(recs.map((r) => r.stampedes)), waits: mean(recs.map((r) => r.waits)),
    spotted: mean(recs.map((r) => r.spotted)), deeds: mean(recs.map((r) => r.deeds)), hinted: mean(recs.map((r) => r.hinted)) };
  v12.push(row);
  console.log(`${row.season}   rivers ${f1(row.ford)} / ${f1(row.float)} / ${f1(row.ferry)}   soaked sacks ${f2(row.soakedPerLeg)} a leg   breakdowns ${f1(row.breakdowns)}   repairs ${f1(row.repairs)} (${f1(row.free)} free)   limps ${f2(row.limps)} (${f1(row.limpDays)} days)   ` +
    `cold nights ${f1(row.cold)}   forced steady ${f1(row.tired)} days   parts bought ${f1(row.parts)}   yoke ${Math.round(row.yoke * 100)} %   people ${f1(row.people)}   stampedes held ${f1(row.held)} of ${f1(row.stampedes)}   waits ${f1(row.waits)}   spotted ${f1(row.spotted)}   deeds ${f1(row.deeds)} of ${DEEDS.length}`);
}
{
  const first = runs.map((r) => r[0]);
  const byParty = {};
  for (const id of ALL_COMPANIONS) {
    const withId = first.filter((r) => r.party.includes(id));
    byParty[id] = withId.length ? { n: withId.length, sess: mean(withId.map((r) => r.sessions)), tok: mean(withId.map((r) => r.tokensPerLeg)), limps: mean(withId.map((r) => r.limps)), cold: mean(withId.map((r) => r.coldNights)), soak: mean(withId.map((r) => r.soakedSacks / r.legs)) } : null;
  }
  console.log('\nby companion (first season, kids who took them): ' + ALL_COMPANIONS.map((id) => byParty[id] ? `${id} ×${byParty[id].n} (limps ${f2(byParty[id].limps)}, soaked ${f2(byParty[id].soak)} a leg, tokens ${f1(byParty[id].tok)} a leg)` : `${id} ×0`).join(' · '));
}

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
  // v1.2: soaked sacks < 1 a leg, limps < 1 a season, tokens 3-10 a leg
  for (const r of v12) {
    if (r.soakedPerLeg >= 1) problems.push(`${r.season}: ${f2(r.soakedPerLeg)} soaked sacks a leg (want < 1)`);
    if (r.limps >= 1) problems.push(`${r.season}: ${f2(r.limps)} limps a season (want < 1)`);
  }
  for (const r of rows) if (r.tokens < 3 || r.tokens > 10) problems.push(`${r.season}: ${f1(r.tokens)} tokens earned a leg (want 3-10)`);
  if (problems.length) { console.log('\nCHECK FAILED:\n  ' + problems.join('\n  ')); process.exit(1); }
  console.log('\nCHECK PASSED: nobody stuck, first season ' + f1(rows[0].sessMean) + ` sessions (${Math.min(...first)}-${Math.max(...first)}), soaked sacks ${f2(v12[0].soakedPerLeg)} a leg, limps ${f2(v12[0].limps)} a season, tokens ${f1(rows[0].tokens)} a leg`);
}

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
// v1.3 (money is a choice): the same kids are run as three players (strong 90 % right, average 70 %, weak 45 %), each
// shopping by eye and each with a "buys everything useful" policy (food for the next stretch, blankets before a cold leg,
// a second part, arrows, rope, the second yoke: in that order, skipping what the cash will not cover). It prints the cash
// on hand at every stop for all six, the wish list against the cash at the five stores, and TARGETS, which --check enforces.
// v1.4 (Frodo and the river, SPEC v1.4 §7.2): the same kids also keep the dog (80 % at the Kansas River, half of the rest at a fort's store), call the rabbit back
// 70 % of the time, take every trail fact and dust devil, fetch at every camp, skip stones at 60 % of the river stops (and at camps by a river), watch the falling stars
// when they are offered, fish with fishing 2.0 (60 % of the casts hooked, 85 % of the fights landed, grasshoppers at a third of the fishing camps, the spoon bought by a
// quarter of the kids), sell the old iron and follow every quest 70 % of the time (the rest are mailed). It prints a v1.4 line per season; --check adds: the free fishing
// session within 10 % of 1.3's 9.6 lb, the mandatory v1.4 seconds a leg (nose + fact + dust devil) at most 60, a nose moment on 95 % of the legs with the dog, the locket
// given back or mailed by every kid who kept the dog, under one token a leg from the dust devil, the quests and the new deeds. The 1.3 TARGETS stand, except the two lower
// bounds of `choices` (see TARGETS: the sim now runs the dog's berry patch, which it never did).
// v1.5 (The Long Trail, SPEC v1.5 §7.2): every journey is a (route, tier) cell. The baseline cell is Rookie Oregon by Fort Bridger and the raft (the 1.3 trail grown to 20 legs):
// the three profiles × two shopping policies as in 1.3, a kid's history Rookie → Veteran → Pioneer (cards, deeds, the dog and the tokens carry), and the 1.3 TARGETS unchanged
// (end cash, the gaps, fort cash at the four forts, choices of 5 stores, the yoke rules, a lean weak player who finishes) plus sessions 20 ± 2, leg minutes mean 8-10 and at most 14,
// tokens 60-140 a journey. The other cells (the Barlow Road, the Sublette Cutoff, the Lander Road, California, the Gold Road) are run by the same kids with the route's play: the
// toll, Laurel Hill, the dry stretch and the water barrel, the panning and the rocker, the voyage. Each prints its own table and has its own targets (see ROUTE_TARGETS). The kids'
// ladder tier (strong 2, average 1, weak 0) shapes the problems (problemFor's `tier`, SPEC §3.9) and only costs a little more time on a two-step problem.
//   node wagon-west/tools/economy-sim.mjs            the table (40 kids, 3 tiers on the baseline route; every route's table)
//   node wagon-west/tools/economy-sim.mjs --homestead  a kid's whole history (Oregon, the Gold Road, then the route the profile prefers): the farm's pace
//   node wagon-west/tools/economy-sim.mjs --check    exit 1 if a kid gets stuck (food 0 for more than 3 days in a row),
//                                                    the first season takes more than 16 or fewer than 9 sessions (the
//                                                    target: the first season's mean is 12 ± 2 sessions), soaked sacks
//                                                    average a leg or more, a season averages a limp or more, or the
//                                                    tokens earned a journey are outside 60-140, or any of the v1.3 money TARGETS is missed
//                                                    (cushion, choices, the yoke, a lean weak player who finishes)
// v1.7.1 (food is a consideration again): the wagon carries at most LOAD.foodLb of food and a heavy wagon's damp flour is set aside at a stop (economy.js LOAD, DAMP). The sim prints
// the food on arrival in pounds on every route for the three players by eye and for "forager" kids (the 1.5 playtest bot's play: a camp at every stop to hunt or fish, every person
// met, food bought to the store's hint), and --check adds TARGETS.food (the limit holds, the strong player arrives with 200-600 lb, the weak player is fed as 1.3 allows).
// While src/content/legs.js is a skeleton the sim runs on route.syntheticTrail() (12 legs).
const {
  createJourney, tickDay, applyMarker, applyProblem, applyWords, applyHunt, applyFish, applyTrade, buy, arrive, nextLeg,
  newSeason, startSeason, priceAt, foodToNextFort, setPace, setRations, tradeOffer, storeLeg, partySize,
  camp, awardCard, cardForLeg, cardForAnimal, buyUpgrade, upgradeCost, derbyPay, dailyChallenge, claimChallenge, suitComplete, UPGRADES,
  repair, crossRiver, forecast, waitOut, meetPerson, peopleAt, raftPay, stampedePay, checkDeeds, needsBlankets, coldLegsAhead, huntAllowed, lookoutDrops,
  applyMarkerHint, skillOf, DEEDS, yokeOffered,
  // v1.4
  adoptDog, dogOfferAt, chaseResult, fetchThrow, sellHorseshoes, fishingSession, landCast, castOff, endFishing, catchHoppers, questAt, questTalk, questMail,
  heardFact, dustDevilResult, stonesPlan, stonesResult, campWater, meteorsTonight, wishFor,
  // v1.5
  chooseBranch, payToll, applySnub, sailPay, applyGold, panOutcome, rockerOutcome, goldAt, nuggetsOf, closeJourney, newLedger, newFarm, tiersOpen, buildPiece, canBuild, homesteadView,
  farmBalance, writeOnRock, checkSets, TIER_FX, tierOf,
  // v1.6 (The Lab): the six choice moments
  applyChoice, SHORTCUT, GUIDE,
} = await import('../src/journey/sim.js');
const { CARD_BY_ID } = await import('../src/content/cards.js');
const { RIVER_STOPS } = await import('../src/content/fish.js');
const { SUITS } = await import('../src/content/cards.js');
const { COMPANIONS } = await import('../src/content/companions.js');
const { problemFor } = await import('../src/journey/problems.js');
const { composeLetter, keepLetter } = await import('../src/journey/letters.js');
const { foodNeeded, lbOf, START, RESCUE } = await import('../src/journey/economy.js');
const LOAD = (await import('../src/journey/economy.js')).LOAD || { foodLb: Infinity };      // v1.7.1: the wagon's carrying limit for food
const { legList, animalOf } = await import('../src/journey/route.js');
const { HOMESTEAD_COST } = await import('../src/journey/economy.js');
const { PIECE_BY_ID, HOMESTEAD_PIECES } = await import('../src/content/homestead.js');
const { mulberry32 } = await import('../src/journey/rng.js');

const CHECK = process.argv.includes('--check');
const KIDS = 40;
const HOMESTEAD = process.argv.includes('--homestead');
const TIER_IDS = ['rookie', 'veteran', 'pioneer'];
const PROFILE_KEYS = ['strong', 'average', 'weak'];
const SEASONS = TIER_IDS.map((id) => ({ id, priceMult: TIER_FX[id].priceMult }));      // (the three tiers; the 1.3 sim called them seasons)
createJourney({ seed: 1 });                                                            // installs the default emigrant plan (20 legs)
const TRAIL = legList().slice();
const LEGS = TRAIL;

// ---- the kid ----
const KID = { goal: 0.7, quickDrawWin: 0.5, derbyWin: 0.5, campEvery: 3, cashRich: 6, cashFrom: 5,
  marker: 0.7, quickOfRight: 0.5, problem: 0.6, words: 2 / 3, trailProblems: [2, 3], storeProblems: [2, 2], ladder: 1, panSkill: 0.65, smooth: 0.6,
  huntHit: 0.5, castHit: 0.6, sessionS: 12 * 60,
  // v1.2
  remembersBlankets: 0.5, remembersArrows: 0.75, remembersRope: 0.6, extraPart: 0.4, buysYoke: 0.8, yokeReserve: 15,
  river: { ford: 0.4, float: 0.3, ferry: 0.3 }, fordSoak: 0.35, floatBumps: [0.4, 0.3, 0.2, 0.1],   // chances of 0, 1, 2, 3 bumps
  workRepairOut: 0.5, waitStorm: 0.4, stampedeHold: 0.5, raftBumps: [0.25, 0.3, 0.25, 0.15, 0.05], talks: [1, 2], tipWork: 0.6 };
// the three players of SPEC v1.3: how often they are right (markers, word problems, spelling words)
const PROFILES = {
  strong: { marker: 0.9, problem: 0.9, words: 0.9, ladder: 2, panSkill: 0.85, smooth: 0.8 },
  average: { marker: 0.7, problem: 0.7, words: 0.7, ladder: 1, panSkill: 0.65, smooth: 0.6 },
  weak: { marker: 0.45, problem: 0.45, words: 0.45, ladder: 0, panSkill: 0.45, smooth: 0.4 },
};
const BASE_KID = { ...KID };
// What --check enforces about money (Rookie year, 1847 dollars; the other seasons scale with the price level, so the same
// numbers times 2 and 4 apply, within `seasonSlack`). Two ways of shopping are run for each player: "by eye" (the natural kid:
// flour first for the next stretch by eye, then the extras it remembers) and "buys all" (the policy that wants every useful
// thing at every store, in the order food, blankets, a second part, arrows, rope, the yoke, and skips what the cash will not
// cover). A CHOICE is a store (of the five: Independence and the four forts) where that wish list costs more than the cash in
// hand on arrival, after the leg's pay. The five stores are the only places cash is spent, so the cash that is left at the end
// is mostly the last four legs' pay (no store after Fort Hall) plus the Columbia raft: a cushion, not a score to chase.
const TARGETS = {
  // cash at the end of the journey, mean of the kids, by eye: the strong kid has a modest cushion, the weak one a thin one
  end: { strong: [70, 150], average: [40, 100], weak: [25, 80] },
  endGap: { strongOverAverage: 20, averageOverWeak: 5 },      // the better player ends with at least this much more
  endMaxAny: 220,                                              // and no kid, however strong, ends with a pile
  // mean cash on arrival at the four forts (Kearny, Laramie, Bridger, Hall), by eye: comfortable / enough to choose / lean
  fortCash: { strong: [75, 130], average: [55, 85], weak: [30, 65] },
  // choices (stores short of the wish list, of 5), buys-all kids: the average player must choose often, the weak one nearly always,
  // the strong one now and then (so a store is still a decision for a child who answers well)
  // v1.4: the sim now runs the dog's berry patch (20 lb every other leg, about 100 lb a journey, 1.1's app event that the 1.3 sim never ran) and Molly's 10 lb of
  // apples, so the buys-all wish list (food first) is a little cheaper: the lower bounds of strong and average moved from 1 and 3 to 0.7 and 2.7. Nothing else moved.
  choices: { strong: [0.7, 3], average: [2.7, 5], weak: [3.5, 5] },
  // the second yoke (offered from Fort Kearny, never at Independence): the strong kid mostly gets one, but not all at the first
  // store that has it; the weak kid rarely; the average kid's buys-all run buys it in some journeys but not most
  yoke: { strongBy: 0.5, strongAtKearnyMax: 0.35, weakMax: 0.25, averageBuysAll: [0.15, 0.7] },
  // the weak player runs lean and still finishes: every season, at most this many sessions, never more than 3 days in a row
  // with no food, and on average at most this many days of it a journey
  weak: { sessionsMax: 24, crawlRunMax: 3, crawlDaysMax: 2 },      // (v1.5: 24 sessions on the 20-leg trail; was 16 on 12)
  seasonSlack: [0.7, 1.3],                                      // the later seasons' end cash / price level, against the Rookie ranges
  // v1.7.1 (food is a consideration again; the 1.5 playtest's bot carried 2,200-2,700 lb): on every route, the three tiers pooled, the food on arriving at a stop.
  // No kid of any player or policy ever holds more than the wagon carries (LOAD.foodLb); the strong player (by eye, and as a forager who hunts or fishes at every
  // stop) arrives with 200-600 lb on average and at most `strongP90` lb nine stops in ten; the weak player by eye still runs out on at most `weakCrawlDays` days a
  // journey (California: ROUTE_TARGETS.california.crawlDaysMax) and never more than 3 in a row, as 1.3 allows.
  food: { strongMean: [200, 600], strongP90: 560, weakCrawlDays: 2, crawlRunMax: 3 },
};
// seconds a thing takes on screen (SPEC §5: a day ≈ 6 s, a marker ≈ 15 s, the stop scene ≈ 3 min)
const SEC = { day: 6, marker: 15, markerFix: 12, problem: 25, problemFix: 20, word: 20, wordFix: 15, event: 10, hunt: 60,
  fish: 75, trade: 30, lookout: 15, store: 30, rope: 30, post: 20, results: 30, landmark: 45, lookoutRead: 30, home: 90,
  quickDraw: 120, tales: 40, rest: 10, derby: 30, claim: 5,
  // v1.2
  ford: 25, float: 45, ferryTalk: 10, repair: 12, stampede: 40, raft: 90, person: 12, deed: 6, wait: 8,
  // v1.5: a two-step problem takes longer; the toll gate, Laurel Hill's ropes, a pan, a round of the rocker, the sail home, the fork card
  problemStep: 12, toll: 15, snub: 30, pan: 25, rocker: 30, sail: 90, fork: 30, nugget: 5,
  // v1.6: a choice moment (the person's lines, the two ways read aloud, a tap) takes about what a fork does
  choice: 25,
  // v1.4 (SPEC v1.4 §7.2): fishing 2.0 is 75 s a session (1.3: 45); the nose, the facts and the dust devil are the mandatory seconds; the rest is optional play
  nose: { find: 0, berries: 8, snake: 8, rabbit: 8, quest: 15 }, fact: 10, dustDevil: 15, fetch: 30, hoppers: 15, stones: 25, meteors: 25, questTalk: 12 };
/** What the v1.4 kid does (SPEC v1.4 §7.2): the dog kept 80 % of the time at the Kansas River (a kid who said "Not now" takes it at Fort Kearny's store half the time),
 *  the rabbit called back 70 %, fetch at every camp with the dog, stones at 60 % of the river stops, falling stars when offered, fishing 2.0 with 60 % of the casts hooked
 *  and 85 % of the fights landed, grasshoppers caught at a third of the camps that fish, the spoon bought by a quarter of the kids, every quest followed by 70 %. */
const K14 = { keepDog: 0.8, laterDog: 0.5, called: 0.7, stones: 0.6, hook: 0.6, land: 0.85, hoppersCamp: 1 / 3, buysSpoon: 0.25, followsQuests: 0.7, hatsAll: 0.6 };
const V14_DEED_IDS = ['good-nose', 'fetch-champ', 'big-one', 'river-guide', 'skipper', 'keeper', 'wish-maker', 'hat-trick'];
const FACTS = ['3x4', '6x7', '7x8', '4x9', '8x6', '56/7', '42/6', '5x12', '9x9', '72/8'];
// rabbit, turkey, deer: lb and how often (1.3: 0.45 / 0.35 / 0.2, mean 13.3 lb a hit); v1.4's leading hunt adds the pronghorn (12 lb, 13 % of the animals) and the bison (24 lb, 10 %): the first three scaled by 0.77, mean 14.2 lb a hit (+6.8 %, inside the 10 % the food targets allow)
const ANIMALS_HUNTED = [[4, 0.3465], [10, 0.2695], [40, 0.154], [12, 0.13], [24, 0.1]];
const ALL_COMPANIONS = COMPANIONS.filter((c) => !c.fromJourney).map((c) => c.id);      // the eight stock companions (the sim's 1.3 party draw; Mateo and Hattie have their own cell)

function huntLb(rand) {
  let lb = 0;
  for (let s = 0; s < 5; s++) if (rand() < KID.huntHit) { let r = rand(); for (const [w, p] of ANIMALS_HUNTED) { if (r < p) { lb += w; break; } r -= p; } }
  return lb;
}
function fishLb13(rand) { let lb = 0; for (let c = 0; c < 4; c++) if (rand() < KID.castHit) lb += 2 + Math.floor(rand() * 5); return lb; }
// a pick from a list of chances (index i with chance list[i])
function chance(rand, list) { let r = rand(); for (let i = 0; i < list.length; i++) { if (r < list[i]) return i; r -= list[i]; } return list.length - 1; }

// one sim kid's history: a journey at each tier of `spec` (SPEC v1.5 §7.2): { route, journeyN, year, choices: { forkId: optionId } }
function simulateKid(seed, spec, policy = 'natural') {
  const journeys = spec.journeys || TIER_IDS.map((t) => ({ route: spec.route, tier: t, choices: spec.choices }));      // a kid's journeys: the cell's three tiers, or a whole history (--homestead)
  const seasons = journeys.length;
  const rand = mulberry32(seed);
  const careful = rand() < 0.5;
  const animal = rand() < 0.5 ? 'oxen' : 'mules';
  const party = [...ALL_COMPANIONS].map((id) => [rand(), id]).sort((a, b) => a[0] - b[0]).slice(0, 3).map((x) => x[1]);      // (the eight stock companions: Mateo and Hattie are the v1.5 sim's own kids' choice below)
  const out = [];
  let J = createJourney({ route: journeys[0].route, tier: journeys[0].tier, year: spec.year, journeyN: spec.journeyN, wagonName: 'Kid ' + seed, animal, companions: party.filter((id) => !['packer', 'prospector'].includes(id) || spec.journeyN > 1), seed });
  let clock = 0;                     // seconds into the current session
  let legTime = 0;                   // seconds spent on the current leg (across sessions)
  let sessions = 1;
  const spend = (s) => { clock += s; legTime += s; };
  let lt = { problems: 0, camp: 0, challenge: 0, dup: 0, spent: 0, deed: 0, fun: 0 };   // the current leg's token flow (fun: the dust devil, the quests, the dog's deeds)
  // a card: awardCard when the content has it, else (the Content stream's cards are not merged yet) the same rule by hand: new once, a duplicate pays a token
  const cardId = (id) => {
    if (!id) return;
    if (CARD_BY_ID[id]) { lt.dup += awardCard(J, id).tokens; return; }
    if (J.cards.includes(id)) { J.tokens += 1; lt.dup += 1; } else J.cards.push(id);
  };
  const card = (c) => { if (c) cardId(c.id); };
  // v1.4: the kid's own choices come from a second stream, so the 1.3 plays are the 1.3 plays
  const r14 = mulberry32((seed ^ 0x14b0a7) >>> 0);
  const keepsDog = r14() < K14.keepDog, laterDog = r14() < K14.laterDog, followsQuests = r14() < K14.followsQuests, buysSpoon = r14() < K14.buysSpoon;
  let legMand = 0;                   // the mandatory v1.4 seconds of the current leg (nose, fact, dust devil)
  const fun = (before) => { lt.fun += J.tokens - before; };
  /** a fishing session (event, safety net or camp): the bait, the casts (60 % hooked, 85 % of the fights landed, a wiggle-off cast again once), the food, the first species' card */
  const fishOut = ({ rescue = false, hoppers = false } = {}) => {
    if (hoppers) { catchHoppers(J, 6 + Math.floor(r14() * 7)); spend(SEC.hoppers); }
    const bait = J.goods.spoon ? 'spoon' : J.goods.hoppers > 0 ? 'hoppers' : 'worms';
    const S = fishingSession(J, { bait, rescue });
    S.casts.forEach((c, i) => {
      if (!(r14() < K14.hook)) return;
      let ok = c.kind === 'junk' ? true : r14() < K14.land;
      if (!ok && castOff(J, S, i).retry) ok = r14() < K14.land;
      if (ok) { const before = J.tokens; const r = landCast(J, S, i); if (r.card) cardId(r.card); if (r.quest) rec_.v14.questsFound++; fun(before); }
    });
    const R = endFishing(J, S); spend(SEC.fish);
    rec_.v14.fishSessions++; rec_.v14.fishLb += R.lb; if (!rescue) rec_.v14.fishLbFree += R.lb, rec_.v14.fishFree++;
    return R;
  };
  /** fetch at a camp with the dog: three throws */
  const fetchOut = () => {
    if (!J.dog) return;
    for (let t = 0; t < 3; t++) { const f = fetchThrow(J, { dist: r14(), rand: r14 }); if (f.item) cardId(null); if (f.quest) rec_.v14.questsFound++; }
    spend(SEC.fetch); rec_.v14.fetches++;
  };
  const stonesOut = () => {
    const p = stonesPlan(J); if (!p.available) return;
    const sk = [0, 1, 2].map(() => Math.min(p.maxSkips, 1 + (p.bonus || 0) + Math.floor(r14() * 7)));
    const before = J.tokens; stonesResult(J, { throws: sk }); fun(before); spend(SEC.stones); rec_.v14.stones++;
  };
  const ask = (kind, fact) => {      // a word problem: right first try, or fixed
    const p = problemFor({ kind, fact, leg: J.legId, season: J.season, rand, tier: KID.ladder });
    const ok = rand() < KID.problem;
    lt.problems += applyProblem(J, { kind, correct: ok, firstTry: true }).tokens;
    spend(SEC.problem + (p.parts ? SEC.problemStep : 0) + (ok ? 0 : SEC.problemFix));
    return p;
  };
  // a camp activity (SPEC v1.1 §3): the sim's day, then what the app's mini-game would add
  const campOut = (kind) => {
    let k = kind;
    if (k === 'hunt' && !(J.opts.hunting && huntAllowed(J))) k = 'fish';   // no arrows: the camp offers fishing only
    const c = camp(J, k, { rand });
    spend(SEC.day);
    if (k === 'fish') fishOut({ hoppers: r14() < K14.hoppersCamp });
    else if (k === 'hunt') { const lb = huntLb(rand); applyHunt(J, { meatLb: lb }); if (lb > 0) card(cardForAnimal(rand() < 0.5 ? 'deer' : 'rabbit')); spend(SEC.hunt); }
    else if (k === 'cards') { if (rand() < KID.quickDrawWin) { J.tokens++; lt.camp++; } spend(SEC.quickDraw); }
    else if (k === 'tales') { J.tokens++; lt.camp++; card(CARD_OF_PARTY(rand)); if (c.cardDrop) card(cardForLeg(J, rand)); spend(SEC.tales); }
    else spend(SEC.rest);
    fetchOut();                                                                                       // v1.4: the dog's stick at every camp
    if (campWater(J).river && r14() < K14.stones) stonesOut();                                       // …and the flat stones where the water is a river
  };
  const CARD_OF_PARTY = (r) => ({ id: J.companions[Math.floor(r() * J.companions.length)] });
  // the Outfit's upgrade shelf: tokens first, then cash once it is plentiful
  const dryAhead = () => legList().slice(J.trip && J.trip.arrived ? J.legIndex + 1 : J.legIndex).some((l) => l.dry);
  const outfit = () => {
    const order = dryAhead() && !J.upgrades.barrel ? [...UPGRADES].sort((a, b) => (b.id === 'barrel') - (a.id === 'barrel')) : UPGRADES;      // a kid who sees a dry stretch ahead buys the barrel first
    for (const u of order) {
      if (J.upgrades[u.id]) continue;
      const c = upgradeCost(J, u.id);
      if (J.tokens >= c.tokens) { if (buyUpgrade(J, u.id, { tokens: true })) { lt.spent += c.tokens; rec_.upTokens++; } }
      else if (J.legIndex >= KID.cashFrom && J.cash >= c.cash * KID.cashRich) { if (buyUpgrade(J, u.id, { cash: true })) rec_.upCash++; }
    }
  };
  let rec_ = null;
  const words = () => { let right = 0; for (let w = 0; w < 3; w++) { const ok = rand() < KID.words; right += ok; spend(SEC.word + (ok ? 0 : SEC.wordFix)); } applyWords(J, { asked: 3, right }); };
  // the wish list at this store, in the order a careful family would spend: food for the next stretch (a twentieth to spare), blankets
  // before a cold leg, a second spare part, arrows for the bow, a second coil of rope, the second yoke (when the store sells it)
  const wishList = () => {
    const L = storeLeg(J), items = [];
    const plan = foodToNextFort(J);
    const sacks = Math.max(0, Math.ceil((Math.round(plan.lb * 1.05) - J.food) / lbOf('flour')));
    if (sacks > 0) items.push({ id: 'flour', qty: sacks });
    const cold = coldLegsAhead(J);
    if (cold.length) { const need = needsBlankets(J, cold[0]).need - (J.goods.blankets | 0); if (need > 0) items.push({ id: 'blankets', qty: need }); }
    if (J.parts < 2) items.push({ id: 'parts', qty: 2 - J.parts });
    if (J.opts.hunting && (J.goods.arrows | 0) < 10) items.push({ id: 'arrows', qty: 2 });
    if ((J.goods.rope | 0) < 2) items.push({ id: 'rope', qty: 2 - (J.goods.rope | 0) });
    if (J.animals.n < 4 && yokeOffered(L)) items.push({ id: 'yoke', qty: 1 });
    for (const it of items) it.cost = it.qty * priceAt(it.id, L, J.season);
    return items;
  };
  // did the shopping leave the wagon with what the wish-list item asks for?
  const have = (it) => {
    if (it.id === 'flour') return J.food >= Math.round(foodToNextFort(J).lb * 1.1);
    if (it.id === 'blankets') { const c = coldLegsAhead(J); return !c.length || (J.goods.blankets | 0) >= needsBlankets(J, c[0]).need; }
    if (it.id === 'parts') return J.parts >= 2;
    if (it.id === 'arrows') return (J.goods.arrows | 0) >= 10;
    if (it.id === 'rope') return (J.goods.rope | 0) >= 2;
    if (it.id === 'yoke') return J.animals.n >= 4;
    return true;
  };
  const shop = () => {
    spend(SEC.store);
    const n = KID.storeProblems[0] + Math.floor(rand() * (KID.storeProblems[1] - KID.storeProblems[0] + 1));
    for (let i = 0; i < n; i++) ask(i % 2 ? 'divide' : 'buy', FACTS[Math.floor(rand() * FACTS.length)]);
    const arriveCash = J.cash, wish = wishList(), L = storeLeg(J);
    if (policy === 'everything') {
      for (const it of wish) {
        if (it.id === 'flour') { const afford = Math.min(it.qty, Math.floor(J.cash / (it.cost / it.qty))); if (afford > 0) buy(J, { item: 'flour', qty: afford }); continue; }   // food: as many sacks as the cash covers
        if (it.cost <= J.cash && buy(J, { item: it.id, qty: it.qty }).ok) { if (it.id === 'parts') rec_.partsBought += it.qty; if (it.id === 'yoke') { rec_.yoke = true; rec_.yokeLeg = rec_.yokeLeg ?? J.legIndex; } } }
    } else {
      const plan = foodToNextFort(J);
      const want = Math.max(0, Math.round(plan.lb * (policy === 'forager' ? 1.1 : 0.6 + 0.8 * rand())) - J.food);      // (v1.7.1: the forager buys to the store's hint and a tenth more, as the playtest bot did)
      const sacks = Math.ceil(want / lbOf('flour'));
      const flourPrice = priceAt('flour', L, J.season);
      const afford = Math.min(sacks, Math.floor(J.cash / Math.max(1, flourPrice)));      // a kid at the counter buys the sacks the purse covers
      if (afford > 0) buy(J, { item: 'flour', qty: afford, price: flourPrice });
      // v1.2: a spare part (some buy two), blankets before a cold leg, arrows for the bow, a coil of rope, the second yoke
      // spare parts: one, and (as the store's hint says) another for a long stretch to the next store and for a harder tier, where the breakdowns come thicker
      const stretch = plan.miles, wantParts = 1 + (stretch >= 300 && rand() < KID.extraPart * 1.5 ? 1 : 0) + (stretch >= 600 && rand() < KID.extraPart * 1.5 ? 1 : 0) + (TIER_FX[J.tier].breakdownW >= 1.5 && rand() < KID.extraPart ? 1 : 0);
      for (let k = J.parts; k < wantParts; k++) { if (buy(J, { item: 'parts', qty: 1 }).ok) rec_.partsBought++; else break; }
      const cold = coldLegsAhead(J);
      if (cold.length) { const need = needsBlankets(J, cold[0]).need; if ((J.goods.blankets | 0) < need && rand() < KID.remembersBlankets) buy(J, { item: 'blankets', qty: need - (J.goods.blankets | 0) }); }
      if (J.opts.hunting && (J.goods.arrows | 0) < 10 && (policy === 'forager' || rand() < KID.remembersArrows)) buy(J, { item: 'arrows', qty: 2 });
      if ((J.goods.rope | 0) < 1 && rand() < KID.remembersRope) buy(J, { item: 'rope', qty: 1 });
      if (J.animals.n < 4 && yokeOffered(L) && rand() < KID.buysYoke) {
        const p = priceAt('yoke', L, J.season);
        if (J.cash >= p + KID.yokeReserve * TIER_FX[J.tier].priceMult && buy(J, { item: 'yoke', qty: 1 }).ok) { rec_.yoke = true; rec_.yokeLeg = rec_.yokeLeg ?? J.legIndex; }
      }
    }
    const total = wish.reduce((a, it) => a + it.cost, 0);
    rec_.stops.push({ at: L ? L.name : 'Independence', arrive: arriveCash, wish: total, short: wish.filter((it) => !have(it)).map((it) => it.id), choice: total > arriveCash, left: J.cash });
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
    const n = policy === 'forager' ? here.length : Math.min(here.length, KID.talks[0] + Math.floor(rand() * (KID.talks[1] - KID.talks[0] + 1)));
    const pool = here.filter((p) => !p.met);
    for (let i = 0; i < n && pool.length; i++) {
      const p = pool.splice(Math.floor(rand() * pool.length), 1)[0];
      const m = meetPerson(J, p.id); spend(SEC.person); rec_.people++;
      const g = m.gift;
      if (!g) continue;
      if (g.kind === 'card') cardId(g.card);
      else if (g.kind === 'tip') { if (rand() < KID.tipWork) ask('parts', FACTS[Math.floor(rand() * FACTS.length)]); }
      else if (g.kind === 'trade') { const o = tradeOffer(J, { trades: [g] }); if (o.kind === 'listed') { const k = Math.floor(o.have / o.rate[0]); applyTrade(J, { giveN: k * o.rate[0], getN: k * o.rate[1], give: o.give, get: o.get, rate: o.rate }); spend(SEC.trade); } }   // the kid trades the person's own goods (a fallback offer is a "No thanks")
    }
  };
  for (let s = 0; s < seasons; s++) {
    const rec = { season: J.season, sessionsStart: sessions, legs: 0, tokens0: J.tokens, arriveFoodDays: [], arriveFoodLb: [], peakFood: J.food, stars: 0, crawl: 0,
      maxCrawl: 0, rescues: 0, legSeconds: [], leftovers: 0, happy: 0, allRight: 0,
      // v1.2 counters
      rivers: { ford: 0, float: 0, ferry: 0 }, soakedSacks: 0, soakedRivers: 0, breakdowns: 0, repairs: 0, limps: 0, freeFixes: 0, partsBought: 0, coldNights: 0,
      coldLegs: 0, tiredDays: 0, days: 0, yoke: false, yokeLeg: null, people: 0, stampedes: 0, stampedesHeld: 0, raftBumps: null, waits: 0, spotted: 0, deedTokens: 0,
      hinted: 0, arrowsOut: 0, limpDays: 0, tier: J.tier, route: J.route, planLen: J.plan.length, thirsty: 0, dryDays: 0, snubs: 0, snubsSmooth: 0, tolls: 0, ious: 0, flakes: 0, nuggets: 0, barrelBy: null };
    rec.v14 = { noseLegs: 0, dogLegs: 0, mand: [], fishSessions: 0, fishLb: 0, fishFree: 0, fishLbFree: 0, fetches: 0, stones: 0, meteors: 0, wishes: 0, questsFound: 0, talks: 0, mailed: 0,
      returned: 0, dog: false, locket: null, funTokens: 0, newDeeds: 0, facts: 0, devils: 0, hatsAll: 0, noses: { find: 0, berries: 0, snake: 0, rabbit: 0, quest: 0 }, spoon: false, finds: 0, horseshoeCash: 0 };
    rec.moment = { asked: 0, b: 0, cut: 0, soakedLb: 0, soaked: 0, fee: 0 };
    rec_ = rec; rec.stops = []; rec.cashAt = []; rec.flow = []; rec.upTokens = 0; rec.upCash = 0; rec.challenges = 0; rec.challengesDone = 0; rec.camps = 0; rec.derbyCash = 0;
    shop();                                        // the Independence store
    for (let guard = 0; guard < 40 && !J.done; guard++) {
      const leg = legList()[J.legIndex];
      legTime = 0; legMand = 0;
      const hadDog = !!J.dog && leg.id !== legList()[legList().length - 1].id && !leg.voyage, noses0 = Object.values(rec.v14.noses).reduce((a, b) => a + b, 0);
      // today's challenge (a session is a day); a camp / supper goal is gone for on purpose most of the time
      const ch = dailyChallenge(J, `kid${seed}-${s}-${J.legIndex}`);
      rec.challenges++;
      // a camp every third leg: the kid cycles fish, Quick Draw, the bow, tales, a rest
      // (v1.5: a kid camps at a quiet stop, never at a fort, where the store, the post office and the derby fill the session: the camp moves to the next stop that is not a fort)
      const campDue = (i) => i % KID.campEvery === KID.campEvery - 1;
      const camping = leg.stop.kind !== 'fort' && (campDue(J.legIndex) || (J.legIndex > 0 && campDue(J.legIndex - 1) && legList()[J.legIndex - 1].stop.kind === 'fort'));
      // a kid who goes for today's camp / supper goal camps for it; a leg that already has its camp does not camp twice
      if (!camping && (ch.kind === 'camp' || ch.kind === 'supper') && rand() < KID.goal) { campOut('fish'); rec.camps++; }
      if (camping) { campOut(['fish', 'cards', 'hunt', 'tales', 'rest'][Math.floor(J.legIndex / KID.campEvery) % 5]); rec.camps++; }
      else if (policy === 'forager' && J.legIndex > 0) { campOut(J.legIndex % 2 ? 'hunt' : 'fish'); rec.camps++; }      // (v1.7.1: the forager camps at every stop to hunt or fish, as the playtest bot did)
      dials();
      if (J.trip.toll && !J.trip.toll.paid && !J.trip.toll.iou) { const t = payToll(J); spend(SEC.toll); rec.tolls++; if (t.iou) rec.ious++; }      // the Barlow Road's gate
      if (leg.dry && rec.barrelBy == null) rec.barrelBy = !!J.upgrades.barrel;
      // Nora's tip: the hint before the answer, once a leg (the sim counts it; the marker odds do not change)
      let trailProblemsLeft = KID.trailProblems[0] + Math.floor(rand() * (KID.trailProblems[1] - KID.trailProblems[0] + 1));
      if (leg.id === 'willamette-valley' && !leg.voyage) {
        // the last leg runs as the Columbia raft (SPEC v1.2 §4): a few bumps, four markers' worth of play, the pay
        const bumps = chance(rand, KID.raftBumps); raftPay(J, { bumps }); spend(SEC.raft); rec.raftBumps = bumps;
      }
      if (leg.voyage) {
        // the voyage home (v1.5): no trail days; four "Up the coast" markers, then the Columbia bar; the sail's pay
        for (let m = 0; m < 4; m++) { spend(SEC.day); const ok = rand() < KID.marker; applyMarker(J, { correct: ok, quick: ok && rand() < KID.quickOfRight }); spend(SEC.marker + (ok ? 0 : SEC.markerFix)); }
        sailPay(J, { bumps: chance(rand, KID.raftBumps) }); spend(SEC.sail);
        J.totals.miles += leg.miles - J.milesDone; J.milesDone = leg.miles;
      }
      for (let d = 0; d < 400 && !leg.voyage; d++) {
        if (clock >= KID.sessionS) { sessions++; clock = 0; rec.leftovers++; }   // the session ends mid-leg; the journey waits
        // the weather forecast: some kids wait a storm out at camp
        const f = forecast(J);
        if (f.next !== 'clear' && rand() < KID.waitStorm) { waitOut(J, { rand }); spend(SEC.day + SEC.wait); rec.waits++; }
        const r = tickDay(J, { rand });
        spend(SEC.day); rec.days++;
        rec.peakFood = Math.max(rec.peakFood, J.food);
        if (r.crawl) { rec.crawl++; }
        if (r.animalsTired) rec.tiredDays++;
        if (r.coldNight) rec.coldNights++;
        if (r.dry) rec.dryDays++; if (r.thirsty) rec.thirsty++;
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
          else if (e.kind === 'fish') fishOut({ rescue: !!e.rescue });
          else if (e.kind === 'trade') { const o = tradeOffer(J); const p = problemFor({ kind: 'trade', fact: FACTS[Math.floor(rand() * FACTS.length)], leg: J.legId, season: J.season, rand, have: o.have, offer: o }); applyProblem(J, { kind: 'trade', correct: rand() < KID.problem }); applyTrade(J, p.meta); spend(SEC.trade); }
          else if (e.kind === 'breakdown') {
            rec.breakdowns++;
            const worked = rand() < KID.workRepairOut;
            if (worked) ask('parts', FACTS[Math.floor(rand() * FACTS.length)]);
            const rp = repair(J, { workedOut: worked }); spend(SEC.repair);
            if (rp.fixed) { rec.repairs++; if (!rp.usedPart) rec.freeFixes++; } else rec.limps++;
          }
          else if (e.kind === 'problem') ask(e.problem === 'parts' ? 'parts' : 'buy', FACTS[Math.floor(rand() * FACTS.length)]);
          else if (e.kind === 'stampede') { const held = rand() < KID.stampedeHold; const sp = stampedePay(J, { held }); rec.stampedes++; if (held) { rec.stampedesHeld++; cardId(sp.card); } spend(SEC.stampede); if (sp.fact) { const h = heardFact(J, sp.fact); if (h) cardId(h.card); spend(SEC.fact); rec.v14.facts++; } }
          else if (e.kind === 'lookout') { card(cardForAnimal(e.animal)); spend(SEC.lookout); }
          else if (e.kind === 'snub') { const smooth = rand() < KID.smooth; applySnub(J, { smooth }); rec.snubs++; if (smooth) rec.snubsSmooth++; spend(SEC.snub); }
          else if (e.kind === 'bonus') card(cardForLeg(J, rand));
          if (e.kind === 'hunt' && J.legStats.hunted > 0) card(cardForAnimal(rand() < 0.5 ? 'deer' : 'rabbit'));
          if (e.kind === 'trade' && tradeOffer(J).nation) card({ id: tradeOffer(J).nation });
        }
        // v1.4: the dog's nose, the trail fact, the dust devil (the mandatory seconds)
        if (r.nose) {
          const n = r.nose, sec = SEC.nose[n.kind] || 0;
          rec.v14.noses[n.kind]++; spend(sec); legMand += sec;
          if (n.kind === 'rabbit') { const called = r14() < K14.called; chaseResult(J, { called, dist: called ? r14() * 0.75 : 1 }); cardId(n.card); }
          else if (n.kind === 'snake' || n.kind === 'berries') cardId(n.card);
          else if (n.kind === 'find') rec.v14.finds++;
          else if (n.kind === 'quest') { rec.v14.questsFound++; spend(0); }
        }
        if (r.fact) { const h = heardFact(J, r.fact.id); if (h) cardId(h.card); spend(SEC.fact); legMand += SEC.fact; rec.v14.facts++; }
        if (r.moment) { const all = r14() < K14.hatsAll; const before = J.tokens; dustDevilResult(J, { caught: all ? 3 : 1, of: 3 }); fun(before); spend(SEC.dustDevil); legMand += SEC.dustDevil; rec.v14.devils++; if (all) rec.v14.hatsAll++; }
        // the trail problems: one when the rations dial moves or a landmark is sighted, a few a leg (optional now: Ask Eli, for a token)
        if (trailProblemsLeft > 0 && d > 0 && d % 3 === 0) { ask(trailProblemsLeft % 2 ? 'ration' : 'distance', FACTS[Math.floor(rand() * FACTS.length)]); trailProblemsLeft--; }
        if (d % 4 === 3) dials();
        if (r.arrived) break;
      }
      // the stop
      const res = arrive(J);
      rec.cashAt.push(J.cash);                      // cash on hand on arriving, after the leg's pay (the table prints this)
      if (res.fork) { const pickOpt = ((journeys[s].choices) || {})[res.fork.id]; if (pickOpt) chooseBranch(J, res.fork.id, pickOpt); spend(SEC.fork); }      // v1.5: the fork card at the stop
      if (res.choice) {                              // v1.6 (The Lab): a choice moment; the cell says which way the kid takes (default: the plain way, as nextLeg would)
        const want = (spec.moments && spec.moments[res.choice.kind]) || 'a';
        const ap = applyChoice(J, res.choice.id, want); spend(SEC.choice);
        const M = rec.moment; M.asked++;
        if (ap.ok && ap.option === 'b') { M.b++; M.cut += ap.cut; M.soakedLb += ap.soakedLb; M.fee += ap.fee; if (ap.soaked) M.soaked++; }
      }
      if (res.gold) {                               // v1.5: a digging: the pans and, at Coloma, the rocker (SPEC §3.4)
        const prospector = !!skillOf(J, 'prospecting');
        for (let i = 0; i < res.gold.pans; i++) {
          const q = Math.max(0, Math.min(1, KID.panSkill + (r14() - 0.5) * 0.5));
          const o = panOutcome({ quality: q, rich: res.gold.rich.includes(i), tier: J.tier, prospector, rand: r14 }); applyGold(J, o); spend(SEC.pan + (o.nugget ? SEC.nugget : 0));
        }
        for (let i = 0; i < res.gold.rocker; i++) { const b = Math.max(0, Math.min(1, KID.panSkill + (r14() - 0.5) * 0.4)); applyGold(J, { flakes: rockerOutcome({ beats: b, tier: J.tier }).flakes, rocker: b }); spend(SEC.rocker); }
      }
      const kind = leg.stop.kind;
      spend(SEC.lookoutRead);                       // every stop's lookout is read aloud (the lookout, the nation's fact and the landmark card), not only a landmark's
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
      else if (kind === 'gold') spend(SEC.landmark);
      else spend(SEC.landmark);
      // v1.4: the dog joins at the Kansas River (80 %), or at a fort's store after a "Not now" (half of those kids); the river stop's flat stones; the evening's falling stars
      if (!J.dog && journeys[s].route !== 'emigrant' && (keepsDog || laterDog) && kind === 'fort' && dogOfferAt(J, leg)) { adoptDog(J, { name: 'Frodo', coat: 'brown' }); rec.v14.dog = true; }
      else if (!J.dog && keepsDog && leg.id === 'kansas-river' && dogOfferAt(J, leg)) { const a = adoptDog(J, { name: 'Frodo', coat: 'brown' }); rec.v14.dog = true; if (a.quest) rec.v14.questsFound++; }
      else if (!J.dog && !keepsDog && laterDog && kind === 'fort' && dogOfferAt(J, leg)) { adoptDog(J, { name: 'Frodo', coat: 'brown' }); rec.v14.dog = true; }
      if (RIVER_STOPS.includes(leg.id) && r14() < K14.stones) stonesOut();
      if (leg.id !== legList()[legList().length - 1].id && meteorsTonight(J)) { const before = J.tokens; for (let w = 0; w < 3; w++) { wishFor(J, r14); rec.v14.wishes++; } fun(before); spend(SEC.meteors); rec.v14.meteors++; }
      if (kind === 'fort') {
        const sold = sellHorseshoes(J, { leg }); rec.v14.horseshoeCash += sold.cash;
        if (!J.goods.spoon && buysSpoon && J.dog && (leg.n | 0) >= 2 && priceAt('spoon', leg, J.season) <= J.cash - 8 * TIER_FX[J.tier].priceMult && buy(J, { item: 'spoon', qty: 1 }).ok) rec.v14.spoon = true;
        for (const m of questMail(J, { leg })) { cardId(m.card); rec.v14.mailed++; }
      }
      for (const q of questAt(J, J.legId)) {
        if (!(followsQuests)) continue;
        const before = J.tokens; const t = questTalk(J, q.questId); spend(SEC.questTalk); rec.v14.talks++;
        if (t && t.reward) { cardId(t.reward.card); rec.v14.returned++; }
        fun(before);
      }
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
      rec.v14.newDeeds += deeds.filter((d) => V14_DEED_IDS.includes(d)).length;
      outfit();
      spend(SEC.results);
      rec.flow.push({ ...lt, bal: J.tokens }); lt = { problems: 0, camp: 0, challenge: 0, dup: 0, spent: 0, deed: 0, fun: 0 };
      rec.v14.funTokens = rec.flow.reduce((a, f) => a + f.fun, 0);
      if (hadDog) { rec.v14.dogLegs++; const n1 = Object.values(rec.v14.noses).reduce((a, b) => a + b, 0); if (n1 > noses0) rec.v14.noseLegs++; rec.v14.mand.push(legMand); } else rec.v14.mand.push(legMand);
      rec.legSeconds.push(legTime);
      rec.legs++; rec.stars += res.stars.filter(Boolean).length; rec.happy += res.stars[1]; rec.allRight += res.stars[2];
      const daily = foodNeeded(partySize(J), 'full', 1, animalOf(J.animal).feedLb || 0);
      rec.arriveFoodDays.push(J.food / daily);
      rec.arriveFoodLb.push(J.food);
      rec.peakFood = Math.max(rec.peakFood, J.food);
      rec.maxCrawl = Math.max(rec.maxCrawl, J.totals.maxCrawlDays);
      if ((J.goods.arrows | 0) < 5) rec.arrowsOut++;
      nextLeg(J);
      sessions++; clock = 0;                      // a leg a session
    }
    rec.sessions = sessions - rec.sessionsStart;
    rec.setAside = (J.totals.setAside | 0); rec.leftBehind = (J.totals.leftBehind | 0);      // v1.7.1: the damp flour set aside, the food the wagon could not carry
    rec.cash = J.cash;
    rec.earned = rec.flow.reduce((a, f) => a + f.problems + f.camp + f.challenge + f.dup + f.deed + f.fun, 0);
    rec.v14.locket = J.quests.locket ? J.quests.locket.state : 'none'; rec.v14.finds = Object.keys(J.finds).length; rec.v14.fishSpecies = Object.keys(J.fishLog).length; rec.v14.bestSkips = J.skips.best;
    rec.v14.deedsNew = V14_DEED_IDS.filter((d) => J.deeds.includes(d)).length;
    rec.tokensPerLeg = rec.earned / Math.max(1, rec.legs);
    rec.tokensEnd = J.tokens; rec.cards = J.cards.length; rec.suits = SUITS.filter((x) => suitComplete(J, x));
    rec.upgrades = Object.keys(J.upgrades).length;
    rec.deeds = J.deeds.length; rec.met = J.met.length; rec.party = party.slice();
    rec.done = J.done; rec.flakes = J.totals.flakes | 0; rec.gold = J.gold | 0; rec.nuggetCount = nuggetsOf(J.gold | 0).nuggets; rec.xcold = (J.xcold || []).length;
    rec.unfedRun = rec.maxCrawl;
    out.push(rec);
    if (spec.afterJourney) spec.afterJourney(J, rec, s);
    if (s + 1 < seasons) J = spec.nextJourney ? spec.nextJourney(J, s) : startSeason(J, { route: journeys[s + 1].route, tier: journeys[s + 1].tier });
  }
  return out;
}

// ---- run ----
// the cells of SPEC v1.5 §7.2: the route a kid's three journeys (Rookie, Veteran, Pioneer) take; `choices` answer the forks as the cell says
const SPECS = {
  oregon: { key: 'oregon', label: 'Oregon by Fort Bridger and the raft', route: 'emigrant', journeyN: 1, year: 1847, choices: { 'the-dalles': 'columbia' } },
  barlow: { key: 'barlow', label: 'the Barlow Road', route: 'emigrant', journeyN: 2, year: 1848, choices: { 'the-dalles': 'barlow' } },
  sublette: { key: 'sublette', label: 'the Sublette Cutoff', route: 'emigrant', journeyN: 2, year: 1848, choices: { 'south-pass': 'sublette' } },
  lander: { key: 'lander', label: 'the Lander Road', route: 'emigrant', journeyN: 12, year: 1858, choices: { 'south-pass': 'lander' } },
  california: { key: 'california', label: 'California', route: 'emigrant', journeyN: 1, year: 1847, choices: { 'fort-hall': 'california' } },
  'gold-road': { key: 'gold-road', label: 'the Gold Road', route: 'gold-road', journeyN: 2, year: 1848, choices: {} },
};
const cellCache = {};
function runKids(profile, policy, spec = SPECS.oregon) {
  const key = `${spec.key}|${profile}|${policy}`;
  if (cellCache[key]) return cellCache[key];
  Object.assign(KID, BASE_KID, PROFILES[profile]);
  const r = Array.from({ length: KIDS }, (_, i) => simulateKid(1000 + i * 7919, spec, policy));
  Object.assign(KID, BASE_KID, PROFILES.average);
  return (cellCache[key] = r);
}
const runs = runKids('average', 'natural');          // the table below is the average player, shopping by eye
const VARIANTS = {};                                  // 'strong:natural' ... 'weak:everything'
for (const p of Object.keys(PROFILES)) for (const pol of ['natural', 'everything']) VARIANTS[`${p}:${pol}`] = runKids(p, pol);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
const pad = (s, n) => String(s).padStart(n);

console.log(`\nWagon West economy: ${KIDS} kids, ${TRAIL.length} legs a journey (Rookie Oregon by Fort Bridger and the raft, then the same kid at Veteran and Pioneer), ` +
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
console.log(`(start: $${TIER_FX.rookie.startCash} / $${TIER_FX.veteran.startCash} / $${TIER_FX.pioneer.startCash} and ${TIER_FX.rookie.startFood} / ${TIER_FX.veteran.startFood} / ${TIER_FX.pioneer.startFood} lb by tier; a safety net is a hunt / fishing hole / find when the food runs out, worth ≥ ${RESCUE.minLb} lb)`);

// ---- v1.1: the token flow and the side layer ----
const src = (recs, k) => mean(recs.map((r) => r.flow.reduce((a, f) => a + f[k], 0) / Math.max(1, r.legs)));
console.log('\ntoken flow per leg (mean over the ' + KIDS + ' kids; problems = first-try word problems, camp = Quick Draw wins and campfire tales, challenge = the daily goal, dup = duplicate cards, deed = deeds earned, fun = v1.4: the dust devil, the quests and the stones)');
for (let s = 0; s < SEASONS.length; s++) {
  const recs = runs.map((r) => r[s]);
  console.log(`\n${recs[0].season}   leg   problems   camp   challenge   dup   deed   fun   earned   spent   balance after`);
  for (let i = 0; i < TRAIL.length; i++) {
    const fl = recs.map((r) => r.flow[i]).filter(Boolean);
    const m = (k) => mean(fl.map((f) => f[k]));
    console.log(`        ${pad(i + 1, 3)}   ${pad(f1(m('problems')), 8)}   ${pad(f1(m('camp')), 4)}   ${pad(f1(m('challenge')), 9)}   ${pad(f1(m('dup')), 3)}   ${pad(f1(m('deed')), 4)}   ${pad(f1(m('fun')), 3)}   ${pad(f1(m('problems') + m('camp') + m('challenge') + m('dup') + m('deed') + m('fun')), 6)}   ${pad(f1(m('spent')), 5)}   ${pad(f1(m('bal')), 13)}`);
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

// ---- v1.4: Frodo and the river (SPEC v1.4 §7.2) ----
const mean13 = mean(Array.from({ length: 20000 }, (_, i) => fishLb13(mulberry32(i * 2654435761 >>> 0))));   // 1.3's cast-and-dip: 4 casts, 60 % hooked, 2-6 lb (≈ 9.6 lb)
const v14 = [];
console.log('\nv1.4 per season, mean over the ' + KIDS + ' kids (the dog kept by ' + Math.round(K14.keepDog * 100) + ' % at the Kansas River, the rabbit called back ' + Math.round(K14.called * 100) + ' %, fetch at every camp with the dog, stones at ' + Math.round(K14.stones * 100) + ' % of the river stops, fishing 2.0 with ' + Math.round(K14.hook * 100) + ' % hooked and ' + Math.round(K14.land * 100) + ' % of the fights landed, grasshoppers at a third of the fishing camps, the spoon bought by a quarter of the kids, every quest followed by ' + Math.round(K14.followsQuests * 100) + ' %)');
for (let s = 0; s < SEASONS.length; s++) {
  const recs = runs.map((r) => r[s]), dogs = recs.filter((r) => r.v14.dogLegs > 0), legsAll = recs.reduce((a, r) => a + r.legs, 0);
  const dogLegs = dogs.reduce((a, r) => a + r.v14.dogLegs, 0), noseLegs = dogs.reduce((a, r) => a + r.v14.noseLegs, 0);
  const mandAll = recs.flatMap((r) => r.v14.mand), mandDog = dogs.flatMap((r) => r.v14.mand);
  const freeN = recs.reduce((a, r) => a + r.v14.fishFree, 0), freeLb = recs.reduce((a, r) => a + r.v14.fishLbFree, 0), sessN = recs.reduce((a, r) => a + r.v14.fishSessions, 0);
  const keepers = recs.filter((r) => r.v14.dog || s > 0 && r.v14.dogLegs > 0);
  const row = { season: recs[0].season, dogShare: dogs.length / recs.length, noseLegsShare: noseLegs / Math.max(1, dogLegs), mandAll: mean(mandAll), mandDog: mean(mandDog), mandMax: Math.max(...mandAll),
    fishFree: freeLb / Math.max(1, freeN), fishSessions: sessN / recs.length, fishAll: recs.reduce((a, r) => a + r.v14.fishLb, 0) / Math.max(1, sessN), locketOk: keepers.filter((r) => ['returned', 'mailed'].includes(r.v14.locket)).length, locketOf: keepers.length,
    returned: mean(keepers.map((r) => (r.v14.locket === 'returned' ? 1 : 0))), funPerLeg: recs.reduce((a, r) => a + r.v14.funTokens + r.v14.newDeeds, 0) / legsAll, newDeeds: mean(recs.map((r) => r.v14.deedsNew)),
    finds: mean(dogs.map((r) => r.v14.finds)), species: mean(recs.map((r) => r.v14.fishSpecies)), skips: mean(recs.map((r) => r.v14.bestSkips)), horseshoe: mean(recs.map((r) => r.v14.horseshoeCash)), spoon: recs.filter((r) => r.v14.spoon).length / recs.length,
    fetches: mean(recs.map((r) => r.v14.fetches)), stones: mean(recs.map((r) => r.v14.stones)), meteors: mean(recs.map((r) => r.v14.meteors)), facts: mean(recs.map((r) => r.v14.facts)), devils: mean(recs.map((r) => r.v14.devils)),
    hats: mean(recs.map((r) => r.v14.hatsAll)), talks: mean(recs.map((r) => r.v14.talks)), mailed: mean(recs.map((r) => r.v14.mailed)), noses: mean(dogs.map((r) => Object.values(r.v14.noses).reduce((a, b) => a + b, 0))) };
  v14.push(row);
  console.log(`${row.season}   dog ${Math.round(row.dogShare * 100)} % · nose moments on ${Math.round(row.noseLegsShare * 100)} % of the legs with the dog (${f1(row.noses)} a journey, ${f1(row.finds)} different finds) · mandatory seconds a leg ${f1(row.mandAll)} (with the dog ${f1(row.mandDog)}, worst leg ${row.mandMax}) · ` +
    `fishing ${f1(row.fishSessions)} sessions a journey, a free session ${f1(row.fishFree)} lb (1.3: ${f1(mean13)}), ${f1(row.species)} of ${6} species · locket given back or mailed ${row.locketOk} of ${row.locketOf} (in person ${Math.round(row.returned * 100)} %) · ` +
    `fun tokens + new deeds ${f2(row.funPerLeg)} a leg (${f1(row.newDeeds)} of 8 new deeds) · horseshoes $${f1(row.horseshoe)} · spoon ${Math.round(row.spoon * 100)} % · fetch ${f1(row.fetches)} · stones ${f1(row.stones)} (best ${f1(row.skips)} skips) · falling stars ${f1(row.meteors)} · facts ${f1(row.facts)} · dust devils ${f1(row.devils)} (every hat ${f1(row.hats)}) · quest talks ${f1(row.talks)}, mailed ${f1(row.mailed)}`);
}
{
  const first = runs.map((r) => r[0]);
  console.log(`(1.3's cast-and-dip: ${f2(mean13)} lb a session; 1.4's free sessions ${f2(v14[0].fishFree)} lb = ${Math.round((v14[0].fishFree / mean13 - 1) * 1000) / 10} %; the first season's leg minutes ${f1(rows[0].legMean)} mean / ${f1(rows[0].legMax)} max; sessions ${f1(rows[0].sessMean)} (${Math.min(...first.map((r) => r.sessions))}-${Math.max(...first.map((r) => r.sessions))}))`);
}

// ---- v1.3: money is a choice ----
const V = VARIANTS;
const money = (key, s = 0) => {
  const recs = V[key].map((r) => r[s]);
  const stops = recs[0].stops.map((_, i) => recs.map((r) => r.stops[i]).filter(Boolean));
  const storeShort = stops.map((st) => st.filter((x) => x.choice).length / Math.max(1, st.length));
  return { recs, end: mean(recs.map((r) => r.cash)), endMin: Math.min(...recs.map((r) => r.cash)), endP10: pct(recs.map((r) => r.cash), 0.1),
    cashAt: TRAIL.map((_, i) => mean(recs.map((r) => r.cashAt[i]))), cashAtMin: TRAIL.map((_, i) => Math.min(...recs.map((r) => r.cashAt[i]))),
    stops, storeShort, choices: mean(recs.map((r) => r.stops.filter((x) => x.choice).length)),
    minCash: mean(recs.map((r) => Math.min(...r.cashAt))), yoke: recs.filter((r) => r.yoke).length / recs.length,
    yokeKearny: recs.filter((r) => r.yoke && r.yokeLeg === 1).length / recs.length, yokeBeforeKearny: recs.filter((r) => r.yoke && r.yokeLeg === 0).length,
    fortCash: mean(recs.map((r) => mean(r.stops.slice(1).map((x) => x.arrive)))), endMax: Math.max(...recs.map((r) => r.cash)), yokeLegs: recs.filter((r) => r.yoke).map((r) => r.yokeLeg),
    sessions: mean(recs.map((r) => r.sessions)), maxSessions: Math.max(...recs.map((r) => r.sessions)), crawl: mean(recs.map((r) => r.crawl)), maxCrawl: Math.max(...recs.map((r) => r.maxCrawl)),
    stars: mean(recs.map((r) => r.stars / r.legs)), allDone: recs.every((r) => r.done) };
};
const M = {};
for (const key of Object.keys(V)) M[key] = money(key);
const cols = ['strong:natural', 'average:natural', 'weak:natural', 'strong:everything', 'average:everything', 'weak:everything'];
const name = (key) => key.replace(':natural', ' by eye').replace(':everything', ' buys all');
console.log('\nMONEY (Rookie year, 1847 dollars; the other years are the same times 2 and 4). Cash on hand on arriving at each stop, after the leg\'s pay, mean of the ' + KIDS + ' kids.');
console.log('"by eye" = shops for the next stretch by eye and forgets things; "buys all" = wants every useful thing at every store (food, blankets, a second part, arrows, rope, the yoke) and skips what the cash will not cover.');
console.log('stop                       ' + cols.map((c) => pad(name(c), 18)).join(''));
console.log('Independence (start)       ' + cols.map((c) => pad('$' + Math.round(mean(V[c].map((r) => r[0].stops[0].arrive))), 18)).join(''));
for (let i = 0; i < TRAIL.length; i++) {
  const l = TRAIL[i], tag = l.stop.kind === 'fort' ? ' *store*' : '';
  console.log(`${pad(i + 1, 2)} ${(l.stop.name + tag).padEnd(23)}  ` + cols.map((c) => pad('$' + Math.round(M[c].cashAt[i]), 18)).join(''));
}
console.log('end of journey (mean)      ' + cols.map((c) => pad('$' + Math.round(M[c].end), 18)).join(''));
console.log('end of journey (p10 / min) ' + cols.map((c) => pad(`$${Math.round(M[c].endP10)} / $${Math.round(M[c].endMin)}`, 18)).join(''));
console.log('lowest cash on arrival     ' + cols.map((c) => pad('$' + Math.round(M[c].minCash), 18)).join('') + '   (mean of each kid\'s lowest)');
console.log('stars a leg                ' + cols.map((c) => pad(f1(M[c].stars), 18)).join(''));
console.log('sessions (mean / max)      ' + cols.map((c) => pad(`${f1(M[c].sessions)} / ${M[c].maxSessions}`, 18)).join(''));
console.log('crawl days (max run)       ' + cols.map((c) => pad(`${f1(M[c].crawl)} (${M[c].maxCrawl})`, 18)).join(''));
console.log('owns the yoke by the end   ' + cols.map((c) => pad(Math.round(M[c].yoke * 100) + ' %', 18)).join(''));
console.log('yoke bought at (leg)       ' + cols.map((c) => pad(M[c].yokeLegs.length ? (() => { const h = {}; M[c].yokeLegs.forEach((x) => { h[x] = (h[x] || 0) + 1; }); return Object.entries(h).map(([k, n]) => `${k}:${n}`).join(' '); })() : '-', 18)).join(''));
console.log('\nTHE FIVE STORES: the wish list against the cash in hand on arrival (mean $), and how many kids were short of it. "short" = the wish list cost more than the cash (the kid has to choose).');
const storeNames = V['average:everything'][0][0].stops.map((s) => s.at);
console.log('store                      ' + cols.map((c) => pad(name(c), 18)).join(''));
storeNames.forEach((nm, i) => {
  console.log(`${nm.padEnd(26)} ` + cols.map((c) => { const st = M[c].stops[i]; return pad(`$${Math.round(mean(st.map((x) => x.arrive)))}/$${Math.round(mean(st.map((x) => x.wish)))} ${Math.round(M[c].storeShort[i] * 100)}%`, 18); }).join(''));
});
console.log('  (each cell: cash on arrival / the wish list\'s price, then the share of kids who could not buy it all)');
storeNames.forEach((nm, i) => console.log(`  cash left after ${nm.padEnd(18)}` + cols.map((c) => pad('$' + Math.round(mean(M[c].stops[i].map((x) => x.left))), 18)).join('')));
console.log('choices (stores short, of 5) ' + cols.map((c) => pad(f1(M[c].choices), 18)).join(''));
console.log('what the buys-all kids went without, by store (share of kids missing the item):');
for (const c of cols.filter((x) => x.endsWith('everything'))) {
  console.log('  ' + name(c).padEnd(20) + storeNames.map((nm, i) => { const st = M[c].stops[i]; const ids = {}; st.forEach((x) => x.short.forEach((id) => { ids[id] = (ids[id] || 0) + 1; })); return nm.split(' ').pop() + ': ' + (Object.entries(ids).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${Math.round(100 * n / st.length)}%`).join(', ') || 'nothing'); }).join(' | '));
}
console.log('end-of-journey cash by year (mean):  ' + SEASONS.map((sn, s) => `${sn.id} ` + cols.map((c) => `${name(c)} $${Math.round(money(c, s).end)}`).join(', ')).join('\n   '));

// ---- v1.5: the homestead (SPEC v1.5 §7.2, --homestead): a kid's whole history ----
// Rookie Oregon, then the Gold Road, then the route the profile prefers, the tiers as they open. After every journey the kid closes the year (the ledger, the farm), names the
// farm, and builds what the purses allow, the Willamette farm first: tokens on the small pieces, savings on the middle ones, nuggets on the big ones.
const PREFER = {      // after the first two journeys: the Gold Road pays for the barn, the orchard, the mill; the profiles differ in where else they like to go
  strong: [{ route: 'gold-road' }, { route: 'emigrant', choices: { 'fort-hall': 'california' } }, { route: 'gold-road' }, { route: 'emigrant', choices: { 'the-dalles': 'barlow' } }],
  average: [{ route: 'gold-road' }, { route: 'emigrant', choices: { 'south-pass': 'sublette' } }, { route: 'gold-road' }, { route: 'emigrant', choices: { 'the-dalles': 'barlow' } }],
  weak: [{ route: 'emigrant', choices: { 'the-dalles': 'barlow' } }, { route: 'gold-road' }, { route: 'emigrant', choices: {} }, { route: 'gold-road' }],
};
const HOMESTEAD_JOURNEYS = 14;
function homesteadKid(profile, i) {
  const ledger = newLedger(), farm = newFarm();
  const state = { cabinAt: null, barnAt: null, completeAt: null, tokensSpent: 0, tokensEarned: 0, log: [] };
  const tierFor = (n) => {                                  // tiers as they open: the strong kid climbs at once, the average kid after three journeys, the weak kid stays at Rookie
    const open = tiersOpen(ledger);
    if (profile === 'strong') return open.pioneer ? 'pioneer' : open.veteran ? 'veteran' : 'rookie';
    if (profile === 'average') return n >= 3 && open.veteran ? 'veteran' : 'rookie';
    return 'rookie';
  };
  const routeFor = (n) => {
    if (n === 0) return { route: 'emigrant', choices: { 'the-dalles': 'columbia' } };
    if (n === 1) return { route: 'gold-road', choices: {} };
    return PREFER[profile][(n - 2) % PREFER[profile].length];
  };
  const spec = { key: 'homestead-' + profile, journeys: Array.from({ length: HOMESTEAD_JOURNEYS }, (_, n) => ({ ...routeFor(n), tier: 'rookie' })), journeyN: 1, year: 1847, choices: {},
    afterJourney(J, rec, n) {
      if (state.completeAt == null) state.tokensEarned += rec.earned;      // (the tokens earned while the farm was still to build: after it is complete there is nothing left to spend them on)
      const c = closeJourney(J, ledger, farm, { at: n });
      if (c && c.firstHere) { const site = farm.sites[c.site]; if (!site.name) site.name = 'Farm ' + c.site; }
      // build: the Willamette farm first, tokens / savings / nuggets; a greedy kid builds whatever it can, the pieces in the content's order
      for (let guard = 0; guard < 80; guard++) {
        let built = false;
        for (const siteId of ['willamette', 'sacramento']) {
          if (!farm.sites[siteId]) continue;
          const v = homesteadView(farm, siteId, J);
          const n2 = v.next.find((x) => x.ok);
          if (n2) { const r = buildPiece(farm, siteId, n2.id, J); if (r.ok) { state.tokensSpent += r.paid.tokens; built = true; break; } }
        }
        if (!built) break;
      }
      const w = farm.sites.willamette && farm.sites.willamette.pieces;
      if (w && w.cabin && state.cabinAt == null) state.cabinAt = n + 1;
      if (w && w.barn && state.barnAt == null) state.barnAt = n + 1;
      if (farm.sites.willamette && homesteadView(farm, 'willamette').complete && state.completeAt == null) state.completeAt = n + 1;
      state.log.push({ n: n + 1, route: J.route, tier: J.tier, end: c ? c.site : null, cash: J.cash, gold: J.gold | 0, tokens: J.tokens, willamette: homesteadView(farm, 'willamette').built });
    },
    nextJourney(J, n) {
      const t = tierFor(n + 1), r = routeFor(n + 1);
      const next = startSeason(J, { route: r.route, tier: t, ledger, farm }) || startSeason(J, { route: 'emigrant', tier: 'rookie', ledger, farm });
      spec.journeys[n + 1] = { ...r, route: next.route, tier: next.tier, choices: next.route === 'gold-road' ? {} : r.choices };
      return next;
    } };
  spec.journeys[0] = { route: 'emigrant', tier: 'rookie', choices: { 'the-dalles': 'columbia' } };
  Object.assign(KID, BASE_KID, PROFILES[profile]);
  simulateKid(1000 + i * 7919, spec, 'natural');
  Object.assign(KID, BASE_KID, PROFILES.average);
  return { ledger, farm, ...state };
}
const HK = {};
if (HOMESTEAD || CHECK) for (const pl of PROFILE_KEYS) HK[pl] = Array.from({ length: KIDS }, (_, i) => homesteadKid(pl, i));
const hcell = (pl) => {
  const ks = HK[pl], done = ks.map((k) => k.completeAt || HOMESTEAD_JOURNEYS + 1);
  return { cabin: mean(ks.map((k) => k.cabinAt || HOMESTEAD_JOURNEYS + 1)), cabinMax: Math.max(...ks.map((k) => k.cabinAt || HOMESTEAD_JOURNEYS + 1)), barn: mean(ks.map((k) => k.barnAt || HOMESTEAD_JOURNEYS + 1)), barnMax: Math.max(...ks.map((k) => k.barnAt || HOMESTEAD_JOURNEYS + 1)),
    complete: mean(done), completeMin: Math.min(...done), completeMax: Math.max(...done), unfinished: ks.filter((k) => !k.completeAt).length, sink: mean(ks.map((k) => k.tokensSpent / Math.max(1, k.tokensEarned))), spent: mean(ks.map((k) => k.tokensSpent)), earned: mean(ks.map((k) => k.tokensEarned)) };
};
if (HOMESTEAD) {
  console.log('\nTHE HOMESTEAD (--homestead): ' + KIDS + ' kids a profile, ' + HOMESTEAD_JOURNEYS + ' journeys each (Rookie Oregon, the Gold Road, then the profile\'s own routes; tiers as they open). Journeys until: the cabin / the barn / every Willamette piece built');
  console.log('profile    cabin (mean / worst)   barn (mean / worst)   complete Willamette farm (mean, fastest-slowest, kids not done)   tokens spent on the farm / earned');
  for (const pl of PROFILE_KEYS) { const c = hcell(pl); console.log(`${pl.padEnd(9)}  ${pad(f1(c.cabin), 5)} / ${pad(c.cabinMax, 2)}            ${pad(f1(c.barn), 5)} / ${pad(c.barnMax, 2)}          ${pad(f1(c.complete), 5)}  (${c.completeMin}-${c.completeMax}, ${c.unfinished} not done)                     ${pad(f1(c.spent), 5)} / ${pad(f1(c.earned), 5)} = ${Math.round(c.sink * 100)} %`); }
  const k = HK.average[0]; console.log('one average kid\'s years: ' + k.log.map((l) => `${l.n}:${l.route === 'gold-road' ? 'gold' : l.end} ${l.tier[0]} ${l.gold ? l.gold + 'fl ' : ''}${l.willamette}/18`).join(' · '));
}

// ---- v1.5: every route and tier (SPEC v1.5 §7.2) ----
// What each cell must do (Rookie dollars; Veteran and Pioneer are checked against the Rookie range of the same route times TIER_RANGE).
const ROUTE_TARGETS = {
  oregon: { sessions: [18, 22], legMin: [8, 10], legMax: 14, tokens: [60, 140] },
  barlow: { endWithinOfOregon: 10, toll: 5 },
  sublette: { fortCash: 'baseline (Kearny, Laramie, Hall; Bridger is skipped)', choices: 'baseline x 4/5 (of 4 stores)', crawlRunMax: 3, barrelStrong: 0.5 },
  lander: { crawlRunMax: 3 },
  california: { end: { strong: [50, 140], average: [25, 90], weak: [15, 70] }, crawlRunMax: 3, crawlDaysMax: 3, sessions: [22, 26] },
  'gold-road': { nuggets: { strong: [7, 12], average: [6, 10], weak: [5, 8] }, crawlRunMax: 3, sessions: [11, 13] },
  later: { limps: { rookie: 1, veteran: 1.5, pioneer: 2 }, soaked: 1, crawlRunMax: 3, goldVs: { veteran: 1.25, pioneer: 1.5 }, goldSlack: 0.15 },
};
const TIER_RANGE = [0.6, 1.2];            // Veteran / Pioneer end cash (÷ price level) must fall in the Rookie range of the route × these
const CELLS = ['oregon', 'barlow', 'sublette', 'lander', 'california', 'gold-road'];
/** A cell (route × profile × policy) at one tier: the numbers the table and the checks use. */
function cellStats(specKey, profile, tier, policy = 'natural') {
  const recs = runKids(profile, policy, SPECS[specKey]).map((r) => r[tier]);
  const legMin = recs.flatMap((r) => r.legSeconds.map((x) => x / 60));
  const pm = TIER_FX[TIER_IDS[tier]].priceMult;
  const stops = recs[0].stops.map((_, i) => recs.map((r) => r.stops[i]).filter(Boolean));
  const forts = recs.map((r) => mean(r.stops.slice(1).map((x) => x.arrive)));
  return { recs, end: mean(recs.map((r) => r.cash)), endRookie: mean(recs.map((r) => r.cash)) / pm, endMax: Math.max(...recs.map((r) => r.cash / pm)),
    sessions: mean(recs.map((r) => r.sessions)), sessMax: Math.max(...recs.map((r) => r.sessions)), sessMin: Math.min(...recs.map((r) => r.sessions)), legMean: mean(legMin), legMax: Math.max(...legMin),
    crawl: mean(recs.map((r) => r.crawl)), maxRun: Math.max(...recs.map((r) => r.maxCrawl)), crawlMaxKid: Math.max(...recs.map((r) => r.crawl)), limps: mean(recs.map((r) => r.limps)),
    soaked: mean(recs.map((r) => r.soakedSacks / Math.max(1, r.legs))), tokens: mean(recs.map((r) => r.earned)), nuggets: mean(recs.map((r) => r.nuggetCount)), flakes: mean(recs.map((r) => r.gold)),
    fortCash: mean(forts), legs: recs[0].planLen, allDone: recs.every((r) => r.done), thirsty: mean(recs.map((r) => r.thirsty)), dryDays: mean(recs.map((r) => r.dryDays)),
    barrel: recs.filter((r) => r.barrelBy).length / recs.length, snubsSmooth: mean(recs.map((r) => r.snubsSmooth)), tolls: mean(recs.map((r) => r.tolls)), ious: mean(recs.map((r) => r.ious)),
    xcold: mean(recs.map((r) => r.xcold)), coldNights: mean(recs.map((r) => r.coldNights)), choices: mean(recs.map((r) => r.stops.filter((x) => x.choice).length)), stores: stops.length, deeds: mean(recs.map((r) => r.deeds)), cardsEnd: mean(recs.map((r) => r.cards)) };
}
console.log('\nROUTES AND TIERS (SPEC v1.5 §7.2): 40 kids a cell, shopping by eye; end cash is in Rookie dollars (÷ the price level); nuggets = whole nuggets of the flakes found');
console.log('cell                         legs  sessions (mean/max)  leg min (mean/max)  end cash S / A / W            unfed days (max run)  limps  soaked/leg  tokens/journey  nuggets S / A / W      thirsty days  barrel  tolls (IOUs)  smooth slides');
for (const key of CELLS) {
  TIER_IDS.forEach((tid, t) => {
    const S = cellStats(key, 'strong', t), A = cellStats(key, 'average', t), W = cellStats(key, 'weak', t);
    const all = [S, A, W];
    console.log(`${(tid + ' ' + SPECS[key].label).padEnd(28).slice(0, 28)} ${pad(A.legs, 4)}   ${pad(f1(A.sessions), 5)} / ${pad(A.sessMax, 2)}          ${pad(f1(A.legMean), 5)} / ${pad(f1(A.legMax), 5)}    ` +
      `$${pad(Math.round(S.endRookie), 3)} / $${pad(Math.round(A.endRookie), 3)} / $${pad(Math.round(W.endRookie), 3)}          ${pad(f1(mean(all.map((x) => x.crawl))), 4)} (${Math.max(...all.map((x) => x.maxRun))})` +
      `            ${pad(f2(mean(all.map((x) => x.limps))), 5)}  ${pad(f2(mean(all.map((x) => x.soaked))), 5)}       ${pad(f1(A.tokens), 6)}        ${pad(f1(S.nuggets), 4)} / ${pad(f1(A.nuggets), 4)} / ${pad(f1(W.nuggets), 4)}        ${pad(f1(A.thirsty), 5)}      ${pad(Math.round(S.barrel * 100) + '%', 4)}   ${pad(f1(A.tolls), 4)} (${f1(A.ious)})   ${pad(f1(A.snubsSmooth), 4)}`);
  });
}
{
  // minutes by leg on the baseline route (Rookie, the three players): where the long legs are
  const recs = PROFILE_KEYS.flatMap((pl) => cellStats('oregon', pl, 0).recs);
  console.log('minutes by leg, Rookie Oregon (mean / max over the three players): ' + TRAIL.map((l, i) => { const m = recs.map((r) => r.legSeconds[i] / 60); return `${i + 1} ${l.id} ${f1(mean(m))}/${f1(Math.max(...m))}`; }).join(' · '));
}
console.log('(unfed days: days that began with no food, mean of the three players; a kid who left a dry stretch without the barrel is "thirsty": -4 spirit, never a lost day)');
{
  // sublette: the stores it keeps are Independence, Fort Kearny, Fort Laramie and Fort Hall; the buys-all kids' choices
  const sc = (pl, t = 0) => cellStats('sublette', pl, t, 'everything');
  console.log('sublette buys-all, choices of 4 stores (S / A / W): ' + PROFILE_KEYS.map((pl) => f1(sc(pl).choices)).join(' / ') + '    fort cash by eye at Kearny, Laramie, Hall (S / A / W): ' + PROFILE_KEYS.map((pl) => '$' + Math.round(cellStats('sublette', pl, 0).fortCash)).join(' / '));
}

// ---- v1.7.1: food on arrival, in pounds (the 1.5 playtest's bot ended a journey with 2,200-2,700 lb: it hunted, fished and traded at every chance) ----
// Every route, the three players shopping by eye plus "forager" kids (the strong player playing as the bot did: camps at every stop to hunt or fish, talks to everyone,
// buys food to the store's hint and a tenth more, keeps ten arrows). Pounds on arriving at each stop over the three tiers; peak = the most the wagon held at any time.
const FOOD_COLS = [['strong', 'natural', 'S by eye'], ['average', 'natural', 'A by eye'], ['weak', 'natural', 'W by eye'], ['strong', 'forager', 'S forager'], ['average', 'forager', 'A forager']];
const foodCell = (key, pl, pol) => {
  const recs = runKids(pl, pol, SPECS[key]).flat(), lb = recs.flatMap((r) => r.arriveFoodLb);
  return { mean: mean(lb), p90: pct(lb, 0.9), max: Math.max(...lb), peak: Math.max(...recs.map((r) => r.peakFood)), aside: mean(recs.map((r) => r.setAside)), behind: mean(recs.map((r) => r.leftBehind)),
    crawl: mean(recs.map((r) => r.crawl)), maxRun: Math.max(...recs.map((r) => r.maxCrawl)), recs };
};
console.log(`\nFOOD ON ARRIVAL (v1.7.1), lb, the three tiers pooled: mean / p90 / max on arriving at a stop, [peak held]; set aside (damp flour) and left behind (no room) a journey, mean; carrying limit ${LOAD.foodLb} lb`);
console.log('route                        ' + FOOD_COLS.map((c) => c[2].padEnd(36)).join(''));
for (const key of CELLS) {
  console.log(SPECS[key].label.padEnd(28).slice(0, 28) + ' ' + FOOD_COLS.map(([pl, pol]) => { const c = foodCell(key, pl, pol); return `${pad(Math.round(c.mean), 4)} / ${pad(c.p90, 4)} / ${pad(c.max, 4)} [${pad(c.peak, 4)}] ${pad(Math.round(c.aside), 3)}/${pad(Math.round(c.behind), 3)}`.padEnd(36); }).join(''));
}
console.log('weak by eye, days with no food a journey (max run): ' + CELLS.map((key) => { const w = foodCell(key, 'weak', 'natural'); return `${SPECS[key].label} ${f1(w.crawl)} (${w.maxRun})`; }).join(' · '));

// ---- v1.6 (The Lab): the six choice moments (lab/SPEC.md §4.4): a shortcut that risks a soaked sack, paying a guide to save a day ----
// `choices` in the printouts above are the stores short of the wish list; THESE are the choice moments. Each route's Rookie journey is run by the same kids four ways: always the plain
// way (a), only the shortcuts taken (sc), only the guides paid (gd), every way taken (b); the cash at the end (the money the choices touch) must differ by at most $3 from always-a,
// the sessions stay a leg a session, and nobody is stuck. The shortcut is 15 miles shorter and 1 time in 4 a 50 lb sack of flour is soaked (a day of food for four at full rations is 12 lb;
// 25 % of 50 lb is 12.5 lb); the guide's fee (GUIDE.fee, in 1847 dollars) is the number this section tunes. A leg a choice shortens pays as the full leg.
const MOMENT_CELLS = [['oregon', 'Oregon (ash-hollow, ice-slough)'], ['california', 'California (+ humboldt-river, big-meadows)'], ['gold-road', 'the Gold Road (rogue-river, siskiyou-pass)']];
const MOMENT_MODES = { a: { shortcut: 'a', guide: 'a' }, sc: { shortcut: 'b', guide: 'a' }, gd: { shortcut: 'a', guide: 'b' }, b: { shortcut: 'b', guide: 'b' } };
const MOMENT_KIDS = Number(process.env.MOMENT_KIDS) || 360;      // (120 kids give ±1.5 dollars of noise on a cell's mean; 360 give ±0.9)
const momentCache = {};
function momentCell(key, mode) {
  const ck = `${key}|${mode}`;
  if (momentCache[ck]) return momentCache[ck];
  const base = SPECS[key];
  const spec = { ...base, journeys: [{ route: base.route, tier: 'rookie', choices: base.choices }], moments: MOMENT_MODES[mode], key: `moment-${key}-${mode}` };
  const recs = [];
  for (const pl of PROFILE_KEYS) {
    Object.assign(KID, BASE_KID, PROFILES[pl]);
    for (let i = 0; i < MOMENT_KIDS / PROFILE_KEYS.length; i++) recs.push(simulateKid(1000 + i * 7919 + 3, spec, 'natural')[0]);
  }
  Object.assign(KID, BASE_KID, PROFILES.average);
  const legMin = recs.flatMap((r) => r.legSeconds.map((x) => x / 60));
  return (momentCache[ck] = { recs, end: mean(recs.map((r) => r.cash)), sessions: mean(recs.map((r) => r.sessions)), sessMax: Math.max(...recs.map((r) => r.sessions)), legMean: mean(legMin), legMax: Math.max(...legMin),
    maxRun: Math.max(...recs.map((r) => r.maxCrawl)), crawl: mean(recs.map((r) => r.crawl)), asked: mean(recs.map((r) => r.moment.asked)), b: mean(recs.map((r) => r.moment.b)), cut: mean(recs.map((r) => r.moment.cut)),
    soaked: mean(recs.map((r) => r.moment.soaked)), soakedLb: mean(recs.map((r) => r.moment.soakedLb)), fee: mean(recs.map((r) => r.moment.fee)), food: mean(recs.flatMap((r) => r.arriveFoodDays)),
    stars: mean(recs.map((r) => r.stars / r.legs)), allDone: recs.every((r) => r.done) });
}
const MOMENT_TARGETS = { endWithin: 3, sessions: { oregon: [18, 22], california: [22, 26], 'gold-road': [11, 13] }, crawlRunMax: 3, soakShare: [0.1, 0.45] };
console.log(`\nCHOICE MOMENTS (v1.6, lab/SPEC.md §4.4): ${MOMENT_KIDS} Rookie kids a cell (strong / average / weak thirds), shopping by eye; GUIDE.fee $${GUIDE.fee} × the price level, SHORTCUT ${SHORTCUT.miles} miles and ${SHORTCUT.soakChance * 100} % of ${SHORTCUT.soakLb} lb soaked`);
console.log('route / way taken                                end cash (Δ vs a)   sessions (max)   leg min (mean/max)   unfed (max run)   food at arrival, days   asked   b taken   miles saved   soaked sacks   fee paid');
for (const [key, label] of MOMENT_CELLS) {
  const A = momentCell(key, 'a');
  for (const mode of Object.keys(MOMENT_MODES)) {
    const c = momentCell(key, mode);
    console.log(`${label.split(' (')[0].padEnd(11)} ${{ a: 'always a      ', sc: 'shortcuts only', gd: 'guides only   ', b: 'always b      ' }[mode]}  $${pad(f1(c.end), 5)} (${(c.end - A.end >= 0 ? '+' : '') + f1(c.end - A.end)})`.padEnd(48) +
      `${pad(f1(c.sessions), 5)} (${c.sessMax})      ${pad(f1(c.legMean), 5)} / ${pad(f1(c.legMax), 5)}     ${pad(f1(c.crawl), 4)} (${c.maxRun})           ${pad(f1(c.food), 5)}               ${pad(f1(c.asked), 4)}    ${pad(f1(c.b), 5)}    ${pad(f1(c.cut), 8)}      ${pad(f2(c.soaked), 6)}      $${f2(c.fee)}`);
  }
}

if (CHECK) {
  const problems = [];
  const stuck = runs.flat().filter((r) => r.maxCrawl > 3);
  if (stuck.length) problems.push(`${stuck.length} kid-seasons crawled with no food for more than 3 days in a row (max ${Math.max(...stuck.map((r) => r.maxCrawl))})`);
  if (!rows.every((r) => r.allDone)) problems.push('a kid did not finish a season');
  const first = runs.map((r) => r[0].sessions);
  if (Math.max(...first) > 24) problems.push(`the first journey took ${Math.max(...first)} sessions (> 24)`);
  if (Math.min(...first) < 16) problems.push(`the first journey took ${Math.min(...first)} sessions (< 16)`);
  if (Math.abs(rows[0].sessMean - 20) > 2) problems.push(`the first journey's mean is ${f1(rows[0].sessMean)} sessions (target 20 ± 2: a leg a session)`);
  if (rows[0].legMean < ROUTE_TARGETS.oregon.legMin[0] || rows[0].legMean > ROUTE_TARGETS.oregon.legMin[1]) problems.push(`the mean leg takes ${f1(rows[0].legMean)} minutes (want ${ROUTE_TARGETS.oregon.legMin[0]}-${ROUTE_TARGETS.oregon.legMin[1]})`);
  if (rows.some((r) => r.cashMin < 0)) problems.push('cash went below $0');
  if (runs.flat().some((r) => r.flow.some((f) => f.bal < 0))) problems.push('the token balance went below 0');
  if (side[0].anyUp < 0.9) problems.push(`only ${Math.round(side[0].anyUp * 100)} % of kids bought an upgrade in the first season (< 90 %)`);
  if (side[0].done < 0.25 || side[0].done > 0.9) problems.push(`the daily challenge was done ${Math.round(side[0].done * 100)} % of days (want 25-90 %)`);
  // v1.2: soaked sacks < 1 a leg, limps < 1 a season, tokens 3-10 a leg
  for (const r of v12) {
    if (r.soakedPerLeg >= 1) problems.push(`${r.season}: ${f2(r.soakedPerLeg)} soaked sacks a leg (want < 1)`);
    if (r.limps >= ({ rookie: 1, veteran: 1.5, pioneer: 2 }[r.season])) problems.push(`${r.season}: ${f2(r.limps)} limps a season (want < ${{ rookie: 1, veteran: 1.5, pioneer: 2 }[r.season]})`);
  }
  if (rows[0].tokens * TRAIL.length < 60 || rows[0].tokens * TRAIL.length > 140) problems.push(`${rows[0].season}: ${f1(rows[0].tokens * TRAIL.length)} tokens earned a journey (want 60-140)`);      // (Rookie: Veteran and Pioneer earn more by design: a Pioneer first try is worth two tokens)
  // v1.3: money is a choice (TARGETS above)
  const T = TARGETS, within = (x, [lo, hi]) => x >= lo && x <= hi;
  for (const key of Object.keys(V)) {            // every player, every way of shopping, every season: finishes, nobody stuck, no yoke at Independence
    SEASONS.forEach((sn, s) => { const m = money(key, s); if (!m.allDone) problems.push(`${name(key)}, ${sn.id}: a kid did not finish`); if (m.maxCrawl > T.weak.crawlRunMax) problems.push(`${name(key)}, ${sn.id}: ${m.maxCrawl} days in a row with no food (> ${T.weak.crawlRunMax})`); });
    if (money(key).yokeBeforeKearny) problems.push(`${name(key)}: a yoke was bought before Fort Kearny`);
  }
  for (const p of Object.keys(PROFILES)) {
    const e = money(`${p}:natural`);
    if (!within(e.end, T.end[p])) problems.push(`${p} by eye ends with $${Math.round(e.end)} (want $${T.end[p][0]}-$${T.end[p][1]})`);
    if (!within(e.fortCash, T.fortCash[p])) problems.push(`${p} by eye arrives at the four forts with $${Math.round(e.fortCash)} on average (want $${T.fortCash[p][0]}-$${T.fortCash[p][1]})`);
    if (e.endMax > T.endMaxAny) problems.push(`${p} by eye: a kid ended with $${e.endMax} (want at most $${T.endMaxAny})`);
    const c = money(`${p}:everything`);
    if (!within(c.choices, T.choices[p])) problems.push(`${p} buys-all is short of the wish list at ${f1(c.choices)} of the 5 stores (want ${T.choices[p][0]}-${T.choices[p][1]})`);
    for (let s = 1; s < SEASONS.length; s++) {   // the later seasons are the same economy times the price level (rounding aside)
      const later = money(`${p}:natural`, s).end / SEASONS[s].priceMult, [lo, hi] = T.end[p];
      if (later < lo * TIER_RANGE[0] || later > hi * TIER_RANGE[1]) problems.push(`${p} by eye in ${SEASONS[s].id} ends with $${Math.round(later)} at 1847 prices (want ${Math.round(lo * TIER_RANGE[0])}-${Math.round(hi * TIER_RANGE[1])})`);
    }
  }
  if (money('strong:natural').end - money('average:natural').end < T.endGap.strongOverAverage) problems.push('the strong player does not end far enough ahead of the average one');
  if (money('average:natural').end - money('weak:natural').end < T.endGap.averageOverWeak) problems.push('the average player does not end far enough ahead of the weak one');
  const ys = money('strong:natural'), yw = money('weak:natural'), ya = money('average:everything');
  if (ys.yoke < T.yoke.strongBy) problems.push(`only ${Math.round(ys.yoke * 100)} % of strong journeys own the yoke by the end (want ${T.yoke.strongBy * 100} %)`);
  if (ys.yokeKearny > T.yoke.strongAtKearnyMax) problems.push(`${Math.round(ys.yokeKearny * 100)} % of strong journeys buy the yoke the first time it is on the shelf (want at most ${T.yoke.strongAtKearnyMax * 100} %)`);
  if (yw.yoke > T.yoke.weakMax) problems.push(`${Math.round(yw.yoke * 100)} % of weak journeys own the yoke (want at most ${T.yoke.weakMax * 100} %)`);
  if (!within(ya.yoke, T.yoke.averageBuysAll)) problems.push(`${Math.round(ya.yoke * 100)} % of average buys-all journeys own the yoke (want ${T.yoke.averageBuysAll[0] * 100}-${T.yoke.averageBuysAll[1] * 100} %)`);
  for (const key of ['weak:natural', 'weak:everything']) {
    const w = money(key);
    if (w.maxSessions > T.weak.sessionsMax) problems.push(`${name(key)}: a journey took ${w.maxSessions} sessions (> ${T.weak.sessionsMax})`);
    if (w.crawl > T.weak.crawlDaysMax) problems.push(`${name(key)}: ${f1(w.crawl)} days with no food a journey (> ${T.weak.crawlDaysMax})`);
  }
  // v1.4 (SPEC v1.4 §7.2): the 1.3 TARGETS above all stand unchanged; and
  for (const r of v14) {
    if (Math.abs(r.fishFree / mean13 - 1) > 0.10) problems.push(`${r.season}: a free fishing session brings ${f2(r.fishFree)} lb, ${Math.round((r.fishFree / mean13 - 1) * 1000) / 10} % off 1.3's ${f2(mean13)} (want within 10 %)`);
    if (r.mandDog > 60) problems.push(`${r.season}: the mandatory v1.4 seconds a leg (nose + fact + dust devil) average ${f1(r.mandDog)} with the dog (want at most 60)`);
    if (r.noseLegsShare < 0.95) problems.push(`${r.season}: a nose moment on only ${Math.round(r.noseLegsShare * 100)} % of the legs with the dog (want 95 %)`);
    if (r.locketOk !== r.locketOf) problems.push(`${r.season}: the locket was given back or mailed by ${r.locketOk} of ${r.locketOf} kids who kept the dog (want all)`);
    if (r.funPerLeg >= 1) problems.push(`${r.season}: the dust devil, the quests and the eight new deeds earn ${f2(r.funPerLeg)} tokens a leg (want under 1)`);
  }
  if (v14[0].horseshoe > 8) problems.push(`horseshoes sold for $${f1(v14[0].horseshoe)} a Rookie journey (want about $3, at most $8)`);
  if (rows[0].legMax > ROUTE_TARGETS.oregon.legMax) problems.push(`a leg took ${f1(rows[0].legMax)} minutes (want at most ${ROUTE_TARGETS.oregon.legMax})`);
  // v1.5: the homestead's pace (§7.2 --homestead): the cabin after journey 1 for every kid, the barn by journey 3 for the average kid, every Willamette piece in 5-9 journeys for the average kid and never fewer than 4 for the strong; the token sink
  {
    const hs = Object.fromEntries(PROFILE_KEYS.map((pl) => [pl, hcell(pl)]));
    for (const pl of PROFILE_KEYS) if (hs[pl].cabinMax > 1) problems.push(`homestead, ${pl}: a kid's cabin took until journey ${hs[pl].cabinMax} (want after journey 1)`);
    if (hs.average.barn > 3) problems.push(`homestead: the average kid's barn comes at journey ${f1(hs.average.barn)} (want by 3)`);
    if (hs.average.complete < 5 || hs.average.complete > 9) problems.push(`homestead: the average kid completes the Willamette farm at journey ${f1(hs.average.complete)} (want 5-9)`);
    if (hs.strong.completeMin < 4) problems.push(`homestead: a strong kid completed the farm at journey ${hs.strong.completeMin} (want never fewer than 4)`);
    for (const pl of PROFILE_KEYS) if (hs[pl].sink < 0.5) problems.push(`homestead, ${pl}: ${Math.round(hs[pl].sink * 100)} % of the tokens earned were spent on the farm (want at least half)`);
  }
  // v1.5: every route and tier
  {
    const T2 = ROUTE_TARGETS, within2 = (x, [lo, hi]) => x >= lo && x <= hi;
    for (const key of CELLS) for (let t = 0; t < 3; t++) for (const pl of PROFILE_KEYS) {
      const c = cellStats(key, pl, t), tag = `${TIER_IDS[t]} ${SPECS[key].label}, ${pl}`;
      if (!c.allDone) problems.push(`${tag}: a kid did not finish`);
      if (c.maxRun > 3) problems.push(`${tag}: ${c.maxRun} days in a row with no food (> 3)`);
      if (c.end < 0) problems.push(`${tag}: cash below $0`);
      if (c.soaked >= T2.later.soaked) problems.push(`${tag}: ${f2(c.soaked)} soaked sacks a leg (want < 1)`);
      if (pl === 'average' && c.limps >= T2.later.limps[TIER_IDS[t]]) problems.push(`${tag}: ${f2(c.limps)} limps a journey (want < ${T2.later.limps[TIER_IDS[t]]})`);      // (the average player, as the printed table; the weak player runs leaner)
    }
    for (const key of CELLS) for (let t = 0; t < 3; t++) {
      const A = cellStats(key, 'average', t), exp = { oregon: 20, barlow: 20, sublette: 20, lander: 18, california: 24, 'gold-road': 12 }[key];
      if (Math.abs(A.sessions - exp) > 0.5) problems.push(`${TIER_IDS[t]} ${SPECS[key].label}: ${f1(A.sessions)} sessions (a leg a session: ${exp})`);
      if (A.legMax > T2.oregon.legMax + 2.5) problems.push(`${TIER_IDS[t]} ${SPECS[key].label}: a leg took ${f1(A.legMax)} minutes (want at most about ${T2.oregon.legMax})`);
    }
    // Veteran / Pioneer money against the Rookie range of the route
    for (const key of ['oregon', 'barlow', 'sublette', 'lander', 'california']) for (const pl of PROFILE_KEYS) {
      const lo = cellStats(key, pl, 0).endRookie;
      for (let t = 1; t < 3; t++) { const v = cellStats(key, pl, t).endRookie; if (v < lo * TIER_RANGE[0] || v > lo * TIER_RANGE[1]) problems.push(`${TIER_IDS[t]} ${SPECS[key].label}, ${pl}: ends with $${Math.round(v)} at Rookie prices; the Rookie journey ends with $${Math.round(lo)} (want ${TIER_RANGE[0]}-${TIER_RANGE[1]} x)`); }
    }
    // Barlow: within $10 of the raft's end cash minus the toll
    for (const pl of PROFILE_KEYS) { const b = cellStats('barlow', pl, 0).endRookie, o = cellStats('oregon', pl, 0).endRookie - T2.barlow.toll; if (Math.abs(b - o) > T2.barlow.endWithinOfOregon) problems.push(`Barlow Road, ${pl}: ends with $${Math.round(b)}, the raft minus the toll is $${Math.round(o)} (want within $${T2.barlow.endWithinOfOregon})`); }
    // Sublette: fort cash and choices as the baseline's, the barrel
    for (const pl of PROFILE_KEYS) {
      const fc = cellStats('sublette', pl, 0).fortCash; if (!within2(fc, T.fortCash[pl])) problems.push(`Sublette Cutoff, ${pl} by eye arrives at its three forts with $${Math.round(fc)} on average (want $${T.fortCash[pl][0]}-$${T.fortCash[pl][1]})`);
      const ch = cellStats('sublette', pl, 0, 'everything').choices, [a, b] = T.choices[pl]; if (ch < a * 0.8 - 0.3 || ch > Math.min(4, b * 0.8 + 0.2)) problems.push(`Sublette Cutoff, ${pl} buys-all is short at ${f1(ch)} of the 4 stores (want ${f1(a * 0.8 - 0.3)}-${f1(Math.min(4, b * 0.8 + 0.2))})`);
    }
    const sb = cellStats('sublette', 'strong', 0); if (sb.barrel < T2.sublette.barrelStrong) problems.push(`Sublette Cutoff: the water barrel is owned by ${Math.round(sb.barrel * 100)} % of strong kids at the dry stretch (want ${T2.sublette.barrelStrong * 100} %)`);
    // California
    for (const pl of PROFILE_KEYS) { const c = cellStats('california', pl, 0); if (!within2(c.endRookie, T2.california.end[pl])) problems.push(`California, ${pl}: ends with $${Math.round(c.endRookie)} (want $${T2.california.end[pl][0]}-$${T2.california.end[pl][1]})`); if (c.crawl > T2.california.crawlDaysMax) problems.push(`California, ${pl}: ${f1(c.crawl)} days with no food a journey (> ${T2.california.crawlDaysMax})`); }
    // Gold Road: the gold, the weak finishes
    for (const pl of PROFILE_KEYS) { const g = cellStats('gold-road', pl, 0); if (!within2(g.nuggets, T2['gold-road'].nuggets[pl])) problems.push(`Gold Road, ${pl}: ${f1(g.nuggets)} nuggets a journey (want ${T2['gold-road'].nuggets[pl][0]}-${T2['gold-road'].nuggets[pl][1]})`); }
    // gold x 1.25 / x 1.5 of Rookie, within 15 %
    for (const key of ['gold-road', 'california']) for (const pl of PROFILE_KEYS) {
      const r0 = cellStats(key, pl, 0).flakes;
      for (let t = 1; t < 3; t++) { const g = cellStats(key, pl, t).flakes, want = r0 * T2.later.goldVs[TIER_IDS[t]]; if (r0 > 0 && Math.abs(g / want - 1) > T2.later.goldSlack) problems.push(`${TIER_IDS[t]} ${SPECS[key].label}, ${pl}: ${f1(g)} flakes, Rookie ${f1(r0)} x ${T2.later.goldVs[TIER_IDS[t]]} is ${f1(want)} (want within ${T2.later.goldSlack * 100} %)`); }
    }
  }

  // v1.6: the choice moments: expected-value neutral on cash (always-b within $3 of always-a), a leg a session, nobody stuck, the soaked sacks about one time in four
  {
    const MT = MOMENT_TARGETS;
    for (const [key, label] of MOMENT_CELLS) {
      const A = momentCell(key, 'a');
      for (const mode of Object.keys(MOMENT_MODES)) {
        const c = momentCell(key, mode), tag = `choice moments, ${label}, ${{ a: 'always a', sc: 'shortcuts only', gd: 'guides only', b: 'always b' }[mode]}`;
        if (!c.allDone) problems.push(`${tag}: a kid did not finish`);
        if (c.maxRun > MT.crawlRunMax) problems.push(`${tag}: ${c.maxRun} days in a row with no food (> ${MT.crawlRunMax})`);
        if (Math.abs(c.end - A.end) > MT.endWithin) problems.push(`${tag}: ends with $${f1(c.end)} against always-a's $${f1(A.end)} (want within $${MT.endWithin})`);
        const [lo, hi] = MT.sessions[key]; if (c.sessions < lo || c.sessions > hi) problems.push(`${tag}: ${f1(c.sessions)} sessions (want ${lo}-${hi})`);
        if (c.legMax > ROUTE_TARGETS.oregon.legMax + 3) problems.push(`${tag}: a leg took ${f1(c.legMax)} minutes (want at most about ${ROUTE_TARGETS.oregon.legMax + 3} with 360 kids)`);
      }
      const sc = momentCell(key, 'sc'), nSc = sc.b;
      if (nSc > 0) { const share = sc.soaked / nSc; if (share < MT.soakShare[0] || share > MT.soakShare[1]) problems.push(`choice moments, ${label}: ${Math.round(share * 100)} % of the shortcuts soaked a sack (want about 25 %: ${MT.soakShare[0] * 100}-${MT.soakShare[1] * 100} %)`); }
    }
  }
  // v1.7.1: food on arrival (TARGETS.food): the carrying limit holds, the strong player is comfortable without a pile, the weak player is fed as 1.3 allows
  {
    const F = T.food;
    for (const key of CELLS) {
      for (const [pl, pol, nm] of FOOD_COLS) {
        const c = foodCell(key, pl, pol), tag = `food, ${SPECS[key].label}, ${nm}`;
        if (c.peak > LOAD.foodLb) problems.push(`${tag}: a wagon held ${c.peak} lb (want at most the ${LOAD.foodLb} lb it carries)`);
        if (c.maxRun > F.crawlRunMax) problems.push(`${tag}: ${c.maxRun} days in a row with no food (> ${F.crawlRunMax})`);
        if (pl === 'strong') {
          if (!within(c.mean, F.strongMean)) problems.push(`${tag}: arrives with ${Math.round(c.mean)} lb on average (want ${F.strongMean[0]}-${F.strongMean[1]})`);
          if (c.p90 > F.strongP90) problems.push(`${tag}: arrives with ${c.p90} lb or more one stop in ten (want at most ${F.strongP90})`);
        }
      }
      const w = foodCell(key, 'weak', 'natural'), most = key === 'california' ? ROUTE_TARGETS.california.crawlDaysMax : F.weakCrawlDays;
      if (w.crawl > most) problems.push(`food, ${SPECS[key].label}, weak by eye: ${f1(w.crawl)} days with no food a journey (want at most ${most})`);
    }
  }
  if (problems.length) { console.log('\nCHECK FAILED:\n  ' + problems.join('\n  ')); process.exit(1); }
  console.log('\nCHECK PASSED: nobody stuck, first season ' + f1(rows[0].sessMean) + ` sessions (${Math.min(...first)}-${Math.max(...first)}), soaked sacks ${f2(v12[0].soakedPerLeg)} a leg, limps ${f2(v12[0].limps)} a season, tokens ${f1(rows[0].tokens)} a leg`);
}

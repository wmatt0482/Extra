// Years and carry-over (SPEC v1.5 §3.6): a year is a journey. The ledger (save-level, never on J) counts the years: the calendar moves one year per
// journey (the first is 1847), routes and forks open in their real years, the tiers open as trophies are won. startSeason makes the next journey from the
// last one (what is carried, what starts over), closeJourney closes one at its trail's end (banks it into the farm, writes the ledger). Pure: no DOM, no
// clock (the app passes `at`), no storage, no Math.random.
import { COMPANION_BY_ID } from '../content/companions.js';
import { TIERS, TIER_BY_ID } from '../content/tiers.js';
import { ROUTES } from '../content/routes.js';
import { routesOpen, tierOf, branchesTaken, chooseBranch, usePlan } from './route.js';
import { bankJourney, foundSite, farmGifts, endSiteOf, mergeFarm } from './homestead.js';
import { carry14, merge14 } from './collections.js';
import { addFoodKind } from './supplies.js';
import { hashSeed } from './rng.js';

/** What a new journey keeps from the last one (cards and deeds as lists, the rest as they are): the trail cards, the deeds, the trade tokens, the wagon upgrades,
 *  the daily challenges' claims and the dog. */
export const CARRY = ['cards', 'deeds', 'tokens', 'upgrades', 'challenges', 'dog'];
/** v1.4's collection fields on J that a new journey keeps (collections.js `carry14` does the copying): the finds, the fish log, the junk, the biggest fish, the skipping
 *  stones, the wishes, the quests given back, the longest fetch, the shiny spoon and the far-off sounds switch. (v1.4's own rule resets the quests in progress,
 *  the trail facts heard and the moments each season, so the locket's state and `factsHeard` are NOT carried; `questsDone` is: a quest given back stays in the journal.) */
export const CARRY_V14 = ['finds', 'fishLog', 'fishJunk', 'fishBest', 'skips', 'wishes', 'questsDone', 'treatsBest', 'goods.spoon', 'opts.farSounds'];

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const uniq = (...lists) => { const out = []; for (const l of lists) for (const x of Array.isArray(l) ? l : []) if (!out.includes(x)) out.push(x); return out; };
export const JOURNEYS_KEPT = 60;
const FIRST_YEAR = 1847;

/** A new ledger: the year, the journeys finished (newest 60), the routes and branches travelled, the tiers finished, the trophies, and the lifetime totals. */
export const newLedger = () => ({ year: FIRST_YEAR, journeys: [], routesDone: [], branchesDone: [], tiersDone: { rookie: 0, veteran: 0, pioneer: 0 },
  trophies: [], lifetime: { legs: 0, miles: 0, flakes: 0, peopleMet: 0 } });

/** A ledger from anything (a save): every field present and sane. */
export function normalizeLedger(raw) {
  const L = newLedger();
  if (!isObj(raw)) return L;
  L.year = Number.isFinite(raw.year) && raw.year >= FIRST_YEAR ? Math.floor(raw.year) : FIRST_YEAR;
  if (Array.isArray(raw.journeys)) L.journeys = raw.journeys.filter((j) => isObj(j) && j.id != null).slice(-JOURNEYS_KEPT).map(clone);
  for (const k of ['routesDone', 'branchesDone', 'trophies']) L[k] = Array.isArray(raw[k]) ? raw[k].filter((x) => typeof x === 'string') : [];
  if (isObj(raw.tiersDone)) for (const t of Object.keys(L.tiersDone)) L.tiersDone[t] = num(raw.tiersDone[t]);
  if (isObj(raw.lifetime)) for (const k of Object.keys(L.lifetime)) L.lifetime[k] = num(raw.lifetime[k]);
  return L;
}

/** The family-sync merge of two ledgers (SPEC v1.5 §5.6): journeys union by id (the journey's season + seed), the newest 60 kept; year max; routesDone, branchesDone and
 *  trophies union; tiersDone per tier max; lifetime per field max. `s` is the later doc; returns a new ledger. */
export function mergeLedger(s, o) {
  const a = normalizeLedger(s), b = normalizeLedger(o);
  const out = newLedger();
  out.year = Math.max(a.year, b.year);
  const seen = new Set(), all = [];
  for (const j of [...b.journeys, ...a.journeys]) if (!seen.has(String(j.id))) { seen.add(String(j.id)); all.push(j); }
  out.journeys = all.map((j, i) => [j, i]).sort((p, q) => (Number(p[0].at) || 0) - (Number(q[0].at) || 0) || (Number(p[0].year) || 0) - (Number(q[0].year) || 0) || p[1] - q[1]).map((x) => x[0]).slice(-JOURNEYS_KEPT);
  for (const k of ['routesDone', 'branchesDone', 'trophies']) out[k] = uniq(a[k], b[k]);
  for (const t of Object.keys(out.tiersDone)) out.tiersDone[t] = Math.max(a.tiersDone[t], b.tiersDone[t]);
  for (const k of Object.keys(out.lifetime)) out.lifetime[k] = Math.max(a.lifetime[k], b.lifetime[k]);
  return out;
}

/** The year of a ledger, a journey or a number (1847 when unknown). */
export const yearOf = (x) => (typeof x === 'number' && x >= FIRST_YEAR ? Math.floor(x) : x && Number.isFinite(x.year) && x.year >= FIRST_YEAR ? Math.floor(x.year) : FIRST_YEAR);

/** Which tiers are open: Rookie always; Veteran once a journey is finished; Pioneer once a Veteran journey is (Trail Blazer's cups: a trophy opens the next cup). */
export function tiersOpen(ledger) {
  const L = normalizeLedger(ledger);
  const done = Object.values(L.tiersDone).reduce((a, b) => a + b, 0) + L.journeys.filter((j) => !j.tier).length;
  return { rookie: true, veteran: done >= 1 || L.journeys.length >= 1, pioneer: L.tiersDone.veteran + L.tiersDone.pioneer >= 1 || L.journeys.some((j) => j.tier === 'veteran' || j.tier === 'pioneer') };
}
/** What the ledger unlocks: the Gold Road, the tiers, the South Pass fork (from the second journey) and the two companions (also from the second journey). */
export function unlocksFor(ledger) {
  const L = normalizeLedger(ledger);
  const n = L.journeys.length + 1, t = tiersOpen(L);
  return { goldRoad: !!(routesOpen(L).find((r) => r.id === 'gold-road') || {}).open, veteran: t.veteran, pioneer: t.pioneer, forks: { 'south-pass': n >= 2 },
    companions: n >= 2 ? ['packer', 'prospector'] : [] };
}

// sim.js hands in createJourney (and the first-leg replanning) when it loads: this module must not import sim.js (sim.js re-exports this one)
let SIM = null;
export function bindSim(api) { SIM = api; }

/** The next journey (a new J; the app replaces the old one): the year is ledger.year, journeyN = ledger.journeys.length + 1; CARRY and CARRY_V14 are copied from `prev`
 *  (cards and deeds as lists, the rest as they are); a Gold Road start adds the farm's gifts; refused (null) for a closed route or tier. Without a ledger (newSeason, the
 *  tools) the year and the number follow `prev`. Not carried: cash (banked into the farm), food, goods, the animals' tiredness, the people met, the per-journey totals. */
export function startSeason(prev, { route = 'emigrant', tier = 'rookie', family = 'own', animal, companions, seed, ledger = null, farm = null, wagonName, hunting } = {}) {
  const t = tierOf(tier);
  if (ledger) {
    const open = routesOpen(ledger).find((r) => r.id === route);
    if (!open || !open.open || !tiersOpen(ledger)[t]) return null;
  }
  const L = ledger ? normalizeLedger(ledger) : null;
  const year = L ? L.year : prev ? yearOf(prev.year) + 1 : FIRST_YEAR;
  const journeyN = L ? L.journeys.length + 1 : prev ? Math.max(1, prev.journeyN | 0) + 1 : 1;
  const comps = (companions || (prev && prev.companions) || []).filter((id) => !COMPANION_BY_ID[id] || (COMPANION_BY_ID[id].fromJourney || 1) <= journeyN);
  const J = SIM.createJourney({ route, tier: t, year, journeyN, family, animal: animal || (prev && prev.animal) || 'oxen', companions: comps,
    wagonName: wagonName != null ? wagonName : prev ? prev.wagonName : '', hunting: hunting != null ? hunting : prev ? prev.opts && prev.opts.hunting : true,
    seed: seed != null ? seed : hashSeed(prev ? prev.seed : 0, 'season', t, journeyN) });
  if (prev) {
    J.cards = (prev.cards || []).slice(); J.deeds = (prev.deeds || []).slice(); J.tokens = prev.tokens | 0;
    J.upgrades = clone(prev.upgrades || {}); J.challenges = clone(prev.challenges || {});
    carry14(prev, J);                                                       // the dog (clean again) and v1.4's collections
    J.seasonsDone = (prev.seasonsDone | 0) + (prev.done ? 1 : 0);
  }
  if (route === 'gold-road' && farm) {
    const gift = farmGifts(farm, ((ROUTES[route] || {}).needs || {}).site || 'willamette');
    if (gift.foodLb > 0) { addFoodKind(J, 'other', gift.foodLb); J.farmGift = gift.foodLb; }
  }
  SIM.replanFirstLeg(J);                                                    // the first leg is planned again now that the dog and the switches are carried
  return J;
}

/** Close a finished journey at its trail's end, once (J.closed): bank it into the homestead there (founding the site if it is new), write the ledger (the journey, the
 *  route and branches travelled, the tier, the trophy, the lifetime totals) and turn the year (ledger.year += 1). → { site, banked, trophy, firstHere, newRoutes } (the
 *  app then asks for the farm's name when firstHere). A second call returns the first's. `at` is the time the app passes (the module reads no clock). */
export function closeJourney(J, ledger, farm, { at = 0 } = {}) {
  if (!J) return null;
  if (J.closed && J.closeResult) return J.closeResult;
  if (!J.done) return null;
  const before = routesOpen(ledger).filter((r) => r.open).map((r) => r.id);
  const site = endSiteOf(J);
  const tier = tierOf(J.season);
  const firstHere = !!site && !(farm.sites && farm.sites[site]);
  if (site) foundSite(farm, site, { year: J.year });
  const banked = site ? bankJourney(farm, J, site) : { savings: 0, flakes: 0, animals: 0 };
  const plate = (TIER_BY_ID[tier] || TIERS[0]).trophy;
  const routeKey = J.route === 'gold-road' ? 'gold-road' : site === 'sacramento' ? 'california' : 'oregon';
  const taken = J.planLocked ? {} : branchesTaken(J.route || 'emigrant', J.branches || {}, { year: J.year, journeyN: J.journeyN });
  const T = J.totals || {};
  if (!Array.isArray(ledger.journeys)) ledger.journeys = [];
  ledger.journeys.push({ id: `${J.season}-${J.seed}`, at, route: J.route || 'emigrant', branches: taken, tier, year: J.year, journeyN: J.journeyN | 0, end: site, stars: T.stars | 0, legs: T.legs | 0 });
  if (ledger.journeys.length > JOURNEYS_KEPT) ledger.journeys.splice(0, ledger.journeys.length - JOURNEYS_KEPT);
  ledger.routesDone = uniq(ledger.routesDone, [routeKey]);
  ledger.branchesDone = uniq(ledger.branchesDone, Object.entries(taken).map(([f, o]) => `${f}:${o}`));
  if (!isObj(ledger.tiersDone)) ledger.tiersDone = { rookie: 0, veteran: 0, pioneer: 0 };
  ledger.tiersDone[tier] = num(ledger.tiersDone[tier]) + 1;
  ledger.trophies = uniq(ledger.trophies, [`${plate}:${routeKey}`]);
  if (!isObj(ledger.lifetime)) ledger.lifetime = { legs: 0, miles: 0, flakes: 0, peopleMet: 0 };
  ledger.lifetime.legs = num(ledger.lifetime.legs) + (T.legs | 0);
  ledger.lifetime.miles = num(ledger.lifetime.miles) + (T.miles | 0);
  ledger.lifetime.flakes = num(ledger.lifetime.flakes) + (J.gold | 0);
  ledger.lifetime.peopleMet = num(ledger.lifetime.peopleMet) + (T.peopleMet | 0);
  ledger.year = Math.max(yearOf(ledger) + 1, yearOf(J) + 1);                                    // one year a journey (never earlier than the year after this journey's)
  const newRoutes = routesOpen(ledger).filter((r) => r.open && !before.includes(r.id)).map((r) => r.id);
  J.closed = true;
  J.closeResult = { site, banked, trophy: plate, firstHere, newRoutes };
  return J.closeResult;
}


/** The family-sync merge of the v1.5 fields of two `ww` docs (SPEC v1.5 §5.6): `s` is the later doc, `o` the other; returns a new doc (s with the merges applied). Every rule is a
 *  union or a max, so a doc written by an older build (which drops these fields) never erases them: ledger (mergeLedger) · farm (mergeFarm: the currencies are earned / spent
 *  counters merged by max) · setsDone union · cosmetics.owned.decor union · cosmetics.equipped.decor the later doc's (owned ones only, two) · seen.forks OR · journeyResetAt max ·
 *  journey: the later doc's journey, and on the same journey (season + seed) `gold` max and `branches` union (a fork chosen on either device is kept; the plan is rebuilt) · and
 *  v1.4's fields by merge14. The app's mergeWw calls this for everything v1.5 adds and keeps 1.3's rules for the rest. */
export function mergeWw15(s, o) {
  const a = isObj(s) ? s : {}, b = isObj(o) ? o : {};
  const out = clone(a);
  out.ledger = mergeLedger(a.ledger, b.ledger);
  out.farm = mergeFarm(a.farm, b.farm);
  out.setsDone = uniq(a.setsDone, b.setsDone);
  const ca = isObj(a.cosmetics) ? a.cosmetics : {}, cb = isObj(b.cosmetics) ? b.cosmetics : {};
  const owned = uniq((ca.owned || {}).decor, (cb.owned || {}).decor);
  out.cosmetics = { ...ca, owned: { ...(ca.owned || {}), decor: owned }, equipped: { ...(ca.equipped || {}), decor: uniq((ca.equipped || {}).decor).filter((id) => owned.includes(id)).slice(0, 2) } };
  out.seen = { ...(isObj(a.seen) ? a.seen : {}), forks: { ...((isObj(b.seen) && b.seen.forks) || {}), ...((isObj(a.seen) && a.seen.forks) || {}) } };
  out.journeyResetAt = Math.max(num(a.journeyResetAt), num(b.journeyResetAt));
  if (isObj(a.journey) && isObj(b.journey)) {
    const J = clone(a.journey);
    if (J.season === b.journey.season && String(J.seed) === String(b.journey.seed)) {
      J.gold = Math.max(num(J.gold), num(b.journey.gold));
      for (const [fork, opt] of Object.entries(isObj(b.journey.branches) ? b.journey.branches : {})) {
        if (!(isObj(J.branches) && fork in J.branches)) chooseBranch(J, fork, opt);        // refused when that fork is already passed or the option closed: then it stays as it was
      }
      usePlan(J);
    }
    out.journey = merge14(J, b.journey);
  } else if (!isObj(a.journey) && isObj(b.journey)) out.journey = clone(b.journey);
  return out;
}

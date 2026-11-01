// The trail the journey runs on (SPEC §3, §9; v1.5 §3.1): the legs, tiers, animals, goods and nations, read from src/content/*
// (the Content stream fills them; the shapes are fixed). Every journey module looks legs up through here.
//
// v1.5: a journey carries its own plan. `J.route` ('emigrant' | 'gold-road'), `J.branches` ({ [forkId]: optionId } chosen so far) and `J.plan`
// (the resolved steps, `[{ id, miles, from, to, n }]`, the defaults filled in past the next unchosen fork). The sim calls `usePlan(J)` at every
// entry point (inside `ensureJourney`), so the module table (`legList()` / `legAt(i)`) is the journey's plan. `useLegs(list)` stays for tools and
// tests: while a list is installed it wins over every journey's plan (a synthetic 12-leg trail), `useLegs(null)` puts the content back.
import { LEGS, ALL_LEGS, LEG_BY_ID, SEASONS, SEASON_BY_ID, ANIMALS, ANIMAL_BY_ID, GOODS, GOOD_BY_ID } from '../content/legs.js';
import { ROUTES, FORKS, LEGACY_PLAN_12, SITES } from '../content/routes.js';
import { TIERS, TIER_BY_ID } from '../content/tiers.js';
import { NATIONS, NATION_BY_ID } from '../content/nations.js';
import { TIER_FX } from './economy.js';

let table = LEGS;          // the legs in trail order (the default plan, a journey's plan, or a tool's list)
let forced = null;         // a tool's list (useLegs): wins over every plan
let installed = null;      // the plan array whose legs are in `table` (so usePlan does not rebuild it on every call)

/** Swap the leg table (tests and tools only); null or an empty list restores the content's LEGS (and the journey's plan again). */
export function useLegs(list) {
  if (Array.isArray(list) && list.length) { forced = list; table = list; } else { forced = null; table = LEGS; }
  installed = null;
  return table;
}
/** The legs in trail order. */
export const legList = () => table;
/** The list a tool installed with useLegs (or null): a journey made while one is installed is locked to it (no forks). */
export const toolLegs = () => forced;
/** The leg at an index (null past the end). */
export const legAt = (i) => table[i] || null;
/** The index of a leg id in the current table (-1 when unknown). */
export const legIndexOf = (id) => table.findIndex((l) => l.id === id);
/** A leg from an id or a leg object (null when unknown). Why: the API takes either, as the app holds both. The current table first (so a plan's
 *  miles win), then the content's pool of every route's legs. */
export function legOf(x) {
  if (!x) return null;
  if (typeof x === 'object') return x;
  return table.find((l) => l.id === x) || (LEG_BY_ID && LEG_BY_ID[x]) || LEGS.find((l) => l.id === x) || null;
}

// ---- tiers ----
const TIER_IDS = TIERS.map((t) => t.id);
/** The tier id ('rookie' | 'veteran' | 'pioneer') for a tier id, a legacy season id ('s1847', 's1850', 's1853'), a season or tier object; Rookie when unknown. */
export function tierOf(x) {
  const id = x && typeof x === 'object' ? x.tier || x.id : x;
  if (TIER_BY_ID[id]) return id;
  const byLegacy = TIERS.find((t) => t.legacy === id);
  if (byLegacy) return byLegacy.id;
  const i = SEASONS.findIndex((s) => s.id === id);
  return i >= 0 && TIERS[i] ? TIERS[i].id : TIERS[0].id;
}
const tierViews = {};
/** A season (tier) from a tier id, a legacy season id or an object: the tier's words (TIERS) with its numbers (TIER_FX): { id, tier, name, emoji,
 *  legacy, priceMult, numberMult, … }. Rookie when unknown (a save from an older build stays playable); a season object that already has `priceMult` is returned as given. */
export function seasonOf(x) {
  if (x && typeof x === 'object' && Number.isFinite(x.priceMult)) return x;
  const id = tierOf(x);
  if (!tierViews[id] || tierViews[id].priceMult !== TIER_FX[id].priceMult) {
    tierViews[id] = { ...TIER_BY_ID[id], id, tier: id, priceMult: TIER_FX[id].priceMult, numberMult: TIER_FX[id].numberMult };
  }
  return tierViews[id];
}
/** The tier after this one (the last tier repeats). Accepts and returns tier ids. */
export function nextSeasonId(id) {
  const i = TIER_IDS.indexOf(tierOf(id));
  return TIER_IDS[Math.min(TIER_IDS.length - 1, i + 1)];
}
/** An animal from an id or an object; oxen when unknown. */
export function animalOf(x) {
  if (x && typeof x === 'object') return x;
  return ANIMAL_BY_ID[x] || ANIMALS[0];
}
/** A store good from an id or an object (null when unknown). */
export function goodOf(x) {
  if (x && typeof x === 'object') return x;
  return GOOD_BY_ID[x] || null;
}
/** The nation whose trading post is on this leg: the leg's `nation`, else a nation that lists the leg; null when the
 *  leg has none (then no trading-post event is planned there). */
export function nationFor(leg) {
  const l = legOf(leg);
  if (!l) return null;
  return (l.nation && NATION_BY_ID[l.nation]) || NATIONS.find((n) => Array.isArray(n.legs) && n.legs.includes(l.id)) || null;
}

// ---- plans and forks (SPEC v1.5 §3.1) ----
const POOL = () => ALL_LEGS || LEGS;
const poolLeg = (id) => (LEG_BY_ID && LEG_BY_ID[id]) || POOL().find((l) => l.id === id) || null;
/** A steps list in any of the shapes: 'id', { leg, miles?, from?, to? }, { id, miles?, … } or { fork }. */
const stepOf = (s) => (typeof s === 'string' ? { id: s } : s && s.fork ? { fork: s.fork } : s && (s.leg || s.id) ? { id: s.leg || s.id, miles: s.miles, from: s.from, to: s.to } : null);

const openCtx = (ctx) => ({ year: Number.isFinite(ctx && ctx.year) ? ctx.year : 1847, journeyN: Number.isFinite(ctx && ctx.journeyN) ? ctx.journeyN : 1 });
/** Is a fork on offer in this journey (its `fromJourney`)? */
export const forkOpen = (fork, ctx) => openCtx(ctx).journeyN >= (fork.fromJourney || 1);
/** Is an option open in this year (its `fromYear`)? */
export const optionOpen = (opt, ctx) => openCtx(ctx).year >= (opt.fromYear || 0);
/** Why an option is closed ("The Lander Road opens in 1858."), '' when it is open. */
export const optionWhy = (opt, ctx) => (optionOpen(opt, ctx) ? '' : `${opt.name} opens in ${opt.fromYear}.`);

/** The option a plan takes at a fork: the chosen one when it is open, else the first open one (the default). `force` (internal) skips the opening checks. */
function optionFor(fork, branches, ctx, force) {
  if (force && force[fork.id]) { const o = fork.options.find((x) => x.id === force[fork.id]); if (o) return o; }
  const open = fork.options.filter((o) => optionOpen(o, ctx));
  if (!open.length) return fork.options[0];
  if (!forkOpen(fork, ctx)) return open[0];
  const want = branches && branches[fork.id];
  return open.find((o) => o.id === want) || open[0];
}

/** Walk a route's steps with the branches taken: calls `leg(step)` for every leg and `fork(forkDef, option)` for every fork met. */
function walkRoute(routeId, branches, ctx, force, onLeg, onFork) {
  const route = ROUTES[routeId] || ROUTES.emigrant;
  const walk = (steps) => {
    for (const raw of steps) {
      const s = stepOf(raw);
      if (!s) continue;
      if (s.fork) {
        const f = FORKS[s.fork];
        if (!f) continue;
        const opt = optionFor(f, branches, ctx, force);
        if (onFork) onFork(f, opt);
        if (opt) walk(opt.steps);
      } else onLeg(s);
    }
  };
  walk(route.steps);
}
const finish = (steps) => steps.map((s, i) => {
  const leg = poolLeg(s.id) || {};
  return { id: s.id, miles: Number.isFinite(s.miles) ? s.miles : leg.miles, from: s.from || leg.from, to: s.to || leg.to, n: i + 1 };
});

/** The plan of a route: flattens ROUTES[routeId].steps; at each { fork } takes branches[fork] if it is open, else the first open option; applies
 *  { leg, miles, from } overrides; numbers n from 1; options not open in that year / journey are skipped. → [{ id, miles, from, to, n }]. */
export function planRoute(routeId, branches = {}, ctx = {}) {
  const steps = [];
  walkRoute(routeId, branches || {}, openCtx(ctx), ctx && ctx.force, (s) => steps.push(s), null);
  return finish(steps);
}
/** The forks a plan meets and the option taken at each: { [forkId]: optionId } (defaults included). Why: the ledger's branchesDone and the title map. */
export function branchesTaken(routeId, branches = {}, ctx = {}) {
  const out = {};
  walkRoute(routeId, branches || {}, openCtx(ctx), ctx && ctx.force, () => {}, (f, o) => { if (o) out[f.id] = o.id; });
  return out;
}
const legacyPlan = () => finish((LEGACY_PLAN_12 || []).map(stepOf).filter(Boolean));

/** The twelve legs of 1.3 as leg objects (LEGACY_PLAN_12: the 1.3 miles on today's legs); what a 1.3 journey in progress runs on, and what the 1.3 tests run on. */
export const legacyTrail = () => resolvePlan(legacyPlan());

/** A plan's legs as leg objects (the content's leg with the plan's miles / from / to / n). */
function resolvePlan(plan) {
  return plan.map((p) => {
    const base = poolLeg(p.id) || (forced && forced.find((l) => l.id === p.id)) || { id: p.id, name: p.id, stop: { kind: 'landmark', name: p.id }, biome: 'prairie' };
    return { ...base, miles: Number.isFinite(p.miles) ? p.miles : base.miles, from: p.from || base.from, to: p.to || base.to, n: p.n || base.n };
  });
}
/** Is this journey a 1.3 / 1.4 journey in progress (no plan yet, past its first day)? It ends as it began, on the twelve legs of 1.3. */
export const isLegacyJourney = (J) => !!J && !Array.isArray(J.plan) && ((J.legIndex | 0) > 0 || (J.milesDone | 0) > 0 || (J.day | 0) > 0);
/** The journey's plan steps: its own, else the legacy twelve (a 1.3 journey in progress), else the default emigrant plan. */
export function planOf(J) {
  if (J && Array.isArray(J.plan) && J.plan.length) return J.plan;
  if (isLegacyJourney(J)) return legacyPlan();
  return planRoute((J && J.route) || 'emigrant', (J && J.branches) || {}, { year: J && J.year, journeyN: J && J.journeyN });
}
/** Install the journey's plan as the module table (the sim calls this at every entry point) and return the legs. A tool's `useLegs` list wins; a missing
 *  plan is LEGACY_PLAN_12 for a 1.3 journey with legIndex > 0, else the default emigrant plan. */
export function usePlan(J) {
  if (forced || !J) return table;
  const plan = planOf(J);
  if (installed !== plan) { table = resolvePlan(plan); installed = plan; }
  return table;
}

/** Which site a leg ends the trail at ('willamette' | 'sacramento'), else null. */
export function siteOfLeg(legId) {
  const id = legId && typeof legId === 'object' ? legId.id : legId;
  const s = (SITES || []).find((x) => x.ends.includes(id));
  return s ? s.id : null;
}
/** The trail miles of a plan (a voyage leg's sea miles are not trail miles). `plan` is a list of steps or legs. */
export function planMiles(plan) {
  return (plan || []).reduce((a, p) => { const l = legOf(p.id) || p; return a + (l && l.voyage ? 0 : Number(p.miles ?? l.miles) || 0); }, 0);
}
/** The ids of the legs in a plan that have a store (the forts). */
export function planStores(plan) {
  return (plan || []).filter((p) => { const l = legOf(p.id) || p; return l && l.stop && l.stop.kind === 'fort'; }).map((p) => p.id);
}

/** The forks the journey's plan meets: [{ fork, option }]. */
function forksMet(J) {
  const out = [];
  walkRoute(J.route || 'emigrant', J.branches || {}, { year: J.year, journeyN: J.journeyN }, null, () => {}, (f, o) => out.push({ fork: f, option: o }));
  return out;
}
/** The fork on offer now, else null: offered when the party has arrived at fork.at, the fork is open for this journey (`fromJourney`) and not yet in J.branches;
 *  { id, at, explainer, lean, options: [{ id, name, line, extra, open, why, legs, miles, stores }] } (`legs` / `miles` / `stores`: the rest of the trail by that
 *  option; `extra` is the 1849 line for California). A fork with one open option is never offered (the default is taken silently), nor on a journey that
 *  ends as it began (a 1.3 journey in progress). */
export function forkAt(J) {
  if (!J || J.planLocked || !J.trip || !J.trip.arrived) return null;
  const ctx = { year: J.year, journeyN: J.journeyN };
  const plan = planOf(J);
  const idx = plan.findIndex((p) => p.id === J.legId);
  for (const { fork } of forksMet(J)) {
    if (fork.at !== J.legId || (J.branches && J.branches[fork.id]) || !forkOpen(fork, ctx)) continue;
    const open = fork.options.filter((o) => optionOpen(o, ctx));
    if (open.length < 2) continue;
    const options = fork.options.map((o) => {
      const p = planRoute(J.route || 'emigrant', J.branches || {}, { ...ctx, force: { [fork.id]: o.id } }).slice(idx + 1);
      const extra = o.lineFrom1849 && (J.year | 0) >= 1849 ? o.lineFrom1849 : null;
      return { id: o.id, name: o.name, line: o.line, extra, open: optionOpen(o, ctx), why: optionWhy(o, ctx), legs: p.length, miles: planMiles(p), stores: planStores(p).length };
    });
    return { id: fork.id, at: fork.at, explainer: fork.explainer, lean: (J.journeyN | 0) <= 1 ? fork.lean || null : null, options };
  }
  return null;
}

/** Choose an option at a fork: records J.branches[forkId] and replans the rest after the current leg. → { ok, plan }. Refused (ok false) for an unknown or closed
 *  option, a fork the plan does not meet or has already passed, or a journey that ends as it began; idempotent. */
export function chooseBranch(J, forkId, optionId) {
  const refuse = () => ({ ok: false, plan: J ? J.plan : null });
  if (!J || J.planLocked) return refuse();
  const f = FORKS[forkId], opt = f && f.options.find((o) => o.id === optionId);
  const ctx = { year: J.year, journeyN: J.journeyN };
  if (!f || !opt || !optionOpen(opt, ctx) || !forkOpen(f, ctx)) return refuse();
  if (!forksMet(J).some((m) => m.fork.id === forkId)) return refuse();
  const old = planOf(J);
  const at = old.findIndex((p) => p.id === f.at);
  if (at >= 0 && at < (J.legIndex | 0)) return refuse();                    // already passed
  if (J.branches && J.branches[forkId] === optionId && Array.isArray(J.plan)) return { ok: true, plan: J.plan };
  const branches = { ...(J.branches || {}), [forkId]: optionId };
  const next = planRoute(J.route || 'emigrant', branches, ctx);
  const keep = (J.legIndex | 0) + 1;                                          // the current leg and the ones before it stay as they are
  if (next.slice(0, keep).some((p, i) => !old[i] || old[i].id !== p.id)) return refuse();
  J.branches = branches;
  J.plan = [...old.slice(0, keep), ...next.slice(keep)].map((p, i) => ({ ...p, n: i + 1 }));
  if (J.trip) { J.trip.forkKey = forkKey(forkId, optionId); if (J.trip.result) J.trip.result.fork = null; }
  usePlan(J);
  return { ok: true, plan: J.plan };
}
/** The letter key a chosen option adds ('fork-oregon', 'fork-california', 'sublette', 'lander', 'barlow'), else null (the default ways need no line). */
export function forkKey(forkId, optionId) {
  if (forkId === 'fort-hall') return `fork-${optionId}`;
  return ['sublette', 'lander', 'barlow'].includes(optionId) ? optionId : null;
}

/** Which routes are open for a ledger: 'emigrant' always; 'gold-road' once the ledger has an arrival at 'willamette' (and from its year).
 *  → [{ id, open, why }]. */
export function routesOpen(ledger) {
  const year = ledger && Number.isFinite(ledger.year) ? ledger.year : 1847;
  return Object.values(ROUTES).map((r) => {
    if (!r.needs && !(r.fromYear > year)) return { id: r.id, open: true, why: '' };
    const need = r.needs && r.needs.site;
    const has = !need || !!(ledger && Array.isArray(ledger.journeys) && ledger.journeys.some((j) => j && j.end === need));
    if (!has) return { id: r.id, open: false, why: 'Reach the Willamette Valley to hear the news' };
    if (r.fromYear > year) return { id: r.id, open: false, why: `${r.name} starts in ${r.fromYear}.` };
    return { id: r.id, open: true, why: '' };
  });
}
/** The route a leg belongs to ('gold-road' for its legs, else 'emigrant'). */
export function routeOfLeg(legId) {
  const g = ROUTES['gold-road'];
  return g && g.steps.some((s) => (stepOf(s) || {}).id === legId) ? 'gold-road' : 'emigrant';
}
/** A route's start: { id, name, store: { name, prices }, lookout, map }. */
export const routeStart = (routeId) => (ROUTES[routeId] || ROUTES.emigrant).start;

// A plausible 12-leg trail for the tests and the economy sim while src/content/legs.js is a skeleton: the content's
// legs where they exist, then the rest of the route of SPEC §3 (stops, biomes and fort price levels as the Content
// stream is likely to write them, 150-200 miles each). The long trail's other routes are the tools' fixtures (tools/fixtures/long-trail.mjs).
const SYNTH = [
  ['kansas-river', 'Kansas River', 150, 'prairie', 'river', { river: { width: 'wide' }, nation: 'kansa' }],
  ['fort-kearny', 'Fort Kearny', 170, 'prairie', 'fort', { fort: { prices: 1.2 }, nation: 'pawnee' }],
  ['chimney-rock', 'Chimney Rock', 160, 'bluffs', 'landmark', {}],
  ['fort-laramie', 'Fort Laramie', 180, 'bluffs', 'fort', { fort: { prices: 1.4 }, nation: 'lakota' }],
  ['independence-rock', 'Independence Rock', 190, 'highdesert', 'landmark', {}],
  ['south-pass', 'South Pass', 170, 'mountains', 'landmark', {}],
  ['fort-bridger', 'Fort Bridger', 180, 'mountains', 'fort', { fort: { prices: 1.6 }, nation: 'shoshone' }],
  ['soda-springs', 'Soda Springs', 160, 'highdesert', 'landmark', {}],
  ['fort-hall', 'Fort Hall', 150, 'highdesert', 'fort', { fort: { prices: 1.8 }, nation: 'bannock' }],
  ['snake-river', 'Snake River', 200, 'highdesert', 'river', { river: { width: 'wide' } }],
  ['the-dalles', 'The Dalles', 190, 'gorge', 'river', { river: { width: 'narrow' }, nation: 'chinook' }],
  ['willamette-valley', 'Willamette Valley', 170, 'valley', 'home', {}],
];
/** A 12-leg trail (or n legs, repeating the pattern): the content's real legs first, synthetic ones after. */
export function syntheticTrail(n = 12) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const real = LEGS[i];
    if (real && i < SYNTH.length) { out.push(real); continue; }
    const [id, name, miles, biome, kind, extra] = SYNTH[i % SYNTH.length];
    const sid = i < SYNTH.length ? id : `${id}-${i}`;
    out.push({ id: sid, n: i + 1, name, from: i ? out[i - 1].name : 'Independence', to: name, miles, biome,
      stop: { kind, name }, ...extra, lookout: sid, sticker: { id: sid, name, emoji: '⭐' } });
  }
  return out;
}

export { LEGS, ALL_LEGS, LEG_BY_ID, SEASONS, ANIMALS, GOODS, NATIONS, ROUTES, FORKS, SITES, TIERS };

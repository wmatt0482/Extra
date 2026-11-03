// The six choice moments (The Lab, lab/SPEC.md §4.4; src/content/choices.js has the words): at six stops, two on each route, the child picks how to go on. PURE: no DOM, no
// clock, no storage, no Math.random (a seeded draw: the journey's seed and the stop).
//
//   a  the plain way (stay on the road, go on your own): nothing changes.
//   b  a SHORTCUT (the creek bottom, the river's bends, the gravel bar): the leg that follows is 15 miles shorter (its pay and its markers are not: a leg pays and teaches as
//      the full leg), and one time in four a sack of flour gets soaked (the draw is seeded by the journey and the stop, so reloading changes nothing; the loss is a rivers' soak:
//      up to 50 lb, never more than half the flour in the wagon).
//      or a GUIDE (or a packer): pay the fee, the leg that follows is a day shorter (a day's miles at the pace the animals walk), the party's spirit is lifted, and a dry leg
//      (the Forty-Mile Desert) is crossed without thirst, as with the water barrel.
//   A saved day is a day: a short leg is held to its markers (one a day, 4-6 a leg, the learning spine), so fewer miles alone may not shorten it. The journey counts what the
//   shorter leg really saves and, when that is less than a day, the party arrives a day early all the same: the arrival day's food is not eaten (J.trip.dayCredit; sim.js tickDay).
//
// Fair by construction (the economy sim's `choices` cell measures it): a day of food for four at full rations is 12 lb, and one time in four a 50 lb sack is 12.5 lb; the
// guide's fee is the sim's to set (GUIDE.fee, in 1847 dollars, scaled by the price level like every price) so a Rookie's mean end cash differs by at most $3 between always-a
// and always-b. Both ways arrive. `choice` pays Lab XP only and is reported by the app; nothing here touches the Lab, the tokens or any economy constant.
//
// State: J.choices = { [choiceId]: { opt: 'a' | 'b', at: legId, leg: nextLegId, cut: miles, soakedLb, fee, guided, spirit } }, resolved once, merged as a union by id (meta/sync.js).
import { CHOICES, CHOICE_BY_ID } from '../content/choices.js';
import { PERSON_BY_ID } from '../content/people.js';
import { planOf, legOf, seasonOf, usePlan } from './route.js';
import { ANIMAL_RULES, MARKERS, MOOD, UPGRADE_FX, milesPerDay } from './economy.js';
import { takeFlour } from './supplies.js';
import { hashSeed, mulberry32 } from './rng.js';

/** The numbers. `fee` is a guide's fee in 1847 dollars (× the price level). */
export const SHORTCUT = Object.freeze({ miles: 15, soakChance: 0.25, soakLb: 50 });
export const GUIDE = Object.freeze({ fee: 2, spirit: 10 });
/** The fewest miles a shortened leg keeps (every leg still has its markers and its day). */
export const MIN_LEG_MILES = 30;

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
/** The days a leg of `miles` takes at a day's miles: a marker a day (the markers' number follows the miles) and the arrival, or the miles at the pace, whichever is more. */
const legDays = (miles, perDay) => Math.max(clamp(Math.floor((miles - 1) / MARKERS.spacing), MARKERS.min, MARKERS.max) + 1, Math.ceil(miles / perDay));

/** The fee of a guide in this journey's dollars. */
export const feeFor = (J) => Math.max(1, Math.round(GUIDE.fee * seasonOf(J && (J.tier || J.season)).priceMult));
/** The miles one day of travel covers for this wagon (steady pace: the animals, the iron tires and the second yoke). */
export function dayMiles(J) {
  const bonus = (J && J.upgrades && J.upgrades.tires ? UPGRADE_FX.tiresMiles : 0) + (J && J.animals && J.animals.n >= 4 ? ANIMAL_RULES.yokeMiles : 0);
  return milesPerDay('steady', J && J.animal, bonus);
}

/** The choices asked at a stop of a plan: the definitions whose stop is `legId` and that have a leg after it in the plan. `plan` is a journey's plan (J.plan: [{ id, … }]) or a
 *  list of leg ids. [] for anything else. */
export function choicesAt(plan, legId) {
  const ids = (Array.isArray(plan) ? plan : []).map((p) => (typeof p === 'string' ? p : p && p.id));
  const i = ids.indexOf(legId);
  if (i < 0 || i >= ids.length - 1) return [];
  return CHOICES.filter((c) => c.at === legId);
}

/** The leg that follows a stop in a journey's plan (an id), or null. */
export function nextIdOf(J, legId) {
  const plan = planOf(J);
  const i = plan.findIndex((p) => p.id === legId);
  return i >= 0 && plan[i + 1] ? plan[i + 1].id : null;
}

/** The choice waiting at the stop the party has arrived at, else null: { id, at, kind, who, question, options: [{ id, name, line, fee?, open, why }], fee, leg } where `leg` is the leg
 *  that follows. A journey that ends as it began (a 1.3 / 1.4 journey in progress, or a tool's leg list) never asks. */
export function choiceAt(J) {
  if (!J || J.planLocked || J.done || !J.trip || !J.trip.arrived) return null;
  const done = isObj(J.choices) ? J.choices : {};
  const def = choicesAt(planOf(J), J.legId).find((c) => !done[c.id]);
  if (!def) return null;
  const next = nextIdOf(J, J.legId);
  const fee = def.kind === 'guide' ? feeFor(J) : 0;
  const who = PERSON_BY_ID[def.who] || { id: def.who, name: 'A traveler', emoji: '🧑', role: '' };
  return {
    id: def.id, at: def.at, kind: def.kind, who: { id: who.id, name: who.name, emoji: who.emoji, role: who.role }, question: def.question, leg: next, fee,
    options: def.options.map((o) => {
      const poor = o.id === 'b' && def.kind === 'guide' && (J.cash | 0) < fee;
      return { id: o.id, name: o.name, line: o.line, ...(o.id === 'b' && fee ? { fee } : {}), open: !poor, why: poor ? 'cash' : '' };
    }),
  };
}

/** Take a way at a choice: 'a' or 'b'. `rand` (optional) is the draw for a shortcut's soak (default: seeded by the journey and the stop). Idempotent (a choice is resolved once; the
 *  stored result is returned with `repeated`). Refused (ok false, `why`) for an unknown choice or way, a party that is not at the choice's stop, or a guide the cash box cannot pay for.
 *  → { ok, option, kind, cut, soakedLb, soaked, fee, spirit, guided, leg }. */
export function applyChoice(J, id, option, rand) {
  const def = CHOICE_BY_ID[id];
  if (!J || !def || (option !== 'a' && option !== 'b')) return { ok: false, why: 'unknown' };
  if (!isObj(J.choices)) J.choices = {};
  const had = J.choices[id];
  if (had) return { ok: true, repeated: true, option: had.opt, kind: def.kind, cut: had.cut | 0, credit: had.credit | 0, soakedLb: had.soakedLb | 0, soaked: (had.soakedLb | 0) > 0, fee: had.fee | 0, spirit: had.spirit | 0, guided: !!had.guided, leg: had.leg };
  if (J.planLocked || !J.trip || !J.trip.arrived || J.legId !== def.at || !choicesAt(planOf(J), def.at).some((c) => c.id === id)) return { ok: false, why: 'notHere' };
  const next = nextIdOf(J, def.at);
  const rec = { opt: option, at: def.at, leg: next, cut: 0, credit: 0, soakedLb: 0, fee: 0, guided: false, spirit: 0 };
  if (option === 'b') {
    const leg = legOf(next) || {};
    const want = def.kind === 'shortcut' ? SHORTCUT.miles : dayMiles(J);
    rec.cut = clamp(Math.min(want, (leg.miles | 0) - MIN_LEG_MILES), 0, want);
    if (def.kind === 'shortcut') {
      const draw = typeof rand === 'function' ? rand : mulberry32(hashSeed(J.seed, id, J.legStarts | 0, 'choice'));
      if (draw() < SHORTCUT.soakChance) rec.soakedLb = takeFlour(J, Math.min(SHORTCUT.soakLb, Math.floor((J.foods ? J.foods.flour : 0) / 2)));
    } else {
      const fee = feeFor(J);
      if ((J.cash | 0) < fee) return { ok: false, why: 'cash', fee };
      J.cash -= fee; rec.fee = fee;
      J.spirit = clamp((J.spirit | 0) + GUIDE.spirit, 0, MOOD.max); rec.spirit = GUIDE.spirit;
      rec.guided = true;
    }
    if (rec.cut > 0 && next) {
      const mpd = dayMiles(J), full = (legOf(next) || {}).miles | 0;
      rec.credit = legDays(full, mpd) - legDays(full - rec.cut, mpd) >= 1 ? 0 : 1;         // the day the shorter leg does not save by itself is saved on the arrival (see the header)
      J.plan = planOf(J).map((p) => (p.id === next ? { ...p, miles: (p.miles | 0) - rec.cut } : p));        // a new array: route.js rebuilds the leg table from it
      usePlan(J);
    }
  }
  J.choices[id] = rec;
  if (J.totals) J.totals.choicesTaken = (J.totals.choicesTaken | 0) + 1;
  return { ok: true, option, kind: def.kind, cut: rec.cut, credit: rec.credit, soakedLb: rec.soakedLb, soaked: rec.soakedLb > 0, fee: rec.fee, spirit: rec.spirit, guided: rec.guided, leg: next };
}

/** Moving on without choosing takes the plain way, once (nextLeg calls it, as it does for a fork). */
export function defaultChoice(J) {
  const c = choiceAt(J);
  return c ? applyChoice(J, c.id, 'a') : null;
}

/** Miles a leg was shortened by a choice taken before it (its pay and its markers are the full leg's). */
export function cutOf(J, legId) {
  let n = 0;
  if (J && isObj(J.choices)) for (const r of Object.values(J.choices)) if (isObj(r) && r.leg === legId && r.opt === 'b') n += r.cut | 0;
  return n;
}
/** Days of food the party does not eat on this leg's arrival day (0 or 1), because a choice taken before it saved a day the shorter leg does not save by itself. */
export function creditOf(J, legId) {
  let n = 0;
  if (J && isObj(J.choices)) for (const r of Object.values(J.choices)) if (isObj(r) && r.leg === legId && r.opt === 'b') n += r.credit | 0;
  return Math.min(1, n);
}
/** Is this leg crossed with a guide (a dry stretch with a guide is not a thirsty one)? */
export function guidedOf(J, legId) {
  if (J && isObj(J.choices)) for (const r of Object.values(J.choices)) if (isObj(r) && r.leg === legId && r.opt === 'b' && r.guided) return true;
  return false;
}

/** J.choices from anything (a save, a merge): only well-formed records, only known choices. */
export function normalizeChoices(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const [id, r] of Object.entries(raw)) {
    if (!CHOICE_BY_ID[id] || !isObj(r) || (r.opt !== 'a' && r.opt !== 'b')) continue;
    out[id] = { opt: r.opt, at: String(r.at || CHOICE_BY_ID[id].at), leg: r.leg == null ? null : String(r.leg), cut: Math.max(0, r.cut | 0), credit: r.credit ? 1 : 0, soakedLb: Math.max(0, r.soakedLb | 0), fee: Math.max(0, r.fee | 0), guided: !!r.guided, spirit: Math.max(0, r.spirit | 0) };
  }
  return out;
}
/** The family-sync merge of two journeys' choices: a union by id (the record the later doc has wins a clash; a choice is resolved once). */
export function mergeChoices(s, o) {
  const a = normalizeChoices(s), b = normalizeChoices(o);
  return { ...b, ...a };
}

// Supplies that do things (SPEC v1.2 §1): the wagon's food by kind, arrows, blankets. Pure helpers over the journey object J
// that sim.js builds on; none of them calls the clock or Math.random.
//
// Food: J.foods = { flour, bacon, beans, other } in whole pounds and J.food = their sum, a plain number kept in step by
// syncFood(J) after every change (never a getter: the save is plain JSON). `other` is whatever did not come from the store
// (game, fish, plums, a trade's corn): it is eaten first. A day then eats 50 / 30 / 20 % from flour / bacon / beans, and
// when one of those is gone the rest of the day comes from whatever is left. A small ledger (J.foodOwed) carries the
// fractions of a pound from day to day so the long-run ratio is exact while every day eats a whole number of pounds.
import { FOOD_KINDS, EAT_RATIO, ARROWS, COLD_LEGS, COLD, COOK, foodNeeded } from './economy.js';
import { animalOf, legList } from './route.js';
import { skillOf } from './skills.js';

const EAT = ['flour', 'bacon', 'beans'];
const sumKinds = (f) => FOOD_KINDS.reduce((a, k) => a + (f[k] | 0), 0);

/** Split a whole number into whole parts in proportion to weights (largest remainder; all-zero weights: all in the first). */
export function splitInt(total, weights) {
  const n = weights.length, t = Math.max(0, Math.round(total));
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) { const out = new Array(n).fill(0); out[0] = t; return out; }
  const exact = weights.map((w) => (t * w) / sum);
  const out = exact.map(Math.floor);
  let rem = t - out.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => [e - Math.floor(e), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let i = 0; rem > 0; i = (i + 1) % n, rem--) out[order[i][1]]++;
  return out;
}

/** Make J.foods / J.food consistent. A save from before v1.2 has only J.food: it splits 50 / 30 / 20 into flour / bacon /
 *  beans. When some caller changed J.food directly (older code and tests do), that number wins: more food goes in `other`,
 *  less food shrinks every kind in proportion. Safe to call any time; the sim calls it at the top of every entry point. */
export function ensureFoods(J) {
  const hasFood = Number.isFinite(J.food);
  if (!J.foods || typeof J.foods !== 'object') {
    const total = hasFood ? Math.max(0, Math.round(J.food)) : 0;
    const [fl, ba, be] = splitInt(total, [5, 3, 2]);
    J.foods = { flour: fl, bacon: ba, beans: be, other: 0 };
  } else {
    for (const k of FOOD_KINDS) J.foods[k] = Number.isFinite(J.foods[k]) && J.foods[k] > 0 ? Math.round(J.foods[k]) : 0;
    const sum = sumKinds(J.foods);
    if (hasFood && Math.round(J.food) !== sum) {
      const total = Math.max(0, Math.round(J.food));
      if (total > sum) J.foods.other += total - sum;
      else { const parts = splitInt(total, FOOD_KINDS.map((k) => J.foods[k])); FOOD_KINDS.forEach((k, i) => { J.foods[k] = parts[i]; }); }
    }
  }
  if (!J.foodOwed || typeof J.foodOwed !== 'object') J.foodOwed = { flour: 0, bacon: 0, beans: 0 };
  for (const k of EAT) if (!Number.isFinite(J.foodOwed[k])) J.foodOwed[k] = 0;
  if (!Number.isFinite(J.foodSave)) J.foodSave = 0;
  return syncFood(J);
}

/** J.food = the sum of the four kinds. Call it after any change to J.foods. Returns the total. */
export function syncFood(J) {
  J.food = sumKinds(J.foods);
  return J.food;
}

/** Add pounds of one kind ('flour' | 'bacon' | 'beans' | 'other'; anything else is `other`) and keep J.food in step. */
export function addFoodKind(J, kind, lb) {
  const k = FOOD_KINDS.includes(kind) ? kind : 'other';
  const n = Math.max(0, Math.round(Number(lb) || 0));
  J.foods[k] += n;
  syncFood(J);
  return n;
}

/** Take away pounds of flour (soaked sacks), never below 0. Returns what was taken. */
export function takeFlour(J, lb) {
  const n = Math.min(J.foods.flour, Math.max(0, Math.round(lb)));
  J.foods.flour -= n;
  syncFood(J);
  return n;
}

/** The pounds the party (and its animals' feed) needs for a day at the current rations: whole pounds, before Rosa. */
export function dailyNeed(J) {
  return foodNeeded(1 + (J.party ? J.party.length : 0), J.rations, 1, animalOf(J.animal).feedLb || 0);
}
/** Rosa's share of a day's food (1, or COOK.foodFactor with the cook in the party). */
export const eatFactor = (J) => (skillOf(J, 'good-cooking') ? COOK.foodFactor : 1);

/** Eat one day: `need` whole pounds (times `factor`: the cook's 0.9, carried as a fraction in J.foodSave so the saving is
 *  exact over days), `other` first, then 50 / 30 / 20 % from flour / bacon / beans, then whatever is left; never more
 *  than the wagon holds. Returns { eaten, saved }: the pounds eaten and the pounds the skill saved. */
export function eatFood(J, need, factor = 1) {
  const base = Math.max(0, Math.round(need));
  let want = base;
  if (factor < 1 && base > 0) {
    const exact = base * factor + (J.foodSave || 0);
    want = Math.floor(exact + 1e-9);
    J.foodSave = exact - want;
  }
  want = Math.min(want, J.food);
  let left = want;
  const fromOther = Math.min(J.foods.other, left);
  J.foods.other -= fromOther; left -= fromOther;
  if (left > 0) {
    const exact = EAT.map((k) => J.foodOwed[k] + left * EAT_RATIO[k]);
    const take = exact.map((e) => Math.max(0, Math.floor(e)));
    const order = exact.map((e, i) => [e - Math.floor(e), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    let rem = left - take.reduce((a, b) => a + b, 0);
    for (let i = 0; rem > 0; i = (i + 1) % 3, rem--) take[order[i][1]]++;
    for (let i = 2, guard = 0; rem < 0 && guard < 9; i = (i + 2) % 3, guard++) if (take[order[i][1]] > 0) { take[order[i][1]]--; rem++; }
    EAT.forEach((k, i) => { J.foodOwed[k] = Math.max(-1, Math.min(1, exact[i] - take[i])); });
    let short = 0;
    EAT.forEach((k, i) => { if (take[i] > J.foods[k]) { short += take[i] - J.foods[k]; take[i] = J.foods[k]; } });
    EAT.forEach((k, i) => { J.foods[k] -= take[i]; });
    while (short > 0) {                                   // a kind ran out: the rest of the day comes from the fullest sack
      const k = EAT.slice().sort((a, b) => J.foods[b] - J.foods[a])[0];
      const n = Math.min(short, J.foods[k]);
      if (n <= 0) break;
      J.foods[k] -= n; short -= n;
    }
  }
  syncFood(J);
  return { eaten: want, saved: base - want };
}

/** Days of food left at the current rations (whole days, the cook's saving counted): "food for six days". */
export function foodDays(J) {
  if (!J || !(J.food > 0)) return 0;
  const per = Math.max(1, dailyNeed(J)) * eatFactor(J);
  return Math.floor(J.food / per + 1e-9);
}

// ---- arrows ----
/** Can the party hunt? It takes five arrows (ARROWS.perHunt). With fewer, the camp offers fishing only. */
export const huntAllowed = (J) => !!J && !!J.goods && (J.goods.arrows | 0) >= ARROWS.perHunt;

// ---- blankets ----
/** Does this leg (the current one, or `legId`) have cold nights? The south-pass and blue-mountains legs always do; a 'snow'
 *  event makes the current leg cold. */
export function isColdLeg(J, legId) {
  const id = legId || (J && J.legId);
  if (COLD_LEGS.includes(id)) return true;
  return !legId && !!(J && J.trip && J.trip.snow);
}
/** Blankets for a cold leg: { need, have, short, cold, why } with need = one for every two people (rounded up) on a cold
 *  leg and 0 elsewhere, why = 'leg' | 'snow' | null. */
export function needsBlankets(J, legId) {
  const people = 1 + (J && J.party ? J.party.length : 0);
  const coldLeg = COLD_LEGS.includes(legId || (J && J.legId));
  const snow = !legId && !!(J && J.trip && J.trip.snow);
  const cold = coldLeg || snow;
  const need = cold ? Math.ceil(people / COLD.perBlanket) : 0;
  const have = (J && J.goods && J.goods.blankets) | 0;
  return { need, have, short: Math.max(0, need - have), cold, why: coldLeg ? 'leg' : snow ? 'snow' : null };
}
/** The cold legs still ahead of the party (ids, in trail order; the current leg counts until it is finished): the store
 *  says "you'll want two blankets for South Pass". */
export function coldLegsAhead(J) {
  const legs = legList();
  const from = J && J.trip && J.trip.arrived ? (J.legIndex | 0) + 1 : (J && J.legIndex) | 0;
  return legs.slice(from).filter((l) => COLD_LEGS.includes(l.id)).map((l) => l.id);
}

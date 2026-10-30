// The journey's numbers (SPEC §5, §10): food, speed, mood, prices, pay, tokens and crates. Everything tunable lives
// here, as constants, so that tools/economy-sim.mjs can tune it in one place; sim.js only applies the rules. The
// shape of the economy: supplies are always affordable (cash is a score with a use, never a gate), food is the one
// resource a child manages (pace and rations are the dials), and running out of it only slows the party down.
import { GOODS, animalOf, goodOf, legOf, seasonOf } from './route.js';

/** What a journey starts with in the Rookie year (cash and food scale with season.priceMult / stay the same). Why 300
 *  lb: enough for a party of four at full rations to reach the first fort two legs out, even if the app skips the
 *  Independence store; $400 buys the rest. */
export const START = { cash: 400, food: 300, parts: 1, goods: { pelts: 6 } };
/** Arrival pay: $60 × season.priceMult for arriving, + $20 a star (SPEC §5). */
export const PAY = { arrival: 60, star: 20 };
/** Pounds a person eats a day by the rations dial (SPEC §5: 3 full, 2 plenty, 1 lean). */
export const RATION_LB = { full: 3, plenty: 2, lean: 1 };
export const PACES = ['steady', 'brisk'];
export const RATIONS = ['full', 'plenty', 'lean'];
/** Speed rules: a missed marker makes the next day 60 %; no food makes the party crawl at 40 %; a quick marker
 *  answer is a tailwind of 3 free miles. */
export const SPEED = { slowDay: 0.6, crawl: 0.4, quickMiles: 3 };
/** Mood is a hidden 0-100 "spirit" shown as happy (≥ 60) / fine (≥ 30) / tired. Per day: rations and pace move it,
 *  a rest day lifts it, a night at a stop lifts it, a right marker is a notch up; food at 0 caps it at tired. Each
 *  companion sits a few points either side of the party (spread) so the faces are not all the same. */
export const MOOD = {
  start: 70, happy: 60, fine: 30, max: 100, notch: 5, rest: 12, stopRest: 8, hungryCap: 25, spread: 5,
  ration: { full: 3, plenty: 0, lean: -5 }, pace: { steady: 0, brisk: -4 },
  tiredRestAfter: 2,       // tired this many days in a row (with food) → the party rests a day on its own
};
/** Markers: one every ~30 miles, 4-6 a leg. */
export const MARKERS = { spacing: 30, min: 4, max: 6 };
/** Events: one or two a leg (the chance of a second), placed in the first and second halves of the leg. */
export const EVENTS_PLAN = { secondChance: 0.5, first: [0.15, 0.45], second: [0.5, 0.8] };
/** The safety net (SPEC §1: food runs low → a fishing stop or a hunt fixes it): when food hits 0 the next day brings
 *  a hunt or a fishing hole (a kind not yet seen this leg), at most every `cooldown` days, and that hunt or catch is
 *  worth at least `minLb` ("Eli shares his catch") so even a child who misses every shot is fed. */
export const RESCUE = { minLb: 30, cooldown: 2 };
/** Trade tokens: +1 for a word problem right on the first try (SPEC §3). */
export const TOKENS = { problemFirstTry: 1 };
/** Crate tier by the leg's stars (SPEC §10: gold on 3, silver on 2, bronze on 1). */
export const CRATE_BY_STARS = [null, 'bronze', 'silver', 'gold'];
/** Pounds of food in one unit of a traded good (NATIONS[].trade.get is always a food: a sack of flour, a bag of
 *  corn, a basket of camas); any unknown id is 10 lb. Store food goods use their own GOODS lb first. */
export const TRADE_LB = { flour: 50, corn: 25, pemmican: 20, berries: 10, camas: 15, salmon: 15, roots: 10, wapato: 10, default: 10 };
/** Pelts: the party starts with a few to trade and the bow hunt brings back 1 (2 for a big hunt of 25 lb or more). */
export const PELTS = { start: 6, perHunt: 1, bigHunt: 2, bigHuntLb: 25 };

const FOOD_GOODS = new Set(GOODS.filter((g) => g.lb).map((g) => g.id));
/** Is this good food (its pounds go into J.food)? */
export const isFood = (item) => FOOD_GOODS.has(typeof item === 'object' ? item.id : item);
/** Pounds per unit of a good: the store's `lb`, else the trade table, else 10. */
export function lbOf(item) {
  const id = typeof item === 'object' && item ? item.id : item;
  const g = goodOf(id);
  if (g && g.lb) return g.lb;
  return TRADE_LB[id] || TRADE_LB.default;
}

/** Miles a day for the pace and the animal (oxen 15 / 19, mules 18 / 23). */
export function milesPerDay(pace, animal) {
  const a = animalOf(animal);
  return (a.milesPerDay && a.milesPerDay[pace]) || (a.milesPerDay && a.milesPerDay.steady) || 15;
}
/** Days to cover some miles at a pace (whole days, rounded up). Why exported: the distance problems and the HUD's
 *  "Fort Laramie in 3 days" use the same rule as the sim. */
export const etaDays = (miles, pace = 'steady', animal = 'oxen') => Math.max(0, Math.ceil(Math.max(0, miles) / milesPerDay(pace, animal)));
/** Pounds of food a party needs: people × the ration × days (+ the animal's feed a day, if given). */
export const foodNeeded = (people, rations = 'full', days = 1, feedLb = 0) =>
  Math.max(0, Math.round((people * (RATION_LB[rations] ?? RATION_LB.full) + feedLb) * days));

/** A good's price at a stop in a season: the base price × the fort's price level × season.priceMult, in whole dollars
 *  (never below $1). leg null = Independence (price level 1). */
export function priceAt(item, leg, season) {
  const g = goodOf(item);
  const base = g ? g.price : (item && typeof item === 'object' && item.price) || 0;
  const l = legOf(leg);
  const level = (l && l.fort && l.fort.prices) || 1;
  return Math.max(1, Math.round(base * level * seasonOf(season).priceMult));
}
/** The General Store's shelf at a stop: every good with its price here (the app shows it; each purchase is a problem). */
export function storeList(leg, season) {
  return GOODS.map((g) => ({ id: g.id, name: g.name, unit: g.unit, lb: g.lb || 0, emoji: g.emoji, food: !!g.lb, price: priceAt(g, leg, season) }));
}

/** The arrival pay for a leg's stars: { arrival, stars, total }. */
export function payFor(stars, season) {
  const n = (stars || []).filter(Boolean).length;
  const arrival = Math.round(PAY.arrival * seasonOf(season).priceMult);
  return { arrival, stars: PAY.star * n, total: arrival + PAY.star * n };
}
/** The crate tier for a leg's stars ('gold' | 'silver' | 'bronze' | null). */
export const crateFor = (stars) => CRATE_BY_STARS[Math.min(3, (stars || []).filter(Boolean).length)] || null;

/** The mood word for a spirit value. */
export const moodOf = (spirit) => (spirit >= MOOD.happy ? 'happy' : spirit >= MOOD.fine ? 'fine' : 'tired');

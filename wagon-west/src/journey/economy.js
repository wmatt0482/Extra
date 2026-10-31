// The journey's numbers (SPEC §5, §10): food, speed, mood, prices, pay, tokens and crates. Everything tunable lives
// here, as constants, so that tools/economy-sim.mjs can tune it in one place; sim.js only applies the rules. The
// shape of the economy: supplies are always affordable (cash is a score with a use, never a gate), food is the one
// resource a child manages (pace and rations are the dials), and running out of it only slows the party down.
import { GOODS, animalOf, goodOf, legOf, seasonOf } from './route.js';

/** What a journey starts with in the Rookie year (cash and food scale with season.priceMult / stay the same). Why 300
 *  lb: enough for a party of four at full rations to reach the first fort two legs out, even if the app skips the
 *  Independence store; $400 buys the rest. */
export const START = { cash: 400, food: 300, parts: 1,
  foods: { flour: 150, bacon: 90, beans: 60, other: 0 },     // v1.2: the 300 lb as the wagon carries it (50 / 30 / 20 %)
  goods: { parts: 1, rope: 0, blankets: 0, arrows: 15, pelts: 6, yoke: 0 } };
/** Arrival pay: $60 × season.priceMult for arriving, + $20 a star (SPEC §5). */
export const PAY = { arrival: 60, star: 20 };
/** Pounds a person eats a day by the rations dial (SPEC §5: 3 full, 2 plenty, 1 lean). */
export const RATION_LB = { full: 3, plenty: 2, lean: 1 };
export const PACES = ['steady', 'brisk'];
export const RATIONS = ['full', 'plenty', 'lean'];
/** Speed rules: a missed marker makes the next day 60 %; no food makes the party crawl at 40 %; a quick marker
 *  answer is a tailwind of 3 free miles. */
export const SPEED = { slowDay: 0.6, crawl: 0.4, quickMiles: 3, limp: 0.6 };   // v1.2: limp = a wagon with no spare part for its breakdown
/** Mood is a hidden 0-100 "spirit" shown as happy (≥ 60) / fine (≥ 30) / tired. Per day: rations and pace move it,
 *  a rest day lifts it, a night at a stop lifts it, a right marker is a notch up; food at 0 caps it at tired. Each
 *  companion sits a few points either side of the party (spread) so the faces are not all the same. */
export const MOOD = {
  start: 70, happy: 60, fine: 30, max: 100, notch: 5, rest: 12, stopRest: 8, hungryCap: 25, spread: 5,
  ration: { full: 3, plenty: 0, lean: -5 }, pace: { steady: 0, brisk: -4 },
  tiredRestAfter: 2,       // tired this many days in a row (with food) → the party rests a day on its own
  weather: 6,              // v1.1: a wet, grumpy morning (a storm / frost / rain event) costs this much spirit, unless the wagon has the canvas cover
  camp: { rest: 8, other: 4 },   // v1.1: spirit gained by a day at camp (rest, or fishing / hunting / cards / tales)
  lostDay: 0,              // v1.2: a day lost to a breakdown with no spare part gives no rest bonus
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
/** v1.1 wagon upgrades (SPEC v1.1 §3): bought once with trade tokens or with cash (the cash price is in 1847 dollars and
 *  scales by the season's priceMult, like every price). cover: a weather event costs no mood; tires: +2 miles a day;
 *  barrel: lean rations count as plenty for the mood. Why both prices: tokens had no sink and cash piled up ($1,400 at the
 *  end of a Rookie journey), so each upgrade can be bought by whichever the child has more of. */
export const UPGRADES = [
  { id: 'cover', name: 'Canvas cover', tokens: 6, cash: 40 },
  { id: 'tires', name: 'Iron tires', tokens: 8, cash: 60 },
  { id: 'barrel', name: 'Water barrel', tokens: 6, cash: 40 },
];
export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
export const UPGRADE_FX = { tiresMiles: 2 };
/** The Fort Derby's pay (SPEC v1.1 §3): $20 × the season's priceMult for a win, a flat $5 "good try" for a loss. */
export const DERBY = { win: 20, lose: 5 };
/** A duplicate trail card pays this many trade tokens. */
export const CARD_DUP_TOKENS = 1;
/** The camp activities (SPEC v1.1 §3): each costs a day. */
export const CAMP_KINDS = ['fish', 'hunt', 'cards', 'tales', 'rest'];
/** The daily challenge's reward. */
export const CHALLENGE_REWARD = { tokens: 1, card: true };

/** Pelts: the party starts with a few to trade and the bow hunt brings back 1 (2 for a big hunt of 25 lb or more). */
export const PELTS = { start: 6, perHunt: 1, bigHunt: 2, bigHuntLb: 25 };

// ---- v1.2: supplies that do things (SPEC v1.2 §1) ----
/** The wagon's food by kind: a day eats 50 / 30 / 20 % from flour / bacon / beans once the 'other' kind (game, fish, plums,
 *  trades: whatever is not store food) is gone, then whatever is left. */
export const FOOD_KINDS = ['flour', 'bacon', 'beans', 'other'];
export const EAT_RATIO = { flour: 0.5, bacon: 0.3, beans: 0.2 };
/** Arrows: a hunt uses `perHunt` (the bow scene's five shots); the store's "bundle" is `perBundle` arrows (one hunt). */
export const ARROWS = { start: 15, perHunt: 5, perBundle: 5 };
/** Animals tire (J.animals.tired, 0-100): brisk pace and mountain biomes tire them each travel day, a rest day or a stop
 *  restores them; above `forceSteadyOver` the pace is steady whatever the dial says; the second yoke (4 animals) adds
 *  `yokeMiles` a day and halves the tiring. */
export const ANIMAL_RULES = { tireBrisk: 12, tireMountains: 8, restRelief: 30, stopRelief: 30, forceSteadyOver: 70, yokeMiles: 3, yokeTiring: 0.5, max: 100 };
/** The legs whose nights are cold (and a 'snow' event anywhere): one blanket for every `perBlanket` people. */
export const COLD_LEGS = ['south-pass', 'blue-mountains'];
export const COLD = { perBlanket: 2, spiritCap: 24 };       // a cold night caps the party's spirit at tired (< MOOD.fine)
/** Wet flour: a soaked sack is 25 lb, never more than half the wagon's flour. */
export const SOAKED_LB = 25;
/** Rosa's good cooking: the party eats this share of a normal day's food. */
export const COOK = { foodFactor: 0.9 };
/** Skill numbers: Jasper's night at camp (+4 spirit), Mabel's peppermints (raise a tired party to fine + 6, then wait
 *  `cooldown` days), Ada / Tomas live in the repair rules. */
export const SKILL_FX = { fiddlerCamp: 4, peppermintTo: MOOD.fine + 6, peppermintCooldown: 3 };
/** Pay for the pure-play mini-games (× the season's priceMult): the Columbia raft is $40 less $10 a bump (never under
 *  $10); holding the stampede pays $15 and the bison card. */
export const RAFT = { base: 40, perBump: 10, min: 10 };
export const STAMPEDE = { held: 15 };
/** The goods the General Store sells that the content's GOODS table does not list (src/content/legs.js is not ours). */
export const EXTRA_GOODS = [{ id: 'yoke', name: 'A second yoke', unit: 'yoke', emoji: '🐂', price: 30 }];
export const EXTRA_GOOD_BY_ID = Object.fromEntries(EXTRA_GOODS.map((g) => [g.id, g]));

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

/** Miles a day for the pace and the animal (oxen 15 / 19, mules 18 / 23), plus a bonus (the iron tires' 2). */
export function milesPerDay(pace, animal, bonus = 0) {
  const a = animalOf(animal);
  return ((a.milesPerDay && a.milesPerDay[pace]) || (a.milesPerDay && a.milesPerDay.steady) || 15) + (bonus || 0);
}
/** Days to cover some miles at a pace (whole days, rounded up). Why exported: the distance problems and the HUD's
 *  "Fort Laramie in 3 days" use the same rule as the sim. */
export const etaDays = (miles, pace = 'steady', animal = 'oxen', bonus = 0) => Math.max(0, Math.ceil(Math.max(0, miles) / milesPerDay(pace, animal, bonus)));
/** Pounds of food a party needs: people × the ration × days (+ the animal's feed a day, if given). */
export const foodNeeded = (people, rations = 'full', days = 1, feedLb = 0) =>
  Math.max(0, Math.round((people * (RATION_LB[rations] ?? RATION_LB.full) + feedLb) * days));

/** A good's price at a stop in a season: the base price × the fort's price level × season.priceMult, in whole dollars
 *  (never below $1). leg null = Independence (price level 1). */
export function priceAt(item, leg, season) {
  const g = goodOf(item) || EXTRA_GOOD_BY_ID[typeof item === 'object' && item ? item.id : item];
  const base = g ? g.price : (item && typeof item === 'object' && item.price) || 0;
  const l = legOf(leg);
  const level = (l && l.fort && l.fort.prices) || 1;
  return Math.max(1, Math.round(base * level * seasonOf(season).priceMult));
}
/** The General Store's shelf at a stop: every good with its price here (the app shows it; each purchase is a problem). */
export function storeList(leg, season) {
  return [...GOODS, ...EXTRA_GOODS].map((g) => ({ id: g.id, name: g.name, unit: g.unit, lb: g.lb || 0, emoji: g.emoji, food: !!g.lb, price: priceAt(g, leg, season) }));
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

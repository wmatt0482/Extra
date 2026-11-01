// Gold (SPEC v1.5 §3.4): the diggings of the Gold Road (Clear Creek, the Feather River, Coloma) and the Sacramento claim from 1848. Pure fun, no fail:
// every pan gives at least one flake, a good swirl gives more, now and then a nugget; ten flakes make a nugget (place value, 4.NBT). Gold never buys store
// goods: it goes home to the farm (homestead.js). The numbers are economy.js `GOLD` and the tiers' `gold`. Pure and seeded: the same journey, quality and
// seed give the same gold. No DOM, no clock, no Math.random.
import { legOf, tierOf } from './route.js';
import { GOLD, TIER_FX } from './economy.js';
import { skillOf } from './skills.js';
import { hashSeed, mulberry32 } from './rng.js';

/** The year a digging opens, for the diggings the leg table does not date itself (the Sacramento claim: gold was found in January 1848). */
export const GOLD_FROM = { 'sacramento-valley': 1848 };
const clamp01 = (q) => (Number.isFinite(q) ? Math.max(0, Math.min(1, q)) : 0);
const gold = (tier) => (TIER_FX[tierOf(tier)] || TIER_FX.rookie).gold;

/** The digging at the arrived leg: null | { pans, rich: [pan indexes], rocker } (the leg's `gold`; the Sacramento claim only from 1848; Hattie the prospector makes
 *  one more pan rich). The rich pans are seeded per journey and leg, so a reload shows the same ones. */
export function goldAt(J, legArg) {
  const leg = legOf(legArg || (J && J.legId));
  if (!leg || !leg.gold) return null;
  const from = (leg.gold.fromYear || GOLD_FROM[leg.id] || 0);
  if (from && (J && Number.isFinite(J.year) ? J.year : 1847) < from) return null;
  const pans = Math.max(0, leg.gold.pans | 0), rocker = Math.max(0, leg.gold.rocker | 0);
  const rand = mulberry32(hashSeed(J ? J.seed : 0, leg.id, 'rich'));
  const order = Array.from({ length: pans }, (_, i) => [rand(), i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const want = Math.min(pans, Math.max(0, leg.gold.rich | 0) + (J && skillOf(J, 'prospecting') ? 1 : 0));
  return { pans, rich: order.slice(0, want).sort((a, b) => a - b), rocker };
}

/** One pan: quality 0..1 (the scene's swirl). flakes = round((panBase + round(quality × panQuality) + (rich ? richBonus : 0) + (prospector && quality ≥ 0.6 ? 1 : 0))
 *  × the tier's gold), never under 1; nugget = rand() < nuggetChance[rich ? 'rich' : 'plain']. `rand` defaults to a generator seeded from the arguments. */
export function panOutcome({ quality = 0, rich = false, tier = 'rookie', prospector = false, rand = null } = {}) {
  const q = clamp01(quality);
  const r = typeof rand === 'function' ? rand : mulberry32(hashSeed('pan', q, rich, tier, prospector));
  const raw = GOLD.panBase + Math.round(q * GOLD.panQuality) + (rich ? GOLD.richBonus : 0) + (prospector && q >= GOLD.prospectorQuality ? GOLD.prospectorBonus : 0);
  const flakes = Math.max(1, Math.round(raw * gold(tier)));
  const nugget = r() < GOLD.nuggetChance[rich ? 'rich' : 'plain'];
  return { flakes, nugget };
}
/** One round of the rocker (Coloma): beats 0..1 (the share of on-beat rocks). flakes = round((rocker.base + round(beats × rocker.perBeat)) × gold), at least 2. */
export function rockerOutcome({ beats = 0, tier = 'rookie' } = {}) {
  const b = clamp01(beats);
  return { flakes: Math.max(GOLD.rocker.base, Math.round((GOLD.rocker.base + Math.round(b * GOLD.rocker.perBeat)) * gold(tier))) };
}
/** Flakes as nuggets: 57 flakes → { nuggets: 5, flakes: 7 } (the pouch shows both). */
export function nuggetsOf(flakes) {
  const f = Math.max(0, Math.floor(Number(flakes) || 0));
  return { nuggets: Math.floor(f / GOLD.flakesPerNugget), flakes: f % GOLD.flakesPerNugget };
}
/** The pan's or the rocker's result goes into the pouch: J.gold (flakes this journey); a nugget adds flakesPerNugget flakes on top of the pan's. `rocker` (the
 *  round's beats 0..1) counts the round and, when it was on the beat, the deed's counter. Returns { flakes: J.gold, nuggets: nuggetsOf(J.gold), added }. */
export function applyGold(J, { flakes = 0, nugget = false, rocker = null } = {}) {
  const f = Math.max(0, Math.floor(Number(flakes) || 0)), extra = nugget ? GOLD.flakesPerNugget : 0;
  const T = J.totals || (J.totals = {});
  J.gold = Math.max(0, J.gold | 0) + f + extra;
  const add = (k, n = 1) => { T[k] = (T[k] | 0) + n; };
  if (rocker == null) { add('pans'); } else { add('rockerRounds'); if (clamp01(rocker) >= GOLD.rocker.onBeat) add('rockerBeat'); }
  if (f + extra > 0) add('flakes', f + extra);
  if (nugget) add('nuggets');
  if (J.trip) { J.trip.keys = Array.isArray(J.trip.keys) ? J.trip.keys : []; for (const k of rocker == null ? ['pan'] : ['rocker']) if (!J.trip.keys.includes(k)) J.trip.keys.push(k); if (nugget && !J.trip.keys.includes('nugget')) J.trip.keys.push('nugget'); }
  return { flakes: J.gold, nuggets: nuggetsOf(J.gold), added: f + extra };
}

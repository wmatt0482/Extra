// Crates (SPEC v1.5 §4): Spell Jump's crate rules (car-jump/src/meta/engagement.js: a weighted roll, a pity counter,
// a duplicate re-rolls once, then cash; its crateCash for the amount) with Trail Blazer's own tables
// (src/data/cosmetics.js) and three crate tiers. Earned crates wait in save.crates.queue (tiers, oldest first) and
// open with a tap on the results (or the Garage Wall). Pure: `rand` comes in; the caller persists.
//   bronze: a podium with ≥ 3 gates right, every XP level · silver: every gate quick in a race · gold: a cup trophy,
//   a star set (all 3 on a trail), streak days 14 / 30 (and silver at 7, bronze at 3).
// Completing a kind on the Garage Wall grants its set-bonus paint (SET_BONUS).
import { crateCash } from '../../../spell-jump/src/meta/engagement.js';
import { BY_KIND, CRATE_POOL, CRATE_TIERS, KINDS, PITY_EVERY, SET_BONUS, STOCK, itemOf } from '../data/cosmetics.js';

export const CRATE_IDS = ['bronze', 'silver', 'gold'];
export const owns = (save, kind, id) => id === STOCK[kind] || (save.cosmetics.owned[kind] || []).includes(id);
export const unopened = (save) => save.crates.queue.length;
/** Add a crate (tier) to the queue. why is for the toast / results line. */
export function earnCrate(save, tier = 'bronze', n = 1) {
  if (!CRATE_TIERS[tier]) tier = 'bronze';
  for (let i = 0; i < n; i++) save.crates.queue.push(tier);
  save.crates.earned += n;
  return n;
}
function grant(save, kind, id) {
  const arr = save.cosmetics.owned[kind] || (save.cosmetics.owned[kind] = []);
  if (arr.includes(id) || id === STOCK[kind]) return false;
  arr.push(id);
  return true;
}
/** Everything not owned yet that a crate can drop, by rarity. */
function missingBy(save, raceOwned) {
  const out = { common: [], rare: [], legendary: [] };
  for (const it of CRATE_POOL) if (!owns(save, it.kind, it.id) && !(raceOwned && raceOwned(it))) out[it.rarity].push(it);
  return out;
}
/**
 * Roll one crate of a tier (does not change the save): rarity by the tier's weights, then an item of that rarity the
 * player does not own. Pity: the PITY_EVERY-th crate in a row with nothing new is something new when anything is left.
 * Nothing left at that rarity → the next rarity down/up; nothing at all → cash (crateCash × the tier's cashMul ×
 * the vehicle tier). raceOwned(item): paints / decals already unlocked by racing count as owned.
 */
export function rollCrate(save, { tier = 'bronze', vehicleTier = 1, rand = Math.random, raceOwned = null } = {}) {
  const T = CRATE_TIERS[tier] || CRATE_TIERS.bronze;
  const missing = missingBy(save, raceOwned);
  const anyLeft = missing.common.length + missing.rare.length + missing.legendary.length > 0;
  const cash = () => crateCash(Math.max(1, vehicleTier), rand) * T.cashMul;
  if (!anyLeft) return { tier, kind: 'cash', cash: cash(), isNew: false };
  const pity = (save.crates.sinceNew || 0) >= PITY_EVERY - 1;
  const total = Object.values(T.weights).reduce((a, b) => a + b, 0);
  let r = rand() * total, rarity = 'common';
  for (const [k, w] of Object.entries(T.weights)) { r -= w; if (r < 0) { rarity = k; break; } }
  // the duplicate rule: a rarity with nothing new left rolls a coin flip for cash (unless the pity applies)
  let pool = missing[rarity];
  if (!pool.length) {
    if (!pity && rand() < 0.5) return { tier, kind: 'cash', cash: cash(), isNew: false, converted: rarity };
    pool = missing.rare.length ? missing.rare : missing.common.length ? missing.common : missing.legendary;
  }
  const it = pool[Math.floor(rand() * pool.length) % pool.length];
  return { tier, kind: 'item', item: it, isNew: true, pity };
}
/** Open the oldest waiting crate: roll, grant, count. Returns the roll plus { setDone: [{ kind, paint }] } or null. */
export function openCrate(save, opts = {}) {
  if (!save.crates.queue.length) return null;
  const tier = save.crates.queue.shift();
  const out = rollCrate(save, { ...opts, tier });
  if (out.kind === 'item') grant(save, out.item.kind, out.item.id);
  else { save.cash += out.cash; save.records.lifetimeCash += out.cash; }
  save.crates.opened += 1;
  save.crates.sinceNew = out.isNew ? 0 : (save.crates.sinceNew || 0) + 1;
  out.setDone = checkSets(save, opts.raceOwned);
  return out;
}
/** The Garage Wall: per kind { have, total, done, bonus }. */
export function wall(save, raceOwned = null) {
  return KINDS.map((kind) => {
    const list = BY_KIND[kind].filter((x) => x.source !== 'set' && x.id !== 'none');   // 'No flag' / 'No decal' are not items
    const have = list.filter((x) => owns(save, kind, x.id) || (raceOwned && raceOwned(x))).length;
    return { kind, have, total: list.length, done: have >= list.length, bonus: SET_BONUS[kind] || null, bonusOwned: SET_BONUS[kind] ? owns(save, 'paint', SET_BONUS[kind]) : false };
  });
}
/** Grant every completed set's bonus paint not granted yet. Returns [{ kind, paint }]. */
export function checkSets(save, raceOwned = null) {
  const out = [];
  for (const w of wall(save, raceOwned)) if (w.done && w.bonus && !w.bonusOwned && grant(save, 'paint', w.bonus)) out.push({ kind: w.kind, paint: w.bonus });
  return out;
}
/** Equip a rider item (helmet, suit, horn, trail, flag) the player owns. */
export function equip(save, kind, id) {
  if (!['helmet', 'suit', 'horn', 'trail', 'flag'].includes(kind) || !itemOf(kind, id) || !owns(save, kind, id)) return false;
  save.cosmetics.equipped[kind] = id;
  return true;
}

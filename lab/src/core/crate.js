// The Lab crate (lab/SPEC.md §2.5): odds, the 7-crate guarantee, the item pool, opening. PURE; every roll is seeded
// by hashString(playerId|key|owned pool items), so two devices that open the same crate before they sync get the same item.
import { hashString, mulberry32 } from '../../../spell-jump/src/meta/rng.js';
import { CRATE_ODDS, DUPLICATE_REFUND, PITY_AFTER, PITY_ODDS, POOL_WEIGHT, RARITY_NAMES, RARITY_ORDER } from '../data/crate.js';
import { ITEMS, LAB_OWNERS } from '../data/catalog.js';
import { creditEarned, owns } from './model.js';
import { playedDays } from './quests.js';
import { grant, isReady } from './shop.js';

export { CRATE_ODDS };

/** Earn a crate under a key ('quest:<day>' | 'streak:<n>'): false when that key already earned one. */
export function earnCrate(lab, key, now) {
  if (lab.crates.earned[key] !== undefined) return false;
  lab.crates.earned[key] = Math.max(1, Math.floor(now) || 1);
  return true;
}
/** Keys earned and not yet opened, oldest first. */
export function unopened(lab) {
  return Object.keys(lab.crates.earned).filter((k) => !lab.crates.opened[k]).sort((a, b) => lab.crates.earned[a] - lab.crates.earned[b] || (a < b ? -1 : 1));
}

// the rarity history in the order the crates were opened
function lastRarities(lab, n) {
  const rows = Object.keys(lab.crates.opened).map((k) => [lab.crates.opened[k].at, k, lab.crates.opened[k].r]);
  rows.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1));
  return rows.slice(-n).map((r) => r[2]);
}
const dropPool = (lab, ready) => ITEMS.filter((i) => i.source === 'both' && !owns(lab, i.id) && isReady(i, ready));

/** Roll a crate without changing the doc: { id (or null), coins, rarity: 'c'|'r'|'e', pity, converted }. `ready` = the ids the games can draw. */
export function rollCrate(lab, ctx, key, { ready = null } = {}) {
  const ownedBoth = ITEMS.filter((i) => i.source === 'both' && owns(lab, i.id)).length;
  const rng = mulberry32(hashString(`${ctx.playerId}|${key}|${ownedBoth}`));
  const recent = lastRarities(lab, PITY_AFTER);
  const pity = recent.length >= PITY_AFTER && recent.every((r) => r === 'c');
  const x = rng() * 100;
  let rolled;
  if (pity) rolled = x < PITY_ODDS.r ? 'r' : 'e';
  else rolled = x < CRATE_ODDS.c ? 'c' : x < CRATE_ODDS.c + CRATE_ODDS.r ? 'r' : 'e';
  const pool = dropPool(lab, ready);
  const played = playedDays(lab, ctx.day);
  const weight = (i) => (LAB_OWNERS.includes(i.owner) || played[i.owner] > 0 ? POOL_WEIGHT.played : POOL_WEIGHT.other);
  // a rarity with nothing left rolls down one rarity at a time
  for (let ri = RARITY_ORDER.indexOf(rolled); ri >= 0; ri--) {
    const rar = RARITY_ORDER[ri];
    const cand = pool.filter((i) => i.rarity === rar);
    if (!cand.length) continue;
    const total = cand.reduce((a, i) => a + weight(i), 0);
    let r = rng() * total, pick = cand[cand.length - 1];
    for (const i of cand) { r -= weight(i); if (r < 0) { pick = i; break; } }
    return { id: pick.id, coins: 0, rarity: rar, pity, converted: false };
  }
  return { id: null, coins: DUPLICATE_REFUND[rolled], rarity: rolled, pity, converted: true };      // nothing left at all: half the item price in coins
}

/** Open an earned crate: grant the item (or pay the coins), record opened[key]. Opening twice returns the stored result ({ again: true }); null when the key was never earned. */
export function openCrate(lab, ctx, key, { ready = null } = {}) {
  const had = lab.crates.opened[key];
  if (had) return { id: had.id || null, coins: had.coins, rarity: had.r, pity: !!had.pity, converted: !had.id && had.coins > 0, again: true };
  if (lab.crates.earned[key] === undefined) return null;
  const res = rollCrate(lab, ctx, key, { ready });
  if (res.id) grant(lab, ctx, res.id, 'crate');
  else creditEarned(lab, ctx, { coins: res.coins });
  lab.crates.opened[key] = { at: Math.max(1, Math.floor(ctx.now) || 1), id: res.id || '', coins: res.coins, r: res.rarity, pity: res.pity ? 1 : 0 };
  return { ...res, again: false };
}

/** The Parent Zone's odds table. */
export function crateOddsTable() {
  return {
    rows: ['c', 'r', 'e'].map((r) => ({ id: r, name: RARITY_NAMES[r], percent: CRATE_ODDS[r] })),
    pity: `A rare or better is guaranteed at least every ${PITY_AFTER + 1} crates: after ${PITY_AFTER} common crates in a row, the next is rare (${PITY_ODDS.r} in 100) or epic (${PITY_ODDS.e} in 100).`,
    duplicates: 'The crate never gives something already owned. If everything of that rarity is owned, it gives a lower rarity, or coins worth half the item price.',
    note: 'Cosmetics only. Crates are earned by finishing a day\'s quests or a streak milestone, and are never for sale for money.',
  };
}

// The shop, ownership and what is worn (lab/SPEC.md §2.7, §3.2). PURE: every change mutates the lab it is given; the caller persists.
import { ITEM_BY_ID, ITEMS, LAB_OWNERS, SLOTS, SLOT_BY_KEY, isStock, slotKeyMatches } from '../data/catalog.js';
import { owns, totalXp, wallet } from './model.js';
import { levelFor, slotOpen } from './xp.js';

/** The price of an item in Lab coins: the game's own price when its labLooks module exports one (`LOOKS_PRICES = { itemId: coins }`, the single source of
 *  truth for a game's coin-only items), else the Lab's table (the common / rare / epic prices, and the stand-in for a game that has not exported prices yet). */
export const priceOf = (item, prices = null) => {
  if (!item) return 0;
  const p = prices && prices[item.id];
  return typeof p === 'number' && Number.isFinite(p) && p >= 0 ? Math.floor(p) : item.price;
};
const RARITY_ORDER = { c: 0, r: 1, e: 2 };

/** Is the item drawable / enforceable right now? The Lab's own (avatar, pet, home) always; a game's only when its labLooks module listed it. `soon` never. */
export function isReady(item, ready) {
  if (!item || item.soon) return false;
  if (LAB_OWNERS.includes(item.owner)) return true;
  if (!ready) return false;
  return Array.isArray(ready) ? ready.includes(item.id) : typeof ready.has === 'function' ? ready.has(item.id) : false;
}

/** { ok, reason: ''|'owned'|'coins'|'unknown'|'notready'|'gift'|'locked', need } for buying `id`. `level` (optional) checks the slot is open. */
export function canBuy(lab, id, { ready = null, level = null, prices = null } = {}) {
  const item = ITEM_BY_ID[id];
  if (!item) return { ok: false, reason: 'unknown', need: 0 };
  if (owns(lab, id)) return { ok: false, reason: 'owned', need: 0 };
  if (item.source === 'gift' || item.source === 'stock') return { ok: false, reason: 'gift', need: 0 };
  if (!isReady(item, ready)) return { ok: false, reason: 'notready', need: 0 };
  const lv = level == null ? levelFor(totalXp(lab)) : level;
  if (!slotOpen(lv, item.key)) return { ok: false, reason: 'locked', need: 0, level: SLOT_BY_KEY[item.key].open };
  const coins = wallet(lab).coins;
  const price = priceOf(item, prices);
  if (coins < price) return { ok: false, reason: 'coins', need: price - coins };
  return { ok: true, reason: '', need: 0 };
}

const stamp = (ctx) => Math.max(1, Math.floor((ctx && ctx.now) || 0));
const posterAlias = (slotKey) => (slotKey === 'home.poster' ? 'home.poster2' : slotKey === 'home.poster2' ? 'home.poster' : null);

/** Buy an item with coins: records `paid` and `owned`. { ok, spent, reason }. */
export function buy(lab, ctx, id, { ready = null, prices = null } = {}) {
  const c = canBuy(lab, id, { ready, prices });
  if (!c.ok) return { ok: false, spent: 0, reason: c.reason, need: c.need };
  const item = ITEM_BY_ID[id];
  const price = priceOf(item, prices);
  lab.paid[id] = Math.max(lab.paid[id] || 0, price);
  lab.owned[id] = stamp(ctx);
  return { ok: true, spent: price, reason: '' };
}

/** Give an item for free (a level, first-play, streak, goal or crate gift): `paid` 0. False when unknown or already owned. */
export function grant(lab, ctx, id, why = '') {
  const item = ITEM_BY_ID[id];
  if (!item || owns(lab, id)) return false;
  lab.owned[id] = stamp(ctx);
  if (lab.paid[id] === undefined) lab.paid[id] = 0;
  if (item.slot === 'poster') {                     // a new poster hangs itself on an empty hook
    for (const slot of ['home.poster', 'home.poster2']) {
      const cur = lab.equipped[slot];
      if (!cur || !cur[0]) { lab.equipped[slot] = [id, Math.max(stamp(ctx), (cur ? cur[1] : 0) + 1)]; break; }
    }
  }
  return true;
}

/** Wear an item in a slot (id) or take the slot's item off (null). Needs ownership, an open slot and the item's own slot. */
export function equip(lab, ctx, slotKey, id) {
  const slot = SLOT_BY_KEY[slotKey];
  if (!slot || slot.noEquip) return false;
  const prev = lab.equipped[slotKey];
  const at = Math.max(stamp(ctx), (prev ? prev[1] : 0) + 1);
  if (id == null || id === '') { if (!prev || !prev[0]) return false; lab.equipped[slotKey] = ['', at]; return true; }
  const item = ITEM_BY_ID[id];
  if (!item || !slotKeyMatches(slotKey, item) || !owns(lab, id) || !slotOpen(levelFor(totalXp(lab)), slotKey)) return false;
  const other = posterAlias(slotKey);
  if (other && lab.equipped[other] && lab.equipped[other][0] === id) lab.equipped[other] = ['', Math.max(stamp(ctx), lab.equipped[other][1] + 1)];
  lab.equipped[slotKey] = [id, at];
  return true;
}
export const equippedIds = (lab) => Object.keys(lab.equipped).map((k) => lab.equipped[k][0]).filter(Boolean).sort();

/** The shelf for one tab (`game` = an owner: 'av' | 'pet' | 'home' | 'sj' | 'tb' | 'ff' | 'ww' | 'bc'): its items with a state.
 *  state: 'owned' | 'gift' (not sold: `how` says how it is earned) | 'locked' (the slot opens at a level) | 'poor' (need N more) | 'buy'. Not-ready items are left out. */
export function shelf(lab, { game, ready = null, level = null, prices = null } = {}) {
  const lv = level == null ? levelFor(totalXp(lab)) : level;
  const coins = wallet(lab).coins;
  const order = Object.fromEntries(SLOTS.map((s, i) => [s.key, i]));
  const worn = new Set(equippedIds(lab));
  return ITEMS.filter((i) => i.owner === game && isReady(i, ready)).map((raw) => {
    const i = { ...raw, price: priceOf(raw, prices) };
    let state, need = 0;
    if (owns(lab, i.id)) state = 'owned';
    else if (i.source === 'gift') state = 'gift';
    else if (!slotOpen(lv, i.key)) state = 'locked';
    else if (coins < i.price) { state = 'poor'; need = i.price - coins; } else state = 'buy';
    return { ...i, state, need, equipped: worn.has(i.id), opensAt: SLOT_BY_KEY[i.key].open };
  }).sort((a, b) => order[a.key] - order[b.key] || RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.price - b.price || (a.name < b.name ? -1 : 1));
}
export { isStock };

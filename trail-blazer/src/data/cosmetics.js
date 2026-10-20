// Rider gear and the Garage Wall (SPEC v1.5 §4). Everything here is earned, never bought: crates (src/meta/crates.js),
// the streak, and the set bonuses. Kinds: helmet (12), suit (8), horn (6), trail (8, the boost particles), flag (6),
// plus the paints and decals of src/data/paints.js (racing unlocks, crate drops, the streak paint, set bonuses).
// rarity: common | rare | legendary (a gold crate drops a legendary ≥ 20 % of the time). source: stock | crate |
// streak (days) | set. The engine draws the look: drawRider(ctx, { helmet, suit }) and the flag / boost trail by id;
// the colours are here too so the app's previews and a fallback renderer can draw them.
import { DECALS, PAINTS } from './paints.js';

const item = (kind, id, name, rarity, extra = {}) => ({ kind, id, name, rarity, source: 'crate', ...extra });
export const HELMETS = [
  item('helmet', 'classic', 'Classic', 'common', { source: 'stock', colors: ['#f4f6f8', '#ff8a1f'] }),
  item('helmet', 'stripe', 'Stripe', 'common', { colors: ['#2f8bd6', '#ffffff'] }),
  item('helmet', 'flames', 'Flames', 'rare', { colors: ['#222', '#ff8a1f', '#ffd23a'] }),
  item('helmet', 'skull', 'Skull', 'rare', { colors: ['#e9ecef', '#222'] }),
  item('helmet', 'dino', 'Dino', 'rare', { colors: ['#4caf50', '#ffd23a'] }),
  item('helmet', 'astronaut', 'Astronaut', 'legendary', { colors: ['#ffffff', '#8fd3ff'] }),
  item('helmet', 'shark', 'Shark', 'rare', { colors: ['#6f8ea8', '#ffffff'] }),
  item('helmet', 'rainbow', 'Rainbow', 'legendary', { colors: ['#ff5d5d', '#ffe14a', '#22b8ff'] }),
  item('helmet', 'chrome', 'Chrome', 'legendary', { colors: ['#dfe6ec', '#7d8b98'] }),
  item('helmet', 'galaxy', 'Galaxy', 'legendary', { colors: ['#1b1f4a', '#8f6bff', '#ffffff'] }),
  item('helmet', 'lightning', 'Lightning', 'legendary', { source: 'streak', days: 30, colors: ['#1c2a6b', '#ffd23a'] }),
  item('helmet', 'crown', 'Crown', 'legendary', { colors: ['#ffd23a', '#c8261c'] }),
];
export const SUITS = [
  item('suit', 'rookie', 'Rookie Blue', 'common', { source: 'stock', colors: ['#3f5a8a', '#ffffff'] }),
  item('suit', 'racer', 'Racer Red', 'common', { colors: ['#d9382f', '#ffffff'] }),
  item('suit', 'camo', 'Camo', 'common', { colors: ['#5f7a45', '#3a4a2a'] }),
  item('suit', 'checker', 'Checker Flag', 'rare', { colors: ['#f4f4f4', '#1d1b26'] }),
  item('suit', 'neon', 'Neon Night', 'rare', { colors: ['#1d1d2a', '#3cff9d'] }),
  item('suit', 'stars', 'Star Captain', 'rare', { colors: ['#243a6e', '#ffe14a'] }),
  item('suit', 'galaxy', 'Galaxy', 'legendary', { colors: ['#4a2a8a', '#ff7ad1'] }),
  item('suit', 'gold', 'Gold Rush', 'legendary', { colors: ['#e8b52e', '#8a5a10'] }),
];
// a horn is a few notes (Hz, seconds) for the sfx
export const HORNS = [
  item('horn', 'beep', 'Beep Beep', 'common', { source: 'stock', notes: [[660, 0.09], [660, 0.12]] }),
  item('horn', 'honk', 'Big Honk', 'common', { notes: [[220, 0.3]] }),
  item('horn', 'duck', 'Duck', 'rare', { notes: [[520, 0.08], [440, 0.12]] }),
  item('horn', 'tuba', 'Tuba', 'rare', { notes: [[110, 0.2], [147, 0.25]] }),
  item('horn', 'cowbell', 'Cowbell', 'rare', { notes: [[800, 0.06], [800, 0.06], [800, 0.1]] }),
  item('horn', 'fanfare', 'Fanfare', 'legendary', { notes: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.25]] }),
];
// boost trails: the particle colours behind the vehicle (the engine's TRAIL_FX ids)
export const TRAILS = [
  item('trail', 'orange', 'Ember', 'common', { source: 'stock', colors: ['#ff6a1a', '#ffe14a'] }),
  item('trail', 'blue', 'Ice Blue', 'common', { colors: ['#4dd2ff', '#dff6ff'] }),
  item('trail', 'green', 'Slime', 'common', { colors: ['#7dff6b', '#d6ff8a'] }),
  item('trail', 'pink', 'Bubblegum', 'rare', { colors: ['#ff5ec4', '#ffc2ea'] }),
  item('trail', 'purple', 'Plasma', 'rare', { colors: ['#8f6bff', '#d9c8ff'] }),
  item('trail', 'ice', 'Frost', 'rare', { colors: ['#ffffff', '#bfe8ff'] }),
  item('trail', 'gold', 'Gold Dust', 'legendary', { colors: ['#f2c230', '#fff3a0'] }),
  item('trail', 'rainbow', 'Rainbow', 'legendary', { colors: ['#ff5d5d', '#ffe14a', '#3ddc84', '#22b8ff', '#8f6bff'] }),
];
// flags on a whip antenna (the engine's FLAGS ids; 'none' = no flag)
export const FLAGS = [
  item('flag', 'none', 'No Flag', 'common', { source: 'stock', colors: [] }),
  item('flag', 'checker', 'Checker', 'common', { colors: ['#111111', '#ffffff'] }),
  item('flag', 'heart', 'Heart', 'common', { colors: ['#ff4d8d', '#ffffff'] }),
  item('flag', 'star', 'Star', 'rare', { colors: ['#2f6bd6', '#ffe14a'] }),
  item('flag', 'skull', 'Skull', 'rare', { colors: ['#23242b', '#ffffff'] }),
  item('flag', 'lightning', 'Lightning', 'rare', { colors: ['#ffd23f', '#1d1b26'] }),
  item('flag', 'rainbow', 'Rainbow', 'legendary', { colors: ['#ff5d5d', '#ffe14a', '#3ddc84', '#22b8ff'] }),
];
// paints and decals as Garage Wall items: racing ones keep their unlock (and can also drop from a crate)
const PAINT_RARITY = { sage: 'common', orange: 'common', granite: 'common', lakeblue: 'common', snow: 'common', sunset: 'common', black: 'common', pine: 'common',
  sky: 'rare', gold: 'rare', purple: 'rare', rainbow: 'legendary', lime: 'common', teal: 'common', magenta: 'rare', copper: 'rare',
  streak: 'legendary', chrome: 'legendary', neon: 'legendary', candy: 'legendary', aurora: 'legendary', moon: 'legendary', midnight: 'legendary' };
export const PAINT_ITEMS = PAINTS.map((p) => ({ kind: 'paint', id: p.id, name: p.name, rarity: PAINT_RARITY[p.id] || 'common',
  source: !p.unlock ? 'stock' : p.unlock.set ? 'set' : p.unlock.streak ? 'streak' : 'crate', days: p.unlock && p.unlock.streak, set: p.unlock && p.unlock.set, race: !!(p.unlock && (p.unlock.finish || p.unlock.medal)) }));
export const DECAL_ITEMS = DECALS.map((d) => ({ kind: 'decal', id: d.id, name: d.name, rarity: d.id === 'checkers' || d.id === 'stars' ? 'rare' : 'common',
  source: d.unlock ? 'crate' : 'stock', race: !!(d.unlock && !d.unlock.crate) }));

export const KINDS = ['helmet', 'suit', 'horn', 'trail', 'flag', 'paint', 'decal'];
export const KIND_NAME = { helmet: 'Helmets', suit: 'Suits', horn: 'Horns', trail: 'Boost trails', flag: 'Flags', paint: 'Paints', decal: 'Decals' };
export const BY_KIND = { helmet: HELMETS, suit: SUITS, horn: HORNS, trail: TRAILS, flag: FLAGS, paint: PAINT_ITEMS, decal: DECAL_ITEMS };
export const ITEM = Object.fromEntries(KINDS.flatMap((k) => BY_KIND[k].map((x) => [`${k}:${x.id}`, x])));
export const itemOf = (kind, id) => ITEM[`${kind}:${id}`] || null;
export const STOCK = { helmet: 'classic', suit: 'rookie', horn: 'beep', trail: 'orange', flag: 'none', paint: 'sage', decal: 'none' };
/** The Garage Wall sets: every kind is a set; completing one grants its bonus paint (the paint set has none). */
export const SET_BONUS = { helmet: 'chrome', suit: 'neon', horn: 'candy', trail: 'aurora', flag: 'moon', decal: 'midnight' };
/** Items a crate can drop: everything but the stock items, the streak rewards and the set bonuses. */
export const CRATE_POOL = KINDS.flatMap((k) => BY_KIND[k]).filter((x) => x.source === 'crate' || (x.kind === 'paint' && x.race) || (x.kind === 'decal' && x.race));
/** Crate tiers: the rarity weights (gold: a legendary ≥ 20 % of the time). */
export const CRATE_TIERS = {
  bronze: { name: 'Bronze crate', weights: { common: 70, rare: 27, legendary: 3 }, cashMul: 1 },
  silver: { name: 'Silver crate', weights: { common: 45, rare: 43, legendary: 12 }, cashMul: 2 },
  gold: { name: 'Gold crate', weights: { common: 25, rare: 50, legendary: 25 }, cashMul: 4 },
};
export const PITY_EVERY = 3;              // the 3rd crate in a row with nothing new is something new (when any is left)
/** Streak milestone rewards (days → crate tier and items). */
export const STREAK_REWARDS = { 3: { crate: 'bronze' }, 7: { crate: 'silver' }, 14: { crate: 'gold', paint: 'streak' }, 30: { crate: 'gold', helmet: 'lightning' }, 60: { crate: 'gold' }, 100: { crate: 'gold' } };

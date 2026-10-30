// The wagon's looks (SPEC §3 "a crate … wagon paint, a flag, a bugle call, a companion's hat"): the catalog, what a
// crate drops (Trail Blazer's crate idea with Wagon West's own small tables: a weighted roll among the looks not owned
// yet, rarer ones in better crates, cash when everything is owned) and what trade tokens buy. v1.1: every look can be
// bought with tokens (common 8, rare 14, legendary 20: tokens pile up on the trail, so the looks are a generous sink
// next to the wagon upgrades), and crates still drop them.
// Pure: no DOM, no storage; `rand` comes in.
export const LOOK_KINDS = Object.freeze(['paint', 'flag', 'bugle', 'hat']);
export const KIND_NAME = Object.freeze({ paint: 'Wagon paint', flag: 'Flag', bugle: 'Bugle call', hat: "Companion's hat" });
export const STOCK = Object.freeze({ paint: 'canvas', flag: 'none', bugle: 'none', hat: 'none' });

export const LOOKS = Object.freeze({
  paint: [
    { id: 'canvas', name: 'Canvas', color: '#f3ead7', rarity: 'stock' },
    { id: 'sky', name: 'Sky blue', color: '#a9d3e8', rarity: 'common', tokens: 8 },
    { id: 'sunflower', name: 'Sunflower', color: '#f5d36b', rarity: 'common', tokens: 8 },
    { id: 'sage', name: 'Sage', color: '#b8cf9c', rarity: 'common', tokens: 8 },
    { id: 'rose', name: 'Prairie rose', color: '#ebb2a8', rarity: 'common', tokens: 8 },
    { id: 'lilac', name: 'Lilac', color: '#c9b6e4', rarity: 'rare', tokens: 14 },
    { id: 'night', name: 'Night sky', color: '#46557d', rarity: 'rare', tokens: 14 },
    { id: 'gold', name: 'Gold rush', color: '#e8b33a', rarity: 'legendary', tokens: 20 },
  ],
  flag: [
    { id: 'none', name: 'No flag', color: 'transparent', rarity: 'stock' },
    { id: 'star', name: 'Lone star', color: '#d9653b', rarity: 'common', tokens: 8 },
    { id: 'sun', name: 'Rising sun', color: '#f2b33d', rarity: 'common', tokens: 8 },
    { id: 'wave', name: 'River wave', color: '#5bb8d6', rarity: 'common', tokens: 8 },
    { id: 'compass', name: 'Compass', color: '#7fb85a', rarity: 'rare', tokens: 14 },
    { id: 'beaver', name: 'Beaver', color: '#8a5a33', rarity: 'legendary', tokens: 20 },
  ],
  bugle: [
    { id: 'none', name: 'No bugle', rarity: 'stock' },
    { id: 'reveille', name: 'Reveille', rarity: 'common', tokens: 8 },
    { id: 'fanfare', name: 'Fanfare', rarity: 'rare', tokens: 14 },
  ],
  hat: [
    { id: 'none', name: 'Their own hats', rarity: 'stock' },
    { id: 'straw', name: 'Straw hat', color: '#e7c66b', rarity: 'common', tokens: 8 },
    { id: 'bowler', name: 'Bowler', color: '#3b2c22', rarity: 'common', tokens: 8 },
    { id: 'feather', name: 'Feather cap', color: '#7fb85a', rarity: 'rare', tokens: 14 },
    { id: 'top', name: 'Tall top hat', color: '#2a2230', rarity: 'legendary', tokens: 20 },
  ],
});
const ITEM = Object.fromEntries(LOOK_KINDS.flatMap((k) => LOOKS[k].map((x) => [`${k}:${x.id}`, { ...x, kind: k }])));
export const itemOf = (kind, id) => ITEM[`${kind}:${id}`] || null;
export const owns = (cos, kind, id) => id === STOCK[kind] || ((cos && cos.owned && cos.owned[kind]) || []).includes(id);

// crate tiers: the chance of each rarity, and the cash when every look is owned
export const CRATES = Object.freeze({
  bronze: { name: 'Wooden crate', weights: { common: 80, rare: 18, legendary: 2 }, cash: 20 },
  silver: { name: 'Iron-bound crate', weights: { common: 55, rare: 37, legendary: 8 }, cash: 35 },
  gold: { name: 'Golden crate', weights: { common: 30, rare: 50, legendary: 20 }, cash: 60 },
});
/** Roll a crate: { kind, id, name, rarity } (a look not owned yet) or { cash } when everything is owned. */
export function rollCrate(cos, tier = 'bronze', rand = Math.random) {
  const t = CRATES[tier] || CRATES.bronze;
  const missing = Object.values(ITEM).filter((x) => x.rarity !== 'stock' && !owns(cos, x.kind, x.id));
  if (!missing.length) return { cash: t.cash };
  const by = { common: [], rare: [], legendary: [] };
  for (const x of missing) by[x.rarity].push(x);
  const avail = Object.entries(t.weights).filter(([r]) => by[r].length);
  const total = avail.reduce((a, [, w]) => a + w, 0);
  let roll = rand() * total, rarity = avail[0][0];
  for (const [r, w] of avail) { if (roll < w) { rarity = r; break; } roll -= w; }
  const pool = by[rarity];
  const x = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
  return { kind: x.kind, id: x.id, name: x.name, rarity: x.rarity };
}
/** Grant a look (crate or tokens); false when already owned. */
export function grantLook(cos, kind, id) {
  if (!itemOf(kind, id) || owns(cos, kind, id)) return false;
  cos.owned[kind].push(id);
  return true;
}
export function equipLook(cos, kind, id) {
  if (!owns(cos, kind, id)) return false;
  cos.equipped[kind] = id;
  return true;
}
/** The looks trade tokens can buy, with their price. */
export const tokenShop = () => Object.values(ITEM).filter((x) => x.tokens);

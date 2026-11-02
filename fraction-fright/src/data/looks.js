// The yard (SPEC §7, §13.5): grenade types, goo colours, fences and yard extras (the dog, the lantern), bought with the
// cash from cured neighbours. Pumpkins come from the calm beat after a final wave. Cosmetics only: nothing here changes
// the aim, the tolerance or what the road shows (never a "scope" that reveals ticks). The stock items are free and owned.
/** Prices of the Lab-integration yard items, set by tools/yard-sim.mjs (the runway target, SPEC §4.3); the older items keep their prices. */
export const PRICES = Object.freeze({ aqua: 8000, sunshine: 16000, bubblegum: 26000, galaxy: 40000, brick: 22000, castle: 55000, lookout: 40000, watchtower: 90000, beacon: 110000 });
export const GRENADES = Object.freeze([
  { id: 'slime', name: 'Slime grenade', sub: 'The classic splat', color: '#a6ff2e', price: 0 },
  { id: 'lava', name: 'Lava grenade', sub: 'Orange burst, ember sparks', color: '#ff7a1a', price: 2500 },
  { id: 'frost', name: 'Frost grenade', sub: 'Freezes a zombie, then shatters', color: '#7fe7ff', price: 5000 },
  { id: 'disco', name: 'Disco grenade', sub: 'Confetti; the neighbour dances home', color: '#ff5fd2', price: 9000 },
]);
export const GOO = Object.freeze([
  { id: 'lime', name: 'Toxic green', color: '#a6ff2e', edge: '#4f8a0b', price: 0 },
  { id: 'grape', name: 'Ecto purple', color: '#9b5cff', edge: '#4a2a99', price: 1500 },
  { id: 'tangerine', name: 'Lava orange', color: '#ff7a1a', edge: '#9a3a00', price: 3500 },
  // Lab integration v1 (runway): four more colours, bought in this order of price with the same cure cash (never red: no blood)
  { id: 'aqua', name: 'Pool aqua', color: '#19e6d1', edge: '#0a7d72', price: PRICES.aqua },
  { id: 'sunshine', name: 'Sunshine yellow', color: '#ffe14a', edge: '#9a7d00', price: PRICES.sunshine },
  { id: 'bubblegum', name: 'Bubblegum pink', color: '#ff7ad9', edge: '#9a2a82', price: PRICES.bubblegum },
  { id: 'galaxy', name: 'Galaxy blue', color: '#4d6bff', edge: '#1a2a99', price: PRICES.galaxy },
]);
export const FENCES = Object.freeze([
  { id: 'picket', name: 'Old picket fence', color: '#b7b0a1', price: 0 },
  { id: 'stone', name: 'Stone wall', color: '#6f6a66', price: 4000 },
  { id: 'iron', name: 'Wrought-iron fence', color: '#26252b', price: 4500 },
  { id: 'brick', name: 'Brick wall', sub: 'Warm red brick, a stone cap', color: '#9a5a45', price: PRICES.brick },
  { id: 'castle', name: 'Castle wall', sub: 'Battlements and a banner gate', color: '#8d8f99', price: PRICES.castle },
]);
/** The tower (Lab integration v1, SPEC §4.3): built in order, on the left of the road; cosmetic only (nothing changes the aim, the zone or the road). */
export const TOWERS = Object.freeze([
  { id: 'none', name: 'No tower', stage: 0, price: 0 },
  { id: 'lookout', name: 'Lookout post', sub: 'A wooden lookout on stilts', stage: 1, price: PRICES.lookout, color: '#8a5a32' },
  { id: 'watchtower', name: 'Watchtower', sub: 'Stone, with battlements', stage: 2, price: PRICES.watchtower, color: '#8a8590' },
  { id: 'beacon', name: 'Beacon tower', sub: 'A light you can see from the whole street', stage: 3, price: PRICES.beacon, color: '#ffe9a0' },
]);
/** Yard extras: owned once, then switched on or off (save.yard.dog / .lantern). */
export const EXTRAS = Object.freeze([
  { id: 'dog', name: 'Yard dog', sub: 'Sits by the ½ post, barks at a bullseye', color: '#c9a36b', price: 4000 },
  { id: 'lantern', name: 'Gate lantern', sub: 'A warm light on the gate', color: '#ffd25a', price: 1500 },
]);
export const YARD_KINDS = Object.freeze({ grenade: GRENADES, goo: GOO, fence: FENCES, tower: TOWERS });
export const STOCK = Object.freeze({ grenade: 'slime', goo: 'lime', fence: 'picket', tower: 'none' });
/** The tower is built one stage at a time: the item before this one in TOWERS must be owned (`none` is always owned). */
export const towerBefore = (id) => { const i = TOWERS.findIndex((t) => t.id === id); return i > 1 ? TOWERS[i - 1] : null; };
export const itemOf = (kind, id) => (YARD_KINDS[kind] || []).find((x) => x.id === id) || (kind === 'extra' ? EXTRAS.find((x) => x.id === id) : null) || null;
export const extraOf = (id) => EXTRAS.find((x) => x.id === id) || null;

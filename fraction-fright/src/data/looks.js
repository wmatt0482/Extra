// The yard (SPEC §7, §13.5): grenade types, goo colours, fences and yard extras (the dog, the lantern), bought with the
// cash from cured neighbours. Pumpkins come from the calm beat after a final wave. Cosmetics only: nothing here changes
// the aim, the tolerance or what the road shows (never a "scope" that reveals ticks). The stock items are free and owned.
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
]);
export const FENCES = Object.freeze([
  { id: 'picket', name: 'Old picket fence', color: '#b7b0a1', price: 0 },
  { id: 'stone', name: 'Stone wall', color: '#6f6a66', price: 4000 },
  { id: 'iron', name: 'Wrought-iron fence', color: '#26252b', price: 4500 },
]);
/** Yard extras: owned once, then switched on or off (save.yard.dog / .lantern). */
export const EXTRAS = Object.freeze([
  { id: 'dog', name: 'Yard dog', sub: 'Sits by the ½ post, barks at a bullseye', color: '#c9a36b', price: 4000 },
  { id: 'lantern', name: 'Gate lantern', sub: 'A warm light on the gate', color: '#ffd25a', price: 1500 },
]);
export const YARD_KINDS = Object.freeze({ grenade: GRENADES, goo: GOO, fence: FENCES });
export const STOCK = Object.freeze({ grenade: 'slime', goo: 'lime', fence: 'picket' });
export const itemOf = (kind, id) => (YARD_KINDS[kind] || []).find((x) => x.id === id) || (kind === 'extra' ? EXTRAS.find((x) => x.id === id) : null) || null;
export const extraOf = (id) => EXTRAS.find((x) => x.id === id) || null;

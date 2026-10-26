// The yard (SPEC §7, 1.0 basics): 3 goo colours and 2 fence styles (pumpkins come from the calm beat after a final wave). Cosmetics only: nothing here changes the aim, the
// tolerance or what the road shows (never a "scope" that reveals ticks). The stock items are free and owned.
export const GOO = Object.freeze([
  { id: 'lime', name: 'Toxic green', color: '#a6ff2e', edge: '#4f8a0b', price: 0 },
  { id: 'grape', name: 'Ecto purple', color: '#9b5cff', edge: '#4a2a99', price: 1200 },
  { id: 'tangerine', name: 'Lava orange', color: '#ff7a1a', edge: '#9a3a00', price: 2400 },
]);
export const FENCES = Object.freeze([
  { id: 'picket', name: 'Old picket fence', color: '#b7b0a1', price: 0 },
  { id: 'iron', name: 'Wrought-iron fence', color: '#26252b', price: 3000 },
]);
export const YARD_KINDS = Object.freeze({ goo: GOO, fence: FENCES });
export const STOCK = Object.freeze({ goo: 'lime', fence: 'picket' });
export const itemOf = (kind, id) => (YARD_KINDS[kind] || []).find((x) => x.id === id) || null;

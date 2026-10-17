// The Ranger's four upgrades, 10 levels each, bought with cash in the garage (SPEC §2.3, §6).
// resolveStats(levels) gives the multipliers the engine consumes (all 1.0 at level 0):
//   Engine      power 1 → 2.2 (+ topSpeed 1 → 1.8)          Tires   grip 1 → 1.6
//   Suspension  suspension 1 → 2.4 (bump tolerance, air control)
//   Boost       boostPower + boostCapacity 1 → 2.5, coinMult 1 → 1.5
// Costs: 300 × 1.45^level, rounded to 10s ($300, $440, $630 … $8,490 for level 10), about $107k for all 40 levels.

export const MAX_LEVEL = 10;

export const UPGRADES = [
  { id: 'engine', name: 'Engine', icon: 'engine', blurb: 'More power up the hills, higher top speed.' },
  { id: 'tires', name: 'Tires', icon: 'tire', blurb: 'More grip in mud, sand and snow.' },
  { id: 'suspension', name: 'Suspension', icon: 'spring', blurb: 'Soaks up bumps and hard landings.' },
  { id: 'boost', name: 'Boost', icon: 'flame', blurb: 'Bigger tank, stronger thrust, more cash.' },
];
export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export const COST_BASE = 300;
export const COST_MUL = 1.45;
/** Cost of buying level `level + 1` (level = the current level, 0..9). */
export function upgradeCost(level) {
  return Math.round((COST_BASE * Math.pow(COST_MUL, level)) / 10) * 10;
}
export function totalCostToMax() {
  let s = 0;
  for (let l = 0; l < MAX_LEVEL; l++) s += upgradeCost(l);
  return s * UPGRADES.length;
}

const lerp = (a, b, lv) => Math.round((a + ((b - a) * Math.max(0, Math.min(MAX_LEVEL, lv))) / MAX_LEVEL) * 1000) / 1000;

export function emptyLevels() {
  return Object.fromEntries(UPGRADES.map((u) => [u.id, 0]));
}

export function resolveStats(levels = {}) {
  const e = levels.engine || 0, t = levels.tires || 0, s = levels.suspension || 0, b = levels.boost || 0;
  return {
    power: lerp(1, 2.2, e),
    topSpeed: lerp(1, 1.8, e),
    grip: lerp(1, 1.6, t),
    suspension: lerp(1, 2.4, s),
    boostPower: lerp(1, 2.5, b),
    boostCapacity: lerp(1, 2.5, b),
    coinMult: lerp(1, 1.5, b),
    levels: { engine: e, tires: t, suspension: s, boost: b },
  };
}

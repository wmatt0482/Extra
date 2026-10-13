// Upgrade system. Four tracks per car, each 0..MAX_LEVEL. Levels are stored per car in the save.
// resolveStats(car, levels) produces the numbers the engine actually consumes.

export const MAX_LEVEL = 10;

export const UPGRADES = [
  { id: 'engine',     name: 'Engine',     icon: 'engine', blurb: 'Faster down the ramp. More speed off the lip.' },
  { id: 'nitro',      name: 'Nitro',      icon: 'nitro',  blurb: 'Bigger tank, harder shove while airborne.' },
  { id: 'suspension', name: 'Suspension', icon: 'spring', blurb: 'Survive harder landings. Bounce instead of break.' },
  { id: 'bonus',      name: 'Bonus',      icon: 'coin',   blurb: 'More cash from distance, stunts, and smashes.' },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

// Cost of buying level `level+1` for a given car tier and current level.
export function upgradeCost(carTier, level) {
  const base = 120 * Math.pow(2.2, carTier - 1);
  return Math.round(base * Math.pow(1.55, level) / 10) * 10;
}

// Per-level multiplier applied to the base stat. Linear-ish so each level is felt.
function lvl(level, perLevel) {
  return 1 + level * perLevel;
}

export function resolveStats(car, levels = {}) {
  const e = levels.engine || 0;
  const n = levels.nitro || 0;
  const s = levels.suspension || 0;
  const b = levels.bonus || 0;
  const base = car.base;
  return {
    // Engine: acceleration on the ramp/ground and the speed kick at the lip.
    power: base.power * lvl(e, 0.12),
    launchBoost: base.launchBoost * lvl(e, 0.10),
    // Nitro: mid-air thrust strength and how long it lasts (seconds of full burn at level 0 ~ 1.2s).
    nitroPower: base.nitroPower * lvl(n, 0.14),
    nitroCapacity: base.nitroCapacity * lvl(n, 0.18),
    // Suspension: tolerance to landing impact before the car is damaged, plus bounce softness.
    suspension: base.suspension * lvl(s, 0.16),
    // Bonus: multiplier on all cash earned in a run.
    coinMult: base.coinMult * lvl(b, 0.10),
    mass: base.mass,
    grip: base.grip,
  };
}

export function totalUpgradeLevels(levels = {}) {
  return UPGRADES.reduce((sum, u) => sum + (levels[u.id] || 0), 0);
}

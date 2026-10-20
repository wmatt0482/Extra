// Trail Blazer vehicles (SPEC v1.5 §1). Prices are the sim-tuned runway (tools/economy-sim.mjs, the README table). Engine-owned data: physics geometry + base stats + the special of each
// vehicle in the ladder. The app owns buying, per-vehicle upgrade levels and the garage cards.
//
// Shape: { id, name, tier (1-8), price, blurb, feel, hull (convex polygon, m, +x forward, +y up, y = 0 under the
//          wheels), wheels [{ x, y, r }] (rear, front), seat [x, y] (where the rider sits), exhaust [x, y],
//          headlight [x, y], mass (chassis, Matter units; the Ranger is 9), wheelMass,
//          base: { power, topSpeed, grip, suspension, boostPower, boostCapacity, weight } (multipliers, the Ranger is
//          1.0 everywhere; base x the app's upgrade multipliers from upgrades.js resolveStats() = what the engine runs),
//          special (id, see SPECIALS), specialBlurb, look: { paint (default paint id), trim }, art (the drawing kind
//          src/game/vehicle.js dispatches on) }.
//
// The engine takes game.start({ vehicle: id, stats }) and builds the body from `hull`, `wheels`, `mass`; `drawVehicle`
// draws by `look.vehicle`. Base stats climb ~12 % a tier (power, grip, suspension); top speed climbs ~6 % a tier
// (the physics caps a rider at 64 m/s ≈ 230 km/h, and the Rail already sits near it at level 10) and the boost ~8 %.
//
// Specials (what the engine does with them):
//   flippy      Dune Quad     air lean +25 % (flips come round faster), stronger auto-level (air control)
//   bigair      Dirt Bike 85  a lift in the air (longest flights), wheelies on GAS, crashes from a smaller landing angle
//   landsAll    Rock Bawler   hard landings never crash (only a true roof landing does), long-travel bump stops
//   crush       Mud Monster   logs, rocks, cones... never slow it (smash cash still paid)
//   turbotank   Turbo RZR-X   gate boost refills 2x (correct / quick / fixed fuel doubled)
//   rocket      Thunder Rail  top speed x1.5 (in base.topSpeed), whoops bounce it hard
//   lunar       Moon Rover    gravity 0.6 on every trail, coins x2, low grip (base.grip) and bouncy wheels

const T = (t) => Math.pow(1.12, t - 1); // the 12 % ladder
const V = (t) => Math.pow(1.06, t - 1); // top speed
const B = (t) => Math.pow(1.08, t - 1); // boost
const base = (t, o = {}) => ({ power: r3(T(t)), topSpeed: r3(V(t)), grip: r3(T(t)), suspension: r3(T(t)), boostPower: r3(B(t)), boostCapacity: r3(B(t)), weight: 1, ...o });
const r3 = (x) => Math.round(x * 1000) / 1000;

export const SPECIALS = {
  none: { id: 'none', name: '', blurb: '' },
  flippy: { id: 'flippy', name: 'Flip Master', blurb: 'Flips 25% faster and steadies itself in the air.' },
  bigair: { id: 'bigair', name: 'Big Air', blurb: 'Floats the longest. Wheelies on gas. Tips over easier!' },
  landsAll: { id: 'landsAll', name: 'Lands Anything', blurb: 'Hard landings never crash.' },
  crush: { id: 'crush', name: 'Crusher', blurb: 'Rolls over logs, rocks and cones without slowing.' },
  turbotank: { id: 'turbotank', name: 'Turbo Tank', blurb: 'Math gates fill the boost tank twice as much.' },
  rocket: { id: 'rocket', name: 'Rocket', blurb: 'Top speed x1.5. Whoops bounce it hard!' },
  lunar: { id: 'lunar', name: 'Moon Gravity', blurb: 'Low gravity everywhere and coins pay double.' },
};

export const VEHICLES = [
  {
    id: 'ranger150', name: 'Ranger 150', tier: 1, price: 0,
    blurb: 'The kid-size side-by-side that started it all.', feel: 'the trusty one',
    hull: [[-1.36, 0.5], [1.3, 0.5], [1.46, 0.6], [1.44, 0.9], [1.3, 1.02], [0.6, 2.06], [-0.66, 2.06], [-1.36, 1.27]],
    wheels: [{ x: -0.95, y: 0.42, r: 0.42 }, { x: 0.95, y: 0.42, r: 0.42 }],
    seat: [-0.06, 1.1], exhaust: [-1.4, 0.68], headlight: [1.4, 0.84], flagPost: [-0.58, 2.0],
    mass: 9, wheelMass: 2.6,
    base: base(1),
    special: 'none', specialBlurb: '',
    look: { paint: 'sage', trim: '#ff8a1f' }, art: 'utv',
  },
  {
    id: 'quad', name: 'Dune Quad', tier: 2, price: 170000,
    blurb: 'A light four-wheeler that loves to spin.', feel: 'light and flippy',
    hull: [[-1.0, 0.42], [1.0, 0.42], [1.15, 0.62], [1.0, 0.98], [0.35, 1.25], [-0.2, 1.3], [-0.95, 1.2], [-1.08, 0.9]],
    wheels: [{ x: -0.74, y: 0.4, r: 0.4 }, { x: 0.74, y: 0.4, r: 0.4 }],
    seat: [-0.2, 1.12], exhaust: [-1.05, 0.62], headlight: [1.08, 0.86], flagPost: [-0.92, 1.18],
    mass: 6, wheelMass: 2.0,
    base: base(2, { weight: 0.75 }),
    special: 'flippy', specialBlurb: '+25% flip rate, air control',
    look: { paint: 'sunset', trim: '#ffd23f' }, art: 'quad',
  },
  {
    id: 'dirtbike', name: 'Dirt Bike 85', tier: 3, price: 700000,
    blurb: 'Two wheels, one rider, the biggest air in the game.', feel: 'two wheels, huge air',
    hull: [[-0.78, 0.5], [0.78, 0.5], [1.02, 0.92], [0.7, 1.3], [0.1, 2.12], [-0.5, 2.05], [-0.95, 1.05]],
    wheels: [{ x: -0.72, y: 0.46, r: 0.46 }, { x: 0.72, y: 0.46, r: 0.46 }],
    seat: [-0.2, 1.2], exhaust: [-0.75, 0.95], headlight: [0.95, 1.2], flagPost: [-0.7, 1.15],
    mass: 5, wheelMass: 1.6,
    base: base(3, { weight: 0.55 }),
    special: 'bigair', specialBlurb: 'longest air, wheelies on gas, falls easier',
    look: { paint: 'lakeblue', trim: '#ffffff' }, art: 'bike',
  },
  {
    id: 'buggy', name: 'Rock Bawler', tier: 4, price: 2400000,
    blurb: 'A tube-frame rock buggy with suspension for days.', feel: 'long-travel suspension',
    hull: [[-1.4, 0.55], [1.35, 0.55], [1.58, 0.8], [1.35, 1.15], [0.7, 2.15], [-0.7, 2.2], [-1.48, 1.35]],
    wheels: [{ x: -1.05, y: 0.5, r: 0.5 }, { x: 1.05, y: 0.5, r: 0.5 }],
    seat: [-0.1, 1.15], exhaust: [-1.45, 0.75], headlight: [1.48, 0.98], flagPost: [-0.6, 2.1],
    mass: 10, wheelMass: 3.0,
    base: base(4, { suspension: r3(T(4) * 1.25), weight: 1.15 }),
    special: 'landsAll', specialBlurb: 'lands anything; hard landings never crash',
    look: { paint: 'granite', trim: '#ff8a1f' }, art: 'buggy',
  },
  {
    id: 'mudtruck', name: 'Mud Monster', tier: 5, price: 5500000,
    blurb: 'Giant wheels. Everything in the way is a speed bump.', feel: 'giant wheels',
    hull: [[-1.5, 0.95], [1.5, 0.95], [1.68, 1.2], [1.45, 1.65], [0.55, 1.8], [0.35, 2.5], [-0.9, 2.55], [-1.5, 1.75]],
    wheels: [{ x: -1.1, y: 0.72, r: 0.72 }, { x: 1.1, y: 0.72, r: 0.72 }],
    seat: [-0.2, 1.75], exhaust: [-1.5, 1.4], headlight: [1.6, 1.42], flagPost: [-0.85, 2.45],
    mass: 14, wheelMass: 3.6,
    base: base(5, { weight: 1.6 }),
    special: 'crush', specialBlurb: 'drives over logs, rocks and cones without slowing',
    look: { paint: 'pine', trim: '#ffd23f' }, art: 'truck',
  },
  {
    id: 'turbo', name: 'Turbo RZR-X', tier: 6, price: 15000000,
    blurb: 'Sleek, loud, and always hungry for boost.', feel: 'fast and loud',
    hull: [[-1.45, 0.45], [1.45, 0.45], [1.62, 0.62], [1.5, 0.98], [0.6, 2.0], [-0.72, 2.05], [-1.45, 1.22]],
    wheels: [{ x: -1.05, y: 0.45, r: 0.45 }, { x: 1.05, y: 0.45, r: 0.45 }],
    seat: [-0.08, 1.05], exhaust: [-1.5, 0.66], headlight: [1.55, 0.82], flagPost: [-0.66, 1.98],
    mass: 9, wheelMass: 2.6,
    base: base(6, { boostPower: r3(B(6) * 1.15), weight: 1.0 }),
    special: 'turbotank', specialBlurb: 'boost tank refills 2x faster from gates',
    look: { paint: 'orange', trim: '#1f4d2e' }, art: 'turbo',
  },
  {
    id: 'rail', name: 'Thunder Rail', tier: 7, price: 22000000,
    blurb: 'A rocket on wheels. Hold on!', feel: 'a rocket on wheels',
    hull: [[-1.6, 0.5], [1.85, 0.3], [2.05, 0.55], [1.35, 0.9], [0.45, 1.95], [-0.7, 2.0], [-1.65, 1.15]],
    wheels: [{ x: -1.2, y: 0.56, r: 0.56 }, { x: 1.55, y: 0.32, r: 0.32 }],
    seat: [-0.15, 1.05], exhaust: [-1.6, 0.9], headlight: [1.95, 0.5], flagPost: [-0.65, 1.95],
    mass: 9, wheelMass: 2.4,
    base: base(7, { topSpeed: r3(V(7) * 1.5), weight: 0.95 }),
    special: 'rocket', specialBlurb: 'top speed x1.5; whoops bounce it hard',
    look: { paint: 'purple', trim: '#ffd23f' }, art: 'rail',
  },
  {
    id: 'rover', name: 'Moon Rover', tier: 8, price: 56000000,
    blurb: 'Built for the Moon. Floats over everything, grips nothing.', feel: 'ultra low grip, big bounce',
    hull: [[-1.4, 0.6], [1.4, 0.6], [1.55, 0.85], [1.4, 1.55], [0.95, 1.95], [-0.95, 2.35], [-1.45, 1.55]],
    wheels: [{ x: -1.0, y: 0.56, r: 0.56 }, { x: 1.0, y: 0.56, r: 0.56 }],
    seat: [-0.1, 1.4], exhaust: [-1.42, 0.95], headlight: [1.5, 1.2], flagPost: [-0.9, 2.3],
    mass: 8, wheelMass: 2.2,
    base: base(8, { grip: r3(T(8) * 0.6), weight: 0.9 }),
    special: 'lunar', specialBlurb: 'gravity 0.6 on every trail, coins x2',
    look: { paint: 'snow', trim: '#4dd2ff' }, art: 'rover',
  },
];
export const VEHICLE_BY_ID = Object.fromEntries(VEHICLES.map((v) => [v.id, v]));
export const DEFAULT_VEHICLE = VEHICLES[0].id;

// Per-vehicle upgrade cost multiplier by tier (SPEC v1.5 §1: COST_BASE x 1.45^level x tierMul).
export const TIER_MUL = [1, 1.6, 2.5, 4, 7, 12, 20, 35];
export const tierMul = (tier) => TIER_MUL[Math.max(1, Math.min(8, tier | 0)) - 1];

/** The vehicle definition for an id (or a definition passed through); the Ranger when unknown. */
export function vehicleDef(idOrDef) {
  if (idOrDef && typeof idOrDef === 'object' && idOrDef.hull) return idOrDef;
  return VEHICLE_BY_ID[idOrDef] || VEHICLES[0];
}

/** Effective stats the engine runs: the vehicle's base x the upgrade multipliers (upgrades.js resolveStats). */
export function effectiveStats(vehicle, stats = {}) {
  const v = vehicleDef(vehicle), b = v.base;
  const n = (x, d) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Number(x) : d);
  return {
    power: b.power * n(stats.power, 1),
    topSpeed: b.topSpeed * n(stats.topSpeed, 1),
    grip: b.grip * n(stats.grip, 1),
    suspension: b.suspension * n(stats.suspension, 1),
    boostPower: b.boostPower * n(stats.boostPower, 1),
    boostCapacity: b.boostCapacity * n(stats.boostCapacity, 1),
    coinMult: n(stats.coinMult, 1),
  };
}

/** Rival vehicle ids for a player's tier: tier - 1, tier, tier + 1 (clamped to 1..8), SPEC v1.5 §1. */
export function rivalVehicles(playerTier, n = 3) {
  const t = Math.max(1, Math.min(8, playerTier | 0));
  const order = [t - 1, t, t + 1, t + 2, t - 2].map((k) => Math.max(1, Math.min(8, k)));
  return order.slice(0, n).map((k) => VEHICLES[k - 1].id);
}

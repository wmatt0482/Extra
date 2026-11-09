// Sky rides (v4.0 Phase 1: three). Same shape as src/data/cars.js plus `era: 'sky'`. Bought with Garage cash, priced above the
// Rhino tier and upgraded with the same four upgrade tracks (the `tier` feeds the upgrade-cost formula, so sky rides use tiers
// 12-14: dearer upgrades than the Earth stretch cars). Earth cars can fly Sky tracks and these rides can run Earth tracks.
//
// Engine-read handling fields (all optional; Earth cars have none, so Era 1 is untouched):
//   art        'bike' | 'rocket' | 'mech'   body/legs art (src/game/car.js drawSkyRide)
//   float      fraction of gravity cancelled in the air and on hops ("floaty")
//   glide      0..1 fraction of gravity cancelled while NITRO is held in the air (lift); glideDrag = forward-speed bleed (1/s);
//              glideBurn = tank seconds burnt per second of glide. NITRO in the air is a glide for these rides (thrust on the ground)
//   boostMul   scales the Spell Boost impulse (up + forward)
//   hop        legs: upward hop speed (m/s) per gait step on the ground; hopPeriod = seconds per step; groundKeep = share of the
//              ground drive that never fades (a walker keeps pushing); righting = extra self-levelling in the air (lands on its feet)
//   legs       art geometry: hips (car-local), thigh/shin lengths (m)
export const SKY_RIDES = [
  {
    id: 'hoverbike',
    era: 'sky',
    art: 'bike',
    name: 'Hover Bike',
    tagline: 'Light as a feather. Hold NITRO in the air to glide.',
    price: 4000000,
    tier: 12,
    color: '#34d6c4',
    accent: '#ffe14a',
    body: [[-1.7, -0.1], [-1.2, -0.28], [-0.2, -0.32], [0.5, -0.2], [1.1, 0.0], [1.75, 0.18], [1.5, 0.34], [0.7, 0.3], [0.2, 0.52], [-0.5, 0.5], [-1.0, 0.28], [-1.65, 0.16]],
    wheels: [{ x: -1.15, y: -0.42, r: 0.32 }, { x: 1.2, y: -0.42, r: 0.32 }],
    base: { power: 5.0, launchBoost: 5.0, nitroPower: 6.0, nitroCapacity: 8.0, suspension: 2.6, coinMult: 2.8, mass: 0.9, grip: 1.8 },
    float: 0.14, glide: 0.9, glideDrag: 0.07, glideBurn: 0.3, boostMul: 1.1,
    drag: 0.5, splashKeep: 0.85, ringMul: 1.6,
  },
  {
    id: 'rocketcar',
    era: 'sky',
    art: 'rocket',
    name: 'Rocket Car',
    tagline: 'All thrust. A huge boost and a short, hot glide.',
    price: 8000000,
    tier: 13,
    color: '#ff5a3c',
    accent: '#ffffff',
    body: [[-2.5, -0.3], [2.2, -0.3], [3.05, 0.12], [2.4, 0.62], [0.6, 0.78], [-0.4, 0.8], [-1.6, 0.7], [-2.2, 1.55], [-2.85, 1.55], [-2.65, 0.5], [-2.75, 0.2]],
    wheels: [{ x: -1.6, y: -0.46, r: 0.42 }, { x: 1.55, y: -0.46, r: 0.42 }],
    base: { power: 6.5, launchBoost: 8.0, nitroPower: 9.0, nitroCapacity: 7.0, suspension: 3.4, coinMult: 3.4, mass: 2.2, grip: 2.2 },
    glide: 0.55, glideDrag: 0.06, glideBurn: 1.5, boostMul: 1.4,
    drag: 0.75, splashKeep: 0.75, ringMul: 1.6,
  },
  {
    id: 'mechwalker',
    era: 'sky',
    art: 'mech',
    name: 'Mech Walker',
    tagline: 'Two strong legs. Lands on its feet and hops right along.',
    price: 14000000,
    tier: 14,
    color: '#b9c4d8',
    accent: '#ff5a6a',
    body: [[-1.0, -0.15], [1.05, -0.15], [1.35, 0.15], [1.1, 0.85], [0.3, 1.05], [-0.7, 1.0], [-1.15, 0.6], [-1.2, 0.1]],
    wheels: [{ x: -0.55, y: -0.85, r: 0.45 }, { x: 0.65, y: -0.85, r: 0.45 }],
    base: { power: 5.5, launchBoost: 6.0, nitroPower: 6.5, nitroCapacity: 6.0, suspension: 5.0, coinMult: 3.1, mass: 1.8, grip: 3.6 },
    hop: 3.4, hopPeriod: 0.46, groundKeep: 0.55, righting: 2.2, boostMul: 1.15,
    drag: 0.7, splashKeep: 0.85, ringMul: 1.6,
    legs: { hips: [[-0.5, -0.1], [0.55, -0.1]], thigh: 0.55, shin: 0.55 },
  },
];

export const SKY_RIDE_BY_ID = Object.fromEntries(SKY_RIDES.map((c) => [c.id, c]));

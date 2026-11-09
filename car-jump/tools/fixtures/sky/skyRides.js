// STAND-IN sky ride for the app's tests (?mock=1&skyfixture=1). The real ones are src/data/skyRides.js (the engine side). Same shape as src/data/cars.js plus era: 'sky'.
export const SKY_RIDES = [
  {
    id: 'hoverbike', era: 'sky', name: 'Hover Bike', tagline: 'Light and floaty. Hold nitro to glide.', price: 800000, tier: 7,
    color: '#22d3ff', accent: '#0a3b6e',
    body: [[-1.6, -0.1], [1.7, -0.1], [1.9, 0.2], [1.0, 0.35], [0.5, 0.8], [-0.4, 0.85], [-1.2, 0.4], [-1.7, 0.2]],
    wheels: [{ x: -1.0, y: -0.3, r: 0.3 }, { x: 1.2, y: -0.3, r: 0.3 }],
    base: { power: 3.0, launchBoost: 2.6, nitroPower: 3.2, nitroCapacity: 3.0, suspension: 2.0, coinMult: 2.4, mass: 0.7, grip: 1.6 },
  },
];

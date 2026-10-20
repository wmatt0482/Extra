// The vehicle lineup for the menus if the engine agent's src/data/vehicles.js is missing (SPEC v1.5 §1). The engine
// builds the bodies; the app only needs ids, names, tiers, a feel line and the special for the garage cards.
export const FALLBACK_VEHICLES = [
  { id: 'ranger150', name: 'Ranger 150', tier: 1, price: 0, feel: 'the trusty one', special: '' },
  { id: 'quad', name: 'Dune Quad', tier: 2, price: 170000, feel: 'light and flippy', special: '+25 % flip rate, air control' },
  { id: 'dirtbike', name: 'Dirt Bike 85', tier: 3, price: 700000, feel: 'two wheels, huge air', special: 'longest air, wheelies on gas' },
  { id: 'buggy', name: 'Rock Bawler', tier: 4, price: 2400000, feel: 'long-travel suspension', special: 'hard landings never crash' },
  { id: 'mudtruck', name: 'Mud Monster', tier: 5, price: 5500000, feel: 'giant wheels', special: 'drives over logs, rocks and cones' },
  { id: 'turbo', name: 'Turbo RZR-X', tier: 6, price: 15000000, feel: 'fast and loud', special: 'boost refills 2× faster from gates' },
  { id: 'rail', name: 'Thunder Rail', tier: 7, price: 22000000, feel: 'a rocket on wheels', special: 'top speed ×1.5' },
  { id: 'rover', name: 'Moon Rover', tier: 8, price: 56000000, feel: 'ultra low grip, big bounce', special: 'low gravity everywhere, coins ×2' },
];

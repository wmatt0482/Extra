// Pit Challenge mutators (SPEC v1.5 §6): one trail + one mutator a day. Engine-owned effects; the app picks the
// day's pair (seeded by the date), doubles the cash and gives the crate.
//
// Shape: { id, name, blurb (kid tone, one line), icon (a kid-friendly icon name for the app's icon set),
//          params: the knobs the engine applies in game.start({ mutator: id | def }) }.
// params: gravity (multiplier on g), tankMul (boost tank), fog (0..1, a near-layer fog that hides the horizon),
//         wheelMul (wheel radius), crush (props never slow the vehicle), topSpeedMul, mirror (the trail is ridden
//         backwards: finish straight first, start straight last), bounce (landing bounce + wheel restitution).

export const MUTATORS = [
  { id: 'moonboots', name: 'Moon Boots', blurb: 'Half gravity: every jump floats for ages.', icon: 'moon',
    params: { gravity: 0.5 } },
  { id: 'megaboost', name: 'Mega Boost', blurb: 'A boost tank three times the size.', icon: 'flame',
    params: { tankMul: 3 } },
  { id: 'fog', name: 'Fog', blurb: 'Thick fog hides the trail ahead. Trust the jumps!', icon: 'cloud',
    params: { fog: 1 } },
  { id: 'giantwheels', name: 'Giant Wheels', blurb: 'Huge wheels that crush everything in the way.', icon: 'tire',
    params: { wheelMul: 1.6, crush: true } },
  { id: 'tailwind', name: 'Tailwind', blurb: 'The wind is behind you: 20% more top speed.', icon: 'wind',
    params: { topSpeedMul: 1.2 } },
  { id: 'mirror', name: 'Mirror', blurb: 'The whole trail backwards: the finish comes first!', icon: 'mirror',
    params: { mirror: true } },
  { id: 'rubber', name: 'Rubber', blurb: 'Bouncy tires: every landing springs you back up.', icon: 'ball',
    params: { bounce: 2 } },
];
export const MUTATOR_BY_ID = Object.fromEntries(MUTATORS.map((m) => [m.id, m]));

/** The mutator definition for an id (or a definition passed through); null when unknown / none. */
export function mutatorDef(idOrDef) {
  if (!idOrDef) return null;
  if (typeof idOrDef === 'object') return idOrDef.params ? idOrDef : { id: idOrDef.id || 'custom', name: idOrDef.name || 'Custom', params: idOrDef };
  return MUTATOR_BY_ID[idOrDef] || null;
}

/** The day's mutator for a day index (e.g. Math.floor(Date.now() / 864e5)); the app pairs it with a trail. */
export function dailyMutator(dayIndex) {
  const n = Math.abs(Math.floor(Number(dayIndex) || 0));
  return MUTATORS[(n * 7 + 3) % MUTATORS.length];
}

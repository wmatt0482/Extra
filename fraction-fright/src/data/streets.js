// The streets (SPEC §5): one per tier. 1.0 plays Maple Street and Oak Lane; the rest show as "coming soon".
// `boss` names the final wave's boss (SPEC §13.2). `look` goes to the engine (weather, landmark, hats: novelty across streets; difficulty rises through the math only).
export const STREETS = Object.freeze([
  { id: 'maple', tier: 'T1', name: 'Maple Street', blurb: 'Halves and quarters', sky: ['#0c0b14', '#3a2430', '#8a3a14'], look: { weather: 'bats', landmark: 'maple', hats: ['cap', 'beanie'] }, boss: 'Mayor Mumbles', playable: true },
  { id: 'oak', tier: 'T2', name: 'Oak Lane', blurb: 'Thirds, sixths, eighths and more', sky: ['#0b1014', '#22303a', '#5a5a3a'], look: { weather: 'fog', landmark: 'oak', hats: ['top', 'party'] }, boss: 'Coach Groan', playable: true },
  { id: 'twin', tier: 'T3', name: 'Twin Alley', blurb: 'Which is bigger?', playable: false },
  { id: 'sum', tier: 'T4', name: 'Sum Street', blurb: 'Add the pieces', playable: false },
  { id: 'decimal', tier: 'T5', name: 'Decimal Drive', blurb: 'Tenths and hundredths', playable: false },
  { id: 'pumpkin', tier: 'T6', name: 'Pumpkin Hill', blurb: 'Past 1', playable: false },
]);
export const STREET_BY_ID = Object.freeze(Object.fromEntries(STREETS.map((s) => [s.id, s])));
export const streetOfTier = (tier) => STREETS.find((s) => s.tier === tier) || null;

// Arcs group cases into tours. `map` says which map draws the tour: 'ny' (the New York State box) or 'usa' (the USA box).
export const ARCS = [
  {
    id: 'ny',
    map: 'ny',
    title: 'The New York Tour',
    blurb: 'The Scribble Gang is swiping letters off famous signs all over New York State. Follow the clues from Niagara Falls to New York City and get every letter back.',
    cases: ['ny-01', 'ny-02', 'ny-03', 'ny-04', 'ny-05', 'ny-06'],
  },
  {
    id: 'usa',
    map: 'usa',
    title: 'The USA Tour',
    blurb: 'Scrabble just bought a map of the whole country. Now the Scribble Gang is swiping letters from signs from coast to coast. Fly across the country, follow the clues, and get every letter back.',
    cases: ['usa-01', 'usa-02', 'usa-03', 'usa-04', 'usa-05', 'usa-06'],
  },
];

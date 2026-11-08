// The six games, The Lab and the home page as the Games panel and the Lab home cards list them (lab/docs/COHESION.md). PURE DATA: no imports.
// `path` is a same-origin relative URL. `noun` is the word the per-game level label uses ("Speller LV 3"); `pitch` is the one line a never-played
// game shows on its card.
export const GAME_INFO = [
  { id: 'sj', name: 'Spell Jump', path: '/spell-jump/', noun: 'Speller', pitch: 'Spell words to jump your car down the road.' },
  { id: 'tb', name: 'Trail Blazer', path: '/trail-blazer/', noun: 'Rider', pitch: 'Race a bike where math facts open the gates.' },
  { id: 'ff', name: 'Fraction Fright', path: '/fraction-fright/', noun: 'Cure', pitch: 'Lob slime at fractions on a number-line road.' },
  { id: 'ww', name: 'Wagon West', path: '/wagon-west/', noun: 'Trail', pitch: 'Lead a wagon west and solve the trail problems.' },
  { id: 'bc', name: 'Build Crew', path: '/build-crew/', noun: 'Builder', pitch: 'Build machines and blueprints, block by block.' },
  { id: 'cf', name: 'Case Files', path: '/case-files/', noun: 'Detective', pitch: 'Read the clues and close a new case each day.' },
];
export const GAME_PATH = Object.freeze({ ...Object.fromEntries(GAME_INFO.map((g) => [g.id, g.path])), lab: '/lab/', home: '/' });

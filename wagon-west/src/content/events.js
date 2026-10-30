// Trail events (SPEC §3): the text and kind of each; src/journey/events.js decides when one fires (seeded, by biome,
// never two of the same kind in a leg) and what it does. kind: 'problem' (problem: 'parts' | 'fact') | 'rest' |
// 'bonus' (foodLb) | 'lookout' (animal) | 'trade' | 'hunt' | 'fish'. Content stream fills ~16 (two or three per kind).
export const EVENTS = [
  { id: 'wheel', name: 'A wheel comes off', biomes: null, kind: 'problem', problem: 'parts',
    text: 'Bump! A wheel comes off in a rut.', say: 'Bump! A wheel comes off in a rut.', fix: 'A quick fix and we roll on!' },
  { id: 'storm', name: 'A thunderstorm', biomes: ['prairie', 'bluffs'], kind: 'rest',
    text: 'Thunder rolls in. The party waits it out under the wagon cover and plays cards.', say: 'Thunder rolls in. The party waits it out under the wagon cover and plays cards.', fix: 'The sky clears.' },
  { id: 'berries', name: 'Wild berries', biomes: ['prairie', 'bluffs', 'mountains', 'valley'], kind: 'bonus', foodLb: 20,
    text: 'Rosa spots a patch of wild plums. Everyone picks.', say: 'Rosa spots a patch of wild plums. Everyone picks.', fix: 'Twenty pounds of plums!' },
  { id: 'bison', name: 'A bison herd', biomes: ['prairie', 'bluffs'], kind: 'lookout', animal: 'bison',
    text: 'A bison herd crosses the trail. The wagon waits and watches.', say: 'A bison herd crosses the trail. The wagon waits and watches.', fix: 'What a sight.' },
  { id: 'trade', name: 'A trading post', biomes: null, kind: 'trade',
    text: 'A trading post! Time to trade.', say: 'A trading post! Time to trade.', fix: 'A good trade.' },
  { id: 'hunt', name: 'Tracks', biomes: null, kind: 'hunt',
    text: 'Eli finds fresh tracks. Grab the bow.', say: 'Eli finds fresh tracks. Grab the bow.', fix: 'Supper!' },
  { id: 'fish', name: 'A good fishing hole', biomes: ['prairie', 'mountains', 'gorge', 'valley'], kind: 'fish',
    text: 'A still pool by the trail. Get the line out.', say: 'A still pool by the trail. Get the line out.', fix: 'Fish for supper!' },
  { id: 'mud', name: 'Stuck in the mud', biomes: null, kind: 'problem', problem: 'fact',
    text: 'The wheels sink in a mud hole. Everyone pushes!', say: 'The wheels sink in a mud hole. Everyone pushes!', fix: 'And out it comes!' },
];
export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

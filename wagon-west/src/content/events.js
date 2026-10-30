// Trail events (SPEC §3): the text and kind of each; src/journey/events.js decides when one fires (seeded, by biome,
// never two of the same kind in a leg) and what it does. kind: 'problem' (problem: 'parts' | 'fact') | 'rest' |
// 'bonus' (foodLb) | 'lookout' (animal) | 'trade' | 'hunt' | 'fish'. 21 events: every kind has two or more, and every
// biome (prairie, bluffs, highdesert, mountains, gorge, valley) has at least one event of five different kinds, so
// the "never two of the same kind in a leg" rule can always be met. No event names a companion (the party picks three of
// eight, so a name could be absent); `say` has no digits. Nobody is ever hurt or sick: wagons get stuck, people get tired.
export const EVENTS = [
  // problem / parts: the wagon needs fixing (a "parts" word problem frees it)
  { id: 'wheel', name: 'A wheel comes off', biomes: null, kind: 'problem', problem: 'parts',
    text: 'Bump! A wheel comes off in a rut.', say: 'Bump! A wheel comes off in a rut.', fix: 'A quick fix and we roll on!' },
  { id: 'bolts', name: 'Loose bolts', biomes: null, kind: 'problem', problem: 'parts',
    text: 'Rattle, rattle! The wagon bounces so hard that some bolts shake loose.', say: 'Rattle, rattle! The wagon bounces so hard that some bolts shake loose.', fix: 'Tighten them up and off we go!' },
  // problem / fact: stuck, and a times-table fact pulls the wagon out
  { id: 'mud', name: 'Stuck in the mud', biomes: ['prairie', 'bluffs', 'mountains', 'gorge', 'valley'], kind: 'problem', problem: 'fact',
    text: 'The wheels sink in a mud hole. Everyone pushes!', say: 'The wheels sink in a mud hole. Everyone pushes!', fix: 'And out it comes!' },
  { id: 'sand', name: 'Soft sand', biomes: ['highdesert', 'bluffs'], kind: 'problem', problem: 'fact',
    text: 'The wheels sink into deep, soft sand. Everyone pushes!', say: 'The wheels sink into deep, soft sand. Everyone pushes!', fix: 'Out we roll!' },
  // rest: the party waits a day and plays a quick game
  { id: 'storm', name: 'A thunderstorm', biomes: ['prairie', 'bluffs'], kind: 'rest',
    text: 'Thunder rolls in. The party waits it out under the wagon cover and plays cards.', say: 'Thunder rolls in. The party waits it out under the wagon cover and plays cards.', fix: 'The sky clears.' },
  { id: 'frost', name: 'A frosty morning', biomes: ['mountains', 'highdesert'], kind: 'rest',
    text: 'A frosty morning! The party stays wrapped in blankets by the fire until the sun warms the trail.', say: 'A frosty morning! The party stays wrapped in blankets by the fire until the sun warms the trail.', fix: 'The sun comes up and we roll on.' },
  { id: 'drizzle', name: 'A rainy day', biomes: ['gorge', 'valley'], kind: 'rest',
    text: 'Soft rain falls all day. The party waits under the wagon cover and tells stories.', say: 'Soft rain falls all day. The party waits under the wagon cover and tells stories.', fix: 'The rain stops.' },
  // bonus: free food
  { id: 'berries', name: 'Wild berries', biomes: ['prairie', 'bluffs', 'mountains', 'gorge', 'valley'], kind: 'bonus', foodLb: 20,
    text: 'The party spots a patch of wild plums. Everyone picks.', say: 'The party spots a patch of wild plums. Everyone picks.', fix: 'Twenty pounds of plums!' },
  { id: 'onions', name: 'Wild onions', biomes: ['prairie', 'bluffs', 'highdesert'], kind: 'bonus', foodLb: 15,
    text: 'Someone spots wild onions growing in the grass. Everyone digs a few.', say: 'Someone spots wild onions growing in the grass. Everyone digs a few.', fix: 'Fifteen pounds of wild onions!' },
  { id: 'hazelnuts', name: 'Hazelnuts', biomes: ['mountains', 'gorge', 'valley'], kind: 'bonus', foodLb: 25,
    text: 'Hazel bushes hang full of nuts beside the trail. Everyone fills a bag.', say: 'Hazel bushes hang full of nuts beside the trail. Everyone fills a bag.', fix: 'Twenty-five pounds of hazelnuts!' },
  // lookout: an animal to spot (the scene shows it; a free fact is read aloud)
  { id: 'bison', name: 'A bison herd', biomes: ['prairie', 'bluffs'], kind: 'lookout', animal: 'bison',
    text: 'A bison herd crosses the trail. The wagon waits and watches.', say: 'A bison herd crosses the trail. The wagon waits and watches.', fix: 'What a sight.' },
  { id: 'pronghorn', name: 'Pronghorn', biomes: ['prairie', 'bluffs', 'highdesert'], kind: 'lookout', animal: 'pronghorn',
    text: 'A small herd of pronghorn bounds across the plain. The wagon stops to watch.', say: 'A small herd of pronghorn bounds across the plain. The wagon stops to watch.', fix: 'The fastest land animal in North America!' },
  { id: 'coyote', name: 'A coyote at dusk', biomes: null, kind: 'lookout', animal: 'coyote',
    text: 'At dusk a coyote trots along a ridge and sings to the sky. The party stops to listen.', say: 'At dusk a coyote trots along a ridge and sings to the sky. The party stops to listen.', fix: 'What a song!' },
  { id: 'eagle', name: 'An eagle overhead', biomes: ['mountains', 'gorge', 'valley', 'highdesert'], kind: 'lookout', animal: 'eagle',
    text: 'A big eagle circles high above the wagon. Everyone stops to look up.', say: 'A big eagle circles high above the wagon. Everyone stops to look up.', fix: 'It soars away over the hills.' },
  // trade: a trading scene with the nation of the leg (nations.js)
  { id: 'trade', name: 'A trading post', biomes: null, kind: 'trade',
    text: 'A trading post! Time to trade.', say: 'A trading post! Time to trade.', fix: 'A good trade.' },
  { id: 'swap', name: 'A trading camp', biomes: null, kind: 'trade',
    text: 'A friendly camp invites the party to trade. Time to swap goods fairly.', say: 'A friendly camp invites the party to trade. Time to swap goods fairly.', fix: 'A fair swap for everyone.' },
  // hunt: the cartoon bow scene
  { id: 'hunt', name: 'Tracks', biomes: null, kind: 'hunt',
    text: 'Fresh tracks in the grass! Grab the bow.', say: 'Fresh tracks in the grass! Grab the bow.', fix: 'Supper!' },
  { id: 'deer', name: 'Deer in the pines', biomes: ['bluffs', 'mountains', 'gorge', 'valley'], kind: 'hunt',
    text: 'A deer steps out of the trees. Quietly now. Grab the bow.', say: 'A deer steps out of the trees. Quietly now. Grab the bow.', fix: 'Supper!' },
  // fish: the timing-tap scene
  { id: 'fish', name: 'A good fishing hole', biomes: ['prairie', 'mountains', 'gorge', 'valley'], kind: 'fish',
    text: 'A still pool by the trail. Get the line out.', say: 'A still pool by the trail. Get the line out.', fix: 'Fish for supper!' },
  { id: 'trout', name: 'Trout in the creek', biomes: ['bluffs', 'highdesert', 'mountains'], kind: 'fish',
    text: 'A cold, clear creek full of trout. Get the line out.', say: 'A cold, clear creek full of trout. Get the line out.', fix: 'Trout for supper!' },
  { id: 'salmon', name: 'Salmon in the river', biomes: ['gorge', 'valley'], kind: 'fish',
    text: 'Silver salmon flash in the river. Get the line out.', say: 'Silver salmon flash in the river. Get the line out.', fix: 'Salmon for supper!' },
];
export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

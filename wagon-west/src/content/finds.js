// What the dog brings back, and the wishes (SPEC v1.4 §2.1). Pure data: the journey draws from FINDS by biome and weight
// (journey/dog.js drawFind / recordFind) and the app shows `text` in the find pop and the journal's Finds page (a sketchbook:
// one drawing per kind). `say` is the spoken form (numbers in words, no abbreviations); no line names the dog (a line that
// names the dog is a DOG_LINES template in moments.js).
//
//   { id, name, emoji, keep, biomes, weight, text, say, source?, goods?, effect?, rare? }
//   keep   'keep'   goes into the sketchbook (and the wagon, where `goods` says so)
//          'sketch' drawn in the journal and left where it lay (a Native artifact is never kept by the game)
//          'use'    used tonight (`effect`)
//          'bait'   the shiny spoon (a fishing bait, `goods: 'spoon'`)
//   biomes null = every biome; weight = the relative chance among the finds a biome allows; effect { spirit?, skips? }
//   source   the fact-bearing finds (the ox shoe, the magpie feather, the arrowhead, the buffalo chip) point at docs/SOURCES.md.
// Kid rules (SPEC §1): nothing sad or scary; the other five finds state nothing about the trail and need no source.
export const FINDS = [
  { id: 'horseshoe', name: 'An old horseshoe', emoji: '🐴', keep: 'keep', goods: 'horseshoes', biomes: null, weight: 3,
    text: 'An old horseshoe! The blacksmith at the next fort will buy the iron.',
    say: 'An old horseshoe! The blacksmith at the next fort will buy the iron.' },
  { id: 'ox-shoe', name: 'A tiny ox shoe', emoji: '🐂', keep: 'keep', biomes: ['prairie', 'bluffs', 'highdesert', 'mountains'], weight: 2,
    text: 'A tiny iron ox shoe. An ox has a split hoof, so it wears two little shoes on each foot.',
    say: 'A tiny iron ox shoe. An ox has a split hoof, so it wears two little shoes on each foot.',
    source: 'SOURCES.md#find-ox-shoe' },
  { id: 'magpie-feather', name: 'A magpie feather', emoji: '🪶', keep: 'keep', biomes: ['bluffs', 'highdesert', 'mountains'], weight: 2,
    text: 'A long black-and-white magpie feather. Magpies are clever birds in the crow family.',
    say: 'A long black-and-white magpie feather. Magpies are clever birds in the crow family.',
    source: 'SOURCES.md#find-magpie-feather' },
  { id: 'hawk-feather', name: 'A hawk feather', emoji: '🪶', keep: 'keep', biomes: ['prairie', 'bluffs', 'highdesert'], weight: 2,
    text: 'A soft brown hawk feather with stripes across it.',
    say: 'A soft brown hawk feather with stripes across it.' },
  { id: 'arrowhead', name: 'A stone arrowhead', emoji: '🔺', keep: 'sketch', biomes: ['prairie', 'bluffs', 'highdesert'], weight: 1,
    text: 'A stone arrowhead, shaped by hand long ago by Native people. The party sketches it in the journal and leaves it right where it lay: it belongs to the history of this land.',
    say: 'A stone arrowhead, shaped by hand long ago by Native people. The party sketches it in the journal and leaves it right where it lay: it belongs to the history of this land.',
    source: 'SOURCES.md#find-arrowhead' },
  { id: 'buffalo-chip', name: 'A buffalo chip', emoji: '🟤', keep: 'use', effect: { spirit: 5 }, biomes: ['prairie', 'bluffs'], weight: 2,
    text: 'A dried buffalo chip! Where there was no wood, travelers burned buffalo chips to cook supper. Tonight it warms the campfire.',
    say: 'A dried buffalo chip! Where there was no wood, travelers burned buffalo chips to cook supper. Tonight it warms the campfire.',
    source: 'SOURCES.md#find-buffalo-chip' },
  { id: 'flat-stone', name: 'A flat skipping stone', emoji: '🪨', keep: 'keep', effect: { skips: 2 }, biomes: null, weight: 2,
    text: 'A perfect flat stone, just right for skipping on the next river.',
    say: 'A perfect flat stone, just right for skipping on the next river.' },
  { id: 'pinecone', name: 'A pinecone', emoji: '🌲', keep: 'keep', biomes: ['mountains', 'gorge', 'valley'], weight: 2,
    text: 'A big, sticky pinecone that smells like the forest.',
    say: 'A big, sticky pinecone that smells like the forest.' },
  { id: 'spoon', name: 'A shiny fishing spoon', emoji: '🥄', keep: 'bait', goods: 'spoon', biomes: null, weight: 0.3, rare: true,
    text: 'A shiny fishing spoon! It flashes in the water, and big fish love to chase it.',
    say: 'A shiny fishing spoon! It flashes in the water, and big fish love to chase it.' },
];
export const FIND_BY_ID = Object.fromEntries(FINDS.map((f) => [f.id, f]));

// Twelve wishes (the meteor shower: a tap on a falling star makes one; kept on the Finds page). Kid-safe and funny; no wish
// is about anyone being ill, gone or hurt. `say` = text (no digits in any of them).
const W = (id, text) => ({ id, text, say: text });
export const WISHES = [
  W('oxen-fly', 'I wish the oxen could fly.'),
  W('apple-pie-rain', 'I wish it would rain apple pie.'),
  W('wagon-boat', 'I wish the wagon could turn into a boat on every river.'),
  W('dog-talk', 'I wish the dog could talk, just for one day.'),
  W('cloud-bed', 'I wish I could sleep on a soft, fluffy cloud.'),
  W('mud-pudding', 'I wish the mud holes were full of chocolate pudding.'),
  W('dry-boots', 'I wish my boots would never get wet.'),
  W('wildflowers', 'I wish the whole trail were covered in wildflowers.'),
  W('cinnamon-toast', 'I wish every campfire made the best cinnamon toast.'),
  W('coyote-talk', 'I wish I could sing along with the coyotes.'),
  W('big-fish', 'I wish I could catch a fish as big as the wagon.'),
  W('second-dessert', 'I wish for a second helping of dessert tonight.'),
];
export const WISH_BY_ID = Object.fromEntries(WISHES.map((w) => [w.id, w]));

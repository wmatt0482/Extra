// The trail cards (SPEC v1.1 §3): a collection of 40 cards in four suits, shown in the Journal's "Cards" page. Each card
// is a picture (an emoji, drawn on a card face by the UI: no new art) and one true line a 4th grader can read. The
// suits: the twelve landmarks (id = the leg id, so a lookout drops its card), the eight nations (id = the nation id,
// dropped at a trading post), twelve animals and plants of the trail (dropped by a spotted animal, a hunt or a catch,
// berries and every arrival) and the eight companions (id = the companion id, dropped by a line at camp). The landmark
// and nation lines are one-line cuts of the lookouts and trading-post facts; the wild cards are new and sourced in
// docs/SOURCES.md ("Trail cards"); the companions are story characters, so they carry no source.
// Shape: { id, suit, name, emoji, fact, say, source? } and, for the wild suit, `biomes` (the legs' biomes where it is
// seen: journey/sim.js cardForLeg draws from the leg's biome). `say` is the spoken line (numbers as words, no
// abbreviations). Kid rules (SPEC §1): no death, illness or weapons in any line; the rattlesnake is named only as
// "give it room".
export const SUITS = ['landmark', 'nation', 'wild', 'companion'];
export const SUIT_NAMES = { landmark: 'Landmarks', nation: 'Nations', wild: 'Trail wildlife and plants', companion: 'Companions' };

const L = (id, name, emoji, fact, say) => ({ id, suit: 'landmark', name, emoji, fact, say: say || fact, source: `SOURCES.md#${id}` });
const N = (id, name, emoji, fact, say) => ({ id, suit: 'nation', name, emoji, fact, say: say || fact, source: `SOURCES.md#${id}` });
const W = (id, name, emoji, biomes, fact, say) => ({ id, suit: 'wild', name, emoji, biomes, fact, say: say || fact, source: `SOURCES.md#card-${id}` });
const C = (id, name, emoji, fact) => ({ id, suit: 'companion', name, emoji, fact, say: fact });

export const CARDS = [
  // ---- landmarks (12): id = the leg id ----
  L('kansas-river', 'Kansas River', '🌊', 'Local families ran ferries here that carried wagons across for a fee.'),
  L('fort-kearny', 'Fort Kearny', '🏕️', 'Fort Kearny was built in 1848, with a blacksmith shop for wagon repairs, and travelers could send letters home from there.',
    'Fort Kearny was built in eighteen forty-eight, with a blacksmith shop for wagon repairs, and travelers could send letters home from there.'),
  L('chimney-rock', 'Chimney Rock', '🗻', 'Chimney Rock rises hundreds of feet above the valley, and travelers could spot it from miles away.',
    'Chimney Rock rises hundreds of feet above the valley, and travelers could spot it from miles away.'),
  L('fort-laramie', 'Fort Laramie', '🏰', 'Fort Laramie began in 1834 as a trading post for furs and bison robes.',
    'Fort Laramie began in eighteen thirty-four as a trading post for furs and bison robes.'),
  L('independence-rock', 'Independence Rock', '🪨', 'Travelers carved or painted their names on Independence Rock, and some of the names can still be seen today.'),
  L('south-pass', 'South Pass', '⛰️', 'South Pass is a wide, gentle gap in the Rocky Mountains, more than 7,000 feet above sea level.',
    'South Pass is a wide, gentle gap in the Rocky Mountains, more than seven thousand feet above sea level.'),
  L('fort-bridger', 'Fort Bridger', '🛖', 'Jim Bridger and Louis Vasquez started Fort Bridger in 1843 as a trading post.',
    'Jim Bridger and Louis Vasquez started Fort Bridger in eighteen forty-three as a trading post.'),
  L('fort-hall', 'Fort Hall', '🚩', 'Near Soda Springs, travelers tasted fizzy, bubbly water that came right out of the ground.'),
  L('snake-river', 'Snake River', '🏝️', 'At Three Island Crossing, wagon parties could wade across the Snake River by going from island to island.'),
  L('blue-mountains', 'Blue Mountains', '🌲', 'In the Blue Mountains, the cool shade of the pine forests felt wonderful after miles of hot, dry travel.'),
  L('the-dalles', 'The Dalles', '🛶', 'At The Dalles the Columbia River squeezes through a narrow channel.'),
  L('willamette-valley', 'Willamette Valley', '🏡', 'The Willamette Valley has rich soil, which is why so many families came here to farm.'),

  // ---- nations (8): id = the nation id ----
  N('kansa', 'Kansa', '🌾', 'The Kansas River is named for the Kansa people, and the Kaw Nation is based in Oklahoma today.'),
  N('pawnee', 'Pawnee', '🌽', 'The Pawnee grew corn, beans and squash in villages along the rivers of what is now Nebraska.'),
  N('lakota', 'Lakota', '🦬', 'Bison are a big part of the history and way of life of the Lakota, people of the northern Great Plains.'),
  N('shoshone', 'Shoshone', '🏔️', 'The Shoshone homeland includes parts of what is now Wyoming, Idaho, Utah and Nevada.'),
  N('bannock', 'Bannock', '🏕️', 'The Bannock people traveled far across the mountains each year to hunt bison.'),
  N('nez-perce', 'Nez Perce', '🪶', 'The Nez Perce call themselves Nimiipuu, which means the people.'),
  N('cayuse', 'Cayuse', '🐎', 'The Cayuse were so well known for their horses that cayuse became a word for a pony in the West.'),
  N('chinook', 'Chinook', '🛶', 'Chinookan peoples were famous traders who traveled the Columbia River by canoe.'),

  // ---- animals and plants of the trail (12) ----
  W('bison', 'Bison', '🦬', ['prairie', 'bluffs'],
    'Bison are the biggest land animals in North America, and they can run about 35 miles an hour.',
    'Bison are the biggest land animals in North America, and they can run about thirty-five miles an hour.'),
  W('pronghorn', 'Pronghorn', '🐐', ['prairie', 'bluffs', 'highdesert'],
    'The pronghorn is the fastest land animal in North America, sprinting up to about 55 miles an hour.',
    'The pronghorn is the fastest land animal in North America, sprinting up to about fifty-five miles an hour.'),
  W('coyote', 'Coyote', '🐺', ['prairie', 'bluffs', 'highdesert', 'mountains'],
    'Coyotes call to each other with howls and yips, and they live in deserts, prairies and mountains.'),
  W('bald-eagle', 'Bald eagle', '🦅', ['mountains', 'gorge', 'valley'],
    "A bald eagle's wings stretch six to seven feet from tip to tip, and it snatches fish from the water with its feet."),
  W('prairie-dog', 'Prairie dog', '🐿️', ['prairie', 'bluffs'],
    'Prairie dogs live in underground towns and warn each other with barks, but they are really ground squirrels.'),
  W('rattlesnake', 'Rattlesnake', '🐍', ['bluffs', 'highdesert'],
    'Rattlesnake: give it room.'),
  W('sagebrush', 'Sagebrush', '🌿', ['highdesert', 'mountains'],
    'Sagebrush is a gray-green shrub of the dry West, and its leaves smell sharp and spicy when you rub them.'),
  W('wild-plum', 'Wild plum', '🍑', ['prairie', 'bluffs'],
    'Wild plum trees grow in thickets on the prairie, and their small fruit ripens in late summer.'),
  W('camas', 'Camas', '🌸', ['highdesert', 'mountains', 'valley'],
    'Camas has pretty blue flowers, and its bulb is a food that Native peoples of the Northwest have cooked in earth ovens for generations.'),
  W('salmon', 'Salmon', '🐟', ['gorge', 'valley'],
    'Salmon hatch in rivers, swim out to the ocean, and then swim back upstream to the river where they were born.'),
  W('mule-deer', 'Mule deer', '🦌', ['bluffs', 'highdesert', 'mountains', 'gorge'],
    "Mule deer are named for their big ears, which look like a mule's."),
  W('jackrabbit', 'Jackrabbit', '🐇', ['prairie', 'highdesert'],
    'A jackrabbit is really a hare, and its long ears help it hear far away and stay cool.'),

  // ---- companions (8): id = the companion id (the lines come from the companions' own trail chatter) ----
  C('blacksmith', 'Ada the blacksmith', '🔨', 'Ada can fix any wheel on the trail with a hammer and a campfire.'),
  C('teacher', 'Nora the schoolteacher', '📚', 'Nora quizzes everybody on spelling while they walk beside the wagon.'),
  C('fiddler', 'Jasper the fiddler', '🎻', 'Jasper says the oxen walk faster when he plays, and he has tested it.'),
  C('scout', 'Eli the scout', '🧭', 'Eli rides ahead of the wagon to look for the easy way around.'),
  C('cook', 'Rosa the cook', '🍳', 'Rosa says the secret ingredient is always more butter.'),
  C('doctor', 'Mabel the doctor', '🩺', 'Mabel knows every bird on the trail by its song.'),
  C('carpenter', 'Tomas the carpenter', '🪚', 'Tomas says to measure twice and cut once, and he could build a bridge, a barn or a bench.'),
  C('storyteller', 'Ines the storyteller', '📖', 'Ines says every rock out here has a story, and she knows how to find it.'),
];
export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));
/** The cards of one suit, in album order. */
export const cardsOf = (suit) => CARDS.filter((c) => c.suit === suit);

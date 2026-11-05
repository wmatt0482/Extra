// The trail cards (SPEC v1.1 §3, v1.4 §2.6, v1.5 §2.8): a collection of 126 cards in seven suits, shown in the Journal's "Cards" page. Each
// card is a picture (an emoji, drawn on a card face by the UI: no new art) and one true line a 4th grader can read. The
// suits: the 45 landmarks (id = the leg id of every route, so a lookout drops its card), the 19 nations (id = the nation id, dropped at
// a trading post), 28 animals and plants of the trail (dropped by a spotted animal, a hunt or a catch, berries and every arrival; each has
// `biomes`), the 10 companions (id = the companion id, dropped by a line at camp), the 6 fish of v1.4, the 8 trail tales of v1.4 and (new in
// v1.5) the 10 cards of the gold rush. The landmark and nation lines are one-line cuts of the lookouts and trading-post facts; the wild and
// gold cards are sourced in docs/SOURCES.md ("Trail cards" and "The Long Trail (v1.5)"); the companions are story characters, so they carry
// no source. Shape: { id, suit, name, emoji, fact, say, source? } and, for the wild suit, `biomes` (the legs' biomes where it is seen:
// journey/sim.js cardForLeg draws from the leg's biome). `say` is the spoken line (numbers as words, no abbreviations). Kid rules
// (SPEC section 1): no death, illness or weapons in any line; the rattlesnake is named only as "give it room"; the gold rush is a journey
// and a craze.
//
// FLAGGED FOR THE OWNER'S READ (SPEC v1.5 sections 1 and 8): the gold cards 'who-got-rich' (most miners found only a little gold; many of
// the people who got rich were the storekeepers) and 'gold-fever' (the gentle line on what the rush meant for California's Native nations,
// worded as section 8 proposes).
export const SUITS = ['landmark', 'nation', 'wild', 'companion', 'river', 'tales', 'gold'];
export const SUIT_NAMES = { landmark: 'Landmarks', nation: 'Nations', wild: 'Trail wildlife and plants', companion: 'Companions',
  river: 'Fish of the trail', tales: 'Trail tales', gold: 'The gold rush' };

const L = (id, name, emoji, fact, say) => ({ id, suit: 'landmark', name, emoji, fact, say: say || fact, source: `SOURCES.md#${id}` });
const N = (id, name, emoji, fact, say) => ({ id, suit: 'nation', name, emoji, fact, say: say || fact, source: `SOURCES.md#${id}` });
const W = (id, name, emoji, biomes, fact, say) => ({ id, suit: 'wild', name, emoji, biomes, fact, say: say || fact, source: `SOURCES.md#card-${id}` });
const C = (id, name, emoji, fact) => ({ id, suit: 'companion', name, emoji, fact, say: fact });
const R = (id, name, emoji, fact, say) => ({ id, suit: 'river', name, emoji, fact, say: say || fact, source: `SOURCES.md#fish-${id}` });
const T = (id, name, emoji, fact, say) => ({ id, suit: 'tales', name, emoji, fact, say: say || fact, source: `SOURCES.md#fact-${id}` });
const Q = (id, name, emoji, fact) => ({ id, suit: 'tales', name, emoji, fact, say: fact });   // a quest card: a story, no source
const G = (id, name, emoji, fact, say) => ({ id, suit: 'gold', name, emoji, fact, say: say || fact, source: `SOURCES.md#card-${id}` });

export const CARDS = [
  // ---- landmarks (45): id = the leg id, in the order of ALL_LEGS (the emigrant trail, the branches, California, the Gold Road) ----
  L('kansas-river', 'Kansas River', '🌊', 'Local families ran ferries here that carried wagons across for a fee.'),
  L('alcove-spring', 'Alcove Spring', '💧', 'A spring falls over a rock ledge at Alcove Spring, and travelers carved their names in the rock. Some carvings from 1846 can still be seen.',
    'A spring falls over a rock ledge at Alcove Spring, and travelers carved their names in the rock. Some carvings from eighteen forty-six can still be seen.'),
  L('fort-kearny', 'Fort Kearny', '🏕️', 'Fort Kearny was built in 1848, with a blacksmith shop for wagon repairs, and travelers could send letters home from there.',
    'Fort Kearny was built in eighteen forty-eight, with a blacksmith shop for wagon repairs, and travelers could send letters home from there.'),
  L('ash-hollow', 'Ash Hollow', '🌳', 'Ash Hollow is named for its ash trees and its sweet spring, and wagons came down steep Windlass Hill into it.'),
  L('chimney-rock', 'Chimney Rock', '🗻', 'Chimney Rock rises hundreds of feet above the valley, and travelers could spot it from miles away.',
    'Chimney Rock rises hundreds of feet above the valley, and travelers could spot it from miles away.'),
  L('scotts-bluff', 'Scotts Bluff', '⛰️', 'The bluffs of Scotts Bluff tower about 800 feet over the North Platte River, and wagons rolled through Mitchell Pass beside them.',
    'The bluffs of Scotts Bluff tower about eight hundred feet over the North Platte River, and wagons rolled through Mitchell Pass beside them.'),
  L('fort-laramie', 'Fort Laramie', '🏰', 'Fort Laramie began in 1834 as a trading post for furs and bison robes.',
    'Fort Laramie began in eighteen thirty-four as a trading post for furs and bison robes.'),
  L('north-platte', 'North Platte River', '⛴️', 'In June 1847 Mormon pioneers built a ferry near present-day Casper, Wyoming, to carry emigrant wagons over the North Platte for a fee.',
    'In June eighteen forty-seven Mormon pioneers built a ferry near present-day Casper, Wyoming, to carry emigrant wagons over the North Platte for a fee.'),
  L('independence-rock', 'Independence Rock', '🪨', 'Travelers carved or painted their names on Independence Rock, and some of the names can still be seen today.'),
  L('ice-slough', 'Ice Slough', '🧊', 'Under the boggy grass at Ice Slough, travelers dug down about a foot and found clear ice, even in July.'),
  L('south-pass', 'South Pass', '⛰️', 'South Pass is a wide, gentle gap in the Rocky Mountains, more than 7,000 feet above sea level.',
    'South Pass is a wide, gentle gap in the Rocky Mountains, more than seven thousand feet above sea level.'),
  L('green-river', 'Green River', '🟢', 'Fording the Green River was risky, so most travelers paid a ferry to carry their wagons across.'),
  L('fort-bridger', 'Fort Bridger', '🛖', 'Jim Bridger and Louis Vasquez started Fort Bridger in 1843 as a trading post.',
    'Jim Bridger and Louis Vasquez started Fort Bridger in eighteen forty-three as a trading post.'),
  L('soda-springs', 'Soda Springs', '🫧', 'At Soda Springs, travelers tasted fizzy, bubbly water that came right out of the ground.'),
  L('fort-hall', 'Fort Hall', '🚩', 'Wagons bound for Oregon and wagons bound for California shared the road as far as the Raft River.'),
  L('snake-river', 'Snake River', '🏝️', 'At Three Island Crossing, wagon parties could wade across the Snake River by going from island to island.'),
  L('farewell-bend', 'Farewell Bend', '👋', 'Farewell Bend was the last camp on the Snake River; from here the wagons said goodbye to the river and went overland.'),
  L('blue-mountains', 'Blue Mountains', '🌲', 'In the Blue Mountains, the cool shade of the pine forests felt wonderful after miles of hot, dry travel.'),
  L('the-dalles', 'The Dalles', '🛶', 'At The Dalles the Columbia River squeezes through a narrow channel.'),
  L('willamette-valley', 'Willamette Valley', '🏡', 'The Willamette Valley has rich soil, which is why so many families came here to farm.'),
  // the branches
  L('sublette-cutoff', 'Sublette Cutoff', '🏜️', 'The Sublette Cutoff opened in 1844 as a shorter way west from South Pass, but it crossed a long stretch with no water.',
    'The Sublette Cutoff opened in eighteen forty-four as a shorter way west from South Pass, but it crossed a long stretch with no water.'),
  L('bear-river', 'Bear River', '🐻', 'In the valley of the Bear River, the Sublette Cutoff and the old trail met again.'),
  L('lander-road', 'Lander Road', '🛣️', 'The Lander Road, built in 1858 and 1859, was one of the first roads the government built for emigrants.',
    'The Lander Road, built in eighteen fifty-eight and eighteen fifty-nine, was one of the first roads the government built for emigrants.'),
  L('barlow-road', 'Barlow Road', '🗻', 'The Barlow Road opened in 1846 as a toll road around Mount Hood, and the toll was five dollars a wagon.',
    'The Barlow Road opened in eighteen forty-six as a toll road around Mount Hood, and the toll was five dollars a wagon.'),
  // the California Trail
  L('raft-river', 'Raft River', '🪧', 'At the Raft River the trails parted: Oregon wagons kept going west, and California wagons turned south.'),
  L('city-of-rocks', 'City of Rocks', '🗿', 'Travelers wrote their names in axle grease on the granite at City of Rocks, and some names from 1849 can still be read.',
    'Travelers wrote their names in axle grease on the granite at City of Rocks, and some names from eighteen forty-nine can still be read.'),
  L('humboldt-wells', 'Humboldt Wells', '⛲', 'Humboldt Wells are springs at the head of the Humboldt River, the river the trail followed across what is now Nevada.'),
  L('humboldt-river', 'Humboldt River', '🌾', 'The Humboldt River gave wagons water, grass and willow wood across the Great Basin, though many travelers grumbled about it.'),
  L('big-meadows', 'Big Meadows', '🌱', 'Travelers named this green valley the Big Meadows and stopped for water and grass before the desert.'),
  L('forty-mile-desert', 'Forty-Mile Desert', '🛢️', 'Past the Humboldt Sink there was no water for about 40 miles, so wagon parties filled every barrel first.',
    'Past the Humboldt Sink there was no water for about forty miles, so wagon parties filled every barrel first.'),
  L('truckee-river', 'Truckee River', '💦', 'In 1844 a Northern Paiute guide the travelers called Truckee showed a wagon party the way to this river, and they named it for him.',
    'In eighteen forty-four a Northern Paiute guide the travelers called Truckee showed a wagon party the way to this river, and they named it for him.'),
  L('sierra-summit', 'Sierra Summit', '🏔️', 'In 1844 the first wagons crossed the Sierra Nevada, high in the granite, and reached the Sacramento Valley before winter.',
    'In eighteen forty-four the first wagons crossed the Sierra Nevada, high in the granite, and reached the Sacramento Valley before winter.'),
  L('sacramento-valley', 'Sacramento Valley', '🏡', 'John Sutter began his settlement in 1839, and it drew wagon parties down out of the mountains. Settlers came for farmland before anyone found gold.',
    'John Sutter began his settlement in eighteen thirty-nine, and it drew wagon parties down out of the mountains. Settlers came for farmland before anyone found gold.'),
  // the Gold Road
  L('calapooya-mountains', 'Calapooya Mountains', '⛰️', 'The mountains between the Willamette and Umpqua valleys are named for the Kalapuya people.'),
  L('umpqua-river', 'Umpqua River', '🌊', 'The Siskiyou Trail south grew out of Native footpaths through the river valleys, the Umpqua among them.'),
  L('canyon-creek', 'Canyon Creek', '🏞️', 'In 1846 wagons at Canyon Creek were often taken apart and let down the steep canyon on ropes.',
    'In eighteen forty-six wagons at Canyon Creek were often taken apart and let down the steep canyon on ropes.'),
  L('rogue-river', 'Rogue River', '🪨', 'The Table Rocks stand above the Rogue River valley, the heart of the Takelma homeland.'),
  L('siskiyou-pass', 'Siskiyou Pass', '🌲', 'Hudson’s Bay Company trappers crossed the Siskiyou pass in 1827, and most gold-rush travelers went with mule trains.',
    'Hudson’s Bay Company trappers crossed the Siskiyou pass in eighteen twenty-seven, and most gold-rush travelers went with mule trains.'),
  L('mount-shasta', 'Mount Shasta', '🌋', 'Mount Shasta is a volcano more than 14,000 feet tall, and its snowy top can be seen from far away.',
    'Mount Shasta is a volcano more than fourteen thousand feet tall, and its snowy top can be seen from far away.'),
  L('castle-crags', 'Castle Crags', '🏰', 'Granite spires like a castle’s towers rise beside the upper Sacramento River at Castle Crags.'),
  L('clear-creek', 'Clear Creek', '⛏️', 'In 1848 Pierson Reading and the Native workers with him found gold in Clear Creek, far north of Coloma.',
    'In eighteen forty-eight Pierson Reading and the Native workers with him found gold in Clear Creek, far north of Coloma.'),
  L('feather-river', 'Feather River', '🪶', 'In the summer of 1848 John Bidwell found gold on the Feather River, at what came to be called Bidwell’s Bar.',
    'In the summer of eighteen forty-eight John Bidwell found gold on the Feather River, at what came to be called Bidwell’s Bar.'),
  L('sutters-fort', 'Sutter’s Fort', '🏛️', 'Thousands of miners passed through Sutter’s Fort to buy supplies from its stores.'),
  L('coloma', 'Coloma', '✨', 'On January 24, 1848, James Marshall saw gold flakes at Sutter’s sawmill in Coloma. The Nisenan call this valley Cullumah.',
    'On January twenty-fourth, eighteen forty-eight, James Marshall saw gold flakes at Sutter’s sawmill in Coloma. The Nisenan call this valley Cullumah.'),
  L('home-by-sea', 'Home by Sea', '⛵', 'Many Oregonians sailed home from San Francisco with their gold, and in 1849 Oregon City made gold into Beaver money.',
    'Many Oregonians sailed home from San Francisco with their gold, and in eighteen forty-nine Oregon City made gold into Beaver money.'),

  // ---- nations (19): id = the nation id ----
  N('kansa', 'Kansa', '🌾', 'The Kansas River is named for the Kansa people, and the Kaw Nation is based in Oklahoma today.'),
  N('pawnee', 'Pawnee', '🌽', 'The Pawnee grew corn, beans and squash in villages along the rivers of what is now Nebraska.'),
  N('lakota', 'Lakota', '🦬', 'Bison are a big part of the history and way of life of the Lakota, people of the northern Great Plains.'),
  N('shoshone', 'Shoshone', '🏔️', 'The Shoshone homeland includes parts of what is now Wyoming, Idaho, Utah and Nevada.'),
  N('bannock', 'Bannock', '🏕️', 'The Bannock people traveled far across the mountains each year to hunt bison.'),
  N('nez-perce', 'Nez Perce', '🪶', 'The Nez Perce call themselves Nimiipuu, which means the people.'),
  N('cayuse', 'Cayuse', '🐎', 'The Cayuse were so well known for their horses that cayuse became a word for a pony in the West.'),
  N('chinook', 'Chinook', '🛶', 'Chinookan peoples were famous traders who traveled the Columbia River by canoe.'),
  N('kalapuya', 'Kalapuya', '🌼', 'The Kalapuya people cared for the prairies of the Willamette Valley with fire so that camas and other foods grew well.'),
  N('umpqua', 'Umpqua', '🐟', 'The Cow Creek Band of Umpqua Tribe of Indians takes its name from Cow Creek and is based in Roseburg, Oregon, today.'),
  N('takelma', 'Takelma', '🪨', 'Takelma means those who live along the river, and the Table Rocks are the heart of the Takelma homeland.'),
  N('shasta', 'Shasta', '🏔️', 'The Shasta homeland is along the Klamath River and at the foot of Mount Shasta, and Shasta people still live there today.'),
  N('wintu', 'Wintu', '🐟', 'Salmon are at the heart of Wintu life, and Wintu people are helping bring salmon back to the McCloud River today.'),
  N('maidu', 'Maidu', '🌰', 'The Maidu homeland includes the Feather River country, and the Mechoopda and Berry Creek tribes are Maidu tribes today.'),
  N('nisenan', 'Nisenan', '🌰', 'The Nisenan call the valley at Coloma Cullumah, and Nisenan people belong to the Shingle Springs Band of Miwok Indians today.'),
  N('miwok', 'Miwok', '🌲', 'Miwok homelands reach along the Sierra foothills south of the American River, and the Shingle Springs Band of Miwok Indians is in El Dorado County.'),
  N('newe', 'Western Shoshone', '🌵', 'The Western Shoshone call themselves Newe, and the Te-Moak Tribe of Western Shoshone has its headquarters in Elko, Nevada.'),
  N('numu', 'Northern Paiute', '🐟', 'The Northern Paiute homeland includes Pyramid Lake and the Truckee River, and the Pyramid Lake Paiute Tribe is there today.'),
  N('washoe', 'Washoe', '🏞️', 'Lake Tahoe, high in the Sierra Nevada, is the heart of the Washoe homeland.'),

  // ---- animals and plants of the trail (28): the twelve of 1.1 and sixteen new ----
  W('bison', 'Bison', '🦬', ['prairie', 'bluffs'],
    'Bison are the biggest land animals in North America, and they can run about 35 miles an hour.',
    'Bison are the biggest land animals in North America, and they can run about thirty-five miles an hour.'),
  W('pronghorn', 'Pronghorn', '🐐', ['prairie', 'bluffs', 'highdesert', 'basin'],
    'The pronghorn is the fastest land animal in North America, sprinting up to about 55 miles an hour.',
    'The pronghorn is the fastest land animal in North America, sprinting up to about fifty-five miles an hour.'),
  W('coyote', 'Coyote', '🐺', ['prairie', 'bluffs', 'highdesert', 'mountains', 'basin', 'goldcountry', 'siskiyou'],
    'Coyotes call to each other with howls and yips, and they live in deserts, prairies and mountains.'),
  W('bald-eagle', 'Bald eagle', '🦅', ['mountains', 'gorge', 'valley', 'siskiyou', 'sea'],
    "A bald eagle's wings stretch six to seven feet from tip to tip, and it snatches fish from the water with its feet."),
  W('prairie-dog', 'Prairie dog', '🐿️', ['prairie', 'bluffs'],
    'Prairie dogs live in underground towns and warn each other with barks, but they are really ground squirrels.'),
  W('rattlesnake', 'Rattlesnake', '🐍', ['bluffs', 'highdesert', 'basin'],
    'Rattlesnake: give it room.'),
  W('sagebrush', 'Sagebrush', '🌿', ['highdesert', 'mountains', 'basin'],
    'Sagebrush is a gray-green shrub of the dry West, and its leaves smell sharp and spicy when you rub them.'),
  W('wild-plum', 'Wild plum', '🍑', ['prairie', 'bluffs'],
    'Wild plum trees grow in thickets on the prairie, and their small fruit ripens in late summer.'),
  W('camas', 'Camas', '🌸', ['highdesert', 'mountains', 'valley', 'siskiyou'],
    'Camas has pretty blue flowers, and its bulb is a food that Native peoples of the Northwest have cooked in earth ovens for generations.'),
  W('salmon', 'Salmon', '🐟', ['gorge', 'valley', 'siskiyou', 'goldcountry', 'sea'],
    'Salmon hatch in rivers, swim out to the ocean, and then swim back upstream to the river where they were born.'),
  W('mule-deer', 'Mule deer', '🦌', ['bluffs', 'highdesert', 'mountains', 'gorge', 'basin', 'sierra', 'siskiyou', 'goldcountry'],
    "Mule deer are named for their big ears, which look like a mule's."),
  W('jackrabbit', 'Jackrabbit', '🐇', ['prairie', 'highdesert', 'basin'],
    'A jackrabbit is really a hare, and its long ears help it hear far away and stay cool.'),
  // new in v1.5 (the gold-country and basin animals and plants; sourced at SOURCES.md#card-<id>)
  W('beaver', 'Beaver', '🦫', ['valley', 'gorge', 'mountains', 'siskiyou', 'goldcountry', 'highdesert'],
    'Beavers build dams of sticks and mud, and they slap their big flat tails on the water to warn each other.'),
  W('sage-grouse', 'Sage-grouse', '🐔', ['highdesert', 'basin'],
    'Greater sage-grouse live only in sagebrush country, and in spring the males puff out their chests and strut to dance for the hens.'),
  W('western-meadowlark', 'Western meadowlark', '🐦', ['prairie', 'bluffs', 'valley', 'highdesert', 'goldcountry'],
    'The western meadowlark has a yellow chest and a flute-like song, and it is the state bird of Oregon, Kansas, Nebraska and Wyoming.'),
  W('pinyon-pine', 'Pinyon pine', '🌲', ['basin', 'highdesert', 'sierra'],
    'Pinyon pines grow on dry hillsides, and their cones hold big seeds called pine nuts, a food for people and birds.'),
  W('tule-elk', 'Tule elk', '🦌', ['goldcountry', 'basin'],
    'Tule elk live only in California, and they are the smallest kind of elk.'),
  W('valley-oak', 'Valley oak', '🌳', ['goldcountry', 'siskiyou', 'valley'],
    'Valley oaks are the biggest oaks in North America, and their acorns were an important food for the Native peoples of California.'),
  W('sugar-pine', 'Sugar pine', '🌲', ['sierra', 'siskiyou', 'mountains'],
    'The sugar pine grows the longest cones of any pine, sometimes more than a foot long.'),
  W('california-poppy', 'California poppy', '🌼', ['goldcountry', 'siskiyou', 'valley'],
    'The California poppy has bright orange petals, and it is the state flower of California.'),
  W('manzanita', 'Manzanita', '🌿', ['sierra', 'goldcountry', 'siskiyou'],
    'Manzanita has smooth red-brown bark and tough little leaves, and its name is Spanish for little apple.'),
  W('osprey', 'Osprey', '🦅', ['gorge', 'valley', 'goldcountry', 'sea', 'basin'],
    'An osprey dives feet-first into the water to catch a fish, and it carries the fish home in its talons.'),
  W('pika', 'Pika', '🐹', ['sierra', 'mountains'],
    'Pikas are small relatives of rabbits that live high on rocky mountainsides and squeak to warn each other.'),
  W('oregon-grape', 'Oregon grape', '🍇', ['valley', 'siskiyou', 'mountains', 'gorge'],
    'Oregon grape is the state flower of Oregon, with holly-like leaves, yellow flowers and blue berries.'),
  W('river-otter', 'River otter', '🦦', ['valley', 'gorge', 'siskiyou', 'goldcountry', 'basin'],
    'River otters are playful swimmers with thick waterproof fur, and they slide down muddy banks into the water.'),
  W('mountain-quail', 'Mountain quail', '🐦', ['siskiyou', 'sierra', 'goldcountry'],
    'The mountain quail has a long straight plume on its head, and it walks through the brush more often than it flies.'),
  W('quaking-aspen', 'Quaking aspen', '🍂', ['mountains', 'sierra', 'highdesert'],
    'Quaking aspen leaves tremble in the slightest breeze, and a whole grove can grow from one set of roots.'),
  W('douglas-fir', 'Douglas-fir', '🌲', ['valley', 'siskiyou', 'gorge', 'mountains'],
    'The Douglas-fir is the state tree of Oregon, and it can grow taller than 200 feet.',
    'The Douglas-fir is the state tree of Oregon, and it can grow taller than two hundred feet.'),

  // ---- companions (10): id = the companion id (the lines come from the companions' own trail chatter) ----
  C('blacksmith', 'Ada the blacksmith', '🔨', 'Ada can fix any wheel on the trail with a hammer and a campfire.'),
  C('teacher', 'Nora the schoolteacher', '📚', 'Nora quizzes everybody on spelling while they walk beside the wagon.'),
  C('fiddler', 'Jasper the fiddler', '🎻', 'Jasper says the oxen walk faster when he plays, and he has tested it.'),
  C('scout', 'Eli the scout', '🧭', 'Eli rides ahead of the wagon to look for the easy way around.'),
  C('cook', 'Rosa the cook', '🍳', 'Rosa says the secret ingredient is always more butter.'),
  C('doctor', 'Mabel the doctor', '🩺', 'Mabel knows every bird on the trail by its song.'),
  C('carpenter', 'Tomas the carpenter', '🪚', 'Tomas says to measure twice and cut once, and he could build a bridge, a barn or a bench.'),
  C('storyteller', 'Ines the storyteller', '📖', 'Ines says every rock out here has a story, and she knows how to find it.'),
  C('packer', 'Mateo the mule packer', '🐴', 'Mateo says a pack mule can climb anywhere, and he always carries one more spare part.'),
  C('prospector', 'Hattie the prospector', '⛏️', 'Hattie reads a creek like a book, and she always knows where to swirl the pan.'),

  // ---- fish of the trail (6, v1.4): id = the species id (fish.js) ----
  R('channel-catfish', 'Channel catfish', '🐟', 'Channel catfish have whiskers that help them find food in muddy water, and the channel catfish is the state fish of Kansas.'),
  R('hornyhead-chub', 'Hornyhead chub', '🐟', 'Hornyhead chubs swam in the Sweetwater River in wagon-train days. They disappeared from it for a long time, and in 2020 scientists brought them back.',
    'Hornyhead chubs swam in the Sweetwater River in wagon-train days. They disappeared from it for a long time, and in twenty twenty scientists brought them back.'),
  R('cutthroat-trout', 'Cutthroat trout', '🐟', 'Cutthroat trout are named for the red-orange mark under their jaw, and they are native to the mountain streams west of South Pass.'),
  R('white-sturgeon', 'White sturgeon', '🐟', 'The white sturgeon is the biggest freshwater fish in North America, and it can live for more than 100 years.',
    'The white sturgeon is the biggest freshwater fish in North America, and it can live for more than one hundred years.'),
  R('redband-trout', 'Redband trout', '🐟', 'Redband trout are rainbow trout of the Columbia River country, with a rosy red stripe along each side.'),
  R('chinook-salmon', 'Chinook salmon', '🐟', 'Chinook salmon are the biggest of the Pacific salmon, and people also call them king salmon.'),
  // v1.7: five more fish of the trail's rivers (no number in any of them)
  R('mountain-whitefish', 'Mountain whitefish', '🐟', 'Mountain whitefish are native fish of cold western rivers, and they swim in the Snake River and the Bear River.'),
  R('northern-pikeminnow', 'Northern pikeminnow', '🐟', 'Northern pikeminnow are big native hunters of the Columbia River country, and they eat smaller fish.'),
  R('largescale-sucker', 'Largescale sucker', '🐟', 'The largescale sucker is a native fish of the Pacific Northwest, and in the Willamette River it is the most common native fish of all.'),
  R('green-sunfish', 'Green sunfish', '🐟', 'Green sunfish are a common native fish of Kansas and Nebraska, and in a small pond there can be so many that each one stays small.'),
  R('sacramento-perch', 'Sacramento perch', '🐟', 'The Sacramento perch is California’s only native sunfish, and it is the only sunfish that is native west of the Rocky Mountains.'),

  // ---- trail tales (8, v1.4): the six trail facts (id = the fact id) and the two quest cards ----
  T('far-off-crack', 'Far-off rifles', '🌄', 'In the 1870s, hide hunters took so many bison that the great herds nearly vanished. Today bison herds are growing again in parks and on tribal lands.',
    'In the eighteen seventies, hide hunters took so many bison that the great herds nearly vanished. Today bison herds are growing again in parks and on tribal lands.'),
  T('bison-thunder', 'Bison thunder', '⛈️', 'Bison herds on the plains numbered in the thousands, and a running herd makes the ground rumble like thunder.'),
  T('grizzly-ridge', 'A grizzly on the ridge', '🐻', 'Grizzly bears once roamed the Great Plains. Today, outside Alaska, most grizzlies in the United States live in the mountains of Wyoming, Montana, Idaho and Washington.'),
  T('wolf-song', 'Wolves singing', '🌕', 'Gray wolves once roamed the plains near the bison herds. In 1995 wolves were brought back to Yellowstone National Park, and they live there today.',
    'Gray wolves once roamed the plains near the bison herds. In nineteen ninety-five wolves were brought back to Yellowstone National Park, and they live there today.'),
  T('prairie-glow', 'A glow on the prairie', '🌅', 'Fire is part of the prairie. The grasses have deep roots, so after a fire they grow back green and fast.'),
  T('pronghorn-race', 'A pronghorn race', '💨', 'Pronghorn are built for long races: they can keep running at about 40 miles an hour for a long way, not just for a quick dash.',
    'Pronghorn are built for long races: they can keep running at about forty miles an hour for a long way, not just for a quick dash.'),
  Q('locket', "Molly's locket", '📿', 'You found Molly\'s locket by the Kansas River and gave it back to her at Fort Laramie.'),
  Q('marble', "Sam's marble", '🔵', "Sam's best blue marble, his thank-you for the note in a bottle."),

  // ---- the gold rush (10, new in v1.5): the tools, the gold and the craze, told as a journey (sourced at SOURCES.md#card-<id>) ----
  G('gold-pan', 'The gold pan', '🍳', 'A gold pan works because gold is heavier than sand: swirl it, and the gold sinks to the bottom.'),
  G('gold-rocker', 'The rocker', '🪣', 'A rocker is a wooden cradle that miners rocked while water poured through it, so the sand washed away and the gold stayed behind.'),
  G('gold-flake', 'A flake', '✨', 'Gold in a creek is mostly tiny flakes. In this game, ten flakes make one nugget.'),
  G('gold-nugget', 'A nugget', '🟡', 'A nugget is a lump of gold, and nuggets are rare, which is why finding one in the pan feels so special.'),
  G('sutters-mill', 'Sutter’s mill', '🪚', 'On January 24, 1848, James Marshall saw gold flakes in the water channel of Sutter’s sawmill at Coloma.',
    'On January twenty-fourth, eighteen forty-eight, James Marshall saw gold flakes in the water channel of Sutter’s sawmill at Coloma.'),
  G('who-got-rich', 'Who got rich?', '💰', 'Most miners found only a little gold, and many of the people who got rich were the storekeepers who sold them shovels, pans, flour and boots.'),
  G('gold-fever', 'Gold fever', '🤩', 'The miners rushed onto the homelands of California’s Native nations, and it was a very hard time for them. Those nations are still here today.'),
  G('gold-news', 'The news reaches Oregon', '📰', 'In the summer of 1848 a ship brought word to Oregon that gold had been found in California, and thousands of settlers headed south.',
    'In the summer of eighteen forty-eight a ship brought word to Oregon that gold had been found in California, and thousands of settlers headed south.'),
  G('schooner-home', 'The schooner home', '⛵', 'Many Oregonians came home from San Francisco by sea in a schooner, a fast sailing ship, and they carried their gold with them.'),
  G('beaver-money', 'Beaver money', '🦫', 'In 1849 a company in Oregon City made gold into five-dollar and ten-dollar coins with a beaver on them, called Beaver money.',
    'In eighteen forty-nine a company in Oregon City made gold into five-dollar and ten-dollar coins with a beaver on them, called Beaver money.'),
];
export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));
/** The cards of one suit, in album order. */
export const cardsOf = (suit) => CARDS.filter((c) => c.suit === suit);

// ---------------------------------------------------------------- sets and decorations (SPEC v1.5 §2.8)
// A full set unlocks a wagon decoration (`decor`, an id in DECOR; looks.js kind 'decor'), once (`save.setsDone`); two are worn at a time.
// `cards` may mix suits; a card may sit in more than one set. `say` is the line when the set is complete. No decoration copies a sacred
// or ceremonial object of any nation (the two nation sets give painted maps, not regalia).
const S = (id, name, cards, decor, say) => ({ id, name, cards, decor, say });
const GOLD_ROAD_LEGS = ['calapooya-mountains', 'umpqua-river', 'canyon-creek', 'rogue-river', 'siskiyou-pass', 'mount-shasta', 'castle-crags',
  'clear-creek', 'feather-river', 'sutters-fort', 'coloma', 'home-by-sea'];
export const CARD_SETS = [
  S('jumping-off', 'Jumping off', ['kansas-river', 'alcove-spring', 'fort-kearny', 'kansa', 'pawnee', 'wild-plum'], 'sunflower-cover',
    'A full set! A sunflower blooms on your wagon cover.'),
  S('platte-road', 'The Platte River road', ['ash-hollow', 'chimney-rock', 'scotts-bluff', 'fort-laramie', 'north-platte', 'lakota'], 'pennant-chimney',
    'A full set! A Chimney Rock pennant flies from your wagon.'),
  S('divide', 'Over the Divide', ['independence-rock', 'ice-slough', 'south-pass', 'green-river', 'fort-bridger', 'shoshone'], 'flag-divide',
    'A full set! A Continental Divide flag waves from your wagon.'),
  S('snake-country', 'Snake River country', ['soda-springs', 'fort-hall', 'snake-river', 'farewell-bend', 'bannock', 'salmon'], 'weathervane-salmon',
    'A full set! A salmon weathervane turns on your wagon, and on your farm too.'),
  S('columbia', 'To the Columbia', ['blue-mountains', 'the-dalles', 'willamette-valley', 'nez-perce', 'cayuse', 'chinook'], 'paddle-canoe',
    'A full set! A canoe paddle hangs on your tailgate.'),
  S('shortcuts', 'Shortcuts', ['sublette-cutoff', 'bear-river', 'lander-road', 'barlow-road'], 'compass-trailblazer',
    'A full set! A trailblazer’s compass shines on your wagon.'),
  S('california-trail', 'The California Trail', ['raft-river', 'city-of-rocks', 'humboldt-wells', 'humboldt-river', 'big-meadows', 'forty-mile-desert',
    'truckee-river', 'sierra-summit', 'sacramento-valley'], 'lantern-sierra',
    'A full set! A Sierra lantern lights up your wagon.'),
  S('basin', 'Nations of the Great Basin', ['newe', 'numu', 'washoe', 'bannock', 'pinyon-pine', 'cutthroat-trout'], 'map-basin',
    'A full set! A guide’s map of the Great Basin is painted on your wagon cover.'),
  S('gold-road', 'The Gold Road', GOLD_ROAD_LEGS, 'trim-goldleaf',
    'A full set! Gold-leaf trim shines on your wagon wheels.'),
  S('gold-nations', 'Nations of the Gold Road', ['kalapuya', 'umpqua', 'takelma', 'shasta', 'wintu', 'maidu', 'nisenan', 'miwok'], 'map-valleys',
    'A full set! A map of the valleys is painted on your wagon cover.'),
  S('gold-fever', 'Gold fever', ['gold-pan', 'gold-rocker', 'gold-flake', 'gold-nugget', 'sutters-mill', 'who-got-rich', 'gold-fever', 'gold-news',
    'schooner-home', 'beaver-money'], 'bell-brass',
    'A full set! A brass bell rings on your wagon.'),
  S('plains-wild', 'Plains wildlife', ['bison', 'pronghorn', 'prairie-dog', 'coyote', 'jackrabbit', 'western-meadowlark'], 'meadowlark-seat',
    'A full set! A meadowlark sits on your seat back.'),
  S('mountain-wild', 'Mountains and high desert', ['mule-deer', 'bald-eagle', 'sage-grouse', 'pika', 'sagebrush', 'quaking-aspen'], 'aspen-leaves',
    'A full set! Aspen leaves flutter on your wagon cover.'),
  S('river-wild', 'Rivers', ['salmon', 'beaver', 'river-otter', 'osprey', 'camas', 'oregon-grape'], 'beaver-tailgate',
    'A full set! A beaver sits on your tailgate.'),
  S('california-wild', 'California hills', ['tule-elk', 'valley-oak', 'sugar-pine', 'california-poppy', 'manzanita', 'mountain-quail'], 'poppies-cover',
    'A full set! Poppies bloom on your wagon cover.'),
  S('crew', 'The whole crew', ['blacksmith', 'teacher', 'fiddler', 'scout', 'cook', 'doctor', 'carpenter', 'storyteller', 'packer', 'prospector'], 'nameplate-brass',
    'A full set! A brass name plate shines on your wagon.'),
];
export const SET_BY_ID = Object.fromEntries(CARD_SETS.map((s) => [s.id, s]));

// The decorations the sets unlock. `at`: where it is drawn: 'wagon' | 'farm' | 'both' (the weathervane also turns on the farm).
export const DECOR = [
  { id: 'sunflower-cover', name: 'Sunflower on the cover', emoji: '🌻', at: 'wagon' },
  { id: 'pennant-chimney', name: 'Chimney Rock pennant', emoji: '🚩', at: 'wagon' },
  { id: 'flag-divide', name: 'Continental Divide flag', emoji: '🏁', at: 'wagon' },
  { id: 'weathervane-salmon', name: 'Salmon weathervane', emoji: '🐟', at: 'both' },
  { id: 'paddle-canoe', name: 'Canoe paddle on the tailgate', emoji: '🛶', at: 'wagon' },
  { id: 'compass-trailblazer', name: 'Trailblazer’s compass', emoji: '🧭', at: 'wagon' },
  { id: 'lantern-sierra', name: 'Sierra lantern', emoji: '🏮', at: 'wagon' },
  { id: 'map-basin', name: 'Guide’s map on the cover', emoji: '🗺️', at: 'wagon' },
  { id: 'trim-goldleaf', name: 'Gold-leaf wheel trim', emoji: '✨', at: 'wagon' },
  { id: 'map-valleys', name: 'Map of the valleys on the cover', emoji: '🗺️', at: 'wagon' },
  { id: 'bell-brass', name: 'Brass bell', emoji: '🔔', at: 'wagon' },
  { id: 'meadowlark-seat', name: 'Meadowlark on the seat back', emoji: '🐦', at: 'wagon' },
  { id: 'aspen-leaves', name: 'Aspen leaves on the cover', emoji: '🍂', at: 'wagon' },
  { id: 'beaver-tailgate', name: 'Beaver on the tailgate', emoji: '🦫', at: 'wagon' },
  { id: 'poppies-cover', name: 'Poppies on the cover', emoji: '🌼', at: 'wagon' },
  { id: 'nameplate-brass', name: 'Brass name plate', emoji: '🏷️', at: 'wagon' },
];
export const DECOR_BY_ID = Object.fromEntries(DECOR.map((d) => [d.id, d]));

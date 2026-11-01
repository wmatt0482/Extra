// The Native nations whose homelands the trails cross, in trail order (SPEC §1, §9; v1.5 §2.5 adds eleven for the Gold Road and the California Trail): trading partners and guides,
// named as living peoples. Each has the trading post's fact (true, kid-level, present tense where true today, sourced
// in docs/SOURCES.md) and a trade the problem generator scales by season: rate is [give, get], so [3, 2] means
// 3 of the party's `give` goods for 2 of the nation's `get` goods. The party only ever gives pelts, blankets or rope
// (goods it can have); what it gets back is food. The trading post is a math scene: fair exchange and multiplication.
// `trade` is the nation's signature trade; `trades` lists it first and then the same food for the party's other goods, so
// sim.tradeOffer can ask for something the wagon really carries (a child with no blankets is offered pelts or rope).
// A parent's eye on the wording of the facts is welcome before it ships (SPEC §1); docs/SOURCES.md says where each is from.
// v1.5 nations are written with this helper (the same shape as the eight above): N(id, name, also, legs, factText, [[give, giveName, get, getName, rate], ...]);
// the first trade is the nation's signature `trade`, and `trades` lists all three. The fact is its own `say` (no digits).
const N = (id, name, also, legs, text, trades) => {
  const list = trades.map(([give, giveName, get, getName, rate]) => ({ give, giveName, get, getName, rate }));
  return { id, name, ...(also ? { also } : {}), legs, fact: { text, say: text }, trade: list[0], trades: list, source: `SOURCES.md#${id}` };
};
export const NATIONS = [
  { id: 'kansa', name: 'Kansa', also: 'Kaw Nation', legs: ['kansas-river'],
    fact: { text: 'The Kansa people lived along the Kansas River, which is named for them. Today the Kaw Nation is based in Oklahoma.',
      say: 'The Kansa people lived along the Kansas River, which is named for them. Today the Kaw Nation is based in Oklahoma.' },
    trade: { give: 'pelts', giveName: 'beaver pelts', get: 'flour', getName: 'sacks of flour', rate: [3, 2] },
    trades: [
      { give: 'pelts', giveName: 'beaver pelts', get: 'flour', getName: 'sacks of flour', rate: [3, 2] },
      { give: 'rope', giveName: 'coils of rope', get: 'flour', getName: 'sacks of flour', rate: [3, 2] },
      { give: 'blankets', giveName: 'blankets', get: 'flour', getName: 'sacks of flour', rate: [1, 2] },
    ],
    source: 'SOURCES.md#kansa' },
  { id: 'pawnee', name: 'Pawnee', also: 'Pawnee Nation of Oklahoma', legs: ['fort-kearny'],
    fact: { text: 'The Pawnee grew corn, beans and squash in villages along rivers in what is now Nebraska, and they hunted bison on the plains. Today the Pawnee Nation is based in Pawnee, Oklahoma.',
      say: 'The Pawnee grew corn, beans and squash in villages along rivers in what is now Nebraska, and they hunted bison on the plains. Today the Pawnee Nation is based in Pawnee, Oklahoma.' },
    trade: { give: 'blankets', giveName: 'blankets', get: 'corn', getName: 'bags of corn', rate: [1, 3] },
    trades: [
      { give: 'blankets', giveName: 'blankets', get: 'corn', getName: 'bags of corn', rate: [1, 3] },
      { give: 'pelts', giveName: 'beaver pelts', get: 'corn', getName: 'bags of corn', rate: [2, 3] },
      { give: 'rope', giveName: 'coils of rope', get: 'corn', getName: 'bags of corn', rate: [2, 3] },
    ],
    source: 'SOURCES.md#pawnee' },
  { id: 'lakota', name: 'Lakota', also: 'Lakota nations of the Great Plains', legs: ['ash-hollow', 'chimney-rock', 'scotts-bluff', 'fort-laramie', 'north-platte'],
    fact: { text: 'The Lakota are people of the northern Great Plains, and bison are a big part of their history and way of life. Today Lakota nations, such as the Oglala Sioux Tribe and the Standing Rock Sioux Tribe, live in South Dakota and North Dakota.',
      say: 'The Lakota are people of the northern Great Plains, and bison are a big part of their history and way of life. Today Lakota nations, such as the Oglala Sioux Tribe and the Standing Rock Sioux Tribe, live in South Dakota and North Dakota.' },
    trade: { give: 'blankets', giveName: 'blankets', get: 'pemmican', getName: 'cakes of pemmican (dried bison meat and berries)', rate: [2, 5] },
    trades: [
      { give: 'blankets', giveName: 'blankets', get: 'pemmican', getName: 'cakes of pemmican (dried bison meat and berries)', rate: [2, 5] },
      { give: 'pelts', giveName: 'beaver pelts', get: 'pemmican', getName: 'cakes of pemmican (dried bison meat and berries)', rate: [3, 4] },
      { give: 'rope', giveName: 'coils of rope', get: 'pemmican', getName: 'cakes of pemmican (dried bison meat and berries)', rate: [3, 4] },
    ],
    source: 'SOURCES.md#lakota' },
  { id: 'shoshone', name: 'Shoshone', also: 'Eastern Shoshone Tribe', legs: ['independence-rock', 'ice-slough', 'south-pass', 'green-river', 'fort-bridger', 'sublette-cutoff', 'bear-river', 'lander-road'],
    fact: { text: 'The Shoshone homeland includes parts of what is now Wyoming, Idaho, Utah and Nevada. Today the Eastern Shoshone Tribe and the Northern Arapaho Tribe share the Wind River Reservation in Wyoming.',
      say: 'The Shoshone homeland includes parts of what is now Wyoming, Idaho, Utah and Nevada. Today the Eastern Shoshone Tribe and the Northern Arapaho Tribe share the Wind River Reservation in Wyoming.' },
    trade: { give: 'rope', giveName: 'coils of rope', get: 'berries', getName: 'bags of dried berries', rate: [3, 4] },
    trades: [
      { give: 'rope', giveName: 'coils of rope', get: 'berries', getName: 'bags of dried berries', rate: [3, 4] },
      { give: 'pelts', giveName: 'beaver pelts', get: 'berries', getName: 'bags of dried berries', rate: [3, 4] },
      { give: 'blankets', giveName: 'blankets', get: 'berries', getName: 'bags of dried berries', rate: [1, 3] },
    ],
    source: 'SOURCES.md#shoshone' },
  { id: 'bannock', name: 'Bannock', also: 'Shoshone-Bannock Tribes', legs: ['soda-springs', 'fort-hall', 'snake-river', 'raft-river', 'city-of-rocks'],
    fact: { text: 'The Bannock people traveled far across the mountains each year to hunt bison. Today the Shoshone-Bannock Tribes make their home on the Fort Hall Reservation in Idaho.',
      say: 'The Bannock people traveled far across the mountains each year to hunt bison. Today the Shoshone-Bannock Tribes make their home on the Fort Hall Reservation in Idaho.' },
    trade: { give: 'rope', giveName: 'coils of rope', get: 'camas', getName: 'bags of camas roots', rate: [3, 2] },
    trades: [
      { give: 'rope', giveName: 'coils of rope', get: 'camas', getName: 'bags of camas roots', rate: [3, 2] },
      { give: 'pelts', giveName: 'beaver pelts', get: 'camas', getName: 'bags of camas roots', rate: [3, 2] },
      { give: 'blankets', giveName: 'blankets', get: 'camas', getName: 'bags of camas roots', rate: [1, 2] },
    ],
    source: 'SOURCES.md#bannock' },
  { id: 'nez-perce', name: 'Nez Perce', also: 'Nimiipuu', legs: ['blue-mountains'],
    fact: { text: 'The Nez Perce call themselves Nimiipuu, which means the people. They are known for their fine horses, including the spotted Appaloosa, and the Nez Perce Tribe is based in Lapwai, Idaho today.',
      say: 'The Nez Perce call themselves Nimiipuu, which means the people. They are known for their fine horses, including the spotted Appaloosa, and the Nez Perce Tribe is based in Lapwai, Idaho today.' },
    trade: { give: 'blankets', giveName: 'blankets', get: 'salmon', getName: 'bundles of dried salmon', rate: [2, 5] },
    trades: [
      { give: 'blankets', giveName: 'blankets', get: 'salmon', getName: 'bundles of dried salmon', rate: [2, 5] },
      { give: 'pelts', giveName: 'beaver pelts', get: 'salmon', getName: 'bundles of dried salmon', rate: [3, 4] },
      { give: 'rope', giveName: 'coils of rope', get: 'salmon', getName: 'bundles of dried salmon', rate: [3, 4] },
    ],
    source: 'SOURCES.md#nez-perce' },
  { id: 'cayuse', name: 'Cayuse', also: 'Confederated Tribes of the Umatilla Indian Reservation', legs: ['blue-mountains'],
    fact: { text: 'The Cayuse people are so well known for their horses that cayuse became a word for a pony in the West. Today Cayuse people are part of the Confederated Tribes of the Umatilla Indian Reservation in Oregon.',
      say: 'The Cayuse people are so well known for their horses that cayuse became a word for a pony in the West. Today Cayuse people are part of the Confederated Tribes of the Umatilla Indian Reservation in Oregon.' },
    trade: { give: 'pelts', giveName: 'beaver pelts', get: 'roots', getName: 'bags of dried roots', rate: [5, 2] },
    trades: [
      { give: 'pelts', giveName: 'beaver pelts', get: 'roots', getName: 'bags of dried roots', rate: [5, 2] },
      { give: 'rope', giveName: 'coils of rope', get: 'roots', getName: 'bags of dried roots', rate: [5, 2] },
      { give: 'blankets', giveName: 'blankets', get: 'roots', getName: 'bags of dried roots', rate: [1, 2] },
    ],
    source: 'SOURCES.md#cayuse' },
  { id: 'chinook', name: 'Chinook', also: 'Chinook Indian Nation', legs: ['the-dalles', 'willamette-valley', 'barlow-road', 'home-by-sea'],
    fact: { text: 'Chinookan peoples have lived along the Columbia River for generations and were famous traders who traveled by canoe. Today the Chinook Indian Nation is based in Washington state.',
      say: 'Chinookan peoples have lived along the Columbia River for generations and were famous traders who traveled by canoe. Today the Chinook Indian Nation is based in Washington state.' },
    trade: { give: 'blankets', giveName: 'blankets', get: 'wapato', getName: 'bags of wapato roots', rate: [1, 2] },
    trades: [
      { give: 'blankets', giveName: 'blankets', get: 'wapato', getName: 'bags of wapato roots', rate: [1, 2] },
      { give: 'pelts', giveName: 'beaver pelts', get: 'wapato', getName: 'bags of wapato roots', rate: [2, 3] },
      { give: 'rope', giveName: 'coils of rope', get: 'wapato', getName: 'bags of wapato roots', rate: [2, 3] },
    ],
    source: 'SOURCES.md#chinook' },
  // ---- v1.5: eleven nations of the new routes (SPEC §2.5). Named as they name themselves; a present-tense fact where true; sources and
  // verdicts at SOURCES.md, "The Long Trail (v1.5)". A parent's read of all eleven is asked for (SPEC §1, §8). ----
  N('kalapuya', 'Kalapuya', 'Confederated Tribes of Grand Ronde; Confederated Tribes of Siletz Indians', ['calapooya-mountains'],
    'The Kalapuya people have lived in the Willamette Valley for thousands of years, and they cared for its prairies with fire so that camas and other foods grew well. Today Kalapuya people are part of the Confederated Tribes of Grand Ronde and the Confederated Tribes of Siletz Indians.',
    [['blankets', 'blankets', 'camas', 'bags of camas roots', [1, 2]], ['pelts', 'beaver pelts', 'camas', 'bags of camas roots', [3, 2]], ['rope', 'coils of rope', 'camas', 'bags of camas roots', [3, 2]]]),
  N('umpqua', 'Umpqua', 'Cow Creek Band of Umpqua Tribe of Indians', ['umpqua-river', 'canyon-creek'],
    'The Cow Creek Band of Umpqua Tribe of Indians takes its name from Cow Creek, which runs into the South Umpqua River. Today the tribe is based in Roseburg, Oregon, in its homeland.',
    [['blankets', 'blankets', 'salmon', 'bundles of dried salmon', [2, 5]], ['pelts', 'beaver pelts', 'salmon', 'bundles of dried salmon', [3, 4]], ['rope', 'coils of rope', 'salmon', 'bundles of dried salmon', [3, 4]]]),
  N('takelma', 'Takelma', 'Siletz; Grand Ronde', ['rogue-river'],
    'Takelma means those who live along the river, and the Rogue River valley and the Table Rocks are the heart of the Takelma homeland. Today Takelma people belong to the Confederated Tribes of Siletz Indians and the Confederated Tribes of Grand Ronde.',
    [['rope', 'coils of rope', 'acorns', 'bags of acorn meal', [3, 4]], ['pelts', 'beaver pelts', 'acorns', 'bags of acorn meal', [3, 4]], ['blankets', 'blankets', 'acorns', 'bags of acorn meal', [1, 3]]]),
  N('shasta', 'Shasta', null, ['siskiyou-pass', 'mount-shasta'],
    'The Shasta homeland is along the Klamath River and in the valleys at the foot of Mount Shasta. Shasta people still live in this country today.',
    [['pelts', 'beaver pelts', 'salmon', 'bundles of dried salmon', [3, 4]], ['blankets', 'blankets', 'salmon', 'bundles of dried salmon', [2, 5]], ['rope', 'coils of rope', 'salmon', 'bundles of dried salmon', [3, 4]]]),
  N('wintu', 'Wintu', null, ['castle-crags', 'clear-creek'],
    'The Wintu homeland is along the upper Sacramento and McCloud rivers, and salmon are at the heart of Wintu life. Today Wintu people are helping bring salmon back to the McCloud River.',
    [['rope', 'coils of rope', 'salmon', 'bundles of dried salmon', [2, 3]], ['blankets', 'blankets', 'salmon', 'bundles of dried salmon', [2, 5]], ['pelts', 'beaver pelts', 'salmon', 'bundles of dried salmon', [3, 4]]]),
  N('maidu', 'Maidu', 'Mechoopda Indian Tribe of Chico Rancheria; Berry Creek Rancheria of Maidu Indians', ['feather-river'],
    'The Maidu homeland includes the Feather River country. Today Maidu tribes include the Mechoopda Indian Tribe of Chico Rancheria and the Berry Creek Rancheria of Maidu Indians.',
    [['blankets', 'blankets', 'acorns', 'bags of acorn meal', [1, 3]], ['pelts', 'beaver pelts', 'acorns', 'bags of acorn meal', [2, 3]], ['rope', 'coils of rope', 'acorns', 'bags of acorn meal', [2, 3]]]),
  N('nisenan', 'Nisenan', 'Shingle Springs Band of Miwok Indians; Nevada City Rancheria Nisenan Tribe', ['sutters-fort', 'coloma', 'sacramento-valley'],
    'The Nisenan homeland is along the American, Yuba and Feather rivers, and the Nisenan call the valley at Coloma Cullumah. Today Nisenan people belong to the Shingle Springs Band of Miwok Indians and the Nevada City Rancheria Nisenan Tribe.',
    [['pelts', 'beaver pelts', 'acorns', 'bags of acorn meal', [3, 4]], ['rope', 'coils of rope', 'acorns', 'bags of acorn meal', [3, 4]], ['blankets', 'blankets', 'acorns', 'bags of acorn meal', [1, 3]]]),
  N('miwok', 'Miwok', 'Shingle Springs Band of Miwok Indians', ['coloma'],
    'Miwok homelands reach along the Sierra foothills south of the American River. Today the Shingle Springs Band of Miwok Indians, whose people are Miwok and Nisenan, is based in El Dorado County, the county where Coloma is.',
    [['blankets', 'blankets', 'acorns', 'bags of acorn meal', [1, 2]], ['pelts', 'beaver pelts', 'acorns', 'bags of acorn meal', [3, 2]], ['rope', 'coils of rope', 'acorns', 'bags of acorn meal', [3, 2]]]),
  N('newe', 'Western Shoshone', 'Newe; Te-Moak Tribe of Western Shoshone', ['humboldt-wells', 'humboldt-river'],
    'The Western Shoshone call themselves Newe. Today the Te-Moak Tribe of Western Shoshone has its headquarters in Elko, Nevada, and one of its bands is based in Wells, near the head of the Humboldt River.',
    [['blankets', 'blankets', 'pinenuts', 'bags of pine nuts', [1, 2]], ['pelts', 'beaver pelts', 'pinenuts', 'bags of pine nuts', [3, 2]], ['rope', 'coils of rope', 'pinenuts', 'bags of pine nuts', [3, 2]]]),
  N('numu', 'Northern Paiute', 'Numu; Pyramid Lake Paiute Tribe', ['big-meadows', 'forty-mile-desert', 'truckee-river'],
    'The Northern Paiute homeland includes Pyramid Lake and the Truckee River. Today the Pyramid Lake Paiute Tribe’s reservation takes in the whole lake and the lower Truckee River.',
    [['rope', 'coils of rope', 'trout', 'strings of dried trout', [3, 4]], ['pelts', 'beaver pelts', 'trout', 'strings of dried trout', [2, 3]], ['blankets', 'blankets', 'trout', 'strings of dried trout', [1, 3]]]),
  N('washoe', 'Washoe', 'Wašiw; Washoe Tribe of Nevada and California', ['sierra-summit'],
    'Lake Tahoe, high in the Sierra Nevada, is the heart of the Washoe homeland. Today the Washoe Tribe of Nevada and California is based in Gardnerville, Nevada.',
    [['blankets', 'blankets', 'pinenuts', 'bags of pine nuts', [1, 2]], ['pelts', 'beaver pelts', 'pinenuts', 'bags of pine nuts', [2, 3]], ['rope', 'coils of rope', 'pinenuts', 'bags of pine nuts', [2, 3]]]),
];
export const NATION_BY_ID = Object.fromEntries(NATIONS.map((n) => [n.id, n]));

/** Names for every good a trade can give or get (the word-problem text and the toasts). */
export const TRADE_GOOD_NAMES = {
  pelts: 'beaver pelts', rope: 'coils of rope', blankets: 'blankets', tokens: 'trade tokens',
  flour: 'sacks of flour', bacon: 'sides of bacon', beans: 'bags of beans',
  corn: 'bags of corn', pemmican: 'cakes of pemmican', berries: 'bags of dried berries', camas: 'bags of camas roots',
  salmon: 'bundles of dried salmon', roots: 'bags of dried roots', wapato: 'bags of wapato roots',
  acorns: 'bags of acorn meal', pinenuts: 'bags of pine nuts', trout: 'strings of dried trout',
};
/** The trades every post can make when the wagon holds none of the nation's own goods: a token trade first (trade tokens
 *  are earned by every right first try, so they are the kindest currency), then a trade of store food (a sack of flour is
 *  worth the same pounds in corn). `get` is a food, like every trade. */
export const FALLBACK_TRADES = [
  { give: 'tokens', giveName: 'trade tokens', get: 'berries', getName: 'bags of dried berries', rate: [2, 3] },
  { give: 'flour', giveName: 'sacks of flour', get: 'corn', getName: 'bags of corn', rate: [1, 2] },
  { give: 'beans', giveName: 'bags of beans', get: 'corn', getName: 'bags of corn', rate: [2, 3] },
  { give: 'bacon', giveName: 'sides of bacon', get: 'corn', getName: 'bags of corn', rate: [5, 4] },
];

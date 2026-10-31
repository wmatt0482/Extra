// People of the trail (SPEC v1.2 §4 "Talk to people"): two or three at every stop, each with a portrait emoji, a role and
// two lines the child can have read aloud; some hand over a small gift the first time they are met. The stop screen shows
// them as a "Talk" row; sim.meetPerson(J, id) applies the gift once and counts the person (J.met, totals.peopleMet).
//
//   { id, stop: legId | 'independence', name, emoji, role, lines: [two lines], gift?, source }
//   gift = { kind: 'food', what, lb, text }                  food: lb pounds go into the wagon's `other` food
//        | { kind: 'card', card, text }                      a trail card id (cards.js) for the app to award
//        | { kind: 'tip', problem: 'parts', text }           a parts word problem the app offers for a trade token
//        | { kind: 'trade', give, get, rate: [g, w], text }  a trade like the posts (applyTrade with give / get)
//
// Kid rules (SPEC §1): true to the period and kid-level; nobody is sick or hurt; no weapons beyond the bow; no alcohol.
// Nations' people are named for their nation ("a Kansa guide"), never given invented personal names, and the facts they
// state are the nations' own (nations.js, docs/SOURCES.md) in the present tense where that is true today. Every number is
// written in words, so each line can be read aloud as it stands. Each stop's facts are sourced at SOURCES.md#people-<stop>.
const P = (id, stop, name, emoji, role, lines, gift) => ({ id, stop, name, emoji, role, lines, ...(gift ? { gift } : {}), source: `SOURCES.md#people-${stop}` });

export const PEOPLE = [
  // ---- Independence, Missouri ----
  P('hale', 'independence', 'Mr. Hale', '🧑‍🌾', 'the outfitter', [
    'Most families buy flour, bacon and beans here before they leave. Those keep well on a long trail.',
    'Do not forget a spare wagon part. Out on the prairie, the nearest wagon shop can be a very long way off.',
  ], { kind: 'food', what: 'beans', lb: 10, text: 'Mr. Hale slips a bag of beans into your wagon for the road.' }),
  P('clara', 'independence', 'Clara', '👧', 'a wagon-maker\'s daughter', [
    'My father builds wagons here. Wheels, axles and wagon tongues are what break most on a bumpy trail.',
    'A wagon wheel has a lot of spokes, and when some break you have to count what is left. Want to try?',
  ], { kind: 'tip', problem: 'parts', text: 'Clara shows you a spokes puzzle. Work it out for a trade token.' }),
  P('amos', 'independence', 'Amos', '👴', 'a teamster', [
    'Everybody waits here for the spring grass to grow tall. The oxen need it to eat on the way.',
    'Oxen are slow, but they are strong, and they do not mind the long road one bit.',
  ], { kind: 'card', card: 'wild-plum', text: 'Amos points out a thicket of wild plums at the edge of town.' }),

  // ---- the Kansas River ----
  P('will', 'kansas-river', 'Will', '🧒', 'a ferryman\'s son', [
    'My family runs the ferry. A ferry is a flat boat that carries a whole wagon across at a time.',
    'We charge a fee for each wagon. That is how the ferry pays for its ropes and its boards.',
  ]),
  P('kansa-guide', 'kansas-river', 'A Kansa guide', '🧑', 'a Kansa guide', [
    'The Kansas River and the state of Kansas are named for the Kansa people, my people.',
    'Today the Kaw Nation is based in Oklahoma. Our people lived in villages along this river for generations.',
  ], { kind: 'card', card: 'kansa', text: 'The guide shares a card about the Kansa people.' }),
  P('ruth', 'kansas-river', 'Mrs. Ruth', '👩', 'a traveler with a diary', [
    'I write in my diary every night. Out here, every single day gives me something new to write.',
    'The wagon ahead of us has a good line for crossing. Keep your animals calm at the water\'s edge.',
  ], { kind: 'trade', give: 'pelts', get: 'flour', rate: [3, 2], text: 'Mrs. Ruth offers a fair trade: three pelts for two sacks of flour.' }),

  // ---- Fort Kearny ----
  P('danny', 'fort-kearny', 'Danny', '🧒', 'a soldier\'s son', [
    'My father is a soldier at Fort Kearny. The fort was built in eighteen forty-eight to help travelers on the trail.',
    'Visit the post office before you go. Your letters ride east from here.',
  ]),
  P('hollis', 'fort-kearny', 'Mr. Hollis', '🧑‍🔧', 'the blacksmith', [
    'My shop mends wheels, shoes oxen and fixes anything made of iron.',
    'A loose wheel I can mend. A cracked one needs a spare part, so keep one in the wagon.',
  ], { kind: 'tip', problem: 'parts', text: 'Mr. Hollis sets a spare-parts puzzle on his anvil. Work it out for a trade token.' }),
  P('pawnee-guide', 'fort-kearny', 'A Pawnee guide', '🧑', 'a Pawnee guide', [
    'The Pawnee grew corn, beans and squash in villages along the rivers of what is now Nebraska.',
    'We hunted bison on the plains too. Today the Pawnee Nation is based in Pawnee, Oklahoma.',
  ], { kind: 'trade', give: 'blankets', get: 'corn', rate: [1, 3], text: 'The guide offers a fair trade: one blanket for three bags of corn.' }),

  // ---- Chimney Rock ----
  P('hannah', 'chimney-rock', 'Hannah', '👧', 'a girl with a diary', [
    'Chimney Rock is a tall spire that rises hundreds of feet above the valley. I could see it from miles away.',
    'Many travelers wrote about it in their diaries. I am going to draw it in mine.',
  ]),
  P('lakota-guide', 'chimney-rock', 'A Lakota guide', '🧑', 'a Lakota guide', [
    'The Lakota are people of the northern Great Plains, and bison are a big part of our history and way of life.',
    'Today Lakota nations, such as the Oglala Sioux Tribe and the Standing Rock Sioux Tribe, live in South Dakota and North Dakota.',
  ], { kind: 'card', card: 'lakota', text: 'The guide shares a card about the Lakota.' }),
  P('pike', 'chimney-rock', 'Mr. Pike', '🧔', 'a trader bound for the east', [
    'I carry a wagon full of bison robes back east. A thick robe keeps you warm on the coldest night.',
    'Keep your pelts dry and your blankets handy. You will want both in the mountains.',
  ], { kind: 'trade', give: 'pelts', get: 'flour', rate: [3, 2], text: 'Mr. Pike offers a fair trade: three pelts for two sacks of flour.' }),

  // ---- Fort Laramie ----
  P('tom', 'fort-laramie', 'Tom', '🧒', 'a soldier\'s son', [
    'My father is a soldier here. The army bought the fort in eighteen forty-nine.',
    'Before that, Fort Laramie began as a trading post in eighteen thirty-four, where people traded furs and bison robes.',
  ], { kind: 'food', what: 'bacon', lb: 10, text: 'Tom hands over a side of bacon from his mother\'s kitchen.' }),
  P('lakota-trader', 'fort-laramie', 'A Lakota trader', '🧑', 'a Lakota trader', [
    'People have traded bison robes at this fort for a long time. A bison robe is thick and warm, like a winter coat.',
    'Bison have been part of Lakota life for generations, and Lakota nations are still strong on the northern Plains today.',
  ], { kind: 'trade', give: 'blankets', get: 'pemmican', rate: [2, 5], text: 'The trader offers a fair trade: two blankets for five cakes of pemmican.' }),
  P('jed', 'fort-laramie', 'Old Jed', '🧔', 'a mountain man going home', [
    'I trapped beaver in the mountains. Beaver fur made fancy hats back East, so the fur trade was big business.',
    'Those days are changing now. Every spring the trail fills up with wagons like yours.',
  ], { kind: 'tip', problem: 'parts', text: 'Old Jed tests you with a counting puzzle about wagon parts. Work it out for a trade token.' }),

  // ---- Independence Rock ----
  P('lucy', 'independence-rock', 'Lucy', '👧', 'a girl with a paint pot', [
    'I am painting my name on Independence Rock. Travelers carve or paint their names on the big granite rock.',
    'Some of the names from long ago can still be seen today. Maybe mine will last, too.',
  ]),
  P('shoshone-guide', 'independence-rock', 'A Shoshone guide', '🧑', 'a Shoshone guide', [
    'The Shoshone homeland includes parts of what is now Wyoming, Idaho, Utah and Nevada.',
    'Today the Eastern Shoshone Tribe and the Northern Arapaho Tribe share the Wind River Reservation in Wyoming.',
  ], { kind: 'trade', give: 'rope', get: 'berries', rate: [3, 4], text: 'The guide offers a fair trade: three coils of rope for four bags of dried berries.' }),

  // ---- South Pass ----
  P('nell', 'south-pass', 'Nell', '👧', 'a girl at the top of the pass', [
    'This is the Continental Divide. Water east of here runs toward the Atlantic Ocean, and water west of here runs toward the Pacific.',
    'The pass is wide and gentle, not steep at all. Our wagon rolled right through.',
  ]),
  P('silas', 'south-pass', 'Mr. Silas', '🧔', 'a freight driver', [
    'We are more than seven thousand feet above sea level up here. The air is thin and the nights are cold.',
    'A good rule of the road: one blanket for every two people. Bring enough, and you will sleep sound.',
  ], { kind: 'tip', problem: 'parts', text: 'Mr. Silas has a puzzle about spare parts for the climb. Work it out for a trade token.' }),

  // ---- Fort Bridger ----
  P('finch', 'fort-bridger', 'Mr. Finch', '🧑‍💼', 'a clerk at the trading post', [
    'Jim Bridger and Louis Vasquez started this fort as a trading post in eighteen forty-three.',
    'Wagon parties stop here to trade, buy supplies and fix their wagons.',
  ]),
  P('greta', 'fort-bridger', 'Greta', '👩‍🔧', 'a blacksmith\'s helper', [
    'We mend wagons all day long: wheels, axles and tongues. A spare part saves a whole day.',
    'If you can count your spares and your spokes, you will never be stuck for long.',
  ], { kind: 'tip', problem: 'parts', text: 'Greta hands you a spare-parts puzzle. Work it out for a trade token.' }),
  P('shoshone-trader', 'fort-bridger', 'A Shoshone trader', '🧑', 'a Shoshone trader', [
    'Shoshone people traded with travelers at this fort. A fair trade leaves both sides happy.',
    'The Shoshone homeland includes parts of what is now Wyoming, Idaho, Utah and Nevada, and Shoshone people live here today.',
  ], { kind: 'trade', give: 'rope', get: 'berries', rate: [3, 4], text: 'The trader offers a fair trade: three coils of rope for four bags of dried berries.' }),

  // ---- Fort Hall ----
  P('wes', 'fort-hall', 'Wesley', '🧒', 'a boy at the springs', [
    'Near Soda Springs the water fizzes right out of the ground! It is bubbly, like a drink with fizz.',
    'Fort Hall is a trading post where wagon parties rest their animals and trade.',
  ], { kind: 'card', card: 'sagebrush', text: 'Wesley picks you a sprig of sagebrush and a card to go with it.' }),
  P('bannock-guide', 'fort-hall', 'A Bannock guide', '🧑', 'a Bannock guide', [
    'The Bannock people traveled far across the mountains each year to hunt bison.',
    'Today the Shoshone-Bannock Tribes make their home on the Fort Hall Reservation in Idaho.',
  ], { kind: 'card', card: 'bannock', text: 'The guide shares a card about the Bannock people.' }),

  // ---- the Snake River ----
  P('josie', 'snake-river', 'Josie', '👧', 'a girl at the crossing', [
    'At Three Island Crossing, wagon parties wade from island to island across the Snake River.',
    'Parties that skip the crossing take a longer, drier trail along the south side.',
  ], { kind: 'tip', problem: 'parts', text: 'Josie asks a riddle about the ropes on the ferry. Work it out for a trade token.' }),
  P('dell', 'snake-river', 'Mr. Dell', '🧔', 'a traveler with sound advice', [
    'Keep the flour packed high and dry. A wet sack of flour is a lost sack.',
    'A coil of rope is the cheapest thing you can carry. It has saved many a crossing.',
  ], { kind: 'trade', give: 'rope', get: 'camas', rate: [3, 2], text: 'Mr. Dell offers a fair trade: three coils of rope for two bags of camas roots.' }),

  // ---- the Blue Mountains ----
  P('nez-perce-trader', 'blue-mountains', 'A Nez Perce horse trader', '🧑', 'a Nez Perce horse trader', [
    'The Nez Perce call themselves Nimiipuu, which means the people.',
    'We are known for fine horses, including the spotted Appaloosa. The Nez Perce Tribe is based in Lapwai, Idaho, today.',
  ], { kind: 'card', card: 'nez-perce', text: 'The trader shares a card about the Nez Perce.' }),
  P('cayuse-guide', 'blue-mountains', 'A Cayuse guide', '🧑', 'a Cayuse guide', [
    'The Cayuse people are so well known for their horses that cayuse became a word for a pony in the West.',
    'Today Cayuse people are part of the Confederated Tribes of the Umatilla Indian Reservation in Oregon.',
  ], { kind: 'card', card: 'cayuse', text: 'The guide shares a card about the Cayuse.' }),
  P('pruitt', 'blue-mountains', 'Mr. Pruitt', '🧓', 'a traveler in the pines', [
    'Pine forests at last! After all that hot, dry travel, the shade feels wonderful.',
    'The nights up here turn cold. Make sure everybody has a blanket, and the oxen get a rest.',
  ], { kind: 'food', what: 'hazelnuts', lb: 15, text: 'Mr. Pruitt shares a bag of hazelnuts he gathered by the trail.' }),

  // ---- The Dalles ----
  P('chinook-trader', 'the-dalles', 'A Chinook trader', '🧑', 'a Chinook trader', [
    'Chinookan peoples have lived along the Columbia River for generations, and we were famous traders who traveled by canoe.',
    'Today the Chinook Indian Nation is based in Washington state.',
  ], { kind: 'trade', give: 'blankets', get: 'wapato', rate: [1, 2], text: 'The trader offers a fair trade: one blanket for two bags of wapato roots.' }),
  P('barlow-kid', 'the-dalles', 'Ben', '🧒', 'a toll keeper\'s son', [
    'The Barlow Road is a toll road that opened in eighteen forty-six. A toll is a fee, like a ferry fare.',
    'You can float down the river on a raft, or pay the toll and take the road. Both ways lead to the valley.',
  ]),
  P('teague', 'the-dalles', 'Mr. Teague', '🧑‍🔧', 'a raft builder', [
    'Many wagon parties float downriver on rafts. The water can be fast, so hold on tight.',
    'Steer around the rocks and stay in the calm water, and the river will carry you most of the way.',
  ], { kind: 'food', what: 'dried salmon', lb: 10, text: 'Mr. Teague hands over a bundle of dried salmon for the river trip.' }),

  // ---- the Willamette Valley ----
  P('ingrid', 'willamette-valley', 'Mrs. Ingrid', '👩‍🌾', 'a farmer', [
    'The valley has rich, dark soil, which is why so many families came here to farm.',
    'Come spring we will plant a garden first and apple trees after. Welcome, neighbors!',
  ], { kind: 'food', what: 'fresh vegetables', lb: 15, text: 'Mrs. Ingrid fills a basket with vegetables from her garden.' }),
  P('chinook-guide', 'willamette-valley', 'A Chinook guide', '🧑', 'a Chinook guide', [
    'Chinookan peoples have lived along the Columbia River for generations.',
    'Oregon City, at the end of the Oregon Trail, sits beside Willamette Falls, a big waterfall.',
  ], { kind: 'card', card: 'chinook', text: 'The guide shares a card about the Chinook.' }),
  P('beth', 'willamette-valley', 'Beth', '👧', 'a shopkeeper\'s daughter', [
    'You made it! Oregon City is the end of the Oregon Trail, and you are the newest neighbors.',
    'Come and see the falls. They roar louder than a hundred wagons.',
  ]),
];

export const PERSON_BY_ID = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));
export const PEOPLE_BY_STOP = {};
for (const p of PEOPLE) (PEOPLE_BY_STOP[p.stop] = PEOPLE_BY_STOP[p.stop] || []).push(p);

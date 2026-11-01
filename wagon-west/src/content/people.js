// People of the trail (SPEC v1.2 §4 "Talk to people"; v1.5 §2.9 adds the 33 new stops and Agnes): two or three at every stop, each with a portrait emoji, a role and
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

// Gift helpers for the v1.5 people (the same gift objects as the 1.2 people above, written once).
const food = (what, lb, text) => ({ kind: 'food', what, lb, text });
const card = (c, text) => ({ kind: 'card', card: c, text });
const tip = (text) => ({ kind: 'tip', problem: 'parts', text });
const trade = (give, get, rate, text) => ({ kind: 'trade', give, get, rate, text });

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
    'Keep the flour packed high and dry. Dry flour makes the best biscuits on the trail.',
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

  // ======== v1.5 (SPEC §2.9): the people of the 33 new stops and Agnes at Fort Hall. Same shape and rules as above: invented story people;
  // the nations' guides and traders are named for their nation ("A Takelma guide") and say only the nation's own facts (nations.js),
  // in the present tense where that is true today; gifts are game rules. Sourced at SOURCES.md#people-<stop>. ----

  // ---- Fort Hall: the explainer of the fork (FORKS['fort-hall'].explainer) ----
  P('agnes', 'fort-hall', 'Agnes', '👩‍💼', 'a clerk at the fort', [
    'From here the road forks. West along the Snake River lies the Willamette Valley, with its rich farmland.',
    'South at the Raft River, the California Trail follows the Humboldt River, crosses a desert with no water, and climbs over the Sierra Nevada.',
  ]),

  // ---- Alcove Spring ----
  P('tessa', 'alcove-spring', 'Tessa', '👧', 'a girl at the spring', [
    'A little stream falls over a rock ledge right into a cool pool here. I stood under the ledge and felt the drops on my face.',
    'Travelers carve their names in the rock while they wait to cross the river. Some carvings from eighteen forty-six can still be seen.',
  ]),
  P('orrin', 'alcove-spring', 'Mr. Orrin', '🧔', 'a traveler waiting to cross', [
    'The river is high, so we camp here by the spring and wait for the water to go down. Waiting is easier beside a spring.',
    'Rest your animals while you wait. A rested team crosses a river better than a tired one.',
  ], food('dried plums', 10, 'Mr. Orrin shares a bag of dried plums for the road.')),

  // ---- Ash Hollow ----
  P('wendell', 'ash-hollow', 'Wendell', '🧒', 'a boy at Windlass Hill', [
    'Windlass Hill is so steep that the wagons come down very slowly. Some are eased down on ropes.',
    'At the bottom there is a shady hollow full of ash trees, with a spring of sweet water.',
  ]),
  P('olive', 'ash-hollow', 'Mrs. Olive', '👩', 'a traveler filling her water jugs', [
    'Fill every jug at the spring. The water here is sweet, and the trail ahead is long.',
    'Ash trees make good shade. Rest the team under them before you roll on.',
  ], tip('Mrs. Olive has a puzzle about spare parts for the steep hill. Work it out for a trade token.')),

  // ---- Scotts Bluff ----
  P('gil', 'scotts-bluff', 'Gil', '👦', 'a boy with a sketchbook', [
    'The bluffs tower about eight hundred feet over the North Platte River. I am drawing them from the bottom.',
    'The wagons go through Mitchell Pass right beside them. Today part of the old road is a walking trail.',
  ], card('mule-deer', 'Gil tucks a sketch of a mule deer into your wagon, with a card to go with it.')),
  P('harper', 'scotts-bluff', 'Mr. Harper', '🧑‍🔧', 'a wheelwright', [
    'A rocky pass is hard on wheels, so I check every spoke before a wagon rolls through.',
    'Count your spokes and your spare parts, and you will always know how many you have.',
  ], tip('Mr. Harper sets a spokes puzzle on his workbench. Work it out for a trade token.')),

  // ---- North Platte River ----
  P('abel', 'north-platte', 'Abel', '🧑', 'a ferry hand', [
    'In June eighteen forty-seven, Mormon pioneers built a ferry near here. It carries wagons over the high river for a fee.',
    'The river runs high and fast in early summer, so most families pay for the ferry.',
  ]),
  P('brenna', 'north-platte', 'Brenna', '👧', 'a ferryman\'s daughter', [
    'A ferry is a big flat boat that carries a whole wagon across the water. We keep it tied to a strong rope.',
    'The fee for a wagon helps pay for the boat and the boards. Next time, count how many wagons fit!',
  ], trade('rope', 'flour', [3, 2], 'Brenna offers a fair trade: three coils of rope for two sacks of flour.')),
  P('jonah', 'north-platte', 'Mr. Jonah', '🧔', 'a traveler with a full wagon', [
    'Pack the heavy things low and the light things high. A well-packed wagon rides smoother.',
    'Keep the flour in the driest part of the wagon, away from river splashes.',
  ], food('dried apples', 10, 'Mr. Jonah hands over a bag of dried apples for the road.')),

  // ---- Ice Slough ----
  P('pearl', 'ice-slough', 'Pearl', '👧', 'a girl with a spade', [
    'Dig down about a foot under the grass here and you hit clear ice, even in July!',
    'I filled a bucket, and now the whole party is drinking ice water.',
  ]),
  P('cyrus', 'ice-slough', 'Mr. Cyrus', '🧓', 'an old traveler', [
    'The ground here is boggy and soft, so the wagons go around the wettest spots.',
    'Ice in summer feels like magic. Take a cool drink and tell everyone back home.',
  ], tip('Mr. Cyrus sets a counting puzzle on a block of ice. Work it out for a trade token.')),

  // ---- Green River ----
  P('rafe', 'green-river', 'Rafe', '🧑', 'a ferryman', [
    'Fording the Green River is risky, so most travelers pay one of the ferries to carry the wagons over.',
    'Keep the team calm and the wagon straight, and the ferry does the rest.',
  ]),
  P('dolly', 'green-river', 'Dolly', '👧', 'a girl counting wagons', [
    'I count the wagons waiting for the ferry. Today there are more than I can count on my fingers!',
    'While we wait, we play games in the grass beside the river.',
  ], card('jackrabbit', 'Dolly shows you a jackrabbit she spotted, and a card to go with it.')),

  // ---- Soda Springs ----
  P('fiona', 'soda-springs', 'Fiona', '👧', 'a girl with a tin cup', [
    'The water here fizzes right out of the ground! It tickles my nose, like a drink full of bubbles.',
    'Take a sip and see. Then tell everybody what it tastes like.',
  ]),
  P('garth', 'soda-springs', 'Mr. Garth', '🧔', 'a traveler resting his team', [
    'A day at the springs is a good rest for the animals. Let them drink and graze in the grass.',
    'Fort Hall is not far now, and there will be a store and a post office there.',
  ], food('dried berries', 10, 'Mr. Garth shares a bag of dried berries he picked on the way.')),

  // ---- Farewell Bend ----
  P('lyle', 'farewell-bend', 'Lyle', '🧒', 'a boy at the river bend', [
    'This is the last camp on the Snake River. We followed it for more than three hundred miles.',
    'Tomorrow the wagons say goodbye to the river and go overland. I will miss the sound of the water.',
  ], food('dried trout', 10, 'Lyle gives you a string of dried trout from his family\'s supper.')),
  P('hester', 'farewell-bend', 'Mrs. Hester', '👩', 'a traveler writing a letter', [
    'I am writing a long letter tonight. A bend in the river is a good place to remember home.',
    'Fill every barrel and check every wheel before we leave the river. Then we are ready for the road ahead.',
  ], tip('Mrs. Hester asks a riddle about spare parts. Work it out for a trade token.')),

  // ---- Sublette Cutoff ----
  P('rhett', 'sublette-cutoff', 'Rhett', '🧑', 'a scout at the start of the cutoff', [
    'The Sublette Cutoff opened in eighteen forty-four. It is a shorter way west from South Pass.',
    'It crosses a long dry stretch with no water, so I fill every barrel before I start.',
  ]),
  P('sunny', 'sublette-cutoff', 'Sunny', '👧', 'a girl with a water barrel', [
    'Our barrel is full to the very top. Fill yours, and the dry stretch will be easy.',
    'We keep the barrel in the shade of the wagon, and everybody gets a sip when we stop.',
  ], tip('Sunny asks how many cups a barrel holds. Work it out for a trade token.')),
  P('barnaby', 'sublette-cutoff', 'Mr. Barnaby', '🧓', 'a wagon master', [
    'A shortcut saves distance, but it asks more of the team. Rest the animals well before the dry stretch.',
    'A river on the far side means a long cool drink for everyone, and that is worth the trip.',
  ], food('dried apples', 10, 'Mr. Barnaby hands over a bag of dried apples.')),

  // ---- Bear River ----
  P('cora', 'bear-river', 'Cora', '👧', 'a girl where the trails meet', [
    'Here the shortcut and the old trail meet again. It is like two roads shaking hands!',
    'Now we all roll on together toward Soda Springs.',
  ]),
  P('felix', 'bear-river', 'Felix', '🧑', 'a trader with a pack mule', [
    'I carry salt, thread and nails for the wagons. A pack mule is slower than a horse, but it can climb anywhere.',
    'A fair trade leaves both sides happy. Have a look at what I have.',
  ], trade('rope', 'berries', [3, 4], 'Felix offers a fair trade: three coils of rope for four bags of dried berries.')),

  // ---- Lander Road ----
  P('tobias', 'lander-road', 'Tobias', '🧑', 'a road builder', [
    'The government built this road for emigrants in eighteen fifty-eight and eighteen fifty-nine.',
    'It is much shorter than the old trail, with grass and water along the way.',
  ]),
  P('edna', 'lander-road', 'Edna', '👩', 'a traveler with a happy team', [
    'Our oxen love this road. There is grass for them at every camp.',
    'A shorter road means more evenings by the campfire and fewer days in the dust.',
  ], food('dried plums', 10, 'Edna shares a bag of dried plums with the whole party.')),
  P('mica', 'lander-road', 'Mica', '👦', 'a boy collecting stones', [
    'The mountains here are full of colored rocks. I keep the prettiest ones in my pocket.',
    'The nights get cold up high, so bring your blankets.',
  ], tip('Mica has a puzzle about spare parts. Work it out for a trade token.')),

  // ---- Barlow Road ----
  P('dwight', 'barlow-road', 'Mr. Dwight', '🧑', 'a toll keeper\'s helper', [
    'The Barlow Road opened in eighteen forty-six as a toll road around Mount Hood. The toll was five dollars a wagon.',
    'If a purse was short, the toll keeper wrote it in his book, and the wagon rolled on anyway.',
  ]),
  P('kit', 'barlow-road', 'Kit', '👧', 'a girl who rode down Laurel Hill', [
    'At Laurel Hill, the men let our wagon down the slope on ropes and chains. I held my breath the whole way.',
    'At the bottom everybody cheered, and the oxen looked pleased too.',
  ]),
  P('oakes', 'barlow-road', 'Mr. Oakes', '🧓', 'a farmer in Oregon City', [
    'Welcome to the valley! The soil here is rich and dark, and a garden grows fast.',
    'Come and see the falls at Oregon City. Willamette Falls roars all day long.',
  ], food('fresh vegetables', 15, 'Mr. Oakes fills a basket with vegetables from his garden.')),

  // ---- Raft River ----
  P('joel', 'raft-river', 'Joel', '👦', 'a boy at the signpost', [
    'On this bluff the trails part. Wagons bound for Oregon keep going west, and wagons bound for California turn south.',
    'Our family took the south road, so we say goodbye here.',
  ]),
  P('minnie', 'raft-river', 'Minnie', '👧', 'a girl waving goodbye', [
    'We rode together all the way from Independence, and now our friends turn the other way. We waved until they were tiny.',
    'Goodbyes are easier when you promise to write a letter.',
  ], card('wild-plum', 'Minnie gives you a plum from her pocket and a card to go with it.')),

  // ---- City of Rocks ----
  P('hugo', 'city-of-rocks', 'Hugo', '🧒', 'a boy with a pot of axle grease', [
    'Travelers write their names on the rocks with axle grease. I wrote mine, and you can write your wagon\'s name too!',
    'Some names from eighteen forty-nine can still be read on Register Rock.',
  ]),
  P('ione', 'city-of-rocks', 'Ione', '👩', 'a mother with a sketchbook', [
    'The granite spires look like a city of giant towers. I am drawing them for the folks back home.',
    'We camp in the shelter of the rocks and tell stories until the stars come out.',
  ], card('sagebrush', 'Ione presses a sprig of sagebrush in your hand, with a card to go with it.')),
  P('clyde', 'city-of-rocks', 'Clyde', '🧔', 'a wagon driver', [
    'The ground is rocky here, so I drive slowly and watch for stones.',
    'Check your wheels every morning. A rocky road is hard on a wagon.',
  ], tip('Clyde has a puzzle about spare parts. Work it out for a trade token.')),

  // ---- Humboldt Wells ----
  P('newe-guide', 'humboldt-wells', 'A Western Shoshone guide', '🧑', 'a Western Shoshone guide', [
    'The Western Shoshone call themselves Newe.',
    'Today the Te-Moak Tribe of Western Shoshone has its headquarters in Elko, Nevada, and one of its bands is based in Wells, near the head of the Humboldt River.',
  ], card('newe', 'The guide shares a card about the Western Shoshone.')),
  P('noel', 'humboldt-wells', 'Noel', '👧', 'a girl at the springs', [
    'These springs are the start of the Humboldt River. The trail follows the river across what is now Nevada.',
    'I filled every jug with cool spring water.',
  ]),
  P('pascal', 'humboldt-wells', 'Mr. Pascal', '🧑', 'a guide with a map', [
    'Follow the river and you cannot go astray. The river is the road for many days.',
    'Keep the water close and the animals fed, and the miles roll by.',
  ], food('dried berries', 10, 'Mr. Pascal gives you a bag of dried berries for the trail.')),

  // ---- Humboldt River ----
  P('rosalind', 'humboldt-river', 'Rosalind', '👩', 'a traveler with a diary', [
    'The Humboldt gives the wagons water, grass and willow wood across the Great Basin.',
    'My diary says the river is crooked and the mosquitoes are many. I like it anyway.',
  ]),
  P('tad', 'humboldt-river', 'Tad', '🧒', 'a boy herding the oxen', [
    'The oxen love the grass along the river. They eat until their sides are round.',
    'There is no ferry on this river, so we cross at a shallow spot, or float the wagon over.',
  ], tip('Tad has a puzzle about spare parts for the crossing. Work it out for a trade token.')),

  // ---- Big Meadows ----
  P('numu-guide', 'big-meadows', 'A Northern Paiute guide', '🧑', 'a Northern Paiute guide', [
    'The Northern Paiute homeland includes Pyramid Lake and the Truckee River.',
    'Today the Pyramid Lake Paiute Tribe’s reservation takes in the whole lake and the lower Truckee River.',
  ], trade('rope', 'trout', [3, 4], 'The guide offers a fair trade: three coils of rope for four strings of dried trout.')),
  P('delphine', 'big-meadows', 'Delphine', '👧', 'a girl filling a bucket', [
    'Travelers named this green valley the Big Meadows. The grass is thick and sweet here.',
    'Rest a day and fill every barrel. The desert comes next.',
  ]),
  P('orson', 'big-meadows', 'Mr. Orson', '🧔', 'a hay cutter', [
    'We cut the grass here and carry it along for the animals.',
    'Load up the grass and the water before you go on. Next is the Forty-Mile Desert.',
  ], food('cornmeal', 10, 'Mr. Orson hands over a sack of cornmeal for the road.')),

  // ---- Forty-Mile Desert ----
  P('pia', 'forty-mile-desert', 'Pia', '👧', 'a girl with a water barrel', [
    'Past the Humboldt Sink there is no water for about forty miles.',
    'Every barrel on our wagon is full to the top. Is yours?',
  ]),
  P('hollin', 'forty-mile-desert', 'Mr. Hollin', '🧓', 'an old teamster', [
    'Give the animals a long drink before you start, and keep the barrels full for them.',
    'A rested, watered team makes the desert easy. Go slow and steady.',
  ], tip('Mr. Hollin has a puzzle about water barrels. Work it out for a trade token.')),

  // ---- Truckee River ----
  P('tamsin', 'truckee-river', 'Tamsin', '👧', 'a girl at the river', [
    'My father says that in eighteen forty-four a Northern Paiute guide showed a wagon party the way to this river. The travelers called him Truckee.',
    'The water is clear and cold after the desert. I drank until I could not drink any more.',
  ]),
  P('ward', 'truckee-river', 'Ward', '🧒', 'a boy rinsing off the dust', [
    'After the desert, this cold river feels like a gift.',
    'The oxen drink and drink. We stay a while so everybody can rest.',
  ], food('fresh trout', 10, 'Ward shares a string of fresh trout from the river.')),

  // ---- Sierra summit ----
  P('washoe-guide', 'sierra-summit', 'A Washoe guide', '🧑', 'a Washoe guide', [
    'Lake Tahoe, high in the Sierra Nevada, is the heart of the Washoe homeland.',
    'Today the Washoe Tribe of Nevada and California is based in Gardnerville, Nevada.',
  ], card('washoe', 'The guide shares a card about the Washoe.')),
  P('sven', 'sierra-summit', 'Sven', '🧑', 'a wagon driver in the granite', [
    'In eighteen forty-four the first wagons crossed the Sierra Nevada, high in the granite.',
    'We reach the Sacramento Valley before winter. I can almost smell the green hills!',
  ]),
  P('tilly', 'sierra-summit', 'Tilly', '👧', 'a girl bundled in a blanket', [
    'It is cold up here among the granite. One blanket for every two people keeps the whole wagon warm.',
    'Look at the stars. They look sharper in the mountains.',
  ]),

  // ---- Sacramento Valley ----
  P('nisenan-trader', 'sacramento-valley', 'A Nisenan trader', '🧑', 'a Nisenan trader', [
    'The Nisenan homeland is along the American, Yuba and Feather rivers.',
    'Today Nisenan people belong to the Shingle Springs Band of Miwok Indians and the Nevada City Rancheria Nisenan Tribe.',
  ], trade('blankets', 'acorns', [1, 3], 'The trader offers a fair trade: one blanket for three bags of acorn meal.')),
  P('josephine', 'sacramento-valley', 'Josephine', '👩‍🌾', 'a farmer on a new claim', [
    'John Sutter began his settlement in eighteen thirty-nine, and it drew wagon parties down out of the mountains.',
    'We came for the farmland, and the soil is wonderful. Wait until you see the oak trees!',
  ], card('valley-oak', 'Josephine gives you an acorn from a valley oak, with a card to go with it.')),
  P('rory', 'sacramento-valley', 'Rory', '🧒', 'a boy planting a seed', [
    'Welcome to the Sacramento Valley! This is where your claim begins.',
    'We plant first and build after. A garden row comes before a barn.',
  ]),

  // ---- Calapooya Mountains ----
  P('kalapuya-guide', 'calapooya-mountains', 'A Kalapuya guide', '🧑', 'a Kalapuya guide', [
    'The Kalapuya people have lived in the Willamette Valley for thousands of years, and we cared for its prairies with fire so that camas and other foods grew well.',
    'Today Kalapuya people are part of the Confederated Tribes of Grand Ronde and the Confederated Tribes of Siletz Indians.',
  ], trade('blankets', 'camas', [1, 2], 'The guide offers a fair trade: one blanket for two bags of camas roots.')),
  P('eben', 'calapooya-mountains', 'Eben', '🧑', 'a neighbor heading south', [
    'In the summer of eighteen forty-eight a ship brought word that gold had been found in California, and thousands of settlers are heading south.',
    'Most of us go with pack mules, because the mountain trails are narrow.',
  ]),
  P('lottie', 'calapooya-mountains', 'Lottie', '👧', 'a neighbor girl', [
    'I am staying home to mind the farm. Bring me back a gold flake!',
    'Write to us from the road. We will read your letters aloud at supper.',
  ], food('dried apples', 10, 'Lottie packs a bag of dried apples for your journey.')),

  // ---- Umpqua River ----
  P('umpqua-guide', 'umpqua-river', 'A Cow Creek Umpqua guide', '🧑', 'a Cow Creek Umpqua guide', [
    'The Cow Creek Band of Umpqua Tribe of Indians takes its name from Cow Creek, which runs into the South Umpqua River.',
    'Today the tribe is based in Roseburg, Oregon, in its homeland.',
  ], trade('pelts', 'salmon', [3, 4], 'The guide offers a fair trade: three beaver pelts for four bundles of dried salmon.')),
  P('wilbur', 'umpqua-river', 'Wilbur', '🧒', 'a boy fishing from the bank', [
    'The river runs wide and green here. Salmon swim up rivers like this one to the place where they were born.',
    'I dream of catching one as big as my leg.',
  ]),
  P('phoebe', 'umpqua-river', 'Phoebe', '👩', 'a traveler on the Siskiyou Trail', [
    'This trail grew out of old Native footpaths through the river valleys, the Umpqua among them.',
    'Hudson’s Bay Company trappers used it too, many years before our wagons.',
  ]),

  // ---- Canyon Creek ----
  P('cal', 'canyon-creek', 'Cal', '🧑', 'a wagon wright', [
    'In eighteen forty-six the Applegate wagon party reached this canyon. It is so narrow and steep that wagons were often taken apart and let down on ropes.',
    'Piece by piece down, and then back together at the bottom. It takes teamwork.',
  ], tip('Cal sets out the pieces of a wagon and asks you to count them. Work it out for a trade token.')),
  P('marta', 'canyon-creek', 'Marta', '👧', 'a girl holding the rope', [
    'I held the end of the rope while the wagon went down. My hands were tired, but I held on.',
    'Everyone helped, even the smallest. That is how you get a wagon through a canyon.',
  ]),
  P('otis', 'canyon-creek', 'Mr. Otis', '🧓', 'a traveler with kind eyes', [
    'Slow and steady gets you through a canyon. Take your time with the rope.',
    'Rest the team at the bottom and give everyone a drink.',
  ], food('dried berries', 10, 'Mr. Otis shares a bag of dried berries.')),

  // ---- Rogue River ----
  P('takelma-guide', 'rogue-river', 'A Takelma guide', '🧑', 'a Takelma guide', [
    'Takelma means those who live along the river, and the Rogue River valley and the Table Rocks are the heart of the Takelma homeland.',
    'Today Takelma people belong to the Confederated Tribes of Siletz Indians and the Confederated Tribes of Grand Ronde.',
  ], card('takelma', 'The guide shares a card about the Takelma.')),
  P('ned', 'rogue-river', 'Ned', '🧒', 'a boy at the ford', [
    'The Rogue River runs wide and fast. Look up at the flat-topped Table Rocks above the valley.',
    'We cross where the water is shallow, and I carry my boots on my head.',
  ]),
  P('verna', 'rogue-river', 'Verna', '👩', 'a traveler admiring the view', [
    'The Table Rocks stand above the valley like two giant tables. Everyone stops to look.',
    'The valley is green with oak trees and tall grass, and the river sparkles.',
  ], card('oregon-grape', 'Verna points out an Oregon grape bush and gives you a card to go with it.')),

  // ---- Siskiyou pass ----
  P('calvin', 'siskiyou-pass', 'Calvin', '🧔', 'a pack-train driver', [
    'Most travelers cross the Siskiyou pass with mule trains, because the trail is narrow.',
    'A few wagons have crossed in the years of the gold rush, and ours is one of them.',
  ], trade('rope', 'salmon', [3, 4], 'Calvin offers a fair trade: three coils of rope for four bundles of dried salmon.')),
  P('ivy', 'siskiyou-pass', 'Ivy', '👧', 'a girl at the top of the pass', [
    'Hudson’s Bay Company trappers crossed this pass in eighteen twenty-seven, long before us.',
    'From the top the mountains roll away to the south. It is cold up here, so wrap up warm.',
  ]),

  // ---- Mount Shasta ----
  P('shasta-guide', 'mount-shasta', 'A Shasta guide', '🧑', 'a Shasta guide', [
    'The Shasta homeland is along the Klamath River and in the valleys at the foot of Mount Shasta.',
    'Shasta people still live in this country today.',
  ], card('shasta', 'The guide shares a card about the Shasta.')),
  P('ansel', 'mount-shasta', 'Ansel', '🧑', 'a traveler with a sketchbook', [
    'Mount Shasta is a volcano more than fourteen thousand feet tall, and its top is covered in snow.',
    'I could see it from far away before we got here, and I drew it at every camp.',
  ]),
  P('greer', 'mount-shasta', 'Greer', '👧', 'a girl pointing at the peak', [
    'That peak is the biggest thing I have ever seen. It looks like a giant white tent.',
    'I tried to count the days I could see it from the trail. I ran out of fingers!',
  ], card('mountain-quail', 'Greer shows you a mountain quail she spotted, with a card to go with it.')),

  // ---- Castle Crags ----
  P('wintu-guide', 'castle-crags', 'A Wintu guide', '🧑', 'a Wintu guide', [
    'The Wintu homeland is along the upper Sacramento and McCloud rivers, and salmon are at the heart of Wintu life.',
    'Today Wintu people are helping bring salmon back to the McCloud River.',
  ], trade('rope', 'salmon', [2, 3], 'The guide offers a fair trade: two coils of rope for three bundles of dried salmon.')),
  P('doreen', 'castle-crags', 'Doreen', '👩', 'a traveler beside the spires', [
    'Granite spires like a castle’s towers rise right beside the upper Sacramento River.',
    'We camp beneath them and pretend we are in a fairy tale.',
  ]),
  P('kip', 'castle-crags', 'Kip', '🧒', 'a boy on a boulder', [
    'I am the king of the castle!',
    'The spires are made of granite, a very hard gray stone. I tried to push one over, and it did not budge.',
  ], card('sugar-pine', 'Kip hands you a giant sugar pine cone and a card to go with it.')),

  // ---- Clear Creek ----
  P('millie', 'clear-creek', 'Millie', '👧', 'a girl with a gold pan', [
    'In eighteen forty-eight Pierson Reading and the Native workers with him found gold in this creek.',
    'A gold pan works because gold is heavier than sand. Swirl it, and the gold sinks to the bottom.',
  ], card('gold-pan', 'Millie lets you hold her gold pan and gives you a card about it.')),
  P('hux', 'clear-creek', 'Mr. Hux', '🧔', 'a miner at the creek bank', [
    'I swirl the pan and look for the glint at the bottom. Sometimes there is a flake, and sometimes just sand.',
    'Patience is the whole trick. Swirl, tip and look.',
  ]),
  P('jules', 'clear-creek', 'Jules', '🧑', 'a miner\'s friend', [
    'Gold fever is a funny thing. Folks forget about supper and just keep panning.',
    'Take a break and eat something. The gold will still be here after.',
  ], food('hot biscuits', 10, 'Jules hands you a stack of hot biscuits.')),

  // ---- Feather River ----
  P('maidu-guide', 'feather-river', 'A Maidu guide', '🧑', 'a Maidu guide', [
    'The Maidu homeland includes the Feather River country.',
    'Today Maidu tribes include the Mechoopda Indian Tribe of Chico Rancheria and the Berry Creek Rancheria of Maidu Indians.',
  ], trade('pelts', 'acorns', [2, 3], 'The guide offers a fair trade: two beaver pelts for three bags of acorn meal.')),
  P('bram', 'feather-river', 'Bram', '🧒', 'a boy at the creek bank', [
    'In the summer of eighteen forty-eight John Bidwell found gold on the Feather River.',
    'The spot is called Bidwell’s Bar now, and people still pan there.',
  ]),
  P('lila', 'feather-river', 'Lila', '👧', 'a girl on the riverbank', [
    'The Feather River is wide, and it runs fast over the stones. We cross carefully, with ropes.',
    'I toss in a pebble and watch the rings spread out across the water.',
  ]),

  // ---- Sutter's Fort ----
  P('pell', 'sutters-fort', 'Mr. Pell', '🧑‍💼', 'a storekeeper at the fort', [
    'Thousands of miners pass through Sutter’s Fort to buy supplies from our stores.',
    'Shovels, pans, flour and boots sell fast. Everybody needs something.',
  ]),
  P('sadie', 'sutters-fort', 'Sadie', '👧', 'a girl at the fort gate', [
    'The walls of the fort are made of adobe, which is bricks of mud and straw dried in the sun.',
    'Inside there are shops and workshops around a big yard. It is like a little town.',
  ], tip('Sadie asks how many bricks make a wall. Work it out for a trade token.')),
  P('dutch', 'sutters-fort', 'Dutch', '🧔', 'a mule trader', [
    'Mules carry the miners’ supplies up to the diggings. A good mule is a good friend.',
    'Say hello to the mules. They like carrots, and they never forget a kind face.',
  ], food('carrots', 10, 'Dutch gives you a bunch of carrots for your team.')),

  // ---- Coloma ----
  P('nisenan-guide', 'coloma', 'A Nisenan guide', '🧑', 'a Nisenan guide', [
    'The Nisenan homeland is along the American, Yuba and Feather rivers, and we call the valley at Coloma Cullumah.',
    'Today Nisenan people belong to the Shingle Springs Band of Miwok Indians and the Nevada City Rancheria Nisenan Tribe.',
  ], card('nisenan', 'The guide shares a card about the Nisenan.')),
  P('miwok-guide', 'coloma', 'A Miwok guide', '🧑', 'a Miwok guide', [
    'Miwok homelands reach along the Sierra foothills south of the American River.',
    'Today the Shingle Springs Band of Miwok Indians, whose people are Miwok and Nisenan, is based in El Dorado County, the county where Coloma is.',
  ], card('miwok', 'The guide shares a card about the Miwok.')),
  P('wren', 'coloma', 'Wren', '👧', 'a girl at the sawmill', [
    'On January twenty-fourth, eighteen forty-eight, James Marshall saw gold flakes in the water channel of Sutter’s sawmill, right here.',
    'People rock a cradle called a rocker to wash the gold out of the creek dirt. Want to try?',
  ], card('gold-rocker', 'Wren shows you how a rocker works and gives you a card about it.')),

  // ---- Home by sea ----
  P('moss', 'home-by-sea', 'Captain Moss', '🧑‍✈️', 'a schooner captain', [
    'Many Oregonians sail home from San Francisco with their gold. Welcome aboard!',
    'We go up the coast, over the bar at the mouth of the Columbia, and home.',
  ]),
  P('finn', 'home-by-sea', 'Finn', '👦', 'a ship\'s boy', [
    'Gulls follow the schooner, and sometimes a seal sits on a rock and watches us sail by.',
    'In Oregon City they make gold into coins with a beaver on them, called Beaver money.',
  ], card('beaver-money', 'Finn shows you a Beaver coin and gives you a card about it.')),
];

export const PERSON_BY_ID = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));
export const PEOPLE_BY_STOP = {};
for (const p of PEOPLE) (PEOPLE_BY_STOP[p.stop] = PEOPLE_BY_STOP[p.stop] || []).push(p);

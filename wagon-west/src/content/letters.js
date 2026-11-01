// Letters home (SPEC §3): three narrative lines picked from what happened on the leg, then the P.S. with the week's
// three spelling words (each dictated and typed on the spell panel). Written in a nine-year-old's voice: short, a
// little funny, never scary. {stop}, {river}, {width}, {animal}, {name} (a companion's name), {food} (pounds) and
// {nation} are filled by src/journey/letters.js. Keys: arrived / river / tired / happy, then one key per event id in
// events.js (the journey picks the lines for what happened), 3 to 4 lines each; v1.5 adds `stop:<legId>` (a line or two for every stop) and the keys of the forks,
// the toll, the dry stretch, the gold and the voyage, and the keys of its five new events; v1.4 adds the keys of the dog, fishing,
// the quests and the trail moments (below), where {dog} is the dog's name.
export const LETTER_OPEN = ['Dear Grandma,', 'Dear Uncle Theo,', 'Dear Miss Carter,', 'Dear everyone back home,', 'Dear Aunt June,', 'Dear Grandpa,',
  // v1.5: once a farm exists ({farm} is the farm's name; LETTER_FARM.open), and on the Gold Road, where the letters go to the family at the farm (LETTER_GOLD.open)
  'Dear everyone at {farm},', 'Dear family at {farm},'];
export const LETTER_LINES = {
  arrived: [
    'We made it to {stop} today.',
    'Today we reached {stop}. Everyone cheered.',
    'Guess where we are? {stop}! I can hardly believe it.',
    'The wagon rolled into {stop} this afternoon, and I did a little dance.',
  ],
  river: [
    'The {river} was {width}, but we crossed it just fine.',
    'We came to the {river}. It was {width}, and I held on tight to the rope.',
    'Crossing the {river} was the biggest thing all week, and it was {width}.',
    'The {river} looked {width} to me, but the ferryman knew just what to do.',
  ],
  tired: [
    'The trail was hard this week and we are all a little tired.',
    'My feet are tired, but my heart is not.',
    'We are all sleepy and dusty, and I think the oxen are too.',
    'Everyone is yawning, so we are going to rest and get a fresh start.',
  ],
  happy: [
    'The whole party is in good spirits.',
    'Everybody is cheerful and the wagon is rolling along nicely.',
    'We sang songs all afternoon, and nobody even complained once.',
    'It was one of those days when everything goes right.',
  ],
  wheel: [
    'A wheel came off, but {name} fixed it in no time.',
    'Bump! Our wheel popped right off. {name} said it was an easy job, and it was.',
    'A wheel popped off in a rut. Counting the spokes took longer than fixing it!',
  ],
  bolts: [
    'The wagon rattled so much that some bolts shook loose, but {name} tightened them up.',
    'Rattle, rattle, rattle! I counted the bolts when we fixed it. Every single one was there.',
    'We tightened the bolts on the wagon, and now it only squeaks a little.',
  ],
  mud: [
    'We got stuck in the mud and everyone had to push.',
    'Our wheels sank in a big mud hole. We all pushed, and I got mud up to my knees.',
    'Splat! The mud grabbed our wheels, but we pushed together and out we came.',
  ],
  sand: [
    'The wheels sank into soft sand, and we all pushed until the wagon rolled again.',
    'Sand got in my shoes, my hair and my lunch. Then the wagon got stuck in it too.',
    'We pushed the wagon out of deep sand. It felt like pushing a very big sandcastle.',
  ],
  storm: [
    'A thunderstorm made us stop for a day. We played cards under the wagon cover.',
    'There was thunder and rain, so we waited it out and played cards all afternoon.',
    'The thunder was loud, but we were cozy under the wagon cover with a deck of cards.',
  ],
  frost: [
    'We woke up to frost on the grass, so we stayed by the fire in our blankets.',
    'It was so cold in the morning that I could see my breath. We waited for the sun.',
    'A frosty morning! We stayed wrapped up until the sun came over the hills.',
  ],
  drizzle: [
    'It rained all day, so we stayed under the wagon cover and told stories.',
    'Soft rain fell on the wagon cover, and it sounded like tiny drums.',
    'We took a rainy day to rest and tell stories. I told the one about the jackrabbit.',
  ],
  berries: [
    'We found wild plums and picked {food} pounds of them.',
    'We picked {food} pounds of wild plums. My fingers are purple!',
    'There was a whole patch of wild plums, and we gathered {food} pounds. Yum!',
  ],
  onions: [
    'We dug wild onions in the grass and got {food} pounds of them. Our eyes watered a little.',
    'Wild onions grow right in the grass out here. We picked {food} pounds for supper.',
    'We found {food} pounds of wild onions. Supper will smell very interesting.',
  ],
  hazelnuts: [
    'We found hazelnuts beside the trail and filled our bags with {food} pounds.',
    '{food} pounds of hazelnuts! I cracked so many that my thumb is tired.',
    'We picked hazelnuts all afternoon. A squirrel watched us and looked jealous.',
  ],
  bison: [
    'A whole herd of bison crossed the trail in front of us.',
    'We waited while a giant herd of bison walked by. They are even bigger than the oxen!',
    'I saw bison today, hundreds of them, and the ground hummed when they walked.',
  ],
  pronghorn: [
    'We saw pronghorn today. They run faster than anything I have ever seen.',
    'A herd of pronghorn raced across the plain. I tried to run beside them, but no luck.',
    'Pronghorn bounded past the wagon like they had springs in their legs.',
  ],
  coyote: [
    'A coyote sang to the sky at dusk, and I tried to sing back.',
    'We heard a coyote at sunset. It sounded like it was telling a very long joke.',
    'At dusk a coyote stood on a ridge and sang. I think it liked our campfire.',
  ],
  eagle: [
    'A big eagle circled over our wagon today. I waved, but it kept flying.',
    'We saw an eagle floating high in the sky. Its wings did not even flap.',
    'An eagle flew over us, and everybody stopped to watch it.',
  ],
  trade: [
    'We traded with the {nation} people at a trading post.',
    'At the trading post we traded fairly with the {nation} people and got good food.',
    'We did some trading with the {nation} people today, and I did the math myself.',
  ],
  swap: [
    'A friendly {nation} camp invited us to trade, and we swapped goods fairly.',
    'We stopped at a trading camp and traded with the {nation} people. Everybody was happy with the swap.',
    'The {nation} people have good things to trade, and we had a long, fair talk about the rates.',
  ],
  hunt: [
    '{name} and I went hunting with the bow and brought back supper.',
    'I took the bow with {name} today and we brought back supper. Got one!',
    'We followed tracks with the bow, and supper was worth the walk.',
  ],
  deer: [
    'A deer stepped out of the pines, and {name} and I brought back supper with the bow.',
    'We were quiet as mice when the deer came. Then we got supper with the bow.',
    'Hunting with the bow in the pines was hard, but we got supper at last.',
  ],
  fish: [
    'We caught fish in a still pool by the trail.',
    'I caught a fish in a quiet pool. It was nearly as long as my arm!',
    'We went fishing in a still pool, and supper jumped right onto the line.',
  ],
  trout: [
    'We caught trout in a cold, clear creek, and my toes got numb.',
    'The creek was so clear that I could see the trout. I caught one!',
    'We fished in a creek for trout and had a fine supper.',
  ],
  salmon: [
    'We saw silver salmon in the river and caught some for supper.',
    'The salmon were flashing in the river, and we caught a few. They were delicious.',
    'I fished for salmon today. They are slippery and strong!',
  ],
  // ---- v1.4 (SPEC §2.7): the dog, fishing 2.0, the quests and the trail moments. 3 lines each, no {food}. {dog} is the dog's
  // name; only the keys that happen with the dog use it (a letter line that names the dog is chosen only when there is one).
  // `far-off-crack` and `prairie-glow` have no letter line, on purpose. ----
  nose: [
    '{dog} ran off the trail today and came back with a surprise.',
    'Every time {dog} sniffs something out in the grass, I wonder what the surprise will be.',
    '{dog} found something new today, and I added it to my sketchbook.',
  ],
  chase: [
    '{dog} chased a jackrabbit all the way to the horizon, and then came trotting back.',
    'A jackrabbit zipped by and {dog} zoomed after it. We all cheered when {dog} came back.',
    '{dog} went racing after a jackrabbit today. The rabbit won, but {dog} had fun.',
  ],
  snake: [
    '{dog} stopped short and barked and barked, and a rattlesnake slid away into the grass.',
    'A rattlesnake was sunning on the trail. {dog} warned us, and we gave it plenty of room.',
    'Good dog! {dog} spotted a rattlesnake before any of us did.',
  ],
  fetch: [
    'We played fetch by the campfire, and {dog} ran so fast, ears flapping.',
    'I threw the stick as far as I could, and {dog} brought it right back.',
    'After supper {dog} and I played fetch until {dog} flopped down by the fire.',
  ],
  sturgeon: [
    'I caught a white sturgeon today! It was so big it took two of us to pull it in.',
    'A giant white sturgeon bit my line, and a friend helped me reel it in. It was longer than I am tall!',
    'Guess what I caught? A white sturgeon, one of the biggest fish in all of North America.',
  ],
  'fish-boot': [
    'I fished all afternoon and caught an old boot. Somebody is walking around with one wet sock!',
    'My big catch today was a boot. Everybody laughed, and so did I.',
    'I felt a tug on my line, and up came an old boot instead of a fish.',
  ],
  'quest-locket': [
    'We found a little silver locket by the river. It belongs to a girl named Molly Rowe, and it is going back to her.',
    'Molly Rowe dropped her grandma\'s locket at the Kansas River, and our dog found it. Now it is back where it belongs.',
    'I hope Molly smiles when she opens her grandma\'s locket again.',
  ],
  'quest-note': [
    'I fished a bottle out of the river with a note inside from a boy named Sam, who is headed for The Dalles.',
    'A bottle came up on my fishing line with a hello from Sam. I hope he knows his note floated a long way.',
    'Sam sent a note in a bottle, and I got to say hello back. Notes in bottles really do float a long way.',
  ],
  'dust-devil': [
    'A dust devil whirled across the trail and blew every hat right off our heads.',
    'Whoosh! A dust devil snatched our hats, and we ran around catching them.',
    'We chased our hats all over the prairie after a dust devil came through.',
  ],
  stones: [
    'I skipped a stone across the river today, and it hopped and hopped and hopped.',
    'We skipped stones on the riverbank. My best throw made the water ring again and again.',
    'I found a flat stone and skipped it on the water. Count the rings next time!',
  ],
  meteors: [
    'Falling stars streaked across the sky tonight, and I made a wish on one.',
    'We lay by the fire and watched falling stars. I tapped one and made a wish.',
    'The night sky was full of falling stars. I will not tell you my wish, but it was a good one.',
  ],
  'grizzly-ridge': [
    'We saw a grizzly bear way up on a ridge. We stayed together and gave it lots of room.',
    'A grizzly bear lifted its nose to sniff the wind high on a faraway ridge, and then it ambled off.',
    'Far away on a ridge, a big grizzly bear watched the wagon go by. It never came any closer.',
  ],
  'wolf-song': [
    'At sunset we heard wolves singing from far across the plain.',
    'The wolves sang to each other from a faraway ridge tonight. It was beautiful.',
    'We listened to the wolves sing while the sun went down. They sounded like a faraway choir.',
  ],
  'pronghorn-race': [
    'A pronghorn raced our wagon today and won.',
    'A pronghorn ran right alongside the wagon, then zoomed ahead and left us in the dust.',
    'We had a race with a pronghorn. It did not even look tired.',
  ],
  // ---- v1.5 (SPEC §2.9): a line or three for every stop (`stop:<legId>`), told when the letter covers that leg (a letter tells the legs
  // since the last letter, picking the liveliest lines); then the forks, the shortcuts, the toll and the gold. 2 or 3 lines each, no
  // {food}, no digits (numbers as words, so a line can be read aloud as it stands). The Gold Road letters go to the family at the farm. ----
  'stop:kansas-river': [
    'The ferry carried our whole wagon across the Kansas River, and it cost a fee.',
    'A Kansa guide told us the river and the state are named for the Kansa people.',
  ],
  'stop:alcove-spring': [
    'We camped by a spring that fell over a rock ledge like a little waterfall.',
    'People carved their names in the rock here, so I went looking for the oldest one.',
  ],
  'stop:fort-kearny': [
    'Fort Kearny has a blacksmith shop and a post office, which is a big deal out here.',
    'The blacksmith looked at our wheels, and we stopped to write letters.',
  ],
  'stop:ash-hollow': [
    'We came down steep Windlass Hill into a shady hollow full of ash trees.',
    'The spring at Ash Hollow tastes sweet, and I drank three cups.',
  ],
  'stop:chimney-rock': [
    'Chimney Rock stuck up from the plain like a giant chimney, and we could see it for miles.',
    'Everybody writes about Chimney Rock in their diaries, so I did too.',
  ],
  'stop:scotts-bluff': [
    'The bluffs at Scotts Bluff are about eight hundred feet tall, and I got a sore neck looking up.',
    'Our wagon rolled through Mitchell Pass right beside them.',
  ],
  'stop:fort-laramie': [
    'Fort Laramie began as a trading post for furs and bison robes, and now wagon parties stop there.',
    'We rested the team at Fort Laramie and wrote home.',
  ],
  'stop:north-platte': [
    'We took a ferry across the North Platte River, and the water was high and fast.',
    'Mormon pioneers built the ferry, and they charge a fee for each wagon.',
  ],
  'stop:independence-rock': [
    'Independence Rock is a giant granite rock covered in names, and some are very old.',
    'I looked for the oldest name I could find, then I wrote our wagon’s name in my diary.',
  ],
  'stop:ice-slough': [
    'We dug under the grass at Ice Slough and found real ice, in July!',
    'We had ice water with supper, and it was the best drink ever.',
  ],
  'stop:south-pass': [
    'We crossed the Continental Divide at South Pass. It is wide and gentle, not scary at all.',
    'Water on one side of the pass runs to the Atlantic, and water on the other side runs to the Pacific.',
  ],
  'stop:green-river': [
    'We crossed the Green River on a ferry, because fording it is risky.',
    'The ferryman said to keep the team calm, so I patted the animals the whole way.',
  ],
  'stop:fort-bridger': [
    'Fort Bridger is a trading post where wagon parties trade, buy supplies and fix their wagons.',
    'We mended what needed mending, and then we wrote home.',
  ],
  'stop:soda-springs': [
    'The water at Soda Springs fizzes right out of the ground, and it tickled my nose.',
    'I took a sip of the bubbly water and made a funny face.',
  ],
  'stop:fort-hall': [
    'At Fort Hall the road forks, and wagons go to Oregon or to California.',
    'Fort Hall is a trading post in what is now Idaho, and the team had a good rest there.',
  ],
  'stop:snake-river': [
    'At Three Island Crossing we waded from island to island across the Snake River.',
    'I held on tight, and the water only came up to my knees.',
  ],
  'stop:farewell-bend': [
    'Farewell Bend is the last camp on the Snake River, so we said goodbye to the river.',
    'We followed that river for more than three hundred miles!',
  ],
  'stop:blue-mountains': [
    'The Blue Mountains have cool pine forests, and the shade felt wonderful after the hot trail.',
    'We saw old wagon ruts in the ground that are still there today.',
  ],
  'stop:the-dalles': [
    'At The Dalles the Columbia River squeezes through a narrow channel.',
    'We had to choose between the raft and the Barlow Road.',
  ],
  'stop:willamette-valley': [
    'We made it to the Willamette Valley, where the soil is rich and dark!',
    'We saw Willamette Falls at Oregon City, and it roars louder than a hundred wagons.',
  ],
  'stop:sublette-cutoff': [
    'We took the Sublette Cutoff, a shorter way with a long dry stretch.',
    'We filled every barrel before we started, and everybody shared the water.',
  ],
  'stop:bear-river': [
    'The shortcut and the old trail met again in the valley of the Bear River.',
    'It felt like meeting old friends on the road.',
  ],
  'stop:lander-road': [
    'We took the Lander Road, a road the government built for emigrants.',
    'It is shorter than the old trail, with grass and water, and the team was happy.',
  ],
  'stop:barlow-road': [
    'We took the Barlow Road, a toll road around Mount Hood.',
    'At the end of the road we rolled right into Oregon City.',
  ],
  'stop:raft-river': [
    'At the Raft River the trails parted, and we turned south toward California.',
    'We waved goodbye to the wagons bound for Oregon.',
  ],
  'stop:city-of-rocks': [
    'City of Rocks has giant granite spires, and travelers write their names there in axle grease.',
    'Some of the names are from the year eighteen forty-nine.',
  ],
  'stop:humboldt-wells': [
    'Humboldt Wells are springs where the Humboldt River begins.',
    'We will follow that river across Nevada.',
  ],
  'stop:humboldt-river': [
    'The Humboldt River gives us water, grass and willow wood.',
    'The river is crooked and has no ferry, so we crossed at a shallow spot.',
  ],
  'stop:big-meadows': [
    'We camped in the Big Meadows, a green valley with thick, sweet grass.',
    'We cut grass for the team and filled every barrel before the desert.',
  ],
  'stop:forty-mile-desert': [
    'We crossed the Forty-Mile Desert with every barrel full to the top.',
    'There was no water at all out there, but the team did great.',
  ],
  'stop:truckee-river': [
    'The Truckee River was cold and clear after the desert.',
    'Long ago a Northern Paiute guide showed a wagon party this river, and they named it for him.',
  ],
  'stop:sierra-summit': [
    'We crossed the Sierra Nevada, high in the granite, and it was cold up there.',
    'Down the other side is the Sacramento Valley.',
  ],
  'stop:sacramento-valley': [
    'We reached the Sacramento Valley, and we have a claim of our own!',
    'The oak trees are huge, and the soil is good for farming.',
  ],
  'stop:calapooya-mountains': [
    'We left the farm and climbed the Calapooya Mountains, which are named for the Kalapuya people.',
    'Our neighbors waved goodbye and told us to write.',
  ],
  'stop:umpqua-river': [
    'We crossed the Umpqua River on the trail south.',
    'This trail grew out of old Native footpaths, so we are following a very old road.',
  ],
  'stop:canyon-creek': [
    'At Canyon Creek the wagon went down the steep canyon on ropes.',
    'Everybody held the rope, even me.',
  ],
  'stop:rogue-river': [
    'We saw the flat-topped Table Rocks above the Rogue River valley.',
    'We crossed where the water was shallow, and I carried my boots.',
  ],
  'stop:siskiyou-pass': [
    'We crossed the Siskiyou pass, and it was cold up there.',
    'Most travelers cross with mule trains, so we felt like a very special wagon.',
  ],
  'stop:mount-shasta': [
    'We saw Mount Shasta from far away, and it kept getting bigger.',
    'It is a huge snowy volcano, and I drew it in my sketchbook.',
  ],
  'stop:castle-crags': [
    'Castle Crags look like a castle made of granite.',
    'We camped under the spires and pretended to be in a story.',
  ],
  'stop:clear-creek': [
    'Clear Creek is where gold was found in the north of California, and we stopped to pan.',
    'The creek bank was full of miners with pans and smiles.',
  ],
  'stop:feather-river': [
    'We crossed the Feather River, near the spot called Bidwell’s Bar.',
    'Gold was found here in the summer of eighteen forty-eight.',
  ],
  'stop:sutters-fort': [
    'Sutter’s Fort has thick adobe walls and stores where miners buy their supplies.',
    'Thousands of miners come through the fort.',
  ],
  'stop:coloma': [
    'We stood at Coloma, where gold flakes were first seen in eighteen forty-eight.',
    'The Nisenan call this valley Cullumah.',
  ],
  'stop:home-by-sea': [
    'We sailed home from San Francisco, and the schooner danced over the waves.',
    'The gulls followed us all the way up the coast.',
  ],
  // ---- the forks and the new ways ----
  'fork-oregon': [
    'At Fort Hall we chose the road to Oregon, west along the Snake River.',
    'Agnes at the fort said the Willamette Valley has rich farmland, so on to Oregon!',
    'We took the Oregon road from Fort Hall. Our family planned it, and it still felt like a big choice.',
  ],
  'fork-california': [
    'At Fort Hall we turned south toward California. The road goes across a desert and over the mountains!',
    'We chose the California Trail at Fort Hall. Agnes said to fill every barrel before the desert.',
    'We said goodbye to the Oregon road and turned south at the Raft River.',
  ],
  sublette: [
    'We chose the Sublette Cutoff to save time, and we packed lots of water.',
    'The cutoff is dry, but it felt like a shortcut through the whole sky.',
    'We skipped Fort Bridger on the Sublette Cutoff, so we had to count our supplies carefully.',
  ],
  lander: [
    'We took the Lander Road, a new road with grass and water all the way.',
    'The Lander Road skips Fort Bridger and Soda Springs, but it makes the trail much shorter.',
    'The government built the Lander Road for emigrants, and it was a pleasure to ride.',
  ],
  barlow: [
    'At The Dalles we chose the Barlow Road instead of the raft.',
    'The Barlow Road goes around Mount Hood, and the mountain looked enormous.',
    'We took the Barlow Road, and the oxen walked every mile of it.',
  ],
  toll: [
    'At the toll gate the keeper wrote our name in his book, and we rolled right through.',
    'The Barlow Road has a toll, which is a fee that pays for the road.',
    'We stopped at the toll gate, and the toll keeper was kind to everyone.',
  ],
  'laurel-hill': [
    'At Laurel Hill the wagon went down the steep slope on a rope round a stump.',
    'Laurel Hill is so steep that the wagons are let down very slowly. I held the rope and did not let go.',
    'We got down Laurel Hill with a rope and a cheer.',
  ],
  dry: [
    'We drove through a dry stretch with no water, and we sipped from the barrel.',
    'The dry country was hot and quiet, but the barrel held enough for everybody.',
    'We crossed a long stretch with no water, and the water barrel was the hero of the day.',
  ],
  spring: [
    'We found a hidden spring beside the trail, and everybody had a long, sweet drink.',
    'A little spring bubbled up right when we needed it. It felt like magic.',
    'In the middle of the dry country we found cool water. What a surprise!',
  ],
  ice: [
    'We dug ice out of the bog in the middle of the summer!',
    'Ice at Ice Slough! We rubbed it on our faces and it felt wonderful.',
    'We found clear ice under the grass, and we shared it all around.',
  ],
  pan: [
    'I swirled the gold pan and found a flake that sparkled like a star.',
    'Panning for gold is slow, and the best part is the glint at the bottom of the pan.',
    'Swirl, tip and look: that is how you pan for gold. I found flakes!',
  ],
  nugget: [
    'I found a nugget! It is a little lump of gold, and I held it in my palm.',
    'Guess what was in my pan? A nugget! It was tiny and very bright.',
    'A nugget is rare, and I found one. I might not stop smiling all week.',
  ],
  rocker: [
    'We rocked the cradle on the beat while the water poured, and the gold stayed behind.',
    'The rocker is a wooden cradle for washing creek dirt, and rocking it was great fun.',
    'We took turns rocking the cradle. The sand washed away and the flakes stayed.',
  ],
  'gold-fever': [
    'Miners ran past us singing about gold fever, and we laughed and waved.',
    'A crowd of miners dashed by with pans and shovels, all in a great mood.',
    'We met some miners with gold fever, and they were so excited that they forgot their hats.',
  ],
  sail: [
    'We sailed up the coast, and the schooner rocked on the swells.',
    'The sea is bigger than anything. The gulls followed us the whole way.',
    'Up the coast we went, with the wind in the sails and the water sparkling.',
  ],
  swell: [
    'The wind dropped and the schooner sat still, so we fished off the side.',
    'We were becalmed for a day, and the crew dangled lines over the rail.',
    'The sea was as smooth as glass, and we waited for the breeze.',
  ],
  bar: [
    'We sailed over the Columbia bar, where the waves were big, and then the water went calm.',
    'The bar at the mouth of the Columbia was bumpy, and then we saw Oregon’s green shore.',
    'Over the bar and into the Columbia! Home is just up the river.',
  ],
};
export const LETTER_PS = 'P.S. My spelling words this week: {w1}, {w2} and {w3}.';
export const LETTER_CLOSE = ['Love,', 'Your friend,', 'See you in Oregon,', 'Yours truly,', 'See you at {farm},', 'Home soon, with gold!'];
// The v1.5 openings and closings that need something: a farm (the ledger has a site) or the Gold Road. The journey picks from LETTER_OPEN / LETTER_CLOSE
// without these unless it has the farm / is on the Gold Road; on the Gold Road it picks LETTER_GOLD.open, and 'Home soon, with gold!' only on the way home.
export const LETTER_FARM = { open: ['Dear everyone at {farm},'], close: ['See you at {farm},'] };
export const LETTER_GOLD = { open: ['Dear family at {farm},'], close: ['Home soon, with gold!'] };

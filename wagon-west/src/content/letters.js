// Letters home (SPEC §3): three narrative lines picked from what happened on the leg, then the P.S. with the week's
// three spelling words (each dictated and typed on the spell panel). Written in a nine-year-old's voice: short, a
// little funny, never scary. {stop}, {river}, {width}, {animal}, {name} (a companion's name), {food} (pounds) and
// {nation} are filled by src/journey/letters.js. Keys: arrived / river / tired / happy, then one key per event id in
// events.js (the journey picks the lines for what happened), 3 to 4 lines each; v1.4 adds the keys of the dog, fishing,
// the quests and the trail moments (below), where {dog} is the dog's name.
export const LETTER_OPEN = ['Dear Grandma,', 'Dear Uncle Theo,', 'Dear Miss Carter,', 'Dear everyone back home,', 'Dear Aunt June,', 'Dear Grandpa,'];
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
};
export const LETTER_PS = 'P.S. My spelling words this week: {w1}, {w2} and {w3}.';
export const LETTER_CLOSE = ['Love,', 'Your friend,', 'See you in Oregon,', 'Yours truly,'];

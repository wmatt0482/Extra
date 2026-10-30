// Letters home (SPEC §3): three narrative lines picked from what happened on the leg, then the P.S. with the week's
// three spelling words (each dictated and typed on the spell panel). Written in a nine-year-old's voice: short, a
// little funny, never scary. {stop}, {river}, {width}, {animal}, {name} (a companion's name), {food} (pounds) and
// {nation} are filled by src/journey/letters.js. Keys: arrived / river / tired / happy, then one key per event id in
// events.js (the journey picks the lines for what happened), 3 to 4 lines each.
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
    'We lost a wheel in a rut. Counting the spokes took longer than fixing it!',
  ],
  bolts: [
    'The wagon rattled so much that some bolts shook loose, but {name} tightened them up.',
    'Rattle, rattle, rattle! I counted the bolts when we fixed it. Not one got lost.',
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
};
export const LETTER_PS = 'P.S. My spelling words this week: {w1}, {w2} and {w3}.';
export const LETTER_CLOSE = ['Love,', 'Your friend,', 'See you in Oregon,', 'Yours truly,'];

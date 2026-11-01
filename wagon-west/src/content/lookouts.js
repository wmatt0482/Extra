// The real fact read aloud at each stop (SPEC §3 "lookout", v1.5 §2.2 to §2.4): one or two sentences a 4th grader can follow, true,
// and traceable to docs/SOURCES.md. `say` is the spoken form (numbers in words, no abbreviations). One per leg id of every route
// (45) plus 'independence' (the start) and 'gold-news' (the Gold Road's start at the farm). Where a number was uncertain it was left out
// rather than guessed, and no mileage a shortcut saves, no price and no head count is read aloud (SOURCES.md, "Things v1.5
// deliberately does not say"). 1.3's twelve lookouts are kept, with Fort Hall's changed (Soda Springs has its own stop now).
export const LOOKOUTS = {
  'independence': {
    text: 'Most wagon parties left Independence, Missouri in late April or May, once the prairie grass was tall enough to feed the animals. From there the Oregon Trail ran more than 2,000 miles to Oregon.',
    say: 'Most wagon parties left Independence, Missouri in late April or May, once the prairie grass was tall enough to feed the animals. From there the Oregon Trail ran more than two thousand miles to Oregon.',
    source: 'SOURCES.md#independence' },
  'kansas-river': {
    text: 'The Kansas River was one of the first big crossings. Local families ran ferries that carried wagons across for a fee.',
    say: 'The Kansas River was one of the first big crossings. Local families ran ferries that carried wagons across for a fee.',
    source: 'SOURCES.md#kansas-river' },
  'fort-kearny': {
    text: 'Fort Kearny was built in 1848 to help travelers on the trail. It had a blacksmith shop for wagon repairs, and travelers could send letters home from there.',
    say: 'Fort Kearny was built in eighteen forty-eight to help travelers on the trail. It had a blacksmith shop for wagon repairs, and travelers could send letters home from there.',
    source: 'SOURCES.md#fort-kearny' },
  'chimney-rock': {
    text: 'Chimney Rock is a tall spire that rises hundreds of feet above the North Platte River valley. Travelers could spot it from miles away, and many wrote about it in their diaries.',
    say: 'Chimney Rock is a tall spire that rises hundreds of feet above the North Platte River valley. Travelers could spot it from miles away, and many wrote about it in their diaries.',
    source: 'SOURCES.md#chimney-rock' },
  'fort-laramie': {
    text: 'Fort Laramie began in 1834 as a trading post where people traded furs and bison robes. In 1849 the army bought it, and it became a busy stop for wagon parties.',
    say: 'Fort Laramie began in eighteen thirty-four as a trading post where people traded furs and bison robes. In eighteen forty-nine the army bought it, and it became a busy stop for wagon parties.',
    source: 'SOURCES.md#fort-laramie' },
  'independence-rock': {
    text: 'Independence Rock is a huge granite rock beside the Sweetwater River. Travelers carved or painted their names on it, and some of the names can still be seen today.',
    say: 'Independence Rock is a huge granite rock beside the Sweetwater River. Travelers carved or painted their names on it, and some of the names can still be seen today.',
    source: 'SOURCES.md#independence-rock' },
  'south-pass': {
    text: 'South Pass is a wide, gentle gap in the Rocky Mountains, more than 7,000 feet above sea level. Wagons could cross the Continental Divide here without climbing steep cliffs.',
    say: 'South Pass is a wide, gentle gap in the Rocky Mountains, more than seven thousand feet above sea level. Wagons could cross the Continental Divide here without climbing steep cliffs.',
    source: 'SOURCES.md#south-pass' },
  'fort-bridger': {
    text: 'Jim Bridger and Louis Vasquez started Fort Bridger in 1843 as a trading post. Wagon parties stopped there to trade, buy supplies and fix their wagons.',
    say: 'Jim Bridger and Louis Vasquez started Fort Bridger in eighteen forty-three as a trading post. Wagon parties stopped there to trade, buy supplies and fix their wagons.',
    source: 'SOURCES.md#fort-bridger' },
  'fort-hall': {
    text: 'Wagons bound for Oregon and wagons bound for California shared the road as far as the Raft River. Fort Hall, in what is now Idaho, was a trading post where wagon parties rested and traded.',
    say: 'Wagons bound for Oregon and wagons bound for California shared the road as far as the Raft River. Fort Hall, in what is now Idaho, was a trading post where wagon parties rested and traded.',
    source: 'SOURCES.md#fort-hall' },
  'snake-river': {
    text: 'At Three Island Crossing in Idaho, wagon parties could wade across the Snake River by going from island to island. Parties that skipped the crossing took a longer, drier trail along the south side.',
    say: 'At Three Island Crossing in Idaho, wagon parties could wade across the Snake River by going from island to island. Parties that skipped the crossing took a longer, drier trail along the south side.',
    source: 'SOURCES.md#snake-river' },
  'blue-mountains': {
    text: 'In the Blue Mountains of Oregon, the cool shade of the pine forests felt wonderful after miles of hot, dry travel. Wagon wheels left ruts here that can still be seen in places today.',
    say: 'In the Blue Mountains of Oregon, the cool shade of the pine forests felt wonderful after miles of hot, dry travel. Wagon wheels left ruts here that can still be seen in places today.',
    source: 'SOURCES.md#blue-mountains' },
  'the-dalles': {
    text: 'At The Dalles the Columbia River squeezes through a narrow channel. From here, wagon parties floated downriver on rafts or took the Barlow Road, a toll road that opened in 1846.',
    say: 'At The Dalles the Columbia River squeezes through a narrow channel. From here, wagon parties floated downriver on rafts or took the Barlow Road, a toll road that opened in eighteen forty-six.',
    source: 'SOURCES.md#the-dalles' },
  'willamette-valley': {
    text: 'Oregon City, at the end of the Oregon Trail, sits beside Willamette Falls. The valley around it has rich soil, which is why so many families came here to farm.',
    say: 'Oregon City, at the end of the Oregon Trail, sits beside Willamette Falls. The valley around it has rich soil, which is why so many families came here to farm.',
    source: 'SOURCES.md#willamette-valley' },
  // ---- v1.5: the emigrant trail's new stops ----
  'alcove-spring': {
    text: 'At Alcove Spring a little stream falls over a rock ledge into a cool pool near the Big Blue River. Travelers camped here while they waited to cross the river, and some carved their names in the rock. Carvings from 1846 can still be seen.',
    say: 'At Alcove Spring a little stream falls over a rock ledge into a cool pool near the Big Blue River. Travelers camped here while they waited to cross the river, and some carved their names in the rock. Carvings from eighteen forty-six can still be seen.',
    source: 'SOURCES.md#alcove-spring' },
  'ash-hollow': {
    text: 'Ash Hollow is named for its ash trees, and its sweet spring made it a favorite stop. Wagons came down steep Windlass Hill into the hollow, and some were eased down on ropes. The ruts they wore in the ground can still be seen.',
    say: 'Ash Hollow is named for its ash trees, and its sweet spring made it a favorite stop. Wagons came down steep Windlass Hill into the hollow, and some were eased down on ropes. The ruts they wore in the ground can still be seen.',
    source: 'SOURCES.md#ash-hollow' },
  'scotts-bluff': {
    text: 'The bluffs of Scotts Bluff tower about 800 feet over the North Platte River. Wagons rolled through nearby Mitchell Pass, and a stretch of the old road is a walking trail today.',
    say: 'The bluffs of Scotts Bluff tower about eight hundred feet over the North Platte River. Wagons rolled through nearby Mitchell Pass, and a stretch of the old road is a walking trail today.',
    source: 'SOURCES.md#scotts-bluff' },
  'north-platte': {
    text: 'In June 1847 Mormon pioneers built a ferry near present-day Casper, Wyoming. They carried emigrant wagons across the high, fast North Platte River for a fee.',
    say: 'In June eighteen forty-seven Mormon pioneers built a ferry near present-day Casper, Wyoming. They carried emigrant wagons across the high, fast North Platte River for a fee.',
    source: 'SOURCES.md#north-platte' },
  'ice-slough': {
    text: 'Under the boggy grass at Ice Slough, travelers dug down about a foot and found clear ice, even in July.',
    say: 'Under the boggy grass at Ice Slough, travelers dug down about a foot and found clear ice, even in July.',
    source: 'SOURCES.md#ice-slough' },
  'green-river': {
    text: 'Fording the Green River was risky, so most travelers paid one of the ferries to carry their wagons across.',
    say: 'Fording the Green River was risky, so most travelers paid one of the ferries to carry their wagons across.',
    source: 'SOURCES.md#green-river' },
  'soda-springs': {
    text: 'At Soda Springs, travelers tasted fizzy, bubbly water that came right out of the ground.',
    say: 'At Soda Springs, travelers tasted fizzy, bubbly water that came right out of the ground.',
    source: 'SOURCES.md#soda-springs' },
  'farewell-bend': {
    text: 'Farewell Bend was the last camp on the Snake River, after the trail had followed it for more than 300 miles. From here the wagons said goodbye to the river and went overland.',
    say: 'Farewell Bend was the last camp on the Snake River, after the trail had followed it for more than three hundred miles. From here the wagons said goodbye to the river and went overland.',
    source: 'SOURCES.md#farewell-bend' },
  // ---- the branches ----
  'sublette-cutoff': {
    text: 'The Sublette Cutoff opened in 1844 as a shortcut west from South Pass. It was a shorter way, but it crossed a long dry stretch with no water, so travelers filled every barrel before they set out.',
    say: 'The Sublette Cutoff opened in eighteen forty-four as a shortcut west from South Pass. It was a shorter way, but it crossed a long dry stretch with no water, so travelers filled every barrel before they set out.',
    source: 'SOURCES.md#sublette-cutoff' },
  'bear-river': {
    text: 'In the valley of the Bear River the shortcut and the old trail met again, and the wagon parties rolled on together toward Soda Springs.',
    say: 'In the valley of the Bear River the shortcut and the old trail met again, and the wagon parties rolled on together toward Soda Springs.',
    source: 'SOURCES.md#bear-river' },
  'lander-road': {
    text: 'The Lander Road was built in 1858 and 1859, one of the first roads the government built for emigrants. It was much shorter than the old trail, with grass and water along the way.',
    say: 'The Lander Road was built in eighteen fifty-eight and eighteen fifty-nine, one of the first roads the government built for emigrants. It was much shorter than the old trail, with grass and water along the way.',
    source: 'SOURCES.md#lander-road' },
  'barlow-road': {
    text: 'The Barlow Road opened in 1846 as a toll road around Mount Hood. The toll was five dollars a wagon, and at steep Laurel Hill the wagons were let down the slope on ropes and chains.',
    say: 'The Barlow Road opened in eighteen forty-six as a toll road around Mount Hood. The toll was five dollars a wagon, and at steep Laurel Hill the wagons were let down the slope on ropes and chains.',
    source: 'SOURCES.md#barlow-road' },
  // ---- the California Trail ----
  'raft-river': {
    text: 'At the Raft River the trails parted. Wagons bound for Oregon kept going west, and wagons bound for California turned south.',
    say: 'At the Raft River the trails parted. Wagons bound for Oregon kept going west, and wagons bound for California turned south.',
    source: 'SOURCES.md#raft-river' },
  'city-of-rocks': {
    text: 'City of Rocks is a valley of giant granite spires. Travelers camped here and wrote their names in axle grease, and some names from 1849 can still be read on Register Rock.',
    say: 'City of Rocks is a valley of giant granite spires. Travelers camped here and wrote their names in axle grease, and some names from eighteen forty-nine can still be read on Register Rock.',
    source: 'SOURCES.md#city-of-rocks' },
  'humboldt-wells': {
    text: 'Humboldt Wells are springs at the head of the Humboldt River, the river the trail followed across what is now Nevada.',
    say: 'Humboldt Wells are springs at the head of the Humboldt River, the river the trail followed across what is now Nevada.',
    source: 'SOURCES.md#humboldt-wells' },
  'humboldt-river': {
    text: 'The Humboldt River gave the wagons water, grass and willow wood all the way across the Great Basin, though many travelers grumbled about it in their diaries.',
    say: 'The Humboldt River gave the wagons water, grass and willow wood all the way across the Great Basin, though many travelers grumbled about it in their diaries.',
    source: 'SOURCES.md#humboldt-river' },
  'big-meadows': {
    text: 'Travelers named this green valley the Big Meadows. They stopped here for water and grass before the desert.',
    say: 'Travelers named this green valley the Big Meadows. They stopped here for water and grass before the desert.',
    source: 'SOURCES.md#big-meadows' },
  'forty-mile-desert': {
    text: 'Past the Humboldt Sink there was no water for about 40 miles, so wagon parties filled every barrel before they set out.',
    say: 'Past the Humboldt Sink there was no water for about forty miles, so wagon parties filled every barrel before they set out.',
    source: 'SOURCES.md#forty-mile-desert' },
  'truckee-river': {
    text: 'In 1844 a Northern Paiute guide, whom the travelers called Truckee, showed a wagon party the way to this river, and they named it for him.',
    say: 'In eighteen forty-four a Northern Paiute guide, whom the travelers called Truckee, showed a wagon party the way to this river, and they named it for him.',
    source: 'SOURCES.md#truckee-river' },
  'sierra-summit': {
    text: 'In 1844 the first wagons crossed the Sierra Nevada, high in the granite, and reached the Sacramento Valley before winter.',
    say: 'In eighteen forty-four the first wagons crossed the Sierra Nevada, high in the granite, and reached the Sacramento Valley before winter.',
    source: 'SOURCES.md#sierra-summit' },
  'sacramento-valley': {
    text: 'John Sutter began his settlement here in 1839, and it drew wagon parties down out of the mountains. Settlers came for the farmland before anyone found gold.',
    say: 'John Sutter began his settlement here in eighteen thirty-nine, and it drew wagon parties down out of the mountains. Settlers came for the farmland before anyone found gold.',
    source: 'SOURCES.md#sacramento-valley' },
  // ---- the Gold Road ----
  'gold-news': {
    text: 'In the summer of 1848 a ship brought word to Oregon that gold had been found in California, and thousands of settlers headed south.',
    say: 'In the summer of eighteen forty-eight a ship brought word to Oregon that gold had been found in California, and thousands of settlers headed south.',
    source: 'SOURCES.md#gold-news' },
  'calapooya-mountains': {
    text: 'The mountains between the Willamette and Umpqua valleys are named for the Kalapuya people.',
    say: 'The mountains between the Willamette and Umpqua valleys are named for the Kalapuya people.',
    source: 'SOURCES.md#calapooya-mountains' },
  'umpqua-river': {
    text: 'The trail south, called the Siskiyou Trail, grew out of Native footpaths through the river valleys, the Umpqua among them.',
    say: 'The trail south, called the Siskiyou Trail, grew out of Native footpaths through the river valleys, the Umpqua among them.',
    source: 'SOURCES.md#umpqua-river' },
  'canyon-creek': {
    text: 'In 1846 the Applegate wagon party reached Canyon Creek, a canyon so narrow and steep that wagons were often taken apart and let down on ropes.',
    say: 'In eighteen forty-six the Applegate wagon party reached Canyon Creek, a canyon so narrow and steep that wagons were often taken apart and let down on ropes.',
    source: 'SOURCES.md#canyon-creek' },
  'rogue-river': {
    text: 'The Table Rocks stand above the Rogue River valley, the heart of the Takelma homeland.',
    say: 'The Table Rocks stand above the Rogue River valley, the heart of the Takelma homeland.',
    source: 'SOURCES.md#rogue-river' },
  'siskiyou-pass': {
    text: 'Hudson’s Bay Company trappers crossed this pass in 1827. A few wagons crossed in the years of the gold rush, but most travelers went with mule trains.',
    say: 'Hudson’s Bay Company trappers crossed this pass in eighteen twenty-seven. A few wagons crossed in the years of the gold rush, but most travelers went with mule trains.',
    source: 'SOURCES.md#siskiyou-pass' },
  'mount-shasta': {
    text: 'Mount Shasta is a volcano more than 14,000 feet tall, and its snowy top can be seen from far away.',
    say: 'Mount Shasta is a volcano more than fourteen thousand feet tall, and its snowy top can be seen from far away.',
    source: 'SOURCES.md#mount-shasta' },
  'castle-crags': {
    text: 'Granite spires like a castle’s towers rise beside the upper Sacramento River, on the old trail south.',
    say: 'Granite spires like a castle’s towers rise beside the upper Sacramento River, on the old trail south.',
    source: 'SOURCES.md#castle-crags' },
  'clear-creek': {
    text: 'In 1848 Pierson Reading and the Native workers with him found gold in Clear Creek, far north of Coloma.',
    say: 'In eighteen forty-eight Pierson Reading and the Native workers with him found gold in Clear Creek, far north of Coloma.',
    source: 'SOURCES.md#clear-creek' },
  'feather-river': {
    text: 'In the summer of 1848 John Bidwell found gold on the Feather River, at a spot on the river that came to be called Bidwell’s Bar.',
    say: 'In the summer of eighteen forty-eight John Bidwell found gold on the Feather River, at a spot on the river that came to be called Bidwell’s Bar.',
    source: 'SOURCES.md#feather-river' },
  'sutters-fort': {
    text: 'Thousands of miners passed through Sutter’s Fort to buy supplies from its stores.',
    say: 'Thousands of miners passed through Sutter’s Fort to buy supplies from its stores.',
    source: 'SOURCES.md#sutters-fort' },
  'coloma': {
    text: 'On January 24, 1848, James Marshall saw gold flakes in the water channel of Sutter’s sawmill here. The Nisenan call this valley Cullumah.',
    say: 'On January twenty-fourth, eighteen forty-eight, James Marshall saw gold flakes in the water channel of Sutter’s sawmill here. The Nisenan call this valley Cullumah.',
    source: 'SOURCES.md#coloma' },
  'home-by-sea': {
    text: 'Many Oregonians sailed home from San Francisco with their gold. In 1849 a company in Oregon City made gold into five-dollar and ten-dollar coins with a beaver on them, called Beaver money.',
    say: 'Many Oregonians sailed home from San Francisco with their gold. In eighteen forty-nine a company in Oregon City made gold into five-dollar and ten-dollar coins with a beaver on them, called Beaver money.',
    source: 'SOURCES.md#home-by-sea' },
};

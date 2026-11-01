// The trail (SPEC v1.5 §2.1 to §2.4). Independence, Missouri to the Willamette Valley is still 2,000 miles, now in twenty
// legs of 60 to 160 miles (the 1.3 trail had twelve of about 167). Every 1.3 leg id is kept, so saves, stickers and tests
// survive; the new landmarks sit between them. Miles are the game's: the real distances rounded and evened out so each leg
// is about one session, and they are never read aloud (docs/SOURCES.md, "Things we deliberately did not say").
// Fields: { id, n, name, from, to, miles, biome, stop: { kind, name }, river?, fort?, nation?, lookout, sticker, painting,
//   map: [x, y], post?, dry?, cold?, gold?, toll?, voyage?, ferry?, fromYear? }
//   biome: 'prairie' | 'bluffs' | 'highdesert' | 'mountains' | 'gorge' | 'valley' | 'basin' | 'sierra' | 'siskiyou' | 'goldcountry' | 'sea'
//   stop.kind: 'fort' | 'river' | 'landmark' | 'home' | 'gold'
//   nation: the nation whose homeland the leg crosses (its trading post and its fact, nations.js)
//   painting: the scene's set piece id (SPEC §4.2); the loose paintingFor(id) match stays the fallback
//   map: the stop on the title map in a 1000 x 600 box (x east, y south; Independence is [940, 330]); a stylized map, not a survey
//   post: a letter is written here (every fort and every end of a trail, and a few stops on the long stretches)
//   dry: { from, to } the share of the leg with no water (the Sublette Cutoff, the Forty-Mile Desert)
//   cold: a cold leg (needs blankets); toll: dollars in 1846 money, paid at the start of the leg; voyage: runs as a sail, no trail days
//   ferry: false = a river with no ferry (ford or float only); fromYear: the leg exists from this year on
//   gold: { pans, rich, rocker?, from? } a digging: `rich` pans glint; `from` = the first year a claim digs (the Sacramento claim, 1848)
// Forts' price level rises 1.0 (Independence) -> 3.0 (Sutter's Fort), the way prices really climbed along the trail.
const mk = ({ emoji, ...o }) => ({ ...o, lookout: o.lookout || o.id, sticker: { id: o.id, name: o.name, emoji } });

// ---------------------------------------------------------------- the emigrant trail: the default 20-leg plan (Fort Bridger, Oregon, the raft)
export const LEGS = [
  mk({ id: 'kansas-river', n: 1, name: 'Kansas River', from: 'Independence', to: 'the Kansas River crossing', miles: 110, biome: 'prairie',
    stop: { kind: 'river', name: 'Kansas River' }, river: { width: 'wide' }, nation: 'kansa', painting: 'river', map: [905, 322], emoji: '🌊' }),
  mk({ id: 'alcove-spring', n: 2, name: 'Alcove Spring', from: 'the Kansas River', to: 'Alcove Spring', miles: 90, biome: 'prairie',
    stop: { kind: 'landmark', name: 'Alcove Spring' }, painting: 'alcove-spring', map: [872, 306], emoji: '💧' }),
  mk({ id: 'fort-kearny', n: 3, name: 'Fort Kearny', from: 'Alcove Spring', to: 'Fort Kearny', miles: 120, biome: 'prairie',
    stop: { kind: 'fort', name: 'Fort Kearny' }, fort: { prices: 1.2 }, nation: 'pawnee', painting: 'fort', map: [800, 274], post: true, emoji: '🏕️' }),
  mk({ id: 'ash-hollow', n: 4, name: 'Ash Hollow', from: 'Fort Kearny', to: 'Ash Hollow', miles: 120, biome: 'bluffs',
    stop: { kind: 'landmark', name: 'Ash Hollow' }, nation: 'lakota', painting: 'ash-hollow', map: [718, 254], emoji: '🌳' }),
  mk({ id: 'chimney-rock', n: 5, name: 'Chimney Rock', from: 'Ash Hollow', to: 'Chimney Rock', miles: 60, biome: 'bluffs',
    stop: { kind: 'landmark', name: 'Chimney Rock' }, nation: 'lakota', painting: 'chimney', map: [668, 236], emoji: '🗻' }),
  mk({ id: 'scotts-bluff', n: 6, name: 'Scotts Bluff', from: 'Chimney Rock', to: 'Scotts Bluff', miles: 60, biome: 'bluffs',
    stop: { kind: 'landmark', name: 'Scotts Bluff' }, nation: 'lakota', painting: 'scotts-bluff', map: [655, 228], emoji: '⛰️' }),
  mk({ id: 'fort-laramie', n: 7, name: 'Fort Laramie', from: 'Scotts Bluff', to: 'Fort Laramie', miles: 60, biome: 'bluffs',
    stop: { kind: 'fort', name: 'Fort Laramie' }, fort: { prices: 1.6 }, nation: 'lakota', painting: 'fort', map: [630, 214], post: true, emoji: '🏰' }),
  mk({ id: 'north-platte', n: 8, name: 'North Platte River', from: 'Fort Laramie', to: 'the North Platte River crossing', miles: 120, biome: 'highdesert',
    stop: { kind: 'river', name: 'North Platte River' }, river: { width: 'wide' }, nation: 'lakota', painting: 'river', map: [576, 190], emoji: '⛴️' }),
  mk({ id: 'independence-rock', n: 9, name: 'Independence Rock', from: 'the North Platte River', to: 'Independence Rock', miles: 60, biome: 'highdesert',
    stop: { kind: 'landmark', name: 'Independence Rock' }, nation: 'shoshone', painting: 'independence', map: [550, 203], post: true, emoji: '🪨' }),
  mk({ id: 'ice-slough', n: 10, name: 'Ice Slough', from: 'Independence Rock', to: 'Ice Slough', miles: 80, biome: 'highdesert',
    stop: { kind: 'landmark', name: 'Ice Slough' }, nation: 'shoshone', painting: 'ice-slough', map: [525, 208], emoji: '🧊' }),
  mk({ id: 'south-pass', n: 11, name: 'South Pass', from: 'Ice Slough', to: 'South Pass', miles: 70, biome: 'mountains',
    stop: { kind: 'landmark', name: 'South Pass' }, nation: 'shoshone', painting: 'southpass', map: [496, 208], cold: true, emoji: '⛰️' }),
  mk({ id: 'green-river', n: 12, name: 'Green River', from: 'South Pass', to: 'the Green River crossing', miles: 70, biome: 'mountains',
    stop: { kind: 'river', name: 'Green River' }, river: { width: 'wide' }, nation: 'shoshone', painting: 'river', map: [466, 226], emoji: '🟢' }),
  mk({ id: 'fort-bridger', n: 13, name: 'Fort Bridger', from: 'the Green River', to: 'Fort Bridger', miles: 70, biome: 'mountains',
    stop: { kind: 'fort', name: 'Fort Bridger' }, fort: { prices: 1.9 }, nation: 'shoshone', painting: 'fort', map: [449, 246], post: true, emoji: '🛖' }),
  mk({ id: 'soda-springs', n: 14, name: 'Soda Springs', from: 'Fort Bridger', to: 'Soda Springs', miles: 140, biome: 'highdesert',
    stop: { kind: 'landmark', name: 'Soda Springs' }, nation: 'bannock', painting: 'soda', map: [414, 197], emoji: '🫧' }),
  mk({ id: 'fort-hall', n: 15, name: 'Fort Hall', from: 'Soda Springs', to: 'Fort Hall', miles: 70, biome: 'highdesert',
    stop: { kind: 'fort', name: 'Fort Hall' }, fort: { prices: 2.2 }, nation: 'bannock', painting: 'fort', map: [388, 184], post: true, emoji: '🚩' }),
  mk({ id: 'snake-river', n: 16, name: 'Snake River', from: 'Fort Hall', to: 'the Snake River crossing', miles: 160, biome: 'highdesert',
    stop: { kind: 'river', name: 'Snake River' }, river: { width: 'wide' }, nation: 'bannock', painting: 'river', map: [300, 184], post: true, emoji: '🏝️' }),
  mk({ id: 'farewell-bend', n: 17, name: 'Farewell Bend', from: 'the Snake River', to: 'Farewell Bend', miles: 110, biome: 'highdesert',
    stop: { kind: 'landmark', name: 'Farewell Bend' }, painting: 'farewell-bend', map: [242, 136], emoji: '👋' }),
  mk({ id: 'blue-mountains', n: 18, name: 'Blue Mountains', from: 'Farewell Bend', to: 'the Blue Mountains', miles: 130, biome: 'mountains',
    stop: { kind: 'landmark', name: 'Blue Mountains' }, nation: 'nez-perce', painting: 'bluemtns', map: [208, 100], cold: true, emoji: '🌲' }),
  mk({ id: 'the-dalles', n: 19, name: 'The Dalles', from: 'the Blue Mountains', to: 'The Dalles on the Columbia River', miles: 140, biome: 'gorge',
    stop: { kind: 'river', name: 'The Dalles' }, river: { width: 'narrow' }, nation: 'chinook', painting: 'gorge', map: [118, 88], post: true, emoji: '🛶' }),
  mk({ id: 'willamette-valley', n: 20, name: 'Willamette Valley', from: 'The Dalles', to: 'the Willamette Valley', miles: 160, biome: 'valley',
    stop: { kind: 'home', name: 'Willamette Valley' }, nation: 'chinook', painting: 'homestead', map: [70, 110], post: true, emoji: '🏡' }),
];

// ---------------------------------------------------------------- the branches (SPEC §2.2): legs only some plans run
const BRANCH_LEGS = [
  // the Sublette Cutoff (from 1844): about 40 miles shorter, some 50 miles with no water, no Fort Bridger store
  mk({ id: 'sublette-cutoff', n: 12, name: 'Sublette Cutoff', from: 'South Pass', to: 'the Green River, by the Sublette Cutoff', miles: 100, biome: 'highdesert',
    stop: { kind: 'river', name: 'Green River' }, river: { width: 'wide' }, nation: 'shoshone', painting: 'sublette-cutoff', map: [470, 214],
    dry: { from: 0.1, to: 0.7 }, emoji: '🏜️' }),
  mk({ id: 'bear-river', n: 13, name: 'Bear River', from: 'the Green River', to: 'the Bear River valley', miles: 90, biome: 'mountains',
    stop: { kind: 'landmark', name: 'Bear River Valley' }, nation: 'shoshone', painting: 'bear-river', map: [440, 214], emoji: '🐻' }),
  // the Lander Road (from 1858): the government's road, about 60 miles shorter, with grass and water
  mk({ id: 'lander-road', n: 12, name: 'Lander Road', from: 'South Pass', to: 'the end of the Lander Road', miles: 150, biome: 'mountains',
    stop: { kind: 'landmark', name: 'Lander Road' }, nation: 'shoshone', painting: 'lander-road', map: [440, 192], cold: true, fromYear: 1858, emoji: '🛣️' }),
  // the Barlow Road (from 1846): a toll road over the shoulder of Mount Hood to Oregon City
  mk({ id: 'barlow-road', n: 20, name: 'Barlow Road', from: 'The Dalles', to: 'Oregon City, by the Barlow Road', miles: 160, biome: 'mountains',
    stop: { kind: 'home', name: 'Willamette Valley' }, nation: 'chinook', painting: 'barlow-road', map: [70, 110], toll: 5, post: true, emoji: '🗻' }),
];

// ---------------------------------------------------------------- the California Trail (SPEC §2.2): nine legs from Fort Hall, 850 miles
const CALIFORNIA_LEGS = [
  mk({ id: 'raft-river', n: 16, name: 'Raft River', from: 'Fort Hall', to: 'the Raft River, the Parting of the Ways', miles: 60, biome: 'highdesert',
    stop: { kind: 'landmark', name: 'Raft River' }, nation: 'bannock', painting: 'raft-river', map: [362, 214], emoji: '🪧' }),
  mk({ id: 'city-of-rocks', n: 17, name: 'City of Rocks', from: 'the Raft River', to: 'City of Rocks', miles: 70, biome: 'highdesert',
    stop: { kind: 'landmark', name: 'City of Rocks' }, nation: 'bannock', painting: 'city-of-rocks', map: [346, 250], emoji: '🗿' }),
  mk({ id: 'humboldt-wells', n: 18, name: 'Humboldt Wells', from: 'City of Rocks', to: 'Humboldt Wells', miles: 120, biome: 'basin',
    stop: { kind: 'landmark', name: 'Humboldt Wells' }, nation: 'newe', painting: 'humboldt-wells', map: [320, 300], emoji: '⛲' }),
  mk({ id: 'humboldt-river', n: 19, name: 'Humboldt River', from: 'Humboldt Wells', to: 'the Humboldt River', miles: 150, biome: 'basin',
    stop: { kind: 'river', name: 'Humboldt River' }, river: { width: 'narrow' }, ferry: false, nation: 'newe', painting: 'river', map: [276, 338], emoji: '🌾' }),
  mk({ id: 'big-meadows', n: 20, name: 'Big Meadows', from: 'the Humboldt River', to: 'the Big Meadows', miles: 150, biome: 'basin',
    stop: { kind: 'landmark', name: 'Big Meadows' }, nation: 'numu', painting: 'big-meadows', map: [236, 376], post: true, emoji: '🌱' }),
  mk({ id: 'forty-mile-desert', n: 21, name: 'Forty-Mile Desert', from: 'the Big Meadows', to: 'the end of the Forty-Mile Desert', miles: 60, biome: 'basin',
    stop: { kind: 'landmark', name: 'Forty-Mile Desert' }, nation: 'numu', painting: 'forty-mile-desert', map: [228, 408], dry: { from: 0, to: 1 }, emoji: '🛢️' }),
  mk({ id: 'truckee-river', n: 22, name: 'Truckee River', from: 'the Forty-Mile Desert', to: 'the Truckee River', miles: 60, biome: 'basin',
    stop: { kind: 'river', name: 'Truckee River' }, river: { width: 'narrow' }, nation: 'numu', painting: 'river', map: [216, 430], emoji: '💦' }),
  mk({ id: 'sierra-summit', n: 23, name: 'Sierra Summit', from: 'the Truckee River', to: 'the Sierra summit', miles: 80, biome: 'sierra',
    stop: { kind: 'landmark', name: 'Sierra Summit' }, nation: 'washoe', painting: 'sierra-summit', map: [200, 452], cold: true, emoji: '🏔️' }),
  mk({ id: 'sacramento-valley', n: 24, name: 'Sacramento Valley', from: 'the Sierra summit', to: 'your claim in the Sacramento Valley', miles: 100, biome: 'goldcountry',
    stop: { kind: 'home', name: 'Sacramento Valley' }, nation: 'nisenan', painting: 'sacramento-claim', map: [150, 470], post: true,
    gold: { pans: 2, rich: 1, from: 1848 }, emoji: '🏡' }),
];

// ---------------------------------------------------------------- the Gold Road (SPEC §2.4): twelve legs south from the Willamette farm, then home by sea
const GOLD_LEGS = [
  mk({ id: 'calapooya-mountains', n: 1, name: 'Calapooya Mountains', from: 'your farm', to: 'the Calapooya Mountains', miles: 100, biome: 'valley',
    stop: { kind: 'landmark', name: 'Calapooya Mountains' }, nation: 'kalapuya', painting: 'calapooya-mountains', map: [72, 162], emoji: '⛰️' }),
  mk({ id: 'umpqua-river', n: 2, name: 'Umpqua River', from: 'the Calapooya Mountains', to: 'the Umpqua River', miles: 60, biome: 'siskiyou',
    stop: { kind: 'river', name: 'Umpqua River' }, river: { width: 'wide' }, nation: 'umpqua', painting: 'river', map: [66, 205], emoji: '🌊' }),
  mk({ id: 'canyon-creek', n: 3, name: 'Canyon Creek', from: 'the Umpqua River', to: 'Canyon Creek', miles: 60, biome: 'siskiyou',
    stop: { kind: 'landmark', name: 'Canyon Creek' }, nation: 'umpqua', painting: 'canyon-creek', map: [60, 246], post: true, emoji: '🏞️' }),
  mk({ id: 'rogue-river', n: 4, name: 'Rogue River', from: 'Canyon Creek', to: 'the Rogue River', miles: 70, biome: 'siskiyou',
    stop: { kind: 'river', name: 'Rogue River' }, river: { width: 'wide' }, nation: 'takelma', painting: 'table-rocks', map: [62, 284], emoji: '🪨' }),
  mk({ id: 'siskiyou-pass', n: 5, name: 'Siskiyou Pass', from: 'the Rogue River', to: 'the Siskiyou pass', miles: 60, biome: 'siskiyou',
    stop: { kind: 'landmark', name: 'Siskiyou Pass' }, nation: 'shasta', painting: 'siskiyou-pass', map: [70, 320], cold: true, post: true, emoji: '🌲' }),
  mk({ id: 'mount-shasta', n: 6, name: 'Mount Shasta', from: 'the Siskiyou pass', to: 'Mount Shasta', miles: 60, biome: 'siskiyou',
    stop: { kind: 'landmark', name: 'Mount Shasta' }, nation: 'shasta', painting: 'mount-shasta', map: [86, 352], emoji: '🌋' }),
  mk({ id: 'castle-crags', n: 7, name: 'Castle Crags', from: 'Mount Shasta', to: 'Castle Crags', miles: 60, biome: 'sierra',
    stop: { kind: 'landmark', name: 'Castle Crags' }, nation: 'wintu', painting: 'castle-crags', map: [100, 380], emoji: '🏰' }),
  mk({ id: 'clear-creek', n: 8, name: 'Clear Creek', from: 'Castle Crags', to: 'Clear Creek, Reading’s Bar', miles: 70, biome: 'goldcountry',
    stop: { kind: 'landmark', name: 'Clear Creek' }, nation: 'wintu', painting: 'clear-creek', map: [114, 404], post: true,
    gold: { pans: 3, rich: 1 }, emoji: '⛏️' }),
  mk({ id: 'feather-river', n: 9, name: 'Feather River', from: 'Clear Creek', to: 'the Feather River, Bidwell’s Bar', miles: 100, biome: 'goldcountry',
    stop: { kind: 'river', name: 'Feather River' }, river: { width: 'wide' }, nation: 'maidu', painting: 'river', map: [134, 424],
    gold: { pans: 4, rich: 1 }, emoji: '🪶' }),
  mk({ id: 'sutters-fort', n: 10, name: 'Sutter’s Fort', from: 'the Feather River', to: 'Sutter’s Fort', miles: 80, biome: 'goldcountry',
    stop: { kind: 'fort', name: 'Sutter’s Fort' }, fort: { prices: 3.0 }, nation: 'nisenan', painting: 'adobe-fort', map: [142, 454], post: true, emoji: '🏛️' }),
  mk({ id: 'coloma', n: 11, name: 'Coloma', from: 'Sutter’s Fort', to: 'Coloma, the diggings', miles: 50, biome: 'goldcountry',
    stop: { kind: 'gold', name: 'Coloma' }, nation: 'nisenan', painting: 'coloma', map: [174, 442], post: true,
    gold: { pans: 5, rich: 2, rocker: 3 }, emoji: '✨' }),
  mk({ id: 'home-by-sea', n: 12, name: 'Home by Sea', from: 'San Francisco', to: 'the Columbia River and home', miles: 600, biome: 'sea',
    stop: { kind: 'home', name: 'Willamette Valley' }, nation: 'chinook', painting: 'home-by-sea', map: [58, 124], voyage: true, emoji: '⛵' }),
];

/** Every leg of every route (the default plan first, then the branches, California and the Gold Road): 45 legs. */
export const ALL_LEGS = [...LEGS, ...BRANCH_LEGS, ...CALIFORNIA_LEGS, ...GOLD_LEGS];
export const LEG_BY_ID = Object.fromEntries(ALL_LEGS.map((l) => [l.id, l]));
/** The trail miles of the default plan (2,000; a voyage's sea miles are never trail miles, and the default plan has no voyage). */
export const TOTAL_MILES = LEGS.reduce((a, l) => a + l.miles, 0);

export const SEASONS = [
  { id: 's1847', year: 1847, name: 'Rookie year', priceMult: 1, numberMult: 1 },
  { id: 's1850', year: 1850, name: 'Pioneer year', priceMult: 2, numberMult: 2 },
  { id: 's1853', year: 1853, name: 'Trailblazer year', priceMult: 4, numberMult: 4 },
];
export const SEASON_BY_ID = Object.fromEntries(SEASONS.map((s) => [s.id, s]));

export const ANIMALS = [
  { id: 'oxen', name: 'Oxen', blurb: 'Strong and steady. They eat grass, not your flour.', milesPerDay: { steady: 15, brisk: 19 }, feedLb: 0 },
  { id: 'mules', name: 'Mules', blurb: 'Faster, and hungry: two pounds of feed a day.', milesPerDay: { steady: 18, brisk: 23 }, feedLb: 2 },
];
export const ANIMAL_BY_ID = Object.fromEntries(ANIMALS.map((a) => [a.id, a]));

// the General Store's goods (prices in 1847 dollars at Independence; priceAt() scales by the fort and the season)
export const GOODS = [
  { id: 'flour', name: 'Flour', unit: 'sack', lb: 50, price: 4, emoji: '🌾' },
  { id: 'bacon', name: 'Bacon', unit: 'side', lb: 20, price: 3, emoji: '🥓' },
  { id: 'beans', name: 'Beans', unit: 'bag', lb: 25, price: 2, emoji: '🫘' },
  { id: 'parts', name: 'Spare parts', unit: 'set', price: 6, emoji: '⚙️' },
  { id: 'rope', name: 'Rope', unit: 'coil', price: 2, emoji: '🪢' },
  { id: 'blankets', name: 'Blankets', unit: 'blanket', price: 5, emoji: '🧣' },
  { id: 'arrows', name: 'Arrows', unit: 'bundle', price: 2, emoji: '🏹' },
];
export const GOOD_BY_ID = Object.fromEntries(GOODS.map((g) => [g.id, g]));

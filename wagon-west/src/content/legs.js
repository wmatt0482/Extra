// The trail: 12 legs from Independence, Missouri to the Willamette Valley (SPEC §3, §9). The shapes here are the
// contract every stream imports. Miles follow the real trail, rounded to ten and evened out so each leg is about one
// session (140 to 210 miles); the whole trail is 2,000 miles, the figure the National Park Service gives for the
// Oregon Trail. The SPEC's map has 13 stops after Independence; to keep 12 legs, Soda Springs is folded into the Fort
// Hall leg (the trail passes it on the way, and its fizzy water is the first half of Fort Hall's lookout).
// The Dalles keeps its own leg (the Columbia River stop: stop.kind 'river', width 'narrow', because the river really
// squeezes through a narrow channel there) and the Willamette Valley is the 12th leg, stop.kind 'home'.
// biome: 'prairie' | 'bluffs' | 'highdesert' | 'mountains' | 'gorge' | 'valley' · stop.kind: 'fort' | 'river' | 'landmark' | 'home'
// nation: the nation whose homeland the leg crosses (its trading post and its fact, nations.js). Forts' price level
// rises 1.0 (Independence) -> 2.2 (Fort Hall), the way prices really climbed along the trail.
export const LEGS = [
  { id: 'kansas-river', n: 1, name: 'Kansas River', from: 'Independence', to: 'the Kansas River crossing', miles: 150, biome: 'prairie',
    stop: { kind: 'river', name: 'Kansas River' }, river: { width: 'wide' }, nation: 'kansa', lookout: 'kansas-river',
    sticker: { id: 'kansas-river', name: 'Kansas River', emoji: '🌊' } },
  { id: 'fort-kearny', n: 2, name: 'Fort Kearny', from: 'the Kansas River', to: 'Fort Kearny', miles: 170, biome: 'prairie',
    stop: { kind: 'fort', name: 'Fort Kearny' }, fort: { prices: 1.2 }, nation: 'pawnee', lookout: 'fort-kearny',
    sticker: { id: 'fort-kearny', name: 'Fort Kearny', emoji: '🏕️' } },
  { id: 'chimney-rock', n: 3, name: 'Chimney Rock', from: 'Fort Kearny', to: 'Chimney Rock', miles: 160, biome: 'bluffs',
    stop: { kind: 'landmark', name: 'Chimney Rock' }, nation: 'lakota', lookout: 'chimney-rock',
    sticker: { id: 'chimney-rock', name: 'Chimney Rock', emoji: '🗻' } },
  { id: 'fort-laramie', n: 4, name: 'Fort Laramie', from: 'Chimney Rock', to: 'Fort Laramie', miles: 140, biome: 'bluffs',
    stop: { kind: 'fort', name: 'Fort Laramie' }, fort: { prices: 1.6 }, nation: 'lakota', lookout: 'fort-laramie',
    sticker: { id: 'fort-laramie', name: 'Fort Laramie', emoji: '🏰' } },
  { id: 'independence-rock', n: 5, name: 'Independence Rock', from: 'Fort Laramie', to: 'Independence Rock', miles: 190, biome: 'highdesert',
    stop: { kind: 'landmark', name: 'Independence Rock' }, nation: 'shoshone', lookout: 'independence-rock',
    sticker: { id: 'independence-rock', name: 'Independence Rock', emoji: '🪨' } },
  { id: 'south-pass', n: 6, name: 'South Pass', from: 'Independence Rock', to: 'South Pass', miles: 140, biome: 'mountains',
    stop: { kind: 'landmark', name: 'South Pass' }, nation: 'shoshone', lookout: 'south-pass',
    sticker: { id: 'south-pass', name: 'South Pass', emoji: '⛰️' } },
  { id: 'fort-bridger', n: 7, name: 'Fort Bridger', from: 'South Pass', to: 'Fort Bridger', miles: 140, biome: 'mountains',
    stop: { kind: 'fort', name: 'Fort Bridger' }, fort: { prices: 1.9 }, nation: 'shoshone', lookout: 'fort-bridger',
    sticker: { id: 'fort-bridger', name: 'Fort Bridger', emoji: '🛖' } },
  { id: 'fort-hall', n: 8, name: 'Fort Hall', from: 'Fort Bridger', to: 'Fort Hall, by way of Soda Springs', miles: 210, biome: 'highdesert',
    stop: { kind: 'fort', name: 'Fort Hall' }, fort: { prices: 2.2 }, nation: 'bannock', lookout: 'fort-hall',
    sticker: { id: 'fort-hall', name: 'Fort Hall', emoji: '🚩' } },
  { id: 'snake-river', n: 9, name: 'Snake River', from: 'Fort Hall', to: 'the Snake River crossing', miles: 180, biome: 'highdesert',
    stop: { kind: 'river', name: 'Snake River' }, river: { width: 'wide' }, nation: 'bannock', lookout: 'snake-river',
    sticker: { id: 'snake-river', name: 'Snake River', emoji: '🏝️' } },
  { id: 'blue-mountains', n: 10, name: 'Blue Mountains', from: 'the Snake River', to: 'the Blue Mountains', miles: 200, biome: 'mountains',
    stop: { kind: 'landmark', name: 'Blue Mountains' }, nation: 'nez-perce', lookout: 'blue-mountains',
    sticker: { id: 'blue-mountains', name: 'Blue Mountains', emoji: '🌲' } },
  { id: 'the-dalles', n: 11, name: 'The Dalles', from: 'the Blue Mountains', to: 'The Dalles on the Columbia River', miles: 160, biome: 'gorge',
    stop: { kind: 'river', name: 'The Dalles' }, river: { width: 'narrow' }, nation: 'chinook', lookout: 'the-dalles',
    sticker: { id: 'the-dalles', name: 'The Dalles', emoji: '🛶' } },
  { id: 'willamette-valley', n: 12, name: 'Willamette Valley', from: 'The Dalles', to: 'the Willamette Valley', miles: 160, biome: 'valley',
    stop: { kind: 'home', name: 'Willamette Valley' }, nation: 'chinook', lookout: 'willamette-valley',
    sticker: { id: 'willamette-valley', name: 'Willamette Valley', emoji: '🏡' } },
];
export const LEG_BY_ID = Object.fromEntries(LEGS.map((l) => [l.id, l]));
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

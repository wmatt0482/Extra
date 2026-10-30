// The trail: 12 legs from Independence, Missouri to the Willamette Valley (SPEC §3, §9). Content stream fills all 12;
// the shapes here are the contract every stream imports. Miles are the real distances rounded to the nearest 10.
// biome: 'prairie' | 'bluffs' | 'highdesert' | 'mountains' | 'gorge' | 'valley' · stop.kind: 'fort' | 'river' | 'landmark' | 'home'
export const LEGS = [
  { id: 'kansas-river', n: 1, name: 'Kansas River', from: 'Independence', to: 'the Kansas River crossing', miles: 150, biome: 'prairie',
    stop: { kind: 'river', name: 'Kansas River' }, river: { width: 'wide' }, nation: 'kansa', lookout: 'kansas-river',
    sticker: { id: 'kansas-river', name: 'Kansas River', emoji: '🌊' } },
  { id: 'fort-kearny', n: 2, name: 'Fort Kearny', from: 'the Kansas River', to: 'Fort Kearny', miles: 170, biome: 'prairie',
    stop: { kind: 'fort', name: 'Fort Kearny' }, fort: { prices: 1.2 }, nation: 'pawnee', lookout: 'fort-kearny',
    sticker: { id: 'fort-kearny', name: 'Fort Kearny', emoji: '🏕️' } },
  { id: 'chimney-rock', n: 3, name: 'Chimney Rock', from: 'Fort Kearny', to: 'Chimney Rock', miles: 160, biome: 'bluffs',
    stop: { kind: 'landmark', name: 'Chimney Rock' }, lookout: 'chimney-rock',
    sticker: { id: 'chimney-rock', name: 'Chimney Rock', emoji: '🗻' } },
  // … legs 4–12 (Content stream): Fort Laramie (fort, lakota), Independence Rock (landmark), South Pass (landmark,
  // mountains), Fort Bridger (fort, shoshone), Soda Springs (landmark, highdesert), Fort Hall (fort, bannock),
  // Snake River (river, 'wide'), Blue Mountains (landmark, mountains, cayuse / nez-perce), The Dalles (river, 'narrow',
  // gorge, chinook), Willamette Valley (home, valley)
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

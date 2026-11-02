// The cosmetics catalogue and shop (lab/SPEC.md §2.7), generated from the spec's table. PURE DATA: no imports.
// Item id = <owner>.<slot>.<name>; slot key = <owner>.<slot>. Owners: av (avatar), pet, home (the Lab's own) and sj, tb, ff, ww, bc (a game's looks).
// Source: 'both' (shop and crate) · 'gift' (a level, first play, a streak, the first Friday Test or a family goal; never sold) ·
// 'coins' (shop only) · 'stock' (everyone has it). Price by rarity: common 300 · rare 1,200 · epic 3,000 (coin-only items name their price).
// `soon: true` = designed, not built: never listed, never dropped.
export const PRICE = { c: 300, r: 1200, e: 3000 };
export const OWNERS = ['av', 'pet', 'home', 'sj', 'tb', 'ff', 'ww', 'bc'];
export const LAB_OWNERS = ['av', 'pet', 'home'];          // always ready: the Lab draws them itself
export const OWNER_NAMES = { av: 'Me', pet: 'Pet', home: 'Home', sj: 'Spell Jump', tb: 'Trail Blazer', ff: 'Fraction Fright', ww: 'Wagon West', bc: 'Build Crew' };

// [owner.slot, level the slot opens at, noun added to a name, 'tokens by rarity' c | r | e, gifts 'token:how', ...]
// how: 'L12' = a level gift; any other text = a named way to earn it
const TABLE = [
  ['av.hat', 1, '', 'sunhat headband', 'propeller', '', 'cap:L3 beanie:L21 wizard:L70 crown:L100'],
  ['av.shirt', 1, '', 'hoodie tee-star', 'jersey', 'hero', 'stripes:L6 labcoat:L40'],
  ['av.back', 4, '', 'satchel', 'jetpack', 'wings', 'backpack:L9 cape:L25'],
  ['av.face', 8, '', 'goggles', 'starshades', '', 'shades:L12'],
  ['av.aura', 15, '', '', 'glow', 'flame', 'sparkle:L50 rainbow:L90'],
  ['pet.neck', 1, '', 'collar scarf', 'bell', '', 'bowtie:L60 medal:30-day streak'],
  ['pet.toy', 3, '', 'yarn', 'frisbee drum', '', 'ball:L15'],
  ['pet.hat', 6, '', 'smallcap', 'propellerpet', 'crownpet', 'party:L30'],
  ['home.wall', 1, 'wall', 'blueprint ocean', 'forest sunset', '', 'stars:L18 space:L80'],
  ['home.floor', 1, 'floor', 'grass checker', 'rainbowrug', '', ''],
  ['home.poster', 2, 'poster', 'robot rocket', 'map', '', 'sj:First round in Spell Jump tb:First round in Trail Blazer ff:First round in Fraction Fright ww:First round in Wagon West bc:First round in Build Crew lab:L2'],
  ['home.shelf', 5, '', 'plant lamp', '', '', 'globe:L35 trophy:First Friday Test'],
  ['home.banner', 1, 'banner', '', '', '', 'f1:Family goal f2:Family goal f3:Family goal f4:Family goal f5:Family goal f6:Family goal'],
  ['sj.skin', 1, 'skin', 'mint grape lemon', 'tiger pixel sunrise', 'aurora holo', ''],
  ['sj.sticker', 1, 'sticker', 'pencil abc bubble', 'medal rocketlab', '', ''],
  ['sj.trail', 1, 'trail', '', 'confetti', 'stars', ''],
  ['tb.paint', 1, 'paint', 'ocean sunset mint', 'bluechrome purplehaze', 'goldleaf', ''],
  ['tb.decal', 1, 'decal', 'bolt flames', 'stars checkeredge', '', ''],
  ['tb.rim', 1, 'rims', '', 'neon', 'gold', ''],
  ['tb.ghost', 1, 'ghost', '', 'ice flame', 'gold rainbow', ''],
  ['ff.fence', 1, 'fence', 'candy moss', 'neon goldtrim frost', 'vines', ''],
  ['ff.tower', 1, 'tower', 'flagred flaglab lanternblue', 'banner glowtop', 'crowntop', ''],
  ['ww.cover', 1, 'cover', 'stripes patchwork sunflower riverblue', 'starquilt nightsky', 'goldthread', ''],
  ['ww.outfit', 1, '', 'bonnet strawhat vest', 'redscarf spectacles plumehat', 'cloak', ''],
  ['bc.paint', 1, 'paint', 'teal plum', 'safety checker', 'gold', ''],
  ['bc.decal', 1, 'decal', 'labmark flame', 'rivets', '', ''],
];
// coin-only items with their own price (Build Crew's payoff); `soon` ones are designed but not built
const COIN_ONLY = [
  ['bc.veh', 'dump', 8000, false, 'Dump truck'], ['bc.veh', 'fork', 12000, false, 'Forklift'],
  ['bc.veh', 'loader', 16000, true, 'Wheel loader'], ['bc.veh', 'dozer', 20000, true, 'Bulldozer'], ['bc.veh', 'telehandler', 26000, true, 'Telehandler'],
  ['bc.bp', 'lighthouse', 2400, false, 'Lighthouse blueprint'], ['bc.bp', 'windmill', 2400, false, 'Windmill blueprint'],
  ['bc.bp', 'castlegate', 3600, false, 'Castle gate blueprint'], ['bc.bp', 'arch', 3600, false, 'Stone arch blueprint'],
  ['bc.bp', 'suspension', 4800, true, 'Suspension bridge blueprint'], ['bc.bp', 'towercrane', 4800, true, 'Tower crane blueprint'],
];
const SLOT_LABEL = { hat: 'Hat', shirt: 'Shirt', back: 'Back', face: 'Face', aura: 'Aura', neck: 'Neck', toy: 'Toy', wall: 'Wall', floor: 'Floor', poster: 'Posters', shelf: 'Shelf', banner: 'Banners',
  skin: 'Skins', sticker: 'Stickers', trail: 'Trails', paint: 'Paint', decal: 'Decals', rim: 'Rims', ghost: 'Ghost looks', fence: 'Fences', tower: 'Towers', cover: 'Covers', outfit: 'Outfits', veh: 'Vehicles', bp: 'Blueprints' };
const NAMES = {   // tokens whose plain capital letter is not the name
  'tee-star': 'Star tee', sunhat: 'Sun hat', starshades: 'Star shades', smallcap: 'Small cap', propellerpet: 'Propeller hat', crownpet: 'Crown', rainbowrug: 'Rainbow rug',
  rocketlab: 'Rocket lab', bluechrome: 'Blue chrome', purplehaze: 'Purple haze', goldleaf: 'Gold leaf', checkeredge: 'Checker edge', goldtrim: 'Gold trim',
  flagred: 'Red flag', flaglab: 'Lab flag', lanternblue: 'Blue lantern', glowtop: 'Glow top', crowntop: 'Crown top', starquilt: 'Star quilt', nightsky: 'Night sky',
  goldthread: 'Gold thread', riverblue: 'River blue', strawhat: 'Straw hat', redscarf: 'Red scarf', plumehat: 'Plume hat', labmark: 'Lab mark', labcoat: 'Lab coat',
  cap: 'Racing cap', beanie: 'Beanie', wizard: 'Wizard hat', crown: 'Crown', stripes: 'Stripe shirt', backpack: 'Backpack', cape: 'Cape', shades: 'Shades', ball: 'Ball',
  party: 'Party hat', bowtie: 'Bow tie', medal: 'Medal', globe: 'Globe', trophy: 'Trophy', sparkle: 'Sparkle', rainbow: 'Rainbow', stars: 'Stars',
};
const GIFT_NAMES = { 'home.poster.sj': 'Spell Jump poster', 'home.poster.tb': 'Trail Blazer poster', 'home.poster.ff': 'Fraction Fright poster', 'home.poster.ww': 'Wagon West poster',
  'home.poster.bc': 'Build Crew poster', 'home.poster.lab': 'Lab poster', 'pet.neck.medal': 'Streak medal', 'av.hat.crown': 'Lab crown', 'av.aura.rainbow': 'Rainbow aura',
  'av.aura.sparkle': 'Sparkle aura', 'home.wall.stars': 'Starry wall', 'home.wall.space': 'Space wall' };
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
function nameFor(id, slot, token, noun) {
  if (GIFT_NAMES[id]) return GIFT_NAMES[id];
  if (/^f[1-6]$/.test(token)) return `Family banner ${token.slice(1)}`;
  const base = NAMES[token] || cap(token.replace(/-/g, ' '));
  if (!noun || (NAMES[token] && /\b(wall|floor|poster|banner|skin|sticker|trail|paint|decal|fence|tower|cover|rims?|ghost)\b/i.test(NAMES[token]))) return base;
  return `${base} ${noun}`;
}
const giftRarity = (level) => (level >= 60 ? 'e' : level >= 20 ? 'r' : 'c');

function build() {
  const items = [], slots = [];
  for (const [key, open, noun, c, r, e, gifts] of TABLE) {
    const [owner, slot] = key.split('.');
    slots.push({ key, owner, slot, open, label: SLOT_LABEL[slot] || cap(slot), multi: slot === 'poster' ? 2 : 1 });
    const add = (rar, tokens) => { for (const t of tokens.split(' ').filter(Boolean)) items.push({ id: `${key}.${t}`, owner, slot, key, rarity: rar, source: 'both', price: PRICE[rar], name: nameFor(`${key}.${t}`, slot, t, noun) }); };
    add('c', c); add('r', r); add('e', e);
    // the stock floor: everyone has it
    for (const g of (gifts || '').match(/[a-z0-9-]+:(?:[^:]*?)(?= [a-z0-9-]+:|$)/g) || []) {
      const i = g.indexOf(':'), t = g.slice(0, i), how = g.slice(i + 1);
      const lv = /^L(\d+)$/.exec(how);
      items.push({ id: `${key}.${t}`, owner, slot, key, rarity: giftRarity(lv ? +lv[1] : 1), source: 'gift', price: 0, name: nameFor(`${key}.${t}`, slot, t, noun),
        how: lv ? `Level ${lv[1]}` : how, ...(lv ? { level: +lv[1] } : {}) });
    }
  }
  items.push({ id: 'home.floor.wood', owner: 'home', slot: 'floor', key: 'home.floor', rarity: 'c', source: 'stock', price: 0, name: 'Wood floor', how: 'Everyone has it' });
  for (const [key, token, price, soon, name] of COIN_ONLY) {
    const [owner, slot] = key.split('.');
    if (!slots.some((s) => s.key === key)) slots.push({ key, owner, slot, open: 1, label: SLOT_LABEL[slot], multi: 1, noEquip: true });
    items.push({ id: `${key}.${token}`, owner, slot, key, rarity: price >= 8000 ? 'e' : 'r', source: 'coins', price, name, ...(soon ? { soon: true } : {}) });
  }
  // the second poster hook is a slot of its own (two hang on the wall); it takes the same posters
  slots.push({ key: 'home.poster2', owner: 'home', slot: 'poster', open: 2, label: 'Posters', multi: 1, alias: 'home.poster' });
  return { items, slots };
}
const built = build();
export const ITEMS = Object.freeze(built.items.map((i) => Object.freeze(i)));
export const ITEM_BY_ID = Object.freeze(Object.fromEntries(ITEMS.map((i) => [i.id, i])));
export const SLOTS = Object.freeze(built.slots.map((s) => Object.freeze(s)));
export const SLOT_BY_KEY = Object.freeze(Object.fromEntries(SLOTS.map((s) => [s.key, s])));
export const itemsFor = (owner) => ITEMS.filter((i) => i.owner === owner);
/** The slot an item is worn in ('home.poster' is also worn in 'home.poster2'). */
export const slotKeyMatches = (slotKey, item) => !!item && !!SLOT_BY_KEY[slotKey] && (item.key === slotKey || item.key === SLOT_BY_KEY[slotKey].alias);
export const isStock = (id) => !!ITEM_BY_ID[id] && ITEM_BY_ID[id].source === 'stock';

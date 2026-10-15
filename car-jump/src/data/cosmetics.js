// Cosmetics: car skins (paint + decal) and stickers (small emblems on the door). Earned, never bought
// with cash. `source` says how each one is earned: 'crate' (mystery crate pool), 'champion' (Week
// Champion: every word of the week mastered), 'streak' (streak milestone days), 'level' (speller level).

export const SKINS = [
  { id: 'stock',      name: 'Stock',          source: 'start',    body: null,      accent: null,      decal: null },
  { id: 'sunset',     name: 'Sunset Fade',    source: 'crate',    body: '#ff7a3d', accent: '#ffd23f', decal: 'fade' },
  { id: 'midnight',   name: 'Midnight',       source: 'crate',    body: '#1b1f4a', accent: '#8f6bff', decal: null },
  { id: 'racer',      name: 'Racing Stripes', source: 'crate',    body: '#f2f2f2', accent: '#ff3b5c', decal: 'stripes' },
  { id: 'flames',     name: 'Hot Flames',     source: 'crate',    body: '#1f1f24', accent: '#ff7a3d', decal: 'flames' },
  { id: 'bubblegum',  name: 'Bubblegum',      source: 'crate',    body: '#ff7ac8', accent: '#ffffff', decal: 'dots' },
  { id: 'camo',       name: 'Jungle Camo',    source: 'crate',    body: '#4f7a3a', accent: '#2b4a22', decal: 'camo' },
  { id: 'lightning',  name: 'Lightning',      source: 'crate',    body: '#22d3ff', accent: '#ffcf1a', decal: 'bolt' },
  { id: 'checker',    name: 'Checker Flag',   source: 'crate',    body: '#ffffff', accent: '#111114', decal: 'checker' },
  { id: 'galaxy',     name: 'Galaxy',         source: 'level',    level: 8,  body: '#2a1a5e', accent: '#c8ff5e', decal: 'stars' },
  { id: 'gold',       name: 'Solid Gold',     source: 'level',    level: 16, body: '#ffcf1a', accent: '#b98200', decal: 'shine' },
  { id: 'rainbow',    name: 'Rainbow',        source: 'streak',   days: 14,  body: '#ff3b5c', accent: '#22d3ff', decal: 'rainbow' },
  { id: 'champion',   name: 'Champion Chrome', source: 'champion',            body: '#dfe6f2', accent: '#ffcf1a', decal: 'crown' },
];

export const STICKERS = [
  { id: 'none',     name: 'No sticker',  source: 'start' },
  { id: 'star',     name: 'Gold Star',   source: 'crate',    glyph: '★', color: '#ffcf1a' },
  { id: 'heart',    name: 'Heart',       source: 'crate',    glyph: '♥', color: '#ff3b5c' },
  { id: 'bolt',     name: 'Bolt',        source: 'crate',    glyph: '⚡', color: '#ffcf1a' },
  { id: 'skull',    name: 'Skull',       source: 'crate',    glyph: '☠', color: '#ffffff' },
  { id: 'paw',      name: 'Paw',         source: 'crate',    glyph: '🐾', color: '#ffffff' },
  { id: 'rocket',   name: 'Rocket',      source: 'crate',    glyph: '🚀', color: '#ffffff' },
  { id: 'music',    name: 'Music',       source: 'crate',    glyph: '♪', color: '#8f6bff' },
  { id: 'smile',    name: 'Smiley',      source: 'crate',    glyph: '☺', color: '#ffcf1a' },
  { id: 'number1',  name: 'Number One',  source: 'streak',   days: 7,  glyph: '1', color: '#ffcf1a' },
  { id: 'flame',    name: 'Streak Flame', source: 'streak',  days: 30, glyph: '🔥', color: '#ff7a3d' },
  { id: 'wizard',   name: 'Wizard Hat',  source: 'level',    level: 12, glyph: '🧙', color: '#8f6bff' },
  { id: 'trophy',   name: 'Trophy',      source: 'champion', glyph: '🏆', color: '#ffcf1a' },
];

export const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));
export const STICKER_BY_ID = Object.fromEntries(STICKERS.map((s) => [s.id, s]));

// Speller levels: XP needed to REACH each level (cumulative). Level 1 is the start.
export const LEVEL_XP = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000, 5000, 6200, 7600, 9200, 11000, 13000, 15500, 18500, 22000];
export const LEVEL_TITLES = [
  [1, 'Rookie Speller'], [3, 'Letter Cadet'], [5, 'Word Wrangler'], [8, 'Spelling Stunt Driver'],
  [12, 'Syllable Slinger'], [16, 'Word Wizard'], [20, 'Spelling Legend'],
];
export const XP = { firstTry: 20, fixed: 8, testWord: 15, mastered: 50, mission: 100, champion: 300 };

export function levelFor(xp) {
  let lvl = 1;
  for (let i = 1; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) lvl = i + 1;
  return Math.min(lvl, LEVEL_XP.length);
}
export function levelTitle(level) {
  let t = LEVEL_TITLES[0][1];
  for (const [l, name] of LEVEL_TITLES) if (level >= l) t = name;
  return t;
}
export function levelProgress(xp) {
  const lvl = levelFor(xp);
  const base = LEVEL_XP[lvl - 1] ?? 0;
  const next = LEVEL_XP[lvl] ?? base;
  return { level: lvl, title: levelTitle(lvl), into: xp - base, need: Math.max(1, next - base), max: lvl >= LEVEL_XP.length };
}

// Mystery crate: weighted outcomes. The pity rule guarantees a cosmetic every 5th crate without one.
export const CRATE = {
  outcomes: [
    { kind: 'cash', weight: 60, min: 300, max: 800 },
    { kind: 'sticker', weight: 25 },
    { kind: 'skin', weight: 12 },
    { kind: 'jackpot', weight: 3, mult: 3 },
  ],
  pityEvery: 5,
};

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];   // each pays a crate; 7/14/30 also unlock the named cosmetics above

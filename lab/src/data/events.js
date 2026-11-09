// The exchange table (lab/SPEC.md §2.2): what each game event pays in Lab coins and Lab XP. PURE DATA: no imports.
//
// An ANSWER row (kind 'answer') pays `coins` / `xp` when the answer was right on the first try and `fixCoins` / `fixXp` otherwise
// (the miss was fixed with the game's own fix-it routine; a miss is never zero: fix = ceil(first-try / 2)). A UNIT row (kind 'unit')
// pays a flat amount per `n`. `limit` = coins stop for that event after that many (sum of n) a day; XP and quests continue.
// `once` = the whole payment (coins and XP) happens once per local day across all games (the `day` event).
// `week` = the weekly counter the event feeds (family board and goal, §2.6). `combo: false` = no combo step (assessment or unit).
// `flat` = the amount is paid once per report whatever `n` says.
// `replay` = the share of the amounts paid when the report says it is a repeat (Build Crew `job` with meta.first === false).
export const EVENTS = [
  // ---- Spell Jump
  { game: 'sj', event: 'word', kind: 'answer', coins: 4, fixCoins: 2, xp: 4, fixXp: 2, week: 'word', combo: true },
  { game: 'sj', event: 'testWord', kind: 'answer', coins: 4, fixCoins: 2, xp: 6, fixXp: 3, week: 'word', combo: false, assessment: true },
  { game: 'sj', event: 'run', kind: 'unit', coins: 6, xp: 12 },
  { game: 'sj', event: 'perfect', kind: 'unit', coins: 3, xp: 6 },
  { game: 'sj', event: 'mastered', kind: 'unit', coins: 8, xp: 30 },
  { game: 'sj', event: 'test', kind: 'unit', coins: 40, xp: 80, limit: 1, flat: true },       // n = words right (a note, not a multiplier)
  // ---- Trail Blazer
  { game: 'tb', event: 'fact', kind: 'answer', coins: 2, fixCoins: 1, xp: 2, fixXp: 1, combo: true },
  { game: 'tb', event: 'race', kind: 'unit', coins: 4, xp: 12, week: 'race' },
  { game: 'tb', event: 'win', kind: 'unit', coins: 6, xp: 10 },
  { game: 'tb', event: 'perfect', kind: 'unit', coins: 2, xp: 5 },
  { game: 'tb', event: 'ghostBeat', kind: 'unit', coins: 8, xp: 15, limit: 3 },
  { game: 'tb', event: 'summit', kind: 'unit', coins: 15, xp: 30 },
  { game: 'tb', event: 'star', kind: 'unit', coins: 6, xp: 10 },
  // ---- Fraction Fright
  { game: 'ff', event: 'zap', kind: 'answer', coins: 3, fixCoins: 2, xp: 3, fixXp: 2, week: 'zap', combo: true },
  { game: 'ff', event: 'wave', kind: 'unit', coins: 2, xp: 14 },
  { game: 'ff', event: 'bull', kind: 'unit', coins: 0, xp: 3 },
  { game: 'ff', event: 'boss', kind: 'unit', coins: 10, xp: 20 },
  { game: 'ff', event: 'street', kind: 'unit', coins: 20, xp: 40 },
  // ---- Wagon West
  { game: 'ww', event: 'marker', kind: 'answer', coins: 4, fixCoins: 2, xp: 4, fixXp: 2, combo: true },
  { game: 'ww', event: 'problem', kind: 'answer', coins: 4, fixCoins: 2, xp: 4, fixXp: 2, combo: true },
  { game: 'ww', event: 'word', kind: 'answer', coins: 4, fixCoins: 2, xp: 4, fixXp: 2, week: 'word', combo: true },
  { game: 'ww', event: 'leg', kind: 'unit', coins: 24, xp: 45, week: 'leg' },
  { game: 'ww', event: 'star', kind: 'unit', coins: 5, xp: 8 },
  { game: 'ww', event: 'choice', kind: 'unit', coins: 0, xp: 5 },
  { game: 'ww', event: 'farm', kind: 'unit', coins: 5, xp: 10 },
  // ---- Build Crew (no answers: no combo, no first try)
  { game: 'bc', event: 'job', kind: 'unit', coins: 40, xp: 55, week: 'job', replay: 0.25 },
  { game: 'bc', event: 'piece', kind: 'unit', coins: 4, xp: 3, limit: 150 },
  { game: 'bc', event: 'challenge', kind: 'unit', coins: 40, xp: 45, week: 'job' },
  { game: 'bc', event: 'blueprint', kind: 'unit', coins: 30, xp: 30, week: 'job' },
  { game: 'bc', event: 'site', kind: 'unit', coins: 30, xp: 25, limit: 2 },
  // ---- Case Files (reading, no authored wrong answers: one flat payment per closed case, whatever the accuracy; no combo, no first try)
  { game: 'cf', event: 'case', kind: 'unit', coins: 40, xp: 55 },
  // ---- Pip's Squirrel Chase (spelling words bank to Spell Jump's own store and its mission; the Lab pays one flat amount per closed case, like Case Files)
  { game: 'sq', event: 'case', kind: 'unit', coins: 40, xp: 55 },
  // ---- every game: the game counted its day (paid once a local day across all games)
  { game: 'any', event: 'day', kind: 'unit', coins: 10, xp: 25, once: true },
];

// per-game "moment" names and the combo rules, re-exported by core/events.js
export const MOMENT_NAMES = { sj: 'Perfect Launch', tb: 'Perfect Landing', ff: 'Bullseye Burst', ww: 'Trail Cheer' };

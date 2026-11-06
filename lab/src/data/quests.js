// Daily quest templates (lab/SPEC.md §2.4). Targets were tuned with tools/economy-sim.mjs --quests (minutes of play per quest) so a day's three fit a 20 to 45 minute day:
// five targets are lower than the spec's first table (sj-perfect, ff-bull, ww-words, bc-pieces, bc-challenge); the rest are the spec's. PURE DATA: no imports. `{n}` is the target by tier. `events` = the game events that count
// (and `firstTry: true` = only first-try answers). `nudge` = may be the "try something different" quest. `one` = the text when n is 1.
// `gentle` = the text for gentle mode (Fraction Fright only). Quest ids are what lab.quests[day].ids stores.
export const QUESTS = [
  { id: 'sj-words', game: 'sj', events: ['word'], text: 'Spell {n} words', easy: 4, mid: 8, hard: 12, nudge: true },
  { id: 'sj-first', game: 'sj', events: ['word'], firstTry: true, text: 'Spell {n} words on the first try', easy: 3, mid: 5, hard: 8 },
  { id: 'sj-runs', game: 'sj', events: ['run'], text: 'Finish {n} runs', one: 'Finish a run', easy: 2, mid: 3, hard: 5, nudge: true },
  { id: 'sj-perfect', game: 'sj', events: ['perfect'], text: 'Stick {n} perfect landings', one: 'Stick a perfect landing', easy: 1, mid: 1, hard: 2 },
  { id: 'tb-races', game: 'tb', events: ['race'], text: 'Finish {n} races', one: 'Finish a race', easy: 1, mid: 3, hard: 5, nudge: true },
  { id: 'tb-win', game: 'tb', events: ['win'], text: 'Win a race', one: 'Win a race', easy: 1, mid: 1, hard: 1 },
  { id: 'tb-facts', game: 'tb', events: ['fact'], text: 'Answer {n} gate facts', easy: 6, mid: 10, hard: 16 },
  { id: 'ff-zap', game: 'ff', events: ['zap'], text: 'Zap {n} fractions', gentle: 'Help {n} neighbors home', easy: 6, mid: 10, hard: 16 },
  { id: 'ff-bull', game: 'ff', events: ['bull'], text: 'Hit {n} bullseyes', one: 'Hit a bullseye', easy: 1, mid: 2, hard: 3 },
  { id: 'ff-waves', game: 'ff', events: ['wave'], text: 'Finish {n} waves', one: 'Finish a wave', easy: 1, mid: 2, hard: 3, nudge: true },
  { id: 'ww-leg', game: 'ww', events: ['leg'], text: 'Finish {n} legs of the trail', one: 'Finish a leg of the trail', easy: 1, mid: 1, hard: 2, nudge: true },
  { id: 'ww-problems', game: 'ww', events: ['problem', 'marker'], text: 'Solve {n} trail problems', easy: 3, mid: 5, hard: 8 },
  { id: 'ww-words', game: 'ww', events: ['word'], text: 'Spell {n} river or letter words', easy: 2, mid: 3, hard: 4 },
  { id: 'ww-stars', game: 'ww', events: ['star'], text: 'Earn {n} stars on the trail', one: 'Earn a star on the trail', easy: 1, mid: 2, hard: 3 },
  { id: 'bc-job', game: 'bc', events: ['job'], text: 'Finish {n} jobs', one: 'Finish a job', easy: 1, mid: 1, hard: 2, nudge: true },
  { id: 'bc-pieces', game: 'bc', events: ['piece'], text: 'Deliver {n} blocks', easy: 3, mid: 5, hard: 8 },
  { id: 'bc-challenge', game: 'bc', events: ['challenge'], text: 'Meet {n} build challenges', one: 'Meet a build challenge', easy: 1, mid: 1, hard: 1 },
  // (not a nudge: a case opens once a day, so a child is never nudged toward a game that makes them wait)
  { id: 'cf-case', game: 'cf', events: ['case'], text: 'Close {n} case', one: 'Close a case', easy: 1, mid: 1, hard: 1 },
  // counts the distinct games with any event today; the nudge for a child who has played one game or none lately
  { id: 'any-explore', game: 'any', events: [], explore: true, text: 'Play {n} different games', easy: 2, mid: 2, hard: 3, nudge: true, nudgeOnly: true },
];
export const QUEST_REWARD = { coins: 80, xp: 60 };
export const NUDGE_REWARD = { coins: 120, xp: 90 };
export const ALL_DONE_REWARD = { coins: 60, xp: 100 };

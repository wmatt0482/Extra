// Test fixtures for Pip's Squirrel Chase: a family (two players), the child's active Spell Jump word list (with sentences, so the hideout can use the
// list's own sentences) and an archived list (whose words must NEVER come up here: SPEC section 3, the active list only).
export const ACTIVE_WORDS = [
  { word: 'neighbor', sentence: 'My neighbor has a dog.' },
  { word: 'friend', sentence: 'A good friend sailed to the island.' },
  { word: 'island', sentence: 'The island was green.' },
  { word: 'answer', sentence: 'Please write the answer.' },
  { word: 'minute', sentence: 'Wait one minute.' },
  { word: 'library', sentence: 'The library is quiet.' },
  { word: 'trouble', sentence: 'The goat was in trouble.' },
  { word: 'pretty', sentence: 'The sign looked pretty.' },
  { word: 'between', sentence: 'We sat between two trees.' },
  { word: 'enough', sentence: null },
];
export const ARCHIVED_WORDS = [
  { word: 'castle', sentence: 'The castle had a moat.' },
  { word: 'bridge', sentence: 'We crossed the bridge.' },
];

/** The raw `spellJump.<id>.words` document (profiles.loadWords normalizes it). */
export function wordsDoc(now = Date.now(), active = ACTIVE_WORDS) {
  return {
    v: 1,
    lists: [
      { id: 'Lweek2', name: 'Week of Nov 9', createdAt: now - 1000, archivedAt: 0, pattern: '', sample: false, words: active.map((w) => ({ word: w.word, sentence: w.sentence, syllables: null })) },
      { id: 'Lweek1', name: 'Week of Nov 2', createdAt: now - 9e8, archivedAt: now - 5e8, pattern: '', sample: false, words: ARCHIVED_WORDS.map((w) => ({ word: w.word, sentence: w.sentence, syllables: null })) },
    ],
    activeId: 'Lweek2',
    records: {},
    tests: [], qualifierPending: null,
    today: { date: '', count: 0, newCount: 0, missionPaid: false },
    streak: 0, bestStreak: 0, perfectTotal: 0, progress: {},
  };
}
/** The family doc (`spellJump.family`): a child with a natural voice picked (when `voice` is given) and a sibling. */
export function familyDoc(now = Date.now(), { voice = 'en-US-Neural2-F' } = {}) {
  return {
    v: 1,
    players: [{ id: 'pmia', name: 'Mia', color: '#3b7dd9', createdAt: now, updatedAt: now }, { id: 'pleo', name: 'Leo', color: '#2fd36b', createdAt: now, updatedAt: now }],
    pinHash: null, pinUpdatedAt: 0,
    options: voice ? { pmia: { cloudVoice: voice } } : {}, optionsUpdatedAt: voice ? { pmia: now } : {},
    removedPlayers: [], migrated: true, lastPlayer: 'pmia',
  };
}

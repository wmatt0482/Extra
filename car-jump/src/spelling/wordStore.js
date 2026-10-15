// Per-player spelling data (`spellJump.<playerId>.words`): dated word lists (one active, the rest archived),
// one progress record per word, test history, today's mission counter and the first-try streak.
// Pure functions over a plain object (callers persist it); all dates come in as `now` (ms).
import {
  MISSION_SIZE, applyQualifier, applyResult, applyReview, applyTest, buildMission, dayKey, isMastered, isNew,
  needsLook, newRecord, noteSpelled, pickNext, status,
} from './scheduler.js';
import { SAMPLE_WORDS, SAMPLE_LIST_NAME, SAMPLE_PATTERN, SAMPLE_VERSION, cleanSayAs, normalizePattern, normalizeWord, isValidWord } from './words.js';

export const WORDS_VERSION = 1;
export const SAMPLE_ID = 'sample';
export const STREAK_CAP = 10;

export const DEFAULT_OPTIONS = { rate: 'normal', newPerDay: 99, includeReview: true, tileCase: 'lower', wordsPerRace: 2 };  // newPerDay 99 = all of this week's words
export const WORDS_PER_RACE = [1, 2, 3, 4];

function sampleList(now) {
  return { id: SAMPLE_ID, name: SAMPLE_LIST_NAME, createdAt: now, archivedAt: 0, pattern: SAMPLE_PATTERN, sample: true, sampleVersion: SAMPLE_VERSION, words: SAMPLE_WORDS.map((w) => ({ ...w })) };
}

export function defaultWords(now = Date.now()) {
  const d = {
    v: WORDS_VERSION,
    lists: [sampleList(now)],
    activeId: SAMPLE_ID,
    records: {},
    tests: [],
    qualifierPending: null,
    today: { date: '', count: 0, newCount: 0, missionPaid: false },
    streak: 0,
    bestStreak: 0,
    perfectTotal: 0,
  };
  ensureRecords(d);
  return d;
}

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v, d = '') => (typeof v === 'string' ? v : d);
const strArr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

function cleanWordEntry(w) {
  if (!w || typeof w !== 'object') return null;
  const word = normalizeWord(w.word);
  if (!isValidWord(word)) return null;
  const syl = Array.isArray(w.syllables) ? w.syllables.filter((x) => typeof x === 'string' && x) : null;
  const out = { word, syllables: syl && syl.length > 1 ? syl : null, sentence: typeof w.sentence === 'string' && w.sentence.trim() ? w.sentence.trim().slice(0, 200) : null };
  const sayAs = cleanSayAs(w.sayAs);           // optional pronunciation override (kept only when valid)
  if (sayAs) out.sayAs = sayAs;
  return out;
}

// Coerce whatever was read into valid data; a corrupt store falls back to defaults (the caller keeps a backup).
export function normalizeWordsData(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.lists)) return defaultWords(now);
  const d = defaultWords(now);
  d.lists = raw.lists.map((l) => {
    if (!l || typeof l !== 'object' || typeof l.id !== 'string' || !Array.isArray(l.words)) return null;
    const words = l.words.map(cleanWordEntry).filter(Boolean);
    if (!words.length) return null;
    // the built-in list follows the shipped version (a new week's words replace a stored older copy)
    if (l.sample) return { ...sampleList(num(l.createdAt, now)), archivedAt: num(l.archivedAt, 0) };
    return { id: l.id, name: str(l.name, 'Word list'), createdAt: num(l.createdAt, now), archivedAt: num(l.archivedAt, 0), pattern: normalizePattern(l.pattern), sample: !!l.sample, words };
  }).filter(Boolean);
  if (!d.lists.length) d.lists = [sampleList(now)];
  d.activeId = d.lists.some((l) => l.id === raw.activeId) ? raw.activeId : d.lists[0].id;
  for (const l of d.lists) if (l.id === d.activeId) l.archivedAt = 0;
  d.records = {};
  if (raw.records && typeof raw.records === 'object') {
    for (const [w, r] of Object.entries(raw.records)) {
      if (!r || typeof r !== 'object') continue;
      const word = normalizeWord(w);
      if (!isValidWord(word)) continue;
      const rec = newRecord(word, str(r.listId, d.activeId));
      rec.box = Math.max(0, Math.min(3, Math.floor(num(r.box))));
      for (const k of ['due', 'attempts', 'firstTry', 'seenCount', 'lastSeen', 'reviewsDone', 'misses']) rec[k] = Math.max(0, num(r[k]));
      rec.daysCorrect = strArr(r.daysCorrect);
      rec.daysSeen = strArr(r.daysSeen);
      rec.focus = !!r.focus;
      rec.studied = !!r.studied;
      if (num(r.masteredAt) > 0) rec.masteredAt = num(r.masteredAt);   // v3.3: when the word last became Mastered
      d.records[word] = rec;
    }
  }
  d.tests = Array.isArray(raw.tests) ? raw.tests.filter((t) => t && typeof t === 'object' && (t.kind === 'qualifier' || t.kind === 'friday')).map((t) => ({
    id: str(t.id), kind: t.kind, listId: str(t.listId), at: num(t.at, now), correct: Math.max(0, num(t.correct)), total: Math.max(0, num(t.total)), missed: strArr(t.missed),
  })).slice(-60) : [];
  d.qualifierPending = d.lists.some((l) => l.id === raw.qualifierPending) ? raw.qualifierPending : null;
  if (raw.today && typeof raw.today === 'object') {
    d.today = { date: str(raw.today.date), count: Math.max(0, num(raw.today.count)), newCount: Math.max(0, num(raw.today.newCount)), missionPaid: !!raw.today.missionPaid };
  }
  d.streak = Math.max(0, num(raw.streak));
  d.bestStreak = Math.max(0, num(raw.bestStreak));
  d.perfectTotal = Math.max(0, num(raw.perfectTotal));
  // family sync bookkeeping (only present once used): when the active list was chosen, deleted list ids
  // (tombstones), when spelling data was last reset
  if (num(raw.activeAt) > 0) d.activeAt = num(raw.activeAt);
  const del = strArr(raw.deletedLists).slice(-100);
  if (del.length) d.deletedLists = del;
  if (num(raw.resetAt) > 0) d.resetAt = num(raw.resetAt);
  ensureRecords(d);
  return d;
}

export const activeList = (d) => d.lists.find((l) => l.id === d.activeId) || d.lists[0];
export const archivedLists = (d) => d.lists.filter((l) => l.id !== d.activeId).sort((a, b) => b.archivedAt - a.archivedAt);
export const listById = (d, id) => d.lists.find((l) => l.id === id) || null;
export const isSampleActive = (d) => !!activeList(d).sample;

// every active word has a record whose listId points at the active list
export function ensureRecords(d) {
  const l = activeList(d);
  for (const { word } of l.words) {
    if (!d.records[word]) d.records[word] = newRecord(word, l.id);
    else d.records[word].listId = l.id;
  }
}

export function rollToday(d, now) {
  const k = dayKey(now);
  if (d.today.date !== k) d.today = { date: k, count: 0, newCount: 0, missionPaid: false };
  return d.today;
}

export function missionState(d, now) {
  const t = rollToday(d, now);
  return { count: Math.min(MISSION_SIZE, t.count), size: MISSION_SIZE, done: t.count >= MISSION_SIZE, paid: t.missionPaid };
}

// Everything the panel needs about a word: syllables / sentence from its list, the list's pattern.
export function wordInfo(d, word) {
  const rec = d.records[word] || null;
  const lists = [activeList(d), ...d.lists];
  const list = lists.find((l) => rec && l.id === rec.listId && l.words.some((w) => w.word === word)) || lists.find((l) => l.words.some((w) => w.word === word));
  const entry = list ? list.words.find((w) => w.word === word) : { word, syllables: null, sentence: null };
  return { ...entry, pattern: list ? list.pattern : '', listId: list ? list.id : null, archived: !!(list && list.id !== d.activeId), rec, isNew: isNew(rec), look: needsLook(rec) };
}

function newListId(d, now) {
  let id = 'L' + now.toString(36);
  while (d.lists.some((l) => l.id === id)) id += 'x';
  return id;
}
export function listName(now) {
  return 'Week of ' + new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Save a parsed list as the new active list; the previous one goes to the archive (the sample list is
 *  dropped instead). The next PLAY runs the Qualifier on it. Returns the new list. */
export function saveNewList(d, words, pattern, now) {
  const prev = activeList(d);
  const list = { id: newListId(d, now), name: listName(now), createdAt: now, archivedAt: 0, pattern: normalizePattern(pattern), sample: false, words: words.map((w) => cleanWordEntry(w)).filter(Boolean) };
  if (prev && prev.sample) {
    d.lists = d.lists.filter((l) => l !== prev);
    // sample-list progress for words not in the new list goes with it
    for (const [w, r] of Object.entries(d.records)) if (r.listId === prev.id && !list.words.some((x) => x.word === w)) delete d.records[w];
  } else if (prev) {
    prev.archivedAt = now;
    for (const r of Object.values(d.records)) if (r.listId === prev.id) r.reviewsDone = 0;
  }
  d.lists.push(list);
  d.activeId = list.id;
  d.activeAt = now;
  ensureRecords(d);
  d.qualifierPending = list.id;
  return list;
}

export function restoreList(d, id, now) {
  const l = listById(d, id);
  if (!l || l.id === d.activeId) return false;
  const prev = activeList(d);
  if (prev.sample) d.lists = d.lists.filter((x) => x !== prev);
  else prev.archivedAt = now;
  l.archivedAt = 0;
  d.activeId = l.id;
  d.activeAt = now;
  ensureRecords(d);
  if (d.qualifierPending && d.qualifierPending !== l.id) d.qualifierPending = null;
  return true;
}

export function deleteList(d, id) {
  const l = listById(d, id);
  if (!l || l.id === d.activeId) return false;
  d.lists = d.lists.filter((x) => x !== l);
  d.deletedLists = [...(d.deletedLists || []).filter((x) => x !== id), id].slice(-100);   // family sync tombstone
  for (const [w, r] of Object.entries(d.records)) if (r.listId === id) delete d.records[w];
  d.tests = d.tests.filter((t) => t.listId !== id);
  if (d.qualifierPending === id) d.qualifierPending = null;
  return true;
}

export const qualifierDue = (d) => !!d.qualifierPending && d.qualifierPending === d.activeId;

// Pick the next word for a run. opts: player options ({newPerDay, includeReview}).
export function nextWord(d, now, session, opts = DEFAULT_OPTIONS, rand = Math.random) {
  const t = rollToday(d, now);
  const pick = pickNext(d, now, session, {
    missionLeft: t.count < MISSION_SIZE, newPerDay: opts.newPerDay, newToday: t.newCount, includeReview: opts.includeReview,
  }, rand);
  return pick ? { ...pick, ...wordInfo(d, pick.word) } : null;
}

/** Record a spell-panel result. Returns what the UI needs: mission completion (pay once), streak, a word that
 *  just became Mastered. */
export function recordSpell(d, word, { firstTry }, now, session) {
  const t = rollToday(d, now);
  const info = wordInfo(d, word);
  const rec = d.records[word] || (d.records[word] = newRecord(word, info.listId || d.activeId));
  const wasNew = isNew(rec);
  const wasMastered = isMastered(rec);
  const streakBefore = Math.min(STREAK_CAP, d.streak);
  const list = listById(d, rec.listId);
  if (info.archived && list) applyReview(rec, !!firstTry, now, list.archivedAt);
  else applyResult(rec, !!firstTry, now);
  if (session) noteSpelled(session, word, !firstTry);
  if (wasNew) t.newCount += 1;
  t.count += 1;
  if (firstTry) { d.streak += 1; d.perfectTotal += 1; } else d.streak = 0;
  d.bestStreak = Math.max(d.bestStreak, d.streak);
  let missionJustDone = false;
  if (!t.missionPaid && t.count >= MISSION_SIZE) { t.missionPaid = true; missionJustDone = true; }
  const newlyMastered = !wasMastered && isMastered(rec);
  if (newlyMastered) rec.masteredAt = now;          // v3.3: the family board counts words mastered this week
  return { rec, streakBefore, streak: d.streak, missionJustDone, newlyMastered, listId: rec.listId, mission: missionState(d, now) };
}

/**
 * Launch power for a race's word set (Parents → Options "Words before each race"): c = words right on the first
 * try, n = words asked. powerScale = 0.65 + 0.35 × c/n, nitroScale = 1 + 0.25 × c/n (n = 1 gives the old
 * 100 % / 125 % for a first try and 65 % / 100 % otherwise).
 */
export function setLaunch(c, n) {
  const k = n > 0 ? Math.max(0, Math.min(1, c / n)) : 0;
  const r = (x) => Math.round(x * 1e9) / 1e9;
  return { powerScale: r(0.65 + 0.35 * k), nitroScale: r(1 + 0.25 * k) };
}

// Spelling bonus (SPEC step 3): $400 × (1 + 0.1 × streak) × coinMult, streak = previous consecutive
// first-try words (cap 10).
export const spellBonus = (streakBefore, coinMult = 1) => Math.round(400 * (1 + 0.1 * Math.min(STREAK_CAP, streakBefore)) * coinMult);

function pushTest(d, kind, results, now) {
  const correct = results.filter((r) => r.correct).length;
  const t = { id: kind[0] + now.toString(36), kind, listId: d.activeId, at: now, correct, total: results.length, missed: results.filter((r) => !r.correct).map((r) => r.word) };
  d.tests.push(t);
  if (d.tests.length > 60) d.tests = d.tests.slice(-60);
  return t;
}

// Qualifier (pretest): correct → box 2, missed → Focus. results: [{word, correct}]
export function recordQualifier(d, results, now) {
  for (const r of results) {
    const rec = d.records[r.word] || (d.records[r.word] = newRecord(r.word, d.activeId));
    applyQualifier(rec, r.correct, now);
  }
  d.qualifierPending = null;
  return pushTest(d, 'qualifier', results, now);
}

// Returns the test entry; `mastered` (not stored) lists the words this test made Mastered (v3.3 trophies).
export function recordFriday(d, results, now) {
  const mastered = [];
  for (const r of results) {
    const rec = d.records[r.word] || (d.records[r.word] = newRecord(r.word, d.activeId));
    const was = isMastered(rec);
    applyTest(rec, r.correct, now);
    if (!was && isMastered(rec)) { rec.masteredAt = now; mastered.push(r.word); }
  }
  const t = pushTest(d, 'friday', results, now);
  Object.defineProperty(t, 'mastered', { value: mastered, enumerable: false });
  return t;
}

export const testWords = (d) => activeList(d).words.map((w) => w.word);

export function resetSpelling(d, now) {
  const fresh = defaultWords(now);
  d.records = {};
  d.tests = [];
  d.today = fresh.today;
  d.streak = 0; d.bestStreak = 0; d.perfectTotal = 0;
  d.resetAt = now;                       // family sync: progress older than this does not come back
  ensureRecords(d);
  d.qualifierPending = activeList(d).sample ? null : d.activeId;
}

export function masteredCount(d) {
  return Object.values(d.records).filter(isMastered).length;
}

// ---------- parent report ----------
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—');

export function report(d) {
  const l = activeList(d);
  const tests = d.tests.filter((t) => t.listId === l.id);
  const pretest = tests.find((t) => t.kind === 'qualifier') || null;
  const fridays = tests.filter((t) => t.kind === 'friday');
  const latest = fridays.length ? fridays[fridays.length - 1] : null;
  const rows = l.words.map(({ word }) => {
    const r = d.records[word] || newRecord(word, l.id);
    return { word, status: status(r), attempts: r.attempts, firstTryPct: r.attempts ? pct(r.firstTry, r.attempts) : null, lastPracticed: r.lastSeen, daysPracticed: (r.daysSeen || []).length, box: r.box };
  });
  const history = d.tests.slice().reverse().map((t) => ({ ...t, listName: (listById(d, t.listId) || { name: 'deleted list' }).name }));
  const counts = {};
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
  return { list: l, pretest, latest, rows, history, counts, streak: d.streak, bestStreak: d.bestStreak };
}

export function reportText(d, playerName) {
  const r = report(d);
  const score = (t) => (t ? `${t.correct}/${t.total} (${pct(t.correct, t.total)}%)` : 'not taken yet');
  const lines = [
    `Spell Jump report: ${playerName}`,
    `List: ${r.list.name}${r.list.sample ? ' (sample)' : ''}${r.list.pattern ? `, pattern "${r.list.pattern}"` : ''}, ${r.list.words.length} words`,
    `Pretest (Qualifier): ${score(r.pretest)}`,
    `Latest Friday Test: ${score(r.latest)}`,
    `Status: ${['Mastered', 'Almost', 'Learning', 'Focus', 'New'].map((s) => `${s} ${r.counts[s] || 0}`).join(', ')}`,
    '',
    'Word | Status | Attempts | First-try % | Last practiced | Days practiced',
    ...r.rows.map((w) => `${w.word} | ${w.status} | ${w.attempts} | ${w.firstTryPct == null ? '—' : w.firstTryPct + '%'} | ${fmtDate(w.lastPracticed)} | ${w.daysPracticed}`),
    '',
    'Test history:',
    ...(r.history.length ? r.history.map((t) => `${fmtDate(t.at)} ${t.kind === 'qualifier' ? 'Qualifier' : 'Friday Test'} (${t.listName}): ${t.correct}/${t.total}${t.missed.length ? `, missed: ${t.missed.join(', ')}` : ''}`) : ['none yet']),
  ];
  return lines.join('\n');
}

export { buildMission, status, isMastered, MISSION_SIZE };

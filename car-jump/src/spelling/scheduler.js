// Spelling scheduler: Leitner boxes with expanding intervals, mastery, the daily mission, free-play picks
// and the same-session re-queue (SPEC v3 "Scheduler", rules R4 / R5). Pure functions: every date-dependent
// function takes `now` (ms) so tools/spelling-tests.mjs can simulate days. No DOM, no storage.
//
// Word record: { word, listId, box 0..3, due (ms), attempts, firstTry, seenCount, lastSeen, daysCorrect: [iso],
//                focus, studied, reviewsDone, misses }

export const DAY_MS = 86400000;
export const INTERVAL_DAYS = [0, 1, 2, 4];            // box 0 = same session (after ≥ 2 other words)
export const REVIEW_DAYS = [14, 28];                  // archived lists come back 2 and 4 weeks later
export const MISSION_SIZE = 8;
export const REQUEUE_GAP = 2;                         // a missed word returns after at least 2 other words
export const BOX_WEIGHTS = [4, 3, 2, 1];
export const ARCHIVE_CHANCE = 0.2;

export const intervalMs = (box) => INTERVAL_DAYS[Math.max(0, Math.min(3, box | 0))] * DAY_MS;

// Local calendar day, YYYY-MM-DD.
export function dayKey(now) {
  const d = new Date(now);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function newRecord(word, listId) {
  return { word, listId, box: 0, due: 0, attempts: 0, firstTry: 0, seenCount: 0, lastSeen: 0, daysCorrect: [], daysSeen: [], focus: false, studied: false, reviewsDone: 0, misses: 0 };
}

// bookkeeping shared by every kind of attempt
function touch(rec, now) {
  rec.attempts += 1;
  rec.seenCount += 1;
  rec.lastSeen = now;
  if (!Array.isArray(rec.daysSeen)) rec.daysSeen = [];
  const k = dayKey(now);
  if (!rec.daysSeen.includes(k)) rec.daysSeen.push(k);
}

function addDay(rec, now) {
  const k = dayKey(now);
  if (!rec.daysCorrect.includes(k)) rec.daysCorrect.push(k);
}

// A practice retrieval (spell panel). firstTry: spelled right on the first attempt this run.
export function applyResult(rec, firstTry, now) {
  touch(rec, now);
  rec.studied = true;
  if (firstTry) {
    rec.firstTry += 1;
    rec.box = Math.min(3, rec.box + 1);
    rec.due = now + intervalMs(rec.box);
    addDay(rec, now);
    if (rec.box >= 2) rec.focus = false;
  } else {
    rec.misses += 1;
    rec.box = 0;
    rec.due = now;      // due again this session, but only after REQUEUE_GAP other words (session queue)
  }
  return rec;
}

// Qualifier (pretest): correct → box 2 ("Almost"), missed → box 0 and flagged Focus. The word now counts as
// seen (it is no longer New), but a Focus word still gets the Look step on its first practice (not studied).
export function applyQualifier(rec, correct, now) {
  touch(rec, now);
  if (correct) {
    rec.firstTry += 1;                // a pretest answer is a retrieval from memory too
    addDay(rec, now);
    rec.box = Math.max(2, rec.box);
    rec.focus = false;
    rec.studied = true;
    rec.due = now + intervalMs(2);
  } else {
    rec.box = 0;
    rec.focus = true;
    rec.studied = false;
    rec.misses += 1;
    rec.due = now;
  }
  return rec;
}

// Friday Test: a miss drops the word to box 0; a correct answer counts as a first-try retrieval.
export function applyTest(rec, correct, now) {
  if (correct) return applyResult(rec, true, now);
  touch(rec, now);
  rec.misses += 1;
  rec.box = 0;
  rec.due = now;
  return rec;
}

export function isMastered(rec) {
  return !!rec && rec.box >= 3 && new Set(rec.daysCorrect).size >= 2 && rec.firstTry >= 3;
}

// New · Focus · Learning (box 0-1) · Almost (box 2, or box 3 not yet mastered) · Mastered
export function status(rec) {
  if (!rec || rec.seenCount === 0) return 'New';
  if (isMastered(rec)) return 'Mastered';
  if (rec.focus && rec.box < 2) return 'Focus';
  if (rec.box <= 1) return 'Learning';
  return 'Almost';
}

export const isNew = (rec) => !rec || rec.seenCount === 0;
export const isDue = (rec, now) => !!rec && rec.seenCount > 0 && rec.due <= now;
// the Look-Say-Cover-Write-Check step: brand-new words and Focus words not yet studied
export const needsLook = (rec) => !rec || (!rec.studied && rec.box < 2);

// Archived review: due 2 and 4 weeks after the list was retired.
export function reviewDue(rec, archivedAt, now) {
  if (!rec || !archivedAt || rec.seenCount === 0) return false;
  const k = rec.reviewsDone || 0;
  if (k >= REVIEW_DAYS.length) return false;
  return now >= archivedAt + REVIEW_DAYS[k] * DAY_MS;
}
export function applyReview(rec, firstTry, now, archivedAt) {
  const wasDue = reviewDue(rec, archivedAt, now);
  applyResult(rec, firstTry, now);
  if (wasDue) rec.reviewsDone = (rec.reviewsDone || 0) + 1;
  return rec;
}

/**
 * The daily mission, in order: due Focus words → other due words → new words (cap) → due review words from
 * archived lists → if still short, the lowest-box active words. Unique words, at most `size`.
 * data: { records: {word: rec}, lists: [{id, archivedAt, words: [{word}]}], activeId }
 * opts: { size, newPerDay, newToday (already introduced today), includeReview, exclude: Set }
 */
export function buildMission(data, now, opts = {}) {
  const size = opts.size == null ? MISSION_SIZE : opts.size;
  const newCap = Math.max(0, (opts.newPerDay == null ? 5 : opts.newPerDay) - (opts.newToday || 0));
  const exclude = opts.exclude || new Set();
  const includeReview = opts.includeReview !== false;
  const recs = data.records || {};
  const active = (data.lists || []).find((l) => l.id === data.activeId);
  const activeWords = active ? active.words.map((w) => w.word) : [];
  const out = [];
  const take = (w) => { if (out.length < size && !exclude.has(w) && !out.includes(w)) out.push(w); };

  const due = activeWords.filter((w) => isDue(recs[w], now));
  due.filter((w) => recs[w].focus && recs[w].box < 2).sort((a, b) => recs[a].due - recs[b].due).forEach(take);
  due.filter((w) => !(recs[w].focus && recs[w].box < 2)).sort((a, b) => recs[a].box - recs[b].box || recs[a].due - recs[b].due).forEach(take);
  activeWords.filter((w) => isNew(recs[w]) && !exclude.has(w)).slice(0, newCap).forEach(take);
  if (includeReview) {
    const reviews = [];
    for (const l of data.lists || []) {
      if (l.id === data.activeId || !l.archivedAt) continue;
      for (const { word } of l.words) {
        const r = recs[word];
        if (r && r.listId === l.id && !activeWords.includes(word) && reviewDue(r, l.archivedAt, now)) reviews.push([word, l.archivedAt + REVIEW_DAYS[r.reviewsDone || 0] * DAY_MS]);
      }
    }
    reviews.sort((a, b) => a[1] - b[1]).forEach(([w]) => take(w));
  }
  if (out.length < size) {
    activeWords.filter((w) => !isNew(recs[w]))
      .sort((a, b) => recs[a].box - recs[b].box || recs[a].lastSeen - recs[b].lastSeen)
      .forEach(take);
  }
  return out;
}

// ---------- same-session queue ----------
export function createSession() {
  return { history: [], pending: [] };
}
// Record that `word` was spelled this session; a missed word waits for REQUEUE_GAP other words.
export function noteSpelled(session, word, missed) {
  session.pending = session.pending.filter((p) => p.word !== word);
  session.history.push(word);
  if (missed) session.pending.push({ word, at: session.history.length });
}
export const pendingReady = (session) => session.pending.filter((p) => session.history.length - p.at >= REQUEUE_GAP);

function weightedPick(words, recs, rand) {
  const w = words.map((x) => BOX_WEIGHTS[Math.max(0, Math.min(3, (recs[x] && recs[x].box) || 0))]);
  const total = w.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < words.length; i++) { r -= w[i]; if (r < 0) return words[i]; }
  return words[words.length - 1];
}

/**
 * Next word to spell. Returns { word, reason: 'requeue' | 'mission' | 'free' | 'review' } or null.
 * opts: { missionLeft (bool), newPerDay, newToday, includeReview }, rand: () => [0,1)
 * Never the same word twice in a row while more than one word exists; a missed word comes back once
 * at least 2 other words were spelled after it.
 */
export function pickNext(data, now, session, opts = {}, rand = Math.random) {
  const recs = data.records || {};
  const active = (data.lists || []).find((l) => l.id === data.activeId);
  const activeWords = active ? active.words.map((w) => w.word) : [];
  const last = session.history[session.history.length - 1];
  // a re-queued word only comes back while it still belongs to a list (a parent may have replaced the list)
  session.pending = session.pending.filter((p) => recs[p.word]);
  const ready = pendingReady(session).filter((p) => p.word !== last);
  if (ready.length) return { word: ready[0].word, reason: 'requeue' };
  const waiting = new Set(session.pending.map((p) => p.word));
  const exclude = new Set([...waiting, last].filter(Boolean));

  if (opts.missionLeft) {
    const spelled = new Set(session.history);
    const fresh = buildMission(data, now, { ...opts, size: MISSION_SIZE, exclude: new Set([...exclude, ...spelled]) });
    if (fresh.length) return { word: fresh[0], reason: 'mission' };
    const any = buildMission(data, now, { ...opts, size: MISSION_SIZE, exclude });
    if (any.length) return { word: any[0], reason: 'mission' };
  }

  // free play: 20 % chance of a non-mastered archived word, else weighted by box (0 ×4 … 3 ×1)
  if (opts.includeReview !== false && rand() < ARCHIVE_CHANCE) {
    const archived = [];
    for (const l of data.lists || []) {
      if (l.id === data.activeId || !l.archivedAt) continue;
      for (const { word } of l.words) {
        const r = recs[word];
        if (r && r.listId === l.id && r.seenCount > 0 && !isMastered(r) && !activeWords.includes(word) && !exclude.has(word)) archived.push(word);
      }
    }
    if (archived.length) return { word: archived[Math.floor(rand() * archived.length) % archived.length], reason: 'review' };
  }
  let pool = activeWords.filter((w) => !exclude.has(w) && !isNew(recs[w]));
  // new words only while today's cap allows (R5)
  const newLeft = (opts.newPerDay == null ? 5 : opts.newPerDay) - (opts.newToday || 0);
  if (!pool.length && newLeft > 0) pool = activeWords.filter((w) => !exclude.has(w) && isNew(recs[w]));
  if (!pool.length) pool = activeWords.filter((w) => !exclude.has(w) && !isNew(recs[w]));
  if (!pool.length) pool = activeWords.filter((w) => w !== last);
  if (!pool.length) pool = activeWords.slice();
  if (!pool.length) return null;
  return { word: weightedPick(pool, recs, rand), reason: 'free' };
}

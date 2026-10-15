// Unit tests for the spelling layer (plain Node asserts, no framework, no browser):
//   node tools/spelling-tests.mjs
// Covers the Leitner intervals, mastery (needs 2 distinct days), mission ordering, the new-word cap,
// re-queue distance, never-twice-in-a-row, archived review at 2 and 4 weeks, the list parser's edge cases,
// the attempt/word alignment, the word store (save list → archive → restore → delete, qualifier, Friday) and the
// speech fallbacks in tts.js (no API, no voices within 1.5 s, the onstart watchdog: 5 s for the first utterance of a
// session, 3 s afterwards; per-word failure, off for the session only after 3 in a row, re-probe on a tap; the
// utterance reference list (Chrome GC); cancel → resume → cancel again when stuck; 'not-allowed'; the gesture unlock
// "ready" at volume 0.01; the system voice; the Speech check log; iOS paused synth), the "say as" list field, the
// spoken presentation (buildPresentation / sayAgain / syllables) and voice ranking (local before online) / choice;
// the natural voice (v3.4): the server (src/tts/server.mjs with in-memory stores and a fake synthesize: family check
// 403, allowlist, caching by id, daily cap 429, no key 503, clip 404 / 200), the client's texts and prepare batches,
// and the engine choice / fallback in tts.js.
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/meta/rng.js';
import { createUpdateGuard, safeToReload } from '../src/meta/selfUpdate.js';
import {
  DAY_MS, INTERVAL_DAYS, MISSION_SIZE, applyQualifier, applyResult, applyReview, applyTest, buildMission, createSession,
  dayKey, isMastered, newRecord, noteSpelled, pendingReady, pickNext, reviewDue, status,
} from '../src/spelling/scheduler.js';
import { diffAttempt, formatList, normalizeWord, parseList, patternRanges, ringLetters, syllableBreaks, SAMPLE_WORDS } from '../src/spelling/words.js';
import {
  activeList, archivedLists, defaultWords, deleteList, missionState, nextWord, normalizeWordsData, qualifierDue, recordFriday,
  recordQualifier, recordSpell, report, reportText, resetSpelling, restoreList, saveNewList, setLaunch, spellBonus, wordInfo, DEFAULT_OPTIONS, WORDS_PER_RACE,
} from '../src/spelling/wordStore.js';

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failures.push(name); console.log('  ✗ ' + name + '\n      ' + (e && e.message).split('\n').join('\n      ')); }
}

const T0 = new Date(2026, 9, 12, 16, 0, 0).getTime();      // Mon Oct 12 2026, 4 pm local
const day = (n, h = 0) => T0 + n * DAY_MS + h * 3600000;
// deterministic rand
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

function dataWith(words, extra = {}) {
  const d = defaultWords(T0);
  saveNewList(d, words.map((w) => ({ word: w })), '', T0);
  d.qualifierPending = null;
  return Object.assign(d, extra);
}

console.log('scheduler: boxes and intervals');
test('intervals by box are 0 / 1 / 2 / 4 days', () => assert.deepEqual(INTERVAL_DAYS, [0, 1, 2, 4]));
test('first-try success climbs one box and sets due = now + interval(box)', () => {
  const r = newRecord('friend', 'L');
  applyResult(r, true, T0); assert.equal(r.box, 1); assert.equal(r.due, T0 + DAY_MS);
  applyResult(r, true, day(1)); assert.equal(r.box, 2); assert.equal(r.due, day(1) + 2 * DAY_MS);
  applyResult(r, true, day(3)); assert.equal(r.box, 3); assert.equal(r.due, day(3) + 4 * DAY_MS);
  applyResult(r, true, day(7)); assert.equal(r.box, 3, 'box caps at 3'); assert.equal(r.due, day(7) + 4 * DAY_MS);
});
test('a miss drops to box 0, due now (same session)', () => {
  const r = newRecord('friend', 'L');
  applyResult(r, true, T0); applyResult(r, true, day(1));
  applyResult(r, false, day(3)); assert.equal(r.box, 0); assert.equal(r.due, day(3)); assert.equal(r.misses, 1);
});

console.log('scheduler: mastery');
test('3 first-try successes on ONE day are not Mastered', () => {
  const r = newRecord('friend', 'L');
  applyResult(r, true, T0); applyResult(r, true, T0 + 60000); applyResult(r, true, T0 + 120000);
  assert.equal(r.box, 3); assert.equal(r.firstTry, 3); assert.equal(isMastered(r), false); assert.equal(status(r), 'Almost');
});
test('3 first-try successes over 2 distinct days at box 3 → Mastered', () => {
  const r = newRecord('friend', 'L');
  applyResult(r, true, T0); applyResult(r, true, T0 + 60000); applyResult(r, true, day(1));
  assert.equal(new Set(r.daysCorrect).size, 2); assert.equal(isMastered(r), true); assert.equal(status(r), 'Mastered');
});
test('2 successes on 2 days (box 2) are not Mastered', () => {
  const r = newRecord('friend', 'L');
  applyResult(r, true, T0); applyResult(r, true, day(1));
  assert.equal(isMastered(r), false); assert.equal(status(r), 'Almost');
});
test('statuses: New, Focus, Learning, Almost', () => {
  const r = newRecord('friend', 'L'); assert.equal(status(r), 'New');
  applyQualifier(r, false, T0); assert.equal(status(r), 'Focus'); assert.equal(r.box, 0); assert.equal(r.focus, true);
  const q = newRecord('enough', 'L'); applyQualifier(q, true, T0); assert.equal(q.box, 2); assert.equal(status(q), 'Almost');
  const l = newRecord('thought', 'L'); applyResult(l, false, T0); assert.equal(status(l), 'Learning');
});
test('Friday Test miss drops to box 0; correct counts as a first-try retrieval', () => {
  const r = newRecord('friend', 'L'); applyQualifier(r, true, T0);
  applyTest(r, false, day(4)); assert.equal(r.box, 0);
  const q = newRecord('enough', 'L'); applyQualifier(q, true, T0); applyTest(q, true, day(4)); assert.equal(q.box, 3); assert.equal(q.firstTry, 2, 'pretest + test');
});

console.log('scheduler: mission');
test('mission order: due Focus → other due → new (cap) → due review → lowest box filler', () => {
  const d = dataWith(['ant', 'bat', 'cat', 'dog', 'elk', 'fox', 'gnu', 'hen', 'ibis', 'jay']);
  const R = d.records;
  applyQualifier(R.cat, false, T0);                                 // focus, due now
  applyResult(R.ant, true, day(-2)); R.ant.due = day(-1);            // due, box 1
  applyResult(R.bat, true, day(-5)); applyResult(R.bat, true, day(-4)); R.bat.due = day(-3);  // due, box 2
  applyResult(R.dog, true, T0);                                     // box 1, not due (tomorrow)
  const m = buildMission(d, T0 + 1000, { newPerDay: 3, newToday: 0, includeReview: true });
  assert.deepEqual(m.slice(0, 3), ['cat', 'ant', 'bat'], 'focus first, then due by box');
  assert.deepEqual(m.slice(3, 6), ['elk', 'fox', 'gnu'], 'then up to 3 new words in list order');
  assert.deepEqual(m.slice(6), ['dog'], 'then the lowest-box active words (not new)');
  assert.ok(m.length <= MISSION_SIZE);
});
test('new-word cap: at most N new words per day (counting ones already introduced)', () => {
  const d = dataWith(['ant', 'bat', 'cat', 'dog', 'elk', 'fox', 'gnu', 'hen', 'ibis', 'jay']);
  assert.equal(buildMission(d, T0, { newPerDay: 5, newToday: 0 }).length, 5);
  assert.equal(buildMission(d, T0, { newPerDay: 5, newToday: 3 }).length, 2);
  assert.equal(buildMission(d, T0, { newPerDay: 3, newToday: 3 }).length, 0);
  // through the store: 8 spells on a fresh 10-word list introduce no more than 5 new words
  const s = createSession();
  let introduced = 0;
  for (let i = 0; i < 12; i++) {
    const w = nextWord(d, T0 + i * 60000, s, { newPerDay: 5, includeReview: true }, seq(0.5));
    if (w.isNew) introduced++;
    recordSpell(d, w.word, { firstTry: true }, T0 + i * 60000, s);
  }
  assert.equal(introduced, 5, `introduced ${introduced}`);
  assert.equal(d.today.newCount, 5);
});
test('mission counter reaches 8 and pays once per day', () => {
  const d = dataWith(['ant', 'bat', 'cat', 'dog', 'elk', 'fox']);
  const s = createSession();
  let paid = 0;
  for (let i = 0; i < 10; i++) {
    const w = nextWord(d, T0 + i * 1000, s, { newPerDay: 5 }, seq(0.3));
    if (recordSpell(d, w.word, { firstTry: true }, T0 + i * 1000, s).missionJustDone) paid++;
  }
  assert.equal(paid, 1); assert.equal(missionState(d, T0 + 20000).count, 8); assert.equal(missionState(d, T0 + 20000).done, true);
  assert.equal(missionState(d, day(1)).count, 0, 'resets the next day');
});

console.log('scheduler: same-session queue');
test('a missed word returns only after at least 2 other words', () => {
  const d = dataWith(['ant', 'bat', 'cat', 'dog', 'elk']);
  for (const w of ['ant', 'bat', 'cat', 'dog', 'elk']) applyResult(d.records[w], true, day(-3));
  for (const w of ['ant', 'bat', 'cat', 'dog', 'elk']) d.records[w].due = day(-1);
  const s = createSession();
  const opts = { missionLeft: true, newPerDay: 5, newToday: 0 };
  const first = pickNext(d, T0, s, opts, seq(0.1)).word;
  applyResult(d.records[first], false, T0); noteSpelled(s, first, true);
  const second = pickNext(d, T0, s, opts, seq(0.1)).word;
  assert.notEqual(second, first, 'not right after the miss');
  applyResult(d.records[second], true, T0); noteSpelled(s, second, false);
  const third = pickNext(d, T0, s, opts, seq(0.1)).word;
  assert.notEqual(third, first, 'not after only 1 other word');
  applyResult(d.records[third], true, T0); noteSpelled(s, third, false);
  assert.equal(pendingReady(s).length, 1);
  const fourth = pickNext(d, T0, s, opts, seq(0.1));
  assert.equal(fourth.word, first); assert.equal(fourth.reason, 'requeue');
});
test('never the same word twice in a row while more than one word exists', () => {
  const d = dataWith(['ant', 'bat']);
  const s = createSession();
  let last = null;
  for (let i = 0; i < 40; i++) {
    const now = T0 + i * 1000;
    const w = nextWord(d, now, s, { newPerDay: 5, includeReview: true }, Math.random).word;
    assert.notEqual(w, last, `repeat at ${i}`);
    recordSpell(d, w, { firstTry: Math.random() < 0.6 }, now, s);
    last = w;
  }
});
test('free play weights box 0 ×4 … box 3 ×1', () => {
  const d = dataWith(['ant', 'bat', 'cat', 'dog']);
  [0, 1, 2, 3].forEach((b, i) => { const r = d.records[['ant', 'bat', 'cat', 'dog'][i]]; applyResult(r, true, day(-9)); r.box = b; r.due = day(9); });
  const counts = { ant: 0, bat: 0, cat: 0, dog: 0 };
  const rand = mulberry32(42);
  for (let i = 0; i < 6000; i++) counts[pickNext(d, T0, createSession(), { missionLeft: false, includeReview: false }, rand).word]++;
  assert.ok(counts.ant > counts.bat && counts.bat > counts.cat && counts.cat > counts.dog, JSON.stringify(counts));
  assert.ok(Math.abs(counts.ant / counts.dog - 4) < 0.8, 'about 4:1 ' + JSON.stringify(counts));
});

test('missed words never crowd out new ones (an all-wrong child still meets new words)', () => {
  const d = dataWith(['ant', 'bat', 'cat', 'dog', 'elk', 'fox', 'gnu', 'hen', 'ibis', 'jay']);
  const s = createSession(); const reasons = [];
  for (let i = 0; i < 12; i++) {
    const w = nextWord(d, T0 + i * 60000, s, { newPerDay: 99, includeReview: true }, seq(0.5));
    reasons.push(w.reason); recordSpell(d, w.word, { firstTry: false }, T0 + i * 60000, s);
  }
  const distinct = new Set(s.history).size;
  assert.ok(distinct >= 6, `12 all-wrong picks reached only ${distinct} distinct words`);
  for (let i = 1; i < reasons.length; i++) assert.ok(!(reasons[i] === 'requeue' && reasons[i - 1] === 'requeue'), 'two re-queues in a row');
  for (let i = 1; i < s.history.length; i++) assert.notEqual(s.history[i], s.history[i - 1], 'same word twice in a row');
});
test('free play draws new words too while the daily cap allows', () => {
  const d = dataWith(['ant', 'bat', 'cat', 'dog', 'elk', 'fox', 'gnu', 'hen', 'ibis', 'jay', 'kiwi', 'lark']);
  const s = createSession();
  for (let i = 0; i < 20; i++) { const w = nextWord(d, T0 + i * 60000, s, { newPerDay: 99 }, Math.random); recordSpell(d, w.word, { firstTry: true }, T0 + i * 60000, s); }
  assert.ok(new Set(s.history).size >= 10, `20 picks reached ${new Set(s.history).size} of 12 words`);
});

console.log('scheduler: archived review at 2 and 4 weeks');
test('archived words are due for review at +14 d and +28 d, then never', () => {
  const d = dataWith(['ant', 'bat']);
  for (const w of ['ant', 'bat']) applyResult(d.records[w], true, T0);
  saveNewList(d, [{ word: 'cat' }, { word: 'dog' }], '', day(1));     // ant, bat → archive at day 1
  const arch = archivedLists(d)[0];
  assert.equal(arch.archivedAt, day(1));
  const r = d.records.ant;
  assert.equal(reviewDue(r, arch.archivedAt, day(14)), false, '13 days after archiving: not yet');
  assert.equal(reviewDue(r, arch.archivedAt, day(15)), true, '14 days: due');
  assert.ok(buildMission(d, day(15), { newPerDay: 0 }).includes('ant'), 'review word in the mission');
  applyReview(r, true, day(15), arch.archivedAt);
  assert.equal(r.reviewsDone, 1);
  assert.equal(reviewDue(r, arch.archivedAt, day(22)), false, 'after the 2-week review: not due at 3 weeks');
  assert.equal(reviewDue(r, arch.archivedAt, day(29)), true, '4 weeks: due again');
  applyReview(r, false, day(29), arch.archivedAt);
  assert.equal(reviewDue(r, arch.archivedAt, day(90)), false, 'done after the 4-week review');
  // through recordSpell: an archived word goes through applyReview
  recordSpell(d, 'bat', { firstTry: true }, day(15), createSession());
  assert.equal(d.records.bat.reviewsDone, 1);
});
test('review words are left out when the option is off', () => {
  const d = dataWith(['ant']);
  applyResult(d.records.ant, true, T0);
  saveNewList(d, [{ word: 'cat' }], '', day(1));
  assert.ok(!buildMission(d, day(15), { newPerDay: 0, includeReview: false }).includes('ant'));
});

console.log('words: parser');
test('apostrophes (straight and curly), hyphens, spaces, case, trimming', () => {
  const p = parseList("  Don't \nO’CLOCK\nwell-known\n  ice   cream  \nNEIGHBOR");
  assert.equal(p.ok, true, p.errors.join('; '));
  assert.deepEqual(p.words.map((w) => w.word), ["don't", "o'clock", 'well-known', 'ice cream', 'neighbor']);
});
test('duplicates removed (case-insensitive) and reported', () => {
  const p = parseList('friend\nFriend\n friend \nenough');
  assert.deepEqual(p.words.map((w) => w.word), ['friend', 'enough']);
  assert.ok(p.duplicates.length === 2 && p.warnings.some((w) => /duplicates/i.test(w)));
});
test('syllables and sentence are optional', () => {
  const p = parseList('neighbor | neigh/bor | My neighbor has a dog.\nfriend\nenough | e/nough\nthrough | | We walked through the park.');
  assert.equal(p.ok, true);
  assert.deepEqual(p.words[0], { word: 'neighbor', syllables: ['neigh', 'bor'], sentence: 'My neighbor has a dog.' });
  assert.deepEqual(p.words[1], { word: 'friend', syllables: null, sentence: null });
  assert.deepEqual(p.words[2], { word: 'enough', syllables: ['e', 'nough'], sentence: null });
  assert.deepEqual(p.words[3], { word: 'through', syllables: null, sentence: 'We walked through the park.' });
});
test('syllables that do not spell the word are dropped with a warning', () => {
  const p = parseList('neighbor | nay/bor');
  assert.equal(p.ok, true); assert.equal(p.words[0].syllables, null); assert.ok(p.warnings.length === 1);
});
test('4th part "say as": kept for the voice only, the word itself unchanged', () => {
  const p = parseList("read | | I read a book. | reed\nlive | | | lihv\ncolonel | col/o/nel | The colonel waved. | Kernel\nfriend | | | ");
  assert.equal(p.ok, true, p.errors.join('; '));
  assert.deepEqual(p.words[0], { word: 'read', syllables: null, sentence: 'I read a book.', sayAs: 'reed' });
  assert.deepEqual(p.words[1], { word: 'live', syllables: null, sentence: null, sayAs: 'lihv' });
  assert.deepEqual(p.words[2], { word: 'colonel', syllables: ['col', 'o', 'nel'], sentence: 'The colonel waved.', sayAs: 'Kernel' });
  assert.deepEqual(p.words[3], { word: 'friend', syllables: null, sentence: null }, 'an empty 4th part adds no sayAs');
  assert.deepEqual(parseList(formatList(p.words)).words, p.words, 'round-trips through formatList');
});
test('say-as: syllables / sentence stay optional; curly apostrophes, hyphens and spaces allowed', () => {
  const p = parseList("cant | | | can’t\nice cream | | | eyes-cream\nneighbor | neigh/bor");
  assert.equal(p.ok, true, p.errors.join('; '));
  assert.equal(p.words[0].sayAs, "can't"); assert.equal(p.words[1].sayAs, 'eyes-cream');
  assert.deepEqual(p.words[2], { word: 'neighbor', syllables: ['neigh', 'bor'], sentence: null });
});
test('invalid say-as is rejected with the line number and a clear reason', () => {
  const bad = parseList('friend\nread | | I read. | r33d');
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.length, 1);
  assert.ok(/Line 2/.test(bad.errors[0]) && /say as/i.test(bad.errors[0]) && /r33d/.test(bad.errors[0]) && /letters/.test(bad.errors[0]), bad.errors[0]);
  const long = parseList('read | | | ' + 'a'.repeat(41));
  assert.equal(long.ok, false); assert.ok(/40 characters/.test(long.errors[0]), long.errors[0]);
  assert.equal(parseList('read | | | ' + 'a'.repeat(40)).ok, true, '40 characters are fine');
  const many = parseList('read | | I read. | reed | extra');
  assert.equal(many.ok, false); assert.ok(/too many/i.test(many.errors[0]), many.errors[0]);
});
test('the word store keeps a valid say-as and drops an invalid one', () => {
  const d = defaultWords(T0);
  saveNewList(d, [{ word: 'read', sayAs: 'reed' }, { word: 'live', sayAs: '<b>' }], '', T0);
  assert.equal(activeList(d).words[0].sayAs, 'reed'); assert.equal('sayAs' in activeList(d).words[1], false);
  const n = normalizeWordsData(JSON.parse(JSON.stringify(d)), T0);
  assert.equal(activeList(n).words[0].sayAs, 'reed');
  assert.equal(wordInfo(n, 'read').sayAs, 'reed');
});
test('41 words are rejected, 40 accepted', () => {
  const w = Array.from({ length: 41 }, (_, i) => 'word' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26)));
  assert.equal(parseList(w.join('\n')).ok, false);
  assert.ok(parseList(w.join('\n')).errors.some((e) => /41/.test(e)));
  assert.equal(parseList(w.slice(0, 40).join('\n')).ok, true);
});
test('digits / symbols rejected with the line number; empty list rejected', () => {
  const p = parseList('friend\nw0rd\nhi!');
  assert.equal(p.ok, false); assert.ok(/Line 2/.test(p.errors[0]) && /Line 3/.test(p.errors[1]));
  assert.equal(parseList('  \n\n').ok, false);
  assert.equal(parseList('-dash').ok, false);
});
test('comma-separated paste and comments; round-trips through formatList', () => {
  const p = parseList('# week 5\nbecause, friend, enough');
  assert.deepEqual(p.words.map((w) => w.word), ['because', 'friend', 'enough']);
  const q = parseList(formatList(SAMPLE_WORDS));
  assert.deepEqual(q.words, SAMPLE_WORDS);
});
test('sample list: 15 words, syllables valid where given', () => {
  assert.equal(SAMPLE_WORDS.length, 15);
  for (const w of SAMPLE_WORDS) if (w.syllables) assert.equal(w.syllables.join(''), w.word);
});
test('normalizeWord, ringLetters, pattern ranges and syllable breaks', () => {
  assert.equal(normalizeWord('  Ice\tCREAM '), 'ice cream');
  assert.deepEqual(ringLetters("don't"), ['d', 'o', 'n', 't']);
  assert.deepEqual(patternRanges('enough', 'ough'), [[2, 6]]);
  assert.deepEqual(patternRanges('question', '-tion'), [[4, 8]]);
  assert.deepEqual(patternRanges('friend', 'ough'), []);
  assert.deepEqual([...syllableBreaks('beautiful', ['beau', 'ti', 'ful'])], [4, 6]);
  assert.deepEqual([...syllableBreaks('ice cream', ['ice', 'cream'])], [4]);
});

console.log('words: attempt alignment (R2 marks)');
test('a missing letter becomes a gap, the rest stays ok', () => {
  const r = diffAttempt('frend', 'friend');
  assert.deepEqual(r.cells.map((c) => c.state), ['ok', 'ok', 'missing', 'ok', 'ok', 'ok']);
  assert.deepEqual(r.cells.filter((c) => c.state !== 'missing').map((c) => c.ch).join(''), 'frend', 'only the child\'s own letters');
});
test('an extra letter is marked, the rest stays ok', () => {
  const r = diffAttempt('becausse', 'because');
  assert.equal(r.cells.filter((c) => c.state === 'bad').length, 1);
  assert.equal(r.cells.filter((c) => c.state === 'ok').length, 7);
});
test('swapped letters mark both positions; correct word has no marks', () => {
  assert.deepEqual(diffAttempt('freind', 'friend').cells.map((c) => c.state), ['ok', 'ok', 'bad', 'bad', 'ok', 'ok']);
  assert.equal(diffAttempt('Friend', 'friend').correct, true);
});

console.log('word store');
test('saving a list archives the previous one, drops the sample, and queues the Qualifier', () => {
  const d = defaultWords(T0);
  assert.equal(activeList(d).sample, true); assert.equal(qualifierDue(d), false);
  const l1 = saveNewList(d, parseList('alpha\nbeta').words, 'ph', T0);
  assert.equal(d.lists.length, 1, 'sample list dropped'); assert.equal(qualifierDue(d), true); assert.equal(l1.pattern, 'ph');
  recordQualifier(d, [{ word: 'alpha', correct: true }, { word: 'beta', correct: false }], T0);
  assert.equal(qualifierDue(d), false);
  assert.equal(d.records.alpha.box, 2); assert.equal(d.records.beta.focus, true);
  assert.equal(wordInfo(d, 'beta').look, true, 'Focus word gets the Look step'); assert.equal(wordInfo(d, 'alpha').look, false);
  const l2 = saveNewList(d, parseList('gamma').words, '', day(7));
  assert.equal(archivedLists(d)[0].id, l1.id); assert.equal(activeList(d).id, l2.id);
  assert.ok(restoreList(d, l1.id, day(8))); assert.equal(activeList(d).id, l1.id); assert.equal(d.records.alpha.listId, l1.id);
  assert.ok(deleteList(d, l2.id)); assert.equal(d.records.gamma, undefined);
  assert.equal(deleteList(d, l1.id), false, 'the active list cannot be deleted');
});
test('report: pretest vs latest Friday, statuses, copy text', () => {
  const d = defaultWords(T0);
  saveNewList(d, parseList('alpha\nbeta\ngamma').words, '', T0);
  recordQualifier(d, [{ word: 'alpha', correct: true }, { word: 'beta', correct: false }, { word: 'gamma', correct: false }], T0);
  recordFriday(d, [{ word: 'alpha', correct: true }, { word: 'beta', correct: true }, { word: 'gamma', correct: false }], day(4));
  const r = report(d);
  assert.equal(r.pretest.correct, 1); assert.equal(r.latest.correct, 2); assert.equal(r.history.length, 2);
  assert.equal(r.rows.find((w) => w.word === 'gamma').status, 'Focus');
  const txt = reportText(d, 'Sam');
  assert.ok(/Pretest \(Qualifier\): 1\/3/.test(txt) && /Latest Friday Test: 2\/3/.test(txt) && /missed: gamma/.test(txt), txt);
});
test('set launch power: 0.65 + 0.35 × c/n, nitro 1 + 0.25 × c/n (n = 1 reproduces 100/125 vs 65/100)', () => {
  assert.deepEqual(setLaunch(1, 1), { powerScale: 1, nitroScale: 1.25 });
  assert.deepEqual(setLaunch(0, 1), { powerScale: 0.65, nitroScale: 1 });
  assert.deepEqual(setLaunch(1, 2), { powerScale: 0.825, nitroScale: 1.125 });
  assert.deepEqual(setLaunch(3, 4), { powerScale: 0.9125, nitroScale: 1.1875 });
  assert.deepEqual(setLaunch(0, 3), { powerScale: 0.65, nitroScale: 1 });
  assert.ok(Math.abs(setLaunch(1, 3).powerScale - (0.65 + 0.35 / 3)) < 1e-9);
  assert.deepEqual(setLaunch(0, 0), { powerScale: 0.65, nitroScale: 1 }, 'no words: the miss power');
});
test('"Words before each race" option: 1-4, default 2', () => {
  assert.equal(DEFAULT_OPTIONS.wordsPerRace, 2); assert.deepEqual(WORDS_PER_RACE, [1, 2, 3, 4]);
});
test('spelling bonus = $400 × (1 + 0.1 × streak, cap 10) × coinMult', () => {
  assert.equal(spellBonus(0), 400); assert.equal(spellBonus(3), 520); assert.equal(spellBonus(25), 800); assert.equal(spellBonus(0, 1.25), 500);
});
test('streak counts consecutive first-try words and resets on a miss', () => {
  const d = dataWith(['ant', 'bat', 'cat']);
  const s = createSession();
  recordSpell(d, 'ant', { firstTry: true }, T0, s);
  const r2 = recordSpell(d, 'bat', { firstTry: true }, T0, s);
  assert.equal(r2.streakBefore, 1); assert.equal(r2.streak, 2);
  assert.equal(recordSpell(d, 'cat', { firstTry: false }, T0, s).streak, 0);
});
test('corrupt or partial words data falls back safely', () => {
  assert.equal(activeList(normalizeWordsData(null, T0)).sample, true);
  assert.equal(activeList(normalizeWordsData({ lists: 'x' }, T0)).sample, true);
  const d = normalizeWordsData({ lists: [{ id: 'L1', words: [{ word: 'Friend' }, { word: '!!' }] }], activeId: 'L1', records: { friend: { box: 9, daysCorrect: ['2026-10-12', 3] } } }, T0);
  assert.deepEqual(activeList(d).words.map((w) => w.word), ['friend']);
  assert.equal(d.records.friend.box, 3); assert.deepEqual(d.records.friend.daysCorrect, ['2026-10-12']);
  assert.equal(dayKey(T0), '2026-10-12');
});

// ---------- speech robustness (tts.js with fake backends) ----------
console.log('speech: availability, start timeout, fallbacks');
const {
  createTTS, START_TIMEOUT_MS, FIRST_START_TIMEOUT_MS, GIVE_UP_AFTER, STUCK_MS, VOICES_TIMEOUT_MS, UNLOCK_TEXT, UNLOCK_VOLUME,
  SYSTEM_VOICE, CHECK_PHRASE, activeUtterances,
} = await import('../src/spelling/tts.js');
async function atest(name, fn) {
  try { await fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failures.push(name); console.log('  ✗ ' + name + '\n      ' + (e && e.message).split('\n').join('\n      ')); }
}
const VOICE = [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }];
function fakeSynth({ voices = VOICE, starts = true, paused = false } = {}) {
  const b = { calls: { speak: 0, cancel: 0, resume: 0 }, speaking: false, pending: false, paused, getVoices: () => voices,
    speak(u) { b.calls.speak++; if (!starts) return; setTimeout(() => u.onstart && u.onstart(), 5); setTimeout(() => u.onend && u.onend(), 30); },
    cancel() { b.calls.cancel++; }, resume() { b.calls.resume++; b.paused = false; }, addEventListener() {} };
  return b;
}
const timed = async (p) => { const t = Date.now(); const v = await p; return [v, Date.now() - t]; };
await atest('working speech: ready() true at once, say() resolves true, health ok', async () => {
  const t = createTTS(); t.useBackend(fakeSynth());
  const [ok, ms] = await timed(t.ready()); assert.equal(ok, true); assert.ok(ms < 50, `ready took ${ms} ms`);
  assert.equal(await t.say('friend'), true); assert.equal(t.health, 'ok'); assert.equal(t.working, true);
});
test('watchdog constants: 5 s for the first utterance, 3 s afterwards, off for the session after 3 in a row', () => {
  assert.equal(FIRST_START_TIMEOUT_MS, 5000); assert.equal(START_TIMEOUT_MS, 3000); assert.equal(GIVE_UP_AFTER, 3); assert.equal(STUCK_MS, 300);
});
await atest(`no onstart: the first utterance gives up after ${FIRST_START_TIMEOUT_MS} ms, the next after ${START_TIMEOUT_MS} ms (per word, not permanent)`, async () => {
  const t = createTTS(); const b = fakeSynth({ starts: false }); t.useBackend(b);
  assert.equal(await t.ready(), true);                        // voices are listed…
  assert.equal(t.startTimeoutFor(), FIRST_START_TIMEOUT_MS);
  const [ok, ms] = await timed(t.say('friend'));              // …but nothing ever starts
  assert.equal(ok, false); assert.ok(ms >= FIRST_START_TIMEOUT_MS - 20 && ms < FIRST_START_TIMEOUT_MS + 400, `first gave up after ${ms} ms`);
  assert.equal(t.health, 'no-start'); assert.equal(t.working, false); assert.ok(b.calls.cancel >= 1, 'the stuck utterance is cancelled');
  assert.equal(t.gaveUp, false, 'one failure is not permanent'); assert.equal(await t.ready(), true, 'the next word tries speech again');
  assert.equal(t.startTimeoutFor(), START_TIMEOUT_MS);
  const [ok2, ms2] = await timed(t.say('friend'));
  assert.equal(ok2, false); assert.ok(ms2 >= START_TIMEOUT_MS - 20 && ms2 < START_TIMEOUT_MS + 400, `second gave up after ${ms2} ms`);
  assert.equal(t.failStreak, 2); assert.equal(t.gaveUp, false);
});
// short watchdogs for the rest of the behavior tests
const QUICK = { firstStartMs: 120, startMs: 60 };
await atest('only 3 failures in a row turn speech off for the session; a start in between resets the count', async () => {
  let starts = false;
  const t = createTTS(QUICK); const b = fakeSynth(); b.speak = (u) => { b.calls.speak++; if (starts) { setTimeout(() => u.onstart(), 5); setTimeout(() => u.onend(), 20); } };
  t.useBackend(b);
  assert.equal(await t.say('a'), false); assert.equal(await t.say('b'), false);
  assert.equal(t.failStreak, 2); assert.equal(t.gaveUp, false);
  starts = true; assert.equal(await t.say('c'), true); assert.equal(t.failStreak, 0, 'a start resets the streak');
  starts = false;
  for (let i = 0; i < 2; i++) assert.equal(await t.say('x'), false);
  assert.equal(t.gaveUp, false, 'two in a row: still trying');
  assert.equal(await t.say('x'), false);
  assert.equal(t.gaveUp, true, 'three in a row: off for the session'); assert.equal(t.working, false);
  const n = b.calls.speak;
  const [r, ms] = await timed(t.ready()); assert.equal(r, false); assert.ok(ms < 30, 'ready() is false at once (no waiting)');
  const [p, ms2] = await timed(t.present({ word: 'friend' }));
  assert.equal(p, false); assert.ok(ms2 < 30); assert.equal(b.calls.speak, n, 'automatic speech is not even tried');
  const lit = []; const [, ms3] = await timed(t.spell('ab', (i) => lit.push(i), { gap: 5 }));
  assert.deepEqual(lit, [0, 1]); assert.equal(b.calls.speak, n, 'spell() lights the tiles on a timer'); assert.ok(ms3 < 1200);
});
await atest('re-probe on tap: after giving up, Hear it (reprobe + present) tries again; a start turns speech back on', async () => {
  let starts = false;
  const t = createTTS(QUICK); const b = fakeSynth(); b.speak = (u) => { b.calls.speak++; if (starts) { setTimeout(() => u.onstart(), 5); setTimeout(() => u.onend(), 20); } };
  t.useBackend(b);
  for (let i = 0; i < 3; i++) await t.say('x');
  assert.equal(t.gaveUp, true);
  // a failed re-probe: one try, then off again at once
  let n = b.calls.speak; t.reprobe(); assert.equal(t.gaveUp, false);
  assert.equal(await t.present({ word: 'friend' }), false); assert.equal(b.calls.speak, n + 1, 'the tap made one real attempt');
  assert.equal(t.gaveUp, true, 'still silent: off again after that one try');
  // a successful re-probe
  starts = true; n = b.calls.speak; t.reprobe();
  assert.equal(await t.present({ word: 'friend' }), true); assert.ok(b.calls.speak > n);
  assert.equal(t.gaveUp, false); assert.equal(t.health, 'ok'); assert.equal(await t.ready(), true); assert.equal(t.working, true);
});
await atest('utterance references (Chrome GC): every utterance in flight is held until onend / onerror', async () => {
  const base = activeUtterances.length;
  const t = createTTS(); let held = null; let endIt = null;
  const b = fakeSynth(); b.speak = (u) => { held = activeUtterances.includes(u); setTimeout(() => u.onstart(), 5); endIt = () => u.onend(); };
  t.useBackend(b);
  const p = t.say('friend');
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(held, true, 'held while speaking'); assert.equal(activeUtterances.length, base + 1);
  endIt(); await p;
  assert.equal(activeUtterances.length, base, 'released on onend');
  b.speak = (u) => { setTimeout(() => u.onerror({ error: 'synthesis-failed' }), 5); };
  assert.equal(await t.say('x'), false); assert.equal(activeUtterances.length, base, 'released on onerror'); assert.equal(t.lastError, 'synthesis-failed');
});
await atest('Speech check re-probes when speech is off for the session', async () => {
  const t = createTTS(QUICK); let starts = false;
  const b = fakeSynth(); b.speak = (u) => { if (starts) { setTimeout(() => u.onstart(), 5); setTimeout(() => u.onend(), 20); } };
  t.useBackend(b);
  for (let i = 0; i < 3; i++) await t.say('x');
  assert.equal(t.gaveUp, true);
  starts = true; const r = await t.runCheck(); assert.equal(r.ok, true); assert.equal(t.gaveUp, false); assert.match(r.text, /off for this session/);
});
await atest(`no voices ${VOICES_TIMEOUT_MS} ms after asking → ready() false`, async () => {
  const t = createTTS(); t.useBackend(fakeSynth({ voices: [] }));
  const [ok, ms] = await timed(t.ready());
  assert.equal(ok, false); assert.ok(ms >= VOICES_TIMEOUT_MS - 20, `waited ${ms} ms`); assert.equal(t.health, 'no-voices');
});
await atest('voices that arrive late (polled) make ready() true before the timeout', async () => {
  const voices = []; const t = createTTS(); t.useBackend(fakeSynth({ voices }));
  setTimeout(() => voices.push(VOICE[0]), 300);
  const [ok, ms] = await timed(t.ready()); assert.equal(ok, true); assert.ok(ms < VOICES_TIMEOUT_MS, `took ${ms} ms`);
});
await atest('no speechSynthesis at all: available false, ready() false, say() false', async () => {
  const t = createTTS(); t.useBackend(null);
  assert.equal(t.available, false); assert.equal(await t.ready(), false); assert.equal(await t.say('x'), false); assert.equal(t.health, 'missing');
});
await atest('newer speech or cancel() is not a failure (say → null)', async () => {
  const t = createTTS(); t.useBackend(fakeSynth({ starts: false }));
  const p = t.say('friend'); setTimeout(() => t.cancel(), 50);
  assert.equal(await p, null); assert.equal(t.health, 'unknown');
});
await atest('iOS paused synth: unlock() (every tap) and speak() call resume()', async () => {
  const t = createTTS(); const b = fakeSynth({ paused: true }); t.useBackend(b);
  t.unlock(); assert.equal(b.calls.resume, 1);
  b.paused = true; t.unlock(); assert.equal(b.calls.resume, 2, 'a later tap resumes again');
  b.paused = true; assert.equal(await t.say('x'), true); assert.ok(b.calls.resume >= 3);
});
await atest('after a failed start, spell() lights the letters on a timer instead of a watchdog per silent letter', async () => {
  const t = createTTS(QUICK); t.useBackend(fakeSynth({ starts: false }));
  await t.say('x');
  const lit = []; const [, ms] = await timed(t.spell('abc', (i) => lit.push(i), { gap: 10 }));
  assert.deepEqual(lit, [0, 1, 2]); assert.ok(ms < 1600, `spell took ${ms} ms`);
});


console.log('speech: phrases and voices');
const { buildPresentation, buildRepeat, buildSyllables, rankVoices, voiceQuality, RATES, PITCH } = await import('../src/spelling/tts.js');
test('buildPresentation: carrier, sentence, word — exact texts', () => {
  assert.deepEqual(buildPresentation({ word: 'neighbor', sentence: 'My neighbor has a dog.' }), ['The word is, neighbor.', 'My neighbor has a dog.', 'neighbor.']);
  assert.deepEqual(buildPresentation({ word: 'friend' }), ['The word is, friend.', 'friend.'], 'no sentence: carrier + word');
  assert.deepEqual(buildPresentation({ word: 'friend', sentence: '  My  friend waved ' }), ['The word is, friend.', 'My friend waved.', 'friend.'], 'a sentence gets a full stop');
  assert.deepEqual(buildPresentation({ word: '' }), []);
});
test('buildPresentation / buildRepeat use the say-as text wherever the word is spoken', () => {
  assert.deepEqual(buildPresentation({ word: 'read', sentence: 'I read a book.', sayAs: 'reed' }), ['The word is, reed.', 'I read a book.', 'reed.']);
  assert.equal(buildRepeat({ word: 'read', sayAs: 'reed' }), 'reed. reed.');
  assert.equal(buildRepeat({ word: 'friend' }), 'friend. friend.');
});
test('buildSyllables: "neigh, bor."', () => {
  assert.equal(buildSyllables(['neigh', 'bor']), 'neigh, bor.');
  assert.equal(buildSyllables(['es', 'pe', 'cial', 'ly']), 'es, pe, cial, ly.');
  assert.equal(buildSyllables(null), '');
});
test('rates 0.5 / 0.6 / 0.85 and pitch 1.0', () => {
  assert.deepEqual(RATES, { veryslow: 0.5, slow: 0.6, normal: 0.85 }); assert.equal(PITCH, 1);
});
const V = (name, lang = 'en-US', extra = {}) => ({ name, lang, localService: true, default: false, ...extra });
test('rankVoices: Premium > Natural > Google > plain, novelty last, non-English dropped', () => {
  const list = [
    V('Fred'), V('Thomas', 'fr-FR'), V('Alex'), V('Google US English', 'en-US', { localService: false }), V('Daniel', 'en-GB'),
    V('Microsoft Aria Online (Natural) - English (United States)', 'en-US', { localService: false }), V('Zarvox'), V('Ava (Premium)'),
    V('Samantha (Enhanced)'), V('eSpeak English', 'en'), V('Bad News'), V('Kathy'), V('Microsoft Zira - English (United States)'),
  ];
  const names = rankVoices(list).map((v) => v.name);
  assert.ok(!names.includes('Thomas'), 'French voice left out');
  const at = (n) => names.indexOf(n);
  assert.ok(at('Ava (Premium)') < at('Samantha (Enhanced)'), 'Premium before Enhanced');
  assert.ok(at('Samantha (Enhanced)') < at('Microsoft Aria Online (Natural) - English (United States)'), 'Enhanced before Natural');
  assert.ok(at('Microsoft Aria Online (Natural) - English (United States)') < at('Google US English'), 'Natural before Google');
  assert.ok(at('Google US English') < at('Alex') && at('Google US English') < at('Microsoft Zira - English (United States)'), 'Google before plain en-US');
  assert.ok(at('Alex') < at('Daniel'), 'en-US before other en-*');
  const novelty = ['Fred', 'Zarvox', 'eSpeak English', 'Bad News', 'Kathy'];
  const firstNovelty = Math.min(...novelty.map(at));
  assert.equal(firstNovelty, names.length - novelty.length, `novelty voices last: ${names.join(', ')}`);
  assert.equal(names[0], 'Ava (Premium)');
});
test('rankVoices: within the same quality, on-device voices before online ones (they start at once)', () => {
  const list = [V('Microsoft Aria Online (Natural) - English (United States)', 'en-US', { localService: false }), V('Microsoft Jenny (Natural) - English (United States)'),
    V('Alex', 'en-US', { localService: false }), V('Victoria'), V('Google US English', 'en-US', { localService: false })];
  const names = rankVoices(list).map((v) => v.name);
  assert.ok(names.indexOf('Microsoft Jenny (Natural) - English (United States)') < names.indexOf('Microsoft Aria Online (Natural) - English (United States)'), 'local Natural before online Natural');
  assert.ok(names.indexOf('Victoria') < names.indexOf('Alex'), 'local plain en-US before online plain en-US');
  assert.ok(names.indexOf('Google US English') < names.indexOf('Victoria'), 'quality still comes first: Google (online) before a plain local voice');
  assert.equal(names[0], 'Microsoft Jenny (Natural) - English (United States)');
});
test('voiceQuality: Apple names count as clear, compact / novelty as 0, empty list ranks to nothing', () => {
  assert.ok(voiceQuality(V('Samantha')).score > voiceQuality(V('Google US English')).score);
  assert.equal(voiceQuality(V('Samantha', 'en-US', { voiceURI: 'com.apple.speech.synthesis.voice.samantha.compact' })).score, 0);
  assert.equal(voiceQuality(V('Grandma (English (US))')).score, 0);
  assert.equal(voiceQuality(V('Sandy')).label, 'Novelty');
  assert.deepEqual(rankVoices([]), []); assert.deepEqual(rankVoices(null), []);
});

console.log('speech: presentation, voice choice');
function recSynth(voices) {
  const b = { said: [], voices: [], rates: [], pitches: [], speaking: false, pending: false, getVoices: () => voices,
    speak(u) { b.said.push(u.text); b.voices.push(u.voice ? u.voice.name : null); b.rates.push(u.rate); b.pitches.push(u.pitch); setTimeout(() => u.onstart && u.onstart(), 5); setTimeout(() => u.onend && u.onend(), 20); },
    cancel() {}, resume() {}, addEventListener() {} };
  return b;
}
const VOICES = [V('Fake US', 'en-US', { default: true }), V('Ava (Premium)'), V('Fred'), V('Amélie', 'fr-CA')];
await atest('present() speaks exactly [carrier, sentence, word] at 0.85, pitch 1.0, in the best voice', async () => {
  const t = createTTS(); const b = recSynth(VOICES); t.useBackend(b);
  assert.equal(await t.present({ word: 'neighbor', sentence: 'My neighbor has a dog.' }), true);
  assert.deepEqual(b.said, ['The word is, neighbor.', 'My neighbor has a dog.', 'neighbor.']);
  assert.ok(b.rates.every((r) => r === 0.85) && b.pitches.every((p) => p === 1));
  assert.ok(b.voices.every((v) => v === 'Ava (Premium)'), b.voices.join());
});
await atest('sayAgain / saySyllables use the slow rate (very slow stays very slow)', async () => {
  const t = createTTS(); const b = recSynth(VOICES); t.useBackend(b);
  await t.sayAgain({ word: 'read', sayAs: 'reed' }); await t.saySyllables(['neigh', 'bor']);
  assert.deepEqual(b.said, ['reed. reed.', 'neigh, bor.']); assert.deepEqual(b.rates, [0.6, 0.6]);
  t.setRate('veryslow'); await t.sayAgain({ word: 'friend' }); assert.equal(b.rates.at(-1), 0.5);
});
await atest('a picked voice is used when present; a voice missing on this device falls back to the ranked default', async () => {
  const t = createTTS(); const b = recSynth(VOICES); t.useBackend(b);
  t.setVoice({ name: 'Fake US', lang: 'en-US' }); assert.equal(t.voiceName, 'Fake US');
  await t.say('x'); assert.equal(b.voices.at(-1), 'Fake US');
  t.setVoice({ name: 'Some Other Phone Voice', lang: 'en-US' }); assert.equal(t.voiceName, 'Ava (Premium)');
  t.setVoice(null); assert.equal(t.voiceName, 'Ava (Premium)');
  await t.present({ word: 'x' }, { voice: VOICES[0] }); assert.equal(b.voices.at(-1), 'Fake US', 'Test button voice override');
});
await atest('a new presentation cancels the one in progress (no leftover phrases)', async () => {
  const t = createTTS(); const b = recSynth(VOICES); t.useBackend(b);
  const first = t.present({ word: 'neighbor', sentence: 'My neighbor has a dog.' });
  await new Promise((r) => setTimeout(r, 10));
  const second = t.present({ word: 'friend' });
  assert.equal(await first, null); assert.equal(await second, true);
  assert.deepEqual(b.said, ['The word is, neighbor.', 'The word is, friend.', 'friend.']);
});
await atest(`a long carrier phrase that starts slowly but within ${START_TIMEOUT_MS} ms still plays`, async () => {
  const t = createTTS(); const b = recSynth(VOICES);
  b.speak = (u) => { b.said.push(u.text); setTimeout(() => u.onstart && u.onstart(), 900); setTimeout(() => u.onend && u.onend(), 2600); };
  t.useBackend(b);
  assert.equal(await t.present({ word: 'neighbor' }), true); assert.equal(t.health, 'ok');
});

console.log('speech: slow voices, stuck synth, not-allowed, unlock, system voice, speech check');
await atest('a slow online voice (onstart after 4 s on first use, like "Google US English") still plays', async () => {
  const t = createTTS(); const b = recSynth([V('Google US English', 'en-US', { localService: false })]);
  b.speak = (u) => { b.said.push(u.text); const d = b.said.length === 1 ? 4000 : 20; setTimeout(() => u.onstart && u.onstart(), d); setTimeout(() => u.onend && u.onend(), d + 30); };
  t.useBackend(b);
  assert.equal(await t.present({ word: 'neighbor' }), true); assert.equal(t.health, 'ok'); assert.equal(t.failures, 0);
  assert.deepEqual(b.said, ['The word is, neighbor.', 'neighbor.']);
});
await atest(`stuck synth: cancel() before each phrase, resume() when paused, cancel() again when still speaking after ${STUCK_MS} ms`, async () => {
  const t = createTTS(); const b = recSynth(VOICES); let cancels = 0, resumes = 0, stuckAt = 0, spokeAt = 0;
  b.speaking = true; b.paused = true;
  b.cancel = () => { cancels++; if (cancels >= 2) b.speaking = false; };        // only the second cancel unsticks it
  b.resume = () => { resumes++; b.paused = false; };
  const sp = b.speak; b.speak = (u) => { spokeAt = Date.now(); sp(u); };
  t.useBackend(b);
  stuckAt = Date.now();
  assert.equal(await t.present({ word: 'friend' }), true);
  assert.ok(cancels >= 2, `cancelled ${cancels}×`); assert.ok(resumes >= 1, 'a paused synth is resumed');
  assert.ok(spokeAt - stuckAt >= STUCK_MS - 10, `spoke ${spokeAt - stuckAt} ms after the first cancel`);
  assert.equal(t.stats.stuckCancels, 1);
  // not stuck: no extra wait
  cancels = 0; const t0 = Date.now(); assert.equal(await t.say('x'), true); assert.equal(cancels, 1); assert.ok(Date.now() - t0 < STUCK_MS);
});
await atest("onerror 'not-allowed': health not-allowed, a tap is needed, the next unlock() speaks again inside it", async () => {
  const t = createTTS(QUICK); const b = recSynth(VOICES); const vols = [];
  let mode = 'deny';
  b.speak = (u) => { b.said.push(u.text); vols.push(u.volume); if (mode === 'deny') setTimeout(() => u.onerror({ error: 'not-allowed' }), 5); else { setTimeout(() => u.onstart(), 5); setTimeout(() => u.onend(), 20); } };
  t.useBackend(b);
  t.unlock(); assert.equal(t.unlocked, true);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(t.unlocked, false, 'the unlock was refused'); assert.equal(t.needsTap, true);
  assert.equal(await t.say('friend'), false); assert.equal(t.health, 'not-allowed'); assert.equal(t.gaveUp, false);
  mode = 'ok'; b.said.length = 0; t.unlock();
  assert.deepEqual(b.said, [UNLOCK_TEXT], 'the next tap unlocks again');
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(t.needsTap, false); assert.equal(await t.say('friend'), true);
});
await atest(`unlock() speaks a real word ("${UNLOCK_TEXT}" at volume ${UNLOCK_VOLUME}), once, in the chosen voice`, async () => {
  const t = createTTS(); const b = recSynth(VOICES); const vols = []; const sp = b.speak; b.speak = (u) => { vols.push(u.volume); sp(u); };
  t.useBackend(b);
  t.unlock(); t.unlock(); t.unlock();
  assert.deepEqual(b.said, ['ready']); assert.deepEqual(vols, [0.01]); assert.equal(b.voices[0], 'Ava (Premium)');
  assert.notEqual(UNLOCK_TEXT.trim(), '');
});
await atest('"Use default system voice": no voice is set on the utterance', async () => {
  const t = createTTS(); const b = recSynth(VOICES); t.useBackend(b);
  t.setVoice({ name: SYSTEM_VOICE }); assert.equal(t.systemVoice, true); assert.equal(t.voiceName, ''); assert.equal(t.resolveVoice({ name: SYSTEM_VOICE }), null);
  assert.equal(await t.say('friend'), true); assert.equal(b.voices.at(-1), null);
  await t.present({ word: 'x' }, { voice: SYSTEM_VOICE }); assert.equal(b.voices.at(-1), null, 'Test button: system voice');
  t.setVoice(null); assert.equal(t.systemVoice, false); assert.equal(t.voiceName, 'Ava (Premium)');
});
await atest('Speech check: speaks the check phrase at once and logs API / voices / chosen voice / speak() / onstart / onend', async () => {
  const t = createTTS(); const b = recSynth(VOICES); t.useBackend(b);
  const seen = [];
  const p = t.runCheck({ header: ['Spell Jump test'], onLine: (l) => seen.push(l) });
  assert.deepEqual(b.said, [CHECK_PHRASE], 'speak() was called synchronously (inside the tap)');
  assert.equal(CHECK_PHRASE, 'The word is, neighbor.');
  const res = await p;
  assert.equal(res.ok, true);
  const text = res.text;
  for (const re of [/^Speech check · /m, /Spell Jump test/, /\[\+\s*\d+ ms\] API present: yes/, /voices: 4 \(3 English, 3 on-device\)/, /chosen voice: Ava \(Premium\) · en-US · localService: true/,
    /speak\(\) called: "The word is, neighbor\." \(onstart watchdog 5000 ms\)/, /onstart after \d+ ms/, /onend after \d+ ms/, /result: speech started/]) assert.match(text, re);
  assert.equal(seen.length, res.lines.length, 'onLine fired for every line');
  assert.equal(t.lastCheck.text, text, 'the last log is kept');
});
await atest('Speech check: a silent synth logs "watchdog fired"; an error logs its code; no API logs that', async () => {
  const t = createTTS(QUICK); t.useBackend(fakeSynth({ starts: false }));
  const r1 = await t.runCheck();
  assert.equal(r1.ok, false); assert.match(r1.text, /watchdog fired: no onstart after 120 ms/); assert.match(r1.text, /result: no speech started/);
  const b = recSynth(VOICES); b.speak = (u) => setTimeout(() => u.onerror({ error: 'audio-busy' }), 5); t.useBackend(b);
  const r2 = await t.runCheck(); assert.match(r2.text, /onerror: audio-busy after \d+ ms/); assert.equal(t.health, 'error');
  t.useBackend(null); const r3 = await t.runCheck(); assert.match(r3.text, /API present: no/); assert.equal(r3.ok, false);
});

// ---------------------------------------------------------------------------------------------------------------
// Family sync: the server protocol (src/sync/protocol.mjs, driven with an in-memory Map store exactly like the
// Netlify Blobs adapter in netlify/functions/family.mjs), family codes and the merge rules (src/sync/merge.js).
const { handle, memoryStore, MAX_BODY } = await import('../src/sync/protocol.mjs');
const { generateCode, normalizeCode, CODE_ALPHABET, CODE_RE } = await import('../src/sync/codes.js');
const { mergeFamily, mergeSave, mergeWords } = await import('../src/sync/merge.js');
const { defaultSave } = await import('../src/meta/save.js');

const CODE = 'K7QX-M2PA';
const JSON_CT = 'application/json';
const doc = (rev, data, extra = {}) => ({ rev, updatedAt: T0 + rev, deviceId: 'dlaptop', data, ...extra });
async function call(store, method, path, body, { contentType = JSON_CT, raw = false, contentLength } = {}) {
  const res = await handle({ method, path, contentType, contentLength, body: body === undefined ? null : raw ? body : JSON.stringify(body) }, store);
  return { ...res, json: JSON.parse(res.body) };
}
const famData = (players = [{ id: 'pmia', name: 'Mia' }], extra = {}) => ({ v: 1, players: players.map((p) => ({ color: '#ff3b5c', createdAt: T0, updatedAt: T0, ...p })), pinHash: 'h1', pinUpdatedAt: T0, options: {}, optionsUpdatedAt: {}, removedPlayers: [], ...extra });

console.log('sync: protocol (create / get / put / rev checks)');
await atest('POST creates a family (201); GET returns it with its players; a second POST is 409', async () => {
  const st = memoryStore();
  const r = await call(st, 'POST', `/api/family/${CODE}`, doc(1, famData()));
  assert.equal(r.status, 201); assert.equal(r.json.rev, 1);
  const g = await call(st, 'GET', `/api/family/${CODE}`);
  assert.equal(g.status, 200); assert.equal(g.json.family.rev, 1); assert.equal(g.json.family.data.players[0].name, 'Mia');
  assert.deepEqual(g.json.players, { pmia: { save: null, words: null } });
  assert.equal((await call(st, 'POST', `/api/family/${CODE}`, doc(1, famData()))).status, 409);
  assert.equal((await call(memoryStore(), 'POST', `/api/family/${CODE}`, doc(2, famData()))).status, 400, 'a new family starts at rev 1');
});
await atest('GET of an unknown family is 404; every response is JSON with Cache-Control: no-store', async () => {
  const g = await call(memoryStore(), 'GET', `/api/family/${CODE}`);
  assert.equal(g.status, 404); assert.equal(g.headers['cache-control'], 'no-store'); assert.match(g.headers['content-type'], /application\/json/);
});
await atest('PUT stores only rev = stored rev + 1, else 409 with the stored doc', async () => {
  const st = memoryStore();
  await call(st, 'POST', `/api/family/${CODE}`, doc(1, famData()));
  const ok = await call(st, 'PUT', `/api/family/${CODE}/family`, doc(2, famData([{ id: 'pmia', name: 'Mia' }, { id: 'pleo', name: 'Leo' }])));
  assert.equal(ok.status, 200); assert.equal(ok.json.rev, 2);
  const stale = await call(st, 'PUT', `/api/family/${CODE}/family`, doc(2, famData()));
  assert.equal(stale.status, 409); assert.equal(stale.json.doc.rev, 2); assert.equal(stale.json.doc.data.players.length, 2);
  assert.equal((await call(st, 'PUT', `/api/family/${CODE}/family`, doc(4, famData()))).status, 409, 'skipping a rev');
  assert.equal((await call(st, 'PUT', `/api/family/${CODE}/family`, doc(3, famData()))).status, 200);
});
await atest('a new player key must start at rev 1 (409 with doc null otherwise); its family must exist (404)', async () => {
  const st = memoryStore();
  await call(st, 'POST', `/api/family/${CODE}`, doc(1, famData()));
  const c = await call(st, 'PUT', `/api/family/${CODE}/pmia.save`, doc(3, { cash: 5 }));
  assert.equal(c.status, 409); assert.equal(c.json.doc, null);
  assert.equal((await call(st, 'PUT', `/api/family/${CODE}/pmia.save`, doc(1, { cash: 5 }))).status, 200);
  assert.equal((await call(st, 'PUT', `/api/family/${CODE}/pmia.words`, doc(1, { lists: [] }))).status, 200);
  const g = await call(st, 'GET', `/api/family/${CODE}`);
  assert.equal(g.json.players.pmia.save.data.cash, 5); assert.equal(g.json.players.pmia.words.rev, 1);
  assert.equal((await call(st, 'PUT', '/api/family/ZZZZ-2222/pmia.save', doc(1, { cash: 1 }))).status, 404);
});
await atest('two devices racing with the same rev: exactly one write wins, the other gets 409 (conditional set)', async () => {
  const st = memoryStore();
  await call(st, 'POST', `/api/family/${CODE}`, doc(1, famData()));
  const [a, b] = await Promise.all([
    call(st, 'PUT', `/api/family/${CODE}/pmia.save`, doc(1, { cash: 1 }, { deviceId: 'dipad' })),
    call(st, 'PUT', `/api/family/${CODE}/pmia.save`, doc(1, { cash: 2 }, { deviceId: 'dlaptop' })),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const [c, d] = await Promise.all([call(st, 'PUT', `/api/family/${CODE}/pmia.save`, doc(2, { cash: 3 })), call(st, 'PUT', `/api/family/${CODE}/pmia.save`, doc(2, { cash: 4 }))]);
  assert.deepEqual([c.status, d.status].sort(), [200, 409]);
});
await atest('removed players (tombstones in the family doc) are not listed by GET; DELETE is 405', async () => {
  const st = memoryStore();
  await call(st, 'POST', `/api/family/${CODE}`, doc(1, famData([{ id: 'pmia', name: 'Mia' }, { id: 'pleo', name: 'Leo' }], { removedPlayers: ['pleo'] })));
  assert.deepEqual(Object.keys((await call(st, 'GET', `/api/family/${CODE}`)).json.players), ['pmia']);
  assert.equal((await call(st, 'DELETE', `/api/family/${CODE}/pleo.save`)).status, 405);
  assert.equal((await call(st, 'GET', `/api/family/${CODE}/pleo.save`)).status, 405);
});
console.log('sync: protocol validation (400) and size cap');
await atest('bad family codes are 400', async () => {
  for (const c of ['k7qx-m2pa', 'K7QXM2PA', 'K7QX-M2P', 'K7QX-M2PA1', 'K0QX-M2PA', 'K1QX-M2PA', 'K7Q%20-M2PA']) {
    assert.equal((await call(memoryStore(), 'GET', `/api/family/${c}`)).status, 400, c);
  }
});
await atest('bad keys are 400 (family | <id>.save | <id>.words, id a-z 0-9 _ - up to 32)', async () => {
  const st = memoryStore();
  await call(st, 'POST', `/api/family/${CODE}`, doc(1, famData()));
  for (const k of ['Mia.save', 'pmia.notes', 'pmia', 'a'.repeat(33) + '.save', 'p mia.words', '.save', 'families']) {
    assert.equal((await call(st, 'PUT', `/api/family/${CODE}/${encodeURIComponent(k)}`, doc(1, {}))).status, 400, k);
  }
  assert.equal((await call(st, 'PUT', `/api/family/${CODE}/${'a'.repeat(32)}.save`, doc(1, {}))).status, 200, '32 chars is fine');
  assert.equal((await call(st, 'PUT', `/api/family/${CODE}/p_m-1.words`, doc(1, {}))).status, 200);
});
await atest('JSON only: wrong Content-Type, broken JSON, missing rev / updatedAt / deviceId / data are 400', async () => {
  const st = memoryStore();
  await call(st, 'POST', `/api/family/${CODE}`, doc(1, famData()));
  const url = `/api/family/${CODE}/pmia.save`;
  assert.equal((await call(st, 'PUT', url, doc(1, {}), { contentType: 'text/plain' })).status, 400);
  assert.equal((await call(st, 'PUT', url, '{"rev":1,', { raw: true })).status, 400);
  assert.equal((await call(st, 'PUT', url, '[1,2]', { raw: true })).status, 400);
  for (const bad of [{ ...doc(1, {}), rev: 0 }, { ...doc(1, {}), rev: 1.5 }, { ...doc(1, {}), updatedAt: 'now' }, { ...doc(1, {}), deviceId: '' },
    { ...doc(1, {}), deviceId: 'x'.repeat(65) }, { ...doc(1, {}), data: [1] }, { rev: 1, updatedAt: 1, deviceId: 'd' }]) {
    assert.equal((await call(st, 'PUT', url, bad)).status, 400, JSON.stringify(bad).slice(0, 60));
  }
});
await atest(`bodies over ${MAX_BODY / 1024} KB are refused (400 too-large), by Content-Length and by actual size`, async () => {
  const st = memoryStore();
  await call(st, 'POST', `/api/family/${CODE}`, doc(1, famData()));
  const big = doc(1, { pad: 'x'.repeat(MAX_BODY) });
  const r = await call(st, 'PUT', `/api/family/${CODE}/pmia.words`, big);
  assert.equal(r.status, 400); assert.equal(r.json.error, 'too-large');
  assert.equal((await call(st, 'PUT', `/api/family/${CODE}/pmia.words`, doc(1, {}), { contentLength: String(MAX_BODY + 1) })).json.error, 'too-large');
  const fits = doc(1, { pad: 'x'.repeat(MAX_BODY - 200) });
  assert.equal((await call(st, 'PUT', `/api/family/${CODE}/pmia.words`, fits)).status, 200, 'just under the cap is stored');
});
test('family codes: 8 characters from the no-look-alike alphabet as XXXX-XXXX; typed codes normalize', () => {
  for (let i = 0; i < 200; i++) { const c = generateCode(); assert.match(c, CODE_RE); assert.ok(c.replace('-', '').split('').every((ch) => CODE_ALPHABET.includes(ch)), c); }
  assert.ok(!/[IO01]/.test(CODE_ALPHABET)); assert.equal(CODE_ALPHABET.length, 32);
  assert.equal(normalizeCode(' k7qx m2pa '), 'K7QX-M2PA'); assert.equal(normalizeCode('K7QX-M2PA'), 'K7QX-M2PA');
  assert.equal(normalizeCode('K7QX-M2P'), null); assert.equal(normalizeCode('K7QX-M2P0'), null);
});

console.log('sync: merge rules — family');
const P = (id, name, t, extra = {}) => ({ id, name, color: '#3b7dd9', createdAt: t, updatedAt: t, ...extra });
test('players = union by id; removedPlayers tombstones drop a player on both sides', () => {
  const a = famData([P('pmia', 'Mia', T0), P('pleo', 'Leo', T0 + 5)]);
  const b = famData([P('pmia', 'Mia', T0), P('pava', 'Ava', T0 + 9)], { removedPlayers: ['pleo'] });
  const m = mergeFamily(a, b);
  assert.deepEqual(m.players.map((p) => p.id), ['pmia', 'pava']); assert.deepEqual(m.removedPlayers, ['pleo']);
  assert.deepEqual(mergeFamily(b, a).players.map((p) => p.id), ['pmia', 'pava'], 'symmetric');
});
test('same player on both sides (both renamed): the later updatedAt wins', () => {
  const a = famData([P('pmia', 'Mia', T0, { updatedAt: T0 + 50, name: 'Mimi' })]);
  const b = famData([P('pmia', 'Mia', T0, { updatedAt: T0 + 90, name: 'Amelia' })]);
  assert.equal(mergeFamily(a, b).players[0].name, 'Amelia'); assert.equal(mergeFamily(b, a).players[0].name, 'Amelia');
});
test('PIN hash: the later pinUpdatedAt wins either way; Join adopts the family PIN', () => {
  const a = famData([], { pinHash: 'hOLD', pinUpdatedAt: T0 }), b = famData([], { pinHash: 'hNEW', pinUpdatedAt: T0 + 1000 });
  assert.equal(mergeFamily(a, b).pinHash, 'hNEW'); assert.equal(mergeFamily(b, a).pinHash, 'hNEW');
  assert.equal(mergeFamily(a, famData([], { pinHash: null, pinUpdatedAt: 0 })).pinHash, 'hOLD', 'no PIN never erases one');
  const fresh = famData([], { pinHash: 'hIPAD', pinUpdatedAt: T0 + 5000 });
  assert.equal(mergeFamily(fresh, a, { preferRemotePin: true }).pinHash, 'hOLD');
  assert.equal(mergeFamily(fresh, a).pinHash, 'hIPAD');
});
test('per-player options: the later optionsUpdatedAt wins per player (both devices changed different players)', () => {
  const a = famData([P('pmia', 'Mia', T0), P('pleo', 'Leo', T0)], { options: { pmia: { rate: 'slow' }, pleo: { rate: 'normal' } }, optionsUpdatedAt: { pmia: T0 + 100, pleo: T0 + 1 } });
  const b = famData([P('pmia', 'Mia', T0), P('pleo', 'Leo', T0)], { options: { pmia: { rate: 'veryslow' }, pleo: { rate: 'slow', wordsPerRace: 4 } }, optionsUpdatedAt: { pmia: T0 + 2, pleo: T0 + 200 } });
  const m = mergeFamily(a, b);
  assert.equal(m.options.pmia.rate, 'slow'); assert.equal(m.options.pleo.wordsPerRace, 4);
  assert.deepEqual(m.optionsUpdatedAt, { pmia: T0 + 100, pleo: T0 + 200 });
  assert.deepEqual(mergeFamily(b, a).options, m.options, 'symmetric');
});

console.log('sync: merge rules — words');
const W = (d, t) => ({ updatedAt: t, data: d });
const WL = ['enough', 'through', 'neighbor', 'friend', 'because', 'thought'];
function wordsDoc() { const d = defaultWords(T0); saveNewList(d, WL.map((w) => ({ word: w })), 'ough', T0); d.qualifierPending = null; return d; }
const clone = (x) => JSON.parse(JSON.stringify(x));
test('both devices practiced different words offline: no record is lost; the same word keeps the later lastSeen', () => {
  const base = wordsDoc();
  const a = clone(base), b = clone(base);
  recordSpell(a, 'enough', { firstTry: true }, day(1));
  recordSpell(a, 'friend', { firstTry: false }, day(1, 1));
  recordSpell(b, 'through', { firstTry: true }, day(1, 2));
  recordSpell(b, 'friend', { firstTry: true }, day(1, 3));
  const m = mergeWords(W(a, day(1, 1)), W(b, day(1, 3)), day(2));
  assert.equal(m.records.enough.attempts, 1); assert.equal(m.records.through.attempts, 1);
  assert.equal(m.records.friend.lastSeen, day(1, 3)); assert.equal(m.records.friend.firstTry, 1, "the later 'friend' wins");
  for (const w of WL) assert.ok(m.records[w], `record ${w} kept`);
  assert.deepEqual(mergeWords(W(b, day(1, 3)), W(a, day(1, 1)), day(2)).records, m.records, 'symmetric');
});
test('records: same lastSeen → the higher box wins', () => {
  const a = wordsDoc(), b = clone(a);
  Object.assign(a.records.enough, { lastSeen: day(3), box: 1 }); Object.assign(b.records.enough, { lastSeen: day(3), box: 3 });
  assert.equal(mergeWords(W(a, 9), W(b, 1)).records.enough.box, 3); assert.equal(mergeWords(W(b, 1), W(a, 9)).records.enough.box, 3);
});
test('lists = union by id; the same list keeps its later archive state; deleted lists stay deleted', () => {
  const a = wordsDoc(), b = clone(a);
  const oldId = a.activeId;
  saveNewList(a, [{ word: 'weather' }, { word: 'whether' }], '', day(7));          // A: new week, old list archived
  const m = mergeWords(W(a, day(7)), W(b, day(8)), day(8));
  assert.equal(m.lists.length, 2); assert.ok(m.lists.find((l) => l.id === oldId).archivedAt > 0, 'archived on A wins');
  assert.equal(m.activeId, a.activeId, 'the list chosen later (activeAt) stays active even though B changed something later');
  const c = clone(m); deleteList(c, oldId);
  const m2 = mergeWords(W(c, day(9)), W(m, day(10)), day(10));
  assert.ok(!m2.lists.some((l) => l.id === oldId), 'tombstoned list does not come back'); assert.deepEqual(m2.deletedLists, [oldId]);
});
test('the built-in sample list leaves when one side replaced it', () => {
  const a = defaultWords(T0), b = defaultWords(T0);
  saveNewList(a, [{ word: 'weather' }], '', day(1));
  const m = mergeWords(W(a, day(1)), W(b, day(2)), day(2));
  assert.ok(!m.lists.some((l) => l.sample)); assert.equal(m.activeId, a.activeId);
});
test('tests = union by date + score (the same test is not doubled)', () => {
  const a = wordsDoc(), b = clone(a);
  recordFriday(a, WL.map((w, i) => ({ word: w, correct: i > 0 })), day(4));
  const shared = clone(a.tests);
  b.tests = clone(shared);
  recordQualifier(b, WL.map((w) => ({ word: w, correct: true })), day(5));
  const m = mergeWords(W(a, day(4)), W(b, day(5)), day(5));
  assert.equal(m.tests.length, 2); assert.deepEqual(m.tests.map((t) => t.kind), ['friday', 'qualifier']);
});
test('today / streak come from the doc with the later updatedAt; best streak never goes down', () => {
  const a = wordsDoc(), b = clone(a);
  a.today = { date: dayKey(day(2)), count: 3, newCount: 1, missionPaid: false }; a.streak = 5; a.bestStreak = 7;
  b.today = { date: dayKey(day(2)), count: 6, newCount: 2, missionPaid: false }; b.streak = 1; b.bestStreak = 2;
  const m = mergeWords(W(a, day(2, 1)), W(b, day(2, 2)), day(2, 3));
  assert.equal(m.today.count, 6); assert.equal(m.streak, 1); assert.equal(m.bestStreak, 7);
});
test('a spelling reset on one side drops the other side\'s older progress', () => {
  const a = wordsDoc(), b = clone(a);
  recordSpell(b, 'enough', { firstTry: true }, day(1));
  resetSpelling(a, day(2));
  const m = mergeWords(W(a, day(2)), W(b, day(1)), day(2));
  assert.equal(m.records.enough.attempts, 0); assert.equal(m.resetAt, day(2));
});

console.log('sync: merge rules — game save');
const S = (t, f) => { const s = defaultSave(); f(s); return { updatedAt: t, data: s }; };
test('the later save wins whole, except cash = max and cars / tracks = union (both devices changed it)', () => {
  const laptop = S(day(1), (s) => { s.cash = 9000; s.owned = ['beater', 'rally']; s.selectedCar = 'rally'; s.unlocked = ['canyon', 'city']; s.settings.music = false; });
  const ipad = S(day(2), (s) => { s.cash = 4000; s.owned = ['beater']; s.unlocked = ['canyon', 'desert']; s.records.runs = 12; s.settings.music = true; });
  const m = mergeSave(laptop, ipad);
  assert.equal(m.cash, 9000); assert.deepEqual([...m.owned].sort(), ['beater', 'rally']);
  assert.ok(m.unlocked.includes('city') && m.unlocked.includes('desert'));
  assert.equal(m.settings.music, true, 'settings from the later save'); assert.equal(m.records.runs, 12);
  assert.deepEqual(mergeSave(ipad, laptop), m, 'symmetric');
});
test('a "Reset game save" (resetAt) wins whole over older progress', () => {
  const reset = S(day(3), (s) => { s.resetAt = day(3); });
  const old = S(day(4), (s) => { s.cash = 50000; s.owned = ['beater', 'rally']; });
  const m = mergeSave(old, reset);
  assert.equal(m.cash, 0); assert.deepEqual(m.owned, ['beater']); assert.equal(m.resetAt, day(3));
});

test('v3.3 save fields: xp max, streak by the later lastDay (best max, shield days union), cosmetics union + equipped from the later doc', () => {
  const a = S(day(1), (s) => { s.xp = 500; s.streak = { count: 6, best: 9, lastDay: dayKey(day(5)), shieldAvailableWeek: '', shieldUsedDays: [dayKey(day(2))], days: [dayKey(day(5))] };
    s.cosmetics = { skins: ['flames'], stickers: ['star'], equipped: { beater: { skin: 'flames', sticker: 'none' } } }; });
  const b = S(day(2), (s) => { s.xp = 300; s.streak = { count: 2, best: 4, lastDay: dayKey(day(6)), shieldAvailableWeek: '', shieldUsedDays: [dayKey(day(4))], days: [dayKey(day(6))] };
    s.cosmetics = { skins: ['camo'], stickers: ['heart'], equipped: { beater: { skin: 'camo', sticker: 'heart' } } }; });
  const m = mergeSave(a, b);
  assert.equal(m.xp, 500);
  assert.equal(m.streak.count, 2, 'the later lastDay wins the count'); assert.equal(m.streak.lastDay, dayKey(day(6))); assert.equal(m.streak.best, 9);
  assert.deepEqual(m.streak.shieldUsedDays, [dayKey(day(2)), dayKey(day(4))]); assert.deepEqual(m.streak.days, [dayKey(day(5)), dayKey(day(6))]);
  assert.deepEqual([...m.cosmetics.skins].sort(), ['camo', 'flames']); assert.deepEqual([...m.cosmetics.stickers].sort(), ['heart', 'number1', 'star'], 'union (+ the 7-day sticker earned by best 9)');
  assert.deepEqual(m.cosmetics.equipped.beater, { skin: 'camo', sticker: 'heart' }, 'equipped: last writer (the later doc) wins');
  assert.deepEqual(mergeSave(b, a), m, 'symmetric');
});
test('v3.3 save fields: crates max each, trophies + champion union, weekBest by week then distance', () => {
  const a = S(day(1), (s) => { s.crates = { earned: 5, opened: 2, sinceCosmetic: 1 }; s.trophies = { L1: ['enough'] }; s.champion = ['L0']; s.weekBest = { week: '2026-W42', distance: 300 }; });
  const b = S(day(2), (s) => { s.crates = { earned: 4, opened: 4, sinceCosmetic: 3 }; s.trophies = { L1: ['through'], L2: ['friend'] }; s.champion = ['L1']; s.weekBest = { week: '2026-W42', distance: 280 }; });
  const m = mergeSave(a, b);
  assert.deepEqual(m.crates, { earned: 5, opened: 4, sinceCosmetic: 3 });
  assert.deepEqual([...m.trophies.L1].sort(), ['enough', 'through']); assert.deepEqual(m.trophies.L2, ['friend']);
  assert.deepEqual([...m.champion].sort(), ['L0', 'L1']); assert.deepEqual(m.weekBest, { week: '2026-W42', distance: 300 });
  assert.ok(m.cosmetics.skins.includes('champion') && m.cosmetics.stickers.includes('trophy'), 'a champion owns the champion cosmetics after a merge');
  const c = S(day(3), (s) => { s.weekBest = { week: '2026-W43', distance: 90 }; });
  assert.deepEqual(mergeSave(a, c).weekBest, { week: '2026-W43', distance: 90 }, 'a newer week replaces the old best');
});
test('words: masteredAt travels with the winning record, or is kept from the other side when the winner is Mastered without one', () => {
  const a = wordsDoc(), b = clone(a);
  Object.assign(a.records.enough, { box: 3, firstTry: 3, daysCorrect: [dayKey(day(1)), dayKey(day(2))], lastSeen: day(2), masteredAt: day(2) });
  Object.assign(b.records.enough, { box: 3, firstTry: 4, daysCorrect: [dayKey(day(1)), dayKey(day(2)), dayKey(day(3))], lastSeen: day(3) });
  delete b.records.enough.masteredAt;
  const m = mergeWords(W(a, day(2)), W(b, day(3)), day(3));
  assert.equal(m.records.enough.firstTry, 4); assert.equal(m.records.enough.masteredAt, day(2));
  Object.assign(b.records.through, { box: 3, firstTry: 3, daysCorrect: [dayKey(day(1)), dayKey(day(3))], lastSeen: day(3), masteredAt: day(3) });
  assert.equal(mergeWords(W(a, day(2)), W(b, day(3)), day(3)).records.through.masteredAt, day(3));
});

// ---------------------------------------------------------------------------------------------------------------
// v3.3 engagement rules (src/meta/engagement.js) and the progress transfer code (src/meta/transfer.js)
const E = await import('../src/meta/engagement.js');
const { encodeTransfer, decodeTransfer, applyImport } = await import('../src/meta/transfer.js');
const { normalize: normalizeSave } = await import('../src/meta/save.js');
const dk = (n) => dayKey(day(n));
console.log('engagement: daily streak + shield');
test('ISO weeks: Mon Oct 12 2026 is 2026-W42 through Sunday; Monday the 19th starts W43; Jan 1 2027 is 2026-W53', () => {
  assert.equal(E.isoWeek(day(0)), '2026-W42'); assert.equal(E.isoWeek(day(6, 7)), '2026-W42'); assert.equal(E.isoWeek(day(7)), '2026-W43');
  assert.equal(E.weekOfDay('2027-01-01'), '2026-W53'); assert.equal(E.mondayOf(day(3)), dk(0));
});
test('a week of streak days with one missed day: the shield covers it on the next open, the streak continues, the calendar shows it', () => {
  const s = defaultSave();
  assert.equal(E.completeDay(s, day(0)).count, 1);
  assert.equal(E.completeDay(s, day(0, 2)).counted, false, 'the same day counts once');
  assert.equal(E.completeDay(s, day(1)).count, 2);
  assert.equal(E.streakNow(s.streak, day(3)), 2, 'Wednesday missed: still alive (the shield can cover it)');
  assert.deepEqual(E.refreshStreak(s, day(3)), [dk(2)], 'opened on Thursday: the shield goes on Wednesday');
  assert.equal(s.streak.shieldAvailableWeek, '', "this week's shield is spent");
  const r = E.completeDay(s, day(3));
  assert.equal(r.count, 3); assert.equal(r.milestone, 3);
  assert.deepEqual(s.streak.shieldUsedDays, [dk(2)]); assert.deepEqual(s.streak.days, [dk(0), dk(1), dk(3)]);
  assert.equal(E.completeDay(s, day(4)).count, 4);
});
test('two missed days in one week break the streak; a miss in each of two weeks is covered by each week\'s shield', () => {
  const s = defaultSave();
  E.completeDay(s, day(0)); E.completeDay(s, day(1));
  assert.equal(E.streakNow(s.streak, day(4)), 0, 'Wed + Thu missed');
  assert.deepEqual(E.refreshStreak(s, day(4)), [], 'no shield is spent on a broken streak');
  assert.equal(E.completeDay(s, day(4)).count, 1); assert.equal(s.streak.best, 2);
  const t = defaultSave();
  E.completeDay(t, day(5)); E.completeDay(t, day(-1));           // (out of order is ignored)
  assert.equal(t.streak.count, 1);
  const u = defaultSave();
  E.completeDay(u, day(4)); E.completeDay(u, day(5));            // Fri, Sat
  assert.equal(E.completeDay(u, day(8)).count, 3, 'Sun (W42) and Mon (W43) missed: one shield each');
  assert.deepEqual(u.streak.shieldUsedDays, [dk(6), dk(7)]);
  E.completeDay(u, day(10));                                      // Wed missed in W43 too: no shield left
  assert.equal(u.streak.count, 1);
});
test('milestones: 3 days → a crate; 7 → crate + Number One sticker; 14 → crate + Rainbow skin', () => {
  const s = defaultSave();
  const got = [];
  for (let i = 0; i < 14; i++) { const r = E.completeDay(s, day(i)); if (r.milestone) got.push([r.milestone, r.crates, r.unlocks.map((u) => u.id).join()]); }
  assert.deepEqual(got, [[3, 1, ''], [7, 1, 'number1'], [14, 1, 'rainbow']]);
  assert.equal(s.crates.earned, 3); assert.ok(s.cosmetics.stickers.includes('number1') && s.cosmetics.skins.includes('rainbow'));
  assert.equal(E.nextMilestone(14), 30); assert.equal(E.nextMilestone(2), 3);
});
console.log('engagement: XP and levels');
test('XP per word / mission; level-up detection; level cosmetics unlock at their level', () => {
  const s = defaultSave();
  let r = E.addXp(s, E.XP.firstTry * 4 + E.XP.fixed);
  assert.equal(r.after, 88); assert.equal(r.levelUp, false); assert.equal(r.levelAfter, 1);
  r = E.addXp(s, E.XP.mastered);
  assert.equal(r.levelUp, true); assert.equal(r.levelBefore, 1); assert.equal(r.levelAfter, 2);
  r = E.addXp(s, 2500 - s.xp);
  assert.equal(r.levelAfter, 9); assert.deepEqual(r.unlocks.map((u) => u.id), ['galaxy']);
  assert.equal(E.levelProgress(s.xp).title, 'Spelling Stunt Driver');
  assert.deepEqual(E.levelProgress(140), { level: 2, title: 'Rookie Speller', into: 40, need: 150, max: false });
});
console.log('engagement: mystery crates');
test('crate rolls with a fixed rand: cash ($300-800 × car tier), jackpot ×3, sticker, skin', () => {
  const s = defaultSave();
  assert.deepEqual(E.rollCrate(s, { tier: 2, rand: seq(0.1, 0.5) }), { kind: 'cash', cash: 1100, pity: false });
  assert.deepEqual(E.rollCrate(s, { tier: 1, rand: seq(0.99, 0) }), { kind: 'jackpot', cash: 900, pity: false });
  assert.deepEqual(E.rollCrate(s, { rand: seq(0.7, 0) }), { kind: 'sticker', id: 'star', name: 'Gold Star', pity: false });
  assert.equal(E.rollCrate(s, { rand: seq(0.9, 0.99) }).id, 'checker');
});
test('a duplicate cosmetic rolls again once; a second duplicate converts to cash', () => {
  const s = defaultSave(); s.cosmetics.stickers = ['star'];
  assert.equal(E.rollCrate(s, { rand: seq(0.7, 0, 0.99) }).id, 'smile', 'the re-roll found a new one');
  const r = E.rollCrate(s, { rand: seq(0.7, 0, 0, 0.5) });
  assert.equal(r.kind, 'cash'); assert.equal(r.converted, 'sticker'); assert.equal(r.cash, 550);
});
test('pity: the 5th crate in a row without a cosmetic is a cosmetic the player does not own; opening applies the reward', () => {
  const s = defaultSave(); s.crates.earned = 6; s.cash = 0;
  for (let i = 0; i < 4; i++) assert.equal(E.openCrate(s, { rand: () => 0.1 }).kind, 'cash');
  assert.equal(s.crates.sinceCosmetic, 4); assert.equal(s.cash, 4 * 350); assert.equal(s.records.lifetimeCash, 1400);
  s.cosmetics.stickers = ['star'];
  const p = E.openCrate(s, { rand: () => 0.1 });
  assert.equal(p.pity, true); assert.equal(p.kind, 'sticker'); assert.notEqual(p.id, 'star');
  assert.ok(s.cosmetics.stickers.includes(p.id)); assert.equal(s.crates.sinceCosmetic, 0); assert.equal(s.crates.opened, 5);
  assert.equal(E.unopened(s), 1); E.openCrate(s); assert.equal(E.openCrate(s), null, 'none left');
});
console.log('engagement: trophies, Week Champion, family board');
const mastered = (r, at) => Object.assign(r, { box: 3, firstTry: 3, seenCount: 3, daysCorrect: [dk(0), dk(1)], masteredAt: at });
test('Week Champion: every word of the active list mastered → badge, Champion skin + Trophy sticker, a crate, +300 XP (once)', () => {
  const s = defaultSave(), w = dataWith(['enough', 'through']);
  mastered(w.records.enough, day(1));
  assert.equal(E.checkChampion(s, w), null);
  mastered(w.records.through, day(2));
  const c = E.checkChampion(s, w);
  assert.equal(c.listId, w.activeId); assert.deepEqual(s.champion, [w.activeId]);
  assert.ok(s.cosmetics.skins.includes('champion') && s.cosmetics.stickers.includes('trophy'));
  assert.equal(s.crates.earned, 1); assert.equal(s.xp, 300); assert.deepEqual([...s.trophies[w.activeId]].sort(), ['enough', 'through']);
  assert.equal(E.checkChampion(s, w), null, 'only once per list');
  assert.equal(E.championThisWeek(s, w, day(3)), true); assert.equal(E.championThisWeek(s, w, day(8)), false, 'the crown is for that week');
});
test('family board: ranked by words mastered this week, then streak, then best jump; leader + nudge; Monday resets the week', () => {
  const mk = (id, name, words, streakDays, jump) => {
    const s = defaultSave(), w = dataWith(['enough', 'through', 'friend']);
    words.forEach((x, i) => mastered(w.records[x], day(1, i)));
    for (const d of streakDays) E.completeDay(s, day(d));
    if (jump) E.noteJump(s, jump, day(2));
    return { player: { id, name, color: '#ff3b5c' }, save: s, words: w };
  };
  const mia = mk('pmia', 'Mia', ['enough', 'through'], [1, 2], 120), leo = mk('pleo', 'Leo', ['friend'], [0, 1, 2], 300), ava = mk('pava', 'Ava', ['enough'], [2], 50);
  let rows = E.weeklyBoard([leo, ava, mia], day(2, 3));
  assert.deepEqual(rows.map((r) => [r.id, r.rank, r.mastered, r.streak, r.best]), [['pmia', 1, 2, 2, 120], ['pleo', 2, 1, 3, 300], ['pava', 3, 1, 1, 50]]);
  assert.equal(rows[0].leader, true);
  assert.equal(E.boardNudge(rows, 'pleo'), 'Mia is 1 word ahead'); assert.equal(E.boardNudge(rows, 'pmia'), "You're in the lead!");
  assert.equal(E.boardNudge(rows, 'pava'), "Leo's streak is 2 days longer");
  assert.equal(E.boardNudge(E.weeklyBoard([mia], day(2)), 'pmia'), '', 'one player: no nudge');
  rows = E.weeklyBoard([leo, ava, mia], day(7, 1));                  // next Monday: words + best jump reset
  assert.deepEqual(rows.map((r) => [r.id, r.mastered, r.best]), [['pava', 0, 0], ['pleo', 0, 0], ['pmia', 0, 0]], 'all tied: by name');
  assert.equal(rows.some((r) => r.leader), false, 'no leader on a tie');
  assert.deepEqual(rows.map((r) => r.streak), [0, 0, 0], 'nobody played Sat-Sun: two misses break every streak');
});
console.log('progress transfer code');
await atest('encode → decode round trip, gzip (CompressionStream) and plain (no CompressionStream)', async () => {
  const s = defaultSave(); s.cash = 4321; s.owned = ['beater', 'rally']; s.xp = 777;
  const w = dataWith(['enough', 'through']); recordSpell(w, 'enough', { firstTry: true }, day(1));
  const gz = await encodeTransfer({ player: { name: 'Nathan', color: '#3b7dd9' }, save: s, words: w }, { now: day(2) });
  assert.match(gz, /^H4sI[A-Za-z0-9_-]+$/, 'gzip magic, base64url');
  const plain = await encodeTransfer({ player: { name: 'Nathan', color: '#3b7dd9' }, save: s, words: w }, { now: day(2), CompressionStream: null });
  assert.match(plain, /^eyJ2/, 'plain JSON');
  assert.ok(gz.length < plain.length);
  for (const c of [gz, plain, plain.replace(/(.{40})/g, '$1\n ')]) {
    const d = await decodeTransfer(c);
    assert.equal(d.ok, true, d.error); assert.equal(d.data.player.name, 'Nathan'); assert.equal(d.data.save.cash, 4321); assert.equal(d.data.save.xp, 777);
    assert.deepEqual(d.data.save.owned, ['beater', 'rally']); assert.equal(d.data.words.records.enough.firstTry, 1); assert.equal(d.data.exportedAt, day(2));
  }
  const noDS = await decodeTransfer(gz, { DecompressionStream: null });
  assert.equal(noDS.ok, false); assert.match(noDS.error, /browser/);
  assert.equal((await decodeTransfer(plain, { DecompressionStream: null })).ok, true, 'a plain code needs no DecompressionStream');
});
await atest('corrupt / foreign codes are refused with a message, never thrown', async () => {
  const gz = await encodeTransfer({ player: { name: 'Nathan' }, save: defaultSave(), words: dataWith(['enough']) });
  for (const c of ['', '   ', 'hello world!', gz.slice(0, 50), 'eyJmb28iOjF9', btoa(JSON.stringify({ v: 1, player: { name: '' }, save: {}, words: { lists: [] } })), btoa(JSON.stringify({ v: 9, player: { name: 'X' }, save: {}, words: { lists: [] } }))]) {
    const r = await decodeTransfer(c);
    assert.equal(r.ok, false, c.slice(0, 20)); assert.ok(r.error.length > 10);
  }
});
await atest('import: same name (any case) → merged with the sync rules; a new name → a new player', async () => {
  const store = {}, fam = { players: [{ id: 'pnat', name: 'Nathan', color: '#3b7dd9' }] };
  const here = defaultSave(); here.cash = 9000; here.owned = ['beater', 'muscle']; here.xp = 100;
  store['pnat.save'] = here; store['pnat.words'] = dataWith(['enough', 'through']);
  recordSpell(store['pnat.words'], 'through', { firstTry: true }, day(1));
  const deps = {
    createPlayer: (f, name, color) => { if (f.players.length >= 4) return null; const p = { id: 'p' + name.toLowerCase(), name, color }; f.players.push(p); return p; },
    loadSave: (id) => clone(store[id + '.save']), loadWords: (id) => clone(store[id + '.words']),
    writeSave: (id, s) => { store[id + '.save'] = s; }, writeWords: (id, w) => { store[id + '.words'] = w; },
  };
  const s = defaultSave(); s.cash = 4000; s.owned = ['beater', 'rally']; s.xp = 900;
  const w = dataWith(['enough', 'through']); recordSpell(w, 'enough', { firstTry: true }, day(2));
  const d = (await decodeTransfer(await encodeTransfer({ player: { name: 'NATHAN' }, save: s, words: w }, { now: day(2) }))).data;
  const m = applyImport(fam, d, deps, day(3));
  assert.equal(m.mode, 'merge'); assert.equal(fam.players.length, 1);
  assert.equal(store['pnat.save'].cash, 9000); assert.deepEqual([...store['pnat.save'].owned].sort(), ['beater', 'muscle', 'rally']); assert.equal(store['pnat.save'].xp, 900);
  assert.equal(store['pnat.words'].records.enough.firstTry, 1); assert.equal(store['pnat.words'].records.through.firstTry, 1, 'both sides\' practice kept');
  assert.equal(m.message, 'Merged into Nathan: $9,000, 3 cars, 2 words');
  const d2 = (await decodeTransfer(await encodeTransfer({ player: { name: 'Mia', color: '#ff3b5c' }, save: s, words: w }))).data;
  const a = applyImport(fam, d2, deps, day(3));
  assert.equal(a.mode, 'add'); assert.equal(a.message, 'Added Mia'); assert.equal(store['pmia.save'].cash, 4000); assert.equal(fam.players.length, 2);
  fam.players.push({ id: 'x1', name: 'A' }, { id: 'x2', name: 'B' });
  const full = applyImport(fam, { ...d2, player: { name: 'Zed' } }, deps);
  assert.equal(full.ok, false); assert.match(full.error, /4 players/);
});

console.log('self-update: reload guard (meta/selfUpdate.js)');
test('safe screens: picker, title, garage, track select, with nothing in progress', () => {
  for (const screen of ['players', 'title', 'garage', 'tracks']) assert.equal(safeToReload({ screen }), true, screen);
  for (const screen of ['run', 'test', 'results', 'newplayer']) assert.equal(safeToReload({ screen }), false, screen);
  assert.equal(safeToReload({ screen: 'tracks', spelling: true }), false, 'spell panel open');
  assert.equal(safeToReload({ screen: 'garage', running: true }), false, 'a run in progress');
  assert.equal(safeToReload({ screen: 'title', parentZone: true }), false, 'Parent Zone open');
  assert.equal(safeToReload({ screen: 'title', testing: true }), false, 'a test');
});
test('the first install (no controller at load) never reloads; a later new worker does, once', () => {
  let reloads = 0;
  const g = createUpdateGuard({ hadController: false, isSafe: () => true, reload: () => reloads++ });
  assert.equal(g.onControllerChange(), false); assert.equal(reloads, 0, 'clients.claim() on first install');
  assert.equal(g.onControllerChange(), true); assert.equal(reloads, 1, 'next version');
  assert.equal(g.onControllerChange(), false); assert.equal(g.check(), false); assert.equal(reloads, 1, 'at most once per page');
});
test('not safe: one "restarting soon" notice, then reload when the app is back on a safe screen', () => {
  let reloads = 0, notices = 0, state = { screen: 'run', spelling: true };
  const g = createUpdateGuard({ hadController: true, isSafe: () => safeToReload(state), reload: () => reloads++, notify: () => notices++ });
  assert.equal(g.onControllerChange(), false); assert.equal(g.pending, true);
  state = { screen: 'results' }; assert.equal(g.check(), false);
  assert.equal(reloads, 0); assert.equal(notices, 1, 'notified once');
  state = { screen: 'garage' }; assert.equal(g.check(), true);
  assert.equal(reloads, 1); assert.equal(g.reloaded, true); assert.equal(g.check(), false); assert.equal(reloads, 1);
});
test('check() with no update waiting does nothing; a throwing isSafe counts as not safe', () => {
  let reloads = 0;
  const g = createUpdateGuard({ hadController: true, isSafe: () => { throw new Error('boom'); }, reload: () => reloads++ });
  assert.equal(g.check(), false); assert.equal(g.onControllerChange(), false); assert.equal(reloads, 0);
});

// ---------- natural voice (v3.4): server (src/tts/server.mjs), client texts + engine (src/spelling/cloudVoice.js) ----------
console.log('natural voice: server (prepare / clip / status)');
const TS = await import('../src/tts/server.mjs');
const { CLOUD_VOICES, CLOUD_VOICE_IDS, DEFAULT_CLOUD_VOICE } = await import('../src/tts/voices.js');
const CV = await import('../src/spelling/cloudVoice.js');
const Profiles = await import('../src/spelling/profiles.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FAM = 'K7QX-M2PA';
function fakeSynth2({ fail = () => false } = {}) {
  const f = async (text, voice) => { f.calls.push({ text, voice }); if (fail(text)) throw Object.assign(new Error('boom'), { status: 500 }); return new TextEncoder().encode(`MP3:${voice}:${text}`); };
  f.calls = [];
  return f;
}
const ttsDeps = (extra = {}) => ({ store: TS.memoryTtsStore(), families: TS.memoryFamilies([FAM]), synthesize: fakeSynth2(), now: () => T0, ...extra });
async function tcall(deps, method, path, body, { contentType = 'application/json', raw = false } = {}) {
  const res = await TS.handleTts({ method, path, contentType, body: body === undefined ? null : raw ? body : JSON.stringify(body) }, deps);
  return { ...res, json: typeof res.body === 'string' && res.body ? JSON.parse(res.body) : null };
}
const prep = (texts, voice = DEFAULT_CLOUD_VOICE, code = FAM) => ({ code, voice, items: texts.map((text) => ({ text })) });
await atest('voice allowlist: the six Google voices, Neural2-F first (the default), each with a friendly name', async () => {
  assert.deepEqual(CLOUD_VOICE_IDS, ['en-US-Neural2-F', 'en-US-Neural2-D', 'en-US-Neural2-C', 'en-US-Neural2-J', 'en-US-Studio-O', 'en-US-Studio-Q']);
  assert.equal(DEFAULT_CLOUD_VOICE, 'en-US-Neural2-F');
  assert.ok(CLOUD_VOICES.every((v) => v.name && v.desc));
});
await atest('clip id = first 32 hex of sha256(voice + "\\n" + text); the Google request body', async () => {
  const { createHash } = await import('node:crypto');
  assert.equal(await TS.clipId('en-US-Neural2-F', 'neighbor.'), createHash('sha256').update('en-US-Neural2-F\nneighbor.').digest('hex').slice(0, 32));
  assert.deepEqual(TS.googleRequest('hi.', 'en-US-Neural2-D'), { input: { text: 'hi.' }, voice: { languageCode: 'en-US', name: 'en-US-Neural2-D' }, audioConfig: { audioEncoding: 'MP3', speakingRate: 0.92 } });
});
test('API key: GOOGLE_TTS_API_KEY, else the TexttoVoice alias; blank counts as missing', () => {
  const env = (o) => (name) => o[name];
  assert.equal(TS.apiKeyFrom(env({ GOOGLE_TTS_API_KEY: 'main' })), 'main');
  assert.equal(TS.apiKeyFrom(env({ TexttoVoice: 'alias' })), 'alias', 'the alias is honored');
  assert.equal(TS.apiKeyFrom(env({ GOOGLE_TTS_API_KEY: 'main', TexttoVoice: 'alias' })), 'main', 'GOOGLE_TTS_API_KEY wins');
  assert.equal(TS.apiKeyFrom(env({ GOOGLE_TTS_API_KEY: '  ', TexttoVoice: ' alias ' })), 'alias');
  assert.equal(TS.apiKeyFrom(env({})), '');
  assert.equal(TS.apiKeyFrom(() => { throw new Error('no env'); }), '');
});
await atest('status: always 200, key false without a synthesizer, true with one', async () => {
  let r = await tcall(ttsDeps({ synthesize: null }), 'GET', '/api/tts/status');
  assert.equal(r.status, 200); assert.equal(r.json.key, false); assert.equal(r.headers['cache-control'], 'no-store');
  r = await tcall(ttsDeps(), 'GET', '/api/tts/status'); assert.equal(r.json.key, true); assert.deepEqual(r.json.voices, CLOUD_VOICE_IDS);
});
await atest('prepare: an unknown family code → 403 and nothing is synthesized (strangers cannot spend the quota)', async () => {
  const d = ttsDeps();
  const r = await tcall(d, 'POST', '/api/tts/prepare', prep(['neighbor.'], DEFAULT_CLOUD_VOICE, 'ZZZZ-2222'));
  assert.equal(r.status, 403); assert.equal(r.json.error, 'unknown-family'); assert.equal(d.synthesize.calls.length, 0);
});
await atest('prepare: no API key → 503 no-key', async () => {
  const r = await tcall(ttsDeps({ synthesize: null }), 'POST', '/api/tts/prepare', prep(['neighbor.']));
  assert.equal(r.status, 503); assert.equal(r.json.error, 'no-key');
});
await atest('prepare validation: voice off the allowlist, > 80 items, a text over 200 chars, empty text, bad code, non-JSON → 400', async () => {
  const d = ttsDeps();
  for (const [body, why] of [
    [prep(['a'], 'en-US-Wavenet-A'), 'voice'], [prep(['a'], 'en-GB-Neural2-A'), 'voice'],
    [prep(Array.from({ length: 81 }, (_, i) => `w${i}.`)), '81 items'], [prep(['x'.repeat(201)]), '201 chars'], [prep(['   ']), 'blank'],
    [prep(['a'], DEFAULT_CLOUD_VOICE, 'abcd-efgh'), 'code'], [{ code: FAM, voice: DEFAULT_CLOUD_VOICE, items: 'nope' }, 'items'], [{ code: FAM, voice: DEFAULT_CLOUD_VOICE, items: [{ text: 3 }] }, 'text type'],
  ]) assert.equal((await tcall(d, 'POST', '/api/tts/prepare', body)).status, 400, why);
  assert.equal((await tcall(d, 'POST', '/api/tts/prepare', 'code=1', { raw: true, contentType: 'text/plain' })).status, 400, 'content type');
  assert.equal((await tcall(d, 'POST', '/api/tts/prepare', '{oops', { raw: true })).status, 400, 'bad JSON');
  assert.equal((await tcall(d, 'POST', '/api/tts/prepare', prep(['x'.repeat(200)]))).status, 200, '200 chars is fine');
  assert.equal((await tcall(d, 'POST', '/api/tts/prepare', prep(Array.from({ length: 80 }, (_, i) => `w${i}.`)))).status, 200, '80 items is fine');
  assert.equal((await tcall(d, 'GET', '/api/tts/prepare')).status, 405);
  assert.equal((await tcall(d, 'GET', '/api/tts/nope')).status, 404);
});
await atest('prepare: generates each new clip once (trimmed, duplicates merged), then serves it from the store by id', async () => {
  const d = ttsDeps();
  let r = await tcall(d, 'POST', '/api/tts/prepare', prep(['The word is, neighbor.', ' neighbor. ', 'neighbor.']));
  assert.equal(r.status, 200); assert.equal(r.json.generated, 2); assert.equal(r.json.cached, 0); assert.equal(r.json.failed, 0);
  assert.deepEqual(Object.keys(r.json.clips).sort(), ['The word is, neighbor.', 'neighbor.']);
  const id = await TS.clipId(DEFAULT_CLOUD_VOICE, 'neighbor.');
  assert.equal(r.json.clips['neighbor.'], `/api/tts/clip/${id}`);
  assert.deepEqual(d.store.map.get(`tts/${id}`).metadata, { voice: DEFAULT_CLOUD_VOICE, chars: 9 });
  assert.equal(r.json.charsToday, 31);
  r = await tcall(d, 'POST', '/api/tts/prepare', prep(['neighbor.', 'enough.']));
  assert.equal(r.json.generated, 1); assert.equal(r.json.cached, 1); assert.equal(d.synthesize.calls.length, 3, 'neighbor. was not made again');
  assert.equal(r.json.charsToday, 38);
  r = await tcall(d, 'POST', '/api/tts/prepare', prep(['neighbor.'], 'en-US-Neural2-D'));
  assert.equal(r.json.generated, 1, 'another voice is another clip'); assert.notEqual(r.json.clips['neighbor.'], `/api/tts/clip/${id}`);
  assert.equal(d.store.map.get(`ttsUsage/${FAM}/${TS.dayKey(T0)}`) != null, true, 'per-family daily counter');
});
await atest('clip: 200 audio/mpeg with an immutable cache header; unknown or malformed id → 404', async () => {
  const d = ttsDeps();
  const r0 = await tcall(d, 'POST', '/api/tts/prepare', prep(['neighbor.']));
  const r = await TS.handleTts({ method: 'GET', path: r0.json.clips['neighbor.'] }, d);
  assert.equal(r.status, 200); assert.equal(r.headers['content-type'], 'audio/mpeg'); assert.equal(r.headers['cache-control'], 'public, max-age=31536000, immutable');
  assert.equal(new TextDecoder().decode(r.body), `MP3:${DEFAULT_CLOUD_VOICE}:neighbor.`);
  assert.equal((await tcall(d, 'GET', '/api/tts/clip/' + 'a'.repeat(32))).status, 404);
  assert.equal((await tcall(d, 'GET', '/api/tts/clip/../../families')).status, 404);
  assert.equal((await tcall(d, 'GET', '/api/tts/clip/ABC')).status, 404);
});
await atest('daily cap: a request that would pass 20,000 chars/day → 429 (existing clips still returned, nothing made, counter unchanged)', async () => {
  assert.equal(TS.DAILY_CHARS, 20000);
  const d = ttsDeps();
  const long = (i) => `${i}.${'x'.repeat(200)}`.slice(0, 200);
  for (let b = 0; b < 2; b++) assert.equal((await tcall(d, 'POST', '/api/tts/prepare', prep(Array.from({ length: 50 }, (_, i) => long(b * 50 + i))))).status, 200);
  const used = JSON.parse(d.store.map.get(`ttsUsage/${FAM}/${TS.dayKey(T0)}`).text).chars;
  assert.equal(used, 20000);
  const n = d.synthesize.calls.length;
  const r = await tcall(d, 'POST', '/api/tts/prepare', prep([long(0), 'one more.']));
  assert.equal(r.status, 429); assert.equal(r.json.error, 'daily-limit'); assert.equal(r.json.charsToday, 20000);
  assert.ok(r.json.clips[long(0)], 'the cached clip comes back anyway'); assert.equal(r.json.clips['one more.'], undefined);
  assert.equal(d.synthesize.calls.length, n); assert.equal(JSON.parse(d.store.map.get(`ttsUsage/${FAM}/${TS.dayKey(T0)}`).text).chars, 20000);
  // already-cached texts cost nothing, even at the cap; the next UTC day starts at 0
  assert.equal((await tcall(d, 'POST', '/api/tts/prepare', prep([long(1)]))).status, 200);
  assert.equal((await tcall({ ...d, now: () => T0 + DAY_MS }, 'POST', '/api/tts/prepare', prep(['one more.']))).status, 200);
  // another family has its own counter
  const d2 = { ...d, families: TS.memoryFamilies([FAM, 'ABCD-2345']) };
  assert.equal((await tcall(d2, 'POST', '/api/tts/prepare', prep(['fresh.'], DEFAULT_CLOUD_VOICE, 'ABCD-2345'))).status, 200);
});
await atest('Google failures: some fail → 200 with failed + characters given back; all fail → 502', async () => {
  const d = ttsDeps({ synthesize: fakeSynth2({ fail: (t) => t === 'bad.' }) });
  let r = await tcall(d, 'POST', '/api/tts/prepare', prep(['good.', 'bad.']));
  assert.equal(r.status, 200); assert.equal(r.json.generated, 1); assert.equal(r.json.failed, 1); assert.equal(r.json.charsToday, 5);
  r = await tcall(d, 'POST', '/api/tts/prepare', prep(['bad.']));
  assert.equal(r.status, 502); assert.equal(r.json.error, 'synthesis-failed'); assert.equal(r.json.charsToday, 5);
});
await atest('a store failure becomes a 500, never a throw', async () => {
  const d = ttsDeps(); d.store.has = async () => { throw new Error('down'); };
  assert.equal((await tcall(d, 'POST', '/api/tts/prepare', prep(['x.']))).status, 500);
});

console.log('natural voice: client texts (cloudVoice.js)');
test('word texts: carrier, sentence, word, Say it again, syllables; "say as" replaces the word', () => {
  assert.deepEqual(CV.wordTexts({ word: 'neighbor', sentence: 'My neighbor has a dog', syllables: ['neigh', 'bor'] }),
    ['The word is, neighbor.', 'My neighbor has a dog.', 'neighbor.', 'neighbor. neighbor.', 'neigh, bor.']);
  assert.deepEqual(CV.wordTexts({ word: 'read', sentence: null, sayAs: 'red' }), ['The word is, red.', 'red.', 'red. red.']);
  assert.deepEqual(CV.wordTexts({ word: '' }), []);
  assert.ok(!CV.wordTexts({ word: 'dog', sentence: 'y'.repeat(200) }).some((t) => t.length > 200), 'over 200 after the full stop: left to the device voice');
});
test('shared texts: the 26 letter names + apostrophe / hyphen / space, the sample presentation, the Test phrase', () => {
  const s = CV.sharedTexts();
  for (const n of ['a', 'bee', 'double you', 'zee', 'apostrophe', 'hyphen', 'space', 'The word is, neighbor.', 'My neighbor has a dog.', 'neighbor.', 'Spell Jump is ready.']) assert.ok(s.includes(n), n);
  assert.equal(s.length, 29 + 4);
});
test('list texts: every word, then the shared texts, no duplicates', () => {
  const t = CV.listTexts([{ word: 'neighbor', sentence: 'My neighbor has a dog.' }, { word: 'enough', syllables: ['e', 'nough'] }]);
  assert.equal(t[0], 'The word is, neighbor.'); assert.ok(t.includes('e, nough.')); assert.equal(new Set(t).size, t.length);
  assert.equal(t.length, 4 + 4 + 33 - 3, 'the sample carrier, sentence and "neighbor." are shared with the word');
});
await atest('client: prepare sends only unknown texts, ≤ 80 per request, remembers the clips; status lines', async () => {
  const posts = [];
  let key = true, offline = false;
  const fetchStub = async (url, init = {}) => {
    if (offline) throw new TypeError('Failed to fetch');
    if (url.endsWith('/status')) return { ok: true, status: 200, json: async () => ({ key }) };
    const body = JSON.parse(init.body);
    posts.push(body);
    if (!key) return { ok: false, status: 503, json: async () => ({ error: 'no-key' }) };
    const clips = {};
    for (const it of body.items) clips[it.text] = '/api/tts/clip/' + (await TS.clipId(body.voice, it.text));
    return { ok: true, status: 200, json: async () => ({ clips, generated: body.items.length, cached: 0, charsToday: 1 }) };
  };
  let code = null;
  const c = CV.createCloudVoice({ getCode: () => code, fetch: fetchStub });
  assert.equal(c.statusText(), 'No family code yet: natural voices need family sync');
  c.setVoice('en-US-Neural2-F'); assert.equal(c.active, false, 'no family code: not active');
  code = FAM; assert.equal(c.active, true);
  const words = Array.from({ length: 20 }, (_, i) => ({ word: `word${'abcdefghijklmnopqrstu'[i]}`, sentence: `Sentence ${i}.` }));
  const r = await c.prepareList(words);
  assert.equal(r.ok, true); assert.equal(posts.length, 2, `${CV.listTexts(words).length} texts in 2 requests`); assert.equal(posts[0].items.length, 80);
  assert.equal(c.count(), CV.listTexts(words).length);
  assert.equal(c.statusText(), `Natural voice ready · ${c.count()} clips cached`);
  await c.prepareList(words); assert.equal(posts.length, 2, 'nothing new to ask for');
  assert.equal(c.resolve('Sentence 1'), 'Sentence 1.', 'a bare sentence finds its clip with the full stop');
  assert.equal(c.has('The word is, worda.'), true); assert.equal(c.has('The word is, nothing.'), false);
  assert.equal(c.needsPrepare(words[0]), false); assert.equal(c.needsPrepare({ word: 'brand' }), true);
  key = false;
  await c.status(true);
  assert.equal(c.statusText(), 'Natural voice not set up on the server yet (ask the admin to add the Google key)');
  key = true; offline = true;
  await c.status(true);
  assert.match(c.statusText(), /^Offline: using the device voice/);
});
await atest('client: play() through the test hook; a missing clip → fail; stop() → cancel', async () => {
  const played = [];
  globalThis.__cloudVoiceBackend = {
    status: async () => ({ key: true }),
    prepare: async ({ texts }) => ({ status: 200, body: { clips: Object.fromEntries(texts.filter((t) => t !== 'skip.').map((t, i) => [t, '/api/tts/clip/' + String(i).padStart(32, '0')])) } }),
    load: async (url) => ({ url, duration: 0.01 }),
    play: (buf, text) => new Promise((res) => { played.push(text); setTimeout(() => res(true), text === 'long.' ? 300 : 5); }),
    stop() {},
  };
  try {
    const c = CV.createCloudVoice({ getCode: () => FAM });
    c.setVoice('en-US-Neural2-D');
    const r = await c.prepare(['one.', 'skip.', 'long.']);
    assert.deepEqual(r.missing, ['skip.']);
    assert.equal(await c.play('one.'), 'ok'); assert.deepEqual(played, ['one.']);
    assert.equal(await c.play('skip.'), 'fail');
    const p = c.play('long.'); await sleep(50); c.stop(); assert.equal(await p, 'cancel');
  } finally { delete globalThis.__cloudVoiceBackend; }
});
await atest('engine: a natural voice plays the presentation by clips (device not used); a missing clip → device for that utterance', async () => {
  const t = createTTS(QUICK); const b = fakeSynth(); t.useBackend(b);
  const spokenDev = []; const orig = b.speak; b.speak = (u) => { spokenDev.push(u.text); orig(u); };
  const clips = new Set(['The word is, neighbor.', 'My neighbor has a dog.', 'neighbor.', 'en', 'bee']);
  const played = [];
  const fake = { voice: 'en-US-Neural2-F', active: true, resolve: (x) => (clips.has(x) ? x : clips.has(x + '.') ? x + '.' : null), has: (x) => clips.has(x),
    play: async (x) => { played.push(x); await sleep(5); return 'ok'; }, stop() {}, count: () => clips.size };
  t.setCloud(fake);
  assert.equal(await t.present({ word: 'neighbor', sentence: 'My neighbor has a dog.' }), true);
  assert.deepEqual(played, ['The word is, neighbor.', 'My neighbor has a dog.', 'neighbor.']); assert.deepEqual(spokenDev, []); assert.equal(t.engine, 'cloud');
  assert.equal(await t.present({ word: 'enough' }), true);
  assert.deepEqual(spokenDev, ['The word is, enough.', 'enough.'], 'no clip → the device voice says the whole presentation'); assert.equal(t.engine, 'device');
  played.length = 0; spokenDev.length = 0;
  const lit = [];
  await t.spell('ben', (i) => lit.push(i), { gap: 1 });
  assert.deepEqual(lit, [0, 1, 2]); assert.deepEqual(played, ['bee', 'en']); assert.deepEqual(spokenDev, ['ee'], 'letters without a clip: device voice');
  // a clip that fails to play: the rest of the utterance goes to the device voice
  played.length = 0; spokenDev.length = 0;
  fake.play = async (x) => { played.push(x); return x === 'My neighbor has a dog.' ? 'fail' : 'ok'; };
  assert.equal(await t.present({ word: 'neighbor', sentence: 'My neighbor has a dog.' }), true);
  assert.deepEqual(played, ['The word is, neighbor.', 'My neighbor has a dog.']); assert.deepEqual(spokenDev, ['My neighbor has a dog.', 'neighbor.']);
  assert.equal(t.cloudFailures, 1); assert.equal(t.health, 'ok', 'cloud failures do not touch the device health');
  fake.active = false; played.length = 0;
  await t.say('neighbor.'); assert.deepEqual(played, [], 'natural voice off: device only');
  t.setCloud(null);
});
await atest('engine: ready() is true with the natural voice even when the device lists no voices; watchdog rules stay device-only', async () => {
  const t = createTTS(QUICK); t.useBackend(fakeSynth({ voices: [], starts: false }));
  t.setCloud({ voice: 'en-US-Neural2-F', active: true, resolve: (x) => x, has: () => true, play: async () => 'ok', stop() {}, count: () => 1 });
  assert.equal(await t.ready(), true); assert.equal(t.available, true);
  for (let i = 0; i < 4; i++) assert.equal(await t.say('friend.'), true);
  assert.equal(t.gaveUp, false); assert.equal(t.failStreak, 0);
  const chk = await t.runCheck({ endWaitMs: 50 });
  assert.equal(chk.ok, true); assert.match(chk.text, /engine: natural voice \(clip\)/); assert.match(chk.text, /result: the natural voice played/);
});
test('options: cloudVoice is kept when it is an allowlisted voice or "" (device), dropped otherwise', () => {
  const f = Profiles.defaultFamily(); f.players.push({ id: 'pmia', name: 'Mia', color: '#ff3b5c', createdAt: 0, updatedAt: 0 });
  assert.equal(Profiles.playerOptions(f, 'pmia').cloudVoice, undefined, 'never chosen');
  assert.equal(Profiles.setPlayerOption(f, 'pmia', 'cloudVoice', 'en-US-Neural2-J').cloudVoice, 'en-US-Neural2-J');
  assert.equal(Profiles.setPlayerOption(f, 'pmia', 'cloudVoice', '').cloudVoice, '');
  assert.equal(Profiles.setPlayerOption(f, 'pmia', 'cloudVoice', 'en-US-Wavenet-A').cloudVoice, undefined);
  assert.equal(Profiles.normalizeFamily({ ...f, options: { pmia: { cloudVoice: 'en-US-Studio-O' } } }).options.pmia.cloudVoice, 'en-US-Studio-O');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('FAILED:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('ALL SPELLING TESTS PASSED');

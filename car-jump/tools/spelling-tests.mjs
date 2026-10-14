// Unit tests for the spelling layer (plain Node asserts, no framework, no browser):
//   node tools/spelling-tests.mjs
// Covers the Leitner intervals, mastery (needs 2 distinct days), mission ordering, the new-word cap,
// re-queue distance, never-twice-in-a-row, archived review at 2 and 4 weeks, the list parser's edge cases,
// the attempt/word alignment, and the word store (save list → archive → restore → delete, qualifier, Friday).
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/meta/rng.js';
import {
  DAY_MS, INTERVAL_DAYS, MISSION_SIZE, applyQualifier, applyResult, applyReview, applyTest, buildMission, createSession,
  dayKey, isMastered, newRecord, noteSpelled, pendingReady, pickNext, reviewDue, status,
} from '../src/spelling/scheduler.js';
import { diffAttempt, formatList, normalizeWord, parseList, patternRanges, ringLetters, syllableBreaks, SAMPLE_WORDS } from '../src/spelling/words.js';
import {
  activeList, archivedLists, defaultWords, deleteList, missionState, nextWord, normalizeWordsData, qualifierDue, recordFriday,
  recordQualifier, recordSpell, report, reportText, restoreList, saveNewList, spellBonus, wordInfo,
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

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('FAILED:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('ALL SPELLING TESTS PASSED');

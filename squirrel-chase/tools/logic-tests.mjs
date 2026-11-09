// Pip's Squirrel Chase logic tests (node, no browser): the case model over whatever content is in src/content/, word picking from the active list only,
// banking and the daily mission through Spell Jump's shared store, pacing (one case a day), the save (normalize + merge), the run state machine and the
// hideout dictation (building and scoring). Run: node squirrel-chase/tools/logic-tests.mjs
import assert from 'node:assert/strict';
import * as WS from '../../spell-jump/src/spelling/wordStore.js';
import { createSession, noteSpelled, MISSION_SIZE } from '../../spell-jump/src/spelling/scheduler.js';
import { PLAYER_KINDS, parseKey } from '../../car-jump/src/sync/protocol.mjs';
import { CASE_LIST, CITY_BY_ID, CITY_LIST, SEQUENCE, hideoutCity, missingOf, postcardOf, routeOf, signOf, stopsOf } from '../src/logic/caseModel.js';
import { currentCase, dayKey, nextUnopened, refreshOpened, waitingState } from '../src/logic/pacing.js';
import { activeEntries, activeWords, pickMany, pickWord, recordWord, schedulerOptions } from '../src/logic/words.js';
import { buildHideout, listWordsIn, markSentence, normSentence, scoreHideout, templateSentence, tokens } from '../src/logic/hideout.js';
import { applyClose, bothOpen, chooseCity, closeRecord, finish, followTrail, newRun, openNote, reviveRun, setHideout, startChase, stillMissing } from '../src/logic/run.js';
import { closeReports } from '../src/logic/payout.js';
import { defaultSave, mergeSaves, normalize, normalizeClosed } from '../src/meta/save.js';
import { mergeSq } from '../src/meta/sync.js';
import { ACTIVE_WORDS, ARCHIVED_WORDS, wordsDoc } from './fixtures/seed.mjs';

let passed = 0;
const failed = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { failed.push(name); console.log('  FAIL ' + name + '\n      ' + String(e && e.stack || e).split('\n').slice(0, 4).join('\n      ')); }
}
const NOW = Date.UTC(2026, 10, 9, 15);
const DAY = 86400000;
const mkWords = (now = NOW, active = ACTIVE_WORDS) => WS.normalizeWordsData(wordsDoc(now, active), now);
const opts = () => ({ ...WS.DEFAULT_OPTIONS });
console.log('Squirrel Chase logic tests');

// ---------------- the case model over the content ----------------
console.log('\ncontent through the case model');
test('there are cases, and every route city exists', () => {
  assert.ok(CASE_LIST.length >= 1 && SEQUENCE.length === CASE_LIST.length);
  for (const k of CASE_LIST) { const r = routeOf(k); assert.ok(r.length >= 3 && r.length <= 5, `${k.id}: ${r.length} stops`); for (const id of r) assert.ok(CITY_BY_ID[id], `${k.id}: city ${id}`); }
});
test('a case has a stop per route city, two witnesses each with a text clue, and the last stop is the hideout', () => {
  for (const k of CASE_LIST) {
    const stops = stopsOf(k);
    assert.equal(stops.length, routeOf(k).length);
    stops.forEach((s, i) => { assert.equal(s.witnesses.length, 2); assert.equal(s.last, i === stops.length - 1); assert.equal(s.next, s.last ? null : stops[i + 1].cityId); for (const w of s.witnesses) { assert.ok(w.clue.length > 10 && w.name); assert.ok(!/^\s*$/.test(w.clue)); } });
    assert.equal(hideoutCity(k), stops[stops.length - 1].cityId);
  }
});
test('a clue that points TO the next city comes from that city\'s clue lines unless the case wrote its own', () => {
  const k = { id: 'x', route: ['a', 'b', 'c'], witnesses: [[{ name: 'A' }, { name: 'B' }], [{ name: 'C', clue: 'my own clue' }, { name: 'D' }], [{ name: 'E' }, { name: 'F' }]], hideout: { description: 'd' } };
  // (uses the real cities, so build a case over them)
  const ids = CITY_LIST.slice(0, 3).map((c) => c.id);
  const kk = { ...k, route: ids };
  const s = stopsOf(kk);
  assert.ok(CITY_BY_ID[ids[1]].clues.includes(s[0].witnesses[0].clue), 'stop 1 clue is one of city 2\'s clue lines');
  assert.equal(s[1].witnesses[0].clue, 'my own clue');
  assert.ok(CITY_BY_ID[ids[2]].clues.includes(s[1].witnesses[1].clue));
  assert.ok(/saw the gang slip away to the hideout/.test(s[2].witnesses[0].clue));
});
test('the sign: 3 to 6 swiped letters, distinct, never a space, the same every time', () => {
  for (const k of CASE_LIST) {
    const sign = signOf(k), m = missingOf(k);
    assert.ok(sign.length >= 4); assert.ok(m.length >= 1 && m.length <= 6, `${k.id}: ${m.length}`);
    assert.equal(new Set(m).size, m.length); for (const i of m) assert.ok(/[A-Z0-9]/.test(sign[i]));
    assert.deepEqual(m, missingOf(k)); assert.deepEqual(m, [...m].sort((a, b) => a - b));
  }
});
test('the postcard is the hideout city with two facts', () => { for (const k of CASE_LIST) { const p = postcardOf(k); assert.equal(p.cityId, hideoutCity(k)); assert.equal(p.facts.length, 2); assert.ok(p.facts.every((f) => f.length > 5)); } });

// ---------------- words: the active list only ----------------
console.log('\nwords (the active Spell Jump list only)');
test('pickWord only ever returns words of the active list (never an archived list\'s), and never the same word twice in a row', () => {
  const d = mkWords(), session = createSession();
  const active = new Set(activeWords(d));
  assert.deepEqual([...active].sort(), ACTIVE_WORDS.map((w) => w.word).sort());
  let last = '';
  for (let i = 0; i < 300; i++) {
    const p = pickWord(d, NOW + i * 1000, session, opts(), last);
    assert.ok(p && active.has(p.word), `pick ${i}: ${p && p.word}`);
    assert.ok(!ARCHIVED_WORDS.some((a) => a.word === p.word));
    assert.notEqual(p.word, last, `pick ${i} repeated ${last}`);
    recordWord(d, p.word, i % 3 !== 0, NOW + i * 1000, session); last = p.word;
  }
});
test('archived words stay untouched even when they are due for review (includeReview is forced off)', () => {
  const d = mkWords();
  for (const a of ARCHIVED_WORDS) { d.records[a.word] = { ...WS.wordInfo(d, a.word).rec, seenCount: 1, box: 1, due: 0, reviewsDone: 0 }; }
  assert.equal(schedulerOptions({ includeReview: true }).includeReview, false);
  const session = createSession(); let last = '';
  for (let i = 0; i < 120; i++) { const p = pickWord(d, NOW + 20 * DAY + i, session, { ...opts(), includeReview: true }, last); assert.ok(!ARCHIVED_WORDS.some((a) => a.word === p.word)); recordWord(d, p.word, true, NOW + 20 * DAY + i, session); last = p.word; }
});
test('the scheduler\'s priorities lead: a due focus word comes before new words', () => {
  const d = mkWords(), session = createSession();
  const rec = d.records.library;
  Object.assign(rec, { seenCount: 2, box: 0, due: NOW - DAY, focus: true, firstTry: 0, attempts: 2, misses: 2 });
  const p = pickWord(d, NOW, session, opts(), '', () => 0.5);
  assert.equal(p.word, 'library');
});
test('a list with one word repeats it (nothing else exists); a list with two alternates', () => {
  const one = WS.normalizeWordsData(wordsDoc(NOW, [{ word: 'solo', sentence: 'The solo song.' }]), NOW), s1 = createSession();
  assert.equal(pickWord(one, NOW, s1, opts(), 'solo').word, 'solo');
  const two = WS.normalizeWordsData(wordsDoc(NOW, [{ word: 'alpha', sentence: null }, { word: 'beta', sentence: null }]), NOW), s2 = createSession();
  let last = ''; const seen = [];
  for (let i = 0; i < 12; i++) { const p = pickWord(two, NOW + i, s2, opts(), last); seen.push(p.word); assert.notEqual(p.word, last); recordWord(two, p.word, true, NOW + i, s2); last = p.word; }
  assert.deepEqual([...new Set(seen)].sort(), ['alpha', 'beta']);
});
test('a case of 8 words on a 10-word list: the 8 notes are 8 different list words (the scheduler\'s mission)', () => {
  const d = mkWords(), session = createSession(); let last = ''; const got = [];
  for (let i = 0; i < 8; i++) { const p = pickWord(d, NOW + i, session, opts(), last); got.push(p.word); recordWord(d, p.word, true, NOW + i, session); last = p.word; }
  assert.equal(new Set(got).size, 8, 'eight different words from a ten-word list');
});
test('pickMany: n different list words, avoiding the case\'s own words while others exist', () => {
  const d = mkWords(), session = createSession();
  const avoid = ['neighbor', 'friend', 'island', 'answer', 'minute', 'library'];
  const picks = pickMany(d, NOW, session, opts(), 3, avoid);
  assert.equal(picks.length, 3); assert.equal(new Set(picks.map((p) => p.word)).size, 3);
  for (const p of picks) assert.ok(!avoid.includes(p.word), p.word);
  const few = WS.normalizeWordsData(wordsDoc(NOW, [{ word: 'alpha', sentence: null }, { word: 'beta', sentence: null }]), NOW);
  assert.equal(pickMany(few, NOW, session, opts(), 3, ['alpha']).length, 2);
});

// ---------------- banking and the shared mission ----------------
console.log('\nbanking through the shared store');
test('recordWord is Spell Jump\'s recordSpell: the record, the box, today\'s count, the streak', () => {
  const d = mkWords(), e = mkWords(), s1 = createSession(), s2 = createSession();
  const a = recordWord(d, 'friend', true, NOW, s1), b = WS.recordSpell(e, 'friend', { firstTry: true }, NOW, s2);
  assert.deepEqual(d.records.friend, e.records.friend); assert.deepEqual(d.today, e.today); assert.equal(d.streak, 1);
  assert.equal(a.mission.count, b.mission.count);
  assert.equal(d.records.friend.seenCount, 1); assert.equal(d.records.friend.firstTry, 1); assert.ok(d.records.friend.box >= 1);
});
test('a miss is a miss: no streak, the word comes back after two other words', () => {
  const d = mkWords(), session = createSession();
  recordWord(d, 'friend', false, NOW, session);
  assert.equal(d.streak, 0); assert.equal(d.records.friend.misses, 1);
  assert.equal(session.pending[0].word, 'friend');
});
test('the 8-word daily mission is shared: the 8th word (whether a note\'s or the hideout\'s) completes it once', () => {
  const d = mkWords(), session = createSession(); const done = [];
  const words = ['neighbor', 'friend', 'island', 'answer', 'minute', 'library', 'trouble', 'pretty', 'between'];
  words.forEach((w, i) => { const r = recordWord(d, w, true, NOW + i, session); done.push(r.missionJustDone); });
  assert.equal(MISSION_SIZE, 8);
  assert.deepEqual(done, [false, false, false, false, false, false, false, true, false]);
  assert.equal(d.today.count, 9); assert.equal(d.today.missionPaid, true);
  assert.equal(WS.missionState(d, NOW).done, true);
});
test('a spelling done in Spell Jump counts toward the same mission as one here (one document)', () => {
  const d = mkWords();
  WS.recordSpell(d, 'neighbor', { firstTry: true }, NOW, createSession());      // (Spell Jump)
  recordWord(d, 'friend', true, NOW, createSession());                          // (Squirrel Chase)
  assert.equal(WS.missionState(d, NOW).count, 2);
});
test('the day rolls over: a new day starts the mission count at zero', () => {
  const d = mkWords(); recordWord(d, 'friend', true, NOW, createSession());
  assert.equal(WS.missionState(d, NOW + DAY).count, 0);
});

// ---------------- the hideout dictation ----------------
console.log('\nthe hideout dictation');
const ENTRIES = ACTIVE_WORDS;
test('tokens forgive capitals and punctuation, keep apostrophes and hyphens', () => {
  assert.deepEqual(tokens('The Gang\'s well-known password, PLEASE!'), ["the", "gang's", 'well-known', 'password', 'please']);
  assert.equal(normSentence('  Hello,   World!! '), 'hello world');
  assert.deepEqual(tokens('it’s fine'), ["it's", 'fine']);
});
test('a list sentence with 2-3 list words is used as is (source list)', () => {
  const picks = [{ word: 'friend', sentence: 'A good friend sailed to the island.' }, { word: 'minute', sentence: 'Wait one minute.' }];
  const h = buildHideout(picks, ENTRIES);
  assert.equal(h.source, 'list'); assert.equal(h.sentence, 'A good friend sailed to the island.'); assert.deepEqual(h.words, ['friend', 'island']);
});
test('two list sentences are joined when one sentence holds fewer than two list words (source joined)', () => {
  const picks = [{ word: 'neighbor', sentence: 'My neighbor has a dog.' }, { word: 'library', sentence: 'The library is quiet.' }];
  const h = buildHideout(picks, ENTRIES);
  assert.equal(h.source, 'joined'); assert.deepEqual(h.words, ['neighbor', 'library']); assert.ok(h.sentence.includes('My neighbor has a dog.') && h.sentence.includes('The library is quiet.'));
  assert.ok(h.words.length >= 2 && h.words.length <= 3);
});
test('with no usable sentences it is the template (works for any word)', () => {
  const picks = [{ word: 'enough', sentence: null }, { word: 'answer', sentence: null }, { word: 'minute', sentence: null }];
  const h = buildHideout(picks, ENTRIES);
  assert.equal(h.source, 'template'); assert.equal(h.sentence, 'The secret password is enough, answer, and minute.'); assert.deepEqual(h.words, ['enough', 'answer', 'minute']);
  assert.equal(templateSentence(['a', 'b']), 'The secret password is a and b.');
  assert.deepEqual(listWordsIn('The secret password is enough, answer, and minute.', ENTRIES), ['answer', 'enough', 'minute'].sort((x, y) => 'enough, answer, and minute'.indexOf(x) - 'enough, answer, and minute'.indexOf(y)));
});
test('a sentence whose "word" is not actually in it falls back to the template', () => {
  const h = buildHideout([{ word: 'friend', sentence: 'Nothing here.' }, { word: 'island', sentence: 'Still nothing.' }], ENTRIES);
  assert.equal(h.source, 'template');
});
test('scoring: capitals and punctuation are forgiven; each list word is a retrieval; other words are not scored', () => {
  const sentence = 'A good friend sailed to the island.', words = ['friend', 'island'];
  let r = scoreHideout(sentence, words, 'a good FRIEND sailed to the island');
  assert.deepEqual([r.correct, r.total, r.exact], [2, 2, true]);
  r = scoreHideout(sentence, words, 'a god friend saled too the island');          // other words misspelled: not scored
  assert.deepEqual([r.correct, r.total, r.exact], [2, 2, false]);
  r = scoreHideout(sentence, words, 'a good frend sailed to the island.');
  assert.deepEqual(r.perWord, [{ word: 'friend', ok: false }, { word: 'island', ok: true }]); assert.equal(r.correct, 1);
  r = scoreHideout(sentence, words, '');
  assert.equal(r.correct, 0); assert.equal(r.total, 2);
});
test('markSentence marks only the list words, right or wrong', () => {
  const m = markSentence('A good friend sailed to the island.', ['friend', 'island'], 'a good frend sailed to the island');
  const friend = m.find((x) => x.text === 'friend'), island = m.find((x) => x.text === 'island'), good = m.find((x) => x.text === 'good');
  assert.deepEqual([friend.list, friend.ok, island.list, island.ok, good.list, good.ok], [true, false, true, true, false, true]);
  assert.equal(m.map((x) => x.text).join(''), 'A good friend sailed to the island.');
});
test('hideout words bank as retrievals in the shared store: right = first try, wrong = a miss', () => {
  const d = mkWords(), session = createSession();
  const res = scoreHideout('A good friend sailed to the island.', ['friend', 'island'], 'a good frend sailed to the island');
  for (const { word, ok } of res.perWord) recordWord(d, word, ok, NOW, session);
  assert.equal(d.records.friend.misses, 1); assert.equal(d.records.island.firstTry, 1); assert.equal(d.today.count, 2);
});

// ---------------- pacing ----------------
console.log('\npacing (one case a day)');
const SEQ = ['c1', 'c2', 'c3'];
test('day 1 opens the first case only', () => {
  const s = defaultSave(), opened = refreshOpened(s, '2026-11-09', SEQ);
  assert.deepEqual(opened, ['c1']); assert.deepEqual(Object.keys(s.opened), ['c1']);
  assert.equal(waitingState(s, SEQ), 'open'); assert.equal(currentCase(s, SEQ), 'c1');
});
test('closing a case does not open the next one the same day; the next local day opens it', () => {
  const s = defaultSave(); refreshOpened(s, '2026-11-09', SEQ);
  s.closed.c1 = { day: '2026-11-09', at: 1, words: [], hideout: { correct: 0, total: 0 } };
  assert.deepEqual(refreshOpened(s, '2026-11-09', SEQ), []);
  assert.equal(waitingState(s, SEQ), 'tomorrow');
  assert.deepEqual(refreshOpened(s, '2026-11-10', SEQ), ['c2']);
  assert.equal(currentCase(s, SEQ), 'c2'); assert.equal(waitingState(s, SEQ), 'open');
});
test('an unplayed case does not pile up: with c2 open and not closed, a later day opens nothing more', () => {
  const s = defaultSave(); refreshOpened(s, '2026-11-09', SEQ);
  s.closed.c1 = { day: '2026-11-09', at: 1, words: [], hideout: { correct: 0, total: 0 } }; refreshOpened(s, '2026-11-10', SEQ);
  assert.deepEqual(refreshOpened(s, '2026-11-12', SEQ), []);
});
test('a parent can open the next case early (once), also the same day', () => {
  const s = defaultSave(); refreshOpened(s, '2026-11-09', SEQ);
  s.closed.c1 = { day: '2026-11-09', at: 1, words: [], hideout: { correct: 0, total: 0 } };
  assert.equal(nextUnopened(s, SEQ), 'c2');
  s.nextEarly = true;
  assert.deepEqual(refreshOpened(s, '2026-11-09', SEQ), ['c2']); assert.equal(s.nextEarly, false);
  assert.deepEqual(refreshOpened(s, '2026-11-09', SEQ), []);
});
test('after the last case: nothing to open, state "done"; the early flag clears', () => {
  const s = defaultSave(); for (const id of SEQ) { s.opened[id] = '2026-11-01'; s.closed[id] = { day: '2026-11-01', at: 1, words: [], hideout: { correct: 0, total: 0 } }; }
  s.nextEarly = true;
  assert.deepEqual(refreshOpened(s, '2026-11-09', SEQ), []); assert.equal(s.nextEarly, false);
  assert.equal(waitingState(s, SEQ), 'done'); assert.equal(nextUnopened(s, SEQ), null);
});
test('dayKey is the local calendar day', () => { assert.match(dayKey(NOW), /^2026-11-\d\d$/); });

// ---------------- the save ----------------
console.log('\nsave (normalize + merge)');
test('normalize: garbage becomes a valid save; bad ids, days, words and cities are dropped', () => {
  assert.deepEqual(normalize(null), defaultSave()); assert.deepEqual(normalize('x'), defaultSave());
  const s = normalize({ v: 1, opened: { 'ny-01': '2026-11-09', '': '2026-11-09', 'ny-02': 'soon', __proto__: { x: 1 } }, closed: { 'ny-01': { day: '2026-11-09', at: 5, words: ['friend', 'BAD WORD', "it's", 7], hideout: { correct: 9, total: 3 } } },
    album: ['rochester', 'rochester', 3, 'buffalo'], nextEarly: 'yes', updatedAt: 12 });
  assert.deepEqual(s.opened, { 'ny-01': '2026-11-09' }); assert.deepEqual(s.closed['ny-01'].words, ['friend', "it's"]);
  assert.deepEqual(s.closed['ny-01'].hideout, { correct: 3, total: 3 }); assert.deepEqual(s.album, ['rochester', 'buffalo']); assert.equal(s.nextEarly, false); assert.equal(s.updatedAt, 12);
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(s))), s, 'a fixed point');
});
test('a closed case implies it was opened', () => { const s = normalize({ closed: { a: { day: '2026-11-02', at: 1 } } }); assert.equal(s.opened.a, '2026-11-02'); });
test('merge: opened and album are unions, the earliest day wins, the order keeps this device first', () => {
  const a = normalize({ opened: { c1: '2026-11-03', c2: '2026-11-09' }, album: ['rochester'], updatedAt: 10 }), b = normalize({ opened: { c1: '2026-11-02', c3: '2026-11-10' }, album: ['buffalo', 'rochester'], updatedAt: 20 });
  const m = mergeSaves(a, b);
  assert.deepEqual(m.opened, { c1: '2026-11-02', c2: '2026-11-09', c3: '2026-11-10' }); assert.deepEqual(m.album, ['rochester', 'buffalo']);
});
test('merge: a closed case keeps the record with the earliest `at`, whole', () => {
  const a = normalize({ closed: { c1: { day: '2026-11-03', at: 300, words: ['friend'], hideout: { correct: 1, total: 2 } } }, updatedAt: 5 });
  const b = normalize({ closed: { c1: { day: '2026-11-03', at: 100, words: ['island'], hideout: { correct: 2, total: 2 } }, c2: { day: '2026-11-04', at: 50, words: [], hideout: { correct: 0, total: 0 } } }, updatedAt: 9 });
  const m = mergeSaves(a, b);
  assert.equal(m.closed.c1.at, 100); assert.deepEqual(m.closed.c1.words, ['island']); assert.ok(m.closed.c2);
  assert.deepEqual(mergeSaves(b, a).closed.c1, m.closed.c1, 'order does not matter for a closed record');
});
test('merge: nextEarly follows the later updatedAt, updatedAt is the max; merging with itself changes nothing', () => {
  const a = normalize({ nextEarly: true, updatedAt: 10 }), b = normalize({ nextEarly: false, updatedAt: 20 });
  assert.equal(mergeSaves(a, b).nextEarly, false); assert.equal(mergeSaves(b, a).nextEarly, false); assert.equal(mergeSaves(a, b).updatedAt, 20);
  assert.equal(mergeSaves(normalize({ nextEarly: true, updatedAt: 30 }), b).nextEarly, true);
  const x = normalize({ opened: { c1: '2026-11-03' }, closed: { c1: { day: '2026-11-03', at: 7, words: ['friend'], hideout: { correct: 1, total: 1 } } }, album: ['rochester'], updatedAt: 9 });
  assert.deepEqual(mergeSaves(x, x), x);
});
test('the sync merge (mergeSq) takes { updatedAt, data } documents and tolerates a missing side', () => {
  const a = { updatedAt: 5, data: normalize({ opened: { c1: '2026-11-03' }, updatedAt: 5 }) }, b = { updatedAt: 9, data: normalize({ opened: { c2: '2026-11-04' }, updatedAt: 9 }) };
  assert.deepEqual(Object.keys(mergeSq(a, b).opened).sort(), ['c1', 'c2']);
  assert.deepEqual(mergeSq(a, null), a.data); assert.deepEqual(mergeSq(null, b), b.data); assert.equal(normalizeClosed(null).day, '');
});
test('the family sync protocol knows the sq kind', () => { assert.ok(PLAYER_KINDS.includes('sq')); const k = parseKey('pmia.sq'); assert.ok(k && k.kind === 'sq' && k.playerId === 'pmia'); });

// ---------------- the run state machine ----------------
console.log('\nthe run');
test('a whole case on the model: brief -> stops -> map -> hideout -> closed', () => {
  const k = CASE_LIST[0], stops = stopsOf(k), run = newRun(k, NOW);
  assert.equal(run.phase, 'brief'); startChase(run); assert.equal(run.phase, 'stop');
  assert.equal(followTrail(run, k), false, 'no map before both notes are open');
  assert.equal(chooseCity(run, k, stops[0].next).ok, false, 'no travel outside the map');
  for (let i = 0; i < stops.length; i++) {
    assert.equal(run.stop, i);
    assert.equal(openNote(run, 0, 'alpha'), true); assert.equal(openNote(run, 0, 'alpha'), false, 'a note opens once'); assert.equal(bothOpen(run), false);
    assert.equal(openNote(run, 1, 'beta'), true); assert.ok(bothOpen(run));
    assert.equal(followTrail(run, k), true);
    if (stops[i].last) { assert.equal(run.phase, 'hideout'); break; }
    assert.equal(run.phase, 'travel');
    const wrong = CITY_LIST.find((c) => c.id !== stops[i].next).id;
    const before = JSON.stringify(run);
    assert.deepEqual(chooseCity(run, k, wrong), { ok: false }); assert.equal(JSON.stringify(run), before, 'a wrong city changes nothing');
    const r = chooseCity(run, k, stops[i].next);
    assert.equal(r.ok, true); assert.equal(r.to, stops[i].next); assert.equal(run.stop, i + 1); assert.equal(run.phase, 'stop');
    assert.ok(r.letter == null || missingOf(k).includes(r.letter));
  }
  assert.equal(run.found.length, Math.min(missingOf(k).length, stops.length - 1), 'one recovered letter per right city');
  const left = stillMissing(run, k).length;
  assert.equal(left, missingOf(k).length - run.found.length);
  setHideout(run, { sentence: 'The secret password is a and b.', words: ['friend', 'island'], source: 'template' });
  finish(run, k); assert.equal(stillMissing(run, k).length, 0); assert.equal(run.phase, 'done');
  const rec = closeRecord(run, { correct: 1, total: 2 }, NOW, '2026-11-09');
  assert.deepEqual(rec.hideout, { correct: 1, total: 2 }); assert.ok(rec.words.includes('alpha') && rec.words.includes('friend')); assert.equal(rec.day, '2026-11-09');
  const save = defaultSave();
  assert.equal(applyClose(save, k, rec), true); assert.equal(applyClose(save, k, { ...rec, at: NOW + 1 }), false, 'closing twice keeps the first record');
  assert.equal(save.closed[k.id].at, NOW); assert.deepEqual(save.album, [hideoutCity(k)]);
});
test('reviveRun resumes the same stop; a run of another case or a bad shape is dropped or repaired', () => {
  const k = CASE_LIST[0], run = newRun(k, NOW); startChase(run); openNote(run, 0, 'alpha');
  const again = reviveRun(JSON.parse(JSON.stringify(run)), k);
  assert.equal(again.phase, 'stop'); assert.equal(again.stop, 0); assert.deepEqual(again.notes[0], [1, 0]); assert.deepEqual(again.words, ['alpha']);
  assert.equal(reviveRun({ ...run, caseId: 'other' }, k), null); assert.equal(reviveRun(null, k), null); assert.equal(reviveRun({ v: 9 }, k), null);
  const bad = reviveRun({ ...JSON.parse(JSON.stringify(run)), phase: 'travel', stop: 99, notes: 'x', found: ['a', 2], words: [1, 'ok'] }, k);
  assert.ok(bad.stop < stopsOf(k).length && bad.phase === 'stop', 'travel without both notes open drops back to the stop'); assert.deepEqual(bad.found, [2]); assert.deepEqual(bad.words, ['ok']);
});
test('closeReports: ONE flat case event whatever the accuracy, and the day mark once', () => {
  assert.deepEqual(closeReports({ firstCaseToday: true }), [{ event: 'case' }, { event: 'day' }]);
  assert.deepEqual(closeReports({ firstCaseToday: false }), [{ event: 'case' }]);
  assert.equal(closeReports.length, 0, 'takes no accuracy argument');
});
test('the active entries carry the list\'s own sentences', () => { const d = mkWords(); assert.equal(activeEntries(d).find((e) => e.word === 'friend').sentence, 'A good friend sailed to the island.'); });

console.log(`\n${passed} passed, ${failed.length} failed`);
if (failed.length) { console.log('FAILED:\n- ' + failed.join('\n- ')); process.exit(1); }
console.log('ALL SQUIRREL CHASE LOGIC TESTS PASSED');

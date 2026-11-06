// Case Files logic tests (SPEC §7): answer matching, pacing, rank supports, save normalize + merge, a whole case driven through
// the run moves, the voice texts, and the Lab payout being flat. Pure node, no browser. From the repo root:
//   node case-files/tools/logic-tests.mjs
// The data under test is tools/fixtures/ (so these tests do not depend on the final content).
import assert from 'node:assert/strict';
import { TRAINING, ARCS, CASE_BY_ID } from './fixtures/index.js';
import { becauseStep, checkTap, display, editDistance, matchSolution, norm, proofClues } from '../src/logic/answers.js';
import { currentCase, dayKey, nextUnopened, rankLabel, readAloudDefault, refreshOpened, supportsFor, waitingState, wordsToTeach } from '../src/logic/pacing.js';
import { accuracyByStandard, allPinned, applyClose, attachClue, closeRecord, hashString, newRun, nextQuestion, pinTap, placeCard, requestHint, submitReport, submitSolution, trayOf } from '../src/logic/run.js';
import { defaultSave, normalize } from '../src/meta/save.js';
import { mergeCf } from '../src/meta/sync.js';
import { closeReports } from '../src/logic/payout.js';
import { caseClips, caseVoiceTexts } from '../src/meta/voiceTexts.js';
import { CLIP_MAX, splitSay } from '../src/meta/speech.js';
import { LINES } from '../src/logic/lines.js';

let passed = 0; const failed = [];
function test(name, fn) { try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { failed.push(name); console.log('  FAIL ' + name + '\n      ' + (e && e.stack || e).toString().split('\n').slice(0, 4).join('\n      ')); } }
const section = (s) => console.log('\n' + s);
const SEQ = [TRAINING.id, ...ARCS.flatMap((a) => a.cases.map((c) => c.id))];
const E1 = CASE_BY_ID['erie-01'];

section('answers');
test('norm: case, punctuation, apostrophes and "the" are ignored', () => {
  assert.equal(norm('  The Lock-Bell! '), 'lock bell'); assert.equal(norm("Tom’s"), 'toms'); assert.equal(norm('THE the THE'), '');
});
test('matchSolution: the listed variants, any case, "the" ignored', () => {
  const s = E1.solution;
  for (const t of ['Tom Fisk', 'tom fisk', 'TOM', 'fisk', 'the tom fisk', 'Tom  Fisk.']) assert.ok(matchSolution(t, s), t);
  for (const t of ['', '   ', 'the', 'Ada Brooks', 'captain', 'tim']) assert.ok(!matchSolution(t, s), t);
});
test('matchSolution: edit distance <= 2 for names, but short names are exact so Tim is not Tom', () => {
  const s = E1.solution;
  assert.ok(matchSolution('Tom Fiske', s)); assert.ok(matchSolution('Tom Fisc', s)); assert.ok(matchSolution('Tomm Fisk', s));
  assert.ok(!matchSolution('Tim', s), 'Tim is not Tom');
  assert.equal(editDistance('kitten', 'sitting'), 3); assert.equal(editDistance('', 'abc'), 3); assert.equal(editDistance('same', 'same'), 0);
  const bell = CASE_BY_ID['erie-02'].solution;
  assert.ok(matchSolution('bell', bell) && matchSolution('the lock bel', bell) && matchSolution('Bells', bell));
  assert.ok(!matchSolution('boat', bell));
});
test('matchSolution: a short sentence holding the answer counts; a long ramble does not', () => {
  const s = E1.solution;
  assert.ok(matchSolution('it was Tom Fisk', s)); assert.ok(matchSolution('tom fisk has it', s));
  assert.ok(!matchSolution('i really do not know who it was but maybe tom fisk or somebody else entirely', s));
});
test('becauseStep: 3 words minimum; no report keyword asks once, then accepts whatever comes next', () => {
  const kw = E1.report.keywords;
  assert.equal(becauseStep('too short', kw), 'short'); assert.equal(becauseStep('', kw), 'short');
  assert.equal(becauseStep('he has it in his pocket', kw), 'ok');
  assert.equal(becauseStep('he was wearing it then', kw, false), 'ask');
  assert.equal(becauseStep('he was wearing it then', kw, true), 'ok');
  assert.equal(becauseStep('the ticket was tucked away', kw), 'ok');
  assert.equal(becauseStep('pockets', kw), 'short');
});
test('checkTap: only sentences of the proof set, each once; a set of two needs both', () => {
  const q6 = E1.questions.find((q) => q.id === 'q6');
  assert.deepEqual(checkTap(q6, 'd1s4', []), { ok: true, done: false, left: 1 });
  assert.deepEqual(checkTap(q6, 'd1s6', ['d1s4']), { ok: true, done: true, left: 0 });
  assert.equal(checkTap(q6, 'd1s4', ['d1s4']).ok, false); assert.equal(checkTap(q6, 'd1s1', []).ok, false);
});
test('proofClues: the pinned clues that prove the solution, or any pinned clue when none does', () => {
  assert.deepEqual(proofClues(E1.solution, ['d1s1', 'd2s4']), ['d2s4']); assert.deepEqual(proofClues(E1.solution, ['d1s1']), ['d1s1']); assert.deepEqual(proofClues(E1.solution, []), []);
});
test('display capitalizes names as they are typed', () => { assert.equal(display("tom o'neil-smith"), "Tom O'Neil-Smith"); });

section('pacing');
const D = (n) => `2026-11-${String(n).padStart(2, '0')}`;
const closeIt = (save, id, day) => { save.closed[id] = { day, at: Date.parse(day) + 1000, firstTap: {}, hints: {}, timelineTries: 0, report: { who: '', because: '', clueId: '' }, listens: {} }; };
test('day 1 opens Training and Erie case 1 and nothing else', () => {
  const s = defaultSave(); const opened = refreshOpened(s, D(2), SEQ);
  assert.deepEqual(opened, ['training', 'erie-01']); assert.deepEqual(Object.keys(s.opened), ['training', 'erie-01']);
  assert.deepEqual(refreshOpened(s, D(2), SEQ), []); assert.equal(currentCase(s, SEQ), 'training');
});
test('closing a case opens the next one on the NEXT local day, one new case per day', () => {
  const s = defaultSave(); refreshOpened(s, D(2), SEQ);
  closeIt(s, 'training', D(2)); closeIt(s, 'erie-01', D(2));
  assert.deepEqual(refreshOpened(s, D(2), SEQ), [], 'same day: nothing new'); assert.equal(waitingState(s, SEQ), 'tomorrow');
  assert.deepEqual(refreshOpened(s, D(3), SEQ), ['erie-02']); assert.deepEqual(refreshOpened(s, D(3), SEQ), [], 'only one a day');
  assert.equal(waitingState(s, SEQ), 'open'); assert.equal(currentCase(s, SEQ), 'erie-02');
});
test('a case that is not closed does not unlock the next, however many days pass; a gap still opens only one', () => {
  const s = defaultSave(); refreshOpened(s, D(2), SEQ); closeIt(s, 'training', D(2)); closeIt(s, 'erie-01', D(2));
  refreshOpened(s, D(3), SEQ);                                   // erie-02 open, not closed
  assert.deepEqual(refreshOpened(s, D(9), SEQ), []);
  const t = defaultSave(); refreshOpened(t, D(2), SEQ); closeIt(t, 'training', D(2)); closeIt(t, 'erie-01', D(2));
  assert.deepEqual(refreshOpened(t, D(20), SEQ), ['erie-02']);
});
test('the parent can open the next case now (nextEarly), once; the flag is spent', () => {
  const s = defaultSave(); refreshOpened(s, D(2), SEQ);
  assert.equal(nextUnopened(s, SEQ), 'erie-02');
  s.nextEarly = true; assert.deepEqual(refreshOpened(s, D(2), SEQ), ['erie-02']); assert.equal(s.nextEarly, false);
  assert.deepEqual(refreshOpened(s, D(2), SEQ), []);
  s.nextEarly = true; assert.deepEqual(refreshOpened(s, D(2), SEQ), [], 'nothing left to open'); assert.equal(s.nextEarly, false); assert.equal(nextUnopened(s, SEQ), null);
});
test('when every case is open and closed the home says so; closed cases stay in the save (re-reading is always allowed)', () => {
  const s = defaultSave(); for (const id of SEQ) { s.opened[id] = D(2); closeIt(s, id, D(2)); }
  assert.equal(waitingState(s, SEQ), 'done'); assert.equal(currentCase(s, SEQ), null);
});
test('dayKey is the local calendar day', () => { assert.equal(dayKey(new Date(2026, 10, 3, 23, 59).getTime()), '2026-11-03'); assert.equal(dayKey(new Date(2026, 10, 4, 0, 1).getTime()), '2026-11-04'); });

section('supports by rank');
test('ranks 1-3: read-aloud everywhere, 3 words, hint offered after 20 s; rank 4: core silent, stretch read; ranks 5-6: both silent, 2 words', () => {
  const core = { stretch: false }, stretch = { stretch: true };
  for (const r of [1, 2, 3]) { const s = supportsFor(r); assert.deepEqual([readAloudDefault(r, core), readAloudDefault(r, stretch), s.preTeach, s.idleHintMs], [true, true, 3, 20000], 'rank ' + r); }
  assert.deepEqual([readAloudDefault(4, core), readAloudDefault(4, stretch), supportsFor(4).preTeach, supportsFor(4).idleHintMs], [false, true, 3, 0]);
  for (const r of [5, 6]) assert.deepEqual([readAloudDefault(r, core), readAloudDefault(r, stretch), supportsFor(r).preTeach, supportsFor(r).idleHintMs], [false, false, 2, 0], 'rank ' + r);
  assert.equal(supportsFor(undefined).rank, 4); assert.equal(supportsFor(99).rank, 6); assert.equal(supportsFor(0).rank, 4);
  assert.equal(wordsToTeach(5, E1).length, 2); assert.equal(wordsToTeach(1, E1).length, 3);
});
test('the rank label carries the approximate wording verbatim', () => {
  assert.equal(rankLabel(4), 'Rank 4 · grade 5 feel · roughly comparable to F&P S–U / about 830–1010L (approximate; not affiliated with or leveled by Fountas & Pinnell, Heinemann or MetaMetrics)');
  for (const r of [1, 2, 3, 4, 5, 6]) assert.ok(/^Rank \d · grade \d feel · roughly comparable to F&P [A-Z]–[A-Z] \/ about \d+–\d+L \(approximate;/.test(rankLabel(r)), 'rank ' + r);
});

section('save');
test('defaultSave has the SPEC section 6 shape', () => {
  assert.deepEqual(defaultSave(), { v: 1, rank: 4, opened: {}, closed: {}, nextEarly: false, wordsMet: {}, updatedAt: 0 });
});
test('normalize is idempotent and drops hostile or malformed input', () => {
  const raw = JSON.parse('{"v":1,"rank":9,"opened":{"erie-01":"2026-11-02","__proto__":{"x":1},"bad id":"2026-11-02","erie-02":"tomorrow"},"closed":{"erie-01":{"day":"2026-11-02","at":5,"firstTap":{"q1":true,"q2":"yes"},"hints":{"q1":9,"q2":-1},"timelineTries":2.7,"report":{"who":"Tom","because":"x","clueId":"d1s1"},"listens":{"d1":3,"d2":"x"}},"constructor":{}},"nextEarly":"yes","wordsMet":{"toll":4,"Bad Word":3,"aqueduct":-2},"updatedAt":7}');
  const n = normalize(raw);
  assert.equal(n.rank, 4); assert.deepEqual(n.opened, { 'erie-01': '2026-11-02' }); assert.equal(n.nextEarly, false);
  assert.deepEqual(n.closed['erie-01'].firstTap, { q1: true }); assert.deepEqual(n.closed['erie-01'].hints, { q1: 3, q2: 0 });
  assert.equal(n.closed['erie-01'].timelineTries, 2); assert.deepEqual(n.closed['erie-01'].listens, { d1: 3, d2: 0 }); assert.deepEqual(n.wordsMet, { toll: 4, aqueduct: 0 });
  assert.equal(Object.keys(n.closed).length, 1); assert.equal(({}).x, undefined);
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(n))), n); assert.deepEqual(normalize(null), defaultSave()); assert.deepEqual(normalize('x'), defaultSave());
});
test('normalize: a closed case is also an opened case', () => {
  assert.deepEqual(normalize({ closed: { 'erie-01': { day: '2026-11-02', at: 1 } } }).opened, { 'erie-01': '2026-11-02' });
});
const rec = (day, at, extra = {}) => ({ day, at, firstTap: { q1: true }, hints: { q1: 0 }, timelineTries: 0, report: { who: 'Tom Fisk', because: 'pocket ticket', clueId: 'd1s5' }, listens: {}, ...extra });
const doc = (data, updatedAt = data.updatedAt) => ({ updatedAt, data });
test('mergeCf: union of opened and closed; the earliest `at` wins a case; listens and wordsMet take the max; rank from the later doc', () => {
  const A = { ...defaultSave(), rank: 3, updatedAt: 100, opened: { training: '2026-11-02', 'erie-01': '2026-11-02' }, closed: { training: rec('2026-11-02', 500, { listens: { d1: 2 } }) }, wordsMet: { toll: 2 } };
  const B = { ...defaultSave(), rank: 5, updatedAt: 200, opened: { training: '2026-11-03', 'erie-01': '2026-11-01', 'erie-02': '2026-11-04' }, closed: { training: rec('2026-11-03', 900, { report: { who: 'Mr. Bell', because: 'later', clueId: 'd2s6' }, listens: { d1: 1, d2: 4 } }), 'erie-01': rec('2026-11-04', 1500) }, wordsMet: { toll: 1, aqueduct: 3 } };
  const m = mergeCf(doc(A), doc(B));
  assert.equal(m.rank, 5); assert.deepEqual(m.opened, { training: '2026-11-02', 'erie-01': '2026-11-01', 'erie-02': '2026-11-04' });
  assert.equal(m.closed.training.at, 500); assert.equal(m.closed.training.report.who, 'Tom Fisk', 'the earlier close wins whole');
  assert.deepEqual(m.closed.training.listens, { d1: 2, d2: 4 }); assert.ok(m.closed['erie-01']);
  assert.deepEqual(m.wordsMet, { toll: 2, aqueduct: 3 }); assert.equal(m.updatedAt, 200);
  assert.deepEqual(mergeCf(doc(B), doc(A)), m, 'order does not matter');
});
test('mergeCf: nextEarly follows the later doc; missing sides return the other; garbage is normalized; idempotent', () => {
  const A = { ...defaultSave(), updatedAt: 10, nextEarly: true }, B = { ...defaultSave(), updatedAt: 20, nextEarly: false };
  assert.equal(mergeCf(doc(A), doc(B)).nextEarly, false); assert.equal(mergeCf(doc(B), doc(A)).nextEarly, false);
  assert.deepEqual(mergeCf(null, doc(A)), A); assert.deepEqual(mergeCf(doc(A), null), A);
  const g = mergeCf(doc({ rank: 7, opened: 5, closed: [] }), doc({ rank: 2 })); assert.equal(g.rank >= 1 && g.rank <= 6, true);
  const m = mergeCf(doc({ ...defaultSave(), updatedAt: 5, opened: { a: '2026-11-02' } }), doc({ ...defaultSave(), updatedAt: 6, opened: { b: '2026-11-03' } }));
  assert.deepEqual(mergeCf(doc(m), doc(m)), m);
});

section('a whole case');
const kase = E1;
function play(rank = 4, { wrongFirst = true } = {}) {
  const run = newRun(kase, rank);
  const log = {};
  // pin the evidence: wrong tap on q1 first (raises the tier, first tap false), then the right one
  for (const q of kase.questions) {
    if (wrongFirst && q.id === 'q1') {
      const wrong = pinTap(run, kase, 'd1s6'); log.wrong = wrong;
      assert.equal(wrong.ok, false); assert.equal(wrong.tier, 1);
      pinTap(run, kase, 'd1s6'); pinTap(run, kase, 'd1s6'); log.top = pinTap(run, kase, 'd1s6');   // the tier stops at 3
    }
    for (const id of q.answer) { const r = pinTap(run, kase, id); assert.ok(r.ok, q.id + ' ' + id); }
    nextQuestion(run, kase);
  }
  return run;
}
test('wrong taps go straight to the next hint tier (1, 2, 3) and stay at 3; first tap is recorded once', () => {
  const run = play();
  assert.equal(run.firstTap.q1, false); assert.equal(run.hints.q1, 3); assert.equal(log_top(run), true);
  assert.equal(run.firstTap.q2, true); assert.equal(run.hints.q2 || 0, 0); assert.ok(allPinned(run, kase));
  assert.equal(run.pinned.q6.length, 2, 'a question with two proof sentences needs both');
});
function log_top(run) { return run.misses.q1 === 4; }
test('requestHint raises the tier to 3 and no further; a question can be answered with a hint asked first (still a first tap)', () => {
  const run = newRun(kase, 4);
  assert.deepEqual([requestHint(run, 'q1'), requestHint(run, 'q1'), requestHint(run, 'q1'), requestHint(run, 'q1')], [1, 2, 3, 3]);
  const r = pinTap(run, kase, 'd1s1'); assert.ok(r.ok && r.done); assert.equal(run.firstTap.q1, true); assert.equal(run.hints.q1, 3);
});
test('the timeline: given cards are placed, the tray is shuffled but not already solved, a misplaced card is a try (no penalty) and a right one stays', () => {
  const run = play(); const items = kase.timeline.items;
  assert.deepEqual(run.tl.slots.map((s) => s && s), items.map((it, i) => (kase.timeline.given.includes(i) ? it.id : null)));
  const tray = trayOf(run, kase, 'pmia'); assert.equal(tray.length, items.length - kase.timeline.given.length);
  assert.ok(!tray.every((id, i) => id === items.filter((it) => !run.tl.slots.includes(it.id))[i]), 'not already in order');
  assert.deepEqual(tray, trayOf(run, kase, 'pmia'), 'stable for a player and case'); assert.notEqual(hashString('a'), hashString('b'));
  const open = run.tl.slots.map((s, i) => (s ? -1 : i)).filter((i) => i >= 0);
  const card = items[open[1]].id;                                    // belongs to the second open slot
  assert.equal(placeCard(run, kase, card, open[0]).ok, false); assert.equal(run.tl.tries, 1); assert.equal(run.tl.slots[open[0]], null);
  assert.equal(placeCard(run, kase, card, kase.timeline.given[0]).ignored, true, 'a given slot is locked');
  let done = false;
  for (const i of open) { const r = placeCard(run, kase, items[i].id, i); assert.ok(r.ok); done = r.done; }
  assert.ok(done); assert.equal(run.tl.tries, 1);
});
test('the solution: a wrong name is "check again" with the next hint tier (1, 2, 3); the right one passes; the clue must prove it', () => {
  const run = play();
  assert.deepEqual(submitSolution(run, kase, 'Ada Brooks'), { ok: false, tier: 1 }); assert.deepEqual(submitSolution(run, kase, 'Mia'), { ok: false, tier: 2 });
  assert.deepEqual(submitSolution(run, kase, 'the captain'), { ok: false, tier: 3 }); assert.deepEqual(submitSolution(run, kase, 'nobody'), { ok: false, tier: 3 });
  assert.equal(submitSolution(run, kase, 'tom fiske').ok, true);
  assert.equal(attachClue(run, kase, 'd1s1'), false, 'a pinned clue that does not prove it'); assert.equal(attachClue(run, kase, 'd2s3'), false);
  assert.equal(attachClue(run, kase, 'd1s5'), false, 'not pinned');
  assert.equal(attachClue(run, kase, 'd2s4'), true); assert.equal(run.sol.clueId, 'd2s4');
});
test('the case report: short, the partner asks once about the clue, then it is accepted; the clue is tapped from the pinned ones', () => {
  const run = play(); submitSolution(run, kase, 'Tom'); attachClue(run, kase, 'd2s4');
  assert.equal(submitReport(run, kase, 'he left', 'd2s4'), 'short');
  assert.equal(submitReport(run, kase, 'he was cold at the gates', 'd2s4'), 'ask'); assert.equal(run.rep.asked, true);
  assert.equal(submitReport(run, kase, 'he was cold at the gates today', 'd2s4'), 'ok');
  const r2 = play(); assert.equal(submitReport(r2, kase, 'the ticket is in the coat pocket', ''), 'needclue');
  assert.equal(submitReport(r2, kase, 'the ticket is in the coat pocket', 'd1s1'), 'ok', 'a pinned clue is enough for the report blank');
  assert.equal(submitReport(r2, kase, 'the ticket is in the coat pocket', 'zzz'), 'needclue');
});
test('closing: the record has the SPEC section 6 shape; the first close wins; words are counted by rank', () => {
  const run = play(5); submitSolution(run, kase, 'Tom'); attachClue(run, kase, 'd2s4'); submitReport(run, kase, 'the ticket is in the coat pocket', 'd2s4');
  run.listens = { d1: 2, d3: 1 };
  const r = closeRecord(run, kase, 'Tom Fisk', 1234, '2026-11-02'), save = defaultSave();
  assert.deepEqual(Object.keys(r).sort(), ['at', 'day', 'firstTap', 'hints', 'listens', 'report', 'timelineTries']);
  assert.equal(r.firstTap.q1, false); assert.equal(r.firstTap.q2, true); assert.equal(r.hints.q1, 3); assert.deepEqual(r.report, { who: 'Tom Fisk', because: 'the ticket is in the coat pocket', clueId: 'd2s4' });
  assert.equal(applyClose(save, kase, r, 5), true); assert.equal(applyClose(save, kase, closeRecord(run, kase, 'X', 9999, '2026-11-09'), 5), false);
  assert.equal(save.closed['erie-01'].at, 1234); assert.deepEqual(save.wordsMet, { toll: 1, aqueduct: 1 }, 'rank 5 pre-teaches 2 words');
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(save))), save);
  const acc = accuracyByStandard(save, CASE_BY_ID);
  assert.ok(acc['4R1'].total >= 3 && acc['4R1'].right < acc['4R1'].total);
});

section('voice');
test('the voice texts of a case: the briefing first, the closing last-ish, all clips <= 200 characters, only this case', () => {
  const t = caseVoiceTexts(kase, 4), clips = caseClips(kase, 4);
  assert.equal(t[0], kase.briefing[0].text); assert.ok(t.includes(kase.closing.text) && t.includes(kase.knowledge) && t.includes(LINES.seeYou));
  assert.ok(clips.every((c) => c.length <= CLIP_MAX) && clips.length === new Set(clips).size);
  assert.ok(kase.docs.every((d) => d.paragraphs.every((p) => p.every((s) => clips.includes(s.text)))), 'every sentence');
  const other = CASE_BY_ID['erie-02']; assert.ok(!clips.includes(other.briefing[0].text));
  assert.equal(caseVoiceTexts(kase, 5).length, caseVoiceTexts(kase, 4).length - 1, 'rank 5 pre-teaches one word fewer');
});
test('splitSay cuts long lines at sentence breaks under the clip limit', () => {
  const long = Array.from({ length: 12 }, (_, i) => `This is sentence number ${i} of a long line.`).join(' ');
  const parts = splitSay(long); assert.ok(parts.length > 1 && parts.every((p) => p.length <= CLIP_MAX)); assert.equal(parts.join(' '), long);
  assert.deepEqual(splitSay('  '), []); assert.deepEqual(splitSay('Hi.'), ['Hi.']);
});

section('Lab payout');
const lab = await import('../../lab/src/core/events.js');
test('one flat event per closed case: the same whatever the accuracy; nothing per answer; the Lab table pays it the same every time', () => {
  assert.deepEqual(closeReports({ firstCaseToday: true }), [{ event: 'case' }, { event: 'day' }]);
  assert.deepEqual(closeReports({ firstCaseToday: false }), [{ event: 'case' }]);
  assert.deepEqual(closeReports({ firstCaseToday: true, accuracy: 0, hints: 99 }), closeReports({ firstCaseToday: true, accuracy: 1, hints: 0 }), 'accuracy and hints are not inputs');
  const def = lab.eventDef('cf', 'case'); assert.ok(def, 'the Lab knows cf.case'); assert.equal(def.kind, 'unit');
  const a = lab.payFor(def, { n: 1 }), b = lab.payFor(def, { n: 1, firstTry: true }), c = lab.payFor(def, { n: 1, firstTry: false });
  assert.deepEqual(a, b); assert.deepEqual(a, c); assert.ok(a.coins > 0 && a.xp > 0);
  assert.equal(lab.EVENTS.filter((e) => e.game === 'cf').length, 1, 'no per-answer rows, no bonus rows');
});

console.log(`\n${passed} passed, ${failed.length} failed`);
if (failed.length) { console.log('FAILED:\n- ' + failed.join('\n- ')); process.exit(1); }
console.log('ALL CASE FILES LOGIC TESTS PASSED');

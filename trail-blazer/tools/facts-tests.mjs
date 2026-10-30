// Unit tests for Trail Blazer's math layer (plain Node asserts, no framework, no browser):
//   node trail-blazer/tools/facts-tests.mjs
// Covers fact parsing (every operator form, spaces or not, commutative pairs as one fact, exact division, no negative
// answers), answers, families, display and spoken forms, the strategy hint of every family, the custom-problem parser
// (and its per-line errors), the Leitner scheduler (boxes, intervals, mastery on 2 days, fluency), the same-session
// re-queue (after 2 others, at most twice), incremental rehearsal (1, 2, 3 known facts; ≤ 2 new at once), the daily new
// cap, interleaving, the store (sets, nextFact, recordAnswer, the daily mission, XP and levels, report counts, reset,
// normalize / migrate) and the self-update guard.
import assert from 'node:assert/strict';
import {
  ALL_FAMILIES, STOCK_FAMILIES, addSubFacts, factAnswer, factFamilies, factFamily, factKey, factSpoken, factText, familyFacts, fullSentence,
  difficulty, isCommutative, normFact, parseCustom, parseFact, questionSentence, answerSentence, setFacts,
} from '../src/facts/facts.js';
import { numberWords, spokenText } from '../src/facts/spoken.js';
import { hintFor, hintSpoken } from '../src/facts/hints.js';
import {
  DAY_MS, INTERVAL_DAYS, QUICK_MS, REHEARSAL_GAPS, applyAnswer, createSession, isFluent, isMastered, newRecord, noteAnswered, pickNext, status,
} from '../src/facts/scheduler.js';
import {
  LEVEL_XP, MISSION_REWARD, MISSION_SIZE, XP, activeFacts, defaultFacts, levelFor, levelProgress, missionState, nextFact, normalizeFacts, noteRace,
  recordAnswer, report, reportText, resetFacts,
} from '../src/facts/store.js';
import { CHECK_XP, MAX_ITEMS, TIERS, applyCheck, checkAnswer, checkNext, checkResult, createCheck, startLine, tiersFor } from '../src/facts/placement.js';
import { classifyMiss, hintKind, inverseCluster, isSlowOnly, notePattern, patternHint, patternSummary } from '../src/facts/patterns.js';
import { MIX, PROBE, autoFamilies, computeFrontier, famInfo, pickAuto, probeDue } from '../src/facts/adaptive.js';
import { afterRace, beginRace, checkDue, refreshFrontier } from '../src/facts/store.js';
import { DIAL_MIN, dial, dialText, drowning, familyRecent, raceQuota } from '../src/facts/governor.js';
import { CHECK_SKIPS, canSkipCheck, checkSkipsLeft, noteCheckSkip, noteScout, recheckStart, scoutFact, scoutFamily } from '../src/facts/scouts.js';
import { familyMembers } from '../src/facts/facts.js';
import { createUpdateGuard, safeToReload } from '../src/meta/selfUpdate.js';
import { medalFor, medalTimesFor, fmtTime, ordinal, placeMedal, raceMedal } from '../src/data/medals.js';

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failures.push(name); console.log('  ✗ ' + name + '\n      ' + String(e && e.message).split('\n').join('\n      ')); }
}
// a fixed local noon so day arithmetic never crosses a DST edge oddly
const T0 = new Date(2026, 9, 5, 12, 0, 0).getTime();
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

console.log('\nparsing');
test('every × form is one fact: x X × * · with or without spaces', () => {
  for (const t of ['7x8', '7 x 8', '7X8', '7 × 8', '7*8', '7 * 8', '7·8', '8 x 7', '8×7', ' 8 *7 ', '7 x 8 =', '7 x 8 = ?']) assert.equal(normFact(t), '7x8', t);
});
test('÷ forms: / ÷ :', () => { for (const t of ['56/7', '56 / 7', '56÷7', '56 ÷ 7', '56 : 7']) assert.equal(normFact(t), '56/7', t); });
test('+ forms, smaller number first (commutative)', () => { assert.equal(normFact('34 + 19'), '19+34'); assert.equal(normFact('19+34'), '19+34'); });
test('− forms: - − –', () => { for (const t of ['80 - 46', '80-46', '80 − 46', '80–46']) assert.equal(normFact(t), '80-46', t); });
test('invalid facts are rejected', () => {
  for (const t of ['', 'banana', '7 x', 'x 8', '5 / 2', '7 / 0', '46 - 80', '7.5 x 2', '-3 x 4', '12345 x 2', '7 x 8 x 2']) assert.equal(parseFact(t), null, t);
});
test('factKey keeps × and + smaller first, ÷ and − as written', () => {
  assert.equal(factKey(9, 'x', 3), '3x9'); assert.equal(factKey(9, '+', 3), '3+9'); assert.equal(factKey(56, '/', 7), '56/7'); assert.equal(factKey(9, '-', 3), '9-3');
});

console.log('\nanswers, families, display');
test('answers', () => { assert.equal(factAnswer('7x8'), 56); assert.equal(factAnswer('56/7'), 8); assert.equal(factAnswer('19+34'), 53); assert.equal(factAnswer('80-46'), 34); assert.ok(Number.isNaN(factAnswer('nope'))); });
test('families: × in both factors, ÷ by divisor, + and −', () => {
  assert.deepEqual(factFamilies('7x8'), ['x7', 'x8']); assert.deepEqual(factFamilies('6x6'), ['x6']);
  assert.equal(factFamily('7x9'), 'x9'); assert.equal(factFamily('2x8'), 'x2'); assert.equal(factFamily('56/7'), 'd7');
  assert.equal(factFamily('19+34'), 'add'); assert.equal(factFamily('80-46'), 'sub');
});
test('display: "7 × 8", flipped "8 × 7"; ÷ and − signs', () => {
  assert.equal(factText('7x8'), '7 × 8'); assert.equal(factText('7x8', true), '8 × 7'); assert.equal(factText('6x6', true), '6 × 6');
  assert.equal(factText('56/7', true), '56 ÷ 7'); assert.equal(factText('80-46'), '80 − 46'); assert.equal(factText('19+34', true), '34 + 19');
  assert.ok(isCommutative('7x8') && !isCommutative('56/7') && !isCommutative('6x6'));
});
test('number words: fifty-six, one hundred eight, one thousand two hundred, teens, zero', () => {
  assert.equal(numberWords(56), 'fifty-six'); assert.equal(numberWords(108), 'one hundred eight'); assert.equal(numberWords(1200), 'one thousand two hundred');
  assert.equal(numberWords(13), 'thirteen'); assert.equal(numberWords(0), 'zero'); assert.equal(numberWords(144), 'one hundred forty-four'); assert.equal(numberWords(90), 'ninety');
});
test('spoken facts and sentences', () => {
  assert.equal(factSpoken('7x8'), 'seven times eight'); assert.equal(factSpoken('7x8', true), 'eight times seven');
  assert.equal(factSpoken('56/7'), 'fifty-six divided by seven'); assert.equal(factSpoken('19+34', true), 'thirty-four plus nineteen'); assert.equal(factSpoken('80-46'), 'eighty minus forty-six');
  assert.equal(questionSentence('7x8'), 'seven times eight.'); assert.equal(answerSentence('7x8'), 'fifty-six.'); assert.equal(fullSentence('9x12'), 'nine times twelve is one hundred eight.');
});
test('spokenText turns symbols into words', () => { assert.equal(spokenText('10 × 7 is 70, take away 7'), 'ten times seven is seventy, take away seven'); assert.equal(spokenText('7 × ? = 56'), 'seven times what equals fifty-six'); });

console.log('\nhints');
const hintCases = {
  '2x7': /double 7/, '3x7': /double 7 is 14, plus one more 7 is 21/, '4x7': /double 7 is 14, double again is 28/, '5x7': /10 × 7 is 70, half of that is 35/,
  '6x9': /10 × 6 is 60, take away 6 is 54/, '6x4': /double 6 is 12, double again is 24/, '6x6': /5 × 6 is 30, plus one more 6 is 36/,
  '7x8': /7 × 7 is 49, plus one more 7 is 56/, '7x7': /5 × 7 is 35, plus 2 × 7 is 14: 49/, '8x8': /10 × 8 is 80, take away 2 × 8/, '9x7': /10 × 7 is 70, take away 7 is 63/,
  '10x7': /put a 0 on the end of 7: 70/, '7x11': /write the 7 twice: 77/, '11x12': /10 × 12 is 120, plus one more 12 is 132/, '7x12': /10 × 7 is 70, plus 2 × 7 is 14: 84/,
  '56/7': /7 × \? = 56/, '8+7': /make ten: 8 \+ 2 = 10/, '19+34': /tens, then the ones/, '80-46': /count up from 46 to 80/, '1x9': /that number: 9/, '0x5': /0 is 0/,
};
test('a strategy hint for every family (×0 … ×12, ÷, +, −)', () => { for (const [f, re] of Object.entries(hintCases)) assert.match(hintFor(f), re, f); });
test('hints follow the numbers as shown (flip) and end on the answer', () => {
  assert.match(hintFor('3x7', true), /double 7 is 14, plus one more 7 is 21/);
  for (const f of ['2x9', '3x8', '4x6', '5x9', '6x8', '7x9', '8x12', '9x9', '12x12']) assert.ok(hintFor(f).includes(String(factAnswer(f))), f);
});
test('every stock fact has a spoken hint with no digits or symbols left', () => {
  for (const f of setFacts({ families: STOCK_FAMILIES, division: true, addSub: true })) { const s = hintSpoken(f); assert.ok(s.length > 5 && !/[\d×÷−?]/.test(s), `${f}: ${s}`); }
});

console.log('\nsets + custom problems');
test('family ×n: n × 2 … n × 12 (no × 1); ÷ adds both inverses', () => {
  const f = familyFacts(7); assert.equal(f.length, 11); assert.ok(f.includes('7x8') && f.includes('2x7') && !f.includes('1x7'));
  const g = familyFacts(7, { division: true }); assert.ok(g.includes('56/7') && g.includes('56/8') && g.includes('14/7'));
});
test('stock set ×2 … ×9 with ÷: commutative pairs counted once', () => {
  const s = setFacts({ families: STOCK_FAMILIES, division: true });
  assert.equal(new Set(s).size, s.length); assert.ok(s.includes('7x8') && !s.includes('8x7') && s.includes('56/8'));
  assert.equal(s.filter((x) => x.includes('x')).length, 60);
});
test('+ and − within 20: sums ≤ 20 and the subtractions back', () => {
  const a = addSubFacts(); assert.ok(a.includes('8+7') === false && a.includes('7+8') && a.includes('15-7') && a.includes('15-8'));
  assert.ok(a.every((f) => factAnswer(f) >= 0 && factAnswer(f) <= 20));
});
test('custom problems: one per line, answers computed, duplicates once', () => {
  const r = parseCustom('7 x 8\n56 / 7\n34 + 19\n80 - 46\n8 × 7\n\n12*12');
  assert.deepEqual(r.facts, ['7x8', '56/7', '19+34', '80-46', '12x12']); assert.equal(r.errors.length, 0);
});
test('custom problems: bad lines reported with their line number', () => {
  const r = parseCustom('7 x 8\nbanana\n5 / 2\n\n46 - 80\n9 ÷ 0\n99999 x 2');
  assert.deepEqual(r.errors.map((e) => e.line), [2, 3, 5, 6, 7]);
  assert.match(r.errors[0].error, /not a problem/); assert.match(r.errors[1].error, /does not come out even/); assert.match(r.errors[2].error, /below zero/);
  assert.match(r.errors[3].error, /divide by 0/); assert.match(r.errors[4].error, /whole numbers up to 9,999/);
  assert.deepEqual(r.facts, ['7x8']);
});
test('custom facts join the week\'s set (Pick families); Custom list = the list only', () => {
  const d = defaultFacts(T0); d.sets.mode = 'manual'; d.sets.custom = ['19+34', '80-46'];
  assert.ok(activeFacts(d).includes('19+34') && activeFacts(d).includes('80-46') && activeFacts(d).includes('7x8'));
  d.sets.source = 'custom'; assert.deepEqual(activeFacts(d), ['19+34', '80-46']);
});

console.log('\nscheduler');
test('Leitner: box +1 per first-try answer, intervals 0 / 1 / 2 / 4 days', () => {
  assert.deepEqual(INTERVAL_DAYS, [0, 1, 2, 4]);
  const r = newRecord('7x8');
  applyAnswer(r, { correct: true }, T0); assert.equal(r.box, 1); assert.equal(r.due, T0 + DAY_MS);
  applyAnswer(r, { correct: true }, T0 + DAY_MS); assert.equal(r.box, 2); assert.equal(r.due, T0 + 3 * DAY_MS);
  applyAnswer(r, { correct: true }, T0 + 3 * DAY_MS); assert.equal(r.box, 3); assert.equal(r.due, T0 + 7 * DAY_MS);
  applyAnswer(r, { correct: true }, T0 + 7 * DAY_MS); assert.equal(r.box, 3);
});
test('a miss (fixed or not) → box 0, due now', () => { const r = newRecord('7x8'); applyAnswer(r, { correct: true }, T0); applyAnswer(r, { correct: false, fixed: true }, T0 + 1); assert.equal(r.box, 0); assert.equal(r.due, T0 + 1); assert.equal(r.fixed, 1); });
test('mastered = box 3 + correct on 2 different days + 3 first-try', () => {
  const r = newRecord('7x8');
  for (let i = 0; i < 3; i++) applyAnswer(r, { correct: true }, T0 + i * 60000);
  assert.equal(r.box, 1, 'one promotion a day: same-day repeats are practice'); assert.equal(r.firstTry, 1); assert.equal(r.attempts, 3);
  applyAnswer(r, { correct: true }, T0 + DAY_MS); assert.equal(r.box, 2); assert.equal(isMastered(r), false);
  applyAnswer(r, { correct: true }, T0 + 2 * DAY_MS); assert.equal(r.box, 3); assert.equal(isMastered(r), true);
  assert.equal(r.due, T0 + 2 * DAY_MS + 4 * DAY_MS, 'box 3: back in 4 days');
});
test('a miss: box 0, due now; the re-queue answered right the same day stays box 0, due tomorrow', () => {
  const r = newRecord('7x8');
  applyAnswer(r, { correct: true }, T0 - DAY_MS); applyAnswer(r, { correct: true }, T0); assert.equal(r.box, 2);
  applyAnswer(r, { correct: false, fixed: true }, T0 + 10); assert.equal(r.box, 0); assert.equal(r.due, T0 + 10); assert.equal(r.fixed, 1); assert.equal(r.misses, 1);
  applyAnswer(r, { correct: true, quick: true, ms: 900 }, T0 + 20);
  assert.equal(r.box, 0); assert.equal(r.due, T0 + 20 + DAY_MS); assert.equal(r.firstTry, 2, 'not a first-try retrieval'); assert.equal(r.daysQuick.length, 0);
  applyAnswer(r, { correct: true }, T0 + DAY_MS); assert.equal(r.box, 1, 'the next day it climbs again');
});
test('fluent = mastered + quick on 2 different days; quick needs ≤ 3 s', () => {
  const r = newRecord('7x8');
  applyAnswer(r, { correct: true, quick: true, ms: 1200 }, T0); applyAnswer(r, { correct: true, quick: true, ms: 3500 }, T0 + 1000);
  assert.equal(r.quick, 1, 'over 3 s is not quick'); assert.equal(QUICK_MS, 3000);
  applyAnswer(r, { correct: true, ms: 2000 }, T0 + DAY_MS); applyAnswer(r, { correct: true, ms: 2000 }, T0 + 2 * DAY_MS);
  assert.equal(isMastered(r), true); assert.equal(isFluent(r), false);
  applyAnswer(r, { correct: true, quick: true, ms: 1500 }, T0 + 3 * DAY_MS); assert.equal(isFluent(r), true);
});
test('status: New → Learning → Almost → Mastered → Fluent', () => {
  const r = newRecord('7x8'); assert.equal(status(r), 'New'); assert.equal(status(undefined), 'New');
  applyAnswer(r, { correct: true }, T0); assert.equal(status(r), 'Learning');
  applyAnswer(r, { correct: true }, T0 + 1); assert.equal(status(r), 'Learning');
  applyAnswer(r, { correct: true }, T0 + DAY_MS); assert.equal(status(r), 'Almost');
  applyAnswer(r, { correct: true, quick: true, ms: 900 }, T0 + 2 * DAY_MS); assert.equal(status(r), 'Mastered');
  applyAnswer(r, { correct: true, quick: true, ms: 900 }, T0 + 3 * DAY_MS); assert.equal(status(r), 'Fluent');
});
const seen = (facts, box, due = T0 + 99 * DAY_MS) => Object.fromEntries(facts.map((f) => [f, { ...newRecord(f), box, due, seenCount: 1, daysSeen: ['x'] }]));
test('re-queue: a missed fact returns after 2 others, at most twice per session', () => {
  const active = ['2x3', '2x4', '2x5', '2x6', '2x7', '2x8'];
  const recs = seen(active, 1);
  const s = createSession();
  noteAnswered(s, '2x3', { correct: false });
  const order = [];
  for (let i = 0; i < 12; i++) {
    const p = pickNext(active, recs, T0, s, {}, seq(0.1, 0.5, 0.9));
    order.push([p.fact, p.reason]);
    noteAnswered(s, p.fact, { correct: p.fact !== '2x3' });
  }
  const at = order.map(([f, why], i) => (f === '2x3' && why === 'requeue' ? i : -1)).filter((i) => i >= 0);
  assert.equal(at.length, 2, `re-queued ${at.length} times: ${order.map((x) => x.join(':')).join(' ')}`);
  assert.ok(at[0] >= 2 && at[1] - at[0] >= 3, `gaps: ${at}`);
});
test('never the same fact twice in a row', () => {
  const active = ['2x3', '2x4'];
  const recs = seen(active, 0, T0);
  const s = createSession();
  let last = null;
  for (let i = 0; i < 10; i++) { const p = pickNext(active, recs, T0, s, {}, Math.random); assert.notEqual(p.fact, last); last = p.fact; noteAnswered(s, p.fact, { correct: true }); }
});
test('incremental rehearsal: a new fact comes back after 1, then 2, then 3 known facts', () => {
  assert.deepEqual(REHEARSAL_GAPS, [1, 2, 3]);
  const known = ['2x3', '2x4', '2x5', '2x6', '2x7', '2x8', '2x9', '2x10'];
  const recs = seen(known, 2);
  const active = [...known, '7x8'];
  const s = createSession();
  noteAnswered(s, '7x8', { correct: true, isNewFact: true });
  recs['7x8'] = { ...newRecord('7x8'), seenCount: 1, box: 1, due: T0 + 99 * DAY_MS };
  const order = [];
  for (let i = 0; i < 9; i++) { const p = pickNext(active, recs, T0, s, { newLeft: 0 }, seq(0.3)); order.push(p.fact); noteAnswered(s, p.fact, { correct: true }); }
  const at = order.map((f, i) => (f === '7x8' ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(at, [1, 4, 8], order.join(' '));
  assert.equal(s.rehearsal.length, 0, 'done after 3 returns');
});
test('at most 2 new facts in rehearsal at once; the daily new cap holds', () => {
  const active = ['2x3', '2x4', '2x5', '9x9', '8x8', '7x7'];
  const recs = seen(['2x3', '2x4', '2x5'], 2);
  const s = createSession();
  const news = [];
  for (let i = 0; i < 4; i++) { const p = pickNext(active, recs, T0, s, { newLeft: 5 }, seq(0.2)); if (p.isNew) { news.push(p.fact); recs[p.fact] = { ...newRecord(p.fact), seenCount: 1, box: 1, due: T0 + DAY_MS }; } noteAnswered(s, p.fact, { correct: true, isNewFact: p.isNew }); }
  assert.ok(s.rehearsal.length <= 2, `rehearsing ${s.rehearsal.length}`); assert.ok(news.length <= 2, news.join());
  const s2 = createSession();
  const p = pickNext(active, seen(['2x3', '2x4', '2x5'], 2), T0, s2, { newLeft: 0 }, seq(0.2));
  assert.ok(!p.isNew, 'newLeft 0 → no new fact');
});
test('a new player\'s first race: 4 gates → 4 different facts (sparse mode: fewer than 3 known)', () => {
  const d = defaultFacts(T0); const s = createSession();
  const race = [];
  for (let i = 0; i < 4; i++) { const p = nextFact(d, T0, s, seq(0.4)); race.push(p.fact); assert.ok(p.isNew, `gate ${i + 1} brings a new fact`); recordAnswer(d, p.fact, { correct: true }, T0 + i, s); }
  assert.equal(new Set(race).size, 4, race.join(' '));
  assert.equal(s.rehearsal.length, 1, 'gates 1-3 (sparse) skip rehearsal; with 3 known the 4th new fact is rehearsed normally');
  assert.equal(s.rehearsal[0].fact, race[3]);
  const d6 = defaultFacts(T0); d6.opts.gates = 6; const s6 = createSession(); const r6 = [];
  for (let i = 0; i < 6; i++) { const p = nextFact(d6, T0, s6, seq(0.7)); r6.push(p.fact); recordAnswer(d6, p.fact, { correct: true }, T0 + i, s6); }
  assert.ok(new Set(r6).size >= 5, `6 gates: ${r6.join(' ')}`);
});
test('sparse mode: a missed new fact still returns after 1 other fact; the daily new cap holds', () => {
  const d = defaultFacts(T0); const s = createSession();
  const race = [];
  for (let i = 0; i < 4; i++) { const p = nextFact(d, T0, s, seq(0.4)); race.push(p.fact); recordAnswer(d, p.fact, i === 0 ? { correct: false, fixed: true } : { correct: true }, T0 + i, s); }
  assert.equal(race[2], race[0], `missed at gate 1, back at gate 3: ${race.join(' ')}`);
  assert.equal(new Set(race).size, 3, race.join(' '));
  const c = defaultFacts(T0); c.opts.newPerDay = 3; const sc = createSession(); const rc = [];
  for (let i = 0; i < 6; i++) { const p = nextFact(c, T0, sc, seq(0.4)); rc.push(p.fact); recordAnswer(c, p.fact, { correct: true }, T0 + i, sc); }
  assert.equal(new Set(rc).size, 3, `cap 3: ${rc.join(' ')}`); assert.equal(c.today.newCount, 3);
});
test('3+ known facts: unchanged (one new fact rehearsed among known ones, ≤ 2 rehearsing)', () => {
  const known = ['2x3', '2x4', '2x5', '2x6'];
  const recs = seen(known, 2);
  const active = [...known, '7x8', '6x7', '8x9'];
  const s = createSession();
  const order = [];
  for (let i = 0; i < 6; i++) {
    const p = pickNext(active, recs, T0, s, { newLeft: 99 }, seq(0.3));
    order.push(p.fact);
    if (p.isNew) recs[p.fact] = { ...newRecord(p.fact), seenCount: 1, box: 1, due: T0 + DAY_MS };
    noteAnswered(s, p.fact, { correct: true, isNewFact: p.isNew, sparse: false });
  }
  const news = order.filter((f) => !known.includes(f));
  assert.ok(new Set(news).size <= 2 && s.rehearsal.length <= 2, order.join(' '));
  assert.ok(order.some((f, i) => i > 0 && f === order.find((x) => !known.includes(x)) && order.indexOf(f) < i), `a new fact comes back: ${order.join(' ')}`);
});
test('due facts come first (lowest box), then new, then free practice across families (interleaving)', () => {
  const active = ['2x3', '3x4', '56/7', '7x8'];
  const recs = { ...seen(['2x3'], 2, T0 + DAY_MS), ...seen(['3x4'], 1, T0 - 1), ...seen(['56/7'], 0, T0 - 5) };
  const s = createSession();
  assert.equal(pickNext(active, recs, T0, s, {}, seq(0.5)).fact, '56/7');
  noteAnswered(s, '56/7', { correct: true }); recs['56/7'].due = T0 + DAY_MS;
  assert.equal(pickNext(active, recs, T0, s, {}, seq(0.5)).fact, '3x4');
  noteAnswered(s, '3x4', { correct: true }); recs['3x4'].due = T0 + DAY_MS;
  const p = pickNext(active, recs, T0, s, {}, seq(0.5)); assert.equal(p.fact, '7x8'); assert.equal(p.reason, 'new');
});

console.log('\nstore');
test('default set: ×2 … ×9 with ÷, 4 gates, all new facts a day, facts aloud', () => {
  const d = defaultFacts(T0);
  assert.deepEqual(d.sets.families, STOCK_FAMILIES); assert.equal(d.sets.division, true); assert.equal(d.opts.gates, 4); assert.equal(d.opts.newPerDay, 99); assert.equal(d.opts.aloud, true);
  assert.equal(d.sets.mode, 'auto', 'auto mode is the default (v1.3)');
  d.sets.mode = 'manual';
  assert.equal(activeFacts(d).length, 172);   // 60 × facts + their ÷ inverses (squares have one)
});
test('new facts come easiest first: ×2 / ×10 / ×5 before ×7, a ÷ fact only after its × fact', () => {
  assert.ok(difficulty('2x7') < difficulty('5x7') && difficulty('5x7') < difficulty('7x8') && difficulty('8+7') < difficulty('2x3'));
  assert.ok(difficulty('56/7') > difficulty('7x8') + 100); assert.ok(difficulty('56/7', (f) => f === '7x8') < difficulty('7x8') + 60);
  const d = defaultFacts(T0); const s = createSession();
  const news = [];
  for (let i = 0; i < 8; i++) { const p = nextFact(d, T0, s, seq(0.4)); if (p.isNew) news.push(p.fact); recordAnswer(d, p.fact, { correct: true }, T0 + i, s); }
  assert.ok(news.length >= 2 && news.every((f) => /x(10|2)$|^(2|10)x/.test(f)), news.join(' '));
});
test('nextFact gives a fact in the set with a flip only for commutative facts', () => {
  const d = defaultFacts(T0); const s = createSession();
  for (let i = 0; i < 20; i++) { const p = nextFact(d, T0, s, Math.random); assert.ok(activeFacts(d).includes(p.fact)); if (!isCommutative(p.fact)) assert.equal(p.flip, false); recordAnswer(d, p.fact, { correct: true }, T0, s); }
});
test('recordAnswer: status, XP (first try 15, quick +5, fixed 5), new count', () => {
  const d = defaultFacts(T0);
  let r = recordAnswer(d, '7x8', { correct: true, quick: true, ms: 1500 }, T0);
  assert.equal(r.isNew, true); assert.equal(r.status, 'Learning'); assert.equal(r.xp, XP.firstTry + XP.quick); assert.equal(d.today.newCount, 1);
  r = recordAnswer(d, '6x7', { correct: false, fixed: true }, T0); assert.equal(r.xp, XP.fixed); assert.equal(d.xp, 25);
});
test('newly mastered and newly fluent are reported once (+50 XP)', () => {
  const d = defaultFacts(T0);
  const res = [];
  for (const t of [T0, T0 + 1000, T0 + DAY_MS, T0 + 2 * DAY_MS]) res.push(recordAnswer(d, '7x8', { correct: true, quick: true, ms: 1000 }, t));
  res.push(recordAnswer(d, '7x8', { correct: true, quick: true, ms: 1000 }, T0 + 3 * DAY_MS));
  assert.deepEqual(res.map((x) => x.newlyMastered), [false, false, false, true, false]);
  assert.deepEqual(res.map((x) => x.newlyFluent), [false, false, false, true, false]);
  assert.ok(res[3].xp >= XP.firstTry + XP.mastered);
});
test('daily mission: 12 gate answers, done once (+100 XP), a new day starts over', () => {
  assert.equal(MISSION_SIZE, 12); assert.equal(MISSION_REWARD, 400);
  const d = defaultFacts(T0);
  const done = [];
  for (let i = 0; i < 14; i++) done.push(recordAnswer(d, `2x${(i % 11) + 2}`, { correct: i % 3 !== 0, fixed: i % 3 === 0 }, T0 + i).missionJustDone);
  assert.deepEqual(done.map((x, i) => (x ? i : -1)).filter((i) => i >= 0), [11]);
  assert.deepEqual(missionState(d, T0 + 99), { count: 12, answered: 14, size: 12, done: true, paid: true });
  assert.equal(missionState(d, T0 + DAY_MS).count, 0); assert.equal(missionState(d, T0 + DAY_MS).paid, false);
});
test('levels use Spell Jump\'s thresholds', () => {
  assert.equal(LEVEL_XP[1], 100); assert.equal(levelFor(0), 1); assert.equal(levelFor(99), 1); assert.equal(levelFor(100), 2); assert.equal(levelFor(1000), 6);
  assert.deepEqual(levelProgress(150), { level: 2, into: 50, need: 150, max: false });
});
test('report: per-operation status counts, slowest facts, this week\'s races', () => {
  const d = defaultFacts(T0); d.sets.mode = 'manual';
  recordAnswer(d, '7x8', { correct: true, ms: 4000 }, T0); recordAnswer(d, '7x8', { correct: true, ms: 2000 }, T0 + DAY_MS);
  recordAnswer(d, '56/7', { correct: false, fixed: true }, T0); recordAnswer(d, '2x3', { correct: true, ms: 1000 }, T0);
  noteRace(d, { at: T0, trail: 'pine-ridge', place: 2, asked: 4, correct: 3, quick: 1, fixed: 1 });
  noteRace(d, { at: T0 - 9 * DAY_MS, trail: 'pine-ridge', asked: 4 });
  const r = report(d, T0);
  assert.equal(r.ops.x.total, 60); assert.equal(r.ops.x.Almost, 1); assert.equal(r.ops.x.Learning, 1); assert.equal(r.ops.x.New, 58);
  assert.equal(r.ops['/'].Learning, 1); assert.equal(r.ops['+'].total, 0);
  assert.deepEqual(r.slowest.map((x) => x.fact), ['7x8', '2x3']); assert.equal(r.slowest[0].avgMs, 3000);
  assert.equal(r.races.length, 1);
  const t = reportText(d, 'Mia', T0, () => 'Pine Ridge');
  assert.match(t, /Mia/); assert.match(t, /Multiplication \(×\): New 58 · Learning 1 · Almost 1/); assert.match(t, /Slowest: 7 × 8 \(3\.0 s\)/); assert.match(t, /Pine Ridge · 2nd · 3\/4 right, 1 quick, 1 fixed/);
});
test('resetFacts clears progress, keeps the set, options and XP', () => {
  const d = defaultFacts(T0); d.sets.addSub = true; d.opts.gates = 6;
  recordAnswer(d, '7x8', { correct: true }, T0); const xp = d.xp;
  resetFacts(d, T0);
  assert.deepEqual(d.records, {}); assert.equal(d.today.count, 0); assert.equal(d.sets.addSub, true); assert.equal(d.opts.gates, 6); assert.equal(d.xp, xp);
});
test('normalize: garbage → defaults; records re-keyed canonically and merged; bad options dropped; old days reset', () => {
  assert.deepEqual(normalizeFacts(null, T0), defaultFacts(T0));
  assert.deepEqual(normalizeFacts('nope', T0), defaultFacts(T0));
  const d = normalizeFacts({ sets: { families: ['x7', 'x13', 'banana'], division: false, custom: ['8 x 7', 'bad'] },
    records: { '8x7': { box: 2, firstTry: 2, seenCount: 2, daysCorrect: ['2026-10-04', 'junk'] }, '7x8': { box: 1, firstTry: 1, seenCount: 1 }, 'xx': {} },
    today: { date: '2020-01-01', count: 9 }, xp: -5, opts: { gates: 5, newPerDay: 8, aloud: false } }, T0);
  assert.deepEqual(d.sets.families, ['x7']); assert.equal(d.sets.division, false); assert.deepEqual(d.sets.custom, ['7x8']);
  assert.deepEqual(Object.keys(d.records), ['7x8']); assert.equal(d.records['7x8'].box, 2); assert.equal(d.records['7x8'].firstTry, 3); assert.deepEqual(d.records['7x8'].daysCorrect, ['2026-10-04']);
  assert.equal(d.today.count, 0); assert.equal(d.xp, 0); assert.equal(d.opts.gates, 4); assert.equal(d.opts.newPerDay, 8); assert.equal(d.opts.aloud, false);
});
test('normalize round-trips a used store', () => {
  const d = defaultFacts(T0); const s = createSession();
  for (let i = 0; i < 8; i++) { const p = nextFact(d, T0, s, seq(0.3, 0.7)); recordAnswer(d, p.fact, { correct: i % 2 === 0, fixed: i % 2 === 1, quick: i % 4 === 0, ms: 1500 }, T0 + i, s); }
  assert.deepEqual(normalizeFacts(JSON.parse(JSON.stringify(d)), T0 + 9), d);
});
test('every × family ×2 … ×12 is selectable', () => { assert.equal(ALL_FAMILIES.length, 11); assert.equal(ALL_FAMILIES[0], 'x2'); assert.equal(ALL_FAMILIES[10], 'x12'); });


console.log('\nv1.4: Pit Crew Check (placement: locate, zoom, twins)');
const lcg = (seed = 7) => { let x = seed; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; };
function runCheck(answer, opts = {}, rand = lcg(3)) {
  const st = createCheck({ tiers: tiersFor({ division: true, ...(opts.sets || {}) }), ...opts }, rand);
  let it;
  while ((it = checkNext(st))) checkAnswer(st, answer(it, st));
  return st;
}
const QUICK = { correct: true, quick: true, ms: 1400 };
const SLOW = { correct: true, quick: false, ms: 5200 };
const MISS = (it) => ({ correct: false, quick: false, ms: 4000, given: 1 });
const itemsBy = (st, tier) => st.items.filter((x) => x.tier === tier);
test('v1.6.1: "Race first" works twice per check, then only Start; a finished check resets the budget', () => {
  const d = defaultFacts(T0);
  assert.equal(CHECK_SKIPS, 2); assert.ok(canSkipCheck(d)); assert.equal(checkSkipsLeft(d), 2);
  noteCheckSkip(d); assert.ok(canSkipCheck(d)); assert.equal(checkSkipsLeft(d), 1);
  noteCheckSkip(d); assert.ok(!canSkipCheck(d)); assert.equal(checkSkipsLeft(d), 0);
  noteCheckSkip(d); assert.ok(!canSkipCheck(d), 'never negative, never a lock: the card just has Start');
  assert.equal(normalizeFacts(JSON.parse(JSON.stringify(d))).checkSkips, 3, 'the count survives a save');
  const st = runCheck(() => QUICK);
  applyCheck(d, st, T0 + 1000);
  assert.equal(d.checkSkips, 0, 'a finished check starts the budget over'); assert.ok(canSkipCheck(d));
});
const answersFor = (st, fam) => st.items.filter((x) => x.family === fam).length;
test('tiers: × T1 … T5 (÷ comes as twins), T0 + − only when the parent allows it', () => {
  assert.deepEqual(tiersFor({ division: true }), ['T1', 'T2', 'T3', 'T4', 'T5']);
  assert.deepEqual(tiersFor({ division: false, addSub: true }), ['T0', 'T1', 'T2', 'T3', 'T4', 'T5']);
  assert.deepEqual(TIERS.find((t) => t.id === 'T4').families, ['x7', 'x8']);
});
test('staircase (v1.4): from T3 a fluent kid reaches T5 and the ÷ twins in ≤ 24 items', () => {
  const st = runCheck(() => QUICK);
  assert.equal(st.items[0].tier, 'T3', 'starts at T3');
  assert.deepEqual(st.items.filter((x) => x.phase === 'locate').map((x) => x.tier), ['T3', 'T3', 'T4', 'T4', 'T5', 'T5'], 'locate: 2 items per tier, up on right + quick');
  assert.ok(st.items.some((x) => x.phase === 'twins' && x.fact.includes('/')), 'then ÷ twins for the fluent families');
  assert.ok(st.items.length <= MAX_ITEMS, `${st.items.length} items`);
  const pl = checkResult(st, T0);
  assert.equal(pl.located, 'T5'); assert.equal(pl.families.x11.status, 'fluent'); assert.equal(pl.families.x3.status, 'known'); assert.ok(pl.families.x3.inferred);
});
test('staircase: locate items are one per family, other numbers 3 … 9 first; no fact twice', () => {
  const st = runCheck(() => QUICK);
  const t3 = st.items.filter((x) => x.phase === 'locate' && x.tier === 'T3');
  assert.equal(new Set(t3.map((x) => x.family)).size, 2);
  assert.equal(new Set(st.items.map((x) => x.fact)).size, st.items.length);
  for (const it of st.items.filter((x) => x.phase === 'locate')) { const [a, b] = it.fact.split('x').map(Number); const n = Number(it.family.slice(1)); const m = a === n ? b : a; assert.ok(m >= 3 && m <= 9, it.fact); }
});
test('staircase: a kid who misses at T3 lands in T2, and every T2 / T3 family has ≥ 2 answers (zoom)', () => {
  const st = runCheck((it) => (it.tier === 'T3' ? MISS(it) : QUICK));
  const pl = checkResult(st, T0);
  assert.equal(pl.located, 'T2'); assert.equal(pl.tier, 'T3', 'the work starts at T3');
  for (const fam of ['x3', 'x4', 'x6', 'x9']) assert.ok(answersFor(st, fam) >= 2, `${fam}: ${answersFor(st, fam)} answers`);
  assert.equal(pl.families.x6.status, 'shaky'); assert.equal(pl.families.x3.status, 'fluent');
  assert.ok(pl.phase.locate <= 10 && pl.phase.zoom >= 8, JSON.stringify(pl.phase));
});
test('staircase: right but slow stays and zooms (the tier and the one above); ≤ 24 items in all', () => {
  const st = runCheck((it) => (it.tier === 'T3' ? SLOW : QUICK));
  assert.deepEqual(st.items.filter((x) => x.phase === 'locate').map((x) => x.tier), ['T3', 'T3']);
  for (const fam of ['x6', 'x9', 'x7', 'x8']) assert.ok(answersFor(st, fam) >= 2, fam);
  assert.ok(!itemsBy(st, 'T2').length, 'no need to look lower: right is right');
  const pl = checkResult(st, T0);
  assert.equal(pl.families.x6.status, 'known'); assert.equal(pl.families.x7.status, 'fluent'); assert.equal(pl.families.x3.status, 'known', 'vouched below');
  const all = runCheck((it) => MISS(it));
  assert.ok(all.items.length <= MAX_ITEMS); assert.equal(checkResult(all, T0).located, 'T1');
  const long = runCheck(() => QUICK, { sets: { addSub: true }, start: 'T0' });
  assert.ok(long.items.length <= MAX_ITEMS, `${long.items.length} items`);
});
test('placement: families told apart (×6 fluent, ×9 shaky); tiers below the lowest passed tier are vouched for', () => {
  const st = runCheck((it) => (it.family === 'x9' ? MISS(it) : QUICK));
  const pl = checkResult(st, T0);
  assert.equal(pl.families.x6.status, 'fluent'); assert.equal(pl.families.x9.status, 'shaky');
  assert.equal(pl.families.x2.status, 'known'); assert.ok(pl.families.x2.inferred); assert.equal(pl.families.x11.status, 'untested');
});
test('placement seeds the records: quick right = box 2 + a first-try, slow right = box 1, a miss = box 0 + focus; +100 XP', () => {
  const d = defaultFacts(T0);
  d.records['3x5'] = { ...newRecord('3x5'), box: 3, seenCount: 4, attempts: 4, firstTry: 4, daysCorrect: ['2026-10-01', '2026-10-02'] };
  const st = runCheck((it) => (it.tier === 'T3' ? (it.family === 'x6' ? MISS(it) : SLOW) : QUICK));
  const pl = applyCheck(d, st, T0);
  const q = st.items.find((x) => x.quick), sl = st.items.find((x) => x.correct && !x.quick), m = st.items.find((x) => !x.correct);
  assert.equal(d.records[q.fact].box, 2); assert.equal(d.records[q.fact].firstTry, 1); assert.equal(d.records[q.fact].due, T0 + 2 * DAY_MS);
  assert.equal(d.records[sl.fact].box, 1); assert.equal(d.records[sl.fact].firstTry, 0);
  assert.equal(d.records[m.fact].box, 0); assert.equal(d.records[m.fact].focus, true); assert.equal(d.records[m.fact].patterns.length, 1);
  assert.equal(d.xp, CHECK_XP); assert.equal(pl.checks, 1); assert.equal(d.placement, pl); assert.ok(pl.tier && pl.phase.locate >= 2);
  assert.equal(applyCheck(d, runCheck(() => QUICK), T0 + 1).checks, 2);
});
test('the Start line: "Fluent: … · Working on: … · Up next: <the scout family>"', () => {
  const d = defaultFacts(T0);
  applyCheck(d, runCheck((it) => (it.tier === 'T3' ? SLOW : QUICK)), T0);
  refreshFrontier(d, T0);
  assert.deepEqual(d.frontier.families, ['x6', 'x9']);
  const sl = startLine(d, { scout: scoutFamily(d, T0) });
  assert.deepEqual(sl.working, ['x6', 'x9']); assert.ok(sl.fluent.includes('x7') && sl.fluent.includes('x8')); assert.deepEqual(sl.next, ['x11']);
  assert.match(sl.text, /^Fluent: .*×7.* · Working on: ×6 ×9 · Up next: ×11$/);
});
test('the check runs before the first race until done; then re-checks: 14 days, 5 clean races, two tiers above', () => {
  const d = defaultFacts(T0);
  assert.deepEqual(checkDue(d, T0), { due: true, kind: 'first', why: 'not placed yet' });
  applyCheck(d, runCheck((it) => (it.tier === 'T3' ? MISS(it) : QUICK)), T0); refreshFrontier(d, T0);
  assert.ok(!checkDue(d, T0 + 1).due);
  assert.ok(checkDue(d, T0 + 14 * DAY_MS).due && checkDue(d, T0 + 14 * DAY_MS).kind === 'recheck', '14 days');
  for (let i = 0; i < 5; i++) afterRace(d, { finished: true, clean: true, gates: 4 }, T0 + i);
  assert.ok(checkDue(d, T0 + 10).due, '5 clean races in a row'); assert.match(checkDue(d, T0 + 10).why, /5 races in a row/);
  afterRace(d, { finished: true, clean: false, gates: 4 }, T0 + 11); assert.ok(!checkDue(d, T0 + 12).due, 'a miss resets the count');
  d.frontier.families = ['x11', 'x12'];
  assert.ok(checkDue(d, T0 + 13).due, `two tiers above the placed tier (${d.placement.tier})`);
  assert.equal(recheckStart(d), 'T5');
});

console.log('\nv1.3: auto mode, frontier, gate mix, retention probe');
const mastered = (f, lastSeen = T0 - DAY_MS) => ({ ...newRecord(f), box: 3, seenCount: 5, attempts: 5, firstTry: 4, quick: 3, daysCorrect: ['2026-09-28', '2026-09-30', '2026-10-02'], daysSeen: ['2026-10-02'], daysQuick: ['2026-09-30', '2026-10-02'], due: T0 + 4 * DAY_MS, lastSeen });
const boxed = (f, box) => ({ ...newRecord(f), box, seenCount: 2, attempts: 2, firstTry: box, daysCorrect: box ? ['2026-10-03'] : [], daysSeen: ['2026-10-03'], due: T0 + 9 * DAY_MS, lastSeen: T0 - DAY_MS });
test('a new player in auto mode starts on ×2 and ×5; the first race is 4 different facts from them', () => {
  const d = defaultFacts(T0); const s = createSession();
  assert.deepEqual(d.frontier.families, ['x2', 'x5']); assert.match(d.frontier.reason, /first tables/);
  const race = [];
  for (let i = 0; i < 4; i++) { const p = nextFact(d, T0, s, seq(0.4)); race.push(p.fact); recordAnswer(d, p.fact, { correct: true, quick: true, ms: 1200 }, T0 + i, s); }
  assert.equal(new Set(race).size, 4); assert.ok(race.every((f) => familyMembers('x2').includes(f) || familyMembers('x5').includes(f)), race.join(' '));
});
test('frontier: the two weakest families, never above an untested gap (no ×8 before ×3 is known)', () => {
  const d = defaultFacts(T0);
  d.placement = { at: T0, checks: 1, families: { x2: { status: 'fluent' }, x5: { status: 'fluent' }, x10: { status: 'fluent' }, x3: { status: 'untested' } } };
  for (const f of ['6x8', '7x8', '8x8', '8x9', '8x11']) d.records[f] = boxed(f, 0);     // ×8 tested and weak …
  const f = computeFrontier(d, T0);
  assert.deepEqual(f.families, ['x3', 'x4'], `… but ×3 is untested below it: ${f.families}`);
  d.placement.families.x3 = { status: 'shaky' }; d.placement.families.x4 = { status: 'known' };
  assert.deepEqual(computeFrontier(d, T0).families, ['x3', 'x4']);
  assert.match(computeFrontier(d, T0).reason, /×3 and ×4/);
  d.sets.addSub = true;
  assert.deepEqual(computeFrontier(d, T0).families, ['x3', 'x4'], 'untested + and − (allowed later) do not hold back tested × families');
});
test('frontier follows the ladder: the lowest unfinished tier first, then misses and slowness within a tier', () => {
  const d = defaultFacts(T0);
  d.placement = { at: T0, checks: 1, families: { x2: { status: 'fluent' }, x5: { status: 'fluent' }, x10: { status: 'fluent' }, x3: { status: 'fluent' }, x4: { status: 'fluent' },
    x6: { status: 'shaky' }, x9: { status: 'shaky' }, x7: { status: 'shaky' }, x8: { status: 'shaky' } } };
  for (const [f, g] of [['7x8', 49], ['7x8', 64], ['8x8', 63], ['7x7', 48], ['8x9', 71]]) recordAnswer(d, f, { correct: false, given: g }, T0);
  assert.deepEqual(computeFrontier(d, T0).families, ['x6', 'x9'], 'shaky ×6 ×9 before ×7 ×8, however many misses ×7 ×8 have');
  d.placement.families.x9 = { status: 'known' };
  recordAnswer(d, '6x6', { correct: false, given: 30 }, T0);
  assert.deepEqual(computeFrontier(d, T0).families, ['x6', 'x9'], 'one tier at a time: ×9 (slow) before any ×7 / ×8');
  d.placement.families.x3 = { status: 'shaky' };
  assert.deepEqual(computeFrontier(d, T0).families, ['x3', 'x6'], 'a shaky lower family always comes first');
});
test('advancement: ≥ 90 % mastered and ≥ 70 % fluent graduates a family and the next ones enter; ÷ twins join once known', () => {
  const d = defaultFacts(T0);
  d.placement = { at: T0, checks: 1, families: { x2: { status: 'fluent' }, x5: { status: 'fluent' }, x10: { status: 'fluent' }, x3: { status: 'known' }, x4: { status: 'known' } } };
  refreshFrontier(d, T0); assert.deepEqual(d.frontier.families, ['x3', 'x4']);
  assert.ok(autoFamilies(d, T0).includes('d2'), '÷2 joins once ×2 is known');
  for (const fam of ['x3', 'x4']) for (const f of familyMembers(fam)) d.records[f] = mastered(f);
  const i = famInfo(d, 'x3', T0); assert.ok(i.graduated, `x3 mastered ${i.mastered} fluent ${i.fluent}`);
  refreshFrontier(d, T0 + 1); assert.deepEqual(d.frontier.families, ['x6', 'x9']);
});
test('secure (v1.3.2): 4 quick first-try answers vouch a family out of the frontier the same day; a miss today holds it', () => {
  const d = defaultFacts(T0);
  d.placement = { at: T0, checks: 1, families: { x2: { status: 'known' }, x5: { status: 'known' }, x10: { status: 'known' } } };
  refreshFrontier(d, T0); assert.deepEqual(d.frontier.families, ['x2', 'x5'], 'start: the lowest tier');
  for (const f of ['2x3', '2x4', '2x7', '2x9']) recordAnswer(d, f, { correct: true, quick: true, ms: 1200 }, T0 + 1000);
  const i = famInfo(d, 'x2', T0 + 2000);
  assert.ok(i.secure && i.known, `×2 secure after 4 instant answers: ${JSON.stringify({ secure: i.secure, known: i.known })}`);
  refreshFrontier(d, T0 + 2000); assert.deepEqual(d.frontier.families, ['x5', 'x10'], 'the frontier moved on the same day');
  assert.ok(autoFamilies(d, T0 + 2000).includes('x2') && autoFamilies(d, T0 + 2000).includes('d2'), '×2 stays in the gates as known, ÷2 joins');
  for (const f of ['5x3', '5x4', '5x7']) recordAnswer(d, f, { correct: true, quick: true, ms: 1000 }, T0 + 3000);
  recordAnswer(d, '5x8', { correct: false, given: 45 }, T0 + 4000);
  assert.ok(!famInfo(d, 'x5', T0 + 5000).secure, 'a miss in the family today: not secure');
  refreshFrontier(d, T0 + 5000); assert.ok(d.frontier.families.includes('x5'), `×5 stays: ${d.frontier.families}`);
  // slow but right is not secure either: every fact seen, 2 of 6 quick
  const e = defaultFacts(T0);
  for (const f of familyMembers('x10')) recordAnswer(e, f, { correct: true, quick: f === '10x3' || f === '10x4', ms: 2500 }, T0 + 1000);
  assert.ok(!famInfo(e, 'x10', T0 + 2000).secure, 'all right but slow: the family is still being learned');
});
test('re-entry: two facts of a family dropping to box 0 in a week bring it back into the frontier first', () => {
  const d = defaultFacts(T0);
  d.placement = { at: T0, checks: 1, families: { x2: { status: 'fluent' }, x5: { status: 'fluent' }, x10: { status: 'fluent' }, x3: { status: 'known' }, x4: { status: 'known' } } };
  for (const fam of ['x3', 'x4']) for (const f of familyMembers(fam)) d.records[f] = mastered(f);
  refreshFrontier(d, T0); assert.ok(!d.frontier.families.includes('x3'));
  recordAnswer(d, '2x3', { correct: false, given: 5 }, T0 + 10); recordAnswer(d, '3x5', { correct: false, given: 8 }, T0 + 20);   // ×3 is the harder family of both
  refreshFrontier(d, T0 + 30);
  assert.equal(d.frontier.families[0], 'x3'); assert.match(d.frontier.reason, /came back/);
});
test('gate mix: about 60 % frontier, 30 % known, 10 % mastered over 100 gates', () => {
  const d = defaultFacts(T0); d.sets.division = false;
  for (const fam of ['x2', 'x5']) for (const f of familyMembers(fam)) d.records[f] = boxed(f, 2);
  for (const f of familyMembers('x10')) d.records[f] = mastered(f);
  for (const fam of ['x3', 'x4']) for (const f of familyMembers(fam)) if (!d.records[f]) d.records[f] = boxed(f, 1);
  d.frontier = { families: ['x3', 'x4'], since: T0, reason: '' };
  const s = createSession(); const n = { frontier: 0, known: 0, mastered: 0 }; const rand = lcg(11);
  for (let i = 0; i < 100; i++) { const p = pickAuto(d, T0, s, {}, rand); n[p.bucket] = (n[p.bucket] || 0) + 1; noteAnswered(s, p.fact, { correct: true }); }
  assert.ok(n.frontier >= 48 && n.frontier <= 72, JSON.stringify(n)); assert.ok(n.known >= 18 && n.known <= 42, JSON.stringify(n)); assert.ok(n.mastered >= 3 && n.mastered <= 18, JSON.stringify(n));
  assert.deepEqual(MIX, { frontier: 0.6, known: 0.3, mastered: 0.1 });
});
test('retention probe: after 15 finished races (or 7 days) the next race mixes in 6 mastered facts; a miss pulls the family back', () => {
  const d = defaultFacts(T0);
  for (const fam of ['x2', 'x5', 'x10']) for (const f of familyMembers(fam)) d.records[f] = mastered(f);
  const out = [];
  for (let i = 1; i <= 15; i++) out.push(afterRace(d, { finished: true }, T0 + i * 1000).probeStarted);
  assert.deepEqual(out.map((x, i) => (x ? i + 1 : 0)).filter(Boolean), [15], 'the probe starts after the 15th finished race');
  assert.equal(d.probe.facts.length, PROBE.size); assert.ok(new Set(d.probe.facts.map((f) => factFamilies(f)[0])).size >= 3, 'spread over families');
  const s = createSession(); const reasons = [];
  for (let i = 0; i < 4; i++) { const p = nextFact(d, T0 + 20000, s, lcg(5)); reasons.push(p.reason); recordAnswer(d, p.fact, p.reason === 'probe' && i === 0 ? { correct: false, given: 1 } : { correct: true, quick: true, ms: 900 }, T0 + 20000 + i, s); }
  assert.deepEqual(reasons.filter((r) => r === 'probe').length, 2, `every other gate: ${reasons}`);
  refreshFrontier(d, T0 + 30000); assert.match(d.frontier.reason, /retention check/);
  const d7 = defaultFacts(T0); afterRace(d7, { finished: true }, T0); assert.ok(!probeDue(d7, T0 + 6 * DAY_MS)); assert.ok(probeDue(d7, T0 + 7 * DAY_MS), '7 days');
});

console.log('\nv1.3: error patterns');
test('every pattern with examples: adjacent, off-by-operand, reversed, operation, inverse, big-operands, random', () => {
  assert.equal(classifyMiss('7x8', 49), 'adjacent'); assert.equal(classifyMiss('7x8', 64), 'adjacent'); assert.equal(classifyMiss('7x8', 42), 'adjacent');
  assert.equal(classifyMiss('7x8', 48), 'off-by-operand'); assert.equal(classifyMiss('7x8', 63), 'off-by-operand'); assert.equal(classifyMiss('56/7', 9), 'off-by-operand');
  assert.equal(classifyMiss('7x8', 65), 'reversed'); assert.equal(classifyMiss('3x4', 21), 'reversed');
  assert.equal(classifyMiss('7x8', 15), 'operation'); assert.equal(classifyMiss('56/7', 392), 'operation'); assert.equal(classifyMiss('9+4', 5), 'operation'); assert.equal(classifyMiss('13-4', 17), 'operation');
  assert.equal(classifyMiss('56/7', 6, { '7x8': mastered('7x8') }), 'inverse'); assert.equal(classifyMiss('56/7', 6), 'big-operands'); assert.equal(classifyMiss('12/3', 7), 'random');
  assert.equal(classifyMiss('8x9', 71), 'big-operands'); assert.equal(classifyMiss('3x4', 13), 'random'); assert.equal(classifyMiss('7x8', 56), null);
});
test('slow-only: right but never quick after 2+ right answers, noted once in a row', () => {
  const d = defaultFacts(T0);
  recordAnswer(d, '6x7', { correct: true, ms: 5000 }, T0); assert.ok(!isSlowOnly(d.records['6x7']));
  recordAnswer(d, '6x7', { correct: true, ms: 5200 }, T0 + DAY_MS); recordAnswer(d, '6x7', { correct: true, ms: 5100 }, T0 + 2 * DAY_MS);
  assert.deepEqual(d.records['6x7'].patterns.map((x) => x.kind), ['slow-only']); assert.deepEqual(d.records['6x7'].times, [5000, 5200, 5100]);
});
test('hints from patterns: adjacent → "7 × 7 is 49, then one more 7"; reversed → tens and ones; inverse → the × fact; the record\'s pattern for the next miss', () => {
  assert.equal(patternHint('7x8', false, 'adjacent', 49), '7 × 7 is 49, then one more 7 is 56');
  assert.equal(patternHint('7x8', false, 'off-by-operand', 48), '6 × 8 is 48, then one more 8 is 56');
  assert.equal(patternHint('7x8', false, 'reversed', 65), '5 tens and 6 ones: 56, not 65');
  assert.equal(patternHint('56/7', false, 'inverse', 6), 'you know 7 × 8 = 56, so 56 ÷ 7 = 8');
  assert.match(patternHint('7x8', false, 'operation', 15), /^this one is × \(times\): /);
  assert.equal(patternHint('8x9', false, 'big-operands', 71), null);
  const rec = newRecord('7x8'); notePattern(rec, 'adjacent', T0, 49); notePattern(rec, 'adjacent', T0, 64);
  assert.equal(hintKind('7x8', 71, { '7x8': rec }), 'adjacent', 'an unclassified miss uses the record\'s pattern');
});
test('Report patterns in plain words: misses cluster, division weaker, slow on big numbers', () => {
  const d = defaultFacts(T0);
  for (const [f, g] of [['7x8', 49], ['6x7', 48], ['7x9', 62], ['8x9', 71], ['6x8', 49]]) recordAnswer(d, f, { correct: false, given: g }, T0);
  d.records['7x8'].patterns.push({ kind: 'adjacent', at: T0, given: 64 });
  for (const f of ['24/4', '18/3', '35/5']) { d.records[factKey(f.split('/')[1] * 1, 'x', f.split('/')[0] / f.split('/')[1])] = mastered(factKey(f.split('/')[1] * 1, 'x', f.split('/')[0] / f.split('/')[1]), T0); recordAnswer(d, f, { correct: false, given: 1 }, T0); }
  for (let i = 0; i < 3; i++) recordAnswer(d, '6x7', { correct: true, ms: 5000 }, T0 + i * DAY_MS);
  const lines = patternSummary(d, T0 + 3 * DAY_MS);
  const kinds = lines.map((x) => x.kind);
  assert.ok(kinds.includes('cluster') && /Misses cluster in ×8/.test(lines.find((x) => x.kind === 'cluster').text), JSON.stringify(lines));   // a × miss counts for the harder family
  assert.ok(kinds.includes('division'), 'Division is weaker'); assert.ok(kinds.includes('slow-big') && /6 × 7/.test(lines.find((x) => x.kind === 'slow-big').text));
  assert.ok(lines.some((x) => x.kind === 'adjacent' && /like 7 × 8 → /.test(x.text)));
  assert.ok(inverseCluster(d, T0));
  const t = reportText(d, 'Mia', T0 + 3 * DAY_MS); assert.match(t, /Patterns: .*Misses cluster/);
});
test('an inverse cluster brings the ÷ twin in two gates after its × fact', () => {
  const d = defaultFacts(T0);
  d.placement = { at: T0, checks: 1, families: { x2: { status: 'fluent' }, x5: { status: 'fluent' }, x10: { status: 'fluent' }, x3: { status: 'known' }, x4: { status: 'known' } } };
  for (const f of ['2x8', '5x6']) d.records[f] = mastered(f);
  recordAnswer(d, '16/2', { correct: false, given: 9 }, T0); recordAnswer(d, '30/5', { correct: false, given: 5 }, T0);
  assert.ok(inverseCluster(d, T0)); refreshFrontier(d, T0);
  const s = createSession(); const seqs = [];
  for (let i = 0; i < 6; i++) { const p = nextFact(d, T0 + 100, s, lcg(9)); seqs.push(p.fact); recordAnswer(d, p.fact, { correct: true, quick: true, ms: 900 }, T0 + 100 + i, s); }
  const i = seqs.findIndex((f) => f.includes('x') && s.history.length);
  const xi = seqs.findIndex((f, k) => /x/.test(f) && seqs[k + 2] && seqs[k + 2].includes('/') && seqs[k + 2].split('/')[0] * 1 === f.split('x').reduce((a, b) => a * b, 1));
  assert.ok(xi >= 0, `a × fact, then its ÷ twin two gates later: ${seqs.join(' ')}`);
});
test('normalize v1.2 data: stock set → auto, edited set → manual, no placement → the check is offered; records gain times / patterns', () => {
  const old = { v: 1, sets: { families: STOCK_FAMILIES, division: true, addSub: false, custom: [] }, records: { '7x8': { box: 2, seenCount: 3, attempts: 3, firstTry: 2 } }, xp: 30, opts: { gates: 4 } };
  const d = normalizeFacts(JSON.parse(JSON.stringify(old)), T0);
  assert.equal(d.sets.mode, 'auto'); assert.equal(d.placement, null); assert.ok(checkDue(d, T0).due && checkDue(d, T0).kind === 'first'); assert.deepEqual(d.records['7x8'].times, []); assert.deepEqual(d.records['7x8'].patterns, []);
  assert.ok(d.frontier.families.length === 2);
  const edited = normalizeFacts({ ...old, sets: { families: ['x7', 'x8'], division: false, custom: [] } }, T0);
  assert.equal(edited.sets.mode, 'manual'); assert.deepEqual(activeFacts(edited).length, 21);
  const custom = normalizeFacts({ ...old, sets: { ...old.sets, custom: ['19+34'] } }, T0); assert.equal(custom.sets.mode, 'manual');
  const d3 = defaultFacts(T0); applyCheck(d3, runCheck(() => QUICK), T0); afterRace(d3, { finished: true }, T0);
  assert.deepEqual(normalizeFacts(JSON.parse(JSON.stringify(d3)), T0), d3, 'a v1.3 store round-trips');
});


console.log('\nv1.4: secure, scouts, the difficulty governor');
const gateStream = (d, list, t0 = T0) => list.forEach(([f, ok, quick], i) => recordAnswer(d, f, ok ? { correct: true, quick, ms: quick ? 1200 : 5200 } : { correct: false, given: 1 }, t0 + i * 1000));
const placedAt = (d, fams) => { d.placement = { at: T0, checks: 1, tier: 'T2', families: Object.fromEntries(Object.entries(fams).map(([f, st]) => [f, { status: st }])) }; refreshFrontier(d, T0); };
test('secure (v1.4): an all-quick family advances in one sitting; one miss in its last 8 answers blocks it', () => {
  const d = defaultFacts(T0);
  placedAt(d, { x2: 'fluent', x5: 'fluent', x10: 'fluent', x3: 'known', x4: 'known' });
  assert.deepEqual(d.frontier.families, ['x3', 'x4']);
  gateStream(d, familyMembers('x3').map((f) => [f, true, true]));
  assert.ok(famInfo(d, 'x3', T0 + 60000).secure); assert.ok(!d.frontier.families.includes('x3'), `×3 moved on in one sitting: ${d.frontier.families}`);
  const e = defaultFacts(T0);
  placedAt(e, { x2: 'fluent', x5: 'fluent', x10: 'fluent', x3: 'known', x4: 'known' });
  const fs = familyMembers('x4');
  gateStream(e, fs.map((f, i) => [f, i !== 8, true]));
  assert.ok(!famInfo(e, 'x4', T0 + DAY_MS).secure, 'a miss in the last 8: not secure');
  gateStream(e, fs.slice(1, 9).map((f) => [f, true, true]), T0 + DAY_MS);
  assert.ok(famInfo(e, 'x4', T0 + DAY_MS + 60000).secure, '8 clean answers later (the next day): secure');
});
test('vouched: families the check found fluent are secure from the start; a miss since takes it back', () => {
  const d = defaultFacts(T0);
  placedAt(d, { x2: 'fluent', x5: 'fluent', x10: 'fluent', x3: 'fluent', x4: 'shaky' });
  assert.ok(famInfo(d, 'x3', T0).secure && famInfo(d, 'x3', T0).checkVouched); assert.ok(!famInfo(d, 'x4', T0).secure);
  recordAnswer(d, '2x3', { correct: false, given: 5 }, T0 + 10);
  assert.ok(!famInfo(d, 'x3', T0 + 20).secure, 'a miss after the check');
});
test('scouts: from the next tier up first, never a fact already seen; 3 quick scouts vouch, a scout miss does not', () => {
  const d = defaultFacts(T0);
  placedAt(d, { x2: 'fluent', x5: 'fluent', x10: 'fluent', x3: 'shaky', x4: 'known', x6: 'untested', x9: 'untested' });
  assert.deepEqual(d.frontier.families, ['x3', 'x4']);
  assert.equal(scoutFamily(d, T0), 'x6', 'the next tier first');
  d.records['6x7'] = { ...newRecord('6x7'), seenCount: 1, attempts: 1, firstTry: 1, box: 1, daysCorrect: ['2026-10-05'] };
  for (let i = 0; i < 30; i++) { const f = scoutFact(d, 'x6', lcg(i + 1)); assert.ok(f && f !== '6x7' && familyMembers('x6').includes(f)); }
  for (let i = 0; i < 2; i++) assert.ok(!noteScout(d, 'x6', true, true, T0 + i).vouched);
  assert.ok(noteScout(d, 'x6', true, true, T0 + 3).vouched, '3 quick scouts'); assert.ok(famInfo(d, 'x6', T0 + 4).secure && famInfo(d, 'x6', T0 + 4).vouched);
  assert.equal(scoutFamily(d, T0 + 5), 'x9', 'then the next family up');
  noteScout(d, 'x9', false, false, T0 + 6); for (let i = 0; i < 3; i++) noteScout(d, 'x9', true, true, T0 + 7 + i);
  assert.ok(!(d.vouched && d.vouched.x9), 'a scout miss: no vouch'); assert.notEqual(scoutFamily(d, T0 + 20), 'x9', 'and it waits its turn');
});
test('a race with 4 gates: 2 frontier, 1 known, 1 scout; scouts are recorded and vouch over 3 races', () => {
  const d = defaultFacts(T0);
  placedAt(d, { x2: 'fluent', x5: 'fluent', x10: 'fluent', x3: 'known', x4: 'known', x6: 'untested' });
  const s = createSession(); let t = T0 + 1000;
  for (let race = 0; race < 3; race++) {
    beginRace(s, 4); const kinds = [];
    for (let g = 0; g < 4; g++) {
      const p = nextFact(d, t, s, lcg(race * 10 + g + 1)); kinds.push(p.bucket === 'scout' ? 'scout' : p.bucket);
      recordAnswer(d, p.fact, { correct: true, quick: true, ms: 900, scout: p.reason === 'scout' ? p.family : undefined }, (t += 1000), s);
    }
    if (race === 0) assert.deepEqual(kinds.slice().sort(), ['frontier', 'frontier', 'known', 'scout'], `race 1 (on target): ${kinds}`);
    else assert.ok(kinds.filter((k) => k === 'scout').length >= 1, `race ${race + 1}: ${kinds}`);
  }
  assert.ok(d.vouched && Object.keys(d.vouched).length >= 1, `a family vouched within 3 races (${JSON.stringify(d.scouts)})`);
  assert.ok(d.frontier.history.some((h) => /quick scouts/.test(h.why)) || famInfo(d, Object.keys(d.vouched)[0], t).secure);
});
test('governor: the dial from the last 12 gates (cold start, band boundaries)', () => {
  const mk = (right, quick, n = 12) => ({ gateLog: Array.from({ length: n }, (_, i) => [i + 1, i < right ? 1 : 0, i < quick ? 1 : 0]) });
  assert.equal(dial(mk(0, 0, DIAL_MIN - 1)).band, 'target', 'fewer than 6 answers: on target');
  assert.equal(dial(mk(12, 12)).band, 'easy'); assert.equal(dial(mk(12, 9)).band, 'easy', '≥ 70 % quick');
  assert.equal(dial(mk(12, 8)).band, 'target', 'all right but slow is not too easy'); assert.equal(dial(mk(11, 11)).band, 'target', '11 of 12 = 91.7 %');
  assert.equal(dial(mk(9, 9)).band, 'target', '75 %'); assert.equal(dial(mk(8, 8)).band, 'hard', '66.7 %');
  assert.equal(dialText(dial(mk(10, 8))), 'Right now: on target (10 of 12 right)');
  assert.equal(dialText(dial(mk(12, 12))), 'Right now: a bit easy: moving up (12 of 12 right)');
  assert.equal(dialText(dial(mk(5, 5))), 'Right now: a bit hard: stepping back (5 of 12 right)');
  assert.deepEqual(raceQuota('easy', 4), { frontier: 1, known: 1, scout: 2, mastered: 0 }); assert.deepEqual(raceQuota('target', 4), { frontier: 2, known: 1, scout: 1, mastered: 0 });
  assert.deepEqual(raceQuota('hard', 4), { frontier: 2, known: 2, scout: 0, mastered: 0 });
});
test('governor, too easy: all right + quick → the frontier families go secure and the next race has 2 scouts', () => {
  const d = defaultFacts(T0);
  placedAt(d, { x2: 'fluent', x5: 'fluent', x10: 'fluent', x3: 'known', x4: 'known', x6: 'untested', x9: 'untested' });
  gateStream(d, [...familyMembers('x3'), ...familyMembers('x4').slice(0, 4)].map((f) => [f, true, true]));
  assert.equal(dial(d).band, 'easy'); assert.ok(!d.frontier.families.includes('x3') && !d.frontier.families.includes('x4'), `moved up: ${d.frontier.families}`);
  const s = createSession(); beginRace(s, 4); const kinds = [];
  for (let g = 0; g < 4; g++) { const p = nextFact(d, T0 + 90000, s, lcg(g + 3)); kinds.push(p.bucket); recordAnswer(d, p.fact, { correct: true, quick: true, ms: 900, scout: p.reason === 'scout' ? p.family : undefined }, T0 + 90000 + g, s); }
  assert.equal(kinds.filter((k) => k === 'scout').length, 2, `2 scouts: ${kinds}`);
});
test('governor, too hard: 5 of 12 → one family, no scouts, a drowning family steps back and its lower neighbour re-enters', () => {
  const d = defaultFacts(T0);
  placedAt(d, { x2: 'fluent', x5: 'fluent', x10: 'fluent', x3: 'fluent', x4: 'fluent', x6: 'fluent', x9: 'fluent', x7: 'known', x8: 'shaky' });
  assert.deepEqual(d.frontier.families, ['x7', 'x8']);
  gateStream(d, [['7x7', true, true], ['7x8', false], ['8x8', false], ['3x8', true, true], ['8x9', false], ['4x8', true, true], ['5x7', true, true], ['8x6', false], ['2x8', true, true], ['7x9', false], ['6x7', false], ['8x11', false]]);
  assert.equal(dial(d).band, 'hard', JSON.stringify(dial(d)));
  assert.ok(drowning(d, 'x8')); assert.ok(d.stepped.x8 && d.stepped.x8.back === 'x4', JSON.stringify(d.stepped));
  assert.equal(d.frontier.families.length, 1); assert.deepEqual(d.frontier.families, ['x4'], `×8 steps back to ×4: ${d.frontier.families}`);
  assert.match(d.frontier.reason, /stepping back/);
  const s = createSession(); beginRace(s, 4);
  for (let g = 0; g < 4; g++) { const p = nextFact(d, T0 + 50000, s, lcg(g + 1)); assert.notEqual(p.reason, 'scout', 'no scouts when it is too hard'); }
  // ×4 secure again (4+ answers since, all right, quick) → ×8 comes back
  gateStream(d, ['4x3', '4x5', '4x6', '4x7', '4x9'].map((f) => [f, true, true]), T0 + 60000);
  assert.ok(!d.stepped.x8, '×8 returns once ×4 is solid');
});
test('the frontier is never empty, whatever the answers', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const d = defaultFacts(T0); const s = createSession(); const r = lcg(seed); let t = T0;
    if (seed % 2) placedAt(d, { x2: 'fluent', x5: 'fluent', x10: 'fluent', x3: 'fluent', x4: 'fluent', x6: 'fluent', x9: 'fluent', x7: 'fluent', x8: 'fluent', x11: 'fluent', x12: 'fluent' });
    for (let race = 0; race < 6; race++) {
      beginRace(s, 4);
      for (let g = 0; g < 4; g++) {
        const p = nextFact(d, t, s, r); assert.ok(p && p.fact, 'a fact for every gate');
        const ok = r() < (seed <= 2 ? 0.3 : seed <= 4 ? 0.8 : 1);
        recordAnswer(d, p.fact, ok ? { correct: true, quick: r() < 0.8, ms: 1500, scout: p.reason === 'scout' ? p.family : undefined } : { correct: false, given: 1, scout: p.reason === 'scout' ? p.family : undefined }, (t += 1000), s);
        assert.ok(d.frontier.families.length >= 1, `seed ${seed}: empty frontier after ${p.fact}`);
      }
      afterRace(d, { finished: true, gates: 4 }, (t += 1000));
    }
    for (const fam of ['x2', 'x5', 'x10', 'x3', 'x4', 'x6', 'x9', 'x7', 'x8', 'x11', 'x12']) for (const f of familyMembers(fam)) d.records[f] = mastered(f, t);
    refreshFrontier(d, t); assert.ok(d.frontier.families.length >= 1, 'everything mastered: still one family');
  }
});
test('a × miss judges only the harder family: 5 × 8 missed is an ×8 miss; right answers count for both', () => {
  const d = defaultFacts(T0);
  placedAt(d, { x2: 'fluent', x5: 'fluent', x10: 'fluent', x3: 'fluent', x4: 'fluent', x6: 'fluent', x9: 'fluent', x7: 'known', x8: 'known' });
  recordAnswer(d, '5x8', { correct: false, given: 45 }, T0 + 10);
  assert.ok(famInfo(d, 'x5', T0 + 20).secure, '×5 keeps its vouch'); assert.equal(famInfo(d, 'x5', T0 + 20).misses, 0);
  assert.equal(famInfo(d, 'x8', T0 + 20).misses, 1, 'the miss is ×8\'s');
  for (const f of ['3x8', '4x8', '6x8']) recordAnswer(d, f, { correct: false, given: 1 }, T0 + 30);
  assert.ok(drowning(d, 'x8') && !drowning(d, 'x4') && !drowning(d, 'x6'));
  assert.ok(familyRecent(d, 'x5').every((x) => x[1]), 'the ×5 list has no misses'); recordAnswer(d, '5x7', { correct: true, quick: true, ms: 900 }, T0 + 40);
  assert.ok(familyRecent(d, 'x5').length >= 1 && familyRecent(d, 'x7').length >= 1, 'a right answer counts for both');
});
test('normalize v1.3 data: no scouts, no history, no gate log → the v1.4 defaults; a v1.4 store round-trips', () => {
  const v13 = { v: 2, sets: { mode: 'auto', families: STOCK_FAMILIES, division: true, custom: [] }, records: { '7x8': { box: 2, seenCount: 3, attempts: 3, firstTry: 2, times: [900] } },
    placement: { at: T0, checks: 1, families: { x2: { status: 'fluent' }, x7: { status: 'shaky' } } }, frontier: { families: ['x7', 'x8'], since: T0, reason: 'x' } };
  const d = normalizeFacts(JSON.parse(JSON.stringify(v13)), T0);
  assert.deepEqual(d.scouts, {}); assert.deepEqual(d.frontier.history, []); assert.deepEqual(d.gateLog, []); assert.deepEqual(d.records['7x8'].recent, []);
  assert.equal(d.placement.tier, null); assert.ok(!checkDue(d, T0 + 1).due, 'a v1.3 placement is kept'); assert.equal(dial(d).band, 'target');
  gateStream(d, [['7x8', true, true], ['6x7', false]]); noteScout(d, 'x11', true, true, T0); afterRace(d, { finished: true, gates: 4 }, T0 + 99);
  assert.deepEqual(normalizeFacts(JSON.parse(JSON.stringify(d)), T0 + 100), d);
});

console.log('\nmedals + self-update');
test('medal times from MEDAL_TIMES (object or array) with a fallback; medalFor', () => {
  const t = medalTimesFor({ id: 'p', length: 600 }, { p: { gold: 30, silver: 34, bronze: 38 } });
  assert.deepEqual(t, { gold: 30, silver: 34, bronze: 38 }); assert.deepEqual(medalTimesFor({ id: 'p' }, { p: [1, 2, 3] }), { gold: 1, silver: 2, bronze: 3 });
  assert.ok(medalTimesFor({ id: 'q', length: 600 }, {}).gold > 0);
  assert.equal(medalFor(29.9, t), 'gold'); assert.equal(medalFor(34, t), 'silver'); assert.equal(medalFor(38, t), 'bronze'); assert.equal(medalFor(39, t), null);
  // v1.4: the place earns a medal on its own; the time can only improve it
  assert.equal(placeMedal(1), 'gold'); assert.equal(placeMedal(3), 'bronze'); assert.equal(placeMedal(4), null); assert.equal(placeMedal(null), null);
  assert.equal(raceMedal(1, 40, t), 'gold', '1st but slower than bronze is still gold');
  assert.equal(raceMedal(2, 33, t), 'silver'); assert.equal(raceMedal(2, 29, t), 'gold', '2nd under the gold time');
  assert.equal(raceMedal(4, 39, t), null); assert.equal(raceMedal(4, 37, t), 'bronze');
  assert.equal(fmtTime(42.37), '0:42.3'); assert.equal(ordinal(2), '2nd'); assert.equal(ordinal(13), '13th');
});
test('self-update reloads only on a safe screen, once, never on the first install', () => {
  assert.equal(safeToReload({ screen: 'title' }), true); assert.equal(safeToReload({ screen: 'ride' }), false); assert.equal(safeToReload({ screen: 'grid', running: true }), false);
  let reloads = 0, notes = 0, safe = false;
  const g = createUpdateGuard({ hadController: false, isSafe: () => safe, reload: () => reloads++, notify: () => notes++ });
  g.onControllerChange(); assert.equal(reloads, 0);
  g.onControllerChange(); assert.equal(notes, 1); g.check(); assert.equal(reloads, 0);
  safe = true; g.check(); g.check(); assert.equal(reloads, 1);
});

// ---------- v1.6: family sync (src/meta/sync.js), FACTS_VERSION 4 caps, the storage form and its size ----------
console.log('v1.6 sync: storage form and size');
const { PATTERN_KINDS } = await import('../src/facts/patterns.js');
const PK0 = PATTERN_KINDS[0];
const { compactFacts, FACTS_VERSION } = await import('../src/facts/store.js');
const { mergeTb, mergeFactsDocs, mergeRecord } = await import('../src/meta/sync.js');
const SV = await import('../src/meta/save.js');
const DAYX = 86400000;
function matureStore() {
  const d = defaultFacts(T0);
  d.sets = { ...d.sets, mode: 'manual', source: 'families', families: ALL_FAMILIES.filter((f) => /^x/.test(f)), division: true, addSub: true };
  const facts = setFacts({ families: d.sets.families, division: true, addSub: true }).slice(0, 222);
  let k = 0;
  // 222 facts × 30 days, every fact every day, 1 in 5 missed (a pattern each) and half the right answers quick: worse than real play
  for (let day = 0; day < 30; day++) for (const f of facts) { k++; recordAnswer(d, f, { correct: k % 5 !== 0, quick: k % 2 === 0, fixed: k % 5 === 0, ms: 1500 + (k % 7) * 400, given: 3 }, T0 + day * DAYX + (k % 300) * 1000); }
  return d;
}
const mature = matureStore();
const kb = (x) => JSON.stringify(x).length / 1024;
const fullKB = kb(mature), storedKB = kb(compactFacts(mature));
test(`a mature store (222 facts × 30 days of answers) is stored in ${storedKB.toFixed(1)} KB (< 150 KB; ${fullKB.toFixed(1)} KB in memory form, 363 KB before v1.6)`, () => {
  assert.equal(Object.keys(mature.records).length, 222);
  assert.ok(storedKB < 150, `${storedKB.toFixed(1)} KB`);
  assert.equal(FACTS_VERSION, 4);
  for (const r of Object.values(mature.records)) {
    assert.ok(r.daysSeen.length <= 12 && r.daysCorrect.length <= 12 && r.daysQuick.length <= 12, 'day lists capped at 12');
    assert.ok(r.patterns.length <= 6 && r.recent.length <= 8 && r.times.length <= 5);
  }
});
test('the storage form loads back to the same records (defaults restored, day numbers → days, seconds → ms)', () => {
  const now = T0 + 29 * DAYX;
  const viaStore = normalizeFacts(JSON.parse(JSON.stringify(compactFacts(mature))), now);
  const direct = normalizeFacts(JSON.parse(JSON.stringify(mature)), now);
  assert.deepEqual(viaStore.records, direct.records);
  const r = viaStore.records['7x8'] || Object.values(viaStore.records)[0];
  assert.equal(typeof r.fact, 'string'); assert.equal(r.rehearsed, false); assert.ok(/^\d{4}-\d\d-\d\d$/.test(r.daysSeen[0]));
  const c = compactFacts(mature).records[r.fact];
  assert.ok(!('fact' in c) && !('rehearsed' in c) && !('focus' in c), 'default-valued fields are not stored');
});
test('v3 data trims on load: 30 days → the last 12, 10 patterns → the newest 6', () => {
  const days30 = Array.from({ length: 30 }, (_, i) => new Date(T0 + i * DAYX).toISOString().slice(0, 10));
  const pats = Array.from({ length: 10 }, (_, i) => ({ kind: PK0, at: T0 + i * 1000, given: 54 }));
  const d = normalizeFacts({ v: 3, records: { '7x8': { fact: '7x8', box: 3, attempts: 30, firstTry: 25, seenCount: 30, lastSeen: T0 + 29 * DAYX, daysSeen: days30, daysCorrect: days30, daysQuick: days30, patterns: pats } } }, T0 + 30 * DAYX);
  const r = d.records['7x8'];
  assert.deepEqual(r.daysSeen, days30.slice(-12)); assert.equal(r.patterns.length, 6); assert.equal(r.patterns[0].at, T0 + 4000);
  assert.ok(isMastered(r), 'still mastered with 12 days');
});
test('ghosts are packed for storage (a 1,500-sample run in ~11 KB) and unpack within 0.01 s / 0.1 m / 0.01 rad', () => {
  const tr = Array.from({ length: 1500 }, (_, i) => [i / 10, i * 3.37 + 0.12, Math.sin(i / 50) * 4, Math.cos(i / 30) * 0.5]);
  const enc = SV.encodeGhost(tr), dec = SV.decodeGhost(enc);
  assert.ok(enc.length < 14 * 1024, `${(enc.length / 1024).toFixed(1)} KB`);
  assert.equal(dec.length, 1500);
  for (const i of [0, 1, 777, 1499]) tr[i].forEach((v, j) => assert.ok(Math.abs(v - dec[i][j]) <= [0.005, 0.05, 0.05, 0.005][j] + 1e-9, `${i}:${j}`));
  const s = SV.normalize(JSON.parse(JSON.stringify(SV.storedSave({ ...SV.defaultSave(), ghosts: { 'pine-ridge': tr } }))));
  assert.equal(s.ghosts['pine-ridge'].length, 1500); assert.equal(s.ghosts['pine-ridge'][10].length, 4, '[t, x, y, angle] kept (v1.5 kept 3)');
});

console.log('v1.6 sync: merge rules — the Trail Blazer save');
const tbSave = (f) => { const s = SV.defaultSave(); f(s); return SV.storedSave(s); };
test('purchases on two devices: both vehicles owned, the higher upgrade levels, cash max, gear owned = union; the later doc picks what is equipped', () => {
  const laptop = tbSave((s) => { s.cash = 4000; s.vehicles.quad = { owned: true, levels: { engine: 2, tires: 0, suspension: 0, boost: 0 } }; s.vehicle = 'quad'; s.vehicles.ranger150.levels.engine = 3; s.cosmetics.owned.helmet.push('flames'); s.paint = 'orange'; });
  const ipad = tbSave((s) => { s.cash = 9000; s.vehicles.dirtbike = { owned: true, levels: { engine: 0, tires: 1, suspension: 0, boost: 0 } }; s.vehicle = 'dirtbike'; s.vehicles.ranger150.levels.tires = 4; s.cosmetics.owned.helmet.push('dino'); });
  const m = SV.normalize(mergeTb({ updatedAt: 200, data: laptop }, { updatedAt: 100, data: ipad }));
  assert.deepEqual(Object.keys(m.vehicles).sort(), ['dirtbike', 'quad', 'ranger150']);
  assert.equal(m.vehicles.ranger150.levels.engine, 3); assert.equal(m.vehicles.ranger150.levels.tires, 4); assert.equal(m.vehicles.quad.levels.engine, 2);
  assert.equal(m.cash, 9000); assert.deepEqual(m.cosmetics.owned.helmet.sort(), ['dino', 'flames']);
  assert.equal(m.vehicle, 'quad', 'the later doc drives'); assert.equal(m.paint, 'orange');
  const m2 = SV.normalize(mergeTb({ updatedAt: 100, data: laptop }, { updatedAt: 200, data: ipad }));
  assert.equal(m2.vehicle, 'dirtbike'); assert.ok(m2.vehicles.quad.owned, 'still owns the quad');
});
test('a race on each device: best times min, places min, medals the better, stars OR, finished / records / best max, cups the better trophy', () => {
  const a = tbSave((s) => { s.bestTime['pine-ridge'] = 41.2; s.bestPlace['pine-ridge'] = 2; s.medals['pine-ridge'] = 'silver'; s.stars['pine-ridge'] = [false, true, false]; s.finished['pine-ridge'] = 3; s.records.rides = 9; s.records.wins = 1; s.cups.rookie = { best: 16, trophy: 'silver', weekends: 1 }; s.best['pine-ridge'] = 600; });
  const b = tbSave((s) => { s.bestTime['pine-ridge'] = 43.0; s.bestPlace['pine-ridge'] = 1; s.medals['pine-ridge'] = 'gold'; s.stars['pine-ridge'] = [true, false, false]; s.finished['pine-ridge'] = 2; s.records.rides = 7; s.records.wins = 2;
    s.bestTime['granite-gap'] = 60; s.bestPlace['granite-gap'] = 3; s.cups.rookie = { best: 14, trophy: 'gold', weekends: 1 }; });
  const m = SV.normalize(mergeTb({ updatedAt: 100, data: a }, { updatedAt: 200, data: b }));
  assert.equal(m.bestTime['pine-ridge'], 41.2); assert.equal(m.bestPlace['pine-ridge'], 1); assert.equal(m.medals['pine-ridge'], 'gold');
  assert.deepEqual(m.stars['pine-ridge'], [true, true, false]); assert.equal(m.finished['pine-ridge'], 3); assert.equal(m.records.rides, 9); assert.equal(m.records.wins, 2);
  assert.equal(m.bestTime['granite-gap'], 60); assert.deepEqual(m.cups.rookie, { best: 16, trophy: 'gold', weekends: 1 });
});
test('crates (max counters, the longer waiting queue), streak (Spell Jump\'s rule), rivals (max tier, retired union), the faster ghost', () => {
  const g = (end) => Array.from({ length: 20 }, (_, i) => [i === 19 ? end : i / 10, i * 3, 0, 0]);
  const a = tbSave((s) => { s.crates = { queue: ['bronze', 'gold'], earned: 6, opened: 4, sinceNew: 1 }; s.streak = { ...s.streak, count: 4, lastDay: '2026-10-19', best: 4, days: ['2026-10-19'] }; s.rivals = { tier: 1, retired: ['dusty'], beats: { dusty: 3, blaze: 1 } }; s.ghosts['pine-ridge'] = g(40.5); });
  const b = tbSave((s) => { s.crates = { queue: ['silver'], earned: 5, opened: 5, sinceNew: 2 }; s.streak = { ...s.streak, count: 5, lastDay: '2026-10-20', best: 5, days: ['2026-10-20'] }; s.rivals = { tier: 0, retired: [], beats: { blaze: 2 } }; s.ghosts['pine-ridge'] = g(39.9); s.ghosts['lake-loop'] = g(70); });
  const m = SV.normalize(mergeTb({ updatedAt: 200, data: a }, { updatedAt: 100, data: b }));
  assert.deepEqual(m.crates, { queue: ['bronze', 'gold'], earned: 6, opened: 5, sinceNew: 2 });
  assert.equal(m.streak.count, 5); assert.equal(m.streak.lastDay, '2026-10-20'); assert.deepEqual(m.streak.days, ['2026-10-19', '2026-10-20']);
  assert.equal(m.rivals.tier, 1); assert.deepEqual(m.rivals.retired, ['dusty']); assert.equal(m.rivals.beats.blaze, 2);
  assert.equal(m.ghosts['pine-ridge'][19][0], 39.9, 'the faster trace'); assert.ok(m.ghosts['lake-loop']);
});
test('a reset on one device (resetAt) wins whole; merging is symmetric', () => {
  const rich = tbSave((s) => { s.cash = 50000; s.vehicles.quad = { owned: true, levels: { engine: 1, tires: 0, suspension: 0, boost: 0 } }; });
  const reset = tbSave((s) => { s.resetAt = 500; s.cash = 10; });
  for (const [x, y] of [[rich, reset], [reset, rich]]) {
    const m = SV.normalize(mergeTb({ updatedAt: 900, data: x }, { updatedAt: 100, data: y }));
    assert.equal(m.cash, 10); assert.ok(!m.vehicles.quad); assert.equal(m.resetAt, 500);
  }
  const p = mergeTb({ updatedAt: 300, data: rich }, { updatedAt: 300, data: tbSave((s) => { s.cash = 7; }) }), q = mergeTb({ updatedAt: 300, data: tbSave((s) => { s.cash = 7; }) }, { updatedAt: 300, data: rich });
  assert.deepEqual(p, q, 'the same result on both devices');
});

console.log('v1.6 sync: merge rules — the math facts');
function factsOn(day, f) { const d = defaultFacts(T0 + day * DAYX); f(d); return compactFacts(d); }
test('a fact answered on both devices on different days: counters max, days union, the later answer\'s box, patterns / recent union', () => {
  const laptop = factsOn(0, (d) => { recordAnswer(d, '7x8', { correct: true, quick: true, ms: 1500 }, T0); recordAnswer(d, '6x7', { correct: true, ms: 2000 }, T0 + 1000); d.xp = 120; });
  const ipad = factsOn(1, (d) => { recordAnswer(d, '7x8', { correct: false, fixed: true, ms: 5000, given: 54 }, T0 + DAYX); recordAnswer(d, '7x8', { correct: true, ms: 2500 }, T0 + DAYX + 5000); d.xp = 80; });
  const m = normalizeFacts(mergeFactsDocs({ updatedAt: T0, data: laptop }, { updatedAt: T0 + DAYX, data: ipad }, T0 + DAYX + 9000), T0 + DAYX + 9000);
  const r = m.records['7x8'];
  assert.ok(m.records['6x7'], 'a record only the laptop had is kept');
  assert.equal(r.attempts, 2, 'counters max (the iPad answered twice)'); assert.equal(r.firstTry, 1);
  assert.equal(r.daysSeen.length, 2, 'both days kept'); assert.equal(r.lastSeen, T0 + DAYX + 5000);
  assert.equal(r.box, 0, "the later answer's box (missed on day 2)"); assert.equal(r.patterns.length, 1); assert.equal(r.recent.length, 3, "the laptop's answer and the iPad's two");
  assert.equal(m.xp, 120, 'xp max');
});
test('the same fact on the same day: the higher box wins; the record lists stay capped after a merge', () => {
  const a = mergeRecord({ fact: '7x8', box: 2, due: 5, lastSeen: T0 + 1000, attempts: 3, daysSeen: ['2026-10-01'], recent: [[1, 1, 1]], patterns: [] },
    { fact: '7x8', box: 1, due: 9, lastSeen: T0 + 2000, attempts: 4, daysSeen: ['2026-10-02'], recent: [[2, 1, 0]], patterns: [] });
  assert.equal(a.box, 2); assert.equal(a.due, 5); assert.equal(a.attempts, 4);
  const many = (o) => Array.from({ length: 10 }, (_, i) => ({ kind: PK0, at: o + i }));
  const b = mergeRecord({ fact: '7x8', lastSeen: 1, patterns: many(0), recent: Array.from({ length: 8 }, (_, i) => [i * 2, 1, 1]), daysSeen: Array.from({ length: 12 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`) },
    { fact: '7x8', lastSeen: 2, patterns: many(100), recent: Array.from({ length: 8 }, (_, i) => [i * 2 + 1, 1, 1]), daysSeen: Array.from({ length: 12 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`) });
  assert.equal(b.patterns.length, 6); assert.equal(b.patterns[5].at, 109); assert.equal(b.recent.length, 8); assert.equal(b.recent[7][0], 15);
  assert.equal(b.daysSeen.length, 12); assert.equal(b.daysSeen[0], '2026-10-01');
});
test('store level: today (same day → max), the later sets.updatedAt, placement by `at`, scouts max, vouched earliest, gateLog / races union', () => {
  const now = T0 + 2 * DAYX;
  const a = factsOn(2, (d) => { d.today.count = 7; d.sets.families = ['x2', 'x3']; d.sets.mode = 'manual'; d.sets.updatedAt = T0 + 10; d.placement = { at: T0, families: {}, tiers: [] }; d.scouts = { x7: { asked: 3, quick: 1, miss: 0 } }; d.vouched = { x6: T0 + 50 };
    d.gateLog = [[T0 + 1, 1, 1], [T0 + 3, 1, 0]]; d.races = [{ at: T0 + 100, trail: 'pine-ridge', asked: 4, correct: 4, quick: 2, fixed: 0 }]; });
  const b = factsOn(2, (d) => { d.today.count = 9; d.sets.families = ['x9']; d.sets.mode = 'manual'; d.sets.updatedAt = T0 + 20; d.placement = { at: T0 + 5, families: {}, tiers: [] }; d.scouts = { x7: { asked: 2, quick: 2, miss: 1 } }; d.vouched = { x6: T0 + 30 };
    d.gateLog = [[T0 + 2, 0, 0]]; d.races = [{ at: T0 + 200, trail: 'lake-loop', asked: 4, correct: 3, quick: 1, fixed: 1 }]; });
  const m = normalizeFacts(mergeFactsDocs({ updatedAt: T0 + 500, data: a }, { updatedAt: T0 + 400, data: b }, now), now);
  assert.equal(m.today.count, 9); assert.deepEqual(m.sets.families, ['x9'], 'the parent\'s later set'); assert.equal(m.placement.at, T0 + 5);
  assert.deepEqual(m.scouts.x7, { asked: 3, quick: 2, miss: 1 }); assert.equal(m.vouched.x6, T0 + 30);
  assert.deepEqual(m.gateLog.map((x) => x[0]), [T0 + 1, T0 + 2, T0 + 3]); assert.deepEqual(m.races.map((x) => x.trail), ['pine-ridge', 'lake-loop']);
});
test('a facts reset on one device wins whole; no record is lost otherwise (every fact of both sides survives)', () => {
  const a = factsOn(0, (d) => { for (const f of ['2x3', '2x4', '2x5']) recordAnswer(d, f, { correct: true }, T0); });
  const b = factsOn(0, (d) => { for (const f of ['3x4', '3x5']) recordAnswer(d, f, { correct: true }, T0 + 10); });
  const both = normalizeFacts(mergeFactsDocs({ updatedAt: 1, data: a }, { updatedAt: 2, data: b }, T0 + 20), T0 + 20);
  assert.deepEqual(Object.keys(both.records).sort(), ['2x3', '2x4', '2x5', '3x4', '3x5']);
  const r = defaultFacts(T0); resetFacts(r, T0 + 30);
  const m = normalizeFacts(mergeFactsDocs({ updatedAt: 1, data: compactFacts(r) }, { updatedAt: 99, data: a }, T0 + 40), T0 + 40);
  assert.equal(Object.keys(m.records).length, 0); assert.equal(m.resetAt, T0 + 30);
});

console.log('v1.6.2: the week\'s progress (Parent Zone)');
const PG = await import('../src/facts/progress.js');
test('weekProgress: a new player is 0 % of the ladder with no races this week (rightPct null → a dash)', () => {
  const w = PG.weekProgress(defaultFacts(T0), T0);
  assert.equal(w.secureFamilies, 0); assert.equal(w.ladderPct, 0); assert.ok(w.ladderFamilies >= 12);
  assert.equal(w.gatesThisWeek, 0); assert.equal(w.rightPct, null); assert.deepEqual(w.movedUp, []);
  assert.deepEqual(PG.weekProgressLines(w), [`Ladder: 0 % of families secure (0 of ${w.ladderFamilies})`, 'This week: no races this week']);
});
test('weekProgress: a family answered right and quick is secure; a scout-vouched family counts and "moved up" when vouched this week', () => {
  const d = defaultFacts(T0);
  for (const f of familyMembers('x2')) recordAnswer(d, f, { correct: true, quick: true, ms: 1200 }, T0);
  d.vouched = { x9: T0 - 2 * DAY_MS, x11: T0 - 20 * DAY_MS };
  const w = PG.weekProgress(d, T0 + 1000);
  assert.equal(w.secureFamilies, 3, 'x2 (secure) + x9 + x11 (vouched)');
  assert.equal(w.ladderPct, Math.round((3 / w.ladderFamilies) * 100));
  assert.deepEqual(w.movedUp, ['x2', 'x9'], 'x2 left the frontier today, x9 vouched 2 days ago: moved up; x11 vouched 20 days ago: not this week');
});
test('weekProgress: gates this week only (an older race does not count), rounded; moved up from the frontier history', () => {
  const d = defaultFacts(T0);
  noteRace(d, { at: T0 - 2 * DAY_MS, trail: 'pine-ridge', asked: 4, correct: 3, quick: 1, fixed: 1 });
  noteRace(d, { at: T0 - 1 * DAY_MS, trail: 'lake-loop', asked: 6, correct: 6, quick: 3, fixed: 0 });
  noteRace(d, { at: T0 - 10 * DAY_MS, trail: 'granite-gap', asked: 4, correct: 0, quick: 0, fixed: 4 });
  for (const f of familyMembers('x2')) recordAnswer(d, f, { correct: true, quick: true, ms: 1200 }, T0 - DAY_MS);
  d.frontier.history = [{ at: T0 - DAY_MS, from: ['x2', 'x5'], families: ['x5', 'x10'], why: 'x2 secure' }, { at: T0 - 9 * DAY_MS, from: ['x10'], families: ['x2'], why: 'old' }];
  const w = PG.weekProgress(d, T0);
  assert.equal(w.gatesThisWeek, 10); assert.equal(w.rightThisWeek, 9); assert.equal(w.rightPct, 90);
  assert.deepEqual(w.movedUp, ['x2']);
  assert.equal(PG.weekProgressLines(w)[1], 'This week: 90 % right at the gates (9 of 10) · moved up: ×2');
});

console.log('\nv1.7: three tiers above ÷12 (tens, teens, big numbers) and the Hill Climb\'s facts');
const F17 = await import('../src/facts/facts.js');
const H17 = await import('../src/facts/hill.js');
const S17 = await import('../src/facts/store.js');
const P17 = await import('../src/facts/placement.js');
const A17 = await import('../src/facts/adaptive.js');
const G17 = await import('../src/facts/governor.js');
const X_FAMS = ['x2', 'x5', 'x10', 'x3', 'x4', 'x6', 'x9', 'x7', 'x8', 'x11', 'x12'];
const D_FAMS = X_FAMS.map((f) => 'd' + f.slice(1));
// the kid who "ran out of races": every table family vouched (the check found × and the ÷ twins fluent)
const allTable = (t = T0) => { const d = defaultFacts(t); placedAt(d, Object.fromEntries([...X_FAMS, ...D_FAMS].map((f) => [f, 'fluent']))); refreshFrontier(d, t); return d; };
test('classification: ×10s / ÷10s / teens × / big × / big ÷ by precedence; table facts keep their table families', () => {
  assert.deepEqual(factFamilies('3x20'), ['x10s']); assert.equal(factFamily('3x20'), 'x10s'); assert.equal(F17.missFamily('3x20'), 'x10s');
  assert.deepEqual(factFamilies('20x30'), ['x10s']); assert.deepEqual(factFamilies('6x14'), ['xteen']); assert.equal(factFamily('6x14'), 'xteen');
  assert.deepEqual(factFamilies('4x23'), ['xbig']); assert.equal(F17.missFamily('4x23'), 'xbig');
  assert.deepEqual(factFamilies('60/20'), ['d10s']); assert.deepEqual(factFamilies('60/3'), ['d10s']); assert.deepEqual(factFamilies('240/8'), ['d10s']);
  assert.deepEqual(factFamilies('91/7'), ['dbig']); assert.deepEqual(factFamilies('171/9'), ['dbig']);
  for (const [f, fams] of [['3x12', ['x3', 'x12']], ['12x12', ['x12']], ['36/3', ['d3']], ['84/7', ['d7']], ['144/12', ['d12']], ['7x8', ['x7', 'x8']], ['8+7', ['add']], ['80-46', ['sub']]]) assert.deepEqual(factFamilies(f), fams, f);
  assert.equal(factFamily('2x8'), 'x2'); assert.equal(F17.missFamily('5x8'), 'x8', 'unchanged for the table');
  assert.equal(F17.highFamily('7x8'), ''); assert.equal(F17.highFamily('4x23'), 'xbig'); assert.equal(F17.highFamily('nope'), '');
  for (const fam of F17.HIGH_FAMILIES) for (const f of familyMembers(fam)) assert.equal(factFamily(f), fam, `${f} is ${fam}`);
  assert.equal(F17.twinFamily('d10s'), 'x10s'); assert.equal(F17.twinFamily('dbig'), 'xbig'); assert.equal(F17.twinFamily('d7'), 'x7'); assert.equal(F17.twinFamily('x7'), null);
  assert.equal(F17.divisionFamily('x10s'), 'd10s'); assert.equal(F17.divisionFamily('xteen'), null); assert.equal(F17.divisionFamily('x7'), 'd7'); assert.equal(F17.divisionFamily('xbig'), 'dbig');
  for (const f of ['x10s', 'd10s', 'xteen', 'xbig', 'dbig', 'x7', 'd12', 'add']) assert.ok(F17.isFamilyId(f), f);
  assert.ok(!F17.isFamilyId('x') && !F17.isFamilyId('dteen') && !F17.isFamilyId(''));
});
test('members: ×10s 40, ÷10s 80 (both twins), teens × 35, big × 24 (answers ≤ 999, 8 per decade), big ÷ 49 (quotients 13 … 19); canonical, none in the 12 × 12 grid', () => {
  const sizes = { x10s: 40, d10s: 80, xteen: 35, xbig: 24, dbig: 49 };
  for (const [fam, n] of Object.entries(sizes)) {
    const l = familyMembers(fam);
    assert.equal(l.length, n, fam); assert.equal(new Set(l).size, n, `${fam}: unique`);
    for (const f of l) { assert.equal(normFact(f), f, f); const p = F17.factParts(f); assert.ok(p.a > 12 || p.b > 12 || factAnswer(f) > 12, `${f} is above the table`); assert.ok(factAnswer(f) <= 999, f); }
  }
  assert.equal(F17.BIG_TIMES.length, 24);
  for (const dec of [20, 30, 40]) assert.equal(familyMembers('xbig').filter((f) => { const p = F17.factParts(f); const big = Math.max(p.a, p.b); return big >= dec && big < dec + 10; }).length, 8, `${dec}s`);
  assert.ok(familyMembers('xbig').every((f) => [3, 4, 6, 7, 8, 9].includes(Math.min(F17.factParts(f).a, F17.factParts(f).b))));
  for (const f of familyMembers('dbig')) { assert.ok(factAnswer(f) >= 13 && factAnswer(f) <= 19, f); assert.ok(F17.factParts(f).b >= 3 && F17.factParts(f).b <= 9, f); }
  const twins = new Set(familyMembers('x10s').flatMap(F17.divisionTwins));
  assert.deepEqual(familyMembers('d10s').slice().sort(), [...twins].sort(), '÷10s = both ÷ twins of every ×10s fact');
  assert.ok(familyMembers('xteen').every((f) => { const p = F17.factParts(f); return p.b >= 13 && p.b <= 19 && [3, 4, 6, 7, 8].includes(p.a); }));
  assert.ok(familyMembers('x10s').every((f) => { const p = F17.factParts(f); return p.b >= 20 && p.b <= 90 && p.b % 10 === 0 && [3, 4, 6, 7, 8].includes(p.a); }));
  assert.equal(ALL_FAMILIES.length, 11, 'the Parent Zone\'s × families are unchanged'); assert.equal(familyMembers('x7').length, 11); assert.deepEqual(familyMembers('nope'), []);
  assert.ok(familyMembers('x12').includes('3x12') && !familyMembers('xteen').includes('3x12'), '12 × 3 stays a ×12 fact');
  assert.ok(familyMembers('d7').includes('84/7') && !familyMembers('dbig').includes('84/7'), '84 ÷ 7 = 12 stays a ÷7 fact');
});
test('labels and names: ×10s ÷10s teens × big × big ÷ / tens, teens, big numbers; difficulty after ÷12 (×10s < ÷10s < teens × < big × < big ÷)', () => {
  assert.deepEqual(F17.HIGH_FAMILIES.map(F17.famLabel), ['×10s', '÷10s', 'teens ×', 'big ×', 'big ÷']);
  assert.deepEqual(F17.HIGH_FAMILIES.map(F17.famName), ['tens', 'tens ÷', 'teens', 'big numbers', 'big ÷']);
  assert.equal(F17.famName('x7'), '×7'); assert.equal(F17.famLabel('d7'), '÷7'); assert.equal(F17.famLabel('add'), '+');
  const maxTable = Math.max(...setFacts({ families: ALL_FAMILIES, division: true, addSub: true }).map((f) => difficulty(f)));
  const lo = (fam) => Math.min(...familyMembers(fam).map((f) => difficulty(f))), hi = (fam) => Math.max(...familyMembers(fam).map((f) => difficulty(f)));
  assert.ok(maxTable < lo('x10s'), `${maxTable} < ${lo('x10s')}`); assert.ok(hi('x10s') < lo('d10s')); assert.ok(hi('d10s') < lo('xteen')); assert.ok(hi('xteen') < lo('xbig')); assert.ok(hi('xbig') < lo('dbig'));
  assert.ok(difficulty('3x20') < difficulty('8x90'), 'smaller first within a family');
});
test('hints: the ×10 pattern, split the tens, ÷ by tens / to tens, two-digit quotients; spoken with no digits or symbols left', () => {
  assert.equal(hintFor('3x20', true), '2 × 3 = 6, so 20 × 3 = 60'); assert.equal(hintFor('3x20'), '2 × 3 = 6, so 3 × 20 = 60');
  assert.equal(hintFor('6x14', true), '14 × 6 = 10 × 6 + 4 × 6 = 60 + 24 = 84'); assert.equal(hintFor('6x14'), '6 × 14 = 6 × 10 + 6 × 4 = 60 + 24 = 84');
  assert.equal(hintFor('4x23', true), '23 × 4 = 20 × 4 + 3 × 4 = 80 + 12 = 92');
  assert.equal(hintFor('91/7'), '91 ÷ 7: 70 ÷ 7 = 10, 21 ÷ 7 = 3, so 91 ÷ 7 = 13'); assert.equal(hintFor('171/9'), '171 ÷ 9: 90 ÷ 9 = 10, 81 ÷ 9 = 9, so 171 ÷ 9 = 19');
  assert.equal(hintFor('60/20'), '60 ÷ 20 = 3 because 20 × 3 = 60'); assert.equal(hintFor('60/3'), '6 ÷ 3 = 2, so 60 ÷ 3 = 20');
  assert.equal(hintFor('84/7'), '7 × ? = 84. 7 × 12 = 84, so 84 ÷ 7 = 12', 'a table fact keeps its hint'); assert.match(hintFor('7x8'), /7 × 7 is 49/); assert.match(hintFor('7x12'), /10 × 7 is 70, plus 2 × 7 is 14: 84/);
  assert.equal(hintSpoken('3x20', true), 'two times three equals six, so twenty times three equals sixty.');
  assert.equal(hintSpoken('91/7'), 'ninety-one divided by seven: seventy divided by seven equals ten, twenty-one divided by seven equals three, so ninety-one divided by seven equals thirteen.');
  assert.equal(hintSpoken('60/20'), 'sixty divided by twenty equals three because twenty times three equals sixty.');
  for (const fam of F17.HIGH_FAMILIES) for (const f of familyMembers(fam)) for (const flip of [false, true]) {
    const s = hintSpoken(f, flip);
    assert.ok(s.length > 5 && !/[\d×÷−?]/.test(s), `${f}: ${s}`); assert.ok(new RegExp(`\\b${factAnswer(f)}\\b`).test(hintFor(f, flip)), `${f}: names the answer`);
  }
});
test('patterns: place-value slips (a zero dropped or added, the ones forgotten, parts side by side, half a quotient) get their own kind, hint and report line', () => {
  for (const [f, g] of [['3x20', 6], ['3x20', 600], ['6x14', 60], ['6x14', 64], ['6x14', 624], ['6x14', 6024], ['4x23', 80], ['4x23', 83], ['4x23', 812], ['91/7', 3], ['91/7', 10], ['60/3', 2], ['60/3', 200]]) assert.equal(classifyMiss(f, g), 'place-value', `${f} → ${g}`);
  assert.equal(classifyMiss('7x8', 48), 'off-by-operand', 'table facts as before'); assert.equal(classifyMiss('3x12', 3), 'random'); assert.equal(classifyMiss('3x20', 66), 'adjacent'); assert.equal(classifyMiss('3x20', 60), null);
  assert.equal(patternHint('6x14', true, 'place-value', 64), 'watch the tens and ones: 14 × 6 = 10 × 6 + 4 × 6 = 60 + 24 = 84');
  assert.equal(hintKind('3x20', 6), 'place-value');
  const d = defaultFacts(T0);
  recordAnswer(d, '3x20', { correct: false, given: 6 }, T0); recordAnswer(d, '4x23', { correct: false, given: 83 }, T0 + 1);
  assert.ok(patternSummary(d, T0 + 2).some((x) => x.kind === 'place-value' && /tens and ones/.test(x.text)), JSON.stringify(patternSummary(d, T0 + 2)));
  assert.deepEqual(normalizeFacts(JSON.parse(JSON.stringify(d)), T0 + 3).records['3x20'].patterns.map((x) => x.kind), ['place-value'], 'the kind survives a save');
});
test('ladder and tiers: ×10s ÷10s 8 · teens × 9 · big × big ÷ 10 after ÷12; without "÷ too" the ÷ families stay off; the step back of each', () => {
  const L = A17.ladder({ division: true });
  assert.deepEqual(L.slice(-5), ['x10s', 'd10s', 'xteen', 'xbig', 'dbig']); assert.ok(L.indexOf('d12') < L.indexOf('x10s'));
  assert.deepEqual(A17.ladder({ division: false }).slice(-3), ['x10s', 'xteen', 'xbig']); assert.ok(!A17.ladder({ division: false }).includes('d10s'));
  assert.deepEqual(A17.ladder({ addSub: true }).slice(0, 3), ['add', 'sub', 'x2']);
  assert.deepEqual(['x10s', 'd10s', 'xteen', 'xbig', 'dbig', 'x12', 'd12', 'd2', 'add', 'nope'].map(A17.tierOf), [8, 8, 9, 10, 10, 5, 7, 6, 0, 99]);
  assert.deepEqual(A17.tierFamilies(8), ['x10s', 'd10s']); assert.deepEqual(A17.tierFamilies(10), ['xbig', 'dbig']); assert.deepEqual(A17.tierFamilies(9, { division: false }), ['xteen']);
  assert.deepEqual(P17.HIGH_TIERS, ['T8', 'T9', 'T10']); assert.deepEqual(TIERS.find((t) => t.id === 'T8').families, ['x10s', 'd10s']); assert.deepEqual(TIERS.find((t) => t.id === 'T9').families, ['xteen']); assert.deepEqual(TIERS.find((t) => t.id === 'T10').families, ['xbig', 'dbig']);
  assert.deepEqual(['T8', 'T9', 'T10', 'T4', 'T0'].map(P17.tierName), ['tens', 'teens', 'big numbers', '×7 ×8', '+ and −']);
  assert.deepEqual(['x10s', 'xteen', 'xbig', 'd10s', 'dbig', 'd7'].map(G17.stepBackTo), ['x10', 'x12', 'xteen', 'x10s', 'xbig', 'x7']);
});
test('the frontier climbs into ×10s once every table family is secure; scouts go T8 → T9 → T10; the stretch is the tier after the scout\'s; ÷10s joins once ×10s is known', () => {
  const d = allTable();
  assert.deepEqual(d.frontier.families, ['x10s', 'xteen'], `the frontier: ${d.frontier.families} (${d.frontier.reason})`);
  assert.equal(scoutFamily(d, T0), 'xteen', 'the scout family: the next tier up (÷10s waits for ×10s to be known)');
  assert.deepEqual(H17.stretchFamilies(d, 9, T0), ['xbig'], 'the stretch: the tier after the scout\'s (big ÷ waits for big ×)');
  assert.deepEqual(H17.stretchFamilies(d, 10, T0), [], 'nothing above the top');
  familyMembers('xteen').slice(0, 3).forEach((f, i) => recordAnswer(d, f, { correct: true, quick: true, ms: 900, scout: 'xteen' }, T0 + i));
  assert.ok(d.vouched.xteen, '3 quick scouts vouch teens ×');
  assert.equal(scoutFamily(d, T0 + 10), 'xbig', 'teens vouched: big × next');
  assert.ok(!d.frontier.families.includes('xteen'), `teens × left the frontier: ${d.frontier.families}`);
  gateStream(d, familyMembers('x10s').map((f) => [f, true, true]), T0 + 100);
  const t = T0 + 100 + 40 * 1000;
  assert.ok(famInfo(d, 'x10s', t).secure, '×10s secure by the same rule'); assert.ok(!d.frontier.families.includes('x10s'), `moved on: ${d.frontier.families}`);
  assert.ok(d.frontier.families.includes('d10s'), `÷10s joins once ×10s is known: ${d.frontier.families}`);
  assert.ok(A17.autoFamilies(d, t).includes('d10s') && A17.autoFamilies(d, t).includes('x10s'));
  const sl = startLine(d, { scout: scoutFamily(d, t) });
  assert.match(sl.text, /Working on: ÷10s big ×/); assert.match(sl.text, /Up next: /);
  const w = PG.weekProgress(d, t);
  assert.equal(w.ladderFamilies, 27); assert.ok(w.secureFamilies >= 24, `${w.secureFamilies} secure`);
  assert.ok(nextFact(d, t, createSession(), lcg(2)).fact.length > 2, 'a gate fact comes from the active set');
  assert.ok(!checkDue(d, t).due, 'the frontier above T5 is no reason for a re-check');
});
test('Pit Crew Check: T8 … T10 open once ×11 ×12 are known; a fluent kid climbs from T5 into T10 (tens, teens, big numbers) in ≤ 24 items; placement survives a save', () => {
  assert.deepEqual(tiersFor({ division: true }), ['T1', 'T2', 'T3', 'T4', 'T5'], 'without a store: as before');
  assert.deepEqual(tiersFor({ division: true }, defaultFacts(T0), T0), ['T1', 'T2', 'T3', 'T4', 'T5'], 'a new kid: no high tiers');
  assert.ok(!P17.highTiersOpen(null));
  const d = allTable();
  assert.ok(P17.highTiersOpen(d, T0));
  const tiers = tiersFor({ division: true }, d, T0);
  assert.deepEqual(tiers, ['T1', 'T2', 'T3', 'T4', 'T5', 'T8', 'T9', 'T10']); assert.equal(tiersFor({ division: true, addSub: true }, d, T0)[0], 'T0');
  const st = runCheck(() => QUICK, { tiers, start: 'T5' });
  assert.deepEqual(st.items.filter((x) => x.phase === 'locate').map((x) => x.tier), ['T5', 'T5', 'T8', 'T8', 'T9', 'T10', 'T10'], 'up the staircase (T9 has one family)');
  assert.ok(st.items.length <= MAX_ITEMS, `${st.items.length} items`); assert.equal(new Set(st.items.map((x) => x.fact)).size, st.items.length, 'no fact twice');
  for (const it of st.items) assert.ok(familyMembers(it.family).includes(it.fact), `${it.fact} is a ${it.family} fact`);
  assert.ok(!st.items.some((x) => x.phase === 'twins' && ['d10s', 'dbig'].includes(x.family)), '÷10s / big ÷ are asked in their tiers, not as twins');
  assert.ok(st.items.some((x) => x.phase === 'twins' && x.family === 'd11'), 'the table twins still come');
  const pl = checkResult(st, T0);
  assert.equal(pl.located, 'T10'); assert.equal(pl.tier, 'T10');
  for (const f of ['x10s', 'd10s', 'xteen', 'xbig', 'dbig']) assert.equal(pl.families[f].status, 'fluent', f);
  assert.ok(pl.tiers.some((t) => t.tier === 'T10' && t.result === 'fluent'));
  const e = allTable(); applyCheck(e, st, T0 + 5);
  const n = normalizeFacts(JSON.parse(JSON.stringify(e)), T0 + 6);
  assert.equal(n.placement.tier, 'T10'); assert.equal(n.placement.located, 'T10'); assert.equal(n.placement.families.xbig.status, 'fluent'); assert.ok(n.placement.tiers.some((t) => t.tier === 'T10'));
  assert.deepEqual(normalizeFacts(JSON.parse(JSON.stringify(n)), T0 + 7), n);
  assert.equal(recheckStart({ frontier: { families: ['xteen'] } }), 'T9'); assert.equal(recheckStart({ frontier: { families: ['d10s'] } }), 'T8');
  // a kid who misses the tens lands at T5 and zooms T5 / T8: the work starts at T8
  const m = runCheck((it) => (it.tier === 'T8' ? MISS(it) : QUICK), { tiers, start: 'T5' });
  const pm = checkResult(m, T0);
  assert.equal(pm.located, 'T5'); assert.equal(pm.tier, 'T8'); assert.equal(pm.families.x10s.status, 'shaky');
  assert.ok(answersFor(m, 'x10s') >= 2 && answersFor(m, 'd10s') >= 2, 'both T8 families zoomed');
  assert.ok(m.items.length <= MAX_ITEMS);
  // without "÷ too" the check never asks ÷10s / big ÷
  const nd = runCheck(() => QUICK, { tiers: tiersFor({ division: false }, d, T0), start: 'T5', division: false });
  assert.ok(!nd.items.some((x) => x.fact.includes('/')), 'no ÷ at all'); assert.ok(nd.items.some((x) => x.family === 'xbig'));
  const low = runCheck((it) => MISS(it), { tiers, start: 'T5' });
  assert.ok(low.items.length <= MAX_ITEMS); assert.equal(checkResult(low, T0).located, 'T1');
});
test('hillFacts: 10 questions, no fact twice, 4 frontier + 4 scouts + 2 stretch (the tier after the scout\'s) with the stretch up the hill; seeded = repeatable', () => {
  const d = defaultFacts(T0);
  placedAt(d, { x2: 'fluent', x5: 'fluent', x10: 'fluent', x3: 'known', x4: 'known', x6: 'untested', x9: 'untested' });
  assert.deepEqual(d.frontier.families, ['x3', 'x4']); assert.equal(scoutFamily(d, T0), 'x6');
  const list = S17.hillFacts(d, 10, T0, lcg(5));
  assert.equal(list.length, 10); assert.equal(new Set(list.map((p) => p.fact)).size, 10);
  const kinds = (k) => list.filter((p) => p.kind === k);
  assert.equal(kinds('frontier').length, 4); assert.equal(kinds('scout').length, 4); assert.equal(kinds('stretch').length, 2);
  const active = activeFacts(d, T0);
  for (const p of kinds('frontier')) assert.ok(active.includes(p.fact), `${p.fact}: a gate fact`);
  for (const p of kinds('scout')) { assert.equal(p.family, 'x6'); assert.ok(familyMembers('x6').includes(p.fact)); assert.ok(p.isNew); }
  for (const p of kinds('stretch')) { assert.ok(['x7', 'x8'].includes(p.family), `${p.family}: the tier after ×6`); assert.ok(familyMembers(p.family).includes(p.fact)); }
  assert.ok(list.slice(0, 4).every((p) => p.kind !== 'stretch'), 'the stretch facts come in the upper half');
  for (const p of list) { assert.equal(typeof p.flip, 'boolean'); if (p.flip) assert.ok(isCommutative(p.fact)); }
  assert.deepEqual(S17.hillFacts(d, 10, T0, lcg(5)).map((p) => p.fact), list.map((p) => p.fact), 'the same seed, the same climb');
  assert.notDeepEqual(S17.hillFacts(d, 10, T0, lcg(6)).map((p) => p.fact), list.map((p) => p.fact));
  assert.equal(S17.hillFacts(d, 5, T0, lcg(1)).length, 5); assert.deepEqual(S17.HILL_MIX, { frontier: 0.4, scout: 0.4, stretch: 0.2 });
  // a secure kid: scouts from teens ×, the stretch from big × (the hard tiers are met here first)
  const s = allTable();
  const l2 = S17.hillFacts(s, 10, T0, lcg(4));
  assert.equal(l2.length, 10); assert.equal(new Set(l2.map((p) => p.fact)).size, 10);
  assert.ok(l2.filter((p) => p.kind === 'scout').every((p) => p.family === 'xteen'), JSON.stringify(l2));
  assert.deepEqual(l2.filter((p) => p.kind === 'stretch').map((p) => p.family), ['xbig', 'xbig']);
  assert.ok(l2.filter((p) => p.kind === 'frontier').every((p) => familyMembers('x10s').includes(p.fact) || familyMembers('xteen').includes(p.fact)), 'the frontier: ×10s / teens ×');
  // everything secure, the top tier included: the top tier's facts (the least asked, then the least recent)
  const top = allTable(); top.vouched = { ...top.vouched, ...Object.fromEntries(F17.HIGH_FAMILIES.map((f) => [f, T0 - DAY_MS])) }; refreshFrontier(top, T0);
  assert.equal(scoutFamily(top, T0), null);
  const l3 = S17.hillFacts(top, 10, T0, lcg(3));
  assert.equal(l3.length, 10); assert.equal(new Set(l3.map((p) => p.fact)).size, 10);
  assert.ok(l3.filter((p) => p.kind === 'stretch').every((p) => ['xbig', 'dbig'].includes(p.family)), `the top tier: ${JSON.stringify(l3)}`);
  assert.equal(l3.filter((p) => p.kind === 'stretch').length, 5, 'half the climb'); assert.equal(l3.filter((p) => p.kind === 'frontier').length, 5);
  // a scout miss at the gates moved the scouts two tiers above the frontier's lowest tier: the hill does not follow (more frontier facts instead)
  const far = allTable(); noteScout(far, 'xteen', false, false, T0);
  assert.equal(scoutFamily(far, T0), 'xbig', 'the gates scout big × now'); assert.deepEqual(far.frontier.families, ['x10s', 'xteen']);
  const l5 = S17.hillFacts(far, 10, T0, lcg(7));
  assert.equal(l5.filter((p) => p.kind === 'scout').length, 0, 'no scouts two tiers above ×10s'); assert.equal(l5.filter((p) => p.kind === 'stretch').length, 2);
  assert.ok(l5.filter((p) => p.kind === 'stretch').every((p) => p.family === 'xbig'), 'the stretch: the tier above the frontier');
  assert.equal(l5.filter((p) => p.kind === 'frontier').length, 8);
  // a manual set (the parent picked ×7 only): the climb is the set alone
  const man = defaultFacts(T0); man.sets.mode = 'manual'; man.sets.families = ['x7']; man.sets.division = false;
  const l4 = S17.hillFacts(man, 10, T0, lcg(2));
  assert.equal(l4.length, 10); assert.equal(new Set(l4.map((p) => p.fact)).size, 10);
  assert.ok(l4.every((p) => p.kind === 'frontier' && familyMembers('x7').includes(p.fact)), JSON.stringify(l4));
  // a tiny custom list: the climb fills from the ladder's open families (never short, never a fact twice)
  const tiny = defaultFacts(T0); tiny.sets.mode = 'manual'; tiny.sets.source = 'custom'; tiny.sets.custom = ['7x8', '6x7'];
  const l6 = S17.hillFacts(tiny, 10, T0, lcg(8));
  assert.equal(l6.length, 10); assert.equal(new Set(l6.map((p) => p.fact)).size, 10);
});
test('recordHillAnswer: frontier → the record (XP, today\'s count); a scout miss counts; a stretch miss is not a scout miss; 3 quick-right stretch answers vouch the family', () => {
  const d = defaultFacts(T0);
  placedAt(d, { x2: 'fluent', x5: 'fluent', x10: 'fluent', x3: 'known', x4: 'known', x6: 'untested', x9: 'untested' });
  const list = S17.hillFacts(d, 10, T0, lcg(9));
  const fr = list.find((p) => p.kind === 'frontier');
  const r = S17.recordHillAnswer(d, fr, { correct: true, quick: true, answeredMs: 1200 }, T0 + 1);
  assert.equal(r.xp, XP.firstTry + XP.quick); assert.equal(d.records[fr.fact].attempts, 1); assert.equal(d.records[fr.fact].lastMs, 1200); assert.equal(d.today.count, 1); assert.equal(r.status, 'Learning');
  const st = list.filter((p) => p.kind === 'stretch');
  S17.recordHillAnswer(d, st[0], { correct: false, given: 1, answeredMs: 4000 }, T0 + 2);
  assert.ok(!(d.scouts[st[0].family] && d.scouts[st[0].family].miss), 'a stretch miss is not a scout miss'); assert.equal(d.records[st[0].fact].misses, 1, 'but it is on the record');
  const fam = st[0].family;
  const facts = familyMembers(fam).filter((f) => f !== st[0].fact).slice(0, 3);
  let res = null;
  facts.forEach((f, i) => { res = S17.recordHillAnswer(d, { fact: f, kind: 'stretch', family: fam, flip: false }, { correct: true, quick: true, answeredMs: 900 }, T0 + 10 + i); });
  assert.equal(res.vouched, fam, '3 quick-right stretch answers vouch the family'); assert.ok(d.vouched[fam] > 0); assert.ok(famInfo(d, fam, T0 + 20).vouched);
  const sc = list.find((p) => p.kind === 'scout');
  S17.recordHillAnswer(d, sc, { correct: false, given: 2 }, T0 + 20);
  assert.equal(d.scouts[sc.family].miss, 1, 'a scout miss counts as at the gates'); assert.equal(d.records[sc.fact].misses, 1);
  const sc2 = list.filter((p) => p.kind === 'scout')[1];
  const r2 = S17.recordHillAnswer(d, sc2, { correct: true, quick: false, ms: 5200 }, T0 + 21);
  assert.equal(d.scouts[sc.family].asked, 2); assert.equal(r2.xp, XP.firstTry); assert.equal(d.records[sc2.fact].lastMs, 5200, 'ms works as well as answeredMs');
  assert.equal(S17.recordHillAnswer(d, null, {}, T0), null);
  assert.deepEqual(normalizeFacts(JSON.parse(JSON.stringify(d)), T0 + 30).vouched, d.vouched);
});
test('old saves normalize unchanged: a v1.6 store (8 tiers, table families only) keeps its keys and round-trips; new-tier keys survive too', () => {
  const v16 = { v: 4, sets: { mode: 'auto', families: STOCK_FAMILIES, division: true, custom: [] }, records: { '7x8': { box: 2, seenCount: 3, attempts: 3, firstTry: 2, times: [900] } },
    placement: { at: T0, checks: 1, tier: 'T4', located: 'T3', families: { x2: { status: 'fluent' }, x7: { status: 'shaky' }, d7: { status: 'untested' } }, tiers: [{ tier: 'T3', asked: 2, correct: 2, quick: 2, result: 'fluent' }] },
    frontier: { families: ['x7', 'x8'], since: T0, reason: 'x' }, scouts: { x11: { asked: 1, quick: 1, miss: 0 } }, vouched: { x2: T0 - 1 } };
  const d = normalizeFacts(JSON.parse(JSON.stringify(v16)), T0);
  assert.deepEqual(Object.keys(d.placement.families).sort(), ['d7', 'x2', 'x7']); assert.equal(d.placement.tier, 'T4'); assert.equal(d.placement.located, 'T3');
  assert.deepEqual(d.frontier.families, ['x7', 'x8']); assert.deepEqual(d.scouts, { x11: { asked: 1, quick: 1, miss: 0 } }); assert.deepEqual(d.vouched, { x2: T0 - 1 });
  assert.deepEqual(Object.keys(d.records), ['7x8']);
  assert.deepEqual(normalizeFacts(JSON.parse(JSON.stringify(d)), T0 + 1), d, 'round-trips');
  assert.deepEqual(normalizeFacts(JSON.parse(JSON.stringify(S17.compactFacts(d))), T0 + 1), d, 'and in the storage form');
  d.vouched.xteen = T0; d.scouts.xbig = { asked: 2, quick: 2, miss: 0 }; d.pulled = { dbig: T0 }; d.stepped = { xbig: { at: T0, back: 'xteen' } }; d.frontier.families = ['x10s', 'd10s'];
  const n = normalizeFacts(JSON.parse(JSON.stringify(d)), T0 + 1);
  assert.equal(n.vouched.xteen, T0); assert.deepEqual(n.scouts.xbig, { asked: 2, quick: 2, miss: 0 }); assert.equal(n.pulled.dbig, T0); assert.deepEqual(n.stepped.xbig, { at: T0, back: 'xteen' }); assert.deepEqual(n.frontier.families, ['x10s', 'd10s']);
  assert.equal(normalizeFacts({ placement: { at: T0, families: {}, tier: 'T11' } }, T0).placement.tier, null, 'no such tier');
  assert.deepEqual(resetFacts(n, T0 + 2).vouched, {});
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('ALL FACTS TESTS PASSED');

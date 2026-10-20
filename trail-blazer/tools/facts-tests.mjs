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
import { noteScout, recheckStart, scoutFact, scoutFamily } from '../src/facts/scouts.js';
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

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('ALL FACTS TESTS PASSED');

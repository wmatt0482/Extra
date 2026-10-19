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
import { createUpdateGuard, safeToReload } from '../src/meta/selfUpdate.js';
import { medalFor, medalTimesFor, fmtTime, ordinal } from '../src/data/medals.js';

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
test('custom facts join the week\'s set', () => { const d = defaultFacts(T0); d.sets.custom = ['19+34', '80-46']; assert.ok(activeFacts(d).includes('19+34') && activeFacts(d).includes('80-46')); });

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
  const d = defaultFacts(T0);
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

console.log('\nmedals + self-update');
test('medal times from MEDAL_TIMES (object or array) with a fallback; medalFor', () => {
  const t = medalTimesFor({ id: 'p', length: 600 }, { p: { gold: 30, silver: 34, bronze: 38 } });
  assert.deepEqual(t, { gold: 30, silver: 34, bronze: 38 }); assert.deepEqual(medalTimesFor({ id: 'p' }, { p: [1, 2, 3] }), { gold: 1, silver: 2, bronze: 3 });
  assert.ok(medalTimesFor({ id: 'q', length: 600 }, {}).gold > 0);
  assert.equal(medalFor(29.9, t), 'gold'); assert.equal(medalFor(34, t), 'silver'); assert.equal(medalFor(38, t), 'bronze'); assert.equal(medalFor(39, t), null);
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

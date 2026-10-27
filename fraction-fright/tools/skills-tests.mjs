// Unit tests for Fraction Fright's math layer and app rules (plain Node asserts, no framework, no browser):
//   node fraction-fright/tools/skills-tests.mjs
// Covers: items (CCSS grade-4 denominators, spoken names, the bounce scaffold, waves of 8-12 with the big 3rd and the
// final 5th, review items, never the same fraction twice in a row), the result bands (bull 1.5 % / hit ≤ tolerance /
// near ≤ 2× / miss) and "N % close", the tolerance steps 10 / 5 / 3 %, the ladder (states, secure and the slip, the
// unlock rule: the Lab opens Maple Street, a working street opens the next and an opened street stays open, the ★),
// the store (recordThrow, finishLab, normalize of junk, resets), the week's progress, the cash rows (they add up; bull,
// close-then-cured and final ×2), banking a wave (next wave, cleared, pumpkin, the Cure Counter), the yard, the save
// normalize, and the sync merge rules for the save ('ff') and the skills ('fracs').
import assert from 'node:assert/strict';
import * as I from '../src/skills/items.js';
import * as L from '../src/skills/ladder.js';
import * as S from '../src/skills/store.js';
import { weekProgress, weekProgressLines } from '../src/skills/progress.js';
import * as E from '../src/meta/economy.js';
import { defaultSave, normalize as normalizeSave } from '../src/meta/save.js';
import { mergeFf, mergeFracs } from '../src/skills/sync.js';

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failures.push(name); console.log('  ✗ ' + name + '\n      ' + String(e && e.message).split('\n').join('\n      ')); }
}
const T0 = new Date(2026, 9, 26, 16, 0, 0).getTime();
const DAY = 86400000;
const throwN = (d, tier, kind, results, at = T0, pae = 2) => results.forEach((r, i) => S.recordThrow(d, { tier, kind, show: tier === 'T1' ? '3/4' : '2/3', pae: r === 'miss' ? 30 : r === 'near' ? 15 : pae, result: r, at: at + i * 1000 }));
const labbed = () => { const d = S.defaultSkills(); S.finishLab(d, T0 - DAY); return d; };

console.log('items: fractions, names, the scaffold');
test('denominators are CCSS grade 4 only: 2, 3, 4, 5, 6, 8, 10, 12, 100', () => {
  assert.deepEqual([...I.DENOMS], [2, 3, 4, 5, 6, 8, 10, 12, 100]);
  for (const t of I.PLAYABLE) for (const f of I.fractionsOf(t, { more: true })) assert.ok(I.DENOMS.includes(f.d), `${f.n}/${f.d}`);
});
test('Maple Street asks halves and quarters; Oak Lane thirds, sixths, eighths, then fifths, tenths, twelfths; ½ only as 1/2 or 2/4', () => {
  assert.deepEqual(I.fractionsOf('T1').map((f) => `${f.n}/${f.d}`), ['1/2', '1/4', '2/4', '3/4']);
  const t2 = I.fractionsOf('T2').map((f) => `${f.n}/${f.d}`);
  assert.ok(t2.includes('2/3') && t2.includes('5/6') && t2.includes('7/8'));
  assert.ok(!t2.includes('3/6') && !t2.includes('4/8'), 'no other spelling of ½');
  assert.ok(!t2.some((x) => x.endsWith('/5') || x.endsWith('/10') || x.endsWith('/12')), 'fifths, tenths, twelfths wait');
  const more = I.fractionsOf('T2', { more: true }).map((f) => `${f.n}/${f.d}`);
  assert.ok(more.includes('3/5') && more.includes('7/10') && more.includes('5/12') && !more.includes('5/10') && !more.includes('6/12'));
  assert.deepEqual(I.fractionsOf('T3'), [], 'later tiers are not playable in 1.0');
});
test('spoken names: "three quarters", "one half", "five twelfths", "forty-two hundredths"', () => {
  assert.equal(I.fracName(3, 4), 'three quarters');
  assert.equal(I.fracName(1, 2), 'one half');
  assert.equal(I.fracName(1, 3), 'one third');
  assert.equal(I.fracName(5, 12), 'five twelfths');
  assert.equal(I.fracName(42, 100), 'forty-two hundredths');
  assert.equal(I.numberWord(99), 'ninety-nine');
});
test('an item: the engine shape; bounce carries the unit jumps (¾ = three hops of ¼)', () => {
  const it = I.makeItem({ n: 3, d: 4 }, { kind: 'bounce', tolerance: 0.1, id: 'w1-1' });
  assert.deepEqual(it, { id: 'w1-1', kind: 'bounce', say: 'three quarters', show: '3/4', target: 0.75, n: 3, d: 4, tier: 'T1', tolerance: 0.1, hints: ['arrow', 'ticks'], jumps: { unit: 0.25, count: 3 } });
  assert.equal(I.makeItem({ n: 2, d: 3 }).jumps, undefined, 'locate has no jumps');
  assert.equal(I.makeItem({ n: 2, d: 3 }).tier, 'T2');
});
test('the road: 0–1 with 0, ½ and 1 always labelled; no fine ticks up front', () => {
  const r = I.roadFor('T1');
  assert.equal(r.from, 0); assert.equal(r.to, 1);
  assert.deepEqual(r.labels.map((l) => [l.at, l.text]), [[0, '0'], [0.5, '½'], [1, '1']]);
  assert.deepEqual(r.ticks, []);
});
test('sayTexts: the finite set the natural voice prepares (every 1.0 fraction, with a period)', () => {
  const t = I.sayTexts();
  assert.ok(t.includes('three quarters.') && t.includes('seven twelfths.') && t.includes('one half.'));
  assert.equal(new Set(t).size, t.length);
  assert.ok(t.length >= 30 && t.length <= 120, `${t.length} texts`);
});

console.log('waves');
test('5 waves of 8-12: sizes 8, 9, 10, 10, 12 (+ the boss on the 5th); the 3rd is big, the 5th final; live 2, 2, 4, 3, 3', () => {
  const rng = I.rngFrom(7);
  const sizes = [1, 2, 3, 4, 5].map((n) => I.buildWave({ tier: 'T1', number: n, rng }));
  assert.deepEqual(sizes.map((w) => w.items.length), [8, 9, 10, 10, 13]);
  assert.deepEqual(sizes.map((w) => w.size), [8, 9, 10, 10, 12]);
  assert.deepEqual(sizes.map((w) => w.live), [2, 2, 4, 3, 3]);
  assert.deepEqual(sizes.map((w) => [w.big, w.final]), [[false, false], [false, false], [true, false], [false, false], [false, true]]);
  assert.equal(sizes[4].items.at(-1).kind, 'boss');
  assert.ok(sizes.slice(0, 4).every((w) => w.items.every((x) => x.kind !== 'boss')), 'a boss only on the final wave');
});
test('twins: one pair from wave 2 on, adjacent, at the same spot, twin ids cross-linked; none on wave 1', () => {
  assert.deepEqual(I.twinPairs('T1').map((p) => p.map((f) => `${f.n}/${f.d}`)), [['1/2', '2/4']]);
  assert.deepEqual(I.twinPairs('T2').map((p) => p.map((f) => `${f.n}/${f.d}`)), [['1/3', '2/6'], ['2/3', '4/6']]);
  assert.equal(I.buildWave({ tier: 'T1', number: 1, rng: I.rngFrom(3) }).items.filter((x) => x.twin).length, 0);
  for (let seed = 1; seed < 30; seed++) for (const tier of ['T1', 'T2']) {
    const w = I.buildWave({ tier, number: 2 + (seed % 4), reviewTier: tier === 'T2' ? 'T1' : null, rng: I.rngFrom(seed) });
    const tw = w.items.filter((x) => x.twin);
    assert.equal(tw.length, 2, `${tier} seed ${seed}`);
    const [a, b] = tw;
    assert.equal(w.items.indexOf(b), w.items.indexOf(a) + 1, 'adjacent');
    assert.ok(w.items.indexOf(a) >= 2, 'never in the first two');
    assert.equal(a.twin, b.id); assert.equal(b.twin, a.id);
    assert.ok(Math.abs(a.target - b.target) < 1e-9 && a.show !== b.show, 'the same spot, two spellings');
    assert.ok(a.kind === 'locate' && b.kind === 'locate');
    const before = w.items[w.items.indexOf(a) - 1];
    assert.ok(Math.abs(before.target - a.target) > 1e-9, 'the fraction before the pair is elsewhere');
  }
});
test('the boss: three forms of the same number (symbol, words, unit sum), 3 hits, a name per street; the voice knows the forms', () => {
  const b = I.makeBoss({ n: 3, d: 4 }, { name: 'Mayor Mumbles', tolerance: 0.1, id: 'w5-boss' });
  assert.equal(b.kind, 'boss'); assert.equal(b.hits, 3); assert.equal(b.name, 'Mayor Mumbles'); assert.equal(b.target, 0.75); assert.equal(b.tier, 'T1');
  assert.deepEqual(b.forms, [{ show: '3/4', say: 'three quarters' }, { show: 'three quarters', say: 'three quarters' }, { show: '¼+¼+¼', say: 'one quarter plus one quarter plus one quarter' }]);
  assert.equal(b.show, '3/4'); assert.equal(b.say, 'three quarters');
  assert.deepEqual(I.makeBoss({ n: 2, d: 3 }).forms[2], { show: '⅓+⅓', say: 'one third plus one third' });
  const w5 = I.buildWave({ tier: 'T2', number: 5, rng: I.rngFrom(9) });
  assert.equal(w5.items.at(-1).name, 'Coach Groan');
  assert.equal(I.buildWave({ tier: 'T1', number: 5, rng: I.rngFrom(9) }).items.at(-1).name, 'Mayor Mumbles');
  assert.ok(I.sayTexts().includes('one quarter plus one quarter plus one quarter.'));
});
test('never the same fraction twice in a row (twins excepted: two spellings); ids unique; the scaffold early, plain locate when secure', () => {
  for (let seed = 1; seed < 40; seed++) {
    const w = I.buildWave({ tier: 'T1', number: 5, rng: I.rngFrom(seed) });
    for (let i = 1; i < w.items.length; i++) assert.notEqual(w.items[i].show, w.items[i - 1].show, `seed ${seed}`);
    assert.equal(new Set(w.items.map((x) => x.id)).size, w.items.length);
  }
  const all = (state) => Array.from({ length: 30 }, (_, s) => I.buildWave({ tier: 'T1', number: 2, state, rng: I.rngFrom(s + 1) }).items).flat();
  const share = (state) => all(state).filter((x) => x.kind === 'bounce').length / all(state).length;
  assert.ok(share('new') > 0.55, `new: ${share('new')}`);
  assert.ok(share('working') < 0.45 && share('working') > 0.1, `working: ${share('working')}`);
  assert.equal(share('secure'), 0);
  assert.ok(all('working').every((x) => x.tolerance === 0.05) && all('secure').every((x) => x.tolerance === 0.03) && all('new').every((x) => x.tolerance === 0.1));
});
test('Oak Lane mixes in spaced review from Maple Street (about 20 %, never in the first two, not on wave 1)', () => {
  const w = I.buildWave({ tier: 'T2', number: 2, reviewTier: 'T1', reviewState: 'secure', rng: I.rngFrom(3) });
  const rev = w.items.filter((x) => x.tier === 'T1');
  assert.equal(rev.length, 2);
  assert.ok(w.items.slice(0, 2).every((x) => x.tier === 'T2'));
  assert.ok(rev.every((x) => x.tolerance === 0.03), 'review items play at their own tier\'s tolerance');
  assert.equal(I.buildWave({ tier: 'T2', number: 1, reviewTier: 'T1', rng: I.rngFrom(3) }).items.filter((x) => x.tier === 'T1').length, 0);
});

console.log('result bands, PAE, tolerance');
test('bull ≤ 1.5 % of the road, hit ≤ tolerance, near ≤ 2 × tolerance, else miss', () => {
  assert.equal(I.classify(0.015, 0.1), 'bull');
  assert.equal(I.classify(0.016, 0.1), 'hit');
  assert.equal(I.classify(0.1, 0.1), 'hit');
  assert.equal(I.classify(0.101, 0.1), 'near');
  assert.equal(I.classify(-0.2, 0.1), 'near');
  assert.equal(I.classify(0.21, 0.1), 'miss');
  assert.equal(I.classify(0.04, 0.03), 'near');
  assert.equal(I.classify(NaN, 0.1), 'miss');
});
test('PAE = |aimed − target| / road length × 100; "N % close" never below 0, always positive wording', () => {
  assert.equal(I.paeOf(0.6, 0.75), 15);
  assert.equal(I.paeOf(1.5, 1.25, { from: 0, to: 3 }), 8.3);
  assert.equal(I.closeText(8.3), '92 % close');
  assert.equal(I.closeText(140), '0 % close');
  for (const r of ['bull', 'hit', 'near', 'miss']) assert.ok(!/wrong|miss|fail/i.test(I.resultWords(r, 12)), r);
});
test('tolerance steps: 10 % to start, 5 % when working, 3 % when secure', () => {
  assert.deepEqual([I.toleranceFor('new'), I.toleranceFor('practice'), I.toleranceFor('working'), I.toleranceFor('secure')], [0.1, 0.1, 0.05, 0.03]);
});

console.log('the ladder');
test('states: new → practice → working (≥ 6 throws, ≥ 60 % on target) → secure (≥ 8 plain throws, ≥ 80 %, PAE ≤ 2.5)', () => {
  const d = labbed();
  assert.equal(L.tierState(d, 'T1'), 'new');
  throwN(d, 'T1', 'bounce', ['hit', 'miss']);
  assert.equal(L.tierState(d, 'T1'), 'practice');
  throwN(d, 'T1', 'bounce', ['hit', 'hit', 'near', 'hit'], T0 + 10000);
  assert.equal(L.tierState(d, 'T1'), 'working', '4 of 6 on target');
  throwN(d, 'T1', 'locate', ['hit', 'bull', 'hit', 'hit', 'hit', 'hit', 'bull', 'hit'], T0 + 20000, 2);
  assert.equal(L.tierState(d, 'T1'), 'secure');
  const e = labbed();
  throwN(e, 'T1', 'locate', Array(8).fill('hit'), T0, 4);
  assert.equal(L.tierState(e, 'T1'), 'working', 'right but not close enough on average (4 % > 2.5 %)');
});
test('a slip (the last two plain throws missed) brings a secure tier back to working', () => {
  const d = labbed();
  throwN(d, 'T1', 'locate', Array(10).fill('bull'), T0, 1);
  assert.equal(L.tierState(d, 'T1'), 'secure');
  throwN(d, 'T1', 'locate', ['miss', 'miss'], T0 + 60000);
  assert.equal(L.tierState(d, 'T1'), 'working');
  assert.ok(d.moves.some((m) => m.from === 'secure' && m.to === 'working'));
});
test('records keep the last 12 throws per tier + kind', () => {
  const d = labbed();
  throwN(d, 'T1', 'locate', Array(20).fill('hit'));
  assert.equal(d.records['T1.locate'].length, 12);
  assert.equal(d.records['T1.locate'][11][0], T0 + 19000);
});
test('unlock: nothing before the Lab; the Lab opens Maple Street; Maple working opens Oak Lane, which then stays open', () => {
  const d = S.defaultSkills();
  assert.equal(L.isUnlocked(d, 'T1'), false); assert.equal(L.recommended(d), null);
  S.finishLab(d, T0);
  assert.deepEqual(L.unlockedTiers(d), ['T1']);
  S.recordThrow(d, { tier: 'T2', kind: 'locate', show: '2/3', pae: 3, result: 'hit', at: T0 });
  assert.equal(L.isUnlocked(d, 'T2'), false, "the Lab's ⅔ does not open Oak Lane");
  throwN(d, 'T1', 'bounce', Array(6).fill('hit'), T0 + 1000);
  assert.deepEqual(L.unlockedTiers(d), ['T1', 'T2']);
  assert.ok(d.opened.T2 > 0);
  throwN(d, 'T1', 'bounce', Array(12).fill('miss'), T0 + 90000);
  assert.equal(L.tierState(d, 'T1'), 'practice');
  assert.equal(L.isUnlocked(d, 'T2'), true, 'a chosen street is never closed again');
  assert.equal(L.isUnlocked(d, 'T3'), false);
});
test('the ★: the lowest open street not secure, else the highest open one', () => {
  const d = labbed();
  assert.equal(L.recommended(d), 'T1');
  throwN(d, 'T1', 'locate', Array(10).fill('bull'), T0, 1);
  assert.equal(L.recommended(d), 'T2');
  throwN(d, 'T2', 'locate', Array(10).fill('bull'), T0 + 50000, 1);
  assert.equal(L.recommended(d), 'T2');
});
test('Oak Lane adds fifths, tenths and twelfths once it works', () => {
  const d = labbed();
  assert.equal(L.moreDenominators(d, 'T2'), false);
  throwN(d, 'T2', 'bounce', Array(6).fill('hit'));
  assert.equal(L.moreDenominators(d, 'T2'), true);
  assert.equal(L.moreDenominators(d, 'T1'), false);
});

console.log('the skills store');
test('recordThrow: per fraction, per day, XP (effort counts too), moves; finishLab: +100 XP once, runs counted', () => {
  const d = S.defaultSkills();
  const r1 = S.finishLab(d, T0);
  const r2 = S.finishLab(d, T0 + 5);
  assert.deepEqual([r1.first, r1.xp, r2.first, r2.xp, d.lab.runs, d.lab.done], [true, 100, false, 0, 2, T0]);
  S.recordThrow(d, { tier: 'T1', kind: 'bounce', show: '3/4', pae: 12.34, result: 'near', at: T0 });
  S.recordThrow(d, { tier: 'T1', kind: 'bounce', show: '3/4', pae: 0.8, result: 'bull', at: T0 + 1 });
  assert.deepEqual(d.fracs['3/4'], { n: 2, hits: 1, bulls: 1, pae: 13.1, last: T0 + 1 });
  assert.deepEqual(d.days[S.dayKey(T0)], { throws: 2, hits: 1, bulls: 1, pae: 13.1 });
  assert.equal(d.xp, 100 + 1 + 3);
  assert.deepEqual(d.moves.map((m) => [m.from, m.to]), [['new', 'practice']]);
});
test('normalize: junk in, a valid store out (bad tiers, kinds, codes, fractions, days dropped; lists capped)', () => {
  const d = S.normalizeSkills({
    xp: -5, lab: { done: 'x', runs: 2.7 }, opened: { T2: 5, T9: 1, T1: -1 },
    records: { 'T1.locate': [[1, 3, 'h'], ['a', 1, 'h'], [2, 4, 'z'], ...Array.from({ length: 20 }, (_, i) => [10 + i, 2, 'b'])], 'T7.locate': [[1, 1, 'h']], 'T1.zap': [[1, 1, 'h']] },
    fracs: { '3/4': { n: 3, hits: 9, bulls: 1, pae: 7, last: 5 }, '3/7': { n: 1 }, 'x': {}, '1/4': { n: 0 } },
    days: { '2026-10-01': { throws: 2, hits: 5, bulls: 0, pae: 4 }, 'nope': {} },
    waves: [{ at: 5, street: 'maple', number: 9, cured: 3 }, { at: 0 }], moves: [{ at: 1, tier: 'T1', from: 'new', to: 'practice' }, { at: 2, tier: 'T1', from: 'x', to: 'y' }],
    opts: { aloud: 'yes' }, resetAt: 7,
  });
  assert.equal(d.xp, 0); assert.deepEqual(d.lab, { done: 0, runs: 2 }); assert.deepEqual(d.opened, { T2: 5 });
  assert.deepEqual(Object.keys(d.records), ['T1.locate']); assert.equal(d.records['T1.locate'].length, 12);
  assert.deepEqual(Object.keys(d.fracs), ['3/4']); assert.equal(d.fracs['3/4'].hits, 3, 'hits ≤ throws');
  assert.deepEqual(Object.keys(d.days), ['2026-10-01']); assert.equal(d.days['2026-10-01'].hits, 2);
  assert.equal(d.waves.length, 1); assert.equal(d.waves[0].number, 5);
  assert.equal(d.moves.length, 1); assert.equal(d.opts.aloud, true); assert.equal(d.resetAt, 7);
  assert.deepEqual(S.normalizeSkills(null), S.defaultSkills());
  assert.deepEqual(S.normalizeSkills(JSON.parse(JSON.stringify(d))), d, 'normalize is stable');
});
test('resetSkills: a fresh store stamped resetAt, the options kept', () => {
  const d = labbed(); d.opts.aloud = false;
  throwN(d, 'T1', 'locate', ['hit']);
  S.resetSkills(d, T0 + 9);
  assert.equal(d.resetAt, T0 + 9); assert.equal(d.opts.aloud, false); assert.deepEqual(d.records, {}); assert.equal(d.lab.done, 0);
});
test('report: the streets with stats, closest and trickiest fractions, this week\'s waves; the text names no time', () => {
  const d = labbed();
  for (let i = 0; i < 3; i++) {
    S.recordThrow(d, { tier: 'T1', kind: 'locate', show: '1/2', pae: 1, result: 'bull', at: T0 + i });
    S.recordThrow(d, { tier: 'T1', kind: 'locate', show: '3/4', pae: 18, result: 'near', at: T0 + 10 + i });
  }
  S.noteWave(d, { at: T0, street: 'maple', number: 1, cured: 5, reached: 1, throws: 6, hits: 3, bulls: 3, pae: 9.5 });
  const r = S.report(d, T0 + 1000);
  assert.equal(r.closest[0].show, '1/2'); assert.equal(r.hardest[0].show, '3/4');
  assert.equal(r.waves.length, 1);
  const text = S.reportText(d, 'Mia', T0 + 1000);
  assert.match(text, /Maple Street \(halves and quarters\): practicing · last 6 throws: 50 % on target/);
  assert.match(text, /Still tricky: 3\/4 \(82 % close\)/);
  assert.ok(!/second|minute| s\b|speed|fast/i.test(text));
});

console.log('the week (Parent Zone)');
test('a new player: 0 % of the ladder, no waves this week (null)', () => {
  const w = weekProgress(S.defaultSkills(), T0);
  assert.equal(w.ladderPct, 0); assert.equal(w.accuratePct, null); assert.equal(w.closePct, null);
  assert.deepEqual(weekProgressLines(w), ['Ladder: 0 % (Maple Street not started, Oak Lane not started)', 'This week: no waves this week']);
});
test('ladder steps (started / working / secure per street) and this week\'s accuracy, moved up', () => {
  const d = labbed();
  throwN(d, 'T1', 'bounce', ['hit', 'hit', 'hit', 'miss', 'hit', 'bull'], T0 - 2 * DAY);
  S.recordThrow(d, { tier: 'T2', kind: 'locate', show: '2/3', pae: 10, result: 'hit', at: T0 - 20 * DAY });
  const w = weekProgress(d, T0);
  assert.equal(w.ladderPct, 50, '(2 + 1) of 6 steps');
  assert.equal(w.throwsThisWeek, 6, 'the 20-day-old throw is not this week');
  assert.equal(w.accuratePct, 83); assert.deepEqual(w.movedUp, ['T1']);
  assert.match(weekProgressLines(w)[1], /^This week: 83 % accurate \(5 of 6 throws on target\) · \d+ % close on average · moved up: Maple Street$/);
});

console.log('cash, banking, the yard');
const thr = (id, result, pae = 5, extra = {}) => ({ item: { id }, result, pae, seen: true, ...extra });
const rowsOf = (c) => Object.fromEntries(c.rows.map((r) => [r.id, r.amount]));
test('cash rows add up: cure $120, bull +$60, close-then-cured +$40; a zombie counts once', () => {
  const c = E.waveCash([thr('a', 'bull'), thr('b', 'near'), thr('b', 'miss'), thr('b', 'hit'), thr('c', 'miss'), thr('d', 'hit'), thr('d', 'hit')]);
  assert.deepEqual(c.rows.filter((r) => r.amount).map((r) => [r.id, r.count, r.amount]), [['cure', 3, 360], ['bull', 1, 60], ['effort', 1, 40]]);
  assert.equal(c.total, 460);
  assert.equal(c.total, c.rows.reduce((a, r) => a + r.amount, 0));
  assert.deepEqual(c.rows.map((r) => r.id), ['cure', 'bull', 'effort', 'sharp', 'combo', 'twins', 'boss']);
});
test('sharpshooter (+$50 per cure in the fog), combo (+$20 × (combo − 1) from ×2, capped at ×6), twins (+$80 per extra cure), boss (+$300 on its third hit)', () => {
  const c = E.waveCash([
    thr('a', 'hit', 5, { seen: false, combo: 1 }),                          // in the fog: sharp
    thr('b', 'bull', 1, { seen: false, combo: 2, cures: ['b', 'c'] }),      // twins at one spot, combo ×2
    thr('d', 'near', 15, { combo: 2 }),                                     // a near keeps the combo
    thr('d', 'hit', 4, { combo: 3 }),                                        // seen; combo ×3; close-then-cured
    thr('e', 'miss', 30, { combo: 0 }),
    { item: { id: 'z', kind: 'boss' }, result: 'hit', pae: 3, seen: false, combo: 1 },
    { item: { id: 'z', kind: 'boss' }, result: 'hit', pae: 3, seen: true, combo: 2 },
    { item: { id: 'z', kind: 'boss' }, result: 'bull', pae: 1, seen: true, combo: 3 },
  ]);
  assert.deepEqual(rowsOf(c), { cure: 5 * 120, bull: 2 * 60, effort: 40, sharp: 3 * 50, combo: 20 + 40 + 20 + 40, twins: 80, boss: 300 });
  assert.equal(c.total, c.rows.reduce((a, r) => a + r.amount, 0));
  assert.deepEqual([c.cured, c.bulls, c.sharps, c.twins, c.bestCombo, c.boss], [5, 2, 3, 1, 3, true]);
  const half = E.waveCash([{ item: { id: 'z', kind: 'boss' }, result: 'hit', pae: 3 }, { item: { id: 'z', kind: 'boss' }, result: 'hit', pae: 3 }]);
  assert.equal(half.total, 0, 'two hits on the boss cure nothing yet'); assert.equal(half.boss, false);
});
test('the final wave pays everything twice (a final row the size of the subtotal); nothing cured = $0', () => {
  const c = E.waveCash([thr('a', 'bull'), thr('b', 'hit')], { final: true });
  assert.deepEqual(c.rows.map((r) => r.amount), [240, 60, 0, 0, 0, 0, 0, 300]);
  assert.equal(c.total, 600);
  assert.equal(E.waveCash([thr('a', 'miss')]).total, 0);
  assert.equal(E.accuracyOf([thr('a', 'hit', 4), thr('b', 'miss', 30)]), 83);
  assert.equal(E.accuracyOf([]), null);
});
test('bankWave: cash, cures, next wave 1 → 5, the final clears the street (a pumpkin) and starts it over; stopping keeps cash', () => {
  const s = defaultSave();
  for (let n = 1; n <= 4; n++) assert.equal(E.bankWave(s, { street: 'maple', number: n, cash: 100, cured: 3, at: T0 }).nextWave, n + 1);
  const fin = E.bankWave(s, { street: 'maple', number: 5, cash: 500, cured: 6, at: T0 });
  assert.deepEqual([fin.cleared, fin.pumpkin, fin.nextWave, s.pumpkins, s.streets.maple.cleared], [true, true, 1, 1, 1]);
  assert.equal(s.cash, 900); assert.equal(s.cures, 18); assert.equal(s.waves, 5);
  assert.deepEqual([fin.neighboursBefore, fin.neighboursAfter], [1, 1]);
  const st = E.bankWave(s, { street: 'maple', number: 1, cash: 120, cured: 2, stopped: true, at: T0 });
  assert.equal(st.nextWave, 1, 'a stopped wave is played again'); assert.equal(s.cash, 1020); assert.equal(s.cures, 20);
  assert.deepEqual([st.neighboursBefore, st.neighboursAfter], [1, 2], 'every 10 cures a new neighbour');
  assert.deepEqual(s.play[S.dayKey(T0)], { waves: 6, cures: 20 });
});
test('the yard: buy (cash down, owned, worn), wear an owned one again free, too little cash = poor; stock is free', () => {
  const s = defaultSave(); s.cash = 1600;
  assert.equal(E.buyYard(s, 'goo', 'tangerine'), 'poor');
  assert.equal(E.buyYard(s, 'goo', 'grape'), 'bought'); assert.equal(s.cash, 100); assert.equal(s.yard.goo, 'grape');
  assert.equal(E.buyYard(s, 'goo', 'lime'), 'owned'); assert.equal(s.yard.goo, 'lime');
  assert.equal(E.buyYard(s, 'goo', 'grape'), 'owned'); assert.equal(s.cash, 100);
  assert.equal(E.buyYard(s, 'fence', 'castle'), 'unknown');
  assert.equal(E.buyYard(s, 'grenade', 'slime'), 'owned'); assert.equal(s.yard.grenade, 'slime');
  s.cash = 2500;
  assert.equal(E.buyYard(s, 'grenade', 'lava'), 'bought'); assert.equal(s.yard.grenade, 'lava'); assert.equal(s.cash, 0);
});
test('yard extras: the dog and the lantern are bought once, then switched on and off', () => {
  const s = defaultSave(); s.cash = 4200;
  assert.equal(E.buyYard(s, 'extra', 'dog'), 'bought'); assert.equal(s.yard.dog, true); assert.equal(s.cash, 200);
  assert.equal(E.buyYard(s, 'extra', 'dog'), 'owned'); assert.equal(s.yard.dog, false);
  assert.equal(E.buyYard(s, 'extra', 'dog'), 'owned'); assert.equal(s.yard.dog, true);
  assert.equal(E.buyYard(s, 'extra', 'lantern'), 'poor'); assert.equal(s.yard.lantern, false);
  assert.equal(E.buyYard(s, 'extra', 'cat'), 'unknown');
  assert.deepEqual(s.yard.owned.extra, ['dog']);
});
test('save normalize: junk dropped, equipped only when owned, a wave number clamped', () => {
  const s = normalizeSave({ cash: -4, cures: 12.7, streets: { maple: { wave: 9, cleared: 2 }, mars: { wave: 1 } }, yard: { owned: { goo: ['grape', 'nope', 'lime'] }, goo: 'tangerine', fence: 'iron' }, resetAt: 5 });
  assert.equal(s.cash, 0); assert.equal(s.cures, 12);
  assert.deepEqual(s.streets, { maple: { wave: 5, cleared: 2 } });
  assert.deepEqual(s.yard, { owned: { grenade: [], goo: ['grape'], fence: [], extra: [] }, grenade: 'slime', goo: 'lime', fence: 'picket', dog: false, lantern: false });
  assert.equal(s.resetAt, 5);
  const t = normalizeSave({ yard: { owned: { grenade: ['frost', 'x'], extra: ['lantern', 'cat'] }, grenade: 'frost', dog: true, lantern: true } });
  assert.deepEqual(t.yard, { owned: { grenade: ['frost'], goo: [], fence: [], extra: ['lantern'] }, grenade: 'frost', goo: 'lime', fence: 'picket', dog: false, lantern: true }, 'an extra is on only when owned');
  assert.deepEqual(normalizeSave(defaultSave()), defaultSave(), 'a 1.0 save without the new fields normalizes to the stock');
});

console.log('sync merge rules');
const doc = (updatedAt, data) => ({ updatedAt, data });
test("ff: max counts, union of yard purchases, the later doc's goo, streets by who cleared more, play per day max", () => {
  const a = defaultSave(); a.cash = 500; a.cures = 30; a.yard.owned.goo = ['grape']; a.yard.goo = 'grape'; a.streets.maple = { wave: 4, cleared: 0 }; a.play['2026-10-26'] = { waves: 2, cures: 9 };
  const b = defaultSave(); b.cash = 300; b.cures = 41; b.yard.owned.fence = ['iron']; b.yard.fence = 'iron'; b.streets.maple = { wave: 2, cleared: 1 }; b.streets.oak = { wave: 3, cleared: 0 }; b.play['2026-10-26'] = { waves: 3, cures: 4 };
  const m = mergeFf(doc(2, a), doc(1, b));
  assert.equal(m.cash, 500); assert.equal(m.cures, 41);
  assert.deepEqual(m.yard.owned, { grenade: [], goo: ['grape'], fence: ['iron'], extra: [] });
  assert.equal(m.yard.goo, 'grape'); assert.equal(m.yard.fence, 'picket', 'the later doc wore the picket');
  assert.deepEqual(m.streets, { maple: { wave: 2, cleared: 1 }, oak: { wave: 3, cleared: 0 } });
  assert.deepEqual(m.play['2026-10-26'], { waves: 3, cures: 9 });
  assert.deepEqual(mergeFf(doc(1, b), doc(2, a)), m, 'the same either way round');
});
test('ff: a reset on one device wins whole; a missing side returns the other', () => {
  const a = defaultSave(); a.cash = 900;
  const b = defaultSave(); b.resetAt = 50;
  assert.equal(mergeFf(doc(9, a), doc(1, b)).cash, 0);
  assert.equal(mergeFf(null, doc(1, a)).cash, 900);
});
test('fracs: throws union by time (last 12), fractions = the side with more throws, xp max, earliest lab and opened, later opts', () => {
  const a = labbed(); throwN(a, 'T1', 'locate', ['hit', 'hit', 'miss'], T0); a.opts = { aloud: false, updatedAt: T0 + 5 };
  const b = S.defaultSkills(); S.finishLab(b, T0 - 5 * DAY); throwN(b, 'T1', 'locate', ['bull', 'near'], T0 + 100000); S.recordThrow(b, { tier: 'T1', kind: 'locate', show: '1/4', pae: 1, result: 'bull', at: T0 + 200000 });
  b.opened.T2 = T0 - DAY;
  const m = mergeFracs(doc(1, a), doc(2, b));
  assert.equal(m.records['T1.locate'].length, 6);
  assert.deepEqual(m.records['T1.locate'].map((x) => x[2]), ['h', 'h', 'm', 'b', 'n', 'b']);
  assert.equal(m.fracs['3/4'].n, 3, "a's 3 throws at ¾ beat b's 2"); assert.equal(m.fracs['1/4'].n, 1);
  assert.equal(m.lab.done, T0 - 5 * DAY); assert.equal(m.lab.runs, 1);
  assert.equal(m.opened.T2, T0 - DAY);
  assert.equal(m.xp, Math.max(a.xp, b.xp));
  assert.equal(m.opts.aloud, false, 'the later opts');
  const many = labbed(); throwN(many, 'T1', 'locate', Array(10).fill('hit'), T0 + 300000);
  assert.equal(mergeFracs(doc(1, m), doc(2, many)).records['T1.locate'].length, 12);
});
test('fracs: the same throw on both sides is kept once; a reset wins whole', () => {
  const a = labbed(); throwN(a, 'T1', 'locate', ['hit', 'hit'], T0);
  const b = JSON.parse(JSON.stringify(a));
  assert.equal(mergeFracs(doc(1, a), doc(2, b)).records['T1.locate'].length, 2);
  const r = labbed(); S.resetSkills(r, T0 + 99);
  assert.deepEqual(mergeFracs(doc(5, a), doc(1, r)).records, {});
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('FAILED:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('ALL SKILLS TESTS PASSED');

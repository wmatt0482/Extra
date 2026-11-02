// Unit tests for Fraction Fright's Lab integration (lab/SPEC.md §4.3; plain Node asserts, no browser):
//   node fraction-fright/tools/lab-tests.mjs
// Covers: the economy snapshot (§4 (f): no cash constant and no old yard price moved), the tower (built in order, the three stages, what a save
// keeps), the two new fences and four new goo colours, mergeFf unioning EVERY yard kind, Twin Alley (a playable street with seven spots, twin
// pairs, no bounce), the equivalence boss (three spellings of one spot, same x on every hit, cash and the boss row as for every boss),
// the voice texts, labLooks (what the Lab may list is exactly what this game draws) and the yard's drawing primitives.
import assert from 'node:assert/strict';
import * as I from '../src/skills/items.js';
import * as L from '../src/skills/ladder.js';
import * as S from '../src/skills/store.js';
import * as E from '../src/meta/economy.js';
import * as D from '../src/data/looks.js';
import { STREETS } from '../src/data/streets.js';
import { defaultSave, normalize } from '../src/meta/save.js';
import { mergeFf } from '../src/skills/sync.js';
import { FENCE_FINISHES, LOOKS_READY, TOWER_TOPPERS, labLooks } from '../src/meta/labLooks.js';
import { finishPrims, toSvg, topperPrims, towerPrims } from '../src/meta/yardArt.js';
import { ITEMS } from '../../lab/src/data/catalog.js';
import { OLD, OLD_TOTAL, catalog } from './yard-sim.mjs';

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failures.push(name); console.log('  ✗ ' + name + '\n      ' + String(e && e.message).split('\n').join('\n      ')); }
}
const T0 = new Date(2026, 10, 2, 16, 0, 0).getTime();
const doc = (updatedAt, data) => ({ updatedAt, data });

console.log('the economy is untouched (snapshot)');
test('waveCash constants and rows equal the 1.5 snapshot', () => {
  assert.deepEqual([E.CURE_CASH, E.BULL_BONUS, E.EFFORT_BONUS, E.SHARP_BONUS, E.COMBO_STEP, E.COMBO_CAP, E.TWIN_BONUS, E.BOSS_BONUS, E.FINAL_MULT, E.CURES_PER_NEIGHBOUR], [120, 60, 40, 50, 20, 6, 80, 300, 2, 10]);
  const thr = [{ item: { id: 'a' }, result: 'bull', pae: 1, seen: false, combo: 2 }, { item: { id: 'b' }, result: 'near', pae: 12, seen: true }, { item: { id: 'b' }, result: 'hit', pae: 3, seen: true, combo: 1 },
    { item: { id: 'x', kind: 'boss' }, result: 'hit', combo: 2 }, { item: { id: 'x', kind: 'boss' }, result: 'hit', combo: 3 }, { item: { id: 'x', kind: 'boss' }, result: 'bull', combo: 4 }];
  const c = E.waveCash(thr, { final: true });
  assert.deepEqual([c.cured, c.bulls, c.total], [3, 2, 2120], 'a fixed wave pays exactly what the unmodified 1.5 code paid (measured on the commit before this change)');
  assert.deepEqual(c.rows.map((r) => r.amount), [360, 120, 40, 100, 140, 0, 300, 1060]);
});
test('the old yard: every old price is unchanged and totals $35,500; stock items are free', () => {
  const old = { grenade: { lava: 2500, frost: 5000, disco: 9000 }, goo: { grape: 1500, tangerine: 3500 }, fence: { stone: 4000, iron: 4500 }, extra: { dog: 4000, lantern: 1500 } };
  for (const [kind, ids] of Object.entries(old)) for (const [id, price] of Object.entries(ids)) assert.equal(D.itemOf(kind, id).price, price, `${kind}:${id}`);
  assert.deepEqual([D.STOCK.grenade, D.STOCK.goo, D.STOCK.fence, D.STOCK.tower], ['slime', 'lime', 'picket', 'none']);
  assert.equal(catalog().filter((i) => OLD.includes(i.id)).reduce((a, i) => a + i.price, 0), OLD_TOTAL);
});

console.log('the tower, the fences, the goo');
test('TOWERS: none (free) then lookout < watchtower < beacon, in order; YARD_KINDS lists tower; two new fences after the iron one', () => {
  assert.deepEqual(D.TOWERS.map((t) => t.id), ['none', 'lookout', 'watchtower', 'beacon']);
  assert.equal(D.TOWERS[0].price, 0);
  assert.ok(D.TOWERS[1].price < D.TOWERS[2].price && D.TOWERS[2].price < D.TOWERS[3].price);
  assert.ok('tower' in D.YARD_KINDS);
  assert.deepEqual(D.FENCES.map((f) => f.id), ['picket', 'stone', 'iron', 'brick', 'castle']);
  assert.deepEqual(D.GOO.map((g) => g.id), ['lime', 'grape', 'tangerine', 'aqua', 'sunshine', 'bubblegum', 'galaxy']);
});
test('buyYard builds the tower in order: locked until the stage before is owned; poor; owned toggles; cosmetic only', () => {
  const s = defaultSave(); s.cash = D.TOWERS[1].price - 1;
  assert.equal(E.buyYard(s, 'tower', 'lookout'), 'poor');
  assert.equal(E.buyYard(s, 'tower', 'beacon'), 'locked'); assert.equal(E.buyYard(s, 'tower', 'watchtower'), 'locked');
  s.cash = 1e7;
  assert.equal(E.buyYard(s, 'tower', 'lookout'), 'bought'); assert.equal(s.yard.tower, 'lookout');
  assert.equal(E.buyYard(s, 'tower', 'beacon'), 'locked', 'not the third before the second');
  assert.equal(E.buyYard(s, 'tower', 'watchtower'), 'bought'); assert.equal(E.buyYard(s, 'tower', 'beacon'), 'bought');
  assert.equal(s.cash, 1e7 - D.TOWERS[1].price - D.TOWERS[2].price - D.TOWERS[3].price);
  assert.equal(E.buyYard(s, 'tower', 'lookout'), 'owned'); assert.equal(s.yard.tower, 'lookout', 'wearing a smaller tower again is free');
  assert.equal(E.buyYard(s, 'tower', 'none'), 'owned'); assert.equal(s.yard.tower, 'none');
  assert.equal(E.buyYard(s, 'tower', 'skyscraper'), 'unknown');
  assert.equal(E.buyYard(s, 'fence', 'castle'), 'bought'); assert.equal(s.yard.fence, 'castle');
});
test('save: a new save has the tower slot; an old save (no tower, no owned.tower) normalizes to none; junk towers are dropped; a tower is worn only when owned', () => {
  const d = defaultSave();
  assert.deepEqual([d.yard.tower, d.yard.owned.tower], ['none', []]);
  const old = normalize({ cash: 10, yard: { owned: { grenade: ['lava'], goo: [], fence: ['stone'], extra: [] }, grenade: 'lava', goo: 'lime', fence: 'stone', dog: true, lantern: false } });
  assert.deepEqual([old.yard.tower, old.yard.owned.tower, old.yard.fence, old.yard.owned.grenade], ['none', [], 'stone', ['lava']]);
  const junk = normalize({ yard: { owned: { tower: ['watchtower', 'nope', 'none'] }, tower: 'beacon' } });
  assert.deepEqual([junk.yard.owned.tower, junk.yard.tower], [['watchtower'], 'none'], 'wearing a tower you do not own falls back to none');
  assert.equal(normalize({ yard: { owned: { tower: ['beacon'] }, tower: 'beacon' } }).yard.tower, 'beacon');
});
test('mergeFf unions EVERY yard kind (it does not hard-code three): each side owns something different in each kind', () => {
  const a = defaultSave(), b = defaultSave();
  a.yard.owned = { grenade: ['lava'], goo: ['grape'], fence: ['stone'], tower: ['lookout'], extra: ['dog'] }; a.yard.tower = 'lookout'; a.yard.dog = true;
  b.yard.owned = { grenade: ['frost'], goo: ['aqua'], fence: ['brick'], tower: ['lookout', 'watchtower'], extra: ['lantern'] }; b.yard.tower = 'watchtower';
  const m = mergeFf(doc(5, a), doc(9, b));
  for (const kind of Object.keys(D.YARD_KINDS).concat('extra')) assert.ok(Array.isArray(m.yard.owned[kind]), kind);
  assert.deepEqual(Object.fromEntries(Object.entries(m.yard.owned).map(([k, v]) => [k, [...v].sort()])), { grenade: ['frost', 'lava'], goo: ['aqua', 'grape'], fence: ['brick', 'stone'], tower: ['lookout', 'watchtower'], extra: ['dog', 'lantern'] });
  assert.equal(m.yard.tower, 'watchtower', "the later doc's worn tower");
  assert.deepEqual(mergeFf(doc(9, b), doc(5, a)), m, 'the same either way round');
  const fromOld = mergeFf(doc(1, { ...defaultSave(), yard: { owned: { grenade: [], goo: [], fence: [], extra: [] }, grenade: 'slime', goo: 'lime', fence: 'picket', dog: false, lantern: false } }), doc(2, b));
  assert.deepEqual(fromOld.yard.owned.tower, ['lookout', 'watchtower'], 'a device on the old build never erases a tower');
});

console.log('Twin Alley and the equivalence boss');
test('Twin Alley is a street: playable, after Oak Lane, boss named Mayor Mirror; Sum Street and later still are not', () => {
  const twin = STREETS.find((s) => s.id === 'twin');
  assert.ok(twin.playable && twin.tier === 'T3' && twin.boss === 'Mayor Mirror' && twin.look && twin.sky);
  assert.deepEqual(I.PLAYABLE, ['T1', 'T2', 'T3']);
  assert.deepEqual(STREETS.filter((s) => !s.playable).map((s) => s.id), ['sum', 'decimal', 'pumpkin']);
  const d = S.defaultSkills(); S.finishLab(d, T0 - 1000);
  assert.equal(L.isUnlocked(d, 'T3'), false);
  for (let i = 0; i < 8; i++) S.recordThrow(d, { tier: 'T2', kind: 'locate', show: '2/3', pae: 2, result: 'hit', at: T0 + i * 1000 });
  assert.equal(L.tierState(d, 'T2'), 'secure'); assert.ok(d.opened.T3 > 0, 'Oak Lane working opens Twin Alley, which then stays open');
  assert.equal(L.reviewTierOf('T3'), 'T2');
});
test('Twin Alley asks seven spots, each in every denominator that reaches it (½ also as 3/6, 4/8, 6/12); every fraction is grade-4 and parses', () => {
  const pool = I.fractionsOf('T3').map((f) => `${f.n}/${f.d}`);
  assert.equal(new Set(I.fractionsOf('T3').map((f) => Math.round((f.n / f.d) * 1e6))).size, 7);
  for (const x of ['1/2', '2/4', '3/6', '4/8', '6/12', '3/4', '6/8', '9/12', '2/3', '4/6', '8/12', '5/6', '10/12', '1/4', '2/8', '3/12', '1/3', '2/6', '4/12', '1/6', '2/12']) assert.ok(pool.includes(x), x);
  for (const f of I.fractionsOf('T3')) { assert.ok(I.DENOMS.includes(f.d) && f.n > 0 && f.n < f.d); assert.ok(I.parseFrac(`${f.n}/${f.d}`)); }
  for (const pair of I.twinPairs('T3')) assert.ok(Math.abs(pair[0].n / pair[0].d - pair[1].n / pair[1].d) < 1e-9 && `${pair[0].n}/${pair[0].d}` !== `${pair[1].n}/${pair[1].d}`);
  assert.ok(I.twinPairs('T3').length >= 10);
});
test('a Twin Alley wave: 8-12 plain locate items (no bounce), a twin pair from wave 2, T3 items; review items come from Oak Lane', () => {
  for (const number of [1, 2, 3, 4]) for (let seed = 1; seed <= 6; seed++) {
    const w = I.buildWave({ tier: 'T3', number, state: 'new', reviewTier: 'T2', rng: I.rngFrom(seed * 31 + number) });
    assert.equal(w.items.length, I.WAVE_SIZES[number - 1]);
    assert.ok(w.items.every((x) => x.kind === 'locate'), 'a spot with ten hops would not teach "same spot"');
    assert.equal(w.items.filter((x) => x.twin).length, number > 1 ? 2 : 0);
    assert.ok(w.items.every((x) => x.tier === 'T3' || x.tier === 'T2'));
    const ids = w.items.map((x) => x.id); assert.equal(new Set(ids).size, ids.length);
  }
});
test('the equivalence boss: three spellings of ONE spot, three hits, same x on every hit, "Same spot!", named by the street', () => {
  for (const [n, d, forms] of [[3, 4, ['3/4', '6/8', '9/12']], [1, 2, ['1/2', '2/4', '3/6']], [2, 3, ['2/3', '4/6', '8/12']], [1, 3, ['1/3', '2/6', '4/12']], [1, 4, ['1/4', '2/8', '3/12']]]) {
    const b = I.makeBoss({ n, d }, { tier: 'T3', name: 'Mayor Mirror', style: 'equivalent' });
    assert.deepEqual([b.kind, b.style, b.hits, b.name, b.note], ['boss', 'equivalent', 3, 'Mayor Mirror', 'Same spot!']);
    assert.deepEqual(b.forms.map((f) => f.show), forms);
    for (const f of b.forms) { const p = I.parseFrac(f.show); assert.ok(Math.abs(p.n / p.d - b.target) < 1e-9, `${f.show} is at ${b.target}`); assert.ok(f.say.length > 3); }
    assert.equal(new Set(b.forms.map((f) => f.show)).size, 3, 'three different spellings');
  }
  assert.notEqual(I.makeBoss({ n: 3, d: 4 }, { tier: 'T1' }).style, 'equivalent', 'the old bosses are unchanged (symbol → words → unit sum)');
  assert.deepEqual(I.makeBoss({ n: 3, d: 4 }, { tier: 'T1' }).forms.map((f) => f.show), ['3/4', 'three quarters', '¼+¼+¼']);
  assert.deepEqual(I.makeBoss({ n: 5, d: 6 }, { tier: 'T3', style: 'equivalent' }).forms.length, 3, 'a spot with only two spellings still gives three forms');
});
test("Twin Alley's final wave ends with the equivalence boss (every seed); the other streets' final bosses keep their forms", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const w = I.buildWave({ tier: 'T3', number: 5, state: 'working', reviewTier: 'T2', rng: I.rngFrom(seed), bossName: 'Mayor Mirror' });
    const boss = w.items[w.items.length - 1];
    assert.deepEqual([boss.kind, boss.style, boss.name], ['boss', 'equivalent', 'Mayor Mirror']);
    assert.equal(new Set(boss.forms.map((f) => Math.round((I.parseFrac(f.show).n / I.parseFrac(f.show).d) * 1e6))).size, 1, 'one spot');
    assert.equal(w.items.filter((x) => x.kind === 'boss').length, 1);
  }
  const m = I.buildWave({ tier: 'T1', number: 5, state: 'new', rng: I.rngFrom(3) }).items.pop();
  assert.deepEqual([m.kind, m.style, m.forms[1].show.includes('quarter') || m.forms[1].show.includes('half')], ['boss', undefined, true]);
  assert.deepEqual(I.BOSS_NAMES, { T1: 'Mayor Mumbles', T2: 'Coach Groan', T3: 'Mayor Mirror' });
});
test('cash for the equivalence boss is the boss cash: $300 on the third hit, final wave ×2; and no new cash row', () => {
  const b = I.makeBoss({ n: 3, d: 4 }, { tier: 'T3', style: 'equivalent', id: 'boss' });
  const thr = [1, 2, 3].map((i) => ({ item: { id: 'boss', kind: 'boss' }, result: 'hit', pae: 2, seen: true, combo: i }));
  const c = E.waveCash(thr, { final: true });
  assert.equal(c.boss, true); assert.equal(c.rows.find((r) => r.id === 'boss').amount, 300);
  assert.deepEqual(c.rows.map((r) => r.id), ['cure', 'bull', 'effort', 'sharp', 'combo', 'twins', 'boss', 'final']);
  assert.equal(c.total, c.rows.reduce((a, r) => a + r.amount, 0));
  assert.equal(b.forms.length, 3);
});
test('the voice: the finite set of lines includes Twin Alley\'s fractions and the boss\'s forms, "Same spot!" in front of the later two', () => {
  const t = new Set(I.sayTexts());
  for (const x of ['six eighths.', 'nine twelfths.', 'Same spot! six eighths.', 'Same spot! nine twelfths.', 'Same spot! two quarters.', 'ten twelfths.', 'one half.']) assert.ok(t.has(x), x);
  assert.ok(!t.has('Same spot! three quarters.'), 'the first form is called plainly');
  assert.ok(t.size < 600, `${t.size} clips (a finite, small set)`);
});

console.log('the Lab looks');
test('LOOKS_READY is exactly the Fraction Fright items the Lab catalogue lists (none missing, none extra), each with an art entry', () => {
  const cat = ITEMS.filter((i) => i.owner === 'ff' && !i.soon).map((i) => i.id).sort();
  assert.deepEqual([...LOOKS_READY].sort(), cat);
  assert.equal(LOOKS_READY.length, 12);
  for (const n of FENCE_FINISHES) assert.ok(finishPrims(n, 400, 40).length > 4, n);
  const tw = towerPrims(2);
  for (const n of TOWER_TOPPERS) assert.ok(topperPrims(n, tw).length >= 2, n);
});
test('labLooks(cosmetics): null = the game\'s own look; ids it cannot draw or does not know are dropped; another game\'s slot is ignored', () => {
  assert.deepEqual(labLooks(null), { fence: null, tower: null });
  assert.deepEqual(labLooks({ slots: {} }), { fence: null, tower: null });
  assert.deepEqual(labLooks({ slots: { fence: 'ff.fence.neon', tower: 'ff.tower.crowntop' } }), { fence: 'neon', tower: 'crowntop' });
  assert.deepEqual(labLooks({ slots: { fence: 'ff.fence.lasers', tower: 'ff.tower.flagred' } }), { fence: null, tower: 'flagred' });
  assert.deepEqual(labLooks({ slots: { fence: 'ff.tower.flagred', tower: null } }), { fence: null, tower: null }, 'a tower item in the fence slot is not drawn');
});
test('yard art: every stage and finish gives finite coordinates; the SVG has no NaN and is balanced; stages grow', () => {
  const hs = [1, 2, 3].map((s) => towerPrims(s).h);
  assert.ok(hs[0] < hs[1] && hs[1] < hs[2]);
  assert.deepEqual(towerPrims(0).prims, []);
  for (const stage of [1, 2, 3]) {
    const tw = towerPrims(stage);
    for (const prims of [tw.prims, ...TOWER_TOPPERS.map((n) => topperPrims(n, tw)), ...FENCE_FINISHES.map((n) => finishPrims(n, 700, 60))]) {
      const svg = toSvg(prims, 10, 20, 0.5, 'x');
      assert.ok(!/NaN|undefined|Infinity/.test(svg), svg.slice(0, 80)); assert.ok(svg.startsWith('<g') && svg.endsWith('</g>'));
      for (const p of prims) assert.ok(['r', 'c', 'e', 'p', 'l', 'pl'].includes(p.k));
    }
  }
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('FAILED:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('ALL LAB INTEGRATION TESTS PASSED');

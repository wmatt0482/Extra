// The Lab's pure core, no browser: node lab/tools/core-tests.mjs
// model, events, combo, xp, quests, crate, shop, streak, family, engine, view (lab/SPEC.md §7.1). The merge laws and the store are in sync-tests.mjs.
import assert from 'node:assert/strict';
import { T0, at, atest, dayOf, finish, rng, section, test } from './testlib.mjs';
import { LAB_VERSION, GAMES, LIMITS, cleanPetName, defaultLab, deviceKeyOk, labKey, mondayOfWeek, normalizeLab, owns, totalXp, wallet, weekShift } from '../src/core/model.js';
import { EVENTS, COMBO, DAILY_COIN_CAP, MOMENT, MOMENT_NAMES, eventDef, payFor } from '../src/core/events.js';
import { comboStep, newCombo } from '../src/core/combo.js';
import { LEVEL_GIFTS, LEVEL_MAX, SLOT_LEVEL, frameFor, levelFor, levelProgress, petStage, slotOpen, titleFor, xpToReach } from '../src/core/xp.js';
import { QUESTS, QUEST_BY_ID, drawQuests, ensureToday, playedDays, questEvent, questText, questView, rerollQuest, targetFor, tierFor } from '../src/core/quests.js';
import { CRATE_ODDS, crateOddsTable, earnCrate, openCrate, rollCrate, unopened } from '../src/core/crate.js';
import { buy, canBuy, equip, equippedIds, grant, isReady, priceOf, shelf } from '../src/core/shop.js';
import { earnLabBonusFreeze, freezeView, labDayDone, labRefresh, labStreakNow } from '../src/core/streak.js';
import { boardFor, claimGoal, ensureGoalPick, goalFor, goalTarget, pickGoal, settleCrowns, weekNumbers } from '../src/core/family.js';
import { NOOP_RECEIPT, applyEvent, beginRound, newSession, roundSummary } from '../src/core/engine.js';
import { buildView, voiceTexts } from '../src/core/view.js';
import { ITEMS, ITEM_BY_ID, SLOTS } from '../src/data/catalog.js';
import { FAMILY_GOALS } from '../src/data/goals.js';
import { addDays, dayDiff, weekOfDay } from '../../car-jump/src/meta/engagement.js';

const ctxAt = (t, over = {}) => ({ playerId: 'mia', device: 'dev001', now: t, day: dayOf(t), gentle: false, session: newSession('sj'), ...over });
const READY_ALL = ITEMS.filter((i) => !i.soon).map((i) => i.id);
const addCoins = (lab, n, dev = 'dev001') => { (lab.dev[dev] = lab.dev[dev] || { c: 0, x: 0 }).c += n; };
const addXpTo = (lab, n, dev = 'dev001') => { (lab.dev[dev] = lab.dev[dev] || { c: 0, x: 0 }).x += n; };
const ev = (game, event, extra = {}) => ({ game, event, n: 1, firstTry: null, meta: null, ...extra });

section('model');
test('defaultLab is a normalized fixed point and matches the spec shape', () => {
  const d = defaultLab();
  assert.deepEqual(normalizeLab(d, 0), d);
  assert.deepEqual(Object.keys(d), ['v', 'resetAt', 'dev', 'paid', 'owned', 'equipped', 'pet', 'streak', 'quests', 'crates', 'play', 'weeks', 'fam', 'picks', 'claimed', 'crowns', 'trophies', 'gallery', 'best', 'opts', 'seen', 'coinDay']);
  assert.equal(d.v, LAB_VERSION); assert.deepEqual(d.pet, { species: 'fox', name: 'Pip', at: 0 });
});
test('normalizeLab survives hostile input and is idempotent', () => {
  const hostile = [null, undefined, 5, 'x', [], [1, 2], {}, { dev: 'x', paid: [], owned: 7, quests: 'q', crates: 3, weeks: [], play: null, streak: 'no', opts: 9 },
    JSON.parse('{"__proto__":{"polluted":1},"dev":{"__proto__":{"c":5},"abc123":{"c":1e99,"x":-5}},"owned":{"__proto__":1,"av.hat.cap":1e30},"constructor":{"prototype":{"x":1}}}'),
    { v: 'two', resetAt: -5, dev: { abc123: { c: NaN, x: Infinity } }, pet: { species: 'dragon', name: '<script>alert(1)</script>', at: 'x' }, quests: { '2026-11-02': { ids: ['sj-words', 'sj-words', 'x', 5, 'tb-races', 'ww-leg', 'bc-job'], p: { 'sj-words': 'many' } }, bad: {} } },
    { future: { nested: [1, 2, 3] }, v: 99, dev: { abc123: { c: 5, x: 6, future: 1 } } }];
  for (const h of hostile) {
    const n = normalizeLab(h, T0);
    assert.deepEqual(normalizeLab(n, T0), n, 'idempotent for ' + JSON.stringify(h)?.slice(0, 60));
    assert.deepEqual(Object.keys(n), Object.keys(defaultLab()), 'only known fields');
    assert.equal(({}).polluted, undefined);
  }
  const n = normalizeLab(hostile[8]);
  assert.deepEqual(n.dev, { abc123: { c: 1000000000, x: 0 } }); assert.deepEqual(n.owned, { 'av.hat.cap': 1e13 });
  const p = normalizeLab(hostile[9]);
  assert.equal(p.pet.species, 'fox'); assert.equal(p.pet.name, 'scriptaler'); assert.equal(p.v, 1);
  assert.deepEqual(Object.keys(p.quests), ['2026-11-02']); assert.deepEqual(p.quests['2026-11-02'].ids, ['sj-words', 'tb-races', 'ww-leg']);
  assert.equal(normalizeLab(hostile[10]).v, 99, 'a newer v is kept, not downgraded');
});
test('normalizeLab bounds every list', () => {
  const raw = defaultLab();
  for (let i = 0; i < 40; i++) raw.quests[addDays('2026-09-01', i)] = { ids: ['sj-words'], drawnAt: 1, rr: 0, tier: 'easy', p: {}, done: {} };
  for (let i = 0; i < 60; i++) raw.play[addDays('2026-09-01', i)] = { sj: 1, tb: 0, ff: 0, ww: 0, bc: 0 };
  for (let i = 0; i < 12; i++) raw.weeks[weekShift('2026-W45', -i)] = { abc123: { xp: 1, coins: 1, zap: 0, race: 0, word: 0, ft: 0, leg: 0, job: 0, g: ['sj'] } };
  raw.gallery = Array.from({ length: 30 }, (_, i) => ({ id: 'g' + i, at: i + 1, kind: 'job', title: 'T', pieces: Array.from({ length: 80 }, () => [1, 2, 3, 4, 5]) }));
  raw.trophies = Array.from({ length: 90 }, (_, i) => ({ game: 'sj', id: 'friday', tier: 'gold', at: i + 1, n: 1, of: 2 }));
  raw.crowns = Array.from({ length: 30 }, (_, i) => `${weekShift('2026-W45', -i)}:most`);
  raw.dev = Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['d' + String(i).padStart(3, '0'), { c: 10, x: 5 }]));
  const n = normalizeLab(raw, 0);
  assert.equal(Object.keys(n.quests).length, 14); assert.equal(Object.keys(n.quests).at(-1), '2026-10-10');
  assert.equal(Object.keys(n.play).length, 28); assert.equal(Object.keys(n.weeks).length, 6);
  assert.equal(n.gallery.length, 12); assert.equal(n.gallery[0].pieces.length, 48); assert.equal(n.trophies.length, 40); assert.equal(n.crowns.length, 12);
  assert.ok(Object.keys(n.dev).length <= 12 && n.dev._, 'extra devices fold into _');
  assert.equal(Object.values(n.dev).reduce((a, d) => a + d.c, 0), 200, 'folding keeps every coin');
  assert.ok(JSON.stringify(n).length < 40000, 'under the 40 KB target');
});
test('wallet = sum of device counters minus everything paid, never negative; two devices add', () => {
  const lab = defaultLab();
  addCoins(lab, 100, 'aaa111'); addCoins(lab, 70, 'bbb222'); lab.paid['av.hat.sunhat'] = 120;
  assert.deepEqual(wallet(lab), { earned: 170, paid: 120, coins: 50 });
  lab.paid['sj.skin.mint'] = 300; assert.equal(wallet(lab).coins, 0);
  assert.equal(totalXp(lab), 0); addXpTo(lab, 40, 'aaa111'); addXpTo(lab, 2, 'bbb222'); assert.equal(totalXp(lab), 42);
  assert.ok(deviceKeyOk('aaa111') && deviceKeyOk('_') && !deviceKeyOk('__proto__') && !deviceKeyOk('A!'));
  assert.equal(labKey('mia'), 'learningLab.mia.lab'); assert.equal(cleanPetName('  Sir  Bob-the 3rd!! '), 'Sir Bob-th'); assert.equal(cleanPetName(''), '');
});
test('week helpers', () => {
  assert.equal(mondayOfWeek('2026-W45'), '2026-11-02'); assert.equal(weekShift('2026-W01', -1), '2025-W52'); assert.equal(weekShift('2026-W45', 1), '2026-W46');
});

section('events');
test('every exchange row is whole numbers >= 0; answers fix = ceil(first-try / 2) in coins and XP', () => {
  assert.equal(EVENTS.length, 32);
  for (const r of EVENTS) {
    for (const f of ['coins', 'xp']) assert.ok(Number.isInteger(r[f]) && r[f] >= 0, `${r.game}.${r.event}.${f}`);
    if (r.kind === 'answer') {
      assert.equal(r.fixCoins, Math.ceil(r.coins / 2), `${r.game}.${r.event} coins`); assert.equal(r.fixXp, Math.ceil(r.xp / 2), `${r.game}.${r.event} xp`);
      assert.ok(r.fixCoins > 0 && r.fixXp > 0, 'a miss is never zero');
    }
  }
});
test('payFor: answers pay first-try or fix, units flat times n, the replay share, flat events ignore n', () => {
  const word = eventDef('sj', 'word');
  assert.deepEqual(payFor(word, { firstTry: true }), { coins: 4, xp: 4 }); assert.deepEqual(payFor(word, { firstTry: false }), { coins: 2, xp: 2 });
  assert.deepEqual(payFor(eventDef('ff', 'zap'), { firstTry: false }), { coins: 2, xp: 2 }); assert.deepEqual(payFor(eventDef('sj', 'testWord'), { firstTry: true }), { coins: 4, xp: 6 });
  assert.deepEqual(payFor(eventDef('bc', 'piece'), { n: 10 }), { coins: 40, xp: 30 }); assert.deepEqual(payFor(eventDef('bc', 'job'), { replay: true }), { coins: 10, xp: 14 });
  assert.deepEqual(payFor(eventDef('sj', 'test'), { n: 18 }), { coins: 40, xp: 80 });
  assert.equal(eventDef('sj', 'nope'), null); assert.equal(eventDef('zz', 'word'), null); assert.equal(eventDef('sj', 'toString'), null); assert.equal(eventDef('tb', 'day'), eventDef('ff', 'day'));
});
test('unknown games and events are ignored with a zero receipt, never thrown', () => {
  const lab = defaultLab(), c = ctxAt(T0);
  for (const bad of [null, {}, ev('zz', 'word'), ev('sj', 'nope'), ev('sj', '__proto__'), { game: 5 }]) {
    const r = applyEvent(lab, c, bad);
    assert.equal(r.ok, false); assert.equal(r.coins, 0); assert.equal(r.xp, 0);
  }
  assert.deepEqual(lab, defaultLab());
});

section('combo');
test('three first-tries, then the next answer is boosted; a miss sets 0; moments at 5/10/15, at most 4 a round', () => {
  const c = newCombo();
  const steps = [true, true, true, true].map(() => comboStep(c, { firstTry: true }));
  assert.deepEqual(steps.map((s) => s.boosted), [false, false, false, true]); assert.equal(c.count, 4);
  assert.equal(comboStep(c, { firstTry: true }).moment, true, 'the fifth');
  const miss = comboStep(c, { firstTry: false });
  assert.deepEqual(miss, { boosted: false, moment: false, count: 0 }); assert.equal(c.count, 0);
  const d = newCombo(); const moments = [];
  for (let i = 1; i <= 30; i++) if (comboStep(d, { firstTry: true }).moment) moments.push(i);
  assert.deepEqual(moments, [5, 10, 15, 20], 'at most 4 a round'); assert.equal(COMBO.momentsPerRound, 4);
});
test('assessments and unknown signals leave the combo alone; beginRound clears', () => {
  const c = newCombo(); for (let i = 0; i < 4; i++) comboStep(c, { firstTry: true });
  assert.deepEqual(comboStep(c, { firstTry: false, assessment: true }), { boosted: false, moment: false, count: 4 }); assert.equal(c.count, 4);
  assert.deepEqual(comboStep(c, { firstTry: null }), { boosted: false, moment: false, count: 4 });
  const s = newSession('sj'); s.combo = c; s.round.coins = 9; beginRound(s, 5);
  assert.deepEqual(s.combo, { count: 0, moments: 0 }); assert.equal(s.round.coins, 0);
});
test('engine: the boosted answer pays double coins but never double XP; the moment pays +5 coins +10 XP and names itself', () => {
  const lab = defaultLab(), c = ctxAt(T0), rs = [];
  for (let i = 0; i < 5; i++) rs.push(applyEvent(lab, c, ev('sj', 'word', { firstTry: true })));
  assert.deepEqual(rs.map((r) => r.coins), [4, 4, 4, 8, 13]); assert.deepEqual(rs.map((r) => r.xp), [4, 4, 4, 4, 14]);
  assert.equal(rs[4].combo.moment, true); assert.equal(rs[4].combo.name, MOMENT_NAMES.sj); assert.equal(rs[2].combo.count, 3);
  const miss = applyEvent(lab, c, ev('sj', 'word', { firstTry: false }));
  assert.equal(miss.coins, 2); assert.equal(miss.combo.count, 0); assert.equal(miss.combo.boosted, false);
  assert.equal(lab.best.sj, 5);
  const t = applyEvent(lab, c, ev('sj', 'testWord', { firstTry: true }));
  assert.equal(t.combo.boosted, false); assert.equal(t.coins, 4, 'no combo on the Friday Test');
  const b = applyEvent(lab, ctxAt(T0, { session: newSession('bc') }), ev('bc', 'piece', { n: 3 }));
  assert.equal(b.combo.count, 0); assert.equal(b.coins, 12);
});
test('daily limits and the cap stop coins only; XP and quests continue; capped is true once', () => {
  const lab = defaultLab(), c = ctxAt(T0, { session: newSession('tb') });
  const g = [1, 2, 3, 4, 5].map(() => applyEvent(lab, c, ev('tb', 'ghostBeat')));
  assert.deepEqual(g.map((r) => r.coins), [8, 8, 8, 0, 0]); assert.deepEqual(g.map((r) => r.xp), [15, 15, 15, 15, 15]);
  const p = applyEvent(lab, ctxAt(T0, { session: newSession('bc') }), ev('bc', 'piece', { n: 200 }));
  assert.equal(p.coins, 600, '150 pieces a day'); assert.equal(p.xp, 600);
  const test1 = applyEvent(lab, ctxAt(T0), ev('sj', 'test', { n: 18, meta: { of: 20 } })), test2 = applyEvent(lab, ctxAt(T0), ev('sj', 'test', { n: 20, meta: { of: 20 } }));
  assert.deepEqual([test1.coins, test2.coins, test1.xp, test2.xp], [40, 0, 80, 80]);
  // the cap
  const lab2 = defaultLab(); lab2.coinDay = { day: dayOf(T0), n: DAILY_COIN_CAP - 5, ev: {} };
  const c2 = ctxAt(T0), rs = [1, 2, 3].map(() => applyEvent(lab2, c2, ev('ww', 'leg')));
  assert.deepEqual(rs.map((r) => r.coins), [5, 0, 0]); assert.deepEqual(rs.map((r) => r.capped), [true, false, false]); assert.deepEqual(rs.map((r) => r.xp), [45, 45, 45]);
  assert.equal(lab2.coinDay.n, DAILY_COIN_CAP); assert.equal(buildView(lab2, c2).capped, true);
  const next = applyEvent(lab2, ctxAt(at(1)), ev('ww', 'leg')); assert.equal(next.coins, 24, 'a new day, a new cap');
});
test('day pays once a local day across all games and counts the Lab streak day', () => {
  const lab = defaultLab();
  const a = applyEvent(lab, ctxAt(T0), ev('sj', 'day')), b = applyEvent(lab, ctxAt(T0, { session: newSession('tb') }), ev('tb', 'day'));
  assert.deepEqual([a.coins, a.xp, a.streak.counted, a.streak.count], [10, 25, true, 1]); assert.deepEqual([b.coins, b.xp, b.streak.counted], [0, 0, false]);
  const n = applyEvent(lab, ctxAt(at(1)), ev('ww', 'day')); assert.deepEqual([n.coins, n.streak.count], [10, 2]);
});
test('Build Crew: a replayed job pays 25 %; the weekly counters follow the events', () => {
  const lab = defaultLab(), c = ctxAt(T0, { session: newSession('bc') });
  assert.equal(applyEvent(lab, c, ev('bc', 'job', { meta: { first: true } })).coins, 40); assert.equal(applyEvent(lab, c, ev('bc', 'job', { meta: { first: false } })).coins, 10);
  const wk = weekOfDay(dayOf(T0)); const n = weekNumbers(lab, wk);
  assert.equal(n.job, 2); assert.deepEqual(n.g, ['bc']); assert.ok(n.xp >= 55 + 14, 'xp is summed');
  const lab2 = defaultLab(), c2 = ctxAt(T0);
  applyEvent(lab2, c2, ev('sj', 'word', { firstTry: true })); applyEvent(lab2, c2, ev('sj', 'testWord', { firstTry: true })); applyEvent(lab2, c2, ev('ww', 'word', { firstTry: false }));
  applyEvent(lab2, ctxAt(T0, { session: newSession('ff') }), ev('ff', 'zap', { firstTry: true })); applyEvent(lab2, ctxAt(T0, { session: newSession('tb') }), ev('tb', 'race'));
  const m = weekNumbers(lab2, wk); assert.deepEqual([m.word, m.ft, m.zap, m.race], [3, 3, 1, 1]); assert.deepEqual(m.g, ['sj', 'tb', 'ff', 'ww']);
});
test('this week\'s XP (the board) never exceeds the lifetime XP (the header level): both are credited by the same call', () => {
  const lab = defaultLab(), r = rng(7);
  for (let i = 0; i < 400; i++) {
    const g = GAMES[Math.floor(r() * GAMES.length)], c = ctxAt(T0 + Math.floor(i / 14) * 86400000, { session: newSession(g) });
    applyEvent(lab, c, ev(g, ['word', 'race', 'zap', 'day', 'leg', 'job'][Math.floor(r() * 6)], { firstTry: r() < 0.6 }));
  }
  let weekly = 0; for (const wk of Object.keys(lab.weeks)) weekly += weekNumbers(lab, wk).xp;
  assert.ok(weekly > 500, 'the fixture earned XP'); assert.equal(weekly, totalXp(lab), 'every XP point is in exactly one week while the weeks fit the 6-week window');
  assert.ok(levelFor(totalXp(lab)) > 1, 'a child with that much weekly XP is above level 1');
});

section('xp, levels, titles, avatar, pet');
test('xpToReach matches the spec table; levelFor boundaries; the cap at level 100', () => {
  const table = { 2: 100, 3: 300, 4: 600, 5: 900, 6: 1300, 7: 1750, 8: 2250, 9: 2800, 10: 3350, 11: 4000, 12: 4650, 13: 5350, 14: 6050, 15: 6800, 16: 7600, 17: 8450, 18: 9300, 19: 10200, 20: 11100, 25: 16150, 30: 21850, 40: 35150, 50: 50600, 60: 68150, 70: 87550, 80: 108700, 90: 131550, 100: 155950 };
  for (const [l, x] of Object.entries(table)) { assert.equal(xpToReach(+l), x, 'level ' + l); assert.equal(levelFor(x), +l); assert.equal(levelFor(x - 1), +l - 1); }
  assert.equal(xpToReach(1), 0); assert.equal(levelFor(0), 1); assert.equal(levelFor(99), 1); assert.equal(levelFor(1e9), LEVEL_MAX); assert.equal(levelFor(-5), 1);
  for (let l = 2; l <= 100; l++) assert.ok(xpToReach(l) > xpToReach(l - 1));
});
test('levelProgress: into, need, toNext, next; the last level', () => {
  assert.deepEqual(levelProgress(0), { level: 1, title: 'Cadet', into: 0, need: 100, toNext: 100, next: 2, max: false });
  assert.deepEqual(levelProgress(60), { level: 1, title: 'Cadet', into: 60, need: 100, toNext: 40, next: 2, max: false });
  assert.deepEqual(levelProgress(300), { level: 3, title: 'Cadet', into: 0, need: 300, toNext: 300, next: 4, max: false });
  const m = levelProgress(200000); assert.equal(m.level, 100); assert.equal(m.max, true); assert.equal(m.next, null); assert.equal(m.toNext, 0);
});
test('titles every 10 levels, frames at 10/25/50/75/100, pet stages, slots open by level', () => {
  const t = { 1: 'Cadet', 9: 'Cadet', 10: 'Scout', 20: 'Ranger', 30: 'Captain', 40: 'Pioneer', 50: 'Commander', 60: 'Inventor', 70: 'Master', 80: 'Legend', 90: 'Lab Legend', 100: 'Lab Legend' };
  for (const [l, name] of Object.entries(t)) assert.equal(titleFor(+l), name, 'level ' + l);
  assert.deepEqual([1, 9, 10, 24, 25, 50, 74, 75, 100].map(frameFor), [0, 0, 1, 1, 2, 3, 3, 4, 5]);
  assert.deepEqual([1, 7, 8, 19, 20, 39, 40, 69, 70, 100].map(petStage), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.equal(SLOT_LEVEL['av.back'], 4); assert.equal(slotOpen(3, 'av.back'), false); assert.equal(slotOpen(4, 'av.back'), true); assert.equal(slotOpen(1, 'av.hat'), true);
  assert.deepEqual([['av.face', 8], ['av.aura', 15], ['pet.toy', 3], ['pet.hat', 6], ['home.poster', 2], ['home.shelf', 5]].map(([k]) => SLOT_LEVEL[k]), [8, 15, 3, 6, 2, 5]);
});
test('LEVEL_GIFTS reference real gift items; the engine grants each exactly once, also when a level is skipped', () => {
  const gifts = Object.entries(LEVEL_GIFTS);
  assert.equal(gifts.length, 18, '17 level gifts + the Lab poster at level 2');
  for (const [l, id] of gifts) { assert.ok(ITEM_BY_ID[id], id); assert.equal(ITEM_BY_ID[id].source, 'gift'); assert.equal(ITEM_BY_ID[id].level, +l); }
  const lab = defaultLab(), c = ctxAt(T0);
  addXpTo(lab, xpToReach(7) - 10);
  const r = applyEvent(lab, c, ev('sj', 'run'));     // +12 XP: level 7 (skipping 2..6 gifts: poster.lab L2, cap L3, stripes L6)
  assert.equal(r.level.after, 7);
  const ids = r.unlocks.map((u) => u.id).sort(); assert.deepEqual(ids, ['av.hat.cap', 'av.shirt.stripes', 'home.poster.lab', 'home.poster.sj']);
  assert.equal(r.unlocks.find((u) => u.id === 'av.hat.cap').name, 'Racing cap');
  assert.equal(applyEvent(lab, c, ev('sj', 'run')).unlocks.length, 0, 'once');
  assert.ok(owns(lab, 'av.hat.cap') && lab.paid['av.hat.cap'] === 0);
});

section('catalogue');
test('catalogue generated from the table: 143 items, 31 gifts + 1 stock, 106 buyable for 140,300 coins; ids, slots, prices', () => {
  assert.equal(ITEMS.length, 143); assert.equal(ITEMS.filter((i) => i.source === 'gift').length, 31); assert.equal(ITEMS.filter((i) => i.source === 'stock').length, 1);
  const buyable = ITEMS.filter((i) => ['both', 'coins'].includes(i.source) && !i.soon);
  assert.equal(buyable.length, 106); assert.equal(buyable.reduce((a, i) => a + i.price, 0), 140300);
  assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length, 'ids are unique');
  for (const i of ITEMS) { assert.match(i.id, /^[a-z]+\.[a-z]+\.[a-z0-9-]+$/); assert.equal(i.key, `${i.owner}.${i.slot}`); assert.ok(SLOTS.some((s) => s.key === i.key)); assert.ok(i.name && !/undefined/.test(i.name)); }
  const p = (id) => ITEM_BY_ID[id].price;
  assert.deepEqual([p('av.hat.sunhat'), p('av.hat.propeller'), p('av.shirt.hero'), p('bc.veh.dump'), p('bc.veh.fork'), p('bc.bp.lighthouse'), p('bc.bp.arch')], [300, 1200, 3000, 8000, 12000, 2400, 3600]);
  assert.deepEqual(ITEMS.filter((i) => i.soon).map((i) => i.id).sort(), ['bc.bp.suspension', 'bc.bp.towercrane', 'bc.veh.dozer', 'bc.veh.loader', 'bc.veh.telehandler']);
  assert.equal(priceOf(ITEM_BY_ID['sj.skin.holo']), 3000);
});

section('shop');
test('canBuy reasons: unknown, owned, gift, notready, locked, coins; buy charges and records paid; the dump truck unlocks owns', () => {
  const lab = defaultLab();
  assert.equal(canBuy(lab, 'nope.x.y', {}).reason, 'unknown'); assert.equal(canBuy(lab, 'av.hat.cap', { ready: READY_ALL }).reason, 'gift');
  assert.equal(canBuy(lab, 'sj.skin.mint', { ready: [] }).reason, 'notready'); assert.equal(canBuy(lab, 'bc.veh.loader', { ready: READY_ALL }).reason, 'notready', 'soon is never sold');
  assert.equal(canBuy(lab, 'av.back.satchel', { ready: [] }).reason, 'locked', 'back opens at level 4');
  assert.deepEqual(canBuy(lab, 'av.hat.sunhat', { ready: [] }), { ok: false, reason: 'coins', need: 300 });
  addCoins(lab, 8350); const c = ctxAt(T0);
  const r = buy(lab, c, 'av.hat.sunhat', { ready: [] }); assert.deepEqual(r, { ok: true, spent: 300, reason: '' });
  assert.equal(lab.paid['av.hat.sunhat'], 300); assert.ok(owns(lab, 'av.hat.sunhat')); assert.equal(wallet(lab).coins, 8050);
  assert.equal(buy(lab, c, 'av.hat.sunhat', {}).reason, 'owned'); assert.equal(wallet(lab).coins, 8050);
  assert.equal(owns(lab, 'bc.veh.dump'), false);
  assert.equal(buy(lab, c, 'bc.veh.dump', { ready: ['bc.veh.dump'] }).ok, true); assert.equal(owns(lab, 'bc.veh.dump'), true); assert.equal(wallet(lab).coins, 50);
  assert.equal(isReady(ITEM_BY_ID['sj.skin.mint'], new Set(['sj.skin.mint'])), true); assert.equal(isReady(ITEM_BY_ID['av.hat.sunhat'], null), true);
});
test('equip needs ownership, an open slot and the right slot; null takes it off; a closed gift never equips; posters take two hooks', () => {
  const lab = defaultLab(), c = ctxAt(T0);
  assert.equal(equip(lab, c, 'av.hat', 'av.hat.sunhat'), false, 'not owned');
  grant(lab, c, 'av.hat.sunhat'); grant(lab, c, 'av.shirt.hoodie'); grant(lab, c, 'av.back.satchel');
  assert.equal(equip(lab, c, 'av.hat', 'av.hat.sunhat'), true); assert.equal(equip(lab, c, 'av.shirt', 'av.hat.sunhat'), false, 'wrong slot');
  assert.equal(equip(lab, c, 'av.back', 'av.back.satchel'), false, 'slot not open at level 1'); addXpTo(lab, xpToReach(4)); assert.equal(equip(lab, c, 'av.back', 'av.back.satchel'), true);
  assert.deepEqual(equippedIds(lab), ['av.back.satchel', 'av.hat.sunhat']);
  assert.equal(equip(lab, c, 'av.hat', null), true); assert.deepEqual(lab.equipped['av.hat'][0], ''); assert.equal(equip(lab, c, 'av.hat', null), false);
  assert.equal(equip(lab, c, 'bc.veh', 'bc.veh.dump'), false, 'vehicles are unlock gates, not looks');
  grant(lab, c, 'home.poster.sj'); grant(lab, c, 'home.poster.tb'); grant(lab, c, 'home.poster.ff');
  assert.equal(lab.equipped['home.poster'][0], 'home.poster.sj'); assert.equal(lab.equipped['home.poster2'][0], 'home.poster.tb', 'two hang; a third waits');
  assert.equal(grant(lab, c, 'home.poster.sj'), false);
  assert.equal(normalizeLab(lab).equipped['home.poster2'][0], 'home.poster.tb'); assert.equal(normalizeLab({ equipped: { 'av.hat': ['av.hat.crown', 5] } }).equipped['av.hat'], undefined, 'an unowned item is dropped');
});
test('shelf: states owned / gift / locked / poor / buy; a game with nothing ready lists nothing; stock floor is owned', () => {
  const lab = defaultLab(); addCoins(lab, 500);
  const me = shelf(lab, { game: 'av', ready: [] });
  const st = (id) => me.find((i) => i.id === id).state;
  assert.equal(st('av.hat.sunhat'), 'buy'); assert.equal(st('av.hat.propeller'), 'poor'); assert.equal(st('av.hat.cap'), 'gift'); assert.equal(st('av.back.satchel'), 'locked'); assert.equal(me.find((i) => i.id === 'av.hat.propeller').need, 700);
  assert.deepEqual(shelf(lab, { game: 'sj', ready: [] }), []); assert.ok(shelf(lab, { game: 'sj', ready: ['sj.skin.mint'] }).length === 1);
  assert.equal(shelf(lab, { game: 'home', ready: [] }).find((i) => i.id === 'home.floor.wood').state, 'owned');
  assert.equal(shelf(lab, { game: 'bc', ready: ['bc.veh.dump', 'bc.veh.loader'] }).length, 1, 'soon items are hidden');
});

section('quests');
const seedPlay = (lab, day, spec) => { for (const [off, games] of spec) lab.play[addDays(day, -off)] = Object.fromEntries(GAMES.map((g) => [g, games.includes(g) ? 3 : 0])); };
test('drawQuests is deterministic per (player, day) and varies across days and players; no duplicate template', () => {
  const lab = defaultLab(); seedPlay(lab, '2026-11-02', [[1, ['sj', 'tb']], [2, ['sj']], [3, ['tb', 'ww']], [5, ['sj', 'ww']]]);
  const a = drawQuests(lab, ctxAt(T0)), b = drawQuests(lab, ctxAt(T0));
  assert.deepEqual(a, b); assert.equal(new Set(a).size, 3);
  const days = new Set(); for (let i = 0; i < 30; i++) days.add(drawQuests(lab, ctxAt(at(i))).join()); assert.ok(days.size > 15);
  assert.notDeepEqual(drawQuests(lab, ctxAt(T0, { playerId: 'ben' })).join() + '|' + days.size, a.join());
});
test('property: with >= 2 played games, >= 2 of the 3 are in played games and exactly one is the nudge from the least-played game', () => {
  const r = rng(7);
  for (let trial = 0; trial < 600; trial++) {
    const lab = defaultLab(), day = addDays('2026-11-02', trial % 40);
    const n = 2 + Math.floor(r() * 4), games = GAMES.slice().sort(() => r() - 0.5).slice(0, n);
    for (let i = 0; i < 14; i++) if (r() < 0.6) lab.play[addDays(day, -i)] = Object.fromEntries(GAMES.map((g) => [g, games.includes(g) && r() < 0.7 ? 2 : 0]));
    const days = playedDays(lab, day), played = GAMES.filter((g) => days[g] > 0);
    const ids = drawQuests(lab, ctxAt(T0, { day, playerId: 'p' + trial }));
    assert.equal(ids.length, 3); assert.equal(new Set(ids).size, 3);
    const games3 = ids.map((id) => QUEST_BY_ID[id].game);
    if (played.length >= 2) {
      assert.ok(games3[0] !== games3[1] && played.includes(games3[0]) && played.includes(games3[1]), 'two home quests in different played games ' + ids.join());
      const others = GAMES.filter((g) => g !== games3[0] && g !== games3[1] && QUESTS.some((q) => q.game === g && q.nudge));   // (Case Files has no nudge quest: it makes a child wait a day)
      assert.ok(QUEST_BY_ID[ids[2]].nudge && others.includes(games3[2]), 'nudge is in a game outside the pair');
      assert.equal(days[games3[2]], Math.min(...others.map((g) => days[g])), 'from the least-played game');
    } else assert.equal(ids[2], 'any-explore', 'a child who played <= 1 game gets Play N different games');
  }
});
test('a brand-new child: the game they opened is a home quest; tiers by level; the nudge is always easy', () => {
  const ids = drawQuests(defaultLab(), ctxAt(T0, { game: 'tb' })); assert.equal(QUEST_BY_ID[ids[0]].game === 'tb' || QUEST_BY_ID[ids[1]].game === 'tb', true); assert.equal(ids[2], 'any-explore');
  assert.deepEqual([1, 4, 5, 19, 20, 99].map(tierFor), ['easy', 'easy', 'mid', 'mid', 'hard', 'hard']);
  assert.equal(targetFor('sj-words', 'hard', 0), 12); assert.equal(targetFor('sj-words', 'hard', 2), 4, 'the nudge slot is easy'); assert.equal(QUESTS.length, 19);
  for (const q of QUESTS) assert.ok(q.easy <= q.mid && q.mid <= q.hard);
});
test('text: {n} filled, single wording, the gentle wording for Fraction Fright', () => {
  assert.equal(questText({ id: 'sj-words', target: 8 }), 'Spell 8 words'); assert.equal(questText({ id: 'tb-races', target: 1 }), 'Finish a race');
  assert.equal(questText({ id: 'ff-zap', target: 6 }), 'Zap 6 fractions'); assert.equal(questText({ id: 'ff-zap', target: 6 }, true), 'Help 6 neighbors home'); assert.equal(questText({ id: 'tb-win', target: 1 }), 'Win a race');
});
test('progress counts only matching events and filters; completion pays once, in the same event; all three: one crate key, a bonus freeze', () => {
  const lab = defaultLab(), c = ctxAt(T0);
  lab.quests[c.day] = { ids: ['sj-first', 'tb-races', 'ff-waves'], drawnAt: T0, rr: 0, tier: 'easy', p: {}, done: {} };
  assert.deepEqual(questEvent(lab, c, 'sj', 'word', { firstTry: false }), [], 'a miss does not count for first-try words');
  assert.equal(questEvent(lab, c, 'tb', 'fact', {}).length, 0); assert.equal(questEvent(lab, c, 'ww', 'race', {}).length, 0, 'wrong game');
  for (let i = 0; i < 2; i++) assert.equal(questEvent(lab, c, 'sj', 'word', { firstTry: true })[0].justDone, false);
  const done1 = questEvent(lab, c, 'sj', 'word', { firstTry: true })[0];
  assert.deepEqual([done1.justDone, done1.coins, done1.xp, done1.progress, done1.target], [true, 80, 60, 3, 3]);
  assert.deepEqual(questEvent(lab, c, 'sj', 'word', { firstTry: true }), [], 'a done quest does not pay again');
  assert.equal(questEvent(lab, c, 'tb', 'race', {})[0].coins, 80);
  const before = wallet(lab).coins, r = questEvent(lab, c, 'ff', 'wave', {})[0];
  assert.deepEqual([r.justDone, r.coins, r.xp, r.allDone, r.bonusCoins, r.bonusXp, r.crateKey, r.bonusFreeze], [true, 120, 90, true, 60, 100, 'quest:' + c.day, true]);
  assert.equal(wallet(lab).coins - before, 120 + 60); assert.equal(lab.streak.bonusEarnedDays.length, 1);
  assert.deepEqual(questView(lab, c).map((q) => q.done), [true, true, true]);
});
test('any-explore counts distinct games with any event today', () => {
  const lab = defaultLab(), c = ctxAt(T0);
  lab.quests[c.day] = { ids: ['sj-runs', 'tb-win', 'any-explore'], drawnAt: T0, rr: 0, tier: 'easy', p: {}, done: {} };
  const r1 = applyEvent(lab, c, ev('sj', 'word', { firstTry: true })); assert.equal(r1.quests.find((q) => q.id === 'any-explore').progress, 1);
  const r2 = applyEvent(lab, ctxAt(T0, { session: newSession('tb') }), ev('tb', 'fact', { firstTry: true })); const q = r2.quests.find((x) => x.id === 'any-explore');
  assert.deepEqual([q.progress, q.target, q.justDone], [2, 2, true]);
});
test('any-explore: opening a game (an attach, no report) never counts; a game counts after its first reported event; the card says so', () => {
  const lab = defaultLab(), c = ctxAt(T0);
  lab.quests[c.day] = { ids: ['sj-runs', 'tb-win', 'any-explore'], drawnAt: T0, rr: 0, tier: 'easy', p: {}, done: {} };
  assert.deepEqual(questView(lab, c).find((q) => q.id === 'any-explore').progress, 0, 'nothing played yet');
  applyEvent(lab, c, ev('xx', 'word'));                                  // an unknown game or event is ignored: no play
  applyEvent(lab, c, ev('sj', 'nonsense'));
  assert.equal(questView(lab, c).find((q) => q.id === 'any-explore').progress, 0, 'unknown events do not count as playing');
  applyEvent(lab, c, ev('sj', 'testWord', { firstTry: true }));          // a Spell Jump qualifier word is a real answer
  assert.equal(questView(lab, c).find((q) => q.id === 'any-explore').progress, 1);
  const v = questView(lab, c).find((q) => q.id === 'any-explore');
  assert.equal(v.text, 'Play 2 different games'); assert.match(v.hint, /Answer something or finish a piece in each one/); assert.match(v.hint, /opening a game does not count/i);
});
test('any-explore reads today live: a swap into it and play from another device show at once, not at the next event', () => {
  const lab = defaultLab(), c = ctxAt(T0);
  lab.play[c.day] = { sj: 3, tb: 2, ff: 0, ww: 0, bc: 0, cf: 0 };         // two games already played today (e.g. on another device)
  lab.quests[c.day] = { ids: ['sj-runs', 'tb-win', 'any-explore'], drawnAt: T0, rr: 0, tier: 'easy', p: {}, done: {} };
  const e = questView(lab, c).find((q) => q.id === 'any-explore');
  assert.deepEqual([e.progress, e.target, e.done], [2, 2, false], 'the view counts both games without waiting for an event');
  const r = applyEvent(lab, c, ev('sj', 'word')); assert.equal(r.quests.find((q) => q.id === 'any-explore').justDone, true);
});
test('any-explore follows the quest day when a session runs past midnight', () => {
  const lab = defaultLab(), c = ctxAt(at(0, 7)); const y = c.day;  // 11 pm
  lab.quests[y] = { ids: ['sj-runs', 'tb-win', 'any-explore'], drawnAt: T0, rr: 0, tier: 'easy', p: {}, done: {} };
  applyEvent(lab, c, ev('sj', 'word'));
  const c2 = ctxAt(at(0, 9), { session: c.session });   // 1 am, the next day
  assert.equal(c2.day !== y, true);
  const r = applyEvent(lab, c2, ev('tb', 'fact'));
  assert.equal(c2.session.questDay, y);
  assert.equal(r.quests.find((q) => q.id === 'any-explore').justDone, true, 'a game before midnight and one after count together');
  assert.equal(questView(lab, c2).find((q) => q.id === 'any-explore').progress, 2);
});
test('the swap works once a day and not on a done quest; the swapped quest is new and keeps its slot', () => {
  const lab = defaultLab(), c = ctxAt(T0); seedPlay(lab, c.day, [[1, ['sj', 'tb', 'ww']], [2, ['sj', 'tb']]]);
  const q = ensureToday(lab, c); const before = q.ids.slice();
  q.done[before[0]] = 5;
  assert.equal(rerollQuest(lab, c, 0).reason, 'done');
  const r = rerollQuest(lab, c, 1); assert.equal(r.ok, true); assert.notEqual(q.ids[1], before[1]); assert.equal(q.ids[0], before[0]); assert.equal(q.ids[2], before[2]); assert.equal(new Set(q.ids).size, 3);
  assert.equal(rerollQuest(lab, c, 2).reason, 'used'); assert.equal(rerollQuest(lab, c, 9).reason, 'used');
  lab.opts.quests = false; assert.equal(rerollQuest(lab, c, 1).reason, 'off'); assert.deepEqual(questView(lab, c), []); assert.equal(ensureToday(lab, c), null);
  const lab2 = defaultLab(), c2 = ctxAt(T0); ensureToday(lab2, c2); const nudge = lab2.quests[c2.day].ids[2]; assert.equal(rerollQuest(lab2, c2, 2).ok, true); assert.notEqual(lab2.quests[c2.day].ids[2], nudge);
});
test('quests are drawn once; a midnight rollover mid-session keeps the day the quests were drawn', () => {
  const lab = defaultLab(), s = newSession('sj');
  const late = new Date(2026, 10, 2, 23, 50).getTime(), after = late + 20 * 60000;
  const c1 = ctxAt(late, { session: s }); const q = ensureToday(lab, c1); const ids = q.ids.slice();
  assert.equal(ensureToday(lab, c1), q, 'drawn once');
  const c2 = ctxAt(after, { session: s });
  assert.equal(c2.day, '2026-11-03'); const view = questView(lab, c2); assert.deepEqual(view.map((v) => v.id), ids, 'still yesterday\'s three');
  const game = QUEST_BY_ID[ids[0]].game, event = QUEST_BY_ID[ids[0]].events[0] || 'word';
  const rows = questEvent(lab, c2, game, event, { n: 99, firstTry: true });
  assert.ok(rows.length >= 1); assert.ok(lab.quests['2026-11-02'].p[ids[0]] > 0 || lab.quests['2026-11-02'].done[ids[0]]);
  assert.equal(lab.quests['2026-11-03'], undefined, 'no new draw while the old quests are being finished');
  assert.equal(ensureToday(lab, ctxAt(at(2), { session: newSession('sj') })).drawnAt > 0, true);
  const idle = ctxAt(after + 4 * 3600000, { session: s }); assert.equal(ensureToday(lab, idle) === lab.quests['2026-11-02'], false, 'after a long idle the new day starts');
});

section('crate');
test('odds sum to 100; the Parent Zone table says so; earn once per key; unopened oldest first', () => {
  assert.equal(CRATE_ODDS.c + CRATE_ODDS.r + CRATE_ODDS.e, 100); const t = crateOddsTable();
  assert.deepEqual(t.rows.map((r) => [r.name, r.percent]), [['Common', 86], ['Rare', 12], ['Epic', 2]]); assert.match(t.pity, /7 crates/); assert.match(t.note, /never for sale for money/);
  const lab = defaultLab(); assert.equal(earnCrate(lab, 'quest:2026-11-03', 20), true); assert.equal(earnCrate(lab, 'quest:2026-11-03', 21), false); earnCrate(lab, 'quest:2026-11-02', 10);
  assert.deepEqual(unopened(lab), ['quest:2026-11-02', 'quest:2026-11-03']);
});
test('100,000 seeded crates: rare-or-better about 21.5 % of the time and the longest gap is exactly 7', () => {
  const lab = defaultLab(), c = ctxAt(T0); let rare = 0, gap = 0, longest = 0, pityRare = 0;
  const N = 100000, keys = [];
  for (let i = 0; i < N; i++) {
    const key = 'quest:k' + i, r = rollCrate(lab, { ...c, playerId: 'mia' }, key, { ready: READY_ALL });
    lab.crates.opened[key] = { at: i + 1, id: '', coins: 0, r: r.rarity, pity: r.pity ? 1 : 0 }; keys.push(key);
    if (keys.length > 60) delete lab.crates.opened[keys.shift()];
    if (r.rarity === 'c') { gap++; longest = Math.max(longest, gap); } else { rare++; gap = 0; if (r.pity) pityRare++; }
  }
  const share = rare / N;
  assert.ok(share > 0.205 && share < 0.225, 'rare-or-better share ' + share); assert.equal(longest, 6, 'the longest run of commons is 6, so a rare-or-better comes at least every 7th crate');
  assert.ok(Math.abs(pityRare / rare - 0.86 ** 6) < 0.015, 'the pity makes up .86^6 of the rare-or-betters (a cycle ends in the guarantee when six commons run): ' + pityRare / rare);
});
test('pool: no gifts, no coin-only, nothing unready or owned; deterministic for (player, key, pool state); opening twice returns the stored result', () => {
  const lab = defaultLab(), c = ctxAt(T0);
  earnCrate(lab, 'quest:a', 1);
  const ready = ['sj.skin.mint', 'sj.skin.tiger', 'bc.veh.dump', 'tb.paint.ocean'];
  const seen = new Set(); for (let i = 0; i < 2000; i++) { const r = rollCrate(lab, { ...c, playerId: 'p' + i }, 'quest:a', { ready }); if (r.id) seen.add(r.id); }
  for (const id of seen) { const it = ITEM_BY_ID[id]; assert.equal(it.source, 'both'); assert.ok(id.startsWith('av.') || id.startsWith('pet.') || id.startsWith('home.') || ready.includes(id), id); assert.notEqual(it.rarity === undefined, true); }
  assert.ok(![...seen].some((id) => id.startsWith('bc.veh') || id === 'av.hat.cap' || id.startsWith('home.banner')), 'never gifts or coin-only');
  assert.ok([...seen].some((id) => id === 'sj.skin.mint'), 'a ready game item can drop'); assert.ok(![...seen].some((id) => id.startsWith('ww.')), 'a game that is not ready never drops');
  assert.deepEqual(rollCrate(lab, c, 'quest:a', { ready }), rollCrate(lab, c, 'quest:a', { ready }));
  const first = openCrate(lab, c, 'quest:a', { ready });
  assert.ok(first && first.again === false); assert.equal(owns(lab, first.id), true); assert.equal(lab.paid[first.id], 0);
  const again = openCrate(lab, c, 'quest:a', { ready }); assert.equal(again.again, true); assert.equal(again.id, first.id); assert.equal(Object.keys(lab.crates.opened).length, 1);
  assert.equal(openCrate(lab, c, 'quest:never', { ready }), null);
});
test('a rarity with nothing left rolls down; with nothing at all it pays coins at half the item price (150 / 600 / 1,500)', () => {
  const lab = defaultLab(), c = ctxAt(T0), ready = [];
  const pool = ITEMS.filter((i) => i.source === 'both' && (i.owner === 'av' || i.owner === 'pet' || i.owner === 'home'));
  for (const i of pool.filter((x) => x.rarity !== 'c')) lab.owned[i.id] = 1;
  const kinds = new Set(); for (let i = 0; i < 400; i++) { const r = rollCrate(lab, { ...c, playerId: 'q' + i }, 'quest:z', { ready }); kinds.add(r.rarity + (r.id ? ITEM_BY_ID[r.id].rarity : '-')); }
  assert.deepEqual([...kinds], ['cc'], 'rare and epic rolls fall to common items when no rare or epic is left');
  for (const i of pool) lab.owned[i.id] = 1;
  const coins = new Set(); for (let i = 0; i < 600; i++) { const r = rollCrate(lab, { ...c, playerId: 'q' + i }, 'quest:z', { ready }); assert.equal(r.id, null); assert.equal(r.converted, true); coins.add(r.rarity + r.coins); }
  assert.deepEqual([...coins].sort(), ['c150', 'e1500', 'r600']);
  earnCrate(lab, 'quest:z', 1); const before = wallet(lab).coins; const o = openCrate(lab, c, 'quest:z', { ready }); assert.equal(wallet(lab).coins - before, o.coins); assert.ok(o.coins > 0);
});
test('pity counts by opened order: six commons, then the seventh is rare or better', () => {
  const lab = defaultLab(), c = ctxAt(T0);
  for (let i = 0; i < 6; i++) lab.crates.opened['quest:o' + i] = { at: 10 + i, id: '', coins: 0, r: 'c', pity: 0 };
  for (let i = 0; i < 300; i++) { const r = rollCrate(lab, { ...c, playerId: 'u' + i }, 'quest:n', { ready: READY_ALL }); assert.ok(r.pity && r.rarity !== 'c'); }
  lab.crates.opened['quest:o3'].r = 'r';
  let any = false; for (let i = 0; i < 300; i++) if (rollCrate(lab, { ...c, playerId: 'u' + i }, 'quest:n', { ready: READY_ALL }).rarity === 'c') any = true; assert.ok(any, 'a rare inside the last six resets the pity');
});

section('streak (the Lab instance of the shared object)');
test('the Lab day counts once; milestone 3 earns a crate; a banked spare covers a second missed day in a week; a third breaks it', () => {
  const lab = defaultLab();
  const day = (n) => ctxAt(at(n, 0));
  assert.equal(labDayDone(lab, day(0)).counted, true); assert.equal(labDayDone(lab, day(0)).counted, false);
  labDayDone(lab, day(1)); const m = labDayDone(lab, day(2)); assert.equal(m.milestone, 3);
  assert.equal(earnLabBonusFreeze(lab, at(2)), true); assert.equal(earnLabBonusFreeze(lab, at(3)), false, 'one banked');
  assert.deepEqual(freezeView(lab, at(2)), { weeklyReady: true, bonus: 1 });
  // Mon Nov 2..Wed Nov 4 counted; miss Thu 5 and Fri 6 (same ISO week W45): the shield covers Thu, the spare covers Fri; Sat 7 counts and the streak lives
  const d = labDayDone(lab, day(5)); assert.equal(d.counted, true); assert.equal(d.count, 4); assert.equal(lab.streak.shieldUsedDays.length, 1); assert.equal(lab.streak.bonusUsedDays.length, 1);
  assert.deepEqual(freezeView(lab, at(5)), { weeklyReady: false, bonus: 0 });
  // three missed days in a week break it
  const lab2 = defaultLab(); labDayDone(lab2, day(0)); earnLabBonusFreeze(lab2, at(0));
  assert.equal(labStreakNow(lab2, at(3)), 1, 'two missed days (Tue, Wed): shield + spare');
  assert.equal(labStreakNow(lab2, at(4)), 0, 'three missed days');
  assert.equal(labDayDone(lab2, day(4)).count, 1);
  const lab3 = defaultLab(); labDayDone(lab3, day(0)); earnLabBonusFreeze(lab3, at(0));
  assert.deepEqual(labRefresh(lab3, at(3)).length, 2); assert.equal(lab3.streak.count, 1); assert.equal(labStreakNow(lab3, at(3)), 1);
});
test('earnBonusFreeze: once an ISO week and only with none banked', () => {
  const lab = defaultLab(); assert.equal(earnLabBonusFreeze(lab, at(0)), true); lab.streak.bonusUsedDays.push(addDays(dayOf(at(0)), 1)); assert.equal(freezeView(lab, at(1)).bonus, 0);
  assert.equal(earnLabBonusFreeze(lab, at(2)), false, 'already earned this ISO week'); assert.equal(earnLabBonusFreeze(lab, at(7)), true, 'next week');
});

section('family');
const fam3 = () => {
  const mk = (id, name, color) => ({ id, name, color, lab: defaultLab() });
  return [mk('ava', 'Ava', '#f00'), mk('ben', 'Ben', '#0f0'), mk('cal', 'Cal', '#00f')];
};
const setWeek = (p, wk, o, dev = 'dev001') => { const w = (p.lab.weeks[wk] = p.lab.weeks[wk] || {}); w[dev] = { xp: 0, coins: 0, zap: 0, race: 0, word: 0, ft: 0, leg: 0, job: 0, g: [], ...o }; };
test('weekNumbers sums device keys; boardFor keeps the input order; Most needs 100 XP and shares ties', () => {
  const [ava, ben, cal] = fam3(); const wk = '2026-W45';
  setWeek(ava, wk, { xp: 400, zap: 1, g: ['sj'] }, 'aaa111'); setWeek(ava, wk, { xp: 250, zap: 2, g: ['tb'] }, 'bbb222');
  const n = weekNumbers(ava.lab, wk); assert.deepEqual([n.xp, n.zap, n.g], [650, 3, ['sj', 'tb']]);
  setWeek(ben, wk, { xp: 650 }); setWeek(cal, wk, { xp: 90 });
  const b = boardFor([cal, ava, ben], wk, T0); assert.deepEqual(b.rows.map((r) => r.id), ['cal', 'ava', 'ben'], 'input order, never ranked'); assert.deepEqual(b.rows.map((r) => r.crown), [false, true, true], 'a tie shares the crown');
  assert.equal(b.mostId, 'ava'); const small = boardFor([cal], wk, T0); assert.equal(small.mostId, '', 'under 100 XP: no crown');
  assert.ok(b.rows.every((r) => !('rank' in r)));
});
test('Most improved: a younger sibling with lower XP wins; usual has a floor of 300; needs +25 % and 100 XP', () => {
  const [ava, ben, cal] = fam3(); const wk = '2026-W45';
  for (const i of [1, 2, 3]) { setWeek(ava, weekShift(wk, -i), { xp: 1200 }); setWeek(ben, weekShift(wk, -i), { xp: 700 }); setWeek(cal, weekShift(wk, -i), { xp: 150 }); }
  setWeek(ava, wk, { xp: 1250 }); setWeek(ben, wk, { xp: 760 }); setWeek(cal, wk, { xp: 520 });
  const b = boardFor([ava, ben, cal], wk, T0);
  assert.equal(b.mostId, 'ava'); assert.equal(b.improvedId, 'cal', 'Cal: 520 vs a usual of 300 (floor), +73 %'); const cr = b.rows[2]; assert.equal(cr.usual, 300); assert.equal(cr.gainPct, 73);
  assert.deepEqual(b.rows.map((r) => r.improved), [false, false, true]);
  setWeek(cal, wk, { xp: 370 }); assert.equal(boardFor([ava, ben, cal], wk, T0).improvedId, '', '+23 % is not enough');
  const [a2, b2, c2] = fam3(); setWeek(a2, wk, { xp: 800 }); assert.equal(boardFor([a2, b2, c2], wk, T0).improvedId, 'ava', 'a new player: usual 300'); assert.equal(boardFor([a2, b2, c2], wk, T0).rows[0].usual, 300);
});
test('goalFor: target = perPlayer x contributors rounded to a step; deterministic, weighted pick; explore needs 2 players; ft always', () => {
  const ps = fam3(); const day = '2026-11-03';
  for (const p of ps) p.lab.play[addDays(day, -1)] = { sj: 1, tb: 1, ff: 0, ww: 0, bc: 0 };
  ps[1].lab.play[addDays(day, -2)] = { sj: 0, tb: 0, ff: 1, ww: 0, bc: 0 }; ps[1].lab.play[addDays(day, -4)] = { sj: 0, tb: 0, ff: 1, ww: 0, bc: 0 }; ps[2].lab.play[addDays(day, -5)] = { sj: 0, tb: 0, ff: 1, ww: 0, bc: 0 };
  const a = pickGoal(ps, '2026-W45', day), b = pickGoal(ps, '2026-W45', day); assert.equal(a, b); assert.notEqual(pickGoal(ps, '2026-W46', day) + 'x' + new Set(Array.from({ length: 30 }, (_, i) => pickGoal(ps, weekShift('2026-W45', i), day))).size, null);
  const seen = new Set(Array.from({ length: 60 }, (_, i) => pickGoal(ps, weekShift('2026-W45', i), day))); assert.ok(seen.has('race') && seen.has('ft') && seen.has('word') && seen.has('zap') && !seen.has('job') && !seen.has('leg'), 'only goals someone plays: ' + [...seen]);
  const byId = Object.fromEntries(FAMILY_GOALS.map((g) => [g.id, g]));
  assert.equal(goalTarget(byId.race, ps, day), 15, 'one tb day each is a visit, not a habit: one contributor'); for (const p of ps) p.lab.play[addDays(day, -6)] = { sj: 0, tb: 1, ff: 0, ww: 0, bc: 0 };
  assert.equal(goalTarget(byId.race, ps, day), 45, '15 x 3 players'); assert.equal(goalTarget(byId.zap, ps, day), 40, 'one player plays ff on two days'); assert.equal(goalTarget(byId.ft, ps, day), 450);
  assert.equal(goalTarget(byId.explore, ps, day), 9); assert.equal(goalTarget(byId.word, ps, day), 70);
  for (const p of ps) p.lab.play[addDays(day, -7)] = { sj: 1, tb: 0, ff: 0, ww: 0, bc: 0 }; assert.equal(goalTarget(byId.word, ps, day), 210);
  ps[2].lab.play[addDays(day, -3)] = { sj: 0, tb: 0, ff: 1, ww: 0, bc: 0 }; assert.equal(goalTarget(byId.zap, ps, day), 80, 'a second player with two ff days joins the target');
  assert.ok(!pickGoalOptions(ps.slice(0, 1), day).includes('explore'), 'explore needs 2 players');
  const lab = ps[0].lab; ensureGoalPick(lab, ctxAt(T0), ps); const g = goalFor(ps, '2026-W45', { day }); assert.equal(g.recorded, true); assert.equal(lab.fam.goal, g.id); assert.equal(lab.fam.week, '2026-W45');
  assert.equal(goalFor(ps, '2026-W45', { day, gentle: true }).id, g.id);
});
function pickGoalOptions(ps, day) { const out = new Set(); for (let i = 0; i < 80; i++) out.add(pickGoal(ps, weekShift('2026-W45', i), day)); return [...out]; }
test('goalFor progress and met; the earliest recorded pick wins; the gentle text; claimGoal once per player per week, banners in order, 600 coins after all six', () => {
  const ps = fam3(), wk = '2026-W45', c = ctxAt(T0);
  ps[0].lab.picks[wk] = ['race', 500, 90]; ps[1].lab.picks[wk] = ['ft', 100, 900];
  const g0 = goalFor(ps, wk, { day: c.day }); assert.equal(g0.id, 'ft', 'the earliest `at` wins'); assert.equal(g0.target, 900);
  ps[0].lab.picks[wk] = ['ft', 100, 900]; setWeek(ps[0], wk, { ft: 400 }); setWeek(ps[1], wk, { ft: 300 }); assert.deepEqual([goalFor(ps, wk, { day: c.day }).progress, goalFor(ps, wk, { day: c.day }).met], [700, false]);
  assert.equal(claimGoal(ps[0].lab, c, wk, ps).reason, 'unmet');
  setWeek(ps[2], wk, { ft: 250 }); assert.equal(goalFor(ps, wk, { day: c.day }).met, true);
  const lab = ps[0].lab; const r = claimGoal(lab, c, wk, ps); assert.deepEqual([r.ok, r.item, r.coins], [true, 'home.banner.f1', 0]); assert.equal(claimGoal(lab, c, wk, ps).reason, 'claimed');
  assert.equal(claimGoal(ps[1].lab, c, wk, ps).item, 'home.banner.f1', 'each child claims their own');
  // the three weeks before stay claimable; older ones do not
  for (const back of [1, 2, 3, 4]) { const w = weekShift(wk, -back); ps.forEach((p) => { p.lab.picks[w] = ['ft', 1, 90]; setWeek(p, w, { ft: 100 }); }); }
  assert.equal(claimGoal(lab, c, weekShift(wk, -3), ps).ok, true); assert.equal(claimGoal(lab, c, weekShift(wk, -4), ps).reason, 'window');
  assert.equal(claimGoal(lab, c, weekShift(wk, 1), ps).reason, 'window');
  const lab6 = defaultLab(); for (let i = 1; i <= 6; i++) grant(lab6, c, 'home.banner.f' + i); lab6.picks[wk] = ['ft', 1, 90]; const before = wallet(lab6).coins;
  const rich = [{ id: 'mia', name: 'M', color: '', lab: lab6 }]; setWeek(rich[0], wk, { ft: 200 });
  assert.deepEqual(claimGoal(lab6, c, wk, rich), { ok: true, item: null, coins: 600, reason: '' }); assert.equal(wallet(lab6).coins - before, 600);
  const off = defaultLab(); off.opts.goal = false; assert.equal(claimGoal(off, c, wk, ps).reason, 'off');
  assert.equal(goalFor([{ id: 'x', name: 'X', color: '', lab: null }], wk, { day: c.day, gentle: true }).text.length > 0, true);
});
test('last week\'s crowns become stickers in the winner\'s doc', () => {
  const ps = fam3(), prev = '2026-W44'; setWeek(ps[0], prev, { xp: 900 }); setWeek(ps[2], prev, { xp: 500 }); for (const i of [1, 2, 3]) setWeek(ps[0], weekShift(prev, -i), { xp: 900 });
  const c = ctxAt(T0); assert.deepEqual(settleCrowns(ps[0].lab, c, ps, 'ava'), ['2026-W44:most']);
  assert.deepEqual(settleCrowns(ps[2].lab, c, ps, 'cal'), ['2026-W44:improved']); assert.deepEqual(settleCrowns(ps[0].lab, c, ps, 'ava'), [], 'once'); assert.deepEqual(settleCrowns(ps[1].lab, c, ps, 'ben'), []);
});

section('engine and view');
test('a report end to end: a Receipt with every field, a level-up banner, quests and the all-done crate', () => {
  const lab = defaultLab(), s = newSession('tb'); const c = ctxAt(T0, { session: s }); const q = ensureToday(lab, c);
  lab.quests[c.day] = { ...q, ids: ['tb-races', 'tb-facts', 'tb-win'], p: {}, done: {} };
  for (let i = 0; i < 5; i++) applyEvent(lab, c, ev('tb', 'fact', { firstTry: true }));
  const r = applyEvent(lab, c, ev('tb', 'race'));
  for (const f of ['ok', 'coins', 'xp', 'capped', 'combo', 'level', 'quests', 'questsAllDone', 'crate', 'unlocks', 'streak', 'day', 'bonus']) assert.ok(f in r, f);
  assert.deepEqual(Object.keys(r.combo), ['count', 'boosted', 'moment', 'name']); assert.deepEqual(Object.keys(NOOP_RECEIPT).sort(), Object.keys(r).sort());
  assert.equal(r.quests[0].id, 'tb-races'); assert.equal(r.quests[0].text, 'Finish a race');
  assert.equal(applyEvent(lab, c, ev('tb', 'fact', { firstTry: true })).quests.length, 1);
  for (let i = 0; i < 8; i++) applyEvent(lab, c, ev('tb', 'fact', { firstTry: true }));
  const last = applyEvent(lab, c, ev('tb', 'win'));
  assert.equal(last.questsAllDone, true); assert.equal(last.crate, true); assert.equal(last.quests.at(-1).justDone, true); assert.ok(last.bonus.coins >= 120 + 60);
  assert.deepEqual(unopened(lab), ['quest:' + c.day]); assert.equal(NOOP_RECEIPT.ok, false); assert.throws(() => { NOOP_RECEIPT.coins = 5; }); assert.equal(Object.isFrozen(NOOP_RECEIPT.combo), true);
});
test('the first event from a game hangs its poster; the Friday Test records a trophy and the shelf trophy; BC saves feed the gallery', () => {
  const lab = defaultLab(), c = ctxAt(T0);
  const r = applyEvent(lab, c, ev('sj', 'word', { firstTry: true })); assert.deepEqual(r.unlocks.map((u) => u.id), ['home.poster.sj']); assert.equal(r.unlocks[0].name, 'Spell Jump poster'); assert.equal(lab.equipped['home.poster'][0], 'home.poster.sj');
  assert.equal(applyEvent(lab, c, ev('sj', 'word', { firstTry: true })).unlocks.length, 0);
  const t = applyEvent(lab, c, ev('sj', 'test', { n: 18, meta: { of: 20, tier: 'gold' } }));
  assert.ok(t.unlocks.some((u) => u.id === 'home.shelf.trophy')); assert.deepEqual(lab.trophies[0], { game: 'sj', id: 'friday', tier: 'gold', at: T0, n: 18, of: 20 });
  applyEvent(lab, ctxAt(at(0, 1)), ev('sj', 'test', { n: 9, meta: { of: 20 } })); assert.equal(lab.trophies[0].tier, 'brave', 'every score gets a ribbon');
  const b = applyEvent(lab, ctxAt(T0, { session: newSession('bc') }), ev('bc', 'job', { meta: { first: true, id: 'bc.job3.2026-11-02', title: 'Low bridge!!<b>', pieces: [[0, 1, 12, 34, 5], [1, 2, 3, 4, 5, 6], 'x'] } }));
  assert.ok(b.ok); assert.equal(lab.gallery[0].title, 'Low bridge!!b'); assert.deepEqual(lab.gallery[0].pieces, [[0, 1, 12, 34, 5], [1, 2, 3, 4, 5]]);
});
test('a Lab streak of 30 days gives the medal; milestones earn a crate under their own key', () => {
  const lab = defaultLab(); let medal = false, crates = 0;
  for (let i = 0; i < 31; i++) { const r = applyEvent(lab, ctxAt(at(i), { session: newSession('sj') }), ev('sj', 'day')); if (r.unlocks.some((u) => u.id === 'pet.neck.medal')) medal = true; if (r.crate) crates++; }
  assert.equal(medal, true); assert.equal(crates, 4, 'streak 3, 7, 14, 30'); assert.ok(lab.crates.earned['streak:3'] && lab.crates.earned['streak:30']);
});
test('roundSummary and the view', () => {
  const lab = defaultLab(), s = newSession('sj'), c = ctxAt(T0, { session: s }); ensureToday(lab, c); beginRound(s, T0);
  applyEvent(lab, c, ev('sj', 'word', { firstTry: true })); applyEvent(lab, c, ev('sj', 'word', { firstTry: false }));
  const sum = roundSummary(lab, c, s); assert.deepEqual([sum.coins, sum.xp, sum.level, sum.toNext, sum.next], [6, 6, 1, 94, 2]); assert.equal(sum.quests.length, 3);
  beginRound(s, T0); assert.equal(roundSummary(lab, c, s).coins, 0);
  const v = buildView(lab, { ...c, name: 'Mia', color: '#f00' }, { ready: [] });
  for (const f of ['player', 'coins', 'level', 'streak', 'quests', 'questsDone', 'crates', 'equipped', 'owned', 'avatar', 'pet', 'trophies', 'gallery', 'opts', 'capped']) assert.ok(f in v, f);
  assert.equal(v.coins, 6); assert.equal(v.player.name, 'Mia'); assert.deepEqual(Object.keys(v.avatar.slots), ['hat', 'shirt', 'back', 'face', 'aura']); assert.equal(v.avatar.slots.back.open, false); assert.equal(v.avatar.slots.back.opensAt, 4);
  assert.deepEqual([v.pet.species, v.pet.name, v.pet.stage, v.pet.mood], ['fox', 'Pip', 1, 'happy']); assert.equal(buildView(defaultLab(), c).pet.mood, 'content');
  assert.deepEqual(Object.keys(v.streak), ['count', 'best', 'weeklyReady', 'bonus']); assert.equal(v.crates.waiting, 0);
  assert.ok(voiceTexts().length > 100 && voiceTexts().includes('Help 6 neighbors home') && voiceTexts().includes('Dump truck'));
});
test('performance: 1,000 reports through the engine in well under a second', () => {
  const lab = defaultLab(), c = ctxAt(T0); ensureToday(lab, c); const t0 = performance.now();
  for (let i = 0; i < 1000; i++) applyEvent(lab, c, ev('sj', i % 7 === 0 ? 'run' : 'word', { firstTry: i % 3 !== 0 }));
  assert.ok(performance.now() - t0 < 500, 'took ' + (performance.now() - t0));
});
test('independence: the Lab imports no game economy, save or engine module', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs'); const { join } = await import('node:path');
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  const root = new URL('../src', import.meta.url).pathname;
  for (const f of walk(root).filter((x) => x.endsWith('.js'))) {
    const imports = [...readFileSync(f, 'utf8').matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const imp of imports) {
      if (/^\.\.?\/(?!\.\.\/\.\.\/)/.test(imp) && !imp.includes('../../')) continue;
      assert.ok(!/(trail-blazer|fraction-fright|wagon-west|build-crew)/.test(imp), `${f} imports ${imp}`);
      if (/spell-jump|car-jump/.test(imp)) assert.ok(/\/src\/(meta\/(engagement|rng)|sync\/(client|merge|notify)|spelling\/(profiles|scheduler|keyboard|tts|cloudVoice)|audio)\.js$|\/ui\/(dom|icons)\.js$/.test(imp), `${f} imports ${imp}`);   // + audio, tts, cloudVoice and ui/icons: the UI's shared sound, natural voice and icons (UI stream)
    }
  }
});

finish('CORE TESTS');

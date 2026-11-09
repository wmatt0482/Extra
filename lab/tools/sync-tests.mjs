// The Lab's merge laws, transport and store, no browser: node lab/tools/sync-tests.mjs  (lab/SPEC.md §7.1 Merge laws, Transport, Store)
import assert from 'node:assert/strict';
import { T0, at, atest, dayOf, fakeStorage, finish, rng, section, test } from './testlib.mjs';
import { GAMES, defaultLab, labKey, normalizeLab, owns, totalXp, wallet } from '../src/core/model.js';
import { forgive, mergeLab, mergeLabData, setLocalDevice } from '../src/core/merge.js';
import { applyEvent, newSession } from '../src/core/engine.js';
import { buy, equip, grant } from '../src/core/shop.js';
import { earnCrate, openCrate } from '../src/core/crate.js';
import { ensureToday } from '../src/core/quests.js';
import { ITEMS } from '../src/data/catalog.js';
import { QUESTS } from '../src/data/quests.js';
import { handle, memoryStore, parseKey, PLAYER_KINDS } from '../../car-jump/src/sync/protocol.mjs';
import { addDays, weekOfDay } from '../../car-jump/src/meta/engagement.js';

const ctxAt = (t, over = {}) => ({ playerId: 'mia', device: 'dev001', now: t, day: dayOf(t), gentle: false, session: newSession('sj'), ...over });
const clone = (x) => JSON.parse(JSON.stringify(x));

section('merge laws (random docs)');
const DEVS = ['aaa111', 'bbb222', 'ccc333', 'ddd444', 'eee555'];
const BUYABLE = ITEMS.filter((i) => i.source !== 'stock');
const QIDS = QUESTS.map((q) => q.id);
function randomLab(r, i = 0) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  const some = (a, p) => a.filter(() => r() < p);
  const d = defaultLab();
  d.v = 1 + Math.floor(r() * 2); d.resetAt = r() < 0.15 ? 1000 + Math.floor(r() * 3) : 0;
  for (const k of some(DEVS, 0.6)) d.dev[k] = { c: Math.floor(r() * 3000), x: Math.floor(r() * 5000) };
  for (const it of some(BUYABLE, 0.12)) { d.owned[it.id] = 1 + Math.floor(r() * 50); if (r() < 0.7) d.paid[it.id] = it.price; }
  for (const it of some(BUYABLE, 0.05)) d.paid[it.id] = it.price;
  for (const s of some(['av.hat', 'av.shirt', 'pet.neck', 'home.wall', 'sj.skin'], 0.5)) { const mine = BUYABLE.filter((x) => x.key === s && d.owned[x.id]); d.equipped[s] = [mine.length && r() < 0.8 ? pick(mine).id : '', Math.floor(r() * 6)]; }
  d.pet = { species: pick(['fox', 'owl', 'otter', 'dino']), name: pick(['Pip', 'Max', 'Zed']), at: Math.floor(r() * 4) };
  const st = d.streak; st.lastDay = r() < 0.8 ? addDays('2026-10-20', Math.floor(r() * 12)) : ''; st.count = st.lastDay ? 1 + Math.floor(r() * 10) : 0; st.best = st.count + Math.floor(r() * 5);
  st.days = some(Array.from({ length: 12 }, (_, k) => addDays('2026-10-20', k)), 0.5); st.shieldUsedDays = some(st.days, 0.2);
  if (r() < 0.5) { st.bonusEarnedDays = some(st.days, 0.3); st.bonusUsedDays = some(st.bonusEarnedDays, 0.4); }
  st.shieldAvailableWeek = r() < 0.5 ? weekOfDay('2026-10-26') : '';
  for (let k = 0; k < 4; k++) if (r() < 0.6) { const ids = [pick(QIDS), pick(QIDS), pick(QIDS)].filter((x, j, a) => a.indexOf(x) === j); d.quests[addDays('2026-10-28', k)] = { ids, drawnAt: 1 + Math.floor(r() * 4), rr: Math.floor(r() * 2), tier: pick(['easy', 'mid']), p: Object.fromEntries(some(ids, 0.6).map((q) => [q, Math.floor(r() * 5)])), done: Object.fromEntries(some(ids, 0.3).map((q) => [q, 1 + Math.floor(r() * 9)])) }; }
  for (const k of some(['quest:2026-10-30', 'quest:2026-10-31', 'streak:3'], 0.6)) d.crates.earned[k] = 1 + Math.floor(r() * 9);
  for (const k of Object.keys(d.crates.earned)) if (r() < 0.5) d.crates.opened[k] = { at: 10 + Math.floor(r() * 3), id: r() < 0.5 ? pick(BUYABLE).id : '', coins: Math.floor(r() * 3) * 150, r: pick(['c', 'r', 'e']), pity: r() < 0.3 ? 1 : 0 };
  for (let k = 0; k < 5; k++) if (r() < 0.5) d.play[addDays('2026-10-28', k)] = Object.fromEntries(GAMES.map((g) => [g, Math.floor(r() * 4)]));
  for (const wk of ['2026-W43', '2026-W44']) if (r() < 0.7) { d.weeks[wk] = {}; for (const k of some(DEVS.slice(0, 3), 0.7)) d.weeks[wk][k] = { xp: Math.floor(r() * 900), coins: Math.floor(r() * 400), zap: Math.floor(r() * 9), race: Math.floor(r() * 9), word: Math.floor(r() * 9), ft: Math.floor(r() * 9), leg: Math.floor(r() * 3), job: Math.floor(r() * 3), g: some(GAMES, 0.4) }; }
  if (r() < 0.6) d.fam = { week: pick(['2026-W43', '2026-W44']), goal: pick(['zap', 'race', 'ft']), at: 1 + Math.floor(r() * 5) };
  if (r() < 0.5) d.picks['2026-W44'] = [pick(['zap', 'race', 'ft']), 1 + Math.floor(r() * 5), 50 * Math.floor(r() * 9)];
  if (r() < 0.4) d.claimed['fam:2026-W44'] = 1 + Math.floor(r() * 9);
  d.crowns = some(['2026-W41:most', '2026-W42:improved', '2026-W43:most', '2026-W44:most'], 0.4);
  d.trophies = some([{ game: 'sj', id: 'friday', tier: 'gold', at: 5, n: 18, of: 20 }, { game: 'sj', id: 'friday', tier: 'bronze', at: 9, n: 11, of: 20 }, { game: 'sj', id: 'friday', tier: 'brave', at: 12, n: 3, of: 20 }], 0.5);
  d.gallery = some([{ id: 'bc.job3.a', at: 3, kind: 'job', title: 'Low bridge', pieces: [[1, 2, 3, 4, 5]] }, { id: 'bc.job3.b', at: 7, kind: 'site', title: 'Site', pieces: [] }, { id: 'bc.job3.a', at: 9, kind: 'job', title: 'Low bridge 2', pieces: [[1, 2, 3, 4, 6]] }], 0.5);
  for (const g of some(GAMES, 0.5)) d.best[g] = Math.floor(r() * 12);
  for (const g of some(GAMES, 0.5)) d.sum[g] = { level: pick(['Speller LV 3', 'Rider LV 2', '']), line: pick(['24 words mastered', '3 cases closed']), today: pick(['Today: 3 / 8 words', '']), lastPlayed: pick([0, 1000, 2000, 2000, 3000]) };
  d.opts = { quests: r() < 0.8, board: r() < 0.8, goal: r() < 0.8, at: Math.floor(r() * 4) };
  for (const g of some(GAMES, 0.5)) d.seen.games[g] = 1 + Math.floor(r() * 9);
  d.seen.welcome = r() < 0.5 ? 1 + Math.floor(r() * 9) : 0;
  d.coinDay = r() < 0.7 ? { day: addDays('2026-10-28', Math.floor(r() * 3)), n: Math.floor(r() * 1800), ev: r() < 0.5 ? { 'tb.ghostBeat': Math.floor(r() * 4) } : {} } : { day: '', n: 0, ev: {} };
  return normalizeLab(d, 0);
}
const same = (x, y, msg) => assert.deepEqual(x, y, msg);
test('commutative, associative, idempotent on 1,500 random docs; the result is already normalized', () => {
  const r = rng(11);
  for (let i = 0; i < 1500; i++) {
    const a = randomLab(r), b = randomLab(r), c = randomLab(r);
    const ab = mergeLabData(a, b);
    same(ab, mergeLabData(b, a), 'commutative ' + i);
    same(mergeLabData(ab, c), mergeLabData(a, mergeLabData(b, c)), 'associative ' + i);
    same(mergeLabData(a, a), a, 'idempotent ' + i);
    same(mergeLabData(ab, a), ab, 'absorbs ' + i);
    same(mergeLabData(ab, ab), ab);
    same(normalizeLab(ab, 0), ab, 'stable under normalize ' + i);
  }
});
test('a merge never loses: coins earned, items owned, purchases paid, best, streak best (monotone), unless a reset wins', () => {
  const r = rng(5);
  for (let i = 0; i < 500; i++) {
    const a = randomLab(r), b = randomLab(r); a.resetAt = 0; b.resetAt = 0;
    const m = mergeLabData(a, b);
    for (const d of [a, b]) {
      for (const k of Object.keys(d.dev)) assert.ok(m.dev[k].c >= d.dev[k].c && m.dev[k].x >= d.dev[k].x);
      for (const k of Object.keys(d.owned)) assert.ok(m.owned[k] > 0); for (const k of Object.keys(d.paid)) assert.ok(m.paid[k] >= d.paid[k]);
      assert.ok(m.streak.best >= d.streak.best); for (const g of GAMES) assert.ok(m.best[g] >= d.best[g]);
    }
  }
});
test('an older build\'s doc (without picks, spare freezes, coinDay events, the poster hooks) never erases them', () => {
  const r = rng(3), a = randomLab(r); a.resetAt = 0;
  a.picks['2026-W44'] = ['ft', 1, 900]; a.streak.bonusEarnedDays = ['2026-10-26']; a.streak.bonusUsedDays = []; a.coinDay = { day: '2026-10-29', n: 30, ev: { 'tb.ghostBeat': 2 } };
  const old = clone(a); delete old.picks; delete old.streak.bonusEarnedDays; delete old.streak.bonusUsedDays; delete old.coinDay.ev; delete old.crowns; delete old.claimed;
  const m = mergeLabData(a, old); assert.deepEqual(m.picks, a.picks); assert.deepEqual(m.streak.bonusEarnedDays, ['2026-10-26']); assert.equal(m.coinDay.ev['tb.ghostBeat'], 2);
  same(mergeLabData(old, a), m);
  assert.equal(mergeLabData(null, a).dev.aaa111?.c, a.dev.aaa111?.c); same(mergeLabData(undefined, undefined), defaultLab());
});
test('two offline devices each earn and each buy a different item: both purchases survive and both are charged', () => {
  const base = defaultLab(); base.dev.aaa111 = { c: 1000, x: 0 };
  const A = clone(base), B = clone(base);
  A.dev.aaa111.c += 150; buy(A, ctxAt(T0, { device: 'aaa111' }), 'av.hat.sunhat', { ready: [] });
  B.dev.bbb222 = { c: 200, x: 0 }; buy(B, ctxAt(T0 + 5, { device: 'bbb222' }), 'av.hat.headband', { ready: [] });
  const m = mergeLab({ updatedAt: 1, data: A }, { updatedAt: 2, data: B }, { device: 'aaa111' });
  assert.ok(owns(m, 'av.hat.sunhat') && owns(m, 'av.hat.headband')); assert.deepEqual(wallet(m), { earned: 1350, paid: 600, coins: 750 });
  same(mergeLab({ updatedAt: 2, data: B }, { updatedAt: 1, data: A }, { device: 'bbb222' }).owned, m.owned);
});
test('an overspend across two offline devices is forgiven to a wallet of 0, never charged back; new coins then count in full', () => {
  const base = defaultLab(); base.dev.aaa111 = { c: 400, x: 0 };
  const A = clone(base), B = clone(base);
  buy(A, ctxAt(T0), 'av.hat.sunhat', { ready: [] }); buy(B, ctxAt(T0), 'av.hat.headband', { ready: [] });
  const m = mergeLab({ updatedAt: 1, data: A }, { updatedAt: 2, data: B }, { device: 'bbb222' });
  assert.ok(owns(m, 'av.hat.sunhat') && owns(m, 'av.hat.headband')); assert.deepEqual(wallet(m), { earned: 600, paid: 600, coins: 0 }); assert.equal(m.dev.bbb222.c, 200, 'the local device\'s counter was raised');
  m.dev.bbb222.c += 50; assert.equal(wallet(m).coins, 50);
  same(mergeLab({ updatedAt: 1, data: m }, { updatedAt: 2, data: A }, { device: 'bbb222' }).dev.bbb222, { c: 250, x: 0 });
  const lone = defaultLab(); lone.paid['av.hat.sunhat'] = 300; assert.equal(forgive(lone, 'zzz999'), 300); assert.equal(wallet(lone).coins, 0); setLocalDevice('_');
});
test('the same item bought on two devices is charged once; a reset wins whole; per-slot equip is last-writer-wins', () => {
  const base = defaultLab(); base.dev.aaa111 = { c: 1000, x: 0 }; const A = clone(base), B = clone(base);
  buy(A, ctxAt(T0), 'av.hat.sunhat', { ready: [] }); buy(B, ctxAt(T0 + 9), 'av.hat.sunhat', { ready: [] });
  assert.equal(wallet(mergeLabData(A, B)).coins, 700);
  const R = clone(A); const reset = defaultLab(); reset.resetAt = 5000; reset.dev.bbb222 = { c: 3, x: 1 };
  same(mergeLabData(R, reset), normalizeLab(reset, 0)); same(mergeLabData(reset, R), normalizeLab(reset, 0)); assert.equal(owns(mergeLabData(R, reset), 'av.hat.sunhat'), false);
  const E1 = clone(base), E2 = clone(base); for (const L of [E1, E2]) { grant(L, ctxAt(T0), 'av.hat.sunhat'); grant(L, ctxAt(T0), 'av.hat.headband'); }
  equip(E1, ctxAt(T0 + 10), 'av.hat', 'av.hat.sunhat'); equip(E2, ctxAt(T0 + 20), 'av.hat', 'av.hat.headband');
  assert.equal(mergeLabData(E1, E2).equipped['av.hat'][0], 'av.hat.headband'); assert.equal(mergeLabData(E2, E1).equipped['av.hat'][0], 'av.hat.headband');
});
test('quests: the earlier-drawnAt draw wins, progress merges by max, done by union; a swap beats the unswapped draw', () => {
  const day = dayOf(T0);
  const A = defaultLab(), B = defaultLab();
  A.quests[day] = { ids: ['sj-words', 'tb-races', 'ww-leg'], drawnAt: 100, rr: 0, tier: 'easy', p: { 'sj-words': 2, 'tb-races': 1 }, done: { 'tb-races': 50 } };
  B.quests[day] = { ids: ['sj-runs', 'tb-win', 'bc-job'], drawnAt: 200, rr: 0, tier: 'mid', p: { 'sj-words': 4, 'sj-runs': 1 }, done: {} };
  const m = mergeLabData(A, B); assert.deepEqual(m.quests[day].ids, ['sj-words', 'tb-races', 'ww-leg']); assert.equal(m.quests[day].drawnAt, 100);
  assert.deepEqual(m.quests[day].p, { 'sj-runs': 1, 'sj-words': 4, 'tb-races': 1 }); assert.deepEqual(m.quests[day].done, { 'tb-races': 50 });
  const S = clone(A); S.quests[day].ids = ['sj-words', 'ww-stars', 'ww-leg']; S.quests[day].rr = 1; assert.deepEqual(mergeLabData(A, S).quests[day].ids, ['sj-words', 'ww-stars', 'ww-leg']);
});
test('the same crate opened on two devices converges; the earlier opening is kept and both items stay owned', () => {
  const base = defaultLab(); earnCrate(base, 'quest:2026-11-02', 10);
  const A = clone(base), B = clone(base), ready = ITEMS.filter((i) => !i.soon).map((i) => i.id);
  const ra = openCrate(A, ctxAt(T0, { device: 'aaa111' }), 'quest:2026-11-02', { ready }), rb = openCrate(B, ctxAt(T0 + 50, { device: 'bbb222' }), 'quest:2026-11-02', { ready });
  assert.equal(ra.id, rb.id, 'the roll is seeded, so both devices got the same item');
  const m = mergeLabData(A, B); assert.equal(m.crates.opened['quest:2026-11-02'].at, T0); assert.ok(owns(m, ra.id)); same(m, mergeLabData(B, A));
});
test('streak: spare-freeze lists are unioned by the shared mergeStreak; a lab streak merges like the games\'', () => {
  const A = defaultLab(), B = defaultLab(); A.streak = { count: 3, best: 3, lastDay: '2026-11-02', shieldAvailableWeek: '', shieldUsedDays: [], days: ['2026-11-02'], bonusEarnedDays: ['2026-11-02'], bonusUsedDays: [] };
  B.streak = { count: 5, best: 5, lastDay: '2026-11-03', shieldAvailableWeek: '2026-W45', shieldUsedDays: [], days: ['2026-11-03'] };
  const m = mergeLabData(A, B).streak; assert.deepEqual([m.count, m.lastDay, m.best, m.bonusEarnedDays, m.bonusUsedDays], [5, '2026-11-03', 5, ['2026-11-02'], []]);
});

section('transport (car-jump/src/sync/protocol.mjs)');
const CODE = 'K7QX-M2PA';
const call = (store, method, path, body, extra = {}) => handle({ method, path, contentType: 'application/json', body: body == null ? null : JSON.stringify(body), ...extra }, store).then((r) => ({ status: r.status, json: JSON.parse(r.body) }));
const doc = (rev, data) => ({ rev, updatedAt: T0, deviceId: 'dlaptop', data });
await atest('the kind `lab` is accepted with the rev rule, 409 hands back the stored doc, GET returns it for each player; x.labs is refused', async () => {
  assert.deepEqual(PLAYER_KINDS.at(-1), 'lab'); assert.deepEqual(parseKey('pmia.lab'), { kind: 'lab', playerId: 'pmia' }); assert.equal(parseKey('pmia.labs'), null); assert.equal(parseKey('pmia.lab.lab'), null); assert.equal(parseKey('lab'), null);
  const st = memoryStore();
  assert.equal((await call(st, 'POST', `/api/family/${CODE}`, doc(1, { v: 1, players: [{ id: 'pmia', name: 'Mia' }, { id: 'pleo', name: 'Leo' }], removedPlayers: [] }))).status, 201);
  const mia = defaultLab(); mia.dev.aaa111 = { c: 12, x: 34 };
  assert.equal((await call(st, 'PUT', `/api/family/${CODE}/pmia.lab`, doc(1, mia))).status, 200);
  const conflict = await call(st, 'PUT', `/api/family/${CODE}/pmia.lab`, doc(1, defaultLab()));
  assert.equal(conflict.status, 409); assert.deepEqual(conflict.json.doc.data.dev, mia.dev);
  assert.equal((await call(st, 'PUT', `/api/family/${CODE}/pmia.lab`, doc(2, mia))).status, 200);
  assert.equal((await call(st, 'PUT', `/api/family/${CODE}/pmia.labs`, doc(1, mia))).status, 400);
  const g = await call(st, 'GET', `/api/family/${CODE}`);
  assert.deepEqual(Object.keys(g.json.players.pmia).at(-1), 'lab'); assert.deepEqual(g.json.players.pmia.lab.data.dev, mia.dev); assert.equal(g.json.players.pleo.lab, null);
  const big = await call(st, 'PUT', `/api/family/${CODE}/pleo.lab`, doc(1, { ...defaultLab(), pad: 'x'.repeat(600 * 1024) }));
  assert.equal(big.status, 400);
  const full = defaultLab(); for (let i = 0; i < 12; i++) full.gallery.push({ id: 'g' + i, at: i + 1, kind: 'job', title: 'T', pieces: Array.from({ length: 48 }, () => [99, 255, 9999, 9999, 9999]) });
  for (let i = 0; i < 6; i++) full.weeks[`2026-W${40 + i}`] = Object.fromEntries(DEVS.map((k) => [k, { xp: 99999, coins: 99999, zap: 9999, race: 9999, word: 9999, ft: 9999, leg: 99, job: 99, g: GAMES.slice() }]));
  assert.ok(JSON.stringify(normalizeLab(full, 0)).length < 40000, 'a full doc stays under the 40 KB target: ' + JSON.stringify(normalizeLab(full, 0)).length);
});

section('the client registry');
{
  const mem = new Map(); const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; } };
  const { createSyncClient, syncKeyFor, syncKinds, SYNC_KEY } = await import('../../car-jump/src/sync/client.js');
  const { registerLabSync, markLabDocsDirty } = await import('../src/sync.js');
  await atest('registerLabSync round-trips (twice is safe); syncKeyFor maps both ways; a late registration marks the existing docs dirty', async () => {
    assert.equal(syncKeyFor(labKey('mia')), null, 'not registered yet');
    const fam = { v: 1, players: [{ id: 'mia', name: 'Mia', color: '#ff3b5c', createdAt: T0, updatedAt: T0 }], pinHash: null, pinUpdatedAt: 0, options: {}, optionsUpdatedAt: {}, removedPlayers: [], migrated: true };
    mem.set('spellJump.family', JSON.stringify(fam));
    mem.set(SYNC_KEY, JSON.stringify({ v: 1, code: CODE, deviceId: 'dlaptop', lastSync: 0, lastError: '', keys: { family: { rev: 1, updatedAt: T0, dirty: false, hash: 'x' } } }));
    const fetchLog = [];
    const fakeFetch = async (url, init) => { fetchLog.push(`${init.method} ${url}`); const body = init.body ? JSON.parse(init.body) : null; return { status: 200, json: async () => (init.method === 'GET' ? { family: null, players: {} } : { ok: true, rev: body.rev, updatedAt: body.updatedAt }) }; };
    const client = createSyncClient({}, { fetch: fakeFetch });          // the client exists BEFORE the Lab registers
    mem.set(labKey('mia'), JSON.stringify(normalizeLab({ dev: { aaa111: { c: 5, x: 5 } } }, 0)));
    assert.equal(client.status().pending, 0);
    assert.equal(registerLabSync(), true); assert.equal(registerLabSync(), false); assert.ok(syncKinds().includes('lab'));
    assert.equal(syncKeyFor(labKey('mia')), 'mia.lab'); assert.equal(syncKeyFor('learningLab.Bad Id.lab'), null); assert.equal(syncKeyFor('learningLab.mia.labs'), null);
    markLabDocsDirty(['mia']);
    assert.equal(client.state.keys['mia.lab'].dirty, true); assert.equal(client.status().pending, 1);
    await client.pushNow(); assert.deepEqual(fetchLog, [`PUT /api/family/${CODE}/mia.lab`]); assert.equal(JSON.parse(mem.get(SYNC_KEY)).keys['mia.lab'].rev, 1);
    client.leave();
  });
  await atest('the client merges a 409 with mergeLab: two offline devices\' coins and purchases both survive', async () => {
    const { localWrite } = await import('../../car-jump/src/sync/notify.js');
    const server = memoryStore(); await call(server, 'POST', `/api/family/${CODE}`, doc(1, { v: 1, players: [{ id: 'mia', name: 'Mia' }], removedPlayers: [] }));
    const devices = { A: { mem: new Map(), key: 'aaa111' }, B: { mem: new Map(), key: 'bbb222' } };
    const run = async (name, fn) => {                                     // one device at a time: swap the global storage the client reads
      const d = devices[name]; globalThis.localStorage = { getItem: (k) => (d.mem.has(k) ? d.mem.get(k) : null), setItem: (k, v) => d.mem.set(k, String(v)), removeItem: (k) => d.mem.delete(k), key: (i) => [...d.mem.keys()][i] ?? null, get length() { return d.mem.size; } };
      setLocalDevice(d.key);
      const fetchFn = async (url, init) => { const path = new URL(url, 'http://x').pathname; const r = await handle({ method: init.method, path, contentType: 'application/json', body: init.body || null }, server); if (process.env.DBG) console.log(name, init.method, path, r.status, r.body.slice(0, 120)); return { status: r.status, json: async () => JSON.parse(r.body) }; };
      if (!d.mem.has(SYNC_KEY)) seedFam(d);
      const c = createSyncClient({}, { fetch: fetchFn });
      try { return await fn(c, d); } finally { const keep = d.mem.get(SYNC_KEY); c.leave(); if (keep) d.mem.set(SYNC_KEY, keep); }      // leave() only stops the timers; the device's sync state stays
    };
    const seedFam = (d) => { d.mem.set('spellJump.family', JSON.stringify({ v: 1, players: [{ id: 'mia', name: 'Mia', color: '#ff3b5c', createdAt: T0, updatedAt: T0 }], pinHash: null, pinUpdatedAt: 0, options: {}, optionsUpdatedAt: {}, removedPlayers: [], migrated: true })); d.mem.set(SYNC_KEY, JSON.stringify({ v: 1, code: CODE, deviceId: 'd' + d.key, lastSync: 0, lastError: '', keys: { family: { rev: 1, updatedAt: T0, dirty: false, hash: 'x' } } })); };
    const edit = (c, d, fn) => { const L = JSON.parse(d.mem.get(labKey('mia'))); fn(L); d.mem.set(labKey('mia'), JSON.stringify(L)); localWrite(labKey('mia')); };
    const shared = defaultLab(); shared.dev.aaa111 = { c: 1000, x: 50 };
    await run('A', async (c, d) => { d.mem.set(labKey('mia'), JSON.stringify(shared)); localWrite(labKey('mia')); await c.pushNow(); });          // A pushes the shared start
    await run('B', async (c, d) => { await c.pullNow(); assert.equal(wallet(JSON.parse(d.mem.get(labKey('mia')))).coins, 1000, 'B pulled A\'s doc'); });
    await run('A', async (c, d) => edit(c, d, (L) => { L.dev.aaa111.c += 150; buy(L, ctxAt(T0), 'av.hat.sunhat', { ready: [] }); }));                      // A, offline: earns and buys
    await run('B', async (c, d) => { edit(c, d, (L) => { L.dev.bbb222 = { c: 200, x: 20 }; buy(L, ctxAt(T0), 'av.hat.headband', { ready: [] }); }); await c.pushNow(); });   // B, offline: earns and buys; B syncs first
    await run('A', async (c, d) => { await c.pushNow(); });                        // A pushes: 409, merged by mergeLab, retried
    const final = await run('B', async (c, d) => { await c.pullNow(); return JSON.parse(d.mem.get(labKey('mia'))); });
    assert.ok(owns(final, 'av.hat.sunhat') && owns(final, 'av.hat.headband'), 'both purchases survive'); assert.deepEqual(wallet(final), { earned: 1350, paid: 600, coins: 750 });
    const onServer = JSON.parse(server.map.get(`${CODE}/mia.lab`).text).data; assert.deepEqual(wallet(onServer), wallet(final));
    assert.equal(wallet(await run('A', async (c, d) => { await c.pullNow(); return JSON.parse(d.mem.get(labKey('mia'))); })).coins, 750, 'A converged too');
  });
  globalThis.localStorage = prev; if (!prev) delete globalThis.localStorage;
}

section('per-game summaries');
test('summary merge: the later lastPlayed wins per game; a tie is decided the same way on both sides; an old doc without sum never erases one', () => {
  const a = defaultLab(), b = defaultLab();
  a.sum.sj = { level: 'Speller LV 3', line: '24 words mastered', today: 'Today: 3 / 8 words', lastPlayed: 2000 };
  b.sum.sj = { level: 'Speller LV 2', line: '20 words mastered', today: '', lastPlayed: 1000 };
  b.sum.cf = { level: 'Detective', line: '3 cases closed', today: '', lastPlayed: 500 };
  const m = mergeLabData(a, b);
  assert.equal(m.sum.sj.level, 'Speller LV 3', 'later lastPlayed wins'); assert.equal(m.sum.cf.line, '3 cases closed', 'the other game is kept');
  assert.deepEqual(mergeLabData(b, a), m, 'commutative');
  const tie1 = defaultLab(), tie2 = defaultLab();
  tie1.sum.tb = { level: 'Rider LV 1', line: 'a', today: '', lastPlayed: 700 }; tie2.sum.tb = { level: 'Rider LV 1', line: 'b', today: '', lastPlayed: 700 };
  assert.deepEqual(mergeLabData(tie1, tie2), mergeLabData(tie2, tie1), 'a tie picks the same row on both sides');
  const old = clone(a); delete old.sum;
  assert.deepEqual(mergeLabData(a, old).sum, a.sum, 'a doc from an older build keeps the summaries');
  assert.deepEqual(mergeLabData(old, a).sum, a.sum);
  const viaSync = mergeLab({ updatedAt: 1, data: a }, { updatedAt: 2, data: b }); assert.equal(viaSync.sum.sj.level, 'Speller LV 3');
});
test('normalize: summaries keep only the six games, clean and cut the text, drop empty rows, and are a fixed point', () => {
  const n = normalizeLab({ sum: { sj: { level: '<b>Speller LV 3</b>' + 'x'.repeat(60), line: '24 words mastered!', today: 'Today: 3 / 8 words', lastPlayed: 12.7 }, zz: { level: 'x', lastPlayed: 1 }, tb: {}, ww: 5, cf: { level: '', line: '', today: '', lastPlayed: 9 } } }, 0);
  assert.deepEqual(Object.keys(n.sum), ['cf', 'sj']);
  assert.ok(n.sum.sj.level.length <= 28 && !/[<>]/.test(n.sum.sj.level)); assert.equal(n.sum.sj.today, 'Today: 3 / 8 words'); assert.equal(n.sum.sj.lastPlayed, 12);
  assert.deepEqual(normalizeLab(n, 0), n);
});

section('the store (a fake localStorage)');
const { createLabStore } = await import('../src/store.js');
const { onLocalWrite } = await import('../../car-jump/src/sync/notify.js');
const FAM = { v: 1, players: [{ id: 'mia', name: 'Mia', color: '#ff3b5c', createdAt: 1, updatedAt: 1 }, { id: 'ben', name: 'Ben', color: '#3b7dd9', createdAt: 2, updatedAt: 2 }], pinHash: null, pinUpdatedAt: 0, options: {}, optionsUpdatedAt: {}, removedPlayers: [] };
const mkStore = (seed = {}, o = {}) => { const ls = fakeStorage({ 'spellJump.family': JSON.stringify(FAM), ...seed }); let t = T0; const store = createLabStore({ storage: ls, now: () => t, deviceKey: 'mia001', sync: false, ...o }); return { ls, store, tick: (ms) => { t += ms; }, setNow: (x) => { t = x; } }; };
const attach = (store, id = 'mia', game = 'sj') => store.attach({ game, playerId: id, name: id === 'mia' ? 'Mia' : 'Ben', color: '#f00' });
test('report: NOOP when nobody is attached; a Receipt after attach; writes are debounced, and immediate on leg / job / test / day / level-up / crate', () => {
  const { ls, store } = mkStore();
  assert.equal(store.report({ game: 'sj', event: 'word', firstTry: true }).ok, false);
  attach(store); assert.ok(ls.map.has(labKey('mia')), 'attach writes a fresh doc');
  const written = []; const off = onLocalWrite((k) => written.push(k));
  const r = store.report({ game: 'sj', event: 'word', firstTry: true }); assert.equal(r.ok, true); assert.equal(r.coins, 4);
  assert.equal((JSON.parse(ls.getItem(labKey('mia'))).dev.mia001 || { c: 0 }).c, 0, 'not written yet (400 ms debounce)'); assert.deepEqual(written, []);
  const stored = () => JSON.parse(ls.getItem(labKey('mia'))).dev.mia001.c, memory = () => store.doc().dev.mia001.c;
  store.flush(); assert.equal(stored(), memory()); const c1 = stored(); assert.ok(c1 >= 4); assert.deepEqual(written, [labKey('mia')]);
  store.report({ game: 'sj', event: 'word', firstTry: true }); assert.equal(stored(), c1, 'debounced');
  store.report({ game: 'sj', event: 'day' }); assert.equal(stored(), memory(), 'day writes at once'); assert.ok(memory() >= c1 + 4 + 10);
  const c2 = memory(); store.report({ game: 'ww', event: 'leg' }); assert.equal(stored(), memory(), 'leg writes at once'); assert.ok(memory() >= c2 + 24);
  off(); assert.ok(written.length >= 3);
});
test('store.summary: stored per player per game, persisted, ignored when older, and shown on the view as seven cards', () => {
  const { ls, store, setNow } = mkStore(); assert.equal(store.summary('sj', { level: 'x', lastPlayed: 1 }), false, 'nobody attached');
  attach(store); const seen = []; store.subscribe((e) => seen.push(e.type));
  assert.equal(store.summary('sj', { level: 'Speller LV 3', line: '24 words mastered', today: 'Today: 3 / 8 words', lastPlayed: T0 - 86400000 }), true); assert.ok(seen.includes('summary'));
  assert.equal(store.summary('sj', { level: 'Speller LV 1', line: 'old', lastPlayed: T0 - 2 * 86400000 }), false, 'an older row is ignored');
  assert.equal(store.summary('nope', { level: 'x' }), false); assert.equal(store.summary('tb', null), false); assert.equal(store.summary('tb', 'x'), false);
  store.flush(); assert.equal(JSON.parse(ls.getItem(labKey('mia'))).sum.sj.line, '24 words mastered');
  const v = store.view(); assert.equal(v.games.length, 7); assert.deepEqual(v.games.map((g) => g.game), ['sj', 'tb', 'ff', 'ww', 'bc', 'cf', 'sq']);
  const sj = v.games[0]; assert.deepEqual([sj.played, sj.level, sj.line, sj.today, sj.lastLabel], [true, 'Speller LV 3', '24 words mastered', 'Today: 3 / 8 words', 'Yesterday']);
  const tb = v.games[1]; assert.deepEqual([tb.played, tb.lastLabel, tb.level], [false, '', '']); assert.ok(tb.pitch.length > 10);
  store.summary('sj', { level: 'Speller LV 4' }); assert.equal(store.view().games[0].level, 'Speller LV 4', 'no lastPlayed means now'); assert.equal(store.view().games[0].lastLabel, 'Today');
  assert.equal(store.summary('sj', { level: 'Speller LV 4' }), false, 'the same row again is not a change');
  store.report({ game: 'ww', event: 'word', firstTry: true }); assert.equal(store.view().games[3].played, true, 'a game with play history but no summary counts as played');
});
test('a doc replaced behind the store\'s back (the sync client, another tab) is merged, not overwritten', () => {
  const { ls, store } = mkStore(); attach(store);
  store.report({ game: 'sj', event: 'word', firstTry: true }); store.flush();
  const other = JSON.parse(ls.getItem(labKey('mia'))); other.dev.zzz999 = { c: 500, x: 70 }; other.owned['av.hat.sunhat'] = 5; other.paid['av.hat.sunhat'] = 300;
  ls.setItem(labKey('mia'), JSON.stringify(other));
  store.report({ game: 'sj', event: 'word', firstTry: true });                 // unsaved local change + the foreign write
  store.flush();
  const now = JSON.parse(ls.getItem(labKey('mia')));
  assert.equal(now.dev.zzz999.c, 500); assert.equal(now.dev.mia001.c, 8); assert.equal(wallet(now).coins, 8 + 500 - 300); assert.ok(now.owned['av.hat.sunhat']);
  assert.equal(store.doc().dev.zzz999.c, 500);
});
test('a blocked or throwing storage never throws out of report; the doc lives in memory', () => {
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const store = createLabStore({ storage: bad, now: () => T0, sync: false });
  assert.doesNotThrow(() => attach(store)); const r = store.report({ game: 'sj', event: 'word', firstTry: true });
  assert.equal(r.ok, true); assert.equal(r.coins, 4); assert.doesNotThrow(() => store.flush()); assert.equal(store.view().coins, 4);
  const memOnly = createLabStore({ storage: null, now: () => T0, sync: false }); attach(memOnly); assert.equal(memOnly.report({ game: 'tb', event: 'race' }).coins, 4);
  for (const bogus of [null, undefined, 5, { game: 'sj' }, { event: 'word' }, { game: {}, event: [] }]) assert.doesNotThrow(() => store.report(bogus));
});
test('a corrupt doc is kept at <key>.corrupt and replaced; a doc from a newer build is not downgraded; the device key persists', () => {
  const { ls, store } = mkStore({ [labKey('mia')]: '{not json' }); attach(store);
  assert.equal(ls.getItem(labKey('mia') + '.corrupt'), '{not json'); assert.equal(store.view().coins, 0);
  const s2 = mkStore({ [labKey('mia')]: JSON.stringify({ v: 7, dev: { aaa111: { c: 9, x: 9 } }, future: { a: 1 } }) }); attach(s2.store); s2.store.flush();
  assert.equal(JSON.parse(s2.ls.getItem(labKey('mia'))).v, 7); assert.equal(s2.store.view().coins, 9);
  const s3 = createLabStore({ storage: fakeStorage(), now: () => T0, sync: false }); assert.match(s3.device, /^[a-z0-9]{6}$/);
});
test('buy / equip / crates / quests / goal / pet / switches / reset through the store', () => {
  const { ls, store, setNow } = mkStore(); attach(store); store.__test.grantCoins(9000); store.setReady(['bc.veh.dump', 'sj.skin.mint']);
  assert.equal(store.buy('bc.veh.dump').ok, true); assert.equal(store.view().coins, 1000); assert.equal(store.doc().owned['bc.veh.dump'] > 0, true);
  assert.equal(store.buy('sj.skin.mint').ok, true); assert.equal(store.equip('sj.skin', 'sj.skin.mint'), true); assert.equal(store.view().equipped['sj.skin'], 'sj.skin.mint');
  assert.equal(store.buy('sj.skin.tiger').reason, 'notready');
  assert.equal(store.setPet({ species: 'owl', name: 'Hootie Mc' }), true); assert.deepEqual([store.view().pet.species, store.view().pet.name], ['owl', 'Hootie Mc']);
  store.__test.setQuests(['tb-races', 'tb-facts', 'tb-win']); store.beginRound('tb');
  store.report({ game: 'tb', event: 'race' }); for (let i = 0; i < 6; i++) store.report({ game: 'tb', event: 'fact', firstTry: true }); const last = store.report({ game: 'tb', event: 'win' });
  assert.equal(last.questsAllDone, true); assert.equal(last.crate, true); assert.equal(store.view().crates.waiting, 1);
  const open = store.openCrate(); assert.ok(open && open.again === false); assert.equal(store.view().crates.waiting, 0); assert.equal(store.openCrate(), null);
  assert.equal(store.setOpt('quests', false), true); assert.deepEqual(store.view().quests, []); assert.equal(store.setOpt('quests', true), true); assert.equal(store.view().quests.length, 3);
  assert.equal(store.setOpt('nope', true), false); assert.equal(store.rerollQuest(0).reason, 'done', 'all three are done');
  const day1 = store.__test.advanceDay(); assert.equal(day1, dayOf(T0 + 86400000)); assert.equal(store.view().quests.length, 3, 'a new day: new quests');
  assert.equal(store.rerollQuest(0).ok, true); assert.equal(store.rerollQuest(1).reason, 'used');
  store.flush(); const kept = store.view().coins;
  assert.equal(store.resetMe(), true); assert.equal(store.view().coins, 0); assert.ok(JSON.parse(ls.getItem(labKey('mia'))).resetAt > 0);
  void kept; void setNow;
});
test('family: the board and the goal read the siblings\' mirrored docs; the pick is recorded; a goal can be claimed', () => {
  const s = mkStore(); attach(s.store);
  const ben = defaultLab(); ben.weeks['2026-W45'] = { ben001: { xp: 400, coins: 1, zap: 0, race: 5, word: 0, ft: 9, leg: 0, job: 0, g: ['tb'] } }; ben.play[dayOf(T0)] = { sj: 0, tb: 3, ff: 0, ww: 0, bc: 0 };
  s.ls.setItem(labKey('ben'), JSON.stringify(ben));
  s.store.report({ game: 'sj', event: 'run' });
  const f = s.store.family();
  assert.deepEqual(f.players.map((p) => p.id), ['mia', 'ben']); assert.equal(f.week, '2026-W45'); assert.deepEqual(f.board.rows.map((r) => r.id), ['mia', 'ben']); assert.equal(f.board.rows[1].xp, 400);
  assert.ok(f.goal.id && f.goal.target > 0); assert.equal(s.store.doc().picks['2026-W45'][0], f.goal.id); assert.equal(s.store.family().goal.id, f.goal.id, 'stable');
  assert.deepEqual(s.store.claimGoal(), { ok: false, item: null, coins: 0, reason: 'unmet' });
});
test('1,000 reports through the store in under 1.5 s', () => {
  const { store } = mkStore(); attach(store); const t0 = performance.now();
  for (let i = 0; i < 1000; i++) store.report({ game: 'sj', event: i % 9 === 0 ? 'run' : 'word', firstTry: i % 4 !== 0 });
  const ms = performance.now() - t0; assert.ok(ms < 1500, 'took ' + ms.toFixed(0) + ' ms'); store.flush();
});
await atest('the facade: attach, report, cosmetics, owns, wallet, level, streak, settings; a UI-less call does not throw', async () => {
  const ls = fakeStorage({ 'spellJump.family': JSON.stringify(FAM) }); globalThis.localStorage = ls;
  const { lab, NOOP_RECEIPT, GAME_MODULES, LAB_VERSION } = await import('../src/index.js');
  assert.equal(lab.report({ game: 'sj', event: 'word', firstTry: true }), NOOP_RECEIPT, 'before attach');
  lab.attach({ game: 'tb', playerId: 'mia', name: 'Mia', color: '#f00' }); lab.attach({ game: 'tb', playerId: 'mia', name: 'Mia', color: '#f00' });
  const r = lab.report({ game: 'tb', event: 'fact', firstTry: true }); assert.equal(r.coins, 2); lab.beginRound('tb');
  lab.__test.grantCoins(500); lab.__test.setLooks('tb', ['tb.paint.ocean']);
  assert.equal(lab.wallet().coins, 502); assert.equal(lab.level().level, 1); assert.deepEqual(lab.settings(), { quests: true, board: true, goal: true }); assert.equal(lab.streak().count, 0);
  assert.equal(lab.store.buy('tb.paint.ocean').ok, true); assert.equal(lab.owns('tb.paint.ocean'), true); assert.equal(lab.store.equip('tb.paint', 'tb.paint.ocean'), true);
  const c = lab.cosmetics('tb'); assert.equal(c.slots.paint, 'tb.paint.ocean'); assert.equal(c.slots.decal, null); assert.deepEqual(Object.keys(c.slots), ['paint', 'decal', 'rim', 'ghost']); assert.equal(c.owns('tb.paint.ocean'), true); assert.deepEqual(c.ready, ['tb.paint.ocean']);
  assert.deepEqual(lab.cosmetics('sj').slots, { skin: null, sticker: null, trail: null }); assert.deepEqual(lab.cosmeticsOf('mia', 'tb').slots.paint, 'tb.paint.ocean'); assert.deepEqual(lab.cosmeticsOf('nobody', 'tb').slots, { paint: null, decal: null, rim: null, ghost: null });
  assert.equal(lab.owns('bc.veh.dump'), false); assert.equal(lab.owns('nope'), false);
  const sum = lab.roundSummary(); assert.equal(sum.coins, 0); const got = []; const off = lab.onChange((e) => got.push(e.type)); lab.report({ game: 'tb', event: 'race' }); off(); assert.ok(got.includes('report'));
  lab.flush(); assert.ok(JSON.parse(ls.getItem(labKey('mia'))).dev); assert.ok(lab.voiceTexts().length > 50); assert.deepEqual(Object.keys(GAME_MODULES), GAMES); assert.equal(LAB_VERSION, 1);
  const h = lab.hud({ mount: null }); h.update(); h.destroy(); lab.openShop({}); lab.openHome(); lab.openParent({ unlocked: true }); lab.gentle(true); lab.detach();
  assert.equal(lab.report({ game: 'tb', event: 'race' }).ok, false, 'after detach');
  delete globalThis.localStorage;
});

finish('SYNC TESTS');

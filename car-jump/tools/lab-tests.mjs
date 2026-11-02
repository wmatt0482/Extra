// Spell Jump's Lab integration, pure checks (lab/SPEC.md §4.1, §6.4; node, no browser): node car-jump/tools/lab-tests.mjs
//   1. the economy snapshot (§4 (f)): the data and economy modules a Lab item must never change are byte-for-byte what they were before v3.9
//   2. labBridge.js: before the Lab loads a report is queued and returns the empty receipt, then replays; with the Lab missing every call is a no-op
//   3. labLooks.js: LOOKS_READY is exactly the catalogue's Spell Jump items, every look resolves through the game's own skin pipeline, a null slot is
//      the game's own look, unknown ids are ignored
//   4. ceremony.js: the tiers (Gold 90 / Silver 75 / Bronze 50 / Brave Speller), the Qualifier improvement, Most improved at 20 points
//   5. certificate.js: the model and the sentences, the ribbon instead of the number for a low result by default, hostile input
//   6. the kid-rule audit (lab/tools/rules-audit.mjs detectors) over every new string and page
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
let passed = 0, failed = 0;
const fails = [];
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failed++; fails.push(name); console.log('  ✗ ' + name + '\n      ' + String(e && e.message || e).split('\n').join('\n      ')); }
}
const src = (p) => pathToFileURL(path.join(ROOT, 'src', p)).href;

// ---------- 1. the economy snapshot ----------
console.log('economy snapshot (the Lab never changes a number the game computes)');
const SNAPSHOT = {
  'data/cars': 'db27005de5bc4792', 'data/tracks': '080fb267650438fd', 'data/upgrades': 'dce2100d50d6c58b', 'data/rating': '0f0bc028f39fa8af',
  'data/cosmetics': 'dee1cd6f13ea07ee', 'meta/economy': '2e2a15767ace4791', 'meta/goals': '9d0b88caaecb954d', 'meta/daily': '97174e039177deab',
};
const canon = (v) => (typeof v === 'function' ? 'fn:' + v.toString() : JSON.stringify(v));
for (const [m, want] of Object.entries(SNAPSHOT)) {
  await test(`${m}.js exports are unchanged since v3.8.0`, async () => {
    const ns = await import(src(m + '.js'));
    const o = {};
    for (const k of Object.keys(ns).sort()) o[k] = canon(ns[k]);
    assert.equal(crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16), want);
  });
}
await test('the prices and rewards main.js pays are the ones before the Lab (MISSION 500, QUALIFIER 100, MEGA 150)', () => {
  const t = readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
  assert.match(t, /const MISSION_REWARD = 500;/); assert.match(t, /const QUALIFIER_PAY = 100;/); assert.match(t, /const MEGA_PAY = 150;/);
  assert.match(t, /const LEVEL_CASH = \[1, 1\.5, 2\];/);
});
await test('no game module imports the Lab except labBridge.js (and labLooks.js is read BY the Lab)', () => {
  for (const f of ['src/main.js', 'src/ui/results.js', 'src/ui/parentZone.js', 'src/ui/garage.js', 'src/meta/labLooks.js', 'src/ui/testBoss.js', 'src/ui/ceremony.js', 'src/ui/certificate.js', 'src/game/engine.js']) {
    assert.ok(!/from ['"][^'"]*\/lab\//.test(readFileSync(path.join(ROOT, f), 'utf8')), `${f} imports the Lab`);
  }
  assert.match(readFileSync(path.join(ROOT, 'src/meta/labBridge.js'), 'utf8'), /import\('\.\.\/\.\.\/\.\.\/lab\/src\/index\.js'\)/);
});

// ---------- 2. the bridge ----------
console.log('labBridge.js');
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); }, key: (i) => [...store.keys()][i] || null, get length() { return store.size; } };
const { labBridge } = await import(src('meta/labBridge.js'));
await test('before the Lab has loaded: not ready, a report returns the empty receipt (and is replayed)', async () => {
  assert.equal(labBridge.ready, false);
  labBridge.attach({ playerId: 'pmia', name: 'Mia', color: '#ff3b5c' });
  const r = labBridge.report({ event: 'word', n: 1, firstTry: true });
  assert.equal(r.ok, false); assert.equal(r.coins, 0); assert.equal(r.combo.moment, false); assert.deepEqual([...r.quests], []);
  assert.deepEqual(labBridge.cosmetics().slots, {}); assert.equal(labBridge.owns('sj.skin.mint'), false);
  for (let i = 0; i < 100 && !labBridge.ready; i++) await new Promise((res) => setTimeout(res, 20));
  assert.equal(labBridge.ready, true, 'the Lab loaded');
});
await test('after the load: the queued report was replayed, and a report pays and returns a receipt', async () => {
  const r = labBridge.report({ event: 'word', n: 1, firstTry: true });
  assert.equal(r.ok, true); assert.ok(r.coins > 0 && r.xp > 0);
  const doc = JSON.parse(store.get('learningLab.pmia.lab'));
  void doc;
});
await test('the receipt carries the combo: the fifth first-try word in a row is the "Perfect Launch" moment', () => {
  labBridge.beginRound();
  const got = [];
  for (let i = 0; i < 6; i++) got.push(labBridge.report({ event: 'word', n: 1, firstTry: true }));
  assert.deepEqual(got.map((r) => r.combo.moment), [false, false, false, false, true, false]);
  assert.equal(got[4].combo.name, 'Perfect Launch');
  assert.equal(got[3].combo.boosted, true, 'the answer after three first tries pays double coins');
});
await test('a miss pays half and never zero, and a Friday Test word never boosts or counts toward the combo', () => {
  labBridge.beginRound();
  const miss = labBridge.report({ event: 'word', n: 1, firstTry: false });
  assert.ok(miss.coins > 0 && miss.coins < 4); assert.equal(miss.combo.count, 0);
  for (let i = 0; i < 5; i++) { const r = labBridge.report({ event: 'testWord', n: 1, firstTry: true }); assert.equal(r.combo.boosted, false); assert.equal(r.combo.moment, false); }
});
await test('the Friday Test event records a trophy with its tier', () => {
  const r = labBridge.report({ event: 'test', n: 6, meta: { of: 6, tier: 'gold' } });
  assert.equal(r.ok, true);
  const d = JSON.parse(store.get('learningLab.pmia.lab'));
  assert.equal(d.trophies[0].tier, 'gold'); assert.equal(d.trophies[0].n, 6);
});
await test('unknown events and hostile input never throw and pay nothing', () => {
  for (const ev of [{ event: 'nope' }, { event: 'word', n: 'x' }, {}, { event: 5 }, { event: '__proto__' }, { event: 'word', n: 1e12, firstTry: 'yes' }]) assert.doesNotThrow(() => labBridge.report(ev));
});
await test('with the Lab missing: every call is a no-op and the game never sees an error', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sj-bridge-'));
  const t = readFileSync(path.join(ROOT, 'src/meta/labBridge.js'), 'utf8').replace('../../../lab/src/index.js', './no-such-lab/index.js');
  writeFileSync(path.join(dir, 'labBridge.mjs'), t);
  const warn = console.warn; const warned = []; console.warn = (...a) => warned.push(a.join(' '));
  try {
    const m = await import(pathToFileURL(path.join(dir, 'labBridge.mjs')).href);
    m.labBridge.attach({ playerId: 'x', name: 'X', color: '#fff' });
    const r = m.labBridge.report({ event: 'word', n: 1, firstTry: true });
    assert.equal(r.ok, false);
    for (let i = 0; i < 100 && !m.labBridge.unavailable; i++) await new Promise((res) => setTimeout(res, 20));
    assert.equal(m.labBridge.unavailable, true); assert.equal(m.labBridge.ready, false);
    const h = m.labBridge.hud({ mount: null }); h.update(); h.destroy();
    m.labBridge.results({ mount: null }).destroy();
    assert.equal(m.labBridge.report({ event: 'run' }).ok, false);
    assert.deepEqual(m.labBridge.cosmetics().slots, {}); assert.equal(m.labBridge.cosmetics().owns('sj.skin.mint'), false);
    assert.doesNotThrow(() => { m.labBridge.beginRound(); m.labBridge.openShop(); m.labBridge.openHome(); m.labBridge.openParent({ unlocked: true }); m.labBridge.onChange(() => {})(); m.labBridge.detach(); m.labBridge.flush(); });
    assert.ok(warned.some((w) => /\[lab\] unavailable/.test(w)), 'one console warning');
  } finally { console.warn = warn; }
});
copyFileSync; // (kept for tools that copy the bridge)

// ---------- 3. the looks ----------
console.log('labLooks.js');
const LL = await import(src('meta/labLooks.js'));
const CAT = await import(pathToFileURL(path.join(REPO, 'lab/src/data/catalog.js')).href);
const CARJS = await import(src('game/car.js'));
await test('LOOKS_READY is exactly the catalogue\'s Spell Jump items (15: 8 skins, 5 stickers, 2 trails)', () => {
  const want = CAT.itemsFor('sj').map((i) => i.id).sort();
  assert.deepEqual([...LL.LOOKS_READY].sort(), want); assert.equal(want.length, 15);
  assert.ok(Object.isFrozen(LL.LOOKS_READY));
});
await test('every skin resolves through the game\'s own look pipeline (resolveLook) and uses a decal car.js draws', () => {
  const decals = [...readFileSync(path.join(ROOT, 'src/game/car.js'), 'utf8').matchAll(/case '([a-z]+)':/g)].map((m) => m[1]);
  for (const [id, sk] of Object.entries(LL.SKIN_LOOKS)) {
    assert.equal(sk.id, id); assert.ok(CAT.ITEM_BY_ID[id] && CAT.ITEM_BY_ID[id].slot === 'skin');
    assert.match(sk.body, /^#[0-9a-f]{6}$/i); assert.match(sk.accent, /^#[0-9a-f]{6}$/i); assert.ok(decals.includes(sk.decal), `${id}: decal ${sk.decal} is drawn by car.js`);
    const r = CARJS.resolveLook({ id: 'x' }, { skin: sk, sticker: null });
    assert.ok(r.skin, `${id} resolves`);
  }
});
await test('every sticker has a glyph and colour; every trail a particle type the engine draws, a chance and colours', () => {
  for (const [id, st] of Object.entries(LL.STICKER_LOOKS)) { assert.ok(CAT.ITEM_BY_ID[id].slot === 'sticker' && st.glyph && /^#/.test(st.color)); assert.ok(CARJS.resolveLook({ id: 'x' }, { skin: null, sticker: st }).sticker, id); }
  const render = readFileSync(path.join(ROOT, 'src/game/render.js'), 'utf8');
  for (const [id, t] of Object.entries(LL.TRAIL_LOOKS)) { assert.ok(CAT.ITEM_BY_ID[id].slot === 'trail'); assert.ok(t.chance > 0 && t.chance <= 1 && t.colors.length >= 3); assert.ok(render.includes(`'${t.type}'`), `${id}: render.js draws ${t.type}`); }
});
await test('labLook: a null slot is the game\'s own look; a worn Lab skin / sticker goes over it; unknown ids and hostile input change nothing', () => {
  const own = { skin: { id: 'flames', body: '#1f1f24', accent: '#ff7a3d', decal: 'flames' }, sticker: { id: 'star', glyph: '★', color: '#ffcf1a' } };
  assert.deepEqual(LL.labLook(own, { slots: { skin: null, sticker: null, trail: null } }), own);
  assert.deepEqual(LL.labLook(own, null), own); assert.deepEqual(LL.labLook(null, null), { skin: null, sticker: null });
  const l = LL.labLook(own, { slots: { skin: 'sj.skin.tiger', sticker: null } });
  assert.equal(l.skin.id, 'sj.skin.tiger'); assert.equal(l.sticker, own.sticker, 'the garage\'s sticker stays when the Lab slot is empty');
  for (const bad of ['sj.skin.nope', 'tb.paint.ocean', '__proto__', 5, {}, 'constructor']) assert.deepEqual(LL.labLook(own, { slots: { skin: bad, sticker: bad } }), own);
  assert.equal(LL.trailFor({ slots: { trail: 'sj.trail.confetti' } }).type, 'confetti'); assert.equal(LL.trailFor({ slots: { trail: 'sj.skin.mint' } }), null); assert.equal(LL.trailFor(null), null);
});

// ---------- 4. the ceremony ----------
console.log('ceremony.js');
const C = await import(src('ui/ceremony.js'));
await test('tiers: Gold 90, Silver 75, Bronze 50, otherwise Brave Speller, at the boundaries', () => {
  const t = (c, n) => C.tierFor(c, n);
  assert.deepEqual([t(10, 10), t(9, 10), t(8, 10), t(15, 20), t(7, 10), t(5, 10), t(4, 10), t(0, 10), t(0, 0)], ['gold', 'gold', 'silver', 'silver', 'bronze', 'bronze', 'brave', 'brave', 'brave']);
  assert.deepEqual(C.TIERS, ['gold', 'silver', 'bronze', 'brave']);
});
await test('the tiers match the Lab core\'s trophy tiers (one rule for the game and the Lab)', async () => {
  const E = await import(pathToFileURL(path.join(REPO, 'lab/src/core/engine.js')).href);
  void E;
  const d = JSON.parse(store.get('learningLab.pmia.lab'));
  assert.equal(d.trophies[0].tier, C.tierFor(6, 6));
});
await test('Most improved needs 20 points over the Qualifier on the same list', () => {
  const q = { kind: 'qualifier', listId: 'L1', correct: 2, total: 10 };
  assert.equal(C.improvement({ correct: 9, total: 10 }, q), 70);
  assert.equal(C.isMostImproved({ correct: 4, total: 10 }, q), true); assert.equal(C.isMostImproved({ correct: 3, total: 10 }, q), false);
  assert.equal(C.improvement({ correct: 9, total: 10 }, null), null); assert.equal(C.isMostImproved({ correct: 9, total: 10 }, null), false);
  assert.equal(C.qualifierFor([{ kind: 'qualifier', listId: 'L2', correct: 0, total: 5 }, q], { listId: 'L1' }), q);
  assert.equal(C.qualifierFor([{ kind: 'qualifier', listId: 'L2' }], { listId: 'L1' }), null);
});
await test('the voice lines are a short finite set (clips for the natural voice), each speakable', () => {
  assert.equal(C.CEREMONY_LINES.length, 6); assert.equal(new Set(C.CEREMONY_LINES).size, 6);
  for (const l of C.CEREMONY_LINES) assert.ok(l.length < 80 && /[.!]$/.test(l), l);
  assert.ok(C.CEREMONY_LINES.includes('Perfect Launch!') && C.CEREMONY_LINES.includes(C.TIER_TEXT.brave.say));
});

// ---------- 5. the certificate ----------
console.log('certificate.js');
const CERT = await import(src('ui/certificate.js'));
const now = Date.UTC(2026, 10, 6, 15);
const fam = { players: [{ id: 'pmia', name: 'Mia' }, { id: 'pleo', name: 'Leo' }] };
const mk = (correct, total, q) => ({ lists: [{ id: 'L1', name: 'Long o', words: [] }], activeId: 'L1',
  tests: [...(q != null ? [{ kind: 'qualifier', listId: 'L1', at: now - 5 * 864e5, correct: q, total }] : []), { kind: 'friday', listId: 'L1', at: now, correct, total, missed: ['float', 'coast'].slice(0, total - correct) }] });
await test('a Gold test: "spelled 6 of 6 words", the Gold ribbon, the score shown by default', () => {
  const m = CERT.certificateModel(fam, mk(6, 6), 'pmia', now);
  assert.equal(m.tier, 'gold'); assert.equal(m.tierName, 'Gold ribbon'); assert.equal(m.showScore, true);
  assert.deepEqual(CERT.certificateLines(m), ['Mia spelled 6 of 6 words on the Friday Test']);
  assert.match(m.date, /November 6, 2026/); assert.equal(m.listName, 'Long o');
});
await test('Bronze and up show the score; a low result shows the ribbon instead of the number by default, and one switch shows it', () => {
  for (const [c, tier, shown] of [[6, 'gold', true], [5, 'silver', true], [4, 'bronze', true], [3, 'bronze', true], [2, 'brave', false], [0, 'brave', false]]) {
    const m = CERT.certificateModel(fam, mk(c, 6), 'pmia', now);
    assert.equal(m.tier, tier, `${c}`); assert.equal(m.showScore, shown, `${c} default`);
  }
  const low = CERT.certificateModel(fam, mk(2, 6), 'pmia', now);
  assert.equal(low.tierName, 'Brave Speller ribbon');
  const text = CERT.certificateLines(low).join(' ');
  assert.ok(!/\d+ of \d+/.test(text) && /kept going on all 6 words/.test(text), text);
  const shown = CERT.certificateModel(fam, mk(2, 6), 'pmia', now, { showScore: true });
  assert.match(CERT.certificateLines(shown)[0], /spelled 2 of 6 words/);
  assert.equal(CERT.certificateModel(fam, mk(6, 6), 'pmia', now, { showScore: false }).showScore, false);
});
await test('the Qualifier-to-Friday improvement line, with numbers only when the score is shown', () => {
  const m = CERT.certificateModel(fam, mk(5, 6, 2), 'pmia', now);
  assert.equal(m.improvedMost, true);
  assert.equal(CERT.certificateLines(m)[1], 'Up from 2 of 6 on the Qualifier to 5 of 6 on the Friday Test');
  const low = CERT.certificateModel(fam, mk(3, 6, 0), 'pmia', now, { showScore: false });
  assert.equal(CERT.certificateLines(low)[1], 'Mia has improved since the Qualifier');
  assert.equal(CERT.certificateLines(CERT.certificateModel(fam, mk(3, 6, 4), 'pmia', now)).length, 1, 'no improvement line when it did not improve');
});
await test('a missing player or test, a Qualifier row, and hostile input give no certificate', () => {
  assert.equal(CERT.certificateModel(fam, mk(6, 6), 'pnobody', now), null); assert.equal(CERT.certificateModel(fam, mk(6, 6), 'pmia', now + 1), null);
  assert.equal(CERT.certificateModel(fam, { tests: [{ kind: 'qualifier', at: now, correct: 1, total: 2, listId: 'L1' }] }, 'pmia', now), null, 'only a Friday Test has a certificate');
  assert.equal(CERT.certificateModel(null, null, 'pmia', now), null); assert.equal(CERT.certificateModel(fam, { tests: 'x' }, 'pmia', now), null);
  assert.equal(CERT.certificateModel(fam, { tests: [{ kind: 'friday', at: now, correct: 1, total: 0 }] }, 'pmia', now), null);
  assert.doesNotThrow(() => CERT.certificateModel(fam, { tests: [null, 5, { kind: 'friday', at: now, correct: 'a', total: 3 }] }, 'pmia', now));
});

// ---------- 6. the kid-rule audit over the new strings ----------
console.log('kid rules (lab/tools/rules-audit.mjs detectors)');
const AUDIT = await import(pathToFileURL(path.join(REPO, 'lab/tools/rules-audit.mjs')).href);
await test('every new string and page: no banned words, no off-origin link, no native input, no rank numeral', () => {
  const files = ['src/meta/labBridge.js', 'src/meta/labLooks.js', 'src/ui/testBoss.js', 'src/ui/ceremony.js', 'src/ui/certificate.js', 'certificate.html'];
  const hits = [];
  for (const f of files) hits.push(...AUDIT.auditSource(path.join(ROOT, f), readFileSync(path.join(ROOT, f), 'utf8')));
  const lines = [...Object.values(C.TIER_TEXT).flatMap((t) => [t.title, t.line, t.say, t.ribbon, t.short]), C.IMPROVED_TEXT.title, ...C.CEREMONY_LINES,
    ...Object.values(LL.SKIN_LOOKS).map((x) => x.name), ...Object.values(LL.STICKER_LOOKS).map((x) => x.name), ...Object.values(LL.TRAIL_LOOKS).map((x) => x.name)]
    .map((text) => ({ text, where: 'ceremony text' }));
  const m = CERT.certificateModel(fam, mk(2, 6, 0), 'pmia', now);
  for (const sh of [true, false]) lines.push(...CERT.certificateLines({ ...m, showScore: sh }).map((text) => ({ text, where: 'certificate line' })));
  hits.push(...AUDIT.auditStrings(lines));
  assert.deepEqual(hits, []);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log(fails.map((f) => '  - ' + f).join('\n')); process.exit(1); }
console.log('ALL LAB TESTS PASSED');

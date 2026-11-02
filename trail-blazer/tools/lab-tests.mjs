// Trail Blazer 1.9, The Lab (lab/SPEC.md §4.2, §4 (f)): node tests, no browser.
//   node trail-blazer/tools/lab-tests.mjs                       run the tests
//   node trail-blazer/tools/lab-tests.mjs --write-snapshot DIR  write tools/economy-snapshot.json from the trail-blazer folder of DIR (a copy of the code
//                                                               before the change: `git archive <commit> | tar -x -C DIR`)
// 1. The economy is untouched: every exported constant of the economy modules, plus the outputs of the economy functions on fixed inputs, equal a
//    snapshot taken from the code before Lab integration (tools/economy-snapshot.json). Lab coins never enter Trail Blazer's cash: no module here
//    imports the Lab's wallet, and the game's economy modules do not import the bridge.
// 2. The Lab looks: LOOKS_READY is exactly the Lab catalogue's 16 `tb.*` items, every one draws (a paint object, a decal, a rim or a ghost style), the
//    overlay leaves the child's own paint alone when nothing is equipped.
// 3. Ghost Chase's ghosts: cleaning, reading a sibling's stored save (never writing it), the choices, the result lines.
// 4. The engine's look pieces: rims, the two new decals and the ghost styles resolve.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TB = path.resolve(HERE, '..');
const SNAP = path.join(HERE, 'economy-snapshot.json');

// ---------- the economy snapshot ----------
const MODULES = ['src/data/runway.js', 'src/data/upgrades.js', 'src/data/cups.js', 'src/data/vehicles.js', 'src/data/mutators.js', 'src/data/medals.js', 'src/data/rivals.js',
  'src/data/paints.js', 'src/data/cosmetics.js', 'src/meta/economy.js', 'src/meta/save.js', 'src/facts/store.js'];
const plain = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'function' ? undefined : x)));
export async function collectEconomy(root) {
  const out = { constants: {}, calls: {} };
  const mods = {};
  for (const m of MODULES) {
    mods[m] = await import(pathToFileURL(path.join(root, m)).href);
    const c = {};
    for (const [k, v] of Object.entries(mods[m])) if (typeof v !== 'function') c[k] = plain(v);
    out.constants[m] = c;
  }
  const E = mods['src/meta/economy.js'], U = mods['src/data/upgrades.js'], S = mods['src/meta/save.js'], V = mods['src/data/vehicles.js'], C = mods['src/data/cups.js'];
  out.calls.upgradeCost = [0, 1, 5, 9].map((l) => [1, 2.5, 35].map((t) => U.upgradeCost(l, t)));
  out.calls.totalCostToMax = U.totalCostToMax();
  out.calls.resolveStats = [0, 5, 10].map((l) => U.resolveStats({ engine: l, tires: l, suspension: l, boost: l }));
  out.calls.weekendBonus = Object.keys(C.WEEKEND_BONUS || {}).map((t) => C.CUPS.map((c) => C.weekendBonus(c.id, t)));
  out.calls.vehiclePrices = V.VEHICLES.map((v) => [v.id, v.tier, v.price]);
  const trails = Array.from({ length: 6 }, (_, i) => ({ id: 't' + i, length: 600 + 300 * i, style: ['forest', 'granite', 'lake', 'snow', 'desert', 'night'][i] }));
  const summary = { distance: 612, finishCrossed: true, place: 2, timeSec: 41.5, flips: 3, airTime: 6.2, coins: 5, crashes: 1, perfect: 2, smashed: 2, maxSpeedKmh: 91,
    cash: { distance: 1200, air: 180, flips: 450, perfect: 200, coins: 50, place: 300, finish: 300, gates: 480, quick: 240, total: 3400 } };
  const save = S.defaultSave();
  const bank = E.bankRide(save, trails, 't0', summary, { gold: 30, silver: 36, bronze: 44 });
  out.calls.bankRide = { bank: plain(bank), cash: save.cash, records: plain(save.records), bestPlace: plain(save.bestPlace), bestTime: plain(save.bestTime), medals: plain(save.medals), finished: plain(save.finished) };
  out.calls.cashRows = plain(E.cashRows(summary.cash));
  out.calls.buy = (() => { const s = S.defaultSave(); s.cash = 100000; const a = E.buyVehicle(s, V.VEHICLES, V.VEHICLES[1].id), b = E.buyUpgrade(s, 'engine', V.VEHICLES); return plain({ a, b, cash: s.cash, levels: s.vehicles }); })();
  return out;
}

const failures = [];
let passed = 0;
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else { passed++; console.log('  ✓ ' + msg); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

if (process.argv[2] === '--write-snapshot') {
  const root = path.resolve(process.argv[3], 'trail-blazer');
  const snap = await collectEconomy(root);
  writeFileSync(SNAP, JSON.stringify(snap, null, 1) + '\n');
  console.log(`wrote ${SNAP} from ${root}`);
  process.exit(0);
}

// ---------- 1. the economy ----------
console.log('\n=== the economy is untouched ===');
{
  const live = await collectEconomy(TB), snap = JSON.parse(readFileSync(SNAP, 'utf8'));
  for (const m of MODULES) check(eq(live.constants[m], snap.constants[m]), `${m}: every exported constant equals the snapshot from before the Lab (${Object.keys(snap.constants[m]).length})`);
  for (const k of Object.keys(snap.calls)) check(eq(live.calls[k], snap.calls[k]), `economy call "${k}" gives the same result as before the Lab`);
  const imports = (f) => readFileSync(path.join(TB, f), 'utf8').split('\n').filter((l) => /^\s*import\b|from\s+['"]/.test(l)).join('\n');
  for (const f of ['src/meta/economy.js', 'src/data/runway.js', 'src/data/upgrades.js', 'src/data/cups.js', 'src/data/vehicles.js', 'src/meta/crates.js', 'src/meta/season.js', 'src/meta/save.js']) {
    check(!/labBridge|labLooks|\/lab\/|ghosts\.js/.test(imports(f)), `${f} imports nothing from the Lab`);
  }
  // no Lab wallet in TB's cash: main.js never reads a Lab coin count into the save
  const main = readFileSync(path.join(TB, 'src/main.js'), 'utf8');
  check(!/wallet\(|\.coins\b.*save\.cash|save\.cash.*labBridge/.test(main) && !/labBridge\.wallet/.test(main), 'main.js never reads the Lab wallet (Lab coins cannot reach Trail Blazer\'s cash)');
}

// ---------- 2. the Lab looks ----------
console.log('\n=== labLooks.js ===');
const L = await import(pathToFileURL(path.join(TB, 'src/meta/labLooks.js')).href);
const catalog = await import(pathToFileURL(path.join(TB, '../lab/src/data/catalog.js')).href);
{
  const tb = catalog.itemsFor('tb').map((i) => i.id).sort();
  check(tb.length === 16 && eq([...L.LOOKS_READY].sort(), tb), `LOOKS_READY is exactly the Lab catalogue's ${tb.length} tb.* items`);
  check(L.LOOKS_READY.every((id) => L.LAB_NAMES[id]), 'every item has a name for the garage line');
  const paints = L.LOOKS_READY.filter((i) => i.startsWith('tb.paint.')), decals = L.LOOKS_READY.filter((i) => i.startsWith('tb.decal.')), rims = L.LOOKS_READY.filter((i) => i.startsWith('tb.rim.')), ghosts = L.LOOKS_READY.filter((i) => i.startsWith('tb.ghost.'));
  check(paints.length === 6 && paints.every((i) => { const p = L.paintFor(i); return p && /^lab-/.test(p.id) && /^#[0-9a-f]{6}$/i.test(p.body) && /^#[0-9a-f]{6}$/i.test(p.stripe); }), 'six paints, each a paint object (lab- id, body and stripe colours)');
  check(new Set(paints.map((i) => L.paintFor(i).id)).size === 6, 'the six paint ids are distinct');
  const V = await import(pathToFileURL(path.join(TB, 'src/game/vehicle.js')).href);
  check(decals.length === 4 && decals.every((i) => V.DECAL_BY_ID[L.decalFor(i)]), `four decals, each an id the engine draws (${decals.map((i) => L.decalFor(i)).join(', ')})`);
  check(rims.length === 2 && rims.every((i) => V.RIM_BY_ID[L.rimFor(i)]), `two rims, each an id the engine draws (${rims.map((i) => L.rimFor(i)).join(', ')})`);
  const G = await import(pathToFileURL(path.join(TB, 'src/data/ghostLooks.js')).href);
  check(ghosts.length === 4 && ghosts.every((i) => L.ghostFor(i) && L.ghostFor(i).id === i.split('.')[2] && G.GHOST_STYLES[L.ghostFor(i).id]), 'four ghost looks, each a style');
  check(L.paintFor('tb.paint.nope') === null && L.paintFor('sj.skin.mint') === null && L.decalFor(null) === null && L.rimFor(undefined) === null && L.ghostFor('tb.paint.ocean') === null, 'unknown ids and other games\' ids give nothing');
  const base = { vehicle: 'ranger150', paint: 'sage', decal: 'none', helmet: 'classic', suit: 'rookie', flag: null, trail: 'orange' };
  check(eq(L.applyLabLook(base, {}), base) && eq(L.applyLabLook(base, null), base) && eq(L.applyLabLook(base, { paint: null, decal: null, rim: null, ghost: 'tb.ghost.ice' }), base), 'with nothing equipped (null slots) the child\'s own look is unchanged; the ghost slot is not part of the vehicle look');
  const on = L.applyLabLook(base, { paint: 'tb.paint.ocean', decal: 'tb.decal.checkeredge', rim: 'tb.rim.gold' });
  check(on.paint.id === 'lab-ocean' && on.decal === 'edge' && on.rim === 'gold' && on.vehicle === 'ranger150' && on.helmet === 'classic' && base.paint === 'sage', 'equipped paint, decal and rim are laid over the look (the garage look object itself is not changed)');
  check(L.describeLabLook({ paint: 'tb.paint.ocean', rim: 'tb.rim.neon', ghost: null }) === 'Ocean paint, Neon rims' && L.describeLabLook({}) === '', 'the garage line names the equipped looks');
  const R = V.resolveLook({ vehicle: 'ranger150', paint: L.paintFor('tb.paint.goldleaf'), decal: 'bolt', rim: 'neon' });
  check(R.paint.id === 'lab-goldleaf' && R.decal === 'bolt' && R.rim && R.rim.id === 'neon' && V.resolveLook({ paint: 'sage' }).rim === null, 'the engine resolves a Lab paint object, the bolt decal and a rim; no rim by default');
  const k1 = V.resolveLook({ paint: 'sage', rim: 'neon' }).key, k2 = V.resolveLook({ paint: 'sage', rim: 'gold' }).key, k3 = V.resolveLook({ paint: 'sage' }).key;
  check(k1 !== k2 && k1 !== k3, 'the look cache key includes the rim');
  check(V.resolveLook({ paint: 'sage', rim: { fill: '#112233', ring: '#445566' } }).rim.id === 'custom' && V.resolveLook({ paint: 'sage', rim: { fill: 'javascript:1', ring: '#fff' } }).rim === null, 'a custom rim needs css colours; anything else is no rim');
  check(G.ghostStyle('tb.ghost.flame').id === 'flame' && G.ghostStyle('ice').id === 'ice' && G.ghostStyle('nope').id === 'default' && G.ghostStyle(null).id === 'default' && G.ghostStyle({ id: 'gold', alpha: 9 }).alpha <= 0.8, 'ghostStyle: an item id, a short id or an object; the plain ghost otherwise; opacity is bounded');
  // a preview draws without a vehicle module and without a DOM (the fallback Ranger, then the real art when loaded)
  const calls = []; const ctx = new Proxy({}, { get: (t, k) => (k === 'canvas' ? {} : (...a) => { calls.push(k); }), set: () => true });
  check(L.paintPreview(ctx, { id: 'tb.paint.ocean' }, 120, 80) !== undefined && L.paintPreview(ctx, { id: 'sj.skin.mint' }, 120, 80) === false, 'paintPreview draws a Trail Blazer item and declines another game\'s');
}

// ---------- 3. ghosts ----------
console.log('\n=== ghosts.js ===');
const Gh = await import(pathToFileURL(path.join(TB, 'src/meta/ghosts.js')).href);
const S = await import(pathToFileURL(path.join(TB, 'src/meta/save.js')).href);
{
  const trace = Array.from({ length: 50 }, (_, i) => [i / 10, i * 12, 1 + (i % 3) * 0.1, 0.01 * i]);
  const packed = S.encodeGhost(trace);
  const store = {};
  const read = (k) => (k in store ? store[k] : null);
  const writes = [];
  const sibling = (id, extra = {}) => { const sv = { ...S.defaultSave(), vehicle: 'quad', paint: 'sunset', ghosts: { 'pine-ridge': trace }, ...extra }; store[S.saveKey(id)] = JSON.stringify(S.storedSave(sv)); };
  sibling('ben'); sibling('zoe', { ghosts: { 'granite-gap': trace } });
  store[S.saveKey('bad')] = '{not json'; store[S.saveKey('thin')] = JSON.stringify({ ghosts: { 'pine-ridge': [[0, 0, 0, 0]] } });
  const fam = [{ id: 'mia', name: 'Mia', color: '#f00' }, { id: 'ben', name: 'Ben', color: '#0f0' }, { id: 'zoe', name: 'Zoe', color: '#00f' }, { id: 'bad', name: 'Bad' }, { id: 'thin', name: 'Thin' }, { id: 'nobody', name: 'Nobody' }];
  const before = JSON.stringify(store);
  const got = Gh.peekGhosts(fam, 'pine-ridge', { skipId: 'mia', read });
  check(got.length === 1 && got[0].playerId === 'ben' && got[0].name === 'Ben' && got[0].color === '#0f0' && got[0].vehicle === 'quad' && got[0].paint === 'sunset' && got[0].trace.length === 50 && got[0].time === 4.9 && got[0].look === null,
    `peekGhosts: only Ben has a usable ghost on Pine Ridge (name, colour, vehicle, paint, ${got[0] && got[0].trace.length} samples, ${got[0] && got[0].time} s); a corrupt save, a one-sample ghost and a missing save are skipped`);
  check(eq(got[0].trace, S.decodeGhost(packed)) && got[0].trace.every((p, i) => Math.abs(p[1] - trace[i][1]) < 0.06 && Math.abs(p[0] - trace[i][0]) < 0.006), 'the sibling\'s packed ghost decodes with the existing decodeGhost (samples within the packing\'s 0.1 m / 0.01 s)');
  check(Gh.peekGhosts(fam, 'granite-gap', { skipId: 'mia', read }).map((g) => g.playerId).join() === 'zoe' && Gh.peekGhosts(fam, 'lake-loop', { skipId: 'mia', read }).length === 0, 'per trail: Zoe\'s is on Granite Gap; nobody has Lake Loop');
  check(JSON.stringify(store) === before, 'peekGhosts never writes a save (the stored data is byte for byte the same)');
  check(Gh.peekGhosts(fam, 'pine-ridge', { skipId: 'ben', read }).length === 0 && Gh.peekGhosts(null, 'pine-ridge').length === 0 && Gh.peekGhosts(fam, '../x', { read }).length === 0, 'skipId leaves the chooser out; bad input gives an empty list');
  const mine = { ...S.defaultSave(), ghosts: { 'pine-ridge': trace } };
  const rows = Gh.chaseChoices(mine, 'pine-ridge', { id: 'mia', name: 'Mia', color: '#f00' }, fam, { read });
  check(rows.length === 2 && rows[0].own === true && rows[0].name === 'Mia' && rows[1].playerId === 'ben', 'chaseChoices: "My best" first, then the siblings');
  check(Gh.chaseChoices(S.defaultSave(), 'pine-ridge', { id: 'mia', name: 'Mia' }, [fam[0]], { read }).length === 0, 'with no ghost anywhere there is nothing to chase (no button)');
  check(Gh.ghostLabel(rows[0]) === 'Your best' && Gh.ghostLabel(rows[1]) === 'Ben' && Gh.ghostLabel(null) === 'Ghost', 'ghostLabel: "Your best", the sibling\'s name, "Ghost"');
  check(Gh.cleanTrace(packed).length === 50 && Gh.cleanTrace([[1, 0, 0, 0], [0.5, 1, 0, 0]]) === null && Gh.cleanTrace([[0, 'x', 0, 0], [1, 1, 1, 1]]) === null && Gh.cleanTrace('bad') === null && Gh.cleanTrace(null) === null, 'cleanTrace: a packed or plain trace; time going back, non-numbers and junk are refused');
  check(Gh.cleanTrace(Array.from({ length: 4000 }, (_, i) => [i, i, 0, 0])).length === S.GHOST_MAX, `a huge trace is cut to GHOST_MAX (${S.GHOST_MAX})`);
  check(Gh.chaseLine({ name: 'Mia', beat: true, by: 1.34 }) === "You beat Mia's ghost by 1.3 s!" && Gh.chaseLine({ name: 'Mia', beat: false, by: 1.26 }) === "Mia's ghost was 1.3 s ahead. Nice chase!"
    && Gh.chaseLine({ own: true, beat: true, by: 2 }) === 'Beat your ghost by 2.0 s!' && Gh.chaseLine({ own: true, beat: false, by: 0.5 }) === 'Your ghost was 0.5 s ahead' && Gh.chaseLine({ name: 'Chris', beat: true, by: 1 }) === "You beat Chris' ghost by 1.0 s!",
    'chaseLine: the four result lines (a sibling\'s ghost, your own), a name ending in s');
  const vt = Gh.labVoiceTexts(['Mia', 'Ben'], { welcome: 'Welcome to the Lab', f: () => 'x' });
  check(vt.includes('Perfect Landing!') && vt.includes("Chase Mia's ghost. Press gas!") && vt.includes("You beat Ben's ghost!") && vt.includes('Welcome to the Lab') && vt.every((t) => t.length <= 200) && new Set(vt).size === vt.length, 'labVoiceTexts: the moment, each family member\'s chase lines and the Lab\'s fixed lines, ready for the natural voice');
}

// ---------- 4. the kid rules for the new strings ----------
console.log('\n=== the kid rules for what is new ===');
{
  const BAN = /\b(kill|killed|die|dies|dead|death|lose|lost|loser|expire|expired|missed|failed|fail|timer|countdown|hurry|last chance|ends in|resets in|left today)\b/i;
  const files = ['src/meta/ghosts.js', 'src/meta/labLooks.js', 'src/meta/labBridge.js', 'src/ui/chasePicker.js'];
  const strings = [];
  for (const f of files) { const t = readFileSync(path.join(TB, f), 'utf8'); for (const m of t.matchAll(/(['"`])((?:\\.|(?!\1).){4,}?)\1/g)) { if (!/^(\.|\/|#|@|[a-z]+\.[a-z]+)/.test(m[2]) && /\s/.test(m[2])) strings.push([f, m[2]]); } }
  const bad = strings.filter(([f, s]) => BAN.test(s));
  check(bad.length === 0, `no banned word in the ${strings.length} kid-facing strings of the new modules${bad.length ? ': ' + bad.slice(0, 3).map((b) => b.join(': ')).join(' | ') : ''}`);
  const html = readFileSync(path.join(TB, 'index.html'), 'utf8');
  const chaseUi = (html.match(/<div class="modal" id="panel-chase"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/) || [''])[0];
  check(chaseUi.length > 100 && !BAN.test(chaseUi.replace(/no clock|There is no clock/gi, '')) && !/<input|<textarea|<select|contenteditable/i.test(chaseUi), 'the picker markup has no banned word and no native input');
  check(/no clock/i.test(chaseUi), 'the picker says there is no clock (that is the only place the word is used, to say there is none)');
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log(`\n${failures.length} FAILED:\n- ` + failures.join('\n- ')); process.exit(1); }
console.log('\nALL TRAIL BLAZER LAB TESTS PASSED');

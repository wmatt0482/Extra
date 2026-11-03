// Fraction Fright yard runway sim (lab/SPEC.md §4.3, "the yard no longer empties in a few hours"). Pure node, no browser:
//   node fraction-fright/tools/yard-sim.mjs            prints the runway table
//   node fraction-fright/tools/yard-sim.mjs --check    exits 1 when a runway target is missed
//
// The model (every number is a flag at the top so it can be argued with):
//   - a kid plays 5-wave streets in rotation Maple Street (T1), Oak Lane (T2), Twin Alley (T3), the way a kid who has all three open does;
//   - every wave is the real one: buildWave() items, scripted throws (a throw hits with probability HIT, a bull is BULL of the hits, a
//     near is half the misses; a zombie is thrown at up to TRIES times before it reaches the fence; a boss needs 3 hits), scored by the
//     real waveCash() (constants untouched). The Critter Stampede bonus round is NOT counted (it only adds cash, so the runway is a floor);
//   - WAVES_PER_HOUR = 16, the same assumption the Lab's economy sim uses for Fraction Fright (lab/SPEC.md §2.2);
//   - the kid spends greedily: after every wave, buy the cheapest item that is affordable and allowed (the tower is built in order).
// Targets (SPEC §4.3), with what this sim says about them in the output:
//   whole yard 9 to 12 hours at 70 % hits · no stretch longer than MAX_GAP_WAVES without a purchase (the next thing is always near) ·
//   the old yard on its own is reported (the SPEC's "3 to 4 hours" is stale: since 1.1's cash rows the old yard is about an hour).
import { buildWave, rngFrom } from '../src/skills/items.js';
import { waveCash } from '../src/meta/economy.js';
import * as L from '../src/data/looks.js';

const CHECK = process.argv.includes('--check');
export const HIT = 0.7, BULL = 0.2, TRIES = 3, WAVES_PER_HOUR = 16;
const STREETS = ['T1', 'T2', 'T3'];
export const MAX_GAP_WAVES = 45;           // 2.6 hours at 16 waves an hour: the longest wait between two purchases, and only for the last prize
export const TARGET_HOURS = [9, 12];

/** The old yard (before the Lab integration): ids that existed. Its total is asserted, so a price change there is noticed. */
export const OLD = ['lava', 'frost', 'disco', 'grape', 'tangerine', 'stone', 'iron', 'dog', 'lantern'];
export const OLD_TOTAL = 35500;

export function catalog() {
  const items = [];
  for (const g of L.GRENADES) if (g.price) items.push({ id: g.id, kind: 'grenade', price: g.price });
  for (const g of L.GOO) if (g.price) items.push({ id: g.id, kind: 'goo', price: g.price });
  for (const f of L.FENCES) if (f.price) items.push({ id: f.id, kind: 'fence', price: f.price });
  for (const t of L.TOWERS) if (t.price) items.push({ id: t.id, kind: 'tower', price: t.price, after: (L.towerBefore(t.id) || {}).id });
  for (const x of L.EXTRAS) items.push({ id: x.id, kind: 'extra', price: x.price });
  return items;
}

/** One wave's cash for a kid with hit probability `hit`. */
export function waveCashFor(tier, number, hit, rng) {
  const w = buildWave({ tier, number, state: 'working', reviewTier: tier === 'T1' ? null : tier === 'T2' ? 'T1' : 'T2', more: true, rng });
  const throws = [];
  let combo = 0;
  for (const it of w.items) {
    let hits = 0, tries = 0, cured = false;
    while (!cured && tries < (it.kind === 'boss' ? 14 : TRIES)) {
      tries++;
      const r = rng();
      const res = r < hit ? (rng() < BULL ? 'bull' : 'hit') : rng() < 0.5 ? 'near' : 'miss';
      const ok = res === 'bull' || res === 'hit';
      combo = ok ? combo + 1 : res === 'miss' ? 0 : combo;
      throws.push({ item: { id: it.id, kind: it.kind }, result: res, combo, seen: rng() < 0.5, cures: ok && it.twin && hits === 0 && it.kind !== 'boss' ? [it.id, it.twin] : undefined });
      if (ok) { hits++; if (it.kind !== 'boss' || hits >= 3) cured = true; }
    }
  }
  return waveCash(throws, { final: w.final }).total;
}

/** A playthrough: waves until every item is owned. → { hours, oldHours, gaps, purchases, waves, avgWave } */
export function run({ hit = HIT, seed = 1, wph = WAVES_PER_HOUR, items = catalog() } = {}) {
  const rng = rngFrom(seed * 7919 + Math.round(hit * 100));
  const left = items.map((i) => ({ ...i }));
  const owned = new Set();
  let cash = 0, waves = 0, lastBuy = 0, maxGap = 0, oldAt = 0, total = 0;
  const buys = [];
  const oldLeft = new Set(OLD);
  const cheapestWait = [];
  while (left.length && waves < 20000) {
    const tier = STREETS[Math.floor(waves / 5) % STREETS.length], number = (waves % 5) + 1;
    const c = waveCashFor(tier, number, hit, rng);
    cash += c; total += c; waves++;
    for (;;) {
      const can = left.filter((i) => (!i.after || owned.has(i.after)) && i.price <= cash).sort((a, b) => a.price - b.price)[0];
      if (!can) break;
      cash -= can.price; owned.add(can.id); left.splice(left.indexOf(can), 1);
      maxGap = Math.max(maxGap, waves - lastBuy); lastBuy = waves;
      buys.push({ id: can.id, wave: waves, price: can.price });
      oldLeft.delete(can.id);
      if (!oldLeft.size && !oldAt) oldAt = waves;
    }
  }
  void cheapestWait;
  const gaps = buys.map((b, i) => b.wave - (i ? buys[i - 1].wave : 0)).sort((a, b) => a - b);
  return { waves, hours: waves / wph, oldHours: oldAt / wph, maxGap, medianGap: gaps[Math.floor(gaps.length / 2)], within6: gaps.filter((g) => g <= 6).length / gaps.length, buys, avgWave: total / waves };
}

/** The same kid with only the OLD yard in the shop (what the yard was). */
export function oldOnly(opts = {}) {
  const items = catalog().filter((i) => OLD.includes(i.id));
  return run({ ...opts, items });
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
export function avg(fn, seeds = 25) { const rs = Array.from({ length: seeds }, (_, i) => fn(i + 1)); return { hours: mean(rs.map((r) => r.hours)), oldHours: mean(rs.map((r) => r.oldHours)), maxGap: Math.max(...rs.map((r) => r.maxGap)), medianGap: mean(rs.map((r) => r.medianGap)), within6: mean(rs.map((r) => r.within6)), avgWave: mean(rs.map((r) => r.avgWave)), runs: rs }; }

const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);

if (import.meta.url === `file://${process.argv[1]}`) {
  const cat = catalog();
  const oldSum = cat.filter((i) => OLD.includes(i.id)).reduce((a, i) => a + i.price, 0);
  const allSum = cat.reduce((a, i) => a + i.price, 0);
  console.log(`Yard catalogue: ${cat.length} items, $${allSum.toLocaleString('en-US')} in all (old yard $${oldSum.toLocaleString('en-US')}, new $${(allSum - oldSum).toLocaleString('en-US')}).`);
  console.log('Model: 5-wave streets in rotation T1, T2, T3; scripted throws through the real buildWave + waveCash; greedy cheapest-first spending; the bonus round is not counted.');
  console.log(`\n hits  avg wave   old yard   whole yard   (at 12 / 16 / 20 waves an hour)    longest wait (waves) · typical · bought within 6 waves of the last`);
  const rows = {};
  for (const hit of [0.45, 0.7, 0.9]) {
    const a = avg((s) => run({ hit, seed: s }));
    const o = avg((s) => oldOnly({ hit, seed: s }));
    rows[hit] = { a, o };
    const h = (w) => f1((a.hours * WAVES_PER_HOUR) / w);
    console.log(` ${String(Math.round(hit * 100)).padStart(3)} %  $${String(Math.round(a.avgWave)).padStart(5)}   ${f1(o.hours).padStart(5)} h    ${f1(a.hours).padStart(6)} h     ${h(12).padStart(5)} h / ${h(16).padStart(5)} h / ${h(20).padStart(5)} h        ${a.maxGap} · ${f1(a.medianGap)} · ${Math.round(a.within6 * 100)} %`);
  }
  const base = rows[0.7];
  console.log('\nPurchase order for the 70 % kid (first seed): ' + base.a.runs[0].buys.map((b) => `${b.id} @${f1(b.wave / WAVES_PER_HOUR)}h`).join(', '));
  console.log('\nTargets');
  check(oldSum === OLD_TOTAL, `the old yard still costs $${OLD_TOTAL.toLocaleString('en-US')} (its prices are untouched)`);
  check(base.a.hours >= TARGET_HOURS[0] && base.a.hours <= TARGET_HOURS[1], `the whole yard takes ${f1(base.a.hours)} h at 70 % hits (target ${TARGET_HOURS[0]} to ${TARGET_HOURS[1]} h)`);
  check(rows[0.9].a.hours >= 6, `even a 90 % kid needs ${f1(rows[0.9].a.hours)} h (at least 6 h: the yard does not empty in a few hours)`);
  check(rows[0.45].a.hours <= 16, `a 45 % kid gets there in ${f1(rows[0.45].a.hours)} h (at most 16 h: it stays within reach)`);
  check(base.a.maxGap <= MAX_GAP_WAVES, `never more than ${base.a.maxGap} waves (${f1(base.a.maxGap / WAVES_PER_HOUR)} h) without something new at 70 % (limit ${MAX_GAP_WAVES} waves)`);
  check(base.o.hours < base.a.hours / 2, `the old yard alone is ${f1(base.o.hours)} h: the new items more than double the runway`);
  console.log(`\nNote: SPEC §4.3 expects the old yard to last 3 to 4 hours; with cash per wave at $${Math.round(base.a.avgWave)} and ${WAVES_PER_HOUR} waves an hour it lasts ${f1(base.o.hours)} h, so the new prices are set against the whole-yard target, not against the SPEC's dollar list (+$57k would be ${f1((oldSum + 57000) / (base.a.avgWave * WAVES_PER_HOUR))} h).`);
  if (CHECK) { if (fails.length) { console.log(`\nyard-sim --check: ${fails.length} target(s) missed`); process.exit(1); } console.log('\nyard-sim --check: all runway targets met'); }
}

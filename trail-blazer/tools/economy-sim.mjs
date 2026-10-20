// Trail Blazer economy simulator (SPEC v1.5 §7), like Spell Jump's: a decent 4th grader plays 12-minute sessions
// (~6 races), gets 3rd or better on a trail by the 3rd attempt, answers 70 % of the gates right (half of those
// quick), and spends like a kid: the next vehicle the moment it is affordable, else upgrades on the current one while
// they are cheap next to the next vehicle. Prints the races / hours to each vehicle, each cup, the star counts, and the
// crate flow, and checks the targets: Dune Quad ~1 h, Pro Cup ~3 h, Mud Monster ~8 h, Legend Cup ~12 h, Thunder Rail
// ~25 h, Moon Rover ~50 h; a crate every 2-3 races early, every race once quick answers are common; never 10 races in a
// row with nothing new. The prices and multipliers are src/data/runway.js; the cash per race follows the engine's
// payouts (2 $/m, $30/s of air, $10 a coin, $120 a right gate + $80 quick, place $500 / 300 / 150, finish $300).
//   node trail-blazer/tools/economy-sim.mjs            the table (average of 40 kids)
//   node trail-blazer/tools/economy-sim.mjs --check    exit 1 when a target is missed by more than 35 %
import { TIER_MUL, CUP_MULT, WEEKEND_BONUS, DAILY_MULT, STARS_TO_OPEN } from '../src/data/runway.js';
import { upgradeCost, MAX_LEVEL } from '../src/data/upgrades.js';
import { FALLBACK_VEHICLES } from '../src/data/fallbackVehicles.js';

let VEHICLES = FALLBACK_VEHICLES, TRAILS = null;
try { const m = await import('../src/data/vehicles.js'); if (Array.isArray(m.VEHICLES) && m.VEHICLES.length >= 8) VEHICLES = m.VEHICLES; } catch (_) { /* fallback */ }
try { const m = await import('../src/data/trails.js'); if (Array.isArray(m.TRAILS) && m.TRAILS.length >= 18) TRAILS = m.TRAILS; } catch (_) { /* fallback */ }
const CUP_IDS = ['rookie', 'pro', 'legend'];
if (!TRAILS) TRAILS = Array.from({ length: 18 }, (_, i) => ({ id: 't' + i, length: Math.round(600 + (3400 * i) / 17), cup: CUP_IDS[Math.floor(i / 6)] }));
const lengthOf = (t) => t.length || t.lengthM || 600 + 200 * TRAILS.indexOf(t);
const cupOf = (t, i) => t.cup || CUP_IDS[Math.floor(i / 6)];
const price = (v) => v.price || 0;

// ---- the kid ----
const KID = { racesPerSession: 6, gateRight: 0.7, quickOfRight: 0.5, sessionsPerDay: 1 };
// how hard a trail is, in "vehicle tiers" of power needed (vehicle tier + upgrade levels / 5): the ladder of worlds
// Rookie worlds want tiers 1-2.6, Pro 3.2-5.2, Legend 5.8-8.3: a cup's last trail (and its weekend) wants the next vehicles
const NEED = (i) => (i < 6 ? 1 + i * 0.32 : i < 12 ? 3.2 + (i - 6) * 0.4 : 5.8 + (i - 12) * 0.5);
const LEVEL_XP = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000, 5000, 6200, 7600, 9200, 11000, 13000, 15500, 18500, 22000];

function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function simulate(seed, maxRaces = 2400) {
  const rand = mulberry(seed);
  const st = { cash: 0, owned: { ranger150: true }, vehicle: 'ranger150', levels: { ranger150: [0, 0, 0, 0] }, cleared: {}, attempts: {}, stars: {}, trophy: {}, xp: 0, lastWeekend: {} };
  const firstAt = {}, events = [], crateRaces = [];
  let lastNew = 0, maxGap = 0, crates = 0, cratesEarly = 0, cratesLate = 0, quickShare = KID.quickOfRight;
  const vIdx = (id) => VEHICLES.findIndex((v) => v.id === id);
  const tier = () => VEHICLES[vIdx(st.vehicle)].tier || vIdx(st.vehicle) + 1;
  const lv = () => st.levels[st.vehicle];
  const power = () => tier() + lv().reduce((a, b) => a + b, 0) / 20;          // 4 × 10 levels = +2 tiers
  const cupOpen = (c) => c === 'rookie' || (!!st.trophy[CUP_IDS[CUP_IDS.indexOf(c) - 1]] && starCount() >= STARS_TO_OPEN[c]);   // any trophy AND the stars
  const starCount = () => Object.values(st.stars).reduce((a, s) => a + s.filter(Boolean).length, 0);
  const unlocked = (i) => cupOpen(cupOf(TRAILS[i], i)) && (i === 0 || cupOf(TRAILS[i - 1], i - 1) !== cupOf(TRAILS[i], i) || st.cleared[TRAILS[i - 1].id]);
  const mark = (what, race) => { if (!(what in firstAt)) firstAt[what] = race; };
  const fresh = (race) => { maxGap = Math.max(maxGap, race - lastNew - 1); lastNew = race; };
  for (let race = 1; race <= maxRaces; race++) {
    // which race: the first open trail without a podium, else a cup weekend not yet won, else the best trail for stars
    let i = TRAILS.findIndex((t, k) => unlocked(k) && !st.cleared[t.id]);
    let weekendCup = null;
    if (i < 0) {
      // a weekend now and then (every ~8 races) in a cup with every trail cleared and no trophy yet
      weekendCup = CUP_IDS.find((c) => cupOpen(c) && !st.trophy[c] && race - (st.lastWeekend[c] || -99) >= 8 && TRAILS.every((t, k) => cupOf(t, k) !== c || st.cleared[t.id]));
      if (weekendCup) st.lastWeekend[weekendCup] = race;
      const open = TRAILS.map((t, k) => k).filter(unlocked);
      i = weekendCup ? open.filter((k) => cupOf(TRAILS[k], k) === weekendCup).slice(-1)[0] : open.sort((a, b) => (st.stars[TRAILS[a].id] || []).filter(Boolean).length - (st.stars[TRAILS[b].id] || []).filter(Boolean).length || b - a)[0];
    }
    const t = TRAILS[i], cup = cupOf(t, i);
    const att = (st.attempts[t.id] = (st.attempts[t.id] || 0) + 1);
    const edge = power() - NEED(i);
    const pPodium = Math.max(0.05, Math.min(0.97, 0.4 + 0.22 * edge + 0.22 * Math.min(att - 1, 2)));
    const podium = rand() < pPodium;
    const place = podium ? (rand() < 0.4 + 0.1 * Math.max(0, edge) ? 1 : rand() < 0.55 ? 2 : 3) : 4;
    // gates: ~1 per 140 m, capped at the parent's 4
    const gates = Math.min(4, Math.max(3, Math.round(lengthOf(t) / 140)));
    let right = 0, quick = 0;
    quickShare = Math.min(0.85, KID.quickOfRight + race / 1500);       // quick answers become common as facts go secure
    for (let g = 0; g < gates; g++) if (rand() < KID.gateRight) { right++; if (rand() < quickShare) quick++; }
    const L = lengthOf(t);
    const day = Math.floor((race - 1) / (KID.racesPerSession * KID.sessionsPerDay));
    const daily = day !== st.dailyDay ? DAILY_MULT : 1;                // the first race of the day is the Pit Challenge
    st.dailyDay = day;
    const coinMult = (1 + 0.05 * lv()[3]) * (CUP_MULT[cup] || 1) * daily * (st.vehicle === 'rover' ? 1.15 : 1);
    const base = 2 * L + 30 * (2 + L / 400) + 10 * (L / 30) + 150 + 100 + [500, 300, 150, 0][place - 1] + 300 + 120 * right + 80 * quick;
    st.cash += Math.round(base * coinMult);
    st.xp += 15 * right + 5 * quick + 5 * (gates - right);
    // podium → the next trail opens; stars
    if (podium && !st.cleared[t.id]) { st.cleared[t.id] = true; fresh(race); mark(`trail ${i + 1}`, race); }
    const s = st.stars[t.id] || (st.stars[t.id] = [false, false, false]);
    const got = [place === 1, right === gates, rand() < 0.12 + 0.08 * Math.max(0, edge)];   // the stunt stars are real stunts (3 flips, 8 s of air, no crashes, the gold time)
    let newStar = false, set = false;
    got.forEach((g, k) => { if (g && !s[k]) { s[k] = true; newStar = true; } });
    if (newStar && s.every(Boolean)) set = true;
    if (newStar) fresh(race);
    // crates: podium + ≥ 3 right (bronze), all quick (silver), a level (bronze), a star set / trophy (gold), streak days
    let c = 0;
    if (podium && right >= 3) c++;
    if (quick === gates) c++;
    const lvBefore = LEVEL_XP.filter((x) => x <= st.xp - (15 * right + 5 * quick + 5 * (gates - right))).length, lvAfter = LEVEL_XP.filter((x) => x <= st.xp).length;
    if (lvAfter > lvBefore) c++;
    if (set) c++;
    if (race % 6 === 1 && [3, 7, 14, 30].includes(Math.ceil(race / 6))) c++;
    if (daily > 1) c++;                                                // the Pit Challenge of the day: a bronze crate
    // a weekend: this race stands for the 3 of it (cash ×3), a trophy when the kid would podium the cup's last trail
    if (weekendCup) {
      st.cash += 2 * Math.round(base * coinMult);
      race += 2;
      // any trophy (top 3 in points) pays and, with the stars, opens the next cup; gold pays the most
      if (rand() < Math.max(0.05, Math.min(0.95, 0.35 + 0.25 * edge))) {
        // winning a championship takes the next cup's kind of power (its first trail's need)
        const nextNeed = NEED(CUP_IDS.indexOf(weekendCup) * 6 + 6);
        const gold = rand() < Math.max(0.03, Math.min(0.9, 0.3 + 0.25 * (power() - nextNeed)));
        st.cash += Math.round((gold ? WEEKEND_BONUS.gold : WEEKEND_BONUS.bronze) * (CUP_MULT[weekendCup] || 1)); c++; fresh(race);
        st.trophy[weekendCup] = true; mark(`${weekendCup} trophy`, race);
      }
    }
    if (c) { crates += c; crateRaces.push(race); if (race <= 60) cratesEarly += c; else if (race > 600 && race <= 900) cratesLate += c; fresh(race); }
    for (const cid of CUP_IDS) if (cupOpen(cid)) mark(`${cid} cup`, race);
    for (const n of [12, 30, 54]) if (starCount() >= n) mark(`${n} stars`, race);
    // spending: the next vehicle the moment it is affordable, else cheap upgrades
    const next = VEHICLES[vIdx(st.vehicle) + 1];
    if (next && st.cash >= price(next)) {
      st.cash -= price(next); st.owned[next.id] = true; st.vehicle = next.id; st.levels[next.id] = [0, 0, 0, 0];
      mark(next.id, race); fresh(race);
    } else {
      const tm = TIER_MUL[tier() - 1];
      for (let guard = 0; guard < 8; guard++) {
        const l = lv(); const k = l.indexOf(Math.min(...l));
        if (l[k] >= MAX_LEVEL) break;
        const cost = upgradeCost(l[k], tm);
        if (st.cash < cost || (next && cost > 0.12 * price(next) && st.cash - cost < price(next) * 0.5)) break;
        st.cash -= cost; l[k]++; fresh(race);
      }
    }
    if (st.vehicle === VEHICLES[VEHICLES.length - 1].id && firstAt['legend cup'] && race > (firstAt.rover || 0) + 60) break;
  }
  return { firstAt, maxGap, crates, cratesEarly, cratesLate, races: crateRaces.length };
}

export { simulate, VEHICLES, TRAILS };
export const KIDS = 40;
export function simulateAll(n = KIDS) { return Array.from({ length: n }, (_, k) => simulate(1000 + k)); }
const direct = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (direct) main();
function main() {
const runs = simulateAll();
const avg = (key) => { const xs = runs.map((r) => r.firstAt[key]).filter((x) => x != null); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
const racesPerHour = (60 / 12) * KID.racesPerSession;
const fmtH = (r) => (r == null ? '—' : `${(r / racesPerHour).toFixed(1)} h`);
const TARGETS = { quad: 1, 'pro cup': 3, mudtruck: 8, 'legend cup': 12, rail: 25, rover: 50 };
const rows = [
  ...VEHICLES.slice(1).map((v) => [v.name || v.id, `$${price(v).toLocaleString('en-US')}`, avg(v.id), TARGETS[v.id]]),
  ['Pro Cup open', `a Rookie trophy + ${STARS_TO_OPEN.pro} ★`, avg('pro cup'), TARGETS['pro cup']],
  ['Legend Cup open', `a Pro trophy + ${STARS_TO_OPEN.legend} ★`, avg('legend cup'), TARGETS['legend cup']],
  ['12 stars', '', avg('12 stars'), null], ['30 stars', '', avg('30 stars'), null], ['54 stars', '', avg('54 stars'), null],
];
console.log(`Trail Blazer economy (${KIDS} simulated kids: 6 races per 12-minute session, 70 % of gates right, ${racesPerHour} races an hour)\n`);
console.log('| Milestone | Price / rule | Races | Hours | Target |');
console.log('|---|---|---|---|---|');
let bad = 0;
for (const [name, rule, r, target] of rows) {
  const miss = target && r != null && Math.abs(r / racesPerHour - target) / target > 0.35;
  if (target && (r == null || miss)) bad++;
  console.log(`| ${name} | ${rule} | ${r == null ? '—' : Math.round(r)} | ${fmtH(r)} | ${target ? `~${target} h${miss || r == null ? ' ✗' : ''}` : ''} |`);
}
const gap = Math.max(...runs.map((r) => r.maxGap));
const early = runs.reduce((a, r) => a + r.cratesEarly, 0) / KIDS / 60, late = runs.reduce((a, r) => a + r.cratesLate, 0) / KIDS / 300;
console.log(`\nCrates: ${early.toFixed(2)} a race in the first 60 races (one every ${(1 / early).toFixed(1)}), ${late.toFixed(2)} a race in races 600-900.`);
console.log(`Longest stretch with nothing new (a vehicle, an upgrade, a crate, a star, a trail): ${gap} races (target < 10).`);
console.log(`Upgrade multiplier per tier: ${TIER_MUL.join(' / ')} · cup cash: ×${CUP_MULT.rookie} / ×${CUP_MULT.pro} / ×${CUP_MULT.legend}`);
if (gap >= 10) bad++;
if (process.argv.includes('--check') && bad) { console.log(`\n${bad} target(s) missed`); process.exit(1); }
}

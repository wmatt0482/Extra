// Economy simulation: drives the REAL engine (src/game/engine.js + vendored Matter.js) headlessly in
// Node and plays a scripted "reasonable player" through the meta game, using the real save/economy/goals
// code. Reports runs-to-first-finish per track and runs-to-own per car.
//
//   node tools/economy-sim.mjs [--runs 320] [--verbose] [--seed-jitter 0] [--policy flip|hold]
//
// Player policy per run: hold GAS down the ramp; at the lip, if the predicted flight is long enough,
// hold BRAKE for one back flip, then release (auto-level) to land; on the ground hold NITRO until the
// tank is empty and GAS to the end. Always plays the newest unlocked track. Between runs: buys the next
// car as soon as it is affordable, otherwise keeps buying the cheapest affordable upgrade.
// Goals are simulated (real goals.js); the once-a-day daily challenge is not.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const MAX_RUNS = Number(arg('runs', 320));
const VERBOSE = args.includes('--verbose');
const JITTER = Number(arg('seed-jitter', 0)); // seconds of random delay before GAS (human variance)
const POLICY = arg('policy', 'flip'); // 'flip' (default, described above) or 'hold' (GAS held all run + nitro on the ground)

// ---- headless browser shims: Matter global, no-op canvas, no rAF ----
{
  const src = fs.readFileSync(path.join(ROOT, 'vendor/matter.min.js'), 'utf8');
  const mod = { exports: {} };
  new Function('module', 'exports', 'window', src)(mod, mod.exports, globalThis);
  globalThis.Matter = mod.exports.Matter || mod.exports;
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
}
const noop = () => {};
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (t[k] = typeof k === 'string' && /^(create|measure)/.test(k) ? () => ({ addColorStop: noop, width: 0 }) : noop)), set: () => true });
const canvas = { getContext: () => ctx2d, style: {}, width: 1, height: 1, parentElement: null, getBoundingClientRect: () => ({ width: 844, height: 390 }) };

const { createGame } = await import('../src/game/engine.js');
const { createCourse } = await import('../src/game/course.js');
const { CARS, CAR_BY_ID } = await import('../src/data/cars.js');
const { TRACKS, TRACK_BY_ID } = await import('../src/data/tracks.js');
const { UPGRADES } = await import('../src/data/upgrades.js');
const { defaultSave } = await import('../src/meta/save.js');
const { bankRun, buyCar, buyUpgrade, nextUpgradeCost, statsFor } = await import('../src/meta/economy.js');
const { ensureGoals, goalEvent, goalSummary, claimGoals } = await import('../src/meta/goals.js');
const { hashString, mulberry32 } = await import('../src/meta/rng.js');

const rnd = mulberry32(12345);

// Seconds of flight left on a ballistic path from the current state (car centre to ~1 m above ground).
function flightLeft(course, info, g) {
  let x = info.x, y = info.y, vx = info.vx, vy = info.vy;
  for (let t = 0; t < 40; t += 0.05) {
    if (vy < 0 && y - course.surfaceY(x) < 1.2) return t;
    x += vx * 0.05; y += vy * 0.05 - 0.5 * g * 0.0025; vy -= g * 0.05;
  }
  return 40;
}

export function playRun({ carId, stats, trackId, onEvent }) {
  const car = CAR_BY_ID[carId], track = TRACK_BY_ID[trackId];
  const seed = hashString('track:' + trackId);
  const course = createCourse(track, seed);
  let summary = null;
  const game = createGame(canvas, { onEvent: (e) => { onEvent && onEvent(e); if (e.type === 'finish') summary = e.summary; } });
  game.start({ car, stats, track, seed });
  const delay = JITTER ? rnd() * JITTER : 0;
  const m = { flip: 'none', ang0: 0 };
  const g = 9.81 * (track.gravity || 1);
  for (let n = 0, t = 0; !summary && n < 60 * 150; n++, t += 1 / 60) {
    const s = game.getState(), info = game.debugInfo();
    const inp = { gas: t >= delay, brake: false, nitro: false };
    if (POLICY === 'hold') {
      inp.gas = true;
      inp.nitro = s.phase === 'ground' && s.nitro > 0;
    } else if (s.phase === 'air') {
      inp.gas = false;
      if (m.flip === 'none' && info.launchKmh) {
        // a back flip takes ~1 s at full torque; only go for it with time to spare
        m.flip = flightLeft(course, info, g) > 1.6 ? 'going' : 'skip';
        m.ang0 = info.ang;
      }
      if (m.flip === 'going') {
        if (info.ang - m.ang0 < 4.6) inp.brake = true; else m.flip = 'done';
      }
    } else if (s.phase === 'ground') {
      inp.nitro = s.nitro > 0;
      if (m.flip === 'going') m.flip = 'done';
    }
    game.setInput(inp);
    game.debugStep(1);
  }
  game.destroy();
  return summary;
}

function simulate() {
  const save = defaultSave();
  save.seen.coach = true;
  ensureGoals(save);
  const owned = { beater: 0 };
  const firstFinish = {};
  const log = [];
  let goalCash = 0;
  for (let run = 1; run <= MAX_RUNS; run++) {
    const trackId = save.unlocked[save.unlocked.length - 1];
    const carId = save.selectedCar;
    const stats = statsFor(save, carId);
    const s = playRun({ carId, stats, trackId, onEvent: (e) => goalEvent(save, e) });
    const bank = bankRun(save, trackId, s);
    goalSummary(save, s);
    const goals = claimGoals(save);
    const gsum = goals.reduce((a, x) => a + x.reward, 0);
    goalCash += gsum;
    if (s.finishCrossed && !firstFinish[trackId]) firstFinish[trackId] = run;
    // shopping
    const bought = [];
    const next = CARS[CARS.findIndex((c) => c.id === save.selectedCar) + 1];
    if (next && save.cash >= next.price) { buyCar(save, next.id); owned[next.id] = run; bought.push('CAR ' + next.name); }
    for (;;) {
      let best = null;
      for (const u of UPGRADES) {
        const c = nextUpgradeCost(save, save.selectedCar, u.id);
        if (c !== null && c <= save.cash && (!best || c < best.c)) best = { id: u.id, c };
      }
      if (!best) break;
      buyUpgrade(save, save.selectedCar, best.id);
      bought.push(best.id[0].toUpperCase() + save.levels[save.selectedCar][best.id]);
    }
    const lv = save.levels[carId];
    log.push({ run, dur: s.durationSec, trackId, carId, lv: UPGRADES.map((u) => lv[u.id]).join(''), d: Math.round(s.distance), land: s.landing, flips: s.flips, fin: s.finishCrossed, cash: s.cash.total, goals: gsum, bank: save.cash, bought: bought.join(' ') });
    if (Object.keys(owned).length === CARS.length && Object.keys(firstFinish).length === TRACKS.length) break;
  }
  return { owned, firstFinish, log, goalCash, save };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) main();
function main() {
const t0 = Date.now();
const res = simulate();
if (VERBOSE) for (const l of res.log) console.log(`#${String(l.run).padStart(3)} ${l.trackId.padEnd(6)} ${l.carId.padEnd(7)} lv${l.lv} ${String(l.d).padStart(5)}m ${String(l.land).padEnd(7)} f${l.flips}${l.fin ? ' FIN' : '    '} $${String(l.cash).padStart(6)} +g${String(l.goals).padStart(5)} bank $${String(l.bank).padStart(7)}  ${l.bought}`);
console.log('\nRuns to first finish:');
for (const t of TRACKS) console.log(`  ${t.name.padEnd(14)} ${String(t.finish).padStart(5)} m  ${res.firstFinish[t.id] ? 'run ' + res.firstFinish[t.id] : 'not within ' + MAX_RUNS}`);
console.log('Runs to own:');
for (const c of CARS) console.log(`  ${c.name.padEnd(14)} $${String(c.price).padStart(6)}  ${res.owned[c.id] !== undefined ? (res.owned[c.id] ? 'run ' + res.owned[c.id] : 'start') : 'not within ' + MAX_RUNS}`);
const runs = res.log.length;
const lifetime = res.save.records.lifetimeCash;
const playMin = res.log.reduce((a, l) => a + l.dur + 12, 0) / 60; // run time + ~12 s results/garage
console.log(`Simulated ${runs} runs in ${((Date.now() - t0) / 1000).toFixed(1)} s. Lifetime cash $${lifetime.toLocaleString('en-US')} (goals $${res.goalCash.toLocaleString('en-US')}); ~${Math.round(playMin)} min of play.`);
}

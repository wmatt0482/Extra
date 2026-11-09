// Economy simulation: drives the REAL engine (src/game/engine.js + vendored Matter.js) headlessly in
// Node and plays a scripted "reasonable player" through the meta game, using the real save/economy/goals
// code. Reports runs-to-first-finish per track and runs-to-own per car.
//
//   node tools/economy-sim.mjs [--runs 320] [--verbose] [--seed-jitter 0] [--policy flip|hold]
//                              [--speller 0.75] [--runs-per-day 8]
//
// --speller p (Spell Jump v3): every run starts with a word from the sample list. With probability p (seeded)
// it is spelled first try: spelling bonus $400 × (1 + 0.1 × streak) × coinMult (streak cap 10), launch power
// 100 %, nitro 125 %; otherwise it was fixed: power 65 %, nitro 100 %, no bonus. The word's letters ride on the
// letter rings ($40 each, WORD COMPLETE $200, × coinMult, paid by the engine). Every --runs-per-day runs is one
// day; the daily mission (8 retrievals) pays $500 once per day. Qualifier / Friday Test pay-outs are not
// simulated (they add ~$100-$150 a word once a week).
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
const SKY = args.includes('--sky'); // v4.0: the Sky Era economy (a Rhino player arriving from Earth), see simulateSky()
const SKY_RHINO = Number(arg('rhino-level', 6)); // upgrade level (all four) of the Rhino on arrival
const SPELLER = args.includes('--speller') ? Number(arg('speller', 0.75)) : null; // first-try rate, or null = v2 runs
const RUNS_PER_DAY = Number(arg('runs-per-day', 8));

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
const { SKY_TRACKS, SKY_TRACK_BY_ID } = await import('../src/data/skyTracks.js');
const { SKY_RIDES, SKY_RIDE_BY_ID } = await import('../src/data/skyRides.js');
const { resolveStats, upgradeCost, MAX_LEVEL } = await import('../src/data/upgrades.js');
const { UPGRADES } = await import('../src/data/upgrades.js');
const { defaultSave } = await import('../src/meta/save.js');
const { bankRun, buyCar, buyUpgrade, nextUpgradeCost, statsFor } = await import('../src/meta/economy.js');
const { ensureGoals, goalEvent, goalSummary, claimGoals } = await import('../src/meta/goals.js');
const { hashString, mulberry32 } = await import('../src/meta/rng.js');
const { earn } = await import('../src/meta/economy.js');
const { spellBonus, STREAK_CAP } = await import('../src/spelling/wordStore.js');
const { SAMPLE_WORDS, ringLetters } = await import('../src/spelling/words.js');
const { MISSION_SIZE } = await import('../src/spelling/scheduler.js');
const MISSION_REWARD = 500;
const spellRnd = mulberry32(2024);

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

export function playRun({ carId, stats, trackId, onEvent, letters = null, powerScale = 1, nitroScale = 1, boostPower = 1, boostWord = 'friend', spellBoost = true }) {
  const car = CAR_BY_ID[carId] || SKY_RIDE_BY_ID[carId], track = TRACK_BY_ID[trackId] || SKY_TRACK_BY_ID[trackId];
  const seed = hashString('track:' + trackId);
  const course = createCourse(track, seed);
  let summary = null;
  const game = createGame(canvas, { onEvent: (e) => { onEvent && onEvent(e); if (e.type === 'finish') summary = e.summary; } });
  game.start({ car, stats, track, seed, letters, powerScale, nitroScale, spellBoost: spellBoost && track.era === 'sky' });
  const delay = JITTER ? rnd() * JITTER : 0;
  const m = { flip: 'none', ang0: 0 };
  const g = 9.81 * (track.gravity || 1);
  for (let n = 0, t = 0; !summary && n < 60 * 150; n++, t += 1 / 60) {
    const s = game.getState(), info = game.debugInfo();
    if (s.frozen) { game.boost({ power: boostPower, word: boostWord }); game.freeze(false); } // v4.0: the Spell Boost answered
    const inp = { gas: t >= delay, brake: false, nitro: false };
    if (POLICY === 'hold') {
      inp.gas = true;
      inp.nitro = s.phase === 'ground' && s.nitro > 0;
    } else if (s.phase === 'air') {
      inp.gas = false;
      if (car.glide && info.vy < 0 && s.altitude < 60) inp.nitro = true; // gliders hold NITRO on the way down
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
  let goalCash = 0, spellCash = 0, missionCash = 0, streak = 0, firstTries = 0, todayCount = 0;
  for (let run = 1; run <= MAX_RUNS; run++) {
    const trackId = save.unlocked[save.unlocked.length - 1];
    const carId = save.selectedCar;
    const stats = statsFor(save, carId);
    let spell = null;
    if (SPELLER !== null) {
      if ((run - 1) % RUNS_PER_DAY === 0) todayCount = 0;           // a new day
      const word = SAMPLE_WORDS[Math.floor(spellRnd() * SAMPLE_WORDS.length)].word;
      const firstTry = spellRnd() < SPELLER;
      const bonus = firstTry ? earn(save, spellBonus(Math.min(STREAK_CAP, streak), stats.coinMult)) : 0;
      streak = firstTry ? streak + 1 : 0;
      firstTries += firstTry ? 1 : 0;
      spellCash += bonus;
      todayCount += 1;
      const mission = todayCount === MISSION_SIZE ? earn(save, MISSION_REWARD) : 0;
      missionCash += mission;
      spell = { letters: ringLetters(word), powerScale: firstTry ? 1 : 0.65, nitroScale: firstTry ? 1.25 : 1, bonus, mission, firstTry };
    }
    const s = playRun({ carId, stats, trackId, onEvent: (e) => goalEvent(save, e), ...(spell || {}) });
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
    log.push({ run, dur: s.durationSec, trackId, carId, lv: UPGRADES.map((u) => lv[u.id]).join(''), d: Math.round(s.distance), land: s.landing, flips: s.flips, fin: s.finishCrossed, cash: s.cash.total, goals: gsum, bank: save.cash, bought: bought.join(' '), spell });
    if (Object.keys(owned).length === CARS.length && Object.keys(firstFinish).length === TRACKS.length) break;
  }
  return { owned, firstFinish, log, goalCash, save, spellCash, missionCash, firstTries };
}

// ---- v4.0 Sky Era economy: a player arrives with a Rhino at --rhino-level (all four upgrades), plays the newest unlocked Sky track
// (spell boost answered 75 % first try -> power 1, else 0.5; spelling bonus + mission as in --speller), buys the next ride when it is
// affordable, otherwise the cheapest upgrade of the selected ride. Reports runs to first finish per track and runs/days to own each ride.
function simulateSky() {
  const st = { cash: 0, owned: ['tank'], sel: 'tank', levels: { tank: { engine: SKY_RHINO, nitro: SKY_RHINO, suspension: SKY_RHINO, bonus: SKY_RHINO } } };
  const carOf = (id) => CAR_BY_ID[id] || SKY_RIDE_BY_ID[id];
  const firstFinish = {}, ownedAt = {}, log = [];
  let unlocked = 0, streak = 0, todayCount = 0, totalCash = 0;
  const perTrack = {};
  for (let run = 1; run <= MAX_RUNS; run++) {
    const trackId = SKY_TRACKS[unlocked].id;
    const car = carOf(st.sel), lv = st.levels[st.sel];
    const stats = resolveStats(car, lv);
    if ((run - 1) % RUNS_PER_DAY === 0) todayCount = 0;
    const word = SAMPLE_WORDS[Math.floor(spellRnd() * SAMPLE_WORDS.length)].word;
    const bword = SAMPLE_WORDS[Math.floor(spellRnd() * SAMPLE_WORDS.length)].word;
    const firstTry = spellRnd() < (SPELLER === null ? 0.75 : SPELLER);
    const boostFirst = spellRnd() < (SPELLER === null ? 0.75 : SPELLER);
    const bonus = firstTry ? spellBonus(Math.min(STREAK_CAP, streak), stats.coinMult) : 0;
    streak = firstTry ? streak + 1 : 0;
    const bbonus = boostFirst ? spellBonus(Math.min(STREAK_CAP, streak), stats.coinMult) : 0;
    streak = boostFirst ? streak + 1 : 0;
    todayCount += 2;
    const mission = todayCount === MISSION_SIZE ? MISSION_REWARD : 0;
    const s = playRun({ carId: st.sel, stats, trackId, letters: ringLetters(word), powerScale: firstTry ? 1 : 0.65, nitroScale: firstTry ? 1.25 : 1, boostPower: boostFirst ? 1 : 0.5, boostWord: ringLetters(bword).join('') });
    const gain = s.cash.total + bonus + bbonus + mission;
    st.cash += gain; totalCash += gain;
    const pt = (perTrack[trackId] ||= { n: 0, cash: 0, d: 0, fin: 0, by: {} });
    pt.n++; pt.cash += gain; pt.d += s.distance; pt.fin += s.finishCrossed ? 1 : 0;
    const bk = (pt.by[st.sel] ||= { n: 0, fin: 0, d: 0 }); bk.n++; bk.fin += s.finishCrossed ? 1 : 0; bk.d += s.distance;
    if (s.finishCrossed && !firstFinish[trackId]) { firstFinish[trackId] = { run, car: st.sel }; if (unlocked < SKY_TRACKS.length - 1) unlocked++; }
    const bought = [];
    const next = SKY_RIDES.find((c) => !st.owned.includes(c.id));
    if (next && st.cash >= next.price) {
      st.cash -= next.price; st.owned.push(next.id); st.sel = next.id; ownedAt[next.id] = run;
      st.levels[next.id] = { engine: 0, nitro: 0, suspension: 0, bonus: 0 }; bought.push('RIDE ' + next.name);
    }
    for (;;) {
      const c2 = carOf(st.sel), l2 = st.levels[st.sel];
      let best = null;
      for (const u of UPGRADES) { const L = l2[u.id]; if (L >= MAX_LEVEL) continue; const cost = upgradeCost(c2.tier, L); const saving = SKY_RIDES.find((c) => !st.owned.includes(c.id)); if (saving && cost > saving.price * 0.15) continue; /* saving up for the next ride */ if (cost <= st.cash && (!best || cost < best.c)) best = { id: u.id, c: cost }; }
      if (!best) break;
      st.cash -= best.c; l2[best.id]++; bought.push(best.id[0].toUpperCase() + l2[best.id]);
    }
    log.push({ run, trackId, car: st.sel, d: Math.round(s.distance), fin: s.finishCrossed, gain, bank: st.cash, bought: bought.join(' '), splashes: s.sky ? s.sky.splashes : 0 });
  }
  return { firstFinish, ownedAt, log, perTrack, totalCash };
}
function mainSky() {
  const t0 = Date.now();
  const res = simulateSky();
  if (VERBOSE) for (const l of res.log) console.log(`#${String(l.run).padStart(3)} ${l.trackId} ${l.car.padEnd(10)} ${String(l.d).padStart(5)}m ${l.fin ? 'FIN' : '   '} splash ${l.splashes} +$${String(l.gain).padStart(7)} bank $${String(l.bank).padStart(8)} ${l.bought}`);
  console.log(`\nSky Era economy: Rhino at level ${SKY_RHINO}/10 on arrival, ${MAX_RUNS} runs, ${RUNS_PER_DAY} runs a day, spell boost 75 % first try.`);
  console.log('\ntrack                          finish  grav  first finish          avg $/run   avg m   finish rate (by ride)');
  for (const t of SKY_TRACKS) {
    const f = res.firstFinish[t.id], p = res.perTrack[t.id];
    const by = p ? Object.entries(p.by).map(([c, b]) => `${c} ${b.fin}/${b.n}`).join(', ') : '';
    console.log(`${(t.id + ' ' + t.name).padEnd(30)} ${String(t.finish).padStart(5)} m  ${String(t.gravity).padStart(4)}  ${(f ? `run ${f.run} (${f.car})` : 'not within ' + MAX_RUNS).padEnd(20)} ${p ? String(Math.round(p.cash / p.n)).padStart(8) : '       -'} ${p ? String(Math.round(p.d / p.n)).padStart(7) : '      -'}   ${by}`);
  }
  console.log('\nride              price   own at run (day)');
  for (const c of SKY_RIDES) console.log(`${c.name.padEnd(14)} $${String(c.price).padStart(8)}   ${res.ownedAt[c.id] ? `run ${res.ownedAt[c.id]} (day ${Math.ceil(res.ownedAt[c.id] / RUNS_PER_DAY)})` : 'not within ' + MAX_RUNS}`);
  console.log(`\nSimulated ${res.log.length} runs in ${((Date.now() - t0) / 1000).toFixed(1)} s; lifetime sky earnings $${res.totalCash.toLocaleString('en-US')}.`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) (SKY ? mainSky : main)();
function main() {
const t0 = Date.now();
const res = simulate();
if (VERBOSE) for (const l of res.log) console.log(`#${String(l.run).padStart(3)} ${l.trackId.padEnd(6)} ${l.carId.padEnd(7)} lv${l.lv} ${String(l.d).padStart(5)}m ${String(l.land).padEnd(7)} f${l.flips}${l.fin ? ' FIN' : '    '} $${String(l.cash).padStart(6)} +g${String(l.goals).padStart(5)}${l.spell ? ` ${l.spell.firstTry ? 'S' : 's'}+${String(l.spell.bonus + l.spell.mission).padStart(4)}` : ''} bank $${String(l.bank).padStart(7)}  ${l.bought}`);
if (SPELLER !== null) console.log(`\nSpeller policy: ${Math.round(SPELLER * 100)} % first try (${res.firstTries}/${res.log.length} runs), ${RUNS_PER_DAY} runs a day, mission $${MISSION_REWARD} once a day.`);
console.log('\nRuns to first finish:');
for (const t of TRACKS) console.log(`  ${t.name.padEnd(14)} ${String(t.finish).padStart(5)} m  ${res.firstFinish[t.id] ? 'run ' + res.firstFinish[t.id] : 'not within ' + MAX_RUNS}`);
console.log('Runs to own:');
for (const c of CARS) console.log(`  ${c.name.padEnd(14)} $${String(c.price).padStart(6)}  ${res.owned[c.id] !== undefined ? (res.owned[c.id] ? 'run ' + res.owned[c.id] : 'start') : 'not within ' + MAX_RUNS}`);
const runs = res.log.length;
const lifetime = res.save.records.lifetimeCash;
const playMin = res.log.reduce((a, l) => a + l.dur + 12, 0) / 60; // run time + ~12 s results/garage
console.log(`Simulated ${runs} runs in ${((Date.now() - t0) / 1000).toFixed(1)} s. Lifetime cash $${lifetime.toLocaleString('en-US')} (goals $${res.goalCash.toLocaleString('en-US')}${SPELLER !== null ? `, spelling bonus $${res.spellCash.toLocaleString('en-US')}, missions $${res.missionCash.toLocaleString('en-US')}` : ''}); ~${Math.round(playMin)} min of play.`);
}

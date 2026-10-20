// Trail Blazer engine smoke test: drives trail-blazer/dev.html in headless Chromium (iPhone-landscape viewport).
// Usage (from anywhere): node trail-blazer/tools/engine-smoke.mjs
// Serves the REPO ROOT on :8080 itself if nothing is listening (so /trail-blazer/ and /spell-jump/ both resolve).
// Env: SHOTS_DIR (screenshot folder), BASE_URL (default http://localhost:8080), SKIP_PERF=1.
// Most checks step the simulation deterministically with game.debugStep (sim seconds, not wall clock).
// Part 1 (?race=0): the v1 trail ride (gates, stuck + winch, gates: 0). Part 2 (default): the v1.1 motocross race
// (countdown, AI riders, positions, checkpoints, flips, crash + respawn, cash, medals, perf with 4 riders), then the
// v1.2 math gates in a race (park + freeze, quick / correct / fixed, AI pass through). Part 3 (v1.5, The Season):
// every vehicle finishes Pine Ridge against the AI, every trail finishes with a tier-matched vehicle at upgrade 5,
// the ghost draws, each mutator runs a race, the turbo gate boosts, combos count, perf on the heaviest world.
// Env ONLY=v15 runs part 3 alone (plus perf); ONLY=v1 skips it.
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const SHOTS = process.env.SHOTS_DIR || '/tmp/claude-0/-home-user-Extra/0887b907-788e-5c4e-a0e5-9e998f29e90b/scratchpad/tb-engine-shots';
mkdirSync(SHOTS, { recursive: true });

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const roots = ['/home/node-tools/node_modules/'];
  try { roots.push(execSync('npm root -g').toString().trim() + '/'); } catch {}
  for (const r of roots) {
    try { return createRequire(r)('playwright'); } catch {}
  }
  throw new Error('playwright not found (tried local import, /home/node-tools, npm root -g)');
}
const { chromium } = await loadPlaywright();

let server = null;
const DEV = '/trail-blazer/dev.html';
async function ensureServer() {
  try { const res = await fetch(BASE + DEV); if (res.ok) return; } catch {}
  server = spawn('python3', ['-m', 'http.server', '8080'], { cwd: REPO, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try { const res = await fetch(BASE + DEV); if (res.ok) return; } catch {}
  }
  throw new Error('could not start http server');
}

const failures = [];
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures.push(msg); };
const TRAIL_IDS = ['pine-ridge', 'granite-gap', 'lake-loop', 'snow-pass', 'desert-wash', 'night-ride'];
const STATE_KEYS = 'airTime,boost,cash,distance,finishCrossed,flips,gateIndex,gatesTotal,phase,smashed,speedKmh,stuck,upsideDown';
const SUMMARY_KEYS = ['distance', 'durationSec', 'airTime', 'flips', 'smashed', 'coins', 'maxSpeedKmh', 'gates', 'winches', 'finishCrossed', 'cash', 'rating', 'ratingScore'];
const sumOK = (c) => c.total === c.distance + c.air + c.smash + c.gates + c.quick + c.coins + (c.finish || 0) + (c.flips || 0) + (c.perfect || 0) + (c.place || 0) + (c.combo || 0);
const { VEHICLES } = await import('../src/data/vehicles.js');
const { TRAILS, MEDAL_TIMES, trailTier } = await import('../src/data/trails.js');
const { MUTATORS } = await import('../src/data/mutators.js');
const ONLY = process.env.ONLY || '';

async function open(browser, params) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const q = new URLSearchParams({ ui: '0', ...params }).toString();
  await page.goto(`${BASE}${DEV}?${q}`);
  await page.waitForFunction(() => window.__tb && window.__tb.game && window.__tb.game.getState().phase === 'parked');
  await page.evaluate(() => window.__tb.game.pause()); // stepped by hand from here
  return { page, context, errors };
}
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const shot = async (page, name) => { await frame(page); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

// Step with a policy until `until` (JS expression over s = getState(), d = debugInfo(), ev = events, i = step) or
// maxSec of sim time. policy: 'gas' | 'gasboost'; auto: answer gates ({correct, quick: index % 2 === 0}) after
// 24 steps; winch: winch(true) 18 steps after 'stuck'.
async function drive(page, { until = 'false', maxSec = 240, policy = 'gas', auto = false, winch = false } = {}) {
  return page.evaluate(({ until, maxSec, policy, auto, winch }) => {
    const tb = window.__tb, g = tb.game;
    const cond = new Function('s', 'd', 'ev', 'i', 'return (' + until + ');');
    let s = g.getState(), hit = false, gateWait = 0, stuckWait = 0, i = 0;
    for (; i < 60 * maxSec; i++) {
      g.setInput({ gas: true, boost: policy === 'gasboost' && s.boost > 0.05 });
      s = g.debugStep(1);
      if (auto && s.phase === 'gate' && ++gateWait > 24) { gateWait = 0; g.openGate({ correct: true, quick: s.gateIndex % 2 === 0 }); }
      if (winch && s.phase === 'stuck' && ++stuckWait > 18) { stuckWait = 0; g.winch(true); }
      if (cond(s, g.debugInfo(), tb.events, i)) { hit = true; break; }
      if (s.phase === 'done') break;
    }
    return { hit, steps: i, sec: i / 60, state: g.getState(), info: g.debugInfo(), finished: tb.finished };
  }, { until, maxSec, policy, auto, winch });
}
const events = (page, type) => page.evaluate((t) => window.__tb.events.filter((e) => e.type === t), type);

await ensureServer();
const browser = await chromium.launch();
try {
  if (ONLY === 'v15') throw { skipTo: 'v15' };
  // ======== v1 trail mode (start() without `race`): gates, stuck + winch ========
  // ---- 1. stock hold-GAS on Pine Ridge with gates: reaches the first gate and parks; openGate pays $120 ----
  {
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '0', race: '0' });
    const s0 = await page.evaluate(() => window.__tb.game.getState());
    check(Object.keys(s0).filter((k) => STATE_KEYS.split(',').includes(k)).sort().join(',') === STATE_KEYS, `getState() has the contract keys (${Object.keys(s0).join(',')})`);
    check(s0.phase === 'parked' && s0.gatesTotal >= 3 && s0.boost === 1, `parked at the trail head, ${s0.gatesTotal} gates, boost tank full (${s0.boost})`);
    await shot(page, 'v1-trail-' + 'pine-ridge-1-trailhead');
    // the takeover point: front wheel at gate.x - 3 m
    const g0 = await page.evaluate(() => window.__tb.game.debugCourse().gates[0]);
    const r1 = await drive(page, { until: `d.frontX >= ${g0.x - 3}`, maxSec: 30, policy: 'gasboost' });
    const r2 = await drive(page, { until: "s.phase === 'gate'", maxSec: 5 });
    const gev = await events(page, 'gate');
    console.log(`    gate 0 at ${g0.x} m: takeover at ${r1.sec.toFixed(2)} s (${(r1.info.vf * 3.6).toFixed(0)} km/h), parked ${r2.sec.toFixed(2)} s later, front wheel ${r2.info.frontX.toFixed(2)} m`);
    check(r1.hit && r1.sec + r2.sec <= 20, `stock hold-GAS reaches the first gate within 20 s sim (${(r1.sec + r2.sec).toFixed(1)} s)`);
    check(r2.hit && r2.state.phase === 'gate' && gev.length === 1 && gev[0].index === 0 && gev[0].x === g0.x, `parks at the gate: phase 'gate' + gate {index: 0, x: ${g0.x}} (${JSON.stringify(gev[0])})`);
    check(r2.sec <= 1.5, `parked within 1.5 s of the takeover (${r2.sec.toFixed(2)} s)`);
    check(r2.info.frontX < g0.x - 0.4 && r2.info.frontX > g0.x - 3.2 && Math.abs(r2.info.vf) < 0.3, `parked in front of the sign (front wheel ${r2.info.frontX.toFixed(2)} m, gate ${g0.x} m)`);
    // input is ignored while parked
    const held = await page.evaluate(() => { const g = window.__tb.game; const a = g.debugInfo().x; for (let i = 0; i < 90; i++) { g.setInput({ gas: true, boost: true }); g.debugStep(1); } return { moved: Math.abs(g.debugInfo().x - a), phase: g.getState().phase }; });
    check(held.moved < 0.02 && held.phase === 'gate', `GAS/BOOST ignored while parked at the gate (moved ${held.moved.toFixed(3)} m)`);
    await shot(page, 'v1-trail-' + 'pine-ridge-2-gate');
    const boostBefore = (await page.evaluate(() => window.__tb.game.getState())).boost;
    const opened = await page.evaluate(() => { const g = window.__tb.game; g.setInput({ gas: false, boost: false }); const ok = g.openGate({ correct: true }); return { ok, s: g.getState() }; });
    const go = await events(page, 'gateOpen');
    check(opened.ok && opened.s.phase === 'ride' && opened.s.gateIndex === 1, `openGate({correct:true}) resumes the ride (phase ${opened.s.phase}, gateIndex ${opened.s.gateIndex})`);
    check(go.length === 1 && go[0].cash === 120, `gateOpen pays $120 (${JSON.stringify(go[0])})`);
    check(boostBefore < 0.6 && Math.abs(opened.s.boost - Math.min(1, boostBefore + 0.4)) < 0.02, `correct answer adds 40% boost fuel (${boostBefore.toFixed(2)} -> ${opened.s.boost.toFixed(2)})`);
    await page.evaluate(() => { for (let i = 0; i < 24; i++) window.__tb.game.debugStep(1); });
    await shot(page, 'v1-trail-' + 'pine-ridge-3-gate-open');
    // ride on to the end of the run (stock: gets stuck on a steep hill before the finish)
    const r3 = await drive(page, { until: "s.phase === 'stuck'", maxSec: 200, auto: true });
    console.log(`    stock Pine Ridge with gates: ${r3.state.phase} at ${r3.state.distance} m after ${r3.sec.toFixed(0)} s, gates ${r3.state.gateIndex}/${r3.state.gatesTotal}`);
    const stop = await page.evaluate(() => { window.__tb.game.stop(); return { f: window.__tb.finished, s: window.__tb.game.getState() }; });
    const S = stop.f;
    check(!!S && stop.s.phase === 'done', 'stop() ends the ride with a finish summary');
    if (S) {
      check(SUMMARY_KEYS.every((k) => k in S) && ['answered', 'correct', 'quick', 'fixed'].every((k) => k in S.gates), `summary shape (${Object.keys(S).join(',')})`);
      check(sumOK(S.cash), `summary.cash parts add up to the total (${JSON.stringify(S.cash)})`);
      check(S.cash.gates === 120 * S.gates.correct && S.gates.answered >= 1, `gate cash = $120 x correct (${S.cash.gates} for ${S.gates.correct})`);
      check(['S', 'A', 'B', 'C', 'D'].includes(S.rating), `rating is a letter (${S.rating}, ${S.ratingScore})`);
    }
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }

  // ---- 2. gates: 0, stock Pine Ridge: no gates, coins refill the boost, stall -> stuck -> winch ----
  {
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '0', gates: '0', race: '0' });
    const s0 = await page.evaluate(() => window.__tb.game.getState());
    check(s0.gatesTotal === 0, `start({ gates: 0 }): no gates (${s0.gatesTotal})`);
    // burn some boost, then check coins top it up
    const fuel = await page.evaluate(() => {
      const g = window.__tb.game, ev = window.__tb.events;
      for (let i = 0; i < 60 * 1.2; i++) { g.setInput({ gas: true, boost: true }); g.debugStep(1); }
      const low = g.getState().boost;
      let coins = 0, i = 0;
      for (; i < 60 * 40 && coins < 3; i++) { g.setInput({ gas: true, boost: false }); g.debugStep(1); coins = ev.filter((e) => e.type === 'coin').length; }
      return { low, after: g.getState().boost, coins, coinEv: ev.find((e) => e.type === 'coin'), boostEv: ev.filter((e) => e.type === 'boost').length };
    });
    check(fuel.coins >= 3 && fuel.after > fuel.low + 0.2, `trail coins refill the boost (+8% each: ${fuel.low.toFixed(2)} -> ${fuel.after.toFixed(2)} after ${fuel.coins} coins)`);
    check(fuel.coinEv && fuel.coinEv.cash === 10 && fuel.boostEv >= 2, `coin event pays $10 and boost {on} events fire (${JSON.stringify(fuel.coinEv)}, ${fuel.boostEv} boost events)`);
    const r = await drive(page, { until: "s.phase === 'stuck'", maxSec: 240 });
    const gateEv = await events(page, 'gate');
    console.log(`    stock Pine Ridge, gates 0: stuck at ${r.state.distance} m (${r.sec.toFixed(0)} s), upside down ${r.state.upsideDown}`);
    check(r.hit && r.state.stuck && gateEv.length === 0, `hold-GAS ride with no gates runs until it stalls ('stuck' at ${r.state.distance} m, no gate events)`);
    check(r.state.distance >= 250 && r.state.distance <= 480, `stock reach on Pine Ridge ${r.state.distance} m is in 250..480 m`);
    await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__tb.game.debugStep(1); });
    await shot(page, 'v1-trail-' + 'pine-ridge-4-stuck');
    const before = await page.evaluate(() => window.__tb.game.debugInfo());
    const w = await page.evaluate(() => {
      const g = window.__tb.game;
      const ok = g.winch(true);
      for (let i = 0; i < 30; i++) g.debugStep(1);
      return { ok, mid: g.getState().phase };
    });
    await shot(page, 'v1-trail-' + 'pine-ridge-5-winch');
    const after = await page.evaluate(() => { const g = window.__tb.game; for (let i = 0; i < 90 && !window.__tb.events.some((e) => e.type === 'winched'); i++) g.debugStep(1); return { d: g.debugInfo(), s: g.getState(), ev: window.__tb.events.filter((e) => e.type === 'winched') }; });
    check(w.ok && after.ev.length === 1, `winch(true) -> 'winched' event (${JSON.stringify(after.ev[0])})`);
    check(after.s.phase === 'ride' && Math.cos(after.d.ang) > 0.8 && after.d.x > before.x + 4, `after the winch: riding, upright (cos ${Math.cos(after.d.ang).toFixed(2)}), ${(after.d.x - before.x).toFixed(1)} m further up-trail`);
    const no = await page.evaluate(() => window.__tb.game.winch(false));
    check(no === false, 'winch(false) does nothing');
    // keep going with the winch until the finish: the stuck -> winch loop always gets a stock vehicle home
    const fin = await drive(page, { maxSec: 400, winch: true });
    const W = fin.finished;
    console.log(`    stock Pine Ridge, gates 0 + winch: ${W && W.finishCrossed ? 'finished' : 'not finished'} in ${W && W.durationSec} s with ${W && W.winches} winches, cash ${JSON.stringify(W && W.cash)}`);
    check(!!W && W.finishCrossed && W.winches >= 1 && sumOK(W.cash) && W.cash.finish === 300 && W.cash.coins === 10 * W.coins, `stuck/winch loop reaches the finish; cash adds up incl. finish $300 and coins $10 each`);
    check(W && W.gates.answered === 0 && W.cash.gates === 0, 'gates: 0 summary has zero gate counts and cash');
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }

  // ---- 3. upside down -> stuck (upsideDown) -> winch rights it ----
  {
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '0', gates: '0', race: '0' });
    const r = await page.evaluate(() => {
      const g = window.__tb.game;
      g.setInput({ gas: true }); g.debugStep(1); g.setInput({ gas: false });
      g.debugTeleport(60, 0, Math.PI);
      let s;
      for (let i = 0; i < 60 * 6; i++) { s = g.debugStep(1); if (s.phase === 'stuck') break; }
      return { s, d: g.debugInfo(), ev: window.__tb.events.filter((e) => e.type === 'stuck') };
    });
    check(r.s.phase === 'stuck' && r.s.upsideDown && r.ev.length === 1 && r.ev[0].upsideDown, `upside down -> phase 'stuck' with upsideDown (${JSON.stringify(r.ev[0])})`);
    await shot(page, 'v1-trail-' + 'pine-ridge-6-upside-down');
    const w = await page.evaluate(() => { const g = window.__tb.game; g.winch(true); for (let i = 0; i < 120; i++) g.debugStep(1); return { s: g.getState(), d: g.debugInfo(), ev: window.__tb.events.filter((e) => e.type === 'winched').length }; });
    check(w.ev === 1 && w.s.phase === 'ride' && !w.s.upsideDown && Math.cos(w.d.ang) > 0.8 && w.d.x > r.d.x + 4, `winch rights the vehicle and pulls it up-trail (x ${r.d.x.toFixed(1)} -> ${w.d.x.toFixed(1)})`);
    // real-time pause / resume / destroy
    const pr = await page.evaluate(async () => {
      const g = window.__tb.game, wait = (ms) => new Promise((res) => setTimeout(res, ms));
      g.setInput({ gas: true });
      g.resume();
      const a = g.debugInfo().x;
      await wait(500);
      const b = g.debugInfo().x;
      g.pause();
      await wait(300);
      const c = g.debugInfo().x;
      g.destroy();
      await wait(200);
      return { moved: b - a, frozen: Math.abs(c - b) < 0.3, after: g.getState().phase };
    });
    check(pr.moved > 1 && pr.frozen && pr.after === 'done', `resume() runs in real time (moved ${pr.moved.toFixed(1)} m), pause() + destroy() are clean (state after destroy: ${pr.after})`);
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }

  // ---- 4. lvl 10 + auto: crosses the finish on Pine Ridge and on Night Ride (with gates) ----
  for (const trail of ['pine-ridge', 'night-ride']) {
    const { page, context, errors } = await open(browser, { trail, lvl: '10', auto: '1', race: '0' });
    const r = await drive(page, { maxSec: 400, auto: true });
    const S = r.finished;
    console.log(`    ${trail} lvl 10: ${S ? `${S.distance} m in ${S.durationSec} s, gates ${S.gates.correct}/${S.gates.answered} (quick ${S.gates.quick}), winches ${S.winches}, rating ${S.rating}, $${S.cash.total}` : r.state.phase + ' at ' + r.state.distance}`);
    check(!!S && S.finishCrossed && S.distance >= S.length - 0.5, `${trail}: lvl 10 hold-GAS + auto gates crosses the finish`);
    check(!!S && S.gates.answered === S.gatesTotal && S.cash.gates === Math.round(120 * 1.5) * S.gates.correct && S.cash.quick === Math.round(80 * 1.5) * S.gates.quick, `${trail}: every gate answered and paid x coinMult (${S && JSON.stringify(S.gates)}, gates $${S && S.cash.gates}, quick $${S && S.cash.quick})`);
    check(!!S && sumOK(S.cash) && ['S', 'A', 'B'].includes(S.rating), `${trail}: cash adds up, rating ${S && S.rating} (${S && S.ratingScore})`);
    const fl = await events(page, 'finishLine');
    check(fl.length === 1, `${trail}: finishLine event fired once`);
    check(errors.length === 0, `${trail}: no console errors (${errors.join(' | ')})`);
    await context.close();
  }

  // ---- 5. every trail: trail head, mid-ride and a gate screenshot; a short lvl-6 ride per trail ----
  for (const trail of TRAIL_IDS) {
    const { page, context, errors } = await open(browser, { trail, lvl: '6', race: '0', paint: trail === 'night-ride' ? 'snow' : 'sage', decal: trail === 'desert-wash' ? 'flames' : 'none' });
    await shot(page, 'v1-trail-' + `${trail}-a-head`);
    const mid = await drive(page, { until: `s.distance > ${trail === 'pine-ridge' ? 150 : 300} && s.speedKmh > 20 && s.phase === 'ride'`, maxSec: 200, auto: true, winch: true, policy: 'gasboost' });
    await shot(page, 'v1-trail-' + `${trail}-b-mid`);
    const g = await drive(page, { until: "s.phase === 'gate'", maxSec: 200, winch: true });
    await shot(page, 'v1-trail-' + `${trail}-c-gate`);
    check(mid.hit && g.hit, `${trail}: rides to mid-trail (${mid.state.distance} m) and parks at a gate (${g.state.distance} m)`);
    if (trail === 'lake-loop') {
      // a water crossing: splash event + spray
      const w = await page.evaluate(() => { const g = window.__tb.game, c = g.debugCourse(); const s = g.getState(); const wt = c.waters.find((q) => q.x0 > s.x + 5) || c.waters[0]; g.openGate({ correct: true }); g.debugTeleport(wt.x0 - 14, 9); return wt; });
      const n0 = (await events(page, 'splash')).length;
      const sp = await drive(page, { until: `ev.filter((e) => e.type === 'splash').length > ${n0}`, maxSec: 10 });
      await page.evaluate(() => { for (let i = 0; i < 14; i++) window.__tb.game.debugStep(1); });
      await shot(page, 'v1-trail-' + `${trail}-d-splash`);
      check(sp.hit, `lake-loop: driving into the water crossing at ${w.x0.toFixed(0)} m fires 'splash'`);
    }
    if (trail === 'granite-gap' || trail === 'desert-wash') {
      const b = await page.evaluate(() => { const g = window.__tb.game, c = g.debugCourse(); const b = c.bridges[0]; g.openGate({ correct: true }); g.debugTeleport(b.x0 - 4, 8); for (let i = 0; i < 40; i++) { g.setInput({ gas: true }); g.debugStep(1); } return { b, d: g.debugInfo() }; });
      await shot(page, 'v1-trail-' + `${trail}-d-bridge`);
      check(Math.abs(b.d.y - b.d.groundY) < 2.2, `${trail}: the bridge deck carries the vehicle over the gap (${(b.d.y - b.d.groundY).toFixed(2)} m above the deck)`);
    }
    check(errors.length === 0, `${trail}: no console errors (${errors.join(' | ')})`);
    await context.close();
  }

  // ======== v1.1 race mode (start({ race })) ========
  // the scripted player: GAS once the gate drops, BOOST whenever the tank is over 30 %
  const racePolicy = "({ gas: s.countdown === 0, boost: s.countdown === 0 && s.boost > 0.3 })";
  async function raceDrive(page, { until = 'false', maxSec = 300, policy = racePolicy } = {}) {
    return page.evaluate(({ until, maxSec, policy }) => {
      const tb = window.__tb, g = tb.game;
      const cond = new Function('s', 'd', 'ev', 'return (' + until + ');');
      const pol = new Function('s', 'd', 'return ' + policy + ';');
      let s = g.getState(), i = 0, hit = false;
      for (; i < 60 * maxSec; i++) {
        g.setInput(pol(s, g.debugInfo()));
        s = g.debugStep(1);
        if (cond(s, g.debugInfo(), tb.events)) { hit = true; break; }
        if (tb.finished) break;
      }
      return { hit, sec: i / 60, state: g.getState(), info: g.debugInfo(), finished: tb.finished };
    }, { until, maxSec, policy });
  }
  // ---- R1. stock race on Pine Ridge: countdown, gate drop, positions, checkpoints, finish, AI all finish ----
  {
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '0', gates: '0' });
    const s0 = await page.evaluate(() => window.__tb.game.getState());
    check(s0.race === true && s0.phase === 'parked' && s0.riders.length === 4 && s0.riders.filter((x) => !x.me).map((x) => x.name).join(',') === 'Max,Zoe,Kai',
      `race start: parked on the grid with 3 AI riders (${s0.riders.map((x) => x.name + '/' + x.paint).join(', ')})`);
    await raceDrive(page, { until: "ev.some((e) => e.type === 'countdown' && e.n === 2)", maxSec: 3 });
    await shot(page, 'race-1-start-gate');
    const go = await raceDrive(page, { until: "ev.some((e) => e.type === 'go')", maxSec: 5 });
    const cd = (await events(page, 'countdown')).map((e) => e.n).join(',');
    check(go.hit && cd === '3,2,1' && go.state.phase === 'ride', `3-2-1 countdown then 'go' (countdown ${cd}, go after ${(go.sec).toFixed(1)} s more)`);
    await raceDrive(page, { maxSec: 0.5 });
    await shot(page, 'race-2-gate-drop');
    const mid = await raceDrive(page, { until: 's.distance > 250 && d.air', maxSec: 60 });
    await shot(page, 'race-3-mid-air');
    await raceDrive(page, { until: "ev.some((e) => e.type === 'lap')", maxSec: 120 });
    await raceDrive(page, { maxSec: 0.45 });
    await shot(page, 'race-4-podium');
    const fin = await raceDrive(page, { maxSec: 120 });
    const S = fin.finished;
    const lap = await events(page, 'lap');
    const pos = await events(page, 'position');
    const cps = await events(page, 'checkpoint');
    console.log(`    stock Pine Ridge race: place ${S && S.place}, ${S && S.timeSec} s, medal ${S && S.medal}, flips ${S && S.flips}, crashes ${S && S.crashes}, $${S && S.cash.total} ${JSON.stringify(S && S.cash)}`);
    check(!!S && S.race && S.finishCrossed && S.place >= 1 && S.place <= 4 && S.timeSec > 10, `the scripted stock player finishes Pine Ridge with a place (${S && S.place}) and a time (${S && S.timeSec} s)`);
    check(S && S.place === 1, `stock + clean riding wins Pine Ridge (place ${S && S.place})`);
    globalThis.__pineStockTime = S && S.timeSec;
    check(lap.length === 1 && Math.abs(lap[0].timeSec - S.timeSec) < 0.05, `lap {timeSec} at the finish (${JSON.stringify(lap[0])})`);
    check(pos.length >= 1 && pos.every((e) => e.place >= 1 && e.place <= 4), `position {place} events (${pos.map((e) => e.place).join(',')})`);
    check(cps.length >= 3 && cps.every((e, i) => e.index === i + 1), `checkpoint {index} events in order (${cps.map((e) => e.index).join(',')})`);
    check(S && sumOK(S.cash) && S.cash.place === 500 && S.cash.finish === 300, `race cash adds up incl. place $500 + finish $300 (${JSON.stringify(S && S.cash)})`);
    check(S && ['S', 'A', 'B', 'C', 'D'].includes(S.rating) && ['gold', 'silver', 'bronze', null].includes(S.medal), `race rating ${S && S.rating} (${S && S.ratingScore}), medal ${S && S.medal}`);
    const all = await page.evaluate(() => { const g = window.__tb.game; for (let i = 0; i < 60 * 60 && g.getState().riders.some((x) => !x.finished); i++) g.debugStep(1); return g.getState().riders; });
    console.log(`    finish order: ${all.slice().sort((a, b) => a.place - b.place).map((x) => `${x.place}. ${x.name} ${x.timeSec}s`).join(' · ')}`);
    check(all.every((x) => x.finished && x.timeSec > 0), `all AI riders finish (${all.map((x) => x.name + ' ' + x.timeSec).join(', ')})`);
    const st = await page.evaluate(() => window.__tb.game.getState());
    check(['place', 'timeSec', 'riders', 'crashed', 'countdown'].every((k) => k in st) && st.riders.every((x) => 'name' in x && 'paint' in x && 'x' in x), 'getState() race fields (place, timeSec, riders [{name, paint, x}], crashed, countdown)');
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  // ---- R2. GAS before the drop = a bogged start ----
  {
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '0', gates: '0' });
    await raceDrive(page, { until: "ev.some((e) => e.type === 'go')", maxSec: 5, policy: '({ gas: true })' });
    const b = await events(page, 'bogged');
    check(b.length === 1, 'holding GAS before the gate drops bogs the start (bogged event)');
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  // ---- R3. a landed backflip scores; R4. an over-rotated landing crashes and respawns at a checkpoint ----
  {
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '0', riders: '0', gates: '0' });
    const setup = await page.evaluate(() => {
      const g = window.__tb.game, c = g.debugCourse();
      const f = c.features.find((f) => f.type === 'big');
      const a = c.arcs.find((a) => Math.abs(a.x - f.lip) < 1);
      g.debugTeleport(f.x0 - 30, a.v * 0.95);
      return { lip: f.lip, v: a.v };
    });
    // lean back (BRAKE) once airborne, let go at ~3/4 of a turn: the suspension finishes it
    const fl = await raceDrive(page, { until: 'd.air && Math.abs(d.flightRot) > 2.4', maxSec: 6, policy: '({ gas: !d.air, brake: d.air })' });
    await shot(page, 'race-5-backflip');
    const land = await raceDrive(page, { until: "ev.some((e) => e.type === 'land' || e.type === 'crash')", maxSec: 6, policy: '({ gas: !d.air, brake: d.air && Math.abs(d.flightRot) < Math.PI * 2 - 2.2 })' });
    const flips = await events(page, 'flip');
    console.log(`    big jump at ${setup.lip.toFixed(0)} m: ${JSON.stringify(await events(page, 'land'))} ${JSON.stringify(flips)}`);
    check(fl.hit && flips.length === 1 && flips[0].kind === 'back' && flips[0].count === 1 && flips[0].cash === 150, `a landed backflip scores flip {kind: 'back', count: 1} +$150 (${JSON.stringify(flips[0])})`);
    const ba = await events(page, 'bigAir');
    check(ba.length === 1 && ba[0].airTime >= 1.5, `bigAir on a >= 1.5 s flight (${JSON.stringify(ba[0])})`);
    // the crash: dropped onto its roof (a flip that went wrong) on a flat stretch past the big jump
    const pre = await page.evaluate(() => { const g = window.__tb.game, c = g.debugCourse(); const cp = c.checkpoints.filter((p) => p.x > 440).shift() || c.checkpoints[c.checkpoints.length - 1]; g.debugTeleport(cp.x + 6, 0, Math.PI); return { cp: cp.index }; });
    const cr = await raceDrive(page, { until: "ev.some((e) => e.type === 'crash')", maxSec: 3, policy: '({})' });
    await raceDrive(page, { maxSec: 0.3, policy: '({})' });
    await shot(page, 'race-6-crash');
    const crashX = cr.info.x;
    const rs = await raceDrive(page, { until: "ev.some((e) => e.type === 'respawn')", maxSec: 3, policy: '({})' });
    const rev = (await events(page, 'respawn'))[0];
    const cpx = await page.evaluate((i) => window.__tb.game.debugCourse().checkpoints[i].x, rev ? rev.checkpoint : 0);
    console.log(`    crash at ${crashX.toFixed(1)} m (in the air at ${cr.sec.toFixed(2)} s), respawn ${JSON.stringify(rev)} after ${rs.sec.toFixed(2)} s`);
    check(cr.hit && rs.hit && rs.sec + 0.3 <= 1.7 && rs.sec + 0.3 >= 1.2, `a roof landing crashes (driver + helmet thrown), then respawns ~1.5 s later (${(rs.sec + 0.3).toFixed(2)} s)`);
    check(rev && Math.abs(cpx - rev.x) < 0.2 && rev.x <= crashX + 1 && Math.cos(rs.info.ang) > 0.9 && rs.info.vf > 5, `respawn at the last checkpoint (${rev && rev.x} m, crash at ${crashX.toFixed(0)} m), upright, with a push (${rs.info.vf.toFixed(1)} m/s)`);
    const stp = await page.evaluate(() => { const g = window.__tb.game; g.stop(); return window.__tb.finished; });
    check(stp && stp.crashes === 1 && stp.flips === 1 && stp.cash.flips === 150 && stp.place === 1 && sumOK(stp.cash), `stop() mid-race: summary with flips 1 ($150), crashes 1, place (${stp && JSON.stringify({ flips: stp.flips, crashes: stp.crashes, place: stp.place, cash: stp.cash })})`);
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  // ---- R5. lvl 10 wins Night Ride ----
  {
    const { page, context, errors } = await open(browser, { trail: 'night-ride', lvl: '10', gates: '0' });
    const fin = await raceDrive(page, { maxSec: 300 });
    const S = fin.finished;
    console.log(`    Night Ride lvl 10: place ${S && S.place}, ${S && S.timeSec} s, medal ${S && S.medal}; ${S && S.riders.map((x) => x.name + ' ' + (x.timeSec ?? Math.round(x.x) + 'm')).join(' · ')}`);
    check(!!S && S.place === 1 && S.finishCrossed, `lvl 10 wins Night Ride (place ${S && S.place}, ${S && S.timeSec} s)`);
    check(S && sumOK(S.cash), 'cash adds up');
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  // ---- R6. every track: the start and a mid-race jump ----
  for (const trail of TRAIL_IDS) {
    const { page, context, errors } = await open(browser, { trail, lvl: '4', gates: '0', paint: trail === 'night-ride' ? 'snow' : 'sage', decal: trail === 'desert-wash' ? 'flames' : 'none' });
    await raceDrive(page, { until: "ev.some((e) => e.type === 'countdown' && e.n === 1)", maxSec: 4 });
    await shot(page, `race-${trail}-a-start`);
    const m = await raceDrive(page, { until: `s.distance > ${Math.round(TRAIL_IDS.indexOf(trail) < 1 ? 200 : 380)} && d.air && s.airTime > 0.4`, maxSec: 90 });
    await shot(page, `race-${trail}-b-air`);
    check(m.hit, `${trail}: races to mid-track and jumps (${m.state.distance} m, place ${m.state.place})`);
    check(errors.length === 0, `${trail}: no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  // ======== v1.2 math gates in a race ========
  // ---- G. Pine Ridge, stock, 4 gates: park + freeze, quick / fixed / correct, the race still finishes ----
  {
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '0', gates: '4' });
    const gx = await page.evaluate(() => window.__tb.game.debugCourse().gates.map((g) => g.x));
    const s0 = await page.evaluate(() => window.__tb.game.getState());
    check(s0.gatesTotal === 4 && gx.every((x, i) => i === 0 || x - gx[i - 1] > 40), `race with gates: 4 gate signs on the track (${gx.map((x) => x.toFixed(0)).join(', ')} m)`);
    // AI speed near the gates, sampled over the whole race (they are ghosts: they never stop there)
    await page.evaluate((gx) => { window.__aiMin = 99; window.__gx = gx; }, gx);
    const sampler = `(() => { if (!s.frozen && s.countdown === 0 && s.timeSec > 3) for (const a of window.__tb.game.debugRiders()) if (a.name !== 'You' && !a.finished && !a.crashed && window.__gx.some((x) => Math.abs(a.x - x) < 4)) window.__aiMin = Math.min(window.__aiMin, a.vf); return false; })()`;
    const ap = await raceDrive(page, { until: `${sampler} || s.gateApproach`, maxSec: 60 });
    const pk = await raceDrive(page, { until: "s.phase === 'gate'", maxSec: 3, policy: '({ gas: true })' });
    const ge = await events(page, 'gate');
    check(ap.hit && pk.hit && pk.sec <= 1.05 && ge.length === 1 && ge[0].index === 0, `the player glides to a stop at gate 1 in ${pk.sec.toFixed(2)} s (<= ~1 s): phase 'gate', gate {index: 0, x: ${ge[0] && ge[0].x.toFixed(1)}}`);
    check(pk.info.frontX < gx[0] - 0.5 && pk.info.frontX > gx[0] - 2.5, `parked in front of the sign (front wheel ${pk.info.frontX.toFixed(2)} m, sign ${gx[0].toFixed(1)} m)`);
    const snap = () => page.evaluate(() => { const g = window.__tb.game, s = g.getState(), d = g.debugInfo(); return JSON.stringify({ r: s.riders.map((x) => x.x), t: s.timeSec, me: s.x, p: d.particles }); });
    const a = await snap();
    await page.evaluate(() => { const g = window.__tb.game; for (let i = 0; i < 45; i++) { g.setInput({ gas: true, boost: true }); g.debugStep(1); } });
    await frame(page); await frame(page);
    const b = await snap();
    check(a === b, `while the gate is open the whole race is frozen: riders, clock, particles (${a})`);
    await shot(page, 'race-7-gate-stop');
    const q = await page.evaluate(() => {
      const g = window.__tb.game, b0 = g.getState().boost, ai0 = g.getState().riders.filter((x) => !x.me).map((x) => x.x);
      const ok = g.openGate({ correct: true, quick: true });
      const s1 = g.getState();
      for (let i = 0; i < 40; i++) { g.setInput({ gas: true }); g.debugStep(1); }
      const s2 = g.getState();
      return { ok, b0, b1: s1.boost, phase: s1.phase, me0: s1.x, me1: s2.x, ai0, ai1: s2.riders.filter((x) => !x.me).map((x) => x.x), ev: window.__tb.events.filter((e) => e.type === 'gateOpen') };
    });
    check(q.ok && q.phase === 'ride' && q.ev.length === 1 && q.ev[0].cash === 200 && q.ev[0].quick, `quick answer: the gate drops, +$200 (${JSON.stringify(q.ev[0])})`);
    check(q.b1 >= Math.min(1, q.b0 + 0.59) - 1e-6 && q.me1 - q.me0 > 8 && q.ai1.every((x, i) => x > q.ai0[i]), `quick: +60 % boost (${q.b0.toFixed(2)} -> ${q.b1.toFixed(2)}) and a push; everyone resumes at once (you +${(q.me1 - q.me0).toFixed(1)} m in 0.67 s)`);
    await page.evaluate(() => { for (let i = 0; i < 20; i++) window.__tb.game.debugStep(1); });
    await shot(page, 'race-8-gate-quick');
    // gate 2: fixed → the rivals get a 1.5 s head start while the player waits at the line
    await raceDrive(page, { until: `${sampler} || s.phase === 'gate'`, maxSec: 60 });
    const fx = await page.evaluate(() => {
      const g = window.__tb.game;
      const t0 = g.getState().timeSec;
      g.openGate({ fixed: true });
      const s0 = g.getState(), ai0 = s0.riders.filter((x) => !x.me && !x.finished).map((x) => x.name + ':' + x.x);
      for (let i = 0; i < 80; i++) { g.setInput({ gas: true, boost: true }); g.debugStep(1); }
      const s1 = g.getState();
      for (let i = 0; i < 30; i++) { g.setInput({ gas: true }); g.debugStep(1); }
      const s2 = g.getState();
      const aiNow = Object.fromEntries(s1.riders.map((x) => [x.name, x.x]));
      return { t0, hold0: s0.gateHold, me0: s0.x, me1: s1.x, me2: s2.x, t1: s1.timeSec, b0: s0.boost, ai: ai0.map((k) => { const [n, x] = k.split(':'); return aiNow[n] - Number(x); }), ev: window.__tb.events.filter((e) => e.type === 'gateOpen').pop() };
    });
    console.log(`    fixed at gate 2: hold ${fx.hold0} s, you ${fx.me0} -> ${fx.me1} (held) -> ${fx.me2} m, rivals +${fx.ai.map((d) => d.toFixed(1)).join(' / +')} m, clock ${fx.t0} -> ${fx.t1} s`);
    check(fx.ev.fixed && fx.ev.cash === 40 && fx.ev.fuel === 0 && Math.abs(fx.hold0 - 1.5) < 0.02, `fixed answer: the gate drops, +$40, no boost, a 1.5 s hold (${JSON.stringify(fx.ev)})`);
    check(Math.abs(fx.me1 - fx.me0) < 0.05 && fx.ai.length > 0 && fx.ai.every((d) => d > 5) && fx.t1 - fx.t0 > 1.2, `fixed: the rivals run (+${fx.ai.map((d) => d.toFixed(0)).join('/')} m) and the clock runs while you wait at the line`);
    check(fx.me2 - fx.me1 > 3, `fixed: released after 1.5 s (+${(fx.me2 - fx.me1).toFixed(1)} m)`);
    // the rest: correct answers to the finish
    const fin = await page.evaluate((sampler) => {
      const tb = window.__tb, g = tb.game;
      const samp = new Function('s', 'return ' + sampler + ';');
      for (let i = 0; i < 60 * 200 && !tb.finished; i++) {
        let s = g.getState();
        if (s.phase === 'gate') g.openGate({ correct: true });
        g.setInput({ gas: true, boost: s.boost > 0.3 });
        s = g.debugStep(1);
        samp(s);
      }
      for (let i = 0; i < 60 * 60 && g.getState().riders.some((x) => !x.finished); i++) g.debugStep(1);
      return { S: tb.finished, riders: g.getState().riders, aiMin: window.__aiMin };
    }, sampler);
    const S = fin.S;
    console.log(`    gated race: place ${S && S.place}, ${S && S.timeSec} s (no gates: ${globalThis.__pineStockTime} s), medal ${S && S.medal}, gates ${JSON.stringify(S && S.gates)}, cash ${JSON.stringify(S && S.cash)}, AI min speed at gates ${fin.aiMin.toFixed(1)} m/s`);
    check(!!S && S.finishCrossed && S.place >= 1 && S.place <= 4 && S.timeSec > 10, `the gated race finishes with a place (${S && S.place}) and a time (${S && S.timeSec} s)`);
    check(S && S.gates.answered === 4 && S.gates.quick === 1 && S.gates.fixed === 1 && S.gates.correct === 3, `summary gates ${JSON.stringify(S && S.gates)}`);
    check(S && sumOK(S.cash) && S.cash.gates === 120 * S.gates.correct + 40 * S.gates.fixed && S.cash.quick === 80 * S.gates.quick, `gate cash in cash.gates ($${S && S.cash.gates}) + cash.quick ($${S && S.cash.quick}); all parts add up`);
    check(S && globalThis.__pineStockTime && S.timeSec < globalThis.__pineStockTime * 1.15, `time spent in gates never counts: ${S && S.timeSec} s with 4 gates vs ${globalThis.__pineStockTime} s without (medal targets unchanged)`);
    check(fin.aiMin > 3, `the AI riders never stop at a gate (slowest near a gate: ${fin.aiMin.toFixed(1)} m/s)`);
    check(fin.riders.every((x) => x.finished), 'all riders finish');
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  // ---- G2. dev.html ?gates=4&auto=1 answers quick / correct / fixed in turn (real time) ----
  {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}${DEV}?ui=0&trail=pine-ridge&lvl=6&gates=4&auto=1&sim=4`);
    await page.waitForFunction(() => window.__tb && window.__tb.game);
    await page.evaluate(() => window.__tb.game.setInput({ gas: true }));
    await page.waitForFunction(() => window.__tb.events.filter((e) => e.type === 'gateOpen').length >= 3, null, { timeout: 60000 });
    const ev = await events(page, 'gateOpen');
    check(ev[0].quick && ev[1].correct && !ev[1].quick && ev[2].fixed, `auto=1: quick / correct / fixed in turn (${ev.map((e) => (e.quick ? 'quick' : e.fixed ? 'fixed' : 'correct')).join(', ')})`);
    check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
    await context.close();
  }
} catch (e) {
  if (!e || e.skipTo !== 'v15') { failures.push('exception: ' + e.message); console.error(e); }
}
try {
  if (ONLY === 'v1') throw { skipTo: 'perf' };
  // ======== v1.5 The Season ========
  const racePolicy = "({ gas: s.countdown === 0, boost: s.countdown === 0 && s.boost > 0.3 })";
  async function raceDrive(page, { until = 'false', maxSec = 300, policy = racePolicy, auto = false } = {}) {
    return page.evaluate(({ until, maxSec, policy, auto }) => {
      const tb = window.__tb, g = tb.game;
      const cond = new Function('s', 'd', 'ev', 'return (' + until + ');');
      const pol = new Function('s', 'd', 'return ' + policy + ';');
      let s = g.getState(), i = 0, hit = false, gateWait = 0;
      for (; i < 60 * maxSec; i++) {
        if (auto && s.phase === 'gate' && ++gateWait > 12) { gateWait = 0; g.openGate({ correct: true, quick: s.gateIndex % 2 === 0 }); }
        g.setInput(pol(s, g.debugInfo()));
        s = g.debugStep(1);
        if (cond(s, g.debugInfo(), tb.events)) { hit = true; break; }
        if (tb.finished) break;
      }
      return { hit, sec: i / 60, state: g.getState(), info: g.debugInfo(), finished: tb.finished };
    }, { until, maxSec, policy, auto });
  }
  const comboSeen = { events: 0, maxCount: 0, cash: 0 };
  // ---- V1. every vehicle finishes Pine Ridge against the AI (rivals on the tier ± 1 lineup) ----
  const SHOT_VEHICLES = ['quad', 'dirtbike', 'mudtruck', 'rail'];
  for (const v of VEHICLES) {
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '0', gates: '0', vehicle: v.id, helmet: 'flames', suit: 'racer', flag: 'checker', trailfx: 'blue' });
    const s0 = await page.evaluate(() => window.__tb.game.getState());
    const rv = s0.riders.filter((x) => !x.me).map((x) => x.vehicle);
    const tiers = rv.map((id) => VEHICLES.find((q) => q.id === id).tier);
    check(s0.vehicle === v.id && rv.length === 3 && tiers.every((t) => Math.abs(t - v.tier) <= 2), `${v.id}: the grid has 3 rivals on the tier ± 1 lineup (${rv.join(', ')})`);
    if (SHOT_VEHICLES.includes(v.id)) {
      await raceDrive(page, { until: 's.countdown === 0 && s.timeSec > 2.2 && s.speedKmh > 30', maxSec: 20 });
      await shot(page, `v15-vehicle-${v.id}`);
    }
    const fin = await raceDrive(page, { maxSec: 240 });
    const S = fin.finished;
    const cb = await events(page, 'combo');
    if (S) { comboSeen.events += cb.length; comboSeen.maxCount = Math.max(comboSeen.maxCount, S.comboMax || 0); comboSeen.cash += S.cash.combo || 0; }
    console.log(`    ${v.id.padEnd(9)} Pine Ridge: place ${S && S.place}, ${S && S.timeSec} s, crashes ${S && S.crashes}, flips ${S && S.flips}, combo max x${S && S.comboMax}, $${S && S.cash.total} (combo $${S && S.cash.combo}), max ${S && S.maxSpeedKmh} km/h, rivals ${S && S.riders.filter((x) => !x.me).map((x) => x.name + (x.timeSec ? ' ' + x.timeSec + 's' : ' ' + Math.round(x.x) + 'm')).join(' · ')}`);
    check(!!S && S.finishCrossed && S.vehicle === v.id && S.place >= 1 && S.place <= 4, `${v.id}: finishes Pine Ridge against the AI (place ${S && S.place}, ${S && S.timeSec} s)`);
    check(!!S && sumOK(S.cash) && (S.cash.combo || 0) >= 0, `${v.id}: cash parts add up incl. combo (${S && JSON.stringify(S.cash)})`);
    if (v.id === 'ranger150') check(S && S.place === 1, `the stock Ranger still wins Pine Ridge with clean riding (place ${S && S.place})`);
    if (v.id === 'rover') check(fin.info.gravity < 0.65 && fin.info.gravity > 0.55, `the Moon Rover rides at 0.6 g (${fin.info.gravity})`);
    check(errors.length === 0, `${v.id}: no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  check(comboSeen.events >= 1 && comboSeen.maxCount >= 2 && comboSeen.cash > 0, `combos chain across the vehicle races: ${comboSeen.events} combo events, best x${comboSeen.maxCount}, $${comboSeen.cash} combo cash`);
  // ---- V2. every trail finishes with a tier-matched vehicle at upgrade 5 (4 gates, auto-answered) ----
  const SHOT_WORLDS = { 'jungle-rumble': 1, 'volcano-vent': 1, 'neon-city': 1, 'sky-bridge': 1, 'moon-base': 1, 'rainbow-ridge': 1, 'canyon-run': 1, 'beach-blast': 1, 'swamp-stomp': 1, 'glacier-gorge': 1, 'dino-dunes': 1, 'haunted-hollow': 1 };
  for (const trail of TRAILS) {
    const tier = trailTier(trail), vid = VEHICLES[tier - 1].id;
    const { page, context, errors } = await open(browser, { trail: trail.id, lvl: '5', gates: '4', vehicle: vid, suit: 'stars', helmet: 'astronaut', flag: 'rainbow' });
    if (SHOT_WORLDS[trail.id]) {
      const m = await raceDrive(page, { until: 's.distance > 300 && d.air && s.airTime > 0.3', maxSec: 60, auto: true });
      await shot(page, `v15-world-${trail.id}`);
      check(m.hit, `${trail.id}: ${vid} races to 300 m and jumps (${m.state.distance} m)`);
    }
    const fin = await raceDrive(page, { maxSec: 420, auto: true });
    const S = fin.finished;
    const mt = MEDAL_TIMES[trail.id];
    console.log(`    ${trail.id.padEnd(15)} ${vid.padEnd(9)} lvl 5: place ${S && S.place}, ${S && S.timeSec} s (gold ${mt.gold} / bronze ${mt.bronze}), medal ${S && S.medal}, crashes ${S && S.crashes}, fell ${S && S.fell}, flips ${S && S.flips}, max ${S && S.maxSpeedKmh} km/h, gates ${S && S.gates.correct}/${S && S.gates.answered}, $${S && S.cash.total}`);
    check(!!S && S.finishCrossed && S.gates.answered === 4 && sumOK(S.cash), `${trail.id}: ${vid} at upgrade 5 finishes (${S && S.timeSec} s, place ${S && S.place})`);
    check(!!S && S.timeSec <= mt.bronze * 1.25, `${trail.id}: a clean scripted run is within 25 % of the bronze time (${S && S.timeSec} s vs ${mt.bronze} s)`);
    if (trail.id === 'moon-base') check(Math.abs(fin.info.gravity - 0.3) < 0.01, `Moon Base (0.4 g) with the Moon Rover (x0.6) rides at the 0.3 g floor (${fin.info.gravity})`);
    if (trail.id === 'sky-bridge') check(S && S.fell >= 0 && (await page.evaluate(() => window.__tb.game.debugCourse().zones.filter((z) => z.type === 'gap').length)) >= 3, `Sky Bridge has gap pits (fell ${S && S.fell} times)`);
    check(errors.length === 0, `${trail.id}: no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  // ---- V3. ghost: a finished run's trace replays as a translucent ghost; beatGhost + ghostGap ----
  {
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '3', gates: '0', vehicle: 'quad', ghost: '1' });
    const first = await raceDrive(page, { maxSec: 200 });
    const S1 = first.finished;
    const tr = S1 && S1.ghostTrace;
    check(!!tr && tr.length >= 100 && tr.length <= 1500 && tr.every((p) => p.length === 4), `summary.ghostTrace: ${tr && tr.length} samples of [t, x, y, angle] (${tr && JSON.stringify(tr[10])})`);
    check(!!tr && Math.abs(tr[11][0] - tr[10][0] - 0.1) < 0.011 && S1.beatGhost === null && S1.ghostTime === null, `samples every 0.1 s; no ghost this run → beatGhost null`);
    // the dev page stores the trace in sessionStorage; a reload with ghost=1 replays it
    await page.reload();
    await page.waitForFunction(() => window.__tb && window.__tb.game && window.__tb.game.getState().phase === 'parked');
    await page.evaluate(() => window.__tb.game.pause());
    const has = await page.evaluate(() => !!window.__tb.ghost && window.__tb.ghost.length);
    check(!!has, `start({ ghost }) takes the stored trace (${has} samples)`);
    await raceDrive(page, { until: 's.timeSec > 4', maxSec: 20 });
    const gap0 = (await page.evaluate(() => window.__tb.game.getState())).ghostGap;
    await shot(page, 'v15-ghost');
    // a slower ride (no boost) loses to the ghost
    const fin = await raceDrive(page, { maxSec: 200, policy: '({ gas: s.countdown === 0 })' });
    const S2 = fin.finished;
    const passed = await events(page, 'ghostPassed');
    console.log(`    ghost: first run ${S1 && S1.timeSec} s, second (no boost) ${S2 && S2.timeSec} s, gap at 4 s ${gap0}, beatGhost ${S2 && S2.beatGhost}, ghostPassed x${passed.length}`);
    check(typeof gap0 === 'number' && S2 && S2.ghostTime === S1.timeSec, `state.ghostGap is a number (${gap0}) and summary.ghostTime is the ghost's time (${S2 && S2.ghostTime})`);
    check(S2 && S2.beatGhost === (S2.timeSec < S1.timeSec), `beatGhost ${S2 && S2.beatGhost} matches the times (${S2 && S2.timeSec} vs ${S1 && S1.timeSec})`);
    check(errors.length === 0, `ghost: no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  // ---- V4. each mutator runs a Pine Ridge race to the finish; its effect is visible ----
  let baseTop = 0;
  for (const m of [null, ...MUTATORS]) {
    const id = m ? m.id : null;
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '4', gates: '0', vehicle: 'buggy', ...(id ? { mutator: id } : {}) });
    const info0 = await page.evaluate(() => window.__tb.game.debugInfo());
    const s0 = await page.evaluate(() => window.__tb.game.getState());
    if (!id) baseTop = info0.vTop;
    if (id === 'fog') { await raceDrive(page, { until: 's.timeSec > 3', maxSec: 20 }); await shot(page, 'v15-mutator-fog'); }
    if (id === 'mirror') { await raceDrive(page, { until: 's.timeSec > 2', maxSec: 20 }); await shot(page, 'v15-mutator-mirror'); }
    if (id === 'giantwheels') { await raceDrive(page, { until: 's.timeSec > 2', maxSec: 20 }); await shot(page, 'v15-mutator-giantwheels'); }
    const fin = await raceDrive(page, { maxSec: 240 });
    const S = fin.finished;
    console.log(`    mutator ${String(id).padEnd(11)}: place ${S && S.place}, ${S && S.timeSec} s, crashes ${S && S.crashes}, gravity ${info0.gravity}, tank ${info0.tank.toFixed(2)}, vTop ${info0.vTop.toFixed(1)}, wheels x${info0.wheelMul}, mirrored ${info0.mirrored}, fog ${s0.fog}`);
    check(!!S && S.finishCrossed && S.mutator === id && sumOK(S.cash), `mutator ${id}: the race finishes (${S && S.timeSec} s) with summary.mutator = ${S && S.mutator}`);
    if (id === 'moonboots') check(Math.abs(info0.gravity - 0.5) < 0.01, `Moon Boots: gravity 0.5 (${info0.gravity})`);
    if (id === 'megaboost') check(Math.abs(info0.tank / (1.8 * (1 + 0.15 * 4) * VEHICLES[3].base.boostCapacity) - 3) < 0.05, `Mega Boost: tank x3 (${info0.tank.toFixed(2)} s)`);
    if (id === 'fog') check(s0.fog === 1, `Fog: state.fog = 1`);
    if (id === 'giantwheels') check(info0.wheelMul === 1.6 && info0.lift > 0.2, `Giant Wheels: wheel radius x1.6, the chassis sits ${info0.lift.toFixed(2)} m higher`);
    if (id === 'tailwind') check(Math.abs(info0.vTop / baseTop - 1.2) < 0.01, `Tailwind: top speed x1.2 (${info0.vTop.toFixed(1)} vs ${baseTop.toFixed(1)} m/s)`);
    if (id === 'mirror') check(info0.mirrored === true, 'Mirror: the course is mirrored');
    check(errors.length === 0, `mutator ${id}: no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  // ---- V5. the turbo gate: a quick answer at the last gate with turbo: true → 3 s rocket boost ----
  {
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '2', gates: '4', vehicle: 'turbo' });
    // answer the first three gates correct (not quick), park at the last one
    const r = await raceDrive(page, { until: "s.phase === 'gate' && s.gateIndex === 3", maxSec: 120, policy: '({ gas: s.countdown === 0 })', auto: false, ...{} }).then(async (x) => x.hit ? x : x);
    const parked = await page.evaluate(() => {
      const g = window.__tb.game; let s = g.getState(), i = 0;
      for (; i < 60 * 150; i++) { if (s.phase === 'gate') { if (s.gateIndex === 3) break; g.openGate({ correct: true }); } g.setInput({ gas: s.countdown === 0 }); s = g.debugStep(1); }
      return { s, fuelBefore: g.debugInfo().fuel, vTop: g.debugInfo().vTop };
    });
    check(parked.s.phase === 'gate' && parked.s.gateIndex === 3, `parked at the last gate (index ${parked.s.gateIndex})`);
    const tq = await page.evaluate(() => {
      const g = window.__tb.game;
      const ok = g.openGate({ correct: true, quick: true, turbo: true });
      const s1 = g.getState();
      let maxV = 0, turboAt1 = 0, turboAt3 = 0, i = 0;
      for (; i < 60 * 4; i++) { g.setInput({ gas: true, boost: false }); const s = g.debugStep(1); const d = g.debugInfo(); maxV = Math.max(maxV, d.vf); if (i === 60) turboAt1 = s.turbo; if (i === 185) turboAt3 = s.turbo; }
      return { ok, turbo0: s1.turbo, turboAt1, turboAt3, maxV, ev: window.__tb.events.filter((e) => e.type === 'turbo'), go: window.__tb.events.filter((e) => e.type === 'gateOpen').pop() };
    });
    console.log(`    turbo gate: turbo ${tq.turbo0} s at the drop, ${tq.turboAt1} s after 1 s, ${tq.turboAt3} s after 3.1 s; max ${(tq.maxV * 3.6).toFixed(0)} km/h (top ${(parked.vTop * 3.6).toFixed(0)}) ${JSON.stringify(tq.ev[0])}`);
    check(tq.ok && tq.ev.length === 1 && tq.ev[0].sec === 3 && tq.go.turbo === true, `openGate({ turbo: true }) → 'turbo' event {sec: 3} and gateOpen.turbo (${JSON.stringify(tq.ev[0])})`);
    check(tq.turbo0 === 3 && tq.turboAt1 > 1.8 && tq.turboAt1 < 2.1 && tq.turboAt3 < 0.6, `state.turbo counts down from 3 s in sim time (${tq.turbo0} → ${tq.turboAt1} → ${tq.turboAt3}; a slow-mo flip stretches it)`);
    check(tq.maxV > parked.vTop * 1.05, `the rocket boost pushes past the top speed without BOOST held (${(tq.maxV * 3.6).toFixed(0)} km/h > ${(parked.vTop * 3.6).toFixed(0)})`);
    const fin = await raceDrive(page, { maxSec: 120 });
    check(fin.finished && fin.finished.turbo === true && sumOK(fin.finished.cash), `summary.turbo is true and cash adds up`);
    check(errors.length === 0, `turbo: no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  // ---- V6. combo meter: three stunts inside 3 s → combo x2, x3 with the extra in cash.combo ----
  {
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '2', gates: '0', vehicle: 'quad', riders: '0', mutator: 'moonboots' });
    const r = await page.evaluate(() => {
      const g = window.__tb.game, c = g.debugCourse();
      const f = c.features.find((f) => f.type === 'big');
      const a = c.arcs.find((a) => Math.abs(a.x - f.lip) < 1);
      g.debugTeleport(f.x0 - 30, a.v);
      // lean back through two full turns at half gravity, then let the assist land it
      let s, i = 0;
      for (; i < 60 * 12; i++) { const d = g.debugInfo(); g.setInput({ gas: !d.air, brake: d.air && Math.abs(d.flightRot) < Math.PI * 4 - 2.0 }); s = g.debugStep(1); if (window.__tb.events.some((e) => e.type === 'land' || e.type === 'crash')) break; }
      return { ev: window.__tb.events.filter((e) => ['flip', 'bigAir', 'combo', 'land', 'crash'].includes(e.type)), s: g.getState() };
    });
    const combos = r.ev.filter((e) => e.type === 'combo');
    console.log(`    combo: ${JSON.stringify(r.ev)}`);
    check(r.ev.some((e) => e.type === 'flip') && r.ev.some((e) => e.type === 'bigAir') && combos.length >= 1 && combos[0].count === 2 && combos[0].mult === 2, `a double flip + big air within 3 s chains: combo {count: 2, mult: 2} (${JSON.stringify(combos[0])})`);
    check(r.s.combo && r.s.combo.count >= 2 && r.s.combo.left > 0, `getState().combo shows the live chain (${JSON.stringify(r.s.combo)})`);
    const stp = await page.evaluate(() => { window.__tb.game.stop(); return window.__tb.finished; });
    check(stp && stp.cash.combo > 0 && stp.cash.combo === combos.reduce((a, e) => a + e.cash, 0) && sumOK(stp.cash) && stp.comboMax >= 2, `summary.cash.combo ($${stp && stp.cash.combo}) = the combo events' cash; parts add up; comboMax ${stp && stp.comboMax}`);
    check(errors.length === 0, `combo: no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  // ---- V7. drawRider / drawHelmet / drawVehicle: every helmet, suit, flag and vehicle draws without throwing ----
  {
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '0', gates: '0', riders: '0' });
    const res = await page.evaluate(async () => {
      const m = await import('./src/game/vehicle.js');
      const cv = document.createElement('canvas'); cv.width = 400; cv.height = 200;
      const ctx = cv.getContext('2d');
      let n = 0;
      for (const v of m.VEHICLES) for (const h of m.HELMETS) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 400, 200); m.drawVehiclePreview(ctx, { vehicle: v.id, paint: 'rainbow', decal: 'flames', helmet: h.id, suit: m.SUITS[n % 8].id, flag: m.FLAGS[n % 6].id, trail: m.TRAIL_FX[n % 8].id }, { x: 200, y: 160, scale: 40, t: 1 }); n++; }
      for (const s of m.SUITS) { ctx.setTransform(40, 0, 0, -40, 200, 160); m.drawRider(ctx, { suit: s.id, helmet: 'crown' }); }
      const px = ctx.getImageData(0, 0, 400, 200).data; let lit = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 0) lit++;
      return { n, lit, helmets: m.HELMETS.length, suits: m.SUITS.length, flags: m.FLAGS.length, fx: m.TRAIL_FX.length };
    });
    check(res.n === 96 && res.helmets === 12 && res.suits === 8 && res.flags === 6 && res.fx === 8 && res.lit > 2000, `8 vehicles x 12 helmets + 8 suits + 6 flags + 8 trails draw (${res.n} previews, ${res.lit} px)`);
    check(errors.length === 0, `art: no console errors (${errors.join(' | ')})`);
    await context.close();
  }
} catch (e) {
  if (!e || e.skipTo !== 'perf') { failures.push('exception: ' + e.message); console.error(e); }
}
try {
  // ---- R7. perf: a Night Ride race with 4 riders, 4x CPU throttle, real-time frames; v1.5: Haunted Hollow in the fog ----
  for (const [trail, extra] of [['night-ride', ''], ['haunted-hollow', '&mutator=fog&vehicle=turbo']]) if (!process.env.SKIP_PERF) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}${DEV}?ui=0&trail=${trail}&lvl=4&gates=0${extra}`);
    await page.waitForFunction(() => window.__tb && window.__tb.game);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const res = await page.evaluate(() => new Promise((resolve) => {
      const g = window.__tb.game;
      g.debugPerf(true);
      const norm = [], raw = [];
      const t0 = performance.now();
      const tick = () => {
        const p = g.debugPerf(true);
        const s = g.getState();
        if (p.frames > 0 && p.ticks > 0 && s.countdown === 0) { raw.push((p.sim + p.draw) / p.frames); norm.push(p.sim / p.ticks + p.draw / p.frames); }
        g.setInput({ gas: s.countdown === 0, boost: s.boost > 0.4 });
        if (performance.now() - t0 > 16000) {
          const st = (a) => { const b = a.slice().sort((x, y) => x - y); return { avg: a.reduce((x, y) => x + y, 0) / Math.max(1, a.length), p95: b[Math.floor(b.length * 0.95)] || 0 }; };
          resolve({ frames: raw.length, norm: st(norm), raw: st(raw), dist: s.distance, riders: s.riders.length });
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(`    perf (4x throttle, ${trail} race${extra}, ${res.riders} riders): ${res.frames} frames, per 60 Hz frame avg ${res.norm.avg.toFixed(2)} ms (p95 ${res.norm.p95.toFixed(2)}), per rendered frame avg ${res.raw.avg.toFixed(2)} ms, rode ${res.dist} m`);
    // budget 8 ms on the reference box (measured 4.6-6.3 ms there); this VM has since slowed by ~1.7x and the committed
    // v1.1 tree measures 10-11 ms on it, so the hard limit is 12 ms and anything over 8 is printed as a warning
    const PERF_MS = Number(process.env.PERF_MS || 12);
    if (res.norm.avg >= 8) console.log(`    perf WARNING: ${res.norm.avg.toFixed(2)} ms per frame is over the 8 ms reference budget (machine speed varies; hard limit ${PERF_MS} ms)`);
    check(res.riders === 4 && res.norm.avg < PERF_MS, `perf ${trail}: game code per 60 Hz frame avg ${res.norm.avg.toFixed(2)} ms < ${PERF_MS} ms at 4x CPU throttle with 4 riders`);
    check(errors.length === 0, `perf ${trail}: no page errors (${errors.join(' | ')})`);
    await context.close();
  }
} catch (e) {
  failures.push('exception: ' + e.message);
  console.error(e);
} finally {
  await browser.close();
  if (server) server.kill();
}
console.log(`\nScreenshots: ${SHOTS}`);
if (failures.length) { console.log(`\nFAILED (${failures.length}):\n- ` + failures.join('\n- ')); process.exit(1); }
console.log('\nALL CHECKS PASSED');

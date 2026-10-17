// Trail Blazer engine smoke test: drives trail-blazer/dev.html in headless Chromium (iPhone-landscape viewport).
// Usage (from anywhere): node trail-blazer/tools/engine-smoke.mjs
// Serves the REPO ROOT on :8080 itself if nothing is listening (so /trail-blazer/ and /spell-jump/ both resolve).
// Env: SHOTS_DIR (screenshot folder), BASE_URL (default http://localhost:8080), SKIP_PERF=1.
// Most checks step the simulation deterministically with game.debugStep (sim seconds, not wall clock).
// Part 1 (?race=0): the v1 trail ride (gates, stuck + winch, gates: 0). Part 2 (default): the v1.1 motocross race
// (countdown, AI riders, positions, checkpoints, flips, crash + respawn, cash, medals, perf with 4 riders).
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
const sumOK = (c) => c.total === c.distance + c.air + c.smash + c.gates + c.quick + c.coins + (c.finish || 0) + (c.flips || 0) + (c.perfect || 0) + (c.place || 0);

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
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '0' });
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
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '0' });
    await raceDrive(page, { until: "ev.some((e) => e.type === 'go')", maxSec: 5, policy: '({ gas: true })' });
    const b = await events(page, 'bogged');
    check(b.length === 1, 'holding GAS before the gate drops bogs the start (bogged event)');
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  // ---- R3. a landed backflip scores; R4. an over-rotated landing crashes and respawns at a checkpoint ----
  {
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '0', riders: '0' });
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
    const { page, context, errors } = await open(browser, { trail: 'night-ride', lvl: '10' });
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
    const { page, context, errors } = await open(browser, { trail, lvl: '4', paint: trail === 'night-ride' ? 'snow' : 'sage', decal: trail === 'desert-wash' ? 'flames' : 'none' });
    await raceDrive(page, { until: "ev.some((e) => e.type === 'countdown' && e.n === 1)", maxSec: 4 });
    await shot(page, `race-${trail}-a-start`);
    const m = await raceDrive(page, { until: `s.distance > ${Math.round(TRAIL_IDS.indexOf(trail) < 1 ? 200 : 380)} && d.air && s.airTime > 0.4`, maxSec: 90 });
    await shot(page, `race-${trail}-b-air`);
    check(m.hit, `${trail}: races to mid-track and jumps (${m.state.distance} m, place ${m.state.place})`);
    check(errors.length === 0, `${trail}: no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  // ---- R7. perf: a Night Ride race with 4 riders, 4x CPU throttle, real-time frames ----
  if (!process.env.SKIP_PERF) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}${DEV}?ui=0&trail=night-ride&lvl=4`);
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
    console.log(`    perf (4x throttle, Night Ride race, ${res.riders} riders): ${res.frames} frames, per 60 Hz frame avg ${res.norm.avg.toFixed(2)} ms (p95 ${res.norm.p95.toFixed(2)}), per rendered frame avg ${res.raw.avg.toFixed(2)} ms, rode ${res.dist} m`);
    check(res.riders === 4 && res.norm.avg < 8, `perf: game code per 60 Hz frame avg ${res.norm.avg.toFixed(2)} ms < 8 ms at 4x CPU throttle with 4 riders`);
    check(errors.length === 0, `perf: no page errors (${errors.join(' | ')})`);
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

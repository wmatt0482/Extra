// Trail Blazer engine smoke test: drives trail-blazer/dev.html in headless Chromium (iPhone-landscape viewport).
// Usage (from anywhere): node trail-blazer/tools/engine-smoke.mjs
// Serves the REPO ROOT on :8080 itself if nothing is listening (so /trail-blazer/ and /spell-jump/ both resolve).
// Env: SHOTS_DIR (screenshot folder), BASE_URL (default http://localhost:8080), SKIP_PERF=1.
// Most checks step the simulation deterministically with game.debugStep (sim seconds, not wall clock).
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
const sumOK = (c) => c.total === c.distance + c.air + c.smash + c.gates + c.quick + c.coins + (c.finish || 0);

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
  // ---- 1. stock hold-GAS on Pine Ridge with gates: reaches the first gate and parks; openGate pays $120 ----
  {
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '0' });
    const s0 = await page.evaluate(() => window.__tb.game.getState());
    check(Object.keys(s0).filter((k) => STATE_KEYS.split(',').includes(k)).sort().join(',') === STATE_KEYS, `getState() has the contract keys (${Object.keys(s0).join(',')})`);
    check(s0.phase === 'parked' && s0.gatesTotal >= 3 && s0.boost === 1, `parked at the trail head, ${s0.gatesTotal} gates, boost tank full (${s0.boost})`);
    await shot(page, 'pine-ridge-1-trailhead');
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
    await shot(page, 'pine-ridge-2-gate');
    const boostBefore = (await page.evaluate(() => window.__tb.game.getState())).boost;
    const opened = await page.evaluate(() => { const g = window.__tb.game; g.setInput({ gas: false, boost: false }); const ok = g.openGate({ correct: true }); return { ok, s: g.getState() }; });
    const go = await events(page, 'gateOpen');
    check(opened.ok && opened.s.phase === 'ride' && opened.s.gateIndex === 1, `openGate({correct:true}) resumes the ride (phase ${opened.s.phase}, gateIndex ${opened.s.gateIndex})`);
    check(go.length === 1 && go[0].cash === 120, `gateOpen pays $120 (${JSON.stringify(go[0])})`);
    check(boostBefore < 0.6 && Math.abs(opened.s.boost - Math.min(1, boostBefore + 0.4)) < 0.02, `correct answer adds 40% boost fuel (${boostBefore.toFixed(2)} -> ${opened.s.boost.toFixed(2)})`);
    await page.evaluate(() => { for (let i = 0; i < 24; i++) window.__tb.game.debugStep(1); });
    await shot(page, 'pine-ridge-3-gate-open');
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
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '0', gates: '0' });
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
    await shot(page, 'pine-ridge-4-stuck');
    const before = await page.evaluate(() => window.__tb.game.debugInfo());
    const w = await page.evaluate(() => {
      const g = window.__tb.game;
      const ok = g.winch(true);
      for (let i = 0; i < 30; i++) g.debugStep(1);
      return { ok, mid: g.getState().phase };
    });
    await shot(page, 'pine-ridge-5-winch');
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
    const { page, context, errors } = await open(browser, { trail: 'pine-ridge', lvl: '0', gates: '0' });
    const r = await page.evaluate(() => {
      const g = window.__tb.game;
      g.setInput({ gas: true }); g.debugStep(1); g.setInput({ gas: false });
      g.debugTeleport(60, 0, Math.PI);
      let s;
      for (let i = 0; i < 60 * 6; i++) { s = g.debugStep(1); if (s.phase === 'stuck') break; }
      return { s, d: g.debugInfo(), ev: window.__tb.events.filter((e) => e.type === 'stuck') };
    });
    check(r.s.phase === 'stuck' && r.s.upsideDown && r.ev.length === 1 && r.ev[0].upsideDown, `upside down -> phase 'stuck' with upsideDown (${JSON.stringify(r.ev[0])})`);
    await shot(page, 'pine-ridge-6-upside-down');
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
    const { page, context, errors } = await open(browser, { trail, lvl: '10', auto: '1' });
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
    const { page, context, errors } = await open(browser, { trail, lvl: '6', paint: trail === 'night-ride' ? 'snow' : 'sage', decal: trail === 'desert-wash' ? 'flames' : 'none' });
    await shot(page, `${trail}-a-head`);
    const mid = await drive(page, { until: `s.distance > ${trail === 'pine-ridge' ? 150 : 300} && s.speedKmh > 20 && s.phase === 'ride'`, maxSec: 200, auto: true, winch: true, policy: 'gasboost' });
    await shot(page, `${trail}-b-mid`);
    const g = await drive(page, { until: "s.phase === 'gate'", maxSec: 200, winch: true });
    await shot(page, `${trail}-c-gate`);
    check(mid.hit && g.hit, `${trail}: rides to mid-trail (${mid.state.distance} m) and parks at a gate (${g.state.distance} m)`);
    if (trail === 'lake-loop') {
      // a water crossing: splash event + spray
      const w = await page.evaluate(() => { const g = window.__tb.game, c = g.debugCourse(); const s = g.getState(); const wt = c.waters.find((q) => q.x0 > s.x + 5) || c.waters[0]; g.openGate({ correct: true }); g.debugTeleport(wt.x0 - 14, 9); return wt; });
      const n0 = (await events(page, 'splash')).length;
      const sp = await drive(page, { until: `ev.filter((e) => e.type === 'splash').length > ${n0}`, maxSec: 10 });
      await page.evaluate(() => { for (let i = 0; i < 14; i++) window.__tb.game.debugStep(1); });
      await shot(page, `${trail}-d-splash`);
      check(sp.hit, `lake-loop: driving into the water crossing at ${w.x0.toFixed(0)} m fires 'splash'`);
    }
    if (trail === 'granite-gap' || trail === 'desert-wash') {
      const b = await page.evaluate(() => { const g = window.__tb.game, c = g.debugCourse(); const b = c.bridges[0]; g.openGate({ correct: true }); g.debugTeleport(b.x0 - 4, 8); for (let i = 0; i < 40; i++) { g.setInput({ gas: true }); g.debugStep(1); } return { b, d: g.debugInfo() }; });
      await shot(page, `${trail}-d-bridge`);
      check(Math.abs(b.d.y - b.d.groundY) < 2.2, `${trail}: the bridge deck carries the vehicle over the gap (${(b.d.y - b.d.groundY).toFixed(2)} m above the deck)`);
    }
    check(errors.length === 0, `${trail}: no console errors (${errors.join(' | ')})`);
    await context.close();
  }

  // ---- 6. perf: Night Ride (the priciest backdrop), 4x CPU throttle, real-time frames ----
  if (!process.env.SKIP_PERF) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}${DEV}?ui=0&trail=night-ride&lvl=6&auto=1&winch=1`);
    await page.waitForFunction(() => window.__tb && window.__tb.game);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const res = await page.evaluate(() => new Promise((resolve) => {
      const g = window.__tb.game;
      g.setInput({ gas: true });
      g.debugPerf(true);
      const norm = [], raw = [];
      const t0 = performance.now();
      const tick = () => {
        const p = g.debugPerf(true);
        if (p.frames > 0 && p.ticks > 0) { raw.push((p.sim + p.draw) / p.frames); norm.push(p.sim / p.ticks + p.draw / p.frames); }
        const s = g.getState();
        g.setInput({ gas: true, boost: s.boost > 0.5 });
        if (performance.now() - t0 > 15000) {
          const st = (a) => { const b = a.slice().sort((x, y) => x - y); return { avg: a.reduce((x, y) => x + y, 0) / Math.max(1, a.length), p95: b[Math.floor(b.length * 0.95)] || 0 }; };
          resolve({ frames: raw.length, norm: st(norm), raw: st(raw), dist: s.distance });
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(`    perf (4x throttle, night-ride): ${res.frames} frames, per 60 Hz frame avg ${res.norm.avg.toFixed(2)} ms (p95 ${res.norm.p95.toFixed(2)}), per rendered frame avg ${res.raw.avg.toFixed(2)} ms, rode ${res.dist} m`);
    check(res.norm.avg < 8, `perf: game code per 60 Hz frame avg ${res.norm.avg.toFixed(2)} ms < 8 ms at 4x CPU throttle`);
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

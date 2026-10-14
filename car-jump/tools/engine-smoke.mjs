// Engine smoke test: drives dev.html in headless Chromium (iPhone-landscape viewport).
// Usage: node tools/engine-smoke.mjs   (serves the repo on :8080 itself if nothing is listening)
// Env: SHOTS_DIR (screenshot folder), BASE_URL (default http://localhost:8080)
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const SHOTS = process.env.SHOTS_DIR || path.join(ROOT, 'tools', 'shots');
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
async function ensureServer() {
  try { const res = await fetch(BASE + '/dev.html'); if (res.ok) return; } catch {}
  server = spawn('python3', ['-m', 'http.server', '8080'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try { const res = await fetch(BASE + '/dev.html'); if (res.ok) return; } catch {}
  }
  throw new Error('could not start http server');
}

const failures = [];
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures.push(msg); };

async function openRun(browser, params) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const q = new URLSearchParams({ ui: '0', panel: '0', ...params }).toString();
  await page.goto(`${BASE}/dev.html?${q}`);
  await page.waitForFunction(() => window.__rr && window.__rr.game && window.__rr.game.getState().phase === 'ramp');
  return { page, context, errors };
}

const rr = (page, fn) => page.evaluate(fn);

// ---- v2 deterministic driver: restart + pause in one task, then fixed steps with a scripted policy ----
// policy: 'release' (GAS on the ground, nothing in the air), 'nitro' (+NITRO always), 'script' (step-indexed)
async function restartPaused(page) {
  await page.evaluate(() => { const r = window.__rr; r.events.length = 0; r.finished = null; r.launch = null; r.restart(); r.game.pause(); });
}
// Steps until `until` (a JS expression over ev = events) is true or the run finishes. Returns progress info.
async function stepUntil(page, policy, until = 'false', after = 0, maxSteps = 60 * 160) {
  return page.evaluate(({ policy, until, after, maxSteps }) => {
    const r = window.__rr, g = r.game;
    const cond = new Function('ev', 'return (' + until + ');');
    const pol = (s, n) => {
      if (policy === 'nitro') return { gas: s.phase !== 'air', brake: false, nitro: true };
      if (policy === 'script') {
        // fixed timeline: GAS down the ramp and on the ground, a BRAKE back flip window, a NITRO burst
        const t = r.steps;
        return { gas: s.phase !== 'air' || t > 1400, brake: s.phase === 'air' && t % 300 < 70, nitro: t > 900 && t < 990 };
      }
      return { gas: s.phase !== 'air', brake: false, nitro: false };
    };
    r.steps = r.steps || 0;
    const badKey = (o, p) => {
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'number' && !Number.isFinite(v)) return p + k + '=' + v;
        if (v && typeof v === 'object') { const b = badKey(v, p + k + '.'); if (b) return b; }
      }
      return null;
    };
    let bad = r.bad || null, n = 0, hit = false, extra = -1;
    for (; n < maxSteps && !r.finished; n++) {
      const s = g.getState();
      g.setInput(pol(s, n));
      g.debugStep(1);
      r.steps++;
      if (!bad && n % 15 === 0) bad = badKey(g.getState(), '');
      if (!hit && cond(r.events)) { hit = true; extra = after; }
      if (hit && extra-- <= 0) break;
    }
    r.bad = bad;
    return { hit, steps: r.steps, bad, state: g.getState(), finished: r.finished };
  }, { policy, until, after, maxSteps });
}
async function frame(page) { await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)))); }
const evs = (page, type) => page.evaluate((t) => window.__rr.events.filter((e) => e.type === t), type);
const sumOK = (s) => {
  const c = s.cash;
  return c.total === c.distance + c.stunts + c.smash + c.landing + c.combo + c.air;
};
const RATINGS = ['S', 'A', 'B', 'C', 'D'];

await ensureServer();
const browser = await chromium.launch();
try {
  // ---- 1. starter car, canyon, level 0, hold GAS for the whole run ----
  {
    const { page, context, errors } = await openRun(browser, { car: 'beater', track: 'canyon', lvl: '0', seed: '42' });
    await page.waitForTimeout(300);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(SHOTS, '1-ramp-top.png') });
    await page.waitForFunction(() => window.__rr.launch, null, { timeout: 30000 });
    await page.waitForTimeout(1100);
    await page.screenshot({ path: path.join(SHOTS, '2-mid-air.png') });
    await page.waitForFunction(() => window.__rr.finished, null, { timeout: 150000, polling: 200 });
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, '3-results.png') });
    const res = await rr(page, () => ({ s: window.__rr.finished, launch: window.__rr.launch, types: [...new Set(window.__rr.events.map((e) => e.type))] }));
    console.log('starter/canyon/L0:', JSON.stringify({ launchKmh: res.launch.speedKmh, ...res.s }));
    // first-run feel: a new player holds GAS the whole time; GAS in the air is a milder front flip with a
    // landing-timing assist, so this should come down wheels-first and roll on (target 150-220 m)
    check(res.s.distance >= 150 && res.s.distance <= 270, `starter canyon hold-GAS distance ${res.s.distance} m in 150..270`);
    check(['perfect', 'good'].includes(res.s.landing), `starter canyon hold-GAS landing is good/perfect (${res.s.landing})`);
    check(res.launch.speedKmh >= 80 && res.launch.speedKmh <= 120, `starter launch speed ${res.launch.speedKmh} km/h in 80..120`);
    check(['launch', 'land', 'finish', 'speed'].every((t) => res.types.includes(t)), `events seen: ${res.types.join(',')}`);
    const c = res.s.cash;
    check(sumOK(res.s), 'cash breakdown sums to total');
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }

  // ---- 2. brake in the air -> backflip ----
  {
    const { page, context, errors } = await openRun(browser, { car: 'beater', track: 'canyon', lvl: '0', seed: '42' });
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => window.__rr.launch, null, { timeout: 30000 });
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(() => window.__rr.events.some((e) => e.type === 'flip') || window.__rr.events.some((e) => e.type === 'land'), null, { timeout: 15000 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(SHOTS, '4-backflip.png') });
    await page.keyboard.up('ArrowLeft');
    const flips = await rr(page, () => window.__rr.events.filter((e) => e.type === 'flip'));
    console.log('brake-in-air flips:', JSON.stringify(flips));
    check(flips.length > 0 && flips[0].dir === 'back', 'holding BRAKE in the air fires a back flip');
    // released right after the flip: auto-level should bring it down on its wheels
    await page.waitForFunction(() => window.__rr.events.some((e) => e.type === 'land'), null, { timeout: 15000 });
    const land = await rr(page, () => window.__rr.events.find((e) => e.type === 'land'));
    check(land.quality !== 'crash', `released back flip lands wheels-down (${land.quality})`);
    // pause / resume / stop contract
    const api = await page.evaluate(async () => {
      const g = window.__rr.game;
      g.pause();
      const a = g.getState();
      await new Promise((r) => setTimeout(r, 400));
      const b = g.getState();
      g.resume();
      await new Promise((r) => setTimeout(r, 300));
      const before = window.__rr.events.filter((e) => e.type === 'finish').length;
      g.stop();
      const fin = window.__rr.events.filter((e) => e.type === 'finish');
      return { frozen: a.distance === b.distance && a.speedKmh === b.speedKmh, finishEmitted: fin.length === before + 1 || before === 1,
        summaryKeys: Object.keys(fin[fin.length - 1].summary).sort().join(','), after: g.getState().phase };
    });
    console.log('api:', JSON.stringify(api));
    check(api.frozen, 'pause() freezes the simulation');
    check(api.finishEmitted && api.after === 'done', 'stop() emits finish and ends the run');
    check(api.summaryKeys === 'airTargets,airTime,backFlips,bestCombo,cash,coins,distance,durationSec,explosions,finishCrossed,flips,frontFlips,landing,maxAltitude,maxSpeedKmh,rating,rejumps,rings,smashed', `summary keys: ${api.summaryKeys}`);
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }

  // ---- 3. super car, all upgrades 10, moon: must terminate, no NaN ----
  {
    const { page, context, errors } = await openRun(browser, { car: 'super', track: 'moon', lvl: '10', seed: '7', sim: '4' });
    await page.keyboard.down('ArrowRight');
    let bad = null, shot = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      const st = await rr(page, () => ({ s: window.__rr.game.getState(), done: !!window.__rr.finished, launched: !!window.__rr.launch }));
      for (const [k, v] of Object.entries(st.s)) if (typeof v === 'number' && !Number.isFinite(v)) bad = `${k}=${v}`;
      if (st.launched && !shot) { await page.waitForTimeout(1500); await page.screenshot({ path: path.join(SHOTS, '5-moon-air.png') }); shot = true; }
      if (st.done || bad) break;
      await page.waitForTimeout(250);
    }
    await page.keyboard.up('ArrowRight');
    const res = await rr(page, () => ({ s: window.__rr.finished, launch: window.__rr.launch }));
    console.log('super/moon/L10:', JSON.stringify({ launchKmh: res.launch && res.launch.speedKmh, ...res.s }));
    check(!bad, `no NaN/Infinity in getState (${bad || 'ok'})`);
    check(!!res.s, 'super/moon run terminates with a finish event');
    check(res.s && Number.isFinite(res.s.distance) && res.s.distance > 300, `super/moon distance ${res.s && res.s.distance} m is long and finite`);
    check(res.s && Number.isFinite(res.s.cash.total), 'super/moon cash is finite');
    await page.screenshot({ path: path.join(SHOTS, '6-moon-results.png') });
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }

  // ================= v2 (epic update) scenarios: deterministic fixed-step runs =================
  const v2 = {};
  // ---- v2.1 + v2.2: city, mid-tier car: combo >= 3 and a fuel-depot chain reaction ----
  {
    const { page, context, errors } = await openRun(browser, { car: 'rally', track: 'city', lvl: '5', seed: '7' });
    await restartPaused(page);
    let p = await stepUntil(page, 'release', "ev.some((e) => e.type === 'launch')", 8);
    await frame(page);
    await page.screenshot({ path: path.join(SHOTS, 'v2-launch-letterbox.png') });
    p = await stepUntil(page, 'release', "ev.some((e) => e.type === 'explosion' && e.chain >= 1)", 14);
    await frame(page);
    await page.screenshot({ path: path.join(SHOTS, 'v2-explosion-chain.png') });
    p = await stepUntil(page, 'release');
    const combos = await evs(page, 'combo'), booms = await evs(page, 'explosion'), ends = await evs(page, 'comboEnd');
    const s = p.finished;
    v2.city = { maxCombo: Math.max(0, ...combos.map((e) => e.count)), maxChain: Math.max(-1, ...booms.map((e) => e.chain)), explosions: booms.length, comboEnds: ends.length, summary: s };
    console.log('v2 rally/city/L5 seed 7:', JSON.stringify({ maxCombo: v2.city.maxCombo, maxChain: v2.city.maxChain, explosions: booms.length, comboEnd: ends.map((e) => e.count + 'x' + e.mult + '=$' + e.cash).join(' '), rating: s.rating, cash: s.cash }));
    check(v2.city.maxCombo >= 3, `(1) city mid-tier run fires a combo with count >= 3 (max ${v2.city.maxCombo})`);
    check(combos.every((e) => e.mult === Math.min(4, 1 + 0.25 * (e.count - 1))), '(1) combo mult = min(4, 1 + 0.25(count-1))');
    check(ends.length > 0 && ends.every((e) => e.count >= 3), `(1) comboEnd fired for chains of >= 3 (${ends.length})`);
    check(v2.city.maxChain >= 1, `(2) fuel depot chain reaction: explosion with chain >= 1 (max chain ${v2.city.maxChain}, ${booms.length} explosions)`);
    check(s.explosions === booms.length && s.bestCombo === v2.city.maxCombo, '(2) summary.explosions / bestCombo match the events');
    check(sumOK(s) && s.cash.combo > 0, `(6) city cash adds up with combo $${s.cash.combo}, air $${s.cash.air}`);
    check(!p.bad, `(7) no NaN/Infinity in getState (${p.bad || 'ok'})`);
    check(errors.length === 0, `(7) no console errors (${errors.join(' | ')})`);
    // ---- v2.8 determinism: same seed + same scripted inputs => identical summary (and event stream) ----
    const runOnce = async () => {
      await restartPaused(page);
      await page.evaluate(() => { window.__rr.steps = 0; });
      const q = await stepUntil(page, 'script');
      return { s: JSON.stringify(q.finished), e: JSON.stringify(await page.evaluate(() => window.__rr.events.filter((x) => x.type !== 'finish'))) };
    };
    const a = await runOnce(), b = await runOnce();
    console.log('v2 determinism summary:', a.s);
    check(a.s === b.s, '(8) two runs with the same seed and scripted inputs give identical summaries');
    check(a.e === b.e, '(8) ... and identical event streams');
    await context.close();
  }

  // ---- v2.3: canyon, level-5 starter: at least one air target ----
  {
    const { page, context, errors } = await openRun(browser, { car: 'beater', track: 'canyon', lvl: '5', seed: '1' });
    await restartPaused(page);
    let p = await stepUntil(page, 'release', "ev.some((e) => e.type === 'airTarget' && e.kind === 'ring')", 3);
    await frame(page);
    await page.screenshot({ path: path.join(SHOTS, 'v2-ring-pass.png') });
    p = await stepUntil(page, 'release');
    const air = await evs(page, 'airTarget');
    const s = p.finished;
    console.log('v2 beater/canyon/L5 seed 1:', JSON.stringify({ airTargets: air.map((e) => e.kind[0]).join(''), rings: s.rings, coins: s.coins, cashAir: s.cash.air, rejumps: s.rejumps, rating: s.rating }));
    check(air.length >= 1, `(3) canyon L5 starter hits air targets (${air.length})`);
    check(air.filter((e) => e.kind === 'ring').every((e) => e.nitroRefill === 0.25 && e.cash > 0), '(3) rings pay and refill 25% nitro');
    check(s.airTargets === air.length && s.rings === air.filter((e) => e.kind === 'ring').length && s.coins === air.filter((e) => e.kind === 'coin').length, '(3) summary rings/coins/airTargets match the events');
    check(sumOK(s) && s.cash.air > 0, `(6) canyon cash adds up, air $${s.cash.air}`);
    check(!p.bad && errors.length === 0, `(7) no NaN / console errors (${p.bad || ''} ${errors.join(' | ')})`);
    await context.close();
  }

  // ---- v2.4: kicker ramps relaunch the car ----
  {
    const { page, context, errors } = await openRun(browser, { car: 'rally', track: 'city', lvl: '5', seed: '3' });
    await restartPaused(page);
    const p = await stepUntil(page, 'release');
    const rj = await evs(page, 'rejump'), lands = await evs(page, 'land');
    const s = p.finished;
    console.log('v2 rally/city/L5 seed 3:', JSON.stringify({ rejumps: rj, lands: lands.map((e) => e.quality), rating: s.rating, cash: s.cash }));
    check(rj.length >= 1 && rj[0].count === 1 && rj[0].speedKmh > 0, `(4) a kicker relaunch fires rejump (${rj.length})`);
    check(lands.length >= 1 + rj.length, '(4) every kicker flight is landed and scored again');
    check(s.rejumps === rj.length && sumOK(s), '(6) summary.rejumps matches, cash adds up');
    check(!p.bad && errors.length === 0, `(7) no NaN / console errors (${p.bad || ''} ${errors.join(' | ')})`);
    await context.close();
  }

  // ---- v2.5: orbit on the moon with a maxed super car ----
  {
    const { page, context, errors } = await openRun(browser, { car: 'super', track: 'moon', lvl: '10', seed: '7' });
    await restartPaused(page);
    let p = await stepUntil(page, 'release', "ev.some((e) => e.type === 'orbit')", 45);
    await frame(page);
    await page.screenshot({ path: path.join(SHOTS, 'v2-orbit.png') });
    const alt = p.state.altitude;
    p = await stepUntil(page, 'release');
    const orb = await evs(page, 'orbit');
    const s = p.finished;
    console.log('v2 super/moon/L10 seed 7:', JSON.stringify({ orbit: orb, altitudeAfter: alt, maxAltitude: s.maxAltitude, rating: s.rating, cash: s.cash }));
    check(orb.length >= 1 && orb[0].altitude >= 45, `(5) orbit fires above 45 m (${JSON.stringify(orb[0] || null)})`);
    check(s.maxAltitude >= 45 && s.cash.air >= 5 * 45, `(5) summary.maxAltitude ${s.maxAltitude} m, orbit pays into cash.air ($${s.cash.air})`);
    check(sumOK(s) && RATINGS.includes(s.rating), `(6) moon cash adds up, rating ${s.rating}`);
    check(!p.bad && errors.length === 0, `(7) no NaN / console errors (${p.bad || ''} ${errors.join(' | ')})`);
    await context.close();
  }

  // ---- v2.6: rating formula, finish celebration + BEST flag / record ----
  {
    const best = 300;
    const { page, context, errors } = await openRun(browser, { car: 'muscle', track: 'canyon', lvl: '8', seed: '5', best: String(best), shake: '0.5' });
    await restartPaused(page);
    let p = await stepUntil(page, 'nitro', "ev.some((e) => e.type === 'finishLine')", 115);
    await frame(page);
    await page.screenshot({ path: path.join(SHOTS, 'v2-finish-fireworks.png') });
    p = await stepUntil(page, 'nitro');
    const rec = await evs(page, 'record');
    const s = p.finished;
    const k = s.cash.total / (400 * 4);
    const want = k >= 1.5 ? 'S' : k >= 1.0 ? 'A' : k >= 0.6 ? 'B' : k >= 0.3 ? 'C' : 'D';
    console.log('v2 muscle/canyon/L8 seed 5:', JSON.stringify({ record: rec.length, finish: s.finishCrossed, rating: s.rating, cash: s.cash }));
    check(rec.length === 1 && s.distance >= best, `(6) record fires once when passing bestDistance ${best} (${rec.length})`);
    check(s.rating === want, `(6) rating ${s.rating} matches cash.total / (finish x 4) = ${k.toFixed(2)}`);
    check(['rating', 'maxAltitude', 'bestCombo', 'explosions', 'rings', 'coins', 'airTargets', 'rejumps'].every((x) => x in s) && 'combo' in s.cash && 'air' in s.cash, '(6) summary has all v2 fields');
    check(sumOK(s), '(6) cash adds up');
    check(!p.bad && errors.length === 0, `(7) no NaN / console errors (${p.bad || ''} ${errors.join(' | ')})`);
    await context.close();
  }
} finally {
  await browser.close();
  if (server) server.kill();
}
console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL PASSED');
console.log('screenshots in', SHOTS);
process.exit(failures.length ? 1 : 0);

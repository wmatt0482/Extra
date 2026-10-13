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
    check(c.total === c.distance + c.stunts + c.smash + c.landing, 'cash breakdown sums to total');
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
    check(api.summaryKeys === 'airTime,backFlips,cash,distance,durationSec,finishCrossed,flips,frontFlips,landing,maxSpeedKmh,smashed', `summary keys: ${api.summaryKeys}`);
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
} finally {
  await browser.close();
  if (server) server.kill();
}
console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL PASSED');
console.log('screenshots in', SHOTS);
process.exit(failures.length ? 1 : 0);

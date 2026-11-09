// Sky Era screenshots from dev.html (engine only), deviceScaleFactor 2, phone landscape 844x390 and desktop 1280x720.
//   SHOTS_DIR=/some/dir node tools/sky-shots.mjs [only-substring]
// A scripted player (GAS on the ramp and the ground, NITRO for the ground and glide cars) flies each moment, the game is
// paused at the moment (or left running for the freeze idle) and the canvas is captured.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { startStaticServer, watchdog } from './serve.mjs';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const SHOTS = process.env.SHOTS_DIR || path.join(ROOT, 'tools', 'shots', 'sky');
const ONLY = process.argv[2] || '';
mkdirSync(SHOTS, { recursive: true });
async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch {}
  const roots = ['/home/node-tools/node_modules/'];
  try { roots.push(execSync('npm root -g').toString().trim() + '/'); } catch {}
  for (const r of roots) { try { return createRequire(r)('playwright'); } catch {} }
  throw new Error('playwright not found');
}
const { chromium } = await loadPlaywright();
watchdog('sky-shots');
let server = null;
if (!process.env.BASE_URL) server = await startStaticServer({ cwd: ROOT, port: 8080 });
const browser = await chromium.launch();
const VIEWS = [{ name: 'phone', width: 844, height: 390 }, { name: 'desktop', width: 1280, height: 720 }];

// in-page driver: step the scripted player until `until(ev, s, info)` (a JS expression) holds; `after` more steps; returns state
const DRIVER = `
window.__drive = ({ until, after = 0, maxSteps = 60 * 160, boost = null, glide = false, nitroAir = false }) => {
  const r = window.__rr, g = r.game;
  const cond = new Function('ev', 's', 'info', 'return (' + until + ');');
  let hit = false, extra = after, n = 0;
  for (; n < maxSteps && !r.finished; n++) {
    const s = g.getState(), info = g.debugInfo();
    if (s.frozen) {
      if (boost == null) break;                                 // park at the gate
      g.boost({ power: boost, word: 'friend' }); g.freeze(false);
    }
    g.setInput({ gas: s.phase !== 'air', brake: false, nitro: s.phase === 'ground' || (glide && s.phase === 'air' && info.vy < 0 && s.altitude < 60) || (nitroAir && s.phase === 'air') });
    g.debugStep(1);
    if (!hit && cond(r.events, g.getState(), g.debugInfo())) { hit = true; extra = after; }
    if (hit && extra-- <= 0) break;
  }
  return { hit, n, state: g.getState(), info: g.debugInfo() };
};`;

async function open(view, params) {
  const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const q = new URLSearchParams({ ui: '0', panel: '0', autostart: '0', ...params }).toString();
  await page.goto(`${BASE}/dev.html?${q}`);
  await page.waitForFunction(() => window.__rr && window.__rr.game);
  await page.evaluate(DRIVER);
  await page.evaluate(() => { window.__rr.restart(); window.__rr.game.pause(); });
  await page.waitForTimeout(150);
  return { page, context, errors };
}
const drive = (page, o) => page.evaluate((o) => window.__drive(o), o);
const frames = (page, n = 3) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
async function shot(page, name, view) {
  await frames(page, 4);
  const file = path.join(SHOTS, `${name}-${view.name}.png`);
  await page.screenshot({ path: file });
  console.log('  shot', path.relative(ROOT, file));
}
const want = (name) => !ONLY || name.includes(ONLY);

const results = [];
try {
  for (const view of VIEWS) {
    // 1. each sky track mid-flight (a maxed Rhino, after the first island landing)
    for (const id of ['sky-1', 'sky-2', 'sky-3', 'sky-4', 'sky-5']) {
      const name = `track-${id}`;
      if (!want(name)) continue;
      const { page, context, errors } = await open(view, { car: 'tank', track: id, lvl: '8', seed: '42', spellboost: '0' });
      const r = await drive(page, { until: 's.distance > 230 && s.phase === "air"', after: 0 });
      await shot(page, name, view);
      results.push([name + view.name, errors.length]);
      if (errors.length) console.log('  errors', errors.slice(0, 3));
      await context.close();
    }
    // 2. a boost ring, a gravity well (enter and the slingshot out), a cloud splash
    const evShots = [
      ['boost-ring', 'sky-1', 'ev.some(e => e.type === "boostRing")', 6],
      ['well-enter', 'sky-1', 'ev.some(e => e.type === "gravityWell" && e.state === "enter")', 4],
      ['well-slingshot', 'sky-1', 'ev.some(e => e.type === "gravityWell" && e.state === "exit" && e.slingshot)', 5],
      ['cloud-splash', 'sky-3', 'ev.some(e => e.type === "cloudSplash")', 14],
      ['island-land', 'sky-1', 'ev.some(e => e.type === "islandLand" && e.gap > 0)', 3],
    ];
    for (const [name, track, until, after] of evShots) {
      if (!want(name)) continue;
      const car = name === 'cloud-splash' ? 'beater' : 'tank';
      const { page, context, errors } = await open(view, { car, track, lvl: name === 'cloud-splash' ? '0' : '6', seed: '42', spellboost: '0' });
      const r = await drive(page, { until, after });
      console.log(' ', name, view.name, r.hit ? 'hit' : 'NOT HIT', 'x', Math.round(r.info.x));
      await shot(page, name, view);
      if (errors.length) console.log('  errors', errors.slice(0, 3));
      await context.close();
    }
    // 3. the Spell Boost: the gate ahead, the freeze idle (the game keeps rendering while frozen), the boost, the letter rings
    if (want('spellboost')) {
      const { page, context, errors } = await open(view, { car: 'tank', track: 'sky-2', lvl: '6', seed: '42', bword: 'friend' });
      await page.evaluate(() => window.__rr.game.pause());
      let r = await drive(page, { until: 's.boostReady', after: 0 });
      console.log('  gate appears', r.hit, 'x', Math.round(r.info.x));
      await shot(page, 'spellboost-1-gate-ahead', view);
      r = await drive(page, { until: 's.frozen', after: 0 });
      console.log('  frozen', r.state.frozen);
      await page.evaluate(() => window.__rr.game.resume());
      await page.waitForTimeout(700);
      await shot(page, 'spellboost-2-freeze-idle', view);
      await page.waitForTimeout(500);
      await shot(page, 'spellboost-2b-freeze-idle', view);
      await page.evaluate(() => { window.__rr.game.pause(); window.__rr.boost(1); });
      r = await drive(page, { until: 'false', after: 50, maxSteps: 50 });
      await shot(page, 'spellboost-3-boost', view);
      r = await drive(page, { until: 'false', after: 120, maxSteps: 120 });
      await shot(page, 'spellboost-4-letters', view);
      r = await drive(page, { until: 'ev.some(e => e.type === "wordComplete")', after: 20 });
      console.log('  word complete', r.hit);
      await shot(page, 'spellboost-5-word-complete', view);
      if (errors.length) console.log('  errors', errors.slice(0, 3));
      await context.close();
    }
    // 4. the rides, in the air and on the ground (sky-1)
    for (const car of ['hoverbike', 'rocketcar', 'mechwalker']) {
      const name = `ride-${car}`;
      if (!want(name)) continue;
      const { page, context, errors } = await open(view, { car, track: 'sky-1', lvl: '4', seed: '42', spellboost: '0' });
      const gl = car === 'hoverbike' || car === 'rocketcar';
      let r = await drive(page, { until: 's.phase === "air" && s.airTime > 1.6', after: 0, glide: gl, nitroAir: false });
      await shot(page, name + '-air', view);
      if (gl) {
        r = await drive(page, { until: 's.gliding', after: 25, glide: true });
        await shot(page, name + '-glide', view);
      }
      r = await drive(page, { until: 's.phase === "ground" && s.speedKmh > 40 && ev.some(e => e.type === "land")', after: 40, glide: gl });
      await shot(page, name + '-ground', view);
      if (errors.length) console.log('  errors', errors.slice(0, 3));
      await context.close();
    }
    // 5. the car on the ramp top (parked) on a sky track, for the start view
    if (want('start')) {
      const { page, context } = await open(view, { car: 'tank', track: 'sky-1', lvl: '4' });
      await shot(page, 'start-sky-1', view);
      await context.close();
    }
  }
} finally {
  await browser.close();
  if (server) await server.stop();
}

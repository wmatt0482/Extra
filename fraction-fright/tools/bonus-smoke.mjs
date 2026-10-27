// Critter Stampede smoke test (SPEC §14): drives fraction-fright/bonus-dev.html in headless Chromium (iPhone-landscape
// viewport, plus one portrait pass). Usage (from anywhere): node fraction-fright/tools/bonus-smoke.mjs
// Serves the REPO ROOT on :8080 itself if nothing is listening. Env: SHOTS_DIR, BASE_URL, SKIP_PERF=1, PERF_MS (8).
// Checks step the simulation deterministically with game.debugStep (sim seconds, not wall clock):
//   1. the contract shape and getState's keys; phases intro → run → outro → done; critters on screen (2–5), both lanes
//      and the air; bonusEnd's tally and cash add up (15 × cures + 150 × the golden one), stopped false;
//   2. a scripted spray at a critter cures it (cure event, +$15, cured look); the golden critter pays $150 and sets gold;
//   3. the combo counts cures in a row and resets after a stray burst; stop() → bonusEnd { stopped: true };
//   4. reduced motion, a portrait pass, perf at 4× CPU throttle, no console errors, the kid-rule word audit over the
//      module sources (no kill / die / dead / lives / wrong / timer / countdown / hurry / lose / fail).
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const SHOTS = process.env.SHOTS_DIR || '/tmp/claude-0/-home-user-Extra/0887b907-788e-5c4e-a0e5-9e998f29e90b/scratchpad/ff-bonus-shots';
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

let server = null;
const DEV = '/fraction-fright/bonus-dev.html';
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
let passes = 0;
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (cond) passes++; else failures.push(msg); };
const STATE_KEYS = 'aim,bestCombo,cash,combo,critters,cured,firing,gold,passed,phase,timeSec,total';
const BANNED = /\b(kill(s|ed|ing)?|die[sd]?|dying|dead|death|lives|life left|wrong|timer|countdown|hurry|time'?s up|seconds? left|game over|lose|lost|fail(ed)?)\b/i;

async function open(browser, params, viewport = { width: 844, height: 390 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const q = new URLSearchParams({ ui: '0', ...params }).toString();
  await page.goto(`${BASE}${DEV}?${q}`);
  await page.waitForFunction(() => window.__bonus && window.__bonus.game && window.__bonus.game.getState().phase !== 'idle');
  // helpers in the page: step n ticks; auto-play n ticks (aim + fire at the first zombie critter, lead included)
  await page.evaluate(() => {
    const g = window.__bonus.game;
    window.__step = (n) => g.debugStep(n);
    window.__auto = (n, opts = {}) => {
      for (let i = 0; i < n; i++) {
        const s = g.getState();
        if (s.phase !== 'run') { g.debugStep(1); continue; }
        const z = s.critters.filter((c) => c.zombie && (!opts.skipGold || !c.gold));
        if (z.length) { const c = z[0]; g.aim(c.x, c.y); g.fire(true); } else g.fire(false);
        g.debugStep(1);
      }
      return g.getState();
    };
    window.__ev = (type) => window.__bonus.events.filter((e) => e.type === type);
    window.__sounds = () => window.__bonus.events.filter((e) => e.type === 'sound').map((e) => e.name);
  });
  return { context, page, errors };
}
const S = (page) => page.evaluate(() => window.__bonus.game.getState());
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });

await ensureServer();
const browser = await chromium.launch();
try {
  // ---------- 1. contract, phases, the herd, the tally ----------
  {
    const { context, page, errors } = await open(browser, { seed: '7', count: '30' });
    const shape = await page.evaluate(() => { const g = window.__bonus.game; return ['start', 'aim', 'fire', 'stop', 'destroy', 'getState', 'debugStep'].map((k) => typeof g[k]).join(','); });
    check(shape === 'function,function,function,function,function,function,function', 'contract: start, aim, fire, stop, destroy, getState, debugStep');
    let s = await S(page);
    check(Object.keys(s).sort().join(',') === STATE_KEYS, `getState keys: ${Object.keys(s).sort().join(',')}`);
    check(s.phase === 'intro' && s.total === 30 && s.cured === 0 && s.cash === 0, `start: phase ${s.phase}, total ${s.total}`);
    check((await page.evaluate(() => window.__ev('bonusStart').length)) === 1 && (await page.evaluate(() => window.__sounds())).includes('bonusStart'), 'bonusStart event + sound at start');
    await shot(page, '1-intro');
    s = await page.evaluate(() => window.__step(73));
    check(s.phase === 'run', `after 1.2 s: phase ${s.phase}`);
    check((await page.evaluate(() => window.__sounds())).includes('stampede'), 'the stampede sound at the run start');
    // the herd: between 2 and 5 on screen through the run; both ground lanes and the air used; nobody cured without a spray
    let maxLive = 0, minLiveMid = 99, lanes = new Set(), kinds = new Set();
    for (let i = 0; i < 40; i++) {
      s = await page.evaluate(() => window.__step(20));
      if (s.phase !== 'run') break;
      maxLive = Math.max(maxLive, s.critters.length);
      if (i > 3 && i < 30) minLiveMid = Math.min(minLiveMid, s.critters.length);
      for (const c of s.critters) kinds.add(c.kind);
      const info = await page.evaluate(() => window.__bonus.game.debugInfo());
      for (const c of info.critters) lanes.add(c.air ? 'air' : c.lane);
      if (i === 6) await shot(page, '2-stampede');
    }
    check(maxLive <= 5 && minLiveMid >= 1, `2–5 critters on screen (max ${maxLive}, min mid-run ${minLiveMid})`);
    check(lanes.has('air') && lanes.has('back') && lanes.has('front'), `lanes used: ${[...lanes].join(', ')}`);
    check(kinds.size >= 4, `critter kinds seen: ${[...kinds].join(', ')}`);
    // no spray: everyone passes; the round ends by itself
    for (let i = 0; i < 40 && s.phase !== 'done'; i++) s = await page.evaluate(() => window.__step(60));
    const end = await page.evaluate(() => window.__ev('bonusEnd')[0]);
    check(s.phase === 'done' && end && end.stopped === false && end.cured === 0 && end.total === 30 && end.cash === 0 && end.gold === false && s.passed === 30, `no spray: the stampede passes (${s.passed} passed), bonusEnd cured 0, $0, not stopped`);
    check(end && typeof end.durationSec === 'number' && end.durationSec > 15 && end.durationSec < 40, `the round took ${end && end.durationSec} s`);
    check((await page.evaluate(() => window.__sounds())).includes('bonusEnd'), 'the bonusEnd sound');
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }

  // ---------- 2. a spray cures a critter; the golden one pays $150 ----------
  {
    const { context, page, errors } = await open(browser, { seed: '11', count: '24', goldAt: '0.5' });
    await page.evaluate(() => window.__step(80));
    // wait for a zombie critter well inside the screen, then spray at it with lead
    let cured = null;
    for (let i = 0; i < 400 && !cured; i++) {
      const s = await page.evaluate(() => window.__bonus.game.getState());
      const z = s.critters.find((c) => c.zombie && c.x > 60 && c.x < 780 && !c.gold);
      if (z) { await page.evaluate(() => window.__auto(3, { skipGold: true })); } else await page.evaluate(() => window.__step(3));
      cured = await page.evaluate(() => window.__ev('cure')[0] || null);
    }
    check(!!cured && cured.cash === 15 && cured.cured === 1 && cured.total === 24 && typeof cured.kind === 'string' && cured.gold === false, `a sprayed critter is cured: ${cured && cured.kind} +$${cured && cured.cash}`);
    const snd = await page.evaluate(() => window.__sounds());
    check(snd.includes('sprayOn') && snd.includes('pop'), 'sounds: sprayOn then pop');
    let s = await S(page);
    check(s.firing === true && s.aim && s.cash === 15 && s.cured === 1, `state after the cure: firing, cash $${s.cash}, cured ${s.cured}`);
    await page.evaluate(() => window.__bonus.game.fire(false));
    check((await page.evaluate(() => window.__sounds())).includes('sprayOff'), 'fire(false) → sprayOff');
    await shot(page, '3-cured');
    // now auto-play the rest: the golden one shows up and pays $150
    for (let i = 0; i < 120; i++) { s = await page.evaluate(() => window.__auto(30)); if (s.phase === 'done') break; if (s.gold && i % 2 === 0 && !(await page.evaluate(() => window.__shotGold))) { await page.evaluate(() => { window.__shotGold = true; }); await shot(page, '4-golden'); } }
    const end = await page.evaluate(() => window.__ev('bonusEnd')[0]);
    const goldCure = await page.evaluate(() => window.__ev('cure').find((e) => e.gold) || null);
    check(!!goldCure && goldCure.cash === 150, `the golden critter cured: +$${goldCure && goldCure.cash}`);
    check(end && end.gold === true && end.cured >= 10 && end.cash === 15 * (end.cured - 1) + 150, `bonusEnd: ${end && end.cured}/${end && end.total} cured, $${end && end.cash} = 15 × ${end && end.cured - 1} + 150, gold`);
    check(end && end.bestCombo >= 2 && end.stopped === false, `best combo ×${end && end.bestCombo}, not stopped`);
    check((await page.evaluate(() => window.__sounds())).includes('gold'), 'the gold sound');
    await shot(page, '5-outro-done');
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }

  // ---------- 3. combo + reset on a stray burst; stop() ----------
  {
    const { context, page, errors } = await open(browser, { seed: '21', count: '30' });
    await page.evaluate(() => window.__step(80));
    let s = null;
    for (let i = 0; i < 200; i++) { s = await page.evaluate(() => window.__auto(10)); if (s.combo >= 2) break; }
    check(s.combo >= 2 && s.bestCombo >= 2, `combo ×${s.combo} after cures in a row`);
    // a stray burst at the empty sky corner, long after the last cure: the combo resets
    s = await page.evaluate(() => { const g = window.__bonus.game; g.aim(12, 12); g.fire(true); const out = g.debugStep(60); g.fire(false); return out; });
    check(s.combo === 0 && s.bestCombo >= 2, `a stray burst resets the combo (×${s.combo}; best stays ×${s.bestCombo})`);
    const info = await page.evaluate(() => window.__bonus.game.debugInfo());
    check(info.splats > 0, `stray pellets leave splats (${info.splats})`);
    // stop(): bonusEnd stopped with what was cured
    const before = await S(page);
    await page.evaluate(() => window.__bonus.game.stop());
    s = await S(page);
    const end = await page.evaluate(() => window.__ev('bonusEnd')[0]);
    check(s.phase === 'done' && end && end.stopped === true && end.cured === before.cured && end.cash === before.cash, `stop(): phase done, bonusEnd stopped with ${end && end.cured} cured, $${end && end.cash}`);
    check((await page.evaluate(() => { const g = window.__bonus.game; g.aim(100, 100); g.fire(true); return g.getState().firing; })) === false, 'after stop: fire() does nothing');
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }

  // ---------- 4. reduced motion, portrait, perf, the word audit ----------
  {
    const { context, page, errors } = await open(browser, { seed: '5', count: '20', rm: '1' });
    let s = null;
    for (let i = 0; i < 160; i++) { s = await page.evaluate(() => window.__auto(30)); if (s.phase === 'done') break; }
    const end = await page.evaluate(() => window.__ev('bonusEnd')[0]);
    check(s.phase === 'done' && end && end.cured >= 8 && errors.length === 0, `reduced motion: a full round (${end && end.cured}/${end && end.total} cured), no errors`);
    await context.close();
  }
  {
    const { context, page, errors } = await open(browser, { seed: '9', count: '20' }, { width: 390, height: 844 });
    let s = await page.evaluate(() => window.__step(100));
    check(s.phase === 'run' && s.critters.length >= 1 && s.critters.every((c) => c.x > -120 && c.x < 510), `portrait: critters inside the width (${s.critters.length} on screen)`);
    for (let i = 0; i < 160; i++) { s = await page.evaluate(() => window.__auto(30)); if (s.phase === 'done') break; if (i === 8) await shot(page, '6-portrait'); }
    const end = await page.evaluate(() => window.__ev('bonusEnd')[0]);
    check(s.phase === 'done' && end && end.cured >= 6 && errors.length === 0, `portrait: a full round (${end && end.cured}/${end && end.total} cured), no errors`);
    await context.close();
  }
  if (!process.env.SKIP_PERF) {
    const LIMIT = Number(process.env.PERF_MS) || 8;
    const { context, page, errors } = await open(browser, { seed: '3', count: '40' });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => { const g = window.__bonus.game; g.debugStep(80); g.debugPerf(true); });
    // real-time play for ~4 s with the finger down on moving critters
    const t0 = Date.now();
    while (Date.now() - t0 < 4000) {
      await page.evaluate(() => { const g = window.__bonus.game; const s = g.getState(); const z = s.critters.filter((c) => c.zombie); if (z.length) { g.aim(z[0].x, z[0].y); g.fire(true); } });
      await page.waitForTimeout(120);
    }
    const p = await page.evaluate(() => window.__bonus.game.debugPerf());
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const perTick = p.ticks ? p.sim / p.ticks : 0, perFrame = p.frames ? (p.sim + p.draw) / p.frames : 0, drawPer = p.frames ? p.draw / p.frames : 0;
    console.log(`    perf (4x throttle, spraying, up to 5 critters): ${p.frames} frames, ${p.ticks} ticks, sim ${perTick.toFixed(2)} ms/tick, draw ${drawPer.toFixed(2)} ms/frame, total ${perFrame.toFixed(2)} ms/frame`);
    check(perFrame < LIMIT && p.frames > 20, `perf: ${perFrame.toFixed(2)} ms a frame < ${LIMIT} ms at 4x CPU throttle`);
    check(errors.length === 0, `perf run: no page errors (${errors.join(' | ')})`);
    await context.close();
  }
  {
    const src = ['src/game/bonus.js', 'src/game/critters.js'].map((f) => readFileSync(path.join(REPO, 'fraction-fright', f), 'utf8'));
    const strings = src.flatMap((t) => [...t.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]));
    const bad = strings.filter((s) => BANNED.test(s));
    check(bad.length === 0, `kid-rule word audit over the module strings (${bad.length ? bad.join(' | ') : 'clean'})`);
  }
} finally {
  await browser.close();
  if (server) server.kill();
}
console.log(`\n${passes} passed, ${failures.length} failed`);
console.log(`shots: ${SHOTS}`);
if (failures.length) { for (const f of failures) console.log('  - ' + f); process.exit(1); }

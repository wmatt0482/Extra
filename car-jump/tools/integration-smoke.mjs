// Integration test: the full app (index.html) on the REAL engine, driven with real touch input.
//   SHOTS_DIR=/some/dir node tools/integration-smoke.mjs      (starts python3 -m http.server 8080 if needed)
// At 844×390 and 390×844 (DPR 2, touch): boots from a hand-written v1 save, then plays
// Title → Garage → Tracks → Run → Results → Retry (pause / resume / visibility pause) → Next track, a
// daily challenge twice (pays once), every panel incl. Badges and the shake slider, and a reload. Taps go
// through Playwright's touchscreen and GAS / BRAKE / NITRO holds through CDP Input.dispatchTouchEvent.
// Checks: no console errors / unhandled rejections; results rows sum to summary.cash.total and the save is
// credited; the rating stamp shows summary.rating; achievements earn from real events and persist; the
// v1 save loads without loss; pause / visibility pause freeze the run; the title hero animates and draws
// the selected car; one big text per moment (an engine "big" popup never shares the screen with a HUD
// banner) and no banner covers the car during the launch letterbox.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'ramp-rage-integration-shots');
mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}
async function ensureServer() {
  const up = async () => { try { return (await fetch(BASE + '/index.html')).ok; } catch (_) { return false; } };
  if (await up()) return null;
  const srv = spawn('python3', ['-m', 'http.server', '8080'], { cwd: root, stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await up()); i++) await sleep(100);
  return srv;
}

const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

const LAYOUTS = [
  { name: 'landscape', width: 844, height: 390 },
  { name: 'portrait', width: 390, height: 844 },
];

// A save exactly as v1 wrote it (schema v:1: no achievements / shake / v2 records / seen.ach).
const V1_SAVE = {
  v: 1, cash: 4321, owned: ['beater', 'rally'], selectedCar: 'rally',
  levels: { beater: { engine: 6, nitro: 6, suspension: 6, bonus: 5 }, rally: { engine: 4, nitro: 4, suspension: 4, bonus: 3 } },
  unlocked: ['canyon', 'city'], selectedTrack: 'canyon', best: { canyon: 180, city: 95 },
  records: { bestScore: 3100, totalSmashes: 41, totalFlips: 12, lifetimeCash: 21000, runs: 14, maxSpeedKmh: 131, longestAir: 4.4, perfectLandings: 3 },
  daily: { date: '2026-01-01', done: true, attempts: 2 },
  goals: { list: [{ id: 'g0', type: 'airTime', target: 4, progress: 1.5, done: false, reward: 440 }, { id: 'g1', type: 'perfect', target: 2, progress: 1, done: false, reward: 500 }, { id: 'g2', type: 'runCash', target: 800, progress: 0, done: false, reward: 320 }], rolled: 3 },
  settings: { sound: true, music: false, reducedMotion: false },
  seen: { coach: true },
};
// The daily challenge is date-seeded: pin the page clock to a day whose goal a loaner can reach
// ("Hit 130 km/h" on Downtown Drop in Bigfoot Jr.), so the pays-once rule can be checked for real.
const DAILY_DAY = '2026-10-18T12:00:00';

const fontCache = new Map();
async function routeFonts(ctx) {
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    const url = route.request().url();
    try {
      if (!fontCache.has(url)) fontCache.set(url, execSync(`curl -sSL --max-time 15 -A "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36" "${url}"`));
      await route.fulfill({ status: 200, body: fontCache.get(url), contentType: url.includes('googleapis') ? 'text/css' : 'font/ttf', headers: { 'access-control-allow-origin': '*' } });
    } catch (_) { await route.fulfill({ status: 200, body: '', contentType: 'text/css' }); }
  });
}

const readSave = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('rampRage.save.v1')));
const vis = (sel) => `${sel}:not([hidden])`;

async function shot(page, layout, name) {
  const file = path.join(SHOTS, `${layout.name}-${name}.png`);
  await page.screenshot({ path: file });
  return file;
}
async function tap(page, sel) {
  const loc = page.locator(sel).first();
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (!b) throw new Error('no box for ' + sel);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}

// Per-frame monitor: banners, engine popups (via debugInfo), banner/car overlap during the letterbox.
async function instrument(page) {
  await page.evaluate(() => {
    if (window.__imon) return;
    const m = window.__imon = { coverSamples: [], banners: [], dupes: [], overlaps: [], toastOverBanner: 0, coverLetterbox: 0, coverAny: 0, frames: 0, starts: [] };
    let lastKind = null;
    const tick = () => {
      requestAnimationFrame(tick);
      const R = window.__rampRage;
      if (!R || !R.run) { lastKind = null; return; }
      const g = R.game, info = g && g.debugInfo && g.debugInfo();
      const b = document.querySelector('#banner');
      const up = b && !b.hidden;
      const kind = up ? b.dataset.kind : null;
      if (kind && kind !== lastKind) m.banners.push(kind);
      lastKind = kind;
      if (up && document.querySelector('#toasts .toast.ach, #toasts .toast.note')) m.toastOverBanner++;
      if (!info) return;
      m.frames++;
      // same moment twice: these moments belong to the HUD (banners) or to the world (record flag)
      for (const p of info.popups) if (/^(ORBIT|KICKER|LAUNCH|NEW RECORD)/.test(p.text)) m.dupes.push(`engine popup "${p.text}"`);
      for (const p of info.popups) if (p.world && /×/.test(p.text)) m.dupes.push(`engine running-combo popup "${p.text}" (the HUD badge owns it)`);
      if (kind === 'record') m.dupes.push('HUD record banner');
      // different moments may overlap in time, but never in space: engine screen texts vs the banner
      if (up) {
        const span = b.querySelector('span'), br = span.getBoundingClientRect(), cv = document.querySelector('#game').getBoundingClientRect();
        if (Number(getComputedStyle(span).opacity) > 0.2) {
          const base = Math.max(16, Math.min(34, Math.min(info.view.W, info.view.H) * 0.065));
          for (const p of info.popups) {
            if (p.world) continue;
            const k = p.t / p.life, size = base * (p.scale || 1) * 1.15;
            const py = cv.top + p.y * info.view.H - k * 24, w = p.text.length * size * 0.62, px = cv.left + p.x * info.view.W;
            if (px + w / 2 > br.left && px - w / 2 < br.right && py + size / 2 > br.top && py - size / 2 < br.bottom) m.overlaps.push(`${kind} x "${p.text}"`);
          }
        }
      }
      if (up) {
        const c = info.cam, z = c.z, cv = document.querySelector('#game').getBoundingClientRect();
        const sx = cv.left + (info.x - c.x) * z + info.view.W / 2 + c.sx, sy = cv.top + info.view.H / 2 - (info.y - c.y) * z + c.sy;
        const rr = info.carHalf * z;
        const br = b.querySelector('span').getBoundingClientRect();
        const op = Number(getComputedStyle(b.querySelector('span')).opacity);
        const hit = op > 0.3 && sx + rr > br.left && sx - rr < br.right && sy + rr > br.top && sy - rr < br.bottom;
        if (hit) { m.coverAny++; if (info.letterbox > 0.3) { m.coverLetterbox++; if (m.coverSamples.length < 6) m.coverSamples.push({ kind, car: [Math.round(sx), Math.round(sy), Math.round(rr)], banner: [Math.round(br.left), Math.round(br.top), Math.round(br.right), Math.round(br.bottom)], lb: +info.letterbox.toFixed(2) }); } }
      }
    };
    requestAnimationFrame(tick);
    // see what main.js passes to game.start
    const wrap = () => {
      const g = window.__rampRage && window.__rampRage.game;
      if (g && !g.__wrapped) { const o = g.start; g.start = (opts) => { m.starts.push({ shake: opts.shake, bestDistance: opts.bestDistance, track: opts.track.id, car: opts.car.id }); return o(opts); }; g.__wrapped = true; }
    };
    wrap(); setInterval(wrap, 200);
  });
}

// Drives a run with real touches until the results screen shows. Policy: GAS down the ramp; at the lip
// hold BRAKE for one back flip when there is time, then let go (auto-level); GAS + NITRO on the ground.
async function playRun(page, cdp, layout, label, { shots = true, onTick = null } = {}) {
  const pos = await page.evaluate(() => {
    const c = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; };
    return { gas: c('#ctl-gas'), brake: c('#ctl-brake'), nitro: c('#ctl-nitro') };
  });
  const ids = { gas: 1, brake: 2, nitro: 3 };
  let cur = '';
  const setTouches = async (want) => {
    const names = Object.keys(want).filter((k) => want[k]);
    const key = names.join(',');
    if (key === cur) return;
    if (cur) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    if (names.length) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: names.map((n) => ({ x: pos[n].x, y: pos[n].y, id: ids[n], radiusX: 8, radiusY: 8, force: 1 })) });
    cur = key;
  };
  const m = { flip: 'none', ang0: 0, shotLaunch: false, shotBanner: new Set(), shotCombo: false, sawInput: false };
  const t0 = Date.now();
  let st = null;
  while (Date.now() - t0 < 140000) {
    st = await page.evaluate(() => {
      const R = window.__rampRage;
      if (!R.run) return null;
      const g = R.game, info = g.debugInfo();
      const b = document.querySelector('#banner');
      return { s: g.getState(), info: info && { ang: info.ang, launchKmh: info.launchKmh, letterbox: info.letterbox, vy: info.vy, y: info.y, x: info.x },
        banner: b && !b.hidden ? b.dataset.kind : null, combo: !document.querySelector('#hud-combo').hidden, paused: R.app && document.querySelector('#panel-pause').hidden === false,
        ctl: ['gas', 'brake', 'nitro'].filter((n) => document.querySelector('#ctl-' + n).classList.contains('is-down')) };
    });
    if (!st) break;
    if (onTick && (await onTick(st))) continue;
    const { s, info } = st;
    const want = { gas: false, brake: false, nitro: false };
    if (s.phase === 'ramp') want.gas = true;
    else if (s.phase === 'air') {
      if (m.flip === 'none' && info && info.launchKmh) { m.flip = info.vy > -2 ? 'going' : 'skip'; m.ang0 = info.ang; }
      if (m.flip === 'going') { if (info.ang - m.ang0 < 4.6) want.brake = true; else m.flip = 'done'; }
    } else if (s.phase === 'ground') {
      want.gas = true; want.nitro = s.nitro > 0.02;
      if (m.flip === 'going') m.flip = 'done';
    }
    await setTouches(want);
    if (st.ctl.length) m.sawInput = true;
    if (shots) {
      if (!m.shotLaunch && s.phase === 'air' && info && info.letterbox > 0.4) { m.shotLaunch = true; await shot(page, layout, `${label}-launch-letterbox`); }
      if (st.banner && st.banner !== 'launch' && !m.shotBanner.has(st.banner)) { m.shotBanner.add(st.banner); await sleep(220); await shot(page, layout, `${label}-banner-${st.banner}`); }
      if (!m.shotCombo && st.combo && s.combo && s.combo.count >= 3) { m.shotCombo = true; await shot(page, layout, `${label}-combo`); }
    }
    await sleep(20);
  }
  await setTouches({});
  check(m.sawInput, `${label}: on-screen controls responded to real touches`);
  await page.waitForSelector(vis('#screen-results'), { timeout: 20000 });
  return m;
}

async function resultsCheck(page, layout, label, before, { daily = false } = {}) {
  await page.waitForFunction(() => {
    const td = document.querySelector('#res-pay tr[data-pay="total"] td:last-child');
    return td && Number(td.textContent.replace(/[^0-9-]/g, '')) === Number(td.dataset.value);
  }, null, { timeout: 5000 });
  await page.waitForSelector('#res-stamp.slam:not([hidden])', { timeout: 4000 });
  await sleep(700);
  await shot(page, layout, `${label}-results`);
  const r = await page.evaluate(() => {
    const val = (tr) => Number(tr.lastElementChild.textContent.replace(/[^0-9-]/g, ''));
    const rows = [...document.querySelectorAll('#res-pay tr')];
    const base = rows.filter((x) => ['distance', 'stunts', 'smashes', 'combo', 'air', 'landing', 'bonus'].includes(x.dataset.pay));
    const lr = window.__rampRage.lastResult;
    return {
      rows: base.map((x) => [x.dataset.pay, val(x)]), total: val(rows.find((x) => x.dataset.pay === 'total')),
      extras: rows.filter((x) => x.dataset.pay === 'goal' || x.dataset.pay === 'daily').map(val),
      summary: lr.summary, stamp: document.querySelector('#res-stamp').dataset.rating, rating: lr.rating, earned: (lr.achievements || []).map((a) => a.id),
      dailyReward: lr.dailyReward, dailyAlreadyDone: lr.dailyAlreadyDone, chip: document.querySelectorAll('#res-callouts [data-ach]').length,
    };
  });
  const c = r.summary.cash;
  const sum = r.rows.reduce((a, x) => a + x[1], 0);
  check(sum === r.total && r.total === c.total, `${label}: rows ${r.rows.map((x) => x.join(' ')).join(' + ')} = ${sum} = summary total ${c.total}`);
  check(!r.rows.some((x) => x[0] === 'bonus'), `${label}: no "Bonus" rounding row (engine cash parts add up)`);
  check(c.distance + c.stunts + c.smash + c.landing + c.combo + c.air === c.total, `${label}: engine cash parts add up`);
  check(r.stamp === r.summary.rating && r.rating === r.summary.rating, `${label}: stamp ${r.stamp} = summary.rating ${r.summary.rating}`);
  const after = await readSave(page);
  const expected = before.cash + r.total + r.extras.reduce((a, b) => a + b, 0);
  check(after.cash === expected, `${label}: save credited ${before.cash} → ${after.cash} (expected ${expected})`);
  check(after.records.runs === before.records.runs + 1, `${label}: runs ${before.records.runs} → ${after.records.runs}`);
  for (const id of r.earned) check(after.achievements[id] > 0, `${label}: badge ${id} earned and saved`);
  if (r.earned.length) check(r.chip === Math.min(4, r.earned.length), `${label}: results chip lists ${r.chip} new badge(s)`);
  console.log(`    ${label}: ${Math.round(r.summary.distance)} m, ${r.summary.flips} flips, landing ${r.summary.landing}, combo ${r.summary.bestCombo}, rating ${r.summary.rating}, cash ${JSON.stringify(c)}${r.earned.length ? ', badges ' + r.earned.join(' ') : ''}`);
  return { ...r, after };
}

// the title hero must be moving and must be painting the selected car (its body colour shows up)
async function heroCheck(page, label, carColor) {
  const res = await page.evaluate(async (hex) => {
    const cv = document.querySelector('#hero');
    const want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const frames = [];
    let found = 0;
    for (let k = 0; k < 24; k++) {
      await new Promise((r) => setTimeout(r, 90));
      frames.push(cv.toDataURL().length);
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 0; i < d.length; i += 16) {
        if (d[i + 3] > 200 && Math.abs(d[i] - want[0]) < 14 && Math.abs(d[i + 1] - want[1]) < 14 && Math.abs(d[i + 2] - want[2]) < 14) { found++; }
      }
    }
    return { distinct: new Set(frames).size, found };
  }, carColor);
  check(res.distinct > 3, `${label}: title hero animates (${res.distinct} distinct frames of 24)`);
  check(res.found > 20, `${label}: title hero draws the selected car (${res.found} body-colour pixels)`);
}

async function runLayout(browser, layout) {
  console.log(`\n=== ${layout.name} ${layout.width}x${layout.height} (real engine) ===`);
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await routeFonts(ctx);
  const errors = [];
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(({ save, day }) => {
    if (!sessionStorage.getItem('itSeeded')) { localStorage.setItem('rampRage.save.v1', JSON.stringify(save)); sessionStorage.setItem('itSeeded', '1'); }
    window.addEventListener('unhandledrejection', (e) => console.error('unhandledrejection: ' + (e.reason && e.reason.message || e.reason)));
    // shift the clock to the pinned day (time keeps flowing; only the date matters)
    const RD = Date, off = new RD(day).getTime() - RD.now();
    class D extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }
    window.Date = D;
  }, { save: V1_SAVE, day: DAILY_DAY });
  const cdp = await ctx.newCDPSession(page);

  await page.goto(BASE + '/index.html?nosw=1', { waitUntil: 'networkidle' });
  await page.waitForSelector(vis('#screen-title'));
  await page.evaluate(() => document.fonts && document.fonts.ready);
  check(await page.evaluate(() => window.__rampRage.app.engineName === ''), 'real engine loaded (no mock fallback)');
  check(!(await page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.controller)), '?nosw=1: no service worker');
  await shot(page, layout, '01-title');

  // v1 save loads in place
  const s0 = await readSave(page);
  const lost = [];
  if (s0.cash !== 4321) lost.push('cash');
  if (JSON.stringify(s0.owned) !== '["beater","rally"]' || s0.selectedCar !== 'rally') lost.push('cars');
  if (JSON.stringify(s0.levels.beater) !== JSON.stringify(V1_SAVE.levels.beater) || JSON.stringify(s0.levels.rally) !== JSON.stringify(V1_SAVE.levels.rally)) lost.push('levels');
  if (JSON.stringify(s0.unlocked) !== '["canyon","city"]' || s0.best.canyon !== 180 || s0.best.city !== 95) lost.push('tracks/best');
  for (const [k, v] of Object.entries(V1_SAVE.records)) if (s0.records[k] !== v) lost.push('records.' + k);
  if (s0.goals.list.length !== 3 || s0.goals.list[0].progress !== 1.5 || s0.goals.rolled !== 3) lost.push('goals');
  if (s0.settings.music !== false || s0.settings.shake !== 100 || s0.seen.coach !== true) lost.push('settings');
  check(s0.v === 2 && lost.length === 0 && Object.keys(s0.achievements).length === 0 && s0.records.bestCombo === 0,
    `v1 save loads without loss (v${s0.v}${lost.length ? ', lost: ' + lost.join(' ') : ''})`);
  await heroCheck(page, 'title (Gravel Fox)', '#3b7dd9');
  await instrument(page);

  // Title → Garage: select Rusty, then back to Gravel Fox; buy an upgrade
  await tap(page, '#btn-play');
  await page.waitForSelector(vis('#screen-garage'));
  await sleep(300);
  await shot(page, layout, '02-garage');
  await tap(page, '#car-prev');
  await sleep(350);
  check(/Select/.test(await page.textContent('#car-action')), 'garage: Rusty shows Select');
  await tap(page, '#car-action');
  check((await readSave(page)).selectedCar === 'beater', 'garage: selected Rusty');
  await tap(page, '[data-back="title"]');
  await page.waitForSelector(vis('#screen-title'));
  await heroCheck(page, 'title (Rusty)', '#d9823b');
  await tap(page, '#btn-play');
  await page.waitForSelector(vis('#screen-garage'));
  await tap(page, '#car-next');
  await sleep(350);
  await tap(page, '#car-action');
  let save = await readSave(page);
  check(save.selectedCar === 'rally', 'garage: back on Gravel Fox');
  const cost = Number((await page.textContent('[data-upgrade="bonus"]')).replace(/\D/g, ''));
  await tap(page, '[data-upgrade="bonus"]');
  const s1 = await readSave(page);
  check(s1.levels.rally.bonus === 4 && s1.cash === save.cash - cost, `garage: bought Bonus Lv4 for $${cost}`);
  await shot(page, layout, '03-garage-upgraded');

  // Tracks → Run (canyon)
  await tap(page, '#btn-race');
  await page.waitForSelector(vis('#screen-tracks'));
  await sleep(250);
  await shot(page, layout, '04-tracks');
  save = await readSave(page);
  await tap(page, '[data-track="canyon"]');
  await page.waitForSelector(vis('#hud'));
  check(await page.$eval('#coach', (e) => e.hidden), 'no first-run coach for a v1 player with runs');
  const m1 = await playRun(page, cdp, layout, '05-run1');
  const st1 = await page.evaluate(() => window.__imon.starts.at(-1));
  check(st1 && st1.shake === 1 && st1.bestDistance === 180 && st1.car === 'rally', `game.start got shake ${st1 && st1.shake}, bestDistance ${st1 && st1.bestDistance}, car ${st1 && st1.car}`);
  check(m1.shotLaunch, 'run 1: launch letterbox seen');
  const r1 = await resultsCheck(page, layout, 'run 1', save);
  check(r1.after.achievements && Object.keys(r1.after.achievements).length > 0, `run 1: badges earned from real events (${Object.keys(r1.after.achievements).join(', ')})`);

  // Retry → pause / resume → visibility pause → let it finish
  save = r1.after;
  await tap(page, '#res-retry');
  await page.waitForSelector(vis('#hud'));
  let pausedOnce = false, hiddenOnce = false;
  await playRun(page, cdp, layout, '06-run2', {
    shots: false,
    onTick: async (st) => {
      if (!pausedOnce && st.s.phase === 'ground' && st.s.distance > 60) {
        pausedOnce = true;
        await tap(page, '#btn-pause');
        await page.waitForSelector(vis('#panel-pause'));
        const d0 = await page.evaluate(() => window.__rampRage.game.getState().distance);
        await sleep(700);
        const d1 = await page.evaluate(() => window.__rampRage.game.getState().distance);
        await shot(page, layout, '06-pause');
        check(d0 === d1, `pause freezes the run (${d0} → ${d1} m)`);
        await tap(page, '#pause-resume');
        await sleep(400);
        const d2 = await page.evaluate(() => window.__rampRage.game.getState().distance);
        check(d2 > d1 || (await page.evaluate(() => window.__rampRage.game.getState().phase)) === 'done', `resume continues (${d1} → ${d2} m)`);
        return true;
      }
      if (pausedOnce && !hiddenOnce && st.s.phase === 'ground') {
        hiddenOnce = true;
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
        const d0 = await page.evaluate(() => window.__rampRage.game.getState().distance);
        await sleep(600);
        const d1 = await page.evaluate(() => window.__rampRage.game.getState().distance);
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
        const panel = await page.evaluate(() => !document.querySelector('#panel-pause').hidden);
        check(d0 === d1 && panel, `visibility hidden pauses the run and shows the pause panel (${d0} → ${d1} m)`);
        await tap(page, '#pause-resume');
        return true;
      }
      return false;
    },
  });
  check(pausedOnce && hiddenOnce, 'run 2: pause + visibility pause exercised');
  const r2 = await resultsCheck(page, layout, 'run 2 (retry)', save);

  // Next track → city
  save = r2.after;
  check(!(await page.$eval('#res-next', (e) => e.hidden || e.disabled)), 'Next track enabled (city unlocked)');
  await tap(page, '#res-next');
  await page.waitForSelector(vis('#hud'));
  const m3 = await playRun(page, cdp, layout, '07-run3-city');
  const st3 = await page.evaluate(() => window.__imon.starts.at(-1));
  check(st3 && st3.track === 'city' && st3.bestDistance === 95, `next track started city (bestDistance ${st3 && st3.bestDistance})`);
  const r3 = await resultsCheck(page, layout, 'run 3 (city)', save);

  const mon = await page.evaluate(() => window.__imon);
  check(mon.dupes.length === 0, `one big text per moment (HUD: launch/bigair/orbit/rejump/rampage; engine: flips/landings/finish/record flag)${mon.dupes.length ? ' — ' + [...new Set(mon.dupes)].slice(0, 6).join('; ') : ''}`);
  check(mon.overlaps.length === 0, `engine screen texts never overlap a HUD banner${mon.overlaps.length ? ' — ' + [...new Set(mon.overlaps)].slice(0, 6).join('; ') : ''}`);
  check(mon.banners.includes('launch'), 'HUD launch banner shown');
  check(mon.toastOverBanner === 0, `achievement / goal toasts never share the screen with a banner (${mon.toastOverBanner} frames)`);
  check(mon.coverLetterbox === 0, `no banner over the car during the launch letterbox (${mon.coverLetterbox} frames; any time: ${mon.coverAny})${mon.coverSamples.length ? ' ' + JSON.stringify(mon.coverSamples) : ''}`);
  console.log(`    banners seen: ${mon.banners.join(', ') || 'none'}`);

  // panels from the title
  await tap(page, '#res-garage');
  await page.waitForSelector(vis('#screen-garage'));
  await tap(page, '[data-back="title"]');
  await page.waitForSelector(vis('#screen-title'));
  const earned = Object.keys((await readSave(page)).achievements);
  for (const p of ['goals', 'records', 'achievements', 'settings']) {
    await tap(page, `[data-open="${p}"]`);
    await page.waitForSelector(vis(`#panel-${p}`));
    await sleep(250);
    await shot(page, layout, `08-panel-${p}`);
    if (p === 'achievements') {
      const a = await page.evaluate(() => ({ earned: [...document.querySelectorAll('.ach-card.earned')].map((e) => e.dataset.ach), all: document.querySelectorAll('.ach-card').length }));
      check(a.all === 12 && a.earned.length === earned.length, `Badges panel: ${a.earned.length}/12 earned (${a.earned.join(', ')})`);
    }
    if (p === 'settings') {
      // drag the shake slider with a real touch: 80% → 40%
      const b = await page.locator('#set-shake').boundingBox();
      const y = Math.round(b.y + b.height / 2);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(b.x + b.width * 0.8), y, id: 7 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(b.x + b.width * 0.6), y, id: 7 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(b.x + b.width * 0.4), y, id: 7 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(200);
      const v = (await readSave(page)).settings.shake;
      check(v === 40, `shake slider drag saves 40 (got ${v})`);
      await shot(page, layout, '08-panel-settings-shake');
    }
    await tap(page, `#panel-${p} [data-close]`);
  }

  // daily: pays once
  save = await readSave(page);
  await tap(page, '[data-open="daily"]');
  await page.waitForSelector(vis('#panel-daily'));
  await sleep(250);
  await shot(page, layout, '09-panel-daily');
  check(save.daily.date === '2026-10-18' && save.daily.done === false, `daily rolled to the pinned day (${save.daily.date}, done ${save.daily.done})`);
  await tap(page, '#daily-play');
  await page.waitForSelector(vis('#hud'));
  await playRun(page, cdp, layout, '10-daily1', { shots: false });
  const st4 = await page.evaluate(() => window.__imon.starts.at(-1));
  check(st4 && st4.shake === 0.4 && st4.bestDistance === null && st4.car === 'monster', `daily: game.start shake ${st4 && st4.shake}, bestDistance ${st4 && st4.bestDistance}, loaner ${st4 && st4.car}`);
  const d1 = await resultsCheck(page, layout, 'daily 1', save);
  check(d1.dailyReward > 0 && d1.after.daily.done, `daily 1 pays $${d1.dailyReward} and marks done`);
  check(await page.$eval('#res-next', (e) => e.hidden), 'daily results hide Next track');
  save = d1.after;
  await tap(page, '#res-retry');
  await page.waitForSelector(vis('#hud'));
  await playRun(page, cdp, layout, '11-daily2', { shots: false });
  const d2 = await resultsCheck(page, layout, 'daily 2', save);
  check(d2.dailyReward === 0 && d2.dailyAlreadyDone, 'daily 2 pays nothing extra (already claimed)');

  // achievements persist across a reload; best distance never regressed
  const before = Object.keys((await readSave(page)).achievements).sort();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(vis('#screen-title'));
  const after = await readSave(page);
  check(before.length > 0 && JSON.stringify(Object.keys(after.achievements).sort()) === JSON.stringify(before), `achievements persist across reload (${before.length})`);
  check(after.best.canyon >= 180 && after.best.city >= 95, `best distances kept (canyon ${after.best.canyon}, city ${after.best.city})`);
  await shot(page, layout, '12-title-after-reload');

  check(errors.length === 0, `no console errors / unhandled rejections${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
  await ctx.close();
}

const srv = await ensureServer();
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
try {
  const only = process.env.LAYOUT;
  for (const l of LAYOUTS) if (!only || only === l.name) await runLayout(browser, l);
} catch (e) {
  failures.push('exception: ' + e.message);
  console.error(e);
} finally {
  await browser.close();
  if (srv) srv.kill();
}
console.log(`\nScreenshots: ${SHOTS}`);
if (failures.length) { console.log(`\nFAILED (${failures.length}):\n- ` + failures.join('\n- ')); process.exit(1); }
console.log('\nALL CHECKS PASSED');

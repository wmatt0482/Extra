// UI smoke test for the Ramp Rage shell (meta screens + mock engine).
//   cd car-jump && python3 -m http.server 8080 &      (the script starts one itself if needed)
//   SHOTS_DIR=/some/dir node tools/ui-smoke.mjs
// Walks title → garage → buy upgrade → track select → first-run coach → run → results (checks the cash math) → retry
// → pause/end run → daily → goals/records/settings → reset, at 844×390 and 390×844 (DPR 2) with
// simulated iPhone safe-area insets. Fails on console errors, horizontal overflow, controls under
// the home indicator, or tiny tap targets. Screenshots every screen.
// v2: v1-save migration, animated title hero (canvas pixels change), HUD combo badge / altitude / banners
// on the right mock events, achievement toasts (one at a time, never over a banner), results rows with
// Combo + Air adding up, rating stamp, NEW RECORD fireworks, extra stat tiles, achievements persisted across
// a reload + the Achievements panel, the screen-shake slider (saved, passed to game.start with bestDistance),
// and an orbit run on the moon.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'ramp-rage-ui-shots');
mkdirSync(SHOTS, { recursive: true });

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
  for (let i = 0; i < 50 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100));
  return srv;
}

const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

const LAYOUTS = [
  { name: 'landscape', width: 844, height: 390, insets: { t: 0, r: 47, b: 21, l: 47 } },
  { name: 'portrait', width: 390, height: 844, insets: { t: 47, r: 0, b: 34, l: 0 } },
];

// a v1 save (no achievements / shake / v2 records) with a best on canyon, so run 1 passes it → 'record'
const SEED_SAVE = { v: 1, cash: 5000, owned: ['beater'], selectedCar: 'beater', unlocked: ['canyon'], best: { canyon: 120 },
  settings: { sound: true, music: true, reducedMotion: false } };

// Google Fonts: fetched with curl (which honors HTTPS_PROXY in sandboxes) and cached, so screenshots
// use the real display font. If that fails the page just falls back to system fonts.
const fontCache = new Map();
async function routeFonts(ctx) {
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    const url = route.request().url();
    try {
      if (!fontCache.has(url)) {
        const body = execSync(`curl -sSL --max-time 15 -A "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36" "${url}"`);
        fontCache.set(url, body);
      }
      const css = url.includes('googleapis');
      await route.fulfill({ status: 200, body: fontCache.get(url), contentType: css ? 'text/css' : 'font/ttf', headers: { 'access-control-allow-origin': '*' } });
    } catch (_) {
      await route.fulfill({ status: 200, body: '', contentType: 'text/css' });
    }
  });
}

async function layoutAudit(page, insets, label) {
  const issues = await page.evaluate(({ insets }) => {
    const W = innerWidth, H = innerHeight, out = [];
    if (document.documentElement.scrollWidth > W + 1) out.push(`document scrollWidth ${document.documentElement.scrollWidth} > ${W}`);
    const visible = (el) => {
      if (el.closest('[hidden]')) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    };
    const inScroller = (el) => {
      for (let p = el.parentElement; p && p.id !== 'app'; p = p.parentElement) {
        const o = getComputedStyle(p); if (/(auto|scroll)/.test(o.overflowY + o.overflowX)) return p;
      }
      return null;
    };
    const desc = (el) => el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + (el.textContent ? ` "${el.textContent.trim().slice(0, 24)}"` : '');
    for (const el of document.querySelectorAll('#app *')) {
      if (el.closest('#backdrop, #toasts, #stage, #banner, #res-fx') || (el.closest('svg') && el.tagName !== 'svg')) continue;
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const sc = inScroller(el);
      if (r.right > W + 1 || r.left < -1) out.push(`h-overflow ${desc(el)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      if (!sc && (r.bottom > H + 1 || r.top < -1)) out.push(`v-overflow ${desc(el)} [${Math.round(r.top)}..${Math.round(r.bottom)}]`);
      // clipped single-line text
      const cs = getComputedStyle(el);
      if (el.children.length === 0 && el.textContent.trim() && cs.overflow === 'hidden' && el.scrollWidth > el.clientWidth + 1) out.push(`clipped text ${desc(el)}`);
    }
    for (const b of document.querySelectorAll('#app button')) {
      if (!visible(b)) continue;
      const r = b.getBoundingClientRect();
      if (!r.width) continue;
      const sc = inScroller(b);
      if (Math.min(r.width, r.height) < 44) out.push(`tap target ${Math.round(r.width)}x${Math.round(r.height)} ${desc(b)}`);
      if (!sc && r.bottom > H - insets.b + 1) out.push(`under home indicator ${desc(b)} bottom=${Math.round(r.bottom)} limit=${H - insets.b}`);
      if (!sc && (r.left < insets.l - 1 || r.right > W - insets.r + 1)) out.push(`inside notch/side inset ${desc(b)}`);
      if (!sc && r.top < insets.t - 1) out.push(`under status bar ${desc(b)}`);
    }
    return out;
  }, { insets });
  check(issues.length === 0, `${label}: layout clean${issues.length ? ' — ' + issues.slice(0, 6).join('; ') : ''}`);
}

// results cards must fit between the header and the buttons (no content running under the footer)
async function resultsFit(page, label) {
  const r = await page.evaluate(() => {
    const foot = document.querySelector('.results-foot').getBoundingClientRect().top;
    const main = document.querySelector('.res-main');
    const body = document.querySelector('.results-body');
    const scrolls = getComputedStyle(body).overflowY !== 'visible';
    const last = [...main.querySelectorAll('.stat')].pop();
    return { scrolls, mainBottom: main.getBoundingClientRect().bottom, lastTile: last ? last.getBoundingClientRect().bottom : 0, foot, headWrap: document.querySelector('.results-head').getBoundingClientRect().height };
  });
  check(r.scrolls || (r.mainBottom <= r.foot + 1 && r.lastTile <= r.mainBottom + 1), `${label}: results cards fit above the buttons (tiles end ${Math.round(r.lastTile)}, card ${Math.round(r.mainBottom)}, buttons ${Math.round(r.foot)})`);
}

async function shot(page, layout, name) {
  await page.waitForTimeout(250);
  const file = path.join(SHOTS, `${layout.name}-${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

const readSave = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('rampRage.save.v1')));
const visibleSel = (sel) => `${sel}:not([hidden])`;

async function payoutCheck(page, label, before) {
  // the total counts up over ~1.2 s: wait for it to land, then read the shown numbers
  await page.waitForFunction(() => {
    const td = document.querySelector('#res-pay tr[data-pay="total"] td:last-child');
    return td && Number(td.textContent.replace(/[^0-9-]/g, '')) === Number(td.dataset.value);
  }, null, { timeout: 4000 });
  const pay = await page.evaluate(() => {
    const val = (tr) => Number(tr.lastElementChild.textContent.replace(/[^0-9-]/g, ''));
    const rows = [...document.querySelectorAll('#res-pay tr')];
    const base = rows.filter((r) => ['distance', 'stunts', 'smashes', 'combo', 'air', 'landing', 'bonus'].includes(r.dataset.pay)).map(val);
    const keys = rows.map((r) => r.dataset.pay);
    const total = val(rows.find((r) => r.dataset.pay === 'total'));
    const extras = rows.filter((r) => r.dataset.pay === 'goal' || r.dataset.pay === 'daily').map(val);
    const c = window.__rampRage.lastResult.summary.cash;
    return { base, keys, total, extras, cash: c, distance: Number(document.querySelector('#res-distance').textContent.replace(/\D/g, '')) };
  });
  const sum = pay.base.reduce((a, b) => a + b, 0);
  check(pay.base.length >= 4 && sum === pay.total && pay.total === pay.cash.total, `${label}: breakdown ${pay.base.join(' + ')} = ${sum} matches total ${pay.total}`);
  check(pay.keys.includes('combo') === (pay.cash.combo > 0) && pay.keys.includes('air') === (pay.cash.air > 0),
    `${label}: Combo row ${pay.cash.combo > 0 ? 'shown' : 'hidden'} ($${pay.cash.combo}), Air row ${pay.cash.air > 0 ? 'shown' : 'hidden'} ($${pay.cash.air})`);
  check(pay.distance > 0, `${label}: distance ${pay.distance} m`);
  const after = await readSave(page);
  const expected = before.cash + pay.total + pay.extras.reduce((a, b) => a + b, 0);
  check(after.cash === expected, `${label}: save cash ${before.cash} → ${after.cash} (expected ${expected})`);
  check(after.records.runs === before.records.runs + 1, `${label}: runs counter incremented`);
  return { pay, after };
}

// Wrap game.start so the test can see what main.js passes (shake, bestDistance), and watch the HUD every
// frame: banners shown (kinds, never two at once), achievement toasts (one at a time, never started while a
// banner is up), altitude / combo badge seen, combo ring draining.
async function instrument(page) {
  await page.evaluate(() => {
    const g = window.__rampRage.game;
    window.__starts = window.__starts || [];
    if (g && !g.__wrapped) { const o = g.start; g.start = (opts) => { window.__starts.push({ shake: opts.shake, bestDistance: opts.bestDistance, track: opts.track.id }); return o(opts); }; g.__wrapped = true; }
    if (window.__mon) return;
    const m = window.__mon = { banners: [], achIds: [], achMax: 0, achOverBanner: 0, altSeen: 0, comboSeen: 0, comboMaxCount: 0, rampageSeen: false, ringDrain: false };
    let lastBanner = null, lastAch = new Set(), lastOff = null;
    const tick = () => {
      const b = document.querySelector('#banner');
      const bannerUp = b && !b.hidden;
      const kind = bannerUp ? b.dataset.kind : null;
      if (kind && kind !== lastBanner) m.banners.push(kind);
      lastBanner = kind;
      const ach = [...document.querySelectorAll('#toasts .toast.ach')];
      m.achMax = Math.max(m.achMax, ach.length);
      for (const t of ach) if (!lastAch.has(t)) { m.achIds.push(t.dataset.ach); if (bannerUp) m.achOverBanner++; }
      lastAch = new Set(ach);
      if (!document.querySelector('#hud-alt').hidden) m.altSeen++;
      const c = document.querySelector('#hud-combo');
      if (!c.hidden && !c.classList.contains('ended')) {
        m.comboSeen++;
        m.comboMaxCount = Math.max(m.comboMaxCount, Number(document.querySelector('#hud-combo-count').textContent) || 0);
        if (c.classList.contains('rampage')) m.rampageSeen = true;
        const off = parseFloat(document.querySelector('#hud-combo-ring').style.strokeDashoffset) || 0;
        if (lastOff !== null && off > lastOff + 1) m.ringDrain = true;
        lastOff = off;
      } else lastOff = null;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const resetMon = (page) => page.evaluate(() => Object.assign(window.__mon, { banners: [], achIds: [], achMax: 0, achOverBanner: 0, altSeen: 0, comboSeen: 0, comboMaxCount: 0, rampageSeen: false, ringDrain: false }));
const mon = (page) => page.evaluate(() => window.__mon);

async function waitShot(page, layout, sel, name, timeout = 8000) {
  try { await page.waitForSelector(sel, { timeout, state: 'attached' }); } catch (_) { check(false, `${name}: ${sel} appeared`); return false; }
  const file = path.join(SHOTS, `${layout.name}-${name}.png`);
  await page.screenshot({ path: file });
  return true;
}

// title hero is animated: two frames of the hero canvas differ
async function heroAnimates(page, label) {
  const a = await page.evaluate(() => document.querySelector('#hero').toDataURL());
  await page.waitForTimeout(300);
  const b = await page.evaluate(() => document.querySelector('#hero').toDataURL());
  check(a !== b && a.length > 2000, `${label}: title hero animates (canvas changed between frames)`);
}

async function runLayout(browser, layout) {
  console.log(`\n=== ${layout.name} ${layout.width}x${layout.height} ===`);
  const ctx = await browser.newContext({
    viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    ignoreHTTPSErrors: true,
  });
  await routeFonts(ctx);
  const errors = [];
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(({ save, insets }) => {
    if (!sessionStorage.getItem('smokeSeeded')) {
      localStorage.setItem('rampRage.save.v1', JSON.stringify(save));
      sessionStorage.setItem('smokeSeeded', '1');
    }
    // Chromium has no notch: emulate iPhone safe-area insets through the CSS tokens
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(s);
    });
  }, { save: SEED_SAVE, insets: layout.insets });

  await page.goto(BASE + '/index.html?mock=1&nosw=1', { waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-title'));
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await shot(page, layout, '01-title');
  await layoutAudit(page, layout.insets, 'title');
  // v1 → v2 save migration: nothing lost, new fields defaulted
  const migrated = await readSave(page);
  check(migrated.v === 2 && migrated.cash === 5000 && migrated.best.canyon === 120 && migrated.settings.shake === 100
    && migrated.achievements && Object.keys(migrated.achievements).length === 0 && migrated.records.bestCombo === 0,
    `v1 save migrated to v2 without loss (v${migrated.v}, cash ${migrated.cash}, best ${migrated.best.canyon}, shake ${migrated.settings.shake})`);
  await heroAnimates(page, 'title');
  await instrument(page);

  // garage + buy upgrade
  await page.click('#btn-play');
  await page.waitForSelector(visibleSel('#screen-garage'));
  await shot(page, layout, '02-garage');
  await layoutAudit(page, layout.insets, 'garage');
  let save = await readSave(page);
  const cost = Number((await page.textContent('[data-upgrade="engine"]')).replace(/\D/g, ''));
  await page.click('[data-upgrade="engine"]');
  let save2 = await readSave(page);
  check(save2.levels.beater.engine === 1 && save2.cash === save.cash - cost, `bought engine Lv1 for $${cost} (cash ${save.cash} → ${save2.cash})`);
  check((await page.$$eval('#upgrades .up-row:first-of-type .pips i.on, #upgrades .up-row .pips i.on', (n) => n.length)) >= 1, 'pip lit after upgrade');
  await shot(page, layout, '03-garage-upgraded');
  await page.click('#car-next');
  await page.waitForTimeout(350);
  await shot(page, layout, '04-garage-locked-car');
  check(/Buy/.test(await page.textContent('#car-action')), 'unowned car shows BUY');
  await page.click('#car-prev');

  // track select
  await page.click('#btn-race');
  await page.waitForSelector(visibleSel('#screen-tracks'));
  await shot(page, layout, '05-tracks');
  await layoutAudit(page, layout.insets, 'tracks');
  check(await page.$eval('[data-track="city"]', (e) => e.classList.contains('locked')), 'city is locked at start');

  // run
  save = await readSave(page);
  await page.click('[data-track="canyon"]');
  await page.waitForSelector(visibleSel('#hud'));
  // first-run coach: shown once, holds the run until tapped, remembered in the save
  await page.waitForSelector(visibleSel('#coach'));
  await shot(page, layout, '05b-coach');
  await layoutAudit(page, layout.insets, 'coach');
  await page.click('#coach');
  check(await page.$eval('#coach', (e) => e.hidden) && (await readSave(page)).seen.coach === true, 'first-run coach dismissed by tap and saved');
  // multi-touch: hold GAS and NITRO with two different pointers
  await page.evaluate(() => {
    const fire = (sel, type, id) => document.querySelector(sel).dispatchEvent(new PointerEvent(type, { pointerId: id, bubbles: true, isPrimary: id === 11, pointerType: 'touch' }));
    fire('#ctl-gas', 'pointerdown', 11); fire('#ctl-nitro', 'pointerdown', 12);
  });
  const both = await page.evaluate(() => ['#ctl-gas', '#ctl-nitro'].every((s) => document.querySelector(s).classList.contains('is-down')));
  check(both, 'GAS + NITRO held simultaneously (two pointerIds)');
  await page.waitForTimeout(1600);
  await shot(page, layout, '06-run-hud');
  await layoutAudit(page, layout.insets, 'run HUD');
  const st0 = await page.evaluate(() => window.__starts.at(-1));
  check(st0 && st0.shake === 1 && st0.bestDistance === 120, `game.start got shake ${st0 && st0.shake} and bestDistance ${st0 && st0.bestDistance}`);
  await page.evaluate(() => {
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 12, bubbles: true }));
  });
  check(await page.evaluate(() => document.querySelector('#ctl-gas').classList.contains('is-down') && !document.querySelector('#ctl-nitro').classList.contains('is-down')),
    'releasing NITRO pointer keeps GAS held');
  await page.evaluate(() => window.dispatchEvent(new Event('touchcancel')));
  check(await page.evaluate(() => !document.querySelector('#ctl-gas').classList.contains('is-down')), 'touchcancel releases all controls');
  await page.keyboard.down('ArrowRight');
  check(await page.evaluate(() => document.querySelector('#ctl-gas').classList.contains('is-down')), 'keyboard → presses GAS');
  await page.keyboard.up('ArrowRight');

  // v2 HUD moments, in mock-timeline order
  await waitShot(page, layout, '#hud-alt:not([hidden])', '06a-altitude');
  await waitShot(page, layout, '#banner[data-kind="record"]:not([hidden])', '06b-banner-record');
  await waitShot(page, layout, '#banner[data-kind="bigair"]:not([hidden])', '06c-banner-bigair');
  await page.waitForFunction(() => document.querySelector('#hud-combo-count').textContent === '4' && !document.querySelector('#hud-combo').hidden, null, { timeout: 8000 }).catch(() => {});
  await shot(page, layout, '06d-combo');
  await layoutAudit(page, layout.insets, 'run HUD (combo)');
  await waitShot(page, layout, '#banner[data-kind="rejump"]:not([hidden])', '06e-banner-rejump');
  await waitShot(page, layout, '#hud-combo.ended:not([hidden])', '06f-combo-bonus');
  await waitShot(page, layout, '#toasts .toast.ach', '06g-achievement-toast', 6000);

  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 20000 });
  const m1 = await mon(page);
  check(m1.altSeen > 0, 'altitude readout shown while airborne');
  check(['record', 'bigair', 'rejump'].every((k) => m1.banners.includes(k)), `banners shown: ${m1.banners.join(', ')} (record, bigair, rejump)`);
  check(m1.comboSeen > 0 && m1.comboMaxCount === 4 && m1.ringDrain, `combo badge shown (max count ${m1.comboMaxCount}), ring drains`);
  check(m1.achIds.length > 0 && m1.achMax === 1 && m1.achOverBanner === 0,
    `achievement toasts ${m1.achIds.join(', ')}: one at a time (max ${m1.achMax}), none started over a banner (${m1.achOverBanner})`);
  // fireworks for NEW RECORD + rating stamp slam
  await page.waitForTimeout(500);
  check(await page.evaluate(() => !document.querySelector('#res-record').hidden && !document.querySelector('#res-fx').hidden), 'NEW RECORD shows fireworks');
  await shot(page, layout, '07a-results-fireworks');
  await page.waitForSelector('#res-stamp.slam:not([hidden])', { timeout: 3000 });
  const stamp = await page.evaluate(() => ({ shown: document.querySelector('#res-stamp').dataset.rating, rating: window.__rampRage.lastResult.summary.rating }));
  check(/^[SABCD]$/.test(stamp.shown) && stamp.shown === stamp.rating, `rating stamp ${stamp.shown} (summary.rating ${stamp.rating})`);
  await page.waitForTimeout(1300);
  await shot(page, layout, '07-results');
  await layoutAudit(page, layout.insets, 'results');
  await resultsFit(page, 'results');
  await payoutCheck(page, 'run 1', save);
  const tiles = await page.$$eval('#res-stats .stat', (n) => n.map((e) => e.dataset.stat));
  check((tiles.length === 6 || tiles.length === 8) && ['combo', 'altitude', 'targets', 'rejumps'].every((t) => tiles.includes(t)),
    `stat tiles tidy (${tiles.length}): ${tiles.join(', ')}`);
  const s1 = await readSave(page);
  check(s1.achievements.firstFlip > 0 && s1.achievements.firstBoom > 0, `achievements saved: ${Object.keys(s1.achievements).join(', ')}`);
  check(s1.records.bestCombo === 4 && s1.records.rings >= 1 && s1.records.explosions === 2 && s1.records.rejumps === 1, 'v2 records banked (bestCombo, rings, explosions, rejumps)');
  check(await page.$$eval('#res-callouts [data-ach]', (n) => n.length) === Math.min(4, await page.evaluate(() => window.__rampRage.lastResult.achievements.length)), 'results list the run\'s achievements');

  // retry → pause → end run
  save = await readSave(page);
  await page.click('#res-retry');
  await page.waitForSelector(visibleSel('#hud'));
  check(await page.$eval('#coach', (e) => e.hidden), 'coach not shown again');
  await page.waitForTimeout(1500);
  await page.click('#btn-pause');
  await page.waitForSelector(visibleSel('#panel-pause'));
  await shot(page, layout, '08-pause');
  await layoutAudit(page, layout.insets, 'pause');
  await page.click('#pause-end');
  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 5000 });
  await shot(page, layout, '09-results-ended');
  await payoutCheck(page, 'retry (ended early)', save);

  // menus
  await page.click('#res-garage');
  await page.waitForSelector(visibleSel('#screen-garage'));
  await page.click('#screen-garage [data-back]');
  await page.waitForSelector(visibleSel('#screen-title'));
  // achievements survive a reload; the title badge counts unseen ones
  const before = Object.keys((await readSave(page)).achievements).sort();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-title'));
  const after = Object.keys((await readSave(page)).achievements).sort();
  check(before.length > 0 && JSON.stringify(before) === JSON.stringify(after), `achievements persist across reload (${after.length})`);
  check(await page.evaluate((n) => !document.querySelector('#badge-ach').hidden && document.querySelector('#badge-ach').textContent === String(n), after.length), 'title Badges button shows the unseen count');
  await heroAnimates(page, 'title after reload');
  await instrument(page);
  for (const [n, panel] of [['10', 'daily'], ['11', 'goals'], ['12', 'records'], ['12b', 'achievements'], ['13', 'settings']]) {
    await page.click(`[data-open="${panel}"]`);
    await page.waitForSelector(visibleSel(`#panel-${panel}`));
    await shot(page, layout, `${n}-${panel}`);
    await layoutAudit(page, layout.insets, panel);
    if (panel === 'achievements') {
      const a = await page.evaluate(() => ({
        earned: [...document.querySelectorAll('.ach-card.earned')].map((e) => e.dataset.ach),
        locked: [...document.querySelectorAll('.ach-card.locked')].map((e) => e.querySelector('.ach-hint').textContent),
        count: document.querySelector('#ach-count').textContent,
      }));
      check(a.earned.length === after.length && a.earned.length + a.locked.length === 12 && a.locked.every((t) => t.length > 5),
        `achievements panel: ${a.count} earned, locked badges show hints`);
      check(await page.evaluate(() => document.querySelector('#badge-ach').hidden), 'opening the panel clears the title badge');
    }
    if (panel !== 'settings') await page.click(`#panel-${panel} [data-close]`);
  }
  // screen-shake slider: tap at ~25% of the track, then nudge with the keyboard; saved in settings
  const box = await page.locator('#set-shake').boundingBox();
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
  const tapped = (await readSave(page)).settings.shake;
  await page.focus('#set-shake');
  await page.keyboard.press('ArrowRight');
  const nudged = (await readSave(page)).settings.shake;
  check(tapped === 25 && nudged === 30, `shake slider saves (tap → ${tapped}, → key → ${nudged})`);
  await shot(page, layout, '13b-settings-shake');
  // reduced motion: the title hero holds a static pose and the shake slider is disabled
  await page.click('#set-motion');
  const rm = await page.evaluate(() => ({ hero: window.__rampRage.hero.mode, disabled: document.querySelector('#set-shake').disabled }));
  check(rm.hero === 'static' && rm.disabled, `reduced motion: hero ${rm.hero}, shake slider disabled ${rm.disabled}`);
  await page.click('#set-motion');
  check(await page.evaluate(() => window.__rampRage.hero.mode === 'anim'), 'motion back on: hero animates again');
  await instrument(page);   // toggling reduced motion recreates the game: re-wrap game.start
  // reset with in-page confirm
  await page.click('#reset-open');
  await page.waitForSelector('#reset-confirm:not([hidden])');
  await shot(page, layout, '14-reset-confirm');
  await page.click('#reset-yes');
  save = await readSave(page);
  check(save.cash === 0 && save.records.runs === 0 && save.levels.beater.engine === 0, 'reset progress wipes the save');
  await page.click('#panel-settings [data-close]');

  // daily challenge run
  save = await readSave(page);
  await page.click('[data-open="daily"]');
  await page.click('#daily-play');
  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 20000 });
  await page.waitForTimeout(300);
  await shot(page, layout, '15-results-daily');
  await layoutAudit(page, layout.insets, 'daily results');
  await resultsFit(page, 'daily results');
  await payoutCheck(page, 'daily', save);
  check(await page.$eval('#res-next', (e) => e.hidden), 'daily results hide Next track');
  const st1 = await page.evaluate(() => window.__starts.at(-1));
  check(st1 && st1.shake === 0.3 && st1.bestDistance === null, `daily run: game.start shake ${st1 && st1.shake}, bestDistance ${st1 && st1.bestDistance}`);

  // moon: orbit banner + altitude glow, and a scripted 13-hit chain → RAMPAGE ×4
  await page.evaluate(() => {
    const { app } = window.__rampRage;
    app.save.unlocked = ['canyon', 'city', 'desert', 'arctic', 'moon'];
    app.save.seen.coach = true;     // the reset above brought the first-run coach back
    app.persist();
    window.__mockScript = { rampage: true };
    app.startRun({ trackId: 'moon' });
  });
  await resetMon(page);
  await waitShot(page, layout, '#banner[data-kind="orbit"]:not([hidden])', '16a-banner-orbit');
  check(await page.evaluate(() => document.querySelector('#hud-alt').classList.contains('orbit')), 'altitude chip glows above 45 m');
  await waitShot(page, layout, '#banner[data-kind="rampage"]:not([hidden])', '16b-banner-rampage');
  await layoutAudit(page, layout.insets, 'run HUD (rampage)');
  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 20000 });
  const m2 = await mon(page);
  check(m2.rampageSeen && m2.comboMaxCount >= 13, `combo badge flashes RAMPAGE at ×4 (max count ${m2.comboMaxCount})`);
  await page.waitForTimeout(1700);
  await shot(page, layout, '16c-results-moon');
  await layoutAudit(page, layout.insets, 'moon results');
  await resultsFit(page, 'moon results');
  const s2 = await readSave(page);
  check(s2.achievements.orbit > 0 && s2.achievements.rampage > 0, 'orbit + rampage achievements earned');
  await page.evaluate(() => { window.__mockScript = null; });

  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

async function corruptBoot(browser) {
  console.log('\n=== corrupt save boot ===');
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('rampRage.save.v1', '{"cash": 12, "owned": [oops'));
  await page.goto(BASE + '/index.html?mock=1&nosw=1');
  await page.waitForSelector(visibleSel('#screen-title'));
  const save = await readSave(page);
  check(save && save.cash === 0 && errors.length === 0, 'corrupt save falls back to defaults without errors');
  await ctx.close();
}

const srv = await ensureServer();
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
try {
  for (const l of LAYOUTS) await runLayout(browser, l);
  await corruptBoot(browser);
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

// UI smoke test for the Ramp Rage shell (meta screens + mock engine).
//   cd car-jump && python3 -m http.server 8080 &      (the script starts one itself if needed)
//   SHOTS_DIR=/some/dir node tools/ui-smoke.mjs
// Walks title → garage → buy upgrade → track select → first-run coach → run → results (checks the cash math) → retry
// → pause/end run → daily → goals/records/settings → reset, at 844×390 and 390×844 (DPR 2) with
// simulated iPhone safe-area insets. Fails on console errors, horizontal overflow, controls under
// the home indicator, or tiny tap targets. Screenshots every screen.
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

const SEED_SAVE = { v: 1, cash: 5000, owned: ['beater'], selectedCar: 'beater', unlocked: ['canyon'] };

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
      if (el.closest('#backdrop, #toasts, #stage') || (el.closest('svg') && el.tagName !== 'svg')) continue;
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

async function shot(page, layout, name) {
  await page.waitForTimeout(250);
  const file = path.join(SHOTS, `${layout.name}-${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

const readSave = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('rampRage.save.v1')));
const visibleSel = (sel) => `${sel}:not([hidden])`;

async function payoutCheck(page, label, before) {
  const pay = await page.evaluate(() => {
    const val = (tr) => Number(tr.lastElementChild.textContent.replace(/[^0-9-]/g, ''));
    const rows = [...document.querySelectorAll('#res-pay tr')];
    const base = rows.filter((r) => ['distance', 'stunts', 'smashes', 'landing', 'bonus'].includes(r.dataset.pay)).map(val);
    const total = val(rows.find((r) => r.dataset.pay === 'total'));
    const extras = rows.filter((r) => r.dataset.pay === 'goal' || r.dataset.pay === 'daily').map(val);
    return { base, total, extras, distance: Number(document.querySelector('#res-distance').textContent.replace(/\D/g, '')) };
  });
  const sum = pay.base.reduce((a, b) => a + b, 0);
  check(pay.base.length >= 4 && sum === pay.total, `${label}: breakdown ${pay.base.join(' + ')} = ${sum} matches total ${pay.total}`);
  check(pay.distance > 0, `${label}: distance ${pay.distance} m`);
  const after = await readSave(page);
  const expected = before.cash + pay.total + pay.extras.reduce((a, b) => a + b, 0);
  check(after.cash === expected, `${label}: save cash ${before.cash} → ${after.cash} (expected ${expected})`);
  check(after.records.runs === before.records.runs + 1, `${label}: runs counter incremented`);
  return { pay, after };
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

  await page.goto(BASE + '/index.html?mock=1', { waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-title'));
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await shot(page, layout, '01-title');
  await layoutAudit(page, layout.insets, 'title');

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

  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 20000 });
  await page.waitForTimeout(400);
  await shot(page, layout, '07-results');
  await layoutAudit(page, layout.insets, 'results');
  await payoutCheck(page, 'run 1', save);

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
  for (const [n, panel] of [['10', 'daily'], ['11', 'goals'], ['12', 'records'], ['13', 'settings']]) {
    await page.click(`[data-open="${panel}"]`);
    await page.waitForSelector(visibleSel(`#panel-${panel}`));
    await shot(page, layout, `${n}-${panel}`);
    await layoutAudit(page, layout.insets, panel);
    if (panel !== 'settings') await page.click(`#panel-${panel} [data-close]`);
  }
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
  await payoutCheck(page, 'daily', save);
  check(await page.$eval('#res-next', (e) => e.hidden), 'daily results hide Next track');

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

// UI smoke test for Trail Blazer (v1: the trail-riding game, no math layer yet) on the mock engine.
//   node trail-blazer/tools/ui-smoke.mjs            (serves the REPO ROOT on :8080 itself if nothing listens there)
//   SHOTS_DIR=/some/dir BASE_URL=http://localhost:8080 node trail-blazer/tools/ui-smoke.mjs
// At 844×390 and 390×844 (DPR 2, touch, simulated iPhone safe-area insets, ?mock=1&nosw=1):
//   player picker (first screen, Learning Lab + Spell Jump links are same-origin) → Parents with no players (PIN set
//   twice, Family code tab first with Create / Join and the "own progress stays on this device" note, Players tab
//   "No players yet") → "+ New player" on the on-screen keyboard (the player lands in Spell Jump's family record via
//   profiles.js) → title → RIDE → trail select (Pine Ridge open, the rest locked) → the ride: first-ride coach, GAS,
//   the mock gets stuck → Winch (a 1 s pull, then game.winch(true)) → finish → results (cash rows add up to the
//   total, the total is what was banked, Pine Ridge finished, Granite Gap unlocked, Blaze Orange paint + decals) →
//   garage (an Engine upgrade buys and persists, the new paint equips and persists) → Granite Gap → pause (toggles,
//   End ride) → results "Ride over" → Parent Zone again (wrong PIN refused, right PIN; Options writes
//   trailBlazer.settings; Players renames through profiles.js) → reload: the player, cash, upgrades and trails persist.
// Every screen: no horizontal overflow, buttons ≥ 44 px and clear of the safe-area insets, no native inputs outside
// the Parent Zone, no links to another origin; no console errors. Screenshots of every state go to SHOTS_DIR.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const URL0 = BASE + '/trail-blazer/index.html?mock=1&nosw=1';
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'trail-blazer-ui-shots');
mkdirSync(SHOTS, { recursive: true });

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}
async function ensureServer() {
  const up = async () => { try { return (await fetch(BASE + '/trail-blazer/index.html')).ok; } catch (_) { return false; } };
  if (await up()) return null;
  const srv = spawn('python3', ['-m', 'http.server', '8080'], { cwd: repoRoot, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100));
  return srv;
}

const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

const LAYOUTS = [
  { name: 'landscape', width: 844, height: 390, insets: { t: 0, r: 47, b: 21, l: 47 } },
  { name: 'portrait', width: 390, height: 844, insets: { t: 47, r: 0, b: 34, l: 0 } },
];

async function routeFonts(ctx) {
  const cache = new Map();
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    const url = route.request().url();
    try {
      if (!cache.has(url)) cache.set(url, execSync(`curl -sSL --max-time 15 -A "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36" "${url}"`));
      await route.fulfill({ status: 200, body: cache.get(url), contentType: url.includes('googleapis') ? 'text/css' : 'font/ttf', headers: { 'access-control-allow-origin': '*' } });
    } catch (_) { await route.fulfill({ status: 200, body: '', contentType: 'text/css' }); }
  });
}

const J = (page, fn, arg) => page.evaluate(fn, arg);
const visibleSel = (sel) => `${sel}:not([hidden])`;
async function shot(page, layout, name, wait = 250) {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(SHOTS, `${layout.name}-${name}.png`) });
}
const playerId = (page) => J(page, () => window.__trailBlazer.app.currentPlayerId);
const readSave = (page) => J(page, () => JSON.parse(localStorage.getItem(`trailBlazer.${window.__trailBlazer.app.currentPlayerId}.save`)));
const family = (page) => J(page, () => JSON.parse(localStorage.getItem('spellJump.family')));

// layout + kid-proofing audit of what is on screen
async function audit(page, insets, label) {
  const r = await J(page, ({ insets }) => {
    const W = innerWidth, H = innerHeight, out = [];
    if (document.documentElement.scrollWidth > W + 1) out.push(`document scrollWidth ${document.documentElement.scrollWidth} > ${W}`);
    const visible = (el) => { if (el.closest('[hidden]')) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
    const inScroller = (el) => { for (let p = el.parentElement; p && p.id !== 'app'; p = p.parentElement) { const o = getComputedStyle(p); if (/(auto|scroll)/.test(o.overflowY + o.overflowX)) return p; } return null; };
    const desc = (el) => el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '') + (el.textContent ? ` "${el.textContent.trim().slice(0, 24)}"` : '');
    for (const el of document.querySelectorAll('#app *')) {
      if (el.closest('#backdrop, #toasts, #stage, #banner') || (el.closest('svg') && el.tagName !== 'svg')) continue;
      if (!visible(el)) continue;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (!inScroller(el) && (b.right > W + 1 || b.left < -1)) out.push(`h-overflow ${desc(el)} [${Math.round(b.left)}..${Math.round(b.right)}]`);
      if (!inScroller(el) && (b.bottom > H + 1 || b.top < -1)) out.push(`v-overflow ${desc(el)} [${Math.round(b.top)}..${Math.round(b.bottom)}]`);
      const cs = getComputedStyle(el);
      if (el.children.length === 0 && el.textContent.trim() && cs.overflow === 'hidden' && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') out.push(`clipped text ${desc(el)}`);
    }
    for (const b of document.querySelectorAll('#app button, #app a[href]')) {
      if (!visible(b)) continue;
      const q = b.getBoundingClientRect();
      if (!q.width) continue;
      const sc = inScroller(b);
      if (b.classList.contains('kb-key') ? (q.height < 44 || q.width < W * 0.07) : Math.min(q.width, q.height) < 44) out.push(`tap target ${Math.round(q.width)}x${Math.round(q.height)} ${desc(b)}`);
      if (!sc && q.bottom > H - insets.b + 1) out.push(`under home indicator ${desc(b)}`);
      if (!sc && (q.left < insets.l - 1 || q.right > W - insets.r + 1)) out.push(`inside side inset ${desc(b)}`);
      if (!sc && q.top < insets.t - 1) out.push(`under status bar ${desc(b)}`);
    }
    const natives = [...document.querySelectorAll('input, textarea, select, [contenteditable="true"]')].filter((e) => !e.closest('#pz'));
    const links = [...document.querySelectorAll('a[href]')].filter((a) => new URL(a.href, location.href).origin !== location.origin).map((a) => a.href);
    return { out, natives: natives.map(desc), links };
  }, { insets });
  check(r.out.length === 0, `${label}: layout clean (no overflow, targets ≥ 44 px, clear of insets)${r.out.length ? ' — ' + r.out.slice(0, 6).join('; ') : ''}`);
  check(r.natives.length === 0, `${label}: no native inputs outside the Parent Zone${r.natives.length ? ' — ' + r.natives.join(', ') : ''}`);
  check(r.links.length === 0, `${label}: no links to another origin${r.links.length ? ' — ' + r.links.join(', ') : ''}`);
}
async function pinIn(page, pin) { for (const d of pin) await page.click(`.pinpad [data-digit="${d}"]`); await page.waitForTimeout(220); }
async function results(page) {
  return J(page, () => {
    const rows = [...document.querySelectorAll('#res-pay tr[data-row]')].map((tr) => ({ key: tr.dataset.row, value: Number(tr.querySelector('[data-value]').dataset.value) }));
    const total = Number(document.querySelector('#res-total').dataset.value);
    const callouts = [...document.querySelectorAll('#res-callouts [data-callout]')].map((c) => c.dataset.callout + (c.dataset.paint ? ':' + c.dataset.paint : c.dataset.decals ? ':' + c.dataset.decals : ''));
    return { rows, total, callouts, title: document.querySelector('#res-title').textContent, next: !document.querySelector('#res-next').hidden, last: window.__trailBlazer.lastResult };
  });
}

async function runLayout(browser, layout) {
  console.log(`\n=== ${layout.name} ${layout.width}x${layout.height} ===`);
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await routeFonts(ctx);
  const errors = [];
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(({ insets }) => {
    if (!sessionStorage.getItem('tbSmokeSeeded')) { localStorage.clear(); sessionStorage.setItem('tbSmokeSeeded', '1'); }
    window.__mockScript = { stuck: true };
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(s);
    });
  }, { insets: layout.insets });
  await page.goto(URL0, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts && document.fonts.ready);

  // ---------- player picker ----------
  await page.waitForSelector(visibleSel('#screen-players'));
  await shot(page, layout, '01-players');
  await audit(page, layout.insets, 'player picker');
  const pick = await J(page, () => ({
    tiles: document.querySelectorAll('[data-player]').length, add: !!document.querySelector('#pl-add'),
    home: document.querySelector('#btn-home').href, homeShown: !document.querySelector('#btn-home').hidden, sj: document.querySelector('#btn-spelljump').href,
    origin: location.origin,
  }));
  check(pick.tiles === 0 && pick.add, 'picker is the first screen, with "+ New player"');
  check(pick.homeShown && pick.home === pick.origin + '/' && pick.sj === pick.origin + '/spell-jump/', `Learning Lab (${pick.home}) and Spell Jump (${pick.sj}) links, same origin`);

  // ---------- Parents before any player: set the shared PIN ----------
  await page.click('#btn-parents-picker');
  await page.waitForSelector(visibleSel('#pz'));
  check(await J(page, () => document.querySelector('[data-pin-mode]').dataset.pinMode === 'set'), 'Parents: no PIN yet → "Choose a 4-digit PIN"');
  await pinIn(page, '1234');
  await pinIn(page, '1234');
  await page.waitForSelector('.pz-content[data-tab="sync"]');
  const pz0 = await J(page, () => ({
    tabs: [...document.querySelectorAll('.pz-tabs [data-tab]')].map((t) => t.dataset.tab), create: !!document.querySelector('#sync-create'), join: !!document.querySelector('#sync-join-input'),
    note: (document.querySelector('#pz-save-note') || {}).textContent || '', line: (document.querySelector('#pz-sync-line') || {}).textContent || '',
    pin: (JSON.parse(localStorage.getItem('spellJump.family')) || {}).pinHash,
  }));
  check(pz0.tabs.join(',') === 'sync,options,players', `Parent Zone tabs: Family code · Options · Players (${pz0.tabs.join(', ')})`);
  check(pz0.create && pz0.join, 'Family code tab opens first, with Create family code / Join');
  check(/stays on this device/.test(pz0.note), 'Family code tab says Trail Blazer progress stays on this device (v1)');
  check(!!pz0.pin, "the PIN is stored in Spell Jump's family record (spellJump.family.pinHash)");
  await shot(page, layout, '02-pz-family');
  await audit(page, layout.insets, 'Parent Zone (Family code)');
  await page.click('.pz-tabs [data-tab="players"]');
  check(await J(page, () => !!document.querySelector('#pz-noplayer')), 'Players tab: "No players yet" before anyone is added');
  await page.click('#pz-close');

  // ---------- new player ----------
  await page.click('#pl-add');
  await page.waitForSelector(visibleSel('#screen-newplayer'));
  for (const ch of 'mia') await page.tap(`#np-keyboard [data-key="${ch}"]`);
  await shot(page, layout, '03-newplayer');
  await audit(page, layout.insets, 'new player');
  await page.tap('#np-keyboard [data-key="enter"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  const fam = await family(page);
  check(fam && fam.players.length === 1 && fam.players[0].name === 'Mia', "the new player is in Spell Jump's family record (spellJump.family)");
  const pid = await playerId(page);
  check(pid === fam.players[0].id, 'the new player is the current player');
  await page.waitForTimeout(300);
  await shot(page, layout, '04-title');
  await audit(page, layout.insets, 'title');
  check(await J(page, () => document.querySelector('#title-trails-text').textContent === 'Trails 0 / 6'), 'title: "Trails 0 / 6"');

  // ---------- trail select ----------
  await page.click('#btn-ride');
  await page.waitForSelector(visibleSel('#screen-trails'));
  const cards = await J(page, () => [...document.querySelectorAll('[data-trail]')].map((c) => ({ id: c.dataset.trail, locked: c.classList.contains('locked') })));
  check(cards.length === 6 && !cards[0].locked && cards.slice(1).every((c) => c.locked), `trail select: 6 trails, ${cards[0] && cards[0].id} open, the rest locked`);
  await shot(page, layout, '05-trails');
  await audit(page, layout.insets, 'trail select');
  await page.click(`[data-trail="${cards[1].id}"]`);
  await page.waitForTimeout(150);
  check(await J(page, () => window.__trailBlazer.screen === 'trails'), 'a locked trail does not start');

  // ---------- the ride ----------
  await J(page, () => {
    const g = window.__trailBlazer.game;
    window.__starts = []; window.__winches = [];
    const s = g.start; g.start = (cfg) => { window.__starts.push({ trail: cfg.trail.id, gates: cfg.gates, paint: cfg.paint, decal: cfg.decal, stats: cfg.stats }); return s(cfg); };
    const w = g.winch; g.winch = (ok) => { window.__winches.push({ ok, at: performance.now() }); return w(ok); };
  });
  await page.click('[data-trail="pine-ridge"]');
  await page.waitForFunction(() => window.__trailBlazer.screen === 'ride');
  const st = await J(page, () => window.__starts[0]);
  check(st && st.trail === 'pine-ridge' && st.gates === 0 && st.paint === 'sage' && st.stats && st.stats.power === 1, `ride starts Pine Ridge with gates: 0, stock paint, level-0 stats (${JSON.stringify(st && { gates: st.gates, paint: st.paint })})`);
  await page.waitForSelector(visibleSel('#coach'));
  await shot(page, layout, '06-coach');
  await page.click('#coach');
  check(await J(page, () => !window.__trailBlazer.coaching && document.querySelector('#coach').hidden), 'the first-ride coach goes away on a tap');
  await audit(page, layout.insets, 'ride HUD + controls');
  // GAS: touch the button (pointer events) and hold it
  const gas = await page.$('#ctl-gas');
  const gb = await gas.boundingBox();
  await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.up();
  await page.waitForTimeout(1500);
  await shot(page, layout, '07-ride');
  const s1 = await J(page, () => window.__trailBlazer.game.getState());
  check(s1 && s1.phase === 'ride' && s1.distance > 0, `GAS launches the ride (phase ${s1 && s1.phase}, ${s1 && Math.round(s1.distance)} m)`);
  check(await J(page, () => Number(document.querySelector('#hud-distance').textContent.replace(/,/g, '')) > 0), 'HUD distance counts up');
  await page.waitForSelector(visibleSel('#btn-winch'), { timeout: 9000 });
  await shot(page, layout, '08-stuck-winch');
  await audit(page, layout.insets, 'stuck: Winch button');
  const t0 = await J(page, () => performance.now());
  await page.click('#btn-winch');
  check(await J(page, () => document.querySelector('#btn-winch').classList.contains('pulling') && window.__winches.length === 0), 'Winch: a pull animation first, no winch yet');
  await page.waitForFunction(() => window.__winches.length > 0, null, { timeout: 3000 });
  const wch = await J(page, () => window.__winches[0]);
  check(wch.ok === true && wch.at - t0 >= 900, `then game.winch(true) after the 1 s pull (${Math.round(wch.at - t0)} ms)`);
  await page.waitForFunction(() => document.querySelector('#btn-winch').hidden, null, { timeout: 2000 });
  check(true, 'the Winch button hides once the Ranger is winched');

  // ---------- results ----------
  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 15000 });
  await page.waitForTimeout(1500);
  const res = await results(page);
  const sum = res.rows.reduce((a, r) => a + r.value, 0);
  check(res.rows.length >= 4 && sum === res.total && res.total === res.last.summary.cash.total, `results: cash rows add up (${res.rows.map((r) => `${r.key} ${r.value}`).join(' + ')} = ${sum}, total ${res.total})`);
  check(res.title === 'Pine Ridge finished!', `results title "${res.title}"`);
  const save1 = await readSave(page);
  check(save1.cash === res.total, `banked: save cash ${save1.cash} = ride total ${res.total}`);
  check(save1.finished['pine-ridge'] === 1 && save1.best['pine-ridge'] === 600, 'Pine Ridge finished and its best distance saved');
  check(res.callouts.includes('unlock') && res.callouts.includes('paint:orange') && res.callouts.includes('decal:mud flames'), `callouts: ${res.callouts.join(', ')}`);
  check(res.next, '"Next trail" offered');
  check(await J(page, () => !!document.querySelector('#res-stamp:not([hidden]) b')), 'rating stamp shows');
  await shot(page, layout, '09-results');
  await audit(page, layout.insets, 'results');

  // ---------- garage ----------
  await page.click('#res-garage');
  await page.waitForSelector(visibleSel('#screen-garage'));
  await page.waitForTimeout(300);
  await shot(page, layout, '10-garage');
  await audit(page, layout.insets, 'garage');
  const cash0 = (await readSave(page)).cash;
  await page.click('[data-upgrade="engine"]');
  const save2 = await readSave(page);
  check(save2.levels.engine === 1 && save2.cash === cash0 - 300, `Engine upgrade: level 1 for $300 (cash ${cash0} → ${save2.cash}), saved`);
  check(await J(page, () => document.querySelector('[data-row="engine"] [data-level]').dataset.level === '1'), 'garage shows Engine Lv 1');
  await page.click('.style-chip[data-paint="orange"]');
  check((await readSave(page)).paint === 'orange', 'Blaze Orange paint equips and is saved');
  await page.click('[data-style-tab="decal"]');
  await page.click('.style-chip[data-decal="flames"]');
  check((await readSave(page)).decal === 'flames', 'Flames decal equips and is saved');
  const lockedDecal = await J(page, () => document.querySelector('.style-chip[data-decal="stars"]').classList.contains('locked'));
  check(lockedDecal, 'Stars decal still locked (needs a 1,000 m ride)');
  await shot(page, layout, '11-garage-after');

  // ---------- second trail: pause → End ride ----------
  await page.click('#btn-garage-ride');
  await page.waitForSelector(visibleSel('#screen-trails'));
  check(await J(page, () => !document.querySelector('[data-trail="granite-gap"]').classList.contains('locked')), 'Granite Gap is unlocked now');
  await J(page, () => { window.__mockScript = { short: true }; });
  await page.click('[data-trail="granite-gap"]');
  await page.waitForFunction(() => window.__trailBlazer.screen === 'ride');
  const st2 = await J(page, () => window.__starts[window.__starts.length - 1]);
  check(st2.trail === 'granite-gap' && st2.paint === 'orange' && st2.decal === 'flames' && st2.stats.power > 1, `ride 2 uses the new paint, decal and Engine level (power ${st2.stats.power})`);
  check(await J(page, () => document.querySelector('#coach').hidden), 'no coach on the second ride');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowRight');
  await page.click('#btn-pause');
  await page.waitForSelector(visibleSel('#panel-pause'));
  await shot(page, layout, '12-pause');
  await audit(page, layout.insets, 'pause');
  await page.click('#pause-sound');
  check(await J(page, () => JSON.parse(localStorage.getItem('trailBlazer.settings')).sound === false), 'pause: Sound off is saved in trailBlazer.settings');
  await page.click('#pause-sound');
  await page.click('#pause-end');
  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 5000 });
  await page.waitForTimeout(1300);
  const res2 = await results(page);
  const sum2 = res2.rows.reduce((a, r) => a + r.value, 0);
  check(res2.title === 'Ride over' && sum2 === res2.total, `End ride → "${res2.title}", rows add up (${sum2} = ${res2.total})`);
  const save3 = await readSave(page);
  check(save3.cash === save2.cash + res2.total && !save3.finished['granite-gap'], `banked ${res2.total} (cash ${save3.cash}); Granite Gap not finished`);
  await shot(page, layout, '13-results-ended');

  // ---------- Parent Zone from the title ----------
  await page.click('#res-garage');
  await page.click('[data-back="title"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  check(await J(page, () => document.querySelector('#title-trails-text').textContent === 'Trails 1 / 6'), 'title: "Trails 1 / 6"');
  await shot(page, layout, '14-title-after');
  await J(page, () => window.__trailBlazer.pz.lock());
  await page.click('#btn-parents');
  await page.waitForSelector(visibleSel('#pz'));
  await pinIn(page, '0000');
  check(await J(page, () => !!document.querySelector('#pin-err')), 'a wrong PIN is refused');
  await pinIn(page, '1234');
  await page.waitForSelector('.pz-content[data-tab="sync"]');
  check(true, 'the shared PIN opens the Parent Zone');
  await page.click('.pz-tabs [data-tab="options"]');
  await shot(page, layout, '15-pz-options');
  await audit(page, layout.insets, 'Parent Zone (Options)');
  await page.click('#opt-music');
  check(await J(page, () => JSON.parse(localStorage.getItem('trailBlazer.settings')).music === false), 'Options: Music off is saved in trailBlazer.settings');
  await page.click('#opt-music');
  await page.click('.pz-tabs [data-tab="players"]');
  await page.fill(`#pz-name-${pid}`, 'Mia B');
  await page.click(`[data-rename="${pid}"]`);
  const fam2 = await family(page);
  check(fam2.players[0].name === 'Mia B', 'Players: rename goes to the family record (profiles.renamePlayer)');
  check(await J(page, () => /1 of 6 trails/.test(document.querySelector('.pz-player .sub').textContent)), 'Players: shows trails finished on this device');
  await shot(page, layout, '16-pz-players');
  await audit(page, layout.insets, 'Parent Zone (Players)');
  await page.click('#pz-close');

  // ---------- reload persistence ----------
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  const tile = await J(page, (id) => { const t = document.querySelector(`[data-player="${id}"]`); return t && { name: t.querySelector('.pl-name').textContent, trails: t.querySelector('[data-trails]').dataset.trails }; }, pid);
  check(tile && tile.name === 'Mia B' && tile.trails === '1', `after a reload the picker shows ${tile && tile.name} with 1 trail finished`);
  await shot(page, layout, '17-players-reload');
  await page.click(`[data-player="${pid}"]`);
  await page.waitForSelector(visibleSel('#screen-title'));
  const save4 = await readSave(page);
  check(save4.cash === save3.cash && save4.levels.engine === 1 && save4.paint === 'orange', `progress persists (cash ${save4.cash}, Engine ${save4.levels.engine}, paint ${save4.paint})`);
  check(await J(page, () => !!localStorage.getItem('trailBlazer.' + window.__trailBlazer.app.currentPlayerId + '.save') && !Object.keys(localStorage).some((k) => /^spellJump\.[^.]+\.save$/.test(k))), 'Trail Blazer writes only its own save key (no spellJump.<id>.save)');

  check(errors.length === 0, `no console errors${errors.length ? ' — ' + errors.slice(0, 4).join(' | ') : ''}`);
  await ctx.close();
}

const srv = await ensureServer();
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
try {
  for (const layout of LAYOUTS) await runLayout(browser, layout);
} catch (e) {
  failures.push('crashed: ' + (e && e.stack || e));
  console.error(e);
} finally {
  await browser.close();
  if (srv) srv.kill();
}
console.log(`\nScreenshots: ${SHOTS}`);
if (failures.length) { console.log(`\n${failures.length} FAILED:\n - ${failures.join('\n - ')}`); process.exit(1); }
console.log('\nui-smoke: all checks passed');

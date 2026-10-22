// UI smoke test for Trail Blazer (v1.2: races with Math Gates) on the mock engine.
//   node trail-blazer/tools/ui-smoke.mjs            (serves the REPO ROOT on :8080 itself if nothing listens there)
//   SHOTS_DIR=/some/dir BASE_URL=http://localhost:8080 node trail-blazer/tools/ui-smoke.mjs
// At 844×390 and 390×844 (DPR 2, touch, simulated iPhone safe-area insets, ?mock=1&nosw=1):
//   player picker (first screen; Learning Lab + Spell Jump links same-origin) → Parents with no players (PIN set twice,
//   Family code tab first, the "one family code syncs both games" note, Players "No players yet") → "+ New player" on
//   the on-screen keyboard (lands in Spell Jump's family record via profiles.js) → title (RACE, "Tracks 0 / 6") →
//   track select (Pine Ridge open, the rest locked) → race 1 (4 Math Gates): gate 1 freezes the race, the fact is read
//   aloud, a right answer → "⚡ Quick!" → openGate({ correct, quick }); gate 2: a wrong answer → the fact with its answer
//   and a hint (read aloud) → covered → a wrong copy → shown again → the copy → "Fixed it!" → openGate({ fixed }); the
//   coach, the 3-2-1 countdown and GO!, the HUD (place
//   badge, timer, 4 rider dots, no Winch), Backflip / Big air / Perfect banners, CRASH! + "Back on track!", position
//   changes → podium results (2nd: "Podium!", the podium, cash rows incl. flips / perfect / position bonus add up to the
//   banked total, medal + best time saved, Granite Gap unlocked, paint + decal callouts) → garage (an Engine upgrade
//   buys and persists; the finish and medal paints and the 250 m decal unlock; Flames waits for 10 flips) → track cards
//   show the medal + best time → race 2 (pause stops the clock, resume, 4th: "Race over", no position bonus, the next
//   track stays locked) → race 3 (End race: DNF) → Parent Zone again (wrong PIN refused; Options writes
//   trailBlazer.settings; Players renames via profiles.js) → reload: player, cash, upgrades, paint and medal persist.
//   Math: results list the race's facts (⚡ / ✓ / ↻), the HUD and the title count the daily mission, the Fact Grid (×
//   and ÷ views, statuses, tap to hear), Parent Zone Facts this week (families, ÷, + and −, custom lines with a bad line
//   reported), Options (math gates per race, facts aloud, voice), Report (+ Copy report), and the facts data persist.
// v1.5 (The Season): the race starts with the rival trio (names, vehicles) and the vehicle; a crate opens on the
//   results (tap: shake, burst, NEW! or +$); the Garage Wall counts what was won; buying the Dune Quad in the garage's
//   Vehicles row; upgrades per vehicle (the Quad's cost × 1.6, the Ranger keeps its levels); the Cups screen (3 tabs);
//   the streak flame and the daily Pit Challenge card on the title (a daily race: the mutator, ×2 cash, a bronze
//   crate); a championship weekend (3 races, standings between them) to the cup podium with the gold trophy, stars
//   on the results and the trail card; the Parent Zone Report's play line; a v2 save migrates to v3.
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
// the Gate panel: the fact on screen, its answer, the panel state (tests read the answer from the panel)
const gate = (page) => J(page, () => { const g = window.__trailBlazer.gatePanel; return { open: g.isOpen, state: g.state, fact: g.fact, flip: g.flip, answer: g.answer,
  q: document.querySelector('#gp-q').textContent, tiles: document.querySelector('#gp-tiles').textContent, msg: document.querySelector('#gp-msg').textContent,
  hint: document.querySelector('#gp-hint').hidden ? '' : document.querySelector('#gp-hint').textContent, html: document.documentElement.classList.contains('math') }; });
async function typeAnswer(page, value) {
  for (const ch of String(value)) await page.tap(`#gate .np-key[data-key="${ch}"]`);
  await page.tap('#gate .np-key[data-key="go"]');
}
const waitGate = (page, timeout = 15000) => page.waitForFunction(() => window.__trailBlazer.gatePanel.isOpen && window.__trailBlazer.gatePanel.state === 'ask', null, { timeout });
// answer every gate right until the results show up
async function raceToResults(page, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const st = await J(page, () => { const g = window.__trailBlazer.gate; return { results: window.__trailBlazer.screen === 'results', gate: g.open && g.state === 'ask', answer: g.answer, index: g.index }; });
    if (st.results) return true;
    if (st.gate) {
      await typeAnswer(page, st.answer);
      // closed, or the answer was taken (the next gate can open in the same frame)
      await page.waitForFunction((i) => !window.__trailBlazer.gatePanel.isOpen || window.__trailBlazer.gate.index > i, st.index, { timeout: 4000 }).catch(async (e) => {
        await page.screenshot({ path: path.join(SHOTS, 'debug-gate.png') });
        console.log('  gate did not close:', JSON.stringify(await J(page, () => ({ screen: window.__trailBlazer.screen, gate: window.__trailBlazer.gate, msg: document.querySelector('#gp-msg').textContent, top: (() => { const k = document.querySelector('#gate .np-key[data-key="4"]'); const r = k.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && (e.id || e.className); })(), active: document.activeElement && document.activeElement.id, tiles: document.querySelector('#gp-tiles').textContent }))));
        throw e;
      });
    } else await page.waitForTimeout(120);
  }
  return false;
}
async function pinIn(page, pin) { for (const d of pin) await page.click(`.pinpad [data-digit="${d}"]`); await page.waitForTimeout(220); }
async function results(page) {
  return J(page, () => {
    const rows = [...document.querySelectorAll('#res-pay tr[data-row]')].map((tr) => ({ key: tr.dataset.row, value: Number(tr.querySelector('[data-value]').dataset.value) }));
    const total = Number(document.querySelector('#res-total').dataset.value);
    const callouts = [...document.querySelectorAll('#res-callouts [data-callout]')].map((c) => c.dataset.callout + (c.dataset.paint ? ':' + c.dataset.paint : c.dataset.decals ? ':' + c.dataset.decals : ''));
    const podium = [...document.querySelectorAll('#res-podium .pod')].map((p) => ({ place: p.dataset.place, name: p.dataset.name, me: p.classList.contains('me') }));
    const medalEl = document.querySelector('#res-medal');
    return { rows, total, callouts, podium, medal: medalEl.hidden ? null : medalEl.dataset.medal, time: document.querySelector('#res-time').textContent,
      title: document.querySelector('#res-title').textContent, next: !document.querySelector('#res-next').hidden, last: window.__trailBlazer.lastResult };
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
    window.__mockScript = {};
    // headless Chromium has no voices: a fake speechSynthesis records every utterance (Spell Jump's tts.js test hook)
    window.__spoken = [];
    window.__ttsBackend = {
      speaking: false, pending: false,
      getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); },
      cancel() {}, addEventListener() {},
    };
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
  check(pz0.tabs.join(',') === 'sync,facts,options,report,players', `Parent Zone tabs: Family code · Facts this week · Options · Report · Players (${pz0.tabs.join(', ')})`);
  check(pz0.create && pz0.join, 'Family code tab opens first, with Create family code / Join');
  check(/One family code syncs both games/.test(pz0.note) && /Trail Blazer progress/.test(pz0.note), 'Family code tab: one code syncs both games, Trail Blazer progress included (v1.6)');
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
  await page.waitForTimeout(150);
  check(await J(page, () => document.querySelector('#pz').hidden), 'tapping Done does not click through to the title (no ghost click on Parents)');
  const fam = await family(page);
  check(fam && fam.players.length === 1 && fam.players[0].name === 'Mia', "the new player is in Spell Jump's family record (spellJump.family)");
  const pid = await playerId(page);
  check(pid === fam.players[0].id, 'the new player is the current player');
  await page.waitForTimeout(300);
  await shot(page, layout, '04-title');
  await audit(page, layout.insets, 'title');
  check(await J(page, () => document.querySelector('#title-trails-text').textContent === 'Rookie Cup: 0 / 6 · 0 ★' && /race/i.test(document.querySelector('#btn-ride').textContent)), 'title: "Rookie Cup: 0 / 6 · 0 ★" and a RACE button');
  const t0 = await J(page, () => ({ days: document.querySelector('#title-streak').dataset.days, lit: document.querySelector('#title-streak').classList.contains('lit'), daily: document.querySelector('#title-daily-text').textContent, shown: !document.querySelector('#title-daily').hidden }));
  check(t0.days === '0' && !t0.lit, 'title: the streak flame is out before the first race (0 days)');
  check(t0.shown && /^Today: .+ on Pine Ridge · ×2 cash$/.test(t0.daily), `title: the daily Pit Challenge card ("${t0.daily}")`);
  // a v2 save (one vehicle, top-level upgrade levels) migrates to v3: the Ranger owned with those levels, the rest empty
  const mig = await J(page, async () => {
    const S = await import('/trail-blazer/src/meta/save.js');
    localStorage.setItem('trailBlazer.legacy.save', JSON.stringify({ v: 2, cash: 4321, levels: { engine: 3, tires: 1, suspension: 0, boost: 2 }, paint: 'orange', decal: 'mud', best: { 'pine-ridge': 600 },
      bestPlace: { 'pine-ridge': 1 }, bestTime: { 'pine-ridge': 41.2 }, medals: { 'pine-ridge': 'gold' }, finished: { 'pine-ridge': 2 }, records: { rides: 5, wins: 1 }, seen: { coach: true } }));
    const m = S.loadSave('legacy');
    localStorage.removeItem('trailBlazer.legacy.save');
    return { v: m.v, cash: m.cash, vehicle: m.vehicle, ranger: m.vehicles.ranger150, n: Object.keys(m.vehicles).length, levels: 'levels' in m, cups: m.cups, stars: m.stars, crates: m.crates.queue.length,
      eq: m.cosmetics.equipped, streak: !!m.streak, rivals: m.rivals.retired.length, ghosts: m.ghosts, daily: m.daily.day, paint: m.paint, medal: m.medals['pine-ridge'] };
  });
  check(mig.v === 3 && mig.cash === 4321 && mig.vehicle === 'ranger150' && mig.ranger.owned && mig.ranger.levels.engine === 3 && mig.ranger.levels.boost === 2 && mig.n === 1 && !mig.levels
    && !Object.keys(mig.cups).length && !Object.keys(mig.stars).length && mig.crates === 0 && mig.eq.helmet === 'classic' && mig.streak && mig.rivals === 0 && !Object.keys(mig.ghosts).length && mig.daily === ''
    && mig.paint === 'orange' && mig.medal === 'gold', `a v2 save migrates to v3 (Ranger owned with Engine ${mig.ranger.levels.engine} / Boost ${mig.ranger.levels.boost}, cash, paint and medals kept; cups, stars, crates, gear, ghosts empty)`);

  // ---------- track select ----------
  await page.click('#btn-ride');
  await page.waitForSelector(visibleSel('#screen-trails'));
  const cards = await J(page, () => [...document.querySelectorAll('#trail-grid [data-trail]')].map((c) => ({ id: c.dataset.trail, locked: c.classList.contains('locked'), num: c.querySelector('.trail-num').textContent, stars: c.querySelectorAll('.stars i').length })));
  check(cards.length === 6 && !cards[0].locked && cards.slice(1).every((c) => c.locked), `Cups → Rookie Cup: 6 trails, ${cards[0] && cards[0].id} open, the rest locked`);
  check(cards[0].num === 'Trail 1' && cards.every((c) => c.stars === 3), `cards say "Trail 1" and show 3 stars each (${cards[0].num})`);
  const tabs = await J(page, () => [...document.querySelectorAll('#cup-tabs [data-cup]')].map((t) => t.dataset.cup + (t.classList.contains('locked') ? ':locked' : '')));
  check(tabs.join(',') === 'rookie,pro:locked,legend:locked', `Cups screen: 3 tabs, Pro and Legend locked (${tabs.join(', ')})`);
  check(await J(page, () => document.querySelector('#cup-race').dataset.ready === 'false' && /1 \/ 6 open/.test(document.querySelector('#cup-race').textContent)), '"Race the cup" waits until every Rookie trail is open (1 / 6 open)');
  await shot(page, layout, '05-cups');
  await audit(page, layout.insets, 'Cups');
  await page.click('#cup-tabs [data-cup="pro"]');
  check(await J(page, () => /^Pro Cup: a Rookie trophy \+ 12 ★ · trophy — · 0 \/ 12 ★$/.test(document.querySelector('.ch-lock').textContent) && document.querySelectorAll('#trail-grid [data-trail].locked').length === 6), 'the Pro Cup tab: locked ("Pro Cup: a Rookie trophy + 12 ★ · trophy — · 0 / 12 ★"), its 6 trails locked');
  await page.click('#cup-tabs [data-cup="rookie"]');
  await page.click(`[data-trail="${cards[1].id}"]`);
  await page.waitForTimeout(150);
  check(await J(page, () => window.__trailBlazer.screen === 'trails'), 'a locked track does not start');

  // ---------- race 1: Pine Ridge, countdown → GO → backflip → crash + respawn → 2nd ----------
  await J(page, () => {
    const g = window.__trailBlazer.game;
    window.__starts = [];
    const s = g.start; g.start = (cfg) => { window.__starts.push({ trail: cfg.trail.id, gates: cfg.gates, paint: cfg.paint, decal: cfg.decal, stats: cfg.stats, race: cfg.race, vehicle: cfg.vehicle, look: cfg.look, mutator: cfg.mutator, ghost: cfg.ghost ? cfg.ghost.length : 0 }); return s(cfg); };
    window.__opened = [];
    const o = g.openGate; g.openGate = (res) => { window.__opened.push({ ...res, timeAt: g.getState().timeSec }); return o(res); };
    // what the player sees: countdown numbers, banners, position badge values (in order)
    window.__seen = { counts: [], banners: [], places: [] };
    const watch = (sel, key) => new MutationObserver(() => { const el = document.querySelector(sel); const t = el.textContent.trim(); const arr = window.__seen[key]; if (t && arr[arr.length - 1] !== t) arr.push(t); })
      .observe(document.querySelector(sel), { childList: true, characterData: true, subtree: true });
    watch('#countdown-n', 'counts'); watch('#banner-text', 'banners'); watch('#hud-place', 'places');
  });
  await page.click('[data-trail="pine-ridge"]');
  // ---------- v1.4: the Pit Crew Check comes first: a card before the first race (Start · Race first) ----------
  await page.waitForSelector('#pit-offer:not([hidden])', { timeout: 4000 });
  const card1 = await J(page, () => ({ text: document.querySelector('#pit-offer').textContent.replace(/\s+/g, ' ').trim(), kind: document.querySelector('#pit-offer').dataset.kind, screen: window.__trailBlazer.screen }));
  check(card1.kind === 'first' && /Before your first race, the pit crew checks what you've got\. About 15 quick facts\./.test(card1.text) && /Start/.test(card1.text) && /Race first/.test(card1.text)
    && !/\btest|grade|score/i.test(card1.text) && card1.screen !== 'ride', `a new player tapping a track gets the Pit Crew Check card first ("${card1.text}")`);
  await shot(page, layout, '05b-pit-card', 400);
  await audit(page, layout.insets, 'Pit Crew Check card');
  await page.click('#pit-later');
  await page.waitForFunction(() => window.__trailBlazer.screen === 'ride');
  const st = await J(page, () => window.__starts[0]);
  check(st && st.trail === 'pine-ridge' && st.gates === 4 && st.race && Array.isArray(st.race.riders) && st.race.riders.length === 3 && st.race.name === 'Mia' && st.paint === 'sage',
    `race starts Pine Ridge with 4 Math Gates (the default), race: { riders: [3], name }, stock paint (gates ${st && st.gates})`);
  check(st.vehicle === 'ranger150' && st.race.riders.map((x) => x.name).join(',') === 'Dusty,Blaze,Nitro' && st.race.riders.every((x) => x.vehicle && x.paint && x.helmet) && st.look && st.look.helmet === 'classic' && st.stats.coinMult === 1 && !st.mutator,
    `v1.5: the Ranger, the rival trio (${st.race.riders.map((x) => `${x.name} in the ${x.vehicle}`).join(', ')}), the rider's look, Rookie Cup ×1 cash, no mutator`);
  await page.waitForSelector(visibleSel('#coach'));
  check(await J(page, () => /backflip/i.test(document.querySelector('#coach').textContent) && /downslope/i.test(document.querySelector('#coach').textContent)), 'coach: GAS to go, BRAKE = backflip, land on the downslope');
  await shot(page, layout, '06-coach');
  await page.click('#coach');
  check(await J(page, () => !window.__trailBlazer.coaching), 'the first-race coach goes away on a tap');
  await page.waitForFunction(() => window.__seen.counts.includes('2'), null, { timeout: 4000 });
  await shot(page, layout, '07-countdown', 50);
  await audit(page, layout.insets, 'countdown + race HUD');
  await page.waitForFunction(() => window.__seen.counts.includes('GO!'), null, { timeout: 4000 });
  const counts = await J(page, () => window.__seen.counts.slice());
  check(counts.join(' ') === '3 2 1 GO!', `countdown 3-2-1 then GO! (${counts.join(' ')})`);
  await page.keyboard.down('ArrowRight');           // GAS after the gate drop
  await page.waitForTimeout(900);
  await shot(page, layout, '08-race', 50);
  const hud1 = await J(page, () => ({ dots: document.querySelectorAll('#race-dots .rb-dot').length, me: !!document.querySelector('#race-dots .rb-dot.me'), time: document.querySelector('#hud-time').textContent,
    place: document.querySelector('#hud-place').textContent + document.querySelector('#hud-place-sfx').textContent, winch: !!document.querySelector('#btn-winch') }));
  check(hud1.dots === 4 && hud1.me, `track bar: 4 rider dots, the player's ringed (${hud1.dots})`);
  check(/^0:0\d\.\d$/.test(hud1.time) && hud1.time !== '0:00.0', `race timer runs (${hud1.time})`);
  check(/^[1-4](st|nd|rd|th)$/.test(hud1.place), `position badge shows the place (${hud1.place})`);
  check(!hud1.winch, 'no Winch button in race mode');
  check(await J(page, () => /^Facts 0 \/ 12$/.test(document.querySelector('#hud-facts').textContent)), 'HUD: "Facts 0 / 12" toward today\'s mission');

  // ---------- Math Gate 1: the race freezes, the fact is read aloud, a quick right answer ----------
  await waitGate(page);
  const g1 = await gate(page);
  const dbg = await J(page, () => window.__trailBlazer.gate);
  check(dbg.open && dbg.fact === g1.fact && dbg.answer === g1.answer && dbg.state === 'ask', `debug handle __trailBlazer.gate = ${JSON.stringify(dbg)}`);
  const F = await import(pathToFileURL(path.join(repoRoot, 'trail-blazer/src/facts/facts.js')).href);
  await page.waitForFunction((t) => window.__spoken.includes(t), F.questionSentence(g1.fact, g1.flip), { timeout: 2500 }).catch(() => {});
  const sp1 = await J(page, () => window.__spoken.slice());
  check(g1.q === F.factText(g1.fact, g1.flip) && /^[0-9]+ [×÷+−] [0-9]+$/.test(g1.q) && g1.answer === F.factAnswer(g1.fact), `gate 1 shows "${g1.q}" in big type`);
  check(sp1.includes(F.questionSentence(g1.fact, g1.flip)), `the fact is read aloud as it appears ("${F.questionSentence(g1.fact, g1.flip)}"; heard ${JSON.stringify(sp1.slice(-3))})`);
  check(g1.html && await J(page, () => getComputedStyle(document.querySelector('#controls')).visibility === 'hidden'), 'the driving controls hide while the Gate panel is up');
  const fz = await J(page, async () => { const g = window.__trailBlazer.game, a = g.getState(); await new Promise((r) => setTimeout(r, 400)); const b = g.getState(); return { phase: a.phase, t: [a.timeSec, b.timeSec], riders: [JSON.stringify(a.riders), JSON.stringify(b.riders)] }; });
  check(fz.phase === 'gate' && fz.t[0] === fz.t[1] && fz.riders[0] === fz.riders[1], `the whole race is frozen at the gate (phase ${fz.phase}, clock ${fz.t[0]} = ${fz.t[1]}, riders still)`);
  await shot(page, layout, '09-gate-ask', 80);
  await audit(page, layout.insets, 'Gate panel');
  await typeAnswer(page, g1.answer);
  await page.waitForTimeout(150);
  const g1r = await gate(page);
  check(g1r.state === 'right' && /⚡ Quick!/.test(g1r.msg) && g1r.tiles === String(g1.answer), `right within 3 s: "${g1r.msg}"`);
  await shot(page, layout, '10-gate-quick', 0);
  await page.waitForFunction(() => !window.__trailBlazer.gatePanel.isOpen, null, { timeout: 3000 });
  const op1 = await J(page, () => window.__opened[0]);
  check(op1 && op1.correct === true && op1.quick === true && !op1.fixed, `then openGate({ correct: true, quick: true }) (${JSON.stringify(op1)})`);
  check(await J(page, () => !document.documentElement.classList.contains('math') && /^Facts 1 \/ 12$/.test(document.querySelector('#hud-facts').textContent)), 'the controls come back and the HUD says "Facts 1 / 12"');

  // ---------- Math Gate 2: a miss → the fact with its answer and a hint (read aloud) → covered → copy → fixed ----------
  await waitGate(page);
  const g2 = await gate(page);
  const wrongV = g2.answer + 1;
  await typeAnswer(page, wrongV);
  await page.waitForTimeout(80);
  const g2b = await gate(page);
  check(g2b.state === 'bad' && g2b.tiles === String(wrongV), 'a wrong answer flashes red for a moment …');
  await page.waitForFunction(() => window.__trailBlazer.gatePanel.state === 'show', null, { timeout: 1000 });
  const g2s = await gate(page);
  await page.waitForFunction((t) => window.__spoken.some((x) => x.includes(t)), F.fullSentence(g2.fact, g2.flip), { timeout: 2500 }).catch(() => {});
  const sp2 = await J(page, () => window.__spoken.slice(-3).join(' '));
  check(g2s.tiles === String(g2.answer) && !g2s.tiles.includes(String(wrongV)) && g2s.msg.includes(`= ${g2.answer}`), `… then (within a second) the whole fact with its answer: "${g2s.msg}", the wrong answer gone`);
  check(g2s.hint.length > 5 && g2s.hint.includes(String(g2.answer)), `a strategy hint: "${g2s.hint}"`);
  check(sp2.includes(F.fullSentence(g2.fact, g2.flip)), `the fact, its answer and the hint are read aloud ("${F.fullSentence(g2.fact, g2.flip)} …"; heard ${JSON.stringify(sp2)})`);
  await shot(page, layout, '11-gate-wrong', 0);
  await page.waitForFunction(() => window.__trailBlazer.gatePanel.state === 'copy', null, { timeout: 3500 });
  const g2c = await gate(page);
  check(g2c.tiles === '' && !g2c.hint && !g2c.msg.includes(String(g2.answer)), 'after 2.5 s the answer is covered: type it from memory');
  await shot(page, layout, '12-gate-copy', 0);
  await typeAnswer(page, wrongV);
  await page.waitForFunction(() => window.__trailBlazer.gatePanel.state === 'show', null, { timeout: 1000 });
  check(true, 'a wrong copy clears within a second and the fact with its answer shows again');
  await page.waitForFunction(() => window.__trailBlazer.gatePanel.state === 'copy', null, { timeout: 3500 });
  await typeAnswer(page, g2.answer);
  await page.waitForTimeout(100);
  check(/Fixed it/.test((await gate(page)).msg), 'the copy matches: "Fixed it!"');
  await page.waitForFunction(() => !window.__trailBlazer.gatePanel.isOpen, null, { timeout: 3000 });
  const op2 = await J(page, () => window.__opened[1]);
  check(op2 && op2.fixed === true && !op2.correct && !op2.quick, `then openGate({ fixed: true }) (${JSON.stringify(op2)})`);

  // ---------- the rest of the race: gates 3 and 4 right, the crash + respawn ----------
  check(await raceToResults(page), 'gates 3 and 4 answered, the race reaches the finish');
  const seen = await J(page, () => window.__seen);
  const sum1 = await J(page, () => window.__trailBlazer.lastResult && window.__trailBlazer.lastResult.summary);
  // v1.6.3: the lights-on counter (quiet on localhost; window.__pings records what would be sent): one 'day' ping,
  // a 'race' ping for the finished race, and only { game, v, kind, fam }
  const { pings, ver } = await J(page, () => ({ pings: window.__pings || [], ver: (window.__spellJump || window.__trailBlazer).app.version }));
  check(pings.filter((p) => p.kind === 'day').length === 1 && pings.filter((p) => p.kind === 'race').length === 1
    && pings.every((p) => p.game === 'trail-blazer' && p.v === ver && p.fam === '' && Object.keys(p).join() === 'game,v,kind,fam'),
    `pings: one day ping and a race ping, nothing else in them (${pings.map((p) => p.kind).join(', ')})`);
  check(sum1 && sum1.flips >= 1 && sum1.crashes >= 1 && sum1.airTime >= 1.5, `the race had a landed flip, big air and a crash (flips ${sum1 && sum1.flips}, crashes ${sum1 && sum1.crashes}, air ${sum1 && sum1.airTime} s)`);
  check(!['Backflip!', 'Big air!', 'Perfect!', 'Crash!'].some((b) => seen.banners.includes(b)), `no HUD banner doubles the engine's in-world stunt text (${seen.banners.join(' · ')})`);
  check(seen.banners.includes('Back on track!'), '"Back on track!" after the crash');
  check(seen.banners.some((b) => /^You're (\dnd|\drd|\dth|in the lead)/.test(b)) && new Set(seen.places).size >= 2, `position changes on the HUD (${seen.places.join(' → ')}) with a "You're …" banner`);
  await page.waitForTimeout(1500);
  const res = await results(page);
  const sum = res.rows.reduce((a, r) => a + r.value, 0);
  const keys = res.rows.map((r) => r.key);
  check(['distance', 'air', 'flips', 'perfect', 'coins', 'gates', 'quick', 'place', 'finish'].every((k) => keys.includes(k)) && res.rows.find((r) => r.key === 'place').value === 300,
    `cash rows incl. flips, perfect landings and the 2nd-place bonus ($300): ${res.rows.map((r) => `${r.key} ${r.value}`).join(' + ')}`);
  check(sum === res.total && res.total === res.last.summary.cash.total, `results rows add up (${sum} = total ${res.total})`);
  check(res.title === 'Podium!' && res.last.place === 2, `title "${res.title}" for ${res.last.place}nd place`);
  check(res.podium.length === 3 && res.podium.some((p) => p.me && p.place === '2'), `podium: ${res.podium.map((p) => `${p.place} ${p.name}`).join(', ')} (the player on step 2)`);
  check(['gold', 'silver', 'bronze'].includes(res.medal) && res.medal === res.last.bank.medal, `medal shown: ${res.medal}`);
  const save1 = await readSave(page);
  check(save1.cash === res.total, `banked: save cash ${save1.cash} = race total ${res.total}`);
  check(save1.bestPlace['pine-ridge'] === 2 && save1.bestTime['pine-ridge'] === res.last.summary.timeSec && save1.medals['pine-ridge'] === res.medal,
    `saved: best place 2, best time ${save1.bestTime['pine-ridge']} s, medal ${save1.medals['pine-ridge']}`);
  check(res.callouts.includes('unlock') && res.callouts.some((c) => /^paint:.*\borange\b/.test(c)) && res.callouts.includes('decal:mud') && res.callouts.includes('medal'), `callouts: ${res.callouts.join(', ')}`);
  check(res.next, '2nd place unlocks "Next trail"');
  const rf = await J(page, () => [...document.querySelectorAll('#res-facts .rf')].map((x) => ({ fact: x.dataset.fact, kind: x.dataset.kind, text: x.textContent })));
  check(rf.length === 4 && rf[0].kind === 'quick' && rf[1].kind === 'fixed' && rf.every((x) => /= \d+/.test(x.text)) && rf[0].text.includes('⚡') && rf[1].text.includes('↻'),
    `the race's facts: ${rf.map((x) => x.text).join(' · ')}`);
  check(res.callouts.includes('mission-progress') && res.callouts.includes('xp'), 'results: today\'s mission progress and the XP earned');
  const fd1 = await J(page, () => JSON.parse(localStorage.getItem(`trailBlazer.${window.__trailBlazer.app.currentPlayerId}.facts`)));
  check(fd1 && fd1.today.count === 4 && Object.keys(fd1.records).length >= 2 && fd1.xp > 0 && fd1.races.length === 1, `facts saved: ${Object.keys(fd1.records).length} facts, today ${fd1.today.count}, ${fd1.xp} XP`);
  check(fd1.records[g2.fact] && (fd1.records[g2.fact].box || 0) === 0 && fd1.records[g2.fact].fixed === 1, `the fixed fact ${g2.fact} goes to box 0 for tomorrow (${JSON.stringify(fd1.records[g2.fact])})`);
  check(await J(page, () => document.querySelector('#pit-offer').hidden && !window.__trailBlazer.facts.placement), '"Race first": the race ran; no offer on the results (it comes before a race now)');
  await shot(page, layout, '10-results');
  await audit(page, layout.insets, 'results (podium)');

  // ---------- v1.5: the crate on the results (podium + 3 gates right = a bronze crate), the streak ----------
  const s15 = await readSave(page);
  const rc = await J(page, () => ({ shown: !document.querySelector('#res-crate').hidden, tier: document.querySelector('#res-crate').dataset.tier, lines: [...document.querySelectorAll('#res-lines [data-line]')].map((x) => x.dataset.line + ':' + x.textContent) }));
  check(rc.shown && rc.tier === 'bronze' && s15.crates.queue[0] === 'bronze' && rc.lines.some((x) => /^crate:Bronze crate: podium/.test(x)), `a bronze crate waits on the results (${rc.lines.filter((x) => x.startsWith('crate')).join(' · ')})`);
  check(s15.streak.count === 1 && rc.lines.some((x) => x === 'streak:Streak: 1 day!'), 'the first finished race counts the day: "Streak: 1 day!"');
  check(rc.lines.some((x) => /^rival:Dusty/.test(x)), `a rival line (${rc.lines.find((x) => x.startsWith('rival'))})`);
  check(s15.v === 3 && s15.play && Object.values(s15.play)[0].races === 1, 'save v3 with the day\'s play log (1 race)');
  await page.click('#res-crate');
  await page.waitForSelector('#crate:not([hidden]) #crate-open');
  await shot(page, layout, '10b-crate', 300);
  await audit(page, layout.insets, 'crate');
  await page.click('#crate-open');
  await page.waitForFunction(() => document.querySelector('#crate .crate-card[data-state="open"]'), null, { timeout: 4000 });
  await page.waitForTimeout(500);
  const won = await J(page, () => { const p = document.querySelector('#crate .crate-prize'); return { item: p.dataset.item || null, cash: p.dataset.cash || null, text: p.textContent, newBadge: !!p.querySelector('.new-badge') }; });
  check((won.item && won.newBadge && /NEW!/.test(won.text)) || (won.cash && /\+\$/.test(won.text)), `tap: shake, burst, and the prize: ${won.item ? won.item + ' NEW!' : '+$' + won.cash}`);
  await shot(page, layout, '10c-crate-open', 0);
  const s16 = await readSave(page);
  const [wk, wid] = (won.item || ':').split(':');
  check(s16.crates.queue.length === s15.crates.queue.length - 1 && s16.crates.opened === 1 && (!won.item || ['paint', 'decal'].includes(wk) || s16.cosmetics.owned[wk].includes(wid)), `the crate is opened and the prize is saved (${won.item || 'cash'})`);
  await page.click(s16.crates.queue.length ? '#crate-later' : '#crate-done').catch(() => page.click('#crate-done'));
  await page.waitForTimeout(200);
  if (await J(page, () => !document.querySelector('#crate').hidden)) await page.click('#crate .crate-actions .btn-orange');

  // ---------- garage ----------
  await page.click('#res-garage');
  await page.waitForSelector(visibleSel('#screen-garage'));
  await page.waitForTimeout(300);
  await shot(page, layout, '11-garage');
  await audit(page, layout.insets, 'garage');
  check(await J(page, () => /race/i.test(document.querySelector('#btn-garage-ride').textContent)), 'garage button says Race');
  const cash0 = (await readSave(page)).cash;
  await page.click('[data-upgrade="engine"]');
  const save2 = await readSave(page);
  check(save2.vehicles.ranger150.levels.engine === 1 && save2.cash === cash0 - 300, `Engine upgrade: level 1 for $300 (cash ${cash0} → ${save2.cash}), saved on the Ranger`);
  await page.click('.style-chip[data-paint="orange"]');
  check((await readSave(page)).paint === 'orange', 'Blaze Orange paint (Pine Ridge finished) equips and is saved');
  const medalPaint = { gold: 'gold', silver: 'sky', bronze: 'pine' }[res.medal];
  check(await J(page, (id) => !document.querySelector(`.style-chip[data-paint="${id}"]`).classList.contains('locked'), medalPaint), `the ${res.medal} medal unlocked the ${medalPaint} paint`);
  await page.click('[data-style-tab="decal"]');
  await page.click('.style-chip[data-decal="mud"]');
  check((await readSave(page)).decal === 'mud', 'Mud Splats decal equips and is saved');
  check(await J(page, () => document.querySelector('.style-chip[data-decal="flames"]').classList.contains('locked') && /10 flips/.test(document.querySelector('.style-chip[data-decal="flames"]').textContent)), 'Flames decal locked: "Land 10 flips"');
  await shot(page, layout, '12-garage-after');

  // ---------- v1.5: the Vehicles row: buy the Dune Quad, its own upgrades, back to the Ranger ----------
  const vrow = await J(page, () => [...document.querySelectorAll('#veh-row [data-vehicle]')].map((c) => ({ id: c.dataset.vehicle, on: c.classList.contains('on'), text: c.textContent })));
  check(vrow.length === 8 && vrow[0].id === 'ranger150' && vrow[0].on && /Driving/.test(vrow[0].text) && /Earn \$[\d,]+ more/.test(vrow[1].text), `Vehicles row: 8 cards, the Ranger driving, locked ones say "Earn $X more" (${vrow[1].text})`);
  await page.click('[data-vehicle="quad"]');
  check(await J(page, () => document.querySelector('#btn-garage-ride').dataset.mode === 'buy' && /Earn \$[\d,]+ more/.test(document.querySelector('#btn-garage-ride').textContent) && document.querySelector('#veh-name').textContent === 'Dune Quad'), 'tap a locked vehicle: it shows on the stage with "Earn $X more"');
  await J(page, () => { const a = window.__trailBlazer.app; a.save.cash += 170000 + 480; a.persist(); a.go('garage'); });
  await page.click('[data-vehicle="quad"]');
  check(await J(page, () => document.querySelector('#btn-garage-ride').dataset.mode === 'buy' && /Buy/.test(document.querySelector('#btn-garage-ride').textContent)), 'with the cash: "Buy $170,000"');
  await shot(page, layout, '12b-garage-vehicles', 300);
  await audit(page, layout.insets, 'garage (Vehicles row)');
  const cashQ = (await readSave(page)).cash;
  await page.click('#btn-garage-ride');
  const sq = await readSave(page);
  check(sq.vehicle === 'quad' && sq.vehicles.quad.owned && sq.cash === cashQ - 170000 && /Driving/.test(await J(page, () => document.querySelector('[data-vehicle="quad"]').textContent)), `bought the Dune Quad for $170,000 and it is the one driving (cash ${cashQ} → ${sq.cash})`);
  check(await J(page, () => document.querySelector('[data-row="engine"] [data-level]').dataset.level === '0' && /480/.test(document.querySelector('[data-upgrade="engine"]').textContent)), 'upgrades are per vehicle: the Quad starts at Engine 0, its level 1 costs $480 (× 1.6)');
  await page.click('[data-upgrade="engine"]');
  const sq2 = await readSave(page);
  check(sq2.vehicles.quad.levels.engine === 1 && sq2.vehicles.ranger150.levels.engine === 1 && sq2.cash === sq.cash - 480, 'the Quad\'s Engine level 1 for $480; the Ranger keeps its own level');
  await page.click('[data-vehicle="ranger150"]');
  check((await readSave(page)).vehicle === 'ranger150' && await J(page, () => document.querySelector('[data-row="engine"] [data-level]').dataset.level === '1'), 'tap the Ranger: driving it again, its upgrades show');
  // the Garage Wall counts what the crate gave
  await page.click('#btn-wall');
  await page.waitForSelector(visibleSel('#screen-wall'));
  const wallSt = await J(page, () => [...document.querySelectorAll('.wall-set')].map((w) => ({ kind: w.dataset.set, have: +w.querySelector('.ws-count').dataset.have, total: +w.querySelector('.ws-count').dataset.total, owned: w.querySelectorAll('.wall-item.owned').length })));
  check(wallSt.map((w) => w.kind).join(',') === 'helmet,suit,horn,trail,flag,paint,decal' && wallSt.every((w) => w.have === w.owned) && wallSt.find((w) => w.kind === 'helmet').total === 12 && wallSt.find((w) => w.kind === 'flag').total === 6,
    `Garage Wall: 7 sets, counts match what is owned (${wallSt.map((w) => `${w.kind} ${w.have}/${w.total}`).join(', ')})`);
  if (won.item) check(await J(page, (id) => !!document.querySelector(`.wall-item.owned[data-item="${id}"]`), won.item), `the crate's ${won.item} is on the wall`);
  await shot(page, layout, '12c-garage-wall');
  await audit(page, layout.insets, 'Garage Wall');
  await page.click('#screen-wall [data-back="garage"]');
  await page.waitForSelector(visibleSel('#screen-garage'));

  // ---------- race 2: Granite Gap, pause + resume, finish 4th → the next track stays locked ----------
  await page.click('#btn-garage-ride');
  await page.waitForSelector(visibleSel('#screen-trails'));
  check(await J(page, () => !document.querySelector('[data-trail="granite-gap"]').classList.contains('locked') && !!document.querySelector('[data-trail="pine-ridge"] [data-medal]')), 'Granite Gap unlocked; Pine Ridge card shows its medal');
  check(await J(page, (t) => document.querySelector('[data-trail="pine-ridge"] [data-best-time]').dataset.bestTime === String(t), res.last.summary.timeSec), 'Pine Ridge card shows the best time');
  await shot(page, layout, '13-tracks-after');
  await J(page, () => { window.__mockScript = { aiTimes: [3, 3.5, 4], noCrash: true }; });
  // v1.3 retention probe: 14 finished races so far (race 2 is the 15th) and some mastered facts to probe
  await J(page, async () => {
    const S = await import('/trail-blazer/src/facts/scheduler.js');
    const T = window.__trailBlazer; const d = T.facts; const now = Date.now();
    const day = (k) => S.dayKey(now - k * 86400000);
    for (const f of ['2x6', '2x7', '2x8', '2x9', '5x6', '5x7', '5x8']) {
      d.records[f] = { ...S.newRecord(f), box: 3, seenCount: 5, attempts: 5, firstTry: 4, quick: 3, daysCorrect: [day(9), day(5), day(2)], daysSeen: [day(2)], daysQuick: [day(5), day(2)], due: now + 4 * 86400000, lastSeen: now - 2 * 86400000 };
    }
    d.raceCount = 14; d.checkSkips = 2; T.app.persistFacts();     // v1.6.1: two "Race first" already spent
  });
  await page.click('[data-trail="granite-gap"]');
  // ---------- v1.4: the card comes back before the next race; Start → locate → zoom → twins → the Start line ----------
  await page.waitForSelector('#pit-offer:not([hidden])', { timeout: 4000 });
  check(await J(page, () => window.__trailBlazer.screen !== 'ride' && !window.__trailBlazer.facts.placement), '"Race first" → the card comes back before the next race');
  const card2 = await J(page, () => ({ later: document.querySelector('#pit-later').hidden, text: document.querySelector('#pit-offer-text').textContent, skips: document.querySelector('#pit-offer').dataset.skips }));
  check(card2.later && /The crew needs this one before you race/.test(card2.text) && card2.skips === 'none', `v1.6.1: with both "Race first" spent the card has only Start: "${card2.text}"`);
  await shot(page, layout, '05c-pit-card-last', 300);
  const xpBefore = await J(page, () => window.__trailBlazer.facts.xp);
  await page.click('#pit-start');
  await page.waitForFunction(() => window.__trailBlazer.screen === 'check' && window.__trailBlazer.gatePanel.isOpen, null, { timeout: 4000 });
  const items = [];
  const flipDigits = (n) => { const r = Number(String(n).split('').reverse().join('')); return r !== n && String(r).length === String(n).length ? r : n + 1; };
  for (let i = 0; i < 80 && items.length < 30; i++) {
    const g = await J(page, () => ({ scr: window.__trailBlazer.screen, ...window.__trailBlazer.gate, spoken: window.__spoken.slice(-1)[0] }));
    if (g.scr === 'startline') break;
    if (!g.open || g.state !== 'ask') { await page.waitForTimeout(80); continue; }
    if (items.length === 1) {
      const ui = await J(page, () => ({ title: document.querySelector('#gp-title-text').textContent, chip: document.querySelector('#gp-chip').textContent, bar: !document.querySelector('#gp-progress').hidden,
        later: !document.querySelector('#gp-exit').hidden, text: document.querySelector('#gate').textContent }));
      check(g.mode === 'check' && ui.title === 'Pit Crew Check' && ui.chip === 'Fact 2' && ui.bar && ui.later && !/\d+(\.\d)?\s?s\b|sec|timer|test|grade/i.test(ui.text),
        `the check runs in the gate panel: "${ui.title}", "${ui.chip}", a progress bar, a way out, no clock, no score`);
      check(await J(page, () => document.querySelector('#gp-exit').textContent.trim() === 'Later'), 'v1.6.1: no "Race first" left: the way out reads "Later" (back to the title, no race)');
      const heard = await page.waitForFunction((t) => window.__spoken.includes(t), F.questionSentence(g.fact, g.flip), { timeout: 2500 }).then(() => true).catch(() => false);
      check(heard, `each check fact is read aloud ("${F.questionSentence(g.fact, g.flip)}")`);
      await shot(page, layout, '16a-pit-check', 0);
      await audit(page, layout.insets, 'Pit Crew Check');
    }
    // everything right and quick except ×8 (its digits swapped: a pattern): locate T3 → T4 → back, zoom T3 + T4, ÷ twins
    const item = await J(page, () => window.__trailBlazer.pit.item);
    const wrong = item.family === 'x8';
    if (item.phase === 'zoom' && !items.some((x) => x.phase === 'zoom')) { await shot(page, layout, '16b-pit-zoom', 0); await audit(page, layout.insets, 'Pit Crew Check (zoom)'); }
    await typeAnswer(page, wrong ? flipDigits(g.answer) : g.answer);
    items.push({ fact: g.fact, wrong, phase: item.phase, family: item.family });
    if (wrong && items.filter((x) => x.wrong).length === 1) { await page.waitForFunction(() => window.__trailBlazer.gatePanel.state === 'show', null, { timeout: 2000 }); await shot(page, layout, '16c-pit-check-miss', 0); }
    await page.waitForFunction((f) => window.__trailBlazer.screen === 'startline' || (window.__trailBlazer.gatePanel.isOpen && window.__trailBlazer.gatePanel.state === 'ask' && window.__trailBlazer.gatePanel.fact !== f), g.fact, { timeout: 4000 });
  }
  await page.waitForSelector(visibleSel('#screen-startline'), { timeout: 4000 });
  check(items.length >= 9 && items.length <= 24 && items[0].phase === 'locate' && items.some((x) => x.phase === 'zoom') && items.some((x) => x.phase === 'twins'),
    `locate → zoom → twins: ${items.length} facts (${items.map((x) => x.phase[0] + ':' + x.fact + (x.wrong ? '✗' : '')).join(' ')})`);
  check(['x6', 'x9', 'x7', 'x8'].every((f) => items.filter((x) => x.family === f).length >= 2), 'the zoom gives every family of the located tier and the one above ≥ 2 answers');
  const sl = await J(page, async () => {
    const T = window.__trailBlazer; const chips = (id) => [...document.querySelectorAll(`#${id} .sl-chip`)].map((x) => x.dataset.family);
    return { fluent: chips('sl-fluent'), working: chips('sl-working'), next: chips('sl-next'), xp: document.querySelector('#sl-xp').textContent, xpShown: !document.querySelector('#sl-xp').hidden,
      note: document.querySelector('#sl-note').textContent, text: document.querySelector('#screen-startline').textContent, placement: !!T.facts.placement, factsXp: T.facts.xp, frontier: T.facts.frontier.families,
      reversed: Object.values(T.facts.records).filter((r) => (r.patterns || []).some((p) => p.kind === 'reversed')).length, dial: document.querySelector('#sl-dial').textContent,
      sub: document.querySelector('#sl-sub').textContent, scout: (await import('/trail-blazer/src/facts/scouts.js')).scoutFamily(T.facts) };
  });
  check(sl.placement && sl.working.includes('x8') && sl.fluent.length >= 1 && sl.working.join() === sl.frontier.join(), `Start line (only ×8 missed, so ×8 is the work): Fluent ${sl.fluent.join(' ')} · Working on ${sl.working.join(' ')} · Up next ${sl.next.join(' ')}`);
  check(sl.next.length === 1 && sl.next[0] === sl.scout, `"Up next" names the scout family (${sl.scout})`);
  check(/Your crew will keep checking as you race\./.test(sl.sub) && /^Right now: on target/.test(sl.dial), `"${sl.sub}" · "${sl.dial}"`);
  check(sl.xpShown && /\+100 XP/.test(sl.xp) && sl.factsXp >= xpBefore + 100, `+100 XP for the check (${xpBefore} → ${sl.factsXp})`);
  check(/^Pit note: /.test(sl.note) && !/\btest|grade|score/i.test(sl.text), `kid-framed, with a pit note ("${sl.note}")`);
  const kinds = await J(page, () => Object.values(window.__trailBlazer.facts.records).flatMap((r) => (r.patterns || []).map((p) => p.kind)));
  check(kinds.length >= 2, `the check's misses are classified (${kinds.join(', ')})`);
  await page.waitForTimeout(2600);
  await shot(page, layout, '16d-startline', 0);
  await audit(page, layout.insets, 'Start line');
  await page.click('#sl-race');

  await page.waitForFunction(() => window.__trailBlazer.screen === 'ride');
  const st2 = await J(page, () => window.__starts[window.__starts.length - 1]);
  check(st2.trail === 'granite-gap' && st2.paint === 'orange' && st2.decal === 'mud' && st2.stats.power > 1, `race 2 uses the new paint, decal and Engine level (power ${st2.stats.power})`);
  check(await J(page, () => document.querySelector('#coach').hidden), 'no coach on the second race');
  await page.waitForFunction(() => window.__trailBlazer.game.getState().phase === 'ride', null, { timeout: 5000 });
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowRight');
  await page.click('#btn-pause');
  await page.waitForSelector(visibleSel('#panel-pause'));
  const t1 = await J(page, () => window.__trailBlazer.game.getState().timeSec);
  await page.waitForTimeout(500);
  const t2 = await J(page, () => window.__trailBlazer.game.getState().timeSec);
  check(t1 === t2, `pause stops the race clock (${t1} = ${t2})`);
  await shot(page, layout, '14-pause');
  await audit(page, layout.insets, 'pause');
  await page.click('#pause-sound');
  check(await J(page, () => JSON.parse(localStorage.getItem('trailBlazer.settings')).sound === false), 'pause: Sound off is saved in trailBlazer.settings');
  await page.click('#pause-sound');
  await page.click('#pause-resume');
  check(await J(page, () => /^Facts [4-9] \/ 12$/.test(document.querySelector('#hud-facts').textContent)), 'race 2: the HUD counts on from today\'s gates');
  check(await raceToResults(page), 'race 2: every gate answered, the race ends');
  await page.waitForTimeout(1300);
  const res2 = await results(page);
  const sum2 = res2.rows.filter((r) => r.key).reduce((a, r) => a + r.value, 0);
  check(res2.title === 'Race over' && res2.last.place === 4 && sum2 === res2.total && !res2.rows.some((r) => r.key === 'place'), `4th place → "${res2.title}", no position bonus, rows add up (${sum2} = ${res2.total})`);
  check(!res2.next && res2.callouts.includes('need-podium'), 'the next trail stays locked: "Finish 3rd or better to open the next trail"');
  const save3 = await readSave(page);
  check(save3.cash === save2.cash + res2.total && save3.bestPlace['granite-gap'] === 4, `banked ${res2.total} (cash ${save3.cash}); Granite Gap best place 4`);
  await shot(page, layout, '15-results-4th');
  check(await J(page, () => { const T = window.__trailBlazer; return T.lastResult.probeStarted && T.facts.raceCount === 15 && T.facts.probe && T.facts.probe.facts.length === 6; }),
    'race 15 finished: a retention probe of 6 mastered facts waits for the next race');

  // ---------- race 3 (the 16th): the retention probe is mixed into the gates, then End race from the pause menu ----------
  await J(page, () => { window.__mockScript = { noCrash: true }; });
  await page.click('#res-again');
  await page.waitForFunction(() => window.__trailBlazer.screen === 'ride');
  await page.waitForFunction(() => window.__trailBlazer.game.getState().phase === 'ride', null, { timeout: 5000 });
  const reasons = [];
  for (let k = 0; k < 3 && !reasons.includes('probe'); k++) {
    await waitGate(page);
    const pg = await J(page, () => window.__trailBlazer.gate);
    reasons.push(pg.reason);
    await typeAnswer(page, pg.answer);
    await page.waitForFunction(() => !window.__trailBlazer.gatePanel.isOpen, null, { timeout: 4000 });
  }
  check(reasons.includes('probe') && await J(page, () => window.__trailBlazer.facts.probe && window.__trailBlazer.facts.probe.done.length >= 1), `the next race mixes the probe into its gates (${reasons.join(', ')})`);
  await page.waitForTimeout(300);
  await page.click('#btn-pause');
  await page.click('#pause-end');
  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 5000 });
  await page.waitForTimeout(1300);
  const res3 = await results(page);
  const sum3 = res3.rows.reduce((a, r) => a + r.value, 0);
  check(res3.title === 'Race over' && sum3 === res3.total && res3.time === 'DNF', `End race → "${res3.title}", time ${res3.time}, rows add up (${sum3} = ${res3.total})`);
  const save3b = await readSave(page);
  check(save3b.cash === save3.cash + res3.total, `banked ${res3.total} (cash ${save3b.cash})`);

  // ---------- v1.4: scouts: a kid who answers everything quick has a vouched family within 3 races, and the frontier moves ----------
  // (the natural flow: the check missed only ×8, so the frontier is ×8 + the next untested family; races 2 and 3 already
  // had their scout gates)
  const fr0 = sl.frontier.join(' ');
  const scoutsSeen = [];
  for (let k = 0; k < 3; k++) {
    if (k === 2 && await J(page, () => Object.keys(window.__trailBlazer.facts.vouched || {}).length)) break;
    await J(page, () => { window.__mockScript = { noCrash: true, aiTimes: [3, 3.5, 4] }; });
    await page.click('#res-again');
    await page.waitForFunction(() => window.__trailBlazer.screen === 'ride');
    const end = Date.now() + 30000;
    while (Date.now() < end) {
      const st = await J(page, () => { const g = window.__trailBlazer.gate; return { results: window.__trailBlazer.screen === 'results', gate: g.open && g.state === 'ask', answer: g.answer, reason: g.reason }; });
      if (st.results) break;
      if (st.gate) { scoutsSeen.push(st.reason); await typeAnswer(page, st.answer); await page.waitForFunction(() => !window.__trailBlazer.gatePanel.isOpen, null, { timeout: 4000 }); }
      else await page.waitForTimeout(120);
    }
    await page.waitForTimeout(1300);
  }
  const vz = await J(page, () => { const d = window.__trailBlazer.facts; return { vouched: Object.keys(d.vouched || {}), scouts: d.scouts, fr: d.frontier.families.join(' '), hist: d.frontier.history.map((h) => `${h.from.join(' ')} → ${h.families.join(' ')}: ${h.why}`) }; });
  check(/x8/.test(fr0) && scoutsSeen.filter((r) => r === 'scout').length >= 2 && vz.vouched.length >= 1, `frontier after the check ${fr0}: scout gates every race; vouched within 3 full races: ${vz.vouched.join(' ')} (${JSON.stringify(vz.scouts)})`);
  check(vz.fr !== fr0 && vz.hist.length >= 1, `the frontier moves (${fr0} → ${vz.fr}; ${vz.hist.slice(-2).join(' | ')})`);

  // ---------- v1.5: the daily Pit Challenge from the title card: the mutator, ×2 cash, a bronze crate once ----------
  await page.click('#res-garage');
  await page.click('[data-back="title"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  const t1s = await J(page, () => ({ days: document.querySelector('#title-streak').dataset.days, lit: document.querySelector('#title-streak').classList.contains('lit'), text: document.querySelector('#title-trails-text').textContent }));
  check(t1s.days === '1' && t1s.lit, 'title: the streak flame is lit (1 day)');
  check(/^Rookie Cup: 1 \/ 6 · \d+ ★$/.test(t1s.text), `title: cup progress "${t1s.text}" (podiums · stars)`);
  await shot(page, layout, '16-title-daily');
  await audit(page, layout.insets, 'title (daily card, streak)');
  const daily = await J(page, () => window.__trailBlazer.app.save.daily);
  const q0 = (await readSave(page)).crates.queue.length;
  await J(page, () => { window.__mockScript = { noCrash: true }; });
  await page.click('#title-daily');
  await page.waitForFunction(() => window.__trailBlazer.screen === 'ride' || !document.querySelector('#pit-offer').hidden);
  if (await J(page, () => !document.querySelector('#pit-offer').hidden)) { await page.click('#pit-later'); await page.waitForFunction(() => window.__trailBlazer.screen === 'ride'); }
  const std = await J(page, () => window.__starts[window.__starts.length - 1]);
  check(std.trail === daily.trailId && std.mutator === daily.mutator && !!std.mutator && Math.abs(std.stats.coinMult - 2) < 1e-9, `the card starts today's trail with its twist (${std.mutator}) and ×2 cash (coinMult ${std.stats.coinMult})`);
  check(await raceToResults(page), 'the Pit Challenge race ends');
  await page.waitForTimeout(1300);
  const rd = await J(page, () => ({ mult: (document.querySelector('#res-pay tr.total .mult') || {}).textContent || '', lines: [...document.querySelectorAll('#res-lines [data-line]')].map((x) => x.textContent) }));
  const sd = await readSave(page);
  check(/Pit Challenge ×2/.test(rd.mult) && rd.lines.includes('Pit Challenge done! Bronze crate') && sd.daily.done && sd.crates.queue.length >= q0 + 1, `results: the total row says "${rd.mult.replace(/^ · /, '')}", "Pit Challenge done! Bronze crate"`);
  await page.click('#res-garage');
  await page.click('[data-back="title"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  check(await J(page, () => document.querySelector('#title-daily').classList.contains('done') && /^Done today!/.test(document.querySelector('#title-daily-text').textContent)), 'the card says "Done today! New one tomorrow"');

  // ---------- v1.5: a championship weekend: every Rookie trail open → 3 races → standings → the cup podium ----------
  await J(page, () => { const a = window.__trailBlazer.app; for (const t of a.trails.filter((x) => x.cup === 'rookie')) a.save.bestPlace[t.id] = Math.min(a.save.bestPlace[t.id] || 3, 3); a.persist(); window.__mockScript = { noCrash: true, aiTimes: [9, 9.6, 10.4] }; });
  await page.click('#btn-ride');
  await page.waitForSelector(visibleSel('#screen-trails'));
  check(await J(page, () => document.querySelector('#cup-race').dataset.ready === 'true'), 'every Rookie trail open: "Race the cup" is ready');
  await page.click('#cup-race');
  const wkTrails = await J(page, () => window.__trailBlazer.app.save.weekend.trails);
  check(wkTrails.join(',') === 'snow-pass,desert-wash,night-ride', `the weekend runs the cup's last 3 trails (${wkTrails.join(', ')})`);
  for (let k = 0; k < 3; k++) {
    await page.waitForFunction(() => window.__trailBlazer.screen === 'ride' || !document.querySelector('#pit-offer').hidden, null, { timeout: 5000 });
    if (await J(page, () => !document.querySelector('#pit-offer').hidden)) { await page.click('#pit-later'); await page.waitForFunction(() => window.__trailBlazer.screen === 'ride', null, { timeout: 5000 }); }
    check(await raceToResults(page), `weekend race ${k + 1} ends`);
    await page.waitForTimeout(1400);
    if (k < 2) {
      const wr = await J(page, () => ({ txt: document.querySelector('#res-weekend').textContent, table: document.querySelector('#res-weekend .wk-table').dataset.table, next: document.querySelector('#res-next-text').textContent }));
      check(new RegExp(`race ${k + 1} of 3`).test(wr.txt) && /You \d+/.test(wr.txt) && wr.next === 'Next race', `standings after race ${k + 1}: "${wr.txt}"`);
      if (k === 0) {
        const stars = await J(page, () => [...document.querySelectorAll('#res-stars [data-star]')].map((x) => x.dataset.on));
        check(stars.filter((x) => x === 'true').length >= 2, `stars on the results: 1st + every gate right (${stars.join(', ')})`);
        await shot(page, layout, '16b-weekend-standings', 600);
        await audit(page, layout.insets, 'results (weekend)');
      }
      await page.click('#res-next');
    }
  }
  await page.waitForSelector('#cup-final:not([hidden])', { timeout: 5000 });
  await page.waitForTimeout(700);
  const cf = await J(page, () => ({ title: document.querySelector('.cf-card h3').textContent, trophy: document.querySelector('.cf-card').dataset.trophy, first: (document.querySelector('.cf-podium .pod.p1') || {}).dataset || {}, table: [...document.querySelectorAll('.cf-card .cf-sub')].map((x) => x.textContent).find((t) => /^You \d+/.test(t)) || '', cup: JSON.parse(localStorage.getItem(`trailBlazer.${window.__trailBlazer.app.currentPlayerId}.save`)).cups.rookie }));
  check(cf.table.split(' · ').length === 4, `the standings keep the same 4 riders all weekend (${cf.table})`);
  check(cf.title === 'Rookie Cup champion!' && cf.trophy === 'gold' && cf.first.name === 'Mia' && cf.cup && cf.cup.trophy === 'gold' && cf.cup.weekends === 1, `the cup podium: "${cf.title}", the gold trophy on 1st, saved (${JSON.stringify(cf.cup)})`);
  await shot(page, layout, '16c-cup-podium', 0);
  await audit(page, layout.insets, 'cup podium');
  await page.click('#cup-final-ok');
  check(await J(page, () => { const s = window.__trailBlazer.app.save; return !s.weekend && (s.stars['snow-pass'] || []).filter(Boolean).length >= 2; }), 'the weekend is over; stars saved on the trail');
  await page.click('#res-garage');
  await page.click('[data-back="title"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  const cashAfter = (await readSave(page)).cash;
  const podiums = await J(page, () => window.__trailBlazer.app.trailsDoneFor(window.__trailBlazer.app.currentPlayerId));

  // the next cup needs BOTH a trophy and the stars (12 for Pro): the trophy alone does not open it
  const st12 = await J(page, () => { const s = window.__trailBlazer.app.save; return Object.values(s.stars).reduce((a, v) => a + v.filter(Boolean).length, 0); });
  const tt = await J(page, () => document.querySelector('#title-trails-text').textContent);
  check(st12 >= 12 ? /^Pro Cup: / .test(tt) : /^Rookie Cup: /.test(tt), `with the trophy and ${st12} ★ the Pro Cup is ${st12 >= 12 ? 'open' : 'still locked'} ("${tt}")`);
  await J(page, () => { const a = window.__trailBlazer.app; for (const t of a.trails.filter((x) => x.cup === 'rookie')) a.save.stars[t.id] = [true, true, (a.save.stars[t.id] || [])[2] || false]; a.persist(); a.go('title'); });

  // ---------- Parent Zone from the title ----------
  check(await J(page, () => /^Pro Cup: 0 \/ 6 · 0 ★$/.test(document.querySelector('#title-trails-text').textContent)), `title: a Rookie trophy + 12 ★ opened the Pro Cup ("${await J(page, () => document.querySelector('#title-trails-text').textContent)}")`);
  await shot(page, layout, '16-title-after');
  const today = await J(page, () => window.__trailBlazer.facts.today.count);
  check(await J(page, (n) => document.querySelector('#title-mission-text').textContent === (n >= 12 ? 'Mission complete! Race on' : `Today: ${n} / 12 math gates`) && /^Lv \d+$/.test(document.querySelector('#title-lv').textContent), today) && today >= 9,
    `title: today's math gates (${today}) and the level`);

  // ---------- Fact Grid ----------
  await page.click('#btn-grid');
  await page.waitForSelector(visibleSel('#screen-grid'));
  const gridSt = await J(page, () => { const c = [...document.querySelectorAll('#fgrid .fg-cell')]; return { n: c.length, practiced: c.filter((x) => x.dataset.status !== 'New').map((x) => x.dataset.fact),
    learning: c.filter((x) => ['Learning', 'Almost'].includes(x.dataset.status)).map((x) => x.dataset.fact), off: c.filter((x) => x.classList.contains('off')).length }; });
  check(gridSt.n === 144 && gridSt.practiced.length >= 2, `Fact Grid: 12 × 12 cells, ${gridSt.practiced.length} practiced (${gridSt.practiced.join(', ')}), ${gridSt.off} outside this week's set`);
  const xFact = gridSt.learning[0];
  const cellSt = await J(page, (f) => document.querySelector(`#fgrid [data-fact="${f}"]`).dataset.status, xFact);
  const recSt = await J(page, (f) => { const S = window.__trailBlazer; const r = S.facts.records[f]; return r ? (r.box <= 1 ? 'Learning' : 'Almost') : 'New'; }, xFact);
  check(['Learning', 'Almost'].includes(cellSt) && cellSt === recSt, `cell ${xFact} is colored ${cellSt}`);
  await page.tap(`#fgrid [data-fact="${xFact}"]`);
  await page.waitForTimeout(150);
  const giText = await J(page, () => document.querySelector('#gi-fact').textContent);
  check(giText === `${F.factText(xFact)} = ${F.factAnswer(xFact)}` && (await J(page, () => window.__spoken.slice(-1)[0])) === F.fullSentence(xFact), `tap a cell: "${giText}", read aloud`);
  await shot(page, layout, '17-grid');
  await audit(page, layout.insets, 'Fact Grid');
  await page.click('.grid-seg [data-view="d"]');
  check(await J(page, () => document.querySelector('#fgrid [data-fact="56/7"]') && document.querySelector('#fgrid .fg-h.corner').textContent === '÷'), 'the ÷ view');
  await shot(page, layout, '18-grid-div');
  await page.click('#screen-grid [data-back="title"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  await J(page, () => window.__trailBlazer.pz.lock());
  await page.click('#btn-parents');
  await page.waitForSelector(visibleSel('#pz'));
  await pinIn(page, '0000');
  check(await J(page, () => !!document.querySelector('#pin-err')), 'a wrong PIN is refused');
  await pinIn(page, '1234');
  await page.waitForSelector('.pz-content[data-tab="sync"]');
  check(true, 'the shared PIN opens the Parent Zone');
  // v1.6.2: Family code tab: a strip per child, "Math this week · n % of the ladder · n % right", a mini bar
  const strips = await J(page, () => [...document.querySelectorAll('#pz-week-list .pz-week-row')].map((r) => ({ name: r.querySelector('b').textContent, text: r.querySelector('.pw-strip').textContent, bar: !!r.querySelector('.pw-mini i') })));
  check(strips.length === 1 && strips[0].bar && /^Math this week · \d+ % of the ladder · \d+ % right$/.test(strips[0].text), `Family tab: a strip per child (${strips.map((x) => `${x.name}: ${x.text}`).join(' | ')})`);
  await page.locator('#pz-week-list').scrollIntoViewIfNeeded();
  await shot(page, layout, '19z-pz-family-week');
  await audit(page, layout.insets, 'Parent Zone (Family: this week)');
  check((await J(page, () => [...document.querySelectorAll('.pz-tabs [data-tab]')].map((t) => t.dataset.tab))).join(',') === 'sync,facts,options,report,players', 'tabs: Family code · Facts this week · Options · Report · Players');
  await page.click('.pz-tabs [data-tab="facts"]');
  const au = await J(page, () => ({ mode: document.querySelector('#facts-mode .seg-btn.on').dataset.value, fr: document.querySelector('#facts-frontier').dataset.families, reason: document.querySelector('#facts-reason').textContent,
    ladder: document.querySelectorAll('#facts-ladder [data-family]').length, check: document.querySelector('#facts-check-text').textContent, btn: document.querySelector('#facts-check').textContent, stored: window.__trailBlazer.facts.frontier.families.join(' ') }));
  check(au.mode === 'auto' && au.fr && au.fr === au.stored && au.reason.length > 5 && au.ladder >= 11 && /Last check/.test(au.check) && /^Check now$/.test(au.btn),
    `Facts this week: Auto (recommended) shows the frontier (${au.fr}: "${au.reason}"), the ladder and the last Pit Crew Check (${au.btn})`);
  const where = await J(page, () => ({ line: document.querySelector('#facts-where-line').textContent, label: document.querySelector('#facts-where .label').textContent,
    dial: document.querySelector('#facts-dial').textContent, vouched: (document.querySelector('#facts-vouched') || {}).textContent || '', states: [...document.querySelectorAll('#facts-ladder [data-state]')].map((x) => x.dataset.state) }));
  check(where.label === 'Where Mia B is' || where.label === 'Where Mia is', `"${where.label}"`);
  check(/^Tier \d · [×÷]\d+( [×÷]\d+)? · placed [A-Z][a-z]{2} \d+ · re-check in \d+ days?$/.test(where.line), `"${where.line}"`);
  check(/^Right now: (on target|a bit easy: moving up|a bit hard: stepping back) \(\d+ of \d+ right\)$/.test(where.dial) && /Vouched by scouts: ×/.test(where.vouched), `"${where.dial}" · "${where.vouched}"`);
  check(where.states.includes('vouched') && where.states.includes('secure'), `the ladder shows secure and vouched families (${[...new Set(where.states)].join(', ')})`);
  await shot(page, layout, '19-pz-auto');
  await audit(page, layout.insets, 'Parent Zone (Facts: auto)');
  await page.click('#facts-mode [data-value="families"]');
  check(await J(page, () => { const d = JSON.parse(localStorage.getItem(`trailBlazer.${window.__trailBlazer.app.currentPlayerId}.facts`)); return d.sets.mode === 'manual' && d.sets.source === 'families' && !document.querySelector('#facts-frontier'); }), 'Pick families: manual mode, saved');
  check(await J(page, () => ['x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9'].every((f) => document.querySelector(`.fam[data-family="${f}"]`).classList.contains('on')) && !document.querySelector('.fam[data-family="x12"]').classList.contains('on')), 'Pick families: ×2 … ×9 on (the stock set)');
  await page.click('.fam[data-family="x12"]');
  await page.click('#facts-addsub');
  const fd2 = await J(page, () => JSON.parse(localStorage.getItem(`trailBlazer.${window.__trailBlazer.app.currentPlayerId}.facts`)));
  check(fd2.sets.families.includes('x12') && fd2.sets.addSub === true, '×12 and "+ and − within 20" toggle on and are saved');
  await shot(page, layout, '19b-pz-families');
  await page.click('#facts-mode [data-value="custom"]');
  await page.fill('#facts-custom', '7 x 8\n56 / 7\nbanana\n34 + 19\n80 - 46\n5 / 2');
  await page.click('#facts-save');
  const cm = await J(page, () => ({ lines: [...document.querySelectorAll('#facts-msg [data-line]')].map((x) => x.dataset.line), text: document.querySelector('#facts-msg').textContent }));
  const fd3 = await J(page, () => JSON.parse(localStorage.getItem(`trailBlazer.${window.__trailBlazer.app.currentPlayerId}.facts`)));
  check(cm.lines.join(',') === '3,6' && /Line 3: "banana"/.test(cm.text) && /does not come out even/.test(cm.text), `Custom list: bad lines reported by number (${cm.lines.join(', ')})`);
  check(fd3.sets.custom.join(',') === '7x8,56/7,19+34,80-46' && fd3.sets.source === 'custom', `the good lines are saved (${fd3.sets.custom.join(', ')}), the Custom list is the set`);
  await shot(page, layout, '19c-pz-custom');
  await audit(page, layout.insets, 'Parent Zone (Facts: custom)');
  await page.click('#facts-mode [data-value="auto"]');
  const back = await J(page, () => ({ mode: JSON.parse(localStorage.getItem(`trailBlazer.${window.__trailBlazer.app.currentPlayerId}.facts`)).sets.mode,
    fr: (document.querySelector('#facts-frontier') || { dataset: {} }).dataset.families }));
  check(back.mode === 'auto' && back.fr === au.fr, `and back to Auto: saved, the same frontier (${back.fr} = ${au.fr})`);
  await page.click('.pz-tabs [data-tab="report"]');
  const rp = await J(page, () => ({ rows: [...document.querySelectorAll('#report-table tbody tr')].map((r) => r.dataset.op), summary: document.querySelector('#report-summary').textContent, races: document.querySelector('#report-races').textContent }));
  check(rp.rows.includes('x') && rp.rows.includes('/') && /practiced/.test(rp.summary) && /Pine Ridge/.test(rp.races), `Report: per operation counts (${rp.rows.join(' ')}), this week's races`);
  const play = await J(page, () => [...document.querySelectorAll('#report-play li')].map((x) => x.textContent));
  check(play.length === 1 && /· Play: \d+ races · \d+ stars? · \d+ crates? · streak 1 day$/.test(play[0]), `Report: the play line ("${play[0]}")`);
  const pat = await J(page, () => [...document.querySelectorAll('#report-patterns li')].map((x) => ({ kind: x.dataset.kind, text: x.textContent })));
  const patEmpty = await J(page, () => (document.querySelector('div#report-patterns') || {}).textContent || '');
  check(pat.every((x) => x.text.length > 10) && (pat.length > 0 || /No patterns this week yet/.test(patEmpty)),
    `Report → Patterns, in plain words: ${pat.map((x) => x.text).join(' · ') || patEmpty}`);
  const moved = await J(page, () => [...document.querySelectorAll('#report-moved li')].map((x) => x.textContent));
  check(moved.length >= 1 && moved.every((t) => /→ .* on [A-Z][a-z]{2} \d+/.test(t)) && moved.some((t) => /quick scouts|secure|Pit Crew|moving up/.test(t)), `Report → Moved up: ${moved.slice(0, 3).join(' | ')}`);
  check(await J(page, () => /(on target|a bit easy|a bit hard) \(\d+\/\d+\)/.test(document.querySelector('#report-dial').textContent)), 'Report: the dial, race by race');
  const rfr = await J(page, () => (document.querySelector('#report-frontier') || {}).textContent || '');
  check(/^Working on now: .{6,}/.test(rfr), `Report: what auto mode is working on, and why ("${rfr}")`);
  await page.click('#report-copy');
  await page.waitForTimeout(150);
  check(await J(page, () => !document.querySelector('#report-text').hidden && /Multiplication \(×\): New \d+ · Learning/.test(document.querySelector('#report-text').textContent)), 'Copy report: the plain-text report');
  // v1.6.2: the week's progress on top of the Report: "Ladder: n % of families secure", a bar, this week's gates
  const wkr = await J(page, async () => {
    const P = await import('/trail-blazer/src/facts/progress.js');
    const w = P.weekProgress(window.__trailBlazer.facts, Date.now());
    const el = document.querySelector('#report-week');
    return { w, first: document.querySelector('.pz-content').firstElementChild.id, big: el.querySelector('.pw-big').textContent, small: el.querySelector('.pw-small').textContent, bar: el.querySelector('.pw-bar i').style.width,
      copied: document.querySelector('#report-text').textContent };
  });
  check(wkr.first === 'report-week' && wkr.big === `Ladder: ${wkr.w.ladderPct} % of families secure` && wkr.bar === `${wkr.w.ladderPct}%`
    && wkr.small.startsWith(`This week: ${wkr.w.rightPct} % right at the gates (${wkr.w.rightThisWeek} of ${wkr.w.gatesThisWeek})`) && wkr.w.gatesThisWeek > 0,
    `Report: "${wkr.big}" with a bar, "${wkr.small}"`);
  check(wkr.copied.includes(wkr.big) && wkr.copied.includes(wkr.small.split(' · ')[0]), 'Copy report includes the week\'s progress');
  await J(page, () => document.querySelector('#report-week').scrollIntoView({ block: 'start' }));
  await shot(page, layout, '20-pz-report');
  await audit(page, layout.insets, 'Parent Zone (Report)');
  await page.click('.pz-tabs [data-tab="options"]');
  check(await J(page, () => !!document.querySelector('#opt-gates [data-value="4"].on') && !!document.querySelector('#opt-aloud') && /Set in Spell Jump/.test(document.querySelector('#opt-voice').textContent)), 'Options: math gates per race (4), facts aloud, the voice (set in Spell Jump)');
  await page.click('#opt-gates [data-value="6"]');
  check(await J(page, () => JSON.parse(localStorage.getItem(`trailBlazer.${window.__trailBlazer.app.currentPlayerId}.facts`)).opts.gates === 6), 'math gates per race → 6, saved');
  await shot(page, layout, '21-pz-options');
  await audit(page, layout.insets, 'Parent Zone (Options)');
  await page.click('#opt-music');
  check(await J(page, () => JSON.parse(localStorage.getItem('trailBlazer.settings')).music === false), 'Options: Music off is saved in trailBlazer.settings');
  await page.click('#opt-music');
  await page.click('.pz-tabs [data-tab="players"]');
  await page.fill(`#pz-name-${pid}`, 'Mia B');
  await page.click(`[data-rename="${pid}"]`);
  const fam2 = await family(page);
  check(fam2.players[0].name === 'Mia B', 'Players: rename goes to the family record (profiles.renamePlayer)');
  check(await J(page, (n) => new RegExp(`^${n} of \\d+ trails on the podium`).test(document.querySelector('.pz-player .sub').textContent), podiums), `Players: shows trails on the podium on this device (${podiums})`);
  check(await J(page, (id) => !!document.querySelector(`#pz-reset-facts-${id}`), pid), 'Players: Reset facts data');
  await shot(page, layout, '22-pz-players');
  await audit(page, layout.insets, 'Parent Zone (Players)');
  await page.click('#pz-close');

  // ---------- reload persistence ----------
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  const tile = await J(page, (id) => { const t = document.querySelector(`[data-player="${id}"]`); return t && { name: t.querySelector('.pl-name').textContent, trails: t.querySelector('[data-trails]').dataset.trails }; }, pid);
  check(tile && tile.name === 'Mia B' && tile.trails === String(podiums), `after a reload the picker shows ${tile && tile.name} with ${podiums} trails on the podium`);
  await shot(page, layout, '23-players-reload');
  await page.click(`[data-player="${pid}"]`);
  await page.waitForSelector(visibleSel('#screen-title'));
  const save4 = await readSave(page);
  check(save4.cash === cashAfter && save4.vehicles.ranger150.levels.engine === 1 && save4.vehicles.quad.owned && save4.cups.rookie.trophy === 'gold' && save4.paint === 'orange' && save4.medals['pine-ridge'] === res.medal,
    `progress persists (cash ${save4.cash}, Ranger Engine ${save4.vehicles.ranger150.levels.engine}, the Quad, the Rookie trophy, paint ${save4.paint}, ${save4.medals['pine-ridge']} medal)`);
  check(await J(page, () => !!localStorage.getItem('trailBlazer.' + window.__trailBlazer.app.currentPlayerId + '.save') && !Object.keys(localStorage).some((k) => /^spellJump\.[^.]+\.save$/.test(k))), 'Trail Blazer writes only its own save key (no spellJump.<id>.save)');
  const fd4 = await J(page, () => { const S = window.__trailBlazer; return { recs: Object.keys(S.facts.records).length, xp: S.facts.xp, gates: S.facts.opts.gates, count: S.facts.today.count, custom: S.facts.sets.custom.length }; });
  const fd4p = await J(page, () => { const S = window.__trailBlazer; return { placement: !!S.facts.placement, mode: S.facts.sets.mode, fr: S.facts.frontier.families.length }; });
  check(fd4.recs >= 3 && fd4.xp > 0 && fd4.gates === 6 && fd4.count === today && fd4.custom === 4 && fd4p.placement && fd4p.mode === 'auto' && fd4p.fr >= 1,
    `facts persist after a reload (${fd4.recs} facts, ${fd4.xp} XP, ${fd4.gates} gates, today ${fd4.count}, ${fd4.custom} custom, placement, auto mode)`);

  check(errors.length === 0, `no console errors${errors.length ? ' — ' + errors.slice(0, 4).join(' | ') : ''}`);
  await ctx.close();
}

const srv = await ensureServer();
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
try {
  for (const layout of LAYOUTS.filter((l) => !process.env.ONLY || l.name === process.env.ONLY)) await runLayout(browser, layout);
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

// UI smoke test for Trail Blazer (v1.2: races with Math Gates) on the mock engine.
//   node trail-blazer/tools/ui-smoke.mjs            (serves the REPO ROOT on :8080 itself if nothing listens there)
//   SHOTS_DIR=/some/dir BASE_URL=http://localhost:8080 node trail-blazer/tools/ui-smoke.mjs
// At 844×390 and 390×844 (DPR 2, touch, simulated iPhone safe-area insets, ?mock=1&nosw=1):
//   player picker (first screen; Learning Lab + Spell Jump links same-origin) → Parents with no players (PIN set twice,
//   Family code tab first, the "own progress stays on this device" note, Players "No players yet") → "+ New player" on
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
    const st = await J(page, () => { const g = window.__trailBlazer.gate; return { results: window.__trailBlazer.screen === 'results', gate: g.open && g.state === 'ask', answer: g.answer }; });
    if (st.results) return true;
    if (st.gate) { await typeAnswer(page, st.answer); await page.waitForFunction(() => !window.__trailBlazer.gatePanel.isOpen, null, { timeout: 4000 }); }
    else await page.waitForTimeout(120);
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
  await page.waitForTimeout(150);
  check(await J(page, () => document.querySelector('#pz').hidden), 'tapping Done does not click through to the title (no ghost click on Parents)');
  const fam = await family(page);
  check(fam && fam.players.length === 1 && fam.players[0].name === 'Mia', "the new player is in Spell Jump's family record (spellJump.family)");
  const pid = await playerId(page);
  check(pid === fam.players[0].id, 'the new player is the current player');
  await page.waitForTimeout(300);
  await shot(page, layout, '04-title');
  await audit(page, layout.insets, 'title');
  check(await J(page, () => document.querySelector('#title-trails-text').textContent === 'Tracks 0 / 6' && /race/i.test(document.querySelector('#btn-ride').textContent)), 'title: "Tracks 0 / 6" and a RACE button');

  // ---------- track select ----------
  await page.click('#btn-ride');
  await page.waitForSelector(visibleSel('#screen-trails'));
  const cards = await J(page, () => [...document.querySelectorAll('[data-trail]')].map((c) => ({ id: c.dataset.trail, locked: c.classList.contains('locked'), num: c.querySelector('.trail-num').textContent })));
  check(cards.length === 6 && !cards[0].locked && cards.slice(1).every((c) => c.locked), `track select: 6 tracks, ${cards[0] && cards[0].id} open, the rest locked`);
  check(cards[0].num === 'Track 1', `cards say "Track" (${cards[0].num})`);
  await shot(page, layout, '05-tracks');
  await audit(page, layout.insets, 'track select');
  await page.click(`[data-trail="${cards[1].id}"]`);
  await page.waitForTimeout(150);
  check(await J(page, () => window.__trailBlazer.screen === 'trails'), 'a locked track does not start');

  // ---------- race 1: Pine Ridge, countdown → GO → backflip → crash + respawn → 2nd ----------
  await J(page, () => {
    const g = window.__trailBlazer.game;
    window.__starts = [];
    const s = g.start; g.start = (cfg) => { window.__starts.push({ trail: cfg.trail.id, gates: cfg.gates, paint: cfg.paint, decal: cfg.decal, stats: cfg.stats, race: cfg.race }); return s(cfg); };
    window.__opened = [];
    const o = g.openGate; g.openGate = (res) => { window.__opened.push({ ...res, timeAt: g.getState().timeSec }); return o(res); };
    // what the player sees: countdown numbers, banners, position badge values (in order)
    window.__seen = { counts: [], banners: [], places: [] };
    const watch = (sel, key) => new MutationObserver(() => { const el = document.querySelector(sel); const t = el.textContent.trim(); const arr = window.__seen[key]; if (t && arr[arr.length - 1] !== t) arr.push(t); })
      .observe(document.querySelector(sel), { childList: true, characterData: true, subtree: true });
    watch('#countdown-n', 'counts'); watch('#banner-text', 'banners'); watch('#hud-place', 'places');
  });
  await page.click('[data-trail="pine-ridge"]');
  await page.waitForFunction(() => window.__trailBlazer.screen === 'ride');
  const st = await J(page, () => window.__starts[0]);
  check(st && st.trail === 'pine-ridge' && st.gates === 4 && st.race && st.race.riders === 3 && st.race.name === 'Mia' && st.paint === 'sage',
    `race starts Pine Ridge with 4 Math Gates (the default), race: { riders: 3, name }, stock paint (gates ${st && st.gates})`);
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
  check(res.next, '2nd place unlocks "Next track"');
  const rf = await J(page, () => [...document.querySelectorAll('#res-facts .rf')].map((x) => ({ fact: x.dataset.fact, kind: x.dataset.kind, text: x.textContent })));
  check(rf.length === 4 && rf[0].kind === 'quick' && rf[1].kind === 'fixed' && rf.every((x) => /= \d+/.test(x.text)) && rf[0].text.includes('⚡') && rf[1].text.includes('↻'),
    `the race's facts: ${rf.map((x) => x.text).join(' · ')}`);
  check(res.callouts.includes('mission-progress') && res.callouts.includes('xp'), 'results: today\'s mission progress and the XP earned');
  const fd1 = await J(page, () => JSON.parse(localStorage.getItem(`trailBlazer.${window.__trailBlazer.app.currentPlayerId}.facts`)));
  check(fd1 && fd1.today.count === 4 && Object.keys(fd1.records).length >= 2 && fd1.xp > 0 && fd1.races.length === 1, `facts saved: ${Object.keys(fd1.records).length} facts, today ${fd1.today.count}, ${fd1.xp} XP`);
  check(fd1.records[g2.fact] && fd1.records[g2.fact].box === 0 && fd1.records[g2.fact].fixed === 1, `the fixed fact ${g2.fact} goes to box 0 for tomorrow (${JSON.stringify(fd1.records[g2.fact])})`);
  await shot(page, layout, '10-results');
  await audit(page, layout.insets, 'results (podium)');

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
  check(save2.levels.engine === 1 && save2.cash === cash0 - 300, `Engine upgrade: level 1 for $300 (cash ${cash0} → ${save2.cash}), saved`);
  await page.click('.style-chip[data-paint="orange"]');
  check((await readSave(page)).paint === 'orange', 'Blaze Orange paint (Pine Ridge finished) equips and is saved');
  const medalPaint = { gold: 'gold', silver: 'sky', bronze: 'pine' }[res.medal];
  check(await J(page, (id) => !document.querySelector(`.style-chip[data-paint="${id}"]`).classList.contains('locked'), medalPaint), `the ${res.medal} medal unlocked the ${medalPaint} paint`);
  await page.click('[data-style-tab="decal"]');
  await page.click('.style-chip[data-decal="mud"]');
  check((await readSave(page)).decal === 'mud', 'Mud Splats decal equips and is saved');
  check(await J(page, () => document.querySelector('.style-chip[data-decal="flames"]').classList.contains('locked') && /10 flips/.test(document.querySelector('.style-chip[data-decal="flames"]').textContent)), 'Flames decal locked: "Land 10 flips"');
  await shot(page, layout, '12-garage-after');

  // ---------- race 2: Granite Gap, pause + resume, finish 4th → the next track stays locked ----------
  await page.click('#btn-garage-ride');
  await page.waitForSelector(visibleSel('#screen-trails'));
  check(await J(page, () => !document.querySelector('[data-trail="granite-gap"]').classList.contains('locked') && !!document.querySelector('[data-trail="pine-ridge"] [data-medal]')), 'Granite Gap unlocked; Pine Ridge card shows its medal');
  check(await J(page, (t) => document.querySelector('[data-trail="pine-ridge"] [data-best-time]').dataset.bestTime === String(t), res.last.summary.timeSec), 'Pine Ridge card shows the best time');
  await shot(page, layout, '13-tracks-after');
  await J(page, () => { window.__mockScript = { aiTimes: [3, 3.5, 4], noCrash: true }; });
  await page.click('[data-trail="granite-gap"]');
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
  check(!res2.next && res2.callouts.includes('need-podium'), 'the next track stays locked: "Finish 3rd or better to open the next track"');
  const save3 = await readSave(page);
  check(save3.cash === save2.cash + res2.total && save3.bestPlace['granite-gap'] === 4, `banked ${res2.total} (cash ${save3.cash}); Granite Gap best place 4`);
  await shot(page, layout, '15-results-4th');

  // ---------- race 3: End race from the pause menu ----------
  await J(page, () => { window.__mockScript = { noCrash: true }; });
  await page.click('#res-again');
  await page.waitForFunction(() => window.__trailBlazer.screen === 'ride');
  await page.waitForFunction(() => window.__trailBlazer.game.getState().phase === 'ride', null, { timeout: 5000 });
  await page.waitForTimeout(500);
  await page.click('#btn-pause');
  await page.click('#pause-end');
  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 5000 });
  await page.waitForTimeout(1300);
  const res3 = await results(page);
  const sum3 = res3.rows.reduce((a, r) => a + r.value, 0);
  check(res3.title === 'Race over' && sum3 === res3.total && res3.time === 'DNF', `End race → "${res3.title}", time ${res3.time}, rows add up (${sum3} = ${res3.total})`);
  const save3b = await readSave(page);
  check(save3b.cash === save3.cash + res3.total, `banked ${res3.total} (cash ${save3b.cash})`);

  // ---------- Parent Zone from the title ----------
  await page.click('#res-garage');
  await page.click('[data-back="title"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  check(await J(page, () => document.querySelector('#title-trails-text').textContent === 'Tracks 1 / 6'), 'title: "Tracks 1 / 6" (podiums)');
  await shot(page, layout, '16-title-after');
  check(await J(page, () => /^Today: 8 \/ 12 math gates$/.test(document.querySelector('#title-mission-text').textContent) && /^Lv \d+$/.test(document.querySelector('#title-lv').textContent)), 'title: "Today: 8 / 12 math gates" and the level');

  // ---------- Fact Grid ----------
  await page.click('#btn-grid');
  await page.waitForSelector(visibleSel('#screen-grid'));
  const gridSt = await J(page, () => { const c = [...document.querySelectorAll('#fgrid .fg-cell')]; return { n: c.length, practiced: c.filter((x) => x.dataset.status !== 'New').map((x) => x.dataset.fact), off: c.filter((x) => x.classList.contains('off')).length }; });
  check(gridSt.n === 144 && gridSt.practiced.length >= 2, `Fact Grid: 12 × 12 cells, ${gridSt.practiced.length} practiced (${gridSt.practiced.join(', ')}), ${gridSt.off} outside this week's set`);
  const xFact = gridSt.practiced[0];
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
  check((await J(page, () => [...document.querySelectorAll('.pz-tabs [data-tab]')].map((t) => t.dataset.tab))).join(',') === 'sync,facts,options,report,players', 'tabs: Family code · Facts this week · Options · Report · Players');
  await page.click('.pz-tabs [data-tab="facts"]');
  check(await J(page, () => ['x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9'].every((f) => document.querySelector(`[data-family="${f}"]`).classList.contains('on')) && !document.querySelector('[data-family="x12"]').classList.contains('on')), 'Facts this week: ×2 … ×9 on (the stock set)');
  await page.click('[data-family="x12"]');
  await page.click('#facts-addsub');
  const fd2 = await J(page, () => JSON.parse(localStorage.getItem(`trailBlazer.${window.__trailBlazer.app.currentPlayerId}.facts`)));
  check(fd2.sets.families.includes('x12') && fd2.sets.addSub === true, '×12 and "+ and − within 20" toggle on and are saved');
  await page.fill('#facts-custom', '7 x 8\n56 / 7\nbanana\n34 + 19\n80 - 46\n5 / 2');
  await page.click('#facts-save');
  const cm = await J(page, () => ({ lines: [...document.querySelectorAll('#facts-msg [data-line]')].map((x) => x.dataset.line), text: document.querySelector('#facts-msg').textContent }));
  const fd3 = await J(page, () => JSON.parse(localStorage.getItem(`trailBlazer.${window.__trailBlazer.app.currentPlayerId}.facts`)));
  check(cm.lines.join(',') === '3,6' && /Line 3: "banana"/.test(cm.text) && /does not come out even/.test(cm.text), `custom problems: bad lines reported by number (${cm.lines.join(', ')})`);
  check(fd3.sets.custom.join(',') === '7x8,56/7,19+34,80-46', `the good lines are saved (${fd3.sets.custom.join(', ')})`);
  await shot(page, layout, '19-pz-facts');
  await audit(page, layout.insets, 'Parent Zone (Facts this week)');
  await page.click('.pz-tabs [data-tab="report"]');
  const rp = await J(page, () => ({ rows: [...document.querySelectorAll('#report-table tbody tr')].map((r) => r.dataset.op), summary: document.querySelector('#report-summary').textContent, races: document.querySelector('#report-races').textContent }));
  check(rp.rows.includes('x') && rp.rows.includes('/') && rp.rows.includes('+') && rp.rows.includes('-') && /practiced/.test(rp.summary) && /Pine Ridge/.test(rp.races), `Report: per operation counts (${rp.rows.join(' ')}), this week's races`);
  await page.click('#report-copy');
  await page.waitForTimeout(150);
  check(await J(page, () => !document.querySelector('#report-text').hidden && /Multiplication \(×\): New \d+ · Learning/.test(document.querySelector('#report-text').textContent)), 'Copy report: the plain-text report');
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
  check(await J(page, () => /1 of 6 tracks/.test(document.querySelector('.pz-player .sub').textContent)), 'Players: shows tracks on the podium on this device');
  check(await J(page, (id) => !!document.querySelector(`#pz-reset-facts-${id}`), pid), 'Players: Reset facts data');
  await shot(page, layout, '22-pz-players');
  await audit(page, layout.insets, 'Parent Zone (Players)');
  await page.click('#pz-close');

  // ---------- reload persistence ----------
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  const tile = await J(page, (id) => { const t = document.querySelector(`[data-player="${id}"]`); return t && { name: t.querySelector('.pl-name').textContent, trails: t.querySelector('[data-trails]').dataset.trails }; }, pid);
  check(tile && tile.name === 'Mia B' && tile.trails === '1', `after a reload the picker shows ${tile && tile.name} with 1 track on the podium`);
  await shot(page, layout, '23-players-reload');
  await page.click(`[data-player="${pid}"]`);
  await page.waitForSelector(visibleSel('#screen-title'));
  const save4 = await readSave(page);
  check(save4.cash === save3b.cash && save4.levels.engine === 1 && save4.paint === 'orange' && save4.medals['pine-ridge'] === res.medal, `progress persists (cash ${save4.cash}, Engine ${save4.levels.engine}, paint ${save4.paint}, ${save4.medals['pine-ridge']} medal)`);
  check(await J(page, () => !!localStorage.getItem('trailBlazer.' + window.__trailBlazer.app.currentPlayerId + '.save') && !Object.keys(localStorage).some((k) => /^spellJump\.[^.]+\.save$/.test(k))), 'Trail Blazer writes only its own save key (no spellJump.<id>.save)');
  const fd4 = await J(page, () => { const S = window.__trailBlazer; return { recs: Object.keys(S.facts.records).length, xp: S.facts.xp, gates: S.facts.opts.gates, count: S.facts.today.count, custom: S.facts.sets.custom.length }; });
  check(fd4.recs >= 3 && fd4.xp > 0 && fd4.gates === 6 && fd4.count === 8 && fd4.custom === 4, `facts persist after a reload (${fd4.recs} facts, ${fd4.xp} XP, ${fd4.gates} gates, today ${fd4.count}, ${fd4.custom} custom)`);

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

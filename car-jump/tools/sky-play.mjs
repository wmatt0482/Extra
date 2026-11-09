// Spell Jump v4.0: the Sky Era played for real, end to end, in the APP (not dev.html), with the REAL engine and the real sky data files.
//
//   node tools/sky-play.mjs                       (starts its own static server on 8791 for this folder)
//   BASE_URL=http://localhost:8791/spell-jump node tools/sky-play.mjs     (a dist/ build from `bash build.sh`)
//   SHOTS_DIR=/some/dir node tools/sky-play.mjs   (screenshots, deviceScaleFactor 2; default $TMPDIR/spell-jump-sky-play)
//   ONLY=landscape | portrait | rides
//
// One child (Mia), at 844x390 and 390x844:
//   1  a parent opens the Sky Era (Parents → Options), the child watches the ceremony (once, natural-voice clips only), the title is on the Sky tab
//   2  the era switch, the sky track list, the garage's Sky rides
//   3  race 1 on sky-1: launch word -> flight -> Spell Boost freeze (nothing ticks, no timer, the word is never on screen) -> spell panel -> correct word ->
//      boost -> the word's letter rings are flown -> results with "Spell Boost: +X m"; the mission count goes up by 2
//   4  race 2: a miss, fixed in the panel -> boost at power 0.5 (the child still flies the letter rings)
//   5  race 3: Spell Boost off in Parents → Options -> no freeze, no second panel, the mission goes up by 1
//   6  (rides) each of the three sky rides in flight, bought with Garage cash in the garage
// Always: the device voice is never used, no console errors, the car and the boost letter rings are big enough to read on a phone.
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startStaticServer, watchdog } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8791;
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'spell-jump-sky-play');
mkdirSync(SHOTS, { recursive: true });
const SIM = Number(process.env.SIM) || 3;          // the engine's sim speed (a test knob, ?sim=N): the flights are real, just quicker
const ONLY = process.env.ONLY || '';

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}

const LAYOUTS = [
  { name: 'landscape', width: 844, height: 390, insets: { t: 0, r: 47, b: 21, l: 47 } },
  { name: 'portrait', width: 390, height: 844, insets: { t: 47, r: 0, b: 34, l: 0 } },
];

const failures = [];
let nChecks = 0;
const check = (cond, msg) => { nChecks++; if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const J = (page, fn, arg) => page.evaluate(fn, arg);
const vis = (sel) => `${sel}:not([hidden])`;

async function shot(page, layout, name, wait = 200) {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(SHOTS, `${layout.name}-${name}.png`) });
}
const tapKeys = async (page, text) => { for (const ch of text) await page.tap(`#sp-keyboard [data-key="${ch === ' ' ? 'space' : ch}"]`); };
const mode = (page) => J(page, () => window.__spellJump.spellPanel.mode);
const waitMode = (page, m, timeout = 9000) => page.waitForFunction((x) => window.__spellJump.spellPanel.mode === x, m, { timeout });
const panelOpen = (page, timeout = 8000) => page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout }).then(() => true, () => false);
const panelClosed = (page, timeout = 9000) => page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout });
const readWords = (page) => J(page, () => JSON.parse(localStorage.getItem(`spellJump.${window.__spellJump.app.currentPlayerId}.words`)));
const readSave = (page) => J(page, () => JSON.parse(localStorage.getItem(`spellJump.${window.__spellJump.app.currentPlayerId}.save`)));

// the word is on screen anywhere (visible text, tiles side by side, inputs)?
async function visibleTextHas(page, word) {
  return J(page, (w) => {
    const ok = (el) => {
      if (!el || el.closest('[hidden]')) return false;
      for (let p = el; p; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false; }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let text = '';
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent.trim() && ok(n.parentElement)) text += n.textContent;
    const vals = [...document.querySelectorAll('textarea, input')].filter(ok).map((e) => e.value).join(' ');
    const flat = (s) => s.toLowerCase().replace(/[\s·]+/g, '');
    return flat(text).includes(flat(w)) || flat(vals).includes(flat(w));
  }, word);
}

// a new browser context with Mia, wordsPerRace 1, levelsPerRace 1, a fake device voice (it must never speak) and a fake natural voice
async function newChild(browser, layout, { cash = 0, days = 3, options = {}, sky = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: [] });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  await ctx.route('**/api/family/**', (r) => r.abort());
  let ttsHit = false;
  await ctx.route('**/api/tts/**', (r) => { ttsHit = true; return r.abort(); });
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|api\/family|ERR_FAILED|\/lab\/src\/|Failed to load resource/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await page.addInitScript(({ insets, cash, dayList, options, sky }) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.clear();
      const now = Date.now();
      localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, players: [{ id: 'pmia', name: 'Mia', color: '#3b7dd9', createdAt: now, updatedAt: now }], pinHash: null, pinUpdatedAt: 0,
        options: { pmia: { wordsPerRace: 1, levelsPerRace: 1, cloudVoice: 'en-US-Neural2-F', ...options } }, optionsUpdatedAt: { pmia: now }, removedPlayers: [], migrated: true, lastPlayer: 'pmia' }));
      localStorage.setItem('spellJump.sync', JSON.stringify({ v: 1, code: 'ABCD-2345', deviceId: 'devS', keys: {} }));
      const save = { v: 2, cash, seen: { coach: true, teaser: true, skyClip: 15 }, streak: { count: dayList.length, best: dayList.length, lastDay: dayList[dayList.length - 1], days: dayList } };
      if (sky) save.sky = sky;
      localStorage.setItem('spellJump.pmia.save', JSON.stringify(save));
      sessionStorage.setItem('seeded', '1');
    }
    window.__noClassLists = true;
    window.__cloudAsked = []; window.__cloudPlayed = []; window.__spoken = [];
    // the device voice: records anything it is asked to say (it must stay empty: the natural voice is the only voice here)
    window.__ttsBackend = {
      speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); },
      cancel() {}, addEventListener() {},
    };
    const hex = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(8, '0').repeat(4); };
    window.__cloudVoiceBackend = {
      async status() { return { key: true }; },
      async prepare({ code, voice, texts }) {
        window.__cloudAsked.push({ code, voice, texts });
        const clips = {};
        for (const t of texts) clips[t] = '/api/tts/clip/' + hex(voice + '\n' + t);
        return { status: 200, body: { clips, generated: texts.length, cached: 0, charsToday: 100 } };
      },
      async load(url, text) { return { url, text, duration: 0.03 }; },
      play(buf, text) { window.__cloudPlayed.push(text); return new Promise((r) => setTimeout(() => r(true), 25)); },
      stop() {},
    };
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(st);
    });
  }, { insets: layout.insets, cash, dayList: ['2026-11-06', '2026-11-07', '2026-11-08'].slice(0, days), options, sky });
  const go = async () => {
    await page.goto(`${BASE}/index.html?nosw=1&sim=${SIM}`, { waitUntil: 'networkidle' });
    await page.waitForSelector(vis('#screen-players'));
    await page.click('[data-player="pmia"]');
    await page.waitForSelector(vis('#screen-title'));
  };
  return { ctx, page, errors, go, ttsHit: () => ttsHit };
}

// the screen size of the car and the boost letter rings, from the engine's own camera (CSS px)
const camera = (page) => J(page, () => {
  const g = window.__spellJump.game, d = g.debugInfo(), W = d.view.W, H = d.view.H, z = d.cam.z;
  const toScreen = (x, y) => ({ x: (x - d.cam.x) * z + W / 2, y: H / 2 - (y - d.cam.y) * z });
  const rings = d.letterRings.filter((r) => r.bw).map((r) => { const p = toScreen(r.x, r.y); return { letter: r.letter, i: r.i, hit: r.hit, sx: Math.round(p.x), sy: Math.round(p.y), on: p.x > 0 && p.x < W && p.y > 0 && p.y < H }; });
  const car = toScreen(d.x, d.y);
  return { W, H, z, carPx: d.carHalf * 2 * z, car: { x: Math.round(car.x), y: Math.round(car.y) }, phase: d.phase, rings, x: d.x, y: d.y, vx: d.vx, vy: d.vy };
});
const hudText = (page) => J(page, () => ['#hud-distance', '#hud-cash', '#hud-speed', '#hud-alt-v', '#hud-nitro'].map((s) => { const e = document.querySelector(s); return e ? (e.textContent + '|' + (e.style.width || '') + (e.style.transform || '')) : ''; }).join(' / '));

// spell the launch word in the panel (first try). Returns the word.
async function launchWord(page) {
  check(await panelOpen(page), 'the launch word panel opens');
  if (await mode(page) === 'look') await waitMode(page, 'write', 9000);
  const w = await J(page, () => window.__spellJump.spellPanel.word);
  await tapKeys(page, w); await page.tap('#sp-keyboard [data-key="enter"]');
  await panelClosed(page);
  return w;
}

// the gas (and nitro) held down, or let go
async function holdGas(page, on) {
  if (on) { await page.keyboard.down('ArrowRight'); await page.keyboard.down('Shift'); } else { await page.keyboard.up('ArrowRight'); await page.keyboard.up('Shift'); }
}

async function startSkyRace(page, track = 'sky-1') {
  await instrument(page);
  await page.click('#btn-race'); await page.waitForSelector(vis('#screen-tracks'));
  await page.click(`[data-track="${track}"]`);
}

// record the engine calls of the next race (start / freeze / boost) in window.__seq
const instrument = (page) => J(page, () => {
  const g = window.__spellJump.game;
  window.__seq = [];
  window.__snaps = {};
  // a picture of the boost rings on screen at exact moments of the lap: two frames after the scene runs again, and as the first ring is flown
  const snap = (name) => {
    const d = g.debugInfo(); if (!d) return;
    const W = d.view.W, H = d.view.H, z = d.cam.z;
    const rings = d.letterRings.filter((r) => r.bw).map((r) => { const sx = (r.x - d.cam.x) * z + W / 2, sy = H / 2 - (r.y - d.cam.y) * z; return { hit: r.hit, sx: Math.round(sx), sy: Math.round(sy), on: sx > -1.2 * z && sx < W + 1.2 * z && sy > -1.25 * z && sy < H + 1.25 * z } ; });   // "on": at least ~3/4 of the ring is in the frame
    window.__snaps[name] = { z, W, H, rings, ahead: rings.filter((r) => r.on && !r.hit).length, carPx: d.carHalf * 2 * z };
  };
  if (window.__lapPoll) clearInterval(window.__lapPoll);
  window.__lapPoll = setInterval(() => { try { const h = g.getHudState(); if (window.__snaps.start && h.boostLetters.collected >= 1 && !window.__snaps.ring1) snap('ring1'); } catch (_) {} }, 16);
  window.__snapFn = snap;
  if (!g.__wrapped) {
    g.__wrapped = true;
    for (const k of ['freeze', 'boost', 'start']) { const o = g[k].bind(g); g[k] = (...a) => { if (k === 'freeze' && a[0] === false) requestAnimationFrame(() => requestAnimationFrame(() => window.__snapFn('start'))); window.__seq.push(k === 'start' ? ['start', a[0].track.id, a[0].spellBoost, a[0].car.id] : k === 'boost' ? ['boost', a[0].power, a[0].word] : ['freeze', a[0]]); return o(...a); }; }
  }
});

// one Sky race through the Spell Boost. boost: 'first' | 'miss' | 'off'. prefix: the screenshots' name
async function skyRace(page, layout, { boost, prefix }) {
  const words0 = (await readWords(page)).today.count;
  const w1 = await launchWord(page);
  await page.waitForTimeout(300);
  const st0 = await J(page, () => window.__seq.find((s) => s[0] === 'start'));
  check(st0 && st0[1] === 'sky-1' && st0[2] === (boost !== 'off'), `${prefix}: the real engine starts sky-1 with spellBoost ${boost !== 'off'}`);
  await holdGas(page, true);
  // the first flight: a mid-flight picture once it is well in the air
  await page.waitForFunction(() => { const d = window.__spellJump.game.debugInfo(); return d && d.phase === 'air'; }, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const c1 = await camera(page);
  await shot(page, layout, `${prefix}-flight`, 0);
  console.log(`    flight camera: car ${c1.carPx.toFixed(0)} px at ${c1.car.x},${c1.car.y} of ${c1.W}x${c1.H} (z ${c1.z.toFixed(2)})`);
  if (boost === 'off') {
    const seenPanel = await panelOpen(page, 12000);
    check(!seenPanel, `${prefix}: Spell Boost off: no second spell panel opens in the flight`);
    await page.waitForSelector(vis('#screen-results'), { timeout: 150000 });
    await holdGas(page, false);
    const sq = await J(page, () => window.__seq);
    check(!sq.some((s) => s[0] === 'freeze' || s[0] === 'boost'), `${prefix}: the engine is never frozen and never boosted (${JSON.stringify(sq.map((s) => s[0]))})`);
    const words1 = (await readWords(page)).today.count;
    check(words1 - words0 === 1, `${prefix}: the mission count goes up by 1 (${words0} → ${words1})`);
    check(await J(page, () => !document.querySelector('#res-pay tr[data-pay="boost"]')), `${prefix}: no Spell Boost line in the results`);
    return { w1, flightCarPx: c1.carPx };
  }
  // the Spell Boost: the engine freezes at the gate and the panel opens by itself
  check(await panelOpen(page, 40000), `${prefix}: past the apex the spell panel opens by itself (the Spell Boost)`);
  await holdGas(page, false);
  const f1 = await J(page, () => { const g = window.__spellJump.game, h = g.getHudState(), s = g.getState(); return { frozen: h.frozen, ready: h.boostReady, used: h.boostUsed, d: s.distance, air: s.airTime, alt: s.altitude, letters: h.boostLetters }; });
  check(f1.frozen && f1.ready && !f1.used, `${prefix}: the engine is frozen at the gate, boost ready (frozen ${f1.frozen}, ready ${f1.ready})`);
  check(await J(page, () => document.querySelector('#sp-boost') && document.querySelector('#sp-boost').textContent === 'Spell Boost' && document.querySelector('#spell').dataset.kind === 'boost'), `${prefix}: the panel is the launch word's panel with a "Spell Boost" chip`);
  check(f1.letters.total === 0, `${prefix}: no boost letter rings exist before the word is spelled (${f1.letters.total})`);
  const look = await mode(page) === 'look';
  if (look) await shot(page, layout, `${prefix}-boost-panel-look`, 0);
  await page.waitForTimeout(1200);
  const hud1 = await hudText(page);
  if (look) await waitMode(page, 'write', 9000);
  const bw = await J(page, () => window.__spellJump.spellPanel.word);
  check(bw !== w1, `${prefix}: the boost word "${bw}" is another word than the launch word "${w1}"`);
  check(!(await visibleTextHas(page, bw)), `${prefix}: the boost word is nowhere on screen while it is being spelled`);
  await page.waitForTimeout(1600);
  const f2 = await J(page, () => { const g = window.__spellJump.game, s = g.getState(); return { frozen: g.getHudState().frozen, d: s.distance, air: s.airTime, alt: s.altitude }; });
  check(f2.frozen && f2.d === f1.d && f2.air === f1.air && f2.alt === f1.alt, `${prefix}: nothing ticks while the child spells (distance ${f1.d.toFixed(2)} → ${f2.d.toFixed(2)}, air ${f1.air.toFixed(2)} → ${f2.air.toFixed(2)})`);
  check((await hudText(page)) === hud1, `${prefix}: the HUD numbers do not change while frozen`);
  check(await J(page, () => !/\b\d{1,2}:\d{2}\b|countdown|timer|seconds left|hurry/i.test(document.querySelector('#spell').innerText + ' ' + document.querySelector('#hud').innerText)), `${prefix}: no timer, no countdown on screen`);
  check(await J(page, () => document.documentElement.classList.contains('spelling')), `${prefix}: the HUD and driving controls are hidden (a calm scene)`);
  const cf = await camera(page);
  await shot(page, layout, `${prefix}-boost-panel`, 0);
  console.log(`    frozen camera: car ${cf.carPx.toFixed(0)} px (z ${cf.z.toFixed(2)})`);
  if (boost === 'miss') {
    const wrong = bw.slice(0, -2) + (bw.at(-1) === 'x' ? 'q' : 'x');
    await tapKeys(page, wrong); await page.tap('#sp-keyboard [data-key="enter"]');
    await waitMode(page, 'compare', 3000);
    await waitMode(page, 'copy', 6000); await page.waitForTimeout(150);
    await tapKeys(page, bw); await page.tap('#sp-keyboard [data-key="enter"]');
    await waitMode(page, 'cover', 3000);
    await tapKeys(page, bw); await page.tap('#sp-keyboard [data-key="enter"]');
  } else {
    await tapKeys(page, bw); await page.tap('#sp-keyboard [data-key="enter"]');
  }
  await panelClosed(page);
  await page.waitForTimeout(120);
  const sq = await J(page, () => window.__seq.filter((s) => s[0] !== 'start'));
  const wantPower = boost === 'miss' ? 0.5 : 1;
  check(JSON.stringify(sq.slice(0, 2)) === JSON.stringify([['boost', wantPower, bw], ['freeze', false]]), `${prefix}: game.boost({ power: ${wantPower}, word }) then game.freeze(false)`);
  check(await J(page, () => !window.__spellJump.game.getHudState().frozen), `${prefix}: the scene runs again`);
  // the boost: the letter rings exist now, and the child flies them
  await holdGas(page, true);
  const lt = await J(page, () => window.__spellJump.game.getHudState().boostLetters);
  check(lt.total > 0, `${prefix}: the boost letter rings appear only after spelling (${lt.total} for "${bw}")`);
  // the lap: the word's rings must be in the frame as it starts (two frames after the boost) and as the first ring is flown
  const lap1 = await page.waitForFunction(() => window.__snaps.ring1, null, { timeout: 15000, polling: 30 }).then(() => true, () => false);
  check(lap1, `${prefix}: the first letter ring is flown`);
  const snaps = await J(page, () => window.__snaps);
  const cb = await camera(page);
  await shot(page, layout, `${prefix}-boost`, 0);
  const sA = snaps.start || { ahead: 0, rings: [], z: 0, carPx: 0 }, sB = snaps.ring1 || { ahead: 0, rings: [], z: 0, carPx: 0 };
  console.log(`    lap camera: start ${sA.ahead} ahead (z ${sA.z.toFixed(2)}) ${JSON.stringify(sA.rings.map((r) => [r.sx, r.sy]))}; first ring flown: ${sB.ahead} ahead (z ${sB.z.toFixed(2)}) ${JSON.stringify(sB.rings.map((r) => [r.sx, r.sy]))}`);
  const readable = Math.min(sA.ahead, sB.ahead);
  const lap = await page.waitForFunction(() => window.__spellJump.game.getHudState().boostLetters.collected >= 2, null, { timeout: 25000 }).then(() => true, () => false);
  if (lap) await shot(page, layout, `${prefix}-lap`, 0);
  await page.waitForSelector(vis('#screen-results'), { timeout: 150000 });
  await holdGas(page, false);
  await page.waitForTimeout(1300);
  const rl = await J(page, () => { const tr = document.querySelector('#res-pay tr[data-pay="boost"]'); return tr ? { text: tr.textContent, power: tr.dataset.power, meters: Number(tr.dataset.meters) } : null; });
  check(rl && /^Spell Boost: \+\d[\d,]* m/.test(rl.text) && rl.meters > 0 && Number(rl.power) === wantPower && rl.text.includes(bw), `${prefix}: results: "${rl && rl.text}"`);
  const words1 = await readWords(page);
  check(words1.today.count - words0 === 2, `${prefix}: the mission count goes up by 2 (${words0} → ${words1.today.count})`);
  if (boost === 'miss') check(words1.records[bw] && words1.records[bw].misses >= 1, `${prefix}: the boost word's record has the miss`);
  await shot(page, layout, `${prefix}-results`, 200);
  return { w1, bw, rl, rings: sA.rings.length, readable, ringPx: 5 * Math.min(sA.z, sB.z), carPx: Math.min(sA.carPx, sB.carPx), frozenCarPx: cf.carPx, flightCarPx: c1.carPx };
}

async function parentOpensSky(page, layout) {
  await page.click('#btn-parents');
  await page.waitForSelector(vis('#pz'));
  for (let i = 0; i < 2; i++) { for (const d of '1234') await page.click(`.pinpad [data-digit="${d}"]`); await page.waitForTimeout(250); }
  await page.waitForSelector('.pz-content[data-tab]');
  await page.click('.pz-tabs [data-tab="options"]');
  await page.waitForSelector('#opt-sky-open');
  await J(page, () => document.querySelector('#opt-sky-open-row').scrollIntoView({ block: 'center' }));
  await shot(page, layout, '01-parent-options', 200);
  await page.click('#opt-sky-open');
  await page.click('#opt-sky-open-yes');
  await page.waitForFunction(() => document.querySelector('#opt-sky-open-row').dataset.unlocked === 'true', null, { timeout: 3000 });
  await page.keyboard.press('Escape');
  await page.waitForSelector(vis('#screen-title'));
}

async function mainFlow(browser, layout) {
  console.log(`\n=== ${layout.name} ${layout.width}x${layout.height}: the Sky Era, end to end ===`);
  const { ctx, page, errors, go, ttsHit } = await newChild(browser, layout, { cash: 30000000 });
  await go();
  check(await J(page, () => window.__spellJump.app.skyFor('pmia').available), 'the real sky data files are loaded');
  check(await J(page, () => !document.querySelector('#btn-sky').hidden && document.querySelector('#era-switch').hidden), 'before the unlock the title has the Sky Road card, no era tabs');
  // 1: the parent override, the ceremony
  await parentOpensSky(page, layout);
  check(await page.waitForFunction(() => window.__spellJump.sky.isOpen, null, { timeout: 8000 }).then(() => true, () => false), 'the Sky Era ceremony plays by itself on the title');
  const cer = await J(page, () => window.__spellJump.sky.state);
  check(cer && cer.kind === 'open', `the ceremony is the unlock ceremony ("${cer && cer.caption}")`);
  await shot(page, layout, '02-ceremony-a', 1500);
  await shot(page, layout, '03-ceremony-b', 3000);
  await shot(page, layout, '04-ceremony-c', 3200);
  await page.waitForFunction(() => !window.__spellJump.sky.isOpen, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const sv0 = await readSave(page);
  check(sv0.sky && sv0.sky.unlocked && sv0.sky.ceremonySeen && sv0.sky.era === 'sky', `the ceremony is seen once and the title is on the Sky tab (${JSON.stringify(sv0.sky)})`);
  check(await J(page, () => !document.querySelector('#era-switch').hidden && document.querySelector('#era-switch .era-tab.on').dataset.era === 'sky'), 'the title shows the Earth / Sky tabs, on Sky');
  check(await J(page, () => window.__cloudPlayed.some((t) => /Sky Era is open/i.test(t))), 'the ceremony line is the natural voice');
  await shot(page, layout, '05-title-sky-tab', 300);
  await page.click('#era-switch .era-tab[data-era="earth"]'); await shot(page, layout, '06-title-earth-tab', 250);
  await page.click('#era-switch .era-tab[data-era="sky"]');
  // 2: garage + track list
  await page.click('#btn-play'); await page.waitForSelector(vis('#screen-garage'));
  await page.waitForTimeout(400);
  const g1 = await J(page, () => ({ chips: [...document.querySelectorAll('#sky-rides .sr-chip')].map((c) => c.dataset.ride), name: document.querySelector('#car-name').textContent }));
  check(g1.chips.join() === 'hoverbike,rocketcar,mechwalker' && g1.name === 'Hover Bike', `the garage opens on the Sky rides (${g1.chips.join(' ')}, "${g1.name}")`);
  await shot(page, layout, '07-garage-sky-rides', 300);
  // Mia drives her Earth car (the Beater) on the first races: Earth cars can fly the sky, only worse
  await page.click('#btn-race'); await page.waitForSelector(vis('#screen-tracks'));
  const names = await J(page, () => [...document.querySelectorAll('#track-grid .track-card')].map((c) => `${c.dataset.track}${c.classList.contains('locked') ? ':locked' : ''}`));
  check(names.join() === 'sky-1,sky-2:locked,sky-3:locked,sky-4:locked,sky-5:locked', `the sky track list: ${names.join(' ')}`);
  await shot(page, layout, '08-sky-tracks', 300);
  // 3: race 1
  console.log('  -- race 1: the Spell Boost, first try');
  const mission0 = (await readWords(page)).today.count;
  await instrument(page);
  await page.click('[data-track="sky-1"]');
  const r1 = await skyRace(page, layout, { boost: 'first', prefix: '10-race1' });
  // 4: race 2: a miss, fixed
  console.log('  -- race 2: a miss, fixed in the panel');
  await instrument(page);
  await page.click('#res-retry');
  const r2 = await skyRace(page, layout, { boost: 'miss', prefix: '11-race2' });
  const missionN = (await readWords(page)).today.count;
  check(missionN - mission0 === 4, `two Sky races = 4 retrievals toward today's mission (${mission0} → ${missionN})`);
  // 5: Spell Boost off
  console.log('  -- race 3: Spell Boost off in Parents → Options');
  await page.click('#res-garage'); await page.waitForSelector(vis('#screen-garage'));
  await J(page, async () => {
    const S = window.__spellJump, P = await import(new URL('src/spelling/profiles.js', document.baseURI).href);
    P.setPlayerOption(S.app.family, S.app.currentPlayerId, 'skyBoost', false); S.app.persistFamily(); S.app.onOptionsChanged(S.app.currentPlayerId);
  });
  await startSkyRace(page);
  await skyRace(page, layout, { boost: 'off', prefix: '12-race3' });
  // readability: the car and the boost rings on a phone
  const minSide = Math.min(layout.width, layout.height);
  for (const [n, r] of [['race 1', r1], ['race 2', r2]]) {
    check(r.flightCarPx >= minSide * 0.1, `${n}: the car reads in flight: ${r.flightCarPx.toFixed(0)} px = ${(100 * r.flightCarPx / minSide).toFixed(0)} % of ${minSide} (need >= 10 %)`);
    check(r.frozenCarPx >= minSide * 0.1, `${n}: the car reads in the frozen scene: ${r.frozenCarPx.toFixed(0)} px`);
    check(r.carPx >= minSide * 0.1, `${n}: the car reads during the boost: ${r.carPx.toFixed(0)} px`);
    check(r.rings >= 3 && r.readable >= 1, `${n}: a boost letter ring is ahead on screen both as the lap starts and as the first ring is flown (min ${r.readable} of ${r.rings})`);
    check(r.ringPx >= minSide * 0.1, `${n}: a letter ring reads: ${r.ringPx.toFixed(0)} px tall = ${(100 * r.ringPx / minSide).toFixed(0)} % of ${minSide}`);
  }
  const spoken = (await J(page, () => window.__spoken.slice())).filter((t) => t !== 'ready');   // 'ready' = the silent iOS gesture unlock, not speech
  check(spoken.length === 0, `the device voice was never used (the natural voice only)${spoken.length ? ': ' + JSON.stringify(spoken.slice(0, 6)) : ''}`);
  check(!ttsHit(), 'no request reached /api/tts (the fake backend answered everything)');
  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

// each sky ride in flight (bought with Garage cash)
async function ridesFlow(browser, layout) {
  console.log(`\n=== ${layout.name}: the three sky rides in flight ===`);
  const { ctx, page, errors, go } = await newChild(browser, layout, { cash: 40000000, sky: { unlocked: true, at: 5, ceremonySeen: true, era: 'sky' } });
  await go();
  await page.click('#btn-play'); await page.waitForSelector(vis('#screen-garage'));
  for (const id of ['hoverbike', 'rocketcar', 'mechwalker']) {
    await page.click(`#sky-rides .sr-chip[data-ride="${id}"]`);
    await page.waitForTimeout(250);
    const owned = (await readSave(page)).owned;
    if (!owned.includes(id)) { await page.click('#car-action'); await page.waitForTimeout(300); }
    await page.click('#btn-race'); await page.waitForSelector(vis('#screen-tracks'));
    await page.click('[data-track="sky-1"]');
    await launchWord(page);
    await page.waitForTimeout(300);
    await holdGas(page, true);
    await page.waitForFunction(() => { const d = window.__spellJump.game.debugInfo(); return d && d.phase === 'air'; }, null, { timeout: 30000 });
    await page.waitForTimeout(500);
    const c = await camera(page);
    await shot(page, layout, `20-ride-${id}-flight`, 0);
    check(c.carPx >= Math.min(layout.width, layout.height) * 0.1, `${id}: the ride reads in flight: ${c.carPx.toFixed(0)} px`);
    // let the boost play out with a correct word so the run ends cleanly
    if (await panelOpen(page, 40000)) {
      await page.waitForTimeout(1500);   // a child takes a moment to spell (and the frozen camera settles)
      if (await mode(page) === 'look') await waitMode(page, 'write', 9000);
      const bw = await J(page, () => window.__spellJump.spellPanel.word);
      await holdGas(page, false);
      await tapKeys(page, bw); await page.tap('#sp-keyboard [data-key="enter"]');
      await panelClosed(page);
      await holdGas(page, true);
      await page.waitForTimeout(150);
      const cl = await camera(page);
      await shot(page, layout, `21-ride-${id}-boost`, 0);
      check(cl.carPx >= Math.min(layout.width, layout.height) * 0.1, `${id}: the ride reads in the boost lap: ${cl.carPx.toFixed(0)} px (z ${cl.z.toFixed(1)}, ${cl.W}x${cl.H})`);
    }
    await page.waitForSelector(vis('#screen-results'), { timeout: 150000 });
    await holdGas(page, false);
    await page.click('#res-garage'); await page.waitForSelector(vis('#screen-garage'));
  }
  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

watchdog('sky-play');
const srv = process.env.BASE_URL ? null : await startStaticServer({ cwd: root, port: PORT });
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
try {
  for (const l of LAYOUTS) {
    if (!ONLY || ONLY === l.name) await mainFlow(browser, l);
    if (!ONLY || ONLY === 'rides' || ONLY === l.name + '-rides') await ridesFlow(browser, l);
  }
} catch (e) {
  failures.push('exception: ' + e.message);
  console.error(e);
} finally {
  await browser.close().catch((e) => console.error('browser.close', e));
  if (srv) await srv.stop();
}
console.log(`\nScreenshots: ${SHOTS}`);
console.log(`${nChecks - failures.length} / ${nChecks} checks passed`);
if (failures.length) { console.log(`\nFAILED (${failures.length}):\n- ` + failures.join('\n- ')); process.exit(1); }
console.log('\nALL CHECKS PASSED');

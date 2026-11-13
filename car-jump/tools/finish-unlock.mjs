// Spell Jump v4.0.3: crossing the finish line of an Earth track unlocks the next track, played for real in the APP with the REAL engine.
//
//   node tools/finish-unlock.mjs                       (starts its own static server on 8793 for this folder)
//   BASE_URL=http://localhost:8851/spell-jump node tools/finish-unlock.mjs     (a dist/ build from `bash build.sh`)
//
// The bug it guards (4.0.2 and before): with levels per race on (the default: 3), finishing Level 1 starts Level 2 with its own spell
// panel; a child who left from that panel with the back button lost the whole round (quitRun recorded nothing), so the finish line they
// had just crossed ("FINISH LINE!", "Unlocked: Downtown Drop") never unlocked the next track, every time. Now the levels already cleared
// are banked like "End run" (cash, best, the unlock) and the results show.
// One child (Nathan) with a Bigfoot Jr. at 10/10 (it clears Climb Canyon's 400 m), one word per race, the natural voice faked as in
// tools/sky-play.mjs (the device voice must stay silent), the engine at ?sim=3:
//   A  one level per race: cross the finish → results "Unlocked: Downtown Drop!", save.unlocked has city (memory, localStorage, after reload)
//   B  three levels: cross Level 1's finish → Level 2's spell panel → the back button → results for Level 1 with the unlock (the bug)
//   C  three levels: cross Level 1's finish → spell Level 2's word → pause → End run → the unlock
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startStaticServer, watchdog } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8793;
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;
const SIM = Number(process.env.SIM) || 3;

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}

const failures = [];
let nChecks = 0;
const check = (cond, msg) => { nChecks++; if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const J = (page, fn, arg) => page.evaluate(fn, arg);
const vis = (sel) => `${sel}:not([hidden])`;
const readSave = (page) => J(page, () => JSON.parse(localStorage.getItem('spellJump.pnat.save')));

async function newChild(browser, levels) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  await ctx.route('**/api/family/**', (r) => r.abort());
  await ctx.route('**/api/tts/**', (r) => r.abort());
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|api\/family|api\/tts|ERR_FAILED|\/lab\/src\/|Failed to load resource/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await page.addInitScript(({ levels }) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.clear();
      const now = Date.now();
      localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, players: [{ id: 'pnat', name: 'Nathan', color: '#3b7dd9', createdAt: now, updatedAt: now }], pinHash: null, pinUpdatedAt: 0,
        options: { pnat: { wordsPerRace: 1, levelsPerRace: levels, cloudVoice: 'en-US-Neural2-F' } }, optionsUpdatedAt: { pnat: now }, removedPlayers: [], migrated: true, lastPlayer: 'pnat' }));
      localStorage.setItem('spellJump.sync', JSON.stringify({ v: 1, code: 'ABCD-2345', deviceId: 'devF', keys: {} }));
      const lv = { engine: 10, nitro: 10, suspension: 10, bonus: 10 };
      localStorage.setItem('spellJump.pnat.save', JSON.stringify({ v: 2, cash: 1000, owned: ['beater', 'monster'], selectedCar: 'monster', levels: { monster: lv }, seen: { coach: true, teaser: true, skyClip: 15 } }));
      sessionStorage.setItem('seeded', '1');
    }
    window.__noClassLists = true;
    window.__noSkyTeaser = true;
    window.__spoken = [];
    window.__ttsBackend = {
      speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); },
      cancel() {}, addEventListener() {},
    };
    const hex = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(8, '0').repeat(4); };
    window.__cloudVoiceBackend = {
      async status() { return { key: true }; },
      async prepare({ voice, texts }) { const clips = {}; for (const t of texts) clips[t] = '/api/tts/clip/' + hex(voice + '\n' + t); return { status: 200, body: { clips, generated: texts.length, cached: 0, charsToday: 100 } }; },
      async load(url, text) { return { url, text, duration: 0.03 }; },
      play() { return new Promise((r) => setTimeout(() => r(true), 25)); },
      stop() {},
    };
  }, { levels });
  const open = async () => {
    await page.goto(`${BASE}/index.html?nosw=1&sim=${SIM}`, { waitUntil: 'networkidle' });
    await page.waitForSelector(vis('#screen-players'));
    await page.click('[data-player="pnat"]');
    await page.waitForSelector(vis('#screen-title'));
  };
  return { ctx, page, errors, open };
}

async function toCanyon(page) {
  check(await J(page, () => window.__spellJump.app.engineName === ''), `the real engine (src/game/engine.js, not the mock: "${await J(page, () => window.__spellJump.app.engineName)}")`);
  const s0 = await readSave(page);
  check(!s0.unlocked.includes('city'), `before: Downtown Drop is locked (${s0.unlocked.join(' ')})`);
  await page.click('#btn-play'); await page.waitForSelector(vis('#screen-garage'));
  await page.click('#btn-race'); await page.waitForSelector(vis('#screen-tracks'));
  await page.click('[data-track="canyon"]');
}
// the race's word, spelled first try in the panel
async function spellWord(page) {
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 15000 });
  await page.waitForFunction(() => window.__spellJump.spellPanel.mode === 'write', null, { timeout: 15000 });
  const w = await J(page, () => window.__spellJump.spellPanel.word);
  for (const ch of w) await page.tap(`#sp-keyboard [data-key="${ch === ' ' ? 'space' : ch}"]`);
  await page.tap('#sp-keyboard [data-key="enter"]');
  await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 9000 });
  return w;
}
// drive (gas + nitro held) until the level is over: the results, or the next level's spell panel
async function drive(page) {
  await page.waitForTimeout(250);
  await page.keyboard.down('ArrowRight'); await page.keyboard.down('Shift');
  const crossed = page.waitForFunction(() => { try { return window.__spellJump.game.getState().finishCrossed; } catch (_) { return false; } }, null, { timeout: 150000, polling: 50 }).then(() => true, () => false);
  const end = await page.waitForFunction(() => (document.querySelector('#screen-results:not([hidden])') ? 'results' : window.__spellJump.spellPanel.isOpen ? 'panel' : null), null, { timeout: 150000, polling: 100 }).then((h) => h.jsonValue());
  await page.keyboard.up('ArrowRight'); await page.keyboard.up('Shift');
  return { end, crossed: await Promise.race([crossed, new Promise((r) => setTimeout(() => r(false), 50))]) };
}
async function afterUnlock(page, name, child) {
  await page.waitForSelector(vis('#screen-results'), { timeout: 15000 });
  await page.waitForTimeout(400);
  const res = await J(page, () => ({ callouts: document.querySelector('#res-callouts') ? document.querySelector('#res-callouts').textContent : '', title: document.querySelector('#res-title').textContent,
    mem: window.__spellJump.app.save.unlocked.slice(), last: window.__spellJump.lastResult && window.__spellJump.lastResult.bank }));
  check(/Unlocked: Downtown Drop!/.test(res.callouts), `${name}: the results say "Unlocked: Downtown Drop!" (title "${res.title}")`);
  check(res.mem.includes('city') && res.last && res.last.unlocked === 'city', `${name}: save.unlocked in memory has city (${res.mem.join(' ')})`);
  const sv = await readSave(page);
  check(sv.unlocked.includes('city') && (sv.best.canyon || 0) >= 400, `${name}: the localStorage save has city, best ${sv.best.canyon} m`);
  await page.click('#res-garage'); await page.waitForSelector(vis('#screen-garage'));
  await page.click('#btn-race'); await page.waitForSelector(vis('#screen-tracks'));
  check(await J(page, () => { const c = document.querySelector('#track-grid [data-track="city"]'); return !!c && !c.classList.contains('locked'); }), `${name}: the track screen shows Downtown Drop open`);
  await child.open();
  check((await readSave(page)).unlocked.includes('city'), `${name}: still unlocked after a reload`);
}

async function scenario(browser, name, levels, play) {
  console.log(`\n=== ${name} ===`);
  const child = await newChild(browser, levels);
  const { page, errors, ctx } = child;
  try {
    await child.open();
    await toCanyon(page);
    await play(page);
    await afterUnlock(page, name, child);
    check(errors.length === 0, `${name}: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  } catch (e) {
    failures.push(`${name}: ${e.message.split('\n')[0]}`);
    console.log('  ✗ ' + e.message.split('\n')[0]);
  } finally {
    await ctx.close();
  }
}

watchdog('finish-unlock');
const srv = process.env.BASE_URL ? null : await startStaticServer({ cwd: root, port: PORT });
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
try {
  await scenario(browser, 'A: one level, the finish line crossed', 1, async (page) => {
    await spellWord(page);
    const d = await drive(page);
    check(d.end === 'results' && d.crossed, `A: the car crosses Climb Canyon's 400 m finish line (${d.end})`);
  });
  await scenario(browser, 'B: Level 1 cleared, then the back button in Level 2\'s spell panel', 3, async (page) => {
    await spellWord(page);
    const d = await drive(page);
    check(d.end === 'panel' && await J(page, () => window.__spellJump.run && window.__spellJump.run.level === 2 && window.__spellJump.run.levelDone[0].summary.finishCrossed),
      `B: Level 1's finish line crossed → Level 2's spell panel (${d.end})`);
    await page.waitForFunction(() => window.__spellJump.spellPanel.mode === 'write', null, { timeout: 15000 });
    await page.tap('#spell .sp-exit');
    await page.waitForSelector(vis('#screen-results'), { timeout: 8000 }).catch(() => {});
    const r = await J(page, () => ({ screen: window.__spellJump.screen, run: window.__spellJump.run, lv: window.__spellJump.lastResult && window.__spellJump.lastResult.summary.levels }));
    check(r.screen === 'results' && r.run === null && r.lv && r.lv.reached === 1 && r.lv.cleared[0] === true, `B: leaving shows the round's results (Level 1 cleared: ${JSON.stringify(r.lv)}, screen ${r.screen})`);
  });
  await scenario(browser, 'C: Level 1 cleared, Level 2\'s word spelled, then pause → End run', 3, async (page) => {
    await spellWord(page);
    const d = await drive(page);
    check(d.end === 'panel', `C: Level 1's finish line crossed → Level 2 (${d.end})`);
    await spellWord(page);
    await page.waitForTimeout(400);
    await page.click('#btn-pause'); await page.waitForSelector(vis('#panel-pause'));
    await page.click('#pause-end');
  });
} catch (e) {
  failures.push('exception: ' + e.message);
  console.error(e);
} finally {
  await browser.close().catch((e) => console.error('browser.close', e));
  if (srv) await srv.stop();
}
console.log(`\n${nChecks - failures.length} / ${nChecks} checks passed`);
if (failures.length) { console.log(`\nFAILED (${failures.length}):\n- ` + failures.join('\n- ')); process.exit(1); }
console.log('\nALL CHECKS PASSED');

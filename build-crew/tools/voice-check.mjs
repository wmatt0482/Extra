// Natural-voice trace: plays Build Crew in Chromium against a local server whose /api/tts routes are stubbed the way the
// real service answers (status, prepare with a per-clip synthesis delay and a server-side cache, clip bytes), then logs
// EVERY line the game speaks together with the engine that spoke it ('cloud' clip or 'device' speechSynthesis), the
// screen and whether a builder was chosen yet. No Google key is used or needed. The only test hooks are the shared ones:
// window.__cloudVoiceBackend (load/play only, so status and prepare go through the real fetch path) and
// window.__ttsBackend (a fake speechSynthesis that records the device voice). Nothing in the game is bypassed.
//
//   BASE_URL=http://localhost:8094 node build-crew/tools/voice-check.mjs [scenario ...]
//
// Scenarios (default: all): "first-visit" (family has a code and a chosen Google voice, no clips cached yet, the
// child taps Start at once), "no-default" (family has a code but never chose a voice: the default must be picked),
// "quick-start" (the child taps Start 300 ms after the title shows), "slow-network" (every API answer is slow), "picker" (the Parent Zone voice picker and its default), "warm" (a reload with the clips already cached), "no-builder" (nothing may
// be spoken until a builder is chosen), "no-key" (the service has no Google key), "no-code" (no family code: the device voice is the only voice, by design).
// ASSERT=0 only prints the trace (used to show the failure on the old code); the default asserts.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { loadPlaywright, resultsPath, SWIFTSHADER_ARGS } from './runner.mjs';

const C = await import('../src/content.mjs');
// Static check: every spoken string that other files build or print is in the prepared set, word for word.
{
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const read = (f) => readFileSync(root + f, 'utf8');
  const src = ['src/app/hud.js', 'src/app/tray.js', 'src/app/rounds.js', 'src/app/title.js', 'src/main.js', 'index.html'].map(read).join('\n');
  const known = new Set(C.VOICE_LINES);
  const must = (cond, msg) => assert(cond, 'voice set: ' + msg);
  must(src.includes(C.HINT.tilt), 'hud.js releaseHint differs from HINT.tilt');
  must(src.includes('Tap a clear patch of ground for your ${kind}.'), 'tray.js stamp hint changed');
  must(src.replace(/\s+/g, ' ').includes(C.TRAY_TIP), 'index.html tray tip differs from TRAY_TIP');
  // touch wording: hud.js must take it from content.mjs (no copy that could drift), and every hint a phone can show is prepared
  must(/touchHint/.test(read('src/app/hud.js')) && !/Drag the left stick to drive/.test(read('src/app/hud.js')), 'hud.js has its own touch wording');
  for (const [k, v] of Object.entries(C.TOUCH_TEXT)) must(known.has(C.speakable(v)), `touch hint "${v}" (for "${k}") is not prepared`);
  for (const t of [C.HINT.drive, C.HINT.lift, C.HINT.grab, C.HINT.carry, C.HINT.raise, C.HINT.tilt, C.HINT.resume, ...Object.values(C.MACHINES).map((m) => m.hint)])
    must(known.has(C.speakable(C.touchHint(t))), `touch form of "${t}" is not prepared`);
  must(C.touchHint(C.HINT.grab).includes('tap Grab') && !C.touchHint(C.HINT.grab).includes('press'), 'touch grab hint still says press');
  for (const t of C.SPOKEN_TOASTS) must(src.includes(`'${t}'`), `toast "${t}" is not in the source any more`);
  for (const t of [...C.SPOKEN_TOASTS, C.TRAY_TIP, ...C.STAMPS.map((k) => C.STAMP_HINT(k)), ...Object.values(C.MACHINES).map((m) => C.speakable(m.hint))]) must(known.has(t), `"${t}" is not prepared`);
  for (const r of C.ROUNDS) for (const t of C.SPOKEN.job(r)) must(known.has(t) && t.length <= 200 && !/undefined|SS-|EX-|CR-/.test(t), `bad line "${t}"`);
  console.log(`static: ${known.size} lines, ${C.VOICE_LINES.join('').length} characters, all prepared and sayable`);
}

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const ASSERT = process.env.ASSERT !== '0';
const pw = await loadPlaywright();
const launch = { headless: true, args: SWIFTSHADER_ARGS };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await pw.chromium.launch(launch);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A few bytes standing in for an MP3: the page's load hook only fetches them (for the network delay) and never decodes.
const CLIP = Buffer.from('ID3-stub-clip');
const CODE = 'ABCD-2345';

/** The stub service. delay: extra milliseconds on every answer (a slow phone network). */
function stubService(context, { key = true, delay = 0, perClipMs = 350 } = {}) {
  const known = new Set(); // "voice\ntext" the server has already made (its blob cache, shared by every device)
  const stats = { prepares: 0, texts: 0, generated: 0, byVoice: {} };
  const ids = new Map();
  const idOf = (voice, text) => {
    const k = voice + '\n' + text;
    if (!ids.has(k)) ids.set(k, ids.size.toString(16).padStart(32, '0'));
    return ids.get(k);
  };
  context.route('**/api/family/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  context.route('**/api/tts/status', async (r) => {
    await sleep(120 + delay);
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, key, voices: [] }) });
  });
  context.route('**/api/tts/prepare', async (r) => {
    const b = JSON.parse(r.request().postData() || '{}');
    if (!key) return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"no-key"}' });
    const fresh = b.items.filter((i) => !known.has(b.voice + '\n' + i.text));
    stats.prepares++;
    stats.texts += b.items.length;
    stats.generated += fresh.length;
    (stats.byVoice[b.voice] ||= new Set());
    for (const i of b.items) stats.byVoice[b.voice].add(i.text);
    // Google synthesis runs eight at a time; a clip already made is a cheap lookup
    await sleep(250 + delay + Math.ceil(fresh.length / 8) * perClipMs);
    for (const i of fresh) known.add(b.voice + '\n' + i.text);
    const clips = Object.fromEntries(b.items.map((i) => [i.text, '/api/tts/clip/' + idOf(b.voice, i.text)]));
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ clips, generated: fresh.length, cached: b.items.length - fresh.length }) });
  });
  context.route('**/api/tts/clip/*', async (r) => {
    await sleep(80 + delay);
    r.fulfill({ status: 200, contentType: 'audio/mpeg', body: CLIP });
  });
  return stats;
}

/** Page-side recorders: every clip the cloud engine plays and every utterance the device voice speaks. */
function hooks({ family, code }) {
  {
    const log = (window.__voiceLog = []);
    const t0 = performance.now();
    const where = () => {
      let screen = '?', player = null, job = null;
      try {
        const s = window.__buildCrew.state;
        screen = s.screen;
        player = s.playerId;
        job = s.round;
      } catch (_) {
        screen = 'boot';
      }
      const modal = !document.querySelector('#modal')?.hidden ? (document.querySelector('#modal-title')?.textContent || 'modal') : '';
      return { screen, player, job, modal };
    };
    const note = (engine, text) => log.push({ at: Math.round(performance.now() - t0), engine, text, ...where() });
    window.__cloudVoiceBackend = {
      load: async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error('clip ' + res.status);
        await res.arrayBuffer();
        return { duration: 0.05 };
      },
      play: async (_, text) => {
        note('cloud', text);
        await new Promise((r) => setTimeout(r, 60));
        return true;
      },
      stop() {},
    };
    // a fake speechSynthesis: the "robot" voice. Everything it is asked to speak is a device-voice line.
    const voices = [{ name: 'Robo', lang: 'en-US', localService: true, default: true, voiceURI: 'robo' }];
    window.__ttsBackend = {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => voices,
      cancel() {},
      resume() {},
      speak(u) {
        if (u.volume < 0.1) {
          setTimeout(() => u.onend && u.onend({}), 5);
          return;
        }
        note('device', u.text);
        setTimeout(() => { u.onstart && u.onstart({}); setTimeout(() => u.onend && u.onend({}), 60); }, 5);
      },
    };
    if (family) localStorage.setItem('spellJump.family', JSON.stringify(family));
    if (code) localStorage.setItem('spellJump.sync', JSON.stringify({ v: 1, code, deviceId: 'test', keys: {} }));
  }
}

const PLAYER = { id: 'ptest', name: 'Voice', color: '#ff3b5c', createdAt: 1 };
const familyWith = (options) => ({ v: 1, players: [PLAYER], options: options ? { ptest: options } : {}, lastPlayer: 'ptest' });
const SCENARIOS = {
  'first-visit': { family: familyWith({ cloudVoice: 'en-US-Neural2-F' }), code: CODE, svc: {} },
  'no-default': { family: familyWith(null), code: CODE, svc: {} },
  // the child taps Start 300 ms after the title appears, while the first clips are still being made
  'quick-start': { family: familyWith({ cloudVoice: 'en-US-Neural2-F' }), code: CODE, svc: {}, titleMs: 300 },
  'slow-network': { family: familyWith({ cloudVoice: 'en-US-Neural2-F' }), code: CODE, svc: { delay: 1800 } },
  warm: { family: familyWith({ cloudVoice: 'en-US-Neural2-F' }), code: CODE, svc: {}, reload: true },
  'no-builder': { family: null, code: CODE, svc: {}, noBuilder: true },
  // the shared Parent Zone picker: six Google voices, the default chosen for the builder, a pick synced to the family
  picker: { family: familyWith(null), code: CODE, svc: {}, picker: true },
  // the service has no Google key (503): the family's chosen voice cannot be made, so the device voice is the only voice
  'no-key': { family: familyWith({ cloudVoice: 'en-US-Neural2-F' }), code: CODE, svc: { key: false }, deviceOnly: true },
  'no-code': { family: familyWith(null), code: null, svc: {}, deviceOnly: true },
};

async function ready(page) {
  await page.waitForFunction(() => window.__buildCrew, undefined, { timeout: 90000 });
}
const logOf = (page) => page.evaluate(() => window.__voiceLog.slice());
const sinceOf = async (page, n) => (await logOf(page)).slice(n);

/** Plays the moments a child hears speech in, in order, and returns {moments, log}. */
async function play(page, sc, name) {
  const moments = [];
  const mark = async (label, run, settle = 1500) => {
    const before = (await logOf(page)).length;
    await run();
    await page.waitForTimeout(settle);
    moments.push({ label, lines: await sinceOf(page, before) });
  };
  await ready(page);
  await mark('title (no builder chosen / just loaded)', async () => {}, sc.titleMs ?? 2500);
  if (sc.noBuilder) {
    await mark('Start with no builder: the "Who is building?" sheet', async () => { await page.locator('#play').click(); }, 1500);
    await page.keyboard.type('Sam');
    await mark('typing a name', async () => {}, 500);
    await mark('Ready: builder chosen', async () => { await page.keyboard.press('Enter'); await page.locator('[data-profile]').first().waitFor(); }, 3000);
  }
  // the child taps Start at once: how long the goal takes is what the child feels
  const t0 = Date.now();
  await mark('round 1 start', async () => { await page.locator('#play').click(); }, sc.svc?.delay ? 14000 : 9000);
  await mark('first drive, then first lift (hints)', async () => {
    await page.evaluate(() => window.__buildCrew.test.advance({ drive: 1 }, 40));
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.__buildCrew.test.advance({ lift: 1 }, 40));
  }, 4000);
  await mark('grab (hint after grabbing)', async () => { await page.evaluate(() => window.__buildCrew.test.action('grab')); }, 3000);
  await mark('repeat the goal button', async () => { await page.locator('#repeat-goal').click(); }, 3500);
  await mark('job complete (celebration, reward sheet)', async () => {
    await page.evaluate(async () => {
      const { solve } = await import('./tools/solution.mjs');
      const api = window.__buildCrew;
      await solve({ state: () => api.state, advance: (a, n) => api.test.advance(a, n), action: (a) => api.test.action(a), select: (i) => document.querySelectorAll('[data-machine]')[i].click() }, 1);
    });
    await page.locator('#next-round').waitFor({ timeout: 20000 });
  }, 6000);
  await page.locator('#modal-close').click();
  await page.locator('#home').click();
  await mark('sandbox start', async () => { await page.locator('#sandbox').click(); }, 6000);
  await mark('open the materials tray', async () => { await page.locator('#open-tray').click(); }, 4500);
  await mark('save the site', async () => { await page.locator('#save-yard').click(); }, 3500);
  return { moments, startedAt: t0 };
}

/** Parents → Options: the shared picker lists the six Google voices, the default is picked, a pick is stored for the
 *  builder in the family record and Build Crew's lines are made in the new voice. */
async function pickerCheck(page, stats) {
  const problems = [];
  const family = () => page.evaluate(() => JSON.parse(localStorage.getItem('spellJump.family')));
  await ready(page);
  await page.waitForTimeout(1500);
  await page.locator('#parents').click();
  for (const pass of [0, 1]) {
    for (const digit of '1234') await page.locator(`[data-digit="${digit}"]`).click();
    await page.waitForTimeout(250);
  }
  await page.locator('.pz-tabs [data-tab="options"]').waitFor();
  await page.locator('.pz-tabs [data-tab="options"]').click();
  await page.locator('#opt-cloud-voices .pz-voice-pick').first().waitFor();
  const ids = await page.locator('#opt-cloud-voices [data-cloud-voice]').evaluateAll((e) => e.map((x) => x.dataset.cloudVoice));
  console.log('  voices shown:', ids.join(', '));
  if (ids.length !== 6) problems.push(`the picker shows ${ids.length} Google voices, expected 6`);
  await page.waitForFunction(() => document.querySelector('[data-cloud-voice="en-US-Neural2-F"].on'), undefined, { timeout: 8000 }).catch(() => problems.push('the default voice (en-US-Neural2-F, Ava) was not picked'));
  const first = (await family()).options?.ptest?.cloudVoice;
  console.log('  default stored for the builder:', first);
  if (first !== 'en-US-Neural2-F') problems.push('default stored voice is ' + first);
  const disabled = await page.locator('#opt-cloud-voices [data-cloud-voice]').evaluateAll((e) => e.filter((x) => x.disabled).length);
  if (disabled) problems.push(`${disabled} voice rows are disabled although the family has a code and the service has a key`);
  await page.locator('[data-cloud-voice="en-US-Neural2-D"]').click();
  await page.waitForFunction(() => document.querySelector('[data-cloud-voice="en-US-Neural2-D"].on'), undefined, { timeout: 8000 }).catch(() => problems.push('picking Daniel did not select it'));
  const picked = (await family()).options?.ptest;
  console.log('  after picking Daniel the family record holds:', picked?.cloudVoice, '(optionsUpdatedAt', (await family()).optionsUpdatedAt?.ptest ? 'set' : 'missing', ')');
  if (picked?.cloudVoice !== 'en-US-Neural2-D') problems.push('the pick was not stored in the family record');
  await page.waitForTimeout(6000);
  const made = stats.byVoice['en-US-Neural2-D'];
  console.log('  clips asked for in Daniel:', made ? made.size : 0);
  if (!made || !made.has('Job one. Cargo transfer. Transfer three red loads to the blue delivery zone.')) problems.push("Build Crew's lines were not prepared in the newly picked voice");
  await page.locator('#pz-close').click();
  return problems;
}

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENARIOS);
const report = {};
let failed = 0;
for (const name of wanted) {
  const sc = SCENARIOS[name];
  assert(sc, 'unknown scenario ' + name);
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  const stats = stubService(context, sc.svc);
  await context.addInitScript(hooks, { family: sc.family, code: sc.code });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/build-crew/?test=1&nosw=1');
  let res;
  if (sc.reload) {
    // visit once so the clips are cached on this device (localStorage clip map), then reload as a returning child
    await ready(page);
    await page.waitForTimeout(9000);
    await page.reload();
    await page.waitForFunction(() => window.__buildCrew, undefined, { timeout: 90000 });
  }
  if (sc.picker) {
    console.log(`\n=== ${name}`);
    const problems = await pickerCheck(page, stats);
    report[name] = { problems, errors };
    if (errors.length) problems.push('page errors: ' + errors.join(' | '));
    if (problems.length) { failed++; console.log('  PROBLEMS: ' + problems.join('; ')); } else console.log('  OK');
    await context.close();
    continue;
  }
  res = await play(page, sc, name);
  const all = await logOf(page);
  report[name] = { moments: res.moments, stats, errors };
  console.log(`\n=== ${name}  (server: ${stats.prepares} prepare calls, ${stats.texts} texts asked, ${stats.generated} made)`);
  for (const m of res.moments) {
    console.log(`  [${m.label}]` + (m.lines.length ? '' : '  (silent)'));
    for (const l of m.lines) console.log(`      +${String(l.at).padStart(6)} ms  ${l.engine.toUpperCase().padEnd(6)} ${l.screen}${l.job ? '#' + l.job : ''}${l.player ? '' : ' (no builder)'}  "${l.text}"`);
  }
  const device = all.filter((l) => l.engine === 'device');
  const cloud = all.filter((l) => l.engine === 'cloud');
  const early = all.filter((l) => !l.player);
  console.log(`  -> ${cloud.length} cloud lines, ${device.length} device-voice lines, ${early.length} spoken before a builder was chosen, page errors: ${errors.length}`);
  const problems = [];
  if (!sc.deviceOnly && device.length) problems.push(`${device.length} device-voice line(s) while the cloud voice was available`);
  if (early.length) problems.push(`${early.length} line(s) spoken before a builder was chosen`);
  if (errors.length) problems.push('page errors: ' + errors.join(' | '));
  const must = (label) => res.moments.find((m) => m.label.startsWith(label))?.lines.length;
  const labels = sc.deviceOnly
    ? ['round 1 start', 'job complete', 'sandbox start', 'save the site']
    : ['round 1 start', 'first drive', 'job complete', 'sandbox start', 'open the materials tray', 'save the site'];
  for (const label of labels) if (!must(label)) problems.push(`nothing was spoken at "${label}"`);
  if (sc.deviceOnly) {
    // the robot voice keeps to the job, the reward and the save; the extra first-use lines are for the natural voice
    const extras = new Set([...C.SPOKEN.fixed].filter((t) => !t.startsWith('Open site') && t !== C.jobGoalLine(C.SANDBOX) && t !== 'Site saved.'));
    const chatty = device.filter((l) => extras.has(l.text));
    if (chatty.length) problems.push(`the device voice read ${chatty.length} extra line(s): ${chatty.map((l) => l.text).join(' | ')}`);
    if (cloud.length) problems.push('a cloud clip played although the natural voice cannot be used');
    if (!device.length) problems.push('no device-voice line at all (a child would hear nothing)');
  }
  report[name].problems = problems;
  if (problems.length) {
    failed++;
    console.log('  PROBLEMS: ' + problems.join('; '));
  } else console.log('  OK');
  await context.close();
}
writeFileSync(resultsPath('voice-check.json'), JSON.stringify(report, null, 2) + '\n');
await browser.close();
if (failed && ASSERT) {
  console.error(`\n${failed} scenario(s) failed`);
  process.exit(1);
}
console.log(failed ? '\n(trace only: ASSERT=0)' : '\nAll voice scenarios passed.');

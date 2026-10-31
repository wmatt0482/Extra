// The full browser check with real WebGL (SwiftShader) and real Rapier: it solves all ten jobs through the production
// axes and Grab button (tools/solution.mjs, run inside the page), then checks the sandbox save and reload, sibling
// profile isolation, the Parent Zone PIN, report and unlock, real-time keyboard and touch-stick input, responsive
// layouts, a full offline reload and natural-voice preparation through a fake transport. No mocks of the game and no
// completion overrides. Screenshots go to SHOTS_DIR (default <tmp>/build-crew-shots); results to RESULTS_DIR.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, resultsPath, SWIFTSHADER_ARGS } from './runner.mjs';
const game = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pw = await loadPlaywright();
let stage = 'boot';
/** Fails with a labelled error instead of hanging when a browser step does not finish within ms. */
async function bounded(p, label, ms = 15000) {
  stage = label;
  let timer;
  try {
    return await Promise.race([
      p,
      new Promise((_, reject) => (timer = setTimeout(() => reject(Error(label + ' timed out')), ms))),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const BASE = process.env.BASE_URL || 'http://localhost:8080',
  shots = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'build-crew-shots');
mkdirSync(shots, { recursive: true });
const launch = { headless: true, args: SWIFTSHADER_ARGS };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await pw.chromium.launch(launch);
const errors = [],
  logs = [],
  results = { solutions: [], checks: [] };
// A host-side deadline: a wedged browser still produces a failure report instead of a silent hang.
const watchdog = setTimeout(() => {
  const failure = {
    message: 'Browser smoke exceeded its host deadline',
    stage,
    errors,
    logs: logs.slice(-30),
    completed: results,
  };
  writeFileSync(resultsPath('browser-failure.json'), JSON.stringify(failure, null, 2));
  console.error(failure);
  browser.close().catch(() => {});
  setTimeout(() => process.exit(1), 1500);
}, 600000);
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await context.newPage();
context.on('page', (p) =>
  p.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) logs.push(m.text());
  }),
);
page.on('pageerror', (e) => errors.push(e.stack || e.message));
/** Waits until the game has booted (the test hook exists). */
async function ready(p = page) {
  await p.waitForFunction(() => window.__buildCrew, undefined, { timeout: 90000 });
}
/** Adds a builder through the real on-screen flow. */
async function addBuilder(p, name) {
  await p.locator('#add-player').click();
  await p.keyboard.type(name);
  await p.keyboard.press('Enter');
  await p.locator(`[data-profile]`).filter({ hasText: name }).waitFor();
}
/** The kid-rules audit: no native inputs or external links outside the Parent Zone, no horizontal overflow, and
 *  every visible button at least 43 px square. */
async function audit(p) {
  const result = await p.evaluate(() => ({
    native: [...document.querySelectorAll('input,textarea,select')].filter((e) => !e.closest('#pz')).length,
    external: [...document.querySelectorAll('a[href]')].filter((e) => new URL(e.href).origin !== location.origin)
      .length,
    overflow: document.documentElement.scrollWidth > innerWidth,
    small: [...document.querySelectorAll('button')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !e.closest('#pz') && (r.width < 43 || r.height < 43);
      })
      .map((e) => e.id || e.textContent),
  }));
  assert.equal(result.native, 0);
  assert.equal(result.external, 0);
  assert.equal(result.overflow, false);
  assert.deepEqual(result.small, []);
}
/** True when no two of the given selectors' visible boxes overlap (a: the one panel, b: each thing it must clear). */
async function clears(p, a, others) {
  return p.evaluate(
    ([a, others]) => {
      const box = (s) => {
        const e = document.querySelector(s);
        if (!e || e.hidden || !e.offsetParent) return null;
        const r = e.getBoundingClientRect();
        return r.width && r.height ? r : null;
      };
      const A = box(a);
      return others.flatMap((s) => {
        const B = box(s);
        return A && B && A.left < B.right && B.left < A.right && A.top < B.bottom && B.top < A.bottom ? [s] : [];
      });
    },
    [a, others],
  );
}
/** For each of these sandbox controls: visible, and the topmost element at its centre is the control itself. */
async function hitTest(p, ids) {
  return p.evaluate(
    (ids) =>
      Object.fromEntries(
        ids.map((id) => {
          const b = document.getElementById(id),
            r = b.getBoundingClientRect(),
            e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return [id, !b.hidden && r.width > 0 && !!e && (e === b || b.contains(e))];
        }),
      ),
    ids,
  );
}
try {
  await page.goto(BASE + '/build-crew/?test=1&nosw=1');
  await ready();
  await addBuilder(page, 'Builder');
  await page.screenshot({ path: path.join(shots, 'title.png') });
  await audit(page);
  for (let id = 1; id <= 10; id++) {
    stage = 'job ' + id;
    await page.evaluate((id) => window.__buildCrew.test.start(id), id);
    await page.evaluate(() => window.__buildCrew.test.advance({}, 120));
    await page.waitForTimeout(200);
    await audit(page);
    await page.screenshot({ path: path.join(shots, `round-${String(id).padStart(2, '0')}.png`) });
    const s = await page.evaluate(async (id) => {
      const { solve } = await import('./tools/solution.mjs');
      const api = window.__buildCrew;
      return solve(
        {
          state: () => api.state,
          advance: (axes, n) => api.test.advance(axes, n),
          action: (a) => api.test.action(a),
          select: (i) => document.querySelectorAll('[data-machine]')[i].click(),
        },
        id,
      );
    }, id);
    assert(s.complete);
    await page.locator('#next-round').waitFor();
    await page.screenshot({ path: path.join(shots, `finished-${String(id).padStart(2, '0')}.png`) });
    results.solutions.push({ id, complete: true, placed: s.status.count });
    console.log(`PASS browser solution ${id}`);
  }
  stage = 'sandbox save';
  assert.equal((await page.evaluate(() => window.__buildCrew.state.save)).done.length, 10);
  await page.locator('#modal-close').click();
  await page.locator('#home').click();
  await page.locator('#sandbox').click();
  await page.locator('#open-tray').click();
  await page.locator('[data-spawn="beam"]').click();
  await page.locator('[data-spawn="glass"]').click();
  await page.locator('#daylight').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.locator('#close-tray').click();
  await page.locator('#save-yard').click();
  const saved = await page.evaluate(() => window.__buildCrew.state.save.yard);
  assert.equal(saved.toys.length, 5);
  assert(saved.daylight < 0.1);
  await page.reload();
  await ready();
  await page.locator('#my-yard').click();
  assert.equal((await page.evaluate(() => window.__buildCrew.state)).blocks.length, 5);
  assert((await page.evaluate(() => window.__buildCrew.state)).daylight < 0.1);
  console.log('PASS UI stage');
  results.checks.push('sandbox spawn, daylight and save/reload');
  await page.screenshot({ path: path.join(shots, 'sandbox.png') });
  stage = 'profile isolation';
  await page.locator('#home').click();
  // The title with a finished profile and a saved site (thumbnail and every look) must keep its panel clear of the
  // BUILD CREW wordmark, the footer note and the sound button at the desktop, tablet and phone sizes.
  stage = 'title layout';
  for (const [width, height] of [
    [1280, 800],
    [1024, 768],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    assert(await page.locator('#saved-thumb img').count(), 'the saved-site thumbnail is on the title');
    assert((await page.locator('#looks button').count()) >= 5, 'the finished profile shows its looks');
    assert.deepEqual(
      await clears(page, '#title', ['.brand-title', '.foot-note', '#sound-title', '#title-head']),
      [],
      `title panel clear of the footer at ${width}x${height}`,
    );
    assert.deepEqual(await clears(page, '#looks', ['.brand-title', '.foot-note', '#sound-title']), []);
    await audit(page);
    if (width === 1280) await page.screenshot({ path: path.join(shots, 'title-finished.png') });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  console.log('PASS UI stage');
  results.checks.push('title panel clears the footer with a finished profile at 1280x800, 1024x768 and 390x844');
  stage = 'profile isolation';
  await addBuilder(page, 'Sibling');
  assert.equal((await page.evaluate(() => window.__buildCrew.state.save)).done.length, 0);
  assert.equal((await page.evaluate(() => window.__buildCrew.state.save)).yard, null);
  await page.locator('[data-profile]').filter({ hasText: 'Builder' }).click();
  stage = 'sandbox save';
  assert.equal((await page.evaluate(() => window.__buildCrew.state.save)).done.length, 10);
  console.log('PASS UI stage');
  results.checks.push('separate sibling progress and yard slots');
  stage = 'parent report';
  await page.locator('#parents').click();
  for (const digit of '1234') {
    await page.locator(`[data-digit="${digit}"]`).click();
  }
  await page.waitForTimeout(200);
  for (const digit of '1234') {
    await page.locator(`[data-digit="${digit}"]`).click();
  }
  await page.locator('.pz-tabs [data-tab="report"]').waitFor();
  await page.locator('.pz-tabs [data-tab="report"]').click();
  await page.locator('#bc-report .pz-chart').first().waitFor();
  assert.equal(await page.locator('#bc-report .pz-chart').count(), 2);
  await page.screenshot({ path: path.join(shots, 'parent-report.png') });
  await page.locator('.pz-tabs [data-tab="options"]').click();
  await page.locator('#bc-unlock').click();
  await page.locator('#pz-close').click();
  console.log('PASS UI stage');
  results.checks.push('shared PIN, shared charts and parent unlock');
  // A real-time page verifies actual keyboard and touch input in addition to the deterministic solutions.
  stage = 'real-time keyboard';
  const live = await context.newPage();
  live.on('pageerror', (e) => errors.push(e.message));
  await live.goto(BASE + '/build-crew/?nosw=1');
  await ready(live);
  await live.locator('#sandbox').click();
  const before = await live.evaluate(() => window.__buildCrew.state.machines[0].z);
  await live.keyboard.down('w');
  await live.waitForFunction((before) => window.__buildCrew.state.machines[0].z > before + 0.2, before, {
    timeout: 10000,
  });
  await live.keyboard.up('w');
  await live.keyboard.press('r');
  await live.locator('#pause').click();
  await live.locator('#resume').click();
  await live.setViewportSize({ width: 1024, height: 768 });
  await audit(live);
  await live.screenshot({ path: path.join(shots, 'ipad.png') });
  // Pointer events use the same captured-stick path as a touch screen.
  stage = 'touch stick';
  const stick = await live.locator('[data-stick="drive"]').boundingBox();
  const z0 = await live.evaluate(() => window.__buildCrew.state.machines[0].z);
  await live.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2);
  await live.mouse.down();
  await live.mouse.move(stick.x + stick.width / 2, stick.y + 10);
  await live.waitForFunction((z) => window.__buildCrew.state.machines[0].z > z + 0.1, z0, { timeout: 10000 });
  await live.mouse.up();
  console.log('PASS UI stage');
  results.checks.push('keyboard drive/reset/pause and captured touch-stick path');
  stage = 'responsive screenshots';
  await live.setViewportSize({ width: 390, height: 844 });
  await audit(live);
  assert(
    await live.evaluate(() => {
      const hint = document.querySelector('#hint').getBoundingClientRect();
      return [...document.querySelectorAll('.hud-tools button')]
        .filter((b) => !b.hidden)
        .every((b) => b.getBoundingClientRect().bottom < hint.top);
    }),
    'portrait hint clears the action buttons',
  );
  await live.screenshot({ path: path.join(shots, 'portrait.png') });
  // The sandbox tray on a phone: it stops above the drive deck, so Wrecking ball and Clear site can be tapped for
  // every machine's deck (the excavator's has an extra row of joint buttons).
  stage = 'phone tray';
  await live.locator('#open-tray').click();
  await live.screenshot({ path: path.join(shots, 'tray-390x844.png') });
  for (const machine of ['skid', 'excavator', 'crane']) {
    await live.locator(`[data-machine="${machine}"]`).click();
    await live.waitForTimeout(150);
    const hits = await hitTest(live, ['wreck', 'clear-yard', 'close-tray']);
    assert.deepEqual(hits, { wreck: true, 'clear-yard': true, 'close-tray': true }, `tray buttons hit with ${machine}`);
    assert.deepEqual(await clears(live, '#tray', ['.drive-deck']), [], `tray clear of the ${machine} deck`);
  }
  await live.locator('[data-machine="skid"]').click();
  // Clear site asks first: one tap changes nothing, the question goes away by itself, two taps clear the site.
  stage = 'clear site confirm';
  const count = () => live.evaluate(() => window.__buildCrew.state.blocks.length);
  const materials = await count();
  assert(materials > 0);
  await live.locator('#clear-yard').click();
  assert.equal(await live.locator('#clear-yard').textContent(), 'Yes, clear');
  assert.equal(await live.locator('#clear-ask').textContent(), 'Clear site?');
  assert.equal(await count(), materials, 'one tap does not clear the site');
  await live.waitForTimeout(4400);
  assert.equal(await live.locator('#clear-yard').textContent(), 'Clear site', 'the question resets itself');
  assert.equal(await count(), materials);
  await live.locator('#clear-yard').click();
  await live.locator('#clear-yard').click();
  assert.equal(await count(), 0, 'the second tap clears the site');
  assert.equal(await live.locator('#clear-yard').textContent(), 'Clear site');
  // Toasts take turns in a slot under the hint: never over the hint or the deck, and never two at once.
  stage = 'toast slot';
  await live.evaluate(async () => {
    const hud = await import('/build-crew/src/app/hud.js');
    hud.showHint('Tap a clear patch of ground for your hill.');
    hud.toast('Terrain placed.');
    hud.toast('Site cleared.');
  });
  assert.equal(await live.locator('.toast').count(), 1, 'one toast at a time');
  assert.deepEqual(await clears(live, '.toast', ['#hint', '.drive-deck']), []);
  await live.locator('#close-tray').click();
  await live.locator('#home').click();
  await live.setViewportSize({ width: 844, height: 390 });
  await audit(live);
  await live.screenshot({ path: path.join(shots, 'small-landscape.png') });
  await bounded(live.close(), 'live page close');
  // Prewarm the complete shell, then verify a new offline navigation and a saved sandbox.
  const offlineContext = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    storageState: await bounded(context.storageState(), 'saved browser state'),
  });
  const offline = await offlineContext.newPage();
  offline.on('pageerror', (e) => errors.push(e.message));
  await bounded(offline.goto(BASE + '/build-crew/'), 'offline context navigation');
  await ready(offline);
  await bounded(
    offline.evaluate(async () => {
      await navigator.serviceWorker.ready;
      return true;
    }),
    'offline worker activation',
  );
  await bounded(offline.reload(), 'online warm reload');
  await ready(offline);
  await bounded(offlineContext.setOffline(true), 'offline emulation');
  await bounded(offline.reload(), 'offline reload');
  await ready(offline);
  await offline.locator('#my-yard').click();
  assert.equal((await offline.evaluate(() => window.__buildCrew.state.blocks)).length, 5);
  await bounded(offlineContext.setOffline(false), 'online restore');
  await bounded(offlineContext.close(), 'offline context close');
  console.log('PASS UI stage');
  results.checks.push('full offline reload including WASM, shared modules and saved yard');
  // ?test=1 must do nothing on a real host: the hooks and the all-jobs unlock are local-only.
  stage = 'test flag gate';
  assert.deepEqual(
    await page.evaluate(async () => {
      const { isLocalHost } = await import('/build-crew/src/app/state.js');
      return [
        'localhost',
        '127.0.0.1',
        'kid.local',
        'learninglab.fun',
        'www.learninglab.fun',
        'notlocalhost.com',
        'x.local.evil.com',
      ].map(isLocalHost);
    }),
    [true, true, true, false, false, false, false],
  );
  assert(await page.evaluate(() => !!window.__buildCrew.test), 'localhost keeps the test hooks');
  const served = new URL(BASE);
  const remoteBrowser = await pw.chromium.launch({
    ...launch,
    args: [
      ...SWIFTSHADER_ARGS,
      `--host-resolver-rules=MAP learninglab.test ${served.hostname}`,
      `--unsafely-treat-insecure-origin-as-secure=http://learninglab.test:${served.port}`,
    ],
  });
  try {
    const rc = await remoteBrowser.newContext({ viewport: { width: 1024, height: 768 } });
    const rp = await rc.newPage();
    rp.on('pageerror', (e) => errors.push(e.message));
    await rp.goto(`http://learninglab.test:${served.port}/build-crew/?test=1&nosw=1`);
    await ready(rp);
    assert.equal(await rp.evaluate(() => location.hostname), 'learninglab.test');
    assert.equal(await rp.evaluate(() => !!window.__buildCrew.test), false, 'no test hooks on a real host');
    await addBuilder(rp, 'Remote');
    await rp.locator('#jobs').click();
    for (const id of [2, 5, 10]) {
      assert.equal(await rp.locator(`[data-job="${id}"]`).isDisabled(), true, `job ${id} stays locked with ?test=1`);
    }
    assert.equal(await rp.locator('[data-job="1"]').isDisabled(), false);
    await rc.close();
  } finally {
    await remoteBrowser.close();
  }
  console.log('PASS UI stage');
  results.checks.push('?test=1 hooks and job unlock only on localhost, 127.0.0.1 and .local hosts');
  // Prove that every spoken line has a prepared natural clip and the device voice never speaks while the natural voice is
  // available, with a fake transport (never a Google key). tools/voice-check.mjs is the fuller trace of every spoken
  // moment through a stubbed /api/tts with latency; this stage keeps the check in the main suite.
  stage = 'natural voice context';
  const voiceContext = await bounded(
    browser.newContext({ viewport: { width: 1024, height: 768 } }),
    'natural voice context',
    30000,
  );
  await voiceContext.addInitScript(() => {
    window.__voiceTexts = [];
    window.__voiceSpoken = [];
    window.__deviceSpoken = [];
    window.__cloudVoiceBackend = {
      status: async () => ({ key: true }),
      prepare: async ({ texts }) => {
        window.__voiceTexts.push(...texts);
        return {
          status: 200,
          body: {
            clips: Object.fromEntries(
              texts.map((text) => [
                text,
                '/api/tts/clip/' + String(window.__voiceTexts.indexOf(text)).padStart(32, '0'),
              ]),
            ),
          },
        };
      },
      load: async () => ({ duration: 0.05 }),
      play: async (_, text) => {
        window.__voiceSpoken.push(text);
        return true;
      },
      stop() {},
    };
    // The device ("robot") voice is a recorder: the check fails if it is ever asked to speak a real line.
    window.__ttsBackend = {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => [{ name: 'Robo', lang: 'en-US', localService: true, default: true, voiceURI: 'robo' }],
      cancel() {},
      resume() {},
      speak(u) {
        if (u.volume >= 0.1) window.__deviceSpoken.push(u.text);
        setTimeout(() => {
          u.onstart?.({});
          u.onend?.({});
        }, 5);
      },
    };
    localStorage.setItem(
      'spellJump.family',
      JSON.stringify({
        v: 1,
        players: [{ id: 'ptest', name: 'Voice', color: '#ff3b5c', createdAt: 1 }],
        options: { ptest: { cloudVoice: 'en-US-Neural2-F' } },
        lastPlayer: 'ptest',
      }),
    );
    localStorage.setItem('spellJump.sync', JSON.stringify({ v: 1, code: 'ABCD-2345', deviceId: 'test', keys: {} }));
  });
  await voiceContext.route('**/api/family/**', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  const voicePage = await voiceContext.newPage();
  await voicePage.goto(BASE + '/build-crew/?test=1&nosw=1');
  await ready(voicePage);
  await voicePage.waitForTimeout(800);
  assert.deepEqual(await voicePage.evaluate(() => window.__voiceSpoken), [], 'nothing is spoken on the title');
  // every line the game can say is prepared, from the static set in content.mjs
  await bounded(
    voicePage.waitForFunction(
      async () => {
        const { VOICE_LINES } = await import('./src/content.mjs');
        return VOICE_LINES.every((t) => window.__voiceTexts.includes(t));
      },
      undefined,
      { timeout: 20000 },
    ),
    'all known lines prepared',
    25000,
  );
  await voicePage.locator('#play').click();
  const intro = 'Job one. Cargo transfer. Transfer three red loads to the blue delivery zone.';
  await bounded(
    voicePage.waitForFunction((t) => window.__voiceSpoken.includes(t), intro, { timeout: 15000 }),
    'job one read aloud',
    20000,
  );
  await bounded(
    voicePage.waitForFunction(() => window.__voiceSpoken.some((t) => t.startsWith('W A S D or the left stick drives')), undefined, { timeout: 15000 }),
    'first hint read aloud',
    20000,
  );
  await voicePage.evaluate(() => window.__buildCrew.test.advance({ drive: 1 }, 40));
  await bounded(
    voicePage.waitForFunction(() => window.__voiceSpoken.includes('Try I and K, or the right stick, to lift your tool.'), undefined, { timeout: 15000 }),
    'next hint read aloud',
    20000,
  );
  const spoken = await voicePage.evaluate(() => ({ cloud: window.__voiceSpoken, device: window.__deviceSpoken, prepared: window.__voiceTexts }));
  assert.deepEqual(spoken.device, [], 'the device voice never speaks while the natural voice is available');
  assert(spoken.cloud.every((t) => spoken.prepared.includes(t)), 'every spoken line had a prepared clip');
  await bounded(voiceContext.close(), 'natural voice context close');
  console.log('PASS UI stage');
  results.checks.push('natural voice: every spoken line prepared, none on the device voice, nothing before a builder');
  assert.deepEqual(errors, []);
  writeFileSync(resultsPath('browser-results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log('All browser checks passed.');
} catch (e) {
  const failure = { message: e.message, stage, errors, logs: logs.slice(-30), completed: results };
  try {
    failure.state = await bounded(
      page.evaluate(() => window.__buildCrew?.state),
      'failure state',
      3000,
    );
  } catch {}
  writeFileSync(resultsPath('browser-failure.json'), JSON.stringify(failure, null, 2));
  try {
    await bounded(page.screenshot({ path: path.join(shots, 'failure.png') }), 'failure screenshot', 5000);
  } catch {}
  throw e;
} finally {
  await bounded(browser.close(), 'browser close', 5000).catch(() => {
    setTimeout(() => process.exit(1), 250);
  });
  clearTimeout(watchdog);
}

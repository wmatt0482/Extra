// The full browser check with real WebGL (SwiftShader) and real Rapier: it solves all ten jobs through the production
// axes and Grab button (tools/solution.mjs, run inside the page), then checks the sandbox save and reload, sibling
// profile isolation, the Parent Zone PIN, report and unlock, real-time keyboard and touch-stick input, responsive
// layouts, the phone touch layout (real touch events, 60% playfield, instant sticks, pinch, tray sheet, camera
// framing), a full offline reload and natural-voice preparation through a fake transport. No mocks of the game and no
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
// A host-side deadline (20 minutes: ten solved jobs plus the phone stages): a wedged browser still produces a failure
// report instead of a silent hang.
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
}, 1200000);
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
  // The report says which quality tier this device runs at and every change the controller made. By now ten jobs have
  // run, so on a loaded software renderer the controller may already have stepped the shadows down: any step is valid.
  assert.equal(await page.locator('#bc-quality').count(), 1);
  assert.match(await page.locator('#bc-quality').textContent(), /Quality tier: desktop.*Resolution: .*Shadows: (1024|512|contact discs only).*Changes this session:/);
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
  // ---- Phones (0.4): the touch layout, input feel and camera framing, on a real touch context ----
  {
  stage = 'phone touch';
  const phoneContext = await bounded(
    browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
      storageState: await bounded(context.storageState(), 'phone state'),
    }),
    'phone context',
    30000,
  );
  const phone = await phoneContext.newPage();
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(BASE + '/build-crew/?nosw=1');
  await ready(phone);
  assert.equal(await phone.evaluate(() => document.documentElement.classList.contains('touch')), true, 'touch class');
  assert.equal(await phone.evaluate(() => window.__buildCrew.performance.quality.tier), 'phone', 'phone tier');
  await phone.locator('#play').tap();
  await phone.waitForFunction(() => window.__buildCrew.state.screen === 'play');
  await phone.waitForTimeout(1200);
  const cdp = await phoneContext.newCDPSession(phone);
  await cdp.send('Performance.enable');
  const metric = async (name) => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === name).value;
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const box = (sel) => phone.locator(sel).boundingBox();
  const axes = () => phone.evaluate(() => window.__buildCrew.axes);
  /** The playfield: the share of the screen height left clear in the middle band (the top bar and hint above it,
   *  the controls under it), counting every control that reaches into the central half of the width. */
  async function playfield() {
    return phone.evaluate(() => {
      const H = innerHeight,
        W = innerWidth,
        mid = (r) => r.right > W * 0.25 && r.left < W * 0.75;
      let top = 0,
        bottom = H;
      const els = [...document.querySelectorAll('.hud-top, #hint, #hud button, #hud .stick')].filter(
        (e) => e.offsetParent && !e.closest('#tray'),
      );
      for (const e of els) {
        const r = e.getBoundingClientRect();
        if (!r.width || !mid(r)) continue;
        if (r.bottom < H / 2) top = Math.max(top, r.bottom);
        else bottom = Math.min(bottom, r.top);
      }
      return { top, bottom, share: (bottom - top) / H };
    });
  }
  /** The pairs of visible controls (named by these selectors) whose boxes overlap. */
  async function overlaps(selectors) {
    return phone.evaluate((sels) => {
      const boxes = sels.flatMap((s) =>
        [...document.querySelectorAll(s)]
          .filter((e) => e.offsetParent && e.getBoundingClientRect().width)
          .map((e) => [s, e.getBoundingClientRect()]),
      );
      const bad = [];
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const [a, A] = boxes[i],
            [b, B] = boxes[j];
          if (A.left < B.right && B.left < A.right && A.top < B.bottom && B.top < A.bottom) bad.push(a + ' / ' + b);
        }
      return bad;
    }, selectors);
  }
  const CONTROLS = ['.hud-top', '#hint', '.hud-tools', '.machines', '.work-buttons', '.joint-buttons', '.stick'];
  const kbdWords = /WASD|W A S D|SPACE|I J K L|\bkbd\b|Press E|press Grab/i;
  for (const [width, height] of [
    [390, 844],
    [844, 390],
  ]) {
    stage = `phone layout ${width}x${height}`;
    await phone.setViewportSize({ width, height });
    await phone.waitForTimeout(600);
    await audit(phone);
    const pf = await playfield();
    assert(pf.share >= 0.6, `the playfield keeps at least 60% of the height at ${width}x${height} (${pf.share.toFixed(2)})`);
    assert.deepEqual(await overlaps(CONTROLS), [], `no controls overlap at ${width}x${height}`);
    const text = await phone.evaluate(() => document.querySelector('#hud').innerText);
    assert(!kbdWords.test(text), `no keyboard chips on a touch screen: ${text.replace(/\s+/g, ' ')}`);
    assert(/drag the stick/i.test(text), 'the sticks say "drag the stick"');
    assert.deepEqual(
      await phone.evaluate(() =>
        ['.stick', '#world', '[data-hold]', '#grab'].map((s) => getComputedStyle(document.querySelector(s)).touchAction),
      ),
      ['none', 'none', 'none', 'manipulation'],
      'touch-action keeps the browser out of the sticks and the yard',
    );
    // The page fills the dynamic viewport height.
    assert(await phone.evaluate(() => getComputedStyle(document.querySelector('#app')).height === innerHeight + 'px'));
    await phone.screenshot({ path: path.join(shots, `phone-round1-${width}x${height}.png`) });
  }
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.waitForTimeout(600);
  // The first pointerdown is a control, with nothing to wait out: the axes are set as the touch is delivered.
  stage = 'phone sticks';
  const centre = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2, r: b.width * 0.34 });
  const d = centre(await box('[data-stick="drive"]')),
    t = centre(await box('[data-stick="tool"]'));
  const z0 = await phone.evaluate(() => window.__buildCrew.state.machines[0].z);
  await touch('touchStart', [{ id: 1, x: d.x + 2, y: d.y }]);
  assert.deepEqual(
    await axes().then((a) => [a.drive, a.steer]),
    [0, 0],
    'a touch inside the 12% dead zone drives nothing',
  );
  await touch('touchEnd', []);
  const layoutBefore = await metric('LayoutCount');
  await touch('touchStart', [{ id: 1, x: d.x, y: d.y - d.r * 0.9 }]);
  const first = await axes();
  assert(first.drive > 0.6 && Math.abs(first.steer) < 0.01, 'the first pointerdown drives at once: ' + JSON.stringify(first));
  assert(
    await phone.evaluate(() => /translate3d/.test(document.querySelector('[data-stick="drive"] .stick-dot').style.transform)),
    'the knob follows the finger with a transform',
  );
  for (let i = 0; i < 40; i++) {
    await touch('touchMove', [{ id: 1, x: d.x + Math.sin(i / 5) * d.r * 0.5, y: d.y - d.r * 0.8 }]);
    await phone.waitForTimeout(16);
  }
  const layouts = (await metric('LayoutCount')) - layoutBefore;
  assert(layouts <= 6, `moving a stick does not re-run layout (${layouts} layouts in 40 moves)`);
  // Both sticks at once, then a pinch on the yard with both still held: nothing fights.
  const held = [
    { id: 1, x: d.x, y: d.y - d.r * 0.9 },
    { id: 2, x: t.x, y: t.y - t.r * 0.9 },
  ];
  await touch('touchStart', held);
  const both = await axes();
  assert(both.drive > 0.6 && both.lift > 0.6, 'both sticks at once: ' + JSON.stringify(both));
  const before = await phone.evaluate(() => window.__buildCrew.state.camera.distance);
  const mid = { x: 195, y: 300 };
  await touch('touchStart', [...held, { id: 3, x: mid.x - 20, y: mid.y }, { id: 4, x: mid.x + 20, y: mid.y }]);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', [
      ...held,
      { id: 3, x: mid.x - 20 - i * 10, y: mid.y },
      { id: 4, x: mid.x + 20 + i * 10, y: mid.y },
    ]);
    await phone.waitForTimeout(16);
  }
  const during = await axes();
  assert(during.drive > 0.6 && during.lift > 0.6, 'a pinch does not drop the sticks: ' + JSON.stringify(during));
  const after = await phone.evaluate(() => window.__buildCrew.state.camera.distance);
  assert(after < before - 1, `pinching out zooms in (${before.toFixed(1)} to ${after.toFixed(1)})`);
  await phone.waitForTimeout(500);
  const z1 = await phone.evaluate(() => window.__buildCrew.state.machines[0].z);
  assert(Math.abs(z1 - z0) > 0.3, 'the machine moved under touch (' + z0.toFixed(2) + ' to ' + z1.toFixed(2) + ')');
  await touch('touchEnd', []);
  assert.deepEqual(
    await axes().then((a) => [a.drive, a.steer, a.lift, a.tool]),
    [0, 0, 0, 0],
    'lifting every finger returns every axis to neutral',
  );
  console.log('PASS UI stage');
  results.checks.push(
    'phone: touch layout, 60% playfield, no keyboard chips, instant sticks, dead zone, pinch with both sticks held',
  );
  // The sandbox tray is a sheet that leaves the sticks reachable, in both orientations, for every machine's joints.
  stage = 'phone tray';
  await phone.locator('#home').tap();
  await phone.locator('#sandbox').tap();
  await phone.waitForFunction(() => window.__buildCrew.state.screen === 'play');
  for (const [width, height] of [
    [390, 844],
    [844, 390],
  ]) {
    await phone.setViewportSize({ width, height });
    await phone.waitForTimeout(500);
    await phone.locator('#open-tray').tap();
    for (const machine of ['skid', 'excavator', 'crane']) {
      await phone.locator(`[data-machine="${machine}"]`).tap();
      await phone.waitForTimeout(150);
      const hits = await hitTest(phone, ['wreck', 'clear-yard', 'close-tray']);
      assert.deepEqual(hits, { wreck: true, 'clear-yard': true, 'close-tray': true }, `tray buttons hit with ${machine}`);
      assert.deepEqual(
        await clears(phone, '#tray', ['.stick', '.joint-buttons', '.machines', '.hud-tools']),
        [],
        `tray clear of the sticks, joints and cards at ${width}x${height}`,
      );
      if (height > width) {
        assert.deepEqual(await clears(phone, '#tray', ['.work-buttons']), [], 'the portrait tray leaves Grab free');
      }
      // Every stick, joint button and card is still the topmost thing at its own centre.
      const blocked = await phone.evaluate(() =>
        [...document.querySelectorAll('.stick, .joint-buttons button, .machine-card')]
          .filter((e) => e.offsetParent)
          .map((e) => {
            const r = e.getBoundingClientRect(),
              top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return top === e || e.contains(top) ? null : e.className;
          })
          .filter(Boolean),
      );
      assert.deepEqual(blocked, [], `sticks, joints and cards reachable through the open tray at ${width}x${height}`);
    }
    const sheet = await phone.evaluate(() => ({ ...document.querySelector('#tray').getBoundingClientRect().toJSON(), h: innerHeight }));
    assert(sheet.top >= 40 && sheet.bottom <= sheet.h, 'the tray stays on the screen');
    await phone.screenshot({ path: path.join(shots, `phone-tray-${width}x${height}.png`) });
    await phone.locator('#close-tray').tap();
  }
  console.log('PASS UI stage');
  results.checks.push('phone: the tray sheet clears the sticks and joints in portrait and landscape');
  await bounded(phoneContext.close(), 'phone context close');
  // Every job at phone sizes: the machine, the delivery pad and every ghost sit clear of the top bar, the hint strip
  // and the controls (the camera frames the machine in the band between them).
  for (const [width, height] of [
    [390, 844],
    [844, 390],
  ]) {
    stage = `phone framing ${width}x${height}`;
    const fc = await bounded(
      browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
        storageState: await bounded(context.storageState(), 'framing state'),
      }),
      'framing context',
      30000,
    );
    const fp = await fc.newPage();
    fp.on('pageerror', (e) => errors.push(e.message));
    await fp.goto(BASE + '/build-crew/?test=1&nosw=1');
    await ready(fp);
    for (let id = 1; id <= 10; id++) {
      await fp.evaluate((id) => window.__buildCrew.test.start(id), id);
      await fp.evaluate(() => window.__buildCrew.test.advance({}, 30));
      await fp.waitForTimeout(1000);
      const covered = await fp.evaluate(() => {
        const L = window.__buildCrew.layout,
          pts = { machine: L.machine, pad: L.padCentre };
        L.ghosts.forEach((g, i) => (pts['ghost' + i] = g));
        const boxes = [...document.querySelectorAll('#hud button, #hud .stick, #hint, .hud-top')]
          .filter((e) => e.offsetParent && e.getBoundingClientRect().width)
          .map((e) => [e.id || e.className, e.getBoundingClientRect()]);
        return Object.entries(pts).flatMap(([name, p]) =>
          boxes
            .filter(([, r]) => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom)
            .map(([n]) => name + ' under ' + n),
        );
      });
      assert.deepEqual(covered, [], `job ${id} at ${width}x${height}: nothing the player needs is under a control`);
    }
    await fc.close();
  }
  // The job-complete sheet on a phone on its side: the whole card and its three buttons fit on the screen.
  stage = 'phone job complete';
  const sideContext = await bounded(
    browser.newContext({
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
      storageState: await bounded(context.storageState(), 'side state'),
    }),
    'side context',
    30000,
  );
  const side = await sideContext.newPage();
  side.on('pageerror', (e) => errors.push(e.message));
  await side.goto(BASE + '/build-crew/?test=1&nosw=1');
  await ready(side);
  await side.evaluate(() => window.__buildCrew.test.start(1));
  const solved = await side.evaluate(async () => {
    const { solve } = await import('./tools/solution.mjs');
    const api = window.__buildCrew;
    return solve(
      {
        state: () => api.state,
        advance: (axes, n) => api.test.advance(axes, n),
        action: (a) => api.test.action(a),
        select: (i) => document.querySelectorAll('[data-machine]')[i].click(),
      },
      1,
    );
  });
  assert(solved.complete);
  await side.locator('#next-round').waitFor();
  // The sheet slides in; measure it once the slide has finished.
  await side.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
  await side.waitForTimeout(200);
  const done = await side.evaluate(() => {
    const card = document.querySelector('#modal .modal-card').getBoundingClientRect();
    return {
      inside: card.top >= 0 && card.bottom <= innerHeight && card.left >= 0 && card.right <= innerWidth,
      buttons: [...document.querySelectorAll('#modal .modal-actions button')].every((b) => {
        const r = b.getBoundingClientRect();
        return r.bottom <= innerHeight && r.height >= 44;
      }),
    };
  });
  assert.deepEqual(done, { inside: true, buttons: true }, 'the job-complete sheet fits a phone on its side');
  await side.screenshot({ path: path.join(shots, 'phone-complete-844x390.png') });
  await sideContext.close();
  console.log('PASS UI stage');
  results.checks.push(
    'phone: every job frames machine, pad and ghosts clear of the controls in both orientations; the job-complete sheet fits',
  );
  }
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

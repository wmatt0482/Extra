// The frame-time sample (SPEC §6): a sandbox with 64 toys and the four free machines, driven for a moment, then 120 frames
// measured after the adaptive quality controller settles. It asserts the SwiftShader wall-frame ceiling, the CPU update
// budget and the draw-call and triangle caps. Two profiles run: a desktop window (1024x768, the baseline) and a phone
// (390x844 at device scale 3, touch input, the CPU slowed 4x through CDP, driven by real touch events), which also
// reports the quality tier and every decision of the adaptive controller. This is a correctness/performance baseline
// on software rendering; it does not certify an iPad or phone GPU's frame rate.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { loadPlaywright, resultsPath, SWIFTSHADER_ARGS } from './runner.mjs';
const { chromium } = await loadPlaywright();
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const quantile = (a, n) => a.slice().sort((x, y) => x - y)[Math.floor((a.length - 1) * n)];

/** Creates a builder, unlocks every machine through the Parent Zone and opens a sandbox holding 64 cubes. */
async function fixture(page, tap, { lab = false } = {}) {
  await page.waitForFunction(() => window.__buildCrew);
  await page.locator('#add-player')[tap]();
  await page.keyboard.type('Perf');
  await page.keyboard.press('Enter');
  await page.locator('#parents')[tap]();
  for (const d of '1234') await page.locator(`[data-digit="${d}"]`)[tap]();
  await page.waitForTimeout(200);
  for (const d of '1234') await page.locator(`[data-digit="${d}"]`)[tap]();
  await page.locator('.pz-tabs [data-tab="options"]')[tap]();
  await page.locator('#bc-unlock')[tap]();
  await page.locator('#pz-close')[tap]();
  // With `lab`, the Lab's dump truck and forklift are bought through the Lab's own wallet (localhost test hook): five machines.
  if (lab) {
    await page.waitForFunction(() => window.__lab);
    const ok = await page.evaluate(() => {
      window.__lab.grantCoins(40000);
      return ['bc.veh.dump', 'bc.veh.fork'].map((id) => window.__lab.store.buy(id).ok);
    });
    assert.deepEqual(ok, [true, true]);
  }
  await page.locator('#sandbox')[tap]();
  await page.locator('#open-tray')[tap]();
  for (let i = 0; i < 61; i++) await page.locator('[data-spawn="cube"]')[tap]();
  await page.locator('#close-tray')[tap]();
  const state = await page.evaluate(() => window.__buildCrew.state);
  assert.equal(state.blocks.length, 64);
  // the four free machines (the wheel loader joined in 0.6), and the two Lab machines when bought
  assert.equal(state.machines.length, lab ? 6 : 4);
}

/** A job on one of the newer sites, played through the real loop (no test hooks): a builder whose save has jobs 1 to
 *  19 done opens job `id` from the job board, so the site, its scenery and the job's machines and toys are all there. */
async function siteFixture(page, tap, id) {
  await page.waitForFunction(() => window.__buildCrew);
  await page.locator('#add-player')[tap]();
  await page.keyboard.type('Site');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__buildCrew.state.playerId);
  // the progress is written by an init script on the next page (this page saves its own copy on the way out)
  const playerId = await page.evaluate(() => window.__buildCrew.state.playerId);
  await page.context().addInitScript((id) => {
    const done = Array.from({ length: 19 }, (_, i) => i + 1);
    localStorage.setItem(`buildCrew.${id}.save`, JSON.stringify({ v: 1, done, rewards: ['excavator', 'crane', 'loader'] }));
  }, playerId);
  await page.reload();
  await page.waitForFunction(() => window.__buildCrew);
  await page.locator('#jobs')[tap]();
  await page.locator(`[data-job="${id}"]`)[tap]();
  await page.waitForFunction((id) => window.__buildCrew.state.round === id, id);
}

/** The desktop and phone samples on a harbor and a hillside job. */
async function siteSample(browser, id, phone) {
  const context = await browser.newContext(
    phone
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }
      : { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 },
  );
  const page = await context.newPage();
  await page.goto(BASE + '/build-crew/?nosw=1&perf=1');
  await siteFixture(page, phone ? 'tap' : 'click', id);
  const site = await page.evaluate(() => window.__buildCrew.state.site);
  if (phone) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.waitForTimeout(1500);
  // drive for a moment (the keyboard on the desktop; the phone holds W the same way through the page's own keys)
  await page.keyboard.down('w');
  await page.waitForTimeout(1600);
  await page.keyboard.up('w');
  await page.waitForFunction(() => window.__buildCrew.performance.frame.length >= 120, { timeout: 120000 });
  const limits = { p95FrameMs: 350, p95UpdateMs: phone ? 33.3 : 16.7, drawCalls: 150, triangles: 120000 };
  const result = await measure(
    page,
    phone ? 60 : 120,
    phone
      ? 'Chromium headless / ANGLE SwiftShader / 390x844 at device scale 3, touch, CPU throttled 4x'
      : 'Chromium headless / ANGLE SwiftShader / 1024x768 logical pixels with adaptive render resolution',
    `job ${id} on the ${site} (its machines, toys and the site's scenery)`,
    { site, limits },
  );
  console.log(result);
  assert.equal(result.quality.tier, phone ? 'phone' : 'desktop');
  assert(result.p95FrameMs < limits.p95FrameMs);
  assert(result.p95UpdateMs < limits.p95UpdateMs);
  assert(result.drawCalls <= limits.drawCalls);
  assert(result.triangles <= limits.triangles);
  await context.close();
  return result;
}

/** Resets the samples and waits for `n` frames, then returns the summary. */
async function measure(page, n, environment, fixtureText, extra = {}) {
  await page.evaluate(() => window.__buildCrew.resetPerformance());
  await page.waitForFunction((n) => window.__buildCrew.performance.frame.length >= n, n, { timeout: 120000 });
  const p = await page.evaluate(() => window.__buildCrew.performance);
  return {
    environment,
    sampleFrames: p.frame.length,
    fixture: fixtureText,
    medianFrameMs: quantile(p.frame, 0.5),
    p95FrameMs: quantile(p.frame, 0.95),
    p95UpdateMs: quantile(p.update, 0.95),
    p95RenderMs: quantile(p.render, 0.95),
    drawCalls: p.calls,
    triangles: p.triangles,
    renderer: p.renderer,
    effectiveDpr: p.effectiveDpr,
    quality: p.quality,
    physicsStepsPerFrame: p.loop.steps,
    framesBehind: p.loop.behind,
    ...extra,
  };
}

/** The desktop sample, with or without the Lab machines. */
async function desktop(browser, lab) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  await page.goto(BASE + '/build-crew/?nosw=1&perf=1');
  await fixture(page, 'click', { lab });
  await page.waitForTimeout(1200);
  await page.keyboard.down('w');
  await page.waitForTimeout(1600);
  await page.keyboard.up('w');
  await page.waitForFunction(() => window.__buildCrew.performance.frame.length >= 160, { timeout: 90000 });
  const result = await measure(
    page,
    120,
    'Chromium headless / ANGLE SwiftShader / 1024x768 logical pixels with adaptive render resolution',
    lab ? '64 dynamic toys and all five machines (the Lab dump truck and forklift bought)' : '64 dynamic toys and all three machines',
    { limits: { p95FrameMs: 350, p95UpdateMs: 16.7, drawCalls: 150, triangles: 120000 } },
  );
  assert.equal(result.quality.tier, 'desktop');
  console.log(result);
  assert(result.p95FrameMs < 350);
  assert(result.p95UpdateMs < 16.7);
  assert(result.drawCalls <= 150);
  assert(result.triangles <= 120000);
  await page.close();
  return result;
}

const browser = await chromium.launch({ headless: true, args: SWIFTSHADER_ARGS });
const out = {};
try {
  // ---- Desktop: the three original machines, then all five ----
  out.desktop = await desktop(browser, false);
  out.desktopLab = await desktop(browser, true);
  // ---- Phone: touch, 390x844 at device scale 3, CPU slowed 4x, real touch events on the drive stick ----
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(BASE + '/build-crew/?nosw=1&perf=1');
    await fixture(page, 'tap', { lab: true });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.waitForTimeout(1500);
    const b = await page.locator('[data-stick="drive"]').boundingBox(),
      cx = b.x + b.width / 2,
      cy = b.y + b.height / 2;
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    await touch('touchStart', [{ id: 1, x: cx, y: cy - 30 }]);
    for (let i = 0; i < 40; i++) {
      await touch('touchMove', [{ id: 1, x: cx + Math.sin(i / 6) * 14, y: cy - 30 }]);
      await page.waitForTimeout(40);
    }
    await touch('touchEnd', []);
    await page.waitForFunction(() => window.__buildCrew.performance.frame.length >= 60, { timeout: 120000 });
    const result = await measure(
      page,
      60,
      'Chromium headless / ANGLE SwiftShader / 390x844 at device scale 3, touch, CPU throttled 4x',
      '64 dynamic toys and all five machines (the Lab dump truck and forklift bought)',
      { limits: { p95FrameMs: 350, p95UpdateMs: 33.3, drawCalls: 150, triangles: 120000 } },
    );
    assert.equal(result.quality.tier, 'phone');
    assert(result.effectiveDpr <= 1.5, 'phones render at no more than 1.5x');
    out.phone = result;
    console.log(result);
    assert(result.p95FrameMs < 350);
    assert(result.p95UpdateMs < 33.3, 'phone CPU update stays inside a 30 fps frame at 4x throttle');
    assert(result.drawCalls <= 150);
    assert(result.triangles <= 120000);
    await context.close();
  }
  // ---- The harbor (job 13: crane, skid steer, barge, quay crane) and the hillside (job 20: all four free machines on
  // the slope), desktop and phone ----
  out.sites = {};
  for (const id of [13, 20]) {
    out.sites[`job${id}Desktop`] = await siteSample(browser, id, false);
    out.sites[`job${id}Phone`] = await siteSample(browser, id, true);
  }
  writeFileSync(
    resultsPath('frame-results.json'),
    JSON.stringify({ ...out.desktop, desktopLab: out.desktopLab, phone: out.phone, sites: out.sites }, null, 2) + '\n',
  );
} finally {
  await browser.close();
}

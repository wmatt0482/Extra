// The frame-time sample (SPEC §6): a sandbox with 64 toys and all three machines, driven for a moment, then 120 frames
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
async function fixture(page, tap) {
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
  await page.locator('#sandbox')[tap]();
  await page.locator('#open-tray')[tap]();
  for (let i = 0; i < 61; i++) await page.locator('[data-spawn="cube"]')[tap]();
  await page.locator('#close-tray')[tap]();
  const state = await page.evaluate(() => window.__buildCrew.state);
  assert.equal(state.blocks.length, 64);
  assert.equal(state.machines.length, 3);
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

const browser = await chromium.launch({ headless: true, args: SWIFTSHADER_ARGS });
const out = {};
try {
  // ---- Desktop ----
  {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
    await page.goto(BASE + '/build-crew/?nosw=1&perf=1');
    await fixture(page, 'click');
    await page.waitForTimeout(1200);
    await page.keyboard.down('w');
    await page.waitForTimeout(1600);
    await page.keyboard.up('w');
    await page.waitForFunction(() => window.__buildCrew.performance.frame.length >= 160, { timeout: 90000 });
    const result = await measure(
      page,
      120,
      'Chromium headless / ANGLE SwiftShader / 1024x768 logical pixels with adaptive render resolution',
      '64 dynamic toys and all three machines',
      {
        limits: { p95FrameMs: 350, p95UpdateMs: 16.7, drawCalls: 150, triangles: 120000 },
        note:
          'The 350 ms software-only wall-frame ceiling accounts for runner variance; it is not the physical 16.7 ms ' +
          'target. CPU update, draw-call and triangle budgets remain independent guards. Physical iPad and ' +
          'modest-laptop GPU checks remain manual.',
      },
    );
    assert.equal(result.quality.tier, 'desktop');
    out.desktop = result;
    console.log(result);
    assert(result.p95FrameMs < 350);
    assert(result.p95UpdateMs < 16.7);
    assert(result.drawCalls <= 150);
    assert(result.triangles <= 120000);
    await page.close();
  }
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
    await fixture(page, 'tap');
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
      '64 dynamic toys and all three machines',
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
  writeFileSync(resultsPath('frame-results.json'), JSON.stringify({ ...out.desktop, phone: out.phone }, null, 2) + '\n');
} finally {
  await browser.close();
}

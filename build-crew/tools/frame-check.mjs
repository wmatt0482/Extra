// The frame-time sample (SPEC §6): a sandbox with 64 toys and all three machines, driven for a moment, then 120 frames
// measured after the adaptive quality controller settles. It asserts the SwiftShader wall-frame ceiling, the CPU update
// budget and the draw-call and triangle caps. This is a correctness/performance baseline on software rendering; it does
// not certify an iPad GPU's frame rate.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { loadPlaywright, resultsPath, SWIFTSHADER_ARGS } from './runner.mjs';
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true, args: SWIFTSHADER_ARGS });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  await page.goto((process.env.BASE_URL || 'http://localhost:8080') + '/build-crew/?nosw=1&perf=1');
  await page.waitForFunction(() => window.__buildCrew);
  await page.locator('#add-player').click();
  await page.keyboard.type('Perf');
  await page.keyboard.press('Enter');
  await page.locator('#parents').click();
  for (const d of '1234') await page.locator(`[data-digit="${d}"]`).click();
  await page.waitForTimeout(200);
  for (const d of '1234') await page.locator(`[data-digit="${d}"]`).click();
  await page.locator('.pz-tabs [data-tab="options"]').click();
  await page.locator('#bc-unlock').click();
  await page.locator('#pz-close').click();
  await page.locator('#sandbox').click();
  await page.locator('#open-tray').click();
  for (let i = 0; i < 61; i++) await page.locator('[data-spawn="cube"]').click();
  await page.locator('#close-tray').click();
  const fixture = await page.evaluate(() => window.__buildCrew.state);
  assert.equal(fixture.blocks.length, 64);
  assert.equal(fixture.machines.length, 3);
  await page.waitForTimeout(1200);
  await page.keyboard.down('w');
  await page.waitForTimeout(1600);
  await page.keyboard.up('w');
  await page.waitForFunction(() => window.__buildCrew.performance.frame.length >= 160, { timeout: 90000 });
  await page.evaluate(() => window.__buildCrew.resetPerformance());
  await page.waitForFunction(() => window.__buildCrew.performance.frame.length >= 120, { timeout: 60000 });
  const p = await page.evaluate(() => window.__buildCrew.performance),
    quantile = (a, n) => a.slice().sort((x, y) => x - y)[Math.floor((a.length - 1) * n)];
  const result = {
    environment: 'Chromium headless / ANGLE SwiftShader / 1024x768 logical pixels with adaptive render resolution',
    sampleFrames: p.frame.length,
    fixture: '64 dynamic toys and all three machines',
    medianFrameMs: quantile(p.frame, 0.5),
    p95FrameMs: quantile(p.frame, 0.95),
    p95UpdateMs: quantile(p.update, 0.95),
    p95RenderMs: quantile(p.render, 0.95),
    drawCalls: p.calls,
    triangles: p.triangles,
    renderer: p.renderer,
    effectiveDpr: p.effectiveDpr,
    limits: { p95FrameMs: 350, p95UpdateMs: 16.7, drawCalls: 150, triangles: 120000 },
    note:
      'The 350 ms software-only wall-frame ceiling accounts for runner variance; it is not the physical 16.7 ms ' +
      'target. CPU update, draw-call and triangle budgets remain independent guards. Physical iPad and ' +
      'modest-laptop GPU checks remain manual.',
  };
  writeFileSync(resultsPath('frame-results.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(result);
  assert(result.p95FrameMs < 350);
  assert(result.p95UpdateMs < 16.7);
  assert(result.drawCalls <= 150);
  assert(result.triangles <= 120000);
} finally {
  await browser.close();
}

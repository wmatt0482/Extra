// The 0.8 browser stage, run by browser-smoke.mjs (or alone with PLACING_ONLY=1): Job 1 is finished in the real game with
// real WebGL by placing its three blocks both ways (one poured out of a tilted bucket, one pushed in with the lowered
// bucket, one poured again), with a bump test between them, then the payout, the celebration, Job 2 opening and the
// Gallery are checked; the Sandbox's site goals card and a keyboard tap on a real (non-test) page are checked too. The
// scripted operator sends production axes through the test hook and never sets a pose. Screenshots (deviceScaleFactor 2)
// go to SHOTS_DIR as the evidence for the 0.8 work.
import assert from 'node:assert/strict';
import path from 'node:path';

const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export async function placingStage({ browser, BASE, shots, errors, results, mark = () => {} }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  // The pop and the celebration burst stay up long enough for a slow software renderer to photograph them.
  await page.addInitScript(() => {
    const st = window.setTimeout;
    window.setTimeout = (f, d, ...a) => st(f, d === 1700 || d === 2800 ? 12000 : d, ...a);
  });
  await page.goto(BASE + '/build-crew/?test=1&nosw=1');
  await page.waitForFunction(() => window.__buildCrew, undefined, { timeout: 90000 });
  await page.locator('#add-player').click();
  await page.keyboard.type('Mia');
  await page.keyboard.press('Enter');
  await page.locator('#title').waitFor();
  await page.waitForFunction(() => window.__lab && !document.querySelector('#lab-open').hidden, undefined, { timeout: 30000 });
  const shot = (name) => page.screenshot({ path: path.join(shots, name + '.png') });
  const adv = (axes, n) => page.evaluate(([a, n]) => window.__buildCrew.test.advance(a, n), [axes, n]);
  const st = () => page.evaluate(() => window.__buildCrew.state);
  const act = (a) => page.evaluate((a) => window.__buildCrew.test.action(a), a);
  const get = async () => {
    const s = await st();
    return s.machines[s.active];
  };
  const block = async (id) => (await st()).blocks.find((b) => b.id === id);
  async function height(y) {
    for (let i = 0; i < 120; i++) {
      const d = y - (await get()).lift;
      if (Math.abs(d) < 0.02) break;
      await adv({ lift: clamp(d * 2) }, 8);
    }
    await adv({}, 30);
  }
  async function rotate(yaw) {
    for (let i = 0; i < 160; i++) {
      const d = ang(yaw - (await get()).yaw);
      if (Math.abs(d) < 0.01) break;
      await adv({ steer: clamp(d * 1.7) }, 8);
    }
    await adv({}, 20);
  }
  async function move(x, z, face = 0) {
    for (let i = 0; i < 400; i++) {
      const m = await get(),
        dx = x - m.x,
        dz = z - m.z,
        dist = Math.hypot(dx, dz);
      if (dist < 0.06) break;
      const err = ang(Math.atan2(dx, dz) - m.yaw);
      await adv({ steer: clamp(err * 1.8), drive: Math.abs(err) < 0.19 ? clamp(dist * 0.65, 0, 0.85) : 0 }, 10);
    }
    await adv({}, 30);
    await rotate(face);
  }
  async function route(x, z, face = 0) {
    const m = await get();
    await move(m.x, -6.2);
    await move(x, -6.2);
    await move(x, z, face);
  }
  /** Picks block `id` up from the front and carries it to a bucket position over the zone. */
  async function carryTo(id, x, z, lift = 2) {
    const b = await block(id);
    await height(3.5);
    await route(b.position.x, b.position.z - 2.7);
    await height(b.position.y + 0.04);
    await act('grab');
    assert.equal((await st()).held, id, `block ${id} is grabbed`);
    await height(3.2);
    await route(x, z - 2.7);
    await height(lift);
  }
  /** Tilts the bucket forward and lets go: the block must slide out and end up placed. */
  async function pour(id) {
    await adv({ tool: 1 }, 40);
    assert((await get()).tilt > 0.25, 'the bucket is tilted past the pour angle');
    await act('grab');
    for (let i = 0; i < 100 && !(await block(id)).locked; i++) await adv({}, 6);
    assert((await block(id)).locked, `the poured block ${id} ended placed in the zone`);
  }

  // ---- the job card, the intro and the payout ---------------------------------------------------------------------------
  await page.locator('#jobs').click();
  assert.match(await page.locator('[data-job="1"]').textContent(), /52 coins · 64 XP/, 'the job card shows the payout');
  assert.match(await page.locator('[data-job="3"]').textContent(), /Foundation grid: 5\.2 m long, 1\.2 m tall/, 'a blueprint job card shows its metres');
  await shot('job-card-payout');
  await page.locator('#modal-close').click();
  await page.evaluate(() => window.__buildCrew.test.start(1));
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#job-number').getAttribute('data-pay'), '52 coins · 64 XP');
  await page.waitForFunction(() => /PAYS 52 LAB COINS AND 64 XP/i.test(document.querySelector('#toasts').innerText), undefined, { timeout: 10000 });
  await shot('job-intro-payout');
  mark('job 1: payout on the card and in the intro');

  // ---- the grab highlight and the forward arrow -------------------------------------------------------------------------
  let s = await st();
  assert.equal(s.arrow, true, 'the forward arrow shows during play');
  await height(3.5);
  await route(-0.6, 3 - 2.7);
  await height(0.72);
  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) {
    await page.waitForTimeout(120);
    ready = await page.evaluate(() => document.querySelector('#grab').classList.contains('ready'));
    if (!ready) await adv({ drive: 0.25 }, 6);
  }
  assert(ready, 'the Grab button lights up when a block is in reach');
  assert.equal((await st()).glow, 3, 'the nearest block glows');
  // look at it from the front, so the glowing block is not hidden behind the machine
  await page.mouse.move(640, 420);
  await page.mouse.down();
  await page.mouse.move(380, 400, { steps: 8 });
  await page.mouse.up();
  await adv({}, 2);
  await page.waitForTimeout(900);
  await shot('grab-highlight');
  await shot('forward-arrow');
  mark('grab highlight and forward arrow');

  // ---- block 3 by pour; a bump never unplaces it ----------------------------------------------------------------------------
  await act('grab');
  assert.equal((await st()).held, 3);
  await height(3.2);
  await route(3.0, 0.3);
  await height(2.0);
  await adv({}, 30);
  await page.evaluate(() => {
    window.__pops = 0;
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('placed-pop')) window.__pops++;
    }).observe(document.querySelector('#hud'), { childList: true });
  });
  await adv({ tool: 1 }, 40);
  await act('grab');
  let popShot = false,
    pourShot = false;
  for (let i = 0; i < 120 && !(await block(3)).locked; i++) {
    await adv({}, 4);
    const b = await block(3),
      m = await get();
    if (!pourShot && b.position.z > m.tip.z + 0.7 && b.position.y > 0.9) {
      pourShot = true;
      await shot('pour-mid-motion');
    }
  }
  assert(pourShot || (await block(3)).locked, 'the block slid out of the bucket');
  assert((await block(3)).locked, 'the poured block locked');
  for (let i = 0; i < 20 && !popShot; i++) {
    if (await page.locator('.placed-pop').count()) {
      popShot = true;
      await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.closest?.('.placed-pop')).forEach((a) => { a.pause(); a.currentTime = 420; }));
      await shot('placed-pop');
    } else await page.waitForTimeout(100);
  }
  assert((await page.evaluate(() => window.__pops)) >= 1, 'a "Placed!" pop appeared');
  assert.match(await page.locator('.placed-pop').first().textContent().catch(() => 'Placed!'), /Placed!/);
  s = await st();
  assert.equal(s.status.count, 1);
  assert.match(await page.locator('#hint').textContent(), /2 to go: bring the next red block\./, 'the hint says what comes next');
  const placedAt = (await block(3)).position;
  await height(1.0);
  await route(3.0, 0.2);
  for (const [axes, n] of [
    [{ drive: 1 }, 100],
    [{ drive: -1, steer: 0.4 }, 100],
    [{ steer: 1, tilt: 1 }, 50],
    [{ drive: -1, tilt: -1 }, 60],
  ]) {
    await adv(axes, n);
    s = await st();
    assert.equal(s.status.count, 1, 'a bump does not unplace the block');
  }
  const after = (await block(3)).position;
  assert(Math.hypot(after.x - placedAt.x, after.y - placedAt.y, after.z - placedAt.z) < 1e-3, 'the placed block did not move');
  assert.equal((await block(3)).locked, true);
  mark('pour placed a block; the bump left it placed; Placed! pop and the next-step hint');

  // ---- block 2 by push ---------------------------------------------------------------------------------------------------
  await height(0.72);
  const two = await block(2);
  await route(two.position.x - 4.0, two.position.z, Math.PI / 2);
  for (let i = 0; i < 80; i++) {
    s = await st();
    const m = s.machines[s.active];
    if (s.blocks.find((b) => b.id === 2).position.x > 3.7 || m.x > 1.4) break;
    await adv({ drive: 0.5, steer: clamp(ang(Math.PI / 2 - m.yaw) * 1.5) }, 12);
  }
  await adv({}, 120);
  for (let i = 0; i < 40 && !(await block(2)).locked; i++) await adv({}, 6);
  assert((await block(2)).locked, 'the pushed block locked in the zone');
  assert.equal((await st()).status.count, 2);
  assert.match(await page.locator('#hint').textContent(), /Last one to go: bring the final red block\./);
  mark('push placed a block');

  // ---- block 1 by pour: the job completes with the payout ------------------------------------------------------------------
  await carryTo(1, 6.6, 3.0, 1.8);
  await pour(1);
  let burst = '';
  for (let i = 0; i < 60 && !(await st()).complete; i++) await adv({}, 6);
  s = await st();
  assert(s.complete, 'the job completed from three placed blocks');
  assert(s.blocks.every((b) => b.locked), 'every block ended placed');
  await page.waitForTimeout(700);
  burst = await page.locator('#payout-burst').innerText();
  assert.match(burst, /JOB COMPLETE/i);
  assert.match(burst, /\+52 LAB COINS · \+64 XP/i, 'the celebration shows the exact payout');
  await shot('celebration-payout');
  await page.waitForSelector('#next-round', { timeout: 45000 });
  assert.match(await page.locator('#payout-line').innerText(), /\+52 LAB COINS · \+64 XP/i, 'the sheet repeats it');
  await shot('job-complete-sheet');
  assert(s.save.done.includes(1) && s.save.rewards.includes('cream'), 'the job and its reward were recorded');
  mark('job 1 completed with the celebration and the exact payout');

  // Gallery gets the build
  await page.locator('#to-base').click();
  await page.locator('#lab-gallery').click();
  await page.waitForFunction(() => /Cargo transfer/.test(document.querySelector('.lab-overlay')?.innerText || ''), undefined, { timeout: 15000 });
  await shot('gallery');
  mark('the Gallery holds the Cargo transfer build');
  await page.evaluate(() => document.querySelectorAll('.lab-overlay').forEach((e) => e.remove()));

  // ---- Sandbox: site goals --------------------------------------------------------------------------------------------------
  await page.locator('#sandbox').click();
  await page.locator('#open-tray').click();
  await page.locator('#open-goals').click();
  assert.equal(await page.locator('#goal-list .goal').count(), 8, 'eight site goals');
  assert.equal(await page.locator('#goal-list .goal.done').count(), 0);
  assert.equal(await page.locator('.modal-card').getByText(/timer|lost|lives|fail/i).count(), 0, 'no pressure words on the card');
  await shot('site-goals-card');
  await page.locator('#modal-close').click();
  await page.locator('#open-tray').click();
  const taps = [
    ['hill', 420, 330],
    ['pit', 760, 400],
    ['ramp', 980, 470],
    ['water', 560, 520],
  ];
  for (const [kind, x, y] of taps) {
    if (await page.locator('#tray').isHidden()) await page.locator('#open-tray').click();
    await page.locator(`[data-stamp="${kind}"]`).click();
    await page.mouse.click(x, y);
  }
  assert.equal((await st()).stamps.length, 4, 'four terrain pieces placed');
  await adv({}, 60);
  assert((await st()).save.goals.includes('shape'), 'the terrain goal earned its star');
  await page.locator('#open-tray').click();
  await page.locator('#open-goals').click();
  assert((await page.locator('#goal-list .goal.done').count()) >= 1, 'the card shows the earned star');
  assert.equal(await page.locator('#goal-list .goal[data-goal="shape"].done').count(), 1);
  await shot('site-goals-star');
  await page.locator('#modal-close').click();
  mark('sandbox site goals card with a star earned automatically');

  // ---- the same profile on a real (non-test) page: Job 2 is open and Job 3 is not, and a keyboard tap moves the machine --------
  await page.goto(BASE + '/build-crew/?nosw=1');
  await page.waitForFunction(() => window.__buildCrew, undefined, { timeout: 90000 });
  if (!(await page.locator('#title').isVisible())) await page.locator('#player-grid [data-profile]').filter({ hasText: 'Mia' }).click();
  await page.locator('#title').waitFor();
  await page.locator('#jobs').click();
  assert.equal(await page.locator('[data-job="2"]').isDisabled(), false, 'Job 2 unlocked');
  assert.equal(await page.locator('[data-job="3"]').isDisabled(), true, 'Job 3 is still locked');
  await page.locator('#modal-close').click();
  await page.locator('#sandbox').click();
  await page.waitForFunction(() => window.__buildCrew.state.screen === 'play');
  await page.waitForTimeout(1500);
  const z0 = await page.evaluate(() => window.__buildCrew.state.machines[0].z);
  await page.keyboard.down('w');
  await page.waitForTimeout(25);
  await page.keyboard.up('w');
  await page.waitForFunction((z) => window.__buildCrew.state.machines[0].z > z + 0.2, z0, { timeout: 20000 });
  const moved = (await page.evaluate(() => window.__buildCrew.state.machines[0].z)) - z0;
  assert(moved >= 0.2, `a 25 ms tap on W nudged the machine ${moved.toFixed(2)} m`);
  mark('Job 2 opens after Job 1; a keyboard tap nudges the machine at least 0.2 m (0.5 m at 60 fps)');
  await context.close();
}

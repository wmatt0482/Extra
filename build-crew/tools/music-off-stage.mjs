// The 0.8.2 browser stage, run by browser-smoke.mjs (or alone with ONLY_MUSICOFF=1): the parent's "Background music in all
// games" switch (Parents → Options → ALL GAMES, the shared Parent Zone). Off: the tune never plays (Music.isPlaying is false,
// Music.locked true), also after the zone closes and after a reload; sound effects still make sound; a change arriving from sync
// or another tab (the `storage` event) stops the tune; the child's own Music setting is kept and applies again when the switch
// is back On; the child's Music button (the shared helper the pause sheet uses) reads Off, disabled, with the note.
import assert from 'node:assert/strict';
import path from 'node:path';

export async function musicOffStage({ browser, BASE, shots, errors, mark = () => {} }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('mo-seeded')) {
      localStorage.clear();
      localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, players: [{ id: 'kai01', name: 'Kai', color: '#2fd36b', createdAt: 1, updatedAt: 1 }], migrated: true }));
      sessionStorage.setItem('mo-seeded', '1');
    }
    window.__oscCount = 0;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { const o = AC.prototype.createOscillator; AC.prototype.createOscillator = function () { window.__oscCount++; return o.apply(this, arguments); }; }
  });
  const music = () => page.evaluate(async () => { const { Music } = await import('/build-crew/src/meta/music.js'); return { playing: Music.isPlaying, locked: Music.locked }; });
  const pick = async () => {
    await page.waitForSelector('#screen-players:not([hidden]), #title:not([hidden])');      // (a reload in the same tab returns to the builder's home screen)
    if (await page.locator('#screen-players:not([hidden])').count()) await page.locator('#player-grid [data-profile="kai01"]').click();
    await page.locator('#title').waitFor();
  };
  const pinIn = async (pin) => { for (const d of pin) await page.locator(`.pinpad [data-digit="${d}"]`).click(); await page.waitForTimeout(250); };
  // reopening the zone right after closing it can still be unlocked: the PIN pad is skipped then
  const reopen = async () => {
    await page.locator('#parents').click();
    await page.waitForSelector('.pinpad, .pz-content');
    if (await page.locator('.pinpad').count()) await pinIn('1234');
    await page.waitForSelector('.pz-content');
    await page.locator('.pz-tabs [data-tab="options"]').click();
  };
  await page.goto(BASE + '/build-crew/?test=1&nosw=1');
  await page.waitForFunction(() => window.__buildCrew, undefined, { timeout: 90000 });
  await pick();
  await page.waitForTimeout(800);
  assert.deepEqual(await music(), { playing: true, locked: false }, 'baseline: the tune plays on the home screen');
  mark('music switch: baseline, the tune plays');

  await page.locator('#parents').click();
  await page.locator('#pz:not([hidden])').waitFor();
  await pinIn('1234');
  await page.waitForFunction(() => /again/i.test((document.querySelector('#pin-title') || {}).textContent || ''));
  await pinIn('1234');
  await page.waitForSelector('.pz-content[data-tab="sync"]');
  assert.equal(await page.locator('#opt-family-music').count(), 0, 'not on the Family code tab');
  await page.locator('.pz-tabs [data-tab="options"]').click();
  const tg = page.locator('#opt-family-music');
  await tg.waitFor();
  assert.equal(await tg.getAttribute('aria-checked'), 'true', 'On by default');
  const rowText = await page.evaluate(() => document.querySelector('#opt-family-music').parentElement.textContent);
  assert.match(rowText, /Background music in all games/);
  assert.match(rowText, /Turns off the music in every game on every device in the family\. Sound effects and the voice stay on\./);
  await tg.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shots, 'parent-zone-music-switch.png') });
  mark('music switch: the Options row, label and help line, behind the PIN');

  await tg.click();                                                   // Off
  await page.waitForTimeout(300);
  const fam = await page.evaluate(() => JSON.parse(localStorage.getItem('spellJump.family')));
  assert(fam.musicOff === true && fam.musicOffAt > 0, 'stored in the family record');
  assert.equal((await music()).locked, true);
  await page.locator('#pz-close').click();
  await page.locator('#title').waitFor();
  await page.waitForTimeout(600);
  assert.deepEqual(await music(), { playing: false, locked: true }, 'Off: after the zone closes the tune stays off');
  const osc0 = await page.evaluate(() => window.__oscCount);
  await page.evaluate(async () => { const { Audio } = await import('/spell-jump/src/audio.js'); Audio.correct(); Audio.land(1); });
  assert((await page.evaluate(() => window.__oscCount)) > osc0, 'sound effects still make sound');
  assert.equal((await music()).playing, false);
  // the child's Music button (the shared helper behind the pause sheet's button)
  const probe = await page.evaluate(async () => {
    const { bindMusicButton } = await import('/spell-jump/src/ui/musicNote.js');
    const box = document.createElement('div'); const b = document.createElement('button'); b.id = 'probe-music'; box.append(b); document.body.append(box);
    bindMusicButton(b, () => true, (on) => `Music ${on ? 'on' : 'off'}`);
    const n = box.querySelector('[data-music-lock-note]');
    return { text: b.textContent, disabled: b.disabled, note: n && n.textContent };
  });
  assert.deepEqual(probe, { text: 'Music off', disabled: true, note: 'Music is off (set by a grown-up)' });
  mark('music switch: Off, the tune is silent and locked, effects still play, the child button is off + disabled + noted');

  // On again: the child's own preference (on) applies
  await reopen();
  await page.locator('#opt-family-music').click();
  await page.locator('#pz-close').click();
  await page.locator('#title').waitFor();
  await page.waitForTimeout(600);
  assert.deepEqual(await music(), { playing: true, locked: false }, 'On again: the tune plays again');
  assert.equal(await page.evaluate(() => !document.querySelector('#probe-music') || !document.querySelector('#probe-music').disabled), true, 'a bound button un-disables');
  // the child's own Off survives an Off / On of the family switch
  await reopen();
  await page.locator('#opt-music').click();                           // the child's own Music: off
  await page.locator('#opt-family-music').click();                    // family Off
  await page.locator('#opt-family-music').click();                    // family On
  await page.locator('#pz-close').click();
  await page.locator('#title').waitFor();
  await page.waitForTimeout(500);
  assert.deepEqual(await music(), { playing: false, locked: false }, "family On again: the child's own Music Off still applies");
  await reopen();
  await page.locator('#opt-music').click();                           // child's own: on again
  await page.locator('#pz-close').click();
  await page.locator('#title').waitFor();
  await page.waitForTimeout(500);
  assert.equal((await music()).playing, true);
  mark("music switch: On again restores the child's own preference (on and off)");

  // a change arriving from another tab / sync
  await page.evaluate(() => { const f = JSON.parse(localStorage.getItem('spellJump.family')); f.musicOff = true; f.musicOffAt = Date.now() + 100000; localStorage.setItem('spellJump.family', JSON.stringify(f)); window.dispatchEvent(new StorageEvent('storage', { key: 'spellJump.family' })); });
  await page.waitForTimeout(300);
  assert.deepEqual(await music(), { playing: false, locked: true }, 'a change from elsewhere stops the tune at once');
  await page.reload();
  await page.waitForFunction(() => window.__buildCrew, undefined, { timeout: 90000 });
  await pick();
  await page.waitForTimeout(800);
  assert.deepEqual(await music(), { playing: false, locked: true }, 'a fresh load with the switch Off: the tune never starts');
  mark('music switch: a change from another tab stops it at once; a fresh load never starts it');
  await context.close();
}

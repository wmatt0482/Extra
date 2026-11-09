// The family music switch ("Background music in all games", Parents → Options), checked in a browser for any game.
// runMusicOffCheck(browser, cfg, check): cfg = {
//   name, url (game page, mock mode), viewport, familyId ('pkid'), pick(page) (choose the player; the title is showing after it),
//   parentsBtn (selector clicked to open the Parent Zone), optionsTab ('options' | tab id), famToggle ('#opt-family-music'),
//   childToggle? (the Parent Zone's own per-device Music toggle selector), pauseBtn? (the child's Music button; may be hidden),
//   audio ('/spell-jump/src/audio.js'), state? (page → {playing, locked}; default: the shared Audio), effect? (page → plays an effect),
//   closeParent? (a selector that closes the Parent Zone, for a game that pauses its music while the zone is open: the checks then close and reopen it),
//   hasMusic? (false: the game never plays music; only the lock and the UI are checked), shot? (a screenshot path of the toggle) }
// The checks: music plays at first (if the game has music), the toggle is only behind the PIN, Off stops it at once and nothing can start it,
// effects still play, the child's button reads Off + disabled + the note, On again restores the child's own preference, a change arriving
// from sync / another tab stops music, and a fresh load with the switch Off never starts music.

export async function runMusicOffCheck(browser, cfg, check) {
  const tag = `${cfg.name} music switch`;
  console.log(`\n=== ${tag} ===`);
  const ctx = await browser.newContext({ viewport: cfg.viewport || { width: 844, height: 390 } });
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript((seed) => {
    if (!sessionStorage.getItem('mo-seeded')) {
      localStorage.clear();
      const now = Date.now();
      localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, players: [{ id: seed.id, name: 'Kid', color: '#3b7dd9', createdAt: now, updatedAt: now }], pinHash: null, pinUpdatedAt: 0, options: {}, optionsUpdatedAt: {}, removedPlayers: [], migrated: true, lastPlayer: null }));
      sessionStorage.setItem('mo-seeded', '1');
    }
    window.__oscCount = 0;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { const o = AC.prototype.createOscillator; AC.prototype.createOscillator = function () { window.__oscCount++; return o.apply(this, arguments); }; }
  }, { id: cfg.familyId || 'pkid' });
  const S = cfg.state || ((p) => p.evaluate(async (m) => { const { Audio } = await import(m); return { playing: Audio.musicPlaying, locked: Audio.musicLocked }; }, cfg.audio));
  const effect = cfg.effect || ((p) => p.evaluate(async (m) => { const { Audio } = await import(m); Audio.correct(); Audio.land(1); }, cfg.audio));
  const click = (sel) => page.click(sel);
  const pinIn = async (pin) => { for (const d of pin) await page.click(`.pinpad [data-digit="${d}"]`); await page.waitForTimeout(220); };
  const btn = () => page.evaluate((sel) => { const b = sel && document.querySelector(sel), n = document.querySelector('[data-music-lock-note]'); return b ? { text: b.textContent, disabled: b.disabled, note: n ? n.textContent : null } : null; }, cfg.pauseBtn);
  const waitPlaying = (want) => page.waitForFunction(async ([m, w]) => { const { Audio } = await import(m); return Audio.musicPlaying === w; }, [cfg.audio, want], { timeout: 4000 }).catch(() => {});

  await page.goto(cfg.url, { waitUntil: 'networkidle' });
  await cfg.pick(page);
  if (cfg.hasMusic !== false) {
    if (cfg.state) await page.waitForTimeout(1200); else await waitPlaying(true);
    const s0 = await S(page);
    check(s0.playing === true && s0.locked === false, `${tag}: baseline: the music plays (family switch absent)`);
  }
  const ready = cfg.zoneReady || '.pz-content';        // what shows once the zone is unlocked (Case Files: '.pz-tabs')
  let pinSet = false;
  const openZone = async (toOptions) => {
    await click(cfg.parentsBtn);
    await page.waitForSelector('#pz:not([hidden])');
    await page.waitForSelector(`.pinpad, ${ready}`);
    if (await page.locator('.pinpad').count()) {          // (a reopened zone may still be unlocked: then the PIN pad is skipped)
      await pinIn('1234');
      if (!pinSet) { await page.waitForFunction(() => /again/i.test((document.querySelector('#pin-title') || {}).textContent || '')); await pinIn('1234'); pinSet = true; }
    }
    await page.waitForSelector(ready);
    if (toOptions) { await page.click(`.pz-tabs [data-tab="${cfg.optionsTab || 'options'}"]`); await page.waitForSelector(cfg.famToggle); }
  };
  const closeZone = async () => { await click(cfg.closeParent); await page.waitForSelector('#pz', { state: 'hidden' }); await page.waitForTimeout(700); };
  await openZone(false);
  check(await page.evaluate((sel) => !document.querySelector(sel), cfg.famToggle), `${tag}: the switch is not outside the Options tab / behind the PIN`);
  await page.click(`.pz-tabs [data-tab="${cfg.optionsTab || 'options'}"]`);
  await page.waitForSelector(cfg.famToggle);
  check(await page.evaluate((sel) => document.querySelector(sel).getAttribute('aria-checked') === 'true', cfg.famToggle), `${tag}: "Background music in all games" is On by default`);
  check(await page.evaluate((sel) => { const t = document.querySelector(sel).parentElement.textContent; return /Turns off the music in every game on every device in the family\. Sound effects and the voice stay on\./.test(t) && /Background music in all games/.test(t); }, cfg.famToggle), `${tag}: label and the one-line help are shown`);
  if (cfg.shot) { await page.locator(cfg.famToggle).scrollIntoViewIfNeeded(); await page.screenshot({ path: cfg.shot }); }
  await click(cfg.famToggle);                                    // Off
  await page.waitForTimeout(300);
  const fam = await page.evaluate(() => JSON.parse(localStorage.getItem('spellJump.family')));
  check(fam.musicOff === true && fam.musicOffAt > 0, `${tag}: stored in the family record (musicOff + musicOffAt)`);
  const s1 = await S(page);
  check(s1.playing === false && s1.locked === true, `${tag}: Off: the music is stopped at once and locked`);
  if (cfg.pauseBtn) {
    const b = await btn();
    check(b && b.text === 'Music: Off' && b.disabled && b.note === 'Music is off (set by a grown-up)', `${tag}: the child's Music button: "${b && b.text}", disabled=${b && b.disabled}, note="${b && b.note}"`);
  }
  const o1 = await page.evaluate(() => window.__oscCount);
  await effect(page);
  check((await page.evaluate(() => window.__oscCount)) > o1 && (await S(page)).playing === false, `${tag}: sound effects still play while the music stays off`);
  if (!cfg.state) {
    await page.evaluate(async (m) => { const { Audio } = await import(m); Audio.music(true); Audio.unlock(); }, cfg.audio);
    check((await S(page)).playing === false, `${tag}: nothing can start it (Audio.music(true) + unlock)`);
  }
  if (cfg.closeParent) {
    await closeZone();
    check((await S(page)).playing === false, `${tag}: Off: with the Parent Zone closed the music still does not play`);
    await openZone(true);
  }
  await click(cfg.famToggle);                                    // On again: the child's own preference (on) applies
  await page.waitForTimeout(500);
  if (cfg.closeParent) { await closeZone(); }
  if (cfg.hasMusic !== false) { if (!cfg.state) await waitPlaying(true); check((await S(page)).playing === true, `${tag}: On again: the child's own Music (on) plays again`); }
  if (cfg.closeParent) await openZone(true);
  if (cfg.pauseBtn) { const b = await btn(); check(b && b.text === 'Music: On' && !b.disabled && b.note === null, `${tag}: On again: the button and the note are back to normal (${b && b.text})`); }
  if (cfg.childToggle) {
    await click(cfg.childToggle); await page.waitForTimeout(200);          // the child's own Music off
    check((await S(page)).playing === false, `${tag}: the child's own Music Off stops it`);
    await click(cfg.famToggle); await page.waitForTimeout(250); await click(cfg.famToggle); await page.waitForTimeout(400);
    if (cfg.closeParent) await closeZone();
    check((await S(page)).playing === false, `${tag}: family Off then On: the child's own Off still applies (not restarted)`);
    if (cfg.closeParent) await openZone(true);
    await click(cfg.childToggle); await page.waitForTimeout(300);
    if (cfg.closeParent) { await closeZone(); check((await S(page)).playing === true, `${tag}: the child's own Music back On: it plays again`); await openZone(true); }
  }
  // a change arriving by sync / another tab
  await page.evaluate(() => { const f = JSON.parse(localStorage.getItem('spellJump.family')); f.musicOff = true; f.musicOffAt = Date.now() + 100000; localStorage.setItem('spellJump.family', JSON.stringify(f)); window.dispatchEvent(new StorageEvent('storage', { key: 'spellJump.family' })); });
  await page.waitForTimeout(300);
  const s2 = await S(page);
  check(s2.playing === false && s2.locked === true, `${tag}: a family change arriving from elsewhere stops playing music at once`);
  await page.reload({ waitUntil: 'networkidle' });
  await cfg.pick(page);
  await page.waitForTimeout(800);
  const s3 = await S(page);
  check(s3.playing === false && s3.locked === true, `${tag}: a fresh load with the switch Off: the music never starts`);
  check(errors.length === 0, `${tag}: no page errors${errors.length ? ' - ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

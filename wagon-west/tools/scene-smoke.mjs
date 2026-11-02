// Wagon West scene smoke test (SPEC §11): drives wagon-west/dev.html in headless Chromium (iPhone-landscape viewport).
// Usage (from anywhere): node wagon-west/tools/scene-smoke.mjs
// Serves the REPO ROOT itself (python3 -m http.server on BASE_URL's port, default 8094) if nothing answers there.
// Env: BASE_URL (default http://localhost:8094), SHOTS_DIR (screenshot folder), SKIP_PERF=1, PERF_MS (hard limit,
// default 8: the SPEC budget of game code per frame at 4x CPU throttle).
// Most checks pause the scene and step it deterministically with scene.debugStep(n) (60 Hz sim frames), so
// positions are exact when a scripted tap lands; the perf check runs real frames.
// Checks: the API shape and 'ready'; every biome x backdrop renders without console errors (screenshots, not blank);
// the landmark paintings by leg id and the stop rising on the horizon; setTravel rolls the wagon (brisk > steady,
// stopping stops); each weather changes the picture; the party (all 8 hats, oxen and mules); every critter crosses
// and emits animalSpotted; celebrations; a hunt run to huntEnd with scripted taps (hits, a miss, a Space shot) and a
// fishing run to fishEnd (an early tap is free, a missed dip uses the cast, Space hooks); endMiniGame; input ignored
// outside mini-games; reducedMotion thins the weather and drops lightning; resize to portrait; pause / play /
// destroy; perf at 4x CPU throttle (a stormy trail with a herd and confetti, and a hunt).
// v1.1: Fort Derby (a seeded race won with four power-1 bursts and lost with one, the markers hold both wagons, the
// derbyEnd fields, the celebration and the way back to the backdrop, endDerby early, the 3-4 good / 1-2 rule over
// several seeds, dev.html's ?derby=1 with keys 1 / 2 / 0) and the dog (each coat in each outdoor backdrop and not in
// the post office, dogBark, a bark when an animal is spotted, dev.html's ?dog= and key b); perf with the dog and in
// the derby.
// v1.2: the ford (4 / 6 pushes on the calm beat of a 1.4 s swell: all calm = dry, swells = 1 soaked sack, never more; the
// 0.5 s rest; the timing; touch and Space), the float (6 / 9 s runs; unsteered = bumps, steered along the calm lane = 0 on
// 12 seeds; arrow keys and a real drag steer; the bump, the landing and its cheer), the Columbia raft (four markers that
// wait for raftGo, raftEnd { bumps, bends }, eddies spin the raft, the bend marker / calm lane / valley vista pictures),
// the buffalo stampede (3 good = held, 0 = not held, 2 / 1, the BRAKE sign by touch, Space, B and ←, an early tap is
// free, dust and shaking, reduced motion), endMiniGame on each, dev.html's ?ford=1 ?float=1 ?raft=1 ?stampede=1 and keys
// f / l / r / s; perf for the stampede, the raft, the float and the ford.
// v1.4 (Frodo and the river), section 12: the dog's vignettes (dogRun off-screen and back on alternating sides, dogWarn with its two
// barks and the halted wagon, the rabbit chase called early / late / never, the mud overlay), every ambient trail-fact scene (the
// grizzly stays in the far ridge band: feet above 45 % of the height and under 7 % tall in every frame; the 'crack' draws only trees
// and birds), fetch (three drags of different lengths, fetchBring, Space to wind up, a tiny pull is no throw), the grasshoppers, the
// skipping stones (on-beat taps, off-beat taps, a bonus, a late tap), the falling stars, the dust devil (all hats / none), fishing
// 2.0 (hooked and landed by releasing on the red with the yellow shiver first, held through the red → 'off' → fishingRetry once, a
// missed dip, junk, the sturgeon's second tap and fishingHelp(), the dog's two cameos, the sfx cue events), keyboard fishing, reduced
// motion and portrait for each, and the MOCK scene's scripts (hunt, chase, fetch, hoppers, stones, meteors, hats, fishing) producing the
// same event sequences. The hunt (section 4) now covers the 0.5-0.8 s arrow flight, a lead hit, a still hit, a lead miss and the mix.
// v1.5 (The Long Trail), section 13: the five new biomes and the new backdrops in landscape, portrait and wide; the 26 new paintings (and every leg id of every plan
// resolving to one); Sutter's Fort in adobe and the Sacramento claim; the dry stretch (haze, dust, the barrel, the basin's river rebuilt), the 16 decorations and the pack
// mules; the gold pan (scoop, swirl by circling or by the beat, tip, panSwirled, panReveal, pan, panEnd; a poor swirl still ends with a flake), the rocker, Laurel Hill
// (smooth, bumpy, early, Space), the voyage (markers that wait for sailGo, steered 0 bumps, left alone bumps), endMiniGame on each; the homestead at both sites with no
// pieces, half and all of them, the raising of a barn and a small piece (both orders of setHomestead and buildPiece), taps and drags; the three forks' signposts; the MOCK
// scene's scripts; perf cases for each. Env: V15_ONLY=1 runs only section 13 and the perf cases.
// v1.6 (The Lab), section 14: the seven wagon covers and seven leader outfits of src/scene/looks16.js (each accepted by setParty({ wagon: { cover } }) and a companion's `outfit`, drawn on the
// wagon's canvas / the first companion only, clipped to the bonnet, different from the plain one and from each other; null and an unknown id draw the game's own look), Trail Cheer (scene.cheer():
// the party cheers about 1.2 s, confetti, never louder than an arrival), the Lab's previews (labLooks.js LOOKS_READY lists the 14 ids; paintPreview draws each, nothing else), the results' stop card
// (backdrops.js drawStopCard paints every leg of every plan), the MOCK scene's cover, outfit and cheer. Env: V16_ONLY=1 runs only section 14.
// Env: V14_ONLY=1 runs only section 12 and the perf cases, PERF_ONLY=1 only the perf section, PERF_FILTER='stones|stars' picks perf cases.
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BASE_URL || 'http://localhost:8094';
const SHOTS = process.env.SHOTS_DIR || '/tmp/claude-0/-home-user-Extra/0887b907-788e-5c4e-a0e5-9e998f29e90b/scratchpad/ww-scene-shots';
mkdirSync(SHOTS, { recursive: true });

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const roots = ['/home/node-tools/node_modules/'];
  try { roots.push(execSync('npm root -g').toString().trim() + '/'); } catch {}
  for (const r of roots) {
    try { return createRequire(r)('playwright'); } catch {}
  }
  throw new Error('playwright not found (tried local import, /home/node-tools, npm root -g)');
}
const { chromium } = await loadPlaywright();

let server = null;
const DEV = '/wagon-west/dev.html';
async function ensureServer() {
  try { const res = await fetch(BASE + DEV); if (res.ok) return; } catch {}
  const port = new URL(BASE).port || '80';
  server = spawn('python3', ['-m', 'http.server', port], { cwd: REPO, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try { const res = await fetch(BASE + DEV); if (res.ok) return; } catch {}
  }
  throw new Error('could not start http server');
}

const failures = [];
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures.push(msg); };
const BIOMES = ['prairie', 'bluffs', 'highdesert', 'mountains', 'gorge', 'valley'];
const BACKDROPS = ['trail', 'fort', 'river', 'landmark', 'camp', 'post', 'valley'];
const WEATHERS = ['clear', 'rain', 'storm', 'dusk', 'snow'];
const HATS = ['cap', 'wide', 'bonnet', 'straw', 'bowler', 'hood', 'kerchief', 'none'];
const API = ['setLeg', 'setParty', 'setTravel', 'setBackdrop', 'spotAnimal', 'celebrate', 'startHunt', 'startFish', 'endMiniGame', 'play', 'pause', 'destroy', 'resize', 'getState'];
const MEAT = { rabbit: 10, deer: 40, turkey: 15 };
const API_11 = ['startDerby', 'derbyBurst', 'endDerby', 'dogBark'];
const API_12 = ['startFord', 'startFloat', 'startRaft', 'raftGo', 'startStampede'];
const COATS = ['brown', 'spotted', 'black'];
const DOG_BACKDROPS = ['trail', 'camp', 'river', 'landmark', 'fort', 'valley', 'post'];

async function open(browser, params = {}, viewport = { width: 844, height: 390 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  // the Google font request may fail offline; that is not a scene error
  page.on('requestfailed', () => {});
  const q = new URLSearchParams({ ui: '0', auto: '0', ...params }).toString();
  await page.goto(`${BASE}${DEV}?${q}`);
  await page.waitForFunction(() => window.__ww && window.__ww.events.some((e) => e.type === 'ready'), null, { timeout: 8000 });
  return { page, context, errors: { list: errors, real: () => errors.filter((e) => !/fonts\.(googleapis|gstatic)|ERR_|net::/.test(e)) } };
}
const step = (page, n, draw = true) => page.evaluate(([n, d]) => window.__ww.scene.debugStep(n, d), [n, draw]);
const info = (page) => page.evaluate(() => window.__ww.scene.debugInfo());
const state = (page) => page.evaluate(() => window.__ww.scene.getState());
const events = (page, type) => page.evaluate((t) => window.__ww.events.filter((e) => e.type === t), type);
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
// distinct colours in a 48x24 downsample of the canvas (a blank or broken frame has a handful)
const variety = (page) => page.evaluate(() => {
  const src = document.getElementById('c'), c = document.createElement('canvas'); c.width = 48; c.height = 24;
  const g = c.getContext('2d'); g.drawImage(src, 0, 0, 48, 24);
  const d = g.getImageData(0, 0, 48, 24).data, set = new Set();
  for (let i = 0; i < d.length; i += 4) set.add((d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3));
  return set.size;
});
// mean luminance of the top 40 % of the canvas (the sky)
const skyLum = (page) => page.evaluate(() => {
  const src = document.getElementById('c'), c = document.createElement('canvas'); c.width = 32; c.height = 10;
  c.getContext('2d').drawImage(src, 0, 0, src.width, src.height * 0.4, 0, 0, 32, 10);
  const d = c.getContext('2d').getImageData(0, 0, 32, 10).data; let s = 0;
  for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return s / (d.length / 4);
});
// a tap delivered while the scene runs (input is ignored while paused), then paused again
async function tapAt(page, x, y) {
  await page.evaluate(() => window.__ww.scene.play());
  await page.touchscreen.tap(x, y);
  await page.evaluate(() => window.__ww.scene.pause());
}
async function keySpace(page) {
  await page.evaluate(() => window.__ww.scene.play());
  await page.keyboard.press('Space');
  await page.evaluate(() => window.__ww.scene.pause());
}

await ensureServer();
const browser = await chromium.launch();
try {
  if (!process.env.V14_ONLY && !process.env.PERF_ONLY && !process.env.V15_ONLY && !process.env.V16_ONLY) { // V14_ONLY=1 runs only section 12 (the v1.4 scenes), PERF_ONLY=1 only the perf section
  // ---- 1. API, ready, state shape ----
  {
    const { page, context, errors } = await open(browser);
    const api = await page.evaluate((names) => names.filter((n) => typeof window.__ww.scene[n] !== 'function'), API);
    check(api.length === 0, `the scene has the whole §11 API (missing: ${api.join(',') || 'none'})`);
    const api11 = await page.evaluate((names) => names.filter((n) => typeof window.__ww.scene[n] !== 'function'), API_11);
    check(api11.length === 0, `the scene has the v1.1 API: ${API_11.join(', ')} (missing: ${api11.join(',') || 'none'})`);
    const s = await state(page);
    check(['backdrop', 'milesDone', 'weather', 'moving', 'mini'].every((k) => k in s) && s.mini === null && s.backdrop === 'trail', `getState() has the contract keys (${Object.keys(s).join(',')})`);
    const ready = await events(page, 'ready');
    check(ready.length === 1, `'ready' fired once (${ready.length})`);
    const i = await info(page);
    check(i.canvasW === 844 * 2 && i.canvasH === 390 * 2, `DPR-aware backing store (${i.canvasW}x${i.canvasH} for 844x390 @2x)`);
    check(errors.real().length === 0, `boot: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }

  // ---- 2. every biome x backdrop ----
  {
    const { page, context, errors } = await open(browser, { moving: '0' });
    await page.evaluate(() => window.__ww.scene.pause());
    let minVar = 1e9, worst = '';
    for (const biome of BIOMES) {
      for (const bd of BACKDROPS) {
        await page.evaluate(([biome, bd]) => {
          const sc = window.__ww.scene;
          sc.setLeg({ id: 'chimney-rock', biome, miles: 160, stop: { kind: 'landmark' } });
          sc.setBackdrop(bd);
        }, [biome, bd]);
        await step(page, 40);
        const v = await variety(page);
        if (v < minVar) { minVar = v; worst = `${biome}/${bd}`; }
        const s = await state(page);
        if (s.backdrop !== bd || s.biome !== biome) check(false, `${biome}/${bd}: state says ${s.biome}/${s.backdrop}`);
        await shot(page, `bd-${biome}-${bd}`);
      }
    }
    check(minVar >= 12, `all 42 biome x backdrop frames are drawn, not blank (fewest colours ${minVar} at ${worst})`);
    check(errors.real().length === 0, `biomes x backdrops: no console errors (${errors.real().join(' | ')})`);
    // the landmark paintings by leg id
    const cases = { 'chimney-rock': 'chimney', 'independence-rock': 'independence', 'south-pass': 'southpass', 'soda-springs': 'soda', 'blue-mountains': 'bluemtns', 'the-dalles': 'gorge', 'fort-laramie': 'fort', 'snake-river': 'river', 'willamette-valley': 'homestead', 'no-such-place': 'generic' };
    const got = {};
    await page.evaluate(() => window.__ww.scene.setBackdrop('landmark'));
    for (const [id, want] of Object.entries(cases)) {
      await page.evaluate((id) => window.__ww.scene.setLeg({ id, biome: 'bluffs', miles: 160, stop: { kind: 'landmark' } }), id);
      await step(page, 30);
      got[id] = (await info(page)).painting;
      await shot(page, `landmark-${id}`);
    }
    const bad = Object.entries(cases).filter(([id, want]) => got[id] !== want);
    check(bad.length === 0, `the leg id picks the landmark painting (${bad.map(([id, w]) => `${id}: ${got[id]} != ${w}`).join(', ') || Object.values(got).join(', ')})`);
    // the stop rises on the horizon in the last miles of a leg
    await page.evaluate(() => { const sc = window.__ww.scene; sc.setBackdrop('trail'); sc.setLeg({ id: 'chimney-rock', biome: 'bluffs', miles: 160, stop: { kind: 'landmark' } }); sc.setTravel({ milesDone: 100 }); });
    await step(page, 5);
    const far = await info(page);
    await page.evaluate(() => window.__ww.scene.setTravel({ milesDone: 155 }));
    await step(page, 30);
    const near = await info(page);
    await shot(page, 'approach-chimney-rock');
    check(far.approach === 0 && near.approach > 0.8 && near.approachPainting === 'chimney', `Chimney Rock rises on the horizon near the leg's end (approach ${far.approach} at 100 mi, ${near.approach.toFixed(2)} at 155 mi, ${near.approachPainting})`);
    check(errors.real().length === 0, `paintings: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }

  // ---- 3. travel, weather, party, critters, celebrations ----
  {
    const { page, context, errors } = await open(browser, { moving: '0', biome: 'prairie' });
    await page.evaluate(() => window.__ww.scene.pause());
    await step(page, 60);
    const s0 = await state(page);
    await page.evaluate(() => window.__ww.scene.setTravel({ moving: true, pace: 'steady', milesDone: 30 }));
    await step(page, 180);
    const s1 = await state(page), i1 = await info(page);
    await shot(page, 'travel-steady');
    check(s1.moving && s1.scroll > s0.scroll + 100 && s1.milesDone === 30, `setTravel({ moving: true }) rolls the wagon (scroll ${s0.scroll} -> ${s1.scroll} px in 3 s)`);
    await page.evaluate(() => window.__ww.scene.setTravel({ pace: 'brisk' }));
    await step(page, 180);
    const i2 = await info(page);
    check(i2.speed > i1.speed * 1.2 && i2.wagonX > i1.wagonX + 5, `brisk is faster than steady and the wagon pulls ahead (${i1.speed.toFixed(0)} -> ${i2.speed.toFixed(0)} px/s, x ${i1.wagonX.toFixed(0)} -> ${i2.wagonX.toFixed(0)})`);
    await page.evaluate(() => window.__ww.scene.setTravel({ moving: false }));
    await step(page, 240);
    const s3 = await state(page);
    await step(page, 60);
    const s4 = await state(page);
    check(!s4.moving && s4.scroll === s3.scroll, `moving: false brings the wagon to a stop (scroll holds at ${s4.scroll})`);
    // weather
    const lum = {};
    for (const w of WEATHERS) {
      await page.evaluate((w) => window.__ww.scene.setTravel({ weather: w, moving: true }), w);
      await step(page, 150);
      const s = await state(page), i = await info(page);
      lum[w] = await skyLum(page);
      if (s.weather !== w || i.wxCur !== w || i.wxMix < 1) check(false, `weather ${w}: state ${s.weather}, visual ${i.wxCur} mix ${i.wxMix}`);
      if (w === 'rain' || w === 'storm') check(i.particles.rain > 50, `${w}: rain falls (${i.particles.rain} drops drawn)`);
      if (w === 'snow') check(i.particles.snow > 50, `snow: flakes fall (${i.particles.snow} drawn)`);
      if (w === 'clear') check(i.particles.rain === 0 && i.particles.snow === 0, 'clear: no rain or snow');
      await shot(page, `weather-${w}`);
    }
    check(lum.storm < lum.clear - 40 && lum.dusk < lum.clear - 20 && lum.rain < lum.clear, `the weather changes the sky (luminance ${Object.entries(lum).map(([w, l]) => w + ' ' + l.toFixed(0)).join(', ')})`);
    await page.evaluate(() => window.__ww.scene.setTravel({ weather: 'storm' }));
    await step(page, 60 * 12);
    const flashes = (await info(page)).flashes;
    check(flashes > 0, `a storm has lightning (${flashes} flashes in 12 s)`);
    await page.evaluate(() => window.__ww.scene.setTravel({ weather: 'clear' }));
    // the party: every hat, oxen and mules, the name on the cover
    for (let g = 0; g < 3; g++) {
      const hats = HATS.slice(g * 3, g * 3 + 3);
      while (hats.length < 3) hats.push('none');
      await page.evaluate(([hats, g]) => window.__ww.scene.setParty({ animal: g === 1 ? 'mules' : 'oxen', companions: hats.map((h, i) => ({ id: 'c' + g + i, hat: h, color: ['#d9534f', '#5b8c5a', '#7d5ba6'][i] })), wagon: { paint: ['blue', 'red', '#2f9c95'][g], flag: g === 2 ? null : 'gold', name: 'Hat Parade ' + (g + 1) } }), [hats, g]);
      await step(page, 20);
      const i = await info(page);
      check(i.party.join() === hats.join() && i.animal === (g === 1 ? 'mules' : 'oxen') && i.wagonName === 'HAT PARADE ' + (g + 1), `setParty: hats ${i.party.join(', ')}, ${i.animal}, "${i.wagonName}"`);
      await shot(page, `party-${g + 1}-${hats.join('-')}`);
    }
    // critters
    for (const a of ['bison', 'pronghorn', 'coyote', 'eagle']) {
      await page.evaluate((a) => window.__ww.scene.spotAnimal(a), a);
      let seen = false, n = 0;
      for (; n < 40 && !seen; n++) {
        await step(page, 30, n === 6);
        if (n === 6) await shot(page, `critter-${a}`);
        seen = (await events(page, 'animalSpotted')).some((e) => e.animal === a);
      }
      check(seen, `spotAnimal('${a}') crosses and emits animalSpotted (${(n * 0.5).toFixed(1)} s)`);
    }
    for (const c of ['arrived', 'river', 'star']) {
      await page.evaluate((c) => window.__ww.scene.celebrate(c), c);
      await step(page, 30);
      const i = await info(page);
      check(i.particles.conf > 10, `celebrate('${c}') bursts (${i.particles.conf} pieces)`);
      await shot(page, `celebrate-${c}`);
      await step(page, 200, false);
    }
    // input is ignored outside a mini-game
    const before = (await page.evaluate(() => window.__ww.events.length));
    await tapAt(page, 400, 300);
    await keySpace(page);
    check((await page.evaluate(() => window.__ww.events.length)) === before, 'taps and Space do nothing outside a mini-game');
    check(errors.real().length === 0, `travel / weather / party / critters: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }

  // ---- 4. the hunt (v1.4: arrows fly, runners need a lead, still animals do not), run to huntEnd with scripted taps ----
  {
    const { page, context, errors } = await open(browser, { biome: 'prairie', moving: '0' });
    await page.evaluate(() => { window.__ww.scene.pause(); window.__ww.scene.startHunt({ seed: 7, shots: 5 }); });
    await step(page, 2);
    const s0 = await state(page);
    check(s0.mini && s0.mini.kind === 'hunt' && s0.mini.left === 5 && s0.mini.hits === 0, `startHunt: mini ${JSON.stringify(s0.mini)}`);
    await shot(page, 'hunt-0-start');
    const dbg = () => page.evaluate(() => window.__ww.scene.debugMini());
    const flightOf = (x, y) => page.evaluate(async ([x, y]) => { const m = await import('/wagon-west/src/scene/hunt.js'); const i = window.__ww.scene.debugInfo(); return m.flightTime({ W: i.W, H: i.H, k: i.k }, x, y); }, [x, y]);
    // wait (stepping the sim) for an animal matching `pick`; returns it
    async function waitFor(pick, max = 900) {
      for (let n = 0; n < max; n++) {
        await step(page, 1, false);
        const m = await dbg();
        const a = m.animals.filter((q) => q.state === 'alive' && q.x > 80 && q.x < 764).map((q) => q).find(pick);
        if (a) return a;
      }
      return null;
    }
    const plan = ['lead', 'still', 'lead-miss', 'key', 'miss'];
    let wantHits = 0, wantMeat = 0, wantLead = 0;
    const MEATS = { ...MEAT, pronghorn: 12, bison: 24 };
    let flightSeen = null;
    for (const [i, how] of plan.entries()) {
      if (how === 'miss') {
        await tapAt(page, 30, 380);
      } else if (how === 'still') {
        const t = await waitFor((q) => !q.moving && q.r > 12);
        if (!t) { check(false, `hunt shot ${i + 1}: no still animal came by`); continue; }
        await tapAt(page, t.x, t.y);
        wantHits++; wantMeat += MEATS[t.kind];
      } else if (how === 'lead' || how === 'lead-miss') {
        const t = await waitFor((q) => q.running && q.x > 150 && q.x < 700 && q.aim.x > 40 && q.aim.x < 804 && q.r > 12);
        if (!t) { check(false, `hunt shot ${i + 1}: no running animal came by`); continue; }
        check(Math.abs(t.aim.x - t.x) > t.r * 0.4, `a runner needs a lead: its intercept is ${Math.round(Math.abs(t.aim.x - t.x))} px ahead of it (r ${Math.round(t.r)})`);
        if (how === 'lead') {
          await tapAt(page, t.aim.x, t.aim.y); wantHits++; wantMeat += MEATS[t.kind]; wantLead++;
          if (i === 0) { flightSeen = t.flight; await step(page, Math.round(t.flight * 60 * 0.55), true); await shot(page, 'hunt-1-lead-shot'); await step(page, Math.round(t.flight * 60 * 0.45) + 1, true); }
        } else await tapAt(page, t.x, t.y); // straight at the runner: the arrow comes down behind it
      } else if (how === 'key') {
        const fk = await flightOf(422, 390 * 0.78);
        const t = await waitFor((q) => q.running && Math.abs(q.x + q.vx * fk - 422) < 8, 1500);
        if (!t) { check(false, `hunt shot ${i + 1}: no runner reached the aim line`); continue; }
        await keySpace(page); wantHits++; wantMeat += MEATS[t.kind]; wantLead++;
      }
      await step(page, 22);
      if (i === 1) await shot(page, 'hunt-2-still-shot');
      await step(page, 50);
      const ev = await events(page, 'hunt');
      const last = ev[ev.length - 1];
      const wantHit = how !== 'miss' && how !== 'lead-miss';
      const ok = ev.length === i + 1 && last.hit === wantHit
        && (wantHit ? MEATS[last.animal] === last.meatLb && last.lead === (how === 'lead' || how === 'key') : last.animal === null && last.meatLb === 0 && last.lead === false);
      check(ok, `hunt shot ${i + 1} (${how}): ${JSON.stringify(last)}`);
    }
    check(flightSeen != null && flightSeen >= 0.5 - 1e-6 && flightSeen <= 0.8 + 1e-6, `the arrow's flight time is 0.5-0.8 s (${flightSeen && flightSeen.toFixed(2)} s for the lead shot)`);
    const sMid = await state(page);
    check(sMid.mini && sMid.mini.left === 0, `the quiver is empty after 5 shots (${JSON.stringify(sMid.mini)})`);
    let end = [];
    for (let n = 0; n < 20 && !end.length; n++) { await step(page, 15, false); end = await events(page, 'huntEnd'); }
    check(end.length === 1 && end[0].hits === wantHits && end[0].shots === 5 && end[0].meatLb === wantMeat, `huntEnd ${JSON.stringify(end[0])} (want ${wantHits} hits, ${wantMeat} lb, 5 shots)`);
    const leadHits = (await events(page, 'hunt')).filter((e) => e.hit && e.lead).length;
    check(leadHits === wantLead && wantLead >= 1, `${leadHits} of the hits report lead: true (want ${wantLead})`);
    await step(page, 30);
    const s1 = await state(page);
    check(s1.mini === null && s1.view === 'trail', `after huntEnd the scene returns to the trail (view ${s1.view}, mini ${JSON.stringify(s1.mini)})`);
    await shot(page, 'hunt-3-after');
    // the mix by animal over many seeded hunts: rabbits / pronghorn mostly run, deer about half, bison mostly stand about
    const mix = await page.evaluate(() => {
      const sc = window.__ww.scene, out = {};
      for (let seed = 1; seed <= 40; seed++) {
        sc.startHunt({ seed, shots: 20 });
        const seen = new Set();
        for (let f = 0; f < 60 * 25; f++) {
          sc.debugStep(1, false);
          const m = sc.debugMini();
          if (!m) break;
          for (const a of m.animals) {
            const key = seed + ':' + a.id;
            if (seen.has(key)) continue;
            seen.add(key);
            const o = out[a.kind] || (out[a.kind] = { run: 0, still: 0 });
            if (a.cross) o.run++; else o.still++;
          }
        }
        sc.endMiniGame();
      }
      return out;
    });
    const share = (k) => (mix[k] ? mix[k].run / Math.max(1, mix[k].run + mix[k].still) : null);
    check(share('rabbit') > 0.5 && share('pronghorn') > 0.5 && share('bison') < 0.5 && share('deer') > 0.2 && share('deer') < 0.9, `the mix: rabbit ${share('rabbit') && share('rabbit').toFixed(2)}, pronghorn ${share('pronghorn') && share('pronghorn').toFixed(2)}, deer ${share('deer') && share('deer').toFixed(2)}, bison ${share('bison') && share('bison').toFixed(2)} of the animals seen run`);
    // endMiniGame: leaving early returns the summary and emits nothing
    await page.evaluate(() => window.__ww.scene.startHunt({ seed: 9, shots: 5 }));
    await step(page, 60);
    const sum = await page.evaluate(() => window.__ww.scene.endMiniGame());
    await step(page, 200, false);
    const s2 = await state(page);
    check(sum && sum.shots === 0 && sum.meatLb === 0 && s2.mini === null && (await events(page, 'huntEnd')).length === 1, `endMiniGame() leaves at once with ${JSON.stringify(sum)} and no huntEnd`);
    check((await page.evaluate(() => window.__ww.scene.endMiniGame())) === null, 'endMiniGame() with nothing running returns null');
    check(errors.real().length === 0, `hunt: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }

  // ---- 5. fishing, run to fishEnd ----
  {
    const { page, context, errors } = await open(browser, { biome: 'mountains', moving: '0' });
    await page.evaluate(() => { window.__ww.scene.pause(); window.__ww.scene.startFish({ seed: 3, casts: 4 }); });
    await step(page, 2);
    await shot(page, 'fish-0-cast');
    const until = async (phase, max = 600) => { for (let n = 0; n < max; n++) { const m = await page.evaluate(() => window.__ww.scene.debugMini()); if (m && m.phase === phase) return m; await step(page, 1, false); } return null; };
    // cast 1: an early tap is free, then a tap in the dip hooks one
    const w1 = await until('wait');
    await tapAt(page, 500, 200);
    await step(page, 2);
    const afterEarly = await page.evaluate(() => window.__ww.scene.debugMini());
    check(w1 && afterEarly.left === 4 && afterEarly.phase === 'wait' && (await events(page, 'fish')).length === 0, `a tap before the dip is free (left ${afterEarly.left}, phase ${afterEarly.phase})`);
    await shot(page, 'fish-1-early');
    let want = 0;
    const b1 = await until('bite');
    await step(page, 6);
    await shot(page, 'fish-2-bite');
    await tapAt(page, 500, 200);
    await step(page, 80);
    want += b1.lb;
    let fe = await events(page, 'fish');
    check(fe.length === 1 && fe[0].lb === b1.lb && fe[0].lb >= 2 && fe[0].lb <= 6 && ['small', 'medium', 'big'].includes(fe[0].size), `cast 1: a tap in the dip lands a fish ${JSON.stringify(fe[0])}`);
    // cast 2: Space hooks
    const b2 = await until('bite');
    await keySpace(page);
    await step(page, 20);
    await shot(page, 'fish-3-reel');
    await step(page, 60);
    want += b2.lb;
    fe = await events(page, 'fish');
    check(fe.length === 2 && fe[1].lb === b2.lb, `cast 2: Space hooks one too ${JSON.stringify(fe[1])}`);
    // cast 3: the dip passes untouched: "It got away!", the cast is used, no fish event
    await until('bite');
    const away = await until('away', 200);
    await step(page, 70);
    const m3 = await page.evaluate(() => window.__ww.scene.debugMini());
    check(away && m3.left === 1 && (await events(page, 'fish')).length === 2, `cast 3: a missed dip uses the cast (left ${m3.left})`);
    // cast 4
    const b4 = await until('bite');
    await tapAt(page, 300, 300);
    want += b4.lb;
    let end = [];
    for (let n = 0; n < 20 && !end.length; n++) { await step(page, 15, false); end = await events(page, 'fishEnd'); }
    check(end.length === 1 && end[0].fishLb === want && end[0].caught === 3 && end[0].casts === 4, `fishEnd ${JSON.stringify(end[0])} (want ${want} lb, 3 caught)`);
    await step(page, 30);
    const s = await state(page);
    check(s.mini === null && s.view === 'trail', `after fishEnd the scene returns (view ${s.view})`);
    check(errors.real().length === 0, `fishing: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }

  // ---- 6. reduced motion ----
  {
    const full = await open(browser, { weather: 'storm', biome: 'mountains' });
    const rmp = await open(browser, { weather: 'storm', biome: 'mountains', rm: '1' });
    for (const p of [full, rmp]) { await p.page.evaluate(() => window.__ww.scene.pause()); await step(p.page, 60 * 12); }
    const a = await info(full.page), b = await info(rmp.page);
    const sb = await state(rmp.page);
    await shot(rmp.page, 'reduced-motion-storm');
    check(sb.reducedMotion && b.particles.rain <= a.particles.rain * 0.5 && b.flashes === 0 && a.flashes > 0, `reducedMotion thins the rain (${a.particles.rain} -> ${b.particles.rain} drops) and drops lightning (${a.flashes} -> ${b.flashes} flashes)`);
    await rmp.page.evaluate(() => window.__ww.scene.setReducedMotion(false));
    check((await state(rmp.page)).reducedMotion === false, 'setReducedMotion(false) switches it off live');
    check(full.errors.real().length + rmp.errors.real().length === 0, 'reduced motion: no console errors');
    await full.context.close(); await rmp.context.close();
  }

  // ---- 7. resize, pause / play / destroy ----
  {
    const { page, context, errors } = await open(browser, { biome: 'valley' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const i = await info(page);
    check(i.W === 390 && i.H === 844 && i.canvasW === 780 && i.canvasH === 1688, `the canvas follows its parent to portrait (${i.W}x${i.H}, backing ${i.canvasW}x${i.canvasH})`);
    await shot(page, 'resize-portrait');
    await page.evaluate(() => window.__ww.scene.setBackdrop('fort'));
    await page.waitForTimeout(600);
    await shot(page, 'resize-portrait-fort');
    await page.evaluate(() => window.__ww.scene.startHunt({ seed: 4 }));
    await page.waitForTimeout(1500);
    await shot(page, 'resize-portrait-hunt');
    await page.evaluate(() => window.__ww.scene.endMiniGame());
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(400);
    await shot(page, 'resize-ipad-fort');
    await page.evaluate(() => window.__ww.scene.debugPerf(true));
    await page.waitForTimeout(300);
    const playing = (await page.evaluate(() => window.__ww.scene.debugPerf(true))).frames;
    await page.evaluate(() => { window.__ww.scene.pause(); window.__ww.scene.debugPerf(true); });
    await page.waitForTimeout(300);
    const paused = (await page.evaluate(() => window.__ww.scene.debugPerf(true))).frames;
    await page.evaluate(() => window.__ww.scene.play());
    await page.waitForTimeout(300);
    const again = (await page.evaluate(() => window.__ww.scene.debugPerf(true))).frames;
    check(playing > 5 && paused === 0 && again > 5, `pause() stops the frames and play() resumes them (${playing} / ${paused} / ${again} frames in 300 ms)`);
    await page.evaluate(() => { window.__ww.scene.destroy(); window.__ww.scene.debugPerf(true); });
    await page.waitForTimeout(300);
    const dead = (await page.evaluate(() => window.__ww.scene.debugPerf(true))).frames;
    await page.evaluate(() => { const sc = window.__ww.scene; sc.play(); sc.setTravel({ weather: 'rain' }); sc.startHunt({}); sc.resize(); });
    await page.waitForTimeout(200);
    check(dead === 0 && (await page.evaluate(() => window.__ww.scene.debugPerf(true))).frames === 0, 'destroy() stops for good (calls after it are harmless)');
    check(errors.real().length === 0, `resize / pause / destroy: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }

  // ---- 9. Fort Derby (v1.1) ----
  {
    const { page, context, errors } = await open(browser, { biome: 'highdesert', backdrop: 'fort', moving: '0', dog: 'brown' });
    await page.evaluate(() => window.__ww.scene.pause());
    await step(page, 30);
    const mini = () => page.evaluate(() => window.__ww.scene.debugMini());
    await page.evaluate(() => window.__ww.scene.startDerby({ seed: 21 }));
    await step(page, 2);
    const s0 = await state(page);
    check(s0.view === 'derby' && s0.backdrop === 'fort' && s0.mini && s0.mini.kind === 'derby' && s0.mini.progress === 0 && s0.mini.mailProgress === 0 && s0.mini.left === 4, `startDerby: a race view (view ${s0.view}, backdrop ${s0.backdrop}), mini ${JSON.stringify(s0.mini)}`);
    check((await page.evaluate(() => window.__ww.scene.derbyBurst(1))) === false, 'derbyBurst before a marker is refused (returns false)');
    check((await page.evaluate(() => document.getElementById('c').style.touchAction)) !== 'none', 'the derby does not take the pointer (no touch-action: none)');
    await shot(page, 'derby-0-start');
    // the start marker: the race holds there until the first answer
    await step(page, 45);
    let mk = await events(page, 'derbyMarker');
    check(mk.length === 1 && mk[0].n === 1 && mk[0].of === 4, `the first derbyMarker comes at the start line ${JSON.stringify(mk[0])}`);
    const h0 = await mini();
    await step(page, 240);
    const h1 = await mini();
    check(h1.phase === 'wait' && h1.child === h0.child && h1.mail === h0.mail && h1.child === 0 && (await events(page, 'derbyMarker')).length === 1, `the race holds at the start until derbyBurst (child ${h1.child} m, mail ${h1.mail} m after 4 s)`);
    const tapsBefore = await page.evaluate(() => window.__ww.events.length);
    await tapAt(page, 400, 300);
    check((await page.evaluate(() => window.__ww.events.length)) === tapsBefore && (await mini()).phase === 'wait', 'a tap on the canvas does nothing in the derby');
    check((await page.evaluate(() => window.__ww.scene.derbyBurst(1))) === true, 'derbyBurst(1) at a marker is taken');
    await step(page, 20);
    await shot(page, 'derby-1-go');
    const r1 = await state(page), i1 = await info(page), m1 = await mini();
    check(r1.mini.phase === 'run' && r1.mini.progress > 0 && r1.mini.mailProgress > 0 && r1.mini.bursts === 1 && m1.boost > 10, `GO: both wagons roll and the burst is on (${JSON.stringify(r1.mini)}, boost ${m1.boost.toFixed(1)} m/s)`);
    check(i1.dog && i1.dog.visible && i1.dog.pose === 'run' && Math.abs(i1.dog.x - m1.nose) < 60, `the dog runs with the wagon (dog x ${Math.round(i1.dog.x)}, wagon nose ${Math.round(m1.nose)})`);
    // the 100 m marker holds both wagons too
    for (let n = 0; n < 200 && (await events(page, 'derbyMarker')).length < 2; n++) await step(page, 5, false);
    await step(page, 1);
    mk = await events(page, 'derbyMarker');
    const w0 = await mini();
    await shot(page, 'derby-2-marker');
    await step(page, 180);
    const w1 = await mini();
    check(mk.length === 2 && mk[1].n === 2 && mk[1].of === 4 && Math.abs(w0.child - 100) < 1e-6 && w1.child === w0.child && w1.mail === w0.mail && w1.phase === 'wait', `the 100 m marker holds both wagons (${JSON.stringify(mk[1])}, child ${w1.child} m, mail ${w1.mail.toFixed(1)} m held for 3 s)`);
    check((await state(page)).mini.left === 2, `left counts the markers still ahead (${(await state(page)).mini.left})`);
    // two more quick answers, then the line
    let ends = [];
    let nb = 1;
    for (let n = 0; n < 2000 && !ends.length; n++) {
      const m = await mini();
      if (m && m.phase === 'wait') { await page.evaluate(() => window.__ww.scene.derbyBurst(1)); nb++; }
      await step(page, 4, false);
      ends = await events(page, 'derbyEnd');
    }
    await step(page, 24);
    await shot(page, 'derby-3-finish');
    const iF = await info(page), sF = await state(page);
    const e = ends[0] || {};
    check(ends.length === 1 && e.won === true && e.markers === 4 && e.bursts === 4 && nb === 4 && Number.isInteger(e.margin) && e.margin > 0, `four quick answers win: derbyEnd ${JSON.stringify(e)}`);
    check(Object.keys(e).filter((k) => k !== 'at').sort().join() === 'bursts,margin,markers,type,won', `derbyEnd carries { won, margin, markers, bursts } (${Object.keys(e).join(', ')})`);
    check(iF.particles.conf > 10 && sF.mini && sF.mini.phase === 'finish' && sF.mini.progress === 1, `the finish: confetti (${iF.particles.conf} pieces) and the wagon over the line (${JSON.stringify(sF.mini)})`);
    await step(page, 60);
    const sMid = await state(page);
    await step(page, 60);
    const sBack = await state(page);
    check(sMid.view === 'derby' && sBack.mini === null && sBack.view === 'stop' && sBack.backdrop === 'fort', `2 s after the line the scene goes back to the fort (at 1.4 s: ${sMid.view}; at 2.4 s: ${sBack.view}/${sBack.backdrop})`);
    await shot(page, 'derby-4-back-at-the-fort');
    // whole races in the page (seeded, the same integration the app gets)
    const race = (seed, powers) => page.evaluate(([seed, powers]) => {
      const sc = window.__ww.scene, ev0 = window.__ww.events.length;
      sc.startDerby({ seed });
      let i = 0, n = 0, endStep = -1;
      for (; n < 60 * 200; n++) {
        const s = sc.debugStep(1, false);
        if (!s.mini || s.mini.kind !== 'derby') break;
        if (endStep < 0 && s.mini.phase === 'finish') endStep = n;
        if (s.mini.phase === 'wait') sc.derbyBurst(powers[i++] ?? 0);
      }
      const evs = window.__ww.events.slice(ev0);
      return { end: evs.find((e) => e.type === 'derbyEnd') || null, markers: evs.filter((e) => e.type === 'derbyMarker').map((e) => e.n + '/' + e.of), linger: n - endStep, closed: !sc.getState().mini };
    }, [seed, powers]);
    const lost = await race(21, [1, 0, 0, 0]);
    check(lost.end && lost.end.won === false && lost.end.bursts === 1 && lost.end.markers === 4 && lost.end.margin > 0 && lost.markers.join() === '1/4,2/4,3/4,4/4', `one quick answer (and three wrong) loses: ${JSON.stringify(lost.end)}, markers ${lost.markers.join(' ')}`);
    check(lost.closed && Math.abs(lost.linger - 120) <= 2, `after a loss the scene goes back after 2 s too (${lost.linger} frames)`);
    const again = await race(21, [1, 0, 0, 0]);
    check(again.end && again.end.margin === lost.end.margin && again.end.won === lost.end.won, `same seed, same answers: the same race (margin ${lost.end && lost.end.margin} m twice)`);
    const table = [];
    let ruleOk = true;
    for (let seed = 1; seed <= 6; seed++) {
      const row = [];
      for (const [p, want] of [[[1, 1, 1, 1], true], [[0, 1, 1, 1], true], [[0.6, 0.6, 0.6, 0.6], true], [[1, 1, 0, 0], false], [[1, 0, 0, 0], false]]) {
        const r = await race(seed * 7, p);
        const ok = r.end && r.end.won === want;
        if (!ok) ruleOk = false;
        row.push((r.end && r.end.won ? 'W' : 'L') + (r.end ? r.end.margin : '?'));
      }
      table.push(`seed ${seed * 7}: ${row.join(' ')}`);
    }
    check(ruleOk, `beatable with 3-4 good bursts (and with 4 slow ones), lost with 1-2, on six seeds [4 quick, 3 quick + wrong, 4 slow, 2 quick, 1 quick]: ${table.join('; ')}`);
    // a wrong answer is a stumble, no burst
    await page.evaluate(() => window.__ww.scene.startDerby({ seed: 5 }));
    await step(page, 45);
    await page.evaluate(() => window.__ww.scene.derbyBurst(0));
    await step(page, 8);
    const st = await mini();
    await shot(page, 'derby-5-stumble');
    check(st.phase === 'run' && st.stumbleT > 0 && st.boost === 0 && st.bursts === 0 && st.child > 0, `derbyBurst(0): a stumble and no burst, the wagon rolls on (stumble ${st.stumbleT.toFixed(2)} s, boost ${st.boost}, ${st.child.toFixed(2)} m)`);
    // endDerby early
    const endsBefore = (await events(page, 'derbyEnd')).length;
    await step(page, 60);
    const sum = await page.evaluate(() => window.__ww.scene.endDerby());
    await step(page, 200, false);
    const sE = await state(page);
    check(sum && sum.kind === 'derby' && sum.progress > 0 && sum.finished === false && sum.bursts === 0 && sE.mini === null && sE.view === 'stop' && sE.backdrop === 'fort' && (await events(page, 'derbyEnd')).length === endsBefore, `endDerby() leaves at once with ${JSON.stringify(sum)} and emits nothing`);
    check((await page.evaluate(() => window.__ww.scene.endDerby())) === null && (await page.evaluate(() => window.__ww.scene.derbyBurst(1))) === false, 'endDerby() / derbyBurst() with no derby running: null / false');
    await page.evaluate(() => window.__ww.scene.startDerby({ seed: 8 }));
    await step(page, 50);
    const sumM = await page.evaluate(() => window.__ww.scene.endMiniGame());
    check(sumM && sumM.kind === 'derby' && (await state(page)).mini === null, 'endMiniGame() ends a derby too');
    // portrait
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__ww.scene.startDerby({ seed: 9 }));
    await step(page, 45);
    await page.evaluate(() => window.__ww.scene.derbyBurst(1));
    await step(page, 60);
    const pv = await variety(page);
    await shot(page, 'derby-6-portrait');
    check(pv >= 12, `the derby draws in portrait too (${pv} colours)`);
    await page.evaluate(() => window.__ww.scene.endDerby());
    check(errors.real().length === 0, `derby: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }
  // dev.html: ?derby=1 and the keys 1 / 2 / 0
  {
    const { page, context, errors } = await open(browser, { derby: '1', dog: 'spotted', seed: '12' });
    await page.waitForFunction(() => window.__ww.events.some((e) => e.type === 'derbyMarker'), null, { timeout: 5000 });
    const b0 = (await state(page)).biome;
    await page.keyboard.press('1');
    await page.waitForTimeout(100);
    const a = await state(page);
    await page.waitForFunction(() => window.__ww.events.filter((e) => e.type === 'derbyMarker').length >= 2, null, { timeout: 15000 });
    await page.keyboard.press('2');
    await page.waitForTimeout(100);
    const b = await state(page);
    await page.waitForFunction(() => window.__ww.events.filter((e) => e.type === 'derbyMarker').length >= 3, null, { timeout: 15000 });
    await page.keyboard.press('0');
    await page.waitForTimeout(100);
    const c = await state(page), m = await page.evaluate(() => window.__ww.scene.debugMini());
    check(a.mini && a.mini.kind === 'derby' && a.mini.bursts === 1 && a.biome === b0 && b.mini.bursts === 2 && c.mini.bursts === 2 && m.powers.join() === '1,0.6,0', `dev.html ?derby=1: keys 1 / 2 / 0 answer quick / slow / wrong (powers ${m.powers.join(', ')}, biome kept ${a.biome})`);
    check(errors.real().length === 0, `dev derby: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }

  // ---- 10. the dog (v1.1) ----
  {
    const { page, context, errors } = await open(browser, { biome: 'prairie', moving: '0' });
    await page.evaluate(() => window.__ww.scene.pause());
    await step(page, 20);
    const i0 = await info(page), s0 = await state(page);
    const noBark = await page.evaluate(() => window.__ww.scene.dogBark());
    check(i0.dog === null && s0.dog === null && noBark === false && (await events(page, 'bark')).length === 0, 'no dog until setParty brings one; dogBark() without a dog is false and silent');
    const setDog = (coat) => page.evaluate((coat) => {
      const comps = [{ id: 'a', hat: 'cap', color: '#d9534f' }, { id: 'b', hat: 'wide', color: '#5b8c5a' }, { id: 'c', hat: 'bonnet', color: '#f0a500' }];
      window.__dogParty = { animal: 'oxen', companions: comps, wagon: { paint: 'blue', flag: 'red', name: 'Dog Days' }, dog: coat ? { name: 'Biscuit', coat } : null };
      window.__ww.scene.setParty(window.__dogParty);
    }, coat);
    const results = {};
    let worst = 1e9, worstAt = '';
    for (const coat of COATS) {
      for (const bd of DOG_BACKDROPS) {
        await page.evaluate((bd) => { const sc = window.__ww.scene; sc.setLeg({ id: 'chimney-rock', biome: 'bluffs', miles: 160, stop: { kind: 'landmark' } }); sc.setBackdrop(bd); sc.setTravel({ moving: bd === 'trail', weather: 'clear' }); }, bd);
        await setDog(coat);
        await step(page, 50);
        const inf = await info(page);
        const visible = inf.dog && inf.dog.visible;
        if (bd === 'post') { check(inf.dog && inf.dog.coat === coat && !visible, `${coat} dog: not drawn in the post office (visible ${visible})`); continue; }
        // the changed pixels with and without the dog at the same instant, and their mean brightness (the coat)
        const r = await page.evaluate(() => {
          const sc = window.__ww.scene, inf = sc.debugInfo(), dg = inf.dog, k = inf.k, src = document.getElementById('c'), d = src.width / inf.W;
          const bx = dg.x - 32 * k, by = dg.y - 50 * k, bw = 66 * k, bh = 58 * k;
          const grab = () => { const c = document.createElement('canvas'); c.width = Math.round(bw * d); c.height = Math.round(bh * d); const g = c.getContext('2d'); g.drawImage(src, bx * d, by * d, bw * d, bh * d, 0, 0, c.width, c.height); return g.getImageData(0, 0, c.width, c.height).data; };
          const A = grab();
          sc.setParty({ ...window.__dogParty, dog: null });
          sc.debugStep(0);
          const B = grab();
          sc.setParty(window.__dogParty);
          sc.debugStep(0);
          let n = 0, lum = 0;
          for (let i = 0; i < A.length; i += 4) {
            const dd = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
            if (dd > 60) { n++; lum += 0.2126 * A[i] + 0.7152 * A[i + 1] + 0.0722 * A[i + 2]; }
          }
          return { n, lum: n ? lum / n : 0, pose: dg.pose };
        });
        results[coat + '/' + bd] = r;
        if (r.n < worst) { worst = r.n; worstAt = coat + '/' + bd; }
        if (!visible) check(false, `${coat} dog in ${bd}: not visible`);
        await shot(page, `dog-${coat}-${bd}`);
      }
    }
    check(worst > 400, `the dog is drawn in trail, camp, river, landmark, fort and valley with each coat (fewest changed pixels ${worst} at ${worstAt})`);
    const poses = DOG_BACKDROPS.filter((b) => b !== 'post').map((b) => b + ' ' + results['brown/' + b].pose);
    check(results['brown/trail'].pose === 'trot' && results['brown/camp'].pose === 'sit' && results['brown/river'].pose === 'stand', `it trots on the trail, sits by the fire, waits at a stop (${poses.join(', ')})`);
    const coatOrder = DOG_BACKDROPS.filter((b) => b !== 'post').every((b) => results['spotted/' + b].lum > results['brown/' + b].lum + 15 && results['brown/' + b].lum > results['black/' + b].lum + 10);
    check(coatOrder, `the three coats differ (mean brightness spotted > brown > black: ${DOG_BACKDROPS.filter((b) => b !== 'post').map((b) => COATS.map((c) => results[c + '/' + b].lum.toFixed(0)).join('/')).join(', ')})`);
    // the bark
    await page.evaluate(() => { const sc = window.__ww.scene; sc.setBackdrop('trail'); sc.setTravel({ moving: false }); });
    await setDog('brown');
    await step(page, 60);
    const nb0 = (await events(page, 'bark')).length;
    const ok = await page.evaluate(() => window.__ww.scene.dogBark());
    await step(page, 10);
    const ib = await info(page), sb = await state(page);
    await shot(page, 'dog-bark');
    const be = await events(page, 'bark');
    check(ok === true && be.length === nb0 + 1 && Object.keys(be[be.length - 1]).filter((k) => k !== 'at').join() === 'type' && ib.dog.barking && ib.dog.pose === 'bark' && sb.dog && sb.dog.coat === 'brown' && sb.dog.name === 'Biscuit', `dogBark(): the bark pose and { type: 'bark' } (pose ${ib.dog.pose}, getState().dog ${JSON.stringify(sb.dog)})`);
    await step(page, 60);
    check(!(await info(page)).dog.barking, 'the bark is brief (over within a second)');
    // it barks by itself when an animal is spotted
    for (const a of ['pronghorn', 'eagle']) {
      const before = await page.evaluate(() => window.__ww.events.length);
      await page.evaluate((a) => window.__ww.scene.spotAnimal(a), a);
      for (let n = 0; n < 40 && !(await events(page, 'animalSpotted')).some((e) => e.at >= 0 && e.animal === a); n++) await step(page, 30, false);
      await step(page, 1);
      const evs = (await page.evaluate((b) => window.__ww.events.slice(b).map((e) => e.type + (e.animal ? ':' + e.animal : '')), before));
      const iSpot = evs.indexOf('animalSpotted:' + a);
      check(iSpot >= 0 && evs[iSpot + 1] === 'bark', `a ${a} spotted with the dog along: it barks (${evs.join(', ')})`);
      if (a === 'pronghorn') await shot(page, 'dog-barks-at-pronghorn');
      await step(page, 200, false);
    }
    await setDog(null);
    const nb1 = (await events(page, 'bark')).length;
    await page.evaluate(() => window.__ww.scene.spotAnimal('coyote'));
    for (let n = 0; n < 40 && !(await events(page, 'animalSpotted')).some((e) => e.animal === 'coyote'); n++) await step(page, 30, false);
    check((await events(page, 'animalSpotted')).some((e) => e.animal === 'coyote') && (await events(page, 'bark')).length === nb1 && (await info(page)).dog === null, 'no dog, no bark (the coyote is still spotted)');
    // not in the hunt or fishing
    await setDog('black');
    await page.evaluate(() => window.__ww.scene.startHunt({ seed: 2 }));
    await step(page, 10);
    const ih = await info(page);
    await page.evaluate(() => { window.__ww.scene.endMiniGame(); window.__ww.scene.startFish({ seed: 2 }); });
    await step(page, 10);
    const ifs = await info(page);
    await page.evaluate(() => window.__ww.scene.endMiniGame());
    check(!ih.dog.visible && !ifs.dog.visible, 'the dog sits out the hunt and the fishing');
    check(errors.real().length === 0, `dog: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }
  // dev.html: ?dog= and key b
  {
    const { page, context, errors } = await open(browser, { dog: 'black', moving: '0' });
    const s = await state(page);
    await page.keyboard.press('b');
    await page.waitForTimeout(100);
    const barks = await events(page, 'bark');
    check(s.dog && s.dog.coat === 'black' && barks.length === 1, `dev.html ?dog=black brings the dog and key b barks (${JSON.stringify(s.dog)}, ${barks.length} bark)`);
    check(errors.real().length === 0, `dev dog: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }

  // ---- 11. v1.2: the ford, the float, the Columbia raft and the buffalo stampede ----
  // helpers living in the page: follow the calm lane (the guaranteed clear route) by feeding the scene pointer calls
  const FOLLOW = () => {
    window.__follow = (sc, look = 0.03) => {
      const m = sc.debugMini();
      if (!m || (m.phase !== 'drift' && m.phase !== 'ready')) return;
      const a = Math.min(1, m.a + look), f = a * 20, i = Math.min(19, Math.floor(f));
      const u = m.route[i] + (m.route[i + 1] - m.route[i]) * (f - i);
      sc.debugInput('pointer', m.x0 + u * m.chan, m.y);
    };
    // a ford run: taps by policy ('calm' | 'swell' | 'swell1' (the first push on a swell, the rest calm) | 'swell2')
    window.__ford = (width, mode, seed) => {
      const sc = window.__ww.scene, ev0 = window.__ww.events.length;
      sc.startFord({ seed, width });
      let swellTaps = mode === 'swell1' ? 1 : mode === 'swell2' ? 2 : 0, frames = 0, tapsAt = [];
      for (let n = 0; n < 60 * 90; n++) {
        const m = sc.debugMini();
        if (!m) break;
        frames = n;
        if (m.ready) {
          const wantSwell = mode === 'swell' || swellTaps > 0;
          if (wantSwell ? !m.calm : m.calm) { if (wantSwell && mode !== 'swell') swellTaps--; sc.debugInput('pointer', 5, 5); tapsAt.push(Math.round(m.clock * 100) / 100); }
        }
        sc.debugStep(1, false);
      }
      const evs = window.__ww.events.slice(ev0);
      return { taps: evs.filter((e) => e.type === 'ford').map((e) => e.good), end: evs.filter((e) => e.type === 'fordEnd'), frames, closed: !sc.getState().mini, tapsAt };
    };
    // a float or raft run: steer along the calm lane ('steer'), or leave the raft alone ('none')
    window.__river = (kind, opts, mode, extra = {}) => {
      const sc = window.__ww.scene, ev0 = window.__ww.events.length;
      if (kind === 'float') sc.startFloat(opts); else sc.startRaft(opts);
      let frames = 0, maxAng = 0, waitedFrames = 0, gos = 0, waitY = [], phases = new Set(), markers = [];
      for (let n = 0; n < 60 * 240; n++) {
        const m = sc.debugMini();
        if (!m) break;
        frames = n; phases.add(m.phase);
        if (mode === 'steer' && n % 4 === 0) window.__follow(sc);
        maxAng = Math.max(maxAng, Math.abs(m.ang));
        if (kind === 'raft' && m.waiting) {
          waitedFrames++; waitY.push(Math.round(m.y * 10) / 10);
          if (waitedFrames >= (extra.hold || 90)) { waitedFrames = 0; if (sc.raftGo()) gos++; }
        }
        sc.debugStep(1, false);
      }
      const evs = window.__ww.events.slice(ev0);
      return { evs, frames, maxAng, gos, waitY, phases: [...phases], closed: !sc.getState().mini };
    };
    window.__stampede = (seed, goodWaves, opts = {}) => {
      const sc = window.__ww.scene, ev0 = window.__ww.events.length;
      sc.startStampede({ seed });
      let waveIdx = -1, lastCue = false, phases = new Set(), maxShake = 0, maxHaze = 0, maxDust = 0, early = 0, frames = 0, spanTaps = 0;
      for (let n = 0; n < 60 * 120; n++) {
        const m = sc.debugMini();
        if (!m) break;
        frames = n; phases.add(m.phase);
        maxShake = Math.max(maxShake, Math.abs(m.shake)); maxHaze = Math.max(maxHaze, m.haze); maxDust = Math.max(maxDust, m.dust);
        if (m.cue && !lastCue) { waveIdx = m.resolved; }
        lastCue = m.cue;
        if (m.cue && goodWaves[waveIdx]) { sc.debugInput(opts.key ? 'keydown' : 'pointer', opts.key || 5, 5); spanTaps++; }
        if (opts.earlyTap && !m.cue && m.phase === 'warn' && n % 30 === 0) { sc.debugInput('pointer', 5, 5); early++; }
        sc.debugStep(1, false);
      }
      const evs = window.__ww.events.slice(ev0);
      return { evs, frames, phases: [...phases], maxShake, maxHaze, maxDust, early, closed: !sc.getState().mini };
    };
  };

  // ---- the API and the ford ----
  {
    const { page, context, errors } = await open(browser, { biome: 'prairie', moving: '0' });
    await page.evaluate(() => window.__ww.scene.pause());
    await page.evaluate(FOLLOW);
    const api12 = await page.evaluate((names) => names.filter((n) => typeof window.__ww.scene[n] !== 'function'), API_12);
    check(api12.length === 0, `the scene has the v1.2 API: ${API_12.join(', ')} (missing: ${api12.join(',') || 'none'})`);
    check((await page.evaluate(() => window.__ww.scene.raftGo())) === false, 'raftGo() with no raft running: false');
    // narrow, all calm taps: dry
    const calmN = await page.evaluate(() => window.__ford('narrow', 'calm', 3));
    const keysOf = (e) => Object.keys(e).filter((k) => k !== 'at').sort().join();
    check(calmN.taps.length === 4 && calmN.taps.every((g) => g === true) && calmN.end.length === 1 && calmN.end[0].soaked === 0 && calmN.end[0].pushes === 4 && calmN.end[0].good === 4, `ford (narrow): 4 calm taps cross dry: ${JSON.stringify(calmN.end[0])}, taps ${calmN.taps.join()}`);
    check(keysOf(calmN.end[0]) === 'good,pushes,soaked,type' && calmN.closed, `fordEnd carries { soaked, pushes, good } (${keysOf(calmN.end[0])}) and the scene goes back on its own (${calmN.frames} frames)`);
    const calmW = await page.evaluate(() => window.__ford('wide', 'calm', 4));
    check(calmW.taps.length === 6 && calmW.end[0] && calmW.end[0].pushes === 6 && calmW.end[0].soaked === 0 && calmW.end[0].good === 6, `ford (wide): 6 calm pushes: ${JSON.stringify(calmW.end[0])}`);
    // all swell taps: one soaked sack, never more
    const swN = await page.evaluate(() => window.__ford('narrow', 'swell', 3));
    const swW = await page.evaluate(() => window.__ford('wide', 'swell', 9));
    check(swN.taps.length === 4 && swN.taps.every((g) => g === false) && swN.end[0].soaked === 1 && swN.end[0].pushes === 4 && swN.end[0].good === 0, `ford (narrow): 4 swell taps = a wobble each and 1 soaked sack: ${JSON.stringify(swN.end[0])}`);
    check(swW.taps.length === 6 && swW.end[0].soaked === 1 && swW.end[0].good === 0 && swW.end[0].pushes === 6, `ford (wide): 6 swell taps still soak only one sack: ${JSON.stringify(swW.end[0])}`);
    const one = await page.evaluate(() => window.__ford('narrow', 'swell1', 5));
    const two = await page.evaluate(() => window.__ford('narrow', 'swell2', 5));
    check(one.taps[0] === false && one.end[0].soaked === 0 && one.end[0].good === 3 && two.taps.slice(0, 2).every((g) => g === false) && two.end[0].soaked === 1 && two.end[0].good === 2, `one swell tap stays dry, two soak one sack (1 swell: ${JSON.stringify(one.end[0])}; 2 swells: ${JSON.stringify(two.end[0])})`);
    // timing: the swell comes every 1.4 s, 0.7 s of swell then calm; the calm beat is the bigger share
    const timing = await page.evaluate(() => {
      const sc = window.__ww.scene;
      sc.startFord({ seed: 11, width: 'narrow' });
      const starts = [], ends = [];
      let was = false, t = 0;
      for (let n = 0; n < 60 * 9; n++) {
        const m = sc.debugMini(), sw = !m.calm;
        if (sw && !was) starts.push(m.clock); if (!sw && was) ends.push(m.clock);
        was = sw;
        sc.debugStep(1, false);
      }
      const calmShare = 1 - ends.slice(0, 4).reduce((a, e, i) => a + (e - starts[i]), 0) / 4 / 1.4;
      sc.endMiniGame();
      return { periods: starts.slice(1).map((s, i) => Math.round((s - starts[i]) * 100) / 100), first: starts[0], calmShare };
    });
    check(timing.periods.length >= 4 && timing.periods.every((p) => Math.abs(p - 1.4) < 0.03) && timing.first >= 0.9 && timing.calmShare > 0.5, `a swell every ${timing.periods[0]} s (periods ${timing.periods.join(', ')}), the first after ${timing.first.toFixed(2)} s of calm, the calm beat ${(timing.calmShare * 100).toFixed(0)} % of each period`);
    // one tap per rest: mashing is ignored while the team rests
    const mash = await page.evaluate(() => {
      const sc = window.__ww.scene; sc.startFord({ seed: 2, width: 'narrow' });
      const r = [sc.debugInput('pointer', 1, 1), sc.debugInput('pointer', 1, 1), sc.debugInput('pointer', 1, 1)];
      const s = sc.getState().mini; sc.endMiniGame();
      return { r, pushes: s.pushes };
    });
    check(mash.r[0] === true && mash.r[1] === false && mash.pushes === 1, `a push rests the team 0.5 s: three quick taps count once (${mash.r.join()}, pushes ${mash.pushes})`);
    // the real thing: a touch on the canvas and the Space key, with the scene playing
    await page.evaluate(() => { window.__ww.scene.startFord({ seed: 6, width: 'narrow' }); });
    const ta = await page.evaluate(() => getComputedStyle(document.getElementById('c')).touchAction);
    await tapAt(page, 300, 200);
    await step(page, 45);
    await keySpace(page);
    const rs = await state(page);
    check(ta === 'none' && rs.mini && rs.mini.kind === 'ford' && rs.mini.pushes === 2 && rs.mini.good === 2 && (await events(page, 'ford')).length >= 2, `a touch on the canvas and Space both push (touch-action ${ta}, mini ${JSON.stringify(rs.mini)})`);
    await shot(page, 'ford-1-crossing');
    // look at a swell and a soaked sack
    await page.evaluate(() => { const sc = window.__ww.scene; sc.endMiniGame(); sc.startFord({ seed: 8, width: 'wide' }); for (let n = 0; n < 600; n++) { const m = sc.debugMini(); if (m.ready && !m.calm && m.intensity > 0.8) break; sc.debugStep(1, false); } sc.debugInput('pointer', 1, 1); sc.debugStep(40, false); for (let n = 0; n < 600; n++) { const m = sc.debugMini(); if (m.ready && !m.calm) break; sc.debugStep(1, false); } sc.debugInput('pointer', 1, 1); sc.debugStep(20, false); for (let n = 0; n < 600; n++) { const m = sc.debugMini(); if (!m.calm && m.intensity > 0.9) break; sc.debugStep(1, false); } });
    await shot(page, 'ford-2-swell-and-soggy-sack');
    const st2 = await state(page);
    check(st2.mini.bad === 2 && st2.mini.soaked === 1 && st2.mini.phase === 'swell', `a swell on screen after two swell taps: soaked ${st2.mini.soaked} (${JSON.stringify(st2.mini)})`);
    // endMiniGame early: the state so far, no fordEnd
    const fe0 = (await events(page, 'fordEnd')).length;
    const sum = await page.evaluate(() => window.__ww.scene.endMiniGame());
    const sa = await state(page);
    check(sum && sum.kind === 'ford' && sum.finished === false && sum.pushes === 2 && sa.mini === null && sa.view === 'trail' && (await events(page, 'fordEnd')).length === fe0, `endMiniGame() on a ford: ${JSON.stringify(sum)} and no fordEnd`);
    check((await page.evaluate(() => getComputedStyle(document.getElementById('c')).touchAction)) !== 'none', 'the canvas gets its touch-action back when the ford ends');
    // each biome draws (and a wide ford at the far bank shot)
    for (const biome of ['prairie', 'highdesert', 'mountains', 'gorge']) {
      await page.evaluate((b) => { const sc = window.__ww.scene; sc.setLeg({ id: 'kansas-river', biome: b, miles: 150, stop: { kind: 'river' } }); sc.startFord({ seed: 2, width: 'wide' }); sc.debugStep(60); }, biome);
      const v = await variety(page);
      check(v >= 14, `the ford draws in the ${biome} (${v} colours)`);
      if (biome === 'gorge') await shot(page, 'ford-3-gorge');
      await page.evaluate(() => window.__ww.scene.endMiniGame());
    }
    // portrait
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.__ww.scene.startFord({ seed: 5, width: 'wide' }); window.__ww.scene.debugStep(70); });
    await shot(page, 'ford-4-portrait');
    const pv = await variety(page);
    const pr = await page.evaluate(() => window.__ford('wide', 'calm', 4));
    check(pv >= 14 && pr.end[0] && pr.end[0].soaked === 0, `the ford in portrait: ${pv} colours, and crosses dry (${JSON.stringify(pr.end[0])})`);
    check(errors.real().length === 0, `ford: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }
  // dev.html: ?ford=1&width=wide and key f
  {
    const { page, context, errors } = await open(browser, { ford: '1', width: 'wide', seed: '4' });
    const s0 = await state(page);
    await page.waitForTimeout(150);
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
    const s1 = await state(page);
    check(s0.mini && s0.mini.kind === 'ford' && s0.mini.width === 'wide' && s0.mini.left === 6 && s1.mini.pushes === 1 && (await events(page, 'ford')).length === 1, `dev.html ?ford=1&width=wide starts a wide ford and Space pushes (${JSON.stringify(s1.mini)})`);
    check(errors.real().length === 0, `dev ford: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }
  {
    const { page, context, errors } = await open(browser, {});
    await page.keyboard.press('f');
    await page.waitForTimeout(100);
    const s2 = await state(page);
    check(s2.mini && s2.mini.kind === 'ford' && s2.mini.width === 'narrow' && s2.mini.pushes === 0, `key f starts a ford (${JSON.stringify(s2.mini)})`);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+F');
    await page.waitForTimeout(100);
    check((await state(page)).mini.width === 'wide', 'Shift+f starts a wide one');
    check(errors.real().length === 0, `dev ford keys: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }

  // ---- the float ----
  {
    const { page, context, errors } = await open(browser, { biome: 'mountains', moving: '0' });
    await page.evaluate(() => window.__ww.scene.pause());
    await page.evaluate(FOLLOW);
    const rows = [];
    let noSteerOk = true, steerOk = true;
    for (const width of ['narrow', 'wide']) {
      for (const seed of [1, 2, 3, 5, 8, 13]) {
        const idle = await page.evaluate(([w, s]) => window.__river('float', { seed: s, width: w }, 'none'), [width, seed]);
        const steer = await page.evaluate(([w, s]) => window.__river('float', { seed: s, width: w }, 'steer'), [width, seed]);
        const ib = idle.evs.filter((e) => e.type === 'float' && e.bump).length, sb = steer.evs.filter((e) => e.type === 'float' && e.bump).length;
        const ie = idle.evs.find((e) => e.type === 'floatEnd'), se = steer.evs.find((e) => e.type === 'floatEnd');
        if (!(ib >= 1 && ie && ie.bumps === ib && idle.closed)) noSteerOk = false;
        if (!(sb === 0 && se && se.bumps === 0 && steer.closed)) steerOk = false;
        rows.push(`${width}/${seed}: ${ib} bumps idle, ${sb} steered`);
      }
    }
    check(noSteerOk, `float: no steering = at least one bump, floatEnd.bumps counts them (${rows.join('; ')})`);
    check(steerOk, 'float: steering along the way through = 0 bumps on every seed, floatEnd { bumps: 0 }');
    const one = await page.evaluate(() => window.__river('float', { seed: 4, width: 'narrow' }, 'none'));
    const bumpEv = one.evs.find((e) => e.type === 'float');
    check(bumpEv && Object.keys(bumpEv).filter((k) => k !== 'at').sort().join() === 'bump,type' && bumpEv.bump === true && Object.keys(one.evs.find((e) => e.type === 'floatEnd')).filter((k) => k !== 'at').sort().join() === 'bumps,type', 'float events: { type: "float", bump: true } and { type: "floatEnd", bumps }');
    // the run's length: 6 s narrow, 9 s wide (ready 0.7 s + drift + 1 s to land)
    const len = await page.evaluate(() => {
      const out = {};
      for (const w of ['narrow', 'wide']) {
        const sc = window.__ww.scene; sc.startFloat({ seed: 2, width: w });
        let drift0 = -1, drift1 = -1, n = 0, ended = -1;
        for (; n < 60 * 40; n++) { const m = sc.debugMini(); if (!m) break; if (m.phase === 'drift' && drift0 < 0) drift0 = n; if (m.phase !== 'drift' && drift0 >= 0 && drift1 < 0) drift1 = n; if (m.phase === 'landed' && ended < 0) ended = n; sc.debugStep(1, false); }
        out[w] = { drift: (drift1 - drift0) / 60, landedAt: ended / 60, total: n / 60 };
      }
      return out;
    });
    check(Math.abs(len.narrow.drift - 6) < 0.05 && Math.abs(len.wide.drift - 9) < 0.05, `the run is 6 s (narrow) / 9 s (wide) from top to bottom: ${len.narrow.drift} s / ${len.wide.drift} s (landing at ${len.narrow.landedAt.toFixed(1)} / ${len.wide.landedAt.toFixed(1)} s, scene back at ${len.narrow.total.toFixed(1)} / ${len.wide.total.toFixed(1)} s)`);
    // the mini state while it runs, and screenshots
    await page.evaluate(() => { const sc = window.__ww.scene; sc.startFloat({ seed: 3, width: 'wide' }); sc.debugStep(10); });
    await shot(page, 'float-1-start');
    await page.evaluate(() => { const sc = window.__ww.scene; for (let n = 0; n < 160; n++) sc.debugStep(1, false); sc.debugStep(1); });
    const fs = await state(page);
    await shot(page, 'float-2-drift');
    check(fs.mini && fs.mini.kind === 'float' && fs.mini.width === 'wide' && fs.mini.phase === 'drift' && fs.mini.progress > 0 && fs.mini.progress < 1 && 'bumps' in fs.mini, `getState().mini while floating: ${JSON.stringify(fs.mini)}`);
    // steering by the keys (the scene sees the real keyboard) and by a drag (the real mouse)
    await page.evaluate(() => window.__ww.scene.endMiniGame());
    await page.evaluate(() => { window.__ww.scene.startFloat({ seed: 3, width: 'wide' }); });
    await page.evaluate(() => window.__ww.scene.play());
    await page.waitForTimeout(900);
    const u0 = (await page.evaluate(() => window.__ww.scene.debugMini())).u;
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowLeft');
    const u1 = (await page.evaluate(() => window.__ww.scene.debugMini())).u;
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowRight');
    const u2 = (await page.evaluate(() => window.__ww.scene.debugMini())).u;
    check(u1 < u0 - 0.15 && u2 > u1 + 0.15, `the arrow keys steer: ← takes u ${u0.toFixed(2)} → ${u1.toFixed(2)}, → back to ${u2.toFixed(2)}`);
    const dm = await page.evaluate(() => window.__ww.scene.debugMini());
    const px = (u) => dm.x0 + u * dm.chan;
    await page.mouse.move(px(dm.u), dm.y);
    await page.mouse.down();
    await page.mouse.move(px(0.85), dm.y, { steps: 6 });
    await page.waitForTimeout(700);
    await page.mouse.up();
    const u3 = (await page.evaluate(() => window.__ww.scene.debugMini())).u;
    await page.evaluate(() => window.__ww.scene.pause());
    check(u3 > u2 + 0.2, `a drag steers: the raft followed the pointer from u ${u2.toFixed(2)} to ${u3.toFixed(2)}`);
    // a bump: thud, splash, rocking (the raft's tilt) in the picture
    await page.evaluate(() => { const sc = window.__ww.scene; sc.endMiniGame(); sc.startFloat({ seed: 3, width: 'narrow' }); for (let n = 0; n < 6000; n++) { sc.debugStep(1, false); if (sc.debugMini().bumps > 0) break; } sc.debugStep(6); });
    await shot(page, 'float-3-bump');
    check((await state(page)).mini.bumps >= 1, 'a bump shows (BUMP!, a splash, the raft rocking)');
    // endMiniGame early; the landing and cheer
    const fe0 = (await events(page, 'floatEnd')).length;
    const sum = await page.evaluate(() => window.__ww.scene.endMiniGame());
    check(sum && sum.kind === 'float' && sum.finished === false && (await state(page)).mini === null && (await events(page, 'floatEnd')).length === fe0, `endMiniGame() on a float: ${JSON.stringify(sum)}`);
    await page.evaluate(() => { const sc = window.__ww.scene; sc.startFloat({ seed: 2, width: 'narrow' }); for (let n = 0; n < 60 * 20; n++) { if (sc.debugMini().phase === 'landed') break; sc.debugStep(1, false); } sc.debugStep(20); });
    await shot(page, 'float-4-landed');
    const lp = await info(page);
    check(lp.particles.conf > 5 && (await state(page)).mini.phase === 'landed', `the landing: a small cheer (${lp.particles.conf} sparkles) and the party on the beach`);
    await page.evaluate(() => window.__ww.scene.endMiniGame());
    // portrait
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const pf = await page.evaluate(() => window.__river('float', { seed: 7, width: 'narrow' }, 'steer'));
    check(pf.evs.some((e) => e.type === 'floatEnd' && e.bumps === 0), 'the float in portrait: steering along the lane lands with no bumps');
    await page.evaluate(() => { window.__ww.scene.startFloat({ seed: 7, width: 'wide' }); window.__ww.scene.debugStep(200); });
    await shot(page, 'float-5-portrait');
    check((await variety(page)) >= 14, 'the float draws in portrait');
    await page.evaluate(() => window.__ww.scene.endMiniGame());
    check(errors.real().length === 0, `float: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }
  // dev.html: ?float=1 and key l
  {
    const { page, context, errors } = await open(browser, { float: '1', seed: '3' });
    const s0 = await state(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('l');
    await page.waitForTimeout(100);
    const s1 = await state(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+L');
    await page.waitForTimeout(100);
    const s2 = await state(page);
    check(s0.mini && s0.mini.kind === 'float' && s1.mini.kind === 'float' && s1.mini.width === 'narrow' && s2.mini.width === 'wide', `dev.html ?float=1 and keys l / Shift+l (${s0.mini && s0.mini.kind}, ${s1.mini.width}, ${s2.mini.width})`);
    check(errors.real().length === 0, `dev float: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }

  // ---- the Columbia raft ----
  {
    const { page, context, errors } = await open(browser, { biome: 'prairie', moving: '0' });
    await page.evaluate(() => window.__ww.scene.pause());
    await page.evaluate(FOLLOW);
    // steered along the calm lane, four bends: the markers pause until raftGo
    const run = await page.evaluate(() => window.__river('raft', { seed: 5 }, 'steer', { hold: 100 }));
    const mk = run.evs.filter((e) => e.type === 'raftMarker'), end = run.evs.filter((e) => e.type === 'raftEnd');
    check(mk.length === 4 && mk.every((e, i) => e.n === i + 1 && e.of === 4 && Object.keys(e).filter((k) => k !== 'at').sort().join() === 'n,of,type'), `raft: four markers { n, of } in order (${mk.map((e) => e.n + '/' + e.of).join(' ')})`);
    check(run.gos === 4 && run.waitY.length >= 4 * 100 - 8, `raft: the raft waits at each bend until raftGo (${run.gos} raftGo calls, waited ${run.waitY.length} frames)`);
    const still = run.waitY.every((y) => Math.abs(y - run.waitY[0]) < 0.01);
    check(still, 'raft: it stays put in the calm water while it waits (same y every frame)');
    check(end.length === 1 && end[0].bumps === 0 && end[0].bends === 4 && Object.keys(end[0]).filter((k) => k !== 'at').sort().join() === 'bends,bumps,type' && run.closed, `raft: steered along the calm lane = raftEnd ${JSON.stringify(end[0])} and the scene goes back`);
    check(['ready', 'drift', 'bend', 'turn', 'land', 'landed', 'vista'].every((p) => run.phases.includes(p)), `raft: it passes through ${run.phases.join(', ')}`);
    check(mk[0].at < end[0].at && run.evs.indexOf(mk[3]) < run.evs.indexOf(end[0]), 'raft: raftEnd comes after the last marker');
    // left alone: bumps (and the eddies spin it if it drifts in)
    const idle = await page.evaluate(() => window.__river('raft', { seed: 5, length: 2 }, 'none', { hold: 30 }));
    const ie = idle.evs.find((e) => e.type === 'raftEnd');
    const ib = idle.evs.filter((e) => e.type === 'raft' && e.bump).length;
    check(ie && ie.bumps >= 1 && ie.bumps === ib && ie.bends === 2 && idle.evs.filter((e) => e.type === 'raftMarker').length === 2, `raft with length 2, no steering: bumps ${ie && ie.bumps} (= ${ib} bump events), ${ie && ie.bends} bends, 2 markers`);
    // raftGo: true only while waiting; the markers carry the length
    const wg = await page.evaluate(() => {
      const sc = window.__ww.scene; sc.startRaft({ seed: 2, length: 3 });
      const early = sc.raftGo();
      let n = 0;
      for (; n < 60 * 30; n++) { if (sc.debugMini().waiting) break; window.__follow(sc); sc.debugStep(1, false); }
      const m1 = sc.debugMini(), y1 = m1.y; sc.debugStep(120, false);
      const m2 = sc.debugMini();
      const first = sc.raftGo(), second = sc.raftGo();
      sc.debugStep(30, false);
      const m3 = sc.debugMini();
      sc.endMiniGame();
      return { early, first, second, wait: m1.waiting, waitAfter: m2.waiting, y1, y2: m2.y, progress: [m1.progress, m2.progress], phaseAfter: m3.phase, of: window.__ww.events.filter((e) => e.type === 'raftMarker').pop().of, left: m1.left };
    });
    check(wg.early === false && wg.wait && wg.waitAfter && wg.y1 === wg.y2 && wg.progress[0] === wg.progress[1] && wg.first === true && wg.second === false && wg.phaseAfter === 'turn' && wg.of === 3, `raftGo(): false before a bend, true once at a bend, false again; the raft does not move while it waits (${JSON.stringify(wg)})`);
    // eddies: steer into one: the raft spins; steer out: it settles
    const ed = await page.evaluate(() => {
      const sc = window.__ww.scene; sc.startRaft({ seed: 9, length: 2 });
      const spun = { max: 0, spins: 0, settled: null };
      let hit = false;
      for (let n = 0; n < 60 * 30; n++) {
        const m = sc.debugMini();
        if (!m || m.phase === 'bend') break;
        if (m.phase === 'drift' || m.phase === 'ready') {
          const e = m.eddies.find((q) => q.a > m.a - 0.02) || null;
          if (e && !hit && m.a < e.a + 0.08) { sc.debugInput('pointer', m.x0 + e.u * m.chan, m.y); if (Math.abs(m.u - e.u) < 0.1 && Math.abs(m.a - e.a) < 0.06) hit = true; }
          else if (hit || !e) window.__follow(sc, 0.0);
        }
        spun.max = Math.max(spun.max, Math.abs(m.ang)); spun.spins = m.spins;
        sc.debugStep(1, false);
      }
      sc.debugStep(10, false);
      const after = sc.debugMini();
      spun.settled = after ? Math.abs(after.ang - Math.round(after.ang / (2 * Math.PI)) * 2 * Math.PI) : null;
      sc.endMiniGame();
      return spun;
    });
    check(ed.max > 1.2 && ed.spins >= 1, `raft: an eddy spins it (largest turn ${ed.max.toFixed(2)} rad, ${ed.spins} eddy entered)`);
    check(ed.settled !== null && ed.settled < 0.5, `raft: out of the eddy the raft settles straight again (${ed.settled === null ? 'n/a' : ed.settled.toFixed(2)} rad off)`);
    // pictures: the bend marker, the calm lane, the landing and the vista
    await page.evaluate(() => { const sc = window.__ww.scene; sc.startRaft({ seed: 12, length: 2 }); for (let n = 0; n < 60 * 20; n++) { window.__follow(sc); sc.debugStep(1, false); if (sc.debugMini().waiting) break; } sc.debugStep(30); });
    await shot(page, 'raft-1-bend-1');
    await page.evaluate(() => { const sc = window.__ww.scene; sc.raftGo(); sc.debugStep(35); });
    await shot(page, 'raft-2-turning');
    await page.evaluate(() => { const sc = window.__ww.scene; for (let n = 0; n < 60 * 20; n++) { window.__follow(sc); sc.debugStep(1, false); if (sc.debugMini().waiting) break; } sc.raftGo(); for (let n = 0; n < 60 * 20; n++) { if (sc.debugMini().phase === 'drift' && sc.debugMini().valley) break; sc.debugStep(1, false); } sc.debugStep(120); });
    await shot(page, 'raft-3-valley-stretch');
    await page.evaluate(() => { const sc = window.__ww.scene; for (let n = 0; n < 60 * 20; n++) { window.__follow(sc); if (sc.debugMini().phase === 'landed') break; sc.debugStep(1, false); } sc.debugStep(30); });
    await shot(page, 'raft-4-landing');
    const landed = await state(page), li = await info(page);
    check(landed.mini && landed.mini.phase === 'landed' && li.particles.conf > 30 && (await events(page, 'raftEnd')).length >= 3, `raft: the landing at the valley, the party cheering with confetti (${li.particles.conf} pieces, phase ${landed.mini && landed.mini.phase})`);
    await page.evaluate(() => window.__ww.scene.debugStep(80));
    await shot(page, 'raft-5-vista');
    check((await state(page)).mini.phase === 'vista', 'raft: then the vista of the valley (phase vista)');
    // endMiniGame mid-run
    await page.evaluate(() => { const sc = window.__ww.scene; sc.endMiniGame(); sc.startRaft({ seed: 3, length: 3 }); sc.debugStep(200, false); });
    const re0 = (await events(page, 'raftEnd')).length;
    const rsum = await page.evaluate(() => window.__ww.scene.endMiniGame());
    check(rsum && rsum.kind === 'raft' && rsum.finished === false && (await state(page)).mini === null && (await events(page, 'raftEnd')).length === re0 && (await page.evaluate(() => window.__ww.scene.raftGo())) === false, `endMiniGame() on a raft: ${JSON.stringify(rsum)}`);
    // portrait and a wide viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.__ww.scene.startRaft({ seed: 4, length: 4 }); window.__ww.scene.debugStep(240); });
    await shot(page, 'raft-6-portrait');
    check((await variety(page)) >= 14, 'the raft draws in portrait');
    const pr = await page.evaluate(() => { window.__ww.scene.endMiniGame(); return window.__river('raft', { seed: 4, length: 2 }, 'steer', { hold: 20 }); });
    check(pr.evs.some((e) => e.type === 'raftEnd' && e.bumps === 0 && e.bends === 2), 'the raft in portrait: steering along the calm lane makes it through with no bumps');
    check(errors.real().length === 0, `raft: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }
  // dev.html: ?raft=1 and the keys r / Enter
  {
    const { page, context, errors } = await open(browser, { raft: '1', length: '2', seed: '6' });
    const s0 = await state(page);
    check(s0.mini && s0.mini.kind === 'raft' && s0.mini.length === 2, `dev.html ?raft=1&length=2 starts the raft (${JSON.stringify(s0.mini)})`);
    await page.keyboard.press('Escape');
    await page.keyboard.press('r');
    await page.waitForTimeout(100);
    check((await state(page)).mini.kind === 'raft', 'key r starts the Columbia raft');
    await page.evaluate(() => { const sc = window.__ww.scene; sc.pause(); for (let n = 0; n < 60 * 30; n++) { sc.debugStep(1, false); if (sc.debugMini().waiting) break; } });
    await page.keyboard.press('Enter');
    check((await state(page)).mini.phase === 'turn', 'Enter calls raftGo() at a bend');
    check(errors.real().length === 0, `dev raft: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }

  // ---- the buffalo stampede ----
  {
    const { page, context, errors } = await open(browser, { biome: 'prairie', moving: '0' });
    await page.evaluate(() => window.__ww.scene.pause());
    await page.evaluate(FOLLOW);
    const good3 = await page.evaluate(() => window.__stampede(7, [true, true, true]));
    const ev = (r, t) => r.evs.filter((e) => e.type === t);
    check(ev(good3, 'stampede').length === 3 && ev(good3, 'stampede').every((e) => e.good === true && Object.keys(e).filter((k) => k !== 'at').sort().join() === 'good,type') && ev(good3, 'stampedeEnd').length === 1 && ev(good3, 'stampedeEnd')[0].held === true && good3.closed, `stampede: three good brakes = held: ${JSON.stringify(ev(good3, 'stampede').map((e) => e.good))}, ${JSON.stringify(ev(good3, 'stampedeEnd')[0])}`);
    const bad = await page.evaluate(() => window.__stampede(7, [false, false, false]));
    check(ev(bad, 'stampede').length === 3 && ev(bad, 'stampede').every((e) => e.good === false) && ev(bad, 'stampedeEnd')[0].held === false && bad.closed, `stampede: no brakes = not held, never a crash: ${JSON.stringify(ev(bad, 'stampede').map((e) => e.good))}, ${JSON.stringify(ev(bad, 'stampedeEnd')[0])}`);
    const two = await page.evaluate(() => window.__stampede(7, [true, false, true]));
    const one = await page.evaluate(() => window.__stampede(7, [false, true, false]));
    check(ev(two, 'stampedeEnd')[0].held === true && ev(one, 'stampedeEnd')[0].held === false && ev(two, 'stampede').map((e) => e.good).join() === 'true,false,true' && ev(one, 'stampede').map((e) => e.good).join() === 'false,true,false', `held = at least two good (2 good: ${ev(two, 'stampedeEnd')[0].held}, 1 good: ${ev(one, 'stampedeEnd')[0].held})`);
    check(['warn', 'run', 'cue'].every((p) => good3.phases.includes(p)) && good3.phases.includes('brake') && bad.phases.includes('dust') && good3.phases.includes('settle') && good3.maxShake > 0.5 && bad.maxHaze > 0.3 && bad.maxDust > 8, `the stampede's phases ${good3.phases.join('/')}; the ground shakes (${good3.maxShake.toFixed(1)} px), a miss raises the dust (haze ${bad.maxHaze.toFixed(2)}, ${bad.maxDust} puffs)`);
    check(ev(good3, 'stampedeEnd')[0].at > ev(good3, 'stampede')[2].at, 'stampedeEnd comes after the third wave');
    // an early tap is free (no event, no penalty); the sign comes before any decision
    const early = await page.evaluate(() => window.__stampede(7, [true, true, true], { earlyTap: true }));
    check(early.early >= 2 && ev(early, 'stampede').length === 3 && ev(early, 'stampede').every((e) => e.good === true), `a tap before the BRAKE sign is free (${early.early} early taps, still three good brakes)`);
    // the run's timing
    check(good3.frames / 60 > 15 && good3.frames / 60 < 45, `a stampede takes ${(good3.frames / 60).toFixed(1)} s with all three waves and the dust settling`);
    // pictures
    await page.evaluate(() => { const sc = window.__ww.scene; sc.startStampede({ seed: 7 }); sc.debugStep(70); });
    await shot(page, 'stampede-1-rumble');
    await page.evaluate(() => { const sc = window.__ww.scene; for (let n = 0; n < 600 && !sc.debugMini().cue; n++) sc.debugStep(1, false); sc.debugStep(30); });
    await shot(page, 'stampede-2-brake-sign');
    check((await page.evaluate(() => window.__ww.scene.debugMini().cue)) === true && (await state(page)).mini.phase === 'cue', 'the BRAKE sign is up (phase cue)');
    await page.evaluate(() => { const sc = window.__ww.scene; sc.debugInput('pointer', 1, 1); sc.debugStep(25); });
    await shot(page, 'stampede-3-whoa');
    check((await state(page)).mini.good === 1 && (await state(page)).mini.phase === 'brake', 'a brake: WHOA! (the team and the bull stop)');
    await page.evaluate(() => { const sc = window.__ww.scene; sc.endMiniGame(); sc.startStampede({ seed: 9 }); for (let n = 0; n < 900; n++) { const m = sc.debugMini(); if (m.results.length >= 1) break; sc.debugStep(1, false); } sc.debugStep(20); });
    await shot(page, 'stampede-4-pfft');
    const ps = await info(page);
    check((await state(page)).mini.phase === 'dust' && ps.dog === null, 'a miss: dust in everyone\'s face and "PFFT!" (phase dust)');
    // the dog trots along through it
    await page.evaluate(() => { const sc = window.__ww.scene; sc.endMiniGame(); sc.setParty({ animal: 'oxen', companions: [{ id: 'a', hat: 'cap', color: '#d9534f' }, { id: 'b', hat: 'wide', color: '#5b8c5a' }, { id: 'c', hat: 'bonnet', color: '#f0a500' }], wagon: { paint: 'blue', flag: 'red', name: 'Dust Up' }, dog: { name: 'Biscuit', coat: 'spotted' } }); sc.startStampede({ seed: 5 }); sc.debugStep(200); });
    await shot(page, 'stampede-5-with-the-dog');
    check((await info(page)).dog.visible === true, 'the dog is along in the stampede');
    await page.evaluate(() => window.__ww.scene.endMiniGame());
    // endMiniGame early
    await page.evaluate(() => { const sc = window.__ww.scene; sc.startStampede({ seed: 2 }); sc.debugStep(200, false); });
    const se0 = (await events(page, 'stampedeEnd')).length;
    const ssum = await page.evaluate(() => window.__ww.scene.endMiniGame());
    check(ssum && ssum.kind === 'stampede' && ssum.finished === false && (await state(page)).mini === null && (await events(page, 'stampedeEnd')).length === se0 && (await state(page)).view === 'trail', `endMiniGame() on a stampede: ${JSON.stringify(ssum)}`);
    // reduced motion: no shaking
    await page.evaluate(() => { const sc = window.__ww.scene; sc.setReducedMotion(true); });
    const rmRun = await page.evaluate(() => window.__stampede(7, [true, true, true]));
    check(rmRun.maxShake === 0 && ev(rmRun, 'stampedeEnd').length === 1, 'reduced motion: the ground does not shake');
    await page.evaluate(() => window.__ww.scene.setReducedMotion(false));
    // the real keyboard and the real touch: wait for the sign, then ← (and again with Space, B and a touch)
    for (const [name, press] of [['ArrowLeft', (p) => p.keyboard.press('ArrowLeft')], ['Space', (p) => p.keyboard.press('Space')], ['b', (p) => p.keyboard.press('b')], ['a touch', (p) => p.touchscreen.tap(300, 200)]]) {
      await page.evaluate(() => { const sc = window.__ww.scene; sc.endMiniGame(); sc.startStampede({ seed: 7 }); sc.play(); });
      await page.waitForFunction(() => window.__ww.scene.debugMini().cue, null, { timeout: 8000 });
      const before = (await events(page, 'stampede')).length;
      await press(page);
      await page.waitForTimeout(80);
      const evs = await events(page, 'stampede');
      check(evs.length === before + 1 && evs[evs.length - 1].good === true, `the real ${name} brakes at the sign (${JSON.stringify(evs[evs.length - 1])})`);
      await page.evaluate(() => window.__ww.scene.pause());
    }
    await page.evaluate(() => window.__ww.scene.endMiniGame());
    // portrait
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.evaluate(() => { const sc = window.__ww.scene; sc.startStampede({ seed: 7 }); for (let n = 0; n < 600 && !sc.debugMini().cue; n++) sc.debugStep(1, false); sc.debugStep(20); });
    await shot(page, 'stampede-6-portrait');
    check((await variety(page)) >= 14, 'the stampede draws in portrait');
    await page.evaluate(() => window.__ww.scene.endMiniGame());
    // the other biome
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300);
    await page.evaluate(() => { const sc = window.__ww.scene; sc.setLeg({ id: 'chimney-rock', biome: 'bluffs', miles: 160, stop: { kind: 'landmark' } }); sc.startStampede({ seed: 3 }); for (let n = 0; n < 600 && !sc.debugMini().cue; n++) sc.debugStep(1, false); sc.debugStep(10); });
    await shot(page, 'stampede-7-bluffs');
    check((await variety(page)) >= 14, 'the stampede draws on the bluffs too');
    await page.evaluate(() => window.__ww.scene.endMiniGame());
    check(errors.real().length === 0, `stampede: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }
  // dev.html: ?stampede=1 and the key s
  {
    const { page, context, errors } = await open(browser, { stampede: '1', seed: '7' });
    const s0 = await state(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('s');
    await page.waitForTimeout(100);
    const s1 = await state(page);
    check(s0.mini && s0.mini.kind === 'stampede' && s1.mini && s1.mini.kind === 'stampede' && s1.mini.good === 0, `dev.html ?stampede=1 and key s start the stampede (${JSON.stringify(s1.mini)})`);
    check(errors.real().length === 0, `dev stampede: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }
  // the other mini-games still work next to the new ones (hunt, fishing, the derby)
  {
    const { page, context, errors } = await open(browser, { biome: 'prairie', moving: '0' });
    await page.evaluate(() => window.__ww.scene.pause());
    const r = await page.evaluate(() => {
      const sc = window.__ww.scene, out = [];
      for (const [start, kind] of [['startHunt', 'hunt'], ['startFish', 'fish'], ['startDerby', 'derby'], ['startFord', 'ford'], ['startFloat', 'float'], ['startRaft', 'raft'], ['startStampede', 'stampede']]) {
        sc[start]({ seed: 1 }); sc.debugStep(30);
        const m = sc.getState().mini; out.push(m && m.kind);
      }
      const last = sc.endMiniGame();
      return { out, last: last && last.kind, after: sc.getState().mini };
    });
    check(r.out.join() === 'hunt,fish,derby,ford,float,raft,stampede' && r.last === 'stampede' && r.after === null, `starting one mini-game over another replaces it (${r.out.join(' > ')})`);
    check(errors.real().length === 0, `mini-games in a row: no console errors (${errors.real().join(' | ')})`);
    await context.close();
  }

  }

  // ---- 12. v1.4 (Frodo and the river): the dog's vignettes, the trail facts, the camp and river games, fishing 2.0 ----
  if (!process.env.PERF_ONLY && !process.env.V15_ONLY && !process.env.V16_ONLY) {
    const API_14 = ['dogRun', 'dogWarn', 'startChase', 'chaseCall', 'ambient', 'startFetch', 'fetchBring', 'startHoppers', 'startStones', 'startMeteors', 'startDustDevil', 'startFishing', 'fishingRetry', 'fishingHelp'];
    const dbg = (page) => page.evaluate(() => window.__ww.scene.debugMini());
    const pointer = (page, x, y) => page.evaluate(([x, y]) => window.__ww.scene.debugInput('pointer', x, y), [x, y]);
    const release = (page) => page.evaluate(() => window.__ww.scene.debugInput('release'));
    const clear = (page) => page.evaluate(() => { window.__ww.events.length = 0; });
    const evs = (page, type) => page.evaluate((t) => window.__ww.events.filter((e) => e.type === t), type);
    const cues = (page) => page.evaluate(() => [...new Set(window.__ww.events.filter((e) => e.type === 'sfx').map((e) => e.cue))]);
    // steps the sim (no drawing) until an event of this type has fired; returns the frames it took (-1: never)
    const untilEvent = (page, type, max = 3000) => page.evaluate(([type, max]) => { const sc = window.__ww.scene; for (let i = 0; i < max; i++) { sc.debugStep(1, false); if (window.__ww.events.some((e) => e.type === type)) return i; } return -1; }, [type, max]);
    const untilN = (page, type, n, max = 3000) => page.evaluate(([type, n, max]) => { const sc = window.__ww.scene; for (let i = 0; i < max; i++) { if (window.__ww.events.filter((e) => e.type === type).length >= n) return i; sc.debugStep(1, false); } return -1; }, [type, n, max]);
    const untilPhase = (page, phase, max = 3000) => page.evaluate(([phase, max]) => { const sc = window.__ww.scene; for (let i = 0; i < max; i++) { const m = sc.debugMini(); if (m && m.phase === phase) return i; sc.debugStep(1, false); } return -1; }, [phase, max]);
    // fishing: play the fight in the page. style 'land' holds except through the warning and the red; 'off' holds throughout.
    // Stops when the cast leaves the fight (land / off) or reaches the help phase.
    const playFight = (page, style = 'land', max = 4000) => page.evaluate(([style, max]) => {
      const sc = window.__ww.scene; let held = false; const log = { warnBefore: false, sawWarn: false, sawWobble: false, firstWarnAt: -1, firstWobbleAt: -1 };
      for (let i = 0; i < max; i++) {
        const m = sc.debugMini();
        if (!m) return { ...log, end: 'none' };
        if (m.phase !== 'fight') { if (held) { sc.debugInput('release'); held = false; } return { ...log, end: m.phase, frames: i }; }
        if (m.fight === 'help') { if (held) { sc.debugInput('release'); held = false; } return { ...log, end: 'help', frames: i }; }
        if (m.warn && !log.sawWarn) { log.sawWarn = true; log.firstWarnAt = i; }
        if (m.wobble && !log.sawWobble) { log.sawWobble = true; log.firstWobbleAt = i; log.warnBefore = log.sawWarn; }
        const want = style === 'off' ? true : !(m.wobble || m.warn);
        if (want && !held) { sc.debugInput('pointer', 300, 300); held = true; }
        if (!want && held) { sc.debugInput('release'); held = false; }
        sc.debugStep(1, false);
      }
      return { ...log, end: 'timeout' };
    }, [style, max]);
    const session = (page, o) => page.evaluate(async (o) => { const m = await import('/wagon-west/src/scene/devSession.js'); return m.devSession(o); }, o);
    const API_MISS = async (page) => page.evaluate((names) => names.filter((n) => typeof window.__ww.scene[n] !== 'function'), API_14);

    // ---- the API, the dog's vignettes (dogRun, dogWarn, the rabbit chase and the mud) ----
    {
      const { page, context, errors } = await open(browser, { biome: 'prairie', dog: 'brown', moving: '1' });
      check((await API_MISS(page)).length === 0, `the scene has the v1.4 API: ${API_14.join(', ')}`);
      await page.evaluate(() => window.__ww.scene.pause());
      // dogRun: off-screen and back with the bubble, one side then the other
      const sides = [];
      for (const [i, kind] of ['find', 'quest', 'berries'].entries()) {
        await clear(page);
        await page.evaluate(([kind]) => window.__ww.scene.dogRun(kind, { emoji: '🐴' }), [kind]);
        let off = false, mid = false;
        const t0 = await page.evaluate(() => { const sc = window.__ww.scene; let n = 0; const W = sc.debugInfo().W; const out = { off: false, side: 0, n: 0 }; for (; n < 600 && !window.__ww.events.some((e) => e.type === 'dogBack'); n++) { sc.debugStep(1, false); const m = sc.debugMini(); if (m && m.pos && (m.pos.x < -20 || m.pos.x > W + 20)) { out.off = true; out.side = m.pos.x < 0 ? -1 : 1; } } out.n = n; return out; });
        sides.push(t0.side);
        const back = await evs(page, 'dogBack');
        check(back.length === 1 && back[0].kind === kind && t0.off && t0.n > 150 && t0.n < 420, `dogRun('${kind}'): the dog went off-screen (${t0.side < 0 ? 'left' : 'right'}) and came back in ${(t0.n / 60).toFixed(1)} s → dogBack ${JSON.stringify(back[0])}`);
      }
      check(sides[0] !== sides[1] && sides[1] !== sides[2], `the dog runs off to alternating sides (${sides.join(', ')})`);
      await page.evaluate(() => { const sc = window.__ww.scene; sc.dogRun('find', { emoji: '🐴' }); sc.debugStep(255, true); });
      await shot(page, 'v14-dogrun-bubble');
      await page.evaluate(() => window.__ww.scene.endMiniGame());
      // dogWarn: the wagon halts, two barks, the snake slides away
      await clear(page);
      const s0 = (await state(page)).scroll;
      await page.evaluate(() => window.__ww.scene.dogWarn());
      await step(page, 100);
      const mid = await dbg(page);
      await shot(page, 'v14-dogwarn');
      const sA = (await state(page)).scroll; await step(page, 60, false); const sB = (await state(page)).scroll;
      check(sB === sA, `dogWarn: the wagon halts while the dog barks (scroll ${sA} → ${sB}; it was rolling: ${s0} → ${sA})`);
      await untilEvent(page, 'dogWarnEnd', 600);
      const bk = await evs(page, 'bark'), we = await evs(page, 'dogWarnEnd');
      check(bk.length === 2 && we.length === 1, `dogWarn: two barks and dogWarnEnd (${bk.length} barks, ${we.length} ends)`);
      check(mid && mid.snake && mid.snake.u === 0 && mid.halted, `the snake is sunning on the trail while the dog barks (${JSON.stringify(mid && mid.snake)})`);
      await step(page, 60, false);
      const roll = (await state(page)).scroll; await step(page, 60, false);
      check((await state(page)).scroll > roll, 'the wagon rolls again after the snake has gone');
      // the chase: called early, called late, not called
      for (const [label, callAt] of [['early', 90], ['late', 255], ['never', -1]]) {
        await clear(page);
        await page.evaluate(() => window.__ww.scene.startChase({ seed: 3 }));
        let called = null;
        if (callAt > 0) { await step(page, callAt, label === 'early'); if (label === 'early') await shot(page, 'v14-chase-out'); called = await page.evaluate(() => window.__ww.scene.chaseCall()); }
        await untilEvent(page, 'chaseEnd', 1200);
        const ch = await evs(page, 'chase'), ce = await evs(page, 'chaseEnd');
        if (label === 'early') check(called === true && ch.length === 1 && ch[0].dist < 0.8 && ce.length === 1 && ce[0].called === true && Math.abs(ce[0].dist - ch[0].dist) < 1e-9, `chase called early: ${JSON.stringify(ch[0])} → ${JSON.stringify(ce[0])}`);
        else if (label === 'late') check(called === true && ch.length === 1 && ch[0].dist >= 0.8 && ch[0].dist <= 1 && ce[0].called === true, `chase called late (dist ≥ 0.8): ${JSON.stringify(ch[0])} → ${JSON.stringify(ce[0])}`);
        else check(ch.length === 0 && ce.length === 1 && ce[0].called === false && ce[0].dist === 1 && (await page.evaluate(() => window.__ww.scene.chaseCall())) === false, `chase never called: he comes back on his own ${JSON.stringify(ce[0])}, chaseCall() is false`);
        await step(page, 80, false);
        check((await state(page)).mini === null, `chase (${label}) ends and the scene goes back to the trail`);
      }
      // the mud overlay: setParty({ dog: { muddy: true } }) draws a visibly different coat; the state says so
      await page.evaluate(() => { const sc = window.__ww.scene; sc.setTravel({ moving: false }); sc.setParty({ animal: 'oxen', companions: undefined, wagon: { paint: 'classic', flag: 'red', name: 'Lucky' }, dog: { name: 'Frodo', coat: 'spotted', muddy: false } }); sc.debugStep(40, true); });
      const dog0 = (await info(page)).dog;
      const region = (page2) => page2.evaluate(([x, y]) => { const src = document.getElementById('c'), r = src.width / window.__ww.scene.debugInfo().W; const c = document.createElement('canvas'); c.width = 40; c.height = 30; c.getContext('2d').drawImage(src, (x - 25) * r, (y - 40) * r, 50 * r, 45 * r, 0, 0, 40, 30); const d = c.getContext('2d').getImageData(0, 0, 40, 30).data; let sr = 0, sg = 0, sb = 0; for (let i = 0; i < d.length; i += 4) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; } const n = d.length / 4; return [sr / n, sg / n, sb / n]; }, [dog0.x, dog0.y]);
      const clean = await region(page);
      await shot(page, 'v14-dog-clean');
      await page.evaluate(() => { const sc = window.__ww.scene; sc.setParty({ animal: 'oxen', companions: undefined, wagon: { paint: 'classic', flag: 'red', name: 'Lucky' }, dog: { name: 'Frodo', coat: 'spotted', muddy: true } }); sc.debugStep(2, true); });
      const muddy = await region(page);
      await shot(page, 'v14-dog-muddy');
      const dist = Math.hypot(clean[0] - muddy[0], clean[1] - muddy[1], clean[2] - muddy[2]);
      check((await state(page)).dog.muddy === true && dist > 6, `the mud overlay is drawn (getState().dog.muddy, the dog's patch of the canvas changed by ${dist.toFixed(0)})`);
      check(errors.real().length === 0, `dog vignettes: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }

    // ---- the trail-fact scenes: every kind renders and ends; the grizzly stays far; the crack draws only trees and birds ----
    {
      const { page, context, errors } = await open(browser, { biome: 'mountains', dog: 'brown', moving: '1' });
      await page.evaluate(() => window.__ww.scene.pause());
      for (const kind of ['crack', 'grizzly', 'wolves', 'fireglow', 'pronghorn']) {
        await clear(page);
        if (kind === 'wolves' || kind === 'fireglow') await page.evaluate(() => window.__ww.scene.setTravel({ weather: 'dusk' }));
        else await page.evaluate(() => window.__ww.scene.setTravel({ weather: 'clear' }));
        await page.evaluate((k) => window.__ww.scene.ambient(k), kind);
        const r = await page.evaluate(() => { const sc = window.__ww.scene; const out = { frames: 0, bear: [], drawn: new Set(), vis: 0 }; for (let i = 0; i < 900 && !window.__ww.events.some((e) => e.type === 'ambientEnd'); i++) { sc.debugStep(1, true); const m = sc.debugMini(); if (m) { out.frames++; (m.drawn || []).forEach((d) => out.drawn.add(d)); if (m.bear) out.bear.push([m.bear.feetFrac, m.bear.hFrac, m.bear.x0, m.bear.x1]); } } out.drawn = [...out.drawn]; return out; });
        const end = await evs(page, 'ambientEnd');
        check(end.length === 1 && end[0].kind === kind && r.frames > 280 && r.frames < 400, `ambient('${kind}') ends with ambientEnd after ${(r.frames / 60).toFixed(1)} s (5-6 s)`);
        if (kind === 'grizzly') {
          const worstFeet = Math.max(...r.bear.map((b) => b[0])), worstH = Math.max(...r.bear.map((b) => b[1]));
          check(r.bear.length > 250 && worstFeet < 0.45 && worstH <= 0.07, `grizzly: in all ${r.bear.length} frames its feet stay above 45 % of the height (max ${(worstFeet * 100).toFixed(1)} %) and it is ≤ 7 % tall (max ${(worstH * 100).toFixed(1)} %)`);
          check((await evs(page, 'bark')).length >= 1, 'grizzly: the dog gives his woof');
        }
        if (kind === 'crack') check(r.drawn.every((d) => d === 'trees' || d === 'birds') && r.drawn.includes('birds') && r.drawn.includes('trees'), `crack draws nothing but ${r.drawn.join(' and ')} (no person, no weapon, no new sprite kind)`);
        if (kind === 'wolves') check(r.drawn.includes('wolves'), 'wolves: three howling silhouettes are drawn');
        await page.evaluate((k) => { window.__ww.scene.ambient(k); window.__ww.scene.debugStep(k === 'pronghorn' ? 230 : k === 'crack' ? 100 : 210, true); }, kind);
        await shot(page, `v14-ambient-${kind}`);
        const v = await variety(page);
        check(v > 30, `ambient ${kind}: the picture is not blank (${v} colours)`);
        await page.evaluate(() => window.__ww.scene.endMiniGame());
      }
      check(errors.real().length === 0, `ambient: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }

    // ---- fetch ----
    {
      const { page, context, errors } = await open(browser, { biome: 'prairie', dog: 'brown', backdrop: 'camp', weather: 'dusk', moving: '0' });
      await page.evaluate(() => window.__ww.scene.pause());
      await clear(page);
      await page.evaluate(() => window.__ww.scene.startFetch({ seed: 5, throws: 3 }));
      await step(page, 3);
      const m0 = await dbg(page);
      check(m0.kind === 'fetch' && m0.phase === 'ready' && m0.left === 3, `startFetch: ${JSON.stringify({ kind: m0.kind, phase: m0.phase, left: m0.left })}`);
      const pulls = [0.3, 0.62, 0.95], got = [];
      for (const [i, p] of pulls.entries()) {
        const m = await dbg(page), a = m.anchor;
        await pointer(page, a.x + 4, a.y);
        await page.evaluate(([x, y]) => window.__ww.scene.debugInput('drag', x, y), [a.x + m.maxPull * p, a.y]);
        await step(page, 2);
        if (i === 1) await shot(page, 'v14-fetch-aim');
        await release(page);
        await untilN(page, 'fetchThrow', i + 1, 200);
        const th = (await evs(page, 'fetchThrow')).filter((e) => e.n === i + 1)[0];
        got.push(th && th.dist);
        const br = await page.evaluate(([i]) => window.__ww.scene.fetchBring(i === 1 ? { item: 'find', emoji: '🐴' } : { item: 'stick' }), [i]);
        if (i === 1) { await step(page, 100); await shot(page, 'v14-fetch-run'); }
        await untilN(page, i === 2 ? 'fetchEnd' : 'fetchBack', i === 2 ? 1 : i + 1, 1000);
        const evBack = (await evs(page, 'fetchBack')).length;
        await step(page, i < 2 ? 70 : 0, false);
        check(br === true && evBack >= i + 1, `fetch throw ${i + 1}: dist ${th && th.dist}, fetchBring → true, the dog came back (${evBack} fetchBack)`);
      }
      check(got[0] > 0.2 && got[0] < 0.4 && got[1] > 0.52 && got[1] < 0.72 && got[2] > 0.85 && got[0] < got[1] && got[1] < got[2], `the farther the pull, the farther the throw: dists ${got.map((g) => g && g.toFixed(2)).join(', ')} for pulls ${pulls.join(', ')}`);
      const end = await evs(page, 'fetchEnd');
      check(end.length === 1 && end[0].throws === 3 && Math.abs(end[0].best - got[2]) < 1e-9, `fetchEnd after the third return: ${JSON.stringify(end[0])}`);
      check((await page.evaluate(() => window.__ww.scene.fetchBring({ item: 'stick' }))) === false, 'fetchBring is false when the dog is not waiting');
      await step(page, 100, false);
      check((await state(page)).mini === null && (await info(page)).dog.pose === 'sit', 'after fetchEnd the scene returns to the camp, the dog by the fire');
      // the keyboard: hold Space to wind up, let go to throw
      await clear(page);
      await page.evaluate(() => window.__ww.scene.startFetch({ seed: 6, throws: 3 }));
      await step(page, 3);
      await page.evaluate(() => window.__ww.scene.debugInput('key'));
      await step(page, 40, false);
      const wd = await dbg(page);
      await page.evaluate(() => window.__ww.scene.debugInput('keyup', 'space'));
      await untilN(page, 'fetchThrow', 1, 200);
      const kt = await evs(page, 'fetchThrow');
      check(wd.phase === 'aim' && wd.power > 0.2 && kt.length === 1 && kt[0].dist > 0.2, `Space held winds up (power ${wd.power && wd.power.toFixed(2)}) and letting go throws (${JSON.stringify(kt[0])})`);
      // a tiny drag is no throw; endMiniGame leaves at once
      await page.evaluate(() => window.__ww.scene.fetchBring({ item: 'stick' })); await untilN(page, 'fetchBack', 1, 600);
      await step(page, 70, false);
      const m = await dbg(page), a = m.anchor;
      await pointer(page, a.x, a.y); await release(page); await step(page, 5, false);
      check((await dbg(page)).phase === 'ready' && (await evs(page, 'fetchThrow')).length === 1, 'a tiny pull is not a throw');
      const sum = await page.evaluate(() => window.__ww.scene.endMiniGame());
      check(sum && (await state(page)).mini === null && (await evs(page, 'fetchEnd')).length === 0, `endMiniGame() during fetch: ${JSON.stringify(sum)} and no fetchEnd`);
      check(errors.real().length === 0, `fetch: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }

    // ---- grasshoppers ----
    {
      const { page, context, errors } = await open(browser, { biome: 'prairie', moving: '0' });
      await page.evaluate(() => window.__ww.scene.pause());
      await clear(page);
      await page.evaluate(() => window.__ww.scene.startHoppers({ seed: 4, n: 5 }));
      await step(page, 90);
      await shot(page, 'v14-hoppers');
      let caught = 0, emptyTap = false;
      for (let i = 0; i < 2400 && !(await evs(page, 'hoppersEnd')).length; i++) {
        await step(page, 1, false);
        if (i % 6 !== 0) continue;
        const m = await dbg(page);
        if (!m) break;
        if (!emptyTap && i > 100) { emptyTap = true; await pointer(page, 5, 5); check((await dbg(page)).caught === caught, 'a tap on empty grass catches nothing'); }
        const h = m.hoppers.find((q) => q.state === 'wait' || q.state === 'hop');
        if (h && caught < 3) { const r = await pointer(page, h.x, h.y); if (r) caught++; }
      }
      const hp = await evs(page, 'hopper'), he = await evs(page, 'hoppersEnd');
      check(hp.length === 3 && hp.map((e) => e.caught).join() === '1,2,3' && he.length === 1 && he[0].caught === 3, `hoppers: 3 caught of 5 (hopper ${hp.map((e) => e.caught).join(',')}, hoppersEnd ${JSON.stringify(he[0])}); the rest hopped off the far edge`);
      await step(page, 200, false);
      check((await state(page)).mini === null, 'hoppers: the scene goes back to its backdrop');
      check(errors.real().length === 0, `hoppers: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }

    // ---- skipping stones: on-beat taps keep it going, off-beat taps sink it; a bonus gives free skips ----
    {
      const { page, context, errors } = await open(browser, { biome: 'prairie', backdrop: 'river', moving: '0' });
      await page.evaluate(() => window.__ww.scene.pause());
      await clear(page);
      await page.evaluate(() => window.__ww.scene.startStones({ seed: 3, throws: 3, bonus: 2 }));
      await step(page, 15);
      check((await dbg(page)).phase === 'ready', 'stones: ready to throw');
      await shot(page, 'v14-stones-ready');
      // throw 1: on every beat until 6 skips, then no tap (it sinks)
      await pointer(page, 300, 300);
      const run1 = await page.evaluate(() => { const sc = window.__ww.scene; const out = { taps: 0, skips: 0, shot: false }; for (let i = 0; i < 1500; i++) { const m = sc.debugMini(); if (!m || m.phase === 'sink' || m.phase === 'ready') break; if (m.skips >= 6) { sc.debugStep(1, false); continue; } if (m.nextKissIn != null && m.needTap && m.nextKissIn < 0.1 && m.nextKissIn > 0.04) { sc.debugInput('pointer', 1, 1); out.taps++; } sc.debugStep(1, false); } return out; });
      await step(page, 4);
      await shot(page, 'v14-stones-sunk');
      const st1 = await evs(page, 'stone'), sk1 = await evs(page, 'skip');
      check(st1.length === 1 && st1[0].throw === 1 && st1[0].skips === 6 && sk1.map((e) => e.n).join() === '1,2,3,4,5,6', `stones throw 1: the bonus gives 3 free skips and on-beat taps made 6 (${run1.taps} taps): stone ${JSON.stringify(st1[0])}`);
      await untilPhase(page, 'ready', 200); await step(page, 12, false);
      // throw 2: no tap at all: only the free skip (1, no bonus)
      await pointer(page, 300, 300);
      await page.evaluate(() => { const sc = window.__ww.scene; for (let i = 0; i < 1500 && window.__ww.events.filter((e) => e.type === 'stone').length < 2; i++) sc.debugStep(1, false); });
      const st2 = (await evs(page, 'stone'))[1];
      check(st2 && st2.throw === 2 && st2.skips === 1, `stones throw 2: no taps, just the free skip: ${JSON.stringify(st2)}`);
      await untilPhase(page, 'ready', 200); await step(page, 12, false);
      // throw 3: tap 0.35 s too early (outside the ±180 ms window): it does not count; then the stone sinks
      await pointer(page, 300, 300);
      await page.evaluate(() => { const sc = window.__ww.scene; let tapped = false; for (let i = 0; i < 1500 && window.__ww.events.filter((e) => e.type === 'stone').length < 3; i++) { const m = sc.debugMini(); if (m && m.needTap && m.nextKissIn != null && m.nextKissIn < 0.5 && m.nextKissIn > 0.3 && !tapped) { sc.debugInput('pointer', 1, 1); tapped = true; } sc.debugStep(1, false); } });
      const st3 = (await evs(page, 'stone'))[2];
      check(st3 && st3.throw === 3 && st3.skips === 1, `stones throw 3: a tap outside the window does not count: ${JSON.stringify(st3)}`);
      await untilEvent(page, 'stonesEnd', 600);
      const se = await evs(page, 'stonesEnd');
      check(se.length === 1 && se[0].throws.join() === '6,1,1' && se[0].best === 6, `stonesEnd ${JSON.stringify(se[0])}`);
      await step(page, 200, false);
      check((await state(page)).mini === null, 'stones: the scene goes back to its backdrop');
      // a late tap inside the dip still counts (the window is ±180 ms)
      await clear(page);
      await page.evaluate(() => window.__ww.scene.startStones({ seed: 3, throws: 1, bonus: 0 }));
      await step(page, 15); await pointer(page, 300, 300);
      const late = await page.evaluate(() => { const sc = window.__ww.scene; for (let i = 0; i < 400; i++) { const m = sc.debugMini(); if (m.phase === 'dip') { sc.debugStep(6, false); sc.debugInput('pointer', 1, 1); sc.debugStep(2, false); return sc.debugMini().skips; } sc.debugStep(1, false); } return -1; });
      check(late >= 2, `a tap 100 ms after the stone touched still keeps it skipping (${late} skips)`);
      await page.evaluate(() => window.__ww.scene.endMiniGame());
      check(errors.real().length === 0, `stones: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }

    // ---- falling stars ----
    {
      const { page, context, errors } = await open(browser, { biome: 'prairie', backdrop: 'camp', moving: '0' });
      await page.evaluate(() => window.__ww.scene.pause());
      await clear(page);
      await page.evaluate(() => window.__ww.scene.startMeteors({ seed: 2, n: 8 }));
      await step(page, 200);
      await shot(page, 'v14-meteors');
      const r = await page.evaluate(() => { const sc = window.__ww.scene; const out = { wished: 0, empty: 0, frames: 0 }; for (let i = 0; i < 60 * 40 && !window.__ww.events.some((e) => e.type === 'meteorsEnd'); i++) { sc.debugStep(1, false); out.frames++; const m = sc.debugMini(); if (!m) break; if (m.stars.length && out.wished < 4 && i % 7 === 0) { if (sc.debugInput('pointer', m.stars[0].x, m.stars[0].y)) out.wished++; } if (i === 500 || i === 900) { const before = (sc.debugMini() || {}).tapped; sc.debugInput('pointer', 4, 4); if ((sc.debugMini() || {}).tapped !== before) out.empty++; } } return out; });
      const mt = await evs(page, 'meteor'), me = await evs(page, 'meteorsEnd');
      check(mt.length === 4 && mt.map((e) => e.n).join() === '1,2,3,4' && me.length === 1 && me[0].tapped === 4 && me[0].of === 8 && r.empty === 0, `falling stars: 4 wishes of 8 (meteor ${mt.map((e) => e.n).join(',')}, meteorsEnd ${JSON.stringify(me[0])}, empty-sky taps ${r.empty})`);
      check(r.frames + 200 > 60 * 17 && r.frames + 200 < 60 * 30, `eight stars in about 20 s (${((r.frames + 200) / 60).toFixed(1)} s)`);
      await step(page, 250, false);
      check((await state(page)).mini === null, 'meteors: the scene goes back to the camp');
      check(errors.real().length === 0, `meteors: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }

    // ---- the dust devil ----
    {
      const { page, context, errors } = await open(browser, { biome: 'highdesert', dog: 'brown', moving: '0' });
      await page.evaluate(() => window.__ww.scene.pause());
      const hats = await page.evaluate(() => { const i = window.__ww.scene.debugInfo(); return [{ id: 'blacksmith', hat: 'cap', color: '#d9534f' }, { id: 'scout', hat: 'wide', color: '#5b8c5a' }, { id: 'cook', hat: 'bonnet', color: '#f0a500' }, { id: 'me', hat: 'straw', color: '#d9534f' }]; });
      for (const mode of ['all', 'none']) {
        await clear(page);
        await page.evaluate((h) => window.__ww.scene.startDustDevil({ seed: 8, hats: h }), hats);
        const r = await page.evaluate((mode) => { const sc = window.__ww.scene; const out = { caught: 0, minT: 9, airMax: 0, hidden: 0 }; for (let i = 0; i < 60 * 20 && !window.__ww.events.some((e) => e.type === 'dustDevilEnd'); i++) { sc.debugStep(1, false); const m = sc.debugMini(); if (!m) break; for (const h of m.hats) { if (h.state === 'air') { out.minT = Math.min(out.minT, h.T); if (mode === 'all' && i % 4 === 0) { if (sc.debugInput('pointer', h.x, h.y)) out.caught++; } } } } return out; }, mode);
        const ht = await evs(page, 'hat'), de = await evs(page, 'dustDevilEnd');
        if (mode === 'all') check(ht.length === 4 && ht.every((e) => e.caught === true) && de.length === 1 && de[0].caught === 4 && de[0].of === 4 && r.minT >= 1.4, `dust devil, every hat caught: ${JSON.stringify(de[0])} (each hat ≥ ${r.minT.toFixed(1)} s in reach, ${ht.length} hat events)`);
        else check(ht.length === 4 && ht.every((e) => e.caught === false) && de[0].caught === 0 && de[0].of === 4, `dust devil, no hat caught: ${JSON.stringify(de[0])} (${ht.length} hats landed)`);
        if (mode === 'all') { await page.evaluate((h) => { window.__ww.scene.startDustDevil({ seed: 8, hats: h }); window.__ww.scene.debugStep(150, true); }, hats); await shot(page, 'v14-dustdevil'); await page.evaluate(() => window.__ww.scene.endMiniGame()); }
        await step(page, 200, false);
        check((await state(page)).mini === null, `dust devil (${mode}): the scene goes back to the trail`);
      }
      check((await cues(page)).includes('whoosh'), `the dust devil's sound cue is sent ('whoosh')`);
      check(errors.real().length === 0, `dust devil: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }

    // ---- fishing 2.0: the fight, the wobble that shows yellow then red, the sturgeon's second tap, junk, a missed dip, the dog's cameo ----
    {
      const { page, context, errors } = await open(browser, { biome: 'prairie', dog: 'brown', moving: '0' });
      await page.evaluate(() => window.__ww.scene.pause());
      const helper = { id: 'scout', hat: 'wide', color: '#5b8c5a' };
      // 1. a cast hooked and landed by releasing on the red; the yellow comes before the red
      await clear(page);
      const s1 = await session(page, { seed: 11, water: 'platte', casts: 4, junkAt: 3 });
      await page.evaluate(([s, h]) => window.__ww.scene.startFishing({ seed: 11, water: 'platte', bait: 'worms', casts: s.casts, cameo: null, helper: h, dog: true }), [s1, helper]);
      await step(page, 3);
      const st0 = await dbg(page);
      check(st0.kind === 'fishing' && st0.cast === 1 && st0.phase === 'cast', `startFishing: ${JSON.stringify({ kind: st0.kind, cast: st0.cast, phase: st0.phase })}`);
      await untilPhase(page, 'bite', 1500);
      await step(page, 4); await shot(page, 'v14-fishing-dip');
      await pointer(page, 300, 300);
      const f1 = await playFight(page, 'land');
      await step(page, 2);
      const e1 = await page.evaluate(() => window.__ww.events.filter((e) => e.type !== 'sfx').map((e) => e.type + (e.phase ? ':' + e.phase : '')));
      check(f1.end === 'land' && f1.sawWarn && f1.sawWobble && f1.warnBefore && f1.firstWarnAt < f1.firstWobbleAt && !e1.includes('fishOff'), `fight 1: the yellow shiver came ${((f1.firstWobbleAt - f1.firstWarnAt) / 60).toFixed(2)} s before the first red, released on the red → landed (${e1.join(' ')})`);
      check(['fishHook', 'fishPhase:reel', 'fishPhase:landed', 'fishLand'].every((x) => e1.includes(x)), 'fight 1 events: fishHook, fishPhase reel, fishPhase landed, fishLand');
      await shot(page, 'v14-fishing-landed');
      const cu = await cues(page);
      check(['splash', 'reel', 'wobble'].every((c) => cu.includes(c)), `fishing sound cues sent (${cu.join(', ')})`);
      // 2. a cast held through the red goes 'off', the app's retry runs it once more, a second retry is refused
      await untilPhase(page, 'cast', 400); await clear(page);
      await untilPhase(page, 'bite', 1500); await pointer(page, 300, 300);
      const f2 = await playFight(page, 'off');
      await step(page, 1);
      const offEv = await evs(page, 'fishOff');
      check(f2.end === 'off' && offEv.length === 1 && offEv[0].i === 1, `fight 2: held through the red → the fish wiggles off (${JSON.stringify(offEv[0])})`);
      await shot(page, 'v14-fishing-off');
      const fresh = await page.evaluate(async () => { const m = await import('/wagon-west/src/scene/devSession.js'); const r = Math.random; return m.devSession({ seed: 99, water: 'platte', casts: 1 }).casts[0].fight; });
      const ok1 = await page.evaluate((f) => window.__ww.scene.fishingRetry(1, f), fresh);
      const ok2 = await page.evaluate((f) => window.__ww.scene.fishingRetry(1, f), fresh);
      const wrong = await page.evaluate((f) => window.__ww.scene.fishingRetry(0, f), fresh);
      check(ok1 === true && ok2 === false && wrong === false, `fishingRetry(i, fight): true once, then false (${ok1}, ${ok2}); wrong cast → ${wrong}`);
      await untilPhase(page, 'cast', 300);
      check((await dbg(page)).cast === 2, 'the retried cast is the same cast again (not a new one)');
      await untilPhase(page, 'bite', 1500); await pointer(page, 300, 300);
      const f2b = await playFight(page, 'land');
      check(f2b.end === 'land', 'the retried cast can be landed');
      // 3. a missed dip uses the cast
      await clear(page);
      await untilPhase(page, 'cast', 400);
      await untilPhase(page, 'bite', 1500);
      await untilPhase(page, 'away', 200);
      await step(page, 2);
      const miss = await evs(page, 'fishMiss');
      check(miss.length === 1, `a missed dip: fishMiss ${JSON.stringify(miss[0])}`);
      await shot(page, 'v14-fishing-miss');
      // 4. the junk cast (boot): reels in with no wobbles, no 'off'
      await clear(page);
      await untilPhase(page, 'cast', 400); await untilPhase(page, 'bite', 1500); await pointer(page, 300, 300);
      const fj = await playFight(page, 'off');
      const jm = await dbg(page);
      check(fj.end === 'land' && !fj.sawWobble && !fj.sawWarn && jm.junk === 'boot', `junk cast: the boot reels in with no wobbles even when held throughout (${fj.end}, junk ${jm.junk})`);
      await shot(page, 'v14-fishing-boot');
      await untilEvent(page, 'fishingEnd', 600);
      const fe = await evs(page, 'fishingEnd');
      check(fe.length === 1 && fe[0].casts === 4 && fe[0].landed >= 3, `fishingEnd ${JSON.stringify(fe[0])}`);
      await step(page, 120, false);
      check((await state(page)).mini === null, 'fishing: the scene goes back to its backdrop');
      // 5. the sturgeon takes two: the fight stops at the help phase until the second tap
      await clear(page);
      const s5 = await session(page, { seed: 21, water: 'snake', casts: 1, forceSpecies: 'white-sturgeon' });
      await page.evaluate(([s, h]) => window.__ww.scene.startFishing({ seed: 21, water: 'snake', bait: 'worms', casts: s.casts, helper: h, dog: true }), [s5, helper]);
      await untilPhase(page, 'bite', 1500); await pointer(page, 300, 300);
      const f5 = await playFight(page, 'land');
      check(f5.end === 'help', `the sturgeon: the reel holds at the help phase (${f5.end})`);
      await step(page, 30); await shot(page, 'v14-fishing-help');
      const hlp0 = await dbg(page);
      const prog0 = hlp0.progress;
      await pointer(page, 300, 300); await step(page, 20, false); await release(page);   // a plain hold does not move it on? (a tap IS the help)
      const helped = (await evs(page, 'fishHelped')).length;
      check((await evs(page, 'fishHelp')).length === 1 && helped === 1, `the sturgeon: fishHelp then, on a tap, fishHelped (${helped})`);
      check(Math.abs(prog0 - 0.5) < 0.02, `the sturgeon stops half way in (progress ${prog0.toFixed(2)})`);
      const f5b = await playFight(page, 'land');
      check(f5b.end === 'land', 'the sturgeon is landed after the second tap');
      // the scripted hook: fishingHelp() also works from outside the canvas
      await clear(page);
      await untilEvent(page, 'fishingEnd', 600);
      await page.evaluate(([s, h]) => window.__ww.scene.startFishing({ seed: 22, water: 'snake', bait: 'worms', casts: s.casts, helper: null, dog: true }), [s5, helper]);
      await untilPhase(page, 'bite', 1500); await pointer(page, 300, 300);
      const f5c = await playFight(page, 'land');
      const hp = await page.evaluate(() => window.__ww.scene.fishingHelp());
      const hp2 = await page.evaluate(() => window.__ww.scene.fishingHelp());
      check(f5c.end === 'help' && hp === true && hp2 === false, `fishingHelp() answers the help phase (no companion: the dog helps): ${hp}, then ${hp2}`);
      await page.evaluate(() => window.__ww.scene.endMiniGame());
      // 6. the dog's cameo: a splash (the cast is reset) and a steal (after the landing)
      for (const kind of ['splash', 'steal']) {
        await clear(page);
        const s6 = await session(page, { seed: 31, water: 'platte', casts: 3 });
        await page.evaluate(([s, kind]) => window.__ww.scene.startFishing({ seed: 31, water: 'platte', casts: s.casts, cameo: { at: 1, kind }, dog: true }), [s6, kind]);
        for (let i = 0; i < 3; i++) {
          const r = await page.evaluate(() => { const sc = window.__ww.scene; for (let n = 0; n < 2500; n++) { const m = sc.debugMini(); if (!m) return 'gone'; if (m.phase === 'bite') return 'bite'; sc.debugStep(1, false); } return 'timeout'; });
          if (r !== 'bite') break;
          await pointer(page, 300, 300);
          await playFight(page, 'land');
          if (kind === 'steal' && i === 1) { await untilPhase(page, 'steal', 200); await step(page, 40); await shot(page, 'v14-fishing-steal'); }
        }
        await untilEvent(page, 'fishingEnd', 1500);
        const cm = await evs(page, 'fishCameo'), fe2 = await evs(page, 'fishingEnd');
        check(cm.length === 1 && cm[0].kind === kind && cm[0].i === 1 && fe2.length === 1 && fe2[0].landed === 3, `dog cameo (${kind}): one fishCameo at cast 1, nothing lost (${JSON.stringify(cm[0])}, ${JSON.stringify(fe2[0])})`);
        await step(page, 150, false);
      }
      check(errors.real().length === 0, `fishing: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }

    // ---- keyboard fishing: Space down reels, Space up lets go, Enter calls the help ----
    {
      const { page, context, errors } = await open(browser, { biome: 'prairie', moving: '0', dog: 'brown' });
      const s = await session(page, { seed: 41, water: 'snake', casts: 1, forceSpecies: 'white-sturgeon' });
      await page.evaluate((s) => { window.__ww.scene.pause(); window.__ww.scene.startFishing({ seed: 41, water: 'snake', casts: s.casts, helper: { id: 'cook', hat: 'bonnet', color: '#f0a500' }, dog: false }); }, s);
      await untilPhase(page, 'bite', 1500);
      await page.evaluate(() => window.__ww.scene.debugInput('key'));     // Space down: hooks and holds
      await step(page, 30, false);
      const p1 = (await dbg(page)).progress;
      await page.evaluate(() => window.__ww.scene.debugInput('keyup', 'space'));
      await step(page, 30, false);
      const p2 = (await dbg(page)).progress;
      check(p1 > 0.05 && p2 < p1, `Space held reels (${p1.toFixed(2)}), Space released lets the fish pull back (${p2.toFixed(2)})`);
      await page.evaluate(() => window.__ww.scene.endMiniGame());
      check(errors.real().length === 0, `keyboard fishing: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }

    // ---- reduced motion: each new scene runs and ends or can be left ----
    {
      const { page, context, errors } = await open(browser, { biome: 'prairie', dog: 'brown', rm: '1', moving: '1' });
      await page.evaluate(() => window.__ww.scene.pause());
      check((await state(page)).reducedMotion === true, 'reduced motion is on');
      const rmEnd = [['dogRun', () => window.__ww.scene.dogRun('find', { emoji: '🪶' }), 'dogBack'], ['dogWarn', () => window.__ww.scene.dogWarn(), 'dogWarnEnd'], ['chase', () => window.__ww.scene.startChase({ seed: 2 }), 'chaseEnd'], ['ambient grizzly', () => window.__ww.scene.ambient('grizzly'), 'ambientEnd'], ['ambient crack', () => window.__ww.scene.ambient('crack'), 'ambientEnd'], ['ambient pronghorn', () => window.__ww.scene.ambient('pronghorn'), 'ambientEnd'], ['dust devil', () => window.__ww.scene.startDustDevil({ seed: 3, hats: [{ id: 'blacksmith', hat: 'cap', color: '#d9534f' }, { id: 'me', hat: 'wide', color: '#5b8c5a' }] }), 'dustDevilEnd']];
      for (const [name, start, end] of rmEnd) {
        await clear(page);
        await page.evaluate(start);
        const n = await untilEvent(page, end, 3000);
        check(n > 0, `reduced motion: ${name} runs to ${end} (${n} frames)`);
        await step(page, 160, false);
      }
      for (const [name, start] of [['fetch', () => window.__ww.scene.startFetch({ seed: 2 })], ['hoppers', () => window.__ww.scene.startHoppers({ seed: 2, n: 4 })], ['stones', () => window.__ww.scene.startStones({ seed: 2 })], ['meteors', () => window.__ww.scene.startMeteors({ seed: 2 })], ['fishing', () => window.__ww.scene.startFishing({ seed: 2, water: 'columbia', casts: 2, dog: true })]]) {
        await page.evaluate(start);
        await step(page, 240, true);
        await shot(page, `v14-rm-${name}`);
        const m = await dbg(page);
        check(m && m.kind.length > 0, `reduced motion: ${name} runs (${m && m.kind})`);
        await page.evaluate(() => window.__ww.scene.endMiniGame());
      }
      check(errors.real().length === 0, `reduced motion (v1.4): no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }

    // ---- portrait: every new scene draws at 390x844 ----
    {
      const { page, context, errors } = await open(browser, { biome: 'prairie', dog: 'brown', moving: '0' }, { width: 390, height: 844 });
      await page.evaluate(() => window.__ww.scene.pause());
      for (const [name, start, frames] of [['fetch', () => { window.__ww.scene.setBackdrop('camp'); window.__ww.scene.startFetch({ seed: 2 }); }, 30], ['stones', () => window.__ww.scene.startStones({ seed: 2 }), 30], ['hoppers', () => window.__ww.scene.startHoppers({ seed: 2, n: 4 }), 120], ['fishing', () => window.__ww.scene.startFishing({ seed: 2, water: 'creek', casts: 2, dog: true }), 150], ['grizzly', () => window.__ww.scene.ambient('grizzly'), 150]]) {
        await page.evaluate(start);
        await step(page, frames, true);
        await shot(page, `v14-portrait-${name}`);
        check((await variety(page)) > 25, `portrait ${name}: the picture is not blank`);
        await page.evaluate(() => { window.__ww.scene.endMiniGame(); window.__ww.scene.setBackdrop('trail'); });
      }
      check(errors.real().length === 0, `portrait (v1.4): no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }

    // ---- the mock scene: the same API, scripted, the same event sequences ----
    {
      const { page, context, errors } = await open(browser, { mock: '1', biome: 'prairie', dog: 'brown', moving: '0' }, { width: 422, height: 195 });  // the mock's own drawing is slow at full size
      const mockApi = await API_MISS(page);
      check(mockApi.length === 0 && (await state(page)).mock === true, `the mock scene has the v1.4 API (missing: ${mockApi.join(',') || 'none'})`);
      const run = async (script, start, endType, wait = 30000) => {
        await page.evaluate((s) => { window.__mockScript = { shotMs: 25, ...s }; window.__ww.events.length = 0; }, script);
        await page.evaluate(start);
        await page.waitForFunction((t) => window.__ww.events.some((e) => e.type === t), endType, { timeout: wait });
        return page.evaluate(() => window.__ww.events.filter((e) => e.type !== 'ready' && e.type !== 'sfx').map((e) => { const { at, ...r } = e; return r; }));
      };
      const j = (a) => JSON.stringify(a);
      let ev = await run({ hunt: ['still', 'lead', 'miss', 'lead-miss', 'lead'] }, () => window.__ww.scene.startHunt({ seed: 1, shots: 5 }), 'huntEnd');
      check(j(ev.filter((e) => e.type === 'hunt').map((e) => [e.hit, e.lead])) === j([[true, false], [true, true], [false, false], [false, false], [true, true]]) && ev[ev.length - 1].hits === 3, `mock hunt script: still hit, lead hit, miss, lead miss, lead hit → ${j(ev.filter((e) => e.type === 'hunt').map((e) => [e.hit, e.lead]))}`);
      ev = await run({}, () => window.__ww.scene.startHunt({ seed: 1, shots: 4 }), 'huntEnd');
      check(ev.filter((e) => e.type === 'hunt').every((e) => 'lead' in e && e.lead === false), 'mock hunt without a script: the old alternation, lead: false');
      ev = await run({}, () => window.__ww.scene.dogRun('find', { emoji: '🪶' }), 'dogBack'); check(j(ev) === j([{ type: 'dogBack', kind: 'find' }]), `mock dogRun → ${j(ev)}`);
      ev = await run({}, () => window.__ww.scene.dogWarn(), 'dogWarnEnd'); check(j(ev) === j([{ type: 'dogWarnEnd' }]), `mock dogWarn → ${j(ev)}`);
      ev = await run({}, () => window.__ww.scene.ambient('wolves'), 'ambientEnd'); check(j(ev) === j([{ type: 'ambientEnd', kind: 'wolves' }]), `mock ambient → ${j(ev)}`);
      ev = await run({}, () => { window.__ww.scene.startChase({ seed: 1 }); setTimeout(() => window.__ww.scene.chaseCall(), 5); }, 'chaseEnd'); check(j(ev) === j([{ type: 'chase', dist: 0.4 }, { type: 'chaseEnd', called: true, dist: 0.4 }]), `mock chase 'call' → ${j(ev)}`);
      ev = await run({}, () => window.__ww.scene.startChase({ seed: 1 }), 'chaseEnd'); check(j(ev) === j([{ type: 'chaseEnd', called: false, dist: 1 }]), `mock chase, no call → ${j(ev)}`);
      ev = await run({ chase: 'late' }, () => { window.__ww.scene.startChase({ seed: 1 }); setTimeout(() => window.__ww.scene.chaseCall(), 5); }, 'chaseEnd'); check(j(ev) === j([{ type: 'chaseEnd', called: false, dist: 1 }]), `mock chase 'late' (the call comes too late) → ${j(ev)}`);
      ev = await run({}, () => { const sc = window.__ww.scene; sc.startFetch({ seed: 1, throws: 3 }); window.__fetchTimer = setInterval(() => sc.fetchBring(), 10); }, 'fetchEnd'); await page.evaluate(() => clearInterval(window.__fetchTimer));
      check(j(ev.filter((e) => e.type === 'fetchThrow').map((e) => e.dist)) === j([0.2, 0.5, 0.9]) && ev.filter((e) => e.type === 'fetchBack').length === 3 && ev[ev.length - 1].best === 0.9 && ev[ev.length - 1].throws === 3, `mock fetch: throws 0.2, 0.5, 0.9, three returns, fetchEnd ${j(ev[ev.length - 1])}`);
      ev = await run({}, () => window.__ww.scene.startHoppers({ seed: 1, n: 6 }), 'hoppersEnd'); check(j(ev.filter((e) => e.type === 'hopper').map((e) => e.caught)) === '[1,2,3,4]' && ev[ev.length - 1].caught === 4, `mock hoppers (default 4) → ${j(ev.map((e) => e.caught))}`);
      ev = await run({ stones: [3, 5, 2] }, () => window.__ww.scene.startStones({ seed: 1, throws: 3, bonus: 2 }), 'stonesEnd'); check(j(ev[ev.length - 1]) === j({ type: 'stonesEnd', throws: [5, 5, 2], best: 5 }) && ev.filter((e) => e.type === 'skip').length === 12, `mock stones [3,5,2] with a bonus of 2 → ${j(ev[ev.length - 1])}`);
      ev = await run({}, () => window.__ww.scene.startMeteors({ seed: 1, n: 8 }), 'meteorsEnd'); check(j(ev[ev.length - 1]) === j({ type: 'meteorsEnd', tapped: 5, of: 8 }) && ev.filter((e) => e.type === 'meteor').length === 5, `mock meteors (default 5 of 8) → ${j(ev[ev.length - 1])}`);
      const hatList = [{ id: 'a', hat: 'cap', color: '#d9534f' }, { id: 'b', hat: 'wide', color: '#5b8c5a' }, { id: 'c', hat: 'none', color: '#000' }, { id: 'me', hat: 'straw', color: '#d9534f' }];
      await page.evaluate((h) => { window.__hatList = h; }, hatList);
      ev = await run({ hats: 'all' }, () => window.__ww.scene.startDustDevil({ seed: 1, hats: window.__hatList }), 'dustDevilEnd'); check(j(ev[ev.length - 1]) === j({ type: 'dustDevilEnd', caught: 3, of: 3 }) && ev.filter((e) => e.type === 'hat' && e.caught).length === 3, `mock dust devil, all hats (the 'none' hat is not a hat) → ${j(ev[ev.length - 1])}`);
      ev = await run({ hats: 1 }, () => window.__ww.scene.startDustDevil({ seed: 1, hats: window.__hatList }), 'dustDevilEnd'); check(j(ev.filter((e) => e.type === 'hat').map((e) => e.caught)) === '[true,false,false]' && ev[ev.length - 1].caught === 1, `mock dust devil, 1 hat → ${j(ev.map((e) => e.caught))}`);
      // fishing: land, off (+ the retry), help, a missed dip: the mock runs the real stepper
      const sess = await session(page, { seed: 5, water: 'snake', casts: 4, forceSpecies: 'white-sturgeon' });
      await page.evaluate((s) => { window.__fs = s; }, sess);
      await page.evaluate(() => { window.__mockScript = { shotMs: 25, fishing: [{ fight: 'land' }, { fight: 'off' }, { fight: 'help' }, { hook: false }] }; window.__ww.events.length = 0; const sc = window.__ww.scene; sc.startFishing({ seed: 5, water: 'snake', casts: window.__fs.casts, helper: null, dog: true }); window.__fishTimer = setInterval(() => { sc.fishingHelp(); }, 10); });
      // the second cast goes off: the app retries once with a fresh fight, which lands
      const fresh = await session(page, { seed: 77, water: 'snake', casts: 1, forceSpecies: 'cutthroat-trout' });
      await page.evaluate((f) => { window.__fresh = f.casts[0].fight; const sc = window.__ww.scene; window.__retryTimer = setInterval(() => { window.__ww.events.some((e) => e.type === 'fishOff') && sc.fishingRetry(1, window.__fresh); }, 5); }, fresh);
      await page.waitForFunction(() => window.__ww.events.some((e) => e.type === 'fishingEnd'), null, { timeout: 30000 });
      ev = await page.evaluate(() => { clearInterval(window.__fishTimer); clearInterval(window.__retryTimer); return window.__ww.events.filter((e) => e.type !== 'ready' && e.type !== 'sfx').map((e) => e.type + (e.phase ? ':' + e.phase : '') + (e.i != null ? '#' + e.i : '')); });
      ev = ev.filter((e) => !/^(fishHelp|fishHelped|fishPhase:help)#0$/.test(e));   // the first (sturgeon) cast takes the help tap
      const want = ['fishHook#0', 'fishPhase:reel#0', 'fishPhase:landed#0', 'fishLand#0', 'fishHook#1', 'fishPhase:reel#1', 'fishPhase:off#1', 'fishOff#1', 'fishHook#1', 'fishPhase:landed#1', 'fishLand#1'];
      check(want.every((w, i) => ev[i] === w), `mock fishing: land, off + retry: ${ev.slice(0, 11).join(' ')}`);
      check(ev.includes('fishHelp#2') && ev.includes('fishHelped#2') && ev.includes('fishLand#2') && ev.includes('fishMiss#3') && ev[ev.length - 1].startsWith('fishingEnd'), `mock fishing: the help phase waits for fishingHelp(), a missed dip, fishingEnd (${ev.slice(11).join(' ')})`);
      check(errors.real().length === 0, `mock scene (v1.4): no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }
  }

  // ---- 13. v1.5 (The Long Trail): five biomes, 26 paintings, the dry stretch, decorations, gold, Laurel Hill, the voyage, the farm, the forks ----
  if (!process.env.PERF_ONLY && !process.env.V14_ONLY && !process.env.V16_ONLY) {
    const PORTRAIT = { width: 390, height: 844 }, LAND = { width: 844, height: 390 }, BIG = { width: 1280, height: 800 };
    const NEW_BIOMES = ['basin', 'sierra', 'siskiyou', 'goldcountry', 'sea'];
    const NEW_BACKDROPS = ['homestead', 'diggings', 'sea', 'fork'];
    const API_15 = ['startPan', 'panReveal', 'startRocker', 'rockerReveal', 'startSnub', 'startSail', 'sailGo', 'setHomestead', 'buildPiece', 'setFork', 'endMiniGame'];
    const dbg = (page) => page.evaluate(() => window.__ww.scene.debugMini());
    const inp = (page, k, a, b) => page.evaluate(([k, a, b]) => window.__ww.scene.debugInput(k, a, b), [k, a, b]);
    const clearEv = (page) => page.evaluate(() => { window.__ww.events.length = 0; });
    const evs = (page, t) => page.evaluate((t) => window.__ww.events.filter((e) => e.type === t), t);
    const mini = (page) => page.evaluate(() => window.__ww.scene.getState().mini);
    const pause = (page) => page.evaluate(() => window.__ww.scene.pause());
    const J = (a) => JSON.stringify(a);
    // Space held down / let go (the scene must be running to hear the keys)
    const spaceHold = async (page, down) => { await page.evaluate(() => window.__ww.scene.play()); await (down ? page.keyboard.down('Space') : page.keyboard.up('Space')); await page.evaluate(() => window.__ww.scene.pause()); };
    // content, read in node: every leg, route and piece the scene has to draw
    const { ALL_LEGS } = await import('../src/content/legs.js');
    const { ROUTES, FORKS } = await import('../src/content/routes.js');
    const { HOMESTEAD_PIECES } = await import('../src/content/homestead.js');
    const { DECOR } = await import('../src/content/cards.js');
    const bd = await import('../src/scene/backdrops.js');
    const biomesMod = await import('../src/scene/biomes.js');
    const hs = await import('../src/scene/homestead.js');

    // ---- the contract, without a browser: names, ids, every leg of every plan has a painting other than 'generic'
    {
      check(NEW_BIOMES.every((b) => biomesMod.BIOME_IDS.includes(b)) && biomesMod.BIOME_IDS.length === 11, `BIOME_IDS has the five new biomes (${biomesMod.BIOME_IDS.length})`);
      check(NEW_BACKDROPS.every((b) => bd.BACKDROPS.includes(b)), `BACKDROPS has ${NEW_BACKDROPS.join(', ')}`);
      const ids = new Set(); for (const r of Object.values(ROUTES)) for (const st of r.steps) { if (typeof st === 'string') ids.add(st); else if (st.leg) ids.add(st.leg); }
      for (const f of Object.values(FORKS)) for (const o of f.options) for (const st of o.steps) { if (typeof st === 'string') ids.add(st); else if (st.leg) ids.add(st.leg); }
      const legById = Object.fromEntries(ALL_LEGS.map((l) => [l.id, l]));
      const bad = [...ids].filter((id) => !legById[id] || bd.paintingFor(legById[id]) === 'generic' || bd.paintingFor(id) === 'generic');
      check(ids.size >= 40 && bad.length === 0, `every leg id of every plan (${ids.size}) resolves to a painting other than 'generic', by the leg and by its id alone (bad: ${bad.join(',') || 'none'})`);
      const wrong = ALL_LEGS.filter((l) => l.painting && !bd.PAINTING_IDS.includes(l.painting));
      check(wrong.length === 0, `every leg.painting is a painting the scene has (missing: ${wrong.map((l) => l.painting).join(',') || 'none'}; ${bd.PAINTING_IDS.length} paintings in all)`);
      const diff = ALL_LEGS.filter((l) => l.painting && bd.paintingFor(l) !== l.painting);
      check(diff.length === 0, `paintingFor(leg) reads leg.painting first (${diff.map((l) => l.id).join(',') || 'all 45 legs agree'})`);
      const slotBad = HOMESTEAD_PIECES.filter((p) => hs.PIECE_SLOT[p.id] !== p.slot || (hs.PIECE_MAX[p.id] || 1) !== p.max);
      check(slotBad.length === 0, `the scene's piece slots and counts agree with content/homestead.js (${slotBad.map((p) => p.id).join(',') || 'all ' + HOMESTEAD_PIECES.length + ' pieces'})`);
      check(hs.HOME_SLOTS.join() === 'edge,orchard,barn,house,yard,garden,creek,pasture,gate', 'the slots run left to right as the contract says');
      check(DECOR.length === 16, `the 16 decorations of content/cards.js (${DECOR.length})`);
    }

    // ---- API, five biomes x the backdrops, landscape and portrait (and a wide screen) ----
    {
      const { page, context, errors } = await open(browser, { moving: '0' });
      const miss = await page.evaluate((n) => n.filter((k) => typeof window.__ww.scene[k] !== 'function'), API_15);
      check(miss.length === 0, `the scene has the v1.5 API (missing: ${miss.join(',') || 'none'})`);
      await context.close();
    }
    for (const [tag, vp] of [['land', LAND], ['port', PORTRAIT], ['wide', BIG]]) {
      const { page, context, errors } = await open(browser, { moving: '0' }, vp);
      await pause(page);
      let minVar = 1e9, worst = '';
      const cases = [];
      for (const b of NEW_BIOMES) for (const d of ['trail', 'landmark', 'fort', 'river', 'camp']) cases.push([b, d]);
      cases.push(['goldcountry', 'diggings'], ['sea', 'sea'], ['goldcountry', 'homestead'], ['valley', 'homestead'], ['prairie', 'fork']);
      for (const [biome, backdrop] of cases) {
        await page.evaluate(([biome, backdrop]) => { const sc = window.__ww.scene; sc.setLeg({ id: 'chimney-rock', biome, miles: 160, stop: { kind: 'landmark' } }); sc.setBackdrop(backdrop); }, [biome, backdrop]);
        await step(page, 40);
        const v = await variety(page); if (v < minVar) { minVar = v; worst = `${biome}/${backdrop}`; }
        const s = await state(page);
        if (s.backdrop !== backdrop || s.biome !== biome) check(false, `${tag} ${biome}/${backdrop}: state says ${s.biome}/${s.backdrop}`);
        if (backdrop === 'trail' || backdrop === 'diggings' || backdrop === 'sea') await shot(page, `v15-${tag}-${biome}-${backdrop}`);
      }
      check(minVar >= 12, `${tag} (${vp.width}x${vp.height}): all ${cases.length} new biome x backdrop frames are drawn, not blank (fewest colours ${minVar} at ${worst})`);
      check(errors.real().length === 0, `${tag}: new biomes x backdrops: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }

    // ---- the paintings: every new leg's painting, by the leg object, in both layouts ----
    for (const [tag, vp] of [['land', LAND], ['port', PORTRAIT]]) {
      const { page, context, errors } = await open(browser, { moving: '0' }, vp);
      await pause(page);
      const NEW = ALL_LEGS.filter((l) => l.painting && !['chimney', 'independence', 'southpass', 'soda', 'bluemtns', 'gorge', 'homestead', 'river', 'fort'].includes(l.painting) && !['kansas-river', 'fort-kearny', 'chimney-rock', 'fort-laramie', 'north-platte', 'independence-rock', 'south-pass', 'green-river', 'fort-bridger', 'soda-springs', 'fort-hall', 'snake-river', 'blue-mountains', 'the-dalles', 'willamette-valley'].includes(l.id));
      let minVar = 1e9, worst = '', wrongP = [];
      const seen = new Set();
      for (const leg of NEW) {
        const kind = leg.stop && leg.stop.kind;
        const backdrop = kind === 'fort' ? 'fort' : kind === 'home' ? 'valley' : 'landmark';
        await page.evaluate(([leg, bdn]) => { const sc = window.__ww.scene; sc.setLeg({ id: leg.id, biome: leg.biome, miles: leg.miles, stop: leg.stop, river: leg.river, painting: leg.painting }); sc.setBackdrop(bdn); }, [leg, backdrop]);
        await step(page, 30);
        const v = await variety(page); if (v < minVar) { minVar = v; worst = leg.id; }
        const i = await info(page);
        const want = backdrop === 'landmark' || backdrop === 'valley' ? leg.painting : null;
        if (want && i.painting !== want) wrongP.push(`${leg.id}:${i.painting}`);
        seen.add(leg.painting);
        if (tag === 'land') await shot(page, `v15-painting-${leg.id}`);
      }
      check(NEW.length >= 24 && minVar >= 12, `${tag}: ${NEW.length} new legs draw their ${seen.size} paintings, not blank (fewest colours ${minVar} at ${worst})`);
      check(wrongP.length === 0, `${tag}: each leg's painting is the one the leg names (${wrongP.join(' ') || 'all'})`);
      // the approach: the stop rises on the horizon as its own painting (Sutter's Fort adobe, the claim, the Barlow Road)
      await page.evaluate(() => { const sc = window.__ww.scene; sc.setBackdrop('trail'); sc.setLeg({ id: 'sutters-fort', biome: 'goldcountry', miles: 80, stop: { kind: 'fort', name: "Sutter's Fort" }, painting: 'adobe-fort' }); sc.setTravel({ milesDone: 75, moving: false }); });
      await step(page, 30);
      const ia = await info(page);
      check(ia.approachPainting === 'adobe-fort', `${tag}: Sutter's Fort rises on the horizon as the adobe fort (${ia.approachPainting})`);
      await page.evaluate(() => { const sc = window.__ww.scene; sc.setLeg({ id: 'sutters-fort', biome: 'goldcountry', miles: 80, stop: { kind: 'fort', name: "Sutter's Fort" }, painting: 'adobe-fort' }); sc.setBackdrop('fort'); });
      await step(page, 30); await shot(page, `v15-${tag}-adobe-fort`);
      check((await variety(page)) > 20 && (await info(page)).piece === 'fort', `${tag}: Sutter's Fort uses the fort backdrop in the adobe style`);
      // the Sacramento claim arrival: the home stop draws the claim among the oaks, and the party cheers
      await page.evaluate(() => { const sc = window.__ww.scene; sc.setLeg({ id: 'sacramento-valley', biome: 'goldcountry', miles: 100, stop: { kind: 'home' }, painting: 'sacramento-claim' }); sc.setBackdrop('valley'); sc.celebrate('arrived'); });
      await step(page, 30); await shot(page, `v15-${tag}-sacramento-claim`);
      const ic = await info(page);
      check(ic.painting === 'sacramento-claim' && ic.particles.conf > 0, `${tag}: the Sacramento claim arrival: the claim's painting and the confetti (${ic.painting}, ${ic.particles.conf} pieces)`);
      // arriving by sea: the home stop of the voyage
      await page.evaluate(() => { const sc = window.__ww.scene; sc.setLeg({ id: 'home-by-sea', biome: 'sea', miles: 600, stop: { kind: 'home' }, painting: 'home-by-sea' }); sc.setBackdrop('valley'); });
      await step(page, 30);
      check((await info(page)).painting === 'home-by-sea' && (await variety(page)) > 20, `${tag}: home by sea draws the schooner`);
      check(errors.real().length === 0, `${tag}: paintings: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }

    // ---- the dry stretch (dust, shimmer, a barrel), decorations and pack mules ----
    {
      const { page, context, errors } = await open(browser, { biome: 'basin', moving: '1', pace: 'brisk' }, LAND);
      await pause(page);
      await step(page, 90);
      const dry0 = await info(page), key0 = dry0.layersKey;
      const snap = (p) => p.evaluate(() => { const c = document.getElementById('c'); const t = document.createElement('canvas'); t.width = 64; t.height = 32; const g = t.getContext('2d'); g.drawImage(c, 0, 0, 64, 32); return Array.from(g.getImageData(0, 0, 64, 32).data); });
      const a = await snap(page);
      await page.evaluate(() => window.__ww.scene.setTravel({ dry: true }));
      await step(page, 120);
      const dry1 = await info(page), b = await snap(page), s1 = await state(page);
      const diffPx = (x, y) => { let n = 0; for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 30) n++; return n; };
      check(s1.dry === true && dry1.barrel === true && dry1.dryMix > 0.9, `dry: setTravel({ dry }) shows in the state, the barrel is on the wagon, the haze has come in (mix ${dry1.dryMix.toFixed(2)})`);
      check(diffPx(a, b) > 20, `dry: the picture changes (shimmer, haze, the barrel): ${diffPx(a, b)} of 2048 sample pixels`);
      check(key0 !== dry1.layersKey && /:dry/.test(dry1.layersKey), `dry: the basin's river and willows are rebuilt out of the props (${key0.split('@')[0]} → ${dry1.layersKey.split('@')[0]})`);
      await shot(page, 'v15-dry-basin');
      await page.evaluate(() => window.__ww.scene.setTravel({ dry: { barrel: false } }));
      await step(page, 30);
      check((await info(page)).barrel === false && (await state(page)).dry === true, 'dry: { barrel: false } keeps the haze and hides the barrel');
      await page.evaluate(() => window.__ww.scene.setTravel({ dry: false }));
      await step(page, 180);
      const dry2 = await info(page);
      check(dry2.dryMix < 0.05 && !/:dry/.test(dry2.layersKey), `dry: the day ends and the haze goes (mix ${dry2.dryMix.toFixed(2)})`);
      // dust: more of it on a dry day (the same brisk run)
      const dustOn = async (dry) => { await page.evaluate((d) => { window.__ww.scene.setTravel({ dry: d, moving: true, pace: 'brisk' }); }, dry); await step(page, 200); let tot = 0; for (let i = 0; i < 60; i++) { await step(page, 1); tot += (await info(page)).particles.dust; } return tot; };
      const dDry = await dustOn(true), dWet = await dustOn(false);
      check(dDry > dWet * 1.25, `dry: more dust behind the wheels (${dDry} vs ${dWet} puffs over 60 frames)`);
      // decorations: each of the 16, two at a time, and the pack mules
      const ids = DECOR.map((d) => d.id);
      await page.evaluate(() => window.__ww.scene.setTravel({ moving: false, dry: false }));
      let drew = 0;
      for (let i = 0; i < ids.length; i += 2) {
        const pair = ids.slice(i, i + 2);
        await page.evaluate((pair) => { const sc = window.__ww.scene; sc.setParty({ animal: 'oxen', companions: [{ id: 'a', hat: 'cap', color: '#d9534f' }, { id: 'b', hat: 'wide', color: '#5b8c5a' }, { id: 'c', hat: 'bonnet', color: '#f0a500' }], wagon: { paint: 'classic', flag: 'red', name: 'Lucky', decor: pair } }); }, pair);
        await step(page, 12);
        const s = await state(page);
        if (J(s.decor) === J(pair)) drew++;
        if (i === 0) await shot(page, 'v15-decor-1');
      }
      check(drew === 8, `decorations: all 16 DECOR ids are accepted two at a time and drawn without errors (${drew} of 8 pairs)`);
      const before = await snap(page);
      await page.evaluate(() => { const sc = window.__ww.scene; sc.setParty({ animal: 'oxen', companions: [{ id: 'a', hat: 'cap', color: '#d9534f' }, { id: 'b', hat: 'wide', color: '#5b8c5a' }, { id: 'c', hat: 'bonnet', color: '#f0a500' }], wagon: { paint: 'classic', flag: 'red', name: 'Lucky', decor: ['pennant-chimney', 'bell-brass'] }, packMules: true }); sc.setTravel({ moving: true }); });
      await step(page, 60); await shot(page, 'v15-packmules');
      const after = await snap(page), sm = await state(page);
      check(sm.packMules === true && (await info(page)).packMules === true && diffPx(before, after) > 5, `pack mules: two mules trail the wagon on the Gold Road (state ${sm.packMules}, picture changed ${diffPx(before, after)})`);
      check(errors.real().length === 0, `dry, decorations, pack mules: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }

    // ---- the gold pan: scoop, swirl, tip, panSwirled, the reveal ----
    for (const [tag, vp] of [['land', LAND], ['port', PORTRAIT]]) {
      const run = async (mode, rich) => {
        const { page, context, errors } = await open(browser, { backdrop: 'diggings', leg: 'clear-creek', moving: '0' }, vp);
        await pause(page);
        await page.evaluate((rich) => { window.__ww.scene.startPan({ seed: 4, pans: 2, rich }); }, rich);
        await step(page, 20);
        const m0 = await mini(page);
        let d = await dbg(page), sw = [];
        for (let n = 1; n <= 2; n++) {
          // scoop
          d = await dbg(page);
          await inp(page, 'pointer', d.cx, d.cy); await step(page, 40);
          // swirl: a circle at `rate` rad/s, or taps on / off the beat
          d = await dbg(page);
          const startPhase = (await mini(page)).phase;
          let frames = 0, a = 0;
          if (mode === 'circle' || mode === 'slow') {
            const rate = mode === 'circle' ? 4 : 0.8;
            await inp(page, 'pointer', d.cx + d.rx * 0.8, d.cy);
            while ((await mini(page)).phase === 'swirl' && frames < 2400) { a += rate / 60; await inp(page, 'drag', d.cx + Math.cos(a) * d.rx * 0.8, d.cy + Math.sin(a) * d.ry * 0.8); await step(page, 1); frames++; }
            await inp(page, 'release');
          } else if (mode === 'beat' || mode === 'offbeat') {
            const t0 = await page.evaluate(() => window.__ww.scene.debugMini().pt);
            let taps = 0; frames = 0;
            while ((await mini(page)).phase === 'swirl' && frames < 2400) {
              const pt = (await dbg(page)).pt, ph = pt % d.beat;
              const want = mode === 'beat' ? Math.abs(ph) < 0.02 : Math.abs(ph - d.beat / 2) < 0.02;
              if (want && frames - taps > 10) { await inp(page, 'pointer', d.cx, d.cy); await inp(page, 'release'); taps = frames; }
              await step(page, 1); frames++;
            }
            void t0;
          }
          // tip: wait for the rim to glow, then tap
          await step(page, 4);
          const mt = await mini(page);
          if (mt.phase === 'tip') { for (let i = 0; i < 120; i++) { const ph = (await dbg(page)).pt; if (Math.abs((ph % 1.5) - 0.75) < 0.03) break; await step(page, 1); } await inp(page, 'pointer', d.cx, d.cy); }
          await step(page, 70);
          const mq = await mini(page);
          sw.push({ n, phase: mq.phase, quality: mq.quality, startPhase, swirlFrames: frames });
          // the app answers with the pan's outcome (at least one flake, whatever the swirl); a nugget on the second pan
          const flakes = 1 + Math.round(mq.quality * 3) + (rich.includes(n - 1) ? 2 : 0);
          const ok = await page.evaluate(([f, nug]) => window.__ww.scene.panReveal({ flakes: f, nugget: nug }), [flakes, n === 2]);
          sw[sw.length - 1].reveal = ok;
          await step(page, 330);
        }
        const out = { sw, m0, swirled: await evs(page, 'panSwirled'), pans: await evs(page, 'pan'), end: await evs(page, 'panEnd'), left: await mini(page), errors: errors.real() };
        if (mode === 'circle' && tag === 'land') { /* screenshots are in the mid-action script of the scratchpad */ }
        await context.close();
        return out;
      };
      const good = await run('circle', [0]);
      check(good.m0 && good.m0.kind === 'pan' && good.m0.phase === 'scoop' && good.m0.pans === 2, `${tag}: startPan shows in the state as { kind: 'pan', phase: 'scoop', pans } (${J(good.m0)})`);
      check(good.swirled.length === 2 && good.swirled.every((e, i) => e.n === i + 1 && e.quality >= 0 && e.quality <= 1), `${tag}: a circling finger: panSwirled for both pans with a quality 0..1 (${J(good.swirled.map((e) => e.quality))})`);
      check(good.swirled[0].quality >= 0.9, `${tag}: a steady circle is a good swirl (quality ${good.swirled[0].quality})`);
      check(good.sw.every((s) => s.reveal === true && s.startPhase === 'swirl'), `${tag}: panReveal is taken after panSwirled (${J(good.sw.map((s) => s.reveal))})`);
      check(good.pans.length === 2 && good.pans[0].n === 1 && good.pans[1].nugget === true && good.pans[0].flakes >= 1, `${tag}: 'pan' { n, flakes, nugget } per pan, flakes ≥ 1 (${J(good.pans.map((e) => [e.n, e.flakes, e.nugget]))})`);
      check(good.end.length === 1 && good.end[0].pans === 2, `${tag}: panEnd { pans } after the last (${J(good.end)})`);
      check(good.left === null, `${tag}: the scene goes back to its backdrop after the pan (mini ${J(good.left)})`);
      check(good.errors.length === 0, `${tag}: pan: no console errors (${good.errors.join(' | ')})`);
      const slow = await run('slow', []);
      check(slow.swirled.length === 2 && slow.end.length === 1 && slow.pans.every((e) => e.flakes >= 1), `${tag}: a poor (slow) swirl still ends, with at least one flake each (quality ${J(slow.swirled.map((e) => e.quality))})`);
      check(slow.swirled[0].quality < good.swirled[0].quality, `${tag}: a slow swirl scores lower than a steady one (${slow.swirled[0].quality} < ${good.swirled[0].quality})`);
      const onb = await run('beat', []), offb = await run('offbeat', []);
      check(onb.end.length === 1 && offb.end.length === 1, `${tag}: tapping on the beat, and off it, both finish the pans`);
      check(onb.swirled[0].quality > offb.swirled[0].quality, `${tag}: taps on the beat swirl better than taps off it (${onb.swirled[0].quality} > ${offb.swirled[0].quality})`);
      check(onb.m0 && good.sw[0].swirlFrames > 0, `${tag}: the swirl takes real input (${good.sw[0].swirlFrames} frames)`);
    }
    {
      // endMiniGame mid-pan, a pan left alone waits, a rich pan is flagged, Space scoops and tips, reduced motion
      const { page, context, errors } = await open(browser, { backdrop: 'diggings', leg: 'clear-creek', moving: '0', rm: '1' }, LAND);
      await pause(page);
      await page.evaluate(() => window.__ww.scene.startPan({ seed: 2, pans: 3, rich: [1] }));
      await step(page, 600);
      check((await mini(page)).phase === 'scoop' && (await mini(page)).rich === false, 'pan: left alone it simply waits at the scoop (no timer, no loss)');
      await keySpace(page); await step(page, 60);
      check((await mini(page)).phase === 'swirl', 'pan: Space scoops');
      const sum = await page.evaluate(() => window.__ww.scene.endMiniGame());
      check(sum && sum.pans === 0 && (await state(page)).mini === null && (await evs(page, 'panEnd')).length === 0, `pan: endMiniGame() returns the summary so far and emits nothing (${J(sum)})`);
      check(errors.real().length === 0, 'pan: reduced motion, no console errors');
      await context.close();
    }

    // ---- the rocker at Coloma ----
    for (const [tag, vp] of [['land', LAND], ['port', PORTRAIT]]) {
      const play = async (mode) => {
        const { page, context, errors } = await open(browser, { backdrop: 'diggings', leg: 'coloma', moving: '0' }, vp);
        await pause(page);
        await page.evaluate(() => window.__ww.scene.startRocker({ seed: 3, rounds: 3 }));
        await step(page, 10);
        const m0 = await mini(page); const rounds = [];
        for (let r = 0; r < 3; r++) {
          let tapped = -1, n = 0;
          while ((await mini(page)).phase !== 'swirled' && n < 1500) {
            const d = await dbg(page), p = (d.rt - d.lead) / d.period, b = Math.round(p);
            if (mode !== 'none' && b >= 0 && b > tapped && Math.abs(p - b) * d.period < 0.03) { tapped = b; if (mode === 'keys') await inp(page, 'keydown', b % 2 === 0 ? 'left' : 'right'); else await inp(page, 'pointer', 10, 10); }
            await step(page, 1); n++;
          }
          const ev = await evs(page, 'rockerRound'); rounds.push(ev[ev.length - 1]);
          const ok = await page.evaluate((fl) => window.__ww.scene.rockerReveal({ flakes: fl }), 2 + (r + 1));
          rounds[rounds.length - 1].reveal = ok;
          for (let k = 0; k < 200; k += 3) { const mm = await mini(page); if (!mm || (r < 2 && mm.phase !== 'reveal')) break; await step(page, 3); }
          await step(page, r === 2 ? 200 : 2);
        }
        const out = { m0, rounds, end: await evs(page, 'rockerEnd'), left: await mini(page), errors: errors.real() };
        await context.close();
        return out;
      };
      const on = await play('pointer');
      check(on.m0 && on.m0.kind === 'rocker' && on.m0.rounds === 3, `${tag}: startRocker shows in the state (${J(on.m0)})`);
      check(on.rounds.length === 3 && on.rounds.every((e, i) => e && e.n === i + 1 && e.beats >= 0.85 && e.reveal === true), `${tag}: tapping every beat: rockerRound { n, beats } with most rocks on the beat, rockerReveal accepted (${J(on.rounds.map((e) => e && e.beats))})`);
      check(on.end.length === 1 && on.end[0].rounds === 3 && on.left === null, `${tag}: rockerEnd { rounds: 3 } and back to the backdrop`);
      const ks = await play('keys');
      check(ks.rounds.every((e) => e && e.beats >= 0.85), `${tag}: ← → on the beat count as well (${J(ks.rounds.map((e) => e && e.beats))})`);
      const none = await play('none');
      check(none.rounds.every((e) => e && e.beats === 0) && none.end.length === 1, `${tag}: no rocking at all still ends every round (beats 0) and the game ends: nothing fails`);
      check(on.errors.length + ks.errors.length + none.errors.length === 0, `${tag}: rocker: no console errors`);
    }

    // ---- Laurel Hill: hold to slide, let go at each ledge ----
    for (const [tag, vp] of [['land', LAND], ['port', PORTRAIT]]) {
      const run = async (mode, drops = 3) => {
        const { page, context, errors } = await open(browser, { leg: 'barlow-road', biome: 'mountains', moving: '0' }, vp);
        await pause(page);
        await page.evaluate((n) => window.__ww.scene.startSnub({ seed: 5, drops: n }), drops);
        await step(page, 12);
        const m0 = await mini(page);
        let n = 0, earlyDone = false, sawBumpDust = false;
        while (n < 2400 && !(await evs(page, 'snubEnd')).length) {
          const d = await dbg(page), s1 = await mini(page);
          if (s1.phase === 'wait') await (mode === 'space' ? spaceHold(page, true) : inp(page, 'pointer', 10, 10));
          if (mode === 'smooth' || mode === 'space') {
            if (s1.phase === 'slide' && d.s >= d.ledge.s0 - 0.024) await (mode === 'space' ? spaceHold(page, false) : inp(page, 'release'));
          } else if (mode === 'early') {
            if (s1.phase === 'slide' && !earlyDone && d.s > 0.04 && s1.drop === 1) { await inp(page, 'release'); earlyDone = true; }
            if (s1.phase === 'slide' && earlyDone && d.s >= d.ledge.s0 - 0.024) await inp(page, 'release');
          } // 'bumpy': never let go
          await step(page, 1); n++;
        }
        await step(page, 200);
        const out = { m0, snubs: await evs(page, 'snub'), end: await evs(page, 'snubEnd'), left: await mini(page), errors: errors.real(), n };
        await context.close();
        return out;
      };
      const sm = await run('smooth');
      check(sm.m0 && sm.m0.kind === 'snub' && sm.m0.drops === 3, `${tag}: startSnub shows in the state (${J(sm.m0)})`);
      check(sm.snubs.length === 3 && sm.snubs.every((e) => e.good === true) && sm.end.length === 1 && sm.end[0].smooth === true, `${tag}: let go at each ledge: three good drops, snubEnd { smooth: true } (${J(sm.snubs.map((e) => e.good))} ${J(sm.end.map((e) => e.smooth))})`);
      check(sm.left === null, `${tag}: Laurel Hill ends and the scene goes back`);
      const bp = await run('bumpy');
      check(bp.snubs.length === 3 && bp.snubs.every((e) => e.good === false) && bp.end.length === 1 && bp.end[0].smooth === false && bp.end[0].good === 0, `${tag}: holding all the way bumps every drop (the wagon never breaks): snubEnd { smooth: false } (${J(bp.snubs.map((e) => e.good))})`);
      const ea = await run('early');
      check(ea.snubs.length === 3 && ea.snubs[0].good === true && ea.end[0].smooth === true, `${tag}: letting go early only waits (no penalty): hold again and the drop is still good (${J(ea.snubs.map((e) => e.good))})`);
      const sp = await run('space', 2);
      check(sp.snubs.length === 2 && sp.snubs.every((e) => e.good) && sp.end[0].drops === 2, `${tag}: Space holds the rope as well, and two drops are two drops (${J(sp.snubs)})`);
      check(sm.errors.length + bp.errors.length + ea.errors.length + sp.errors.length === 0, `${tag}: snub: no console errors`);
    }

    // ---- the voyage home ----
    for (const [tag, vp] of [['land', LAND], ['port', PORTRAIT]]) {
      const run = async (mode, length = 4) => {
        const { page, context, errors } = await open(browser, { leg: 'home-by-sea', biome: 'sea', moving: '0' }, vp);
        await pause(page);
        await page.evaluate((n) => window.__ww.scene.startSail({ seed: 9, length: n }), length);
        await step(page, 10);
        const m0 = await mini(page);
        let n = 0, markers = [], waitedOk = true, sawBar = false;
        while (n < 4000 && !(await evs(page, 'sailEnd')).length) {
          const d = await dbg(page), s1 = await mini(page);
          if (s1.phase === 'bar') sawBar = true;
          if (s1.waiting) {
            // the ship waits: nothing moves until sailGo
            const before = await mini(page); await step(page, 90); const after = await mini(page);
            if (before.progress !== after.progress || after.phase !== 'marker') waitedOk = false;
            markers.push(s1.n);
            await page.evaluate(() => window.__ww.scene.sailGo());
          }
          if (mode === 'steer') {
            const nxt = d.swells.filter((x) => x.z < d.zs + 0.04 && !x.hit).sort((a, b) => b.z - a.z)[0];
            if (nxt) { const dx = nxt.g - d.u; await inp(page, 'keyup', 'left'); await inp(page, 'keyup', 'right'); if (Math.abs(dx) > 0.02) await inp(page, 'keydown', dx < 0 ? 'left' : 'right'); }
          }
          await step(page, 2); n += 2;
        }
        await step(page, 200);
        const out = { m0, markers, waitedOk, sawBar, markersEv: await evs(page, 'sailMarker'), bumps: await evs(page, 'sail'), end: await evs(page, 'sailEnd'), left: await mini(page), errors: errors.real(), n };
        await context.close();
        return out;
      };
      const st1 = await run('steer');
      check(st1.m0 && st1.m0.kind === 'sail' && st1.m0.of === 4, `${tag}: startSail shows in the state (${J(st1.m0)})`);
      check(st1.markersEv.length === 4 && st1.markersEv.every((e, i) => e.n === i + 1 && e.of === 4), `${tag}: four markers "Up the coast", n of 4 (${J(st1.markersEv.map((e) => e.n))})`);
      check(st1.waitedOk, `${tag}: at each marker the ship waits in calm water until sailGo()`);
      check(st1.bumps.length === 0 && st1.end.length === 1 && st1.end[0].bumps === 0 && st1.sawBar, `${tag}: steered through every gap (and over the Columbia bar): sailEnd { bumps: 0 } (${J(st1.end)})`);
      check(st1.left === null, `${tag}: the voyage ends and the scene goes back`);
      const al = await run('alone');
      check(al.bumps.length >= 1 && al.end.length === 1 && al.end[0].bumps === al.bumps.length, `${tag}: a ship left alone bumps (${al.bumps.length}) and still gets home: sailEnd { bumps } (${J(al.end)})`);
      const sh = await run('steer', 2);
      check(sh.markersEv.length === 2 && sh.markersEv[1].of === 2 && sh.end.length === 1, `${tag}: length 2 is two markers`);
      check(st1.errors.length + al.errors.length + sh.errors.length === 0, `${tag}: sail: no console errors`);
    }
    {
      // endMiniGame early on the voyage and on the rocker: the summary so far, no end event
      const { page, context, errors } = await open(browser, { leg: 'home-by-sea', biome: 'sea', moving: '0' }, LAND);
      await pause(page);
      await page.evaluate(() => window.__ww.scene.startSail({ seed: 1, length: 4 })); await step(page, 100);
      const s1 = await page.evaluate(() => window.__ww.scene.endMiniGame());
      check(s1 && 'bumps' in s1 && (await state(page)).mini === null && (await evs(page, 'sailEnd')).length === 0, `sail: endMiniGame() ends it with the summary so far and no event (${J(s1)})`);
      await page.evaluate(() => window.__ww.scene.startSnub({ seed: 1 })); await step(page, 20);
      const s2 = await page.evaluate(() => window.__ww.scene.endMiniGame());
      check(s2 && 'good' in s2 && (await state(page)).mini === null && (await evs(page, 'snubEnd')).length === 0, `snub: endMiniGame() the same (${J(s2)})`);
      await page.evaluate(() => window.__ww.scene.startRocker({ seed: 1 })); await step(page, 20);
      const s3 = await page.evaluate(() => window.__ww.scene.endMiniGame());
      check(s3 && 'rounds' in s3 && (await state(page)).mini === null, `rocker: endMiniGame() the same (${J(s3)})`);
      check(errors.real().length === 0, 'early endings: no console errors');
      await context.close();
    }

    // ---- the homestead: the farm at both sites, empty, half and full; the raising; taps; the pan ----
    {
      const SITE_PIECES = (site) => HOMESTEAD_PIECES.filter((p) => !p.sites || p.sites.includes(site));
      const count = (p) => (hs.PIECE_MAX[p.id] || 1);
      for (const [tag, vp] of [['land', LAND], ['port', PORTRAIT], ['wide', BIG]]) {
        const { page, context, errors } = await open(browser, { backdrop: 'homestead', moving: '0' }, vp);
        await pause(page);
        let minVar = 1e9; const picks = {};
        for (const site of ['willamette', 'sacramento']) {
          const all = SITE_PIECES(site), half = all.slice(0, Math.ceil(all.length / 2));
          for (const [name, list] of [['none', []], ['half', half], ['full', all]]) {
            const pieces = Object.fromEntries(list.map((p) => [p.id, name === 'half' ? Math.ceil(count(p) / 2) : count(p)]));
            await page.evaluate(([site, pieces]) => { const sc = window.__ww.scene; sc.setHomestead({ site, name: 'Sunny Acres', pieces, animals: { oxen: 4, mules: 2 }, dog: { name: 'Frodo', coat: 'spotted' }, decor: ['weathervane-salmon'], party: [{ id: 'a', hat: 'cap', color: '#d9534f' }, { id: 'b', hat: 'wide', color: '#5b8c5a' }, { id: 'c', hat: 'bonnet', color: '#f0a500' }], trophies: ['bronze', 'silver', 'gold'] }); sc.setBackdrop('homestead'); }, [site, pieces]);
            await step(page, 40);
            const v = await variety(page); if (v < minVar) minVar = v;
            picks[`${site}-${name}`] = v;
            if (tag !== 'wide' || name === 'full') await shot(page, `v15-${tag}-farm-${site}-${name}`);
            const s = await state(page);
            if (!(s.home && s.home.site === site && Object.keys(s.home.pieces).length === list.length)) check(false, `${tag} ${site}/${name}: getState().home says ${J(s.home)}`);
          }
        }
        check(minVar >= 20, `${tag} (${vp.width}x${vp.height}): the farm at both sites with no pieces, half and all of them: drawn, not blank (fewest colours ${minVar})`);
        check((await state(page)).home.pieces.vineyard === 1 && (await state(page)).home.site === 'sacramento', `${tag}: the Sacramento claim has its vineyard and windmill`);
        check(errors.real().length === 0, `${tag}: farm: no console errors (${errors.real().join(' | ')})`);
        await context.close();
      }
      // the raising
      const { page, context, errors } = await open(browser, { backdrop: 'homestead', moving: '0', site: 'willamette' }, LAND);
      await pause(page);
      const farm = (pieces) => ({ site: 'willamette', name: 'Sunny Acres', pieces, animals: { oxen: 4, mules: 0 }, dog: { name: 'Frodo', coat: 'brown' }, decor: [], party: null, trophies: [] });
      await page.evaluate((f) => { const sc = window.__ww.scene; sc.setHomestead(f); sc.setBackdrop('homestead'); }, farm({ cabin: 1, well: 1 }));
      await step(page, 30);
      // the app builds first, then tells the scene (order 1): setHomestead with the new count, then buildPiece
      await clearEv(page);
      await page.evaluate((f) => { const sc = window.__ww.scene; sc.setHomestead(f); window.__ok = sc.buildPiece('barn'); }, farm({ cabin: 1, well: 1, barn: 1 }));
      await step(page, 30);
      let ms = (await state(page)).home;
      check(await page.evaluate(() => window.__ok) === true && ms.building && ms.building.id === 'barn' && ms.building.big === true, `the raising: a barn goes up in beats, not at once (${J(ms.building)})`);
      const early = await variety(page); await shot(page, 'v15-farm-barn-frame');
      let frames = 30;
      while (!(await evs(page, 'buildDone')).length && frames < 400) { await step(page, 5); frames += 5; }
      const bdone = await evs(page, 'buildDone');
      check(bdone.length === 1 && bdone[0].id === 'barn' && frames / 60 > 1.5 && frames / 60 < 4, `the barn raises and emits buildDone { id: 'barn' } after ${(frames / 60).toFixed(1)} s`);
      check((await info(page)).particles.conf > 0, 'the barn raising ends with a cheer and confetti');
      check((await state(page)).home.pieces.barn === 1 && (await state(page)).home.building === null, 'the barn stays built once it is raised');
      await step(page, 60);
      // order 2: buildPiece first, the scene adds the piece itself; a small piece pops in
      await clearEv(page);
      const ok2 = await page.evaluate(() => window.__ww.scene.buildPiece('flowers'));
      await step(page, 10);
      const pop = (await state(page)).home;
      check(ok2 === true && pop.building && pop.building.big === false && pop.pieces.flowers === 1, `a small piece pops in: buildPiece('flowers') first adds it itself (${J(pop.pieces.flowers)}, big ${pop.building && pop.building.big})`);
      let f2 = 10; while (!(await evs(page, 'buildDone')).length && f2 < 200) { await step(page, 5); f2 += 5; }
      check((await evs(page, 'buildDone')).length === 1 && f2 / 60 < 1.6, `small pieces finish in ${(f2 / 60).toFixed(1)} s with buildDone { id: 'flowers' }`);
      check((await page.evaluate(() => window.__ww.scene.buildPiece('nonsense'))) === false, 'buildPiece of an unknown id is false and builds nothing');
      for (let i = 0; i < 3; i++) await page.evaluate(() => window.__ww.scene.buildPiece('flowers'));
      await step(page, 600);
      check((await state(page)).home.pieces.flowers === 3 && (await page.evaluate(() => window.__ww.scene.buildPiece('flowers'))) === false, 'flower beds stop at three, and a piece at its most is not raised again');
      // the weathervane and nothing decays: the same farm a long while later draws the same picture
      await page.evaluate((f) => { const sc = window.__ww.scene; sc.setHomestead({ ...f, decor: ['weathervane-salmon'], trophies: ['bronze'] }); }, farm({ cabin: 1, 'trophy-shelf': 1, barn: 1, fence: 1, corral: 1, cow: 1, 'apple-tree': 3, orchard: 1 }));
      await step(page, 30);
      const s0 = await page.evaluate(() => { const c = document.getElementById('c'); const t = document.createElement('canvas'); t.width = 96; t.height = 48; t.getContext('2d').drawImage(c, 0, 0, 96, 48); return t.toDataURL(); });
      await page.evaluate(() => { const sc = window.__ww.scene; sc.setReducedMotion(true); }); await step(page, 5);
      await page.evaluate(() => window.__ww.scene.debugStep(60 * 60 * 24 * 30, false));
      const noop = (await state(page)).home;
      check(Object.keys(noop.pieces).length === 8 && noop.pieces['apple-tree'] === 3, 'nothing decays: a month of sim time later the farm still has every piece');
      check(errors.real().length === 0, `the raising: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }
    {
      // taps and drags: a tap names the slot and its top piece; a drag pans the farm (portrait) and is not a tap
      const { page, context, errors } = await open(browser, { backdrop: 'homestead', moving: '0' }, PORTRAIT);
      await pause(page);
      await page.evaluate(() => { const sc = window.__ww.scene; sc.setHomestead({ site: 'willamette', name: 'Sunny Acres', pieces: { cabin: 1, barn: 1, well: 1, garden: 2, 'name-plate': 1, fence: 1, 'apple-tree': 3 }, animals: { oxen: 2, mules: 0 }, dog: null, decor: [], party: null, trophies: [] }); sc.setBackdrop('homestead'); });
      await step(page, 30);
      const h0 = await page.evaluate(() => window.__ww.scene.debugHome());
      check(h0.geo.camMax > 100, `portrait: the farm is wider than the phone (${Math.round(h0.geo.Wd)} px in ${390}) and pans`);
      const cam0 = h0.cam;
      // a real drag with the mouse
      await page.evaluate(() => window.__ww.scene.play());
      await clearEv(page);
      await page.mouse.move(300, 600); await page.mouse.down(); await page.mouse.move(150, 600, { steps: 6 }); await page.mouse.up();
      await page.evaluate(() => window.__ww.scene.pause());
      const h1 = await page.evaluate(() => window.__ww.scene.debugHome());
      check(h1.cam > cam0 + 60 && (await evs(page, 'homesteadTap')).length === 0, `portrait: a drag pans the farm (${cam0} → ${h1.cam}) and is not a tap`);
      // taps on each slot
      const taps = {};
      for (const slot of ['barn', 'house', 'orchard', 'garden', 'gate', 'pasture', 'yard', 'edge', 'creek']) {
        await page.evaluate((slot) => { const sc = window.__ww.scene; sc.setBackdrop('homestead'); sc.debugInput('pan', -9999); }, slot);
        await page.evaluate((slot) => { const h = window.__ww.scene.debugHome(); window.__pt = h.slots[slot]; }, slot);
        const pt = await page.evaluate(() => window.__pt);
        const evt = await page.evaluate(([x, y]) => window.__ww.scene.debugInput('tap', x, y), [pt.x + 0, pt.y]);
        taps[slot] = evt;
      }
      check(taps.barn && taps.barn.slot === 'barn' && taps.barn.piece === 'barn', `taps: the barn names its slot and piece (${J(taps.barn)})`);
      check(taps.house && taps.house.slot === 'house' && taps.house.piece === 'cabin', `taps: the house is the cabin (${J(taps.house)})`);
      check(taps.garden && taps.garden.slot === 'garden' && taps.garden.piece === 'garden' && taps.gate.piece === 'name-plate' && taps.pasture.piece === 'fence', `taps: the garden, the gate's name plate and the pasture's fence`);
      check(taps.orchard && taps.orchard.slot === 'orchard' && taps.orchard.piece === 'apple-tree', `taps: the orchard is its apple trees (${J(taps.orchard)})`);
      check(taps.creek && taps.creek.slot === 'creek' && taps.creek.piece === null && taps.edge.piece === null && taps.yard.piece === 'well', `taps: an empty slot says piece: null so the app can show what could go there (creek ${J(taps.creek)})`);
      check((await evs(page, 'homesteadTap')).length >= 9, 'taps: every tap emits homesteadTap');
      check(errors.real().length === 0, 'taps: no console errors');
      await context.close();
    }

    // ---- the forks: a signpost at Fort Hall, The Dalles and South Pass ----
    for (const [tag, vp] of [['land', LAND], ['port', PORTRAIT]]) {
      const { page, context, errors } = await open(browser, { moving: '0' }, vp);
      await pause(page);
      const res = {};
      for (const [id, leg, biome, n] of [['fort-hall', 'fort-hall', 'highdesert', 2], ['the-dalles', 'the-dalles', 'gorge', 2], ['south-pass', 'south-pass', 'mountains', 3]]) {
        await page.evaluate(([id, leg, biome]) => { const sc = window.__ww.scene; sc.setLeg({ id: leg, biome, miles: 100, stop: { kind: 'landmark' } }); sc.setFork({ id }); sc.setBackdrop('fork'); }, [id, leg, biome]);
        await step(page, 30);
        const i = await info(page), s = await state(page);
        res[id] = { arms: i.fork, state: s.fork, v: await variety(page), piece: i.piece };
        await shot(page, `v15-${tag}-fork-${id}`);
      }
      check(res['fort-hall'].arms.length === 2 && res['fort-hall'].state.options[0] === 'Oregon' && res['fort-hall'].state.options[1] === 'California', `${tag}: Fort Hall's signpost points to Oregon and California (${J(res['fort-hall'].state)})`);
      check(res['the-dalles'].arms.length === 2 && /Barlow/.test(res['the-dalles'].state.options[1]), `${tag}: The Dalles: the Columbia or the Barlow Road (${J(res['the-dalles'].state.options)})`);
      check(res['south-pass'].arms.length === 3 && res['south-pass'].piece === 'fork', `${tag}: South Pass has three arms (${J(res['south-pass'].arms)})`);
      check(Object.values(res).every((r) => r.v > 15), `${tag}: the three signposts are drawn, not blank`);
      // the app's own words, and a glow on the chosen arm
      await page.evaluate(() => window.__ww.scene.setFork({ id: 'fort-hall', options: [{ id: 'oregon', name: 'On to Oregon' }, { id: 'california', name: 'South to California' }], glow: 'california' }));
      await step(page, 20);
      check(J((await state(page)).fork.options) === J(['On to Oregon', 'South to California']), `${tag}: setFork takes the app's option names`);
      check(errors.real().length === 0, `${tag}: forks: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }

    // ---- the new wild cards' animals cross the background (spotAnimal learns eight more)
    {
      const { page, context, errors } = await open(browser, { moving: '0' }, LAND);
      const kinds = ['beaver', 'sage-grouse', 'meadowlark', 'tule-elk', 'osprey', 'pika', 'river-otter', 'mountain-quail'];
      const crossed = [];
      for (const k of kinds) {
        await pause(page); await clearEv(page);
        const ok = await page.evaluate((k) => window.__ww.scene.spotAnimal(k), k);
        await step(page, 50); if (k === 'beaver' || k === 'tule-elk' || k === 'osprey' || k === 'mountain-quail') await shot(page, `v15-animal-${k}`);
        let n = 0; while (!(await evs(page, 'animalSpotted')).length && n < 1200) { await step(page, 5); n += 5; }
        const e = await evs(page, 'animalSpotted');
        if (ok === true && e.length === 1 && e[0].animal === k && (await variety(page)) > 12) crossed.push(k);
      }
      check(crossed.length === 8, `spotAnimal: all eight new animals cross and emit animalSpotted (${crossed.join(', ')})`);
      await pause(page); await clearEv(page);
      check((await page.evaluate(() => window.__ww.scene.spotAnimal('western-meadowlark'))) === true && (await page.evaluate(() => window.__ww.scene.spotAnimal('unicorn'))) === false, 'spotAnimal: the card id western-meadowlark is the meadowlark, and an unknown animal is false');
      check(errors.real().length === 0, `new animals: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }

    // ---- the mock scene: the same API, scripted ----
    {
      const { page, context, errors } = await open(browser, { mock: '1', biome: 'prairie', moving: '0' }, { width: 422, height: 195 });
      const miss = await page.evaluate((n) => n.filter((k) => typeof window.__ww.scene[k] !== 'function'), API_15);
      check(miss.length === 0 && (await state(page)).mock === true, `the mock scene has the v1.5 API (missing: ${miss.join(',') || 'none'})`);
      const run = async (script, start, endType, wait = 30000) => {
        await page.evaluate((s) => { window.__mockScript = { shotMs: 25, ...s }; window.__ww.events.length = 0; }, script);
        await page.evaluate(start);
        await page.waitForFunction((t) => window.__ww.events.some((e) => e.type === t), endType, { timeout: wait });
        return page.evaluate(() => window.__ww.events.filter((e) => e.type !== 'ready' && e.type !== 'sfx').map((e) => { const { at, ...r } = e; return r; }));
      };
      // pan: panSwirled waits for panReveal; the stub answers each one
      let ev = await run({ pan: 0.8 }, () => { const sc = window.__ww.scene; sc.startPan({ seed: 1, pans: 3, rich: [1] }); window.__rev = setInterval(() => { const m = sc.getState().mini; if (m && m.kind === 'pan' && m.phase === 'swirled') sc.panReveal({ flakes: 5, nugget: m.n === 3 }); }, 5); }, 'panEnd');
      await page.evaluate(() => clearInterval(window.__rev));
      check(J(ev.map((e) => e.type)) === J(['panSwirled', 'pan', 'panSwirled', 'pan', 'panSwirled', 'pan', 'panEnd']) && ev[0].quality === 0.8 && ev[5].nugget === true && ev[6].pans === 3, `mock pan: ${ev.map((e) => e.type + (e.n ? e.n : '')).join(' ')}`);
      const pst = await run({ pan: [0.2, 0.9] }, () => window.__ww.scene.startPan({ seed: 1, pans: 2 }), 'panSwirled');
      check(pst[0].quality === 0.2 && (await mini(page)).phase === 'swirled', 'mock pan: __mockScript.pan [0.2, 0.9] gives the first pan 0.2 and the scene waits for the reveal');
      await page.evaluate(() => window.__ww.scene.endMiniGame());
      // rocker
      ev = await run({ rocker: 0.5 }, () => { const sc = window.__ww.scene; sc.startRocker({ seed: 1, rounds: 2 }); window.__rev = setInterval(() => { const m = sc.getState().mini; if (m && m.kind === 'rocker' && m.phase === 'swirled') sc.rockerReveal({ flakes: 4 }); }, 5); }, 'rockerEnd');
      await page.evaluate(() => clearInterval(window.__rev));
      check(J(ev.map((e) => e.type)) === J(['rockerRound', 'rockerRound', 'rockerEnd']) && ev[0].beats === 0.5 && ev[2].rounds === 2, `mock rocker: ${J(ev)}`);
      // snub
      ev = await run({}, () => window.__ww.scene.startSnub({ seed: 1, drops: 3 }), 'snubEnd');
      check(J(ev) === J([{ type: 'snub', good: true }, { type: 'snub', good: true }, { type: 'snub', good: true }, { type: 'snubEnd', smooth: true, good: 3, drops: 3 }]), `mock snub (default smooth): ${J(ev.map((e) => e.good))} → ${J(ev[ev.length - 1])}`);
      ev = await run({ snub: 'bumpy' }, () => window.__ww.scene.startSnub({ seed: 1, drops: 3 }), 'snubEnd');
      check(ev[ev.length - 1].smooth === false && ev[ev.length - 1].good === 0, `mock snub 'bumpy': ${J(ev[ev.length - 1])}`);
      ev = await run({ snub: [true, false, true] }, () => window.__ww.scene.startSnub({ seed: 1, drops: 3 }), 'snubEnd');
      check(J(ev.filter((e) => e.type === 'snub').map((e) => e.good)) === '[true,false,true]' && ev[ev.length - 1].good === 2, 'mock snub [true, false, true]: the drops follow the script');
      // sail
      ev = await run({ sail: 2 }, () => { const sc = window.__ww.scene; sc.startSail({ seed: 1, length: 4 }); window.__rev = setInterval(() => { const m = sc.getState().mini; if (m && m.kind === 'sail' && m.waiting) sc.sailGo(); }, 5); }, 'sailEnd');
      await page.evaluate(() => clearInterval(window.__rev));
      check(J(ev.map((e) => e.type)) === J(['sail', 'sail', 'sailMarker', 'sailMarker', 'sailMarker', 'sailMarker', 'sailEnd']) && ev[2].n === 1 && ev[5].n === 4 && ev[5].of === 4 && ev[6].bumps === 2, `mock sail: ${ev.map((e) => e.type + (e.n || '')).join(' ')}`);
      const mk = await run({ sail: 0 }, () => window.__ww.scene.startSail({ seed: 1, length: 4 }), 'sailMarker');
      await page.waitForTimeout(150);
      check(J(mk.map((e) => e.type)) === '["sailMarker"]' && (await mini(page)).waiting === true && (await page.evaluate(() => window.__ww.scene.sailGo())) === true, 'mock sail: the ship waits at the marker until sailGo() (→ true)');
      await page.evaluate(() => window.__ww.scene.endMiniGame());
      // the farm, the signpost, the dry day and the decorations are kept
      await page.evaluate(() => { const sc = window.__ww.scene; window.__ww.events.length = 0; sc.setHomestead({ site: 'willamette', name: 'Sunny Acres', pieces: { cabin: 1, barn: 1 } }); sc.setBackdrop('homestead'); window.__bp = sc.buildPiece('barn'); });
      await page.waitForFunction(() => window.__ww.events.some((e) => e.type === 'buildDone'), null, { timeout: 3000 });
      const mh = await page.evaluate(() => ({ lh: window.__mock && window.__mock.lastHomestead, lb: window.__mock && window.__mock.lastBuild, st: window.__ww.scene.getState() }));
      check(mh.lh && mh.lh.name === 'Sunny Acres' && mh.lb === 'barn' && mh.st.home && mh.st.home.pieces.barn === 1, `mock: setHomestead is kept (__mock.lastHomestead), buildPiece('barn') emits buildDone (${J(mh.st.home)})`);
      await page.evaluate(() => { const sc = window.__ww.scene; sc.setFork({ id: 'south-pass' }); sc.setTravel({ dry: true }); sc.setParty({ wagon: { decor: ['bell-brass'] }, packMules: true }); });
      const ms2 = await state(page);
      check(ms2.dry === true && ms2.fork && ms2.fork.id === 'south-pass', 'mock: setFork and setTravel({ dry }) are kept in the state');
      for (const b of NEW_BIOMES) { await page.evaluate((b) => window.__ww.scene.setLeg({ id: 'x', biome: b, miles: 100, stop: { kind: 'landmark' } }), b); }
      check(errors.real().length === 0, `mock scene (v1.5): no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }
  }


  // ---- 14. v1.6 (The Lab): wagon covers, the leader's outfits, Trail Cheer, the previews ----
  if (!process.env.PERF_ONLY && !process.env.V14_ONLY && !process.env.V15_ONLY) {
    console.log('\n--- v1.6 (The Lab): covers, outfits, Trail Cheer, previews ---');
    const PORTRAIT = { width: 390, height: 844 }, LAND = { width: 844, height: 390 }, J = (a) => JSON.stringify(a);
    const COVERS = ['stripes', 'patchwork', 'sunflower', 'riverblue', 'starquilt', 'nightsky', 'goldthread'];
    const OUTFITS = ['bonnet', 'strawhat', 'vest', 'redscarf', 'spectacles', 'plumehat', 'cloak'];
    const COMPS = (outfit) => [{ id: 'a', hat: 'wide', color: '#d9534f', ...(outfit ? { outfit } : {}) }, { id: 'b', hat: 'cap', color: '#5b8c5a' }, { id: 'c', hat: 'kerchief', color: '#f0a500' }];
    const snapC = (p) => p.evaluate(() => { const c = document.getElementById('c'); const t = document.createElement('canvas'); t.width = 96; t.height = 48; const g = t.getContext('2d'); g.drawImage(c, 0, 0, 96, 48); return Array.from(g.getImageData(0, 0, 96, 48).data); });
    const snapFull = (p, key) => p.evaluate((key) => { const c = document.getElementById('c'); const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; const g = t.getContext('2d'); g.drawImage(c, 0, 0); (window.__snaps = window.__snaps || {})[key] = g.getImageData(0, 0, t.width, t.height).data; }, key);
    const diffFull = (p, a, b) => p.evaluate(([a, b]) => { const x = window.__snaps[a], y = window.__snaps[b]; let n = 0; for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 40) n++; return n; }, [a, b]);
    const diffLeader = (p, a, b) => p.evaluate(([a, b]) => { const x = window.__snaps[a], y = window.__snaps[b], W = document.getElementById('c').width, k = W / 844; let n = 0; for (let yy = Math.floor(240 * k); yy < Math.floor(340 * k); yy++) for (let xx = Math.floor(210 * k); xx < Math.floor(280 * k); xx++) { const i = (yy * W + xx) * 4; if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 40) n++; } return n; }, [a, b]);
    const diffC = (x, y) => { let n = 0; for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 30) n++; return n; };
    for (const [tag, vp] of [['land', LAND], ['port', PORTRAIT]]) {
      const { page, context, errors } = await open(browser, { biome: 'prairie', moving: '0' }, vp);
      await page.evaluate(() => window.__ww.scene.pause());
      const setLook = (cover, outfit) => page.evaluate(([cover, outfit, comps]) => { const sc = window.__ww.scene; sc.setParty({ animal: 'oxen', companions: comps, wagon: { paint: 'classic', flag: 'red', name: 'Lucky', ...(cover ? { cover } : {}) } }); }, [cover, outfit, COMPS(outfit)]);
      await setLook(null, null); await step(page, 20);
      const plain = await snapC(page);
      check((await info(page)).coverLook === null && (await info(page)).outfit === null, `${tag}: no Lab look: the game's own canvas and clothes (coverLook ${J((await info(page)).coverLook)}, outfit ${J((await info(page)).outfit)})`);
      const seen = [];
      for (const id of COVERS) {
        await setLook(`ww.cover.${id}`, null); await step(page, 20);
        const a = await snapC(page), i = await info(page);
        seen.push(a);
        check(i.coverLook === id && diffC(plain, a) > 8, `${tag}: cover ${id}: the scene draws it (coverLook ${i.coverLook}, ${diffC(plain, a)} sample pixels differ from the plain canvas)`);
        if (tag === 'land') await shot(page, `v16-cover-${id}`);
      }
      let distinct = 0; for (let i = 0; i < seen.length; i++) for (let k = i + 1; k < seen.length; k++) if (diffC(seen[i], seen[k]) > 8) distinct++;
      check(distinct === 21, `${tag}: the seven covers all look different from one another (${distinct} of 21 pairs)`);
      await setLook('stripes', null); await step(page, 20);
      check((await info(page)).coverLook === 'stripes', `${tag}: a bare id works too ('stripes')`);
      await setLook(null, null); await step(page, 1); const plain2 = await snapC(page);
      await setLook('ww.cover.notacover', null); await step(page, 1);
      check((await info(page)).coverLook === null && diffC(plain2, await snapC(page)) < 6, `${tag}: an unknown id draws the game's own canvas`);
      for (const id of OUTFITS) {
        await setLook(null, null); await step(page, 1); await snapFull(page, 'plain');
        await setLook(null, `ww.outfit.${id}`); await step(page, 1); await snapFull(page, 'worn');
        const i = await info(page), d = tag === 'land' ? await diffLeader(page, 'plain', 'worn') : await diffFull(page, 'plain', 'worn');
        check(i.outfit === id && d >= (tag === 'land' ? 15 : 60), `${tag}: outfit ${id}: the leader wears it (outfit ${J(i.outfit)}, ${d} pixels differ from the plain clothes)`);
        if (tag === 'land') await shot(page, `v16-outfit-${id}`);
      }
      await setLook(null, null); await step(page, 1); await snapFull(page, 'p1');
      await step(page, 2); await snapFull(page, 'n1');
      const noise = await diffFull(page, 'p1', 'n1');                       // (two idle frames apart, nothing changed: the scene's own motion)
      await setLook(null, 'ww.outfit.cloak'); await step(page, 1);
      await setLook(null, null); await step(page, 1); await snapFull(page, 'p2');
      const back = await diffFull(page, 'n1', 'p2');
      check((await info(page)).outfit === null && back <= noise + 60, `${tag}: no outfit: the leader's own clothes again (${back} pixels differ from before; the scene's own motion alone: ${noise})`);
      // only the leader (the first companion) wears an outfit
      await page.evaluate(() => { const sc = window.__ww.scene; sc.setParty({ animal: 'oxen', companions: [{ id: 'a', hat: 'wide', color: '#d9534f' }, { id: 'b', hat: 'cap', color: '#5b8c5a', outfit: 'ww.outfit.cloak' }, { id: 'c', hat: 'kerchief', color: '#f0a500', outfit: 'ww.outfit.vest' }], wagon: { paint: 'classic' } }); });
      await step(page, 12);
      check((await info(page)).outfit === null, `${tag}: only the first companion, the leader, takes an outfit (the others' are ignored)`);
      // Trail Cheer: the party cheers about 1.2 s
      await page.evaluate(() => { const sc = window.__ww.scene; sc.setParty({ animal: 'oxen', companions: [{ id: 'a', hat: 'wide', color: '#d9534f' }, { id: 'b', hat: 'cap', color: '#5b8c5a' }, { id: 'c', hat: 'kerchief', color: '#f0a500' }], wagon: { paint: 'classic' } }); });
      await step(page, 10);
      const c0 = await info(page), cheerFn = await page.evaluate(() => typeof window.__ww.scene.cheer);
      await page.evaluate(() => window.__ww.scene.cheer());
      const c1 = await info(page);
      await step(page, 20); const during = await snapC(page);
      check(cheerFn === 'function' && c1.cheers === (c0.cheers | 0) + 1 && c1.cheerT > 1.0 && c1.cheerT <= 1.21, `${tag}: scene.cheer() starts the cheer (cheerT ${c1.cheerT.toFixed(2)} s, cheers ${c1.cheers})`);
      check(diffC(plain, during) > 4, `${tag}: the picture changes while they cheer (confetti, arms up)`);
      await step(page, 100);
      check((await info(page)).cheerT === 0, `${tag}: and it is over in about a second (cheerT ${(await info(page)).cheerT})`);
      check(errors.real().length === 0, `${tag}: covers, outfits and Trail Cheer: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }
    // the Lab's own previews and the results' stop card, drawn in the dev page
    {
      const { page, context, errors } = await open(browser, { biome: 'prairie', moving: '0' }, LAND);
      const r = await page.evaluate(async () => {
        const m = await import('/wagon-west/src/meta/labLooks.js');
        const b = await import('/wagon-west/src/scene/backdrops.js');
        const legs = await import('/wagon-west/src/content/legs.js');
        const paintOne = (id) => { const c = document.createElement('canvas'); c.width = 120; c.height = 80; const g = c.getContext('2d'); g.fillStyle = '#cfe3ee'; g.fillRect(0, 0, 120, 80); const ok = m.paintPreview(g, { id }, 120, 80); const d = g.getImageData(0, 0, 120, 80).data; const seen = new Set(); for (let i = 0; i < d.length; i += 4 * 7) seen.add(`${d[i] >> 5},${d[i + 1] >> 5},${d[i + 2] >> 5}`); return { ok, colours: seen.size }; };
        const ready = m.LOOKS_READY.slice();
        const previews = ready.map((id) => ({ id, ...paintOne(id) }));
        const other = paintOne('ww.paint.red'), none = paintOne('sj.skin.mint');
        const cards = legs.ALL_LEGS.map((leg) => { const c = document.createElement('canvas'); c.width = 176; c.height = 108; const g = c.getContext('2d'); const id = b.drawStopCard(g, 176, 108, leg); const d = g.getImageData(0, 0, 176, 108).data; const seen = new Set(); for (let i = 0; i < d.length; i += 4 * 11) seen.add(`${d[i] >> 5},${d[i + 1] >> 5},${d[i + 2] >> 5}`); let blank = true; for (let i = 3; i < d.length; i += 4) if (d[i] < 255) { blank = true; break; } else blank = false; return { leg: leg.id, id, colours: seen.size, opaque: !blank }; });
        return { ready, previews, other, none, cards, n: legs.ALL_LEGS.length };
      });
      check(r.ready.length === 14 && r.ready.every((id) => /^ww\.(cover|outfit)\./.test(id)) && r.ready.filter((id) => id.startsWith('ww.cover.')).length === 7, `labLooks.js lists the 14 Wagon West items the Lab may show (${r.ready.length})`);
      check(r.previews.every((p) => p.ok && p.colours >= 6), `paintPreview draws every one of them (${r.previews.map((p) => p.id.split('.').pop() + ':' + p.colours).join(' ')})`);
      check(!r.other.ok && !r.none.ok, 'and nothing else (an item the game does not own is left to the Lab\'s swatch)');
      check(r.cards.length === r.n && r.cards.every((c) => c.colours >= 5 && c.opaque), `the stop card paints every one of the ${r.n} legs of every route (the fewest colours ${Math.min(...r.cards.map((c) => c.colours))})`);
      check(errors.real().length === 0, `previews and stop cards: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }
    // the MOCK scene keeps the cover and the outfit and cheers
    {
      const { page, context, errors } = await open(browser, { mock: '1' }, LAND);
      const m = await page.evaluate(() => { const sc = window.__ww.scene; sc.setParty({ animal: 'oxen', companions: [{ id: 'a', hat: 'wide', color: '#d9534f', outfit: 'ww.outfit.vest' }], wagon: { cover: 'ww.cover.stripes' } }); const a = sc.getState(); sc.cheer(); return { cover: a.cover, outfit: a.outfit, cheers: sc.getState().cheers, hasCheer: typeof sc.cheer }; });
      check(m.cover === 'ww.cover.stripes' && m.outfit === 'ww.outfit.vest' && m.cheers === 1 && m.hasCheer === 'function', `mock: the cover and the leader's outfit are kept and cheer() runs (${J(m)})`);
      check(errors.real().length === 0, `mock scene (v1.6): no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }
  }

  // ---- 8. perf: real frames at 4x CPU throttle on a phone-sized canvas ----
  if (!process.env.SKIP_PERF && !process.env.V16_ONLY) {
    const PERF_MS = Number(process.env.PERF_MS || 8);
    for (const [name, params, setup] of [
      ['stormy trail, a bison herd and confetti', { biome: 'mountains', weather: 'storm', pace: 'brisk' }, () => { const sc = window.__ww.scene; sc.spotAnimal('bison'); sc.spotAnimal('eagle'); sc.celebrate('arrived'); }],
      ['the hunt in the rain', { biome: 'prairie', weather: 'rain' }, () => window.__ww.scene.startHunt({ seed: 5, shots: 5 })],
      ['the river crossing at camp-time dusk', { biome: 'gorge', backdrop: 'river', weather: 'dusk' }, () => window.__ww.scene.celebrate('river')],
      ['a rainy trail with the dog, a herd and barks', { biome: 'prairie', weather: 'rain', pace: 'brisk', dog: 'spotted' }, () => { const sc = window.__ww.scene; sc.spotAnimal('bison'); sc.spotAnimal('pronghorn'); sc.dogBark(); setInterval(() => sc.dogBark(), 900); }],
      ['the buffalo stampede (a herd, dust, the BRAKE sign, the dog)', { biome: 'prairie', dog: 'spotted', weather: 'rain' }, () => { const sc = window.__ww.scene; sc.startStampede({ seed: 3 }); setInterval(() => { const m = sc.debugMini(); if (!m) sc.startStampede({ seed: 4 }); else if (m.cue && Math.random() < 0.15) sc.debugInput('pointer', 1, 1); }, 90); }],
      ['the Columbia raft (rocks, eddies, bends, steering)', { biome: 'gorge', weather: 'rain' }, () => { const sc = window.__ww.scene; sc.startRaft({ seed: 2, length: 4 }); setInterval(() => { const m = sc.debugMini(); if (!m) { sc.startRaft({ seed: 3, length: 4 }); return; } if (m.waiting) { sc.raftGo(); return; } if (m.phase !== 'drift') return; const f = Math.min(1, m.a + 0.03) * 20, i = Math.min(19, Math.floor(f)); const u = m.route[i] + (m.route[i + 1] - m.route[i]) * (f - i); sc.debugInput('pointer', m.x0 + u * m.chan, m.y); }, 100); }],
      ['the float on a wide river', { biome: 'mountains' }, () => { const sc = window.__ww.scene; sc.startFloat({ seed: 6, width: 'wide' }); setInterval(() => { if (!sc.debugMini()) sc.startFloat({ seed: 7, width: 'wide' }); }, 200); }],
      ['the ford with a swell every 1.4 s', { biome: 'highdesert', dog: 'brown' }, () => { const sc = window.__ww.scene; sc.startFord({ seed: 6, width: 'wide' }); setInterval(() => { const m = sc.debugMini(); if (!m) sc.startFord({ seed: 7, width: 'wide' }); else if (m.ready && Math.random() < 0.3) sc.debugInput('pointer', 1, 1); }, 120); }],
      ['skipping stones (a stone skipping, rings, the beat target)', { biome: 'prairie', backdrop: 'river' }, () => { const sc = window.__ww.scene; sc.startStones({ seed: 3, throws: 9 }); setInterval(() => { const m = sc.debugMini(); if (!m) { sc.startStones({ seed: 4, throws: 9 }); return; } if (m.phase === 'ready') sc.debugInput('pointer', 1, 1); else if (m.needTap && m.nextKissIn != null && m.nextKissIn < 0.1) sc.debugInput('pointer', 1, 1); }, 40); }],
      ['falling stars at the camp (night sky, fire light, streaks, sparks)', { biome: 'prairie', backdrop: 'camp', dog: 'brown' }, () => { const sc = window.__ww.scene; sc.startMeteors({ seed: 2, n: 8 }); setInterval(() => { const m = sc.debugMini(); if (!m) { sc.startMeteors({ seed: 3, n: 8 }); return; } if (m.stars.length) sc.debugInput('pointer', m.stars[0].x, m.stars[0].y); }, 500); }],
      ['the dust devil (a column, flying hats, sparks) with the dog', { biome: 'highdesert', dog: 'brown' }, () => { const sc = window.__ww.scene; const hats = [{ id: 'blacksmith', hat: 'cap', color: '#d9534f' }, { id: 'scout', hat: 'wide', color: '#5b8c5a' }, { id: 'cook', hat: 'bonnet', color: '#f0a500' }, { id: 'me', hat: 'straw', color: '#d9534f' }]; sc.startDustDevil({ seed: 8, hats }); setInterval(() => { const m = sc.debugMini(); if (!m) { sc.startDustDevil({ seed: 9, hats }); return; } for (const h of m.hats) if (h.state === 'air' && Math.random() < 0.1) sc.debugInput('pointer', h.x, h.y); }, 100); }],
      ['fishing 2.0 (the fight bar, the line, the fish, the dog)', { biome: 'prairie', dog: 'brown' }, () => { const sc = window.__ww.scene; const go = () => sc.startFishing({ seed: 5, water: 'snake', casts: 8, helper: { id: 'scout', hat: 'wide', color: '#5b8c5a' }, dog: true, cameo: { at: 1, kind: 'splash' } }); go(); let held = false; setInterval(() => { const m = sc.debugMini(); if (!m) { go(); return; } if (m.phase === 'bite') { sc.debugInput('pointer', 1, 1); held = true; } else if (m.phase === 'fight') { if (m.fight === 'help') sc.fishingHelp(); const want = !(m.wobble || m.warn); if (want && !held) { sc.debugInput('pointer', 1, 1); held = true; } if (!want && held) { sc.debugInput('release'); held = false; } } }, 30); }],
      ['the rabbit chase with the dog on a rolling trail', { biome: 'prairie', dog: 'brown', moving: '1', pace: 'brisk' }, () => { const sc = window.__ww.scene; sc.startChase({ seed: 2 }); setInterval(() => { if (!sc.debugMini()) sc.startChase({ seed: 3 }); }, 200); }],
      ['Fort Derby with the dog (bursts and the finish)', { biome: 'highdesert', backdrop: 'fort', dog: 'brown' }, () => { const sc = window.__ww.scene; sc.startDerby({ seed: 3, length: 200 }); setInterval(() => { const s = sc.getState(); if (!s.mini) sc.startDerby({ seed: 4, length: 200 }); else if (s.mini.phase === 'wait') sc.derbyBurst(1); }, 60); }],
      ['v1.5 a dry basin trail: haze, dust, the barrel, decorations and two pack mules', { biome: 'basin', pace: 'brisk', dog: 'brown' }, () => { const sc = window.__ww.scene; sc.setParty({ animal: 'mules', companions: [{ id: 'blacksmith', hat: 'cap', color: '#d9534f' }, { id: 'scout', hat: 'wide', color: '#5b8c5a' }, { id: 'cook', hat: 'bonnet', color: '#f0a500' }], wagon: { paint: 'red', flag: 'blue', name: 'Lucky Star', decor: ['pennant-chimney', 'bell-brass'] }, packMules: true, dog: { name: 'Frodo', coat: 'brown' } }); sc.setTravel({ dry: true, moving: true, pace: 'brisk' }); sc.spotAnimal('tule-elk'); }],
      ['v1.5 the Sierra in snow (snow, pines, a pika crossing)', { biome: 'sierra', weather: 'snow', pace: 'brisk' }, () => { const sc = window.__ww.scene; sc.spotAnimal('pika'); sc.spotAnimal('osprey'); }],
      ['v1.5 the schooner deck at sea (swells, rail, mast, a dusk sky)', { biome: 'sea', backdrop: 'sea', weather: 'dusk', dog: 'spotted' }, () => { window.__ww.scene.celebrate('arrived'); }],
      ['v1.5 the voyage (swells, spray, the bar, steering)', { biome: 'sea' }, () => { const sc = window.__ww.scene; sc.startSail({ seed: 4, length: 4 }); setInterval(() => { const m = sc.getState().mini; if (!m) { sc.startSail({ seed: 5, length: 4 }); return; } if (m.waiting) sc.sailGo(); sc.debugInput('keydown', Math.sin(performance.now() / 700) > 0 ? 'right' : 'left'); }, 120); }],
      ['v1.5 gold panning (the close-up, the swirl, the flakes) at the diggings', { biome: 'goldcountry', backdrop: 'diggings', leg: 'clear-creek', moving: '0' }, () => { const sc = window.__ww.scene; sc.startPan({ seed: 2, pans: 3, rich: [1] }); let a = 0; setInterval(() => { const m = sc.getState().mini; if (!m) { sc.startPan({ seed: 3, pans: 3, rich: [1] }); return; } const d = sc.debugMini(); if (m.phase === 'scoop') sc.debugInput('pointer', d.cx, d.cy); else if (m.phase === 'swirl') { a += 0.3; sc.debugInput('pointer', d.cx + d.rx * 0.8 * Math.cos(a), d.cy + d.ry * 0.8 * Math.sin(a)); sc.debugInput('drag', d.cx + d.rx * 0.8 * Math.cos(a + 0.3), d.cy + d.ry * 0.8 * Math.sin(a + 0.3)); } else if (m.phase === 'tip' && Math.sin((d.pt / 1.5) * 6.2832 - 1.5708) > 0.2) sc.debugInput('pointer', d.cx, d.cy); else if (m.phase === 'swirled') sc.panReveal({ flakes: 4, nugget: m.n === 2 }); }, 60); }],
      ['v1.5 the rocker at Coloma (the cradle, the pour, the beat)', { biome: 'goldcountry', backdrop: 'diggings', leg: 'coloma', moving: '0' }, () => { const sc = window.__ww.scene; sc.startRocker({ seed: 2, rounds: 3 }); setInterval(() => { const m = sc.getState().mini; if (!m) { sc.startRocker({ seed: 3, rounds: 3 }); return; } if (m.phase === 'swirled') sc.rockerReveal({ flakes: 4 }); else sc.debugInput('pointer', 10, 10); }, 400); }],
      ['v1.5 Laurel Hill (the slope, the rope, the dust)', { biome: 'mountains', leg: 'barlow-road', moving: '0' }, () => { const sc = window.__ww.scene; sc.startSnub({ seed: 2, drops: 3 }); setInterval(() => { const m = sc.getState().mini; if (!m) { sc.startSnub({ seed: 3, drops: 3 }); return; } const d = sc.debugMini(); if (m.phase === 'wait') sc.debugInput('pointer', 10, 10); else if (m.phase === 'slide' && d.s > d.ledge.s0 - 0.02 + (m.drop === 2 ? 0.1 : 0)) sc.debugInput('release'); }, 40); }],
      ['v1.5 the farm at full build with a raising and the weather', { backdrop: 'homestead', weather: 'rain', dog: 'brown' }, () => { const sc = window.__ww.scene; const all = { cabin: 1, 'frame-house': 1, barn: 1, schoolhouse: 1, well: 1, fence: 1, corral: 1, cow: 1, garden: 4, flowers: 3, mailbox: 1, bench: 1, coop: 1, 'apple-tree': 6, orchard: 1, mill: 1, 'name-plate': 1, 'trophy-shelf': 1 }; sc.setHomestead({ site: 'willamette', name: 'Sunny Acres', pieces: { ...all, barn: 0 }, animals: { oxen: 4, mules: 4 }, dog: { name: 'Frodo', coat: 'brown' }, decor: ['weathervane-salmon'], party: null, trophies: ['bronze', 'silver', 'gold'] }); sc.setBackdrop('homestead'); setInterval(() => { const f = { site: 'willamette', name: 'Sunny Acres', animals: { oxen: 4, mules: 4 }, dog: { name: 'Frodo', coat: 'brown' }, decor: ['weathervane-salmon'], party: null, trophies: ['bronze'] }; sc.setHomestead({ ...f, pieces: { ...all, barn: 0 } }); sc.setHomestead({ ...f, pieces: all }); sc.buildPiece('barn'); }, 4000); }],
      ['v1.5 the Sacramento claim (windmill, vineyard) in a portrait-sized farm', { backdrop: 'homestead', dog: 'spotted' }, () => { const sc = window.__ww.scene; sc.setHomestead({ site: 'sacramento', name: 'Gold Claim', pieces: { cabin: 1, well: 1, barn: 1, vineyard: 1, windmill: 1, fence: 1, corral: 1, garden: 3 }, animals: { oxen: 3, mules: 2 }, dog: { name: 'Frodo', coat: 'spotted' }, decor: [], party: null, trophies: [] }); sc.setBackdrop('homestead'); }],
    ]) {
      if (process.env.PERF_FILTER && !new RegExp(process.env.PERF_FILTER, 'i').test(name)) continue; // PERF_FILTER='stones|stars' runs some cases
      const { page, context, errors } = await open(browser, params);
      const cdp = await context.newCDPSession(page);
      await page.waitForTimeout(500);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const res = await page.evaluate((src) => new Promise((resolve) => {
        const sc = window.__ww.scene;
        (0, eval)('(' + src + ')')();
        sc.debugPerf(true);
        const per = [];
        const t0 = performance.now();
        const tick = () => {
          const p = sc.debugPerf(true);
          if (p.frames > 0) per.push((p.update + p.draw) / p.frames);
          if (performance.now() - t0 > 6000) {
            const b = per.slice(5).sort((x, y) => x - y);
            resolve({ frames: per.length, avg: b.reduce((x, y) => x + y, 0) / Math.max(1, b.length), p95: b[Math.floor(b.length * 0.95)] || 0 });
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }), setup.toString());
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      console.log(`    perf (4x throttle, 844x390 @2x, ${name}): ${res.frames} frames, game code per frame avg ${res.avg.toFixed(2)} ms, p95 ${res.p95.toFixed(2)} ms`);
      check(res.frames > 30 && res.avg < PERF_MS, `perf ${name}: avg ${res.avg.toFixed(2)} ms < ${PERF_MS} ms per frame at 4x CPU throttle`);
      check(errors.real().length === 0, `perf ${name}: no console errors (${errors.real().join(' | ')})`);
      await context.close();
    }
  }
} catch (e) {
  failures.push('exception: ' + e.message);
  console.error(e);
} finally {
  await browser.close();
  if (server) server.kill();
}
console.log(`\nScreenshots: ${SHOTS}`);
if (failures.length) { console.log(`\nFAILED (${failures.length}):\n- ` + failures.join('\n- ')); process.exit(1); }
console.log('\nALL CHECKS PASSED');

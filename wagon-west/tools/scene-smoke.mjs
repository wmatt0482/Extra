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

  // ---- 4. the hunt, run to huntEnd with scripted taps ----
  {
    const { page, context, errors } = await open(browser, { biome: 'prairie', moving: '0' });
    await page.evaluate(() => { window.__ww.scene.pause(); window.__ww.scene.startHunt({ seed: 7, shots: 5 }); });
    await step(page, 2);
    const s0 = await state(page);
    check(s0.mini && s0.mini.kind === 'hunt' && s0.mini.left === 5 && s0.mini.hits === 0, `startHunt: mini ${JSON.stringify(s0.mini)}`);
    await shot(page, 'hunt-0-start');
    const plan = ['tap', 'tap', 'key', 'miss', 'tap'];
    let wantMeat = 0, wantHits = 0;
    for (const [i, how] of plan.entries()) {
      if (how === 'miss') {
        await tapAt(page, 422, 90);
      } else {
        // wait for a fresh animal well inside the screen (for Space: crossing the aim line at the middle)
        let target = null;
        for (let n = 0; n < 400 && !target; n++) {
          await step(page, 1, false);
          const m = await page.evaluate(() => window.__ww.scene.debugMini());
          const ok = m.animals.filter((a) => a.state === 'run' && !a.targeted && a.x > 60 && a.x < 784);
          target = how === 'key' ? ok.find((a) => Math.abs(a.x - 422) < 10) : ok.sort((a, b) => b.r - a.r)[0];
        }
        if (!target) { check(false, `hunt shot ${i + 1}: no animal came by`); continue; }
        if (how === 'key') await keySpace(page); else await tapAt(page, target.x, target.y);
        wantHits++; wantMeat += MEAT[target.kind];
      }
      await step(page, 22);
      if (i === 0) await shot(page, 'hunt-1-got-one');
      await step(page, 40);
      const ev = await events(page, 'hunt');
      const last = ev[ev.length - 1];
      check(ev.length === i + 1 && last.hit === (how !== 'miss') && (how === 'miss' ? last.animal === null && last.meatLb === 0 : MEAT[last.animal] === last.meatLb), `hunt shot ${i + 1} (${how}): ${JSON.stringify(last)}`);
    }
    const sMid = await state(page);
    check(sMid.mini && sMid.mini.left === 0, `the quiver is empty after 5 shots (${JSON.stringify(sMid.mini)})`);
    let end = [];
    for (let n = 0; n < 20 && !end.length; n++) { await step(page, 15, false); end = await events(page, 'huntEnd'); }
    check(end.length === 1 && end[0].hits === wantHits && end[0].shots === 5 && end[0].meatLb === wantMeat, `huntEnd ${JSON.stringify(end[0])} (want ${wantHits} hits, ${wantMeat} lb, 5 shots)`);
    await step(page, 30);
    const s1 = await state(page);
    check(s1.mini === null && s1.view === 'trail', `after huntEnd the scene returns to the trail (view ${s1.view}, mini ${JSON.stringify(s1.mini)})`);
    await shot(page, 'hunt-2-after');
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

  // ---- 8. perf: real frames at 4x CPU throttle on a phone-sized canvas ----
  if (!process.env.SKIP_PERF) {
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
      ['Fort Derby with the dog (bursts and the finish)', { biome: 'highdesert', backdrop: 'fort', dog: 'brown' }, () => { const sc = window.__ww.scene; sc.startDerby({ seed: 3, length: 200 }); setInterval(() => { const s = sc.getState(); if (!s.mini) sc.startDerby({ seed: 4, length: 200 }); else if (s.mini.phase === 'wait') sc.derbyBurst(1); }, 60); }],
    ]) {
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

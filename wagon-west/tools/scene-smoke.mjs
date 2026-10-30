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

  // ---- 8. perf: real frames at 4x CPU throttle on a phone-sized canvas ----
  if (!process.env.SKIP_PERF) {
    const PERF_MS = Number(process.env.PERF_MS || 8);
    for (const [name, params, setup] of [
      ['stormy trail, a bison herd and confetti', { biome: 'mountains', weather: 'storm', pace: 'brisk' }, () => { const sc = window.__ww.scene; sc.spotAnimal('bison'); sc.spotAnimal('eagle'); sc.celebrate('arrived'); }],
      ['the hunt in the rain', { biome: 'prairie', weather: 'rain' }, () => window.__ww.scene.startHunt({ seed: 5, shots: 5 })],
      ['the river crossing at camp-time dusk', { biome: 'gorge', backdrop: 'river', weather: 'dusk' }, () => window.__ww.scene.celebrate('river')],
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

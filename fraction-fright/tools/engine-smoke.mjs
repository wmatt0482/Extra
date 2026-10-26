// Fraction Fright engine smoke test: drives fraction-fright/dev.html in headless Chromium (iPhone-landscape viewport,
// plus one portrait pass). Usage (from anywhere): node fraction-fright/tools/engine-smoke.mjs
// Serves the REPO ROOT on :8080 itself if nothing is listening. Env: SHOTS_DIR, BASE_URL, SKIP_PERF=1, PERF_MS (12).
// Checks step the simulation deterministically with game.debugStep (sim seconds, not wall clock):
//   1. contract shape, labels on the 0–1 road, throwAt lands exactly where aimed (err 0 → bull), the bounce item's
//      three hops + landing, the feedback beat (flag + jumps), slow-mo on a bull, cured + target events;
//   2. result bands at the thresholds (bull ≤ 1.5 %, hit ≤ tol, near ≤ 2 tol, miss), the hint ladder, the effort bonus;
//   3. a wave of 10 ends with waveEnd whose cash parts add up, 10 cured, per-item results;
//   4. big wave (3 at once + bigWave) and final wave (finalWave), reduced motion (no slow-mo);
//   5. a zombie that reaches the fence: knock → reached (a pumpkin), the wave continues, stop() → waveEnd stopped;
//   6. the 0–3 road: every whole + ½ labelled, throwAt maps across the span; a portrait pass; perf at 4x CPU throttle.
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const SHOTS = process.env.SHOTS_DIR || '/tmp/claude-0/-home-user-Extra/0887b907-788e-5c4e-a0e5-9e998f29e90b/scratchpad/ff-engine-shots';
mkdirSync(SHOTS, { recursive: true });

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch {}
  const roots = ['/home/node-tools/node_modules/'];
  try { roots.push(execSync('npm root -g').toString().trim() + '/'); } catch {}
  for (const r of roots) { try { return createRequire(r)('playwright'); } catch {} }
  throw new Error('playwright not found (tried local import, /home/node-tools, npm root -g)');
}
const { chromium } = await loadPlaywright();

let server = null;
const DEV = '/fraction-fright/dev.html';
async function ensureServer() {
  try { const res = await fetch(BASE + DEV); if (res.ok) return; } catch {}
  server = spawn('python3', ['-m', 'http.server', '8080'], { cwd: REPO, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try { const res = await fetch(BASE + DEV); if (res.ok) return; } catch {}
  }
  throw new Error('could not start http server');
}

const failures = [];
let passes = 0;
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (cond) passes++; else failures.push(msg); };
const STATE_KEYS = 'accuracy,aim,aimValue,big,cash,cured,final,hits,inFlight,lastThrow,live,number,pae,phase,pumpkins,reached,resolved,road,roadPx,street,target,throws,timeSec,total';
const SUMMARY_KEYS = ['street', 'number', 'big', 'final', 'cured', 'reached', 'throws', 'bulls', 'hits', 'nears', 'misses', 'pae', 'accuracy', 'hitRate', 'results', 'cash', 'pumpkins', 'durationSec', 'stopped'];
const sumOK = (c) => c.total === c.cure + c.bull + c.effort + c.final;

async function open(browser, params, viewport = { width: 844, height: 390 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const q = new URLSearchParams({ ui: '0', sound: '0', ...params }).toString();
  await page.goto(`${BASE}${DEV}?${q}`);
  await page.waitForFunction(() => window.__ff && window.__ff.game && window.__ff.game.getState().phase !== 'idle');
  await page.evaluate(() => window.__ff.game.pause()); // stepped by hand from here
  return { page, context, errors };
}
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const shot = async (page, name) => { await frame(page); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); console.log('    shot ' + name); };
const state = (page) => page.evaluate(() => window.__ff.game.getState());
const info = (page) => page.evaluate(() => window.__ff.game.debugInfo());
const events = (page, type) => page.evaluate((t) => window.__ff.events.filter((e) => e.type === t), type);
// step until `until` (JS over s = getState(), d = debugInfo(), ev = events, i = tick) or maxSec sim; returns the state
async function stepUntil(page, until, maxSec = 30) {
  return page.evaluate(({ until, maxSec }) => {
    const g = window.__ff.game, ev = window.__ff.events;
    const cond = new Function('s', 'd', 'ev', 'i', 'return (' + until + ');');
    let s = g.getState(), hit = false, i = 0, minScale = 1;
    for (; i < 60 * maxSec; i++) {
      s = g.debugStep(1);
      const d = g.debugInfo();
      if (d && d.timeScale < minScale) minScale = d.timeScale;
      if (cond(s, d, ev, i)) { hit = true; break; }
    }
    return { hit, sec: i / 60, state: s, info: g.debugInfo(), minScale };
  }, { until, maxSec });
}
const throwAt = (page, x01) => page.evaluate((x) => window.__ff.game.throwAt(x), x01);
// throw at x01 and step to the throw event; returns the throw event
async function throwAndLand(page, x01) {
  const n0 = (await events(page, 'throw')).length;
  const ok = await throwAt(page, x01);
  if (!ok) return null;
  await stepUntil(page, `ev.filter((e) => e.type === 'throw').length > ${n0}`, 10);
  const th = await events(page, 'throw');
  return th[th.length - 1];
}
// step to the end of the feedback beat (phase back to 'wave' or beyond)
const settle = (page) => stepUntil(page, "s.phase !== 'beat'", 10);

await ensureServer();
const browser = await chromium.launch();
try {
  // ======== 1. contract, labels, exact landing, hops, feedback, slow-mo ========
  {
    const { page, context, errors } = await open(browser, {});
    const s0 = await state(page);
    check(Object.keys(s0).filter((k) => STATE_KEYS.split(',').includes(k)).sort().join(',') === STATE_KEYS, `getState() has the contract keys (${Object.keys(s0).join(',')})`);
    check(s0.phase === 'wave' && s0.target && s0.target.id === 'q34' && s0.target.show === '3/4', `starts in phase 'wave' with the first item called (${s0.target && s0.target.show})`);
    check(s0.roadPx.left > 0 && s0.roadPx.right < 844 && s0.roadPx.right - s0.roadPx.left > 500 && s0.roadPx.y > 100 && s0.roadPx.y < 390, `roadPx is the on-screen span (${JSON.stringify(s0.roadPx)})`);
    const t0 = await events(page, 'target');
    check(t0.length === 1 && t0[0].item.id === 'q34' && t0[0].item.say === 'three quarters', `target event at start (${JSON.stringify(t0[0] && t0[0].item.show)})`);
    const d0 = await info(page);
    const labels = d0.road.labels.map((l) => l.text).join(' ');
    check(d0.road.labels.some((l) => l.at === 0 && l.text === '0') && d0.road.labels.some((l) => l.at === 0.5 && l.text === '½') && d0.road.labels.some((l) => l.at === 1 && l.text === '1'), `0–1 road labels 0, ½, 1 present (${labels})`);
    check(d0.zombies.length === 1 && d0.zombies[0].state === 'walk' && d0.shuffleSec === 20, `one zombie shuffling, 20 s to the fence on wave 1 (${d0.zombies.length}, ${d0.shuffleSec} s)`);
    await page.evaluate(() => window.__ff.game.setAim(0.6));
    const aimEv = await events(page, 'aim');
    check(aimEv.length >= 1 && Math.abs(aimEv[aimEv.length - 1].value - 0.6) < 1e-9, `setAim emits aim { x01, value } (${JSON.stringify(aimEv[aimEv.length - 1])})`);
    await stepUntil(page, 'i >= 30', 1);
    await shot(page, '1-start-aiming');
    // the bounce item: throwAt(0.75) -> touchdown at 0, hops to 1/4, 1/2, lands on 3/4
    const ok = await throwAt(page, 0.75);
    const d1 = await info(page);
    check(ok && d1.throwState && d1.throwState.hops === 3 && d1.throwState.touchdowns.length === 3, `bounce item flies with 3 hops (${d1.throwState && d1.throwState.hops} hops, ${d1.throwState && d1.throwState.touchdowns.length} touchdowns)`);
    check(d1.throwState && d1.throwState.touchdowns.map((h) => Math.round(h.v * 1000) / 1000).join(',') === '0,0.25,0.5', `touchdowns at 0, ¼, ½ (${d1.throwState && d1.throwState.touchdowns.map((h) => h.v.toFixed(3)).join(',')})`);
    const s1 = await state(page);
    check(s1.phase === 'beat' && s1.inFlight, `phase 'beat' while the grenade flies`);
    check(!(await throwAt(page, 0.5)), 'a second throw is refused while one is in flight');
    const mid = await stepUntil(page, 'd.throwState && d.throwState.t >= d.throwState.touchdowns[1].t + 0.12', 5);
    await shot(page, '2-bounce-hop');
    const boings = (await events(page, 'sound')).filter((e) => e.name === 'boing').length;
    check(mid.hit && boings === 2, `a boing per hop so far (${boings})`);
    const r1 = await stepUntil(page, "ev.some((e) => e.type === 'throw')", 5);
    const th = (await events(page, 'throw'))[0];
    check(!!th && th.err === 0 && th.pae === 0 && th.result === 'bull' && th.close === 100, `throwAt(0.75) on 3/4 lands exactly: err ${th && th.err}, pae ${th && th.pae}, result ${th && th.result}, close ${th && th.close}`);
    check(th && th.item.id === 'q34' && th.attempt === 1 && th.cash.cure === 120 && th.cash.bull === 60 && th.cash.effort === 0, `throw event fields (${JSON.stringify(th && { item: th.item.id, attempt: th.attempt, cash: th.cash, tolerance: th.tolerance })})`);
    const boingsAll = (await events(page, 'sound')).filter((e) => e.name === 'boing').length;
    check(boingsAll === 3 && (await events(page, 'sound')).some((e) => e.name === 'thunkBig'), `3 boings then the big thunk (${boingsAll} boings)`);
    const dl = await info(page);
    check(dl.feedback && dl.feedback.result === 'bull' && dl.feedback.jumps === 3 && Math.abs(dl.feedback.unit - 0.25) < 1e-9 && Math.abs(dl.feedback.target - 0.75) < 1e-9, `feedback beat: the true-spot flag at 0.75 and 3 unit jumps of ¼ (${JSON.stringify(dl.feedback)})`);
    const slow = await stepUntil(page, 'i >= 12', 1);
    check(slow.minScale < 0.5, `bull: slow-mo kicks in (timeScale ${slow.minScale})`);
    await stepUntil(page, 'i >= 20', 1);
    await shot(page, '3-bull-feedback');
    const r2 = await stepUntil(page, "ev.some((e) => e.type === 'cured')", 3);
    const cu = (await events(page, 'cured'))[0];
    check(r2.hit && cu && cu.item.id === 'q34' && cu.result === 'bull', `cured event ≈ ${r2.sec.toFixed(2)} s after the thunk (${JSON.stringify(cu && cu.item.show)})`);
    const r3 = await stepUntil(page, "s.phase === 'wave'", 5);
    const s3 = await state(page);
    const t3 = await events(page, 'target');
    check(r3.hit && s3.target && s3.target.id === 'e58' && t3.length === 2 && t3[1].item.id === 'e58', `after the beat: aiming again, next target called (${s3.target && s3.target.show}, ${t3.length} target events)`);
    check(s3.cured === 1 && s3.live.length >= 1 && s3.live.some((z) => z.state === 'walk' && !z.cured), `a cure spawns the next zombie (live: ${s3.live.map((z) => z.state).join(',')})`);
    check(s3.cash === 180, `running cash $180 after a bull cure (${s3.cash})`);
    await stepUntil(page, 'i >= 30', 1);
    await shot(page, '4-neighbour-walks-home');
    // ======== 2. result bands on 5/8 (tolerance 0.10): miss, near, hit at the edge (+ effort bonus) ========
    const tgt = 0.625;
    let e = await throwAndLand(page, tgt + 0.25);
    check(e && e.result === 'miss' && Math.abs(e.err - 0.25) < 1e-9 && e.close === 75 && e.hint === 'arrow', `5/8 + 0.25 → miss, "75 % close", next hint arrow (${e && e.result}, ${e && e.close}, ${e && e.hint})`);
    await stepUntil(page, 'i >= 20', 1);
    await shot(page, '5-miss-feedback');
    await settle(page);
    let s4 = await state(page);
    check(s4.target && s4.target.id === 'e58' && s4.target.attempt === 2 && s4.target.hint === 'arrow', `the same item again, attempt 2 with the arrow hint (${JSON.stringify(s4.target && { id: s4.target.id, attempt: s4.target.attempt, hint: s4.target.hint })})`);
    const dn = await info(page);
    check(dn.nudge && Math.abs(dn.nudge.to - tgt) < 1e-9, `the nudge arrow points at the true spot (${JSON.stringify(dn.nudge)})`);
    e = await throwAndLand(page, tgt + 0.15);
    check(e && e.result === 'near' && e.hint === 'ticks', `5/8 + 0.15 → near (2 × tol), next hint ticks (${e && e.result}, ${e && e.hint})`);
    await stepUntil(page, 'i >= 20', 1);
    await shot(page, '6-near-feedback');
    await settle(page);
    const tk = await stepUntil(page, 'd.ticksAlpha > 0.9', 3);
    check(tk.hit, `the denominator's ticks fade in for the next throw (alpha ${tk.info.ticksAlpha.toFixed(2)})`);
    await shot(page, '7-ticks-hint');
    e = await throwAndLand(page, tgt + 0.10);
    check(e && e.result === 'hit' && e.cash.effort === 40 && e.cash.cure === 60 && e.cash.bull === 0, `5/8 + 0.10 → hit at the tolerance edge, effort bonus $40 after a near (${e && e.result}, ${JSON.stringify(e && e.cash)})`);
    await settle(page);
    await stepUntil(page, "ev.filter((e) => e.type === 'cured').length >= 2", 3);
    // bull band edge on 1/2 (+0.014) and hit just past it on 1/4 (+0.016)
    await stepUntil(page, "s.phase === 'wave' && s.target && s.target.id === 'h12'", 5);
    e = await throwAndLand(page, 0.5 + 0.014);
    check(e && e.result === 'bull' && e.pae === 1.4, `½ + 0.014 → bull (≤ 1.5 %) (${e && e.result}, pae ${e && e.pae})`);
    await stepUntil(page, "s.phase === 'wave' && s.target && s.target.id === 'q14'", 8);
    e = await throwAndLand(page, 0.25 + 0.016);
    check(e && e.result === 'hit' && e.pae === 1.6 && e.cash.cure < 120 && e.cash.cure > 100, `¼ + 0.016 → hit, cure cash scaled by accuracy (${e && e.result}, $${e && e.cash.cure})`);
    await stepUntil(page, "s.phase === 'wave' && s.target && s.target.id === 't23'", 8);
    e = await throwAndLand(page, 2 / 3 + 0.2 + 1e-6);
    check(e && e.result === 'miss', `⅔ + 0.2000 → miss (just past 2 × tol) (${e && e.result})`);
    await settle(page);
    // ======== 3. finish the wave of 10 exactly; waveEnd summary ========
    const r4 = await page.evaluate(() => new Promise((resolve) => {
      const g = window.__ff.game, ff = window.__ff;
      let i = 0;
      for (; i < 60 * 120 && !ff.finished; i++) {
        const s = g.debugStep(1);
        if (s.phase === 'wave' && s.target && !s.inFlight) g.throwAt((s.target.target - s.road.from) / (s.road.to - s.road.from));
        if (s.phase === 'calm' && !window.__calmShot) { window.__calmShot = i; }
      }
      resolve({ sec: i / 60, finished: ff.finished, calm: ff.events.filter((e) => e.type === 'calm').length });
    }));
    const S = r4.finished;
    check(!!S && r4.calm === 1, `the wave ends with waveEnd after a calm beat (${r4.sec.toFixed(1)} s sim, calm events ${r4.calm})`);
    if (S) {
      check(SUMMARY_KEYS.every((k) => k in S), `summary shape (${Object.keys(S).join(',')})`);
      check(S.cured === 10 && S.reached === 0 && S.results.length === 10 && S.results.every((r) => r.cured), `10 cured, 10 per-item results (${S.cured} cured, ${S.results.length} results)`);
      check(sumOK(S.cash) && S.cash.final === 0, `cash parts add up: ${JSON.stringify(S.cash)}`);
      check(S.throws === 13 && S.bulls === 8 && S.hits === 10 && S.nears === 1 && S.misses === 2, `throw counts (throws ${S.throws}, bulls ${S.bulls}, hits ${S.hits}, near ${S.nears}, miss ${S.misses})`);
      check(S.cash.cure === S.results.reduce((a, r) => a + r.cash.cure, 0) && S.cash.bull === 8 * 60 && S.cash.effort === 40, `cure cash is the per-item sum, bull $60 × 8, effort $40 once (${S.cash.cure}, ${S.cash.bull}, ${S.cash.effort})`);
      check(S.pae > 0 && S.pae < 10 && S.accuracy === Math.round(100 - S.pae), `mean PAE ${S.pae} %, accuracy ${S.accuracy} %`);
      check(!S.stopped && S.pumpkins === 5, `not stopped, all pumpkins kept`);
    }
    const s5 = await state(page);
    check(s5.phase === 'done' && !(await throwAt(page, 0.5)), `phase 'done' after waveEnd, throws refused`);
    await shot(page, '8-wave-done');
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  // ======== 4. big wave + final wave, reduced motion ========
  {
    const { page, context, errors } = await open(browser, { big: '1', final: '1', rm: '1' });
    const bw = await events(page, 'bigWave'), fw = await events(page, 'finalWave');
    check(bw.length === 1 && bw[0].count === 3 && fw.length === 1, `bigWave { count: 3 } and finalWave fire at the start`);
    await stepUntil(page, 'i >= 60 * 4', 5);
    const s = await state(page);
    check(s.live.length === 3 && s.live.every((z) => z.state === 'walk'), `3 zombies at once in the big wave (${s.live.map((z) => z.look + '/' + z.hat).join(', ')})`);
    check(new Set(s.live.map((z) => z.look)).size === 3, `three different looks on screen`);
    await shot(page, '9-big-final-wave');
    const e = await throwAndLand(page, 0.75);
    const slow = await stepUntil(page, 'i >= 15', 1);
    check(e && e.result === 'bull' && slow.minScale === 1, `reduced motion: a bull without slow-mo (timeScale ${slow.minScale})`);
    await settle(page);
    const s2 = await state(page);
    check(s2.live.filter((z) => !z.cured && z.state === 'walk').length === 3 && s2.cured === 1, `a cure in the big wave spawns a replacement (3 walking, 1 cured)`);
    await stepUntil(page, 'i >= 30', 1);
    await shot(page, '10-big-wave-cure');
    await page.evaluate(() => window.__ff.game.stop());
    const st = await events(page, 'waveEnd');
    check(st.length === 1 && st[0].stopped === true && st[0].final === true && st[0].big === true && sumOK(st[0].cash) && st[0].cash.final === st[0].cash.cure + st[0].cash.bull + st[0].cash.effort && st[0].cash.total === 360, `stop() emits waveEnd { stopped: true }; final wave doubles the cash (${JSON.stringify(st[0] && st[0].cash)})`);
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  // ======== 5. a zombie reaches the fence ========
  {
    const { page, context, errors } = await open(browser, { n: '3', wave: '5' });
    const d = await info(page);
    check(d.shuffleSec === 14, `wave 5 shuffles in 14 s, never faster (${d.shuffleSec} s)`);
    const k = await stepUntil(page, "ev.some((e) => e.type === 'knock')", 20);
    check(k.hit && k.sec > 13.5 && k.sec < 14.5, `the zombie knocks at the fence after ${k.sec.toFixed(1)} s`);
    await stepUntil(page, 'i >= 25', 1);
    await shot(page, '11-knock');
    const rc = await stepUntil(page, "ev.some((e) => e.type === 'reached')", 5);
    const re = (await events(page, 'reached'))[0];
    check(rc.hit && re && re.item.id === 'q34' && re.pumpkins === 4, `reached { item, pumpkins: 4 } (${JSON.stringify(re && { item: re.item.show, pumpkins: re.pumpkins })})`);
    const s = await state(page);
    const tg = await events(page, 'target');
    check(s.phase === 'wave' && s.target && s.target.id === 'e58' && tg.length === 2 && s.reached === 1 && s.pumpkins === 4, `the wave continues with the next item (${s.target && s.target.show}, phase ${s.phase})`);
    await stepUntil(page, 'i >= 40', 1);
    await shot(page, '12-shuffles-off');
    const e = await throwAndLand(page, 0.625);
    check(e && e.result === 'bull', 'the next item can be cured');
    await page.evaluate(() => window.__ff.game.stop()); // right after the thunk: the pending cure is flushed into the summary
    const st = (await events(page, 'waveEnd'))[0];
    const cu = await events(page, 'cured');
    check(cu.length === 1 && st && st.stopped && st.reached === 1 && st.cured === 1 && st.results[0].reached && st.results[1].cured && st.results[2].result === null, `stopped summary: 1 reached, 1 cured, the third untouched (${JSON.stringify(st && st.results.map((r) => [r.show, r.result, r.reached, r.cured]))})`);
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  // ======== 6. the 0–3 road, portrait, perf ========
  {
    const { page, context, errors } = await open(browser, { road: '3' });
    const d = await info(page);
    const want = [[0, '0'], [0.5, '½'], [1, '1'], [2, '2'], [3, '3']];
    check(want.every(([at, text]) => d.road.labels.some((l) => Math.abs(l.at - at) < 1e-9 && l.text === text)), `0–3 road labels 0, ½, 1, 2, 3 present (${d.road.labels.map((l) => l.text).join(' ')})`);
    const s0 = await state(page);
    check(s0.road.from === 0 && s0.road.to === 3 && s0.target.show === '1½', `road 0–3, first item 1½`);
    const e = await throwAndLand(page, 0.5);
    check(e && Math.abs(e.aimed - 1.5) < 1e-9 && e.err === 0 && e.result === 'bull', `throwAt(0.5) lands at 1.5 on the 0–3 road (aimed ${e && e.aimed}, ${e && e.result})`);
    await stepUntil(page, 'i >= 25', 1);
    await shot(page, '13-road-0-3');
    await settle(page);
    await stepUntil(page, "s.phase === 'wave' && s.target && s.target.id === 'i74'", 5);
    const ok = await throwAt(page, 1.75 / 3);
    const d2 = await info(page);
    check(ok && d2.throwState.hops === 7 && d2.throwState.touchdowns.map((h) => Math.round(h.v * 100) / 100).join(',') === '0,0.25,0.5,0.75,1,1.25,1.5', `7/4 bounces 7 unit hops from 0 (${d2.throwState.touchdowns.map((h) => h.v.toFixed(2)).join(',')})`);
    await stepUntil(page, 'd.throwState && d.throwState.t >= d.throwState.touchdowns[4].t + 0.1', 6);
    await shot(page, '14-road-0-3-hops');
    const e2 = await stepUntil(page, "ev.filter((x) => x.type === 'throw').length >= 2", 6);
    const th2 = (await events(page, 'throw'))[1];
    check(e2.hit && th2.result === 'bull' && Math.abs(th2.aimed - 1.75) < 1e-9, `lands on 7/4 (${th2 && th2.aimed})`);
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }
  {
    const { page, context, errors } = await open(browser, { big: '1' }, { width: 390, height: 844 });
    const d = await info(page);
    check(d.road.labels.map((l) => l.text).join(' ') === '0 ½ 1' && d.road.x1 - d.road.x0 > 300, `portrait: labels present, road ${Math.round(d.road.x1 - d.road.x0)} px wide`);
    await stepUntil(page, 'i >= 60 * 3', 4);
    const e = await throwAndLand(page, 0.75);
    await stepUntil(page, 'i >= 22', 1);
    check(e && e.result === 'bull', 'portrait: throwAt lands exactly');
    await shot(page, '15-portrait-bull');
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
    await context.close();
  }
} catch (e) {
  failures.push('exception: ' + e.message);
  console.error(e);
}
try {
  // ---- perf: the big wave (3 zombies on screen), exact throws every 2.2 s, 4x CPU throttle, real-time frames ----
  if (!process.env.SKIP_PERF) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}${DEV}?ui=0&sound=0&big=1&n=12&weather=fog`);
    await page.waitForFunction(() => window.__ff && window.__ff.game && window.__ff.game.getState().phase === 'wave');
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const res = await page.evaluate(() => new Promise((resolve) => {
      const g = window.__ff.game;
      g.debugPerf(true);
      const norm = [], raw = [];
      const t0 = performance.now();
      let lastThrow = 0, maxLive = 0;
      const tick = () => {
        const p = g.debugPerf(true);
        const s = g.getState();
        maxLive = Math.max(maxLive, s.live.filter((z) => !z.cured).length);
        if (p.frames > 0 && p.ticks > 0) { raw.push((p.sim + p.draw) / p.frames); norm.push(p.sim / p.ticks + p.draw / p.frames); }
        const now = performance.now();
        if (s.phase === 'wave' && s.target && now - lastThrow > 2200) { lastThrow = now; g.setAim((s.target.target - s.road.from) / (s.road.to - s.road.from)); g.throw(); }
        if (now - t0 > 12000) {
          const st = (a) => { const b = a.slice().sort((x, y) => x - y); return { avg: a.reduce((x, y) => x + y, 0) / Math.max(1, a.length), p95: b[Math.floor(b.length * 0.95)] || 0 }; };
          resolve({ frames: raw.length, norm: st(norm), raw: st(raw), cured: s.cured, maxLive });
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(`    perf (4x throttle, big wave, up to ${res.maxLive} zombies): ${res.frames} frames, per 60 Hz frame avg ${res.norm.avg.toFixed(2)} ms (p95 ${res.norm.p95.toFixed(2)}), per rendered frame avg ${res.raw.avg.toFixed(2)} ms, cured ${res.cured}`);
    const PERF_MS = Number(process.env.PERF_MS || 12);
    if (res.norm.avg >= 8) console.log(`    perf WARNING: ${res.norm.avg.toFixed(2)} ms per frame is over the 8 ms reference budget (hard limit ${PERF_MS} ms)`);
    check(res.maxLive >= 3 && res.norm.avg < PERF_MS, `perf: game code per 60 Hz frame avg ${res.norm.avg.toFixed(2)} ms < ${PERF_MS} ms at 4x CPU throttle with 3 zombies`);
    check(errors.length === 0, `perf: no page errors (${errors.join(' | ')})`);
    await context.close();
  }
} catch (e) {
  failures.push('exception: ' + e.message);
  console.error(e);
} finally {
  await browser.close();
  if (server) server.kill();
}
console.log(`\n${passes} passed, ${failures.length} failed${failures.length ? ':\n  ' + failures.join('\n  ') : ''}`);
console.log(`shots: ${SHOTS}`);
process.exit(failures.length ? 1 : 0);

// v1.9.1: a race's result must not depend on the device's speed. The same race, with the same answers, is run at 1x
// CPU and at 6x CPU throttle (CDP Emulation.setCPUThrottlingRate), also with jittered frames (requestAnimationFrame
// delayed by a seeded 0-90 ms), and the finishing order, the player's time and place must come out the same.
//   runMockFrameRateCheck (tools/ui-smoke.mjs): the mock engine (src/meta/mockEngine.js), ui-smoke's race 1 script:
//     Pine Ridge, 4 Math Gates answered quick / fixed / quick / quick + turbo, the planned crash. Before 1.9.1 the mock
//     stepped on the frame's dt: gate 2 stopped the player anywhere from 296 to 303 m with the frame rate, and below
//     300 m the crash respawned at the 200 m checkpoint (+1.1 s): 2nd at one frame rate, 3rd at another.
//   runEngineFrameRateCheck (tools/engine-smoke.mjs): the real engine (dev.html: Pine Ridge, 3 AI riders, GAS held,
//     4 gates answered by auto=1), which steps a fixed 1/60 s with every rider in the same step.
// Gates are answered after a wall-clock delay: the race is frozen while a gate is open, so the delay changes nothing.

const JITTER_MS = 90;
// a seeded rAF delay: every frame comes 0-90 ms late (dt from ~16 to ~110 ms, varying frame to frame)
const jitterScript = (jit) => {
  if (!(jit > 0)) return;
  const raf = window.requestAnimationFrame.bind(window);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  window.requestAnimationFrame = (cb) => { setTimeout(() => raf(cb), rnd() * jit); return 0; };
};
const frameStats = (fr) => { const s = fr.slice().sort((a, b) => a - b); return { frames: s.length, med: Math.round(s[s.length >> 1] || 0), p90: Math.round(s[Math.floor(s.length * 0.9)] || 0) }; };
const RUNS = [{ rate: 1, jitter: 0, label: '1x' }, { rate: 6, jitter: 0, label: '6x' }, { rate: 6, jitter: JITTER_MS, label: `6x + 0-${JITTER_MS} ms frame jitter` }];

async function throttled(browser, run, url, fn, arg, routeHtml) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  try {
    if (routeHtml) await ctx.route(url, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: routeHtml }));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(jitterScript, run.jitter);
    await page.goto(url);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: run.rate });
    const out = await page.evaluate(fn, arg);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    return { ...out, errors };
  } finally { await ctx.close(); }
}

function compare(name, results, check, extra) {
  const [base] = results;
  for (const r of results) console.log(`    ${name} at ${r.label}: ${r.order} · you ${r.place} in ${r.time} s · frames ${JSON.stringify(r.fps)}${r.note ? ' · ' + r.note : ''}`);
  const slow = results[results.length - 1];
  check(slow.fps.p90 >= 40 && slow.fps.p90 > base.fps.p90 * 1.8, `${name}: the throttled + jittered run really ran at a lower, uneven frame rate (p90 frame ${base.fps.p90} → ${slow.fps.p90} ms)`);
  check(results.every((r) => r.order === base.order), `${name}: the same finishing order at ${results.map((r) => r.label).join(' / ')} (${base.order})`);
  check(results.every((r) => r.time === base.time && r.place === base.place), `${name}: the same time and place for the player (${results.map((r) => `${r.time} s ${r.place}`).join(' / ')})`);
  if (extra) extra(base);
  check(results.every((r) => !r.errors.length), `${name}: no page errors (${results.flatMap((r) => r.errors).join(' | ')})`);
}

export async function runMockFrameRateCheck(browser, BASE, { check }) {
  console.log('\n=== v1.9.1: the mock race at 1x and 6x CPU (frame-rate independence) ===');
  const url = `${BASE}/trail-blazer/__frame-rate-check.html`;
  const html = '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><div style="width:844px;height:390px"><canvas style="width:100%;height:100%"></canvas></div></body>';
  const results = [];
  for (const run of RUNS) {
    const out = await throttled(browser, run, url, async () => {
      const { createGame } = await import('/trail-blazer/src/meta/mockEngine.js');
      const { TRAIL_BY_ID } = await import('/trail-blazer/src/data/trails.js');
      window.__mockScript = {};                       // the default script: the crash planned, the AI at 7.0 / 9.6 / 10.4 s
      const answers = [{ correct: true, quick: true }, { fixed: true }, { correct: true, quick: true }, { correct: true, quick: true, turbo: true }];
      return new Promise((resolve) => {
        const fr = []; let last = 0, done = false, respawnX = null; const stops = [];
        const tick = (now) => { if (last) fr.push(now - last); last = now; if (!done) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
        const game = createGame(document.querySelector('canvas'), { onEvent: (e) => {
          if (e.type === 'gate') setTimeout(() => { stops.push(Math.round(game.getState().distance)); game.openGate(answers[e.index]); }, 250);
          if (e.type === 'respawn') respawnX = e.x;
          if (e.type === 'finish') {
            done = true;
            const s = e.summary;
            setTimeout(() => game.destroy(), 0);       // not from inside the engine's step
            resolve({ order: s.riders.slice().sort((a, b) => a.place - b.place).map((r) => r.name).join(' > '), place: s.place, time: s.timeSec, fr, note: `gate stops ${stops.join(', ')} m, respawn ${respawnX} m` });
          }
        } });
        game.start({ trail: TRAIL_BY_ID['pine-ridge'], gates: 4, paint: 'sage', stats: { coinMult: 1 }, race: { name: 'Mia', riders: [{ name: 'Dusty' }, { name: 'Blaze' }, { name: 'Nitro' }] } });
      });
    }, null, html);
    results.push({ ...out, label: run.label, fps: frameStats(out.fr) });
  }
  compare('mock race', results, check, (b) => check(b.place === 2 && b.order === 'Dusty > Mia > Blaze > Nitro', `mock race: race 1's script finishes 2nd (${b.order}, ${b.time} s)`));
}

export async function runEngineFrameRateCheck(browser, BASE, { check }) {
  console.log('\n=== v1.9.1: the real engine race at 1x and 6x CPU (frame-rate independence) ===');
  // sim=2: two fixed steps per 1/60 s (the same steps, half the wall time); GAS held from the start; auto=1 answers the gates
  const url = `${BASE}/trail-blazer/dev.html?ui=0&trail=pine-ridge&race=1&riders=3&gates=4&auto=1&seed=7&sim=2`;
  const results = [];
  for (const run of [RUNS[0], RUNS[2]]) {          // 1x and 6x + jitter (a real-engine race is ~30 s of wall time each)
    const out = await throttled(browser, run, url, async () => {
      await new Promise((r) => { const w = () => (window.__tb && window.__tb.game ? r() : setTimeout(w, 20)); w(); });
      const tb = window.__tb;
      tb.game.setInput({ gas: true }); tb.restart(); tb.game.setInput({ gas: true });
      const fr = []; let last = 0;
      const tick = (now) => { if (last) fr.push(now - last); last = now; if (!tb.finished) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      await new Promise((r) => { const w = () => (tb.finished ? r() : setTimeout(w, 100)); w(); });
      const s = tb.finished;
      const gates = tb.events.filter((e) => e.type === 'gateOpen').length;
      return { order: s.riders.slice().sort((a, b) => a.place - b.place).map((r) => `${r.me ? 'You' : r.name}${r.timeSec != null ? ' ' + r.timeSec : ''}`).join(' > '), place: s.place, time: s.timeSec, fr, note: `${gates} gates` };
    });
    results.push({ ...out, label: run.label, fps: frameStats(out.fr) });
  }
  compare('engine race', results, check, (b) => check(b.place >= 1 && b.place <= 4 && /4 gates/.test(b.note), `engine race: a full race with 4 gates answered (${b.note})`));
}

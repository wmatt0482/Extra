// Trail Blazer: question / answer agreement (v1.8.1), standalone or called from ui-smoke.mjs.
//   node trail-blazer/tools/gate-agreement.mjs         (serves the REPO ROOT on :8080 itself if nothing listens there)
//   BASE_URL=http://localhost:8103 node trail-blazer/tools/gate-agreement.mjs
// The owner reported "the math game says 9x12 is 96". Whatever the cause, it must be impossible for a gate to show one fact and
// grade, read aloud, reveal or record another: this drives 60 gates in a row on the mock engine (trail races with their
// Turbo gate, and Hill Climb bursts, alternating) and asserts, at every gate, that the fact on screen, the panel's fact and
// answer, the spoken question, the answer revealed after a miss (message, tiles, hint) and the fact the app records all agree
// with the true arithmetic of the numbers on screen.
import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v1.8.1: question / answer agreement. Drives gates in a row across the race gates (turbo included) and the Hill Climb: at every
// gate the fact on screen, the panel's fact and answer, the spoken question, the answer revealed after a miss (message, tiles,
// hint) and the fact the app records must all agree with the true arithmetic of the numbers on screen ("9 × 12 is 96" must be
// impossible). Every third gate is answered wrong first (reveal + copy), the rest right.
export async function gateAgreementSweep(page, layout, want = 60, { J, typeAnswer, check, visibleSel }) {
  const seen = { gate: 0, turbo: 0, hill: 0, missed: 0, total: 0 };
  const problems = [];
  const truth = (q) => { const m = /^(\d+) ([×÷+−]) (\d+)$/.exec(q.trim()); if (!m) return NaN; const a = +m[1], b = +m[3]; return m[2] === '×' ? a * b : m[2] === '÷' ? a / b : m[2] === '+' ? a + b : a - b; };
  const read = () => J(page, async () => {
    const T = window.__trailBlazer, g = T.gate;
    const F = await import('/trail-blazer/src/facts/facts.js');
    return { results: T.screen === 'results', open: g.open, state: g.state, mode: g.mode, fact: g.fact, flip: g.flip, answer: g.answer,
      q: document.querySelector('#gp-q').textContent, shown: [...document.querySelectorAll('#gp-tiles .gp-tile')].map((t) => t.textContent).join(''),
      msg: document.querySelector('#gp-msg').textContent, hint: document.querySelector('#gp-hint').hidden ? '' : document.querySelector('#gp-hint').textContent,
      chip: document.querySelector('#gp-chip').textContent, title: document.querySelector('#gp-title-text').textContent, spoken: window.__spoken.slice(-6),
      text: g.fact ? F.factText(g.fact, g.flip) : '', sentence: g.fact ? F.questionSentence(g.fact, g.flip) : '', full: g.fact ? F.fullSentence(g.fact, g.flip) : '',
      turbo: document.querySelector('#gate').classList.contains('turbo'), hillFacts: T.hill ? T.hill.answers.length : -1, runFacts: T.run && T.run.facts ? T.run.facts.length : -1,
      lastRun: T.run && T.run.facts && T.run.facts.length ? T.run.facts[T.run.facts.length - 1].fact : null, lastHill: T.hill && T.hill.answers.length ? T.hill.answers[T.hill.answers.length - 1].fact : null };
  });
  // (from the third ride on the parent's set is ×8 ×9 ×12 with ÷: the 12 family, its commuted facts and the division inverse are what is asked)
  const startRide = (hill, manual) => J(page, ([h, m]) => { const T = window.__trailBlazer, a = T.app; if (m) { T.facts.sets.mode = 'manual'; T.facts.sets.families = ['x8', 'x9', 'x12']; T.facts.sets.division = true; a.persistFacts && a.persistFacts(); } a.setSetting('hill', h); window.__mockScript = { noCrash: true, aiTimes: [9, 9.6, 10.4], hillAutoSec: 0.4 }; a.startRide('pine-ridge', { skipCheck: true }); }, [hill, manual]);
  let ride = 0;
  while (seen.total < want && ride < 14) {
    ride++;
    await startRide(ride % 2 === 0, ride >= 3);                // trail races (race gates) and climbs (hill bursts) alternate
    if (process.env.GA_DEBUG) console.log(`ride ${ride} (${ride % 2 === 0 ? 'hill' : 'race'}) starts`);
    await page.waitForFunction(() => window.__trailBlazer.screen === 'ride', null, { timeout: 8000 });
    const end = Date.now() + 70000;
    let lastKey = '';
    while (Date.now() < end && seen.total < want) {
      const st = await read();
      if (st.results) break;
      if (!(st.open && st.state === 'ask')) {
        if (await J(page, () => !!window.__trailBlazer.coaching)) await page.click('#coach').catch(() => {});      // (the first race's coach card waits for a tap)
        await page.waitForTimeout(100); continue;
      }
      if (process.env.GA_DEBUG) console.log(`  gate ${seen.total + 1} ride ${ride} ${st.mode} ${st.q} = ${st.answer} (${st.chip})`);
      const tag = `${st.mode} #${seen.total + 1} "${st.q}" (fact ${st.fact}, flip ${st.flip})`;
      const t = truth(st.q);
      if (st.q !== st.text) problems.push(`${tag}: the screen shows "${st.q}", the panel's fact is "${st.text}"`);
      if (t !== st.answer) problems.push(`${tag}: the panel grades ${st.answer}, the numbers on screen make ${t}`);
      // (the voice queue is asynchronous: wait for the question to be heard, as a child would, before answering)
      const heard = await page.waitForFunction((x) => window.__spoken.includes(x), st.sentence, { timeout: 3000 }).then(() => true).catch(() => false);
      if (!heard) problems.push(`${tag}: not read aloud as "${st.sentence}" (${JSON.stringify((await read()).spoken.slice(-3))})`);
      if (st.mode === 'hill' ? !/^Burst \d+ of \d+$/.test(st.chip) || st.title !== 'Hill Climb' : !/^Gate \d+ of \d+/.test(st.chip)) problems.push(`${tag}: chip "${st.chip}" / title "${st.title}" do not match the mode`);
      const key = `${st.mode}|${st.chip}|${st.fact}|${st.flip}`;
      if (key === lastKey) { await page.waitForTimeout(100); continue; }         // (the same question still closing)
      lastKey = key;
      const wrong = seen.total % 3 === 1;
      const before = { run: st.runFacts, hill: st.hillFacts };
      if (wrong) {
        seen.missed++;
        await typeAnswer(page, t + 1);
        await page.waitForFunction(() => window.__trailBlazer.gatePanel.state === 'show', null, { timeout: 4000 });
        const sh = await read();
        if (sh.q !== st.q) problems.push(`${tag}: the question changed to "${sh.q}" after the miss`);
        if (sh.msg !== `${st.q} = ${t}`) problems.push(`${tag}: the reveal says "${sh.msg}", true "${st.q} = ${t}"`);
        if (sh.shown !== String(t)) problems.push(`${tag}: the revealed tiles read "${sh.shown}", true ${t}`);
        const nums = [...sh.hint.matchAll(/\d+/g)].map((m) => +m[0]);
        if (!sh.hint || nums[nums.length - 1] !== t) problems.push(`${tag}: the hint "${sh.hint}" does not end on ${t}`);
        for (const m of sh.hint.replace(/take away \d+ × \d+ \(\d+\)/g, 'take away X').matchAll(/(\d+) ([×÷+−]) (\d+) (?:=|is) (\d+)/g)) {
          const a = +m[1], b = +m[3], v = m[2] === '×' ? a * b : m[2] === '÷' ? a / b : m[2] === '+' ? a + b : a - b;
          if (v !== +m[4]) problems.push(`${tag}: the hint "${sh.hint}" says ${m[0]}, true ${v}`);
        }
        const heardFull = await page.waitForFunction((x) => window.__spoken.some((t) => t.startsWith(x)), st.full, { timeout: 2500 }).then(() => true).catch(() => false);
        if (!heardFull) problems.push(`${tag}: the reveal is not read as "${st.full} …" (${JSON.stringify(sh.spoken.slice(-2))})`);
        await page.waitForFunction(() => window.__trailBlazer.gatePanel.state === 'copy', null, { timeout: 4000 });
        await typeAnswer(page, t);
      } else {
        await typeAnswer(page, t);
        const ok = await page.waitForFunction(() => window.__trailBlazer.gatePanel.state === 'right' || !window.__trailBlazer.gatePanel.isOpen, null, { timeout: 4000 }).then(() => true).catch(() => false);
        if (ok) { const rt = await read(); if (rt.open && !rt.msg.startsWith(`${t}!`)) problems.push(`${tag}: the right-answer message "${rt.msg}" does not name ${t}`); }
      }
      await page.waitForFunction(() => !window.__trailBlazer.gatePanel.isOpen, null, { timeout: 4000 });
      // the fact the app recorded is the fact that was asked
      await page.waitForTimeout(60);
      const after = await read();
      if (st.mode === 'hill') { if (after.hillFacts > before.hill && after.lastHill !== st.fact) problems.push(`${tag}: the hill recorded ${after.lastHill}`); seen.hill++; }
      else { if (after.runFacts > before.run && after.lastRun !== st.fact) problems.push(`${tag}: the race recorded ${after.lastRun}`); if (st.turbo) seen.turbo++; seen.gate++; }
      seen.total++;
    }
    // let the ride finish (answer anything left) before the next one
    for (let i = 0; i < 400; i++) {
      const st = await read();
      if (st.results) break;
      if (st.open && st.state === 'ask') { await typeAnswer(page, st.answer); await page.waitForTimeout(150); } else await page.waitForTimeout(100);
    }
    if (await J(page, () => window.__trailBlazer.screen !== 'results')) break;
    await J(page, () => window.__trailBlazer.app.go('title'));
    await page.waitForSelector(visibleSel('#screen-title'));
  }
  check(problems.length === 0, `${layout.name}: ${seen.total} gates in a row (${seen.gate} race gates incl. ${seen.turbo} turbo, ${seen.hill} hill bursts, ${seen.missed} missed first): the question on screen, the spoken question, the graded answer, the revealed answer and the recorded fact always agree${problems.length ? ' — ' + problems.slice(0, 5).join(' | ') : ''}`);
  check(seen.total >= want && seen.gate >= 15 && seen.hill >= 15, `${layout.name}: the agreement sweep covered ${seen.total} gates (${seen.gate} race, ${seen.hill} hill)`);
}

// ---------- a fresh browser context with a new player, then the sweep (used by ui-smoke.mjs and standalone) ----------
export async function runGateAgreement(browser, layout, base, want, helpers) {
  const { J, check, visibleSel } = helpers;
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('tbAgreeSeeded')) {
      localStorage.clear(); sessionStorage.setItem('tbAgreeSeeded', '1');
      localStorage.setItem('trailBlazer.settings', JSON.stringify({ sound: true, music: true, reducedMotion: false, shake: 100, hill: false }));
    }
    window.__mockScript = {};
    window.__spoken = [];
    window.__ttsBackend = { speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); }, cancel() {}, addEventListener() {} };
  });
  await page.goto(base + '/trail-blazer/index.html?mock=1&nosw=1', { waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('#pl-add');
  await page.waitForSelector(visibleSel('#screen-newplayer'));
  for (const ch of 'mia') await page.tap(`#np-keyboard [data-key="${ch}"]`);
  await page.tap('#np-keyboard [data-key="enter"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  await gateAgreementSweep(page, layout, want, helpers);
  check(errors.length === 0, `${layout.name}: no page errors during the agreement sweep${errors.length ? ' - ' + errors.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}

// ---------- standalone runner ----------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const BASE = process.env.BASE_URL || 'http://localhost:8080';
  const failures = [];
  const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
  const J = (page, fn, arg) => page.evaluate(fn, arg);
  const visibleSel = (sel) => `${sel}:not([hidden])`;
  async function typeAnswer(page, value) {
    for (const ch of String(value)) await page.tap(`#gate .np-key[data-key="${ch}"]`);
    await page.tap('#gate .np-key[data-key="go"]');
  }
  async function loadPlaywright() {
    process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
    try { return await import('playwright'); } catch (_) {
      const g = execSync('npm root -g').toString().trim();
      return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
    }
  }
  const up = async () => { try { return (await fetch(BASE + '/trail-blazer/index.html')).ok; } catch (_) { return false; } };
  let srv = null;
  if (!(await up())) { srv = spawn('python3', ['-m', 'http.server', '8080'], { cwd: repoRoot, stdio: 'ignore' }); for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100)); }
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  try {
    for (const layout of [{ name: 'landscape', width: 844, height: 390 }, { name: 'portrait', width: 390, height: 844 }].filter((l) => !process.env.ONLY || l.name === process.env.ONLY)) {
      console.log(`\n=== ${layout.name} ===`);
      await runGateAgreement(browser, layout, BASE, Number(process.env.GATES) || 60, { J, typeAnswer, check, visibleSel });
    }
  } catch (e) { failures.push('crashed: ' + (e && e.stack || e)); console.error(e); } finally { await browser.close(); if (srv) srv.kill(); }
  if (failures.length) { console.log(`\n${failures.length} FAILED:\n - ${failures.join('\n - ')}`); process.exit(1); }
  console.log('\ngate-agreement: all checks passed');
}

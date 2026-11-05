// Lab integration smoke test for Spell Jump (lab/SPEC.md §4.1, §7.4 step 8): Playwright against a static server at the REPO ROOT, so the game
// is at /spell-jump/ (the repo-root symlink to car-jump/) and the real Lab is at /lab/ exactly as on learninglab.fun. Runs on its own port.
//   node car-jump/tools/lab-smoke.mjs        (SHOTS_DIR=/some/dir for the screenshots)
// Landscape 844x390 (the Lab present): the bridge loads the Lab, "The Lab" title button appears, the XP pill is mounted in the run HUD, a spelled word
//   reaches the Lab (XP, coins, the day's play), the results strip is mounted, five first-try words in a row make the "Perfect Launch" moment, a Lab skin
//   and trail are worn through the garage's own pipeline, the Friday Test is a boss event (the Titan sheds a block per right word, a Gold ceremony, the
//   trophy recorded in the Lab) and the Parent Zone prints the certificate (a print-styled page, zero off-origin requests, the buttons hidden in print).
// Portrait 390x844 (every /lab/ request blocked): the game boots and plays with no Lab UI and only the bridge's console warning; the Friday Test still
//   gets its ceremony (a Brave Speller ribbon for a low score, no number on the certificate by default, one button to show it).
import { execSync } from 'node:child_process';
import { createReadStream, mkdirSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { onCleanup, watchdog } from './serve.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'spell-jump-lab-shots');
mkdirSync(SHOTS, { recursive: true });

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      let p = decodeURIComponent(u.pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(REPO, path.normalize(p));
      if (!f.startsWith(REPO) || /(^|\/)\.(git|claude)(\/|$)/.test(path.relative(REPO, f))) { res.writeHead(403); res.end(); return; }
      let st; try { st = statSync(f); } catch (_) { res.writeHead(404); res.end('not found'); return; }
      if (st.isDirectory()) { res.writeHead(301, { location: p + '/' }); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
      createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, base: `http://localhost:${srv.address().port}` }));
  });
}

const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const J = (page, fn, arg) => page.evaluate(fn, arg);
const visibleSel = (s) => `${s}:not([hidden])`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LAYOUTS = [
  { name: 'landscape', width: 844, height: 390, insets: { t: 0, r: 47, b: 21, l: 47 }, blockLab: false, tier: 'gold' },
  { name: 'portrait', width: 390, height: 844, insets: { t: 47, r: 0, b: 34, l: 0 }, blockLab: true, tier: 'brave' },
];
const WORDS = ['mold', 'bolt', 'shadow', 'float', 'coast', 'throat'];

async function shot(page, layout, name, wait = 200) {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(SHOTS, `${layout.name}-${name}.png`) });
}
async function tapKeys(page, kb, text) { for (const ch of text) await page.tap(`${kb} [data-key="${ch}"]`); }
async function spellWord(page, wrong = false) {
  await page.waitForFunction(() => window.__spellJump.spellPanel.mode === 'write', null, { timeout: 15000 });
  const w = await J(page, () => window.__spellJump.spellPanel.word);
  await tapKeys(page, '#sp-keyboard', wrong ? w.slice(0, -1) + (w.endsWith('x') ? 'z' : 'x') : w);
  await page.tap('#sp-keyboard [data-key="enter"]');
  return w;
}
// start a race from the app (the garage flow is covered by ui-smoke), spell its words, press GAS, wait for the results
async function playRace(page, { words = 2, gas = true } = {}) {
  await J(page, () => window.__spellJump.app.startRun({ trackId: 'canyon' }));
  const spelled = [];
  for (let i = 0; i < words; i++) {
    spelled.push(await spellWord(page));
    if (i < words - 1) await page.waitForFunction((n) => { const s = window.__spellJump.spellPanel; return s.isOpen && s.mode === 'write' && s.word !== n; }, spelled[i], { timeout: 15000 }).catch(() => {});
  }
  await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 15000 });
  await page.waitForTimeout(200);
  if (gas) {
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight');
    await page.waitForSelector(visibleSel('#screen-results'), { timeout: 25000 });
    await page.waitForTimeout(500);
  }
  return spelled;
}

async function openPage(browser, base, layout, errors, requests) {
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  if (layout.blockLab) await ctx.route(/^https?:\/\/[^/]+\/lab\//, (r) => r.abort());
  const page = await ctx.newPage();
  page.on('console', (m) => {
    const t = m.text() + (m.location().url || '');
    if (m.type() === 'error' && !(layout.blockLab && /\/lab\/|ERR_FAILED/.test(t))) errors.push(m.text());
    if (m.type() === 'warning' || m.type() === 'warn') errors.warns.push(m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('request', (r) => requests.push(r.url()));
  await page.addInitScript(({ insets }) => { window.__noSkyTeaser = true;
    window.__spoken = [];
    window.__noClassLists = true;
    window.__ttsBackend = {
      speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); },
      cancel() {}, addEventListener() {},
    };
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(s);
    });
  }, { insets: layout.insets });
  return page;
}
// Mia, five known words (no Look step), the coach already seen, 3 words a race
async function seedMia(page, { wordsPerRace = 3, tests = [], missionCount = 0 } = {}) {
  await J(page, async ({ wordsPerRace: wpr, WORDS: ws, tests: ts, missionCount: mc }) => {
    const S = await import('/spell-jump/src/spelling/scheduler.js');
    const now = Date.now(), DAY = 864e5, dk = (t) => S.dayKey(t);
    const near = (w) => ({ word: w, listId: 'L1', box: 1, due: now - 1000, attempts: 2, firstTry: 1, seenCount: 2, lastSeen: now - DAY, daysCorrect: [dk(now - DAY)], daysSeen: [dk(now - 2 * DAY), dk(now - DAY)], focus: false, studied: true, reviewsDone: 0, misses: 0 });
    localStorage.clear();
    localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, migrated: true, lastPlayer: 'pmia', options: { pmia: { wordsPerRace: wpr, levelsPerRace: 1 } },
      players: [{ id: 'pmia', name: 'Mia', color: '#ff3b5c', createdAt: 1, updatedAt: 1 }] }));
    localStorage.setItem('spellJump.pmia.save', JSON.stringify({ v: 2, cash: 1000, owned: ['beater'], selectedCar: 'beater', seen: { coach: true, ach: 0 } }));
    localStorage.setItem('spellJump.pmia.words', JSON.stringify({ v: 1, lists: [{ id: 'L1', name: 'Long o', createdAt: now - 3 * DAY, archivedAt: 0, pattern: '', words: ws.map((word) => ({ word })) }], activeId: 'L1',
      records: Object.fromEntries(ws.map((w) => [w, near(w)])), tests: ts.map((t) => ({ ...t, listId: 'L1', at: t.at || now - DAY })), qualifierPending: null,
      today: { date: dk(now), count: mc, newCount: 0, missionPaid: false }, streak: 0, bestStreak: 0, perfectTotal: 0 }));
  }, { wordsPerRace, WORDS, tests, missionCount });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('[data-player="pmia"]');
  await page.waitForSelector(visibleSel('#screen-title'));
}
async function layoutIssues(page, label) {
  const issues = await J(page, () => {
    const W = innerWidth, H = innerHeight, out = [];
    if (document.documentElement.scrollWidth > W + 1) out.push(`document scrollWidth ${document.documentElement.scrollWidth} > ${W}`);
    for (const el of document.querySelectorAll('#app button, #app .tm-card, #app .cer, #app #hud-lab *, #app #res-lab *, #app .tm-titan')) {
      if (el.closest('[hidden]')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      let scroller = null;
      for (let p = el.parentElement; p && p.id !== 'app'; p = p.parentElement) { const o = getComputedStyle(p); if (/(auto|scroll)/.test(o.overflowY + o.overflowX)) { scroller = p; break; } }
      if (!scroller && (r.right > W + 1 || r.left < -1)) out.push(`h-overflow ${el.id || el.className} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      if (!scroller && (r.bottom > H + 1 || r.top < -1)) out.push(`v-overflow ${el.id || el.className} [${Math.round(r.top)}..${Math.round(r.bottom)}]`);
      if (el.tagName === 'BUTTON' && Math.min(r.width, r.height) < 44 && !el.classList.contains('kb-char') && !el.closest('.keyboard, .kb')) out.push(`tap target ${Math.round(r.width)}x${Math.round(r.height)} ${el.id || el.className}`);
    }
    return out;
  });
  check(issues.length === 0, `${label}: layout clean${issues.length ? ' — ' + issues.slice(0, 5).join('; ') : ''}`);
}

async function runLayout(browser, base, layout) {
  console.log(`\n=== ${layout.name} ${layout.width}x${layout.height}${layout.blockLab ? ' (/lab/ blocked)' : ' (the Lab present)'} ===`);
  const errors = []; errors.warns = [];
  const requests = [];
  const page = await openPage(browser, base, layout, errors, requests);
  const url = (p) => `${base}/spell-jump/${p}`;
  await page.goto(url('index.html?mock=1&nosw=1'), { waitUntil: 'networkidle' });
  await seedMia(page);
  const labUp = !layout.blockLab;

  // ---------- the bridge ----------
  if (labUp) {
    await page.waitForFunction(() => window.__spellJump.app.lab.ready, null, { timeout: 8000 });
    check(true, 'the bridge loaded /lab/src/index.js');
    check(await J(page, () => !document.querySelector('#btn-lab').hidden), 'title: "The Lab" button is shown once the Lab has loaded');
    await shot(page, layout, 'lab-01-title');
    await layoutIssues(page, 'title');
    await page.tap('#btn-lab');
    check(await page.waitForSelector('.lab-overlay', { timeout: 8000 }).then(() => true, () => false), 'tapping the title\'s Lab chip opens the Lab (the real overlay)');
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  } else {
    await page.waitForFunction(() => window.__spellJump.app.lab.unavailable, null, { timeout: 8000 });
    check(true, 'every /lab/ request blocked: the bridge gave up quietly');
    check(await J(page, () => document.querySelector('#btn-lab').hidden), 'title: no Lab button, the game looks as before');
    check(await J(page, () => { const r = window.__spellJump.app.lab.report({ event: 'word', n: 1, firstTry: true }); return r.ok === false && r.coins === 0 && r.combo.moment === false && !window.__spellJump.app.lab.ready; }), 'a report is a no-op that returns the empty receipt');
    check(errors.warns.some((w) => /\[lab\] unavailable/.test(w)), 'one console warning from the bridge');
  }

  // ---------- a race: the HUD pill, a word reaches the Lab, the results strip ----------
  await J(page, () => window.__spellJump.app.startRun({ trackId: 'canyon' }));
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 8000 });
  const hudMounted = await J(page, () => !!document.querySelector('#hud-lab *'));
  check(hudMounted === labUp, labUp ? 'the Lab XP pill is mounted in #hud-lab' : '#hud-lab stays empty without the Lab');
  // finish this race normally
  const first = [];
  for (let i = 0; i < 3; i++) {
    first.push(await spellWord(page));
    if (i < 2) await page.waitForFunction((n) => { const s = window.__spellJump.spellPanel; return s.isOpen && s.mode === 'write' && s.word !== n; }, first[i], { timeout: 15000 }).catch(() => {});
  }
  await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 15000 });
  if (labUp) {
    const lab1 = await J(page, () => { const d = window.__lab.store.doc(); const v = window.__lab.store.view(); return { xp: v.level.into + (v.level.level > 1 ? 1 : 0), coins: v.coins, words: Object.values(d.play).reduce((a, p) => a + p.sj, 0), combo: v.combo.count }; });
    check(lab1.words >= 3 && lab1.coins >= 12 && lab1.combo === 3, `three first-try words reached the Lab: ${lab1.words} sj events, ${lab1.coins} coins, combo ${lab1.combo}`);
  }
  await page.waitForTimeout(250);
  if (labUp) await shot(page, layout, 'lab-02-hud-pill', 100);
  await layoutIssues(page, 'run HUD');
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight');
  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 25000 });
  await page.waitForTimeout(700);
  const strip = await J(page, () => ({ text: document.querySelector('#res-lab').textContent.trim(), has: document.querySelector('#res-lab').children.length }));
  check(labUp ? strip.has > 0 && /coin/i.test(strip.text) : strip.has === 0, labUp ? `the results strip is mounted: "${strip.text}"` : 'no results strip without the Lab');
  if (labUp) {
    const rep = await J(page, () => { const d = window.__lab.store.doc(); const p = Object.values(d.play)[0]; return p.sj; });
    check(rep >= 4, `the run's events reached the Lab too (${rep} sj events: words, the run)`);
  }
  await shot(page, layout, 'lab-03-results', 300);
  await layoutIssues(page, 'results');

  // ---------- the "Perfect Launch" moment: five first-try words in a row ----------
  await J(page, () => window.__spellJump.app.go('title'));
  await page.waitForSelector(visibleSel('#screen-title'));
  if (labUp) {
    await playRace(page, { words: 3, gas: false });
    // the same Lab round (a mission): the first race above was three first-try words, these three make the combo pass five
    const combo = await J(page, () => window.__lab.store.view().combo.count);
    check(combo >= 5, `the combo lives across races: ${combo} first-try words in a row`);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(250);
    const banner = await page.waitForSelector('#banner[data-kind="moment"]:not([hidden])', { timeout: 4000 }).catch(() => null);
    check(!!banner, 'the "Perfect Launch" moment shows on the launch');
    if (banner) check(/perfect launch/i.test(await banner.textContent()), `the banner says "${(await banner.textContent()).trim()}"`);
    await shot(page, layout, 'lab-04-perfect-launch', 50);
    await page.keyboard.up('ArrowRight');
    await page.waitForSelector(visibleSel('#screen-results'), { timeout: 25000 });
  }

  // ---------- Lab looks through the garage's own pipeline ----------
  if (labUp) {
    const looks = await J(page, async () => {
      const L = window.__lab;
      L.grantCoins(20000);
      const out = {};
      for (const id of ['sj.skin.tiger', 'sj.sticker.medal', 'sj.trail.stars']) { out[id] = L.store.buy(id); }
      for (const id of ['sj.skin.tiger', 'sj.sticker.medal', 'sj.trail.stars']) { const key = id.split('.').slice(0, 2).join('.'); out['equip ' + id] = L.store.equip(key, id); }
      return out;
    });
    check(Object.values(looks).every((v) => (v && (v.ok === undefined || v.ok)) || v === true), `bought and equipped a skin, a sticker and a trail in the Lab (${JSON.stringify(looks).slice(0, 160)})`);
    const worn = await J(page, () => { const a = window.__spellJump.app; const l = a.look(a.save.selectedCar); return { skin: l.skin && l.skin.id, sticker: l.sticker && l.sticker.id, cos: a.lab.cosmetics().slots }; });
    check(worn.skin === 'sj.skin.tiger' && worn.sticker === 'sj.sticker.medal' && worn.cos.trail === 'sj.trail.stars', `the game draws the Lab looks: ${worn.skin}, ${worn.sticker}, ${worn.cos.trail}`);
    await J(page, () => window.__spellJump.app.go('garage'));
    await page.waitForSelector(visibleSel('#screen-garage'));
    await shot(page, layout, 'lab-05-garage-lab-skin', 500);
    const starts = await J(page, () => { window.__starts = []; const g = window.__spellJump.game; const o = g.start; g.start = (cfg) => { window.__starts.push({ skin: cfg.skin && cfg.skin.id, sticker: cfg.sticker && cfg.sticker.id, trail: cfg.trail && cfg.trail.type }); return o(cfg); }; return true; });
    void starts;
    await J(page, () => window.__spellJump.app.startRun({ trackId: 'canyon' }));
    await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 8000 });
    const cfg = await J(page, () => window.__starts[0]);
    check(cfg && cfg.skin === 'sj.skin.tiger' && cfg.sticker === 'sj.sticker.medal' && cfg.trail === 'star', `a run starts with the Lab skin, sticker and trail: ${JSON.stringify(cfg)}`);
    await page.click('#spell .sp-exit');                                   // leave the run from the spell panel (the back button)
    await page.waitForSelector(visibleSel('#screen-garage'));
    await J(page, () => window.__lab.store.equip('sj.skin', null));
    check(await J(page, () => { const a = window.__spellJump.app; return a.look(a.save.selectedCar).skin === null; }), 'taking the Lab skin off gives the game\'s own look back');
  }

  // ---------- the Friday Test as a boss event ----------
  await J(page, () => window.__spellJump.app.go('title'));
  await page.waitForSelector(visibleSel('#screen-title'));
  const brave = layout.tier === 'brave';
  await page.click('#btn-friday');
  await page.waitForSelector('#tm-go');
  check(await J(page, () => !document.querySelector('#tm-titan').hidden), 'the Test Titan towers over the Friday Test intro');
  await shot(page, layout, 'friday-01-intro');
  await layoutIssues(page, 'friday intro');
  await page.click('#tm-go');
  const rightBy = [];
  for (let i = 0; i < WORDS.length; i++) {
    await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'ask' && !document.querySelector('#tm-keyboard').classList.contains('is-disabled'), null, { timeout: 12000 });
    const w = await J(page, () => window.__spellJump.testScreen.word);
    const miss = brave ? i >= 2 : false;                       // brave: 2 of 6 right
    await tapKeys(page, '#tm-keyboard', miss ? w.slice(0, -1) + (w.endsWith('x') ? 'z' : 'x') : w);
    if (i === 1) await shot(page, layout, 'friday-02-typed', 0);
    await page.tap('#tm-keyboard [data-key="enter"]');
    await page.waitForFunction(() => ['right', 'compare'].includes(document.querySelector('#screen-test').dataset.mode), null, { timeout: 4000 });
    await page.waitForTimeout(120);
    rightBy.push(await J(page, () => ({ shed: document.querySelectorAll('.ttn-blk.shed').length, wob: document.querySelector('#tm-titan').classList.contains('wobble'), shrug: document.querySelector('#tm-titan').classList.contains('shrug') })));
    if (i === 2) await shot(page, layout, 'friday-03-midway', 100);
  }
  const maxShed = rightBy.at(-1).shed;
  check(brave ? rightBy[1].shed >= 1 && rightBy.some((r) => r.shrug) : maxShed >= 3 && rightBy.every((r) => r.wob || r.shed), brave
    ? `the Titan shed ${rightBy[1].shed} block(s) for the right words and shrugged at a miss (never a loss)` : `the Titan wobbled and shed a block per right word (${rightBy.map((r) => r.shed).join(', ')} shed)`);
  await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'done' && document.querySelector('#tm-go'), null, { timeout: 14000 });
  await page.waitForTimeout(2700);
  const cer = await J(page, () => {
    const c = document.querySelector('#tm-ceremony');
    return c ? { tier: c.dataset.tier, name: document.querySelector('#tm-tier').textContent, shelf: c.querySelector('.cer-shelf').textContent, score: document.querySelector('#tm-score').textContent,
      improved: !!document.querySelector('#tm-improved'), practice: (document.querySelector('#tm-practice') || {}).textContent || '', go: document.querySelector('#tm-go').textContent, titanGone: document.querySelector('#tm-titan').classList.contains('away') || document.querySelector('#tm-titan').hidden } : null;
  });
  check(cer && cer.tier === layout.tier, `every score gets a ceremony: ${cer && cer.tier} ("${cer && cer.name}", ${cer && cer.score})`);
  check(cer && cer.go === 'Mega Run!' && (brave ? cer.practice.startsWith('Words to practice this week:') : cer.practice === ''), `the end card keeps its button "${cer && cer.go}"${brave ? ' and lists "' + (cer && cer.practice) + '"' : ''}`);
  check(cer && cer.shelf === (labUp ? 'Lab shelf' : 'Your shelf'), `the trophy lands on the "${cer && cer.shelf}"`);
  await shot(page, layout, `friday-04-ceremony-${layout.tier}`, 100);
  await layoutIssues(page, 'friday ceremony');
  if (labUp) {
    const tro = await J(page, () => { const d = window.__lab.store.doc(); return d.trophies[0] || null; });
    check(tro && tro.game === 'sj' && tro.tier === 'gold' && tro.n === 6 && tro.of === 6, `the Lab recorded the trophy: ${JSON.stringify(tro)}`);
  }
  const said = await J(page, () => window.__spoken.slice(-4));
  check(said.some((t) => /Gold!|Brave Speller!/.test(t)), `the ceremony speaks through the existing voice: "${said.filter((t) => /Gold|Brave/.test(t))[0]}"`);

  // leave through the Mega Run, back to the title
  await page.click('#tm-go');
  await page.waitForSelector(visibleSel('#hud'));
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight');
  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 25000 });
  await J(page, () => window.__spellJump.app.go('title'));

  // ---------- Parent Zone: The Lab row and the certificate ----------
  await page.click('#btn-parents');
  await page.waitForSelector(visibleSel('#pz'));
  for (const d of '1234') await page.click(`.pinpad [data-digit="${d}"]`);
  await page.waitForFunction(() => document.querySelector('#pin-title') && /again/i.test(document.querySelector('#pin-title').textContent));
  for (const d of '1234') await page.click(`.pinpad [data-digit="${d}"]`);
  await page.waitForSelector('.pz-content[data-tab="sync"]');
  await page.click('.pz-tabs [data-tab="options"]');
  await page.waitForSelector('.pz-content[data-tab="options"]');
  const row = await J(page, () => { const r = document.querySelector('#opt-lab-row'); return r ? { text: r.textContent.trim(), disabled: document.querySelector('#opt-lab').disabled } : null; });
  check(row && /The Lab/.test(row.text) && row.disabled === false, 'Parent Zone → Options has a "The Lab" row');
  if (labUp) {
    await page.click('#opt-lab');
    await page.waitForFunction(() => [...document.body.children].some((e) => /lab/i.test(e.className + e.id) && !e.id.startsWith('pz')), null, { timeout: 5000 });
    check(true, 'its button opens the Lab\'s grown-ups page over the Parent Zone');
    await shot(page, layout, 'pz-lab-open', 200);
    await J(page, () => { for (const e of [...document.body.children]) if (/lab/i.test(e.className + e.id)) e.remove(); });
  }
  await page.click('.pz-tabs [data-tab="report"]');
  await page.waitForSelector('.pz-content[data-tab="report"]');
  const certBtns = await J(page, () => [...document.querySelectorAll('[data-cert]')].map((b) => ({ at: b.dataset.cert, text: b.textContent.trim() })));
  check(certBtns.length === 1 && certBtns[0].text === 'Print certificate', `Report → Test history: a "Print certificate" button on the Friday Test (${certBtns.length})`);
  await page.locator('[data-cert]').scrollIntoViewIfNeeded();
  await shot(page, layout, 'pz-report-cert-button', 300);
  const offOriginBefore = requests.filter((u) => !u.startsWith(base) && !/^(data|blob):/.test(u) && !/fonts\.(googleapis|gstatic)/.test(u)).length;
  await Promise.all([page.waitForURL(/certificate\.html\?p=pmia&t=\d+/, { timeout: 8000 }), page.click('[data-cert]')]);
  await page.waitForSelector('#cert-name');
  const c1 = await J(page, () => ({ name: document.querySelector('#cert-name').textContent, ribbon: document.querySelector('#cert-ribbon').textContent, lines: [...document.querySelectorAll('.cert-line')].map((l) => l.textContent),
    text: document.querySelector('#cert').textContent, links: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')), printBtn: !!document.querySelector('#cert-print') }));
  check(c1.name === 'Mia' && c1.ribbon === (brave ? 'Brave Speller ribbon' : 'Gold ribbon'), `the certificate: ${c1.name}, "${c1.ribbon}"`);
  if (brave) {
    check(!/\d+ of \d+/.test(c1.text) && /kept going/.test(c1.lines[0]), `low result, default: the ribbon instead of the number ("${c1.lines[0]}")`);
    await page.screenshot({ path: path.join(SHOTS, `${layout.name}-cert-01-ribbon-default.png`), fullPage: true });
    await page.click('#cert-toggle');
    check(await J(page, () => /spelled 2 of 6 words on the Friday Test/.test(document.querySelector('#cert').textContent)), 'one button shows the score ("spelled 2 of 6 words")');
  } else {
    check(/Mia spelled 6 of 6 words on the Friday Test/.test(c1.lines[0]), `"${c1.lines[0]}"`);
  }
  await page.screenshot({ path: path.join(SHOTS, `${layout.name}-cert-02-${layout.tier}.png`), fullPage: true });
  check(c1.links.every((h) => h === './'), 'no link on the page but "Back to Spell Jump"');
  await page.emulateMedia({ media: 'print' });
  const pr = await J(page, () => ({ bar: getComputedStyle(document.querySelector('#cert-bar')).display, btn: getComputedStyle(document.querySelector('#cert-print')).display, back: getComputedStyle(document.querySelector('#cert-back')).display }));
  check(pr.bar === 'none' && pr.btn === 'none' && pr.back === 'none', 'the print stylesheet hides every button');
  const pdfPath = path.join(SHOTS, `${layout.name}-cert-03-print-letter.pdf`);
  await page.pdf({ path: pdfPath, format: 'Letter', printBackground: true });
  const pdfPages = (readFileSync(pdfPath, 'latin1').match(/\/Type\s*\/Page\b/g) || []).length;
  check(pdfPages === 1, `printed on Letter it is one page (${pdfPages})`);
  await page.emulateMedia({ media: 'screen' });
  await J(page, () => { window.__printed = 0; window.print = () => { window.__printed += 1; }; });
  await page.click('#cert-print');
  check(await J(page, () => window.__printed) === 1, 'Print calls window.print()');
  const offOrigin = requests.filter((u) => !u.startsWith(base) && !/^(data|blob):/.test(u) && !/fonts\.(googleapis|gstatic)/.test(u));
  check(offOrigin.length === offOriginBefore && offOrigin.length === 0, `zero off-origin requests (${offOrigin.length})`);
  // a bad link is handled kindly
  await page.goto(url('certificate.html?p=nobody&t=1'));
  check(await J(page, () => !!document.querySelector('#cert-missing') && !document.querySelector('#cert-name')), 'a certificate that cannot be found says so and links back');
  await page.click('#cert-back');
  await page.waitForSelector(visibleSel('#screen-players'));
  check(true, '"Back to Spell Jump" returns to the game');

  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await page.context().close();
}

// the REAL engine (no ?mock=1) with the Lab present: the combo moment is drawn by game.moment(), a Lab skin + trail race through to the results
async function realEngine(browser, base) {
  const layout = { ...LAYOUTS[0], name: 'real-engine', blockLab: false };
  console.log('\n=== real engine, the Lab present ===');
  const errors = []; errors.warns = [];
  const page = await openPage(browser, base, layout, errors, []);
  await page.goto(`${base}/spell-jump/index.html?nosw=1`, { waitUntil: 'networkidle' });
  await seedMia(page, { wordsPerRace: 1 });
  await page.waitForFunction(() => window.__spellJump.app.lab.ready, null, { timeout: 8000 });
  await J(page, () => {
    const L = window.__lab; L.grantCoins(10000);
    L.store.buy('sj.skin.holo'); L.store.equip('sj.skin', 'sj.skin.holo'); L.store.buy('sj.trail.confetti'); L.store.equip('sj.trail', 'sj.trail.confetti');
  });
  await J(page, () => window.__spellJump.app.startRun({ trackId: 'canyon' }));
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 8000 });
  const m = await J(page, () => { const g = window.__spellJump.game; const ok = g.moment('Perfect Launch'); g.debugStep(2); return { ok, popups: g.debugInfo().popups.map((p) => p.text) }; });
  check(m.ok === true && m.popups.includes('PERFECT LAUNCH!'), `game.moment("Perfect Launch") draws the flare and the name on the engine's banner lane (${m.popups.join(', ')})`);
  await spellWord(page);
  await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1200);
  const live = await J(page, () => { const i = window.__spellJump.game.debugInfo(); return { particles: i.particles, phase: i.phase, x: Math.round(i.x) }; });
  check(live.particles > 0 && live.x > -130, `the real engine ran with the Lab skin and the confetti trail (${live.phase}, ${live.x} m, ${live.particles} particles)`);
  await shot(page, layout, 'real-01-trail', 100);
  await page.keyboard.up('ArrowRight');
  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 40000 });
  check(true, 'the race ran through to the results');
  await shot(page, layout, 'real-02-results', 500);
  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await page.context().close();
}

// v3.9.1: the server is this process's own (an in-process node http server on a free port, never 8080, never python):
// it is closed with its open connections on every way out (tools/serve.mjs: success, failure, a crash, a signal, the
// SMOKE_TIMEOUT_MS watchdog), so nothing is left listening after the run.
watchdog('lab-smoke');
const { srv, base } = await serve();
const closeServer = () => { try { srv.closeAllConnections(); } catch (_) { /* older node */ } srv.close(); };
const offCleanup = onCleanup(closeServer);
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
try {
  for (const layout of LAYOUTS) await runLayout(browser, base, layout);
  await realEngine(browser, base);
} catch (e) {
  failures.push('exception: ' + (e && e.stack ? e.stack : e));
  console.log('  ✗ exception', e);
} finally {
  await browser.close().catch((e) => console.error('browser.close', e));
  offCleanup();
  closeServer();
}
console.log(`\n${failures.length ? failures.length + ' FAILED' : 'ALL LAB SMOKE CHECKS PASSED'}  (screenshots: ${SHOTS})`);
if (failures.length) { console.log(failures.map((f) => '  - ' + f).join('\n')); process.exit(1); }

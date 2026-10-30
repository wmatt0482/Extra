// Playwright smoke test of Wagon West on the mock scene (?mock=1&nosw=1), landscape 844×390 and portrait 390×844
// (iPhone safe-area insets faked), from the repo root:
//   BASE_URL=http://localhost:8095 node wagon-west/tools/ui-smoke.mjs     (ONLY=landscape | portrait runs one layout;
//   VOICE_ONLY=1 runs only the natural-voice part)
// Covers (SPEC §12 "Tests"): the picker and a new player (on-screen keyboard), the title with the map, the outfit (the
// wagon's name on the on-screen keyboard, the animal, three companions, the looks), the General Store at Independence
// (a 'buy' problem right, a 'divide' problem missed: the work shown line by line, then the answer typed, the goods at
// the fair price either way), a whole leg on the mock scene (the HUD and both dials, the rations question, mile markers
// answered right and one missed: the fact with its answer, then typed from a cover; the leg's event; the distance
// question), the river (the lookout card, three words on Spell Jump's spell panel recorded in the child's word store,
// the rope toss on the number line by a real drag), the results (stars, rows that add up, the sticker, the crate),
// a second leg to the fort (the event with the scripted hunt, the store, the letter: lines one by one, three P.S.
// words dictated, read back and kept), the journal (letters, stickers, map), the Parent Zone (PIN, Family code,
// Journey, Options, Report with the chart, Players), the facts written to the child's Trail Blazer store, the pings,
// reload persistence, a kid-rule text audit and the layout audit of every screen (no links off-origin, no native
// inputs outside the Parent Zone, targets ≥ 44 px, no overflow, clear of the insets), and no console errors.
// v1.1: two legs in both layouts; at Fort Kearny the dog (kept, named on the keyboard, in the scene's party) and Fort
// Derby (a fact at each marker on the marker panel, the race won on the mock); trail cards (the lookouts' landmark
// cards, the pop, the Journal's Cards page with its counts); the daily challenge on the title, claimed (a token and a
// card); an upgrade bought with tokens (Outfit → Look → Wagon); Camp from the trail (Quick Draw to 7, a Campfire tale
// with its riddle, Rest; "Back to the trail"; the pause menu's Make camp → "Stop for today"); the music's mood by
// screen and 'off' while a panel is open; the audits on every new screen. Then, per layout, the natural voice with a
// fake cloud backend and a family code: the marker, a problem, a card, the river sentence and the letter are all
// spoken by clips (tts.engine 'cloud', the device voice silent), prepare requests carried the leg's lookout and the
// problem's sentence, and Parents → Options shows "Natural voice: Ava · N clips ready" with "Say a test line".
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const gameRoot = path.join(repoRoot, 'wagon-west');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const URL0 = BASE + '/wagon-west/index.html?mock=1&nosw=1';
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'wagon-west-ui-shots');
mkdirSync(SHOTS, { recursive: true });

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}
async function ensureServer() {
  const up = async () => { try { return (await fetch(BASE + '/wagon-west/index.html')).ok; } catch (_) { return false; } };
  if (await up()) return null;
  const port = new URL(BASE).port || '8080';
  const srv = spawn('python3', ['-m', 'http.server', port], { cwd: repoRoot, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100));
  return srv;
}

const failures = [];
let passed = 0;
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else { passed++; console.log('  ✓ ' + msg); } };
const LAYOUTS = [
  { name: 'landscape', width: 844, height: 390, insets: { t: 0, r: 47, b: 21, l: 47 }, legs: 2 },
  { name: 'portrait', width: 390, height: 844, insets: { t: 47, r: 0, b: 34, l: 0 }, legs: 2 },
];
// kid-facing words that must never show (SPEC §1); the Parent Zone is for grown-ups and is left out
const BANNED = /\b(kill(s|ed|ing)?|die[sd]?|dying|dead|death|grave|blood|gun|lives|life left|wrong|timer|countdown|hurry|time'?s up|seconds? left|game over|lose|lost|fail(ed)?|dysentery|snakebite|starv(e|ing|ed))\b/i;

async function routeFonts(ctx) {
  const cache = new Map();
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    const url = route.request().url();
    try {
      if (!cache.has(url)) cache.set(url, execSync(`curl -sSL --max-time 15 -A "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36" "${url}"`));
      await route.fulfill({ status: 200, body: cache.get(url), contentType: url.includes('googleapis') ? 'text/css' : 'font/ttf', headers: { 'access-control-allow-origin': '*' } });
    } catch (_) { await route.fulfill({ status: 200, body: '', contentType: 'text/css' }); }
  });
}
const J = (page, fn, arg) => page.evaluate(fn, arg);
const visibleSel = (sel) => `${sel}:not([hidden])`;
async function shot(page, layout, name, wait = 200) {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(SHOTS, `${layout.name}-${name}.png`) });
}

async function audit(page, insets, label) {
  const r = await J(page, ({ insets }) => {
    const W = innerWidth, H = innerHeight, out = [];
    if (document.documentElement.scrollWidth > W + 1) out.push(`document scrollWidth ${document.documentElement.scrollWidth} > ${W}`);
    const visible = (el) => { if (el.closest('[hidden]')) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
    const inScroller = (el) => { for (let p = el.parentElement; p && p.id !== 'app'; p = p.parentElement) { const o = getComputedStyle(p); if (/(auto|scroll)/.test(o.overflowY + o.overflowX)) return p; } return null; };
    const desc = (el) => el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '') + (el.textContent ? ` "${el.textContent.trim().slice(0, 24)}"` : '');
    for (const el of document.querySelectorAll('#app *')) {
      if (el.closest('#backdrop, #toasts, #stage') || (el.closest('svg') && el.tagName !== 'svg')) continue;
      if (!visible(el)) continue;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (!inScroller(el) && (b.right > W + 1 || b.left < -1)) out.push(`h-overflow ${desc(el)} [${Math.round(b.left)}..${Math.round(b.right)}]`);
      if (!inScroller(el) && (b.bottom > H + 1 || b.top < -1)) out.push(`v-overflow ${desc(el)} [${Math.round(b.top)}..${Math.round(b.bottom)}]`);
      const cs = getComputedStyle(el);
      if (el.children.length === 0 && el.textContent.trim() && cs.overflow === 'hidden' && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') out.push(`clipped text ${desc(el)}`);
    }
    for (const b of document.querySelectorAll('#app button, #app a[href]')) {
      if (!visible(b)) continue;
      const q = b.getBoundingClientRect();
      if (!q.width) continue;
      const sc = inScroller(b);
      if (b.classList.contains('kb-key') ? (q.height < 44 || q.width < W * 0.07) : Math.min(q.width, q.height) < 44) out.push(`tap target ${Math.round(q.width)}x${Math.round(q.height)} ${desc(b)}`);
      if (!sc && q.bottom > H - insets.b + 1) out.push(`under home indicator ${desc(b)}`);
      if (!sc && (q.left < insets.l - 1 || q.right > W - insets.r + 1)) out.push(`inside side inset ${desc(b)}`);
      if (!sc && q.top < insets.t - 1) out.push(`under status bar ${desc(b)}`);
    }
    const natives = [...document.querySelectorAll('input, textarea, select, [contenteditable="true"]')].filter((e) => !e.closest('#pz'));
    const links = [...document.querySelectorAll('a[href]')].filter((a) => new URL(a.href, location.href).origin !== location.origin).map((a) => a.href);
    return { out, natives: natives.map(desc), links };
  }, { insets });
  check(r.out.length === 0, `${label}: layout clean (no overflow, targets ≥ 44 px, clear of insets)${r.out.length ? ' — ' + r.out.slice(0, 6).join('; ') : ''}`);
  check(r.natives.length === 0, `${label}: no native inputs outside the Parent Zone${r.natives.length ? ' — ' + r.natives.join(', ') : ''}`);
  check(r.links.length === 0, `${label}: no links to another origin${r.links.length ? ' — ' + r.links.join(', ') : ''}`);
}
// every word a kid can see right now (outside the Parent Zone), for the kid-rule audit
const kidText = (page) => J(page, () => {
  const out = [];
  const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) out.push(c.textContent); else if (c.nodeType === 1 && c.id !== 'pz' && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE') { if (c.getAttribute('aria-label')) out.push(c.getAttribute('aria-label')); walk(c); } } };
  walk(document.querySelector('#app'));
  return out.join(' ').replace(/\s+/g, ' ');
});

// ---------- the state of the app, and the driver that plays whatever is on screen ----------
const W = (page) => J(page, () => {
  const w = window.__wagonWest;
  return { screen: w.screen, marker: w.markerPanel.state, mAns: w.markerPanel.answer, mReal: /^Marker \d+ of \d+$/.test((document.querySelector('#mk-chip') || {}).textContent || '') && document.querySelector('#mk-title').textContent === 'Mile marker', mTitle: document.querySelector('#mk-title').textContent, problem: w.problemPanel.state, pAns: w.problemPanel.answer, pKind: w.problemPanel.problem && w.problemPanel.problem.kind,
    card: w.card.isOpen, cardTitle: w.card.title, spell: w.spellPanel.isOpen ? w.spellPanel.mode : null, word: w.spellPanel.word, kbOn: !!document.querySelector('#sp-keyboard:not(.is-disabled)'),
    mini: w.mini, travel: w.travel, rope: w.river.rope, rvRope: !document.querySelector('#rv-rope').hidden, rvFoot: !document.querySelector('#rv-foot').hidden,
    poFoot: !document.querySelector('#po-foot').hidden, storeOpen: w.store.isOpen, storeBusy: w.store.busy, journey: w.save.journey && { legIndex: w.save.journey.legIndex, legId: w.save.journey.legId, milesDone: w.save.journey.milesDone, cash: w.save.journey.cash, food: w.save.journey.food, tokens: w.save.journey.tokens, rations: w.save.journey.rations, pace: w.save.journey.pace } };
});
async function typeDigits(page, root, digits) {
  for (const d of String(digits)) await page.click(`${root} .np-key[data-key="${d}"]`);
  await page.click(`${root} .np-key[data-key="go"]`);
}
async function typeWord(page, word) {
  for (const ch of word) await page.click(`#sp-keyboard .kb-key[data-key="${ch === ' ' ? 'space' : ch}"]`);
  await page.click('#sp-keyboard .kb-enter');
}
/**
 * Play until `until(state)` is true. plan: { markerMiss: [n…] (miss these marker numbers, 1-based), onEach(state) }.
 * Returns the log of what was answered.
 */
async function drive(page, until, plan = {}, timeout = 90000) {
  const log = { markers: [], problems: [], cards: [], words: [], throws: 0, minis: 0 };
  const end = Date.now() + timeout;
  let lastMini = null;
  while (Date.now() < end) {
    const s = await W(page);
    if (await until(s)) return log;
    if (plan.onEach) await plan.onEach(s, log);
    if (s.marker === 'ask') {
      // a 'fact' event and a card game ask on the same panel ("Quick fact" / "Card game"); only real mile markers count
      if (!s.mReal) { await typeDigits(page, '#panel-marker', s.mAns); await page.waitForTimeout(60); continue; }
      const n = log.markers.length + 1;
      const miss = (plan.markerMiss || []).includes(n);
      log.markers.push(miss ? 'missed' : 'right');
      await typeDigits(page, '#panel-marker', miss ? s.mAns + 1 : s.mAns);
      if (plan.onMarker) await plan.onMarker(n, miss);
    } else if (s.marker === 'copy') await typeDigits(page, '#panel-marker', s.mAns);
    else if (s.problem === 'ask') { log.problems.push(s.pKind); await typeDigits(page, '#panel-problem', s.pAns); }
    else if (s.problem === 'copy') await typeDigits(page, '#panel-problem', s.pAns);
    else if (s.card) { log.cards.push(s.cardTitle); await page.click('#tc-go'); }
    else if (s.screen === 'dog') {
      // the dog at Fort Kearny ("Keep it!" above): a coat, the name on the on-screen keyboard
      log.dog = true;
      if (plan.onDog) await plan.onDog();
      await page.click('#dog-coats [data-coat="spotted"]');
      for (const k of plan.dogName || 'rex') await page.click(`#dog-keyboard .kb-key[data-key="${k}"]`);
      await page.click('#dog-keyboard .kb-enter');
    }
    else if (s.spell && ['write', 'cover', 'copy'].includes(s.spell) && s.kbOn && s.word) { if (s.spell === 'write') log.words.push(s.word); await typeWord(page, s.word); }
    else if (s.mini) { if (lastMini !== s.mini.kind) { log.minis++; lastMini = s.mini.kind; } }
    else if (s.screen === 'river' && s.rvRope && s.rope && !s.rope.done && !s.rope.flying) {
      await dragRope(page, s.rope.f.n / s.rope.f.d);
      await page.click('#rv-throw'); log.throws++;
    } else if (s.screen === 'river' && s.rvFoot) await page.click('#rv-go');
    else if (s.screen === 'post' && s.poFoot) await page.click('#po-go');
    else if (s.screen === 'store' && s.storeOpen && !s.storeBusy && plan.leaveStore !== false) await page.click('#store-done');
    await page.waitForTimeout(60);
  }
  throw new Error('drive timed out on ' + JSON.stringify(await W(page)).slice(0, 400));
}
/** A real drag on the river's number line to v (0 … 1): pointer down near the start, move, up. */
async function dragRope(page, v) {
  const pts = await J(page, (v) => {
    const svg = document.querySelector('#rv-svg');
    const m = svg.getScreenCTM();
    const at = (x) => { const p = svg.createSVGPoint(); p.x = x; p.y = 170; const q = p.matrixTransform(m); return [q.x, q.y]; };
    return { from: at(70 + 860 * 0.1), to: at(70 + 860 * v) };
  }, v);
  await page.mouse.move(...pts.from);
  await page.mouse.down();
  await page.mouse.move((pts.from[0] + pts.to[0]) / 2, pts.to[1], { steps: 4 });
  await page.mouse.move(...pts.to, { steps: 4 });
  await page.mouse.up();
}

async function runLayout(browser, layout) {
  console.log(`\n=== ${layout.name} ${layout.width}x${layout.height} ===`);
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await routeFonts(ctx);
  const errors = [];
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(({ insets }) => {
    if (!sessionStorage.getItem('wwSmokeSeeded')) { localStorage.clear(); sessionStorage.setItem('wwSmokeSeeded', '1'); }
    window.__wwScript = { daySec: 0.12, beat: 0.15 };
    window.__mockScript = { shotMs: 80 };
    window.__spoken = [];
    window.__ttsBackend = {
      speaking: false, pending: false,
      getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 30); },
      cancel() {}, addEventListener() {},
    };
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(s);
    });
  }, { insets: layout.insets });
  await page.goto(URL0, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const texts = [];
  const grab = async () => texts.push(await kidText(page));

  // ---------- picker + new player ----------
  await page.waitForSelector(visibleSel('#screen-players'));
  await shot(page, layout, '01-players');
  await audit(page, layout.insets, 'player picker');
  const pick = await J(page, () => ({ tiles: document.querySelectorAll('[data-player]').length, add: !!document.querySelector('#pl-add'), origin: location.origin, home: document.querySelector('#btn-home').href, scene: window.__wagonWest.app.sceneName }));
  check(pick.tiles === 0 && pick.add, 'picker is the first screen, with "+ New player"');
  check(pick.home === pick.origin + '/', 'the Learning Lab link stays on this origin');
  check(pick.scene === 'mock scene', 'the mock scene is running (?mock=1)');
  await page.click('#pl-add');
  await page.waitForSelector(visibleSel('#screen-newplayer'));
  for (const k of 'mia') await page.click(`#np-keyboard .kb-key[data-key="${k}"]`);
  await audit(page, layout.insets, 'new player');
  await page.click('#np-keyboard .kb-enter');
  await page.waitForSelector(visibleSel('#screen-title'));
  const pid = await J(page, () => window.__wagonWest.app.currentPlayerId);
  const fam = await J(page, () => JSON.parse(localStorage.getItem('spellJump.family')));
  check(fam.players.length === 1 && fam.players[0].name === 'Mia', 'the player Mia is in the family record shared with the other games');

  // ---------- title ----------
  const t0 = await J(page, () => ({ label: document.querySelector('#btn-trail-label').textContent, action: document.querySelector('#btn-trail').dataset.action, stops: document.querySelectorAll('#title-map .map-stop').length, wagon: !!document.querySelector('#title-map .map-wagon'), words: Number(document.querySelector('#title-words-n').textContent) }));
  check(t0.label === 'Pack the wagon' && t0.action === 'outfit', `the title before the first journey: "${t0.label}"`);
  check(t0.stops >= 3 && t0.wagon, `the map: ${t0.stops} stops and the wagon at Independence`);
  check(t0.words > 0, `the week's words count on the title (${t0.words} words from Spell Jump's list)`);
  await shot(page, layout, '02-title');
  await audit(page, layout.insets, 'title');
  await grab();

  // ---------- outfit ----------
  await page.click('#btn-trail');
  await page.waitForSelector(visibleSel('#screen-outfit'));
  check(await J(page, () => !document.querySelector('#screen-outfit input')), 'outfit: the wagon is named on the on-screen keyboard (no native input)');
  for (const k of 'dusty') await page.click(`#ow-keyboard .kb-key[data-key="${k}"]`);
  await audit(page, layout.insets, 'outfit (name)');
  await shot(page, layout, '03-outfit-name');
  await page.click('#ow-keyboard .kb-enter');
  await page.waitForSelector('.ow-animal');
  await page.click('.ow-animal[data-animal="mules"]');
  check(await J(page, () => document.querySelector('.ow-animal[data-animal="mules"]').classList.contains('on')), 'outfit: the mules picked (faster and hungrier: their miles a day and feed show)');
  await audit(page, layout.insets, 'outfit (animal)');
  await page.click('#ow-next');
  const comps = await J(page, () => [...document.querySelectorAll('.ow-comp')].map((b) => b.dataset.companion));
  for (const id of comps.slice(0, 3)) await page.click(`.ow-comp[data-companion="${id}"]`);
  check(await J(page, () => document.querySelector('#ow-party-count').textContent) === '3 of 3 chosen', 'outfit: three companions chosen');
  await shot(page, layout, '04-outfit-party');
  await audit(page, layout.insets, 'outfit (party)');
  await page.click('#ow-next');
  await page.waitForSelector('.ow-looks');
  await audit(page, layout.insets, 'outfit (look)');
  await grab();
  await page.click('#ow-next');

  // ---------- the store at Independence: a buy right, a divide missed and fixed ----------
  await page.waitForSelector(visibleSel('#screen-store'));
  const j0 = (await W(page)).journey;
  check(j0 && j0.legIndex === 0 && (await J(page, () => window.__wagonWest.save.journey.wagonName)) === 'Dusty', `a journey: "Dusty", leg 1, $${j0 && j0.cash}`);
  await shot(page, layout, '05-store');
  await audit(page, layout.insets, 'store');
  await page.click('.st-good[data-good="flour"]');
  await page.waitForSelector(visibleSel('#panel-problem'));
  const p1 = await W(page);
  const spoken0 = await J(page, () => window.__spoken.length);
  check(p1.pKind === 'buy' && p1.problem === 'ask', `the store asks a 'buy' problem on the problem panel ("${await J(page, () => document.querySelector('#pp-text').textContent)}")`);
  await shot(page, layout, '06-problem');
  await audit(page, layout.insets, 'problem panel');
  await typeDigits(page, '#panel-problem', p1.pAns);
  await page.waitForFunction(() => window.__wagonWest.problemPanel.state === 'closed');
  const j1 = (await W(page)).journey;
  check(j1.tokens === j0.tokens + 1 && j1.food > j0.food && j1.cash < j0.cash, `a right first answer: the flour in the wagon (${j0.food} → ${j1.food} lb, $${j0.cash} → $${j1.cash}) and a trade token`);
  check(await J(page, (n) => window.__spoken.slice(n).some((t) => /flour/i.test(t)), spoken0), 'the problem is read aloud');
  await page.waitForTimeout(250);
  await page.click('.st-good[data-good="bacon"]');
  await page.waitForFunction(() => window.__wagonWest.problemPanel.state === 'ask');
  const p2 = await W(page);
  check(p2.pKind === 'divide', "the next good asks a 'divide' problem");
  await typeDigits(page, '#panel-problem', p2.pAns + 1);
  await page.waitForFunction(() => window.__wagonWest.problemPanel.state === 'work');
  check(await J(page, () => document.querySelector('#pp-tiles').dataset.typed === ''), 'a miss: the typed answer is gone (never left on screen)');
  await page.waitForFunction(() => window.__wagonWest.problemPanel.state === 'copy', null, { timeout: 15000 });
  const work = await J(page, () => [...document.querySelectorAll('#pp-work li')].map((l) => l.textContent));
  check(work.length >= 2, `then the work, line by line (${work.join(' | ')})`);
  await shot(page, layout, '07-problem-work');
  await audit(page, layout.insets, 'problem panel (the work)');
  // the copy, then any further parts (the remainder variant asks a second number in turn), until the panel closes
  let fixedSeen = false;
  for (let guard = 0; guard < 12; guard++) {
    const st = await W(page);
    if (st.problem === 'closed') break;
    if (st.problem === 'ask' || st.problem === 'copy') await typeDigits(page, '#panel-problem', st.pAns);
    await page.waitForFunction(() => /Fixed it!/.test(document.querySelector('#pp-msg').textContent) || window.__wagonWest.problemPanel.state === 'closed' || window.__wagonWest.problemPanel.state === 'ask', null, { timeout: 15000 }).catch(() => {});
    if (await J(page, () => /Fixed it!/.test(document.querySelector('#pp-msg').textContent))) fixedSeen = true;
    await page.waitForTimeout(150);
  }
  await page.waitForFunction(() => window.__wagonWest.problemPanel.state === 'closed', null, { timeout: 15000 });
  check(fixedSeen, 'the copy matches: "Fixed it!"');
  const j2 = (await W(page)).journey;
  check(j2.tokens === j1.tokens && j2.food > j1.food, `fixed: the bacon comes at the fair price anyway (${j2.food} lb), no token`);
  await grab();

  // ---------- leg 1: the trail ----------
  await page.click('#store-done');
  await page.waitForSelector(visibleSel('#screen-trail'));
  await page.waitForFunction(() => window.__wagonWest.card.isOpen);
  check(await J(page, () => window.__wagonWest.card.title) === 'Roll out!', 'the first time on the trail: a short how-it-works card');
  await audit(page, layout.insets, 'trail (coach card)');
  await page.click('#tc-go');
  await page.waitForTimeout(250);
  const hud = await J(page, () => ({ day: document.querySelector('#hud-day').textContent, where: document.querySelector('#hud-where').textContent, food: document.querySelector('#hud-food').textContent,
    faces: document.querySelectorAll('#hud-faces .face').length, pace: [...document.querySelectorAll('#dial-pace .seg-btn')].map((b) => b.dataset.pace).join(), rations: [...document.querySelectorAll('#dial-rations .seg-btn')].map((b) => b.dataset.rations).join() }));
  check(/^Day \d+$/.test(hud.day) && / in \d+ mi$/.test(hud.where) && /lb$/.test(hud.food) && hud.faces === 3, `the HUD: "${hud.day} · ${hud.where}", food ${hud.food}, ${hud.faces} mood faces`);
  check(hud.pace === 'steady,brisk' && hud.rations === 'full,plenty,lean', 'the two dials: pace (steady / brisk) and rations (full / plenty / lean)');
  await shot(page, layout, '08-trail');
  await audit(page, layout.insets, 'trail HUD');
  await grab();
  let markerShot = false, dials = false;
  const leg1 = await drive(page, (s) => s.screen === 'results', {
    markerMiss: [2],
    async onEach(s) {
      // the dials, on the trail between panels: brisk pace, full rations (the first change asks the rations question)
      if (!dials && s.screen === 'trail' && s.marker === 'closed' && s.problem === 'closed' && !s.card && !s.mini && s.travel && !s.travel.busy) {
        dials = true;
        // (DOM clicks: a mile marker can open between two pointer clicks and swallow the second; the sim starts on
        // full rations, so the change is to plenty)
        await J(page, () => { document.querySelector('#dial-pace [data-pace="brisk"]').click(); document.querySelector('#dial-rations [data-rations="plenty"]').click(); });
        await page.waitForFunction(() => window.__wagonWest.problemPanel.state === 'ask' || window.__wagonWest.markerPanel.state === 'ask', null, { timeout: 5000 }).catch(() => {});
        const d = await W(page);
        check(d.journey.pace === 'brisk' && d.journey.rations === 'plenty', 'the dials: brisk pace, plenty rations');
        check((d.problem === 'ask' && d.pKind === 'ration') || d.marker === 'ask' || d.card, 'the first rations change asks the rations question (after any marker or event card that was due)');
      }
      if (s.marker === 'ask' && !markerShot) { markerShot = true; await shot(page, layout, '09-marker', 50); await audit(page, layout.insets, 'mile marker'); }
      if (s.marker === 'show') { const t = await J(page, () => ({ tiles: document.querySelector('#mk-tiles').textContent, typed: document.querySelector('#mk-tiles').dataset.typed })); if (!globalThis.__shownChecked) { globalThis.__shownChecked = true; check(t.typed === '' && Number(t.tiles) === s.mAns, `a missed marker: the fact with its answer shown (${t.tiles}), the typed one gone`); await shot(page, layout, '10-marker-show', 0); } }
      if (s.marker === 'copy' && !globalThis.__coverChecked) { globalThis.__coverChecked = true; check(await J(page, () => document.querySelectorAll('#mk-tiles .pn-tile.covered').length > 0), 'then the answer covered: typed once from memory'); }
      if (s.screen === 'river' && s.spell === 'write' && !globalThis.__spellShot) { globalThis.__spellShot = true; await shot(page, layout, '11-river-spell', 50); await audit(page, layout.insets, 'river (spell panel)'); await grab(); }
      if (s.screen === 'river' && s.rvRope && !globalThis.__ropeShot) { globalThis.__ropeShot = true; await shot(page, layout, '12-rope', 50); await audit(page, layout.insets, 'river (rope toss)'); await grab(); }
      if (s.mini && !globalThis.__miniShot) { globalThis.__miniShot = true; await shot(page, layout, '13-mini', 0); }
      if (s.card && !globalThis.__cardShot) { globalThis.__cardShot = true; await audit(page, layout.insets, `trail card (${s.cardTitle})`); }
    },
  });
  globalThis.__shownChecked = globalThis.__coverChecked = globalThis.__spellShot = globalThis.__ropeShot = globalThis.__miniShot = globalThis.__cardShot = false;
  check(leg1.markers.length >= 4 && leg1.markers.filter((m) => m === 'missed').length === 1, `leg 1: ${leg1.markers.length} mile markers (one missed and fixed): ${leg1.markers.join(', ')}`);
  check(leg1.problems.length >= 1, `leg 1 problems on the trail: ${leg1.problems.join(', ')}`);
  check(leg1.words.length === 3 && leg1.throws >= 1, `the river: three words spelled (${leg1.words.join(', ')}) and the rope thrown (${leg1.throws}×)`);
  check(leg1.cards.some((c) => /Kansas River/i.test(c)), `the lookout card at the stop (${leg1.cards.join(' · ')})`);
  check(leg1.cards.includes('Make camp tonight?'), 'the evening of the arrival offers Camp before the results ("Make camp tonight?" / "On to the results")');

  // ---------- results ----------
  const res1 = await J(page, () => ({ rows: [...document.querySelectorAll('#res-pay tr:not(.total)')].map((r) => Number(r.dataset.amount)), total: Number(document.querySelector('#res-pay tr.total').dataset.amount),
    stars: document.querySelectorAll('#res-stars .rs-star').length, on: document.querySelectorAll('#res-stars .rs-star.on').length, sticker: !document.querySelector('#res-sticker').hidden, title: document.querySelector('#res-title').textContent,
    last: window.__wagonWest.results.last, crate: !!document.querySelector('#res-crate-open') }));
  check(res1.rows.reduce((a, b) => a + b, 0) === res1.total && res1.total > 0, `results: the cash rows add up (${res1.rows.join(' + ')} = ${res1.total})`);
  check(res1.stars === 3 && res1.on >= 1 && res1.sticker && /Kansas River/.test(res1.title), `results: "${res1.title}", ${res1.on} of 3 stars, the sticker`);
  check(res1.last.stars[2] === false, 'one marker missed: no "every marker right" star (and nothing else lost)');
  if (res1.crate) {
    await page.click('#res-crate-open');
    check(await J(page, () => !!document.querySelector('#res-crate-reveal')), 'the crate opens with a tap (a look or cash)');
  }
  await shot(page, layout, '14-results');
  await audit(page, layout.insets, 'results');
  await grab();
  const facts = await J(page, (id) => JSON.parse(localStorage.getItem(`trailBlazer.${id}.facts`)), pid);
  const recs = facts ? Object.values(facts.records || {}) : [];
  check(recs.length >= 3 && recs.reduce((a, r) => a + (r.attempts || r.seenCount || 0), 0) >= 5, `the markers wrote the child's own Trail Blazer facts store (${recs.length} facts, trailBlazer.<id>.facts)`);
  const words = await J(page, (id) => JSON.parse(localStorage.getItem(`spellJump.${id}.words`)), pid);
  const seen = words ? Object.values(words.records).filter((r) => r.seenCount > 0).map((r) => r.word) : [];
  check(leg1.words.every((w) => seen.includes(w)), `the river words were recorded in the child's Spell Jump word store (recordSpell: ${seen.join(', ')})`);
  const play1 = await J(page, () => Object.values(window.__wagonWest.save.play)[0]);
  // (a 'fact' event asks on the marker panel too, so the driver can count one more marker than the journey logs)
  check(play1 && play1.legs === 1 && play1.markers === leg1.markers.length && play1.words === 3 && play1.problems >= 3, `today's log: ${JSON.stringify(play1)}`);

  if (layout.legs >= 2) {
    // ---------- leg 2: the hunt, the fort, the store and the letter ----------
    await page.click('#res-next');
    await page.waitForSelector(visibleSel('#screen-trail'));
    let storeBought = false, letterChecked = false, derbyRun = false, derbyChecked = false, dogChecked = false;
    let huntForced = false;
    const leg2 = await drive(page, (s) => s.screen === 'results', {
      leaveStore: false,
      async onEach(s) {
        // the leg's events are seeded by the sim; the hunt path is exercised by the test hook once the trail is idle
        if (!huntForced && s.screen === 'trail' && s.marker === 'closed' && s.problem === 'closed' && !s.card && !s.mini && s.travel && !s.travel.busy && s.journey.milesDone > 20) {
          huntForced = true;
          await J(page, () => window.__wagonWest.playEvent('hunt'));
        }
        if (s.card && s.cardTitle === 'A new friend' && !dogChecked) {
          dogChecked = true;
          check(await J(page, () => /A dog has been following the wagon\. Keep it\?/.test(document.querySelector('#tc-text').textContent) && !document.querySelector('#tc-alt').hidden), 'Fort Kearny: "A dog has been following the wagon. Keep it?" (Keep it! / Not now)');
          await audit(page, layout.insets, 'the dog card');
        }
        if (s.screen === 'store' && s.storeOpen && !s.storeBusy && s.problem === 'closed' && !s.card && s.marker === 'closed') {
          if (!storeBought) { storeBought = true; await page.click('.st-good[data-good="flour"]'); await page.waitForFunction(() => window.__wagonWest.problemPanel.state !== 'closed' || window.__wagonWest.store.busy === false); }
          else if (!derbyRun && await J(page, () => !!document.querySelector('#store-derby'))) {
            derbyRun = true;
            await audit(page, layout.insets, 'store (Race the mail wagon)');
            await shot(page, layout, '15a-store-derby', 0);
            await page.click('#store-derby');
          } else {
            check(derbyRun && await J(page, () => !document.querySelector('#store-derby')), 'Fort Derby: once per fort visit (the button is gone after the race)');
            await page.click('#store-done');
          }
        }
        if (s.screen === 'dog' && !globalThis.__dogShot) { globalThis.__dogShot = true; await audit(page, layout.insets, 'name the dog'); await shot(page, layout, '15b-dog', 0); }
        if (s.marker === 'ask' && s.mTitle === 'Fort Derby' && !derbyChecked) {
          derbyChecked = true;
          const d = await J(page, () => ({ chip: document.querySelector('#mk-chip').textContent, mini: window.__wagonWest.scene.getState().mini, line: document.querySelector('#derby-line').textContent }));
          check(/^Marker 1 of \d+$/.test(d.chip) && d.mini && d.mini.kind === 'derby' && /^Marker 1 of/.test(d.line), `Fort Derby: the race pauses at a marker and the marker panel asks a fact (chip "${d.chip}")`);
          await audit(page, layout.insets, 'Fort Derby (marker)');
          await shot(page, layout, '15c-derby', 0);
        }
        if (s.screen === 'post' && !letterChecked && s.spell === 'write') {
          letterChecked = true;
          const pp = await J(page, () => ({ lines: document.querySelectorAll('#po-paper .po-line').length, blanks: [...document.querySelectorAll('.po-blank')].map((b) => b.textContent.trim()), paper: document.querySelector('#po-paper').textContent }));
          const w = s.word;
          check(pp.lines >= 4 && pp.blanks.length === 3, `the letter: the opening and three lines, then the P.S. with three blanks (${pp.lines} lines)`);
          check(!pp.paper.includes(w), `R1: the word "${w}" is not on the letter before it is spelled`);
          await shot(page, layout, '15-letter-spell', 0);
        }
        if (s.screen === 'post' && s.poFoot && !globalThis.__poShot) { globalThis.__poShot = true; await shot(page, layout, '16-letter', 50); await audit(page, layout.insets, 'post office (the letter)'); await grab(); }
      },
    });
    check(leg2.minis >= 1, 'leg 2: the hunt ran on the scene (scripted on the mock: 5 shots, hit / miss)');
    check(storeBought && leg2.words.length === 3, `the fort: a store problem and the letter's three words (${leg2.words.join(', ')})`);
    const letters = await J(page, () => window.__wagonWest.save.letters);
    check(letters.length === 1 && leg2.words.every((w) => letters[0].text.includes(w)) && /\n[^\n]+,\s*Mia\s*$/.test(letters[0].text), 'the letter is kept in the journal with the three words, signed "Mia"');
    check(await J(page, () => window.__spoken.some((t) => /^Here is your letter/.test(t))), 'the letter is read back aloud');
    check(await J(page, () => (window.__wagonWest.save.journey.goods || {}).pelts >= 0 && window.__wagonWest.save.journey.legStats != null), 'the journey carries on (leg 3 started by nextLeg)');
    const v11 = await J(page, () => {
      const w = window.__wagonWest, Jn = w.save.journey;
      return { dog: Jn.dog, sceneDog: w.scene.getState().dog, derby: w.lastDerby, cards: Array.isArray(Jn.cards) ? Jn.cards.slice() : Object.keys(Jn.cards || {}), pops: w.cardPop.log, crates: w.save.crates.queue.length };
    });
    check(leg2.dog && v11.dog && v11.dog.name === 'Rex' && v11.dog.coat === 'spotted' && v11.sceneDog && v11.sceneDog.name === 'Rex', `the dog: named "${v11.dog && v11.dog.name}" on the keyboard, kept on the journey and walking in the scene's party`);
    check(v11.derby && v11.derby.won && v11.derby.cash > 0 && leg2.cards.some((c) => /^You beat the mail wagon by \d+ m!$/.test(c)), `Fort Derby on the mock: won by ${v11.derby && v11.derby.margin} m, $${v11.derby && v11.derby.cash} (derbyPay), "${leg2.cards.find((c) => /mail wagon/.test(c))}"`);
    check(['kansas-river', 'fort-kearny'].every((id) => v11.cards.includes(id)) && v11.pops.length >= 4, `trail cards: the lookouts' landmark cards and more dropped (${v11.cards.length} cards: ${v11.cards.join(', ')}; ${v11.pops.length} pops)`);
  }

  // ---------- journal ----------
  await page.click('#res-journal');
  await page.waitForSelector(visibleSel('#screen-journal'));
  await audit(page, layout.insets, 'journal (letters)');
  await shot(page, layout, '17-journal-letters');
  await page.click('#jr-tabs [data-page="stickers"]');
  const got = await J(page, () => document.querySelectorAll('.jr-sticker.got').length);
  check(got === layout.legs, `journal: ${got} sticker(s) earned`);
  await audit(page, layout.insets, 'journal (stickers)');
  await shot(page, layout, '18-journal-stickers');
  await page.click('#jr-tabs [data-page="map"]');
  check(await J(page, () => document.querySelectorAll('.jr-map .map-label').length >= 4 && document.querySelector('.jr-map').dataset.legsDone === String(window.__wagonWest.save.journey.legIndex)), 'journal: the map with every stop named and the wagon where it is');
  await audit(page, layout.insets, 'journal (map)');
  await shot(page, layout, '19-journal-map');
  await grab();
  await page.click('#jr-tabs [data-page="cards"]');
  const album = await J(page, () => ({ suits: [...document.querySelectorAll('.cards-suit')].map((x) => `${x.dataset.suit}:${x.querySelector('.cards-count').textContent}`),
    owned: document.querySelectorAll('.cards-grid button.tcard').length, none: document.querySelectorAll('.cards-grid .tcard.none').length, total: document.querySelector('#cards-total').textContent,
    have: (window.__wagonWest.save.journey.cards || []).length }));
  check(album.suits.length === 4 && /^landmark:\d+ of \d+$/.test(album.suits[0]) && album.owned === album.have && album.owned + album.none >= 40, `journal → Cards: four suits (${album.suits.join(', ')}), ${album.owned} cards face up, the rest face down`);
  await audit(page, layout.insets, 'journal (cards)');
  const flip0 = await J(page, () => window.__spoken.length);
  await page.click('.cards-grid button.tcard[data-card="kansas-river"]');
  await page.waitForTimeout(150);
  check(await J(page, (n) => document.querySelector('.cards-grid button.tcard[data-card="kansas-river"]').classList.contains('flipped') && window.__spoken.length > n, flip0), 'a card flips over on a tap to its fact, read aloud');
  await shot(page, layout, '19b-journal-cards', 500);
  await grab();
  await page.click('#screen-journal [data-back="title"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  const t2 = await J(page, () => ({ label: document.querySelector('#btn-trail-label').textContent, streak: Number(document.querySelector('#title-streak-n').textContent), done: document.querySelector('#title-map').dataset.legsDone }));
  check(t2.label === 'Hit the trail' && t2.streak === 1 && t2.done === String(layout.legs), `the title after ${layout.legs} leg(s): "${t2.label}", the streak flame at ${t2.streak}, the map at stop ${t2.done}`);
  await shot(page, layout, '20-title-later');
  await audit(page, layout.insets, 'title (on the way)');
  await sideGames(page, layout, grab);

  // ---------- pings ----------
  const pings = await J(page, () => window.__pings || []);
  check(pings.filter((p) => p.kind === 'day').length === 1 && pings.filter((p) => p.kind === 'leg').length === layout.legs && pings.every((p) => p.game === 'wagon-west' && p.fam === '' && Object.keys(p).join() === 'game,v,kind,fam'),
    `pings: one 'day', a 'leg' per leg, nothing else in them (${pings.map((p) => p.kind).join(', ')})`);

  // ---------- Parent Zone ----------
  await page.click('#btn-parents');
  await page.waitForSelector(visibleSel('#pz'));
  check(await J(page, () => document.querySelector('#pin-title').textContent) === 'Choose a 4-digit PIN', 'Parents: first use sets the PIN');
  await audit(page, layout.insets, 'Parent Zone (PIN)');
  for (const d of '1234') await page.click(`.pinpad [data-digit="${d}"]`);
  await page.waitForTimeout(250);
  for (const d of '1234') await page.click(`.pinpad [data-digit="${d}"]`);
  await page.waitForSelector('.pz-tabs');
  const tabs = await J(page, () => [...document.querySelectorAll('.pz-tabs .seg-btn')].map((b) => b.dataset.tab).join(','));
  check(tabs === 'sync,journey,options,report,players', `Parent Zone tabs: ${tabs}`);
  const strip = await J(page, () => { const r = document.querySelector('#pz-week-list .pz-week-row .pw-strip'); return r && r.textContent; });
  check(/^Wagon West this week · \d+ legs? · \d+ % right$/.test(strip || ''), `Family code: a strip per child ("${strip}")`);
  await audit(page, layout.insets, 'Parent Zone (Family code)');
  await page.click('.pz-tabs [data-tab="journey"]');
  const jr = await J(page, () => ({ where: document.querySelector('#jr-where-line').textContent, party: document.querySelectorAll('#jr-party li').length }));
  check(/leg \d+ of \d+/.test(jr.where) && jr.party === 4, `Journey: "${jr.where}", the wagon and the three companions`);
  await audit(page, layout.insets, 'Parent Zone (Journey)');
  await shot(page, layout, '22-pz-journey');
  await page.click('.pz-tabs [data-tab="options"]');
  check(await J(page, () => !!document.querySelector('#opt-hunting') && !!document.querySelector('#opt-fractions') && /Wagon West 1\.1\.0 · mock scene/.test(document.querySelector('.ver').textContent)), 'Options: hunting, fractions at rivers, the version and the scene');
  check(await J(page, () => document.querySelector('#opt-voice-line').textContent === 'Device voice' && !!document.querySelector('#opt-voice-test')), 'Options: the voice line ("Device voice": no natural voice picked) and "Say a test line"');
  await page.click('#opt-voice-test');
  await page.waitForFunction(() => /voice spoke/.test(document.querySelector('#opt-voice-result').textContent), null, { timeout: 8000 }).catch(() => {});
  check(await J(page, () => document.querySelector('#opt-voice-result').dataset.engine === 'device' && /^The device voice spoke it\.$/.test(document.querySelector('#opt-voice-result').textContent)), `Say a test line: "${await J(page, () => document.querySelector('#opt-voice-result').textContent)}"`);
  await page.click('#opt-music');
  check(await J(page, () => window.__wagonWest.app.settings.music === false), 'Options: the music toggle (Music.on(false))');
  await page.click('#opt-music');
  await audit(page, layout.insets, 'Parent Zone (Options)');
  await page.click('#opt-hunting');
  check(await J(page, () => window.__wagonWest.app.settings.hunting === false && JSON.parse(localStorage.getItem('wagonWest.settings')).hunting === false), 'Options: hunting off is kept on this device');
  await page.click('#opt-hunting');
  await page.click('.pz-tabs [data-tab="report"]');
  const ch = await J(page, () => {
    const f = document.querySelector('#report-chart');
    const svg = f && f.querySelector('svg.pz-chart-svg');
    return f && { empty: f.dataset.empty, series: [...f.querySelectorAll('.pz-legend .lg')].map((x) => x.textContent), bars: svg.querySelectorAll('.bars rect').length, paths: svg.querySelectorAll('path[data-series]').length,
      chips: [...document.querySelectorAll('#chart-range .chip')].map((c) => c.textContent + (c.classList.contains('on') ? ':on' : '')), kinds: document.querySelectorAll('#report-kinds tbody tr').length, links: f.querySelectorAll('a').length,
      play: document.querySelectorAll('#report-play li').length, week: document.querySelector('#report-week-line').textContent };
  });
  check(ch && ch.empty === 'false' && ch.series.join(',') === 'Markers,Problems,Words,Right first try %' && ch.bars >= 3 && ch.paths >= 1 && ch.chips.join(',') === '2 weeks,4 weeks:on,12 weeks' && ch.links === 0,
    `Report: the progress chart (markers, problems, words, right %) with today's data (${ch && ch.bars} bars), range chips`);
  check(ch.kinds >= 3 && ch.play === 1 && /Markers \d+ % right/.test(ch.week), `Report: problems by kind (${ch.kinds} kinds), play day by day, "${ch.week}"`);
  await page.click('#chart-range [data-days="84"]');
  await page.waitForTimeout(150);
  check(await J(page, () => document.querySelector('#chart-range [data-days="84"]').classList.contains('on')), '12 weeks: the chart redraws');
  await J(page, () => document.querySelector('#report-chart').scrollIntoView({ block: 'center' }));
  await shot(page, layout, '23-pz-report');
  await audit(page, layout.insets, 'Parent Zone (Report)');
  await page.click('#report-copy');
  await page.waitForTimeout(200);
  check(await J(page, () => /Problems by kind/.test(document.querySelector('#report-text').textContent)), 'Copy report: the text has the problems by kind');
  await page.click('.pz-tabs [data-tab="players"]');
  check(await J(page, (id) => !!document.querySelector(`.pz-player[data-player="${id}"] input[type="text"]`), pid), 'Players: rename (the only native inputs are in here)');
  await audit(page, layout.insets, 'Parent Zone (Players)');
  await page.click('#pz-close');

  // ---------- reload persistence ----------
  const before = await J(page, () => JSON.parse(JSON.stringify(window.__wagonWest.save)));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  const tile = await J(page, (id) => document.querySelector(`[data-player="${id}"] .pl-level`).textContent, pid);
  check(/^Leg \d+ of \d+ · 1847$/.test(tile), `the picker tile says where Mia is ("${tile}")`);
  await page.click(`[data-player="${pid}"]`);
  await page.waitForSelector(visibleSel('#screen-title'));
  const back = await J(page, () => window.__wagonWest.save);
  check(back.journey.legIndex === before.journey.legIndex && back.journey.milesDone === before.journey.milesDone && back.stickers.length === before.stickers.length && back.letters.length === before.letters.length && back.journey.wagonName === 'Dusty',
    `after a reload: leg ${back.journey.legIndex + 1} at mile ${back.journey.milesDone}, ${back.stickers.length} stickers, ${back.letters.length} letters`);
  check(await J(page, () => Object.keys(localStorage).some((k) => /^wagonWest\.[^.]+\.save$/.test(k))), 'Wagon West writes its own key (wagonWest.<id>.save)');

  // ---------- kid rules ----------
  const bad = texts.map((t) => (t.match(BANNED) || [])[0]).filter(Boolean);
  check(bad.length === 0, `kid-rule text audit on every kid screen: no death / lives / timers / countdowns / wrong${bad.length ? ' — found: ' + bad.join(', ') : ''}`);
  check(errors.length === 0, `no console errors${errors.length ? ' — ' + errors.slice(0, 4).join(' | ') : ''}`);
  await ctx.close();
}

// ---------- v1.1 side games after the second leg: the daily challenge, an upgrade, Camp, the music ----------
const musicNow = (page) => J(page, () => {
  const w = window.__wagonWest, c = w.Music.current;
  const app = w.music;
  return { mood: c && typeof c === 'object' && c.mood ? c.mood : app.mood, tune: c && typeof c === 'object' && c.tune ? c.tune : app.tune, app };
});
async function sideGames(page, layout, grab) {
  // the daily challenge on the title: done and claimed on the trail (a token and a card)
  const dc = await J(page, () => {
    const w = window.__wagonWest, el = document.querySelector('#title-challenge');
    return { shown: !el.hidden, text: el.textContent, done: el.dataset.done, daily: w.save.daily, info: w.app.daily() };
  });
  check(dc.shown && /^Today's challenge: \S/.test(dc.text), `the title: "${dc.text}"`);
  if (dc.info && dc.info.done) check(dc.daily.claimed && dc.done === 'true', "the daily challenge: done on the trail, claimed once (a token and a card), a check mark on the title");
  else console.log(`  (today's challenge is not done yet on this run: "${dc.text}")`);
  const m0 = await musicNow(page);
  check(m0.mood === 'camp', `music: the title plays the camp mood (${m0.mood})`);

  // an upgrade bought with tokens: Outfit → Look → Wagon
  await J(page, () => { window.__wagonWest.save.journey.tokens += 25; window.__wagonWest.app.persist(); });
  const tk0 = await J(page, () => window.__wagonWest.save.journey.tokens);
  await page.click('#btn-outfit');
  await page.waitForSelector(visibleSel('#screen-outfit'));
  await page.click('[data-pane="wagon"]');
  await page.waitForSelector('.ow-up');
  const ups = await J(page, () => [...document.querySelectorAll('.ow-up')].map((u) => ({ id: u.dataset.up, text: u.textContent })));
  check(ups.length === 3 && ups.every((u) => u.text.length > 10), `Outfit → Look → Wagon: the three upgrades with their effect (${ups.map((u) => u.id).join(', ')})`);
  await audit(page, layout.insets, 'outfit (wagon upgrades)');
  await shot(page, layout, '20b-upgrades');
  await page.click('[data-upgrade="cover:tokens"]');
  const up = await J(page, () => { const Jn = window.__wagonWest.save.journey; return { tokens: Jn.tokens, owned: !!(Array.isArray(Jn.upgrades) ? Jn.upgrades.includes('cover') : Jn.upgrades && Jn.upgrades.cover), row: document.querySelector('.ow-up[data-up="cover"]').textContent }; });
  check(up.owned && up.tokens < tk0 && /On the wagon/.test(up.row), `bought the canvas cover with tokens (${tk0} → ${up.tokens})`);
  await page.click('#ow-next');
  await page.waitForSelector(visibleSel('#screen-title'));

  // Camp from the trail
  await page.click('#btn-trail');
  await page.waitForSelector(visibleSel('#screen-trail'));
  await page.waitForFunction(() => window.__wagonWest.save.journey.milesDone > 0 || window.__wagonWest.markerPanel.isOpen || window.__wagonWest.card.isOpen, null, { timeout: 8000 });
  await drive(page, (s) => s.screen === 'trail' && s.marker === 'closed' && s.problem === 'closed' && !s.card && !s.mini && s.journey.milesDone > 0 && s.travel && !s.travel.busy, {}, 15000);
  const mt = await musicNow(page);
  const legIx = await J(page, () => window.__wagonWest.save.journey.legIndex);
  check(mt.mood === 'trail' && mt.tune === ['susanna', 'buffalo', 'tucker'][legIx % 3], `music on the trail: the trail mood, "${mt.tune}" for leg ${legIx + 1}`);
  // (a marker can come up between two looks: then the Camp button waits for it, so try again once the trail is idle)
  let mid = 0;
  for (let k = 0; k < 10; k++) {
    await drive(page, (s) => s.screen === 'trail' && s.marker === 'closed' && s.problem === 'closed' && !s.card && !s.mini && s.travel && !s.travel.busy, {}, 15000);
    mid = (await W(page)).journey.milesDone;
    await J(page, () => document.querySelector('#btn-camp').click());
    if (await page.waitForSelector(visibleSel('#screen-camp'), { timeout: 1500 }).then(() => true, () => false)) break;
  }
  mid = (await W(page)).journey.milesDone;
  const camp0 = await J(page, () => ({ acts: [...document.querySelectorAll('.camp-act')].map((b) => b.dataset.act), back: document.querySelector('#camp-back').textContent.trim(), stop: !document.querySelector('#camp-stop').hidden, backdrop: window.__wagonWest.scene.getState().backdrop, day: window.__wagonWest.save.journey.day, tokens: window.__wagonWest.save.journey.tokens }));
  check(camp0.acts.join() === 'fish,hunt,cards,tales,rest' && camp0.back === 'Back to the trail' && camp0.stop && camp0.backdrop === 'camp', `"Camp" on the trail opens Camp on the camp backdrop: ${camp0.acts.join(', ')} · "${camp0.back}" · "Stop for today"`);
  check((await musicNow(page)).mood === 'camp', 'music: the camp mood at camp');
  await audit(page, layout.insets, 'camp');
  await shot(page, layout, '21-camp');
  await grab();

  // Quick Draw: first to 7, the companion draws after each answer, a token on a win
  await page.click('[data-act="cards"]');
  let qdOff = false, qdChip = '', qdTitle = '', asked = 0;
  for (let guard = 0; guard < 60; guard++) {
    await page.waitForFunction(() => window.__wagonWest.markerPanel.state === 'ask' || window.__wagonWest.card.isOpen, null, { timeout: 10000 });
    const s = await W(page);
    if (s.card) { qdTitle = s.cardTitle; break; }
    if (!qdOff) { qdOff = (await musicNow(page)).mood === 'off'; qdChip = await J(page, () => document.querySelector('#mk-chip').textContent); await audit(page, layout.insets, 'Quick Draw (marker panel)'); }
    asked += 1;
    await typeDigits(page, '#panel-marker', s.mAns);
    await page.waitForFunction(() => window.__wagonWest.markerPanel.state !== 'right' && window.__wagonWest.markerPanel.state !== 'ask' || window.__wagonWest.card.isOpen, null, { timeout: 8000 }).catch(() => {});
  }
  check(/^You 0 · \w+ 0$/.test(qdChip) && s0(asked >= 7), `Quick Draw: the marker panel with the score chip ("${qdChip}"), ${asked} facts`);
  check(qdOff, "music: 'off' while a panel is open");
  const qd = await J(page, () => ({ last: window.__wagonWest.lastQuickDraw, tokens: window.__wagonWest.save.journey.tokens, day: window.__wagonWest.save.journey.day, text: document.querySelector('#tc-text').textContent }));
  check(qdTitle === 'You won the Quick Draw!' && qd.last.won && qd.last.me === 7 && qd.tokens >= camp0.tokens + 1 && qd.day === camp0.day + 1, `Quick Draw to 7: "${qdTitle}" (${qd.last.me}–${qd.last.them}), a token, a day at camp (day ${camp0.day} → ${qd.day})`);
  await grab();
  await page.click('#tc-go');
  await page.waitForFunction(() => !window.__wagonWest.camp.busy, null, { timeout: 8000 });
  check((await musicNow(page)).mood === 'camp', 'music: back to the camp mood when the panel closes');

  // Campfire tales: a story card read aloud, then a riddle (a fact in disguise): a token
  const tk1 = await J(page, () => window.__wagonWest.save.journey.tokens);
  await page.click('[data-act="tales"]');
  await page.waitForFunction(() => window.__wagonWest.card.isOpen, null, { timeout: 8000 });
  const tale = await J(page, () => ({ kicker: document.querySelector('#tc-kicker').textContent, title: window.__wagonWest.card.title, spoken: window.__spoken.slice(-2) }));
  check(tale.kicker === 'Campfire tales' && tale.spoken.length > 0, `Campfire tales: "${tale.title}" read aloud`);
  await page.click('#tc-go');
  await page.waitForFunction(() => window.__wagonWest.markerPanel.state === 'ask', null, { timeout: 8000 });
  const rd = await J(page, () => ({ riddle: window.__wagonWest.markerPanel.riddle, q: document.querySelector('#mk-q').textContent, title: document.querySelector('#mk-title').textContent, ans: window.__wagonWest.markerPanel.answer }));
  check(rd.riddle && rd.q === rd.riddle && /\?$/.test(rd.q) && rd.title === 'Campfire riddle', `the riddle: "${rd.q}"`);
  await audit(page, layout.insets, 'Campfire riddle');
  await shot(page, layout, '22-riddle', 0);
  await typeDigits(page, '#panel-marker', rd.ans);
  await page.waitForFunction(() => !window.__wagonWest.camp.busy, null, { timeout: 8000 });
  check(await J(page, () => window.__wagonWest.save.journey.tokens) >= tk1 + 1, 'the riddle solved: a trade token');

  // Rest: a day, everyone happier; a companion's line at camp dropped their card
  const d1 = await J(page, () => window.__wagonWest.save.journey.day);
  await page.click('[data-act="rest"]');
  await page.waitForFunction(() => !window.__wagonWest.camp.busy, null, { timeout: 8000 });
  const rest = await J(page, () => { const Jn = window.__wagonWest.save.journey; const ids = Jn.companions; const have = Array.isArray(Jn.cards) ? Jn.cards : Object.keys(Jn.cards || {}); return { day: Jn.day, comp: ids.some((id) => have.includes(id)) }; });
  check(rest.day === d1 + 1 && rest.comp, `Rest: a day at camp (day ${rest.day}), and a companion's line at camp dropped their card`);

  // back to the trail: the journey picks up where it was
  // (read in the same task as the tap: the trail ticks on at once)
  const back1 = await J(page, async () => { document.querySelector('#camp-back').click(); for (let i = 0; i < 6; i++) await Promise.resolve(); const w = window.__wagonWest; return { miles: w.save.journey.milesDone, screen: w.screen, mood: (w.Music.current && w.Music.current.mood) || w.music.mood }; });
  check(back1.miles === mid && back1.screen === 'trail' && back1.mood === 'trail', `"Back to the trail": the wagon rolls on from mile ${mid} (${back1.miles}), the trail music again (${back1.mood})`);

  // the pause menu's Make camp → Camp → "Stop for today": the title, the journey waits
  await drive(page, (s) => s.screen === 'trail' && s.marker === 'closed' && s.problem === 'closed' && !s.card && !s.mini && s.travel && !s.travel.busy, {}, 15000);
  await page.keyboard.press('Escape');
  await page.waitForSelector(visibleSel('#panel-pause'));
  check((await musicNow(page)).mood === 'off', "music: 'off' under the pause sheet");
  await audit(page, layout.insets, 'pause');
  await shot(page, layout, '23-pause');
  const mid2 = (await W(page)).journey.milesDone;
  await page.click('#pause-camp');
  await page.waitForSelector(visibleSel('#screen-camp'));
  await page.click('#camp-stop');
  await page.waitForSelector(visibleSel('#screen-title'));
  check(await J(page, () => document.querySelector('#btn-trail-label').textContent) === 'Keep going' && (await W(page)).journey.milesDone === mid2, `pause → Make camp → "Stop for today": the title, the journey waits at mile ${mid2} ("Keep going")`);
}
const s0 = (x) => !!x;

// ---------- the natural voice (SPEC v1.1 §1): a family code, a natural voice picked, a fake cloud backend ----------
async function voiceTest(browser, layout) {
  console.log(`\n=== natural voice (${layout.name}) ===`);
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await routeFonts(ctx);
  await ctx.route('**/api/family/**', (r) => r.abort());
  let ttsNetwork = false;
  await ctx.route('**/api/tts/**', (r) => { ttsNetwork = true; return r.abort(); });
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|api\/family|ERR_FAILED|ERR_INTERNET/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await page.addInitScript(({ insets }) => {
    if (!sessionStorage.getItem('wwVoiceSeeded')) {
      localStorage.clear();
      const now = Date.now();
      localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, players: [{ id: 'pmia', name: 'Mia', color: '#3b7dd9', createdAt: now, updatedAt: now }], pinHash: null, pinUpdatedAt: 0,
        options: { pmia: { cloudVoice: 'en-US-Neural2-F' } }, optionsUpdatedAt: { pmia: now }, removedPlayers: [], migrated: true, lastPlayer: 'pmia' }));
      localStorage.setItem('spellJump.sync', JSON.stringify({ v: 1, code: 'ABCD-2345', deviceId: 'devW', keys: {} }));
      sessionStorage.setItem('wwVoiceSeeded', '1');
    }
    window.__wwScript = { daySec: 0.12, beat: 0.15 };
    window.__mockScript = { shotMs: 80 };
    window.__cloudAsked = []; window.__cloudPlayed = []; window.__spoken = [];
    window.__ttsBackend = {
      speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 30); },
      cancel() {}, addEventListener() {},
    };
    const hex = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(8, '0').repeat(4); };
    window.__cloudVoiceBackend = {
      async status() { return { key: true }; },
      async prepare({ code, voice, texts }) {
        window.__cloudAsked.push({ code, voice, texts });
        const clips = {};
        for (const t of texts) clips[t] = '/api/tts/clip/' + hex(voice + '\n' + t);
        return { status: 200, body: { clips, generated: texts.length, cached: 0, charsToday: 100 } };
      },
      async load(url, text) { return { url, text, duration: 0.02 }; },
      play(buf, text) { window.__cloudPlayed.push(text); return new Promise((r) => setTimeout(() => r(true), 15)); },
      stop() {},
    };
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(st);
    });
  }, { insets: layout.insets });
  await page.goto(URL0, { waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('[data-player="pmia"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  await page.waitForFunction(() => window.__cloudAsked.length >= 2, null, { timeout: 5000 }).catch(() => {});
  const C = await J(page, async () => {
    const L = await import('/wagon-west/src/content/lookouts.js');
    return { lookout: L.LOOKOUTS['kansas-river'].say, active: window.__wagonWest.cloud.active };
  });
  const askedAll = () => J(page, () => window.__cloudAsked.flatMap((a) => a.texts));
  const asked0 = await askedAll();
  check(C.active && asked0.includes(C.lookout) && (await J(page, () => window.__cloudAsked.every((a) => a.code === 'ABCD-2345' && a.voice === 'en-US-Neural2-F' && a.texts.length <= 80))),
    `player select prepares the natural voice: ${asked0.length} texts (≤ 80 a request), with the leg's lookout ("${C.lookout.slice(0, 40)}…")`);
  check(asked0.some((t) => /^Rope toss! The landing is /.test(t)) && asked0.some((t) => /^\w+ times \w+\.$/i.test(t)), 'the prepared set has the river\'s landing sentences and the facts\' questions');
  await J(page, () => { window.__wagonWest.app.outfitDone({ wagonName: 'Dusty', animal: 'oxen', companions: ['blacksmith', 'scout', 'cook'] }, { fresh: true }); });
  await page.waitForSelector(visibleSel('#screen-store'));
  await page.click('#store-done');
  // is `text` (or its sentences) played as clips, and never by the device voice?
  const byCloud = (text, wait = 3000) => page.waitForFunction((t) => window.__cloudPlayed.includes(t), text, { timeout: wait }).then(() => true, () => false);
  const deviceSaid = (text) => J(page, (t) => window.__spoken.includes(t), text);
  const engine = () => J(page, () => window.__wagonWest.tts.engine);
  const seen = { marker: null, problem: null, card: null, river: null, letter: null };
  const plan = {
    async onEach(s) {
      if (s.marker === 'ask' && s.mReal && !seen.marker) {
        const q = await J(page, async () => { const F = await import('/trail-blazer/src/facts/facts.js'); const w = window.__wagonWest; return F.questionSentence(w.markerPanel.fact, false); });
        const q2 = await J(page, async () => { const F = await import('/trail-blazer/src/facts/facts.js'); return F.questionSentence(window.__wagonWest.markerPanel.fact, true); });
        const ok = (await byCloud(q)) || (await byCloud(q2, 200));
        seen.marker = { ok: ok && !(await deviceSaid(q)) && !(await deviceSaid(q2)) && (await engine()) === 'cloud', q };
      }
      if (s.problem === 'ask' && !seen.problem) {
        const p = await J(page, () => { const pr = window.__wagonWest.problemPanel.problem; return { say: pr.say, text: pr.text }; });
        const ok = await byCloud(p.say);
        seen.problem = { ok: ok && !(await deviceSaid(p.say)) && (await engine()) === 'cloud' && (await askedAll()).includes(p.say), say: p.say };
      }
      if (s.card && /Kansas River/.test(s.cardTitle) && !seen.card) {
        const ok = await byCloud(C.lookout);
        seen.card = { ok: ok && !(await deviceSaid(C.lookout)) && (await engine()) === 'cloud' };
      }
      if (s.screen === 'river' && s.rvRope && !seen.river) {
        const t = await J(page, () => `Rope toss! The landing is ${window.__wagonWest.river.rope.f.say} of the way across.`);
        const ok = await byCloud(t);
        seen.river = { ok: ok && !(await deviceSaid(t)) && (await engine()) === 'cloud', t };
      }
      if (s.screen === 'post' && s.poFoot && !seen.letter) {
        const L = await J(page, () => ({ opening: window.__wagonWest.app.spoken(window.__wagonWest.postOffice.letter.opening) }));
        const ok = (await byCloud('Here is your letter.')) && (await byCloud(L.opening));
        await page.waitForTimeout(400);
        seen.letter = { ok: ok && !(await deviceSaid('Here is your letter.')) && !(await deviceSaid(L.opening)) && (await engine()) === 'cloud', opening: L.opening,
          why: ok ? `engine ${await engine()}, device: ${JSON.stringify(await J(page, () => window.__spoken.slice(-4)))}` : `cloud played: ${JSON.stringify(await J(page, () => window.__cloudPlayed.slice(-6)))}` };
      }
    },
  };
  await drive(page, (s) => s.screen === 'results', plan);
  await page.click('#res-next');
  await page.waitForSelector(visibleSel('#screen-trail'));
  await drive(page, (s) => s.screen === 'results', plan);
  check(seen.marker && seen.marker.ok, `a mile marker's question is said by the natural voice ("${seen.marker && seen.marker.q}", tts.engine 'cloud')`);
  check(seen.problem && seen.problem.ok, `a word problem: a prepare request carried its sentence, and the natural voice said it ("${seen.problem && seen.problem.say}")`);
  check(seen.card && seen.card.ok, 'the lookout card at the Kansas River is said by the natural voice');
  check(seen.river && seen.river.ok, `the river's landing sentence is said by the natural voice ("${seen.river && seen.river.t}")`);
  check(seen.letter && seen.letter.ok, `the letter (its opening "${seen.letter && seen.letter.opening}" and the read-back) is said by the natural voice${seen.letter && !seen.letter.ok ? ' — ' + seen.letter.why : ''}`);
  const words = await J(page, () => window.__cloudPlayed.filter((t) => /^The word is, /.test(t)).length);
  check(words >= 6, `the river and letter words are presented by clips too (${words} words)`);
  check(!ttsNetwork, 'no request reached /api/tts (the fake backend answered everything)');

  // Parents → Options: the voice line and "Say a test line"
  await page.click('#res-camp');
  await page.waitForSelector(visibleSel('#screen-title'));
  await page.click('#btn-parents');
  await page.waitForSelector(visibleSel('#pz'));
  for (let k = 0; k < 2; k++) { for (const d of '1234') await page.click(`.pinpad [data-digit="${d}"]`); await page.waitForTimeout(250); }
  await page.waitForSelector('.pz-tabs');
  await page.click('.pz-tabs [data-tab="options"]');
  const line = await J(page, () => document.querySelector('#opt-voice-line').textContent);
  check(/^Natural voice: Ava · \d+ clips ready$/.test(line), `Options: "${line}"`);
  await audit(page, layout.insets, 'Parent Zone (Options, natural voice)');
  const n0 = await J(page, () => window.__cloudPlayed.length);
  await page.click('#opt-voice-test');
  await page.waitForFunction(() => /spoke/.test(document.querySelector('#opt-voice-result').textContent), null, { timeout: 8000 }).catch(() => {});
  const res = await J(page, (n) => ({ text: document.querySelector('#opt-voice-result').textContent, engine: document.querySelector('#opt-voice-result').dataset.engine, played: window.__cloudPlayed.slice(n) }), n0);
  check(res.engine === 'cloud' && res.played.includes('Wagon West is ready to roll.') && /natural voice/.test(res.text), `Say a test line: "${res.text}"`);
  await shot(page, layout, 'v01-pz-voice');
  check(errors.length === 0, `natural voice: no console errors${errors.length ? ' — ' + errors.slice(0, 4).join(' | ') : ''}`);
  await ctx.close();
}

// the kid-facing source: every string in the UI modules (not the Parent Zone), the mock and index.html (minus the PZ)
function staticAudit() {
  console.log('\n=== kid-rule audit of the source ===');
  const files = ['index.html', ...readdirSync(path.join(gameRoot, 'src/ui')).filter((f) => f !== 'parentZone.js').map((f) => `src/ui/${f}`), 'src/meta/mockScene.js', 'src/main.js'];
  const hits = [];
  for (const f of files) {
    const src = readFileSync(path.join(gameRoot, f), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
    const strings = src.join('\n').match(/(['"`])(?:(?!\1)[^\\\n]|\\.)*\1|>[^<>{}\n]+</g) || [];
    for (const s of strings) { const m = s.match(BANNED); if (m && !/aria-hidden|data-|class=|console\.|\[[A-Za-z]+\]/i.test(s)) hits.push(`${f}: ${s.slice(0, 60)}`); }
  }
  check(hits.length === 0, `no banned kid-facing words in the UI source${hits.length ? ' — ' + hits.slice(0, 6).join(' | ') : ''}`);
  const html = readFileSync(path.join(gameRoot, 'index.html'), 'utf8');
  const ext = (html.match(/<a [^>]*href="(https?:)?\/\/[^"]+"/g) || []);
  check(ext.length === 0, 'index.html: no links to another site');
}

const srv = await ensureServer();
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
try {
  for (const layout of LAYOUTS.filter((l) => !process.env.ONLY || l.name === process.env.ONLY)) {
    if (!process.env.VOICE_ONLY) await runLayout(browser, layout);
    await voiceTest(browser, layout);
  }
  staticAudit();
} catch (e) {
  failures.push('crashed: ' + (e && e.stack || e));
  console.error(e);
} finally {
  await browser.close();
  if (srv) srv.kill();
}
console.log(`\nScreenshots: ${SHOTS}`);
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log(`\n${failures.length} FAILED:\n - ${failures.join('\n - ')}`); process.exit(1); }
console.log('\nui-smoke: all checks passed');

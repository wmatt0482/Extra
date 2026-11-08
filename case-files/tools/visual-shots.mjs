// Visual review shots of Case Files (not a test): the screens a kid sees most, at 390x844 (phone portrait), 844x390 (phone landscape)
// and 1440x900 (desktop), deviceScaleFactor 2. Run from the repo root against a served build:
//   bash build.sh && (cd dist && python3 -m http.server 8743 &)
//   BASE_URL=http://localhost:8743 SHOTS_DIR=/some/dir node case-files/tools/visual-shots.mjs
//   (LAYOUT=phone-portrait | phone-landscape | desktop runs one layout; ONLY=home,doc,... keeps just those shots)
// It runs on the real case content with a seeded player (Mia: Training and Erie cases 1-2 closed, case 3 is the next one, cases 4-5
// sealed) so the route map shows all its states. Shots: picker, home with the Erie route map, the Chief's coach card, the briefing with
// the characters, the desk (document folders), a document, the cork board, a popup from Pip, the archive (Mr. Wen), and the CASE CLOSED
// celebration (mid-animation and settled; the payout is a stand-in receipt, the real one comes from the Lab).
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CASE_BY_ID } from '../src/content/index.js';

const BASE = process.env.BASE_URL || 'http://localhost:8743';
const URL0 = BASE + '/case-files/index.html?nosw=1';
const OUT = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'cf-visual');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
mkdirSync(OUT, { recursive: true });

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}
const LAYOUTS = [
  { name: 'phone-portrait', width: 390, height: 844, mobile: true, insets: { t: 47, r: 0, b: 34, l: 0 } },
  { name: 'phone-landscape', width: 844, height: 390, mobile: true, insets: { t: 0, r: 47, b: 21, l: 47 } },
  { name: 'desktop', width: 1440, height: 900, mobile: false, insets: { t: 0, r: 0, b: 0, l: 0 } },
].filter((l) => !process.env.LAYOUT || l.name === process.env.LAYOUT);

const fontCache = new Map();
async function routeFonts(ctx) {
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    const url = route.request().url();
    try {
      if (!fontCache.has(url)) fontCache.set(url, execSync(`curl -sSL --max-time 15 -A "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36" "${url}"`));
      await route.fulfill({ status: 200, body: fontCache.get(url), contentType: url.includes('googleapis') ? 'text/css' : 'font/ttf', headers: { 'access-control-allow-origin': '*' } });
    } catch (_) { await route.fulfill({ status: 200, body: '', contentType: 'text/css' }); }
  });
}

const day = (back) => { const d = new Date(Date.now() - back * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

async function run(browser, layout) {
  console.log(`\n=== ${layout.name} ${layout.width}x${layout.height} ===`);
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: layout.mobile, hasTouch: layout.mobile });
  await routeFonts(ctx);
  await ctx.route('**/api/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|api\/|ERR_FAILED|ERR_INTERNET|net::ERR|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const seed = {
    pmia: {
      v: 1, rank: 4, readMode: 'auto', seenHelp: { home: true, brief: true, read: true, pin: true, order: true, close: true },
      opened: { training: day(4), 'erie-01': day(4), 'erie-02': day(2), 'erie-03': day(0) },
      closed: {
        training: { day: day(4), at: Date.now() - 4 * 864e5 },
        'erie-01': { day: day(3), at: Date.now() - 3 * 864e5, report: { who: 'Tom Fisk', because: 'the waybill was in his coat', clueId: 'd1s1' } },
        'erie-02': { day: day(1), at: Date.now() - 864e5 },
      },
      nextEarly: false, wordsMet: {}, updatedAt: Date.now(),
    },
  };
  await page.addInitScript(({ insets, seed }) => {
    if (!sessionStorage.getItem('cfSeeded')) {
      localStorage.clear();
      const now = Date.now();
      localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, players: [{ id: 'pmia', name: 'Mia', color: '#3b7dd9', createdAt: now, updatedAt: now }, { id: 'pleo', name: 'Leo', color: '#ff8a1f', createdAt: now, updatedAt: now }],
        pinHash: null, pinUpdatedAt: 0, options: {}, optionsUpdatedAt: {}, removedPlayers: [], migrated: true, lastPlayer: null }));
      localStorage.setItem('caseFiles.pmia.save', JSON.stringify(seed.pmia));
      localStorage.setItem('caseFiles.settings', JSON.stringify({ sound: true, reducedMotion: false }));
      sessionStorage.setItem('cfSeeded', '1');
    }
    window.__cloudVoiceBackend = { async status() { return { key: false }; }, async prepare() { return { status: 200, body: { clips: {} } }; }, async load() { return null; }, play() { return Promise.resolve(true); }, stop() {} };
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(st);
    });
  }, { insets: layout.insets, seed });

  const want = (name) => !ONLY.length || ONLY.includes(name);
  const shot = async (name, wait = 500) => { if (!want(name)) return; await page.waitForTimeout(wait); await page.screenshot({ path: path.join(OUT, `${layout.name}-${name}.png`) }); console.log('  shot', name); };
  const J = (fn, arg) => page.evaluate(fn, arg);
  const waitScreen = (n) => page.waitForSelector(`#screen-${n}:not([hidden])`, { timeout: 8000 });
  const waitBeat = (b) => page.waitForFunction((x) => { const g = window.__caseFiles; return g.screen === 'case' && g.run && g.run.beat === x; }, b, { timeout: 8000 });

  await page.goto(URL0, { waitUntil: 'networkidle' });
  await waitScreen('players');
  await shot('01-picker');
  await page.click('[data-player="pmia"]');
  await waitScreen('home');
  await page.waitForTimeout(400);
  await shot('02-home-route-map', 700);

  // the Chief's coach card on the home
  await page.click('#btn-help-home');
  await page.waitForSelector('.modal-wrap');
  await shot('03-coach-card', 500);
  await page.click('.modal-go');

  // the next case: briefing with the characters
  const k = CASE_BY_ID['erie-03'];
  await page.click('.case-card[data-case="erie-03"]');
  await waitBeat('brief');
  await shot('04-briefing', 700);
  for (const w of k.words || []) { const sel = `.wordcard[data-word="${w.word}"] .tok[data-right="1"]`; if (await page.$(sel)) await page.click(sel); }
  await page.click('#brief-go');
  await waitBeat('investigate');
  await shot('05-desk', 600);
  // a document
  await page.click(`.docfolder[data-doc="${k.docs[0].id}"]`);
  await page.waitForSelector(`.doc[data-doc="${k.docs[0].id}"]`);
  await shot('06-document', 500);
  await page.click('#doc-back');
  for (const d of k.docs.slice(1)) { await page.click(`.docfolder[data-doc="${d.id}"]`); await page.waitForSelector(`.doc[data-doc="${d.id}"]`); await page.click('#doc-back'); await page.waitForSelector('#open-notebook'); }
  await page.click('#open-notebook');
  await waitBeat('pin');
  // pin the answer to the first question (the board gets a clue), then a wrong tap for Pip's popup
  const docOf = (sid) => k.docs.find((d) => d.paragraphs.some((p) => p.some((s) => s.id === sid))).id;
  const pick = async (sid) => { const did = docOf(sid); if (!(await J((id) => !!document.querySelector(`.doc[data-doc="${id}"]`), did))) await page.click(`.doc-tab[data-doc="${did}"]`); await page.waitForSelector(`.doc[data-doc="${did}"]`); await page.click(`.doc.pick .s[data-id="${sid}"]`); };
  const q1 = k.questions[0];
  await pick(q1.answer[0]); await page.click('#nb-pin');
  await page.waitForSelector('#nb-why');
  await shot('07-pinned', 500);
  await page.click('#nb-next');
  // a wrong tap on question 2: the partner's popup
  const q2 = k.questions[1];
  const wrong = k.docs.flatMap((d) => d.paragraphs.flat()).find((s) => !q2.answer.includes(s.id) && !q1.answer.includes(s.id));
  await pick(wrong.id); await page.click('#nb-pin');
  await page.waitForSelector('.modal-wrap[data-kind="feedback"]');
  await shot('08-popup-pip', 700);
  await page.click('.modal-go');
  await pick(q2.answer[0]); await page.click('#nb-pin');
  await page.waitForSelector('#nb-why');
  await page.click('#case-board');
  await page.waitForSelector('.sheet .clue');
  await shot('09-cork-board', 800);
  await page.click('[data-act="close-sheet"]');

  // the Archive (Mr. Wen)
  await J(() => window.__caseFiles.app.go('archive'));
  await waitScreen('archive');
  await shot('10-archive', 700);

  // the celebration
  await J(() => { const g = window.__caseFiles; g.app.go('closed', { kase: g.app.caseById['erie-03'], receipt: { ok: true, coins: 40, xp: 55 } }); });
  await waitScreen('closed');
  await shot('11-closed-mid', 330);
  await shot('12-closed-final', 3800);

  console.log(errors.length ? `  console errors: ${errors.slice(0, 5).join(' | ')}` : '  no console errors');
  await ctx.close();
  return errors;
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
let bad = 0;
try { for (const l of LAYOUTS) bad += (await run(browser, l)).length; } finally { await browser.close(); }
console.log(`\nshots in ${OUT}`);
process.exit(bad ? 1 : 0);

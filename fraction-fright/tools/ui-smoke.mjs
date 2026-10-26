// Playwright smoke test of Fraction Fright on the mock engine (?mock=1&nosw=1), landscape 844×390 and portrait 390×844
// (iPhone safe-area insets faked), from the repo root:
//   node fraction-fright/tools/ui-smoke.mjs        (ONLY=landscape | portrait | real runs one part)
// Covers: the picker and a new player (on-screen keyboard), the title (the Lab first), the Zombie Lab (a real drag on
// the road, a cut that does not land on 1 and gets help, the three throws recorded, +100 XP, Streets open), the
// Streets screen (★, the locked street, coming soon), wave 1 with a bull, a hit, a near (the nudge arrow), a miss (the
// flag and the jumps drawn, then the ticks hint), the called fraction read aloud, results whose rows add up, a wave
// where a zombie reaches the fence (no penalty), the big wave (3 at once), the final wave (×2, a pumpkin, the street
// cleared, Oak Lane open), the yard purchase, the Parent Zone (PIN, Family code with the week strip, Fractions,
// Options, Report with the weekly %, Players), the pings, reload persistence, a kid-rule text audit (no kill / die /
// dead / lives / timers / countdowns / wrong outside the Parent Zone), the layout audit and no console errors.
// Then ONE playtest on the real engine (src/game/engine.js): a wave loads, three throws land, no console errors.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const gameRoot = path.join(repoRoot, 'fraction-fright');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const URL0 = BASE + '/fraction-fright/index.html?mock=1&nosw=1';
const URL_REAL = BASE + '/fraction-fright/index.html?nosw=1';
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'fraction-fright-ui-shots');
mkdirSync(SHOTS, { recursive: true });

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}
async function ensureServer() {
  const up = async () => { try { return (await fetch(BASE + '/fraction-fright/index.html')).ok; } catch (_) { return false; } };
  if (await up()) return null;
  const port = new URL(BASE).port || '8080';
  const srv = spawn('python3', ['-m', 'http.server', port], { cwd: repoRoot, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100));
  return srv;
}

const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const LAYOUTS = [
  { name: 'landscape', width: 844, height: 390, insets: { t: 0, r: 47, b: 21, l: 47 } },
  { name: 'portrait', width: 390, height: 844, insets: { t: 47, r: 0, b: 34, l: 0 } },
];
// kid-facing words that must never show (SPEC §0); the Parent Zone is for grown-ups and is left out
const BANNED = /\b(kill(s|ed|ing)?|die[sd]?|dying|dead|death|lives|life left|wrong|timer|countdown|hurry|time'?s up|seconds? left|game over|lose|lost|fail(ed)?)\b/i;

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
async function shot(page, layout, name, wait = 250) {
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
      if (el.closest('#backdrop, #toasts, #stage, #banner') || (el.closest('svg') && el.tagName !== 'svg')) continue;
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

const F = (page) => J(page, () => { const g = window.__fractionFright; const s = g.game && g.game.getState(); return { screen: g.screen, phase: s && s.phase, target: s && s.target, hint: s && s.hint, zombies: s ? s.zombies.length : 0, run: !!g.run, throws: g.run ? g.run.throws.length : 0 }; });
const waitPhase = (page, phase = 'wave', timeout = 8000) => page.waitForFunction((p) => { const g = window.__fractionFright; const s = g.game && g.game.getState(); return g.screen !== 'wave' || (s && s.phase === p && s.target); }, phase, { timeout });
async function throwAt(page, x) { await waitPhase(page); return J(page, (v) => window.__fractionFright.throwAt(Math.max(0, Math.min(1, v))), x); }
/** cure every zombie left with a dead-on throw, until the results show */
async function playOut(page, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const s = await F(page);
    if (s.screen === 'results') return true;
    if (s.screen === 'wave' && s.phase === 'wave' && s.target) await J(page, (v) => window.__fractionFright.throwAt(v), s.target.target);
    await page.waitForTimeout(60);
  }
  return false;
}
async function payCheck(page, label) {
  const p = await J(page, () => ({ rows: [...document.querySelectorAll('#res-pay tr:not(.total)')].map((r) => ({ id: r.dataset.row, amount: Number(r.dataset.amount) })),
    total: Number(document.querySelector('#res-pay tr.total').dataset.amount), last: window.__fractionFright.lastResult }));
  const sum = p.rows.reduce((a, r) => a + r.amount, 0);
  check(sum === p.total && p.total === p.last.cash.total, `${label}: the cash rows add up (${p.rows.map((r) => `${r.id} ${r.amount}`).join(' + ')} = ${p.total})`);
  return p;
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
    if (!sessionStorage.getItem('ffSmokeSeeded')) { localStorage.clear(); sessionStorage.setItem('ffSmokeSeeded', '1'); }
    window.__mockScript = { walkSec: 30, beatSec: 0.25, flightSec: 0.08, calmSec: 0.3 };
    window.__spoken = [];
    window.__ttsBackend = {
      speaking: false, pending: false,
      getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); },
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

  // ---------- picker + new player ----------
  await page.waitForSelector(visibleSel('#screen-players'));
  await shot(page, layout, '01-players');
  await audit(page, layout.insets, 'player picker');
  const pick = await J(page, () => ({ tiles: document.querySelectorAll('[data-player]').length, add: !!document.querySelector('#pl-add'), origin: location.origin,
    home: document.querySelector('#btn-home').href, sj: document.querySelector('#btn-spelljump').href, tb: document.querySelector('#btn-trailblazer').href }));
  check(pick.tiles === 0 && pick.add, 'picker is the first screen, with "+ New player"');
  check(pick.home === pick.origin + '/' && pick.sj === pick.origin + '/spell-jump/' && pick.tb === pick.origin + '/trail-blazer/', 'Learning Lab, Spell Jump and Trail Blazer links, same origin');
  await page.click('#pl-add');
  await page.waitForSelector(visibleSel('#screen-newplayer'));
  check(await J(page, () => !document.querySelector('#screen-newplayer input, #screen-newplayer textarea')), 'new player: no native text input');
  for (const k of 'mia') await page.click(`#np-keyboard .kb-key[data-key="${k}"]`);
  await shot(page, layout, '02-newplayer');
  await audit(page, layout.insets, 'new player');
  await page.click('#np-keyboard .kb-enter');
  await page.waitForSelector(visibleSel('#screen-title'));
  const pid = await J(page, () => window.__fractionFright.app.currentPlayerId);
  const fam = await J(page, () => JSON.parse(localStorage.getItem('spellJump.family')));
  check(fam.players.length === 1 && fam.players[0].name === 'Mia', 'the player Mia is in the family record shared with the other games');

  // ---------- title: the Lab comes first ----------
  const t1 = await J(page, () => ({ btn: document.querySelector('#btn-streets').textContent.trim(), note: !document.querySelector('#title-lab-note').hidden,
    cures: document.querySelector('#title-cures-n').textContent, neighbours: document.querySelector('#yard-scene').dataset.neighbours }));
  check(/zombie lab/i.test(t1.btn) && t1.note, `before the Lab the big button is "${t1.btn}" with "Start in the Zombie Lab"`);
  check(t1.cures === '0' && t1.neighbours === '0', 'the Cure Counter starts at 0, no neighbours on the street yet');
  await shot(page, layout, '03-title');
  await audit(page, layout.insets, 'title');
  texts.push(await kidText(page));
  await page.click('#btn-streets');
  await page.waitForSelector(visibleSel('#screen-lab'));

  // ---------- the Zombie Lab ----------
  const lab = (fn) => J(page, fn);
  check(await lab(() => window.__fractionFright.lab.step) === 'intro', 'Streets before the Lab opens the Zombie Lab');
  const say0 = await J(page, () => document.querySelector('#lab-say').textContent);
  check(say0.split(/\s+/).length <= 8, `Lab: at most 8 words on screen ("${say0}")`);
  check(await J(page, () => [...document.querySelectorAll('#lab-road .lab-label')].map((t) => t.textContent).join(' ')) === '0 ½ 1', 'Lab: the road shows 0, ½ and 1');
  await shot(page, layout, '04-lab');
  await audit(page, layout.insets, 'Zombie Lab');
  texts.push(await kidText(page));
  await page.click('#lab-next');
  check(await lab(() => window.__fractionFright.lab.step) === 'cut4', 'Lab: "Drag to cut the road into 4 jumps"');
  // a real drag on the road: from 0 to about 0.5 (2 jumps), let go: not 4 equal jumps
  const pt = (x01) => J(page, (x) => { const svg = document.querySelector('#lab-road'); const p = svg.createSVGPoint(); p.x = 90 + x * 820; p.y = 170; const q = p.matrixTransform(svg.getScreenCTM()); return { x: q.x, y: q.y }; }, x01);
  const a = await pt(0.05), b = await pt(0.5);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(150);
  check(await lab(() => window.__fractionFright.lab.step) === 'cut4' && /land right on 1/i.test(await J(page, () => document.querySelector('#lab-say').textContent)), 'Lab: a drag that makes 2 jumps gets help ("4 equal jumps land right on 1")');
  await lab(() => window.__fractionFright.lab.act(0.5));
  check(await J(page, () => !!document.querySelector('#lab-road .lab-ghost')), 'Lab: after two tries a ghost arrow shows the first jump');
  const c = await pt(0.25);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(c.x, c.y, { steps: 4 }); await page.mouse.up();
  await page.waitForTimeout(300);
  check(await J(page, () => document.querySelectorAll('#lab-road .lab-jumps path').length) === 4, 'Lab: dragged to ¼, four equal jumps land on 1');
  await page.waitForFunction(() => window.__fractionFright.lab.step === 'tap34', null, { timeout: 6000 });
  check(await J(page, () => [...document.querySelectorAll('#lab-road .lab-name')].length === 0), 'Lab: the throw shows ticks only (the kid counts the jumps; no ¾ label)');
  await lab(() => window.__fractionFright.lab.act(0.55));
  await page.waitForFunction(() => document.querySelector('#lab-road .lab-flag'), null, { timeout: 3000 });
  const miss = await J(page, () => ({ say: document.querySelector('#lab-say').textContent, flag: document.querySelector('#lab-road .lab-flag text').textContent, jumps: document.querySelectorAll('#lab-road .lab-jumps[data-count="3"] path').length }));
  check(/% close/.test(miss.say) && !/wrong/i.test(miss.say) && miss.flag === '3/4' && miss.jumps === 3, `Lab: off the spot → "${miss.say}", the flag at 3/4 and ¾ drawn as 3 jumps`);
  await shot(page, layout, '05-lab-feedback', 100);
  await page.waitForFunction(() => window.__fractionFright.lab.step === 'tap34' && !window.__fractionFright.lab.busy, null, { timeout: 5000 });
  await lab(() => window.__fractionFright.lab.act(0.75));
  await page.waitForFunction(() => window.__fractionFright.lab.step === 'cut3', null, { timeout: 5000 });
  await lab(() => window.__fractionFright.lab.act(1 / 3));
  await page.waitForFunction(() => window.__fractionFright.lab.step === 'tap23', null, { timeout: 6000 });
  await lab(() => window.__fractionFright.lab.act(0.68));
  await page.waitForFunction(() => window.__fractionFright.lab.step === 'half', null, { timeout: 5000 });
  check(await J(page, () => [...document.querySelectorAll('#lab-road .lab-same')].map((t) => t.textContent).join(' ')) === '2/4 3/6 4/8', 'Lab: 2/4, 3/6 and 4/8 line up on ½');
  await page.click('#lab-next');
  await lab(() => window.__fractionFright.lab.act(0.5));
  await page.waitForFunction(() => window.__fractionFright.lab.step === 'done', null, { timeout: 5000 });
  const sk = await J(page, () => { const s = window.__fractionFright.skills; return { xp: s.xp, done: !!s.lab.done, throws: Object.values(s.days).reduce((a, d) => a + d.throws, 0), fr: Object.keys(s.fracs).sort().join(' ') }; });
  check(sk.done && sk.xp >= 100 && sk.throws === 4 && sk.fr === '2/3 3/4 4/8', `Lab done: +100 XP (${sk.xp}), its throws recorded (${sk.throws}: ${sk.fr})`);
  check(/\+100 XP · Streets open/.test(await J(page, () => document.querySelector('#lab-say').textContent)), 'Lab ends with "+100 XP · Streets open"');
  await shot(page, layout, '06-lab-done');
  await page.click('#lab-streets');

  // ---------- streets ----------
  await page.waitForSelector(visibleSel('#screen-streets'));
  const st1 = await J(page, () => ({ maple: document.querySelector('[data-street="maple"]').dataset.open, oak: document.querySelector('[data-street="oak"]').dataset.open,
    star: document.querySelector('.street-card.rec') && document.querySelector('.street-card.rec').dataset.street, soon: !!document.querySelector('#streets-soon') }));
  check(st1.maple === 'true' && st1.oak === 'false' && st1.star === 'maple' && st1.soon, 'Streets: Maple Street open with the ★, Oak Lane locked, more coming soon');
  await shot(page, layout, '07-streets');
  await audit(page, layout.insets, 'Streets');
  texts.push(await kidText(page));
  await page.click('[data-street="oak"]');
  check(await J(page, () => window.__fractionFright.screen) === 'streets', 'a locked street does not start');

  // ---------- wave 1: a bull, a hit, a near, a miss ----------
  await page.click('[data-street="maple"]');
  await page.waitForSelector(visibleSel('#coach'));
  check(true, 'the first wave opens with the coach card');
  texts.push(await kidText(page));
  await page.locator('#coach').dispatchEvent('pointerdown');
  await waitPhase(page);
  let s = await F(page);
  const card = await J(page, () => ({ show: document.querySelector('#btn-say').dataset.show, say: document.querySelector('#fc-say').textContent }));
  check(card.show === s.target.show && card.say === s.target.say, `the called fraction shows big: ${card.show} "${card.say}"`);
  const spoke = await page.waitForFunction((say) => window.__spoken.includes(`${say}.`), s.target.say, { timeout: 3000 }).then(() => true, () => false);
  check(spoke, `the fraction is read aloud ("${s.target.say}."; heard: ${JSON.stringify(await J(page, () => window.__spoken.slice(-3)))})`);
  check(await J(page, () => !document.querySelector('#hud').textContent.match(/\d+\s*(s|sec)\b|time|left/i)) && await J(page, () => !document.querySelector('#hud progress, #hud .bar, #hud [role="progressbar"]')), 'the HUD has no timer, no counter, no progress bar');
  await audit(page, layout.insets, 'wave HUD');
  texts.push(await kidText(page));
  const rp = await J(page, () => window.__fractionFright.game.getState().roadPx);
  // a bull: a real drag on the road to the exact spot, let go
  const cv = await J(page, () => { const r = document.querySelector('#game').getBoundingClientRect(); return { left: r.left, top: r.top }; });
  const X = (x01) => cv.left + rp.left + x01 * (rp.right - rp.left);
  await page.mouse.move(X(0.1), cv.top + rp.y); await page.mouse.down(); await page.mouse.move(X(s.target.target), cv.top + rp.y, { steps: 6 });
  await shot(page, layout, '08-wave-aim', 50);
  await page.mouse.up();
  await page.waitForFunction(() => window.__fractionFright.run && window.__fractionFright.run.throws.length === 1, null, { timeout: 3000 });
  await shot(page, layout, '09-wave-thunk', 30);
  let last = await J(page, () => window.__fractionFright.run.throws.at(-1));
  check(last.result === 'bull', `a drag to ${s.target.show} and let go: a bull (${last.pae} % off)`);
  await waitPhase(page); s = await F(page); await throwAt(page, s.target.target + 0.05);
  await page.waitForFunction(() => window.__fractionFright.run.throws.length === 2, null, { timeout: 3000 });
  last = await J(page, () => window.__fractionFright.run.throws.at(-1));
  check(last.result === 'hit', `5 % of the road off: a hit (zone ±10 %)`);
  await waitPhase(page); s = await F(page);
  const nearItem = s.target;
  await throwAt(page, s.target.target + (s.target.target > 0.5 ? -0.15 : 0.15));
  await waitPhase(page);
  s = await F(page);
  check(s.target.id === nearItem.id && s.hint === 'arrow', `15 % off: a near, the same zombie stays called and the next aim shows the nudge arrow (hint ${s.hint})`);
  await throwAt(page, nearItem.target > 0.5 ? 0.05 : 0.95);
  await page.waitForFunction(() => window.__fractionFright.run.throws.length === 4, null, { timeout: 3000 });
  const beat = await F(page);
  last = await J(page, () => window.__fractionFright.run.throws.at(-1));
  check(last.result === 'miss' && beat.phase === 'beat', 'far off: a miss, then the feedback beat (the flag at the true spot and the jumps drawn)');
  await shot(page, layout, '10-wave-feedback', 0);
  await waitPhase(page);
  check((await F(page)).hint === 'ticks', 'after a second throw off the spot the ticks hint is next');
  const sk1 = await J(page, () => { const s = window.__fractionFright.skills; return Object.values(s.records).reduce((a, l) => a + l.length, 0); });
  check(sk1 >= 7, `every throw is recorded in the skills (${sk1} incl. the Lab)`);
  check(await playOut(page), 'wave 1 played out');
  await page.waitForSelector(visibleSel('#screen-results'));
  const r1 = await J(page, () => ({ title: document.querySelector('#res-title').textContent, cured: document.querySelector('#res-cured').dataset.n, acc: document.querySelector('#res-accuracy').dataset.pct, last: window.__fractionFright.lastResult }));
  check(r1.title === 'Wave 1: fence held.' && r1.cured === '8' && Number(r1.acc) > 50, `results: "${r1.title}", ${r1.cured} neighbours cured, accuracy ${r1.acc} %`);
  const p1 = await payCheck(page, 'wave 1');
  check(p1.rows.find((r) => r.id === 'effort').amount === 40, 'a near then a cure on the same zombie pays the close-then-cured bonus ($40)');
  check(await J(page, () => document.querySelector('#res-counter').textContent.includes('Neighbours cured: 8')), 'the Cure Counter shows the total');
  await shot(page, layout, '11-results');
  await audit(page, layout.insets, 'results');
  texts.push(await kidText(page));
  const save1 = await J(page, () => window.__fractionFright.save);
  check(save1.cash === p1.total && save1.cures === 8 && save1.streets.maple.wave === 2, `banked: $${save1.cash}, 8 cures, next wave 2`);

  // ---------- wave 2: a zombie reaches the fence (no penalty) ----------
  await J(page, () => { window.__mockScript.walkSec = 1.2; });
  await page.click('#res-next');
  await waitPhase(page);
  await page.waitForFunction(() => window.__fractionFright.run && window.__fractionFright.run.reached >= 1, null, { timeout: 5000 });
  check(true, 'a zombie reached the fence (it takes a pumpkin and shuffles off)');
  await J(page, () => { window.__mockScript.walkSec = 30; });
  // the rest walk at 1.2 s: cure them as they come
  check(await playOut(page), 'wave 2 played out');
  const r2 = await J(page, () => window.__fractionFright.lastResult);
  check(r2.items.some((x) => x.outcome === 'reached') && r2.cash.total >= 0 && r2.bank.nextWave === 3, `wave 2: ${r2.items.filter((x) => x.outcome === 'reached').length} reached the fence, cash still banked ($${r2.cash.total}), next wave 3`);
  await payCheck(page, 'wave 2');

  // ---------- wave 3: the big wave ----------
  await page.click('#res-next');
  await waitPhase(page);
  const big = await J(page, () => ({ big: window.__fractionFright.run.big, z: window.__fractionFright.game.getState().zombies.length, wave: document.querySelector('#hud-wave').textContent }));
  check(big.big && big.z === 3 && /big wave/i.test(big.wave), `wave 3 is the big wave: 3 zombies on the road at once ("${big.wave}")`);
  await shot(page, layout, '12-big-wave', 0);
  check(await playOut(page), 'wave 3 played out');
  await payCheck(page, 'wave 3');
  await page.click('#res-next');
  await waitPhase(page);
  check(await playOut(page), 'wave 4 played out');

  // ---------- wave 5: the final wave, ×2, a pumpkin, the street cleared ----------
  await page.click('#res-next');
  await waitPhase(page);
  check(await J(page, () => window.__fractionFright.run.final && /final wave/i.test(document.querySelector('#hud-wave').textContent)), 'wave 5 is the final wave');
  check(await playOut(page), 'wave 5 played out (the calm beat, then the results)');
  const r5 = await J(page, () => ({ title: document.querySelector('#res-title').textContent, pumpkin: !!document.querySelector('#res-pumpkin'), last: window.__fractionFright.lastResult, save: window.__fractionFright.save }));
  const p5 = await payCheck(page, 'final wave');
  const fin = p5.rows.find((r) => r.id === 'final');
  check(fin && fin.amount === p5.rows.filter((r) => r.id !== 'final').reduce((x, r) => x + r.amount, 0), `the final wave pays ×2 (a final row of $${fin && fin.amount})`);
  check(r5.title === 'Maple Street: cleared.' && r5.pumpkin && r5.save.pumpkins === 1 && r5.save.streets.maple.cleared === 1 && r5.save.streets.maple.wave === 1, `"${r5.title}", a pumpkin planted, the street starts over at wave 1`);
  check(r5.save.cures >= 40 && r5.last.bank.neighboursAfter >= 4, `the Cure Counter: ${r5.save.cures} cured → ${r5.last.bank.neighboursAfter} neighbours on the title's street`);
  await shot(page, layout, '13-results-final');
  texts.push(await kidText(page));

  // ---------- the yard ----------
  await page.click('#res-yard');
  await page.waitForSelector(visibleSel('#screen-yard'));
  const cash0 = await J(page, () => window.__fractionFright.save.cash);
  await page.click('[data-buy="goo:grape"]');
  const y1 = await J(page, () => ({ cash: window.__fractionFright.save.cash, goo: window.__fractionFright.save.yard.goo, owned: window.__fractionFright.save.yard.owned.goo }));
  check(y1.goo === 'grape' && y1.owned.includes('grape') && y1.cash === cash0 - 1200, `the yard: Grape goo bought ($${cash0} → $${y1.cash}) and worn`);
  await shot(page, layout, '14-yard');
  await audit(page, layout.insets, 'yard');
  texts.push(await kidText(page));
  await page.click('#screen-yard [data-back="title"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  const t2 = await J(page, () => ({ btn: document.querySelector('#btn-streets').textContent.trim(), cures: document.querySelector('#title-cures-n').textContent, nb: Number(document.querySelector('#yard-scene').dataset.neighbours), pk: document.querySelectorAll('#yard-scene .pk').length }));
  check(/defend the fence/i.test(t2.btn) && t2.nb >= 4 && t2.pk === 1, `the title: "${t2.btn}", ${t2.cures} cured, ${t2.nb} neighbours drawn on the street, 1 pumpkin in the yard`);
  await shot(page, layout, '15-title-town');
  await page.click('#btn-streets');
  check(await J(page, () => document.querySelector('[data-street="oak"]').dataset.open) === 'true', 'Oak Lane is open now (Maple Street is working)');
  await page.click('#screen-streets [data-back="title"]');

  // ---------- pings (quiet on localhost: window.__pings records them) ----------
  const pings = await J(page, () => window.__pings || []);
  check(pings.filter((p) => p.kind === 'day').length === 1 && pings.filter((p) => p.kind === 'lab').length === 1 && pings.filter((p) => p.kind === 'wave').length === 5
    && pings.every((p) => p.game === 'fraction-fright' && p.fam === '' && Object.keys(p).join() === 'game,v,kind,fam'), `pings: one day, one lab, a wave ping per wave, nothing else in them (${pings.map((p) => p.kind).join(', ')})`);

  // ---------- Parent Zone ----------
  await page.click('#btn-parents');
  await page.waitForSelector(visibleSel('#pz'));
  check(await J(page, () => document.querySelector('#pin-title').textContent) === 'Choose a 4-digit PIN', 'Parents: first use sets the PIN');
  for (const d of '1234') await page.click(`.pinpad [data-digit="${d}"]`);
  await page.waitForTimeout(250);
  for (const d of '1234') await page.click(`.pinpad [data-digit="${d}"]`);
  await page.waitForSelector('.pz-tabs');
  const tabs = await J(page, () => [...document.querySelectorAll('.pz-tabs .seg-btn')].map((b) => b.dataset.tab).join(','));
  check(tabs === 'sync,fracs,options,report,players', `Parent Zone tabs: ${tabs}`);
  const strip = await J(page, () => { const r = document.querySelector('#pz-week-list .pz-week-row'); return r && { text: r.querySelector('.pw-strip').textContent, pct: r.dataset.pct }; });
  check(strip && /^Fractions this week · \d+ % of the ladder · \d+ % accurate$/.test(strip.text), `Family code: a strip per child ("${strip && strip.text}")`);
  await audit(page, layout.insets, 'Parent Zone (Family code)');
  await page.click('.pz-tabs [data-tab="fracs"]');
  const fz = await J(page, () => ({ where: document.querySelector('#fracs-where-line').textContent, chips: [...document.querySelectorAll('#fracs-ladder .lad')].map((c) => `${c.dataset.tier}:${c.dataset.state}`).join(' '), rows: document.querySelectorAll('#fracs-table tbody tr').length }));
  check(/★ recommended/.test(fz.where) && /T1:(working|secure)/.test(fz.chips) && /T3:later/.test(fz.chips) && fz.rows === 2, `Fractions: "Where Mia is" (${fz.where}); ladder ${fz.chips}`);
  await J(page, () => document.querySelector('#toasts').replaceChildren());
  await shot(page, layout, '16-pz-fractions');
  await audit(page, layout.insets, 'Parent Zone (Fractions)');
  await page.click('.pz-tabs [data-tab="options"]');
  check(await J(page, () => !!document.querySelector('#opt-aloud') && /Fraction Fright 1\.0\.0 · mock engine/.test(document.querySelector('.ver').textContent)), 'Options: fractions aloud, the version and engine');
  await page.click('.pz-tabs [data-tab="report"]');
  const rep = await J(page, () => ({ big: document.querySelector('#report-week .pw-big').textContent, small: document.querySelector('#report-week .pw-small').textContent, pct: document.querySelector('#report-week').dataset.pct,
    bar: document.querySelector('#report-week .pw-bar i').style.width, streets: document.querySelectorAll('#report-streets li').length }));
  check(/^Fractions: \d+ % of the ladder$/.test(rep.big) && rep.bar === `${rep.pct}%` && /^This week: \d+ % accurate \(\d+ of \d+ throws on target\)/.test(rep.small) && rep.streets === 2, `Report: "${rep.big}" + bar + "${rep.small}"`);
  await shot(page, layout, '17-pz-report');
  await page.click('#report-copy');
  await page.waitForTimeout(200);
  check(await J(page, () => /Ladder: \d+ %/.test(document.querySelector('#report-text').textContent) && /This week: \d+ % accurate/.test(document.querySelector('#report-text').textContent)), 'Copy report includes the week lines');
  await page.click('.pz-tabs [data-tab="players"]');
  check(await J(page, (id) => !!document.querySelector(`.pz-player[data-player="${id}"] input[type="text"]`), pid), 'Players: rename (the only native inputs are in here)');
  await audit(page, layout.insets, 'Parent Zone (Players)');
  await page.click('#pz-close');

  // ---------- reload persistence ----------
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  const tile = await J(page, (id) => { const t = document.querySelector(`[data-player="${id}"] .pl-level`); return t && t.dataset.cures; }, pid);
  await page.click(`[data-player="${pid}"]`);
  await page.waitForSelector(visibleSel('#screen-title'));
  const back = await J(page, () => ({ save: window.__fractionFright.save, sk: window.__fractionFright.skills }));
  check(tile === String(r5.save.cures) && back.save.cures === r5.save.cures && back.save.yard.goo === 'grape' && back.save.pumpkins === 1 && back.sk.lab.done > 0 && back.sk.opened.T2 > 0,
    `after a reload: ${back.save.cures} cured, Grape goo, 1 pumpkin, the Lab done, Oak Lane open`);
  check(await J(page, () => Object.keys(localStorage).filter((k) => k.startsWith('fractionFright.')).sort().join(' ')).then((k) => /fractionFright\.[^ ]+\.save/.test(k) && /\.skills/.test(k)), 'Fraction Fright writes its own keys (fractionFright.<id>.save / .skills)');

  // ---------- kid rules ----------
  const bad = texts.map((t) => (t.match(BANNED) || [])[0]).filter(Boolean);
  check(bad.length === 0, `kid-rule text audit on every kid screen: no kill / die / dead / lives / timers / countdowns / wrong${bad.length ? ' — found: ' + bad.join(', ') : ''}`);
  check(errors.length === 0, `no console errors${errors.length ? ' — ' + errors.slice(0, 4).join(' | ') : ''}`);
  await ctx.close();
}

// the kid-facing source: every string in the UI modules (not the Parent Zone), the mock and index.html (minus the PZ)
function staticAudit() {
  console.log('\n=== kid-rule audit of the source ===');
  const files = ['index.html', ...readdirSync(path.join(gameRoot, 'src/ui')).filter((f) => f !== 'parentZone.js').map((f) => `src/ui/${f}`), 'src/meta/mockEngine.js', 'src/skills/items.js'];
  const hits = [];
  for (const f of files) {
    const src = readFileSync(path.join(gameRoot, f), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
    const strings = src.join('\n').match(/(['"`])(?:(?!\1)[^\\\n]|\\.)*\1|>[^<>{}\n]+</g) || [];
    for (const s of strings) { const m = s.match(BANNED); if (m && !/aria-hidden|data-|class=|\bcountdown\b.*css/i.test(s)) hits.push(`${f}: ${s.slice(0, 60)}`); }
  }
  check(hits.length === 0, `no banned kid-facing words in the UI source${hits.length ? ' — ' + hits.slice(0, 6).join(' | ') : ''}`);
}

// one playtest on the real engine: a wave loads, three throws land, no console errors
async function realEngine(browser) {
  console.log('\n=== real engine (src/game/engine.js) ===');
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await routeFonts(ctx);
  const errors = [];
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(() => { localStorage.clear(); });
  await page.goto(URL_REAL, { waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  check(await J(page, () => window.__fractionFright.app.engineName) === '', 'the real engine loaded (no mock fallback)');
  await page.click('#pl-add');
  for (const k of 'leo') await page.click(`#np-keyboard .kb-key[data-key="${k}"]`);
  await page.click('#np-keyboard .kb-enter');
  await page.waitForSelector(visibleSel('#screen-title'));
  await J(page, () => { window.__fractionFright.app.finishLab(); window.__fractionFright.app.save.seen.coach = true; window.__fractionFright.app.go('streets'); });
  await page.click('[data-street="maple"]');
  await page.waitForFunction(() => { const s = window.__fractionFright.game.getState(); return s && s.phase === 'wave' && s.target; }, null, { timeout: 8000 });
  await shot(page, { name: 'real' }, '01-wave', 300);
  for (let i = 0; i < 3; i++) {
    await page.waitForFunction(() => { const s = window.__fractionFright.game.getState(); return s && s.phase === 'wave' && s.target; }, null, { timeout: 15000 });
    const t = await J(page, () => window.__fractionFright.game.getState().target.target);
    await J(page, (v) => window.__fractionFright.throwAt(v), i === 1 ? Math.min(1, t + 0.3) : t);
    if (i === 0) await shot(page, { name: 'real' }, '02-mid-throw', 180);
    await page.waitForFunction((n) => window.__fractionFright.run && window.__fractionFright.run.throws.length >= n, i + 1, { timeout: 8000 });
    if (i === 1) await shot(page, { name: 'real' }, '03-feedback', 350);
  }
  const res = await J(page, () => window.__fractionFright.run.throws.map((t) => t.result));
  check(res.length === 3 && res[0] !== 'miss' && res[2] !== 'miss', `three throws landed on the real engine (${res.join(', ')}), recorded by the app`);
  check(errors.length === 0, `real engine: no console errors${errors.length ? ' — ' + errors.slice(0, 4).join(' | ') : ''}`);
  await ctx.close();
}

const srv = await ensureServer();
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
try {
  for (const layout of LAYOUTS.filter((l) => !process.env.ONLY || l.name === process.env.ONLY)) await runLayout(browser, layout);
  if (!process.env.ONLY || process.env.ONLY === 'real') { staticAudit(); await realEngine(browser); }
} catch (e) {
  failures.push('crashed: ' + (e && e.stack || e));
  console.error(e);
} finally {
  await browser.close();
  if (srv) srv.kill();
}
console.log(`\nScreenshots: ${SHOTS}`);
if (failures.length) { console.log(`\n${failures.length} FAILED:\n - ${failures.join('\n - ')}`); process.exit(1); }
console.log('\nui-smoke: all checks passed');

// Playwright smoke test of Fraction Fright on the mock engine (?mock=1&nosw=1), landscape 844×390 and portrait 390×844
// (iPhone safe-area insets faked), from the repo root:
//   node fraction-fright/tools/ui-smoke.mjs        (ONLY=landscape | portrait | real runs one part)
// Covers: the picker and a new player (on-screen keyboard), the title (the Lab first), the Zombie Lab (a real drag on
// the road, a cut that does not land on 1 and gets help, the three throws recorded, +100 XP, Streets open), the
// Streets screen (★, the locked street, coming soon), wave 1 with a bull, a hit, the card stack (a second zombie's
// small card; tapping it calls that zombie), the combo chip (from ×2; gone after a miss), a near (the nudge arrow), a
// miss (the flag and the jumps drawn, then the ticks hint), the called fraction read aloud, results whose rows add up
// (the new rows: sharpshooter, combo, twins, boss), a wave where a zombie reaches the fence (no penalty) and the twins
// (one throw, two cures), the big wave (4 at once), the final wave (the boss: 3 hits, 3 forms, the name and dots on the
// card; the finale; ×2, a pumpkin, the street cleared, Oak Lane open), the yard (grenades, fences, extras; a purchase
// and a toggle), the Parent Zone (PIN, Family code with the week strip, Fractions,
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

const F = (page) => J(page, () => { const g = window.__fractionFright; const s = g.game && g.game.getState(); return { screen: g.screen, phase: s && s.phase, target: s && s.target, hint: s && s.hint, zombies: s ? s.zombies.length : 0, live: s ? s.live.filter((z) => !z.cured) : [], combo: s ? s.combo : 0, run: !!g.run, throws: g.run ? g.run.throws.length : 0 }; });
/** a spot about `err` of the road from the target, on whichever side keeps clear (> 2 × the zone) of every other live zombie */
async function clearSpot(page, target, err) {
  const live = (await F(page)).live.filter((z) => z.item !== target.id).map((z) => z.target);
  const cands = [];
  for (const e of [err, err + 0.04, err - 0.04, err + 0.08, err - 0.08, err + 0.12]) for (const x of [target.target + e, target.target - e]) if (x >= 0.01 && x <= 0.99) cands.push(x);
  const gap = (x) => Math.min(...live.map((t) => Math.abs(x - t)), 1);
  return cands.find((x) => gap(x) > 0.22) ?? cands.sort((a, b) => gap(b) - gap(a))[0];
}
const waitPhase = (page, phase = 'wave', timeout = 8000) => page.waitForFunction((p) => { const g = window.__fractionFright; const s = g.game && g.game.getState(); return g.screen !== 'wave' || (s && s.phase === p && s.target); }, phase, { timeout });
async function throwAt(page, x) { await waitPhase(page); return J(page, (v) => window.__fractionFright.throwAt(Math.max(0, Math.min(1, v))), x); }
/** cure every zombie left with a dead-on throw, until the results show */
/** v1.2: the Critter Stampede (SPEC §14): spray at every zombie critter until the stampede has passed (sim stepped). */
async function playBonus(page) {
  for (let i = 0; i < 600; i++) {
    const s = await J(page, () => { const b = window.__fractionFright.bonus; const st = b && b.getState(); return st ? { phase: st.phase, c: st.critters.filter((c) => c.zombie).map((c) => [c.x, c.y])[0] || null, screen: window.__fractionFright.screen } : null; });
    if (!s || s.phase === 'done' || s.screen !== 'bonus') return;
    await J(page, (c) => { const b = window.__fractionFright.bonus; if (c) { b.aim(c[0], c[1]); b.fire(true); } else b.fire(false); b.debugStep(6); }, s.c);
  }
}
async function playOut(page, timeout = 30000, untilBonus = false) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const s = await F(page);
    if (s.screen === 'results') return true;
    if (s.screen === 'bonus') { if (untilBonus) return 'bonus'; await playBonus(page); continue; }
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
  // v1.4 (SPEC §16): a brand-new player would start single file; seed a known, quick think time so the wave-1 checks see the 2-at-once horde
  const fresh = await J(page, () => { const g = window.__fractionFright; const p0 = g.app.pacePlan; const before = { pace: g.skills.pace }; g.skills.pace = { think: 3, n: 8, updatedAt: Date.now() }; g.app.persistSkills(); return before; });
  check(fresh.pace && fresh.pace.n === 0, 'a new player has no think time yet (the first wave would come one at a time)');
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
  // the card stack: 2 live on wave 1; the other zombie's fraction is a small card; tapping it calls that zombie
  await page.waitForFunction(() => document.querySelectorAll('#hud-stack .mini-card').length === 1, null, { timeout: 4000 }).catch(() => {});
  const stack0 = await J(page, () => [...document.querySelectorAll('#hud-stack .mini-card')].map((b) => ({ id: b.dataset.focus, show: b.dataset.show })));
  check(stack0.length === 1 && s.live.length === 2 && stack0[0].id !== s.target.id, `wave 1: two zombies live, the other one's fraction on a small card (${stack0.map((c) => c.show).join(', ')})`);
  check(await J(page, () => [...document.querySelectorAll('#hud-stack .mini-card')].every((b) => b.getBoundingClientRect().height >= 44)), 'the small cards are tap-sized');
  await audit(page, layout.insets, 'wave HUD');
  texts.push(await kidText(page));
  await J(page, () => { window.__spoken.length = 0; });
  await page.click('#hud-stack .mini-card');
  await page.waitForFunction((id) => { const g = window.__fractionFright; const t = g.game.getState().target; return t && t.id === id && document.querySelector('#btn-say').dataset.show === t.show; }, stack0[0].id, { timeout: 3000 }).then(() => true, () => false)
    .then((ok) => check(ok, `tapping the small card calls that zombie (${stack0[0].show} now on the big card)`));
  s = await F(page);
  check(await page.waitForFunction((say) => window.__spoken.includes(`${say}.`), s.target.say, { timeout: 3000 }).then(() => true, () => false), 'and reads it aloud');
  check(await J(page, (id) => [...document.querySelectorAll('#hud-stack .mini-card')].every((b) => b.dataset.focus !== id), s.target.id), 'the called one leaves the stack');
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
  check(last.combo === 2 && last.seen === false, `two hits in a row: combo ×2, both thrown while the zombie was still in the fog (seen ${last.seen})`);
  const chip = await J(page, () => { const c = document.querySelector('#hud-combo'); return { hidden: c.hidden, text: c.textContent.replace(/\s+/g, ' ').trim() }; });
  check(!chip.hidden && /COMBO ×2/.test(chip.text), `the COMBO chip shows from ×2 ("${chip.text}")`);
  await shot(page, layout, '09b-combo', 50);
  await waitPhase(page); s = await F(page);
  const nearItem = s.target;
  await throwAt(page, await clearSpot(page, s.target, 0.15));
  await waitPhase(page);
  s = await F(page);
  check(s.target.id === nearItem.id && s.hint === 'arrow', `15 % off: a near, the same zombie stays called and the next aim shows the nudge arrow (hint ${s.hint})`);
  check(!(await J(page, () => document.querySelector('#hud-combo').hidden)), 'a near keeps the combo');
  // far off: picked inside the page at throw time, the spot farthest from every live zombie (no race with spawns)
  const far = await J(page, () => { const g = window.__fractionFright; const live = g.game.getState().live.filter((z) => !z.cured).map((z) => z.target); let best = 0.5, bd = -1;
    for (let x = 0.02; x <= 0.98; x += 0.02) { const d = Math.min(...live.map((t) => Math.abs(x - t))); if (d > bd) { bd = d; best = x; } } g.throwAt(best); return { x: best, gap: bd, live }; });
  const beat = await (await page.waitForFunction(() => { const g = window.__fractionFright; return g.run && g.run.throws.length === 4 ? { phase: g.game.getState().phase } : null; }, null, { timeout: 3000 })).jsonValue();
  last = await J(page, () => window.__fractionFright.run.throws.at(-1));
  check(last.result === 'miss' && beat.phase === 'beat', `far off (${far.x.toFixed(2)}, ${far.gap.toFixed(2)} from every zombie at ${far.live.join(', ')}): a miss (${last.result}), then the feedback beat (phase ${beat.phase})`);
  await shot(page, layout, '10-wave-feedback', 0);
  check(await page.waitForFunction(() => document.querySelector('#hud-combo').hidden, null, { timeout: 2500 }).then(() => true, () => false), 'a miss resets the combo: the chip is gone');
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
  check(/^cure,bull,effort,sharp,combo,twins,boss(,bonus)?$/.test(p1.rows.map((r) => r.id).join()), `the rows: ${p1.rows.map((r) => r.id).join(', ')}`);
  check(p1.rows.find((r) => r.id === 'sharp').amount >= 50 && p1.rows.find((r) => r.id === 'combo').amount >= 30, `sharpshooter ($${p1.rows.find((r) => r.id === 'sharp').amount}) and combo ($${p1.rows.find((r) => r.id === 'combo').amount}) paid`);
  check(await J(page, () => document.querySelector('#res-combo').dataset.n) >= '2', 'results show the best combo');
  check(await J(page, () => document.querySelector('#res-counter').textContent.includes('Zombies zapped: 8') && document.querySelector('#res-cured span').textContent === 'Zapped' && document.querySelector('[data-row="cure"] td').textContent.startsWith('Zombies zapped')), 'the counter shows the total (Blast words: "Zombies zapped")');
  await J(page, () => window.__fractionFright.app.setSetting('gentle', true));
  await J(page, () => window.__fractionFright.results.show(window.__fractionFright.lastResult));
  check(await J(page, () => document.querySelector('#res-counter').textContent.includes('Neighbours cured: 8') && document.querySelector('#res-cured span').textContent === 'Cured'), 'Gentle mode (Options): the same results read "Neighbours cured"');
  await J(page, () => window.__fractionFright.app.setSetting('gentle', false));
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
  // the twins: when both are live, one throw at their spot cures both
  let twinThrow = null;
  for (let i = 0; i < 40 && !twinThrow; i++) {
    const st = await F(page);
    if (st.screen !== 'wave') break;
    if (st.phase !== 'wave' || !st.target) { await page.waitForTimeout(60); continue; }
    const same = st.live.filter((z) => Math.abs(z.target - st.target.target) < 1e-9);
    const n0 = st.throws;
    await J(page, (v) => window.__fractionFright.throwAt(v), st.target.target);
    await page.waitForFunction((n) => window.__fractionFright.run && window.__fractionFright.run.throws.length > n, n0, { timeout: 3000 }).catch(() => {});
    const t = await J(page, () => window.__fractionFright.run && window.__fractionFright.run.throws.at(-1));
    if (same.length === 2 && t && t.cures && t.cures.length === 2) twinThrow = { t, same };
  }
  check(!!twinThrow, `twins: one throw at ${twinThrow && twinThrow.same.map((z) => z.show).join(' = ')} cured both (${twinThrow && twinThrow.t.cures.join(', ')})`);
  check(await playOut(page), 'wave 2 played out');
  const r2 = await J(page, () => window.__fractionFright.lastResult);
  check(r2.items.some((x) => x.outcome === 'reached') && r2.cash.total >= 0 && r2.bank.nextWave === 3, `wave 2: ${r2.items.filter((x) => x.outcome === 'reached').length} reached the fence, cash still banked ($${r2.cash.total}), next wave 3`);
  const p2 = await payCheck(page, 'wave 2');
  check(p2.rows.find((r) => r.id === 'twins').amount === 80 && !!(await J(page, () => document.querySelector('#res-twins'))), 'the twins row pays $80 and the results call it out');
  check(r2.items.filter((x) => x.twin).length === 2, 'both twins in the wave\'s fractions');

  // ---------- wave 3: the big wave ----------
  await page.click('#res-next');
  await waitPhase(page);
  await page.waitForFunction(() => document.querySelectorAll('#hud-stack .mini-card').length >= 3, null, { timeout: 4000 }).catch(() => {});
  const big = await J(page, () => ({ big: window.__fractionFright.run.big, z: window.__fractionFright.game.getState().zombies.length, wave: document.querySelector('#hud-wave').textContent, cards: document.querySelectorAll('#hud-stack .mini-card').length }));
  check(big.big && big.z === 4 && /big wave/i.test(big.wave) && big.cards === 3, `wave 3 is the big wave: 4 zombies on the road at once, 3 small cards ("${big.wave}")`);
  await shot(page, layout, '12-big-wave', 0);
  // v1.4 (SPEC §16): the Pace Director: the wave started on the plan (live, walk) and re-plans after every throw;
  // Options → Pace: Calm = one at a time
  const pace0 = await J(page, () => { const g = window.__fractionFright; const s = g.game.getState(); return { plan: g.run.plan, pace: s.pace, thinks: g.run.thinks.length, stored: g.skills.pace, seg: [...document.querySelectorAll('#opt-pace .seg-btn')].map((b) => b.dataset.pace + (b.classList.contains('on') ? '*' : '')) }; });
  check(pace0.plan && pace0.pace && pace0.plan.live === pace0.pace.live && pace0.pace.walkSec > 0 && pace0.stored.n >= 4 && pace0.stored.think > 0, `the pace plan drives the horde (${pace0.plan.live} at once, ${pace0.plan.walkSec} s walk planned; the mock walks ${pace0.pace.walkSec} s under the test script; think ≈ ${pace0.stored.think} s over ${pace0.stored.n} throws)`);
  // v1.2: every throw on the big wave was a bull → the Critter Stampede (SPEC §14) before the results
  const seenBonus = (await playOut(page, 30000, true)) === 'bonus';
  check(seenBonus, 'wave 3: ≥ 80 % hits → the bonus round opens (screen "bonus")');
  if (seenBonus) {
    const b0 = await J(page, () => { const b = window.__fractionFright.bonus; const st = b.getState(); return { hud: document.querySelector('#hud').hidden, canvas: !document.querySelector('#bonus-stage').hidden, mid: getComputedStyle(document.querySelector('#hud .hud-mid')).visibility, phase: st.phase, total: st.total }; });
    check(!b0.hud && b0.canvas && b0.mid === 'hidden' && ['intro', 'run'].includes(b0.phase) && b0.total === 24, `bonus: its canvas on, the fraction HUD hidden, phase ${b0.phase}, ${b0.total} critters`);
    await shot(page, layout, '12b-bonus', 400);
  }
  check(await playOut(page), 'wave 3 played out');
  const r3 = await J(page, () => window.__fractionFright.lastResult);
  check(!!r3.bonus && r3.bonus.cured >= 1 && r3.bonus.cash === 15 * (r3.bonus.cured - (r3.bonus.gold ? 1 : 0)) + (r3.bonus.gold ? 150 : 0), `bonus: ${r3.bonus && r3.bonus.cured} of ${r3.bonus && r3.bonus.total} critters cured, $${r3.bonus && r3.bonus.cash}${r3.bonus && r3.bonus.gold ? ', the golden one' : ''}`);
  const p3 = await payCheck(page, 'wave 3');
  check(p3.rows.some((r) => r.id === 'bonus' && r3.bonus && r.amount === r3.bonus.cash) && !!(await J(page, () => document.querySelector('#res-bonus'))), 'the Bonus round row pays the stampede and the results call it out');
  await shot(page, layout, '12c-bonus-results', 0);
  // Options → Bonus round off: a perfect wave 4 goes straight to the results; Pace → Calm: one zombie at a time
  await J(page, () => { window.__fractionFright.app.setSetting('bonus', false); window.__fractionFright.app.setSetting('pace', 'calm'); });
  await page.click('#res-next');
  await waitPhase(page);
  const calm = await J(page, () => ({ plan: window.__fractionFright.run.plan, live: window.__fractionFright.game.getState().live.length }));
  check(calm.plan.live === 1 && calm.plan.mode === 'calm' && calm.live === 1 && calm.plan.walkSec >= 24, `Pace → Calm: wave 4 starts with one zombie at a time, ${calm.plan.walkSec} s walk`);
  await J(page, () => window.__fractionFright.app.setSetting('pace', 'auto'));
  check(await playOut(page), 'wave 4 played out');
  check(!(await J(page, () => window.__fractionFright.lastResult.bonus)), 'bonus round off (Options): no stampede after wave 4');
  await J(page, () => window.__fractionFright.app.setSetting('bonus', true));

  // ---------- wave 5: the final wave, ×2, a pumpkin, the street cleared ----------
  await page.click('#res-next');
  await waitPhase(page);
  check(await J(page, () => window.__fractionFright.run.final && /final wave/i.test(document.querySelector('#hud-wave').textContent)), 'wave 5 is the final wave');
  await J(page, () => { window.__mockScript.finaleSec = 0.9; window.__finale = false; });
  // the boss: the last zombie; 3 hits, a new form of the same number after each; the card shows its name and dots
  let bossSeen = null;
  const forms = [];
  for (const end = Date.now() + 60000; Date.now() < end;) {
    const st = await F(page);
    if (st.screen !== 'wave') break;
    if (st.phase === 'finale') await J(page, () => { window.__finale = true; });
    if (st.phase !== 'wave' || !st.target) { await page.waitForTimeout(20); continue; }
    if (st.target.kind === 'boss') {
      if (!bossSeen) bossSeen = await J(page, () => ({ name: document.querySelector('#fc-boss-name').textContent, hidden: document.querySelector('#fc-boss').hidden, dots: document.querySelectorAll('#fc-boss-dots i.on').length, kind: document.querySelector('#btn-say').dataset.kind }));
      if (!forms.includes(st.target.show)) forms.push(st.target.show);
      if (forms.length === 2) await shot(page, layout, '12b-boss', 0);
    }
    const n0 = st.throws;
    await J(page, (v) => window.__fractionFright.throwAt(v), st.target.target);
    await page.waitForFunction((n) => !window.__fractionFright.run || window.__fractionFright.run.throws.length > n, n0, { timeout: 3000 }).catch(() => {});
  }
  check(bossSeen && !bossSeen.hidden && bossSeen.kind === 'boss' && /Mayor Mumbles/.test(bossSeen.name) && bossSeen.dots === 3, `the boss card: "${bossSeen && bossSeen.name}", ${bossSeen && bossSeen.dots} dots, no numbers`);
  check(forms.length === 3 && forms[0] !== forms[1], `the boss showed three forms of its number: ${forms.join(' → ')}`);
  check(await page.waitForFunction(() => window.__finale || window.__fractionFright.screen === 'results', null, { timeout: 8000 }).then(() => J(page, () => window.__finale), () => false), 'the final wave ends with the finale (fireworks), then the calm beat');
  check(await playOut(page), 'wave 5 played out (the finale, the calm beat, then the results)');
  const r5 = await J(page, () => ({ title: document.querySelector('#res-title').textContent, pumpkin: !!document.querySelector('#res-pumpkin'), last: window.__fractionFright.lastResult, save: window.__fractionFright.save }));
  const p5 = await payCheck(page, 'final wave');
  const fin = p5.rows.find((r) => r.id === 'final');
  check(fin && fin.amount === p5.rows.filter((r) => r.id !== 'final' && r.id !== 'bonus').reduce((x, r) => x + r.amount, 0), `the final wave pays ×2 (a final row of $${fin && fin.amount}; the bonus round is on top)`);
  check(r5.title === 'Maple Street: cleared.' && r5.pumpkin && r5.save.pumpkins === 1 && r5.save.streets.maple.cleared === 1 && r5.save.streets.maple.wave === 1, `"${r5.title}", a pumpkin planted, the street starts over at wave 1`);
  check(r5.save.cures >= 40 && r5.last.bank.neighboursAfter >= 4, `the Cure Counter: ${r5.save.cures} cured → ${r5.last.bank.neighboursAfter} neighbours on the title's street`);
  check(p5.rows.find((r) => r.id === 'boss').amount === 300 && r5.last.boss && !!(await J(page, () => document.querySelector('#res-boss'))), 'the boss row pays $300 and the results call it out');
  await shot(page, layout, '13-results-final');
  texts.push(await kidText(page));

  // ---------- the yard ----------
  await page.click('#res-yard');
  await page.waitForSelector(visibleSel('#screen-yard'));
  const cash0 = await J(page, () => window.__fractionFright.save.cash);
  const secs = await J(page, () => [...document.querySelectorAll('#yard-side .yard-sec')].map((e) => e.textContent));
  check(secs.join('|') === 'Grenades|Goo colours|Fences|Yard extras' && await J(page, () => document.querySelectorAll('#yard-side .yard-item').length) === 12, `the yard: ${secs.join(' · ')} (12 items)`);
  await page.click('[data-buy="goo:grape"]');
  const y1 = await J(page, () => ({ cash: window.__fractionFright.save.cash, goo: window.__fractionFright.save.yard.goo, owned: window.__fractionFright.save.yard.owned.goo }));
  check(y1.goo === 'grape' && y1.owned.includes('grape') && y1.cash === cash0 - 1500, `the yard: Grape goo bought ($${cash0} → $${y1.cash}) and worn`);
  await page.click('[data-buy="grenade:lava"]');
  await page.click('[data-buy="extra:dog"]');
  const y2 = await J(page, () => ({ cash: window.__fractionFright.save.cash, gren: window.__fractionFright.save.yard.grenade, dog: window.__fractionFright.save.yard.dog, btn: document.querySelector('[data-buy="extra:dog"]').textContent.trim() }));
  check(y2.gren === 'lava' && y2.dog === true && y2.cash === y1.cash - 2500 - 4000 && y2.btn === 'On', `the lava grenade ($2,500) and the yard dog ($4,000) bought (now $${y2.cash}); the dog is On`);
  await page.click('[data-buy="extra:dog"]');
  check(await J(page, () => window.__fractionFright.save.yard.dog === false && document.querySelector('[data-buy="extra:dog"]').textContent.trim() === 'Off'), 'the dog toggles Off (no charge)');
  await page.click('[data-buy="extra:dog"]');
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
  check(await J(page, () => !!document.querySelector('#opt-aloud') && /Fraction Fright 1\.4\.0 · mock engine/.test(document.querySelector('.ver').textContent)), 'Options: fractions aloud, the version and engine');
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
  check(tile === String(r5.save.cures) && back.save.cures === r5.save.cures && back.save.yard.goo === 'grape' && back.save.yard.grenade === 'lava' && back.save.yard.dog === true && back.save.pumpkins === 1 && back.sk.lab.done > 0 && back.sk.opened.T2 > 0,
    `after a reload: ${back.save.cures} cured, Grape goo, the lava grenade, the dog, 1 pumpkin, the Lab done, Oak Lane open`);
  check(Object.keys(back.sk.records).some((k) => k.endsWith('.seen')) && Object.keys(back.sk.records).some((k) => k.endsWith('.locate')), `throws at zombies out of the fog are kept apart as 'seen' (${Object.keys(back.sk.records).join(', ')})`);
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
  // v1.3 (SPEC §15): Blast is the default; Gentle mode is a device setting
  check(await J(page, () => window.__fractionFright.app.gentle === false && !!document.querySelector('#opt-gentle') === false), 'Blast is the default (Gentle mode off; its toggle lives in Parents → Options)');
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

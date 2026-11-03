// Playwright smoke test of the Lab's UI against the REAL core (lab/SPEC.md §7.3), at 1280x800 (laptop) and 390x844 (phone, portrait), plus the
// views at 844x390 (phone on its side) for the layout audit. From the repo root, with a static server on the repo root:
//   python3 -m http.server 8121 --directory .   then   BASE_URL=http://localhost:8121 node lab/tools/ui-smoke.mjs
// Options: ONLY=desktop|phone|landscape runs one layout; SHOTS=<dir> sets where the screenshots go (default: $TMPDIR/lab-ui-shots).
// Covers: Players (and a new player on the on-screen keyboard), Home with the avatar and pet at seeded levels (1/8/20/40/70/100: the pet's stage and
// the avatar's frame), the welcome strip (markWelcome), Quests (three cards, progress moves with events, one swap), the Crate (a reveal after three
// quests with grantCoins/setQuests; reduced motion too; no odds shown), the Shop (tabs, the two-tap Buy with its confirm that resets itself, "Need N
// more", gift and locked states, a game whose looks are not ready shows none, Build Crew's shelf), Me (slots, equip, the pet renamed on the on-screen
// keyboard), Family (two players in the picker's order, a crown and a star, the goal meter and Claim, no rank numerals), Gallery (seeded builds),
// Grown-ups (the PIN, the odds table equals crateOddsTable(), the switches hide panels, coin history, Reset with a confirm), the HUD pill and the results
// strip on a fake game page (flame, level-up banner, "Lab crate!"), the overlay (Escape closes), the voice (natural-voice clips, never the device voice),
// the layout audit on every view (no overflow, targets >= 44 px, no native inputs outside Grown-ups, no off-origin links, no text from the kid-rule
// list, no timers), the service worker's file list, and the page working offline after the first load.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
const { chromium } = require('playwright');
const { BANNED } = await import('./rules-audit.mjs');

const BASE = (process.env.BASE_URL || 'http://localhost:8121').replace(/\/$/, '');
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SHOTS = process.env.SHOTS || join(tmpdir(), 'lab-ui-shots');
mkdirSync(SHOTS, { recursive: true });
const LAYOUTS = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } };
const only = process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(LAYOUTS);

let passed = 0; const failed = [];
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log('  ok  ' + name); } else { failed.push(name); console.log('  FAIL ' + name + (detail ? `\n      ${detail}` : '')); }
}
const section = (s) => console.log('\n' + s);
const FAMILY = { v: 1, players: [{ id: 'mia', name: 'Mia', color: '#ff3b5c', createdAt: 1, updatedAt: 1 }, { id: 'ben', name: 'Ben', color: '#3b7dd9', createdAt: 2, updatedAt: 2 }], pinHash: null, options: {}, optionsUpdatedAt: {}, removedPlayers: [] };

// ---------- the layout audit, run inside the page ----------
const AUDIT = `(() => {
  const out = [];
  const vw = innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) out.push('page overflows horizontally: ' + document.documentElement.scrollWidth + ' > ' + vw);
  const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  for (const e of document.querySelectorAll('.lab-root button, .lab-root a[href], .lab-root input')) {
    if (!visible(e)) continue;
    const r = e.getBoundingClientRect(); const name = (e.getAttribute('aria-label') || e.textContent || e.className).trim().slice(0, 30);
    if (e.classList.contains('kb-key')) { if (r.height < 38) out.push('key too short: ' + name + ' ' + Math.round(r.height)); continue; }
    if (r.width < 43.5 || r.height < 43.5) out.push('target under 44 px: ' + (e.className || e.tagName) + ' "' + name + '" ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  const main = document.querySelector('.lab-main, .lab-pl-body, .lab-np');
  for (const e of document.querySelectorAll('.lab-root *')) {
    if (!visible(e) || e.closest('svg') || e.closest('.lab-bigview')) continue;
    const r = e.getBoundingClientRect();
    if (r.width && (r.right > vw + 1.5 || r.left < -1.5)) { out.push('pokes out sideways: ' + (e.className && e.className.baseVal === undefined ? e.className : e.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); break; }
  }
  const inputs = [...document.querySelectorAll('input, textarea, select, [contenteditable]')].filter((e) => !e.closest('.lab-parent'));
  if (inputs.length) out.push('native inputs outside Grown-ups: ' + inputs.length);
  const links = [...document.querySelectorAll('a[href]')].filter((a) => new URL(a.href, location.href).origin !== location.origin);
  if (links.length) out.push('links off-origin: ' + links.map((a) => a.href).join(','));
  const scroller = main && main.scrollWidth > main.clientWidth + 1;
  if (scroller) out.push('a second scroll axis: ' + main.className);
  const txt = document.body.innerText || '';
  return { issues: out, text: txt, timers: document.querySelectorAll('[role=timer], time, [class*=countdown], [class*=timer]').length };
})()`;

async function audit(page, label) {
  const r = await page.evaluate(AUDIT);
  const text = r.text;
  const bad = [];
  for (const [what, re] of BANNED) { const m = re.exec(text); if (m) bad.push(`${what} "${m[0]}"`); }
  if (/\b\d{1,2}:\d{2}\b|seconds? left|resets? in/i.test(text)) bad.push('a clock or countdown in the text');
  check(`audit ${label}: layout, targets, no native inputs / off-origin links`, r.issues.length === 0, r.issues.slice(0, 4).join(' | '));
  check(`audit ${label}: no kid-rule text, no timers`, bad.length === 0 && r.timers === 0, bad.join(', ') + (r.timers ? ` timers:${r.timers}` : ''));
}

// ---------- helpers ----------
const L = (page, fn, arg) => page.evaluate(fn, arg);
const view = (page) => L(page, () => __lab.store.view());
const clickTab = async (page, v) => { await page.evaluate((v) => { const sh = document.querySelector('.lab-shell'); if (sh.dataset.view === v) return; if (v === 'home') document.querySelector('#lab-lead').click(); else document.querySelector(`.lab-tab[data-view="${v}"]`).click(); }, v); await page.waitForTimeout(450); };
async function shot(page, layout, name) { await page.screenshot({ path: join(SHOTS, `${layout}-${name}.png`) }); }
async function setXp(page, xp) { await L(page, (xp) => { const s = __lab.store, d = s.doc(); d.dev[s.device] = { c: (d.dev[s.device] || { c: 0 }).c, x: xp }; s.setOpt('quests', true); }, xp); await page.waitForTimeout(200); }
async function typeName(page, name) { for (const ch of name.toLowerCase()) await page.click(`.kb-key[data-key="${ch}"]`); }
async function pickPlayer(page, id) {
  const back = await page.evaluate(() => document.querySelector('.lab-pl-grid') ? 'players' : 'lab');
  if (back === 'lab') { await clickTab(page, 'home'); await page.click('#lab-lead'); await page.waitForTimeout(300); }
  await page.click(`[data-player="${id}"]`); await page.waitForTimeout(500);
}
const waitFor = async (page, sel, ms = 4000) => { try { await page.waitForSelector(sel, { timeout: ms }); return true; } catch (_) { return false; } };

async function runLayout(browser, layout) {
  const size = LAYOUTS[layout];
  const phone = layout !== 'desktop';
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, hasTouch: phone, serviceWorkers: 'block' });
  // the games' own looks modules are real now (the Lab reads LOOKS_READY from each); Fraction Fright's is withheld here so the "looks not ready shows no items" rule is still tested
  await ctx.route('**/fraction-fright/src/meta/labLooks.js', (route) => route.abort('failed'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !(/Failed to load resource/.test(m.text()) && /labLooks\.js/.test(m.location().url || ''))) errors.push(`${m.text()} ${m.location().url || ''}`); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  const offOrigin = [];
  page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) offOrigin.push(r.url()); });
  await page.addInitScript((fam) => { if (!localStorage.getItem('spellJump.family')) localStorage.setItem('spellJump.family', JSON.stringify(fam)); }, FAMILY);
  const fast = layout === 'landscape';          // landscape: the layout audit of every view, not the whole flow

  // ================= Players =================
  section(`[${layout}] Players`);
  await page.goto(`${BASE}/lab/?nosw`);
  await waitFor(page, '.lab-pl-tile');
  check('the picker lists the family in order, then "New player"', JSON.stringify(await L(page, () => [...document.querySelectorAll('.lab-pl-tile')].map((t) => t.dataset.player || 'add'))) === '["mia","ben","add"]');
  check('each tile shows the child\'s Lab level', /Lv 1 · Cadet/.test(await page.textContent('[data-player="mia"]')));
  check('a same-origin link back to the Learning Lab home', (await page.getAttribute('#pl-home', 'href')) === '/');
  await shot(page, layout, '01-players');
  await audit(page, 'players');

  // ================= New player (the on-screen keyboard) =================
  if (!fast) {
    section(`[${layout}] New player`);
    await page.click('#pl-add'); await page.waitForTimeout(300);
    await audit(page, 'new player');
    await shot(page, layout, '02-new-player');
    await typeName(page, 'cal');
    check('the name is typed on the shared keyboard', /Cal/.test(await page.textContent('#np-name')));
    await page.click('.kb-enter'); await page.waitForTimeout(700);
    check('the new player lands in their Lab', await waitFor(page, '.lab-shell[data-view="home"]') && (await page.textContent('.lab-chip-name')) === 'Cal');
    const fam = JSON.parse(await L(page, () => localStorage.getItem('spellJump.family')));
    check('the family record has three players', fam.players.length === 3);
    // the welcome strip: after the first event from a game
    check('before any play there is no welcome strip', (await page.locator('.lab-note.welcome').count()) === 0);
    await L(page, () => { __lab.store.report({ game: 'sj', event: 'word', firstTry: true }); });
    await page.waitForTimeout(500);
    check('the welcome strip shows after the first event ("Welcome to the Lab")', (await page.textContent('.lab-note.welcome')).includes('Welcome to the Lab'));
    check('markWelcome() was called (seen.welcome is stamped)', (await L(page, () => __lab.store.doc().seen.welcome)) > 0);
    check('the first poster came as a gift and hangs on the wall', (await view(page)).home.posters.includes('home.poster.sj'));
    await shot(page, layout, '03-home-welcome');
    await audit(page, 'home with the welcome strip');
    await L(page, () => __lab.reset());
    await pickPlayer(page, 'mia');
  } else await pickPlayer(page, 'mia');

  // ================= Home: avatar and pet by level =================
  section(`[${layout}] Home`);
  check('Mia\'s Home opens', await waitFor(page, '.lab-room-cv'));
  const stages = [[1, 1, 0], [8, 2, 0], [20, 3, 1], [40, 4, 2], [70, 5, 3], [100, 5, 5]];       // level, pet stage, avatar frame
  const XPAT = await L(page, async () => { const m = await import('/lab/src/core/xp.js'); return [1, 8, 20, 40, 70, 100].map((l) => m.xpToReach(l)); });
  for (let i = 0; i < stages.length; i++) {
    const [lv, stage, frame] = stages[i];
    if (fast && ![1, 100].includes(lv)) continue;
    await setXp(page, XPAT[i]);
    const v = await view(page);
    check(`level ${lv}: Lab level, pet stage ${stage}, avatar frame ${frame}`, v.level.level === lv && v.pet.stage === stage && v.avatar.frame === frame, JSON.stringify({ l: v.level.level, s: v.pet.stage, f: v.avatar.frame }));
    const painted = await L(page, () => { const c = document.querySelector('.lab-room-cv'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; const seen = new Set(); for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4)); return seen.size; });
    check(`level ${lv}: the room is drawn (not blank)`, painted > 12, String(painted));
    if (layout === 'desktop' && [1, 20, 70, 100].includes(lv)) await shot(page, layout, `04-home-level-${lv}`);
    if (lv === 20) check('the title is Ranger at level 20', (await page.textContent('.lab-lv')).includes('Ranger'));
  }
  await setXp(page, 28);
  check('the top bar says "N XP to level M"', /^\d+ XP to level \d+$/.test((await page.textContent('#lab-xp-text')).trim()), await page.textContent('#lab-xp-text'));
  check('the coin purse and the streak flame are in the top bar', (await page.locator('#lab-coins').count()) === 1 && (await page.locator('#lab-streak .lab-freeze').count()) >= 1);
  await shot(page, layout, '04-home');
  await audit(page, 'home');
  const cut = await L(page, () => [...document.querySelectorAll('.lab-tab')].filter((b) => b.offsetParent && b.querySelector('.lab-tab-tx').offsetParent).filter((b) => { const t = b.querySelector('.lab-tab-tx'); return t.scrollWidth > t.clientWidth + 1; }).map((b) => b.dataset.view));
  check('every tab label fits (nothing cut off)', cut.length === 0, cut.join(','));
  // petting the pet is a hop and a sound, not a navigation
  await page.click('.lab-hot-pet'); await page.waitForTimeout(150);
  check('tapping the pet stays on Home', (await page.getAttribute('.lab-shell', 'data-view')) === 'home');

  // ================= Quests =================
  section(`[${layout}] Quests`);
  await L(page, () => __lab.setQuests(['tb-races', 'tb-facts', 'tb-win']));
  await clickTab(page, 'quests');
  check('three quest cards', (await page.locator('.lab-quest').count()) === 3);
  check('no clock, "resets in" or "expired" on the quests', !/resets|expire|left today|\d:\d\d/i.test(await page.innerText('.lab-quests')));
  const before = await L(page, () => [...document.querySelectorAll('.lab-quest-n')].map((n) => n.textContent));
  await L(page, () => { for (let i = 0; i < 3; i++) __lab.store.report({ game: 'tb', event: 'fact', firstTry: true }); });
  await page.waitForTimeout(350);
  const after = await L(page, () => [...document.querySelectorAll('.lab-quest-n')].map((n) => n.textContent));
  check('progress moves with events (tb-facts 3 / 6)', before[1] === '0 / 6' && after[1] === '3 / 6', JSON.stringify([before, after]));
  check('the nudge quest says only "Try something different"', (await page.locator('.lab-tag').count()) <= 1);
  if (!fast) {
    await L(page, () => __lab.setQuests(['sj-words', 'tb-facts', 'ww-leg']));
    await page.waitForTimeout(350);
    const sw = await page.locator('.lab-swap').count();
    check('a swap button on every unfinished card', sw === 3, String(sw));
    await page.locator('.lab-swap').first().click(); await page.waitForTimeout(350);
    check('after one swap there are no more swaps today', (await page.locator('.lab-swap').count()) === 0);
    check('the swap really changed a quest', (await page.locator('.lab-quest').count()) === 3);
  }
  await shot(page, layout, '05-quests');
  await audit(page, 'quests');

  // ================= Crate =================
  section(`[${layout}] Crate`);
  await clickTab(page, 'crate');
  check('with no crate waiting the crate sits closed (disabled)', await page.locator('#crate-open[disabled]').count() === 1);
  await shot(page, layout, '06-crate-closed');
  await audit(page, 'crate (closed)');
  if (!fast) {
    const finish = async () => { await L(page, async () => { const s = __lab.store; s.__test.setQuests(['tb-races', 'tb-facts', 'tb-win']); s.report({ game: 'tb', event: 'race' }); s.report({ game: 'tb', event: 'win' }); s.report({ game: 'tb', event: 'fact', n: 6, firstTry: true }); }); await page.waitForTimeout(400); };
    await finish();
    const v1 = await view(page);
    check('three quests done earn one crate', v1.crates.waiting === 1 && v1.questsDone === 3);
    check('a count shows on the Crate tab', (await page.textContent('.lab-tab[data-view="crate"] .lab-dot')) === '1');
    await clickTab(page, 'crate');
    await shot(page, layout, '07-crate-waiting');
    await page.click('#crate-open');
    await page.waitForTimeout(350);
    await shot(page, layout, '08-crate-shaking');
    check('the reveal appears with the item name', await waitFor(page, '#crate-name', 3500));
    const name = (await page.textContent('#crate-name')).trim();
    const note = (await page.textContent('#crate-note')).trim();
    check('the reveal says "New!" (or the coin refund)', note === 'New!' || /^You already had it: \+[\d,]+ coins$/.test(note), note);
    check('the item is owned now', (await view(page)).owned.length >= 1 && (await view(page)).crates.waiting === 0, name);
    check('the odds are NOT shown to the child', !/%|in 100|\bodds\b|chance/i.test(await page.innerText('.lab-main')));
    await page.waitForTimeout(700);
    await shot(page, layout, '09-crate-reveal');
    await audit(page, 'crate (reveal)');
    if (await page.locator('#crate-wear').count()) { await page.click('#crate-wear'); await page.waitForTimeout(250); check('"Wear it" equips the new item', (await page.locator('.lab-note-ok').count()) === 1); }
    await page.click('#crate-done'); await page.waitForTimeout(400);
    check('Nice! goes back Home', (await page.getAttribute('.lab-shell', 'data-view')) === 'home');
    // reduced motion: the same, with a fade
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await L(page, () => __lab.advanceDay());
    await finish();
    await clickTab(page, 'crate'); await page.click('#crate-open');
    check('reduced motion: the reveal still appears (a fade, no shake)', await waitFor(page, '#crate-name', 2500));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.click('#crate-done'); await page.waitForTimeout(300);
  }

  // ================= Shop =================
  section(`[${layout}] Shop`);
  await L(page, () => { __lab.grantCoins(20000); __lab.setLooks('sj', ['sj.skin.mint', 'sj.skin.grape', 'sj.skin.lemon']); __lab.setLooks('bc', ['bc.veh.dump', 'bc.veh.fork', 'bc.bp.arch', 'bc.bp.windmill']); __lab.setLooks('ff', []); });
  await setXp(page, 28);
  await clickTab(page, 'shop');
  const tabs = await L(page, () => [...document.querySelectorAll('.lab-shop-tabs .lab-seg-btn')].map((b) => b.textContent.trim()));
  check('shop tabs: Me, Home and the five games', JSON.stringify(tabs) === JSON.stringify(['Me', 'Home', 'Spell Jump', 'Trail Blazer', 'Fraction Fright', 'Wagon West', 'Build Crew']), JSON.stringify(tabs));
  check('prices show on buyable cards', (await page.locator('[data-act="buy"]').count()) > 0);
  check('a gift says how it is earned', /Gift: Level \d+/.test(await page.innerText('.lab-shop')));
  const locked = await page.locator('[data-state="locked"]').count();
  check('a slot that opens later says "Opens at level N"', locked > 0 && /Opens at level \d+/.test(await page.innerText('.lab-shop')), String(locked));
  await shot(page, layout, '10-shop-me');
  await audit(page, 'shop (Me)');
  if (!fast) {
    // the two-tap Buy
    const card = page.locator('[data-item="av.hat.headband"]');
    const coins0 = (await view(page)).coins;
    await card.locator('[data-act="buy"]').click(); await page.waitForTimeout(200);
    check('the first tap only asks ("Yes, buy"): nothing is bought', (await card.locator('[data-act="confirm"]').textContent()).trim() === 'Yes, buy' && (await view(page)).coins === coins0);
    check('the confirm shows no clock', !/\d\s?s\b|second|:\d\d/i.test(await card.innerText()));
    await shot(page, layout, '11-shop-confirm');
    await page.waitForTimeout(4400);
    check('the confirm resets itself after a few seconds', (await card.locator('[data-act="buy"]').count()) === 1 && (await card.locator('[data-act="confirm"]').count()) === 0 && (await view(page)).coins === coins0);
    await card.locator('[data-act="buy"]').click(); await page.waitForTimeout(150);
    await card.locator('[data-act="cancel"]').click(); await page.waitForTimeout(150);
    check('"Not now" cancels', (await card.locator('[data-act="buy"]').count()) === 1 && (await view(page)).coins === coins0);
    await card.locator('[data-act="buy"]').click(); await page.waitForTimeout(150);
    await card.locator('[data-act="confirm"]').click(); await page.waitForTimeout(400);
    const v2 = await view(page);
    check('the second tap buys: the purse drops by the price and the item is owned', v2.coins === coins0 - 300 && v2.owned.includes('av.hat.headband'), `${coins0} -> ${v2.coins}`);
    check('the card now offers Equip', (await card.locator('[data-act="equip"]').count()) === 1);
    await card.locator('[data-act="equip"]').click(); await page.waitForTimeout(250);
    check('Equip wears it ("Equipped")', (await card.locator('[data-act="off"]').textContent()).trim() === 'Equipped' && (await view(page)).avatar.slots.hat.id === 'av.hat.headband');
    await shot(page, layout, '12-shop-bought');
    // not enough coins
    await pickPlayer(page, 'ben'); await clickTab(page, 'shop');
    check('"Need N more" when the purse is short (never "too expensive")', /Need [\d,]+ more/.test(await page.innerText('.lab-shop')) && !/too expensive/i.test(await page.innerText('.lab-shop')));
    await pickPlayer(page, 'mia'); await clickTab(page, 'shop');
    // a game
    await page.click('.lab-seg-btn[data-tab="sj"]'); await page.waitForTimeout(350);
    const sjReady = await L(page, async () => (await import('/spell-jump/src/meta/labLooks.js')).LOOKS_READY);
    const sjShown = await L(page, () => [...document.querySelectorAll('[data-item]')].map((e) => e.dataset.item));
    check('Spell Jump\'s tab lists only what its (real) looks module says is ready', sjShown.length > 0 && sjShown.every((id) => sjReady.includes(id)) && sjShown.includes('sj.skin.mint'), `${sjShown.length} shown of ${sjReady.length} ready`);
    await shot(page, layout, '13-shop-spell-jump');
    await page.click('.lab-seg-btn[data-tab="ff"]'); await page.waitForTimeout(350);
    check('a game whose looks are not ready shows no items', (await page.locator('[data-item]').count()) === 0 && (await page.locator('#shop-empty').count()) === 1);
    // Build Crew
    await page.click('.lab-seg-btn[data-tab="bc"]'); await page.waitForTimeout(350);
    check('Build Crew\'s shelf: "New in Build Crew", the dump truck at 8,000', /New in Build Crew/i.test(await page.innerText('.lab-shop')) && /Buy 8,000/.test(await page.innerText('[data-item="bc.veh.dump"]')));
    await shot(page, layout, '14-shop-build-crew');
    await audit(page, 'shop (Build Crew)');
    const c1 = (await view(page)).coins;
    await page.locator('[data-item="bc.veh.dump"] [data-act="buy"]').click(); await page.waitForTimeout(150);
    await page.locator('[data-item="bc.veh.dump"] [data-act="confirm"]').click(); await page.waitForTimeout(400);
    check('buying the dump truck (two taps): the purse drops by 8,000 and lab.owns says so', (await view(page)).coins === c1 - 8000 && await L(page, async () => (await import('/lab/src/index.js')).lab.owns('bc.veh.dump')));
    check('"See it in Build Crew" is a same-origin link', (await page.getAttribute('#see-bc', 'href')) === '/build-crew/');
    await page.click('.lab-seg-btn[data-tab="home"]'); await page.waitForTimeout(300);
    await shot(page, layout, '15-shop-home');
    await audit(page, 'shop (Home)');
  }

  // ================= Me =================
  section(`[${layout}] Me`);
  await clickTab(page, 'me');
  check('slot rows for the avatar and the pet', (await page.locator('.lab-slot-row').count()) === 8);
  check('a closed slot shows the level it opens at', /Opens at level \d+/i.test(await page.innerText('.lab-me-rows')));
  await shot(page, layout, '16-me');
  await audit(page, 'me');
  if (!fast) {
    await page.click('[data-species="otter"]'); await page.waitForTimeout(250);
    check('the pet\'s species can be chosen', (await view(page)).pet.species === 'otter');
    await page.click('#pet-rename'); await page.waitForTimeout(250);
    check('renaming opens the on-screen keyboard (not the native one)', (await page.locator('#pet-keyboard').count()) === 1 && (await page.locator('input, textarea').count()) === 0);
    await shot(page, layout, '17-me-rename');
    await audit(page, 'me (rename)');
    await typeName(page, 'zed'); await page.click('#pet-keyboard .kb-enter'); await page.waitForTimeout(350);
    check('the pet is named Zed', (await view(page)).pet.name === 'Zed' && (await page.textContent('#pet-name')) === 'Zed');
    await page.locator('.lab-slot-row[data-slot="av.hat"] [data-item=""]').click(); await page.waitForTimeout(250);
    check('"None" takes the hat off', (await view(page)).avatar.slots.hat.id === null);
    await page.locator('.lab-slot-row[data-slot="av.hat"] [data-item="av.hat.headband"]').click(); await page.waitForTimeout(250);
    check('an owned item is worn from its slot row', (await view(page)).avatar.slots.hat.id === 'av.hat.headband');
  }

  // ================= Family =================
  section(`[${layout}] Family`);
  if (!fast) {
    // Ben has an older usual of 400 XP a week and a bigger week now than his usual; Mia has the most XP.
    await L(page, async () => {
      const m = await import('/lab/src/core/model.js');
      const seedWeeks = (s, base, now) => { const d = s.doc(); const wk = s.family().week; d.weeks[wk] = d.weeks[wk] || {}; d.weeks[wk][s.device] = { xp: now, coins: 0, zap: 0, race: 0, word: 0, ft: 0, leg: 0, job: 0, g: ['sj'] }; for (const i of [1, 2, 3]) { const w = m.weekShift(wk, -i); d.weeks[w] = d.weeks[w] || {}; d.weeks[w][s.device] = { xp: base, coins: 0, zap: 0, race: 0, word: 0, ft: 0, leg: 0, job: 0, g: ['sj'] }; } s.setOpt('board', true); };
      const s = __lab.store;
      s.attach({ game: 'sj', playerId: 'ben', name: 'Ben', color: '#3b7dd9' }); seedWeeks(s, 400, 700); s.flush();
      s.attach({ game: 'sj', playerId: 'mia', name: 'Mia', color: '#ff3b5c' }); seedWeeks(s, 1900, 2000); s.flush();
    });
  }
  await clickTab(page, 'family');
  const rows = await L(page, () => [...document.querySelectorAll('.lab-person')].map((p) => p.dataset.player));
  check('the board lists the family in the picker\'s fixed order', JSON.stringify(rows.slice(0, 2)) === '["mia","ben"]', JSON.stringify(rows));
  check('the goal meter shows progress / target', /^[\d,]+ \/ [\d,]+$/.test((await page.textContent('#goal-n')).trim()));
  check('"Next week: ..." sits under the goal', /^Next week: /.test((await page.textContent('#goal-next')).trim()));
  if (!fast) {
    check('a crown for Most (Mia)', (await page.locator('.lab-person[data-player="mia"] .lab-badge-crown').count()) === 1 && (await page.locator('.lab-person[data-player="ben"] .lab-badge-crown').count()) === 0);
    check('a star for Most improved (Ben), "+N % on your usual"', (await page.locator('.lab-person[data-player="ben"] .lab-badge-star').count()) === 1 && /Most improved: \+\d+ % on your usual/.test(await page.innerText('.lab-person[data-player="ben"]')));
    check('no rank numerals, no "last" on the board', !/\b(1st|2nd|3rd|\d+th)\b|\brank|last place|\blast\b/i.test(await page.innerText('.lab-board')));
    // meet the goal and claim it
    const goal = await L(page, () => __lab.store.family().goal);
    await L(page, (g) => {
      const s = __lab.store, n = g.target;
      const by = { zap: ['ff', 'zap'], race: ['tb', 'race'], word: ['sj', 'word'], leg: ['ww', 'leg'], job: ['bc', 'job'], ft: ['tb', 'fact'] }[g.id];
      if (by) s.report({ game: by[0], event: by[1], n, firstTry: true });
      else for (const p of JSON.parse(localStorage.getItem('spellJump.family')).players) { s.attach({ game: 'sj', playerId: p.id, name: p.name, color: p.color }); for (const gm of ['sj', 'tb', 'ff']) s.report({ game: gm, event: gm === 'sj' ? 'word' : gm === 'tb' ? 'race' : 'zap', firstTry: true }); }
      s.attach({ game: 'sj', playerId: 'mia', name: 'Mia', color: '#ff3b5c' });
    }, goal);
    await page.waitForTimeout(500);
    await clickTab(page, 'home'); await clickTab(page, 'family');
    check('the goal is met: Claim appears', await waitFor(page, '#goal-claim', 2500), JSON.stringify(goal));
    await shot(page, layout, '18-family');
    await audit(page, 'family');
    const own0 = (await view(page)).owned.length;
    await page.click('#goal-claim'); await page.waitForTimeout(500);
    check('Claim gives the next family banner for the room', (await view(page)).owned.some((i) => /^home\.banner\.f1$/.test(i)) && (await view(page)).owned.length === own0 + 1);
    check('after claiming there is no second Claim', (await page.locator('#goal-claim').count()) === 0);
  } else { await shot(page, layout, '18-family'); await audit(page, 'family'); }

  // ================= Gallery =================
  section(`[${layout}] Gallery`);
  await clickTab(page, 'gallery');
  check('an empty gallery says what fills it', /Build Crew/.test(await page.innerText('.lab-gallery')) || (await page.locator('.lab-build').count()) > 0);
  if (!fast) {
    await L(page, () => {
      const pcs = Array.from({ length: 14 }, (_, i) => [i % 6, i % 12, 20 + (i % 5) * 18, 10 + Math.floor(i / 5) * 16, 5 + (i % 3) * 12]);
      __lab.store.report({ game: 'bc', event: 'job', n: 1, meta: { id: 'bc.job3.test', title: 'Low bridge', first: true, pieces: pcs } });
      __lab.store.report({ game: 'bc', event: 'site', meta: { id: 'bc.site.test', title: 'My yard', pieces: pcs.slice(0, 8) } });
      __lab.store.attach({ game: 'bc', playerId: 'ben', name: 'Ben', color: '#3b7dd9' });
      __lab.store.report({ game: 'bc', event: 'blueprint', meta: { id: 'bc.bp.ben', title: 'Windmill', pieces: pcs.slice(4) } });
      __lab.store.attach({ game: 'bc', playerId: 'mia', name: 'Mia', color: '#ff3b5c' });
    });
    await page.waitForTimeout(600);
    check('the family\'s finished builds hang in the gallery with the builder\'s name', (await page.locator('.lab-build').count()) === 3 && /Low bridge/.test(await page.innerText('.lab-gallery')) && /Ben · Blueprint/.test(await page.innerText('.lab-gallery')));
    check('each build is drawn (two blueprint views), never a stored picture', (await page.locator('.lab-build svg.lab-bp').count()) === 6 && (await page.locator('.lab-gallery img, .lab-gallery canvas').count()) === 0);
    await shot(page, layout, '19-gallery');
    await audit(page, 'gallery');
    await page.locator('.lab-build').first().click(); await page.waitForTimeout(250);
    check('tap a build for a large view', await page.locator('.lab-bigview:not([hidden]) svg.lab-bp').count() === 2);
    await shot(page, layout, '20-gallery-large');
    await page.click('#gallery-close'); await page.waitForTimeout(200);
  } else { await shot(page, layout, '19-gallery'); await audit(page, 'gallery'); }

  // ================= Grown-ups =================
  section(`[${layout}] Grown-ups`);
  await clickTab(page, 'parent');
  check('with no PIN yet the Grown-ups panel asks to choose one', /Choose a 4-digit PIN/.test(await page.textContent('#pin-title')));
  await shot(page, layout, '21-grownups-pin');
  await audit(page, 'grown-ups (PIN)');
  const pin = async (d) => { for (const c of d) await page.click(`.lab-pin-key[data-digit="${c}"]`); await page.waitForTimeout(350); };
  if (!fast) {
    await pin('1234');
    check('then type it again', /Type the PIN again/.test(await page.textContent('#pin-title')));
    await pin('1111');
    check('a mismatch says so, gently', /did not match/.test(await page.textContent('#pin-err')));
    await pin('1234'); await pin('1234');
    check('the panel opens', await waitFor(page, '#odds-table'));
    // the odds equal crateOddsTable()
    const want = await L(page, async () => (await import('/lab/src/core/crate.js')).crateOddsTable());
    const got = await L(page, () => [...document.querySelectorAll('#odds-table tbody tr')].map((r) => [r.dataset.rarity, r.children[0].textContent, r.children[1].textContent]));
    check('the odds table equals crateOddsTable() (common 86 / rare 12 / epic 2)', JSON.stringify(got) === JSON.stringify(want.rows.map((r) => [r.id, r.name, `${r.percent} in 100`])) && want.rows.map((r) => r.percent).join() === '86,12,2');
    check('the 7-crate guarantee and "cosmetics only" are stated', /guaranteed at least every 7 crates/.test(await page.innerText('.lab-parent')) && /Cosmetics only/.test(await page.innerText('.lab-parent')));
    check('native inputs exist only here (the switches)', (await page.locator('.lab-parent input[type="checkbox"]').count()) === 4);
    check('coin history, the daily cap and what the Lab keeps are listed', (await page.locator('#coin-history li').count()) >= 1 && /1,800 a day/.test(await page.innerText('.lab-parent')) && /What the Lab keeps/i.test(await page.innerText('.lab-parent')));
    await shot(page, layout, '22-grownups');
    await audit(page, 'grown-ups');
    // switches hide panels
    await page.click('label[for="opt-quests"]'); await page.waitForTimeout(350);
    check('turning quests off hides the Quests and Crate tabs', (await page.locator('.lab-tab[data-view="quests"]:visible').count()) === 0);
    await page.click('label[for="opt-quests"]'); await page.waitForTimeout(300);
    await page.click('label[for="opt-board"]'); await page.click('label[for="opt-goal"]'); await page.waitForTimeout(350);
    check('turning the board and goal off hides the Family tab', (await page.locator('.lab-tab[data-view="family"]:visible').count()) === 0);
    await page.click('label[for="opt-board"]'); await page.click('label[for="opt-goal"]'); await page.waitForTimeout(300);
    // reset with a confirm
    check('the child has coins before the reset', (await view(page)).coins > 0);
    await page.click('#reset-start'); await page.waitForTimeout(250);
    check('Reset asks first ("Yes, reset" / "Keep it")', (await page.locator('#reset-yes').count()) === 1 && (await page.locator('#reset-no').count()) === 1 && (await view(page)).coins > 0);
    await page.click('#reset-no'); await page.waitForTimeout(250);
    check('"Keep it" keeps everything', (await view(page)).coins > 0);
    await page.click('#reset-start'); await page.click('#reset-yes'); await page.waitForTimeout(500);
    const vr = await view(page);
    check('Reset starts this child\'s Lab again (coins 0, level 1, nothing owned beyond the gifts)', vr.coins === 0 && vr.level.level === 1);
    // a wrong PIN
    await clickTab(page, 'home'); await clickTab(page, 'parent');
    check('leaving Grown-ups locks it again', /Enter the parent PIN/.test(await page.textContent('#pin-title')));
    await pin('9999');
    check('a wrong PIN: "That PIN is not right."', /not right/.test(await page.textContent('#pin-err')));
    await pin('1234');
    check('the right PIN opens it', await waitFor(page, '#odds-table'));
  }
  await clickTab(page, 'home');

  // ================= the HUD and the results strip on a fake game page =================
  section(`[${layout}] HUD, results strip, overlay (a fake game page)`);
  if (!fast) {
    await L(page, async () => {
      const { lab } = await import('/lab/src/index.js');
      window.__lab_lab = lab;
      lab.attach({ game: 'tb', playerId: 'mia', name: 'Mia', color: '#ff3b5c' });
      const host = document.createElement('div'); host.id = 'fake-game'; host.style.cssText = 'position:fixed;top:60px;right:10px;z-index:9;width:340px;background:#123;padding:8px';
      host.innerHTML = '<div id="fake-hud"></div><div id="fake-results"></div>';
      document.body.append(host);
      window.__hud = lab.hud({ mount: document.querySelector('#fake-hud'), compact: true });
      window.__res = lab.results({ mount: document.querySelector('#fake-results') });
    });
    await page.waitForTimeout(600);
    check('the Lab pill is in the HUD: "Lv n" and a bar', /^Lv \d+$/.test((await page.textContent('#fake-hud .lab-hud-lv')).trim()) && (await page.locator('#fake-hud .lab-hud-bar').count()) === 1);
    check('the HUD pill shows no coins (coins are for results only)', !/coin|\d{2,}/i.test((await page.innerText('#fake-hud .lab-hud')).trim()));
    const pill = await page.locator('#fake-hud .lab-hud').boundingBox();
    check('the pill is a 44 px target', pill.height >= 43.5 && pill.width >= 43.5, JSON.stringify(pill));
    await L(page, () => { __lab_lab.beginRound('tb'); __lab_lab.report({ game: 'tb', event: 'fact', firstTry: true }); __lab_lab.report({ game: 'tb', event: 'fact', firstTry: true }); });
    await page.waitForTimeout(300);
    check('the flame lights at two first-tries in a row', await page.locator('#fake-hud .lab-hud-flame.on').count() === 1 && !(await page.locator('#fake-hud .lab-hud-flame.big').count()));
    await L(page, () => { __lab_lab.report({ game: 'tb', event: 'fact', firstTry: true }); });
    await page.waitForTimeout(300);
    check('from three it shows "x2"', (await page.textContent('#fake-hud .lab-hud-flame b')) === '\u00d72');
    await L(page, () => { __lab_lab.report({ game: 'tb', event: 'fact', firstTry: false }); });
    await page.waitForTimeout(300);
    check('a miss lets the flame go on its own: no message', (await page.locator('#fake-hud .lab-hud-flame.on').count()) === 0 && !/lost|lose|miss/i.test(await page.innerText('#fake-hud')));
    await shot(page, layout, '23-hud-and-strip');
    const line = (await page.textContent('#lab-strip-line')).trim();
    check('the results strip: "+N Lab coins · N XP to level M · k of 3 quests"', /^\+\d+ Lab coins · \d+ XP to level \d+ · \d of 3 quests$/.test(line), line);
    check('the strip has a chip per quest', (await page.locator('#fake-results .lab-qchip').count()) === 3);
    // level up: banner and shared sound
    await L(page, () => { const s = __lab.store, d = s.doc(), v = s.view(); d.dev[s.device].x += v.level.toNext - 1; s.setOpt('quests', true); __lab_lab.report({ game: 'tb', event: 'race' }); });
    await page.waitForTimeout(500);
    check('a level-up raises one calm banner naming the level', await page.locator('.lab-banner.in').count() === 1 && /Level \d+ · /.test(await page.textContent('.lab-banner.in')));
    await shot(page, layout, '24-level-up-banner');
    await L(page, () => { __lab.store.__test.setQuests(['tb-races', 'tb-facts', 'tb-win']); __lab_lab.report({ game: 'tb', event: 'race' }); __lab_lab.report({ game: 'tb', event: 'win' }); __lab_lab.report({ game: 'tb', event: 'fact', n: 6, firstTry: true }); });
    await page.waitForTimeout(500);
    check('with all three done the strip says "Lab crate!"', await waitFor(page, '#lab-strip-crate', 2000) && /Lab crate!/.test(await page.textContent('#lab-strip-crate')));
    await page.click('#lab-strip-crate'); await page.waitForTimeout(700);
    check('tapping it opens the Lab overlay on the crate', await waitFor(page, '.lab-overlay .lab-shell[data-view="crate"]', 3000));
    await shot(page, layout, '25-overlay-crate');
    await audit(page, 'overlay (crate)');
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    check('Escape goes back Home, then closes the overlay', (await page.getAttribute('.lab-overlay .lab-shell', 'data-view')) === 'home');
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    check('the overlay is gone', (await page.locator('.lab-overlay').count()) === 0);
    // openShop for a game, onClose
    await L(page, () => { window.__closed = false; __lab_lab.openShop({ game: 'bc', onClose: () => { window.__closed = true; } }); });
    check('openShop({ game: "bc" }) opens the Build Crew tab', await waitFor(page, '.lab-overlay .lab-seg-btn.on[data-tab="bc"]', 3000));
    await shot(page, layout, '26-overlay-shop');
    await page.click('.lab-overlay #lab-lead'); await page.waitForTimeout(300);
    await page.click('.lab-overlay #lab-lead'); await page.waitForTimeout(300);
    check('Back goes Home, then Close calls onClose', await L(page, () => window.__closed === true));
    await L(page, () => { window.__hud.destroy(); window.__res.destroy(); document.querySelector('#fake-game').remove(); });
    await L(page, () => { __lab_lab.openParent({ unlocked: true }); });
    check('openParent({ unlocked: true }) skips the PIN (the game\'s own Parent Zone just took it)', await waitFor(page, '.lab-overlay #odds-table', 3000));
    await page.keyboard.press('Escape'); await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    // the welcome strip on the results screen (a fresh Lab; Home is not showing, as in a game)
    await clickTab(page, 'shop');
    await L(page, async () => { __lab.reset(); const { lab } = await import('/lab/src/index.js'); lab.beginRound('tb'); const host = document.createElement('div'); host.id = 'fake-game2'; host.style.cssText = 'position:fixed;top:60px;right:10px;z-index:9;width:340px'; document.body.append(host); lab.report({ game: 'tb', event: 'race' }); window.__res2 = lab.results({ mount: host }); });
    await page.waitForTimeout(600);
    check('the first results strip says "Welcome to the Lab" and calls markWelcome()', /Welcome to the Lab/.test(await page.textContent('#fake-game2 #lab-welcome')) && (await L(page, () => __lab.store.doc().seen.welcome)) > 0);
    await L(page, () => { window.__res2.destroy(); document.querySelector('#fake-game2').remove(); });
  }

  // ================= the voice =================
  if (layout === 'desktop') {
    section(`[${layout}] Voice`);
    const v = await L(page, async () => {
      const { createVoice, splitSay, spoken } = await import('/lab/src/ui/voice.js');
      const { tts } = await import('/spell-jump/src/spelling/tts.js');
      const voice = createVoice();
      const calls = { say: 0, clip: 0 };
      tts.say = async () => { calls.say++; return true; };
      Object.defineProperty(tts, 'available', { get: () => true, configurable: true });
      // a natural voice in use: a fake cloud
      const cloud = voice.cloud, have = new Set();
      Object.defineProperty(cloud, 'active', { get: () => true, configurable: true });
      cloud.server.key = true;
      cloud.has = (t) => have.has(t);
      cloud.prepare = async (list) => { for (const t of list) if (!/NEVER/.test(t)) have.add(t); return { ok: true, error: '', missing: [] }; };
      cloud.play = async () => { calls.clip++; return 'ok'; };
      const a = await voice.say('Lab crate!');
      const b = await voice.say('NEVER prepared line');
      return { a, b, calls, split: splitSay('One. Two. ' + 'x'.repeat(250)).length, spokenLine: spoken('+14 Lab coins · 40 XP to level 7'), log: voice.log };
    });
    check('with a natural voice in use a line plays from its clip', v.a === true && v.calls.clip >= 1, JSON.stringify(v));
    check('a line whose clip could not be made is skipped, never read by the device voice', v.b === false && v.calls.say === 0, JSON.stringify(v));
    check('long lines are cut into clip-sized pieces; the strip reads as sentences', v.split >= 2 && v.spokenLine === 'plus 14 Lab coins. 40 XP to level 7', JSON.stringify(v));
    const lines = await L(page, async () => { const m = await import('/lab/src/core/view.js'); return { fixed: Object.values(m.LAB_LINES).filter((t) => typeof t === 'string'), all: m.collectVoiceTexts().length }; });
    check('LAB_LINES and the quests, items and titles are a finite set to prepare', lines.fixed.length >= 6 && lines.all > 300, JSON.stringify(lines).slice(0, 80));
  }

  // ================= landscape and phone: every view's audit already ran above; the console and the network =================
  section(`[${layout}] Console and network`);
  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('no request left the origin', offOrigin.length === 0, offOrigin.slice(0, 3).join(', '));
  await ctx.close();
}

// ---------- the service worker's file list covers every module ----------
function listJs(dir) { return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? listJs(p) : /\.js$/.test(f) ? [p] : []; }); }
section('Service worker');
{
  const sw = readFileSync(join(ROOT, 'lab/sw.js'), 'utf8');
  const shell = sw.slice(sw.indexOf('const SHELL = ['), sw.indexOf('];', sw.indexOf('const SHELL = [')));
  const listed = new Set([...shell.matchAll(/'([^']+)'/g)].map((m) => m[1]));
  const files = listJs(join(ROOT, 'lab/src')).map((f) => relative(join(ROOT, 'lab'), f).replace(/\\/g, '/'));
  const missing = files.filter((f) => !listed.has(f));
  check('sw.js lists every file under lab/src/', missing.length === 0, missing.join(', '));
  check('sw.js is its own cache ("lab-v...") and never touches the games\'', /const VERSION = 'lab-v/.test(sw) && /const PREFIX = 'lab-'/.test(sw));
  const man = JSON.parse(readFileSync(join(ROOT, 'lab/manifest.webmanifest'), 'utf8'));
  check('the manifest: standalone, scope ./, icons present', man.display === 'standalone' && man.scope === './' && man.icons.length >= 2 && man.icons.every((i) => statSync(join(ROOT, 'lab', i.src)).size > 500));
}

const browser = await chromium.launch();
try {
  for (const name of only) await runLayout(browser, name);
  // ---------- offline after the first load ----------
  if (!process.env.ONLY || process.env.ONLY.includes('desktop')) {
    section('Offline');
    const ctx = await browser.newContext({ viewport: LAYOUTS.desktop, serviceWorkers: 'allow' });
    const page = await ctx.newPage();
    await page.addInitScript((fam) => { if (!localStorage.getItem('spellJump.family')) localStorage.setItem('spellJump.family', JSON.stringify(fam)); }, FAMILY);
    await page.goto(`${BASE}/lab/`);
    await waitFor(page, '.lab-pl-tile');
    const ready = await page.evaluate(async () => { try { const reg = await navigator.serviceWorker.ready; await new Promise((r) => setTimeout(r, 1800)); return !!reg.active; } catch (_) { return false; } });
    check('the service worker is active', ready);
    await page.evaluate(() => new Promise((r) => setTimeout(r, 1500)));
    await ctx.setOffline(true);
    await page.reload();
    check('offline after the first load: the page and the family come back', await waitFor(page, '.lab-pl-tile', 6000));
    await page.click('[data-player="mia"]'); await page.waitForTimeout(500);
    check('offline: a player\'s Home opens', await waitFor(page, '.lab-room-cv', 3000));
    await ctx.close();
  }
} finally { await browser.close(); }

console.log(`\n${passed} passed, ${failed.length} failed`);
console.log(`screenshots: ${SHOTS}`);
if (failed.length) { console.log('FAILED:\n- ' + failed.join('\n- ')); process.exit(1); }
console.log('ALL LAB UI SMOKE CHECKS PASSED');

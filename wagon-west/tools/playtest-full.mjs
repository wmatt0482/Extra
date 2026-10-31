// Wagon West full-journey playtest on the REAL scene (no ?mock=1), as a 4th grader would play it.
// Independence -> the Willamette Valley, all 12 legs, then the results, the journal and the Parent Zone report.
//   BASE_URL=http://localhost:8082 SHOTS_DIR=/some/folder node wagon-west/tools/playtest-full.mjs
// Env: BASE_URL (default http://localhost:8082), SHOTS_DIR (screenshots, default <os tmp>/wagon-west-playtest),
//      DAY_SEC (a trail day in seconds, default 6 = the game's own), MAX_LEGS (stop after N legs), HEADED=1.
//      PORTRAIT=1 (390x844 with iPhone insets), RESUME_STATE=<state-after-leg-N.json> START_LEG=N (carry on from a saved leg;
//      every leg writes one), SEQ_START=<n> (first screenshot number, so a resumed run does not overwrite the first).
// The bot taps and drags the real canvas for the bow, the line, the ford, the float, the Columbia raft and the BRAKE;
// types every answer on the on-screen numpad / keyboard; reads the scene's own debug state only to know WHERE to tap.
// It records findings (layout audit, kid-rule words, console errors, stalls, canvas hit-test) to <SHOTS_DIR>/findings.json,
// the kid-visible text of every distinct screen to texts.json and everything the voice was asked to say to spoken.json.
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = process.env.BASE_URL || 'http://localhost:8082';
const URL0 = BASE + '/wagon-west/index.html?nosw=1';          // no ?mock=1: the real scene
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'wagon-west-playtest');
const DAY_SEC = Number(process.env.DAY_SEC || 6);
const MAX_LEGS = Number(process.env.MAX_LEGS || 12);
const RESUME = process.env.RESUME_STATE || '';       // a state-after-leg-N.json from an earlier run: carry on from leg N+1 (START_LEG = N)
const START_LEG = Number(process.env.START_LEG || 0);
const PORTRAIT = !!process.env.PORTRAIT;             // 390x844 with iPhone insets instead of 844x390 landscape
mkdirSync(SHOTS, { recursive: true });

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`[${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s]`, ...a);

// ---------- state the bot keeps ----------
const findings = [];            // { kind, key, msg, shot }
const texts = {};               // key -> kid-visible text
const seenKeys = new Set();
const toastsSeen = new Set();
const toastScreen = new Map();
const toastStale = new Set();
const popsSeen = new Set();
let seq = Number(process.env.SEQ_START || 0);
let curLeg = 0;
let page = null;
const P = {                     // the plan: how this kid plays
  river: { 'kansas-river': 'ford', 'snake-river': 'float', 'the-dalles': 'ferry' },
  markerMissEvery: 5,           // miss every 5th mile marker (the fix-it flow)
  markerCount: 0,
  spellMissLeft: 2,             // two deliberate spelling misses (a river word, then a letter word)
  ropeMissLeft: 1,
  fordBadTaps: 2,
  stampedeSkipWave: 2,
  storeWorkedAt: new Set(),
  campDone: new Set(),
  specials: new Set(),
};
const note = (kind, key, msg, shot = '') => { findings.push({ kind, key, msg, shot, leg: curLeg + 1 }); log(`  !! [${kind}] ${key}: ${msg}`); };
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x';

// words a kid must never see (SPEC 1) and pressure candidates to read by hand
const BANNED = /\b(kill(s|ed|ing)?|die[sd]?|dying|dead|death|grave|blood|bloody|gun|guns|shoot(s|ing)?|lives|life left|timer|countdown|hurry|time'?s up|seconds? left|game over|lose|lost|fail(ed)?|dysentery|snakebite|starv(e|ing|ed)|sick|disease|cholera|drown(s|ed|ing)?)\b/i;
const PRESSURE = /\b(hurry|hurry up|run(ning)? out|last chance|ticking|clock|deadline|before it'?s too late|time is running|\d+ seconds?|\d+ (tries|chances|guesses) left|wrong|oops|too slow|too late)\b/i;
const TIMER = /\b\d{1,2}:\d{2}\b|\b\d+ ?(secs?|seconds?)\b/i;

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
const ev = (fn, arg) => page.evaluate(fn, arg);

// ---------- looking ----------
const kidText = () => ev(() => {
  const out = [];
  const vis = (el) => { if (el.closest('[hidden]')) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) out.push(c.textContent); else if (c.nodeType === 1 && c.id !== 'pz' && !['SCRIPT', 'STYLE', 'CANVAS'].includes(c.tagName) && vis(c)) { if (c.getAttribute('aria-label')) out.push('[' + c.getAttribute('aria-label') + ']'); walk(c); } } };
  walk(document.querySelector('#app'));
  return out.join(' ').replace(/\s+/g, ' ');
});
async function audit(insets, label, shot) {
  const r = await ev(({ insets }) => {
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
    }
    const natives = [...document.querySelectorAll('input, textarea, select, [contenteditable="true"]')].filter((e) => !e.closest('#pz'));
    const links = [...document.querySelectorAll('a[href]')].filter((a) => new URL(a.href, location.href).origin !== location.origin).map((a) => a.href);
    return { out, natives: natives.map(desc), links };
  }, { insets });
  if (r.out.length) note('layout', label, r.out.slice(0, 5).join('; '), shot);
  if (r.natives.length) note('kid-rule', label, 'native input outside the Parent Zone: ' + r.natives.join(', '), shot);
  if (r.links.length) note('kid-rule', label, 'external link: ' + r.links.join(', '), shot);
}
let INSETS = PORTRAIT ? { t: 47, r: 0, b: 34, l: 0 } : { t: 0, r: 47, b: 21, l: 47 };
/** Screenshot + audits + text capture, once per distinct key (or always with force). */
async function snap(key, { force = false, wait = 180, audits = true } = {}) {
  const k = `L${curLeg}|${key}`;
  if (!force && seenKeys.has(k)) return null;
  seenKeys.add(k);
  await page.waitForTimeout(wait);
  const name = `${String(++seq).padStart(3, '0')}-L${String(curLeg + 1).padStart(2, '0')}-${slug(key)}.png`;
  try { await page.screenshot({ path: path.join(SHOTS, name) }); } catch (e) { note('script', key, 'screenshot failed: ' + e.message); }
  let t = '';
  try { t = await kidText(); } catch (_) { /* ignore */ }
  texts[`${name} :: ${key}`] = t;
  if (/^(marker|problem|spell|letter)/.test(key)) { try { const bl = await ev(() => [...document.querySelectorAll('#panel-marker button, #panel-problem button, #spell button')].filter((b) => b.offsetParent !== null && !b.classList.contains('np-key') && !b.classList.contains('kb-key')).map((b) => b.textContent.trim()).filter(Boolean)); texts[`${name} :: ${key} :: BUTTONS`] = bl; } catch (_) { /* ignore */ } }
  const bad = t.match(BANNED);
  if (bad) note('kid-rule', key, `banned word "${bad[0]}" in: ...${t.slice(Math.max(0, t.search(BANNED) - 60), t.search(BANNED) + 60)}...`, name);
  const tm = t.match(TIMER);
  if (tm) note('kid-rule', key, `timer-like text "${tm[0]}"`, name);
  const pr = t.match(PRESSURE);
  if (pr) note('pressure?', key, `candidate pressure/negative word "${pr[0]}" in: ...${t.slice(Math.max(0, t.search(PRESSURE) - 70), t.search(PRESSURE) + 70)}...`, name);
  if (audits) { try { await audit(INSETS, key, name); } catch (e) { if (!snap.warned) { snap.warned = true; log('  (audit failed once: ' + String(e.message).slice(0, 120) + ')'); } } }
  log(`  shot ${name}`);
  return name;
}

// ---------- reading the app ----------
const W = () => ev(() => {
  const w = window.__wagonWest;
  let sm = null, sstate = null;
  try { const st = w.scene && w.scene.getState && w.scene.getState(); sstate = st; sm = st && st.mini; } catch (_) { /* ignore */ }
  const J = w.save.journey;
  const $ = (s) => document.querySelector(s);
  return {
    screen: w.screen, marker: w.markerPanel.state, mAns: w.markerPanel.answer, mChip: ($('#mk-chip') || {}).textContent || '', mTitle: ($('#mk-title') || {}).textContent || '',
    problem: w.problemPanel.state, pAns: w.problemPanel.answer, pKind: w.problemPanel.problem && w.problemPanel.problem.kind,
    card: w.card.isOpen, cardTitle: w.card.title, cardKicker: ($('#tc-kicker') || {}).textContent || '', cardAlt: !!$('#tc-alt') && !$('#tc-alt').hidden, cardGo: ($('#tc-go') || {}).textContent || '',
    spell: w.spellPanel.isOpen ? w.spellPanel.mode : null, word: w.spellPanel.word, kbOn: !!document.querySelector('#sp-keyboard:not(.is-disabled)'),
    mini: w.mini, sm, backdrop: sstate && sstate.backdrop, travel: w.travel, paused: w.paused, wagonOpen: !$('#panel-wagon').hidden,
    rvChoice: !$('#rv-choice').hidden, rope: w.river.rope, rvRope: !$('#rv-rope').hidden, rvFoot: !$('#rv-foot').hidden, rvPlay: !$('#rv-play').hidden,
    stopOpen: w.peopleUI.isOpen, stopBusy: w.peopleUI.busy, v2play: w.v2.play, poFoot: !$('#po-foot').hidden,
    storeOpen: w.store.isOpen, storeBusy: w.store.busy, campBusy: w.camp && w.camp.busy,
    popCard: !$('#cardpop').hidden ? $('#cardpop').textContent : '', popDeed: !$('#deedpop').hidden ? $('#deedpop').textContent : '',
    toasts: [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent),
    j: J && { legIndex: J.legIndex, legId: J.legId, milesDone: J.milesDone, day: J.day, cash: J.cash, food: J.food, tokens: J.tokens, rations: J.rations, pace: J.pace, goods: J.goods && { ...J.goods }, animals: J.animals && { ...J.animals }, foods: J.foods && { ...J.foods }, done: J.done, limp: J.limp, deeds: (J.deeds || []).length, cards: Array.isArray(J.cards) ? J.cards.length : 0, met: (J.met || []).length },
  };
});
const idle = (s) => s.screen === 'trail' && s.marker === 'closed' && s.problem === 'closed' && !s.card && !s.mini && !s.sm && s.travel && !s.travel.busy && !s.paused && !s.wagonOpen;

async function typeDigits(root, digits) {
  for (const d of String(digits)) await page.click(`${root} .np-key[data-key="${d}"]`, { timeout: 4000 });
  await page.click(`${root} .np-key[data-key="go"]`, { timeout: 4000 });
}
async function typeWord(word) {
  for (const ch of word) await page.click(`#sp-keyboard .kb-key[data-key="${ch === ' ' ? 'space' : ch}"]`, { timeout: 4000 });
  await page.click('#sp-keyboard .kb-enter', { timeout: 4000 });
}
async function dragRope(v) {
  const pts = await ev((v) => {
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

// ---------- the scene's mini-games, played with real pointer input ----------
const mouse = { down: false };
async function canvasBox() {
  return ev(() => { const r = document.querySelector('#scene').getBoundingClientRect(); const i = window.__wagonWest.scene.debugInfo(); return { l: r.left, t: r.top, w: r.width, h: r.height, W: i.W, H: i.H }; });
}
const toPage = (c, x, y) => [c.l + (x * c.w) / c.W, c.t + (y * c.h) / c.H];
/** Is the canvas really what a finger would hit at (px, py)? (a covering overlay would swallow the kid's tap) */
async function hitIsCanvas(px, py) {
  return ev(([x, y]) => { const e = document.elementFromPoint(x, y); return { ok: !!e && e.id === 'scene', what: e ? (e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + (e.className || '')) : 'nothing' }; }, [px, py]);
}
const miniMeta = { tapChecked: new Set(), stampedeTaps: 0, fordBad: 0, fishEarly: 0, huntMiss: 0, shotsSeen: new Set(), lastShot: 0 };
async function releaseMouse() { if (mouse.down) { try { await page.mouse.up(); } catch (_) { /* ignore */ } mouse.down = false; } }
async function sceneMiniStep(s) {
  const m = await ev(() => { const sc = window.__wagonWest.scene; return sc && sc.debugMini ? sc.debugMini() : null; });
  if (!m) { await releaseMouse(); return false; }
  const c = await canvasBox();
  const checkTap = async (px, py, what) => {
    const k = what + ':' + curLeg;
    if (miniMeta.tapChecked.has(k)) return;
    miniMeta.tapChecked.add(k);
    const h = await hitIsCanvas(px, py);
    if (!h.ok) note('blocks play', what, `a tap at (${Math.round(px)}, ${Math.round(py)}) lands on ${h.what}, not the canvas: the ${what} cannot be played by touch there`, '');
  };
  if (m.kind === 'hunt') {
    if (!miniMeta.shotsSeen.has('hunt' + curLeg + ':' + s.j.day)) { miniMeta.shotsSeen.add('hunt' + curLeg + ':' + s.j.day); await snap(`hunt-start`, { force: true, wait: 700 }); }
    if (m.arrows > 0 || m.left <= 0) return true;
    const alive = m.animals.filter((a) => a.state === 'run' && a.x > 40 && a.x < c.W - 40);
    if (!alive.length) return true;
    miniMeta.huntMiss++;
    let tx, ty;
    if (miniMeta.huntMiss === 2) { tx = c.W * 0.5; ty = c.H * 0.4; }       // a kid's wild tap at the sky
    else { const a = alive.sort((p, q) => Math.abs(p.x - c.W / 2) - Math.abs(q.x - c.W / 2))[0]; tx = a.x + a.dir * 25; ty = a.y; }
    const [px, py] = toPage(c, tx, ty);
    { const h = await hitIsCanvas(px, py); if (!h.ok) { miniMeta.huntBlocked = (miniMeta.huntBlocked || 0) + 1; if (miniMeta.huntBlocked <= 3) note('wrong', 'bow (hunt)', `a tap on an animal at (${Math.round(px)}, ${Math.round(py)}) lands on ${h.what} instead of the canvas (the hunt bar covers the low lane); the arrow is never loosed`, await snap('hunt-blocked-tap', { force: true, wait: 50 })); } }
    await page.touchscreen.tap(px, py);
    if (miniMeta.huntMiss === 3) await snap('hunt-arrow-flight', { force: true, wait: 120 });
    await page.waitForTimeout(350);
    return true;
  }
  if (m.kind === 'fish') {
    if (!miniMeta.shotsSeen.has('fish' + curLeg + ':' + s.j.day)) { miniMeta.shotsSeen.add('fish' + curLeg + ':' + s.j.day); await snap('fish-start', { force: true, wait: 700 }); }
    const [px, py] = toPage(c, c.W * 0.5, c.H * 0.7);
    if (m.phase === 'wait' && miniMeta.fishEarly < 1 && m.pt > 0.5) { miniMeta.fishEarly++; await checkTap(px, py, 'line (fish)'); await page.touchscreen.tap(px, py); await snap('fish-early-tap', { force: true, wait: 120 }); await page.waitForTimeout(400); return true; }
    if (m.phase === 'bite') { await checkTap(px, py, 'line (fish)'); await page.touchscreen.tap(px, py); await snap('fish-bite', { force: true, wait: 100 }); await page.waitForTimeout(500); return true; }
    return true;
  }
  if (m.kind === 'ford') {
    await snap('ford-play', { wait: 900 });
    if (m.ready) {
      const wantBad = miniMeta.fordBad < P.fordBadTaps && !m.calm && s.j.legId === 'kansas-river';
      if (m.calm || wantBad) {
        if (wantBad) miniMeta.fordBad++;
        const [px, py] = toPage(c, c.W * 0.5, c.H * 0.5);
        await checkTap(px, py, 'ford');
        await page.touchscreen.tap(px, py);
        if (wantBad) await snap('ford-swell-tap', { force: true, wait: 150 });
        await page.waitForTimeout(150);
      }
    }
    return true;
  }
  if (m.kind === 'stampede') {
    await snap('stampede-play', { wait: 1200 });
    if (m.cue) {
      const wave = m.wave;
      if (wave === P.stampedeSkipWave) { await snap('stampede-cue-skipped', { force: true, wait: 50 }); await page.waitForTimeout(1900); return true; }
      const [px, py] = toPage(c, c.W * 0.5, c.H * 0.5);
      await checkTap(px, py, 'stampede brake');
      await snap(`stampede-brake-cue-w${wave}`, { force: true, wait: 30 });
      await page.touchscreen.tap(px, py);
      await page.waitForTimeout(500);
    }
    return true;
  }
  if (m.kind === 'float' || m.kind === 'raft') {
    await snap(`${m.kind}-play`, { wait: 1200 });
    if (m.kind === 'raft' && m.waiting) { return true; }       // the bend's marker panel answers, then the app calls raftGo
    const lazy = m.kind === 'float';                            // the Snake River float: the kid does not steer (a bump costs nothing with rope)
    if (lazy) { await releaseMouse(); return true; }
    if (m.phase !== 'drift' && m.phase !== 'ready') return true;
    const a = Math.min(1, m.a + 0.05), f = a * 20, i = Math.min(19, Math.floor(f));
    const u = m.route[i] + (m.route[i + 1] - m.route[i]) * (f - i);
    const [px, py] = toPage(c, m.x0 + u * m.chan, m.y);
    if (!mouse.down) {
      const [sx, sy] = toPage(c, m.x, m.y);
      await checkTap(sx, sy, `${m.kind} steering`);
      await page.mouse.move(sx, sy); await page.mouse.down(); mouse.down = true;
    }
    await page.mouse.move(px, py);
    return true;
  }
  if (m.kind === 'derby') {
    await snap('derby-race-m' + m.markers, { wait: 500 });
    return true;
  }
  return false;
}

// ---------- the general store ----------
const storeState = { leg: -1, bought: false, worked: false, derby: false };
async function jq() { return (await W()).j; }
async function storeRoutine(s) {
  const legIx = s.j.legIndex;
  if (storeState.leg !== legIx || s.screen !== 'store') { if (storeState.leg !== legIx) Object.assign(storeState, { leg: legIx, bought: false, worked: false, derby: false, tries: 0 }); }
  await snap(`store-${s.j.legId}`, { wait: 400 });
  const buy = async (good) => {
    const ok = await ev((g) => { const b = document.querySelector(`.st-good[data-good="${g}"]`); if (!b || b.disabled) return false; b.click(); return true; }, good);
    if (ok) await page.waitForTimeout(220);
    return ok;
  };
  if (!storeState.bought) {
    storeState.bought = true;
    const hint = await ev(() => (document.querySelector('#store-hint') || {}).textContent || '');
    const need = Number((hint.match(/about ([\d,]+) lb/) || [])[1]?.replace(/,/g, '')) || 400;
    log(`  store ${s.j.legId}: ${hint} | cash $${s.j.cash} food ${Math.round(s.j.food)}`);
    // a kid's list: food for the road first, then the odds and ends in the order they read about them
    const wants = { rope: 1, blankets: legIx >= 3 ? 4 : 0, arrows: 2, parts: legIx === 0 ? 0 : 1 };
    for (let n = 0; n < 40; n++) {
      const j = await jq();
      const g = j.goods || {};
      if (j.food < need * 1.1) {
        const order = ['flour', 'bacon', 'beans'];
        let did = false;
        for (const f of order) { if (await buy(f)) { did = true; break; } }
        if (did) continue;
        break;
      }
      let did = false;
      for (const [k, want] of Object.entries(wants)) { if ((g[k] || 0) < want && await buy(k)) { did = true; break; } }
      if (!did && legIx >= 1 && !(j.animals && j.animals.n >= 4) && j.cash > 120 && await buy('yoke')) did = true;
      if (!did) break;
    }
    await snap(`store-${s.j.legId}-after-buying`, { force: true, wait: 250 });
  }
  if (!storeState.worked && !P.storeWorkedAt.has(legIx)) {
    P.storeWorkedAt.add(legIx); storeState.worked = true;
    const g = legIx % 2 === 0 ? 'flour' : 'beans';
    const clicked = await ev((g) => { const b = document.querySelector(`.st-work[data-good="${g}"]`); if (!b || b.disabled) return false; b.click(); return true; }, g);
    if (clicked) return 'work-it-out';
  }
  if (!storeState.derby) {
    const has = await ev(() => { const b = document.querySelector('#store-derby'); return !!b && !b.disabled; });
    if (has) { storeState.derby = true; await snap('store-derby-button', { force: true }); await ev(() => document.querySelector('#store-derby').click()); return 'derby'; }
  }
  await snap(`store-${s.j.legId}-ready-to-leave`, { force: true, wait: 200 });
  await ev(() => document.querySelector('#store-done').click());
  return 'store-done';
}

// ---------- one step of "play whatever is on the screen" ----------
let inStop = false;
let inTitleTour = false;
let lastKey = '', lastChange = Date.now();
async function step(plan = {}) {
  const s = await W();
  // popups and toasts: look at each new one
  if (s.popCard && !popsSeen.has(s.popCard)) { popsSeen.add(s.popCard); await snap(`cardpop-${s.popCard.slice(0, 24)}`, { force: true, wait: 80 }); }
  if (s.popDeed && !popsSeen.has(s.popDeed)) { popsSeen.add(s.popDeed); await snap(`deedpop-${s.popDeed.slice(0, 24)}`, { force: true, wait: 80 }); }
  for (const t of s.toasts) { if (!toastScreen.has(t)) toastScreen.set(t, { screen: s.screen, at: Date.now() }); else if (toastScreen.get(t).screen !== s.screen && Date.now() - toastScreen.get(t).at > 6500 && !toastStale.has(t)) { toastStale.add(t); note('ugly', `toast on ${s.screen}`, `a toast from the ${toastScreen.get(t).screen} screen is still showing ${Math.round((Date.now() - toastScreen.get(t).at) / 1000)} s later on the ${s.screen} screen: "${t.slice(0, 70)}"`, await snap(`stale-toast-${s.screen}`, { force: true, wait: 30 })); } }
  for (const k of [...toastScreen.keys()]) if (!s.toasts.includes(k)) toastScreen.delete(k);
  for (const t of s.toasts) if (!toastsSeen.has(t)) { toastsSeen.add(t); if (toastsSeen.size <= 60) await snap(`toast-${t.slice(0, 28)}`, { force: true, wait: 30 }); }
  const key = [s.screen, s.card && s.cardTitle, s.marker, s.problem, s.spell, s.sm && s.sm.kind, s.mini && s.mini.kind, s.j && s.j.milesDone, s.rvChoice, s.stopOpen].join('|');
  if (key !== lastKey) { lastKey = key; lastChange = Date.now(); }
  if (plan.onEach) { const r = await plan.onEach(s); if (r) return r; }

  if (s.card) {
    await snap(`card-${s.cardTitle}`);
    // choices the plan makes at certain cards
    let alt = false;
    if (s.cardTitle === 'Make camp tonight?' && !P.campDone.has(curLeg) && [1, 3, 8].includes(curLeg)) { alt = true; P.campDone.add(curLeg); }
    if (s.cardAlt && /dog|friend/i.test(s.cardTitle)) alt = false;
    await ev((alt) => { const b = alt ? document.querySelector('#tc-alt') : document.querySelector('#tc-go'); if (b) b.click(); }, alt);
    await page.waitForTimeout(120);
    return 'card';
  }
  if (s.marker === 'ask') {
    const real = /^Marker \d+ of \d+$/.test(s.mChip) && s.mTitle === 'Mile marker';
    await snap(`marker-ask-${s.mTitle}-${s.mChip}`.slice(0, 50));
    let miss = false;
    if (real) { P.markerCount++; miss = P.markerCount % P.markerMissEvery === 0; }
    await typeDigits('#panel-marker', miss ? s.mAns + 1 : s.mAns);
    await page.waitForTimeout(100);
    if (miss) { await snap('marker-after-miss', { force: true, wait: 250 }); }
    return 'marker';
  }
  if (s.marker === 'show') { await snap('marker-show-work', { wait: 400 }); await page.waitForTimeout(250); return 'wait'; }
  if (s.marker === 'copy') { await snap('marker-cover-copy'); await typeDigits('#panel-marker', s.mAns); return 'marker-copy'; }
  if (s.marker === 'right') { await snap('marker-right', { wait: 60 }); await page.waitForTimeout(120); return 'wait'; }
  if (s.problem === 'ask') { await snap(`problem-${s.pKind}`); await typeDigits('#panel-problem', s.pAns); return 'problem'; }
  if (s.problem === 'work') { await snap('problem-work', { wait: 500 }); await page.waitForTimeout(200); return 'wait'; }
  if (s.problem === 'copy') { await snap('problem-copy'); await typeDigits('#panel-problem', s.pAns); return 'problem-copy'; }
  if (s.problem === 'right' || s.problem === 'show') { await page.waitForTimeout(150); return 'wait'; }
  if (s.spell && ['write', 'cover', 'copy'].includes(s.spell) && s.kbOn && s.word) {
    await snap(`spell-${s.screen}-${s.spell}`);
    let w = s.word;
    if (s.spell === 'write' && P.spellMissLeft > 0 && /^[a-z]{5,}$/i.test(w)) { P.spellMissLeft--; w = w.slice(0, -2) + w.slice(-1) + w.slice(-2, -1); await typeWord(w); await snap(`spell-after-miss-${s.screen}`, { force: true, wait: 400 }); return 'spell-miss'; }
    await typeWord(w);
    return 'spell';
  }
  if (s.screen === 'dog') {
    await snap('dog-name');
    await page.click('#dog-coats [data-coat="spotted"]');
    for (const k of 'biscuit') await page.click(`#dog-keyboard .kb-key[data-key="${k}"]`);
    await snap('dog-name-typed', { force: true });
    await page.click('#dog-keyboard .kb-enter');
    return 'dog';
  }
  if (s.appMini || s.mini || s.sm) {
    const did = await sceneMiniStep(s);
    if (s.mini && !s.sm) {                  // the app's own hunt/fish bar: the scene state decides; nothing else to do
      await page.waitForTimeout(60);
    }
    if (did) return 'mini';
  } else await releaseMouse();
  if (s.screen === 'river' && s.rvChoice) {
    await snap(`river-choice-${s.j.legId}`, { wait: 500 });
    const how = P.river[s.j.legId] || 'ferry';
    await page.click(`#rv-opts .rv-opt[data-how="${how}"]`);
    return 'river-choice';
  }
  if (s.screen === 'river' && s.rvRope && s.rope && !s.rope.done && !s.rope.flying) {
    await snap('river-rope-toss', { wait: 400 });
    const f = s.rope.f.n / s.rope.f.d;
    let aim = f;
    if (P.ropeMissLeft > 0) { P.ropeMissLeft--; aim = Math.min(1, Math.max(0, f + (f > 0.5 ? -0.28 : 0.28))); }
    await dragRope(aim);
    await snap('river-rope-aimed', { force: true, wait: 100 });
    await page.click('#rv-throw');
    await page.waitForTimeout(300);
    await snap('river-rope-thrown', { force: true, wait: 800 });
    return 'rope';
  }
  if (s.screen === 'river' && s.rvPlay) { await snap('river-play-status', { wait: 600 }); await page.waitForTimeout(150); return 'wait'; }
  if (s.screen === 'river' && s.rvFoot) { await snap('river-across', { wait: 400 }); await page.click('#rv-go'); return 'river-go'; }
  if (s.screen === 'river') { await snap('river-misc', { wait: 300 }); return null; }
  if (s.screen === 'stop' && s.stopOpen && !s.stopBusy && !s.v2play && !inStop) {
    inStop = true;
    try {
    await snap(`stop-${s.j.legId}-talk-row`, { wait: 500 });
    const people = await ev(() => [...document.querySelectorAll('#stop-row .stop-person')].map((b) => b.dataset.person));
    for (const p of people) {
      await snap(`stop-${s.j.legId}-before-${p}`, { force: true, wait: 100 });
      await ev((p) => { const b = document.querySelector(`#stop-row .stop-person[data-person="${p}"]`); if (b && !b.disabled) b.click(); }, p);
      await settle();
      await snap(`stop-${s.j.legId}-after-${p}`, { force: true, wait: 300 });
    }
    await page.click('#stop-go');
    } finally { inStop = false; }
    return 'stop-go';
  }
  if (s.screen === 'post' && s.poFoot) { await snap('letter-done', { wait: 500 }); await page.click('#po-go'); return 'post-go'; }
  if (s.screen === 'post') { await snap('post-office', { wait: 300 }); return null; }
  if (s.screen === 'store' && s.storeOpen && !s.storeBusy) return await storeRoutine(s);
  if (s.screen === 'home') {
    await snap('home-name-your-homestead', { wait: 400 });
    for (const k of 'sunny acres') await page.click(`#hs-keyboard .kb-key[data-key="${k === ' ' ? 'space' : k}"]`);
    await snap('home-name-typed', { force: true });
    await page.click('#hs-keyboard .kb-enter');
    return 'home';
  }
  if (s.screen === 'camp') return null;
  // the title in the middle of a journey (after a results / journal / outfit visit): "Hit the trail" / "Keep going"
  if (s.screen === 'title' && s.j && !inTitleTour) { await snap('title-on-the-way', { wait: 500 }); await page.waitForTimeout(300); await ev(() => document.querySelector('#btn-trail').click()); return 'title-go'; }
  return null;
}
/** Let any panels/cards finish (used after a click that opens something). */
async function settle(maxMs = 20000) {
  const end = Date.now() + maxMs;
  let quiet = 0;
  while (Date.now() < end) {
    const r = await step();
    if (r && r !== 'wait') quiet = 0; else quiet++;
    const s = await W();
    const busy = s.card || s.marker !== 'closed' || s.problem !== 'closed' || s.spell || s.mini || s.sm || s.stopBusy;
    if (!busy && quiet >= 3) return;
    await page.waitForTimeout(80);
  }
}
async function playUntil(until, plan = {}, timeout = 240000, label = '') {
  const end = Date.now() + timeout;
  let stalls = 0;
  lastChange = Date.now();
  while (Date.now() < end) {
    const s = await W();
    if (await until(s)) return s;
    const r = await step(plan);
    if (Date.now() - lastChange > 50000) {
      stalls++;
      const shot = await snap(`STALL-${label}-${stalls}`, { force: true });
      note('blocks play', `${label} stall`, `nothing changed for 50 s at ${JSON.stringify({ screen: s.screen, card: s.card && s.cardTitle, marker: s.marker, problem: s.problem, spell: s.spell, sm: s.sm && s.sm.kind, mini: s.mini, miles: s.j && s.j.milesDone })}`, shot);
      lastChange = Date.now();
      if (stalls >= 3) throw new Error('stalled 3 times at ' + label);
      await page.keyboard.press('Escape').catch(() => {});
    }
    if (!r) await page.waitForTimeout(90);
  }
  throw new Error('timeout in ' + label + ' ' + JSON.stringify(await W()).slice(0, 300));
}

// ---------- the special things the plan does on particular legs ----------
async function onTrailIdle(s) {
  const L = curLeg;
  const once = (k) => { if (P.specials.has(k)) return false; P.specials.add(k); return true; };
  const miles = s.j.milesDone;
  if (L === 0 && miles > 25 && once('hud-tour')) {
    if (!idle(await W())) { P.specials.delete('hud-tour'); return null; }
    await snap('trail-hud', { force: true, wait: 400 });
    // pace and rations: a kid pokes the dials
    await ev(() => { document.querySelector('#dial-pace [data-pace="brisk"]').click(); });
    await page.waitForTimeout(250);
    await ev(() => { document.querySelector('#dial-rations [data-rations="lean"]').click(); });
    await page.waitForTimeout(400);
    await snap('trail-brisk-lean', { force: true });
    // the Wagon panel from the food box
    await ev(() => document.querySelector('#hud-food-box').click());
    const wopen = await page.waitForSelector('#panel-wagon:not([hidden])', { timeout: 2500 }).then(() => true, () => false);
    if (!wopen) { await settle(); P.specials.delete('hud-tour'); P.tourTries = (P.tourTries || 0) + 1; if (P.tourTries >= 3) note('wrong', 'wagon panel', 'tapping the food box did not open the Wagon panel (3 tries)'); return 'tour-retry'; }
    await snap('wagon-panel', { force: true, wait: 600 });
    await ev(() => { const b = document.querySelector('#wg-body'); if (b) b.scrollTop = 9999; });
    await snap('wagon-panel-scrolled', { force: true, wait: 300 });
    await ev(() => document.querySelector('#wg-close').click());
    await page.waitForTimeout(300);
    // Ask Eli
    const eli = await ev(() => { const b = document.querySelector('#btn-eli'); return b && !b.hidden; });
    if (eli) { await snap('trail-ask-eli-button', { force: true }); await ev(() => document.querySelector('#btn-eli').click()); await settle(); }
    else note('nit', 'trail HUD', 'the "Ask Eli: how many days?" button was not offered on leg 1 at mile ' + miles);
    // pause sheet
    await ev(() => document.querySelector('#btn-pause').click());
    await page.waitForSelector('#panel-pause:not([hidden])', { timeout: 3000 }).catch(() => {});
    await snap('pause-sheet', { force: true, wait: 400 });
    await ev(() => document.querySelector('#pause-resume').click());
    await page.waitForTimeout(300);
    // back to full rations, steady
    await ev(() => { document.querySelector('#dial-rations [data-rations="plenty"]').click(); document.querySelector('#dial-pace [data-pace="steady"]').click(); });
    return 'hud-tour';
  }
  if (L === 1 && miles > 30 && once('stampede')) { await snap('before-stampede', { force: true }); await ev(() => window.__wagonWest.app && window.__wagonWest.playEvent('stampede')); await settle(90000); return 'stampede'; }
  if (L === 1 && miles > 70 && once('hunt-event')) { await ev(() => window.__wagonWest.playEvent('hunt')); await settle(90000); return 'hunt'; }
  if (L === 1 && miles > 110 && once('trade-event')) { await ev(() => window.__wagonWest.playEvent('trade')); await settle(60000); return 'trade'; }
  if (L === 2 && miles > 30 && once('axle')) { await ev(() => window.__wagonWest.playEvent('axle')); await settle(40000); await snap('after-breakdown', { force: true }); return 'axle'; }
  if (L === 2 && miles > 70 && once('fish-event')) { await ev(() => window.__wagonWest.playEvent('fish')); await settle(60000); return 'fish'; }
  if (L === 3 && miles > 25 && once('camp-tour')) { return await campTour(['fish', 'hunt', 'cards', 'tales', 'rest']); }
  if (L === 4 && miles > 40 && once('storm-forecast')) { await ev(() => window.__wagonWest.playEvent('storm')); await settle(60000); return 'storm'; }
  if (L === 5 && miles > 40 && once('snow')) { await ev(() => window.__wagonWest.playEvent('snow')); await settle(60000); return 'snow'; }
  if (L === 7 && miles > 30 && once('pause-camp-stop')) { return await pauseCampStop(); }
  if (L === 9 && miles > 30 && once('dog-berries')) { const r = await ev(() => window.__wagonWest.dogBerries()); if (r) await settle(40000); return 'dog-berries'; }
  return null;
}
async function campTour(acts) {
  await snap('before-camp', { force: true });
  await ev(() => document.querySelector('#btn-camp').click());
  await page.waitForSelector('#screen-camp:not([hidden])', { timeout: 5000 }).catch(() => note('wrong', 'camp', 'the Camp button did not open camp'));
  await snap('camp-menu', { force: true, wait: 800 });
  for (const a of acts) {
    const has = await ev((a) => { const b = document.querySelector(`.camp-act[data-act="${a}"]`); return !!b && !b.disabled; }, a);
    if (!has) { note('nit', 'camp', `camp activity "${a}" not offered/enabled here`); continue; }
    await ev((a) => document.querySelector(`.camp-act[data-act="${a}"]`).click(), a);
    await page.waitForTimeout(300);
    await playUntil(async (s) => s.screen === 'camp' && !s.card && s.marker === 'closed' && s.problem === 'closed' && !s.mini && !s.sm && !s.campBusy, {}, 120000, 'camp-' + a);
    await snap(`camp-after-${a}`, { force: true, wait: 400 });
  }
  const j = await jq();
  log(`  camp done: day ${j.day} tokens ${j.tokens}`);
  await ev(() => document.querySelector('#camp-back').click());
  await page.waitForSelector('#screen-trail:not([hidden])', { timeout: 5000 });
  return 'camp-tour';
}
async function pauseCampStop() {
  await ev(() => document.querySelector('#btn-camp').click());
  await page.waitForSelector('#screen-camp:not([hidden])', { timeout: 5000 });
  await snap('camp-stop-for-today', { force: true });
  await page.click('#camp-stop');
  const ok = await page.waitForSelector('#screen-title:not([hidden])', { timeout: 4000 }).then(() => true, () => false);
  if (!ok) {
    const st = await ev(() => { const w = window.__wagonWest; return { screen: w.screen, campOpen: w.camp.isOpen, campBusy: w.camp.busy, stopDisabled: document.querySelector('#camp-stop').disabled }; });
    note('blocks play', 'camp', 'tapping "Stop for today" in Camp did not go to the title: ' + JSON.stringify(st), await snap('camp-stop-did-nothing', { force: true }));
    await ev(() => document.querySelector('#camp-back').click());
    await page.waitForSelector('#screen-trail:not([hidden])', { timeout: 5000 }).catch(() => {});
    return 'camp-stop-failed';
  }
  await snap('title-mid-leg-keep-going', { force: true, wait: 500 });
  inTitleTour = true;
  await titleExtras();
  inTitleTour = false;
  await ev(() => document.querySelector('#btn-trail').click());
  await page.waitForSelector('#screen-trail:not([hidden])', { timeout: 5000 });
  return 'stopped-and-resumed';
}

// ---------- title extras: the daily challenge, the journal, upgrades ----------
async function titleExtras() {
  const ch = await ev(() => { const e = document.querySelector('#title-challenge'); return e && !e.hidden ? { text: e.textContent, done: e.dataset.done } : null; });
  log('  daily challenge:', JSON.stringify(ch));
  if (!ch) note('wrong', 'title', "no daily challenge shown on the title (SPEC v1.1: 'Today's challenge')");
  await snap('title-challenge', { force: true });
  const fam = await ev(() => document.querySelectorAll('#title-map .map-wagon, #title-map .fam-wagon').length);
  log('  map wagons:', fam);
}
async function journalTour() {
  await ev(() => { const vis = (e) => e && e.offsetParent !== null; const b = [document.querySelector('#res-journal'), document.querySelector('#btn-journal')].find(vis); if (b) b.click(); });
  await page.waitForSelector('#screen-journal:not([hidden])', { timeout: 5000 });
  const tabs = await ev(() => [...document.querySelectorAll('#jr-tabs [data-page]')].map((b) => b.dataset.page));
  log('  journal tabs:', tabs.join(','));
  for (const t of tabs) {
    await ev((t) => document.querySelector(`#jr-tabs [data-page="${t}"]`).click(), t);
    await snap(`journal-${t}`, { force: true, wait: 500 });
    await ev(() => { const b = document.querySelector('#jr-body'); if (b) b.scrollTop = b.scrollHeight; });
    await snap(`journal-${t}-scrolled`, { force: true, wait: 300, audits: false });
    if (t === 'cards') {
      const first = await ev(() => { const b = document.querySelector('.cards-grid button.tcard'); return b ? b.dataset.card : null; });
      if (first) { await ev((c) => document.querySelector(`.cards-grid button.tcard[data-card="${c}"]`).click(), first); await snap('journal-cards-flipped', { force: true, wait: 700 }); }
    }
  }
  await ev(() => document.querySelector('#screen-journal [data-back]').click());
  await page.waitForTimeout(400);
}
async function outfitUpgrades() {
  await ev(() => document.querySelector('#btn-outfit').click());
  await page.waitForSelector('#screen-outfit:not([hidden])', { timeout: 5000 });
  await snap('outfit-reopened', { force: true, wait: 500 });
  const hasWagon = await ev(() => !!document.querySelector('[data-pane="wagon"]'));
  if (hasWagon) {
    await ev(() => document.querySelector('[data-pane="wagon"]').click());
    await page.waitForSelector('.ow-up', { timeout: 4000 }).catch(() => {});
    await snap('outfit-upgrades', { force: true, wait: 500 });
    const tk = (await jq()).tokens;
    const bought = await ev(() => { const bs = [...document.querySelectorAll('[data-upgrade$=":tokens"]')].filter((b) => !b.disabled); if (bs.length) { bs[0].click(); return bs[0].dataset.upgrade; } return null; });
    log(`  upgrades: tokens ${tk}, bought ${bought}`);
    if (bought) await snap('outfit-upgrade-bought', { force: true, wait: 500 });
  } else note('wrong', 'outfit (reopened)', 'no Wagon pane for upgrades in Outfit after the journey started');
  await ev(() => { const n = document.querySelector('#ow-next'); if (n) n.click(); });
  await page.waitForSelector('#screen-title:not([hidden])', { timeout: 5000 }).catch(async () => { await ev(() => { const b = document.querySelector('#screen-outfit [data-back]'); if (b) b.click(); }); });
}

// ---------- the main run ----------
async function main() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: !process.env.HEADED });
  const ctx = await browser.newContext({ viewport: PORTRAIT ? { width: 390, height: 844 } : { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...(RESUME ? { storageState: RESUME } : {}) });
  await routeFonts(ctx);
  page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text() + (m.location().url || ''))) { errors.push(m.text()); note('console', `leg ${curLeg + 1}`, 'console error: ' + m.text().slice(0, 220)); } });
  page.on('pageerror', (e) => { errors.push(e.message); note('console', `leg ${curLeg + 1}`, 'page error: ' + e.message.slice(0, 220)); });
  page.on('requestfailed', (r) => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) note('console', 'network', 'request failed: ' + r.url().slice(0, 140)); });
  await page.addInitScript(({ insets, daySec, resume }) => {
    if (!sessionStorage.getItem('wwSeeded')) { if (!resume) localStorage.clear(); sessionStorage.setItem('wwSeeded', '1'); }
    window.__wwScript = { daySec, beat: 1 };
    window.__spoken = [];
    window.__ttsBackend = {
      speaking: false, pending: false,
      getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 120 + String(u.text).length * 6); },
      cancel() {}, addEventListener() {},
    };
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(st);
    });
  }, { insets: INSETS, daySec: DAY_SEC, resume: !!RESUME });

  try {
    await page.goto(URL0, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const sceneName = await ev(() => window.__wagonWest.app.sceneName);
    log('scene:', JSON.stringify(sceneName), '(empty = the real scene)');
    if (sceneName) note('script', 'boot', `the app fell back to "${sceneName}", not the real scene`);

    if (RESUME) {
      await page.waitForSelector('#screen-players:not([hidden])');
      await page.click('[data-player]');
      await page.waitForSelector('#screen-title:not([hidden])');
      await page.click('#btn-trail');
    } else {
    // ---- picker + new player ----
    await page.waitForSelector('#screen-players:not([hidden])');
    await snap('players');
    await page.click('#pl-add');
    await page.waitForSelector('#screen-newplayer:not([hidden])');
    await snap('newplayer');
    for (const k of 'ava') await page.click(`#np-keyboard .kb-key[data-key="${k}"]`);
    await snap('newplayer-typed', { force: true });
    await page.click('#np-keyboard .kb-enter');
    await page.waitForSelector('#screen-title:not([hidden])');
    await snap('title-first', { wait: 600 });

    // ---- outfit ----
    await page.click('#btn-trail');
    await page.waitForSelector('#screen-outfit:not([hidden])');
    await snap('outfit-name');
    for (const k of 'sunny') await page.click(`#ow-keyboard .kb-key[data-key="${k}"]`);
    await page.click('#ow-keyboard .kb-enter');
    await page.waitForSelector('.ow-animal');
    await snap('outfit-animal');
    await page.click('.ow-animal[data-animal="oxen"]');
    await snap('outfit-animal-picked', { force: true, wait: 300 });
    await page.click('#ow-next');
    await page.waitForSelector('.ow-comp');
    const comps = await ev(() => [...document.querySelectorAll('.ow-comp')].map((b) => b.dataset.companion));
    // a kid picks the ones that sound fun: scout, cook, fiddler if present
    const pick = ['scout', 'cook', 'fiddler'].filter((c) => comps.includes(c));
    for (const id of pick.length === 3 ? pick : comps.slice(0, 3)) await page.click(`.ow-comp[data-companion="${id}"]`);
    await snap('outfit-party', { wait: 400 });
    await page.click('#ow-next');
    await page.waitForSelector('.ow-looks');
    await snap('outfit-look', { wait: 400 });
    await page.click('#ow-next');

    }

    // ---- the 12 legs ----
    for (let L = START_LEG; L < MAX_LEGS; L++) {
      curLeg = L;
      miniMeta.fordBad = miniMeta.fordBad;       // (kept across legs on purpose)
      log(`===== leg ${L + 1} =====`);
      if (L > 0) {
        // between legs: the results screen is up; look at it, then go on (title visits at a few points)
        // (handled at the end of the previous iteration)
      }
      const plan = { onEach: async (s) => { if (idle(s) && s.j) { try { const r = await onTrailIdle(s); if (r) return r; } catch (e) { note('script', 'special', 'a scripted detour failed: ' + String(e.message).slice(0, 200), await snap('special-failed', { force: true }).catch(() => '')); } } return null; } };
      // the first leg starts in the Independence store; later legs start on the trail
      const res = await playUntil((s) => s.screen === 'results', plan, 420000, `leg ${L + 1}`);
      await releaseMouse();
      const perf = await ev(() => { const sc = window.__wagonWest.scene; return sc && sc.debugPerf ? sc.debugPerf(true) : null; });
      if (perf) log(`  scene perf: avg update ${perf.avgUpdate.toFixed(2)} ms, draw ${perf.avgDraw.toFixed(2)} ms, worst frame ${perf.max.toFixed ? perf.max.toFixed(1) : perf.max}`);
      if (perf && (perf.avgDraw + perf.avgUpdate > 8)) note('ugly', `leg ${L + 1} perf`, `scene averages ${(perf.avgDraw + perf.avgUpdate).toFixed(1)} ms/frame of game code (budget 8 ms) in headless Chromium`);
      await snap(`results-leg-${L + 1}`, { force: true, wait: 900 });
      const crate = await ev(() => !!document.querySelector('#res-crate-open'));
      if (crate) { await ev(() => document.querySelector('#res-crate-open').click()); await snap(`results-crate-open`, { force: true, wait: 800 }); }
      await ev(() => { const r = document.querySelector('.res-body, #screen-results .scroll'); if (r) r.scrollTop = 9999; });
      await snap(`results-leg-${L + 1}-scrolled`, { force: true, wait: 300, audits: false });
      const rj = await jq();
      log(`  leg ${L + 1} done: cash $${rj.cash} food ${Math.round(rj.food)} tokens ${rj.tokens} cards ${rj.cards} deeds ${rj.deeds} met ${rj.met}`);
      try { writeFileSync(path.join(SHOTS, `state-after-leg-${L + 1}.json`), JSON.stringify(await ctx.storageState())); } catch (_) { /* ignore */ }
      if (L === 11) break;
      if (L === 1 || L === 4 || L === 8) {
        // go to the journal from the results, then the title, then Outfit upgrades, then back on the trail
        await journalTour();
        await ev(() => { const b = document.querySelector('#screen-journal [data-back]'); });
        const onTitle = await ev(() => !document.querySelector('#screen-title').hidden);
        inTitleTour = true;
        if (onTitle) { await titleExtras(); if (L === 1) await outfitUpgrades(); }
        inTitleTour = false;
        const scr = await ev(() => window.__wagonWest.screen);
        if (scr === 'title') { await ev(() => document.querySelector('#btn-trail').click()); }
        else if (scr === 'results') await ev(() => document.querySelector('#res-next').click());
      } else {
        await ev(() => document.querySelector('#res-next').click());
      }
      await page.waitForTimeout(400);
    }

    // ---- the end: the valley, the journal, the parent zone ----
    curLeg = 11;
    await snap('final-results', { force: true, wait: 600 });
    await journalTour();
    const scr = await ev(() => window.__wagonWest.screen);
    log('screen after journal:', scr);
    if (scr !== 'title') { await ev(() => { const b = document.querySelector('#res-next'); if (b) b.click(); }); await page.waitForTimeout(800); }
    await snap('title-after-journey', { force: true, wait: 800 });

    // ---- Parent Zone ----
    const onTitle = await ev(() => !document.querySelector('#screen-title').hidden);
    if (onTitle) {
      await page.click('#btn-parents');
      await page.waitForSelector('#pz:not([hidden])');
      await snap('pz-pin-set', { force: true });
      for (let k = 0; k < 2; k++) { for (const d of '1234') await page.click(`.pinpad [data-digit="${d}"]`); await page.waitForTimeout(300); }
      await page.waitForSelector('.pz-tabs', { timeout: 5000 });
      const tabs = await ev(() => [...document.querySelectorAll('.pz-tabs .seg-btn')].map((b) => b.dataset.tab));
      for (const t of tabs) {
        await ev((t) => document.querySelector(`.pz-tabs [data-tab="${t}"]`).click(), t);
        await snap(`pz-${t}`, { force: true, wait: 700, audits: false });
        if (t === 'report') {
          await ev(() => { const c = document.querySelector('#report-chart'); if (c) c.scrollIntoView({ block: 'center' }); });
          await snap('pz-report-chart', { force: true, wait: 400, audits: false });
          await ev(() => { const c = document.querySelector('#report-kinds'); if (c) c.scrollIntoView({ block: 'center' }); });
          await snap('pz-report-kinds', { force: true, wait: 400, audits: false });
          const rep = await ev(() => { const e = document.querySelector('#report-text'); return e ? e.textContent : ''; });
          texts['PARENT REPORT TEXT'] = rep;
          await ev(() => { const b = document.querySelector('#report-copy'); if (b) b.click(); });
          await snap('pz-report-copied', { force: true, wait: 400, audits: false });
          texts['PARENT REPORT TEXT (after copy)'] = await ev(() => { const e = document.querySelector('#report-text'); return e ? e.textContent : ''; });
          texts['PARENT REPORT FULL PAGE'] = await ev(() => document.querySelector('#pz').innerText.replace(/\s+/g, ' '));
        }
        if (t === 'journey') texts['PARENT JOURNEY TAB'] = await ev(() => document.querySelector('#pz').innerText.replace(/\s+/g, ' '));
      }
      await ev(() => document.querySelector('#pz-close').click());
    } else note('script', 'end', 'not on the title after the journey; skipped the Parent Zone');

    // ---- final dump of the journey state for the report ----
    const final = await ev(() => { const w = window.__wagonWest; const J = w.save.journey; return { journey: J && { legIndex: J.legIndex, done: J.done, cash: J.cash, tokens: J.tokens, food: J.food, deeds: J.deeds, cards: J.cards, met: J.met, totals: J.totals, season: J.season }, stickers: w.save.stickers, letters: (w.save.letters || []).length, legsLog: w.save.legsLog, play: w.save.play }; });
    writeFileSync(path.join(SHOTS, 'final-state.json'), JSON.stringify(final, null, 1));
  } catch (e) {
    note('script', 'run aborted', String(e && e.stack || e).slice(0, 500));
    try { await snap('ABORT', { force: true }); } catch (_) { /* ignore */ }
  } finally {
    try { writeFileSync(path.join(SHOTS, 'spoken.json'), JSON.stringify(await ev(() => window.__spoken || []), null, 1)); } catch (_) { /* ignore */ }
    writeFileSync(path.join(SHOTS, 'findings.json'), JSON.stringify(findings, null, 1));
    writeFileSync(path.join(SHOTS, 'texts.json'), JSON.stringify(texts, null, 1));
    writeFileSync(path.join(SHOTS, 'console-errors.json'), JSON.stringify(errors, null, 1));
    await browser.close();
  }
  const by = {};
  for (const f of findings) by[f.kind] = (by[f.kind] || 0) + 1;
  log('DONE. shots:', seq, 'findings by kind:', JSON.stringify(by));
}
main().catch((e) => { console.error(e); process.exit(1); });

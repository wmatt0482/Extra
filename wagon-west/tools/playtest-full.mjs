// Wagon West 1.5 "The Long Trail": the full playtest on the REAL scene (no ?mock=1), as a 4th grader would play it, three journeys:
//   J1 the default 20-leg Oregon trail (Independence to the Willamette Valley, Fort Hall: Oregon; The Dalles: the Barlow Road with its toll and Laurel Hill),
//      the Pit Crew Check on the first store, the 1.4 moments (Frodo, fishing 2.0, noses, trail facts, the dust devil, camp games), the arrival: name the farm, the cabin built
//   J2 the Gold Road (from the Willamette farm: the news, the 12 legs, panning at Clear Creek, the Feather River and Coloma, the rocker, Sutter's Fort store,
//      the voyage home, Beaver money banked, a barn raised)
//   J3 California at Veteran (the South Pass fork, the Fort Hall choice, the Forty-Mile Desert dry stretch, the Sierra, the Sacramento claim)
// Every new screen's shot is named `v15-...` (JPEGs are also written to DOCS_SHOTS, default wagon-west/docs/playtest-1.5-shots); everything else goes to SHOTS_DIR as PNG.
//   BASE_URL=http://localhost:8111 SHOTS_DIR=/some/folder node wagon-west/tools/playtest-full.mjs
// Env: BASE_URL (default http://localhost:8082), SHOTS_DIR (all screenshots, default <os tmp>/wagon-west-playtest), DOCS_SHOTS (the v15 JPEGs; '' = none),
//      DAY_SEC (a trail day in seconds, default 6 = the game's own; 2 makes the long run bearable), JOURNEYS (default '1,2,3'; '2,3' resumes from RESUME_STATE),
//      MAX_LEGS (stop each journey after N legs, for a short check), HEADED=1, PORTRAIT=1 (390x844 with iPhone insets),
//      RESUME_STATE=<state-after-*.json> (carry on from a saved storage state: every finished leg writes one), SEQ_START=<n> (first screenshot number),
//      PITCH_ONLY=1 (only the Pit Crew Check on a fresh profile: it writes pit-check.json and stops).
// The bot taps and drags the real canvas for the bow, the line, the ford, the float, the raft, the pan, the cradle, the rope and the schooner;
// types every answer on the on-screen numpad / keyboard; reads the scene's own debug state only to know WHERE to tap.
// It records findings (layout audit, kid-rule words, console errors, stalls, canvas hit-test) to <SHOTS_DIR>/findings.json,
// the kid-visible text of every distinct screen to texts.json and everything the voice was asked to say to spoken.json; v15-summary.json holds what the run saw.
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = process.env.BASE_URL || 'http://localhost:8082';
const URL0 = BASE + '/wagon-west/index.html?nosw=1';          // no ?mock=1: the real scene
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'wagon-west-playtest');
const DAY_SEC = Number(process.env.DAY_SEC || 6);
const MAX_LEGS = Number(process.env.MAX_LEGS || 99);
const JOURNEYS = String(process.env.JOURNEYS || '1,2,3').split(',').map(Number);
const DOCS = process.env.DOCS_SHOTS === undefined ? path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'docs', 'playtest-1.5-shots') : process.env.DOCS_SHOTS;
const PITCH_ONLY = !!process.env.PITCH_ONLY;
const RESUME = process.env.RESUME_STATE || '';       // a state-after-leg-N.json from an earlier run: carry on from leg N+1 (START_LEG = N)
const START_LEG = Number(process.env.START_LEG || 0);
const RESUME_J = Number(process.env.RESUME_J || 1);
const PORTRAIT = !!process.env.PORTRAIT;             // 390x844 with iPhone insets instead of 844x390 landscape
mkdirSync(SHOTS, { recursive: true });
if (DOCS) mkdirSync(DOCS, { recursive: true });

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
let curJ = 1;                   // the journey being played (1 Oregon, 2 Gold Road, 3 California)
let page = null;
const P = {                     // the plan: how this kid plays
  river: { 'kansas-river': 'ford', 'snake-river': 'float', 'the-dalles': 'ferry', 'humboldt-river': 'ford', 'truckee-river': 'float', 'umpqua-river': 'ferry', 'rogue-river': 'ford', 'feather-river': 'ferry', 'north-platte': 'ferry', 'green-river': 'ferry' },
  forkWay: {},                  // fork id -> option id, set per journey
  digsLeft: 0,
  placeDone: false,
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
const note = (kind, key, msg, shot = '') => { findings.push({ kind, key, msg, shot, journey: curJ, leg: curLeg + 1 }); log(`  !! [${kind}] ${key}: ${msg}`); };
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x';

// ---------- v1.4: what the run makes sure it sees ----------
const V = { v15: { forks: [], tolls: [], snubs: [], pans: [], rockers: [], sails: [], dry: [], farms: [], banks: [], placement: null, order: [], gold: [], journeys: [] }, dogName: 'Frodo', baitIx: 0, bait: [], noses: [], facts: [], fishing: [], stones: [], fetch: [], hoppers: [], meteors: [], hats: [], hunts: [], chases: [], lateDone: false, wiggleDone: false, helped: 0, wiggled: 0,
  camp: { fetch: 0, hoppers: 0, stones: 0, stars: 0 }, campSeen: new Set(), legFun: [], notes: [] };
const BAIT_PLAN = ['worms', 'hoppers', 'hoppers', 'worms', 'hoppers', 'spoon', 'spoon', 'hoppers', 'spoon', 'spoon', 'worms'];   // the bait row, as a kid would try them (the first one on offer is taken)

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
  const k = `J${curJ}L${curLeg}|${key}`;
  if (!force && seenKeys.has(k)) return null;
  seenKeys.add(k);
  await page.waitForTimeout(wait);
  const name = `${String(++seq).padStart(3, '0')}-J${curJ}L${String(curLeg + 1).padStart(2, '0')}-${slug(key)}.png`;
  try { await page.screenshot({ path: path.join(SHOTS, name) }); } catch (e) { note('script', key, 'screenshot failed: ' + e.message); }
  if (DOCS && /^v15-/.test(key)) { try { await page.screenshot({ path: path.join(DOCS, name.replace(/\.png$/, '.jpg')), type: 'jpeg', quality: 58 }); } catch (_) { /* ignore */ } }
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
    bait: !!$('#bait-row') && !$('#bait-row').hidden, findPop: $('#findpop') && !$('#findpop').hidden ? $('#findpop').textContent : '', campCtx: w.camp ? w.camp.context : null, dogCall: !!$('#dog-call') && !$('#dog-call').hidden,
    toasts: [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent),
    fork: w.forkPanel && w.forkPanel.isOpen ? w.forkPanel.fork : null, dig: !!(w.diggings && w.diggings.isOpen), digBusy: !!(w.diggings && w.diggings.busy),
    digBtns: [...document.querySelectorAll('#dg-btns [data-dig]')].filter((b) => !b.disabled).map((b) => b.dataset.dig),
    farmScreen: w.screen === 'farm',
    j: J && { legIndex: J.legIndex, legId: J.legId, milesDone: J.milesDone, day: J.day, cash: J.cash, food: J.food, tokens: J.tokens, rations: J.rations, pace: J.pace, goods: J.goods && { ...J.goods }, animals: J.animals && { ...J.animals }, foods: J.foods && { ...J.foods }, done: J.done, limp: J.limp, deeds: (J.deeds || []).length, cards: Array.isArray(J.cards) ? J.cards.length : 0, met: (J.met || []).length },
  };
});
const idle = (s) => s.screen === 'trail' && !s.fork && s.marker === 'closed' && s.problem === 'closed' && !s.card && !s.mini && !s.sm && s.travel && !s.travel.busy && !s.paused && !s.wagonOpen;

async function typeDigits(root, digits) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      for (const d of String(digits)) await page.click(`${root} .np-key[data-key="${d}"]`, { timeout: 4000 });
      await page.click(`${root} .np-key[data-key="go"]`, { timeout: attempt === 2 ? 4000 : 1500 });
      return;
    } catch (e) {
      if (attempt === 2) throw e;
      await page.waitForTimeout(500);       // (the panel was not taking digits yet, or moved on: look again)
      const still = await ev((r) => { const el = document.querySelector(r); return !!el && !el.hidden; }, root);
      if (!still) return;
      await ev((r) => { const b = document.querySelector(`${r} .np-key.np-del, ${r} .np-key[data-key="del"], ${r} .np-key[data-key="back"]`); if (b) for (let i = 0; i < 4; i++) b.click(); }, root);
    }
  }
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
  if (!m.kind && s.sm) m.kind = s.sm.kind;      // (the v1.5 minis' debug objects carry no kind: the state does)
  const c = await canvasBox();
  const checkTap = async (px, py, what) => {
    const k = what + ':' + curLeg;
    if (miniMeta.tapChecked.has(k)) return;
    miniMeta.tapChecked.add(k);
    const h = await hitIsCanvas(px, py);
    if (!h.ok) note('blocks play', what, `a tap at (${Math.round(px)}, ${Math.round(py)}) lands on ${h.what}, not the canvas: the ${what} cannot be played by touch there`, '');
  };
  if (m.kind === 'hunt') {
    if (!miniMeta.shotsSeen.has('hunt' + curLeg + ':' + s.j.day)) { miniMeta.shotsSeen.add('hunt' + curLeg + ':' + s.j.day); miniMeta.huntStart = Date.now(); await snap(`hunt-start`, { force: true, wait: 700 }); }
    if (m.left <= 0 && m.arrows === 0) { if (!miniMeta.huntLogged || miniMeta.huntLogged !== curLeg + ':' + s.j.day) { miniMeta.huntLogged = curLeg + ':' + s.j.day; V.hunts.push({ leg: curLeg + 1, hits: m.hits, leadHits: m.leadHits, meatLb: m.meatLb }); } return true; }
    if (m.arrows > 0 || m.left <= 0) return true;
    // the shots a kid makes: 1 a LEAD shot at a running animal (aim ahead of it), 2 a still shot (aim at it), 3 a wild tap at the sky, then lead, still
    const fired = 5 - m.left;
    const alive = m.animals.filter((a) => a.state === 'alive' && a.x > 70 && a.x < c.W - 70);
    if (!alive.length) return true;
    const running = alive.filter((a) => a.running && a.aim.x > 30 && a.aim.x < c.W - 30), still = alive.filter((a) => !a.moving && a.mode === 'graze');
    const kind = ['lead', 'still', 'sky', 'lead', 'still'][fired];
    const waited = Date.now() - (miniMeta.lastHuntShot || miniMeta.huntStart || Date.now());
    let tx, ty, how = kind;
    if (kind === 'sky') { tx = c.W * 0.5; ty = c.H * 0.4; }
    else if (kind === 'lead' && running.length) { const a = running.sort((p, q) => Math.abs(p.x - c.W / 2) - Math.abs(q.x - c.W / 2))[0]; tx = a.aim.x; ty = a.aim.y; }
    else if (kind === 'still' && still.length) { const a = still.sort((p, q) => Math.abs(p.x - c.W / 2) - Math.abs(q.x - c.W / 2))[0]; tx = a.x; ty = a.y; }
    else if (waited < 7000) return true;                              // wait a while for the kind of animal this shot is meant for
    else { const a = alive.find((q) => !q.running || (q.aim.x > 30 && q.aim.x < c.W - 30)) || alive[0]; how = 'any'; if (a.running) { tx = Math.max(30, Math.min(c.W - 30, a.aim.x)); ty = a.aim.y; } else { tx = a.x; ty = a.y; } }
    const [px, py] = toPage(c, tx, ty);
    { const h = await hitIsCanvas(px, py); if (!h.ok) { miniMeta.huntBlocked = (miniMeta.huntBlocked || 0) + 1; if (miniMeta.huntBlocked <= 3) note('wrong', 'bow (hunt)', `a tap on an animal at (${Math.round(px)}, ${Math.round(py)}) lands on ${h.what} instead of the canvas (the hunt bar covers the low lane); the arrow is never loosed`, await snap('hunt-blocked-tap', { force: true, wait: 50 })); } }
    miniMeta.lastHuntShot = Date.now();
    log(`  hunt shot ${fired + 1}: ${how}${how !== 'sky' ? ' at a ' + (alive.find((a) => Math.abs((a.running ? a.aim.x : a.x) - tx) < 1) || {}).kind : ''}`);
    await page.touchscreen.tap(px, py);
    if (fired === 0) { await snap('v14-hunt-arrow-in-flight-lead', { force: true, wait: 160 }); }
    if (fired === 1) { await snap('v14-hunt-arrow-in-flight-still', { force: true, wait: 160 }); }
    await page.waitForTimeout(450);
    if (fired < 2) await snap(`v14-hunt-after-shot-${fired + 1}`, { force: true, wait: 500 });
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
  // ---- v1.4 ----
  if (m.kind === 'dogRun') { if (m.phase === 'show') await snap(`v14-dog-brings-${m.what}`, { wait: 200 }); else if (m.phase === 'gone') await snap(`v14-dog-dashes-off-${m.what}`, { wait: 30 }); await page.waitForTimeout(80); return true; }
  if (m.kind === 'dogWarn') { await snap(`v14-dog-warns-snake-${m.phase}`, { wait: 250 }); await page.waitForTimeout(100); return true; }
  if (m.kind === 'ambient') {
    await snap(`v14-ambient-${m.what}`, { wait: 1900 });
    if (m.what === 'grizzly' && m.bear && !(m.bear.feetFrac < 0.62 && m.bear.hFrac < 0.3)) note('wrong', 'grizzly on the ridge', `the bear is not on a far ridge: feet at ${Math.round(m.bear.feetFrac * 100)} % of the height, ${Math.round(m.bear.hFrac * 100)} % tall`);
    await page.waitForTimeout(250); return true;
  }
  if (m.kind === 'chase') {
    const vis = await ev(() => { const b = document.querySelector('#dog-call'); if (!b || b.hidden) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; });
    if (!vis) { await page.waitForTimeout(40); return true; }
    if (!miniMeta.chaseShot) { miniMeta.chaseShot = true; await snap('v14-chase-name-button', { force: true, wait: 600 }); }
    const late = !V.lateDone;                                       // the first chase is called LATE (muddy); later ones in good time
    if (late ? (m.dist >= 0.86 && m.phase === 'out') : m.dist >= 0.25) {
      if (late) { V.lateDone = true; await snap('v14-chase-called-late', { force: true, wait: 0 }); }
      const hit = await hitIsCanvas(vis.x, vis.y);
      V.chases.push({ leg: curLeg + 1, late, dist: m.dist, tapOn: hit.what });
      await page.touchscreen.tap(vis.x, vis.y);
      await page.waitForTimeout(300);
      await snap(late ? 'v14-chase-after-the-late-call' : 'v14-chase-after-the-call', { force: true, wait: 700 });
    } else await page.waitForTimeout(30);
    return true;
  }
  if (m.kind === 'fishing') return await playFishing(c);
  if (m.kind === 'stones') return await playStones(c);
  if (m.kind === 'fetch') return await playFetch(c, m);
  if (m.kind === 'hoppers') {
    await snap('v14-hoppers-play', { wait: 900 });
    const hs = (m.hoppers || []).filter((q) => q.x > 40 && q.x < c.W - 40);
    if (!hs.length) { await page.waitForTimeout(80); return true; }
    const [px, py] = toPage(c, hs[0].x, hs[0].y);
    await checkTap(px, py, 'grasshoppers');
    await page.touchscreen.tap(px, py);
    await page.waitForTimeout(160);
    return true;
  }
  if (m.kind === 'meteors') {
    await snap('v14-falling-stars', { wait: 2200 });
    const st = (m.stars || [])[0];
    if (!st) { await page.waitForTimeout(100); return true; }
    const [px, py] = toPage(c, st.x, st.y);
    await checkTap(px, py, 'falling stars');
    await page.touchscreen.tap(px, py);
    await snap('v14-falling-star-wish', { wait: 150 });
    await page.waitForTimeout(260);
    return true;
  }
  if (m.kind === 'dustDevil') {
    await snap('v14-dust-devil-hats-fly', { wait: 1400 });
    const hats = (m.hats || []).filter((q) => q.inReach && q.x > 20 && q.x < c.W - 20);
    const leave = V.hats.length === 0 && m.of > 1 && m.caught >= m.of - 1;       // the first devil: leave one hat in the sagebrush (the dog brings it back)
    if (!hats.length || leave) { await page.waitForTimeout(90); return true; }
    const [px, py] = toPage(c, hats[0].x, hats[0].y);
    await checkTap(px, py, 'dust devil hats');
    await page.touchscreen.tap(px, py);
    await snap('v14-dust-devil-hat-caught', { wait: 120 });
    await page.waitForTimeout(150);
    return true;
  }
  // ---- v1.5 ----
  if (m.kind === 'pan') return await playPan(c, m);
  if (m.kind === 'rocker') return await playRocker(c, m);
  if (m.kind === 'snub') return await playSnub(c, m);
  if (m.kind === 'sail') return await playSail(c, m, s.sm);
  return false;
}

// ---------- v1.5: gold panning, the cradle, Laurel Hill and the voyage, played with real pointer input ----------
const seen15 = new Set();
const first15 = (k) => { const kk = `${curJ}:${k}`; if (seen15.has(kk)) return false; seen15.add(kk); return true; };
const sleep15 = (ms) => new Promise((r) => setTimeout(r, ms));
async function playPan(c, m) {
  const [cx, cy] = toPage(c, m.cx, m.cy);
  if (m.phase === 'scoop') {
    if (first15('pan-scoop')) { await snap('v15-pan-scoop', { force: true, wait: 400 }); await checkTapHit(cx, cy, 'gold pan (scoop)'); }
    await page.touchscreen.tap(cx, cy);
    await page.waitForTimeout(300);
    return true;
  }
  if (m.phase === 'swirl') {
    if (first15('pan-swirl')) await snap('v15-pan-swirl', { force: true, wait: 200 });
    // circles round the pan at about 4 rad/s (the scene's good swirl is 1.4 to 8.5): a steady finger
    const rx = m.rx * 0.8, ry = m.ry * 0.8;
    const t0 = Date.now();
    let a = 0;
    await page.mouse.move(...toPage(c, m.cx + rx, m.cy));
    await page.mouse.down(); mouse.down = true;
    let shot = false;
    while (Date.now() - t0 < 14000) {
      a = ((Date.now() - t0) / 1000) * 4.2;
      await page.mouse.move(...toPage(c, m.cx + Math.cos(a) * rx, m.cy + Math.sin(a) * ry));
      const mm = await ev(() => { const sc = window.__wagonWest.scene; return sc && sc.debugMini ? sc.debugMini() : null; });
      if (!mm || mm.kind !== 'pan' || mm.phase !== 'swirl') break;
      if (!shot && a > 7) { shot = true; await snap('v15-pan-swirl-meter', { force: true, wait: 0 }); }
      await page.waitForTimeout(8);
    }
    await releaseMouse();
    return true;
  }
  if (m.phase === 'tip') {
    const glow = () => 0.5 + 0.5 * Math.sin((m.pt / 1.5) * Math.PI * 2 - Math.PI / 2);
    // tap when the rim glows (re-read the clock: pt moves)
    for (let i = 0; i < 400; i++) {
      const mm = await ev(() => { const sc = window.__wagonWest.scene; return sc && sc.debugMini ? sc.debugMini() : null; });
      if (!mm || mm.kind !== 'pan' || mm.phase !== 'tip') return true;
      const g = 0.5 + 0.5 * Math.sin((mm.pt / 1.5) * Math.PI * 2 - Math.PI / 2);
      if (g > 0.8) { if (first15('pan-tip')) await snap('v15-pan-tip-the-rim-glows', { force: true, wait: 0 }); await page.touchscreen.tap(cx, cy); await page.waitForTimeout(250); return true; }
      await page.waitForTimeout(25);
    }
    return true;
  }
  if (m.phase === 'swirled' || m.phase === 'reveal') {
    if (m.phase === 'reveal' && first15('pan-reveal')) await snap('v15-pan-reveal-flakes', { force: true, wait: 900 });
    await page.waitForTimeout(150);
    return true;
  }
  await page.waitForTimeout(100);
  return true;
}
async function playRocker(c, m) {
  if (m.phase === 'ready') { if (first15('rock-ready')) await snap('v15-rocker-ready', { force: true, wait: 300 }); await page.waitForTimeout(60); return true; }
  if (m.phase === 'rock') {
    if (first15('rock-go')) await snap('v15-rocker-rock-it', { force: true, wait: 50 });
    const [px, py] = toPage(c, c.W * 0.5, c.H * 0.7);
    // tap on each beat but two (a kid is not perfect): the scene's window is +-0.24 s
    const done = new Set();
    for (let guard = 0; guard < 900; guard++) {
      const mm = await ev(() => { const sc = window.__wagonWest.scene; return sc && sc.debugMini ? sc.debugMini() : null; });
      if (!mm || mm.kind !== 'rocker' || mm.phase !== 'rock') return true;
      const p = (mm.rt - mm.lead) / mm.period, b = Math.round(p), d = (p - b) * mm.period;
      const skip = b === 3 || b === 6;
      if (b >= 0 && b < 8 && !done.has(b) && !skip && Math.abs(d) < 0.07) { done.add(b); await page.touchscreen.tap(px, py); if (done.size === 4 && first15('rock-mid')) await snap('v15-rocker-on-the-beat', { force: true, wait: 0 }); }
      await page.waitForTimeout(12);
    }
    return true;
  }
  await page.waitForTimeout(120);
  return true;
}
async function playSnub(c, m) {
  const [px, py] = toPage(c, c.W * 0.5, c.H * 0.5);
  const mid = (m.ledge.s0 + m.ledge.s1) / 2;
  if (m.phase === 'wait') {
    if (first15('snub-wait')) { await snap('v15-snub-laurel-hill-hold', { force: true, wait: 500 }); await checkTapHit(px, py, 'Laurel Hill (hold)'); }
    await releaseMouse();
    await page.mouse.move(px, py); await page.mouse.down(); mouse.down = true;
    // the first drop: let go too early once (it just waits and the child holds again)
    if (!playSnub.early && m.s < 0.01) { playSnub.early = true; await page.waitForTimeout(500); await releaseMouse(); await snap('v15-snub-let-go-early', { force: true, wait: 900 }); V.v15.snubs.push({ j: curJ, early: true }); }
    return true;
  }
  if (m.phase === 'slide' || m.phase === 'skid') {
    if (m.phase === 'slide') {
      if (first15('snub-slide')) await snap('v15-snub-sliding-on-the-rope', { force: true, wait: 0 });
      const stop = m.s + (m.v * m.v) / (2 * m.decel);
      if (stop >= mid - 0.01 && mouse.down) { await releaseMouse(); await snap('v15-snub-let-go-at-the-ledge', { wait: 150 }); }
    }
    await page.waitForTimeout(8);
    return true;
  }
  await releaseMouse();
  if (m.phase === 'settle' && first15('snub-settle-' + m.s.toFixed(1))) await snap('v15-snub-smooth', { wait: 100 });
  await page.waitForTimeout(100);
  return true;
}
async function playSail(c, m, sm) {
  const W_ = c.W;
  if (m.phase === 'ready') { if (first15('sail-ready')) await snap('v15-sail-ready', { force: true, wait: 400 }); await page.waitForTimeout(80); return true; }
  if (sm && sm.waiting) { await releaseMouse(); if (first15('sail-wait-' + (m.stretch || 0))) await snap('v15-sail-up-the-coast-marker', { wait: 600 }); await page.waitForTimeout(150); return true; }
  if (m.phase === 'calm' || m.phase === 'end') { await releaseMouse(); if (first15('sail-' + m.phase)) await snap('v15-sail-' + (m.phase === 'calm' ? 'oregons-green-shore' : 'home'), { force: true, wait: 1500 }); await page.waitForTimeout(150); return true; }
  const ahead = (m.swells || []).filter((q) => q.z < m.zs + 0.05 && !q.hit);
  const sw = ahead.sort((a, b) => b.z - a.z)[0];
  const target = sw ? sw.g : 0.5;
  const [tx, ty] = toPage(c, target * W_, c.H * 0.8);
  if (!mouse.down) { await page.mouse.move(...toPage(c, (m.u || 0.5) * W_, c.H * 0.8)); await page.mouse.down(); mouse.down = true; }
  await page.mouse.move(tx, ty, { steps: 2 });
  if (m.phase === 'bar' && first15('sail-bar')) await snap('v15-sail-over-the-columbia-bar', { force: true, wait: 300 });
  if (m.phase === 'sail' && first15('sail-sail-' + (m.stretch || 0))) await snap('v15-sail-steering-through-the-gaps', { wait: 200 });
  await page.waitForTimeout(16);
  return true;
}

// ---------- the general store ----------
const storeState = { leg: -1, bought: false, worked: false, derby: false };
async function jq() { return (await W()).j; }
async function storeRoutine(s) {
  const legIx = s.j.legIndex;
  const storeKey = curJ * 1000 + legIx;
  if (storeState.leg !== storeKey || s.screen !== 'store') { if (storeState.leg !== storeKey) Object.assign(storeState, { leg: storeKey, bought: false, worked: false, derby: false, tries: 0 }); }
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
    // v1.4: the shiny spoon (once, from Fort Kearny on) and the old horseshoes the dog found
    const hs = await ev(() => { const b = document.querySelector('#store-horseshoes'); return b ? { n: b.dataset.n, cash: b.dataset.cash, label: b.textContent } : null; });
    if (hs) { await snap('v14-store-horseshoes-row', { force: true, wait: 200 }); await ev(() => document.querySelector('#store-horseshoes').click()); await page.waitForTimeout(500); await snap('v14-store-horseshoes-sold', { force: true, wait: 300 }); V.legFun.push({ leg: legIx + 1, where: 'store', horseshoes: hs }); }
    const spoonRow = await ev(() => { const b = document.querySelector('.st-good[data-good="spoon"]'); return b ? { disabled: b.disabled, text: b.textContent } : null; });
    if (spoonRow) { await snap('v14-store-spoon-row', { force: true, wait: 200 }); if (!spoonRow.disabled) { await buy('spoon'); await snap('v14-store-spoon-bought', { force: true, wait: 300 }); V.legFun.push({ leg: legIx + 1, where: 'store', spoon: 'bought', row: spoonRow }); } }
    await snap(`store-${s.j.legId}-after-buying`, { force: true, wait: 250 });
  }
  if (!storeState.worked && !P.storeWorkedAt.has(storeKey)) {
    P.storeWorkedAt.add(storeKey); storeState.worked = true;
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

// ---------- v1.4: Frodo and the river ----------
const J14 = () => ev(() => {
  const J = window.__wagonWest.save.journey;
  if (!J) return null;
  return { legId: J.legId, dog: J.dog ? { ...J.dog } : null, finds: J.finds, fishLog: J.fishLog, fishJunk: J.fishJunk, fishBest: J.fishBest, quests: J.quests, questsDone: J.questsDone, factsHeard: J.factsHeard,
    wishes: J.wishes, skips: J.skips, goods: J.goods && { ...J.goods }, totals: J.totals && { ...J.totals }, cards: J.cards, opts: J.opts, tokens: J.tokens, cash: J.cash, spirit: J.spirit };
});
/** Camp on an arrival evening while there is still something new to play there (falling stars, fetch, grasshoppers, stones), and always on the first legs. */
function campWanted() {
  const c = V.camp;
  if (curLeg <= 2) return true;
  return curLeg <= 9 && !(c.stars >= 1 && c.fetch >= 2 && c.hoppers >= 1 && c.stones >= 1);
}
async function arrivalCamp(s) {
  const key = (a) => `${s.j.legId}:${a}`;
  await snap(`v14-camp-arrival-${s.j.legId}`, { wait: 700 });
  const offered = await ev(() => [...document.querySelectorAll('.camp-act.fun')].filter((b) => !b.disabled).map((b) => b.dataset.act));
  const lim = { stars: 1, hoppers: 2, fetch: 2, stones: 1 };
  const next = ['stars', 'hoppers', 'fetch', 'stones'].find((a) => offered.includes(a) && V.camp[a] < lim[a] && !V.campSeen.has(key(a)));
  if (next) {
    V.campSeen.add(key(next)); V.camp[next]++;
    log(`  camp (arrival): ${next} (offered: ${offered.join(', ')})`);
    await ev((a) => document.querySelector(`.camp-act[data-act="${a}"]`).click(), next);
    await page.waitForTimeout(400);
    return 'camp-' + next;
  }
  const j = await J14();
  V.legFun.push({ leg: curLeg + 1, where: 'arrival camp', offered, muddyAtCamp: !!(j && j.dog && j.dog.muddy) });
  await snap(`v14-camp-arrival-${s.j.legId}-done`, { force: true, wait: 300 });
  await ev(() => document.querySelector('#camp-back').click());
  await page.waitForTimeout(500);
  return 'camp-leave';
}
async function pickBait(s) {
  const avail = await ev(() => [...document.querySelectorAll('#bait-row .bait-btn')].map((b) => ({ id: b.dataset.bait, ok: !b.disabled, sub: (b.querySelector('small') || {}).textContent || '' })));
  await snap(`v14-bait-row-${s.j.legId}`, { force: true, wait: 350 });
  const want = BAIT_PLAN[V.baitIx++ % BAIT_PLAN.length];
  const pick = avail.find((b) => b.id === want && b.ok) || avail.find((b) => b.ok);
  V.bait.push({ leg: s.j.legId, want, pick: pick && pick.id, avail });
  if (!pick) { note('wrong', 'bait row', 'no bait on offer: ' + JSON.stringify(avail)); await ev(() => document.querySelector('#mini-done').click()); return 'bait'; }
  await ev((id) => document.querySelector(`#bait-row [data-bait="${id}"]`).click(), pick.id);
  await page.waitForTimeout(250);
  return 'bait';
}
/** Pick the fishing seed counter so the next session has what this leg wants (a boot or turtle, the bottle, the sturgeon): a steering of luck, the play is real. */
async function steerFishing(want) {
  const plan = BAIT_PLAN[V.baitIx % BAIT_PLAN.length];
  return ev(({ want, plan }) => {
    const w = window.__wagonWest, J = w.save.journey, JA = w.JA;
    if (!J || !J.trip || typeof JA.fishingSession !== 'function') return { k: -1 };
    const av = JA.baitsAvailable(J);
    const bait = (av.find((b) => b.id === plan && b.ok) || av.find((b) => b.ok) || { id: 'worms' }).id;
    const base = J.trip.fishing | 0;
    for (let k = 0; k < 800; k++) {
      const c = JSON.parse(JSON.stringify(J)); c.trip.fishing = base + k;
      let ses; try { ses = JA.fishingSession(c, { bait }); } catch (_) { return { k: -2 }; }
      const names = ses.casts.map((x) => x.species || x.junk);
      const ok = want === 'sturgeon' ? names.includes('white-sturgeon') : want === 'bottle' ? names.includes('bottle') : want === 'junk' ? ses.casts.some((x) => x.kind === 'junk') : want === 'fish2' ? names.filter((n) => n !== 'boot' && n !== 'turtle' && n !== 'bottle').length >= 3 : true;
      if (ok) { J.trip.fishing = base + k; return { k, bait, names, water: ses.water }; }
    }
    return { k: -3, bait };
  }, { want, plan });
}
async function v14Fish(want, label) {
  const st = await steerFishing(want);
  log(`  fishing (${label}): steered for "${want}": ${JSON.stringify(st)}`);
  if (st.k < 0) note('script', 'fishing steer', `no session with "${want}" found (${JSON.stringify(st)})`);
  const ok = await ev(() => window.__wagonWest.playEvent('fish'));
  if (!ok) return null;
  const t0 = Date.now();
  await playUntil((s2) => s2.travel && !s2.travel.busy && !s2.card && !s2.sm && !s2.bait, {}, 240000, `fishing ${label}`);
  const f = await ev(() => window.__wagonWest.lastFishing);
  V.fishing.push({ leg: curLeg + 1, label, want, steer: st, secs: Math.round((Date.now() - t0) / 1000), result: f });
  return 'v14-fish-' + label;
}
async function v14Nose(kind) {
  const ok = await ev((k) => window.__wagonWest.playNose(k), kind);
  if (!ok) return null;
  const t0 = Date.now();
  await page.waitForTimeout(300);
  await playUntil((s2) => s2.travel && !s2.travel.busy && !s2.card && !s2.sm && !s2.findPop, {}, 90000, `nose ${kind}`);
  const j = await J14();
  V.noses.push({ leg: curLeg + 1, kind, secs: Math.round((Date.now() - t0) / 1000), muddy: !!(j && j.dog && j.dog.muddy), finds: j && Object.keys(j.finds || {}).length });
  return 'v14-nose-' + kind;
}
async function v14Fact(id) {
  const ok = await ev((i) => window.__wagonWest.playFact(i), id);
  if (!ok) return null;
  await page.waitForTimeout(300);
  await playUntil((s2) => s2.travel && !s2.travel.busy && !s2.card && !s2.sm, {}, 90000, `fact ${id}`);
  V.facts.push({ leg: curLeg + 1, id });
  return 'v14-fact-' + id;
}
async function v14Moment(kind) {
  const ok = await ev((k) => window.__wagonWest.playMoment(k), kind);
  if (!ok) return null;
  await page.waitForTimeout(300);
  await playUntil((s2) => s2.travel && !s2.travel.busy && !s2.card && !s2.sm, {}, 90000, `moment ${kind}`);
  const j = await J14();
  V.hats.push({ leg: curLeg + 1, kind, hatsCaught: j && j.totals && j.totals.hatsCaught, hatsAll: j && j.totals && j.totals.hatsAll, dustDevils: j && j.totals && j.totals.dustDevils });
  return 'v14-moment-' + kind;
}
/** The v1.4 detours, by leg and mile (each once). Every one only plays when the trail is idle. */
const V14_PLAN = [
  { leg: 'kansas-river', miles: 20, key: 'fish-kansas', run: () => v14Fish('junk', 'kansas') },
  { leg: 'kansas-river', miles: 95, key: 'fact-glow', run: () => v14Fact('prairie-glow') },
  { leg: 'alcove-spring', miles: 12, key: 'nose-find', run: () => v14Nose('find') },
  { leg: 'alcove-spring', miles: 24, key: 'nose-snake', run: () => v14Nose('snake') },
  { leg: 'alcove-spring', miles: 38, key: 'nose-rabbit-late', run: () => v14Nose('rabbit') },
  { leg: 'alcove-spring', miles: 52, key: 'fact-rifles', run: () => v14Fact('far-off-crack') },
  { leg: 'alcove-spring', miles: 85, key: 'fact-wolves', run: () => v14Fact('wolf-song') },
  { leg: 'fort-kearny', miles: 14, key: 'dust-devil', run: () => v14Moment('dustDevil') },
  { leg: 'fort-kearny', miles: 56, key: 'fish-platte', run: () => v14Fish('fish2', 'platte') },
  { leg: 'fort-kearny', miles: 100, key: 'nose-find-2', run: () => v14Nose('find') },
  { leg: 'ash-hollow', miles: 70, key: 'fact-rifles-2', run: () => v14Fact('far-off-crack') },
  { leg: 'chimney-rock', miles: 20, key: 'fish-bottle', run: () => v14Fish('bottle', 'sweetwater-bottle') },
  { leg: 'scotts-bluff', miles: 20, key: 'fact-grizzly', run: () => v14Fact('grizzly-ridge') },
  { leg: 'scotts-bluff', miles: 40, key: 'fish-sweetwater2', run: () => v14Fish('fish2', 'south-pass') },
  { leg: 'north-platte', miles: 30, key: 'fish-creek', run: () => v14Fish('fish2', 'creek') },
  { leg: 'independence-rock', miles: 15, key: 'fish-bear', run: () => v14Fish('fish2', 'bear') },
  { leg: 'independence-rock', miles: 45, key: 'fact-pronghorn', run: () => v14Fact('pronghorn-race') },
  { leg: 'snake-river', miles: 20, key: 'fish-snake-sturgeon', run: () => v14Fish('sturgeon', 'snake') },
  { leg: 'blue-mountains', miles: 25, key: 'fish-blue', run: () => v14Fish('fish2', 'blue') },
  { leg: 'the-dalles', miles: 20, key: 'fish-columbia', run: () => v14Fish('sturgeon', 'columbia') },
];
async function v14Detours(s, once) {
  for (const d of V14_PLAN) {
    if (curJ !== 1 || d.leg !== s.j.legId || s.j.milesDone < d.miles || !once('v14-' + d.key)) continue;
    const r = await d.run();
    if (!r) { P.specials.delete(curJ + ':v14-' + d.key); return null; }
    return r;
  }
  return null;
}

// ---------- v1.4: the new mini-games, played with real pointer input ----------
async function playFishing(c) {
  const t0 = Date.now();
  let held = false, tapEarly = false, lastFight = '';
  const [cx, cy] = toPage(c, c.W * 0.5, c.H * 0.7);
  const up = async () => { if (held) { await page.mouse.up().catch(() => {}); held = false; } };
  const down = async () => { if (!held) { await page.mouse.move(cx, cy); await page.mouse.down(); held = true; } };
  while (Date.now() - t0 < 150000) {
    const m = await ev(() => { const sc = window.__wagonWest.scene; return sc && sc.debugMini ? sc.debugMini() : null; });
    if (!m || m.kind !== 'fishing') break;
    const tag = m.species || m.junk || 'x';
    if (m.phase === 'end') { await up(); break; }                  // (the summary card is the app's now: step() answers it)
    if (m.phase === 'wait' && !tapEarly && V.fishing.length === 0 && m.pt > 0.6) { tapEarly = true; await snap('v14-fishing-wait-for-a-bite', { force: true, wait: 50 }); await page.touchscreen.tap(cx, cy); await snap('v14-fishing-early-tap', { force: true, wait: 150 }); await page.waitForTimeout(300); continue; }
    if (m.phase === 'bite') { await up(); await snap('v14-fishing-bite-' + tag, { wait: 40 }); await page.touchscreen.tap(cx, cy); await page.waitForTimeout(150); continue; }
    if (m.phase === 'fight') {
      if (m.fight === 'help') {
        await up();
        await snap('v14-fishing-sturgeon-it-takes-two', { wait: 500 });
        const [hx, hy] = toPage(c, m.helpSpot.x, m.helpSpot.y);
        await checkHelpTap(hx, hy);
        await page.touchscreen.tap(hx, hy); V.helped++;
        await snap('v14-fishing-sturgeon-helper-tapped', { force: true, wait: 400 });
        await page.waitForTimeout(250); continue;
      }
      if (m.fight === 'reel') {
        const danger = m.warn || m.wobble;
        const wantWiggle = !V.wiggleDone && V.fishing.length === 0;      // the very first fight: hold straight through the red (the fish wiggles off, cast again)
        if (wantWiggle) { await down(); if (m.wobble) await snap('v14-fishing-line-red-held', { wait: 20 }); }
        else if (danger && held) { if (m.wobble) await snap('v14-fishing-line-red-let-go-' + tag, { wait: 10 }); else await snap('v14-fishing-line-yellow-' + tag, { wait: 10 }); await up(); }
        else if (!danger && !held) await down();
        if (!wantWiggle && !danger && m.progress > 0.55) await snap('v14-fishing-reeling-in-' + tag, { wait: 20 });
        lastFight = m.fight;
      } else await up();
    } else { await up(); if (m.phase === 'off' && !V.wiggleDone && V.fishing.length === 0) { V.wiggleDone = true; V.wiggled++; await snap('v14-fishing-it-wiggled-off', { force: true, wait: 120 }); } if (m.phase === 'land') await snap('v14-fishing-landed-' + tag, { wait: 250 }); if (m.junk && m.phase === 'land') await snap('v14-fishing-junk-' + m.junk, { wait: 10 }); }
    await page.waitForTimeout(18);
  }
  await up();
  return true;
}
async function checkHelpTap(px, py) {
  const h = await hitIsCanvas(px, py);
  if (!h.ok) note('blocks play', 'fishing (sturgeon helper)', `the helper's portrait at (${Math.round(px)}, ${Math.round(py)}) is covered by ${h.what}: the second tap cannot be made by touch there`);
}
async function playStones(c) {
  const t0 = Date.now();
  const [cx, cy] = toPage(c, c.W * 0.5, c.H * 0.7);
  const first = V.stones.length === 0;
  let sinkOn = false;
  while (Date.now() - t0 < 60000) {
    const m = await ev(() => { const sc = window.__wagonWest.scene; return sc && sc.debugMini ? sc.debugMini() : null; });
    if (!m || m.kind !== 'stones') break;
    if (m.phase === 'ready') { if (m.throw === 0) { await snap('v14-stones-ready', { wait: 300 }); await checkTapHit(cx, cy, 'skipping stones'); } await page.touchscreen.tap(cx, cy); await page.waitForTimeout(150); sinkOn = first && m.throw === 2; continue; }
    if (m.phase === 'dip' && !sinkOn) { await page.touchscreen.tap(cx, cy); await page.waitForTimeout(60); continue; }
    if (m.phase === 'air' && m.needTap && !sinkOn && m.nextKissIn != null && m.nextKissIn <= 0.11) { await page.touchscreen.tap(cx, cy); if (m.skips === 3) await snap('v14-stones-skipping', { wait: 0 }); await page.waitForTimeout(60); continue; }
    if (m.phase === 'sink') await snap('v14-stones-plunk', { wait: 60 });
    await page.waitForTimeout(12);
  }
  const m2 = await ev(() => { const sc = window.__wagonWest.scene; return sc && sc.debugMini ? sc.debugMini() : null; });
  V.stones.push({ leg: curLeg + 1, res: m2 && m2.res });
  return true;
}
async function playFetch(c, m) {
  if (m.phase !== 'ready') return true;
  const pull = [0.35, 0.7, 0.98][Math.min(2, m.n)];
  const a = m.anchor;
  const [ax, ay] = toPage(c, a.x + 4, a.y), [bx, by] = toPage(c, a.x + m.maxPull * pull, a.y);
  if (m.n === 0) { await snap('v14-fetch-ready', { wait: 400 }); await checkTapHit(ax, ay, 'fetch (the stick)'); }
  await page.mouse.move(ax, ay); await page.mouse.down();
  await page.mouse.move((ax + bx) / 2, ay, { steps: 3 }); await page.mouse.move(bx, by, { steps: 3 });
  if (m.n === 1) await snap('v14-fetch-aim-ghost-arc', { force: true, wait: 120 });
  await page.mouse.up();
  V.fetch.push({ leg: curLeg + 1, n: m.n + 1, pull });
  await page.waitForTimeout(500);
  if (m.n === 0) await snap('v14-fetch-dog-runs', { force: true, wait: 300 });
  await page.waitForTimeout(1500);
  if (m.n === 2) await snap('v14-fetch-dog-flops-by-the-fire', { force: true, wait: 1800 });
  return true;
}
async function checkTapHit(px, py, what) {
  const h = await hitIsCanvas(px, py);
  if (!h.ok) note('blocks play', what, `a touch at (${Math.round(px)}, ${Math.round(py)}) lands on ${h.what}, not the canvas`);
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
  if (s.findPop && !popsSeen.has('find:' + s.findPop)) { popsSeen.add('find:' + s.findPop); await snap('v14-find-pop-' + s.findPop.slice(0, 22), { force: true, wait: 250 }); }
  if (plan.onEach) { const r = await plan.onEach(s); if (r) return r; }
  if (s.bait) return await pickBait(s);
  // ---- v1.5: the fork panel (an equal button for every way, the explainer reads them) ----
  if (s.fork) {
    await snap(`v15-fork-${s.fork}-${curJ}`, { wait: 700 });
    const info = await ev(() => ({ btns: [...document.querySelectorAll('#fk-cards .fk-go')].map((b) => { const r = b.getBoundingClientRect(); return { way: b.dataset.way, disabled: b.disabled, w: Math.round(r.width), h: Math.round(r.height), focus: document.activeElement === b }; }),
      q: (document.querySelector('#fk-q') || {}).textContent, lean: (document.querySelector('#fk-lean') || {}).textContent || '', first: (document.querySelector('#fk-first') || {}).textContent || '',
      lines: [...document.querySelectorAll('#fk-cards .fk-card')].map((c) => c.innerText.replace(/\s+/g, ' ')) }));
    const sceneNow = await ev(() => { try { const g = window.__wagonWest.scene.getState(); return { backdrop: g.backdrop, fork: g.fork }; } catch (_) { return null; } });
    const want = P.forkWay[s.fork];
    const pick = (info.btns.find((b) => b.way === want && !b.disabled) || info.btns.find((b) => !b.disabled) || {}).way;
    const sizes = new Set(info.btns.map((b) => `${b.w}x${b.h}`));
    V.v15.forks.push({ journey: curJ, leg: s.j.legId, fork: s.fork, question: info.q, lean: info.lean, first: info.first, ways: info.btns, sameSize: sizes.size === 1, focused: (info.btns.find((b) => b.focus) || {}).way || null, chose: pick, wanted: want, sceneBackdrop: sceneNow && sceneNow.backdrop, sceneFork: sceneNow && sceneNow.fork, lines: info.lines });
    if (sizes.size > 1) note('wrong', `fork ${s.fork}`, `the fork's buttons are not all the same size: ${[...sizes].join(', ')}`);
    await ev((w) => document.querySelector(`#fk-cards .fk-go[data-way="${w}"]`).click(), pick);
    await page.waitForTimeout(500);
    await snap(`v15-fork-${s.fork}-${curJ}-chosen-${pick}`, { force: true, wait: 300 });
    return 'fork';
  }
  // ---- v1.5: the creek: pan until the pans are used, the cradle at Coloma, then on ----
  if (s.dig && !s.digBusy && !s.sm && !s.card && s.marker === 'closed') {
    const pouch = await ev(() => (document.querySelector('#dg-pouch') || {}).textContent || '');
    await snap(`v15-diggings-${s.j.legId}`, { wait: 700 });
    const pick = s.digBtns.includes('pan') ? 'pan' : s.digBtns.includes('rocker') ? 'rocker' : 'leave';
    V.v15.gold.push({ journey: curJ, leg: s.j.legId, buttons: s.digBtns, pick, pouch: pouch.replace(/\s+/g, ' ').trim() });
    log(`  diggings ${s.j.legId}: ${s.digBtns.join('/')} -> ${pick} (pouch: ${pouch.replace(/\s+/g, ' ').trim()})`);
    await ev((p) => document.querySelector(`#dg-btns [data-dig="${p}"]`).click(), pick);
    await page.waitForTimeout(400);
    return 'dig-' + pick;
  }

  if (s.card) {
    { const isV15 = /toll|laurel|pit crew|gold|beaver|up the coast|choice|desert|dry|sierra|humboldt|sutter|coloma|schooner|columbia bar|spring|ice |news from|salt|claim|barlow|sublette|lander|farm|nugget|flake|pan|cradle|rocker/i.test(`${s.cardTitle} ${s.cardKicker}`);
      await snap(`${isV15 ? 'v15-' : ''}card-${s.cardTitle}`.slice(0, 60));
      if (/pit crew/i.test(s.cardTitle) && !V.v15.placement) V.v15.placement = { before: await placementProbe() }; }
    // choices the plan makes at certain cards
    let alt = false;
    if (s.cardTitle === 'Make camp tonight?' && !P.campDone.has(curLeg) && campWanted()) { alt = true; P.campDone.add(curLeg); }
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
    await snap('v14-dog-name-at-the-kansas-river');
    await page.click('#dog-coats [data-coat="spotted"]');
    for (const k of 'frodo') await page.click(`#dog-keyboard .kb-key[data-key="${k}"]`);
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
    const ways = await ev(() => [...document.querySelectorAll('#rv-opts .rv-opt')].map((b) => b.dataset.how));
    const want = P.river[s.j.legId] || 'ferry';
    const how = ways.includes(want) ? want : ways[0];
    if (!ways.includes(want)) V.v15.order.push({ j: curJ, leg: s.j.legId, note: `river: wanted ${want}, on offer ${ways.join('/')}` });
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
    await snap(`v15-stop-${s.j.legId}-talk-row`, { wait: 500 });
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
    await snap('v15-home-name-your-homestead', { wait: 400 });
    for (const k of (curJ === 3 ? 'golden claim' : 'sunny acres')) await page.click(`#hs-keyboard .kb-key[data-key="${k === ' ' ? 'space' : k}"]`);
    await snap('v15-home-name-typed', { force: true });
    await page.click('#hs-keyboard .kb-enter');
    return 'home';
  }
  if (s.screen === 'camp' && s.campCtx === 'arrival' && !s.campBusy && !s.card && !s.mini && !s.sm) return await arrivalCamp(s);
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

// ---------- v1.5: the Pit Crew Check probe, the year picker and Outfit, the farm, the marker/event/nose order ----------
/** What the child's Trail Blazer ladder says now, and the shape a word problem takes for it (SPEC v1.5 §3.9). */
async function placementProbe() {
  return ev(async () => {
    const w = window.__wagonWest, f = w.facts, JA = w.JA;
    const { LEG_BY_ID } = await import('/wagon-west/src/content/legs.js');
    const tier = JA.problemTierFor(f);
    const leg = LEG_BY_ID['fort-kearny'];
    const shape = {};
    for (const kind of ['ration', 'distance', 'buy']) {
      try { const p = JA.problemFor({ kind, fact: kind === 'buy' ? '4x12' : '7x8', leg, season: 'rookie', tier, cash: 400, rand: () => 0.37 }); shape[kind] = { steps: p.parts ? p.parts.length : 1, answers: p.answers || null, text: String(p.text || '').slice(0, 160) }; } catch (e) { shape[kind] = { error: String(e.message).slice(0, 80) }; }
    }
    return { tier, frontier: f && f.frontier ? JSON.parse(JSON.stringify(f.frontier.families || [])) : null, placed: !!(f && (f.placement || f.placed)), history: JA.hasFactsHistory ? JA.hasFactsHistory(f) : null, needs: JA.needsPlacement(f, { offered: w.save.seen.placeOffers | 0 }), offered: w.save.seen.placeOffers | 0, shape };
  });
}
/** Build what the purses allow at a farm, in the child's order; each build is played in the scene (the raising) and shot. */
async function farmRoutine(label, order) {
  await page.waitForSelector('#screen-farm:not([hidden])', { timeout: 8000 }).catch(() => note('blocks play', 'farm', `the farm screen did not open (${label})`));
  await snap(`v15-farm-${label}-arrive`, { force: true, wait: 1200 });
  const view = () => ev(() => ({ title: (document.querySelector('#farm-title') || {}).textContent, sub: (document.querySelector('#farm-sub') || {}).textContent, empty: (document.querySelector('#farm-empty') || {}).textContent || '',
    purses: [...document.querySelectorAll('.farm-purse')].map((p) => p.textContent.replace(/\s+/g, ' ').trim()), rows: [...document.querySelectorAll('.fm-row')].map((r) => ({ id: r.dataset.piece, ready: r.classList.contains('ready'), built: r.classList.contains('built'), code: r.dataset.code })), home: (() => { try { return window.__wagonWest.scene.getState().home; } catch (_) { return null; } })() }));
  const v0 = await view();
  const rec = { journey: curJ, label, before: v0, built: [] };
  V.v15.farms.push(rec);
  log(`  farm ${label}: ${v0.title} | ${v0.purses.join(' | ')} | ready: ${v0.rows.filter((r) => r.ready).map((r) => r.id).join(',')}`);
  const count = (id) => ev((id) => Object.values(window.__wagonWest.save.farm.sites).map((x) => (x.pieces && x.pieces[id]) | 0).reduce((q, r) => q + r, 0), id);
  for (const id of order) {
    const row = (await view()).rows.find((r) => r.id === id);
    if (!row || (row.built && id !== 'garden')) continue;
    if (!row.ready) { rec.built.push({ id, skipped: row.code || 'not ready' }); continue; }
    const t0 = Date.now(), before = await count(id);
    await ev((id) => document.querySelector(`[data-build="${id}"]`).click(), id);
    await page.waitForTimeout(500);
    if (['cabin', 'barn'].includes(id)) await snap(`v15-farm-${label}-raising-${id}`, { force: true, wait: 600 });
    for (let k = 0; k < 120; k++) { if ((await count(id)) > before) break; await page.waitForTimeout(150); }
    const now = await count(id);
    await page.waitForTimeout(900);
    await snap(`v15-farm-${label}-built-${id}-${now}`, { force: true, wait: 700 });
    rec.built.push({ id, ok: now > before, count: now, secs: Math.round((Date.now() - t0) / 100) / 10 });
    if (!(now > before)) note('wrong', `farm build ${id}`, `the ${id} was not built after the tap (${label})`);
    await settle(6000);
  }
  // a tap on the scene (homesteadTap) and on a piece's info line
  const c = await canvasBox();
  const [px, py] = toPage(c, c.W * 0.5, c.H * 0.62);
  await page.touchscreen.tap(px, py);
  await page.waitForTimeout(500);
  await snap(`v15-farm-${label}-tap-the-scene`, { force: true, wait: 300 });
  const info = await ev(() => { const b = document.querySelector('[data-piece-info].sel, .fm-row.built [data-piece-info]'); if (b) { b.click(); return b.dataset.pieceInfo; } return null; });
  if (info) await snap(`v15-farm-${label}-piece-info`, { force: true, wait: 400 });
  rec.after = await view();
  await snap(`v15-farm-${label}-done`, { force: true, wait: 400 });
}
const FARM_ORDER_1 = ['cabin', 'name-plate', 'fence', 'garden', 'garden', 'flowers', 'well'];
const FARM_ORDER_2 = ['cabin', 'fence', 'barn', 'name-plate', 'well', 'corral', 'orchard', 'frame-house'];
/** The title -> A new year -> where -> how hard -> Outfit (who), then the store. */
async function newYear({ route, tier, pickCompanions = null }) {
  const label = await ev(() => document.querySelector('#btn-trail-label').textContent);
  await snap(`v15-title-${label}`, { force: true, wait: 700 });
  const line = await ev(() => (document.querySelector('#title-season') || {}).textContent);
  log(`  title: "${label}" / "${line}"`);
  await ev(() => document.querySelector('#btn-trail').click());
  const onYear = await page.waitForSelector('#screen-year:not([hidden])', { timeout: 4000 }).then(() => true, () => false);
  if (onYear) {
    await snap('v15-year-where', { force: true, wait: 600 });
    const cards = await ev(() => [...document.querySelectorAll('#yr-body .yr-card')].map((b) => `${b.dataset.pick}${b.classList.contains('locked') ? ':locked' : ''}`));
    V.v15.order.push({ j: curJ, year: 'where', cards });
    await ev((r) => document.querySelector(`#yr-body [data-pick="${r}"]`).click(), route);
    await page.waitForTimeout(500);
    const how = await ev(() => document.querySelector('#yr-title').textContent === 'How hard a trail?');
    if (how) {
      await snap('v15-year-how-hard', { force: true, wait: 600 });
      const tiers = await ev(() => [...document.querySelectorAll('#yr-body .yr-card')].map((b) => `${b.dataset.pick}${b.classList.contains('locked') ? ':locked' : ''}`));
      V.v15.order.push({ j: curJ, year: 'how', cards: tiers });
      await ev((t) => document.querySelector(`#yr-body [data-pick="${t}"]`).click(), tier);
      await page.waitForTimeout(500);
    }
  }
  await outfitDrive({ pickCompanions });
}
async function outfitDrive({ pickCompanions = null } = {}) {
  for (let i = 0; i < 12; i++) {
    const vis = await ev(() => !document.querySelector('#screen-outfit').hidden);
    if (!vis) return;
    const tab = await ev(() => (document.querySelector('#ow-tabs .seg-btn.on') || {}).dataset?.tab || '');
    await snap(`${curJ > 1 || tab === 'family' ? 'v15-' : ''}outfit-${tab || 'step'}-${curJ}`, { force: true, wait: 500 });
    if (tab === 'name') {
      const hasKb = await ev(() => !!document.querySelector('#ow-keyboard'));
      const cur = await ev(() => (document.querySelector('#ow-name') || {}).textContent || '');
      if (hasKb && (!cur || /Name your wagon/.test(cur))) { for (const k of 'sunny') await page.click(`#ow-keyboard .kb-key[data-key="${k}"]`); await page.click('#ow-keyboard .kb-enter'); await page.waitForTimeout(400); continue; }
      if (hasKb) { await page.click('#ow-keyboard .kb-enter'); await page.waitForTimeout(400); continue; }       // (a later year keeps the wagon's name: Next is the keyboard's own key)
    }
    if (tab === 'family') { const f = await ev(() => { const b = document.querySelector('.ow-fam:not(.on)'); if (b) { b.click(); return b.dataset.family; } const on = document.querySelector('.ow-fam.on'); return on ? on.dataset.family : null; }); V.v15.order.push({ j: curJ, family: f }); await snap(`v15-outfit-family-picked-${curJ}`, { force: true, wait: 300 }); }
    if (tab === 'animal') { await ev(() => { const b = document.querySelector('.ow-animal[data-animal="oxen"]'); if (b && !b.classList.contains('on')) b.click(); }); }
    if (tab === 'party') {
      const comps = await ev(() => [...document.querySelectorAll('.ow-comp[data-companion]')].map((b) => ({ id: b.dataset.companion, on: b.classList.contains('on'), disabled: b.disabled })));
      const want = pickCompanions || (comps.filter((c) => c.on).length === 3 ? null : ['scout', 'cook', 'fiddler']);
      if (want) {
        for (const c of comps.filter((x) => x.on && !want.includes(x.id))) await ev((id) => document.querySelector(`.ow-comp[data-companion="${id}"]`).click(), c.id);
        for (const id of want) { const on = await ev((id) => { const b = document.querySelector(`.ow-comp[data-companion="${id}"]`); return b ? b.classList.contains('on') : null; }, id); if (on === false) await ev((id) => document.querySelector(`.ow-comp[data-companion="${id}"]`).click(), id); }
        await snap(`v15-outfit-party-${curJ}`, { force: true, wait: 400 });
      }
    }
    const next = await ev(() => { const b = document.querySelector('#ow-next'); return b && !b.disabled ? true : false; });
    if (!next) { await page.waitForTimeout(300); continue; }
    await ev(() => document.querySelector('#ow-next').click());
    await page.waitForTimeout(500);
  }
}
/** Watch a leg's days: record, per travel day, what opened and in which order (marker panel, event card, the dog's nose). Used on the short legs. */
function orderWatcherScript() {
  return () => {
    if (window.__orderWatch) return;
    const log = window.__orderLog = [];
    let lastMiles = -1, day = [];
    const flush = () => { if (day.length) log.push({ miles: lastMiles, seq: day.slice() }); day = []; };
    const tick = () => {
      const w = window.__wagonWest; if (!w) return;
      if (window.__orderTaint) { day = []; return; }       // a scripted detour (the playtest's own injected event) is not the day loop's order
      if (w.screen !== 'trail') { flush(); lastMiles = -2; return; }
      const J = w.save && w.save.journey;
      const miles = J ? Math.round(J.milesDone) : -1;
      const sm0 = w.scene && w.scene.getState && w.scene.getState().mini;
      const noseNow = !!(sm0 && /^(dogRun|dogWarn|chase)/.test(sm0.kind));
      if (!noseNow) window.__orderSkipNose = false;
      if (miles !== lastMiles) { flush(); lastMiles = miles; window.__orderAt = Date.now(); window.__orderSkipNose = noseNow; }     // (a find's dog keeps running into the next day: not that day's nose)
      const mk = w.markerPanel && w.markerPanel.state !== 'closed' && !document.querySelector('#panel-marker').hidden;
      const card = w.card && w.card.isOpen && w.card.title;
      const sm = w.scene && w.scene.getState && w.scene.getState().mini;
      const note = mk ? 'marker' : card ? 'card:' + String(card).slice(0, 24) : sm && /^(dogRun|dogWarn|chase)/.test(sm.kind) ? 'nose' : null;
      if (note === 'nose' && window.__orderSkipNose) return;
      if (note && day[day.length - 1] !== note) day.push(note);
    };
    window.__orderWatch = setInterval(tick, 40);
    window.__orderFlush = flush;
  };
}

// ---------- the special things the plan does on particular legs ----------
async function onTrailIdle(s) {
  const L = s.j.legId;
  const once = (k) => { k = curJ + ':' + k; if (P.specials.has(k)) return false; P.specials.add(k); return true; };
  const undo = (k) => P.specials.delete(curJ + ':' + k);
  const miles = s.j.milesDone;
  { const r = await v14Detours(s, once); if (r) return r; }
  if (curJ !== 1) return null;
  if (L === 'kansas-river' && miles > 25 && once('hud-tour')) {
    if (!idle(await W())) { undo('hud-tour'); return null; }
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
    if (!wopen) { await settle(); undo('hud-tour'); P.tourTries = (P.tourTries || 0) + 1; if (P.tourTries >= 3) note('wrong', 'wagon panel', 'tapping the food box did not open the Wagon panel (3 tries)'); return 'tour-retry'; }
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
  if (L === 'fort-kearny' && miles > 30 && once('stampede')) { await snap('before-stampede', { force: true }); await ev(() => window.__wagonWest.app && window.__wagonWest.playEvent('stampede')); await settle(90000); return 'stampede'; }
  if (L === 'fort-kearny' && miles > 70 && once('hunt-event')) { await ev(() => window.__wagonWest.playEvent('hunt')); await settle(90000); return 'hunt'; }
  if (L === 'fort-kearny' && miles > 100 && once('trade-event')) { await ev(() => window.__wagonWest.playEvent('trade')); await settle(60000); return 'trade'; }
  if (L === 'ash-hollow' && miles > 30 && once('axle')) { await ev(() => window.__wagonWest.playEvent('axle')); await settle(40000); await snap('after-breakdown', { force: true }); return 'axle'; }
  if (false && L === 2 && miles > 70 && once('fish-event')) { await ev(() => window.__wagonWest.playEvent('fish')); await settle(170000); return 'fish'; }
  if (L === 'chimney-rock' && miles > 25 && once('camp-tour')) { return await campTour(['fish', 'hunt', 'cards', 'tales', 'rest']); }
  if (L === 'north-platte' && miles > 40 && once('storm-forecast')) { await ev(() => window.__wagonWest.playEvent('storm')); await settle(60000); return 'storm'; }
  if (L === 'blue-mountains' && miles > 40 && once('snow')) { await ev(() => window.__wagonWest.playEvent('snow')); await settle(60000); return 'snow'; }
  if (L === 'independence-rock' && miles > 30 && once('pause-camp-stop')) { return await pauseCampStop(); }
  if (L === 'green-river' && miles > 30 && once('dog-berries')) { const r = await ev(() => window.__wagonWest.dogBerries()); if (r) await settle(40000); return 'dog-berries'; }
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
    const v = /^(finds|fish)$/.test(t) ? 'v14-' : '';
    await snap(`${v}journal-${t}`, { force: true, wait: 500 });
    await ev(() => { const b = document.querySelector('#jr-body'); if (b) b.scrollTop = b.scrollHeight; });
    await snap(`${v}journal-${t}-scrolled`, { force: true, wait: 300, audits: false });
    if (v) {
      const txt = await ev(() => (document.querySelector('#jr-body') || {}).innerText || '');
      texts[`JOURNAL ${t.toUpperCase()} PAGE`] = txt.replace(/\s+/g, ' ');
    }
    if (t === 'cards') { await ev(() => { const b = document.querySelector('#jr-body'); if (b) b.scrollTop = 0; }); const suits = await ev(() => [...document.querySelectorAll('#jr-body .suit, #jr-body h3, #jr-body .hud-label')].map((e) => e.textContent.trim()).slice(0, 12)); texts['JOURNAL CARDS SUITS'] = suits; }
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
const BIOME_SHOT = new Set();
/** Generic v1.5 things any leg may show on an idle trail: the new biomes, a dry stretch, the Sierra, Laurel Hill's road. */
async function v15Idle(s, once) {
  const miles = s.j.milesDone, id = s.j.legId;
  const st = await ev(() => { const w = window.__wagonWest; let g = null; try { g = w.scene.getState(); } catch (_) { /* ignore */ } let i = null; try { i = w.scene.debugInfo(); } catch (_) { /* ignore */ } return g && { biome: g.biome, dry: g.dry, backdrop: g.backdrop, barrel: i && i.barrel, packMules: i && i.packMules }; });
  if (st && st.biome && !BIOME_SHOT.has(st.biome) && miles > 18 && once('biome-' + st.biome)) { BIOME_SHOT.add(st.biome); await snap(`v15-trail-${st.biome}-${id}`, { force: true, wait: 500 }); return 'biome'; }
  if (st && st.dry && once('dry-' + id)) {
    const upg = await ev(() => { const J = window.__wagonWest.save.journey; return { barrel: !!(J.upgrades && J.upgrades.barrel), spirit: J.spirit }; });
    V.v15.dry.push({ journey: curJ, leg: id, miles, sceneDry: st.dry, sceneBarrel: st.barrel, hasBarrel: upg.barrel });
    log(`  dry stretch ${id}: scene dry=${JSON.stringify(st.dry)} barrel drawn=${st.barrel} wagon has barrel=${upg.barrel}`);
    await snap(`v15-dry-stretch-${id}`, { force: true, wait: 600 });
    return 'dry';
  }
  if (id === 'sierra-summit' && miles > 25 && once('sierra')) { await snap('v15-trail-sierra-summit', { force: true, wait: 500 }); return 'sierra'; }
  if (st && st.packMules && once('mules')) { await snap(`v15-trail-pack-mules-${id}`, { force: true, wait: 500 }); return 'mules'; }
  return null;
}
/** The days of the leg that just ended, in the order things opened (marker, event card, the dog's nose). */
async function takeOrderLog(legId, miles) {
  const log_ = await ev(() => { if (window.__orderFlush) window.__orderFlush(); const l = window.__orderLog || []; const out = l.splice(0); if (window.__orderFlush) window.__orderFlush(); return out.concat(l.splice(0)); }).catch(() => []);
  const days = log_.filter((d) => d.seq.length > 1);
  const bad = days.filter((d) => { const q = d.seq; const mi = q.indexOf('marker'), ci = q.findIndex((x) => x.startsWith('card:')), ni = q.indexOf('nose'); return (mi >= 0 && ci >= 0 && ci < mi) || (mi >= 0 && ni >= 0 && ni < mi) || (ci >= 0 && ni >= 0 && ni < ci); });
  V.v15.order.push({ j: curJ, leg: legId, miles, daysWithSeveral: days.map((d) => `${d.miles}: ${d.seq.join(' > ')}`), outOfOrder: bad.map((d) => `${d.miles}: ${d.seq.join(' > ')}`) });
  if (bad.length) note('wrong', `order on ${legId}`, `a day opened out of order (marker, then event, then nose): ${bad.map((d) => d.seq.join(' > ')).join(' | ')}`);
  return days.length;
}

async function playJourney(n, { label, maxLegs = MAX_LEGS, startLeg = 0 }) {
  curJ = n; curLeg = startLeg;
  let legN = startLeg;
  for (;;) {
    curLeg = legN;
    const jInfo = await ev(() => { const J = window.__wagonWest.save.journey; return J && { id: J.legId, miles: J.milesDone, route: J.route, tier: J.tier, year: J.year, plan: (J.plan || []).length }; });
    log(`===== journey ${n} (${label}) leg ${legN + 1}: ${jInfo && jInfo.id} (plan ${jInfo && jInfo.plan} legs) =====`);
    const plan = { onEach: async (s) => {
      if (n === 1 && V.v15.placement && !V.v15.placement.after && s.screen !== 'players') {
        const took = await ev(() => { const l = window.__wagonWest.lastPlacement; return !!(l && l.took); });
        if (took) { V.v15.placement.after = await placementProbe(); log('  pit crew check taken: ' + JSON.stringify({ before: V.v15.placement.before.tier, after: V.v15.placement.after.tier })); }
      }
      if (idle(s) && s.j) {
        try { const r2 = await v15Idle(s, (k) => { k = curJ + ':' + k; if (P.specials.has(k)) return false; P.specials.add(k); return true; }); if (r2) return r2; } catch (e) { note('script', 'v15Idle', String(e.message).slice(0, 200)); }
        await ev(() => { window.__orderTaint = true; });
        try { const r = await onTrailIdle(s); if (r) return r; } catch (e) { note('script', 'special', 'a scripted detour failed: ' + String(e.message).slice(0, 200), await snap('special-failed', { force: true }).catch(() => '')); }
        finally { await ev(() => { window.__orderTaint = false; }).catch(() => {}); }
      }
      return null;
    } };
    const t0 = Date.now();
    await playUntil((s) => s.screen === 'results', plan, 600000, `J${n} leg ${legN + 1}`);
    await releaseMouse();
    const secs = Math.round((Date.now() - t0) / 1000);
    const rj = await ev(() => { const w = window.__wagonWest, J = w.save.journey; return { legId: J.legId, miles: ((window.__wagonWest.JA.currentLeg && window.__wagonWest.JA.currentLeg(J)) || {}).miles, done: !!J.done, cash: J.cash, food: Math.round(J.food), tokens: J.tokens, cards: (J.cards || []).length, deeds: (J.deeds || []).length, gold: J.gold, tier: J.tier, year: J.year, route: J.route, branches: J.branches, planLen: (J.plan || []).length, limp: J.limp }; });
    rj.legId = jInfo && jInfo.id || rj.legId;
    const nOrder = await takeOrderLog(rj.legId, rj.miles);
    V.v15.journeys.push({ journey: n, leg: legN + 1, ...rj, secs, orderDays: nOrder });
    const perf = await ev(() => { const sc = window.__wagonWest.scene; return sc && sc.debugPerf ? sc.debugPerf(true) : null; });
    if (perf && (perf.avgDraw + perf.avgUpdate > 8)) note('ugly', `J${n} leg ${legN + 1} perf`, `scene averages ${(perf.avgDraw + perf.avgUpdate).toFixed(1)} ms/frame of game code (budget 8 ms) in headless Chromium`);
    const newRes = rj.done || rj.gold > 0 || n > 1 && /sierra|desert|barlow|humboldt|clear|feather|coloma|sutter|home-by-sea/.test(rj.legId);
    await snap(`${newRes ? 'v15-' : ''}results-${rj.legId}`, { force: true, wait: 900 });
    const crate = await ev(() => !!document.querySelector('#res-crate-open'));
    if (crate) { await ev(() => document.querySelector('#res-crate-open').click()); await snap('results-crate-open', { force: true, wait: 800 }); }
    await ev(() => { const r = document.querySelector('.res-body, #screen-results .scroll'); if (r) r.scrollTop = 9999; });
    await snap(`${newRes ? 'v15-' : ''}results-${rj.legId}-scrolled`, { force: true, wait: 300, audits: false });
    log(`  leg ${legN + 1} (${rj.legId}) done in ${secs}s: cash $${rj.cash} food ${rj.food} tokens ${rj.tokens} cards ${rj.cards} deeds ${rj.deeds} gold ${rj.gold}${rj.done ? '  [JOURNEY DONE]' : ''}`);
    try { writeFileSync(path.join(SHOTS, `state-after-J${n}-leg-${legN + 1}.json`), JSON.stringify(await ctxRef.storageState())); } catch (_) { /* ignore */ }
    legN++;
    if (rj.done || legN >= maxLegs) { return rj; }
    // title visits at a few points (journal tour, Outfit upgrades): on journey 1 only
    if (n === 1 && (legN === 2 || legN === 8 || legN === 15)) {
      await journalTour();
      const onTitle = await ev(() => !document.querySelector('#screen-title').hidden);
      inTitleTour = true;
      if (onTitle) { await titleExtras(); if (legN === 2) await outfitUpgrades(); }
      inTitleTour = false;
      const scr = await ev(() => window.__wagonWest.screen);
      if (scr === 'title') await ev(() => document.querySelector('#btn-trail').click());
      else if (scr === 'results') await ev(() => document.querySelector('#res-next').click());
    } else await ev(() => document.querySelector('#res-next').click());
    await page.waitForTimeout(400);
  }
}
/** After a trail's end: results -> (the bank card) -> name the farm -> the farm screen: build -> back to the title. */
async function endOfTrail(label, order, rj) {
  await snap(`v15-bank-card-${label}`, { force: true, wait: 400 });
  const bank = await ev(() => { const el = document.querySelector('#res-extra, .res-bank'); return { text: document.querySelector('#screen-results').innerText.replace(/\s+/g, ' ').slice(0, 600) }; });
  V.v15.banks.push({ journey: curJ, label, ...bank });
  await ev(() => document.querySelector('#res-next').click());
  await playUntil((s) => s.screen === 'farm', {}, 120000, `to the farm ${label}`);
  await farmRoutine(label, order);
  await ev(() => document.querySelector('#screen-farm [data-back]').click());
  await page.waitForSelector('#screen-title:not([hidden])', { timeout: 6000 }).catch(() => note('wrong', 'farm back', 'Back from the farm did not reach the title'));
  await snap(`v15-title-after-${label}`, { force: true, wait: 900 });
  const map = await ev(() => ({ farms: [...document.querySelectorAll('#title-map .map-farm')].map((g) => `${g.dataset.site}:${g.dataset.stage}`), line: (document.querySelector('#title-season') || {}).textContent, btn: document.querySelector('#btn-trail-label').textContent }));
  V.v15.farms.push({ journey: curJ, label: label + ' (title map)', map });
  log('  title after the farm: ' + JSON.stringify(map));
  try { writeFileSync(path.join(SHOTS, `state-after-J${curJ}-farm.json`), JSON.stringify(await ctxRef.storageState())); } catch (_) { /* ignore */ }
}
let ctxRef = null;

async function main() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: !process.env.HEADED });
  const ctx = await browser.newContext({ viewport: PORTRAIT ? { width: 390, height: 844 } : { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...(RESUME ? { storageState: RESUME } : {}) });
  ctxRef = ctx;
  await routeFonts(ctx);
  page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text() + (m.location().url || ''))) { errors.push(m.text()); note('console', `J${curJ} leg ${curLeg + 1}`, 'console error: ' + m.text().slice(0, 220)); } });
  page.on('pageerror', (e) => { errors.push(e.message); note('console', `J${curJ} leg ${curLeg + 1}`, 'page error: ' + e.message.slice(0, 220)); });
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
    await page.evaluate(orderWatcherScript());
    const sceneName = await ev(() => window.__wagonWest.app.sceneName);
    log('scene:', JSON.stringify(sceneName), '(empty = the real scene)');
    if (sceneName) note('script', 'boot', `the app fell back to "${sceneName}", not the real scene`);

    if (RESUME) {
      await page.waitForSelector('#screen-players:not([hidden])');
      await page.click('[data-player]');
      await page.waitForSelector('#screen-title:not([hidden])');
      if (START_LEG > 0 && JOURNEYS.includes(RESUME_J)) {      // carry on a journey that was saved mid-way (RESUME_J, START_LEG = the legs already played)
        const T = { 1: [{ 'fort-hall': 'oregon', 'the-dalles': 'barlow' }, 'willamette', FARM_ORDER_1], 2: [{}, 'gold-road-home', FARM_ORDER_2], 3: [{ 'south-pass': 'main', 'fort-hall': 'california', 'the-dalles': 'columbia' }, 'sacramento', ['cabin', 'name-plate', 'fence', 'garden']] }[RESUME_J];
        P.forkWay = T[0]; curJ = RESUME_J;
        await page.click('#btn-trail');
        const rjR = await playJourney(RESUME_J, { label: `journey ${RESUME_J} (resumed)`, startLeg: START_LEG });
        if (rjR.done) { await endOfTrail(T[1], T[2], rjR); await journalTour(); const scr = await ev(() => window.__wagonWest.screen); if (scr !== 'title') { await ev(() => { const b = document.querySelector('#res-next'); if (b) b.click(); }); await page.waitForTimeout(800); } }
      }
    } else {
      // ---- picker + new player ----
      await page.waitForSelector('#screen-players:not([hidden])');
      await snap('players');
      await page.click('#pl-add');
      await page.waitForSelector('#screen-newplayer:not([hidden])');
      await snap('newplayer');
      for (const k of 'ava') await page.click(`#np-keyboard .kb-key[data-key="${k}"]`);
      await page.click('#np-keyboard .kb-enter');
      await page.waitForSelector('#screen-title:not([hidden])');
      await snap('title-first', { wait: 600 });
      await page.click('#btn-trail');
      await page.waitForSelector('#screen-outfit:not([hidden])');
      await outfitDrive();
    }

    // ================= JOURNEY 1: the 20-leg Oregon trail, the Barlow Road at The Dalles =================
    if (JOURNEYS.includes(1) && !RESUME) {
      P.forkWay = { 'fort-hall': 'oregon', 'the-dalles': 'barlow' };
      curJ = 1;
      if (PITCH_ONLY) {
        const pre = await placementProbe();
        log('PIT CREW (fresh profile): ' + JSON.stringify(pre));
        V.v15.placement = { before: pre };
        await playUntil(async (s) => { const l = await ev(() => { const x = window.__wagonWest.lastPlacement; return !!(x && x.took); }); return l; }, {}, 240000, 'pit crew check');
        await page.waitForTimeout(800);
        V.v15.placement.after = await placementProbe();
        log('PIT CREW (after): ' + JSON.stringify(V.v15.placement.after));
        writeFileSync(path.join(SHOTS, 'pit-check.json'), JSON.stringify(V.v15.placement, null, 1));
        throw new Error('PITCH_ONLY done');
      }
      const rj1 = await playJourney(1, { label: 'Oregon, the Barlow Road' });
      if (rj1.done) {
        await endOfTrail('willamette', FARM_ORDER_1, rj1);
        await journalTour();
        const scr = await ev(() => window.__wagonWest.screen);
        if (scr !== 'title') { await ev(() => { const b = document.querySelector('#res-next'); if (b) b.click(); }); await page.waitForTimeout(800); }
      }
    }

    // ================= JOURNEY 2: the Gold Road =================
    if (JOURNEYS.includes(2) && !(RESUME && START_LEG > 0 && RESUME_J >= 2)) {
      P.forkWay = {};
      curJ = 2; curLeg = 0;
      await newYear({ route: 'gold-road', tier: 'rookie', pickCompanions: ['packer', 'prospector', 'cook'] });
      const rj2 = await playJourney(2, { label: 'the Gold Road' });
      if (rj2.done) await endOfTrail('gold-road-home', FARM_ORDER_2, rj2);
      await journalTour();
      const scr = await ev(() => window.__wagonWest.screen);
      if (scr !== 'title') { await ev(() => { const b = document.querySelector('#res-next'); if (b) b.click(); }); await page.waitForTimeout(800); }
    }

    // ================= JOURNEY 3: California at Veteran =================
    if (JOURNEYS.includes(3) && !(RESUME && START_LEG > 0 && RESUME_J >= 3)) {
      P.forkWay = { 'south-pass': 'main', 'fort-hall': 'california', 'the-dalles': 'columbia' };
      curJ = 3; curLeg = 0;
      await newYear({ route: 'emigrant', tier: 'veteran' });
      const rj3 = await playJourney(3, { label: 'California, Veteran' });
      if (rj3.done) await endOfTrail('sacramento', ['cabin', 'name-plate', 'fence', 'garden'], rj3);
      await journalTour();
      await snap('v15-title-after-three-journeys', { force: true, wait: 800 });
    }

    // ---- Parent Zone: the journeys table and the farm line ----
    const onTitle = await ev(() => !document.querySelector('#screen-title').hidden);
    if (onTitle) {
      await page.click('#btn-parents');
      await page.waitForSelector('#pz:not([hidden])');
      for (let k = 0; k < 2; k++) { for (const d of '1234') await page.click(`.pinpad [data-digit="${d}"]`); await page.waitForTimeout(300); }
      await page.waitForSelector('.pz-tabs', { timeout: 5000 });
      const tabs = await ev(() => [...document.querySelectorAll('.pz-tabs .seg-btn')].map((b) => b.dataset.tab));
      for (const t of tabs) {
        await ev((t) => document.querySelector(`.pz-tabs [data-tab="${t}"]`).click(), t);
        await snap(`${t === 'journey' || t === 'options' ? 'v15-' : ''}pz-${t}`, { force: true, wait: 700, audits: false });
        if (t === 'journey') texts['PARENT JOURNEY TAB'] = await ev(() => document.querySelector('#pz').innerText.replace(/\s+/g, ' '));
        if (t === 'report') texts['PARENT REPORT FULL PAGE'] = await ev(() => document.querySelector('#pz').innerText.replace(/\s+/g, ' '));
      }
      await ev(() => document.querySelector('#pz-close').click());
    }
    const final = await ev(() => { const w = window.__wagonWest; const J = w.save.journey; return { ledger: w.save.ledger, farm: w.save.farm, setsDone: w.save.setsDone, cosmetics: w.save.cosmetics, journey: J && { dog: J.dog, deeds: J.deeds, cards: (J.cards || []).length, tokens: J.tokens, route: J.route, tier: J.tier, year: J.year, branches: J.branches, gold: J.gold }, seen: w.save.seen, deedsAll: (w.save.deeds || null) }; });
    writeFileSync(path.join(SHOTS, 'final-state.json'), JSON.stringify(final, null, 1));
    V.final = final;
  } catch (e) {
    if (!/PITCH_ONLY done/.test(String(e && e.message))) { note('script', 'run aborted', String(e && e.stack || e).slice(0, 500)); try { await snap('ABORT', { force: true }); } catch (_) { /* ignore */ } }
  } finally {
    try { writeFileSync(path.join(SHOTS, 'spoken.json'), JSON.stringify(await ev(() => window.__spoken || []), null, 1)); } catch (_) { /* ignore */ }
    writeFileSync(path.join(SHOTS, 'findings.json'), JSON.stringify(findings, null, 1));
    try { writeFileSync(path.join(SHOTS, 'v15-summary.json'), JSON.stringify({ ...V, campSeen: [...V.campSeen] }, null, 1)); } catch (_) { /* ignore */ }
    writeFileSync(path.join(SHOTS, 'texts.json'), JSON.stringify(texts, null, 1));
    writeFileSync(path.join(SHOTS, 'console-errors.json'), JSON.stringify(errors, null, 1));
    await browser.close();
  }
  const by = {};
  for (const f of findings) by[f.kind] = (by[f.kind] || 0) + 1;
  log('DONE. shots:', seq, 'findings by kind:', JSON.stringify(by));
}
main().catch((e) => { console.error(e); process.exit(1); });

// Parent Zone (Parents on the player picker and the title; PIN-gated with the family's PIN, the same one as Spell Jump,
// Trail Blazer and Fraction Fright). First open on a device with no PIN: set a 4-digit PIN (twice). Later: enter it.
// "Forgot PIN": press and hold 3 s, then answer a 2-digit × 2-digit multiplication, then set a new PIN. The same flow
// as Fraction Fright's src/ui/parentZone.js.
// Tabs (SPEC §12): Family code (opens first; works with no players; a strip per child "Wagon West this week · …") ·
// Journey (per player: where they are, the party, reset the journey) · Options (this device: sound, music, motion,
// hunting on / off, fractions at rivers on / off; the voice as set in Spell Jump; Change PIN) · Report (legs, markers
// right %, problems right by kind, words right, the progress chart from Spell Jump's src/ui/chart.js with a per-day
// log, the letters home, Copy report) · Players (rename, reset Wagon West progress, remove). Native text inputs exist
// only here (family code, player names).
// v1.1: Options → the voice line says which engine reads the game ("Natural voice: Ava · 312 clips ready" when the
// natural voice is picked in Spell Jump and the family has a code, else "Device voice"), and "Say a test line" speaks
// one line and reports which engine spoke it (tts.engine).
// v1.4: Options → "Far-off sounds on the trail" (rifles at a distance, wolves, a bear on a ridge, a prairie fire; default on) and
// Report → one "Trail fun" line (finds, fish, biggest fish, best skips, quests given back). This tab is grown-up text, outside the
// kid-rule audits, so the switch may name what it turns off.
// v1.5 (The Long Trail, SPEC v1.5 §5.7): Journey shows the route, the tier, the year and the forks chosen, a table of the journeys finished (year ·
// route · tier · stars), the farm in one line ("Willamette farm: 9 of 18 pieces"), whether the Pit Crew Check was offered, "Reset this journey only" (the
// farm, the ledger, the cards and the sets stay) and the full reset (which says it clears the farm too); Options has "Let the child choose how hard"
// (on; off = Rookie only) and "Gold panning" (on; off = the gold is given as a find); Report has the legs by route, and Copy report adds the route and
// the tier.
import { checkPin, hasPin, playerById, renamePlayer, setPin } from '../../../spell-jump/src/spelling/profiles.js';
import { cloudVoiceInfo } from '../../../spell-jump/src/tts/voices.js';
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { icon } from '../../../spell-jump/src/ui/icons.js';
import { FAMILY_MUSIC_HELP, FAMILY_MUSIC_LABEL, familyMusicIsOn, setFamilyMusic } from '../../../spell-jump/src/ui/musicNote.js';
import { dayChart, lastDays, rangeChips } from '../../../spell-jump/src/ui/chart.js';
import { ANIMAL_BY_ID, LEG_BY_ID } from '../content/legs.js';
import { ROUTES, SITES } from '../content/routes.js';
import { TIER_BY_ID } from '../content/tiers.js';
import { homesteadView } from '../journey/homestead.js';
import { routeOfLeg } from '../journey/route.js';
import { COMPANION_BY_ID } from '../content/companions.js';
import { FINDS } from '../content/finds.js';
import { FISH, FISH_BY_ID } from '../content/fish.js';
import { QUESTS } from '../content/quests.js';
import { PROBLEM_KINDS } from '../meta/save.js';
import { drawAvatar } from './players.js';

const HOLD_MS = 3000;
export const SAVE_NOTE = "One family code syncs all four games: the players and the PIN, and each child's Spell Jump, Trail Blazer, Fraction Fright and Wagon West progress (the journey, the journal, the facts and the words). Nothing is lost when two devices played offline: the progress is merged.";
export const SYNCED_LINE = 'Synced · players and all four games';
export const KIND_LABEL = { buy: 'Buying (×)', divide: 'Sharing out (÷)', ration: 'Rations', distance: 'Distance', parts: 'Repairs', trade: 'Trading', fact: 'Trail facts' };

function toggle(label, sub, on, onChange, id) {
  const t = h('button', { class: 'toggle', role: 'switch', 'aria-checked': String(!!on), 'aria-label': label, id });
  t.addEventListener('click', () => { const v = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', String(v)); onChange(v); });
  return h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, label), sub ? h('div', { class: 'sub' }, sub) : null), t);
}
function confirmRow(label, sub, buttonText, question, yesText, onYes, id) {
  const box = h('div', { class: 'confirm', hidden: true },
    h('p', {}, question),
    h('div', { class: 'btns' },
      h('button', { class: 'btn btn-sm', onclick: () => { box.hidden = true; } }, 'Cancel'),
      h('button', { class: 'btn btn-sm btn-hot', id: id + '-yes', onclick: () => { box.hidden = true; onYes(); } }, yesText)));
  const open = h('button', { class: 'btn btn-sm btn-hot', id, onclick: () => { box.hidden = false; box.scrollIntoView({ block: 'nearest' }); } }, buttonText);
  return [h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, label), sub ? h('div', { class: 'sub' }, sub) : null), open), box];
}
const pct = (a, n) => (n ? Math.round((100 * a) / n) : null);
const pctText = (a, n) => (n ? `${pct(a, n)} %` : '—');

/** The week's numbers from a save (the last 7 days of the per-day log). */
export function weekOf(save, now = Date.now()) {
  const days = lastDays(7, now);
  const w = { legs: 0, markers: 0, markersRight: 0, problems: 0, problemsRight: 0, words: 0, wordsRight: 0 };
  for (const d of days) { const p = save.play[d]; if (p) for (const k of Object.keys(w)) w[k] += p[k] || 0; }
  w.asked = w.markers + w.problems + w.words;
  w.right = w.markersRight + w.problemsRight + w.wordsRight;
  return w;
}
export const weekLine = (w) => `Wagon West this week · ${w.legs} leg${w.legs === 1 ? '' : 's'} · ${w.asked ? `${pct(w.right, w.asked)} % right` : 'nothing yet'}`;

export function createParentZone(app) {
  const root = $('#pz');
  const sheet = h('div', { class: 'pz-sheet card', role: 'dialog', 'aria-labelledby': 'pz-h' });
  const head = h('div', { class: 'pz-head' });
  const syncLine = h('button', { class: 'pz-sync-line', id: 'pz-sync-line', 'data-sfx': '', hidden: true });
  syncLine.addEventListener('click', () => { if (tab !== 'sync') { tab = 'sync'; render(); body.scrollTop = 0; } });
  const body = h('div', { class: 'pz-body scroll', id: 'pz-body' });
  sheet.append(head, syncLine, body);
  root.replaceChildren(sheet);

  let view = 'pin', tab = 'sync', unlockedUntil = 0, lineTimer = 0, joined = null, playerId = null;
  let pinMode = 'enter', pinFirst = '', pinEntry = '', mathQ = null, mathEntry = '', holdTimer = 0, holdRaf = 0;

  const vv = window.visualViewport;
  function fitViewport() {
    if (!vv) return;
    root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
    root.style.setProperty('--vvt', `${Math.round(vv.offsetTop)}px`);
  }
  if (vv) { vv.addEventListener('resize', fitViewport); vv.addEventListener('scroll', fitViewport); }

  function header(title, { back = null } = {}) {
    const close = h('button', { class: 'btn icon-btn', id: 'pz-close', 'aria-label': 'Close', 'data-sfx': '', html: icon('close') });
    close.addEventListener('click', () => api.close());
    const kids = [];
    if (back) { const b = h('button', { class: 'btn icon-btn', id: 'pz-back', 'aria-label': 'Back', 'data-sfx': '', html: icon('back') }); b.addEventListener('click', back); kids.push(b); }
    kids.push(h('h3', { id: 'pz-h' }, h('span', { html: icon('lock') }), title), close);
    head.replaceChildren(...kids);
  }

  // ---------- PIN (the family's, shared with the other games) ----------
  function pad(onDigit, onBack, okLabel, onOk) {
    const g = h('div', { class: 'pinpad' });
    const guard = (fn) => (e) => { const b = e.currentTarget; const pressed = b.dataset.pressed === '1'; b.dataset.pressed = ''; if (pressed || e.detail === 0) fn(e); };
    g.addEventListener('pointerdown', (e) => { const k = e.target.closest('.pin-key'); if (k) k.dataset.pressed = '1'; });
    for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) g.append(h('button', { class: 'btn pin-key', 'data-digit': d, onclick: guard(() => onDigit(d)) }, d));
    g.append(h('button', { class: 'btn pin-key', 'aria-label': 'Delete', id: 'pin-back', onclick: guard(onBack), html: icon('back') }));
    g.append(h('button', { class: 'btn pin-key', 'data-digit': '0', onclick: guard(() => onDigit('0')) }, '0'));
    g.append(okLabel ? h('button', { class: 'btn btn-go pin-key', id: 'pin-ok', onclick: guard(onOk) }, okLabel) : h('span'));
    return g;
  }
  const dots = (n) => h('div', { class: 'pin-dots', 'aria-label': `${n} of 4 digits` }, ...[0, 1, 2, 3].map((i) => h('i', { class: i < n ? 'on' : '' })));
  function pinView(error = '') {
    header('Parent Zone');
    const titles = { set: 'Choose a 4-digit PIN', confirm: 'Type the PIN again', enter: 'Enter the parent PIN', reset: 'Choose a new 4-digit PIN', resetConfirm: 'Type the new PIN again' };
    const sub = { set: 'Grown-ups only. The same PIN opens Parents in all four games.', enter: 'The same PIN as in Spell Jump, Trail Blazer and Fraction Fright.', reset: 'Answered correctly. Now pick a new PIN.' };
    const onDigit = (d) => {
      if (pinEntry.length >= 4) return;
      pinEntry += d; app.audio.click();
      if (pinEntry.length === 4) setTimeout(submitPin, 120);
      pinView();
    };
    const onBack = () => { pinEntry = pinEntry.slice(0, -1); pinView(); };
    const kids = [h('div', { class: 'pin-title', id: 'pin-title' }, titles[pinMode]),
      sub[pinMode] ? h('div', { class: 'pin-sub' }, sub[pinMode]) : null,
      dots(pinEntry.length),
      error ? h('div', { class: 'pin-err', id: 'pin-err' }, error) : null,
      pad(onDigit, onBack)];
    if (pinMode === 'enter') {
      const forgot = h('button', { class: 'btn btn-sm', id: 'pin-forgot', 'data-sfx': '' }, 'Forgot PIN?');
      forgot.addEventListener('click', () => { view = 'hold'; render(); });
      kids.push(forgot);
    }
    body.replaceChildren(h('div', { class: 'pin-wrap', 'data-pin-mode': pinMode }, ...kids));
  }
  function submitPin() {
    const pin = pinEntry;
    pinEntry = '';
    if (pinMode === 'enter') {
      if (checkPin(app.family, pin)) { unlock(); return; }
      app.audio.error(); pinView('That PIN is not right.'); return;
    }
    if (pinMode === 'set' || pinMode === 'reset') { pinFirst = pin; pinMode = pinMode === 'set' ? 'confirm' : 'resetConfirm'; pinView(); return; }
    if (pin !== pinFirst) { pinMode = pinMode === 'confirm' ? 'set' : 'reset'; app.audio.error(); pinView('The two PINs did not match. Try again.'); return; }
    setPin(app.family, pin);
    app.toast('PIN saved');
    unlock();
  }
  function unlock() { unlockedUntil = Date.now() + 5 * 60000; view = 'main'; render(); }

  function holdView() {
    header('Forgot PIN', { back: () => { view = 'pin'; render(); } });
    const ring = h('div', { class: 'hold-ring', style: { '--p': '0' } });
    const btn = h('button', { class: 'btn hold-btn', id: 'pin-hold' }, ring, h('span', {}, 'Press and hold'));
    const stop = () => { clearTimeout(holdTimer); cancelAnimationFrame(holdRaf); ring.style.setProperty('--p', '0'); btn.classList.remove('is-down'); };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      btn.classList.add('is-down');
      const t0 = performance.now();
      const tick = () => { ring.style.setProperty('--p', String(Math.min(1, (performance.now() - t0) / HOLD_MS))); holdRaf = requestAnimationFrame(tick); };
      tick();
      holdTimer = setTimeout(() => { stop(); newMath(); view = 'math'; render(); }, HOLD_MS);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, stop);
    body.replaceChildren(h('div', { class: 'pin-wrap' },
      h('div', { class: 'pin-title' }, 'Hold the button for 3 seconds'),
      h('div', { class: 'pin-sub' }, 'Then answer a grown-up math question to set a new PIN.'),
      btn));
  }
  function newMath() {
    const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    let a = r(12, 98), b = r(12, 98);
    while (a % 10 === 0) a = r(12, 98);
    while (b % 10 === 0) b = r(12, 98);
    mathQ = { a, b }; mathEntry = '';
  }
  function mathView(error = '') {
    header('Forgot PIN', { back: () => { view = 'pin'; render(); } });
    const onDigit = (d) => { if (mathEntry.length < 4) { mathEntry += d; app.audio.click(); mathView(); } };
    const onBack = () => { mathEntry = mathEntry.slice(0, -1); mathView(); };
    const onOk = () => {
      if (Number(mathEntry) === mathQ.a * mathQ.b) { pinMode = 'reset'; pinEntry = ''; view = 'pin'; render(); return; }
      app.audio.error(); newMath(); mathView('Not quite. Here is a new one.');
    };
    body.replaceChildren(h('div', { class: 'pin-wrap' },
      h('div', { class: 'pin-title', id: 'math-q', 'data-a': String(mathQ.a), 'data-b': String(mathQ.b) }, `${mathQ.a} × ${mathQ.b} = ?`),
      h('div', { class: 'math-entry', id: 'math-entry' }, mathEntry || ' '),
      error ? h('div', { class: 'pin-err' }, error) : null,
      pad(onDigit, onBack, 'OK', onOk)));
  }

  // ---------- main ----------
  function sectionTabs() {
    const row = h('div', { class: 'seg pz-tabs', role: 'tablist' });
    for (const [id, text, more] of [['sync', 'Family', ' code'], ['journey', 'Journey'], ['options', 'Options'], ['report', 'Report'], ['players', 'Players']]) {
      const b = h('button', { class: 'seg-btn' + (tab === id ? ' on' : ''), role: 'tab', 'aria-selected': String(tab === id), 'data-tab': id, 'aria-label': text + (more || '') },
        text, ...(more ? [h('span', { class: 'tab-more' }, more)] : []));
      b.addEventListener('click', () => { tab = id; render(); });
      row.append(b);
    }
    return row;
  }
  function playerTabs() {
    const row = h('div', { class: 'pz-players', role: 'tablist', 'aria-label': 'Player' });
    for (const p of app.family.players) {
      const cv = h('canvas', { class: 'pz-av', 'aria-hidden': 'true' });
      const b = h('button', { class: 'pz-ptab' + (p.id === playerId ? ' on' : ''), role: 'tab', 'aria-selected': String(p.id === playerId), 'data-player': p.id }, cv, h('span', {}, p.name));
      b.addEventListener('click', () => { playerId = p.id; render(); });
      row.append(b);
      drawAvatar(cv, p.color);
    }
    return row;
  }
  function noPlayer() {
    const add = h('button', { class: 'btn btn-go', id: 'pz-add-player', 'data-sfx': '' }, 'Add a player');
    add.addEventListener('click', () => { api.close(); app.go('newplayer'); });
    return [h('div', { class: 'pz-noplayer', id: 'pz-noplayer' }, h('div', { class: 'label' }, 'No players yet'),
      h('div', { class: 'pz-help' }, 'Add one on the player screen, or join your family on the Family code tab to bring your players here.'), h('div', { class: 'pz-actions' }, add))];
  }

  // ---------- Journey: where the child is ----------
  const routeName = (id) => (id === 'gold-road' ? ROUTES['gold-road'].name : ROUTES.emigrant.name);
  const tierName = (J) => (TIER_BY_ID[J && (J.tier || J.season)] || TIER_BY_ID[(app.seasonOf(J) || {}).id] || TIER_BY_ID.rookie).name;
  const WAYS = { 'south-pass:main': 'By Fort Bridger', 'south-pass:sublette': 'The Sublette Cutoff', 'south-pass:lander': 'The Lander Road', 'fort-hall:oregon': 'On to Oregon', 'fort-hall:california': 'South to California', 'the-dalles:columbia': 'The Columbia raft', 'the-dalles:barlow': 'The Barlow Road' };
  const FORK_NAME = { 'south-pass': 'South Pass', 'fort-hall': 'Fort Hall', 'the-dalles': 'The Dalles' };
  function journeyTab(p) {
    const save = app.saveOf(p.id);
    const J = save.journey;
    const legs = (J && Array.isArray(J.plan) && J.plan.length) ? J.plan : app.legs;
    const L = save.ledger || { journeys: [] };
    let whereLine = 'Not on the trail yet: the first time, the child packs the wagon (name, animal, three companions).';
    const legAt = (i) => LEG_BY_ID[(legs[i] || {}).id] || legs[i] || {};
    if (J && J.done) whereLine = `${J.year || app.seasonOf(J).year} · ${routeName(J.route)} · ${tierName(J)} · finished${save.homestead ? ` (homestead: ${save.homestead})` : ''}`;
    else if (J) {
      const leg = legAt(J.legIndex);
      const under = save.trip && save.trip.legId === J.legId;
      whereLine = `${J.year || app.seasonOf(J).year} ${tierName(J)} · ${routeName(J.route)} · leg ${(J.legIndex || 0) + 1} of ${legs.length}: ${leg.from || ''} → ${(leg.stop && leg.stop.name) || leg.name || ''}${under ? (save.trip.stage === 'stop' ? ' (at the stop)' : ` (${money(J.milesDone || 0)} of ${money(((legs[J.legIndex] || {}).miles) || leg.miles || 0)} mi)`) : ' (next)'}`;
    }
    const out = [h('div', { class: 'where', id: 'jr-where' }, h('div', { class: 'label' }, `Where ${p.name} is`), h('div', { class: 'where-line', id: 'jr-where-line' }, whereLine),
      J ? h('div', { class: 'pz-help' }, `Day ${J.day || 0} · $${money(J.cash)} · ${money(J.food)} lb of food · ${J.tokens || 0} trade tokens · ${save.stickers.length} stickers · ${save.seasonsDone} journey${save.seasonsDone === 1 ? '' : 's'} finished`) : null)];
    if (J) {
      const animal = ANIMAL_BY_ID[J.animal] || { name: J.animal };
      const party = (Array.isArray(J.party) && J.party.length ? J.party : (J.companions || []).map((id) => ({ id, mood: J.mood })));
      out.push(h('div', { class: 'hud-label pz-sec' }, 'The route'),
        h('ul', { class: 'pat-list', id: 'jr-route' },
          h('li', { 'data-k': 'route' }, `Route: ${routeName(J.route)}`),
          h('li', { 'data-k': 'tier' }, `Difficulty: ${tierName(J)}`),
          h('li', { 'data-k': 'year' }, `Year: ${J.year || app.seasonOf(J).year} · journey ${J.journeyN || 1}`),
          h('li', { 'data-k': 'forks' }, `Forks chosen: ${Object.entries(J.branches || {}).map(([f, o]) => `${FORK_NAME[f] || f}: ${WAYS[`${f}:${o}`] || o}`).join(' · ') || 'none yet'}`)));
      out.push(h('div', { class: 'hud-label pz-sec' }, 'The party'),
        h('ul', { class: 'pat-list', id: 'jr-party' },
          h('li', {}, `Wagon: ${J.wagonName || 'unnamed'} · ${animal.name} · pace ${J.pace || 'steady'}, ${J.rations || 'plenty'} rations`),
          ...party.map((x) => { const c = COMPANION_BY_ID[x.id] || { name: x.id, role: '' }; return h('li', { 'data-companion': x.id }, `${c.name} ${c.role || ''} · ${x.mood || J.mood || 'happy'}`); })));
    }
    // the years: every journey finished, and the farms
    const rows = (Array.isArray(L.journeys) ? L.journeys : []).slice().reverse();
    out.push(h('div', { class: 'hud-label pz-sec' }, 'Journeys finished'),
      rows.length ? h('div', { class: 'pz-table-wrap' }, h('table', { class: 'pz-table', id: 'jr-journeys' },
        h('thead', {}, h('tr', {}, ...['Year', 'Route', 'Tier', 'Stars'].map((x) => h('th', {}, x)))),
        h('tbody', {}, ...rows.map((j) => h('tr', { 'data-journey': j.id }, h('td', { class: 'op' }, String(j.year)), h('td', {}, routeName(j.route)), h('td', {}, (TIER_BY_ID[j.tier] || {}).name || j.tier), h('td', {}, String(j.stars | 0)))))))
        : h('div', { class: 'pz-help', id: 'jr-journeys' }, 'No journey finished yet.'));
    const farmLines = SITES.filter((s) => save.farm && save.farm.sites && save.farm.sites[s.id]).map((s) => { const v = homesteadView(save.farm, s.id, J); return `${s.name}${save.farm.sites[s.id].name ? ` “${save.farm.sites[s.id].name}”` : ''}: ${v.built} of ${v.of} pieces`; });
    out.push(h('div', { class: 'pz-help', id: 'jr-farm' }, farmLines.length ? farmLines.join(' · ') : 'No homestead yet: the first trail’s end founds one.'));
    out.push(h('div', { class: 'pz-help', id: 'jr-placement' }, app.placementLine(p.id)));
    if (J) {
      out.push(h('div', { class: 'pz-help pz-sec' }, 'One leg is one session (8 to 14 minutes): about five mile-marker facts from the Trail Blazer ladder, three or four word problems made from facts the child knows, and three spelling words from the Spell Jump list (at a river, a ferry or in a letter). A miss never costs the leg: a slower day, or the same fair price. The word problems’ shape follows the ladder: big-number children get two-step rations and distances and change-back buys.'));
      out.push(...confirmRow('Reset this journey only', `Start ${p.name}'s current journey over from mile 0 (same wagon, team and party). The farm, the journeys finished, the trail cards and the card sets stay.`, 'Reset this journey',
        `Start ${p.name}'s journey over? The farm and the cards stay.`, 'Reset this journey', () => { app.resetJourneyFor(p.id); app.toast('Journey reset'); render(); }, `pz-reset-journey-${p.id}`));
    }
    out.push(...confirmRow('Reset everything', `Back to the very start for ${p.name}: the journey, the farm, the journeys finished, the cards and sets, the journal and the looks all clear. The other games, the facts and the words are not touched.`, 'Reset all',
      `Clear ${p.name}'s whole Wagon West, farm included?`, 'Clear everything', () => { app.resetSaveFor(p.id); app.toast('Progress reset'); render(); }, `pz-reset-all-${p.id}`));
    return out;
  }

  // ---------- Report ----------
  let chartDays = 28;
  function chartBlock(save, now) {
    const days = lastDays(chartDays, now);
    const v = (f) => days.map((d) => (save.play[d] ? save.play[d][f] || 0 : null));
    const markers = v('markers'), problems = v('problems'), words = v('words');
    const rightPct = days.map((d) => { const p = save.play[d]; if (!p) return null; const n = p.markers + p.problems + p.words; return n ? Math.round((100 * (p.markersRight + p.problemsRight + p.wordsRight)) / n) : null; });
    const chart = dayChart({ id: 'report-chart', title: 'Learning on the trail, day by day', days,
      left: { max: Math.max(10, ...days.map((d, i) => (markers[i] || 0) + (problems[i] || 0) + (words[i] || 0))) },
      series: [
        { label: 'Markers', color: '#e8b33a', values: markers, kind: 'bar', axis: 'left' },
        { label: 'Problems', color: '#d9653b', values: problems, kind: 'bar', axis: 'left' },
        { label: 'Words', color: '#5bb8d6', values: words, kind: 'bar', axis: 'left' },
        { label: 'Right first try %', color: '#7fb85a', values: rightPct, kind: 'line', axis: 'right' },
      ] });
    const legsChart = dayChart({ id: 'report-chart-legs', title: 'Legs finished', days, height: 140,
      series: [{ label: 'Legs', color: '#a07a4c', values: v('legs'), kind: 'bar', axis: 'left' }] });
    return [h('div', { class: 'hud-label pz-sec' }, 'Progress over time'), rangeChips(chartDays, (n) => { chartDays = n; render(); }), chart, legsChart];
  }
  function reportText(p, save, now) {
    const w = weekOf(save, now);
    const J = save.journey;
    const tot = totals(save);
    const lines = [`${p.name} · Wagon West · ${new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      weekLine(w),
      `This week: markers ${pctText(w.markersRight, w.markers)} right (${w.markersRight} of ${w.markers}), problems ${pctText(w.problemsRight, w.problems)} (${w.problemsRight} of ${w.problems}), words ${pctText(w.wordsRight, w.words)} first try (${w.wordsRight} of ${w.words})`,
      `All time: ${tot.legs} legs, ${save.stickers.length} stickers, ${save.letters.length} letters, ${save.seasonsDone} seasons finished`,
      J ? `Now: ${J.year || app.seasonOf(J).year}, ${routeName(J.route)}, ${tierName(J)}, leg ${(J.legIndex || 0) + 1} of ${(J.plan && J.plan.length) || app.legs.length}` : 'Now: not on the trail yet',
      `Legs by route: ${legsByRoute(save)}`,
      `Journeys finished: ${(save.ledger.journeys || []).map((j) => `${j.year} ${routeName(j.route)} ${(TIER_BY_ID[j.tier] || {}).name || j.tier}`).join('; ') || 'none'}`,
      ...(J ? [funLine(save)] : []),
      '', 'Problems by kind'];
    for (const k of PROBLEM_KINDS) { const x = save.kinds[k]; if (x && x.n) lines.push(`${KIND_LABEL[k]}: ${x.right} of ${x.n} right the first time (${pctText(x.right, x.n)})`); }
    const play = Object.entries(save.play).sort().reverse().slice(0, 14);
    if (play.length) { lines.push('', 'Play'); for (const [d, x] of play) lines.push(`${dayName(d)}: ${playText(x)}`); }
    return lines.join('\n');
  }
  /** "Emigrant trail 24 · Gold Road 7" from the legs log. */
  function legsByRoute(save) {
    const n = { emigrant: 0, 'gold-road': 0 };
    for (const l of save.legsLog || []) n[routeOfLeg(l.leg)] += 1;
    return `${routeName('emigrant')} ${n.emigrant} · ${routeName('gold-road')} ${n['gold-road']} (the last ${(save.legsLog || []).length} legs)`;
  }
  const dayName = (k) => new Date(k + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const playText = (x) => `${x.legs} leg${x.legs === 1 ? '' : 's'} · markers ${x.markersRight}/${x.markers} · problems ${x.problemsRight}/${x.problems} · words ${x.wordsRight}/${x.words}`;
  /** "Trail fun" (v1.4): finds of nine, fish of six, the biggest fish, the best skips, quests given back. */
  function funLine(save) {
    const J = save.journey;
    if (!J) return '';
    const finds = Object.values(J.finds || {}).filter((n) => Number(n) > 0).length;
    const fish = Object.values(J.fishLog || {}).filter((e) => e && Number(e.n) > 0).length;
    const b = J.fishBest && J.fishBest.species ? FISH_BY_ID[J.fishBest.species] : null;
    const skips = Number(J.skips && J.skips.best) || 0;
    const quests = Array.isArray(J.questsDone) ? J.questsDone.length : 0;
    return `Trail fun: ${finds} of ${FINDS.length} finds · ${fish} of ${FISH.length} fish kinds${b ? ` · biggest fish: ${b.name.toLowerCase()}, ${J.fishBest.in} in` : ''} · best skip: ${skips} · ${quests} of ${QUESTS.length} quests given back`;
  }
  function totals(save) {
    const t = { legs: 0, markers: 0, markersRight: 0, problems: 0, problemsRight: 0, words: 0, wordsRight: 0 };
    for (const x of Object.values(save.play)) for (const k of Object.keys(t)) t[k] += x[k] || 0;
    return t;
  }
  function reportTab(p) {
    const save = app.saveOf(p.id);
    const now = Date.now();
    const w = weekOf(save, now);
    const t = totals(save);
    const text = reportText(p, save, now);
    const pre = h('pre', { class: 'pz-report-text', id: 'report-text', hidden: true }, text);
    const copy = h('button', { class: 'btn btn-sm btn-cyan', id: 'report-copy', 'data-sfx': '' }, 'Copy report');
    copy.addEventListener('click', async () => {
      pre.hidden = false;
      let ok = false;
      try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; } } catch (_) { ok = false; }
      if (ok) { app.toast('Report copied'); return; }
      try { const sel = window.getSelection(); sel.removeAllRanges(); const rg = document.createRange(); rg.selectNodeContents(pre); sel.addRange(rg); } catch (_) { /* ignore */ }
      app.toast('Report selected: use Copy');
    });
    const kindRows = PROBLEM_KINDS.filter((k) => save.kinds[k] && save.kinds[k].n).map((k) => {
      const x = save.kinds[k];
      return h('tr', { 'data-kind': k }, h('td', { class: 'op' }, KIND_LABEL[k]), h('td', {}, String(x.n)), h('td', {}, String(x.right)), h('td', {}, pctText(x.right, x.n)));
    });
    const play = Object.entries(save.play).sort().reverse().slice(0, 14);
    const letters = save.letters.slice(-3).reverse();
    return [
      h('div', { class: 'pz-week', id: 'report-week', 'data-legs': String(w.legs), 'data-pct': String(w.asked ? pct(w.right, w.asked) : '') },
        h('div', { class: 'pw-big' }, `This week: ${w.legs} leg${w.legs === 1 ? '' : 's'}`),
        h('div', { class: 'pw-small', id: 'report-week-line' }, `Markers ${pctText(w.markersRight, w.markers)} right · problems ${pctText(w.problemsRight, w.problems)} · words ${pctText(w.wordsRight, w.words)} first try`)),
      ...chartBlock(save, now),
      h('div', { class: 'pz-help pz-first', id: 'report-summary' }, `All time: ${t.legs} legs · markers ${pctText(t.markersRight, t.markers)} right · problems ${pctText(t.problemsRight, t.problems)} · words ${pctText(t.wordsRight, t.words)} · ${save.stickers.length} stickers · ${save.letters.length} letters`),
      save.journey ? h('div', { class: 'pz-help', id: 'report-fun' }, funLine(save)) : null,
      h('div', { class: 'pz-help', id: 'report-routes' }, `Legs by route: ${legsByRoute(save)}${save.journey ? ` · now ${routeName(save.journey.route)}, ${tierName(save.journey)}` : ''}`),
      h('div', { class: 'hud-label pz-sec' }, 'Problems by kind'),
      kindRows.length ? h('div', { class: 'pz-table-wrap' }, h('table', { class: 'pz-table', id: 'report-kinds' },
        h('thead', {}, h('tr', {}, ...['Kind', 'Asked', 'Right first try', '%'].map((x) => h('th', {}, x)))), h('tbody', {}, ...kindRows)))
        : h('div', { class: 'pz-help', id: 'report-kinds' }, 'No word problems yet: the General Store, rations and events ask them.'),
      h('div', { class: 'pz-help' }, 'The mile markers are facts from the Trail Blazer ladder (see Trail Blazer → Parents for the facts themselves); the words are this week\'s Spell Jump list (see Spell Jump → Parents).'),
      h('div', { class: 'hud-label pz-sec' }, 'Play, day by day'),
      play.length ? h('ul', { class: 'pat-list', id: 'report-play' }, ...play.map(([d, x]) => h('li', { 'data-day': d }, `${dayName(d)} · ${playText(x)}`)))
        : h('div', { class: 'pz-help', id: 'report-play' }, 'No legs yet.'),
      h('div', { class: 'hud-label pz-sec' }, 'Letters home'),
      letters.length ? h('div', { class: 'pz-letters', id: 'report-letters' }, ...letters.map((l) => h('div', { class: 'pz-letter' }, h('small', {}, new Date(l.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })), h('pre', {}, l.text))))
        : h('div', { class: 'pz-help', id: 'report-letters' }, 'No letters yet: each fort has a post office.'),
      h('div', { class: 'pz-actions' }, copy), pre,
    ];
  }

  // ---------- Family code (Spell Jump's family sync client) ----------
  const statusClass = (base, st) => base + (!st.synced ? '' : st.offline ? ' off' : st.lastError ? ' err' : ' on');
  function familyWeek() {
    const players = app.family.players;
    if (!players.length) return [];
    return [h('div', { class: 'hud-label pz-sec' }, 'This week'),
      h('div', { class: 'pz-week-list', id: 'pz-week-list' }, ...players.map((p) => {
        const w = weekOf(app.saveOf(p.id));
        return h('div', { class: 'pz-week-row', 'data-player': p.id, 'data-legs': String(w.legs), style: { '--c': p.color } },
          h('b', {}, p.name), h('span', { class: 'pw-strip' }, weekLine(w)));
      }))];
  }
  function syncTab() {
    const sync = app.sync;
    const st = sync.status();
    const status = h('div', { class: statusClass('pz-sync-status', st), id: 'sync-status', 'aria-live': 'polite' }, sync.statusText());
    const msg = h('div', { class: 'pz-msg', id: 'sync-msg', 'aria-live': 'polite' });
    const say = (ok, text) => { msg.className = 'pz-msg ' + (ok ? 'ok' : 'err'); msg.textContent = text; };
    const out = [];
    if (st.synced) {
      const codeEl = h('div', { class: 'pz-code', id: 'sync-code' }, st.code);
      const copy = h('button', { class: 'btn btn-sm btn-cyan', id: 'sync-copy', 'data-sfx': '' }, 'Copy');
      copy.addEventListener('click', async () => {
        let ok = false;
        try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(st.code); ok = true; } } catch (_) { ok = false; }
        if (ok) { app.toast('Code copied'); return; }
        try { const sel = window.getSelection(); sel.removeAllRanges(); const r = document.createRange(); r.selectNodeContents(codeEl); sel.addRange(r); } catch (_) { /* ignore */ }
        app.toast('Code selected: use Copy');
      });
      const now = h('button', { class: 'btn btn-sm', id: 'sync-now', 'data-sfx': '' }, 'Sync now');
      now.addEventListener('click', async () => { now.disabled = true; await sync.syncNow(); now.disabled = false; paintSyncStatus(); });
      out.push(h('div', { class: 'pz-code-row pz-first' }, codeEl, copy, now), status,
        h('div', { class: 'pz-help' }, 'The same family code as the other games. On another device: open any of the four games, tap Parents, then Join a family, and type this code.'),
        msg);
      if (joined) out.push(h('div', { class: 'pz-help', id: 'sync-players' }, `Players in this family: ${joined.map((p) => p.name).join(', ') || 'none yet'}`));
      out.push(...confirmRow('Leave family', 'This device stops syncing. Its players stay here; the other devices keep the family.', 'Leave',
        'Stop syncing this device? Nothing is deleted.', 'Leave family', () => { sync.leave(); joined = null; app.toast('Left the family'); render(); }, 'sync-leave'));
    } else {
      const create = h('button', { class: 'btn btn-go', id: 'sync-create', 'data-sfx': '' }, 'Create family code');
      create.addEventListener('click', async () => {
        create.disabled = true; create.textContent = 'Creating…';
        const r = await sync.create();
        if (!r.ok) { create.disabled = false; create.textContent = 'Create family code'; say(false, r.error); app.audio.error(); return; }
        joined = null; app.toast('Family code created'); render();
      });
      const input = h('input', { id: 'sync-join-input', type: 'text', maxlength: '9', spellcheck: 'false', autocapitalize: 'characters', autocomplete: 'off', autocorrect: 'off', placeholder: 'ABCD-2345', 'aria-label': 'Family code' });
      input.addEventListener('input', () => { const v = input.value.toUpperCase(); if (v !== input.value) input.value = v; });
      const join = h('button', { class: 'btn btn-cyan', id: 'sync-join', 'data-sfx': '' }, 'Join');
      const doJoin = async () => {
        join.disabled = true; join.textContent = 'Joining…';
        const r = await sync.join(input.value);
        if (!r.ok) { join.disabled = false; join.textContent = 'Join'; say(false, r.error); app.audio.error(); return; }
        joined = r.players; app.toast('Joined the family'); render();
      };
      join.addEventListener('click', doJoin);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doJoin(); } });
      out.push(
        h('div', { class: 'row pz-first pz-create-row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Start a family'),
          h('div', { class: 'sub' }, "Puts this device's players and their progress in all four games online under a new family code (the same code works in every game).")), create),
        h('label', { class: 'pz-label', for: 'sync-join-input' }, 'Join a family'),
        h('div', { class: 'pz-join-row' }, input, join),
        h('div', { class: 'pz-help' }, 'Already set up in another game? Type the family code shown there (Parents → Family code). Progress already on this device is merged with the family\'s, never lost.'),
        msg);
    }
    out.push(...familyWeek());
    out.push(h('p', { class: 'pz-note', id: 'pz-save-note' }, SAVE_NOTE));
    return out;
  }
  function paintSyncStatus() {
    paintSyncLine();
    const el = $('#sync-status');
    if (el) { el.className = statusClass('pz-sync-status', app.sync.status()); el.textContent = app.sync.statusText(); }
  }
  function paintSyncLine() {
    const show = !root.hidden && view === 'main';
    syncLine.hidden = !show;
    if (!show) return;
    const st = app.sync.status();
    syncLine.className = statusClass('pz-sync-line', st);
    const text = st.synced && !st.offline && !st.lastError && st.lastSync ? SYNCED_LINE : app.sync.statusLine();
    syncLine.replaceChildren(h('span', { class: 'sl-dot', 'aria-hidden': 'true' }), h('span', { class: 'sl-text' }, text));
    syncLine.setAttribute('aria-label', `${text}. Open Family code.`);
  }

  // ---------- Options ----------
  function playerOptions(p) {
    const v = app.voiceInfo(p.id);
    const cv = v.cloudVoice ? cloudVoiceInfo(v.cloudVoice) : null;
    const line = cv && v.synced ? `Natural voice: ${cv.name} · ${v.clips} clips ready` : 'Device voice';
    const note = cv && !v.synced ? `The natural voice (${cv.name}) needs a family code. ` : !cv && v.voiceName ? `${v.voiceName}. ` : '';
    const out = [
      h('div', { class: 'hud-label pz-sec pz-first' }, `The voice for ${p.name}`),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label', id: 'opt-voice-line' }, line),
        h('div', { class: 'sub', id: 'opt-voice' }, `${note}Rate ${v.rate === 'veryslow' ? 'very slow' : v.rate}. Set in Spell Jump → Parents → Options; it reads the facts, the problems, the letters and the words here too.`))),
    ];
    if (p.id === app.currentPlayerId) {
      const result = h('div', { class: 'sub', id: 'opt-voice-result', 'aria-live': 'polite' });
      const test = h('button', { class: 'btn btn-sm btn-cyan', id: 'opt-voice-test', 'data-sfx': '' }, h('span', { html: icon('sound') }), 'Say a test line');
      test.addEventListener('click', async () => {
        test.disabled = true; result.textContent = 'Speaking…';
        const r = await app.testVoice();
        test.disabled = false;
        result.textContent = r.engine === 'cloud' ? `The natural voice spoke it (${r.name}).` : r.engine === 'device' ? 'The device voice spoke it.' : 'No voice spoke: check the sound and the device voice.';
        result.dataset.engine = r.engine || '';
        const vl = $('#opt-voice-line');
        if (vl) { const n = app.voiceInfo(p.id); if (cv && n.synced) vl.textContent = `Natural voice: ${cv.name} · ${n.clips} clips ready`; }
      });
      out.push(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Test the voice'), result), test));
    }
    return out;
  }
  function optionsTab(p) {
    const st = app.settings;
    return [
      ...(p ? playerOptions(p) : []),
      h('div', { class: 'hud-label pz-sec' }, 'All games'),
      toggle(FAMILY_MUSIC_LABEL, FAMILY_MUSIC_HELP, familyMusicIsOn(app.family), (v) => setFamilyMusic(app.family, v), 'opt-family-music'),
      h('div', { class: 'hud-label pz-sec' }, 'This device'),
      toggle('Sound effects', null, st.sound, (v) => app.setSetting('sound', v), 'opt-sound'),
      toggle('Music', null, st.music, (v) => app.setSetting('music', v), 'opt-music'),
      toggle('Reduced motion', 'Calmer scene, no confetti', st.reducedMotion, (v) => app.setSetting('reducedMotion', v), 'opt-motion'),
      toggle('Hunting', 'A cartoon bow hunt when the trail finds tracks (no blood: the animal flops over, "Got one!"). Off: those stops become fishing.', st.hunting !== false, (v) => app.setSetting('hunting', v), 'opt-hunting'),
      toggle('Fractions at rivers', 'The rope toss after the river words: throw the rope to the landing (3/4 of the way across). Off: the words only.', st.fractions !== false, (v) => app.setSetting('fractions', v), 'opt-fractions'),
      toggle('Let the child choose how hard', 'A new year offers Rookie, Veteran and Pioneer (each opens as the one before is finished). Off: every new year is Rookie.', st.chooseTier !== false, (v) => app.setSetting('chooseTier', v), 'opt-choose-tier'),
      toggle('Gold panning', 'The gold pan and the cradle at the diggings (a fun game: every pan finds at least a flake). Off: the gold is given as a find with a card.', st.panning !== false, (v) => app.setSetting('panning', v), 'opt-panning'),
      toggle('Far-off sounds on the trail (rifles, wolves, a bear on a ridge, a prairie fire)', 'Short trail facts with a sound far away: bison hunters\' rifles beyond the ridge (nothing drawn, the wagon safe), wolves singing, a grizzly on a ridge, a prairie fire glowing. On by default; Off skips those four.', st.farSounds !== false, (v) => app.setSetting('farSounds', v), 'opt-far-sounds'),
      ...(app.labReady() ? [h('div', { class: 'hud-label pz-sec' }, 'The Lab'),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'The Lab'), h('div', { class: 'sub' }, 'The page that goes across all five games: quests, the Lab crate, the family board and goal, the odds and the switches. Its own Grown-ups panel.')),
          h('button', { class: 'btn btn-sm', id: 'opt-lab', 'data-sfx': '', onclick: () => app.openLabParent() }, 'Open'))] : []),
      h('div', { class: 'hud-label pz-sec' }, 'Family'),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Parent PIN'), h('div', { class: 'sub' }, 'Shared with the other three games')),
        h('button', { class: 'btn btn-sm', id: 'opt-pin', onclick: () => { pinMode = 'reset'; pinEntry = ''; view = 'pin'; render(); } }, 'Change PIN')),
      h('div', { class: 'ver' }, `Wagon West ${app.version}${app.sceneName ? ' · ' + app.sceneName : ''}`),
    ];
  }

  // ---------- Players ----------
  function playersTab() {
    const f = app.family;
    if (!f.players.length) return noPlayer();
    return f.players.map((p) => {
      const cv = h('canvas', { 'aria-hidden': 'true' });
      const input = h('input', { type: 'text', id: `pz-name-${p.id}`, value: p.name, maxlength: '12', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': `Rename ${p.name}` });
      const save = h('button', { class: 'btn btn-sm btn-go', 'data-rename': p.id, 'data-sfx': '' }, 'Rename');
      save.addEventListener('click', () => {
        if (renamePlayer(app.family, p.id, input.value)) { app.toast('Name saved'); app.onFamilyChanged(); render(); } else { app.audio.error(); app.toast('Type a name (letters only)'); }
      });
      const card = h('div', { class: 'pz-player', 'data-player': p.id, style: { '--c': p.color } },
        h('div', { class: 'pz-player-head' }, cv, h('div', { class: 'name' }, p.name, h('div', { class: 'sub' }, `${app.whereFor(p.id)}, on this device`))),
        h('div', { class: 'pz-rename' }, input, save),
        ...confirmRow('Reset Wagon West progress', `The journey, the farm, the years, the journal (letters, stickers), the cards, the looks and the report back to the start for ${p.name}. The other games, the facts and the words are not touched.`, 'Reset',
          `Reset ${p.name}'s Wagon West progress?`, 'Reset', () => { app.resetSaveFor(p.id); app.toast('Progress reset'); render(); }, `pz-reset-${p.id}`),
        ...confirmRow('Remove player', `Removes ${p.name} from the family in all four games, on every device, with all of ${p.name}'s data.`, 'Remove',
          `Remove ${p.name} for good, in every game?`, 'Remove', () => { app.removePlayer(p.id); render(); }, `pz-remove-${p.id}`));
      drawAvatar(cv, p.color);
      return card;
    });
  }

  function mainView() {
    header('Parent Zone');
    const keep = body.scrollTop;
    const f = app.family;
    if (!playerById(f, playerId)) playerId = app.currentPlayerId && playerById(f, app.currentPlayerId) ? app.currentPlayerId : (f.players[0] || {}).id || null;
    const p = playerById(f, playerId);
    const perPlayer = tab === 'journey' || tab === 'report' || tab === 'options';
    const content = tab === 'sync' ? syncTab() : tab === 'players' ? playersTab()
      : tab === 'options' ? optionsTab(p) : !p ? noPlayer() : tab === 'journey' ? journeyTab(p) : reportTab(p);
    body.replaceChildren(sectionTabs(), ...(perPlayer && p && f.players.length > 1 ? [playerTabs()] : []), h('div', { class: 'pz-content', 'data-tab': tab }, ...content.filter(Boolean)));
    body.scrollTop = keep;
  }
  function render() {
    root.dataset.view = view;
    paintSyncLine();
    if (view === 'pin') pinView();
    else if (view === 'hold') holdView();
    else if (view === 'math') mathView();
    else mainView();
  }

  const api = {
    get isOpen() { return !root.hidden; },
    get view() { return view; },
    get tab() { return tab; },
    open(opts = {}) {
      tab = opts.tab || 'sync';
      playerId = opts.playerId || app.currentPlayerId || null;
      joined = null; pinEntry = ''; pinFirst = '';
      if (Date.now() < unlockedUntil) view = 'main';
      else { view = 'pin'; pinMode = hasPin(app.family) ? 'enter' : 'set'; }
      root.hidden = false;
      fitViewport();
      render();
      body.scrollTop = 0;
      clearInterval(lineTimer);
      lineTimer = setInterval(() => { if (!root.hidden && view === 'main') paintSyncLine(); }, 30000);
    },
    close() {
      clearTimeout(holdTimer); cancelAnimationFrame(holdRaf); clearInterval(lineTimer);
      if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();
      root.hidden = true;
      app.onParentZoneClosed();
    },
    lock() { unlockedUntil = 0; },
    onSyncStatus() { if (!root.hidden && view === 'main') paintSyncStatus(); },
    onSyncApplied() {
      if (root.hidden || view !== 'main') return;
      if (tab === 'sync' && joined) joined = app.family.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
      if (tab === 'sync' || ((tab === 'players' || tab === 'report' || tab === 'journey') && !root.contains(document.activeElement))) render();
    },
  };
  return api;
}

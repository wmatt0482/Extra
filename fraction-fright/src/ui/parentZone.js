// Parent Zone (Parents on the player picker and the title; PIN-gated with the family's PIN, the same one as Spell Jump
// and Trail Blazer). First open on a device with no PIN: set a 4-digit PIN (twice). Later: enter it. "Forgot PIN":
// press and hold 3 s, then answer a 2-digit × 2-digit multiplication, then set a new PIN. Same flow as Trail Blazer's.
// Tabs (SPEC §2, §9): Family code (opens first; works with no players; a strip per child "Fractions this week · N % of
// the ladder · N % accurate") · Fractions (per player: "Where <kid> is", the ladder of streets with each one's state,
// the tolerance it plays at, the Zombie Lab) · Options (per player: fractions aloud, the voice as set in Spell Jump;
// this device's sound, music, motion; Change PIN) · Report (the week's %, per street, closest and trickiest fractions,
// moved up, this week's waves, play day by day, Copy report) · Players (rename, reset fraction skills, reset Fraction
// Fright progress, remove). Native text inputs exist only here (family code, player names).
import { checkPin, hasPin, playerById, renamePlayer, setPin } from '../../../spell-jump/src/spelling/profiles.js';
import { cloudVoiceInfo } from '../../../spell-jump/src/tts/voices.js';
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { icon } from '../../../spell-jump/src/ui/icons.js';
import { TIER_BY_ID, closeText, toleranceFor } from '../skills/items.js';
import { ladderView, recommended, tierStats } from '../skills/ladder.js';
import { moveText, report, reportText, stateWord } from '../skills/store.js';
import { weekProgress, weekProgressLines } from '../skills/progress.js';
import { playLines } from '../meta/economy.js';
import { drawAvatar } from './players.js';

const HOLD_MS = 3000;
export const SAVE_NOTE = "One family code syncs all three games: the players and the PIN, and each child's Spell Jump, Trail Blazer and Fraction Fright progress (cash, the yard, the streets and the fraction skills). Nothing is lost when two devices played offline: the progress is merged.";
export const SYNCED_LINE = 'Synced · players and all three games';

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
    // a key only acts on a click whose press started on it (the finger that finished the 3 s hold is still down)
    const guard = (fn) => (e) => { const b = e.currentTarget; const pressed = b.dataset.pressed === '1'; b.dataset.pressed = ''; if (pressed || e.detail === 0) fn(e); };
    g.addEventListener('pointerdown', (e) => { const k = e.target.closest('.pin-key'); if (k) k.dataset.pressed = '1'; });
    for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) g.append(h('button', { class: 'btn pin-key', 'data-digit': d, onclick: guard(() => onDigit(d)) }, d));
    g.append(h('button', { class: 'btn pin-key', 'aria-label': 'Delete', id: 'pin-back', onclick: guard(onBack), html: icon('back') }));
    g.append(h('button', { class: 'btn pin-key', 'data-digit': '0', onclick: guard(() => onDigit('0')) }, '0'));
    g.append(okLabel ? h('button', { class: 'btn btn-green pin-key', id: 'pin-ok', onclick: guard(onOk) }, okLabel) : h('span'));
    return g;
  }
  const dots = (n) => h('div', { class: 'pin-dots', 'aria-label': `${n} of 4 digits` }, ...[0, 1, 2, 3].map((i) => h('i', { class: i < n ? 'on' : '' })));
  function pinView(error = '') {
    header('Parent Zone');
    const titles = { set: 'Choose a 4-digit PIN', confirm: 'Type the PIN again', enter: 'Enter the parent PIN', reset: 'Choose a new 4-digit PIN', resetConfirm: 'Type the new PIN again' };
    const sub = { set: 'Grown-ups only. The same PIN opens Parents in Spell Jump and Trail Blazer.', enter: 'The same PIN as in Spell Jump and Trail Blazer.', reset: 'Answered correctly. Now pick a new PIN.' };
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
    setPin(app.family, pin);         // profiles.js writes the family record (and family sync shares it)
    app.toast('PIN saved');
    unlock();
  }
  function unlock() { unlockedUntil = Date.now() + 5 * 60000; view = 'main'; render(); }

  function holdView() {
    header('Forgot PIN', { back: () => { view = 'pin'; render(); } });
    const ring = h('div', { class: 'hold-ring', style: { '--p': '0' } });
    const btn = h('button', { class: 'btn btn-orange hold-btn', id: 'pin-hold' }, ring, h('span', {}, 'Press and hold'));
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
    for (const [id, text, more] of [['sync', 'Family', ' code'], ['fracs', 'Fractions'], ['options', 'Options'], ['report', 'Report'], ['players', 'Players']]) {
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
    const add = h('button', { class: 'btn btn-green', id: 'pz-add-player', 'data-sfx': '' }, 'Add a player');
    add.addEventListener('click', () => { api.close(); app.go('newplayer'); });
    return [h('div', { class: 'pz-noplayer', id: 'pz-noplayer' }, h('div', { class: 'label' }, 'No players yet'),
      h('div', { class: 'pz-help' }, 'Add one on the player screen, or join your family on the Family code tab to bring your players here.'), h('div', { class: 'pz-actions' }, add))];
  }

  // ---------- Fractions: where the child is on the ladder ----------
  function fracsTab(p) {
    const d = app.skillsFor(p.id);
    const lv = ladderView(d);
    const rec = recommended(d);
    const pct = (x) => `${Math.round(x * 100)} %`;
    const where = h('div', { class: 'where', id: 'fracs-where' },
      h('div', { class: 'label' }, `Where ${p.name} is`),
      h('div', { class: 'where-line', id: 'fracs-where-line' }, !d.lab.done ? 'Zombie Lab not done yet: it comes before the first street'
        : `${TIER_BY_ID[rec].name} (★ recommended) · ${stateWord(lv.find((t) => t.id === rec).state)} · aiming zone ±${Math.round(toleranceFor(lv.find((t) => t.id === rec).state) * 100)} % of the road`),
      h('div', { class: 'pz-help' }, d.lab.done ? `Zombie Lab done ${new Date(d.lab.done).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${d.lab.runs > 1 ? ` (played ${d.lab.runs} times)` : ''} · ${d.xp} XP` : `${d.xp} XP`));
    const chips = lv.map((t) => h('span', { class: `lad st-${t.state}`, 'data-tier': t.id, 'data-state': t.state, title: `${t.name}: ${stateWord(t.state)}` }, t.name, h('small', {}, t.playable ? (t.open ? stateWord(t.state) : 'locked') : 'coming later')));
    const rows = lv.filter((t) => t.playable).map((t) => {
      const s = tierStats(d, t.id);
      return h('tr', { 'data-tier': t.id }, h('td', { class: 'op' }, t.name, h('small', {}, t.what)), h('td', {}, stateWord(t.state)), h('td', {}, String(s.n)),
        h('td', {}, s.n ? pct(s.rate) : '—'), h('td', {}, s.n ? closeText(s.pae) : '—'), h('td', {}, `±${Math.round(toleranceFor(t.state) * 100)} %`));
    });
    const labBtn = h('button', { class: 'btn btn-sm btn-cyan', id: 'fracs-lab', 'data-sfx': '' }, 'Play the Zombie Lab');
    labBtn.addEventListener('click', () => app.runLabFor(p.id));
    return [
      where,
      h('div', { class: 'hud-label pz-sec' }, 'The ladder'),
      h('div', { class: 'ladder', id: 'fracs-ladder' }, ...chips),
      h('div', { class: 'lad-legend' }, 'practicing = started · working = 6 or more of the last 12 throws, 60 % on target (opens the next street) · secure = 8 plain throws, 80 % on target, 97.5 % close on average'),
      h('div', { class: 'pz-table-wrap' }, h('table', { class: 'pz-table', id: 'fracs-table' },
        h('thead', {}, h('tr', {}, ...['Street', 'State', 'Throws', 'On target', 'Closeness', 'Zone'].map((x) => h('th', {}, x)))), h('tbody', {}, ...rows))),
      h('div', { class: 'pz-help pz-sec' }, `${p.name} picks the street; the ★ marks the lowest open street that is not secure yet. A street opens when the one before is working, and a street once open stays open. The aiming zone narrows as a street goes well: ±10 % of the road to start, ±5 % when working, ±3 % when secure. Nothing is timed: accuracy is what counts.`),
      h('div', { class: 'pz-check-row row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Zombie Lab'),
        h('div', { class: 'sub' }, 'The short lesson: a fraction is a number on the road, equal jumps, and ½ in the same spot on every road. Required once; play it again any time.')), labBtn),
    ];
  }

  // ---------- the week's progress (parent-facing only) ----------
  const bar = (v, cls) => h('div', { class: cls, role: 'img', 'aria-label': v == null ? 'nothing yet' : `${v} percent` }, h('i', { style: { width: `${v || 0}%` } }));
  function weekBlock(w) {
    const lines = weekProgressLines(w);
    return h('div', { class: 'pz-week', id: 'report-week', 'data-pct': String(w.ladderPct), 'data-acc': String(w.accuratePct) },
      h('div', { class: 'pw-big' }, `Fractions: ${w.ladderPct} % of the ladder`), bar(w.ladderPct, 'pw-bar'), h('div', { class: 'pw-small' }, lines[1]));
  }
  function familyWeek() {
    const players = app.family.players;
    if (!players.length) return [];
    return [h('div', { class: 'hud-label pz-sec' }, 'This week'),
      h('div', { class: 'pz-week-list', id: 'pz-week-list' }, ...players.map((p) => {
        const w = weekProgress(app.skillsFor(p.id), Date.now());
        return h('div', { class: 'pz-week-row', 'data-player': p.id, 'data-pct': String(w.ladderPct), style: { '--c': p.color } },
          h('b', {}, p.name), h('span', { class: 'pw-strip' }, `Fractions this week · ${w.ladderPct} % of the ladder · ${w.accuratePct == null ? 'no waves this week' : `${w.accuratePct} % accurate`}`),
          bar(w.ladderPct, 'pw-mini'));
      }))];
  }

  // ---------- Report ----------
  function reportTab(p) {
    const d = app.skillsFor(p.id);
    const now = Date.now();
    const r = report(d, now);
    const wk = weekProgress(d, now);
    const play = playLines(app.saveOf(p.id));
    const dayName = (k) => new Date(k + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const base = reportText(d, p.name, now).split('\n');
    base.splice(1, 0, ...weekProgressLines(wk));
    const text = base.join('\n') + (play.length ? `\n\nPlay\n${play.map((x) => `${dayName(x.day)}: ${x.text}`).join('\n')}` : '');
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
    const streets = r.tiers.filter((t) => t.playable).map((t) => h('li', { 'data-tier': t.id },
      `${t.name}: ${stateWord(t.state)}${t.stats.n ? ` · last ${t.stats.n} throws ${Math.round(t.stats.rate * 100)} % on target, ${closeText(t.stats.pae)} on average` : ''}`));
    return [
      weekBlock(wk),
      h('div', { class: 'pz-help pz-first', id: 'report-summary' }, `${r.fractions} different fractions thrown at · ${r.xp} XP · Zombie Lab ${r.lab.done ? 'done' : 'not done yet'}`),
      h('div', { class: 'hud-label pz-sec' }, 'Streets'), h('ul', { class: 'pat-list', id: 'report-streets' }, ...streets),
      h('div', { class: 'hud-label pz-sec' }, 'Closest fractions'),
      h('div', { class: 'pz-help', id: 'report-closest' }, r.closest.length ? r.closest.map((x) => `${x.show} (${closeText(x.mean)})`).join(' · ') : 'Not enough throws yet.'),
      h('div', { class: 'hud-label pz-sec' }, 'Still tricky'),
      h('div', { class: 'pz-help', id: 'report-tricky' }, r.hardest.length ? r.hardest.map((x) => `${x.show} (${closeText(x.mean)})`).join(' · ') : 'Nothing stands out yet.'),
      h('div', { class: 'hud-label pz-sec' }, 'Moved'),
      r.moves.length ? h('ul', { class: 'pat-list', id: 'report-moved' }, ...r.moves.slice(-6).reverse().map((m) => h('li', {}, moveText(m))))
        : h('div', { class: 'pz-help', id: 'report-moved' }, 'No moves yet: they show up as streets start working or go secure.'),
      h('div', { class: 'hud-label pz-sec' }, "This week's waves"),
      h('div', { class: 'pz-help', id: 'report-waves' }, r.waves.length ? r.waves.slice(-8).map((w) => `${new Date(w.at).toLocaleDateString('en-US', { weekday: 'short' })} ${(TIER_BY_ID[Object.keys(TIER_BY_ID).find((k) => TIER_BY_ID[k].street === w.street)] || { name: w.street }).name} wave ${w.number}: ${w.cured} cured, ${w.hits} of ${w.throws} on target`).join(' · ') : 'No waves this week yet.'),
      h('div', { class: 'hud-label pz-sec' }, 'Play, day by day'),
      play.length ? h('ul', { class: 'pat-list', id: 'report-play' }, ...play.map((x) => h('li', { 'data-day': x.day }, `${dayName(x.day)} · ${x.text}`)))
        : h('div', { class: 'pz-help', id: 'report-play' }, 'No waves yet.'),
      h('div', { class: 'pz-actions' }, copy), pre,
    ];
  }

  // ---------- Family code (Spell Jump's family sync client) ----------
  const statusClass = (base, st) => base + (!st.synced ? '' : st.offline ? ' off' : st.lastError ? ' err' : ' on');
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
        h('div', { class: 'pz-help' }, 'The same family code as Spell Jump and Trail Blazer. On another device: open any of the three games, tap Parents, then Join a family, and type this code.'),
        msg);
      if (joined) out.push(h('div', { class: 'pz-help', id: 'sync-players' }, `Players in this family: ${joined.map((p) => p.name).join(', ') || 'none yet'}`));
      out.push(...confirmRow('Leave family', 'This device stops syncing. Its players stay here; the other devices keep the family.', 'Leave',
        'Stop syncing this device? Nothing is deleted.', 'Leave family', () => { sync.leave(); joined = null; app.toast('Left the family'); render(); }, 'sync-leave'));
    } else {
      const create = h('button', { class: 'btn btn-green', id: 'sync-create', 'data-sfx': '' }, 'Create family code');
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
          h('div', { class: 'sub' }, "Puts this device's players and their progress in all three games online under a new family code (the same code works in every game).")), create),
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
    const d = app.skillsFor(p.id);
    const v = app.voiceInfo(p.id);
    const cv = v.cloudVoice ? cloudVoiceInfo(v.cloudVoice) : null;
    const voiceText = `${cv ? `Natural voice: ${cv.name}${v.synced ? '' : ' (needs a family code)'}` : v.voiceName ? `Device voice: ${v.voiceName}` : 'Device voice: automatic'} · rate ${v.rate === 'veryslow' ? 'very slow' : v.rate}`;
    return [
      h('div', { class: 'hud-label pz-sec pz-first' }, `Fractions for ${p.name}`),
      toggle('Fractions aloud', 'The scout reads each fraction as it is called ("three quarters"), and the Lab reads its lines', d.opts.aloud, (x) => { d.opts.aloud = x; d.opts.updatedAt = Date.now(); app.saveSkillsFor(p.id, d); }, 'opt-aloud'),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Voice'),
        h('div', { class: 'sub', id: 'opt-voice' }, `${voiceText}. Set in Spell Jump → Parents → Options.`))),
    ];
  }
  function optionsTab(p) {
    const st = app.settings;
    return [
      ...(p ? playerOptions(p) : []),
      h('div', { class: 'hud-label pz-sec' }, 'This device'),
      toggle('Sound effects', null, st.sound, (v) => app.setSetting('sound', v), 'opt-sound'),
      toggle('Music', null, st.music, (v) => app.setSetting('music', v), 'opt-music'),
      toggle('Reduced motion', 'No slow-mo or shake; calmer splats', st.reducedMotion, (v) => app.setSetting('reducedMotion', v), 'opt-motion'),
      h('div', { class: 'hud-label pz-sec' }, 'Family'),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Parent PIN'), h('div', { class: 'sub' }, 'Shared with Spell Jump and Trail Blazer')),
        h('button', { class: 'btn btn-sm', id: 'opt-pin', onclick: () => { pinMode = 'reset'; pinEntry = ''; view = 'pin'; render(); } }, 'Change PIN')),
      h('div', { class: 'ver' }, `Fraction Fright ${app.version}${app.engineName ? ' · ' + app.engineName : ''}`),
    ];
  }

  // ---------- Players ----------
  function playersTab() {
    const f = app.family;
    if (!f.players.length) return noPlayer();
    return f.players.map((p) => {
      const cv = h('canvas', { 'aria-hidden': 'true' });
      const input = h('input', { type: 'text', id: `pz-name-${p.id}`, value: p.name, maxlength: '12', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': `Rename ${p.name}` });
      const save = h('button', { class: 'btn btn-sm btn-green', 'data-rename': p.id, 'data-sfx': '' }, 'Rename');
      save.addEventListener('click', () => {
        if (renamePlayer(app.family, p.id, input.value)) { app.toast('Name saved'); app.onFamilyChanged(); render(); } else { app.audio.error(); app.toast('Type a name (letters only)'); }
      });
      const card = h('div', { class: 'pz-player', 'data-player': p.id, style: { '--c': p.color } },
        h('div', { class: 'pz-player-head' }, cv, h('div', { class: 'name' }, p.name, h('div', { class: 'sub' }, `${app.curesFor(p.id)} neighbours cured, on this device`))),
        h('div', { class: 'pz-rename' }, input, save),
        ...confirmRow('Reset fraction skills', `Every street back to the start for ${p.name}, the Zombie Lab too (the options stay).`, 'Reset',
          `Reset ${p.name}'s fraction skills?`, 'Reset skills', () => { app.resetSkillsFor(p.id); app.toast('Fraction skills reset'); render(); }, `pz-reset-skills-${p.id}`),
        ...confirmRow('Reset Fraction Fright progress', `Cash, the yard, pumpkins and the Cure Counter back to the start for ${p.name}. Spell Jump and Trail Blazer are not touched.`, 'Reset',
          `Reset ${p.name}'s Fraction Fright progress?`, 'Reset', () => { app.resetSaveFor(p.id); app.toast('Progress reset'); render(); }, `pz-reset-${p.id}`),
        ...confirmRow('Remove player', `Removes ${p.name} from the family in all three games, on every device, with all of ${p.name}'s data.`, 'Remove',
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
    const perPlayer = tab === 'fracs' || tab === 'report' || tab === 'options';
    const content = tab === 'sync' ? syncTab() : tab === 'players' ? playersTab()
      : tab === 'options' ? optionsTab(p) : !p ? noPlayer() : tab === 'fracs' ? fracsTab(p) : reportTab(p);
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
      if (tab === 'sync' || ((tab === 'players' || tab === 'report' || tab === 'fracs') && !root.contains(document.activeElement))) render();
    },
  };
  return api;
}

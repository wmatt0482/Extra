// Parent Zone (Parents on the player picker and the case board; PIN-gated with the family's PIN, the same one as every other game). First open on a
// device with no PIN: set a 4-digit PIN (twice). Later: enter it. "Forgot PIN": press and hold 3 s, then answer a 2-digit x 2-digit multiplication,
// then set a new PIN (the same flow as the other games').
// Tabs: Family code (opens first; works with no players) · Players (per player: cases closed, postcards, the words practiced (Spell Jump's own
// records), "Open the next case now") · Options (sound, family music, calm motion, the voice, Change PIN).
// Native text inputs exist only here (the family code). Everything in this file is for grown-ups.
import { checkPin, hasPin, loadWords, setPin } from '../../../spell-jump/src/spelling/profiles.js';
import * as WS from '../../../spell-jump/src/spelling/wordStore.js';
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { icon } from '../../../spell-jump/src/ui/icons.js';
import { FAMILY_MUSIC_HELP, FAMILY_MUSIC_LABEL, familyMusicIsOn, setFamilyMusic } from '../../../spell-jump/src/ui/musicNote.js';
import { CASE_BY_ID, TOUR_TOTAL, CITY_BY_ID } from '../logic/caseModel.js';
import { drawAvatar } from './avatar.js';

const HOLD_MS = 3000;
export const SAVE_NOTE = "One family code syncs all the games: the players and the PIN, and each child's progress, including every Squirrel Chase case and postcard. Nothing is lost when two devices played offline: the progress is merged.";

function toggle(label, sub, on, onChange, id) {
  const t = h('button', { class: 'toggle', role: 'switch', 'aria-checked': String(!!on), 'aria-label': label, id });
  t.addEventListener('click', () => { const v = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', String(v)); onChange(v); });
  return h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, label), sub ? h('div', { class: 'sub' }, sub) : null), t);
}

export function createParentZone(app) {
  const root = $('#pz');
  const sheet = h('div', { class: 'pz-sheet card', role: 'dialog', 'aria-labelledby': 'pz-h' });
  const head = h('div', { class: 'pz-head' });
  const body = h('div', { class: 'pz-body scroll', id: 'pz-body' });
  sheet.append(head, body);
  root.replaceChildren(sheet);

  let view = 'pin', tab = 'family', playerId = null, joinMsg = null;
  let pinMode = 'enter', pinFirst = '', pinEntry = '', mathQ = null, mathEntry = '', holdTimer = 0, holdRaf = 0;

  const vv = window.visualViewport;
  function fitViewport() { if (!vv) return; root.style.setProperty('--vvh', `${Math.round(vv.height)}px`); root.style.setProperty('--vvt', `${Math.round(vv.offsetTop)}px`); }
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
    g.append(okLabel ? h('button', { class: 'btn btn-green pin-key', id: 'pin-ok', onclick: guard(onOk) }, okLabel) : h('span'));
    return g;
  }
  const dots = (n) => h('div', { class: 'pin-dots', 'aria-label': `${n} of 4 digits` }, ...[0, 1, 2, 3].map((i) => h('i', { class: i < n ? 'on' : '' })));
  function pinView(error = '') {
    header('Parent Zone');
    const titles = { set: 'Choose a 4-digit PIN', confirm: 'Type the PIN again', enter: 'Enter the parent PIN', reset: 'Choose a new 4-digit PIN', resetConfirm: 'Type the new PIN again' };
    const sub = { set: 'Grown-ups only. The same PIN opens Parents in every Learning Lab game.', enter: 'The same PIN as in Spell Jump and the other games.', reset: 'Pick a new PIN.' };
    const onDigit = (d) => { if (pinEntry.length >= 4) return; pinEntry += d; app.audio.click(); if (pinEntry.length === 4) setTimeout(submitPin, 120); pinView(); };
    const onBack = () => { pinEntry = pinEntry.slice(0, -1); pinView(); };
    const kids = [h('div', { class: 'pin-title', id: 'pin-title' }, titles[pinMode]), sub[pinMode] ? h('div', { class: 'pin-sub' }, sub[pinMode]) : null, dots(pinEntry.length),
      error ? h('div', { class: 'pin-err', id: 'pin-err' }, error) : null, pad(onDigit, onBack)];
    if (pinMode === 'enter') {
      const forgot = h('button', { class: 'btn btn-sm', id: 'pin-forgot', 'data-sfx': '' }, 'Forgot PIN?');
      forgot.addEventListener('click', () => { view = 'hold'; render(); });
      kids.push(forgot);
    }
    body.replaceChildren(h('div', { class: 'pin-wrap', 'data-pin-mode': pinMode }, ...kids));
  }
  function submitPin() {
    const pin = pinEntry; pinEntry = '';
    if (pinMode === 'enter') { if (checkPin(app.family, pin)) { unlock(); return; } app.audio.error(); pinView('That PIN is not right.'); return; }
    if (pinMode === 'set' || pinMode === 'reset') { pinFirst = pin; pinMode = pinMode === 'set' ? 'confirm' : 'resetConfirm'; pinView(); return; }
    if (pin !== pinFirst) { pinMode = pinMode === 'confirm' ? 'set' : 'reset'; app.audio.error(); pinView('The two PINs did not match. Try again.'); return; }
    setPin(app.family, pin);
    app.toast('PIN saved');
    unlock();
  }
  function unlock() { view = 'main'; render(); }
  function holdView() {
    header('Forgot PIN', { back: () => { view = 'pin'; render(); } });
    const ring = h('div', { class: 'hold-ring', style: { '--p': '0' } });
    const btn = h('button', { class: 'btn btn-brass hold-btn', id: 'pin-hold' }, ring, h('span', {}, 'Press and hold'));
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
    body.replaceChildren(h('div', { class: 'pin-wrap' }, h('div', { class: 'pin-title' }, 'Hold the button for 3 seconds'), h('div', { class: 'pin-sub' }, 'Then answer a grown-up math question to set a new PIN.'), btn));
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
    body.replaceChildren(h('div', { class: 'pin-wrap' }, h('div', { class: 'pin-title', id: 'math-q', 'data-a': String(mathQ.a), 'data-b': String(mathQ.b) }, `${mathQ.a} × ${mathQ.b} = ?`),
      h('div', { class: 'math-entry', id: 'math-entry' }, mathEntry || ' '), error ? h('div', { class: 'pin-err' }, error) : null, pad(onDigit, onBack, 'OK', onOk)));
  }

  // ---------- main ----------
  function sectionTabs() {
    const row = h('div', { class: 'seg pz-tabs', role: 'tablist' });
    for (const [id, text, more] of [['family', 'Family', ' code'], ['det', 'Players'], ['options', 'Options']]) {
      const b = h('button', { class: 'seg-btn' + (tab === id ? ' on' : ''), role: 'tab', 'aria-selected': String(tab === id), 'data-tab': id, 'aria-label': text + (more || '') }, text, ...(more ? [h('span', { class: 'tab-more' }, more)] : []));
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

  // ----- Family code -----
  function familyTab() {
    const s = app.sync.status();
    const out = [h('div', { class: 'pz-note', id: 'pz-sync-status' }, app.sync.statusText()), h('div', { class: 'pz-help' }, SAVE_NOTE)];
    if (s.synced) {
      const leave = h('button', { class: 'btn btn-sm btn-hot', id: 'pz-leave', 'data-sfx': '' }, 'Stop syncing on this device');
      leave.addEventListener('click', () => { app.sync.leave(); render(); });
      out.push(h('div', { class: 'pz-label' }, h('span', {}, 'Family code')), h('div', { class: 'pz-code', id: 'pz-code' }, s.code), h('div', { class: 'pz-actions' },
        h('button', { class: 'btn btn-sm btn-cyan', id: 'pz-sync-now', 'data-sfx': '', onclick: async () => { await app.sync.syncNow(); render(); } }, 'Sync now'), leave));
    } else {
      const input = h('input', { type: 'text', id: 'pz-join-input', placeholder: 'K7QX-M2PA', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '12', 'aria-label': 'Family code' });
      const msg = h('div', { class: 'pz-msg', id: 'pz-join-msg' });
      if (joinMsg) { msg.textContent = joinMsg.text; msg.classList.add(joinMsg.ok ? 'ok' : 'err'); }
      const join = h('button', { class: 'btn btn-teal', id: 'pz-join', 'data-sfx': '' }, 'Join');
      join.addEventListener('click', async () => {
        join.disabled = true;
        const r = await app.sync.join(input.value);
        joinMsg = r.ok ? { ok: true, text: 'Joined. This device now shares the family.' } : { ok: false, text: r.error };
        render();
      });
      const create = h('button', { class: 'btn btn-sm', id: 'pz-create', 'data-sfx': '' }, 'Make a new family code');
      create.addEventListener('click', async () => { create.disabled = true; const r = await app.sync.create(); joinMsg = r.ok ? { ok: true, text: `Your family code is ${r.code}.` } : { ok: false, text: r.error }; render(); });
      out.push(h('div', { class: 'pz-label' }, h('span', {}, 'Join with a family code')), h('div', { class: 'pz-join-row' }, input, join), msg, h('div', { class: 'pz-actions' }, create));
    }
    return out;
  }

  // ----- Players -----
  /** The child's spelling records in Spell Jump's store, read-only: how many of the active list's words have been practiced and today's mission. */
  function wordsLine(id) {
    try {
      const d = loadWords(id), list = WS.activeList(d), recs = d.records || {};
      const practiced = list.words.filter((w) => recs[w.word] && recs[w.word].seenCount > 0).length;
      const m = WS.missionState(d, Date.now());
      return `${practiced} of ${list.words.length} words on the current list practiced. Today's mission: ${m.count} / ${m.size}${m.done ? ' (done)' : ''}. These are the same records as Spell Jump.`;
    } catch (_) { return 'No spelling records yet.'; }
  }
  function detTab() {
    if (!app.family.players.length) return noPlayer();
    if (!playerId || !app.family.players.some((p) => p.id === playerId)) playerId = (app.currentPlayerId && app.family.players.some((p) => p.id === app.currentPlayerId) ? app.currentPlayerId : app.family.players[0].id);
    const save = app.saveOf(playerId);
    const out = [playerTabs()];
    const closed = Object.entries(save.closed).map(([id, r]) => ({ id, r, k: CASE_BY_ID[id] })).filter((x) => x.k).sort((a, b) => a.r.at - b.r.at);
    out.push(h('div', { class: 'pz-sec' }, 'Progress'), h('div', { class: 'pz-help', id: 'pz-progress' }, `${closed.length} of ${TOUR_TOTAL} cases closed on the New York tour. ${save.album.length} ${save.album.length === 1 ? 'postcard' : 'postcards'} in the album.`));
    out.push(h('div', { class: 'pz-sec' }, 'Words practiced'), h('div', { class: 'pz-help', id: 'pz-words' }, wordsLine(playerId)));
    const next = app.nextCaseTitleFor(playerId);
    const openBtn = h('button', { class: 'btn btn-sun', id: 'pz-open-next', 'data-sfx': '' }, 'Open the next case now');
    openBtn.disabled = !next;
    openBtn.addEventListener('click', () => { app.openNextNow(playerId); app.toast('The next case is open'); render(); });
    const openedN = Object.keys(save.opened).length;
    out.push(h('div', { class: 'pz-sec' }, 'Pacing'), h('div', { class: 'pz-help' }, `One new case opens each day, after the last one is closed. ${openedN} opened, ${closed.length} closed.${next ? ' A case is waiting to be opened.' : ' Every case is open.'}`), h('div', { class: 'pz-actions' }, openBtn));
    out.push(h('div', { class: 'pz-sec' }, 'Closed cases'));
    if (!closed.length) out.push(h('div', { class: 'pz-help' }, 'No cases closed yet.'));
    else out.push(h('div', { class: 'pz-table-wrap' }, h('table', { class: 'pz-table', id: 'pz-cases' }, h('thead', {}, h('tr', {}, ...['Case', 'Day', 'Words', 'Password'].map((x) => h('th', {}, x)))),
      h('tbody', {}, ...closed.map(({ r, k }) => h('tr', { 'data-case': k.id }, h('td', {}, k.title), h('td', {}, r.day), h('td', {}, String(r.words.length)), h('td', {}, r.hideout.total ? `${r.hideout.correct} of ${r.hideout.total} words` : '-')))))));
    out.push(h('div', { class: 'pz-sec' }, 'Postcards'), h('div', { class: 'pz-help', id: 'pz-postcards' }, save.album.length ? save.album.map((c) => (CITY_BY_ID[c] || { name: c }).name).join(' · ') : 'None yet.'));
    return out;
  }

  // ----- Options -----
  function optionsTab() {
    const out = [];
    out.push(toggle('Sound', 'This device. Turns the natural voice and the sound effects on or off.', app.settings.sound, (v) => app.setSetting('sound', v), 'pz-sound'));
    // the family-wide switch (every game, every device): the same one setting as in the other games
    out.push(toggle(FAMILY_MUSIC_LABEL, FAMILY_MUSIC_HELP, familyMusicIsOn(app.family), (v) => setFamilyMusic(app.family, v), 'pz-family-music'));
    out.push(toggle('Calm motion', 'This device. Skips the flying plane, train and letters.', app.settings.reducedMotion, (v) => app.setSetting('reducedMotion', v), 'pz-motion'));
    out.push(h('div', { class: 'pz-sec' }, 'Voice'), h('div', { class: 'pz-note', id: 'pz-voice' }, app.voiceStatus()),
      h('div', { class: 'pz-help' }, "Squirrel Chase only ever uses the natural voice, never the device voice, and only for the spelling words, their sentences, the typed letters and the hideout sentence. A player's natural voice is picked in Spell Jump (Parents, Options); it needs a family code. Without one, each word is shown for a moment before it is covered."));
    const change = h('button', { class: 'btn btn-sm', id: 'pz-change-pin', 'data-sfx': '' }, 'Change PIN');
    change.addEventListener('click', () => { pinMode = 'reset'; pinEntry = ''; view = 'pin'; render(); });
    out.push(h('div', { class: 'pz-sec' }, 'PIN'), h('div', { class: 'pz-actions' }, change), h('div', { class: 'ver', style: { marginTop: '14px', fontSize: '12px', color: 'var(--dim)' } }, `Pip's Squirrel Chase ${app.version}`));
    return out;
  }

  function mainView() {
    header('Parent Zone');
    const kids = [sectionTabs()];
    kids.push(...(tab === 'family' ? familyTab() : tab === 'det' ? detTab() : optionsTab()));
    body.replaceChildren(...kids);
  }
  function render() {
    root.dataset.view = view; root.dataset.tab = tab;
    if (view === 'pin') pinView(); else if (view === 'hold') holdView(); else if (view === 'math') mathView(); else mainView();
  }

  const api = {
    get isOpen() { return !root.hidden; },
    open(opts = {}) {
      root.hidden = false;
      tab = opts.tab || 'family'; joinMsg = null;
      if (opts.player) playerId = opts.player;
      view = 'pin'; pinMode = hasPin(app.family) ? 'enter' : 'set'; pinEntry = ''; pinFirst = '';
      render(); fitViewport();
    },
    close() {
      clearTimeout(holdTimer); cancelAnimationFrame(holdRaf);
      root.hidden = true; view = 'pin'; pinEntry = '';
      app.onParentZoneClosed();
    },
    onSyncStatus() { if (!root.hidden && view === 'main' && tab === 'family' && document.activeElement && document.activeElement.id !== 'pz-join-input') render(); },
    onSyncApplied() { if (!root.hidden && view === 'main' && document.activeElement && document.activeElement.tagName !== 'INPUT') render(); },
  };
  return api;
}

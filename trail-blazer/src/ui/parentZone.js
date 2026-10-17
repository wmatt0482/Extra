// Parent Zone (Parents on the player picker and the title; PIN-gated with the family's PIN, the same one as Spell
// Jump: set or changed in either game). First open on a device with no PIN: set a 4-digit PIN (twice). Later: enter
// it. "Forgot PIN": press and hold 3 s, then answer a 2-digit × 2-digit multiplication, then set a new PIN.
// Tabs: Family code (opens first; for the whole family, works with no players) · Options (this device's sound, music,
// motion, shake; Change PIN) · Players (rename, reset Trail Blazer progress, remove). A one-line family sync status
// sits under the title. Native text inputs exist only here (family code, player names).
// TODO (math phase, SPEC §2.8): Facts this week and Report tabs.
import { checkPin, hasPin, playerById, renamePlayer, setPin } from '../../../spell-jump/src/spelling/profiles.js';
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { icon } from './tbIcons.js';
import { drawAvatar } from './vehiclePreview.js';

const HOLD_MS = 3000;
export const SAVE_NOTE = "Trail Blazer's own progress (cash, upgrades, medals, best times) stays on this device for now; the family code shares the players and the PIN with Spell Jump.";

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

  let view = 'pin', tab = 'sync', unlockedUntil = 0, lineTimer = 0, joined = null;
  let pinMode = 'enter', pinFirst = '', pinEntry = '', mathQ = null, mathEntry = '', holdTimer = 0, holdRaf = 0;

  // the iOS keyboard shrinks the visual viewport, not the layout viewport: size the sheet to what is visible
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

  // ---------- PIN (the family's, shared with Spell Jump) ----------
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
    const sub = { set: 'Grown-ups only. The same PIN opens Parents in Spell Jump.', enter: 'The same PIN as in Spell Jump.', reset: 'Answered correctly. Now pick a new PIN.' };
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
    for (const [id, text] of [['sync', 'Family code'], ['options', 'Options'], ['players', 'Players']]) {
      const b = h('button', { class: 'seg-btn' + (tab === id ? ' on' : ''), role: 'tab', 'aria-selected': String(tab === id), 'data-tab': id }, text);
      b.addEventListener('click', () => { tab = id; render(); });
      row.append(b);
    }
    return row;
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
        h('div', { class: 'pz-help' }, 'The same family code as Spell Jump. On another device: open Spell Jump or Trail Blazer, tap Parents, then Join a family, and type this code.'),
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
          h('div', { class: 'sub' }, "Puts this device's players online under a new family code (the same code works in Spell Jump).")), create),
        h('label', { class: 'pz-label', for: 'sync-join-input' }, 'Join a family'),
        h('div', { class: 'pz-join-row' }, input, join),
        h('div', { class: 'pz-help' }, 'Already set up in Spell Jump? Type the family code shown there (Parents → Family code).'),
        msg);
    }
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
    syncLine.replaceChildren(h('span', { class: 'sl-dot', 'aria-hidden': 'true' }), h('span', { class: 'sl-text' }, app.sync.statusLine()));
    syncLine.setAttribute('aria-label', `${app.sync.statusLine()}. Open Family code.`);
  }

  // ---------- Options (this device) ----------
  function optionsTab() {
    const st = app.settings;
    const shake = h('input', { type: 'range', id: 'pz-shake', min: '0', max: '100', step: '5', value: String(st.shake), 'aria-label': 'Screen shake' });
    const out = h('output', { class: 'slider-val' }, `${st.shake}%`);
    const fill = () => shake.style.setProperty('--pct', `${shake.value}%`);
    shake.addEventListener('input', () => { out.textContent = `${shake.value}%`; fill(); app.setShake(Number(shake.value)); });
    fill();
    return [
      h('div', { class: 'hud-label pz-sec' }, 'This device'),
      toggle('Sound effects', null, st.sound, (v) => app.setSetting('sound', v), 'opt-sound'),
      toggle('Music', null, st.music, (v) => app.setSetting('music', v), 'opt-music'),
      toggle('Reduced motion', 'Calmer camera, no screen shake', st.reducedMotion, (v) => app.setSetting('reducedMotion', v), 'opt-motion'),
      h('div', { class: 'row slider-row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Screen shake')), h('div', { class: 'slider' }, shake, out)),
      h('div', { class: 'hud-label pz-sec' }, 'Family'),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Parent PIN'), h('div', { class: 'sub' }, 'Shared with Spell Jump')),
        h('button', { class: 'btn btn-sm', id: 'opt-pin', onclick: () => { pinMode = 'reset'; pinEntry = ''; view = 'pin'; render(); } }, 'Change PIN')),
      h('div', { class: 'ver' }, `Trail Blazer ${app.version}${app.engineName ? ' · ' + app.engineName : ''}`),
    ];
  }

  // ---------- Players ----------
  function playersTab() {
    const f = app.family;
    if (!f.players.length) {
      const add = h('button', { class: 'btn btn-green', id: 'pz-add-player', 'data-sfx': '' }, 'Add a player');
      add.addEventListener('click', () => { api.close(); app.go('newplayer'); });
      return [h('div', { class: 'pz-noplayer', id: 'pz-noplayer' }, h('div', { class: 'label' }, 'No players yet'),
        h('div', { class: 'pz-help' }, 'Add one on the player screen, or join your family on the Family code tab to bring your players here.'), h('div', { class: 'pz-actions' }, add))];
    }
    return f.players.map((p) => {
      const cv = h('canvas', { 'aria-hidden': 'true' });
      const input = h('input', { type: 'text', id: `pz-name-${p.id}`, value: p.name, maxlength: '12', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': `Rename ${p.name}` });
      const save = h('button', { class: 'btn btn-sm btn-green', 'data-rename': p.id, 'data-sfx': '' }, 'Rename');
      save.addEventListener('click', () => {
        if (renamePlayer(app.family, p.id, input.value)) { app.toast('Name saved'); app.onFamilyChanged(); render(); } else { app.audio.error(); app.toast('Type a name (letters only)'); }
      });
      const card = h('div', { class: 'pz-player', 'data-player': p.id, style: { '--c': p.color } },
        h('div', { class: 'pz-player-head' }, cv, h('div', { class: 'name' }, p.name, h('div', { class: 'sub' }, `${app.trailsDoneFor(p.id)} of ${app.trails.length} tracks on the podium, on this device`))),
        h('div', { class: 'pz-rename' }, input, save),
        ...confirmRow('Reset Trail Blazer progress', `Cash, upgrades, medals and tracks back to the start for ${p.name} on this device. Spell Jump is not touched.`, 'Reset',
          `Reset ${p.name}'s Trail Blazer progress?`, 'Reset', () => { app.resetSaveFor(p.id); app.toast('Progress reset'); render(); }, `pz-reset-${p.id}`),
        ...confirmRow('Remove player', `Removes ${p.name} from the family in both games, on every device, with all of ${p.name}'s data.`, 'Remove',
          `Remove ${p.name} for good, in Trail Blazer and Spell Jump?`, 'Remove', () => { app.removePlayer(p.id); render(); }, `pz-remove-${p.id}`));
      drawAvatar(cv, p.color);
      return card;
    });
  }

  function mainView() {
    header('Parent Zone');
    const keep = body.scrollTop;
    const content = tab === 'sync' ? syncTab() : tab === 'options' ? optionsTab() : playersTab();
    body.replaceChildren(sectionTabs(), h('div', { class: 'pz-content', 'data-tab': tab }, ...content.filter(Boolean)));
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
      if (tab === 'sync' || (tab === 'players' && !root.contains(document.activeElement))) render();
    },
    playerExists: (id) => !!playerById(app.family, id),
  };
  return api;
}

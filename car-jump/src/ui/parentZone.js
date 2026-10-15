// Parent Zone (title button, PIN-gated). First open: set a 4-digit PIN (twice). Later: enter it. "Forgot PIN":
// press and hold 3 s, then answer a 2-digit × 2-digit multiplication, then set a new PIN.
// Per-player tabs: Words of the week (text area: the one place a native keyboard is used, since parents type
// here; pattern of the week; dated lists with an archive: view / restore / delete; copy to another player),
// Report (pretest vs latest Friday Test, per-word table, test history, Copy report, "Why this works"),
// Options (speech, speech rate, voice picker, words before each race, new words per day, review words, tile case,
// sound / music / motion / shake, resets).
// Family sync (one tab for the whole family, also reachable from the player picker's chip when the device has no
// players yet): status line, Create family code, Join a family, Leave family, and what is stored online.
// Only this zone deletes anything. The whole zone is one scrollable sheet sized to the visual viewport so the
// iOS keyboard never hides the text area.
import { PLAYER_COLORS, checkPin, hasPin, playerById, playerOptions, setPin, setPlayerOption } from '../spelling/profiles.js';
import { formatList, parseList, MAX_WORDS } from '../spelling/words.js';
import { SAMPLE_PRESENTATION, VOICE_TIP, voiceQuality } from '../spelling/tts.js';
import {
  activeList, archivedLists, deleteList, listById, report, reportText, resetSpelling, restoreList, saveNewList,
} from '../spelling/wordStore.js';
import { WHY_INTRO, WHY_ROWS, WHY_SOURCES } from '../spelling/why.js';
import { $, h } from './dom.js';
import { icon } from './icons.js';
import { drawAvatar } from './players.js';

const HOLD_MS = 3000;
const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const fmtShort = (ms) => (ms ? new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—');
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

function toggle(label, sub, on, onChange, id) {
  const t = h('button', { class: 'toggle', role: 'switch', 'aria-checked': String(!!on), 'aria-label': label, id });
  t.addEventListener('click', () => { const v = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', String(v)); onChange(v); });
  return h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, label), sub ? h('div', { class: 'sub' }, sub) : null), t);
}
function segmented(label, sub, options, value, onChange, id) {
  const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label, id });
  for (const [v, text] of options) {
    const b = h('button', { class: 'seg-btn' + (v === value ? ' on' : ''), role: 'radio', 'aria-checked': String(v === value), 'data-value': String(v) }, text);
    b.addEventListener('click', () => {
      for (const x of wrap.children) { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); }
      onChange(v);
    });
    wrap.append(b);
  }
  return h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, label), sub ? h('div', { class: 'sub' }, sub) : null), wrap);
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
  const body = h('div', { class: 'pz-body scroll', id: 'pz-body' });
  sheet.append(head, body);
  root.replaceChildren(sheet);

  let view = 'pin', tab = 'words', playerId = null, unlockedUntil = 0;
  let joined = null;                   // players shown after a Join (merged list)
  let pinMode = 'enter', pinFirst = '', pinEntry = '', mathQ = null, mathEntry = '';
  let holdTimer = 0, holdRaf = 0;
  let voiceShowAll = false;            // Options → Voice: "Show all N voices" stays open across re-renders
  // the finger that finished the 3 s hold is still down when the math pad appears under it: the click its release
  // synthesizes must not type a digit, so a pad key only acts on a click whose press started on that key
  // (keyboard activation, detail 0, still works)

  // the iOS keyboard shrinks the visual viewport, not the layout viewport: size the sheet to what is visible
  const vv = window.visualViewport;
  function fitViewport() {
    if (!vv) return;
    root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
    root.style.setProperty('--vvt', `${Math.round(vv.offsetTop)}px`);
  }
  if (vv) { vv.addEventListener('resize', fitViewport); vv.addEventListener('scroll', fitViewport); }

  function header(title, { back = null, why = false } = {}) {
    const close = h('button', { class: 'btn icon-btn', id: 'pz-close', 'aria-label': 'Close', 'data-sfx': '', html: icon('close') });
    close.addEventListener('click', () => api.close());
    const kids = [];
    if (back) { const b = h('button', { class: 'btn icon-btn', id: 'pz-back', 'aria-label': 'Back', 'data-sfx': '', html: icon('back') }); b.addEventListener('click', back); kids.push(b); }
    kids.push(h('h3', { id: 'pz-h' }, h('span', { html: icon('lock') }), title));
    if (why) { const w = h('button', { class: 'btn btn-sm', id: 'pz-why', 'data-sfx': '' }, 'Why this works'); w.addEventListener('click', () => { view = 'why'; render(); }); kids.push(w); }
    kids.push(close);
    head.replaceChildren(...kids);
  }

  // ---------- PIN ----------
  function pad(onDigit, onBack, okLabel, onOk) {
    const g = h('div', { class: 'pinpad' });
    const guard = (fn) => (e) => {
      const btn = e.currentTarget;
      const pressed = btn.dataset.pressed === '1';
      btn.dataset.pressed = '';
      if (pressed || e.detail === 0) fn(e);
    };
    g.addEventListener('pointerdown', (e) => { const k = e.target.closest('.pin-key'); if (k) k.dataset.pressed = '1'; });
    for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) g.append(h('button', { class: 'btn pin-key', 'data-digit': d, onclick: guard(() => onDigit(d)) }, d));
    g.append(h('button', { class: 'btn pin-key', 'aria-label': 'Delete', id: 'pin-back', onclick: guard(onBack), html: icon('back') }));
    g.append(h('button', { class: 'btn pin-key', 'data-digit': '0', onclick: guard(() => onDigit('0')) }, '0'));
    g.append(okLabel ? h('button', { class: 'btn btn-green pin-key', id: 'pin-ok', onclick: guard(onOk) }, okLabel) : h('span'));
    return g;
  }
  function dots(n) {
    return h('div', { class: 'pin-dots', 'aria-label': `${n} of 4 digits` }, ...[0, 1, 2, 3].map((i) => h('i', { class: i < n ? 'on' : '' })));
  }
  function pinView(error = '') {
    header('Parent Zone');
    const titles = { set: 'Choose a 4-digit PIN', confirm: 'Type the PIN again', enter: 'Enter the parent PIN', reset: 'Choose a new 4-digit PIN', resetConfirm: 'Type the new PIN again' };
    const sub = { set: 'Grown-ups only: word lists, reports and settings live here.', confirm: '', enter: '', reset: 'Answered correctly. Now pick a new PIN.', resetConfirm: '' };
    const onDigit = (d) => {
      if (pinEntry.length >= 4) return;
      pinEntry += d;
      app.audio.click();
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
      const forgot = h('button', { class: 'btn btn-sm pin-forgot', id: 'pin-forgot', 'data-sfx': '' }, 'Forgot PIN?');
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
  function unlock() {
    unlockedUntil = Date.now() + 5 * 60000;       // stays open for 5 minutes (e.g. after a quick check)
    view = 'main';
    render();
  }

  // ---------- forgot PIN: hold 3 s, then a multiplication ----------
  function holdView() {
    header('Forgot PIN', { back: () => { view = 'pin'; render(); } });
    const ring = h('div', { class: 'hold-ring', style: { '--p': '0' } });
    const btn = h('button', { class: 'btn btn-yellow hold-btn', id: 'pin-hold' }, ring, h('span', {}, 'Press and hold'));
    const stop = () => { clearTimeout(holdTimer); cancelAnimationFrame(holdRaf); ring.style.setProperty('--p', '0'); btn.classList.remove('is-down'); };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      btn.classList.add('is-down');
      const t0 = performance.now();
      const tick = () => { ring.style.setProperty('--p', String(Math.min(1, (performance.now() - t0) / HOLD_MS))); holdRaf = requestAnimationFrame(tick); };
      tick();
      holdTimer = setTimeout(() => {
        stop();
        newMath(); view = 'math'; render();
      }, HOLD_MS);
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
  function playerTabs() {
    const f = app.family;
    const row = h('div', { class: 'pz-players', role: 'tablist' });
    for (const p of f.players) {
      const cv = h('canvas', { class: 'pz-av', 'aria-hidden': 'true' });
      const b = h('button', { class: 'pz-ptab' + (p.id === playerId ? ' on' : ''), role: 'tab', 'aria-selected': String(p.id === playerId), 'data-player': p.id }, cv, h('span', {}, p.name));
      b.addEventListener('click', () => { playerId = p.id; render(); });
      row.append(b);
      drawAvatar(cv, p.color);
    }
    return row;
  }
  function sectionTabs() {
    const row = h('div', { class: 'seg pz-tabs', role: 'tablist' });
    for (const [id, text] of [['words', 'Words of the week'], ['report', 'Report'], ['options', 'Options'], ['sync', 'Family sync']]) {
      const b = h('button', { class: 'seg-btn' + (tab === id ? ' on' : ''), role: 'tab', 'aria-selected': String(tab === id), 'data-tab': id }, text);
      b.addEventListener('click', () => { tab = id; render(); });
      row.append(b);
    }
    return row;
  }

  function wordsTab(p) {
    const d = app.wordsFor(p.id);
    const list = activeList(d);
    const ta = h('textarea', { id: 'pz-words', rows: '9', spellcheck: 'false', autocapitalize: 'none', autocomplete: 'off', autocorrect: 'off',
      placeholder: 'neighbor | neigh/bor | My neighbor has a dog.\nbecause\nenough | e/nough' });
    ta.value = list.sample ? '' : formatList(list.words);
    const pat = h('input', { id: 'pz-pattern', type: 'text', maxlength: '12', spellcheck: 'false', autocapitalize: 'none', autocomplete: 'off', autocorrect: 'off', placeholder: 'e.g. ough or -tion' });
    pat.value = list.sample ? '' : list.pattern || '';
    const msg = h('div', { class: 'pz-msg', id: 'pz-msg', 'aria-live': 'polite' });
    const count = h('span', { class: 'pz-count', id: 'pz-count' });
    const recount = () => { const r = parseList(ta.value); count.textContent = `${r.words.length} / ${MAX_WORDS} words`; count.classList.toggle('over', r.words.length > MAX_WORDS); };
    ta.addEventListener('input', recount);
    for (const f of [ta, pat]) f.addEventListener('focus', () => setTimeout(() => f.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300));
    recount();
    const save = h('button', { class: 'btn btn-green', id: 'pz-save', 'data-sfx': '' }, 'Save list');
    save.addEventListener('click', () => {
      const r = parseList(ta.value);
      if (!r.ok) {
        msg.className = 'pz-msg err';
        msg.replaceChildren(...r.errors.map((e) => h('div', {}, e)), ...r.warnings.map((w) => h('div', { class: 'warn' }, w)));
        app.audio.error();
        return;
      }
      saveNewList(d, r.words, pat.value, Date.now());
      app.saveWordsFor(p.id, d);
      app.toast('List saved');
      render();
      const m = $('#pz-msg');
      m.className = 'pz-msg ok';
      m.replaceChildren(h('div', {}, `Saved ${r.words.length} words. ${p.name} starts with a quick Qualifier on the next PLAY.`), ...r.warnings.map((w) => h('div', { class: 'warn' }, w)));
    });

    const others = app.family.players.filter((x) => x.id !== p.id);
    const copyRow = !list.sample && others.length ? h('div', { class: 'pz-copy' }, h('span', { class: 'sub' }, 'Copy this list to'),
      ...others.map((o) => {
        const b = h('button', { class: 'btn btn-sm', 'data-copy-to': o.id, 'data-sfx': '' }, o.name);
        b.addEventListener('click', () => {
          const od = app.wordsFor(o.id);
          saveNewList(od, list.words, list.pattern, Date.now());
          app.saveWordsFor(o.id, od);
          app.toast(`Copied to ${o.name}`);
        });
        return b;
      })) : null;

    const arch = archivedLists(d);
    const archBox = h('div', { class: 'pz-archive', id: 'pz-archive' });
    if (!arch.length) archBox.append(h('div', { class: 'sub muted' }, 'Older lists show up here after you save a new one. They come back for review 2 and 4 weeks later.'));
    for (const l of arch) {
      const words = h('div', { class: 'pz-arch-words', hidden: true }, l.words.map((w) => w.word).join(', '));
      const confirm = h('div', { class: 'confirm', hidden: true }, h('p', {}, `Delete "${l.name}" and its progress?`),
        h('div', { class: 'btns' }, h('button', { class: 'btn btn-sm', onclick: () => { confirm.hidden = true; } }, 'Cancel'),
          h('button', { class: 'btn btn-sm btn-hot', 'data-del-yes': l.id, onclick: () => { deleteList(d, l.id); app.saveWordsFor(p.id, d); app.toast('List deleted'); render(); } }, 'Delete')));
      archBox.append(h('div', { class: 'pz-arch', 'data-list': l.id },
        h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, l.name), h('div', { class: 'sub' }, `${l.words.length} words${l.pattern ? ` · pattern ${l.pattern}` : ''} · archived ${fmtShort(l.archivedAt)}`)),
          h('button', { class: 'btn btn-sm', 'data-view': l.id, onclick: () => { words.hidden = !words.hidden; } }, 'View'),
          h('button', { class: 'btn btn-sm btn-cyan', 'data-restore': l.id, onclick: () => { restoreList(d, l.id, Date.now()); app.saveWordsFor(p.id, d); app.toast('List restored'); render(); } }, 'Restore'),
          h('button', { class: 'btn btn-sm btn-hot', 'data-delete': l.id, onclick: () => { confirm.hidden = false; } }, 'Delete')),
        words, confirm));
    }

    return [
      h('div', { class: 'pz-active' },
        h('div', { class: 'label' }, list.name, list.sample ? h('span', { class: 'tag' }, 'built in') : null),
        h('div', { class: 'sub' }, list.sample ? `${list.words.length} long-o words, ready to play. Paste next week's words below when they arrive; this list moves to the archive.` : `${list.words.length} words${list.pattern ? ` · pattern of the week: ${list.pattern}` : ''} · saved ${fmtDate(list.createdAt)}`)),
      h('label', { class: 'pz-label', for: 'pz-words' }, 'Words of the week, one per line', count),
      h('div', { class: 'pz-help' }, 'Optional extras after a word, separated by " | ": syllables with slashes, then a sentence. Example: neighbor | neigh/bor | My neighbor has a dog. Letters, apostrophes, hyphens and spaces only; up to 40 words.'),
      h('div', { class: 'pz-help', id: 'pz-help-sayas' }, 'If the voice says a word wrong, add a 4th part: how to say it. Example: read | | I read a book yesterday. | red. Your child never sees it; the tiles still show "read". Letters, apostrophes, hyphens and spaces, up to 40 characters.'),
      ta,
      h('label', { class: 'pz-label', for: 'pz-pattern' }, 'Pattern of the week (optional)'),
      pat,
      msg,
      h('div', { class: 'pz-actions' }, save),
      copyRow,
      h('div', { class: 'hud-label pz-sec' }, 'ARCHIVE'),
      archBox,
    ];
  }

  function reportTab(p) {
    const d = app.wordsFor(p.id);
    const r = report(d);
    const score = (t) => (t ? h('b', {}, `${t.correct} / ${t.total}`, h('small', {}, ` ${pct(t.correct, t.total)}%`)) : h('b', { class: 'muted' }, '—'));
    const table = h('table', { class: 'pz-table', id: 'pz-table' },
      h('thead', {}, h('tr', {}, ...['Word', 'Status', 'Tries', '1st try', 'Last', 'Days'].map((t) => h('th', {}, t)))),
      h('tbody', {}, ...r.rows.map((w) => h('tr', { 'data-word': w.word },
        h('td', {}, w.word), h('td', {}, h('span', { class: 'st st-' + w.status.toLowerCase() }, w.status)), h('td', {}, String(w.attempts)),
        h('td', {}, w.firstTryPct == null ? '—' : w.firstTryPct + '%'), h('td', {}, fmtShort(w.lastPracticed)), h('td', {}, String(w.daysPracticed))))));
    const hist = h('div', { class: 'pz-hist' }, ...(r.history.length ? r.history.map((t) => h('div', { class: 'row' },
      h('div', { class: 'grow' }, h('div', { class: 'label' }, `${t.kind === 'qualifier' ? 'Qualifier' : 'Friday Test'} · ${fmtShort(t.at)}`), h('div', { class: 'sub' }, `${t.listName}${t.missed.length ? ` · missed: ${t.missed.join(', ')}` : ' · no misses'}`)),
      h('div', { class: 'val' }, `${t.correct}/${t.total}`))) : [h('div', { class: 'sub muted' }, 'No tests yet. The Qualifier runs on the first PLAY after you save a list; the Friday Test is on the title screen.')]));
    const out = h('pre', { class: 'pz-report-text', id: 'pz-report-text', hidden: true });
    const copyBtn = h('button', { class: 'btn btn-cyan', id: 'pz-copy-report', 'data-sfx': '' }, 'Copy report');
    copyBtn.addEventListener('click', async () => {
      const text = reportText(d, p.name);
      let ok = false;
      try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; } } catch (_) { ok = false; }
      if (ok) { app.toast('Report copied'); out.hidden = true; return; }
      // fallback: show the text selected so the parent can copy it from the system menu
      out.textContent = text;
      out.hidden = false;
      try { const sel = window.getSelection(); sel.removeAllRanges(); const range = document.createRange(); range.selectNodeContents(out); sel.addRange(range); } catch (_) { /* ignore */ }
      out.scrollIntoView({ block: 'nearest' });
      app.toast('Text selected: use Copy');
    });
    const why = h('button', { class: 'btn btn-sm', 'data-sfx': '', id: 'pz-why-2' }, 'Why this works');
    why.addEventListener('click', () => { view = 'why'; render(); });
    return [
      h('div', { class: 'pz-scores' },
        h('div', { class: 'stat', 'data-score': 'pretest' }, score(r.pretest), h('span', {}, 'Pretest (Qualifier)')),
        h('div', { class: 'stat', 'data-score': 'latest' }, score(r.latest), h('span', {}, 'Latest Friday Test')),
        h('div', { class: 'stat' }, h('b', {}, String(r.counts.Mastered || 0)), h('span', {}, 'Mastered')),
        h('div', { class: 'stat' }, h('b', {}, String(r.streak)), h('span', {}, 'First-try streak'))),
      h('div', { class: 'sub pz-listname' }, `${r.list.name}${r.list.sample ? ' (sample)' : ''} · ${r.rows.length} words · ` + ['Mastered', 'Almost', 'Learning', 'Focus', 'New'].map((s) => `${s} ${r.counts[s] || 0}`).join(' · ')),
      h('div', { class: 'pz-table-wrap' }, table),
      h('div', { class: 'hud-label pz-sec' }, 'TEST HISTORY'),
      hist,
      h('div', { class: 'pz-actions' }, copyBtn, why),
      out,
    ];
  }

  // speech on/off indicator: does this device list voices, and did the last spoken word actually start?
  function speechRow() {
    const t = app.tts;
    const pill = h('span', { class: 'speech-pill', id: 'opt-speech-state' });
    const sub = h('div', { class: 'sub', id: 'opt-speech-sub' });
    const paint = () => {
      const on = t.available && t.voiceCount > 0 && t.health !== 'no-start' && t.health !== 'error';
      pill.textContent = on ? 'Speech on' : 'Speech off';
      pill.classList.toggle('on', on);
      sub.textContent = !t.available ? 'This browser has no speech. Each word is shown for 3 s before your child spells it.'
        : t.voiceCount === 0 ? 'No voices detected yet. Words are shown for 3 s instead. Try "Test voice".'
          : t.health === 'no-start' || t.health === 'error' ? `${t.voiceCount} voice${t.voiceCount === 1 ? '' : 's'} found, but the last word did not play, so words were shown instead. Check the mute switch and volume, then try "Test voice".`
            : `${t.voiceCount} voice${t.voiceCount === 1 ? '' : 's'} detected${t.voiceName ? ` · using ${t.voiceName}` : ''}${t.health === 'ok' ? ' · working' : ''}`;
    };
    paint();
    t.voicesReady().then(paint);
    const test = h('button', { class: 'btn btn-sm', id: 'opt-speech-test', onclick: async () => {
      if (!t.available) return;
      t.unlock();
      await t.say('Spell Jump is ready.');
      paint();
    } }, 'Test voice');
    test.hidden = !t.available;
    return h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Speech ', pill), sub), test);
  }

  // Voice picker: every English voice the device reports, best first (tts.rankVoices). Each row can be tested
  // (▶ speaks the sample presentation in that voice) and chosen; the choice is stored by name + lang in this
  // player's options. "Automatic" = the best-ranked voice. A stored voice this device lacks falls back to it.
  function voicePicker(p, o, set) {
    const t = app.tts;
    if (!t.available) return [];
    const LIMIT = 12;
    const now = h('div', { class: 'sub', id: 'opt-voice-now' });
    const list = h('div', { class: 'pz-voices', id: 'opt-voices', role: 'radiogroup', 'aria-label': 'Voice' });
    const more = h('button', { class: 'btn btn-sm pz-voice-more', id: 'opt-voice-more', 'data-sfx': '' });
    more.addEventListener('click', () => { voiceShowAll = !voiceShowAll; paint(); });
    const current = () => { const q = playerOptions(app.family, p.id); return q.voiceName ? { name: q.voiceName, lang: q.voiceLang } : null; };
    const choose = (v) => {
      set(v ? { voiceName: v.name, voiceLang: v.lang || '' } : { voiceName: '', voiceLang: '' });
      render();                          // the Speech row ("using …") and this list both show the new voice
    };
    const test = (v) => { const vv = v || t.voices()[0]; t.unlock(); t.cancel(); t.present(SAMPLE_PRESENTATION, vv ? { voice: vv } : {}); };
    function row(v, picked, label, sub) {
      const pick = h('button', { class: 'pz-voice-pick' + (picked ? ' on' : ''), role: 'radio', 'aria-checked': String(picked), 'data-voice': v ? v.name : '' },
        h('span', { class: 'pz-voice-dot', 'aria-hidden': 'true' }),
        h('span', { class: 'grow' }, h('span', { class: 'label' }, label), h('span', { class: 'sub' }, sub)));
      pick.addEventListener('click', () => choose(v));
      const play = h('button', { class: 'btn btn-sm pz-voice-test', 'aria-label': `Test ${label}`, 'data-voice-test': v ? v.name : '' }, '\u25B6\uFE0E Test');
      play.addEventListener('click', () => test(v));
      return h('div', { class: 'pz-voice', 'data-voice-row': v ? v.name : '' }, pick, play);
    }
    function paint() {
      const voices = t.voices();
      const pref = current();
      const used = t.resolveVoice(pref);
      const missing = pref && (!used || used.name !== pref.name);
      now.textContent = !voices.length ? 'No English voices found yet.'
        : `Now using: ${used ? used.name : 'the system voice'}${missing ? ` (${pref.name} isn't on this device)` : ''}`;
      const best = voices[0];
      const rows = [row(null, !pref, 'Automatic', best ? `Best on this device: ${best.name}` : 'The system voice')];
      // the short list always includes the picked voice, even when it ranks below the first LIMIT
      const shown = voiceShowAll ? voices : voices.filter((v, i) => i < LIMIT || (pref && !missing && used && v.name === used.name && v.lang === used.lang));
      for (const v of shown) {
        const q = voiceQuality(v);
        rows.push(row(v, !!pref && !missing && !!used && v.name === used.name && v.lang === used.lang, v.name, [v.lang, q.label, v.localService === false ? 'online' : ''].filter(Boolean).join(' · ')));
      }
      list.replaceChildren(...rows);
      more.hidden = voices.length <= LIMIT;
      more.textContent = voiceShowAll ? 'Show fewer voices' : `Show all ${voices.length} voices`;
    }
    paint();
    if (!t.voiceCount) t.voicesReady().then(() => { if (list.isConnected) paint(); });
    return [
      h('div', { class: 'row pz-voice-head' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Voice'), now)),
      list,
      more,
      h('div', { class: 'pz-help pz-voice-tip', id: 'opt-voice-tip' }, VOICE_TIP),
    ];
  }

  function optionsTab(p) {
    const o = playerOptions(app.family, p.id);
    const set = (k, v) => { setPlayerOption(app.family, p.id, k, v); app.persistFamily(); app.onOptionsChanged(p.id); };
    const st = app.settingsFor(p.id);
    const setGame = (k, v) => { app.setSettingFor(p.id, k, v); };
    const shake = h('input', { type: 'range', id: 'pz-shake', min: '0', max: '100', step: '5', value: String(st.shake), 'aria-label': 'Screen shake' });
    const shakeOut = h('output', { class: 'slider-val' }, `${st.shake}%`);
    const fill = () => shake.style.setProperty('--pct', `${shake.value}%`);
    shake.addEventListener('input', () => { shakeOut.textContent = `${shake.value}%`; fill(); setGame('shake', Number(shake.value)); });
    fill();
    return [
      h('div', { class: 'hud-label pz-sec' }, 'SPELLING'),
      speechRow(),
      segmented('Speech rate', 'How fast words are read aloud', [['veryslow', 'Very slow'], ['slow', 'Slow'], ['normal', 'Normal']], o.rate, (v) => set('rate', v), 'opt-rate'),
      ...voicePicker(p, o, set),
      segmented('Words before each race', 'Spelled back to back before the car launches; more right on the first try = more power', [[1, '1'], [2, '2'], [3, '3'], [4, '4']], o.wordsPerRace, (v) => set('wordsPerRace', v), 'opt-race-words'),
      segmented('New words per day', 'All of this week\'s words by default. Pick a smaller number for a child who is overwhelmed', [[3, '3'], [5, '5'], [8, '8'], [99, 'All']], o.newPerDay, (v) => set('newPerDay', v), 'opt-new'),
      toggle('Past-list review words', 'Old lists come back 2 and 4 weeks later', o.includeReview, (v) => set('includeReview', v), 'opt-review'),
      segmented('Letter tiles', 'How letters look on the tiles and keys', [['lower', 'abc'], ['upper', 'ABC']], o.tileCase, (v) => set('tileCase', v), 'opt-case'),
      h('div', { class: 'hud-label pz-sec' }, 'GAME'),
      toggle('Sound effects', null, st.sound, (v) => setGame('sound', v), 'opt-sound'),
      toggle('Music', null, st.music, (v) => setGame('music', v), 'opt-music'),
      toggle('Reduced motion', 'No screen shake or slow-mo', st.reducedMotion, (v) => setGame('reducedMotion', v), 'opt-motion'),
      h('div', { class: 'row slider-row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Screen shake')), h('div', { class: 'slider' }, shake, shakeOut)),
      h('div', { class: 'hud-label pz-sec' }, 'RESET'),
      ...confirmRow('Reset spelling data', `Clears ${p.name}'s word progress and test history (lists stay)`, 'Reset', `Clear ${p.name}'s spelling progress? Lists stay.`, 'Reset spelling', () => {
        const d = app.wordsFor(p.id); resetSpelling(d, Date.now()); app.saveWordsFor(p.id, d); app.toast('Spelling data reset'); render();
      }, 'opt-reset-words'),
      ...confirmRow('Reset game save', `Cash, cars, upgrades and badges back to zero for ${p.name}`, 'Reset', `Wipe ${p.name}'s cash, cars, upgrades and badges?`, 'Reset game', () => {
        app.resetGameFor(p.id); app.toast('Game save reset'); render();
      }, 'opt-reset-game'),
      ...confirmRow('Remove player', `Deletes ${p.name} and all of ${p.name}'s data`, 'Remove', `Remove ${p.name} for good?`, 'Remove', () => {
        app.removePlayer(p.id); playerId = (app.family.players[0] || {}).id || null; if (!playerId) { api.close(); return; } render();
      }, 'opt-remove'),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Parent PIN')),
        h('button', { class: 'btn btn-sm', id: 'opt-pin', onclick: () => { pinMode = 'reset'; pinEntry = ''; view = 'pin'; render(); } }, 'Change PIN')),
      h('div', { class: 'ver' }, `Spell Jump ${app.version}${app.engineName ? ' · ' + app.engineName : ''} · voice: ${app.tts.available ? (app.tts.voiceName || 'system') : 'not available'}`),
    ];
  }

  // ---------- Family sync ----------
  const PRIVACY = "What's stored online: player first names, word lists, spelling progress and the parent PIN (hashed). No emails or accounts. Anyone with the family code can see and change these, so keep it private.";
  function syncStatusClass(st) { return 'pz-sync-status' + (!st.synced ? '' : st.offline ? ' off' : st.lastError ? ' err' : ' on'); }
  function syncTab() {
    const sync = app.sync;
    const st = sync.status();
    const status = h('div', { class: syncStatusClass(st), id: 'sync-status', 'aria-live': 'polite' }, sync.statusText());
    const msg = h('div', { class: 'pz-msg', id: 'sync-msg', 'aria-live': 'polite' });
    const say = (ok, ...lines) => { msg.className = 'pz-msg ' + (ok ? 'ok' : 'err'); msg.replaceChildren(...lines.map((l) => h('div', {}, l))); };
    const out = [h('div', { class: 'hud-label pz-sec pz-sec-first' }, 'FAMILY SYNC'), status];
    if (st.synced) {
      const copy = h('button', { class: 'btn btn-sm btn-cyan', id: 'sync-copy', 'data-sfx': '' }, 'Copy');
      copy.addEventListener('click', async () => {
        let ok = false;
        try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(st.code); ok = true; } } catch (_) { ok = false; }
        if (ok) { app.toast('Code copied'); return; }
        try { const sel = window.getSelection(); sel.removeAllRanges(); const r = document.createRange(); r.selectNodeContents(codeEl); sel.addRange(r); } catch (_) { /* ignore */ }
        app.toast('Code selected: use Copy');
      });
      const codeEl = h('div', { class: 'pz-code', id: 'sync-code' }, st.code);
      const now = h('button', { class: 'btn btn-sm', id: 'sync-now', 'data-sfx': '' }, 'Sync now');
      now.addEventListener('click', async () => { now.disabled = true; await sync.syncNow(); now.disabled = false; paintSyncStatus(); });
      out.push(
        h('div', { class: 'pz-code-row' }, codeEl, copy, now),
        h('div', { class: 'pz-help' }, 'On another phone, tablet or computer: open Spell Jump, then Parents → Family sync → Join a family, and type this code. Players, word lists and progress then show up on both.'),
        msg,
      );
      if (joined) {
        out.push(h('div', { class: 'pz-sync-players', id: 'sync-players' }, h('div', { class: 'label' }, 'Players in this family'),
          joined.length ? h('div', { class: 'pz-sync-names' }, ...joined.map((p) => h('span', { class: 'pz-sync-name', 'data-player': p.id, style: { '--c': p.color } }, p.name))) : h('div', { class: 'sub' }, 'No players yet.')));
      }
      out.push(...confirmRow('Leave family', 'This device stops syncing. Its players and words stay here; the other devices keep the family.', 'Leave',
        'Stop syncing this device? Nothing is deleted.', 'Leave family', () => { sync.leave(); joined = null; app.toast('Left the family'); render(); }, 'sync-leave'));
    } else {
      const create = h('button', { class: 'btn btn-green', id: 'sync-create', 'data-sfx': '' }, 'Create family code');
      create.addEventListener('click', async () => {
        create.disabled = true; create.textContent = 'Creating…';
        const r = await sync.create();
        if (!r.ok) { create.disabled = false; create.textContent = 'Create family code'; say(false, r.error); app.audio.error(); return; }
        joined = null;
        app.toast('Family code created');
        render();
        const m = $('#sync-msg');
        if (m) { m.className = 'pz-msg ok'; m.replaceChildren(h('div', {}, `Family code ${r.code} created. Type it on your other devices to join.`)); }
      });
      const input = h('input', { id: 'sync-join-input', type: 'text', maxlength: '9', spellcheck: 'false', autocapitalize: 'characters', autocomplete: 'off', autocorrect: 'off',
        placeholder: 'ABCD-2345', 'aria-label': 'Family code', inputmode: 'text' });
      input.addEventListener('focus', () => setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300));
      input.addEventListener('input', () => { const v = input.value.toUpperCase(); if (v !== input.value) input.value = v; });
      const join = h('button', { class: 'btn btn-cyan', id: 'sync-join', 'data-sfx': '' }, 'Join');
      const doJoin = async () => {
        join.disabled = true; join.textContent = 'Joining…';
        const r = await sync.join(input.value);
        if (!r.ok) { join.disabled = false; join.textContent = 'Join'; say(false, r.error); app.audio.error(); return; }
        joined = r.players;
        app.toast('Joined the family');
        render();
        const m = $('#sync-msg');
        if (m) { m.className = 'pz-msg ok'; m.replaceChildren(h('div', {}, `Joined family ${r.code}. This device now uses the family's parent PIN.`)); }
      };
      join.addEventListener('click', doJoin);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doJoin(); } });
      out.push(
        h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Start a family'),
          h('div', { class: 'sub' }, "Puts this device's players online under a new family code, for your other devices to join.")), create),
        h('label', { class: 'pz-label', for: 'sync-join-input' }, 'Join a family'),
        h('div', { class: 'pz-help' }, 'Type the family code shown on your other device (Parents → Family sync). Players from both devices are kept.'),
        h('div', { class: 'pz-join-row' }, input, join),
        msg,
      );
    }
    out.push(h('div', { class: 'hud-label pz-sec' }, 'PRIVACY'), h('p', { class: 'pz-help pz-privacy', id: 'sync-privacy' }, PRIVACY));
    return out;
  }
  // refresh just the status line (a full re-render would drop what a parent is typing)
  function paintSyncStatus() {
    const el = $('#sync-status');
    if (!el) return;
    el.className = syncStatusClass(app.sync.status());
    el.textContent = app.sync.statusText();
  }

  function whyView() {
    header('Why this works', { back: () => { view = 'main'; render(); } });
    body.replaceChildren(h('div', { class: 'why', id: 'pz-why-page' },
      h('p', { class: 'why-intro' }, WHY_INTRO),
      ...WHY_ROWS.map((r) => h('div', { class: 'why-row card' },
        h('div', { class: 'why-tech' }, r.technique),
        h('div', { class: 'why-ev' }, h('b', {}, 'Evidence: '), r.evidence),
        h('div', { class: 'why-where' }, h('b', {}, 'In the game: '), r.where))),
      h('p', { class: 'why-src' }, 'Sources consulted (secondary summaries unless noted): ' + WHY_SOURCES)));
    body.scrollTop = 0;
  }

  function mainView() {
    header('Parent Zone', { why: true });
    const f = app.family;
    if (!playerById(f, playerId)) playerId = (f.players[0] || {}).id || null;
    const p = playerById(f, playerId);
    const keepScroll = body.scrollTop;
    if (!p) {
      // no players on this device yet: only Family sync (join a family to bring the players here)
      tab = 'sync';
      body.replaceChildren(h('div', { class: 'sub pz-noplayer' }, 'No players on this device yet. Add one on the player screen, or join your family below to bring your players here.'),
        h('div', { class: 'pz-content', 'data-tab': 'sync' }, ...syncTab().filter(Boolean)));
      body.scrollTop = keepScroll;
      return;
    }
    const content = tab === 'sync' ? syncTab() : tab === 'words' ? wordsTab(p) : tab === 'report' ? reportTab(p) : optionsTab(p);
    body.replaceChildren(playerTabs(), sectionTabs(), h('div', { class: 'pz-content', 'data-tab': tab }, ...content.filter(Boolean)));
    body.scrollTop = keepScroll;
  }

  function render() {
    root.dataset.view = view;
    if (view === 'pin') pinView();
    else if (view === 'hold') holdView();
    else if (view === 'math') mathView();
    else if (view === 'why') whyView();
    else mainView();
  }

  const api = {
    get isOpen() { return !root.hidden; },
    get view() { return view; },
    open(forPlayer, opts = {}) {
      playerId = forPlayer || app.currentPlayerId || (app.family.players[0] || {}).id || null;
      tab = opts.tab || 'words';
      joined = null;
      pinEntry = ''; pinFirst = '';
      if (Date.now() < unlockedUntil) view = 'main';
      else { view = 'pin'; pinMode = hasPin(app.family) ? 'enter' : 'set'; }
      root.hidden = false;
      fitViewport();
      render();
      body.scrollTop = 0;
    },
    close() {
      clearTimeout(holdTimer); cancelAnimationFrame(holdRaf);
      if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();
      root.hidden = true;
      app.onParentZoneClosed();
    },
    lock() { unlockedUntil = 0; },
    // family sync: the status changed / newer data arrived from another device
    onSyncStatus() { if (!root.hidden && view === 'main' && tab === 'sync') paintSyncStatus(); },
    onSyncApplied() {
      if (root.hidden || view !== 'main') return;
      // re-render the family-level tab (player list, status); other tabs keep what a parent may be typing
      if (tab === 'sync') { if (joined) joined = app.family.players.map((p) => ({ id: p.id, name: p.name, color: p.color })); render(); }
      else if (!playerById(app.family, playerId)) render();
    },
  };
  return api;
}

export { PLAYER_COLORS };

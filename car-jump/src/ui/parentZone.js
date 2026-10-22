// Parent Zone (Parents buttons on the title and the player picker, PIN-gated). First open: set a 4-digit PIN (twice).
// Later: enter it. "Forgot PIN":
// press and hold 3 s, then answer a 2-digit × 2-digit multiplication, then set a new PIN.
// Per-player tabs: Words of the week (text area: the one place a native keyboard is used, since parents type
// here; pattern of the week; dated lists with an archive: view / restore / delete; copy to another player),
// Report (pretest vs latest Friday Test, per-word table, test history, Copy report, "Why this works"),
// Options (speech on/off + Test voice, Speech check with a timestamped log and Copy log, speech rate, voice picker
// in two groups: "Natural voices (online)" (Google voices made into clips on the server, v3.4: need a family code;
// a status line says whether they are ready) and "Device voices" ("Automatic" / "Use default system voice" / each
// English voice), words before each race, new words per day, review words, tile case, sound / music / motion /
// shake, resets).
// Family code (the first tab and the one that opens; for the whole family, so it works with no players at all):
// the code (or Create / Join) on top, then details, Leave family, and what is stored online last. A one-line sync
// status sits under the Parent Zone title on every tab (tap it to jump to Family code). With no players yet the
// per-player tabs only say "Add a player first".
// Only this zone deletes anything. The whole zone is one scrollable sheet sized to the visual viewport so the
// iOS keyboard never hides the text area.
import { PLAYER_COLORS, checkPin, hasPin, playerById, playerOptions, setPin, setPlayerOption } from '../spelling/profiles.js';
import { formatList, parseList, MAX_WORDS } from '../spelling/words.js';
import { SAMPLE_PRESENTATION, SYSTEM_VOICE, VOICE_TIP, buildPresentation, voiceQuality } from '../spelling/tts.js';
import { CLOUD_VOICES, cloudVoiceInfo } from '../tts/voices.js';
import {
  activeList, applyClassList, archivedLists, deleteList, listById, report, reportText, resetSpelling, restoreList, saveNewList, stopFollowing, weekProgress,
} from '../spelling/wordStore.js';
import { newestClassList } from '../data/classLists.js';
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
  // the family sync status under the title (main view only: the code stays behind the PIN)
  const syncLine = h('button', { class: 'pz-sync-line', id: 'pz-sync-line', 'data-sfx': '', hidden: true });
  syncLine.addEventListener('click', () => { if (tab !== 'sync') { tab = 'sync'; render(); body.scrollTop = 0; } });
  const body = h('div', { class: 'pz-body scroll', id: 'pz-body' });
  sheet.append(head, syncLine, body);
  root.replaceChildren(sheet);

  let view = 'pin', tab = 'sync', playerId = null, unlockedUntil = 0;
  let lineTimer = 0;                   // keeps "synced 2 min ago" current while the zone is open
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
    for (const [id, text] of [['sync', 'Family code'], ['words', 'Words of the week'], ['report', 'Report'], ['options', 'Options']]) {
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
    const pat = h('input', { id: 'pz-pattern', type: 'text', maxlength: '104', spellcheck: 'false', autocapitalize: 'none', autocomplete: 'off', autocorrect: 'off', placeholder: 'e.g. ough, -tion, or un- re- pre- for a prefix week' });
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
      if (app.cloudPrepareFor) app.cloudPrepareFor(p.id);    // natural voice: make this list's clips now
      if (app.ping) app.ping('list');                         // v3.7.2: the anonymous counter (no words, no names)
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
          if (app.cloudPrepareFor) app.cloudPrepareFor(o.id);
          if (app.ping) app.ping('list');
          app.toast(`Copied to ${o.name}`);
        });
        return b;
      })) : null;

    // v3.7: this week's class list (src/data/classLists.js): one tap for this player or the whole family
    const cl = newestClassList(Date.now());
    let classCard = null;
    if (cl) {
      const following = !!list.classId;
      const useFor = (ids) => {
        const now = Date.now();
        for (const id of ids) {
          const wd = app.wordsFor(id);
          applyClassList(wd, cl, now);
          app.saveWordsFor(id, wd);
          if (app.cloudPrepareFor) app.cloudPrepareFor(id);
        }
        if (app.ping) app.ping('list');
      };
      const actions = following
        ? [h('div', { class: 'pc-follow', id: 'pz-class-following' }, 'Following the class lists ✓ · each new week applies on its own'),
          h('button', { class: 'pc-stop', id: 'pz-class-stop', 'data-sfx': '', onclick: () => { stopFollowing(d, Date.now()); app.saveWordsFor(p.id, d); app.toast('Stopped following the class lists'); render(); } }, 'Stop following')]
        : [h('button', { class: 'btn btn-sm btn-cyan', id: 'pz-class-use', 'data-sfx': '', onclick: () => { useFor([p.id]); app.toast(`Class list for ${p.name}`); render(); } }, `Use for ${p.name}`),
          app.family.players.length > 1 ? h('button', { class: 'btn btn-sm', id: 'pz-class-all', 'data-sfx': '', onclick: () => { useFor(app.family.players.map((x) => x.id)); app.toast('Class list for everyone'); render(); } }, 'Use for everyone') : null];
      classCard = h('div', { class: 'pz-class', id: 'pz-class', 'data-class': cl.id, 'data-following': String(following) },
        h('div', { class: 'pc-head' }, h('span', { class: 'tag' }, 'Class list'), h('b', {}, `${cl.name} · ${cl.words.length} words`)),
        h('div', { class: 'pc-words' }, cl.words.map((w) => w.word).join(' · ')),
        cl.pattern ? h('div', { class: 'sub' }, `Pattern of the week: ${cl.pattern}`) : null,
        h('div', { class: 'pc-actions' }, ...actions));
    }

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
      classCard,
      h('div', { class: 'pz-active' },
        h('div', { class: 'label' }, list.name, list.sample ? h('span', { class: 'tag' }, 'built in') : list.classId ? h('span', { class: 'tag' }, 'class list') : null),
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

  // v3.7.1: the week's progress (parent-facing only): a big line + bar on the Report, a strip per child on Family
  const pctText = (v) => (v == null ? '—' : `${v} %`);
  const bar = (v, cls) => h('div', { class: cls, role: 'img', 'aria-label': v == null ? 'no progress yet' : `${v} percent` }, h('i', { style: { width: `${v || 0}%` } }));
  function weekBlock(d) {
    const w = weekProgress(d, Date.now());
    const small = !w.practiced ? `No practice yet on these ${w.words} words`
      : `Right on last try ${w.rightLastTry} / ${w.words} (${w.rightLastTryPct} %)${w.pretest ? ` · pretest ${w.pretest.right} / ${w.pretest.total} → now ${w.rightLastTry} / ${w.words}` : ''}${w.testScore ? ` · Friday Test ${w.testScore.right} / ${w.testScore.total}` : ''}`;
    return h('div', { class: 'pz-week', id: 'pz-week', 'data-pct': w.practiced ? String(w.masteredPct) : '' },
      h('div', { class: 'pw-big' }, `This week: ${w.practiced ? pctText(w.masteredPct) : '—'} mastered`), bar(w.practiced ? w.masteredPct : null, 'pw-bar'), h('div', { class: 'pw-small' }, small));
  }
  function familyWeek() {
    const players = app.family.players;
    if (!players.length) return [];
    return [h('div', { class: 'hud-label pz-sec' }, 'THIS WEEK'),
      h('div', { class: 'pz-week-list', id: 'pz-week-list' }, ...players.map((p) => {
        const w = weekProgress(app.wordsFor(p.id), Date.now());
        const v = w.practiced ? w.masteredPct : null;
        return h('div', { class: 'pz-week-row', 'data-player': p.id, 'data-pct': v == null ? '' : String(v), style: { '--c': p.color } },
          h('b', {}, p.name), h('span', { class: 'pw-strip' }, `Spelling this week · ${v == null ? '— (no practice yet)' : `${v} % mastered`}`), bar(v, 'pw-mini'));
      }))];
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
      // fallback: the text is shown selected so the parent can copy it from the system menu
      if (await copyText(reportText(d, p.name), out, 'Report')) out.hidden = true;
    });
    const why = h('button', { class: 'btn btn-sm', 'data-sfx': '', id: 'pz-why-2' }, 'Why this works');
    why.addEventListener('click', () => { view = 'why'; render(); });
    return [
      weekBlock(d),
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

  // copy text to the clipboard; when that is not allowed, show it selected in `pre` so the parent can copy it from
  // the system menu. Resolves true when it went to the clipboard.
  async function copyText(text, pre, what) {
    let ok = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; } } catch (_) { ok = false; }
    if (ok) { app.toast(`${what} copied`); return true; }
    pre.textContent = text;
    pre.hidden = false;
    try { const sel = window.getSelection(); sel.removeAllRanges(); const range = document.createRange(); range.selectNodeContents(pre); sel.addRange(range); } catch (_) { /* ignore */ }
    pre.scrollIntoView({ block: 'nearest' });
    app.toast('Text selected: use Copy');
    return false;
  }

  // speech on/off indicator: does this device list voices, and did the last spoken word actually start?
  let repaintSpeech = () => {};
  let lastCheckOk = null;              // the last speech check's outcome (its log lives in tts.lastCheck)
  function speechRow() {
    const t = app.tts;
    const pill = h('span', { class: 'speech-pill', id: 'opt-speech-state' });
    const sub = h('div', { class: 'sub', id: 'opt-speech-sub' });
    const n = (k) => `${k} voice${k === 1 ? '' : 's'}`;
    const paint = () => {
      const failed = t.gaveUp || t.health === 'no-start' || t.health === 'error' || t.health === 'not-allowed';
      const on = t.available && (t.voiceCount > 0 || t.health === 'ok') && !failed;
      pill.textContent = on ? 'Speech on' : 'Speech off';
      pill.classList.toggle('on', on);
      sub.textContent = !t.available ? 'This browser has no speech. Each word is shown for 3 s before your child spells it.'
        : t.health === 'not-allowed' ? 'The browser blocked the voice until a tap. Your child can tap "Hear it"; or tap "Test voice" here.'
          : t.gaveUp ? `The voice did not start ${t.failStreak} times in a row, so words are shown instead for now. Tapping "Hear it" tries again. Check the volume and mute switch, then run the speech check below.`
            : t.voiceCount === 0 && t.health !== 'ok' ? 'No voices detected yet. Words are shown for 3 s instead. Try "Test voice" or the speech check below.'
              : failed ? `${n(t.voiceCount)} found, but the last word did not play, so it was shown instead. The next word tries again. Check the mute switch and volume, then try "Test voice".`
                : `${n(t.voiceCount)} detected${t.systemVoice ? ' · using the default system voice' : t.voiceName ? ` · using ${t.voiceName}` : ''}${t.health === 'ok' ? ' · working' : ''}`;
    };
    paint();
    repaintSpeech = paint;
    t.voicesReady().then(() => { if (pill.isConnected) paint(); });
    const test = h('button', { class: 'btn btn-sm', id: 'opt-speech-test', onclick: async () => {
      if (!t.available) return;
      t.unlock(); t.reprobe();
      await t.say('Spell Jump is ready.');
      paint();
    } }, 'Test voice');
    test.addEventListener('pointerdown', () => t.unlock());      // Safari: the first speak() inside the gesture
    test.hidden = !t.available;
    return h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Speech ', pill), sub), test);
  }

  // Speech check: speaks "The word is, neighbor." inside the tap and logs each step with a timestamp (API, voices,
  // chosen voice + localService, speak(), onstart / onend / onerror, watchdog). The last log stays in memory
  // (tts.lastCheck) and can be copied for whoever helps with the problem.
  function speechCheck() {
    const t = app.tts;
    const log = h('pre', { class: 'pz-check-log', id: 'opt-check-log', 'aria-live': 'polite' });
    const copyOut = h('pre', { class: 'pz-report-text', id: 'opt-check-copy', hidden: true });
    const copy = h('button', { class: 'btn btn-sm', id: 'opt-check-copy-btn', 'data-sfx': '' }, 'Copy log');
    const run = h('button', { class: 'btn btn-sm btn-cyan', id: 'opt-check-run' }, 'Run speech check');
    const show = (c, state = '') => {
      log.hidden = !c;
      copy.hidden = !c;
      log.textContent = c ? c.text : '';
      log.className = 'pz-check-log' + (state ? ' ' + state : '');
    };
    show(t.lastCheck, lastCheckOk == null ? '' : lastCheckOk ? 'ok' : 'bad');
    run.addEventListener('pointerdown', () => t.unlock());
    run.addEventListener('click', () => {
      copyOut.hidden = true;
      // no await before runCheck: speak() must happen inside this tap (Safari)
      const header = [`Spell Jump ${app.version} · ${navigator.userAgent}`];
      const p = t.runCheck({ header, onLine: (line, lines) => { log.hidden = false; copy.hidden = false; log.textContent = lines.join('\n'); log.scrollTop = log.scrollHeight; } });
      run.disabled = true;
      p.then((res) => { lastCheckOk = res.ok; if (log.isConnected) show(t.lastCheck, res.ok ? 'ok' : 'bad'); })
        .finally(() => { run.disabled = false; repaintSpeech(); });
    });
    copy.addEventListener('click', () => { const c = t.lastCheck; if (c) copyText(c.text, copyOut, 'Log'); });
    return [
      h('div', { class: 'row pz-check' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Speech check'),
        h('div', { class: 'sub' }, 'If the voice is not working: tap this with the sound on. It says "The word is, neighbor." and shows what the browser did.')),
      h('div', { class: 'pz-actions pz-check-actions' }, run, copy)),
      log,
      copyOut,
    ];
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
    // a device voice picked: the natural voice is off for this player ('' = chosen, so it is not picked again for them)
    const choose = (v) => {
      set({ ...(v === SYSTEM_VOICE ? { voiceName: SYSTEM_VOICE, voiceLang: '' } : v ? { voiceName: v.name, voiceLang: v.lang || '' } : { voiceName: '', voiceLang: '' }), cloudVoice: '' });
      render();                          // the Speech row ("using …") and this list both show the new voice
    };
    // v: a voice, null (Automatic: the best-ranked one) or SYSTEM_VOICE (no voice set: the browser's default)
    const test = (v) => {
      const vv = v === SYSTEM_VOICE ? SYSTEM_VOICE : v || t.voices()[0];
      t.unlock(); t.reprobe(); t.cancel(); t.present(SAMPLE_PRESENTATION, vv ? { voice: vv } : {});
    };
    const key = (v) => (v === SYSTEM_VOICE ? SYSTEM_VOICE : v ? v.name : '');
    function row(v, picked, label, sub) {
      const pick = h('button', { class: 'pz-voice-pick' + (picked ? ' on' : ''), role: 'radio', 'aria-checked': String(picked), 'data-voice': key(v) },
        h('span', { class: 'pz-voice-dot', 'aria-hidden': 'true' }),
        h('span', { class: 'grow' }, h('span', { class: 'label' }, label), h('span', { class: 'sub' }, sub)));
      pick.addEventListener('click', () => choose(v));
      const play = h('button', { class: 'btn btn-sm pz-voice-test', 'aria-label': `Test ${label}`, 'data-voice-test': key(v) }, '\u25B6\uFE0E Test');
      play.addEventListener('pointerdown', () => t.unlock());   // Safari: the first speak() inside the gesture
      play.addEventListener('click', () => test(v));
      return h('div', { class: 'pz-voice', 'data-voice-row': key(v) }, pick, play);
    }
    function paint() {
      const voices = t.voices();
      const pref = current();
      const cloudOn = cloudActiveFor(p);
      const system = !!pref && pref.name === SYSTEM_VOICE;
      const used = system ? null : t.resolveVoice(pref);
      const missing = !system && pref && (!used || used.name !== pref.name);
      const deviceNow = system ? 'the default system voice (the browser picks)' : `${used ? used.name : 'the system voice'}${missing ? ` (${pref.name} isn't on this device)` : ''}`;
      const ci = cloudOn ? cloudVoiceInfo(playerOptions(app.family, p.id).cloudVoice) : null;
      now.textContent = ci ? `Now using: ${ci.name}, the natural voice · device voice when a clip is missing: ${voices.length || system ? deviceNow : 'none found'}`
        : system ? 'Now using: the default system voice (the browser picks)'
          : !voices.length ? 'No English voices found yet.'
            : `Now using: ${deviceNow}`;
      const best = voices[0];
      const rows = [
        row(null, !cloudOn && !pref, 'Automatic', best ? `Best on this device: ${best.name}` : 'The system voice'),
        row(SYSTEM_VOICE, !cloudOn && system, 'Use default system voice', 'The browser picks. Try this if a voice stays silent.'),
      ];
      // the short list always includes the picked voice, even when it ranks below the first LIMIT
      const shown = voiceShowAll ? voices : voices.filter((v, i) => i < LIMIT || (pref && !system && !missing && used && v.name === used.name && v.lang === used.lang));
      for (const v of shown) {
        const q = voiceQuality(v);
        rows.push(row(v, !cloudOn && !!pref && !system && !missing && !!used && v.name === used.name && v.lang === used.lang, v.name, [v.lang, q.label, v.localService === false ? 'online (slower to start)' : 'on device'].filter(Boolean).join(' · ')));
      }
      list.replaceChildren(...rows);
      more.hidden = voices.length <= LIMIT;
      more.textContent = voiceShowAll ? 'Show fewer voices' : `Show all ${voices.length} voices`;
    }
    paint();
    if (!t.voiceCount) t.voicesReady().then(() => { if (list.isConnected) paint(); });
    return [
      h('div', { class: 'row pz-voice-head' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Voice'), now)),
      ...cloudPicker(p, set),
      h('div', { class: 'pz-voice-group', id: 'opt-device-voices-head' }, 'Device voices'),
      list,
      more,
      h('div', { class: 'pz-help pz-voice-tip', id: 'opt-voice-tip' }, VOICE_TIP),
    ];
  }

  // ---------- natural voices (v3.4, src/spelling/cloudVoice.js) ----------
  // Google voices the server turns into clips (needs a family code; the server needs GOOGLE_TTS_API_KEY). ▶ Test asks
  // the server for the sample presentation in that voice and plays it; picking one stores `cloudVoice` in the
  // player's options (synced) and makes the clips for this player's list.
  const cloudActiveFor = (p) => !!(app.cloud && app.sync.code && playerOptions(app.family, p.id).cloudVoice);
  let repaintCloud = () => {};
  function cloudPicker(p, set) {
    const cloud = app.cloud;
    if (!cloud) return [];
    const status = h('div', { class: 'sub pz-cloud-status', id: 'opt-cloud-status', 'aria-live': 'polite' });
    const list = h('div', { class: 'pz-voices', id: 'opt-cloud-voices', role: 'radiogroup', 'aria-label': 'Natural voices' });
    let note = '';                      // a one-off message (Test failed) shown instead of the status for a while
    const chosen = () => playerOptions(app.family, p.id).cloudVoice || '';
    const usable = () => !!app.sync.code && cloud.server.key !== false;
    function paint() {
      const v = chosen();
      status.textContent = note || cloud.statusText(v);
      status.className = 'sub pz-cloud-status' + (app.sync.code && cloud.server.key && !cloud.server.error && v ? ' ok' : '');
      const ok = usable();
      list.replaceChildren(...CLOUD_VOICES.map((cv) => {
        const picked = !!app.sync.code && v === cv.id;
        const pick = h('button', { class: 'pz-voice-pick' + (picked ? ' on' : ''), role: 'radio', 'aria-checked': String(picked), 'data-cloud-voice': cv.id, disabled: !ok },
          h('span', { class: 'pz-voice-dot', 'aria-hidden': 'true' }),
          h('span', { class: 'grow' }, h('span', { class: 'label' }, `${cv.name} · ${cv.desc}`), h('span', { class: 'sub' }, `Google ${cv.id} · online, saved for offline after the first play`)));
        pick.addEventListener('click', () => {
          set('cloudVoice', cv.id);
          note = '';
          render();
          app.cloudPrepareFor(p.id).then(() => repaintCloud());
        });
        const play = h('button', { class: 'btn btn-sm pz-voice-test', 'aria-label': `Test ${cv.name}`, 'data-cloud-test': cv.id, disabled: !ok }, '\u25B6\uFE0E Test');
        play.addEventListener('click', () => test(cv.id, play));
        return h('div', { class: 'pz-voice', 'data-cloud-row': cv.id }, pick, play);
      }));
    }
    async function test(id, btn) {
      const t = app.tts;
      const texts = buildPresentation(SAMPLE_PRESENTATION);
      t.cancel();
      btn.disabled = true;
      note = 'Getting the voice ready…'; paint();
      const r = await cloud.prepare(texts, id);
      note = '';
      btn.disabled = false;
      if (!texts.every((x) => cloud.has(x, id))) {
        if (r && r.error === 'offline') note = 'Offline: the natural voice needs the internet the first time';
        paint();
        app.audio.error();
        return;
      }
      paint();
      t.present(SAMPLE_PRESENTATION, { voice: id });
    }
    paint();
    repaintCloud = () => { if (status.isConnected) paint(); };
    if (app.sync.code) {
      if (app.cloudDefault) app.cloudDefault(p.id);
      cloud.status().then(() => { if (status.isConnected) paint(); });
    }
    return [
      h('div', { class: 'pz-voice-group', id: 'opt-cloud-head' }, 'Natural voices (online)'),
      status,
      list,
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
      ...speechCheck(),
      segmented('Speech rate', 'How fast words are read aloud', [['veryslow', 'Very slow'], ['slow', 'Slow'], ['normal', 'Normal']], o.rate, (v) => set('rate', v), 'opt-rate'),
      ...voicePicker(p, o, set),
      segmented('Words before each race', 'Spelled back to back before the car launches; more right on the first try = more power', [[1, '1'], [2, '2'], [3, '3'], [4, '4']], o.wordsPerRace, (v) => set('wordsPerRace', v), 'opt-race-words'),
      segmented('Levels per race', 'Cross the finish line and the car launches again with new words: Level 2 pays ×1.5 cash, Level 3 ×2', [[1, '1'], [2, '2'], [3, '3']], o.levelsPerRace == null ? 3 : o.levelsPerRace, (v) => set('levelsPerRace', v), 'opt-race-levels'),
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
      h('div', { class: 'ver' }, `Spell Jump ${app.version}${app.engineName ? ' · ' + app.engineName : ''} · voice: ${app.tts.available ? (app.tts.systemVoice ? 'system default' : app.tts.voiceName || 'system') : 'not available'}`),
    ];
  }

  // ---------- Family code (family sync) ----------
  const PRIVACY = "What's stored online: player first names, word lists, spelling progress and the parent PIN (hashed). No emails or accounts. Anyone with the family code can see and change these, so keep it private. Word lists and sentences are sent to Google's text-to-speech service to make the voice clips; nothing about the kids is.";
  function syncStatusClass(st) { return 'pz-sync-status' + (!st.synced ? '' : st.offline ? ' off' : st.lastError ? ' err' : ' on'); }
  function syncLineClass(st) { return 'pz-sync-line' + (!st.synced ? '' : st.offline ? ' off' : st.lastError ? ' err' : ' on'); }
  // the code (or Create / Join) comes first, the privacy note last
  function syncTab() {
    const sync = app.sync;
    const st = sync.status();
    const status = h('div', { class: syncStatusClass(st), id: 'sync-status', 'aria-live': 'polite' }, sync.statusText());
    const msg = h('div', { class: 'pz-msg', id: 'sync-msg', 'aria-live': 'polite' });
    const say = (ok, ...lines) => { msg.className = 'pz-msg ' + (ok ? 'ok' : 'err'); msg.replaceChildren(...lines.map((l) => h('div', {}, l))); };
    const out = [];
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
        h('div', { class: 'pz-code-row pz-first' }, codeEl, copy, now),
        status,
        h('div', { class: 'pz-help' }, 'On another phone, tablet or computer: open Spell Jump, tap Parents, then Join a family, and type this code. Players, word lists and progress then show up on both.'),
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
        h('div', { class: 'row pz-first pz-create-row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Start a family'),
          h('div', { class: 'sub' }, "Puts this device's players online under a new family code, for your other devices to join.")), create),
        h('label', { class: 'pz-label', for: 'sync-join-input' }, 'Join a family'),
        h('div', { class: 'pz-join-row' }, input, join),
        h('div', { class: 'pz-help pz-join-help' }, 'Type the family code shown on your other device (Parents → Family code). Players from both devices are kept.'),
        msg,
      );   // "Not synced" is already the line under the title
    }
    out.push(...familyWeek());
    out.push(h('div', { class: 'hud-label pz-sec' }, 'PRIVACY'), h('p', { class: 'pz-help pz-privacy', id: 'sync-privacy' }, PRIVACY));
    out.push(transferSection());
    return out;
  }

  // Transfer progress (src/meta/transfer.js): a code that carries one player's progress to another device, for a copy
  // of the game that cannot sync. Export per player (read-only code + Copy), Import (paste + Import).
  function transferSection() {
    const players = app.family.players;
    const outBox = h('textarea', { id: 'transfer-out', class: 'pz-transfer-code', readonly: true, rows: '3', hidden: true, 'aria-label': 'Transfer code', spellcheck: 'false' });
    const copy = h('button', { class: 'btn btn-sm btn-cyan', id: 'transfer-copy', 'data-sfx': '', hidden: true }, 'Copy code');
    const note = h('p', { class: 'pz-help', id: 'transfer-note', hidden: true }, 'Copy this code, then on the other device open Parents → Family code → Import progress and paste it.');
    copy.addEventListener('click', async () => {
      let ok = false;
      try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(outBox.value); ok = true; } } catch (_) { ok = false; }
      if (ok) { app.toast('Code copied'); return; }
      try { outBox.focus(); outBox.select(); outBox.setSelectionRange(0, outBox.value.length); } catch (_) { /* ignore */ }
      app.toast('Code selected: use Copy');
    });
    const exportRow = h('div', { class: 'pz-actions pz-export-row' }, ...players.map((p) => {
      const b = h('button', { class: 'btn btn-sm', 'data-export': p.id, 'data-sfx': '' }, `Export ${p.name}`);
      b.addEventListener('click', async () => {
        b.disabled = true;
        const code = await app.exportProgress(p.id).catch(() => null);
        b.disabled = false;
        if (!code) { app.audio.error(); return; }
        outBox.value = code; outBox.hidden = false; copy.hidden = false; note.hidden = false;
        outBox.dataset.player = p.id;
        try { outBox.scrollIntoView({ block: 'nearest' }); } catch (_) { /* ignore */ }
      });
      return b;
    }));
    const inBox = h('textarea', { id: 'transfer-in', class: 'pz-transfer-code', rows: '3', placeholder: 'Paste a transfer code here', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off' });
    inBox.addEventListener('focus', () => setTimeout(() => inBox.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300));
    const imp = h('button', { class: 'btn btn-green', id: 'transfer-import', 'data-sfx': '' }, 'Import');
    const msg = h('div', { class: 'pz-msg', id: 'transfer-msg', 'aria-live': 'polite' });
    imp.addEventListener('click', async () => {
      imp.disabled = true; imp.textContent = 'Importing…';
      let r;
      try { r = await app.importProgress(inBox.value); } catch (_) { r = { ok: false, error: 'Import failed: nothing was changed.' }; }
      imp.disabled = false; imp.textContent = 'Import';
      msg.className = 'pz-msg ' + (r.ok ? 'ok' : 'err');
      msg.textContent = r.ok ? r.message : r.error;
      try { msg.scrollIntoView({ block: 'nearest' }); } catch (_) { /* ignore */ }
      if (!r.ok) { app.audio.error(); return; }
      app.audio.cash();
      inBox.value = '';
      if (r.mode === 'add') {           // the new player shows up in the export row (keep the message)
        const keep = msg.textContent;
        render();
        const m = $('#transfer-msg'); if (m) { m.className = 'pz-msg ok'; m.textContent = keep; try { m.scrollIntoView({ block: 'nearest' }); } catch (_) { /* ignore */ } }
      }
    });
    return h('div', { class: 'pz-transfer', id: 'sync-transfer' },
      h('div', { class: 'hud-label pz-sec' }, 'TRANSFER PROGRESS'),
      h('p', { class: 'pz-help' }, "For a copy of the game that cannot sync: export a player's progress here as a code, and import it on the other device. A player with the same name is merged (nothing is lost); otherwise the player is added."),
      h('div', { class: 'label' }, 'Export a player'),
      players.length ? exportRow : h('p', { class: 'pz-help' }, 'No players on this device yet.'),
      outBox, h('div', { class: 'pz-actions' }, copy), note,
      h('label', { class: 'pz-label', for: 'transfer-in' }, 'Import progress'),
      inBox, h('div', { class: 'pz-actions' }, imp), msg);
  }
  // refresh just the status lines (a full re-render would drop what a parent is typing)
  function paintSyncStatus() {
    paintSyncLine();
    const el = $('#sync-status');
    if (!el) return;
    el.className = syncStatusClass(app.sync.status());
    el.textContent = app.sync.statusText();
  }
  function paintSyncLine() {
    const show = !root.hidden && view === 'main';
    syncLine.hidden = !show;
    if (!show) return;
    const st = app.sync.status();
    syncLine.className = syncLineClass(st) + (tab === 'sync' ? ' here' : '');
    syncLine.replaceChildren(h('span', { class: 'sl-dot', 'aria-hidden': 'true' }), h('span', { class: 'sl-text' }, app.sync.statusLine()));
    syncLine.setAttribute('aria-label', `${app.sync.statusLine()}. Open Family code.`);
  }

  // per-player tabs before any player exists
  function noPlayerTab() {
    const add = h('button', { class: 'btn btn-green', id: 'pz-add-player', 'data-sfx': '' }, 'Add a player');
    add.addEventListener('click', () => { api.close(); app.go('newplayer'); });
    return [h('div', { class: 'pz-noplayer', id: 'pz-noplayer' },
      h('div', { class: 'label' }, 'Add a player first'),
      h('div', { class: 'sub' }, 'Word lists, reports and options are set per player. Add one on the player screen, or join your family on the Family code tab to bring your players here.'),
      h('div', { class: 'pz-actions' }, add))];
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
    // the Family code tab is for the whole family (no player needed); the others need a player
    const content = tab === 'sync' ? syncTab() : !p ? noPlayerTab() : tab === 'words' ? wordsTab(p) : tab === 'report' ? reportTab(p) : optionsTab(p);
    // the section tabs stay put; the player row (which child) only shows on the per-player tabs, under them
    body.replaceChildren(sectionTabs(), ...(p && tab !== 'sync' ? [playerTabs()] : []), h('div', { class: 'pz-content', 'data-tab': tab }, ...content.filter(Boolean)));
    body.scrollTop = keepScroll;
  }

  function render() {
    root.dataset.view = view;
    paintSyncLine();
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
      tab = opts.tab || 'sync';
      joined = null;
      pinEntry = ''; pinFirst = '';
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
      clearTimeout(holdTimer); cancelAnimationFrame(holdRaf);
      clearInterval(lineTimer);
      if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();
      root.hidden = true;
      app.onParentZoneClosed();
    },
    lock() { unlockedUntil = 0; },
    // family sync: the status changed / newer data arrived from another device
    onSyncStatus() { if (!root.hidden && view === 'main') { paintSyncStatus(); repaintCloud(); } },
    // the natural voice's state changed (server checked, clips made, a default voice picked)
    onCloudStatus() {
      if (root.hidden || view !== 'main' || tab !== 'options') return;
      const p = playerById(app.family, playerId);
      const want = p ? playerOptions(app.family, p.id).cloudVoice || '' : '';
      const shown = (document.querySelector('#opt-cloud-voices .pz-voice-pick.on') || { dataset: {} }).dataset.cloudVoice || '';
      if (want !== shown) render();      // a default natural voice was just picked for this player
      else repaintCloud();
    },
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

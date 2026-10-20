// Parent Zone (Parents on the player picker and the title; PIN-gated with the family's PIN, the same one as Spell
// Jump: set or changed in either game). First open on a device with no PIN: set a 4-digit PIN (twice). Later: enter
// it. "Forgot PIN": press and hold 3 s, then answer a 2-digit × 2-digit multiplication, then set a new PIN.
// Tabs: Family code (opens first; for the whole family, works with no players) · Facts this week (per player: the ×2 …
// ×12 families, "÷ too", "+ and − within 20", Custom problems one per line with per-line errors) · Options (per player:
// math gates per race, new facts per day, facts aloud, the voice as set in Spell Jump; this device's sound, music,
// motion, shake; Change PIN) · Report (per operation the status counts, slowest facts, this week's races, Copy report)
// v1.5: the Report adds "Play, day by day" (races · stars · crates earned · streak, from save.play).
// · Players (rename, reset facts data, reset Trail Blazer progress, remove). A one-line family sync status sits under
// v1.3: Facts this week has three modes: Auto (recommended: the frontier and its reason, every family's state on the
// ladder, ÷ / + − allowed, the Pit Crew Check: last result, "Run the check again") · Pick families (v1.2 toggles) ·
// Custom list (only the typed problems). The Report gains Patterns (patterns.js, in plain words) and the frontier.
// v1.4: Auto shows "Where Mia is" (tier · frontier · placed · re-check in N days · vouched by scouts), the governor's
// dial in plain words, the ladder with secure / vouched states, and Check now; the Report gains "Moved up" lines and
// the dial race by race.
// the title. Native text inputs exist only here (family code, custom problems, player names).
import { checkPin, hasPin, playerById, renamePlayer, setPin } from '../../../spell-jump/src/spelling/profiles.js';
import { cloudVoiceInfo } from '../../../spell-jump/src/tts/voices.js';
import { ALL_FAMILIES, MAX_CUSTOM, factText, famLabel, parseCustom } from '../facts/facts.js';
import { STATUSES } from '../facts/scheduler.js';
import { GATES_OPTIONS, NEW_PER_DAY_OPTIONS, activeFacts, refreshFrontier, report, reportText } from '../facts/store.js';
import { autoFamilies, famInfo, ladder, tierOf } from '../facts/adaptive.js';
import { dial, dialText, steppedText } from '../facts/governor.js';
import { recheckInDays, scoutFamily } from '../facts/scouts.js';
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { playLines } from '../meta/season.js';
import { icon } from './tbIcons.js';
import { drawAvatar } from './vehiclePreview.js';

const HOLD_MS = 3000;
export const SAVE_NOTE = "One family code syncs both games: the players and the PIN, each child's Spell Jump progress and their Trail Blazer progress (cash, vehicles, upgrades, medals, cups, gear and the math facts). Nothing is lost when two devices played offline: the progress is merged.";
/** v1.6: the Parent Zone line when synced and well. */
export const SYNCED_LINE = 'Synced · players, Spell Jump and Trail Blazer progress';

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
  const syncLine = h('button', { class: 'pz-sync-line', id: 'pz-sync-line', 'data-sfx': '', hidden: true });
  syncLine.addEventListener('click', () => { if (tab !== 'sync') { tab = 'sync'; render(); body.scrollTop = 0; } });
  const body = h('div', { class: 'pz-body scroll', id: 'pz-body' });
  sheet.append(head, syncLine, body);
  root.replaceChildren(sheet);

  let view = 'pin', tab = 'sync', unlockedUntil = 0, lineTimer = 0, joined = null, playerId = null;
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
    // on a narrow phone the long names shorten to "Family" / "Facts" (the rest is in a span hidden by CSS)
    for (const [id, text, more] of [['sync', 'Family', ' code'], ['facts', 'Facts', ' this week'], ['options', 'Options'], ['report', 'Report'], ['players', 'Players']]) {
      const b = h('button', { class: 'seg-btn' + (tab === id ? ' on' : ''), role: 'tab', 'aria-selected': String(tab === id), 'data-tab': id, 'aria-label': text + (more || '') },
        text, ...(more ? [h('span', { class: 'tab-more' }, more)] : []));
      b.addEventListener('click', () => { tab = id; render(); });
      row.append(b);
    }
    return row;
  }

  // ---------- which child (Facts this week, Options, Report) ----------
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

  // ---------- Facts this week ----------
  function factsTab(p) {
    const d = app.factsFor(p.id);
    const save = () => { d.updatedAt = d.sets.updatedAt = Date.now(); if (d.sets.mode === 'auto') refreshFrontier(d, Date.now()); app.saveFactsFor(p.id, d); count.textContent = countText(); };
    const countText = () => `${activeFacts(d).length} facts in play · ${p.name} answers ${d.opts.gates} at the gates of each race`;
    const count = h('div', { class: 'pz-help', id: 'facts-count' }, countText());
    const mode = d.sets.mode === 'auto' ? 'auto' : d.sets.source === 'custom' ? 'custom' : 'families';
    const modeSeg = segmented('How facts are chosen', '', [['auto', 'Auto (recommended)'], ['families', 'Pick families'], ['custom', 'Custom list']], mode, (v) => {
      if (v === 'auto') d.sets.mode = 'auto';
      else { d.sets.mode = 'manual'; d.sets.source = v; d.sets.edited = true; }
      save();
      render();
    }, 'facts-mode').lastChild;                       // just the segmented control, under its own heading
    modeSeg.classList.add('facts-mode');
    const autoBtn = modeSeg.querySelector('[data-value="auto"]');
    autoBtn.replaceChildren('Auto', h('small', { class: 'rec' }, ' (recommended)'));
    const head = [h('div', { class: 'hud-label pz-sec pz-first' }, 'How facts are chosen'), modeSeg];
    const ops = [
      toggle('÷ too', 'The division facts that undo the times tables (56 ÷ 7 and 56 ÷ 8 for 7 × 8)', d.sets.division, (v) => { d.sets.division = v; save(); if (mode === 'auto') render(); }, 'facts-div'),
      toggle('+ and − within 20', 'Addition up to 20 and the subtractions back (a warm-up or a refresher)', d.sets.addSub, (v) => { d.sets.addSub = v; save(); if (mode === 'auto') render(); }, 'facts-addsub'),
    ];
    if (mode === 'auto') return [...head, ...autoView(p, d), ...ops, checkRow(p, d), count];
    if (mode === 'families') {
      const fams = h('div', { class: 'fam-row', role: 'group', 'aria-label': 'Times tables' }, ...ALL_FAMILIES.map((f) => {
        const on = d.sets.families.includes(f);
        const b = h('button', { class: 'fam' + (on ? ' on' : ''), 'data-family': f, 'aria-pressed': String(on), 'data-sfx': '' }, `×${f.slice(1)}`);
        b.addEventListener('click', () => {
          const has = d.sets.families.includes(f);
          d.sets.families = has ? d.sets.families.filter((x) => x !== f) : ALL_FAMILIES.filter((x) => x === f || d.sets.families.includes(x));
          d.sets.edited = true;
          b.classList.toggle('on', !has); b.setAttribute('aria-pressed', String(!has));
          save();
        });
        return b;
      }));
      return [...head,
        h('div', { class: 'hud-label pz-sec' }, 'Times tables'),
        h('div', { class: 'pz-help' }, 'Pick the families to practice this week. Each one is n × 2 … n × 12 (7 × 8 and 8 × 7 count as one fact). Grade 4 aims at all of them, fluent.'),
        fams, ...ops,
        d.sets.custom.length ? h('div', { class: 'pz-help', id: 'facts-custom-note' }, `Plus the ${d.sets.custom.length} problem${d.sets.custom.length === 1 ? '' : 's'} from the Custom list.`) : null,
        checkRow(p, d), count];
    }
    const ta = h('textarea', { id: 'facts-custom', rows: '6', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off',
      placeholder: '7 x 8\n56 / 7\n34 + 19\n80 - 46', 'aria-label': 'Custom problems' });
    ta.value = d.sets.customText || d.sets.custom.map((f) => factText(f)).join('\n');
    const msg = h('div', { class: 'pz-msg', id: 'facts-msg', 'aria-live': 'polite' });
    const saveBtn = h('button', { class: 'btn btn-green', id: 'facts-save', 'data-sfx': '' }, 'Save problems');
    saveBtn.addEventListener('click', () => {
      const r = parseCustom(ta.value);
      d.sets.custom = r.facts;
      d.sets.customText = ta.value.slice(0, 4000);
      d.sets.edited = true;
      save();
      msg.className = 'pz-msg ' + (r.errors.length ? 'err' : 'ok');
      msg.replaceChildren(
        h('span', { class: 'err-line' }, `${r.facts.length} custom problem${r.facts.length === 1 ? '' : 's'} saved.`),
        ...r.errors.map((e) => h('span', { class: 'err-line', 'data-line': String(e.line) }, e.line ? `Line ${e.line}: "${e.text}": ${e.error}.` : `${e.error}.`)));
      if (r.errors.length) app.audio.error(); else app.audio.cash();
    });
    return [...head,
      h('label', { class: 'pz-label', for: 'facts-custom' }, 'Custom problems', h('span', { class: 'pz-help' }, `one per line, up to ${MAX_CUSTOM}`)),
      h('div', { class: 'pz-help' }, 'Only these problems come up at the gates. Like 7 x 8, 56 / 7, 34 + 19 or 80 - 46. Answers are worked out for you; whole numbers only.'),
      ta, h('div', { class: 'pz-actions' }, saveBtn), msg, checkRow(p, d), count];
  }

  // auto mode: the frontier with its reason, and every family's place on the ladder
  function autoView(p, d) {
    const now = Date.now();
    const fr = (d.frontier && d.frontier.families) || [];
    const box = h('div', { class: 'fr-box', id: 'facts-frontier', 'data-families': fr.join(' ') },
      h('div', { class: 'label' }, 'Working on now'),
      h('div', { class: 'fr-fams' }, ...(fr.length ? fr.map((f) => h('span', { class: 'lad st-frontier', 'data-family': f }, famLabel(f))) : [h('span', { class: 'pz-help' }, 'Everything is mastered: mixed practice')])),
      h('div', { class: 'fr-reason', id: 'facts-reason' }, (d.frontier && d.frontier.reason) || ''));
    const inPlay = new Set(autoFamilies(d, now));
    const scout = scoutFamily(d, now);
    const chips = ladder(d.sets).map((f) => {
      const i = famInfo(d, f, now);
      const st = fr.includes(f) ? 'frontier' : d.stepped && d.stepped[f] ? 'stepped' : i.graduated ? 'mastered' : i.vouched && i.secure ? 'vouched' : i.secure ? 'secure'
        : f === scout ? 'scout' : !inPlay.has(f) ? 'later' : i.known ? 'known' : 'practice';
      const word = { frontier: 'now', mastered: 'mastered', vouched: 'vouched', secure: 'secure', scout: 'scouting', stepped: 'waits', known: 'known', practice: 'mixed in', later: 'later' }[st];
      return h('span', { class: `lad st-${st}`, 'data-family': f, 'data-state': st, title: `${famLabel(f)}: ${word}` }, famLabel(f), h('small', {}, word));
    });
    const tiers = fr.map(tierOf);
    const pl = d.placement;
    const vouched = Object.keys(d.vouched || {}).filter((f) => famInfo(d, f, now).secure);
    const where = h('div', { class: 'where', id: 'facts-where' },
      h('div', { class: 'label' }, `Where ${p.name} is`),
      h('div', { class: 'where-line', id: 'facts-where-line' }, [
        fr.length ? `Tier ${Math.min(...tiers)} · ${fr.map(famLabel).join(' ')}` : 'Everything mastered',
        pl ? `placed ${new Date(pl.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'not placed yet: the Pit Crew Check runs before the next race',
        pl ? (recheckInDays(d, now) ? `re-check in ${recheckInDays(d, now)} day${recheckInDays(d, now) === 1 ? '' : 's'}` : 're-check before the next race') : '',
      ].filter(Boolean).join(' · ')),
      vouched.length ? h('div', { class: 'pz-help', id: 'facts-vouched' }, `Vouched by scouts: ${vouched.map(famLabel).join(' ')}`) : null,
      h('div', { class: 'pz-help', id: 'facts-dial' }, dialText(dial(d))),
      ...steppedText(d).map((t) => h('div', { class: 'pz-help' }, t)));
    return [
      where,
      h('div', { class: 'pz-help' }, `Auto works up the ladder for ${p.name}: two families from the lowest tier not yet secure. A family moves on as soon as it is right and quick (no miss in its last 8 answers), or when 3 quick scout gates vouch for it; one gate a race scouts ahead. The gates stay at the learning level: a bit easy moves up, a bit hard steps back to an easier family for a while.`),
      box,
      h('div', { class: 'hud-label pz-sec' }, 'The ladder'),
      h('div', { class: 'ladder', id: 'facts-ladder' }, ...chips),
      h('div', { class: 'lad-legend' }, 'now = working on · secure = right and quick, moved on (spacing keeps it in the gates) · vouched = 3 quick scouts · scouting = one gate a race looks ahead here · mastered = right on several days · later = waits for the families before it'),
    ];
  }
  // the Pit Crew Check: last result and "Run the check again"
  function checkRow(p, d) {
    const pl = d.placement;
    const by = (st) => (pl ? Object.entries(pl.families).filter(([, v]) => v.status === st && !v.inferred).map(([f]) => famLabel(f)) : []);
    const text = pl ? `Last check ${new Date(pl.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: fluent ${by('fluent').join(' ') || '–'} · right but slow ${by('known').join(' ') || '–'} · missed ${by('shaky').join(' ') || '–'}`
      : `Not done yet: it runs before ${p.name}'s next race (about 15 quick facts).`;
    const btn = h('button', { class: 'btn btn-sm btn-cyan', id: 'facts-check', 'data-sfx': '' }, 'Check now');
    btn.addEventListener('click', () => app.runCheckFor(p.id));
    return h('div', { class: 'pz-check-row', id: 'facts-check-row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Pit Crew Check'),
      h('div', { class: 'sub', id: 'facts-check-text' }, text)), btn);
  }

  // ---------- Report ----------
  const OP_SHORT = { x: '× Multiply', '/': '÷ Divide', '+': '+ Add', '-': '− Subtract' };
  function reportTab(p) {
    const d = app.factsFor(p.id);
    const now = Date.now();
    const r = report(d, now);
    const ops = Object.entries(r.ops).filter(([, o]) => o.total);
    const table = h('div', { class: 'pz-table-wrap' }, h('table', { class: 'pz-table', id: 'report-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Facts'), ...STATUSES.map((st) => h('th', {}, st)))),
      h('tbody', {}, ...ops.map(([op, o]) => h('tr', { 'data-op': op, 'data-total': String(o.total) },
        h('td', { class: 'op' }, OP_SHORT[op], h('small', {}, `${o.total} facts`)), ...STATUSES.map((st) => h('td', { 'data-status': st }, String(o[st]))))))));
    const tName = (id) => (app.trails.find((t) => t.id === id) || { name: id }).name;
    const play = app.saveOf ? playLines(app.saveOf(p.id)) : [];
    const dayName = (k) => new Date(k + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const text = reportText(d, p.name, now, tName) + (play.length ? `\n\nPlay (v1.5)\n${play.map((x) => `${dayName(x.day)}: ${x.text}`).join('\n')}` : '');
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
    return [
      h('div', { class: 'pz-help pz-first', id: 'report-summary' }, `${r.totals.mastered} mastered · ${r.totals.fluent} fluent (mastered and answered in 3 s or less on 2 days) · ${r.totals.seen} of ${r.totals.facts} facts practiced`),
      table,
      h('div', { class: 'hud-label pz-sec' }, 'Patterns'),
      r.patterns.length ? h('ul', { class: 'pat-list', id: 'report-patterns' }, ...r.patterns.map((x) => h('li', { 'data-kind': x.kind }, x.text)))
        : h('div', { class: 'pz-help', id: 'report-patterns' }, 'No patterns this week yet: they show up after a few misses.'),
      r.mode === 'auto' && r.frontier.length ? h('div', { class: 'pz-help', id: 'report-frontier' }, `Working on now: ${r.reason}`) : null,
      h('div', { class: 'hud-label pz-sec' }, 'Moved up'),
      r.moved.length ? h('ul', { class: 'pat-list', id: 'report-moved' }, ...r.moved.slice(-6).reverse().map((x) => h('li', {}, x.text)))
        : h('div', { class: 'pz-help', id: 'report-moved' }, 'No moves yet: they show up as families go secure, get vouched or step back.'),
      h('div', { class: 'hud-label pz-sec' }, 'Level, race by race'),
      h('div', { class: 'pz-help', id: 'report-dial' }, r.dialHistory.length
        ? r.dialHistory.slice(-10).map((x) => `${new Date(x.at).toLocaleDateString('en-US', { weekday: 'short' })} ${x.band === 'target' ? 'on target' : x.band === 'easy' ? 'a bit easy' : 'a bit hard'} (${x.right}/${x.n})`).join(' · ')
        : dialText(r.dial)),
      h('div', { class: 'hud-label pz-sec' }, 'Slowest facts'),
      h('div', { class: 'pz-help', id: 'report-slow' }, r.slowest.length ? r.slowest.map((x) => `${factText(x.fact)} (${(x.avgMs / 1000).toFixed(1)} s)`).join(' · ') : 'Not enough answers yet.'),
      h('div', { class: 'hud-label pz-sec' }, "This week's races"),
      h('div', { class: 'pz-help', id: 'report-races' }, r.races.length ? r.races.slice(-8).map((x) => `${new Date(x.at).toLocaleDateString('en-US', { weekday: 'short' })} ${tName(x.trail)}: ${x.correct}/${x.asked} right, ${x.quick} quick, ${x.fixed} fixed`).join(' · ') : 'No races this week yet.'),
      h('div', { class: 'hud-label pz-sec' }, 'Play, day by day'),
      play.length ? h('ul', { class: 'pat-list', id: 'report-play' }, ...play.map((x) => h('li', { 'data-day': x.day }, `${dayName(x.day)} · ${x.text}`)))
        : h('div', { class: 'pz-help', id: 'report-play' }, 'No races yet.'),
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
          h('div', { class: 'sub' }, "Puts this device's players and their Spell Jump and Trail Blazer progress online under a new family code (the same code works in both games).")), create),
        h('label', { class: 'pz-label', for: 'sync-join-input' }, 'Join a family'),
        h('div', { class: 'pz-join-row' }, input, join),
        h('div', { class: 'pz-help' }, 'Already set up in Spell Jump? Type the family code shown there (Parents → Family code). Progress already on this device is merged with the family\'s, never lost.'),
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
    const text = st.synced && !st.offline && !st.lastError && st.lastSync ? SYNCED_LINE : app.sync.statusLine();
    syncLine.replaceChildren(h('span', { class: 'sl-dot', 'aria-hidden': 'true' }), h('span', { class: 'sl-text' }, text));
    syncLine.setAttribute('aria-label', `${text}. Open Family code.`);
  }

  // ---------- Options (this device) ----------
  function mathOptions(p) {
    const d = app.factsFor(p.id);
    const set = (k, v) => { d.opts[k] = v; d.updatedAt = d.sets.updatedAt = Date.now(); app.saveFactsFor(p.id, d); };   // v1.6: options travel with the set in a merge
    const v = app.voiceInfo(p.id);
    const cv = v.cloudVoice ? cloudVoiceInfo(v.cloudVoice) : null;
    const voiceText = `${cv ? `Natural voice: ${cv.name}${v.synced ? '' : ' (needs a family code)'}` : v.voiceName ? `Device voice: ${v.voiceName}` : 'Device voice: automatic'} · rate ${v.rate === 'veryslow' ? 'very slow' : v.rate}`;
    return [
      h('div', { class: 'hud-label pz-sec pz-first' }, `Math for ${p.name}`),
      segmented('Math gates per race', 'Each gate asks one fact; the race waits while the answer is typed', GATES_OPTIONS.map((n) => [n, String(n)]), d.opts.gates, (x) => set('gates', x), 'opt-gates'),
      segmented('New facts per day', 'All of this week\'s facts by default; fewer for a child who is overwhelmed', NEW_PER_DAY_OPTIONS.map((n) => [n, n >= 99 ? 'All' : String(n)]), d.opts.newPerDay, (x) => set('newPerDay', x), 'opt-new'),
      toggle('Facts aloud', 'Read each fact as it appears, and the answer with a hint after a miss', d.opts.aloud, (x) => set('aloud', x), 'opt-aloud'),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Voice'),
        h('div', { class: 'sub', id: 'opt-voice' }, `${voiceText}. Set in Spell Jump → Parents → Options.`))),
    ];
  }
  function optionsTab(p) {
    const st = app.settings;
    const shake = h('input', { type: 'range', id: 'pz-shake', min: '0', max: '100', step: '5', value: String(st.shake), 'aria-label': 'Screen shake' });
    const out = h('output', { class: 'slider-val' }, `${st.shake}%`);
    const fill = () => shake.style.setProperty('--pct', `${shake.value}%`);
    shake.addEventListener('input', () => { out.textContent = `${shake.value}%`; fill(); app.setShake(Number(shake.value)); });
    fill();
    return [
      ...(p ? mathOptions(p) : []),
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
        h('div', { class: 'pz-player-head' }, cv, h('div', { class: 'name' }, p.name, h('div', { class: 'sub' }, `${app.trailsDoneFor(p.id)} of ${app.trails.length} trails on the podium, on this device`))),
        h('div', { class: 'pz-rename' }, input, save),
        ...confirmRow('Reset facts data', `Every fact back to New for ${p.name} (this week's set, the options and the level stay).`, 'Reset',
          `Reset ${p.name}'s math facts progress?`, 'Reset facts', () => { app.resetFactsFor(p.id); app.toast('Facts data reset'); render(); }, `pz-reset-facts-${p.id}`),
        ...confirmRow('Reset Trail Blazer progress', `Cash, vehicles, upgrades, medals, cups and gear back to the start for ${p.name} on this device. Spell Jump is not touched.`, 'Reset',
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
    const f = app.family;
    if (!playerById(f, playerId)) playerId = app.currentPlayerId && playerById(f, app.currentPlayerId) ? app.currentPlayerId : (f.players[0] || {}).id || null;
    const p = playerById(f, playerId);
    const perPlayer = tab === 'facts' || tab === 'report' || tab === 'options';
    const content = tab === 'sync' ? syncTab() : tab === 'players' ? playersTab()
      : tab === 'options' ? optionsTab(p) : !p ? noPlayer() : tab === 'facts' ? factsTab(p) : reportTab(p);
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
      if (tab === 'sync' || ((tab === 'players' || tab === 'report') && !root.contains(document.activeElement))) render();
    },
    playerExists: (id) => !!playerById(app.family, id),
  };
  return api;
}

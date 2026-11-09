// The case screen (SPEC §4): briefing → stops (two sealed witness notes each; a note opens only after the next list word is spelled in Spell Jump's
// panel) → the map (tap the next city) → … → the hideout dictation → the letters come home. One screen, one phase at a time (run.phase), everything
// silent text except the spelling words (the shared panel) and the hideout sentence (the natural voice). A wrong city is a normal part of the story:
// a gentle line, no penalty, no counter. Leaving keeps what was answered (each word already banked) and resumes at the same stop.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { createKeyboard } from '../../../spell-jump/src/spelling/keyboard.js';
import { CITY_BY_ID, CITY_LIST, briefingOf, gangOf, hideoutOf, missingOf, signOf, stopsOf } from '../logic/caseModel.js';
import { bothOpen, chooseCity, finish, firstSealed, followTrail, openNote, setHideout, startChase, stillMissing } from '../logic/run.js';
import { markSentence, scoreHideout, tokens } from '../logic/hideout.js';
import { chiefPortrait, drawMap, gangPortrait, pipPortrait, postcardSvg, signSvg, witnessPortrait } from '../art/index.js';
import { artBox, fly, isReduced, rectOfEl } from './fx.js';

export const COLD_TRAIL = 'The trail is cold here — check your clues.';
const vehicleSvg = (kind) => (kind === 'train'
  ? '<svg viewBox="0 0 40 24" width="40" height="24" aria-hidden="true"><rect x="2" y="4" width="30" height="14" rx="4" fill="#d9473b" stroke="#fff" stroke-width="2"/><rect x="7" y="7" width="6" height="5" fill="#fff"/><rect x="16" y="7" width="6" height="5" fill="#fff"/><path d="M32 8h6l-3 10h-3z" fill="#2a4a7a"/><circle cx="10" cy="20" r="3" fill="#333"/><circle cx="25" cy="20" r="3" fill="#333"/></svg>'
  : '<svg viewBox="0 0 40 24" width="40" height="24" aria-hidden="true"><path d="M2 12l36-8-8 16-10-5-6 7-2-8z" fill="#fff" stroke="#2a4a7a" stroke-width="2" stroke-linejoin="round"/></svg>');

export function createCaseView(app) {
  const root = $('#case-body');
  let kase = null, run = null, stops = [], busy = false, kb = null, typed = '', scored = null, looking = false, token = 0;
  const signEl = () => $('#case-sign');

  const save = () => app.persistWip(run);
  const msgEl = () => $('#case-msg');
  const setMsg = (t, tone = '') => { const m = msgEl(); if (m) { m.textContent = t; m.className = 'msg' + (tone ? ' ' + tone : ''); } };

  function signBox() {
    const box = h('div', { class: 'sign-strip', id: 'case-sign', 'data-missing': String(stillMissing(run, kase).length) });
    box.append(artBox(signSvg(signOf(kase), stillMissing(run, kase)), 'sign-art', 'The sign the gang swiped letters from'));
    return box;
  }
  const bubble = (who, art, name, lines) => h('div', { class: `bubble ${who}` }, artBox(art, 'face'), h('div', { class: 'b-text' }, h('span', { class: 'who-name' }, name), ...lines.map((t) => h('p', {}, t))));

  // ---------- phases ----------
  function viewBrief() {
    const gang = gangOf(kase);
    const lines = briefingOf(kase);
    const start = h('button', { class: 'btn btn-sun btn-big', id: 'btn-start', type: 'button', 'data-sfx': '' }, 'Start the chase');
    start.addEventListener('click', () => { startChase(run); save(); app.audio.click(); render(); });
    return h('div', { class: 'pane' }, h('div', { class: 'pane-scroll scroll' }, h('div', { class: 'col' },
      bubble('chief', chiefPortrait(), 'The Chief', lines.length ? lines : ['Somebody swiped letters off a sign. Follow the trail.']),
      h('div', { class: 'culprit' }, artBox(gangPortrait(gang.id, 'happy'), 'face'), h('div', {}, h('span', { class: 'label' }, "Today's letter-swiper"), h('h3', {}, gang.name + (gang.animal ? ` the ${gang.animal}` : '')), gang.reason ? h('p', {}, gang.reason) : null)))),
      h('div', { class: 'foot' }, start));
  }

  function noteCard(stop, w) {
    const wit = stop.witnesses[w];
    const open = !!run.notes[run.stop][w];
    const head = h('div', { class: 'wit-head' }, artBox(witnessPortrait(wit.seed), 'face'), h('div', {}, h('b', { class: 'wit-name' }, wit.name), h('span', { class: 'wit-role' }, wit.role)));
    if (open) return h('article', { class: 'note open', 'data-w': String(w), 'data-state': 'open' }, head, h('p', { class: 'clue' }, wit.clue));
    const b = h('button', { class: 'note sealed', type: 'button', 'data-w': String(w), 'data-state': 'sealed', 'data-sfx': '', 'aria-label': `Sealed note from ${wit.name}. Tap to open and spell a word.` },
      head, h('span', { class: 'seal' }, h('i', { 'aria-hidden': 'true' }), 'Sealed note — tap to open'));
    b.addEventListener('click', () => openSealed(w));
    return b;
  }
  function viewStop() {
    const stop = stops[run.stop];
    const city = stop.city || { name: '', id: '' };
    const both = bothOpen(run);
    const next = h('button', { class: 'btn btn-sun btn-big', id: 'btn-follow', type: 'button', 'data-sfx': '' }, stop.last ? 'Go to the hideout' : 'Follow the trail');
    next.addEventListener('click', () => { if (busy) return; followTrail(run, kase); save(); render(); });
    return h('div', { class: 'pane' }, h('div', { class: 'pane-scroll scroll' }, h('div', { class: 'col' },
      h('div', { class: 'scene', 'data-city': city.id }, artBox(postcardSvg(city), 'scene-art'), h('div', { class: 'scene-text' }, h('span', { class: 'label' }, `Stop ${run.stop + 1} of ${stops.length}`), h('h2', {}, city.name))),
      h('p', { class: 'hint-line' }, both ? 'Both notes are open. Read the clues, then follow the trail.' : 'Two witnesses saw the gang. Open each sealed note by spelling a word.'),
      h('div', { class: 'notes' }, noteCard(stop, 0), noteCard(stop, 1)))),
      h('div', { class: 'foot' }, both ? next : null));
  }

  function viewTravel() {
    const stop = stops[run.stop];
    const box = h('div', { class: 'map-box travel-map', id: 'travel-map' });
    const clues = h('div', { class: 'clue-recap', id: 'clue-recap' }, h('span', { class: 'label' }, 'Your clues'), ...stop.witnesses.map((w) => h('p', {}, h('b', {}, w.name + ': '), w.clue)));
    const msg = h('p', { class: 'msg', id: 'case-msg', role: 'status', 'aria-live': 'polite' }, 'Where did the gang go next? Tap the city on the map.');
    const el = h('div', { class: 'pane' }, h('div', { class: 'pane-scroll scroll' }, h('div', { class: 'col wide' }, h('div', { class: 'travel-grid' }, h('div', { class: 'paper map-card' }, box), h('div', { class: 'travel-side' }, msg, clues)))));
    queueMicrotask(() => paintMap(box));
    return el;
  }
  function visitedIds() { return stops.slice(0, run.stop + 1).map((s) => s.cityId); }
  function paintMap(box, highlight = null) {
    drawMap(box, { cities: CITY_LIST, highlight, visited: visitedIds() });
    const pins = box.querySelectorAll('[data-city]');
    if (!pins.length) {          // the map art offers no tappable pins: every real city as a button under it
      const row = h('div', { class: 'city-row' }, ...CITY_LIST.map((c) => h('button', { class: 'btn btn-sm', type: 'button', 'data-city': c.id }, c.name)));
      box.append(row);
    }
    box.onclick = (e) => { const p = e.target.closest('[data-city]'); if (p && box.contains(p)) pickCity(p.getAttribute('data-city')); };
    box.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('[data-city]')) { e.preventDefault(); pickCity(e.target.closest('[data-city]').getAttribute('data-city')); } };
  }

  // ---------- the hideout ----------
  function viewHideout() {
    const gang = gangOf(kase), hid = hideoutOf(kase);
    if (!run.hideout) { setHideout(run, app.words.planHideout(run)); save(); app.prepareHideoutVoice(run.hideout.sentence); }
    typed = ''; scored = null; looking = !app.voiceReady();
    const wrap = h('div', { class: 'pane hideout' });
    const listen = h('button', { class: 'btn btn-cyan btn-sm', id: 'btn-hear', type: 'button', 'data-sfx': '' }, h('span', { html: app.icon('sound') }), 'Hear the password');
    listen.addEventListener('click', () => { if (!busy) { looking = false; renderHideoutBits(); app.speakHideout(run.hideout.sentence); } });
    const again = h('button', { class: 'btn btn-paper btn-sm', id: 'look-again', type: 'button', 'data-sfx': '', hidden: true }, 'Look again');
    again.addEventListener('click', () => { looking = true; renderHideoutBits(); });
    const intro = h('div', { class: 'hide-intro' }, artBox(gangPortrait(gang.id, 'sorry'), 'face'),
      h('div', { class: 'b-text' }, h('span', { class: 'who-name' }, `${gang.name} and the gang`), h('p', { class: 'desc' }, hid.description || 'You found the hideout! The gang will hand the letters back if you can say their password.'),
        h('p', { class: 'ask' }, 'Listen to the password, then type it from memory.')),
      h('div', { class: 'hide-tools' }, listen, again));
    const look = h('div', { class: 'look-card', id: 'look-card', hidden: true });
    const box = h('div', { class: 'type-box', id: 'type-box', 'aria-live': 'polite', 'aria-label': 'Your answer' });
    const result = h('div', { class: 'hide-result', id: 'hide-result', hidden: true });
    const kbHost = h('div', { class: 'kbwrap', id: 'hide-kb' });
    kb = createKeyboard({
      id: 'hide-keyboard', enterLabel: 'Check',
      onKey: (ch) => { if (scored || busy || typed.length >= 160) return; if (ch === ' ' && (!typed || typed.endsWith(' '))) return; typed += ch; app.audio.letter(); app.tts.sayLetter(ch); renderTyped(); const tb = $('#type-box'); if (tb && tb.scrollIntoView) tb.scrollIntoView({ block: 'nearest' }); },
      onBackspace: () => { if (scored || busy || !typed) return; typed = typed.slice(0, -1); app.audio.letter(true); renderTyped(); },
      onEnter: () => checkIt(),
    });
    kbHost.append(kb.el);
    wrap.append(h('div', { class: 'pane-scroll scroll' }, h('div', { class: 'col' }, intro, look, box, result)), kbHost);
    queueMicrotask(() => { kb.setEnabled(true); kb.setActive(true); renderTyped(); renderHideoutBits(); if (app.voiceReady()) app.speakHideout(run.hideout.sentence); });
    return wrap;
  }
  function renderTyped() {
    const box = $('#type-box');
    if (!box) return;
    box.replaceChildren(typed ? h('span', {}, typed) : h('span', { class: 'ph' }, 'Type the password'), h('i', { class: 'caret' }));
    if (kb) kb.setEnterEnabled(!scored && tokens(typed).length > 0);
  }
  function renderHideoutBits() {
    const look = $('#look-card'), hear = $('#btn-hear'), again = $('#look-again');
    if (!look || !run.hideout) return;
    const natural = app.voiceReady();
    if (hear) hear.hidden = !natural;
    if (again) again.hidden = natural || looking || !!scored;
    // no natural voice: the sentence is shown, then covered (the same safety net the spell panel has for a word)
    look.hidden = !looking;
    if (looking) {
      const cover = h('button', { class: 'btn btn-sm btn-paper', id: 'btn-cover', type: 'button', 'data-sfx': '' }, 'Cover it');
      cover.addEventListener('click', () => { looking = false; renderHideoutBits(); });
      look.replaceChildren(h('span', { class: 'label' }, 'Look, then cover it'), h('p', { id: 'look-sentence' }, run.hideout.sentence), cover);
    } else look.replaceChildren();
  }

  async function checkIt() {
    if (busy || scored || !run.hideout) return;
    busy = true;
    const res = scoreHideout(run.hideout.sentence, run.hideout.words, typed);
    scored = res;
    app.speech.cancel();
    kb.setEnterEnabled(false); kb.setActive(false);
    const kh = $('#hide-kb'); if (kh) kh.hidden = true;                  // the keyboard steps aside: the result gets the room
    try { await app.words.bankHideout(res.perWord); } catch (e) { console.warn('[SquirrelChase] bankHideout', e); }
    const marks = markSentence(run.hideout.sentence, run.hideout.words, typed);
    const done = h('button', { class: 'btn btn-sun btn-big', id: 'btn-letters', type: 'button', 'data-sfx': '' }, 'Hand back the letters');
    done.addEventListener('click', () => handBack(res));
    const missed = res.perWord.filter((x) => !x.ok).length;
    const r = $('#hide-result');
    r.hidden = false;
    r.dataset.correct = String(res.correct); r.dataset.total = String(res.total);
    r.replaceChildren(...[h('span', { class: 'label' }, res.exact || !missed ? 'Password accepted!' : 'Close! The password was:'),
      h('p', { class: 'marked', id: 'marked' }, ...marks.map((m) => h('span', { class: m.list ? (m.ok ? 'w ok' : 'w bad') : 'w' }, m.text))),
      missed ? h('p', { class: 'soft' }, 'The red words come back in your next spelling practice.') : null, done].filter(Boolean));
    app.audio[missed ? 'click' : 'cash']();
    busy = false;
    const sc = $('#screen-case .pane-scroll'); if (sc) sc.scrollTop = sc.scrollHeight;
  }

  async function handBack(res) {
    if (busy) return;
    busy = true;
    await flyLetters(stillMissing(run, kase), $('#btn-letters'));
    finish(run, kase);
    save();
    busy = false;
    app.finishCase(kase, run, res);
  }

  // ---------- actions ----------
  async function openSealed(w) {
    if (busy || run.phase !== 'stop' || run.notes[run.stop][w]) return;
    busy = true;
    const my = token;
    let out = null;
    try { out = await app.words.askNote(); } catch (e) { console.error('[SquirrelChase] askNote', e); }
    busy = false;
    if (my !== token || !run) return;
    if (!out) { render(); return; }                 // left the panel: the note stays sealed, nothing is lost (a banked word stays banked)
    openNote(run, w, out.word);
    save();
    app.audio.cash();
    render();
    const card = root.querySelector(`.note[data-w="${w}"]`);
    if (card) card.classList.add('just');
    const nx = firstSealed(run);
    if (nx < 0) { const f = $('#btn-follow'); if (f && f.scrollIntoView) f.scrollIntoView({ block: 'nearest' }); }
  }

  async function pickCity(id) {
    if (busy || run.phase !== 'travel') return;
    const stop = stops[run.stop];
    const res = chooseCity(run, kase, id);
    if (!res.ok) {
      app.audio.click();
      setMsg(COLD_TRAIL, 'cold');
      const m = msgEl(); if (m) { m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake'); }
      return;
    }
    busy = true;
    save();
    const box = $('#travel-map');
    setMsg(`Off to ${CITY_BY_ID[res.to].name}!`, 'go');
    app.audio.cash();
    const a = box && box.querySelector(`[data-city="${res.from}"]`), b = box && box.querySelector(`[data-city="${res.to}"]`);
    if (a && b) {
      const v = h('span', { class: 'vehicle', html: vehicleSvg(stop.index % 2 ? 'train' : 'plane') });
      await fly(v, rectOfEl(a), rectOfEl(b), { ms: 1000, arc: 24 });
    }
    if (res.letter != null) await flyLetters([res.letter], b || box, true);
    busy = false;
    render();
  }

  /** Letters fly from where they were found onto the sign: one chip each, then the sign is redrawn with them in. */
  async function flyLetters(indexes, fromEl, one = false) {
    const sign = signEl();
    if (!sign || !indexes.length) return;
    if (!sign.getBoundingClientRect().width) return;            // (hidden in a short landscape hideout: nothing to fly to)
    const text = signOf(kase);
    const from = rectOfEl(fromEl) || rectOfEl(sign);
    const flights = indexes.map((i, k) => {
      const gap = sign.querySelector(`[data-gap="${i}"]`);
      const to = rectOfEl(gap) || rectOfEl(sign);
      const chip = h('span', { class: 'letter-chip' }, text[i] || '?');
      return new Promise((r) => setTimeout(r, isReduced() ? 0 : k * 160)).then(() => fly(chip, from, to, { ms: 700, arc: 60, rotate: 360 }));
    });
    await Promise.all(flights);
    const found = new Set([...run.found, ...indexes]);
    const left = missingOf(kase).filter((i) => !found.has(i));
    sign.dataset.missing = String(left.length);
    sign.replaceChildren(artBox(signSvg(text, left), 'sign-art', 'The sign the gang swiped letters from'));
    sign.classList.remove('pulse'); void sign.offsetWidth; sign.classList.add('pulse');
    void one;
  }

  // ---------- render ----------
  function render() {
    token++;
    if (kb) { kb.setActive(false); kb = null; }
    const view = run.phase === 'brief' ? viewBrief() : run.phase === 'stop' ? viewStop() : run.phase === 'travel' ? viewTravel() : viewHideout();
    $('#case-title').textContent = kase.title;
    const stepText = run.phase === 'brief' ? 'Briefing' : run.phase === 'hideout' ? 'The hideout' : `Stop ${run.stop + 1} of ${stops.length}`;
    root.dataset.phase = run.phase;
    root.replaceChildren(h('div', { class: 'case-grid' }, h('div', { class: 'case-side' }, signBox(), h('div', { class: 'step-chip', id: 'step-chip' }, stepText)), h('div', { class: 'case-main' }, view)));
  }

  return {
    get run() { return run; },
    get kase() { return kase; },
    show({ kase: k, run: r } = {}) {
      kase = k; run = r; stops = stopsOf(k); busy = false; typed = ''; scored = null;
      render();
    },
    hide() { token++; busy = false; app.speech.cancel(); if (kb) { kb.setActive(false); kb = null; } },
  };
}

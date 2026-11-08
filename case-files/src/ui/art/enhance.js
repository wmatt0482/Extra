// Enhancers: small DOM touches that the screens (which other files own) do not have to know about. One MutationObserver on #app,
// batched to one pass per frame, finds the bits that still need their art and dresses them:
//   - the round "PT" / "CH" badges on the speech bubbles become the portraits of Pip and the Chief (and "Your partner" reads "Pip");
//   - every document folder on the desk and every document header gets a small picture of its kind (logbook, letter, ...),
//     and a folder whose kind has no label ("Document") gets the right one (note, witness statement);
//   - the partner's feedback popup shows Pip thinking (the coach cards keep Pip smiling).
// Nothing here changes behaviour or text other than the labels above; it is safe to run any number of times.
import { CASE_BY_ID, TRAINING } from '../../content/index.js';
import { pipAvatar, portrait } from './characters.js';
import { docArt, DOC_KIND_NAME } from './docs.js';

let started = false;

const byTitle = (() => { let m = null; return (t) => { if (!m) { m = new Map(Object.values(CASE_BY_ID).concat([TRAINING]).map((c) => [c.title, c])); } return m.get(t) || null; }; })();

/** The case whose documents are on screen (the title in the top bar of the case or the file screen). */
function visibleCase() {
  for (const id of ['#case-title', '#file-title']) {
    const e = document.querySelector(id);
    if (e && !e.closest('[hidden]')) { const c = byTitle((e.textContent || '').trim()); if (c) return c; }
  }
  return null;
}

function pass() {
  const kase = visibleCase();
  // 1. portraits on the speech bubbles
  for (const w of document.querySelectorAll('.bubble .who:not([data-art])')) {
    const b = w.closest('.bubble');
    const who = b && b.classList.contains('chief') ? 'chief' : 'partner';
    w.dataset.art = who;
    w.setAttribute('aria-hidden', 'true');
    w.innerHTML = portrait(who, 'happy');
  }
  for (const n of document.querySelectorAll('.bubble .who-name')) if (n.textContent === 'Your partner') n.textContent = 'Pip';
  // 2. pictures on the desk folders and the document headers
  if (kase) {
    for (const f of document.querySelectorAll('.docfolder[data-doc]:not([data-art])')) {
      const d = kase.docs.find((x) => x.id === f.dataset.doc);
      if (!d) continue;
      f.dataset.art = d.kind;
      f.insertAdjacentHTML('afterbegin', `<span class="df-art" aria-hidden="true">${docArt(d.kind)}</span>`);
      if (DOC_KIND_NAME[d.kind]) f.dataset.kind = DOC_KIND_NAME[d.kind];
    }
    for (const h of document.querySelectorAll('.doc[data-doc] > .doc-head:not([data-art])')) {
      const d = kase.docs.find((x) => x.id === h.parentElement.dataset.doc);
      if (!d) continue;
      h.dataset.art = d.kind;
      h.insertAdjacentHTML('afterbegin', `<span class="dh-art" aria-hidden="true">${docArt(d.kind)}</span>`);
    }
  }
  // 3. Pip, thinking, on the partner's feedback popups
  for (const m of document.querySelectorAll('.modal-wrap[data-kind="feedback"][data-who="partner"] .modal-face:not([data-mood])')) {
    m.dataset.mood = 'thinking';
    m.innerHTML = pipAvatar('thinking');
  }
}

export function startEnhancers() {
  if (started) return;
  started = true;
  const app = document.getElementById('app');
  if (!app || typeof MutationObserver !== 'function') return;
  let queued = false;
  const run = () => { queued = false; try { pass(); } catch (e) { console.warn('[art]', e); } obs.takeRecords(); };
  const obs = new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(run); } });
  obs.observe(app, { childList: true, subtree: true });
  run();
}

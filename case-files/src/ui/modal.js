// The one modal of Case Files (v0.1.2), used for the step coach cards and for the feedback popups ("that sentence doesn't prove it
// yet"). A centered manila card over a dimmed screen, the Chief's or the partner's face, large readable text, one big button.
//   - one at a time: a second popup waits in a queue (never stacked);
//   - voiced through the shared speech module (the natural voice or silence; never the device voice; the sound setting rules);
//   - role="dialog" aria-modal; the screens behind are `inert`; focus goes to the button and comes back to where it was;
//   - Enter, Escape or a tap on the button closes it (Enter and Escape are taken before the in-game keyboard sees them).
// spec: { id?, kind: 'coach' | 'feedback', who: 'chief' | 'partner', tab?, title?, art?, lines: [..], extra?: [..] (shown, not spoken),
//         speak?: [..] (default: lines), button, onClose?(), focusSel? (where focus goes if the old place is gone) }
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { AVATAR, WHO_NAME } from './coachArt.js';

export function createModal(app) {
  const root = $('#modal-root');
  const queue = [];
  let cur = null;                       // { spec, res, wrap, button, returnTo }
  let returnTo = null;                  // where focus was when the first popup of a run opened
  const idle = [];

  const screens = () => [...document.querySelectorAll('#app > .screen')];
  const setInert = (on) => { for (const s of screens()) { if (on) s.setAttribute('inert', ''); else s.removeAttribute('inert'); } };

  function build(spec) {
    const kind = spec.kind === 'coach' ? 'coach' : 'feedback';
    const who = spec.who === 'chief' ? 'chief' : 'partner';
    const titleId = 'modal-title', textId = 'modal-text';
    const text = h('div', { class: 'modal-text', id: textId },
      ...spec.lines.map((t, i) => h('p', { class: i === 0 && kind === 'feedback' ? 'lead' : '' }, t)),
      ...(spec.extra || []).map((t) => h('p', { class: 'extra' }, t)));
    const head = h('div', { class: 'modal-head' },
      h('span', { class: `modal-face ${who}`, html: AVATAR[who] }),
      h('div', { class: 'modal-who' }, h('span', { class: 'label-type' }, kind === 'coach' ? spec.tab || WHO_NAME[who] : WHO_NAME[who]),
        spec.title ? h('h3', { class: 'modal-title', id: titleId }, spec.title) : null));
    const art = spec.art ? h('div', { class: 'coach-art', html: spec.art }) : null;
    const button = h('button', { class: 'btn btn-teal btn-big modal-go', type: 'button', 'data-act': 'modal-go', 'data-sfx': '' }, spec.button || 'Got it');
    const card = h('div', { class: `modal-card ${kind}`, role: 'dialog', 'aria-modal': 'true', 'aria-describedby': textId, ...(spec.title ? { 'aria-labelledby': titleId } : { 'aria-label': `${WHO_NAME[who]} says` }) },
      head, art, h('div', { class: 'modal-main' }, text, button));
    if (!art) card.classList.add('no-art');
    const wrap = h('div', { class: 'modal-wrap', 'data-kind': kind, 'data-who': who, ...(spec.id ? { 'data-id': spec.id } : {}) }, card);
    return { wrap, button };
  }

  function next() {
    if (cur || !queue.length) {
      if (!cur && !queue.length) { setInert(false); const fns = idle.splice(0); for (const f of fns) { try { f(); } catch (e) { console.warn(e); } } }
      return;
    }
    const { spec, res } = queue.shift();
    if (!returnTo) { const a = document.activeElement; returnTo = a && a !== document.body ? a : null; }
    const { wrap, button } = build(spec);
    cur = { spec, res, wrap, button };
    root.append(wrap);
    setInert(true);
    button.addEventListener('click', () => close(cur && cur.wrap === wrap ? cur : null));
    try { button.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
    app.speak(spec.speak || spec.lines);
  }

  function close(c) {
    if (!c || cur !== c) return;
    cur = null;
    c.wrap.remove();
    try { app.speech.cancel(); } catch (_) { /* ignore */ }
    const last = !queue.length;
    if (last) setInert(false);
    try { if (c.spec.onClose) c.spec.onClose(); } catch (e) { console.error(e); }
    if (last && !cur) {
      // focus back where it was; if that place is gone, the spec's fallback
      const back = returnTo && returnTo.isConnected && !returnTo.disabled && !returnTo.closest('[inert]') ? returnTo : null;
      const alt = c.spec.focusSel ? document.querySelector(c.spec.focusSel) : null;
      returnTo = null;
      const target = back || (alt && !alt.disabled ? alt : null);
      if (target) { try { target.focus({ preventScroll: true }); } catch (_) { /* ignore */ } }
    }
    c.res();
    next();
  }

  // Enter and Escape close the popup before the in-game keyboard (a window capture listener of its own) can see them.
  window.addEventListener('keydown', (e) => {
    if (!cur) return;
    if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(cur); }
    else if (e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); try { cur.button.focus({ preventScroll: true }); } catch (_) { /* ignore */ } }
    else if (e.key.length === 1 && e.key !== ' ') { e.stopImmediatePropagation(); }
  }, true);

  return {
    /** Show a popup (or queue it behind the one showing). Resolves when it has closed. */
    show(spec) { return new Promise((res) => { queue.push({ spec, res }); next(); }); },
    /** Is a popup with this id showing or waiting? */
    has: (id) => !!id && ((cur && cur.spec.id === id) || queue.some((q) => q.spec.id === id)),
    get isOpen() { return !!cur; },
    get pending() { return (cur ? 1 : 0) + queue.length; },
    /** Run fn now, or as soon as no popup is showing (the briefing voice waits for the coach card). */
    whenIdle(fn) { if (!cur && !queue.length) fn(); else idle.push(fn); },
    /** Drop everything without calling onClose (the screen is changing). */
    clear() {
      const all = [...queue.splice(0), ...(cur ? [cur] : [])];
      if (cur) { cur.wrap.remove(); cur = null; }
      idle.length = 0; returnTo = null; setInert(false);
      for (const q of all) q.res();
    },
  };
}

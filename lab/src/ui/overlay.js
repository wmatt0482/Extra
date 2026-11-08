// The shared overlay (lab/SPEC.md §3.3): the Lab inside any game page. openOverlay(store, { view, game, unlocked, onClose }) mounts the same shell the
// /lab/ page uses on document.body, traps the keys so the game does not hear them, and gives focus back when it closes.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { createApp } from './app.js';
import { glyph } from './glyph.js';

let current = null;

export function openOverlay(store, { view = 'home', game = 'sj', unlocked = false, onClose } = {}) {
  if (typeof document === 'undefined') return null;
  if (current) current.close();
  const before = document.activeElement;
  const root = h('div', { class: 'lab-root lab-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'The Lab', tabindex: '-1' });
  let app = null, closed = false;
  const close = () => {
    if (closed) return; closed = true;
    document.removeEventListener('keydown', onKey, true);
    if (app) app.destroy();
    root.remove();
    document.documentElement.classList.remove('lab-open');
    if (current && current.root === root) current = null;
    try { if (before && before.focus) before.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
    if (onClose) { try { onClose(); } catch (_) { /* ignore */ } }
  };
  function onKey(e) {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); if (app && app.view !== 'home') app.go('home'); else close(); }
  }
  document.addEventListener('keydown', onKey, true);          // on the document: focus may sit on <body> after a view re-renders
  if (store.view()) {
    app = createApp(store, { mode: 'overlay', view, game, unlocked, onClose: close, params: view === 'shop' ? { tab: ['sj', 'tb', 'ff', 'ww', 'bc', 'cf'].includes(game) ? game : 'me' } : {} });
    root.append(app.el);
  } else {
    const b = h('button', { class: 'lab-btn lab-btn-go', type: 'button' }, 'OK');
    b.addEventListener('click', close);
    root.append(h('div', { class: 'lab-shell' }, h('div', { class: 'lab-main' }, h('div', { class: 'lab-card lab-empty-card' }, h('span', { class: 'lab-empty-ic', html: glyph('me') }), h('p', {}, 'Pick a player first, then the Lab opens.'), b))));
  }
  document.body.append(root);
  document.documentElement.classList.add('lab-open');
  try { root.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
  current = { root, close };
  return { close, get app() { return app; }, el: root };
}
export const overlayOpen = () => !!current;

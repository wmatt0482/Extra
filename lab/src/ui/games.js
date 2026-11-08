// The Games panel (lab/docs/COHESION.md): a slide-out list of all six games plus The Lab and the home page, the same everywhere. The current one is
// highlighted ("You are here"), each row has its icon and colour and the child's one-line progress (from lab.summary), and every link is a
// same-origin relative URL. Escape, the scrim and the close button shut it; focus goes back to where it was.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { GAME_INFO } from '../data/games.js';
import { gameBadge, glyph, GAME_COLORS } from './glyph.js';
import { xpBar } from '../core/xp.js';
import { totalXp } from '../core/model.js';

let current = null;

/** Which entry is "here": the attached game's folder from the page address, else what the caller said. */
export function detectCurrent(hint = '') {
  try {
    const p = location.pathname || '/';
    for (const g of GAME_INFO) if (p.startsWith(g.path) || (g.id === 'sj' && p.startsWith('/car-jump/'))) return g.id;
    if (p.startsWith('/lab/')) return 'lab';
    if (p === '/' || p === '/index.html') return 'home';
  } catch (_) { /* ignore */ }
  return hint || '';
}

function homeArt() {
  return `<svg class="lab-badge" width="44" height="44" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="6" fill="#8f6bff"/><rect x="1" y="1" width="22" height="22" rx="6" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="1.4"/><path d="M5.5 12L12 6.5l6.5 5.5M7.5 11v6.5h9V11" stroke="#1c0e3a" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function labArt() {
  return `<svg class="lab-badge" width="44" height="44" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="6" fill="#37e0c0"/><rect x="1" y="1" width="22" height="22" rx="6" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="1.4"/><path d="M9.8 4.8h4.4M10.8 5v4.6l-4 6.6c-.5.9.1 1.9 1.1 1.9h8.2c1 0 1.6-1 1.1-1.9l-4-6.6V5" stroke="#04271f" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** Open the panel. o = { current, onClose }. Returns { close, el }. A second call closes the first. */
export function openGames(store, o = {}) {
  if (typeof document === 'undefined') return null;
  if (current) current.close();
  const before = document.activeElement;
  const here = detectCurrent(o.current || o.game || '');
  const v = store && store.view ? store.view() : null;
  const cards = v ? v.games : null;
  const bar = v ? xpBar(totalXp(store.doc())) : null;
  const row = (id, name, path, art, sub, color) => {
    const a = h('a', { class: 'lab-gp-row' + (id === here ? ' here' : ''), href: path, 'data-game': id, style: { '--gc': color }, ...(id === here ? { 'aria-current': 'page' } : {}) },
      h('span', { class: 'lab-gp-art', html: art }),
      h('span', { class: 'lab-gp-tx' }, h('b', {}, name), sub ? h('small', {}, sub) : null),
      id === here ? h('span', { class: 'lab-gp-here' }, 'You are here') : h('span', { class: 'lab-gp-go', 'aria-hidden': 'true', html: glyph('back') }));
    if (id === here) a.addEventListener('click', (e) => { e.preventDefault(); close(); });
    return h('li', {}, a);
  };
  const items = [];
  items.push(row('home', 'Home', '/', homeArt(), 'All the games', '#8f6bff'));
  items.push(row('lab', 'The Lab', '/lab/', labArt(), bar ? `${bar.name} · quests, shop and your pet` : 'Quests, shop and your pet', GAME_COLORS.any));
  for (const g of GAME_INFO) {
    const c = cards ? cards.find((x) => x.game === g.id) : null;
    const sub = !c ? g.pitch : c.played ? [c.level, c.line].filter(Boolean).join(' · ') || 'Played before' : 'Try it';
    items.push(row(g.id, g.name, g.path, gameBadge(g.id, 44), sub, GAME_COLORS[g.id]));
  }
  const closeBtn = h('button', { class: 'lab-gp-close', type: 'button', 'aria-label': 'Close games', id: 'lab-games-close', html: glyph('close') });
  const panel = h('nav', { class: 'lab-gp-panel', 'aria-label': 'Games' },
    h('div', { class: 'lab-gp-head' }, h('h2', {}, 'Games'), closeBtn),
    h('ul', { class: 'lab-gp-list' }, ...items));
  const scrim = h('div', { class: 'lab-gp-scrim' });
  const root = h('div', { class: 'lab-root lab-gp', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Games', id: 'lab-games-panel' }, scrim, panel);
  let closed = false;
  function close() {
    if (closed) return; closed = true;
    document.removeEventListener('keydown', onKey, true);
    root.classList.remove('in');
    setTimeout(() => root.remove(), 160);
    if (current && current.root === root) current = null;
    try { if (before && before.focus) before.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
    if (o.onClose) { try { o.onClose(); } catch (_) { /* ignore */ } }
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') {                                    // keep the focus inside the panel
      const f = [...root.querySelectorAll('a[href],button')];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
    }
  }
  scrim.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', onKey, true);
  document.body.append(root);
  void root.offsetWidth; root.classList.add('in');
  try { closeBtn.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
  current = { root, close };
  return { close, el: root };
}
export const gamesOpen = () => !!current;

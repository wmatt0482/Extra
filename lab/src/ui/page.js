// The /lab/ page (lab/SPEC.md §5.1): Players (the family's picker, "+ New player" typed on the on-screen keyboard) -> the shared shell. The same code
// the overlay uses sits behind the first tap on a player. renderPage(root, store, { sync }) returns { refresh(), onSync() } for the page controller.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { MAX_NAME, MAX_PLAYERS, PLAYER_COLORS, cleanName, createPlayer, loadFamily } from '../../../spell-jump/src/spelling/profiles.js';
import { createKeyboard } from '../../../spell-jump/src/spelling/keyboard.js';
import { levelProgress } from '../core/xp.js';
import { totalXp } from '../core/model.js';
import { createApp, prepareVoice } from './app.js';
import { drawPortrait } from './avatar.js';
import { glyph } from './glyph.js';
import { loadGameLooks } from './items.js';
import { gentleSaved } from './parent.js';
import { sharedVoice } from './voice.js';
import { sfx } from './util.js';

const display = (s) => s.replace(/(^|[ '-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
const wornOf = (doc) => { const o = {}; if (doc) for (const s of ['hat', 'shirt', 'back', 'face', 'aura']) { const e = doc.equipped[`av.${s}`]; o[s] = e && e[0] ? e[0] : null; } return o; };

export function renderPage(root, store, { sync, player: wanted = '', view: wantedView = '' } = {}) {
  root.classList.add('lab-root', 'lab-page');
  let screen = 'players', app = null, kb = null;
  const shell = h('div', { class: 'lab-page-in' });
  root.replaceChildren(shell);
  const voice = sharedVoice();

  // ---------- Players ----------
  function showPlayers() {
    screen = 'players';
    if (app) { app.destroy(); app = null; }
    if (store.player) store.detach();
    const f = loadFamily();
    const tiles = f.players.map((p) => {
      const doc = store.docOf(p.id);
      const lp = levelProgress(doc ? totalXp(doc) : 0);
      const cv = h('canvas', { class: 'lab-pl-cv', width: 160, height: 160, 'aria-hidden': 'true' });
      const b = h('button', { class: 'lab-card lab-pl-tile', type: 'button', 'data-player': p.id, style: { '--c': p.color }, 'aria-label': `${p.name}, level ${lp.level}` },
        cv, h('span', { class: 'lab-pl-name' }, p.name), h('span', { class: 'lab-pl-level' }, `Lv ${lp.level} · ${lp.title}`));
      b.addEventListener('click', () => { sfx('click'); pick(p.id); });
      requestAnimationFrame(() => drawPortrait(cv, { color: p.color, slots: wornOf(doc) }));
      return b;
    });
    if (f.players.length < MAX_PLAYERS) {
      const add = h('button', { class: 'lab-card lab-pl-tile lab-pl-add', type: 'button', id: 'pl-add' }, h('span', { class: 'lab-pl-plus' }, '+'), h('span', { class: 'lab-pl-name' }, 'New player'));
      add.addEventListener('click', showNew);
      tiles.push(add);
    }
    const st = sync && sync.status ? sync.status() : null;
    shell.replaceChildren(
      h('header', { class: 'lab-pl-top' },
        h('a', { class: 'lab-btn lab-btn-sm lab-pl-home', href: '/', id: 'pl-home' }, h('span', { html: glyph('home') }), 'Learning Lab'),
        h('h1', { class: 'lab-logo' }, 'The Lab'),
        st && st.synced ? h('span', { class: 'lab-sync-chip', id: 'sync-chip' }, h('i'), `Synced · ${st.code}`) : h('span')),
      h('div', { class: 'lab-pl-body' },
        f.players.length ? null : h('p', { class: 'lab-pl-empty', id: 'pl-empty' }, 'Add a player to start.'),
        h('div', { class: 'lab-pl-grid' }, ...tiles),
        f.players.length ? null : h('a', { class: 'lab-btn lab-btn-sm', href: '/spell-jump/', id: 'pl-code' }, 'Already have a family code? Open Spell Jump, then Parents')));
  }
  // ---------- New player ----------
  function showNew() {
    screen = 'new';
    let name = '';
    const f = loadFamily();
    const taken = new Set(f.players.map((p) => p.color));
    let color = PLAYER_COLORS.find((c) => !taken.has(c)) || PLAYER_COLORS[0];
    const nameBox = h('div', { class: 'lab-namebox', id: 'np-name' });
    const sw = h('div', { class: 'lab-colours' });
    const prev = h('canvas', { class: 'lab-np-cv', width: 160, height: 160, 'aria-hidden': 'true' });
    const paintName = () => { nameBox.replaceChildren(name ? h('span', {}, display(name)) : h('span', { class: 'ph' }, 'Type your name'), h('i', { class: 'caret' })); if (kb) kb.setEnterEnabled(!!cleanName(name)); };
    const paintSw = () => {
      sw.replaceChildren(...PLAYER_COLORS.map((c) => {
        const b = h('button', { class: 'lab-colour' + (c === color ? ' on' : '') + (taken.has(c) ? ' taken' : ''), type: 'button', 'aria-label': 'Colour', 'aria-pressed': String(c === color), style: { '--c': c } });
        b.addEventListener('click', () => { color = c; paintSw(); drawPortrait(prev, { color }); });
        return b;
      }));
    };
    kb = createKeyboard({
      id: 'np-keyboard', enterLabel: 'Done',
      onKey: (ch) => { if (name.length >= MAX_NAME || (ch === ' ' && (!name || name.endsWith(' ')))) return; name += ch; sfx('click'); paintName(); },
      onBackspace: () => { name = name.slice(0, -1); paintName(); },
      onEnter: () => { const n = cleanName(display(name)); if (!n) return; const p = createPlayer(loadFamily(), n, color); if (p) { sfx('cash'); kb.setActive(false); pick(p.id); } },
    });
    const back = h('button', { class: 'lab-btn lab-icon-btn', type: 'button', 'aria-label': 'Back', id: 'np-back', html: glyph('back') });
    back.addEventListener('click', () => { kb.setActive(false); showPlayers(); });
    shell.replaceChildren(
      h('header', { class: 'lab-pl-top' }, back, h('h1', { class: 'lab-logo' }, 'New player'), h('span')),
      h('div', { class: 'lab-np' }, h('div', { class: 'lab-np-row' }, prev, nameBox, sw), h('div', { class: 'lab-np-kb' }, kb.el)));
    paintName(); paintSw(); kb.setEnabled(true); kb.setActive(true);
    requestAnimationFrame(() => drawPortrait(prev, { color }));
  }
  // ---------- the player's Lab ----------
  function pick(id, view = '') {
    const f = loadFamily();
    const p = f.players.find((x) => x.id === id);
    if (!p) return showPlayers();
    if (!store.attach({ game: 'sj', playerId: p.id, name: p.name, color: p.color, gentle: gentleSaved() })) return showPlayers();
    try { f.lastPlayer = p.id; } catch (_) { /* ignore */ }
    screen = 'lab';
    loadGameLooks().then((ids) => { if (store.player) store.setReady([...new Set([...store.ready, ...ids])]); });
    if (app) app.destroy();
    app = createApp(store, { mode: 'page', view: view || '', sync, onExit: showPlayers });
    shell.replaceChildren(app.el);
    prepareVoice(store, voice);
  }

  const hash = (typeof location !== 'undefined' && location.hash ? location.hash.slice(1) : '');
  if (wanted) pick(wanted, wantedView || hash); else showPlayers();
  return {
    get screen() { return screen; },
    get app() { return app; },
    refresh() { if (app) app.refresh(); },
    /** The family sync applied something: the picker re-reads the family, the Lab re-reads the doc. */
    onSync() { if (screen === 'players') showPlayers(); else if (app) app.refresh(); },
    showPlayers,
  };
}

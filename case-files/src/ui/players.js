// Player picker ("Who's on the case?") and "+ New player" (name typed on Spell Jump's on-screen keyboard, never the native
// one, plus a color). The players are the family's (Spell Jump's record through profiles.js), shared with the other games, and
// they sync with the family code. Up to 4 players; renaming / removing lives in the Parent Zone only. Top row: a Learning Lab
// home link, the title, and Parents (the same PIN as the other games).
import { MAX_NAME, MAX_PLAYERS, PLAYER_COLORS, cleanName } from '../../../spell-jump/src/spelling/profiles.js';
import { createKeyboard } from '../../../spell-jump/src/spelling/keyboard.js';
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { drawAvatar } from './art.js';

export { drawAvatar };

export function createPlayers(app) {
  const grid = $('#player-grid');
  const nameEl = $('#np-name');
  const swatches = $('#np-colors');
  const preview = $('#np-avatar');
  let name = '', color = PLAYER_COLORS[0];

  const kb = createKeyboard({
    id: 'np-keyboard', enterLabel: 'Done',
    onKey: (ch) => {
      if (name.length >= MAX_NAME || (ch === ' ' && (!name || name.endsWith(' ')))) return;
      name += ch; app.audio.letter(); render();
    },
    onBackspace: () => { if (!name) return; name = name.slice(0, -1); app.audio.letter(true); render(); },
    onEnter: () => {
      const n = cleanName(display(name));
      if (!n) return;
      const p = app.createPlayer(n, color);
      if (p) { app.audio.cash(); app.selectPlayer(p.id); }
      else { app.audio.error(); app.toast('The family already has 4 players'); }
    },
  });
  $('#np-kb').append(kb.el);
  const display = (s) => s.replace(/(^|[ '-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

  function render() {
    nameEl.replaceChildren(name ? h('span', {}, display(name)) : h('span', { class: 'ph' }, 'Type your name'), h('i', { class: 'caret' }));
    kb.setEnterEnabled(!!cleanName(name));
  }
  function renderColors() {
    const taken = new Set(app.family.players.map((p) => p.color));
    swatches.replaceChildren(...PLAYER_COLORS.map((c) => {
      const b = h('button', { class: 'swatch' + (c === color ? ' on' : '') + (taken.has(c) ? ' taken' : ''), 'aria-label': 'Color', 'aria-pressed': String(c === color), style: { '--c': c }, 'data-color': c, 'data-sfx': '' });
      b.addEventListener('click', () => { color = c; renderColors(); drawAvatar(preview, color); });
      return b;
    }));
  }

  const home = $('#btn-home');
  if (home) home.hidden = !/\/case-files\/(index\.html)?$/.test(location.pathname);
  $('#btn-parents-picker').addEventListener('click', () => app.openParents({ tab: 'sync' }));
  const chip = $('#sync-chip');
  chip.addEventListener('click', () => app.openParents({ tab: 'sync' }));
  function refreshSyncChip() {
    const s = app.sync.status();
    chip.hidden = !s.synced;
    if (!s.synced) { chip.replaceChildren(); return; }
    chip.replaceChildren(h('span', { class: 'sc-dot', 'aria-hidden': 'true' }), `Synced · ${s.code}`);
    chip.setAttribute('aria-label', `Family sync on, code ${s.code}. Opens Parents.`);
  }

  function showPicker() {
    const f = app.family;
    refreshSyncChip();
    grid.replaceChildren();
    for (const p of f.players) {
      const cv = h('canvas', { class: 'pl-avatar', 'aria-hidden': 'true' });
      const closed = app.closedCount(p.id);      // the Detective Rank is a parent setting (Parent Zone only): never shown or announced here
      const b = h('button', { class: 'card pl-tile', 'data-player': p.id, 'data-sfx': '', style: { '--c': p.color }, 'aria-label': `${p.name}, ${closed} ${closed === 1 ? 'case' : 'cases'} closed` },
        cv, h('span', { class: 'pl-name' }, p.name), h('span', { class: 'pl-level', 'data-closed': String(closed) }, `${closed} closed`));
      b.addEventListener('click', () => app.selectPlayer(p.id));
      grid.append(b);
      drawAvatar(cv, p.color);
    }
    if (f.players.length < MAX_PLAYERS) {
      const add = h('button', { class: 'card pl-tile pl-add', id: 'pl-add', 'data-sfx': '' }, h('span', { class: 'pl-plus' }, '+'), h('span', { class: 'pl-name' }, 'New player'));
      add.addEventListener('click', () => app.go('newplayer'));
      grid.append(add);
    }
  }
  function showNew() {
    name = '';
    const taken = new Set(app.family.players.map((p) => p.color));
    color = PLAYER_COLORS.find((c) => !taken.has(c)) || PLAYER_COLORS[0];
    render(); renderColors();
    drawAvatar(preview, color);
    kb.setEnabled(true);
    kb.setActive(true);
  }
  return {
    refreshSyncChip,
    players: { show: showPicker, hide() {} },
    newplayer: { show: showNew, hide() { kb.setActive(false); } },
  };
}

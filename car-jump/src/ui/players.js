// Player picker (the first screen) and "+ New player" (name typed on the big on-screen keyboard, never the
// native one, plus a car-color avatar). Up to 4 players; removing a player lives in the Parent Zone only.
// Parents: a button in the picker's top-right corner, always there (also with no players yet, so a parent can
// join the family before anyone types a name), opens the PIN-gated Parent Zone on its Family code tab.
// Family sync: a tiny muted chip under the tiles shows "Synced · CODE" so a parent can tell which family this
// device is in (hidden when the device is not in a family); it opens the Parent Zone too.
import { CAR_BY_ID } from '../data/cars.js';
import { MAX_NAME, MAX_PLAYERS, PLAYER_COLORS, cleanName } from '../spelling/profiles.js';
import { createKeyboard } from '../spelling/keyboard.js';
import { drawCar } from './carPreview.js';
import { $, h } from './dom.js';

// the starter car body painted in the player's color
export const avatarCar = (color) => ({ ...CAR_BY_ID.beater, color, accent: '#0d1230' });

export function drawAvatar(canvas, color) {
  requestAnimationFrame(() => drawCar(canvas, avatarCar(color), { floor: false }));
}

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
      const b = h('button', { class: 'swatch' + (c === color ? ' on' : ''), 'aria-label': 'Car color', 'aria-pressed': String(c === color), style: { '--c': c }, 'data-color': c, 'data-sfx': '' });
      if (taken.has(c)) b.classList.add('taken');
      b.addEventListener('click', () => { color = c; renderColors(); drawAvatar(preview, color); });
      return b;
    }));
  }

  $('#btn-parents-picker').addEventListener('click', () => app.openFamilySync());
  const chip = $('#sync-chip');
  chip.addEventListener('click', () => app.openFamilySync());
  function refreshSyncChip() {
    const s = app.sync.status();
    chip.hidden = !s.synced;
    chip.classList.toggle('on', s.synced);
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
      const b = h('button', { class: 'card pl-tile', 'data-player': p.id, 'data-sfx': '', style: { '--c': p.color } }, cv, h('span', { class: 'pl-name' }, p.name));
      b.addEventListener('click', () => app.selectPlayer(p.id));
      grid.append(b);
      drawAvatar(cv, p.color);
    }
    if (f.players.length < MAX_PLAYERS) {
      const add = h('button', { class: 'card pl-tile pl-add', id: 'pl-add', 'data-sfx': '' }, h('span', { class: 'pl-plus' }, '+'), h('span', { class: 'pl-name' }, 'New player'));
      add.addEventListener('click', () => app.go('newplayer'));
      grid.append(add);
    }
    grid.dataset.count = String(grid.children.length);
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

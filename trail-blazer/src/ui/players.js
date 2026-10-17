// Player picker (the first screen) and "+ New player" (name typed on the on-screen keyboard, never the native one,
// plus a color for the Ranger avatar). The players are the family's (Spell Jump's record through profiles.js), so a
// player created here is a Spell Jump player too and syncs with the family. Up to 4 players; renaming / removing
// lives in the Parent Zone only. Top row: a Learning Lab home link and a Spell Jump link (both same-origin), the
// title, and Parents (PIN-gated, the same PIN as Spell Jump). A tiny "Synced · CODE" chip shows the family.
import { MAX_NAME, MAX_PLAYERS, PLAYER_COLORS, cleanName } from '../../../spell-jump/src/spelling/profiles.js';
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { createKeyboard } from './keyboard.js';
import { drawAvatar } from './vehiclePreview.js';

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

  // the Learning Lab home link only where the game is served under /trail-blazer/ (the site, or the repo root locally)
  const home = $('#btn-home');
  if (home) home.hidden = !/\/trail-blazer\/(index\.html)?$/.test(location.pathname);
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
    const total = app.trails.length;
    for (const p of f.players) {
      const cv = h('canvas', { class: 'pl-avatar', 'aria-hidden': 'true' });
      const done = app.trailsDoneFor(p.id);
      const b = h('button', { class: 'card pl-tile', 'data-player': p.id, 'data-sfx': '', style: { '--c': p.color }, 'aria-label': `${p.name}, ${done} of ${total} trails` },
        cv, h('span', { class: 'pl-name' }, p.name), h('span', { class: 'pl-level', 'data-trails': String(done) }, `Trails ${done}/${total}`));
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

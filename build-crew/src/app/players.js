// The family's first screen and "+ New player", as in Spell Jump, Trail Blazer, Fraction Fright and Wagon West (their
// src/ui/players.js): "Who's building?" with one card per player of the family (Spell Jump's record through the shared
// profiles.js, so a player made in any game is here) and a dashed New player card; the new-player screen types the name
// on the shared on-screen keyboard (never the native one) and picks the player's family colour. Up to 4 players;
// renaming and removing live in the Parent Zone. The top bar: a Learning Lab home link (same origin), the heading, and
// Parents (the family PIN). This file only draws and reports taps; title.js owns the screens and who is building.
import {
  MAX_NAME,
  MAX_PLAYERS,
  PLAYER_COLORS,
  cleanName,
  createPlayer,
} from '../../../spell-jump/src/spelling/profiles.js';
import { createKeyboard } from '../../../spell-jump/src/spelling/keyboard.js';
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { Audio } from '../../../spell-jump/src/audio.js';
import { JOB_COUNT } from '../content.mjs';
import { loadSave } from '../meta/save.mjs';
import { app } from './state.js';

/** A builder's badge: a hard hat in the player's colour over safety glasses and a work jacket (inline SVG, no canvas). */
export function hardHat(color = PLAYER_COLORS[0]) {
  return (
    '<svg viewBox="0 0 64 64" aria-hidden="true">' +
    '<path d="M9 64c0-13 6-20 15-22h16c9 2 15 9 15 22z" fill="#2b3138"/>' +
    '<path d="M24.5 45.5l3.5 18.5M39.5 45.5l-3.5 18.5" stroke="#ffc21a" stroke-width="4"/>' +
    '<path d="M18 52h28" stroke="#e9eef2" stroke-width="2.5" opacity=".8"/>' +
    '<ellipse cx="32" cy="32" rx="12" ry="13" fill="#d9a77c"/>' +
    '<rect x="19" y="28" width="26" height="7" rx="3.5" fill="#15191d"/>' +
    '<path d="M22 30h8" stroke="#6d8596" stroke-width="1.6" stroke-linecap="round"/>' +
    `<path d="M16 25c0-10 7-16 16-16s16 6 16 16z" fill="${color}"/>` +
    '<path d="M30 9.4h4V24h-4z" fill="#fff" opacity=".28"/>' +
    `<rect x="11" y="23" width="42" height="5" rx="2.5" fill="${color}"/>` +
    '<rect x="11" y="26" width="42" height="2" rx="1" fill="#000" opacity=".28"/>' +
    '</svg>'
  );
}

/** How far a builder has got, for the pill on their card: the twenty jobs (Lab blueprints never count). */
export function jobsDone(id) {
  try {
    return loadSave(id).done.filter((j) => j <= JOB_COUNT).length;
  } catch {
    return 0;
  }
}

/** Capitalises each word the way the family's games show names ("mia rose" -> "Mia Rose"). */
const display = (s) => s.replace(/(^|[ '-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

/** Builds the picker and the new-player screen. `onPick(id)` chooses a builder, `onNew()` opens the new-player screen,
 *  `onBack()` leaves it, `onParents()` opens the Parent Zone. */
export function createPlayers({ onPick, onNew, onBack, onParents }) {
  const grid = $('#player-grid'),
    nameEl = $('#np-name'),
    swatches = $('#np-colors'),
    preview = $('#np-avatar');
  let name = '',
    color = PLAYER_COLORS[0];
  const kb = createKeyboard({
    id: 'np-keyboard',
    enterLabel: 'Done',
    onKey(ch) {
      if (name.length >= MAX_NAME || (ch === ' ' && (!name || name.endsWith(' ')))) return;
      name += ch;
      Audio.letter?.();
      render();
    },
    onBackspace() {
      if (!name) return;
      name = name.slice(0, -1);
      Audio.letter?.(true);
      render();
    },
    onEnter() {
      const n = cleanName(display(name));
      if (!n) return;
      const p = createPlayer(app.family, n, color);
      if (!p) return;
      Audio.coin?.();
      onPick(p.id);
    },
  });
  $('#np-kb').append(kb.el);
  $('#np-back').onclick = onBack;
  $('#btn-parents-picker').onclick = onParents;
  // The Learning Lab link only where it leads somewhere: the game served under /build-crew/ on the site.
  $('#btn-home').hidden = !/\/build-crew\/(index\.html)?$/.test(location.pathname);
  const chip = $('#sync-chip');
  chip.onclick = onParents;

  function render() {
    nameEl.replaceChildren(
      name ? h('span', {}, display(name)) : h('span', { class: 'ph' }, 'Type your name'),
      h('i', { class: 'caret' }),
    );
    kb.setEnterEnabled(!!cleanName(name));
  }
  function renderColors() {
    const taken = new Set(app.family.players.map((p) => p.color));
    swatches.replaceChildren(
      ...PLAYER_COLORS.map((c) =>
        h('button', {
          class: 'swatch' + (c === color ? ' on' : '') + (taken.has(c) ? ' taken' : ''),
          'aria-label': 'Colour',
          'aria-pressed': String(c === color),
          style: { '--c': c },
          'data-color': c,
          onclick() {
            color = c;
            renderColors();
            preview.innerHTML = hardHat(color);
          },
        }),
      ),
    );
  }
  /** Shows "Synced · CODE" under the cards when this device is in a family. */
  function refreshSyncChip() {
    const s = app.sync?.status?.() || {};
    chip.hidden = !s.synced;
    if (!s.synced) {
      chip.replaceChildren();
      return;
    }
    chip.replaceChildren(h('span', { class: 'sc-dot', 'aria-hidden': 'true' }), `Synced · ${s.code}`);
    chip.setAttribute('aria-label', `Family sync on, code ${s.code}. Opens Parents.`);
  }

  return {
    refreshSyncChip,
    /** The picker: every family player with their jobs done, then New player while there is room. */
    showPicker() {
      refreshSyncChip();
      const f = app.family;
      grid.replaceChildren(
        ...f.players.map((p) => {
          const n = jobsDone(p.id);
          return h(
            'button',
            {
              class: 'card pl-tile',
              'data-player': p.id,
              'data-profile': p.id,
              style: { '--c': p.color },
              'aria-label': `${p.name}, ${n} of ${JOB_COUNT} jobs`,
              onclick: () => onPick(p.id),
            },
            h('span', { class: 'pl-avatar', html: hardHat(p.color) }),
            h('span', { class: 'pl-name' }, p.name),
            h('span', { class: 'pl-level', 'data-jobs': String(n) }, `${n} / ${JOB_COUNT} jobs`),
          );
        }),
      );
      if (f.players.length < MAX_PLAYERS) {
        grid.append(
          h(
            'button',
            { class: 'card pl-tile pl-add', id: 'add-player', onclick: onNew },
            h('span', { class: 'pl-plus' }, '+'),
            h('span', { class: 'pl-name' }, 'New player'),
          ),
        );
      }
      grid.dataset.count = String(grid.children.length);
    },
    /** The new-player screen: an empty name, the first free family colour, the keyboard live. */
    showNew() {
      name = '';
      const taken = new Set(app.family.players.map((p) => p.color));
      color = PLAYER_COLORS.find((c) => !taken.has(c)) || PLAYER_COLORS[0];
      render();
      renderColors();
      preview.innerHTML = hardHat(color);
      kb.setEnabled?.(true);
      kb.setActive(true);
    },
    hideNew() {
      kb.setActive(false);
    },
  };
}

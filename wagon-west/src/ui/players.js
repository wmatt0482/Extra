// Player picker (the first screen) and "+ New player" (name typed on Spell Jump's on-screen keyboard, never the
// native one, plus a color), the same as Fraction Fright's src/ui/players.js. The players are the family's (Spell
// Jump's record through profiles.js), shared with Spell Jump, Trail Blazer and Fraction Fright, and they sync with the
// family code. Up to 4 players; renaming / removing lives in the Parent Zone only. Top row: a Learning Lab home link
// (same origin), the title, and Parents (the same PIN as the other games).
import { MAX_NAME, MAX_PLAYERS, PLAYER_COLORS, cleanName } from '../../../spell-jump/src/spelling/profiles.js';
import { createKeyboard } from '../../../spell-jump/src/spelling/keyboard.js';
import { $, h } from '../../../spell-jump/src/ui/dom.js';

/** The player's pioneer: a wide-brim hat in the player's color, a neckerchief, freckles (procedural). */
export function drawAvatar(canvas, color = '#d9653b') {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(24, Math.round(r.width || 64)), hh = Math.max(24, Math.round(r.height || 64));
  canvas.width = w * dpr; canvas.height = hh * dpr;
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, hh);
  const s = Math.min(w, hh) / 64;
  c.translate(w / 2, hh / 2); c.scale(s, s);
  // shoulders (a work shirt) and the neckerchief in the player's color
  c.fillStyle = '#5b7fa8'; c.beginPath(); c.moveTo(-28, 32); c.quadraticCurveTo(-28, 12, -16, 8); c.lineTo(16, 8); c.quadraticCurveTo(28, 12, 28, 32); c.closePath(); c.fill();
  c.fillStyle = color; c.beginPath(); c.moveTo(-12, 8); c.lineTo(12, 8); c.lineTo(0, 22); c.closePath(); c.fill();
  // face
  c.fillStyle = '#e8b98f'; c.beginPath(); c.ellipse(0, -2, 13, 14, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#3a2416'; for (const x of [-5, 5]) { c.beginPath(); c.arc(x, -3, 2, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = '#3a2416'; c.lineWidth = 2; c.beginPath(); c.arc(0, 3, 5, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  c.fillStyle = 'rgba(180,90,50,.45)'; for (const [x, y] of [[-8, 2], [-6, 4], [7, 2], [9, 4]]) c.fillRect(x, y, 1.6, 1.6);
  // the wide-brim hat
  c.fillStyle = color; c.beginPath(); c.ellipse(0, -13, 27, 6, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(-14, -13); c.quadraticCurveTo(-14, -31, 0, -31); c.quadraticCurveTo(14, -31, 14, -13); c.closePath(); c.fill();
  c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(-14, -18, 28, 4);
  c.setTransform(1, 0, 0, 1, 0, 0);
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
  if (home) home.hidden = !/\/wagon-west\/(index\.html)?$/.test(location.pathname);
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
      const where = app.whereFor(p.id);
      const b = h('button', { class: 'card pl-tile', 'data-player': p.id, 'data-sfx': '', style: { '--c': p.color }, 'aria-label': `${p.name}, ${where}` },
        cv, h('span', { class: 'pl-name' }, p.name), h('span', { class: 'pl-level', 'data-where': where }, where));
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

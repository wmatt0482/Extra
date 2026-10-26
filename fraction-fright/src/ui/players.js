// Player picker (the first screen) and "+ New player" (name typed on Spell Jump's on-screen keyboard, never the
// native one, plus a color). The players are the family's (Spell Jump's record through profiles.js), shared with
// Spell Jump and Trail Blazer, and they sync with the family code. Up to 4 players; renaming / removing lives in the
// Parent Zone only. Top row: a Learning Lab home link, the title, and Parents (the same PIN as the other games).
import { MAX_NAME, MAX_PLAYERS, PLAYER_COLORS, cleanName } from '../../../spell-jump/src/spelling/profiles.js';
import { createKeyboard } from '../../../spell-jump/src/spelling/keyboard.js';
import { $, h } from '../../../spell-jump/src/ui/dom.js';

/** The player's thrower: a hoodie in the player's color, goggles with a toxic glint, a slime cannon strap (procedural). */
export function drawAvatar(canvas, color = '#8dff3a') {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(24, Math.round(r.width || 64)), hh = Math.max(24, Math.round(r.height || 64));
  canvas.width = w * dpr; canvas.height = hh * dpr;
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, hh);
  const s = Math.min(w, hh) / 64;
  c.translate(w / 2, hh / 2); c.scale(s, s);
  // shoulders + hood
  c.fillStyle = color; c.beginPath(); c.moveTo(-30, 32); c.quadraticCurveTo(-30, 8, -20, 2); c.lineTo(20, 2); c.quadraticCurveTo(30, 8, 30, 32); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(-22, 10); c.quadraticCurveTo(-26, -26, 0, -28); c.quadraticCurveTo(26, -26, 22, 10); c.closePath(); c.fill();
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.moveTo(-16, 8); c.quadraticCurveTo(-18, -18, 0, -19); c.quadraticCurveTo(18, -18, 16, 8); c.closePath(); c.fill();
  c.fillStyle = '#c9926a'; c.beginPath(); c.ellipse(0, -2, 13, 14, 0, 0, Math.PI * 2); c.fill();
  // goggles with a toxic glint
  c.fillStyle = '#141316'; c.fillRect(-15, -9, 30, 9);
  for (const x of [-7, 7]) { c.fillStyle = '#a6ff2e'; c.beginPath(); c.arc(x, -5, 5, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(x - 3, -8, 2, 2); }
  c.strokeStyle = '#3a2a1e'; c.lineWidth = 2; c.beginPath(); c.moveTo(-4, 7); c.lineTo(5, 6); c.stroke();
  // the slime cannon strap
  c.strokeStyle = '#2a2830'; c.lineWidth = 4; c.beginPath(); c.moveTo(-22, 10); c.lineTo(18, 32); c.stroke();
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
  if (home) home.hidden = !/\/fraction-fright\/(index\.html)?$/.test(location.pathname);
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
      const cures = app.curesFor(p.id), lv = app.levelFor(p.id);
      const b = h('button', { class: 'card pl-tile', 'data-player': p.id, 'data-sfx': '', style: { '--c': p.color }, 'aria-label': `${p.name}, level ${lv}, ${cures} neighbours cured` },
        cv, h('span', { class: 'pl-name' }, p.name), h('span', { class: 'pl-level', 'data-level': String(lv), 'data-cures': String(cures) }, `Lv ${lv} · ${cures} cured`));
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

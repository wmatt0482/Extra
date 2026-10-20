// The Garage Wall (SPEC v1.5 §4): every collectible in sets (helmets, suits, horns, boost trails, flags, paints,
// decals) with "7 / 12", a bar and the set bonus (complete a set → a unique paint). Owned gear is in colour (tap to
// wear it), the rest is a dark "?" tile. "Open crate" opens any crates still waiting.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { BY_KIND, KINDS, KIND_NAME, STOCK } from '../data/cosmetics.js';
import { PAINT_BY_ID } from '../data/paints.js';
import { equip, owns, unopened, wall } from '../meta/crates.js';
import { ownsDecal, ownsPaint } from '../meta/economy.js';
import { itemSwatch } from './items.js';

export function createWall(app, crates) {
  const grid = $('#wall-grid');
  const openBtn = $('#wall-open');
  const raceOwned = (it) => (it.kind === 'paint' ? ownsPaint(app.save, app.trails, it.id) : it.kind === 'decal' ? ownsDecal(app.save, it.id) : false);
  const has = (kind, id) => owns(app.save, kind, id) || raceOwned({ kind, id });
  const isOn = (kind, id) => (kind === 'paint' ? app.save.paint === id : kind === 'decal' ? app.save.decal === id : (app.save.cosmetics.equipped[kind] || STOCK[kind]) === id);

  openBtn.addEventListener('click', () => crates.open(() => render()));

  function tile(kind, it) {
    const got = has(kind, it.id);
    const on = got && isOn(kind, it.id);
    const b = h('button', { class: `wall-item r-${it.rarity}${got ? ' owned' : ' missing'}${on ? ' on' : ''}`, 'data-item': `${kind}:${it.id}`, 'data-sfx': '',
      'aria-label': got ? `${it.name}${on ? ', on' : ''}` : 'Not found yet', title: got ? it.name : '?' },
    got ? itemSwatch(kind, it.id) : h('i', { class: 'sw q' }, '?'));
    b.addEventListener('click', () => {
      if (!got) { app.toast(it.source === 'streak' ? `${it.days}-day streak` : 'Find it in a crate'); return; }
      if (kind === 'horn') app.sfx.horn(it.notes);
      if (on) { app.toast(it.name); return; }
      if (kind === 'paint') app.save.paint = it.id; else if (kind === 'decal') app.save.decal = it.id; else equip(app.save, kind, it.id);
      app.persist(); app.onLookChanged(); app.toast(`${it.name} on!`);
      render();
    });
    return b;
  }
  function render() {
    const rows = wall(app.save, raceOwned);
    grid.replaceChildren(...KINDS.map((kind) => {
      const w = rows.find((x) => x.kind === kind);
      const list = BY_KIND[kind].filter((x) => x.id !== 'none' && (x.source !== 'set' || has(kind, x.id)));
      const bonus = w.bonus ? PAINT_BY_ID[w.bonus] : null;
      return h('div', { class: 'card wall-set' + (w.done ? ' done' : ''), 'data-set': kind },
        h('div', { class: 'ws-head' }, h('b', {}, KIND_NAME[kind]), h('span', { class: 'ws-count', 'data-have': String(w.have), 'data-total': String(w.total) }, `${w.have} / ${w.total}`)),
        h('div', { class: 'ws-bar' }, h('i', { style: { width: `${Math.round((w.have / Math.max(1, w.total)) * 100)}%` } })),
        h('div', { class: 'ws-items' }, ...list.map((it) => tile(kind, it))),
        bonus ? h('div', { class: 'ws-bonus' + (w.bonusOwned ? ' got' : ''), 'data-bonus': bonus.id }, itemSwatch('paint', bonus.id),
          w.bonusOwned ? `Set bonus: ${bonus.name} paint!` : `Complete the set: ${bonus.name} paint`) : null);
    }));
    const n = unopened(app.save);
    openBtn.hidden = !n;
    openBtn.querySelector('.badge-n').textContent = n > 1 ? String(n) : '';
    app.refreshCash();
  }
  return { show: render, hide() {}, render };
}

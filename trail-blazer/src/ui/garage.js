// Garage: the Ranger (procedural preview), a Paint / Decals strip and the four upgrades (10 levels each, bought with
// cash). Paints and decals are never bought: a finished trail unlocks a paint, a long ride unlocks a decal
// (src/data/paints.js); locked chips say how to earn them.
import { UPGRADES, MAX_LEVEL } from '../data/upgrades.js';
import { DECALS, PAINTS, PAINT_BY_ID, decalHint, paintHint } from '../data/paints.js';
import { buyUpgrade, canAfford, nextUpgradeCost, ownsDecal, ownsPaint } from '../meta/economy.js';
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { COIN } from '../../../spell-jump/src/ui/icons.js';
import { icon } from './tbIcons.js';
import { drawPreview } from './vehiclePreview.js';

const DECAL_SW = {
  none: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" fill="none" stroke="#b2d3c2" stroke-width="2"/><path d="M5.5 14.5l9-9" stroke="#b2d3c2" stroke-width="2"/></svg>',
  mud: '<svg viewBox="0 0 20 20"><circle cx="7" cy="8" r="4" fill="#8a5a32"/><circle cx="13.5" cy="12.5" r="3" fill="#8a5a32"/><circle cx="14" cy="5" r="1.6" fill="#8a5a32"/></svg>',
  flames: '<svg viewBox="0 0 20 20"><path d="M10 2c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3.4 2-4.4.4 1.5 1.3 2.4 2.3 2.4C9 7 9.5 4.4 10 2z" fill="#ff8a1f"/><path d="M10 9c1.3 1.6 2 2.6 2 4a2 2 0 0 1-4 0c0-1 .8-2.2 2-4z" fill="#ffd23a"/></svg>',
  stars: '<svg viewBox="0 0 20 20"><path d="M10 2l2.3 5 5.4.6-4 3.6 1.1 5.3L10 13.8l-4.8 2.7 1.1-5.3-4-3.6 5.4-.6z" fill="#ffd23a"/></svg>',
  checkers: '<svg viewBox="0 0 20 20"><rect width="20" height="20" fill="#fff"/><path d="M0 0h5v5H0zM10 0h5v5h-5zM5 5h5v5H5zM15 5h5v5h-5zM0 10h5v5H0zM10 10h5v5h-5zM5 15h5v5H5zM15 15h5v5h-5z" fill="#111"/></svg>',
};

export function createGarage(app) {
  const canvas = $('#veh-preview');
  const ui = { upgrades: $('#upgrades'), style: $('#style-strip'), tag: $('#veh-tag') };
  let raf = 0, styleTab = 'paint';

  $('#btn-garage-ride').addEventListener('click', () => app.go('trails'));

  function upgradeRow(u) {
    const s = app.save;
    const lv = s.levels[u.id] || 0;
    const cost = nextUpgradeCost(s, u.id);
    const pips = h('div', { class: 'pips', 'aria-label': `Level ${lv} of ${MAX_LEVEL}` });
    for (let i = 0; i < MAX_LEVEL; i++) pips.append(h('i', { class: i < lv ? 'on' : '' }));
    let btn;
    if (cost === null) btn = h('button', { class: 'btn btn-sm btn-green', disabled: true, 'data-upgrade': u.id }, 'Max');
    else {
      const afford = canAfford(s, cost);
      btn = h('button', { class: 'btn btn-sm ' + (afford ? 'btn-orange' : 'btn-poor'), 'data-upgrade': u.id, 'aria-label': `Upgrade ${u.name} for $${money(cost)}`, html: `${COIN}<span>${money(cost)}</span>` });
      btn.addEventListener('click', () => {
        const r = buyUpgrade(app.save, u.id);
        if (r.ok) { app.audio.cash(); app.persist(); app.toast(`${u.name} level ${r.level}!`); render(); }
        else { app.audio.error(); app.toast(r.reason === 'cash' ? `Need $${money(cost - app.save.cash)} more` : 'Maxed out'); }
      });
    }
    return h('div', { class: 'card up-row', 'data-row': u.id },
      h('div', { class: 'up-icon', html: icon(u.icon) }),
      h('div', { style: 'min-width:0' }, h('div', { class: 'up-name' }, u.name, h('small', { 'data-level': String(lv) }, `Lv ${lv}/${MAX_LEVEL}`)), h('div', { class: 'up-blurb' }, u.blurb), pips),
      btn);
  }

  function tabBtn(id, text, count) {
    const on = styleTab === id;
    const b = h('button', { class: 'style-tab' + (on ? ' on' : ''), role: 'tab', 'aria-selected': String(on), 'data-style-tab': id, 'data-sfx': '' }, text, h('b', {}, String(count)));
    b.addEventListener('click', () => { if (styleTab !== id) { styleTab = id; renderStyle(); ui.style.scrollLeft = 0; } });
    return b;
  }
  function chip(kind, item) {
    const s = app.save;
    const has = kind === 'paint' ? ownsPaint(s, app.trails, item.id) : ownsDecal(s, item.id);
    const on = (kind === 'paint' ? s.paint : s.decal) === item.id;
    const hint = kind === 'paint' ? paintHint(item, app.trails) : decalHint(item);
    const sw = kind === 'paint'
      ? h('i', { class: 'sw', style: { background: `linear-gradient(135deg, ${item.body} 0 60%, #ff8a1f 60% 70%, ${item.trim} 70%)` } })
      : h('i', { class: 'sw glyph', html: DECAL_SW[item.id] || '' });
    const b = h('button', { class: `style-chip ${kind}${has ? ' owned' : ' locked'}${on ? ' on' : ''}`, [`data-${kind}`]: item.id, 'data-sfx': '', 'aria-pressed': String(on),
      'aria-label': `${item.name}${has ? (on ? ', on' : '') : ', locked: ' + hint}` },
    sw, h('span', {}, has ? item.name : hint), has ? null : h('span', { class: 'sc-lock', html: icon('lock') }));
    b.addEventListener('click', () => {
      if (!has) { app.audio.error(); app.toast(`${item.name}: ${hint}`); return; }
      if (on) return;
      if (kind === 'paint') s.paint = item.id; else s.decal = item.id;
      app.persist();
      app.onLookChanged();
      renderStyle();
    });
    return b;
  }
  function renderStyle() {
    const s = app.save;
    const keep = ui.style.scrollLeft;
    const owned = (kind, list) => list.filter((x) => (kind === 'paint' ? ownsPaint(s, app.trails, x.id) : ownsDecal(s, x.id)));
    const sorted = (kind, list) => [...owned(kind, list), ...list.filter((x) => !owned(kind, list).includes(x))];
    const list = styleTab === 'paint' ? sorted('paint', PAINTS) : sorted('decal', DECALS);
    ui.style.replaceChildren(
      h('div', { class: 'style-tabs', role: 'tablist', 'aria-label': 'Style' }, tabBtn('paint', 'Paint', owned('paint', PAINTS).length), tabBtn('decal', 'Decals', owned('decal', DECALS).length - 1)),
      ...list.map((x) => chip(styleTab, x)));
    ui.style.scrollLeft = keep;
    ui.tag.textContent = `Paint: ${(PAINT_BY_ID[s.paint] || PAINTS[0]).name}`;
  }

  function render() {
    ui.upgrades.replaceChildren(...UPGRADES.map(upgradeRow));
    renderStyle();
    app.refreshCash();
    paint();
  }
  function paint() {
    const rm = app.settings.reducedMotion;
    const now = performance.now();
    drawPreview(canvas, { paint: app.save.paint, decal: app.save.decal }, { t: 0, bob: rm ? 0 : Math.sin(now / 90) * 0.6 });
  }
  function loop() { paint(); raf = requestAnimationFrame(loop); }

  return {
    show() { render(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); },
    hide() { cancelAnimationFrame(raf); raf = 0; },
    render,
  };
}

// Garage (SPEC v1.5 §1, §8): the Vehicles row (8 cards: name, feel, Owned / Selected, or the price with "Earn $X
// more"; tap an owned one to drive it, tap a locked one to look at it on the stage with its Buy button), the selected
// vehicle's four upgrades (per vehicle, costs × its tier), and the style rows: Paint, Decal, then the rider's Helmet,
// Suit, Flag, Boost trail and Horn. Paints and decals come from racing and crates; rider gear only from crates, the
// streak and set bonuses (src/data/cosmetics.js); locked chips say how to earn them. The Garage Wall button shows the
// whole collection (and opens waiting crates).
import { UPGRADES, MAX_LEVEL } from '../data/upgrades.js';
import { DECALS, PAINTS, PAINT_BY_ID, decalHint, paintHint } from '../data/paints.js';
import { BY_KIND, STOCK } from '../data/cosmetics.js';
import {
  buyUpgrade, buyVehicle, canAfford, levelsOf, nextUpgradeCost, ownsDecal, ownsPaint, ownsVehicle, priceOf, selectVehicle,
} from '../meta/economy.js';
import { equip, owns, unopened } from '../meta/crates.js';
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { COIN } from '../../../spell-jump/src/ui/icons.js';
import { icon } from './tbIcons.js';
import { drawPreview, playerLook } from './vehiclePreview.js';
import { itemSwatch } from './items.js';

const TABS = [
  { id: 'paint', name: 'Paint' }, { id: 'decal', name: 'Decal' }, { id: 'helmet', name: 'Helmet' }, { id: 'suit', name: 'Suit' },
  { id: 'flag', name: 'Flag' }, { id: 'trail', name: 'Trail' }, { id: 'horn', name: 'Horn' },
];
const GEAR_HINT = { crate: 'From a crate', streak: (d) => `${d}-day streak`, set: 'Set bonus' };

export function createGarage(app) {
  const canvas = $('#veh-preview');
  const ui = {
    upgrades: $('#upgrades'), style: $('#style-strip'), tabs: $('#style-tabs'), tag: $('#veh-tag'), name: $('#veh-name'), special: $('#veh-special'),
    row: $('#veh-row'), upHead: $('#up-head'), main: $('#btn-garage-ride'), wall: $('#btn-wall'),
  };
  let raf = 0, styleTab = 'paint', previewId = null;
  const vehicles = () => app.vehicles || [];
  const shown = () => vehicles().find((v) => v.id === (previewId || app.save.vehicle)) || vehicles()[0];

  ui.main.addEventListener('click', () => {
    const v = shown();
    if (!v || ownsVehicle(app.save, v.id)) { app.go('trails'); return; }
    const r = buyVehicle(app.save, vehicles(), v.id);
    if (r.ok) {
      previewId = null;
      app.persist(); app.audio.cash(); setTimeout(() => app.audio.fanfare(), 250);
      app.toast(`${v.name} is yours!`);
      app.onLookChanged();
      render();
    } else { app.audio.error(); app.toast(r.reason === 'cash' ? `Earn $${money(r.need)} more` : 'Already yours'); }
  });
  ui.wall.addEventListener('click', () => app.go('wall'));

  // ---------- vehicles ----------
  function vehCard(v) {
    const s = app.save;
    const own = ownsVehicle(s, v.id);
    const sel = s.vehicle === v.id;
    const price = priceOf(v);
    const afford = canAfford(s, price);
    const cv = h('canvas', { 'aria-hidden': 'true' });
    const status = sel ? h('span', { class: 'vc-st sel' }, 'Driving')
      : own ? h('span', { class: 'vc-st own' }, 'Owned')
        : h('span', { class: 'vc-st price' + (afford ? ' ok' : ''), html: `${COIN}<span>${money(price)}</span>` });
    const more = !own && !afford ? h('span', { class: 'vc-more' }, `Earn $${money(price - s.cash)} more`) : null;
    const card = h('button', {
      class: `veh-pick${own ? ' owned' : ' locked'}${sel ? ' on' : ''}${previewId === v.id ? ' peek' : ''}`, 'data-vehicle': v.id, 'data-sfx': '',
      'aria-pressed': String(sel), 'aria-label': `${v.name}, ${v.feel || ''}${sel ? ', driving' : own ? ', owned' : `, $${money(price)}`}`,
    }, h('span', { class: 'vc-tier' }, `T${v.tier}`), cv, h('b', { class: 'vc-name' }, v.name), status, more);
    card.addEventListener('click', () => {
      if (own) {
        previewId = null;
        if (!sel) { selectVehicle(s, v.id); app.persist(); app.onLookChanged(); app.toast(`${v.name}: ${v.feel}`); }
      } else previewId = previewId === v.id ? null : v.id;
      render();
    });
    requestAnimationFrame(() => drawPreview(cv, { ...playerLook(s), vehicle: v.id, flag: null }, { floor: false, alpha: own ? 1 : 0.55 }));
    return card;
  }

  // ---------- upgrades (the selected vehicle's) ----------
  function upgradeRow(u) {
    const s = app.save;
    const lv = levelsOf(s)[u.id] || 0;
    const cost = nextUpgradeCost(s, u.id, vehicles());
    const pips = h('div', { class: 'pips', 'aria-label': `Level ${lv} of ${MAX_LEVEL}` });
    for (let i = 0; i < MAX_LEVEL; i++) pips.append(h('i', { class: i < lv ? 'on' : '' }));
    let btn;
    if (cost === null) btn = h('button', { class: 'btn btn-sm btn-green', disabled: true, 'data-upgrade': u.id }, 'Max');
    else {
      const afford = canAfford(s, cost);
      btn = h('button', { class: 'btn btn-sm ' + (afford ? 'btn-orange' : 'btn-poor'), 'data-upgrade': u.id, 'aria-label': `Upgrade ${u.name} for $${money(cost)}`, html: `${COIN}<span>${money(cost)}</span>` });
      btn.addEventListener('click', () => {
        const r = buyUpgrade(app.save, u.id, vehicles());
        if (r.ok) { app.audio.cash(); app.persist(); app.toast(`${u.name} level ${r.level}!`); render(); }
        else { app.audio.error(); app.toast(r.reason === 'cash' ? `Earn $${money(cost - app.save.cash)} more` : 'Maxed out'); }
      });
    }
    return h('div', { class: 'card up-row', 'data-row': u.id },
      h('div', { class: 'up-icon', html: icon(u.icon) }),
      h('div', { style: 'min-width:0' }, h('div', { class: 'up-name' }, u.name, h('small', { 'data-level': String(lv) }, `Lv ${lv}/${MAX_LEVEL}`)), h('div', { class: 'up-blurb' }, u.blurb), pips),
      btn);
  }

  // ---------- style: paint, decal, rider gear ----------
  const has = (kind, id) => (kind === 'paint' ? ownsPaint(app.save, app.trails, id) : kind === 'decal' ? ownsDecal(app.save, id) : owns(app.save, kind, id));
  const isOn = (kind, id) => {
    const s = app.save;
    if (kind === 'paint') return s.paint === id;
    if (kind === 'decal') return s.decal === id;
    return (s.cosmetics.equipped[kind] || STOCK[kind]) === id;
  };
  const listOf = (kind) => (kind === 'paint' ? PAINTS : kind === 'decal' ? DECALS : BY_KIND[kind]);
  function hintOf(kind, item) {
    if (kind === 'paint') return paintHint(item, app.trails);
    if (kind === 'decal') return decalHint(item);
    return item.source === 'streak' ? GEAR_HINT.streak(item.days) : GEAR_HINT[item.source] || 'From a crate';
  }
  function tabBtn(t) {
    const on = styleTab === t.id;
    const n = listOf(t.id).filter((x) => has(t.id, x.id)).length;
    const b = h('button', { class: 'style-tab' + (on ? ' on' : ''), role: 'tab', 'aria-selected': String(on), 'data-style-tab': t.id, 'data-sfx': '' }, t.name, h('b', {}, String(n)));
    b.addEventListener('click', () => { if (styleTab !== t.id) { styleTab = t.id; renderStyle(); ui.style.scrollLeft = 0; } });
    return b;
  }
  function chip(kind, item) {
    const s = app.save;
    const got = has(kind, item.id);
    const on = isOn(kind, item.id);
    const hint = hintOf(kind, item);
    const b = h('button', { class: `style-chip ${kind}${got ? ' owned' : ' locked'}${on ? ' on' : ''}`, [`data-${kind}`]: item.id, 'data-sfx': '', 'aria-pressed': String(on),
      'aria-label': `${item.name}${got ? (on ? ', on' : '') : ', locked: ' + hint}` },
    itemSwatch(kind, item.id), h('span', {}, got ? item.name : hint), got ? null : h('span', { class: 'sc-lock', html: icon('lock') }));
    b.addEventListener('click', () => {
      if (!got) { app.audio.error(); app.toast(`${item.name}: ${hint}`); return; }
      if (kind === 'horn') app.sfx.horn(item.notes);
      if (on) return;
      if (kind === 'paint') s.paint = item.id; else if (kind === 'decal') s.decal = item.id; else equip(s, kind, item.id);
      app.persist();
      app.onLookChanged();
      renderStyle();
    });
    return b;
  }
  function renderStyle() {
    const keep = ui.style.scrollLeft;
    const list = listOf(styleTab).filter((x) => !(styleTab === 'paint' && x.unlock && x.unlock.set && !has('paint', x.id)));
    const sorted = [...list.filter((x) => has(styleTab, x.id)), ...list.filter((x) => !has(styleTab, x.id))];
    ui.tabs.replaceChildren(...TABS.map(tabBtn));
    ui.style.replaceChildren(...sorted.map((x) => chip(styleTab, x)));
    ui.style.scrollLeft = keep;
  }

  function renderMeta() {
    const s = app.save;
    const v = shown();
    if (!v) return;
    const own = ownsVehicle(s, v.id);
    ui.name.textContent = v.name;
    ui.tag.textContent = own ? `${v.feel} · Paint: ${(PAINT_BY_ID[s.paint] || PAINTS[0]).name}` : v.blurb || v.feel || '';
    ui.special.hidden = !v.specialName;
    ui.special.textContent = v.specialName ? `${v.specialName}: ${v.specialText || ''}` : '';
    const price = priceOf(v);
    const n = unopened(s);
    ui.wall.querySelector('.badge-n').textContent = n ? String(n) : '';
    ui.wall.classList.toggle('has-crates', n > 0);
    if (own) {
      ui.main.className = 'btn btn-green'; ui.main.dataset.mode = 'race';
      ui.main.innerHTML = `Race${icon('right')}`;
    } else {
      const afford = canAfford(s, price);
      ui.main.className = 'btn ' + (afford ? 'btn-orange' : 'btn-poor'); ui.main.dataset.mode = 'buy';
      ui.main.innerHTML = afford ? `Buy ${COIN}<span>${money(price)}</span>` : `<span>Earn $${money(price - s.cash)} more</span>`;
    }
    ui.upHead.textContent = `Upgrades · ${(vehicles().find((x) => x.id === s.vehicle) || { name: 'Ranger 150' }).name}`;
  }
  function render() {
    ui.row.replaceChildren(...vehicles().map(vehCard));
    ui.upgrades.replaceChildren(...UPGRADES.map(upgradeRow));
    renderStyle();
    renderMeta();
    app.refreshCash();
    paint();
    const on = ui.row.querySelector('.peek') || ui.row.querySelector('.on');
    if (on) { try { on.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) { /* older engines */ } }
  }
  function paint() {
    const rm = app.settings.reducedMotion;
    const now = performance.now();
    const v = shown();
    drawPreview(canvas, { ...playerLook(app.save), vehicle: v ? v.id : app.save.vehicle }, { t: rm ? 0 : now / 1000, bob: rm ? 0 : Math.sin(now / 90) * 0.6, alpha: v && !ownsVehicle(app.save, v.id) ? 0.8 : 1 });
  }
  function loop() { paint(); raf = requestAnimationFrame(loop); }

  return {
    show() { previewId = null; render(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); },
    hide() { cancelAnimationFrame(raf); raf = 0; },
    render,
  };
}

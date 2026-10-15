// Garage: car carousel with procedural preview, buy/select, and 4 upgrade rows with level pips.
// v3.3: a "Style" row under the preview: skin chips then sticker chips. Owned ones are in color (a mini swatch /
// the sticker glyph); locked ones are gray with how to earn them ("Crate", "7-day streak", "Level 8", "Week
// Champion"). Equipping is per car (owned cars only); the preview, the title hero and the run use the equipped look.
import { CARS } from '../data/cars.js';
import { SKINS, STICKERS } from '../data/cosmetics.js';
import { earnHint, equip, equippedFor, lookFor, owns } from '../meta/engagement.js';
import { UPGRADES, MAX_LEVEL } from '../data/upgrades.js';
import { buyCar, buyUpgrade, canAfford, isOwned, nextUpgradeCost, selectCar } from '../meta/economy.js';
import { carLevels } from '../meta/save.js';
import { drawCar } from './carPreview.js';
import { $, h, money } from './dom.js';
import { COIN, icon } from './icons.js';

export function createGarage(app) {
  const canvas = $('#car-preview');
  const ui = {
    name: $('#car-name'), tag: $('#car-tag'), tier: $('#car-tier'), dots: $('#car-dots'),
    action: $('#car-action'), upgrades: $('#upgrades'), style: $('#style-strip'),
  };
  let index = 0, raf = 0, t0 = 0, slide = 0;

  CARS.forEach(() => ui.dots.append(h('i')));

  function nav(dir) {
    index = (index + dir + CARS.length) % CARS.length;
    slide = dir;
    t0 = performance.now();
    render();
  }
  $('#car-prev').addEventListener('click', () => nav(-1));
  $('#car-next').addEventListener('click', () => nav(1));

  // swipe on the preview
  let sx = null;
  canvas.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  canvas.addEventListener('pointerup', (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx; sx = null;
    if (Math.abs(dx) > 40) nav(dx < 0 ? 1 : -1);
  });
  canvas.addEventListener('pointercancel', () => { sx = null; });

  ui.action.addEventListener('click', () => {
    const car = CARS[index];
    const s = app.save;
    if (!isOwned(s, car.id)) {
      const r = buyCar(s, car.id);
      if (r.ok) { app.audio.cash(); app.persist(); app.toast(`${car.name} is yours!`); app.checkAchievements(); }
      else { app.audio.error(); app.toast(`Need $${money(car.price - s.cash)} more`); }
    } else if (s.selectedCar !== car.id) {
      selectCar(s, car.id); app.persist();
    }
    render();
  });

  $('#btn-race').addEventListener('click', () => {
    const car = CARS[index];
    if (isOwned(app.save, car.id)) { selectCar(app.save, car.id); app.persist(); }
    app.go('tracks');
  });

  function upgradeRow(car, u, owned) {
    const lv = carLevels(app.save, car.id)[u.id] || 0;
    const cost = nextUpgradeCost(app.save, car.id, u.id);
    const pips = h('div', { class: 'pips', 'aria-label': `Level ${lv} of ${MAX_LEVEL}` });
    for (let i = 0; i < MAX_LEVEL; i++) pips.append(h('i', { class: i < lv ? 'on' : '' }));
    let btn;
    if (cost === null) {
      btn = h('button', { class: 'btn btn-sm btn-green', disabled: true }, 'MAX');
    } else {
      const afford = owned && canAfford(app.save, cost);
      btn = h('button', {
        class: 'btn btn-sm ' + (afford ? 'btn-yellow' : 'btn-poor'), 'data-upgrade': u.id, 'aria-label': `Upgrade ${u.name} for $${cost}`,
        disabled: !owned, html: `${owned ? COIN : icon('lock')}<span>${money(cost)}</span>`,
      });
      btn.addEventListener('click', () => {
        const r = buyUpgrade(app.save, car.id, u.id);
        if (r.ok) { app.audio.cash(); app.persist(); render(); }
        else { app.audio.error(); app.toast(r.reason === 'cash' ? `Need $${money(cost - app.save.cash)} more` : 'Buy this car first'); }
      });
    }
    return h('div', { class: 'card up-row' },
      h('div', { class: 'up-icon', html: icon(u.icon) }),
      h('div', { style: 'min-width:0' }, h('div', { class: 'up-name' }, u.name, h('small', {}, `Lv ${lv}/${MAX_LEVEL}`)), pips),
      btn);
  }

  function chip(type, c, car, owned, on) {
    const isSkin = type === 'skin';
    const has = owns(app.save, type, c.id);
    const sw = isSkin
      ? h('i', { class: 'sw', style: { background: c.body ? `linear-gradient(135deg, ${c.body} 0 55%, ${c.accent} 55%)` : `linear-gradient(135deg, ${car.color} 0 55%, ${car.accent} 55%)` } })
      : h('i', { class: 'sw glyph', style: { color: c.color || '#fff' } }, c.glyph || '∅');
    const b = h('button', {
      class: `style-chip ${type}${has ? ' owned' : ' locked'}${on ? ' on' : ''}`, [`data-${type}`]: c.id, 'data-sfx': '',
      'aria-pressed': String(!!on), 'aria-label': `${c.name}${has ? (on ? ', equipped' : '') : ', locked: ' + earnHint(c)}`,
    }, sw, h('span', { class: 'sc-text' }, has ? c.name : earnHint(c)), has ? null : h('span', { class: 'sc-lock', html: icon('lock') }));
    b.addEventListener('click', () => {
      if (!has) { app.audio.error(); app.toast(`${c.name}: ${earnHint(c) === 'Crate' ? 'find it in a crate' : earnHint(c)}`); return; }
      if (!owned) { app.audio.error(); app.toast('Buy this car first'); return; }
      if (on) return;
      equip(app.save, car.id, type, c.id);
      app.persist();
      app.onLookChanged && app.onLookChanged();
      renderStyle();
    });
    return b;
  }
  function renderStyle() {
    const car = CARS[index];
    const owned = isOwned(app.save, car.id);
    const eq = equippedFor(app.save, car.id);
    const keep = ui.style.scrollLeft;
    ui.style.replaceChildren(
      h('span', { class: 'style-label' }, 'Style'),
      ...SKINS.map((c) => chip('skin', c, car, owned, eq.skin === c.id)),
      h('span', { class: 'style-sep', 'aria-hidden': 'true' }),
      ...STICKERS.map((c) => chip('sticker', c, car, owned, eq.sticker === c.id)));
    ui.style.scrollLeft = keep;
    canvas.dataset.lookSkin = eq.skin; canvas.dataset.lookSticker = eq.sticker;
  }

  function render() {
    const s = app.save;
    const car = CARS[index];
    const owned = isOwned(s, car.id);
    ui.name.textContent = car.name;
    ui.tag.textContent = car.tagline;
    ui.tier.innerHTML = '';
    for (let i = 1; i <= 6; i++) ui.tier.append(h('i', { class: i <= car.tier ? 'on' : '' }));
    [...ui.dots.children].forEach((d, i) => d.classList.toggle('on', i === index));

    const a = ui.action;
    a.className = 'btn';
    a.disabled = false;
    if (!owned) {
      a.innerHTML = `<span>Buy</span>${COIN}<span>${money(car.price)}</span>`;
      a.classList.add(canAfford(s, car.price) ? 'btn-yellow' : 'btn-poor');
    } else if (s.selectedCar === car.id) {
      a.innerHTML = `${icon('check')}<span>Selected</span>`;
      a.classList.add('btn-selected');
      a.disabled = true;
    } else {
      a.textContent = 'Select';
      a.classList.add('btn-green');
    }

    ui.upgrades.innerHTML = '';
    for (const u of UPGRADES) ui.upgrades.append(upgradeRow(car, u, owned));
    renderStyle();
    app.refreshCash();
    paint();
  }

  function paint() {
    const now = performance.now();
    const rm = app.save.settings.reducedMotion;
    const k = rm ? 1 : Math.min(1, (now - t0) / 280);
    const ease = 1 - Math.pow(1 - k, 3);
    const look = lookFor(app.save, CARS[index].id);
    drawCar(canvas, CARS[index], {
      skin: look.skin, sticker: look.sticker,
      spin: rm ? 0 : now / 300 + (1 - ease) * 6 * slide,
      bob: rm ? 0 : Math.sin(now / 380) * 1.5,
      dx: slide ? (1 - ease) * slide * 70 : 0,
      alpha: slide ? 0.25 + 0.75 * ease : 1,
    });
  }

  function loop() {
    paint();
    raf = requestAnimationFrame(loop);
  }

  return {
    show() {
      index = Math.max(0, CARS.findIndex((c) => c.id === app.save.selectedCar));
      slide = 0;
      render();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    hide() { cancelAnimationFrame(raf); raf = 0; },
    render,
  };
}

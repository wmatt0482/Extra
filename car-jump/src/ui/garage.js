// Garage: car carousel with procedural preview, buy/select, and 4 upgrade rows with level pips.
// v3.3: a "Style" row under the preview: skin chips then sticker chips. Owned ones are in color (a mini swatch /
// the sticker glyph); locked ones are gray with how to earn them ("Crate", "7-day streak", "Level 8", "Week
// Champion"). Equipping is per car (owned cars only); the preview, the title hero and the run use the equipped look.
// v4.0 (Sky Era): once it is open the carousel also holds the sky rides; in the Sky era they come first (and a "Sky rides" row jumps
// to each), in the Earth era the cars come first and the rides follow. Every car and ride stays owned in both.
// v3.6: the row has two tabs, Paint and Stickers (13 paint chips used to push the stickers off the screen, so nobody
// found them); owned chips come first, and the Stickers tab shows how many are owned.
import { CARS, MAX_TIER } from '../data/cars.js';
import { skyAvailable, skyRides } from '../meta/skyData.js';
import { currentEra, skyUnlocked } from '../meta/sky.js';
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
  let styleTab = 'skin';            // 'skin' (Paint) | 'sticker' (Stickers)

  ui.rides = $('#sky-rides');
  // the carousel: Earth cars (+ the sky rides once the era is open); the era decides which come first
  let CARS_NOW = CARS;
  function carList() {
    const open = skyUnlocked(app.save) && skyAvailable() && skyRides().length > 0;
    if (!open) return CARS;
    return currentEra(app.save) === 'sky' ? [...skyRides(), ...CARS] : [...CARS, ...skyRides()];
  }
  function syncList() {
    CARS_NOW = carList();
    if (ui.dots.children.length !== CARS_NOW.length) { ui.dots.replaceChildren(...CARS_NOW.map(() => h('i'))); }
    ui.dots.dataset.n = String(CARS_NOW.length);
  }
  syncList();

  function nav(dir) {
    index = (index + dir + CARS_NOW.length) % CARS_NOW.length;
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
    const car = CARS_NOW[index];
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
    const car = CARS_NOW[index];
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
  function styleTabBtn(type, text, count) {
    const on = styleTab === type;
    const b = h('button', { class: 'style-tab' + (on ? ' on' : ''), role: 'tab', 'aria-selected': String(on), 'data-style-tab': type, 'data-sfx': '' },
      text, count ? h('b', {}, String(count)) : null);
    b.addEventListener('click', () => { if (styleTab !== type) { styleTab = type; renderStyle(); ui.style.scrollLeft = 0; } });
    return b;
  }
  function renderStyle() {
    const car = CARS_NOW[index];
    const owned = isOwned(app.save, car.id);
    const eq = equippedFor(app.save, car.id);
    const keep = ui.style.scrollLeft;
    // owned first (Stock / No sticker stay first), locked after, each group in catalogue order
    const sorted = (type, list) => [...list].sort((a, b) => Number(owns(app.save, type, b.id)) - Number(owns(app.save, type, a.id)));
    const list = styleTab === 'skin' ? sorted('skin', SKINS) : sorted('sticker', STICKERS);
    const nSkins = SKINS.filter((c) => c.id !== 'stock' && owns(app.save, 'skin', c.id)).length;
    const nStickers = STICKERS.filter((c) => c.id !== 'none' && owns(app.save, 'sticker', c.id)).length;
    ui.style.replaceChildren(
      h('div', { class: 'style-tabs', role: 'tablist', 'aria-label': 'Style' }, styleTabBtn('skin', 'Paint', nSkins), styleTabBtn('sticker', 'Stickers', nStickers)),
      ...list.map((c) => chip(styleTab, c, car, owned, (styleTab === 'skin' ? eq.skin : eq.sticker) === c.id)));
    ui.style.scrollLeft = keep;
    canvas.dataset.lookSkin = eq.skin; canvas.dataset.lookSticker = eq.sticker;
  }

  // the "Sky rides" row (Sky era only): one chip per ride, owned ones ticked
  function renderRides() {
    const sky = currentEra(app.save) === 'sky' && skyUnlocked(app.save) && skyRides().length > 0;
    ui.rides.hidden = !sky;
    ui.rides.replaceChildren();
    if (!sky) return;
    ui.rides.append(h('span', { class: 'sr-label' }, 'Sky rides'));
    for (const r of skyRides()) {
      const own = isOwned(app.save, r.id), on = CARS_NOW[index] && CARS_NOW[index].id === r.id;
      const b = h('button', { class: 'sr-chip' + (own ? ' owned' : '') + (on ? ' on' : ''), 'data-ride': r.id, 'data-sfx': '', 'aria-pressed': String(!!on),
        'aria-label': `${r.name}${own ? ', yours' : ', $' + money(r.price)}` }, own ? h('span', { html: icon('check') }) : null, r.name);
      b.addEventListener('click', () => { const i = CARS_NOW.findIndex((c) => c.id === r.id); if (i >= 0) { slide = i > index ? 1 : -1; index = i; t0 = performance.now(); render(); } });
      ui.rides.append(b);
    }
  }

  function render() {
    const s = app.save;
    syncList();
    if (index >= CARS_NOW.length) index = 0;
    const car = CARS_NOW[index];
    const owned = isOwned(s, car.id);
    ui.name.textContent = car.name;
    ui.tag.textContent = car.tagline;
    ui.tier.innerHTML = '';
    for (let i = 1; i <= MAX_TIER; i++) ui.tier.append(h('i', { class: i <= car.tier ? 'on' : '' }));
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
    renderRides();
    app.refreshCash();
    paint();
  }

  function paint() {
    const now = performance.now();
    const rm = app.save.settings.reducedMotion;
    const k = rm ? 1 : Math.min(1, (now - t0) / 280);
    const ease = 1 - Math.pow(1 - k, 3);
    const look = app.look ? app.look(CARS_NOW[index].id) : lookFor(app.save, CARS_NOW[index].id);   // v3.9: the Lab's skin / sticker over the garage's
    drawCar(canvas, CARS_NOW[index], {
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
      syncList();
      index = Math.max(0, CARS_NOW.findIndex((c) => c.id === app.save.selectedCar));
      // Sky era with no ride bought yet: the shop window opens on the first ride
      if (currentEra(app.save) === 'sky' && skyUnlocked(app.save) && skyRides().length && !skyRides().some((r) => isOwned(app.save, r.id))) index = 0;
      slide = 0;
      render();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    hide() { cancelAnimationFrame(raf); raf = 0; },
    render,
  };
}

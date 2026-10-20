// The crate moment (SPEC v1.5 §4): the oldest waiting crate on a card, "Tap to open"; a tap shakes it (a rattle),
// bursts it open and shows what was inside: the item with "NEW!" (and "Wear it" for gear), or "+$" when the player
// already has everything that crate could drop. "Open next" while more wait; closing never loses a crate (they wait
// in save.crates.queue for the results or the Garage Wall). Opened from the results and the Garage Wall.
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { KIND_NAME, itemOf } from '../data/cosmetics.js';
import { PAINT_BY_ID } from '../data/paints.js';
import { equip, openCrate } from '../meta/crates.js';
import { ownsDecal, ownsPaint, tierOfVehicle } from '../meta/economy.js';
import { itemSwatch } from './items.js';

const KIND_ONE = { helmet: 'Helmet', suit: 'Suit', horn: 'Horn', trail: 'Boost trail', flag: 'Flag', paint: 'Paint', decal: 'Decal' };
const TIER_LABEL = { bronze: 'Bronze crate', silver: 'Silver crate', gold: 'Gold crate' };

export function createCrateOpener(app) {
  const ov = $('#crate');
  let busy = false, onClose = null, timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const raceOwned = (it) => (it.kind === 'paint' ? ownsPaint(app.save, app.trails, it.id) : it.kind === 'decal' ? ownsDecal(app.save, it.id) : false);

  function close() {
    timers.forEach(clearTimeout); timers = [];
    ov.hidden = true; ov.replaceChildren(); busy = false;
    const cb = onClose; onClose = null;
    if (cb) cb();
  }
  function crateBox(tier) {
    return h('div', { class: `crate-box t-${tier}`, 'aria-hidden': 'true' }, h('i', { class: 'cb-lid' }), h('i', { class: 'cb-band' }), h('i', { class: 'cb-lock' }));
  }
  function showClosed() {
    const s = app.save;
    const tier = s.crates.queue[0];
    if (!tier) { close(); return; }
    const left = s.crates.queue.length;
    const box = crateBox(tier);
    const stage = h('button', { class: 'crate-stage', id: 'crate-open', 'data-sfx': '', 'aria-label': `Open the ${TIER_LABEL[tier]}` }, box, h('span', { class: 'crate-tap' }, 'Tap to open'));
    stage.addEventListener('click', () => burst(stage, box));
    ov.replaceChildren(h('div', { class: 'card crate-card', 'data-tier': tier, 'data-state': 'closed' },
      h('h3', { class: 'crate-title' }, TIER_LABEL[tier] + '!'),
      left > 1 ? h('p', { class: 'crate-sub' }, `${left} crates waiting`) : null,
      stage,
      h('div', { class: 'crate-actions' }, h('button', { class: 'btn btn-sm', id: 'crate-later', 'data-sfx': '' }, 'Later'))));
    $('#crate-later', ov).addEventListener('click', close);
  }
  function burst(stage, box) {
    if (busy) return;
    busy = true;
    const rm = app.settings.reducedMotion;
    box.classList.add('shake');
    app.sfx.rattle();
    later(() => {
      const out = openCrate(app.save, { vehicleTier: tierOfVehicle(app.vehicles, app.save.vehicle), raceOwned });
      app.persist();
      app.refreshCash();
      if (!out) { close(); return; }
      box.classList.remove('shake'); box.classList.add('open');
      app.sfx.burst();
      if (out.kind === 'cash') app.audio.cash(); else setTimeout(() => app.audio.fanfare(), 150);
      later(() => reveal(out), rm ? 0 : 380);
    }, rm ? 0 : 650);
  }
  function reveal(out) {
    busy = false;
    const s = app.save;
    const it = out.item;
    const left = s.crates.queue.length;
    const gear = it && ['helmet', 'suit', 'horn', 'trail', 'flag', 'paint', 'decal'].includes(it.kind);
    const prize = out.kind === 'item'
      ? h('div', { class: `crate-prize r-${it.rarity}`, 'data-item': `${it.kind}:${it.id}` },
        itemSwatch(it.kind, it.id, 'big'),
        h('div', { class: 'cp-text' }, h('small', {}, `${KIND_ONE[it.kind]} · ${it.rarity}`), h('b', {}, it.name)),
        h('span', { class: 'new-badge' }, 'NEW!'))
      : h('div', { class: 'crate-prize cash', 'data-cash': String(out.cash) }, h('b', { class: 'cp-cash' }, '+$' + money(out.cash)), h('small', {}, 'You have everything in this crate!'));
    const sets = (out.setDone || []).map((x) => h('p', { class: 'crate-set', 'data-set': x.kind }, `${KIND_NAME[x.kind]} set complete! New paint: ${(PAINT_BY_ID[x.paint] || {}).name || x.paint}`));
    const actions = [];
    if (gear) {
      const wear = h('button', { class: 'btn btn-sm btn-green', id: 'crate-wear', 'data-sfx': '' }, { horn: 'Use it', paint: 'Paint it', decal: 'Stick it on' }[it.kind] || 'Wear it');
      wear.addEventListener('click', () => {
        if (it.kind === 'paint') s.paint = it.id; else if (it.kind === 'decal') s.decal = it.id; else equip(s, it.kind, it.id);
        if (it.kind === 'horn') app.sfx.horn((itemOf('horn', it.id) || {}).notes);
        app.persist(); app.onLookChanged();
        wear.disabled = true; wear.textContent = 'On!';
      });
      actions.push(wear);
    }
    const next = h('button', { class: 'btn btn-sm btn-orange', id: left ? 'crate-next' : 'crate-done', 'data-sfx': '' }, left ? `Open next (${left})` : 'Done');
    next.addEventListener('click', () => (left ? showClosed() : close()));
    actions.push(next);
    const tier = out.tier;
    ov.replaceChildren(h('div', { class: 'card crate-card', 'data-tier': tier, 'data-state': 'open' },
      h('h3', { class: 'crate-title' }, out.kind === 'item' ? 'Something new!' : 'Cash!'),
      h('div', { class: 'crate-stage opened' }, h('div', { class: 'crate-rays', 'aria-hidden': 'true' }), prize),
      ...sets,
      h('div', { class: 'crate-actions' }, ...actions)));
    if (it && it.kind === 'horn') app.sfx.horn((itemOf('horn', it.id) || {}).notes);
  }
  return {
    /** Open the waiting crates (nothing when none wait). cb runs when the overlay closes. */
    open(cb) {
      if (!app.save.crates.queue.length) { if (cb) cb(); return false; }
      onClose = cb || null;
      ov.hidden = false;
      showClosed();
      return true;
    },
    close,
    get isOpen() { return !ov.hidden; },
  };
}

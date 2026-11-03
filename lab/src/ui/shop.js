// The shop (lab/SPEC.md §5.3): tabs by owner (Me, Home, then the five games), item cards with a preview, name, rarity chip, price and a state:
// Equip / Equipped, Buy (two taps: "Yes, buy" for four seconds with no clock shown, then it resets itself), "Need 120 more", a gift that says how
// it is earned, or "Opens at level 8". Nothing a child can regret is one tap away. A game whose items are not ready shows none.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { OWNER_NAMES, SLOT_BY_KEY } from '../data/catalog.js';
import { RARITY_NAMES } from '../data/crate.js';
import { shelf } from '../core/shop.js';
import { LAB_LINES } from '../core/view.js';
import { COIN, gameBadge, glyph } from './glyph.js';
import { itemPreview, loadGameLooks } from './items.js';

export const SHOP_TABS = [['me', 'Me', ['av', 'pet']], ['home', 'Home', ['home']], ['sj', 'Spell Jump', ['sj']], ['tb', 'Trail Blazer', ['tb']], ['ff', 'Fraction Fright', ['ff']], ['ww', 'Wagon West', ['ww']], ['bc', 'Build Crew', ['bc']]];
const IN_ROOM = new Set(['home.shelf', 'home.banner']);
const REASONS = { owned: 'You have this one.', unknown: 'Not here.', notready: 'Coming soon.', gift: 'This one is a gift.', locked: 'This slot opens later.' };

export function mountShop(ctx, params = {}) {
  const { store } = ctx;
  let tab = params.tab || ctx.shopTab || 'me', confirm = '', confirmTimer = 0, fresh = '', dead = false, msg = '';
  if (!SHOP_TABS.some((t) => t[0] === tab)) tab = 'me';
  const tabs = h('div', { class: 'lab-seg lab-shop-tabs', role: 'tablist', 'aria-label': 'Shop' });
  const body = h('div', { class: 'lab-shop-body' });
  const el = h('div', { class: 'lab-shop' }, tabs, body);

  const clearConfirm = () => { clearTimeout(confirmTimer); confirm = ''; };
  function setConfirm(id) { clearConfirm(); confirm = id; confirmTimer = setTimeout(() => { confirm = ''; if (!dead) update(); }, 4000); }

  function hookFor(item, v) {
    if (item.slot !== 'poster') return item.key;
    return v.equipped['home.poster'] ? 'home.poster2' : 'home.poster';
  }
  function card(it, v) {
    const slot = SLOT_BY_KEY[it.key] || {};
    const equippable = !slot.noEquip && !IN_ROOM.has(it.key);
    const act = h('div', { class: 'lab-card-act' });
    let sub = null;
    if (it.state === 'owned') {
      if (slot.noEquip) {
        sub = h('span', { class: 'lab-state ok' }, h('span', { html: glyph('check') }), 'Yours');
        if (it.owner === 'bc' && !/^\/build-crew\//.test(location.pathname)) act.append(h('a', { class: 'lab-btn lab-btn-sm', href: '/build-crew/', id: 'see-bc' }, 'See it in Build Crew'));
      } else if (!equippable) sub = h('span', { class: 'lab-state ok' }, h('span', { html: glyph('check') }), 'In your room');
      else {
        const b = h('button', { class: 'lab-btn lab-btn-sm ' + (it.equipped ? 'lab-btn-on' : 'lab-btn-go'), type: 'button', 'data-act': it.equipped ? 'off' : 'equip', 'aria-pressed': String(it.equipped) }, it.equipped ? 'Equipped' : 'Equip');
        b.addEventListener('click', () => {
          const ok = it.equipped ? store.equip(it.poster || it.key, null) : store.equip(hookFor(it, v), it.id);
          if (ok) ctx.sfx('correct');
          update();
        });
        act.append(b);
      }
    } else if (it.state === 'gift') sub = h('span', { class: 'lab-state gift' }, h('span', { html: glyph('sparkle') }), `Gift: ${it.how || 'a surprise'}`);
    else if (it.state === 'locked') sub = h('span', { class: 'lab-state locked' }, h('span', { html: glyph('lock') }), `Opens at level ${it.opensAt}`);
    else if (it.state === 'poor') {
      sub = h('span', { class: 'lab-state poor' }, `Need ${ctx.num(it.need)} more`);
      act.append(h('button', { class: 'lab-btn lab-btn-sm', type: 'button', disabled: true, 'data-act': 'poor' }, h('span', { html: COIN }), ctx.num(it.price)));
    } else {
      if (confirm === it.id) {
        const yes = h('button', { class: 'lab-btn lab-btn-sm lab-btn-go', type: 'button', 'data-act': 'confirm' }, 'Yes, buy');
        const no = h('button', { class: 'lab-btn lab-btn-sm', type: 'button', 'data-act': 'cancel', 'aria-label': 'Not now' }, 'Not now');
        yes.addEventListener('click', () => {
          clearConfirm();
          const r = store.buy(it.id);
          if (r.ok) { fresh = it.id; msg = ''; ctx.sfx('cash'); ctx.toast(LAB_LINES.gotItem(it.name), { say: true }); }
          else msg = r.reason === 'coins' ? LAB_LINES.needMore(ctx.num(r.need)) : REASONS[r.reason] || 'Not now.';
          update();
        });
        no.addEventListener('click', () => { clearConfirm(); update(); });
        act.append(yes, no);
      } else {
        const b = h('button', { class: 'lab-btn lab-btn-sm lab-btn-gold', type: 'button', 'data-act': 'buy' }, h('span', { html: COIN }), `Buy ${ctx.num(it.price)}`);
        b.addEventListener('click', () => { ctx.sfx('click'); setConfirm(it.id); update(); });
        act.append(b);
      }
    }
    const prev = h('button', { class: 'lab-card-prev', type: 'button', 'aria-label': `Hear the name: ${it.name}` }, itemPreview(it, 76, { color: v.player.color, species: v.pet.species }));
    prev.addEventListener('click', () => ctx.say(it.name));
    return h('article', { class: `lab-card lab-item s-${it.state}` + (confirm === it.id ? ' confirming' : '') + (fresh === it.id ? ' fresh' : ''), 'data-item': it.id, 'data-state': it.state },
      prev,
      h('div', { class: 'lab-item-body' },
        h('div', { class: 'lab-item-name' }, it.name, fresh === it.id ? h('span', { class: 'lab-new' }, LAB_LINES.newItem) : null),
        h('div', { class: 'lab-item-meta' }, h('span', { class: `lab-rarity r-${it.rarity}` }, RARITY_NAMES[it.rarity] || '')),
        sub),
      act);
  }
  function update() {
    if (dead) return;
    const v = store.view(); if (!v) return;
    const doc = store.doc();
    tabs.replaceChildren(...SHOP_TABS.map(([id, label]) => {
      const b = h('button', { class: 'lab-seg-btn' + (id === tab ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': String(id === tab), 'data-tab': id }, ['sj', 'tb', 'ff', 'ww', 'bc'].includes(id) ? h('span', { html: gameBadge(id, 20) }) : null, label);
      b.addEventListener('click', () => { tab = id; ctx.shopTab = id; clearConfirm(); fresh = ''; msg = ''; update(); });
      return b;
    }));
    const owners = SHOP_TABS.find((t) => t[0] === tab)[2];
    const kids = [];
    if (tab === 'bc') kids.push(h('div', { class: 'lab-shop-head' }, h('b', {}, 'New in Build Crew'), h('span', {}, 'New machines and blueprints. Everything you already build with stays open.')));
    let any = false;
    for (const owner of owners) {
      const items = shelf(doc, { game: owner, ready: store.ready, level: v.level.level }).map((i) => (i.slot === 'poster' ? { ...i, poster: v.equipped['home.poster'] === i.id ? 'home.poster' : 'home.poster2' } : i));
      if (!items.length) continue;
      any = true;
      // group by slot with a heading each
      const groups = [];
      for (const it of items) { const g = groups[groups.length - 1]; if (g && g.key === it.key) g.items.push(it); else groups.push({ key: it.key, owner, items: [it] }); }
      for (const g of groups) {
        const s = SLOT_BY_KEY[g.key] || {};
        kids.push(h('h4', { class: 'lab-slot-h' }, `${owner === 'pet' ? 'Pet ' : ''}${owner === 'pet' ? String(s.label || '').toLowerCase() : s.label || ''}`, s.open > 1 ? h('span', { class: 'lab-slot-open' }, v.level.level >= s.open ? '' : `Opens at level ${s.open}`) : null));
        kids.push(h('div', { class: 'lab-grid' }, ...g.items.map((it) => card(it, v))));
      }
    }
    if (!any) kids.push(h('p', { class: 'lab-empty', id: 'shop-empty' }, tab === 'bc' || ['sj', 'tb', 'ff', 'ww'].includes(tab) ? `New looks for ${OWNER_NAMES[tab]} are on the way.` : 'Nothing here yet.'));
    if (msg) kids.push(h('p', { class: 'lab-small', role: 'status' }, msg));
    body.replaceChildren(...kids);
  }
  loadGameLooks().then(() => { if (!dead) update(); });
  update();
  return { el, update, destroy() { dead = true; clearConfirm(); } };
}

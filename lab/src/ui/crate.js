// The crate (lab/SPEC.md §5.3): the closed crate waits; a tap shakes it, the lid flies, the item rises out. The odds are NOT shown here (they are
// in Grown-ups). "New!" or "You already had it: +150 coins". Reduced motion: no shake, a fade. Cosmetics and coin refunds only; nothing to buy.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { ITEM_BY_ID, SLOT_BY_KEY } from '../data/catalog.js';
import { RARITY_NAMES } from '../data/crate.js';
import { LAB_LINES } from '../core/view.js';
import { CRATE_ART, COIN, glyph } from './glyph.js';
import { itemPreview } from './items.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function mountCrate(ctx) {
  const { store } = ctx;
  let phase = 'idle', result = null, busy = false, dead = false, worn = false;
  const stage = h('div', { class: 'lab-crate-stage' });
  const info = h('div', { class: 'lab-crate-info' });
  const el = h('div', { class: 'lab-crate-view' }, stage, info);

  function rays(rarity) {
    return h('div', { class: `lab-rays r-${rarity}`, 'aria-hidden': 'true' }, ...Array.from({ length: 14 }, (_, i) => h('i', { style: { '--a': `${(360 / 14) * i}deg`, '--d': `${(i % 4) * 40}ms` } })));
  }
  function revealCard() {
    const r = result, item = r.id ? ITEM_BY_ID[r.id] : null;
    const v = store.view();
    const slotKey = item ? item.key : '';
    const slot = SLOT_BY_KEY[slotKey];
    const slotOpenNow = (() => {
      if (!item || !slot || slot.noEquip) return false;
      if (item.owner === 'av') return !!(v.avatar.slots[item.slot] || {}).open;
      if (item.owner === 'pet') return !!(v.pet.slots[item.slot] || {}).open;
      if (item.owner === 'home') return v.level.level >= slot.open;
      return true;
    })();
    const equippable = !!item && slotOpenNow;
    const art = item ? itemPreview(item, 128, { color: v.player.color, species: v.pet.species }) : h('span', { class: 'lab-bigcoin', html: COIN });
    const card = h('div', { class: `lab-reveal r-${r.rarity}`, role: 'group', 'aria-label': 'Crate' },
      rays(r.rarity),
      h('div', { class: 'lab-reveal-art' }, art),
      h('span', { class: `lab-rarity r-${r.rarity}` }, RARITY_NAMES[r.rarity] || ''),
      h('h3', { class: 'lab-reveal-name', id: 'crate-name' }, item ? item.name : `+${r.coins} Lab coins`),
      h('p', { class: 'lab-reveal-note', id: 'crate-note' }, item ? LAB_LINES.newItem : `You already had it: +${ctx.num(r.coins)} Lab coins`));
    return { card, equippable, item, slotKey };
  }
  function render() {
    const v = store.view(); if (!v) return;
    const waiting = v.crates.waiting;
    stage.className = `lab-crate-stage ${phase}`;
    if (phase === 'reveal' && result) {
      const { card, equippable, item, slotKey } = revealCard();
      stage.replaceChildren(card);
      const btns = [];
      if (equippable && !worn) {
        const w = h('button', { class: 'lab-btn lab-btn-go', type: 'button', id: 'crate-wear' }, 'Wear it');
        w.addEventListener('click', () => { const key = slotKey === 'home.poster' ? (v.home.posters.length >= 1 ? 'home.poster2' : 'home.poster') : slotKey; if (store.equip(key, item.id)) { worn = true; ctx.sfx('cash'); } render(); });
        btns.push(w);
      } else if (worn) btns.push(h('span', { class: 'lab-note-ok', role: 'status' }, 'Now wearing it'));
      if (waiting > 0) {
        const nx = h('button', { class: 'lab-btn lab-btn-gold', type: 'button', id: 'crate-next' }, 'Next crate');
        nx.addEventListener('click', () => { phase = 'idle'; result = null; worn = false; render(); });
        btns.push(nx);
      } else {
        const dn = h('button', { class: 'lab-btn', type: 'button', id: 'crate-done' }, 'Nice!');
        dn.addEventListener('click', () => { phase = 'idle'; result = null; worn = false; ctx.go('home'); });
        btns.push(dn);
      }
      info.replaceChildren(h('div', { class: 'lab-btn-row' }, ...btns));
      return;
    }
    const closed = h('button', { class: 'lab-crate-btn', type: 'button', id: 'crate-open', 'aria-label': waiting > 0 ? 'Open the crate' : 'The crate', disabled: waiting < 1 || busy }, h('span', { class: 'lab-crate-art', html: CRATE_ART }));
    closed.addEventListener('click', open);
    stage.replaceChildren(closed);
    if (waiting > 0) {
      info.replaceChildren(h('h3', { class: 'lab-h' }, LAB_LINES.crate), h('p', { class: 'lab-crate-tx' }, waiting === 1 ? 'Tap the crate to open it.' : `${waiting} crates are waiting. Tap to open one.`));
    } else {
      const n = v.quests.length, done = v.questsDone;
      info.replaceChildren(...[h('h3', { class: 'lab-h' }, 'Lab crate'),
        h('p', { class: 'lab-crate-tx' }, v.opts.quests === false ? 'Crates come from quests.' : 'Finish all three quests to earn a crate.'),
        n ? h('div', { class: 'lab-pips big' }, ...v.quests.map((q) => h('i', { class: q.done ? 'on' : '' }))) : null].filter(Boolean));
    }
  }
  async function open() {
    if (busy || dead) return;
    const v = store.view(); const key = v && v.crates.nextKey; if (!key) return;
    busy = true; phase = 'shake'; render(); ctx.sfx('crateOpen');
    await wait(ctx.reduced ? 250 : 1000);
    if (dead) return;
    const r = store.openCrate(key);
    busy = false; worn = false;
    if (!r) { phase = 'idle'; render(); return; }
    result = r; phase = 'reveal'; render();
    ctx.sfx(r.rarity === 'c' ? 'trophy' : 'levelUp');
    const item = r.id ? ITEM_BY_ID[r.id] : null;
    ctx.say(item ? LAB_LINES.gotItem(item.name) : LAB_LINES.alreadyHad(r.coins));
  }
  function update() {
    if (phase === 'shake') return;
    if (phase === 'reveal') return;       // the reveal stays while the store settles
    render();
  }
  render();
  return { el, update, destroy() { dead = true; } };
}

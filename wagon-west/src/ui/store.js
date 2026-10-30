// The General Store (SPEC §3, §12): at Independence before the first leg and at every fort. The goods with the
// fort's prices (storeList from the Journey stream), the wagon's food and cash; tapping a good asks the shopkeeper's
// word problem on the problem panel (main.js app.storeBuy: a 'buy' or a 'divide' problem made from a fact on the
// child's ladder), and the goods come at the fair price whatever the answer (the math earns the trade token, never the
// supplies). "Done shopping" leaves (on to the post office at a fort, onto the trail at Independence).
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';

export function createStore(app) {
  const grid = $('#store-goods');
  const side = $('#store-side');
  const doneBtn = $('#store-done');
  let ctx = null;      // { leg, place, resolve, nextText }
  let busy = false;
  function paint() {
    if (!ctx) return;
    const J = app.save.journey;
    $('#store-title').textContent = `General Store · ${ctx.place}`;
    const goods = app.storeGoods(ctx.leg);
    grid.replaceChildren(...goods.map((g) => {
      const b = h('button', { class: 'card st-good', 'data-good': g.item || g.id, 'data-sfx': '', disabled: busy },
        h('span', { class: 'st-emoji', 'aria-hidden': 'true' }, g.emoji || '📦'),
        h('span', { class: 'st-name' }, g.name),
        h('span', { class: 'st-price' }, `$${money(g.price)} a ${g.unit || 'one'}`));
      b.addEventListener('click', async () => {
        if (busy) return;
        busy = true; paint();
        try { await app.storeBuy(g, ctx.leg); } finally { busy = false; paint(); }
      });
      return b;
    }));
    const days = app.foodDays();
    side.replaceChildren(
      h('div', { class: 'st-stat' }, h('span', {}, 'Cash'), h('b', { id: 'store-cash' }, `$${money(J.cash)}`)),
      h('div', { class: 'st-stat' }, h('span', {}, 'Food'), h('b', { id: 'store-food' }, `${money(J.food)} lb`), h('small', {}, days != null ? `about ${days} days at ${J.rations || 'plenty'} rations` : '')),
      h('div', { class: 'st-stat' }, h('span', {}, 'Trade tokens'), h('b', { id: 'store-tokens' }, String(J.tokens || 0)), h('small', {}, 'a right first answer earns one')),
      app.foodHint() ? h('p', { class: 'st-note', id: 'store-hint' }, app.foodHint()) : null,
      h('p', { class: 'st-note' }, 'Tap a good: the shopkeeper asks one question, then it is yours at the fair price.'));
    doneBtn.querySelector('.bt-label').textContent = ctx.nextText;
    doneBtn.disabled = busy;
  }
  doneBtn.addEventListener('click', () => { if (!ctx || busy) return; const c = ctx; ctx = null; c.resolve(true); });
  return {
    /** Open the store; resolves when the child is done shopping. { leg, place, nextText } */
    open({ leg, place, nextText = 'Done shopping' }) {
      if (ctx) ctx.resolve(false);
      return new Promise((resolve) => { ctx = { leg, place, nextText, resolve }; app.go('store'); });
    },
    show() { paint(); },
    hide() {},
    refresh: paint,
    get isOpen() { return !!ctx; },
    get busy() { return busy; },
    leave() { if (ctx) { const c = ctx; ctx = null; c.resolve(false); } },
  };
}

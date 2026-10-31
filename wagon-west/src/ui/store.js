// The General Store (SPEC §3, §12; v1.2 §5 "the store without a gate"): at Independence before the first leg and at every
// fort. A row per good with the fort's price (storeList from the Journey stream): TAP the good and one unit is yours at
// the listed price (the cash box in view; a buy the box cannot cover is greyed and says "Earn $N more"), no question
// first. Each row also has "Work it out": the shopkeeper's word problem (main.js app.storeBuy: a 'buy' or a 'divide'
// problem made from a fact on the child's ladder) for a trade token on a first-try right; the goods then come at the
// fair price whatever the answer. The hint "you'll need about N lb to reach Fort Laramie" is always shown, and the
// yoke, parts, rope, blankets and arrows rows say in one line what each does. "Done shopping" leaves (on to the post
// office at a fort, onto the trail at Independence).
// v1.1: at a fort, "Race the mail wagon" (Fort Derby, once per fort visit: main.js app.runDerby) sits under the stats.
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';

/** One line on what each good is for (the foods say what a unit holds). */
export const WHAT = Object.freeze({
  flour: 'A sack of flour: 50 lb of food for the party.',
  bacon: 'A side of bacon: 20 lb of food for the party.',
  beans: 'A bag of beans: 25 lb of food for the party.',
  parts: 'Spare parts mend a broken wheel, axle or tongue.',
  rope: 'Rope keeps the sacks dry when you float a river.',
  blankets: 'Blankets for cold nights: one for every two people.',
  arrows: 'Arrows for the bow: a hunt uses five.',
  yoke: 'A second yoke: four animals pull, three more miles a day, and they tire slower.',
});
const EMOJI = { yoke: '🐂', parts: '⚙️', rope: '🪢', blankets: '🧣', arrows: '🏹' };
const UNIT_PLURAL = { sack: 'sacks', side: 'sides', bag: 'bags', set: 'sets', coil: 'coils', blanket: 'blankets', bundle: 'bundles', yoke: 'yokes' };

export function createStore(app) {
  const grid = $('#store-goods');
  const side = $('#store-side');
  const doneBtn = $('#store-done');
  let ctx = null;      // { leg, place, resolve, nextText, derby }
  let busy = false;
  function paint() {
    if (!ctx) return;
    const J = app.save.journey;
    $('#store-title').textContent = `General Store · ${ctx.place}`;
    const goods = app.storeGoods(ctx.leg);
    const cash = Math.floor(Number(J.cash) || 0);
    grid.replaceChildren(...goods.map((g) => {
      const id = g.item || g.id;
      const price = Math.max(1, Math.round(Number(g.price) || 1));
      const have = app.have(id);
      const owned = id === 'yoke' && have.n >= 1;
      const poor = !owned && cash < price;
      const haveText = id === 'yoke' ? (owned ? 'on the wagon' : 'not yet') : have.n > 0 ? `${have.n}${id === 'arrows' ? ' arrows' : ''} in the wagon` : 'none in the wagon';
      const cta = owned ? 'On the wagon' : poor ? `Earn $${money(price - cash)} more` : 'Tap to buy one';
      const buy = h('button', { class: 'st-good' + (poor ? ' poor' : ''), 'data-good': id, 'data-sfx': '', disabled: busy || owned || poor, 'aria-label': `${g.name}, $${money(price)} a ${g.unit || 'one'}. ${haveText}. ${cta}.` },
        h('span', { class: 'st-emoji', 'aria-hidden': 'true' }, g.emoji || EMOJI[id] || '📦'),
        h('span', { class: 'st-name' }, g.name),
        h('span', { class: 'st-price' }, `$${money(price)} a ${g.unit || 'one'}`),
        h('span', { class: 'st-have' }, haveText),
        h('span', { class: 'st-cta' }, cta));
      buy.addEventListener('click', () => {
        if (busy) return;
        const r = app.storeTap(g);
        if (!r.ok && r.reason === 'poor') app.toast(`Earn $${money(r.need)} more first`);
        paint();
      });
      const foot = h('div', { class: 'st-foot' }, h('p', { class: 'st-what' }, WHAT[id] || (g.lb ? `${g.lb} lb of food a ${g.unit}.` : '')));
      const row = h('div', { class: 'card st-row', 'data-row': id }, buy, foot);
      if (id !== 'yoke') {
        const work = h('button', { class: 'btn btn-sm st-work', 'data-good': id, 'data-sfx': '', disabled: busy }, 'Work it out');
        work.setAttribute('aria-label', `Work it out: the shopkeeper's question about ${(UNIT_PLURAL[g.unit] || g.name).toLowerCase()}, for a trade token`);
        work.addEventListener('click', async () => {
          if (busy) return;
          busy = true; paint();
          try { await app.storeBuy(g, ctx && ctx.leg); } finally { busy = false; if (ctx) paint(); }
        });
        foot.append(work);
      }
      return row;
    }));
    const days = app.foodDays();
    side.replaceChildren(...[
      h('div', { class: 'st-stat' }, h('span', {}, 'Cash'), h('b', { id: 'store-cash' }, `$${money(J.cash)}`)),
      h('div', { class: 'st-stat' }, h('span', {}, 'Food'), h('b', { id: 'store-food' }, `${money(J.food)} lb`), h('small', {}, days != null ? `about ${days} days at ${J.rations || 'plenty'} rations` : '')),
      h('div', { class: 'st-stat' }, h('span', {}, 'Trade tokens'), h('b', { id: 'store-tokens' }, String(J.tokens || 0)), h('small', {}, '"Work it out" earns one')),
      app.foodHint() ? h('p', { class: 'st-note', id: 'store-hint' }, app.foodHint()) : null,
      h('p', { class: 'st-note' }, 'Tap a good to buy one. "Work it out" is the shopkeeper\'s question, for a token.'),
      ctx.derby && app.derbyReady() ? derbyButton() : null].filter(Boolean));
    doneBtn.querySelector('.bt-label').textContent = ctx.nextText;
    doneBtn.disabled = busy;
  }
  function derbyButton() {
    const b = h('button', { class: 'btn btn-gold st-derby', id: 'store-derby', 'data-sfx': '', disabled: busy }, h('span', { 'aria-hidden': 'true' }, '🏁'), 'Race the mail wagon');
    b.addEventListener('click', async () => {
      if (busy || !ctx) return;
      busy = true; paint();
      const c = ctx;
      try { await app.runDerby(c.leg); } finally { busy = false; if (ctx === c && app.screen === 'store') paint(); }
    });
    return b;
  }
  doneBtn.addEventListener('click', () => { if (!ctx || busy) return; const c = ctx; ctx = null; c.resolve(true); });
  return {
    /** Open the store; resolves when the child is done shopping. { leg, place, nextText, derby (a fort: the race) } */
    open({ leg, place, nextText = 'Done shopping', derby = false }) {
      if (ctx) ctx.resolve(false);
      return new Promise((resolve) => { ctx = { leg, place, nextText, derby, resolve }; app.go('store'); });
    },
    show() { paint(); },
    hide() {},
    refresh: paint,
    get isOpen() { return !!ctx; },
    get busy() { return busy; },
    leave() { if (ctx) { const c = ctx; ctx = null; c.resolve(false); } },
  };
}

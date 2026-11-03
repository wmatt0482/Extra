// Results (SPEC §3 "Arriving", §12): the leg's three stars (arrived · everyone happy · every marker right, from the
// Journey stream's arrive()), the cash rows (arrival + stars = total; they always add up), the trade tokens earned on
// the leg, the sticker, and the crate (a gold crate on a 3-star leg, Trail Blazer's crate idea) opened with a tap. Then
// Camp (the title, the journey waits here), Journal, or Next leg. Stopping here is always fine.
// v1.2 (app two): "Deeds earned" lists the badges earned on the leg (result.deeds: ids; src/ui/deeds.js).
// v1.5: the tier's badge ("🧭 Veteran · 1849"), the bonus cards the tier pays, the gold found on a digging leg ("3 nuggets · 7 flakes"), a card set
// completed with the wagon decoration it unlocked, and, at a trail's end, the bank card ("+$74 in savings · 6 nuggets of Beaver money · 2 oxen to the
// pasture") with a button to the farm (result.bank / result.tier / result.gold / result.sets / result.bonus).
// v1.6 (The Lab): the Lab's strip sits under the pay lines (#res-lab, mounted by main.js through the bridge), and above the buttons is the cliffhanger: a card with
// the NEXT stop's painting, one true line (the first sentence of its lookout) and "Next time: the ferry at the Kansas River" (result.preview, journey/preview.js
// nextStopPreview). Nothing is locked ("Next leg" is always there); after the third leg finished on a local day (result.stopToday) the card adds "That's a good
// place to stop for today." At a trail's end there is no card.
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { CRATES, KIND_NAME, itemOf } from './looks.js';
import { deedChips } from './deeds.js';
import { CARD_BY_ID } from '../content/cards.js';
import { LEG_BY_ID } from '../content/legs.js';
import { STOP_LINE } from '../journey/preview.js';

/** The bank card's three parts: ["+$74 in savings", "6 nuggets of Beaver money", "2 oxen to the pasture"] (a part is left out when it is nothing). */
export function bankParts(bank, animalName = 'oxen', nuggetsOf = (f) => ({ nuggets: Math.floor(f / 10), flakes: f % 10 })) {
  if (!bank) return [];
  const out = [];
  if (bank.savings > 0) out.push(`+$${money(bank.savings)} in savings`);
  if (bank.flakes > 0) { const n = nuggetsOf(bank.flakes); out.push(n.nuggets ? `${n.nuggets} nugget${n.nuggets === 1 ? '' : 's'}${n.flakes ? ` and ${n.flakes} flake${n.flakes === 1 ? '' : 's'}` : ''} of Beaver money` : `${n.flakes} flake${n.flakes === 1 ? '' : 's'} of gold dust`); }
  if (bank.animals > 0) out.push(`${bank.animals} ${bank.animals === 1 ? animalName.replace(/s$/, '') : animalName} to the pasture`);
  if (bank.trophy) out.push(`A ${bank.trophy} plate for the trophy shelf`);
  return out;
}

const STAR_NAMES = ['Arrived', 'Everyone happy', 'Every marker right'];

export function createResults(app) {
  let R = null;
  function show(result) {
    if (result) R = result;
    if (!R) return;
    const r = R;
    $('#res-title').textContent = r.home ? (r.homeTitle || 'Home in the valley!') : `Arrived at ${r.place}!`;
    const badge = $('#res-tier');
    badge.hidden = !r.tier;
    if (r.tier) badge.replaceChildren(h('span', { 'aria-hidden': 'true' }, r.tier.emoji), h('span', {}, `${r.tier.name}${r.year ? ` · ${r.year}` : ''}`));
    badge.dataset.tier = r.tier ? r.tier.id : '';
    $('#res-stars').replaceChildren(...STAR_NAMES.map((name, i) => h('div', { class: 'rs-star' + (r.stars[i] ? ' on' : ''), 'data-star': String(i), 'aria-label': `${name}: ${r.stars[i] ? 'yes' : 'not this time'}` },
      h('span', { html: app.icon('star') }), h('small', {}, name))));
    const s = r.stats || {};
    $('#res-stats').replaceChildren(
      stat(`${s.markersRight || 0}/${s.markers || 0}`, 'Markers right', 'markers'),
      stat(`${s.problemsRight || 0}/${s.problems || 0}`, 'Problems right', 'problems'),
      stat(`${s.wordsRight || 0}/${s.words || 0}`, 'Words first try', 'words'),
      stat(`${money(r.food)} lb`, 'Food in the wagon', 'food'));
    const rows = [['arrival', `Arrived at ${r.place}`, r.cash.arrival], ['stars', `Stars (${r.stars.filter(Boolean).length})`, r.cash.stars]];
    $('#res-pay').replaceChildren(
      ...rows.map(([id, label, amount]) => h('tr', { 'data-row': id, 'data-amount': String(amount), class: amount ? '' : 'zero' }, h('td', {}, label), h('td', {}, `$${money(amount)}`))),
      h('tr', { class: 'total', 'data-amount': String(r.cash.total) }, h('td', {}, 'Total'), h('td', {}, `$${money(r.cash.total)}`)));
    $('#res-tokens').textContent = r.tokens ? `+${r.tokens} trade token${r.tokens > 1 ? 's' : ''} (right first answers)` : 'Trade tokens come from right first answers at the store.';
    const sticker = $('#res-sticker');
    sticker.hidden = !r.sticker;
    if (r.sticker) sticker.replaceChildren(h('span', { class: 'tc-emoji', 'aria-hidden': 'true' }, r.sticker.emoji || '★'), h('span', {}, `Sticker: ${r.sticker.name}`));
    const dd = $('#res-deeds');
    const earned = Array.isArray(r.deeds) ? r.deeds : [];
    dd.hidden = !earned.length;
    dd.replaceChildren(...(earned.length ? [h('b', {}, `Deed${earned.length > 1 ? 's' : ''} earned on this leg`), ...deedChips(earned)] : []));
    // v1.5: the gold of a digging leg, the tier's bonus cards, a set completed, the bank card
    const ex = $('#res-extra');
    const extra = [];
    if (r.goldFound) extra.push(h('div', { class: 'res-gold', id: 'res-gold', 'data-flakes': String(r.goldFound.total) }, h('span', { 'aria-hidden': 'true' }, '✨'), h('span', {}, `Gold in the pouch: ${r.goldFound.text}`)));
    if (Array.isArray(r.bonus) && r.bonus.length) extra.push(h('div', { class: 'res-bonus', id: 'res-bonus' }, h('b', {}, `Bonus card${r.bonus.length > 1 ? 's' : ''}`), ...r.bonus.map((id) => { const c = CARD_BY_ID[id]; return c ? h('span', { class: 'res-deed', 'data-card': id }, h('span', { 'aria-hidden': 'true' }, c.emoji), h('span', {}, c.name)) : null; })));
    for (const st of Array.isArray(r.sets) ? r.sets : []) extra.push(h('div', { class: 'res-set', 'data-set': st.id }, h('span', { 'aria-hidden': 'true' }, st.emoji || '🎖️'), h('span', {}, `A full set: ${st.name}! ${st.decorName ? `You earned the ${st.decorName}.` : ''}`)));
    if (r.bank) extra.push(h('div', { class: 'res-bank', id: 'res-bank' }, h('b', {}, 'Home! The wagon brings to the farm'), h('div', { class: 'rb-parts' }, ...bankParts(r.bank, r.animalName, r.nuggetsOf).map((t) => h('span', { class: 'rb-part' }, t)))));
    ex.hidden = !extra.length;
    ex.replaceChildren(...extra);
    paintCrate();
    paintPreview(r);
    $('#res-next-text').textContent = r.home ? (r.bank ? 'To the farm' : 'A new year') : 'Next leg';
    $('#res-next').dataset.action = r.home ? (r.bank ? 'farm' : 'season') : 'next';
  }
  /** The cliffhanger card (v1.6): the next stop's painting, its line, "Next time: …", and the day's gentle stop line. */
  function paintPreview(r) {
    const box = $('#res-preview'), p = r && r.preview;
    box.hidden = !p;
    if (!p) return;
    $('#res-pv-next').textContent = `Next time: ${p.phrase}`;
    $('#res-pv-line').textContent = p.line;
    const stop = $('#res-pv-stop');
    stop.hidden = !r.stopToday;
    stop.textContent = r.stopToday ? STOP_LINE : '';
    box.dataset.leg = p.legId;
    const cv = $('#res-pv-art'), dpr = Math.min(2, window.devicePixelRatio || 1), W = 176, H = 108;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const leg = LEG_BY_ID[p.legId];
    cv.dataset.state = 'pending';
    import('../scene/backdrops.js').then((m) => {
      if (!leg || box.hidden || box.dataset.leg !== p.legId) return;
      const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      cv.dataset.painting = m.drawStopCard(c, W, H, leg);
      cv.dataset.state = 'painted';
    }).catch(() => { cv.dataset.state = 'none'; });       // (no painting: the words are still there)
  }
  $('#res-pv-hear').addEventListener('click', () => { const p = R && R.preview; if (p) app.sayAll([p.sayPhrase, p.say, ...(R.stopToday ? [STOP_LINE] : [])]); });
  function stat(big, label, id) { return h('div', { class: 'stat', 'data-stat': id }, h('b', {}, big), h('span', {}, label)); }
  function paintCrate() {
    const box = $('#res-crate');
    const queue = app.save.crates.queue;
    if (R && R.opened) {
      const o = R.opened;
      const item = o.kind ? itemOf(o.kind, o.id) : null;
      box.hidden = false;
      box.replaceChildren(h('div', { class: 'rc-reveal', id: 'res-crate-reveal' },
        item && item.color && item.color !== 'transparent' ? h('i', { class: 'sw', style: { '--c': item.color } }) : h('span', { html: app.icon('crate') }),
        h('span', {}, o.kind ? `${KIND_NAME[o.kind]}: ${o.name}!` : `$${o.cash} from the crate`),
        o.kind ? h('small', {}, 'Wear it in Outfit → Look') : null));
      return;
    }
    box.hidden = !queue.length;
    if (!queue.length) { box.replaceChildren(); return; }
    const tier = queue[0];
    const b = h('button', { class: 'btn btn-gold', id: 'res-crate-open', 'data-sfx': '' }, h('span', { html: app.icon('crate') }), `Open the ${CRATES[tier].name.toLowerCase()}`);
    b.addEventListener('click', () => { const o = app.openCrate(); if (!o) return; R.opened = o; paintCrate(); app.refreshCash(); });
    box.replaceChildren(...[b, queue.length > 1 ? h('small', {}, `${queue.length - 1} more waiting`) : null].filter(Boolean));
  }
  $('#res-camp').addEventListener('click', () => app.go('title'));
  $('#res-journal').addEventListener('click', () => app.go('journal'));
  $('#res-next').addEventListener('click', () => { const a = $('#res-next').dataset.action; if (a === 'season') app.newSeason(); else if (a === 'farm') app.arriveFarm(); else app.hitTrail(); });
  return { show, hide() {}, get last() { return R; } };
}

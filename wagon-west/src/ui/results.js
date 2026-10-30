// Results (SPEC §3 "Arriving", §12): the leg's three stars (arrived · everyone happy · every marker right, from the
// Journey stream's arrive()), the cash rows (arrival + stars = total; they always add up), the trade tokens earned on
// the leg, the sticker, and the crate (a gold crate on a 3-star leg, Trail Blazer's crate idea) opened with a tap. Then
// Camp (the title, the journey waits here), Journal, or Next leg. Stopping here is always fine.
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { CRATES, KIND_NAME, itemOf } from './looks.js';

const STAR_NAMES = ['Arrived', 'Everyone happy', 'Every marker right'];

export function createResults(app) {
  let R = null;
  function show(result) {
    if (result) R = result;
    if (!R) return;
    const r = R;
    $('#res-title').textContent = r.home ? 'Home in the valley!' : `Arrived at ${r.place}!`;
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
    paintCrate();
    $('#res-next-text').textContent = r.home ? 'A new season' : 'Next leg';
    $('#res-next').dataset.action = r.home ? 'season' : 'next';
  }
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
    box.replaceChildren(b, queue.length > 1 ? h('small', {}, `${queue.length - 1} more waiting`) : null);
  }
  $('#res-camp').addEventListener('click', () => app.go('title'));
  $('#res-journal').addEventListener('click', () => app.go('journal'));
  $('#res-next').addEventListener('click', () => { if ($('#res-next').dataset.action === 'season') app.newSeason(); else app.hitTrail(); });
  return { show, hide() {}, get last() { return R; } };
}

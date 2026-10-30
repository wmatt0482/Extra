// The journal (SPEC §3 "the kid-facing record", §12): three pages. Letters: every letter home, newest first, each with
// "Read it to me" (the voice reads it back). Stickers: one per stop of the trail (the landmark's emoji and name once
// earned, a faint outline before), every season counting. The map: the whole trail with every stop named and the
// party's wagon where it is.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { drawMap } from './map.js';

const PAGES = [['letters', 'Letters'], ['stickers', 'Stickers'], ['map', 'Map']];

export function createJournal(app) {
  const tabs = $('#jr-tabs');
  const body = $('#jr-body');
  let page = 'letters';
  function renderTabs() {
    tabs.replaceChildren(...PAGES.map(([id, text]) => {
      const b = h('button', { class: 'seg-btn' + (page === id ? ' on' : ''), role: 'tab', 'aria-selected': String(page === id), 'data-page': id, 'data-sfx': '' }, text);
      b.addEventListener('click', () => { page = id; render(); });
      return b;
    }));
  }
  const dateOf = (at) => (at ? new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
  function letters() {
    const list = app.save.letters.slice().reverse();
    if (!list.length) return [h('div', { class: 'jr-empty', id: 'jr-empty' }, 'No letters yet. The first fort has a post office: write home from there.')];
    return list.map((l, i) => {
      const leg = app.legById(l.leg);
      const read = h('button', { class: 'btn btn-sm jr-read', 'data-letter': String(i), 'data-sfx': '' }, h('span', { html: app.icon('sound') }), 'Read it to me');
      read.addEventListener('click', () => app.say(app.spoken(l.text)));
      return h('article', { class: 'card jr-letter', 'data-at': String(l.at) },
        h('div', { class: 'jr-letter-head' }, h('b', {}, leg ? (leg.stop && leg.stop.name) || leg.name : 'On the trail'), h('small', {}, dateOf(l.at)), read),
        h('div', { class: 'jr-letter-text' }, ...l.text.split('\n').map((t) => h('p', {}, t))));
    });
  }
  function stickers() {
    const got = new Set(app.save.stickers);
    return [h('div', { class: 'jr-stickers', id: 'jr-stickers' }, ...app.legs.map((l) => {
      const s = l.sticker || { id: l.id, name: l.name, emoji: '★' };
      const have = got.has(s.id);
      return h('div', { class: 'jr-sticker' + (have ? ' got' : ''), 'data-sticker': s.id, 'aria-label': have ? s.name : `${s.name}: not yet` },
        h('span', { class: 'jr-emoji', 'aria-hidden': 'true' }, have ? s.emoji : '?'), h('small', {}, s.name));
    })), h('p', { class: 'jr-note' }, `${got.size} of ${app.legs.length} stickers${app.save.seasonsDone ? ` · ${app.save.seasonsDone} season${app.save.seasonsDone > 1 ? 's' : ''} finished` : ''}`)];
  }
  function map() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'jr-map');
    svg.setAttribute('role', 'img');
    const J = app.save.journey;
    drawMap(svg, { legs: app.legs, J, inLeg: !!(app.save.trip && J && app.save.trip.legId === J.legId), paint: app.paintColor(), labels: 'all', stickers: app.save.stickers });
    svg.setAttribute('aria-label', 'The whole trail');
    return [h('div', { class: 'card jr-mapcard' }, svg)];
  }
  function render() {
    renderTabs();
    body.dataset.page = page;
    body.replaceChildren(...(page === 'letters' ? letters() : page === 'stickers' ? stickers() : map()));
    body.scrollTop = 0;
  }
  return { show(opts = {}) { if (opts.page) page = opts.page; render(); }, hide() {}, get page() { return page; } };
}

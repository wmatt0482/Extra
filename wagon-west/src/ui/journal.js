// The journal (SPEC §3 "the kid-facing record", §12): Letters: every letter home, newest first, each with "Read it to me" (the voice reads it back).
// Stickers: one per stop of the trail (the landmark's emoji and name once earned, a faint outline before), every year counting; v1.5: in tabs by route
// (Oregon, California, Gold Road, Shortcuts). The map: every route and fork, the lines travelled inked, the farms, the routes travelled and the people
// met. v1.1: Cards: the trail-card album (src/ui/cards.js), v1.5 with a Sets tab (the sixteen card sets and their wagon decorations).
// v1.2 (app two): the map page also lists "People met" (src/ui/people.js metCard) and Deeds (src/ui/deeds.js: "Deeds (53)" in groups).
// v1.4: Finds (the dog's finds, the treat jar, the wishes, the quests) and the Fish log. v1.5: Farm: each homestead's pieces, the farm log ("1848:
// raised the barn with Beaver money"), the trophy shelf and the gold pouch with its Beaver coins. Nine pages in all.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { drawMap } from './map.js';
import { albumPage, setsPage } from './cards.js';
import { deedsPage } from './deeds.js';
import { metCard } from './people.js';
import { findsPage } from './finds.js';
import { fishLogPage } from './fishLog.js';
import { ALL_LEGS, LEGS } from '../content/legs.js';
import { SITES } from '../content/routes.js';
import { HOMESTEAD_PIECES, PIECE_BY_ID } from '../content/homestead.js';
import { ROUTES } from '../content/routes.js';
import { homesteadView, farmBalance } from '../journey/homestead.js';
import { nuggetsOf } from '../journey/gold.js';

export const PAGES = Object.freeze([['letters', 'Letters'], ['stickers', 'Stickers'], ['map', 'Map'], ['cards', 'Cards'], ['deeds', 'Deeds'], ['farm', 'Farm'], ['finds', 'Finds'], ['fish', 'Fish log']]);
const BRANCH_IDS = ['sublette-cutoff', 'bear-river', 'lander-road', 'barlow-road'];
const CAL_IDS = ['raft-river', 'city-of-rocks', 'humboldt-wells', 'humboldt-river', 'big-meadows', 'forty-mile-desert', 'truckee-river', 'sierra-summit', 'sacramento-valley'];
const GOLD_IDS = ROUTES['gold-road'].steps.filter((s) => typeof s === 'string');
/** The stickers' tabs by route (SPEC v1.5 §5.5). */
export const STICKER_ROUTES = Object.freeze([
  { id: 'oregon', name: 'Oregon', legs: () => LEGS },
  { id: 'california', name: 'California', legs: () => ALL_LEGS.filter((l) => CAL_IDS.includes(l.id)) },
  { id: 'gold', name: 'Gold Road', legs: () => ALL_LEGS.filter((l) => GOLD_IDS.includes(l.id)) },
  { id: 'shortcuts', name: 'Shortcuts', legs: () => ALL_LEGS.filter((l) => BRANCH_IDS.includes(l.id)) },
]);
const ROUTE_WORDS = { oregon: 'The Oregon Trail', california: 'The California Trail', 'gold-road': 'The Gold Road' };
const FORK_WORDS = { 'south-pass:main': 'by Fort Bridger', 'south-pass:sublette': 'the Sublette Cutoff', 'south-pass:lander': 'the Lander Road', 'fort-hall:oregon': 'on to Oregon', 'fort-hall:california': 'south to California', 'the-dalles:columbia': 'the Columbia raft', 'the-dalles:barlow': 'the Barlow Road' };
const dateOf = (at) => (at ? new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
/** "1848: raised the barn with Beaver money", from a farm-log entry (the piece, the year, what paid for it). */
export function logLine(e) {
  const p = PIECE_BY_ID[e.piece];
  if (!p) return '';
  const y = e.year ? `${e.year}: ` : '';
  const paid = e.paid || {};
  if (e.piece === 'barn') return `${y}raised the barn with ${paid.nuggets ? 'Beaver money from the gold rush' : 'help from everyone'}`;
  const how = paid.nuggets ? ` with ${paid.nuggets} nuggets of Beaver money` : paid.savings ? ` for $${paid.savings}` : paid.tokens ? ` with ${paid.tokens} trade tokens` : '';
  return `${y}built ${/^[aeiou]/i.test(p.name) ? 'an' : 'a'} ${p.name.toLowerCase()}${how}`;
}

export function createJournal(app) {
  const tabs = $('#jr-tabs');
  const body = $('#jr-body');
  let page = 'letters', stickerRoute = 'oregon', cardsTab = 'cards';
  function renderTabs() {
    tabs.replaceChildren(...PAGES.map(([id, text]) => {
      const b = h('button', { class: 'seg-btn' + (page === id ? ' on' : ''), role: 'tab', 'aria-selected': String(page === id), 'data-page': id, 'data-sfx': '' }, text);
      b.addEventListener('click', () => { page = id; render(); });
      return b;
    }));
  }
  function subTabs(list, cur, onPick, attr) {
    return h('div', { class: 'seg jr-sub', role: 'tablist' }, ...list.map(([id, text]) => {
      const b = h('button', { class: 'seg-btn' + (cur === id ? ' on' : ''), role: 'tab', 'aria-selected': String(cur === id), [attr]: id, 'data-sfx': '' }, text);
      b.addEventListener('click', () => { onPick(id); render(false); });
      return b;
    }));
  }
  function letters() {
    const list = app.save.letters.slice().reverse();
    if (!list.length) return [h('div', { class: 'jr-empty', id: 'jr-empty' }, 'No letters yet. The first fort has a post office: write home from there.')];
    return list.map((l, i) => {
      const leg = app.legById(l.leg);
      const read = h('button', { class: 'btn btn-sm jr-read', 'data-letter': String(i), 'data-sfx': '' }, h('span', { html: app.icon('sound') }), 'Read it to me');
      read.addEventListener('click', () => app.sayAll(l.text.split('\n').map((t) => app.spoken(t))));
      return h('article', { class: 'card jr-letter', 'data-at': String(l.at) },
        h('div', { class: 'jr-letter-head' }, h('b', {}, leg ? (leg.stop && leg.stop.name) || leg.name : 'On the trail'), h('small', {}, dateOf(l.at)), read),
        h('div', { class: 'jr-letter-text' }, ...l.text.split('\n').map((t) => h('p', {}, t))));
    });
  }
  function stickers() {
    const got = new Set(app.save.stickers);
    const route = STICKER_ROUTES.find((r) => r.id === stickerRoute) || STICKER_ROUTES[0];
    const legs = route.legs();
    const all = new Set(ALL_LEGS.map((l) => (l.sticker || { id: l.id }).id));
    const total = ALL_LEGS.length;
    const have = [...all].filter((id) => got.has(id)).length;
    return [subTabs(STICKER_ROUTES.map((r) => [r.id, r.name]), stickerRoute, (id) => { stickerRoute = id; }, 'data-sroute'),
      h('div', { class: 'jr-stickers', id: 'jr-stickers', 'data-route': route.id }, ...legs.map((l) => {
        const s = l.sticker || { id: l.id, name: l.name, emoji: '★' };
        const mine = got.has(s.id);
        return h('div', { class: 'jr-sticker' + (mine ? ' got' : ''), 'data-sticker': s.id, 'aria-label': mine ? s.name : `${s.name}: not yet` },
          h('span', { class: 'jr-emoji', 'aria-hidden': 'true' }, mine ? s.emoji : '?'), h('small', {}, s.name));
      })),
      h('p', { class: 'jr-note' }, `${legs.filter((l) => got.has((l.sticker || { id: l.id }).id)).length} of ${legs.length} stickers on this road · ${have} of ${total} in all${app.save.seasonsDone ? ` · ${app.save.seasonsDone} year${app.save.seasonsDone > 1 ? 's' : ''} finished` : ''}`)];
  }
  function routesTravelled() {
    const L = app.save.ledger || {};
    const done = Array.isArray(L.routesDone) ? L.routesDone : [];
    const forks = (Array.isArray(L.branchesDone) ? L.branchesDone : []).map((k) => FORK_WORDS[k]).filter(Boolean);
    const items = [];
    for (const id of ['oregon', 'california', 'gold-road']) items.push(h('li', { class: 'rt-item' + (done.includes(id) ? ' got' : ''), 'data-route': id }, h('span', { 'aria-hidden': 'true' }, done.includes(id) ? '✓' : '○'), ` ${ROUTE_WORDS[id]}`));
    for (const [k, w] of Object.entries(FORK_WORDS)) items.push(h('li', { class: 'rt-item' + (forks.includes(w) ? ' got' : ''), 'data-way': k }, h('span', { 'aria-hidden': 'true' }, forks.includes(w) ? '✓' : '○'), ` ${w[0].toUpperCase()}${w.slice(1)}`));
    return h('section', { class: 'card met-card', id: 'routes-card' }, h('b', {}, `Roads travelled · ${done.length} of 3 trails · ${forks.length} of ${Object.keys(FORK_WORDS).length} ways`), h('ul', { class: 'rt-list' }, ...items));
  }
  function map() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'jr-map');
    svg.setAttribute('role', 'img');
    const J = app.save.journey;
    drawMap(svg, { J, inLeg: !!(app.save.trip && J && app.save.trip.legId === J.legId), paint: app.paintColor(), labels: 'all', stickers: app.save.stickers, ledger: app.save.ledger, farm: app.save.farm, onFarm: (id) => app.openFarm(id), year: app.yearNow() });
    svg.setAttribute('aria-label', 'Every road: the trail, the forks, the Gold Road and the farms');
    return [h('div', { class: 'card jr-mapcard' }, svg), routesTravelled(), metCard(app)];
  }
  function cards() {
    return [subTabs([['cards', 'Cards'], ['sets', 'Sets']], cardsTab, (id) => { cardsTab = id; }, 'data-ctab'), ...(cardsTab === 'sets' ? setsPage(app) : albumPage(app))];
  }
  function farmPage() {
    const farm = app.save.farm;
    const sites = SITES.filter((s) => farm.sites && farm.sites[s.id]);
    if (!sites.length) return [h('div', { class: 'jr-empty', id: 'jr-farm-empty' }, 'No farm yet. Reach the end of a trail and the wagon will bring its savings home.')];
    const bal = farmBalance(farm);
    const n = nuggetsOf(bal.flakes);
    const J = app.save.journey;
    const out = [h('div', { class: 'card farm-pouch', id: 'farm-pouch' }, h('b', {}, 'The farm’s purses'),
      h('div', { class: 'fp-row' }, h('span', {}, `💵 Savings $${bal.savings}`), h('span', {}, `🦫 Beaver money ${n.nuggets} nugget${n.nuggets === 1 ? '' : 's'} · ${n.flakes} flake${n.flakes === 1 ? '' : 's'}`), h('span', {}, `🪙 Trade tokens ${(J && J.tokens) | 0}`)))];
    for (const s of sites) {
      const site = farm.sites[s.id];
      const view = homesteadView(farm, s.id, J);
      const plates = (app.save.ledger.trophies || []).filter((t) => (s.id === 'sacramento' ? /:california$/ : /:(oregon|gold-road)$/).test(t)).map((t) => t.split(':')[0]);
      const built = HOMESTEAD_PIECES.filter((p) => (site.pieces[p.id] | 0) > 0);
      const open = h('button', { class: 'btn btn-sm', 'data-open-farm': s.id, 'data-sfx': '' }, 'Visit the farm');
      open.addEventListener('click', () => app.openFarm(s.id));
      out.push(h('section', { class: 'card jr-farm', 'data-site': s.id },
        h('div', { class: 'jr-farm-head' }, h('b', {}, site.name || s.name), h('small', {}, `${s.name} · ${view.built} of ${view.of} pieces`), open),
        h('div', { class: 'jr-pieces' }, ...(built.length ? built.map((p) => h('span', { class: 'jr-piece', 'data-piece': p.id }, h('span', { 'aria-hidden': 'true' }, p.emoji), ` ${p.name}${(site.pieces[p.id] | 0) > 1 ? ` ×${site.pieces[p.id]}` : ''}`)) : [h('span', { class: 'jr-note' }, 'A tent and a campfire for now.')])),
        h('div', { class: 'jr-shelf', 'data-plates': plates.join(',') }, h('b', {}, 'Trophy shelf '), ...(plates.length ? plates.map((c) => h('span', { class: `plate ${c}`, 'aria-label': `${c} plate` }, c === 'gold' ? '🥇' : c === 'silver' ? '🥈' : '🥉')) : [h('small', {}, 'Finish a journey to earn a plate.')]))));
    }
    const log = (farm.log || []).slice(-12).reverse().map(logLine).filter(Boolean);
    out.push(h('section', { class: 'card jr-log', id: 'farm-log' }, h('b', {}, 'The farm log'), log.length ? h('ul', { class: 'pat-list' }, ...log.map((t) => h('li', {}, t))) : h('p', { class: 'jr-note' }, 'Build a piece and it is written here.')));
    return out;
  }
  function render(top = true) {
    renderTabs();
    body.dataset.page = page;
    body.replaceChildren(...(page === 'letters' ? letters() : page === 'stickers' ? stickers() : page === 'cards' ? cards() : page === 'deeds' ? deedsPage(app) : page === 'farm' ? farmPage() : page === 'finds' ? findsPage(app) : page === 'fish' ? fishLogPage(app) : map()));
    if (top) body.scrollTop = 0;
  }
  return { show(opts = {}) { if (opts.page) page = opts.page; render(); }, hide() {}, get page() { return page; } };
}


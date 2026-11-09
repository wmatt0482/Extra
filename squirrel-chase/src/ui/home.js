// The case board (SPEC §4): the big New York map with today's case glowing, one card for today's case (or "Next case tomorrow"), the closed cases
// as postcard stamps, the sealed ones to come, and the postcard album. One case a day: a case that has not arrived yet is sealed (its title is not
// shown) and the board says "Next case tomorrow" with no countdown. A closed case stays on the board and in the album.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { CASE_LIST, CITY_BY_ID, artCity, CITY_LIST, TOUR_TOTAL, hideoutCity, missingOf, routeOf, signOf } from '../logic/caseModel.js';
import { currentCase, waitingState } from '../logic/pacing.js';
import { drawMap, pipPortrait, postcardSvg, signSvg } from '../art/index.js';
import { artBox } from './fx.js';
import { drawAvatar } from './avatar.js';

export function createHome(app) {
  const body = $('#home-body');

  function todayCard(save, cur) {
    const kase = cur && app.caseById[cur];
    if (!kase) return null;
    const wip = app.hasWip(kase.id);
    const go = h('button', { class: 'btn btn-sun btn-big', id: 'btn-open-case', type: 'button', 'data-case': kase.id, 'data-state': wip ? 'started' : 'new', 'data-sfx': '' }, wip ? 'Keep chasing' : 'Start the chase');
    go.addEventListener('click', () => app.openCase(kase.id));
    return h('section', { class: 'today-card paper', 'aria-label': "Today's case" },
      h('div', { class: 'today-top' }, artBox(pipPortrait('happy'), 'face face-pip'),
        h('div', { class: 'today-text' }, h('span', { class: 'label' }, `Case ${kase.order} of ${TOUR_TOTAL} · today's case`), h('h2', {}, kase.title))),
      artBox(signSvg(signOf(kase), missingOf(kase)), 'sign-art', 'The sign the gang swiped letters from'),
      go);
  }

  function stampCard(kase, rec) {
    const city = CITY_BY_ID[hideoutCity(kase)] || { id: '', name: '' };
    const b = h('button', { class: 'stamp-card', type: 'button', 'data-case': kase.id, 'data-state': 'closed', 'data-sfx': '', 'aria-label': `${kase.title}, case closed. Open the postcard album` },
      artBox(postcardSvg(artCity(city)), 'mini-card'), h('div', { class: 'sc-text' }, h('div', { class: 'sc-title' }, kase.title), h('div', { class: 'sc-meta' }, `Closed ${rec.day}`)), h('span', { class: 'stamp' }, 'Case closed'));
    b.addEventListener('click', () => app.go('album'));
    return b;
  }
  function sealedCard(kase) {
    return h('div', { class: 'stamp-card sealed', 'data-case': kase.id, 'data-state': 'sealed', 'aria-label': `Case ${kase.order}, arrives later` },
      h('span', { class: 'case-no' }, String(kase.order)), h('div', { class: 'sc-text' }, h('div', { class: 'sc-title' }, 'Sealed case'), h('div', { class: 'sc-meta' }, 'Arrives on a later day')), h('span', { html: app.icon('lock'), class: 'lock-ico' }));
  }

  function show() {
    const save = app.save;
    const p = app.currentPlayer();
    $('#home-player').textContent = p ? p.name : 'Player';
    if (p) drawAvatar($('#home-avatar'), p.color);
    const cur = currentCase(save);
    const wait = waitingState(save);
    const closedN = Object.keys(save.closed).length;
    const curCase = cur && app.caseById[cur];
    const mapEl = h('div', { class: 'map-box', id: 'home-map' });
    const kids = [h('div', { class: 'board-title' }, h('h1', {}, "Pip's Squirrel Chase"), h('span', { class: 'label' }, `New York tour: ${closedN} / ${TOUR_TOTAL}`))];
    const left = h('div', { class: 'home-map paper' }, mapEl, h('p', { class: 'map-note' }, curCase ? "Today's chase starts at the glowing city." : 'Green stamps are cities you have been to.'));
    const right = h('div', { class: 'home-side' });
    const tc = todayCard(save, cur);
    if (tc) right.append(tc);
    if (wait === 'tomorrow') right.append(h('div', { class: 'next-note', id: 'next-note' }, h('span', { html: app.icon('calendar'), class: 'ico' }), 'Next case tomorrow.'));
    else if (wait === 'done') right.append(h('div', { class: 'next-note', id: 'next-note' }, 'Every case on the tour is closed. More are on the way.'));
    const list = h('div', { class: 'stamp-list' });
    for (const k of CASE_LIST) {
      if (save.closed[k.id]) list.append(stampCard(k, save.closed[k.id]));
      else if (!save.opened[k.id]) list.append(sealedCard(k));
    }
    if (list.children.length) right.append(h('div', { class: 'sec-title' }, 'Case board'), list);
    const album = h('button', { class: 'btn btn-paper', id: 'btn-album', type: 'button', 'data-sfx': '' }, `Postcard album (${save.album.length})`);
    album.addEventListener('click', () => app.go('album'));
    right.append(h('div', { class: 'home-actions' }, album));
    kids.push(h('div', { class: 'home-grid' }, left, right));
    body.replaceChildren(...kids);
    body.scrollTop = 0;
    const first = curCase ? routeOf(curCase)[0] : null;
    drawMap(mapEl, { cities: CITY_LIST, highlight: first, visited: save.album });
  }

  return { home: { show } };
}

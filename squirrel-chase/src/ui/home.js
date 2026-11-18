// The case board (SPEC §4): the big New York map with today's case glowing, one card for today's case (or "Next case tomorrow"), the closed cases
// as postcard stamps, the sealed ones to come, and the postcard album. One case a day: a case that has not arrived yet is sealed (its title is not
// shown) and the board says "Next case tomorrow" with no countdown. A closed case stays on the board and in the album.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { ARC_BY_ID, ARC_LIST, CASE_BY_ID, CITY_BY_ID, activeArc, artCity, citiesFor, hideoutCity, missingOf, onMap, routeOf, signOf, tourClosed, tourTotal } from '../logic/caseModel.js';
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
        h('div', { class: 'today-text' }, h('span', { class: 'label' }, `Case ${kase.arcOrder} of ${tourTotal(ARC_BY_ID[kase.arc])} · today's case`), h('h2', {}, kase.title))),
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
    return h('div', { class: 'stamp-card sealed', 'data-case': kase.id, 'data-state': 'sealed', 'aria-label': `Case ${kase.arcOrder}, arrives later` },
      h('span', { class: 'case-no' }, String(kase.arcOrder)), h('div', { class: 'sc-text' }, h('div', { class: 'sc-title' }, 'Sealed case'), h('div', { class: 'sc-meta' }, 'Arrives on a later day')), h('span', { html: app.icon('lock'), class: 'lock-ico' }));
  }

  function show() {
    const save = app.save;
    const p = app.currentPlayer();
    $('#home-player').textContent = p ? p.name : 'Player';
    if (p) drawAvatar($('#home-avatar'), p.color);
    const cur = currentCase(save);
    const wait = waitingState(save);
    const curCase = cur && app.caseById[cur];
    const arc = activeArc(save, cur), map = arc ? arc.map : 'ny';
    const mapEl = h('div', { class: 'map-box', id: 'home-map' });
    const kids = [h('div', { class: 'board-title' }, h('h1', {}, "Pip's Squirrel Chase"), h('span', { class: 'label' }, arc ? `${arc.short}: ${tourClosed(save, arc)} / ${tourTotal(arc)}` : ''))];
    const left = h('div', { class: 'home-map paper' }, mapEl, h('p', { class: 'map-note' }, curCase ? "Today's chase starts at the glowing city." : 'Green stamps are cities you have been to.'));
    const right = h('div', { class: 'home-side' });
    const tc = todayCard(save, cur);
    if (tc) right.append(tc);
    if (wait === 'tomorrow') right.append(h('div', { class: 'next-note', id: 'next-note' }, h('span', { html: app.icon('calendar'), class: 'ico' }), 'Next case tomorrow.'));
    else if (wait === 'done') right.append(h('div', { class: 'next-note', id: 'next-note' }, 'Every case on the tour is closed. More are on the way.'));
    // the case board: every tour, the New York tour first; a tour not begun yet is one sealed card (its cases stay hidden)
    right.append(h('div', { class: 'sec-title' }, 'Case board'));
    ARC_LIST.forEach((a, ai) => {
      const begun = ai === 0 || a.cases.some((id) => save.opened[id] || save.closed[id]);
      const list = h('div', { class: 'stamp-list', 'data-arc': a.id });
      if (!begun) list.append(h('div', { class: 'stamp-card sealed tour-sealed', 'data-arc': a.id, 'data-state': 'sealed', 'aria-label': `${a.title}, comes after the ${ARC_LIST[ai - 1].short}` },
        h('span', { html: app.icon('lock'), class: 'lock-ico' }), h('div', { class: 'sc-text' }, h('div', { class: 'sc-title' }, a.title), h('div', { class: 'sc-meta' }, `${a.cases.length} cases · comes after the ${ARC_LIST[ai - 1].short}`)), h('span')));
      else for (const id of a.cases) {
        const k = CASE_BY_ID[id];
        if (save.closed[id]) list.append(stampCard(k, save.closed[id]));
        else if (!save.opened[id]) list.append(sealedCard(k));
      }
      if (ARC_LIST.length > 1) right.append(h('div', { class: 'tour-title', 'data-arc': a.id }, h('span', {}, a.title), begun ? h('span', { class: 'label' }, `${tourClosed(save, a)} / ${tourTotal(a)}`) : null));
      if (list.children.length) right.append(list);
    });
    const album = h('button', { class: 'btn btn-paper', id: 'btn-album', type: 'button', 'data-sfx': '' }, `Postcard album (${save.album.length})`);
    album.addEventListener('click', () => app.go('album'));
    right.append(h('div', { class: 'home-actions' }, album));
    kids.push(h('div', { class: 'home-grid' }, left, right));
    body.replaceChildren(...kids);
    body.scrollTop = 0;
    const first = curCase ? routeOf(curCase)[0] : null;
    drawMap(mapEl, { cities: citiesFor(map), highlight: first, visited: save.album.filter((id) => onMap(CITY_BY_ID[id], map)), arc: map });
  }

  return { home: { show } };
}

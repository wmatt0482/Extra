// The agency home: the case board. A cork board with manila folders: Detective Training first, then each arc's folder with its case
// files. A closed case carries a CASE CLOSED stamp and stays re-readable from the Archive. One new case a day: a case that has not
// arrived yet is sealed (its title is not shown) and the board says "Next case arrives tomorrow" with no countdown (SPEC §4).
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { ARCS, TRAINING } from '../content/index.js';
import { currentCase, waitingState } from '../logic/pacing.js';
import { drawAvatar, createRouteMap, portrait } from './art.js';

export function createHome(app) {
  const homeBody = $('#home-body'), archiveBody = $('#archive-body');
  let routeMap = null;                                   // the Erie route (src/ui/art/routemap.js), redrawn when the board changes width
  const face = (who, mood = 'happy', cls = '') => h('span', { class: `face ${cls}`, 'aria-hidden': 'true', html: portrait(who, mood) });

  /** The canal-route map of an arc: Albany, Rochester, Lockport, Buffalo and one stop per case (closed = stamped, next = glowing, sealed = dim). */
  function routeFor(arc, save, cur) {
    const stops = arc.cases.map((k, i) => ({ id: k.id, no: i + 1, title: k.title, setting: k.setting, state: save.closed[k.id] ? 'closed' : !save.opened[k.id] ? 'sealed' : cur === k.id ? 'now' : 'open' }));
    return createRouteMap({ stops, onOpen: (id) => app.openCase(id), reduced: !!app.settings.reducedMotion || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) });
  }

  function card(kase, no, save, now) {
    const closed = save.closed[kase.id], opened = !!save.opened[kase.id];
    if (!opened) {
      return h('div', { class: 'case-card sealed', 'data-case': kase.id, 'data-state': 'sealed', 'aria-label': `Case ${no}, arrives later` },
        h('span', { class: 'case-no' }, String(no)), h('div', {}, h('div', { class: 'case-name' }, 'Sealed file'), h('div', { class: 'case-meta' }, 'Arrives on a later day')), h('span', { html: app.icon('lock'), style: { width: '22px', height: '22px', color: '#8a7740' } }));
    }
    const wip = app.hasWip(kase.id);
    const b = h('button', { class: 'case-card' + (closed ? ' closed' : '') + (now ? ' now' : ''), type: 'button', 'data-case': kase.id, 'data-state': closed ? 'closed' : wip ? 'started' : 'new', 'data-sfx': '' },
      h('span', { class: 'case-no' }, String(no)),
      h('div', {}, h('div', { class: 'case-name' }, kase.title), h('div', { class: 'case-meta' }, kase.setting || '')),
      closed ? h('span', { class: 'stamp' }, 'Case closed') : h('span', { class: 'case-go' }, wip ? 'Keep going' : 'Open case'));
    b.addEventListener('click', () => app.openCase(kase.id));
    return b;
  }

  function folder(tab, title, blurb, cards) {
    return h('section', { class: 'folder', 'data-tab': tab }, h('i', { class: 'pin-head' }),
      h('div', { class: 'folder-head' }, h('h3', {}, title), blurb ? h('p', {}, blurb) : null), h('div', { class: 'case-list' }, ...cards));
  }

  function show() {
    const save = app.save;
    const p = app.currentPlayer();
    $('#home-player').textContent = p ? p.name : 'Player';
    if (p) drawAvatar($('#home-avatar'), p.color, app.looksFor(p.id));
    const cur = currentCase(save);
    const wait = waitingState(save);
    const kids = [h('div', { class: 'board-title' }, h('h1', {}, 'The Agency'), h('span', { class: 'label-type' }, 'Case board'),
      h('span', { class: 'team', 'aria-hidden': 'true' }, face('chief', 'happy', 'f-chief'), face('partner', 'happy', 'f-pip')))];
    if (routeMap) { routeMap.destroy(); routeMap = null; }
    const erie = ARCS.find((a) => a.id === 'erie') || ARCS[0];
    if (erie && erie.cases.length) { routeMap = routeFor(erie, save, cur); kids.push(routeMap); }
    const folders = h('div', { class: 'folders' });
    folders.append(folder('Training', 'Detective Training', 'Learn the moves every detective uses.', [card(TRAINING, 'T', save, cur === TRAINING.id)]));
    for (const a of ARCS) folders.append(folder(a.title.replace(/^The /, '').replace(/ Files$/, ''), a.title, a.blurb, a.cases.map((k, i) => card(k, i + 1, save, cur === k.id))));
    kids.push(folders);
    if (wait === 'tomorrow') kids.push(h('div', { class: 'next-note', id: 'next-note' }, h('span', { html: app.icon('calendar'), style: { width: '22px', height: '22px', display: 'inline-flex' } }), 'Next case arrives tomorrow.'));
    else if (wait === 'done') kids.push(h('div', { class: 'next-note', id: 'next-note' }, 'Every case is closed. New files are on the way.'));
    homeBody.replaceChildren(...kids);
    homeBody.scrollTop = 0;
  }

  function showArchive() {
    const save = app.save;
    const list = Object.entries(save.closed).map(([id, r]) => ({ id, r, k: app.caseById[id] })).filter((x) => x.k).sort((a, b) => b.r.at - a.r.at);
    const kids = [h('div', { class: 'board-title' }, h('h1', {}, 'The Archive'), h('span', { class: 'label-type' }, 'Closed cases')),
      h('div', { class: 'wen-note' }, face('wen', 'happy', 'f-wen'), h('p', {}, h('b', {}, 'Mr. Wen, the archivist'), 'Every closed case is filed here. Pull one out and read it again, any time.'))];
    if (!list.length) kids.push(h('div', { class: 'next-note', id: 'archive-empty' }, 'No closed cases yet. Close your first case and it is filed here.'));
    else {
      const l = h('div', { class: 'case-list', style: { maxWidth: '720px' } });
      for (const { k, r } of list) {
        const b = h('button', { class: 'case-card closed', type: 'button', 'data-case': k.id, 'data-sfx': '' },
          h('span', { class: 'case-no' }, String(k.order || 'T')), h('div', {}, h('div', { class: 'case-name' }, k.title), h('div', { class: 'case-meta' }, `Closed ${r.day}`)), h('span', { class: 'stamp' }, 'Case closed'));
        b.addEventListener('click', () => app.openFile(k.id, 'archive'));
        l.append(b);
      }
      kids.push(l);
    }
    archiveBody.replaceChildren(...kids);
    archiveBody.scrollTop = 0;
  }
  return { home: { show }, archive: { show: showArchive } };
}

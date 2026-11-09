// The postcard album: one postcard per city the child has closed a case in (SPEC §4): the illustration, the city and its two facts.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { CASE_LIST, CITY_BY_ID, artCity, postcardOf, hideoutCity } from '../logic/caseModel.js';
import { postcardSvg } from '../art/index.js';
import { artBox } from './fx.js';

export function createAlbum(app) {
  const body = $('#album-body');
  function show() {
    const save = app.save;
    const kids = [h('div', { class: 'board-title' }, h('h1', {}, 'Postcard album'), h('span', { class: 'label' }, `${save.album.length} ${save.album.length === 1 ? 'postcard' : 'postcards'}`))];
    if (!save.album.length) kids.push(h('div', { class: 'next-note', id: 'album-empty' }, 'Close a case and its city sends you a postcard.'));
    else {
      const grid = h('div', { class: 'album-grid' });
      for (const id of save.album) {
        const city = CITY_BY_ID[id] || { id, name: id, facts: [] };
        const k = CASE_LIST.find((c) => hideoutCity(c) === id && save.closed[c.id]);
        const pc = k ? postcardOf(k) : { facts: city.facts.slice(0, 2) };
        grid.append(h('article', { class: 'postcard paper', 'data-city': id }, artBox(postcardSvg(artCity(city)), 'pc-art', `Postcard of ${city.name}`), h('h3', {}, city.name), h('ul', {}, ...pc.facts.map((f) => h('li', {}, f)))));
      }
      kids.push(grid);
    }
    body.replaceChildren(...kids);
    body.scrollTop = 0;
  }
  return { album: { show } };
}

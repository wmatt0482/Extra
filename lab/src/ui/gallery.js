// Gallery (lab/SPEC.md §5.3): the family's finished Build Crew builds and saved sites as blueprint-style top and front views (drawn here from
// the pieces list, so no picture is ever stored or synced), with the builder's name and the title. Tap one for a large view.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { buildSvg, glyph } from './glyph.js';

const KIND = { job: 'Job', blueprint: 'Blueprint', site: 'Saved site' };

export function mountGallery(ctx) {
  const { store } = ctx;
  let open = null;
  const grid = h('div', { class: 'lab-gallery-grid' });
  const big = h('div', { class: 'lab-bigview', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Build' });
  const el = h('div', { class: 'lab-gallery' }, grid, big);

  function items() {
    const fam = store.family(); if (!fam) return [];
    const out = [];
    for (const p of fam.players) for (const g of (p.lab && p.lab.gallery) || []) out.push({ ...g, name: p.name, color: p.color });
    return out.sort((a, b) => b.at - a.at);
  }
  function showBig(g) {
    open = g;
    const close = h('button', { class: 'lab-btn lab-btn-sm', type: 'button', id: 'gallery-close' }, h('span', { html: glyph('close') }), 'Close');
    close.addEventListener('click', () => { open = null; big.hidden = true; big.replaceChildren(); });
    big.hidden = false;
    big.replaceChildren(h('div', { class: 'lab-bigview-in' },
      h('div', { class: 'lab-bigview-top' }, h('div', {}, h('b', {}, g.title || 'A build'), h('div', { class: 'lab-small' }, `${g.name} · ${KIND[g.kind] || 'Build'}`)), close),
      h('div', { class: 'lab-bigview-pics' },
        h('figure', {}, h('div', { html: buildSvg(g.pieces, 'top', { w: 320, h: 220 }) }), h('figcaption', {}, 'From above')),
        h('figure', {}, h('div', { html: buildSvg(g.pieces, 'front', { w: 320, h: 220 }) }), h('figcaption', {}, 'From the front')))));
  }
  function update() {
    const list = items();
    if (!list.length) {
      grid.replaceChildren(h('div', { class: 'lab-card lab-empty-card' }, h('span', { class: 'lab-empty-ic', html: glyph('gallery') }), h('p', {}, 'Finish a job in Build Crew and it hangs here for the whole family.')));
      return;
    }
    grid.replaceChildren(...list.map((g) => {
      const b = h('button', { class: 'lab-card lab-build', type: 'button', 'data-build': g.id, style: { '--c': g.color || '#37e0c0' }, 'aria-label': `${g.title || 'A build'} by ${g.name}` },
        h('div', { class: 'lab-build-pics' }, h('div', { html: buildSvg(g.pieces, 'top') }), h('div', { html: buildSvg(g.pieces, 'front') })),
        h('div', { class: 'lab-build-cap' }, h('i', { class: 'lab-dot-c' }), h('span', { class: 'lab-build-title' }, g.title || 'A build'), h('span', { class: 'lab-build-by' }, `${g.name} · ${KIND[g.kind] || 'Build'}`)));
      b.addEventListener('click', () => showBig(g));
      return b;
    }));
    if (open) { const again = list.find((x) => x.id === open.id); if (!again) { big.hidden = true; open = null; } }
  }
  update();
  return { el, update, destroy() {} };
}

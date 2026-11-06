// The cork evidence board: every pinned sentence is a card with a red pin, joined by red string. Used as a sheet while pinning,
// as the clue picker when closing the case, and (read-only) in the archive.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { drawString } from './art.js';
import { hashString, sentenceIndex } from '../logic/run.js';
import { KIND_LABEL } from '../logic/lines.js';

/**
 * ids: the pinned sentence ids in pin order. opts: { pickable, selected, glow: [ids], fresh: id, onPick(id), empty }
 * -> the .cork element (call .redraw() after it is in the page)
 */
export function createBoard(kase, ids, opts = {}) {
  const idx = sentenceIndex(kase);
  const docOf = (id) => kase.docs.find((d) => d.id === (idx[id] && idx[id].doc));
  const grid = h('div', { class: 'cork-grid' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'cork-svg'); svg.setAttribute('aria-hidden', 'true');
  const el = h('div', { class: 'cork', 'data-board': String(ids.length) }, svg, grid);
  if (!ids.length) el.append(h('p', { class: 'cork-empty' }, opts.empty || 'Nothing pinned yet. Pin the sentence that proves each clue.'));
  for (const id of ids) {
    const s = idx[id]; if (!s) continue;
    const d = docOf(id);
    const rot = ((hashString(id) % 7) - 3) * 0.7;
    const cls = 'clue' + (opts.pickable ? ' pickable' : '') + (opts.selected === id ? ' sel' : '') + ((opts.glow || []).includes(id) ? ' glow' : '') + (opts.fresh === id ? ' fresh' : '');
    const c = h(opts.pickable ? 'button' : 'div', { class: cls, type: opts.pickable ? 'button' : null, 'data-clue': id, style: { '--rot': `${rot}deg` } },
      s.text, h('small', {}, d ? `${KIND_LABEL[d.kind] || 'Document'} · ${d.title}` : ''));
    if (opts.pickable && opts.onPick) c.addEventListener('click', () => opts.onPick(id));
    grid.append(c);
  }
  el.redraw = () => requestAnimationFrame(() => drawString(svg, grid));
  return el;
}

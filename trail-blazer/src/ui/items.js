// Small pictures of every collectible (garage chips, the Garage Wall, the crate reveal): paints as swatches, decals as
// glyphs, helmets and suits drawn by the engine's own art when it is loaded (src/game/vehicle.js drawHelmet /
// drawRider), boost trails as a streak of their colours, flags as a little flag, horns as a horn. Plain DOM; no state.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { PAINT_BY_ID } from '../data/paints.js';
import { itemOf } from '../data/cosmetics.js';
import { vehicleModule } from './vehiclePreview.js';

export const DECAL_SW = {
  none: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" fill="none" stroke="#b2d3c2" stroke-width="2"/><path d="M5.5 14.5l9-9" stroke="#b2d3c2" stroke-width="2"/></svg>',
  mud: '<svg viewBox="0 0 20 20"><circle cx="7" cy="8" r="4" fill="#8a5a32"/><circle cx="13.5" cy="12.5" r="3" fill="#8a5a32"/><circle cx="14" cy="5" r="1.6" fill="#8a5a32"/></svg>',
  flames: '<svg viewBox="0 0 20 20"><path d="M10 2c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3.4 2-4.4.4 1.5 1.3 2.4 2.3 2.4C9 7 9.5 4.4 10 2z" fill="#ff8a1f"/><path d="M10 9c1.3 1.6 2 2.6 2 4a2 2 0 0 1-4 0c0-1 .8-2.2 2-4z" fill="#ffd23a"/></svg>',
  stars: '<svg viewBox="0 0 20 20"><path d="M10 2l2.3 5 5.4.6-4 3.6 1.1 5.3L10 13.8l-4.8 2.7 1.1-5.3-4-3.6 5.4-.6z" fill="#ffd23a"/></svg>',
  checkers: '<svg viewBox="0 0 20 20"><rect width="20" height="20" fill="#fff"/><path d="M0 0h5v5H0zM10 0h5v5h-5zM5 5h5v5H5zM15 5h5v5h-5zM0 10h5v5H0zM10 10h5v5h-5zM5 15h5v5H5zM15 15h5v5h-5z" fill="#111"/></svg>',
};
const HORN_SVG = (c) => `<svg viewBox="0 0 24 24"><path d="M3 10h4l9-5v14l-9-5H3z" fill="${c}"/><path d="M18.5 8.5a5 5 0 0 1 0 7M20.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/></svg>`;
const flagSvg = (cols) => {
  const [a = '#fff', b = '#111'] = cols;
  const bands = cols.length > 2 ? cols.map((x, i) => `<rect x="6" y="${3 + i * (10 / cols.length)}" width="14" height="${10 / cols.length + 0.2}" fill="${x}"/>`).join('') : `<rect x="6" y="3" width="14" height="10" fill="${a}"/><path d="M6 3h3.5v5H6zM13 3h3.5v5H13zM9.5 8H13v5H9.5zM16.5 8H20v5h-3.5z" fill="${b}"/>`;
  return `<svg viewBox="0 0 24 24"><rect x="4.5" y="2" width="1.8" height="20" rx=".9" fill="#d7dde2"/>${bands}</svg>`;
};
const grad = (cols) => (cols.length > 1 ? `linear-gradient(135deg, ${cols.join(', ')})` : cols[0] || '#888');

/** The engine draws a helmet or a rider portrait into a canvas; false when its art is not loaded. */
function drawEngine(cv, kind, id) {
  const m = vehicleModule();
  if (!m || typeof m.resolveLook !== 'function') return false;
  requestAnimationFrame(() => {
    // clientWidth, not the bounding box: the crate reveal scales the prize in with a transform
    const W = Math.max(8, cv.clientWidth || 40), H = Math.max(8, cv.clientHeight || 40);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    try {
      if (kind === 'helmet' && typeof m.drawHelmet === 'function') {
        const s = Math.min(W, H) * 2.1;
        ctx.translate(W / 2, H / 2 + s * 0.02); ctx.scale(s, -s);
        m.drawHelmet(ctx, m.resolveLook({ helmet: id }), 0.035, 0, 0, 0.2);
      } else if (kind === 'suit' && typeof m.drawRider === 'function') {
        const s = H / 1.55;
        ctx.translate(W / 2, H * 0.66); ctx.scale(s, -s);
        m.drawRider(ctx, m.resolveLook({ suit: id, helmet: 'classic' }), 0.045, true);
      }
    } catch (_) { /* the plain swatch stays */ }
  });
  return true;
}

/** A picture of one item: { kind, id } → an element (class "sw" plus the kind). */
export function itemSwatch(kind, id, cls = '') {
  const it = itemOf(kind, id) || { colors: [] };
  if (kind === 'paint') {
    const p = PAINT_BY_ID[id] || { body: '#888', trim: '#444' };
    return h('i', { class: `sw sw-paint ${cls}`, style: { background: p.swatch || `linear-gradient(135deg, ${p.body} 0 60%, #ff8a1f 60% 70%, ${p.trim} 70%)` } });
  }
  if (kind === 'decal') return h('i', { class: `sw glyph ${cls}`, html: DECAL_SW[id] || '' });
  if (kind === 'horn') return h('i', { class: `sw glyph ${cls}`, html: HORN_SVG(it.rarity === 'legendary' ? '#ffd23a' : it.rarity === 'rare' ? '#22d3ff' : '#ffffff') });
  if (kind === 'flag') return h('i', { class: `sw glyph ${cls}`, html: id === 'none' ? DECAL_SW.none : flagSvg(it.colors || []) });
  if (kind === 'trail') return h('i', { class: `sw sw-trail ${cls}`, style: { background: `linear-gradient(90deg, transparent, ${(it.colors || []).join(', ')})` } });
  if (kind === 'helmet' || kind === 'suit') {
    const cv = h('canvas', { class: `sw sw-art ${cls}`, 'aria-hidden': 'true' });
    if (drawEngine(cv, kind, id)) return cv;
    return h('i', { class: `sw ${cls}`, style: { background: grad(it.colors || []), borderRadius: kind === 'helmet' ? '50% 50% 30% 30%' : '8px' } });
  }
  return h('i', { class: `sw ${cls}` });
}

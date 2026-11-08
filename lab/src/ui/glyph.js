// Glyphs: the Lab's small inline SVG art (no image files). Game badges, tab icons, the crate, the shield for a freeze, the flame,
// and the blueprint-style views of a Build Crew build (the gallery). Everything is a string, so it can be dropped in with innerHTML.
import { ICONS } from '../../../spell-jump/src/ui/icons.js';
import { LAB_COIN } from '../coin.js';

/** The Lab coin: a teal coin with a brass rim and a flask mark. It replaces every "$" for Lab coins (the chip, the shop, crates, receipts) and is
 *  exported by the facade as lab.coinIcon() so a game can show a Lab-coin price (Build Crew blueprints) with the same coin. Never use a game's own
 *  money icon for Lab coins, nor this one for a game's own money. */
export { LAB_COIN };
export const COIN = LAB_COIN;
const S = (body, w = 2.4) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

/** Icons by name: the shared set (back, close, check, lock, star, crown, crate, flame, shield, trophy, medal ...) plus the Lab's own. */
export const GLYPHS = {
  ...ICONS,
  quests: S('<rect x="4.5" y="3.5" width="15" height="17" rx="3"/><path d="M8.5 9l1.6 1.6 3-3.2M8.5 15.5h7"/>'),
  shop: S('<path d="M5 8h14l-1.2 11.5a2 2 0 0 1-2 1.5H8.2a2 2 0 0 1-2-1.5z"/><path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8"/>'),
  family: S('<circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M2.8 19.5c.4-3.6 2.4-5.5 5.2-5.5s4.8 1.9 5.2 5.5M14.2 14.6c3-.5 5.8 1 6.6 4.6"/>'),
  gallery: S('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M7 15.5l3.2-4 2.6 3 1.9-2 3.3 3"/><circle cx="8.5" cy="9" r="1.3"/>'),
  me: S('<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20c.6-4.2 3.5-6.5 7.5-6.5s6.9 2.3 7.5 6.5"/>'),
  home: S('<path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5"/><path d="M10 20v-5.5h4V20"/>'),
  grownups: S('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15.5" r="1.4" fill="currentColor"/>'),
  speaker: S('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'),
  swap: S('<path d="M4.5 8h13M14 4.5L17.5 8 14 11.5M19.5 16h-13M10 12.5L6.5 16 10 19.5"/>'),
  pawprint: S('<circle cx="7" cy="10" r="1.8"/><circle cx="11" cy="6.8" r="1.8"/><circle cx="15.5" cy="7.6" r="1.8"/><circle cx="18" cy="12" r="1.8"/><path d="M8 18c0-3 2-5 4.5-5s4.5 2 4.5 5c0 1.6-1.4 2-3 2-1 0-1.5-.5-2-.5s-1 .5-2 .5c-1.6 0-2-.4-2-2z"/>'),
  sparkle: S('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>', 2),
  grid: S('<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>'),
  flask: S('<path d="M9.5 3.5h5M10.5 3.5v6l-5 8.6a2 2 0 0 0 1.7 3h9.6a2 2 0 0 0 1.7-3l-5-8.6v-6"/><path d="M8 15h8" />'),
  eye: S('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
};
export const glyph = (name) => GLYPHS[name] || '';

// ---------- the five games ----------
export const GAME_LABELS = { sj: 'Spell Jump', tb: 'Trail Blazer', ff: 'Fraction Fright', ww: 'Wagon West', bc: 'Build Crew', cf: 'Case Files', any: 'Any game' };
export const GAME_COLORS = { sj: '#ffcf1a', tb: '#ff8a1f', ff: '#5fd38d', ww: '#d9653b', bc: '#22d3ff', cf: '#e0b24a', any: '#8f6bff' };
const GAME_ART = {
  sj: '<path d="M7 17.5L12 6l5 11.5M9 13.5h6" stroke="#2a1a00" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  tb: '<path d="M7 18V6.5M7 7h9.5l-2 3.2 2 3.2H7" stroke="#2b1200" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  ff: '<path d="M8 9.5h8M12 6.5v6M8 17.5h8" stroke="#06261a" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="12" cy="13.5" r=".1" stroke="#06261a" stroke-width="0"/>',
  ww: '<circle cx="12" cy="12" r="5.5" stroke="#2a0f02" stroke-width="2.2" fill="none"/><path d="M12 6.5v11M6.5 12h11M8 8l8 8M16 8l-8 8" stroke="#2a0f02" stroke-width="1.3"/>',
  bc: '<path d="M6 18h12M9 18V9.5l7-3.5M16 6v5.5" stroke="#032634" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="14" y="11.5" width="4" height="3.4" rx=".6" fill="#032634"/>',
  cf: '<circle cx="10.5" cy="10.5" r="4.6" stroke="#2a1c02" stroke-width="2.4" fill="none"/><path d="M14 14l5 5" stroke="#2a1c02" stroke-width="2.8" stroke-linecap="round"/>',
  any: '<path d="M12 5.5l1.7 4.2 4.5.4-3.4 3 1 4.4L12 15l-3.8 2.5 1-4.4-3.4-3 4.5-.4z" fill="#1c0e3a"/>',
};
/** A rounded-square badge for a game (or 'any'). */
export function gameBadge(game, size = 28) {
  const g = GAME_ART[game] ? game : 'any';
  return `<svg class="lab-badge" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="6" fill="${GAME_COLORS[g]}"/><rect x="1" y="1" width="22" height="22" rx="6" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="1.4"/>${GAME_ART[g]}</svg>`;
}

// ---------- the crate ----------
export const CRATE_ART = `<svg viewBox="0 0 120 110" aria-hidden="true">
<ellipse cx="60" cy="102" rx="44" ry="6" fill="rgba(0,0,0,.28)"/>
<g class="crate-body"><path d="M18 46h84v52a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6z" fill="#1d9d8d"/><path d="M18 46h84v10H18z" fill="#16756a"/>
<path d="M28 62h18M28 76h18M74 62h18M74 76h18" stroke="#0f524a" stroke-width="3.4" stroke-linecap="round" opacity=".6"/>
<path d="M50 46h20v58H50z" fill="#ffcf1a"/><path d="M50 46h20v10H50z" fill="#ffe066"/>
<g transform="translate(60 80)"><path d="M-6 -8h12M-3 -8v8l-7 11a2.6 2.6 0 0 0 2.3 4h15.4a2.6 2.6 0 0 0 2.3-4l-7-11v-8" fill="none" stroke="#7a5200" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/></g></g>
<g class="crate-lid"><path d="M10 26h100v22H10z" fill="#25c4ae" stroke="#16756a" stroke-width="3" stroke-linejoin="round"/><path d="M50 26h20v22H50z" fill="#ffcf1a"/>
<path d="M60 26c-7-17-26-17-23-4 2 5 13 4 23 4zM60 26c7-17 26-17 23-4-2 5-13 4-23 4z" fill="#ffcf1a" stroke="#b98200" stroke-width="3" stroke-linejoin="round"/></g></svg>`;

// ---------- swatches (a game item with no painter of its own) ----------
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const hueOf = (s) => hash(String(s)) % 360;

// ---------- Build Crew gallery: a blueprint-style top view and front view of a build ----------
// pieces: [typeIndex, colorIndex, x*10, z*10, y*10]; colorIndex 255 = a custom colour. The palette and shapes are the Lab's own (it never imports Build Crew).
const BP_COLORS = ['#ff5a5a', '#ffb347', '#ffe066', '#7be08a', '#4fd6c8', '#5ab0ff', '#8f7bff', '#ff8ad0', '#c9d0f5', '#a58a6a', '#ffffff', '#3b4a9a'];
const colorOf = (ci) => (ci === 255 ? '#9fb2ff' : BP_COLORS[Math.abs(ci | 0) % BP_COLORS.length]);
const sizeOf = (ti) => [[1, 1], [2, 1], [1.4, 1.4], [3, 1], [1, 2], [2, 2]][Math.abs(ti | 0) % 6];
const ROUND = (ti) => Math.abs(ti | 0) % 3 === 2;
/** A blueprint-style SVG of the build: view = 'top' or 'front'. Fits any list of up to 48 pieces; an empty build draws just the grid. */
let bpUid = 0;
export function buildSvg(pieces, view = 'top', { w = 160, h = 110 } = {}) {
  const uid = `bp${++bpUid}`;
  const list = Array.isArray(pieces) ? pieces.filter((p) => Array.isArray(p) && p.length >= 5) : [];
  const grid = `<defs><pattern id="${uid}" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="rgba(160,190,255,.16)" stroke-width=".6"/></pattern></defs><rect width="${w}" height="${h}" rx="8" fill="#10205c"/><rect width="${w}" height="${h}" rx="8" fill="url(#${uid})"/>`;
  if (!list.length) return `<svg viewBox="0 0 ${w} ${h}" class="lab-bp" aria-hidden="true">${grid}</svg>`;
  const pts = list.map((p) => ({ t: p[0], c: p[1], x: p[2] / 10, z: p[3] / 10, y: p[4] / 10 }));
  const a = (p) => p.x, b = (p) => (view === 'top' ? p.z : -p.y);
  const xs = pts.map(a), ys = pts.map(b);
  const minX = Math.min(...xs) - 1.6, maxX = Math.max(...xs) + 1.6, minY = Math.min(...ys) - 1.6, maxY = Math.max(...ys) + 1.6;
  const k = Math.min((w - 16) / Math.max(4, maxX - minX), (h - 16) / Math.max(4, maxY - minY));
  const ox = (w - (maxX - minX) * k) / 2 - minX * k, oy = (h - (maxY - minY) * k) / 2 - minY * k;
  const order = pts.slice().sort((p, q) => (view === 'top' ? p.y - q.y : p.z - q.z));
  const shapes = order.map((p) => {
    const [sx, sy] = sizeOf(p.t), cx = a(p) * k + ox, cy = b(p) * k + oy;
    const bw = sx * k * 0.9, bh = (view === 'top' ? sy : 1) * k * 0.9;
    const fill = colorOf(p.c);
    return ROUND(p.t) ? `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(bw / 2).toFixed(1)}" ry="${(bh / 2).toFixed(1)}" fill="${fill}" fill-opacity=".85" stroke="#dbe6ff" stroke-width=".9"/>`
      : `<rect x="${(cx - bw / 2).toFixed(1)}" y="${(cy - bh / 2).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="1.5" fill="${fill}" fill-opacity=".85" stroke="#dbe6ff" stroke-width=".9"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="lab-bp" aria-hidden="true">${grid}${shapes}</svg>`;
}

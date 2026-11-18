// The USA map base layer (arc 'usa'): the contiguous 48 states, light state lines, the Great Lakes, both oceans and the Gulf, rivers and mountain ranges,
// New York State highlighted as the home state. Pins and labels are added by map.js. Pure functions, SVG strings.
//
// BOX: the contract's US_MAP_BOUNDS (src/content/geo.js, `toUsMap(lat, lng)`): west -125.0, east -66.5, north 49.6, south 24.2, aspect 1.83, plain linear lon/lat.
// A city's `usCoords` { x, y } (0..1) are multiplied by US_W / US_H. The outline in usdata.js is pre-projected into the same box
// (Natural Earth 1:50m, public domain, simplified by a throwaway script; see README "USA map").
//
// SWAP NOTE: the bounds below are a local copy of the contract numbers. When the content module exports them, replace the const with
//   import { US_MAP_BOUNDS } from '../content/geo.js';
// and nothing else changes (usdata.js was projected with these exact numbers).
import { SANS, esc, rng } from './shared.js';
import { US_MAP_BOUNDS } from '../content/geo.js';
import { US_W, US_H, US_LAND, US_STATES, US_LAKES } from './usdata.js';

export const US_BOX = Object.freeze({ ...US_MAP_BOUNDS, width: US_W, height: US_H });
const WATER = '#9bd5ef';
const u = (lon, lat) => [+(((lon - US_BOX.west) / (US_BOX.east - US_BOX.west)) * US_W).toFixed(1), +(((US_BOX.north - lat) / (US_BOX.north - US_BOX.south)) * US_H).toFixed(1)];
/** Pixel position (viewBox units) of a lon/lat on the US map. */
export const usPx = u;

function curve(a) {
  const p = a.map(([lo, la]) => u(lo, la));
  let d = `M${p[0].join(' ')}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

// ------------------------------------------------------------------ rivers (lon, lat)
const RIVERS = {
  mississippi: [[-95.2, 47.2], [-94.2, 45.6], [-93.25, 44.98], [-92.8, 44.75], [-91.25, 43.8], [-90.65, 42.5], [-90.58, 41.52], [-91.1, 40.8], [-91.4, 39.93], [-90.43, 38.97], [-90.18, 38.63], [-89.52, 37.3], [-89.17, 37.0], [-89.9, 35.9], [-90.07, 35.15], [-91.07, 33.4], [-90.9, 32.35], [-91.4, 31.55], [-91.2, 30.45], [-90.4, 30.0], [-90.07, 29.95], [-89.4, 29.2], [-89.1, 29.0]],
  missouri: [[-111.5, 45.9], [-110.67, 47.8], [-108.0, 47.8], [-104.0, 48.0], [-100.78, 46.8], [-100.35, 44.37], [-98.0, 43.0], [-96.4, 42.5], [-95.93, 41.26], [-95.0, 39.9], [-94.6, 39.1], [-92.17, 38.57], [-90.8, 38.7], [-90.12, 38.83]],
  ohio: [[-80.0, 40.45], [-80.8, 39.6], [-82.45, 38.4], [-84.5, 39.1], [-85.76, 38.25], [-87.57, 37.97], [-88.6, 37.08], [-89.13, 37.0]],
  arkansas: [[-106.0, 39.2], [-104.6, 38.1], [-102.0, 37.9], [-99.0, 37.6], [-97.35, 37.7], [-96.0, 36.2], [-94.4, 35.4], [-92.3, 34.75], [-91.1, 33.7]],
  colorado: [[-105.8, 40.4], [-108.55, 39.07], [-109.55, 38.6], [-110.4, 37.9], [-111.5, 36.9], [-112.1, 36.1], [-114.7, 36.0], [-114.7, 34.5], [-114.7, 32.7], [-114.8, 31.9]],
  columbia: [[-117.35, 48.98], [-118.5, 48.0], [-119.5, 47.5], [-119.3, 46.2], [-120.9, 45.7], [-122.0, 45.6], [-122.7, 45.65], [-123.9, 46.2]],
  riogrande: [[-106.6, 35.1], [-106.5, 31.8], [-104.5, 29.6], [-102.7, 29.0], [-101.4, 29.77], [-100.5, 28.7], [-99.5, 27.5], [-98.2, 26.1], [-97.15, 25.95]],
  snake: [[-110.7, 43.8], [-112.4, 43.5], [-114.2, 42.6], [-116.0, 43.7], [-116.9, 44.3], [-116.5, 45.5], [-117.0, 46.4], [-118.9, 46.2]],
};

// ------------------------------------------------------------------ mountains (outlines in lon, lat; peaks are scattered inside)
const RANGES = [
  { name: 'rockies', seed: 5, n: 34, size: 0.62, poly: [[-114.4, 48.7], [-112.2, 48.4], [-110.4, 45.8], [-109.0, 43.6], [-107.9, 40.6], [-106.6, 38.0], [-105.5, 35.6], [-107.3, 35.4], [-108.6, 38.0], [-109.6, 40.6], [-110.8, 43.6], [-112.6, 46.2]] },
  { name: 'cascades', seed: 9, n: 10, size: 0.55, poly: [[-121.8, 48.9], [-120.9, 48.7], [-121.1, 45.0], [-121.2, 41.9], [-122.1, 41.9], [-122.1, 45.0], [-122.0, 47.5]] },
  { name: 'sierra', seed: 4, n: 10, size: 0.55, poly: [[-121.9, 41.2], [-120.4, 39.6], [-118.9, 37.3], [-117.6, 35.5], [-118.3, 35.2], [-119.6, 37.0], [-121.2, 38.6], [-122.2, 40.4]] },
  { name: 'appalachians', seed: 3, n: 24, size: 0.5, poly: [[-85.2, 34.8], [-83.0, 36.0], [-81.4, 37.4], [-79.3, 39.0], [-77.6, 40.3], [-76.3, 41.6], [-77.3, 41.9], [-78.5, 40.5], [-80.3, 38.9], [-82.0, 37.2], [-83.6, 35.4], [-84.5, 34.5]] },
  { name: 'ozarks', seed: 6, n: 6, size: 0.45, poly: [[-94.0, 37.3], [-92.2, 37.4], [-91.0, 36.9], [-91.4, 36.2], [-93.4, 35.9], [-94.4, 36.4]] },
];
const inPoly = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
function range(r) {
  const P = r.poly.map(([lo, la]) => u(lo, la));
  const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const g = rng(r.seed);
  const list = [];
  let guard = 0;
  while (list.length < r.n && guard++ < 800) {
    const x = x0 + g() * (x1 - x0), y = y0 + g() * (y1 - y0);
    if (inPoly(P, x, y) && !list.some(([a, b]) => Math.hypot(a - x, b - y) < 6)) list.push([x, y, (14 + g() * 11) * r.size]);
  }
  list.sort((a, b) => a[1] - b[1]);
  const d = (a) => `M${a.map((p) => p.join(' ')).join('L')}Z`;
  return `<path d="${d(P)}" fill="#cfe3a4" opacity=".7" stroke="#a9c97c" stroke-width="1.6" stroke-linejoin="round"/>` + list.map(([x, y, s]) => {
    const t = (n) => n.toFixed(1);
    return `<path d="M${t(x - s)} ${t(y + s * 0.5)}L${t(x)} ${t(y - s * 0.9)}L${t(x + s)} ${t(y + s * 0.5)}Z" fill="#78ad63"/><path d="M${t(x)} ${t(y - s * 0.9)}L${t(x + s)} ${t(y + s * 0.5)}L${t(x + s * 0.1)} ${t(y + s * 0.5)}Z" fill="#4f8a4c"/><path d="M${t(x)} ${t(y - s * 0.9)}L${t(x + s * 0.28)} ${t(y - s * 0.4)}L${t(x + s * 0.05)} ${t(y - s * 0.5)}L${t(x - s * 0.2)} ${t(y - s * 0.38)}Z" fill="#fff" opacity=".9"/>`;
  }).join('');
}

const sailboat = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-12 0H12L8 6H-8Z" fill="#d94a3d"/><path d="M0 -2V-24L11 -4Z" fill="#fff"/><path d="M-1.5 -2V-18L-10 -4Z" fill="#ffe6a0"/><path d="M-16 9q4 -3 8 0t8 0 8 0 8 0" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/></g>`;
const compass = (x, y, r = 28) => `<g transform="translate(${x} ${y})"><circle r="${r}" fill="#fff8e4" stroke="#c9a14a" stroke-width="3"/><circle r="${r - 6}" fill="none" stroke="#e0c27a" stroke-width="1.2" stroke-dasharray="2 3"/>
  <path d="M0 ${-r + 5}L5 0L0 ${r - 5}L-5 0Z" fill="#d94a3d"/><path d="M${-r + 5} 0L0 -5L${r - 5} 0L0 5Z" fill="#22365f" opacity=".85"/><path d="M0 ${-r + 5}L5 0L0 0Z" fill="#a8302a"/><circle r="2.6" fill="#fff8e4" stroke="#c9a14a" stroke-width="1.4"/>
  <text y="${-r - 5}" text-anchor="middle" font-family="${SANS}" font-weight="900" font-size="15" fill="#22365f">N</text></g>`;

/** The map layers under the pins, for the viewBox 0 0 US_W US_H. `avoid` (pixel boxes) is filled with the rectangles the pin labels should stay off. */
export function usBaseSvg(avoid = []) {
  const stateD = (code) => US_STATES[code] || '';
  const all = Object.values(US_STATES).join('');
  const txt = (s, x, y, o = {}) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="${SANS}" font-weight="${o.w || 700}" font-style="${o.i ? 'italic' : 'normal'}" font-size="${o.s || 14}" letter-spacing="${o.ls || 0}" fill="${o.c || '#8a6a2c'}" opacity="${o.o ?? 0.85}"${o.rot ? ` transform="rotate(${o.rot} ${x} ${y})"` : ''}>${esc(s)}</text>`;
  const sea = (s, x, y, o = {}) => { avoid.push({ x: x - (o.w || 70), y: y - 16, w: (o.w || 70) * 2, h: 34 }); return txt(s, x, y, { i: 1, c: '#2f7fa8', ...o }); };
  const grid = [30, 35, 40, 45].map((la) => `<path d="M0 ${u(-125, la)[1]}H${US_W}"/>`).join('') + [-120, -110, -100, -90, -80, -70].map((lo) => `<path d="M${u(lo, 49)[0]} 0V${US_H}"/>`).join('');
  const river = (a, w) => `<path d="${curve(a)}" fill="none" stroke="${WATER}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const [p1x, p1y] = u(-121.2, 33.6), [p2x, p2y] = u(-70.6, 33.9), [gx, gy] = u(-90.6, 26.4), [mx, my] = u(-102.6, 26.6), [cx, cy] = u(-101.5, 49.28);
  const lakeLabels = [['L. SUPERIOR', -87.6, 47.35, 9, -4], ['L. ERIE', -81.2, 42.1, 7, -22]]
    .map(([s, lo, la, fs, rot]) => { const [x, y] = u(lo, la); return txt(s, x, y, { s: fs, c: '#2f7fa8', i: 1, ls: 1, rot, o: 0.95 }); }).join('');
  return `
    <rect width="${US_W}" height="${US_H}" fill="${WATER}"/>
    <path d="${US_LAND}" fill="#ecdcae"/>
    <g stroke="#d3bd86" stroke-width="1" stroke-dasharray="3 7" fill="none" opacity=".7">${grid}</g>
    <path d="${all}" transform="translate(4 5)" fill="#7a5a1a" opacity=".24"/>
    <path d="${all}" fill="#fff3c9" stroke="#c9a14a" stroke-width="4.2" stroke-linejoin="round"/>
    <path d="${all}" fill="#fff3c9"/>
    ${range(RANGES[0])}${range(RANGES[1])}${range(RANGES[2])}${range(RANGES[3])}${range(RANGES[4])}
    <path d="${all}" fill="none" stroke="#dcc27c" stroke-width="1.1" stroke-linejoin="round" stroke-dasharray="4 2.5"/>
    <path d="${stateD('NY')}" fill="#ffd978" stroke="#e08a2c" stroke-width="2.6" stroke-linejoin="round"/>
    ${Object.entries(US_LAKES).map(([k, d]) => `<path d="${d}" fill="${WATER}" stroke="#c9a14a" stroke-width="${/Superior|Michigan|Huron|Erie|Ontario/.test(k) ? 2.2 : 1.4}" stroke-linejoin="round"/>`).join('')}
    ${river(RIVERS.mississippi, 3.4)}${river(RIVERS.missouri, 2.6)}${river(RIVERS.ohio, 2.6)}${river(RIVERS.arkansas, 2)}${river(RIVERS.colorado, 2.2)}${river(RIVERS.columbia, 2.4)}${river(RIVERS.snake, 1.8)}${river(RIVERS.riogrande, 2.2)}
    ${lakeLabels}
    ${sea('PACIFIC', p1x, p1y, { s: 15, ls: 3, w: 46 })}${sea('OCEAN', p1x, p1y + 17, { s: 15, ls: 3, w: 46 })}${sea('ATLANTIC', p2x, p2y, { s: 15, ls: 3, w: 56 })}${sea('OCEAN', p2x, p2y + 17, { s: 15, ls: 3, w: 56 })}${sea('GULF OF MEXICO', gx, gy, { s: 14, ls: 2.5, w: 90 })}
    ${txt('MEXICO', mx, my, { s: 15, ls: 4, o: 0.55 })}${txt('CANADA', cx, cy, { s: 9, ls: 4, o: 0.6 })}
    ${sailboat(...u(-122.8, 36.3), 0.8)}${sailboat(...u(-71.2, 37.6), 0.8)}${sailboat(...u(-87.4, 28.2), 0.8)}
    ${compass(46, US_H - 48)}`;
}

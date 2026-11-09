// The illustrated New York State map (+ a small USA inset).
//
// MAP BOUNDING BOX (this is what city coords are relative to): lon -79.8 .. -71.8 (x: 0 -> 1, west -> east), lat 45.05 .. 40.45 (y: 0 -> 1, north -> south).
// So a city's coords are  x = (lon + 79.8) / 8   and   y = (45.05 - lat) / 4.6   (simple linear, the map is drawn at 720 x 560 which keeps the shape true).
// Example: Rochester (-77.61, 43.16) -> { x: 0.274, y: 0.411 }  (the same numbers the content gets from toMap in src/content/geo.js).
//
// drawMap(el, { cities, highlight, visited, arc = 'ny', usRoute }) fills `el` with a responsive SVG and returns { svg, pins, update }:
//   pins    - { [cityId]: element } the pin groups (each has data-city, role=button, tabindex=0; the transparent hit target is >= 44px on a phone screen)
//   update  - update({ highlight, visited }) toggles the glowing / stamped states without redrawing (handlers stay attached)
// Enter / Space on a focused pin fires a click on it. `arc` 'ny' = the New York map (other arcs reuse it for now; `usRoute` [[lon,lat],...] draws a dashed
// route on the inset for later US arcs).
import { INK, SANS, esc, hash, rng } from './shared.js';
import { MAP_BOUNDS } from '../content/geo.js';

// the box is the CONTENT's (src/content/geo.js MAP_BOUNDS), so city coords from toMap() land on the right spot
export const MAP_BOX = Object.freeze({ lonMin: MAP_BOUNDS.west, lonMax: MAP_BOUNDS.east, latMin: MAP_BOUNDS.south, latMax: MAP_BOUNDS.north, width: 720, height: 560 });
const W = 720, H = 560;
const px = (lon, lat) => [+(((lon - MAP_BOUNDS.west) / (MAP_BOUNDS.east - MAP_BOUNDS.west)) * W).toFixed(1), +(((MAP_BOUNDS.north - lat) / (MAP_BOUNDS.north - MAP_BOUNDS.south)) * H).toFixed(1)];
const pts = (a) => a.map(([lo, la]) => px(lo, la));
const poly = (a, close = true) => `M${pts(a).map((p) => p.join(' ')).join('L')}${close ? 'Z' : ''}`;
/** Catmull-Rom spline through the points as cubic Beziers. */
function curve(a) {
  const p = pts(a);
  let d = `M${p[0].join(' ')}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

// ------------------------------------------------------------------ geography (lon, lat)
const NY = [[-79.762, 42.27], [-79.55, 42.37], [-79.33, 42.49], [-79.1, 42.63], [-78.95, 42.78], [-78.88, 42.9], [-78.95, 43.03], [-79.07, 43.1], [-79.05, 43.26],
  [-78.72, 43.34], [-78.2, 43.37], [-77.8, 43.34], [-77.6, 43.26], [-77.2, 43.28], [-76.95, 43.28], [-76.7, 43.34], [-76.5, 43.46], [-76.22, 43.56], [-76.2, 43.7], [-76.2, 43.87], [-76.28, 44.02], [-76.33, 44.13],
  [-76.0, 44.22], [-75.8, 44.4], [-75.5, 44.68], [-75.3, 44.84], [-74.9, 44.99], [-74.75, 45.0], [-73.35, 45.01],
  [-73.4, 44.8], [-73.43, 44.6], [-73.4, 44.4], [-73.38, 44.2], [-73.42, 44.03], [-73.38, 43.85], [-73.4, 43.62], [-73.3, 43.58], [-73.25, 43.3], [-73.25, 43.1], [-73.27, 42.75], [-73.35, 42.4], [-73.5, 42.05], [-73.55, 41.3], [-73.66, 41.0],
  [-73.78, 40.9], [-73.72, 40.84], [-73.45, 40.9], [-73.2, 40.96], [-72.9, 40.97], [-72.6, 41.0], [-72.3, 41.15], [-72.35, 41.04], [-72.1, 41.0], [-71.86, 41.07], [-72.1, 40.9], [-72.5, 40.8], [-73.0, 40.7], [-73.5, 40.62], [-73.95, 40.57],
  [-74.05, 40.57], [-74.25, 40.5], [-74.25, 40.56], [-74.18, 40.64], [-74.05, 40.7], [-74.02, 40.82], [-73.93, 41.0], [-74.3, 41.15], [-74.69, 41.36], [-74.9, 41.43], [-75.05, 41.5], [-75.1, 41.75], [-75.25, 41.85], [-75.35, 42.0], [-79.76, 42.0]];
const ERIE = [[-79.762, 42.27], [-79.55, 42.37], [-79.33, 42.49], [-79.1, 42.63], [-78.95, 42.78], [-78.88, 42.9], [-79.0, 42.88], [-79.3, 42.87], [-79.8, 42.78], [-79.8, 42.27]];
const ONTARIO = [[-79.05, 43.26], [-78.72, 43.34], [-78.2, 43.37], [-77.8, 43.34], [-77.6, 43.26], [-77.2, 43.28], [-76.95, 43.28], [-76.7, 43.34], [-76.5, 43.46], [-76.22, 43.56], [-76.2, 43.7], [-76.2, 43.87], [-76.28, 44.02], [-76.33, 44.13],
  [-76.5, 44.22], [-76.8, 44.1], [-77.5, 43.95], [-78.4, 43.92], [-79.0, 43.8], [-79.4, 43.62], [-79.8, 43.3], [-79.4, 43.2], [-79.07, 43.26]];
const ATLANTIC = [[-73.66, 41.0], [-73.2, 41.15], [-72.9, 41.27], [-72.0, 41.32], [-71.8, 41.33], [-71.8, 40.5], [-74.1, 40.5], [-74.0, 40.6]];
const STLAWRENCE = [[-76.33, 44.13], [-76.0, 44.22], [-75.8, 44.4], [-75.5, 44.68], [-75.3, 44.84], [-74.9, 44.99], [-74.75, 45.0]];
const CHAMPLAIN = [[-73.37, 45.0], [-73.42, 44.7], [-73.4, 44.4], [-73.42, 44.1], [-73.38, 43.85], [-73.4, 43.6]];
const HUDSON = [[-74.02, 40.7], [-73.95, 40.85], [-73.93, 41.0], [-73.97, 41.3], [-73.95, 41.6], [-73.92, 41.95], [-73.82, 42.3], [-73.76, 42.65], [-73.7, 42.9], [-73.66, 43.15], [-73.62, 43.3], [-73.85, 43.5], [-74.0, 43.75], [-74.1, 44.0]];
const MOHAWK = [[-73.72, 42.79], [-74.0, 42.84], [-74.3, 42.95], [-74.7, 42.99], [-75.0, 43.07], [-75.25, 43.12], [-75.46, 43.2]];
const CANAL = [[-73.76, 42.66], [-73.93, 42.81], [-74.2, 42.94], [-74.55, 42.98], [-74.86, 43.04], [-75.23, 43.1], [-75.46, 43.21], [-75.85, 43.19], [-76.15, 43.05], [-76.5, 43.03], [-76.7, 43.0], [-77.0, 43.06], [-77.3, 43.07], [-77.52, 43.1], [-77.6, 43.16], [-77.9, 43.2], [-78.19, 43.24], [-78.69, 43.17], [-78.88, 43.02], [-78.88, 42.9]];
const NIAGARA = [[-78.9, 42.9], [-79.0, 43.05], [-79.05, 43.25]];
const FINGERS = [[[-77.28, 42.9], [-77.27, 42.8], [-77.3, 42.72]], [[-77.5, 42.78], [-77.52, 42.7]], [[-77.2, 42.63], [-77.15, 42.52], [-77.2, 42.4]], [[-77.12, 42.66], [-77.15, 42.52]],
  [[-76.97, 42.86], [-76.93, 42.65], [-76.88, 42.4]], [[-76.7, 42.9], [-76.62, 42.65], [-76.5, 42.45]], [[-76.52, 42.92], [-76.5, 42.78]], [[-76.4, 42.95], [-76.33, 42.82]], [[-76.27, 42.97], [-76.25, 42.88]], [[-77.72, 42.8], [-77.7, 42.72]]];
const OTHER_LAKES = [[[-76.2, 43.2], [-75.95, 43.2], [-75.72, 43.21]], [[-73.57, 43.76], [-73.62, 43.58], [-73.66, 43.42]], [[-79.45, 42.27], [-79.38, 42.18], [-79.3, 42.1]], [[-74.2, 43.2], [-74.12, 43.33]]];
const ADIRONDACKS = [[-75.25, 44.3], [-74.75, 44.62], [-74.0, 44.68], [-73.62, 44.42], [-73.55, 43.9], [-73.78, 43.55], [-74.35, 43.38], [-74.95, 43.55], [-75.35, 43.9]];
const CATSKILLS = [[-74.75, 42.05], [-74.6, 42.28], [-74.2, 42.32], [-73.95, 42.2], [-74.15, 41.98]];

// ------------------------------------------------------------------ US inset
const US = [[-124.7, 48.4], [-123.1, 49.0], [-95.2, 49.0], [-94.6, 48.7], [-91.5, 48.1], [-89.6, 48.0], [-92.0, 46.8], [-90.5, 46.6], [-88.4, 47.4], [-87.4, 46.5], [-84.6, 46.5], [-84.7, 45.8], [-83.4, 45.2], [-83.4, 44.3], [-83.9, 43.7], [-82.6, 43.9], [-82.4, 43.0], [-83.1, 42.3], [-83.4, 41.7],
  [-82.5, 41.4], [-81.7, 41.5], [-80.5, 42.0], [-79.76, 42.27], [-78.9, 42.9], [-79.05, 43.25], [-77.5, 43.3], [-76.3, 43.5], [-76.3, 44.1], [-75.3, 44.85], [-74.7, 45.0], [-71.5, 45.0], [-70.9, 45.3], [-70.3, 45.9], [-70.0, 46.7], [-69.2, 47.45], [-68.3, 47.35], [-67.8, 47.07], [-67.8, 45.7], [-67.4, 45.2], [-67.0, 44.9], [-68.5, 44.3], [-70.2, 43.7], [-70.7, 43.1], [-70.8, 42.8], [-70.6, 42.65], [-71.0, 42.3], [-70.5, 41.8], [-70.0, 41.8], [-70.6, 41.5], [-71.5, 41.4], [-72.9, 41.25], [-73.7, 41.0], [-74.0, 40.7],
  [-74.0, 39.7], [-74.9, 38.9], [-75.1, 38.3], [-75.9, 37.1], [-75.5, 35.3], [-76.5, 34.7], [-77.9, 33.9], [-79.0, 33.4], [-80.9, 32.0], [-81.4, 30.7], [-81.2, 29.5], [-80.5, 28.4], [-80.0, 26.8], [-80.2, 25.3], [-81.1, 25.2], [-81.8, 26.1], [-82.7, 27.5], [-82.7, 28.9], [-84.0, 30.1], [-85.3, 29.7], [-86.5, 30.4], [-88.0, 30.4], [-89.4, 30.2], [-89.2, 29.2], [-90.1, 29.1], [-91.5, 29.5], [-93.8, 29.7], [-94.8, 29.3], [-96.5, 28.3], [-97.2, 27.5], [-97.15, 25.95], [-99.1, 26.4], [-99.5, 27.5], [-100.7, 29.1], [-101.4, 29.8], [-102.4, 29.8], [-102.8, 29.2], [-103.2, 29.0], [-104.5, 29.6], [-104.9, 30.6], [-106.5, 31.8], [-108.2, 31.8], [-108.2, 31.3], [-111.1, 31.3], [-114.8, 32.5], [-117.1, 32.5], [-117.3, 33.2], [-118.5, 34.0], [-120.6, 34.5], [-121.9, 36.6], [-122.5, 37.8], [-123.8, 39.5], [-124.4, 40.4], [-124.2, 42.0], [-124.5, 42.8], [-124.0, 44.5], [-124.0, 46.2], [-124.1, 47.0]];
const LAKE_MICH = [[-87.0, 45.9], [-85.0, 45.7], [-86.2, 44.5], [-86.5, 42.0], [-87.3, 41.7], [-87.8, 42.5], [-87.9, 43.9], [-87.0, 45.1]];
const US_S = 3.0;
const us = (lon, lat) => [+(((lon + 125) * 0.788 * US_S)).toFixed(1), +((49.4 - lat) * US_S).toFixed(1)];
const usPath = (a) => `M${a.map(([lo, la]) => us(lo, la).join(' ')).join('L')}Z`;

function insetSvg(usRoute) {
  const [nx, ny] = us(-75.6, 42.9);
  let route = '';
  if (usRoute && usRoute.length > 1) {
    route = `<path d="${'M' + usRoute.map(([lo, la]) => us(lo, la).join(' ')).join('L')}" fill="none" stroke="#d94a3d" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round"/>${usRoute.map(([lo, la]) => { const [x, y] = us(lo, la); return `<circle cx="${x}" cy="${y}" r="2.6" fill="#d94a3d"/>`; }).join('')}`;
  }
  return `<g class="sqm-inset" transform="translate(14 14)">
    <rect x="0" y="0" width="172" height="104" rx="12" fill="#fff8e4" stroke="#c9a14a" stroke-width="3"/>
    <rect x="5" y="5" width="162" height="94" rx="8" fill="none" stroke="#e0c27a" stroke-width="1.4" stroke-dasharray="3 4"/>
    <g transform="translate(14 22)"><path d="${usPath(US)}" fill="#f3dfa0" stroke="#c9a14a" stroke-width="1.4" stroke-linejoin="round"/><path d="${usPath(LAKE_MICH)}" fill="#9bd5ef" stroke="#c9a14a" stroke-width=".8"/>
      ${route}
      <circle class="sqm-ny-ring" cx="${nx}" cy="${ny}" r="9" fill="none" stroke="#d94a3d" stroke-width="2"/><circle cx="${nx}" cy="${ny}" r="4.6" fill="#d94a3d" stroke="#fff" stroke-width="1.2"/></g>
    <text x="12" y="17" font-family="${SANS}" font-weight="800" font-size="12" letter-spacing="1.5" fill="#9a6b1c">U.S.A.</text>
  </g>`;
}

// ------------------------------------------------------------------ terrain pieces
function peaks(region, n, seed, size = 1) {
  const r = rng(seed);
  const xs = pts(region.map(([lo, la]) => [lo, la])).map((p) => p[0]), ys = pts(region).map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const inside = (x, y) => { // point in polygon on pixel coords
    const P = pts(region); let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
    return c;
  };
  const list = [];
  let guard = 0;
  while (list.length < n && guard++ < 500) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
    if (inside(x, y)) list.push([x, y, (14 + r() * 12) * size]);
  }
  list.sort((a, b) => a[1] - b[1]);
  return list.map(([x, y, s]) => `<path d="M${(x - s).toFixed(1)} ${(y + s * 0.5).toFixed(1)}L${x.toFixed(1)} ${(y - s * 0.9).toFixed(1)}L${(x + s).toFixed(1)} ${(y + s * 0.5).toFixed(1)}Z" fill="#78ad63"/><path d="M${x.toFixed(1)} ${(y - s * 0.9).toFixed(1)}L${(x + s).toFixed(1)} ${(y + s * 0.5).toFixed(1)}L${(x + s * 0.1).toFixed(1)} ${(y + s * 0.5).toFixed(1)}Z" fill="#4f8a4c"/><path d="M${x.toFixed(1)} ${(y - s * 0.9).toFixed(1)}L${(x - s * 0.32).toFixed(1)} ${(y - s * 0.28).toFixed(1)}L${(x - s * 0.08).toFixed(1)} ${(y - s * 0.4).toFixed(1)}L${(x + s * 0.12).toFixed(1)} ${(y - s * 0.22).toFixed(1)}L${(x + s * 0.34).toFixed(1)} ${(y - s * 0.3).toFixed(1)}Z" fill="#fff" opacity=".92"/>`).join('');
}

const sailboat = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-12 0H12L8 6H-8Z" fill="#d94a3d"/><path d="M0 -2V-24L11 -4Z" fill="#fff"/><path d="M-1.5 -2V-18L-10 -4Z" fill="#ffe6a0"/><path d="M-16 9q4 -3 8 0t8 0 8 0 8 0" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/></g>`;

const compass = (x, y, r = 34) => `<g transform="translate(${x} ${y})"><circle r="${r}" fill="#fff8e4" stroke="#c9a14a" stroke-width="3"/><circle r="${r - 7}" fill="none" stroke="#e0c27a" stroke-width="1.3" stroke-dasharray="2 3"/>
  <path d="M0 ${-r + 5}L6 0L0 ${r - 5}L-6 0Z" fill="#d94a3d"/><path d="M${-r + 5} 0L0 -6L${r - 5} 0L0 6Z" fill="#22365f" opacity=".85"/><path d="M0 ${-r + 5}L6 0L0 0Z" fill="#a8302a"/><circle r="3" fill="#fff8e4" stroke="#c9a14a" stroke-width="1.5"/>
  <text y="${-r - 6}" text-anchor="middle" font-family="${SANS}" font-weight="900" font-size="17" fill="#22365f">N</text></g>`;

// ------------------------------------------------------------------ pins
const FALLBACK = { x: 0.5, y: 0.5 };
const FS = 26, LH = FS * 1.04;
const splitName = (name) => {
  if (name.length <= 10 || !name.includes(' ')) return [name];
  const w = name.split(' ');
  let best = 1, bd = 1e9;
  for (let i = 1; i < w.length; i++) { const d = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length); if (d < bd) { bd = d; best = i; } }
  return [w.slice(0, best).join(' '), w.slice(best).join(' ')];
};
// candidate label placements around a pin tip (x, y): 'r' right of the head, 'l' left, 'tr'/'tl' above, 'br'/'bl' below
const place = (k, x, y, w, h) => ({
  r: [x + 14, y - 14 - h / 2], l: [x - 14 - w, y - 14 - h / 2], tr: [x + 6, y - 34 - h], tl: [x - 6 - w, y - 34 - h], br: [x + 8, y + 7], bl: [x - 8 - w, y + 7], b: [x - w / 2, y + 7], t: [x - w / 2, y - 34 - h],
}[k]);
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

function pinsSvg(cities, highlight, visited, avoid = []) {
  const list = (cities || []).map((c) => {
    const co = c.coords || FALLBACK;
    return { id: String(c.id), name: String(c.name || c.id), x: +(co.x * W).toFixed(1), y: +(co.y * H).toFixed(1), label: c.label };
  });
  const pinBoxes = list.map((c) => ({ x: c.x - 12, y: c.y - 36, w: 24, h: 40 }));
  const placed = [];
  const order = ['r', 'l', 'tr', 'tl', 'br', 'bl', 'b', 't'];
  const spec = (c) => { const ls = splitName(c.name); return { ls, w: Math.max(...ls.map((t) => t.length)) * FS * 0.57 + 12, h: ls.length * LH + 6 }; };
  const choose = (c, ci, withPlaced) => {
    const { w, h } = spec(c);
    const want = c.label && order.includes(c.label) ? [c.label, ...order.filter((k) => k !== c.label)] : order;
    let best = null;
    for (const k of want) {
      const [bx, by] = place(k, c.x, c.y, w, h);
      const b = { x: bx, y: by, w, h };
      let score = 0;
      const out = Math.max(0, 6 - b.x) + Math.max(0, b.x + w - (W - 6)) + Math.max(0, 6 - b.y) + Math.max(0, b.y + h - (H - 6));
      score += out * 400;
      pinBoxes.forEach((o, i) => { if (i !== ci) score += overlap(b, o) * 8; });
      if (withPlaced) placed.forEach((o) => { score += overlap(b, o) * 3; });
      avoid.forEach((o) => { score += overlap(b, o) * 2; });
      if (c.label === k) score -= 70;                        // a side the map's author asked for wins unless it runs off the map or sits on another pin
      score += overlap(b, pinBoxes[ci]) * 3 + (k === 'r' || k === 'l' ? 0 : k.length === 2 ? 60 : 100) + want.indexOf(k) * 0.5;
      if (!best || score < best.score) best = { score, k, b };
      if (score < 1) break;
    }
    return best;
  };
  // cities whose side label is free of other pins go first; the squeezed ones then pick around them
  const firstScore = list.map((c, i) => choose(c, i, false));
  const seq = list.map((c, i) => i).sort((i, j) => (firstScore[i].score >= 60 ? 1 : 0) - (firstScore[j].score >= 60 ? 1 : 0));
  const result = [];
  seq.forEach((i) => { const best = choose(list[i], i, true); placed.push(best.b); result[i] = best; });
  return list.map((c, ci) => {
    const { ls } = spec(c);
    const best = result[ci];
    const right = best.k.endsWith('r'), mid = best.k === 'b' || best.k === 't';
    const tx = mid ? best.b.x + best.b.w / 2 : right ? best.b.x + 5 : best.b.x + best.b.w - 5;
    // a leader line from the pin head to the label when the label does not sit beside it
    const hx0 = c.x, hy0 = c.y - 16;
    const nx = Math.max(best.b.x, Math.min(best.b.x + best.b.w, hx0)), ny = Math.max(best.b.y, Math.min(best.b.y + best.b.h, hy0));
    const far = Math.hypot(nx - hx0, ny - hy0) > 14;
    const leader = far ? `<path class="sqm-leader" d="M0 -16L${(nx - c.x).toFixed(1)} ${(ny - c.y).toFixed(1)}" fill="none" stroke="#8a6a2c" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="5 4"/>` : '';
    const nearest = Math.min(1e9, ...list.filter((o) => o !== c).map((o) => Math.hypot(o.x - c.x, o.y - c.y)));
    const hr = Math.max(32, Math.min(56, nearest * 0.8));
    const cls = `sqm-pin${highlight === c.id ? ' is-hl' : ''}${visited && visited.includes(c.id) ? ' is-visited' : ''}`;
    const text = ls.map((t, i) => `<tspan x="${(tx - c.x).toFixed(1)}" y="${(best.b.y + FS * 0.86 + i * LH + 2 - c.y).toFixed(1)}">${esc(t)}</tspan>`).join('');
    return `<g class="${cls}" data-city="${esc(c.id)}" role="button" tabindex="0" aria-label="${esc(c.name)}" transform="translate(${c.x} ${c.y})">
      <circle class="sqm-hit" cx="0" cy="-14" r="${hr.toFixed(0)}" fill="transparent"/>
      <g class="sqm-glow"><ellipse cx="0" cy="0" rx="14" ry="6" fill="#ffc93c"/><ellipse cx="0" cy="0" rx="14" ry="6" fill="none" stroke="#ffc93c" stroke-width="3"/></g>
      <ellipse cx="0" cy="1" rx="8" ry="3" fill="#000" opacity=".22"/>
      ${leader}
      <text class="sqm-label" text-anchor="${mid ? 'middle' : right ? 'start' : 'end'}" font-family="${SANS}" font-weight="800" font-size="${FS}">${text}</text>
      <g class="sqm-body"><path class="sqm-pin-shape" d="M0 0C-5 -9 -11 -14 -11 -21A11 11 0 1 1 11 -21C11 -14 5 -9 0 0Z" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/><circle class="sqm-dot" cx="0" cy="-21" r="4.4" fill="#fff"/>
        <g class="sqm-stamp" transform="translate(13 -33) rotate(12)"><circle r="9.5" fill="#fff8e4" stroke="#1f8a7a" stroke-width="2.2"/><path d="M-4.6 .4L-1.2 4 5 -3.4" fill="none" stroke="#1f8a7a" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></g></g></g>`;
  }).join('');
}

const CSS = `
.sqm-pin{cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent}
.sqm-pin .sqm-pin-shape{fill:#e8483c}.sqm-pin .sqm-dot{fill:#fff}
.sqm-label{fill:#3a2a12;stroke:#fff6d8;stroke-width:5.5px;paint-order:stroke;stroke-linejoin:round}
.sqm-glow,.sqm-stamp{display:none}
.sqm-pin.is-visited .sqm-pin-shape{fill:#2aa57a}.sqm-pin.is-visited .sqm-stamp{display:inline}
.sqm-pin.is-hl .sqm-glow{display:inline}.sqm-pin.is-hl .sqm-pin-shape{fill:#ffb703;stroke:#d94a3d}
.sqm-pin.is-hl .sqm-body{transform:scale(1.22)}.sqm-pin.is-hl .sqm-label{font-size:25px}
.sqm-body{transform-origin:0 0;transition:transform .2s}
.sqm-pin:hover .sqm-body,.sqm-pin:focus-visible .sqm-body{transform:scale(1.15)}
.sqm-pin:focus-visible .sqm-pin-shape{stroke:#22365f;stroke-width:3.4}
.sqm-pin.is-hl .sqm-glow ellipse:first-child{animation:sqm-pulse 1.9s ease-out infinite;transform-origin:0 0}
.sqm-pin.is-hl .sqm-glow ellipse:last-child{animation:sqm-ring 1.9s ease-out infinite;transform-origin:0 0}
@keyframes sqm-pulse{0%{transform:scale(.7);opacity:.75}70%,100%{transform:scale(2.3);opacity:0}}
@keyframes sqm-ring2{0%{transform:scale(.9);opacity:1}100%{transform:scale(1.8);opacity:0}}
@keyframes sqm-ring{0%{transform:scale(.8);opacity:1}100%{transform:scale(2.8);opacity:0}}
.sqm-ny-ring{animation:sqm-ring2 2.2s ease-out infinite;transform-origin:center;transform-box:fill-box}
@media (prefers-reduced-motion:reduce){.sqm-pin.is-hl .sqm-glow ellipse,.sqm-ny-ring{animation:none}.sqm-body{transition:none}.sqm-pin.is-hl .sqm-glow ellipse:first-child{opacity:.55;transform:scale(1.6)}}
`;

/** The map as an SVG string (no handlers). See drawMap for the options. */
export function mapSvg({ cities = [], highlight = null, visited = [], usRoute = null } = {}) {
  const water = '#9bd5ef', waterDk = '#6bb3d6';
  const line = (a, w) => `<path d="${curve(a)}" fill="none" stroke="${water}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const lakeLine = (a, w) => `<path d="${curve(a)}" fill="none" stroke="${water}" stroke-width="${w}" stroke-linecap="round"/><path d="${curve(a)}" fill="none" stroke="${waterDk}" stroke-width="${Math.max(1, w - 6)}" stroke-linecap="round" opacity=".0"/>`;
  const state = poly(NY);
  const [ox, oy] = [0, 0];
  const txt = (s, x, y, o = {}) => `<text x="${x}" y="${y}" text-anchor="${o.a || 'middle'}" font-family="${SANS}" font-weight="${o.w || 700}" font-style="${o.i ? 'italic' : 'normal'}" font-size="${o.s || 16}" letter-spacing="${o.ls || 0}" fill="${o.c || '#8a6a2c'}" opacity="${o.o ?? 0.85}"${o.rot ? ` transform="rotate(${o.rot} ${x} ${y})"` : ''}>${esc(s)}</text>`;
  const P = (lo, la) => px(lo, la);
  const [a1x, a1y] = P(-74.4, 44.82), [fx, fy] = P(-78.2, 42.36), [ex, ey] = P(-75.1, 43.4), [ox1, oy1] = P(-77.75, 43.78), [lx, ly] = P(-79.72, 42.5), [cx, cy] = P(-74.62, 42.08), [hx, hy] = P(-73.95, 41.55), [liX, liY] = P(-72.6, 40.56);
  const rb = (cx2, cy2, w2, h2 = 22) => ({ x: cx2 - w2 / 2, y: cy2 - h2 + 4, w: w2, h: h2 });
  const avoid = [{ x: 14, y: 14, w: 172, h: 104 }, rb(fx, fy, 190), rb(ex, ey, 120), rb(a1x, a1y, 200), rb(ox1, oy1 - 18, 210), rb(cx, cy + 34, 120), { x: hx - 110, y: hy - 4, w: 110, h: 22 }];
  return `<svg class="sq-map" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Map of New York State" style="width:100%;height:auto;display:block">
  <style>${CSS}</style>
  <defs><clipPath id="sqm-clip"><rect x="0" y="0" width="${W}" height="${H}" rx="22"/></clipPath>
    <radialGradient id="sqm-vig" cx="50%" cy="50%" r="75%"><stop offset="60%" stop-color="#7a5a1a" stop-opacity="0"/><stop offset="100%" stop-color="#7a5a1a" stop-opacity=".22"/></radialGradient></defs>
  <g clip-path="url(#sqm-clip)">
    <rect width="${W}" height="${H}" fill="#f1e2b8"/>
    <g stroke="#d8c48e" stroke-width="1.2" stroke-dasharray="3 7" fill="none" opacity=".8">${[41, 42, 43, 44, 45].map((la) => `<path d="M0 ${px(-80, la)[1]}H${W}"/>`).join('')}${[-79, -78, -77, -76, -75, -74, -73, -72].map((lo) => `<path d="M${px(lo, 45)[0]} 0V${H}"/>`).join('')}</g>
    <path d="${poly(ATLANTIC)}" fill="${water}"/><path d="${poly(ERIE)}" fill="${water}"/><path d="${poly(ONTARIO)}" fill="${water}"/>
    ${line(STLAWRENCE, 7)}${line(CHAMPLAIN, 6)}${line(NIAGARA, 5)}
    <path d="${state}" transform="translate(5 6)" fill="#7a5a1a" opacity=".22"/>
    <path d="${state}" fill="#fff3c9" stroke="#c9a14a" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="${state}" fill="none" stroke="#fff8e4" stroke-width="1.4" stroke-dasharray="1 6" stroke-linecap="round" transform="translate(0 0)" opacity="0"/>
    <path d="${poly(ONTARIO)}" fill="${water}"/><path d="${poly(ERIE)}" fill="${water}"/>
    <path d="${curve(NY.slice(0, 29).concat([]))}" fill="none" stroke="#c9a14a" stroke-width="0"/>
    <path d="${poly(ADIRONDACKS)}" fill="#cfe3a4" opacity=".75" stroke="#a9c97c" stroke-width="2" stroke-linejoin="round"/>
    <path d="${poly(CATSKILLS)}" fill="#cfe3a4" opacity=".75" stroke="#a9c97c" stroke-width="2" stroke-linejoin="round"/>
    ${peaks(ADIRONDACKS, 15, 7, 1)}${peaks(CATSKILLS, 6, 3, 0.8)}
    ${FINGERS.map((a) => lakeLine(a, 7)).join('')}${OTHER_LAKES.map((a, i) => lakeLine(a, [7, 5, 5, 5][i])).join('')}
    <path d="${curve(MOHAWK)}" fill="none" stroke="${water}" stroke-width="3.2" stroke-linecap="round"/>
    ${line(HUDSON, 5)}
    <path d="${curve(CANAL)}" fill="none" stroke="#3f8fc0" stroke-width="2.6" stroke-dasharray="7 6" stroke-linecap="round" opacity=".55"/>
    ${sailboat(...P(-77.4, 43.78), 1.1)}${sailboat(...P(-78.6, 43.55), 0.9)}${sailboat(...P(-72.45, 40.78), 1)}
    ${txt('LAKE ONTARIO', ox1, oy1 - 18, { i: 1, c: '#2f7fa8', s: 17, ls: 3 })}${txt('LAKE ERIE', ...P(-79.38, 42.62), { i: 1, c: '#2f7fa8', s: 12, ls: 1.5, rot: -42 })}
    ${txt('ADIRONDACKS', a1x, a1y, { c: '#3f7a3c', s: 17, ls: 3 })}${txt('CATSKILLS', cx, cy + 34, { c: '#3f7a3c', s: 15, ls: 2 })}
    ${txt('FINGER LAKES', fx, fy, { c: '#2f7fa8', s: 15, ls: 2.5 })}${txt('ERIE CANAL', ex, ey, { c: '#2f7fa8', s: 14, ls: 2, o: 0.85 })}
    ${txt('Hudson River', hx - 14, hy + 14, { c: '#2f7fa8', s: 14, i: 1, o: 0.9, a: 'end' })}${txt('LONG ISLAND', liX, liY, { c: '#8a6a2c', s: 13, ls: 2 })}
    ${txt('PENNSYLVANIA', ...P(-76.9, 41.4), { s: 20, ls: 4, o: 0.55 })}${txt('NEW JERSEY', ...P(-74.95, 40.8), { s: 13, ls: 2, o: 0.55 })}${txt('VERMONT', ...P(-72.5, 43.55), { s: 15, ls: 3, o: 0.55 })}${txt('MASS.', ...P(-72.55, 42.35), { s: 14, ls: 2, o: 0.55 })}${txt('CONN.', ...P(-72.6, 41.62), { s: 14, ls: 2, o: 0.55 })}
    ${compass(66, 492)}
    ${insetSvg(usRoute)}
    <g class="sqm-pins">${pinsSvg(cities, highlight, visited, avoid)}</g>
    <rect width="${W}" height="${H}" fill="url(#sqm-vig)" pointer-events="none"/>
  </g>
  <rect x="2.5" y="2.5" width="${W - 5}" height="${H - 5}" rx="20" fill="none" stroke="#c9a14a" stroke-width="5" pointer-events="none"/><rect x="11" y="11" width="${W - 22}" height="${H - 22}" rx="14" fill="none" stroke="#e0c27a" stroke-width="1.5" pointer-events="none"/>
</svg>`;
}

/**
 * drawMap(el, { cities, highlight, visited, arc = 'ny', usRoute }) -> { svg, pins, update }
 * cities: [{ id, name, coords: { x, y } }] (x,y 0..1 over MAP_BOX, see the comment at the top). highlight: a city id (glowing pin). visited: [ids] (stamped pins).
 */
export function drawMap(el, opts = {}) {
  el.innerHTML = mapSvg(opts);
  const svg = el.querySelector('svg');
  const pins = {};
  svg.querySelectorAll('[data-city]').forEach((g) => { pins[g.getAttribute('data-city')] = g; });
  svg.addEventListener('keydown', (e) => {
    const g = e.target && e.target.closest && e.target.closest('[data-city]');
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); g.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }
  });
  const update = ({ highlight, visited } = {}) => {
    for (const [id, g] of Object.entries(pins)) {
      if (highlight !== undefined) g.classList.toggle('is-hl', highlight === id);
      if (visited) g.classList.toggle('is-visited', visited.includes(id));
    }
  };
  return { svg, pins, update };
}

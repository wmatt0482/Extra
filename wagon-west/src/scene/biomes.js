// Wagon West biomes: the six landscapes of the trail (SPEC §3, §11) and their parallax layers. Each biome is a palette
// plus five layer painters (far, mid, near, ground, props). A layer is painted ONCE per (biome, size) into an
// off-screen tile one period wide and is then only scrolled with drawImage, so a frame costs a few blits however
// detailed the art is (the house approach of Trail Blazer's backdrops; cheap on software-rasterised phone canvases).
// Tiles wrap seamlessly: ridges are sums of sines with whole periods per tile, and objects near an edge are drawn
// twice (at x and x ± P).
//
// Layout (css px, y down) comes from layout() in engine.js: W, H, k (size factor), gy (the wagon's ground line), P
// (the tile period), and the vertical bands of each layer.

import { TAU, OUT, hashStr, shade, mix, mkCanvas, rrect } from './util.js';
import { drawPerson, personLook } from './sprites.js';

export const BIOME_IDS = ['prairie', 'bluffs', 'highdesert', 'mountains', 'gorge', 'valley', 'basin', 'sierra', 'siskiyou', 'goldcountry', 'sea'];

export const BIOMES = {
  prairie: { sky: ['#62b8ea', '#d6f1fb'], far: '#9cc4a6', mid: '#86b85a', near: '#5f9a3e', ground: '#a8c45c', trail: '#cda56a', accent: '#f3c623', water: '#4f9fd0' },
  bluffs: { sky: ['#6db8e6', '#f6e6c8'], far: '#d2a47c', mid: '#c99a63', near: '#8f9a5a', ground: '#c4b277', trail: '#dcb47c', accent: '#e8a23a', water: '#5a9ec8' },
  highdesert: { sky: ['#86c6ea', '#f7ead0'], far: '#a993b6', mid: '#c4a679', near: '#94a07c', ground: '#d6bf8a', trail: '#e2c690', accent: '#d97a4a', water: '#5aa6c8' },
  mountains: { sky: ['#5aa8e2', '#d8f0fb'], far: '#7f90b4', mid: '#3f7a5a', near: '#2f6a48', ground: '#7d9c55', trail: '#b8925f', accent: '#e8e8f0', water: '#4f94c8' },
  gorge: { sky: ['#7ab0d6', '#e2eff2'], far: '#98a7c2', mid: '#5c5a66', near: '#2e6a4c', ground: '#6e9a52', trail: '#ad8b5f', accent: '#f0f0f6', water: '#3f86b8' },
  valley: { sky: ['#68bdf0', '#e8f7fc'], far: '#8aa7cc', mid: '#7cbf5a', near: '#4f9a3e', ground: '#8cc256', trail: '#bd975e', accent: '#ff7aa8', water: '#4fa2d8' },
  // v1.5 (SPEC v1.5 §4.1)
  basin: { sky: ['#86c6ea', '#f6ebd2'], far: '#a4b4d2', mid: '#cdbd92', near: '#8e9c7a', ground: '#e6dcbe', trail: '#f1e6c4', accent: '#f0c870', water: '#5aa6c8' },
  sierra: { sky: ['#4c98da', '#d6ecfb'], far: '#9aa6bc', mid: '#2e5645', near: '#27493a', ground: '#a9a6a0', trail: '#cdc6b8', accent: '#ffffff', water: '#6fb0d8' },
  siskiyou: { sky: ['#6cb4e8', '#e9f4f0'], far: '#8ea8cc', mid: '#6f8c4a', near: '#2f6a44', ground: '#a69c7c', trail: '#c9b58b', accent: '#7a3a8a', water: '#4f9fc8' },
  goldcountry: { sky: ['#6fb7ea', '#fbeccb'], far: '#c9a47a', mid: '#d6b358', near: '#6f8a3e', ground: '#bf7a4a', trail: '#dc9c68', accent: '#f3c623', water: '#7bb0c0' },
  sea: { sky: ['#79c4ee', '#f2f6f0'], far: '#a8c8cf', mid: '#2f8fb8', near: '#1f6f9c', ground: '#b98a54', trail: '#c89a62', accent: '#ffffff', water: '#2f8fb8' },
};
export const biomeOf = (id) => (BIOMES[id] ? id : 'prairie');

// ---------------------------------------------------------------- primitives (canvas px, y down)
// a periodic ridge: returns y(x) so objects can sit on it
function ridgeFn(P, base, amp, rand, n1 = 2 + Math.floor(rand() * 3), n2 = 5 + Math.floor(rand() * 5), j = 0) {
  const p1 = rand() * TAU, p2 = rand() * TAU, n3 = 11 + Math.floor(rand() * 6), p3 = rand() * TAU;
  return (x) => {
    const u = x / P;
    return base - amp * (0.55 + 0.3 * Math.sin(u * TAU * n1 + p1) + 0.15 * Math.sin(u * TAU * n2 + p2) + j * Math.sin(u * TAU * n3 + p3));
  };
}
function fillRidge(c, P, yAt, bottom, fill, line, lw) {
  c.beginPath(); c.moveTo(-8, bottom + 2);
  for (let x = -8; x < P + 8; x += 6) c.lineTo(x, yAt(x));
  c.lineTo(P + 8, yAt(P + 8)); c.lineTo(P + 8, bottom + 2); c.closePath();
  c.fillStyle = fill; c.fill();
  if (line) { c.lineWidth = lw; c.strokeStyle = line; c.lineJoin = 'round'; c.stroke(); }
}
// objects near a tile edge are painted twice; the painters' rand is rewound so both copies draw the same object
let curRand = null;
function wrap(P, x, rad, fn) {
  const st = curRand ? curRand.get() : 0;
  fn(x);
  const end = curRand ? curRand.get() : 0;
  if (x - rad < 0) { if (curRand) curRand.set(st); fn(x + P); }
  if (x + rad > P) { if (curRand) curRand.set(st); fn(x - P); }
  if (curRand) curRand.set(end);
}
// mulberry32 with its state exposed (for wrap's rewind)
function rng(seed) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.get = () => a; f.set = (v) => { a = v; };
  return f;
}

function pine(c, x, y, w, h, fill, line, lw) {
  c.beginPath();
  c.moveTo(x - w * 0.08, y); c.lineTo(x - w * 0.08, y - h * 0.12); c.lineTo(x - w * 0.5, y - h * 0.12);
  c.lineTo(x - w * 0.22, y - h * 0.42); c.lineTo(x - w * 0.4, y - h * 0.42); c.lineTo(x - w * 0.14, y - h * 0.7);
  c.lineTo(x - w * 0.28, y - h * 0.7); c.lineTo(x, y - h); c.lineTo(x + w * 0.28, y - h * 0.7); c.lineTo(x + w * 0.14, y - h * 0.7);
  c.lineTo(x + w * 0.4, y - h * 0.42); c.lineTo(x + w * 0.22, y - h * 0.42); c.lineTo(x + w * 0.5, y - h * 0.12);
  c.lineTo(x + w * 0.08, y - h * 0.12); c.lineTo(x + w * 0.08, y); c.closePath();
  c.fillStyle = fill; c.fill();
  if (line) { c.lineWidth = lw; c.strokeStyle = line; c.lineJoin = 'round'; c.stroke(); }
}
function blobTree(c, x, y, h, trunk, leaf, line, lw) {
  c.beginPath(); c.moveTo(x - h * 0.05, y); c.lineTo(x - h * 0.03, y - h * 0.55); c.lineTo(x + h * 0.03, y - h * 0.55); c.lineTo(x + h * 0.05, y); c.closePath();
  c.fillStyle = trunk; c.fill(); if (line) { c.lineWidth = lw; c.strokeStyle = line; c.stroke(); }
  c.beginPath();
  c.arc(x, y - h * 0.7, h * 0.28, 0, TAU);
  c.moveTo(x - h * 0.2 + h * 0.22, y - h * 0.55); c.arc(x - h * 0.2, y - h * 0.55, h * 0.22, 0, TAU);
  c.moveTo(x + h * 0.22 + h * 0.2, y - h * 0.58); c.arc(x + h * 0.22, y - h * 0.58, h * 0.2, 0, TAU);
  c.fillStyle = leaf; c.fill();
  if (line) { c.lineWidth = lw; c.strokeStyle = line; c.stroke(); }
  c.beginPath(); c.arc(x - h * 0.08, y - h * 0.8, h * 0.1, 0, TAU); c.fillStyle = shade(leaf, 0.18); c.fill();
}
function sage(c, x, y, r, fill, line, lw) {
  c.beginPath();
  c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI, true);
  c.moveTo(x - r * 0.2 + r * 0.7, y - r * 0.3); c.arc(x - r * 0.2, y - r * 0.3, r * 0.7, 0, Math.PI, true);
  c.moveTo(x + r * 0.5 + r * 0.6, y - r * 0.2); c.arc(x + r * 0.5, y - r * 0.2, r * 0.6, 0, Math.PI, true);
  c.fillStyle = fill; c.fill();
  if (line) { c.lineWidth = lw; c.strokeStyle = line; c.stroke(); }
}
function grass(c, x, y, h, col, lw) {
  c.beginPath();
  for (let i = -3; i <= 3; i++) { c.moveTo(x + i * h * 0.12, y); c.quadraticCurveTo(x + i * h * 0.16, y - h * 0.6, x + i * h * 0.3, y - h * (0.7 + 0.3 * Math.cos(i))); }
  c.lineWidth = lw; c.lineCap = 'round'; c.strokeStyle = col; c.stroke(); c.lineCap = 'butt';
}
function rock(c, x, y, r, fill, line, lw) {
  c.beginPath(); c.moveTo(x - r, y); c.lineTo(x - r * 0.8, y - r * 0.6); c.lineTo(x - r * 0.2, y - r * 0.9); c.lineTo(x + r * 0.6, y - r * 0.7); c.lineTo(x + r, y); c.closePath();
  c.fillStyle = fill; c.fill(); if (line) { c.lineWidth = lw; c.strokeStyle = line; c.lineJoin = 'round'; c.stroke(); }
  c.beginPath(); c.moveTo(x - r * 0.5, y - r * 0.55); c.lineTo(x - r * 0.15, y - r * 0.75); c.lineWidth = lw * 0.8; c.strokeStyle = shade(fill, 0.25); c.stroke();
}
function mesa(c, x, base, w, h, fill, line, lw) {
  c.beginPath();
  c.moveTo(x - w * 0.5, base); c.lineTo(x - w * 0.36, base - h * 0.55); c.lineTo(x - w * 0.3, base - h * 0.62); c.lineTo(x - w * 0.27, base - h);
  c.lineTo(x + w * 0.24, base - h); c.lineTo(x + w * 0.3, base - h * 0.7); c.lineTo(x + w * 0.38, base - h * 0.5); c.lineTo(x + w * 0.5, base); c.closePath();
  c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = line; c.lineJoin = 'round'; c.stroke();
  c.beginPath(); // strata
  for (let i = 1; i < 4; i++) { const yy = base - h * (0.2 + i * 0.18); c.moveTo(x - w * (0.42 - i * 0.04), yy); c.lineTo(x + w * (0.42 - i * 0.04), yy); }
  c.lineWidth = lw * 0.7; c.strokeStyle = shade(fill, -0.14); c.stroke();
}
function peak(c, x, base, w, h, fill, snow, line, lw) {
  c.beginPath(); c.moveTo(x - w * 0.5, base); c.lineTo(x - w * 0.08, base - h * 0.96); c.lineTo(x, base - h); c.lineTo(x + w * 0.1, base - h * 0.92); c.lineTo(x + w * 0.5, base); c.closePath();
  c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = line; c.lineJoin = 'round'; c.stroke();
  // shaded right flank
  c.beginPath(); c.moveTo(x, base - h); c.lineTo(x + w * 0.1, base - h * 0.92); c.lineTo(x + w * 0.5, base); c.lineTo(x + w * 0.12, base); c.closePath();
  c.fillStyle = shade(fill, -0.12); c.fill();
  if (snow) {
    c.beginPath(); c.moveTo(x - w * 0.08, base - h * 0.96); c.lineTo(x, base - h); c.lineTo(x + w * 0.1, base - h * 0.92);
    c.lineTo(x + w * 0.2, base - h * 0.7); c.lineTo(x + w * 0.1, base - h * 0.74); c.lineTo(x + w * 0.02, base - h * 0.66); c.lineTo(x - w * 0.08, base - h * 0.74); c.lineTo(x - w * 0.19, base - h * 0.66); c.closePath();
    c.fillStyle = snow; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = line; c.stroke();
  }
}
function fencePosts(c, P, yAt, col, line, lw, step, h) {
  c.beginPath();
  for (let x = 0; x < P; x += step) { const y = yAt(x); c.rect(x - lw, y - h, lw * 2, h); }
  c.fillStyle = col; c.fill(); c.lineWidth = lw * 0.5; c.strokeStyle = line; c.stroke();
  c.beginPath();
  for (const f of [0.35, 0.7]) { c.moveTo(0, yAt(0) - h * f); for (let x = 6; x <= P; x += 6) c.lineTo(x, yAt(x) - h * f); }
  c.lineWidth = lw; c.strokeStyle = col; c.stroke();
}

// ---------------------------------------------------------------- layer painters (c in css px, absolute y)
const FAR = {
  prairie(c, P, L, r, pal) {
    const [y0, yb] = L.bands.far, y1 = L.base.far;
    fillRidge(c, P, ridgeFn(P, y1 - (y1 - y0) * 0.1, L.H * 0.05, r), yb, mix(pal.far, pal.sky[1], 0.4), null);
    fillRidge(c, P, ridgeFn(P, yb, L.H * 0.06, r), y1, pal.far, mix(pal.far, '#203040', 0.3), 1.6);
  },
  bluffs(c, P, L, r, pal) {
    const [y0, yb] = L.bands.far, y1 = L.base.far, k = L.k;
    fillRidge(c, P, ridgeFn(P, yb, L.H * 0.04, r), y1, mix(pal.far, pal.sky[1], 0.35), null);
    const line = mix(pal.far, '#3a2015', 0.4);
    for (let i = 0; i < 5; i++) { const x = (i + r() * 0.6) * (P / 5), w = (60 + r() * 90) * k, h = (40 + r() * 50) * k; wrap(P, x, w / 2, (xx) => mesa(c, xx, y1 + 2, w, h, shade(pal.far, (r() - 0.5) * 0.12), line, 1.8)); }
    fillRidge(c, P, ridgeFn(P, y1 + 4, L.H * 0.025, r), yb, shade(pal.far, -0.06), line, 1.6);
  },
  highdesert(c, P, L, r, pal) {
    const yb = L.bands.far[1], y1 = L.base.far;
    fillRidge(c, P, ridgeFn(P, y1 - L.H * 0.02, L.H * 0.12, r, 3, 8, 0.25), yb, mix(pal.far, pal.sky[1], 0.45), null);
    fillRidge(c, P, ridgeFn(P, yb, L.H * 0.09, r, 4, 9, 0.2), y1, pal.far, mix(pal.far, '#20203a', 0.35), 1.6);
  },
  mountains(c, P, L, r, pal) {
    const [y0, yb] = L.bands.far, y1 = L.base.far, k = L.k, line = mix(pal.far, '#101830', 0.4);
    const n = 7;
    for (let i = 0; i < n; i++) { const x = (i + r() * 0.5) * (P / n), w = (150 + r() * 120) * k, h = Math.min((y1 - y0) * 0.95, (90 + r() * 80) * k); const col = mix(pal.far, pal.sky[1], 0.25 + r() * 0.2); wrap(P, x, w / 2, (xx) => peak(c, xx, y1 + 2, w * 1.2, h * 0.8, col, '#f4f6fb', line, 1.4)); }
    for (let i = 0; i < n; i++) { const x = (i + 0.5 + r() * 0.4) * (P / n), w = (130 + r() * 110) * k, h = Math.min((y1 - y0) * 0.95, (100 + r() * 90) * k); wrap(P, x, w / 2, (xx) => peak(c, xx, y1 + 2, w, h, pal.far, '#ffffff', line, 1.6)); }
  },
  gorge(c, P, L, r, pal) {
    const [y0, yb] = L.bands.far, y1 = L.base.far, k = L.k, line = mix(pal.far, '#101830', 0.4);
    fillRidge(c, P, ridgeFn(P, yb, L.H * 0.06, r), y1, mix(pal.far, pal.sky[1], 0.35), null);
    // the big volcano (Mount Hood) once per tile, a smaller one opposite
    wrap(P, P * 0.3, 160 * k, (xx) => peak(c, xx, y1 + 2, 300 * k, Math.min((y1 - y0) * 0.98, 170 * k), pal.far, '#ffffff', line, 1.6));
    wrap(P, P * 0.78, 100 * k, (xx) => peak(c, xx, y1 + 2, 180 * k, Math.min((y1 - y0) * 0.9, 95 * k), mix(pal.far, pal.sky[1], 0.2), '#ffffff', line, 1.4));
  },
  valley(c, P, L, r, pal) {
    const [y0, yb] = L.bands.far, y1 = L.base.far, k = L.k, line = mix(pal.far, '#101830', 0.35);
    for (let i = 0; i < 4; i++) { const x = (i + r() * 0.6) * (P / 4), w = (200 + r() * 100) * k, h = Math.min((y1 - y0) * 0.8, (60 + r() * 50) * k); wrap(P, x, w / 2, (xx) => peak(c, xx, y1 + 2, w, h, mix(pal.far, pal.sky[1], 0.2), i % 2 ? '#ffffff' : null, line, 1.4)); }
    fillRidge(c, P, ridgeFn(P, yb, L.H * 0.04, r), y1, pal.far, line, 1.4);
  },
};
const MID = {
  prairie(c, P, L, r, pal) {
    const yb = L.bands.mid[1], y1 = L.base.mid, k = L.k, line = shade(pal.mid, -0.35);
    const y = ridgeFn(P, y1 - L.H * 0.01, L.H * 0.07, r);
    fillRidge(c, P, y, yb, pal.mid, line, 2);
    for (let i = 0; i < 6; i++) { const x = r() * P, h = (34 + r() * 22) * k; wrap(P, x, h * 0.5, (xx) => blobTree(c, xx, y(x) + 3, h, '#7a5a3a', shade(pal.mid, -0.12 - r() * 0.1), line, 1.6)); }
  },
  bluffs(c, P, L, r, pal) {
    const yb = L.bands.mid[1], y1 = L.base.mid, k = L.k, line = shade(pal.mid, -0.4);
    const y = ridgeFn(P, y1 - L.H * 0.01, L.H * 0.05, r);
    for (let i = 0; i < 2; i++) { const x = (i + 0.3 + r() * 0.4) * (P / 2), w = (110 + r() * 60) * k, h = (60 + r() * 40) * k; wrap(P, x, w / 2, (xx) => mesa(c, xx, y(x) + 6, w, h, shade(pal.mid, 0.06), line, 2)); }
    fillRidge(c, P, y, yb, pal.mid, line, 2);
  },
  highdesert(c, P, L, r, pal) {
    const yb = L.bands.mid[1], y1 = L.base.mid, k = L.k, line = shade(pal.mid, -0.38);
    const y = ridgeFn(P, y1 - L.H * 0.01, L.H * 0.06, r);
    fillRidge(c, P, y, yb, pal.mid, line, 2);
    for (let i = 0; i < 22; i++) { const x = r() * P; wrap(P, x, 10 * k, (xx) => sage(c, xx, y(x) + 6 * k + r() * 10 * k, (5 + r() * 4) * k, shade(pal.near, 0.1), null, 0)); }
  },
  mountains(c, P, L, r, pal) {
    const yb = L.bands.mid[1], y1 = L.base.mid, k = L.k, line = shade(pal.mid, -0.4);
    const y = ridgeFn(P, y1 - L.H * 0.02, L.H * 0.1, r);
    fillRidge(c, P, y, yb, pal.mid, line, 2);
    for (let i = 0; i < 34; i++) { const x = r() * P, h = (22 + r() * 18) * k; wrap(P, x, h * 0.3, (xx) => pine(c, xx, y(x) + 4 + r() * 14 * k, h * 0.55, h, shade(pal.mid, -0.1 - r() * 0.12), line, 1.2)); }
  },
  gorge(c, P, L, r, pal) {
    const [y0, yb] = L.bands.mid, y1 = L.base.mid, k = L.k, line = shade(pal.mid, -0.45);
    // basalt cliffs with columns, and the river at their foot
    const y = ridgeFn(P, y0 + (y1 - y0) * 0.45, L.H * 0.08, r, 2, 7, 0.3);
    fillRidge(c, P, y, yb, pal.mid, line, 2);
    c.beginPath();
    for (let x = 4; x < P; x += 9 * k) { c.moveTo(x, y(x) + 6); c.lineTo(x, y1 - L.H * 0.04); }
    c.lineWidth = 1.4; c.strokeStyle = shade(pal.mid, -0.22); c.stroke();
    for (let i = 0; i < 28; i++) { const x = r() * P; wrap(P, x, 8 * k, (xx) => pine(c, xx, y(x) + 4, 8 * k, 16 * k, '#3a6a4a', null, 0)); }
    const wy = y1 - L.H * 0.045;
    c.beginPath(); c.rect(-2, wy, P + 4, yb - wy + 2); c.fillStyle = pal.water; c.fill();
    c.beginPath(); for (let i = 0; i < 18; i++) { const x = r() * P, yy = wy + 3 + r() * (y1 - wy - 6); c.moveTo(x, yy); c.lineTo(x + 14 * k, yy); }
    c.lineWidth = 1.6; c.strokeStyle = shade(pal.water, 0.35); c.stroke();
  },
  valley(c, P, L, r, pal) {
    const yb = L.bands.mid[1], y1 = L.base.mid, k = L.k, line = shade(pal.mid, -0.35);
    const y = ridgeFn(P, y1 - L.H * 0.01, L.H * 0.06, r);
    fillRidge(c, P, y, yb, pal.mid, line, 2);
    // field patches (stripes) on the hills
    for (let i = 0; i < 5; i++) {
      const x = (i + r() * 0.5) * (P / 5), w = (60 + r() * 50) * k, top = y(x) + 8 * k, h = 14 * k;
      const col = ['#e8c75a', '#a6cf5a', '#c9a35a'][i % 3];
      wrap(P, x, w, (xx) => { c.beginPath(); c.moveTo(xx - w * 0.5, top + h); c.lineTo(xx - w * 0.4, top); c.lineTo(xx + w * 0.4, top); c.lineTo(xx + w * 0.5, top + h); c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = 1.2; c.strokeStyle = line; c.stroke();
        c.beginPath(); for (let s = 1; s < 4; s++) { c.moveTo(xx - w * 0.45 + s * 2, top + (h * s) / 4); c.lineTo(xx + w * 0.45 - s * 2, top + (h * s) / 4); } c.lineWidth = 1; c.strokeStyle = shade(col, -0.2); c.stroke(); });
    }
    for (let i = 0; i < 6; i++) { const x = r() * P, h = (26 + r() * 16) * k; wrap(P, x, h * 0.5, (xx) => blobTree(c, xx, y(x) + 4, h, '#6a4a2a', shade(pal.mid, -0.18), line, 1.4)); }
  },
};
const NEAR = {
  prairie(c, P, L, r, pal) {
    const yb = L.bands.near[1], y1 = L.base.near, k = L.k, line = shade(pal.near, -0.35);
    const y = ridgeFn(P, y1 - L.H * 0.005, L.H * 0.035, r);
    fillRidge(c, P, y, yb, pal.near, line, 2.2);
    for (let i = 0; i < 26; i++) { const x = r() * P; wrap(P, x, 12 * k, (xx) => grass(c, xx, y(x) + 6 * k, (12 + r() * 10) * k, shade(pal.near, -0.15), 2 * k)); }
    c.beginPath(); for (let i = 0; i < 30; i++) { const x = r() * P, yy = y(x) + (4 + r() * 10) * k; c.moveTo(x + 2.4 * k, yy); c.arc(x, yy, 2.4 * k, 0, TAU); }
    c.fillStyle = pal.accent; c.fill();
  },
  bluffs(c, P, L, r, pal) {
    const yb = L.bands.near[1], y1 = L.base.near, k = L.k, line = shade(pal.near, -0.4);
    const y = ridgeFn(P, y1 - L.H * 0.005, L.H * 0.03, r);
    fillRidge(c, P, y, yb, shade(pal.ground, -0.08), shade(pal.ground, -0.4), 2.2);
    for (let i = 0; i < 14; i++) { const x = r() * P; wrap(P, x, 16 * k, (xx) => sage(c, xx, y(x) + 8 * k, (8 + r() * 6) * k, pal.near, line, 1.6)); }
    for (let i = 0; i < 5; i++) { const x = r() * P; wrap(P, x, 12 * k, (xx) => grass(c, xx, y(x) + 8 * k, 16 * k, '#6f8a3a', 2.6 * k)); }
  },
  highdesert(c, P, L, r, pal) {
    const yb = L.bands.near[1], y1 = L.base.near, k = L.k, line = shade(pal.near, -0.4);
    const y = ridgeFn(P, y1 - L.H * 0.005, L.H * 0.03, r);
    fillRidge(c, P, y, yb, shade(pal.ground, -0.06), shade(pal.ground, -0.4), 2.2);
    for (let i = 0; i < 16; i++) { const x = r() * P; wrap(P, x, 16 * k, (xx) => sage(c, xx, y(x) + 8 * k, (7 + r() * 6) * k, pal.near, line, 1.6)); }
    for (let i = 0; i < 6; i++) { const x = r() * P; wrap(P, x, 14 * k, (xx) => rock(c, xx, y(x) + 9 * k, (7 + r() * 7) * k, '#a08a74', shade('#a08a74', -0.45), 1.6)); }
  },
  mountains(c, P, L, r, pal) {
    const yb = L.bands.near[1], y1 = L.base.near, k = L.k, line = shade(pal.near, -0.4);
    const y = ridgeFn(P, y1 - L.H * 0.005, L.H * 0.035, r);
    for (let i = 0; i < 12; i++) { const x = r() * P, h = (50 + r() * 34) * k; wrap(P, x, h * 0.3, (xx) => pine(c, xx, y(x) + 6, h * 0.5, h, shade(pal.near, -0.05 - r() * 0.1), line, 1.6)); }
    fillRidge(c, P, y, yb, shade(pal.ground, -0.1), shade(pal.ground, -0.45), 2.2);
    for (let i = 0; i < 6; i++) { const x = r() * P; wrap(P, x, 14 * k, (xx) => rock(c, xx, y(x) + 9 * k, (8 + r() * 8) * k, '#9a9aa4', '#3a3a48', 1.6)); }
  },
  gorge(c, P, L, r, pal) {
    const yb = L.bands.near[1], y1 = L.base.near, k = L.k, line = shade(pal.near, -0.4);
    const y = ridgeFn(P, y1 - L.H * 0.005, L.H * 0.035, r);
    for (let i = 0; i < 14; i++) { const x = r() * P, h = (56 + r() * 40) * k; wrap(P, x, h * 0.3, (xx) => pine(c, xx, y(x) + 6, h * 0.42, h, shade(pal.near, -r() * 0.12), line, 1.6)); }
    fillRidge(c, P, y, yb, shade(pal.ground, -0.12), shade(pal.ground, -0.45), 2.2);
    for (let i = 0; i < 14; i++) { const x = r() * P; wrap(P, x, 12 * k, (xx) => grass(c, xx, y(x) + 8 * k, 14 * k, '#3f7a3a', 3 * k)); }
  },
  valley(c, P, L, r, pal) {
    const yb = L.bands.near[1], y1 = L.base.near, k = L.k, line = shade(pal.near, -0.35);
    const y = ridgeFn(P, y1 - L.H * 0.005, L.H * 0.03, r);
    for (let i = 0; i < 5; i++) { const x = r() * P, h = (52 + r() * 24) * k; wrap(P, x, h * 0.5, (xx) => blobTree(c, xx, y(x) + 8, h, '#6a4a2a', shade(pal.near, -r() * 0.12), line, 1.8)); }
    fillRidge(c, P, y, yb, pal.near, line, 2.2);
    fencePosts(c, P, (x) => y(x) + 10 * k, '#a0703e', OUT, 2 * k, 46 * k, 16 * k);
    c.beginPath(); for (let i = 0; i < 40; i++) { const x = r() * P, yy = y(x) + (4 + r() * 12) * k; c.moveTo(x + 2.6 * k, yy); c.arc(x, yy, 2.6 * k, 0, TAU); }
    c.fillStyle = pal.accent; c.fill();
  },
};
// the ground: the plain, the trail with its ruts, a little texture
function paintGround(c, P, L, r, pal, id, o) {
  const [y0] = L.bands.ground, k = L.k, H = L.H, gy = L.gy;
  c.fillStyle = pal.ground; c.fillRect(-2, y0, P + 4, H - y0 + 2);
  const t0 = gy - 12 * k, t1 = gy + 30 * k;
  // the trail band with a wavy lip (the edges run past the tile so nothing is stroked at the seam)
  const lipA = (x) => t0 + Math.sin((x / P) * TAU * 6) * 2 * k, lipB = (x) => t1 + Math.sin((x / P) * TAU * 5 + 1) * 2.5 * k;
  const edge = (close) => {
    c.moveTo(-10, lipA(-10));
    for (let x = -10; x < P + 10; x += 10) c.lineTo(x, lipA(x));
    c.lineTo(P + 10, lipA(P + 10));
    if (close) c.lineTo(P + 10, lipB(P + 10)); else c.moveTo(P + 10, lipB(P + 10));
    for (let x = P + 10; x > -10; x -= 10) c.lineTo(x, lipB(x));
    c.lineTo(-10, lipB(-10));
    if (close) c.closePath();
  };
  c.beginPath(); edge(true); c.fillStyle = pal.trail; c.fill();
  c.beginPath(); edge(false); c.lineWidth = 2; c.strokeStyle = shade(pal.trail, -0.25); c.stroke();
  // ruts
  c.beginPath(); c.moveTo(-2, gy - 5 * k); c.lineTo(P + 2, gy - 5 * k); c.moveTo(-2, gy + 1 * k); c.lineTo(P + 2, gy + 1 * k);
  c.moveTo(-2, gy + 19 * k); c.lineTo(P + 2, gy + 19 * k);
  c.lineWidth = 2.4 * k; c.strokeStyle = shade(pal.trail, -0.18); c.stroke();
  // pebbles in the trail, grass ticks off it
  c.beginPath();
  for (let i = 0; i < 40; i++) { const x = r() * P, yy = t0 + 4 * k + r() * (t1 - t0 - 8 * k); c.moveTo(x + 1.6 * k, yy); c.ellipse(x, yy, 1.8 * k, 1.1 * k, 0, 0, TAU); }
  c.fillStyle = shade(pal.trail, -0.2); c.fill();
  c.beginPath();
  for (let i = 0; i < 70; i++) {
    const x = r() * P, yy = r() < 0.4 ? y0 + 3 * k + r() * (t0 - y0 - 6 * k) : t1 + 4 * k + r() * (H - t1);
    c.moveTo(x, yy); c.lineTo(x - 2 * k, yy - 5 * k); c.moveTo(x + 2 * k, yy); c.lineTo(x + 3 * k, yy - 6 * k);
  }
  c.lineWidth = 1.6 * k; c.strokeStyle = shade(pal.ground, -0.18); c.stroke();
  groundExtra(id, c, P, L, r, pal, o);
}
const PROPS = {
  prairie(c, P, L, r, pal) {
    const k = L.k, H = L.H;
    for (let i = 0; i < 7; i++) { const x = r() * P, y = H + 4 * k - r() * 10 * k; wrap(P, x, 20 * k, (xx) => grass(c, xx, y, (22 + r() * 12) * k, shade(pal.near, -0.1), 3.2 * k)); }
    for (let i = 0; i < 3; i++) { const x = r() * P, y = H - 4 * k; wrap(P, x, 20 * k, (xx) => sunflower(c, xx, y, 40 * k, k)); }
  },
  bluffs(c, P, L, r, pal) {
    const k = L.k, H = L.H;
    for (let i = 0; i < 6; i++) { const x = r() * P; wrap(P, x, 24 * k, (xx) => sage(c, xx, H + 6 * k, (14 + r() * 8) * k, pal.near, shade(pal.near, -0.4), 2)); }
    for (let i = 0; i < 2; i++) { const x = r() * P; wrap(P, x, 20 * k, (xx) => rock(c, xx, H + 2 * k, 16 * k, '#c9a27a', shade('#c9a27a', -0.5), 2)); }
  },
  highdesert(c, P, L, r, pal) {
    const k = L.k, H = L.H;
    for (let i = 0; i < 6; i++) { const x = r() * P; wrap(P, x, 24 * k, (xx) => sage(c, xx, H + 6 * k, (14 + r() * 8) * k, pal.near, shade(pal.near, -0.4), 2)); }
    for (let i = 0; i < 3; i++) { const x = r() * P; wrap(P, x, 20 * k, (xx) => rock(c, xx, H + 2 * k, (12 + r() * 8) * k, '#a08a74', '#3a2a20', 2)); }
  },
  mountains(c, P, L, r, pal) {
    const k = L.k, H = L.H;
    for (let i = 0; i < 4; i++) { const x = r() * P; wrap(P, x, 24 * k, (xx) => rock(c, xx, H + 4 * k, (16 + r() * 10) * k, '#9a9aa4', '#30303a', 2)); }
    for (let i = 0; i < 6; i++) { const x = r() * P; wrap(P, x, 20 * k, (xx) => grass(c, xx, H + 4 * k, 24 * k, shade(pal.near, 0.1), 3 * k)); }
  },
  gorge(c, P, L, r, pal) {
    const k = L.k, H = L.H;
    for (let i = 0; i < 6; i++) { const x = r() * P; wrap(P, x, 30 * k, (xx) => fern(c, xx, H + 4 * k, (30 + r() * 10) * k, '#3f8a4a', k)); }
  },
  valley(c, P, L, r, pal) {
    const k = L.k, H = L.H;
    for (let i = 0; i < 6; i++) { const x = r() * P; wrap(P, x, 20 * k, (xx) => grass(c, xx, H + 4 * k, 22 * k, shade(pal.near, 0.05), 3 * k)); }
    c.beginPath(); for (let i = 0; i < 14; i++) { const x = r() * P, yy = H - (2 + r() * 14) * k; c.moveTo(x + 3.4 * k, yy); c.arc(x, yy, 3.4 * k, 0, TAU); }
    c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
  },
};
function sunflower(c, x, y, h, k) {
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 3 * k, y - h * 0.5, x, y - h); c.lineWidth = 3 * k; c.strokeStyle = '#4f7a2a'; c.stroke();
  c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; c.moveTo(x, y - h); c.ellipse(x + Math.cos(a) * 7 * k, y - h + Math.sin(a) * 7 * k, 5 * k, 2.6 * k, a, 0, TAU); }
  c.fillStyle = '#f3c623'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
  c.beginPath(); c.arc(x, y - h, 4.4 * k, 0, TAU); c.fillStyle = '#6a3a1a'; c.fill();
}
function fern(c, x, y, h, col, k) {
  c.beginPath();
  for (let i = -2; i <= 2; i++) {
    const a = -Math.PI / 2 + i * 0.42, ex = x + Math.cos(a) * h, ey = y + Math.sin(a) * h;
    c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * h * 0.6 + i * 4 * k, y + Math.sin(a) * h * 0.6, ex, ey);
    for (let s = 1; s < 5; s++) { const px = x + (ex - x) * (s / 5), py = y + (ey - y) * (s / 5); c.moveTo(px, py); c.lineTo(px - 5 * k, py - 3 * k); c.moveTo(px, py); c.lineTo(px + 5 * k, py - 3 * k); }
  }
  c.lineWidth = 2.4 * k; c.lineCap = 'round'; c.strokeStyle = col; c.stroke(); c.lineCap = 'butt';
}

// ---------------------------------------------------------------- v1.5: five new biomes (SPEC v1.5 §4.1)
// basin (the Humboldt, the Big Meadows, the Forty-Mile Desert), sierra (the summit, Castle Crags), siskiyou (the Umpqua to Mount
// Shasta), goldcountry (the Sacramento Valley and the diggings), sea (the voyage home). Painted once per size like the others.
function domePath(c, x, base, w, h) {
  const top = base - h;
  c.beginPath(); c.moveTo(x - w * 0.5, base);
  c.bezierCurveTo(x - w * 0.47, base - h * 0.55, x - w * 0.3, top + h * 0.02, x - w * 0.04, top);
  c.bezierCurveTo(x + w * 0.22, top + h * 0.03, x + w * 0.45, base - h * 0.5, x + w * 0.5, base);
  c.closePath();
}
// a granite dome: round shoulders, a shaded right flank, joint lines and (optionally) a snow cap with a ragged lower edge
function dome(c, x, base, w, h, fill, snow, line, lw) {
  const top = base - h;
  domePath(c, x, base, w, h); c.fillStyle = fill; c.fill();
  c.save(); domePath(c, x, base, w, h); c.clip();
  c.beginPath(); c.moveTo(x + w * 0.04, top); c.bezierCurveTo(x + w * 0.3, top + h * 0.1, x + w * 0.44, base - h * 0.5, x + w * 0.5, base); c.lineTo(x + w * 0.12, base);
  c.bezierCurveTo(x + w * 0.16, base - h * 0.5, x + w * 0.08, top + h * 0.3, x + w * 0.04, top); c.fillStyle = shade(fill, -0.13); c.fill();
  c.beginPath();
  for (let i = 1; i < 4; i++) { const yy = top + h * (0.34 + i * 0.16); c.moveTo(x - w * 0.42, yy + 6); c.quadraticCurveTo(x, yy - 9, x + w * 0.44, yy + 5); }
  c.lineWidth = lw * 0.6; c.strokeStyle = shade(fill, -0.2); c.stroke();
  if (snow) {
    c.beginPath(); c.moveTo(x - w * 0.52, top - 6); c.lineTo(x + w * 0.52, top - 6); c.lineTo(x + w * 0.52, top + h * 0.3);
    const n = 10;
    for (let i = n; i >= 0; i--) { const u = i / n; c.lineTo(x - w * 0.52 + w * 1.04 * u, top + h * (0.22 + 0.07 * Math.sin(u * 19 + x * 0.1) + (i % 2 ? 0.07 : 0))); }
    c.closePath(); c.fillStyle = snow; c.fill();
    c.beginPath(); c.moveTo(x + w * 0.04, top); c.bezierCurveTo(x + w * 0.2, top + h * 0.08, x + w * 0.3, top + h * 0.2, x + w * 0.34, top + h * 0.3); c.lineWidth = lw * 0.8; c.strokeStyle = 'rgba(120,150,200,0.45)'; c.stroke();
  }
  c.restore();
  domePath(c, x, base, w, h); c.lineWidth = lw; c.strokeStyle = line; c.lineJoin = 'round'; c.stroke();
}
// a ragged spire of granite (Castle Crags)
function spire(c, x, base, w, h, fill, line, lw) {
  c.beginPath(); c.moveTo(x - w * 0.5, base); c.lineTo(x - w * 0.34, base - h * 0.62); c.lineTo(x - w * 0.24, base - h * 0.7); c.lineTo(x - w * 0.12, base - h);
  c.lineTo(x + w * 0.02, base - h * 0.86); c.lineTo(x + w * 0.12, base - h * 0.98); c.lineTo(x + w * 0.26, base - h * 0.6); c.lineTo(x + w * 0.5, base); c.closePath();
  c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = line; c.lineJoin = 'round'; c.stroke();
  c.beginPath(); c.moveTo(x + w * 0.02, base - h * 0.86); c.lineTo(x + w * 0.12, base - h * 0.98); c.lineTo(x + w * 0.26, base - h * 0.6); c.lineTo(x + w * 0.5, base); c.lineTo(x + w * 0.1, base); c.closePath();
  c.fillStyle = shade(fill, -0.15); c.fill();
  c.beginPath(); c.moveTo(x - w * 0.12, base - h); c.lineTo(x - w * 0.1, base - h * 0.45); c.moveTo(x + w * 0.12, base - h * 0.98); c.lineTo(x + w * 0.1, base - h * 0.5);
  c.lineWidth = lw * 0.6; c.strokeStyle = shade(fill, -0.25); c.stroke();
}
function oak(c, x, y, h, trunk, leaf, line, lw) { // a wide round valley oak
  c.beginPath(); c.moveTo(x - h * 0.06, y); c.lineTo(x - h * 0.04, y - h * 0.5); c.lineTo(x + h * 0.04, y - h * 0.5); c.lineTo(x + h * 0.06, y); c.closePath();
  c.fillStyle = trunk; c.fill(); if (line) { c.lineWidth = lw; c.strokeStyle = line; c.stroke(); }
  c.beginPath(); c.moveTo(x + h * 0.4, y - h * 0.62);
  c.ellipse(x, y - h * 0.66, h * 0.44, h * 0.3, 0, 0, TAU);
  c.moveTo(x - h * 0.22 + h * 0.24, y - h * 0.82); c.arc(x - h * 0.22, y - h * 0.82, h * 0.24, 0, TAU);
  c.moveTo(x + h * 0.24 + h * 0.22, y - h * 0.84); c.arc(x + h * 0.24, y - h * 0.84, h * 0.22, 0, TAU);
  c.fillStyle = leaf; c.fill(); if (line) { c.lineWidth = lw; c.strokeStyle = line; c.stroke(); }
  c.beginPath(); c.ellipse(x - h * 0.12, y - h * 0.9, h * 0.12, h * 0.07, 0, 0, TAU); c.fillStyle = shade(leaf, 0.18); c.fill();
}
function willow(c, x, y, h, leaf, line, lw) { // a willow clump: a leafy mound with drooping fronds
  c.beginPath(); c.moveTo(x - h * 0.02, y); c.lineTo(x - h * 0.05, y - h * 0.45); c.lineTo(x + h * 0.05, y - h * 0.45); c.lineTo(x + h * 0.02, y); c.closePath(); c.fillStyle = '#6a5036'; c.fill();
  c.beginPath(); c.ellipse(x, y - h * 0.6, h * 0.4, h * 0.26, 0, 0, TAU); c.fillStyle = leaf; c.fill(); if (line) { c.lineWidth = lw; c.strokeStyle = line; c.stroke(); }
  c.beginPath();
  for (let i = -3; i <= 3; i++) { const fx = x + i * h * 0.12; c.moveTo(fx, y - h * 0.5); c.quadraticCurveTo(fx + i * h * 0.04, y - h * 0.3, fx + i * h * 0.05, y - h * 0.16); }
  c.lineWidth = lw * 1.4; c.lineCap = 'round'; c.strokeStyle = shade(leaf, -0.12); c.stroke(); c.lineCap = 'butt';
}
function tent(c, x, y, w, h, fill, line, lw) { // a miner's canvas tent
  c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x, y - h); c.lineTo(x + w / 2, y); c.closePath(); c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = line; c.lineJoin = 'round'; c.stroke();
  c.beginPath(); c.moveTo(x, y - h); c.lineTo(x - w * 0.12, y); c.lineTo(x + w * 0.12, y); c.closePath(); c.fillStyle = '#4a3326'; c.fill();
  c.beginPath(); c.moveTo(x - w * 0.3, y - h * 0.38); c.lineTo(x - w * 0.18, y - 1); c.moveTo(x + w * 0.3, y - h * 0.38); c.lineTo(x + w * 0.18, y - 1); c.lineWidth = lw * 0.6; c.strokeStyle = shade(fill, -0.2); c.stroke();
}
function snowMound(c, x, y, w, h, line, lw) {
  c.beginPath(); c.moveTo(x - w / 2, y); c.bezierCurveTo(x - w * 0.4, y - h, x - w * 0.12, y - h * 1.05, x + w * 0.05, y - h * 0.9); c.bezierCurveTo(x + w * 0.3, y - h * 1.0, x + w * 0.45, y - h * 0.5, x + w / 2, y); c.closePath();
  c.fillStyle = '#fbfdff'; c.fill(); c.lineWidth = lw; c.strokeStyle = line; c.lineJoin = 'round'; c.stroke();
  c.beginPath(); c.moveTo(x - w * 0.1, y - 2); c.quadraticCurveTo(x + w * 0.15, y - h * 0.5, x + w * 0.4, y - 2); c.lineWidth = lw * 0.8; c.strokeStyle = 'rgba(150,180,225,0.55)'; c.stroke();
}
function greasewood(c, x, y, r, fill, line, lw) { // a spiky grey-green desert bush
  c.beginPath();
  for (let i = -3; i <= 3; i++) { c.moveTo(x, y); c.lineTo(x + i * r * 0.28, y - r * (1.1 - Math.abs(i) * 0.14)); }
  c.lineWidth = lw * 1.3; c.lineCap = 'round'; c.strokeStyle = fill; c.stroke(); c.lineCap = 'butt';
  c.beginPath(); c.arc(x, y - r * 0.45, r * 0.55, Math.PI, 0); c.fillStyle = fill; c.fill(); if (line) { c.lineWidth = lw * 0.7; c.strokeStyle = line; c.stroke(); }
}
// the hills of one ridge with the snow along its top (patches that follow the ridge line)
function ridgeSnow(c, P, yAt, rand, n, k, wmin = 30, wvar = 50) {
  for (let i = 0; i < n; i++) {
    const x = rand() * P, w = (wmin + rand() * wvar) * k;
    wrap(P, x, w / 2, (xx) => {
      c.beginPath();
      for (let s = 0; s <= 8; s++) { const u = s / 8, px = xx - w / 2 + w * u; if (s === 0) c.moveTo(px, yAt(px - xx + x) + 1); else c.lineTo(px, yAt(px - xx + x) + 1); }
      for (let s = 8; s >= 0; s--) { const u = s / 8, px = xx - w / 2 + w * u; c.lineTo(px, yAt(px - xx + x) + 1 + 7 * k * Math.sin(Math.PI * u) + (s % 2) * 2 * k); }
      c.closePath(); c.fillStyle = '#f6f9ff'; c.fill();
    });
  }
}

const FAR15 = {
  basin(c, P, L, r, pal) { // pale blue ranges
    const [y0, yb] = L.bands.far, y1 = L.base.far, k = L.k, H = L.H, line = mix(pal.far, '#2a3150', 0.4);
    fillRidge(c, P, ridgeFn(P, y1 - H * 0.03, H * 0.1, r, 3, 9, 0.28), yb, mix(pal.far, pal.sky[1], 0.55), null);
    fillRidge(c, P, ridgeFn(P, yb, H * 0.08, r, 4, 10, 0.3), y1, mix(pal.far, pal.sky[1], 0.15), line, 1.5);
    for (let i = 0; i < 3; i++) { const x = (i + 0.2 + r() * 0.6) * (P / 3), w = (150 + r() * 80) * k, h = Math.min((y1 - y0) * 0.7, (60 + r() * 30) * k); wrap(P, x, w / 2, (xx) => peak(c, xx, y1 + 2, w, h, mix(pal.far, pal.sky[1], 0.25), '#f3f6fb', line, 1.3)); }
  },
  sierra(c, P, L, r, pal) { // granite domes and peaks with snow
    const [y0, yb] = L.bands.far, y1 = L.base.far, k = L.k, H = L.H, line = mix(pal.far, '#161e30', 0.5);
    fillRidge(c, P, ridgeFn(P, yb, H * 0.07, r, 3, 8, 0.22), y1, mix(pal.far, pal.sky[1], 0.5), null);
    const n = 6;
    for (let i = 0; i < n; i++) { const x = (i + r() * 0.5) * (P / n), w = (170 + r() * 110) * k, h = Math.min((y1 - y0) * 0.98, (110 + r() * 80) * k); wrap(P, x, w / 2, (xx) => peak(c, xx, y1 + 2, w * 1.15, h, mix(pal.far, pal.sky[1], 0.28), '#ffffff', line, 1.5)); }
    for (let i = 0; i < 4; i++) { const x = (i + 0.35 + r() * 0.3) * (P / 4), w = (220 + r() * 90) * k, h = Math.min((y1 - y0) * 0.9, (100 + r() * 60) * k); wrap(P, x, w / 2, (xx) => dome(c, xx, y1 + 2, w, h, pal.far, '#fbfdff', line, 1.7)); }
  },
  siskiyou(c, P, L, r, pal) { // blue ridges, three of them
    const [y0, yb] = L.bands.far, y1 = L.base.far, H = L.H, line = mix(pal.far, '#1c2848', 0.4);
    fillRidge(c, P, ridgeFn(P, y1 - H * 0.05, H * 0.1, r, 2, 7, 0.1), yb, mix(pal.far, pal.sky[1], 0.5), null);
    fillRidge(c, P, ridgeFn(P, y1 - H * 0.01, H * 0.08, r, 3, 8, 0.12), yb, mix(pal.far, pal.sky[1], 0.25), null);
    fillRidge(c, P, ridgeFn(P, yb, H * 0.06, r, 3, 9, 0.1), y1, pal.far, line, 1.5);
  },
  goldcountry(c, P, L, r, pal) { // low tan foothills in a warm haze
    const [y0, yb] = L.bands.far, y1 = L.base.far, H = L.H, line = mix(pal.far, '#5a3a30', 0.4);
    fillRidge(c, P, ridgeFn(P, y1 - H * 0.02, H * 0.06, r, 2, 6, 0.1), yb, mix(pal.far, pal.sky[1], 0.5), null);
    fillRidge(c, P, ridgeFn(P, yb, H * 0.05, r, 3, 7, 0.1), y1, pal.far, line, 1.5);
    fillRidge(c, P, ridgeFn(P, y1 + H * 0.01, H * 0.025, r, 4, 9, 0.1), yb, mix(pal.far, '#8a6a58', 0.25), null);
  },
  sea(c, P, L, r, pal) { // the coast far off, and gulls
    const [y0, yb] = L.bands.far, y1 = L.base.far, k = L.k, H = L.H, line = mix(pal.far, '#20486a', 0.45);
    fillRidge(c, P, ridgeFn(P, y1 - H * 0.02, H * 0.045, r, 2, 8, 0.06), y1 + 2, mix(pal.far, '#6aa890', 0.55), line, 1.4);
    fillRidge(c, P, ridgeFn(P, y1 + H * 0.005, H * 0.025, r, 3, 11, 0.05), y1 + 2, mix('#5f9a86', pal.sky[1], 0.15), null);
    c.beginPath();
    for (let i = 0; i < 6; i++) { const x = r() * P, y = y0 + (yb - y0) * (0.08 + r() * 0.3), w = (7 + r() * 5) * k; wrap(P, x, w * 2, (xx) => { c.moveTo(xx - w, y); c.quadraticCurveTo(xx - w * 0.4, y - w * 0.7, xx, y); c.quadraticCurveTo(xx + w * 0.4, y - w * 0.7, xx + w, y); }); }
    c.lineWidth = 1.8 * k; c.lineCap = 'round'; c.strokeStyle = '#ffffff'; c.stroke(); c.lineCap = 'butt';
  },
};
const MID15 = {
  basin(c, P, L, r, pal, o) { // alkali flats, low grey hills, and (a wet day) the river
    const yb = L.bands.mid[1], y1 = L.base.mid, k = L.k, H = L.H, line = shade(pal.mid, -0.4);
    const y = ridgeFn(P, y1 - H * 0.012, H * 0.05, r, 3, 9, 0.2);
    fillRidge(c, P, y, yb, pal.mid, line, 2);
    for (let i = 0; i < 9; i++) { const x = r() * P, w = (60 + r() * 90) * k; wrap(P, x, w / 2, (xx) => { c.beginPath(); c.ellipse(xx, y1 + (6 + r() * 10) * k, w / 2, (3 + r() * 3) * k, 0, 0, TAU); c.fillStyle = 'rgba(255,255,248,0.7)'; c.fill(); }); }
    for (let i = 0; i < 30; i++) { const x = r() * P; wrap(P, x, 8 * k, (xx) => sage(c, xx, y(x) + 5 * k + r() * 14 * k, (3 + r() * 3) * k, shade(pal.near, 0.05), null, 0)); }
    if (!(o && o.dry)) { // the Humboldt winds across the flat; none on a dry day
      const wy = y1 + 12 * k;
      c.beginPath(); for (let x = -4; x <= P + 4; x += 6) { const yy = wy + Math.sin((x / P) * TAU * 3) * 4 * k; if (x === -4) c.moveTo(x, yy); else c.lineTo(x, yy); }
      c.lineWidth = 7 * k; c.strokeStyle = shade(pal.water, 0.05); c.lineJoin = 'round'; c.stroke();
      c.lineWidth = 2 * k; c.strokeStyle = 'rgba(255,255,255,0.55)'; c.stroke();
    }
  },
  sierra(c, P, L, r, pal) { // dark fir ridges with snow along their tops
    const yb = L.bands.mid[1], y1 = L.base.mid, k = L.k, H = L.H, line = shade(pal.mid, -0.45);
    const y = ridgeFn(P, y1 - H * 0.025, H * 0.11, r, 3, 9, 0.2);
    fillRidge(c, P, y, yb, pal.mid, line, 2);
    ridgeSnow(c, P, y, r, 10, k);
    for (let i = 0; i < 44; i++) { const x = r() * P, h = (20 + r() * 20) * k, yy = y(x) + 4 + r() * 16 * k; wrap(P, x, h * 0.3, (xx) => { pine(c, xx, yy, h * 0.55, h, shade(pal.mid, -0.1 - r() * 0.1), line, 1.2); c.beginPath(); c.moveTo(xx, yy - h); c.lineTo(xx - h * 0.1, yy - h * 0.8); c.lineTo(xx + h * 0.1, yy - h * 0.8); c.closePath(); c.fillStyle = '#f3f7ff'; c.fill(); }); }
  },
  siskiyou(c, P, L, r, pal) { // oak and madrone hills
    const yb = L.bands.mid[1], y1 = L.base.mid, k = L.k, H = L.H, line = shade(pal.mid, -0.4);
    const y = ridgeFn(P, y1 - H * 0.015, H * 0.08, r, 3, 8, 0.15);
    fillRidge(c, P, y, yb, pal.mid, line, 2);
    for (let i = 0; i < 20; i++) {
      const x = r() * P, h = (22 + r() * 18) * k, yy = y(x) + 6 + r() * 12 * k, madrone = r() < 0.35;
      wrap(P, x, h * 0.5, (xx) => blobTree(c, xx, yy, h, madrone ? '#b5532e' : '#6a4a2a', shade(pal.mid, madrone ? 0.1 : -0.15 - r() * 0.1), line, 1.3));
    }
  },
  goldcountry(c, P, L, r, pal) { // golden grass hills, valley oaks
    const yb = L.bands.mid[1], y1 = L.base.mid, k = L.k, H = L.H, line = shade(pal.mid, -0.4);
    const y = ridgeFn(P, y1 - H * 0.012, H * 0.06, r, 3, 8, 0.12);
    fillRidge(c, P, y, yb, pal.mid, line, 2);
    c.beginPath(); for (let i = 0; i < 16; i++) { const x = r() * P, yy = y(x) + (8 + r() * 14) * k; c.moveTo(x, yy); c.quadraticCurveTo(x + 14 * k, yy - 3 * k, x + 30 * k, yy + 1 * k); }
    c.lineWidth = 1.6 * k; c.strokeStyle = shade(pal.mid, 0.25); c.stroke();
    for (let i = 0; i < 12; i++) { const x = r() * P, h = (28 + r() * 16) * k; wrap(P, x, h * 0.5, (xx) => oak(c, xx, y(x) + 8 * k, h, '#5a3e26', '#4d6a2c', line, 1.3)); }
  },
  sea(c, P, L, r, pal) { // long swells, a seal on a rock, a far sail
    const [y0, yb] = L.bands.mid, y1 = L.base.mid, k = L.k, H = L.H, line = shade(pal.mid, -0.4);
    const top = L.base.far - H * 0.008;
    c.beginPath(); c.rect(-2, top, P + 4, yb - top + 2); c.fillStyle = pal.mid; c.fill();
    const g = c.createLinearGradient(0, top, 0, yb); g.addColorStop(0, 'rgba(150,220,235,0.45)'); g.addColorStop(0.35, 'rgba(150,220,235,0)'); g.addColorStop(1, 'rgba(10,40,80,0.28)');
    c.fillStyle = g; c.fillRect(-2, top, P + 4, yb - top + 2);
    for (let row = 0; row < 7; row++) {
      const yy = top + (yb - top) * (0.1 + row * 0.13), amp = (2 + row * 1.3) * k, n = 5 + (row % 3) * 2, ph = r() * TAU;
      c.beginPath(); for (let x = -4; x <= P + 4; x += 5) { const w = yy + Math.sin((x / P) * TAU * n + ph) * amp; if (x === -4) c.moveTo(x, w); else c.lineTo(x, w); }
      c.lineWidth = (1.4 + row * 0.35) * k; c.strokeStyle = row % 2 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.28)'; c.stroke();
    }
    // a seal on a rock
    const sx = P * 0.64, sy = top + (yb - top) * 0.32;
    wrap(P, sx, 30 * k, (xx) => {
      rock(c, xx, sy + 6 * k, 15 * k, '#7c8590', line, 1.4);
      c.beginPath(); c.ellipse(xx - 2 * k, sy - 7 * k, 9 * k, 4.6 * k, -0.2, 0, TAU); c.fillStyle = '#8a7a6a'; c.fill(); c.lineWidth = 1.3; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.arc(xx + 6 * k, sy - 11 * k, 3.6 * k, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.arc(xx + 7.4 * k, sy - 11.6 * k, 0.9 * k, 0, TAU); c.fillStyle = OUT; c.fill();
    });
    // a far fishing boat's sail
    const bx = P * 0.2, by = top + (yb - top) * 0.1;
    wrap(P, bx, 20 * k, (xx) => { c.beginPath(); c.moveTo(xx, by - 16 * k); c.lineTo(xx + 8 * k, by); c.lineTo(xx - 6 * k, by); c.closePath(); c.fillStyle = '#ffffff'; c.fill(); c.beginPath(); c.moveTo(xx - 9 * k, by + 1 * k); c.lineTo(xx + 11 * k, by + 1 * k); c.lineTo(xx + 7 * k, by + 4 * k); c.lineTo(xx - 6 * k, by + 4 * k); c.closePath(); c.fillStyle = '#9a6a3c'; c.fill(); });
  },
};
const NEAR15 = {
  basin(c, P, L, r, pal) { // greasewood and sage
    const yb = L.bands.near[1], y1 = L.base.near, k = L.k, H = L.H, line = shade(pal.near, -0.4);
    const y = ridgeFn(P, y1 - H * 0.005, H * 0.025, r);
    fillRidge(c, P, y, yb, shade(pal.ground, -0.08), shade(pal.ground, -0.4), 2.2);
    for (let i = 0; i < 18; i++) { const x = r() * P; wrap(P, x, 18 * k, (xx) => greasewood(c, xx, y(x) + 9 * k, (9 + r() * 7) * k, shade(pal.near, r() * 0.1), line, 1.4)); }
    for (let i = 0; i < 10; i++) { const x = r() * P; wrap(P, x, 16 * k, (xx) => sage(c, xx, y(x) + 9 * k, (7 + r() * 6) * k, shade(pal.near, 0.12), line, 1.4)); }
  },
  sierra(c, P, L, r, pal) { // tall pines and boulders
    const yb = L.bands.near[1], y1 = L.base.near, k = L.k, H = L.H, line = shade(pal.near, -0.45);
    const y = ridgeFn(P, y1 - H * 0.005, H * 0.03, r);
    for (let i = 0; i < 12; i++) { const x = r() * P, h = (64 + r() * 44) * k; wrap(P, x, h * 0.3, (xx) => { pine(c, xx, y(x) + 6, h * 0.46, h, shade(pal.near, -0.02 - r() * 0.1), line, 1.6); c.beginPath(); c.moveTo(xx, y(x) + 6 - h); c.lineTo(xx - h * 0.09, y(x) + 6 - h * 0.82); c.lineTo(xx + h * 0.09, y(x) + 6 - h * 0.82); c.closePath(); c.fillStyle = '#f3f7ff'; c.fill(); }); }
    fillRidge(c, P, y, yb, shade(pal.ground, -0.08), shade(pal.ground, -0.45), 2.2);
    for (let i = 0; i < 8; i++) { const x = r() * P; wrap(P, x, 22 * k, (xx) => { rock(c, xx, y(x) + 10 * k, (10 + r() * 12) * k, '#a6a8b2', '#30303c', 1.6); }); }
    for (let i = 0; i < 6; i++) { const x = r() * P; wrap(P, x, 24 * k, (xx) => snowMound(c, xx, y(x) + 12 * k, (30 + r() * 26) * k, (7 + r() * 5) * k, '#8a9ab8', 1.4)); }
  },
  siskiyou(c, P, L, r, pal) { // Douglas firs
    const yb = L.bands.near[1], y1 = L.base.near, k = L.k, H = L.H, line = shade(pal.near, -0.45);
    const y = ridgeFn(P, y1 - H * 0.005, H * 0.03, r);
    for (let i = 0; i < 13; i++) { const x = r() * P, h = (56 + r() * 44) * k; wrap(P, x, h * 0.3, (xx) => pine(c, xx, y(x) + 6, h * 0.44, h, shade(pal.near, -r() * 0.12), line, 1.6)); }
    fillRidge(c, P, y, yb, shade(pal.ground, -0.1), shade(pal.ground, -0.45), 2.2);
    for (let i = 0; i < 12; i++) { const x = r() * P; wrap(P, x, 14 * k, (xx) => fern(c, xx, y(x) + 9 * k, 17 * k, '#3f7a3a', k * 0.7)); }
  },
  goldcountry(c, P, L, r, pal) { // big oaks over golden grass
    const yb = L.bands.near[1], y1 = L.base.near, k = L.k, H = L.H, line = shade(pal.near, -0.4);
    const y = ridgeFn(P, y1 - H * 0.005, H * 0.03, r);
    for (let i = 0; i < 4; i++) { const x = r() * P, h = (70 + r() * 30) * k; wrap(P, x, h * 0.5, (xx) => oak(c, xx, y(x) + 8, h, '#5a3e26', shade(pal.near, -r() * 0.12), line, 1.8)); }
    fillRidge(c, P, y, yb, mix(pal.mid, pal.ground, 0.4), shade(pal.ground, -0.4), 2.2);
    for (let i = 0; i < 24; i++) { const x = r() * P; wrap(P, x, 12 * k, (xx) => grass(c, xx, y(x) + 8 * k, (11 + r() * 8) * k, '#c9a64a', 2 * k)); }
    for (let i = 0; i < 5; i++) { const x = r() * P; wrap(P, x, 12 * k, (xx) => rock(c, xx, y(x) + 10 * k, (6 + r() * 6) * k, '#a98a70', '#3a2a20', 1.5)); }
  },
  sea(c, P, L, r, pal) { // the schooner's rail: thin rails on posts, the sea showing between, a solid bulwark below
    const yb = L.bands.near[1], y1 = L.base.near, k = L.k, line = OUT;
    const deckEdge = y1 - 8 * k, r1 = y1 - 34 * k, r2 = y1 - 20 * k;
    for (let x = 6 * k; x < P; x += 78 * k) { c.beginPath(); c.rect(x - 4 * k, r1 - 4 * k, 8 * k, deckEdge - r1 + 4 * k); c.fillStyle = '#c28a52'; c.fill(); c.lineWidth = 1.8; c.strokeStyle = line; c.stroke(); }
    for (const [yy, wd] of [[r1, 6], [r2, 4.5]]) { c.beginPath(); c.rect(-2, yy - (wd * k) / 2, P + 4, wd * k); c.fillStyle = '#d29a60'; c.fill(); c.lineWidth = 1.8; c.strokeStyle = line; c.stroke(); }
    c.beginPath(); c.rect(-2, deckEdge, P + 4, yb - deckEdge + 2); c.fillStyle = '#a8703e'; c.fill(); c.lineWidth = 2; c.strokeStyle = line; c.stroke();
    c.beginPath(); c.moveTo(-2, deckEdge + 7 * k); c.lineTo(P + 2, deckEdge + 7 * k); c.lineWidth = 1.6 * k; c.strokeStyle = '#7a4a26'; c.stroke();
    wrap(P, P * 0.3, 20 * k, (xx) => { c.beginPath(); c.rect(xx - 5 * k, r1 - 27 * k, 10 * k, 18 * k); c.fillStyle = '#ffe28a'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = line; c.stroke(); c.beginPath(); c.moveTo(xx - 7 * k, r1 - 27 * k); c.lineTo(xx, r1 - 34 * k); c.lineTo(xx + 7 * k, r1 - 27 * k); c.closePath(); c.fillStyle = '#3a3a44'; c.fill(); c.stroke(); });
  },
};
const PROPS15 = {
  basin(c, P, L, r, pal, o) {
    const k = L.k, H = L.H;
    for (let i = 0; i < 5; i++) { const x = r() * P; wrap(P, x, 22 * k, (xx) => greasewood(c, xx, H + 4 * k, (14 + r() * 8) * k, pal.near, shade(pal.near, -0.4), 1.8)); }
    if (!(o && o.dry)) for (let i = 0; i < 3; i++) { const x = (i + 0.3 + r() * 0.4) * (P / 3); wrap(P, x, 44 * k, (xx) => willow(c, xx, H + 4 * k, (46 + r() * 14) * k, '#6f9a52', shade('#6f9a52', -0.4), 1.6)); }
    else for (let i = 0; i < 4; i++) { const x = r() * P; wrap(P, x, 20 * k, (xx) => rock(c, xx, H + 2 * k, (10 + r() * 8) * k, '#cbbfa6', '#4a3a28', 1.8)); }
  },
  sierra(c, P, L, r, pal) {
    const k = L.k, H = L.H;
    for (let i = 0; i < 4; i++) { const x = (i + 0.3 + r() * 0.4) * (P / 4); wrap(P, x, 50 * k, (xx) => snowMound(c, xx, H + 6 * k, (62 + r() * 30) * k, (18 + r() * 8) * k, '#7f90b0', 1.8)); }
    const sy = (x) => H - 4 * k + Math.sin((x / P) * TAU * 2 + 0.6) * 4 * k;
    c.beginPath(); for (let x = -4; x <= P + 4; x += 6) { if (x === -4) c.moveTo(x, sy(x)); else c.lineTo(x, sy(x)); }
    c.lineWidth = 9 * k; c.lineJoin = 'round'; c.strokeStyle = '#6fb6e0'; c.stroke(); c.lineWidth = 2.2 * k; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.stroke();
  },
  siskiyou(c, P, L, r, pal) {
    const k = L.k, H = L.H;
    for (let i = 0; i < 5; i++) { const x = r() * P; wrap(P, x, 30 * k, (xx) => fern(c, xx, H + 4 * k, (28 + r() * 10) * k, '#3f8a4a', k)); }
    for (let i = 0; i < 3; i++) { // blackberry tangles: a mound of canes with dark berries
      const x = r() * P; wrap(P, x, 30 * k, (xx) => {
        c.beginPath(); c.ellipse(xx, H - 2 * k, 26 * k, 14 * k, 0, Math.PI, 0); c.fillStyle = '#3f7a3a'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#1f3a1f'; c.stroke();
        c.beginPath(); for (let b = 0; b < 8; b++) { const bx = xx + (b - 3.5) * 5.4 * k, by = H - (4 + (b % 3) * 5) * k; c.moveTo(bx + 2.6 * k, by); c.arc(bx, by, 2.6 * k, 0, TAU); }
        c.fillStyle = '#5a2470'; c.fill();
      });
    }
  },
  goldcountry(c, P, L, r, pal) { // the diggings seen from the trail: tents, a sluice box, a rocker, miners waving hello
    const k = L.k, H = L.H, bandH = H - L.bands.props[0], s = Math.min(k, bandH / 100);
    const spots = [0.1, 0.34, 0.58, 0.82];
    wrap(P, P * spots[0], 50 * s, (xx) => tent(c, xx, H + 3 * s, 60 * s, 40 * s, '#eadfc4', OUT, 1.8));
    wrap(P, P * spots[1], 60 * s, (xx) => { // a sluice box on legs with water running down it
      for (const lx of [-34, -10, 14, 38]) { c.beginPath(); c.moveTo(xx + lx * s, H - 6 * s - Math.abs(lx - 2) * 0.1 * s); c.lineTo(xx + lx * s, H + 3 * s); c.lineWidth = 3 * s; c.strokeStyle = '#6a4a2a'; c.stroke(); }
      c.beginPath(); c.moveTo(xx - 44 * s, H - 20 * s); c.lineTo(xx + 46 * s, H - 8 * s); c.lineTo(xx + 46 * s, H - 2 * s); c.lineTo(xx - 44 * s, H - 14 * s); c.closePath(); c.fillStyle = '#b98a54'; c.fill(); c.lineWidth = 1.8; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.moveTo(xx - 42 * s, H - 17 * s); c.lineTo(xx + 44 * s, H - 5 * s); c.lineWidth = 3 * s; c.strokeStyle = '#7dc4e8'; c.stroke();
      c.beginPath(); for (let q = 0; q < 5; q++) { const qx = xx - 30 * s + q * 17 * s; c.moveTo(qx, H - 17 * s + q * 3 * s); c.lineTo(qx, H - 11 * s + q * 3 * s); } c.lineWidth = 1.6 * s; c.strokeStyle = '#6a4a2a'; c.stroke();
    });
    wrap(P, P * spots[2], 40 * s, (xx) => { // a rocker (cradle) by the creek
      c.beginPath(); c.moveTo(xx - 24 * s, H - 24 * s); c.lineTo(xx + 20 * s, H - 14 * s); c.lineTo(xx + 20 * s, H - 4 * s); c.lineTo(xx - 24 * s, H - 14 * s); c.closePath(); c.fillStyle = '#c0925a'; c.fill(); c.lineWidth = 1.8; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.moveTo(xx - 26 * s, H - 2 * s); c.quadraticCurveTo(xx - 2 * s, H + 8 * s, xx + 24 * s, H - 2 * s); c.lineWidth = 3 * s; c.strokeStyle = '#6a4a2a'; c.stroke();
      c.beginPath(); c.moveTo(xx - 24 * s, H - 24 * s); c.lineTo(xx - 30 * s, H - 40 * s); c.lineWidth = 2.6 * s; c.stroke();
    });
    wrap(P, P * spots[3], 50 * s, (xx) => tent(c, xx, H + 3 * s, 54 * s, 36 * s, '#e6d6b0', OUT, 1.8));
    const look = (id, col, hat) => personLook(id, col, hat);
    wrap(P, P * 0.22, 20 * s, (xx) => drawPerson(c, xx, H - 4 * s, s * 0.7, look('m1', '#b5543a', 'wide'), 0, 0, 0.25, 1));
    wrap(P, P * 0.7, 20 * s, (xx) => drawPerson(c, xx, H - 4 * s, s * 0.7, look('m2', '#4a6aa8', 'straw'), 0, 0, 0.25, -1));
  },
  sea(c, P, L, r, pal) { // barrels, a coil of rope, a net
    const k = L.k, H = L.H, bandH = H - L.bands.props[0], s = Math.min(k, bandH / 70);
    for (let i = 0; i < 3; i++) {
      const x = (i + 0.2 + r() * 0.5) * (P / 3);
      wrap(P, x, 24 * s, (xx) => {
        c.beginPath(); rrect(c, xx - 11 * s, H - 24 * s, 22 * s, 28 * s, 6 * s); c.fillStyle = '#9a6a3c'; c.fill(); c.lineWidth = 1.8; c.strokeStyle = OUT; c.stroke();
        c.beginPath(); c.moveTo(xx - 11 * s, H - 16 * s); c.lineTo(xx + 11 * s, H - 16 * s); c.moveTo(xx - 11 * s, H - 5 * s); c.lineTo(xx + 11 * s, H - 5 * s); c.lineWidth = 2.2 * s; c.strokeStyle = '#4a4a52'; c.stroke();
      });
    }
    wrap(P, P * 0.55, 30 * s, (xx) => { c.beginPath(); for (let q = 0; q < 3; q++) c.ellipse(xx, H - (3 + q * 2.4) * s, (20 - q * 3) * s, (7 - q) * s, 0, 0, TAU); c.fillStyle = '#d8c08a'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = OUT; c.stroke(); });
  },
};
// the ground of the new biomes (drawn after the plain ground and its trail)
function groundExtra(id, c, P, L, r, pal, o) {
  const k = L.k, H = L.H, y0 = L.bands.ground[0], t0 = L.gy - 12 * k, t1 = L.gy + 30 * k;
  const off = () => (r() < 0.45 ? y0 + 3 * k + r() * (t0 - y0 - 6 * k) : t1 + 4 * k + r() * (H - t1 - 6 * k));
  if (id === 'basin') { // white-crusted sand, cracked
    c.beginPath(); for (let i = 0; i < 46; i++) { const x = r() * P, yy = off(), w = (6 + r() * 16) * k; c.moveTo(x + w, yy); c.ellipse(x, yy, w, w * 0.32, 0, 0, TAU); }
    c.fillStyle = 'rgba(255,255,250,0.55)'; c.fill();
    c.beginPath(); for (let i = 0; i < 30; i++) { const x = r() * P, yy = off(); c.moveTo(x, yy); c.lineTo(x + (4 + r() * 6) * k, yy + (2 + r() * 3) * k); c.lineTo(x + (8 + r() * 8) * k, yy + (-1 + r() * 3) * k); }
    c.lineWidth = 1.2 * k; c.strokeStyle = shade(pal.ground, -0.22); c.stroke();
    if (o && o.dry) { c.beginPath(); c.rect(0, y0, P, H - y0); c.fillStyle = 'rgba(255,248,230,0.18)'; c.fill(); }
  } else if (id === 'sierra') { // granite slabs, snow patches
    for (let i = 0; i < 16; i++) {
      const x = r() * P, yy = off(), w = (22 + r() * 40) * k;
      wrap(P, x, w, (xx) => { c.beginPath(); c.moveTo(xx - w / 2, yy + 3 * k); c.lineTo(xx - w * 0.35, yy - 4 * k); c.lineTo(xx + w * 0.3, yy - 5 * k); c.lineTo(xx + w / 2, yy + 3 * k); c.closePath(); c.fillStyle = shade(pal.ground, r() * 0.1 - 0.05); c.fill(); c.lineWidth = 1.4; c.strokeStyle = shade(pal.ground, -0.35); c.stroke(); });
    }
    c.beginPath(); for (let i = 0; i < 14; i++) { const x = r() * P, yy = off(), w = (10 + r() * 22) * k; c.moveTo(x + w, yy); c.ellipse(x, yy, w, w * 0.28, 0, 0, TAU); }
    c.fillStyle = 'rgba(252,254,255,0.95)'; c.fill();
  } else if (id === 'siskiyou') { // river gravel and ferns
    c.beginPath(); for (let i = 0; i < 90; i++) { const x = r() * P, yy = r() < 0.5 ? off() : t0 + 3 * k + r() * (t1 - t0 - 6 * k); c.moveTo(x + 1.8 * k, yy); c.ellipse(x, yy, 2 * k, 1.3 * k, 0, 0, TAU); }
    c.fillStyle = shade(pal.ground, -0.28); c.fill();
    c.beginPath(); for (let i = 0; i < 40; i++) { const x = r() * P, yy = off(); c.moveTo(x + 1.6 * k, yy); c.ellipse(x, yy, 1.8 * k, 1.1 * k, 0, 0, TAU); }
    c.fillStyle = shade(pal.ground, 0.25); c.fill();
  } else if (id === 'goldcountry') { // red earth, gravel
    for (let i = 0; i < 12; i++) { const x = r() * P, yy = off(), w = (16 + r() * 30) * k; wrap(P, x, w, (xx) => { c.beginPath(); c.ellipse(xx, yy, w, w * 0.25, 0, 0, TAU); c.fillStyle = shade(pal.ground, r() < 0.5 ? -0.12 : 0.1); c.fill(); }); }
    c.beginPath(); for (let i = 0; i < 40; i++) { const x = r() * P, yy = off(); c.moveTo(x + 1.8 * k, yy); c.ellipse(x, yy, 1.9 * k, 1.2 * k, 0, 0, TAU); }
    c.fillStyle = '#d8c0a0'; c.fill();
  }
}
// the schooner's deck replaces the ground and its trail
function paintDeck(c, P, L, r, pal) {
  const k = L.k, H = L.H, y0 = L.bands.ground[0];
  c.fillStyle = pal.ground; c.fillRect(-2, y0, P + 4, H - y0 + 2);
  const pl = 15 * k;
  c.beginPath(); for (let y = y0 + pl * 0.5; y < H; y += pl) { c.moveTo(-2, y); c.lineTo(P + 2, y); }
  c.lineWidth = 2 * k; c.strokeStyle = shade(pal.ground, -0.3); c.stroke();
  c.beginPath(); let row = 0;
  for (let y = y0 + pl * 0.5; y < H; y += pl, row++) { for (let x = (row % 3) * 60 * k; x < P; x += 180 * k) { c.moveTo(x, y); c.lineTo(x, y + pl); } }
  c.lineWidth = 1.6 * k; c.strokeStyle = shade(pal.ground, -0.22); c.stroke();
  c.beginPath(); for (let i = 0; i < 70; i++) { const x = r() * P, yy = y0 + 3 * k + r() * (H - y0 - 6 * k); c.moveTo(x + 1.2 * k, yy); c.arc(x, yy, 1.2 * k, 0, TAU); }
  c.fillStyle = shade(pal.ground, -0.4); c.fill();
  c.beginPath(); for (let i = 0; i < 12; i++) { const x = r() * P, yy = y0 + 4 * k + r() * (H - y0 - 8 * k); c.moveTo(x, yy); c.lineTo(x + (30 + r() * 50) * k, yy); }
  c.lineWidth = 1.6 * k; c.strokeStyle = shade(pal.ground, 0.16); c.stroke();
}
Object.assign(FAR, FAR15); Object.assign(MID, MID15); Object.assign(NEAR, NEAR15); Object.assign(PROPS, PROPS15);

// ---------------------------------------------------------------- tiles
// a tile covering the band [y0, y1] (css), one period P wide, at the layer dpr
function tile(L, y0, y1, seed, paint) {
  const d = L.ldpr, P = L.P;
  const cv = mkCanvas(P * d, (y1 - y0) * d);
  const c = cv.getContext('2d');
  c.setTransform(d, 0, 0, d, 0, -y0 * d);
  curRand = rng(seed);
  try { paint(c, P, L, curRand); } finally { curRand = null; }
  return { cv, y0, y1, h: y1 - y0 };
}
// all five layers of a biome for a layout; ~10-40 ms, done on a leg change or a resize only
export function buildLayers(biomeId, L, o = {}) {
  const id = biomeOf(biomeId), pal = BIOMES[id], s = hashStr(id);
  const b = L.bands, opt = { dry: !!o.dry };
  return {
    id, pal, dry: opt.dry,
    far: tile(L, b.far[0], b.far[1], s + 1, (c, P, LL, r) => FAR[id](c, P, LL, r, pal, opt)),
    mid: tile(L, b.mid[0], b.mid[1], s + 2, (c, P, LL, r) => MID[id](c, P, LL, r, pal, opt)),
    near: tile(L, b.near[0], b.near[1], s + 3, (c, P, LL, r) => NEAR[id](c, P, LL, r, pal, opt)),
    ground: tile(L, b.ground[0], b.ground[1], s + 4, (c, P, LL, r) => (id === 'sea' ? paintDeck(c, P, LL, r, pal) : paintGround(c, P, LL, r, pal, id, opt))),
    props: tile(L, b.props[0], b.props[1], s + 5, (c, P, LL, r) => PROPS[id](c, P, LL, r, pal, opt)),
  };
}
// the parallax speeds (fraction of the ground's scroll)
export const SPEED = { far: 0.05, mid: 0.2, near: 0.5, ground: 1, props: 1.35 };

// the painters' primitives, for the backdrops module
export const paint = { pine, blobTree, sage, grass, rock, mesa, peak, ridgeFn, fillRidge, fern, sunflower, rrect, dome, spire, oak, willow, tent, snowMound, greasewood };

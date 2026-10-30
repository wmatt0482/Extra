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

export const BIOME_IDS = ['prairie', 'bluffs', 'highdesert', 'mountains', 'gorge', 'valley'];

export const BIOMES = {
  prairie: { sky: ['#62b8ea', '#d6f1fb'], far: '#9cc4a6', mid: '#86b85a', near: '#5f9a3e', ground: '#a8c45c', trail: '#cda56a', accent: '#f3c623', water: '#4f9fd0' },
  bluffs: { sky: ['#6db8e6', '#f6e6c8'], far: '#d2a47c', mid: '#c99a63', near: '#8f9a5a', ground: '#c4b277', trail: '#dcb47c', accent: '#e8a23a', water: '#5a9ec8' },
  highdesert: { sky: ['#86c6ea', '#f7ead0'], far: '#a993b6', mid: '#c4a679', near: '#94a07c', ground: '#d6bf8a', trail: '#e2c690', accent: '#d97a4a', water: '#5aa6c8' },
  mountains: { sky: ['#5aa8e2', '#d8f0fb'], far: '#7f90b4', mid: '#3f7a5a', near: '#2f6a48', ground: '#7d9c55', trail: '#b8925f', accent: '#e8e8f0', water: '#4f94c8' },
  gorge: { sky: ['#7ab0d6', '#e2eff2'], far: '#98a7c2', mid: '#5c5a66', near: '#2e6a4c', ground: '#6e9a52', trail: '#ad8b5f', accent: '#f0f0f6', water: '#3f86b8' },
  valley: { sky: ['#68bdf0', '#e8f7fc'], far: '#8aa7cc', mid: '#7cbf5a', near: '#4f9a3e', ground: '#8cc256', trail: '#bd975e', accent: '#ff7aa8', water: '#4fa2d8' },
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
function paintGround(c, P, L, r, pal) {
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
export function buildLayers(biomeId, L) {
  const id = biomeOf(biomeId), pal = BIOMES[id], s = hashStr(id);
  const b = L.bands;
  return {
    id, pal,
    far: tile(L, b.far[0], b.far[1], s + 1, (c, P, LL, r) => FAR[id](c, P, LL, r, pal)),
    mid: tile(L, b.mid[0], b.mid[1], s + 2, (c, P, LL, r) => MID[id](c, P, LL, r, pal)),
    near: tile(L, b.near[0], b.near[1], s + 3, (c, P, LL, r) => NEAR[id](c, P, LL, r, pal)),
    ground: tile(L, b.ground[0], b.ground[1], s + 4, (c, P, LL, r) => paintGround(c, P, LL, r, pal)),
    props: tile(L, b.props[0], b.props[1], s + 5, (c, P, LL, r) => PROPS[id](c, P, LL, r, pal)),
  };
}
// the parallax speeds (fraction of the ground's scroll)
export const SPEED = { far: 0.05, mid: 0.2, near: 0.5, ground: 1, props: 1.35 };

// the painters' primitives, for the backdrops module
export const paint = { pine, blobTree, sage, grass, rock, mesa, peak, ridgeFn, fillRidge, fern, sunflower, rrect };

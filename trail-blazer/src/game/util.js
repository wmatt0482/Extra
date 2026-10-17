// Small shared helpers (copied from Spell Jump): seeded PRNG, math, colour.

export const TAU = Math.PI * 2;

// mulberry32: tiny, fast, good-enough seeded PRNG. Same seed => same sequence.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Order-independent integer hash of two ints (used to seed per-chunk generators).
export function hash2(a, b) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 16;
  return h >>> 0;
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
export function smoothstepD(e0, e1, x) {
  // derivative of smoothstep wrt x
  if (x <= e0 || x >= e1) return 0;
  const t = (x - e0) / (e1 - e0);
  return (6 * t * (1 - t)) / (e1 - e0);
}

// ---- colour helpers (hex <-> rgb, mixing) ----
const cache = new Map();
export function hexToRgb(hex) {
  let c = cache.get(hex);
  if (c) return c;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h, 16);
  c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  cache.set(hex, c);
  return c;
}
export function rgbStr(r, g, b, a = 1) {
  return a >= 1 ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}
// mix(hexA, hexB, t) -> css colour
export function mix(a, b, t, alpha = 1) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbStr(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t), alpha);
}
export const shade = (hex, t) => (t < 0 ? mix(hex, '#000000', -t) : mix(hex, '#ffffff', t));
export function withAlpha(hex, a) {
  const c = hexToRgb(hex);
  return rgbStr(c[0], c[1], c[2], a);
}
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
export const wrapPi = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
// smooth 0..1..0 bump over [a, b]
export function bump01(a, b, x) {
  if (x <= a || x >= b) return 0;
  return 0.5 - 0.5 * Math.cos(((x - a) / (b - a)) * TAU);
}

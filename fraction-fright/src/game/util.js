// Small shared helpers (the Spell Jump / Trail Blazer set): seeded PRNG, math, colour, plus fraction text helpers
// for the number line (parse a label like "½", "3/4", "1 1/2" or "0.62" to a value and back).

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

// Order-independent integer hash of two ints.
export function hash2(a, b) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 16;
  return h >>> 0;
}
// string -> 32-bit seed
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
// ease helpers for the little animations (0..1 -> 0..1)
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
export const easeIn = (t) => t * t;
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
// overshoot pop: 0 -> ~1.15 -> 1
export function popScale(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const s = 1.7;
  const u = t - 1;
  return 1 + u * u * ((s + 1) * u + s);
}

// ---- colour helpers (hex <-> rgb, mixing) ----
const cache = new Map();
export function hexToRgb(hex) {
  let c = cache.get(hex);
  if (c) return c;
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h, 16);
  c = Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [128, 128, 128];
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
  const c = hexToRgb(hex);
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
}
export const isHexColor = (s) => typeof s === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(s);

// ---- fractions ----
const VULGAR = { '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅕': 1 / 5, '⅖': 2 / 5, '⅗': 3 / 5, '⅘': 4 / 5, '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8, '⅒': 1 / 10 };
const VULGAR_OF = { '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾', '1/5': '⅕', '2/5': '⅖', '3/5': '⅗', '4/5': '⅘', '1/6': '⅙', '5/6': '⅚', '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞', '1/10': '⅒' };
// "3/4" | "¾" | "1 1/2" | "1½" | "2" | "0.62" -> number (null when it is not a number)
export function parseFractionText(text) {
  if (typeof text === 'number') return Number.isFinite(text) ? text : null;
  if (typeof text !== 'string') return null;
  const s = text.trim().replace(/\s+/g, ' ');
  if (!s) return null;
  let m = s.match(/^(-?\d+)\s?([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞⅒])$/);
  if (m) return Number(m[1]) + VULGAR[m[2]];
  if (VULGAR[s] != null) return VULGAR[s];
  m = s.match(/^(-?\d+)\s(\d+)\s*\/\s*(\d+)$/);
  if (m && Number(m[3]) > 0) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = s.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (m && Number(m[2]) > 0) return Number(m[1]) / Number(m[2]);
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
// the denominator a "show" text uses (3/4 -> 4, 1 1/2 -> 2, ¾ -> 4, 0.62 -> 100, 0.6 -> 10, "2" -> 1); null when unknown
export function denominatorOf(text) {
  if (typeof text !== 'string') return null;
  const s = text.trim();
  let m = s.match(/\/\s*(\d+)\s*$/);
  if (m) return Number(m[1]) || null;
  m = s.match(/([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞⅒])$/);
  if (m) { const v = VULGAR[m[1]]; for (const d of [2, 3, 4, 5, 6, 8, 10]) if (Math.abs(v * d - Math.round(v * d)) < 1e-9) return d; }
  m = s.match(/^-?\d*\.(\d+)$/);
  if (m) return Math.pow(10, m[1].length);
  if (/^-?\d+$/.test(s)) return 1;
  return null;
}
// a short label for a value: wholes as "2", unit fractions as vulgar glyphs when there is one, else "a/b" / "1 a/b"
export function fractionLabel(value, den) {
  if (!Number.isFinite(value)) return '';
  if (!den || den <= 1 || Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
  const whole = Math.floor(value + 1e-9);
  const num = Math.round((value - whole) * den);
  if (num === 0) return String(whole);
  const g = gcd(num, den);
  const key = num / g + '/' + den / g;
  const part = VULGAR_OF[key] || key;
  return whole ? whole + (VULGAR_OF[key] ? '' : ' ') + part : part;
}
export function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }

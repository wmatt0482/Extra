// Wagon West scene helpers: a seeded PRNG, a string hash, small math and hex-colour helpers, an off-screen canvas
// factory and the in-scene text sprites. Kept local to the scene (no imports from the other games) so the scene
// module tree stays self-contained: the app stream and the mock scene can swap it without a dependency graph.

export const TAU = Math.PI * 2;
export const OUT = '#2b1d14'; // the outline colour: a warm dark brown (the trail's ink)

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
// FNV-1a over a string: stable seeds from ids ('prairie', 'chimney-rock', a companion id)
export function hashStr(s) {
  let h = 0x811c9dc5;
  const str = String(s == null ? '' : s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const approach = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));

// ---- colours: '#rrggbb' in and out so the helpers chain ----
const rgbCache = new Map();
export function hexToRgb(hex) {
  let c = rgbCache.get(hex);
  if (c) return c;
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h, 16);
  c = Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [128, 128, 128];
  if (rgbCache.size > 500) rgbCache.clear();
  rgbCache.set(hex, c);
  return c;
}
const hx = (v) => { const s = Math.round(clamp(v, 0, 255)).toString(16); return s.length < 2 ? '0' + s : s; };
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + hx(lerp(A[0], B[0], t)) + hx(lerp(A[1], B[1], t)) + hx(lerp(A[2], B[2], t));
}
export const shade = (hex, t) => (t < 0 ? mix(hex, '#000000', -t) : mix(hex, '#ffffff', t));
export function rgba(hex, a) { const c = hexToRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
export const isHex = (s) => typeof s === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s);

export function mkCanvas(w, h) {
  w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  return new OffscreenCanvas(w, h);
}

// a rounded rectangle path (no ctx.roundRect: older iOS Safari lacks it)
export function rrect(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

// ---- text sprites: in-scene words ("Got one!", the wagon's name) are rendered once into a canvas and blitted ----
export const FONT_FAMILY = 'Bungee, "Arial Black", sans-serif';
const fontAt = (px) => `${Math.round(px)}px ${FONT_FAMILY}`;
const sprites = new Map();
let probe = null;
const PX = 56; // sprite raster size; drawn scaled
function textSprite(text, fill, stroke) {
  const key = fill + '|' + (stroke || '') + '|' + text;
  let sp = sprites.get(key);
  if (sp) return sp;
  if (sprites.size > 160) sprites.clear();
  if (!probe) probe = mkCanvas(4, 4).getContext('2d');
  probe.font = fontAt(PX);
  const lw = stroke ? 12 : 0;
  const w = Math.ceil(probe.measureText(text).width + lw * 2 + 8), h = Math.ceil(PX * 1.3 + lw * 2 + 4);
  const cv = mkCanvas(w, h);
  const c = cv.getContext('2d');
  c.font = fontAt(PX);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  if (stroke) { c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = stroke; c.strokeText(text, w / 2, h / 2); }
  c.fillStyle = fill;
  c.fillText(text, w / 2, h / 2);
  sp = { cv, w, h };
  sprites.set(key, sp);
  return sp;
}
// draw `text` centred at (x, y) with cap height ~`size` css px; maxW squeezes it to fit (the wagon cover)
export function drawText(ctx, text, size, x, y, fill, stroke = OUT, maxW = 0) {
  const sp = textSprite(String(text), fill, stroke);
  let k = size / PX;
  if (maxW > 0 && sp.w * k > maxW) k = maxW / sp.w;
  ctx.drawImage(sp.cv, x - (sp.w * k) / 2, y - (sp.h * k) / 2, sp.w * k, sp.h * k);
}
// the fonts may arrive after the first sprites are cached (offline first run): drop the cache when they do
export function clearTextSprites() { sprites.clear(); }

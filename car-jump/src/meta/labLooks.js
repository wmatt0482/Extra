// Spell Jump's Lab looks (lab/SPEC.md §2.7, §3.3, §4.1). The Lab reads this module at /spell-jump/src/meta/labLooks.js: LOOKS_READY lists the
// item ids Spell Jump can draw (an item is only shown in the Lab shop and dropped by the crate when its id is here), paintPreview() draws an
// item for the shop. The game itself draws them through the garage's own skin pipeline: a Lab skin or sticker is an entry shaped like
// data/cosmetics.js SKINS / STICKERS ({ body, accent, decal } / { glyph, color }), so src/game/car.js paints it exactly like an earned one, and a
// Lab trail is a particle recipe for the engine's wheel dust. A null Lab slot means the game's own look (the garage's own equip is unchanged).
// Pure data and small painters: nothing here reads the Lab, a save or a clock.
import { CARS } from '../data/cars.js';
import { paintCar } from '../ui/carPreview.js';

export const SKIN_LOOKS = Object.freeze({
  'sj.skin.mint': { id: 'sj.skin.mint', name: 'Mint skin', source: 'lab', body: '#6fe3b8', accent: '#1f9d78', decal: 'fade' },
  'sj.skin.grape': { id: 'sj.skin.grape', name: 'Grape skin', source: 'lab', body: '#8e5be0', accent: '#e6d4ff', decal: 'dots' },
  'sj.skin.lemon': { id: 'sj.skin.lemon', name: 'Lemon skin', source: 'lab', body: '#ffe94a', accent: '#f2a900', decal: 'stripes' },
  'sj.skin.tiger': { id: 'sj.skin.tiger', name: 'Tiger skin', source: 'lab', body: '#ff9a1f', accent: '#2b1706', decal: 'tiger' },
  'sj.skin.pixel': { id: 'sj.skin.pixel', name: 'Pixel skin', source: 'lab', body: '#2d3a8c', accent: '#5ee0ff', decal: 'pixel' },
  'sj.skin.sunrise': { id: 'sj.skin.sunrise', name: 'Sunrise skin', source: 'lab', body: '#ff5f7e', accent: '#ffd23f', decal: 'fade' },
  'sj.skin.aurora': { id: 'sj.skin.aurora', name: 'Aurora skin', source: 'lab', body: '#10303f', accent: '#58ffb5', decal: 'stars' },
  'sj.skin.holo': { id: 'sj.skin.holo', name: 'Holo skin', source: 'lab', body: '#d9e6ff', accent: '#c8a0ff', decal: 'holo' },
});
export const STICKER_LOOKS = Object.freeze({
  'sj.sticker.pencil': { id: 'sj.sticker.pencil', name: 'Pencil sticker', source: 'lab', glyph: '✎', color: '#ffcf1a' },
  'sj.sticker.abc': { id: 'sj.sticker.abc', name: 'Abc sticker', source: 'lab', glyph: 'Ab', color: '#5ee0ff' },
  'sj.sticker.bubble': { id: 'sj.sticker.bubble', name: 'Bubble sticker', source: 'lab', glyph: '\u{1F4AC}', color: '#ffffff' },
  'sj.sticker.medal': { id: 'sj.sticker.medal', name: 'Medal sticker', source: 'lab', glyph: '\u{1F3C5}', color: '#ffcf1a' },
  'sj.sticker.rocketlab': { id: 'sj.sticker.rocketlab', name: 'Rocket lab sticker', source: 'lab', glyph: '\u{1F9EA}', color: '#2fd36b' },
});
/** Trails: what the wheels throw off. type = the engine's particle type; chance = the share of wheel-contact frames that add one. */
export const TRAIL_LOOKS = Object.freeze({
  'sj.trail.confetti': { id: 'sj.trail.confetti', name: 'Confetti trail', type: 'confetti', chance: 0.55, colors: ['#ff3b5c', '#ffcf1a', '#22d3ff', '#2fd36b', '#8f6bff', '#ff8a1f'] },
  'sj.trail.stars': { id: 'sj.trail.stars', name: 'Stars trail', type: 'star', chance: 0.5, colors: ['#fff6a8', '#ffffff', '#ffe14a', '#bfe9ff'] },
});

/** Every id Spell Jump can draw. The Lab's shop and crate offer only these. */
export const LOOKS_READY = Object.freeze([...Object.keys(SKIN_LOOKS), ...Object.keys(STICKER_LOOKS), ...Object.keys(TRAIL_LOOKS)]);
const READY = new Set(LOOKS_READY);

/** The look to draw: the game's own { skin, sticker } (engagement.js lookFor), with the Lab's equipped skin / sticker over it when set.
 *  cos = labBridge.cosmetics(). Anything unknown or not ready is ignored, so a newer Lab can never break the car. */
export function labLook(base, cos) {
  const out = { skin: (base && base.skin) || null, sticker: (base && base.sticker) || null };
  const s = cos && cos.slots;
  if (!s) return out;
  if (typeof s.skin === 'string' && READY.has(s.skin) && SKIN_LOOKS[s.skin]) out.skin = SKIN_LOOKS[s.skin];
  if (typeof s.sticker === 'string' && READY.has(s.sticker) && STICKER_LOOKS[s.sticker]) out.sticker = STICKER_LOOKS[s.sticker];
  return out;
}
/** The equipped Lab trail as an engine recipe ({ type, chance, colors }), or null. */
export function trailFor(cos) {
  const id = cos && cos.slots && cos.slots.trail;
  return typeof id === 'string' && READY.has(id) && TRAIL_LOOKS[id] ? TRAIL_LOOKS[id] : null;
}

// ---------- shop previews (paintPreview) ----------
function carBounds(car) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of car.body) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (const w of car.wheels) { minX = Math.min(minX, w.x - w.r); maxX = Math.max(maxX, w.x + w.r); minY = Math.min(minY, w.y - w.r); maxY = Math.max(maxY, w.y + w.r); }
  return { minX, maxX, minY, maxY };
}
/** Draw `item` ({ id, ... }) into the w x h box of ctx: a car in the skin, a sticker badge, or a trail swatch. */
export function paintPreview(ctx, item, w, h) {
  const id = item && item.id;
  ctx.save();
  try {
    if (SKIN_LOOKS[id]) {
      const car = CARS[0], b = carBounds(car);
      const s = Math.min((w * 0.9) / (b.maxX - b.minX), (h * 0.8) / (b.maxY - b.minY));
      ctx.translate(w / 2 - ((b.minX + b.maxX) / 2) * s, h * 0.5 + ((b.minY + b.maxY) / 2) * s);
      ctx.scale(s, -s);
      paintCar(ctx, car, 2 / s, 0, { skin: SKIN_LOOKS[id], sticker: null });
    } else if (STICKER_LOOKS[id]) {
      const st = STICKER_LOOKS[id], r = Math.min(w, h) * 0.38;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.fillStyle = '#1b2357'; ctx.fill();
      ctx.lineWidth = Math.max(2, r * 0.12); ctx.strokeStyle = st.color; ctx.stroke();
      ctx.font = `900 ${Math.round(r * 1.05)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = st.color;
      ctx.fillText(st.glyph, w / 2, h / 2 + r * 0.05);
    } else if (TRAIL_LOOKS[id]) {
      const t = TRAIL_LOOKS[id];
      ctx.fillStyle = '#10163a'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 14; i++) {
        const x = w * (0.1 + (i / 13) * 0.8), y = h * (0.55 + 0.22 * Math.sin(i * 1.7)), c = t.colors[i % t.colors.length], r = Math.min(w, h) * (0.05 + 0.03 * ((i * 5) % 3));
        ctx.fillStyle = c;
        if (t.type === 'star') {
          ctx.beginPath();
          for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4, rr = k % 2 ? r * 0.35 : r * 1.3; ctx[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
          ctx.closePath(); ctx.fill();
        } else ctx.fillRect(x - r, y - r * 0.5, r * 2, r);
      }
    }
  } catch (_) { /* a failed preview is a blank box: the Lab falls back to a colour swatch */ }
  ctx.restore();
}

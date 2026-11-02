// Trail Blazer's Lab looks (lab/SPEC.md §2.7, §4.2): the art for the 16 `tb.*` items the Lab shop sells and the Lab crate drops.
// The Lab loads this file by its GAME_MODULES path and lists an item only when its id is in LOOKS_READY (every id here is drawn):
//   tb.paint.*  vehicle paint  → a paint object the engine and the garage preview already know how to draw (body, stripe, bands)
//   tb.decal.*  a decal        → the engine's decal ids ('flames' and 'stars' are the ones the garage has; 'bolt' and 'edge' are new)
//   tb.rim.*    wheel rims     → src/game/vehicle.js RIMS (the new rim option)
//   tb.ghost.*  the ghost's look (the translucent copy of a run: its outline, opacity and a short trail), src/data/ghostLooks.js
// They are looks only: no number the game computes, no price, no cash changes (lab/SPEC.md §1.4). The game reads the equipped ones with
// labBridge.cosmetics().slots and merges them into the look passed to the engine and the previews (applyLabLook, in vehiclePreview.js's
// playerLook). A null slot means the game's own look.
import { GHOST_STYLES, ghostStyle } from '../data/ghostLooks.js';
import { drawRanger, loadVehicle, vehicleModule } from '../ui/vehiclePreview.js';

// bands run top to bottom across the body (the engine's `rainbow` paint field); `body` is the fallback fill and the helmet's base colour
export const LAB_PAINTS = Object.freeze({
  ocean: Object.freeze({ id: 'lab-ocean', name: 'Ocean', body: '#1f78c8', stripe: '#bdf0ff', rainbow: ['#8fe0ff', '#29a3d9', '#1565c0', '#0b3d91'], swatch: 'linear-gradient(180deg, #8fe0ff, #29a3d9 40%, #0b3d91)' }),
  sunset: Object.freeze({ id: 'lab-sunset', name: 'Sunset', body: '#ff7a3a', stripe: '#ffe9a8', rainbow: ['#ffd23f', '#ff9f3a', '#ff5d3a', '#b3245a'], swatch: 'linear-gradient(180deg, #ffd23f, #ff9f3a 40%, #b3245a)' }),
  mint: Object.freeze({ id: 'lab-mint', name: 'Mint', body: '#7fe0b0', stripe: '#2f8b66', swatch: 'linear-gradient(135deg, #7fe0b0 0 62%, #2f8b66 62%)' }),
  bluechrome: Object.freeze({ id: 'lab-bluechrome', name: 'Blue chrome', body: '#8fb8e0', stripe: '#1c4f86', rainbow: ['#f2f9ff', '#a9c8e6', '#4d86c0', '#b8d3ee'], swatch: 'linear-gradient(135deg, #f2f9ff, #a9c8e6 40%, #4d86c0 70%, #b8d3ee)' }),
  purplehaze: Object.freeze({ id: 'lab-purplehaze', name: 'Purple haze', body: '#8a56d6', stripe: '#ffd23f', rainbow: ['#e1ceff', '#a77be0', '#6a3fb0', '#3b1f7a'], swatch: 'linear-gradient(180deg, #e1ceff, #a77be0 40%, #3b1f7a)' }),
  goldleaf: Object.freeze({ id: 'lab-goldleaf', name: 'Gold leaf', body: '#f2c230', stripe: '#5a3a00', rainbow: ['#fff3a0', '#f2c230', '#c99a14', '#f6d45a'], swatch: 'linear-gradient(135deg, #fff3a0, #f2c230 45%, #c99a14 75%, #f6d45a)' }),
});
// the engine's decal ids; 'edge' is the new "checker edge" and 'bolt' the lightning bolt (vehicle.js DECALS)
export const LAB_DECALS = Object.freeze({ bolt: 'bolt', flames: 'flames', stars: 'stars', checkeredge: 'edge' });
export const LAB_RIMS = Object.freeze({ neon: 'neon', gold: 'gold' });
export const LAB_GHOSTS = Object.freeze(Object.fromEntries(Object.keys(GHOST_STYLES).map((k) => [k, k])));

export const LAB_NAMES = Object.freeze({
  'tb.paint.ocean': 'Ocean paint', 'tb.paint.sunset': 'Sunset paint', 'tb.paint.mint': 'Mint paint', 'tb.paint.bluechrome': 'Blue chrome paint',
  'tb.paint.purplehaze': 'Purple haze paint', 'tb.paint.goldleaf': 'Gold leaf paint',
  'tb.decal.bolt': 'Bolt decal', 'tb.decal.flames': 'Flames decal', 'tb.decal.stars': 'Stars decal', 'tb.decal.checkeredge': 'Checker edge decal',
  'tb.rim.neon': 'Neon rims', 'tb.rim.gold': 'Gold rims',
  'tb.ghost.ice': 'Ice ghost', 'tb.ghost.flame': 'Flame ghost', 'tb.ghost.gold': 'Gold ghost', 'tb.ghost.rainbow': 'Rainbow ghost',
});
export const LOOKS_READY = Object.freeze(Object.keys(LAB_NAMES));

const tail = (id) => (typeof id === 'string' ? id.slice(id.lastIndexOf('.') + 1) : '');
const inReady = (id) => typeof id === 'string' && LOOKS_READY.includes(id);
/** The paint object for an equipped `tb.paint.*` id (null for none / unknown). */
export const paintFor = (id) => (inReady(id) && id.startsWith('tb.paint.') ? LAB_PAINTS[tail(id)] || null : null);
export const decalFor = (id) => (inReady(id) && id.startsWith('tb.decal.') ? LAB_DECALS[tail(id)] || null : null);
export const rimFor = (id) => (inReady(id) && id.startsWith('tb.rim.') ? LAB_RIMS[tail(id)] || null : null);
/** The ghost style for an equipped `tb.ghost.*` id (null for none → the plain ghost). */
export const ghostFor = (id) => (inReady(id) && id.startsWith('tb.ghost.') && LAB_GHOSTS[tail(id)] ? ghostStyle(tail(id)) : null);

/** The player's look with the equipped Lab paint / decal / rim laid over it. `slots` = labBridge.cosmetics().slots. */
export function applyLabLook(look, slots) {
  const s = slots && typeof slots === 'object' ? slots : {};
  const out = { ...look };
  const paint = paintFor(s.paint), decal = decalFor(s.decal), rim = rimFor(s.rim);
  if (paint) out.paint = paint;
  if (decal) out.decal = decal;
  if (rim) out.rim = rim;
  return out;
}
/** A short line for the garage: "Lab looks on: Ocean paint, Neon rims" ('' when none). */
export function describeLabLook(slots) {
  const s = slots && typeof slots === 'object' ? slots : {};
  return ['paint', 'decal', 'rim', 'ghost'].map((k) => (inReady(s[k]) ? LAB_NAMES[s[k]] : '')).filter(Boolean).join(', ');
}

// ---------- shop / crate previews ----------
try { loadVehicle(); } catch (_) { /* the fallback Ranger is drawn until the engine's art has loaded */ }
const BASE_PAINT = 'sage';
/** Draw one item into a w×h canvas context (y down, origin top-left): the Ranger with the item on it. */
export function paintPreview(ctx, item, w, h) {
  const id = item && item.id;
  if (!inReady(id)) return false;
  const slot = id.split('.')[1];
  const look = { vehicle: 'ranger150', paint: BASE_PAINT, decal: 'none', helmet: 'classic', suit: 'rookie' };
  if (slot === 'paint') look.paint = paintFor(id);
  if (slot === 'decal') look.decal = decalFor(id);
  if (slot === 'rim') look.rim = rimFor(id);
  const m = vehicleModule();
  ctx.save();
  try {
    if (m && typeof m.drawVehicle === 'function') {
      const scale = Math.min((w * 0.9) / 3.0, (h * 0.78) / 2.2);
      ctx.translate(w / 2 - ((1.47 - 1.36) / 2) * scale, h * 0.9);
      ctx.scale(scale, -scale);
      if (slot === 'ghost') {
        const st = ghostStyle(tail(id));
        const rim = st.rim === 'rainbow' ? '#ff9f1a' : st.rim;
        ctx.globalAlpha = Math.min(0.85, st.alpha + 0.3);
        // the short trail behind the copy
        const cols = st.trail || [];
        cols.forEach((c, i) => { ctx.fillStyle = c; ctx.globalAlpha = 0.7 - i * 0.18; ctx.beginPath(); ctx.arc(-1.7 - i * 0.28, 0.7 + (i % 2) * 0.12, 0.13 - i * 0.015, 0, Math.PI * 2); ctx.fill(); });
        ctx.globalAlpha = Math.min(0.85, st.alpha + 0.3);
        m.drawVehicle(ctx, look, { t: 0, speed: 0, lw: 2.2 / scale, rim });
      } else m.drawVehicle(ctx, look, { t: 0, speed: 0, lw: 2.2 / scale });
    } else {
      ctx.translate(w / 2, h * 0.86);
      const p = typeof look.paint === 'object' ? look.paint : null;
      drawRanger(ctx, { paint: typeof look.paint === 'string' ? look.paint : 'sage', color: p ? p.body : undefined, decal: slot === 'decal' && ['flames', 'stars'].includes(look.decal) ? look.decal : 'none' }, { width: Math.min(w * 0.9, h * 1.3) });
    }
  } catch (_) { ctx.restore(); return false; }
  ctx.restore();
  return true;
}

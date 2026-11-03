// Fraction Fright's looks for the Lab (lab/SPEC.md §3.3, §4.3). The Lab loads this module lazily (GAME_MODULES.ff) and shows or drops
// an item only if its id is in LOOKS_READY, so this list is exactly what the wave scene, the title yard and the Yard can draw:
//   ff.fence.*  a finish painted over whichever fence the yard has (colour, edge, an optional glow)
//   ff.tower.*  a flag, lantern, banner, orb or crown on the tower once one is built
// `labLooks(cosmetics)` is what the game reads at the start of every round and on each screen: null = the game's own look.
import { finishPrims, paint2d, topperPrims, towerPrims } from './yardArt.js';

export const FENCE_FINISHES = Object.freeze(['candy', 'moss', 'neon', 'goldtrim', 'frost', 'vines']);
export const TOWER_TOPPERS = Object.freeze(['flagred', 'flaglab', 'lanternblue', 'banner', 'glowtop', 'crowntop']);
export const LOOKS_READY = Object.freeze([...FENCE_FINISHES.map((x) => `ff.fence.${x}`), ...TOWER_TOPPERS.map((x) => `ff.tower.${x}`)]);

const tail = (id) => String(id || '').split('.').pop();
/** From lab.cosmetics('ff') (or the bridge's copy) to the two finishes to draw, each a plain name or null. */
export function labLooks(cos) {
  const slots = (cos && cos.slots) || {};
  const pick = (slot, list) => { const raw = slots[slot]; const name = raw ? tail(raw) : null; return name && list.includes(name) && LOOKS_READY.includes(`ff.${slot}.${name}`) ? name : null; };
  return { fence: pick('fence', FENCE_FINISHES), tower: pick('tower', TOWER_TOPPERS) };
}

/** The shop's picture of an item on a w × h canvas context: a stretch of grey fence with the finish, or a watchtower with the topper. */
export function paintPreview(ctx, item, w, h) {
  const name = tail(item && item.id);
  ctx.save();
  ctx.fillStyle = '#16151a'; ctx.fillRect(0, 0, w, h);
  if (item && item.slot === 'tower') {
    const tw = towerPrims(2), k = Math.min((h * 0.9) / tw.h, (w * 0.8) / tw.w);
    const ox = w / 2, oy = h - 4;
    paint2d(ctx, tw.prims, ox, oy, k, 0.6, 2);
    paint2d(ctx, topperPrims(name, tw), ox, oy, k, 0.6, 2);
  } else {
    const fh = h * 0.42, y0 = h * 0.38;
    ctx.fillStyle = '#26252a'; ctx.fillRect(0, y0 + fh, w, h - y0 - fh);
    ctx.fillStyle = '#b7b0a1'; ctx.strokeStyle = '#4a463f'; ctx.lineWidth = 1.5;
    for (let x = 4; x < w; x += 15) { ctx.beginPath(); ctx.moveTo(x, y0 + fh); ctx.lineTo(x, y0 + 6); ctx.lineTo(x + 5, y0); ctx.lineTo(x + 10, y0 + 6); ctx.lineTo(x + 10, y0 + fh); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    paint2d(ctx, finishPrims(name, w, fh), 0, y0, 1, 0.6, 2);
  }
  ctx.restore();
}

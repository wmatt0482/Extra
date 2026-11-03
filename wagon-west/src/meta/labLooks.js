// Wagon West's looks for The Lab (lab/SPEC.md §3.3, §4.4): the module the Lab loads lazily (GAME_MODULES.ww) to learn which of the game's catalogue items it can DRAW, and to paint their
// previews in the shop. `LOOKS_READY` lists the item ids this game draws; the Lab shows and drops an item only when its owner's module lists it. The drawing itself is the scene's own
// wagon and person sprites (src/scene/looks16.js): a cover is the pattern on the wagon's canvas bonnet, an outfit is the party leader's plain 1840s clothes.
//   ww.cover.<id>   stripes patchwork sunflower riverblue (common) · starquilt nightsky (rare) · goldthread (epic)
//   ww.outfit.<id>  bonnet strawhat vest (common) · redscarf spectacles plumehat (rare) · cloak (epic)
// No cover or outfit imitates any nation's dress or designs (docs/SOURCES.md). Wagon West's own paints, flags, bugle calls, hats and decorations are unchanged and keep working beside these.
import { COVER_IDS, OUTFIT_IDS, coverBase } from '../scene/looks16.js';
import { drawWagon, drawPerson, personLook } from '../scene/sprites.js';

export const LOOKS_READY = Object.freeze([...COVER_IDS.map((id) => `ww.cover.${id}`), ...OUTFIT_IDS.map((id) => `ww.outfit.${id}`)]);

/** A preview of an item for the shop: a cover on a small wagon, an outfit on a walking person, on whatever the Lab has already painted behind it. */
export function paintPreview(ctx, item, w, h) {
  const id = String(item && item.id ? item.id : item || '');
  const name = id.slice(id.lastIndexOf('.') + 1);
  if (id.startsWith('ww.cover.') && COVER_IDS.includes(name)) {
    const s = Math.min(w / 175, h / 112);
    drawWagon(ctx, w * 0.5 - 12 * s, h * 0.92, s, { box: '#a0612b', wheel: '#7a4a26', cover: coverBase(name), coverLook: name, flag: null, name: '' }, 0.4, 0, 0);
    return true;
  }
  if (id.startsWith('ww.outfit.') && OUTFIT_IDS.includes(name)) {
    const s = Math.min(w / 46, h / 84);
    drawPerson(ctx, w * 0.5, h * 0.94, s, personLook('trail-leader', '#5b8c5a', 'none', name), 0, 0, 0, 1);
    return true;
  }
  return false;
}

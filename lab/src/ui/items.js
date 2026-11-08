// Item previews: the Lab paints its own items (avatar, pet, home); a game's items are painted by that game's labLooks module
// (`paintPreview(ctx, item, w, h)`), else a colour swatch with the game's badge. A preview is an element: a canvas or a swatch.
import { GAME_MODULES } from '../index.js';
import { ITEM_BY_ID } from '../data/catalog.js';
import { GAMES } from '../core/model.js';
import { gameBadge, hueOf } from './glyph.js';
import { paintLabItem } from './scene.js';

const mods = {};          // game -> { ids, paint } once loaded
let loadingAll = null;
/** Load every game's labLooks module (a missing one hides that game's items). Resolves the list of ready ids. */
export function loadGameLooks() {
  if (!loadingAll) {
    loadingAll = Promise.all(GAMES.map((g) => import(GAME_MODULES[g]).then((m) => { mods[g] = { ids: Array.isArray(m.LOOKS_READY) ? m.LOOKS_READY.filter((x) => typeof x === 'string') : [], paint: typeof m.paintPreview === 'function' ? m.paintPreview : null }; })
      .catch(() => { mods[g] = { ids: [], paint: null }; }))).then(() => GAMES.flatMap((g) => mods[g].ids));
  }
  return loadingAll;
}

function dprOf() { return Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1); }
/** A preview element for the item at a CSS size (square unless h is given). o = { color, species, t }. */
export function itemPreview(item, size = 64, o = {}) {
  const w = size, h = o.h || size;
  const owner = item.owner;
  const cv = document.createElement('canvas');
  const d = dprOf();
  cv.width = w * d; cv.height = h * d; cv.style.width = `${w}px`; cv.style.height = `${h}px`;
  cv.className = 'lab-prev'; cv.setAttribute('aria-hidden', 'true');
  const c = cv.getContext('2d');
  c.setTransform(d, 0, 0, d, 0, 0);
  c.fillStyle = 'rgba(8,12,40,.55)'; c.beginPath(); if (c.roundRect) c.roundRect(0, 0, w, h, 10); else c.rect(0, 0, w, h); c.fill();
  c.save(); c.beginPath(); if (c.roundRect) c.roundRect(0, 0, w, h, 10); else c.rect(0, 0, w, h); c.clip();
  let done = false;
  if (owner === 'av' || owner === 'pet' || owner === 'home') { try { done = paintLabItem(c, item, w, h, o); } catch (_) { done = false; } }
  else {
    const m = mods[owner];
    if (m && m.paint) { try { c.save(); m.paint(c, item, w, h); c.restore(); done = true; } catch (_) { done = false; } }
    if (!done && owner === 'cf') { try { done = paintLabItem(c, item, w, h, o); } catch (_) { done = false; } }       // the detective looks: the Lab paints them
  }
  c.restore();
  if (done) return cv;
  // a swatch: two hues of the id, and the game's badge
  const hue = hueOf(item.id);
  const sw = document.createElement('div');
  sw.className = 'lab-prev lab-swatch';
  sw.style.width = `${w}px`; sw.style.height = `${h}px`;
  sw.style.background = `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${(hue + 50) % 360} 65% 38%))`;
  sw.setAttribute('aria-hidden', 'true');
  sw.innerHTML = gameBadge(GAMES.includes(owner) ? owner : 'any', Math.round(Math.min(w, h) * 0.46));
  return sw;
}
export const itemById = (id) => ITEM_BY_ID[id] || null;

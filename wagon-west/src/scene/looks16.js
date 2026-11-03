// The Lab's looks for Wagon West (lab/SPEC.md §2.7, §4.4; v1.6): seven wagon COVERS (the canvas bonnet's pattern) and seven OUTFITS (the party leader's plain 1840s clothes, a layer on the
// first companion). Plain canvas paths in the house style (flat warm fills, one chunky outline), drawn by the scene's own wagon and person sprites: drawWagon reads `wagon.coverLook`,
// drawPerson reads `look.outfit`. `null` / an unknown id draws the game's own look, exactly as before. Pure drawing: no DOM, no storage.
//
// Content rule (docs/SOURCES.md): NO cover or outfit imitates any nation's dress or designs, and none is a flag: quilts, stripes, flowers, water and night sky; a bonnet, a straw hat, a
// vest, a scarf, spectacles, a plumed hat and a cloak, the plain clothes of a wagon family of the 1840s.
import { TAU, OUT, shade } from './util.js';

/** The ids the Lab may list (item ids of lab/src/data/catalog.js; the Lab shows and drops an item only when this module lists it). */
export const COVER_IDS = Object.freeze(['stripes', 'patchwork', 'sunflower', 'riverblue', 'starquilt', 'nightsky', 'goldthread']);
export const OUTFIT_IDS = Object.freeze(['bonnet', 'strawhat', 'vest', 'redscarf', 'spectacles', 'plumehat', 'cloak']);
/** The slot value ('ww.cover.stripes') or a bare id ('stripes') as a bare id; null for anything not on the lists. */
export function lookId(slotValue, ids) {
  const id = typeof slotValue === 'string' ? slotValue.slice(slotValue.lastIndexOf('.') + 1) : '';
  return ids.includes(id) ? id : null;
}

/** An outfit id from a slot value or a bare id ('ww.outfit.cloak' / 'cloak'), else null. */
export const outfitOf = (v) => lookId(v, OUTFIT_IDS);

/** The arched bonnet of the wagon's cover in wagon units (the path drawWagon fills): `by` is the body's lift. */
export function bonnetPath(c, by = 0) {
  c.beginPath();
  c.moveTo(-56, by - 46);
  c.bezierCurveTo(-68, by - 70, -64, by - 98, -40, by - 98);
  c.lineTo(38, by - 98);
  c.bezierCurveTo(62, by - 98, 66, by - 70, 54, by - 46);
  c.closePath();
}

const star = (c, x, y, r, pts = 5, inner = 0.45, rot = -Math.PI / 2) => {
  c.beginPath();
  for (let i = 0; i < pts * 2; i++) { const a = rot + (i * Math.PI) / pts, rr = i % 2 ? r * inner : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath();
};

/** The covers: `base` is the canvas colour under the pattern (the hoops and the underside shade from it); paint(c, by) draws the pattern inside the bonnet (already clipped). */
export const COVER_LOOKS = {
  stripes: { base: '#f3e9cf', paint(c, by) {                         // tan and cream awning stripes
    for (let x = -72, i = 0; x < 72; x += 12, i++) { if (i % 2) continue; c.fillStyle = '#d9b36a'; c.fillRect(x, by - 100, 12, 56); }
  } },
  patchwork: { base: '#f1e6cc', paint(c, by) {                       // a quilt of earthy squares with stitches
    const cols = ['#e3b7a0', '#a9c8a0', '#e8d27a', '#9fb8d0', '#d9a0a0', '#c7b08a'];
    for (let gx = 0, i = 0; gx < 10; gx++) for (let gy = 0; gy < 5; gy++, i++) {
      const x = -70 + gx * 14, y = by - 100 + gy * 11;
      c.fillStyle = cols[(gx * 3 + gy * 5 + (gx > 4 ? 2 : 0)) % cols.length]; c.fillRect(x, y, 14, 11);
      c.strokeStyle = 'rgba(60,40,20,.35)'; c.lineWidth = 0.8; c.setLineDash([2, 2]); c.strokeRect(x + 1.2, y + 1.2, 11.6, 8.6); c.setLineDash([]);
    }
  } },
  sunflower: { base: '#f6efdc', paint(c, by) {                      // sunflowers on the canvas
    const at = [[-48, -62], [-22, -80], [4, -58], [28, -82], [48, -60], [-4, -86], [-62, -84]];
    for (const [fx, fy] of at) {
      const y = by + fy;
      c.beginPath(); c.moveTo(fx, y + 4); c.lineTo(fx - 1, y + 16); c.lineWidth = 1.6; c.strokeStyle = '#4f8a3b'; c.stroke();
      for (let k = 0; k < 10; k++) { const a = (k * TAU) / 10; c.beginPath(); c.ellipse(fx + Math.cos(a) * 6.5, y + Math.sin(a) * 6.5, 4, 2.2, a, 0, TAU); c.fillStyle = '#f2b33d'; c.fill(); }
      c.beginPath(); c.arc(fx, y, 4, 0, TAU); c.fillStyle = '#6b4423'; c.fill();
    }
  } },
  riverblue: { base: '#cfe3ee', paint(c, by) {                      // water-blue canvas with waves
    for (let r = 0; r < 4; r++) {
      const y = by - 92 + r * 13; c.beginPath(); c.moveTo(-72, y);
      for (let x = -72; x <= 72; x += 8) c.quadraticCurveTo(x + 2, y - 4 - (r % 2) * 1.5, x + 4, y);
      c.lineWidth = 2.4; c.strokeStyle = r % 2 ? '#5bb8d6' : '#ffffff'; c.stroke();
    }
  } },
  starquilt: { base: '#f2ead2', paint(c, by) {                      // a quilt of eight-pointed stars, teal and mustard
    for (let gx = 0; gx < 6; gx++) for (let gy = 0; gy < 3; gy++) {
      const x = -52 + gx * 21 + (gy % 2) * 8, y = by - 86 + gy * 19;
      star(c, x, y, 8, 8, 0.5, -Math.PI / 2); c.fillStyle = (gx + gy) % 2 ? '#2f8f8a' : '#e0a526'; c.fill();
      c.lineWidth = 0.9; c.strokeStyle = 'rgba(43,29,20,.55)'; c.stroke();
    }
  } },
  nightsky: { base: '#2c3a66', paint(c, by) {                     // a deep night with stars and a crescent
    for (let i = 0; i < 26; i++) { const x = -66 + ((i * 53) % 130), y = by - 98 + ((i * 29) % 48); c.fillStyle = i % 5 === 0 ? '#fff6c8' : 'rgba(255,255,255,.85)'; c.fillRect(x, y, i % 5 === 0 ? 2.6 : 1.6, i % 5 === 0 ? 2.6 : 1.6); }
    c.beginPath(); c.arc(30, by - 78, 9, 0, TAU); c.fillStyle = '#f5e9b8'; c.fill();
    c.beginPath(); c.arc(34, by - 81, 8, 0, TAU); c.fillStyle = '#2c3a66'; c.fill();
  } },
  goldthread: { base: '#f6efdc', paint(c, by) {                      // gold trim and stitching along the edges
    c.lineWidth = 3; c.strokeStyle = '#e8b33a';
    c.beginPath(); c.moveTo(-70, by - 50); c.lineTo(70, by - 50); c.stroke();
    c.beginPath(); c.moveTo(-70, by - 96); c.lineTo(70, by - 96); c.stroke();
    c.lineWidth = 1.4; c.strokeStyle = '#c9902a'; c.setLineDash([3, 3]);
    c.beginPath(); c.moveTo(-70, by - 56); c.lineTo(70, by - 56); c.moveTo(-70, by - 90); c.lineTo(70, by - 90); c.stroke(); c.setLineDash([]);
    for (let x = -50; x <= 50; x += 20) { c.beginPath(); c.moveTo(x, by - 82); c.lineTo(x + 6, by - 73); c.lineTo(x, by - 64); c.lineTo(x - 6, by - 73); c.closePath(); c.fillStyle = '#e8b33a'; c.fill(); c.lineWidth = 1; c.strokeStyle = '#8a5a12'; c.stroke(); }
  } },
};
/** The canvas colour for a cover look (the game's cream for none or an unknown id). */
export const coverBase = (id) => (COVER_LOOKS[id] ? COVER_LOOKS[id].base : '#f6efdc');
/** Paint a cover look on the wagon's bonnet (the caller has drawn the plain canvas): clipped to the bonnet, so it never spills. No-op for none or an unknown id. */
export function paintCoverLook(c, id, by = 0) {
  const look = COVER_LOOKS[id];
  if (!look) return false;
  c.save(); bonnetPath(c, by); c.clip();
  try { look.paint(c, by); } finally { c.restore(); }
  return true;
}

/** The outfits. `hat` replaces the leader's hat (and `hatColor` its band); the rest are layers drawn over the body (drawOutfit). */
export const OUTFITS = {
  bonnet: { hat: 'bonnet', hatColor: '#efd2c0' },
  strawhat: { hat: 'straw', hatColor: '#c94a3a' },
  plumehat: { hat: 'plume', hatColor: '#5a3a6a' },
  vest: {}, redscarf: {}, spectacles: {}, cloak: {},
};
/** The hat an outfit puts on the leader (null when the outfit leaves the hat alone). */
export const outfitHat = (id) => (OUTFITS[id] && OUTFITS[id].hat ? { hat: OUTFITS[id].hat, hatColor: OUTFITS[id].hatColor } : null);

const fillOut = (c, fill, lw = 2) => { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke(); };
/** A plumed felt hat (hatPath's 'plume'): a wide brim, a round crown, a feather curling back. */
export function plumeHat(c, hx, hy, col) {
  c.beginPath(); c.ellipse(hx, hy - 6, 16, 3.6, 0, 0, TAU); fillOut(c, col);
  c.beginPath(); c.moveTo(hx - 8, hy - 7); c.quadraticCurveTo(hx - 8, hy - 19, hx, hy - 18); c.quadraticCurveTo(hx + 8, hy - 19, hx + 8, hy - 7); c.closePath(); fillOut(c, col);
  c.beginPath(); c.rect(hx - 8, hy - 10, 16, 3); c.fillStyle = shade(col, -0.35); c.fill();
  c.beginPath(); c.moveTo(hx - 6, hy - 12); c.quadraticCurveTo(hx - 20, hy - 24, hx - 22, hy - 10); c.quadraticCurveTo(hx - 14, hy - 16, hx - 6, hy - 9); c.closePath(); fillOut(c, '#e8c35a', 1.6);
}
/** The layers of an outfit over a standing or walking person (the body spans x -8..8, y -45..-19, the head sits at (0, -54), facing right). Called by drawPerson after the head and the hat,
 *  before the front arm. */
export function drawOutfit(c, id, look) {
  if (id === 'vest') {
    c.beginPath(); c.moveTo(-8, -44); c.lineTo(8, -44); c.lineTo(8, -22); c.quadraticCurveTo(0, -18, -8, -22); c.closePath(); fillOut(c, '#7a4e2c', 2);
    c.beginPath(); c.moveTo(1, -44); c.lineTo(6, -44); c.lineTo(3.5, -36); c.closePath(); c.fillStyle = look.color; c.fill();
    for (const y of [-33, -27]) { c.beginPath(); c.arc(4, y, 1.5, 0, TAU); c.fillStyle = '#f0d78a'; c.fill(); }
  } else if (id === 'redscarf') {
    c.beginPath(); c.moveTo(-7, -46); c.lineTo(8, -46); c.lineTo(2.5, -35); c.closePath(); fillOut(c, '#c0392b', 1.8);
    c.beginPath(); c.arc(4, -45, 2.4, 0, TAU); fillOut(c, '#d9503f', 1.4);
  } else if (id === 'spectacles') {
    c.beginPath(); c.arc(4.5, -55, 3.8, 0, TAU); c.fillStyle = 'rgba(210,235,245,.45)'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.moveTo(0.8, -55.5); c.lineTo(-7, -57); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
  } else if (id === 'cloak') {
    c.beginPath(); c.moveTo(-8, -45); c.lineTo(9, -45); c.quadraticCurveTo(14, -30, 13, -14); c.lineTo(-13, -14); c.quadraticCurveTo(-14, -30, -8, -45); c.closePath(); fillOut(c, '#5b3b7a', 2.2);
    c.beginPath(); c.moveTo(-2, -45); c.lineTo(-1, -16); c.lineWidth = 1.4; c.strokeStyle = shade('#5b3b7a', -0.35); c.stroke();
    c.beginPath(); c.arc(0, -44, 2.4, 0, TAU); fillOut(c, '#e8b33a', 1.4);
  }
}

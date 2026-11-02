// Build Crew's side of the Lab (lab/SPEC.md section 4.5): what the Lab shop may list and drop for this game, how the
// Lab's paints and decals are drawn through the existing whole-body paint and decal pipeline, and the preview pictures
// the shop cards use. The Lab loads this module by URL (GAME_MODULES.bc) and lists only the ids in LOOKS_READY, so an
// item appears in the shop only when this game can really show it. No imports of Three.js or the DOM: the scene reads
// the tables below, and the module loads in Node.
import { BLUEPRINTS, MACHINES, TOYS, COLORS } from '../content.mjs';
import { paintBlueprint } from '../blueprint.mjs';

/** The Lab paints (bc.paint.*): body colours for the paint layer. `checker` is a two-colour check drawn by the scene's
 *  paint material; the others are plain colours. */
export const LAB_PAINT = {
  'bc.paint.teal': { name: 'Teal', color: '#2a9a98' },
  'bc.paint.plum': { name: 'Plum', color: '#7b3e78' },
  'bc.paint.safety': { name: 'Safety', color: '#d4e028' },
  'bc.paint.checker': { name: 'Checker', color: '#f1f1ec', alt: '#23282c' },
  'bc.paint.gold': { name: 'Gold', color: '#d8a62c', metal: true },
};
/** The Lab decals (bc.decal.*) and the decal each one is drawn as (a short key the scene knows). */
export const LAB_DECAL = { 'bc.decal.labmark': 'labmark', 'bc.decal.flame': 'flame', 'bc.decal.rivets': 'rivets' };
/** The Lab vehicles and blueprints this game can enforce (they are unlock gates, not looks). */
export const LAB_VEHICLES = ['bc.veh.dump', 'bc.veh.fork'];
export const LAB_BLUEPRINTS = BLUEPRINTS.map((r) => r.lab);

/** Every id this game can draw or enforce. */
export const LOOKS_READY = [...Object.keys(LAB_PAINT), ...Object.keys(LAB_DECAL), ...LAB_VEHICLES, ...LAB_BLUEPRINTS];

/** The paint and decal to draw: the Lab's equipped look when there is one (a `cosmetics()` result from the bridge),
 *  else the builder's own save. A Lab paint key is the item id; a Lab decal is its short key. */
export function resolveLook(cosmetics, save) {
  const slots = cosmetics?.slots || {};
  return {
    paint: LAB_PAINT[slots.paint] ? slots.paint : save.paint,
    decal: LAB_DECAL[slots.decal] || save.decal,
  };
}

const INK = '#0b121a';
/** Draws a shop card for `item` (an entry of the Lab catalogue) into a w x h canvas context. */
export function paintPreview(ctx, item, w, h) {
  const id = item?.id || '';
  const slate = () => {
    ctx.fillStyle = '#15212d';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#3a4c5b';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  };
  const u = Math.min(w / 64, h / 46),
    at = (x, y) => [(w - 64 * u) / 2 + x * u, (h - 46 * u) / 2 + y * u];
  const box = (x, y, bw, bh, c, stroke = INK) => {
    const [px, py] = at(x, y);
    ctx.fillStyle = c;
    ctx.fillRect(px, py, bw * u, bh * u);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(1, u * 0.7);
      ctx.strokeRect(px, py, bw * u, bh * u);
    }
  };
  const wheel = (cx, cy, r) => {
    const [px, py] = at(cx, cy);
    ctx.fillStyle = '#161c21';
    ctx.beginPath();
    ctx.arc(px, py, r * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9aa2a8';
    ctx.beginPath();
    ctx.arc(px, py, r * u * 0.48, 0, Math.PI * 2);
    ctx.fill();
  };
  // a dump truck in profile, facing right, in colour c (a checker paints its bed and cab in two tones)
  const dump = (c, c2 = c) => {
    ctx.save();
    const [bx, by] = at(5, 10);
    ctx.translate(bx, by);
    ctx.rotate(-0.12);
    ctx.fillStyle = c2;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, u * 0.8);
    ctx.fillRect(0, 0, 30 * u, 13 * u);
    ctx.strokeRect(0, 0, 30 * u, 13 * u);
    ctx.restore();
    box(5, 24, 52, 6, '#262f37');
    box(37, 14, 14, 11, c);
    box(41, 16, 8, 5, '#24465a');
    box(51, 20, 7, 6, c);
    wheel(13, 31, 6.2);
    wheel(24, 31, 6.2);
    wheel(47, 31, 6.2);
  };
  const fork = (c) => {
    box(14, 12, 20, 3, '#262f37');
    box(15, 14, 22, 14, c);
    box(18, 6, 13, 12, 'rgba(0,0,0,0)', '#262f37');
    box(18, 16, 11, 10, '#24465a');
    box(48, 5, 3, 27, '#55626c');
    box(52, 5, 3, 27, '#55626c');
    box(40, 28, 20, 2.5, '#9aa2a8');
    box(41, 19, 4, 9, '#262f37');
    wheel(36, 31, 6);
    wheel(18, 33, 4.2);
  };
  const machine = (c, c2) => {
    box(10, 20, 40, 8, '#262f37');
    box(17, 8, 22, 20, c);
    box(21, 12, 14, 11, '#24465a');
    wheel(18, 31, 5);
    wheel(42, 31, 5);
    box(39, 17, 12, 4, c2 || c);
  };
  slate();
  if (LAB_PAINT[id]) {
    const p = LAB_PAINT[id];
    if (p.alt) {
      // the check: the machine body in squares
      machine(p.color, p.alt);
      ctx.save();
      const [x0, y0] = at(17, 8);
      ctx.beginPath();
      ctx.rect(x0, y0, 22 * u, 20 * u);
      ctx.clip();
      ctx.fillStyle = p.alt;
      for (let r = 0; r < 5; r++) for (let q = 0; q < 6; q++) if ((r + q) % 2) ctx.fillRect(x0 + q * 4 * u, y0 + r * 4 * u, 4 * u, 4 * u);
      ctx.restore();
      box(21, 12, 14, 11, '#24465a');
    } else machine(p.color);
    return;
  }
  if (LAB_DECAL[id]) {
    const [cx, cy] = at(32, 23);
    ctx.fillStyle = '#172531';
    ctx.strokeStyle = '#f2b538';
    ctx.lineWidth = Math.max(2, u * 1.6);
    ctx.fillRect(cx - 17 * u, cy - 17 * u, 34 * u, 34 * u);
    ctx.strokeRect(cx - 17 * u, cy - 17 * u, 34 * u, 34 * u);
    ctx.fillStyle = '#f2b538';
    ctx.strokeStyle = '#f2b538';
    if (id.endsWith('flame')) {
      ctx.fillStyle = '#ee7d1a';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 14 * u);
      ctx.bezierCurveTo(cx + 13 * u, cy - 4 * u, cx + 10 * u, cy + 12 * u, cx, cy + 13 * u);
      ctx.bezierCurveTo(cx - 12 * u, cy + 12 * u, cx - 11 * u, cy - 2 * u, cx - 4 * u, cy - 7 * u);
      ctx.bezierCurveTo(cx - 3 * u, cy - 2 * u, cx, cy - 4 * u, cx, cy - 14 * u);
      ctx.fill();
      ctx.fillStyle = '#f2d36a';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 6 * u, 4.5 * u, 6 * u, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (id.endsWith('rivets')) {
      for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) {
        ctx.beginPath();
        ctx.arc(cx + (q - 1) * 9 * u, cy + (r - 1) * 9 * u, 2.6 * u, 0, Math.PI * 2);
        ctx.fillStyle = '#c9d3da';
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else {
      // the Lab mark: a hexagon with a flask in it
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        ctx.lineTo(cx + Math.cos(a) * 12 * u, cy + Math.sin(a) * 12 * u);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 3 * u, cy - 7 * u);
      ctx.lineTo(cx + 3 * u, cy - 7 * u);
      ctx.lineTo(cx + 3 * u, cy - 2 * u);
      ctx.lineTo(cx + 7 * u, cy + 6 * u);
      ctx.lineTo(cx - 7 * u, cy + 6 * u);
      ctx.lineTo(cx - 3 * u, cy - 2 * u);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }
  if (id === 'bc.veh.dump') return void dump(MACHINES.dump.color);
  if (id === 'bc.veh.fork') return void fork(MACHINES.fork.color);
  const bp = BLUEPRINTS.find((r) => r.lab === id);
  if (bp) return void paintBlueprint(ctx, bp, w, h);
  // anything else: a plain swatch
  ctx.fillStyle = '#4a5c6b';
  ctx.fillRect(w * 0.2, h * 0.2, w * 0.6, h * 0.6);
}

/** The gallery rows the Lab keeps for a finished build or a saved site: at most 48 settled toys as
 *  [typeIndex, colorIndex, x * 10, z * 10, y * 10] (typeIndex into Object.keys(TOYS), colorIndex into COLORS, 255 for a
 *  custom colour), taken from the poses the physics reports. When there are more than 48, the ones nearest the middle
 *  of the build are kept. No picture ever leaves the device: the Lab draws these as plans from the numbers. */
export function galleryPieces(poses, limit = 48) {
  const kinds = Object.keys(TOYS),
    list = poses.filter((p) => kinds.includes(p.type));
  if (list.length > limit) {
    const cx = list.reduce((n, p) => n + p.position.x, 0) / list.length,
      cz = list.reduce((n, p) => n + p.position.z, 0) / list.length;
    list.sort((a, b) => Math.hypot(a.position.x - cx, a.position.z - cz) - Math.hypot(b.position.x - cx, b.position.z - cz));
    list.length = limit;
  }
  return list.map((p) => {
    const color = COLORS.indexOf(p.color);
    return [
      kinds.indexOf(p.type),
      color < 0 ? 255 : color,
      Math.round(p.position.x * 10),
      Math.round(p.position.z * 10),
      Math.round(p.position.y * 10),
    ];
  });
}

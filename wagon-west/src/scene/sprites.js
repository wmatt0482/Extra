// Wagon West sprites: the covered wagon, the draft animals, the walking companions (with their hats), the critters the
// party spots, the hunt's animals, the fish, the bow and the cartoon puff. Plain canvas paths in the house style: flat
// warm fills, one chunky outline. Every sprite is drawn in its own units around a ground point (x, y) (y down) and
// scaled by `s` (css px per unit, the scene's size factor), facing right unless `dir` is -1. Nothing here allocates
// per frame beyond the canvas calls; colours that depend on data (paint, a companion's colour) are resolved once by
// the caller and passed in.
//
// Kid rules: no faces that show a mood (the HUD owns the mood faces), no blood, no corpses. A hit animal "flops"
// (rolls onto its back with dizzy stars, cartoon-stunned), then a puff and it is gone.

import { TAU, OUT, shade, rrect, drawText, hashStr } from './util.js';

const LW = 2.4; // outline width in sprite units

function outlineFill(c, fill, lw = LW) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = OUT; c.stroke(); }

// ---------------------------------------------------------------- the wagon
export const PAINTS = {
  classic: '#a0612b', wood: '#a0612b', red: '#c94a3a', blue: '#3f6fb5', green: '#4f8a4b', yellow: '#e0a526',
  purple: '#7d5ba6', black: '#40363a', pink: '#e57fa8', orange: '#e07b28', teal: '#2f9c95', white: '#e9e2d0',
};
const FLAG_COLS = ['#d9534f', '#3f6fb5', '#f0a500', '#5b8c5a', '#7d5ba6', '#e57fa8', '#2f9c95'];
export function paintColor(paint) {
  if (typeof paint === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(paint)) return paint;
  return PAINTS[paint] || PAINTS.classic;
}
export function flagColor(flag) {
  if (!flag) return null;
  if (typeof flag === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(flag)) return flag;
  if (PAINTS[flag]) return PAINTS[flag];
  return FLAG_COLS[hashStr(flag) % FLAG_COLS.length];
}

function wheel(c, x, y, r, ang, col) {
  c.beginPath(); c.arc(x, y, r, 0, TAU);
  c.lineWidth = r * 0.28; c.strokeStyle = OUT; c.stroke();
  c.lineWidth = r * 0.16; c.strokeStyle = col; c.stroke();
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = ang + (i * TAU) / 12;
    const ca = Math.cos(a) * r * 0.9, sa = Math.sin(a) * r * 0.9;
    c.moveTo(x - ca, y - sa); c.lineTo(x + ca, y + sa);
  }
  c.lineWidth = r * 0.1; c.strokeStyle = shade(col, -0.25); c.stroke();
  c.beginPath(); c.arc(x, y, r * 0.2, 0, TAU); outlineFill(c, shade(col, -0.1), r * 0.08);
}

// w: { box, wheel, cover, flag (colour | null), name } ; spin: wheel angle ; bob: body lift (units) ; t: seconds
export function drawWagon(c, x, y, s, w, spin, bob, t) {
  c.save();
  c.translate(x, y); c.scale(s, s);
  // shadow
  c.beginPath(); c.ellipse(0, 2, 70, 6, 0, 0, TAU); c.fillStyle = 'rgba(40,25,10,0.22)'; c.fill();
  const by = -bob;
  // flag (behind the cover)
  if (w.flag) {
    c.beginPath(); c.moveTo(-52, by - 44); c.lineTo(-52, by - 118); c.lineWidth = 3.2; c.strokeStyle = OUT; c.stroke();
    c.lineWidth = 1.8; c.strokeStyle = '#d8c7a0'; c.stroke();
    const wv = Math.sin(t * 6) * 3;
    c.beginPath(); c.moveTo(-52, by - 116);
    c.quadraticCurveTo(-64, by - 112 + wv, -78, by - 108 - wv * 0.5);
    c.quadraticCurveTo(-64, by - 104 + wv * 0.5, -52, by - 100);
    c.closePath(); outlineFill(c, w.flag, 2);
  }
  // cover: the arched bonnet of a prairie schooner, flared at the ends
  c.beginPath();
  c.moveTo(-56, by - 46);
  c.bezierCurveTo(-68, by - 70, -64, by - 98, -40, by - 98);
  c.lineTo(38, by - 98);
  c.bezierCurveTo(62, by - 98, 66, by - 70, 54, by - 46);
  c.closePath();
  outlineFill(c, w.cover, 2.8);
  // hoops (ribs) and the shaded underside
  c.beginPath();
  for (const hx of [-30, -6, 18]) { c.moveTo(hx, by - 47); c.quadraticCurveTo(hx + 1, by - 75, hx, by - 97); }
  c.lineWidth = 1.6; c.strokeStyle = shade(w.cover, -0.18); c.stroke();
  c.beginPath(); c.moveTo(-56, by - 46); c.lineTo(54, by - 46); c.lineTo(52, by - 52); c.lineTo(-56, by - 52); c.closePath();
  c.fillStyle = shade(w.cover, -0.12); c.fill();
  // the name painted on the cover
  if (w.name) drawText(c, w.name, 15, -2, by - 72, '#6a3a1a', null, 84);
  // box
  c.beginPath(); rrect(c, -58, by - 48, 114, 28, 4); outlineFill(c, w.box, 2.8);
  c.beginPath(); c.moveTo(-56, by - 34); c.lineTo(54, by - 34);
  for (const bx of [-30, 0, 30]) { c.moveTo(bx, by - 46); c.lineTo(bx, by - 22); }
  c.lineWidth = 1.5; c.strokeStyle = shade(w.box, -0.28); c.stroke();
  // tongue (to the yoke) and the axles
  c.beginPath(); c.moveTo(52, by - 22); c.lineTo(96, -17); c.lineWidth = 4.5; c.strokeStyle = OUT; c.stroke();
  c.lineWidth = 2.4; c.strokeStyle = '#8a5a2e'; c.stroke();
  // wheels: big at the back, smaller at the front
  wheel(c, -34, -20, 20, spin, w.wheel);
  wheel(c, 34, -16, 16, spin * 1.25, w.wheel);
  c.restore();
}

// ---------------------------------------------------------------- draft animals
// one ox facing right, ground at 0; ph = walk phase (radians), amp = leg swing (0 standing)
function ox(c, ph, amp, body, dark) {
  const legs = [[-17, 0], [-10, Math.PI], [12, Math.PI], [19, 0]];
  c.lineCap = 'round';
  for (const [lx, o] of legs) {
    const a = Math.sin(ph + o) * amp;
    const fx = lx + Math.sin(a) * 15, fy = -Math.cos(a) * 15 + 15;
    c.beginPath(); c.moveTo(lx, -18); c.lineTo(fx, fy - 1);
    c.lineWidth = 8.5; c.strokeStyle = OUT; c.stroke();
    c.lineWidth = 5; c.strokeStyle = dark; c.stroke();
    c.beginPath(); c.moveTo(fx - 2.5, fy); c.lineTo(fx + 2.5, fy); c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
  }
  // tail
  c.beginPath(); c.moveTo(-26, -34); c.quadraticCurveTo(-33, -26, -30, -16); c.lineWidth = 2.6; c.strokeStyle = OUT; c.stroke();
  // body
  c.beginPath(); rrect(c, -28, -44, 54, 28, 13); outlineFill(c, body);
  c.beginPath(); c.ellipse(-6, -30, 9, 6, 0.2, 0, TAU); c.fillStyle = shade(body, 0.35); c.fill();
  // head (lowered, pulling), horns
  c.beginPath(); c.moveTo(26, -32); c.lineTo(32, -46); c.lineTo(36, -46); c.stroke();
  c.beginPath(); c.moveTo(33, -44); c.quadraticCurveTo(28, -56, 36, -58); c.moveTo(38, -44); c.quadraticCurveTo(44, -54, 40, -58);
  c.lineWidth = 5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.6; c.strokeStyle = '#efe4c8'; c.stroke();
  c.beginPath(); rrect(c, 26, -46, 18, 20, 7); outlineFill(c, body);
  c.beginPath(); c.ellipse(41, -29, 5, 4, 0, 0, TAU); outlineFill(c, '#d9a38a', 1.8);
  c.beginPath(); c.arc(36, -39, 1.8, 0, TAU); c.fillStyle = OUT; c.fill();
  c.lineCap = 'butt';
}
function mule(c, ph, amp, body, dark) {
  const legs = [[-15, 0], [-9, Math.PI], [11, Math.PI], [17, 0]];
  c.lineCap = 'round';
  for (const [lx, o] of legs) {
    const a = Math.sin(ph + o) * amp;
    const fx = lx + Math.sin(a) * 19, fy = -Math.cos(a) * 19 + 19;
    c.beginPath(); c.moveTo(lx, -22); c.lineTo(fx, fy - 1);
    c.lineWidth = 6.5; c.strokeStyle = OUT; c.stroke();
    c.lineWidth = 3.4; c.strokeStyle = dark; c.stroke();
  }
  c.beginPath(); c.moveTo(-22, -38); c.quadraticCurveTo(-30, -30, -28, -20); c.lineWidth = 2.4; c.strokeStyle = OUT; c.stroke();
  c.beginPath(); c.moveTo(-28, -21); c.lineTo(-26, -16); c.lineWidth = 4; c.stroke();
  c.beginPath(); rrect(c, -24, -44, 46, 22, 10); outlineFill(c, body);
  // neck + head, long ears
  c.beginPath(); c.moveTo(14, -40); c.lineTo(26, -60); c.lineTo(34, -56); c.lineTo(24, -36); c.closePath(); outlineFill(c, body);
  c.beginPath(); c.ellipse(24, -64, 3.2, 10, -0.35, 0, TAU); outlineFill(c, body, 2);
  c.beginPath(); c.ellipse(30, -65, 3.2, 10, 0.15, 0, TAU); outlineFill(c, body, 2);
  c.beginPath(); rrect(c, 24, -62, 20, 12, 5); outlineFill(c, body);
  c.beginPath(); c.ellipse(41, -55, 4, 4, 0, 0, TAU); c.fillStyle = shade(body, 0.4); c.fill();
  c.beginPath(); c.arc(32, -58, 1.7, 0, TAU); c.fillStyle = OUT; c.fill();
  // collar
  c.beginPath(); c.moveTo(16, -44); c.quadraticCurveTo(24, -42, 26, -34); c.lineWidth = 4; c.strokeStyle = '#8a3b2b'; c.stroke();
  c.lineCap = 'butt';
}
export const OX_COL = ['#9b5a2e', '#c98a52'];
export const MULE_COL = ['#7d6a5a', '#94806c'];
// a team of four (two yoked pairs) facing right, the rear pair's front at x; returns the team's length in units
export function drawTeam(c, x, y, s, kind, ph, amp, grazing) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const isMule = kind === 'mules';
  const cols = isMule ? MULE_COL : OX_COL;
  const f = isMule ? mule : ox;
  const gap = isMule ? 62 : 70;
  c.beginPath(); c.ellipse(gap * 0.5 + 30, 2, gap + 30, 5, 0, 0, TAU); c.fillStyle = 'rgba(40,25,10,0.18)'; c.fill();
  for (let p = 0; p < 2; p++) {
    const ox0 = 30 + p * gap;
    // far animal of the pair (offset up and darker), then near
    for (let side = 0; side < 2; side++) {
      c.save();
      c.translate(ox0 + (side ? 0 : 6), side ? 0 : -5);
      if (grazing && side) c.rotate(0.03);
      const body = side ? cols[p % 2] : shade(cols[(p + 1) % 2], -0.22);
      f(c, ph + p * 1.3 + side * 0.6, amp, body, shade(body, -0.3));
      c.restore();
    }
    // yoke over the necks
    if (!isMule) {
      c.beginPath(); c.moveTo(ox0 + 22, -48); c.quadraticCurveTo(ox0 + 26, -54, ox0 + 30, -48);
      c.lineWidth = 5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.6; c.strokeStyle = '#c8955a'; c.stroke();
    }
  }
  // the chain / traces from the wagon tongue to the lead pair
  c.beginPath(); c.moveTo(-4, -17); c.lineTo(30 + gap - 6, -26); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
  c.restore();
  return 30 + gap * 2;
}

// ---------------------------------------------------------------- companions
const SKIN = ['#f2c9a0', '#d9a679', '#a8754d', '#7a5236', '#e8b98f', '#c48b5c'];
const HAIR = ['#3b2a1e', '#6b4423', '#c98b3a', '#1f1a17', '#8a5a3a', '#a33b20'];
export function personLook(id, color, hat) {
  const h = hashStr(id || 'x');
  const col = color || '#5b8c5a';
  return { color: col, hat: hat || 'none', hatColor: shade(col, -0.1), skin: SKIN[h % SKIN.length], hair: HAIR[(h >>> 5) % HAIR.length], pants: ['#4a3b5c', '#3e4a5e', '#5a4632', '#3d3d3d'][(h >>> 9) % 4] };
}
function hatPath(c, hat, hx, hy, col) {
  switch (hat) {
    case 'cap': { // a flat cap with a short brim
      c.beginPath(); c.moveTo(hx - 10, hy - 3); c.quadraticCurveTo(hx - 9, hy - 14, hx + 2, hy - 13); c.quadraticCurveTo(hx + 10, hy - 12, hx + 10, hy - 4); c.closePath();
      outlineFill(c, col);
      c.beginPath(); c.moveTo(hx + 6, hy - 5); c.lineTo(hx + 16, hy - 3); c.lineTo(hx + 9, hy - 2); c.closePath(); outlineFill(c, shade(col, -0.2), 2);
      return;
    }
    case 'wide': { // a wide-brim scout hat
      c.beginPath(); c.ellipse(hx, hy - 6, 17, 3.6, 0, 0, TAU); outlineFill(c, col);
      c.beginPath(); c.moveTo(hx - 8, hy - 7); c.quadraticCurveTo(hx - 8, hy - 19, hx, hy - 18); c.quadraticCurveTo(hx + 8, hy - 19, hx + 8, hy - 7); c.closePath(); outlineFill(c, col);
      c.beginPath(); c.rect(hx - 8, hy - 10, 16, 3); c.fillStyle = shade(col, -0.35); c.fill();
      return;
    }
    case 'bonnet': { // a sunbonnet: a deep brim around the face and a ruffle at the neck
      c.beginPath(); c.moveTo(hx + 9, hy + 3); c.quadraticCurveTo(hx + 14, hy - 14, hx - 2, hy - 15); c.quadraticCurveTo(hx - 13, hy - 14, hx - 13, hy - 2);
      c.quadraticCurveTo(hx - 13, hy + 9, hx - 6, hy + 10); c.lineTo(hx - 3, hy + 2); c.quadraticCurveTo(hx + 2, hy - 8, hx + 9, hy + 3); c.closePath();
      outlineFill(c, col);
      c.beginPath(); c.moveTo(hx - 4, hy - 12); c.quadraticCurveTo(hx + 8, hy - 10, hx + 9, hy + 2); c.lineWidth = 1.4; c.strokeStyle = shade(col, -0.3); c.stroke();
      return;
    }
    case 'straw': { // a straw hat: wide pale brim, a red band
      c.beginPath(); c.ellipse(hx, hy - 6, 15, 3.4, 0, 0, TAU); outlineFill(c, '#e8c35a');
      c.beginPath(); c.moveTo(hx - 8, hy - 7); c.lineTo(hx - 7, hy - 16); c.lineTo(hx + 7, hy - 16); c.lineTo(hx + 8, hy - 7); c.closePath(); outlineFill(c, '#e8c35a');
      c.beginPath(); c.rect(hx - 7.6, hy - 10, 15.2, 3); c.fillStyle = col; c.fill();
      return;
    }
    case 'bowler': { // a round black bowler with a short brim
      c.beginPath(); c.ellipse(hx, hy - 6, 12, 2.8, 0, 0, TAU); outlineFill(c, '#2e2a2a');
      c.beginPath(); c.arc(hx, hy - 7, 8, Math.PI, 0); c.closePath(); outlineFill(c, '#2e2a2a');
      c.beginPath(); c.rect(hx - 8, hy - 9, 16, 2); c.fillStyle = col; c.fill();
      return;
    }
    case 'hood': { // a hood around the head
      c.beginPath(); c.arc(hx - 1, hy, 13, Math.PI * 0.55, Math.PI * 2.25); c.quadraticCurveTo(hx + 6, hy + 6, hx + 1, hy + 11); c.closePath();
      outlineFill(c, col);
      c.beginPath(); c.arc(hx + 2, hy + 1, 8.5, -1.3, 1.6); c.fillStyle = shade(col, -0.35); c.fill();
      return;
    }
    case 'kerchief': { // a tied head kerchief with the knot at the back
      c.beginPath(); c.moveTo(hx - 10, hy - 1); c.quadraticCurveTo(hx - 9, hy - 13, hx + 1, hy - 12); c.quadraticCurveTo(hx + 10, hy - 11, hx + 10, hy - 3); c.closePath();
      outlineFill(c, col);
      c.beginPath(); c.moveTo(hx - 9, hy - 3); c.lineTo(hx - 16, hy + 1); c.lineTo(hx - 13, hy - 6); c.closePath(); outlineFill(c, col, 1.8);
      c.beginPath(); c.arc(hx - 2, hy - 7, 1.4, 0, TAU); c.arc(hx + 4, hy - 8, 1.4, 0, TAU); c.fillStyle = '#ffffff'; c.fill();
      return;
    }
    default: return;
  }
}
// a companion walking right; ph = walk phase, amp = swing (0 standing), cheer = 0..1 (arms up, a hop)
export function drawPerson(c, x, y, s, look, ph, amp, cheer = 0, dir = 1) {
  c.save(); c.translate(x, y); c.scale(s * dir, s);
  c.beginPath(); c.ellipse(0, 1.5, 12, 3, 0, 0, TAU); c.fillStyle = 'rgba(40,25,10,0.2)'; c.fill();
  const hop = cheer > 0 ? Math.abs(Math.sin(cheer * Math.PI * 3)) * 10 * Math.min(1, cheer * 3) : Math.abs(Math.sin(ph)) * amp * 2.2;
  c.translate(0, -hop);
  const sw = Math.sin(ph) * amp;
  c.lineCap = 'round';
  // legs
  for (const side of [1, -1]) {
    const a = sw * side;
    c.beginPath(); c.moveTo(0, -22); c.lineTo(Math.sin(a) * 20, -22 + Math.cos(a) * 20);
    c.lineWidth = 8; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 4.6; c.strokeStyle = side > 0 ? look.pants : shade(look.pants, -0.2); c.stroke();
  }
  // back arm
  const armUp = cheer > 0 ? Math.min(1, cheer * 4) : 0;
  const armA = (a) => (armUp ? -2.6 + Math.sin(cheer * 20) * 0.15 : a);
  {
    const a = armA(-sw * 0.9);
    c.beginPath(); c.moveTo(-1, -40); c.lineTo(-1 + Math.sin(a) * 16, -40 + Math.cos(a) * 16);
    c.lineWidth = 7; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.8; c.strokeStyle = shade(look.color, -0.25); c.stroke();
  }
  // body
  c.beginPath(); rrect(c, -8, -45, 16, 26, 6); outlineFill(c, look.color);
  c.beginPath(); c.moveTo(-8, -26); c.lineTo(8, -26); c.lineWidth = 2.2; c.strokeStyle = shade(look.color, -0.35); c.stroke();
  // head
  if (look.hat !== 'hood' && look.hat !== 'bonnet') {
    c.beginPath(); c.arc(-3, -55, 9, Math.PI * 0.6, Math.PI * 1.7); c.fillStyle = look.hair; c.fill();
  }
  c.beginPath(); c.arc(0, -54, 8.5, 0, TAU); outlineFill(c, look.skin);
  c.beginPath(); c.arc(4, -55, 1.5, 0, TAU); c.fillStyle = OUT; c.fill();
  hatPath(c, look.hat, 0, -56, look.hatColor || shade(look.color, -0.1));
  // front arm
  {
    const a = armA(sw * 0.9);
    const ax = 1 + Math.sin(a) * 16 + (armUp ? 4 : 0);
    c.beginPath(); c.moveTo(1, -40); c.lineTo(ax, -40 + Math.cos(a) * 16);
    c.lineWidth = 7; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.8; c.strokeStyle = look.color; c.stroke();
  }
  c.lineCap = 'butt';
  c.restore();
}

// ---------------------------------------------------------------- critters the party spots (background)
// kind 'bison' | 'pronghorn' | 'coyote' | 'eagle' ; dir +1 = facing right ; ph = gait phase
export function drawCritter(c, kind, x, y, s, dir, ph) {
  c.save(); c.translate(x, y); c.scale(s * dir, s);
  c.lineCap = 'round';
  const leg = (lx, o, len, col, w = 4) => {
    const a = Math.sin(ph + o) * 0.45;
    c.beginPath(); c.moveTo(lx, -len); c.lineTo(lx + Math.sin(a) * len, -len + Math.cos(a) * len);
    c.lineWidth = w + 3; c.strokeStyle = OUT; c.stroke(); c.lineWidth = w; c.strokeStyle = col; c.stroke();
  };
  if (kind === 'bison') {
    const b = '#5a3a22', d = '#3e2716';
    leg(-16, 0, 14, d, 5); leg(-9, Math.PI, 14, d, 5); leg(12, Math.PI, 14, d, 5); leg(18, 0, 14, d, 5);
    c.beginPath(); c.moveTo(-24, -26); c.quadraticCurveTo(-30, -20, -27, -12); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); rrect(c, -26, -34, 40, 22, 10); outlineFill(c, b);
    c.beginPath(); c.ellipse(12, -34, 16, 16, 0, 0, TAU); outlineFill(c, d); // the hump and shaggy shoulders
    c.beginPath(); rrect(c, 20, -32, 14, 18, 6); outlineFill(c, d);
    c.beginPath(); c.moveTo(24, -32); c.quadraticCurveTo(24, -40, 28, -40); c.lineWidth = 2.6; c.strokeStyle = '#efe4c8'; c.stroke();
    c.beginPath(); c.arc(29, -26, 1.5, 0, TAU); c.fillStyle = '#f4e9d0'; c.fill();
  } else if (kind === 'pronghorn') {
    const b = '#c98a4a';
    const jump = Math.max(0, Math.sin(ph * 0.5)) * 10;
    c.translate(0, -jump);
    leg(-12, 0, 18, b, 3); leg(-7, Math.PI, 18, b, 3); leg(9, Math.PI, 18, b, 3); leg(13, 0, 18, b, 3);
    c.beginPath(); rrect(c, -17, -32, 34, 16, 8); outlineFill(c, b);
    c.beginPath(); c.ellipse(-2, -19, 13, 4, 0, 0, TAU); c.fillStyle = '#f7efe2'; c.fill();
    c.beginPath(); c.moveTo(10, -30); c.lineTo(18, -44); c.lineTo(24, -42); c.lineTo(16, -27); c.closePath(); outlineFill(c, b);
    c.beginPath(); rrect(c, 16, -48, 14, 9, 4); outlineFill(c, b);
    c.beginPath(); c.moveTo(19, -47); c.lineTo(18, -56); c.lineTo(21, -54); c.moveTo(23, -47); c.lineTo(24, -56);
    c.lineWidth = 2.4; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.arc(-17, -26, 3.4, 0, TAU); c.fillStyle = '#ffffff'; c.fill();
  } else if (kind === 'coyote') {
    const b = '#a8957a';
    leg(-11, 0, 13, b, 3); leg(-6, Math.PI, 13, b, 3); leg(8, Math.PI, 13, b, 3); leg(12, 0, 13, b, 3);
    c.beginPath(); c.moveTo(-14, -22); c.quadraticCurveTo(-28, -22, -32, -12); c.quadraticCurveTo(-24, -14, -14, -16); c.closePath(); outlineFill(c, shade(b, -0.1), 2);
    c.beginPath(); rrect(c, -16, -26, 30, 13, 6); outlineFill(c, b);
    c.beginPath(); c.moveTo(10, -24); c.lineTo(16, -34); c.lineTo(30, -30); c.lineTo(18, -23); c.closePath(); outlineFill(c, b);
    c.beginPath(); c.moveTo(14, -32); c.lineTo(15, -40); c.lineTo(19, -33); c.closePath(); outlineFill(c, b, 1.8);
    c.beginPath(); c.arc(20, -31, 1.3, 0, TAU); c.fillStyle = OUT; c.fill();
  } else { // eagle: wings flap
    const f = Math.sin(ph * 2) * 0.8;
    c.beginPath(); c.moveTo(-4, -2); c.quadraticCurveTo(-20, -12 - f * 14, -36, -4 - f * 18); c.quadraticCurveTo(-18, 0, -4, 4); c.closePath(); outlineFill(c, '#4a3020', 2);
    c.beginPath(); c.moveTo(4, -2); c.quadraticCurveTo(14, -12 - f * 14, 30, -4 - f * 18); c.quadraticCurveTo(14, 0, 4, 4); c.closePath(); outlineFill(c, '#4a3020', 2);
    c.beginPath(); c.ellipse(0, 0, 13, 5.5, 0, 0, TAU); outlineFill(c, '#5a3a24', 2);
    c.beginPath(); c.moveTo(-12, -2); c.lineTo(-19, -5); c.lineTo(-19, 5); c.lineTo(-12, 2); c.closePath(); outlineFill(c, '#ffffff', 1.6);
    c.beginPath(); c.arc(14, -1, 5, 0, TAU); outlineFill(c, '#ffffff', 1.8);
    c.beginPath(); c.moveTo(18, -2); c.lineTo(23, 0); c.lineTo(18, 2); c.closePath(); c.fillStyle = '#f0b400'; c.fill();
  }
  c.lineCap = 'butt';
  c.restore();
}

// ---------------------------------------------------------------- the hunt's animals
export const GAME_ANIMALS = {
  rabbit: { meatLb: 10, r: 18, speed: 150, hop: 1 },
  turkey: { meatLb: 15, r: 22, speed: 85, hop: 0 },
  deer: { meatLb: 40, r: 34, speed: 115, hop: 0.6 },
};
function dizzy(c, x, y, t) {
  c.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = t * 5 + (i * TAU) / 3, sx = x + Math.cos(a) * 12, sy = y + Math.sin(a) * 4;
    for (let k = 0; k < 5; k++) { const b = (k * TAU) / 5 - Math.PI / 2; const rr = 3.4; (k ? c.lineTo : c.moveTo).call(c, sx + Math.cos(b) * rr, sy + Math.sin(b) * rr); const b2 = b + TAU / 10; c.lineTo(sx + Math.cos(b2) * 1.4, sy + Math.sin(b2) * 1.4); }
    c.closePath();
  }
  c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 1; c.strokeStyle = OUT; c.stroke();
}
// ground point (x, y) ; flop 0..1 rolls it onto its back (legs up) ; t for the dizzy stars
export function drawGameAnimal(c, kind, x, y, s, dir, ph, flop, t) {
  c.save(); c.translate(x, y); c.scale(s * dir, s);
  c.lineCap = 'round';
  const legSwing = flop > 0 ? 0.25 * Math.sin(t * 18) : 0.5;
  const leg = (lx, ly, o, len, col, w = 4) => {
    const a = Math.sin(ph + o) * legSwing;
    c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + Math.sin(a) * len, ly + Math.cos(a) * len);
    c.lineWidth = w + 3; c.strokeStyle = OUT; c.stroke(); c.lineWidth = w; c.strokeStyle = col; c.stroke();
  };
  let cy = 0;
  if (kind === 'rabbit') cy = -16; else if (kind === 'turkey') cy = -26; else cy = -38;
  // flop: rotate around the body's centre and settle onto the ground (on its back)
  const hopY = flop > 0 ? 0 : (kind === 'rabbit' ? -Math.abs(Math.sin(ph * 0.5)) * 14 : kind === 'deer' ? -Math.abs(Math.sin(ph * 0.5)) * 6 : 0);
  c.translate(0, cy + hopY + flop * (-cy * 0.45));
  c.rotate(flop * Math.PI);
  c.translate(0, -cy);
  if (kind === 'rabbit') {
    const b = '#9c8670';
    leg(-6, -8, 0, 8, b, 4); leg(6, -8, Math.PI, 8, b, 4);
    c.beginPath(); c.ellipse(-2, -14, 13, 9, 0, 0, TAU); outlineFill(c, b);
    c.beginPath(); c.arc(-14, -16, 4.4, 0, TAU); outlineFill(c, '#ffffff', 2);
    c.beginPath(); c.ellipse(10, -32, 3.4, 10, 0.15, 0, TAU); outlineFill(c, b, 2);
    c.beginPath(); c.ellipse(14, -31, 3.4, 10, 0.4, 0, TAU); outlineFill(c, b, 2);
    c.beginPath(); c.arc(11, -20, 7, 0, TAU); outlineFill(c, b);
    c.beginPath(); c.arc(14, -21, 1.4, 0, TAU); c.fillStyle = OUT; c.fill();
  } else if (kind === 'turkey') {
    const b = '#5a3b2a';
    leg(-3, -14, 0, 14, '#d99a2b', 2.4); leg(4, -14, Math.PI, 14, '#d99a2b', 2.4);
    // the fan tail
    c.beginPath();
    for (let i = 0; i < 5; i++) { const a = -Math.PI * 0.95 + i * 0.32; c.moveTo(-8, -26); c.lineTo(-8 + Math.cos(a) * 22, -26 + Math.sin(a) * 22); }
    c.lineWidth = 9; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 6; c.strokeStyle = '#8a5a34'; c.stroke();
    c.beginPath(); c.ellipse(0, -24, 13, 11, 0, 0, TAU); outlineFill(c, b);
    c.beginPath(); c.moveTo(8, -28); c.quadraticCurveTo(12, -40, 15, -42); c.lineWidth = 6; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.4; c.strokeStyle = '#6aa0c8'; c.stroke();
    c.beginPath(); c.arc(15, -43, 4.6, 0, TAU); outlineFill(c, '#6aa0c8', 2);
    c.beginPath(); c.ellipse(16, -37, 2, 4, 0, 0, TAU); c.fillStyle = '#d9534f'; c.fill();
    c.beginPath(); c.moveTo(19, -44); c.lineTo(23, -42); c.lineTo(19, -41); c.closePath(); c.fillStyle = '#f0b400'; c.fill();
    c.beginPath(); c.arc(16, -44, 1.2, 0, TAU); c.fillStyle = OUT; c.fill();
  } else { // deer
    const b = '#b07444';
    leg(-14, -26, 0, 26, b, 3.4); leg(-9, -26, Math.PI, 26, b, 3.4); leg(11, -26, Math.PI, 26, b, 3.4); leg(16, -26, 0, 26, b, 3.4);
    c.beginPath(); rrect(c, -20, -44, 42, 20, 10); outlineFill(c, b);
    c.beginPath(); c.ellipse(-20, -40, 4, 6, 0.4, 0, TAU); outlineFill(c, '#ffffff', 1.8);
    c.beginPath(); c.moveTo(14, -40); c.lineTo(22, -60); c.lineTo(30, -58); c.lineTo(24, -36); c.closePath(); outlineFill(c, b);
    c.beginPath(); rrect(c, 22, -66, 18, 11, 5); outlineFill(c, b);
    c.beginPath(); c.ellipse(22, -68, 3, 6, -0.6, 0, TAU); outlineFill(c, b, 1.8);
    c.beginPath(); c.moveTo(27, -66); c.lineTo(25, -78); c.lineTo(20, -84); c.moveTo(25, -76); c.lineTo(31, -82); c.moveTo(30, -66); c.lineTo(33, -76);
    c.lineWidth = 2.4; c.strokeStyle = '#6b4a2a'; c.stroke();
    c.beginPath(); c.arc(32, -62, 1.5, 0, TAU); c.fillStyle = OUT; c.fill();
    c.beginPath(); c.arc(39, -59, 2, 0, TAU); c.fillStyle = OUT; c.fill();
  }
  c.lineCap = 'butt';
  c.restore();
  if (flop > 0.55) {
    c.save(); c.translate(x, y); c.scale(s, s);
    dizzy(c, 0, kind === 'deer' ? -44 : kind === 'turkey' ? -34 : -28, t);
    c.restore();
  }
}

// a cartoon puff: overlapping white balls; k = 0..1 grows then fades (alpha set by caller)
export function drawPuff(c, x, y, r, k) {
  const g = 0.6 + k * 0.6;
  c.beginPath();
  c.arc(x, y, r * 0.55 * g, 0, TAU);
  c.moveTo(x + r * 0.9 * g, y - r * 0.1); c.arc(x + r * 0.5 * g, y - r * 0.1, r * 0.4 * g, 0, TAU);
  c.moveTo(x - r * 0.1 * g, y - r * 0.35 * g); c.arc(x - r * 0.5 * g, y - r * 0.35 * g, r * 0.42 * g, 0, TAU);
  c.moveTo(x + r * 0.35 * g, y + r * 0.35 * g); c.arc(x + r * 0.05 * g, y + r * 0.35 * g, r * 0.32 * g, 0, TAU);
  c.moveTo(x + r * 0.2 * g, y - r * 0.5 * g); c.arc(x - r * 0.1 * g, y - r * 0.5 * g, r * 0.3 * g, 0, TAU);
  c.fillStyle = '#fffaf0'; c.fill();
  c.lineWidth = 2; c.strokeStyle = 'rgba(43,29,20,0.55)'; c.stroke();
}

// an arrow along angle a with its tip at (x, y); len in css px
export function drawArrow(c, x, y, a, len) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const tx = x - ca * len, ty = y - sa * len;
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(tx, ty); c.lineTo(x, y); c.lineWidth = 4.2; c.strokeStyle = OUT; c.stroke();
  c.lineWidth = 2; c.strokeStyle = '#d9a35a'; c.stroke();
  // head
  c.beginPath(); c.moveTo(x + ca * 6, y + sa * 6); c.lineTo(x - ca * 3 - sa * 4, y - sa * 3 + ca * 4); c.lineTo(x - ca * 3 + sa * 4, y - sa * 3 - ca * 4); c.closePath();
  c.fillStyle = '#8f9aa6'; c.fill(); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
  // fletching
  c.beginPath(); c.moveTo(tx + ca * 8, ty + sa * 8); c.lineTo(tx - sa * 5, ty + ca * 5); c.lineTo(tx, ty); c.lineTo(tx + sa * 5, ty - ca * 5); c.closePath();
  c.fillStyle = '#d9534f'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
  c.lineCap = 'butt';
}
// the bow held at the child's spot (x, y), pointing along angle a; draw = 0..1 string pulled back
export function drawBow(c, x, y, s, a, draw, nocked) {
  c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s);
  const pull = -6 - draw * 16;
  c.beginPath(); c.moveTo(-4, -34); c.lineTo(pull, 0); c.lineTo(-4, 34); c.lineWidth = 1.6; c.strokeStyle = '#f4ecd8'; c.stroke();
  c.beginPath(); c.moveTo(-4, -34); c.quadraticCurveTo(22, -20, 12, 0); c.quadraticCurveTo(22, 20, -4, 34);
  c.lineCap = 'round'; c.lineWidth = 8; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 4.6; c.strokeStyle = '#a0612b'; c.stroke();
  c.beginPath(); c.moveTo(12, -5); c.lineTo(14, 5); c.lineWidth = 6; c.strokeStyle = '#d9534f'; c.stroke();
  c.lineCap = 'butt';
  c.restore();
  if (nocked) {
    const ca = Math.cos(a), sa = Math.sin(a);
    const tipX = x + ca * (26 * s), tipY = y + sa * (26 * s);
    drawArrow(c, tipX, tipY, a, (26 + 6 + draw * 16) * s);
  }
}

// ---------------------------------------------------------------- fish
export function drawFish(c, x, y, s, a, flap, col = '#6a9c5a') {
  c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s);
  const f = Math.sin(flap) * 0.5;
  c.beginPath(); c.moveTo(-14, 0); c.lineTo(-26, -9 + f * 6); c.lineTo(-24, 0); c.lineTo(-26, 9 + f * 6); c.closePath(); outlineFill(c, shade(col, -0.15), 2);
  c.beginPath(); c.ellipse(0, 0, 17, 8, 0, 0, TAU); outlineFill(c, col, 2.2);
  c.beginPath(); c.moveTo(-12, 1); c.quadraticCurveTo(0, 5, 14, 1); c.lineWidth = 3; c.strokeStyle = '#e88a8a'; c.stroke();
  c.beginPath(); c.arc(9, -2, 1.8, 0, TAU); c.fillStyle = OUT; c.fill();
  c.beginPath(); c.moveTo(-3, -7); c.lineTo(2, -12); c.lineTo(5, -7); c.closePath(); outlineFill(c, shade(col, -0.15), 1.4);
  c.restore();
}

// ---------------------------------------------------------------- the campfire (camp backdrop)
export function drawCampfire(c, x, y, s, t, calm) {
  c.save(); c.translate(x, y); c.scale(s, s);
  // glow
  c.beginPath(); c.ellipse(0, -4, 60, 18, 0, 0, TAU); c.fillStyle = 'rgba(255,170,60,0.18)'; c.fill();
  // stones
  c.beginPath();
  for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6) * Math.PI; c.moveTo(Math.cos(a) * 24 + 6, Math.sin(a) * -4 + 1); c.ellipse(Math.cos(a) * 24, Math.sin(a) * -4 + 1, 6, 4, 0, 0, TAU); }
  outlineFill(c, '#8d8478', 1.6);
  // logs
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(-18, -2); c.lineTo(16, -10); c.moveTo(-14, -10); c.lineTo(18, -1);
  c.lineWidth = 9; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 6; c.strokeStyle = '#7a4a26'; c.stroke();
  c.lineCap = 'butt';
  // flames: three tongues that flicker
  const f1 = calm ? 0 : Math.sin(t * 13) * 3, f2 = calm ? 0 : Math.sin(t * 17 + 1) * 4, f3 = calm ? 0 : Math.sin(t * 11 + 2) * 3;
  const flame = (fx, h, w, col, wob) => {
    c.beginPath(); c.moveTo(fx - w, -6); c.quadraticCurveTo(fx - w, -h * 0.5, fx + wob, -h); c.quadraticCurveTo(fx + w, -h * 0.5, fx + w, -6); c.closePath();
    c.fillStyle = col; c.fill();
  };
  flame(-6, 34 + f1, 9, '#ff7a1a', f2 * 0.5);
  flame(6, 30 + f3, 8, '#ff7a1a', -f1 * 0.5);
  flame(0, 44 + f2, 11, '#ff9a2a', f3 * 0.6);
  flame(0, 28 + f1, 6, '#ffd23f', f2 * 0.3);
  c.restore();
}

// ---------------------------------------------------------------- the dog (v1.1): three coats, a two-frame trot
// (legs swap every half stride: frame = floor(ph) & 1), a tail that wags, a sit pose (camp) and a bark pose (head up,
// mouth open, two little sound arcs and a "!" above). Facing right; ground at y; ~36 units nose to tail.
export const DOG_COATS = {
  brown: { body: '#b06a32', ear: '#7a4520', muzzle: '#e3b47c', spots: null },
  spotted: { body: '#f4efe6', ear: '#4a3226', muzzle: '#ffffff', spots: '#4a3226' },
  black: { body: '#3a3333', ear: '#1f1a1a', muzzle: '#8a6a50', spots: null },
};
export const dogCoat = (coat) => (DOG_COATS[coat] ? coat : 'brown');
// ph: trot phase (any real; the frame flips at each integer) ; amp > 0 = trotting ; t: seconds (the tail) ;
// bark: 0 (none) .. 1 (just barked; fades to 0) ; dir: 1 right / -1 left ; sit: the sitting pose
export function drawDog(c, x, y, s, coat, ph, amp, t, bark, dir, sit) {
  const C = DOG_COATS[coat] || DOG_COATS.brown;
  const lean = bark > 0 ? Math.sin(Math.min(1, (1 - bark) * 1.4) * Math.PI) : 0;
  c.save(); c.translate(x, y); c.scale(s * dir, s);
  c.beginPath(); c.ellipse(0, 1.5, 17, 3, 0, 0, TAU); c.fillStyle = 'rgba(40,25,10,0.22)'; c.fill();
  c.lineCap = 'round';
  const wag = Math.sin(t * (bark > 0 || amp > 0 ? 16 : 10)) * 0.6;
  const leg = (x0, y0, x1, y1, col) => {
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
    c.lineWidth = 6.6; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.8; c.strokeStyle = col; c.stroke();
  };
  let hx, hy;
  if (sit && bark <= 0) {
    // tail curled on the ground, wagging
    c.beginPath(); c.moveTo(-12, -4); c.quadraticCurveTo(-20, -3, -22 + Math.sin(wag) * 4, -7 - Math.cos(wag) * 2);
    c.lineWidth = 5.6; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3; c.strokeStyle = C.body; c.stroke();
    leg(9, -15, 9, -0.5, shade(C.body, -0.2));
    // the sitting body: tilted up toward the head, a round haunch
    c.save(); c.translate(-6, -7); c.rotate(-0.6);
    c.beginPath(); rrect(c, -8, -9, 24, 12, 6); outlineFill(c, C.body);
    c.restore();
    c.beginPath(); c.ellipse(-8, -7, 8, 6.5, 0, 0, TAU); outlineFill(c, C.body);
    c.beginPath(); rrect(c, -7, -3, 10, 3.5, 1.7); outlineFill(c, shade(C.body, -0.1), 1.8);
    if (C.spots) { c.beginPath(); c.ellipse(-9, -9, 3.5, 2.6, 0, 0, TAU); c.moveTo(6.4, -15); c.ellipse(4, -15, 2.4, 2, 0, 0, TAU); c.fillStyle = C.spots; c.fill(); }
    leg(12, -15, 12, -0.5, C.body);
    hx = 13; hy = -31;
  } else {
    const frame = amp > 0.05 ? (Math.floor(ph) & 1) : -1;
    const hop = frame === 1 ? 1.4 : 0;
    const sw = frame < 0 ? 0 : frame ? 4.5 : -4.5;
    const by = -hop + lean * 1.5;
    // tail up, wagging
    c.beginPath(); c.moveTo(-15, -18 + by); c.quadraticCurveTo(-21, -20 + by, -21 + Math.sin(wag) * 6, -28 - Math.cos(wag) * 1.5 + by);
    c.lineWidth = 5.6; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3; c.strokeStyle = C.body; c.stroke();
    // far legs (darker), then the body, then the near legs
    const far = shade(C.body, -0.22);
    leg(-11, -12 + by, -11 + sw, -0.5, far);
    leg(10, -12 + by, 10 - sw + lean * 3, -0.5, far);
    c.beginPath(); rrect(c, -17, -23 + by, 32, 13, 6.5); outlineFill(c, C.body);
    c.beginPath(); c.ellipse(-1, -12.5 + by, 10, 2.4, 0, 0, TAU); c.fillStyle = C.muzzle; c.fill();
    if (C.spots) { c.beginPath(); c.ellipse(-8, -17 + by, 4.2, 3, 0, 0, TAU); c.moveTo(6.5, -19 + by); c.ellipse(3, -19 + by, 3.5, 2.5, 0, 0, TAU); c.moveTo(-12.4, -13 + by); c.ellipse(-14, -13 + by, 1.6, 1.6, 0, 0, TAU); c.fillStyle = C.spots; c.fill(); }
    leg(-7, -12 + by, -7 - sw, -0.5, C.body);
    leg(13, -12 + by, 13 + sw + lean * 3, -0.5, C.body);
    hx = 16 + lean * 1.5; hy = -26 + by - lean * 4;
  }
  // head: a round head, a snout, a floppy ear, a red collar
  c.beginPath(); c.moveTo(hx - 6, hy + 4); c.lineTo(hx - 2.5, hy + 8.5); c.lineWidth = 3.4; c.strokeStyle = '#d9534f'; c.stroke();
  c.beginPath(); c.arc(hx, hy, 7.5, 0, TAU); outlineFill(c, C.body);
  c.beginPath(); rrect(c, hx + 3, hy - 1 - lean, 9.5, 6.5, 3); outlineFill(c, C.muzzle, 2);
  if (bark > 0) { // an open mouth with a pink tongue
    c.beginPath(); c.moveTo(hx + 4, hy + 5); c.lineTo(hx + 12, hy + 3.5); c.lineTo(hx + 9.5, hy + 8.5); c.closePath(); outlineFill(c, '#e88aa0', 1.6);
  }
  c.beginPath(); c.arc(hx + 12.2, hy + 0.5 - lean, 1.9, 0, TAU); c.fillStyle = OUT; c.fill();
  c.beginPath(); c.arc(hx + 2.8, hy - 3, 1.4, 0, TAU); c.fillStyle = C === DOG_COATS.black ? '#f4ecd8' : OUT; c.fill();
  c.beginPath(); c.ellipse(hx - 3.5, hy - 0.5 - lean * 2, 3, 6.5, 0.35 - lean * 0.6, 0, TAU); outlineFill(c, C.ear, 1.8);
  if (bark > 0) { // two little sound arcs in front of the mouth
    c.globalAlpha *= Math.min(1, bark * 2.5);
    c.beginPath(); c.arc(hx + 14, hy + 3, 4.5, -0.7, 0.7);
    c.moveTo(hx + 14 + 9 * Math.cos(-0.7), hy + 3 + 9 * Math.sin(-0.7)); c.arc(hx + 14, hy + 3, 9, -0.7, 0.7);
    c.lineWidth = 2; c.strokeStyle = '#fff6e0'; c.stroke();
  }
  c.lineCap = 'butt';
  c.restore();
  if (bark > 0) {
    const a = c.globalAlpha;
    c.globalAlpha = a * Math.min(1, bark * 2.5);
    drawText(c, '!', 22 * s, x + dir * (hx + 2) * s, y + (hy - 20 - (1 - bark) * 6) * s, '#ffd23f');
    c.globalAlpha = a;
  }
}

// ---------------------------------------------------------------- the mail wagon (Fort Derby, v1.1)
// a smaller, lighter wagon than the family's: a red box with a gold stripe, a low white cover with "US MAIL", a driver
// in a blue coat on the box seat, two horses at a gallop. x = the wagon's centre; the lead horse's nose is MAIL_NOSE
// units ahead of it. The family's train (wagon + team) noses out TRAIN_NOSE units ahead of its wagon centre.
export const MAIL_NOSE = 160;
export const TRAIN_NOSE = 236;
const MAIL_DRIVER = personLook('mail-driver', '#2f4f8f', 'cap');
const HORSE_COL = ['#7a4a2a', '#5a3a26'];
function horse(c, ph, amp, body, dark, mane) {
  c.lineCap = 'round';
  const legs = [[-15, 0], [-9, 0.7], [12, Math.PI], [17, Math.PI + 0.7]]; // a gallop: the pairs move together
  for (const [lx, o] of legs) {
    const a = Math.sin(ph + o) * amp;
    const fx = lx + Math.sin(a) * 21, fy = -Math.cos(a) * 21 + 21;
    c.beginPath(); c.moveTo(lx, -24); c.lineTo(fx, fy - 1);
    c.lineWidth = 6.4; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.4; c.strokeStyle = dark; c.stroke();
  }
  // a flowing tail
  c.beginPath(); c.moveTo(-21, -42); c.quadraticCurveTo(-34, -40 - amp * 4, -36, -26 - amp * 4);
  c.lineWidth = 7; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 4.2; c.strokeStyle = mane; c.stroke();
  c.beginPath(); rrect(c, -23, -48, 46, 22, 11); outlineFill(c, body);
  // neck and head stretched forward, a mane, an ear
  c.beginPath(); c.moveTo(12, -45); c.lineTo(28, -64); c.lineTo(37, -58); c.lineTo(22, -38); c.closePath(); outlineFill(c, body);
  c.beginPath(); c.moveTo(14, -47); c.lineTo(28, -66); c.lineWidth = 5; c.strokeStyle = mane; c.stroke();
  c.beginPath(); c.moveTo(29, -64); c.lineTo(31, -72); c.lineTo(34, -64); c.closePath(); outlineFill(c, body, 1.8);
  c.save(); c.translate(30, -62); c.rotate(0.35);
  c.beginPath(); rrect(c, -2, -6, 22, 11, 5); outlineFill(c, body);
  c.beginPath(); c.arc(18, 0.5, 1.4, 0, TAU); c.fillStyle = OUT; c.fill();
  c.restore();
  c.beginPath(); c.arc(33, -61, 1.6, 0, TAU); c.fillStyle = OUT; c.fill();
  // harness
  c.beginPath(); c.moveTo(14, -48); c.quadraticCurveTo(22, -44, 22, -36); c.lineWidth = 3.4; c.strokeStyle = '#3a2a1e'; c.stroke();
  c.lineCap = 'butt';
}
// spin: wheel angle ; ph / amp: the horses' gallop ; bob: the body's lift (units)
export function drawMailTrain(c, x, y, s, spin, ph, amp, bob) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.beginPath(); c.ellipse(56, 2, 110, 6, 0, 0, TAU); c.fillStyle = 'rgba(40,25,10,0.2)'; c.fill();
  // the horses, the far one first (darker), then the near one
  for (let side = 0; side < 2; side++) {
    c.save(); c.translate(side ? 100 : 116, side ? 0 : -8);
    const body = side ? HORSE_COL[0] : shade(HORSE_COL[1], -0.15);
    horse(c, ph + side * 0.5, amp, body, shade(body, -0.3), '#2a1a12');
    c.restore();
  }
  const by = -bob;
  // the traces
  c.beginPath(); c.moveTo(44, by - 24); c.lineTo(86, -26); c.lineWidth = 4; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2; c.strokeStyle = '#8a5a2e'; c.stroke();
  // the driver on the box seat
  drawPerson(c, 36, by - 44, 0.72, MAIL_DRIVER, 0, 0, 0, 1);
  c.beginPath(); rrect(c, 28, by - 52, 18, 7, 2); outlineFill(c, '#5a3a22', 2);
  // the low cover with US MAIL
  c.beginPath(); c.moveTo(-44, by - 42); c.bezierCurveTo(-48, by - 62, -42, by - 74, -28, by - 74); c.lineTo(22, by - 74); c.bezierCurveTo(32, by - 74, 34, by - 60, 30, by - 42); c.closePath();
  outlineFill(c, '#f6f1e2', 2.6);
  c.beginPath(); c.rect(-44, by - 52, 76, 5); c.fillStyle = '#2f4f8f'; c.fill();
  drawText(c, 'US MAIL', 12, -6, by - 62, '#2f4f8f', null, 60);
  // the box: red with a gold stripe
  c.beginPath(); rrect(c, -48, by - 44, 92, 24, 4); outlineFill(c, '#b8392e', 2.6);
  c.beginPath(); c.moveTo(-46, by - 33); c.lineTo(42, by - 33); c.lineWidth = 2.4; c.strokeStyle = '#f0c040'; c.stroke();
  wheel(c, -28, -15, 15, spin, '#3a2a1e');
  wheel(c, 28, -13, 13, spin * 1.15, '#3a2a1e');
  c.restore();
}

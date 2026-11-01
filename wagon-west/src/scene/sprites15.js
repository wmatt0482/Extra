// Wagon West 1.5 sprites (SPEC v1.5 §4.3): the water barrel on the wagon, the wagon decorations (worn on the cover and the box),
// the pack mules of the Gold Road, and the gold itself (a flake, a nugget, the pan). Same house style as sprites.js: flat warm fills,
// one chunky outline, units around a ground point, facing right. Nothing here shows a face with a mood; nothing is worn or broken.
import { TAU, OUT, shade, rrect } from './util.js';

const fillOut = (c, fill, lw = 2) => { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke(); };

// the water barrel lashed to the back of the wagon (drawn in the wagon's units: x -58 is the tailgate, `by` the body's lift)
export function drawBarrel(c, x, by) {
  c.beginPath(); rrect(c, x - 13, by - 52, 26, 34, 8); fillOut(c, '#a8723e', 2.4);
  c.beginPath(); c.moveTo(x - 13, by - 43); c.lineTo(x + 13, by - 43); c.moveTo(x - 13, by - 27); c.lineTo(x + 13, by - 27); c.lineWidth = 3; c.strokeStyle = '#4a4a52'; c.stroke();
  c.beginPath(); c.ellipse(x, by - 52, 11, 3.2, 0, 0, TAU); fillOut(c, '#c28a52', 1.8);
  // a little blue drop so a child reads "water"
  c.beginPath(); c.moveTo(x, by - 40); c.quadraticCurveTo(x + 6, by - 33, x, by - 29); c.quadraticCurveTo(x - 6, by - 33, x, by - 40); c.fillStyle = '#58b4ea'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
  c.beginPath(); c.moveTo(x - 5, by - 17); c.lineTo(x - 9, by - 20); c.moveTo(x + 5, by - 17); c.lineTo(x + 9, by - 20); c.lineWidth = 2; c.strokeStyle = '#7a4a26'; c.stroke(); // lashing to the box
}

// decorations worn on the wagon (the `decor` ids of content/cards.js DECOR); `t` animates the bell, the vane and the pennants
export function drawDecor(c, id, by, t, rm) {
  const sw = rm ? 0 : Math.sin(t * 3);
  switch (id) {
    case 'sunflower-cover': { // a sunflower on the cover
      c.beginPath(); for (let i = 0; i < 10; i++) { const a = (i * TAU) / 10; c.moveTo(14, by - 76); c.ellipse(14 + Math.cos(a) * 8, by - 76 + Math.sin(a) * 8, 5, 2.6, a, 0, TAU); } fillOut(c, '#f3c623', 1.2);
      c.beginPath(); c.arc(14, by - 76, 5, 0, TAU); fillOut(c, '#6a3a1a', 1.2); return;
    }
    case 'pennant-chimney': { // a pennant on a pole at the front of the roof
      c.beginPath(); c.moveTo(30, by - 98); c.lineTo(30, by - 128); c.lineWidth = 2.4; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.moveTo(30, by - 127); c.lineTo(58 + sw * 2, by - 120); c.lineTo(30, by - 112); c.closePath(); fillOut(c, '#e2a85a', 1.6);
      c.beginPath(); c.moveTo(35, by - 122); c.lineTo(35, by - 117); c.lineWidth = 3; c.strokeStyle = '#8a4a2a'; c.stroke(); return;
    }
    case 'flag-divide': {
      c.beginPath(); c.moveTo(44, by - 98); c.lineTo(44, by - 130); c.lineWidth = 2.4; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.rect(44, by - 130, 28 + sw * 1.5, 18); fillOut(c, '#3f6fb5', 1.6);
      c.beginPath(); c.rect(44, by - 130, 14, 9); c.fillStyle = '#ffffff'; c.fill(); return;
    }
    case 'weathervane-salmon': { // a salmon that turns in the wind
      c.beginPath(); c.moveTo(-6, by - 98); c.lineTo(-6, by - 122); c.lineWidth = 2.4; c.strokeStyle = OUT; c.stroke();
      const f = rm ? 1 : Math.cos(t * 0.9);
      c.save(); c.translate(-6, by - 122); c.scale(f < 0 ? -1 : 1, 1); const w = Math.max(0.35, Math.abs(f));
      c.beginPath(); c.moveTo(-14 * w, 0); c.quadraticCurveTo(0, -9, 14 * w, 0); c.quadraticCurveTo(0, 8, -14 * w, 0); c.closePath(); fillOut(c, '#e87a6a', 1.4);
      c.beginPath(); c.moveTo(-14 * w, 0); c.lineTo(-22 * w, -7); c.lineTo(-22 * w, 7); c.closePath(); fillOut(c, '#c85a4a', 1.2); c.restore(); return;
    }
    case 'paddle-canoe': { // a canoe paddle leaning on the tailgate
      c.beginPath(); c.moveTo(-60, by - 20); c.lineTo(-74, by - 78); c.lineWidth = 4.4; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.2; c.strokeStyle = '#c89a62'; c.stroke();
      c.beginPath(); c.ellipse(-76, by - 88, 5, 12, 0.24, 0, TAU); fillOut(c, '#d8a868', 1.6); return;
    }
    case 'compass-trailblazer': {
      c.beginPath(); c.arc(-34, by - 33, 8, 0, TAU); fillOut(c, '#e0b84a', 1.8);
      c.beginPath(); c.arc(-34, by - 33, 5.6, 0, TAU); c.fillStyle = '#fff6dc'; c.fill();
      c.beginPath(); c.moveTo(-34, by - 38); c.lineTo(-32, by - 33); c.lineTo(-36, by - 33); c.closePath(); c.fillStyle = '#d9534f'; c.fill(); return;
    }
    case 'lantern-sierra': { // a lantern swinging from the front hoop
      const x = 56 + sw * 1.2;
      c.beginPath(); c.moveTo(52, by - 70); c.lineTo(x, by - 62); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.arc(x, by - 50, 14, 0, TAU); c.fillStyle = 'rgba(255,220,120,0.35)'; c.fill();
      c.beginPath(); rrect(c, x - 6, by - 62, 12, 16, 3); fillOut(c, '#ffd86a', 1.6);
      c.beginPath(); c.moveTo(x - 7, by - 62); c.lineTo(x, by - 68); c.lineTo(x + 7, by - 62); c.closePath(); fillOut(c, '#3a3a44', 1.4); return;
    }
    case 'map-basin': case 'map-valleys': { // a painted map on the canvas
      c.beginPath(); rrect(c, -22, by - 88, 30, 22, 3); fillOut(c, id === 'map-basin' ? '#ecd8a0' : '#e6e2b0', 1.6);
      c.beginPath(); c.moveTo(-18, by - 72); c.quadraticCurveTo(-10, by - 82, -3, by - 74); c.quadraticCurveTo(2, by - 70, 5, by - 80); c.lineWidth = 1.6; c.strokeStyle = '#4a86b8'; c.stroke();
      c.beginPath(); c.arc(0, by - 72, 1.8, 0, TAU); c.fillStyle = '#d9534f'; c.fill(); return;
    }
    case 'trim-goldleaf': { // gold on the wheel rims and a line along the box
      c.beginPath(); c.arc(-34, -20, 21, 0, TAU); c.arc(34, -16, 17, 0, TAU); c.lineWidth = 2.4; c.strokeStyle = 'rgba(243,198,35,0.95)'; c.stroke();
      c.beginPath(); c.moveTo(-56, by - 24); c.lineTo(54, by - 24); c.lineWidth = 2; c.stroke(); return;
    }
    case 'bell-brass': { // a brass bell swinging at the front
      const a = sw * 0.25;
      c.save(); c.translate(54, by - 70); c.rotate(a);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 6); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.moveTo(-8, 18); c.quadraticCurveTo(-7, 6, 0, 6); c.quadraticCurveTo(7, 6, 8, 18); c.closePath(); fillOut(c, '#e0b84a', 1.6);
      c.beginPath(); c.arc(0, 20, 2.4, 0, TAU); fillOut(c, '#8a6a20', 1); c.restore(); return;
    }
    case 'meadowlark-seat': { // a yellow-breasted bird on the seat
      c.beginPath(); c.ellipse(46, by - 56, 7, 5, 0, 0, TAU); fillOut(c, '#8a6a3a', 1.4);
      c.beginPath(); c.arc(52, by - 61, 3.6, 0, TAU); fillOut(c, '#8a6a3a', 1.2);
      c.beginPath(); c.ellipse(48, by - 54, 4.4, 3.2, 0, 0, TAU); c.fillStyle = '#f3c623'; c.fill();
      c.beginPath(); c.moveTo(55, by - 61); c.lineTo(59, by - 60); c.lineTo(55, by - 59); c.closePath(); c.fillStyle = '#f0a500'; c.fill(); return;
    }
    case 'aspen-leaves': {
      c.beginPath(); for (const [x, y, a] of [[-20, -70, 0.6], [-8, -78, -0.4], [6, -68, 0.9], [18, -80, -0.7], [30, -70, 0.3]]) { c.moveTo(x + 5, by + y); c.ellipse(x, by + y, 5, 3.4, a, 0, TAU); }
      fillOut(c, '#f0c030', 1.2); return;
    }
    case 'beaver-tailgate': { // a small brown beaver sitting on the tailgate
      c.beginPath(); c.ellipse(-56, by - 56, 7, 8, 0, 0, TAU); fillOut(c, '#8a5a30', 1.6);
      c.beginPath(); c.arc(-56, by - 66, 5.4, 0, TAU); fillOut(c, '#8a5a30', 1.6);
      c.beginPath(); c.rect(-58, by - 62, 4, 4); c.fillStyle = '#fff6e6'; c.fill();
      c.beginPath(); c.ellipse(-67, by - 50, 7, 3.6, 0.5, 0, TAU); fillOut(c, '#5a3a22', 1.4); return;
    }
    case 'poppies-cover': {
      c.beginPath(); for (const [x, y] of [[-24, -62], [-12, -74], [4, -66], [16, -78], [28, -64]]) { c.moveTo(x + 4.4, by + y); c.arc(x, by + y, 4.4, 0, TAU); }
      fillOut(c, '#f0a030', 1.2);
      c.beginPath(); for (const [x, y] of [[-24, -62], [-12, -74], [4, -66], [16, -78], [28, -64]]) { c.moveTo(x + 1.4, by + y); c.arc(x, by + y, 1.4, 0, TAU); } c.fillStyle = '#7a3a1a'; c.fill(); return;
    }
    case 'nameplate-brass': {
      c.beginPath(); rrect(c, -22, by - 44, 34, 11, 2.4); fillOut(c, '#e0b84a', 1.6);
      c.beginPath(); c.moveTo(-17, by - 39); c.lineTo(7, by - 39); c.moveTo(-14, by - 36); c.lineTo(4, by - 36); c.lineWidth = 1.2; c.strokeStyle = '#8a6a20'; c.stroke(); return;
    }
    default: return;
  }
}

// ---------------------------------------------------------------- gold
// a flake: a small bright glint that twinkles (a diamond with a highlight); `a` 0..1 is the twinkle
export function drawFlake(c, x, y, r, a) {
  c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.8, y); c.lineTo(x, y + r * 0.8); c.lineTo(x - r * 0.9, y); c.closePath();
  c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = Math.max(1, r * 0.22); c.strokeStyle = '#a8761a'; c.lineJoin = 'round'; c.stroke();
  c.beginPath(); c.moveTo(x - r * 0.3, y - r * 0.2); c.lineTo(x, y - r * 0.6); c.lineWidth = Math.max(1, r * 0.2); c.strokeStyle = '#fff6c0'; c.stroke();
  if (a > 0) { // the sparkle
    const L = r * (1.6 + 1.6 * a); c.beginPath(); c.moveTo(x - L, y); c.lineTo(x + L, y); c.moveTo(x, y - L); c.lineTo(x, y + L);
    c.lineWidth = Math.max(1, r * 0.2); c.strokeStyle = `rgba(255,252,220,${0.9 * a})`; c.stroke();
  }
}
// a nugget: a lumpy gold stone with highlights (r ~ 14 units)
export function drawNugget(c, x, y, r, sparkle = 0) {
  c.beginPath(); c.moveTo(x - r, y + r * 0.2);
  c.quadraticCurveTo(x - r * 1.05, y - r * 0.7, x - r * 0.3, y - r * 0.8); c.quadraticCurveTo(x + r * 0.2, y - r * 1.1, x + r * 0.8, y - r * 0.5);
  c.quadraticCurveTo(x + r * 1.15, y + r * 0.1, x + r * 0.7, y + r * 0.7); c.quadraticCurveTo(x, y + r * 0.9, x - r, y + r * 0.2); c.closePath();
  c.fillStyle = '#f5c52a'; c.fill(); c.lineWidth = Math.max(1.4, r * 0.14); c.strokeStyle = '#8a5a12'; c.lineJoin = 'round'; c.stroke();
  c.beginPath(); c.moveTo(x - r * 0.5, y - r * 0.4); c.quadraticCurveTo(x - r * 0.1, y - r * 0.7, x + r * 0.3, y - r * 0.5); c.lineWidth = Math.max(1.4, r * 0.18); c.strokeStyle = '#fff2a8'; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
  c.beginPath(); c.ellipse(x + r * 0.3, y + r * 0.25, r * 0.3, r * 0.16, 0.3, 0, TAU); c.fillStyle = '#d99a1c'; c.fill();
  if (sparkle > 0) {
    const L = r * (1.2 + 1.6 * sparkle), ox = x + r * 0.55, oy = y - r * 0.6;
    c.beginPath(); c.moveTo(ox - L, oy); c.lineTo(ox + L, oy); c.moveTo(ox, oy - L); c.lineTo(ox, oy + L); c.moveTo(ox - L * 0.6, oy - L * 0.6); c.lineTo(ox + L * 0.6, oy + L * 0.6); c.moveTo(ox + L * 0.6, oy - L * 0.6); c.lineTo(ox - L * 0.6, oy + L * 0.6);
    c.lineWidth = Math.max(1.4, r * 0.14); c.strokeStyle = `rgba(255,252,220,${0.95 * sparkle})`; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
  }
}
export { shade };

// the barrel (a dry stretch, or `wagon.barrel`) and the worn decorations, drawn over drawWagon in the same units (x, y the wagon's ground point, s its scale)
export function drawWagonExtras(c, x, y, s, w, bob, t, rm, barrel) {
  const decor = w.decor || [];
  if (!barrel && !decor.length) return;
  c.save(); c.translate(x, y); c.scale(s, s);
  if (barrel) drawBarrel(c, -73, -bob);
  for (const id of decor) drawDecor(c, id, -bob, t, rm);
  c.restore();
}

// ---------------------------------------------------------------- the new wild cards' animals (spotAnimal), small and friendly, crossing the background
export const WILD = {
  beaver: { n: 1, dir: -1, speed: 38, gait: 6, sky: false },
  'sage-grouse': { n: 3, dir: -1, speed: 46, gait: 8, sky: false },
  meadowlark: { n: 1, dir: 1, speed: 100, gait: 12, sky: true },
  'tule-elk': { n: 3, dir: -1, speed: 58, gait: 6, sky: false },
  osprey: { n: 1, dir: 1, speed: 84, gait: 4, sky: true },
  pika: { n: 1, dir: -1, speed: 52, gait: 10, sky: false },
  'river-otter': { n: 1, dir: -1, speed: 76, gait: 9, sky: false },
  'mountain-quail': { n: 3, dir: -1, speed: 44, gait: 9, sky: false },
};
const WILD_ALIAS = { 'western-meadowlark': 'meadowlark', 'sagegrouse': 'sage-grouse', 'sage grouse': 'sage-grouse', 'tule elk': 'tule-elk', 'river otter': 'river-otter', 'mountain quail': 'mountain-quail' };
export const wildKind = (k) => { const id = String(k || '').toLowerCase(); const a = WILD_ALIAS[id] || id; return WILD[a] ? a : null; };
export function drawWild(c, kind, x, y, s, dir, ph) {
  c.save(); c.translate(x, y); c.scale(s * dir, s); c.lineCap = 'round';
  const leg = (lx, o, len, col, w = 4) => { const a = Math.sin(ph + o) * 0.5; c.beginPath(); c.moveTo(lx, -len); c.lineTo(lx + Math.sin(a) * len * 0.8, -len + Math.cos(a) * len); c.lineWidth = w + 3; c.strokeStyle = OUT; c.stroke(); c.lineWidth = w; c.strokeStyle = col; c.stroke(); };
  const eye = (ex, ey, r = 1.8) => { c.beginPath(); c.arc(ex, ey, r, 0, TAU); c.fillStyle = OUT; c.fill(); };
  if (kind === 'beaver') {
    c.beginPath(); c.ellipse(-24, -7, 14, 5, -0.15, 0, TAU); fillOut(c, '#4a3220', 1.8);                // the flat tail
    leg(-8, 0, 7, '#6a4a2a', 5); leg(10, Math.PI, 7, '#6a4a2a', 5);
    c.beginPath(); c.ellipse(0, -14, 20, 12, 0, 0, TAU); fillOut(c, '#8a5a30', 2.2);
    c.beginPath(); c.ellipse(19, -16, 9, 8, 0, 0, TAU); fillOut(c, '#8a5a30', 2.2); c.beginPath(); c.rect(22, -12, 5, 6); c.fillStyle = '#fff6e6'; c.fill(); eye(21, -19); c.beginPath(); c.arc(14, -23, 3, 0, TAU); fillOut(c, '#6a4a2a', 1.4);
  } else if (kind === 'sage-grouse') {
    c.beginPath(); c.moveTo(-14, -16); for (let i = -3; i <= 3; i++) c.lineTo(-28, -16 + i * 6); c.closePath(); fillOut(c, '#b0a088', 1.6); // the fanned tail
    leg(-2, 0, 9, '#b08a3a', 3); leg(6, Math.PI, 9, '#b08a3a', 3);
    c.beginPath(); c.ellipse(0, -18, 16, 11, -0.1, 0, TAU); fillOut(c, '#a89478', 2); c.beginPath(); c.ellipse(9, -17, 8, 8, 0, 0, TAU); c.fillStyle = '#ffffff'; c.fill();
    c.beginPath(); c.arc(15, -30, 5.5, 0, TAU); fillOut(c, '#a89478', 1.8); c.beginPath(); c.moveTo(19, -31); c.lineTo(24, -29); c.lineTo(19, -28); c.closePath(); c.fillStyle = '#6a5a3a'; c.fill(); eye(16, -32, 1.4);
  } else if (kind === 'meadowlark') {
    const fl = Math.sin(ph) * 0.7;
    c.beginPath(); c.moveTo(-8, -2); c.quadraticCurveTo(-16, -8 - fl * 12, -4, -14 - fl * 10); c.quadraticCurveTo(0, -6, -2, -2); c.closePath(); fillOut(c, '#7a5a3a', 1.6);
    c.beginPath(); c.ellipse(2, -2, 10, 6, 0, 0, TAU); fillOut(c, '#8a6a3a', 1.8); c.beginPath(); c.ellipse(5, 0, 6, 4, 0, 0, TAU); c.fillStyle = '#f3c623'; c.fill();
    c.beginPath(); c.arc(11, -5, 4.2, 0, TAU); fillOut(c, '#8a6a3a', 1.6); c.beginPath(); c.moveTo(15, -5.5); c.lineTo(20, -4.6); c.lineTo(15, -3.6); c.closePath(); c.fillStyle = '#c89a62'; c.fill(); eye(12, -6, 1.2);
    c.beginPath(); c.moveTo(-9, -2); c.lineTo(-18, 1); c.lineWidth = 3.4; c.strokeStyle = '#7a5a3a'; c.stroke();
  } else if (kind === 'tule-elk') {
    leg(-14, 0, 22, '#9a6a3a', 5); leg(-8, Math.PI, 22, '#9a6a3a', 5); leg(12, Math.PI, 22, '#9a6a3a', 5); leg(18, 0, 22, '#9a6a3a', 5);
    c.beginPath(); c.moveTo(-24, -34); c.lineTo(-28, -28); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.ellipse(0, -34, 26, 12, 0, 0, TAU); fillOut(c, '#b88a52', 2.2); c.beginPath(); c.moveTo(18, -40); c.lineTo(28, -58); c.lineTo(36, -54); c.lineTo(26, -34); c.closePath(); fillOut(c, '#b88a52', 2);
    c.beginPath(); c.ellipse(36, -58, 8, 6, 0.3, 0, TAU); fillOut(c, '#b88a52', 2); eye(38, -60, 1.5); c.beginPath(); c.arc(43, -56, 2, 0, TAU); c.fillStyle = OUT; c.fill();
    c.beginPath(); c.moveTo(32, -62); c.lineTo(28, -76); c.lineTo(22, -70); c.moveTo(28, -76); c.lineTo(32, -84); c.moveTo(36, -62); c.lineTo(40, -76); c.lineTo(46, -72); c.moveTo(40, -76); c.lineTo(38, -84); c.lineWidth = 4.4; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.2; c.strokeStyle = '#e8d8b0'; c.stroke();
  } else if (kind === 'osprey') {
    const fl = Math.sin(ph) * 0.9;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-18, -14 - fl * 16, -36, -4 - fl * 14); c.quadraticCurveTo(-18, 2, 0, 3); c.closePath(); fillOut(c, '#6a4a2a', 1.8);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(14, -14 - fl * 16, 30, -6 - fl * 14); c.quadraticCurveTo(14, 2, 0, 3); c.closePath(); fillOut(c, '#7a5a3a', 1.8);
    c.beginPath(); c.ellipse(0, 2, 14, 6, 0, 0, TAU); fillOut(c, '#fbf6ea', 1.8); c.beginPath(); c.arc(15, 0, 5.5, 0, TAU); fillOut(c, '#ffffff', 1.6);
    c.beginPath(); c.rect(11, -3, 8, 3); c.fillStyle = '#4a3222'; c.fill(); c.beginPath(); c.moveTo(19, 0); c.lineTo(24, 2.5); c.lineTo(19, 3.5); c.closePath(); c.fillStyle = '#3a3a3a'; c.fill();
  } else if (kind === 'pika') {
    leg(-3, 0, 4, '#7a6a5a', 4); leg(6, Math.PI, 4, '#7a6a5a', 4);
    c.beginPath(); c.ellipse(0, -9, 11, 9, 0, 0, TAU); fillOut(c, '#9a8a76', 2); c.beginPath(); c.ellipse(9, -13, 6.4, 6, 0, 0, TAU); fillOut(c, '#9a8a76', 2);
    c.beginPath(); c.arc(6, -20, 3.6, 0, TAU); fillOut(c, '#9a8a76', 1.5); c.beginPath(); c.arc(12, -21, 3.6, 0, TAU); fillOut(c, '#9a8a76', 1.5); eye(11, -14, 1.3);
    c.beginPath(); c.arc(15, -12, 1.6, 0, TAU); c.fillStyle = '#4a3a30'; c.fill();
  } else if (kind === 'river-otter') {
    c.beginPath(); c.moveTo(-26, -6); c.quadraticCurveTo(-40, -10, -42, -18); c.lineWidth = 6; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.2; c.strokeStyle = '#6a4a2a'; c.stroke();
    leg(-14, 0, 6, '#6a4a2a', 4); leg(14, Math.PI, 6, '#6a4a2a', 4);
    c.beginPath(); c.moveTo(-28, -8); c.quadraticCurveTo(-8, -20, 14, -12); c.quadraticCurveTo(20, -8, 14, -4); c.quadraticCurveTo(-8, -2, -28, -6); c.closePath(); fillOut(c, '#7a5632', 2);
    c.beginPath(); c.ellipse(18, -13, 8, 6, 0, 0, TAU); fillOut(c, '#8a6642', 2); c.beginPath(); c.ellipse(23, -11, 4, 3, 0, 0, TAU); c.fillStyle = '#e8d8b8'; c.fill(); eye(19, -15, 1.3); c.beginPath(); c.arc(25, -12, 1.4, 0, TAU); c.fillStyle = OUT; c.fill();
  } else if (kind === 'mountain-quail') {
    leg(-1, 0, 8, '#8a7a5a', 3); leg(5, Math.PI, 8, '#8a7a5a', 3);
    c.beginPath(); c.ellipse(0, -15, 12, 9, 0, 0, TAU); fillOut(c, '#7a8a9a', 2); c.beginPath(); c.ellipse(-2, -12, 8, 5, 0, 0, TAU); c.fillStyle = '#9a4a2a'; c.fill();
    c.beginPath(); c.arc(9, -24, 5, 0, TAU); fillOut(c, '#7a8a9a', 1.8); c.beginPath(); c.moveTo(7, -28); c.lineTo(1, -40); c.lineWidth = 3.6; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 1.8; c.strokeStyle = '#2a2a30'; c.stroke(); eye(11, -25, 1.3);
    c.beginPath(); c.moveTo(13, -24); c.lineTo(17, -23); c.lineTo(13, -22); c.closePath(); c.fillStyle = '#3a3a3a'; c.fill();
  }
  c.lineCap = 'butt'; c.restore();
}

// Wagon West v1.7 sprites: what lives under a rock by the water (a fat worm, a beetle, a cricket, a crawdad), a stone arrowhead and a patch of
// mud. Same house style as sprites14.js: flat warm fills, one chunky outline, units around a point scaled by `s`. Nothing here is scary or
// sharp-looking: the crawdad waves two cartoon claws; the arrowhead is a plain grey stone shape with a few flake lines.
import { TAU, OUT, shade } from './util.js';

function fillOut(c, fill, lw = 2) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = OUT; c.stroke(); }
function dot(c, x, y, r, col) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = col; c.fill(); }

export const CRITTERS = ['worm', 'beetle', 'cricket', 'crawdad', 'arrowhead', 'mud'];

/** (x, y) is the middle of the critter's feet; `t` wriggles it; flip -1 faces left. */
export function drawCritter(c, kind, x, y, s = 1, t = 0, flip = 1) {
  c.save(); c.translate(x, y); c.scale(s * flip, s);
  c.lineJoin = 'round'; c.lineCap = 'round';
  if (kind === 'worm') worm(c, t);
  else if (kind === 'beetle') beetle(c, t);
  else if (kind === 'cricket') cricket(c, t);
  else if (kind === 'crawdad') crawdad(c, t);
  else if (kind === 'arrowhead') arrowhead(c);
  else mud(c, t);
  c.lineCap = 'butt'; c.lineJoin = 'miter';
  c.restore();
}
// a fat pink-brown worm in a wavy curve, with a paler band near its head
function worm(c, t) {
  const pts = [];
  for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push([-20 + u * 40, -5 + Math.sin(u * 7 + t * 5) * 4.5 * (0.4 + u * 0.6)]); }
  c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.lineWidth = 10.4; c.strokeStyle = OUT; c.stroke();
  c.lineWidth = 7; c.strokeStyle = '#d9808f'; c.stroke();
  c.beginPath(); pts.slice(6, 9).forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.lineWidth = 7.4; c.strokeStyle = '#f0b6bd'; c.stroke();
  dot(c, pts[10][0] + 1.5, pts[10][1] - 1, 1.1, OUT);
}
// a shiny dark-green beetle seen from above, six little legs, two feelers
function beetle(c, t) {
  const w = Math.sin(t * 14) * 1.6;
  c.lineWidth = 2.2; c.strokeStyle = OUT;
  for (const [lx, ly] of [[-7, -4], [0, -6], [7, -4]]) { c.beginPath(); c.moveTo(lx, -2); c.lineTo(lx - 5, ly - 5 + w); c.moveTo(lx, -2); c.lineTo(lx + 5, ly - 5 - w); c.stroke(); }
  c.beginPath(); c.ellipse(0, -5, 13, 9.6, 0, 0, TAU); fillOut(c, '#2f6a4e', 2.4);
  c.beginPath(); c.moveTo(0, -14); c.lineTo(0, 4); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
  c.beginPath(); c.ellipse(-5.4, -7.5, 3.4, 2.2, -0.6, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill();     // the shine
  c.beginPath(); c.ellipse(12.5, -5, 4.8, 4.4, 0, 0, TAU); fillOut(c, '#1f4a36', 2);
  c.beginPath(); c.moveTo(15, -8); c.quadraticCurveTo(19, -14, 23, -13); c.moveTo(15, -3); c.quadraticCurveTo(20, 0, 24, -3); c.lineWidth = 1.5; c.strokeStyle = OUT; c.stroke();
  dot(c, 14, -6, 1, '#fff');
}
// a cricket: brown, a long bent back leg, long feelers, a little eye
function cricket(c, t) {
  const k = Math.sin(t * 10) * 0.5;
  c.beginPath(); c.moveTo(-3, -8); c.lineTo(-14, -20 + k * 3); c.lineTo(-24, -2); c.lineWidth = 7; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.8; c.strokeStyle = '#6b4a2a'; c.stroke();
  c.beginPath(); c.moveTo(3, -6); c.lineTo(-3, -1); c.lineTo(-5, 1); c.lineWidth = 5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.6; c.strokeStyle = '#6b4a2a'; c.stroke();
  c.beginPath(); c.ellipse(0, -8, 14, 6.4, -0.05, 0, TAU); fillOut(c, '#8a6038', 2.2);
  c.beginPath(); c.moveTo(-10, -9); c.quadraticCurveTo(-2, -15, 10, -10); c.lineWidth = 3.4; c.strokeStyle = shade('#8a6038', -0.3); c.stroke();
  c.beginPath(); c.ellipse(14, -9, 6.2, 5.6, 0, 0, TAU); fillOut(c, '#8a6038', 2.2);
  dot(c, 16.4, -11, 1.8, '#fff'); dot(c, 16.9, -11, 0.9, OUT);
  c.beginPath(); c.moveTo(18, -13); c.quadraticCurveTo(26, -26, 36, -25); c.moveTo(16, -14); c.quadraticCurveTo(20, -28, 28, -32); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
}
// a crawdad (crayfish): red-brown, two big cartoon claws held up, a fan tail, a few little walking legs
function crawdad(c, t) {
  const w = Math.sin(t * 6) * 0.15;
  c.lineWidth = 2; c.strokeStyle = OUT;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-4 + i * 6, -2); c.lineTo(-7 + i * 6 + (i % 2 ? 2 : -2), 5); c.stroke(); }
  c.beginPath(); c.moveTo(-14, -8); c.lineTo(-26, -2); c.lineTo(-24, -12); c.lineTo(-30, -8); c.lineTo(-16, -13); c.closePath(); fillOut(c, '#b0442e', 2);          // the tail fan
  c.beginPath(); c.ellipse(-2, -9, 15, 8, 0, 0, TAU); fillOut(c, '#c4573a', 2.4);
  for (const bx of [-8, -1, 6]) { c.beginPath(); c.moveTo(bx, -16); c.quadraticCurveTo(bx - 1, -9, bx, -2); c.lineWidth = 1.3; c.strokeStyle = shade('#c4573a', -0.4); c.stroke(); }
  for (const sg of [-1, 1]) {                                                                                                                                  // the claws
    c.save(); c.translate(11, -9 + sg * 3); c.rotate(-0.5 * sg + w * sg);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(11, sg * 1); c.lineWidth = 6.4; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.4; c.strokeStyle = '#c4573a'; c.stroke();
    c.beginPath(); c.ellipse(15, sg * 1, 7, 5.2, 0, 0, TAU); fillOut(c, '#d4664a', 2);
    c.beginPath(); c.moveTo(20, sg * 1 - 1); c.lineTo(24, sg * 1 - 4); c.lineTo(23, sg * 1 + 1); c.closePath(); fillOut(c, '#d4664a', 1.4);
    c.restore();
  }
  c.beginPath(); c.ellipse(11, -10, 5, 4.6, 0, 0, TAU); fillOut(c, '#c4573a', 2);
  dot(c, 13, -15, 1.9, '#fff'); dot(c, 13.4, -15, 1, OUT); dot(c, 9, -15, 1.9, '#fff'); dot(c, 9.4, -15, 1, OUT);
}
// a stone arrowhead: a grey-brown leaf of stone with a point, two little notches and a few flake lines (a plain shape, never a weapon in use)
function arrowhead(c) {
  c.beginPath(); c.moveTo(0, -30); c.bezierCurveTo(9, -20, 15, -8, 12, 2); c.lineTo(5, -1); c.lineTo(4, 7); c.lineTo(-4, 7); c.lineTo(-5, -1); c.lineTo(-12, 2);
  c.bezierCurveTo(-15, -8, -9, -20, 0, -30); c.closePath(); fillOut(c, '#a8998a', 2.6);
  c.beginPath(); c.moveTo(0, -27); c.lineTo(0, 3); c.lineWidth = 1.4; c.strokeStyle = shade('#a8998a', -0.35); c.stroke();
  c.beginPath(); for (const [x1, y1, x2, y2] of [[-8, -9, -2, -13], [8, -9, 2, -13], [-9, -2, -3, -5], [9, -2, 3, -5], [-5, -19, -1, -21], [5, -19, 1, -21]]) { c.moveTo(x1, y1); c.lineTo(x2, y2); }
  c.lineWidth = 1.2; c.strokeStyle = shade('#a8998a', -0.4); c.stroke();
}
// "just mud": a brown puddle with two bubbles
function mud(c, t) {
  c.beginPath(); c.ellipse(0, -4, 24, 8, 0, 0, TAU); fillOut(c, '#7a5a3a', 2.2);
  c.beginPath(); c.ellipse(-3, -5.5, 14, 4.2, 0, 0, TAU); c.fillStyle = '#8f6c46'; c.fill();
  const b = (Math.sin(t * 3) + 1) / 2;
  c.beginPath(); c.arc(8, -6 - b * 3, 2.4, 0, TAU); c.lineWidth = 1.4; c.strokeStyle = '#d8c2a0'; c.stroke();
  c.beginPath(); c.arc(-9, -4 - (1 - b) * 3, 1.8, 0, TAU); c.stroke();
}

// Wagon West v1.4 sprites (Frodo and the river): the six fish of the trail (each its own shape and colouring, so a
// child can tell a catfish from a trout from a salmon from a sturgeon at a glance), the river's junk (boot, snapping
// turtle, bottle with a note), the rattlesnake that slides away, birds, a wolf, a grizzly, a grasshopper, the fetch
// stick, a skipping stone, a falling star and an emoji bubble. Same house style as sprites.js: flat warm fills, one
// chunky outline, units around a point scaled by `s`. Kid rules: nothing here shows an injury, a weapon or a fang.

import { TAU, OUT, shade, mkCanvas } from './util.js';

function fillOut(c, fill, lw = 2) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = OUT; c.stroke(); }
function grad(c, y0, y1, a, b, d) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(0.5, b); g.addColorStop(1, d); return g; }
function dot(c, x, y, r, col) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = col; c.fill(); }

// ---------------------------------------------------------------- the fish
// len: nose to tail tip in sprite units; lo / hi: the inches the log shows; name: the word on the canvas
export const SPECIES = {
  'channel-catfish': { name: 'CHANNEL CATFISH', len: 70, lo: 12, hi: 24 },
  'hornyhead-chub': { name: 'HORNYHEAD CHUB', len: 50, lo: 4, hi: 8 },
  'cutthroat-trout': { name: 'CUTTHROAT TROUT', len: 66, lo: 8, hi: 16 },
  'white-sturgeon': { name: 'WHITE STURGEON', len: 122, lo: 48, hi: 84 },
  'redband-trout': { name: 'REDBAND TROUT', len: 66, lo: 8, hi: 16 },
  'chinook-salmon': { name: 'CHINOOK SALMON', len: 86, lo: 24, hi: 40 },
};
export const speciesOf = (id) => SPECIES[id] || SPECIES['channel-catfish'];

// a fish facing right, centred on its body; ang tilts it; wag (radians) swings the tail; flip -1 faces left
export function drawSpecies(c, id, x, y, s, ang = 0, wag = 0, flip = 1) {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(s * flip, s);
  c.lineJoin = 'round'; c.lineCap = 'round';
  const w = Math.sin(wag);
  if (id === 'hornyhead-chub') chub(c, w);
  else if (id === 'cutthroat-trout') trout(c, w, false);
  else if (id === 'redband-trout') trout(c, w, true);
  else if (id === 'chinook-salmon') salmon(c, w);
  else if (id === 'white-sturgeon') sturgeon(c, w);
  else catfish(c, w);
  c.lineCap = 'butt'; c.lineJoin = 'miter';
  c.restore();
}
function eye(c, x, y, r) {
  dot(c, x, y, r * 1.5, '#fffdf0'); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke(); dot(c, x + r * 0.2, y, r * 0.85, OUT);
}
// the channel catfish: a grey-blue back, pale belly, a broad flat head, FOUR long whiskers, a forked tail, dark freckles
function catfish(c, w) {
  const back = '#6f8a8c', side = '#98aaa0', belly = '#e6e2cf';
  c.beginPath(); c.moveTo(-26, 0); c.lineTo(-40, -12 + w * 4); c.lineTo(-34, 0); c.lineTo(-40, 12 + w * 4); c.closePath(); fillOut(c, shade(back, -0.1), 2);
  c.beginPath(); c.moveTo(4, -9); c.lineTo(-2, -21); c.lineTo(-10, -8); c.closePath(); fillOut(c, shade(back, -0.12), 2);    // the dorsal fin
  c.beginPath(); c.moveTo(-17, -6); c.quadraticCurveTo(-21, -13, -26, -6); c.closePath(); fillOut(c, shade(back, -0.12), 1.6);  // adipose
  c.beginPath(); c.moveTo(-14, 7); c.lineTo(-22, 14); c.lineTo(-24, 6); c.closePath(); fillOut(c, shade(side, -0.1), 1.6);
  c.beginPath(); c.moveTo(34, 3); c.bezierCurveTo(34, -4, 27, -9, 15, -10); c.bezierCurveTo(1, -12, -14, -8, -27, -3); c.lineTo(-27, 3);
  c.bezierCurveTo(-14, 8, 2, 10, 16, 9.5); c.bezierCurveTo(28, 9, 34, 7, 34, 3); c.closePath(); fillOut(c, grad(c, -12, 10, back, side, belly), 2.4);
  for (const [px, py] of [[-4, -3], [4, -6], [-12, 0], [10, 0], [-19, -2], [-8, 4], [0, 2], [18, -3]]) dot(c, px, py, 1.5, '#3b4d4f');
  c.beginPath(); c.moveTo(18, -9); c.quadraticCurveTo(14, 0, 18, 9); c.lineWidth = 1.8; c.strokeStyle = shade(back, -0.4); c.stroke();    // the gill
  c.beginPath(); c.moveTo(34, 2); c.quadraticCurveTo(38, 4, 36, 6); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
  c.beginPath(); c.moveTo(14, 7); c.lineTo(8, 15); c.lineTo(4, 7); c.closePath(); fillOut(c, shade(side, -0.1), 1.6);
  eye(c, 25, -3.5, 1.9);
  // the whiskers: two long up front, two under the chin
  c.lineWidth = 2.2; c.strokeStyle = OUT;
  for (const [x1, y1, x2, y2, x3, y3] of [[34, 1, 41, -6, 50, -4], [34, 3, 44, 2, 54, 6], [31, 8, 38, 14, 46, 13], [28, 9, 30, 17, 37, 20]]) { c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(x2, y2, x3, y3); c.stroke(); }
  c.lineWidth = 1; c.strokeStyle = '#cfd8cf';
  for (const [x1, y1, x2, y2, x3, y3] of [[34, 1, 41, -6, 50, -4], [34, 3, 44, 2, 54, 6]]) { c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(x2, y2, x3, y3); c.stroke(); }
}
// the hornyhead chub: small and stout, bronze-olive, a dark stripe, a dark spot at the tail, red-orange fin tips
function chub(c, w) {
  const back = '#9a8650', side = '#cbbd8a', belly = '#f0ead0';
  c.beginPath(); c.moveTo(-19, 0); c.lineTo(-31, -8 + w * 3); c.lineTo(-27, 0); c.lineTo(-31, 8 + w * 3); c.closePath(); fillOut(c, '#d9784a', 1.8);
  c.beginPath(); c.moveTo(4, -9); c.lineTo(-3, -16); c.lineTo(-9, -8.5); c.closePath(); fillOut(c, '#d9784a', 1.6);
  c.beginPath(); c.moveTo(22, 1); c.bezierCurveTo(22, -5, 14, -10, 2, -10); c.bezierCurveTo(-8, -10, -16, -5, -21, -1); c.lineTo(-21, 2);
  c.bezierCurveTo(-15, 7, -6, 10, 4, 10); c.bezierCurveTo(15, 9.5, 22, 6, 22, 1); c.closePath(); fillOut(c, grad(c, -10, 10, back, side, belly), 2.4);
  c.beginPath(); c.moveTo(18, 0); c.bezierCurveTo(8, -1, -8, 0, -20, 0); c.lineWidth = 2.2; c.strokeStyle = '#5c4a2a'; c.stroke();
  dot(c, -17, 0, 2.6, '#3a2c18');
  c.beginPath(); c.moveTo(9, 6); c.lineTo(3, 13); c.lineTo(0, 6); c.closePath(); fillOut(c, '#d9784a', 1.4);
  c.beginPath(); c.moveTo(11, -8); c.quadraticCurveTo(7, 0, 11, 9); c.lineWidth = 1.6; c.strokeStyle = shade(back, -0.4); c.stroke();
  for (const [px, py] of [[17, -5.5], [20, -3], [14, -7.5]]) dot(c, px, py, 1.1, '#fff8e0');   // the little "horns" (breeding bumps) on the snout
  c.beginPath(); c.moveTo(22, 2); c.quadraticCurveTo(24, 3, 22, 4.5); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
  eye(c, 15, -2.4, 1.7);
}
// trout: a speckled torpedo. The cutthroat has the red-orange slash under the jaw; the redband a rosy stripe down each side
function trout(c, w, band) {
  const back = band ? '#7a9a62' : '#b3a64a', side = band ? '#d6dcb8' : '#d9cf86', belly = band ? '#f4f1dc' : '#f4e6b0';
  c.beginPath(); c.moveTo(-27, 0); c.lineTo(-40, -10 + w * 3); c.lineTo(-35, 0); c.lineTo(-40, 10 + w * 3); c.closePath(); fillOut(c, shade(back, -0.08), 2);
  c.beginPath(); c.moveTo(6, -8.5); c.lineTo(-1, -17); c.lineTo(-9, -8); c.closePath(); fillOut(c, shade(back, -0.1), 1.8);
  c.beginPath(); c.moveTo(-18, -6.5); c.quadraticCurveTo(-21, -12, -25, -5.5); c.closePath(); fillOut(c, shade(back, -0.1), 1.4);
  c.beginPath(); c.moveTo(31, 2); c.bezierCurveTo(31, -4, 23, -8.5, 10, -9); c.bezierCurveTo(-4, -9.5, -17, -6, -27, -2); c.lineTo(-27, 2);
  c.bezierCurveTo(-17, 6, -4, 9, 10, 8.5); c.bezierCurveTo(23, 8, 31, 6, 31, 2); c.closePath(); fillOut(c, grad(c, -9, 9, back, side, belly), 2.4);
  if (band) { c.beginPath(); c.moveTo(22, -0.5); c.bezierCurveTo(8, -1.5, -10, -0.5, -26, 0.5); c.lineWidth = 3.6; c.strokeStyle = '#e8636f'; c.stroke(); }
  const r = { s: 1 }; r.v = 7;
  for (let i = 0; i < 26; i++) { const px = 20 - i * 1.75 + ((i * 7) % 3), py = -6 + ((i * 11) % 9) * 1.3 - (band ? 0 : 0); dot(c, px, py > 5 ? 4 : py, 0.9 + (i % 3) * 0.25, '#2a2a26'); }
  c.beginPath(); c.moveTo(18, -8); c.quadraticCurveTo(14, 0, 18, 8); c.lineWidth = 1.6; c.strokeStyle = shade(back, -0.4); c.stroke();
  c.beginPath(); c.moveTo(31, 2.5); c.quadraticCurveTo(33, 3.5, 31, 5); c.lineWidth = 1.5; c.strokeStyle = OUT; c.stroke();
  if (!band) { c.beginPath(); c.moveTo(27, 6.2); c.quadraticCurveTo(21, 8.4, 15, 7.4); c.lineWidth = 2.8; c.strokeStyle = '#e0432a'; c.stroke(); }  // the cutthroat's slash
  c.beginPath(); c.moveTo(8, 7); c.lineTo(2, 13); c.lineTo(0, 6.5); c.closePath(); fillOut(c, band ? '#ecb0a0' : '#e8a070', 1.4);
  eye(c, 23, -2.6, 1.8);
}
// the Chinook salmon: big and deep-bodied, a blue-green back, silver sides, black freckles on the back and BOTH tail lobes
function salmon(c, w) {
  const back = '#2f6478', side = '#b4ccd2', belly = '#f1f3ee';
  c.beginPath(); c.moveTo(-36, 0); c.lineTo(-52, -13 + w * 4); c.lineTo(-45, 0); c.lineTo(-52, 13 + w * 4); c.closePath(); fillOut(c, '#3b6a7a', 2);
  for (const [px, py] of [[-46, -8], [-42, -4], [-48, 6], [-43, 4]]) dot(c, px, py + w * 2, 1.1, '#15262c');
  c.beginPath(); c.moveTo(6, -11); c.lineTo(-2, -22); c.lineTo(-12, -10.5); c.closePath(); fillOut(c, '#3b6a7a', 2);
  c.beginPath(); c.moveTo(-22, -9); c.quadraticCurveTo(-26, -15, -31, -7); c.closePath(); fillOut(c, '#3b6a7a', 1.6);
  c.beginPath(); c.moveTo(14, 10); c.lineTo(6, 18); c.lineTo(3, 9.5); c.closePath(); fillOut(c, '#7fa2ad', 1.6);
  c.beginPath(); c.moveTo(41, 1.5); c.bezierCurveTo(41, -5, 31, -10.5, 14, -12); c.bezierCurveTo(-6, -14, -25, -9, -37, -2.5); c.lineTo(-37, 2.5);
  c.bezierCurveTo(-25, 9, -6, 12, 14, 11.5); c.bezierCurveTo(31, 11, 41, 7, 41, 1.5); c.closePath(); fillOut(c, grad(c, -13, 12, back, side, belly), 2.6);
  for (let i = 0; i < 22; i++) dot(c, 24 - i * 2.8 + ((i * 5) % 3), -9 + ((i * 7) % 5) * 1.1, 1 + (i % 3) * 0.2, '#15262c');
  c.beginPath(); c.moveTo(20, -11); c.quadraticCurveTo(15, 0, 20, 11); c.lineWidth = 1.8; c.strokeStyle = shade(back, -0.4); c.stroke();
  c.beginPath(); c.moveTo(41, 1.5); c.quadraticCurveTo(45, 3, 41, 6); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();     // a hooked jaw
  c.beginPath(); c.moveTo(40, 4); c.lineTo(27, 5.5); c.lineWidth = 1.4; c.strokeStyle = '#1a1a18'; c.stroke();
  eye(c, 30, -3.6, 2);
}
// the white sturgeon: long and grey, a pointed snout with whiskers underneath, rows of bony plates, a shark-like tail
function sturgeon(c, w) {
  const back = '#6f6c60', side = '#9a9484', belly = '#ded8c4';
  c.beginPath(); c.moveTo(-50, -1); c.lineTo(-72, -20 + w * 5); c.lineTo(-62, -2); c.lineTo(-66, 9 + w * 3); c.lineTo(-52, 3); c.closePath(); fillOut(c, shade(back, -0.08), 2.2);
  c.beginPath(); c.moveTo(-24, -10); c.lineTo(-34, -20); c.lineTo(-42, -8); c.closePath(); fillOut(c, shade(back, -0.1), 2);
  c.beginPath(); c.moveTo(18, 7); c.lineTo(8, 16); c.lineTo(3, 6); c.closePath(); fillOut(c, shade(side, -0.1), 1.8);
  c.beginPath(); c.moveTo(66, 4); c.bezierCurveTo(56, 2, 46, -4, 34, -7); c.bezierCurveTo(12, -12, -22, -12, -52, -3); c.lineTo(-52, 3);
  c.bezierCurveTo(-22, 8, 10, 10, 32, 8); c.bezierCurveTo(46, 7, 58, 6, 66, 4); c.closePath(); fillOut(c, grad(c, -12, 10, back, side, belly), 2.6);
  // the rows of plates (scutes): a back row and a side row
  for (let i = 0; i < 9; i++) {
    const x = 30 - i * 9.5;
    c.beginPath(); c.moveTo(x + 4, -8.5 + i * 0.1); c.lineTo(x, -12.5); c.lineTo(x - 4, -8.5); c.lineTo(x, -5); c.closePath(); fillOut(c, '#b4ad98', 1.4);
    c.beginPath(); c.moveTo(x + 5, 0.5); c.lineTo(x + 1, -3); c.lineTo(x - 4, 0.5); c.lineTo(x + 1, 4); c.closePath(); fillOut(c, '#b4ad98', 1.4);
  }
  c.beginPath(); c.moveTo(44, 6.4); c.quadraticCurveTo(50, 8, 56, 7); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();   // the mouth, underneath
  c.lineWidth = 2; for (const [x1, y1, x2, y2] of [[48, 7, 49, 14], [52, 7.4, 54, 14.5], [44, 7.6, 43, 14]]) { c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(x1 + 1, (y1 + y2) / 2, x2, y2); c.stroke(); }
  eye(c, 40, -2.2, 1.5);
}

// ---------------------------------------------------------------- the river's junk (a hook's other catches)
// the old boot (hangs from the line; swing = a few radians), a wet grey sock peeking out of the top
export function drawBoot(c, x, y, s, ang = 0) {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
  c.lineJoin = 'round';
  c.beginPath(); c.moveTo(-9, -26); c.lineTo(9, -26); c.lineTo(9, 3); c.bezierCurveTo(14, 6, 26, 6, 28, 14); c.lineTo(28, 20); c.lineTo(-13, 20); c.bezierCurveTo(-15, 12, -9, 10, -9, 4); c.closePath();
  fillOut(c, '#8a5a30', 2.6);
  c.beginPath(); c.rect(-13, 16, 41, 4.5); c.fillStyle = '#4a3020'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
  c.beginPath(); c.moveTo(-9, -26); c.lineTo(9, -26); c.lineTo(10, -16); c.lineTo(-10, -17); c.closePath(); fillOut(c, '#c8c4bb', 2);     // the sock
  c.beginPath(); c.moveTo(-9, -21); c.lineTo(9, -21.5); c.lineWidth = 1.6; c.strokeStyle = '#8a8680'; c.stroke();
  c.beginPath(); for (let i = 0; i < 3; i++) { c.moveTo(-5, -9 + i * 7); c.lineTo(5, -9 + i * 7); } c.lineWidth = 1.6; c.strokeStyle = '#e8d8b0'; c.stroke();
  c.beginPath(); c.ellipse(15, 8, 4, 2.6, 0.3, 0, TAU); c.fillStyle = '#6a4222'; c.fill();
  c.beginPath(); c.ellipse(-2, 17, 2, 3.2, 0, 0, TAU); c.fillStyle = '#9ad4f0'; c.fill();     // a drip
  c.lineJoin = 'miter';
  c.restore();
}
// the snapping turtle (cartoon: round eyes, a beaky smile): open 0..1 opens the mouth (it snaps at the air)
export function drawTurtle(c, x, y, s, open = 0, ph = 0) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.lineJoin = 'round'; c.lineCap = 'round';
  const bob = Math.sin(ph) * 1.2;
  c.beginPath(); c.moveTo(-26, -3); c.lineTo(-34, -7); c.lineTo(-30, -2); c.lineTo(-36, 1); c.lineTo(-27, 3); c.closePath(); fillOut(c, '#6a7a3e', 1.8);   // the spiky tail
  for (const lx of [-14, 12]) { c.beginPath(); c.ellipse(lx, 7 + bob * 0.3, 6, 4, 0, 0, TAU); fillOut(c, '#7d8f4a', 1.8); }
  c.beginPath(); c.moveTo(14, -2); c.bezierCurveTo(24, -10, 28, -12, 32, -10 + bob); c.lineWidth = 11; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 8; c.strokeStyle = '#8a9c52'; c.stroke();   // the neck
  c.beginPath(); c.ellipse(34, -10 + bob, 9, 7, 0, 0, TAU); fillOut(c, '#8a9c52', 2);
  c.beginPath(); c.moveTo(40, -9 + bob + open * 1); c.lineTo(48, -7 + bob + open * 3); c.lineTo(40, -6 + bob + open * 6); c.closePath(); fillOut(c, open > 0.2 ? '#e88aa0' : '#6a7a3e', 1.6);
  if (open > 0.2) { c.beginPath(); c.moveTo(39, -9 + bob); c.lineTo(48, -9 + bob - open * 3); c.lineTo(40, -12 + bob); c.closePath(); fillOut(c, '#8a9c52', 1.6); }
  eye(c, 36, -13 + bob, 1.8);
  c.beginPath(); c.ellipse(0, -6, 25, 15, 0, Math.PI, 0); c.closePath(); fillOut(c, '#5a6a34', 2.6);
  c.beginPath(); c.moveTo(-18, -9); c.quadraticCurveTo(-4, -16, 14, -9); c.moveTo(-6, -19); c.lineTo(-6, -5); c.moveTo(6, -19); c.lineTo(6, -5); c.lineWidth = 1.8; c.strokeStyle = shade('#5a6a34', -0.4); c.stroke();
  c.beginPath(); c.ellipse(0, -5, 25, 3.5, 0, 0, TAU); fillOut(c, '#d8cc8a', 2);
  c.lineJoin = 'miter'; c.lineCap = 'butt';
  c.restore();
}
// a glass bottle with a rolled-up note inside, a cork on top; tilted by ang
export function drawBottle(c, x, y, s, ang = 0) {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
  c.lineJoin = 'round';
  c.beginPath(); c.moveTo(-5, -34); c.lineTo(5, -34); c.lineTo(5, -22); c.bezierCurveTo(5, -16, 14, -14, 14, -4); c.lineTo(14, 16); c.bezierCurveTo(14, 21, 10, 23, 5, 23); c.lineTo(-5, 23); c.bezierCurveTo(-10, 23, -14, 21, -14, 16); c.lineTo(-14, -4); c.bezierCurveTo(-14, -14, -5, -16, -5, -22); c.closePath();
  c.fillStyle = 'rgba(120,200,150,0.75)'; c.fill(); c.lineWidth = 2.6; c.strokeStyle = OUT; c.stroke();
  c.beginPath(); c.rect(-3.4, -3, 7, 24); c.fillStyle = '#f4ead0'; c.fill(); c.lineWidth = 1.6; c.stroke();
  c.beginPath(); c.moveTo(-3.4, 2); c.lineTo(3.4, 2); c.moveTo(-3.4, 8); c.lineTo(3.4, 8); c.moveTo(-3.4, 14); c.lineTo(3.4, 14); c.lineWidth = 1; c.strokeStyle = '#a08a5a'; c.stroke();
  c.beginPath(); c.moveTo(-9, -4); c.lineTo(-9, 14); c.lineWidth = 2.4; c.strokeStyle = 'rgba(255,255,255,0.7)'; c.stroke();
  c.beginPath(); c.rect(-5.6, -40, 11.2, 8); fillOut(c, '#c8985a', 2);
  c.lineJoin = 'miter';
  c.restore();
}
// the junk by id
export function drawJunk(c, id, x, y, s, ang = 0, ph = 0, open = 0) {
  if (id === 'boot') drawBoot(c, x, y, s, ang);
  else if (id === 'turtle') drawTurtle(c, x, y, s, open, ph);
  else drawBottle(c, x, y, s, ang);
}
export const JUNK_NAMES = { boot: 'AN OLD BOOT!', turtle: 'A SNAPPING TURTLE!', bottle: 'A BOTTLE WITH A NOTE!' };

// ---------------------------------------------------------------- critters and things of the trail moments
// the rattlesnake sunning on the trail: head to the right at (x, y); sag 0..1 how much of it has slid out of sight (the
// caller clips); a cartoon snake: tan with diamonds, a tiny red tongue, a rattle, no fangs, never striking
export function drawSnake(c, x, y, s, t, slide = 0) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const N = 18, pts = [];
  for (let i = 0; i <= N; i++) { const u = i / N; pts.push([-u * 62, Math.sin(t * 3 * (slide > 0 ? 2.2 : 1) + u * 9) * (3.5 + u * 5) * (slide > 0 ? 1.3 : 0.8) - 2]); }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = N; i > 0; i--) {
      const a = pts[i], b = pts[i - 1], wd = 4 + (1 - i / N) * 7 + (i / N > 0.85 ? -1 : 0);
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
      c.lineWidth = pass === 0 ? wd + 3.4 : wd; c.strokeStyle = pass === 0 ? OUT : '#c4b060'; c.stroke();
    }
  }
  for (let i = 2; i < N - 1; i += 2) { const p = pts[i]; c.beginPath(); c.moveTo(p[0] - 3.2, p[1]); c.lineTo(p[0], p[1] - 3.4); c.lineTo(p[0] + 3.2, p[1]); c.lineTo(p[0], p[1] + 3.4); c.closePath(); c.fillStyle = '#6b5a2a'; c.fill(); }
  const tail = pts[N];       // the rattle: three beige beads
  for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(tail[0] - 4 - i * 4.2, tail[1], 2.6, 3.4 - i * 0.4, 0, 0, TAU); fillOut(c, '#efe0b0', 1.4); }
  const h = pts[0];
  c.beginPath(); c.ellipse(h[0] + 5, h[1] - 0.5, 9, 6, 0.08, 0, TAU); fillOut(c, '#c4b060', 2.2);
  dot(c, h[0] + 6, h[1] - 3, 1.7, OUT);
  if (Math.sin(t * 9) > 0.2) { c.beginPath(); c.moveTo(h[0] + 14, h[1]); c.lineTo(h[0] + 21, h[1]); c.moveTo(h[0] + 19, h[1]); c.lineTo(h[0] + 22, h[1] - 2.4); c.moveTo(h[0] + 19, h[1]); c.lineTo(h[0] + 22, h[1] + 2.4); c.lineWidth = 1.4; c.strokeStyle = '#e0432a'; c.stroke(); }
  c.lineCap = 'butt'; c.lineJoin = 'miter';
  c.restore();
}
// a far-off bird: two flapping strokes; col is the ink
export function drawBird(c, x, y, s, flap, col = '#2b1d14') {
  const f = Math.sin(flap) * 0.7;
  c.beginPath(); c.moveTo(x - 7 * s, y - 3 * s * (0.4 + f)); c.quadraticCurveTo(x - 3 * s, y - 5 * s * (0.4 + f) - 1 * s, x, y); c.quadraticCurveTo(x + 3 * s, y - 5 * s * (0.4 + f) - 1 * s, x + 7 * s, y - 3 * s * (0.4 + f));
  c.lineWidth = Math.max(1.2, 1.6 * s); c.strokeStyle = col; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
}
// a wolf, a silhouette against the moon: howling (head up) or standing; (x, y) are its feet
export function drawWolf(c, x, y, s, howl, col = '#1b1d33') {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(-14, -14); c.quadraticCurveTo(-20, -10, -22, -3); c.lineWidth = 3.6; c.stroke();   // the tail down
  c.beginPath(); c.ellipse(-2, -16, 13, 6, -0.05, 0, TAU); c.fill();
  for (const lx of [-11, -6, 6, 11]) { c.beginPath(); c.moveTo(lx, -14); c.lineTo(lx, -0.5); c.lineWidth = 3; c.stroke(); }
  const a = -0.5 - howl * 0.9;     // the neck rises
  c.beginPath(); c.moveTo(8, -18); c.lineTo(8 + Math.cos(a) * 12, -18 + Math.sin(a) * 12); c.lineWidth = 6; c.stroke();
  const hx = 8 + Math.cos(a) * 12, hy = -18 + Math.sin(a) * 12;
  c.beginPath(); c.ellipse(hx, hy, 5, 3.6, a * 0.5, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(hx + 2, hy - 1); c.lineTo(hx + 2 + Math.cos(a + howl * 0.35) * 9, hy - 1 + Math.sin(a + howl * 0.35) * 9); c.lineWidth = 3.6; c.stroke();   // the snout
  c.beginPath(); c.moveTo(hx - 2, hy - 3); c.lineTo(hx - 3, hy - 8); c.lineTo(hx + 1, hy - 4); c.closePath(); c.fill();
  c.lineCap = 'butt'; c.lineJoin = 'miter';
  c.restore();
}
// a grizzly seen far off, side-on, walking with its nose to the wind: (x, y) are its feet; head 0..1 lifts the nose
export function drawBear(c, x, y, s, ph, head, dir = 1) {
  c.save(); c.translate(x, y); c.scale(s * dir, s);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const col = '#5a3d2a', dark = '#3e2a1c';
  const sw = Math.sin(ph) * 3;
  const leg = (lx, o) => { c.beginPath(); c.moveTo(lx, -12); c.lineTo(lx + sw * o, -0.5); c.lineWidth = 7.4; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 4.6; c.strokeStyle = dark; c.stroke(); };
  leg(-13, 1); leg(11, 1);
  c.beginPath(); c.ellipse(-1, -17, 17, 10, 0, 0, TAU); fillOut(c, col, 2);
  c.beginPath(); c.ellipse(10, -24, 9, 8, 0, 0, TAU); fillOut(c, '#6c4b34', 2);      // the shoulder hump
  leg(-8, -1); leg(15, -1);
  const hy = -18 - head * 9;
  c.beginPath(); c.ellipse(24, hy, 8, 6.6, -0.2 - head * 0.3, 0, TAU); fillOut(c, '#6c4b34', 2);
  c.beginPath(); c.ellipse(31, hy + 2 - head * 2, 4.6, 3.4, 0, 0, TAU); fillOut(c, '#c0a07a', 1.6); dot(c, 34, hy + 1 - head * 2, 1.3, OUT);
  c.beginPath(); c.arc(22, hy - 6, 2.6, 0, TAU); fillOut(c, col, 1.6);
  dot(c, 26, hy - 2, 1.2, OUT);
  c.lineCap = 'butt'; c.lineJoin = 'miter';
  c.restore();
}
// a grasshopper (hind legs folded, long feelers); ph hops its legs; flip faces left
export function drawHopper(c, x, y, s, ph, dir = 1) {
  c.save(); c.translate(x, y); c.scale(s * dir, s);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const g = '#7ec850', dk = '#4f9a34';
  const k = Math.sin(ph) * 0.3;
  c.beginPath(); c.moveTo(-4, -8); c.lineTo(-16, -22 + k * 8); c.lineTo(-24, -4 + k * 8); c.lineWidth = 6.4; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.6; c.strokeStyle = dk; c.stroke();
  c.beginPath(); c.moveTo(2, -7); c.lineTo(-6, -2); c.lineTo(-8, 1); c.lineWidth = 5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.6; c.strokeStyle = dk; c.stroke();
  c.beginPath(); c.ellipse(0, -9, 15, 6.4, -0.05, 0, TAU); fillOut(c, g, 2);
  c.beginPath(); c.moveTo(-12, -10); c.quadraticCurveTo(-4, -17, 10, -12); c.lineWidth = 3.6; c.strokeStyle = shade(g, -0.3); c.stroke();    // the wing
  c.beginPath(); c.ellipse(15, -10, 6, 5.6, 0, 0, TAU); fillOut(c, g, 2);
  dot(c, 17.5, -12, 1.8, '#fff'); dot(c, 18, -12, 0.9, OUT);
  c.beginPath(); c.moveTo(19, -14); c.quadraticCurveTo(26, -24, 34, -22); c.moveTo(17, -15); c.quadraticCurveTo(21, -26, 27, -29); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
  c.lineCap = 'butt'; c.lineJoin = 'miter';
  c.restore();
}
// the stick the dog fetches; (x, y) its middle, ang its tilt
export function drawStick(c, x, y, s, ang = 0) {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(-18, 1); c.lineTo(18, -1); c.lineWidth = 8; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 4.6; c.strokeStyle = '#a8703e'; c.stroke();
  c.beginPath(); c.moveTo(-4, 0.5); c.lineTo(2, -9); c.lineWidth = 5.4; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#a8703e'; c.stroke();
  c.beginPath(); c.moveTo(8, -0.4); c.lineTo(8, 0.4); c.lineWidth = 2; c.strokeStyle = '#7a4a26'; c.stroke();
  c.lineCap = 'butt';
  c.restore();
}
// a flat skipping stone, seen from the side
export function drawStone(c, x, y, s, ang = 0) {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
  c.beginPath(); c.ellipse(0, 0, 9, 4.2, 0, 0, TAU); fillOut(c, '#8e9098', 2);
  c.beginPath(); c.ellipse(-2, -1.2, 4.4, 1.5, 0, 0, TAU); c.fillStyle = '#b9bbc2'; c.fill();
  c.restore();
}
// a falling star: a bright head and a long fading tail along the angle a (radians, the direction of travel); len px
export function drawStar(c, x, y, s, a, len, alpha = 1) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const g = c.createLinearGradient(x, y, x - ca * len, y - sa * len);
  g.addColorStop(0, 'rgba(255,250,210,' + (0.95 * alpha) + ')'); g.addColorStop(1, 'rgba(255,250,210,0)');
  c.beginPath(); c.moveTo(x - sa * 3 * s, y + ca * 3 * s); c.lineTo(x - ca * len, y - sa * len); c.lineTo(x + sa * 3 * s, y - ca * 3 * s); c.closePath();
  c.fillStyle = g; c.fill();
  c.save(); c.globalAlpha *= alpha;
  c.beginPath();
  for (let i = 0; i < 5; i++) { const b = (i * TAU) / 5 - Math.PI / 2; c.lineTo(x + Math.cos(b) * 8 * s, y + Math.sin(b) * 8 * s); const b2 = b + TAU / 10; c.lineTo(x + Math.cos(b2) * 3.4 * s, y + Math.sin(b2) * 3.4 * s); }
  c.closePath(); c.fillStyle = '#fff2a8'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = '#f0b400'; c.stroke();
  c.restore();
}

// ---------------------------------------------------------------- an emoji in a speech bubble (the dog's find)
const emojiCache = new Map();
function emojiSprite(emoji) {
  let cv = emojiCache.get(emoji);
  if (cv) return cv;
  if (emojiCache.size > 40) emojiCache.clear();
  cv = mkCanvas(64, 64);
  const g = cv.getContext('2d');
  g.font = '44px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(emoji, 32, 36);
  emojiCache.set(emoji, cv);
  return cv;
}
export function drawEmoji(c, emoji, x, y, size) { c.drawImage(emojiSprite(emoji), x - size / 2, y - size / 2, size, size); }
// a round bubble with a tail pointing down at (x, y)+tail; the emoji inside
export function drawBubble(c, emoji, x, y, s, alpha = 1) {
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(s, s);
  c.beginPath(); c.arc(0, -22, 22, 0, TAU); c.moveTo(-8, -3); c.lineTo(0, 6); c.lineTo(8, -3); c.closePath();
  fillOut(c, '#fffaf0', 2.6);
  c.beginPath(); c.arc(0, -22, 22, 0, TAU); c.fillStyle = '#fffaf0'; c.fill();
  c.restore();
  c.save(); c.globalAlpha *= alpha; drawEmoji(c, emoji, x, y - 22 * s, 30 * s); c.restore();
}

// Wagon West 1.5 landmark paintings (SPEC v1.5 §4.2): one set piece for every new leg, in the house style (flat fills, one chunky outline), painted once
// per size by backdrops.js. Each is (c, cx, b, s, pal): the centre x, the base line y, a scale (css px per unit) and the leg's biome palette.
// Kid rules: nothing scary, nothing decayed (no bones, no wrecks, no weapons); the dry places show barrels and signs, never trouble.
import { TAU, OUT, shade, mix, rrect, drawText } from './util.js';
import { paint } from './biomes.js';
import { drawPerson, personLook } from './sprites.js';
import { drawFlake } from './sprites15.js';

const fo = (c, fill, lw) => { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke(); };
const water = (c, x0, x1, y, h, s, col = '#4f9fd0') => { c.beginPath(); c.ellipse((x0 + x1) / 2, y, (x1 - x0) / 2, h, 0, 0, TAU); fo(c, col, 2 * s); };
const ripples = (c, cx, y, w, s, n = 4) => { c.beginPath(); for (let i = 0; i < n; i++) { const x = cx - w / 2 + (i + 0.3) * (w / n); c.moveTo(x, y + (i % 2) * 4 * s); c.lineTo(x + 18 * s, y + (i % 2) * 4 * s); } c.lineWidth = 2 * s; c.strokeStyle = 'rgba(255,255,255,0.75)'; c.stroke(); };
const signBoard = (c, x, y, w, h, s, text) => { c.beginPath(); rrect(c, x - w / 2, y - h / 2, w, h, 3 * s); fo(c, '#f4ead0', 1.6 * s); drawText(c, text, h * 0.46, x, y, '#6a3a1a', null, w * 0.9); };
const post = (c, x, y0, y1, s) => { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.lineWidth = 6 * s; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.2 * s; c.strokeStyle = '#8a5a2e'; c.stroke(); };
const grassTufts = (c, cx, b, s, n, span, col) => { for (let i = 0; i < n; i++) paint.grass(c, cx + (-span + (i * 2 * span) / (n - 1)) * s, b + (i % 3) * 3 * s, (14 + (i % 4) * 4) * s, col, 2 * s); };

export const PAINTINGS15 = {
  'alcove-spring'(c, cx, b, s) {
    const lw = 2.2 * s;
    c.beginPath(); c.moveTo(cx - 180 * s, b); c.lineTo(cx - 168 * s, b - 112 * s); c.quadraticCurveTo(cx - 100 * s, b - 128 * s, cx - 30 * s, b - 122 * s); c.lineTo(cx - 22 * s, b - 80 * s); c.quadraticCurveTo(cx - 40 * s, b - 30 * s, cx - 14 * s, b); c.closePath(); fo(c, '#cdbb98', lw);
    c.beginPath(); for (let i = 1; i < 5; i++) { const y = b - i * 24 * s; c.moveTo(cx - 172 * s + i * 3 * s, y); c.lineTo(cx - 30 * s - i * 3 * s, y - 4 * s); } c.lineWidth = 1.6 * s; c.strokeStyle = '#a89870'; c.stroke();
    c.beginPath(); c.moveTo(cx - 52 * s, b - 120 * s); c.lineTo(cx - 36 * s, b - 120 * s); c.lineTo(cx - 34 * s, b - 6 * s); c.lineTo(cx - 54 * s, b - 6 * s); c.closePath(); fo(c, '#e8f6ff', 1.6 * s);
    c.beginPath(); c.moveTo(cx - 47 * s, b - 112 * s); c.lineTo(cx - 46 * s, b - 14 * s); c.moveTo(cx - 40 * s, b - 108 * s); c.lineTo(cx - 40 * s, b - 20 * s); c.lineWidth = 1.4 * s; c.strokeStyle = '#a8d4f0'; c.stroke();
    water(c, cx - 110 * s, cx + 70 * s, b - 2 * s, 12 * s, s); ripples(c, cx - 20 * s, b - 4 * s, 120 * s, s, 4);
    c.beginPath(); c.arc(cx - 44 * s, b - 8 * s, 18 * s, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fill();
    c.beginPath(); for (let i = 0; i < 6; i++) { const x = cx - 150 * s + i * 11 * s, y = b - 44 * s - (i % 3) * 9 * s; c.moveTo(x, y); c.lineTo(x + 7 * s, y); c.moveTo(x + 2 * s, y - 4 * s); c.lineTo(x + 2 * s, y + 2 * s); } c.lineWidth = 1.4 * s; c.strokeStyle = '#5a4a38'; c.stroke();
    for (const [x, h] of [[100, 120], [150, 96], [190, 70]]) paint.blobTree(c, cx + x * s, b, h * s, '#7a5a3a', '#6aa84a', OUT, 1.8 * s);
  },
  'ash-hollow'(c, cx, b, s) {
    const lw = 2.2 * s;
    c.beginPath(); c.moveTo(cx - 240 * s, b); c.lineTo(cx - 240 * s, b - 140 * s); c.quadraticCurveTo(cx - 150 * s, b - 118 * s, cx - 60 * s, b - 40 * s); c.quadraticCurveTo(cx - 20 * s, b - 12 * s, cx + 10 * s, b); c.closePath(); fo(c, '#d2b97c', lw);
    c.beginPath(); for (let i = 0; i < 7; i++) { const x = cx - 230 * s + i * 30 * s; paint.grass(c, x, b - (130 - i * 18 - (i > 4 ? 14 : 0)) * s + 10 * s, 14 * s, '#7a8a3a', 2 * s); } void 0;
    c.beginPath(); c.moveTo(cx - 205 * s, b - 134 * s); c.quadraticCurveTo(cx - 130 * s, b - 108 * s, cx - 48 * s, b - 32 * s); c.setLineDash([6 * s, 5 * s]); c.lineWidth = 2.4 * s; c.strokeStyle = '#7a4a26'; c.stroke(); c.setLineDash([]);
    c.beginPath(); c.arc(cx - 205 * s, b - 138 * s, 5 * s, 0, TAU); fo(c, '#a8703e', 1.4 * s);
    for (const [x, h, col] of [[20, 110, '#4f9a4e'], [70, 130, '#58a85a'], [120, 100, '#4a944a'], [170, 120, '#58a85a'], [215, 90, '#4f9a4e']]) paint.blobTree(c, cx + x * s, b, h * s, '#6a5a44', col, OUT, 1.8 * s);
    water(c, cx + 30 * s, cx + 110 * s, b + 2 * s, 6 * s, s, '#7cc4d8');
  },
  'scotts-bluff'(c, cx, b, s) {
    const lw = 2.4 * s;
    c.beginPath(); c.moveTo(cx - 230 * s, b); c.lineTo(cx - 206 * s, b - 90 * s); c.lineTo(cx - 168 * s, b - 150 * s); c.lineTo(cx - 120 * s, b - 168 * s); c.lineTo(cx - 70 * s, b - 160 * s); c.lineTo(cx - 40 * s, b - 120 * s); c.lineTo(cx - 24 * s, b); c.closePath(); fo(c, '#dcb27c', lw);
    c.beginPath(); c.moveTo(cx + 30 * s, b); c.lineTo(cx + 48 * s, b - 110 * s); c.lineTo(cx + 96 * s, b - 150 * s); c.lineTo(cx + 170 * s, b - 140 * s); c.lineTo(cx + 214 * s, b - 80 * s); c.lineTo(cx + 236 * s, b); c.closePath(); fo(c, '#d6a874', lw);
    c.beginPath(); for (let i = 1; i < 6; i++) { const y = b - i * 26 * s; c.moveTo(cx - 220 * s + i * 7 * s, y); c.lineTo(cx - 34 * s - i * 2 * s, y); c.moveTo(cx + 36 * s + i * 2 * s, y); c.lineTo(cx + 230 * s - i * 8 * s, y); } c.lineWidth = 1.6 * s; c.strokeStyle = '#b07c48'; c.stroke();
    c.beginPath(); for (const x of [-190, -160, -130, -96, 60, 100, 140, 180]) { c.moveTo(cx + x * s, b - 20 * s); c.lineTo(cx + (x + 4) * s, b - 110 * s); } c.lineWidth = 2.4 * s; c.strokeStyle = 'rgba(120,70,30,0.35)'; c.stroke();
    c.beginPath(); c.moveTo(cx - 28 * s, b); c.quadraticCurveTo(cx, b - 30 * s, cx + 34 * s, b); c.lineTo(cx + 18 * s, b); c.quadraticCurveTo(cx, b - 10 * s, cx - 12 * s, b); c.closePath(); c.fillStyle = '#e8d2a0'; c.fill(); // the pass between them
    for (let i = 0; i < 6; i++) paint.sage(c, cx - 200 * s + i * 76 * s, b + 2 * s, 9 * s, '#8a9a58', OUT, 1.4 * s);
  },
  'ice-slough'(c, cx, b, s) {
    const lw = 2.2 * s;
    c.beginPath(); c.moveTo(cx - 245 * s, b); c.quadraticCurveTo(cx - 100 * s, b - 70 * s, cx + 10 * s, b - 56 * s); c.quadraticCurveTo(cx + 150 * s, b - 46 * s, cx + 245 * s, b); c.closePath(); fo(c, '#86a860', lw);
    for (const [x, y, w] of [[-130, -24, 64], [-10, -40, 74], [140, -22, 54]]) { c.beginPath(); c.ellipse(cx + x * s, b + y * s, w * s, 11 * s, 0, 0, TAU); c.fillStyle = '#8fd0e8'; c.fill(); c.lineWidth = 1.6 * s; c.strokeStyle = '#3f86b8'; c.stroke(); }
    for (const [x, y, w, h] of [[-50, -50, 70, 52], [20, -48, 64, 46], [-18, -96, 60, 44], [96, -44, 52, 40]]) {
      c.beginPath(); rrect(c, cx + x * s, b + y * s, w * s, h * s, 7 * s); fo(c, '#cfeeff', 2.2 * s);
      c.beginPath(); c.moveTo(cx + (x + 8) * s, b + (y + 7) * s); c.lineTo(cx + (x + 26) * s, b + (y + 7) * s); c.moveTo(cx + (x + 8) * s, b + (y + 15) * s); c.lineTo(cx + (x + 16) * s, b + (y + 15) * s); c.lineWidth = 3.4 * s; c.strokeStyle = '#ffffff'; c.stroke();
    }
    c.beginPath(); c.moveTo(cx - 104 * s, b - 26 * s); c.lineTo(cx - 114 * s, b - 116 * s); c.lineWidth = 6 * s; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.2 * s; c.strokeStyle = '#a8703e'; c.stroke();
    c.beginPath(); c.moveTo(cx - 122 * s, b - 112 * s); c.lineTo(cx - 106 * s, b - 112 * s); c.lineTo(cx - 103 * s, b - 82 * s); c.lineTo(cx - 114 * s, b - 72 * s); c.lineTo(cx - 125 * s, b - 82 * s); c.closePath(); fo(c, '#a8b0b8', 2 * s);
    grassTufts(c, cx, b - 18 * s, s, 14, 215, '#5a8a3a');
  },
  'farewell-bend'(c, cx, b, s) {
    const lw = 2.2 * s;
    c.beginPath(); c.moveTo(cx - 240 * s, b - 30 * s); c.bezierCurveTo(cx - 120 * s, b - 90 * s, cx + 40 * s, b - 20 * s, cx + 60 * s, b - 4 * s); c.bezierCurveTo(cx + 90 * s, b + 8 * s, cx + 170 * s, b - 30 * s, cx + 240 * s, b - 10 * s);
    c.lineTo(cx + 240 * s, b + 14 * s); c.bezierCurveTo(cx + 150 * s, b + 8 * s, cx + 80 * s, b + 24 * s, cx + 40 * s, b + 14 * s); c.bezierCurveTo(cx - 40 * s, b + 4 * s, cx - 120 * s, b - 52 * s, cx - 240 * s, b - 4 * s); c.closePath(); fo(c, '#4f9fd0', lw);
    ripples(c, cx - 30 * s, b - 18 * s, 220 * s, s, 5);
    c.beginPath(); c.moveTo(cx - 240 * s, b + 4 * s); c.bezierCurveTo(cx - 130 * s, b - 36 * s, cx - 30 * s, b + 24 * s, cx + 20 * s, b + 22 * s); c.lineWidth = 7 * s; c.strokeStyle = '#ecd8a0'; c.stroke();
    for (const [x, h] of [[-170, 120], [-120, 94], [140, 112], [190, 88]]) paint.blobTree(c, cx + x * s, b - 20 * s, h * s, '#7a6a4a', '#8fb04a', OUT, 1.8 * s);
    c.beginPath(); c.moveTo(cx + 64 * s, b + 22 * s); c.quadraticCurveTo(cx + 150 * s, b + 8 * s, cx + 240 * s, b + 22 * s); c.setLineDash([8 * s, 6 * s]); c.lineWidth = 4 * s; c.strokeStyle = '#b8925c'; c.stroke(); c.setLineDash([]);
  },
  'sublette-cutoff'(c, cx, b, s, pal) {
    const lw = 2 * s;
    c.beginPath(); c.moveTo(cx - 250 * s, b); c.lineTo(cx - 250 * s, b - 14 * s); c.quadraticCurveTo(cx, b - 22 * s, cx + 250 * s, b - 12 * s); c.lineTo(cx + 250 * s, b); c.closePath(); fo(c, '#e4cf9c', lw);
    for (let i = 0; i < 9; i++) paint.sage(c, cx - 210 * s + i * 52 * s, b - 6 * s + (i % 3) * 3 * s, (8 + (i % 3) * 3) * s, '#98a468', OUT, 1.4 * s);
    post(c, cx + 20 * s, b + 2 * s, b - 82 * s, s);
    c.beginPath(); c.moveTo(cx - 60 * s, b - 80 * s); c.lineTo(cx + 74 * s, b - 80 * s); c.lineTo(cx + 74 * s, b - 52 * s); c.lineTo(cx - 60 * s, b - 52 * s); c.lineTo(cx - 72 * s, b - 66 * s); c.closePath(); fo(c, '#f4ead0', 1.8 * s);
    drawText(c, 'SUBLETTE CUTOFF', 9 * s, cx + 8 * s, b - 66 * s, '#6a3a1a', null, 118 * s);
    c.beginPath(); c.moveTo(cx - 240 * s, b - 4 * s); c.quadraticCurveTo(cx - 60 * s, b - 14 * s, cx + 8 * s, b - 12 * s); c.moveTo(cx - 240 * s, b + 2 * s); c.quadraticCurveTo(cx - 60 * s, b - 8 * s, cx + 8 * s, b - 8 * s); c.lineWidth = 1.8 * s; c.strokeStyle = '#b8925c'; c.stroke();
    void pal;
  },
  'bear-river'(c, cx, b, s) {
    const lw = 2.2 * s;
    for (const [col, h, n] of [['#a9bad8', 120, 2], ['#86a0c8', 84, 3]]) { c.beginPath(); c.moveTo(cx - 240 * s, b); for (let x = -240; x <= 240; x += 8) c.lineTo(cx + x * s, b - h * s * (0.75 + 0.22 * Math.sin((x / 480) * TAU * n + n)) * Math.min(1, (240 - Math.abs(x)) / 60)); c.lineTo(cx + 240 * s, b); c.closePath(); fo(c, col, lw); }
    c.beginPath(); c.moveTo(cx - 240 * s, b - 6 * s); c.bezierCurveTo(cx - 120 * s, b - 22 * s, cx + 40 * s, b + 10 * s, cx + 240 * s, b - 8 * s); c.lineTo(cx + 240 * s, b + 6 * s); c.bezierCurveTo(cx + 40 * s, b + 24 * s, cx - 120 * s, b - 6 * s, cx - 240 * s, b + 6 * s); c.closePath(); fo(c, '#4f9fd0', 1.8 * s);
    for (const [x, h] of [[-190, 70], [-150, 54], [120, 64], [170, 50]]) paint.blobTree(c, cx + x * s, b + 2 * s, h * s, '#7a6a4a', '#6aa04a', OUT, 1.6 * s);
    // two ruts coming in from the left and right and meeting in a Y
    c.beginPath(); c.moveTo(cx - 230 * s, b + 22 * s); c.quadraticCurveTo(cx - 80 * s, b + 18 * s, cx, b + 10 * s); c.moveTo(cx - 230 * s, b + 4 * s); c.quadraticCurveTo(cx - 100 * s, b + 10 * s, cx, b + 10 * s); c.moveTo(cx, b + 10 * s); c.lineTo(cx + 230 * s, b + 14 * s);
    c.lineWidth = 5 * s; c.strokeStyle = '#d8bc88'; c.stroke();
  },
  'lander-road'(c, cx, b, s) {
    const lw = 2 * s;
    for (const [col, h] of [['#8fa4cc', 130], ['#6f8cb8', 90]]) { c.beginPath(); c.moveTo(cx - 240 * s, b); for (let x = -240; x <= 240; x += 10) c.lineTo(cx + x * s, b - h * s * (0.7 + 0.25 * Math.sin(x * 0.03 + h)) * Math.min(1, (240 - Math.abs(x)) / 50)); c.lineTo(cx + 240 * s, b); c.closePath(); fo(c, col, lw); }
    c.beginPath(); c.moveTo(cx - 70 * s, b + 4 * s); c.bezierCurveTo(cx - 30 * s, b - 40 * s, cx + 40 * s, b - 20 * s, cx + 20 * s, b - 70 * s); c.lineTo(cx + 36 * s, b - 70 * s); c.bezierCurveTo(cx + 60 * s, b - 20 * s, cx - 10 * s, b - 40 * s, cx + 20 * s, b + 4 * s); c.closePath(); c.fillStyle = '#e8d4a4'; c.fill();
    for (let i = 0; i < 14; i++) { // aspens: white trunks, yellow-green leaves
      const x = cx + (-220 + i * 33 + (i % 2) * 8) * s, h = (66 + (i * 37) % 40) * s, y = b + (i % 3) * 3 * s;
      c.beginPath(); c.moveTo(x - 2.4 * s, y); c.lineTo(x - 2 * s, y - h * 0.7); c.lineTo(x + 2 * s, y - h * 0.7); c.lineTo(x + 2.4 * s, y); c.closePath(); fo(c, '#f4f0e4', 1.4 * s);
      c.beginPath(); c.moveTo(x - 1 * s, y - h * 0.2); c.lineTo(x + 1 * s, y - h * 0.2); c.moveTo(x - 1 * s, y - h * 0.45); c.lineTo(x + 1 * s, y - h * 0.45); c.lineWidth = 1.8 * s; c.strokeStyle = '#3a3a3a'; c.stroke();
      c.beginPath(); c.ellipse(x, y - h * 0.82, 15 * s, 18 * s, 0, 0, TAU); fo(c, i % 3 ? '#a8c848' : '#e0c838', 1.6 * s);
    }
    post(c, cx + 100 * s, b - 20 * s, b - 120 * s, s); signBoard(c, cx + 100 * s, b - 122 * s, 80 * s, 20 * s, s, 'NEW ROAD');
  },
  'barlow-road'(c, cx, b, s) {
    const lw = 2.4 * s;
    paint.peak(c, cx - 30 * s, b, 330 * s, 196 * s, '#8fa4c8', '#ffffff', OUT, lw);
    paint.peak(c, cx + 160 * s, b, 150 * s, 82 * s, '#7f94b8', '#ffffff', OUT, lw);
    for (let i = 0; i < 12; i++) paint.pine(c, cx + (-230 + i * 38) * s, b + 2 * s, 22 * s, 48 * s + (i % 3) * 8 * s, '#2f5a46', OUT, 1.4 * s);
    // the road, and the toll gate across it: two posts, a bar, a toll house and its sign
    c.beginPath(); c.moveTo(cx + 10 * s, b - 24 * s); c.quadraticCurveTo(cx + 30 * s, b - 8 * s, cx - 30 * s, b + 8 * s); c.lineTo(cx + 40 * s, b + 8 * s); c.quadraticCurveTo(cx + 60 * s, b - 8 * s, cx + 30 * s, b - 24 * s); c.closePath(); c.fillStyle = '#d8bc88'; c.fill();
    post(c, cx - 56 * s, b + 4 * s, b - 46 * s, s); post(c, cx + 62 * s, b + 4 * s, b - 46 * s, s);
    c.beginPath(); c.moveTo(cx - 56 * s, b - 34 * s); c.lineTo(cx + 40 * s, b - 52 * s); c.lineWidth = 8 * s; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 4.4 * s; c.strokeStyle = '#d9534f'; c.stroke();
    c.beginPath(); c.moveTo(cx - 40 * s, b - 37 * s); c.lineTo(cx - 24 * s, b - 40 * s); c.moveTo(cx - 8 * s, b - 43 * s); c.lineTo(cx + 8 * s, b - 46 * s); c.lineWidth = 4.4 * s; c.strokeStyle = '#ffffff'; c.stroke();
    c.beginPath(); c.moveTo(cx + 74 * s, b + 4 * s); c.lineTo(cx + 74 * s, b - 36 * s); c.lineTo(cx + 110 * s, b - 52 * s); c.lineTo(cx + 146 * s, b - 36 * s); c.lineTo(cx + 146 * s, b + 4 * s); c.closePath(); fo(c, '#a8703e', 2 * s);
    c.beginPath(); c.rect(cx + 100 * s, b - 28 * s, 20 * s, 32 * s); fo(c, '#5a3a22', 1.6 * s); signBoard(c, cx + 110 * s, b - 70 * s, 54 * s, 18 * s, s, 'TOLL GATE');
  },
  'raft-river'(c, cx, b, s) {
    const lw = 2.2 * s;
    c.beginPath(); c.moveTo(cx - 240 * s, b); c.lineTo(cx - 200 * s, b - 56 * s); c.lineTo(cx - 60 * s, b - 78 * s); c.lineTo(cx + 40 * s, b - 70 * s); c.lineTo(cx + 120 * s, b - 40 * s); c.lineTo(cx + 240 * s, b); c.closePath(); fo(c, '#d2b27c', lw);
    c.beginPath(); for (let i = 1; i < 4; i++) { c.moveTo(cx - 220 * s, b - i * 18 * s); c.lineTo(cx + 200 * s - i * 40 * s, b - i * 18 * s); } c.lineWidth = 1.4 * s; c.strokeStyle = '#a8824e'; c.stroke();
    post(c, cx - 20 * s, b - 66 * s, b - 160 * s, s);
    for (const [txt, dx, dy, dir] of [['OREGON', -1, -150, -1], ['CALIFORNIA', 1, -118, 1]]) {
      const w = 84 * s, h = 22 * s, x = cx - 20 * s + dir * (w / 2 + 6 * s), y = b + dy * s;
      c.beginPath(); c.moveTo(x - dir * w / 2, y - h / 2); c.lineTo(x + dir * (w / 2 - 8 * s), y - h / 2); c.lineTo(x + dir * (w / 2 + 12 * s), y); c.lineTo(x + dir * (w / 2 - 8 * s), y + h / 2); c.lineTo(x - dir * w / 2, y + h / 2); c.closePath(); fo(c, '#f4ead0', 1.8 * s);
      drawText(c, txt, 9.5 * s, x - dir * 4 * s, y, '#6a3a1a', null, w * 0.84);
    }
    for (let i = 0; i < 6; i++) paint.sage(c, cx - 210 * s + i * 82 * s, b + 2 * s, 9 * s, '#8a9a58', OUT, 1.4 * s);
    c.beginPath(); c.moveTo(cx - 240 * s, b + 6 * s); c.quadraticCurveTo(cx, b - 6 * s, cx + 240 * s, b + 8 * s); c.lineWidth = 6 * s; c.strokeStyle = '#4f9fd0'; c.stroke();
  },
  'city-of-rocks'(c, cx, b, s) {
    const lw = 2.4 * s;
    for (const [x, w, h, k] of [[-190, 70, 120, 0], [-120, 56, 170, 1], [-50, 80, 110, 0], [20, 58, 190, 1], [95, 84, 130, 0], [170, 60, 150, 1]]) {
      if (k) paint.spire ? paint.spire(c, cx + x * s, b, w * s, h * s, '#c9c4bc', OUT, lw) : 0; else paint.dome(c, cx + x * s, b, w * s * 1.3, h * s, '#bdb8b0', null, OUT, lw);
    }
    c.beginPath(); for (let i = 0; i < 16; i++) { const x = cx + (-190 + i * 25) * s, y = b - (20 + (i * 17) % 60) * s; c.moveTo(x, y); c.lineTo(x + 8 * s, y); c.moveTo(x + 2 * s, y - 3 * s); c.lineTo(x + 2 * s, y + 3 * s); } c.lineWidth = 1.2 * s; c.strokeStyle = '#3a3a3a'; c.stroke(); // names in axle grease
    for (let i = 0; i < 9; i++) paint.sage(c, cx - 220 * s + i * 56 * s, b + 4 * s, 9 * s, '#8a9a58', OUT, 1.4 * s);
  },
  'humboldt-wells'(c, cx, b, s) {
    const lw = 2 * s;
    c.beginPath(); c.moveTo(cx - 240 * s, b); for (let x = -240; x <= 240; x += 10) c.lineTo(cx + x * s, b - 78 * s * (0.55 + 0.45 * Math.sin(x * 0.02 + 1)) * Math.min(1, (240 - Math.abs(x)) / 60)); c.lineTo(cx + 240 * s, b); c.closePath(); fo(c, '#c0b890', lw);
    c.beginPath(); c.moveTo(cx - 245 * s, b); c.quadraticCurveTo(cx - 100 * s, b - 80 * s, cx + 20 * s, b - 66 * s); c.quadraticCurveTo(cx + 150 * s, b - 56 * s, cx + 245 * s, b); c.closePath(); fo(c, '#86b858', lw);
    for (const [x, y, rx, ry] of [[-150, -22, 56, 12], [-40, -40, 40, 9], [60, -24, 64, 14], [170, -16, 38, 9], [10, -8, 30, 7]]) { c.beginPath(); c.ellipse(cx + x * s, b + y * s, rx * s, ry * s, 0, 0, TAU); fo(c, '#5fb2dc', 1.8 * s); c.beginPath(); c.ellipse(cx + (x - rx * 0.3) * s, b + (y - ry * 0.3) * s, rx * 0.45 * s, ry * 0.28 * s, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.65)'; c.fill();
      for (let r = 0; r < 4; r++) paint.grass(c, cx + (x - rx + r * rx * 0.66) * s, b + (y - ry * 0.4) * s, (22 + (r % 2) * 8) * s, '#3f7a2a', 2.2 * s); }
    for (const [x, h] of [[-205, 120], [-130, 90], [195, 130], [135, 84]]) paint.willow(c, cx + x * s, b - 8 * s, h * s, '#6f9a52', OUT, 1.8 * s);
    c.beginPath(); for (let i = 0; i < 16; i++) { const x = cx + (-210 + i * 28) * s, y = b - (6 + (i * 11) % 40) * s; c.moveTo(x + 2.6 * s, y); c.arc(x, y, 2.6 * s, 0, TAU); } c.fillStyle = '#ffffff'; c.fill();
  },
  'big-meadows'(c, cx, b, s) {
    const lw = 2 * s;
    c.beginPath(); c.moveTo(cx - 245 * s, b); c.quadraticCurveTo(cx - 120 * s, b - 120 * s, cx + 10 * s, b - 96 * s); c.quadraticCurveTo(cx + 140 * s, b - 76 * s, cx + 245 * s, b); c.closePath(); fo(c, '#6fb046', lw);
    c.beginPath(); c.moveTo(cx - 245 * s, b); c.quadraticCurveTo(cx - 100 * s, b - 64 * s, cx + 60 * s, b - 46 * s); c.quadraticCurveTo(cx + 160 * s, b - 36 * s, cx + 245 * s, b); c.closePath(); fo(c, '#88c85a', lw);
    c.beginPath(); c.moveTo(cx - 80 * s, b - 6 * s); c.bezierCurveTo(cx - 30 * s, b - 40 * s, cx + 30 * s, b - 16 * s, cx + 70 * s, b - 60 * s); c.lineWidth = 9 * s; c.strokeStyle = '#4f9fd0'; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
    for (let i = 0; i < 22; i++) { const x = cx + (-225 + i * 21) * s, y = b - (10 + ((i * 29) % 60)) * s; paint.grass(c, x, y, (20 + (i % 3) * 7) * s, '#3f7a2a', 2.2 * s); }
    c.beginPath(); for (let i = 0; i < 34; i++) { const x = cx + (-232 + i * 14 + (i % 4) * 4) * s, y = b - (4 + ((i * 13) % 70)) * s; c.moveTo(x + 3.2 * s, y); c.arc(x, y, 3.2 * s, 0, TAU); } c.fillStyle = '#ffd23f'; c.fill();
    c.beginPath(); for (let i = 0; i < 22; i++) { const x = cx + (-220 + i * 20) * s, y = b - (8 + ((i * 17) % 60)) * s; c.moveTo(x + 2.8 * s, y); c.arc(x, y, 2.8 * s, 0, TAU); } c.fillStyle = '#ffffff'; c.fill();
    c.beginPath(); for (let i = 0; i < 12; i++) { const x = cx + (-200 + i * 36) * s, y = b - (12 + ((i * 23) % 50)) * s; c.moveTo(x + 2.8 * s, y); c.arc(x, y, 2.8 * s, 0, TAU); } c.fillStyle = '#c070f0'; c.fill();
    for (const [x, h] of [[-205, 76], [-160, 60], [205, 70]]) paint.willow(c, cx + x * s, b - 8 * s, h * s, '#7cb04a', OUT, 1.6 * s);
  },
  'forty-mile-desert'(c, cx, b, s) {
    const lw = 2 * s;
    for (const [col, h] of [['#d0d8e8', 70], ['#bcc6dc', 44]]) { c.beginPath(); c.moveTo(cx - 245 * s, b - 16 * s); for (let x = -245; x <= 245; x += 10) c.lineTo(cx + x * s, b - 16 * s - h * s * (0.55 + 0.4 * Math.sin(x * 0.028 + h)) * Math.min(1, (245 - Math.abs(x)) / 50)); c.lineTo(cx + 245 * s, b - 16 * s); c.closePath(); c.fillStyle = col; c.fill(); }
    c.beginPath(); c.ellipse(cx, b - 6 * s, 240 * s, 20 * s, 0, 0, TAU); fo(c, '#f6f1e2', lw);
    c.beginPath(); for (let i = 0; i < 18; i++) { const x = cx + (-210 + i * 25) * s, y = b - (14 - (i % 4) * 4) * s; c.moveTo(x, y); c.lineTo(x + 9 * s, y + 3 * s); c.lineTo(x + 18 * s, y - 1 * s); } c.lineWidth = 1.2 * s; c.strokeStyle = '#cfc6ac'; c.stroke(); // the cracked white flat
    c.beginPath(); for (let i = 0; i < 4; i++) { const y = b - (30 + i * 9) * s; c.moveTo(cx - 230 * s, y); for (let x = -230; x <= 230; x += 12) c.lineTo(cx + x * s, y + Math.sin(x * 0.06 + i) * 2 * s); } c.lineWidth = 1.6 * s; c.strokeStyle = 'rgba(255,255,255,0.7)'; c.stroke(); // the heat shimmer
    // water barrels bound with rope on a little cart, and a sign with a drop
    c.beginPath(); rrect(c, cx - 78 * s, b - 22 * s, 120 * s, 8 * s, 2 * s); fo(c, '#a8703e', 1.8 * s);
    for (const dx of [-60, -20, 22]) { c.beginPath(); rrect(c, cx + (dx - 18) * s, b - 62 * s, 36 * s, 42 * s, 10 * s); fo(c, '#b07a48', 2.2 * s); c.beginPath(); c.moveTo(cx + (dx - 18) * s, b - 50 * s); c.lineTo(cx + (dx + 18) * s, b - 50 * s); c.moveTo(cx + (dx - 18) * s, b - 32 * s); c.lineTo(cx + (dx + 18) * s, b - 32 * s); c.lineWidth = 3 * s; c.strokeStyle = '#4a4a52'; c.stroke();
      c.beginPath(); c.moveTo(cx + dx * s, b - 48 * s); c.quadraticCurveTo(cx + (dx + 8) * s, b - 38 * s, cx + dx * s, b - 32 * s); c.quadraticCurveTo(cx + (dx - 8) * s, b - 38 * s, cx + dx * s, b - 48 * s); c.fillStyle = '#58b4ea'; c.fill(); c.lineWidth = 1.2 * s; c.stroke(); }
    c.beginPath(); c.arc(cx - 50 * s, b - 12 * s, 10 * s, 0, TAU); fo(c, '#8a5a2e', 2 * s); c.beginPath(); c.arc(cx + 22 * s, b - 12 * s, 10 * s, 0, TAU); fo(c, '#8a5a2e', 2 * s);
    post(c, cx + 130 * s, b + 2 * s, b - 76 * s, s); c.beginPath(); rrect(c, cx + 104 * s, b - 96 * s, 52 * s, 28 * s, 4 * s); fo(c, '#f4ead0', 1.8 * s);
    c.beginPath(); c.moveTo(cx + 130 * s, b - 90 * s); c.quadraticCurveTo(cx + 140 * s, b - 78 * s, cx + 130 * s, b - 72 * s); c.quadraticCurveTo(cx + 120 * s, b - 78 * s, cx + 130 * s, b - 90 * s); c.fillStyle = '#58b4ea'; c.fill(); c.lineWidth = 1.4 * s; c.stroke();
  },
  'sierra-summit'(c, cx, b, s) {
    const lw = 2.4 * s;
    paint.dome(c, cx - 150 * s, b, 260 * s, 190 * s, '#a6aebe', '#ffffff', OUT, lw);
    paint.dome(c, cx + 150 * s, b, 280 * s, 210 * s, '#9aa4b8', '#ffffff', OUT, lw);
    c.beginPath(); c.moveTo(cx - 90 * s, b); c.quadraticCurveTo(cx, b - 56 * s, cx + 90 * s, b); c.closePath(); fo(c, '#eef3fb', lw);
    c.beginPath(); c.moveTo(cx - 60 * s, b - 6 * s); c.quadraticCurveTo(cx, b - 28 * s, cx + 62 * s, b - 6 * s); c.lineWidth = 1.6 * s; c.strokeStyle = 'rgba(120,150,200,0.6)'; c.stroke();
    for (let i = 0; i < 12; i++) paint.pine(c, cx + (-236 + i * 24 + (i > 5 ? 86 : 0)) * s, b + 2 * s, 20 * s, 46 * s + (i % 3) * 8 * s, '#2f5846', OUT, 1.4 * s);
    post(c, cx + 8 * s, b - 22 * s, b - 90 * s, s); c.beginPath(); c.moveTo(cx + 8 * s, b - 90 * s); c.lineTo(cx + 38 * s, b - 82 * s); c.lineTo(cx + 8 * s, b - 74 * s); c.closePath(); fo(c, '#d9534f', 1.4 * s);
  },
  'calapooya-mountains'(c, cx, b, s) {
    const lw = 2.2 * s;
    for (const [col, h, n, ph] of [['#7ea080', 150, 2, 0], ['#5f8a66', 112, 3, 2], ['#3f7050', 78, 4, 4]]) { c.beginPath(); c.moveTo(cx - 245 * s, b); for (let x = -245; x <= 245; x += 8) c.lineTo(cx + x * s, b - h * s * (0.72 + 0.26 * Math.sin((x / 490) * TAU * n + ph)) * Math.min(1, (245 - Math.abs(x)) / 55)); c.lineTo(cx + 245 * s, b); c.closePath(); fo(c, col, lw);
      c.beginPath(); c.ellipse(cx + ph * 20 * s - 30 * s, b - h * 0.45 * s, 180 * s, 9 * s, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill(); }
    for (let i = 0; i < 18; i++) paint.pine(c, cx + (-236 + i * 27) * s, b + 2 * s, 18 * s, (40 + (i * 13) % 34) * s, '#2f5a3a', OUT, 1.3 * s);
  },
  'canyon-creek'(c, cx, b, s) {
    const lw = 2.4 * s;
    c.beginPath(); c.moveTo(cx - 240 * s, b); c.lineTo(cx - 220 * s, b - 180 * s); c.lineTo(cx - 130 * s, b - 190 * s); c.lineTo(cx - 70 * s, b - 120 * s); c.lineTo(cx - 40 * s, b - 24 * s); c.lineTo(cx - 20 * s, b); c.closePath(); fo(c, '#8a8f98', lw);
    c.beginPath(); c.moveTo(cx + 240 * s, b); c.lineTo(cx + 226 * s, b - 170 * s); c.lineTo(cx + 140 * s, b - 182 * s); c.lineTo(cx + 84 * s, b - 112 * s); c.lineTo(cx + 54 * s, b - 20 * s); c.lineTo(cx + 36 * s, b); c.closePath(); fo(c, '#969ca6', lw);
    c.beginPath(); for (let x = -226; x < -50; x += 14) { c.moveTo(cx + x * s, b - 14 * s); c.lineTo(cx + x * s, b - (50 + (x % 7) * 10 + 60) * s); } for (let x = 60; x < 230; x += 14) { c.moveTo(cx + x * s, b - 14 * s); c.lineTo(cx + x * s, b - (50 + (x % 5) * 12 + 56) * s); } c.lineWidth = 1.4 * s; c.strokeStyle = '#6a6f78'; c.stroke();
    c.beginPath(); c.moveTo(cx - 24 * s, b); c.bezierCurveTo(cx - 10 * s, b - 20 * s, cx + 20 * s, b - 30 * s, cx + 4 * s, b - 60 * s); c.lineTo(cx + 14 * s, b - 60 * s); c.bezierCurveTo(cx + 34 * s, b - 30 * s, cx + 8 * s, b - 20 * s, cx + 34 * s, b); c.closePath(); fo(c, '#5fb2dc', 1.8 * s);
    ripples(c, cx + 4 * s, b - 14 * s, 50 * s, s, 2);
    for (let i = 0; i < 10; i++) paint.pine(c, cx + (i < 5 ? -220 + i * 22 : 110 + (i - 5) * 22) * s, b - (160 - (i % 3) * 12) * s, 12 * s, 28 * s, '#2f5a46', null, 0);
    for (let i = 0; i < 5; i++) paint.fern(c, cx + (-90 + i * 40) * s, b + 2 * s, 26 * s, '#3f8a4a', s * 0.8);
  },
  'table-rocks'(c, cx, b, s) {
    const lw = 2.4 * s;
    for (const [x, w, h, col] of [[-70, 200, 128, '#d6a070'], [140, 130, 92, '#cc9868']]) {
      c.beginPath(); c.moveTo(cx + (x - w / 2) * s, b - 14 * s); c.lineTo(cx + (x - w * 0.42) * s, b - h * 0.62 * s); c.lineTo(cx + (x - w * 0.36) * s, b - h * s); c.lineTo(cx + (x + w * 0.36) * s, b - h * s); c.lineTo(cx + (x + w * 0.44) * s, b - h * 0.6 * s); c.lineTo(cx + (x + w / 2) * s, b - 14 * s); c.closePath(); fo(c, col, lw);
      c.beginPath(); for (let i = 1; i < 4; i++) { const y = b - (14 + i * h * 0.2) * s; c.moveTo(cx + (x - w * 0.4) * s, y); c.lineTo(cx + (x + w * 0.4) * s, y); } c.lineWidth = 1.5 * s; c.strokeStyle = '#a8703e'; c.stroke();
      c.beginPath(); c.rect(cx + (x - w * 0.36) * s, b - (h + 6) * s, w * 0.72 * s, 8 * s); fo(c, '#7a9a4a', 1.6 * s);
      for (let i = 0; i < 5; i++) paint.pine(c, cx + (x - w * 0.3 + i * w * 0.15) * s, b - h * s, 7 * s, 15 * s, '#2f5a3a', null, 0);
    }
    c.beginPath(); c.moveTo(cx - 245 * s, b - 6 * s); c.bezierCurveTo(cx - 100 * s, b - 24 * s, cx + 100 * s, b + 4 * s, cx + 245 * s, b - 12 * s); c.lineTo(cx + 245 * s, b + 8 * s); c.bezierCurveTo(cx + 100 * s, b + 20 * s, cx - 100 * s, b - 4 * s, cx - 245 * s, b + 8 * s); c.closePath(); fo(c, '#4f9fd0', 1.8 * s);
    ripples(c, cx, b - 6 * s, 380 * s, s, 6);
  },
  'siskiyou-pass'(c, cx, b, s) {
    const lw = 2.2 * s;
    c.beginPath(); c.moveTo(cx - 245 * s, b); c.lineTo(cx - 200 * s, b - 150 * s); c.quadraticCurveTo(cx - 90 * s, b - 120 * s, cx - 30 * s, b - 54 * s); c.quadraticCurveTo(cx, b - 40 * s, cx + 30 * s, b - 54 * s); c.quadraticCurveTo(cx + 100 * s, b - 126 * s, cx + 205 * s, b - 160 * s); c.lineTo(cx + 245 * s, b); c.closePath(); fo(c, '#58885a', lw);
    c.beginPath(); c.ellipse(cx - 160 * s, b - 120 * s, 30 * s, 7 * s, 0.4, 0, TAU); c.ellipse(cx + 170 * s, b - 132 * s, 30 * s, 7 * s, -0.4, 0, TAU); c.fillStyle = '#f4f8ff'; c.fill();
    c.beginPath(); c.moveTo(cx - 30 * s, b + 2 * s); c.quadraticCurveTo(cx, b - 34 * s, cx + 8 * s, b - 56 * s); c.lineTo(cx + 24 * s, b - 56 * s); c.quadraticCurveTo(cx + 40 * s, b - 34 * s, cx + 36 * s, b + 2 * s); c.closePath(); c.fillStyle = '#d8bc88'; c.fill();
    for (let i = 0; i < 16; i++) { const x = cx + (-230 + i * 30) * s; if (Math.abs(x - cx) < 36 * s) continue; paint.pine(c, x, b + 2 * s - Math.max(0, 90 - Math.abs(x - cx) * 0.4) * s * 0.4, 20 * s, (46 + (i * 11) % 30) * s, '#2f5a3a', OUT, 1.4 * s); }
    post(c, cx - 70 * s, b - 30 * s, b - 122 * s, s); signBoard(c, cx - 70 * s, b - 124 * s, 84 * s, 20 * s, s, 'SISKIYOU');
  },
  'mount-shasta'(c, cx, b, s) {
    const lw = 2.4 * s;
    paint.peak(c, cx - 150 * s, b, 170 * s, 96 * s, '#8a9cc0', '#ffffff', OUT, lw);
    c.beginPath(); c.moveTo(cx - 20 * s, b); c.bezierCurveTo(cx + 20 * s, b - 90 * s, cx + 40 * s, b - 160 * s, cx + 92 * s, b - 214 * s); c.bezierCurveTo(cx + 150 * s, b - 160 * s, cx + 180 * s, b - 80 * s, cx + 230 * s, b); c.closePath(); fo(c, '#8fa0c4', lw);
    c.beginPath(); c.moveTo(cx + 92 * s, b - 214 * s); c.bezierCurveTo(cx + 60 * s, b - 170 * s, cx + 50 * s, b - 140 * s, cx + 52 * s, b - 124 * s); c.lineTo(cx + 66 * s, b - 134 * s); c.lineTo(cx + 78 * s, b - 120 * s); c.lineTo(cx + 92 * s, b - 140 * s); c.lineTo(cx + 108 * s, b - 118 * s); c.lineTo(cx + 124 * s, b - 134 * s); c.lineTo(cx + 140 * s, b - 120 * s); c.bezierCurveTo(cx + 130 * s, b - 160 * s, cx + 120 * s, b - 190 * s, cx + 92 * s, b - 214 * s); c.closePath(); fo(c, '#ffffff', 1.8 * s);
    c.beginPath(); c.moveTo(cx + 92 * s, b - 214 * s); c.bezierCurveTo(cx + 130 * s, b - 160 * s, cx + 160 * s, b - 90 * s, cx + 230 * s, b); c.lineTo(cx + 150 * s, b); c.bezierCurveTo(cx + 134 * s, b - 80 * s, cx + 112 * s, b - 150 * s, cx + 92 * s, b - 214 * s); c.fillStyle = 'rgba(40,60,110,0.16)'; c.fill();
    for (let i = 0; i < 16; i++) paint.pine(c, cx + (-236 + i * 31) * s, b + 2 * s, 22 * s, (46 + (i * 13) % 34) * s, '#2f5a3a', OUT, 1.4 * s);
  },
  'castle-crags'(c, cx, b, s) {
    const lw = 2.2 * s;
    for (const [x, w, h, col] of [[-170, 120, 120, '#b6b8c0'], [-90, 110, 190, '#c4c6ce'], [10, 130, 230, '#cdd0d8'], [110, 112, 180, '#bcbec8'], [190, 100, 130, '#b0b2bc']]) paint.spire(c, cx + x * s, b, w * s, h * s, col, OUT, lw);
    for (let i = 0; i < 18; i++) paint.pine(c, cx + (-236 + i * 27) * s, b + 3 * s, 20 * s, (42 + (i * 17) % 32) * s, '#2f5a3a', OUT, 1.4 * s);
  },
  'clear-creek'(c, cx, b, s) {
    const lw = 2.2 * s;
    c.beginPath(); c.moveTo(cx - 245 * s, b + 6 * s); c.bezierCurveTo(cx - 100 * s, b - 20 * s, cx + 100 * s, b - 14 * s, cx + 245 * s, b + 6 * s); c.lineTo(cx + 245 * s, b + 22 * s); c.bezierCurveTo(cx + 100 * s, b + 4 * s, cx - 100 * s, b + 8 * s, cx - 245 * s, b + 22 * s); c.closePath(); fo(c, '#5fb2dc', 1.8 * s);
    ripples(c, cx, b + 8 * s, 360 * s, s, 5);
    c.beginPath(); c.moveTo(cx - 200 * s, b - 4 * s); c.quadraticCurveTo(cx - 40 * s, b - 56 * s, cx + 140 * s, b - 8 * s); c.lineTo(cx + 120 * s, b + 4 * s); c.quadraticCurveTo(cx - 40 * s, b - 36 * s, cx - 180 * s, b + 4 * s); c.closePath(); fo(c, '#d8c9a4', lw); // the gravel bar
    c.beginPath(); for (let i = 0; i < 26; i++) { const x = cx + (-170 + i * 12) * s, y = b - (4 + Math.sin(i * 0.7) * 10 + 14) * s + (i % 3) * 3 * s; c.moveTo(x + 1.6 * s, y); c.ellipse(x, y, 1.8 * s, 1.1 * s, 0, 0, TAU); } c.fillStyle = '#a89878'; c.fill();
    paint.tent(c, cx - 150 * s, b - 22 * s, 66 * s, 46 * s, '#eadfc4', OUT, 1.8 * s); paint.tent(c, cx + 150 * s, b - 14 * s, 58 * s, 40 * s, '#e6d6b0', OUT, 1.8 * s);
    // two friendly miners with pans, one waving
    drawPerson(c, cx - 40 * s, b - 24 * s, s * 0.62, personLook('m1', '#b5543a', 'wide'), 0, 0, 0.2, 1);
    drawPerson(c, cx + 50 * s, b - 20 * s, s * 0.62, personLook('m2', '#4a6aa8', 'straw'), 0, 0, 0, -1);
    c.beginPath(); c.ellipse(cx + 28 * s, b - 24 * s, 18 * s, 6 * s, 0, 0, TAU); fo(c, '#8e969f', 1.6 * s); c.beginPath(); c.ellipse(cx + 28 * s, b - 25 * s, 12 * s, 3.6 * s, 0, 0, TAU); c.fillStyle = '#7b838d'; c.fill();
    drawFlake(c, cx + 24 * s, b - 25 * s, 3 * s, 0.7);
    for (let i = 0; i < 8; i++) drawFlake(c, cx + (-110 + i * 30) * s, b + (10 + (i % 3) * 4) * s, 2.4 * s, 0.5 + 0.5 * Math.sin(i * 2));
  },
  'adobe-fort'(c, cx, b, s) {
    const lw = 2.4 * s;
    adobeFort(c, cx, b, s, lw);
  },
  'coloma'(c, cx, b, s) {
    const lw = 2.2 * s;
    // the mill race: a wooden channel of water running from the right down past the mill
    c.beginPath(); c.moveTo(cx + 245 * s, b - 46 * s); c.lineTo(cx + 12 * s, b - 38 * s); c.lineTo(cx + 12 * s, b - 14 * s); c.lineTo(cx + 245 * s, b - 22 * s); c.closePath(); fo(c, '#5fb2dc', 1.8 * s); ripples(c, cx + 120 * s, b - 36 * s, 220 * s, s, 4);
    c.beginPath(); c.moveTo(cx + 12 * s, b - 38 * s); c.bezierCurveTo(cx + 30 * s, b - 20 * s, cx + 16 * s, b - 10 * s, cx + 20 * s, b + 4 * s); c.lineWidth = 12 * s; c.strokeStyle = '#4f9fd0'; c.stroke(); // the water falls to the wheel and the tailrace
    // the sawmill: a tall plank building on stilts over the water, a gable roof, a wheel at its side
    for (const x of [-96, -60, -24]) { c.beginPath(); c.rect(cx + x * s, b - 20 * s, 6 * s, 34 * s); fo(c, '#8a5a30', 1.6 * s); }
    c.beginPath(); c.rect(cx - 108 * s, b - 108 * s, 100 * s, 90 * s); fo(c, '#c8955a', lw); c.beginPath(); for (let x = cx - 100 * s; x < cx - 8 * s; x += 10 * s) { c.moveTo(x, b - 106 * s); c.lineTo(x, b - 20 * s); } c.lineWidth = 1.2 * s; c.strokeStyle = '#8a5a30'; c.stroke();
    c.beginPath(); c.moveTo(cx - 118 * s, b - 106 * s); c.lineTo(cx - 58 * s, b - 150 * s); c.lineTo(cx + 2 * s, b - 106 * s); c.closePath(); fo(c, '#7a4a30', lw);
    c.beginPath(); c.rect(cx - 90 * s, b - 80 * s, 24 * s, 24 * s); fo(c, '#fff1c2', 1.6 * s); c.beginPath(); c.rect(cx - 50 * s, b - 70 * s, 28 * s, 52 * s); fo(c, '#5a3a22', 1.6 * s);
    c.beginPath(); c.arc(cx + 12 * s, b - 20 * s, 30 * s, 0, TAU); c.lineWidth = 5 * s; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.6 * s; c.strokeStyle = '#a8703e'; c.stroke();
    c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8 + 0.3; c.moveTo(cx + 12 * s, b - 20 * s); c.lineTo(cx + 12 * s + Math.cos(a) * 30 * s, b - 20 * s + Math.sin(a) * 30 * s); } c.lineWidth = 3 * s; c.strokeStyle = '#8a5a30'; c.stroke();
    // the tailrace: the glint of gold in the water
    for (let i = 0; i < 7; i++) drawFlake(c, cx + (60 + i * 24) * s, b - 34 * s + (i % 2) * 8 * s, 3.4 * s, 0.4 + 0.5 * Math.sin(i * 1.7));
    for (const [x, h] of [[-200, 100], [-160, 80], [190, 96], [226, 70]]) paint.blobTree(c, cx + x * s, b - 6 * s, h * s, '#6a4a2a', '#4f7a3a', OUT, 1.8 * s);
  },
  'home-by-sea'(c, cx, b, s) {
    const lw = 2.4 * s;
    c.beginPath(); c.moveTo(cx - 245 * s, b - 24 * s); c.lineTo(cx + 245 * s, b - 24 * s); c.lineTo(cx + 245 * s, b + 10 * s); c.lineTo(cx - 245 * s, b + 10 * s); c.closePath(); fo(c, '#2f8fb8', 1.8 * s);
    ripples(c, cx, b - 14 * s, 460 * s, s, 7);
    schooner(c, cx, b - 6 * s, s, lw);
    for (const [x, y] of [[-170, -150], [170, -130], [130, -170]]) { c.beginPath(); c.moveTo(cx + (x - 8) * s, b + y * s); c.quadraticCurveTo(cx + (x - 3) * s, b + (y - 6) * s, cx + x * s, b + y * s); c.quadraticCurveTo(cx + (x + 3) * s, b + (y - 6) * s, cx + (x + 8) * s, b + y * s); c.lineWidth = 2 * s; c.strokeStyle = '#ffffff'; c.stroke(); }
  },
  'sacramento-claim'(c, cx, b, s, pal, h) {
    c.beginPath(); c.ellipse(cx, b - 4 * s, 240 * s, 16 * s, 0, 0, TAU); fo(c, '#d8b858', 2 * s);
    for (const [x, h] of [[-190, 120], [-130, 96], [150, 116], [200, 90]]) paint.oak(c, cx + x * s, b - 6 * s, h * s, '#5a3e26', '#4d6a2c', OUT, 1.8 * s);
    h.cabin(c, cx - 60 * s, b, s);
    c.beginPath(); c.rect(cx + 90 * s, b - 14 * s, 80 * s, 16 * s); c.fillStyle = '#7a5232'; c.fill(); c.beginPath(); for (let i = 0; i < 7; i++) { c.moveTo(cx + (96 + i * 11) * s + 3 * s, b - 8 * s); c.arc(cx + (96 + i * 11) * s, b - 8 * s, 3 * s, 0, TAU); } fo(c, '#5fae3e', 1 * s);
    grassTufts(c, cx, b + 2 * s, s, 14, 220, '#b89a38');
  },
};
// the schooner seen from the side (the voyage painting, and a ship on the far water)
export function schooner(c, cx, b, s, lw) {
  c.beginPath(); c.moveTo(cx - 110 * s, b - 24 * s); c.quadraticCurveTo(cx - 100 * s, b + 6 * s, cx - 60 * s, b + 8 * s); c.lineTo(cx + 70 * s, b + 8 * s); c.quadraticCurveTo(cx + 110 * s, b + 4 * s, cx + 126 * s, b - 28 * s); c.closePath(); fo(c, '#7a4a26', lw);
  c.beginPath(); c.moveTo(cx - 112 * s, b - 26 * s); c.lineTo(cx + 128 * s, b - 30 * s); c.lineWidth = 6 * s; c.strokeStyle = '#e8d8b0'; c.stroke();
  for (const [mx, mh, sail] of [[-34, 150, 1], [46, 130, 0.85]]) {
    c.beginPath(); c.moveTo(cx + mx * s, b - 28 * s); c.lineTo(cx + mx * s, b - mh * s); c.lineWidth = 5 * s; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.6 * s; c.strokeStyle = '#a8703e'; c.stroke();
    c.beginPath(); c.moveTo(cx + (mx + 3) * s, b - (mh - 6) * s); c.quadraticCurveTo(cx + (mx + 56 * sail) * s, b - (mh * 0.62) * s, cx + (mx + 50 * sail) * s, b - 36 * s); c.lineTo(cx + (mx + 3) * s, b - 34 * s); c.closePath(); fo(c, '#ffffff', lw);
    c.beginPath(); c.moveTo(cx + (mx - 3) * s, b - (mh - 14) * s); c.quadraticCurveTo(cx + (mx - 40 * sail) * s, b - (mh * 0.6) * s, cx + (mx - 36 * sail) * s, b - 38 * s); c.lineTo(cx + (mx - 3) * s, b - 36 * s); c.closePath(); fo(c, '#f8f0dc', lw);
  }
  c.beginPath(); c.moveTo(cx + 126 * s, b - 28 * s); c.lineTo(cx + 176 * s, b - 56 * s); c.lineTo(cx - 34 * s, b - 150 * s); c.lineWidth = 1.6 * s; c.strokeStyle = OUT; c.stroke();
  c.beginPath(); c.moveTo(cx + 46 * s, b - 130 * s); c.lineTo(cx + 46 * s, b - 146 * s); c.lineTo(cx + 70 * s, b - 140 * s); c.closePath(); fo(c, '#d9534f', 1.4 * s);
}
// Sutter's Fort (the painting; backdrops.js also builds the adobe fort for the stop): whitewashed walls, corner bastions, a central building
export function adobeFort(c, cx, b, s, lw) {
  const wall = '#f0e6cc', shd = '#d8cba8', roof = '#b86a46';
  c.beginPath(); c.rect(cx - 220 * s, b - 56 * s, 440 * s, 56 * s); fo(c, wall, lw);
  c.beginPath(); c.rect(cx + 110 * s, b - 56 * s, 110 * s, 56 * s); c.fillStyle = shd; c.fill();
  for (const x of [-220, 160]) { c.beginPath(); c.rect(cx + x * s, b - 94 * s, 60 * s, 94 * s); fo(c, wall, lw); c.beginPath(); c.moveTo(cx + (x - 5) * s, b - 94 * s); c.lineTo(cx + (x + 30) * s, b - 112 * s); c.lineTo(cx + (x + 65) * s, b - 94 * s); c.closePath(); fo(c, roof, lw); c.beginPath(); c.rect(cx + (x + 24) * s, b - 76 * s, 12 * s, 14 * s); c.fillStyle = '#3a2a22'; c.fill(); }
  c.beginPath(); c.rect(cx - 100 * s, b - 116 * s, 200 * s, 84 * s); fo(c, wall, lw);   // the central building
  c.beginPath(); c.moveTo(cx - 110 * s, b - 116 * s); c.lineTo(cx - 80 * s, b - 134 * s); c.lineTo(cx + 80 * s, b - 134 * s); c.lineTo(cx + 110 * s, b - 116 * s); c.closePath(); fo(c, roof, lw);
  for (let i = 0; i < 5; i++) { c.beginPath(); c.rect(cx + (-84 + i * 36) * s, b - 100 * s, 14 * s, 20 * s); fo(c, '#3a2a22', 1.4 * s); }
  c.beginPath(); c.moveTo(cx, b - 134 * s); c.lineTo(cx, b - 176 * s); c.lineWidth = 3 * s; c.strokeStyle = OUT; c.stroke(); c.beginPath(); c.moveTo(cx, b - 176 * s); c.lineTo(cx + 34 * s, b - 168 * s); c.lineTo(cx, b - 158 * s); c.closePath(); fo(c, '#3f6fb5', 1.4 * s); c.beginPath(); c.rect(cx, b - 176 * s, 14 * s, 9 * s); c.fillStyle = '#ffffff'; c.fill();
  c.beginPath(); c.moveTo(cx - 30 * s, b); c.lineTo(cx - 30 * s, b - 34 * s); c.arc(cx, b - 34 * s, 30 * s, Math.PI, 0); c.lineTo(cx + 30 * s, b); c.closePath(); fo(c, '#5a3a22', 1.8 * s);
  c.beginPath(); for (let x = -210; x < 210; x += 22) { c.moveTo(cx + x * s, b - 56 * s); c.lineTo(cx + x * s, b - 62 * s); } c.lineWidth = 8 * s; c.strokeStyle = wall; c.stroke();
}

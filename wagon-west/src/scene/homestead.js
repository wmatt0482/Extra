// Wagon West the homestead scene (SPEC v1.5 §4.4, scene stream): the farm a child's wagons build, drawn from `homesteadView` pieces. Both
// sites (the Willamette farm on the valley layers, the Sacramento claim on the goldcountry layers) share the layout: a back row (the
// schoolhouse, the orchard or vineyard, the barn, the house, the mill by the creek), a middle row (the well, flowers, the pasture) and a front
// row (the garden, the coop, the gate with its name plate). Nothing here ever looks worn, broken or empty: a farm left alone for a month is
// drawn exactly as it was.
//
//   scene.setBackdrop('homestead'); scene.setHomestead({ site, name, pieces: { id: count }, animals: { oxen, mules }, dog, decor: [ids],
//     party: [{ id, hat, color }], trophies: ['bronze', …] })            (every call replaces the whole farm; unknown ids are ignored)
//   scene.buildPiece(id)   the raising: a frame goes up in three beats while the companions hammer (the barn, the cabin, the frame house, the
//     schoolhouse, the mill), then a cheer and confetti; small pieces pop in with a puff → { type: 'buildDone', id }. It works in either order:
//     before setHomestead (the scene adds the piece itself) or after it (the new count is the one raised).
//   events: { type: 'homesteadTap', slot, piece | null }   a tap (not a drag) on the farm: the slot under the finger and its top piece
// The farm is wider than a phone in portrait: a drag pans it (the parallax follows); a tap is a tap.
import { TAU, OUT, mulberry32, hashStr, clamp, lerp, ease, shade, mkCanvas, rrect, drawText } from './util.js';
import { cabin, barn } from './backdrops.js';
import { drawPerson, drawDog, drawWagon, drawAnimal, drawCampfire } from './sprites.js';
import { drawDecor } from './sprites15.js';
import { outfitHat, outfitOf } from './looks16.js';

// the content's HOMESTEAD_PIECES slots, kept here so the scene needs no content import (the smoke test checks them against content)
export const PIECE_SLOT = {
  cabin: 'house', 'trophy-shelf': 'house', 'name-plate': 'gate', well: 'yard', fence: 'pasture', corral: 'pasture', cow: 'pasture', garden: 'garden', flowers: 'yard',
  mailbox: 'gate', bench: 'house', coop: 'yard', 'apple-tree': 'orchard', barn: 'barn', orchard: 'orchard', 'frame-house': 'house', mill: 'creek', vineyard: 'orchard',
  windmill: 'yard', schoolhouse: 'edge',
};
export const PIECE_MAX = { 'apple-tree': 6, garden: 4, flowers: 3 };
export const HOME_SLOTS = ['edge', 'orchard', 'barn', 'house', 'yard', 'garden', 'creek', 'pasture', 'gate'];
const SLOT_ROW = { edge: 0, orchard: 0, barn: 0, house: 0, creek: 0, yard: 1, pasture: 1, garden: 1, gate: 1 }; // 0 = the back row, 1 = the front
const SLOT_X = { edge: 72, orchard: 268, barn: 440, house: 600, creek: 868, yard: 470, garden: 230, pasture: 742, gate: 985 };
const TAP_ORDER = { house: ['frame-house', 'cabin', 'bench', 'trophy-shelf'], yard: ['windmill', 'well', 'coop', 'flowers'], gate: ['name-plate', 'mailbox'], pasture: ['cow', 'corral', 'fence'],
  orchard: ['orchard', 'vineyard', 'apple-tree'], garden: ['garden'], barn: ['barn'], creek: ['mill'], edge: ['schoolhouse'] };
export const FRAME_PIECES = new Set(['cabin', 'frame-house', 'barn', 'schoolhouse', 'mill']);
export const BUILD = { beat: 0.75, beats: 3, pop: 0.7, linger: 0.6 };
const WORLD_W = 1060;
const CREEK_X = 880, DOOR_X = 600, BARN_X = 440, GATE_X = 985;
const TROPHY = { bronze: '#c8803a', silver: '#c9ced6', gold: '#f3c623' };

// ---------------------------------------------------------------- the pieces (unit space: x centred on the anchor, y up is negative, the base at y 0)
const O = (c, fill, lw = 2.2) => { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke(); };
function drawCabin(c) { cabin(c, -65, 0, 1); }
function drawFrameHouse(c) {
  c.beginPath(); c.rect(50, -150, 16, 52); O(c, '#a8573a');                                  // brick chimney
  c.beginPath(); c.rect(-82, -80, 164, 80); O(c, '#f6f0e0');                                  // white clapboard
  c.beginPath(); for (let y = -74; y < 0; y += 7) { c.moveTo(-82, y); c.lineTo(82, y); } c.lineWidth = 1; c.strokeStyle = '#d8cfb8'; c.stroke();
  c.beginPath(); c.moveTo(-94, -78); c.lineTo(0, -148); c.lineTo(94, -78); c.closePath(); O(c, '#9a3f2e');   // the gable roof
  c.beginPath(); for (let i = 1; i < 5; i++) { const t = i / 5; c.moveTo(-94 + 94 * t, -78 - 70 * t); c.lineTo(94 - 94 * t, -78 - 70 * t); } c.lineWidth = 1.4; c.strokeStyle = '#6e2a1e'; c.stroke();
  c.beginPath(); c.arc(0, -104, 11, 0, TAU); O(c, '#bfe3f0'); c.beginPath(); c.moveTo(-11, -104); c.lineTo(11, -104); c.moveTo(0, -115); c.lineTo(0, -93); c.lineWidth = 1.6; c.stroke();
  for (const wx of [-64, 40]) { c.beginPath(); c.rect(wx, -64, 24, 28); O(c, '#bfe3f0', 2); c.beginPath(); c.moveTo(wx + 12, -64); c.lineTo(wx + 12, -36); c.moveTo(wx, -50); c.lineTo(wx + 24, -50); c.lineWidth = 1.6; c.stroke();
    c.beginPath(); c.rect(wx - 7, -64, 7, 28); c.rect(wx + 24, -64, 7, 28); O(c, '#4f8a4b', 1.6); }
  c.beginPath(); c.rect(-15, -46, 30, 46); O(c, '#c0473a'); c.beginPath(); c.arc(9, -22, 2.4, 0, TAU); c.fillStyle = '#f0c040'; c.fill();
  c.beginPath(); c.moveTo(-34, -50); c.lineTo(34, -50); c.lineTo(40, -42); c.lineTo(-40, -42); c.closePath(); O(c, '#8a5a30', 1.8);  // the porch roof
  for (const px of [-36, 36]) { c.beginPath(); c.moveTo(px, -42); c.lineTo(px, 0); c.lineWidth = 4; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke(); }
  c.beginPath(); c.rect(-44, -2, 88, 5); O(c, '#c8b898', 1.6);
}
function drawBarn(c) { barn(c, -60, 0, 1.25); }
function drawSchool(c) {
  c.beginPath(); c.rect(-52, -58, 104, 58); O(c, '#f3ead6'); c.beginPath(); for (let y = -52; y < 0; y += 7) { c.moveTo(-52, y); c.lineTo(52, y); } c.lineWidth = 1; c.strokeStyle = '#d6cbb0'; c.stroke();
  c.beginPath(); c.moveTo(-62, -56); c.lineTo(0, -98); c.lineTo(62, -56); c.closePath(); O(c, '#8a3b2b');
  c.beginPath(); c.rect(-9, -124, 18, 28); O(c, '#f3ead6', 2); c.beginPath(); c.moveTo(-12, -124); c.lineTo(0, -138); c.lineTo(12, -124); c.closePath(); O(c, '#8a3b2b', 2);
  c.beginPath(); c.arc(0, -112, 5, 0, TAU); O(c, '#e0b84a', 1.6);
  c.beginPath(); c.rect(-11, -36, 22, 36); O(c, '#6a3a22'); for (const wx of [-42, 22]) { c.beginPath(); c.rect(wx, -46, 20, 22); O(c, '#bfe3f0', 1.8); c.beginPath(); c.moveTo(wx + 10, -46); c.lineTo(wx + 10, -24); c.moveTo(wx, -35); c.lineTo(wx + 20, -35); c.lineWidth = 1.4; c.stroke(); }
  c.beginPath(); c.moveTo(70, 0); c.lineTo(70, -86); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke(); c.beginPath(); c.moveTo(70, -86); c.lineTo(94, -80); c.lineTo(70, -72); c.closePath(); O(c, '#d9534f', 1.4);
}
function drawWell(c) {
  c.beginPath(); rrect(c, -19, -27, 38, 27, 4); O(c, '#aaa69e'); c.beginPath(); for (let i = 0; i < 3; i++) { c.moveTo(-19, -9 * (i + 1)); c.lineTo(19, -9 * (i + 1)); } c.moveTo(-6, -27); c.lineTo(-6, -18); c.moveTo(8, -18); c.lineTo(8, -9); c.moveTo(-8, -9); c.lineTo(-8, 0); c.lineWidth = 1.2; c.strokeStyle = '#6a665e'; c.stroke();
  c.beginPath(); c.ellipse(0, -27, 19, 6, 0, 0, TAU); O(c, '#5a564e', 2); c.beginPath(); c.ellipse(0, -26, 12, 3, 0, 0, TAU); c.fillStyle = '#3f86b8'; c.fill();
  for (const px of [-17, 17]) { c.beginPath(); c.moveTo(px, -27); c.lineTo(px, -66); c.lineWidth = 5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.6; c.strokeStyle = '#a8703e'; c.stroke(); }
  c.beginPath(); c.moveTo(-28, -62); c.lineTo(0, -82); c.lineTo(28, -62); c.closePath(); O(c, '#8a5a30', 2);
  c.beginPath(); c.moveTo(0, -64); c.lineTo(0, -44); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke(); c.beginPath(); rrect(c, -6, -46, 12, 11, 3); O(c, '#9a6a3c', 1.6);
}
function drawGardenRow(c, i) {
  c.beginPath(); c.rect(-62, -12, 124, 14); c.fillStyle = '#7a5232'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
  c.beginPath(); for (let x = -56; x < 60; x += 6) { c.moveTo(x, -8); c.lineTo(x + 2, 0); } c.lineWidth = 1; c.strokeStyle = '#5a3a20'; c.stroke();
  const kinds = ['carrot', 'cabbage', 'corn', 'pumpkin'], kd = kinds[i % 4];
  for (let x = -54; x <= 54; x += 14) {
    if (kd === 'carrot') { c.beginPath(); c.moveTo(x, -10); for (let l = -1; l <= 1; l++) c.lineTo(x + l * 5, -22 + Math.abs(l) * 4), c.lineTo(x, -10); c.fillStyle = '#4fae3e'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = '#2f6a1e'; c.stroke(); c.beginPath(); c.rect(x - 2, -12, 4, 3); c.fillStyle = '#f08a2a'; c.fill(); }
    else if (kd === 'cabbage') { c.beginPath(); c.arc(x, -9, 7, 0, TAU); O(c, '#9ad07a', 1.4); c.beginPath(); c.arc(x, -9, 3.4, 0, TAU); c.fillStyle = '#c8e6a8'; c.fill(); }
    else if (kd === 'corn') { c.beginPath(); c.moveTo(x, -4); c.lineTo(x, -34); c.lineWidth = 2.6; c.strokeStyle = '#5a8a2a'; c.stroke(); c.beginPath(); c.moveTo(x, -22); c.lineTo(x - 9, -30); c.moveTo(x, -17); c.lineTo(x + 9, -26); c.lineWidth = 2; c.stroke(); c.beginPath(); c.ellipse(x + 3, -24, 2.4, 6, 0.2, 0, TAU); c.fillStyle = '#f3c623'; c.fill(); }
    else { c.beginPath(); c.arc(x, -8, 7, 0, TAU); O(c, '#f08a2a', 1.4); c.beginPath(); c.moveTo(x - 2, -15); c.lineTo(x - 5, -21); c.lineWidth = 2; c.strokeStyle = '#4f8a2a'; c.stroke(); }
  }
}
function drawFlowers(c, i) {
  c.beginPath(); c.ellipse(0, 0, 22, 7, 0, 0, TAU); O(c, '#7a5232', 1.6);
  const cols = [['#ff7aa8', '#ffd23f', '#ffffff'], ['#ffd23f', '#ff8a3a', '#c070f0'], ['#e8504a', '#ffffff', '#ffd23f']][i % 3];
  for (let n = 0; n < 7; n++) { const x = -17 + n * 5.7, y = -2 - ((n * 5) % 4) * 3; c.beginPath(); c.moveTo(x, -1); c.lineTo(x, y - 8); c.lineWidth = 1.6; c.strokeStyle = '#3f8a3a'; c.stroke(); c.beginPath(); c.arc(x, y - 10, 4, 0, TAU); O(c, cols[n % 3], 1.2); c.beginPath(); c.arc(x, y - 10, 1.4, 0, TAU); c.fillStyle = '#7a4a1a'; c.fill(); }
}
function drawMailbox(c) {
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -34); c.lineWidth = 5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.6; c.strokeStyle = '#8a5a30'; c.stroke();
  c.beginPath(); rrect(c, -13, -50, 28, 18, 8); O(c, '#3f6fb5', 2); c.beginPath(); c.rect(-13, -41, 6, 9); c.fillStyle = '#2a4a85'; c.fill();
  c.beginPath(); c.moveTo(14, -48); c.lineTo(14, -62); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke(); c.beginPath(); c.rect(14, -64, 10, 7); O(c, '#d9534f', 1.4);
}
function drawBench(c) {
  c.beginPath(); c.rect(-22, -18, 44, 5); O(c, '#b98a54', 1.6); c.beginPath(); c.rect(-22, -30, 44, 4); O(c, '#b98a54', 1.6);
  for (const x of [-19, 17]) { c.beginPath(); c.moveTo(x, -30); c.lineTo(x, 0); c.lineWidth = 4; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2; c.strokeStyle = '#8a5a30'; c.stroke(); }
}
function drawCoop(c) {
  c.beginPath(); c.moveTo(-26, 0); c.lineTo(-26, -34); c.lineTo(0, -52); c.lineTo(26, -34); c.lineTo(26, 0); c.closePath(); O(c, '#c0473a');
  c.beginPath(); c.moveTo(-30, -33); c.lineTo(0, -54); c.lineTo(30, -33); c.lineWidth = 4; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2; c.strokeStyle = '#8a3b2b'; c.stroke();
  c.beginPath(); c.arc(0, -22, 7, Math.PI, 0); c.lineTo(7, 0); c.lineTo(-7, 0); c.closePath(); O(c, '#3a2618', 1.8);
  c.beginPath(); c.moveTo(-7, 0); c.lineTo(-20, 8); c.lineTo(-6, 8); c.closePath(); O(c, '#b98a54', 1.4);
  c.beginPath(); c.moveTo(-26, -8); c.lineTo(-44, -8); c.lineTo(-44, 0); c.moveTo(-26, 0); c.lineTo(-44, 0); c.lineWidth = 2; c.strokeStyle = '#7a4a26'; c.stroke();
}
function drawAppleTree(c, i) {
  const h = 62 + (i % 3) * 5;
  c.beginPath(); c.moveTo(-4, 0); c.lineTo(-3, -h * 0.45); c.lineTo(3, -h * 0.45); c.lineTo(4, 0); c.closePath(); O(c, '#7a5232', 1.8);
  c.beginPath(); c.moveTo(24, -h * 0.74); c.ellipse(0, -h * 0.74, 24, 20, 0, 0, TAU); c.moveTo(-10 + 15, -h * 0.98); c.arc(-10, -h * 0.98, 15, 0, TAU); c.moveTo(12 + 14, -h * 0.94); c.arc(12, -h * 0.94, 14, 0, TAU); O(c, '#58a83e', 2);
  c.beginPath(); c.arc(-8, -h * 1.06, 6, 0, TAU); c.fillStyle = '#7cc45a'; c.fill();
  const ap = [[-12, -0.78], [8, -0.7], [-2, -0.96], [14, -0.9], [-16, -0.95]];
  c.beginPath(); for (const [ax, ay] of ap) { c.moveTo(ax + 3.2, ay * h); c.arc(ax, ay * h, 3.2, 0, TAU); } O(c, '#e8504a', 1);
}
function drawOrchardRows(c) { // behind and in front of the three apple trees: more trees, apples and pears, baskets of fruit
  const rows = [[-24, 0.86, 7], [26, 0.92, 6]];
  for (const [dy, sc, n] of rows) for (let j = 0; j < n; j++) {
    c.save(); c.translate(-95 + j * 41 + (dy < 0 ? 0 : 16), dy); c.scale(sc, sc);
    const pear = (j + (dy < 0 ? 0 : 1)) % 2 === 1, h = 58;
    c.beginPath(); c.moveTo(-4, 0); c.lineTo(-3, -h * 0.45); c.lineTo(3, -h * 0.45); c.lineTo(4, 0); c.closePath(); O(c, '#7a5232', 1.8);
    c.beginPath(); c.moveTo(22, -h * 0.74); c.ellipse(0, -h * 0.74, 22, 19, 0, 0, TAU); c.moveTo(-8 + 14, -h * 0.98); c.arc(-8, -h * 0.98, 14, 0, TAU); O(c, pear ? '#6cb04a' : '#58a83e', 2);
    c.beginPath(); for (const [ax, ay] of [[-10, -0.78], [9, -0.74], [0, -0.96]]) { c.moveTo(ax + 3, ay * h); c.arc(ax, ay * h, 3, 0, TAU); } O(c, pear ? '#d8d84a' : '#e8504a', 1);
    c.restore();
  }
  c.beginPath(); rrect(c, 96, 8, 22, 13, 4); O(c, '#c8955a', 1.6); c.beginPath(); for (let a = 0; a < 4; a++) { c.moveTo(101 + a * 5 + 3, 7); c.arc(101 + a * 5, 7, 3, 0, TAU); } O(c, '#e8504a', 1);
}
function drawVineyard(c) {
  for (let r = 0; r < 3; r++) {
    const y = -10 + r * 22;
    c.beginPath(); for (let x = -100; x <= 100; x += 40) { c.moveTo(x, y); c.lineTo(x, y - 30); } c.lineWidth = 5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.6; c.strokeStyle = '#a8703e'; c.stroke();
    c.beginPath(); c.moveTo(-104, y - 24); c.lineTo(104, y - 24); c.moveTo(-104, y - 12); c.lineTo(104, y - 12); c.lineWidth = 1.2; c.strokeStyle = '#4a4a52'; c.stroke();
    for (let x = -90; x <= 90; x += 20) { c.beginPath(); c.ellipse(x, y - 17, 10, 13, 0, 0, TAU); O(c, '#58a83e', 1.4); c.beginPath(); for (let g = 0; g < 4; g++) { c.moveTo(x + (g % 2) * 5 - 2 + 2.6, y - 6 + (g >> 1) * 5); c.arc(x + (g % 2) * 5 - 2, y - 6 + (g >> 1) * 5, 2.6, 0, TAU); } O(c, '#6a2a8a', 1); }
  }
}
function drawMill(c) { // the body (the wheel turns in the dynamic layer)
  c.beginPath(); c.moveTo(-34, 0); c.lineTo(-30, -66); c.lineTo(30, -66); c.lineTo(34, 0); c.closePath(); O(c, '#d8c8a0');
  c.beginPath(); for (let y = -58; y < 0; y += 9) { c.moveTo(-32, y); c.lineTo(32, y); } c.lineWidth = 1.1; c.strokeStyle = '#a89870'; c.stroke();
  c.beginPath(); c.moveTo(-42, -64); c.lineTo(0, -98); c.lineTo(42, -64); c.closePath(); O(c, '#8a5a30');
  c.beginPath(); c.rect(-9, -34, 18, 34); O(c, '#5a3a22', 1.8); c.beginPath(); c.rect(-8, -56, 16, 14); O(c, '#bfe3f0', 1.6);
  c.beginPath(); c.rect(18, -52, 8, 10); O(c, '#5a3a22', 1.4);
  c.beginPath(); c.moveTo(34, -8); c.lineTo(52, -8); c.lineWidth = 5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.6; c.strokeStyle = '#8a5a30'; c.stroke();
}
function drawWindmillBody(c) {
  c.beginPath(); c.moveTo(-18, 0); c.lineTo(-6, -92); c.lineTo(6, -92); c.lineTo(18, 0); c.lineWidth = 5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.6; c.strokeStyle = '#b0b6bd'; c.stroke();
  c.beginPath(); for (let i = 1; i < 5; i++) { const y = -i * 20, w = 18 - (i * 12) / 5 * 0.9; c.moveTo(-w, y); c.lineTo(w, y); c.moveTo(-w, y); c.lineTo(w * 0.7, y - 20); } c.lineWidth = 1.6; c.strokeStyle = '#8a9098'; c.stroke();
  c.beginPath(); c.rect(-8, -98, 16, 8); O(c, '#6a737c', 1.6);
  c.beginPath(); c.moveTo(8, -94); c.lineTo(34, -94); c.lineTo(34, -88); c.lineTo(28, -88); c.lineTo(28, -90); c.lineTo(8, -90); c.closePath(); O(c, '#d9534f', 1.4); // the tail vane
}
function drawFence(c) { // a split-rail fence round the pasture (a pen 190 wide, the back, the left side and the right side; the front is open at the gate)
  const post = (x, y, h) => { c.moveTo(x, y); c.lineTo(x, y - h); };
  c.beginPath(); for (let x = -95; x <= 95; x += 24) post(x, 0, 22);
  c.lineWidth = 5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.8; c.strokeStyle = '#a8703e'; c.stroke();
  c.beginPath(); c.moveTo(-97, -17); c.lineTo(97, -17); c.moveTo(-97, -8); c.lineTo(97, -8); c.lineWidth = 5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.8; c.strokeStyle = '#c28a52'; c.stroke();
  for (const sx of [-95, 95]) { c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx, 64); c.moveTo(sx, 0); c.lineTo(sx, 64); c.lineWidth = 0.1; c.stroke(); c.beginPath(); post(sx, 28, 18); post(sx, 56, 24); c.lineWidth = 5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.8; c.strokeStyle = '#a8703e'; c.stroke();
    c.beginPath(); c.moveTo(sx, 4); c.lineTo(sx, 58); c.lineWidth = 4; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2; c.strokeStyle = '#c28a52'; c.stroke(); }
}
function drawCorral(c) { // the team's own round pen in the front of the pasture (the front rail is drawn after the animals)
  c.beginPath(); c.ellipse(0, 0, 66, 22, 0, Math.PI, TAU); c.lineWidth = 6; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.2; c.strokeStyle = '#c28a52'; c.stroke();
  c.beginPath(); c.ellipse(0, -10, 66, 22, 0, Math.PI, TAU); c.lineWidth = 6; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.2; c.strokeStyle = '#c28a52'; c.stroke();
  for (let a = Math.PI; a <= TAU + 0.01; a += Math.PI / 7) { c.beginPath(); c.moveTo(Math.cos(a) * 66, Math.sin(a) * 22); c.lineTo(Math.cos(a) * 66, Math.sin(a) * 22 - 18); c.lineWidth = 5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.8; c.strokeStyle = '#a8703e'; c.stroke(); }
}
function drawNamePlate(c, i, ctx) {
  for (const px of [-48, 48]) { c.beginPath(); c.moveTo(px, 0); c.lineTo(px, -66); c.lineWidth = 9; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 5.4; c.strokeStyle = '#a8703e'; c.stroke(); c.beginPath(); c.arc(px, -68, 5, 0, TAU); O(c, '#c28a52', 1.6); }
  c.beginPath(); c.moveTo(-50, -62); c.quadraticCurveTo(0, -96, 50, -62); c.lineWidth = 5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.4; c.strokeStyle = '#8a5a30'; c.stroke();
  c.beginPath(); rrect(c, -44, -80, 88, 22, 6); O(c, '#f4ead0', 2);
  if (ctx.name) drawText(c, ctx.name.toUpperCase(), 11, 0, -69, '#6a2a1a', null, 80);
  c.beginPath(); c.moveTo(-6, -58); c.lineTo(-6, -52); c.moveTo(6, -58); c.lineTo(6, -52); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
}
function drawTrophyShelf(c, i, ctx) { // on the porch wall: a shelf with the plates
  c.beginPath(); c.rect(-30, -4, 60, 5); O(c, '#8a5a30', 1.6);
  const tr = ctx.trophies;
  for (let i = 0; i < Math.min(6, Math.max(tr.length, 1)); i++) {
    const x = -24 + i * 10, col = TROPHY[tr[i]] || '#f3c623';
    c.beginPath(); c.ellipse(x, -12, 4.6, 6.4, 0, 0, TAU); O(c, col, 1.3); c.beginPath(); c.ellipse(x, -12, 2.4, 3.6, 0, 0, TAU); c.strokeStyle = shade(col, -0.3); c.lineWidth = 1; c.stroke();
    c.beginPath(); c.rect(x - 2.6, -5, 5.2, 2); c.fillStyle = '#6a3f22'; c.fill();
  }
}
function drawTent(c) {
  c.beginPath(); c.moveTo(-40, 0); c.lineTo(0, -52); c.lineTo(40, 0); c.closePath(); O(c, '#efe4c8', 2.2);
  c.beginPath(); c.moveTo(0, -52); c.lineTo(-13, 0); c.lineTo(13, 0); c.closePath(); O(c, '#5a4a3a', 1.8);
  c.beginPath(); c.moveTo(0, -52); c.lineTo(0, -62); c.lineWidth = 2.6; c.strokeStyle = OUT; c.stroke();
}

// where each piece stands: [x (world units), row (0 back, 1 front), dy (units)], and its bounding box [w, h] for the raising sprite
const PIECES = {
  schoolhouse: { at: () => [72, 0, -2], box: [150, 150], draw: drawSchool },
  orchard: { at: () => [270, 0, 0], box: [260, 120], draw: drawOrchardRows, back: true },
  vineyard: { at: () => [270, 0, 14], box: [240, 70], draw: drawVineyard },
  'apple-tree': { at: (i) => [186 + i * 35, 0, i % 2 ? 8 : -2], box: [70, 90], draw: drawAppleTree },
  barn: { at: () => [BARN_X, 0, 0], box: [160, 130], draw: drawBarn },
  mill: { at: () => [848, 0, 2], box: [130, 120], draw: drawMill },
  windmill: { at: () => [418, 1, -6], box: [90, 120], draw: drawWindmillBody },
  cabin: { at: () => [DOOR_X, 0, 0], box: [190, 150], draw: drawCabin },
  'frame-house': { at: () => [DOOR_X, 0, 0], box: [220, 170], draw: drawFrameHouse },
  bench: { at: () => [DOOR_X - 66, 0, 8], box: [60, 40], draw: drawBench },
  'trophy-shelf': { at: () => [DOOR_X + 62, 0, -34], box: [80, 40], draw: drawTrophyShelf },
  flowers: { at: (i) => [DOOR_X - 38 + i * 46, 1, -24], box: [70, 50], draw: drawFlowers },
  well: { at: () => [508, 1, -18], box: [80, 100], draw: drawWell },
  garden: { at: (i) => [232, 1, 8 + i * 15], box: [150, 50], draw: drawGardenRow },
  coop: { at: () => [344, 1, 4], box: [110, 70], draw: drawCoop },
  fence: { at: () => [742, 1, -14], box: [220, 90], draw: drawFence },
  corral: { at: () => [730, 1, 44], box: [150, 70], draw: drawCorral },
  mailbox: { at: () => [930, 1, 8], box: [50, 80], draw: drawMailbox },
  'name-plate': { at: () => [GATE_X, 1, 12], box: [140, 110], draw: drawNamePlate },
};
const STATIC_ORDER = ['schoolhouse', 'orchard', 'vineyard', 'apple-tree', 'barn', 'mill', 'cabin', 'frame-house', 'windmill', 'bench', 'trophy-shelf', 'flowers', 'well', 'garden', 'coop', 'fence', 'corral', 'mailbox', 'name-plate'];

// ---------------------------------------------------------------- the farm object
export function createHome(S, emit, hooks) {
  const H = {
    active: false, site: 'willamette', name: '', pieces: {}, prev: {}, animals: { oxen: 0, mules: 0 }, dog: null, decor: [], party: null, trophies: [],
    cam: 0, camT: null, drag: null, anim: null, static: null, staticKey: '', sprites: new Map(), t: 0, texts: [], pops: [], geoKey: '', geo: null, tapMoved: 0, built: 0,
    chickens: [], rand: mulberry32(11),
  };
  const biome = () => (H.site === 'sacramento' ? 'goldcountry' : 'valley');
  H.biome = biome;

  H.set = (o = {}) => {
    H.prev = { ...H.pieces };
    H.site = o.site === 'sacramento' ? 'sacramento' : 'willamette';
    H.name = String(o.name || '').trim().slice(0, 24);
    const pcs = {};
    for (const [id, n] of Object.entries(o.pieces || {})) if (PIECES[id] || id === 'cow') { const mx = PIECE_MAX[id] || 1; const v = clamp(Math.floor(+n || 0), 0, mx); if (v) pcs[id] = v; }
    H.pieces = pcs;
    const a = o.animals || {};
    H.animals = { oxen: clamp(Math.floor(+a.oxen || 0), 0, 8), mules: clamp(Math.floor(+a.mules || 0), 0, 8) };
    H.dog = o.dog && typeof o.dog === 'object' ? { name: String(o.dog.name || ''), coat: ['brown', 'spotted', 'black'].includes(o.dog.coat) ? o.dog.coat : 'brown' } : null;
    H.decor = Array.isArray(o.decor) ? o.decor.slice(0, 2).map(String) : [];
    H.party = Array.isArray(o.party) && o.party.length ? o.party.slice(0, 3) : null;
    H.trophies = Array.isArray(o.trophies) ? o.trophies.map(String).slice(0, 6) : [];
    H.staticKey = '';
    if (H.anim && (H.pieces[H.anim.id] | 0) < H.anim.n) H.anim = null; // the farm changed under a raising: no longer there
  };
  // the raising: returns false for an unknown piece or one already at its most
  H.build = (id) => {
    id = String(id || '');
    if (!PIECES[id] && id !== 'cow') return false;
    const mx = PIECE_MAX[id] || 1;
    let n;
    if ((H.prev[id] | 0) < (H.pieces[id] | 0)) n = H.pieces[id] | 0;   // the app set the farm first: raise the newest one
    else { n = (H.pieces[id] | 0) + 1; if (n > mx) return false; H.pieces = { ...H.pieces, [id]: n }; H.staticKey = ''; }
    H.prev = { ...H.pieces };                 // this raising is taken: the next call counts up from here
    if (H.anim) finishAnim(false);
    H.anim = { id, n, t: 0, big: FRAME_PIECES.has(id), dur: FRAME_PIECES.has(id) ? BUILD.beat * BUILD.beats + BUILD.linger : BUILD.pop };
    H.staticKey = '';
    if (S.L) { const x = pieceXY(S.L, id, n - 1); H.camT = clamp(x.x - S.L.W / 2, 0, Math.max(0, geoOf(S.L).camMax)); }
    return true;
  };
  function finishAnim(emitDone = true) {
    const a = H.anim; if (!a) return;
    H.anim = null; H.staticKey = ''; H.built++;
    const g = S.L && geoOf(S.L), p = S.L ? pieceXY(S.L, a.id, a.n - 1) : null;
    if (emitDone) {
      if (hooks && p && S.L) { if (a.big) hooks.celebrate('arrived'); else hooks.celebrate('star', p.x - H.cam, p.y - 50 * g.u); }
      emit({ type: 'buildDone', id: a.id });
    }
  }

  // ---- geometry
  function geoOf(L) {
    const key = L.W + 'x' + L.H;
    if (H.geoKey === key && H.geo) return H.geo;
    const portrait = L.H > L.W * 1.25;
    const u = portrait ? clamp(L.H / 760, 0.85, 1.25) : clamp(Math.min(L.W / WORLD_W, L.H / 430), 0.8, 1.45);
    const Wd = Math.max(L.W, WORLD_W * u);
    H.geo = { u, Wd, camMax: Wd - L.W, yb: L.H * 0.7, ym: L.H * 0.79, yf: L.H * 0.9, off: Wd > L.W ? 0 : (L.W - Wd) / 2 };
    H.geoKey = key;
    return H.geo;
  }
  H.geoOf = geoOf;
  function pieceXY(L, id, i) {
    const g = geoOf(L), [x, row, dy] = PIECES[id] ? PIECES[id].at(i) : [SLOT_X.pasture, 1, 0];
    return { x: x * g.u + g.off, y: (row ? g.ym : g.yb) + dy * g.u };
  }
  H.activeAt = (L) => geoOf(L).camMax > 0;

  // ---- the static picture: the ground and every piece but the one being raised (painted once per farm and size)
  function paintGround(c, L, g) {
    const { u } = g, pal = H.site === 'sacramento' ? { g0: '#c9b25e', g1: '#b9a24e', dirt: '#d9a468', edge: '#8a7a30' } : { g0: '#8cc256', g1: '#7ab04a', dirt: '#cfa66a', edge: '#4f7a2a' };
    const y0 = L.H * 0.64;
    c.fillStyle = pal.g0; c.fillRect(0, y0, g.Wd, L.H - y0 + 2);
    const r = mulberry32(hashStr(H.site));
    for (let i = 0; i < 40; i++) { const x = r() * g.Wd, y = y0 + 10 + r() * (L.H - y0 - 14), w = (30 + r() * 80) * u; c.beginPath(); c.ellipse(x, y, w, w * 0.14, 0, 0, TAU); c.fillStyle = r() < 0.5 ? pal.g1 : shade(pal.g0, 0.08); c.fill(); }
    c.beginPath(); for (let i = 0; i < 150; i++) { const x = r() * g.Wd, y = y0 + 6 + r() * (L.H - y0 - 8); c.moveTo(x, y); c.lineTo(x - 2 * u, y - 5 * u); c.moveTo(x + 2 * u, y); c.lineTo(x + 3 * u, y - 6 * u); }
    c.lineWidth = 1.6 * u; c.strokeStyle = shade(pal.g0, -0.2); c.stroke();
    // the creek: down from the back row by the mill, curving to the front, with a footbridge
    const cx = (y) => (CREEK_X + 22 * Math.sin((y - g.yb) / (L.H * 0.12))) * u + g.off;
    const ca = H.pieces.mill || true;
    void ca;
    c.beginPath(); for (let y = g.yb - 12 * u; y <= L.H + 8; y += 8) { const x = cx(y) - 20 * u - (y - g.yb) * 0.05; if (y === g.yb - 12 * u) c.moveTo(x, y); else c.lineTo(x, y); }
    for (let y = L.H + 8; y >= g.yb - 12 * u; y -= 8) c.lineTo(cx(y) + 20 * u + (y - g.yb) * 0.07, y); c.closePath();
    c.fillStyle = '#5aa6d8'; c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); for (let y = g.yb + 4 * u; y <= L.H; y += 22 * u) { const x = cx(y); c.moveTo(x - 10 * u, y); c.lineTo(x + 8 * u, y); } c.lineWidth = 1.8 * u; c.strokeStyle = 'rgba(255,255,255,0.7)'; c.stroke();
    // the path: from the gate, over the bridge, to the house door and the barn door
    const py = g.ym + 14 * u;
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(g.Wd, py + 20 * u); c.lineTo((GATE_X + 8) * u + g.off, py + 18 * u); c.lineTo(CREEK_X * u + g.off, py + 2 * u); c.lineTo(DOOR_X * u + g.off, py - 8 * u); c.lineTo(DOOR_X * u + g.off, g.yb + 4 * u);
    if (H.pieces.barn || (H.anim && H.anim.id === 'barn')) { c.moveTo((DOOR_X - 50) * u + g.off, py - 6 * u); c.lineTo(BARN_X * u + g.off, py - 2 * u); c.lineTo(BARN_X * u + g.off, g.yb + 4 * u); }
    c.lineWidth = 30 * u; c.strokeStyle = shade(pal.dirt, -0.1); c.stroke(); c.lineWidth = 26 * u; c.strokeStyle = pal.dirt; c.stroke();
    c.lineCap = 'butt';
    // the footbridge over the creek
    const bx = cx(py) , bw = 62 * u;
    c.beginPath(); rrect(c, bx - bw / 2, py - 6 * u, bw, 20 * u, 3 * u); c.fillStyle = '#b98a54'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); for (let x = bx - bw / 2 + 8 * u; x < bx + bw / 2; x += 10 * u) { c.moveTo(x, py - 6 * u); c.lineTo(x, py + 14 * u); } c.lineWidth = 1.2; c.strokeStyle = '#7a4a26'; c.stroke();
  }
  function paintStatic(c, L, g) {
    const counts = { ...H.pieces };
    if (H.anim) counts[H.anim.id] = Math.max(0, H.anim.n - 1);
    paintGround(c, L, g);
    const ctx = { name: H.name, trophies: H.trophies, site: H.site };
    const no_cabin = !counts.cabin && !counts['frame-house'];
    if (no_cabin) at(c, g, DOOR_X, 0, 0, () => drawTent(c));
    for (const id of STATIC_ORDER) {
      let n = counts[id] | 0;
      if (!n) continue;
      if (id === 'cabin' && counts['frame-house']) continue; // the frame house replaces the cabin's art
      if (id === 'trophy-shelf' && !(counts.cabin || counts['frame-house'])) continue;
      if (id === 'bench' && !(counts.cabin || counts['frame-house'])) continue;
      const P = PIECES[id];
      for (let i = 0; i < n; i++) { const [x, row, dy] = P.at(i); at(c, g, x, row, dy, () => P.draw(c, i, ctx)); }
    }
  }
  function at(c, g, x, row, dy, fn) { c.save(); c.translate(x * g.u + g.off, (row ? g.ym : g.yb) + dy * g.u); c.scale(g.u, g.u); fn(); c.restore(); }
  function ensureStatic(L, g) {
    const dprS = Math.min(L.dpr, Math.sqrt(4.6e6 / Math.max(1, g.Wd * L.H)));
    const key = [H.site, JSON.stringify(H.pieces), H.name, H.trophies.join(','), L.W, L.H, dprS, H.anim ? H.anim.id + ':' + H.anim.n : ''].join('|');
    if (H.static && H.staticKey === key) return H.static;
    const cv = mkCanvas(g.Wd * dprS, L.H * dprS), c = cv.getContext('2d');
    c.setTransform(dprS, 0, 0, dprS, 0, 0);
    paintStatic(c, L, g);
    H.static = { cv, w: g.Wd, h: L.H }; H.staticKey = key;
    return H.static;
  }
  // a piece on its own (for the raising): painted once into a sprite
  function spriteOf(L, id, i) {
    const g = geoOf(L), P = PIECES[id], key = id + i + L.W + L.H + H.site + H.name;
    let sp = H.sprites.get(key);
    if (sp) return sp;
    if (H.sprites.size > 12) H.sprites.clear();
    const [bw, bh] = P.box, d = Math.min(L.dpr, 2), w = bw * g.u, h = (bh + 12) * g.u;
    const cv = mkCanvas(w * d, h * d), c = cv.getContext('2d');
    c.setTransform(d, 0, 0, d, 0, 0); c.translate(w / 2, h - 12 * g.u); c.scale(g.u, g.u);
    P.draw(c, i, { name: H.name, trophies: H.trophies, site: H.site });
    sp = { cv, w, h, bw, bh }; H.sprites.set(key, sp);
    return sp;
  }

  // ---- the animals, chickens and people (dynamic)
  const ANIMALS = (() => { const r = mulberry32(31); return Array.from({ length: 8 }, (_, i) => ({ hx: r(), hy: r(), ph: r() * TAU, sp: 0.16 + r() * 0.16, rng: 10 + r() * 14, tone: i % 2 })); })();
  function penBox(L, g) {
    const fence = H.pieces.fence, corral = H.pieces.corral;
    if (corral) { const p = pieceXY(L, 'corral', 0); return { x0: p.x - 50 * g.u, x1: p.x + 50 * g.u, y0: p.y - 14 * g.u, y1: p.y + 8 * g.u }; }
    const p = pieceXY(L, 'fence', 0);
    return fence ? { x0: p.x - 84 * g.u, x1: p.x + 84 * g.u, y0: p.y + 6 * g.u, y1: p.y + 60 * g.u } : { x0: 650 * g.u + g.off, x1: 830 * g.u + g.off, y0: g.ym + 10 * g.u, y1: g.ym + 62 * g.u };
  }
  function drawCow(c, x, y, s, t, dir) {
    c.save(); c.translate(x, y); c.scale(s * dir, s);
    c.beginPath(); c.ellipse(0, 2, 30, 4, 0, 0, TAU); c.fillStyle = 'rgba(40,25,10,0.2)'; c.fill();
    for (const lx of [-17, -9, 11, 19]) { c.beginPath(); c.moveTo(lx, -18); c.lineTo(lx, -1); c.lineWidth = 6.5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.6; c.strokeStyle = '#f4f0e6'; c.stroke(); }
    c.beginPath(); rrect(c, -26, -42, 52, 26, 11); O(c, '#f7f3ea'); c.save(); c.beginPath(); rrect(c, -26, -42, 52, 26, 11); c.clip(); c.fillStyle = '#3a302a'; c.beginPath(); c.ellipse(-10, -34, 9, 7, 0.3, 0, TAU); c.ellipse(10, -22, 8, 6, 0, 0, TAU); c.fill(); c.restore();
    const hd = Math.sin(t * 0.8) * 3;
    c.beginPath(); rrect(c, 22, -48 + hd, 20, 20, 8); O(c, '#f7f3ea'); c.beginPath(); c.ellipse(39, -32 + hd, 6, 5, 0, 0, TAU); c.fillStyle = '#f0b8a8'; c.fill();
    c.beginPath(); c.arc(32, -42 + hd, 1.8, 0, TAU); c.fillStyle = OUT; c.fill();
    c.beginPath(); c.moveTo(25, -48 + hd); c.lineTo(22, -56 + hd); c.moveTo(36, -48 + hd); c.lineTo(38, -56 + hd); c.lineWidth = 2.4; c.strokeStyle = '#d8c8a0'; c.stroke();
    c.beginPath(); c.moveTo(-26, -36); c.quadraticCurveTo(-33, -28 + Math.sin(t * 2) * 3, -29, -14); c.lineWidth = 2.4; c.strokeStyle = OUT; c.stroke();
    c.restore();
  }
  function drawChicken(c, x, y, s, peck, dir) {
    c.save(); c.translate(x, y); c.scale(s * dir, s);
    c.beginPath(); c.moveTo(-6, -6); c.lineTo(-6, 0); c.moveTo(3, -6); c.lineTo(3, 0); c.lineWidth = 1.6; c.strokeStyle = '#d8902a'; c.stroke();
    c.beginPath(); c.ellipse(-1, -9, 9, 6.5, 0, 0, TAU); O(c, '#f8f4ea', 1.4);
    c.beginPath(); c.moveTo(-9, -10); c.lineTo(-14, -15); c.lineTo(-8, -13); c.closePath(); O(c, '#f8f4ea', 1.1);
    const hy = -14 + peck * 6;
    c.beginPath(); c.arc(8, hy, 4.2, 0, TAU); O(c, '#f8f4ea', 1.4); c.beginPath(); c.moveTo(11, hy - 1); c.lineTo(15, hy + 0.5 + peck); c.lineTo(11, hy + 1.6); c.closePath(); c.fillStyle = '#f0a500'; c.fill();
    c.beginPath(); c.arc(7, hy - 4.4, 2, 0, TAU); c.fillStyle = '#d9534f'; c.fill();
    c.restore();
  }
  function drawLife(c, L, g, t, rm) {
    const u = g.u, pen = penBox(L, g);
    const spawn = (i) => ({ x: lerp(pen.x0, pen.x1, ANIMALS[i % 8].hx), y: lerp(pen.y0, pen.y1, ANIMALS[i % 8].hy) });
    const list = [];
    for (let i = 0; i < H.animals.oxen; i++) list.push('oxen');
    for (let i = 0; i < H.animals.mules; i++) list.push('mules');
    // animals and the cow, in the pasture, sorted by depth
    const items = [];
    list.slice(0, 8).forEach((kind, i) => { const A = ANIMALS[i], q = spawn(i); const dx = Math.sin(t * A.sp + A.ph) * A.rng * u * (rm ? 0 : 1), sp = Math.cos(t * A.sp + A.ph); items.push({ y: q.y, fn: () => drawAnimal(c, kind, clamp(q.x + dx, pen.x0, pen.x1), q.y, u * 0.52, t * 3 + A.ph, Math.abs(sp) * 0.28 * (rm ? 0 : 1), sp >= 0 ? 1 : -1, A.tone) }); });
    if (H.pieces.cow) { const q = { x: lerp(pen.x0, pen.x1, 0.82), y: lerp(pen.y0, pen.y1, 0.4) }; items.push({ y: q.y, fn: () => drawCow(c, q.x, q.y, u * 0.55, rm ? 0 : t, -1) }); }
    items.sort((a, b) => a.y - b.y); for (const it of items) it.fn();
    // the front rail of the corral over the animals
    if (H.pieces.corral) { const p = pieceXY(L, 'corral', 0); c.beginPath(); c.ellipse(p.x, p.y, 66 * u, 22 * u, 0, 0, Math.PI); c.lineWidth = 6 * u; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.2 * u; c.strokeStyle = '#c28a52'; c.stroke(); }
    // chickens around the coop
    if (H.pieces.coop) { const p = pieceXY(L, 'coop', 0); for (let i = 0; i < 3; i++) { const dx = Math.sin(t * 0.4 + i * 2.1) * 24 * u * (rm ? 0 : 1), pk = rm ? 0 : Math.max(0, Math.sin(t * 3 + i * 1.7)); drawChicken(c, p.x - 40 * u + i * 26 * u + dx, p.y + (16 + (i % 2) * 7) * u, u * 0.9, pk, Math.cos(t * 0.4 + i * 2.1) >= 0 ? 1 : -1); } }
    // the mill wheel, the windmill's blades, the weathervane, smoke
    if (H.pieces.mill && !(H.anim && H.anim.id === 'mill')) { const p = pieceXY(L, 'mill', 0), wx = p.x + 52 * u, wy = p.y - 16 * u, r = 22 * u, a = rm ? 0 : t * 0.9;
      c.beginPath(); c.arc(wx, wy, r, 0, TAU); c.lineWidth = 5 * u; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.6 * u; c.strokeStyle = '#a8703e'; c.stroke();
      c.beginPath(); for (let i = 0; i < 8; i++) { const b = a + i * TAU / 8; c.moveTo(wx, wy); c.lineTo(wx + Math.cos(b) * r, wy + Math.sin(b) * r); c.moveTo(wx + Math.cos(b) * r, wy + Math.sin(b) * r); c.lineTo(wx + Math.cos(b) * r - Math.sin(b) * 6 * u, wy + Math.sin(b) * r + Math.cos(b) * 6 * u); } c.lineWidth = 2.6 * u; c.strokeStyle = '#8a5a30'; c.stroke();
      c.beginPath(); c.arc(wx, wy, 3.4 * u, 0, TAU); O(c, '#6a4a2a', 1.4); }
    if (H.pieces.windmill && !(H.anim && H.anim.id === 'windmill')) { const p = pieceXY(L, 'windmill', 0), wx = p.x, wy = p.y - 94 * u, r = 26 * u, a = rm ? 0.4 : t * 2.2;
      c.beginPath(); for (let i = 0; i < 12; i++) { const b = a + i * TAU / 12; c.moveTo(wx, wy); c.lineTo(wx + Math.cos(b) * r, wy + Math.sin(b) * r); }
      c.lineWidth = 3 * u; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 1.6 * u; c.strokeStyle = '#d8dde2'; c.stroke(); c.beginPath(); c.arc(wx, wy, 4 * u, 0, TAU); O(c, '#6a737c', 1.4); }
    const vaneAt = H.pieces.barn ? pieceXY(L, 'barn', 0) : H.pieces['frame-house'] ? pieceXY(L, 'frame-house', 0) : H.pieces.cabin ? pieceXY(L, 'cabin', 0) : null;
    if (vaneAt && H.decor.includes('weathervane-salmon') && !(H.anim && H.anim.big)) {
      const top = H.pieces.barn ? 106 : H.pieces['frame-house'] ? 152 : 108; c.save(); c.translate(vaneAt.x, vaneAt.y - top * u); c.scale(u * 0.9, u * 0.9);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 0); c.restore(); c.save(); c.translate(vaneAt.x, vaneAt.y - (top - 4) * u); c.scale(u, u); drawDecor(c, 'weathervane-salmon', 98, t, rm); c.restore();
    }
    const sm = H.pieces['frame-house'] ? { p: pieceXY(L, 'frame-house', 0), dx: 58, dy: -152 } : H.pieces.cabin ? { p: pieceXY(L, 'cabin', 0), dx: 38, dy: -110 } : null;
    if (sm && !(H.anim && (H.anim.id === 'cabin' || H.anim.id === 'frame-house'))) {
      c.fillStyle = 'rgba(240,240,240,0.8)';
      for (let i = 0; i < 4; i++) { const p = ((t * (rm ? 0.1 : 0.3) + i / 4) % 1); c.globalAlpha = 0.7 * (1 - p); c.beginPath(); c.arc(sm.p.x + sm.dx * u + Math.sin(p * 5 + i) * 6 * u + p * 18 * u, sm.p.y + sm.dy * u - p * 60 * u, (4 + p * 11) * u, 0, TAU); c.fill(); } c.globalAlpha = 1;
    }
    // the campfire in front of the tent while there is no cabin
    if (!H.pieces.cabin && !H.pieces['frame-house']) { const p = pieceXY(L, 'cabin', 0); drawCampfire(c, p.x + 64 * u, p.y + 18 * u, u, t, rm); }
    // the wagon, parked at the left, with the farm's decorations
    {
      const wx = 70 * u + g.off, wy = g.ym + 40 * u, w = S.party.wagon;
      drawWagon(c, wx, wy, u * 0.62, w, 0, 0, t);
      c.save(); c.translate(wx, wy); c.scale(u * 0.62, u * 0.62); for (const id of H.decor) drawDecor(c, id, 0, t, rm); c.restore();
    }
    // the people at home: the party by the well and the garden, the dog on the porch; the companions hammer while a piece goes up
    const looks = H.party ? H.party.map((p) => {
      const l = { ...S.party.looks[0], color: p.color || '#5b8c5a', hat: p.hat || 'none', outfit: undefined };
      const oid = outfitOf(p.outfit);
      if (oid) { l.outfit = oid; const oh = outfitHat(oid); if (oh) { l.hat = oh.hat; l.hatColor = oh.hatColor; } }      // (v1.6: the leader's Lab outfit)
      return l;
    }) : S.party.looks;
    const frame = H.anim && H.anim.big ? pieceXY(L, H.anim.id, H.anim.n - 1) : null;
    const spots = frame ? [[frame.x - 70 * u, frame.y + 26 * u], [frame.x + 62 * u, frame.y + 30 * u], [frame.x - 6 * u, frame.y + 44 * u]] : [[(DOOR_X - 20) * u + g.off, g.ym + 40 * u], [(DOOR_X + 40) * u + g.off, g.ym + 48 * u], [400 * u + g.off, g.ym + 48 * u]];
    for (let i = 0; i < Math.min(3, looks.length); i++) {
      const [sx, sy] = spots[i], hammer = frame ? Math.max(0, Math.sin(t * 9 + i * 2)) : 0;
      drawPerson(c, sx, sy, u * 0.78, looks[i], t * 2 + i, 0, frame ? 0 : 0, i === 2 ? -1 : 1);
      if (frame) { const ha = -0.9 + hammer * 1.6; c.save(); c.translate(sx + 8 * u, sy - 34 * u); c.rotate(ha); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -16 * u); c.lineWidth = 3 * u; c.strokeStyle = '#7a4a26'; c.stroke(); c.beginPath(); c.rect(-5 * u, -20 * u, 10 * u, 5 * u); c.fillStyle = '#7a7f88'; c.fill(); c.restore(); }
    }
    if (H.dog) {
      const home = H.pieces.cabin || H.pieces['frame-house'], p = pieceXY(L, home ? (H.pieces['frame-house'] ? 'frame-house' : 'cabin') : 'cabin', 0);
      drawDog(c, home ? p.x + (H.pieces.bench ? -66 : -54) * u : p.x + 100 * u, home ? p.y + 20 * u : p.y + 30 * u, u * 0.78, H.dog.coat, 0, 0, t, 0, 1, true, 0);
    }
  }

  // ---- the raising, drawn over the static picture
  function drawAnim(c, L, g, t) {
    const a = H.anim; if (!a) return;
    const p = pieceXY(L, a.id, a.n - 1), sp = spriteOf(L, a.id, a.n - 1), u = g.u;
    const x = p.x - sp.w / 2, y = p.y - sp.h + 12 * u;
    if (!a.big) { // small pieces pop in with a puff
      const q = clamp(a.t / BUILD.pop, 0, 1), s = q < 0.6 ? lerp(0.3, 1.15, ease(q / 0.6)) : lerp(1.15, 1, ease((q - 0.6) / 0.4));
      c.save(); c.translate(p.x, p.y); c.scale(s, s); c.drawImage(sp.cv, -sp.w / 2, -sp.h + 12 * u, sp.w, sp.h); c.restore();
      for (let i = 0; i < 6; i++) { const ang = i * TAU / 6 + 0.4, d = (14 + 26 * q) * u; c.globalAlpha = 0.7 * (1 - q); c.beginPath(); c.arc(p.x + Math.cos(ang) * d, p.y - 14 * u + Math.sin(ang) * d * 0.6, (6 + 8 * q) * u, 0, TAU); c.fillStyle = '#f4ecd8'; c.fill(); } c.globalAlpha = 1;
      return;
    }
    const beat = a.t / BUILD.beat, b = Math.min(BUILD.beats, beat);
    const reveal = clamp(b / BUILD.beats, 0, 1);
    // the footing and the frame: posts and beams, in step with the walls rising behind them
    const bw = sp.bw * u * 0.7, ph = sp.bh * u * 0.9;
    c.globalAlpha = 1 - clamp((b - 2.1) / 0.9, 0, 1);
    c.beginPath(); c.rect(p.x - bw / 2 - 6 * u, p.y - 2 * u, bw + 12 * u, 6 * u); c.fillStyle = '#9a9488'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    const postH = ph * clamp(b / 1.4, 0, 1);
    c.beginPath(); for (let i = 0; i < 4; i++) { const px = p.x - bw / 2 + (bw * i) / 3; c.moveTo(px, p.y); c.lineTo(px, p.y - postH); } c.lineWidth = 6 * u; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.4 * u; c.strokeStyle = '#c8955a'; c.stroke();
    if (b > 1) { const rb = clamp(b - 1, 0, 1), by = p.y - postH; c.beginPath(); c.moveTo(p.x - bw / 2 - 8 * u, by); c.lineTo(p.x - bw / 2 + (bw + 16 * u) * rb, by); c.moveTo(p.x - bw / 2, by); c.lineTo(p.x, by - 30 * u * rb); c.lineTo(p.x + bw / 2, by); c.lineWidth = 5 * u; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.6 * u; c.strokeStyle = '#d8a868'; c.stroke(); }
    c.globalAlpha = 1;
    // the finished walls rise from the ground as the third beat comes, then the art settles
    c.save(); c.beginPath(); c.rect(x - 4, y + sp.h * (1 - reveal) - 2, sp.w + 8, sp.h * reveal + 6); c.clip(); c.globalAlpha = clamp((b - 0.8) / 1.6, 0, 1); c.drawImage(sp.cv, x, y, sp.w, sp.h); c.restore(); c.globalAlpha = 1;
  }

  // ---- update / draw
  H.update = (L, dt) => {
    H.t += dt;
    const g = geoOf(L);
    if (H.camT != null) { H.cam += (H.camT - H.cam) * (1 - Math.exp(-4 * dt)); if (Math.abs(H.camT - H.cam) < 0.5) H.camT = null; }
    H.cam = clamp(H.cam, 0, Math.max(0, g.camMax));
    if (H.anim) { H.anim.t += dt; if (H.anim.t >= H.anim.dur) finishAnim(true); }
    for (const x of H.texts) x.t += dt; H.texts = H.texts.filter((x) => x.t < 1.6);
  };
  H.center = (L, slot) => { const g = geoOf(L); H.cam = clamp((SLOT_X[slot] || 705) * g.u + g.off - L.W / 2, 0, Math.max(0, g.camMax)); H.camT = null; };
  H.drawBack = (c, L) => { const g = geoOf(L); S.scroll = H.cam; void g; };
  H.draw = (c, L, t, rm) => {
    const g = geoOf(L), st = ensureStatic(L, g);
    c.save(); c.translate(-Math.round(H.cam), 0);
    c.drawImage(st.cv, 0, 0, st.w, st.h);
    // the ripples on the creek
    c.beginPath(); for (let i = 0; i < 5; i++) { const y = g.yb + 8 * g.u + ((i * 44 * g.u + (rm ? 0 : t * 12)) % (L.H - g.yb - 10 * g.u)); const x = (CREEK_X + 22 * Math.sin((y - g.yb) / (L.H * 0.12))) * g.u + g.off; c.moveTo(x - 8 * g.u, y); c.lineTo(x + 10 * g.u, y); } c.lineWidth = 1.8 * g.u; c.strokeStyle = 'rgba(255,255,255,0.75)'; c.stroke();
    drawLife(c, L, g, t, rm);
    drawAnim(c, L, g, t);
    c.restore();
  };

  // ---- the pointer: a drag pans, a tap is a tap
  H.down = (L, x, y) => { H.drag = { x, y, cam: H.cam, moved: 0, t: H.t }; H.camT = null; };
  H.move = (L, x, y) => {
    const d = H.drag; if (!d) return;
    const dx = x - d.x; d.moved = Math.max(d.moved, Math.hypot(dx, y - d.y));
    if (d.moved > 8) H.cam = clamp(d.cam - dx, 0, Math.max(0, geoOf(L).camMax));
  };
  H.up = (L, x, y) => {
    const d = H.drag; H.drag = null;
    if (!d || d.moved > 8) return null;
    return H.tapAt(L, x, y);
  };
  H.tapAt = (L, x, y) => {
    const g = geoOf(L), wxp = x + H.cam, wx = (wxp - g.off) / g.u;
    let best = null, piece = null;
    // first, what is under the finger (the front-most piece's box)
    for (let k = STATIC_ORDER.length - 1; k >= 0 && !best; k--) {
      const id = STATIC_ORDER[k], n = H.pieces[id] | 0;
      if (!n) continue;
      for (let i = 0; i < n; i++) {
        const [px0, row, dy] = PIECES[id].at(i), [bw, bh] = PIECES[id].box, px = px0 * g.u + g.off, py = (row ? g.ym : g.yb) + dy * g.u;
        if (Math.abs(wxp - px) <= (bw / 2) * g.u && y <= py + 12 * g.u && y >= py - bh * g.u) { best = PIECE_SLOT[id]; piece = id; break; }
      }
    }
    if (!best) { // else the nearest slot in the row the finger is in
      const front = y >= g.ym - 6 * g.u ? 1 : 0;
      let bd = 1e9;
      for (const slot of HOME_SLOTS) { if (SLOT_ROW[slot] !== front) continue; const d = Math.abs(SLOT_X[slot] - wx); if (d < bd) { bd = d; best = slot; } }
      best = best || 'house';
      for (const id of TAP_ORDER[best] || []) if (H.pieces[id]) { piece = id; break; }
    }
    const evt = { type: 'homesteadTap', slot: best, piece };
    emit(evt);
    return evt;
  };
  H.state = () => ({ site: H.site, name: H.name, pieces: { ...H.pieces }, animals: { ...H.animals }, building: H.anim ? { id: H.anim.id, n: H.anim.n, big: H.anim.big, t: Math.round(H.anim.t * 100) / 100 } : null, cam: Math.round(H.cam), built: H.built, decor: H.decor.slice(), dog: H.dog ? { ...H.dog } : null });
  H.slotPoint = (L, slot) => { const g = geoOf(L); return { x: SLOT_X[slot] * g.u + g.off - H.cam, y: SLOT_ROW[slot] ? g.ym + 14 * g.u : g.yb - 30 * g.u }; };
  return H;
}

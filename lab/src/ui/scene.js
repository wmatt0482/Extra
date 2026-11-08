// The room (lab/SPEC.md §5.2) and the Lab's own item previews. The room is drawn on a 640 x 360 canvas: wall, floor, a window whose light follows
// the time of day, two posters, banners, the shelf (trophies and keepsakes), the gallery frame, the avatar and the pet. `HOT` names the places a
// tap can reach (the page lays real buttons over them). Pure drawing; the caller passes `t` (seconds) and the hour.
import { drawAvatar } from './avatar.js';
import { drawPet } from './pet.js';
import { GAME_COLORS } from './glyph.js';

export const ROOM_W = 640, ROOM_H = 360;
/** Hot spots in room coordinates: [x, y, w, h]. */
export const HOT = { gallery: [262, 40, 98, 74], shelf: [458, 70, 150, 100], avatar: [150, 150, 130, 190], pet: [320, 215, 120, 120] };

const tok = (id) => (id ? String(id).split('.').pop() : '');
function rect(c, x, y, w, h, fill, stroke, r = 0) {
  c.beginPath(); if (r && c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
  if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
}
function disc(c, x, y, r, fill) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); }
function starShape(c, cx, cy, R, r, fill) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? r : R; c.lineTo(cx + Math.cos(a) * k, cy + Math.sin(a) * k); } c.closePath(); c.fillStyle = fill; c.fill(); }

// ---------- walls and floors ----------
export function paintWall(c, name, x, y, w, h) {
  const g = c.createLinearGradient(0, y, 0, y + h);
  const stops = { blueprint: ['#1b3a8a', '#0f2562'], ocean: ['#2aa6c9', '#1b6f9c'], forest: ['#2f8f55', '#1d6038'], sunset: ['#ff9a5a', '#c9487a'], stars: ['#2a2f7a', '#171b4f'], space: ['#0e0b2e', '#050316'], '': ['#fbe9c6', '#f0d4a2'] };
  const [a, b] = stops[name] || stops[''];
  g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(x, y, w, h);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  if (!name) { c.fillStyle = 'rgba(255,255,255,.28)'; for (let i = x + 10; i < x + w; i += 40) c.fillRect(i, y, 14, h); c.fillStyle = 'rgba(160,105,55,.16)'; c.fillRect(x, y + h * 0.72, w, h * 0.28); c.fillStyle = 'rgba(120,75,35,.25)'; c.fillRect(x, y + h * 0.72, w, 3); }
  if (name === 'blueprint') { c.strokeStyle = 'rgba(180,210,255,.18)'; c.lineWidth = 1; for (let i = x; i < x + w; i += 24) { c.beginPath(); c.moveTo(i, y); c.lineTo(i, y + h); c.stroke(); } for (let j = y; j < y + h; j += 24) { c.beginPath(); c.moveTo(x, j); c.lineTo(x + w, j); c.stroke(); } }
  else if (name === 'ocean') { c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 2; for (let j = y + 20; j < y + h; j += 28) { c.beginPath(); for (let i = x; i <= x + w; i += 8) c.lineTo(i, j + Math.sin(i / 12) * 4); c.stroke(); } }
  else if (name === 'forest') { for (let i = x + 10; i < x + w; i += 46) { c.fillStyle = 'rgba(10,50,24,.5)'; c.beginPath(); c.moveTo(i, y + h); c.lineTo(i + 16, y + h - 70 - (i % 3) * 14); c.lineTo(i + 32, y + h); c.fill(); } }
  else if (name === 'sunset') { disc(c, x + w * 0.5, y + h, h * 0.55, 'rgba(255,225,140,.55)'); }
  else if (name === 'stars' || name === 'space') { for (let i = 0; i < 38; i++) { const sx = x + ((i * 97) % w), sy = y + ((i * 53) % h), r = 0.8 + (i % 3) * 0.6; disc(c, sx, sy, r, 'rgba(255,255,255,.75)'); } if (name === 'space') { disc(c, x + w * 0.8, y + h * 0.3, 20, '#d6773a'); disc(c, x + w * 0.8 - 6, y + h * 0.3 - 4, 6, 'rgba(255,255,255,.2)'); } }
  c.restore();
}
export function paintFloor(c, name, x, y, w, h) {
  const base = { wood: '#a9743f', grass: '#4fa84a', checker: '#d8d8e8', rainbowrug: '#a9743f' }[name] || '#a9743f';
  c.fillStyle = base; c.fillRect(x, y, w, h);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  if (name === 'wood' || name === 'rainbowrug' || !name) { c.strokeStyle = 'rgba(70,40,15,.35)'; c.lineWidth = 2; for (let j = y + 14; j < y + h; j += 16) { c.beginPath(); c.moveTo(x, j); c.lineTo(x + w, j); c.stroke(); } for (let j = 0, row = 0; j < h; j += 16, row++) for (let i = x + (row % 2) * 40; i < x + w; i += 80) { c.beginPath(); c.moveTo(i, y + j); c.lineTo(i, y + j + 16); c.stroke(); } }
  if (name === 'grass') { c.strokeStyle = 'rgba(20,90,30,.5)'; c.lineWidth = 2; for (let i = 0; i < 90; i++) { const gx = x + ((i * 71) % w), gy = y + 6 + ((i * 37) % (h - 8)); c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 2, gy - 7); c.moveTo(gx, gy); c.lineTo(gx + 3, gy - 6); c.stroke(); } }
  if (name === 'checker') { c.fillStyle = '#5a5a82'; const s = 36; for (let j = 0; j * s < h; j++) for (let i = 0; i * s < w; i++) if ((i + j) % 2) c.fillRect(x + i * s, y + j * s, s, s); }
  if (name === 'rainbowrug') { const cx = x + w * 0.5, cy = y + h * 0.52; ['#ff4d6d', '#ffb347', '#ffe066', '#7be08a', '#5ab0ff', '#8f7bff'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.ellipse(cx, cy, 190 - i * 24, 52 - i * 6, 0, 0, Math.PI * 2); c.fill(); }); }
  c.restore();
}

// ---------- posters, banners, shelf things ----------
const POSTER = {
  robot: (c, x, y, w, h) => { rect(c, x, y, w, h, '#ffe9a8'); rect(c, x + w * .28, y + h * .28, w * .44, h * .36, '#8aa0d6', '#37456f', 5); disc(c, x + w * .42, y + h * .42, 3, '#fff'); disc(c, x + w * .58, y + h * .42, 3, '#fff'); rect(c, x + w * .4, y + h * .54, w * .2, 3, '#37456f'); c.fillStyle = '#37456f'; c.fillRect(x + w * .48, y + h * .18, 2.4, h * .1); disc(c, x + w * .5, y + h * .17, 3, '#ff4d6d'); },
  rocket: (c, x, y, w, h) => { rect(c, x, y, w, h, '#1b2357'); for (let i = 0; i < 8; i++) disc(c, x + ((i * 29) % w), y + ((i * 41) % h), 1.1, '#fff'); c.fillStyle = '#f4f6ff'; c.beginPath(); c.moveTo(x + w * .5, y + h * .16); c.quadraticCurveTo(x + w * .72, y + h * .4, x + w * .62, y + h * .66); c.lineTo(x + w * .38, y + h * .66); c.quadraticCurveTo(x + w * .28, y + h * .4, x + w * .5, y + h * .16); c.fill(); disc(c, x + w * .5, y + h * .4, 4.4, '#4fd6c8'); c.fillStyle = '#ff8a1f'; c.beginPath(); c.moveTo(x + w * .42, y + h * .66); c.lineTo(x + w * .5, y + h * .84); c.lineTo(x + w * .58, y + h * .66); c.fill(); },
  map: (c, x, y, w, h) => { rect(c, x, y, w, h, '#f1deb0'); c.strokeStyle = '#a0522d'; c.lineWidth = 2; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(x + w * .15, y + h * .75); c.quadraticCurveTo(x + w * .4, y + h * .2, x + w * .62, y + h * .55); c.quadraticCurveTo(x + w * .78, y + h * .75, x + w * .86, y + h * .3); c.stroke(); c.setLineDash([]); c.strokeStyle = '#c0392b'; c.lineWidth = 2.4; const px = x + w * .86, py = y + h * .3; c.beginPath(); c.moveTo(px - 5, py - 5); c.lineTo(px + 5, py + 5); c.moveTo(px + 5, py - 5); c.lineTo(px - 5, py + 5); c.stroke(); },
  lab: (c, x, y, w, h) => { rect(c, x, y, w, h, '#0f3b46'); c.strokeStyle = '#37e0c0'; c.lineWidth = 2.6; c.lineJoin = 'round'; c.beginPath(); const fx = x + w * .5; c.moveTo(fx - 4, y + h * .24); c.lineTo(fx + 4, y + h * .24); c.moveTo(fx - 3, y + h * .24); c.lineTo(fx - 3, y + h * .46); c.lineTo(fx - w * .2, y + h * .74); c.lineTo(fx + w * .2, y + h * .74); c.lineTo(fx + 3, y + h * .46); c.lineTo(fx + 3, y + h * .24); c.stroke(); c.fillStyle = 'rgba(55,224,192,.5)'; c.beginPath(); c.moveTo(fx - w * .13, y + h * .62); c.lineTo(fx + w * .13, y + h * .62); c.lineTo(fx + w * .2, y + h * .74); c.lineTo(fx - w * .2, y + h * .74); c.fill(); },
};
const GAME_POSTER_GLYPH = {
  sj: (c, x, y, w, h) => { c.fillStyle = '#2a1a00'; c.font = `700 ${h * .5}px system-ui,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('A', x + w / 2, y + h * .5); },
  tb: (c, x, y, w, h) => { c.strokeStyle = '#2b1200'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + w * .34, y + h * .76); c.lineTo(x + w * .34, y + h * .24); c.lineTo(x + w * .72, y + h * .34); c.lineTo(x + w * .34, y + h * .46); c.stroke(); },
  ff: (c, x, y, w, h) => { c.strokeStyle = '#06261a'; c.lineWidth = 3.2; c.beginPath(); c.moveTo(x + w * .3, y + h * .36); c.lineTo(x + w * .7, y + h * .36); c.moveTo(x + w * .5, y + h * .2); c.lineTo(x + w * .5, y + h * .54); c.moveTo(x + w * .3, y + h * .72); c.lineTo(x + w * .7, y + h * .72); c.stroke(); },
  ww: (c, x, y, w, h) => { c.strokeStyle = '#2a0f02'; c.lineWidth = 2.4; const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * .28; c.beginPath(); c.arc(cx, cy, r, 0, 7); for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 4; c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); c.lineTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r); } c.stroke(); },
  bc: (c, x, y, w, h) => { c.strokeStyle = '#032634'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + w * .26, y + h * .78); c.lineTo(x + w * .74, y + h * .78); c.moveTo(x + w * .36, y + h * .78); c.lineTo(x + w * .36, y + h * .36); c.lineTo(x + w * .66, y + h * .24); c.lineTo(x + w * .66, y + h * .5); c.stroke(); rect(c, x + w * .6, y + h * .5, w * .12, h * .1, '#032634'); },
};
export function paintPoster(c, name, x, y, w, h) {
  c.save();
  c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + 3, y + 4, w, h);
  if (POSTER[name]) POSTER[name](c, x, y, w, h);
  else if (GAME_POSTER_GLYPH[name]) { rect(c, x, y, w, h, GAME_COLORS[name]); GAME_POSTER_GLYPH[name](c, x, y, w, h); }
  else rect(c, x, y, w, h, '#8aa0d6');
  c.strokeStyle = '#f4f6ff'; c.lineWidth = 3; c.strokeRect(x, y, w, h);
  c.restore();
}
export function paintBanner(c, n, x, y, w, h) {
  const cols = ['#ff4d6d', '#ffb347', '#7be08a', '#5ab0ff', '#8f7bff', '#ff8ad0'];
  c.fillStyle = cols[(n - 1) % 6]; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h); c.lineTo(x + w / 2, y + h - h * .2); c.lineTo(x, y + h); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.5; c.stroke();
  starShape(c, x + w / 2, y + h * .4, w * .28, w * .12, 'rgba(255,255,255,.9)');
}
const SHELF = {
  plant: (c, x, y) => { rect(c, x - 8, y - 12, 16, 12, '#c9573a', null, 3); c.fillStyle = '#3fae5a'; for (const a of [-0.7, 0, 0.7]) { c.save(); c.translate(x, y - 12); c.rotate(a); c.beginPath(); c.ellipse(0, -9, 4, 10, 0, 0, 7); c.fill(); c.restore(); } },
  lamp: (c, x, y) => { rect(c, x - 7, y - 4, 14, 4, '#5a5a82', null, 2); c.fillStyle = '#5a5a82'; c.fillRect(x - 1.5, y - 20, 3, 17); c.fillStyle = '#ffe066'; c.beginPath(); c.moveTo(x - 10, y - 20); c.lineTo(x + 10, y - 20); c.lineTo(x + 6, y - 32); c.lineTo(x - 6, y - 32); c.fill(); disc(c, x, y - 12, 18, 'rgba(255,230,120,.12)'); },
  globe: (c, x, y) => { c.strokeStyle = '#a9743f'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x - 7, y); c.lineTo(x + 7, y); c.moveTo(x, y); c.lineTo(x, y - 6); c.stroke(); disc(c, x, y - 15, 11, '#3b86d6'); c.fillStyle = '#4fae5a'; c.beginPath(); c.ellipse(x - 3, y - 17, 5, 3.4, 0.5, 0, 7); c.ellipse(x + 5, y - 11, 3, 4, 0, 0, 7); c.fill(); },
  trophy: (c, x, y) => { rect(c, x - 7, y - 4, 14, 4, '#7a5a1a', null, 1); c.fillStyle = '#ffcf1a'; c.beginPath(); c.moveTo(x - 8, y - 26); c.lineTo(x + 8, y - 26); c.lineTo(x + 5, y - 11); c.lineTo(x - 5, y - 11); c.fill(); c.fillRect(x - 1.5, y - 11, 3, 8); c.strokeStyle = '#d6a400'; c.lineWidth = 2; c.beginPath(); c.arc(x - 8, y - 21, 4, 1.57, 4.7); c.arc(x + 8, y - 21, 4, -1.57, 1.57); c.stroke(); },
};
const TIER = { gold: '#ffcf1a', silver: '#cfd6e8', bronze: '#c98a4b', brave: '#8f6bff' };

/** Draw the whole room. s = { view, hour, t, hop, mood, cheer } where view is the LabView. */
export function paintRoom(c, s) {
  const { view, t = 0, hop = 0, hour = 12 } = s;
  const home = view.home;
  c.clearRect(0, 0, ROOM_W, ROOM_H);
  const wallH = 236;
  paintWall(c, tok(home.wall), 0, 0, ROOM_W, wallH);
  paintFloor(c, tok(home.floor), 0, wallH, ROOM_W, ROOM_H - wallH);
  rect(c, 0, wallH - 8, ROOM_W, 10, 'rgba(110,70,30,.38)');                                     // skirting
  // window and its light: a sky with clouds and hills by day, peach at dusk, stars at night
  const day = hour >= 7 && hour < 18, dusk = (hour >= 18 && hour < 21) || (hour >= 5 && hour < 7);
  rect(c, 24, 34, 108, 122, '#fff6e2', '#c99a5a', 8);
  c.save(); c.beginPath(); if (c.roundRect) c.roundRect(32, 42, 92, 106, 4); else c.rect(32, 42, 92, 106); c.clip();
  const sky = c.createLinearGradient(0, 42, 0, 148);
  if (day) { sky.addColorStop(0, '#6dc2f5'); sky.addColorStop(1, '#d4f0ff'); } else if (dusk) { sky.addColorStop(0, '#f08a8a'); sky.addColorStop(1, '#ffd6a0'); } else { sky.addColorStop(0, '#101a52'); sky.addColorStop(1, '#2a3a8c'); }
  c.fillStyle = sky; c.fillRect(32, 42, 92, 106);
  if (!day && !dusk) { for (let i = 0; i < 9; i++) disc(c, 40 + ((i * 31) % 78), 52 + ((i * 47) % 70), 1.3, '#fff'); disc(c, 100, 66, 10, '#fff7c8'); }
  else {
    disc(c, 102, day ? 62 : 110, 12, day ? '#fff3a0' : '#ffe0a0');
    const cloud = (cx, cy, k) => { c.fillStyle = day ? 'rgba(255,255,255,.95)' : 'rgba(255,240,230,.8)'; c.beginPath(); c.ellipse(cx, cy, 14 * k, 6 * k, 0, 0, 7); c.ellipse(cx - 9 * k, cy + 2 * k, 9 * k, 5 * k, 0, 0, 7); c.ellipse(cx + 10 * k, cy + 2 * k, 10 * k, 5 * k, 0, 0, 7); c.fill(); };
    cloud(62 + Math.sin(t * 0.3) * 4, 74, 1); cloud(92, 100, 0.7);
  }
  c.fillStyle = day ? '#7cc77a' : dusk ? '#9a7a6a' : '#1a2a5a'; c.beginPath(); c.moveTo(32, 148); c.quadraticCurveTo(52, 118, 78, 130); c.quadraticCurveTo(100, 120, 124, 134); c.lineTo(124, 148); c.fill();
  c.fillStyle = day ? '#5fb865' : dusk ? '#7c5c52' : '#142048'; c.beginPath(); c.moveTo(32, 148); c.quadraticCurveTo(60, 136, 90, 144); c.lineTo(124, 148); c.fill();
  c.restore();
  c.strokeStyle = '#fff6e2'; c.lineWidth = 4; c.beginPath(); c.moveTo(78, 42); c.lineTo(78, 148); c.moveTo(32, 95); c.lineTo(124, 95); c.stroke();
  rect(c, 18, 152, 120, 9, '#c99a5a', '#8a6030', 3);                                           // sill
  if (day) { c.fillStyle = 'rgba(255,245,170,.14)'; c.beginPath(); c.moveTo(32, 156); c.lineTo(124, 156); c.lineTo(250, 322); c.lineTo(100, 322); c.fill(); }
  // plants: one on the sill, a tall one on the floor
  SHELF.plant(c, 52, 152);
  rect(c, 36, 262, 36, 34, '#c9573a', '#8a3a22', 5); rect(c, 33, 258, 42, 9, '#d8694a', '#8a3a22', 3);
  c.fillStyle = '#3fae5a'; for (const [a, l] of [[-0.9, 40], [-0.45, 54], [0, 62], [0.45, 52], [0.9, 38]]) { c.save(); c.translate(54, 262); c.rotate(a); c.beginPath(); c.ellipse(0, -l * 0.55, 7, l * 0.55, 0, 0, 7); c.fill(); c.restore(); }
  c.fillStyle = '#2f8f48'; for (const [a, l] of [[-0.6, 34], [0.25, 44], [0.75, 30]]) { c.save(); c.translate(54, 262); c.rotate(a); c.beginPath(); c.ellipse(0, -l * 0.5, 5, l * 0.5, 0, 0, 7); c.fill(); c.restore(); }
  // banners from family goals
  home.banners.slice(0, 6).forEach((id, i) => paintBanner(c, Number(tok(id).slice(1)) || i + 1, 372 + i * 40, 4, 30, 44));
  // posters
  const posters = home.posters;
  if (posters[0]) paintPoster(c, tok(posters[0]), 150, 52, 64, 86);
  if (posters[1]) paintPoster(c, tok(posters[1]), 380, 62, 64, 86);
  // the gallery frame
  rect(c, 262, 40, 98, 74, '#8a6232', '#e0b068', 4); rect(c, 270, 48, 82, 58, '#2a4f9c');
  c.strokeStyle = 'rgba(160,190,255,.4)'; c.lineWidth = 1; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(270 + i * 27, 48); c.lineTo(270 + i * 27, 106); c.stroke(); }
  c.strokeStyle = '#7be08a'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(284, 98); c.lineTo(284, 74); c.lineTo(302, 74); c.lineTo(302, 88); c.lineTo(322, 88); c.lineTo(322, 66); c.lineTo(338, 66); c.lineTo(338, 98); c.stroke();
  // the shelf
  rect(c, 458, 156, 150, 10, '#a9743f', '#6e4724', 2);
  const things = [...home.shelf.map(tok)];
  const trophies = view.trophies.slice(0, 3);
  let sx = 482;
  for (const name of things) { if (name === 'trophy') continue; if (SHELF[name]) { SHELF[name](c, sx, 156); sx += 40; } }
  for (const tr of trophies) { SHELF.trophy(c, sx, 156); c.fillStyle = TIER[tr.tier] || '#ffcf1a'; disc(c, sx, 138, 3.4, 'rgba(255,255,255,.6)'); sx += 32; if (sx > 590) break; }
  if (!things.length && !trophies.length) { c.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 3; i++) c.fillRect(480 + i * 42, 144, 22, 12); }
  // the figures
  const slots = {}; for (const [k, v] of Object.entries(view.avatar.slots)) slots[k] = v.id;
  const petSlots = {}; for (const [k, v] of Object.entries(view.pet.slots)) petSlots[k] = v.id;
  c.fillStyle = 'rgba(70,40,15,.25)'; c.beginPath(); c.ellipse(215, 316, 46, 9, 0, 0, 7); c.fill();
  // the pet's bed: a round cushion with a rim,
  c.fillStyle = 'rgba(70,40,15,.28)'; c.beginPath(); c.ellipse(382, 326, 66, 13, 0, 0, 7); c.fill();
  c.fillStyle = '#c9573a'; c.beginPath(); c.ellipse(382, 320, 62, 14, 0, 0, 7); c.fill();
  c.fillStyle = '#f6dca8'; c.beginPath(); c.ellipse(382, 318, 50, 10, 0, 0, 7); c.fill();
  c.fillStyle = '#e8836a'; c.beginPath(); c.ellipse(382, 322, 62, 8, 0, 0, Math.PI); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.setLineDash([5, 5]); c.beginPath(); c.ellipse(382, 318, 40, 7, 0, 0, 7); c.stroke(); c.setLineDash([]);
  drawAvatar(c, { x: 215, y: 312, s: 1.55, color: view.player.color || '#3b7dd9', slots, frame: view.avatar.frame, mood: s.cheer ? 'cheer' : view.pet.mood, t });
  drawPet(c, { x: 380, y: 314, s: 1.6, species: view.pet.species, stage: view.pet.stage, slots: petSlots, mood: s.cheer ? 'cheer' : view.pet.mood, t, hop });
}

// ---------- previews of the Lab's own items (avatar, pet, home) ----------
/** Paint a preview of an avatar, pet or home item into a w x h area. Returns true when it painted. */
export function paintLabItem(c, item, w, h, o = {}) {
  const name = tok(item.id), t = o.t || 0;
  c.save();
  if (item.owner === 'av') {
    const VIEW = { hat: [-90, 72], face: [-74, 44], shirt: [-34, 64], back: [-52, 96], aura: [-52, 128] };
    const [cy, span] = VIEW[item.slot] || [-52, 110];
    const s = Math.min(w, h) / span;
    drawAvatar(c, { x: w / 2, y: h / 2 - cy * s, s, color: o.color || '#3b7dd9', slots: { [item.slot]: item.id }, t });
  } else if (item.owner === 'cf') {
    const VIEW = { hat: [-90, 72], badge: [-36, 56], coat: [-40, 96] };
    const [cy, span] = VIEW[item.slot] || [-52, 110];
    const s = Math.min(w, h) / span;
    drawAvatar(c, { x: w / 2, y: h / 2 - cy * s, s, color: o.color || '#3b7dd9', slots: { ['cf' + item.slot]: item.id }, t });
  } else if (item.owner === 'pet') {
    const s = Math.min(w, h) / 78, slots = { [item.slot]: item.id };
    if (item.slot === 'toy') drawPet(c, { x: w * 0.38, y: h * 0.9, s: s * 1.5, species: o.species || 'fox', stage: 2, slots, t });
    else drawPet(c, { x: w / 2, y: h * 0.96, s: s * 1.5, species: o.species || 'fox', stage: 2, slots, t });
  } else if (item.owner === 'home') {
    if (item.slot === 'wall') paintWall(c, name, 0, 0, w, h);
    else if (item.slot === 'floor') paintFloor(c, name, 0, 0, w, h);
    else if (item.slot === 'poster') { paintWall(c, '', 0, 0, w, h); const pw = h * 0.58, ph = h * 0.78; paintPoster(c, name, (w - pw) / 2, (h - ph) / 2, pw, ph); }
    else if (item.slot === 'banner') { paintWall(c, '', 0, 0, w, h); paintBanner(c, Number(name.slice(1)) || 1, w / 2 - h * 0.18, h * 0.1, h * 0.36, h * 0.6); }
    else if (item.slot === 'shelf') { paintWall(c, '', 0, 0, w, h); rect(c, w * 0.15, h * 0.72, w * 0.7, 6, '#a9743f', '#6e4724', 2); c.save(); c.translate(w / 2, h * 0.72); c.scale(h / 56, h / 56); (SHELF[name] || (() => {}))(c, 0, 0); c.restore(); }
    else return false;
  } else { c.restore(); return false; }
  c.restore();
  return true;
}

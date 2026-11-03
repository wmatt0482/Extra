// The avatar painter (lab/SPEC.md §2.3): the child's colour, five slots (hat, shirt, back, face, aura) and a frame at levels 10/25/50/75/100.
// Pure canvas drawing: the figure stands with its feet at (x, y), about 100 units tall at scale 1. No DOM, no clock (the caller passes `t`).
const SKIN = '#f3c9a3', HAIR = '#4a3426', OUT = 'rgba(15,20,50,.55)';
export const FRAME_COLORS = ['', '#c98a4b', '#cfd6e8', '#ffcf1a', '#37e0c0', '#ff8ad0'];
const tok = (id) => (id ? String(id).split('.').pop() : '');

function poly(c, pts, fill, stroke) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.6; c.stroke(); }
}
function rr(c, x, y, w, h, r, fill, stroke) {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
  if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.6; c.stroke(); }
}
function circ(c, x, y, r, fill, stroke) {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.6; c.stroke(); }
}

// ---- behind the figure: aura and back items
const BACK = {
  satchel: (c) => { rr(c, 8, -52, 20, 22, 4, '#a9743f', OUT); c.strokeStyle = '#6e4724'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-14, -66); c.lineTo(14, -34); c.stroke(); rr(c, 10, -46, 16, 6, 2, '#c99157'); },
  backpack: (c) => { rr(c, -34, -66, 22, 34, 8, '#ff7a45', OUT); rr(c, -32, -50, 18, 12, 4, '#e0592a'); c.strokeStyle = '#7a2e12'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-12, -62); c.lineTo(-12, -40); c.stroke(); },
  jetpack: (c, t) => { rr(c, -36, -66, 12, 34, 5, '#cfd6e8', OUT); rr(c, -22, -66, 12, 34, 5, '#cfd6e8', OUT); rr(c, -36, -48, 26, 5, 1, '#ff4d6d'); const f = 6 + Math.sin(t * 18) * 2; poly(c, [[-35, -32], [-25, -32], [-30, -32 + f * 2.2]], '#ffb347'); poly(c, [[-21, -32], [-11, -32], [-16, -32 + f * 2.2]], '#ffb347'); },
  cape: (c, t) => { const w = Math.sin(t * 3) * 3; c.beginPath(); c.moveTo(-14, -64); c.quadraticCurveTo(-42 + w, -40, -38 + w, -4); c.lineTo(34 + w, -4); c.quadraticCurveTo(40 + w, -40, 14, -64); c.closePath(); c.fillStyle = '#d6285a'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(); },
  wings: (c, t) => { const f = Math.sin(t * 4) * 3; for (const s of [-1, 1]) { c.save(); c.scale(s, 1); poly(c, [[10, -62], [46 + f, -92], [54 + f, -66], [42 + f, -56], [46 + f, -40], [28, -46], [12, -34]], '#f4fbff', OUT); c.restore(); } },
};
const AURA = {
  glow: (c, t) => { const g = c.createRadialGradient(0, -50, 8, 0, -50, 70); g.addColorStop(0, 'rgba(120,235,255,.55)'); g.addColorStop(1, 'rgba(120,235,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, -50, 70 + Math.sin(t * 2) * 3, 0, Math.PI * 2); c.fill(); },
  flame: (c, t) => { for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + t, r = 44 + Math.sin(t * 5 + i) * 5; const x = Math.cos(a) * r * 0.9, y = -50 + Math.sin(a) * r * 0.9; poly(c, [[x - 6, y + 8], [x, y - 14 - Math.sin(t * 7 + i) * 3], [x + 6, y + 8]], i % 2 ? '#ff9a3c' : '#ffd23c'); } },
  sparkle: (c, t) => { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + t * 0.8, x = Math.cos(a) * 46, y = -50 + Math.sin(a) * 52, s = 3 + Math.abs(Math.sin(t * 3 + i)) * 3; poly(c, [[x, y - s * 2], [x + s * 0.6, y - s * 0.6], [x + s * 2, y], [x + s * 0.6, y + s * 0.6], [x, y + s * 2], [x - s * 0.6, y + s * 0.6], [x - s * 2, y], [x - s * 0.6, y - s * 0.6]], '#fff7b0'); } },
  rainbow: (c, t) => { const cols = ['#ff4d6d', '#ffb347', '#ffe066', '#7be08a', '#5ab0ff', '#8f7bff']; cols.forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 4; c.globalAlpha = 0.85; c.beginPath(); c.arc(0, -50, 62 - i * 4.4 + Math.sin(t * 2) * 1.2, Math.PI * 1.06, Math.PI * 1.94); c.stroke(); }); c.globalAlpha = 1; },
};

// ---- the shirt (drawn over the body)
function body(c, color, shirt) {
  rr(c, -20, -50, 40, 36, 12, color, OUT);                                   // torso
  rr(c, -30, -48, 12, 26, 6, color, OUT); rr(c, 18, -48, 12, 26, 6, color, OUT);    // arms
  circ(c, -24, -22, 5.5, SKIN, OUT); circ(c, 24, -22, 5.5, SKIN, OUT);        // hands
  const s = tok(shirt);
  if (s === 'hoodie') { rr(c, -20, -50, 40, 36, 12, '#6b7ddb', OUT); rr(c, -30, -48, 12, 26, 6, '#6b7ddb', OUT); rr(c, 18, -48, 12, 26, 6, '#6b7ddb', OUT); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(-5, -50); c.lineTo(-5, -38); c.moveTo(5, -50); c.lineTo(5, -38); c.stroke(); rr(c, -10, -30, 20, 10, 4, '#5666c4'); }
  else if (s === 'tee-star') { c.fillStyle = '#ffe066'; poly(c, starPts(0, -34, 9, 4), '#ffe066'); }
  else if (s === 'jersey') { rr(c, -20, -50, 40, 36, 12, '#e9eaf5', OUT); rr(c, -30, -48, 12, 26, 6, '#e9eaf5', OUT); rr(c, 18, -48, 12, 26, 6, '#e9eaf5', OUT); c.fillStyle = color; c.fillRect(-20, -38, 40, 7); c.fillStyle = '#2a3680'; c.font = '700 14px system-ui,sans-serif'; c.textAlign = 'center'; c.fillText('7', 0, -18); }
  else if (s === 'hero') { rr(c, -20, -50, 40, 36, 12, '#2a55d8', OUT); rr(c, -30, -48, 12, 26, 6, '#2a55d8', OUT); rr(c, 18, -48, 12, 26, 6, '#2a55d8', OUT); poly(c, [[-9, -42], [9, -42], [11, -34], [0, -24], [-11, -34]], '#ffd23c', OUT); c.fillStyle = '#d6285a'; c.fillRect(-20, -22, 40, 4); }
  else if (s === 'stripes') { c.save(); rr(c, -20, -50, 40, 36, 12, null); c.clip(); c.fillStyle = 'rgba(255,255,255,.7)'; for (let y = -48; y < -14; y += 9) c.fillRect(-22, y, 44, 4); c.restore(); }
  else if (s === 'labcoat') { rr(c, -22, -52, 44, 40, 10, '#f4f8ff', OUT); rr(c, -32, -48, 13, 28, 6, '#f4f8ff', OUT); rr(c, 19, -48, 13, 28, 6, '#f4f8ff', OUT); poly(c, [[-4, -52], [0, -40], [4, -52]], color); c.strokeStyle = '#c3cbe6'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, -40); c.lineTo(0, -12); c.stroke(); rr(c, 8, -36, 9, 8, 2, '#dce4fb', '#c3cbe6'); circ(c, -26, -22, 5.5, SKIN, OUT); circ(c, 26, -22, 5.5, SKIN, OUT); }
  rr(c, -13, -12, 11, 14, 4, '#2c3a7a', OUT); rr(c, 2, -12, 11, 14, 4, '#2c3a7a', OUT);                          // legs
  rr(c, -16, -2, 15, 7, 3, '#fff', OUT); rr(c, 1, -2, 15, 7, 3, '#fff', OUT);                                    // shoes
}
function starPts(cx, cy, R, r) { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? r : R; p.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k]); } return p; }

function head(c, mood) {
  circ(c, -18, -74, 5, SKIN, OUT); circ(c, 18, -74, 5, SKIN, OUT);                                               // ears
  circ(c, 0, -74, 19, SKIN, OUT);
  c.fillStyle = HAIR; c.beginPath(); c.arc(0, -78, 19, Math.PI * 1.02, Math.PI * 1.98); c.quadraticCurveTo(8, -88, -8, -80); c.closePath(); c.fill();
  c.fillStyle = '#2a2140'; circ(c, -7, -72, 2.4, '#2a2140'); circ(c, 7, -72, 2.4, '#2a2140');
  c.strokeStyle = '#7a3b2e'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath();
  if (mood === 'cheer') c.arc(0, -68, 6, 0.1 * Math.PI, 0.9 * Math.PI); else c.arc(0, -68.5, 4.5, 0.2 * Math.PI, 0.8 * Math.PI);
  c.stroke();
  c.fillStyle = 'rgba(255,120,120,.35)'; circ(c, -12, -67, 3, 'rgba(255,120,120,.35)'); circ(c, 12, -67, 3, 'rgba(255,120,120,.35)');
}
const FACE = {
  goggles: (c) => { circ(c, -8, -73, 7.5, 'rgba(120,220,255,.55)', '#37465f'); circ(c, 8, -73, 7.5, 'rgba(120,220,255,.55)', '#37465f'); c.strokeStyle = '#37465f'; c.lineWidth = 3; c.beginPath(); c.moveTo(-15.5, -73); c.lineTo(-19, -73); c.moveTo(15.5, -73); c.lineTo(19, -73); c.moveTo(-1, -73); c.lineTo(1, -73); c.stroke(); },
  starshades: (c) => { poly(c, starPts(-8, -73, 8.5, 4), '#ffd23c', '#7a5a00'); poly(c, starPts(8, -73, 8.5, 4), '#ffd23c', '#7a5a00'); },
  shades: (c) => { rr(c, -16, -78, 14, 9, 3, '#1a1f3a'); rr(c, 2, -78, 14, 9, 3, '#1a1f3a'); c.strokeStyle = '#1a1f3a'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-2, -75); c.lineTo(2, -75); c.stroke(); },
};
const HAT = {
  sunhat: (c) => { c.beginPath(); c.ellipse(0, -87, 29, 6.5, 0, 0, Math.PI * 2); c.fillStyle = '#ffcf5a'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(); rr(c, -14, -104, 28, 18, 8, '#ffcf5a', OUT); c.fillStyle = '#ff5a6e'; c.fillRect(-14, -92, 28, 4); },
  headband: (c) => { c.fillStyle = '#ff4d6d'; rr(c, -19, -86, 38, 7, 3, '#ff4d6d', OUT); poly(c, [[17, -84], [30, -90], [26, -80]], '#ff4d6d'); },
  propeller: (c, t) => { rr(c, -15, -97, 30, 14, 9, '#4f8dff', OUT); c.fillStyle = '#ffe066'; c.fillRect(-15, -91, 30, 3); c.strokeStyle = '#2a3680'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(0, -97); c.lineTo(0, -104); c.stroke(); const w = Math.cos(t * 14) * 15; c.fillStyle = '#ff5a6e'; c.beginPath(); c.ellipse(0, -105, Math.abs(w) + 2, 3, 0, 0, Math.PI * 2); c.fill(); },
  cap: (c) => { c.beginPath(); c.arc(0, -82, 19.5, Math.PI, 0); c.closePath(); c.fillStyle = '#2f80ed'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(); rr(c, 4, -84, 24, 6, 3, '#1f5fc0', OUT); circ(c, 0, -96, 2.4, '#fff'); },
  beanie: (c) => { c.beginPath(); c.arc(0, -82, 20, Math.PI, 0); c.closePath(); c.fillStyle = '#7be08a'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(); rr(c, -20, -86, 40, 8, 4, '#4fc263', OUT); circ(c, 0, -103, 4.4, '#fff', OUT); },
  wizard: (c) => { poly(c, [[-20, -87], [20, -87], [3, -128]], '#5a3fd0', OUT); c.beginPath(); c.ellipse(0, -87, 27, 5.5, 0, 0, Math.PI * 2); c.fillStyle = '#4630b0'; c.fill(); c.strokeStyle = OUT; c.stroke(); poly(c, starPts(0, -102, 5.6, 2.5), '#ffe066'); },
  crown: (c) => { poly(c, [[-17, -88], [-17, -104], [-8, -95], [0, -108], [8, -95], [17, -104], [17, -88]], '#ffcf1a', '#a87c00'); circ(c, 0, -96, 2.2, '#ff4d6d'); circ(c, -10, -93, 1.7, '#5ab0ff'); circ(c, 10, -93, 1.7, '#5ab0ff'); },
};

/** Draw the avatar. o = { x, y, s, color, slots: { hat, shirt, back, face, aura }, frame, mood, t }. Slot values are item ids (or null). */
export function drawAvatar(c, o = {}) {
  const { x = 0, y = 0, s = 1, color = '#3b7dd9', slots = {}, frame = 0, mood = 'content', t = 0 } = o;
  c.save();
  c.translate(x, y); c.scale(s, s);
  const bob = mood === 'cheer' ? -Math.abs(Math.sin(t * 9)) * 8 : Math.sin(t * 1.8) * 1.2;
  if (frame > 0) { c.beginPath(); c.arc(0, -50, 62, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.07)'; c.fill(); c.lineWidth = 3 + frame; c.strokeStyle = FRAME_COLORS[Math.min(5, frame)]; c.stroke(); }
  const a = AURA[tok(slots.aura)]; if (a) a(c, t);
  c.translate(0, bob);
  const b = BACK[tok(slots.back)]; if (b) b(c, t);
  body(c, color, slots.shirt);
  head(c, mood);
  const f = FACE[tok(slots.face)]; if (f) f(c);
  const hat = HAT[tok(slots.hat)]; if (hat) hat(c, t);
  c.restore();
}

/** A small round head-and-shoulders portrait for chips and tiles. */
export function drawPortrait(canvas, o = {}) {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(24, Math.round(r.width || canvas.clientWidth || 48)), h = Math.max(24, Math.round(r.height || canvas.clientHeight || 48));
  if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  const s = Math.min(w / 62, h / 58);
  drawAvatar(c, { ...o, x: w / 2, y: h / 2 + 68 * s, s, frame: 0, t: 0 });
  c.setTransform(1, 0, 0, 1, 0, 0);
}
export { SKIN };

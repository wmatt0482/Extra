// The pet painter (lab/SPEC.md §2.3): fox, owl, otter or dino; its stage (1 baby ... 5 legend) follows the child's Lab level; three slots
// (neck, toy, hat). Mood is `content`, `happy` (played today) or `cheer` (a quest or a level-up just happened): never sad, hungry or asleep.
// Pure canvas drawing: the pet stands with its feet at (x, y), about 52 units tall at scale 1.
const OUT = 'rgba(20,16,40,.5)';
const STAGE_SCALE = [0, 0.64, 0.8, 0.95, 1.12, 1.3];
const tok = (id) => (id ? String(id).split('.').pop() : '');
const SPECIES = {
  fox: { body: '#ff8a3c', dark: '#c95a1b', belly: '#fff0dc', nose: '#2a1a14' },
  owl: { body: '#b58b5c', dark: '#7d5a36', belly: '#f4e2c4', nose: '#ffb347' },
  otter: { body: '#8d6a55', dark: '#5f4333', belly: '#ecd5bf', nose: '#2a1a14' },
  dino: { body: '#6fcf6a', dark: '#3f9a43', belly: '#e4f7c8', nose: '#2a4a2a' },
};
function el(c, x, y, rx, ry, fill, stroke, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); } }
function tri(c, a, b, d, fill, stroke) { c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...d); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); } }
function star(c, cx, cy, R, r, fill) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? r : R; c.lineTo(cx + Math.cos(a) * k, cy + Math.sin(a) * k); } c.closePath(); c.fillStyle = fill; c.fill(); }

const TOY = {
  yarn: (c) => { el(c, 30, -6, 8, 8, '#ff6f91', OUT); c.strokeStyle = '#c93d63'; c.lineWidth = 1.4; c.beginPath(); c.arc(30, -6, 5, 0, 4); c.moveTo(24, -4); c.lineTo(36, -8); c.stroke(); },
  frisbee: (c) => { el(c, 30, -8, 11, 3.6, '#4fd6c8', OUT); el(c, 30, -9.5, 6, 1.6, '#a6f1ea'); },
  drum: (c) => { el(c, 30, -4, 9, 3.4, '#e8564a', OUT); c.fillStyle = '#e8564a'; c.fillRect(21, -14, 18, 10); el(c, 30, -14, 9, 3.4, '#f7f0e4', OUT); c.strokeStyle = '#7a1f18'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(22, -13); c.lineTo(30, -5); c.lineTo(38, -13); c.stroke(); },
  ball: (c) => { el(c, 30, -7, 7.5, 7.5, '#ffd23c', OUT); c.strokeStyle = '#c99a00'; c.lineWidth = 1.4; c.beginPath(); c.arc(30, -7, 4.4, -1, 2); c.stroke(); },
};
const NECK = {
  collar: (c) => { c.strokeStyle = '#e8564a'; c.lineWidth = 3.6; c.beginPath(); c.arc(0, -36, 12.5, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); el(c, 0, -23.5, 2.2, 2.2, '#ffd23c'); },
  scarf: (c) => { c.strokeStyle = '#4f8dff'; c.lineWidth = 5; c.beginPath(); c.arc(0, -36, 12.5, 0.12 * Math.PI, 0.88 * Math.PI); c.stroke(); c.fillStyle = '#4f8dff'; c.fillRect(6, -27, 5, 12); c.fillStyle = '#fff'; c.fillRect(6, -22, 5, 2.4); },
  bell: (c) => { c.strokeStyle = '#e8564a'; c.lineWidth = 3; c.beginPath(); c.arc(0, -36, 12.5, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); el(c, 0, -22, 4, 4, '#ffd23c', '#a87c00'); },
  bowtie: (c) => { tri(c, [0, -24], [-8, -29], [-8, -19], '#d6285a', OUT); tri(c, [0, -24], [8, -29], [8, -19], '#d6285a', OUT); el(c, 0, -24, 2.6, 2.6, '#9c1a40'); },
  medal: (c) => { c.strokeStyle = '#4f8dff'; c.lineWidth = 2; c.beginPath(); c.moveTo(-9, -32); c.lineTo(0, -16); c.lineTo(9, -32); c.stroke(); el(c, 0, -14, 4.4, 4.4, '#ffd23c', '#a87c00'); },
};
const HAT = {
  smallcap: (c, hy) => { c.beginPath(); c.arc(0, hy - 1, 10, Math.PI, 0); c.closePath(); c.fillStyle = '#2f80ed'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke(); c.fillStyle = '#1f5fc0'; c.fillRect(2, hy - 3, 12, 3); },
  propellerpet: (c, hy, t) => { c.beginPath(); c.arc(0, hy - 1, 9, Math.PI, 0); c.closePath(); c.fillStyle = '#4f8dff'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke(); c.strokeStyle = '#2a3680'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, hy - 10); c.lineTo(0, hy - 14); c.stroke(); el(c, 0, hy - 15, Math.abs(Math.cos(t * 14)) * 9 + 1.5, 2, '#ff5a6e'); },
  crownpet: (c, hy) => { c.beginPath(); c.moveTo(-9, hy); c.lineTo(-9, hy - 11); c.lineTo(-4, hy - 5); c.lineTo(0, hy - 13); c.lineTo(4, hy - 5); c.lineTo(9, hy - 11); c.lineTo(9, hy); c.closePath(); c.fillStyle = '#ffcf1a'; c.fill(); c.strokeStyle = '#a87c00'; c.lineWidth = 1.4; c.stroke(); },
  party: (c, hy) => { tri(c, [-8, hy], [8, hy], [0, hy - 22], '#ff6fb5', OUT); c.fillStyle = '#ffe066'; for (const [x, y] of [[-3, hy - 6], [2, hy - 11], [0, hy - 16]]) c.fillRect(x - 1.4, y, 2.8, 2.8); el(c, 0, hy - 23, 2.8, 2.8, '#4fd6c8'); },
};

/** Draw the pet. o = { x, y, s, species, stage, slots: { neck, toy, hat }, mood, t, hop } (hop 0..1 lifts it for a tap). */
export function drawPet(c, o = {}) {
  const { x = 0, y = 0, s = 1, species = 'fox', stage = 1, slots = {}, mood = 'content', t = 0, hop = 0 } = o;
  const P = SPECIES[species] || SPECIES.fox, k = STAGE_SCALE[Math.max(1, Math.min(5, stage))];
  const lift = (mood === 'cheer' ? Math.abs(Math.sin(t * 8)) * 9 : 0) + Math.sin(Math.min(1, hop) * Math.PI) * 14;
  const breathe = Math.sin(t * 2.2) * 0.8;
  c.save();
  c.translate(x, y - lift * s); c.scale(s * k, s * k);
  if (stage >= 5) { const g = c.createRadialGradient(0, -28, 6, 0, -28, 46); g.addColorStop(0, 'rgba(255,240,150,.5)'); g.addColorStop(1, 'rgba(255,240,150,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, -28, 46, 0, 7); c.fill(); }
  const toy = TOY[tok(slots.toy)]; if (toy) toy(c);
  // tail
  const wag = Math.sin(t * (mood === 'content' ? 2 : 6)) * 0.22;
  c.save(); c.translate(-14, -14); c.rotate(wag);
  if (species === 'fox') { el(c, -12, -4, 13, 6.5, P.body, OUT, -0.5); el(c, -20, -9, 5, 3.6, '#fff0dc', null, -0.5); }
  else if (species === 'dino') { tri(c, [0, -3], [0, 5], [-22, 4], P.body, OUT); }
  else if (species === 'otter') { el(c, -13, 0, 13, 4.2, P.dark, OUT, 0.1); }
  else { el(c, -6, 2, 5, 3, P.dark, OUT); }
  c.restore();
  // feet and body
  el(c, -8, -2.4, 6.4, 3.6, P.dark, OUT); el(c, 8, -2.4, 6.4, 3.6, P.dark, OUT);
  el(c, 0, -17 + breathe * 0.4, 17, 15 + breathe * 0.4, P.body, OUT);
  el(c, 0, -14, 10, 9.4, P.belly);
  if (species === 'dino') { for (const [px, py] of [[-9, -29], [-1, -33], [8, -29]]) tri(c, [px - 3.4, py + 4], [px + 3.4, py + 4], [px, py - (stage >= 3 ? 5 : 3)], P.dark); }
  if (species === 'owl') { c.strokeStyle = P.dark; c.lineWidth = 1.4; for (const py of [-20, -14, -8]) { c.beginPath(); c.arc(0, py, 5, 0.1 * Math.PI, 0.9 * Math.PI); c.stroke(); } if (stage >= 2) { el(c, -17, -19, 5, 10, P.dark, OUT, 0.2); el(c, 17, -19, 5, 10, P.dark, OUT, -0.2); } }
  // head
  const hs = stage === 1 ? 1.12 : 1, hy = -37;
  c.save(); c.translate(0, hy); c.scale(hs, hs);
  if (species === 'fox') { tri(c, [-14, -6], [-6, -9], [-15, -22], P.body, OUT); tri(c, [14, -6], [6, -9], [15, -22], P.body, OUT); tri(c, [-12, -8], [-8, -10], [-13.5, -18], '#2a1a14'); tri(c, [12, -8], [8, -10], [13.5, -18], '#2a1a14'); }
  if (species === 'otter') { el(c, -13, -9, 3.6, 3.6, P.dark, OUT); el(c, 13, -9, 3.6, 3.6, P.dark, OUT); }
  if (species === 'owl') { tri(c, [-14, -8], [-5, -10], [-15, -20], P.dark, OUT); tri(c, [14, -8], [5, -10], [15, -20], P.dark, OUT); }
  if (species === 'dino') { if (stage >= 3) { tri(c, [-6, -13], [-2, -13], [-4, -21], '#f4e07a', OUT); tri(c, [2, -13], [6, -13], [4, -21], '#f4e07a', OUT); } }
  el(c, 0, 0, 16, 14, P.body, OUT);
  if (species === 'fox') { el(c, 0, 5, 11, 8, P.belly); }
  if (species === 'otter') { el(c, 0, 5, 10, 7.5, P.belly); for (const dx of [-5, 0, 5]) el(c, dx, 7, 0.9, 0.9, P.dark); }
  if (species === 'owl') { el(c, -6.5, -1, 7, 7, P.belly, OUT); el(c, 6.5, -1, 7, 7, P.belly, OUT); }
  if (species === 'dino') { el(c, 0, 5.4, 10.4, 7, P.belly); el(c, -3.6, 5.5, .9, .9, P.dark); el(c, 3.6, 5.5, .9, .9, P.dark); }
  // face
  const ey = species === 'owl' ? -1 : -2;
  if (species === 'owl') { el(c, -6.5, ey, 3.4, 3.4, '#fff'); el(c, 6.5, ey, 3.4, 3.4, '#fff'); }
  el(c, -6.2, ey, 2.2, 2.6, '#1a1530'); el(c, 6.2, ey, 2.2, 2.6, '#1a1530');
  el(c, -5.5, ey - 1, .8, .8, '#fff'); el(c, 6.9, ey - 1, .8, .8, '#fff');
  if (species === 'owl') tri(c, [-2.4, 2.6], [2.4, 2.6], [0, 7.4], P.nose, OUT);
  else el(c, 0, species === 'dino' ? 1.6 : 3.2, species === 'dino' ? 0 : 2.6, species === 'dino' ? 0 : 1.9, P.nose);
  if (species !== 'owl') { c.strokeStyle = '#3a1f1a'; c.lineWidth = 1.3; c.lineCap = 'round'; c.beginPath(); if (mood === 'content') c.arc(0, 4.2, 3.4, 0.2 * Math.PI, 0.8 * Math.PI); else c.arc(0, 3.8, 4.4, 0.05 * Math.PI, 0.95 * Math.PI); c.stroke(); }
  if (mood !== 'content') { el(c, -10.5, 3.6, 2.6, 1.8, 'rgba(255,100,120,.38)'); el(c, 10.5, 3.6, 2.6, 1.8, 'rgba(255,100,120,.38)'); }
  c.restore();
  const neck = NECK[tok(slots.neck)]; if (neck) neck(c);
  const hat = HAT[tok(slots.hat)]; if (hat) hat(c, hy - 12, t);
  if (stage >= 5) { for (let i = 0; i < 4; i++) star(c, Math.cos(t * 1.4 + i * 1.6) * 30, -28 + Math.sin(t * 1.4 + i * 1.6) * 22, 3.4, 1.4, '#fff7b0'); }
  c.restore();
}
export const PET_NAMES = { fox: 'Fox', owl: 'Owl', otter: 'Otter', dino: 'Dino' };

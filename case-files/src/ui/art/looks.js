// The Lab's Case Files looks drawn on the detective avatar (lab/docs/COHESION.md §7): a cap or deerstalker for `hat` (it takes the place of the
// player-coloured fedora), a pin on the lapel for `badge`, a jacket or trench coat over the shirt for `coat`. The same shapes and colours as the
// Lab's own drawing (lab/src/ui/avatar.js COAT / BADGE / DETHAT), laid out for this avatar (origin at the middle of the canvas, head at (0, -4)).
// Everything is a layer on the existing art in ../art.js; null = the game's own look. Shapes are drawn onto a canvas 2D context.
const OUT = '#1a1220';
const poly = (c, pts, fill, stroke) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); } };
const circ = (c, x, y, r, fill, stroke) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); } };
const star = (cx, cy, R, r) => { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r : R; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); } return pts; };
const shoulders = (c, fill) => { c.beginPath(); c.moveTo(-31, 33); c.quadraticCurveTo(-31, 10, -18, 5); c.lineTo(18, 5); c.quadraticCurveTo(31, 10, 31, 33); c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1; c.stroke(); };

export const COAT = {
  // a brown tweed jacket with a pale shirt V and lapels
  'cf.coat.tweed': (c) => {
    shoulders(c, '#8a5a34');
    c.strokeStyle = 'rgba(60,30,10,.38)'; c.lineWidth = 1; for (let i = -24; i <= 24; i += 6) { c.beginPath(); c.moveTo(i, 7); c.lineTo(i, 32); c.stroke(); }
    poly(c, [[-9, 5], [0, 22], [9, 5]], '#e8dcc0');
    poly(c, [[-22, 6], [-8, 6], [-1, 24], [-9, 27]], '#6e4526', OUT); poly(c, [[22, 6], [8, 6], [1, 24], [9, 27]], '#6e4526', OUT);
    circ(c, 0, 28, 1.4, '#3a220f');
  },
  // a tan trench coat: wide collar, a belt and a buckle
  'cf.coat.trench': (c) => {
    shoulders(c, '#c9a46a');
    poly(c, [[-9, 5], [0, 20], [9, 5]], '#e8dcc0');
    poly(c, [[-24, 5], [-8, 5], [-1, 26], [-14, 23]], '#b38a4e', OUT); poly(c, [[24, 5], [8, 5], [1, 26], [14, 23]], '#b38a4e', OUT);
    c.fillStyle = '#7a5a2a'; c.fillRect(-30, 27, 60, 5); c.fillStyle = '#e0c068'; c.fillRect(-3, 26.5, 6, 6);
    c.strokeStyle = '#7a5a2a'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 22); c.lineTo(0, 27); c.stroke();
  },
};

export const BADGE = {
  // a brass magnifier pin on the left lapel
  'cf.badge.magnifier': (c) => { circ(c, -16, 19, 4.6, '#d9a21b', '#7a5a00'); circ(c, -16.5, 18.5, 2.1, '#bfefff', '#5a4300'); c.strokeStyle = '#5a4300'; c.lineWidth = 1.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-14.6, 20.6); c.lineTo(-12.4, 22.8); c.stroke(); },
  // a gold shield with a star
  'cf.badge.goldbadge': (c) => { poly(c, [[-20, 14], [-11, 14], [-11, 20], [-15.5, 25.5], [-20, 20]], '#ffcf1a', '#a87c00'); poly(c, star(-15.5, 18.5, 3.1, 1.3), '#fff2a0'); },
};

export const HAT = {
  // a flat green cap with a short brim
  'cf.hat.detcap': (c) => {
    c.beginPath(); c.moveTo(-14, -13); c.quadraticCurveTo(-14, -29, 0, -29); c.quadraticCurveTo(14, -29, 14, -13); c.quadraticCurveTo(0, -10, -14, -13); c.closePath(); c.fillStyle = '#5b6b46'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
    c.beginPath(); c.moveTo(2, -15); c.quadraticCurveTo(14, -13.5, 21, -11); c.quadraticCurveTo(14, -9, 2, -11); c.closePath(); c.fillStyle = '#3f4c2f'; c.fill(); c.strokeStyle = OUT; c.stroke();
    circ(c, 0, -28.5, 1.6, '#3f4c2f');
  },
  // a tan checked cap, a peak front and back and ear flaps
  'cf.hat.deerstalker': (c) => {
    poly(c, [[-14, -14], [-24, -11], [-14, -9]], '#a68a58', OUT); poly(c, [[14, -14], [24, -11], [14, -9]], '#a68a58', OUT);
    poly(c, [[-14, -8], [-17, 3], [-11, 4], [-9, -6]], '#a68a58', OUT); poly(c, [[14, -8], [17, 3], [11, 4], [9, -6]], '#a68a58', OUT);
    c.beginPath(); c.moveTo(-14.5, -13); c.quadraticCurveTo(-14.5, -30, 0, -30); c.quadraticCurveTo(14.5, -30, 14.5, -13); c.closePath(); c.fillStyle = '#b79a68'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
    c.save(); c.clip(); c.fillStyle = 'rgba(80,55,20,.38)'; for (let y = -30; y < -12; y += 4.5) for (let x = -15; x < 15; x += 4.5) if (Math.round((x + y) / 4.5) % 2 === 0) c.fillRect(x, y, 4.5, 4.5); c.restore();
    c.fillStyle = '#8f7444'; c.fillRect(-14.5, -15, 29, 2.4);
    circ(c, 0, -30, 1.6, '#6b5430');
  },
};

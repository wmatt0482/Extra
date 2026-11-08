// Procedural art for Case Files (no image files): the detective avatar for the picker and the chips, small inline icons the shared
// icon set does not have, and the red string on the cork board. The rest of the art lives in ./art/ and is re-exported here, so a
// call site only ever imports from art.js:
//   scene.js       drawBackdrop(svg)     the living detective-office backdrop (style/scene.css)
//   characters.js  pipAvatar(mood) ('happy' | 'thinking' | 'surprised' | 'cheer'), chiefAvatar(), wenAvatar(), portrait(who, mood)
//   docs.js        docArt(kind)          a small illustration per document kind
//   routemap.js    createRouteMap(...)   the Erie Canal route on the agency home
//   enhance.js     startEnhancers(app)   swaps the "PT" / "CH" badges for portraits, adds the document pictures, Pip's moods
import { drawBackdrop as sceneBackdrop } from './art/scene.js';
import { startEnhancers } from './art/enhance.js';
export { createRouteMap } from './art/routemap.js';
export { pipAvatar, chiefAvatar, wenAvatar, portrait, PIP_MOODS, NAMES } from './art/characters.js';
export { docArt, DOC_KIND_NAME } from './art/docs.js';

/** Fill the backdrop (called once at boot by main.js) and start the small art enhancers (portraits, document pictures). */
export function drawBackdrop(svg) { sceneBackdrop(svg); startEnhancers(); }

/** The player's detective: a fedora in the player's color, a trench-coat collar, a magnifier. */
export function drawAvatar(canvas, color = '#2fd1c0') {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(24, Math.round(r.width || 64)), hh = Math.max(24, Math.round(r.height || 64));
  canvas.width = w * dpr; canvas.height = hh * dpr;
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, hh);
  const s = Math.min(w, hh) / 64;
  c.translate(w / 2, hh / 2); c.scale(s, s);
  // coat and collar
  c.fillStyle = '#2b3a55'; c.beginPath(); c.moveTo(-30, 32); c.quadraticCurveTo(-30, 10, -18, 6); c.lineTo(18, 6); c.quadraticCurveTo(30, 10, 30, 32); c.closePath(); c.fill();
  c.fillStyle = '#e8dcc0'; c.beginPath(); c.moveTo(-9, 6); c.lineTo(0, 20); c.lineTo(9, 6); c.closePath(); c.fill();
  c.fillStyle = '#1d2840'; c.beginPath(); c.moveTo(-22, 8); c.lineTo(-8, 8); c.lineTo(-2, 24); c.closePath(); c.fill(); c.beginPath(); c.moveTo(22, 8); c.lineTo(8, 8); c.lineTo(2, 24); c.closePath(); c.fill();
  // face
  c.fillStyle = '#d9a67e'; c.beginPath(); c.ellipse(0, -4, 13, 14, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#1b1f2a'; c.beginPath(); c.arc(-5, -3, 1.9, 0, Math.PI * 2); c.arc(5, -3, 1.9, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#6a3f27'; c.lineWidth = 2; c.beginPath(); c.moveTo(-4, 5); c.quadraticCurveTo(0, 8, 4, 5); c.stroke();
  // fedora
  c.fillStyle = color; c.beginPath(); c.ellipse(0, -13, 25, 6.5, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(-14, -14); c.quadraticCurveTo(-13, -30, 0, -30); c.quadraticCurveTo(13, -30, 14, -14); c.closePath(); c.fill();
  c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-14, -19, 28, 5);
  c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.ellipse(-7, -27, 4, 2, -0.5, 0, Math.PI * 2); c.fill();
  // magnifier
  c.strokeStyle = '#dcab4a'; c.lineWidth = 3.2; c.beginPath(); c.arc(21, 18, 7, 0, Math.PI * 2); c.stroke();
  c.fillStyle = 'rgba(160,220,255,.35)'; c.beginPath(); c.arc(21, 18, 6, 0, Math.PI * 2); c.fill();
  c.lineCap = 'round'; c.lineWidth = 3.6; c.beginPath(); c.moveTo(26, 23); c.lineTo(31, 29); c.stroke();
  c.setTransform(1, 0, 0, 1, 0, 0);
}

/** Inline icons the shared set does not have (24x24, currentColor). */
export const EXTRA_ICONS = {
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 14v7"/></svg>',
  magnifier: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l6 6"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.7.6 1 1.2 1 2.1h5c0-.9.3-1.5 1-2.1A6 6 0 0 0 12 3z"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/></svg>',
  board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8" cy="9" r="1.2" fill="currentColor"/><circle cx="16" cy="8" r="1.2" fill="currentColor"/><circle cx="12" cy="15" r="1.2" fill="currentColor"/><path d="M8 9l8-1M16 8l-4 7M12 15L8 9" stroke="#e0463f"/></svg>',
};

/** Red string over a cork board: a polyline through the top-center of each clue card (call after layout). */
export function drawString(svg, grid) {
  if (!svg || !grid) return;
  const box = svg.getBoundingClientRect();
  const pts = [...grid.children].filter((c) => c.classList.contains('clue')).map((c) => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2 - box.left, r.top + 9 - box.top]; });
  if (pts.length < 2) { svg.innerHTML = ''; return; }
  svg.setAttribute('viewBox', `0 0 ${Math.max(1, box.width)} ${Math.max(1, box.height)}`);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    d += ` Q${(x0 + x1) / 2} ${Math.max(y0, y1) + 18} ${x1} ${y1}`;
  }
  svg.innerHTML = `<path d="${d}" fill="none" stroke="#7a1612" stroke-width="3.4" stroke-linecap="round" opacity=".4" transform="translate(1.5 3)"/><path d="${d}" fill="none" stroke="#e0463f" stroke-width="2.6" stroke-linecap="round"/>`;
}

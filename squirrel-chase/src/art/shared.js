// Shared helpers for the Squirrel Chase art: palette, unique ids, a seeded random generator, round-badge wrapper, face helpers.
// Pure functions only; everything returns SVG strings.

export const INK = '#1f1630';
export const PAL = Object.freeze({
  paper: '#f7edd3', paperDk: '#e9d9b0', sky: '#8fd3f4', skyLt: '#c8ecfa', sun: '#ffc93c', coral: '#ff6f59', red: '#d94a3d',
  teal: '#1fa89a', navy: '#22365f', brass: '#dcab4a', water: '#7cc4e8', waterDk: '#4fa3d1', green: '#5fae5a', greenDk: '#3d8a48', ink: INK,
});

let n = 0;
/** A unique id prefix per call (clip paths / gradients inside inline SVG must not collide when many are on one page). */
export const uid = (p = 'sq') => `${p}${++n}`;

/** FNV-1a string hash -> unsigned int. */
export function hash(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
/** mulberry32 seeded generator. */
export function rng(seed) {
  let a = (typeof seed === 'number' ? seed : hash(seed)) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const SLAB = "'Alfa Slab One','Rockwell','Georgia','DejaVu Serif',serif";
export const SANS = "'Baloo 2','Nunito','Trebuchet MS','Segoe UI',system-ui,sans-serif";

/** Round badge portrait (viewBox 0 0 100 100): the art is scaled up inside the ring so faces read big. */
export function badge(inner, { ring = true, ringColor = '#2fd1c0', ringFill = '#cfeefa', cls = '', scale = 1.2 } = {}) {
  const id = uid('sqc');
  const body = ring
    ? `<g clip-path="url(#${id})"><g transform="translate(50 60) scale(${scale}) translate(-50 -60)">${inner}</g></g><circle cx="50" cy="50" r="47" fill="none" stroke="${ringColor}" stroke-width="4"/>`
    : inner;
  return `<svg class="sq-char ${cls}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${ring ? `<defs><clipPath id="${id}"><circle cx="50" cy="50" r="46"/></clipPath></defs><circle cx="50" cy="50" r="48" fill="${ringFill}"/>` : ''}${body}</svg>`;
}

export const stroke = (c, w = 2.4) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

/**
 * A pair of eyes for a mood: smug | surprised | sorry | laughing.
 * { xs:[left,right], y, r, pupil, white, lid (fur colour that covers the top of a smug eye), slit (goat pupils), iris }
 */
export function eyePair({ xs = [42, 58], y = 50, r = 4.4, mood = 'smug', pupil = INK, white = '#fff', lid = '#c77', slit = false, iris = null } = {}) {
  let o = '';
  xs.forEach((x, i) => {
    if (mood === 'laughing') { o += `<path d="M${x - r} ${y + r * 0.5}Q${x} ${y - r * 1.5} ${x + r} ${y + r * 0.5}" ${stroke(INK, 2.7)}/>`; return; }
    const R = mood === 'surprised' ? r * 1.22 : r;
    o += `<ellipse cx="${x}" cy="${y}" rx="${R}" ry="${R * 1.06}" fill="${white}"/>`;
    if (iris) o += `<ellipse cx="${x}" cy="${y}" rx="${R * 0.84}" ry="${R * 0.92}" fill="${iris}"/>`;
    const dx = mood === 'smug' ? R * 0.35 : 0;
    const dy = mood === 'sorry' ? -R * 0.28 : mood === 'smug' ? R * 0.12 : 0;
    const pr = mood === 'surprised' ? R * 0.4 : R * 0.6;
    if (slit) o += `<rect x="${x + dx - pr * 1.15}" y="${y + dy - pr * 0.42}" width="${pr * 2.3}" height="${pr * 0.84}" rx="${pr * 0.4}" fill="${pupil}"/>`;
    else o += `<circle cx="${x + dx}" cy="${y + dy}" r="${pr}" fill="${pupil}"/><circle cx="${x + dx - pr * 0.35}" cy="${y + dy - pr * 0.4}" r="${Math.max(0.8, pr * 0.32)}" fill="#fff"/>`;
    if (mood === 'smug') {
      o += `<path d="M${x - R - 0.5} ${y - R * 0.05}A${R + 0.5} ${R * 1.06 + 0.5} 0 0 1 ${x + R + 0.5} ${y - R * 0.05}Z" fill="${lid}"/><path d="M${x - R - 0.7} ${y - R * 0.05}L${x + R + 0.7} ${y - R * 0.05}" ${stroke(INK, 1.8)}/>`;
    }
  });
  return o;
}

/** Brows for a mood; xs = eye centres, y = eye y; colour. */
export function browPair({ xs = [42, 58], y = 50, r = 4.4, mood = 'smug', color = '#3a2012', w = 2.6 } = {}) {
  return xs.map((x, i) => {
    const s = i ? 1 : -1; // -1 left eye, +1 right eye; "inner" end points toward the middle
    const ox = x - r * 1.2, ex = x + r * 1.2;
    const by = y - r * 1.75;
    if (mood === 'surprised') return `<path d="M${ox} ${by - 1}Q${x} ${by - 5.2} ${ex} ${by - 1}" ${stroke(color, w)}/>`;
    if (mood === 'laughing') return `<path d="M${ox} ${by}Q${x} ${by - 3.8} ${ex} ${by}" ${stroke(color, w)}/>`;
    if (mood === 'sorry') { const inY = by - 2.6, outY = by + 1; return `<path d="M${s < 0 ? ox : ex} ${outY}Q${x} ${by} ${s < 0 ? ex : ox} ${inY}" ${stroke(color, w)}/>`; }
    // smug: one brow cocked high, the other flat and low
    return i ? `<path d="M${ox} ${by + 0.6}Q${x} ${by - 0.8} ${ex} ${by + 0.4}" ${stroke(color, w)}/>` : `<path d="M${ox} ${by + 1.2}Q${x - 0.5} ${by - 3.4} ${ex} ${by - 1.4}" ${stroke(color, w)}/>`;
  }).join('');
}

/** A mouth hanging under a nose at (cx, cy), half-width w. mood: smug | surprised | sorry | laughing. */
export function mouthFor(mood, cx, cy, w = 6, { dark = '#6b1f2a', tongue = '#f08a8a', line = INK } = {}) {
  if (mood === 'surprised') return `<ellipse cx="${cx}" cy="${cy + w * 0.55}" rx="${w * 0.42}" ry="${w * 0.55}" fill="${dark}"/><ellipse cx="${cx}" cy="${cy + w * 0.8}" rx="${w * 0.26}" ry="${w * 0.2}" fill="${tongue}"/>`;
  if (mood === 'sorry') return `<path d="M${cx - w * 0.85} ${cy + w * 0.7}Q${cx - w * 0.4} ${cy - w * 0.05} ${cx} ${cy + w * 0.35}Q${cx + w * 0.4} ${cy - w * 0.05} ${cx + w * 0.85} ${cy + w * 0.7}" ${stroke(line, 2.1)}/>`;
  if (mood === 'laughing') return `<path d="M${cx - w} ${cy - w * 0.05}Q${cx} ${cy + w * 0.35} ${cx + w} ${cy - w * 0.05}Q${cx + w * 0.8} ${cy + w * 1.9} ${cx} ${cy + w * 1.9}Q${cx - w * 0.8} ${cy + w * 1.9} ${cx - w} ${cy - w * 0.05}Z" fill="${dark}"/><path d="M${cx - w * 0.55} ${cy + w * 1.35}Q${cx} ${cy + w * 0.7} ${cx + w * 0.55} ${cy + w * 1.35}Q${cx} ${cy + w * 1.8} ${cx - w * 0.55} ${cy + w * 1.35}Z" fill="${tongue}"/>`;
  return `<path d="M${cx - w * 0.8} ${cy + w * 0.15}Q${cx - w * 0.1} ${cy + w * 0.75} ${cx + w * 0.95} ${cy - w * 0.4}" ${stroke(line, 2.2)}/><path d="M${cx + w * 1.05} ${cy - w * 0.1}l${w * 0.18} -${w * 0.42}" ${stroke(line, 1.3)}/>`;
}

/** Little mood marks around a head: sweat drop (sorry), burst lines (surprised), tears of joy (laughing), twinkle (smug). */
export function moodMarks(mood, { x = 78, y = 36, left = 22 } = {}) {
  if (mood === 'sorry') return `<path d="M${x} ${y}q5 8 0 11q-5 -3 0 -11z" fill="#8fd3f4" stroke="#3d8fc0" stroke-width="1"/><path d="M${x - 1.5} ${y + 5}q-1 2 0.5 3" ${stroke('#fff', 1)}/>`;
  if (mood === 'surprised') return `<g ${stroke('#ffc93c', 2.6)}><path d="M${x} ${y - 6}l5 -5M${x + 3} ${y + 2}l7 -1"/><path d="M${left} ${y - 6}l-5 -5M${left - 3} ${y + 2}l-7 -1"/></g>`;
  if (mood === 'laughing') return `<g fill="#8fd3f4" stroke="#3d8fc0" stroke-width=".9"><path d="M${x - 8} ${y + 16}q5 -5 7 0q-1 5 -4 5q-4 0 -3 -5z"/><path d="M${left + 8} ${y + 16}q-5 -5 -7 0q1 5 4 5q4 0 3 -5z"/></g>`;
  return `<path d="M${x} ${y - 6}l1.6 4.4 4.4 1.6 -4.4 1.6 -1.6 4.4 -1.6 -4.4 -4.4 -1.6 4.4 -1.6z" fill="#fff4b0" stroke="#e8a900" stroke-width="1"/>`;
}

/** A letter tile (the swiped goods): cream square with a letter. */
export function tile(letter, x, y, rot = 0, s = 11, fill = '#fff3d4') {
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="${s * 0.2}" fill="${fill}" stroke="#c79a4a" stroke-width="1.1"/><text x="0" y="${s * 0.33}" text-anchor="middle" font-family="${SLAB}" font-size="${s * 0.78}" fill="#7a4a12">${esc(letter)}</text></g>`;
}

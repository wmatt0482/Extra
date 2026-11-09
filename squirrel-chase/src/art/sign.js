// Landmark signs with swiped letters. signSvg(text, missingIdx, opts) draws a wood / metal / neon sign (variant picked from the text, or opts.variant)
// whose letters at `missingIdx` (indexes into `text`, spaces count) are empty slots. animateLetterIn(el, idx) flies a recovered letter into its slot.
import { hash, uid, esc, SLAB } from './shared.js';

export const SIGN_VARIANTS = Object.freeze(['wood', 'metal', 'neon']);

function layout(text) {
  const t = String(text);
  const words = t.split(' ');
  let lines = [t];
  if (t.length > 11 && words.length > 1) {
    // split at the space that makes the two halves most even
    let best = 0, bestD = 1e9, pos = 0;
    for (let i = 0; i < words.length - 1; i++) { pos += words[i].length; const d = Math.abs(pos - (t.length - pos - 1)); if (d < bestD) { bestD = d; best = i; } pos += 1; }
    lines = [words.slice(0, best + 1).join(' '), words.slice(best + 1).join(' ')];
  }
  return lines;
}

/**
 * signSvg(text, missingIdx = [], opts?) -> SVG string. opts: { variant: 'wood'|'metal'|'neon' }.
 * Each present letter is <g class="sq-letter" data-idx>; each missing one is <g class="sq-slot" data-slot data-letter> with an empty slot.
 */
export function signSvg(text, missingIdx = [], opts = {}) {
  const t = String(text || '').toUpperCase();
  const variant = SIGN_VARIANTS.includes(opts.variant) ? opts.variant : SIGN_VARIANTS[hash(t) % 3];
  const missing = new Set(missingIdx);
  const lines = layout(t);
  const fs = 64, cw = fs * 0.82, sp = cw * 0.55, lh = fs * 1.22;
  const lw = (ln) => [...ln].reduce((a, c) => a + (c === ' ' ? sp : cw), 0);
  const maxW = Math.max(...lines.map(lw));
  const padX = 54, padY = 40, postH = variant === 'wood' ? 54 : variant === 'metal' ? 40 : 28;
  const W = Math.ceil(maxW + padX * 2), bodyH = Math.ceil(lines.length * lh + padY * 2 - (lh - fs) );
  const H = bodyH + postH;
  const id = uid('sqs');

  const th = {
    wood: { board: '#b07a40', boardDk: '#7e4f24', letter: '#fff3d2', edge: '#5a3416', slot: '#6a4020', slotLn: '#e9c88a' },
    metal: { board: '#1f8559', boardDk: '#14583b', letter: '#ffffff', edge: '#0d3f2a', slot: '#13543a', slotLn: '#bfe8d2' },
    neon: { board: '#1b1740', boardDk: '#0f0c2a', letter: '#ff8be0', edge: '#3b3470', slot: '#1b1740', slotLn: '#5a5290' },
  }[variant];

  let board = '', post = '';
  if (variant === 'wood') {
    const planks = Math.max(2, lines.length + 1), ph = bodyH / planks;
    board = `<rect x="6" y="6" width="${W - 12}" height="${bodyH - 6}" rx="12" fill="${th.board}" stroke="${th.edge}" stroke-width="5"/>`;
    for (let i = 1; i < planks; i++) board += `<path d="M10 ${6 + i * ph}H${W - 10}" stroke="${th.boardDk}" stroke-width="3" opacity=".7"/>`;
    for (let i = 0; i < planks; i++) board += `<path d="M${W * 0.2} ${6 + i * ph + ph * 0.4}q30 -6 70 0M${W * 0.62} ${6 + i * ph + ph * 0.7}q24 5 56 0" fill="none" stroke="${th.boardDk}" stroke-width="2" opacity=".35"/>`;
    board += [[22, 22], [W - 22, 22], [22, bodyH - 16], [W - 22, bodyH - 16]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.4" fill="#d8d2c2" stroke="#6b6558" stroke-width="1.4"/>`).join('');
    post = `<rect x="${W * 0.2}" y="${bodyH - 4}" width="16" height="${postH + 4}" fill="#7e4f24"/><rect x="${W * 0.8 - 16}" y="${bodyH - 4}" width="16" height="${postH + 4}" fill="#7e4f24"/>`;
  } else if (variant === 'metal') {
    board = `<rect x="6" y="6" width="${W - 12}" height="${bodyH - 6}" rx="16" fill="${th.board}" stroke="#e8e6dc" stroke-width="5"/><rect x="18" y="18" width="${W - 36}" height="${bodyH - 30}" rx="10" fill="none" stroke="#fff" stroke-width="3"/>`;
    board += `<path d="M14 ${bodyH * 0.35}Q${W / 2} ${bodyH * 0.1} ${W - 14} ${bodyH * 0.3}" fill="none" stroke="#fff" stroke-width="6" opacity=".1"/>`;
    board += [[14, 14], [W - 14, 14], [14, bodyH - 10], [W - 14, bodyH - 10]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#e8e6dc"/>`).join('');
    post = `<rect x="${W / 2 - 7}" y="${bodyH - 4}" width="14" height="${postH + 4}" fill="#8a8f98"/><rect x="${W / 2 - 3}" y="${bodyH - 4}" width="4" height="${postH + 4}" fill="#b8bdc6"/>`;
  } else {
    board = `<rect x="6" y="6" width="${W - 12}" height="${bodyH - 6}" rx="20" fill="${th.board}" stroke="${th.edge}" stroke-width="5"/><rect x="16" y="16" width="${W - 32}" height="${bodyH - 26}" rx="14" fill="none" stroke="#ffd24a" stroke-width="3" opacity=".8"/>`;
    board += [[W * 0.12, 8], [W * 0.88, 8]].map(([x]) => `<circle cx="${x}" cy="${bodyH + 2}" r="1" fill="none"/>`).join('');
    post = `<path d="M${W * 0.25} ${bodyH - 4}v${postH}M${W * 0.75} ${bodyH - 4}v${postH}" stroke="#6e6a8a" stroke-width="7" stroke-linecap="round"/>`;
  }

  let glyphs = '';
  let idx = 0;
  lines.forEach((ln, li) => {
    const w = lw(ln);
    let x = (W - w) / 2;
    const y = padY + li * lh + fs * 0.82;
    for (const ch of ln) {
      if (ch === ' ') { x += sp; idx++; continue; }
      const cx = x + cw / 2;
      if (missing.has(idx)) {
        const sw = cw * 0.94, sh = fs * 0.98;
        glyphs += `<g class="sq-slot" data-slot="${idx}" data-letter="${esc(ch)}"><rect class="sq-slot-bg" x="${cx - sw / 2}" y="${y - fs * 0.78}" width="${sw}" height="${sh}" rx="7" fill="${th.slot}" stroke="${th.slotLn}" stroke-width="2.4" stroke-dasharray="6 5" opacity=".95"/>${variant === 'neon' ? '' : `<rect x="${cx - sw / 2 + 2}" y="${y - fs * 0.78 + 2}" width="${sw - 4}" height="${sh * 0.3}" rx="5" fill="#000" opacity=".16"/>`}<text class="sq-slot-letter" x="${cx}" y="${y}" text-anchor="middle" font-family="${SLAB}" font-size="${fs}" opacity="0" style="transform-box:fill-box;transform-origin:center" ${letterPaint(variant, th)}>${esc(ch)}</text></g>`;
      } else {
        glyphs += `<g class="sq-letter" data-idx="${idx}">${letterEl(variant, th, esc(ch), cx, y, fs)}</g>`;
      }
      x += cw; idx++;
    }
  });

  return `<svg class="sq-sign sq-sign-${variant}" id="${id}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sign with missing letters" data-text="${esc(t)}">${post}${board}${glyphs}</svg>`;
}

function letterPaint(variant, th) {
  if (variant === 'neon') return `fill="none" stroke="${th.letter}" stroke-width="3.4" stroke-linejoin="round"`;
  return `fill="${th.letter}" stroke="${th.edge}" stroke-width="${variant === 'wood' ? 5 : 0}" paint-order="stroke" stroke-linejoin="round"`;
}
function letterEl(variant, th, ch, cx, y, fs) {
  const base = `x="${cx}" y="${y}" text-anchor="middle" font-family="${SLAB}" font-size="${fs}"`;
  if (variant === 'neon') return `<text ${base} fill="none" stroke="${th.letter}" stroke-width="10" opacity=".28" stroke-linejoin="round">${ch}</text><text ${base} ${letterPaint(variant, th)}>${ch}</text><text ${base} fill="none" stroke="#fff" stroke-width="1.2" opacity=".8">${ch}</text>`;
  if (variant === 'wood') return `<text ${base} x="${cx + 2}" y="${y + 3}" fill="#000" opacity=".25">${ch}</text><text ${base} ${letterPaint(variant, th)}>${ch}</text>`;
  return `<text ${base} x="${cx + 1.5}" y="${y + 2.5}" fill="#000" opacity=".25">${ch}</text><text ${base} ${letterPaint(variant, th)}>${ch}</text>`;
}

const reduced = () => { try { return !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; } };

/**
 * animateLetterIn(el, idx): el is the sign's svg (or any element containing it). The missing letter at `idx` flies in from the upper left,
 * lands with a bounce and a sparkle ring. Reduced motion: a plain fade. Returns a Promise that resolves when it has landed (also resolves if
 * the slot is already filled or not found, so callers can always await it).
 */
export function animateLetterIn(el, idx) {
  const slot = el && el.querySelector ? (el.matches && el.matches(`[data-slot="${idx}"]`) ? el : el.querySelector(`[data-slot="${idx}"]`)) : null;
  if (!slot || slot.getAttribute('data-filled') === '1') return Promise.resolve(false);
  slot.setAttribute('data-filled', '1');
  const svg = slot.ownerSVGElement;
  const vb = svg && svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal : { width: 600, height: 200 };
  const letter = slot.querySelector('.sq-slot-letter');
  const bg = slot.querySelector('.sq-slot-bg');
  const finish = () => { letter.setAttribute('opacity', '1'); letter.style.opacity = '1'; if (bg) bg.style.display = 'none'; slot.classList.add('sq-filled'); };
  if (!letter.animate) { finish(); return Promise.resolve(true); }
  if (reduced()) {
    finish();
    return letter.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' }).finished.then(() => true, () => true);
  }
  if (bg) bg.animate([{ opacity: 0.95 }, { opacity: 0.95 }], { duration: 650 }); // keep the empty slot until the letter lands
  const dx = -vb.width * 0.55, dy = -vb.height * 1.6;
  const a = letter.animate([
    { opacity: 0, transform: `translate(${dx}px,${dy}px) rotate(-200deg) scale(2.4)` },
    { opacity: 1, transform: `translate(${dx * 0.1}px,${dy * 0.12}px) rotate(14deg) scale(1.35)`, offset: 0.7 },
    { opacity: 1, transform: 'translate(0,0) rotate(-6deg) scale(0.9)', offset: 0.85 },
    { opacity: 1, transform: 'translate(0,0) rotate(0) scale(1)' },
  ], { duration: 760, easing: 'cubic-bezier(.3,.6,.4,1)' });
  
  letter.style.opacity = '0';
  a.addEventListener && a.addEventListener('finish', () => { letter.style.opacity = '1'; });
  letter.setAttribute('opacity', '1');
  return a.finished.then(() => { finish(); sparkle(slot, bg); return true; }, () => { finish(); return true; });
}

function sparkle(slot, bg) {
  if (!bg || !slot.ownerDocument) return;
  const x = +bg.getAttribute('x') + +bg.getAttribute('width') / 2, y = +bg.getAttribute('y') + +bg.getAttribute('height') / 2;
  const ns = 'http://www.w3.org/2000/svg';
  const g = slot.ownerDocument.createElementNS(ns, 'g');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, c = slot.ownerDocument.createElementNS(ns, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', i % 2 ? 3 : 4.5); c.setAttribute('fill', i % 2 ? '#fff4b0' : '#ffc93c');
    g.appendChild(c);
    if (c.animate) c.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * 46}px,${Math.sin(a) * 40}px) scale(.2)`, opacity: 0 }], { duration: 520, easing: 'ease-out' });
  }
  slot.appendChild(g);
  setTimeout(() => g.remove(), 560);
}

/** Fill a slot at once, no animation (e.g. when restoring a closed case). */
export function fillLetter(el, idx) {
  const slot = el && el.querySelector ? el.querySelector(`[data-slot="${idx}"]`) : null;
  if (!slot) return false;
  slot.setAttribute('data-filled', '1');
  const l = slot.querySelector('.sq-slot-letter'); l.setAttribute('opacity', '1');
  const bg = slot.querySelector('.sq-slot-bg'); if (bg) bg.style.display = 'none';
  slot.classList.add('sq-filled');
  return true;
}

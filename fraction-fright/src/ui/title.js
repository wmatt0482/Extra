// The title's yard at dusk (SPEC §2, §7), drawn as SVG behind every menu: the street of houses, the neighbours the
// kid has cured (one new neighbour on the street for every 10 cures: the Cure Counter growing the town), the fence in
// the chosen style, the pumpkins planted after final waves and a few drops of the chosen goo. Procedural, no images.
import { itemOf } from '../data/looks.js';
import { neighboursFor } from '../meta/economy.js';

export const MAX_SHOWN = 30;

/** The tally board's chalk marks: the cures toward the next neighbour (n % 10) as groups of five (4 strokes + 1 across). */
export function tallySvg(cures, cls = 'tally') {
  const n = Math.max(0, Math.floor(cures || 0)) % 10;
  let marks = '';
  for (let i = 0; i < n; i++) {
    const g = Math.floor(i / 5), k = i % 5, x0 = 6 + g * 38;
    marks += k < 4 ? `<path d="M${x0 + k * 7} 4 l${(k % 2) * 1.5 - 0.7} 18" />` : `<path d="M${x0 - 4} 18 L${x0 + 26} 7" />`;
  }
  return `<svg class="${cls}" viewBox="0 0 80 26" data-marks="${n}" aria-hidden="true"><g stroke="#ece7da" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".9">${marks}</g></svg>`;
}
const HOUSE = ['#24222b', '#1f2326', '#2a2224', '#222027', '#26211f', '#1d2124'];
const SHIRTS = ['#8a2b2b', '#2b4a6e', '#3d5a2a', '#6e5a22', '#4a3466', '#7a3d14', '#2a5a5e', '#5e2a46'];
const SKIN = ['#f2c29b', '#d9a07a', '#a8714f', '#f5d0b5', '#c98e6b', '#e7b48f'];

function neighbour(i, x, y, s) {
  const shirt = SHIRTS[i % SHIRTS.length], skin = SKIN[(i * 5) % SKIN.length];
  const wave = i % 3 === 0 ? `<rect x="${x + 7 * s}" y="${y - 30 * s}" width="${4 * s}" height="${14 * s}" fill="${skin}" transform="rotate(-25 ${x + 9 * s} ${y - 18 * s})"/>` : '';
  // a cured neighbour: lanky, a bit scruffy, back to normal (and slightly embarrassed about it)
  return `<g class="nb" data-n="${i + 1}"><rect x="${x - 6 * s}" y="${y - 24 * s}" width="${12 * s}" height="${24 * s}" rx="${2 * s}" fill="${shirt}"/>${wave}`
    + `<rect x="${x - 6 * s}" y="${y - 3 * s}" width="${4 * s}" height="${5 * s}" fill="#141316"/><rect x="${x + 2 * s}" y="${y - 3 * s}" width="${4 * s}" height="${5 * s}" fill="#141316"/>`
    + `<circle cx="${x}" cy="${y - 30 * s}" r="${6.5 * s}" fill="${skin}"/><path d="M${x - 6.5 * s} ${y - 32 * s} q${6 * s} ${-7 * s} ${13 * s} 0" fill="#141316"/>`
    + `<path d="M${x - 2.5 * s} ${y - 27.5 * s} h${5 * s}" stroke="#141316" stroke-width="${1.2 * s}"/></g>`;
}
function fence(style, y) {
  const f = itemOf('fence', style) || itemOf('fence', 'picket');
  if (style === 'iron') {
    let out = `<rect x="0" y="${y - 22}" width="1600" height="7" fill="#26252b"/><rect x="0" y="${y + 22}" width="1600" height="7" fill="#26252b"/>`;
    for (let x = 6; x < 1600; x += 30) out += `<rect x="${x}" y="${y - 34}" width="6" height="96" fill="#26252b"/><path d="M${x - 4} ${y - 32} L${x + 3} ${y - 50} L${x + 10} ${y - 32} Z" fill="#26252b"/>`;
    return out;
  }
  // a weathered picket fence: grey boards, a few missing, one crooked
  let out = `<rect x="0" y="${y + 16}" width="1600" height="10" fill="#8f897c"/>`;
  for (let x = 10, i = 0; x < 1600; x += 46, i++) {
    if (i % 11 === 7) continue;
    const tilt = i % 9 === 4 ? ` transform="rotate(6 ${x + 13} ${y + 60})"` : '';
    out += `<path d="M${x} ${y + 60} V${y - 18} L${x + 13} ${y - 32} L${x + 26} ${y - 18} V${y + 60} Z" fill="${i % 3 ? '#b7b0a1' : '#a49d8e'}" stroke="#4a463f" stroke-width="2"${tilt}/>`;
  }
  return out;
}
/** a carved jack-o'-lantern, glowing */
function pumpkin(x, y, s = 1) {
  return `<g class="pk"><ellipse cx="${x}" cy="${y}" rx="${28 * s}" ry="${21 * s}" fill="#c8551b"/><path d="M${x - 10 * s} ${y - 19 * s} q${-7 * s} ${19 * s} 0 ${38 * s} M${x + 10 * s} ${y - 19 * s} q${7 * s} ${19 * s} 0 ${38 * s}" stroke="#7a2e0b" stroke-width="${2.5 * s}" fill="none"/>`
    + `<path d="M${x - 15 * s} ${y - 6 * s} l${6 * s} ${-9 * s} l${6 * s} ${9 * s} Z M${x + 3 * s} ${y - 6 * s} l${6 * s} ${-9 * s} l${6 * s} ${9 * s} Z M${x - 14 * s} ${y + 5 * s} h${28 * s} l${-4 * s} ${7 * s} h${-5 * s} l${-2 * s} ${-4 * s} l${-2 * s} ${4 * s} h${-6 * s} Z" fill="#ffd25a"/>`
    + `<rect x="${x - 3 * s}" y="${y - 29 * s}" width="${6 * s}" height="${10 * s}" rx="1" fill="#3d4a1a"/></g>`;
}

/** The scene's SVG markup for a save. */
export function yardSvg(save) {
  const goo = (itemOf('goo', save.yard.goo) || itemOf('goo', 'lime')).color;
  // a sickly moon, dead trees, a street of tired houses (one window boarded up per house), cracked asphalt
  let s = '<circle cx="1260" cy="190" r="78" fill="#d9d8b0" opacity=".85"/><circle cx="1236" cy="172" r="12" fill="#b9b78f" opacity=".7"/><circle cx="1284" cy="214" r="8" fill="#b9b78f" opacity=".6"/>';
  s += '<path d="M0 580 L140 530 L300 560 L460 510 L620 556 L800 520 L980 566 L1160 512 L1340 552 L1600 528 L1600 702 L0 702 Z" fill="#141317"/>';
  s += '<path d="M180 702 V520 M180 600 L130 560 M180 570 L232 528 M232 528 L250 500 M1450 702 V540 M1450 610 L1510 570 M1450 580 L1400 548" stroke="#0b0b0d" stroke-width="12" stroke-linecap="round" fill="none"/>';
  for (let i = 0; i < 6; i++) {
    const x = 60 + i * 260, w = 190, top = 572 + (i % 2) * 16;
    s += `<g class="house"><rect x="${x}" y="${top}" width="${w}" height="${702 - top}" fill="${HOUSE[i]}"/><path d="M${x - 14} ${top} L${x + w / 2} ${top - 64} L${x + w + 14} ${top} Z" fill="#111014"/>`
      + `<rect x="${x + 26}" y="${top + 30}" width="34" height="28" fill="#d8b04a" opacity=".75"/><rect x="${x + w - 60}" y="${top + 30}" width="34" height="28" fill="#2a2620"/>`
      + `<path d="M${x + w - 64} ${top + 36} l42 14 M${x + w - 64} ${top + 50} l42 -12" stroke="#6a5a44" stroke-width="5"/>`
      + `<rect x="${x + w / 2 - 18}" y="${702 - 58}" width="36" height="58" fill="#0d0c0f"/></g>`;
  }
  s += '<rect x="0" y="702" width="1600" height="62" fill="#26252a"/><path d="M90 720 l40 10 l30 -6 M520 742 l26 -12 l40 4 l18 14 M980 716 l50 16 M1300 748 l34 -14 l26 8" stroke="#141316" stroke-width="3" fill="none"/>';
  s += '<path d="M0 733 h1600" stroke="#c9c39a" stroke-width="4" stroke-dasharray="40 50" opacity=".35"/>';
  // the neighbours the kid cured: one per 10 cures
  const n = neighboursFor(save.cures);
  const shown = Math.min(n, MAX_SHOWN);
  for (let i = 0; i < shown; i++) {
    const row = i % 2, x = 80 + ((i * 97) % 1440), y = 752 + row * 14;
    s += neighbour(i, x, y, 1.6);
  }
  s += `<g class="fence">${fence(save.yard.fence, 820)}</g>`;
  const pk = Math.min(12, save.pumpkins);
  for (let i = 0; i < pk; i++) s += pumpkin(120 + i * 120, 880, 1);
  s += `<g opacity=".85"><ellipse cx="1460" cy="872" rx="38" ry="12" fill="${goo}"/><ellipse cx="1502" cy="886" rx="14" ry="6" fill="${goo}"/></g>`;
  return { svg: s, neighbours: n, shown };
}

export function drawYard(el, save) {
  if (!el || !save) return null;
  const out = yardSvg(save);
  el.innerHTML = out.svg;
  el.dataset.neighbours = String(out.neighbours);
  el.dataset.pumpkins = String(save.pumpkins);
  return out;
}

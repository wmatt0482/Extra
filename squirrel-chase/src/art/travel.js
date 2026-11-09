// travelSvg(mode): a little plane / train / car (viewBox 0 0 160 80), facing right. Flip with CSS (transform: scaleX(-1)) to go the other way.
import { INK } from './shared.js';

const plane = `
  <g class="sq-trail"><path d="M2 40H34M10 48H40M6 32H28" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".75"/></g>
  <g>
    <path d="M56 46L92 14H108L88 46Z" fill="#c9503f"/><path d="M56 46L74 66H88L80 46Z" fill="#b8453a"/>
    <path d="M46 34C46 28 56 26 100 26H128C144 26 154 36 150 44C148 50 140 52 128 52H62C50 52 46 44 46 34Z" fill="#fffaf0" stroke="${INK}" stroke-width="2.6"/>
    <path d="M50 44H146C142 50 136 52 128 52H62C54 52 50 48 50 44Z" fill="#ff6f59"/>
    <path d="M46 34C44 22 44 18 40 14L52 14C60 18 66 24 70 28Z" fill="#fffaf0" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M42 16L50 16L58 26L46 28Z" fill="#ff6f59"/>
    ${[76, 90, 104, 118].map((x) => `<rect x="${x}" y="31" width="9" height="9" rx="4" fill="#8fd3f4" stroke="${INK}" stroke-width="1.8"/>`).join('')}
    <path d="M130 30Q144 30 146 38H130Z" fill="#8fd3f4" stroke="${INK}" stroke-width="2"/>
    <ellipse cx="102" cy="55" rx="14" ry="5" fill="#2f4a7a" stroke="${INK}" stroke-width="2"/>
  </g>`;

const train = `
  <g class="sq-trail"><circle cx="30" cy="24" r="7" fill="#fff" opacity=".8"/><circle cx="18" cy="14" r="9" fill="#fff" opacity=".6"/><circle cx="6" cy="6" r="6" fill="#fff" opacity=".45"/></g>
  <g>
    <rect x="8" y="58" width="146" height="5" rx="2" fill="${INK}" opacity=".35"/>
    <rect x="44" y="26" width="48" height="30" rx="4" fill="#d94a3d" stroke="${INK}" stroke-width="2.6"/><rect x="40" y="20" width="56" height="8" rx="3" fill="#7a2f28" stroke="${INK}" stroke-width="2.2"/>
    <rect x="50" y="32" width="16" height="14" rx="3" fill="#ffe9a0" stroke="${INK}" stroke-width="1.8"/>
    <path d="M92 36H138V56H92Z" fill="#2f4a7a" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M138 36H146L152 56H138Z" fill="#2f4a7a" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
    <rect x="102" y="26" width="16" height="12" rx="2" fill="#2f4a7a" stroke="${INK}" stroke-width="2.4"/><path d="M96 44H138" stroke="#f2b138" stroke-width="4"/>
    <rect x="22" y="18" width="14" height="30" rx="2" fill="#555d72" stroke="${INK}" stroke-width="2.4"/><rect x="18" y="12" width="22" height="9" rx="3" fill="#2a2e3c" stroke="${INK}" stroke-width="2.2"/>
    <rect x="16" y="38" width="30" height="18" rx="3" fill="#d94a3d" stroke="${INK}" stroke-width="2.4"/>
    ${[26, 50, 74, 112, 132].map((x, i) => `<circle cx="${x}" cy="58" r="${i < 3 ? 8 : 7}" fill="#2a2e3c" stroke="${INK}" stroke-width="2"/><circle cx="${x}" cy="58" r="2.6" fill="#ffd34d"/>`).join('')}
  </g>`;

const car = `
  <g class="sq-trail"><path d="M2 46H20M8 54H26M4 38H18" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/></g>
  <g>
    <rect x="22" y="66" width="130" height="4" rx="2" fill="${INK}" opacity=".3"/>
    <path d="M30 56V44C30 40 34 38 38 37L56 34L68 20C70 18 74 17 78 17H108C112 17 116 19 118 22L130 36L142 40C148 42 152 46 152 52V56Z" fill="#ffc93c" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>
    <path d="M72 24H104L114 36H64Z" fill="#8fd3f4" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M88 24V36" stroke="${INK}" stroke-width="2.4"/>
    <path d="M34 46H148" stroke="#ff6f59" stroke-width="4"/><rect x="142" y="42" width="9" height="6" rx="2" fill="#fffaf0" stroke="${INK}" stroke-width="1.8"/><rect x="30" y="44" width="8" height="6" rx="2" fill="#ff6f59" stroke="${INK}" stroke-width="1.8"/>
    <g transform="translate(112 17)"><rect x="-14" y="-6" width="28" height="6" rx="2" fill="#8a5a28" stroke="${INK}" stroke-width="2"/><path d="M-8 -6V-12M8 -6V-12" stroke="${INK}" stroke-width="2"/></g>
    ${[56, 124].map((x) => `<circle cx="${x}" cy="58" r="11" fill="#2a2e3c" stroke="${INK}" stroke-width="2.4"/><circle cx="${x}" cy="58" r="5" fill="#dfe3ec"/><circle cx="${x}" cy="58" r="1.8" fill="#555d72"/>`).join('')}
  </g>`;

const bus = car;

/** travelSvg('plane' | 'train' | 'car') -> SVG string, 160 x 80, facing right. The `.sq-trail` group is the puff / speed lines behind it (hide for a static icon). */
export function travelSvg(mode = 'plane') {
  const m = mode === 'train' ? train : mode === 'car' || mode === 'bus' ? car : plane;
  return `<svg class="sq-travel sq-travel-${mode === 'train' ? 'train' : mode === 'car' || mode === 'bus' ? 'car' : 'plane'}" viewBox="0 0 160 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${m}</svg>`;
}
void bus;

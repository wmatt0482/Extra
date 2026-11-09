// postcardSvg(city): a "Greetings from ..." travel postcard (viewBox 0 0 600 400) with an illustrated scene, a perforated stamp and a postmark.
import { INK, SLAB, SANS, esc, uid } from './shared.js';
import { SCENES, SCENE_ACCENT, sceneKey } from './scenes.js';

/** city: { id, name, scene? }. scene (optional) forces one of: rochester buffalo niagara syracuse albany cooperstown corning lakeplacid saratoga ithaca nyc generic. */
export function postcardSvg(city = {}, opts = {}) {
  const id = uid('sqp');
  const key = sceneKey(city);
  const name = String(city.name || city.id || 'New York').toUpperCase();
  const accent = SCENE_ACCENT[key] || '#ff6f59';
  const fs = Math.max(32, Math.min(60, 330 / (name.length * 0.66))), tl = Math.round(name.length * fs * 0.66);
  const holes = [];
  for (let i = 0; i <= 8; i++) { holes.push(`<circle cx="${i * 10}" cy="0" r="3.4"/><circle cx="${i * 10}" cy="104" r="3.4"/>`); }
  for (let j = 0; j <= 10; j++) { holes.push(`<circle cx="0" cy="${j * 10.4}" r="3.4"/><circle cx="80" cy="${j * 10.4}" r="3.4"/>`); }
  const wave = (y) => `<path d="M-60 ${y}q16 -9 32 0t32 0t32 0t32 0t32 0t32 0t32 0" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" opacity=".5"/>`;
  return `<svg class="sq-postcard" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Postcard from ${esc(city.name || '')}" style="max-width:100%;height:auto">
  <defs><clipPath id="${id}c"><rect x="14" y="14" width="572" height="372" rx="12"/></clipPath>
    <mask id="${id}m"><rect x="0" y="0" width="80" height="104" fill="#fff"/><g fill="#000">${holes.join('')}</g></mask>
    <path id="${id}p" d="M-24 0A24 24 0 0 1 24 0"/></defs>
  <rect x="2" y="4" width="596" height="394" rx="16" fill="#000" opacity=".12"/>
  <rect x="1" y="1" width="598" height="396" rx="16" fill="#fffaf0" stroke="#e5d5ad" stroke-width="2"/>
  <g clip-path="url(#${id}c)">${SCENES[key](id)}
    <rect x="14" y="14" width="572" height="150" fill="#000" opacity="0"/>
    <g>
      <g transform="translate(34 30)"><path d="M0 0H182L170 15L182 30H0Z" fill="${accent}"/><path d="M0 0L-8 15L0 30Z" fill="${accent}" opacity=".7"/><text x="86" y="21" text-anchor="middle" font-family="${SANS}" font-weight="800" font-size="15" letter-spacing="3.5" fill="#fff">GREETINGS FROM</text></g>
      <text x="36" y="${88 + fs * 0.5}" font-family="${SLAB}" font-size="${fs}" textLength="${tl}" lengthAdjust="spacingAndGlyphs" fill="${INK}" opacity=".35" transform="translate(3 4)">${esc(name)}</text>
      <text x="36" y="${88 + fs * 0.5}" font-family="${SLAB}" font-size="${fs}" textLength="${tl}" lengthAdjust="spacingAndGlyphs" fill="#fff" stroke="${INK}" stroke-width="${Math.max(5, fs * 0.13)}" paint-order="stroke" stroke-linejoin="round">${esc(name)}</text>
    </g>
    <g transform="translate(494 28) rotate(3 40 52)"><rect x="-3" y="-3" width="86" height="110" fill="#000" opacity=".14" transform="translate(3 4)"/>
      <g mask="url(#${id}m)"><rect x="0" y="0" width="80" height="104" fill="#fffdf4"/><rect x="8" y="8" width="64" height="88" fill="${accent}"/><path d="M8 70Q30 52 44 66T72 60V96H8Z" fill="#fff" opacity=".28"/><circle cx="52" cy="30" r="11" fill="#ffd34d"/><path d="M8 96V80L24 66L36 78L50 62L72 82V96Z" fill="#fff" opacity=".4"/></g>
      <text x="40" y="94" text-anchor="middle" font-family="${SLAB}" font-size="9.5" fill="#fff" stroke="${INK}" stroke-width="2.6" paint-order="stroke">NEW YORK</text></g>
    <g transform="translate(452 142)" opacity=".62" fill="none" stroke="${INK}"><circle r="40" stroke-width="3"/><circle r="31" stroke-width="1.6"/><g transform="rotate(0)"><text font-family="${SANS}" font-weight="800" font-size="9.5" letter-spacing="1.6" fill="${INK}" stroke="none" text-anchor="middle"><textPath href="#${id}p" startOffset="50%" transform="translate(0 0)">${esc(name.length > 12 ? name.slice(0, 12) : name)}</textPath></text></g><text y="4" font-family="${SANS}" font-weight="800" font-size="11" text-anchor="middle" fill="${INK}" stroke="none">NY</text><text y="17" font-family="${SANS}" font-weight="700" font-size="7.5" text-anchor="middle" fill="${INK}" stroke="none">TOUR</text>
      <g transform="translate(40 -26)">${wave(0)}${wave(12)}${wave(24)}${wave(36)}</g></g>
  </g>
  <rect x="14" y="14" width="572" height="372" rx="12" fill="none" stroke="#fffaf0" stroke-width="2"/>
</svg>`;
}

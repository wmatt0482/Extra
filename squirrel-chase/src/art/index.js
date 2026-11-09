// PLACEHOLDER: replaced by the art agent at merge
// The app imports art through this module only. Contract:
//   drawMap(el, { cities, highlight, visited })  draws the NY map (+ US inset) into el; every city is an element with data-city="<id>"
//   gangPortrait(memberId, mood) / witnessPortrait(seed) / pipPortrait(mood) / chiefPortrait()  -> SVG string
//   signSvg(text, missingIdx)  -> SVG string, the letters at the indexes in missingIdx drawn as gaps
//   postcardSvg(city)          -> SVG string
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const hue = (seed) => hash(seed) % 360;
const face = (skin, bg, extra = '') => `<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="38" fill="${bg}"/><circle cx="40" cy="44" r="22" fill="${skin}"/><circle cx="32" cy="42" r="3" fill="#222"/><circle cx="48" cy="42" r="3" fill="#222"/><path d="M32 54q8 6 16 0" stroke="#7a3b1d" stroke-width="3" fill="none" stroke-linecap="round"/>${extra}</svg>`;
const ANIMAL = { scrabble: '#c8793a', rascal: '#777', cawdy: '#2a2a3a', posy: '#b8b0a0', billy: '#e8e0d0' };

export function gangPortrait(id, mood = 'happy') {
  const c = ANIMAL[id] || '#c8793a';
  return face(c, '#ffe0a8', `<path d="M18 22l10 12M62 22l-10 12" stroke="${c}" stroke-width="8" stroke-linecap="round"/>${mood === 'sorry' ? '<path d="M24 36l8 3M56 36l-8 3" stroke="#222" stroke-width="2"/>' : ''}`);
}
export const witnessPortrait = (seed) => face(`hsl(${20 + (hash(seed) % 30)} 55% 62%)`, `hsl(${hue(seed)} 60% 82%)`, `<path d="M20 30q20-22 40 0" fill="hsl(${hue(seed + 'h')} 35% 30%)"/>`);
export const pipPortrait = () => face('#e9b88a', '#bfe3ff', '<path d="M18 28q22-24 44 0z" fill="#d9473b"/>');
export const chiefPortrait = () => face('#d9a67e', '#ffd9a0', '<rect x="22" y="22" width="36" height="10" rx="4" fill="#1f2a44"/>');

export function signSvg(text, missing = []) {
  const miss = new Set(missing);
  const chars = Array.from(String(text || ''));
  const w = 34, W = Math.max(120, chars.length * w + 40);
  const cells = chars.map((ch, i) => {
    const x = 20 + i * w;
    if (ch === ' ') return '';
    return miss.has(i) ? `<rect x="${x + 3}" y="26" width="${w - 6}" height="40" rx="5" fill="none" stroke="#fff8" stroke-width="3" stroke-dasharray="6 5" data-gap="${i}"/>`
      : `<text x="${x + w / 2}" y="58" text-anchor="middle" font-size="36" font-weight="800" fill="#fff" font-family="Lilita One, Arial Black, sans-serif" data-letter="${i}">${esc(ch)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} 92" role="img" aria-label="Sign: ${esc(chars.map((c, i) => (miss.has(i) ? '_' : c)).join(''))}"><rect x="6" y="6" width="${W - 12}" height="80" rx="12" fill="#2b6f4e" stroke="#fff3c4" stroke-width="5"/>${cells}</svg>`;
}
export function postcardSvg(city) {
  const c = city || {}, h = hue(c.id || c.name || 'x');
  return `<svg viewBox="0 0 240 150" role="img" aria-label="Postcard of ${esc(c.name || '')}"><rect width="240" height="150" rx="10" fill="#fff7e0" stroke="#d9c58a" stroke-width="4"/><rect x="10" y="10" width="220" height="104" rx="6" fill="hsl(${h} 70% 75%)"/><circle cx="190" cy="40" r="16" fill="#ffd54a"/><path d="M10 114V80l50-26 40 30 50-34 80 40v24z" fill="hsl(${h} 45% 45%)"/><text x="120" y="138" text-anchor="middle" font-size="16" font-weight="800" fill="#7a5b1e" font-family="Lilita One, sans-serif">Greetings from ${esc(c.name || '')}</text></svg>`;
}

/** The NY map: a rough outline with every city as a tappable pin; `highlight` glows, `visited` pins are stamped. */
export function drawMap(el, { cities = [], highlight = null, visited = [] } = {}) {
  const seen = new Set(visited);
  const pins = cities.map((c) => {
    const x = 20 + c.x * 300, y = 20 + c.y * 200, on = c.id === highlight, v = seen.has(c.id);
    return `<g data-city="${esc(c.id)}" role="button" tabindex="0" aria-label="${esc(c.name)}" class="pin${on ? ' on' : ''}${v ? ' visited' : ''}" style="cursor:pointer">
      <circle cx="${x}" cy="${y}" r="${on ? 15 : 11}" fill="${on ? '#ffb12b' : v ? '#3f9a5a' : '#d9473b'}" stroke="#fff" stroke-width="3"/>
      <text x="${x}" y="${y - 17}" text-anchor="middle" font-size="12" font-weight="800" fill="#1f2a44" stroke="#fff8" stroke-width="3" paint-order="stroke">${esc(c.name)}</text></g>`;
  }).join('');
  el.innerHTML = `<svg viewBox="0 0 340 240" class="sc-map-svg" role="group" aria-label="Map of New York State"><rect width="340" height="240" rx="14" fill="#cfeaf6"/>
    <path d="M10 70 L70 24 L190 18 L226 60 L260 24 L310 40 L318 120 L292 200 L228 214 L120 190 L40 150 L10 110z" fill="#f4ead0" stroke="#bda76a" stroke-width="3"/>${pins}
    <g aria-hidden="true"><rect x="266" y="172" width="64" height="44" rx="6" fill="#fff8e6" stroke="#bda76a"/><path d="M272 186l16-6 30 4 6 14-10 10-30 2-14-8z" fill="#e3d6a9"/><circle cx="312" cy="190" r="3" fill="#d9473b"/></g></svg>`;
}

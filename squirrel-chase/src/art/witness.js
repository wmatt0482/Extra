// witnessPortrait(seed): a deterministic townsperson (round badge, viewBox 0 0 100 100). Same seed -> same person, always.
// Varied ages, skin tones, hair, head coverings, glasses, facial hair and outfits. Everyone is friendly and a little curious.
import { INK, badge, rng, pick, stroke } from './shared.js';

const SKINS = [['#f6d4b6', '#dcb18c'], ['#efc29b', '#d19e75'], ['#d9a070', '#b9804f'], ['#b9794c', '#975c35'], ['#8d5a3a', '#6d4128'], ['#6b4129', '#4f2e1c'], ['#f2cfae', '#d6aa84'], ['#c68a5e', '#a46d44']];
const HAIRS = ['#1f1a1a', '#3a2619', '#5b3a22', '#8a4a28', '#d6ad52', '#c9c4bb', '#2b2324'];
const SHIRTS = ['#e0634f', '#f2b138', '#3f9a8f', '#4a7fd6', '#8a63c9', '#5fae5a', '#e57aa3', '#2f4a7a', '#d9833c'];
const RINGS = ['#ff8a5c', '#f2b138', '#37b8a8', '#5b8fe0', '#a077e0', '#6cbf68', '#ee7fa8'];

function hairBack(style, c, ctx) {
  switch (style) {
    case 'long': return `<path d="M27 52C24 34 34 24 50 24S76 34 73 52C74 66 72 76 68 82L60 74L40 74L32 82C28 76 26 66 27 52Z" fill="${c}"/>`;
    case 'bob': return `<path d="M27 52C24 34 34 24 50 24S76 34 73 52C74 62 72 68 68 70L32 70C28 68 26 62 27 52Z" fill="${c}"/>`;
    case 'afro': return `<circle cx="50" cy="40" r="28" fill="${c}"/><circle cx="30" cy="48" r="10" fill="${c}"/><circle cx="70" cy="48" r="10" fill="${c}"/>`;
    case 'bun': return `<circle cx="50" cy="18" r="8.5" fill="${c}"/>`;
    case 'ponytail': return `<path d="M68 38C86 38 88 62 78 78C80 62 74 54 66 52Z" fill="${c}"/>`;
    case 'braids': return `<path d="M30 54L25 84M36 56L33 86M70 54L75 84M64 56L67 86" ${stroke(c, 5)}/>`;
    default: return '';
  }
}
function hairFront(style, c) {
  switch (style) {
    case 'short': return `<path d="M30 48C28 32 36 26 50 26S72 32 70 48C66 40 58 36 50 36S34 40 30 48Z" fill="${c}"/>`;
    case 'buzz': return `<path d="M31 46C30 32 38 27 50 27S70 32 69 46C66 38 58 35 50 35S34 38 31 46Z" fill="${c}" opacity=".85"/>`;
    case 'side': return `<path d="M30 50C26 32 38 25 52 26C66 27 74 36 70 50C68 42 62 38 54 37C44 38 36 42 30 50Z" fill="${c}"/>`;
    case 'bob': case 'long': return `<path d="M29 52C26 34 36 26 50 26S74 34 71 52C68 42 62 36 50 36C46 40 36 40 29 52Z" fill="${c}"/>`;
    case 'curly': return `<g fill="${c}"><circle cx="34" cy="38" r="8"/><circle cx="44" cy="31" r="8.5"/><circle cx="56" cy="31" r="8.5"/><circle cx="66" cy="38" r="8"/><circle cx="30" cy="48" r="6"/><circle cx="70" cy="48" r="6"/></g>`;
    case 'afro': return `<path d="M32 46C32 34 40 30 50 30S68 34 68 46C64 40 58 37 50 37S36 40 32 46Z" fill="${c}"/>`;
    case 'bun': case 'ponytail': case 'braids': return `<path d="M30 50C28 32 38 25 50 25S72 32 70 50C66 40 58 35 50 36C42 35 34 40 30 50Z" fill="${c}"/>`;
    case 'pixie': return `<path d="M29 48C26 30 38 24 52 25C64 26 74 34 70 50C68 42 62 36 56 34C48 38 38 36 29 48Z" fill="${c}"/>`;
    case 'wisp': return `<path d="M32 44C34 34 42 30 50 30S66 34 68 44C62 38 56 36 50 36S38 38 32 44Z" fill="${c}" opacity=".95"/><path d="M29 52C28 48 30 46 31 46L32 54ZM71 52C72 48 70 46 69 46L68 54Z" fill="${c}"/>`;
    default: return '';
  }
}

/** A person for a seed (any string or number). Returns the SVG string. */
export function witnessPortrait(seed = 'witness', opts = {}) {
  const r = rng(`w:${seed}`);
  const age = pick(r, ['kid', 'teen', 'adult', 'adult', 'adult', 'elder', 'elder']);
  const [skin, skinSh] = pick(r, SKINS);
  const elder = age === 'elder', kid = age === 'kid';
  let hairC = elder ? pick(r, ['#c9c4bb', '#ecebe6', '#b5b8c0', '#8a8a92']) : pick(r, HAIRS);
  const head = pick(r, ['hijab', 'none', 'none', 'none', 'none', 'cap', 'beanie', 'sunhat', 'none', 'none']);
  const styles = elder ? ['wisp', 'short', 'bun', 'bob', 'bald', 'wisp'] : kid ? ['short', 'pixie', 'ponytail', 'braids', 'curly', 'side', 'bun'] : ['short', 'side', 'bob', 'long', 'curly', 'afro', 'bun', 'ponytail', 'braids', 'pixie', 'buzz', 'bald'];
  let style = pick(r, styles);
  const covered = head === 'hijab' || head === 'cap' || head === 'beanie' || head === 'sunhat';
  if (head === 'hijab') style = 'none';
  const shirt = pick(r, SHIRTS), ring = pick(r, RINGS);
  const outfit = pick(r, kid ? ['tee', 'hoodie', 'tee', 'overalls'] : ['tee', 'hoodie', 'collar', 'cardigan', 'apron', 'vest', 'scarf', 'chef', 'polo']);
  const glasses = r() < (elder ? 0.5 : 0.22);
  const gStyle = r() < 0.5 ? 'round' : 'square';
  const male = !['bob', 'long', 'bun', 'ponytail', 'braids', 'pixie'].includes(style) && head !== 'hijab' && r() < 0.6;
  const beard = !kid && male && r() < 0.4 ? pick(r, ['stubble', 'beard', 'stache', 'goatee']) : 'none';
  const freckles = (kid || r() < 0.25) && skin.length && r() < 0.7;
  const earring = !male && !kid && r() < 0.4;
  const mood = pick(r, ['smile', 'smile', 'grin', 'curious']);

  const hh = kid ? 0.92 : 1; // kids: slightly smaller head, bigger eyes
  const eyeR = kid ? 4.4 : 3.6;
  const eyeY = kid ? 55 : 53;
  const hairHi = 'rgba(255,255,255,.18)';

  // body
  const bodyBase = `<path d="M10 104C10 84 24 75 38 72L62 72C76 75 90 84 90 104Z" fill="${shirt}"/>`;
  const outfits = {
    tee: `${bodyBase}<path d="M40 72Q50 82 60 72" fill="${skinSh}"/>`,
    hoodie: `${bodyBase}<path d="M30 74Q50 90 70 74L74 84Q50 98 26 84Z" fill="rgba(0,0,0,.18)"/><path d="M44 80v14M56 80v14" ${stroke('#f4efe2', 1.6)}/>`,
    collar: `${bodyBase}<path d="M40 72L50 88 60 72Z" fill="#f4efe2"/><path d="M50 82L46 96h8z" fill="#c93a33"/><path d="M40 72L50 90 36 80Z M60 72L50 90 64 80Z" fill="#fff" opacity=".9"/>`,
    cardigan: `${bodyBase}<path d="M40 72L50 100 32 104 34 76Z M60 72L50 100 68 104 66 76Z" fill="rgba(0,0,0,.2)"/><path d="M42 72Q50 82 58 72L56 104H44Z" fill="#f4efe2"/><circle cx="50" cy="88" r="1.6" fill="${shirt}"/><circle cx="50" cy="96" r="1.6" fill="${shirt}"/>`,
    apron: `${bodyBase}<path d="M36 76H64L68 104H32Z" fill="#f6f0e0"/><path d="M36 76L44 72M64 76L56 72" ${stroke('#f6f0e0', 3)}/><path d="M40 90h20v10H40z" fill="#e2d6b8"/>`,
    vest: `${bodyBase}<path d="M36 72L42 104H34L28 80ZM64 72L58 104H66L72 80Z" fill="#ff8a1f"/><path d="M33 90h6M61 90h6M32 98h8M60 98h8" ${stroke('#fff3b0', 2.4)}/>`,
    scarf: `${bodyBase}<path d="M32 72Q50 88 68 72L70 80Q50 96 30 80Z" fill="#e0463f"/><path d="M58 82L62 100 70 98 66 80Z" fill="#c93a33"/>`,
    chef: `${bodyBase}<path d="M20 90C28 78 36 74 50 74S72 78 80 90L80 104H20Z" fill="#fbf8ef"/><circle cx="46" cy="86" r="1.5" fill="${shirt}"/><circle cx="54" cy="86" r="1.5" fill="${shirt}"/><circle cx="46" cy="94" r="1.5" fill="${shirt}"/><circle cx="54" cy="94" r="1.5" fill="${shirt}"/><path d="M50 74V104" ${stroke('#e0d6bc', 1)}/>`,
    polo: `${bodyBase}<path d="M42 72L50 82 58 72Z" fill="#fff" opacity=".9"/><path d="M50 78v8" ${stroke('rgba(0,0,0,.25)', 1.2)}/>`,
    overalls: `${bodyBase}<path d="M30 104L34 82H66L70 104Z" fill="#3a5a9a"/><path d="M34 82L36 72M66 82L64 72" ${stroke('#3a5a9a', 4)}/><circle cx="36" cy="83" r="1.8" fill="#ffd24a"/><circle cx="64" cy="83" r="1.8" fill="#ffd24a"/>`,
  };

  const faceY = 50, fw = 19 * hh, fh = 21 * hh;
  // head covering
  let cover = '';
  if (head === 'hijab') {
    const hc = pick(r, ['#e0634f', '#3f9a8f', '#8a63c9', '#f2b138', '#4a7fd6', '#f4efe2']);
    cover = `<path d="M24 56C20 30 34 20 50 20S80 30 76 56C76 72 70 82 66 86L34 86C30 82 24 72 24 56Z" fill="${hc}"/><path d="M24 78C20 90 14 98 10 104L90 104C86 98 80 90 76 78L66 86L34 86Z" fill="${hc}"/><ellipse cx="50" cy="${faceY + 3}" rx="${fw - 1.5}" ry="${fh - 1}" fill="${skin}"/><path d="M31 42C36 30 64 30 69 42C62 36 38 36 31 42Z" fill="${hc}"/><path d="M29 40C26 54 30 62 34 68" ${stroke('rgba(0,0,0,.12)', 3)}/>`;
  }
  const hatC = pick(r, ['#d94a3d', '#2f4a7a', '#3f9a8f', '#f2b138', '#6a4a32']);
  let hat = '';
  if (head === 'cap') hat = `<path d="M30 42C30 28 40 24 50 24S70 28 70 42Z" fill="${hatC}"/><path d="M28 42H72L70 46H30Z" fill="rgba(0,0,0,.2)"/><path d="M52 42C60 42 74 42 80 46C70 48 58 47 52 46Z" fill="${hatC}"/><circle cx="50" cy="24" r="2" fill="${hatC}"/>`;
  if (head === 'beanie') hat = `<path d="M29 44C28 26 38 21 50 21S72 26 71 44Z" fill="${hatC}"/><path d="M28 40H72V46H28Z" fill="rgba(255,255,255,.28)"/><path d="M34 22v18M42 21v19M50 20v20M58 21v19M66 22v18" ${stroke('rgba(0,0,0,.12)', 1.3)}/><circle cx="50" cy="19" r="4" fill="${hatC}"/>`;
  if (head === 'sunhat') hat = `<ellipse cx="50" cy="40" rx="35" ry="9" fill="#e9cf85"/><path d="M32 40C32 24 42 20 50 20S68 24 68 40Z" fill="#f2dc9c"/><path d="M32 38Q50 44 68 38L68 34Q50 40 32 34Z" fill="${hatC}"/>`;

  const front = style !== 'none' && !(covered && head !== 'sunhat') ? hairFront(style, hairC) : '';
  const back = !covered || head === 'sunhat' ? hairBack(style, hairC) : '';

  // face
  const eyes = [40.5, 59.5].map((x) => `<ellipse cx="${x}" cy="${eyeY}" rx="${eyeR * 0.85}" ry="${eyeR}" fill="#fff"/><circle cx="${x + (mood === 'curious' ? 0.9 : 0)}" cy="${eyeY + 0.4}" r="${eyeR * 0.6}" fill="${INK}"/><circle cx="${x - 0.6}" cy="${eyeY - 0.8}" r=".9" fill="#fff"/>`).join('');
  const brows = [[40.5, -1], [59.5, 1]].map(([x, s]) => `<path d="M${x - 5} ${eyeY - 7 + (mood === 'curious' && s > 0 ? -1.5 : 0)}Q${x} ${eyeY - 9.5 + (mood === 'curious' && s > 0 ? -1.5 : 0)} ${x + 5} ${eyeY - 7}" ${stroke(elder ? '#9a9aa2' : hairC === '#ecebe6' ? '#b5b8c0' : hairC, 2.2)}/>`).join('');
  const mouth = mood === 'grin' ? `<path d="M42 64.5Q50 73 58 64.5Q50 66.4 42 64.5Z" fill="#7a2b2b"/><path d="M43.6 65.2Q50 67 56.4 65.2L55.6 66.6Q50 68.4 44.4 66.6Z" fill="#fff"/>`
    : mood === 'curious' ? `<path d="M45 65.6Q50 67.6 55.4 64.6" ${stroke('#7a3d1c', 2.3)}/>` : `<path d="M43 64.4Q50 70.6 57 64.4" ${stroke('#7a3d1c', 2.4)}/>`;
  const nose = `<path d="M49 57q-2.2 3.2.6 4.2" ${stroke(skinSh, 1.7)}/>`;
  const wr = elder ? `<path d="M33 49q-2 1-3 3M67 49q2 1 3 3M36 63q-1 2 0 4M64 63q1 2 0 4" ${stroke(skinSh, 1)} opacity=".7"/><path d="M42 41Q50 38.5 58 41" ${stroke(skinSh, 1)} opacity=".5"/>` : '';
  const frk = freckles ? `<g fill="${skinSh}"><circle cx="38" cy="59" r=".8"/><circle cx="41" cy="60.2" r=".8"/><circle cx="43" cy="58.6" r=".8"/><circle cx="57" cy="58.6" r=".8"/><circle cx="59" cy="60.2" r=".8"/><circle cx="62" cy="59" r=".8"/></g>` : '';
  const bc = elder ? '#c9c4bb' : hairC;
  const beardSvg = beard === 'stubble' ? `<path d="M31 56C32 70 40 76 50 76S68 70 69 56C66 66 58 70 50 70S34 66 31 56Z" fill="${bc}" opacity=".35"/>`
    : beard === 'beard' ? `<path d="M30 54C30 72 40 80 50 80S70 72 70 54C66 66 60 66 56 62Q50 66 44 62C40 66 34 66 30 54Z" fill="${bc}"/><path d="M43 66Q50 71 57 66Q50 69.4 43 66Z" fill="#7a2b2b"/>`
      : beard === 'stache' ? `<path d="M40 62Q45 58.5 50 61Q55 58.5 60 62Q55 65 50 63.4Q45 65 40 62Z" fill="${bc}"/>`
        : beard === 'goatee' ? `<path d="M44 68Q50 76 56 68Q50 71 44 68Z" fill="${bc}"/><path d="M41 62Q45 59 50 61Q55 59 59 62Q55 64.6 50 63.4Q45 64.6 41 62Z" fill="${bc}"/>` : '';
  const gl = glasses ? (gStyle === 'round'
    ? `<g fill="rgba(190,230,245,.25)" stroke="#2a2330" stroke-width="1.7"><circle cx="40.5" cy="${eyeY}" r="6.2"/><circle cx="59.5" cy="${eyeY}" r="6.2"/></g><path d="M46.7 ${eyeY - 0.4}Q50 ${eyeY - 2.4} 53.3 ${eyeY - 0.4}M34.3 ${eyeY - 1}L31 ${eyeY - 2.2}M65.7 ${eyeY - 1}L69 ${eyeY - 2.2}" ${stroke('#2a2330', 1.5)}/>`
    : `<g fill="rgba(190,230,245,.25)" stroke="#2a2330" stroke-width="1.7"><rect x="34" y="${eyeY - 5}" width="13" height="10" rx="2.6"/><rect x="53" y="${eyeY - 5}" width="13" height="10" rx="2.6"/></g><path d="M47 ${eyeY - 1}H53M34 ${eyeY - 2}L31 ${eyeY - 3}M66 ${eyeY - 2}L69 ${eyeY - 3}" ${stroke('#2a2330', 1.5)}/>`) : '';
  const ear = `<ellipse cx="${50 - fw - 0.5}" cy="${faceY + 3}" rx="3.6" ry="4.6" fill="${skinSh}"/><ellipse cx="${50 + fw + 0.5}" cy="${faceY + 3}" rx="3.6" ry="4.6" fill="${skinSh}"/>${earring ? `<circle cx="${50 - fw - 1}" cy="${faceY + 9}" r="1.9" fill="#dcab4a"/><circle cx="${50 + fw + 1}" cy="${faceY + 9}" r="1.9" fill="#dcab4a"/>` : ''}`;

  const inner = `
    ${back}
    ${outfits[outfit]}
    <rect x="44" y="62" width="12" height="13" rx="3" fill="${skinSh}"/>
    ${head === 'hijab' ? '' : ear}
    ${head === 'hijab' ? cover : `<ellipse cx="50" cy="${faceY + 3}" rx="${fw}" ry="${fh}" fill="${skin}"/>`}
    <path d="M${50 - fw + 1.4} ${faceY + 9}Q${50 - fw + 3} ${faceY + 22} 50 ${faceY + 24 * hh}Q${50 + fw - 3} ${faceY + 22} ${50 + fw - 1.4} ${faceY + 9}Q${50 + fw - 4} ${faceY + 20} 50 ${faceY + 20 * hh}Q${50 - fw + 4} ${faceY + 20} ${50 - fw + 1.4} ${faceY + 9}Z" fill="${skinSh}" opacity=".3"/>
    ${front}
    ${brows}${eyes}${gl}${nose}${frk}${wr}
    <circle cx="36" cy="${eyeY + 8}" r="3" fill="#e77a62" opacity=".3"/><circle cx="64" cy="${eyeY + 8}" r="3" fill="#e77a62" opacity=".3"/>
    ${beardSvg}${mouth}
    ${hat}
    <path d="M30 34Q50 22 70 34" fill="none" stroke="${hairHi}" stroke-width="0"/>`;
  return badge(inner, { ringColor: ring, ringFill: '#fff3d6', cls: `witness witness-${age}`, ...opts });
}

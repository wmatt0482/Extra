// The cast of Case Files as clean vector portraits (no image files): Pip, the apprentice detective who is your partner; the Chief; and
// Mr. Wen, the archivist. Older-kid look: bold shapes, big readable faces, friendly, never babyish. Each function returns an SVG
// string (viewBox 0 0 100 100, a round badge by default) that can go straight into innerHTML. Pip has expressions:
//   pipAvatar('happy' | 'thinking' | 'surprised' | 'cheer')
// Every portrait is decorative (aria-hidden): the name and the words next to it carry the meaning.

let uid = 0;
const wrap = (inner, { ring = true, ringColor = '#2fd1c0', ringFill = '#0f3a44', cls = '' } = {}) => {
  const id = `sqk${++uid}`;
  const bg = ring ? `<circle cx="50" cy="50" r="48" fill="${ringFill}"/>` : '';
  const body = ring ? `<g clip-path="url(#${id})"><g transform="translate(50 60) scale(1.2) translate(-50 -60)">${inner}</g></g><circle cx="50" cy="50" r="47" fill="none" stroke="${ringColor}" stroke-width="4"/>` : inner;
  return `<svg class="sq-char ${cls}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${ring ? `<defs><clipPath id="${id}"><circle cx="50" cy="50" r="46"/></clipPath></defs>` : ''}${bg}${body}</svg>`;
};

const INK = '#1a1220';

// ---------------------------------------------------------------- Pip
const PIP_SKIN = '#c98f63', PIP_SKIN_SH = '#a9704a';
const PIP_EYES = {
  happy:     { rx: 4.4, ry: 5,   dx: 0,   dy: .6,  brow: ['M37.5 44.4Q42.5 40.6 47.6 43.6', 'M52.4 43.6Q57.5 40.6 62.5 44.4'] },
  thinking:  { rx: 4.4, ry: 5,   dx: 1.9, dy: -1.8, brow: ['M37.5 46Q42.5 43.6 47.6 45.6', 'M52.4 40.6Q57.5 37.4 62.5 40.6'] },
  surprised: { rx: 5.3, ry: 6.3, dx: 0,   dy: 0,   brow: ['M37 40.6Q42.5 36.4 48 39.6', 'M52 39.6Q57.5 36.4 63 40.6'] },
  cheer:     { rx: 4.4, ry: 5,   dx: 0,   dy: 0,   brow: ['M37.5 43.4Q42.5 39.4 47.6 42.4', 'M52.4 42.4Q57.5 39.4 62.5 43.4'] },
};
function pipFace(mood) {
  const e = PIP_EYES[mood] || PIP_EYES.happy;
  let eyes;
  if (mood === 'cheer') {
    eyes = `<path d="M38.4 53.8Q43 47.6 47.6 53.8" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/><path d="M52.4 53.8Q57 47.6 61.6 53.8" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>`;
  } else {
    eyes = [43, 57].map((cx) => `<ellipse cx="${cx}" cy="53" rx="${e.rx}" ry="${e.ry}" fill="#fff"/><circle cx="${cx + e.dx}" cy="${53 + e.dy}" r="${mood === 'surprised' ? 2.3 : 2.8}" fill="${INK}"/><circle cx="${cx + e.dx - .9}" cy="${53 + e.dy - 1}" r=".95" fill="#fff"/>`).join('');
  }
  const brows = `<path d="${e.brow[0]}" fill="none" stroke="#2a1d1a" stroke-width="2.6" stroke-linecap="round"/><path d="${e.brow[1]}" fill="none" stroke="#2a1d1a" stroke-width="2.6" stroke-linecap="round"/>`;
  let mouth;
  if (mood === 'happy') mouth = `<path d="M42.4 61.4Q50 72.4 57.6 61.4Q50 64.2 42.4 61.4Z" fill="#7a2b2b"/><path d="M44.2 62Q50 64.4 55.8 62L55.2 63.8Q50 66 44.8 63.8Z" fill="#fff"/>`;
  else if (mood === 'cheer') mouth = `<path d="M40.6 60.6Q50 75.6 59.4 60.6Q50 64 40.6 60.6Z" fill="#7a2b2b"/><path d="M43 61.2Q50 64.2 57 61.2L56.2 63.6Q50 66.4 43.8 63.6Z" fill="#fff"/><path d="M45.4 68.4Q50 65.6 54.6 68.4Q50 71.6 45.4 68.4Z" fill="#e0675f"/>`;
  else if (mood === 'thinking') mouth = `<path d="M45.6 65.2Q50.6 62.2 56 64.4" fill="none" stroke="#7a3d1c" stroke-width="2.6" stroke-linecap="round"/>`;
  else mouth = `<ellipse cx="50" cy="65.4" rx="3.9" ry="5.1" fill="#7a2b2b"/><path d="M46.6 68.2Q50 65.8 53.4 68.2Q50 70.8 46.6 68.2Z" fill="#e0675f"/>`;
  const extra = mood === 'thinking'
    ? '<g fill="#d6fffa" stroke="#0f3a44" stroke-width="1.2"><circle cx="76" cy="38" r="2.2"/><circle cx="82" cy="29" r="3.2"/><circle cx="88" cy="17" r="5"/></g><text x="88" y="21" font-family="Alfa Slab One, Georgia, serif" font-size="8" fill="#0f3a44" text-anchor="middle">?</text>'
    : mood === 'surprised' ? '<g stroke="#ffe27a" stroke-width="2.4" stroke-linecap="round"><path d="M80 30l6-4M82 40l7 0M78 20l3-6"/><path d="M20 30l-6-4M18 40l-7 0M22 20l-3-6"/></g>'
    : mood === 'cheer' ? '<g fill="#ffe27a"><path d="M82 24l2.2 4.8 5.2.7-3.8 3.6.9 5.1-4.5-2.5-4.6 2.5.9-5.1-3.8-3.6 5.2-.7z"/><path d="M16 38l1.6 3.4 3.7.5-2.7 2.6.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.7-2.6 3.7-.5z" opacity=".9"/></g>' : '';
  return `${brows}${eyes}${mouth}<circle cx="37" cy="60" r="3.2" fill="#e77a62" opacity=".38"/><circle cx="63" cy="60" r="3.2" fill="#e77a62" opacity=".38"/><g fill="#8a5232" opacity=".75"><circle cx="40.6" cy="58.2" r=".7"/><circle cx="43" cy="59.4" r=".7"/><circle cx="57" cy="59.4" r=".7"/><circle cx="59.4" cy="58.2" r=".7"/></g>${extra}`;
}
/** Pip, the apprentice detective: a teal newsboy cap, a red scarf, a brass magnifier. mood: happy | thinking | surprised | cheer. */
export function pipAvatar(mood = 'happy', opts = {}) {
  const body = `
    <path d="M10 102C10 82 22 73 38 71L62 71C78 73 90 82 90 102Z" fill="#22365f"/>
    <path d="M38 71L50 86 34 92Z" fill="#2e4a82"/><path d="M62 71L50 86 66 92Z" fill="#2e4a82"/>
    <path d="M43 70L50 82 57 70Z" fill="#f4efe2"/>
    <rect x="44" y="62" width="12" height="11" rx="3" fill="${PIP_SKIN_SH}"/>
    <path d="M33.5 69C42 77 58 77 66.5 69L69 75.6C58 84.5 42 84.5 31 75.6Z" fill="#e0463f"/>
    <path d="M33.5 69C42 77 58 77 66.5 69" fill="none" stroke="#a82f2a" stroke-width="1.4" opacity=".6"/>
    <path d="M58 79.4L63 98 73.6 94 68 77.4Z" fill="#c93a33"/><path d="M62 90l9.6-3.6" stroke="#a82f2a" stroke-width="1.6"/>
    <circle cx="26" cy="92" r="2.1" fill="#dcab4a"/>
    <g transform="translate(75 81)"><circle r="8.4" fill="rgba(170,230,255,.42)" stroke="#dcab4a" stroke-width="3.2"/><path d="M-3.4-3.2Q-.6-5.6 2.4-4.2" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".8"/><path d="M5.8 6l7 7.4" stroke="#8a6418" stroke-width="4.2" stroke-linecap="round"/></g>
    <ellipse cx="31" cy="53" rx="3.9" ry="4.6" fill="${PIP_SKIN_SH}"/><ellipse cx="69" cy="53" rx="3.9" ry="4.6" fill="${PIP_SKIN_SH}"/>
    <path d="M30 50C28.4 56 31 62 34.6 66L35 55Z" fill="#2a1d1a"/><path d="M70 50C71.6 56 69 62 65.4 66L65 55Z" fill="#2a1d1a"/>
    <ellipse cx="50" cy="53" rx="19.4" ry="21" fill="${PIP_SKIN}"/>
    <path d="M31.6 59Q34 71 50 73Q66 71 68.4 59Q66 66 50 67.6Q34 66 31.6 59Z" fill="${PIP_SKIN_SH}" opacity=".35"/>
    <path d="M32 42C38 47.6 44 45 49 42.6 53 46 60 47 68 42L66 49C58 45.6 54 47 50 46 45 48 38 48 33.6 49Z" fill="#2a1d1a"/>
    ${pipFace(mood)}
    <path d="M28.6 43.4C27.4 28.6 38 22 50 22S72.6 28.6 71.4 43.4C65 39 58 38 50 38S35 39 28.6 43.4Z" fill="#25b8a8"/>
    <path d="M50 22V38M39.6 24.4Q38 31 38.6 38.4M60.4 24.4Q62 31 61.4 38.4" stroke="#14796f" stroke-width="1.5" fill="none" opacity=".55"/>
    <circle cx="50" cy="22.2" r="2.6" fill="#14796f"/>
    <path d="M31.6 41.4C41 35.6 59 35.6 68.4 41.4 67 48.2 58.6 45.4 50 45.4S33 48.2 31.6 41.4Z" fill="#168a7e"/>
    <path d="M28.7 40.6C38 36.4 62 36.4 71.3 40.6L71.5 43.8C62 39.8 38 39.8 28.5 43.8Z" fill="#dcab4a"/>`;
  return wrap(body, { ringColor: '#2fd1c0', ringFill: '#0f4048', cls: `pip pip-${mood}`, ...opts });
}

// ---------------------------------------------------------------- the Chief
/** The Chief: a navy peaked cap with a brass star, silver hair, a steady kind face, a brass badge. */
export function chiefAvatar(mood = 'happy', opts = {}) {
  const S = '#8a5638', SH = '#6c4029';
  const smile = mood === 'surprised'
    ? `<ellipse cx="50" cy="65.6" rx="3.4" ry="4.2" fill="#5a1f1f"/>`
    : `<path d="M42.4 62.6Q50 70.2 57.6 62.6" fill="none" stroke="#4a2414" stroke-width="2.6" stroke-linecap="round"/>`;
  const brow = mood === 'surprised' ? ['M37.4 43.4Q42.6 40 47.8 42.8', 'M52.2 42.8Q57.4 40 62.6 43.4'] : ['M37.4 46Q42.6 43 47.8 45.2', 'M52.2 45.2Q57.4 43 62.6 46'];
  const body = `
    <path d="M8 102C8 82 22 73 38 71L62 71C78 73 92 82 92 102Z" fill="#162a58"/>
    <path d="M38 71L50 88 32 94Z" fill="#20407f"/><path d="M62 71L50 88 68 94Z" fill="#20407f"/>
    <path d="M42.5 70L50 84 57.5 70Z" fill="#f4efe2"/><path d="M48 74h4l1.6 14-3.6 3-3.6-3z" fill="#b8352e"/>
    <path d="M16 80L30 74 31 80 18 86Z" fill="#dcab4a"/><path d="M84 80L70 74 69 80 82 86Z" fill="#dcab4a"/>
    <rect x="43.6" y="62" width="12.8" height="11" rx="3" fill="${SH}"/>
    <ellipse cx="31" cy="53" rx="3.9" ry="4.8" fill="${SH}"/><ellipse cx="69" cy="53" rx="3.9" ry="4.8" fill="${SH}"/>
    <path d="M28.6 46C25 56 28 68 36 72L37 54Z" fill="#d3d7e0"/><path d="M71.4 46C75 56 72 68 64 72L63 54Z" fill="#d3d7e0"/>
    <ellipse cx="50" cy="53.4" rx="20.2" ry="21.4" fill="${S}"/>
    <path d="M30.6 59Q33 72 50 74.6Q67 72 69.4 59Q66 67.6 50 69Q34 67.6 30.6 59Z" fill="${SH}" opacity=".4"/>
    <path d="M32 42C38 47 44 45 49 42.6 53 46 60 47 68 42L66.6 48C58 45.6 54 47 50 45.6 45 47.6 38 47.6 33.4 48.4Z" fill="#cdd1da"/>
    <path d="${brow[0]}" fill="none" stroke="#7d828f" stroke-width="3" stroke-linecap="round"/><path d="${brow[1]}" fill="none" stroke="#7d828f" stroke-width="3" stroke-linecap="round"/>
    ${[43, 57].map((cx) => `<ellipse cx="${cx}" cy="53.4" rx="${mood === 'surprised' ? 4.6 : 4}" ry="${mood === 'surprised' ? 5.4 : 4.4}" fill="#fff"/><circle cx="${cx}" cy="53.8" r="2.5" fill="${INK}"/><circle cx="${cx - .8}" cy="52.8" r=".9" fill="#fff"/>`).join('')}
    <path d="M50 56.4q-2 4 .8 5.2" fill="none" stroke="${SH}" stroke-width="1.6" stroke-linecap="round"/>
    ${smile}
    <circle cx="36.4" cy="61" r="3" fill="#c46a54" opacity=".32"/><circle cx="63.6" cy="61" r="3" fill="#c46a54" opacity=".32"/>
    <path d="M27.4 43C26.4 28.6 37 21 50 21S73.6 28.6 72.6 43Z" fill="#15295b"/>
    <path d="M26.4 40.6C37 36.6 63 36.6 73.6 40.6L74 44.6C63 40.6 37 40.6 26 44.6Z" fill="#dcab4a"/>
    <path d="M28 41C37 36 63 36 72 41 70.8 48.4 60 45.6 50 45.6S29.2 48.4 28 41Z" fill="#0d1d44"/>
    <g transform="translate(50 31)"><circle r="7.4" fill="#dcab4a" stroke="#8a6418" stroke-width="1.5"/><path d="M0-5.2l1.5 3.2 3.4.5-2.5 2.4.6 3.4L0 2.6l-3 1.7.6-3.4-2.5-2.4 3.4-.5z" fill="#8a6418"/></g>`;
  return wrap(body, { ringColor: '#dcab4a', ringFill: '#2b2f4a', cls: 'chief', ...opts });
}

// ---------------------------------------------------------------- Mr. Wen, the archivist
/** Mr. Wen, who keeps the Archive: round brass glasses, white hair, a red bow tie, a green cardigan, a pencil behind his ear. */
export function wenAvatar(mood = 'happy', opts = {}) {
  const S = '#f0c79c', SH = '#d3a273';
  const body = `
    <path d="M8 102C8 82 22 73 38 71L62 71C78 73 92 82 92 102Z" fill="#3d7a63"/>
    <path d="M38 71L50 100 28 102Z" fill="#2f6350"/><path d="M62 71L50 100 72 102Z" fill="#2f6350"/>
    <path d="M42.5 70L50 92 57.5 70Z" fill="#f4efe2"/>
    <circle cx="50" cy="86" r="1.7" fill="#dcab4a"/><circle cx="50" cy="94" r="1.7" fill="#dcab4a"/>
    <rect x="44" y="62" width="12" height="11" rx="3" fill="${SH}"/>
    <path d="M40 72l10 3.6L60 72 57 80 50 77.6 43 80Z" fill="#e0463f" stroke="#a82f2a" stroke-width="1"/><circle cx="50" cy="75.6" r="2.4" fill="#b8352e"/>
    <ellipse cx="31" cy="53" rx="3.6" ry="4.6" fill="${SH}"/><ellipse cx="69" cy="53" rx="3.6" ry="4.6" fill="${SH}"/>
    <path d="M70.6 43L77 56" stroke="#dcab4a" stroke-width="3" stroke-linecap="round"/><path d="M76 54l1.8 3.4" stroke="#2a1d1a" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M30.6 48C27 52 28 60 33 62L34.6 52Z" fill="#f4f0e6"/><path d="M69.4 48C73 52 72 60 67 62L65.4 52Z" fill="#f4f0e6"/>
    <ellipse cx="50" cy="53" rx="19.2" ry="21" fill="${S}"/>
    <path d="M32.6 59Q35 71 50 73Q65 71 67.4 59Q65 66 50 67.6Q35 66 32.6 59Z" fill="${SH}" opacity=".4"/>
    <path d="M33 40C38 31.6 62 31.6 67 40 61 36.4 39 36.4 33 40Z" fill="#f4f0e6"/>
    <path d="M36.6 46.6Q42.4 42 48 45.4M52 45.4Q57.6 42 63.4 46.6" fill="none" stroke="#f4f0e6" stroke-width="3.4" stroke-linecap="round"/>
    <g fill="rgba(190,230,245,.32)" stroke="#b9892f" stroke-width="2.2"><circle cx="42.4" cy="53.4" r="7.4"/><circle cx="57.6" cy="53.4" r="7.4"/></g>
    <path d="M49.8 52.4Q50 51.4 50.2 52.4" fill="none" stroke="#b9892f" stroke-width="2"/><path d="M35 52L31.6 50.6M65 52L68.4 50.6" stroke="#b9892f" stroke-width="2" stroke-linecap="round"/>
    ${mood === 'surprised'
      ? [42.4, 57.6].map((cx) => `<circle cx="${cx}" cy="53.4" r="2.4" fill="${INK}"/>`).join('')
      : `<path d="M39 54.4Q42.4 51 45.8 54.4M54.2 54.4Q57.6 51 61 54.4" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`}
    <path d="M50 56.4q-1.8 3.4.4 4.6" fill="none" stroke="${SH}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M42.6 63.6Q50 71.4 57.4 63.6Q50 66.2 42.6 63.6Z" fill="#7a2b2b"/>
    <path d="M42 62Q46 59.6 50 61.6 54 59.6 58 62 54 64 50 62.6 46 64 42 62Z" fill="#f4f0e6"/>
    <circle cx="36.4" cy="61.6" r="3" fill="#e08a6a" opacity=".3"/><circle cx="63.6" cy="61.6" r="3" fill="#e08a6a" opacity=".3"/>`;
  return wrap(body, { ringColor: '#6fd0a8', ringFill: '#173a35', cls: 'wen', ...opts });
}

/** who: 'partner' | 'pip' | 'chief' | 'wen' -> the portrait. */
export function portrait(who, mood = 'happy', opts) {
  if (who === 'chief') return chiefAvatar(mood, opts);
  if (who === 'wen') return wenAvatar(mood, opts);
  return pipAvatar(mood, opts);
}
export const PIP_MOODS = Object.freeze(['happy', 'thinking', 'surprised', 'cheer']);
export const NAMES = Object.freeze({ chief: 'The Chief', partner: 'Pip', pip: 'Pip', wen: 'Mr. Wen' });

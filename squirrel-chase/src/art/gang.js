// The Scribble Gang as round-badge portraits (viewBox 0 0 100 100, decorative). Each animal has a signature colour and a prop, and four moods:
//   smug | surprised | sorry | laughing
// Mischievous, never scary: big eyes, silly props, flat bold shapes in the same vector style as the Case Files cast.
import { INK, badge, eyePair, browPair, mouthFor, moodMarks, tile, stroke, SLAB } from './shared.js';

export const GANG_IDS = Object.freeze(['squirrel', 'raccoon', 'crow', 'possum', 'goat']);
export const GANG_MOODS = Object.freeze(['smug', 'surprised', 'sorry', 'laughing']);
/** Signature colours + display info (name, prop) the app can use for chips and headings. */
export const GANG_LOOK = Object.freeze({
  squirrel: { name: 'Scrabble', animal: 'squirrel', color: '#f08a24', tint: '#ffe3bd', prop: 'a sack stuffed with letter tiles' },
  raccoon:  { name: 'Bandit',   animal: 'raccoon',  color: '#7f88a6', tint: '#dfe4f2', prop: 'a trash-can-lid helmet' },
  crow:     { name: 'Glint',    animal: 'crow',     color: '#7a5cd6', tint: '#e5dcff', prop: 'a necklace of shiny letters' },
  possum:   { name: 'Snooze',   animal: 'possum',   color: '#e5629f', tint: '#ffdcec', prop: 'a nightcap and a snoozing Z' },
  goat:     { name: 'Munch',    animal: 'goat',     color: '#37b27a', tint: '#d3f5e2', prop: 'a vowel to munch' },
});

// ------------------------------------------------------------------ Scrabble the squirrel
function squirrel(m) {
  const F = '#e2822c', FD = '#b85c1a', FL = '#f7b46c', CR = '#fdebcd', G = '#2e8b62';
  const eyes = { xs: [41, 59], y: 49, r: 4.6, mood: m };
  const teeth = m === 'sorry' ? '' : `<path d="M46.2 66.4h3.6v5.4q-1.8.8-3.6 0zM50.2 66.4h3.6v5.4q-1.8.8-3.6 0z" fill="#fff" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`;
  return `
    <path d="M60 99C90 99 98 66 85 43C79 32 64 32 65 42C66 49 77 52 74 65C72 77 63 82 52 89Z" fill="${F}"/>
    <path d="M85 43C79 32 64 32 65 42C66 46 70 48 73 51C79 51 87 50 85 43Z" fill="${FL}"/>
    <path d="M73 86c9-4 13-12 12-21M78 76c5-1 8-5 8-9" ${stroke(FD, 2)} opacity=".55"/>
    <path d="M15 104C15 86 28 77 42 75L58 75C72 77 85 86 85 104Z" fill="${G}"/>
    <path d="M41 75L50 91 59 75Z" fill="${CR}"/>
    <path d="M28 82l14 10M72 82L58 92" ${stroke('#1f6b4a', 1.8)}/>
    <circle cx="50" cy="96" r="1.8" fill="#dcab4a"/>
    <path d="M33 38C30 30 29 20 32 14C40 18 46 26 46 34Z" fill="${F}"/><path d="M34 33C33 27 33 22 34.6 18C38.4 21 41 26 42 31Z" fill="#f0a0a0"/><path d="M32 14C31 10 30 8 29 6 33 8 35 11 36 15Z" fill="${FD}"/>
    <path d="M67 38C70 30 71 20 68 14C60 18 54 26 54 34Z" fill="${F}"/><path d="M66 33C67 27 67 22 65.4 18C61.6 21 59 26 58 31Z" fill="#f0a0a0"/><path d="M68 14C69 10 70 8 71 6 67 8 65 11 64 15Z" fill="${FD}"/>
    <ellipse cx="50" cy="52" rx="21.5" ry="19.5" fill="${F}"/>
    <path d="M30 58Q23 62 28 68Q35 68 37 63ZM70 58Q77 62 72 68Q65 68 63 63Z" fill="${FL}"/>
    <path d="M38 34Q50 28 62 34Q50 31 38 34Z" fill="${FL}" opacity=".7"/>
    <ellipse cx="50" cy="62" rx="12.5" ry="9.2" fill="${CR}"/>
    ${eyePair({ ...eyes, lid: F })}${browPair({ ...eyes, color: '#7a3a10' })}
    <ellipse cx="50" cy="57.2" rx="3.2" ry="2.3" fill="#6b2f1a"/><ellipse cx="49" cy="56.4" rx="1" ry=".6" fill="#fff" opacity=".6"/>
    ${mouthFor(m, 50, m === 'laughing' ? 62.4 : 63, m === 'laughing' ? 5.6 : 5, { dark: '#7a2b2b' })}${teeth}
    <circle cx="33" cy="58" r="3" fill="#ff7b6a" opacity=".35"/><circle cx="67" cy="58" r="3" fill="#ff7b6a" opacity=".35"/>
    <path d="M10 106C6 90 13 79 26 78C39 80 43 93 41 106Z" fill="#c9a46a"/>
    <path d="M10 106C8 96 10 88 16 83C14 92 15 100 20 106Z" fill="#a98348" opacity=".6"/>
    <path d="M15 80Q26 73 37 80" ${stroke('#7a5226', 2.4)}/><circle cx="26" cy="77" r="2.4" fill="#7a5226"/>
    ${tile('S', 14, 68, -16)}${tile('Q', 26, 66, 6)}${tile('Z', 36, 71, 20)}
    <g transform="translate(26 94)"><path d="M-5 -2C-5 5 5 5 5 -2Z" fill="#8b5a2b"/><path d="M-6 -2Q0 -7 6 -2Z" fill="#5a3a1a"/><path d="M0 -6v-3" stroke="#5a3a1a" stroke-width="1.5"/></g>
    ${moodMarks(m, { x: 80, y: 30, left: 18 })}`;
}

// ------------------------------------------------------------------ Bandit the raccoon
function raccoon(m) {
  const G = '#9aa1b3', GD = '#5a6075', W = '#f4f1ea', K = '#2b2a36';
  const eyes = { xs: [40, 60], y: 49, r: 4.2, mood: m };
  return `
    <path d="M62 100C86 98 96 82 90 62" ${stroke(G, 13)}/>
    <path d="M62 100C86 98 96 82 90 62" ${stroke(K, 13)} stroke-dasharray="7 9" stroke-dashoffset="2"/>
    <path d="M14 104C14 86 28 77 42 75L58 75C72 77 86 86 86 104Z" fill="#c1493f"/>
    <path d="M41 75L50 92 59 75Z" fill="${W}"/><path d="M26 82l16 8M74 82L58 90" ${stroke('#8a2f28', 1.8)}/>
    <path d="M30 40C24 30 26 22 34 20C38 22 42 28 42 36Z" fill="${G}"/><path d="M31 36C28 30 29 25 33 24C36 26 38 30 39 34Z" fill="${K}"/>
    <path d="M70 40C76 30 74 22 66 20C62 22 58 28 58 36Z" fill="${G}"/><path d="M69 36C72 30 71 25 67 24C64 26 62 30 61 34Z" fill="${K}"/>
    <path d="M26 52C26 36 36 30 50 30S74 36 74 52C74 64 68 70 60 71L56 74H44L40 71C32 70 26 64 26 52Z" fill="${G}"/>
    <path d="M28 54Q20 56 22 64Q30 66 34 62ZM72 54Q80 56 78 64Q70 66 66 62Z" fill="${W}"/>
    <path d="M27 49C28 40 37 43 50 47C63 43 72 40 73 49C75 58 66 60 60 56C56 53 44 53 40 56C34 60 25 58 27 49Z" fill="${K}"/>
    <ellipse cx="50" cy="62" rx="11.5" ry="8.6" fill="${W}"/>
    <path d="M50 34v11" stroke="${W}" stroke-width="6" stroke-linecap="round"/>
    ${eyePair({ ...eyes, lid: K, white: '#fff' })}${browPair({ ...eyes, color: K, w: 2.8 })}
    <ellipse cx="50" cy="57.6" rx="4" ry="2.8" fill="${K}"/><ellipse cx="48.8" cy="56.7" rx="1.2" ry=".7" fill="#fff" opacity=".6"/>
    ${mouthFor(m, 50, 63.2, 5.2, { dark: '#5a1a28' })}
    <circle cx="36" cy="64" r=".8" fill="${GD}"/><circle cx="64" cy="64" r=".8" fill="${GD}"/>
    <ellipse cx="50" cy="26" rx="19" ry="5.4" fill="#c8ccd6" transform="rotate(-8 50 26)"/>
    <path d="M32 26C34 12 66 12 68 26C58 29 42 29 32 26Z" fill="#aab0bf" transform="rotate(-8 50 26)"/>
    <path d="M38 22C42 17 50 16 55 17" ${stroke('#e6e9f0', 2.2)} transform="rotate(-8 50 26)"/>
    <rect x="45.5" y="9" width="9" height="5" rx="2.5" fill="#808698" transform="rotate(-8 50 26)"/>
    <path d="M36 27h28" ${stroke('#808698', 1.4)} transform="rotate(-8 50 26)"/>
    ${tile('R', 83, 84, 12, 13)}
    <ellipse cx="76" cy="90" rx="6.4" ry="5" fill="${G}"/><path d="M71 91l-1.5 3M74 92.5l-.5 3M77 92.5l.5 3" ${stroke(GD, 1.2)}/>
    ${moodMarks(m, { x: 80, y: 34, left: 20 })}`;
}

// ------------------------------------------------------------------ Glint the crow
function crow(m) {
  const B = '#363b66', BD = '#232748', BL = '#5b62a0', BK = '#f6a63a', BKD = '#d77f1e';
  const eyes = { xs: [38.5, 61.5], y: 46, r: 4.7, mood: m };
  const open = m === 'laughing' || m === 'surprised';
  const beak = open
    ? `<path d="M41 54Q50 49 59 54Q56 62 50 67Q44 62 41 54Z" fill="${BK}"/><path d="M44.5 65Q50 64 55.5 65Q55 78 50 81Q45 78 44.5 65Z" fill="${BKD}"/><path d="M43.6 62.6Q50 66.6 56.4 62.6Q55.5 66.4 50 67Q44.5 66.4 43.6 62.6Z" fill="#6b1f2a"/>${m === 'laughing' ? '<ellipse cx="50" cy="65.5" rx="3" ry="1.5" fill="#f08a8a"/>' : ''}`
    : `<path d="M41 54Q50 48 59 54Q57 68 50 79Q43 68 41 54Z" fill="${BK}"/><path d="M50 52v26" ${stroke(BKD, 1.4)}/><path d="M44 56Q50 53 56 56" ${stroke('#ffd08a', 1.8)} opacity=".8"/>${m === 'smug' ? `<path d="M44 66Q51 70 57 63" ${stroke(INK, 1.7)}/>` : m === 'sorry' ? `<path d="M45 70Q50 66 55 70" ${stroke(INK, 1.6)}/>` : ''}`;
  const letters = ['S', 'H', 'I', 'N', 'Y'];
  const pts = [[27, 80, -50], [37, 88, -28], [50, 91, 0], [63, 88, 28], [73, 80, 50]];
  return `
    <path d="M12 104C12 86 28 76 42 73L58 73C72 76 88 86 88 104Z" fill="${B}"/>
    <path d="M12 104C12 98 14 94 18 90Q20 99 26 104ZM88 104C88 98 86 94 82 90Q80 99 74 104Z" fill="${BD}"/>
    <path d="M30 84Q38 90 46 86M54 86Q62 90 70 84" ${stroke(BL, 2)} opacity=".6"/>
    <path d="M30 40C26 30 30 22 36 18C34 24 38 28 42 30Z" fill="${B}"/><path d="M50 26C48 18 52 12 58 10C56 16 60 20 62 24Z" fill="${B}"/><path d="M70 40C74 30 70 22 64 18C66 24 62 28 58 30Z" fill="${BD}"/>
    <path d="M28 50C26 36 36 28 50 28S74 36 72 50C72 62 62 72 50 72S28 62 28 50Z" fill="${B}"/>
    <path d="M36 34Q50 26 64 34Q50 30 36 34Z" fill="${BL}" opacity=".8"/><path d="M34 44Q33 38 38 34" ${stroke(BL, 2.2)} opacity=".7"/>
    ${eyePair({ ...eyes, white: '#fff8e6', lid: B })}${browPair({ ...eyes, color: '#14172f', w: 2.8 })}
    ${beak}
    <circle cx="33" cy="58" r="3" fill="#ff7b9c" opacity=".3"/><circle cx="67" cy="58" r="3" fill="#ff7b9c" opacity=".3"/>
    <path d="M24 78Q50 100 76 78" ${stroke('#ffd24a', 1.6)}/>
    ${pts.map(([x, y, r], i) => tile(letters[i], x, y, r, 10, '#ffd24a')).join('')}
    <g fill="#fff4b0" stroke="#e8a900" stroke-width=".8"><path d="M14 66l1.4 3.6 3.6 1.4-3.6 1.4-1.4 3.6-1.4-3.6-3.6-1.4 3.6-1.4z"/><path d="M86 58l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z"/></g>
    ${moodMarks(m, { x: 82, y: 28, left: 18 })}`;
}

// ------------------------------------------------------------------ Snooze the possum
function possum(m) {
  const FW = '#ece6df', FG = '#a79fae', FD = '#7a7285', PK = '#f2a0b4', K = '#2a2330';
  const eyes = { xs: [41, 59], y: 47, r: 3.6, mood: m };
  return `
    <path d="M60 100C82 104 98 90 94 70C92 64 86 64 86 70C88 80 76 88 58 86Z" fill="${PK}"/>
    <path d="M14 104C14 86 28 77 42 75L58 75C72 77 86 86 86 104Z" fill="${FG}"/>
    <path d="M41 75L50 92 59 75Z" fill="${FW}"/><path d="M28 84l12 8M72 84L60 92" ${stroke(FD, 1.8)}/>
    <circle cx="30" cy="34" r="12.5" fill="${FD}"/><circle cx="30" cy="34" r="8.4" fill="${PK}"/>
    <circle cx="70" cy="34" r="12.5" fill="${FD}"/><circle cx="70" cy="34" r="8.4" fill="${PK}"/>
    <path d="M50 28C66 28 75 44 70 56C66 64 58 70 52 80Q50 83 48 80C42 70 34 64 30 56C25 44 34 28 50 28Z" fill="${FW}"/>
    <path d="M31 50C28 40 34 32 42 30C36 38 38 46 42 52Z" fill="${FG}" opacity=".7"/><path d="M69 50C72 40 66 32 58 30C64 38 62 46 58 52Z" fill="${FG}" opacity=".7"/>
    ${eyePair({ ...eyes, white: K, pupil: K, lid: FW })}
    ${browPair({ ...eyes, color: FD, w: 2.4 })}
    <ellipse cx="50" cy="73.2" rx="4.4" ry="3.2" fill="${PK}"/><ellipse cx="48.8" cy="72.2" rx="1.3" ry=".8" fill="#fff" opacity=".7"/>
    ${mouthFor(m, 50, 76.4, 4.4, { dark: '#6b1f2a' })}
    <g ${stroke(FD, 1.2)} opacity=".7"><path d="M40 69L28 66M40 72L28 74M60 69L72 66M60 72L72 74"/></g>
    <circle cx="36" cy="60" r="3.2" fill="#ff7b9c" opacity=".35"/><circle cx="64" cy="60" r="3.2" fill="#ff7b9c" opacity=".35"/>
    <path d="M28 36C30 18 48 12 62 16C74 20 76 32 74 40C60 30 40 30 28 36Z" fill="#4a7fd6"/>
    <path d="M28 36C40 30 60 30 74 40L73 45C60 36 40 36 29 42Z" fill="#f4efe2"/>
    <path d="M62 16C74 16 82 24 80 36" ${stroke('#4a7fd6', 8)}/><circle cx="81" cy="40" r="5.4" fill="#f4efe2"/>
    <g fill="#ffe27a"><path d="M44 22l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z"/><path d="M58 26l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9z"/></g>
    <g font-family="${SLAB}" fill="#4a7fd6" opacity=".9"><text x="82" y="22" font-size="11">Z</text><text x="90" y="12" font-size="8">z</text></g>
    ${moodMarks(m, { x: 84, y: 54, left: 14 })}`;
}

// ------------------------------------------------------------------ Munch the goat
function goat(m) {
  const C = '#f6efdc', CD = '#e0d2b2', T = '#c7956a', HR = '#d9c58f', HD = '#a98a4a', PK = '#f2a9a0';
  const eyes = { xs: [40, 60], y: 46, r: 4.6, mood: m };
  const mouthAt = [50, 70];
  const munching = m === 'smug' || m === 'sorry';
  return `
    <path d="M14 104C14 86 28 77 42 75L58 75C72 77 86 86 86 104Z" fill="#4aa3c7"/>
    <path d="M41 75L50 91 59 75Z" fill="${C}"/><path d="M28 84l12 8M72 84L60 92" ${stroke('#2f7fa1', 1.8)}/>
    <path d="M38 36C28 26 26 12 34 6C34 16 42 22 48 30Z" fill="${HR}"/><path d="M62 36C72 26 74 12 66 6C66 16 58 22 52 30Z" fill="${HR}"/>
    <path d="M30 22l6-2M31 15l6-2M70 22l-6-2M69 15l-6-2" ${stroke(HD, 1.4)}/>
    <path d="M32 46L10 40Q6 50 14 54L32 54Z" fill="${CD}"/><path d="M29 47L15 44Q13 49 17 51L29 51Z" fill="${PK}"/>
    <path d="M68 46L90 40Q94 50 86 54L68 54Z" fill="${CD}"/><path d="M71 47L85 44Q87 49 83 51L71 51Z" fill="${PK}"/>
    <path d="M32 36C34 28 66 28 68 36C72 52 66 66 59 71L57 80Q50 86 43 80L41 71C34 66 28 52 32 36Z" fill="${C}"/>
    <path d="M32 40C32 34 38 32 42 34C38 40 40 48 36 54C32 50 30 44 32 40Z" fill="${T}"/>
    <path d="M42 80Q50 100 58 80Q50 86 42 80Z" fill="${T}"/><path d="M45 84Q50 94 55 84" ${stroke('#a8774a', 1.4)}/>
    <ellipse cx="50" cy="66" rx="10.5" ry="8.4" fill="#fff9ea"/>
    ${eyePair({ ...eyes, iris: '#e5b422', slit: true, lid: C })}${browPair({ ...eyes, color: '#8a6a3a', w: 2.5 })}
    <ellipse cx="46" cy="62" rx="1.4" ry="1.9" fill="#a8774a"/><ellipse cx="54" cy="62" rx="1.4" ry="1.9" fill="#a8774a"/>
    ${mouthFor(m, mouthAt[0], mouthAt[1] - 1, 5, { dark: '#6b1f2a' })}
    ${munching ? tile('A', 58, 71.5, 24, 10.5) : m === 'surprised' ? tile('A', 76, 24, 28, 11) : tile('A', 24, 24, -22, 11)}
    ${munching ? '' : `<g ${stroke('#c9b07a', 1.4)}><path d="M${m === 'surprised' ? 76 : 24} 34v4"/></g>`}
    <circle cx="36" cy="58" r="3" fill="#ff8f86" opacity=".33"/><circle cx="64" cy="58" r="3" fill="#ff8f86" opacity=".33"/>
    ${moodMarks(m, { x: 84, y: 62, left: 14 })}`;
}

const DRAW = { squirrel, raccoon, crow, possum, goat };

/**
 * gangPortrait(memberId, mood) -> SVG string (viewBox 0 0 100 100, round badge, aria-hidden).
 * memberId: squirrel | raccoon | crow | possum | goat. mood: smug | surprised | sorry | laughing.
 */
export function gangPortrait(memberId, mood = 'smug', opts = {}) {
  const id = DRAW[memberId] ? memberId : 'squirrel';
  const m = GANG_MOODS.includes(mood) ? mood : 'smug';
  const look = GANG_LOOK[id];
  return badge(DRAW[id](m), { ringColor: look.color, ringFill: look.tint, cls: `gang gang-${id} gang-${m}`, scale: 1.0, ...opts });
}

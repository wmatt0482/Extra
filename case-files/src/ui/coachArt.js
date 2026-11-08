// Little pictures for the step coach and the feedback popups (v0.1.2): the Chief's and the partner's faces, and one small inline
// SVG per step that shows the action (a finger tapping a highlighted sentence, the pin flying to the cork board, a card dropping
// into a timeline slot...). Static by default: every element sits in its "finished" pose, and the animations (index.html,
// .coach-art) only move things toward that pose, so calm motion / prefers-reduced-motion just switches the animation off.
// Colours are the game's own (navy panel, manila, teal, brass, red string).

const FINGER = '<g class="cf-finger"><path d="M0 0c0-3.2 5.2-3.2 5.2 0v13.5l5-1.3c3-.8 4.6 1.6 3.4 4.2l-3.3 10.6c-.8 2.6-2.4 3.8-5 3.8h-3.6c-2.4 0-4.2-1.4-5-3.6l-4.2-10.9c-.9-2.4 1.6-4 3.4-2.6l3.1 2.4z" fill="#f4cfa6" stroke="#8a5a2c" stroke-width="1.6" stroke-linejoin="round"/></g>';
const lines = (x, y, widths, color = '#b9a574', gap = 11) => widths.map((w, i) => `<rect x="${x}" y="${y + i * gap}" width="${w}" height="5" rx="2.5" fill="${color}"/>`).join('');
const frame = (inner) => `<svg viewBox="0 0 260 130" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true" focusable="false"><rect width="260" height="130" rx="10" fill="#0f2a52"/><rect x="3" y="3" width="254" height="124" rx="8" fill="none" stroke="#2c4e86" stroke-width="2"/>${inner}</svg>`;
const doc = (x, y, w, h, extra = '') => `<g><rect x="${x + 3}" y="${y + 4}" width="${w}" height="${h}" rx="4" fill="#06112a" opacity=".5"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#fbf5e3" stroke="#a98d4c" stroke-width="2"/>${extra}</g>`;
const pinHead = (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="#e0463f" stroke="#8f1f1a" stroke-width="1.4"/><circle cx="${x - 1.5}" cy="${y - 1.5}" r="1.6" fill="#ffb3aa"/>`;

export const COACH_ART = {
  // the case board: a cork board with case cards, one tapped
  home: frame(
    '<rect x="22" y="14" width="216" height="102" rx="8" fill="#b98a5c" stroke="#5b3a1c" stroke-width="4"/>'
    + '<g><rect x="40" y="26" width="180" height="24" rx="4" fill="#fbf3dc" stroke="#a98d4c" stroke-width="2"/><circle cx="56" cy="38" r="8" fill="#0a1630" stroke="#dcab4a" stroke-width="2"/>' + lines(72, 33, [70], '#8a7440', 11) + '<rect x="168" y="30" width="44" height="16" rx="4" fill="#2fd1c0" class="cf-glow"/></g>'
    + '<g><rect x="40" y="56" width="180" height="24" rx="4" fill="#fbf3dc" stroke="#a98d4c" stroke-width="2"/><circle cx="56" cy="68" r="8" fill="#0a1630" stroke="#dcab4a" stroke-width="2"/>' + lines(72, 63, [84], '#8a7440', 11) + '<rect x="170" y="62" width="42" height="12" rx="3" fill="none" stroke="#e0463f" stroke-width="2.4" transform="rotate(-6 191 68)"/></g>'
    + '<g opacity=".72"><rect x="40" y="86" width="180" height="22" rx="4" fill="#ecd6a2" stroke="#a98d4c" stroke-width="2" stroke-dasharray="5 4"/><circle cx="56" cy="97" r="8" fill="none" stroke="#a9935a" stroke-width="2"/></g>'
    + '<g transform="translate(188 36)">' + FINGER + '</g>'),
  // the briefing: the Chief talks, a case word is tapped, its meaning pops up
  brief: frame(
    '<rect x="16" y="14" width="150" height="44" rx="10" fill="#1f3a68" stroke="#dcab4a" stroke-width="2.4"/><path d="M40 58l-8 12 22-12z" fill="#1f3a68" stroke="#dcab4a" stroke-width="2.4" stroke-linejoin="round"/>' + lines(28, 26, [118, 96, 108], '#a9bad6', 10)
    + '<circle cx="222" cy="40" r="20" fill="#dcab4a" stroke="#fff3c8" stroke-width="2.4"/><path d="M206 36h32l-3-12h-26z" fill="#0a1630"/><rect x="206" y="34" width="32" height="4" fill="#dcab4a"/><circle cx="215" cy="44" r="2.2" fill="#0a1630"/><circle cx="229" cy="44" r="2.2" fill="#0a1630"/><path d="M214 51q8 5 16 0" fill="none" stroke="#0a1630" stroke-width="2.2" stroke-linecap="round"/>'
    + '<rect x="16" y="84" width="150" height="30" rx="5" fill="#ecd6a2" stroke="#a98d4c" stroke-width="2"/>' + lines(24, 93, [34], '#8a7440') + '<rect x="62" y="89" width="42" height="18" rx="4" fill="#2fd1c0" class="cf-glow"/><text x="83" y="102.5" font-family="Atkinson Hyperlegible, sans-serif" font-size="12" font-weight="700" fill="#032a27" text-anchor="middle">toll</text>' + lines(112, 93, [44], '#8a7440')
    + '<g class="cf-pop"><rect x="150" y="66" width="98" height="30" rx="6" fill="#fffbe9" stroke="#2fd1c0" stroke-width="2.4"/>' + lines(158, 76, [78, 56], '#8a7440', 9) + '</g>'
    + '<g transform="translate(84 100)">' + FINGER + '</g>'),
  // reading: a stack of documents on the desk, the sound button, a highlight reading down the lines
  read: frame(
    doc(20, 30, 70, 80, lines(30, 44, [48, 40, 50], '#b9a574'))
    + doc(150, 24, 86, 88, '')
    + doc(60, 12, 112, 106, '<rect x="60" y="12" width="112" height="16" rx="4" fill="#ecd6a2" stroke="#a98d4c" stroke-width="2"/>' + lines(72, 17, [60], '#8a7440', 7)
      + '<rect x="68" y="36" width="96" height="14" rx="3" fill="#2fd1c0" opacity=".4" class="cf-sweep"/>' + lines(72, 40, [88, 72, 84, 60, 80, 50], '#9c8a5c', 12)
      + '<g transform="translate(142 78)"><circle cx="9" cy="9" r="13" fill="#2fd1c0" stroke="#12766c" stroke-width="2"/><path d="M3 6.6h4l4-3.6v12l-4-3.6H3z" fill="#032a27"/><path d="M14 5.4q3 3.6 0 7.2" fill="none" stroke="#032a27" stroke-width="1.8" stroke-linecap="round"/></g>')
    + '<g transform="translate(112 88)">' + FINGER + '</g>'),
  // pinning: tap the sentence that proves it, the card flies to the cork board
  pin: frame(
    doc(16, 14, 118, 102, lines(26, 26, [92, 76], '#b9a574') + '<rect x="22" y="53" width="106" height="16" rx="4" fill="#ffe27a" class="cf-glow"/>' + lines(26, 58, [94], '#7a6430') + lines(26, 80, [86, 70, 80], '#b9a574'))
    + '<rect x="158" y="14" width="88" height="102" rx="8" fill="#b98a5c" stroke="#5b3a1c" stroke-width="4"/>'
    + '<path d="M170 44c20-12 40 22 62-6" fill="none" stroke="#e0463f" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>'
    + '<g><rect x="172" y="30" width="30" height="20" rx="2" fill="#fffbe9" stroke="#c8b27a" stroke-width="1.4" transform="rotate(-5 187 40)"/>' + pinHead(187, 31) + '</g>'
    + '<g class="cf-fly"><rect x="190" y="66" width="46" height="26" rx="2" fill="#fffbe9" stroke="#c8b27a" stroke-width="1.4" transform="rotate(4 213 79)"/>' + lines(196, 73, [30, 24], '#8a7440', 8) + pinHead(213, 66) + '</g>'
    + '<g transform="translate(84 52)">' + FINGER + '</g>'),
  // ordering: a card drops into the empty timeline slot
  order: frame(
    '<path d="M24 74h212" stroke="#2c4e86" stroke-width="4" stroke-linecap="round"/>'
    + [0, 1, 2].map((i) => `<g><rect x="${22 + i * 76}" y="52" width="64" height="46" rx="6" fill="${i === 1 ? '#173a6a' : '#fbf5e3'}" stroke="${i === 1 ? '#2fd1c0' : '#a98d4c'}" stroke-width="2.4" ${i === 1 ? 'stroke-dasharray="6 5"' : ''}/><circle cx="${34 + i * 76}" cy="62" r="7" fill="#0a1630" stroke="#dcab4a" stroke-width="1.6"/><text x="${34 + i * 76}" y="65.4" font-family="Alfa Slab One, serif" font-size="9" fill="#dcab4a" text-anchor="middle">${i + 1}</text></g>`).join('')
    + lines(32, 78, [44, 32], '#b9a574', 8) + lines(184, 78, [44, 32], '#b9a574', 8)
    + '<g class="cf-drop"><rect x="98" y="52" width="64" height="46" rx="6" fill="#ecd6a2" stroke="#a98d4c" stroke-width="2.4"/>' + lines(108, 70, [44, 36, 40], '#8a7440', 9) + '<circle cx="110" cy="62" r="7" fill="#0a1630" stroke="#dcab4a" stroke-width="1.6"/><text x="110" y="65.4" font-family="Alfa Slab One, serif" font-size="9" fill="#dcab4a" text-anchor="middle">2</text></g>'
    + '<g transform="translate(138 64)">' + FINGER + '</g>'),
  // closing: type the answer on the keyboard, attach the pinned clue
  close: frame(
    '<rect x="16" y="12" width="150" height="30" rx="5" fill="#0a1630" stroke="#2fd1c0" stroke-width="2.6"/><text x="26" y="33" font-family="Alfa Slab One, serif" font-size="17" fill="#f4efe2" letter-spacing="1">TOM FISK</text><rect x="122" y="19" width="3" height="16" fill="#2fd1c0" class="cf-caret"/>'
    + '<g class="cf-clue"><rect x="178" y="10" width="68" height="36" rx="3" fill="#fffbe9" stroke="#c8b27a" stroke-width="1.6" transform="rotate(3 212 28)"/>' + lines(186, 20, [48, 40, 44], '#8a7440', 8) + pinHead(212, 11) + '</g>'
    + [0, 1, 2].map((r) => Array.from({ length: [9, 8, 7][r] }, (_, c) => `<rect x="${[18, 25, 38][r] + c * 24.2}" y="${56 + r * 24}" width="20" height="19" rx="3.5" fill="#ecd6a2" stroke="#a98d4c" stroke-width="1.6" ${r === 0 && c === 3 ? 'class="cf-key"' : ''}/>`).join('')).join('')
    + '<rect x="196" y="104" width="46" height="19" rx="3.5" fill="#2fd1c0" stroke="#12766c" stroke-width="1.6"/>'
    + '<g transform="translate(80 70)">' + FINGER + '</g>'),
};

// The faces in the popups: the Chief and the partner, Pip (the portraits live in ./art/characters.js; the feedback popup swaps in Pip thinking).
import { chiefAvatar, pipAvatar } from './art/characters.js';
export const AVATAR = { chief: chiefAvatar(), partner: pipAvatar('happy') };
export const WHO_NAME = { chief: 'The Chief', partner: 'Pip' };

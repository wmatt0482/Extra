// A small illustration for each kind of document in a case file: logbook, letter, witness statement, placard, newspaper, notice,
// note, ledger, map, diary, receipt. Bold flat vector objects (64x64), drawn in the game's own manila, brass and navy, shown on the desk
// folders and in the document headers. docArt(kind) -> an SVG string (decorative, aria-hidden).

const O = '#5a4220';                      // the ink outline
const P = `stroke="${O}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
const bars = (x, y, widths, gap = 7, color = '#a58a52') => widths.map((w, i) => `<rect x="${x}" y="${y + i * gap}" width="${w}" height="3" rx="1.5" fill="${color}"/>`).join('');
const pin = (x, y) => `<circle cx="${x}" cy="${y}" r="4" fill="#e0463f" stroke="#8f1f1a" stroke-width="1.6"/><circle cx="${x - 1.2}" cy="${y - 1.2}" r="1.2" fill="#ffb3aa"/>`;

const ART = {
  logbook: `<rect x="13" y="7" width="38" height="50" rx="4" fill="#7a4a2a" ${P}/><rect x="13" y="7" width="8" height="50" rx="3" fill="#5c3419" ${P}/>
    <rect x="25" y="15" width="21" height="17" rx="2" fill="#f4e8c4" stroke="${O}" stroke-width="1.8"/>${bars(28, 20, [15, 11], 6, '#8a7440')}
    <path d="M13 12h-3M13 52h-3" stroke="#dcab4a" stroke-width="3" stroke-linecap="round"/><path d="M42 57v6l3-2.4 3 2.4v-6z" fill="#e0463f" stroke="#8f1f1a" stroke-width="1.4"/>
    <circle cx="35" cy="44" r="5" fill="none" stroke="#dcab4a" stroke-width="2.6"/><path d="M35 41.6v4.8M32.6 44h4.8" stroke="#dcab4a" stroke-width="2"/>`,
  letter: `<rect x="6" y="16" width="52" height="38" rx="4" fill="#f6ecd0" ${P}/><path d="M7 18l25 20L57 18" fill="none" ${P}/><path d="M7 53l18-18M57 53L39 35" fill="none" stroke="#c8b27a" stroke-width="2" stroke-linecap="round"/>
    <circle cx="32" cy="39" r="7" fill="#c93a33" stroke="#8f1f1a" stroke-width="2"/><path d="M32 35.4l1.4 2.8 3 .4-2.2 2.1.5 3-2.7-1.4-2.7 1.4.5-3-2.2-2.1 3-.4z" fill="#f2a29b"/>`,
  witness: `<rect x="11" y="9" width="42" height="52" rx="4" fill="#9a6a3c" ${P}/><rect x="16" y="15" width="32" height="42" rx="2" fill="#fbf5e3" stroke="${O}" stroke-width="1.8"/>
    <rect x="23" y="5" width="18" height="10" rx="3" fill="#dcab4a" ${P}/><path d="M21 27c0-4 4-5.4 6-3.4M33 27c0-4 4-5.4 6-3.4" fill="none" stroke="#2fb4a4" stroke-width="3.4" stroke-linecap="round"/><circle cx="22" cy="27" r="2" fill="#2fb4a4"/><circle cx="34" cy="27" r="2" fill="#2fb4a4"/>
    ${bars(21, 34, [22, 18], 6)}<path d="M21 51q4-7 7-1t7-3 6 2" fill="none" stroke="#1f5a78" stroke-width="2.2" stroke-linecap="round"/>`,
  statement: null,
  notice: `<path d="M12 8h40l-2 5 2 5-2 5 2 5-2 5 2 5-2 5 2 5H12l2-5-2-5 2-5-2-5 2-5-2-5 2-5z" fill="#f6ecd0" ${P}/><rect x="17" y="13" width="30" height="10" rx="2" fill="#c93a33"/><rect x="21" y="16" width="22" height="4" rx="1.5" fill="#f9d8d4"/>
    ${bars(18, 29, [28, 24, 28, 16], 6.5, '#8a7440')}${pin(32, 9)}`,
  placard: `<rect x="8" y="14" width="48" height="32" rx="4" fill="#d9a73f" ${P}/><rect x="13" y="19" width="38" height="22" rx="2" fill="#f4e0a0" stroke="#8a6418" stroke-width="1.8"/>${bars(18, 24, [28, 22, 26], 6.2, '#8a6418')}
    <path d="M20 46l-6 12M44 46l6 12" stroke="${O}" stroke-width="3.6" stroke-linecap="round"/><circle cx="12" cy="18" r="1.8" fill="#8a6418"/><circle cx="52" cy="18" r="1.8" fill="#8a6418"/>`,
  newspaper: `<rect x="5" y="10" width="46" height="46" rx="3" fill="#f2ecd8" ${P}/><path d="M51 18h8v33a5 5 0 0 1-5 5H51" fill="#e6dec4" ${P}/>
    <rect x="10" y="15" width="36" height="7" rx="1" fill="#2a2a3a"/><rect x="10" y="26" width="16" height="13" fill="#9fb3cf" stroke="${O}" stroke-width="1.6"/><path d="M12 37l5-6 4 4 3-3 2 5z" fill="#4a6a96"/>
    ${bars(29, 26, [17, 17, 17, 11], 5, '#6b6b72')}${bars(10, 43, [36, 30], 5.4, '#6b6b72')}`,
  note: `<path d="M10 10h44v36l-12 12H10z" fill="#ffe27a" ${P}/><path d="M54 46H42v12z" fill="#e6c34a" ${P}/>${bars(17, 24, [30, 22, 28, 14], 7, '#8a7440')}${pin(32, 10)}`,
  ledger: `<rect x="8" y="9" width="46" height="48" rx="4" fill="#2f7a5c" ${P}/><rect x="8" y="9" width="8" height="48" rx="3" fill="#225c45" ${P}/>
    <rect x="21" y="15" width="28" height="36" rx="2" fill="#f6ecd0" stroke="${O}" stroke-width="1.8"/><path d="M21 24h28M21 31h28M21 38h28M21 45h28M35 15v36" stroke="#8aa39a" stroke-width="1.6"/>
    <circle cx="48" cy="48" r="9" fill="#dcab4a" stroke="#8a6418" stroke-width="2.2"/><path d="M48 43v10M45 46q3-3 6 0t-6 4t6 0" fill="none" stroke="#8a6418" stroke-width="1.8" stroke-linecap="round"/>`,
  map: `<path d="M5 14l18-6 18 6 18-6v42l-18 6-18-6-18 6z" fill="#efe0b0" ${P}/><path d="M23 8v42M41 14v42" stroke="#c8b27a" stroke-width="2"/>
    <path d="M12 38q8-14 16-4t14-12 10 8" fill="none" stroke="#2f8fb8" stroke-width="3.6" stroke-linecap="round"/><path d="M14 26q6 6 12 2" fill="none" stroke="#5a4220" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round"/>
    <path d="M46 36l8 8M54 36l-8 8" stroke="#c93a33" stroke-width="4" stroke-linecap="round"/>`,
  diary: `<rect x="12" y="8" width="40" height="50" rx="5" fill="#8f3b52" ${P}/><rect x="12" y="8" width="7" height="50" rx="3" fill="#6e2a3e" ${P}/><rect x="42" y="26" width="14" height="9" rx="2" fill="#dcab4a" stroke="#8a6418" stroke-width="2"/><circle cx="49" cy="30.5" r="1.8" fill="#8a6418"/>
    <path d="M32 18l2.4 4.8 5.3.8-3.8 3.8.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.8 5.3-.8z" fill="#f4cf72" stroke="#8a6418" stroke-width="1.4"/>${bars(24, 42, [20, 14], 6, '#d9a1b0')}`,
  receipt: `<path d="M14 6h36v52l-6-4-6 4-6-4-6 4-6-4-6 4z" fill="#fbf5e3" ${P}/><rect x="20" y="12" width="24" height="6" rx="1.5" fill="#3a3a48"/>${bars(20, 24, [24, 18, 24, 14], 6, '#8a8a92')}
    <path d="M20 47h24" stroke="#5a4220" stroke-width="1.8" stroke-dasharray="3 3"/><rect x="34" y="40" width="10" height="3" rx="1.5" fill="#c93a33"/>`,
  document: `<rect x="12" y="6" width="40" height="52" rx="4" fill="#fbf5e3" ${P}/>${bars(19, 16, [26, 20, 26, 22, 24], 7, '#a58a52')}<path d="M52 6l-12 0 0 12z" fill="#dcc084" stroke="${O}" stroke-width="1.6"/>`,
};
ART.statement = ART.witness;

/** The label for a kind (the folder tab and the header). */
export const DOC_KIND_NAME = Object.freeze({
  logbook: 'Logbook', letter: 'Letter', witness: 'Witness statement', statement: 'Statement', notice: 'Notice', placard: 'Museum placard', newspaper: 'Newspaper',
  note: 'Note', ledger: 'Ledger', map: 'Map', diary: 'Diary', receipt: 'Receipt',
});

/** A small picture for a document kind (64x64 SVG string). Unknown kinds get a plain paper. */
export function docArt(kind) {
  const inner = ART[kind] || ART.document;
  return `<svg class="cf-docart" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${inner}</svg>`;
}

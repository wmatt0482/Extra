// Postcard scenes: one illustrated scene per New York tour city, drawn on a 600 x 400 card (the live area is x 14..586, y 14..386).
// Each scene is (id) => svg string; ids keep gradients unique. The title ribbon sits over the top-left, the stamp over the top-right,
// so the interest of each scene lives in the lower two thirds.
import { INK } from './shared.js';

const f = (n) => +n.toFixed(1);
export const sky = (id, a, b) => `<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect x="0" y="0" width="600" height="400" fill="url(#${id}s)"/>`;
export const sun = (x, y, r = 30, c = '#ffd34d') => `<circle cx="${x}" cy="${y}" r="${r * 1.9}" fill="${c}" opacity=".2"/><circle cx="${x}" cy="${y}" r="${r * 1.35}" fill="${c}" opacity=".3"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
export const cloud = (x, y, s = 1, o = 0.95) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#fff" opacity="${o}"><ellipse cx="0" cy="0" rx="30" ry="12"/><circle cx="-12" cy="-9" r="13"/><circle cx="8" cy="-13" r="16"/><circle cx="24" cy="-4" r="10"/></g>`;
export const pine = (x, y, h = 60, c = '#2f7d4f', c2 = '#256a42') => `<g><rect x="${x - 3}" y="${y - h * 0.18}" width="6" height="${h * 0.2}" fill="#6b4a2a"/><path d="M${x} ${y - h} L${x + h * 0.3} ${y - h * 0.45} L${x - h * 0.3} ${y - h * 0.45}Z" fill="${c}"/><path d="M${x} ${y - h * 0.72} L${x + h * 0.36} ${y - h * 0.18} L${x - h * 0.36} ${y - h * 0.18}Z" fill="${c2}"/></g>`;
export const tree = (x, y, h = 60, c = '#4fa456', c2 = '#3d8a48') => `<g><rect x="${x - 3.5}" y="${y - h * 0.5}" width="7" height="${h * 0.5}" fill="#6b4a2a"/><circle cx="${x}" cy="${y - h * 0.68}" r="${h * 0.34}" fill="${c}"/><circle cx="${x + h * 0.14}" cy="${y - h * 0.6}" r="${h * 0.24}" fill="${c2}" opacity=".7"/></g>`;
const water = (id, y, a = '#5fb8e6', b = '#2f86bf') => `<defs><linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect x="0" y="${y}" width="600" height="${400 - y}" fill="url(#${id}w)"/>`;
const ripples = (y, n = 6, c = '#fff', o = 0.55) => Array.from({ length: n }, (_, i) => { const x = 40 + ((i * 97) % 520), yy = y + 14 + ((i * 29) % 60); return `<path d="M${x} ${yy}q8 -5 16 0t16 0t16 0" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" opacity="${o}"/>`; }).join('');
const win = (x, y, w, h, c = '#2b3a67') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${c}"/>`;

const rochester = (id) => `${sky(id, '#7fcdf2', '#fff1c4')}${sun(500, 120, 26)}${cloud(120, 110)}${cloud(380, 90, 0.8)}
  <path d="M0 250Q120 200 260 240T600 220V400H0Z" fill="#7cc27a"/>
  <path d="M0 232L190 224L226 300L248 400H0Z" fill="#a38f74"/><path d="M600 228L418 222L384 300L352 400H600Z" fill="#9a8668"/>
  <g stroke="#7d6a52" stroke-width="3" opacity=".7"><path d="M20 262H214M30 290H230M40 320H240M360 266H590M372 296H590M360 330H590"/></g>
  <path d="M0 232L190 224L192 238L0 246Z" fill="#6cb865"/><path d="M600 228L418 222L416 236L600 242Z" fill="#6cb865"/>
  <rect x="180" y="206" width="240" height="12" fill="#4a3b32"/><path d="M180 218L210 238L240 218L270 238L300 218L330 238L360 218L390 238L420 218" fill="none" stroke="#4a3b32" stroke-width="5"/><rect x="180" y="238" width="240" height="4" fill="#4a3b32"/>
  <g><rect x="40" y="140" width="96" height="92" fill="#b8553f"/><path d="M34 140L88 104L142 140Z" fill="#7a3a2c"/><rect x="146" y="96" width="18" height="136" fill="#a04a38"/>${[0, 1, 2].map((i) => [0, 1, 2].map((j) => win(52 + i * 28, 154 + j * 24, 16, 14, '#ffe9a0')).join('')).join('')}<circle cx="164" cy="82" r="10" fill="#fff" opacity=".7"/><circle cx="176" cy="64" r="14" fill="#fff" opacity=".55"/></g>
  <rect x="262" y="222" width="78" height="110" fill="#e7f7ff"/><defs><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dff5ff"/><stop offset="1" stop-color="#9fdcf6"/></linearGradient></defs><path d="M258 222H344L348 332H254Z" fill="url(#${id}f)"/>
  <g stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".9"><path d="M276 228V326M292 226V330M308 228V324M324 226V330"/></g>
  <ellipse cx="300" cy="338" rx="62" ry="16" fill="#fff" opacity=".85"/><circle cx="262" cy="326" r="18" fill="#fff" opacity=".7"/><circle cx="340" cy="324" r="20" fill="#fff" opacity=".7"/>
  ${water(id, 340, '#6cc3ea', '#3d93c8')}<ellipse cx="300" cy="344" rx="70" ry="10" fill="#fff" opacity=".8"/>${ripples(340)}
  <g transform="translate(430 346)"><path d="M0 0H110L100 18H12Z" fill="#3c3a4a"/><rect x="24" y="-22" width="52" height="22" fill="#f4e6c4"/><path d="M20 -22H80L70 -34H30Z" fill="#c9503f"/><rect x="34" y="-16" width="10" height="9" fill="#5fb8e6"/><rect x="54" y="-16" width="10" height="9" fill="#5fb8e6"/><path d="M96 0V-30" stroke="#3c3a4a" stroke-width="3"/><path d="M96 -30l16 5l-16 5z" fill="#d94a3d"/></g>
  ${tree(60, 238, 54)}${tree(560, 232, 60)}${pine(530, 236, 56)}`;

const buffalo = (id) => `${sky(id, '#77c8f0', '#fff0c8')}${sun(470, 96, 28)}${cloud(150, 96, 1.1)}${cloud(330, 130, 0.7)}
  <path d="M0 270Q150 250 320 270T600 262V400H0Z" fill="#8ccf86"/>
  ${water(id, 292)}<rect x="0" y="286" width="600" height="14" fill="#e9d8a8"/>${ripples(296, 8)}
  <g transform="translate(300 288) scale(0.72) translate(-300 -288)"><rect x="140" y="236" width="94" height="52" fill="#e4d6b4"/><rect x="366" y="236" width="94" height="52" fill="#e4d6b4"/><rect x="224" y="204" width="152" height="84" fill="#eadfbe"/><rect x="250" y="146" width="100" height="62" fill="#e0d3ae"/><rect x="274" y="94" width="52" height="56" fill="#e7dbb8"/><rect x="286" y="68" width="28" height="28" fill="#d6c79c"/><path d="M280 68L300 34L320 68Z" fill="#3fa58a"/><rect x="298" y="22" width="4" height="14" fill="#8a6a2c"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${236 + i * 24}" y="214" width="12" height="40" rx="6" fill="#6d8cb3"/>`).join('')}${[0, 1, 2, 3].map((i) => `<rect x="${260 + i * 22}" y="158" width="10" height="34" rx="5" fill="#6d8cb3"/>`).join('')}${[0, 1].map((i) => `<rect x="${284 + i * 18}" y="104" width="8" height="30" rx="4" fill="#6d8cb3"/>`).join('')}
    ${[0, 1, 2].map((i) => `<rect x="${154 + i * 26}" y="248" width="14" height="28" rx="2" fill="#6d8cb3"/><rect x="${378 + i * 26}" y="248" width="14" height="28" rx="2" fill="#6d8cb3"/>`).join('')}
    <path d="M250 146V288M350 146V288M274 94V150M326 94V150" stroke="#cdbd92" stroke-width="3"/></g>
  <g transform="translate(520 290)"><path d="M-22 0H22L14 -84H-14Z" fill="#fff" stroke="#e8e0d0" stroke-width="2"/><path d="M-19 -22H19L17 -40H-17Z" fill="#d94a3d"/><rect x="-14" y="-98" width="28" height="14" fill="#555d72"/><path d="M-18 -98H18L0 -118Z" fill="#d94a3d"/><circle cx="0" cy="-90" r="6" fill="#fff3a0"/><path d="M-8 -90L-120 -130L-120 -70Z" fill="#fff3a0" opacity=".25"/></g>
  <path d="M470 300H600V312H470Z" fill="#9a8a6e"/>
  <g transform="translate(90 330)"><path d="M-22 0H22L16 10H-16Z" fill="#d94a3d"/><path d="M0 -4V-40L18 -8Z" fill="#fff"/><path d="M-2 -4V-32L-16 -8Z" fill="#ffe6a0"/></g>
  <g transform="translate(380 354) scale(.8)"><path d="M-22 0H22L16 10H-16Z" fill="#2f4a7a"/><path d="M0 -4V-40L18 -8Z" fill="#fff"/><path d="M-2 -4V-32L-16 -8Z" fill="#f2b138"/></g>
  ${tree(90, 276, 50)}${tree(130, 280, 40)}`;

const niagara = (id) => `${sky(id, '#7ccbf2', '#e4f6ff')}${cloud(130, 90)}${cloud(470, 110, 0.8)}
  <path d="M0 190L120 168L200 176V400H0Z" fill="#8a9a72"/><path d="M600 188L480 168L400 176V400H600Z" fill="#8a9a72"/>
  <path d="M0 190L120 168L124 182L0 204Z" fill="#5fae5a"/><path d="M600 188L480 168L476 182L600 202Z" fill="#5fae5a"/>
  <defs><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fe0d2"/><stop offset=".25" stop-color="#e8fbff"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>
  <path d="M110 170Q300 250 490 170L500 150L100 150Z" fill="#5fd0c4"/>
  <path d="M110 170Q300 250 490 170L490 316Q300 350 110 316Z" fill="url(#${id}f)"/>
  <g stroke="#bfeaf5" stroke-width="3" stroke-linecap="round" opacity=".85">${Array.from({ length: 13 }, (_, i) => { const x = 130 + i * 28; const top = 176 + Math.sin((i / 12) * Math.PI) * 52; return `<path d="M${x} ${f(top + 6)}V${f(300 + Math.sin((i / 12) * Math.PI) * 22)}"/>`; }).join('')}</g>
  <path d="M0 300Q300 340 600 300V400H0Z" fill="#4aa6d8" opacity="0"/>
  ${water(id, 318, '#79d0ee', '#2f86bf')}
  <g fill="#fff" opacity=".85"><ellipse cx="300" cy="320" rx="190" ry="26"/><circle cx="170" cy="312" r="30"/><circle cx="430" cy="312" r="32"/><circle cx="240" cy="300" r="26"/><circle cx="370" cy="298" r="28"/></g>
  ${ripples(334, 7)}
  <g opacity=".9" fill="none" stroke-width="7" stroke-linecap="round"><path d="M360 300A140 140 0 0 1 560 190" stroke="#ff7b7b" opacity=".45"/><path d="M368 300A132 132 0 0 1 553 194" stroke="#ffd34d" opacity=".45"/><path d="M376 300A124 124 0 0 1 546 198" stroke="#7be0a0" opacity=".45"/><path d="M384 300A116 116 0 0 1 539 202" stroke="#6bb8ff" opacity=".45"/></g>
  <g transform="translate(250 356)"><path d="M-44 0H44L34 20H-34Z" fill="#2f5fa8"/><rect x="-30" y="-14" width="60" height="14" fill="#fff"/><rect x="-18" y="-26" width="36" height="12" fill="#fff"/>${[-24, -12, 0, 12, 24].map((x) => `<circle cx="${x}" cy="-7" r="3.4" fill="#d94a3d"/>`).join('')}<path d="M-6 -26V-42" stroke="#555" stroke-width="2.4"/><path d="M-6 -42l14 5l-14 5z" fill="#d94a3d"/></g>
  ${tree(30, 190, 50)}${tree(70, 184, 44)}${pine(560, 186, 52)}${tree(520, 186, 44)}`;

const syracuse = (id) => `${sky(id, '#86d0f2', '#fff0c4')}${sun(80, 96, 24)}${cloud(300, 90)}${cloud(500, 120, 0.8)}
  <path d="M0 280Q160 240 330 272T600 262V400H0Z" fill="#82c97e"/>
  <g><path d="M96 300L122 192M164 300L138 192" stroke="#d94a3d" stroke-width="7" stroke-linecap="round"/><circle cx="130" cy="190" r="74" fill="none" stroke="#2f4a7a" stroke-width="6"/><circle cx="130" cy="190" r="52" fill="none" stroke="#2f4a7a" stroke-width="3.5"/>
    <g stroke="#2f4a7a" stroke-width="3">${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<path d="M130 190L${f(130 + Math.cos(a) * 74)} ${f(190 + Math.sin(a) * 74)}"/>`; }).join('')}</g>
    ${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; const c = ['#d94a3d', '#f2b138', '#3f9a8f', '#8a63c9'][i % 4]; return `<rect x="${f(130 + Math.cos(a) * 74 - 7)}" y="${f(190 + Math.sin(a) * 74 - 6)}" width="14" height="14" rx="3" fill="${c}"/>`; }).join('')}<circle cx="130" cy="190" r="8" fill="#f2b138" stroke="#2f4a7a" stroke-width="3"/></g>
  <g transform="translate(353 300) scale(0.78) translate(-353 -300)"><rect x="310" y="150" width="86" height="150" fill="#b8553f"/><rect x="302" y="140" width="102" height="14" fill="#8e3e2e"/><path d="M308 140L353 84L398 140Z" fill="#3f7d8a"/><rect x="349" y="58" width="8" height="28" fill="#8a6a2c"/><circle cx="353" cy="176" r="24" fill="#fff6dc" stroke="#8e3e2e" stroke-width="4"/><path d="M353 176V160M353 176L364 182" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>${[0, 1].map((i) => `<rect x="${326 + i * 38}" y="214" width="14" height="26" rx="7" fill="#ffe9a0"/><rect x="${326 + i * 38}" y="256" width="14" height="26" rx="7" fill="#ffe9a0"/>`).join('')}</g>
  <rect x="404" y="226" width="70" height="74" fill="#e9c46a"/><rect x="404" y="226" width="70" height="10" fill="#c9a14a"/>${[0, 1, 2].map((i) => win(414 + i * 20, 246, 12, 20, '#7a5a1a')).join('')}
  <g>${[0, 1, 2].map((i) => `<path d="M${490 + i * 38} 300L${512 + i * 38} 244L${534 + i * 38} 300Z" fill="#fff" stroke="#dfe7ee" stroke-width="2"/><path d="M${512 + i * 38} 244L${534 + i * 38} 300H${520 + i * 38}Z" fill="#cdd9e4"/>`).join('')}<g fill="#fff4b0"><path d="M520 236l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M570 262l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z"/></g></g>
  ${water(id, 316, '#6cc3ea', '#3d93c8')}<rect x="0" y="308" width="600" height="12" fill="#c9a96a"/>${ripples(322, 6)}
  <g transform="translate(270 352)"><path d="M0 0H120L110 18H12Z" fill="#8a3f2f"/><rect x="30" y="-22" width="58" height="22" fill="#f4e6c4"/><path d="M26 -22H92L82 -34H36Z" fill="#3f7d8a"/><rect x="40" y="-16" width="10" height="9" fill="#5fb8e6"/><rect x="62" y="-16" width="10" height="9" fill="#5fb8e6"/></g>
  ${pine(40, 298, 50)}${tree(580, 300, 52)}`;

const albany = (id) => `${sky(id, '#7fcdf2', '#fff0c8')}${sun(540, 100, 24)}${cloud(110, 104)}${cloud(450, 70, 0.7)}
  <rect x="0" y="300" width="600" height="100" fill="#7cc27a"/>
  <g><path d="M120 340H480L500 372H100Z" fill="#cfc8b8"/><path d="M140 322H460L480 340H120Z" fill="#d9d2c2"/><path d="M160 308H440L460 322H140Z" fill="#e2dccd"/></g>
  <g transform="translate(300 308) scale(0.86) translate(-300 -308)"><rect x="150" y="196" width="300" height="112" fill="#dcc99f"/><rect x="150" y="196" width="300" height="10" fill="#c4ae80"/>${Array.from({ length: 7 }, (_, i) => `<rect x="${164 + i * 40}" y="222" width="18" height="${i === 3 ? 0 : 30}" rx="9" fill="#5d7a9e"/><rect x="${164 + i * 40}" y="266" width="18" height="30" rx="9" fill="#5d7a9e"/>`).join('')}
    <rect x="140" y="150" width="82" height="158" fill="#d4c092"/><rect x="378" y="150" width="82" height="158" fill="#d4c092"/>
    <path d="M132 150L181 100L230 150Z" fill="#56657f"/><path d="M370 150L419 100L468 150Z" fill="#56657f"/>
    <rect x="272" y="120" width="56" height="88" fill="#d9c59a"/><path d="M262 120L300 56L338 120Z" fill="#56657f"/><rect x="298" y="34" width="4" height="26" fill="#8a6a2c"/><path d="M302 34h18l-5 6l5 6h-18z" fill="#d94a3d"/>
    <circle cx="300" cy="150" r="16" fill="#fff6dc" stroke="#8a6a2c" stroke-width="3"/><path d="M300 150V140M300 150L307 154" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
    ${[0, 1].map((i) => `<rect x="${158 + i * 36}" y="170" width="14" height="24" rx="7" fill="#5d7a9e"/><rect x="${396 + i * 36}" y="170" width="14" height="24" rx="7" fill="#5d7a9e"/>`).join('')}
    <rect x="270" y="208" width="60" height="100" fill="#cdb988"/><path d="M276 308V236Q300 212 324 236V308Z" fill="#4a5f80"/></g>
  ${tree(60, 304, 70)}${tree(104, 308, 56)}${tree(540, 304, 70)}${tree(496, 308, 56)}
  <g>${[60, 90, 120, 480, 510, 540].map((x, i) => `<circle cx="${x}" cy="${376 + (i % 2) * 6}" r="5" fill="${['#ff7aa8', '#ffd34d', '#fff'][i % 3]}"/>`).join('')}</g>`;

const cooperstown = (id) => `${sky(id, '#7ecbf3', '#fff2cb')}${sun(500, 90, 24)}${cloud(120, 90)}${cloud(330, 118, 0.7)}
  <path d="M0 200Q120 150 260 190T600 170V260H0Z" fill="#6fb36f"/><path d="M0 232H600V270H0Z" fill="#7fc47b"/>
  <path d="M0 214Q150 190 330 214T600 206V232H0Z" fill="#4fa6d8" opacity=".85"/>
  <g><rect x="0" y="236" width="600" height="26" fill="#2f7d4f"/><rect x="0" y="236" width="600" height="5" fill="#ffd34d"/>${Array.from({ length: 16 }, (_, i) => `<path d="M${i * 40 + 6} 226l14 -10l14 10z" fill="${['#d94a3d', '#f2b138', '#3f9a8f', '#4a7fd6'][i % 4]}"/>`).join('')}<path d="M0 224Q300 238 600 224" fill="none" stroke="#6b4a2a" stroke-width="2"/></g>
  <rect x="0" y="262" width="600" height="138" fill="#79c36f"/>
  <path d="M300 276L470 340L300 396L130 340Z" fill="#d9a066"/><path d="M300 296L430 342L300 380L170 342Z" fill="#8fd17f"/>
  <g fill="#fff" stroke="#c9b48a" stroke-width="2"><rect x="292" y="268" width="16" height="12" transform="rotate(45 300 274)"/><rect x="458" y="332" width="14" height="14" transform="rotate(45 465 339)"/><rect x="128" y="332" width="14" height="14" transform="rotate(45 135 339)"/><rect x="292" y="384" width="14" height="10" /></g><ellipse cx="300" cy="338" rx="16" ry="8" fill="#c58a52"/><rect x="293" y="336" width="14" height="4" rx="1" fill="#fff"/>
  <g transform="translate(116 322) rotate(-12)"><circle r="54" fill="#fff" stroke="#d6cfc0" stroke-width="3"/><path d="M-30 -42Q-6 -22 -30 0Q-6 22 -30 42" fill="none" stroke="#d94a3d" stroke-width="3.4"/><path d="M30 -42Q6 -22 30 0Q6 22 30 42" fill="none" stroke="#d94a3d" stroke-width="3.4"/><g stroke="#d94a3d" stroke-width="2.6">${[-30, -18, -6, 6, 18, 30].map((y) => `<path d="M-${Math.abs(y) > 18 ? 22 : 32} ${y}l-6 3M${Math.abs(y) > 18 ? 22 : 32} ${y}l6 3"/>`).join('')}</g></g>
  <g transform="translate(470 330) rotate(35)"><rect x="-8" y="-90" width="18" height="100" rx="9" fill="#d9a066"/><rect x="-4" y="-30" width="10" height="70" rx="4" fill="#c58a52"/><rect x="-3" y="36" width="8" height="26" rx="4" fill="#6b4a2a"/></g>
  <g transform="translate(540 374)"><path d="M-20 0Q0 -10 20 0L14 10H-14Z" fill="#6b4a2a"/></g>`;

const corning = (id) => `${sky(id, '#a9ddf4', '#fff0d0')}${sun(90, 96, 24)}${cloud(300, 80)}${cloud(520, 120, 0.7)}
  <path d="M0 262Q150 210 300 250T600 238V400H0Z" fill="#7cbf7a"/>
  <g><rect x="440" y="170" width="90" height="100" fill="#a5513c"/><rect x="456" y="110" width="16" height="64" fill="#8e4331"/><rect x="494" y="130" width="14" height="44" fill="#8e4331"/>${[0, 1, 2].map((i) => win(450 + i * 26, 196, 14, 18, '#ffe9a0')).join('')}<circle cx="464" cy="96" r="12" fill="#fff" opacity=".7"/><circle cx="478" cy="76" r="16" fill="#fff" opacity=".5"/></g>
  <rect x="0" y="316" width="600" height="84" fill="#a9733a"/><rect x="0" y="316" width="600" height="8" fill="#8a5a28"/><path d="M0 346H600M0 372H600" stroke="#8a5a28" stroke-width="2" opacity=".6"/>
  <defs><linearGradient id="${id}v" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fe0e8"/><stop offset=".5" stop-color="#5a9cf0"/><stop offset="1" stop-color="#a97be8"/></linearGradient></defs>
  <path d="M270 120Q262 150 252 190Q236 250 262 292Q268 316 300 318Q332 316 338 292Q364 250 348 190Q338 150 330 120Z" fill="url(#${id}v)" stroke="#2f6fb0" stroke-width="3" opacity=".92"/>
  <path d="M262 112H338V124H262Z" fill="#7fd6ee" stroke="#2f6fb0" stroke-width="3"/><ellipse cx="300" cy="112" rx="38" ry="7" fill="#c9f2fb" stroke="#2f6fb0" stroke-width="3"/>
  <path d="M274 160Q262 200 268 250" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".7"/><path d="M290 170Q300 220 292 280" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5"/><path d="M270 214Q300 236 336 208M268 250Q300 272 340 244" fill="none" stroke="#fff" stroke-width="2.4" opacity=".55"/>
  <g><path d="M170 316Q172 270 232 270L238 316Z" fill="#ff9a3c" stroke="#c9631c" stroke-width="3"/><path d="M182 284Q190 276 206 276" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/></g>
  <g><path d="M388 316L384 262Q380 250 392 246H420Q432 250 428 262L424 316Z" fill="#7be0a0" stroke="#2f8a58" stroke-width="3" opacity=".95"/><path d="M394 262Q392 290 398 308" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/></g>
  <g><path d="M30 150L150 214" stroke="#8a8f98" stroke-width="7" stroke-linecap="round"/><circle cx="160" cy="220" r="26" fill="#ff8a1f"/><circle cx="160" cy="220" r="16" fill="#ffd34d"/><circle cx="160" cy="220" r="34" fill="#ffb347" opacity=".3"/></g>
  <g fill="#fff4b0" stroke="#e8a900" stroke-width="1"><path d="M240 140l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/><path d="M370 160l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4z"/><path d="M350 118l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/></g>`;

const lakeplacid = (id) => `${sky(id, '#8fd0f2', '#f3fbff')}${sun(90, 110, 22, '#fff2a8')}${cloud(300, 90, 0.9)}${cloud(540, 130, 0.7)}
  <path d="M0 250L120 130L190 200L270 100L380 230L460 160L600 260V320H0Z" fill="#6d84a8"/><path d="M120 130L90 170L110 164L124 182L140 166L150 176Z" fill="#fff"/><path d="M270 100L240 150L262 142L276 164L296 142L312 154Z" fill="#fff"/><path d="M460 160L438 192L456 186L470 204L486 186L500 194Z" fill="#fff"/>
  <path d="M0 290Q140 230 300 270T600 250V330H0Z" fill="#4c7a8c"/><path d="M0 300Q120 270 300 292T600 280V340H0Z" fill="#fff" opacity=".35"/>
  ${pine(30, 300, 70)}${pine(70, 306, 56)}${pine(110, 304, 64)}${pine(160, 308, 48)}${pine(210, 306, 56)}
  <g><path d="M360 306L460 224" stroke="#f3fbff" stroke-width="40" stroke-linecap="round" opacity=".0"/><path d="M330 308L420 210L440 214L440 308Z" fill="#fff"/><path d="M330 308L420 210" stroke="#cfe3f2" stroke-width="3"/></g>
  <g transform="translate(-14 40)"><rect x="450" y="120" width="14" height="190" fill="#8a93a3"/><rect x="474" y="120" width="14" height="190" fill="#8a93a3"/><rect x="450" y="120" width="38" height="12" fill="#6b7384"/><path d="M450 150H488M450 180H488M450 210H488M450 240H488M450 270H488" stroke="#6b7384" stroke-width="3"/><path d="M450 150L488 180M450 180L488 210M450 210L488 240M450 240L488 270" stroke="#6b7384" stroke-width="2.4"/><path d="M456 128Q420 150 372 214L360 220" fill="none" stroke="#d94a3d" stroke-width="7" stroke-linecap="round"/><rect x="440" y="104" width="52" height="18" fill="#d94a3d"/><path d="M440 104H492L466 84Z" fill="#fff"/></g>
  <g transform="translate(396 188) rotate(30)"><ellipse cx="0" cy="0" rx="11" ry="4.5" fill="#2f4a7a"/><circle cx="-12" cy="-2" r="4" fill="#f2c9a0"/><path d="M-18 6H18" stroke="#d94a3d" stroke-width="2.4"/></g>
  ${water(id, 318, '#7bc0e0', '#3f86b0')}<g stroke="#fff" opacity=".55" stroke-width="2" fill="none"><path d="M40 340H180M100 360H260M300 346H460M360 372H540M420 336H560" stroke-linecap="round"/></g>
  ${pine(570, 330, 60)}${pine(540, 336, 48)}`;

const saratoga = (id) => `${sky(id, '#86d0f2', '#fff1c8')}${sun(520, 100, 24)}${cloud(120, 100)}${cloud(380, 80, 0.8)}
  <rect x="0" y="260" width="600" height="140" fill="#79c36f"/>
  <g><rect x="60" y="176" width="220" height="86" fill="#f1e8d4"/><path d="M50 176L170 124L290 176Z" fill="#d94a3d"/>${Array.from({ length: 8 }, (_, i) => `<path d="M${50 + i * 30} 176L${170 - 60 + i * 15} 124H${170 - 60 + i * 15 + 15}L${50 + (i + 1) * 30} 176Z" fill="${i % 2 ? '#fff' : '#d94a3d'}" opacity="0"/>`).join('')}${Array.from({ length: 6 }, (_, i) => `<rect x="${72 + i * 34}" y="196" width="22" height="30" rx="2" fill="#5d7a9e"/>`).join('')}<rect x="60" y="238" width="220" height="10" fill="#c9bfa5"/><path d="M60 176H280" stroke="#d94a3d" stroke-width="6"/><circle cx="170" cy="150" r="10" fill="#fff6dc" stroke="#8a6a2c" stroke-width="2"/></g>
  ${tree(330, 276, 100, '#3f9a56', '#2f7d4f')}${tree(560, 280, 96, '#3f9a56', '#2f7d4f')}${tree(26, 280, 70, '#4fa456', '#3d8a48')}
  <rect x="0" y="292" width="600" height="6" fill="#fff"/><g fill="#fff">${Array.from({ length: 20 }, (_, i) => `<rect x="${i * 32 + 10}" y="282" width="6" height="26"/>`).join('')}</g><rect x="0" y="302" width="600" height="6" fill="#fff"/>
  <rect x="0" y="312" width="600" height="88" fill="#c98f58"/><path d="M0 350H600M0 380H600" stroke="#b27a46" stroke-width="2" opacity=".7" stroke-dasharray="14 10"/>
  <g transform="translate(300 330)"><path d="M120 -6Q150 -6 170 -34" stroke="#5a3a1e" stroke-width="17" stroke-linecap="round" fill="none"/><ellipse cx="60" cy="-2" rx="64" ry="25" fill="#7a4a24" transform="rotate(-4 60 -2)"/><ellipse cx="177" cy="-48" rx="19" ry="12" fill="#6b3f1e" transform="rotate(30 177 -48)"/><path d="M171 -58L170 -72L180 -60Z" fill="#6b3f1e"/><circle cx="182" cy="-52" r="3" fill="#fff"/><circle cx="183" cy="-52" r="1.4" fill="${INK}"/>
    <path d="M142 -24Q132 -60 155 -64" stroke="#3a2412" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M-6 -12Q-40 -16 -56 4" stroke="#3a2412" stroke-width="9" fill="none" stroke-linecap="round"/>
    <g stroke="#5a3a1e" stroke-width="10" stroke-linecap="round" fill="none"><path d="M100 14L136 34L150 30"/><path d="M118 10L152 12"/><path d="M12 14L-24 38L-36 34"/><path d="M26 18L-4 40"/></g>
    <g fill="#2a1a0c"><circle cx="152" cy="30" r="5"/><circle cx="154" cy="12" r="5"/><circle cx="-36" cy="34" r="5"/><circle cx="-4" cy="40" r="5"/></g>
    <g transform="translate(96 -34)"><ellipse cx="0" cy="0" rx="26" ry="14" fill="#2f4a7a" transform="rotate(-14)"/><circle cx="22" cy="-14" r="9" fill="#f2c9a0"/><path d="M14 -20Q22 -30 32 -20Z" fill="#d94a3d"/><path d="M-10 -4L-22 -30" stroke="#f2b138" stroke-width="5" stroke-linecap="round"/><path d="M14 -4L36 -14" stroke="#2f4a7a" stroke-width="5" stroke-linecap="round"/></g></g>`;

const ithaca = (id) => `${sky(id, '#8fd3f2', '#fff0c8')}${sun(92, 96, 22)}${cloud(300, 90)}
  <path d="M0 200Q150 160 300 180T600 170V260H0Z" fill="#6ab36f"/><path d="M180 190Q300 176 420 188V214H180Z" fill="#4fa6d8"/><path d="M0 210H180L220 400H0Z" fill="#c9a572"/><path d="M600 210H420L380 400H600Z" fill="#c4a06c"/>
  <g stroke="#a98450" stroke-width="3.4" opacity=".8"><path d="M0 240H190M0 270H200M0 300H206M0 330H212M0 360H218M600 240H410M600 270H400M600 300H394M600 330H388M600 360H382"/></g>
  <path d="M0 210H190L184 224H0Z" fill="#5fae5a"/><path d="M600 210H410L416 224H600Z" fill="#5fae5a"/>
  ${tree(36, 214, 70, '#4fa456')}${tree(100, 220, 60, '#3d8a48')}${tree(560, 214, 72, '#4fa456')}${tree(500, 220, 60, '#3d8a48')}${pine(160, 220, 52)}
  <defs><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9fbff"/><stop offset="1" stop-color="#a9e3f6"/></linearGradient></defs>
  <path d="M250 220H350L360 276H244Z" fill="url(#${id}f)"/><path d="M236 276H366L380 330H222Z" fill="#fff" opacity=".92"/><path d="M222 330H380L398 400H204Z" fill="url(#${id}f)"/>
  <g stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"><path d="M268 226V270M300 224V274M332 226V270M258 284V326M290 282V328M322 282V328M352 284V326"/></g>
  ${water(id, 372, '#7fd0ee', '#3f93c8')}<ellipse cx="300" cy="374" rx="110" ry="12" fill="#fff" opacity=".8"/>
  <g><path d="M170 196V230Q300 170 430 230V196Q300 140 170 196Z" fill="#b9ac98" stroke="#8d8068" stroke-width="3"/><path d="M200 230Q300 186 400 230" fill="none" stroke="#8d8068" stroke-width="3"/>${Array.from({ length: 8 }, (_, i) => `<path d="M${190 + i * 30} ${210 - Math.sin((i / 7) * Math.PI) * 16}v10" stroke="#8d8068" stroke-width="2.4"/>`).join('')}</g>`;

const nyc = (id) => `${sky(id, '#6a56c4', '#ffb26b')}<defs><linearGradient id="${id}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a63d0"/><stop offset=".55" stop-color="#ff8aa0"/><stop offset="1" stop-color="#ffc774"/></linearGradient></defs><rect width="600" height="400" fill="url(#${id}t)"/>${sun(330, 270, 38, '#fff0a0')}
  <g fill="#fff" opacity=".35"><ellipse cx="120" cy="120" rx="70" ry="9"/><ellipse cx="470" cy="150" rx="80" ry="10"/><ellipse cx="260" cy="190" rx="60" ry="7"/></g>
  <g fill="#2c2f66">${[[20, 220, 40, 100], [56, 190, 36, 130], [96, 236, 44, 84], [150, 200, 34, 120], [186, 226, 40, 94], [330, 210, 40, 110], [368, 176, 38, 144], [410, 216, 46, 104], [458, 196, 36, 124], [498, 232, 44, 88]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h + 2}"/>`).join('')}
    <g transform="translate(282 320) scale(0.74) translate(-282 -320)"><rect x="244" y="188" width="76" height="132"/><rect x="258" y="150" width="48" height="40"/><rect x="268" y="118" width="28" height="34"/><rect x="274" y="92" width="16" height="28"/><rect x="280" y="52" width="4" height="42"/><path d="M266 118L282 96L298 118Z"/></g></g>
  <g fill="#ffe7a0">${Array.from({ length: 70 }, (_, i) => { const x = 24 + ((i * 53) % 480), y = 150 + ((i * 37) % 160); return (x % 3 === 0 || i % 4 === 0) ? `<rect x="${x}" y="${y}" width="4" height="6" opacity="${0.5 + (i % 5) / 10}"/>` : ''; }).join('')}<rect x="272" y="140" width="4" height="6"/><rect x="288" y="140" width="4" height="6"/><rect x="270" y="170" width="4" height="6"/><rect x="290" y="170" width="4" height="6"/><rect x="258" y="220" width="4" height="6"/><rect x="278" y="236" width="4" height="6"/><rect x="298" y="220" width="4" height="6"/></g>
  <g stroke="#2c2f66" fill="none" stroke-width="5"><path d="M14 330V240M120 330V240"/><path d="M14 240Q67 300 120 240" stroke-width="3"/><path d="M-10 260Q14 240 14 240M120 240Q150 262 170 262" stroke-width="3"/></g><rect x="0" y="314" width="190" height="8" fill="#2c2f66"/>
  <defs><linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9d6e"/><stop offset=".3" stop-color="#7a5bb8"/><stop offset="1" stop-color="#2f3a7c"/></linearGradient></defs><rect x="0" y="320" width="600" height="80" fill="url(#${id}w)"/>
  <g stroke="#ffe0a0" stroke-width="3" stroke-linecap="round" opacity=".6"><path d="M300 330H360M280 342H380M290 356H370"/></g><g stroke="#fff" opacity=".35" stroke-width="2" fill="none" stroke-linecap="round"><path d="M30 350q10-5 20 0t20 0M150 372q10-5 20 0t20 0M430 346q10-5 20 0t20 0"/></g>
  <g transform="translate(150 330)"><path d="M0 0H70L62 14H8Z" fill="#f4efe2"/><rect x="14" y="-14" width="40" height="14" fill="#fff"/><rect x="24" y="-24" width="22" height="10" fill="#f2b138"/>${[0, 1, 2, 3].map((i) => `<rect x="${18 + i * 9}" y="-9" width="5" height="5" fill="#2f4a7a"/>`).join('')}</g>
  <g transform="translate(500 372)"><path d="M-44 0Q0 -18 44 0V28H-44Z" fill="#8d7a5a"/><path d="M-30 -2H30L24 -20H-24Z" fill="#a8a190"/><path d="M-22 -20H22L18 -50H-18Z" fill="#b8b2a0"/><path d="M-18 -50H18L12 -72H-12Z" fill="#a8a190"/>
    <path d="M-14 -72H14L18 -112Q0 -124 -18 -112Z" fill="#6fcdb4"/><path d="M-6 -72L-8 -112" stroke="#4aa68e" stroke-width="3"/><path d="M8 -72L10 -112" stroke="#4aa68e" stroke-width="3"/>
    <path d="M10 -108Q30 -122 30 -150" fill="none" stroke="#6fcdb4" stroke-width="11" stroke-linecap="round"/><path d="M24 -150Q30 -176 30 -182" stroke="#6fcdb4" stroke-width="3" fill="none"/><path d="M22 -172Q30 -196 38 -172Q30 -160 22 -172Z" fill="#ffd34d"/><circle cx="30" cy="-176" r="14" fill="#ffd34d" opacity=".3"/>
    <circle cx="0" cy="-124" r="11" fill="#6fcdb4"/><path d="M-12 -130L-24 -138M-8 -134L-12 -146M0 -136V-150M8 -134L12 -146M12 -130L24 -138" stroke="#6fcdb4" stroke-width="3.4" stroke-linecap="round"/><path d="M-18 -104L-30 -96V-76L-14 -80Z" fill="#4aa68e"/></g>`;

const generic = (id) => `${sky(id, '#7fcdf2', '#fff1c8')}${sun(500, 100, 26)}${cloud(120, 100)}${cloud(350, 80, 0.8)}
  <path d="M0 250Q120 190 260 240T600 210V400H0Z" fill="#8ccf86"/><path d="M0 290Q160 240 340 290T600 270V400H0Z" fill="#6bb86a"/>
  <path d="M240 400Q270 330 330 296Q360 280 380 270" fill="none" stroke="#d9a066" stroke-width="40" stroke-linecap="round" opacity="0"/><path d="M200 400Q280 330 340 300T420 262L430 262Q370 300 330 330Q270 380 300 400Z" fill="#c98f58"/><path d="M262 400Q300 340 345 316" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="12 12"/>
  <g transform="translate(150 330)"><rect x="-3" y="-60" width="6" height="64" fill="#6b4a2a"/><path d="M-46 -60H34L50 -48L34 -36H-46Z" fill="#d94a3d"/><path d="M-34 -30H46L30 -18L46 -6H-34Z" fill="#f2b138"/></g>
  <g transform="translate(470 150)"><ellipse cx="0" cy="0" rx="34" ry="40" fill="#ff6f59"/><path d="M-34 0Q0 -60 34 0Q0 40 -34 0Z" fill="#ffd34d" opacity=".0"/><path d="M-12 -38Q-30 0 -8 40M12 -38Q30 0 8 40" stroke="#ffd34d" stroke-width="7" fill="none"/><rect x="-12" y="48" width="24" height="16" rx="3" fill="#8a5a28"/><path d="M-14 38L-10 48M14 38L10 48" stroke="#555" stroke-width="2"/></g>
  ${tree(60, 300, 60)}${pine(560, 310, 70)}${pine(520, 316, 52)}`;

// ---- USA Tour scenes (generic landmarks only: no logos, team marks, brands or readable names) ----
const gull = (x, y, s = 1) => `<path d="M${x - 9 * s} ${y}q${4.5 * s} ${-6 * s} ${9 * s} 0q${4.5 * s} ${-6 * s} ${9 * s} 0" fill="none" stroke="#fff" stroke-width="${2.4 * s}" stroke-linecap="round" stroke-linejoin="round"/>`;
const palm = (x, y, h = 90, lean = 10) => `<g><path d="M${x} ${y}Q${x + lean * 0.4} ${y - h * 0.5} ${x + lean} ${y - h}" fill="none" stroke="#8a5a28" stroke-width="7" stroke-linecap="round"/>${[-70, -35, 0, 35, 70].map((a) => `<path d="M${x + lean} ${y - h}q${Math.sin((a * Math.PI) / 180) * 34} ${-14 + Math.abs(a) * 0.22} ${Math.sin((a * Math.PI) / 180) * 46} ${6 + Math.abs(a) * 0.3}" fill="none" stroke="#2f9a58" stroke-width="7" stroke-linecap="round"/>`).join('')}<circle cx="${x + lean - 3}" cy="${y - h + 5}" r="3.4" fill="#6b4a2a"/><circle cx="${x + lean + 4}" cy="${y - h + 6}" r="3.4" fill="#6b4a2a"/></g>`;
const snowPeak = (x, y, w, h, c = '#8a9fc4', c2 = '#6f84ad') => `<path d="M${x - w / 2} ${y}L${x} ${y - h}L${x + w / 2} ${y}Z" fill="${c}"/><path d="M${x} ${y - h}L${x + w / 2} ${y}L${x + w * 0.08} ${y}L${x + w * 0.02} ${y - h * 0.4}Z" fill="${c2}"/><path d="M${x} ${y - h}L${x + w * 0.17} ${y - h * 0.62}L${x + w * 0.07} ${y - h * 0.68}L${x} ${y - h * 0.55}L${x - w * 0.09} ${y - h * 0.66}L${x - w * 0.17} ${y - h * 0.62}Z" fill="#fff"/>`;

const boston = (id) => `${sky(id, '#7bc9f0', '#ffeccb')}${sun(120, 196, 22)}${cloud(330, 104, 0.8)}${cloud(470, 190, 0.6)}
  <g fill="#8396bd" opacity=".9">${[[400, 236, 26, 70], [428, 212, 30, 94], [462, 246, 24, 60], [490, 226, 34, 80], [530, 244, 26, 62]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('')}</g>
  <g fill="#c9dcf4" opacity=".8">${[[408, 246], [440, 226], [440, 250], [498, 240], [498, 264], [470, 266]].map(([x, y]) => `<rect x="${x}" y="${y}" width="6" height="9"/>`).join('')}</g>
  <rect x="0" y="296" width="600" height="104" fill="#b9ab94"/>
  ${[[12, 152, 62, '#b8553f'], [78, 138, 54, '#a84a38'], [136, 160, 62, '#c26a4a'], [202, 144, 50, '#b04b3a']].map(([x, h, w, c], i) => `<g><rect x="${x}" y="${296 - h * 0.62}" width="${w}" height="${h * 0.62}" fill="${c}"/><path d="M${x - 3} ${296 - h * 0.62}L${x + w / 2} ${296 - h * 0.62 - 20}L${x + w + 3} ${296 - h * 0.62}Z" fill="#5a3a30"/><rect x="${x + 8 + (i % 2) * 28}" y="${296 - h * 0.62 - 28}" width="9" height="20" fill="#8e4331"/>${[0, 1].map((r) => [0, 1].map((q) => win(x + 10 + q * 26, 296 - h * 0.62 + 10 + r * 28, 14, 18, r + q + i ? '#ffe9a0' : '#fff6d0')).join('')).join('')}<rect x="${x + w / 2 - 6}" y="278" width="12" height="18" fill="#3c2c28"/></g>`).join('')}
  <g><rect x="262" y="236" width="118" height="60" fill="#c0523c"/><rect x="262" y="230" width="118" height="8" fill="#e8d9b8"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="${274 + i * 22}" y="240" width="9" height="56" fill="#f2e8cc"/>`).join('')}<path d="M270 240L321 214L372 240Z" fill="#e8d9b8"/>
    <rect x="296" y="196" width="50" height="22" fill="#d8c9a4"/><path d="M296 196Q321 128 346 196Z" fill="#f2c13a"/><path d="M296 196Q321 128 346 196" fill="none" stroke="#c98d12" stroke-width="3"/><path d="M308 188Q316 156 322 140" stroke="#fff3a8" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/><rect x="318" y="118" width="6" height="20" fill="#f2c13a"/><circle cx="321" cy="116" r="5" fill="#f2c13a"/></g>
  <path d="M0 310H600" stroke="#c0503a" stroke-width="7" stroke-dasharray="16 4"/>
  ${water(id, 330, '#6cc3ea', '#2f86bf')}${ripples(330, 7)}
  <g transform="translate(468 352)"><path d="M-84 0H84L66 22H-66Z" fill="#5a3a30"/><path d="M-84 0H84" stroke="#e8d9b8" stroke-width="5"/><path d="M-60 0V-96M0 0V-122M58 0V-90" stroke="#6b4a2a" stroke-width="5"/>
    ${[[-60, -84, 34], [-60, -50, 40], [0, -112, 40], [0, -70, 48], [58, -80, 32], [58, -46, 38]].map(([x, y, w]) => `<path d="M${x - w / 2} ${y}H${x + w / 2}V${y + 30}Q${x} ${y + 36} ${x - w / 2} ${y + 30}Z" fill="#fff6e0" stroke="#d8c9a4" stroke-width="2"/>`).join('')}<path d="M0 -122L22 -128L0 -134Z" fill="#d94a3d"/></g>
  <g transform="translate(110 372)"><path d="M-22 0H22L16 10H-16Z" fill="#d94a3d"/><path d="M0 -4V-40L18 -8Z" fill="#fff"/><path d="M-2 -4V-32L-16 -8Z" fill="#ffe6a0"/></g>
  ${gull(210, 190)}${gull(250, 168, 0.8)}${gull(540, 160, 0.9)}`;

const philadelphia = (id) => `${sky(id, '#7ac8f0', '#fff0cf')}${sun(90, 200, 22)}${cloud(300, 100, 0.8)}${cloud(500, 180, 0.7)}
  <g fill="#7e8fb3" opacity=".85">${[[20, 220, 30, 90], [54, 196, 26, 114], [86, 230, 34, 80], [470, 214, 28, 96], [502, 188, 32, 122], [538, 228, 30, 82]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('')}</g>
  <path d="M0 292Q150 270 300 288T600 276V400H0Z" fill="#7cc27a"/>
  <g><rect x="150" y="226" width="300" height="76" fill="#b8553f"/><rect x="150" y="296" width="300" height="8" fill="#d8c9a4"/><path d="M144 226H456L430 206H170Z" fill="#5a3a30"/>
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => [0, 1].map((r) => `<rect x="${164 + i * 40}" y="${236 + r * 34}" width="16" height="24" fill="#f6f0dc"/><rect x="${166 + i * 40}" y="${238 + r * 34}" width="12" height="20" fill="#7a9cc4" opacity=".8"/>`).join('')).join('')}
    <rect x="270" y="206" width="60" height="20" fill="#f6f0dc"/><rect x="282" y="150" width="36" height="58" fill="#f6f0dc"/><rect x="288" y="164" width="24" height="28" fill="#fff" stroke="#d8c9a4" stroke-width="2"/><circle cx="300" cy="178" r="9" fill="#fffdf4" stroke="#8e7a52" stroke-width="2"/><path d="M300 178V171M300 178L305 180" stroke="#2b3a67" stroke-width="2" stroke-linecap="round"/><path d="M278 150H322L300 112Z" fill="#8f3a2c"/><path d="M300 112V96" stroke="#8a5a28" stroke-width="3"/><path d="M300 98L316 103L300 108Z" fill="#d94a3d"/>
    <rect x="270" y="262" width="60" height="42" fill="#f6f0dc"/><path d="M282 304V276Q300 262 318 276V304Z" fill="#6b4a2a"/></g>
  <path d="M0 330Q300 310 600 330V400H0Z" fill="#c2a98a"/><path d="M0 348H600M0 372H600" stroke="#a88e70" stroke-width="3" opacity=".6"/>${Array.from({ length: 18 }, (_, i) => `<ellipse cx="${20 + i * 34}" cy="${338 + (i % 3) * 18}" rx="12" ry="5" fill="#b29878" opacity=".7"/>`).join('')}
  <g transform="translate(468 330)"><path d="M-4 -92H4V-80H-4Z" fill="#6b4a2a"/><rect x="-40" y="-86" width="80" height="10" rx="3" fill="#8a5a28"/><path d="M-36 -76Q-40 -30 -52 -2H52Q40 -30 36 -76Z" fill="#d6a042"/><path d="M-36 -76Q-40 -30 -52 -2H-30Q-26 -34 -22 -76Z" fill="#f2c460" opacity=".8"/><path d="M-52 -2H52" stroke="#a87a28" stroke-width="5" stroke-linecap="round"/><path d="M-8 -2L-2 -26L-10 -44L0 -60" fill="none" stroke="#7a5418" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="0" cy="-8" r="6" fill="#7a5418"/></g>
  ${tree(60, 316, 62)}${tree(560, 312, 56)}${gull(220, 170)}${gull(400, 160, 0.8)}`;

const washington = (id) => `${sky(id, '#75c6f2', '#fff0d6')}${sun(520, 190, 22)}${cloud(330, 96, 0.8)}${cloud(120, 190, 0.6)}
  <path d="M0 286Q150 262 300 280T600 270V400H0Z" fill="#82c878"/>
  <g transform="translate(-60 74)"><rect x="470" y="122" width="22" height="130" fill="#f4efe6"/><path d="M468 122L481 82L494 122Z" fill="#e6dfd2"/><path d="M481 82L494 122H481Z" fill="#d6cebf"/><path d="M481 82L486 92L481 92Z" fill="#d94a3d"/><circle cx="481" cy="80" r="3" fill="#d94a3d"/></g>
  <g><rect x="80" y="244" width="300" height="40" fill="#f2ece0"/><rect x="60" y="262" width="340" height="24" fill="#e6dfd2"/><rect x="146" y="206" width="170" height="40" fill="#f6f1e6"/>
    ${Array.from({ length: 11 }, (_, i) => `<rect x="${152 + i * 15}" y="212" width="6" height="30" fill="#d9d1c0"/>`).join('')}${Array.from({ length: 16 }, (_, i) => `<rect x="${92 + i * 18}" y="250" width="6" height="32" fill="#dcd4c4"/>`).join('')}
    <path d="M140 206H322L312 194H150Z" fill="#fffaf0"/><rect x="176" y="168" width="110" height="28" fill="#fffaf0"/>${Array.from({ length: 8 }, (_, i) => `<rect x="${182 + i * 13}" y="172" width="5" height="22" fill="#d9d1c0"/>`).join('')}<rect x="172" y="162" width="118" height="8" fill="#e6dfd2"/>
    <path d="M186 162Q186 112 231 108Q276 112 276 162Z" fill="#fffaf0"/><path d="M186 162Q186 112 231 108Q252 110 262 124Q236 120 222 162Z" fill="#e6dfd2" opacity=".8"/><path d="M200 156Q200 126 214 120" stroke="#fff" stroke-width="3" fill="none" opacity=".9" stroke-linecap="round"/><rect x="224" y="86" width="14" height="26" fill="#fffaf0"/><path d="M222 88Q231 66 240 88Z" fill="#e6dfd2"/><path d="M231 66V52" stroke="#8a8f98" stroke-width="2.4"/><path d="M231 54L247 59L231 64Z" fill="#d94a3d"/></g>
  <path d="M30 312Q300 296 570 312L596 340Q300 322 4 340Z" fill="#8fd0ef"/><path d="M60 322Q300 308 540 322" fill="none" stroke="#fff" stroke-width="2.4" opacity=".7"/><path d="M0 340Q300 322 600 340V400H0Z" fill="#82c878"/>
  <g>${[[40, 340], [100, 360], [520, 346], [570, 366], [440, 370]].map(([x, y]) => `<g><rect x="${x - 3}" y="${y - 34}" width="6" height="34" fill="#6b4a2a"/><circle cx="${x}" cy="${y - 46}" r="22" fill="#ffb7d0"/><circle cx="${x - 14}" cy="${y - 36}" r="14" fill="#ff9fc0"/><circle cx="${x + 14}" cy="${y - 38}" r="15" fill="#ffc9dc"/></g>`).join('')}</g>
  <g fill="#ffd1e0">${[[150, 372], [210, 380], [300, 362], [360, 384], [270, 392]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="2.4"/>`).join('')}</g>${gull(380, 140, 0.8)}`;

const capecanaveral = (id) => `<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4d9de0"/><stop offset=".6" stop-color="#ffd0a0"/><stop offset="1" stop-color="#ffe9c0"/></linearGradient></defs><rect width="600" height="400" fill="url(#${id}s)"/>${sun(150, 250, 26, '#fff2a0')}${cloud(340, 112, 0.8)}${cloud(120, 180, 0.6)}
  <rect x="0" y="286" width="600" height="114" fill="#f0dca8"/>${water(id, 270, '#58b8e8', '#2f86bf')}<rect x="0" y="270" width="600" height="3" fill="#fff" opacity=".6"/><path d="M0 282Q150 270 300 284T600 276V318H0Z" fill="#f0dca8"/><path d="M0 310Q200 296 400 312T600 306V400H0Z" fill="#7cc27a"/><path d="M0 340Q200 326 400 342T600 336V400H0Z" fill="#69b36a"/>
  <g transform="translate(430 338) scale(.8)"><path d="M-70 0H70V14H-70Z" fill="#9aa0ab"/><rect x="-60" y="-8" width="120" height="10" fill="#b7bcc6"/>
    <g stroke="#ff7a3a" stroke-width="5" fill="none" stroke-linecap="round"><path d="M-54 -8V-170M-30 -8V-170"/><path d="M-54 -50H-30M-54 -90H-30M-54 -130H-30M-54 -8L-30 -50L-54 -90L-30 -130L-54 -170"/></g><path d="M-30 -140H-4M-30 -100H-4M-30 -60H-4" stroke="#ff7a3a" stroke-width="4"/><rect x="-60" y="-178" width="34" height="8" fill="#ff7a3a"/>
    <path d="M10 -2V-30" stroke="#6b7280" stroke-width="3"/>
    <g><path d="M8 -4V-150Q8 -186 30 -206Q52 -186 52 -150V-4Z" fill="#fffaf0"/><path d="M30 -206Q52 -186 52 -150V-4H34Q42 -100 30 -206Z" fill="#dfe6ee"/><path d="M8 -150H52V-132H8Z" fill="#2a2e3c"/><rect x="8" y="-96" width="44" height="10" fill="#d94a3d"/><circle cx="30" cy="-120" r="7" fill="#8fd3f4" stroke="#2a2e3c" stroke-width="2.4"/><path d="M8 -26L-8 8V12H8Z" fill="#d94a3d"/><path d="M52 -26L68 8V12H52Z" fill="#d94a3d"/><path d="M30 -206Q40 -196 44 -184H16Q20 -196 30 -206Z" fill="#d94a3d"/></g>
    <g fill="#fff" opacity=".92"><ellipse cx="30" cy="8" rx="38" ry="14"/><circle cx="-6" cy="2" r="16"/><circle cx="70" cy="2" r="18"/><circle cx="30" cy="-6" r="14"/></g></g>
  ${palm(60, 330, 100, 14)}${palm(120, 346, 70, -10)}${palm(560, 350, 84, -12)}
  <g transform="translate(300 292)"><path d="M-26 0H26L18 10H-18Z" fill="#fff"/><path d="M0 -4V-34L16 -8Z" fill="#ffd34d"/><path d="M-2 -4V-26L-14 -8Z" fill="#ff7a3a"/></g>${gull(240, 214)}${gull(290, 196, 0.8)}`;

const neworleans = (id) => `${sky(id, '#ff9b6a', '#ffe1a8')}<defs><linearGradient id="${id}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a6ad0"/><stop offset=".6" stop-color="#ff9b78"/><stop offset="1" stop-color="#ffe0a0"/></linearGradient></defs><rect width="600" height="400" fill="url(#${id}d)"/>${sun(330, 250, 30, '#fff0a0')}
  <path d="M0 316Q300 304 600 316V400H0Z" fill="#c69a6a"/>
  ${[[0, '#f2c14e', 100], [104, '#ee7a9a', 120], [228, '#58c0b0', 104], [336, '#f29a4e', 118], [458, '#b08ae0', 142]].map(([x, c, w], i) => `<g><rect x="${x}" y="${176 + (i % 2) * 18}" width="${w - 4}" height="${142 - (i % 2) * 18}" fill="${c}"/><rect x="${x}" y="${170 + (i % 2) * 18}" width="${w - 4}" height="8" fill="#fff" opacity=".35"/>${[0, 1].map((q) => `<rect x="${x + 12 + q * ((w - 40) / 2 + 4)}" y="${196 + (i % 2) * 18}" width="${(w - 40) / 2 - 4}" height="38" fill="#3a2f4a"/><path d="M${x + 12 + q * ((w - 40) / 2 + 4)} ${196 + (i % 2) * 18}h${(w - 40) / 2 - 4}" stroke="#fff" stroke-width="3" opacity=".7"/>`).join('')}
    <rect x="${x - 4}" y="${248 + (i % 2) * 18}" width="${w + 4}" height="8" fill="#2a2e3c"/><g stroke="#2a2e3c" stroke-width="2.6" fill="none">${Array.from({ length: Math.floor(w / 12) }, (_, k) => `<path d="M${x + 2 + k * 12} ${256 + (i % 2) * 18}v-18"/>`).join('')}<path d="M${x - 4} ${238 + (i % 2) * 18}H${x + w}"/><path d="M${x + 2} ${256 + (i % 2) * 18}q${w / 4} 14 ${w / 2 - 4} 0t${w / 2 - 4} 0" stroke-width="2"/></g>
    <rect x="${x + w / 2 - 12}" y="${272 + (i % 2) * 18}" width="22" height="46" fill="#3a2f4a"/><path d="M${x + 8} ${176 + (i % 2) * 18}q8 12 16 0" fill="none" stroke="#2f8a58" stroke-width="4"/></g>`).join('')}
  <g transform="translate(60 322)"><rect x="-2.5" y="-58" width="5" height="58" fill="#2a2e3c"/><path d="M-9 -58H9L6 -76H-6Z" fill="#ffe9a0" stroke="#2a2e3c" stroke-width="2.4"/><path d="M-8 -76H8L0 -86Z" fill="#2a2e3c"/><circle cx="0" cy="-66" r="14" fill="#ffd34d" opacity=".3"/></g>
  <path d="M0 340Q300 328 600 340V400H0Z" fill="#5d6fb8"/><path d="M40 358q14 -6 28 0t28 0M250 372q14 -6 28 0t28 0M330 346q14 -6 28 0t28 0" fill="none" stroke="#ffe0a0" stroke-width="3" opacity=".6" stroke-linecap="round"/>
  <g transform="translate(420 356)"><path d="M-80 0H80L66 20H-66Z" fill="#fffaf0"/><rect x="-62" y="-22" width="124" height="22" fill="#fffaf0"/><rect x="-50" y="-44" width="90" height="22" fill="#f4eee0"/><rect x="-36" y="-62" width="60" height="18" fill="#fffaf0"/><path d="M-62 -22H62M-50 -44H40" stroke="#d94a3d" stroke-width="3"/>${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${-54 + i * 20}" y="-17" width="10" height="9" fill="#7a9cc4"/>`).join('')}<rect x="-30" y="-100" width="9" height="40" fill="#2a2e3c"/><rect x="-6" y="-92" width="9" height="32" fill="#2a2e3c"/><rect x="-34" y="-104" width="17" height="6" fill="#2a2e3c"/><rect x="-10" y="-96" width="17" height="6" fill="#2a2e3c"/>
    <circle cx="-90" cy="-4" r="26" fill="#d94a3d" stroke="#8e2a22" stroke-width="3"/>${[0, 45, 90, 135].map((a) => `<path d="M-90 -4L${-90 + 26 * Math.cos((a * Math.PI) / 180)} ${-4 + 26 * Math.sin((a * Math.PI) / 180)}M-90 -4L${-90 - 26 * Math.cos((a * Math.PI) / 180)} ${-4 - 26 * Math.sin((a * Math.PI) / 180)}" stroke="#8e2a22" stroke-width="3"/>`).join('')}<circle cx="-90" cy="-4" r="5" fill="#8e2a22"/></g>
  <path d="M-10 108Q150 150 310 118T610 116" fill="none" stroke="#fff" stroke-width="2" opacity="0"/>
  ${gull(180, 150, 0.8)}`;

const sanantonio = (id) => `${sky(id, '#6ec6f2', '#fff0c8')}${sun(500, 210, 24)}${cloud(320, 96, 0.8)}${cloud(120, 186, 0.6)}
  <rect x="0" y="262" width="600" height="138" fill="#d9c08a"/>
  <g><path d="M70 300V176Q70 150 96 150H134Q150 140 168 120Q186 140 202 150H240Q266 150 266 176V300Z" fill="#f1e2bc"/><path d="M70 300V176Q70 150 96 150H134Q150 140 168 120Q186 140 202 150H240Q266 150 266 176V300Z" fill="none" stroke="#c9a76a" stroke-width="3"/><path d="M168 120V104" stroke="#c9a76a" stroke-width="3"/><path d="M162 104H174" stroke="#c9a76a" stroke-width="3" stroke-linecap="round"/>
    <path d="M136 300V232Q136 208 168 208Q200 208 200 232V300Z" fill="#5a3a30"/><path d="M146 300V236Q146 220 168 220Q190 220 190 236V300Z" fill="#7a5040"/><path d="M168 220V300" stroke="#5a3a30" stroke-width="3"/>
    <path d="M86 196Q86 176 98 176Q110 176 110 196V224H86Z" fill="#c9a76a"/><path d="M226 196Q226 176 238 176Q250 176 250 196V224H226Z" fill="#c9a76a"/><path d="M148 170Q148 156 156 156Q164 156 164 170ZM172 170Q172 156 180 156Q188 156 188 170Z" fill="#7a5040"/><circle cx="168" cy="180" r="8" fill="#e8d4a0" stroke="#c9a76a" stroke-width="2"/></g>
  <g><path d="M300 300V200L340 182L380 200V300Z" fill="#f4d9a0"/><path d="M290 300V280H400V300Z" fill="#e8c880"/><rect x="326" y="226" width="28" height="74" fill="#7a5040"/></g>
  <path d="M0 316Q300 304 600 316V400H0Z" fill="#7ab6d0"/><path d="M0 326Q150 316 300 326T600 322" fill="none" stroke="#fff" stroke-width="2.4" opacity=".6"/>
  <g transform="translate(300 316)"><path d="M-170 6Q-120 -52 -60 -52Q0 -64 60 -52Q120 -52 170 6V20H-170Z" fill="#c8b48a"/><path d="M-170 6Q-120 -52 -60 -52Q0 -64 60 -52Q120 -52 170 6" fill="none" stroke="#9a8760" stroke-width="3"/>${[-120, -40, 40, 120].map((x) => `<path d="M${x - 26} 20V4Q${x} -30 ${x + 26} 4V20Z" fill="#7ab6d0"/>`).join('')}${Array.from({ length: 12 }, (_, i) => `<path d="M${-150 + i * 27} -46v10" stroke="#9a8760" stroke-width="2" opacity=".6"/>`).join('')}</g>
  <path d="M0 360Q300 346 600 360V400H0Z" fill="#6aa8c4"/>
  <g transform="translate(150 372)"><path d="M-46 0H46L34 14H-34Z" fill="#ff7a3a"/><rect x="-34" y="-12" width="68" height="12" fill="#ffd34d"/><path d="M-40 -26H40L30 -12H-30Z" fill="#d94a3d"/><path d="M-40 -26H40" stroke="#fff" stroke-width="3" stroke-dasharray="6 5"/></g>
  <g transform="translate(470 372)"><path d="M-40 0H40L30 12H-30Z" fill="#2f9a8a"/><rect x="-26" y="-10" width="52" height="10" fill="#fffaf0"/><path d="M-34 -22H34L26 -10H-26Z" fill="#f2b138"/></g>
  <g>${[[40, 300], [560, 296]].map(([x, y]) => `<g><rect x="${x - 4}" y="${y - 74}" width="8" height="74" fill="#6b4a2a"/><path d="M${x} ${y - 74}q-24 -12 -30 6M${x} ${y - 74}q24 -12 30 6M${x} ${y - 78}q0 -22 0 -22" fill="none" stroke="#2f9a58" stroke-width="7" stroke-linecap="round"/><circle cx="${x}" cy="${y - 80}" r="14" fill="#3d8a48"/><circle cx="${x - 14}" cy="${y - 68}" r="12" fill="#2f7d4f"/><circle cx="${x + 14}" cy="${y - 68}" r="12" fill="#2f7d4f"/></g>`).join('')}</g>
  <g transform="translate(555 336)"><path d="M0 0V-34M0 -18Q-14 -18 -14 -34M0 -24Q14 -24 14 -40" fill="none" stroke="#2f9a58" stroke-width="7" stroke-linecap="round"/><circle cx="14" cy="-44" r="3.5" fill="#ff8aa8"/></g>
  <g>${[[250, 332, '#d94a3d'], [286, 336, '#f2b138'], [210, 338, '#2f9a8a']].map(([x, y, c]) => `<path d="M${x - 16} ${y - 14}Q${x} ${y - 28} ${x + 16} ${y - 14}Z" fill="${c}"/><path d="M${x} ${y - 20}V${y}" stroke="#6b4a2a" stroke-width="2.4"/>`).join('')}</g>${gull(400, 170)}`;

const stlouis = (id) => `${sky(id, '#78c8f2', '#fff1d0')}${sun(110, 200, 22)}${cloud(330, 100, 0.85)}${cloud(500, 182, 0.6)}
  <g fill="#8e9dbf" opacity=".85">${[[400, 236, 26, 64], [430, 218, 30, 82], [466, 242, 24, 58], [494, 226, 30, 74], [530, 246, 26, 54]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('')}<g><rect x="108" y="244" width="40" height="56"/><path d="M104 244Q128 206 152 244Z"/><rect x="124" y="226" width="8" height="12"/></g></g>
  <path d="M0 292Q150 272 300 290T600 280V400H0Z" fill="#7cc27a"/><path d="M0 330Q300 310 600 330V400H0Z" fill="#6bb86a"/>
  <path d="M0 352Q300 338 600 352V400H0Z" fill="#9b8a6a"/><path d="M0 362Q300 350 600 362V400H0Z" fill="#7fb2c8"/><path d="M20 376q16 -6 32 0t32 0M260 388q16 -6 32 0t32 0M470 374q16 -6 32 0t32 0" fill="none" stroke="#fff" stroke-width="2.4" opacity=".6" stroke-linecap="round"/>
  <g><path d="M196 330Q198 150 300 150Q402 150 404 330" fill="none" stroke="#c4ccd8" stroke-width="22" stroke-linecap="butt"/><path d="M196 330Q198 150 300 150Q402 150 404 330" fill="none" stroke="#eef2f8" stroke-width="12" stroke-linecap="butt"/><path d="M206 330Q208 168 300 162" fill="none" stroke="#fff" stroke-width="4" opacity=".9"/><path d="M196 330Q198 150 300 150Q402 150 404 330" fill="none" stroke="#9aa6b8" stroke-width="2" opacity=".6" stroke-dasharray="3 14"/></g>
  <path d="M170 330H430V338H170Z" fill="#d9d2c0"/>
  <g transform="translate(120 372) scale(.8)"><path d="M-40 0H40L30 12H-30Z" fill="#fffaf0"/><rect x="-30" y="-14" width="60" height="14" fill="#fffaf0"/><rect x="-20" y="-28" width="38" height="14" fill="#f4eee0"/><path d="M-30 -14H30" stroke="#d94a3d" stroke-width="3"/><rect x="8" y="-52" width="8" height="24" fill="#2a2e3c"/><circle cx="-46" cy="-2" r="16" fill="#d94a3d" stroke="#8e2a22" stroke-width="2.4"/></g>
  ${tree(520, 338, 60)}${tree(60, 336, 52)}${tree(560, 332, 44)}${gull(430, 190)}${gull(470, 170, 0.8)}`;

const chicago = (id) => `${sky(id, '#76c6f0', '#fff0cc')}${sun(90, 220, 22)}${cloud(330, 100, 0.8)}${cloud(120, 160, 0.55)}
  <g>${[[130, 190, 34, 118, '#6a7ba6'], [166, 160, 30, 148, '#5a6b96'], [198, 200, 38, 108, '#7a8bb4'], [440, 186, 40, 122, '#6a7ba6'], [484, 214, 34, 94, '#5a6b96'], [522, 196, 36, 112, '#7a8bb4']].map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h + 20}" fill="${c}"/>`).join('')}</g>
  <g><rect x="240" y="184" width="60" height="136" fill="#2f3a5a"/><rect x="250" y="160" width="40" height="28" fill="#2f3a5a"/><rect x="258" y="142" width="24" height="20" fill="#2f3a5a"/><path d="M264 142V118M276 142V124" stroke="#2f3a5a" stroke-width="4"/><path d="M262 122h6M274 128h6" stroke="#d94a3d" stroke-width="3"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((r) => [0, 1, 2].map((q) => `<rect x="${248 + q * 16}" y="${190 + r * 16}" width="8" height="10" fill="${(r + q) % 3 === 0 ? '#ffe9a0' : '#5b78b8'}" opacity=".9"/>`).join('')).join('')}</g>
  <g><rect x="318" y="190" width="48" height="130" fill="#4a5a82"/><rect x="326" y="168" width="32" height="26" fill="#4a5a82"/><rect x="334" y="148" width="16" height="22" fill="#4a5a82"/>${[0, 1, 2, 3, 4, 5, 6].map((r) => [0, 1].map((q) => `<rect x="${326 + q * 20}" y="${198 + r * 16}" width="10" height="9" fill="${(r + q) % 2 ? '#ffe9a0' : '#8fb0e8'}" opacity=".9"/>`).join('')).join('')}</g>
  <rect x="0" y="302" width="600" height="14" fill="#8a8f9c"/><g stroke="#5a5f6c" stroke-width="3"><path d="M0 302H600"/>${Array.from({ length: 14 }, (_, i) => `<path d="M${10 + i * 44} 302V316"/>`).join('')}</g>
  <g transform="translate(90 292)"><rect x="-46" y="-26" width="92" height="26" rx="6" fill="#f4f1e8"/><rect x="-46" y="-12" width="92" height="5" fill="#d94a3d"/>${[0, 1, 2, 3].map((i) => `<rect x="${-38 + i * 22}" y="-22" width="14" height="10" fill="#7a9cc4"/>`).join('')}</g>
  <path d="M0 316H600V342Q300 330 0 342Z" fill="#e8d9a8"/>${water(id, 340, '#62bfe8', '#2f86bf')}${ripples(340, 6)}
  <g transform="translate(150 372)"><path d="M-22 0H22L16 10H-16Z" fill="#d94a3d"/><path d="M0 -4V-40L18 -8Z" fill="#fff"/><path d="M-2 -4V-32L-16 -8Z" fill="#ffe6a0"/></g><g transform="translate(470 366) scale(.85)"><path d="M-22 0H22L16 10H-16Z" fill="#2f4a7a"/><path d="M0 -4V-40L18 -8Z" fill="#fff"/><path d="M-2 -4V-32L-16 -8Z" fill="#f2b138"/></g>
  <g transform="translate(520 334)"><ellipse cx="0" cy="2" rx="40" ry="7" fill="#000" opacity=".16"/><path d="M-38 0Q-38 -42 0 -42Q38 -42 38 0Z" fill="#dfe6ee"/><path d="M-38 0Q-38 -42 0 -42Q38 -42 38 0Z" fill="none" stroke="#aab6c8" stroke-width="2"/><path d="M-28 -8Q-26 -30 -6 -36" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".9"/><path d="M8 -34Q24 -30 28 -10" fill="none" stroke="#8fd3f4" stroke-width="4" opacity=".6" stroke-linecap="round"/></g>${gull(220, 170, 0.9)}`;

const denver = (id) => `${sky(id, '#6cc2f4', '#fff2d6')}${sun(110, 214, 22)}${cloud(330, 100, 0.8)}${cloud(500, 170, 0.6)}
  ${snowPeak(170, 292, 260, 168, '#9fb3d6', '#7f96bf')}${snowPeak(330, 292, 300, 188, '#8fa6cf', '#6f88b4')}${snowPeak(500, 292, 240, 138, '#a9bbdc', '#8aa0c8')}${snowPeak(60, 292, 160, 100, '#b3c3e0', '#93a8cf')}
  <path d="M0 292Q100 262 200 284T400 276T600 282V400H0Z" fill="#6bb86a"/>${[40, 90, 150, 220, 360, 430, 500, 560].map((x, i) => pine(x, 294 + (i % 3) * 8, 42 + (i % 4) * 8)).join('')}
  <g transform="translate(300 300)"><g fill="#a9b4cc">${[[0, 40, 20, 18], [26, 24, 18, 34], [48, 34, 22, 24], [74, 18, 16, 40], [96, 38, 22, 20]].map(([x, y, w, h]) => `<rect x="${x - 50}" y="${-h}" width="${w}" height="${h}"/>`).join('')}</g><g fill="#e8f0ff" opacity=".85">${[[-44, -12], [-18, -22], [-4, -16], [24, -28], [46, -14]].map(([x, y]) => `<rect x="${x}" y="${y}" width="5" height="6"/>`).join('')}</g></g>
  <path d="M0 330Q300 314 600 330V400H0Z" fill="#c9a574"/><path d="M0 356Q300 342 600 356V400H0Z" fill="#b8925f"/>
  <g transform="translate(470 360)"><path d="M-60 0V-60L-40 -90L-24 -70L-4 -104L16 -76L40 -96L62 -56V0Z" fill="#d9603c"/><path d="M-4 -104L16 -76L40 -96L62 -56V0H20L26 -60L10 -76Z" fill="#b8472a"/><path d="M-60 -60L-40 -90L-24 -70V0H-60Z" fill="#e87a4c"/><path d="M-40 -30H50M-50 -14H56" stroke="#b8472a" stroke-width="2" opacity=".6"/><path d="M-38 0Q0 -22 38 0Z" fill="#a8b4c8"/></g>
  ${pine(40, 360, 70)}${pine(76, 372, 52)}${pine(560, 372, 60)}${gull(380, 176)}${gull(420, 156, 0.8)}`;

const seattle = (id) => `${sky(id, '#9ed4ee', '#f6efe0')}${sun(120, 210, 20, '#fff2b8')}${cloud(330, 96, 1)}${cloud(150, 172, 0.7)}${cloud(480, 170, 0.8, 0.85)}
  ${snowPeak(420, 280, 360, 150, '#97add2', '#7790bc')}${snowPeak(300, 280, 200, 90, '#a9bbdc', '#8aa0c8')}
  <path d="M0 270Q120 248 240 266T480 262T600 268V400H0Z" fill="#4f9a66"/>${[30, 60, 90, 440, 480, 520, 560].map((x, i) => pine(x, 276 + (i % 3) * 6, 46 + (i % 4) * 8, '#2f7d4f', '#256a42')).join('')}
  <g fill="#7f90b4" opacity=".9">${[[330, 238, 22, 46], [356, 220, 26, 64], [386, 246, 20, 38], [408, 232, 24, 52]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('')}</g>
  ${water(id, 290, '#5fb8e6', '#2f86bf')}${ripples(290, 7)}
  <g transform="translate(250 296) scale(.86)"><path d="M-5 0L-2 -120H2L5 0Z" fill="#d8dfe8"/><path d="M-24 -126Q0 -152 24 -126Q0 -112 -24 -126Z" fill="#f4f6fa"/><path d="M-30 -130H30L26 -138H-26Z" fill="#c4ccd8"/><path d="M-24 -126Q0 -112 24 -126" fill="none" stroke="#9aa6b8" stroke-width="2"/><path d="M0 -138V-168" stroke="#8a8f98" stroke-width="3"/><circle cx="0" cy="-170" r="3.6" fill="#d94a3d"/><path d="M-14 -126q14 8 28 0" fill="none" stroke="#8fd3f4" stroke-width="4" stroke-linecap="round"/><path d="M-16 -4L-4 -60M16 -4L4 -60" stroke="#c4ccd8" stroke-width="3"/></g>
  <path d="M0 316H600V400H0Z" fill="#4a9bd0" opacity="0"/>
  <g transform="translate(450 352)"><path d="M-70 0H70L56 20H-56Z" fill="#2f7d6a"/><rect x="-56" y="-18" width="112" height="18" fill="#fffaf0"/><rect x="-40" y="-36" width="80" height="18" fill="#f4eee0"/><rect x="-14" y="-52" width="12" height="16" fill="#2f7d6a"/><path d="M-56 -18H56" stroke="#2f7d6a" stroke-width="3"/>${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${-50 + i * 15}" y="-14" width="8" height="8" fill="#7a9cc4"/>`).join('')}</g>
  <path d="M0 340Q300 326 600 340V400H0Z" fill="#3c8fc4" opacity=".75"/>${ripples(344, 6, '#fff', 0.5)}
  <g transform="translate(110 372)"><path d="M-22 0H22L16 10H-16Z" fill="#d94a3d"/><path d="M0 -4V-40L18 -8Z" fill="#fff"/><path d="M-2 -4V-32L-16 -8Z" fill="#ffe6a0"/></g>${gull(210, 200, 0.9)}${gull(560, 190, 0.8)}`;

const sanfrancisco = (id) => `${sky(id, '#86cdf0', '#fff0d4')}${sun(120, 208, 20, '#fff2b8')}<g fill="#fff" opacity=".8"><ellipse cx="300" cy="256" rx="170" ry="12"/><ellipse cx="460" cy="276" rx="150" ry="10"/><ellipse cx="120" cy="270" rx="110" ry="9"/></g>${cloud(330, 98, 0.8)}
  ${water(id, 276, '#5fb8e6', '#2f86bf')}<path d="M0 276Q60 250 150 262T260 276Z" fill="#8bb86a"/><path d="M420 276Q500 238 600 252V276Z" fill="#9ac46e"/><path d="M0 276Q60 250 150 262T260 276" fill="none" stroke="#6b9a52" stroke-width="3"/>
  <g stroke="#e0502a" stroke-linecap="round"><path d="M150 290V160M450 290V160" stroke-width="12"/><path d="M146 200H154M146 240H154M446 200H454M446 240H454" stroke-width="6"/><path d="M142 164H158M442 164H458" stroke-width="8"/><path d="M0 214Q60 214 150 164Q300 280 450 164Q540 214 600 214" fill="none" stroke-width="5"/><path d="M0 286H600" stroke-width="9"/><path d="M0 292H600" stroke="#b83c1c" stroke-width="3"/>${Array.from({ length: 26 }, (_, i) => { const x = 160 + i * 11.2, t = (x - 150) / 300; return `<path d="M${x} ${(164 + 232 * t * (1 - t)).toFixed(1)}V284" stroke-width="1.6" opacity=".8"/>`; }).join('')}</g>
  <g fill="#e8854a" opacity=".5"><ellipse cx="300" cy="268" rx="80" ry="7"/></g>
  <path d="M0 312Q100 290 220 310T420 300T600 306V400H0Z" fill="#7cc27a"/><path d="M0 340Q200 316 600 350V400H0Z" fill="#6bb86a"/>
  <g>${[[300, '#f2b6d0', 64], [364, '#ffe08a', 56], [420, '#8fd0e8', 60], [480, '#f29a7a', 58], [538, '#b9a4e8', 62]].map(([x, c, w], i) => `<g transform="translate(0 ${i * -3})"><rect x="${x}" y="${298 - i * 4}" width="${w - 4}" height="${70}" fill="${c}"/><path d="M${x - 3} ${298 - i * 4}L${x + (w - 4) / 2} ${272 - i * 4}L${x + w - 1} ${298 - i * 4}Z" fill="#fff" opacity=".9"/><path d="M${x - 3} ${298 - i * 4}L${x + (w - 4) / 2} ${272 - i * 4}L${x + w - 1} ${298 - i * 4}Z" fill="none" stroke="#fff" stroke-width="3"/>${win(x + 8, 308 - i * 4, 14, 20, '#5b78b8')}${win(x + w - 26, 308 - i * 4, 14, 20, '#5b78b8')}${win(x + w / 2 - 9, 336 - i * 4, 14, 22, '#7a5040')}<rect x="${x + (w - 4) / 2 - 8}" y="${286 - i * 4}" width="16" height="12" fill="#fff" opacity=".85"/></g>`).join('')}</g>
  <g transform="translate(130 352) rotate(-9)"><rect x="-46" y="-32" width="92" height="32" rx="6" fill="#d94a3d"/><rect x="-46" y="-12" width="92" height="12" fill="#fffaf0"/><rect x="-40" y="-28" width="80" height="14" rx="3" fill="#fff6d8"/>${[0, 1, 2, 3].map((i) => `<rect x="${-36 + i * 20}" y="-26" width="14" height="12" fill="#7a9cc4"/>`).join('')}<path d="M-36 -34V-44H36V-34" fill="none" stroke="#2a2e3c" stroke-width="3"/><circle cx="-26" cy="4" r="7" fill="#2a2e3c"/><circle cx="26" cy="4" r="7" fill="#2a2e3c"/></g>
  <path d="M-10 372Q150 350 300 344" stroke="#6b6f7a" stroke-width="5" fill="none" opacity=".6"/>
  ${gull(230, 196)}${gull(380, 178, 0.8)}`;

export const SCENES = { rochester, buffalo, niagara, syracuse, albany, cooperstown, corning, lakeplacid, saratoga, ithaca, nyc, generic,
  boston, philadelphia, washington, capecanaveral, neworleans, sanantonio, stlouis, chicago, denver, seattle, sanfrancisco };
export const USA_KEYS = new Set(['boston', 'philadelphia', 'washington', 'capecanaveral', 'neworleans', 'sanantonio', 'stlouis', 'chicago', 'denver', 'seattle', 'sanfrancisco']);
export const SCENE_ACCENT = { rochester: '#3d93c8', buffalo: '#d94a3d', niagara: '#2f86bf', syracuse: '#f2b138', albany: '#56657f', cooperstown: '#2f7d4f', corning: '#a97be8', lakeplacid: '#6d84a8', saratoga: '#7a4a24', ithaca: '#4fa456', nyc: '#7a63d0', generic: '#ff6f59',
  boston: '#b8553f', philadelphia: '#d6a042', washington: '#e88aa8', capecanaveral: '#ff7a3a', neworleans: '#8a4ad0', sanantonio: '#2f9a8a', stlouis: '#7d8fb5', chicago: '#2f3a5a', denver: '#d9603c', seattle: '#2f7d6a', sanfrancisco: '#e0502a' };

/** Which scene for a city { id, name, scene }: an explicit `scene` key wins, then the id/name. */
export function sceneKey(city = {}) {
  // an explicit `scene` key wins; anything else in `scene` (the content's prose line for the artist) is ignored, the id and name decide
  if (city.scene && SCENES[String(city.scene).toLowerCase()]) return String(city.scene).toLowerCase();
  const t = `${city.id || ''} ${city.name || ''}`.toLowerCase();
  // USA Tour cities first: each has its own key (checked before the NY patterns so nothing there can claim them)
  if (/boston/.test(t)) return 'boston';
  if (/philadelphia|philly/.test(t)) return 'philadelphia';
  if (/washington/.test(t)) return 'washington';
  if (/canaveral|cape.?kennedy/.test(t)) return 'capecanaveral';
  if (/new.?orleans|nola/.test(t)) return 'neworleans';
  if (/san.?antonio/.test(t)) return 'sanantonio';
  if (/(st|saint)[\s.\-]*louis/.test(t)) return 'stlouis';
  if (/chicago/.test(t)) return 'chicago';
  if (/denver/.test(t)) return 'denver';
  if (/seattle/.test(t)) return 'seattle';
  if (/san.?francisco/.test(t)) return 'sanfrancisco';
  if (/niagara/.test(t)) return 'niagara';
  if (/rochester/.test(t)) return 'rochester';
  if (/buffalo/.test(t)) return 'buffalo';
  if (/syracuse/.test(t)) return 'syracuse';
  if (/albany|capitol/.test(t)) return 'albany';
  if (/cooperstown|baseball/.test(t)) return 'cooperstown';
  if (/corning|glass/.test(t)) return 'corning';
  if (/placid|ski|adirondack/.test(t)) return 'lakeplacid';
  if (/saratoga|race/.test(t)) return 'saratoga';
  if (/ithaca|gorge/.test(t)) return 'ithaca';
  if (/new.?york|nyc|manhattan|liberty|skyline/.test(t)) return 'nyc';
  return 'generic';
}

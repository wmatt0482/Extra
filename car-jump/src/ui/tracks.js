// Track select: 5 cards with a procedural mini-landscape, finish distance, best distance, lock state.
import { TRACKS, TRACK_BY_ID } from '../data/tracks.js';
import { isUnlocked } from '../meta/economy.js';
import { $, h, money } from './dom.js';
import { icon } from './icons.js';

export function trackArt(t) {
  const th = t.theme;
  const id = 'g' + t.id;
  // 160×130 artboard: ramp on the left, finish flag on the right; "xMidYMax slice" keeps the ground
  const hills = Array.from({ length: 9 }, (_, i) => `${i * 20} ${66 - Math.abs(Math.sin(i * 1.9 + t.finish)) * 16}`).join(' L');
  const stars = t.id === 'moon' ? Array.from({ length: 16 }, (_, i) => `<circle cx="${(i * 41) % 160}" cy="${8 + ((i * 23) % 50)}" r="${i % 3 ? 0.9 : 1.5}" fill="#fff" opacity=".85"/>`).join('') : '';
  const sun = t.id === 'moon' ? `<circle cx="124" cy="28" r="12" fill="#3b82f6"/><path d="M118 22a12 12 0 0 0 14 16" fill="#2fa36b"/>` : `<circle cx="124" cy="30" r="13" fill="#fff" opacity=".55"/>`;
  return `<svg viewBox="0 0 160 130" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${th.sky[0]}"/><stop offset="1" stop-color="${th.sky[1]}"/></linearGradient></defs>
    <rect width="160" height="130" fill="url(#${id})"/>${stars}${sun}
    <path d="M0 80 L${hills} L170 80 L170 130 L0 130Z" fill="${th.far}"/>
    <path d="M0 96 C30 90 60 100 90 94 S140 88 160 92 L160 130 L0 130Z" fill="${th.mid}"/>
    <path d="M-4 34 C 18 34 40 80 60 104 L 66 100 L 66 130 L -4 130 Z" fill="${th.groundDark}"/>
    <path d="M-4 34 C 18 34 40 80 60 104 L 66 100" fill="none" stroke="${th.accent}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M84 130 L84 116 C110 110 135 116 160 110 L160 130Z" fill="${th.ground}"/>
    <g transform="translate(136 90)"><rect x="0" y="0" width="2.5" height="24" fill="#fff"/><path d="M2.5 0h13v9h-13z" fill="#111"/><path d="M2.5 0h4.3v4.5H2.5zM11.2 0h4.3v4.5h-4.3zM6.8 4.5h4.4V9H6.8z" fill="#fff"/></g>
    <g transform="translate(76 66) rotate(-14)"><rect x="-9" y="-4" width="18" height="6" rx="2" fill="${th.accent}" stroke="#0d1230" stroke-width="1.4"/><circle cx="-5.5" cy="2.5" r="2.6" fill="#0d1230"/><circle cx="5.5" cy="2.5" r="2.6" fill="#0d1230"/></g>
  </svg>`;
}

export function createTracks(app) {
  const grid = $('#track-grid');

  function render() {
    const s = app.save;
    grid.innerHTML = '';
    TRACKS.forEach((t, i) => {
      const unlocked = isUnlocked(s, t.id);
      const best = s.best[t.id] || 0;
      const cleared = best >= t.finish || TRACKS.some((x) => x.unlockedBy === t.id && isUnlocked(s, x.id));
      const card = h('button', { class: 'card track-card' + (unlocked ? '' : ' locked'), 'data-track': t.id, 'aria-label': `${t.name}${unlocked ? '' : ' (locked)'}` },
        h('div', { class: 'track-art', html: trackArt(t) + (unlocked ? '' : `<div class="lock">${icon('lock')}<span>Finish ${TRACK_BY_ID[t.unlockedBy].name}</span></div>`) }),
        h('div', { class: 'track-info' },
          h('div', { class: 'track-num' }, `Stage ${String(i + 1).padStart(2, '0')}`),
          h('div', { class: 'track-name' }, t.name),
          h('div', { class: 'track-stat' }, h('span', {}, 'Finish'), h('b', {}, `${money(t.finish)} m`)),
          h('div', { class: 'track-stat' }, h('span', {}, 'Best'), h('b', {}, best ? `${money(best)} m` : '—')),
          h('div', { class: 'track-bar' }, h('i', { style: { width: Math.min(100, (best / t.finish) * 100) + '%' } }))),
        cleared ? h('span', { class: 'cleared' }, 'Cleared') : null);
      card.addEventListener('click', () => {
        if (!unlocked) { app.audio.error(); app.toast(`Locked: finish ${TRACK_BY_ID[t.unlockedBy].name} first`); return; }
        s.selectedTrack = t.id;
        app.persist();
        app.startRun({ trackId: t.id });
      });
      grid.append(card);
    });
    app.refreshCash();
  }
  return { show: render, hide() {}, render };
}

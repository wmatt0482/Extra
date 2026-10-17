// Trail select: one card per trail (6) with a procedural mini-landscape per style, the length, the best distance and
// the lock state (finish a trail to unlock the next). Opening the screen scrolls the trail being worked on into view.
import { isFinished, isUnlocked } from '../meta/economy.js';
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { icon } from './tbIcons.js';

const FALLBACK_THEME = { sky: ['#7cc4e8', '#d8f0e0'], far: '#5f8f7a', mid: '#2f6b44', ground: '#6b4a2b', groundDark: '#3f2a17', accent: '#ff8a1f' };

// 160×130 artboard: the far ridge, the trail's own scenery (style), a dirt trail and a finish flag
export function trailArt(t, i = 0) {
  const th = { ...FALLBACK_THEME, ...(t.theme || {}) };
  const sky = Array.isArray(th.sky) && th.sky.length >= 2 ? th.sky : FALLBACK_THEME.sky;
  const id = 'tg' + String(t.id).replace(/[^a-z0-9]/gi, '') + i;
  const style = t.style || 'forest';
  const night = style === 'night' || th.night;
  const ridge = Array.from({ length: 9 }, (_, k) => `${k * 20} ${62 - Math.abs(Math.sin(k * 1.7 + i)) * 18}`).join(' L');
  const pines = (xs, y, s, c) => xs.map((x) => `<path d="M${x} ${y} l${5 * s} -${16 * s} l${5 * s} ${16 * s} z" fill="${c}"/>`).join('');
  let scenery = '';
  if (style === 'forest') scenery = pines([8, 22, 36, 112, 126, 142], 98, 1.3, th.mid);
  else if (style === 'granite') scenery = `<path d="M10 98 q 18 -40 40 0 z M100 98 q 22 -52 50 0 z" fill="${th.far}"/><circle cx="70" cy="104" r="6" fill="${th.groundDark}"/>`;
  else if (style === 'lake') scenery = `<rect x="0" y="92" width="160" height="10" fill="#4fb0d8" opacity=".85"/><path d="M60 92 h40 v-4 h-40z" fill="#8a5a32"/>${pines([10, 24, 128, 142], 92, 1, th.mid)}`;
  else if (style === 'snow') scenery = `<path d="M20 70 l20 -26 l20 26 z M90 70 l26 -34 l26 34 z" fill="#ffffff" opacity=".9"/>${pines([12, 130], 98, 1.1, '#5e7d92')}`;
  else if (style === 'desert') scenery = `<path d="M100 80 h30 v18 h-30z" fill="${th.far}"/><path d="M28 98 v-18 m0 6 h-5 v-6 m5 4 h5 v-8" stroke="#3f8a4a" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
  else if (style === 'night') scenery = `${Array.from({ length: 14 }, (_, k) => `<circle cx="${(k * 37) % 160}" cy="${6 + ((k * 19) % 44)}" r="${k % 3 ? 0.9 : 1.5}" fill="#fff" opacity=".85"/>`).join('')}<circle cx="124" cy="26" r="9" fill="#f4ecc8"/>${pines([10, 26, 118, 134], 98, 1.2, '#0c1a14')}${[40, 70, 96].map((x, k) => `<circle cx="${x}" cy="${84 - k * 6}" r="1.6" fill="#fff59a"/>`).join('')}`;
  const sun = night ? '' : `<circle cx="126" cy="30" r="12" fill="#fff" opacity=".55"/>`;
  return `<svg viewBox="0 0 160 130" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>
    <rect width="160" height="130" fill="url(#${id})"/>${sun}
    <path d="M0 84 L${ridge} L170 84 L170 130 L0 130Z" fill="${th.far}" opacity=".85"/>
    ${scenery}
    <path d="M0 104 C30 96 60 106 90 100 S140 94 160 98 L160 130 L0 130Z" fill="${th.ground}"/>
    <path d="M0 118 C40 110 80 120 120 112 S150 110 160 112 L160 130 L0 130Z" fill="${th.groundDark}"/>
    <path d="M-4 114 C 40 104, 90 116, 164 104" fill="none" stroke="${th.accent}" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round" opacity=".9"/>
    <g transform="translate(138 80)"><rect x="0" y="0" width="2.5" height="22" fill="#fff"/><path d="M2.5 0h13v9h-13z" fill="#111"/><path d="M2.5 0h4.3v4.5H2.5zM11.2 0h4.3v4.5h-4.3zM6.8 4.5h4.4V9H6.8z" fill="#fff"/></g>
    <g transform="translate(56 103)"><rect x="-11" y="-9" width="22" height="7" rx="2" fill="#6d8a5a" stroke="#111" stroke-width="1.2"/><path d="M-6 -9 l1 -7 h9 l3 7" fill="none" stroke="#111" stroke-width="1.6"/><circle cx="-6.5" cy="-1" r="3.4" fill="#111"/><circle cx="6.5" cy="-1" r="3.4" fill="#111"/></g>
  </svg>`;
}

export function createTrails(app) {
  const grid = $('#trail-grid');
  function render() {
    const s = app.save;
    const trails = app.trails;
    grid.replaceChildren();
    let focus = null;
    trails.forEach((t, i) => {
      const unlocked = isUnlocked(s, trails, t.id);
      const done = isFinished(s, t.id);
      const best = s.best[t.id] || 0;
      const len = t.length || 600;
      const prev = trails[i - 1];
      const card = h('button', { class: 'card trail-card' + (unlocked ? '' : ' locked'), 'data-trail': t.id, 'data-sfx': '', 'aria-label': `${t.name}${unlocked ? '' : ' (locked)'}` },
        h('div', { class: 'trail-art', html: trailArt(t, i) + (unlocked ? '' : `<div class="lock">${icon('lock')}<span>Finish ${prev ? prev.name : ''}</span></div>`) }),
        h('div', { class: 'trail-info' },
          h('div', { class: 'trail-num' }, `Trail ${i + 1}`),
          h('div', { class: 'trail-name' }, t.name),
          h('div', { class: 'trail-stat' }, h('span', {}, 'Length'), h('b', {}, `${money(len)} m`)),
          h('div', { class: 'trail-stat' }, h('span', {}, 'Best'), h('b', {}, best ? `${money(best)} m` : '—')),
          h('div', { class: 'trail-bar' }, h('i', { style: { width: Math.min(100, (best / len) * 100) + '%' } }))),
        done ? h('span', { class: 'cleared' }, 'Finished') : null);
      card.addEventListener('click', () => {
        if (!unlocked) { app.audio.error(); app.toast(`Locked: finish ${prev ? prev.name : 'the trail before'} first`); return; }
        s.selectedTrail = t.id;
        app.persist();
        app.startRide(t.id);
      });
      grid.append(card);
      if (unlocked && !done && !focus) focus = card;
      if (unlocked && t.id === s.selectedTrail) focus = card;
    });
    app.refreshCash();
    if (focus) { try { focus.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) { /* older engines */ } }
  }
  return { show: render, hide() {}, render };
}

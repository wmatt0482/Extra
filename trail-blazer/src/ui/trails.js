// The Cups screen (SPEC v1.5 §2, §3, §8; was "Pick a track"): three tabs (Rookie / Pro / Legend), each with its cash
// multiplier, stars, trophy and "Race the cup" (a championship weekend: 3 races in a row, points 10 / 6 / 3 / 1), and a
// card per trail: a procedural mini-landscape per style, the length, the best time, the medal, its 3 stars and the
// lock state (3rd or better on a trail opens the next; a cup opens with BOTH a trophy from the previous cup's weekend
// and enough stars: "Pro Cup: a Rookie trophy + 12 ★").
// A weekend in progress shows a "Next race" strip on top. A cup's weekend opens once all its trails are open.
import { isCleared, isCupOpen, isUnlocked, starCount } from '../meta/economy.js';
import { CUPS, CUP_BY_ID, cupMult, cupOf, trailsOfCup } from '../data/cups.js';
import { starLabels, startWeekend, weekendNext } from '../meta/season.js';
import { MEDAL_LABEL, fmtTime, ordinal } from '../data/medals.js';
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
  else if (style === 'jungle') scenery = [14, 120].map((x) => `<path d="M${x + 6} 98 q2 -20 0 -34" stroke="#6b4a2b" stroke-width="3" fill="none"/><path d="M${x + 6} 64 q-14 -2 -18 8 M${x + 6} 64 q14 -2 18 8 M${x + 6} 64 q-6 -10 -14 -10 M${x + 6} 64 q6 -10 14 -10" stroke="${th.mid}" stroke-width="4" fill="none" stroke-linecap="round"/>`).join('');
  else if (style === 'canyon') scenery = `<path d="M8 98 v-30 h26 v30z M104 98 v-42 h36 v42z" fill="${th.mid}"/><path d="M8 68 h26 v4 h-26z M104 56 h36 v4 h-36z" fill="${th.far}"/>`;
  else if (style === 'beach') scenery = `<path d="M0 92 q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 v10 h-160z" fill="#3fb6e8"/><path d="M124 98 q2 -22 -4 -34" stroke="#8a5a32" stroke-width="3" fill="none"/><path d="M120 64 q-12 0 -16 8 M120 64 q12 0 16 8" stroke="#3aa36f" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  else if (style === 'volcano') scenery = `<path d="M40 98 l30 -50 h16 l30 50z" fill="${th.far}"/><path d="M70 48 h16 l-4 10 h-8z" fill="#ff7a2a"/><circle cx="78" cy="40" r="6" fill="#5a4a46" opacity=".8"/><circle cx="86" cy="30" r="8" fill="#5a4a46" opacity=".6"/>`;
  else if (style === 'swamp') scenery = `<rect x="0" y="94" width="160" height="8" fill="#4f6b3a"/>${[12, 22, 128, 140].map((x) => `<path d="M${x} 96 v-16" stroke="#7a8f3c" stroke-width="2.4"/><rect x="${x - 1.6}" y="78" width="3.2" height="7" rx="1.6" fill="#6b4a2b"/>`).join('')}`;
  else if (style === 'glacier') scenery = `<path d="M10 92 l18 -36 l18 36z M96 92 l26 -48 l26 48z" fill="#e8f6ff"/><path d="M28 56 l-6 12 h12z M122 44 l-8 16 h16z" fill="#a9d4f0"/>`;
  else if (style === 'neon') scenery = `${[[6, 40], [30, 56], [100, 34], [128, 50]].map(([x, y]) => `<rect x="${x}" y="${y}" width="22" height="${98 - y}" fill="#241a52"/><rect x="${x + 4}" y="${y + 6}" width="14" height="3" fill="#ff3cc7"/><rect x="${x + 4}" y="${y + 14}" width="14" height="3" fill="#22d3ff"/>`).join('')}`;
  else if (style === 'dino') scenery = `<path d="M100 98 v-14 q0 -14 14 -14 h10 l8 -6 v8 l-6 4 v22" fill="${th.far}" opacity=".8"/><path d="M24 98 q6 -10 12 0 M32 96 q6 -10 12 0" stroke="#f4ecc8" stroke-width="3" fill="none"/>`;
  else if (style === 'sky') scenery = `${[[20, 70], [70, 56], [124, 74]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="18" ry="7" fill="#fff" opacity=".9"/>`).join('')}`;
  else if (style === 'haunted') scenery = `<circle cx="124" cy="26" r="9" fill="#f4ecc8"/>${[30, 120].map((x) => `<circle cx="${x}" cy="96" r="5" fill="#ff8a1f"/><path d="M${x} 91 v-2" stroke="#3f8a4a" stroke-width="2"/>`).join('')}<path d="M70 40 q4 -4 8 0 q4 -4 8 0" stroke="#111" stroke-width="2" fill="none"/>`;
  else if (style === 'moon') scenery = `<circle cx="126" cy="28" r="10" fill="#2f8bd6"/><path d="M120 24 q4 -4 8 0 q2 6 -4 8z" fill="#3fb06a"/>${Array.from({ length: 12 }, (_, k) => `<circle cx="${(k * 41) % 160}" cy="${6 + ((k * 23) % 40)}" r="1" fill="#fff"/>`).join('')}<ellipse cx="40" cy="100" rx="12" ry="3" fill="${th.groundDark}"/>`;
  else if (style === 'rainbow') scenery = `${['#ff5d5d', '#ffe14a', '#3ddc84', '#22b8ff', '#8f6bff'].map((c, k) => `<path d="M${20 + k * 6} 98 a${60 - k * 6} ${50 - k * 6} 0 0 1 ${120 - k * 12} 0" stroke="${c}" stroke-width="5" fill="none" opacity=".85"/>`).join('')}`;
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
  const body = $('#cups-body');
  const tabsEl = $('#cup-tabs');
  let cupTab = null;

  function stars(arr, labels) {
    return h('span', { class: 'stars', 'aria-label': `${arr.filter(Boolean).length} of 3 stars` },
      ...[0, 1, 2].map((i) => h('i', { class: arr[i] ? 'on' : '', title: labels[i], html: icon('star') })));
  }
  function trailCard(t, i, trails) {
    const s = app.save;
    const unlocked = isUnlocked(s, trails, t.id);
    const done = isCleared(s, t.id);
    const bestTime = s.bestTime[t.id] || 0;
    const bestPlace = s.bestPlace[t.id] || 0;
    const medal = s.medals[t.id] || null;
    const prev = trails[i - 1];
    const cupLocked = !isCupOpen(s, cupOf(t, trails));
    const lockCup = CUP_BY_ID[cupOf(t, trails)];
    const why = cupLocked ? `${lockCup.name}: a ${CUPS[CUPS.indexOf(lockCup) - 1].short} trophy + ${lockCup.starsToOpen} ★` : `Top 3 on ${prev ? prev.name : ''}`;
    const num = trailsOfCup(cupOf(t, trails), trails).findIndex((x) => x.id === t.id) + 1;
    const card = h('button', { class: 'card trail-card' + (unlocked ? '' : ' locked'), 'data-trail': t.id, 'data-sfx': '', 'aria-label': `${t.name}${unlocked ? '' : ' (locked)'}` },
      h('div', { class: 'trail-art', html: trailArt(t, i) + (unlocked ? '' : `<div class="lock">${icon('lock')}<span>${why}</span></div>`) }),
      h('div', { class: 'trail-info' },
        h('div', { class: 'trail-num' }, `Trail ${num}`, stars(s.stars[t.id] || [], starLabels(t, trails))),
        h('div', { class: 'trail-name' }, t.name),
        h('div', { class: 'trail-stat' }, h('span', {}, 'Length'), h('b', {}, `${money(t.length || 600)} m`)),
        h('div', { class: 'trail-stat' }, h('span', {}, 'Best time'), h('b', { 'data-best-time': String(bestTime) }, bestTime ? fmtTime(bestTime) : '—'))),
      medal ? h('span', { class: `medal-badge m-${medal} t-medal`, 'data-medal': medal }, MEDAL_LABEL[medal]) : null,
      s.summits && s.summits[t.id] ? h('span', { class: 'summit-badge', title: 'Summit reached', 'aria-label': 'Summit reached', html: icon('flag') }) : null,   // v1.7
      done ? h('span', { class: 'cleared' }, bestPlace === 1 ? 'Won' : ordinal(bestPlace)) : null);
    card.addEventListener('click', () => {
      if (!unlocked) { app.audio.error(); app.toast(cupLocked ? why : `Locked: finish 3rd or better on ${prev ? prev.name : 'the trail before'}`); return; }
      s.selectedTrail = t.id;
      app.persist();
      app.startRide(t.id);
    });
    return { card, unlocked, done };
  }
  function cupStars(cupId, trails) {
    return trailsOfCup(cupId, trails).reduce((a, t) => a + (app.save.stars[t.id] || []).filter(Boolean).length, 0);
  }
  function renderTabs(trails) {
    const s = app.save;
    tabsEl.replaceChildren(...CUPS.map((c) => {
      const open = isCupOpen(s, c.id);
      const trophy = s.cups[c.id] && s.cups[c.id].trophy;
      const b = h('button', { class: `cup-tab${cupTab === c.id ? ' on' : ''}${open ? '' : ' locked'}`, role: 'tab', 'aria-selected': String(cupTab === c.id), 'data-cup': c.id, 'data-sfx': '', style: { '--cc': c.color } },
        h('b', {}, c.name), h('small', {}, open ? `${cupStars(c.id, trails)} / ${trailsOfCup(c.id, trails).length * 3} ★` : 'Locked'),
        trophy ? h('span', { class: `cup-trophy m-${trophy}`, html: icon('trophy'), 'aria-label': `${trophy} trophy` }) : open ? null : h('span', { class: 'cup-lock', html: icon('lock') }));
      b.addEventListener('click', () => { if (cupTab !== c.id) { cupTab = c.id; render(); } });
      return b;
    }));
  }
  function weekendStrip(trails) {
    const s = app.save;
    const next = weekendNext(s);
    if (!next) return null;
    const w = s.weekend;
    const t = trails.find((x) => x.id === next);
    const go = h('button', { class: 'btn btn-sm btn-orange', id: 'cup-continue', 'data-sfx': '' }, 'Next race', h('span', { html: icon('right') }));
    go.addEventListener('click', () => app.startRide(next, { weekend: true }));
    return h('div', { class: 'card wk-strip', 'data-weekend': w.cup },
      h('span', { class: 'wk-txt' }, h('b', {}, `${CUP_BY_ID[w.cup].name} weekend`), ` · race ${w.results.length + 1} of ${w.trails.length}${t ? ` · ${t.name}` : ''}`), go);
  }
  function render() {
    const s = app.save;
    const trails = app.trails;
    if (!cupTab) {
      const cur = trails.find((t) => t.id === s.selectedTrail && isUnlocked(s, trails, t.id));
      cupTab = s.weekend ? s.weekend.cup : cur ? cupOf(cur, trails) : [...CUPS].reverse().find((c) => isCupOpen(s, c.id)).id;
    }
    renderTabs(trails);
    const cup = CUP_BY_ID[cupTab];
    const open = isCupOpen(s, cup.id);
    const list = trailsOfCup(cup.id, trails);
    const rec = s.cups[cup.id];
    // a weekend needs every trail of the cup open (it runs the cup's last 3: a trophy means the whole cup is mastered)
    const openN = list.filter((t) => isUnlocked(s, trails, t.id)).length;
    const ready = open && openN === list.length && !s.weekend;
    const raceCup = h('button', { class: 'btn btn-sm ' + (ready ? 'btn-orange' : 'btn-poor'), id: 'cup-race', 'data-sfx': '', 'data-ready': String(ready), 'aria-disabled': String(!ready) },
      h('span', { html: icon('trophy') }), ready || !open || s.weekend ? 'Race the cup' : `Race the cup · ${openN} / ${list.length} open`);
    raceCup.addEventListener('click', () => {
      if (s.weekend) { app.toast('Finish the weekend first: Next race'); return; }
      if (!ready) { app.audio.error(); app.toast(`Open every ${cup.short} trail first (${openN} / ${list.length})`); return; }
      const w = startWeekend(s, cup.id, trails, list.slice(-3).map((t) => t.id));
      if (!w) { app.audio.error(); return; }
      app.persist();
      app.startRide(w.trails[0], { weekend: true });
    });
    const idx = CUPS.findIndex((c) => c.id === cup.id);
    const prevCup = CUPS[idx - 1];
    const head = h('div', { class: 'cup-head', 'data-cup': cup.id, style: { '--cc': cup.color } },
      h('div', { class: 'ch-txt' },
        h('b', {}, cup.name), h('span', { class: 'ch-mult', 'data-mult': String(cupMult(cup.id)) }, cupMult(cup.id) > 1 ? `×${cupMult(cup.id)} cash` : '×1 cash'),
        h('span', {}, `${cupStars(cup.id, trails)} / ${list.length * 3} ★`),
        rec && rec.trophy ? h('span', { class: `medal-badge m-${rec.trophy}` }, `${rec.trophy} trophy`) : null),
      open ? raceCup : h('span', { class: 'ch-lock', 'data-need': `${prevCup.id}-trophy+${cup.starsToOpen}` }, h('span', { html: icon('lock') }),
        `${cup.name}: a ${prevCup.short} trophy + ${cup.starsToOpen} ★`,
        h('small', {}, ` · trophy ${s.cups[prevCup.id] && s.cups[prevCup.id].trophy ? '✓' : '—'} · ${Math.min(starCount(s), cup.starsToOpen)} / ${cup.starsToOpen} ★`)));
    const grid = h('div', { class: 'trail-grid', id: 'trail-grid' });
    let focus = null;
    for (const t of list) {
      const i = trails.indexOf(t);
      const { card, unlocked, done } = trailCard(t, i, trails);
      grid.append(card);
      if (unlocked && !done && !focus) focus = card;
      if (unlocked && t.id === s.selectedTrail) focus = card;
    }
    body.replaceChildren(...[weekendStrip(trails), head, grid].filter(Boolean));
    app.refreshCash();
    if (focus) { try { focus.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) { /* older engines */ } }
  }
  return { show() { cupTab = null; render(); }, hide() {}, render };
}

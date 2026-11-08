// The Lab chip and the Games button (lab/docs/COHESION.md): one identical component every game shows in the same corner, top-left of its home or
// title screen. The child's Lab avatar (the same render as the Lab room), "Lab LV n", the Lab coin balance with the Lab coin icon and the Lab streak
// flame. Tap the chip: The Lab opens. Tap the grid button: the Games panel (ui/games.js). It follows the store (reports, syncs, attaches).
// Colours are CSS variables (--labchip-*) so it sits on dark and light game themes; opts.theme picks a preset, a game may also set the variables.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { lab } from '../index.js';
import { xpBar } from '../core/xp.js';
import { totalXp } from '../core/model.js';
import { drawPortrait } from './avatar.js';
import { LAB_COIN, glyph } from './glyph.js';
import { num } from './util.js';

const nf = (n) => num(n);

/** opts = { game, current, compact, theme: 'dark' | 'light', fixed, onOpen }. host null (or opts.fixed) = a fixed element in the top-left corner. */
export function mountChip(host, store, o = {}) {
  if (typeof document === 'undefined') return { el: null, update() {}, destroy() {} };
  const fixed = !host || !!o.fixed;
  const cv = h('canvas', { class: 'lab-chipx-cv', width: 72, height: 72, 'aria-hidden': 'true' });
  const lvEl = h('span', { class: 'lab-chipx-lv' });
  const barFill = h('i');
  const coinsEl = h('b', { class: 'lab-chipx-coins' });
  const flameN = h('b', { class: 'lab-chipx-flamen' });
  const flameEl = h('span', { class: 'lab-chipx-flame', 'aria-hidden': 'true' }, h('span', { html: glyph('flame') }), flameN);
  const stack = h('span', { class: 'lab-chipx-stack' },
    lvEl,
    h('span', { class: 'lab-chipx-bar', 'aria-hidden': 'true' }, barFill),
    h('span', { class: 'lab-chipx-row' }, h('span', { class: 'lab-chipx-coin', 'aria-hidden': 'true', html: LAB_COIN }), coinsEl, flameEl));
  const main = h('button', { class: 'lab-chipx-main', type: 'button', id: 'lab-chip-main', 'aria-label': 'The Lab' }, cv, stack);
  const gamesBtn = h('button', { class: 'lab-chipx-games', type: 'button', id: 'lab-chip-games', 'aria-label': 'Games', title: 'Games' }, h('span', { html: glyph('grid') }), h('span', { class: 'lab-chipx-games-tx' }, 'Games'));
  const root = h('div', { class: 'lab-root lab-chipx' + (o.compact ? ' compact' : '') + (fixed ? ' fixed' : ''), 'data-theme': o.theme === 'light' ? 'light' : 'dark', 'data-lab-chip': '' }, main, gamesBtn);

  main.addEventListener('click', (e) => { e.stopPropagation(); if (o.onOpen) o.onOpen(); else lab.openHome(o.game ? { game: o.game } : {}); });
  gamesBtn.addEventListener('click', (e) => { e.stopPropagation(); lab.openGames({ current: o.current, game: o.game }); });
  // a chip never lets a tap through to the game behind it
  for (const ev of ['pointerdown', 'pointerup', 'mousedown', 'touchstart']) root.addEventListener(ev, (e) => e.stopPropagation());

  let dead = false, raf = 0;
  const update = () => {
    raf = 0;
    if (dead) return;
    const v = store.view(o.game);
    main.hidden = !v;
    if (!v) return;
    const bar = xpBar(totalXp(store.doc()));
    lvEl.textContent = bar.name;
    barFill.style.width = `${bar.pct}%`;
    coinsEl.textContent = nf(v.coins);
    const st = v.streak;
    flameEl.classList.toggle('on', st.count > 0);
    flameN.textContent = String(st.count);
    const slots = {}; for (const [k, s] of Object.entries(v.avatar.slots)) slots[k] = s.id;
    drawPortrait(cv, { color: v.player.color || '#3b7dd9', slots, mood: 'content' });
    main.setAttribute('aria-label', `The Lab. ${v.player.name ? v.player.name + '. ' : ''}${bar.name}. ${nf(v.coins)} Lab coins. ${st.count > 0 ? `${st.count} day streak.` : 'No streak yet.'}`);
  };
  const soon = () => { if (!raf && !dead) raf = requestAnimationFrame(update); };
  const off = store.subscribe(soon);
  const onShow = () => soon();
  window.addEventListener('pageshow', onShow);
  (host || document.body).appendChild(root);
  update();
  setTimeout(update, 60);              // the portrait needs the chip's laid-out size
  return {
    el: root, update,
    destroy() { dead = true; off(); cancelAnimationFrame(raf); window.removeEventListener('pageshow', onShow); root.remove(); },
  };
}

/** The "The Lab" button for a game's "Who's playing?" screen, styled like the family's player buttons. Opens the family view of the Lab
 *  when a player is picked, else the Lab page. */
export function mountPickerButton(host, store, o = {}) {
  if (typeof document === 'undefined') return { el: null, update() {}, destroy() {} };
  const b = h('button', { class: 'lab-root lab-pickbtn', type: 'button', id: 'lab-picker-btn', 'data-lab-picker': '', 'aria-label': 'The Lab. Your avatar, pet, quests and shop.' },
    h('span', { class: 'lab-pickbtn-ic', 'aria-hidden': 'true', html: glyph('flask') }),
    h('span', { class: 'lab-pickbtn-tx' }, h('b', {}, 'The Lab'), h('small', {}, 'Avatar, pet, quests, shop')));
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (o.onOpen) { o.onOpen(); return; }
    if (store.player) lab.openHome({ view: 'family', ...(o.game ? { game: o.game } : {}) });
    else { try { location.assign('/lab/'); } catch (_) { /* ignore */ } }
  });
  (host || document.body).appendChild(b);
  return { el: b, update() {}, destroy() { b.remove(); } };
}

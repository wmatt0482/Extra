// The shared shell (lab/SPEC.md §5): the top bar (avatar chip, level and "40 XP to level 8", the coin purse, the streak flame and its freezes),
// the view in the middle, and the row of big buttons at the bottom. The Lab page and the overlay inside a game are this same code.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { sfx, reducedMotion, num } from './util.js';
import { drawPortrait } from './avatar.js';
import { COIN, glyph } from './glyph.js';
import { sharedVoice } from './voice.js';
import { LAB_LINES, collectVoiceTexts } from '../core/view.js';
import { ITEM_BY_ID } from '../data/catalog.js';
import { mountHome } from './home.js';
import { mountQuests } from './quests.js';
import { mountCrate } from './crate.js';
import { mountShop } from './shop.js';
import { mountMe } from './me.js';
import { mountFamily } from './board.js';
import { mountGallery } from './gallery.js';
import { mountParent } from './parent.js';
import { showLevelUp } from './levelup.js';

export const TABS = [['quests', 'Quests'], ['crate', 'Crate'], ['shop', 'Shop'], ['family', 'Family'], ['gallery', 'Gallery'], ['me', 'Me'], ['parent', 'Grown-ups']];
const MOUNTS = { home: mountHome, quests: mountQuests, crate: mountCrate, shop: mountShop, me: mountMe, family: mountFamily, gallery: mountGallery, parent: mountParent };
const TITLES = { home: 'The Lab', quests: 'Quests', crate: 'Lab crate', shop: 'Shop', me: 'Me', family: 'Family', gallery: 'Gallery', parent: 'Grown-ups' };
export { sfx, reducedMotion };

/** Ask for the clips of what the Lab says, in the order a child needs them (only when a natural voice is in use): the fixed lines, today's quests,
 *  the names of what they own, the level lines, then everything else (item names, every quest, titles). */
export function prepareVoice(store, voice) {
  try {
    const v = store.view();
    if (!v || !voice.cloud.active) return;
    const fixed = Object.values(LAB_LINES).filter((t) => typeof t === 'string');
    const owned = v.owned.map((id) => ITEM_BY_ID[id]).filter(Boolean).flatMap((i) => [i.name, LAB_LINES.gotItem(i.name)]);
    const levels = Array.from({ length: 99 }, (_, i) => LAB_LINES.levelUp(i + 2, v.level.title));
    voice.prepare([...fixed, ...v.quests.map((q) => q.text), ...owned, ...[2, 3, 4, 5].map((n) => LAB_LINES.levelUp(n, 'Cadet')), ...collectVoiceTexts(), ...levels]);
  } catch (_) { /* the voice is a nicety */ }
}

/** o = { mode: 'page'|'overlay', view, game, unlocked, onClose, onExit, sync }. Returns { el, go(view), destroy(), get view }. */
export function createApp(store, o = {}) {
  const mode = o.mode || 'page';
  const voice = sharedVoice();
  voice.setPlayer(store.player ? store.player.id : '');
  setTimeout(() => prepareVoice(store, voice), 400);
  let view = '', cur = null, raf = 0, dead = false, toastTimer = 0, seenLevel = 0, seenPlayer = '';
  const ctx = {
    store, voice, mode, game: o.game || 'sj', sync: o.sync || null, unlocked: !!o.unlocked, reduced: reducedMotion(),
    go: (v, params) => go(v, params), toast, sfx, num,
    say: (t) => voice.say(t), later: (t) => voice.later(t),
    close: () => (o.onClose ? o.onClose() : null),
    get view() { return view; },
  };
  const top = h('header', { class: 'lab-top' });
  const main = h('main', { class: 'lab-main', id: 'lab-main', tabindex: '-1' });
  const nav = h('nav', { class: 'lab-nav', 'aria-label': 'The Lab' });
  const toastEl = h('div', { class: 'lab-toast', role: 'status', 'aria-live': 'polite', hidden: true });
  const el = h('div', { class: 'lab-shell' }, top, main, nav, toastEl);

  // ---- the bottom row of big buttons
  const tabBtns = {};
  for (const [id, label] of TABS) {
    const b = h('button', { class: 'lab-tab', type: 'button', 'data-view': id, 'aria-label': label }, h('span', { class: 'lab-tab-ic', html: glyph(id === 'parent' ? 'grownups' : id) }), h('span', { class: 'lab-tab-tx' }, label), h('i', { class: 'lab-dot', hidden: true }));
    b.addEventListener('click', () => { sfx('click'); go(view === id ? 'home' : id); });
    tabBtns[id] = b; nav.append(b);
  }

  // ---- the top bar
  const chipCv = h('canvas', { class: 'lab-chip-cv', width: 96, height: 96, 'aria-hidden': 'true' });
  const lead = h('button', { class: 'lab-btn lab-icon-btn', type: 'button', id: 'lab-lead' });
  lead.addEventListener('click', () => { if (view !== 'home') go('home'); else if (mode === 'overlay') o.onClose && o.onClose(); else o.onExit && o.onExit(); });
  const nameEl = h('span', { class: 'lab-chip-name' });
  const chip = h('button', { class: 'lab-chip', type: 'button', id: 'lab-me-chip', 'aria-label': 'Me' }, chipCv, nameEl);
  chip.addEventListener('click', () => go('me'));
  const lvEl = h('span', { class: 'lab-lv' }), xpText = h('span', { class: 'lab-xp-tx', id: 'lab-xp-text' }), xpFill = h('i');
  const xpBar = h('span', { class: 'lab-bar lab-bar-xp', role: 'progressbar', 'aria-label': 'Lab XP' }, xpFill);
  const lvBlock = h('div', { class: 'lab-lvblock' }, h('div', { class: 'lab-lvrow' }, lvEl, xpText), xpBar);
  const coinsEl = h('span', { class: 'lab-coins', id: 'lab-coins' });
  const purse = h('div', { class: 'lab-purse', title: 'Lab coins', 'aria-label': 'Lab coins' }, h('span', { html: COIN }), coinsEl);
  const flame = h('div', { class: 'lab-streak', id: 'lab-streak' });
  top.append(lead, chip, lvBlock, purse, flame);

  function renderTop() {
    const v = store.view();
    if (!v) return;
    lead.innerHTML = glyph(view === 'home' ? (mode === 'overlay' ? 'close' : 'back') : 'back');
    lead.setAttribute('aria-label', view === 'home' ? (mode === 'overlay' ? 'Close' : 'Players') : 'Back');
    nameEl.textContent = v.player.name;
    chip.style.setProperty('--c', v.player.color || '#3b7dd9');
    const slots = {}; for (const [k, s] of Object.entries(v.avatar.slots)) slots[k] = s.id;
    drawPortrait(chipCv, { color: v.player.color || '#3b7dd9', slots, mood: 'content' });
    const L = v.level;
    // a level crossed while the Lab is open (same player): the celebration, not just a number
    const pid = store.player ? store.player.id : '';
    if (pid === seenPlayer && seenLevel > 0 && L.level > seenLevel) showLevelUp(el, { level: L.level, title: L.title, from: seenLevel, reduced: ctx.reduced, sfx, say: (t) => voice.later(t) });
    seenPlayer = pid; seenLevel = L.level;
    lvEl.textContent = `Lv ${L.level} · ${L.title}`;
    xpText.textContent = L.max ? 'Top level' : `${num(L.toNext)} XP to level ${L.next}`;
    xpFill.style.width = `${L.max ? 100 : L.need ? Math.round((100 * L.into) / L.need) : 0}%`;
    xpBar.setAttribute('aria-valuenow', String(L.max ? 100 : Math.round((100 * L.into) / Math.max(1, L.need))));
    coinsEl.textContent = num(v.coins);
    const st = v.streak;
    flame.replaceChildren(
      h('span', { class: 'lab-flame' + (st.count > 0 ? ' on' : ''), html: glyph('flame'), 'aria-hidden': 'true' }),
      h('span', { class: 'lab-streak-n', 'aria-label': `Streak ${st.count}` }, String(st.count)),
      h('span', { class: 'lab-freeze' + (st.weeklyReady ? ' ready' : ' used'), title: st.weeklyReady ? 'Weekly freeze ready' : 'Weekly freeze used', html: glyph('shield') }),
      ...(st.bonus > 0 ? [h('span', { class: 'lab-freeze ready spare', title: 'Spare freeze banked', html: glyph('shield') })] : []),
    );
    flame.setAttribute('aria-label', `Streak ${st.count} days. ${st.weeklyReady ? 'Weekly freeze ready.' : ''}${st.bonus > 0 ? ' Spare freeze banked.' : ''}`);
    const waiting = v.crates.waiting;
    const questDot = v.opts.quests !== false && v.quests.length > 0 && v.questsDone < v.quests.length;
    tabBtns.quests.querySelector('.lab-dot').hidden = !questDot;
    const cd = tabBtns.crate.querySelector('.lab-dot'); cd.hidden = waiting < 1; cd.textContent = waiting > 0 ? String(waiting) : '';
    tabBtns.quests.hidden = v.opts.quests === false;
    tabBtns.crate.hidden = v.opts.quests === false && waiting < 1;
    tabBtns.family.hidden = v.opts.board === false && v.opts.goal === false;
    for (const [id, b] of Object.entries(tabBtns)) { b.classList.toggle('on', id === view); b.setAttribute('aria-current', id === view ? 'page' : 'false'); }
  }

  // ---- views
  function go(next, params) {
    if (dead) return;
    if (!MOUNTS[next]) next = 'home';
    if (cur) { try { cur.destroy(); } catch (_) { /* ignore */ } cur = null; }
    view = next;
    main.replaceChildren();
    main.className = `lab-main lab-view-${next}`;
    main.scrollTop = 0;
    cur = MOUNTS[next](ctx, params || {});
    main.append(cur.el);
    renderTop();
    el.dataset.view = next;
    if (mode === 'page') { try { history.replaceState(null, '', next === 'home' ? location.pathname + location.search : `#${next}`); } catch (_) { /* ignore */ } }
  }
  function toast(text, { say = false } = {}) {
    toastEl.textContent = text; toastEl.hidden = false;
    toastEl.classList.remove('in'); void toastEl.offsetWidth; toastEl.classList.add('in');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3200);
    if (say) voice.later(text);
  }
  const refresh = () => {
    raf = 0; if (dead) return;
    renderTop();
    if (cur && cur.update) cur.update();
  };
  const off = store.subscribe(() => { if (!raf) raf = requestAnimationFrame(refresh); });
  go(o.view && MOUNTS[o.view] ? o.view : 'home', o.params);
  return {
    el, go, ctx,
    get view() { return view; },
    refresh,
    destroy() { dead = true; off(); cancelAnimationFrame(raf); clearTimeout(toastTimer); if (cur) { try { cur.destroy(); } catch (_) { /* ignore */ } } voice.cancel(); el.remove(); },
  };
}
export { TITLES };

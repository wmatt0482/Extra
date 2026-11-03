// The results strip (lab/SPEC.md §1.3): "+14 Lab coins · 40 XP to level 7 · 2 of 3 quests", a bar for the level, a chip per quest (done or not yet),
// and, when a crate is waiting, "Lab crate!" (tap to open). The first time it also says "Welcome to the Lab". This is where coins are shown.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { lab } from '../index.js';
import { xpToReach, levelFor } from '../core/xp.js';
import { LAB_LINES } from '../core/view.js';
import { gameBadge, glyph } from './glyph.js';
import { voiceFor } from './voice.js';

export function mountResults(host, store, { game = 'sj' } = {}) {
  if (typeof document === 'undefined') return { el: null, update() {}, destroy() {} };
  const root = h('section', { class: 'lab-root lab-strip', 'aria-label': 'The Lab' });
  let welcomed = false;
  const update = () => {
    const s = store.roundSummary(game), v = store.view(game);
    if (!s || !v) return;
    const kids = [];
    if (v.welcome && !welcomed) {
      welcomed = true;
      store.markWelcome();
      voiceFor(store).later(LAB_LINES.welcome);
    }
    if (welcomed) kids.push(h('div', { class: 'lab-strip-welcome', id: 'lab-welcome' }, h('span', { html: glyph('sparkle') }), LAB_LINES.welcome));
    const bits = [`+${s.coins} Lab coins`];
    if (s.next) bits.push(`${s.toNext} XP to level ${s.next}`);
    const showQ = v.opts.quests !== false && s.quests.length > 0;
    if (showQ) bits.push(`${s.questsDone} of ${s.quests.length} quests`);
    kids.push(h('div', { class: 'lab-strip-line', id: 'lab-strip-line' }, bits.join(' · ')));
    const cum = xpToReach(s.level) + s.into;
    if (s.xp > 0 && levelFor(Math.max(0, cum - s.xp)) < s.level) kids.push(h('div', { class: 'lab-strip-level' }, h('span', { html: glyph('star') }), `Level ${s.level} · ${s.title}`));
    kids.push(h('span', { class: 'lab-bar lab-strip-bar' }, h('i', { style: { width: `${s.max ? 100 : s.need ? Math.round((100 * s.into) / s.need) : 0}%` } })));
    if (showQ) kids.push(h('div', { class: 'lab-strip-quests' }, ...s.quests.map((q) => h('span', { class: 'lab-qchip' + (q.done ? ' done' : ''), title: q.text, 'aria-label': `${q.text}: ${q.done ? 'done' : 'not yet'}` }, h('span', { html: gameBadge(q.game, 18) }), h('span', { class: 'lab-qmark', html: q.done ? glyph('check') : '' })))));
    if (s.crateWaiting && v.opts.quests !== false) {
      const b = h('button', { class: 'lab-btn lab-btn-gold lab-strip-crate', type: 'button', id: 'lab-strip-crate' }, h('span', { html: glyph('crate') }), LAB_LINES.crate);
      b.addEventListener('click', () => lab.openHome({ view: 'crate' }));
      kids.push(b);
    }
    if (v.capped) kids.push(h('div', { class: 'lab-strip-capped' }, LAB_LINES.cappedToday));
    root.replaceChildren(...kids);
  };
  const off = store.subscribe(update);
  if (host) host.appendChild(root);
  update();
  return { el: root, update, destroy() { off(); root.remove(); } };
}

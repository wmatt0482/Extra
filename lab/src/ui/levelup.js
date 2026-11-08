// The level-up moment (inside the Lab page and overlay): when Lab XP crosses a level, a short celebration instead of a number changing:
// a badge with a burst of rays, "Level 8", the new title, and what opened (gifts of those levels, slots that now open). The shared level-up
// sound and the voice line play once. Reduced motion: the card only fades in, no rays. No clock, no pressure: one big "Nice!" button closes it.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { ITEMS, SLOTS } from '../data/catalog.js';
import { LAB_LINES } from '../core/view.js';
import { glyph } from './glyph.js';

/** What opened going from `from` to `to` (levels): { items: [names], slots: ['Back', ...] }. Pure. */
export function levelUnlocks(from, to) {
  const items = ITEMS.filter((i) => i.source === 'gift' && i.level > from && i.level <= to).map((i) => i.name);
  const slots = [...new Set(SLOTS.filter((s) => s.open > from && s.open <= to && s.open > 1).map((s) => String(s.label || s.key)))];
  return { items, slots };
}

/** Show the moment on `host` (the shell). o = { level, title, from, reduced, sfx, say }. Returns the element. */
export function showLevelUp(host, o) {
  const prev = host.querySelector('.lab-levelup');
  if (prev) prev.remove();
  const { items, slots } = levelUnlocks(o.from, o.level);
  const rays = o.reduced ? null : h('span', { class: 'lab-lv-rays', 'aria-hidden': 'true' }, ...Array.from({ length: 14 }, (_, i) => h('i', { style: { '--a': `${Math.round((360 / 14) * i)}deg` } })));
  const lines = [];
  for (const n of items.slice(0, 4)) lines.push(h('li', {}, h('span', { html: glyph('sparkle') }), `New: ${n}`));
  for (const s of slots.slice(0, 3)) lines.push(h('li', {}, h('span', { html: glyph('lock') }), `${s} spot is open`));
  const done = h('button', { class: 'lab-btn lab-btn-go', type: 'button', id: 'levelup-ok' }, 'Nice!');
  const card = h('div', { class: 'lab-levelup-card' + (o.reduced ? ' calm' : ''), role: 'dialog', 'aria-label': `Level ${o.level}, ${o.title}` },
    rays,
    h('div', { class: 'lab-lv-badge' }, h('span', { html: glyph('star') }), h('b', {}, String(o.level))),
    h('div', { class: 'lab-lv-kicker' }, 'You reached'),
    h('div', { class: 'lab-lv-title' }, `Level ${o.level}`),
    h('div', { class: 'lab-lv-name' }, o.title),
    lines.length ? h('ul', { class: 'lab-lv-list' }, ...lines) : null,
    done);
  const el = h('div', { class: 'lab-levelup', role: 'status', 'aria-live': 'polite', 'data-level': String(o.level) }, card);
  const close = () => { el.remove(); };
  done.addEventListener('click', close);
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  host.append(el);
  try { done.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
  if (o.sfx) o.sfx('levelUp');
  if (o.say) o.say(LAB_LINES.levelUp(o.level, o.title));
  return el;
}

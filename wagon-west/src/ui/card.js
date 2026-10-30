// The trail card: one overlay for what the trail tells the child between days (SPEC §3): a lookout at a stop (the
// real fact, read aloud, and the sticker), an event ("Bump! A wheel comes off in a rut."), a trading post's nation
// fact, an arrival. A small kicker line, a title, the text in readable type, read aloud as it shows (Hear it again),
// and one big button. No choices to get wrong, nothing timed: show() resolves when the child taps the button (or
// presses Enter).
import { h } from '../../../spell-jump/src/ui/dom.js';
import { icon } from '../../../spell-jump/src/ui/icons.js';

export function createCard(root, { say = () => {}, canSay = () => true } = {}) {
  const kicker = h('div', { class: 'tc-kicker', id: 'tc-kicker' });
  const title = h('h3', { class: 'tc-title', id: 'tc-title' });
  const sticker = h('div', { class: 'tc-sticker', id: 'tc-sticker', hidden: true });
  const text = h('p', { class: 'tc-text', id: 'tc-text' });
  const hear = h('button', { class: 'btn btn-sm tc-hear', id: 'tc-hear', 'data-sfx': '', 'aria-label': 'Hear it again' }, h('span', { html: icon('sound') }), 'Hear it');
  const go = h('button', { class: 'btn btn-go btn-big tc-go', id: 'tc-go', 'data-sfx': '' }, 'Continue');
  const card = h('div', { class: 'card tc-card', role: 'dialog', 'aria-labelledby': 'tc-title' },
    h('div', { class: 'tc-head' }, h('div', { class: 'tc-heads' }, kicker, title), sticker), text, h('div', { class: 'tc-foot' }, hear, go));
  root.replaceChildren(card);
  root.hidden = true;
  let cur = null;
  const done = () => { if (!cur) return; const c = cur; cur = null; root.hidden = true; window.removeEventListener('keydown', onKey, true); c.resolve(true); };
  function onKey(e) {
    if (!cur || e.target.closest && e.target.closest('input, textarea')) return;
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(); }
  }
  go.addEventListener('click', done);
  hear.addEventListener('click', () => { if (cur) say(cur.say || cur.text); });
  return {
    get isOpen() { return !!cur; },
    get title() { return cur ? cur.title : ''; },
    /** { kicker, title, text, say, sticker: { emoji, name }, button, tone: 'event' | 'lookout' | 'trade' | 'arrive' } */
    show(opts = {}) {
      if (cur) done();
      return new Promise((resolve) => {
        cur = { ...opts, resolve };
        root.dataset.tone = opts.tone || 'event';
        kicker.textContent = opts.kicker || '';
        kicker.hidden = !opts.kicker;
        title.textContent = opts.title || '';
        text.textContent = opts.text || '';
        sticker.hidden = !opts.sticker;
        sticker.replaceChildren(...(opts.sticker ? [h('span', { class: 'tc-emoji', 'aria-hidden': 'true' }, opts.sticker.emoji || '★'), h('small', {}, opts.sticker.name || '')] : []));
        go.textContent = opts.button || 'Continue';
        hear.hidden = !canSay() || !(opts.say || opts.text);
        root.hidden = false;
        window.addEventListener('keydown', onKey, true);
        if (opts.say || opts.text) say(opts.say || opts.text);
      });
    },
    close() { done(); },
  };
}

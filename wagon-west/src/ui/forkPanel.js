// The fork panel (SPEC v1.5 §5.3, §2.3): a choice of where to go. It opens on the stop's fork (the journey's forkAt(J)), before the stop's other
// scenes: the explainer's portrait and name (a person at the stop: Agnes at Fort Hall, Nell at South Pass, Ben at The Dalles), the question
// ("Which way from Fort Hall?"), and one card per way: its name, ONE true line, "9 more stops · no store" in words, and a button of the same size
// as the others, with a Hear it. The first journey leans toward Oregon ("Your family planned on Oregon. You can still change your mind.": "On to
// Oregon" is first and has the focus), but every button is the same size; from 1849 Agnes adds the line about the gold fields to California. A way
// that is not open yet shows why ("The Lander Road opens in 1858.") with a lock. Everything is read aloud, in order (the question, the lean line,
// each way's name and line); a tap on a button cuts the reading off and chooses. Leaving keeps the fork pending (the title says "A choice at Fort
// Hall"). The panel owns no data: run(fork) resolves the option id, or null when the child left.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { FORKS } from '../content/routes.js';
import { PERSON_BY_ID } from '../content/people.js';
import { LEG_BY_ID } from '../content/legs.js';

export const FORK_FIRST = 'Every way is a real road. You can take the other one on another trip.';
export const FORK_LEAVE = 'Decide later';
/** "Which way from Fort Hall?" */
export const questionFor = (fork) => `Which way from ${((LEG_BY_ID[fork.at] || {}).stop || {}).name || (LEG_BY_ID[fork.at] || {}).name || 'here'}?`;
/** "9 more stops · no store" / "7 more stops · 2 stores", in words. */
export function wayLine(o) {
  const stops = `${o.legs} more stop${o.legs === 1 ? '' : 's'}`;
  const stores = o.stores ? `${o.stores} store${o.stores === 1 ? '' : 's'}` : 'no store';
  return `${stops} · ${stores}`;
}
/** Every line a fork may say, for the natural voice to prepare (the fork content, read in the leg before the fork). */
export function forkTexts(forkId) {
  const f = FORKS[forkId];
  if (!f) return [];
  const out = [`Which way from ${((LEG_BY_ID[f.at] || {}).stop || {}).name || (LEG_BY_ID[f.at] || {}).name}?`, FORK_FIRST];
  if (f.leanLine) out.push(f.leanLine.say || f.leanLine.text);
  for (const o of f.options) {
    out.push(`${o.name}. ${o.line.say || o.line.text}`, o.line.say || o.line.text);
    if (o.lineFrom1849) out.push(o.lineFrom1849.say || o.lineFrom1849.text);
    if (o.fromYear) out.push(`${o.name} opens in ${o.fromYear}.`);
  }
  const who = PERSON_BY_ID[f.explainer];
  if (who) out.push(who.lines.join(' '));
  return out;
}

export function createForkPanel(app) {
  const root = $('#panel-fork');
  let cur = null;                      // { fork, resolve, first }

  function optionCard(o, i, fork, lean) {
    const text = o.line.text || o.line, say = o.line.say || text;
    const extra = o.extra ? (o.extra.text || o.extra) : null;
    const closed = !o.open;
    const hear = h('button', { class: 'btn btn-sm fk-hear', 'data-hear': o.id, 'data-sfx': '', 'aria-label': `Hear about ${o.name}` }, h('span', { html: app.icon('sound') }), 'Hear it');
    hear.addEventListener('click', () => app.sayAll([`${o.name}.`, closed ? o.why : say, ...(extra && !closed ? [o.extra.say || extra] : [])]));
    const go = h('button', { class: 'btn btn-big btn-go fk-go', 'data-way': o.id, 'data-sfx': '', disabled: closed, 'aria-disabled': String(closed) },
      closed ? '🔒 ' : '', o.name);
    go.addEventListener('click', () => finish(o.id));
    return h('div', { class: 'card fk-card' + (closed ? ' closed' : '') + (lean ? ' lean' : ''), 'data-way': o.id },
      h('b', { class: 'fk-name' }, o.name),
      h('p', { class: 'fk-line' }, closed ? o.why : text),
      extra && !closed ? h('p', { class: 'fk-line fk-extra' }, extra) : null,
      closed ? null : h('p', { class: 'fk-count' }, wayLine(o)),
      h('div', { class: 'fk-row' }, go, hear));
  }
  function finish(v) {
    const c = cur;
    if (!c) return;
    cur = null;
    root.hidden = true;
    root.replaceChildren();
    app.cancelSpeech();
    c.resolve(v);
  }
  return {
    show() {},
    hide() { if (cur) finish(null); },
    get isOpen() { return !!cur; },
    get fork() { return cur ? cur.fork.id : null; },
    /** Ask the fork: resolves the chosen option id, or null when the child left (the choice stays pending). */
    run(fork, { first = false } = {}) {
      if (cur) finish(null);
      return new Promise((resolve) => {
        const f = FORKS[fork.id] || {};
        const who = PERSON_BY_ID[fork.explainer] || { emoji: '🧑', name: 'A traveler', role: '' };
        const order = [...fork.options];
        const lean = fork.lean && order.find((o) => o.id === fork.lean && o.open) ? fork.lean : null;
        if (lean) order.sort((a, b) => (a.id === lean ? -1 : b.id === lean ? 1 : 0));        // first trip: the lean way first (never bigger)
        const leanLine = lean && f.leanLine ? (f.leanLine.text || f.leanLine) : '';
        const q = questionFor(fork);
        const leave = h('button', { class: 'btn btn-sm fk-leave', 'data-sfx': '' }, FORK_LEAVE);
        leave.addEventListener('click', () => finish(null));
        const cards = order.map((o, i) => optionCard(o, i, fork, o.id === lean));
        root.replaceChildren(h('div', { class: 'card fk-sheet', role: 'dialog', 'aria-labelledby': 'fk-q' },
          h('div', { class: 'fk-head' },
            h('span', { class: 'fk-who', 'aria-hidden': 'true' }, who.emoji),
            h('div', { class: 'fk-heads' }, h('small', { class: 'fk-name-role' }, `${who.name}, ${who.role}`), h('h3', { id: 'fk-q', class: 'fk-q' }, q)),
            leave),
          leanLine ? h('p', { class: 'fk-lean', id: 'fk-lean' }, leanLine) : null,
          first ? h('p', { class: 'fk-first', id: 'fk-first' }, FORK_FIRST) : null,
          h('div', { class: 'fk-cards', id: 'fk-cards' }, ...cards)));
        root.hidden = false;
        cur = { fork, resolve, first };
        // the reading: the question, the lean line (once), each way's name and line; a tap cuts it off
        const lines = [q, ...(leanLine ? [f.leanLine.say || leanLine] : []), ...(first ? [FORK_FIRST] : [])];
        for (const o of order) lines.push(`${o.name}. ${o.open ? (o.line.say || o.line.text) : o.why}`, ...(o.open && o.extra ? [o.extra.say || o.extra.text] : []));
        const me = cur;
        app.voiceFor(lines, 2500).then(() => { if (cur === me) app.sayAll(lines); });
        const focus = root.querySelector(lean ? `.fk-go[data-way="${lean}"]` : '.fk-go:not([disabled])');
        if (focus) setTimeout(() => { try { focus.focus({ preventScroll: true }); } catch (_) { /* ignore */ } }, 30);
      });
    },
  };
}

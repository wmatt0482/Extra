// The choice panel (The Lab, lab/SPEC.md §4.4; Wagon West v1.6), in the fork panel's style (src/ui/forkPanel.js): a small decision at a stop. A person (a stock person of people.js) says one true
// line per way, and two equal buttons, each with a Hear it; everything is read aloud, in order (the question, then each way's name and line, the guide's fee in words); a tap on a button
// cuts the reading off and chooses. BOTH WAYS ARRIVE: neither is a mistake, nothing is hidden, nothing is locked behind a score. A guide the cash box cannot pay for shows why in words
// and stays closed; the plain way is always open. "Decide later" keeps the choice pending (the title says "A choice at Ash Hollow"; moving on without choosing takes the plain way).
// The panel owns no data: run(choice) resolves the way's id ('a' | 'b'), or null when the child left.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { CHOICES, CHOICE_LINES, feeLine } from '../content/choices.js';
import { PERSON_BY_ID } from '../content/people.js';
import { dollarWords } from '../journey/problems.js';
import { TIER_FX } from '../journey/economy.js';
import { GUIDE } from '../journey/choices.js';

/** The guide's fee as it is said: "The guide asks two dollars." */
export const feeSay = (fee) => feeLine(fee, dollarWords(fee)).say;
/** The fees a guide can ask in a journey's dollars (the price level of each tier), for the natural voice to prepare. */
export const FEES = Object.freeze([...new Set(Object.values(TIER_FX).map((t) => Math.max(1, Math.round(GUIDE.fee * t.priceMult))))]);

/** What a way says when it is read: "Pay a guide. A guide who knows ... The guide asks two dollars." */
export function wayLines(choice, o) {
  const say = o.line.say || o.line.text;
  const fee = o.fee ? feeSay(o.fee) : '';
  return [`${o.name}. ${say}`, ...(fee ? [fee] : [])];
}
/** Every line a choice can say (for the natural voice): the question, each way's name and line, the fee lines at every price level, the cash line and the results. */
export function choiceTexts(id = null) {
  const out = [];
  for (const c of CHOICES) {
    if (id && c.id !== id) continue;
    out.push(c.question);
    for (const o of c.options) {
      out.push(`${o.name}. ${o.line.say || o.line.text}`, o.line.say || o.line.text);
      if (c.kind === 'guide' && o.id === 'b') for (const fee of FEES) out.push(feeSay(fee));
    }
    const who = PERSON_BY_ID[c.who];
    if (who) out.push(who.lines.join(' '));
  }
  if (!id) for (const k of ['a', 'shortcutDry', 'shortcutSoaked', 'guide', 'cash']) out.push(CHOICE_LINES[k].say || CHOICE_LINES[k].text);
  return out;
}

export function createChoicePanel(app) {
  const root = $('#panel-choice');
  let cur = null;                      // { choice, resolve }

  function wayCard(o, choice) {
    const closed = !o.open;
    const text = o.line.text || o.line, say = wayLines(choice, o);
    const hear = h('button', { class: 'btn btn-sm fk-hear', 'data-hear': o.id, 'data-sfx': '', 'aria-label': `Hear about ${o.name}` }, h('span', { html: app.icon('sound') }), 'Hear it');
    hear.addEventListener('click', () => app.sayAll(closed ? [`${o.name}.`, CHOICE_LINES.cash.say] : say));
    const go = h('button', { class: 'btn btn-big btn-go fk-go', 'data-way': o.id, 'data-sfx': '', disabled: closed, 'aria-disabled': String(closed) }, closed ? '🔒 ' : '', o.name);
    go.addEventListener('click', () => finish(o.id));
    return h('div', { class: 'card fk-card ch-card' + (closed ? ' closed' : ''), 'data-way': o.id },
      h('b', { class: 'fk-name' }, o.name),
      h('p', { class: 'fk-line' }, closed ? CHOICE_LINES.cash.text : text),
      o.fee && !closed ? h('p', { class: 'fk-count ch-fee', 'data-fee': String(o.fee) }, feeLine(o.fee, dollarWords(o.fee)).text) : null,
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
    get choice() { return cur ? cur.choice.id : null; },
    /** Ask the choice (journey's choiceAt(J)): resolves 'a' or 'b', or null when the child left (the choice stays pending). */
    run(choice) {
      if (cur) finish(null);
      return new Promise((resolve) => {
        const who = choice.who || { emoji: '🧑', name: 'A traveler', role: '' };
        const leave = h('button', { class: 'btn btn-sm fk-leave', 'data-sfx': '' }, CHOICE_LINES.later);
        leave.addEventListener('click', () => finish(null));
        const cards = choice.options.map((o) => wayCard(o, choice));
        root.replaceChildren(h('div', { class: 'card fk-sheet ch-sheet', role: 'dialog', 'aria-labelledby': 'ch-q', 'data-choice': choice.id, 'data-kind': choice.kind },
          h('div', { class: 'fk-head' },
            h('span', { class: 'fk-who', 'aria-hidden': 'true' }, who.emoji),
            h('div', { class: 'fk-heads' }, h('small', { class: 'fk-name-role' }, `${who.name}, ${who.role}`), h('h3', { id: 'ch-q', class: 'fk-q' }, choice.question)),
            leave),
          h('div', { class: 'fk-cards', id: 'ch-cards', 'data-n': String(cards.length) }, ...cards)));
        root.hidden = false;
        cur = { choice, resolve };
        // the reading: the question, then each way's name and line (the guide's fee in words); a tap cuts it off
        const lines = [choice.question, ...choice.options.flatMap((o) => (o.open ? wayLines(choice, o) : [`${o.name}.`, CHOICE_LINES.cash.say]))];
        const me = cur;
        app.voiceFor(lines, 2500).then(() => { if (cur === me) app.sayAll(lines); });
        const focus = root.querySelector('.fk-go:not([disabled])');
        if (focus) setTimeout(() => { try { focus.focus({ preventScroll: true }); } catch (_) { /* ignore */ } }, 30);
      });
    },
  };
}

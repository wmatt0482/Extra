// Deeds (SPEC v1.2 §4): twenty things a family can do on the trail, each a badge in the Journal's fifth page, "Deeds".
// A badge shows its emoji, its name and the one line that says how to earn it; the earned ones are lit (gold edge, a
// check mark), the rest faint: a tap on any badge reads its line aloud. Nothing here is ever a gate and nothing is ever
// taken away (the journey stream's deeds.js owns the tests and the token; checkDeeds(J) → the new ids).
//   deedsPage(app)        the Journal page (app: { save, say })
//   createDeedPop(root)   a newly earned deed pops near the top like a trail card (the badge, "New deed!", its name),
//                         with its `say` read aloud; several queue up and show one at a time, after a card's pop
//   deedChips(ids)        the little badges the results screen lists ("Deeds earned on this leg")
import { h } from '../../../spell-jump/src/ui/dom.js';
import { DEEDS, DEED_BY_ID } from '../journey/deeds.js';

export const DEED_POP_MS = 3400;

/** The earned ids of a journey (J.deeds). */
export const earnedDeeds = (J) => new Set(Array.isArray(J && J.deeds) ? J.deeds : []);
/** Every line the deed pop may say (for the natural voice to prepare). */
export const deedTexts = () => DEEDS.map((d) => d.say);

/** The Journal's "Deeds" page: a note with the count, then a grid of badges. */
export function deedsPage(app) {
  const have = earnedDeeds(app.save.journey);
  const got = DEEDS.filter((d) => have.has(d.id)).length;
  const out = [h('p', { class: 'jr-note', id: 'deeds-total' }, `${got} of ${DEEDS.length} deeds earned · each one is a small badge for something done well on the trail`)];
  out.push(h('div', { class: 'dd-grid', id: 'dd-grid' }, ...DEEDS.map((d) => {
    const on = have.has(d.id);
    const b = h('button', { class: 'dd-badge' + (on ? ' got' : ''), 'data-deed': d.id, 'data-sfx': '', 'aria-label': `${d.name}: ${on ? 'earned' : 'not yet'}. ${d.how}` },
      h('span', { class: 'dd-emoji', 'aria-hidden': 'true' }, d.emoji),
      h('span', { class: 'dd-name' }, d.name),
      h('span', { class: 'dd-how' }, d.how));
    b.addEventListener('click', () => app.say(on ? d.say : d.how));
    return b;
  })));
  return out;
}

/** The pop for a newly earned deed. say(text) reads it aloud; sfx.chime() when it flips in. */
export function createDeedPop(root, { sfx = null, say = () => {}, ms = DEED_POP_MS, waitFor = () => false } = {}) {
  const queue = [];
  const log = [];
  let showing = false;
  function next() {
    if (queue.length && waitFor()) { showing = true; setTimeout(next, 300); return; }      // (a trail card is popping in the same place: it goes first)
    const d = queue.shift();
    if (!d) { showing = false; root.hidden = true; root.replaceChildren(); return; }
    showing = true;
    root.hidden = false;
    root.replaceChildren(h('div', { class: 'dpop-card', 'data-deed': d.id },
      h('span', { class: 'dpop-emoji', 'aria-hidden': 'true' }, d.emoji),
      h('span', { class: 'dpop-text' }, h('span', { class: 'dpop-label' }, 'New deed!'), h('span', { class: 'dpop-name' }, d.name), h('span', { class: 'dpop-how' }, d.how))));
    if (sfx && sfx.chime) { try { sfx.chime(); } catch (_) { /* ignore */ } }
    try { say(d.say); } catch (_) { /* ignore */ }
    setTimeout(next, ms);
  }
  return {
    /** A deed was earned (its id). */
    pop(id) {
      const d = DEED_BY_ID[id];
      if (!d) return;
      log.push(id);
      queue.push(d);
      if (!showing) next();
    },
    get showing() { return showing; },
    get log() { return log.slice(); },
  };
}

/** The results screen's list: the badges earned on this leg. */
export function deedChips(ids) {
  return (ids || []).map((id) => DEED_BY_ID[id]).filter(Boolean).map((d) => h('span', { class: 'res-deed', 'data-deed': d.id }, h('span', { 'aria-hidden': 'true' }, d.emoji), h('span', {}, d.name)));
}

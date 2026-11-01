// Deeds (SPEC v1.2 §4; v1.5: 53 of them, grouped on the page: the trail, the routes, gold, the farm, collections): things a family can do on the trail, each a badge in the Journal's fifth page, "Deeds".
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

/** The groups of the page (v1.5), in order; a deed not listed is in the first ("the trail"). */
export const DEED_GROUPS = Object.freeze([
  { id: 'trail', name: 'The trail', ids: ['dry-feet', 'mail-beater', 'full-wagon', 'people-person', 'cold-proof', 'fixer', 'spelling-ferry', 'marker-master', 'summiteer', 'homesteader', 'raft-rider', 'bison-brake', 'yoke-up', 'camper', 'wait-it-out', 'gold-rush', 'trader', 'angler', 'archer'] },
  { id: 'routes', name: 'The routes', ids: ['long-trail', 'california-bound', 'barlow', 'laurel-hill', 'shortcut', 'lander', 'dry-drive', 'ice-in-july', 'axle-grease', 'every-way', 'veteran', 'pioneer'] },
  { id: 'gold', name: 'Gold', ids: ['gold-road', 'first-flake', 'nugget', 'gold-fever', 'rocker', 'home-by-sea', 'beaver-money'] },
  { id: 'farm', name: 'The farm', ids: ['cabin', 'barn-raising', 'name-plate', 'full-farm', 'two-homes'] },
  { id: 'collections', name: 'Collections', ids: ['card-shark', 'set-collector', 'good-nose', 'fetch-champ', 'big-one', 'river-guide', 'skipper', 'keeper', 'wish-maker', 'hat-trick'] },
]);
/** The group a deed is in. */
export const groupOfDeed = (id) => (DEED_GROUPS.find((g) => g.ids.includes(id)) || DEED_GROUPS[0]).id;

/** The Journal's "Deeds" page: "Deeds (53)" and the count, then the badges in their groups. */
export function deedsPage(app) {
  const have = earnedDeeds(app.save.journey);
  const got = DEEDS.filter((d) => have.has(d.id)).length;
  const out = [h('h3', { class: 'jr-h', id: 'deeds-title' }, `Deeds (${DEEDS.length})`), h('p', { class: 'jr-note', id: 'deeds-total' }, `${got} of ${DEEDS.length} deeds earned · each one is a small badge for something done well on the trail`)];
  const badge = (d) => {
    const on = have.has(d.id);
    const b = h('button', { class: 'dd-badge' + (on ? ' got' : ''), 'data-deed': d.id, 'data-sfx': '', 'aria-label': `${d.name}: ${on ? 'earned' : 'not yet'}. ${d.how}` },
      h('span', { class: 'dd-emoji', 'aria-hidden': 'true' }, d.emoji),
      h('span', { class: 'dd-name' }, d.name),
      h('span', { class: 'dd-how' }, d.how));
    b.addEventListener('click', () => app.say(on ? d.say : d.how));
    return b;
  };
  const listed = new Set(DEED_GROUPS.flatMap((g) => g.ids));
  DEED_GROUPS.forEach((g, gi) => {
    const mine = DEEDS.filter((d) => g.ids.includes(d.id) || (gi === 0 && !listed.has(d.id)));
    if (!mine.length) return;
    const n = mine.filter((d) => have.has(d.id)).length;
    out.push(h('section', { class: 'dd-group', 'data-group': g.id }, h('div', { class: 'dd-head' }, h('b', {}, g.name), h('small', {}, `${n} of ${mine.length}`)), h('div', { class: 'dd-grid', id: gi === 0 ? 'dd-grid' : null }, ...mine.map(badge))));
  });
  return out;
}

/** The pop for a newly earned deed. say(text) reads it aloud; sfx.chime() when it flips in. */
export function createDeedPop(root, { sfx = null, say = () => {}, ms = DEED_POP_MS, waitFor = () => false, hold = () => false } = {}) {
  const queue = [];
  const log = [];
  let showing = false;
  function next() {
    if (queue.length && waitFor()) { showing = true; root.hidden = true; root.replaceChildren(); setTimeout(next, 300); return; }      // (a trail card is popping in the same place: it goes first; the deed before this one is gone from the screen, never left drawn while the next waits: a stale pop would hold the card and the find pop back for good)
    const d = queue[0];
    if (!d) { showing = false; root.hidden = true; root.replaceChildren(); return; }
    showing = true;
    root.hidden = false;
    root.replaceChildren(h('div', { class: 'dpop-card', 'data-deed': d.id },
      h('span', { class: 'dpop-emoji', 'aria-hidden': 'true' }, d.emoji),
      h('span', { class: 'dpop-text' }, h('span', { class: 'dpop-label' }, 'New deed!'), h('span', { class: 'dpop-name' }, d.name), h('span', { class: 'dpop-how' }, d.how))));
    // a panel, card or question is open, or the pop would sit on text or a button: it waits, unseen, and comes out when clear
    root.style.visibility = 'hidden';
    const held = hold(root);
    root.style.visibility = '';
    if (held) { root.hidden = true; root.replaceChildren(); setTimeout(next, 300); return; }
    queue.shift();
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

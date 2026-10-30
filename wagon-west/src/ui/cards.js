// Trail cards (SPEC v1.1 §3): the collection's faces, drawn by the UI (an emoji on a card face in the suit's colour,
// the name, the one-line fact on the back; no new art), the "pop" when one drops on the trail (the card flips in near
// the top of the screen for about 1.5 s with a chime; a duplicate says "+1 token"), and the Journal's fourth page,
// the album: four suits (landmarks, nations, animals and plants, companions), "7 of 12" per suit, a gold star on a
// full suit, every owned card flips over on a tap to show its fact and reads it aloud.
// The cards are the journey's (J.cards, the Journey stream's awardCard / suitComplete; the content is
// src/content/cards.js: CARDS, SUITS, cardsOf). This module only draws; it keeps no data.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { CARDS, SUITS, SUIT_NAMES, cardsOf } from '../content/cards.js';

export const SUIT_NAME = Object.freeze({ landmark: 'Landmarks', nation: 'Nations', wild: 'Animals and plants', companion: 'Companions' });
export const SUIT_ICON = Object.freeze({ landmark: '⛰️', nation: '🪶', wild: '🌿', companion: '🤠' });
export const POP_MS = 1500;

/** The suits in album order: [{ id, name }] whatever shape SUITS has (ids, objects, or a map). */
export function suitList() {
  const raw = Array.isArray(SUITS) ? SUITS : SUITS && typeof SUITS === 'object' ? Object.entries(SUITS).map(([id, v]) => (typeof v === 'object' ? { id, ...v } : { id, name: v })) : [];
  const list = raw.map((s) => (typeof s === 'string' ? { id: s } : { id: s.id, name: s.name }));
  return (list.length ? list : Object.keys(SUIT_NAME).map((id) => ({ id }))).map((s) => ({ id: s.id, name: s.name || (SUIT_NAMES && SUIT_NAMES[s.id]) || SUIT_NAME[s.id] || s.id }));
}
/** The cards of a suit (cardsOf when the content has it). */
export const suitCards = (suit) => { try { const l = cardsOf(suit); if (Array.isArray(l)) return l; } catch (_) { /* below */ } return CARDS.filter((c) => c.suit === suit); };
/** The card ids a journey holds (J.cards as ids, or counts by id). */
export function ownedCards(J) {
  const c = J && J.cards;
  if (Array.isArray(c)) return new Set(c);
  if (c && typeof c === 'object') return new Set(Object.keys(c).filter((k) => c[k]));
  return new Set();
}
/** A card's fact as shown, and as said. */
export const factOf = (card) => (card ? (typeof card.fact === 'string' ? card.fact : (card.fact && card.fact.text) || '') : '');
export const sayOf = (card) => (card ? card.say || (card.fact && card.fact.say) || factOf(card) : '');

/** One card face (front: emoji + name; back: the fact). `flippable` makes it a button. */
export function cardFace(card, { flippable = false, small = false } = {}) {
  const front = h('span', { class: 'tcard-front' },
    h('span', { class: 'tcard-suit', 'aria-hidden': 'true' }, SUIT_ICON[card.suit] || '★'),
    h('span', { class: 'tcard-emoji', 'aria-hidden': 'true' }, card.emoji || '★'),
    h('span', { class: 'tcard-name' }, card.name));
  const back = h('span', { class: 'tcard-back' }, h('span', { class: 'tcard-fact' }, factOf(card)));
  const attrs = { class: `tcard s-${card.suit}${small ? ' small' : ''}`, 'data-card': card.id };
  if (!flippable) return h('div', attrs, h('span', { class: 'tcard-in' }, front, back));
  return h('button', { ...attrs, 'data-sfx': '', 'aria-pressed': 'false', 'aria-label': `${card.name}: tap for its fact` }, h('span', { class: 'tcard-in' }, front, back));
}

/** The pop: cards queue up and flip in one at a time near the top of the screen (pointer-events none). */
export function createCardPop(root, { sfx = null } = {}) {
  const queue = [];
  let showing = false;
  const log = [];
  function next() {
    const it = queue.shift();
    if (!it) { showing = false; root.hidden = true; root.replaceChildren(); return; }
    showing = true;
    root.hidden = false;
    const el = h('div', { class: 'cpop-card' + (it.dup ? ' dup' : ''), 'data-card': it.card.id },
      cardFace(it.card, { small: true }),
      h('span', { class: 'cpop-label' }, it.dup ? 'Again! +1 token' : it.suitDone ? 'New card! A full suit!' : 'New card!'));
    root.replaceChildren(el);
    if (sfx && sfx.chime) try { sfx.chime(); } catch (_) { /* ignore */ }
    setTimeout(next, POP_MS);
  }
  return {
    /** A card dropped: { card, dup, suitDone }. */
    pop(card, { dup = false, suitDone = false } = {}) {
      if (!card) return;
      log.push({ id: card.id, dup });
      queue.push({ card, dup, suitDone });
      if (!showing) next();
    },
    get showing() { return showing; },
    get log() { return log.slice(); },
  };
}

/** The album (the Journal's "Cards" page). app: { save, say } */
export function albumPage(app) {
  const J = app.save.journey;
  const have = ownedCards(J);
  const total = CARDS.length;
  const got = CARDS.filter((c) => have.has(c.id)).length;
  const out = [h('p', { class: 'jr-note cards-total', id: 'cards-total' }, `${got} of ${total} trail cards · spot animals, visit lookouts and trading posts, and make camp to find more`)];
  for (const s of suitList()) {
    const cards = suitCards(s.id);
    const n = cards.filter((c) => have.has(c.id)).length;
    const full = cards.length > 0 && n === cards.length;
    out.push(h('section', { class: 'card cards-suit' + (full ? ' full' : ''), 'data-suit': s.id },
      h('div', { class: 'cards-head' },
        h('b', {}, s.name),
        h('span', { class: 'cards-count', 'data-count': `${n}/${cards.length}` }, `${n} of ${cards.length}`),
        full ? h('span', { class: 'cards-star', 'aria-label': 'Full suit: a gold star and a golden crate', html: app.icon('star') }) : null),
      h('div', { class: 'cards-grid' }, ...cards.map((c) => {
        if (!have.has(c.id)) return h('div', { class: `tcard s-${c.suit} none`, 'data-card': c.id, 'aria-label': 'Not found yet' }, h('span', { class: 'tcard-in' }, h('span', { class: 'tcard-front' }, h('span', { class: 'tcard-emoji', 'aria-hidden': 'true' }, '?'))));
        const b = cardFace(c, { flippable: true });
        b.addEventListener('click', () => {
          const on = !b.classList.contains('flipped');
          b.classList.toggle('flipped', on);
          b.setAttribute('aria-pressed', String(on));
          if (on) app.say(sayOf(c));
        });
        return b;
      }))));
  }
  return out;
}

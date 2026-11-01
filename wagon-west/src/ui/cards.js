// Trail cards (SPEC v1.1 §3): the collection's faces, drawn by the UI (an emoji on a card face in the suit's colour,
// the name, the one-line fact on the back; no new art), the "pop" when one drops on the trail (the card flips in near
// the top of the screen for about 1.5 s with a chime; a duplicate says "+1 token"), and the Journal's fourth page,
// the album: four suits (landmarks, nations, animals and plants, companions), "7 of 12" per suit, a gold star on a
// full suit, every owned card flips over on a tap to show its fact and reads it aloud.
// The cards are the journey's (J.cards, the Journey stream's awardCard / suitComplete; the content is
// src/content/cards.js: CARDS, SUITS, cardsOf). This module only draws; it keeps no data.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { CARDS, SUITS, SUIT_NAMES, cardsOf, CARD_SETS, DECOR_BY_ID } from '../content/cards.js';

// v1.4: two more suits, 'river' (the six fish of the trail) and 'tales' (the trail facts and the two quest cards): 54 cards in six suits
export const SUIT_NAME = Object.freeze({ landmark: 'Landmarks', nation: 'Nations', wild: 'Animals and plants', companion: 'Companions', river: 'Fish of the trail', tales: 'Trail tales', gold: 'The gold rush' });
export const SUIT_ICON = Object.freeze({ landmark: '⛰️', nation: '🪶', wild: '🌿', companion: '🤠', river: '🐟', tales: '📖', gold: '🪙' });
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
export function createCardPop(root, { sfx = null, hold = () => false } = {}) {
  const queue = [];
  let showing = false;
  const log = [], trace = [];
  const note = (what, id) => { trace.push(`${(performance.now() / 1000).toFixed(1)} ${what} ${id}`); if (trace.length > 24) trace.shift(); };
  function next() {
    const it = queue[0];
    if (!it) { showing = false; root.hidden = true; root.replaceChildren(); return; }
    showing = true;
    root.hidden = false;
    const el = h('div', { class: 'cpop-card' + (it.dup ? ' dup' : ''), 'data-card': it.card.id },
      cardFace(it.card, { small: true }),
      h('span', { class: 'cpop-label' }, it.dup ? 'Again! +1 token' : it.suitDone ? 'New card! A full suit!' : 'New card!'));
    root.replaceChildren(el);
    // a panel, card or question is open, or the pop would sit on text or a button: it waits, unseen, and comes out when clear
    root.style.visibility = 'hidden';
    const held = hold(root);
    root.style.visibility = '';
    if (!held || !queue[0].noted) { queue[0].noted = true; note(held ? 'held' : 'shown', it.card.id); }
    if (held) { root.hidden = true; root.replaceChildren(); setTimeout(next, 300); return; }
    // drawn: a toast that came up in the same instant is answered a moment later (the pop steps back and waits its turn), then the card counts as shown
    setTimeout(() => {
      let again = false;
      try { again = !!hold(root); } catch (_) { again = false; }
      if (again) { note('stepped back', it.card.id); root.hidden = true; root.replaceChildren(); setTimeout(next, 300); return; }
      queue.shift();
      if (sfx && sfx.chime) try { sfx.chime(); } catch (_) { /* ignore */ }
      setTimeout(next, Math.max(0, POP_MS - 250));
    }, 250);
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
    get trace() { return trace.slice(); },
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

/** The Journal's "Sets" tab (v1.5): the sixteen card sets that cut across the suits, each with its progress, its cards (found ones lit) and the wagon
 *  decoration a full set unlocks (the line it says when complete; the decoration lit once earned). app: { save, say }. */
export function setsPage(app) {
  const J = app.save.journey;
  const have = ownedCards(J);
  const done = new Set(app.save.setsDone || []);
  const out = [h('p', { class: 'jr-note cards-total', id: 'sets-total' }, `${done.size} of ${CARD_SETS.length} card sets complete · a full set earns a decoration for the wagon (wear two in Outfit → Look)`)];
  out.push(h('div', { class: 'sets-grid', id: 'sets-grid' }, ...CARD_SETS.map((st) => {
    const got = st.cards.filter((id) => have.has(id)).length;
    const dec = DECOR_BY_ID[st.decor];
    const complete = done.has(st.id);
    const card = h('button', { class: 'card set-card' + (complete ? ' full' : ''), 'data-set': st.id, 'data-sfx': '', 'aria-label': `${st.name}: ${got} of ${st.cards.length}. ${complete ? st.say : 'Decoration: ' + (dec ? dec.name : '')}` },
      h('div', { class: 'set-head' }, h('b', {}, st.name), h('span', { class: 'cards-count', 'data-count': `${got}/${st.cards.length}` }, `${got} of ${st.cards.length}`)),
      h('div', { class: 'set-cards' }, ...st.cards.map((id) => { const c = CARDS.find((x) => x.id === id); return h('span', { class: 'set-mini' + (have.has(id) ? ' got' : ''), 'data-card': id, 'aria-hidden': 'true' }, have.has(id) && c ? c.emoji : '?'); })),
      h('div', { class: 'set-decor' + (complete ? ' got' : '') }, h('span', { 'aria-hidden': 'true' }, complete && dec ? dec.emoji : '🔒'), h('span', {}, dec ? dec.name : '')));
    card.addEventListener('click', () => app.say(complete ? st.say : `${st.name}. ${got} of ${st.cards.length} cards.`));
    return card;
  })));
  return out;
}

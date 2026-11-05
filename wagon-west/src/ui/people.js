// People at the stops (SPEC v1.2 §4 "Talk to people"): on every stop screen (a fort, a river, a landmark, the valley) a
// "Talk" row of emoji portraits, the two or three people the journey's peopleAt(J, stopId) lists. A tap shows a card with
// their name, who they are and their two lines, read aloud; then meetPerson(J, id) remembers them (a check mark on the
// portrait, "People met" on the Journal's map page) and, the first time, hands over their gift:
//   food   "+10 lb of beans" into the wagon          card   a trail card (awardCard; a duplicate pays a token)
//   tip    an OPTIONAL 'parts' puzzle on the problem panel for a trade token ("Work it out" / "Not now")
//   trade  a fair trade like the trading posts ("Trade" / "No thanks"): the trade problem at the person's own rate
// Nothing here is a gate: the stop's big button ("To the ferry", "Into the fort", …) is always one tap away, and a gift
// turned down is just a friendly visit.
// v1.4: the people of a side quest (JA.questAt(J, stopId): a clue-giver with a ❓ badge, the owner of what the dog found with a 💛
// badge) stand in the same row; a tap runs JA.questTalk (a card with their lines, said; on the owner the reward: the card, a trade
// token, a gift of food). Walking past them is fine: the post office sends the thing ahead. The module draws and drives; the journey owns the people and the gifts, main.js
// lends the panels through app.v2 (showCard, runProblem, dropCard, checkDeeds, curLeg, JA).
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { CARD_BY_ID } from '../content/cards.js';
// v1.5: Hugo at City of Rocks lets you write your wagon's name on a granite spire with axle grease (the 'axle-grease' deed: JA.writeOnRock), and the
// Nisenan guide at Coloma hands out the "Gold fever" card (the owner's call: the card that says what the gold rush did to California's Native nations
// comes from a person of that nation, not from the comic gold-fever event).
export const ROCK_ASK = 'Hugo holds out his pot of axle grease. Write your wagon’s name on a granite spire?';
export const ROCK_DONE = 'There it is, in axle grease: your wagon’s name on the rock!';
export const GUIDE_CARD_KICKER = 'A Nisenan guide';

const STOP_BUTTON = { river: 'To the ferry', fort: 'Into the fort', home: 'Home at last', start: 'To the store' };
/** The start town as a stop (it is not a leg): the Talk row there works like a fort's, its big button goes to the store. */
export const START_STOP = Object.freeze({ id: 'independence', name: 'Independence, Missouri', stop: Object.freeze({ kind: 'start', name: 'Independence, Missouri' }) });
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');

/** The Journal's "People met" card for the map page. app: { save, v2 }. */
export function metCard(app) {
  const JA = app.v2.JA;
  const J = app.save.journey;
  const met = new Set(Array.isArray(J && J.met) ? J.met : []);
  const all = Array.isArray(JA.PEOPLE) ? JA.PEOPLE : [];
  const chips = all.filter((p) => met.has(p.id)).map((p) => h('span', { class: 'met-chip', 'data-person': p.id }, h('span', { 'aria-hidden': 'true' }, p.emoji), h('span', {}, p.name)));
  return h('section', { class: 'card met-card', id: 'met-card' },
    h('b', {}, `People met · ${met.size} of ${all.length}`),
    chips.length ? h('div', { class: 'met-list' }, ...chips) : h('p', { class: 'jr-note' }, 'Talk to the people at the forts, rivers and landmarks to meet them here.'));
}

export function createPeople(app) {
  const wrap = $('#stop-wrap');
  const title = $('#stop-title');
  const row = $('#stop-row');
  const metEl = $('#stop-met');
  const go = $('#stop-go');
  const goText = $('#stop-go-text');
  let V = null;           // { leg, resolve }
  let busy = false;
  const JA = () => app.v2.JA;

  /** The quest people at this stop ([] before the Journey stream's quests exist): { questId, role, person, lines, badge }. */
  function questsAt(stopId) {
    const J = app.save.journey;
    try { return typeof JA().questAt === 'function' ? JA().questAt(J, stopId) || [] : []; } catch (e) { console.warn('[WagonWest] questAt', e); return []; }
  }
  function paint() {
    if (!V) { wrap.hidden = true; return; }
    const J = app.save.journey;
    const list = JA().peopleAt(J, V.leg.id);
    const quests = questsAt(V.leg.id);
    wrap.hidden = false;
    title.textContent = (V.leg.stop && V.leg.stop.name) || V.leg.name;
    goText.textContent = STOP_BUTTON[V.leg.stop && V.leg.stop.kind] || 'Continue';
    const met = list.filter((p) => p.met).length;
    metEl.textContent = `${met} of ${list.length} met here`;
    row.replaceChildren(...list.map((p) => {
      const b = h('button', { class: 'stop-person' + (p.met ? ' met' : ''), 'data-person': p.id, 'data-sfx': '', disabled: busy, 'aria-label': `${p.name}, ${p.role}${p.met ? ', met' : ''}` },
        h('span', { class: 'stop-person-emoji', 'aria-hidden': 'true' }, p.emoji),
        h('span', { class: 'stop-person-name' }, p.name));
      b.addEventListener('click', () => { talk(p.id).catch((e) => console.error('[WagonWest] talk', e)); });
      return b;
    }).concat(quests.map((q) => {
      const b = h('button', { class: 'stop-person quest', 'data-person': q.person.id, 'data-quest': q.questId, 'data-role': q.role, 'data-sfx': '', disabled: busy, 'aria-label': `${q.person.name}, ${q.person.role}${q.role === 'owner' ? ': you have something for them' : ': they may know something'}` },
        h('span', { class: 'stop-person-badge', 'aria-hidden': 'true' }, q.badge || (q.role === 'owner' ? '💛' : '❓')),
        h('span', { class: 'stop-person-emoji', 'aria-hidden': 'true' }, q.person.emoji),
        h('span', { class: 'stop-person-name' }, q.person.name));
      b.addEventListener('click', () => { talkQuest(q).catch((e) => console.error('[WagonWest] quest talk', e)); });
      return b;
    })));
    go.disabled = busy;
  }
  function done(ok) { if (!V) return; const v = V; V = null; wrap.hidden = true; v.resolve(ok); }
  go.addEventListener('click', () => { if (!busy) done(true); });

  /** What this person can trade with what the wagon holds: their own listed trade, else a fallback the wagon can afford
   *  (tokens, then store food), else kind 'none'. */
  const offerFor = (person, g) => JA().tradeOffer(app.save.journey, { trades: [g], nation: person.id });
  /** The card's words: the person's own line for their listed trade, a sentence worked from the offer for a fallback. */
  const offerText = (person, g, offer) => (offer && offer.kind === 'fallback' ? JA().tradeLine(offer, person.name) : g.text);

  /** A person's trade: the trade problem at the offer's rate (the multiplication asked is the offer's rate x count), then applyTrade. */
  async function personTrade(person, g, offer = offerFor(person, g)) {
    const J = app.save.journey;
    if (offer && offer.kind === 'full') { app.effectToast("The wagon can't carry more food: a friendly visit."); return; }      // (v1.7.1: the wagon carries 600 lb of food)
    if (!offer || offer.kind === 'none') { app.effectToast('Nothing to trade this time: a friendly visit.'); return; }
    const pick = app.v2.ladderPick('x');
    const nation = { id: person.id, name: person.name, trade: { give: offer.give, giveName: offer.giveName, get: offer.get, getName: offer.getName, rate: offer.rate } };
    let p = null;
    try { p = JA().problemFor({ kind: 'trade', fact: pick ? pick.fact : null, leg: app.v2.curLeg(), season: J.season, rand: Math.random, nation, offer, have: offer.have }); } catch (e) { console.warn('[WagonWest] problemFor trade', e); }
    if (!p) return;
    const who = (t) => (typeof t === 'string' ? t.replace(/^The .+? people trade /, `${person.name} trades `) : t);
    p = { ...p, text: who(p.text), say: who(p.say) };
    const res = await app.v2.runProblemPanel(p, { kind: 'trade', title: 'Trading', chipText: person.name, pick });
    if (res.cancelled || !V) return;
    let t = null;
    try { t = JA().applyTrade(J, p.meta || { giveN: p.giveN, getN: p.answer }); } catch (e) { console.warn('[WagonWest] applyTrade', e); }
    app.persist();
    if (t && t.got) app.effectToast(`Traded ${t.gave} ${offer.giveName} for ${t.got} ${offer.getName}.${t.full ? " The wagon can't carry more." : ''}`);
    else if (t && t.full) app.effectToast("The wagon can't carry more food: a friendly visit.");
  }

  async function gift(person, g) {
    if (g.kind === 'food') {
      const lb = Math.round(Number.isFinite(Number(g.foodLb)) ? Number(g.foodLb) : Number(g.lb) || 0);      // (v1.7.1: what fit in the wagon)
      if (lb > 0 || !g.full) app.effectToast(`+${lb} lb of ${g.what || 'food'}${g.full ? ". The wagon can't carry more" : ''}`, g.text);
      else app.effectToast("The wagon can't carry more; leave the rest for the next party", g.text);
    } else if (g.kind === 'card') {
      if (g.text) app.effectToast(g.text, g.text);
      app.v2.dropCard(g.card);
    } else if (g.kind === 'tip') {
      const c = await app.v2.showCard({ kicker: person.name, title: 'A puzzle for a token', text: g.text, say: g.text, sticker: { emoji: person.emoji, name: '' }, tone: 'trade', button: 'Work it out', alt: 'Not now' });
      if (c === true && V) await app.v2.runProblem('parts', { title: person.name });
    } else if (g.kind === 'trade') {
      const offer = offerFor(person, g);
      if (offer && offer.kind === 'full') { app.effectToast("The wagon can't carry more food: a friendly visit."); return; }      // (v1.7.1: the wagon carries 600 lb of food)
      if (!offer || offer.kind === 'none') { app.effectToast('Nothing to trade this time: a friendly visit.'); return; }
      const text = offerText(person, g, offer);          // the shown text and the spoken line are the same words
      const c = await app.v2.showCard({ kicker: person.name, title: 'A fair trade', text, say: text, sticker: { emoji: person.emoji, name: '' }, tone: 'trade', button: 'Trade', alt: 'No thanks' });
      if (c === true && V) await personTrade(person, g, offerFor(person, g));
    }
  }

  /** Tap a portrait: their lines on a card (read aloud), then they are met and the gift comes. */
  async function talk(id) {
    const J = app.save.journey;
    const person = JA().PERSON_BY_ID[id];
    if (!J || !person || busy) return;
    busy = true; paint();
    try {
      const lines = person.lines.join(' ');
      await app.v2.showCard({ kicker: cap(person.role), title: person.name, text: lines, say: lines, sticker: { emoji: person.emoji, name: '' }, tone: 'trade', button: 'Thanks!' });
      if (!V) return;
      const r = JA().meetPerson(J, id);
      app.persist();
      if (r.first && r.gift) await gift(person, r.gift);
      if (V && person.id === 'hugo') await rockName(person);
      if (V && r.first && person.id === 'nisenan-guide') await goldFeverCard(person);
      app.persist();
      app.refreshCash();
      app.v2.checkDeeds();
    } finally { busy = false; paint(); }
  }

  /** Hugo's pot of axle grease: write the wagon's name on the rock (once a visit; the deed counts it). */
  async function rockName(person) {
    const J = app.save.journey;
    if (!J || typeof JA().writeOnRock !== 'function') return;
    const c = await app.v2.showCard({ kicker: person.name, title: 'Axle grease', text: ROCK_ASK, say: ROCK_ASK, sticker: { emoji: person.emoji, name: '' }, tone: 'trade', button: 'Write it!', alt: 'Not now' });
    if (c !== true || !V) return;
    let r = null;
    try { r = JA().writeOnRock(J); } catch (e) { console.warn('[WagonWest] writeOnRock', e); }
    if (r && r.ok) { app.effectToast(ROCK_DONE, ROCK_DONE); app.persist(); app.v2.checkDeeds(); }
  }
  /** The Nisenan guide's card about gold fever: the card's own words, read aloud, from the people it is about. */
  async function goldFeverCard(person) {
    const cd = CARD_BY_ID['gold-fever'];
    if (!cd) return;
    const text = typeof cd.fact === 'string' ? cd.fact : (cd.fact && cd.fact.text) || '';
    await app.v2.showCard({ kicker: GUIDE_CARD_KICKER, title: cd.name, text, say: cd.say || (cd.fact && cd.fact.say) || text, sticker: { emoji: cd.emoji, name: '' }, tone: 'trade', button: 'Thank you' });
    if (V) app.v2.dropCard('gold-fever');
  }

  /** A quest person (v1.4): their lines on a card, said; the clue is kept (the next stop's person knows more), the owner pays the reward. */
  async function talkQuest(q) {
    const J = app.save.journey;
    if (!J || busy || typeof JA().questTalk !== 'function') return;
    busy = true; paint();
    try {
      let r = null;
      try { r = JA().questTalk(J, q.questId); } catch (e) { console.warn('[WagonWest] questTalk', e); }
      app.persist();
      const lines = ((r && r.lines) || q.lines || []).join(' ');
      await app.v2.showCard({ kicker: cap(q.person.role), title: q.person.name, text: lines, say: lines, sticker: { emoji: q.person.emoji, name: '' }, tone: 'trade', button: 'Thanks!' });
      if (!V) return;
      const rw = r && r.reward;
      if (rw) {
        if (rw.card) app.v2.dropCard(rw.card);
        if (rw.tokens) app.effectToast(`+${rw.tokens} trade token${rw.tokens === 1 ? '' : 's'}`);
        if (rw.food && rw.food.lb) app.effectToast(`+${Math.round(rw.food.lb)} lb of ${rw.food.what || 'food'}`);
      }
      app.persist();
      app.refreshCash();
      app.v2.checkDeeds();
    } finally { busy = false; paint(); }
  }

  return {
    show() { if (!V) wrap.hidden = true; },
    hide() { done(false); },
    /** Does this leg's stop have people to talk to? */
    has(leg) { const J = app.save.journey; return !!(J && leg && (JA().peopleAt(J, leg.id).length || questsAt(leg.id).length)); },
    /** Show the Talk row for the stop; resolves true when the child taps the stop's button, false when they left. */
    visit(leg) {
      if (V) done(false);
      return new Promise((resolve) => { V = { leg, resolve }; busy = false; paint(); });
    },
    talk, talkQuest,
    get isOpen() { return !!V; },
    get busy() { return busy; },
  };
}

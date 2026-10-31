// People at the stops (SPEC v1.2 §4 "Talk to people"): on every stop screen (a fort, a river, a landmark, the valley) a
// "Talk" row of emoji portraits, the two or three people the journey's peopleAt(J, stopId) lists. A tap shows a card with
// their name, who they are and their two lines, read aloud; then meetPerson(J, id) remembers them (a check mark on the
// portrait, "People met" on the Journal's map page) and, the first time, hands over their gift:
//   food   "+10 lb of beans" into the wagon          card   a trail card (awardCard; a duplicate pays a token)
//   tip    an OPTIONAL 'parts' puzzle on the problem panel for a trade token ("Work it out" / "Not now")
//   trade  a fair trade like the trading posts ("Trade" / "No thanks"): the trade problem at the person's own rate
// Nothing here is a gate: the stop's big button ("To the ferry", "Into the fort", …) is always one tap away, and a gift
// turned down is just a friendly visit. The module draws and drives; the journey owns the people and the gifts, main.js
// lends the panels through app.v2 (showCard, runProblem, dropCard, checkDeeds, curLeg, JA).
import { $, h } from '../../../spell-jump/src/ui/dom.js';

const STOP_BUTTON = { river: 'To the ferry', fort: 'Into the fort', home: 'Home at last' };
const GOOD_NAME = { pelts: 'beaver pelts', blankets: 'blankets', rope: 'coils of rope', flour: 'sacks of flour', corn: 'bags of corn', pemmican: 'cakes of pemmican', berries: 'bags of dried berries',
  camas: 'bags of camas roots', salmon: 'bundles of dried salmon', roots: 'bags of dried roots', wapato: 'bags of wapato roots' };
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

  function paint() {
    if (!V) { wrap.hidden = true; return; }
    const J = app.save.journey;
    const list = JA().peopleAt(J, V.leg.id);
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
    }));
    go.disabled = busy;
  }
  function done(ok) { if (!V) return; const v = V; V = null; wrap.hidden = true; v.resolve(ok); }
  go.addEventListener('click', () => { if (!busy) done(true); });

  /** A person's trade at their own rate: the trade problem, then applyTrade. */
  async function personTrade(person, gift) {
    const J = app.save.journey;
    const rate = Array.isArray(gift.rate) && gift.rate.length === 2 ? gift.rate : [3, 2];
    const have = JA().spareGoods(J, gift.give);
    if (have < rate[0]) { app.effectToast('Nothing to trade this time: a friendly visit.'); return; }
    const pick = app.v2.ladderPick('x');
    const nation = { id: person.id, name: person.name, trade: { give: gift.give, giveName: GOOD_NAME[gift.give] || gift.give, get: gift.get, getName: GOOD_NAME[gift.get] || gift.get, rate } };
    let p = null;
    try { p = JA().problemFor({ kind: 'trade', fact: pick ? pick.fact : null, leg: app.v2.curLeg(), season: J.season, rand: Math.random, nation, have }); } catch (e) { console.warn('[WagonWest] problemFor trade', e); }
    if (!p) return;
    const who = (t) => (typeof t === 'string' ? t.replace(/^The .+? people trade /, `${person.name} trades `) : t);
    p = { ...p, text: who(p.text), say: who(p.say) };
    const res = await app.v2.runProblemPanel(p, { kind: 'trade', title: 'Trading', chipText: person.name, pick });
    if (res.cancelled || !V) return;
    let t = null;
    try { t = JA().applyTrade(J, p.meta || { giveN: p.giveN, getN: p.answer }); } catch (e) { console.warn('[WagonWest] applyTrade', e); }
    app.persist();
    if (t && t.got) app.effectToast(`Traded ${t.gave} ${GOOD_NAME[gift.give] || gift.give} for ${t.got} ${GOOD_NAME[gift.get] || gift.get}.`);
  }

  async function gift(person, g) {
    if (g.kind === 'food') {
      const lb = Math.round(Number(g.foodLb) || Number(g.lb) || 0);
      app.effectToast(`+${lb} lb of ${g.what || 'food'}`, g.text);
    } else if (g.kind === 'card') {
      if (g.text) app.effectToast(g.text, g.text);
      app.v2.dropCard(g.card);
    } else if (g.kind === 'tip') {
      const c = await app.v2.showCard({ kicker: person.name, title: 'A puzzle for a token', text: g.text, say: g.text, sticker: { emoji: person.emoji, name: '' }, tone: 'trade', button: 'Work it out', alt: 'Not now' });
      if (c === true && V) await app.v2.runProblem('parts', { title: person.name });
    } else if (g.kind === 'trade') {
      const c = await app.v2.showCard({ kicker: person.name, title: 'A fair trade', text: g.text, say: g.text, sticker: { emoji: person.emoji, name: '' }, tone: 'trade', button: 'Trade', alt: 'No thanks' });
      if (c === true && V) await personTrade(person, g);
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
      app.persist();
      app.refreshCash();
      app.v2.checkDeeds();
    } finally { busy = false; paint(); }
  }

  return {
    show() { if (!V) wrap.hidden = true; },
    hide() { done(false); },
    /** Does this leg's stop have people to talk to? */
    has(leg) { const J = app.save.journey; return !!(J && leg && JA().peopleAt(J, leg.id).length); },
    /** Show the Talk row for the stop; resolves true when the child taps the stop's button, false when they left. */
    visit(leg) {
      if (V) done(false);
      return new Promise((resolve) => { V = { leg, resolve }; busy = false; paint(); });
    },
    talk,
    get isOpen() { return !!V; },
    get busy() { return busy; },
  };
}

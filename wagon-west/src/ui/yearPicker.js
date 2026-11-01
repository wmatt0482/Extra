// A new year (SPEC v1.5 §5.2, screen #year): three steps, each one tap and a Back. WHERE: two cards, "The emigrant trail" (from Independence:
// "Oregon or California: you choose at Fort Hall") and "The Gold Road" (from your farm; while it is locked: "Reach the Willamette Valley to hear the
// news"). HOW HARD: three tier cards (Trail Blazer's cup cards: the name, the blurb, what changes in plain words, a locked card says how it opens;
// Parents → Options can keep it to Rookie, and then this step is skipped). WHO is the Outfit (the family wagon from the second journey on, the
// animals, three companions), which follows. The first journey ever skips the picker (the emigrant trail at Rookie), so a new child is on the trail
// as fast as 1.3. Every card has a Hear it button (the blurbs are read in the natural voice, prepared ahead: voiceTexts.js yearTexts).
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { TIERS } from '../content/tiers.js';
import { ROUTES } from '../content/routes.js';

/** What a tier changes, in plain words (SPEC v1.5 §3.2): shown on its card; the first line is the tier's own blurb. */
export const TIER_CHANGES = Object.freeze({
  rookie: [],
  veteran: ['Prices and problem numbers twice as big.', 'One more cold mountain leg to cross.'],
  pioneer: ['Prices and problem numbers four times as big.', 'Tired animals, a bonus card every leg, and double trade tokens.'],
});
export const WHERE_TITLE = 'Where to this year?';
export const HOW_TITLE = 'How hard a trail?';
export const WHERE_CARDS = Object.freeze({
  emigrant: { name: 'The emigrant trail', line: 'From Independence, Missouri. Oregon or California: you choose at Fort Hall.' },
  'gold-road': { name: 'The Gold Road', line: 'From your farm in the Willamette Valley, south to the gold diggings of California, and home by sea.' },
});
export const WHERE_LOCKED = 'Reach the Willamette Valley to hear the news';
/** The line a tier card says when it is read: its name, its blurb, what changes. */
export const tierSay = (t) => [`${t.name}.`, t.blurb, ...(TIER_CHANGES[t.id] || [])].join(' ');
/** Every line the picker may say (for the natural voice to prepare). */
export const yearTexts = () => [WHERE_TITLE, HOW_TITLE, ...Object.values(WHERE_CARDS).map((c) => `${c.name}. ${c.line}`), `${WHERE_CARDS['gold-road'].name}. ${WHERE_LOCKED}.`,
  ...TIERS.flatMap((t) => [tierSay(t), `${t.name}. ${t.opens || ''}`.trim()])];

export function createYearPicker(app) {
  const root = $('#screen-year');
  const body = $('#yr-body');
  const title = $('#yr-title');
  const back = $('#yr-back');
  const steps = $('#yr-steps');
  let step = 'where', pick = { route: 'emigrant', tier: 'rookie' }, info = null;

  function card({ id, kind, name, emoji, line, extra = [], locked = false, why = '', say, on = false }) {
    const hear = h('button', { class: 'btn btn-sm yr-hear', 'data-hear': id, 'data-sfx': '', 'aria-label': `Hear about ${name}` }, h('span', { html: app.icon('sound') }), 'Hear it');
    hear.addEventListener('click', (e) => { e.stopPropagation(); app.say(say); });
    const b = h('button', { class: `card yr-card ${kind}${locked ? ' locked' : ''}${on ? ' on' : ''}`, 'data-pick': id, 'data-sfx': '', 'aria-disabled': String(locked), 'aria-label': `${name}. ${locked ? why : line}` },
      h('span', { class: 'yr-emoji', 'aria-hidden': 'true' }, locked ? '🔒' : emoji || ''),
      h('span', { class: 'yr-name' }, name),
      h('span', { class: 'yr-line' }, locked ? why : line),
      ...(locked ? [] : extra.map((t) => h('span', { class: 'yr-extra' }, t))));
    b.addEventListener('click', () => choose(id, locked, why));
    return h('div', { class: 'yr-cell' }, b, hear);
  }
  function choose(id, locked, why) {
    if (locked) { app.say(why); app.toast(why); return; }
    if (step === 'where') {
      pick.route = id;
      if (info.chooseTier === false || !info.tiers.some((t) => t.id !== 'rookie' && t.open)) { pick.tier = 'rookie'; app.startYear(pick); return; }      // no harder tier to choose: on to the Outfit
      step = 'how'; paint();
    } else { pick.tier = id; app.startYear(pick); }
  }
  function paint() {
    if (!info) return;
    root.dataset.step = step;
    title.textContent = step === 'where' ? WHERE_TITLE : HOW_TITLE;
    $('#yr-year').textContent = `${info.year}`;
    steps.replaceChildren(...[['where', 'Where'], ['how', 'How hard'], ['who', 'Who']].map(([id, text], i) => h('span', { class: 'yr-step' + (step === id ? ' on' : ''), 'data-step': id }, `${i + 1}. ${text}`)));
    if (step === 'where') {
      body.replaceChildren(...info.routes.map((r) => card({ id: r.id, kind: 'where', name: (WHERE_CARDS[r.id] || {}).name || r.name, emoji: r.id === 'gold-road' ? '⛏️' : '🛤️', line: (WHERE_CARDS[r.id] || {}).line || '',
        locked: !r.open, why: r.id === 'gold-road' && !r.open && /Willamette/.test(r.why) ? WHERE_LOCKED : r.why, say: r.open ? `${(WHERE_CARDS[r.id] || {}).name}. ${(WHERE_CARDS[r.id] || {}).line}` : `${(WHERE_CARDS[r.id] || {}).name}. ${WHERE_LOCKED}.`, on: pick.route === r.id })));
    } else {
      body.replaceChildren(...info.tiers.map((t) => card({ id: t.id, kind: 'how', name: t.name, emoji: t.emoji, line: t.blurb, extra: TIER_CHANGES[t.id] || [], locked: !t.open, why: t.opens || '',
        say: t.open ? tierSay(t) : `${t.name}. ${t.opens || ''}`.trim(), on: pick.tier === t.id })));
    }
    if (app.screen === 'year') app.say(title.textContent);
  }
  back.addEventListener('click', () => { if (step === 'how') { step = 'where'; paint(); } else app.go('title'); });
  return {
    show(opts = {}) {
      info = app.yearInfo();
      step = opts.step || 'where';
      pick = { route: 'emigrant', tier: 'rookie', ...(opts.pick || {}) };
      paint();
    },
    hide() {},
    get step() { return step; },
    get pick() { return { ...pick }; },
  };
}

// Every line Wagon West can say that is known before it is said, in the order a child needs them (v1.3.2). main.js's
// prepareVoice() prepares exactly this list (leg first, in small batches); tools/content-audit.mjs compares it with every
// string the UI can speak. No DOM and no clock: pure, so Node can import it.
//
// What is NOT here is generated from the child's play and is prepared just in time, right before it is said (the voice waits
// for the clip, see speech.js `ready`): a word problem and its work lines (problemTexts), a mile marker's question for a
// fact the ladder picks (markerTexts, prepared per active fact by prepareVoice and again when shown), the P.S. with the
// week's three words, the letter's name under the closing, a letter line that tells a number of pounds, the daily
// challenge, the Derby result with its margin, the dog berries line with the dog's name, a riddle for a fact.
import { LOOKOUTS } from '../content/lookouts.js';
import { NATIONS, NATION_BY_ID, FALLBACK_TRADES, TRADE_GOOD_NAMES } from '../content/nations.js';
import { EVENTS } from '../content/events.js';
import { COMPANIONS } from '../content/companions.js';
import { CARDS, CARD_BY_ID } from '../content/cards.js';
import { PEOPLE_BY_STOP } from '../content/people.js';
import { LEGS, LEG_BY_ID, ANIMALS } from '../content/legs.js';
import { LETTER_LINES, LETTER_OPEN, LETTER_CLOSE } from '../content/letters.js';
import { FALLBACK_LINES } from '../journey/letters.js';
import { tradeLine, createJourney, startLeg, crossRiver } from '../journey/sim.js';
import { fractionsOf, fracName } from '../../../fraction-fright/src/skills/items.js';
import { riverChoiceTexts, riverTexts } from '../ui/river.js';
import { deedTexts } from '../ui/deeds.js';
import { sayOf } from '../ui/cards.js';
import { PS_INTRO, READ_BACK } from '../ui/postOffice.js';
import { spokenLine } from '../ui/problemPanel.js';

export const TEST_LINE = 'Wagon West is ready to roll.';
export const COACH_TEXT = 'The wagon rolls on its own. Pace and rations are your two dials. At each mile marker, type one fact. Tap the food box to look in the wagon. Stop any time: the journey waits right here.';
export const CAMP_EVENING = 'Make camp tonight? Fishing, a card game, a story by the fire, or a good rest.';
export const DOG_OFFER = 'A dog has been following the wagon. Keep it?';
export const RAFT_INTRO = 'The last stretch: a raft down the Columbia River to the Willamette Valley! Steer around the rocks. At every bend, answer a fact and the raft rolls on.';
export const RIVER_ACROSS = 'You are across the river.';
export const HUNT_FISH_ONLY = 'Fresh tracks by the trail, and a stream beside them. Get the fishing line out.';
export const HUNT_NO_ARROWS = 'Fresh tracks by the trail, but the quiver is empty. A creek runs right beside them: fishing only today. Arrows at the next fort!';
export const COVER_LINE = ' The canvas cover keeps everyone dry and cheerful.';
/** The fixed lines of the panels and the effects (the order matters: main.js reads [6] and [7]). */
export const FIXED_LINES = ['Now you: type the answer', 'Now you: type the answer from memory', 'Fixed it!', PS_INTRO, READ_BACK, TEST_LINE,
  CAMP_EVENING, DOG_OFFER,
  'A cold night. There are not enough blankets, so the party rests a day.', 'The oxen need a rest, so we go steady today.', 'The mules need a rest, so we go steady today.',
  'The wagon limps along slowly to the next fort.', 'A spare part is used.', 'The new part mends the wagon. No more limping.',
  'The raft is across!', 'You held them!', 'Pfft, dust everywhere!', COACH_TEXT, RAFT_INTRO, RIVER_ACROSS, HUNT_FISH_ONLY, HUNT_NO_ARROWS, 'Your turn!', 'Good game!'];

/** A line as the voice says it ("$56" → "56 dollars"; no doubled full stop after a comma or a full stop). */
export const spoken = (text) => spokenLine(text).replace(/([.!?])\.$/, '$1').replace(/[,;:]\.$/, '.');

/** A breakdown card's words: the event's line, then what the wagon can do about it (one source for main.js and the list). */
export function breakdownText(ev, have, free) {
  const what = ev.part || 'wheel';
  const trick = free === 'half' ? 'Tomas can make a part last twice as long.' : 'Ada knows a trick or two.';
  return `${ev.text || `Bump! The ${what} breaks.`} ${free === 'forge' && !have ? `There is no spare part, but ${trick}` : have ? `There is a spare part in the wagon.${free ? ` ${trick}` : ''}` : free ? `There is no spare part, but ${trick}` : 'There is no spare part in the wagon, so the wagon limps to the next fort.'}`;
}

const uniq = (list) => [...new Set(list.filter((t) => typeof t === 'string' && t.trim()))];
const animalNames = ANIMALS.map((a) => a.name.toLowerCase());

/** What the people at a stop say, and what they offer (the card's text for the talk, the gift, the trade). */
export function peopleTexts(stopId) {
  const out = [];
  for (const p of PEOPLE_BY_STOP[stopId] || []) {
    out.push(p.lines.join(' '));
    const g = p.gift;
    if (!g) continue;
    if (g.text) out.push(g.text);
    if (g.kind === 'trade') {
      // the card says the person's own line; when the wagon holds none of their goods, a sentence worked from a fallback offer
      for (const f of FALLBACK_TRADES) out.push(tradeLine({ rate: f.rate, giveName: f.giveName || TRADE_GOOD_NAMES[f.give], getName: f.getName || TRADE_GOOD_NAMES[f.get] }, p.name));
    }
  }
  return out;
}
/** Every letter line this leg's letter can be made of (the lines that tell a number of pounds are said just in time). */
export function letterTexts(legId, { names = null, animal = '', playerName = '' } = {}) {
  const leg = LEG_BY_ID[legId];
  if (!leg) return [];
  const nation = leg.nation && NATION_BY_ID[leg.nation];
  const comps = names && names.length ? names : COMPANIONS.map((c) => c.name);
  const out = [];
  const keys = new Set([...Object.keys(LETTER_LINES), ...Object.keys(FALLBACK_LINES)]);
  for (const k of keys) {
    const list = LETTER_LINES[k] && LETTER_LINES[k].length ? LETTER_LINES[k] : FALLBACK_LINES[k] || [];
    for (const line of list) {
      if (/\{food\}/.test(line)) continue;
      const fills = [{}];
      const vary = (name, values) => { const n = fills.splice(0); for (const f of n) for (const v of values) fills.push({ ...f, [name]: v }); };
      if (/\{name\}/.test(line)) vary('name', comps);
      if (/\{animal\}/.test(line)) vary('animal', animal ? [String(animal).toLowerCase()] : animalNames);
      const v0 = { stop: (leg.stop && leg.stop.name) || leg.name, river: (leg.stop && leg.stop.name) || 'river', width: (leg.river && leg.river.width) || 'wide', nation: nation ? nation.name : 'local' };
      for (const f of fills) out.push(spoken(String(line).replace(/\{(\w+)\}/g, (m, key) => (key in f ? f[key] : key in v0 ? v0[key] : ''))));
    }
  }
  for (const o of LETTER_OPEN) out.push(spoken(o));
  if (playerName) for (const c of LETTER_CLOSE || ['Love,']) out.push(spoken(`${c} ${playerName}`));
  return out;
}
/** The lines tied to one leg: its lookout, the nation's fact, the people and their offers, its landmark card, its letter. */
export function legTexts(legId, ctx = {}) {
  const leg = LEG_BY_ID[legId];
  const out = [];
  const look = LOOKOUTS[legId];
  if (look) out.push(look.say || look.text);
  const n = leg && leg.nation && NATION_BY_ID[leg.nation];
  if (n && n.fact) out.push(n.fact.say || n.fact.text);
  out.push(...peopleTexts(legId));
  if (CARD_BY_ID[legId]) out.push(sayOf(CARD_BY_ID[legId]));
  if (leg && ctx.letters !== false) out.push(...letterTexts(legId, ctx));
  return out;
}
/** Independence, the start town: its lookout and the people at the outfitter's. */
export const startTexts = () => [...(LOOKOUTS.independence ? [LOOKOUTS.independence.say || LOOKOUTS.independence.text] : []), ...peopleTexts('independence')];
/** What the river says in every way a crossing can end (worked by the journey itself, so the words are the journey's). */
export function riverResultTexts() {
  const out = [];
  for (const comps of [[], ['carpenter']]) {
    for (const rope of [0, 1]) {
      for (const flour of [null, 0]) {
        for (const [how, soaked, bumps] of [['ford', 0, 0], ['ford', 1, 0], ['float', 0, 0], ['float', 0, 1], ['ferry', 0, 0]]) {
          try {
            const J = createJourney({ seed: 1, companions: comps });
            startLeg(J, 'kansas-river');
            J.goods.rope = rope;
            if (flour !== null) J.foods.flour = flour;
            const r = crossRiver(J, { how, soaked, bumps });
            out.push(r.say || r.line);
          } catch (_) { /* a combination the journey does not allow */ }
        }
      }
    }
  }
  return out;
}
/** The lines of the trail itself: events (and their variants), companions (chatter, skills), cards, deeds, nations. */
export function trailTexts() {
  const out = [];
  for (const e of EVENTS) {
    const t = e.say || e.text;
    out.push(t, `${t}${COVER_LINE}`);
    if (e.kind === 'breakdown') for (const have of [true, false]) for (const free of ['', 'forge', 'half']) out.push(breakdownText(e, have, free));
  }
  for (const c of COMPANIONS) {
    const L = c.lines || {};
    out.push(...(L.trail || []), L.tired, L.happy);
    if (c.skill) out.push(`${c.name}: ${c.skill.text}`);
  }
  for (const c of CARDS) out.push(sayOf(c));
  for (const n of NATIONS) if (n.fact) out.push(n.fact.say || n.fact.text);
  out.push(...deedTexts());
  return out;
}
/** The river's own lines: the choice, the ford and float words, every landing sentence of the fractions in play, the results. */
export function riverLineTexts() {
  const out = [...riverChoiceTexts(), ...riverResultTexts()];
  for (const tier of ['T1', 'T2']) { try { for (const f of fractionsOf(tier)) out.push(...riverTexts(fracName(f.n, f.d))); } catch (_) { /* ignore */ } }
  return out;
}

/**
 * The list prepareVoice() asks for, in the order it is needed. `factTexts`: the markers' sentences for the child's active
 * facts (the caller works them out: they come from the child's own ladder).
 *   first  the fixed lines and the river (a card or a panel can open at any moment)
 *   leg    this leg: lookout, nation, people and their offers, landmark card, letter lines
 *   facts  the child's mile marker sentences
 *   next   the next leg's lookout, nation, people (its letter is prepared when that leg starts)
 *   rest   the trail's events, companions, cards, deeds, then every other leg
 */
export function collectVoiceTexts({ legId = LEGS[0].id, factTexts = [], names = null, animal = '', playerName = '' } = {}) {
  const idx = Math.max(0, LEGS.findIndex((l) => l.id === legId));
  const next = LEGS[idx + 1];
  const first = uniq([...FIXED_LINES, ...startTexts(), ...riverLineTexts()]);
  const leg = uniq(legTexts(legId, { names, animal, playerName }));
  const facts = uniq(factTexts);
  const nextT = next ? uniq(legTexts(next.id, { letters: false })) : [];
  const rest = uniq([...trailTexts(), ...LEGS.flatMap((l) => legTexts(l.id, { letters: false }))]);
  return { first, leg, facts, next: nextT, rest, ordered: uniq([...first, ...leg, ...facts, ...nextT, ...rest]) };
}
/** Everything that can be known ahead, across the whole trail (what the audit compares the UI's strings with). */
export function allVoiceTexts({ names = null, playerName = 'Mia' } = {}) {
  const out = [...FIXED_LINES, ...riverLineTexts(), ...trailTexts(), ...peopleTexts('independence'), ...(LOOKOUTS.independence ? [LOOKOUTS.independence.say || LOOKOUTS.independence.text] : [])];
  for (const l of LEGS) out.push(...legTexts(l.id, { names, playerName }));
  return uniq(out);
}

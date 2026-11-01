// Every line Wagon West can say that is known before it is said, in the order a child needs them (v1.3.2). main.js's
// prepareVoice() prepares exactly this list (leg first, in small batches); tools/content-audit.mjs compares it with every
// string the UI can speak. No DOM and no clock: pure, so Node can import it.
//
// What is NOT here is generated from the child's play and is prepared just in time, right before it is said (the voice waits
// for the clip, see speech.js `ready`): a word problem and its work lines (problemTexts), a mile marker's question for a
// fact the ladder picks (markerTexts, prepared per active fact by prepareVoice and again when shown), the P.S. with the
// week's three words, the letter's name under the closing, a letter line that tells a number of pounds, the daily
// challenge, the Derby result with its margin, the dog berries line with the dog's name, a riddle for a fact.
// v1.4 adds (SPEC v1.4 §5.6): `first` the moments' lines (MOMENTS), the bait and fishing lines and DOG_LINES filled with the
// dog's name (`dogName`); `leg` this leg's quest people (questTexts), trail facts (factTexts), the finds of its biome and the
// fish of its water; `rest` every find, piece of junk, wish, trail fact, quest line, companion help line (funTexts). Said just in
// time (never ahead, they have counts, sizes and names in them): the fishing summary and a catch with its inches, the treat
// counts, the skip count, the horseshoe sale, the trail fact's dog line when the dog is named later.
// v1.5 adds (SPEC v1.5 §5.8): `ALL_LEGS` (45 legs of every route, in the journey's own `plan` order when it is given) for the lookouts, the nations, the
// people and their gifts, the landmark cards and the letters of EVERY leg; the explainers and the fork lines (every way, the lean line, the 1849 line) in
// the leg before a fork (this leg when it is the fork's stop, or the next one); the creek's cue lines in the leg before a digging; the Gold Road's start;
// and, in the rest, the tier blurbs, the year picker, the family names, the farm's pieces (names, lines, facts), the card sets and their decorations, the
// gold cards, and the fixed lines of the new mini-games and screens (`V15`). `{farm}` letter openings and closings are made only once the farm is named
// (`farmName`). Said just in time (never ahead): the flake counts ("Seven flakes!"), the bank line, the farm's name plate line, the toll with its amount.
import { LOOKOUTS } from '../content/lookouts.js';
import { NATIONS, NATION_BY_ID, FALLBACK_TRADES, TRADE_GOOD_NAMES } from '../content/nations.js';
import { EVENTS } from '../content/events.js';
import { COMPANIONS } from '../content/companions.js';
import { CARDS, CARD_BY_ID, CARD_SETS, DECOR } from '../content/cards.js';
import { PEOPLE_BY_STOP } from '../content/people.js';
import { LEGS, ALL_LEGS, LEG_BY_ID, ANIMALS } from '../content/legs.js';
import { FORKS } from '../content/routes.js';
import { FAMILIES } from '../content/families.js';
import { LETTER_LINES, LETTER_OPEN, LETTER_CLOSE } from '../content/letters.js';
import { FALLBACK_LINES } from '../journey/letters.js';
import { tradeLine, createJourney, startLeg, crossRiver } from '../journey/sim.js';
import { fractionsOf, fracName } from '../../../fraction-fright/src/skills/items.js';
import { riverChoiceTexts, riverTexts } from '../ui/river.js';
import { deedTexts } from '../ui/deeds.js';
import { sayOf } from '../ui/cards.js';
import { PS_INTRO, READ_BACK } from '../ui/postOffice.js';
import { yearTexts } from '../ui/yearPicker.js';
import { FORK_FIRST, forkTexts } from '../ui/forkPanel.js';
import { diggingTexts } from '../ui/diggings.js';
import { farmTexts } from '../ui/homestead.js';
import { ROCK_ASK, ROCK_DONE } from '../ui/people.js';
import { spokenLine } from '../ui/problemPanel.js';
import { FINDS, WISHES } from '../content/finds.js';
import { FISH, JUNK, BAITS, WATERS } from '../content/fish.js';
import { MOMENTS, DOG_LINES } from '../content/moments.js';
import { QUESTS } from '../content/quests.js';
import { TRAIL_FACTS } from '../content/trailFacts.js';

export const TEST_LINE = 'Wagon West is ready to roll.';
export const COACH_TEXT = 'The wagon rolls on its own. Pace and rations are your two dials. At each mile marker, type one fact. Tap the food box to look in the wagon. Stop any time: the journey waits right here.';
export const CAMP_EVENING = 'Make camp tonight? Fishing, a card game, a story by the fire, or a good rest.';
export const DOG_OFFER = 'A dog has been following the wagon. Keep it?';
export const RAFT_INTRO = 'The last stretch: a raft down the Columbia River to the Willamette Valley! Steer around the rocks. At every bend, answer a fact and the raft rolls on.';
export const RIVER_ACROSS = 'You are across the river.';
export const HUNT_FISH_ONLY = 'Fresh tracks by the trail, and a stream beside them. Get the fishing line out.';
export const HUNT_NO_ARROWS = 'Fresh tracks by the trail, but the quiver is empty. A creek runs right beside them: fishing only today. Arrows at the next fort!';
export const COVER_LINE = ' The canvas cover keeps everyone dry and cheerful.';
/** v1.5's fixed lines (main.js reads them by name): the Pit Crew Check, the toll gate, a dry stretch, Laurel Hill, the voyage home and its cues. */
export const V15 = Object.freeze({
  PLACE_OFFER: "Before you answer questions, the pit crew checks what you've got. About 15 quick facts.",       // (the card's text; PLACE_SAY is what is said: numbers in words)
  PLACE_SAY: "Before you answer questions, the pit crew checks what you've got. About fifteen quick facts.",
  PLACE_DONE: 'The pit crew has what it needs. Now the questions fit you.',
  TOLL_SHORT: 'The purse is short, so the toll keeper writes an IOU, a promise to pay, and waves the wagon through.',
  TOLL_IOU_BUTTON: 'The toll keeper writes an IOU',
  TOLL_IOU: 'The toll keeper writes an IOU, a promise to pay, and waves the wagon through.',
  TOLL_PAID: 'The toll is paid, and the gate swings open.',
  DRY_BARREL: 'A dry stretch with no water. The water barrel keeps everyone going.',
  DRY_THIRSTY: 'A dry stretch with no water barrel on the wagon: everyone is thirsty and the animals tire. A water barrel helps.',
  SNUB_SMOOTH: 'Safe at the bottom, and everybody cheers!',
  SNUB_BUMPY: 'Bump, bump, bump! A cloud of dust, and everybody laughs.',
  SAIL_INTRO: 'Home by sea! The schooner sails up the coast from San Francisco to the Columbia River. Steer through the swells. At every marker, answer a fact and the schooner sails on.',
  STONES_TOP: 'As far as a stone can skip!',
  CUE_ROPE: 'Hold the rope!', CUE_LET: 'Let go!', CUE_COAST: 'Up the coast!', CUE_BAR: 'Over the bar!',
});
/** The fixed lines of the panels and the effects (the order matters: main.js reads [6] and [7]). */
export const FIXED_LINES = ['Now you: type the answer', 'Now you: type the answer from memory', 'Fixed it!', PS_INTRO, READ_BACK, TEST_LINE,
  CAMP_EVENING, DOG_OFFER,
  'A cold night. There are not enough blankets, so the party rests a day.', 'The oxen need a rest, so we go steady today.', 'The mules need a rest, so we go steady today.',
  'The wagon limps along slowly to the next fort.', 'A spare part is used.', 'The new part mends the wagon. No more limping.',
  'The raft is across!', 'You held them!', 'Pfft, dust everywhere!', COACH_TEXT, RAFT_INTRO, RIVER_ACROSS, HUNT_FISH_ONLY, HUNT_NO_ARROWS, 'Your turn!', 'Good game!',
  ...Object.values(V15).filter((t) => t !== V15.TOLL_IOU_BUTTON), FORK_FIRST, ROCK_ASK, ROCK_DONE];

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
  if (stopId === 'city-of-rocks') out.push(ROCK_ASK, ROCK_DONE);
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
export function letterTexts(legId, { names = null, animal = '', playerName = '', dogName = '', farmName = '' } = {}) {
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
      if (/\{farm\}/.test(line) && !farmName) continue;        // (v1.5: a line about the farm is made only once the farm is named)
      const fills = [{}];
      const vary = (name, values) => { const n = fills.splice(0); for (const f of n) for (const v of values) fills.push({ ...f, [name]: v }); };
      if (/\{dog\}/.test(line)) { if (!dogName) continue; vary('dog', [dogName]); }        // (a line about the dog is made only while there is a dog)
      if (/\{name\}/.test(line)) vary('name', comps);
      if (/\{animal\}/.test(line)) vary('animal', animal ? [String(animal).toLowerCase()] : animalNames);
      const v0 = { stop: (leg.stop && leg.stop.name) || leg.name, river: (leg.stop && leg.stop.name) || 'river', width: (leg.river && leg.river.width) || 'wide', nation: nation ? nation.name : 'local', farm: farmName || 'home' };
      for (const f of fills) out.push(spoken(String(line).replace(/\{(\w+)\}/g, (m, key) => (key in f ? f[key] : key in v0 ? v0[key] : ''))));
    }
  }
  const farmy = (t) => /\{farm\}/.test(t);
  const withFarm = (t) => String(t).replace(/\{farm\}/g, farmName);
  for (const o of LETTER_OPEN) if (!farmy(o) || farmName) out.push(spoken(withFarm(o)));
  if (playerName) for (const c of LETTER_CLOSE || ['Love,']) if (!farmy(c) || farmName) out.push(spoken(withFarm(`${c} ${playerName}`)));
  return out;
}
// ---------- v1.4: the dog, the finds, the fish, the quests and the trail facts ----------
const sayOrText = (x) => (x ? x.say || x.text || '' : '');
/** Every spoken line in a tree of `{ text, say }` leaves, strings and arrays (the content's MOMENTS). */
function leafLines(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => leafLines(x, out));
  else if (v && typeof v === 'object') {
    if (typeof v.text === 'string' || typeof v.say === 'string') out.push(sayOrText(v));
    else Object.values(v).forEach((x) => leafLines(x, out));
  }
  return out;
}
/** A line that names the dog, made with the dog's name. */
export const dogFill = (t, dogName) => String(t).replace(/\{dog\}/g, dogName);
/** The fixed lines of the dog, fetch, fishing and the trail moments (MOMENTS) and the bait lines. */
export function momentTexts() { return [...leafLines(MOMENTS), ...BAITS.map((b) => b.text)]; }
/** The lines that name the dog (DOG_LINES), with the dog's name; none until there is a dog. */
export function dogTexts(dogName = '') { return dogName ? Object.values(DOG_LINES).map((t) => dogFill(t, dogName)) : []; }
/** What a find, a piece of junk or a wish is read as. */
export const findSay = (f) => sayOrText(f);
/** The finds of a biome (every find for `null` biomes). */
const findsOf = (biome) => FINDS.filter((f) => !f.biomes || f.biomes.includes(biome));
/** The trail facts of a leg (a fact with `legs: null` can come on any leg), as read: the fact's `say` else its text. */
function factTextsOf(legId) { return TRAIL_FACTS.filter((f) => !f.legs || f.legs.includes(legId)).map(sayOrText); }
/** What the people of a quest say at one stop (every step and the owner there, joined as the Talk card reads them), the item's text
 *  where it can be found, and the mailed line at the forts after the owner's stop. */
export function questTexts(stopId) {
  const out = [];
  const idx = ALL_LEGS.findIndex((l) => l.id === stopId);
  for (const q of QUESTS) {
    for (const st of q.steps || []) if (st.at === stopId) out.push((st.lines || []).join(' '));
    if (q.owner && q.owner.at === stopId) out.push((q.owner.lines || []).join(' '));
    const f = q.find || {};
    if (q.item && ((f.legs || []).includes(stopId) || f.atStop === stopId)) out.push(sayOrText(q.item));
    const oi = q.owner ? ALL_LEGS.findIndex((l) => l.id === q.owner.at) : -1;
    if (q.mailed && oi >= 0 && idx > oi && ALL_LEGS[idx].stop && ALL_LEGS[idx].stop.kind === 'fort') out.push(sayOrText(q.mailed));
  }
  return out.filter(Boolean);
}
/** The trail facts that can come on a leg. */
export const factTexts = factTextsOf;
/** The fish of a leg's water (their landing lines), the junk it can bring up, and the finds of its biome. */
export function legFunTexts(legId) {
  const leg = LEG_BY_ID[legId];
  const water = WATERS[legId];
  const out = [];
  for (const f of FISH) if (water && f.waters && f.waters[water]) out.push(sayOrText(f.land), CARD_BY_ID[f.card] ? sayOf(CARD_BY_ID[f.card]) : '');
  for (const j of JUNK) if (!j.waters || (water && j.waters.includes(water))) out.push(sayOrText(j));
  if (leg) out.push(...findsOf(leg.biome).map(findSay));
  return out;
}
/** Everything the dog, the water and the trail can say that is not tied to one leg: every find, junk, wish, trail fact, quest line,
 *  fish landing line and companion help line (the rest of the list). */
export function funTexts() {
  const out = [...FINDS.map(findSay), ...JUNK.map(findSay), ...WISHES.map(findSay), ...TRAIL_FACTS.map(sayOrText), ...FISH.map((f) => sayOrText(f.land))];
  for (const q of QUESTS) out.push(...questTexts(q.owner.at), ...(q.steps || []).map((st) => (st.lines || []).join(' ')), (q.owner.lines || []).join(' '), sayOrText(q.item), sayOrText(q.mailed));
  for (const c of COMPANIONS) if (c.lines && c.lines.help) out.push(c.lines.help);
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
  out.push(...questTexts(legId), ...factTextsOf(legId), ...legFunTexts(legId));          // (v1.4)
  if (ctx.forks !== false) for (const f of Object.values(FORKS)) if (f.at === legId) out.push(...forkTexts(f.id));            // (v1.5: the fork at this stop)
  if (leg && leg.gold && ctx.forks !== false) out.push(...diggingTexts());                                                     // (v1.5: the creek's cue lines)
  if (leg && ctx.letters !== false) out.push(...letterTexts(legId, ctx));
  return out;
}
/** Independence, the start town: its lookout and the people at the outfitter's. */
export const startTexts = () => [...(LOOKOUTS.independence ? [LOOKOUTS.independence.say || LOOKOUTS.independence.text] : []), ...(LOOKOUTS['gold-news'] ? [LOOKOUTS['gold-news'].say || LOOKOUTS['gold-news'].text] : []), ...peopleTexts('independence')];
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
/** v1.5's screens: the year picker (where, how hard: the tier blurbs), the family names, the farm's pieces, the card sets and the wagon decorations, the creek. */
export function longTrailTexts() {
  const out = [...yearTexts(), ...farmTexts(), ...diggingTexts(), ...FAMILIES.map((f) => f.name), ...DECOR.map((d) => d.name)];
  for (const st of CARD_SETS) out.push(st.say, st.name);
  for (const f of Object.values(FORKS)) out.push(...forkTexts(f.id));
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
 *   facts  the child's mile marker sentences (`factTexts`; v1.4: the trail facts are `factTexts(legId)` below, in `leg`)
 *   next   the next leg's lookout, nation, people (its letter is prepared when that leg starts)
 *   rest   the trail's events, companions, cards, deeds, then every other leg
 */
export function collectVoiceTexts({ legId = LEGS[0].id, plan = null, farmName = '', factTexts: markerFacts = [], names = null, animal = '', playerName = '', dogName = '' } = {}) {
  // the next leg: in the journey's own plan when it is given (a branch, California, the Gold Road), else in the order the legs are written
  const ids = Array.isArray(plan) && plan.length ? plan : null;
  const pi = ids ? ids.indexOf(legId) : -1;
  const nextId = pi >= 0 ? ids[pi + 1] : (() => { const i = ALL_LEGS.findIndex((l) => l.id === legId); return i >= 0 ? (ALL_LEGS[i + 1] || {}).id : null; })();
  const next = nextId ? LEG_BY_ID[nextId] : null;
  const first = uniq([...FIXED_LINES, ...startTexts(), ...riverLineTexts(), ...momentTexts(), ...dogTexts(dogName)]);
  const leg = uniq(legTexts(legId, { names, animal, playerName, dogName, farmName }));
  const facts = uniq(markerFacts);
  const nextT = next ? uniq(legTexts(next.id, { letters: false })) : [];
  const rest = uniq([...trailTexts(), ...longTrailTexts(), ...ALL_LEGS.flatMap((l) => legTexts(l.id, { letters: false })), ...funTexts()]);
  return { first, leg, facts, next: nextT, rest, ordered: uniq([...first, ...leg, ...facts, ...nextT, ...rest]) };
}
/** Everything that can be known ahead, across the whole trail (what the audit compares the UI's strings with). */
export function allVoiceTexts({ names = null, playerName = 'Mia', dogName = '', farmName = 'Rose Hill' } = {}) {
  const out = [...FIXED_LINES, ...riverLineTexts(), ...trailTexts(), ...peopleTexts('independence'), ...(LOOKOUTS.independence ? [LOOKOUTS.independence.say || LOOKOUTS.independence.text] : []), ...momentTexts(), ...dogTexts(dogName), ...funTexts()];
  for (const l of ALL_LEGS) out.push(...legTexts(l.id, { names, playerName, dogName, farmName }));
  out.push(...longTrailTexts());
  return uniq(out);
}

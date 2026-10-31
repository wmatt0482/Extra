// Letters home (SPEC §3 "Letters home", §10): the Post Office letter is a short story of the leg the child just
// played, then the P.S. with the week's three spelling words (each dictated on the spell panel). The three narrative
// lines come from what actually happened on the leg (the events that fired, a hunt or a catch that brought food, a
// trade, the river, how the party feels, the arrival), never from things that did not, so the letter reads back as
// the child's own trip. The line variants live in src/content/letters.js; the choice among them is seeded by the
// journey and the leg, so composing the same letter twice gives the same text.
import { LETTER_LINES, LETTER_PS, LETTER_OPEN, LETTER_CLOSE } from '../content/letters.js';
import { COMPANION_BY_ID } from '../content/companions.js';
import { EVENT_BY_ID } from '../content/events.js';
import { animalOf, legOf, nationFor } from './route.js';
import { hashSeed } from './rng.js';

/** Letters kept on the journey (the save keeps its own journal too). */
export const LETTERS_KEPT = 36;

// v1.2 fallbacks: lines for what the content's LETTER_LINES (src/content/letters.js) does not know yet. Keyed by the same
// kind of key: how the river was crossed ('ford' | 'float' | 'ferry', and '-wet' when a sack of flour was soaked), the new
// breakdowns, the snow, the stampede, and 'limp' for a breakdown with no spare part. The content's own lines win when it
// ever adds the same key (lineSource). No claims the game cannot know: the ferry line does not say how the words went.
export const FALLBACK_LINES = {
  ford: [
    'We forded the {river} on the calm beat, and I held my breath the whole way.',
    'Splish, splash! We drove the wagon right through the {river}.',
    'The {river} was {width}, but we picked our moment and rolled across with dry feet.',
  ],
  'ford-wet': [
    'We forded the {river}, but a wave soaked one sack of flour. The rest stayed dry.',
    'Splash! The {river} got into a sack of flour on the way over, but everything else was fine.',
  ],
  float: [
    'We floated across the {river} on a raft, and I helped steer with the long pole.',
    'Whoosh! The raft carried our wagon over the {river} without losing a thing.',
    'We floated over the {river} on a raft, and nothing got wet.',
  ],
  'float-wet': [
    'We floated across the {river}, but a bump soaked a sack of flour.',
    'Our raft bumped a rock in the {river}, and one sack of flour got wet.',
  ],
  ferry: [
    'The ferryman took us across the {river}, and I paid the fare in spelling words.',
    'We rode the ferry over the {river}. The fare was my spelling words, which is the best price I ever paid.',
    'The ferry across the {river} cost three spelling words and not one penny.',
  ],
  axle: [
    'Crack! The axle gave way on a rocky stretch, and {name} fixed it right up.',
    'Our axle split on the rocks. {name} put in a new one while I held the tools.',
  ],
  tongue: [
    'Snap! The wagon tongue split in two, and {name} put in a new pole.',
    'The long pole that holds the team broke in half, but {name} had it mended by supper.',
  ],
  snow: [
    'Snow fell in the night, so we stayed wrapped in our blankets until the sun came out.',
    'We woke up to snow! Everybody pulled the blankets up to their chins and waited for the sun.',
  ],
  stampede: [
    'A whole herd of bison thundered past the wagon, and the ground shook under my feet.',
    'Stampede! The bison ran by in a cloud of dust, and I held on to my hat.',
  ],
  limp: [
    'We had no spare part, so the wagon limped along slowly until the next fort.',
    'Something on the wagon broke and we had no spare, so we crept along slowly. Next time we will pack more parts.',
  ],
};
/** The lines for a key: the content's LETTER_LINES first, else the fallbacks above, else none. */
export const lineSource = (key) => (LETTER_LINES[key] && LETTER_LINES[key].length ? LETTER_LINES[key] : FALLBACK_LINES[key] || []);
const pickSeeded = (list, ...parts) => (Array.isArray(list) && list.length ? list[hashSeed(...parts) % list.length] : '');
const titleCase = (id) => String(id || '').replace(/(^|-)(\w)/g, (m, d, c) => (d ? ' ' : '') + c.toUpperCase());
const nameOf = (id) => (COMPANION_BY_ID[id] && COMPANION_BY_ID[id].name) || titleCase(id);
// who the line is about: the companion whose job fits, else the first one
const WHO = { wheel: ['blacksmith', 'carpenter'], axle: ['blacksmith', 'carpenter'], tongue: ['carpenter', 'blacksmith'], hunt: ['scout'], fish: ['cook', 'scout'], berries: ['cook'], mud: ['blacksmith'] };
function companionFor(J, key) {
  const kind = (EVENT_BY_ID[key] && EVENT_BY_ID[key].kind) || key;
  const want = (WHO[key] || WHO[kind] || []).find((id) => J.companions.includes(id));
  return nameOf(want || J.companions[0] || 'scout');
}

/** The keys of LETTER_LINES that happened on this leg, in letter order (most particular first). legEvents: the event
 *  ids (or tickDay event objects) of the leg; defaults to the leg's own log. A hunt or a catch counts only when it
 *  brought food back; the mood line is how the party feels now (or a hard stretch, if it was tired on the way). */
export function happenedKeys(J, legEvents) {
  const t = J.trip || {};
  const leg = legOf(J.legId);
  const ids = (Array.isArray(legEvents) ? legEvents : t.happened || []).map((e) => (e && typeof e === 'object' ? e.id : e)).filter(Boolean);
  const keys = [];
  const add = (k) => { if (k && lineSource(k).length && !keys.includes(k)) keys.push(k); };
  const kinds = new Set();
  for (const id of ids) {
    const e = EVENT_BY_ID[id];
    const kind = e ? e.kind : id;
    if (['hunt', 'fish', 'trade'].includes(kind) && kinds.has(kind)) continue;   // one hunting line, however many hunts
    // a hunt or a catch is only a line when it brought food back; a trade only where a nation trades
    if (kind === 'hunt' && !(J.legStats.hunted > 0)) continue;
    if (kind === 'fish' && !(J.legStats.fished > 0)) continue;
    if (kind === 'trade' && !(nationFor(leg) && t.traded > 0)) continue;
    // lines are keyed by event id; fall back to the kind's key ('hunt', 'fish', 'trade') when the id has none; a breakdown
    // with no spare part is the 'limp' line, whichever part it was
    const before = keys.length;
    add(kind === 'breakdown' && t.limped ? 'limp' : lineSource(id).length ? id : kind);
    if (keys.length > before) kinds.add(kind);
  }
  // the river: how it was crossed (and whether a sack got wet) when the app told the sim, else the plain river line
  if (leg && leg.stop && leg.stop.kind === 'river' && t.arrived) {
    const rv = t.river;
    if (rv && rv.how) add(rv.soakedLb > 0 && lineSource(`${rv.how}-wet`).length ? `${rv.how}-wet` : rv.how);
    if (!keys.some((k) => ['ford', 'ford-wet', 'float', 'float-wet', 'ferry'].includes(k))) add('river');
  }
  if (J.mood === 'happy' || (t.seen && t.seen.happy && !t.seen.tired)) add('happy');
  else if (J.mood === 'tired' || (t.seen && t.seen.tired)) add('tired');
  return keys;
}

// fill {stop} {river} {width} {animal} {name} {food} {nation}
function fill(line, J, key) {
  const leg = legOf(J.legId) || {};
  const nation = nationFor(leg);
  const kind = (EVENT_BY_ID[key] && EVENT_BY_ID[key].kind) || key;
  const food = kind === 'hunt' ? J.legStats.hunted : kind === 'fish' ? J.legStats.fished : (EVENT_BY_ID[key] && EVENT_BY_ID[key].foodLb) || 20;
  const v = {
    stop: (leg.stop && leg.stop.name) || leg.name || 'the next stop', river: (leg.stop && leg.stop.name) || 'river',
    width: (leg.river && leg.river.width) || 'wide', animal: animalOf(J.animal).name.toLowerCase(), name: companionFor(J, key),
    food, nation: nation ? nation.name : 'local',
  };
  return String(line).replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : ''));
}
const wordOf = (w) => String(w && typeof w === 'object' ? w.word || w.text || '' : w || '').trim();
// "a", "a and b", "a, b and c" for the P.S. when the week has fewer than three words
function psFor(words) {
  const ws = (words || []).map(wordOf).filter(Boolean).slice(0, 3);
  if (ws.length === 3) return LETTER_PS.replace('{w1}', ws[0]).replace('{w2}', ws[1]).replace('{w3}', ws[2]);
  const list = ws.length === 2 ? `${ws[0]} and ${ws[1]}` : ws[0] || '';
  return LETTER_PS.replace(/\{w1\}, \{w2\} and \{w3\}/, list).replace(/\{w\d\}/g, list);
}

/** The letter for this leg: { opening, lines: [3 lines], ps, close, text, keys } (keys: the LETTER_LINES keys used,
 *  so a test or the journal can tell what each line is about). The arrival line comes first, then two things that
 *  happened; a leg with little to tell uses the other arrival wording rather than invent anything. The app appends
 *  the child's name under the closing. */
export function composeLetter(J, legEvents, words = []) {
  const t = J.trip || {};
  const legId = J.legId || '';
  const seed = [J.seed, legId, J.legStarts];
  const hk = happenedKeys(J, legEvents);
  const arrivedOk = !!t.arrived && LETTER_LINES.arrived && LETTER_LINES.arrived.length;
  const picked = [];
  if (arrivedOk) picked.push({ key: 'arrived', line: pickSeeded(LETTER_LINES.arrived, ...seed, 'arrived') });
  for (const k of hk) if (picked.length < 3) picked.push({ key: k, line: pickSeeded(lineSource(k), ...seed, k) });
  if (arrivedOk && picked.length < 3) {
    const other = LETTER_LINES.arrived.find((l) => !picked.some((p) => p.line === l));
    if (other) picked.push({ key: 'arrived', line: other });
  }
  const lines = picked.map((p) => fill(p.line, J, p.key));
  const opening = pickSeeded(LETTER_OPEN, ...seed, 'open');
  const close = pickSeeded(LETTER_CLOSE || ['Love,'], ...seed, 'close');
  const ps = psFor(words);
  const text = [opening, lines.join(' '), ps, close].filter(Boolean).join('\n');
  return { opening, lines, ps, close, text, keys: picked.map((p) => p.key) };
}

/** Keep a finished letter on the journey (the last LETTERS_KEPT): { legId, day, text }. */
export function keepLetter(J, letter) {
  const text = typeof letter === 'string' ? letter : letter && letter.text;
  if (!text) return J.letters;
  J.letters.push({ legId: J.legId, day: J.day, text });
  if (J.letters.length > LETTERS_KEPT) J.letters.splice(0, J.letters.length - LETTERS_KEPT);
  return J.letters;
}

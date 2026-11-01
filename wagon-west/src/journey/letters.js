// Letters home (SPEC §3 "Letters home", §10): the Post Office letter is a short story of the leg the child just
// played, then the P.S. with the week's three spelling words (each dictated on the spell panel). The three narrative
// lines come from what actually happened on the leg (the events that fired, a hunt or a catch that brought food, a
// trade, the river, how the party feels, the arrival), never from things that did not, so the letter reads back as
// the child's own trip. The line variants live in src/content/letters.js; the choice among them is seeded by the
// journey and the leg, so composing the same letter twice gives the same text.
// v1.5: a letter tells the legs since the last letter (J.letterFrom → the current leg; a post is not at every stop): it picks the liveliest lines across them (a fork, a toll, a digging,
// a river, a quest, an event, the stop's own line `stop:<legId>`), and opens with the farm's name once there is a farm ({farm}).
import { LETTER_LINES, LETTER_PS, LETTER_OPEN, LETTER_CLOSE, LETTER_FARM, LETTER_GOLD } from '../content/letters.js';
import { COMPANION_BY_ID } from '../content/companions.js';
import { EVENT_BY_ID } from '../content/events.js';
import { animalOf, legOf, nationFor, usePlan } from './route.js';
import { hashSeed } from './rng.js';
import { questLetterKeys } from './quests.js';

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
  for (const k of Array.isArray(t.keys) ? t.keys : []) add(k);       // v1.5: what the sim noted (a fork chosen, the toll, a pan, a sail, a dry stretch)
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
  // v1.4: a side quest given back (or mailed) on this leg has its own line
  for (const k of questLetterKeys(J, J.legId)) add(k);
  if (J.mood === 'happy' || (t.seen && t.seen.happy && !t.seen.tired)) add('happy');
  else if (J.mood === 'tired' || (t.seen && t.seen.tired)) add('tired');
  return keys;
}

// fill {stop} {river} {width} {animal} {name} {food} {nation} {dog} (v1.4: the dog's name, so a line can say "Frodo found an old horseshoe")
function fill(line, J, key, legId = null, farm = '') {
  const leg = legOf(legId || J.legId) || {};
  const nation = nationFor(leg);
  const kind = (EVENT_BY_ID[key] && EVENT_BY_ID[key].kind) || key;
  const food = kind === 'hunt' ? J.legStats.hunted : kind === 'fish' ? J.legStats.fished : (EVENT_BY_ID[key] && EVENT_BY_ID[key].foodLb) || 20;
  const v = {
    stop: (leg.stop && leg.stop.name) || leg.name || 'the next stop', river: (leg.stop && leg.stop.name) || 'river',
    width: (leg.river && leg.river.width) || 'wide', animal: animalOf(J.animal).name.toLowerCase(), name: companionFor(J, key),
    food, nation: nation ? nation.name : 'local', dog: (J.dog && J.dog.name) || 'the dog', farm: farm || 'home',
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

/** How lively a letter key is (lower = livelier) when a letter has more to tell than three lines: a fork, then a toll, Laurel Hill, a dry stretch or gold, a river,
 *  a quest, an event, the stop's own line, then how the party feels. */
function rankOf(key) {
  if (/^fork-/.test(key) || ['sublette', 'lander', 'barlow'].includes(key)) return 0;
  if (['toll', 'laurel-hill', 'dry', 'pan', 'nugget', 'rocker', 'sail', 'bar'].includes(key)) return 1;
  if (['ford', 'ford-wet', 'float', 'float-wet', 'ferry', 'river'].includes(key)) return 2;
  if (/^stop:/.test(key)) return 5;
  if (['happy', 'tired'].includes(key)) return 6;
  return 3;
}
const withFarm = (list, farm) => (farm ? list : list.filter((l) => !/\{farm\}/.test(l)));
/** The Gold Road's closing ('Home soon, with gold!') is for the way home only: on the Gold Road once gold has been found or the party is at Coloma or later.
 *  Any other letter (an emigrant trail, the Gold Road before its first flake) never closes with it. */
function goldWayHome(J) {
  if (!J || J.route !== 'gold-road') return false;
  if ((J.gold | 0) > 0) return true;
  const ids = (Array.isArray(J.plan) ? J.plan : []).map((p) => p && p.id);
  const at = ids.indexOf('coloma');
  return at >= 0 && (J.legIndex | 0) >= at;
}
const goldCloses = (J) => (goldWayHome(J) ? [] : (LETTER_GOLD && Array.isArray(LETTER_GOLD.close) ? LETTER_GOLD.close : ['Home soon, with gold!']));
const notGold = (list, J) => { const g = goldCloses(J); return g.length ? list.filter((l) => !g.includes(l)) : list; };
/** Opening and closing: the lines with {farm} only once there is a farm (a later emigrant journey and the Gold Road write to the people at the farm). */
function openingFor(J, farm, seed) {
  const all = Array.isArray(LETTER_OPEN) ? LETTER_OPEN : [];
  const farmy = farm ? (LETTER_FARM && LETTER_FARM.open ? LETTER_FARM.open : all.filter((l) => /\{farm\}/.test(l))) : [];
  const gold = (J.route === 'gold-road') ? (LETTER_GOLD && LETTER_GOLD.open ? LETTER_GOLD.open : farmy.filter((l) => /family at/.test(l))) : [];
  const pool = gold.length ? gold : (farm && ((J.journeyN | 0) > 1 || J.route === 'gold-road') && farmy.length) ? farmy : withFarm(all, '');
  return pickSeeded(pool.length ? pool : all, ...seed, 'open');
}

/** The letter for this leg: { opening, lines: [3 lines], ps, close, text, keys } (keys: the LETTER_LINES keys used,
 *  so a test or the journal can tell what each line is about). The arrival line comes first, then two things that
 *  happened; a leg with little to tell uses the other arrival wording rather than invent anything. The app appends
 *  the child's name under the closing. v1.5: the letter tells the legs since the last one (J.letterFrom → the current leg): the arrival line, then the two liveliest things
 *  across them in the order they happened; then J.letterFrom moves on (composing the same letter again gives the same text). `ctx.farm` is the farm's name ('' = no farm yet). */
export function composeLetter(J, legEvents, words = [], ctx = {}) {
  usePlan(J);
  const t = J.trip || {};
  const farm = (ctx && ctx.farm) || '';
  const legId = J.legId || '';
  const cur = J.legIndex | 0;
  const memo = J.letterMemo && J.letterMemo.idx === cur ? J.letterMemo : null;
  const from = Math.min(memo ? memo.from : (J.letterFrom | 0), cur);
  const seed = [J.seed, legId, J.legStarts];
  const hk = happenedKeys(J, legEvents);
  const past = (Array.isArray(J.tale) ? J.tale : []).filter((e) => e && e.idx >= from && e.idx < cur);
  const arrivedOk = !!t.arrived && LETTER_LINES.arrived && LETTER_LINES.arrived.length;
  const picked = [];
  if (arrivedOk) picked.push({ key: 'arrived', legId, line: pickSeeded(LETTER_LINES.arrived, ...seed, 'arrived') });
  const stopKey = `stop:${legId}`;
  if (!past.length) {
    // one leg to tell: its events in the order they happened, then (only if there is room) the stop's own line
    for (const k of hk) if (picked.length < 3) picked.push({ key: k, legId, line: pickSeeded(lineSource(k), ...seed, k) });
    if (picked.length < 3 && lineSource(stopKey).length) picked.push({ key: stopKey, legId, line: pickSeeded(lineSource(stopKey), ...seed, stopKey) });
  } else {
    // several legs: the two liveliest things across them (one line per key), told in the order they happened
    const cand = [];
    const pushKeys = (keys, lid, idx) => keys.forEach((k, order) => cand.push({ key: k, legId: lid, idx, rank: rankOf(k), order }));
    for (const e of past) pushKeys([...(Array.isArray(e.keys) ? e.keys : []), ...(lineSource(`stop:${e.legId}`).length ? [`stop:${e.legId}`] : [])], e.legId, e.idx);
    pushKeys([...hk, ...(lineSource(stopKey).length ? [stopKey] : [])], legId, cur);
    cand.sort((x, y) => x.rank - y.rank || y.idx - x.idx || x.order - y.order);
    const chosen = [], keysSeen = new Set();
    for (const c of cand) { if (chosen.length >= 2) break; const k = c.key.startsWith('stop:') ? c.key : c.key; if (keysSeen.has(k) || !lineSource(c.key).length) continue; keysSeen.add(k); chosen.push(c); }
    chosen.sort((x, y) => x.idx - y.idx || x.order - y.order);
    for (const c of chosen) picked.push({ key: c.key, legId: c.legId, line: pickSeeded(lineSource(c.key), J.seed, c.legId, J.legStarts, c.key) });
  }
  if (arrivedOk && picked.length < 3) {
    const other = LETTER_LINES.arrived.find((l) => !picked.some((p) => p.line === l));
    if (other) picked.push({ key: 'arrived', legId, line: other });
  }
  const lines = picked.map((p) => fill(p.line, J, p.key, p.legId, farm));
  const opening = fill(openingFor(J, farm, seed), J, 'open', legId, farm);
  const closes = notGold(withFarm(Array.isArray(LETTER_CLOSE) && LETTER_CLOSE.length ? LETTER_CLOSE : ['Love,'], farm), J);
  const close = fill(pickSeeded(closes, ...seed, 'close'), J, 'close', legId, farm);
  const ps = psFor(words);
  const text = [opening, lines.join(' '), ps, close].filter(Boolean).join('\n');
  J.letterMemo = { idx: cur, from };
  J.letterFrom = cur + 1;
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

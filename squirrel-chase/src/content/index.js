// Pip's Squirrel Chase content (v0.1, the New York tour). Stable contract for the app and art: docs/CONTENT-GUIDE.md.
// Every export is plain, deep-frozen data. All text here is read silently (SPEC §2); nothing in this folder is voiced.
//
// @typedef {{ text: string, source: string }} Fact                       – kid-friendly fact + http(s) source (docs/SOURCES.md)
// @typedef {{ id: string, text: string, fact?: number, source?: string }} Clue
//          – a sealed-note line pointing TO its city; rests on facts[fact] or on its own `source`
// @typedef {{ id: string, name: string, latLng: { lat: number, lng: number }, coords: { x: number, y: number },
//             facts: Fact[], sign: string, scene: string, clues: Clue[] }} City
//          – coords are 0..1 on the NY map box (MAP_BOUNDS); x west->east, y north->south
// @typedef {{ name: string, hex: string }} Colour
// @typedef {{ id: string, name: string, animal: string, pronoun: 'she'|'he', role: 'leader'|'member', personality: string,
//             reason: string, catchphrase: string, colour: Colour, look: string, apology: string }} GangMember
// @typedef {{ city: string, text: string, swiped: number[], letters: string, word: string|null, gaps: string }} CaseSign
//          – swiped: indexes into text, in recovery order (one per correct travel, the rest at the hideout);
//            gaps: text with '_' at each swiped index
// @typedef {{ who: 'chief'|'pip'|'wen', text: string }} BriefingLine
// @typedef {{ name: string, role: string, line: string, clueId: string|null, note: string }} Witness
//          – line frames the sealed note; note is the text revealed after the word is spelled
//            (clueId = the next city's clue at travel stops; null at the hideout city)
// @typedef {{ city: string, witnesses: [Witness, Witness] }} Stop
// @typedef {{ who: string, text: string }} GangLine                        – who = a GangMember id
// @typedef {{ city: string, place: string, description: string, gangLines: GangLine[] }} Hideout
// @typedef {{ city: string, facts: [Fact, Fact] }} Postcard
// @typedef {{ id: string, arc: string, order: number, title: string, lead: string, crew: string[], sign: CaseSign,
//             briefing: BriefingLine[], route: string[], stops: Stop[], hideout: Hideout, postcard: Postcard,
//             teaser: string }} Case
//          – route[i] === stops[i].city; route[0] = the sign's city; last = hideout city
// @typedef {{ id: string, title: string, blurb: string, cases: string[] }} Arc
// @typedef {{ id: string, text: string, slots: ('noun'|'any')[] }} HideoutTemplate
import { CITIES as cities } from './cities.js';
import { CASES as cases } from './cases.js';
import { GANG as gang } from './gang.js';
import { ARCS as arcs } from './arcs.js';
import { HIDEOUT_TEMPLATES as templates } from './templates.js';
export { MAP_BOUNDS, toMap } from './geo.js';

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
}

/** @type {readonly City[]} */
export const CITIES = deepFreeze(cities);
/** @type {readonly Case[]} */
export const CASES = deepFreeze(cases);
/** @type {readonly GangMember[]} */
export const GANG = deepFreeze(gang);
/** @type {readonly Arc[]} */
export const ARCS = deepFreeze(arcs);
/** @type {readonly HideoutTemplate[]} */
export const HIDEOUT_TEMPLATES = deepFreeze(templates);

const byId = (list) => Object.freeze(Object.fromEntries(list.map((x) => [x.id, x])));
/** @type {Readonly<Record<string, City>>} */
export const CITY_BY_ID = byId(CITIES);
/** @type {Readonly<Record<string, Case>>} */
export const CASE_BY_ID = byId(CASES);
/** @type {Readonly<Record<string, GangMember>>} */
export const GANG_BY_ID = byId(GANG);
/** @type {Readonly<Record<string, Clue & { city: string }>>} */
export const CLUE_BY_ID = Object.freeze(Object.fromEntries(CITIES.flatMap((c) => c.clues.map((k) => [k.id, Object.freeze({ ...k, city: c.id })]))));

// The ONE place that reads src/content/index.js (SPEC §5) and turns it into what the screens need: cities by id, the cases in
// order, a case's stops (a city and two witnesses each, every witness's text clue), its sign with the gaps, its hideout and its
// postcard. It tolerates the usual spellings of a field (a route of ids or of city objects, witnesses on the case or on a stop,
// a fact as a string or { text }), so a content update that renames a field is fixed here and nowhere else. Pure: no DOM.
import { ARCS, CASES, CITIES, GANG } from '../content/index.js';

const own = (v, d) => (v == null ? d : v);
const text = (x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? String(x.text || x.line || x.say || x.clue || '') : '');
const idOf = (x) => (typeof x === 'string' ? x : x && x.id) || '';
const arr = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);

export const cityCoords = (c) => ({ x: Number(own(c.x, c.coords && c.coords.x)) || 0, y: Number(own(c.y, c.coords && c.coords.y)) || 0 });
/** Cities with their coordinates and clue lines normalized to { id, name, x, y, facts: [text], clues: [text], sign }. */
export const CITY_LIST = Object.freeze(CITIES.map((c) => ({ ...c, ...cityCoords(c), facts: arr(c.facts).map(text).filter(Boolean), clues: arr(c.clues || c.clueLines).map(text).filter(Boolean), sign: c.sign && c.sign.text ? c.sign.text : String(c.sign || '') })));
export const CITY_BY_ID = Object.freeze(Object.fromEntries(CITY_LIST.map((c) => [c.id, c])));
export const GANG_BY_ID = Object.freeze(Object.fromEntries(GANG.map((g) => [g.id, g])));

export const CASE_LIST = Object.freeze((() => {
  const ids = [];
  for (const a of ARCS || []) for (const c of arr(a.cases)) { const id = idOf(c); if (id && !ids.includes(id)) ids.push(id); }
  const byId = Object.fromEntries(CASES.map((c) => [c.id, c]));
  const out = ids.map((id) => byId[id]).filter(Boolean);
  for (const c of CASES) if (!out.includes(c)) out.push(c);
  return out.map((c, i) => ({ ...c, order: i + 1 }));
})());
export const CASE_BY_ID = Object.freeze(Object.fromEntries(CASE_LIST.map((c) => [c.id, c])));
/** The cases in play order. */
export const SEQUENCE = Object.freeze(CASE_LIST.map((c) => c.id));
export const TOUR_TOTAL = CASE_LIST.length;

export const routeOf = (kase) => arr(kase.route).map(idOf).filter((id) => CITY_BY_ID[id]);
export const hideoutCity = (kase) => { const r = routeOf(kase); return r[r.length - 1] || ''; };
export const gangOf = (kase) => GANG_BY_ID[kase.leader || kase.gang || kase.gangMember] || GANG[0] || { id: 'scrabble', name: 'Scrabble', animal: 'squirrel', reason: '' };

/** The stops of a case: one per route city, in order. Every stop has two witnesses with their clue text. A stop before the last points
 *  to the next city; the last stop's clues point to the hideout. */
export function stopsOf(kase) {
  const route = routeOf(kase);
  const hide = kase.hideout && typeof kase.hideout === 'object' ? kase.hideout : { description: text(kase.hideout) };
  return route.map((cityId, i) => {
    const last = i === route.length - 1;
    const city = CITY_BY_ID[cityId];
    const next = last ? null : CITY_BY_ID[route[i + 1]];
    const given = arr(kase.stops && kase.stops[i] && kase.stops[i].witnesses).length ? kase.stops[i].witnesses : arr(kase.witnesses && kase.witnesses[i]);
    const witnesses = [0, 1].map((w) => {
      const g = given[w] || {};
      const pool = last ? arr(hide.clues) : next ? next.clues : [];
      let clue = text(g.clue || g.line || g.says || g.text);
      if (!clue && pool.length) clue = text(pool[(i * 2 + w) % pool.length]);
      if (!clue && last) clue = `${g.name || 'A witness'} saw the gang slip away to the hideout.`;
      if (!clue) clue = `${g.name || 'A witness'} saw the gang head for ${next ? next.name : 'the hideout'}.`;
      return { name: g.name || 'A local', role: g.role || g.job || 'neighbor', clue, seed: `${kase.id}:${i}:${w}:${g.name || ''}` };
    });
    return { index: i, cityId, city, last, next: next ? next.id : null, witnesses };
  });
}
export const hideoutOf = (kase) => {
  const h = kase.hideout && typeof kase.hideout === 'object' ? kase.hideout : { description: text(kase.hideout) };
  return { cityId: hideoutCity(kase), place: text(h.place || h.name), description: text(h.description || h.text || h.blurb), leader: gangOf(kase) };
};
export const briefingOf = (kase) => arr(kase.briefing || kase.briefingLines).map(text).filter(Boolean);
export const signOf = (kase) => String(kase.sign && kase.sign.text ? kase.sign.text : kase.sign || (CITY_BY_ID[hideoutCity(kase)] || {}).sign || '').toUpperCase();

function hash(s) { let h = 17; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
/** The letter positions the gang swiped: 3 to 6 non-space letters, spread along the sign, the same every time for a case. */
export function missingOf(kase) {
  const sign = signOf(kase);
  const slots = [];
  for (let i = 0; i < sign.length; i++) if (/[A-Z0-9]/.test(sign[i])) slots.push(i);
  if (!slots.length) return [];
  const want = Math.max(1, Math.min(slots.length - 1 || 1, Math.max(3, Math.min(6, routeOf(kase).length + 1))));
  const start = hash(kase.id) % slots.length, step = Math.max(1, Math.floor(slots.length / want));
  const out = [];
  for (let k = 0; out.length < want && k < slots.length * 2; k++) { const idx = slots[(start + k * step + Math.floor(k / want)) % slots.length]; if (!out.includes(idx)) out.push(idx); }
  return out.sort((a, b) => a - b);
}
/** The postcard a closed case adds: the hideout city and two facts (the case's own, else the city's first two). */
export function postcardOf(kase) {
  const cityId = hideoutCity(kase);
  const city = CITY_BY_ID[cityId] || { id: cityId, name: cityId, facts: [] };
  const own2 = arr(kase.postcard && (kase.postcard.facts || kase.postcard)).map(text).filter(Boolean);
  return { cityId, city, facts: (own2.length ? own2 : city.facts).slice(0, 2) };
}

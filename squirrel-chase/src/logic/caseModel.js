// The ONE place that reads src/content/index.js (SPEC §5) and turns it into what the screens need: cities by id, the cases in
// order, a case's stops (a city and two witnesses each, every witness's text clue), its sign with the gaps, its hideout and its
// postcard. It tolerates the usual spellings of a field (a route of ids or of city objects, witnesses on the case or on a stop,
// a fact as a string or { text }), so a content update that renames a field is fixed here and nowhere else. Pure: no DOM.
import * as CONTENT from '../content/index.js';   // (a namespace: older content, and the tests' fixture content, may not export every list)
const { ARCS, CASES, CITIES, GANG } = CONTENT, HIDEOUT_TEMPLATES = CONTENT.HIDEOUT_TEMPLATES;

const own = (v, d) => (v == null ? d : v);
const text = (x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? String(x.text || x.fact || x.line || x.say || x.clue || x.body || x.statement || '') : '');
const idOf = (x) => (typeof x === 'string' ? x : x && x.id) || '';
const arr = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);

export const cityCoords = (c) => ({ x: Number(own(c.x, c.coords && c.coords.x)) || 0, y: Number(own(c.y, c.coords && c.coords.y)) || 0 });
/** Cities with their coordinates and clue lines normalized to { id, name, x, y, facts: [text], clues: [text], sign }. */
export const CITY_LIST = Object.freeze(CITIES.map((c) => ({ ...c, ...cityCoords(c), facts: arr(c.facts).map(text).filter(Boolean), clues: arr(c.clues || c.clueLines).map(text).filter(Boolean), sign: c.sign && c.sign.text ? c.sign.text : String(c.sign || '') })));
export const CITY_BY_ID = Object.freeze(Object.fromEntries(CITY_LIST.map((c) => [c.id, c])));
export const GANG_BY_ID = Object.freeze(Object.fromEntries(GANG.map((g) => [g.id, g])));

/** The tours (arcs) that have cases, in play order: { id, title, blurb, map: 'ny' | 'usa', cases: [ids] }. An arc without `map` is a New York arc; an arc with no cases is left out. */
export const ARC_LIST = Object.freeze((() => {
  const byId = Object.fromEntries(CASES.map((c) => [c.id, c]));
  const arcs = (ARCS || []).map((a) => ({ id: a.id, title: a.title || a.id, blurb: a.blurb || '', map: a.map === 'usa' ? 'usa' : 'ny', cases: [...new Set(arr(a.cases).map(idOf).filter((id) => byId[id]))] }));
  const listed = new Set(arcs.flatMap((a) => a.cases));
  const strays = CASES.filter((c) => !listed.has(c.id)).map((c) => c.id);          // cases no arc lists: they join the arc they name, else the first
  if (strays.length) {
    if (!arcs.length) arcs.push({ id: 'ny', title: 'The New York Tour', blurb: '', map: 'ny', cases: [] });
    for (const id of strays) (arcs.find((a) => a.id === byId[id].arc) || arcs[0]).cases.push(id);
  }
  return arcs.filter((a) => a.cases.length).map((a) => Object.freeze({ ...a, short: a.map === 'usa' ? 'USA tour' : 'New York tour', labName: a.map === 'usa' ? 'USA tour' : 'NY tour' }));
})());
export const ARC_BY_ID = Object.freeze(Object.fromEntries(ARC_LIST.map((a) => [a.id, a])));

export const CASE_LIST = Object.freeze((() => {
  const byId = Object.fromEntries(CASES.map((c) => [c.id, c]));
  const out = [];
  for (const a of ARC_LIST) a.cases.forEach((id, i) => out.push({ ...byId[id], order: out.length + 1, arc: a.id, arcOrder: i + 1 }));
  return out;
})());
export const CASE_BY_ID = Object.freeze(Object.fromEntries(CASE_LIST.map((c) => [c.id, c])));
/** The cases in play order (every tour, the New York tour first). */
export const SEQUENCE = Object.freeze(CASE_LIST.map((c) => c.id));

/** The tour a case (or case id) belongs to, or null. */
export const arcOf = (k) => { const c = typeof k === 'string' ? CASE_BY_ID[k] : k && CASE_BY_ID[k.id]; return (c && ARC_BY_ID[c.arc]) || null; };
/** The map a case is played on: 'ny' or 'usa'. */
export const mapOf = (k) => { const a = arcOf(k); return a ? a.map : 'ny'; };
/** Cases closed in a tour, and its size. */
export const tourClosed = (save, arc) => arc.cases.filter((id) => save.closed && save.closed[id]).length;
export const tourTotal = (arc) => arc.cases.length;
/** The tour the board is about: the arc of the case in play; else of the case opened last; else the first tour. */
export function activeArc(save, curId = null) {
  if (curId && arcOf(curId)) return arcOf(curId);
  const opened = SEQUENCE.filter((id) => save.opened && save.opened[id]);
  return (opened.length && arcOf(opened[opened.length - 1])) || ARC_LIST[0] || null;
}

/** Is a city on a map? 'ny': it has NY-box coords (a city with `coords: null` is not); 'usa': it has `usCoords`. */
export function onMap(c, map = 'ny') {
  if (!c) return false;
  if (map === 'usa') return !!(c.usCoords && Number.isFinite(Number(c.usCoords.x)) && Number.isFinite(Number(c.usCoords.y)));
  return c.coords !== null && !(c.coords === undefined && c.usCoords);   // (an old city with only x, y is a NY city)
}
/** A city's 0..1 position on a map. */
export const mapPos = (c, map = 'ny') => (map === 'usa' ? { x: Number(c.usCoords.x), y: Number(c.usCoords.y) } : { x: c.x, y: c.y });
/** The cities of one map in the shape drawMap wants (id, name, coords, usCoords), nothing from another map. */
export const citiesFor = (map = 'ny') => CITY_LIST.filter((c) => onMap(c, map)).map((c) => ({ ...c, coords: map === 'usa' ? c.coords || null : c.coords || { x: c.x, y: c.y } }));

export const routeOf = (kase) => (arr(kase.route).length ? arr(kase.route) : arr(kase.stops).map((s) => s && (s.cityId || s.city))).map(idOf).filter((id) => CITY_BY_ID[id]);
/** The art's member id for a content gang member (the art draws squirrel | raccoon | crow | possum | goat; the content's names win everywhere). */
/** A city as the art wants it: id + name only (the content's `scene` is prose for the artist, not a scene key; the art matches its scene from the id). */
export const artCity = (c) => ({ id: (c && c.id) || '', name: (c && c.name) || '' });
/** The content's fallback password sentences ({ id, text, slots: ['noun' | 'any'] }). */
export const HIDEOUT_TEMPLATE_LIST = Object.freeze(arr(HIDEOUT_TEMPLATES));
export const gangArt = (g) => (g && (g.animal || (GANG_BY_ID[g.id] || {}).animal)) || 'squirrel';
/** Who is at the hideout: the case's crew (content gang members), the lead first. */
export const crewOf = (kase) => { const ids = arr(kase.crew).map(idOf).filter((id) => GANG_BY_ID[id]); const lead = gangOf(kase); const all = [lead.id, ...ids.filter((id) => id !== lead.id)]; return all.map((id) => GANG_BY_ID[id]).filter(Boolean); };
export const hideoutCity = (kase) => { const r = routeOf(kase); return r[r.length - 1] || ''; };
export const gangOf = (kase) => GANG_BY_ID[kase.lead || kase.leader || kase.gang || kase.gangMember] || GANG[0] || { id: 'scrabble', name: 'Scrabble', animal: 'squirrel', reason: '' };

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
      // the content's own sealed note (what the witness wrote); the generic lines below are only for a case that has no notes of its own
      let clue = text(g.note || g.clue || g.says || g.text);
      if (!clue && pool.length) clue = text(pool[(i * 2 + w) % pool.length]);
      if (!clue && last) clue = `${g.name || 'A witness'} saw the gang slip away to the hideout.`;
      if (!clue) clue = `${g.name || 'A witness'} saw the gang head for ${next ? next.name : 'the hideout'}.`;
      return { name: g.name || 'A local', role: g.role || g.job || 'neighbor', line: text(g.note || g.clue ? g.line : ''), clue, clueId: g.clueId == null ? null : g.clueId, seed: `${kase.id}:${i}:${w}:${g.name || ''}` };
    });
    return { index: i, cityId, city, last, next: next ? next.id : null, witnesses };
  });
}
export const hideoutOf = (kase) => {
  const h = kase.hideout && typeof kase.hideout === 'object' ? kase.hideout : { description: text(kase.hideout) };
  const lines = arr(h.gangLines).map((l) => ({ who: GANG_BY_ID[l && l.who] || gangOf(kase), text: text(l) })).filter((l) => l.text);
  return { cityId: hideoutCity(kase), place: text(h.place || h.name), description: text(h.description || h.text || h.blurb), leader: gangOf(kase), crew: crewOf(kase), gangLines: lines };
};
/** The Chief's briefing as [{ who: 'chief' | 'pip' | 'wen', text }]. */
export const briefingOf = (kase) => arr(kase.briefing || kase.briefingLines).map((l) => ({ who: (l && l.who) || 'chief', text: text(l) })).filter((l) => l.text);
/** The line that points at the next case ('' when the content has none). */
export const teaserOf = (kase) => text(kase.teaser);
export const signOf = (kase) => String(kase.sign && kase.sign.text ? kase.sign.text : kase.sign || (CITY_BY_ID[hideoutCity(kase)] || {}).sign || '').toUpperCase();

/** The swiped positions IN RECOVERY ORDER as the content wrote them (sign.swiped: one flies back per correct city, the rest at the hideout); [] when the case has none. */
export function recoveryOf(kase) {
  const sign = signOf(kase), sw = kase.sign && Array.isArray(kase.sign.swiped) ? kase.sign.swiped : [];
  return [...new Set(sw.filter((i) => Number.isInteger(i) && i >= 0 && i < sign.length && /[A-Z0-9]/.test(sign[i])))];
}
/** The order letters come back in: the content's recovery order, else the sorted positions. */
export const flightOrder = (kase) => { const r = recoveryOf(kase); return r.length ? r : missingOf(kase); };
function hash(s) { let h = 17; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
/** The letter positions the gang swiped (sorted): the content's own `sign.swiped`, else 3 to 6 non-space letters, spread along the sign, the same every time for a case. */
export function missingOf(kase) {
  const given = recoveryOf(kase);
  if (given.length) return given.slice().sort((a, b) => a - b);
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

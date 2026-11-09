// Authoring helpers. The exported content is plain data; these only save hand-counting.
import { CITIES } from './cities.js';

const CITY = Object.fromEntries(CITIES.map((c) => [c.id, c]));
const CLUE = Object.fromEntries(CITIES.flatMap((c) => c.clues.map((k) => [k.id, { ...k, city: c.id }])));

/**
 * The case sign: the city's own sign text, with `letters` swiped. Each letter takes the first matching, not yet swiped
 * position, left to right. `swiped` is in recovery order: one letter flies back per correct city, the rest at the hideout.
 */
export function sign(cityId, letters, word = letters) {
  const text = CITY[cityId].sign;
  const used = new Set();
  const swiped = [...letters].map((ch) => {
    for (let i = 0; i < text.length; i++) if (text[i] === ch && !used.has(i)) { used.add(i); return i; }
    throw new Error(`sign ${cityId}: no free "${ch}" in "${text}"`);
  });
  const gaps = [...text].map((ch, i) => (used.has(i) ? '_' : ch)).join('');
  return { city: cityId, text, swiped, letters, word, gaps };
}

/** A witness whose sealed note is one of the next city's clues (the note text is copied in for the app). */
export function w(name, role, line, clueId) {
  const k = CLUE[clueId];
  if (!k) throw new Error(`unknown clue ${clueId}`);
  return { name, role, line, clueId, note: k.text };
}

/** A witness at the hideout city: the note points to the hideout spot, not to a city. */
export function hw(name, role, line, note) {
  return { name, role, line, clueId: null, note };
}

/** The postcard: the hideout city plus two of its facts (copied in, with sources). */
export function postcard(cityId, a, b) {
  const f = CITY[cityId].facts;
  if (!f[a] || !f[b] || a === b) throw new Error(`postcard ${cityId}: bad fact indexes ${a}, ${b}`);
  return { city: cityId, facts: [{ ...f[a] }, { ...f[b] }] };
}

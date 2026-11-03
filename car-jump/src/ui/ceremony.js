// The Friday Test ceremony (lab/SPEC.md §1.2 D16, §4.1). Every score gets one: Gold 90 % and up, Silver 75 %, Bronze 50 %, and under that the
// "Brave Speller" ribbon; a "Most improved" ribbon when the Friday score beats the Qualifier by 20 points or more. The test itself is untouched
// (audio only, one attempt, no hint, no combo, no timer): this module only turns the finished score into a card, and the same pure helpers are
// used by the certificate page (src/ui/certificate.js). No Lab dependency: the ceremony works when /lab/ is missing.
export const TIERS = ['gold', 'silver', 'bronze', 'brave'];
export const MOST_IMPROVED_POINTS = 20;

/** gold >= 90 %, silver >= 75 %, bronze >= 50 %, otherwise brave (the same rule as the Lab's trophy tiers). */
export function tierFor(correct, total) {
  const r = total > 0 ? correct / total : 0;
  return r >= 0.9 ? 'gold' : r >= 0.75 ? 'silver' : r >= 0.5 ? 'bronze' : 'brave';
}
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
/** Points gained from the Qualifier to the Friday Test (whole percentage points), or null without a Qualifier on the same list. */
export function improvement(test, qualifier) {
  if (!test || !qualifier || !(qualifier.total > 0) || !(test.total > 0)) return null;
  return pct(test.correct, test.total) - pct(qualifier.correct, qualifier.total);
}
export const isMostImproved = (test, qualifier) => { const d = improvement(test, qualifier); return d != null && d >= MOST_IMPROVED_POINTS; };
/** The first Qualifier on the same list as `test`, from a words record's `tests`. */
export const qualifierFor = (tests, test) => (Array.isArray(tests) ? tests : []).find((t) => t && t.kind === 'qualifier' && t.listId === test.listId) || null;

export const TIER_TEXT = Object.freeze({
  gold: { title: 'Gold Speller!', short: 'Gold', line: 'Amazing spelling! The Test Titan is all done.', say: 'Gold! Amazing spelling!', ribbon: 'Gold ribbon' },
  silver: { title: 'Silver Speller!', short: 'Silver', line: 'Great spelling! The Test Titan is tumbling.', say: 'Silver! Great spelling!', ribbon: 'Silver ribbon' },
  bronze: { title: 'Bronze Speller!', short: 'Bronze', line: 'Nice spelling! The Test Titan is wobbling.', say: 'Bronze! Nice spelling!', ribbon: 'Bronze ribbon' },
  brave: { title: 'Brave Speller!', short: 'Brave Speller', line: 'You kept going on every word. That is brave.', say: 'Brave Speller! You kept going on every word.', ribbon: 'Brave Speller ribbon' },
});
export const IMPROVED_TEXT = Object.freeze({ title: 'Most improved!', say: 'Most improved!' });
/** The lines the natural voice can say, a finite set for preparing clips (src/spelling/cloudVoice.js `extra`). */
export const CEREMONY_LINES = Object.freeze([...TIERS.map((t) => TIER_TEXT[t].say), IMPROVED_TEXT.say, 'Perfect Launch!']);

const GRAD = {
  gold: ['#fff3b0', '#ffcf1a', '#b98200'], silver: ['#ffffff', '#c9d3e6', '#7b86a3'], bronze: ['#ffd9b0', '#e08a3c', '#8a4a14'], brave: ['#c9f7ff', '#22d3ff', '#0a7fa6'],
};
let uid = 0;
/** The trophy (gold / silver / bronze) or the rosette ribbon (brave) as inline SVG. */
export function trophySvg(tier) {
  const [a, b, c] = GRAD[tier] || GRAD.gold, id = `cg${++uid}`;
  const defs = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>`;
  if (tier === 'brave') {
    return `<svg viewBox="0 0 80 96" aria-hidden="true">${defs}<path d="M26 54 14 90l14-7 6 11 8-34z" fill="#ff3b5c" stroke="#a8173a" stroke-width="3" stroke-linejoin="round"/>`
      + `<path d="M54 54 66 90l-14-7-6 11-8-34z" fill="#2fd36b" stroke="#13803c" stroke-width="3" stroke-linejoin="round"/>`
      + `<circle cx="40" cy="34" r="27" fill="url(#${id})" stroke="#0a5f80" stroke-width="3.5"/><circle cx="40" cy="34" r="18" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-dasharray="3 5"/>`
      + `<path d="M40 22l3.6 7.6 8.2 1.1-6 5.7 1.6 8.2-7.4-4-7.4 4 1.6-8.2-6-5.7 8.2-1.1z" fill="#fff" stroke="#0a7fa6" stroke-width="2" stroke-linejoin="round"/></svg>`;
  }
  return `<svg viewBox="0 0 80 96" aria-hidden="true">${defs}<path d="M20 12h40v22a20 20 0 0 1-40 0z" fill="url(#${id})" stroke="#2a1a00" stroke-width="3.5" stroke-linejoin="round"/>`
    + `<path d="M20 18H8v6a13 13 0 0 0 13 13M60 18h12v6a13 13 0 0 1-13 13" fill="none" stroke="#2a1a00" stroke-width="3.5" stroke-linecap="round"/>`
    + `<path d="M40 54v12M26 84h28M30 66h20l4 18H26z" fill="url(#${id})" stroke="#2a1a00" stroke-width="3.5" stroke-linejoin="round"/>`
    + `<path d="M40 20l3.2 6.8 7.4 1-5.4 5.2 1.4 7.4L40 36.8l-6.6 3.6 1.4-7.4-5.4-5.2 7.4-1z" fill="#fff" fill-opacity=".85"/></svg>`;
}

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

/**
 * The ceremony block for the end card: the Titan's blocks tumble, the trophy (or ribbon) lands on the shelf, the tier's name and, when earned,
 * the Most improved ribbon pop in. Calm: no loud flash, nothing that reads as a grade; the numbers sit above it in the card.
 * opts: { tier, improved (bool), points (the gain, optional), shelf (label of the shelf) }. Static in reduced motion (CSS).
 */
export function ceremonyNode({ tier = 'brave', improved = false, points = null, shelf = 'Your shelf' } = {}) {
  const t = TIER_TEXT[tier] || TIER_TEXT.brave;
  const root = el('div', `cer cer-${tier}`);
  root.dataset.tier = tier;
  root.id = 'tm-ceremony';
  const stage = el('div', 'cer-stage');
  const blocks = el('div', 'cer-blocks');
  blocks.setAttribute('aria-hidden', 'true');
  ['#ff8a1f', '#22d3ff', '#8f6bff'].forEach((c, i) => { const b = el('i'); b.style.setProperty('--c', c); b.style.setProperty('--i', String(i)); blocks.append(b); });
  const trophy = el('div', 'cer-trophy', trophySvg(tier));
  trophy.id = 'tm-trophy';
  stage.append(blocks, trophy);
  const plank = el('div', 'cer-shelf');
  plank.append(el('span', '', shelf));
  const names = el('div', 'cer-names');
  const tierEl = el('b', 'cer-tier', t.title);
  tierEl.id = 'tm-tier';
  names.append(tierEl);
  if (improved) {
    const m = el('span', 'cer-improved', IMPROVED_TEXT.title + (points != null && points > 0 ? ` +${points}` : ''));
    m.id = 'tm-improved';
    names.append(m);
  }
  const line = el('div', 'cer-line', t.line);
  root.append(stage, plank, names, line);
  return root;
}

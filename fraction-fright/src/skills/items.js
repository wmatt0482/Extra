// Fraction Fright items (SPEC §5): the fractions a street asks, their spoken names, the item shape the engine runs
// (SPEC §3), the result bands and the "N % close" wording. Pure: no DOM, no storage, no clock (callers pass `rng`).
//
// The road is a number line (0–1 in 1.0); an item is one zombie's fraction:
//   { id, kind: 'bounce' | 'locate', say: 'three quarters', show: '3/4', target: 0.75, n, d, tier,
//     jumps?: { unit: 0.25, count: 3 } (the bounce scaffold: the grenade hops in unit jumps, then lands),
//     tolerance: 0.10, hints: ['arrow', 'ticks'] }
// A throw's error is measured as a share of the road: bull ≤ 1.5 %, hit ≤ tolerance, near ≤ 2 × tolerance, else miss.
// PAE (percent absolute error, Siegler's measure) = |aimed − target| / road length × 100; the kid only ever sees it as
// "92 % close" (always positive; never "wrong").
// Denominators are CCSS grade 4's: 2, 3, 4, 5, 6, 8, 10, 12, 100. Tiers (= streets) in SPEC §5; 1.0 plays T1 (Maple
// Street: halves, quarters) and T2 (Oak Lane: thirds, sixths, eighths, then fifths, tenths, twelfths).

export const DENOMS = Object.freeze([2, 3, 4, 5, 6, 8, 10, 12, 100]);
/** Tolerance steps (share of the road): 10 % to start, 5 % when the tier is working, 3 % when secure. */
export const TOL_STEPS = Object.freeze({ start: 0.10, working: 0.05, secure: 0.03 });
export const BULL = 0.015;
export const HINTS = Object.freeze(['arrow', 'ticks']);
/** Zombies per wave (wave 1 … 5): the 3rd is the big wave, the 5th the final wave. */
export const WAVE_SIZES = Object.freeze([8, 9, 10, 10, 12]);
export const WAVES_PER_STREET = 5;
export const BIG_WAVE = 3;
export const FINAL_WAVE = 5;
/** Share of a wave drawn from the tier before (spaced review), from wave 2 of a street on. */
export const REVIEW_SHARE = 0.2;
/** Live zombies at once per wave (SPEC §13.1): 2, 2, 4 (the big wave), 3, 3 (+ the boss on the final wave). */
export const WAVE_LIVE = Object.freeze([2, 2, 4, 3, 3]);
export const BOSS_HITS = 3;
/** Twin pairs (equivalent fractions that rise at the same spot; one grenade cures both): per tier (SPEC §13.2). */
export const TWINS = Object.freeze({ T1: [[[1, 2], [2, 4]]], T2: [[[1, 3], [2, 6]], [[2, 3], [4, 6]]] });

export const TIERS = Object.freeze([
  { id: 'T1', street: 'maple', name: 'Maple Street', what: 'halves and quarters', dens: [2, 4], playable: true },
  { id: 'T2', street: 'oak', name: 'Oak Lane', what: 'thirds, sixths, eighths, then fifths, tenths, twelfths', dens: [3, 6, 8], more: [5, 10, 12], playable: true },
  { id: 'T3', street: 'twin', name: 'Twin Alley', what: 'which is bigger, and equal fractions', dens: [], playable: false },
  { id: 'T4', street: 'sum', name: 'Sum Street', what: 'adding and taking away like fractions', dens: [], playable: false },
  { id: 'T5', street: 'decimal', name: 'Decimal Drive', what: 'tenths, hundredths and decimals', dens: [], playable: false },
  { id: 'T6', street: 'pumpkin', name: 'Pumpkin Hill', what: 'fractions past 1 and mixed numbers', dens: [], playable: false },
]);
export const TIER_BY_ID = Object.freeze(Object.fromEntries(TIERS.map((t) => [t.id, t])));
export const PLAYABLE = Object.freeze(TIERS.filter((t) => t.playable).map((t) => t.id));
export const tierIndex = (id) => TIERS.findIndex((t) => t.id === id);

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** 0 … 99 in words ("forty-two"). */
export function numberWord(n) {
  n = Math.floor(n);
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
}
const DEN_WORDS = {
  2: ['half', 'halves'], 3: ['third', 'thirds'], 4: ['quarter', 'quarters'], 5: ['fifth', 'fifths'], 6: ['sixth', 'sixths'],
  8: ['eighth', 'eighths'], 10: ['tenth', 'tenths'], 12: ['twelfth', 'twelfths'], 100: ['hundredth', 'hundredths'],
};
/** "three quarters", "one half", "five twelfths". */
export function fracName(n, d) {
  const w = DEN_WORDS[d];
  if (!w) return `${numberWord(n)} over ${numberWord(d)}`;
  return `${numberWord(n)} ${n === 1 ? w[0] : w[1]}`;
}
export const fracText = (n, d) => `${n}/${d}`;
const UNIT_GLYPH = { 2: '½', 3: '⅓', 4: '¼', 5: '⅕', 6: '⅙', 8: '⅛', 10: '⅒', 12: '1/12', 100: '1/100' };
/** The unit fraction as a glyph ('¼'), or '1/d'. */
export const unitGlyph = (d) => UNIT_GLYPH[d] || `1/${d}`;
export const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
/** The fraction from its text ('3/4' → { n: 3, d: 4 }), or null. */
export function parseFrac(s) {
  const m = /^(\d{1,3})\/(\d{1,3})$/.exec(String(s || ''));
  if (!m) return null;
  const n = Number(m[1]), d = Number(m[2]);
  return d > 0 && DENOMS.includes(d) && n >= 0 && n <= d ? { n, d } : null;
}
/** The tier a fraction belongs to by its denominator (1.0: 2 and 4 → T1; everything else → T2). */
export const tierOfDen = (d) => (d === 2 || d === 4 ? 'T1' : 'T2');

/** The proper fractions a tier asks (0 < n < d). Equal to ½ only as 1/2 or 2/4 (the Lab's "same spot" fact), never 3/6 etc. */
export function fractionsOf(tierId, { more = false } = {}) {
  const t = TIER_BY_ID[tierId];
  if (!t || !t.playable) return [];
  const dens = more && t.more ? [...t.dens, ...t.more] : t.dens;
  const out = [];
  for (const d of dens) for (let n = 1; n < d; n++) {
    if (n * 2 === d && d !== 4 && d !== 2) continue;
    out.push({ n, d });
  }
  return out;
}

/** The road for a tier: 0–1 with 0, ½ and 1 always labelled (SPEC §0); finer ticks come per item from the hints. */
export function roadFor(tierId) {
  void tierId;
  // ticks: none here (the engine draws an item's fine ticks only while the hint ladder asks for them)
  return { from: 0, to: 1, labels: [{ at: 0, text: '0' }, { at: 0.5, text: '½' }, { at: 1, text: '1' }], ticks: [], landmarks: [] };
}

/** Tolerance for a tier's state ('secure' 3 %, 'working' 5 %, anything else 10 %). */
export const toleranceFor = (state) => (state === 'secure' ? TOL_STEPS.secure : state === 'working' ? TOL_STEPS.working : TOL_STEPS.start);

/** The error of a throw as a share of the road (0 … 1). */
export function errShare(aimed, target, road = { from: 0, to: 1 }) {
  const span = Math.max(1e-9, (road.to ?? 1) - (road.from ?? 0));
  return Math.abs(Number(aimed) - Number(target)) / span;
}
/** Percent absolute error, one decimal. */
export const paeOf = (aimed, target, road) => Math.round(errShare(aimed, target, road) * 1000) / 10;
/** 'bull' | 'hit' | 'near' | 'miss' for an error share and a tolerance. */
export function classify(err, tolerance) {
  const e = Math.abs(Number(err));
  if (!Number.isFinite(e)) return 'miss';
  if (e <= BULL + 1e-9) return 'bull';
  if (e <= tolerance + 1e-9) return 'hit';
  if (e <= 2 * tolerance + 1e-9) return 'near';
  return 'miss';
}
export const isHit = (result) => result === 'bull' || result === 'hit';
/** "92 % close" (rounded; never below 0). */
export const closeText = (pae) => `${Math.max(0, Math.min(100, Math.round(100 - Number(pae || 0))))} % close`;
/** The words after a throw (kid-facing, always positive). */
export function resultWords(result, pae) {
  if (result === 'bull') return 'Bullseye!';
  if (result === 'hit') return `Cured! ${closeText(pae)}`;
  if (result === 'near') return `So close! ${closeText(pae)}`;
  return `${closeText(pae)}. Here it is!`;
}

/** One item for the engine. */
export function makeItem(frac, { kind = 'locate', tolerance = TOL_STEPS.start, id = '', tier = tierOfDen(frac.d) } = {}) {
  const { n, d } = frac;
  const item = { id: id || `${tier}-${n}-${d}`, kind, say: fracName(n, d), show: fracText(n, d), target: n / d, n, d, tier, tolerance, hints: [...HINTS] };
  if (kind === 'bounce') item.jumps = { unit: 1 / d, count: n };
  return item;
}

/** The tier's twin pairs whose two fractions are both in the pool: [[{ n, d }, { n, d }], …]. */
export function twinPairs(tierId, { more = false } = {}) {
  const pool = new Set(fractionsOf(tierId, { more }).map((f) => fracText(f.n, f.d)));
  return (TWINS[tierId] || []).filter((pr) => pr.every(([n, d]) => pool.has(fracText(n, d)))).map((pr) => pr.map(([n, d]) => ({ n, d })));
}
/** The boss (SPEC §13.2): the same number three ways (symbol → words → unit sum), 3 hits, a name. */
export function makeBoss(frac, { tier = tierOfDen(frac.d), name = 'The Mayor', tolerance = TOL_STEPS.start, id = '' } = {}) {
  const { n, d } = frac;
  const words = fracName(n, d);
  const unitSay = Array(n).fill(fracName(1, d)).join(' plus ');
  const forms = [
    { show: fracText(n, d), say: words },
    { show: words, say: words },
    { show: Array(n).fill(unitGlyph(d)).join('+'), say: unitSay },
  ];
  return { id: id || `${tier}-boss-${n}-${d}`, kind: 'boss', name, hits: BOSS_HITS, forms, say: forms[0].say, show: forms[0].show, target: n / d, n, d, tier, tolerance, hints: [...HINTS] };
}
/** Boss names per street tier. */
export const BOSS_NAMES = Object.freeze({ T1: 'Mayor Mumbles', T2: 'Coach Groan' });

/** Share of bounce items by tier state: the scaffold early, plain locate once the tier works, none when secure. */
export const bounceShare = (state) => (state === 'secure' ? 0 : state === 'working' ? 0.3 : 0.7);

/** mulberry32: a small seeded generator (tests and waves are reproducible from a seed). */
export function rngFrom(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashString(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * A wave's items. opts: { tier, number (1–5), state (the tier's state), reviewTier (the tier before, or null),
 * reviewState, more (T2: fifths, tenths, twelfths too), rng, bossName }. Never the same fraction twice in a row.
 * From wave 2 on, one twin pair (SPEC §13.2) takes two adjacent slots (never the first two); the final wave appends
 * the boss as its last item. → { items, size, live, big, final }.
 */
export function buildWave({ tier, number = 1, state = 'new', reviewTier = null, reviewState = 'secure', more = false, rng = Math.random, bossName = BOSS_NAMES[tier] } = {}) {
  const wi = Math.max(0, Math.min(WAVE_SIZES.length - 1, number - 1));
  const size = WAVE_SIZES[wi];
  const pool = fractionsOf(tier, { more });
  const review = reviewTier && number > 1 ? fractionsOf(reviewTier) : [];
  const nReview = review.length ? Math.round(size * REVIEW_SHARE) : 0;
  const slots = Array.from({ length: size }, (_, i) => i);
  // review slots spread through the wave (never the first two)
  const reviewAt = new Set();
  for (let k = 0; k < nReview; k++) reviewAt.add(2 + Math.floor(((k + 0.5) * (size - 2)) / nReview));
  // the twin pair: two adjacent plain slots from the third on
  const pairs = number > 1 ? twinPairs(tier, { more }) : [];
  let twinAt = -1, pair = null;
  if (pairs.length) {
    pair = pairs[Math.floor(rng() * pairs.length) % pairs.length];
    const free = slots.filter((i) => i >= 2 && i + 1 < size && !reviewAt.has(i) && !reviewAt.has(i + 1));
    if (free.length) twinAt = free[Math.floor(rng() * free.length) % free.length];
  }
  const items = [];
  // zombies live at once should stand at different spots when the pool allows (two at one spot are cured by one
  // throw: that is the twins' trick, not every wave's); the window is by target value (1/2 and 2/4 share a spot)
  const live = WAVE_LIVE[wi];
  const spots = new Set(pool.map((f) => Math.round((f.n / f.d) * 1e6))).size;
  const window = Math.max(1, Math.min(live - 1, spots - 1));
  const recent = [];
  const spotOf = (f) => Math.round((f.n / f.d) * 1e6);
  const clash = (f) => recent.slice(-window).includes(spotOf(f));
  let prev = '';
  for (const i of slots) {
    if (twinAt >= 0 && (i === twinAt || i === twinAt + 1)) {
      const f = pair[i - twinAt];
      const it = makeItem(f, { kind: 'locate', tolerance: toleranceFor(state), id: `w${number}-${i + 1}`, tier });
      it.twin = `w${number}-${i === twinAt ? i + 2 : i}`;
      items.push(it);
      prev = fracText(f.n, f.d);
      recent.push(spotOf(f));
      continue;
    }
    const fromReview = reviewAt.has(i);
    const list = fromReview ? review : pool;
    const st = fromReview ? reviewState : state;
    let k = Math.floor(rng() * list.length) % list.length;
    if (fracText(list[k].n, list[k].d) === prev) k = (k + 1 + Math.floor(rng() * (list.length - 1))) % list.length;
    // not at a spot one of the last `window` zombies stands at (when another spot exists); the fraction before a twin
    // pair is neither of the twins (a third at the same spot is not a twin), nor prev
    const avoid = new Set([prev]);
    if (twinAt >= 0 && i === twinAt - 1) for (const pf of pair) avoid.add(fracText(pf.n, pf.d));
    const bad = (f) => avoid.has(fracText(f.n, f.d)) || (!fromReview && clash(f)) || (twinAt >= 0 && i === twinAt - 1 && spotOf(f) === spotOf(pair[0]));
    for (let tries = 0; bad(list[k]) && tries < list.length; tries++) k = (k + 1) % list.length;
    if (bad(list[k])) for (let tries = 0; avoid.has(fracText(list[k].n, list[k].d)) && tries < list.length; tries++) k = (k + 1) % list.length;
    const f = list[k];
    prev = fracText(f.n, f.d);
    recent.push(spotOf(f));
    const kind = rng() < bounceShare(st) ? 'bounce' : 'locate';
    items.push(makeItem(f, { kind, tolerance: toleranceFor(st), id: `w${number}-${i + 1}`, tier: fromReview ? reviewTier : tier }));
  }
  const final = number === FINAL_WAVE;
  if (final && pool.length) {
    let k = Math.floor(rng() * pool.length) % pool.length;
    if (fracText(pool[k].n, pool[k].d) === prev) k = (k + 1) % pool.length;
    items.push(makeBoss(pool[k], { tier, name: bossName || 'The Mayor', tolerance: toleranceFor(state), id: `w${number}-boss` }));
  }
  return { items, size, live: WAVE_LIVE[wi], big: number === BIG_WAVE, final };
}

/** Every text the voice may read (the fractions and the bosses' forms; the natural voice prepares them as clips: a finite set). */
export function sayTexts() {
  const out = new Set();
  for (const t of PLAYABLE) for (const f of fractionsOf(t, { more: true })) {
    out.add(`${fracName(f.n, f.d)}.`);
    for (const form of makeBoss(f, { tier: t }).forms) out.add(`${form.say}.`);
  }
  out.add('one half.');
  return [...out];
}

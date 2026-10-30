// Math facts (SPEC §4). A fact is a string: "7x8", "56/7", "19+34", "80-46". Commutative pairs are one fact: × and +
// keep the smaller number first (7 × 8 and 8 × 7 are both "7x8"; they are shown either way at random). Division is
// exact and subtraction never goes below zero (4th grade: whole numbers only).
//   parseFact("7 x 8" | "7×8" | "7*8" | "56 / 7" | "56÷7" | "34 + 19" | "80 - 46" | "80 − 46") → { a, op, b, fact } | null
//   factAnswer, factText ("7 × 8"), factFamily ("x7" / "d7" / "add" / "sub"), factFamilies (both × families)
//   familyFacts / setFacts (the week's set from the Parent Zone choices), parseCustom (the Custom problems text area)
import { numberWords, OP_WORDS } from './spoken.js';

export const MAX_N = 9999;
export const TABLE_MAX = 12;           // the × families ×2 … ×12, each against 1 … 12 (the 12 × 12 Fact Grid)
export const ALL_FAMILIES = Array.from({ length: 11 }, (_, i) => `x${i + 2}`);
export const STOCK_FAMILIES = ['x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9'];
// v1.7: three tiers above ÷12 (4th grade 4.NBT.5-6), families as units like "x7": tens × ones and their ÷ twins
// (T8), teens × ones (T9), two-digit × ones and two-digit quotients (T10). Table facts (both numbers ≤ 12) always
// keep their table families, so the new families never overlap the 12 × 12 grid and a mastered table never vouches
// for a family it has not met.
export const HIGH_FAMILIES = ['x10s', 'd10s', 'xteen', 'xbig', 'dbig'];
export const TENS = [20, 30, 40, 50, 60, 70, 80, 90];
export const HIGH_ONES = [3, 4, 6, 7, 8];                    // the ones factors of ×10s and teens ×
export const TEENS = [13, 14, 15, 16, 17, 18, 19];           // (12 × n is a ×12 table fact)
export const BIG_QUOTIENTS = [13, 14, 15, 16, 17, 18, 19];   // big ÷: (13 … 19) × d ÷ d (11 and 12 are table facts)
export const BIG_DIVISORS = [3, 4, 5, 6, 7, 8, 9];
/** big ×: 24 fixed facts, 21 … 49 × 3, 4, 6, 7, 8, 9, answers ≤ 999, the tens digits spread (8 per decade). */
export const BIG_TIMES = [
  [21, 4], [22, 7], [23, 3], [24, 6], [25, 8], [26, 3], [27, 9], [28, 6],
  [31, 8], [32, 3], [33, 4], [34, 7], [35, 6], [36, 9], [37, 4], [38, 3],
  [41, 6], [42, 4], [43, 7], [44, 3], [45, 9], [46, 8], [47, 4], [49, 6],
];
const isTens = (n) => n >= 20 && n % 10 === 0;
const isTeen = (n) => n >= 13 && n <= 19;
const isBig = (n) => n >= 21 && n <= 49;
/** Is this a family id ("x7", "d7", "add", "sub", "x10s" …)? */
export const isFamilyId = (f) => /^(x|d)\d+$|^(add|sub)$/.test(String(f || '')) || HIGH_FAMILIES.includes(f);
/** The × family a ÷ family undoes ("d7" → "x7", "d10s" → "x10s", "dbig" → "xbig"); null for the rest. */
export function twinFamily(fam) {
  const f = String(fam || '');
  if (f === 'd10s') return 'x10s';
  if (f === 'dbig') return 'xbig';
  return /^d\d+$/.test(f) ? 'x' + f.slice(1) : null;
}
/** The ÷ family of a × family ("x7" → "d7", "x10s" → "d10s", "xbig" → "dbig"); null when it has none (teens ×). */
export function divisionFamily(fam) {
  const f = String(fam || '');
  if (f === 'x10s') return 'd10s';
  if (f === 'xbig') return 'dbig';
  if (f === 'xteen') return null;
  return /^x\d+$/.test(f) ? 'd' + f.slice(1) : null;
}
/** A table family ("x7", "d7": the 12 × 12 grid) or + / −: the families of v1.3 … v1.6. */
export const isTableFamily = (fam) => /^(x|d)\d+$|^(add|sub)$/.test(String(fam || ''));
export const OPS = ['x', '/', '+', '-'];
const SYMBOL = { x: '×', '/': '÷', '+': '+', '-': '−' };

const OP_RE = /^\s*(\d{1,7})\s*([xX×*·⋅/÷:+\-−–])\s*(\d{1,7})\s*(=\s*\??\s*)?$/;
const OP_MAP = { x: 'x', X: 'x', '×': 'x', '*': 'x', '·': 'x', '⋅': 'x', '/': '/', '÷': '/', ':': '/', '+': '+', '-': '-', '−': '-', '–': '-' };

/** The canonical key of a fact (× and + smaller number first). */
export function factKey(a, op, b) {
  if ((op === 'x' || op === '+') && a > b) [a, b] = [b, a];
  return `${a}${op}${b}`;
}

/** Why a typed problem is not a fact, or '' when it is fine. */
export function factError(a, op, b) {
  if (![a, b].every((n) => Number.isInteger(n) && n >= 0 && n <= MAX_N)) return 'use whole numbers up to 9,999';
  if (op === '/') { if (b === 0) return 'cannot divide by 0'; if (a % b) return `${a} ÷ ${b} does not come out even`; }
  if (op === '-' && b > a) return 'the answer would be below zero';
  const ans = op === 'x' ? a * b : op === '/' ? a / b : op === '+' ? a + b : a - b;
  if (ans > MAX_N) return 'the answer is bigger than 9,999';
  return '';
}

/** Parse any written form of a fact; null when it is not a valid fact. */
export function parseFact(text) {
  const m = OP_RE.exec(String(text == null ? '' : text));
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[3]), op = OP_MAP[m[2]];
  if (!op || factError(a, op, b)) return null;
  const k = factKey(a, op, b);
  const [ka, kb] = k.split(/[x/+\-]/).map(Number);
  return { a: ka, op, b: kb, fact: k };
}
/** The canonical key for any written form ("8 × 7" → "7x8"), or null. */
export const normFact = (text) => { const p = parseFact(text); return p ? p.fact : null; };

export function factParts(fact) {
  const m = /^(\d+)([x/+\-])(\d+)$/.exec(String(fact || ''));
  return m ? { a: Number(m[1]), op: m[2], b: Number(m[3]) } : null;
}
export function factAnswer(fact) {
  const p = factParts(fact);
  if (!p) return NaN;
  return p.op === 'x' ? p.a * p.b : p.op === '/' ? p.a / p.b : p.op === '+' ? p.a + p.b : p.a - p.b;
}
export const isCommutative = (fact) => { const p = factParts(fact); return !!p && (p.op === 'x' || p.op === '+') && p.a !== p.b; };
/** The two numbers in the order shown (flip: the commutative pair the other way round). */
export function shownParts(fact, flip = false) {
  const p = factParts(fact);
  if (!p) return null;
  return flip && isCommutative(fact) ? { a: p.b, op: p.op, b: p.a } : p;
}
/** "7 × 8", "56 ÷ 7", "19 + 34", "80 − 46" (flip: "8 × 7"). */
export function factText(fact, flip = false) {
  const p = shownParts(fact, flip);
  return p ? `${p.a} ${SYMBOL[p.op]} ${p.b}` : '';
}
/** "seven times eight" */
export function factSpoken(fact, flip = false) {
  const p = shownParts(fact, flip);
  return p ? `${numberWords(p.a)} ${OP_WORDS[p.op]} ${numberWords(p.b)}` : '';
}
/** The sentences the voice reads: "seven times eight." / "fifty-six." / "seven times eight is fifty-six." */
export const questionSentence = (fact, flip = false) => `${factSpoken(fact, flip)}.`;
export const answerSentence = (fact) => `${numberWords(factAnswer(fact))}.`;
export const fullSentence = (fact, flip = false) => `${factSpoken(fact, flip)} is ${numberWords(factAnswer(fact))}.`;

// families: × facts belong to both factors' families (7x8 → x7 and x8); the main one (for the hint and the grid) is
// the factor with the easiest strategy; ÷ by its divisor; + and − as one family each
const EASY_ORDER = [0, 1, 10, 2, 5, 11, 9, 4, 3, 6, 12, 8, 7];
export function strategyFactor(a, b) {
  const rank = (n) => { const i = EASY_ORDER.indexOf(n); return i < 0 ? 99 : i; };
  return rank(a) <= rank(b) ? a : b;
}
/** v1.7: the family above the table a fact belongs to, or '' for a table / + / − fact. × with both numbers ≤ 12 is
 *  a table fact; else a multiple of ten ≥ 20 → x10s, a teen (13 … 19) → xteen, 21 … 49 → xbig. ÷ with the divisor
 *  and the quotient ≤ 12 is a table fact; else a tens divisor or a tens quotient → d10s, a two-digit quotient → dbig. */
export function highFamily(fact) {
  const p = factParts(fact);
  if (!p) return '';
  if (p.op === 'x') {
    if (p.a <= TABLE_MAX && p.b <= TABLE_MAX) return '';
    if (isTens(p.a) || isTens(p.b)) return 'x10s';
    if (isTeen(p.a) || isTeen(p.b)) return 'xteen';
    if (isBig(p.a) || isBig(p.b)) return 'xbig';
    return '';
  }
  if (p.op === '/') {
    const q = p.a / p.b;
    if (p.b <= TABLE_MAX && q <= TABLE_MAX) return '';
    if (isTens(p.b) || isTens(q)) return 'd10s';
    if (q >= 10) return 'dbig';
  }
  return '';
}
export function factFamilies(fact) {
  const p = factParts(fact);
  if (!p) return [];
  const high = highFamily(fact);
  if (high) return [high];
  if (p.op === 'x') return [...new Set([`x${p.a}`, `x${p.b}`])];
  if (p.op === '/') return [`d${p.b}`];
  return [p.op === '+' ? 'add' : 'sub'];
}
export function factFamily(fact) {
  const p = factParts(fact);
  if (!p) return '';
  const high = highFamily(fact);
  if (high) return high;
  if (p.op === 'x') return `x${strategyFactor(p.a, p.b)}`;
  return factFamilies(fact)[0];
}
/** How hard a fact is to meet for the first time (lower first): + and − within 20 first, then × by the family's
 *  strategy (×2, ×10, ×5, ×11, ×9, ×4, ×3, ×6, ×12, ×8, ×7) and size; a ÷ fact comes after its × fact was seen
 *  (seen(fact) → bool). New facts are introduced in this order, a little shuffled. */
export function difficulty(fact, seen = () => false) {
  const p = factParts(fact);
  if (!p) return 1e6;
  if (p.op === '+' || p.op === '-') return (p.op === '-' ? 5 : 0) + Math.max(p.a, p.b) / 10;
  // v1.7: the tiers above ÷12 come after every table fact (÷ at most 762): ×10s, ÷10s, teens ×, big ×, big ÷
  const high = highFamily(fact);
  if (high) {
    const base = { x10s: 1000, d10s: 1100, xteen: 1200, xbig: 1300, dbig: 1400 }[high];
    const ans = p.op === 'x' ? p.a * p.b : p.a / p.b;
    return base + Math.min(99, Math.max(p.a, p.b) / 10 + ans / 100);
  }
  if (p.op === 'x') {
    const n = strategyFactor(p.a, p.b), m = n === p.a ? p.b : p.a;
    return 10 + EASY_ORDER.indexOf(n) * 20 + m;
  }
  const times = factKey(p.b, 'x', p.a / p.b);
  return difficulty(times) + (seen(times) ? 45 : 500);
}
export const factOp = (fact) => { const p = factParts(fact); return p ? p.op : ''; };

/** The × facts of family ×n (n × 2 … n × 12: × 1 is not worth a gate), and with division also their inverses
 *  (n·m ÷ n and n·m ÷ m). */
export function familyFacts(n, { division = false } = {}) {
  const out = [];
  for (let m = 2; m <= TABLE_MAX; m++) {
    out.push(factKey(n, 'x', m));
    if (division) { out.push(`${n * m}/${n}`); out.push(`${n * m}/${m}`); }
  }
  return out;
}
/** + and − within 20: a + b ≤ 20 (a, b 1 … 10) and the subtractions back. */
export function addSubFacts() {
  const out = [];
  for (let a = 1; a <= 10; a++) for (let b = a; b <= 10; b++) {
    if (a + b > 20) continue;
    out.push(factKey(a, '+', b), `${a + b}-${a}`);
    if (b !== a) out.push(`${a + b}-${b}`);
  }
  return out;
}
/** The week's set: { families: ['x2' …], division, addSub, custom: [facts] } → unique facts (ordered). */
export function setFacts(sets = {}) {
  const out = [];
  for (const f of sets.families || []) {
    const n = Number(String(f).slice(1));
    if (n >= 2 && n <= TABLE_MAX) out.push(...familyFacts(n, { division: !!sets.division }));
  }
  if (sets.addSub) out.push(...addSubFacts());
  for (const c of sets.custom || []) { const k = normFact(c); if (k) out.push(k); }
  return [...new Set(out)];
}

export const MAX_CUSTOM = 60;
/** The Custom problems text area: one per line. → { facts: [unique keys], errors: [{ line, text, error }] } */
export function parseCustom(text) {
  const facts = [], errors = [];
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const t = raw.trim();
    if (!t) return;
    const m = OP_RE.exec(t);
    if (!m) { errors.push({ line: i + 1, text: t, error: 'not a problem like 7 x 8, 56 / 7, 34 + 19 or 80 - 46' }); return; }
    const a = Number(m[1]), b = Number(m[3]), op = OP_MAP[m[2]];
    const e = factError(a, op, b);
    if (e) { errors.push({ line: i + 1, text: t, error: e }); return; }
    const k = factKey(a, op, b);
    if (!facts.includes(k)) facts.push(k);
  });
  if (facts.length > MAX_CUSTOM) errors.push({ line: 0, text: '', error: `only the first ${MAX_CUSTOM} problems are kept` });
  return { facts: facts.slice(0, MAX_CUSTOM), errors };
}

// ---------- families as units (v1.3 adaptive): "x7" (7 × 2 … 7 × 12), "d7" (14 ÷ 7 … 84 ÷ 7), "add", "sub" ----------
const HIGH_LABELS = { x10s: '×10s', d10s: '÷10s', xteen: 'teens ×', xbig: 'big ×', dbig: 'big ÷' };
const HIGH_NAMES = { x10s: 'tens', d10s: 'tens ÷', xteen: 'teens', xbig: 'big numbers', dbig: 'big ÷' };
/** "×7", "÷7", "+", "−"; v1.7 "×10s", "÷10s", "teens ×", "big ×", "big ÷" */
export function famLabel(fam) {
  const f = String(fam || '');
  if (f === 'add') return '+';
  if (f === 'sub') return '−';
  if (HIGH_LABELS[f]) return HIGH_LABELS[f];
  return (f[0] === 'd' ? '÷' : '×') + f.slice(1);
}
/** The family in words for a kid: "tens", "teens", "big numbers", "big ÷", "tens ÷"; the label for the rest. */
export const famName = (fam) => HIGH_NAMES[String(fam || '')] || famLabel(fam);
const highMembers = {
  x10s: () => TENS.flatMap((t) => HIGH_ONES.map((m) => factKey(t, 'x', m))),
  d10s: () => [...new Set(TENS.flatMap((t) => HIGH_ONES.flatMap((m) => [`${t * m}/${t}`, `${t * m}/${m}`])))],
  xteen: () => TEENS.flatMap((t) => HIGH_ONES.map((m) => factKey(t, 'x', m))),
  xbig: () => BIG_TIMES.map(([a, b]) => factKey(a, 'x', b)),
  dbig: () => BIG_DIVISORS.flatMap((d) => BIG_QUOTIENTS.map((q) => `${q * d}/${d}`)),
};
/** The facts of one family: x_n → n × 2 … n × 12, d_n → n·m ÷ n (m 2 … 12), add / sub → within 20; v1.7 x10s (40:
 *  20 … 90 × 3 4 6 7 8), d10s (80: both ÷ twins of each), xteen (35: 13 … 19 × 3 4 6 7 8), xbig (24, BIG_TIMES),
 *  dbig (49: (13 … 19) × d ÷ d, d 3 … 9). */
export function familyMembers(fam) {
  const f = String(fam || '');
  if (f === 'add') return addSubFacts().filter((x) => x.includes('+'));
  if (f === 'sub') return addSubFacts().filter((x) => x.includes('-'));
  if (highMembers[f]) return highMembers[f]();
  const n = Number(f.slice(1));
  if (!(n >= 2 && n <= TABLE_MAX)) return [];
  const out = [];
  for (let m = 2; m <= TABLE_MAX; m++) out.push(f[0] === 'd' ? `${n * m}/${n}` : factKey(n, 'x', m));
  return out;
}
/** The ÷ facts that undo a × fact (7x8 → 56/7, 56/8). */
export function divisionTwins(fact) {
  const p = factParts(fact);
  if (!p || p.op !== 'x' || !p.a || !p.b) return [];
  return [...new Set([`${p.a * p.b}/${p.a}`, `${p.a * p.b}/${p.b}`])];
}

// v1.4: a missed × fact counts against the HARDER of its two families (the one later on the ladder): a miss on 5 × 8
// is a ×8 miss, not a ×5 miss. Right and quick answers still count for both. ÷, + and − have one family.
export const MISS_LADDER = ['x2', 'x5', 'x10', 'x3', 'x4', 'x6', 'x9', 'x7', 'x8', 'x11', 'x12', 'x10s', 'd10s', 'xteen', 'xbig', 'dbig'];
export function missFamily(fact) {
  const fams = factFamilies(fact);
  if (fams.length < 2) return fams[0] || '';
  return fams.slice().sort((a, b) => MISS_LADDER.indexOf(b) - MISS_LADDER.indexOf(a))[0];
}
/** Does a miss on this fact count against this family? */
export const missCountsFor = (fact, fam) => missFamily(fact) === fam;

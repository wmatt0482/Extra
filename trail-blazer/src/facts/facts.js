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
export function factFamilies(fact) {
  const p = factParts(fact);
  if (!p) return [];
  if (p.op === 'x') return [...new Set([`x${p.a}`, `x${p.b}`])];
  if (p.op === '/') return [`d${p.b}`];
  return [p.op === '+' ? 'add' : 'sub'];
}
export function factFamily(fact) {
  const p = factParts(fact);
  if (!p) return '';
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
/** "×7", "÷7", "+", "−" */
export function famLabel(fam) {
  const f = String(fam || '');
  if (f === 'add') return '+';
  if (f === 'sub') return '−';
  return (f[0] === 'd' ? '÷' : '×') + f.slice(1);
}
/** The facts of one family: x_n → n × 2 … n × 12, d_n → n·m ÷ n (m 2 … 12), add / sub → within 20. */
export function familyMembers(fam) {
  const f = String(fam || '');
  if (f === 'add') return addSubFacts().filter((x) => x.includes('+'));
  if (f === 'sub') return addSubFacts().filter((x) => x.includes('-'));
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
const MISS_LADDER = ['x2', 'x5', 'x10', 'x3', 'x4', 'x6', 'x9', 'x7', 'x8', 'x11', 'x12'];
export function missFamily(fact) {
  const fams = factFamilies(fact);
  if (fams.length < 2) return fams[0] || '';
  return fams.slice().sort((a, b) => MISS_LADDER.indexOf(b) - MISS_LADDER.indexOf(a))[0];
}
/** Does a miss on this fact count against this family? */
export const missCountsFor = (fact, fam) => missFamily(fact) === fam;

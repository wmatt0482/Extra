// Strategy hints for the fix-it routine (SPEC §4.5): shown with the whole fact after a miss and read aloud.
//   ×0 / ×1 / ×10 / ×11: the rule · ×2 double · ×3 double, plus one more · ×4 double, then double again
//   ×5 half of 10 × · ×6 5 ×, plus one more · ×9 10 ×, take away one · ×12 10 × plus 2 ×
//   ×7 / ×8 the nearest known square (7 × 8 = 7 × 7 + 7) or a 5 × / 10 × fact · ÷ the multiplication that undoes it
//   + make ten (or tens, then ones) · − count up from the smaller number
//   v1.7 above the table: tens × ("2 × 3 = 6, so 20 × 3 = 60") · teens and big × split the tens ("14 × 6 = 10 × 6 +
//   4 × 6 = 60 + 24 = 84") · ÷ by tens ("60 ÷ 20 = 3 because 20 × 3 = 60"), ÷ to tens ("6 ÷ 3 = 2, so 60 ÷ 3 = 20"),
//   two-digit quotients ("91 ÷ 7: 70 ÷ 7 = 10, 21 ÷ 7 = 3, so 91 ÷ 7 = 13")
// Hints use the numbers as shown (flip: the commutative pair the other way round), so they read naturally.
import { factAnswer, factParts, shownParts, strategyFactor } from './facts.js';
import { spokenText } from './spoken.js';

const nextTen = (n) => Math.ceil((n + 1) / 10) * 10;

const isTens = (n) => n >= 20 && n % 10 === 0;

/** v1.7: the hint for a × fact above the 12 × 12 table (either number > 12), in the order shown; '' for a table fact. */
function highTimesHint(a, b) {
  if (a <= 12 && b <= 12) return '';
  const ans = a * b;
  if (isTens(a) || isTens(b)) {
    // the tens number first: 2 × 3 = 6, so 20 × 3 = 60 (both tens: 2 × 30 = 60, so 20 × 30 = 600)
    const [t, m] = isTens(a) ? [a, b] : [b, a];
    return `${t / 10} × ${m} = ${(t / 10) * m}, so ${a} × ${b} = ${ans}`;
  }
  // split the bigger number into tens and ones, in the order shown: 14 × 6 = 10 × 6 + 4 × 6 = 60 + 24 = 84
  const big = Math.max(a, b), m = Math.min(a, b);
  const tens = Math.floor(big / 10) * 10, ones = big % 10;
  if (!ones) return `${big / 10} × ${m} = ${(big / 10) * m}, so ${a} × ${b} = ${ans}`;
  const pair = (x) => (a === big ? `${x} × ${m}` : `${m} × ${x}`);
  return `${a} × ${b} = ${pair(tens)} + ${pair(ones)} = ${tens * m} + ${ones * m} = ${ans}`;
}
/** v1.7: the hint for a ÷ fact above the table (a tens divisor or quotient, or a two-digit quotient); '' otherwise. */
function highDivideHint(a, b) {
  const q = a / b;
  if (b <= 12 && q <= 12) return '';
  if (isTens(b)) return `${a} ÷ ${b} = ${q} because ${b} × ${q} = ${a}`;
  if (isTens(q)) return `${a / 10} ÷ ${b} = ${q / 10}, so ${a} ÷ ${b} = ${q}`;
  if (q >= 10 && q < 20) return `${a} ÷ ${b}: ${10 * b} ÷ ${b} = 10, ${a - 10 * b} ÷ ${b} = ${q - 10}, so ${a} ÷ ${b} = ${q}`;
  return `${b} × ? = ${a}. ${b} × ${q} = ${a}, so ${a} ÷ ${b} = ${q}`;
}

function timesHint(a, b) {
  // n = the factor the strategy works on, m = the other one
  const ans = a * b;
  const high = highTimesHint(a, b);
  if (high) return high;
  // two neighbours around a square (6 × 7, 7 × 8, 8 × 9): the square, plus one more
  if (Math.abs(a - b) === 1 && Math.min(a, b) >= 6 && Math.max(a, b) <= 9 && !(a === 9 || b === 9)) {
    const s = Math.min(a, b);
    return `${s} × ${s} is ${s * s}, plus one more ${s} is ${ans}`;
  }
  const n = strategyFactor(a, b), m = n === a ? b : a;
  switch (n) {
    case 0: return `anything times 0 is 0`;
    case 1: return `1 times a number is that number: ${m}`;
    case 2: return `double ${m}: ${m} + ${m} = ${ans}`;
    case 3: return `double ${m} is ${2 * m}, plus one more ${m} is ${ans}`;
    case 4: return `double ${m} is ${2 * m}, double again is ${ans}`;
    case 5: return `10 × ${m} is ${10 * m}, half of that is ${ans}`;
    case 6: return `5 × ${m} is ${5 * m}, plus one more ${m} is ${ans}`;
    case 9: return `10 × ${m} is ${10 * m}, take away ${m} is ${ans}`;
    case 10: return `put a 0 on the end of ${m}: ${ans}`;
    case 11: return m <= 9 ? `11 × ${m}: write the ${m} twice: ${ans}` : `10 × ${m} is ${10 * m}, plus one more ${m} is ${ans}`;
    case 12: return `10 × ${m} is ${10 * m}, plus 2 × ${m} is ${2 * m}: ${ans}`;
    case 8: return `10 × ${m} is ${10 * m}, take away 2 × ${m} (${2 * m}) is ${ans}`;
    case 7: return `5 × ${m} is ${5 * m}, plus 2 × ${m} is ${2 * m}: ${ans}`;
    default: return `10 × ${m} is ${10 * m}, then adjust: ${a} × ${b} = ${ans}`;
  }
}

function addHint(a, b) {
  const big = Math.max(a, b), small = Math.min(a, b), ans = a + b;
  const need = nextTen(big) - big;
  if (small >= 10) {
    const tens = small - (small % 10), ones = small % 10;
    return ones ? `add the tens, then the ones: ${big} + ${tens} = ${big + tens}, ${big + tens} + ${ones} = ${ans}` : `add the tens: ${big} + ${tens} = ${ans}`;
  }
  if (big % 10 !== 0 && need < small) return `make ten: ${big} + ${need} = ${big + need}, then ${big + need} + ${small - need} = ${ans}`;
  return `start at ${big} and count on ${small}: ${ans}`;
}

function subHint(a, b) {
  const ans = a - b;
  if (b === 0) return `take away 0 and nothing changes: ${a}`;
  if (b % 10 !== 0 && nextTen(b) < a) {
    const s1 = nextTen(b) - b, s2 = a - nextTen(b);
    return `count up from ${b} to ${a}: ${b} + ${s1} = ${nextTen(b)}, ${nextTen(b)} + ${s2} = ${a}, so ${s1} + ${s2} = ${ans}`;
  }
  return `count up from ${b} to ${a}: ${b} + ${ans} = ${a}`;
}

/** The hint text, with symbols, for the fact as shown. */
export function hintFor(fact, flip = false) {
  const p = shownParts(fact, flip);
  if (!p) return '';
  if (p.op === 'x') return timesHint(p.a, p.b);
  if (p.op === '/') { const q = factAnswer(fact); return highDivideHint(p.a, p.b) || `${p.b} × ? = ${p.a}. ${p.b} × ${q} = ${p.a}, so ${p.a} ÷ ${p.b} = ${q}`; }
  if (p.op === '+') return addHint(p.a, p.b);
  return subHint(p.a, p.b);
}
/** Any hint text as the voice reads it (numbers and symbols as words, a sentence). */
export function spokenHint(text) {
  const t = spokenText(String(text || '').replace(/\(([^)]*)\)/g, ', $1,'));
  return t ? `${t}.` : '';
}
/** The same hint as the voice reads it ("ten times seven is seventy, take away seven is sixty-three."). */
export const hintSpoken = (fact, flip = false) => spokenHint(hintFor(fact, flip));
export { factParts };

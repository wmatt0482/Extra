// Word problems from facts the child knows (SPEC §2 "wordProblems.js", §3, §10): a fact from the Trail Blazer ladder
// ('7x8', '56/7', '20x3', '14x6', '23x4', '91/7') or null → a problem family → a sentence with the numbers filled in.
// The fact decides the numbers and the stop decides the goods, so a child on ×3 gets $3 flour and a child on big ×
// gets $23 wagon wheels; the arithmetic is the familiar part and reading the situation is the new part (transfer,
// CCSS 4.OA.3, 4.MD.2). Every problem has `text` for the panel, `say` for the voice (numbers as words, "seven
// dollars", no digits), `work`: the steps shown after a miss (Sweller's worked example; a split line for × by 6 or
// more, the related × fact for ÷, one line per step of a two-step problem), and a whole-number answer. The season's
// numberMult makes the numbers bigger only where the sentence stays sensible (prices, pounds, miles) and never past
// 999, so the spoken numbers stay in the range a 4th grader reads.
import { GOODS, legOf, seasonOf, nationFor } from './route.js';
import { NATION_BY_ID } from '../content/nations.js';
import { mulberry32, hashSeed, randInt, pick } from './rng.js';

export const PROBLEM_KINDS = ['buy', 'divide', 'ration', 'distance', 'parts', 'trade'];
/** The largest number a problem uses (answers and the numbers in the sentence). */
export const MAX_NUMBER = 999;
/** How often a 'divide' problem is the remainder variant when the caller does not say. */
export const REMAINDER_CHANCE = 0.35;

// ---- words ----
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** A whole number as words, as Trail Blazer's voice says it: 56 → "fifty-six", 108 → "one hundred eight". */
export function numberWords(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numberWords(n % 100) : '');
  if (n < 1000000) return numberWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numberWords(n % 1000) : '');
  return 'a lot';
}
/** Dollars as the voice says them: 7 → "seven dollars", 1 → "one dollar". */
export const dollarWords = (n) => `${numberWords(n)} ${n === 1 ? 'dollar' : 'dollars'}`;
/** The plural of a noun ("sack" → "sacks", "box" → "boxes", "ox" → "oxen"). */
export function plural(w) {
  if (w === 'ox') return 'oxen';
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
  if (/(s|x|ch|sh)$/.test(w)) return w + 'es';
  return w + 's';
}
/** The singular of a plural phrase ("sacks of flour" → "sack of flour", "beaver pelts" → "beaver pelt"). */
export function singular(phrase) {
  const one = (w) => (w === 'oxen' ? 'ox' : /ies$/.test(w) ? w.slice(0, -3) + 'y' : /(xes|ches|shes|sses)$/.test(w) ? w.slice(0, -2) : /s$/.test(w) ? w.slice(0, -1) : w);
  const s = String(phrase || '');
  const i = s.indexOf(' of ');
  if (i > 0) { const head = s.slice(0, i).split(' '); head[head.length - 1] = one(head[head.length - 1]); return head.join(' ') + s.slice(i); }
  const words = s.split(' ');
  words[words.length - 1] = one(words[words.length - 1]);
  return words.join(' ');
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const article = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');

// the two renderings of a sentence: digits for the panel, words for the voice
const TXT = { n: (n) => String(n), d: (n) => '$' + n, w: (n, one, many) => `${n} ${n === 1 ? one : many}` };
const SAY = { n: numberWords, d: dollarWords, w: (n, one, many) => `${numberWords(n)} ${n === 1 ? one : many}` };
const both = (tpl) => ({ text: tpl(TXT), say: tpl(SAY) });

// ---- facts ----
const FACT_RE = /^\s*(\d{1,4})\s*([xX×*·/÷:])\s*(\d{1,4})\s*$/;
/** A Trail Blazer fact id as numbers: '7x8' → { op: 'x', a: 7, b: 8, p: 56 }; '56/7' → { op: '/', a: 56, b: 7, p: 56,
 *  d: 7, q: 8 }; null for anything else (+ and − facts, inexact ÷, junk: the generator then picks small numbers). */
export function parseFactId(fact) {
  const m = FACT_RE.exec(String(fact == null ? '' : fact));
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[3]);
  if (/[/÷:]/.test(m[2])) return b > 0 && a % b === 0 && a > 0 ? { op: '/', a, b, p: a, d: b, q: a / b } : null;
  return a > 0 && b > 0 ? { op: 'x', a, b, p: a * b } : null;
}
// the two factors as (x, y) for a "x each, y of them" sentence: × keeps the written order (7x8 → $7, 8 sacks) unless
// a factor is 13 or more (then the big number is the price: $23 wheels); ÷ uses the related × fact (56/7 → 7, 8)
function factorsOf(f, rand) {
  if (!f) return { x: randInt(rand, 2, 5), y: randInt(rand, 2, 9) };
  if (f.op === '/') return { x: f.d, y: f.q };
  if (Math.max(f.a, f.b) >= 13) return { x: Math.max(f.a, f.b), y: Math.min(f.a, f.b) };
  return { x: f.a, y: f.b };
}
// divisor and quotient: ÷ as written; × with a big factor divides by the small one (one-digit divisors, 4.NBT.6)
function divisionOf(f, rand) {
  if (!f) return { d: randInt(rand, 2, 5), q: randInt(rand, 2, 9) };
  if (f.op === '/') return { d: f.d, q: f.q };
  if (Math.max(f.a, f.b) >= 13) return { d: Math.min(f.a, f.b), q: Math.max(f.a, f.b) };
  return { d: f.a, q: f.b };
}
/** The largest multiplier ≤ mult (mult, mult/2, … 1) that keeps fits(m) true. */
function scaleFor(mult, fits) {
  for (let m = Math.max(1, Math.floor(mult)); m > 1; m = Math.floor(m / 2)) if (fits(m)) return m;
  return 1;
}


/** The store's purse cap (v1.3: start cash $45): the quantities to try for a problem, the fact's own first, then half of
 *  it, a quarter, … down to 1, so a smaller multiple of the same fact stands in when the purse would not cover the full
 *  one. `fits(q)` says whether q is affordable. Returns the first quantity that fits; the original when none does (the
 *  edge case: even one costs more than the purse, and the app's "Not enough cash" path takes over). */
function affordableQty(qty, fits) {
  for (let q = qty; q >= 1; q = q > 1 ? Math.floor(q / 2) : 0) if (fits(q)) return q;
  return qty;
}
/** The purse the caller passes (`cash`, and `shelf`: the price the store's shelf shows for the good), or null (no cap). */
const purseOf = (o) => (Number.isFinite(o.cash) ? Math.max(0, Math.floor(o.cash)) : null);
const shelfOf = (o) => (Number.isFinite(o.shelf) && o.shelf > 0 ? o.shelf : 0);

// ---- the work lines ----
const placeParts = (n) => String(n).split('').map((d, i, s) => Number(d) * 10 ** (s.length - 1 - i)).filter((v) => v > 0);
/** The split line for a × (a strategy, the way Trail Blazer's hints say it), or null when the fact is small (both
 *  factors under 6, or a ×1). "7 × 8: 7 × 4 = 28, doubled = 56" · "9 × 7: 10 × 7 = 70, take away 7 = 63" ·
 *  "23 × 4: 20 × 4 = 80, 3 × 4 = 12, 80 + 12 = 92" · "20 × 3: 2 × 3 = 6, so 20 × 3 = 60". */
export function splitLine(a, b) {
  const p = a * b;
  if (Math.min(a, b) <= 1) return null;
  const big = Math.max(a, b);
  if (big >= 13) {
    // place value on the factor whose partner is ≤ 12 (else the smaller one)
    const B = Math.min(a, b) <= 12 ? big : Math.min(a, b), O = B === a ? b : a;
    const parts = placeParts(B);
    if (parts.length === 1) {
      const lead = B / 10 ** (String(B).length - 1);
      return `${B} × ${O}: ${lead} × ${O} = ${lead * O}, so ${B} × ${O} = ${p}`;
    }
    const prods = parts.map((v) => v * O);
    return `${B} × ${O}: ${parts.map((v, i) => `${v} × ${O} = ${prods[i]}`).join(', ')}, ${prods.join(' + ')} = ${p}`;
  }
  if (big < 6) return null;
  const has = (n) => a === n || b === n;
  const other = (n) => (a === n ? b : a);
  if (has(10)) return `${other(10)} × 10: ${other(10)} tens make ${p}`;
  const evens = [8, 6, 12].filter(has);
  if (evens.length) { const F = evens[0], O = other(F), h = O * (F / 2); return `${O} × ${F}: ${O} × ${F / 2} = ${h}, doubled = ${p}`; }
  if (has(9)) { const O = other(9); return `9 × ${O}: 10 × ${O} = ${10 * O}, take away ${O} = ${p}`; }
  if (has(11)) { const O = other(11); return `11 × ${O}: 10 × ${O} = ${10 * O}, and one more ${O} = ${p}`; }
  if (has(7)) { const O = other(7); return `7 × ${O}: 5 × ${O} = ${5 * O}, 2 × ${O} = ${2 * O}, ${5 * O} + ${2 * O} = ${p}`; }
  return null;
}
const lines = (...xs) => xs.filter(Boolean);

// ---- the goods a problem is about ----
const BIG_ITEMS = [
  { id: 'wheel', one: 'wagon wheel', short: 'wheel' }, { id: 'yoke', one: 'ox yoke', short: 'yoke' },
  { id: 'barrel', one: 'water barrel', short: 'barrel' }, { id: 'cover', one: 'wagon cover', short: 'cover' },
  { id: 'axle', one: 'spare axle', short: 'axle' }, { id: 'ox', one: 'ox', short: 'ox' },
];
/** A store good as sentence parts: flour → "sack of flour" / "sacks of flour" / "sack" / "sacks". */
function goodWords(g) {
  const unit = String(g.unit || 'one').toLowerCase(), name = String(g.name || g.id).toLowerCase();
  const isUnit = singular(name) === unit || name === unit;
  return { id: g.id, one: isUnit ? unit : `${unit} of ${name}`, many: isUnit ? plural(unit) : `${plural(unit)} of ${name}`, short: unit, shorts: plural(unit) };
}
const bigWords = (b) => ({ id: b.id, one: b.one, many: b.one.replace(/\S+$/, (w) => plural(w)), short: b.short, shorts: plural(b.short) });
// the item for a price: a store good for prices up to 12 (the fort decides which), a big item above
function itemFor(price, rand, itemId) {
  const want = itemId && GOODS.find((g) => g.id === itemId);
  if (want) return goodWords(want);
  if (price >= 13) return bigWords(pick(rand, BIG_ITEMS));
  return goodWords(pick(rand, GOODS));
}
const destOf = (leg, dest) => dest || (leg && ((leg.stop && leg.stop.name) || leg.to || leg.name)) || 'the next fort';

// ---- the kinds ----
function buy(f, rand, season, o) {
  const { x, y: qty0 } = factorsOf(f, rand);
  const purse = purseOf(o), shelf = shelfOf(o);
  // the purse caps what the child is asked to buy: the problem's total and the shelf's total both stay within the cash
  const qty = purse == null ? qty0 : affordableQty(qty0, (q) => x * q <= purse && shelf * q <= purse);
  const m = scaleFor(season.numberMult, (k) => x * k * qty <= MAX_NUMBER && (purse == null || x * k * qty <= purse));
  const price = x * m, total = price * qty;
  const it = itemFor(x, rand, o.item);
  const s = both((F) => `${cap(article(it.one))} ${it.one} costs ${F.d(price)}. You buy ${F.w(qty, it.short, it.shorts)}. How much is that?`);
  return { ...s, answer: total, unit: '$',
    work: lines(`${qty} ${qty === 1 ? it.short : it.shorts} at $${price} each: ${price} × ${qty}`, splitLine(price, qty), `${price} × ${qty} = ${total}, so it costs $${total}.`),
    meta: { item: it.id, qty, price, total } };
}

function divide(f, rand, season, o) {
  const { d, q: qFact } = divisionOf(f, rand);
  const rem = o.remainder != null ? !!o.remainder && d >= 2 : d >= 3 && rand() < REMAINDER_CHANCE;
  const purse = purseOf(o), shelf = shelfOf(o), extra = rem ? d - 1 : 0;
  // the purse caps the sacks: "you have $X" never passes the cash on hand, nor the shelf's price for them
  const q0 = purse == null ? qFact : affordableQty(qFact, (q) => d * q + extra <= purse && shelf * q <= purse);
  const m = scaleFor(season.numberMult, (k) => d * q0 * k + extra <= MAX_NUMBER && (purse == null || (d * q0 * k + extra <= purse && shelf * q0 * k <= purse)));
  const q = q0 * m, r = rem ? randInt(rand, 1, d - 1) : 0, have = d * q + r;
  const it = itemFor(d, rand, o.item);
  const many = cap(it.many);
  if (!rem) {
    const s = both((F) => `You have ${F.d(have)}. ${many} cost ${F.d(d)} each. How many ${it.shorts} can you buy?`);
    return { ...s, answer: q, unit: '',
      work: lines(`${have} ÷ ${d}: think ${d} × ? = ${have}`, splitLine(d, q), `${d} × ${q} = ${have}, so you can buy ${q} ${q === 1 ? it.short : it.shorts}.`),
      meta: { item: it.id, qty: q, price: d, total: have } };
  }
  const s = both((F) => `You have ${F.d(have)}. ${many} cost ${F.d(d)} each. How many ${it.shorts} can you buy, and how much money is left?`);
  const p1 = both((F) => `How many ${it.shorts} can you buy with ${F.d(have)}?`);
  const p2 = both(() => 'How many dollars are left?');
  return { ...s, answer: q, answers: [q, r], unit: '',
    parts: [{ ...p1, answer: q, unit: '' }, { ...p2, answer: r, unit: '$' }],
    work: lines(`${have} ÷ ${d}: ${d} × ${q} = ${d * q} is the closest without going over`, splitLine(d, q), `${have} − ${d * q} = ${r}: ${q} ${q === 1 ? it.short : it.shorts} and $${r} left.`),
    meta: { item: it.id, qty: q, price: d, total: d * q, left: r } };
}

function ration(f, rand, season, o, leg) {
  if (!f) {
    // the classic three-number story (SPEC §5): people × pounds a person, then × days
    const people = randInt(rand, 3, 5), lb = randInt(rand, 1, 3), days = randInt(rand, 2, 6);
    const daily = people * lb, total = daily * days;
    const s = both((F) => `${cap(F.n(people))} people each eat ${F.w(lb, 'pound', 'pounds')} of food a day. How many pounds do they eat in ${F.n(days)} days?`);
    return { ...s, answer: total, unit: 'lb',
      work: lines(`${people} × ${lb} = ${daily} pounds a day`, `${daily} × ${days} = ${total} pounds in ${days} days`),
      meta: { people, perPerson: lb, days, daily, total } };
  }
  // eaten on the way (the fact), then what is left (4.OA.3: two steps)
  const { x, y: days } = factorsOf(f, rand);
  const extra = 5 * randInt(rand, 1, 6);
  const m = scaleFor(season.numberMult, (k) => x * k * days + extra <= MAX_NUMBER);
  const daily = x * m, eaten = daily * days, have = eaten + extra, dest = destOf(leg, o.dest);
  const s = both((F) => `The party eats ${F.w(daily, 'pound', 'pounds')} of food a day. It is ${F.w(days, 'day', 'days')} to ${dest}. The wagon has ${F.n(have)} pounds. How many pounds will be left when you get there?`);
  return { ...s, answer: extra, unit: 'lb',
    work: lines(`${daily} × ${days} = ${eaten} pounds eaten on the way`, splitLine(daily, days), `${have} − ${eaten} = ${extra} pounds left`),
    meta: { daily, days, eaten, have, left: extra } };
}

function distance(f, rand, season, o, leg) {
  const dest = destOf(leg, o.dest);
  const asDays = f ? f.op === '/' || rand() < 0.5 : rand() < 0.5;
  if (asDays) {
    // how many days: miles ÷ miles a day (a rate between 5 and 30 when the fact allows)
    const { d, q } = divisionOf(f, rand);
    const inRange = (n) => n >= 5 && n <= 30;
    const [rate, days0] = inRange(d) || !inRange(q) ? [d, q] : [q, d];
    const m = scaleFor(season.numberMult, (k) => rate * days0 * k <= MAX_NUMBER);
    const days = days0 * m, miles = rate * days;
    const s = both((F) => `${cap(dest)} is ${F.n(miles)} miles away. The wagon makes ${F.n(rate)} miles a day. How many days will it take?`);
    return { ...s, answer: days, unit: 'days',
      work: lines(`${miles} ÷ ${rate}: think ${rate} × ? = ${miles}`, splitLine(rate, days), `${rate} × ${days} = ${miles}, so it takes ${days} ${days === 1 ? 'day' : 'days'}.`),
      meta: { miles, rate, days } };
  }
  // how far: miles a day × days (the rate grows with the season, up to a mule's brisk 30)
  const { x, y: days } = factorsOf(f, rand);
  const m = scaleFor(season.numberMult, (k) => x * k <= 30 && x * k * days <= MAX_NUMBER);
  const rate = x * m, miles = rate * days;
  const s = both((F) => `The wagon makes ${F.n(rate)} miles a day on the way to ${dest}. How far does it go in ${F.w(days, 'day', 'days')}?`);
  return { ...s, answer: miles, unit: 'mi',
    work: lines(`${rate} miles a day for ${days} ${days === 1 ? 'day' : 'days'}: ${rate} × ${days}`, splitLine(rate, days), `${rate} × ${days} = ${miles} miles.`),
    meta: { miles, rate, days } };
}

const PART_STORIES = [
  { thing: 'nail', box: 'box', bad: 'bent' }, { thing: 'peg', box: 'bag', bad: 'cracked' }, { thing: 'bolt', box: 'tin', bad: 'rusty' },
];
const SHARE_STORIES = [{ thing: 'spoke', into: 'wheel' }, { thing: 'nail', into: 'board' }, { thing: 'peg', into: 'crate' }];
function parts(f, rand) {
  if (f && f.op === '/') {
    // shared equally: one ÷ step, with the related × fact
    const { d, q } = divisionOf(f, rand), p = d * q, st = pick(rand, SHARE_STORIES);
    const s = both((F) => `The carpenter shares ${F.n(p)} new ${plural(st.thing)} equally among ${F.w(d, st.into, plural(st.into))}. How many ${plural(st.thing)} go in each ${st.into}?`);
    return { ...s, answer: q, unit: '',
      work: lines(`${p} ÷ ${d}: think ${d} × ? = ${p}`, splitLine(d, q), `${d} × ${q} = ${p}, so ${q} in each ${st.into}.`),
      meta: { total: p, groups: d, each: q } };
  }
  const { x, y } = factorsOf(f, rand);
  const p = x * y, k = randInt(rand, 1, Math.max(1, Math.min(9, p - 1)));
  const spokes = (x >= 10 && x <= 16 && y <= 6) || (y >= 10 && y <= 16 && x <= 6);
  if (spokes) {
    // SPEC §3's wheel: spokes a wheel × wheels, then the broken ones
    const per = Math.max(x, y), wheels = Math.min(x, y);
    const s = both((F) => `Each wagon wheel has ${F.n(per)} spokes. You check ${F.w(wheels, 'wheel', 'wheels')}. ${cap(F.w(k, 'spoke is', 'spokes are'))} broken. How many good spokes are there?`);
    return { ...s, answer: p - k, unit: '',
      work: lines(`${per} × ${wheels} = ${p} spokes in all`, splitLine(per, wheels), `${p} − ${k} = ${p - k} good spokes`),
      meta: { total: p, broken: k } };
  }
  const st = pick(rand, PART_STORIES);
  const s = both((F) => `You have ${F.w(y, st.box, plural(st.box))} of ${plural(st.thing)} with ${F.n(x)} ${plural(st.thing)} in each ${st.box}. ${cap(F.w(k, st.thing + ' is', plural(st.thing) + ' are'))} ${st.bad}. How many good ${plural(st.thing)} are there?`);
  return { ...s, answer: p - k, unit: '',
    work: lines(`${x} × ${y} = ${p} ${plural(st.thing)} in all`, splitLine(x, y), `${p} − ${k} = ${p - k} good ${plural(st.thing)}`),
    meta: { total: p, broken: k } };
}

const GENERIC_TRADE = { give: 'pelts', giveName: 'beaver pelts', get: 'flour', getName: 'sacks of flour', rate: [3, 2] };
function trade(f, rand, season, o, leg) {
  const nation = (o.nation && (typeof o.nation === 'object' ? o.nation : NATION_BY_ID[o.nation])) || nationFor(leg) || null;
  const tr = { ...GENERIC_TRADE, ...((nation && nation.trade) || {}) };
  const [g, t] = Array.isArray(tr.rate) && tr.rate.length === 2 ? tr.rate.map((n) => Math.max(1, n | 0)) : GENERIC_TRADE.rate;
  // how many trades: a number from the fact (≤ 12, so the pelts stay countable)
  let k;
  if (!f) k = randInt(rand, 2, 6);
  else if (f.op === '/') k = f.q <= 12 ? f.q : f.d;
  else {
    k = Math.max(f.a, f.b) <= 12 ? f.b : Math.min(f.a, f.b);          // 7x8 → 8 trades; 23x4 → 4 trades
    if (k < 2) k = Math.max(f.a, f.b) <= 12 ? Math.max(f.a, f.b) : 2;
  }
  k = Math.max(1, Math.min(12, k));
  // what the wagon really holds (tradeOffer(J).have): never trade more than that, and say so when it is fewer
  const have = Number.isFinite(o.have) ? Math.max(0, Math.floor(o.have)) : null;
  if (have != null && Math.floor(have / g) >= 1) k = Math.min(k, Math.floor(have / g));
  const n = g * k, ans = t * k;
  const give = tr.giveName || tr.give, get = tr.getName || tr.get;
  const who = nation ? `The ${nation.name} people trade` : 'The trading post gives';
  const youHave = (F) => (have != null && have > n ? `You trade ${F.n(n)} of your ${F.n(have)} ${give}.` : `You have ${F.w(n, singular(give), give)}.`);
  const s = both((F) => `${who} ${F.w(t, singular(get), get)} for every ${g === 1 ? singular(give) : `${F.n(g)} ${give}`}. ${youHave(F)} How many ${get} can you get?`);
  const w = g === 1
    ? lines(`Each ${singular(give)} gets ${t} ${t === 1 ? singular(get) : get}: ${k} × ${t}`, splitLine(k, t), `${k} × ${t} = ${ans} ${ans === 1 ? singular(get) : get}`)
    : lines(`${n} ÷ ${g} = ${k} (${g} × ${k} = ${n}), so that is ${k} ${k === 1 ? 'trade' : 'trades'}`, splitLine(k, t), `${k} × ${t} = ${ans} ${ans === 1 ? singular(get) : get}`);
  return { ...s, answer: ans, unit: '', work: w,
    meta: { nation: nation ? nation.id : null, give: tr.give, get: tr.get, giveN: n, getN: ans, rate: [g, t] } };
}

const MAKERS = { buy, divide, ration, distance, parts, trade };

/** A word problem: problemFor({ kind, fact, leg, season, rand, item?, remainder?, nation?, dest?, cash?, shelf? }) →
 *  { kind, fact, text, say, answer, unit: '$' | 'lb' | 'days' | 'mi' | '', work: [2-3 lines], meta, answers?, parts? }.
 *  kind: 'buy' (price × qty), 'divide' (money ÷ price; the remainder variant asks two numbers in turn: answers [q, r]
 *  and parts [{ text, say, answer, unit }, …], answer = the first), 'ration' (two steps), 'distance' (miles ÷ a day,
 *  or miles a day × days), 'parts' (× then the broken ones, or ÷ shared equally), 'trade' (the nation's rate × the
 *  pelts you have; `have`: the wagon's count from tradeOffer(J), so the story never trades more). fact: a Trail Blazer fact id or null (small numbers). meta carries what the app needs to act on
 *  the answer (a buy's item / qty / price, a trade's giveN / getN). rand defaults to a generator seeded from the
 *  arguments, so the same call gives the same problem. `cash` (and `shelf`, the shelf price of the item) cap a 'buy' or
 *  'divide' store problem to what the purse covers (v1.3): a smaller multiple of the same fact stands in. */
export function problemFor({ kind = 'buy', fact = null, leg = null, season = null, rand = null, ...o } = {}) {
  const k = MAKERS[kind] ? kind : 'buy';
  const l = legOf(leg);
  const s = seasonOf(season);
  const r = typeof rand === 'function' ? rand : mulberry32(hashSeed(k, fact, l ? l.id : '-', s.id));
  const f = parseFactId(fact);
  const out = MAKERS[k](f, r, s, o, l);
  return { kind: k, fact: fact == null ? null : String(fact), ...out };
}

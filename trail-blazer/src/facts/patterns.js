// Error patterns (SPEC v1.3 §4; Ashlock, "Error Patterns in Computation"): what kind of miss was it? Each miss is
// classified from the fact and the answer typed, kept on the fact's record (`patterns`, the last 10), and used three
// ways: the hint on a miss (patternHint), the frontier (an `inverse` cluster brings ÷ twins in right after their ×
// fact), and the Report / Start line in plain words (patternSummary).
//   reversed        digits reversed                       7 × 8 → 65
//   operation       the other operation's answer           7 × 8 → 15 (7 + 8) · 56 ÷ 7 → 392 · 9 + 4 → 5
//   inverse         a ÷ missed while its × twin is known   56 ÷ 7 missed, 7 × 8 known
//   adjacent        a nearby fact in the same row / column: the square next door (7 × 8 → 49 = 7 × 7, 64 = 8 × 8)
//                   or two steps away (7 × 8 → 42 = 7 × 6, 70 = 7 × 10)
//   off-by-operand  one group too many or too few          7 × 8 → 48 (6 × 8) or 63 (7 × 9) · 56 ÷ 7 → 7 or 9
//   big-operands    any other miss with both numbers ≥ 6   8 × 9 → 71
//   slow-only       not a miss: right, but never quick after 2+ right answers (recorded once in a row)
//   random          anything else
import { divisionTwins, factAnswer, factFamilies, factKey, factParts, factText, famLabel, missFamily, shownParts } from './facts.js';
import { DAY_MS, isKnown } from './scheduler.js';
import { hintFor } from './hints.js';

export const PATTERN_KINDS = ['reversed', 'operation', 'inverse', 'adjacent', 'off-by-operand', 'big-operands', 'slow-only', 'random'];
export const PATTERNS_KEPT = 10;
const HINTED = ['adjacent', 'off-by-operand', 'reversed', 'inverse', 'operation'];

const reverseDigits = (n) => Number(String(n).split('').reverse().join(''));

/** For a × fact a × b and an answer g: the same-row / same-column fact x × c (|c − y| ≤ 2) whose answer is g. */
function neighbour(a, b, g) {
  for (const [x, y, first] of [[a, b, false], [b, a, true]]) {
    for (const d of [-1, 1, -2, 2]) {
      const c = y + d;
      if (c >= 0 && x * c === g) return { x, c, y, d, first };   // first: the changed number is the first one shown
    }
  }
  return null;
}

/** The kind of a miss: fact ("7x8") and the number typed. null when it is not a miss. */
export function classifyMiss(fact, given, recs = {}) {
  const p = factParts(fact);
  const g = Number(given);
  const ans = factAnswer(fact);
  if (!p || given === '' || given == null || !Number.isFinite(g) || g === ans) return null;
  if (ans >= 10 && reverseDigits(ans) === g && String(g).length === String(ans).length && g !== ans) return 'reversed';
  const { a, b, op } = p;
  const other = op === 'x' ? [a + b] : op === '/' ? [a * b, a - b, a + b] : op === '+' ? [Math.abs(a - b), a * b] : [a + b];
  if (other.includes(g)) return 'operation';
  if (op === '/' && isKnown(recs[factKey(b, 'x', ans)])) return 'inverse';
  if (op === 'x') {
    const n = neighbour(a, b, g);
    if (n) return Math.abs(n.d) === 2 || n.x === n.c ? 'adjacent' : 'off-by-operand';
  }
  if (op !== 'x' && Math.abs(g - ans) === 1) return 'off-by-operand';
  if (op === 'x' && Math.min(a, b) >= 6) return 'big-operands';
  if (op === '/' && b >= 6 && ans >= 6) return 'big-operands';
  return 'random';
}

/** Right but never quick after at least 2 right answers (rec after the answer was applied). */
export const isSlowOnly = (rec) => !!rec && rec.firstTry >= 2 && !rec.quick && rec.answeredMs >= 2;

/** Keep a pattern on the record (the last 10); slow-only only once in a row. */
export function notePattern(rec, kind, at, given = null) {
  if (!rec || !kind) return;
  const list = Array.isArray(rec.patterns) ? rec.patterns : [];
  if (kind === 'slow-only' && list.length && list[list.length - 1].kind === 'slow-only') return;
  rec.patterns = [...list, { kind, at, ...(given == null ? {} : { given: Number(given) }) }].slice(-PATTERNS_KEPT);
}

/** The kind the hint should answer: this miss's kind when it has a pattern hint, else the record's most frequent one. */
export function hintKind(fact, given, recs = {}) {
  const k = classifyMiss(fact, given, recs);
  if (HINTED.includes(k)) return k;
  const rec = recs[fact];
  const counts = {};
  for (const x of (rec && rec.patterns) || []) if (HINTED.includes(x.kind)) counts[x.kind] = (counts[x.kind] || 0) + 1;
  const best = Object.entries(counts).sort((x, y) => y[1] - x[1])[0];
  return best ? best[0] : k;
}

/**
 * A hint shaped by the pattern (null: use the strategy hint). The numbers as shown (flip).
 *   adjacent / off-by-operand (×): start from the fact they reached ("7 × 7 is 49, then one more 7 is 56")
 *   reversed: tens and ones · inverse: "you know 7 × 8 = 56, so 56 ÷ 7 = 8" · operation: which operation, then the hint
 */
export function patternHint(fact, flip, kind, given) {
  const p = shownParts(fact, flip);
  if (!p) return null;
  const ans = factAnswer(fact);
  const g = Number(given);
  if ((kind === 'adjacent' || kind === 'off-by-operand') && p.op === 'x' && Number.isFinite(g)) {
    const n = neighbour(p.a, p.b, g);
    if (!n) return null;
    const k = Math.abs(n.d);
    const start = n.first ? `${n.c} × ${n.x} is ${g}` : `${n.x} × ${n.c} is ${g}`;
    if (n.d < 0) return `${start}, then ${k === 1 ? `one more ${n.x}` : `${k} more ${n.x}s`} is ${ans}`;
    return `${start}, take away ${k === 1 ? `one ${n.x}` : `${k} × ${n.x}`} is ${ans}`;
  }
  if (kind === 'reversed') {
    if (ans < 100) return `${Math.floor(ans / 10)} tens and ${ans % 10} ones: ${ans}, not ${Number.isFinite(g) ? g : reverseDigits(ans)}`;
    return `the digits in order: ${String(ans).split('').join(', ')}: ${ans}`;
  }
  if (kind === 'inverse' && p.op === '/') return `you know ${p.b} × ${ans} = ${p.a}, so ${p.a} ÷ ${p.b} = ${ans}`;
  if (kind === 'operation') {
    const what = { x: 'this one is × (times)', '/': 'this one is ÷ (how many groups)', '+': 'this one is + (put together)', '-': 'this one is − (take away)' }[p.op];
    return `${what}: ${hintFor(fact, flip)}`;
  }
  return null;
}

/** "×7 and ×8", "×3, ×4 and ×6" */
export function famList(fams) {
  const l = fams.map(famLabel);
  return l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`;
}

/**
 * The week's patterns in plain words (Report → Patterns, the Start line): [{ kind, text }], strongest first.
 * "Misses cluster in ×7 and ×8" · "Division is weaker than multiplication" · "Slow on big numbers: 6 × 7, 8 × 9" ·
 * "Mixes up neighbouring facts (like 7 × 8 → 49)" · "Often one group off (like 7 × 8 → 48)" · "Sometimes swaps the
 * digits (like 56 → 65)" · "Mixes up the operation (like 7 × 8 → 15)".
 */
export function patternSummary(d, now = Date.now(), days = 7) {
  const since = now - days * DAY_MS;
  const recs = Object.values((d && d.records) || {});
  const misses = [];
  for (const r of recs) for (const x of r.patterns || []) if (x.at >= since) misses.push({ fact: r.fact, ...x });
  const real = misses.filter((m) => m.kind !== 'slow-only');
  const out = [];
  // where the misses cluster (v1.4: a × miss counts for the harder of its two families)
  const fam = {};
  for (const m of real) { const f = missFamily(m.fact); fam[f] = (fam[f] || 0) + 1; }
  const top = Object.entries(fam).sort((a, b) => b[1] - a[1]);
  if (top.length && top[0][1] >= 3) {
    const fams = top.filter(([, n]) => n >= Math.max(3, Math.ceil(top[0][1] * 0.6))).slice(0, 2).map(([f]) => f);
    out.push({ kind: 'cluster', families: fams, text: `Misses cluster in ${famList(fams)}` });
  }
  // ÷ against × (records practiced this period)
  const acc = (op) => {
    const rs = recs.filter((r) => r.lastSeen >= since && factParts(r.fact) && factParts(r.fact).op === op);
    const att = rs.reduce((a, r) => a + r.attempts, 0), miss = rs.reduce((a, r) => a + r.misses, 0);
    return { att, acc: att ? 1 - miss / att : null };
  };
  const tx = acc('x'), td = acc('/');
  const inverse = real.filter((m) => m.kind === 'inverse').length;
  if ((td.att >= 4 && tx.att >= 4 && td.acc + 0.15 < tx.acc) || inverse >= 2) {
    out.push({ kind: 'division', text: inverse >= 2 ? 'Division is weaker than multiplication, even for known × facts' : 'Division is weaker than multiplication' });
  }
  // slow on big numbers
  const big = recs.filter((r) => { const p = factParts(r.fact); return p && p.op === 'x' && Math.min(p.a, p.b) >= 6 && r.lastSeen >= since && r.answeredMs > 0; })
    .filter((r) => (r.patterns || []).some((x) => x.kind === 'slow-only') || r.totalMs / r.answeredMs > 3000)
    .sort((a, b) => b.totalMs / b.answeredMs - a.totalMs / a.answeredMs).slice(0, 3);
  if (big.length) out.push({ kind: 'slow-big', facts: big.map((r) => r.fact), text: `Slow on big numbers: ${big.map((r) => factText(r.fact)).join(', ')}` });
  const example = (kind) => real.filter((m) => m.kind === kind && m.given != null).sort((a, b) => b.at - a.at)[0];
  const said = (kind, min, text) => {
    const n = real.filter((m) => m.kind === kind).length;
    if (n < min) return;
    const e = example(kind);
    out.push({ kind, count: n, text: e ? `${text} (like ${factText(e.fact)} → ${e.given})` : text });
  };
  said('adjacent', 2, 'Mixes up neighbouring facts');
  said('off-by-operand', 2, 'Often one group off');
  said('reversed', 2, 'Sometimes swaps the digits');
  said('operation', 2, 'Mixes up the operation');
  return out;
}

/** An `inverse` cluster this week (≥ 2): ÷ twins come in right after their × fact. */
export function inverseCluster(d, now = Date.now()) {
  const since = now - 7 * DAY_MS;
  let n = 0;
  for (const r of Object.values((d && d.records) || {})) for (const x of r.patterns || []) if (x.kind === 'inverse' && x.at >= since) n += 1;
  return n >= 2;
}
export { divisionTwins };

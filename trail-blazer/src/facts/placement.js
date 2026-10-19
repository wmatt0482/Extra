// The Pit Crew Check (SPEC v1.3 §1): a short adaptive placement after the first finished race (and from Parents →
// Facts → "Run the check again"). Kid-framed: never called a test. An adaptive staircase over difficulty tiers within
// the operations the parent allows (× always, ÷ with "÷ too", + / − within 20 as T0 with "+ and −"):
//   T0 + − · T1 ×2 ×5 ×10 · T2 ×3 ×4 · T3 ×6 ×9 · T4 ×7 ×8 · T5 ×11 ×12 · T6 ÷ of T1-T2 · T7 ÷ of T3-T5
// Start at T2 with a block of 3 items (distinct families, random other numbers 3 … 9 first).
//   ≥ 2 of 3 right and quick (≤ 3 s)  → advance a tier (the top tier passing ends it)
//   2 of 3 right, but slow             → probe: 3 more in that tier, then stop climbing
//   ≤ 1 of 3 right                     → drop a tier and probe it (3 items): ≤ 1 right there drops again; else stop
//                                        (a tier already passed earlier in the check is not asked again: stop)
// Stop after the top tier passes, after two drops, or at 24 items.
// Result: per family { acc, medianMs, status: fluent (all right, all quick) | known (right, slow) | shaky (a miss) |
// untested (above the frontier) }; families of tiers below the start that a passed tier vouches for are known
// (inferred). The answers seed the records: quick right = box 2 + a first-try, slow right = box 1, a miss = box 0 +
// focus. The Start line: "Fluent: ×2 ×5 ×10 · Working on: ×3 ×4 · Up next: ×6 ×9".
// Pure: the caller passes `rand` and `now`.
import { factKey, famLabel } from './facts.js';
import { DAY_MS, INTERVAL_DAYS, QUICK_MS, TIMES_KEPT, dayKey, isNew, newRecord } from './scheduler.js';
import { classifyMiss, notePattern } from './patterns.js';

export const TIERS = [
  { id: 'T0', families: ['add', 'sub'] },
  { id: 'T1', families: ['x2', 'x5', 'x10'] },
  { id: 'T2', families: ['x3', 'x4'] },
  { id: 'T3', families: ['x6', 'x9'] },
  { id: 'T4', families: ['x7', 'x8'] },
  { id: 'T5', families: ['x11', 'x12'] },
  { id: 'T6', families: ['d2', 'd5', 'd10', 'd3', 'd4'] },
  { id: 'T7', families: ['d6', 'd9', 'd7', 'd8', 'd11', 'd12'] },
];
export const START_TIER = 'T2';
export const BLOCK = 3;
export const MAX_ITEMS = 24;
export const MAX_DROPS = 2;
export const CHECK_XP = 100;
export const CHECK_ESTIMATE = 20;        // "About 20 quick facts" (the progress bar's scale)

/** The tiers for the parent's choices: × always, ÷ tiers with "÷ too", T0 with "+ and − within 20". */
export function tiersFor(sets = {}) {
  return TIERS.filter((t) => (t.id === 'T0' ? !!sets.addSub : t.id === 'T6' || t.id === 'T7' ? sets.division !== false : true)).map((t) => t.id);
}
const tierById = (id) => TIERS.find((t) => t.id === id);

function shuffle(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** One item of a family, other number 3 … 9 first (2 … 12 when those are used up), never a fact asked already. */
function itemFor(fam, used, rand) {
  const tries = [shuffle([3, 4, 5, 6, 7, 8, 9], rand), shuffle([2, 10, 11, 12], rand)];
  for (const pool of tries) {
    for (const m of pool) {
      let fact;
      if (fam === 'add') { const b = 3 + Math.floor(rand() * 7) % 7; if (m + b > 20) continue; fact = factKey(m, '+', b); }
      else if (fam === 'sub') { const b = 3 + Math.floor(rand() * 7) % 7; fact = `${m + b}-${m}`; }
      else {
        const n = Number(fam.slice(1));
        fact = fam[0] === 'd' ? `${n * m}/${n}` : factKey(n, 'x', m);
      }
      if (!used.has(fact)) return fact;
    }
  }
  return null;
}

/** A new check. opts: { tiers (ids, default all × and ÷), start ('T2') } */
export function createCheck(opts = {}, rand = Math.random) {
  const tiers = (opts.tiers && opts.tiers.length ? opts.tiers : tiersFor({ division: true })).slice();
  let ti = tiers.indexOf(opts.start || START_TIER);
  if (ti < 0) ti = Math.min(tiers.length - 1, tiers.indexOf('T1') >= 0 ? tiers.indexOf('T1') + 1 : 0);
  const st = { tiers, ti, block: null, items: [], drops: 0, done: false, end: '', tierResult: {}, rand, startTier: tiers[ti] };
  newBlock(st, ti, 'climb');
  return st;
}
function newBlock(st, ti, kind) {
  st.ti = ti;
  const fams = tierById(st.tiers[ti]).families;
  const order = shuffle(fams, st.rand);
  const famsFor = Array.from({ length: BLOCK }, (_, i) => order[i % order.length]);
  st.block = { tier: st.tiers[ti], kind, fams: famsFor, items: [] };
}
const stop = (st, why) => { st.done = true; st.end = why; st.block = null; };

/** The next item { fact, flip, family, tier } or null when the check is over. */
export function checkNext(st) {
  if (st.done || !st.block) return null;
  if (st.items.length >= MAX_ITEMS) { stop(st, 'max'); return null; }
  const used = new Set(st.items.map((x) => x.fact));
  const fam = st.block.fams[st.block.items.length];
  const fact = itemFor(fam, used, st.rand);
  if (!fact) { stop(st, 'max'); return null; }
  const flip = /x|\+/.test(fact) && st.rand() < 0.5;
  st.current = { fact, flip, family: fam, tier: st.block.tier };
  return st.current;
}

/** Record the answer to the current item: { correct, quick, ms, given }. Moves the staircase. */
export function checkAnswer(st, res = {}) {
  const it = st.current;
  if (!it || st.done) return st;
  st.current = null;
  const ms = Number(res.ms) > 0 ? Math.round(res.ms) : 0;
  const correct = !!res.correct;
  const quick = correct && (res.quick != null ? !!res.quick : ms > 0 && ms <= QUICK_MS);
  const item = { ...it, correct, quick, ms, given: res.given == null ? null : res.given };
  st.items.push(item);
  st.block.items.push(item);
  if (st.block.items.length < BLOCK) { if (st.items.length >= MAX_ITEMS) stop(st, 'max'); return st; }
  const b = st.block;
  const c = b.items.filter((x) => x.correct).length, q = b.items.filter((x) => x.quick).length;
  const t = st.ti;
  if (b.kind === 'climb') {
    if (q >= 2) {
      st.tierResult[b.tier] = 'fluent';
      if (t >= st.tiers.length - 1) stop(st, 'top'); else newBlock(st, t + 1, 'climb');
    } else if (c >= 2) {
      st.tierResult[b.tier] = 'known';
      newBlock(st, t, 'probe');
    } else {
      st.tierResult[b.tier] = 'shaky';
      st.drops += 1;
      const below = st.tierResult[st.tiers[t - 1]];
      if (below === 'fluent' || below === 'known') stop(st, 'frontier');          // the tier below already passed
      else if (st.drops >= MAX_DROPS || t <= 0) stop(st, 'drops'); else newBlock(st, t - 1, 'drop');
    }
  } else if (b.kind === 'probe') {
    const all = st.items.filter((x) => x.tier === b.tier);
    st.tierResult[b.tier] = all.filter((x) => x.correct).length >= Math.ceil(all.length * 0.66) ? 'known' : 'shaky';
    stop(st, 'frontier');
  } else {                                  // probing the tier below a drop
    if (c <= 1) {
      st.tierResult[b.tier] = 'shaky';
      st.drops += 1;
      if (st.drops >= MAX_DROPS || t <= 0) stop(st, 'drops'); else newBlock(st, t - 1, 'drop');
    } else {
      st.tierResult[b.tier] = q >= 2 ? 'fluent' : 'known';
      stop(st, 'frontier');
    }
  }
  if (!st.done && st.items.length >= MAX_ITEMS) stop(st, 'max');
  return st;
}
/** 0 … 1 for the thin progress bar (about 20 facts; full at the end). */
export const checkProgress = (st) => (st.done ? 1 : Math.min(0.95, st.items.length / CHECK_ESTIMATE));

const median = (xs) => { const a = xs.filter((x) => x > 0).sort((x, y) => x - y); if (!a.length) return 0; const m = a.length >> 1; return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2); };

/** The placement: { at, tiers: [{ tier, asked, correct, quick, result }], families: { fam: { acc, medianMs, status,
 *  asked, inferred? } }, items, end }. */
export function checkResult(st, now = Date.now()) {
  const families = {};
  const tiers = [];
  for (const id of st.tiers) {
    const its = st.items.filter((x) => x.tier === id);
    const result = st.tierResult[id] || (its.length ? 'shaky' : 'untested');
    tiers.push({ tier: id, asked: its.length, correct: its.filter((x) => x.correct).length, quick: its.filter((x) => x.quick).length, result });
    for (const fam of tierById(id).families) {
      const f = its.filter((x) => x.family === fam);
      if (!f.length) {
        // a passed tier vouches for its untried families
        if (result === 'fluent' || result === 'known') families[fam] = { acc: null, medianMs: 0, status: 'known', asked: 0, inferred: true };
        continue;
      }
      const acc = f.filter((x) => x.correct).length / f.length;
      const allQuick = f.every((x) => x.quick);
      const status = acc < 1 ? 'shaky' : allQuick && (f.length >= 2 || result === 'fluent') ? 'fluent' : 'known';
      families[fam] = { acc: Math.round(acc * 100) / 100, medianMs: median(f.map((x) => x.ms)), status, asked: f.length };
    }
  }
  // tiers below the lowest tried tier: known when that tier was passed, else untested
  const tried = st.tiers.filter((id) => st.items.some((x) => x.tier === id));
  const lowest = tried.length ? st.tiers.indexOf(tried[0]) : -1;
  const lowRes = lowest >= 0 ? st.tierResult[st.tiers[lowest]] : '';
  for (let i = 0; i < lowest; i++) {
    for (const fam of tierById(st.tiers[i]).families) {
      if (families[fam]) continue;
      families[fam] = lowRes === 'fluent' || lowRes === 'known' ? { acc: null, medianMs: 0, status: 'known', asked: 0, inferred: true } : { acc: null, medianMs: 0, status: 'untested', asked: 0 };
    }
  }
  for (const id of st.tiers) for (const fam of tierById(id).families) if (!families[fam]) families[fam] = { acc: null, medianMs: 0, status: 'untested', asked: 0 };
  return { at: now, tiers, families, items: st.items.length, end: st.end };
}

const addDay = (list, now) => { const k = dayKey(now); if (!list.includes(k)) list.push(k); };
/**
 * Put a finished check into the facts store: seed the records (quick right = box 2 + a first-try, slow right = box 1,
 * a miss = box 0 + focus; facts seen before only ever go up for a right answer), keep the placement (checks + 1),
 * +100 XP. Returns the placement.
 */
export function applyCheck(d, st, now = Date.now()) {
  const placement = checkResult(st, now);
  placement.checks = ((d.placement && d.placement.checks) || 0) + 1;
  const today = dayKey(now);
  for (const it of st.items) {
    const rec = d.records[it.fact] || (d.records[it.fact] = newRecord(it.fact));
    const fresh = isNew(rec);
    rec.attempts += 1; rec.seenCount += 1; rec.lastSeen = now;
    addDay(rec.daysSeen, now);
    if (it.ms) rec.times = [...(rec.times || []), it.ms].slice(-TIMES_KEPT);
    if (it.correct) {
      const box = it.quick ? 2 : 1;
      rec.box = fresh ? box : Math.max(rec.box, box);
      rec.due = now + INTERVAL_DAYS[rec.box] * DAY_MS;
      addDay(rec.daysCorrect, now);
      if (it.ms) { rec.totalMs += it.ms; rec.answeredMs += 1; rec.lastMs = it.ms; }
      if (it.quick) { rec.firstTry += 1; rec.quick += 1; addDay(rec.daysQuick, now); }
      if (rec.box >= 2) rec.focus = false;
    } else {
      rec.misses += 1; rec.box = 0; rec.due = now; rec.focus = true; rec.missDay = today;
      notePattern(rec, classifyMiss(it.fact, it.given, d.records) || 'random', now, it.given);
    }
  }
  d.placement = placement;
  d.xp = (d.xp || 0) + CHECK_XP;
  d.updatedAt = now;
  return placement;
}

/** The Start line: { fluent: [fam], working: [fam], next: [fam] } from the placement and the frontier. */
export function startLine(d) {
  const pl = d.placement;
  const order = TIERS.flatMap((t) => t.families);
  const fams = pl ? pl.families : {};
  const working = ((d.frontier && d.frontier.families) || []).slice();
  const fluent = order.filter((f) => fams[f] && fams[f].status === 'fluent' && !working.includes(f));
  const next = order.filter((f) => fams[f] && fams[f].status === 'untested' && !working.includes(f)).filter((f) => f[0] === (working[0] || 'x')[0] || f[0] === 'x').slice(0, 2);
  return { fluent, working, next, text: [fluent.length ? `Fluent: ${fluent.map(famLabel).join(' ')}` : '', working.length ? `Working on: ${working.map(famLabel).join(' ')}` : '', next.length ? `Up next: ${next.map(famLabel).join(' ')}` : ''].filter(Boolean).join(' · ') };
}

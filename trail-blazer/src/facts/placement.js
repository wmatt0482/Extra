// The Pit Crew Check (SPEC v1.3 §1, v1.4 §2): a short adaptive placement, kid-framed (never called a test). v1.4 runs
// it before the first race (and as a re-check, see adaptive.js checkDue). Tiers over the operations the parent allows:
//   T0 + − (with "+ and −") · T1 ×2 ×5 ×10 · T2 ×3 ×4 · T3 ×6 ×9 · T4 ×7 ×8 · T5 ×11 ×12 · (÷ as twins, below)
// LOCATE from T3 (a re-check starts at the frontier's tier): 2 items per tier, one per family (other numbers 3 … 9
//   first). Both right and quick → up a tier; any miss → down a tier; right but slow → stay (located). Moving onto a
//   tier already passed / failed, or a ladder end, also locates. ≤ 10 items.
// ZOOM: in the located tier and the tier above it, 2 more items per family (never a fact asked already), so each family
//   there has 2-3 answers and the result tells families apart (×6 fluent, ×9 shaky).
// TWINS: for each × family found fluent, one ÷ item (with "÷ too"): is division ready?
// 24 items at most. Result per family: fluent (all right, all quick), known (right, slow), shaky (a miss), untested;
// tiers below the lowest passed tier are vouched for (known, inferred). placement.tier = the lowest zoomed tier with a
// family that is not fluent (where the work starts). The answers seed the records (quick right = box 2 + a first-try,
// slow right = box 1, a miss = box 0 + focus). The Start line: "Fluent: … · Working on: … · Up next: <the scout family>".
// Pure: the caller passes `rand` and `now`.
import { factKey, famLabel } from './facts.js';
import { DAY_MS, INTERVAL_DAYS, QUICK_MS, TIMES_KEPT, addDay, dayKey, isNew, newRecord, noteRecent } from './scheduler.js';
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
export const START_TIER = 'T3';
export const LOCATE_ITEMS = 2;           // per tier while locating
export const LOCATE_MAX = 10;
export const ZOOM_ITEMS = 2;             // more per family in the located tier and the one above
export const MAX_ITEMS = 24;
export const CHECK_XP = 100;
export const CHECK_ESTIMATE = 15;        // "About 15 quick facts" (the progress bar's scale)

/** The tiers the staircase walks for the parent's choices: T1 … T5, T0 with "+ and − within 20" (÷ comes as twins). */
export function tiersFor(sets = {}) {
  return TIERS.filter((t) => (t.id === 'T0' ? !!sets.addSub : t.id !== 'T6' && t.id !== 'T7')).map((t) => t.id);
}
/** The ÷ tier of a × family's twin. */
const twinTier = (fam) => (['x2', 'x5', 'x10', 'x3', 'x4'].includes(fam) ? 'T6' : 'T7');
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

/** A new check. opts: { tiers (ids, default T1 … T5), start ('T3'), division (÷ twins, default true) } */
export function createCheck(opts = {}, rand = Math.random) {
  const tiers = (opts.tiers && opts.tiers.length ? opts.tiers : tiersFor({ division: true })).filter((id) => id !== 'T6' && id !== 'T7');
  let ti = tiers.indexOf(opts.start || START_TIER);
  if (ti < 0) ti = Math.max(0, tiers.indexOf(START_TIER));
  const st = { tiers, ti, phase: 'locate', block: null, items: [], queue: [], passed: [], failed: [], located: null, done: false, end: '', tierResult: {},
    division: opts.division !== false, rand, startTier: tiers[ti], phases: { locate: 0, zoom: 0, twins: 0 } };
  newBlock(st, ti);
  return st;
}
function newBlock(st, ti) {
  st.ti = ti;
  const fams = shuffle(tierById(st.tiers[ti]).families, st.rand).slice(0, LOCATE_ITEMS);
  st.block = { tier: st.tiers[ti], fams, items: [] };
}
const stop = (st, why) => { st.done = true; st.end = why; st.block = null; st.queue = []; };
function locate(st, ti, why) {
  st.located = ti; st.locatedWhy = why; st.phase = 'zoom'; st.block = null;
  for (const t of [ti, ti + 1]) {
    if (t >= st.tiers.length) continue;
    for (const fam of tierById(st.tiers[t]).families) for (let k = 0; k < ZOOM_ITEMS; k++) st.queue.push({ family: fam, tier: st.tiers[t], phase: 'zoom' });
  }
}
function startTwins(st) {
  st.phase = 'twins';
  if (!st.division) return;
  const order = TIERS.flatMap((t) => t.families).filter((f) => f[0] === 'x');
  for (const fam of order) {
    const its = st.items.filter((x) => x.family === fam);
    if (its.length && its.every((x) => x.quick)) st.queue.push({ family: 'd' + fam.slice(1), tier: twinTier(fam), phase: 'twins' });
  }
}

/** The next item { fact, flip, family, tier, phase } or null when the check is over. */
export function checkNext(st) {
  if (st.done) return null;
  if (st.items.length >= MAX_ITEMS) { stop(st, 'max'); return null; }
  const used = new Set(st.items.map((x) => x.fact));
  let entry = null;
  if (st.phase === 'locate') entry = { family: st.block.fams[st.block.items.length], tier: st.block.tier, phase: 'locate' };
  else {
    while (st.queue.length && !entry) {
      const e = st.queue.shift();
      if (itemFor(e.family, used, st.rand)) entry = e;
    }
    if (!entry && st.phase === 'zoom') { startTwins(st); return checkNext(st); }
    if (!entry) { stop(st, st.end || 'done'); return null; }
  }
  const fact = itemFor(entry.family, used, st.rand);
  if (!fact) { stop(st, 'max'); return null; }
  const flip = /x|\+/.test(fact) && st.rand() < 0.5;
  st.current = { fact, flip, family: entry.family, tier: entry.tier, phase: entry.phase };
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
  st.phases[it.phase] = (st.phases[it.phase] || 0) + 1;
  if (it.phase !== 'locate') { if (st.items.length >= MAX_ITEMS) stop(st, 'max'); return st; }
  const b = st.block;
  b.items.push(item);
  if (b.items.length < b.fams.length) return st;
  const c = b.items.filter((x) => x.correct).length, q = b.items.filter((x) => x.quick).length, n = b.items.length;
  const t = st.ti, top = st.tiers.length - 1;
  const locateCount = st.items.filter((x) => x.phase === 'locate').length;
  if (c === n && q === n) {
    st.tierResult[b.tier] = 'fluent'; st.passed.push(t);
    if (t >= top) locate(st, t, 'top');
    else if (st.failed.includes(t + 1)) locate(st, t, 'between');
    else if (locateCount >= LOCATE_MAX) locate(st, t, 'max');
    else newBlock(st, t + 1);
  } else if (c === n) {
    st.tierResult[b.tier] = 'known';
    locate(st, t, 'slow');
  } else {
    st.tierResult[b.tier] = 'shaky'; st.failed.push(t);
    if (t <= 0) locate(st, t, 'bottom');
    else if (st.passed.includes(t - 1)) locate(st, t - 1, 'between');
    else if (locateCount >= LOCATE_MAX) locate(st, t, 'max');
    else newBlock(st, t - 1);
  }
  if (st.items.length >= MAX_ITEMS) stop(st, 'max');
  return st;
}
/** 0 … 1 for the thin progress bar (about 15 facts; full at the end). */
export const checkProgress = (st) => (st.done ? 1 : Math.min(0.95, st.items.length / CHECK_ESTIMATE));

const median = (xs) => { const a = xs.filter((x) => x > 0).sort((x, y) => x - y); if (!a.length) return 0; const m = a.length >> 1; return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2); };

/** The placement: { at, tier, phase: { locate, zoom, twins }, tiers: [{ tier, asked, correct, quick, result }],
 *  families: { fam: { acc, medianMs, status, asked, inferred? } }, items, end }. */
export function checkResult(st, now = Date.now()) {
  const families = {};
  const tiers = [];
  const statusOf = (f, tierPassedQuick) => {
    const acc = f.filter((x) => x.correct).length / f.length;
    const allQuick = f.every((x) => x.quick);
    return { acc: Math.round(acc * 100) / 100, medianMs: median(f.map((x) => x.ms)), asked: f.length,
      status: acc < 1 ? 'shaky' : allQuick && (f.length >= 2 || tierPassedQuick) ? 'fluent' : 'known' };
  };
  for (const id of [...st.tiers, 'T6', 'T7']) {
    const its = st.items.filter((x) => x.tier === id);
    const result = st.tierResult[id] || (its.length ? (its.every((x) => x.correct) ? (its.every((x) => x.quick) ? 'fluent' : 'known') : 'shaky') : 'untested');
    if (its.length || st.tiers.includes(id)) tiers.push({ tier: id, asked: its.length, correct: its.filter((x) => x.correct).length, quick: its.filter((x) => x.quick).length, result });
    for (const fam of tierById(id).families) {
      const f = its.filter((x) => x.family === fam);
      if (f.length) families[fam] = statusOf(f, st.tierResult[id] === 'fluent' || fam[0] === 'd');
    }
  }
  // tiers below the lowest tier answered all right (quick or slow) are vouched for
  const okTiers = st.tiers.map((id, i) => (st.tierResult[id] === 'fluent' || st.tierResult[id] === 'known' ? i : -1)).filter((i) => i >= 0);
  const passed = okTiers.length ? Math.min(...okTiers) : -1;
  for (let i = 0; i < passed; i++) for (const fam of tierById(st.tiers[i]).families) if (!families[fam]) families[fam] = { acc: null, medianMs: 0, status: 'known', asked: 0, inferred: true };
  for (const t of TIERS) for (const fam of t.families) if (!families[fam]) families[fam] = { acc: null, medianMs: 0, status: 'untested', asked: 0 };
  // where the work starts: the lowest zoomed tier with a family that is not fluent (else the located tier)
  const zoomed = st.located == null ? [] : [st.located, st.located + 1].filter((i) => i < st.tiers.length).map((i) => st.tiers[i]);
  const workTier = zoomed.find((id) => tierById(id).families.some((f) => families[f] && families[f].status !== 'fluent'))
    || (st.located != null ? st.tiers[Math.min(st.located + 1, st.tiers.length - 1)] : st.tiers[st.ti] || START_TIER);
  return { at: now, tier: workTier, located: st.located != null ? st.tiers[st.located] : null, phase: { ...st.phases }, tiers, families, items: st.items.length, end: st.end };
}

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
    noteRecent(rec, now, it.correct, it.quick);
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
  // v1.4: a fresh look: scouting and the clean-race count start over (families vouched by scouts stay vouched)
  d.scouts = {};
  d.cleanRaces = 0;
  d.xp = (d.xp || 0) + CHECK_XP;
  d.updatedAt = now;
  return placement;
}

/** The Start line: { fluent, working, next } from the placement, the frontier and the scout family (opts.scout). */
export function startLine(d, opts = {}) {
  const pl = d.placement;
  const order = TIERS.flatMap((t) => t.families).filter((f) => f[0] !== 'd');
  const fams = pl ? pl.families : {};
  const working = ((d.frontier && d.frontier.families) || []).slice();
  const fluent = order.filter((f) => fams[f] && fams[f].status === 'fluent' && !fams[f].inferred && !working.includes(f));
  let next = opts.scout ? [opts.scout] : [];
  if (!next.length) next = order.filter((f) => fams[f] && fams[f].status === 'untested' && !working.includes(f)).slice(0, 2);
  return { fluent, working, next, text: [fluent.length ? `Fluent: ${fluent.map(famLabel).join(' ')}` : '', working.length ? `Working on: ${working.map(famLabel).join(' ')}` : '', next.length ? `Up next: ${next.map(famLabel).join(' ')}` : ''].filter(Boolean).join(' · ') };
}

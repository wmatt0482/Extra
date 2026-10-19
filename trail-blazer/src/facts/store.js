// The facts store (SPEC §4, like Spell Jump's wordStore.js): one player's math data, `trailBlazer.<playerId>.facts`.
//   { v, sets: { mode: 'auto' | 'manual', source: 'families' | 'custom' (manual: Pick families / Custom list), edited,
//              families: ['x2' …], division, addSub, custom: [facts], customText },
//     records: { fact: rec }, today: { date, count, newCount, missionPaid }, xp, opts: { gates, newPerDay, aloud },
//     races: [ … ] (the last 40, for the Report), updatedAt,
//     v1.3: placement: { at, tiers, families: { x7: { acc, medianMs, status } }, checks, items, end } | null,
//           frontier: { families, since, reason }, checkOffers (Pit Crew Check offers made, max 3), raceCount
//           (finished races), lastProbeAt, probeRace, probe: { facts, done, missed, at } | null, lastProbe, pulled }
// In auto mode (the default) the set is the frontier + known families (src/facts/adaptive.js); manual = v1.2.
// activeFacts(d) (the week's set, custom included) · nextFact(d, now, session) · recordAnswer(d, fact, result, now,
// session) → { newlyMastered, newlyFluent, missionJustDone, status, xp, isNew } · missionState · report / reportText ·
// resetFacts · normalizeFacts (corrupt / older data → valid). Pure: no DOM, no storage (main.js loads and writes).
import { ALL_FAMILIES, OPS, STOCK_FAMILIES, difficulty, factAnswer, factFamilies, factOp, factParts, factText, famLabel, isCommutative, normFact, setFacts } from './facts.js';
import { PATTERNS_KEPT, PATTERN_KINDS, classifyMiss, famList, isSlowOnly, notePattern, patternSummary } from './patterns.js';
import { autoFacts, noteFinished, noteProbe, pickAuto, probeDue, queueTwin, refreshFrontier, startProbe } from './adaptive.js';
import { applyAnswer, avgMs, createSession, dayKey, isFluent, isMastered, isNew, isSparse, newRecord, noteAnswered, pickNext, status, STATUSES, TIMES_KEPT } from './scheduler.js';

export const FACTS_VERSION = 2;
export const MAX_CHECK_OFFERS = 3;       // the Pit Crew Check is offered after up to 3 finished races, then only in Parents
export const factsKey = (playerId) => `trailBlazer.${playerId}.facts`;
export const MISSION_SIZE = 12;          // gate answers a day
export const MISSION_REWARD = 400;       // $, paid once a day
export const GATES_OPTIONS = [3, 4, 6];
export const NEW_PER_DAY_OPTIONS = [3, 5, 8, 99];   // 99 = All
export const XP = { firstTry: 15, quick: 5, fixed: 5, mastered: 50, mission: 100, check: 100 };
// the same level thresholds as Spell Jump (car-jump/src/data/cosmetics.js LEVEL_XP)
export const LEVEL_XP = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000, 5000, 6200, 7600, 9200, 11000, 13000, 15500, 18500, 22000];
const MAX_RACES = 40;

export function defaultFacts(now = Date.now()) {
  const d = {
    v: FACTS_VERSION,
    sets: { mode: 'auto', source: 'families', edited: false, families: STOCK_FAMILIES.slice(), division: true, addSub: false, custom: [], customText: '' },
    records: {},
    today: { date: dayKey(now), count: 0, newCount: 0, missionPaid: false },
    xp: 0,
    opts: { gates: 4, newPerDay: 99, aloud: true },
    races: [],
    updatedAt: 0,
    placement: null,
    frontier: { families: [], since: 0, reason: '' },
    checkOffers: 0,
    raceCount: 0,
    lastProbeAt: 0,
    probeRace: 0,
    probe: null,
    lastProbe: null,
    pulled: {},
  };
  refreshFrontier(d, now);
  return d;
}
/** v1.2 sets were never edited when they are still the stock set. */
const stockSets = (s) => Array.isArray(s.families) && s.families.length === STOCK_FAMILIES.length && STOCK_FAMILIES.every((f) => s.families.includes(f))
  && s.division !== false && !s.addSub && !(Array.isArray(s.custom) && s.custom.length);

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const days = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && /^\d{4}-\d\d-\d\d$/.test(x)))].slice(-60) : []);

/** Coerce stored data into a valid store (unknown fields dropped, numbers clamped, facts re-keyed canonically). */
export function normalizeFacts(raw, now = Date.now()) {
  const d = defaultFacts(now);
  if (!raw || typeof raw !== 'object') return d;
  const s = raw.sets && typeof raw.sets === 'object' ? raw.sets : null;
  if (s) {
    if (Array.isArray(s.families)) d.sets.families = ALL_FAMILIES.filter((f) => s.families.includes(f));
    d.sets.division = typeof s.division === 'boolean' ? s.division : d.sets.division;
    d.sets.addSub = !!s.addSub;
    d.sets.custom = Array.isArray(s.custom) ? [...new Set(s.custom.map(normFact).filter(Boolean))].slice(0, 60) : [];
    d.sets.customText = typeof s.customText === 'string' ? s.customText.slice(0, 4000) : d.sets.custom.map((f) => factText(f)).join('\n');
    // v1.3: older data has no mode: auto when the parent never edited the set, else manual (their families / list)
    d.sets.edited = typeof s.edited === 'boolean' ? s.edited : !stockSets(s);
    d.sets.mode = s.mode === 'auto' || s.mode === 'manual' ? s.mode : d.sets.edited ? 'manual' : 'auto';
    d.sets.source = s.source === 'custom' ? 'custom' : 'families';
  }
  if (raw.records && typeof raw.records === 'object') {
    for (const [k, r] of Object.entries(raw.records)) {
      const fact = normFact(k);
      if (!fact || !r || typeof r !== 'object') continue;
      const rec = d.records[fact] || newRecord(fact);
      rec.box = Math.max(rec.box, Math.max(0, Math.min(3, Math.floor(num(r.box)))));
      rec.due = Math.max(0, num(r.due));
      for (const f of ['attempts', 'firstTry', 'quick', 'seenCount', 'misses', 'fixed', 'totalMs', 'answeredMs', 'lastMs']) rec[f] += Math.max(0, Math.floor(num(r[f])));
      rec.lastSeen = Math.max(rec.lastSeen, num(r.lastSeen));
      rec.daysCorrect = days([...rec.daysCorrect, ...(r.daysCorrect || [])]);
      rec.daysSeen = days([...rec.daysSeen, ...(r.daysSeen || [])]);
      rec.daysQuick = days([...rec.daysQuick, ...(r.daysQuick || [])]);
      rec.rehearsed = !!r.rehearsed;
      if (typeof r.missDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.missDay) && r.missDay > (rec.missDay || '')) rec.missDay = r.missDay;
      rec.focus = !!r.focus && rec.box < 2;
      if (Array.isArray(r.times)) rec.times = [...rec.times, ...r.times.filter((x) => typeof x === 'number' && x > 0 && x < 600000).map(Math.round)].slice(-TIMES_KEPT);
      if (Array.isArray(r.patterns)) rec.patterns = [...rec.patterns, ...r.patterns.filter((x) => x && PATTERN_KINDS.includes(x.kind) && num(x.at) > 0)
        .map((x) => ({ kind: x.kind, at: num(x.at), ...(typeof x.given === 'number' && Number.isFinite(x.given) ? { given: x.given } : {}) }))].slice(-PATTERNS_KEPT);
      d.records[fact] = rec;
    }
  }
  const t = raw.today && typeof raw.today === 'object' ? raw.today : {};
  if (typeof t.date === 'string' && t.date === dayKey(now)) {
    d.today = { date: t.date, count: Math.max(0, Math.floor(num(t.count))), newCount: Math.max(0, Math.floor(num(t.newCount))), missionPaid: !!t.missionPaid };
  }
  d.xp = Math.max(0, Math.floor(num(raw.xp)));
  const o = raw.opts && typeof raw.opts === 'object' ? raw.opts : {};
  if (GATES_OPTIONS.includes(o.gates)) d.opts.gates = o.gates;
  if (NEW_PER_DAY_OPTIONS.includes(o.newPerDay)) d.opts.newPerDay = o.newPerDay;
  if (typeof o.aloud === 'boolean') d.opts.aloud = o.aloud;
  if (Array.isArray(raw.races)) {
    d.races = raw.races.filter((x) => x && typeof x === 'object' && num(x.at) > 0).slice(-MAX_RACES).map((x) => ({
      at: num(x.at), trail: typeof x.trail === 'string' ? x.trail.slice(0, 40) : '', place: Math.floor(num(x.place)) || null,
      asked: Math.max(0, Math.floor(num(x.asked))), correct: Math.max(0, Math.floor(num(x.correct))), quick: Math.max(0, Math.floor(num(x.quick))), fixed: Math.max(0, Math.floor(num(x.fixed))),
    }));
  }
  d.updatedAt = num(raw.updatedAt);
  // v1.3
  const pl = raw.placement;
  if (pl && typeof pl === 'object' && pl.families && typeof pl.families === 'object' && num(pl.at) > 0) {
    const fams = {};
    for (const [k, v] of Object.entries(pl.families)) {
      if (!/^(x|d)(\d+)$|^(add|sub)$/.test(k) || !v || typeof v !== 'object' || !['fluent', 'known', 'shaky', 'untested'].includes(v.status)) continue;
      fams[k] = { acc: typeof v.acc === 'number' ? Math.max(0, Math.min(1, v.acc)) : null, medianMs: Math.max(0, Math.round(num(v.medianMs))), status: v.status,
        asked: Math.max(0, Math.floor(num(v.asked))), ...(v.inferred ? { inferred: true } : {}) };
    }
    d.placement = { at: num(pl.at), families: fams, checks: Math.max(1, Math.floor(num(pl.checks, 1))), items: Math.max(0, Math.floor(num(pl.items))), end: typeof pl.end === 'string' ? pl.end.slice(0, 20) : '',
      tiers: Array.isArray(pl.tiers) ? pl.tiers.filter((t) => t && typeof t.tier === 'string').slice(0, 10).map((t) => ({ tier: t.tier.slice(0, 4), asked: Math.floor(num(t.asked)), correct: Math.floor(num(t.correct)), quick: Math.floor(num(t.quick)), result: typeof t.result === 'string' ? t.result.slice(0, 10) : '' })) : [] };
  }
  d.checkOffers = Math.max(0, Math.min(MAX_CHECK_OFFERS, Math.floor(num(raw.checkOffers))));
  d.raceCount = Math.max(0, Math.floor(num(raw.raceCount)));
  d.lastProbeAt = Math.max(0, num(raw.lastProbeAt));
  d.probeRace = Math.max(0, Math.min(d.raceCount, Math.floor(num(raw.probeRace))));
  const pr = raw.probe;
  if (pr && typeof pr === 'object' && Array.isArray(pr.facts)) {
    const facts = pr.facts.map(normFact).filter(Boolean).slice(0, 6);
    if (facts.length) d.probe = { facts, done: (Array.isArray(pr.done) ? pr.done : []).filter((f) => facts.includes(f)), missed: (Array.isArray(pr.missed) ? pr.missed : []).filter((f) => facts.includes(f)), at: num(pr.at) };
  }
  if (raw.lastProbe && typeof raw.lastProbe === 'object') d.lastProbe = { at: num(raw.lastProbe.at), asked: Math.floor(num(raw.lastProbe.asked)), missed: (Array.isArray(raw.lastProbe.missed) ? raw.lastProbe.missed : []).map(normFact).filter(Boolean) };
  if (raw.pulled && typeof raw.pulled === 'object') for (const [k, v] of Object.entries(raw.pulled)) if (/^(x|d)\d+$|^(add|sub)$/.test(k) && num(v) > 0) d.pulled[k] = num(v);
  const fr = raw.frontier;
  if (fr && typeof fr === 'object' && Array.isArray(fr.families)) d.frontier = { families: fr.families.filter((f) => typeof f === 'string' && /^(x|d)\d+$|^(add|sub)$/.test(f)).slice(0, 2), since: num(fr.since), reason: typeof fr.reason === 'string' ? fr.reason.slice(0, 160) : '' };
  else refreshFrontier(d, now);
  return d;
}

/** A new calendar day: today's counters start over. */
export function rollToday(d, now) {
  const k = dayKey(now);
  if (d.today.date !== k) d.today = { date: k, count: 0, newCount: 0, missionPaid: false };
  return d.today;
}

/** The week's set: auto → the frontier + known families (adaptive.js); manual → Pick families (families, ÷, + and −,
 *  custom problems: v1.2) or Custom list (the custom problems only). Unique facts. */
export function activeFacts(d, now = Date.now()) {
  if (d.sets.mode === 'auto') return autoFacts(d, now);
  if (d.sets.source === 'custom') return [...new Set(d.sets.custom)];
  return setFacts(d.sets);
}

export function missionState(d, now) {
  rollToday(d, now);
  const count = d.today.count;
  return { count: Math.min(count, MISSION_SIZE), answered: count, size: MISSION_SIZE, done: count >= MISSION_SIZE, paid: !!d.today.missionPaid };
}
const newLeft = (d) => Math.max(0, (d.opts.newPerDay >= 99 ? Infinity : d.opts.newPerDay) - d.today.newCount);

/** The fact for the next gate: { fact, reason, isNew, flip } (flip: show a commutative fact the other way round). */
export function nextFact(d, now, session = createSession(), rand = Math.random) {
  rollToday(d, now);
  const opts = { newLeft: newLeft(d), rank: (f) => difficulty(f, (x) => !isNew(d.records[x])) };
  const p = d.sets.mode === 'auto' ? pickAuto(d, now, session, opts, rand) : pickNext(activeFacts(d, now), d.records, now, session, opts, rand);
  if (!p) return null;
  return { ...p, flip: isCommutative(p.fact) && rand() < 0.5 };
}

/**
 * Record one gate answer. result: { correct, quick, fixed, ms }. Returns { status, isNew, newlyMastered,
 * newlyFluent, missionJustDone, xp (gained) }.
 */
export function recordAnswer(d, fact, result = {}, now = Date.now(), session = null) {
  rollToday(d, now);
  const sparse = isSparse(activeFacts(d, now), d.records);  // decided before this answer counts
  const rec = d.records[fact] || (d.records[fact] = newRecord(fact));
  const wasNew = isNew(rec), wasMastered = isMastered(rec), wasFluent = isFluent(rec);
  // the kind of miss (patterns.js), classified before the answer changes the records
  const pattern = !result.correct ? classifyMiss(fact, result.given, d.records) || 'random' : null;
  applyAnswer(rec, result, now);
  if (pattern) notePattern(rec, pattern, now, result.given);
  else if (isSlowOnly(rec) && !result.quick) notePattern(rec, 'slow-only', now);
  const probe = noteProbe(d, fact, !!result.correct, now);
  if (wasNew) d.today.newCount += 1;
  d.today.count += 1;
  let xp = 0;
  if (result.correct) xp += XP.firstTry + (result.quick ? XP.quick : 0);
  else if (result.fixed) xp += XP.fixed;
  const newlyMastered = !wasMastered && isMastered(rec);
  const newlyFluent = !wasFluent && isFluent(rec);
  if (newlyMastered) xp += XP.mastered;
  let missionJustDone = false;
  if (d.today.count >= MISSION_SIZE && !d.today.missionPaid) { d.today.missionPaid = true; missionJustDone = true; xp += XP.mission; }
  d.xp += xp;
  if (session) {
    noteAnswered(session, fact, { correct: !!result.correct, isNewFact: wasNew, sparse });
    if (d.sets.mode === 'auto') queueTwin(d, session, fact, now);
  }
  d.updatedAt = now;
  return { status: status(rec), isNew: wasNew, newlyMastered, newlyFluent, missionJustDone, xp, pattern, probe };
}

/**
 * After a race: a finished race counts toward the retention probe (every 15 finished races or 7 days) and the frontier
 * is recomputed (advancement / re-entry). Returns { probeStarted, frontierChanged }.
 */
export function afterRace(d, { finished = false } = {}, now = Date.now()) {
  const before = ((d.frontier && d.frontier.families) || []).join();
  if (finished) noteFinished(d, now);
  let probeStarted = false;
  if (finished && probeDue(d, now)) probeStarted = !!startProbe(d, now);
  refreshFrontier(d, now);
  return { probeStarted, frontierChanged: before !== d.frontier.families.join() };
}
/** The Pit Crew Check is offered after a finished race while there is no placement (at most 3 times). */
export const checkOfferDue = (d) => !d.placement && (d.checkOffers || 0) < MAX_CHECK_OFFERS;
export function noteCheckOffered(d) { d.checkOffers = Math.min(MAX_CHECK_OFFERS, (d.checkOffers || 0) + 1); }

/** Keep a race's fact count for the Report ("this week's races"). */
export function noteRace(d, { at = Date.now(), trail = '', place = null, asked = 0, correct = 0, quick = 0, fixed = 0 } = {}) {
  d.races.push({ at, trail, place, asked, correct, quick, fixed });
  if (d.races.length > MAX_RACES) d.races.splice(0, d.races.length - MAX_RACES);
}

// ---------- levels (XP) ----------
export function levelFor(xp) {
  let lvl = 1;
  for (let i = 1; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) lvl = i + 1;
  return Math.min(lvl, LEVEL_XP.length);
}
export function levelProgress(xp) {
  const level = levelFor(xp);
  const base = LEVEL_XP[level - 1] || 0, next = LEVEL_XP[level] || base;
  return { level, into: xp - base, need: Math.max(1, next - base), max: level >= LEVEL_XP.length };
}

// ---------- report ----------
const OP_NAME = { x: 'Multiplication (×)', '/': 'Division (÷)', '+': 'Addition (+)', '-': 'Subtraction (−)' };
/** Per operation the status counts of the week's set, the slowest facts, this week's races, the totals. */
export function report(d, now = Date.now()) {
  const active = activeFacts(d);
  const ops = {};
  for (const op of OPS) ops[op] = { name: OP_NAME[op], total: 0, ...Object.fromEntries(STATUSES.map((s) => [s, 0])) };
  for (const f of active) { const o = ops[factOp(f)]; if (!o) continue; o.total += 1; o[status(d.records[f])] += 1; }
  const seen = Object.values(d.records).filter((r) => r.seenCount > 0);
  const slowest = seen.filter((r) => r.answeredMs > 0).map((r) => ({ fact: r.fact, avgMs: avgMs(r) })).sort((a, b) => b.avgMs - a.avgMs).slice(0, 5);
  const missed = seen.filter((r) => r.misses > 0).sort((a, b) => b.misses - a.misses || b.lastSeen - a.lastSeen).slice(0, 5).map((r) => ({ fact: r.fact, misses: r.misses }));
  const weekAgo = now - 7 * 86400000;
  const races = d.races.filter((x) => x.at >= weekAgo);
  const totals = { facts: active.length, seen: seen.filter((r) => active.includes(r.fact)).length,
    mastered: active.filter((f) => isMastered(d.records[f])).length, fluent: active.filter((f) => isFluent(d.records[f])).length };
  return { ops, slowest, missed, races, totals, families: d.sets.families.slice(), division: d.sets.division, addSub: d.sets.addSub, custom: d.sets.custom.length,
    mode: d.sets.mode, source: d.sets.source, frontier: (d.frontier && d.frontier.families) || [], reason: (d.frontier && d.frontier.reason) || '',
    patterns: patternSummary(d, now), placement: d.placement, lastProbe: d.lastProbe };
}
/** The plain-text report (Parent Zone → Report → Copy report). */
export function reportText(d, name = '', now = Date.now(), trailName = (id) => id) {
  const r = report(d, now);
  const L = [];
  L.push(`Trail Blazer math facts${name ? ` · ${name}` : ''} · ${new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
  if (r.mode === 'auto') {
    L.push(`Auto mode (${r.totals.facts} facts in play)${r.division ? ', with ÷' : ''}${r.addSub ? ', + and − within 20' : ''}`);
    if (r.frontier.length) L.push(`Working on now: ${r.reason || r.frontier.map(famLabel).join(' ')}`);
  } else if (r.source === 'custom') L.push(`Custom list: ${r.custom} problems`);
  else L.push(`This week's set: ${r.families.map((f) => '×' + f.slice(1)).join(' ') || 'no × families'}${r.division ? ', with ÷' : ''}${r.addSub ? ', + and − within 20' : ''}${r.custom ? `, ${r.custom} custom` : ''} (${r.totals.facts} facts)`);
  if (r.placement) {
    const by = (st) => Object.entries(r.placement.families).filter(([, v]) => v.status === st && !v.inferred).map(([f]) => famLabel(f));
    L.push(`Pit Crew Check (${new Date(r.placement.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}): fluent ${by('fluent').join(' ') || '–'} · right but slow ${by('known').join(' ') || '–'} · missed ${by('shaky').join(' ') || '–'}`);
  }
  L.push(`Mastered ${r.totals.mastered} · fluent ${r.totals.fluent} · practiced ${r.totals.seen} of ${r.totals.facts}`);
  for (const op of OPS) {
    const o = r.ops[op];
    if (!o.total) continue;
    L.push(`${o.name}: ${STATUSES.map((s) => `${s} ${o[s]}`).join(' · ')}`);
  }
  if (r.slowest.length) L.push(`Slowest: ${r.slowest.map((x) => `${factText(x.fact)} (${(x.avgMs / 1000).toFixed(1)} s)`).join(', ')}`);
  if (r.missed.length) L.push(`Missed most: ${r.missed.map((x) => `${factText(x.fact)} (${x.misses}×)`).join(', ')}`);
  if (r.patterns.length) L.push(`Patterns: ${r.patterns.map((x) => x.text).join(' · ')}`);
  L.push(`Races this week: ${r.races.length}${r.races.length ? ` · gates ${r.races.reduce((a, x) => a + x.asked, 0)}, right first try ${r.races.reduce((a, x) => a + x.correct, 0)}, quick ${r.races.reduce((a, x) => a + x.quick, 0)}, fixed ${r.races.reduce((a, x) => a + x.fixed, 0)}` : ''}`);
  for (const x of r.races.slice(-8)) L.push(`  ${new Date(x.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${trailName(x.trail)}${x.place ? ` · ${x.place}${x.place === 1 ? 'st' : x.place === 2 ? 'nd' : x.place === 3 ? 'rd' : 'th'}` : ''} · ${x.correct}/${x.asked} right${x.quick ? `, ${x.quick} quick` : ''}${x.fixed ? `, ${x.fixed} fixed` : ''}`);
  return L.join('\n');
}

/** Parent Zone → Players → Reset facts data: progress, today and races go; the week's set, options and XP stay. */
export function resetFacts(d, now = Date.now()) {
  d.records = {};
  d.today = { date: dayKey(now), count: 0, newCount: 0, missionPaid: false };
  d.races = [];
  // v1.3: the placement goes too (the Pit Crew Check is offered again), and the probe clock starts over
  Object.assign(d, { placement: null, checkOffers: 0, raceCount: 0, lastProbeAt: 0, probeRace: 0, probe: null, lastProbe: null, pulled: {} });
  refreshFrontier(d, now);
  d.updatedAt = now;
  return d;
}

export { factAnswer, factFamilies, factParts, status, refreshFrontier, famList };

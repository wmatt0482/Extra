// The facts store (SPEC §4, like Spell Jump's wordStore.js): one player's math data, `trailBlazer.<playerId>.facts`.
//   { v, sets: { mode: 'auto' | 'manual', source: 'families' | 'custom' (manual: Pick families / Custom list), edited,
//              families: ['x2' …], division, addSub, custom: [facts], customText },
//     records: { fact: rec }, today: { date, count, newCount, missionPaid }, xp, opts: { gates, newPerDay, aloud },
//     races: [ … ] (the last 40, for the Report), updatedAt,
//     v1.3: placement: { at, tiers, families: { x7: { acc, medianMs, status } }, checks, items, end } | null,
//           frontier: { families, since, reason }, checkOffers (Pit Crew Check offers made, max 3), raceCount
//           (finished races), lastProbeAt, probeRace, probe: { facts, done, missed, at } | null, lastProbe, pulled }
//     v1.4: placement.tier / located / phase, scouts: { fam: { asked, quick, miss } }, vouched: { fam: at }, stepped:
//           { fam: { at, back } }, gateLog: [[at, right, quick]] (the last 12 gates: the governor's dial), dialHistory,
//           cleanRaces, lastCheckOfferAt, frontier.history: [{ at, from, families, why }] (the last 10)
//     v1.6 (FACTS_VERSION 4, family sync): sets.updatedAt (stamped when a parent changes the set: the later set wins a
//           merge), resetAt (Parents → Reset facts: a reset on one device wins), and the size caps: day lists = the
//           last 12 days, patterns 6, recent 8, times 5; compactFacts() drops default-valued record fields for storage
//           (normalizeFacts restores them), so a mature store (222 facts, 30 days) stays well under 150 KB.
// In auto mode (the default) the set is the frontier + known families (src/facts/adaptive.js); manual = v1.2.
// v1.4: the frontier goes through refreshFrontier below, which adds the difficulty governor (governor.js: step-back,
// one family when it is "a bit hard", never empty) and keeps the frontier's history ("Moved up" in the Report).
// activeFacts(d) (the week's set, custom included) · nextFact(d, now, session) · recordAnswer(d, fact, result, now,
// session) → { newlyMastered, newlyFluent, missionJustDone, status, xp, isNew } · missionState · report / reportText ·
// resetFacts · normalizeFacts (corrupt / older data → valid). Pure: no DOM, no storage (main.js loads and writes).
import { ALL_FAMILIES, OPS, STOCK_FAMILIES, difficulty, factAnswer, factFamilies, factOp, factParts, factText, famLabel, isCommutative, normFact, setFacts } from './facts.js';
import { PATTERNS_KEPT, PATTERN_KINDS, classifyMiss, famList, isSlowOnly, notePattern, patternSummary } from './patterns.js';
import { autoFacts, famInfo, ladder, noteFinished, noteProbe, pickAuto, probeDue, queueTwin, refreshFrontier as computeAndStore, startProbe, tierOf } from './adaptive.js';
import { dial, drowning, nextSlot, noteGate, noteRaceDial, raceQuota, releaseStepped, stepBack } from './governor.js';
import { checkDue, noteScout, scoutFact, scoutFamily } from './scouts.js';
import { DAYS_KEPT, RECENT_KEPT, applyAnswer, avgMs, createSession, dayKey, isFluent, isMastered, isNew, isSparse, newRecord, noteAnswered, pendingReady, pickNext, status, STATUSES, TIMES_KEPT } from './scheduler.js';

export const FACTS_VERSION = 4;
const HISTORY_KEPT = 10;
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
    scouts: {},
    vouched: {},
    stepped: {},
    gateLog: [],
    dialHistory: [],
    cleanRaces: 0,
    checkSkips: 0,
    lastCheckOfferAt: 0,
  };
  d.frontier.history = [];
  refreshFrontier(d, now);
  return d;
}
/** v1.2 sets were never edited when they are still the stock set. */
const stockSets = (s) => Array.isArray(s.families) && s.families.length === STOCK_FAMILIES.length && STOCK_FAMILIES.every((f) => s.families.includes(f))
  && s.division !== false && !s.addSub && !(Array.isArray(s.custom) && s.custom.length);

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
// storage form (compactFacts): a day list is [first day number since 1970-01-01, then the gaps] ('2026-10-20',
// '2026-10-22' → [20746, 2]); the recent answers are [[at (s), right, quick], [seconds since the one before, …], …]
const dayNum = (k) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) / 86400000;
const numDay = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const asDay = (x) => (typeof x === 'string' && /^\d{4}-\d\d-\d\d$/.test(x) ? x : Number.isInteger(x) && x > 0 && x < 100000 ? numDay(x) : null);
const asMs = (t) => (typeof t === 'number' && t > 0 && t < 1e11 ? t * 1000 : t);   // seconds (storage) or ms
const undelta = (v) => { let t = 0; return v.map((x) => (t += x)); };
const days = (v) => {
  if (!Array.isArray(v)) return [];
  const list = v.length && v.every((x) => Number.isInteger(x)) ? undelta(v) : v;
  return [...new Set(list.map(asDay).filter(Boolean))].sort().slice(-DAYS_KEPT);
};

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
    if (num(s.updatedAt) > 0) d.sets.updatedAt = num(s.updatedAt);
  }
  if (num(raw.resetAt) > 0) d.resetAt = num(raw.resetAt);
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
      if (Array.isArray(r.recent)) {
        // storage form: seconds, each after the first relative to the one before (a first stamp under 1e11 = seconds)
        const rel = r.recent.length && Array.isArray(r.recent[0]) && num(r.recent[0][0]) > 0 && num(r.recent[0][0]) < 1e11;
        let t = 0;
        const list = r.recent.filter((x) => Array.isArray(x)).map((x, i) => [rel ? (t = i ? t + num(x[0]) : num(x[0])) * 1000 : num(x[0]), x[1] ? 1 : 0, x[2] ? 1 : 0]);
        rec.recent = [...rec.recent, ...list.filter((x) => x[0] > 0)].slice(-RECENT_KEPT);
      }
      // patterns: { kind, at, given? } or the storage form [kind, at (s), given?]
      const pat = (x) => (Array.isArray(x) ? { kind: x[0], at: asMs(num(x[1])), ...(typeof x[2] === 'number' && Number.isFinite(x[2]) ? { given: x[2] } : {}) } : x);
      if (Array.isArray(r.patterns)) rec.patterns = [...rec.patterns, ...r.patterns.map(pat).filter((x) => x && PATTERN_KINDS.includes(x.kind) && num(x.at) > 0)
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
    const tierId = (v) => (typeof v === 'string' && /^T[0-7]$/.test(v) ? v : null);
    const ph = pl.phase && typeof pl.phase === 'object' ? pl.phase : {};
    d.placement = { at: num(pl.at), families: fams, tier: tierId(pl.tier), located: tierId(pl.located),
      phase: { locate: Math.floor(num(ph.locate)), zoom: Math.floor(num(ph.zoom)), twins: Math.floor(num(ph.twins)) }, checks: Math.max(1, Math.floor(num(pl.checks, 1))), items: Math.max(0, Math.floor(num(pl.items))), end: typeof pl.end === 'string' ? pl.end.slice(0, 20) : '',
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
  // v1.4 (v1.3 data has none of these: no scouts, no history)
  const FAM = /^(x|d)\d+$|^(add|sub)$/;
  if (raw.scouts && typeof raw.scouts === 'object') for (const [k, v] of Object.entries(raw.scouts)) if (FAM.test(k) && v && typeof v === 'object') d.scouts[k] = { asked: Math.max(0, Math.floor(num(v.asked))), quick: Math.max(0, Math.floor(num(v.quick))), miss: Math.max(0, Math.floor(num(v.miss))) };
  if (raw.vouched && typeof raw.vouched === 'object') for (const [k, v] of Object.entries(raw.vouched)) if (FAM.test(k) && num(v) > 0) d.vouched[k] = num(v);
  if (raw.stepped && typeof raw.stepped === 'object') for (const [k, v] of Object.entries(raw.stepped)) if (FAM.test(k) && v && FAM.test(v.back) && num(v.at) > 0) d.stepped[k] = { at: num(v.at), back: v.back };
  if (Array.isArray(raw.gateLog)) d.gateLog = raw.gateLog.filter((x) => Array.isArray(x) && num(x[0]) > 0).map((x) => [num(x[0]), x[1] ? 1 : 0, x[2] ? 1 : 0]).slice(-12);
  if (Array.isArray(raw.dialHistory)) d.dialHistory = raw.dialHistory.filter((x) => x && ['easy', 'target', 'hard'].includes(x.band) && num(x.at) > 0).map((x) => ({ at: num(x.at), band: x.band, right: Math.floor(num(x.right)), n: Math.floor(num(x.n)) })).slice(-20);
  d.cleanRaces = Math.max(0, Math.floor(num(raw.cleanRaces)));
  d.checkSkips = Math.max(0, Math.floor(num(raw.checkSkips)));
  d.lastCheckOfferAt = Math.max(0, num(raw.lastCheckOfferAt));
  const fr = raw.frontier;
  if (fr && typeof fr === 'object' && Array.isArray(fr.families)) {
    const fams = (l) => (Array.isArray(l) ? l.filter((f) => typeof f === 'string' && FAM.test(f)).slice(0, 2) : []);
    d.frontier = { families: fams(fr.families), since: num(fr.since), reason: typeof fr.reason === 'string' ? fr.reason.slice(0, 160) : '',
      history: (Array.isArray(fr.history) ? fr.history : []).filter((h) => h && num(h.at) > 0).map((h) => ({ at: num(h.at), from: fams(h.from), families: fams(h.families), why: typeof h.why === 'string' ? h.why.slice(0, 120) : '' })).slice(-HISTORY_KEPT) };
    if (!d.frontier.families.length) refreshFrontier(d, now);
  } else refreshFrontier(d, now);
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
  let p = null;
  const race = session.race;
  if (d.sets.mode === 'auto' && race) {
    // v1.4: the governor's plan for this race (frontier / known / scout / mastered), one kind per gate
    const band = dial(d).band;
    const scoutFam = band === 'hard' ? null : scoutFamily(d, now);
    const quota = raceQuota(band, race.gates, { scout: !!scoutFam });
    const slot = nextSlot(quota, race.used, race.gates - race.asked);
    const last = session.history[session.history.length - 1];
    const requeue = session.lastReason !== 'requeue' && pendingReady(session).some((x) => x.fact !== last);
    if (slot === 'scout' && scoutFam && (!requeue || race.gates - race.asked <= 1)) {
      const fact = scoutFact(d, scoutFam, rand);
      if (fact) { session.lastReason = 'scout'; p = { fact, reason: 'scout', isNew: true, bucket: 'scout', family: scoutFam }; }
    }
    if (!p) p = pickAuto(d, now, session, { ...opts, bucket: slot === 'scout' ? 'frontier' : slot, mix: null }, rand);
    if (p) {
      const kind = p.bucket === 'known' || p.bucket === 'mastered' || p.bucket === 'scout' ? p.bucket : 'frontier';
      race.used[kind] = (race.used[kind] || 0) + 1;
      race.asked += 1;
      p.band = band;
    }
  } else {
    p = d.sets.mode === 'auto' ? pickAuto(d, now, session, opts, rand) : pickNext(activeFacts(d, now), d.records, now, session, opts, rand);
  }
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
  // v1.4: the governor's window, scouts, and a fresh look at the frontier after every gate
  const quickNow = !!result.correct && !!result.quick;
  noteGate(d, !!result.correct, quickNow, now);
  let vouched = null, stepped = null, why = '';
  if (result.scout) {
    const sc = noteScout(d, result.scout, !!result.correct, quickNow, now);
    if (sc.vouched) { vouched = result.scout; why = `${sc.scout.quick} quick scouts in ${famLabel(result.scout)}`; }
  }
  if (d.sets.mode === 'auto') {
    if (dial(d).band === 'hard') {
      for (const fam of (d.frontier && d.frontier.families) || []) {
        if (!d.stepped || !d.stepped[fam]) if (factFamilies(fact).includes(fam) && drowning(d, fam) && stepBack(d, fam, now)) { stepped = fam; why = `a bit hard: ${famLabel(fam)} steps back`; }
      }
    } else if (dial(d).band === 'easy') why = why || 'a bit easy: secure families move on';
    refreshFrontier(d, now, why);
  }
  d.updatedAt = now;
  return { status: status(rec), isNew: wasNew, newlyMastered, newlyFluent, missionJustDone, xp, pattern, probe, vouched, stepped };
}

/**
 * The frontier now (v1.4): adaptive.js picks it by the ladder (secure families leave), then the governor shapes it:
 * a stepped-back family gives its place to its lower neighbour; "a bit hard" narrows it to one family (the neighbour
 * when one stepped in, else the weakest); it is never empty. A change is kept in frontier.history with why.
 */
export function refreshFrontier(d, now = Date.now(), why = '') {
  const from = ((d.frontier && d.frontier.families) || []).slice();
  const history = (d.frontier && d.frontier.history) || [];
  releaseStepped(d, now);
  const fr = computeAndStore(d, now);
  let fams = fr.families.slice();
  const L = ladder(d.sets);
  // a stepped-back family waits; its lower neighbour holds a frontier place until it is secure again
  const backIn = [];
  for (const [fam, s] of Object.entries(d.stepped || {})) {
    fams = fams.filter((f) => f !== fam);
    if (L.includes(s.back) && !backIn.includes(s.back)) backIn.push(s.back);
  }
  if (backIn.length) fams = [...backIn, ...fams.filter((f) => !backIn.includes(f))].slice(0, 2);
  const band = dial(d).band;
  if (band === 'hard' && fams.length > 1) {
    const weakest = fams.slice().sort((a, b) => famInfo(d, a, now).strength - famInfo(d, b, now).strength)[0];
    fams = [backIn[0] || weakest];
  }
  if (!fams.length) {
    // never empty: the lowest unfinished family on the ladder, else the weakest of all
    const open = L.filter((f) => !(d.stepped && d.stepped[f]) && (f[0] !== 'd' || famInfo(d, 'x' + f.slice(1), now).known));
    const info = open.map((f) => famInfo(d, f, now));
    const pick = info.filter((i) => !i.graduated && !i.secure).sort((a, b) => tierOf(a.fam) - tierOf(b.fam))[0]
      || info.sort((a, b) => a.strength - b.strength)[0];
    if (pick) fams = [pick.fam];
  }
  fams.sort((a, b) => L.indexOf(a) - L.indexOf(b));
  const same = from.length === fams.length && from.every((f, i) => f === fams[i]);
  d.frontier = { ...d.frontier, families: fams, since: same && d.frontier.since ? d.frontier.since : now, history };
  if (backIn.length) d.frontier.reason = `a bit hard: stepping back to ${famList(backIn)} for a while`;
  else if (band === 'hard' && fams.length === 1) d.frontier.reason = `a bit hard: one family at a time (${famList(fams)})`;
  if (!same && from.length) d.frontier.history = [...history, { at: now, from, families: fams.slice(), why: why || d.frontier.reason || '' }].slice(-HISTORY_KEPT);
  return d.frontier;
}

/**
 * After a race: a finished race counts toward the retention probe (every 15 finished races or 7 days) and toward the
 * clean-race count (a re-check after 5 in a row with no misses); the dial goes into its race-by-race history; the
 * frontier is recomputed (advancement / re-entry). Returns { probeStarted, frontierChanged }.
 */
export function afterRace(d, { finished = false, clean = false, gates = 0 } = {}, now = Date.now()) {
  const before = ((d.frontier && d.frontier.families) || []).join();
  if (finished) {
    noteFinished(d, now);
    if (gates) d.cleanRaces = clean ? (d.cleanRaces || 0) + 1 : 0;
  }
  if (gates) noteRaceDial(d, now);
  let probeStarted = false;
  if (finished && probeDue(d, now)) probeStarted = !!startProbe(d, now);
  refreshFrontier(d, now);
  return { probeStarted, frontierChanged: before !== d.frontier.families.join() };
}
/** v1.4: the Pit Crew Check runs before a race until placed, and offers a re-check when the placement is stale. */
export { checkDue };
export function noteCheckOffer(d, now = Date.now()) { d.lastCheckOfferAt = now; }

/** A race begins: the gate plan of the session (the governor's quota per kind, counted as the gates go). */
export function beginRace(session, gates) { session.race = { gates, asked: 0, used: {} }; return session.race; }

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
    patterns: patternSummary(d, now), placement: d.placement, lastProbe: d.lastProbe,
    moved: ((d.frontier && d.frontier.history) || []).map((h) => ({ ...h, text: `${h.from.map(famLabel).join(' ')} → ${h.families.map(famLabel).join(' ')} on ${new Date(h.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${h.why ? `: ${h.why}` : ''}` })),
    dial: dial(d), dialHistory: (d.dialHistory || []).slice(), vouched: Object.keys(d.vouched || {}) };
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
  if (r.moved.length) L.push(`Moved up: ${r.moved.slice(-5).map((x) => x.text).join(' · ')}`);
  if (r.dialHistory.length) L.push(`Level, race by race: ${r.dialHistory.slice(-8).map((x) => `${x.band === 'target' ? 'on target' : x.band === 'easy' ? 'a bit easy' : 'a bit hard'} ${x.right}/${x.n}`).join(' · ')}`);
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
  Object.assign(d, { placement: null, checkOffers: 0, raceCount: 0, lastProbeAt: 0, probeRace: 0, probe: null, lastProbe: null, pulled: {},
    scouts: {}, vouched: {}, stepped: {}, gateLog: [], dialHistory: [], cleanRaces: 0, checkSkips: 0, lastCheckOfferAt: 0 });
  d.frontier = { families: [], since: 0, reason: '', history: [] };
  refreshFrontier(d, now);
  d.updatedAt = now;
  d.resetAt = now;              // v1.6: a reset on one device wins the family-sync merge
  return d;
}

// ---------- v1.6: storage form (family sync size) ----------
const REC_DEFAULTS = { box: 0, due: 0, attempts: 0, firstTry: 0, quick: 0, seenCount: 0, lastSeen: 0, misses: 0, fixed: 0, missDay: '', totalMs: 0, answeredMs: 0, lastMs: 0, rehearsed: false, focus: false };
const REC_LISTS = ['daysCorrect', 'daysSeen', 'daysQuick', 'times', 'patterns', 'recent'];
const DAY_LISTS = ['daysCorrect', 'daysSeen', 'daysQuick'];
const sec = (ms) => Math.round(num(ms) / 1000);
/** The store as written to localStorage (and synced): every record without its default-valued fields and without its
 *  own `fact` (the key says it), day lists as day numbers, the recent answers and patterns stamped in seconds;
 *  normalizeFacts restores the full form on load. A new object; d is not changed. */
export function compactFacts(d) {
  const records = {};
  for (const [f, r] of Object.entries(d.records || {})) {
    const c = {};
    for (const [k, v] of Object.entries(r)) {
      if (k === 'fact') continue;
      if (k in REC_DEFAULTS && v === REC_DEFAULTS[k]) continue;
      if (REC_LISTS.includes(k) && Array.isArray(v) && !v.length) continue;
      if (DAY_LISTS.includes(k) && Array.isArray(v)) c[k] = v.filter((x) => typeof x === 'string' && /^\d{4}-\d\d-\d\d$/.test(x)).map(dayNum).sort((a, b) => a - b).map((x, i, a) => (i ? x - a[i - 1] : x));
      else if (k === 'recent' && Array.isArray(v)) c[k] = v.map((x, i) => [i ? sec(x[0]) - sec(v[i - 1][0]) : sec(x[0]), x[1] ? 1 : 0, x[2] ? 1 : 0]);
      else if (k === 'patterns' && Array.isArray(v)) c[k] = v.map((x) => (x.given == null ? [x.kind, sec(x.at)] : [x.kind, sec(x.at), x.given]));
      else c[k] = v;
    }
    records[f] = c;
  }
  return { ...d, records };
}

export { factAnswer, factFamilies, factParts, status, famList };

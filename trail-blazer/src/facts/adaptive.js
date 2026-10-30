// Auto mode (SPEC v1.3 §2-§3): the week's set picks itself.
// The ladder: (+ − when the parent allows them) ×2 ×5 ×10 · ×3 ×4 · ×6 ×9 · ×7 ×8 · ×11 ×12, then the ÷ twins (with
// "÷ too"; a ÷ family only once its × family is known).
// The FRONTIER = two families that are not above an untested gap (a kid never gets ×8 before ×3 is known; the gap
// counts within a section, so untested + / − never hold back tested × families), chosen by the ladder: the lowest
// unfinished tier first (not mastered, not yet secure: shaky, slow, slipped or untested), and only within a tier the
// weakest (a family that slipped, then misses, then slowness). So shaky ×6 ×9 always come before ×7 ×8. When every
// family is secure, the fluent-but-not-mastered ones fill in.
// The active set = the frontier + every known / fluent / mastered family (interleaving, spacing) + the ÷ twin of every
// known × family. Gates: ~60 % frontier, 30 % known for spacing and retention, 10 % mastered probes (after the
// session's re-queues and rehearsals, which always come first).
// A family ADVANCES (graduates) when ≥ 90 % of its facts are mastered and ≥ 70 % fluent: the next ones enter the
// frontier. It RE-ENTERS when two of its facts drop to box 0 in a week, or a retention-probe miss pulls it back.
// RETENTION PROBE: every 15 finished races or 7 days (whichever first) the next race's gates mix in 6 mastered facts
// (every other gate until all 6 are asked, carried into the next race if needed); a miss pulls its family back in.
// v1.3.2 / v1.4 SECURE (famInfo): a family the child has shown is known leaves the frontier at once (evidence, not the
// calendar; no miss in its last 8 answers), or vouched by the Pit Crew Check / 3 quick scouts (scouts.js) with no
// miss since. The difficulty governor (governor.js) and the frontier's history sit on top, in store.refreshFrontier.
import { divisionTwins, factFamilies, factParts, familyMembers, famLabel, missCountsFor, twinFamily } from './facts.js';
import { DAY_MS, dayKey, isFluent, isMastered, isNew, isSparse, pendingReady, pickNext, pickObligation } from './scheduler.js';
import { famList, inverseCluster } from './patterns.js';

export const X_LADDER = ['x2', 'x5', 'x10', 'x3', 'x4', 'x6', 'x9', 'x7', 'x8', 'x11', 'x12'];
export const D_LADDER = X_LADDER.map((f) => 'd' + f.slice(1));
export const AS_LADDER = ['add', 'sub'];
// v1.7: three tiers above ÷12 at the top of the ladder: ×10s ÷10s (T8) · teens × (T9) · big × big ÷ (T10). The frontier
// reaches them by the same rules once every table family is secure ("ran out of races, still kinda easy").
export const HIGH_LADDER = ['x10s', 'd10s', 'xteen', 'xbig', 'dbig'];
export const FRONTIER_SIZE = 2;
export const ADVANCE = { mastered: 0.9, fluent: 0.7 };
export const SECURE = { quick: 0.75, vouchSeen: 4, window: 8 };   // v1.3.2 / v1.4: evidence-based advancement (famInfo)
export const MIX = { frontier: 0.6, known: 0.3, mastered: 0.1 };
export const PROBE = { size: 6, races: 15, days: 7 };
const WEEK = 7 * DAY_MS;
const PLACEMENT_BASE = { fluent: 0.75, known: 0.5, shaky: 0.2 };

export const ladder = (sets = {}) => [...(sets.addSub ? AS_LADDER : []), ...X_LADDER, ...(sets.division !== false ? D_LADDER : []),
  ...HIGH_LADDER.filter((f) => sets.division !== false || f[0] !== 'd')];
const twinOf = twinFamily;
/** The Pit Crew Check tiers as the frontier's ladder: + − 0 · ×2 ×5 ×10 1 · ×3 ×4 2 · ×6 ×9 3 · ×7 ×8 4 · ×11 ×12 5 ·
 *  ÷ of tiers 1-2 6 · ÷ of tiers 3-5 7 · v1.7 ×10s ÷10s 8 · teens × 9 · big × big ÷ 10 */
const TIER_OF = { add: 0, sub: 0, x2: 1, x5: 1, x10: 1, x3: 2, x4: 2, x6: 3, x9: 3, x7: 4, x8: 4, x11: 5, x12: 5, x10s: 8, d10s: 8, xteen: 9, xbig: 10, dbig: 10 };
export const TOP_TIER = 10;
export const tierOf = (fam) => (fam in TIER_OF ? TIER_OF[fam] : fam[0] === 'd' && 'x' + fam.slice(1) in TIER_OF ? (TIER_OF['x' + fam.slice(1)] <= 2 ? 6 : 7) : 99);
/** The families of one ladder tier (0 … 10) on this ladder. */
export const tierFamilies = (tier, sets = {}) => ladder(sets).filter((f) => tierOf(f) === tier);

function factScore(rec) {
  if (isFluent(rec)) return 1;
  if (isMastered(rec)) return 0.9;
  return (rec.box / 3) * 0.75 + ((rec.daysQuick || []).length ? 0.1 : 0);
}

/** Everything the frontier needs to know about one family. */
export function famInfo(d, fam, now = Date.now()) {
  const facts = familyMembers(fam);
  const recs = d.records || {};
  const n = facts.length || 1;
  const seen = facts.filter((f) => !isNew(recs[f])).length;
  const mastered = facts.filter((f) => isMastered(recs[f])).length / n;
  const fluent = facts.filter((f) => isFluent(recs[f])).length / n;
  const pl = d.placement && d.placement.families && d.placement.families[fam];
  const pst = pl ? pl.status : null;
  const weekDay = dayKey(now - WEEK);
  // v1.4: a × miss judges only the harder family (missCountsFor); right answers count for both
  const judged = facts.filter((f) => missCountsFor(f, fam));
  let misses = 0;
  for (const f of judged) for (const x of (recs[f] && recs[f].patterns) || []) if (x.kind !== 'slow-only' && x.at >= now - WEEK) misses += 1;
  const slipped = judged.filter((f) => recs[f] && !isNew(recs[f]) && recs[f].box === 0 && recs[f].missDay && recs[f].missDay >= weekDay && recs[f].daysCorrect.some((x) => x < recs[f].missDay)).length;
  const pulled = !!(d.pulled && d.pulled[fam] && now - d.pulled[fam] < WEEK);
  const reentry = slipped >= 2 || pulled;
  const graduated = !reentry && mastered >= ADVANCE.mastered && fluent >= ADVANCE.fluent;
  const base = pl && pl.inferred ? PLACEMENT_BASE.fluent : PLACEMENT_BASE[pst] || 0;   // a passed tier above vouches for it
  const score = facts.reduce((a, f) => a + (isNew(recs[f]) ? base : factScore(recs[f])), 0) / n;
  const strength = reentry ? -1 : Math.max(0, score - 0.06 * misses);
  const tested = (!!pst && pst !== 'untested') || seen >= 3;
  const onePlus = facts.filter((f) => recs[f] && recs[f].box >= 1).length;
  // v1.3.2 "secure": evidence now, not the calendar. The family leaves the frontier when the child has shown it is
  // known: every fact seen was answered right (first try, or right since its miss), ≥ 75 % of the family's answers
  // were quick, and (a) every fact has been seen with at most one miss this week and none today, or (b) at least
  // 4 facts seen, all first-try, quick, with no miss ever in the family (a "vouch": ×2 is not drilled for days after
  // 4 instant answers). Spacing keeps revisiting a secure family from the known bucket; a slip brings it back.
  const today = dayKey(now);
  const ownsMiss = (r) => missCountsFor(r.fact, fam);
  const everRight = (r) => r.firstTry >= 1 || r.box >= 1 || (r.daysCorrect || []).length > 0;
  // a fact whose misses belong to the other family is "seen" here only once it was answered right
  const seenRecs = facts.map((f) => recs[f]).filter((r) => r && r.attempts > 0 && (ownsMiss(r) || everRight(r)));
  const answers = (r) => (ownsMiss(r) ? r.attempts : Math.max(1, r.attempts - (r.misses || 0)));
  const attempts = seenRecs.reduce((a, r) => a + answers(r), 0);
  const quickShare = attempts ? seenRecs.reduce((a, r) => a + (r.quick || 0), 0) / attempts : 0;
  const everMissed = seenRecs.filter(ownsMiss).reduce((a, r) => a + (r.misses || 0), 0);
  const allRight = seenRecs.length > 0 && seenRecs.every((r) => (ownsMiss(r) ? (r.firstTry >= 1 || r.box >= 1) && r.missDay !== today : everRight(r)));
  // v1.4 §3: and no miss in the family's last 8 answers. Or vouched: the Pit Crew Check found it fluent (or a passed
  // tier above vouched for it), or 3 quick scouts did (scouts.js), with no miss since.
  const recent = [];
  for (const r of seenRecs) for (const x of r.recent || []) if (x[1] || ownsMiss(r)) recent.push(x);
  recent.sort((a, b) => a[0] - b[0]);
  const last8Clean = !recent.slice(-SECURE.window).some((x) => !x[1]);
  const scoutVouch = (d.vouched && d.vouched[fam]) || 0;
  const checkVouch = pl && (pst === 'fluent' || pl.inferred) ? d.placement.at : 0;
  const vouchedAt = Math.max(scoutVouch, checkVouch);
  let missSince = 0;
  if (vouchedAt) for (const r of seenRecs.filter(ownsMiss)) for (const x of r.patterns || []) if (x.kind !== 'slow-only' && x.at >= vouchedAt) missSince += 1;
  const evidence = allRight && quickShare >= SECURE.quick && last8Clean
    && ((seenRecs.length === n && misses <= 1) || (seenRecs.length >= SECURE.vouchSeen && everMissed === 0 && seenRecs.every((r) => (ownsMiss(r) ? r.firstTry >= 1 : everRight(r)))));
  const secure = !reentry && (evidence || (!!vouchedAt && missSince === 0));   // a vouch starts a fresh window
  const known = graduated || secure || (!reentry && (pst === 'fluent' || pst === 'known' || onePlus >= Math.ceil(n * 0.6)));
  return { fam, facts, seen, mastered, fluent, misses, slipped, pulled, reentry, graduated, secure, vouched: !!scoutVouch, checkVouched: !!checkVouch, tested, known, strength, placement: pst };
}

/** The frontier now: { families, reason, info } (pure; refreshFrontier stores it). */
export function computeFrontier(d, now = Date.now()) {
  const L = ladder(d.sets);
  const info = Object.fromEntries(L.map((f) => [f, famInfo(d, f, now)]));
  const idx = (f) => L.indexOf(f);
  const unfinished = [], strong = [];
  // the gap is per section of the ladder: an untested + / − family never holds back tested × families
  const section = (f) => (f === 'add' || f === 'sub' ? 'as' : f[0]);
  const gap = {};
  for (const f of L) {
    const i = info[f];
    if (f[0] === 'd' && !(info[twinOf(f)] && info[twinOf(f)].known)) continue;     // ÷ only once its × is known
    if (i.graduated) continue;
    if (!i.tested) { unfinished.push(f); if (f[0] !== 'd') gap[section(f)] = true; continue; }
    if (gap[section(f)] && !i.reentry && f[0] !== 'd') continue;                     // above an untested gap
    if (i.secure && i.misses < 2) { strong.push(f); continue; }                       // shown known: the frontier moves on
    if (i.reentry || i.strength < 0.7) unfinished.push(f); else strong.push(f);
  }
  // the ladder first: the lowest unfinished tier, and only within a tier the weakest (misses, then slowness)
  // (untested + / −, allowed later, wait behind tested × work: they never hold it back)
  const rank = (f) => (section(f) === 'as' && !info[f].tested ? 8 : tierOf(f));
  unfinished.sort((a, b) => rank(a) - rank(b) || (info[b].reentry ? 1 : 0) - (info[a].reentry ? 1 : 0)
    || info[b].misses - info[a].misses
    // (untested families keep ladder order: re-evaluated after every gate, a first answer must not reshuffle them)
    || (info[a].tested && info[b].tested ? info[a].strength - info[b].strength : 0) || (info[b].tested ? 1 : 0) - (info[a].tested ? 1 : 0) || idx(a) - idx(b));
  strong.sort((a, b) => info[a].strength - info[b].strength || idx(b) - idx(a));
  // chosen in that order, kept in ladder order ("×6 ×9")
  const families = [...unfinished, ...strong].slice(0, FRONTIER_SIZE).sort((a, b) => idx(a) - idx(b));
  return { families, reason: frontierReason(d, families, info), info };
}

function frontierReason(d, fams, info) {
  if (!fams.length) return 'Everything in the set is mastered: mixed practice to keep it';
  const name = famList(fams);
  const back = fams.filter((f) => info[f].reentry);
  if (back.length) return `${famList(back)} came back: ${back.some((f) => info[f].pulled) ? 'missed in a retention check' : 'facts slipped this week'}`;
  const misses = fams.reduce((a, f) => a + info[f].misses, 0);
  if (misses) return `${name}: ${misses} miss${misses === 1 ? '' : 'es'} this week`;
  const st = fams.map((f) => info[f].placement);
  if (st.every((s) => s === 'shaky')) return `${name}: missed in the Pit Crew Check`;
  if (st.every((s) => s === 'known')) return `${name}: right but not quick yet in the Pit Crew Check`;
  if (fams.every((f) => !info[f].tested)) {
    const done = ladder(d.sets).filter((f) => info[f] && (info[f].graduated || info[f].known) && f[0] !== 'd');
    return done.length ? `${name}: next on the ladder after ${famList(done.slice(-3))}` : `${name}: the first tables to learn`;
  }
  return `${name}: the weakest families right now`;
}

/** Recompute and store d.frontier = { families, since, reason } (since changes only when the families do). */
export function refreshFrontier(d, now = Date.now()) {
  const f = computeFrontier(d, now);
  const prev = d.frontier && Array.isArray(d.frontier.families) ? d.frontier.families : null;
  const same = prev && prev.length === f.families.length && prev.every((x, i) => x === f.families[i]);
  d.frontier = { families: f.families, since: same && d.frontier.since ? d.frontier.since : now, reason: f.reason };
  // pulled families are only remembered for a week
  if (d.pulled) for (const [k, at] of Object.entries(d.pulled)) if (now - at >= WEEK) delete d.pulled[k];
  return d.frontier;
}

/** The auto-mode set: frontier + known / fluent / mastered families + the ÷ twins of known × families. */
export function autoFamilies(d, now = Date.now()) {
  const fr = (d.frontier && d.frontier.families) || [];
  const L = ladder(d.sets);
  const out = new Set(fr);
  for (const f of L) {
    const i = famInfo(d, f, now);
    if (f[0] === 'd') { if (famInfo(d, twinOf(f), now).known) out.add(f); continue; }
    if (i.known || i.graduated) out.add(f);
  }
  return L.filter((f) => out.has(f));
}
export function autoFacts(d, now = Date.now()) {
  return [...new Set(autoFamilies(d, now).flatMap(familyMembers))];
}

/** The three gate buckets of the active set: frontier, known (not mastered), mastered. */
export function buckets(d, active, now = Date.now()) {
  const fr = new Set(((d.frontier && d.frontier.families) || []).flatMap(familyMembers));
  const recs = d.records || {};
  const frontier = active.filter((f) => fr.has(f));
  const mastered = active.filter((f) => !fr.has(f) && isMastered(recs[f]));
  const known = active.filter((f) => !fr.has(f) && !isMastered(recs[f]));
  return { frontier, known, mastered };
}

/**
 * The next gate in auto mode: { fact, reason, isNew, bucket }. Order: a missed fact due back (re-queue) → a
 * retention-probe fact (every other gate) → the session's rehearsal → a ÷ twin due after its × fact (inverse
 * cluster) → a bucket by weight (60 / 30 / 10, empty buckets left out) → pickNext inside the bucket (due → new → free).
 */
export function pickAuto(d, now, session, opts = {}, rand = Math.random) {
  const active = opts.active || autoFacts(d, now);
  if (!active.length) return null;
  const recs = d.records || {};
  const sparse = isSparse(active, recs);
  const inSet = new Set(active);
  session.pending = session.pending.filter((p) => inSet.has(p.fact) || (d.probe && d.probe.facts.includes(p.fact)));
  session.rehearsal = session.rehearsal.filter((r) => inSet.has(r.fact));
  const last = session.history[session.history.length - 1];
  // the retention probe: every other gate (only a missed fact due back comes before it; rehearsal gaps can wait a gate)
  const requeueReady = session.lastReason !== 'requeue' && pendingReady(session).some((p) => p.fact !== last);
  const probeLeft = d.probe ? d.probe.facts.filter((f) => !d.probe.done.includes(f) && f !== last) : [];
  if (!requeueReady && probeLeft.length && session.lastReason !== 'probe') {
    session.lastReason = 'probe';
    return { fact: probeLeft[0], reason: 'probe', isNew: false, bucket: 'probe' };
  }
  const ob = pickObligation(active, recs, session, sparse);
  if (ob) return { ...ob, bucket: 'session' };
  // a ÷ twin two gates after its × fact
  const twins = (session.twins || []).filter((t) => session.history.length - t.at >= 2 && t.fact !== last);
  if (twins.length) {
    session.twins = session.twins.filter((t) => t !== twins[0]);
    session.lastReason = 'twin';
    return { fact: twins[0].fact, reason: 'twin', isNew: isNew(recs[twins[0].fact]), bucket: 'frontier' };
  }
  const b = buckets(d, active, now);
  const order = ['frontier', 'known', 'mastered'].filter((k) => b[k].some((f) => f !== last) || (k === 'frontier' && b[k].length));
  const total = order.reduce((a, k) => a + MIX[k], 0);
  let x = rand() * total, pickB = order[order.length - 1];
  for (const k of order) { x -= MIX[k]; if (x < 0) { pickB = k; break; } }
  // v1.4: the governor's race plan names the bucket (store.nextFact); an empty one falls back to the next
  if (opts.bucket && order.includes(opts.bucket)) pickB = opts.bucket;
  else if (opts.bucket) pickB = ['frontier', 'known', 'mastered'].find((k) => order.includes(k)) || pickB;
  if (pickB === 'mastered') {
    const pool = b.mastered.filter((f) => f !== last).sort((p, q) => (recs[p].lastSeen || 0) - (recs[q].lastSeen || 0));
    if (pool.length) { session.lastReason = 'mastered'; return { fact: pool[0], reason: 'mastered', isNew: false, bucket: 'mastered' }; }
  }
  const sub = b[pickB].length ? b[pickB] : active;
  const p = pickNext(sub, recs, now, session, { ...opts, skipObligations: true, sparse }, rand) || pickNext(active, recs, now, session, { ...opts, skipObligations: true, sparse }, rand);
  return p ? { ...p, bucket: b[pickB].length ? pickB : 'any' } : null;
}

/** After a × fact in auto mode with an inverse cluster: its ÷ twin comes two gates later. */
export function queueTwin(d, session, fact, now = Date.now()) {
  if (d.sets.division === false || !inverseCluster(d, now)) return;
  const p = factParts(fact);
  if (!p || p.op !== 'x') return;
  const tw = divisionTwins(fact).sort((a, b) => ((d.records[a] && d.records[a].box) || 0) - ((d.records[b] && d.records[b].box) || 0))[0];
  if (!tw) return;
  session.twins = [...(session.twins || []).filter((t) => t.fact !== tw), { fact: tw, at: session.history.length - 1 }];
}

// ---------- the retention probe ----------
/** A finished race: count it; the probe clock starts with the first one. */
export function noteFinished(d, now = Date.now()) {
  d.raceCount = (d.raceCount || 0) + 1;
  if (!d.lastProbeAt) { d.lastProbeAt = now; d.probeRace = d.raceCount - 1; }
}
export function probeDue(d, now = Date.now()) {
  if (d.probe || !d.lastProbeAt) return false;
  return (d.raceCount || 0) - (d.probeRace || 0) >= PROBE.races || now - d.lastProbeAt >= PROBE.days * DAY_MS;
}
/** Start a probe (6 mastered facts, spread over families, longest unseen first); none mastered: the clock restarts. */
export function startProbe(d, now = Date.now()) {
  const recs = d.records || {};
  const mastered = Object.values(recs).filter((r) => isMastered(r)).sort((a, b) => (a.lastSeen || 0) - (b.lastSeen || 0));
  d.lastProbeAt = now; d.probeRace = d.raceCount || 0;
  if (!mastered.length) { d.probe = null; return null; }
  const byFam = new Map();
  for (const r of mastered) { const f = factFamilies(r.fact)[0]; if (!byFam.has(f)) byFam.set(f, []); byFam.get(f).push(r.fact); }
  const facts = [];
  while (facts.length < PROBE.size && [...byFam.values()].some((l) => l.length)) for (const l of byFam.values()) if (l.length && facts.length < PROBE.size) facts.push(l.shift());
  d.probe = { facts, done: [], missed: [], at: now };
  return d.probe;
}
/** A probe fact was answered: a miss pulls its families back into the frontier; the last one closes the probe. */
export function noteProbe(d, fact, correct, now = Date.now()) {
  if (!d.probe || !d.probe.facts.includes(fact) || d.probe.done.includes(fact)) return false;
  d.probe.done.push(fact);
  if (!correct) {
    d.probe.missed.push(fact);
    d.pulled = d.pulled || {};
    for (const f of factFamilies(fact)) d.pulled[f] = now;
  }
  if (d.probe.done.length >= d.probe.facts.length) { d.lastProbe = { at: now, asked: d.probe.facts.length, missed: d.probe.missed.slice() }; d.probe = null; }
  return true;
}
export { famLabel };

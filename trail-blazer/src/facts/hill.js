// The Hill Climb's facts (SPEC v1.7 §2): the questions for one climb and how their answers count. Pure except through
// store.js (nextFact / recordAnswer), which the app already uses for the gates.
//   hillFacts(d, n = 10, now, rand) → [{ fact, flip, kind: 'frontier' | 'scout' | 'stretch', family, isNew }]
//     ≈ 40 % frontier (what nextFact would ask at a gate: the frontier, spacing, probes), 40 % scouts (the scout
//     family's never-or-rarely-asked facts), 20 % stretch (the tier after the scout's: a secure kid meets the hard
//     tiers here first). No fact twice. No scout family → more frontier facts; no tier above → more scouts;
//     everything secure → half the climb is the top tier's least recent facts (review), half what the gates ask.
//   recordHillAnswer(d, pick, { correct, quick, fixed, answeredMs, given }, now) → what recordAnswer returns
//     frontier → recordAnswer; scout → recordAnswer as a scout of its family (3 quick-right answers vouch it, a miss
//     is a scout miss); stretch → recordAnswer, and a right answer counts as a scout of its family (a stretch miss is
//     not a scout miss: the family is above the kid's level by design and must not be shut out of scouting).
// Nothing here is timed for the kid: `quick` only feeds the records, as at the gates.
import { familyMembers, isCommutative, twinFamily } from './facts.js';
import { createSession, isNew } from './scheduler.js';
import { famInfo, ladder, tierOf } from './adaptive.js';
import { scoutFamily } from './scouts.js';
import { activeFacts, nextFact, recordAnswer } from './store.js';

export const HILL_MIX = { frontier: 0.4, scout: 0.4, stretch: 0.2 };
export const HILL_QUESTIONS = 10;

const isSecure = (i) => !!(i && (i.secure || i.graduated || i.vouched));
function shuffle(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** A ÷ family is open once its × family is known. */
function openFamily(d, fam, now) {
  if (fam[0] !== 'd') return true;
  const tw = famInfo(d, twinFamily(fam), now);
  return !!(tw.known || isSecure(tw));
}
/** The families of the lowest tier above `floor` that is not secure yet (the stretch), [] when there is none. */
export function stretchFamilies(d, floor, now = Date.now()) {
  const L = ladder(d.sets || {});
  const cands = L.filter((f) => tierOf(f) > floor && openFamily(d, f, now) && !isSecure(famInfo(d, f, now)) && !(d.stepped && d.stepped[f]));
  if (!cands.length) return [];
  const t = Math.min(...cands.map(tierOf));
  return cands.filter((f) => tierOf(f) === t);
}
/** The top tier's families on the ladder (where review goes when everything is secure). */
function topFamilies(d, now) {
  const L = ladder(d.sets || {}).filter((f) => openFamily(d, f, now));
  if (!L.length) return [];
  const t = Math.max(...L.map(tierOf));
  return L.filter((f) => tierOf(f) === t);
}
/** k facts of these families (or of `facts`), the least asked (or least recent) first, ties shuffled, none in `used`. */
function leastSeen(d, fams, k, used, rand, by = 'seenCount', facts = null) {
  const recs = d.records || {};
  if (k <= 0) return [];
  const pool = shuffle([...new Set(facts || fams.flatMap(familyMembers))].filter((f) => !used.has(f)), rand)
    .sort((a, b) => ((recs[a] && recs[a][by]) || 0) - ((recs[b] && recs[b][by]) || 0));
  return pool.slice(0, k);
}
const familyOf = (fams, f) => fams.find((fam) => familyMembers(fam).includes(f)) || fams[0] || null;

/**
 * The n questions of one climb (see the header). The hill never reaches further than the gates would: its scouts
 * come from the scout family only when that is at most one tier above the frontier's lowest tier (a scout miss
 * moves the gates' scouts up a family; the hill then asks more frontier facts instead), and the stretch is the tier
 * after the scout's. A manual set (the parent picked the families) climbs on the set alone.
 */
export function hillFacts(d, n = HILL_QUESTIONS, now = Date.now(), rand = Math.random) {
  n = Math.max(1, Math.floor(Number(n) || HILL_QUESTIONS));
  const used = new Set();
  const picks = [];
  const take = (fact, kind, family) => { if (!fact || used.has(fact)) return false; used.add(fact); picks.push({ fact, kind, family }); return true; };
  const auto = !d.sets || d.sets.mode !== 'manual';
  const fr = (d.frontier && d.frontier.families) || [];
  const topTier = fr.length ? Math.max(...fr.map(tierOf)) : -1, lowTier = fr.length ? Math.min(...fr.map(tierOf)) : -1;
  let scoutFam = auto ? scoutFamily(d, now) : null;
  if (scoutFam && tierOf(scoutFam) > lowTier + 1) scoutFam = null;    // never two tiers above where the kid works
  const stretch = auto ? stretchFamilies(d, scoutFam ? tierOf(scoutFam) : topTier, now) : [];
  const allSecure = auto && !scoutFam && !stretch.length && fr.every((f) => isSecure(famInfo(d, f, now)));
  const top = allSecure ? topFamilies(d, now) : [];
  let wantF = Math.round(n * HILL_MIX.frontier), wantSc = Math.round(n * HILL_MIX.scout), wantSt = n - wantF - wantSc;
  if (!scoutFam) { wantF += wantSc; wantSc = 0; }
  if (!stretch.length) { if (scoutFam) wantSc += wantSt; else wantF += wantSt; wantSt = 0; }
  if (allSecure && top.length) { wantSt = Math.round(n / 2); wantF = n - wantSt; }   // everything secure: half the top tier's review
  // frontier: what the gates would ask (a fresh session: the climb is its own sitting); short → the set's least recent
  const session = createSession();
  for (let i = 0; i < n * 4 && picks.length < wantF; i++) {
    const p = nextFact(d, now, session, rand);
    if (!p) break;
    session.history.push(p.fact);
    take(p.fact, 'frontier', p.family || null);
  }
  if (picks.length < wantF) for (const f of leastSeen(d, [], wantF - picks.length, used, rand, 'lastSeen', activeFacts(d, now))) take(f, 'frontier', null);
  if (picks.length < wantF) { if (scoutFam) wantSc += wantF - picks.length; else if (stretch.length || top.length) wantSt += wantF - picks.length; }
  // scouts: the scout family's least-asked facts
  if (scoutFam) for (const f of leastSeen(d, [scoutFam], wantSc, used, rand)) take(f, 'scout', scoutFam);
  // stretch: the tier after the scout's (else the one above the frontier); everything secure → the top tier's least recent
  const stFams = stretch.length ? stretch : top;
  for (const f of leastSeen(d, stFams, wantSt, used, rand, stretch.length ? 'seenCount' : 'lastSeen')) take(f, 'stretch', familyOf(stFams, f));
  // still short (a small set): the ladder's open families nearest the frontier, least recent first
  if (picks.length < n) {
    const near = ladder(d.sets || {}).filter((f) => openFamily(d, f, now) && tierOf(f) <= topTier + 2);
    for (const f of leastSeen(d, near.length ? near : ladder(d.sets || {}), n - picks.length, used, rand, 'lastSeen')) take(f, 'frontier', null);
  }
  // the order up the hill: frontier and scouts mixed; the stretch facts in the upper half (the steep part)
  const out = shuffle(picks.filter((p) => p.kind !== 'stretch'), rand);
  for (const p of picks.filter((p) => p.kind === 'stretch')) {
    const lo = Math.floor(out.length / 2), span = out.length - lo + 1;
    out.splice(lo + Math.floor(rand() * span) % span, 0, p);
  }
  return out.slice(0, n).map((p) => ({ ...p, flip: isCommutative(p.fact) && rand() < 0.5, isNew: isNew((d.records || {})[p.fact]) }));
}

/** One answer of the climb (see the header). */
export function recordHillAnswer(d, pick, result = {}, now = Date.now()) {
  if (!pick || !pick.fact) return null;
  const ms = Number(result.answeredMs != null ? result.answeredMs : result.ms) || 0;
  const r = { correct: !!result.correct, quick: !!result.correct && !!result.quick, fixed: !!result.fixed, ms, given: result.given };
  if (pick.family && (pick.kind === 'scout' || (pick.kind === 'stretch' && r.correct))) r.scout = pick.family;
  return recordAnswer(d, pick.fact, r, now, null);
}

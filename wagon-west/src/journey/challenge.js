// The daily trail challenge (SPEC v1.1 §3): one goal a day on the title screen, generated from the day key and the leg
// the party is on ("Cross the Snake River with every word right"), worth a trade token and a card. Pure and JSON-safe like
// the rest of the journey: the day key is whatever string the app uses for "today" (a local date, 'YYYY-MM-DD'); the
// goal is a function of (day key, leg) only, so two devices on the same leg agree, and the first time a day is asked
// the goal is written to J.challenges[dayKey] with the counters it is measured against, so it cannot change under the
// child when the leg changes (reaching the stop moves the party to the next leg) and it can only be claimed once.
// J.challenges = { [dayKey]: { id, done, kind, legId, met, base: { camps, fished, hunted, traded, words, wordsRight } } }
// A challenge is never a gate (SPEC §1): nothing is taken away for not doing it, and the trail never needs it.
import { legOf, nationFor } from './route.js';
import { hashSeed, mulberry32, pick } from './rng.js';
import { CHALLENGE_REWARD } from './economy.js';

/** The kinds, in a fixed order (the day key picks one of those that fit the leg). */
export const CHALLENGE_KINDS = ['markers', 'supper', 'river', 'reach', 'trade', 'camp'];

const n = (x) => x | 0;
// how far a counter has come since the challenge was made (a counter that went down means a new journey: count from 0)
const since = (cur, base) => (n(cur) >= n(base) ? n(cur) - n(base) : n(cur));

function snapshot(J) {
  const T = J.totals || {};
  return { camps: n(T.camps), fished: n(T.fished), hunted: n(T.hunted), traded: n(T.traded), words: n(T.words), wordsRight: n(T.wordsRight) };
}

function stopPhrase(leg) {
  const name = (leg.stop && leg.stop.name) || leg.name;
  if (/^the /i.test(name)) return name;
  const k = leg.stop && leg.stop.kind;
  return k === 'river' || k === 'home' || /mountains$/i.test(name) ? `the ${name}` : name;
}

/** Which kinds fit this leg: river words only at a river, a trade only where a nation trades. */
export function challengeKinds(leg) {
  const l = legOf(leg);
  return CHALLENGE_KINDS.filter((k) => (k !== 'river' || (l && l.stop && l.stop.kind === 'river')) && (k !== 'trade' || (l && nationFor(l))));
}

// the live test of one kind against J and the record it was made with
function live(kind, J, rec) {
  const T = J.totals || {}, b = rec.base || {};
  const st = J.legStats || {};
  switch (kind) {
    case 'markers': {
      const all = J.trip ? J.trip.markers.length : 1;
      return J.legId === rec.legId && n(st.markers) >= all && n(st.markersRight) === n(st.markers);
    }
    case 'supper': return since(T.fished, b.fished) > 0 || since(T.hunted, b.hunted) > 0;
    case 'river': {
      const asked = since(T.words, b.words);
      return asked >= 3 && since(T.wordsRight, b.wordsRight) === asked;
    }
    case 'reach': return J.legId !== rec.legId || (!!J.trip && J.trip.legId === rec.legId && J.milesDone >= legOf(rec.legId).miles);
    case 'trade': return since(T.traded, b.traded) > 0;
    case 'camp': return since(T.camps, b.camps) > 0;
    default: return false;
  }
}

function describe(kind, leg, hunting) {
  switch (kind) {
    case 'markers': return 'Answer every marker right on this leg';
    case 'supper': return hunting ? 'Catch a fish or bring back supper' : 'Catch a fish';
    case 'river': return /^the /i.test(leg.stop.name) ? `Cross at ${leg.stop.name} with every word right` : `Cross the ${leg.stop.name} with every word right`;
    case 'reach': return `Reach ${stopPhrase(leg)}`;
    case 'trade': return 'Trade at a post';
    default: return 'Make camp once';
  }
}

function build(J, dayKey, rec) {
  const leg = legOf(rec.legId);
  const kind = rec.kind;
  const text = describe(kind, leg, !J.opts || J.opts.hunting !== false);
  return {
    id: rec.id, dayKey, kind, legId: rec.legId, text, say: text, done: !!rec.done,
    reward: { ...CHALLENGE_REWARD },
    // true once the goal has been met (and remembered: leaving the leg does not undo it)
    check(J2 = J) {
      const r = (J2.challenges && J2.challenges[dayKey]) || rec;
      if (r.met) return true;
      const ok = !!legOf(r.legId) && live(kind, J2, r);
      if (ok) r.met = true;
      return ok;
    },
  };
}

/** Today's challenge for a day key: { id, dayKey, kind, legId, text, say, done, reward: { tokens: 1, card: true },
 *  check(J) → bool }. The goal is picked from (dayKey, the current leg) and then kept in J.challenges[dayKey]; asking
 *  again the same day (even from a later leg) returns the same goal. */
export function dailyChallenge(J, dayKey) {
  const key = String(dayKey);
  if (!J.challenges || typeof J.challenges !== 'object') J.challenges = {};
  let rec = J.challenges[key];
  if (!rec || !CHALLENGE_KINDS.includes(rec.kind) || !legOf(rec.legId)) {
    const leg = legOf(J.legId);
    const kinds = challengeKinds(leg);
    const kind = pick(mulberry32(hashSeed('challenge', key, leg.id)), kinds);
    rec = J.challenges[key] = { id: `${key}|${kind}|${leg.id}`, done: !!(rec && rec.done), kind, legId: leg.id, met: false, base: snapshot(J) };
  }
  return build(J, key, rec);
}

/** Claim a challenge's reward: once per day key, and only when its goal is met. Adds the token to J.tokens and returns
 *  { ok: true, tokens: 1, card: true } (the app then draws the card: cardForLeg + awardCard), else { ok: false }. */
export function claimChallenge(J, id) {
  const key = String(id).split('|')[0];
  const rec = J.challenges && J.challenges[key];
  if (!rec || rec.id !== id || rec.done) return { ok: false };
  const ch = build(J, key, rec);
  if (!ch.check(J)) return { ok: false };
  rec.done = true;
  J.tokens = n(J.tokens) + ch.reward.tokens;
  return { ok: true, tokens: ch.reward.tokens, card: ch.reward.card };
}

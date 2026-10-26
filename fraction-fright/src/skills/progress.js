// The week's progress for the Parent Zone (SPEC §9; parent-facing only, never on the kid's screens).
//   ladderPct    steps reached on the playable ladder: each street counts started / working / secure (3 steps), so
//                Maple Street working and Oak Lane started = (2 + 1) / 6 = 50 %
//   accuratePct  this week's throws on target (hit or bull) / throws, the last 7 days (null when there were none)
//   closePct     100 − the week's mean PAE (null when none)
//   movedUp      streets that moved up (to working or secure) in the last 7 days
import { PLAYABLE, TIER_BY_ID } from './items.js';
import { tierState } from './ladder.js';
import { dayKey, stateWord } from './store.js';

const STEP = { new: 0, practice: 1, working: 2, secure: 3 };
const RANK = { new: 0, practice: 1, working: 2, secure: 3 };

export function weekProgress(d, now = Date.now()) {
  const states = PLAYABLE.map((t) => ({ tier: t, state: tierState(d, t) }));
  const steps = states.reduce((a, s) => a + STEP[s.state], 0);
  const ladderPct = Math.round((100 * steps) / (3 * PLAYABLE.length));
  const from = dayKey(now - 6 * 86400000), to = dayKey(now);
  let throws = 0, hits = 0, bulls = 0, pae = 0;
  for (const [k, v] of Object.entries(d.days || {})) if (k >= from && k <= to) { throws += v.throws; hits += v.hits; bulls += v.bulls; pae += v.pae; }
  const weekAgo = now - 7 * 86400000;
  const movedUp = [];
  for (const m of d.moves || []) if (m.at >= weekAgo && RANK[m.to] > RANK[m.from] && RANK[m.to] >= RANK.working && !movedUp.includes(m.tier)) movedUp.push(m.tier);
  const waves = (d.waves || []).filter((w) => w.at >= weekAgo).length;
  return {
    states, steps, ladderPct,
    throwsThisWeek: throws, hitsThisWeek: hits, bullsThisWeek: bulls, wavesThisWeek: waves,
    accuratePct: throws ? Math.round((100 * hits) / throws) : null,
    closePct: throws ? Math.max(0, Math.round(100 - pae / throws)) : null,
    movedUp: PLAYABLE.filter((t) => movedUp.includes(t)),
  };
}
const names = (list) => list.map((t) => TIER_BY_ID[t].name).join(', ');
/** Two report lines: the ladder, and the week. */
export function weekProgressLines(w) {
  const ladder = `Ladder: ${w.ladderPct} % (${w.states.map((s) => `${TIER_BY_ID[s.tier].name} ${stateWord(s.state)}`).join(', ')})`;
  const moved = w.movedUp.length ? ` · moved up: ${names(w.movedUp)}` : '';
  const week = w.throwsThisWeek
    ? `This week: ${w.accuratePct} % accurate (${w.hitsThisWeek} of ${w.throwsThisWeek} throws on target) · ${w.closePct} % close on average${moved}`
    : `This week: no waves this week${moved}`;
  return [ladder, week];
}

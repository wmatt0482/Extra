// The Lab's cross-game streak: one more instance of the shared streak object (car-jump/src/meta/engagement.js), with the weekly shield
// and the spare freeze a day's quests earn (lab/SPEC.md §3.5). PURE. A day counts when any game reports its `day` event.
import { completeDay, earnBonusFreeze, defaultCosmetics, refreshStreak, streakFreezes, streakNow } from '../../../spell-jump/src/meta/engagement.js';
import { dayKey } from '../../../spell-jump/src/spelling/scheduler.js';

// engagement.js works on a game save; the Lab's streak lives in lab.streak, so it is wrapped in a throwaway save (as Trail Blazer's season.js does)
const shim = (lab) => ({ streak: lab.streak, crates: { earned: 0 }, cosmetics: defaultCosmetics(), xp: 0 });

/** The streak shown right now (0 once it can no longer be covered). */
export const labStreakNow = (lab, now) => streakNow(lab.streak, now);
/** The player opened the Lab or a game: missed days since the last counted day use the week's shield, then a banked spare. Returns the days newly covered. */
export const labRefresh = (lab, now) => refreshStreak(shim(lab), now);
/** Count today. Returns { counted, count, best, milestone, bonusFreezeEarned: false, covered }; a milestone is the caller's cue to earn the crate. */
export function labDayDone(lab, ctx) {
  const out = completeDay(shim(lab), ctx.now);
  return { counted: out.counted, count: out.count, best: out.best, milestone: out.milestone, bonusFreezeEarned: false, covered: [...(out.shields || []), ...(out.bonus || [])] };
}
/** A day's quests are all done: bank a spare freeze (once a week, none already banked). */
export const earnLabBonusFreeze = (lab, now) => earnBonusFreeze(lab.streak, now);
/** { weeklyReady, bonus }: the week's shield is ready (or spent) and the spare freezes banked. */
export const freezeView = (lab, now) => streakFreezes(lab.streak, now);
export const labStreakInfo = (lab, now) => ({ count: labStreakNow(lab, now), best: lab.streak.best, lastDay: lab.streak.lastDay, today: dayKey(now), ...freezeView(lab, now) });

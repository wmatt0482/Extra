// The Sky Road (v3.10): the effort meter that leads to the Sky Era (the next era of Spell Jump, not built yet). Pure, no
// DOM; unit-tested in tools/spelling-tests.mjs.
//
// One step per mission day: the days in save.streak.days (the local days on which the daily mission, 8 words, or the Friday
// Test was completed; engagement.js completeDay, kept to the last 120, unioned across devices by sync/merge.js mergeStreak)
// that are on or after SKY_ROAD_START. Everyone starts at 0 on release day; a day counts once, so one step a day at most.
// The road has 15 steps; at 15 the Sky Gate glows ("The Sky Era is on its way."). Nothing on the road is ever taken away,
// nothing locks, there is no date and no countdown: a missed day simply adds no step.
//
// The teaser (src/ui/skyTeaser.js) plays once in full; the clip at 4, 8 and 12 steps ("Your Sky Road grew!") and the gate
// clip at 15 play once each. Seen state: save.seen.teaser (bool, the full teaser started once) and save.seen.skyClip (the
// highest milestone whose clip has played). Both merge across devices (teaser = OR, skyClip = max) so nothing replays on
// every device.

export const SKY_ROAD_START = '2026-11-06';
export const SKY_ROAD_STEPS = 15;
export const MILESTONES = [4, 8, 12, 15];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Steps on the road: counted mission days on or after SKY_ROAD_START, at most 15. */
export function skyRoadSteps(save) {
  const days = save && save.streak && Array.isArray(save.streak.days) ? save.streak.days : [];
  const n = new Set(days.filter((d) => typeof d === 'string' && DAY_RE.test(d) && d >= SKY_ROAD_START)).size;   // ISO days compare as strings
  return Math.min(SKY_ROAD_STEPS, n);
}

/** The highest milestone reached with this many steps (0 below the first). */
export const milestoneFor = (steps) => MILESTONES.filter((m) => m <= steps).pop() || 0;

/** What the title should play now: { kind: 'full', step } (the full teaser has not started yet on any device),
 *  { kind: 'clip', step: m } (milestone m reached and its clip not played yet; several crossed at once: only the highest),
 *  or null. step = the road's steps for the full teaser, the milestone for a clip. */
export function teaserDue(save) {
  const seen = (save && save.seen) || {};
  const steps = skyRoadSteps(save);
  if (!seen.teaser) return { kind: 'full', step: steps };
  const m = milestoneFor(steps);
  return m > (Number(seen.skyClip) || 0) ? { kind: 'clip', step: m } : null;
}

/** Mark what is starting as seen (called when it STARTS, so a tab closed halfway does not loop it). The full teaser shows the
 *  road as it is, so the milestones already reached count as seen too; a clip marks its milestone and every lower one. */
export function markTeaserSeen(save, due) {
  if (!save || !due) return save;
  if (!save.seen || typeof save.seen !== 'object') save.seen = {};
  const prev = Number(save.seen.skyClip) || 0;
  if (due.kind === 'full') {
    save.seen.teaser = true;
    save.seen.skyClip = Math.max(prev, milestoneFor(skyRoadSteps(save)));
  } else if (due.kind === 'clip') {
    save.seen.skyClip = Math.max(prev, milestoneFor(Math.min(SKY_ROAD_STEPS, Number(due.step) || 0)));
  }
  return save;
}

/** The child's first name for the rings of the second jump: letters A-Z only, uppercase, at most 8; "SKY" when nothing is left. */
export function skyName(name) {
  const s = String(name == null ? '' : name).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
  return s || 'SKY';
}

// ---------- the teaser's spoken lines (natural-voice clips only; never the device voice) ----------
// Name-free and number-free except the pre-made milestone lines, so every clip is the same for every child and caches.
export const SKY_LINES = {
  hook: "What's up above the clouds?",
  era: 'The Sky Era.',
  rides: 'New tracks. New rides.',
  jump: 'And a second jump you earn by spelling.',
  road: 'Every mission you finish builds your road to the sky.',
  gate: 'You made it to the Sky Gate! The Sky Era is on its way.',
};
/** The milestone clip's line ("Your Sky Road grew! Step 8 of 15."). Spoken only for 4 / 8 / 12 (pre-made clips). */
export const stepLine = (n) => `Your Sky Road grew! Step ${n} of ${SKY_ROAD_STEPS}.`;
/** The meter as text ("Sky Road: 3 / 15"): shown, never spoken. */
export const roadText = (n) => `Sky Road: ${n} / ${SKY_ROAD_STEPS}`;
/** Every line to prepare as a natural-voice clip (9 short texts). */
export const teaserTexts = () => [...Object.values(SKY_LINES), ...MILESTONES.filter((m) => m < SKY_ROAD_STEPS).map(stepLine)];

// v3.9.1: when to look for a new class-list week (src/data/classLists.js, wordStore.js autoClassList) on a device that
// stays open. Before 3.9.1 the check ran only when a player was chosen or a sync arrived, so an iPad that kept Spell
// Jump open since last week never picked up the new week. Now src/main.js also checks when the page becomes visible
// again, every time the title screen is shown and once an hour while the page is open. Pure logic (no DOM), so
// tools/spelling-tests.mjs covers it.
//
// Never during a run: a new list would swap the words under the child (and the spell panel, a Qualifier or a Friday
// Test read the current list). A check that is not allowed now stays pending; the next allowed moment runs it (the
// title after the run, the Parent Zone closing, the page coming back to the front).

export const CLASS_CHECK_EVERY_MS = 60 * 60 * 1000;
/** The screens where a new week may apply: the menus with a player chosen (the picker applies it on its own). */
export const CLASS_CHECK_SCREENS = Object.freeze(['title', 'garage', 'tracks']);

/** True when a new class-list week may apply now. */
export function classCheckAllowed({ screen, hasPlayer = true, running = false, spelling = false, testing = false, parentZone = false, hidden = false } = {}) {
  return !!hasPlayer && CLASS_CHECK_SCREENS.includes(screen) && !running && !spelling && !testing && !parentZone && !hidden;
}

/** Which events run the check: 'visible' (the page came back to the front), 'title' (the title screen was shown),
 *  'hourly' (the page stayed open an hour), 'sync' (the player's words arrived from another device). Any other screen
 *  shown only runs a check that is pending. */
export function classCheckWanted(reason, pending = false) {
  if (reason === 'visible' || reason === 'title' || reason === 'hourly' || reason === 'sync') return true;
  return !!pending;
}

/** The hourly timer fires at most once an hour (a timer that wakes early, or twice after a sleep, does not repeat it). */
export function hourlyCheckDue(lastAt, now, every = CLASS_CHECK_EVERY_MS) {
  return !(lastAt > 0) || now - lastAt >= every;
}

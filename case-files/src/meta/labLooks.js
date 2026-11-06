// Case Files' looks for the Lab (lab/SPEC.md §3.3, §4.3). The Lab loads this module lazily (GAME_MODULES.cf) and shows or drops an
// item only if its id is in LOOKS_READY. Case Files has no Lab shop items in v0.1 (a game that makes a child wait a day for the
// next case does not sell things), so the list is empty: the Lab shows no Case Files shelf and the game draws its own look.
export const LOOKS_READY = Object.freeze([]);

/** From lab.cosmetics('cf') to the looks to draw: none in v0.1. */
export function labLooks() { return { }; }

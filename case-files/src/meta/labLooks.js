// Case Files' looks for the Lab (lab/SPEC.md §3.3, §4.3; lab/docs/COHESION.md). The Lab loads this module lazily (GAME_MODULES.cf) and shows or drops an
// item only if its id is in LOOKS_READY. The Lab's shop has a Case Files tab of detective looks, and the Lab paints them itself on its avatar and in
// the shop; the game draws the same three slots on the player card from lab.cosmetics('cf').slots = { hat, badge, coat } (stage 2 of the cohesion round).
export const LOOKS_READY = Object.freeze(['cf.hat.detcap', 'cf.hat.deerstalker', 'cf.badge.magnifier', 'cf.badge.goldbadge', 'cf.coat.tweed', 'cf.coat.trench']);

/** From lab.cosmetics('cf') to the looks to draw: none in v0.1. */
export function labLooks() { return { }; }

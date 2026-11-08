// Case Files' looks for the Lab (lab/SPEC.md §3.3, §4.3; lab/docs/COHESION.md). The Lab loads this module lazily (GAME_MODULES.cf) and shows or drops an
// item only if its id is in LOOKS_READY. The Lab's shop has a Case Files tab of detective looks, and the Lab paints them itself on its avatar and in
// the shop; the game draws the same three slots on the player card from lab.cosmetics('cf').slots = { hat, badge, coat } (stage 2 of the cohesion round).
export const LOOKS_READY = Object.freeze(['cf.hat.detcap', 'cf.hat.deerstalker', 'cf.badge.magnifier', 'cf.badge.goldbadge', 'cf.coat.tweed', 'cf.coat.trench']);

/** From a slots object ({ hat, badge, coat }: item ids or null, as lab.cosmetics('cf').slots / lab.cosmeticsOf(id, 'cf').slots) to the looks to draw:
 *  only ids listed in LOOKS_READY, each in its own slot; anything else is null (the game's own look). */
export function labLooks(slots) {
  const s = slots || {};
  const ok = (key, v) => (typeof v === 'string' && v.startsWith(key + '.') && LOOKS_READY.includes(v) ? v : null);
  return { hat: ok('cf.hat', s.hat), badge: ok('cf.badge', s.badge), coat: ok('cf.coat', s.coat) };
}

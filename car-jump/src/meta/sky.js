// The Sky Era's state in a child's save (v4.0): save.sky = { unlocked, at, ceremonySeen, era }. Pure, no DOM; unit-tested in
// tools/spelling-tests.mjs.
//
//   unlocked      the era is open: the Sky Road reached 15 / 15 (autoUnlock) or a parent tapped "Open the Sky Era now" (unlockSky 'parent')
//   at            when it opened (ms; 0 while locked); merged across devices as the earliest
//   ceremonySeen  the one-time unlock ceremony has started on some device (merged OR, so it plays once per child, not once per device)
//   era           'earth' | 'sky': the tab the child last chose (merged from the later doc); a locked era is always 'earth'
//
// Nothing here ever takes anything away: no save ever goes back to locked, and Earth is never blocked.
import { SKY_ROAD_STEPS, milestoneFor, skyRoadSteps } from './skyRoad.js';
import { skyAvailable } from './skyData.js';

export const ERAS = ['earth', 'sky'];
export const defaultSky = () => ({ unlocked: false, at: 0, ceremonySeen: false, era: 'earth' });

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Coerce whatever was stored. A locked era cannot be the chosen one; an unlocked one has an `at` (now-ish when it was missing). */
export function normalizeSky(raw) {
  const d = defaultSky();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d;
  d.unlocked = raw.unlocked === true;
  d.at = d.unlocked ? Math.max(0, Math.floor(num(raw.at))) : 0;
  d.ceremonySeen = d.unlocked && raw.ceremonySeen === true;
  d.era = d.unlocked && raw.era === 'sky' ? 'sky' : 'earth';
  return d;
}

/** Family-sync merge of two saves' sky blocks: unlocked OR, at = the earliest non-zero, ceremonySeen OR, era from the later doc (`later` = the side that won). */
export function mergeSky(later, other) {
  const a = normalizeSky(later), b = normalizeSky(other);
  const unlocked = a.unlocked || b.unlocked;
  const ats = [a, b].filter((x) => x.unlocked && x.at > 0).map((x) => x.at);
  return normalizeSky({
    unlocked,
    at: ats.length ? Math.min(...ats) : 0,
    ceremonySeen: a.ceremonySeen || b.ceremonySeen,
    // the later doc's choice, unless that doc has not unlocked the era (then the other's)
    era: a.unlocked ? a.era : b.era,
  });
}

export const skyUnlocked = (save) => !!(save && save.sky && save.sky.unlocked);
/** The era the app shows now: the saved choice, but 'earth' whenever the sky is locked or has no data. */
export const currentEra = (save) => (skyUnlocked(save) && skyAvailable() && save.sky.era === 'sky' ? 'sky' : 'earth');

/** Open the era (a parent's "Open the Sky Era now" and the road's 15 / 15 do the same thing). Returns true when this call opened it. */
export function unlockSky(save, now = Date.now()) {
  if (!save) return false;
  if (!save.sky || typeof save.sky !== 'object') save.sky = defaultSky();
  if (save.sky.unlocked) return false;
  save.sky.unlocked = true;
  save.sky.at = Math.max(1, Math.floor(now));
  return true;
}

/** The road is complete (15 / 15) and the era has tracks: open it. Returns true when it just opened. */
export function autoUnlock(save, now = Date.now()) {
  if (!save || skyUnlocked(save) || !skyAvailable()) return false;
  if (skyRoadSteps(save) < SKY_ROAD_STEPS) return false;
  return unlockSky(save, now);
}

/** Remember the child's tab. A locked sky cannot be chosen. Returns the era now saved. */
export function setEra(save, era) {
  if (!save) return 'earth';
  if (!save.sky || typeof save.sky !== 'object') save.sky = defaultSky();
  save.sky.era = save.sky.unlocked && era === 'sky' ? 'sky' : 'earth';
  return save.sky.era;
}

/** The ceremony is due: open, not seen, and the era has something to show. */
export const ceremonyDue = (save) => skyUnlocked(save) && !save.sky.ceremonySeen && skyAvailable();
/** Mark the ceremony as started (called when it STARTS, like the teaser): it also counts as the teaser and every road clip seen. */
export function markCeremonySeen(save) {
  if (!save) return save;
  if (!save.sky || typeof save.sky !== 'object') save.sky = defaultSky();
  if (save.sky.unlocked) save.sky.ceremonySeen = true;
  if (!save.seen || typeof save.seen !== 'object') save.seen = {};
  save.seen.teaser = true;
  save.seen.skyClip = Math.max(Number(save.seen.skyClip) || 0, milestoneFor(skyRoadSteps(save)));
  return save;
}

/** "Sky Era · 2 / 5 tracks" for the Lab card (tracks finished = tracks whose successor is open or whose finish line was reached). */
export function skyTracksText(save, tracks) {
  const list = Array.isArray(tracks) ? tracks : [];
  const open = list.filter((t) => !t.unlockedBy || (save.unlocked || []).includes(t.id)).length;
  return `Sky Era · ${open} / ${list.length} tracks`;
}

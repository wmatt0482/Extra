// Lab XP, levels, titles, the avatar's frames, the pet's stages and the slots that open by level (lab/SPEC.md §2.3). PURE.
import { ITEMS, SLOTS } from '../data/catalog.js';

export const LEVEL_MAX = 100;
/** XP needed to reach level n (cumulative; level 1 is 0): round(100 * (n-1)^1.6 / 50) * 50. */
export const xpToReach = (level) => {
  const n = Math.max(1, Math.min(LEVEL_MAX, Math.floor(level) || 1));
  return n <= 1 ? 0 : Math.round((100 * Math.pow(n - 1, 1.6)) / 50) * 50;
};
const TABLE = Array.from({ length: LEVEL_MAX + 1 }, (_, n) => (n === 0 ? 0 : xpToReach(n)));
export const XP_TABLE = Object.freeze(TABLE.slice(1));          // index 0 = level 1

export function levelFor(xp) {
  const x = Math.max(0, Number(xp) || 0);
  let lo = 1, hi = LEVEL_MAX;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (TABLE[mid] <= x) lo = mid; else hi = mid - 1; }
  return lo;
}

export const TITLES = [[1, 'Cadet'], [10, 'Scout'], [20, 'Ranger'], [30, 'Captain'], [40, 'Pioneer'], [50, 'Commander'], [60, 'Inventor'], [70, 'Master'], [80, 'Legend'], [90, 'Lab Legend']];
export const titleFor = (level) => { let t = TITLES[0][1]; for (const [l, name] of TITLES) if (level >= l) t = name; return t; };
export const FRAME_LEVELS = [10, 25, 50, 75, 100];
/** The avatar's frame: 0 for none, else 1..5 (the number of frame levels reached). */
export const frameFor = (level) => FRAME_LEVELS.filter((l) => level >= l).length;
export const PET_STAGE_LEVELS = [1, 8, 20, 40, 70];            // baby, young, grown, big, legend
export const petStage = (level) => PET_STAGE_LEVELS.filter((l) => level >= l).length || 1;

/** { level, title, into, need, toNext, next, max }: into = XP into this level, need = the level's span, toNext = XP still to go. */
export function levelProgress(xp) {
  const x = Math.max(0, Math.floor(Number(xp) || 0));
  const level = levelFor(x);
  if (level >= LEVEL_MAX) return { level, title: titleFor(level), into: x - TABLE[level], need: 0, toNext: 0, next: null, max: true };
  const need = TABLE[level + 1] - TABLE[level], into = x - TABLE[level];
  return { level, title: titleFor(level), into, need, toNext: need - into, next: level + 1, max: false };
}

/** slot key -> the level it opens at (avatar, pet and home slots; a game's slots are open from level 1). */
export const SLOT_LEVEL = Object.freeze(Object.fromEntries(SLOTS.map((s) => [s.key, s.open])));
export const slotOpen = (level, slotKey) => level >= (SLOT_LEVEL[slotKey] ?? 1);
/** level -> item id, the free gifts (shown as New!, never sold). */
export const LEVEL_GIFTS = Object.freeze(Object.fromEntries(ITEMS.filter((i) => i.source === 'gift' && i.level).map((i) => [i.level, i.id])));

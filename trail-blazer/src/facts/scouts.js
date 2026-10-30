// Scout gates and re-checks (SPEC v1.4 §4-§5): placement that never stops.
// SCOUTS: in a race with ≥ 4 gates one gate (two when the governor says "a bit easy", none when "a bit hard") is a
// scout: a never-asked fact from the lowest family above the frontier's lowest tier that is not secure yet, has no
// scout miss and no miss in its last 8 answers (untested families first in ladder order; a family still waiting in the
// frontier as the "next up" filler can be scouted). Three quick-right scouts with no scout miss VOUCH the family:
// secure without ever working on it in the frontier (its ÷ twin joins the gates). A scout miss costs nothing beyond
// the normal fix-it routine; the family just waits its turn. Scouts are ordinary first-sight answers in the records.
// RE-CHECKS: the Pit Crew Check offers itself again before a race after 14 days, or when the placement looks stale:
// 5 finished races in a row with no misses, or the frontier two tiers above the placed tier.
import { factKey, familyMembers, isTableFamily, twinFamily } from './facts.js';
import { DAY_MS, isNew } from './scheduler.js';
import { famInfo, ladder, tierOf } from './adaptive.js';
import { familyRecent } from './governor.js';

export const SCOUTS_TO_VOUCH = 3;
export const RECHECK = { days: 14, cleanRaces: 5, tiersAbove: 2 };
/** v1.6.1 (Matt: "the kid can't just keep skipping"): "Race first" works CHECK_SKIPS times per check; after that the
 *  card has only Start and the way out of the check leads to the title, not a race. A finished check resets it. */
export const CHECK_SKIPS = 2;
export const canSkipCheck = (d) => (Number(d && d.checkSkips) || 0) < CHECK_SKIPS;
export function noteCheckSkip(d) { d.checkSkips = (Number(d.checkSkips) || 0) + 1; return d.checkSkips; }
export const checkSkipsLeft = (d) => Math.max(0, CHECK_SKIPS - (Number(d && d.checkSkips) || 0));
const tierNum = (id) => Number(String(id || '').slice(1));
const twinOf = twinFamily;
const isSecure = (i) => !!(i && (i.secure || i.graduated || i.vouched));

/** The family the next scout comes from, or null. */
export function scoutFamily(d, now = Date.now()) {
  const fr = (d.frontier && d.frontier.families) || [];
  if (!fr.length) return null;
  const floor = Math.min(...fr.map(tierOf));
  const L = ladder(d.sets);
  const cands = [];
  for (const fam of L) {
    if (tierOf(fam) <= floor) continue;
    if (fam[0] === 'd') { const tw = famInfo(d, twinOf(fam), now); if (!(tw.known || isSecure(tw))) continue; }
    const i = famInfo(d, fam, now);
    if (isSecure(i) || i.reentry) continue;
    if (d.stepped && d.stepped[fam]) continue;
    const sc = d.scouts && d.scouts[fam];
    if (sc && sc.miss) continue;
    if (familyRecent(d, fam).slice(-8).some((x) => !x[1])) continue;
    if (i.placement === 'shaky') continue;
    if (!familyMembers(fam).some((f) => isNew(d.records[f]))) continue;
    cands.push(fam);
  }
  cands.sort((a, b) => tierOf(a) - tierOf(b) || L.indexOf(a) - L.indexOf(b));
  return cands[0] || null;
}
/** A never-asked fact of the family (other number 3 … 9 first; v1.7 families: any of their facts). */
export function scoutFact(d, fam, rand = Math.random) {
  const fresh = familyMembers(fam).filter((f) => isNew(d.records[f]));
  if (!fresh.length) return null;
  const n = Number(fam.slice(1));
  const other = (f) => {
    if (!isTableFamily(fam) || fam === 'add' || fam === 'sub') return 5;
    if (fam[0] === 'd') return Number(f.split('/')[0]) / n;
    const [a, b] = f.split('x').map(Number); return a === n ? b : a;
  };
  const mid = fresh.filter((f) => { const m = other(f); return m >= 3 && m <= 9; });
  const pool = mid.length ? mid : fresh;
  return pool[Math.floor(rand() * pool.length) % pool.length];
}
/** A scout was answered: 3 quick-right with no miss vouches the family. Returns { vouched }. */
export function noteScout(d, fam, right, quick, at = Date.now()) {
  d.scouts = d.scouts || {};
  const s = d.scouts[fam] || (d.scouts[fam] = { asked: 0, quick: 0, miss: 0 });
  s.asked += 1;
  if (!right) s.miss += 1;
  else if (quick) s.quick += 1;
  let vouched = false;
  if (s.quick >= SCOUTS_TO_VOUCH && !s.miss && !(d.vouched && d.vouched[fam])) {
    d.vouched = d.vouched || {};
    d.vouched[fam] = at;
    vouched = true;
  }
  return { vouched, scout: { ...s } };
}

/** Is the Pit Crew Check due before this race? { due, kind: 'first' | 'recheck', why } */
export function checkDue(d, now = Date.now()) {
  if (!d.placement) return { due: true, kind: 'first', why: 'not placed yet' };
  const days = (now - d.placement.at) / DAY_MS;
  if (days >= RECHECK.days) return { due: true, kind: 'recheck', why: `${Math.floor(days)} days since the last check` };
  if ((d.cleanRaces || 0) >= RECHECK.cleanRaces) return { due: true, kind: 'recheck', why: `${d.cleanRaces} races in a row with no misses` };
  const fr = (d.frontier && d.frontier.families) || [];
  const placed = tierNum(d.placement.tier);
  if (fr.length && placed && Math.min(...fr.map(tierOf)) >= placed + RECHECK.tiersAbove && Math.min(...fr.map(tierOf)) <= 5) return { due: true, kind: 'recheck', why: 'the frontier is two tiers above the check' };
  return { due: false, kind: '', why: '' };
}
/** Days until the 14-day re-check (0 when due). */
export const recheckInDays = (d, now = Date.now()) => (d.placement ? Math.max(0, Math.ceil(RECHECK.days - (now - d.placement.at) / DAY_MS)) : 0);
/** Where the re-check starts: the frontier's lowest × tier (T1 … T5, v1.7 T8 … T10 when the check has them), else T3. */
export function recheckStart(d) {
  const fr = ((d.frontier && d.frontier.families) || []).map(tierOf).filter((t) => (t >= 1 && t <= 5) || (t >= 8 && t <= 10));
  return fr.length ? `T${Math.min(...fr)}` : 'T3';
}
export { factKey };

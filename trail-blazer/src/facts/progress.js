// The week's progress for the Parent Zone (v1.6.2; parent-facing only, never shown to the child). Pure.
//   weekProgress(d, now) → { ladderFamilies, secureFamilies, ladderPct, gatesThisWeek, rightThisWeek, rightPct,
//                            movedUp, frontier }
// ladderPct: the families of the player's ladder (the tiers in play: + − when on, × , ÷ when on) that are secure,
//   graduated or vouched (scouts / the Pit Crew Check), over the ladder, a whole number. rightPct: first-try right
//   answers over the gates answered in the last 7 days (null when no race this week). movedUp: families that left
//   the frontier in the last 7 days (and are known now: a step back to an easier family is not "moved up") or were
//   vouched in the last 7 days, in ladder order.
import { famInfo, ladder } from './adaptive.js';
import { famLabel } from './facts.js';

const WEEK = 7 * 86400000;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);

export function weekProgress(d, now = Date.now()) {
  const L = ladder(d.sets || {});
  const since = now - WEEK;
  const info = new Map(L.map((f) => [f, famInfo(d, f, now)]));
  const vouched = d.vouched || {};
  const secure = L.filter((f) => { const i = info.get(f); return i.secure || i.graduated || vouched[f] > 0; });
  const races = (d.races || []).filter((r) => r.at >= since);
  const gates = races.reduce((a, r) => a + (r.asked || 0), 0);
  const right = races.reduce((a, r) => a + (r.correct || 0), 0);
  const moved = new Set();
  for (const h of ((d.frontier && d.frontier.history) || [])) {
    if (!(h.at >= since)) continue;
    for (const f of h.from || []) if (!(h.families || []).includes(f) && info.has(f) && (info.get(f).known || info.get(f).secure)) moved.add(f);
  }
  for (const [f, at] of Object.entries(vouched)) if (at >= since && info.has(f)) moved.add(f);
  return {
    ladderFamilies: L.length, secureFamilies: secure.length, ladderPct: pct(secure.length, L.length),
    gatesThisWeek: gates, rightThisWeek: right, rightPct: pct(right, gates),
    movedUp: L.filter((f) => moved.has(f)), frontier: ((d.frontier && d.frontier.families) || []).slice(),
  };
}
/** "×6 ×9" */
export const famText = (list) => list.map(famLabel).join(' ');
/** The two report lines (the Report tab, Copy report). */
export function weekProgressLines(w) {
  return [
    `Ladder: ${w.ladderPct == null ? '—' : `${w.ladderPct} %`} of families secure (${w.secureFamilies} of ${w.ladderFamilies})`,
    w.gatesThisWeek ? `This week: ${w.rightPct} % right at the gates (${w.rightThisWeek} of ${w.gatesThisWeek})${w.movedUp.length ? ` · moved up: ${famText(w.movedUp)}` : ''}`
      : `This week: no races this week${w.movedUp.length ? ` · moved up: ${famText(w.movedUp)}` : ''}`,
  ];
}

// Ghost Chase's ghosts (lab/SPEC.md §4.2). A ghost is the best finished run on a trail, sampled every 0.1 s ([t, x, y, angle]).
// The child's own is in their save (`ghosts[trailId]`); a sibling's is in THEIR save (`trailBlazer.<id>.save`), which the family sync
// already mirrors onto this device (the `<id>.tb` kind), so no new sync is needed. peekGhosts() READS those saves and never writes one.
// Pure apart from the storage read (injectable, so tests need no browser). A ghost is { playerId, name, color, trace, time, vehicle,
// paint, helmet, suit, look } where `look` is the ghost's Lab look (an item id such as 'tb.ghost.ice', or null), filled in by the caller.
import { GHOST_MAX, decodeGhost, saveKey } from './save.js';

const idOk = (k) => typeof k === 'string' && /^[a-z0-9_-]{1,40}$/i.test(k);
const finite = (n) => typeof n === 'number' && Number.isFinite(n);

/** A stored ghost (the packed text or the samples) as a clean trace, or null: ≥ 2 samples of 4 finite numbers, time never going back. */
export function cleanTrace(raw) {
  const list = typeof raw === 'string' ? decodeGhost(raw) : Array.isArray(raw) ? raw : [];
  const out = [];
  for (const s of list) {
    if (!Array.isArray(s) || s.length < 2 || !s.slice(0, 4).every(finite)) continue;
    const p = s.length >= 4 ? s.slice(0, 4) : s.length === 3 ? [s[0], s[1], 0, s[2]] : [s[0], s[1], 0, 0];
    if (out.length && p[0] < out[out.length - 1][0]) return null;
    out.push(p);
    if (out.length >= GHOST_MAX) break;
  }
  return out.length >= 2 ? out : null;
}
/** The race time (s) at which the ghost finishes: its last sample. */
export const ghostTime = (trace) => (Array.isArray(trace) && trace.length ? Math.round(trace[trace.length - 1][0] * 100) / 100 : 0);

const readLocal = (key) => { try { return localStorage.getItem(key); } catch (_) { return null; } };

/** One family member's ghost on a trail, from their stored save (never written); null when they have none. */
export function readGhostOf(player, trailId, read = readLocal) {
  if (!player || !idOk(player.id) || !idOk(trailId)) return null;
  let raw = null;
  try { const text = read(saveKey(player.id)); raw = text ? JSON.parse(text) : null; } catch (_) { return null; }
  if (!raw || typeof raw !== 'object' || !raw.ghosts || typeof raw.ghosts !== 'object') return null;
  const trace = cleanTrace(raw.ghosts[trailId]);
  if (!trace) return null;
  const eq = raw.cosmetics && raw.cosmetics.equipped && typeof raw.cosmetics.equipped === 'object' ? raw.cosmetics.equipped : {};
  return {
    playerId: player.id, name: String(player.name || '').slice(0, 12), color: player.color || null, trace, time: ghostTime(trace),
    vehicle: idOk(raw.vehicle) ? raw.vehicle : 'ranger150', paint: idOk(raw.paint) ? raw.paint : 'sage',
    helmet: idOk(eq.helmet) ? eq.helmet : undefined, suit: idOk(eq.suit) ? eq.suit : undefined, look: null,
  };
}
/** The family's ghosts on a trail, in the family's order: [{ playerId, name, color, trace, time, vehicle, paint, … }]. `skipId` leaves one player out
 *  (the child who is choosing: their own is "My best"). */
export function peekGhosts(familyPlayers, trailId, { skipId = null, read = readLocal } = {}) {
  const out = [];
  for (const p of Array.isArray(familyPlayers) ? familyPlayers : []) {
    if (!p || p.id === skipId) continue;
    const g = readGhostOf(p, trailId, read);
    if (g) out.push(g);
  }
  return out;
}
/** The child's own best ghost as a ghost row, from the save in memory (null when there is none). */
export function ownGhost(save, trailId, player) {
  const trace = save && save.ghosts ? cleanTrace(save.ghosts[trailId]) : null;
  if (!trace) return null;
  return { playerId: player ? player.id : null, name: player ? player.name : '', color: player ? player.color || null : null, trace, time: ghostTime(trace),
    vehicle: save.vehicle, paint: save.paint, helmet: undefined, suit: undefined, look: null, own: true };
}
/** Who can be chased on a trail: "My best" first (when there is one), then each sibling that has a ghost there. */
export function chaseChoices(save, trailId, player, familyPlayers, opts = {}) {
  const mine = ownGhost(save, trailId, player);
  return [...(mine ? [mine] : []), ...peekGhosts(familyPlayers, trailId, { skipId: player ? player.id : null, ...opts })];
}
/** The label above the ghost and in the picker. */
export const ghostLabel = (g) => (g && g.own ? 'Your best' : g && g.name ? g.name : 'Ghost');

/** The line the results show after a chase: "You beat Mia's ghost by 1.3 s!" / "Mia's ghost was 1.3 s ahead. Nice chase!" / (own best) the
 *  existing "Beat your ghost by 1.3 s!" / "Your ghost was 1.3 s ahead". `by` in seconds, always ≥ 0. */
export function chaseLine({ own = false, name = '', beat = false, by = 0 } = {}) {
  const s = (Math.round(Math.max(0, by) * 10) / 10).toFixed(1);
  if (own) return beat ? `Beat your ghost by ${s} s!` : `Your ghost was ${s} s ahead`;
  const who = name || 'The';
  const poss = /s$/i.test(who) ? `${who}'` : `${who}'s`;
  return beat ? `You beat ${poss} ghost by ${s} s!` : `${poss} ghost was ${s} s ahead. Nice chase!`;
}

/** Every line Trail Blazer says for the Lab and Ghost Chase that is known ahead, for the natural voice's clips: the combo moment, the chase
 *  lines for each family member's name (and "your best"), and the Lab's fixed lines when it has loaded (`lines` = lab.LAB_LINES, or null). */
export function labVoiceTexts(names = [], lines = null) {
  const out = ['Perfect Landing!', 'Chase your best. Press gas!', 'You beat your ghost!', 'Nice chase!'];
  for (const n of names) {
    if (!n) continue;
    out.push(`Chase ${n}'s ghost. Press gas!`, `You beat ${n}'s ghost!`);
  }
  if (lines && typeof lines === 'object') for (const v of Object.values(lines)) if (typeof v === 'string') out.push(v);
  return [...new Set(out)].filter((t) => t && t.length <= 200);
}

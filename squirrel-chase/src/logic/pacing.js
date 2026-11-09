// Pacing (SPEC §4): one case per day. Day 1 opens case 1; after a case is closed the next one opens on the next local day; a parent
// can open the next case early (save.nextEarly). A closed case's postcard stays in the album. Pure: today's date comes in as 'YYYY-MM-DD'.
import { SEQUENCE } from './caseModel.js';

/** local calendar day 'YYYY-MM-DD' */
export function dayKey(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Which cases are open for this save today? Mutates save.opened (and clears save.nextEarly once used); returns the ids newly opened. */
export function refreshOpened(save, today = dayKey(), seq = SEQUENCE) {
  const out = [];
  if (!save.opened) save.opened = {};
  if (!seq.length) return out;
  if (!Object.keys(save.opened).length) { save.opened[seq[0]] = today; save.nextEarly = false; out.push(seq[0]); return out; }
  const next = seq.find((id) => !save.opened[id]);
  if (!next) { save.nextEarly = false; return out; }
  if (save.nextEarly) { save.opened[next] = today; save.nextEarly = false; out.push(next); return out; }
  const prev = seq[seq.indexOf(next) - 1];
  const prevClosed = save.closed && save.closed[prev];
  const openedToday = Object.values(save.opened).some((d) => d === today);
  if (prevClosed && prevClosed.day < today && !openedToday) { save.opened[next] = today; out.push(next); }
  return out;
}

/** What the case board says about tomorrow: 'open' (a case is waiting to be played), 'tomorrow' (the next one arrives on a later day), 'done' (every case is closed). */
export function waitingState(save, seq = SEQUENCE) {
  const next = seq.find((id) => !save.opened[id]);
  if (seq.some((id) => save.opened[id] && !(save.closed && save.closed[id]))) return 'open';
  return next ? 'tomorrow' : 'done';
}
/** The open case that is not closed yet (the one the board glows for), or null. */
export const currentCase = (save, seq = SEQUENCE) => seq.find((id) => save.opened[id] && !(save.closed && save.closed[id])) || null;
/** The next unopened case id (what the parent's "Open the next case now" opens), or null. */
export const nextUnopened = (save, seq = SEQUENCE) => seq.find((id) => !save.opened[id]) || null;

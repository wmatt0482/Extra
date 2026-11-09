// A case in progress (SPEC §4): the state machine behind the case screen. Plain JSON (device-local at squirrelChase.<id>.wip), so leaving mid-case
// keeps what was answered and resumes at the same stop. Pure: no DOM, no storage, no words (the words bank through the shared store, per word).
//   phase  'brief' (the Chief's text) → 'stop' (2 sealed notes) → 'travel' (tap the next city) → 'stop' … → 'hideout' (the dictation) → 'done'
import { flightOrder, hideoutCity, missingOf, stopsOf } from './caseModel.js';

export const RUN_VERSION = 1;

export function newRun(kase, now = Date.now()) {
  const stops = stopsOf(kase);
  return { v: RUN_VERSION, caseId: kase.id, startedAt: now, phase: 'brief', stop: 0, notes: stops.map(() => [0, 0]), found: [], words: [], hideout: null };
}
/** A run read back from storage, made safe against a case that changed shape. Null when it does not belong to this case. */
export function reviveRun(raw, kase) {
  if (!raw || raw.v !== RUN_VERSION || raw.caseId !== kase.id) return null;
  const stops = stopsOf(kase);
  const base = newRun(kase, Number(raw.startedAt) || Date.now());
  base.phase = ['brief', 'stop', 'travel', 'hideout', 'done'].includes(raw.phase) ? raw.phase : 'brief';
  base.stop = Math.max(0, Math.min(stops.length - 1, Math.floor(Number(raw.stop)) || 0));
  base.notes = stops.map((_, i) => [0, 1].map((w) => (raw.notes && raw.notes[i] && raw.notes[i][w] ? 1 : 0)));
  base.found = (Array.isArray(raw.found) ? raw.found : []).filter((n) => Number.isInteger(n)).slice(0, 12);
  base.words = (Array.isArray(raw.words) ? raw.words : []).filter((w) => typeof w === 'string').slice(0, 40);
  base.hideout = raw.hideout && typeof raw.hideout.sentence === 'string' && Array.isArray(raw.hideout.words)
    ? { sentence: raw.hideout.sentence, words: raw.hideout.words.filter((w) => typeof w === 'string'), source: String(raw.hideout.source || '') } : null;
  if (base.phase === 'travel' && !bothOpen(base)) base.phase = 'stop';
  return base;
}

export const notesOpen = (run, stop = run.stop) => (run.notes[stop] || []).filter(Boolean).length;
export const bothOpen = (run, stop = run.stop) => notesOpen(run, stop) === 2;
export const firstSealed = (run, stop = run.stop) => (run.notes[stop] || []).findIndex((n) => !n);

export function startChase(run) { if (run.phase === 'brief') run.phase = 'stop'; return run; }
/** A note opened after its word was spelled (the word already banked in the shared store). */
export function openNote(run, w, word) {
  if (run.phase !== 'stop' || !run.notes[run.stop] || run.notes[run.stop][w]) return false;
  run.notes[run.stop][w] = 1;
  if (word) run.words.push(word);
  return true;
}
/** Both notes read: on to the map (or, at the last stop, the hideout). */
export function followTrail(run, kase) {
  if (run.phase !== 'stop' || !bothOpen(run)) return false;
  run.phase = stopsOf(kase)[run.stop].last ? 'hideout' : 'travel';
  return true;
}
/** The child tapped a city on the map. Right: { ok, letter } and the run moves to the next stop. Wrong: { ok:false } and nothing changes (no penalty). */
export function chooseCity(run, kase, cityId) {
  if (run.phase !== 'travel') return { ok: false, ignored: true };
  const stop = stopsOf(kase)[run.stop];
  if (!stop || stop.last || cityId !== stop.next) return { ok: false };
  const letter = flightOrder(kase).filter((i) => !run.found.includes(i))[0];   // the content's recovery order: one letter per correct city, the rest come back at the hideout
  if (letter != null) run.found.push(letter);
  run.stop += 1; run.phase = 'stop';
  return { ok: true, letter: letter == null ? null : letter, from: stop.cityId, to: stop.next };
}
/** The letters still missing from the sign (positions). */
export const stillMissing = (run, kase) => missingOf(kase).filter((i) => !run.found.includes(i));

/** The dictation's sentence was built (and stays the same on a resume). */
export function setHideout(run, hideout) { run.hideout = hideout; run.phase = 'hideout'; return run; }
/** The hideout is done: the gang hands every letter back. */
export function finish(run, kase) { run.phase = 'done'; run.found = missingOf(kase).slice(); return run; }

/** The closed record for the save (SPEC §7): { day, at, words, hideout: { correct, total } }. */
export function closeRecord(run, result, now, today) {
  const words = [...new Set([...(run.words || []), ...((run.hideout && run.hideout.words) || [])])];
  return { day: today, at: now, words, hideout: { correct: result ? result.correct : 0, total: result ? result.total : 0 } };
}
/** Apply a close to the save: the record, the postcard in the album (once per city), the opened day. Returns true when this was the first close. */
export function applyClose(save, kase, rec) {
  const first = !save.closed[kase.id];
  if (first) save.closed[kase.id] = rec;
  if (!save.opened[kase.id]) save.opened[kase.id] = rec.day;
  const city = hideoutCity(kase);
  if (city && !save.album.includes(city)) save.album.push(city);
  return first;
}

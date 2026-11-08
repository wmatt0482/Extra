// Per-game progress summaries (lab/docs/COHESION.md): what each game tells The Lab about the child so the Lab home, the Games panel and the
// Grown-ups page can show all six games at a glance. PURE. The doc keeps one row per game: lab.sum[game] = { level, line, today, lastPlayed }.
import { GAMES } from './model.js';
import { GAME_INFO } from '../data/games.js';

const TEXT_BAD = /[^A-Za-z0-9 '.,!:/%+&()-]/g;
export const cleanSummaryText = (t, max = 40) => String(t == null ? '' : t).replace(TEXT_BAD, '').replace(/\s+/g, ' ').trim().slice(0, max);
export const SUMMARY_MAX = { level: 28, line: 44, today: 44 };

/** A clean summary row ({ level, line, today, lastPlayed }) from whatever a game passed; null when it has nothing to say. */
export function cleanSummary(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const lp = typeof raw.lastPlayed === 'number' && Number.isFinite(raw.lastPlayed) ? Math.min(1e13, Math.max(0, Math.floor(raw.lastPlayed))) : 0;
  const row = { level: cleanSummaryText(raw.level, SUMMARY_MAX.level), line: cleanSummaryText(raw.line, SUMMARY_MAX.line), today: cleanSummaryText(raw.today, SUMMARY_MAX.today), lastPlayed: lp };
  return row.level || row.line || row.today || row.lastPlayed ? row : null;
}

/** The later `lastPlayed` wins; a tie goes to the larger JSON so every device picks the same row. */
export function laterSummary(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  if (a.lastPlayed !== b.lastPlayed) return a.lastPlayed > b.lastPlayed ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

/** Record a game's summary in the doc. A row older than the one stored is ignored (the later lastPlayed wins). Returns true when the doc changed. */
export function setSummary(lab, game, raw, now) {
  if (!GAMES.includes(game)) return false;
  const given = raw && typeof raw === 'object' ? { ...raw } : null;
  if (given && !(typeof given.lastPlayed === 'number' && given.lastPlayed > 0)) given.lastPlayed = Math.max(1, Math.floor(now) || 1);
  const row = cleanSummary(given);
  if (!row) return false;
  const cur = lab.sum[game] || null;
  const win = laterSummary(cur, row);
  if (cur && JSON.stringify(win) === JSON.stringify(cur)) return false;
  lab.sum[game] = win;
  return true;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const localDay = (ms) => { const d = new Date(ms); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000; };
/** A friendly day word for a last-played time: Today, Yesterday, a weekday within the week, Last week, A while ago. '' when never. */
export function friendlyDay(lastMs, nowMs) {
  if (!lastMs || lastMs <= 0) return '';
  const diff = Math.round(localDay(nowMs) - localDay(lastMs));
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return DAY_NAMES[new Date(lastMs).getDay()];
  if (diff < 14) return 'Last week';
  return 'A while ago';
}

/** The six progress cards for a doc: [{ game, name, noun, path, played, level, line, today, lastPlayed, lastLabel, pitch }]. A game with no summary but
 *  some play history still counts as played (its last play day gives the "last played" word). */
export function gameCards(lab, nowMs) {
  const days = Object.keys(lab.play || {}).sort();
  return GAME_INFO.map((g) => {
    const s = lab.sum[g.id] || null;
    let lastDay = ''; for (const d of days) if (lab.play[d][g.id] > 0) lastDay = d;
    const lastPlayed = s && s.lastPlayed ? s.lastPlayed : lastDay ? new Date(`${lastDay}T12:00:00`).getTime() : 0;
    const played = !!s || !!lastDay;
    return {
      game: g.id, name: g.name, noun: g.noun, path: g.path, pitch: g.pitch, played,
      level: s ? s.level : '', line: s ? s.line : '', today: s ? s.today : '',
      lastPlayed, lastLabel: friendlyDay(lastPlayed, nowMs),
    };
  });
}

// The exchange table's rules (lab/SPEC.md §2.2): what an event pays. PURE.
import { EVENTS as ROWS, MOMENT_NAMES as NAMES } from '../data/events.js';

export const EVENTS = ROWS;
export const DAILY_COIN_CAP = 1800;
export const MOMENT = Object.freeze({ coins: 5, xp: 10 });
export const MOMENT_NAMES = NAMES;
export const COMBO = Object.freeze({ boostAt: 3, momentEvery: 5, momentsPerRound: 4 });
const BY_KEY = Object.freeze(Object.fromEntries(ROWS.map((r) => [`${r.game}.${r.event}`, r])));

/** The row for a game's event, or null (unknown events are ignored, never thrown). `day` is the same row for every game. */
export function eventDef(game, event) {
  if (typeof game !== 'string' || typeof event !== 'string') return null;
  if (event === 'day') return BY_KEY['any.day'];
  return Object.prototype.hasOwnProperty.call(BY_KEY, `${game}.${event}`) ? BY_KEY[`${game}.${event}`] : null;
}
export const eventKey = (game, def) => (def.event === 'day' ? 'any.day' : `${game}.${def.event}`);

/** { coins, xp } for one report: answers pay the first-try amount or the fix amount (never zero), units pay flat; both times n. */
export function payFor(def, { n = 1, firstTry = null, replay = false } = {}) {
  const k = def.flat ? 1 : Math.max(1, Math.min(1000, Math.floor(Number(n)) || 1));
  let coins, xp;
  if (def.kind === 'answer') {
    const miss = firstTry === false;
    coins = (miss ? def.fixCoins : def.coins) * k;
    xp = (miss ? def.fixXp : def.xp) * k;
  } else { coins = def.coins * k; xp = def.xp * k; }
  if (replay && def.replay) { coins = Math.round(coins * def.replay); xp = Math.round(xp * def.replay); }
  return { coins, xp };
}

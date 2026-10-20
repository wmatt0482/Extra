// The runway: every price and multiplier that sets how long a kid plays before the next big thing (SPEC v1.5 §7).
// Tuned with tools/economy-sim.mjs (the table is in the README). The vehicle prices live in src/data/vehicles.js
// (`price`, one source of truth for the shop and the sim).
/** Upgrade cost multiplier per vehicle tier (1-8): COST_BASE × 1.45^level × TIER_MUL[tier − 1]. */
export const TIER_MUL = [1, 1.6, 2.5, 4, 7, 12, 20, 35];
/** Cash multiplier on every race in a cup (the engine's coinMult input × this). */
export const CUP_MULT = { rookie: 1, pro: 2, legend: 4 };
/** Championship weekend bonus by trophy, × the cup multiplier. */
export const WEEKEND_BONUS = { gold: 2000, silver: 1000, bronze: 500 };
/** A cup opens with BOTH any trophy from the previous cup's weekend (a podium in the points) AND this many stars. */
export const STARS_TO_OPEN = { pro: 12, legend: 30 };
/** The Pit Challenge of the day pays double. */
export const DAILY_MULT = 2;

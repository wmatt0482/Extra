// Combos (lab/SPEC.md §3.2): three first-try answers in a row, then the next answer pays double coins (never double XP); every fifth
// first-try answer is a "moment" (at most four a round). A miss quietly sets the count to 0: there is no "lost" value to show. PURE.
import { COMBO } from './events.js';

export const newCombo = () => ({ count: 0, moments: 0 });

/** Step the combo for one answer. firstTry true -> count + 1; false -> count 0; null / undefined -> no signal, nothing changes.
 *  An `assessment` (the Friday Test, the Qualifier) leaves the combo alone and boosts nothing. Mutates `combo`. */
export function comboStep(combo, { firstTry = null, assessment = false } = {}) {
  if (assessment || (firstTry !== true && firstTry !== false)) return { boosted: false, moment: false, count: combo.count };
  if (firstTry === false) { combo.count = 0; return { boosted: false, moment: false, count: 0 }; }
  const boosted = combo.count >= COMBO.boostAt;          // the answer AFTER three first-tries
  combo.count += 1;
  let moment = false;
  if (combo.count % COMBO.momentEvery === 0 && combo.moments < COMBO.momentsPerRound) { combo.moments += 1; moment = true; }
  return { boosted, moment, count: combo.count };
}

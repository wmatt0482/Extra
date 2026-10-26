// Fraction Fright's cash and progress after a wave (SPEC §7). Pure. The cash rows are computed here from the wave's
// throws (the 'throw' events), so they always add up to the total, whatever the engine shows:
//   cure     $120 for each neighbour cured (the throw that cured it was a hit or a bull)
//   bull     +$60 for each cure that was a bullseye (a bull pays 1.5 × the cure)
//   effort   +$40 for each zombie where a near throw was followed by a throw on target (Brain Points: the effort counts)
//   final    the final wave (wave 5) pays everything twice: one more row the size of the subtotal
// A wave stopped early banks what it earned (nothing punishes stopping). A street's next wave moves on 1 → 5; after
// the final wave the street counts as cleared once, a pumpkin is planted in the yard (the calm beat), and it starts
// again at wave 1. Every 10 cures, a new neighbour moves onto the title's street (the Cure Counter).
import { isHit } from '../skills/items.js';
import { itemOf, STOCK } from '../data/looks.js';
import { dayKey } from '../skills/store.js';

export const CURE_CASH = 120;
export const BULL_BONUS = 60;
export const EFFORT_BONUS = 40;
export const FINAL_MULT = 2;
export const CURES_PER_NEIGHBOUR = 10;

/** throws: [{ item: { id }, result }] in order. → { rows: [{ id, label, count, amount }], total, cured, bulls, efforts }. */
export function waveCash(throws, { final = false } = {}) {
  const cured = new Map();         // item id -> the curing result
  const near = new Set(), effort = new Set();
  for (const t of throws || []) {
    const id = t && t.item && t.item.id;
    if (!id || cured.has(id)) continue;
    if (isHit(t.result)) { cured.set(id, t.result); if (near.has(id)) effort.add(id); }
    else if (t.result === 'near') near.add(id);
  }
  const n = cured.size, bulls = [...cured.values()].filter((r) => r === 'bull').length, efforts = effort.size;
  const rows = [
    { id: 'cure', label: 'Neighbours cured', count: n, amount: n * CURE_CASH },
    { id: 'bull', label: 'Bullseyes', count: bulls, amount: bulls * BULL_BONUS },
    { id: 'effort', label: 'Close, then cured', count: efforts, amount: efforts * EFFORT_BONUS },
  ];
  const sub = rows.reduce((a, r) => a + r.amount, 0);
  if (final) rows.push({ id: 'final', label: 'Final wave ×2', count: 1, amount: sub * (FINAL_MULT - 1) });
  return { rows, total: rows.reduce((a, r) => a + r.amount, 0), cured: n, bulls, efforts };
}

/** Mean closeness of a wave's throws ("accuracy 86 %"): 100 − the mean PAE, rounded; null without throws. */
export function accuracyOf(throws) {
  const list = (throws || []).filter((t) => Number.isFinite(t.pae));
  return list.length ? Math.max(0, Math.round(100 - list.reduce((a, t) => a + t.pae, 0) / list.length)) : null;
}
export const neighboursFor = (cures) => Math.floor(Math.max(0, cures || 0) / CURES_PER_NEIGHBOUR);

/**
 * Bank a wave into the save. w = { street, number, cash, cured, bulls, reached, throws, final, stopped, at }.
 * → { earned, neighboursBefore, neighboursAfter, cleared, pumpkin, nextWave }.
 */
export function bankWave(save, w) {
  const at = w.at || Date.now();
  const earned = Math.max(0, Math.floor(w.cash || 0));
  const nb = neighboursFor(save.cures);
  save.cash += earned;
  save.records.lifetimeCash += earned;
  save.cures += Math.max(0, w.cured || 0);
  save.bulls += Math.max(0, w.bulls || 0);
  save.waves += 1;
  save.records.throws += Math.max(0, w.throws || 0);
  save.records.reached += Math.max(0, w.reached || 0);
  save.records.bestWave = Math.max(save.records.bestWave, w.cured || 0);
  const st = save.streets[w.street] || (save.streets[w.street] = { wave: 1, cleared: 0 });
  let cleared = false, pumpkin = false;
  if (!w.stopped) {
    if (w.number >= 5) { cleared = true; pumpkin = true; st.cleared += 1; st.wave = 1; save.pumpkins += 1; }
    else st.wave = Math.max(st.wave, w.number + 1);
  }
  const k = dayKey(at);
  const p = save.play[k] || { waves: 0, cures: 0 };
  save.play[k] = { waves: p.waves + 1, cures: p.cures + Math.max(0, w.cured || 0) };
  const keys = Object.keys(save.play).sort();
  for (const old of keys.slice(0, Math.max(0, keys.length - 14))) delete save.play[old];
  return { earned, neighboursBefore: nb, neighboursAfter: neighboursFor(save.cures), cleared, pumpkin, nextWave: st.wave };
}
/** The street's next wave (1 … 5). */
export const nextWaveOf = (save, street) => (save.streets[street] && save.streets[street].wave) || 1;

// ---------- the yard ----------
export const owns = (save, kind, id) => id === STOCK[kind] || (save.yard.owned[kind] || []).includes(id);
/** Buy (and wear) a yard item: → 'bought' | 'owned' | 'poor' | 'unknown'. */
export function buyYard(save, kind, id) {
  const it = itemOf(kind, id);
  if (!it) return 'unknown';
  if (owns(save, kind, id)) { save.yard[kind] = id; return 'owned'; }
  if (save.cash < it.price) return 'poor';
  save.cash -= it.price;
  save.yard.owned[kind] = [...save.yard.owned[kind], id];
  save.yard[kind] = id;
  return 'bought';
}
/** Play, day by day (the Report): [{ day, text }], newest first. */
export const playLines = (save) => Object.entries(save.play || {}).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  .map(([day, p]) => ({ day, text: `${p.waves} wave${p.waves === 1 ? '' : 's'} · ${p.cures} cured` }));

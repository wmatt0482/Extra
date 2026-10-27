// Fraction Fright's cash and progress after a wave (SPEC §7). Pure. The cash rows are computed here from the wave's
// throws (the 'throw' events), so they always add up to the total, whatever the engine shows:
//   cure     $120 for each neighbour cured (the throw that cured it was a hit or a bull)
//   bull     +$60 for each cure that was a bullseye (a bull pays 1.5 × the cure)
//   effort   +$40 for each zombie where a near throw was followed by a throw on target (Brain Points: the effort counts)
//   sharp    +$50 for each cure while the zombie was still in the fog (Sharpshooter; SPEC §13.1)
//   combo    +$20 × (combo − 1) for each hit from combo ×2 on, capped at ×6 (+$100 a hit); a miss resets, a near keeps
//   twins    +$80 for every extra neighbour one throw cured (twins at the same spot)
//   boss     +$300 when the boss is cured (its third hit)
//   final    the final wave (wave 5) pays everything twice: one more row the size of the subtotal
// A wave stopped early banks what it earned (nothing punishes stopping). A street's next wave moves on 1 → 5; after
// the final wave the street counts as cleared once, a pumpkin is planted in the yard (the calm beat), and it starts
// again at wave 1. Every 10 cures, a new neighbour moves onto the title's street (the Cure Counter).
import { isHit } from '../skills/items.js';
import { extraOf, itemOf, STOCK } from '../data/looks.js';
import { dayKey } from '../skills/store.js';

export const CURE_CASH = 120;
export const BULL_BONUS = 60;
export const EFFORT_BONUS = 40;
export const SHARP_BONUS = 50;
export const COMBO_STEP = 20;
export const COMBO_CAP = 6;
export const TWIN_BONUS = 80;
export const BOSS_BONUS = 300;
export const FINAL_MULT = 2;
export const CURES_PER_NEIGHBOUR = 10;

/**
 * throws: [{ item: { id, kind? }, result, seen?, combo?, cures?: [ids] }] in order (the 'throw' events as the app
 * records them). A throw's `cures` are the zombies it cured (its own item and any twin at the spot); without it a hit
 * cures its own item. A boss item (kind 'boss') is cured by its third hit.
 * → { rows: [{ id, label, count, amount }], total, cured, bulls, efforts, sharps, twins, bestCombo, boss }.
 */
export function waveCash(throws, { final = false } = {}) {
  const cured = new Map();         // item id -> the curing result
  const near = new Set(), effort = new Set();
  const bossHits = new Map();
  let sharps = 0, twins = 0, comboCash = 0, bestCombo = 0, boss = false;
  for (const t of throws || []) {
    const id = t && t.item && t.item.id;
    if (!id) continue;
    const hit = isHit(t.result);
    if (hit) {
      const combo = Math.max(0, Math.floor(Number(t.combo) || 0));
      if (combo >= 2) comboCash += (Math.min(COMBO_CAP, combo) - 1) * COMBO_STEP;
      bestCombo = Math.max(bestCombo, combo);
    }
    if (t.item.kind === 'boss') {
      if (hit && !cured.has(id)) {
        const k = (bossHits.get(id) || 0) + 1;
        bossHits.set(id, k);
        if (k >= 3) { cured.set(id, t.result); boss = true; if (!t.seen) sharps++; }
      }
      continue;
    }
    const list = Array.isArray(t.cures) && t.cures.length ? t.cures : hit ? [id] : [];
    let fresh = 0;
    for (const cid of list) {
      if (cured.has(cid)) continue;
      cured.set(cid, cid === id ? t.result : 'hit');
      fresh++;
      if (cid === id && near.has(cid)) effort.add(cid);
    }
    if (fresh) { if (!t.seen) sharps += fresh; twins += Math.max(0, fresh - 1); }
    if (!hit && t.result === 'near' && !cured.has(id)) near.add(id);
  }
  const n = cured.size, bulls = [...cured.values()].filter((r) => r === 'bull').length, efforts = effort.size;
  const rows = [
    { id: 'cure', label: 'Neighbours cured', count: n, amount: n * CURE_CASH },
    { id: 'bull', label: 'Bullseyes', count: bulls, amount: bulls * BULL_BONUS },
    { id: 'effort', label: 'Close, then cured', count: efforts, amount: efforts * EFFORT_BONUS },
    { id: 'sharp', label: 'Sharpshooter (cured in the fog)', count: sharps, amount: sharps * SHARP_BONUS },
    { id: 'combo', label: 'Combo', count: bestCombo >= 2 ? bestCombo : 0, amount: comboCash },
    { id: 'twins', label: 'Twins', count: twins, amount: twins * TWIN_BONUS },
    { id: 'boss', label: 'Boss cured', count: boss ? 1 : 0, amount: boss ? BOSS_BONUS : 0 },
  ];
  const sub = rows.reduce((a, r) => a + r.amount, 0);
  if (final) rows.push({ id: 'final', label: 'Final wave ×2', count: 1, amount: sub * (FINAL_MULT - 1) });
  return { rows, total: rows.reduce((a, r) => a + r.amount, 0), cured: n, bulls, efforts, sharps, twins, bestCombo, boss };
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
/**
 * Buy (and wear) a yard item: → 'bought' | 'owned' | 'poor' | 'unknown'. kind 'extra' (the dog, the lantern): bought
 * once and switched on; owned → toggled on / off ('owned').
 */
export function buyYard(save, kind, id) {
  if (kind === 'extra') {
    const x = extraOf(id);
    if (!x) return 'unknown';
    if (owns(save, kind, id)) { save.yard[id] = !save.yard[id]; return 'owned'; }
    if (save.cash < x.price) return 'poor';
    save.cash -= x.price;
    save.yard.owned.extra = [...(save.yard.owned.extra || []), id];
    save.yard[id] = true;
    return 'bought';
  }
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

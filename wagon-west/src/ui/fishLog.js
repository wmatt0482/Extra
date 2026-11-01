// The journal's "Fish log" page (SPEC v1.4 §1.3, §1.4, §5.5): the six fish of the trail (faint until caught, each with how
// many, the biggest in inches and where it was first caught), a crown on the personal best, "River oddities" (an old boot, a
// snapping turtle, a bottle), and, for a family of two or more, the Family records (the biggest of each fish in the family, with
// the player's first name) and the Skipping stones board (the best skips, by player). The journey keeps the data (J.fishLog,
// J.fishBest, J.fishJunk, J.skips) and works out the boards (familyRecords / skipsBoard); this module only draws.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { FISH } from '../content/fish.js';
import { LEG_BY_ID } from '../content/legs.js';

const stopName = (id) => { const l = LEG_BY_ID[id]; return l ? (l.stop && l.stop.name) || l.name : ''; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The family's players with a journey, for the boards: [{ playerId, name, J }]. */
export function boardPlayers(app) {
  const out = [];
  for (const p of (app.family && app.family.players) || []) {
    let s = null;
    try { s = app.saveOf(p.id); } catch (_) { s = null; }
    if (s && s.journey) out.push({ playerId: p.id, name: p.name, J: s.journey });
  }
  return out;
}

/** The Journal's "Fish log" page. app: { save, family, saveOf, v2 } */
export function fishLogPage(app) {
  const J = app.save.journey;
  const JA = (app.v2 && app.v2.JA) || {};
  const log = (J && J.fishLog) || {};
  const best = J && J.fishBest;
  const caught = FISH.filter((f) => Number(log[f.id] && log[f.id].n) > 0).length;
  const out = [h('p', { class: 'jr-note', id: 'fish-total' }, `${caught} of ${FISH.length} fish in the log · cast a line at camp or when the trail finds a stream`)];
  out.push(h('div', { class: 'fish-grid', id: 'fish-grid' }, ...FISH.map((f) => {
    const e = log[f.id] || {};
    const n = Number(e.n) || 0;
    const crown = !!(best && best.species === f.id && n > 0);
    return h('div', { class: 'fish-tile' + (n ? ' got' : '') + (crown ? ' best' : ''), 'data-fish': f.id, 'data-n': String(n), 'aria-label': n ? `${f.name}: caught ${n}, biggest ${e.bestIn} inches${crown ? ', your personal best' : ''}` : `${f.name}: not caught yet` },
      crown ? h('span', { class: 'fish-crown', 'aria-hidden': 'true' }, '👑') : null,
      h('span', { class: 'fish-emoji', 'aria-hidden': 'true' }, n ? (f.emoji || '🐟') : '?'),
      h('span', { class: 'fish-name' }, n ? f.name : 'Not caught yet'),
      h('span', { class: 'fish-sub' }, n ? `caught ${n} · biggest ${e.bestIn} in` : 'a fish of the trail'),
      n && e.firstLeg ? h('span', { class: 'fish-where' }, `first at ${stopName(e.firstLeg)}`) : null);
  })));
  if (best && best.species) {
    const f = FISH.find((x) => x.id === best.species);
    if (f) out.push(h('p', { class: 'jr-note fish-best', id: 'fish-best' }, `👑 Personal best: a ${f.name.toLowerCase()}, ${best.in} inches`));
  }
  const junk = (J && J.fishJunk) || {};
  const odd = [['boot', '🥾', 'old boots', 'old boot'], ['turtle', '🐢', 'snapping turtles', 'snapping turtle'], ['bottle', '📜', 'bottles with notes', 'bottle with a note']];
  out.push(h('section', { class: 'card fish-odd', id: 'fish-odd' },
    h('b', {}, 'River oddities'),
    h('div', { class: 'fish-odd-row' }, ...odd.map(([id, e, many, one]) => h('span', { class: 'fish-odd-chip', 'data-junk': id, 'data-n': String(Number(junk[id]) || 0) }, h('span', { 'aria-hidden': 'true' }, e), plural(Number(junk[id]) || 0, one, many))))));
  const skips = (J && J.skips) || {};
  out.push(h('section', { class: 'card fish-skips', id: 'fish-skips', 'data-best': String(Number(skips.best) || 0) },
    h('b', {}, 'Skipping stones'),
    h('span', {}, Number(skips.best) ? `🪨 Your best: ${plural(Number(skips.best), 'skip', 'skips')} in one throw · ${plural(Number(skips.throws) || 0, 'throw', 'throws')} in all` : 'Skip a flat stone at a river to start your record.')));
  // the family's boards (hidden for a family of one)
  const players = boardPlayers(app);
  if (((app.family && app.family.players) || []).length >= 2 && players.length) {
    let recs = {}, board = [];
    try { if (typeof JA.familyRecords === 'function') recs = JA.familyRecords(players) || {}; } catch (e) { console.warn('[WagonWest] familyRecords', e); }
    try { if (typeof JA.skipsBoard === 'function') board = JA.skipsBoard(players) || []; } catch (e) { console.warn('[WagonWest] skipsBoard', e); }
    const rows = FISH.filter((f) => recs[f.id]).map((f) => h('li', { 'data-fish': f.id, 'data-player': recs[f.id].playerId },
      h('span', { 'aria-hidden': 'true' }, f.emoji || '🐟'), h('span', { class: 'fam-fish' }, f.name), h('b', {}, `${recs[f.id].lengthIn} in`), h('span', { class: 'fam-who' }, recs[f.id].name)));
    out.push(h('section', { class: 'card fish-family', id: 'fish-family' },
      h('b', {}, 'Family records'),
      rows.length ? h('ul', { class: 'fam-list' }, ...rows) : h('p', { class: 'jr-note' }, 'The biggest fish of the family shows here.')));
    const brows = board.filter((b) => b && Number(b.best) > 0).map((b) => h('li', { 'data-player': b.playerId }, h('span', { 'aria-hidden': 'true' }, '🪨'), h('span', { class: 'fam-fish' }, b.name), h('b', {}, plural(Number(b.best), 'skip', 'skips'))));
    out.push(h('section', { class: 'card fish-family', id: 'fish-board' },
      h('b', {}, 'Skipping stones, best throw'),
      brows.length ? h('ul', { class: 'fam-list' }, ...brows) : h('p', { class: 'jr-note' }, 'Nobody has skipped a stone yet.')));
  }
  return out;
}

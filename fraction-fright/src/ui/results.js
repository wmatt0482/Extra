// Results after a wave (SPEC §7): neighbours cured, "accuracy 86 %" (always positive), bullseyes, the cash rows that
// add up to the total (cure, bull, close-then-cured, sharpshooter, combo, twins, boss, final wave ×2), the best combo,
// the wave's fractions (twins and the boss marked), and the Cure Counter growing
// the town (a new neighbour moves onto the title's street for every 10 cures). A wave stopped early still banks what it
// earned. Buttons: Next wave · Streets · Yard.
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { COIN } from '../../../spell-jump/src/ui/icons.js';
import { tallySvg } from './title.js';


export function createResults(app) {
  const stats = $('#res-stats'), counter = $('#res-counter'), throwsEl = $('#res-throws'), pay = $('#res-pay'), callouts = $('#res-callouts');
  let last = null;
  $('#res-next').addEventListener('click', () => { if (last) app.startWave(last.street); });
  $('#res-streets').addEventListener('click', () => app.go('streets'));
  $('#res-yard').addEventListener('click', () => app.go('yard'));

  function show(r) {
    last = r;
    $('#res-title').textContent = r.stopped ? 'Shift over. Cash kept.' : r.cleared ? `${r.streetName}: cleared.` : `Wave ${r.number}: fence held.`;
    callouts.replaceChildren(...[
      r.cleared ? h('span', { class: 'callout pumpkin', id: 'res-pumpkin' }, "A jack-o'-lantern for your yard") : null,
      r.bank.neighboursAfter > r.bank.neighboursBefore ? h('span', { class: 'callout gold', id: 'res-neighbour' }, 'New neighbour on the block') : null,
      r.boss ? h('span', { class: 'callout pumpkin', id: 'res-boss' }, `${(r.items.find((x) => x.kind === 'boss') || {}).name || 'The boss'} cured!`) : null,
      r.twins ? h('span', { class: 'callout', id: 'res-twins' }, r.twins === 1 ? 'Twins! One throw, two cures' : `Twins ×${r.twins}`) : null,
      r.bonus ? h('span', { class: 'callout gold', id: 'res-bonus', 'data-cured': String(r.bonus.cured), 'data-gold': String(r.bonus.gold) }, `Critter Stampede: ${r.bonus.cured} cured${r.bonus.gold ? ' · the golden one!' : ''}`) : null,
      r.labXp ? h('span', { class: 'callout' }, `+${r.labXp} XP`) : null].filter(Boolean));
    stats.replaceChildren(
      h('div', { class: 'stat good', id: 'res-cured', 'data-n': String(r.cash.cured) }, h('b', {}, String(r.cash.cured)), h('span', {}, 'Cured')),
      h('div', { class: 'stat', id: 'res-accuracy', 'data-pct': String(r.accuracy == null ? '' : r.accuracy) }, h('b', {}, r.accuracy == null ? '—' : `${r.accuracy} %`), h('span', {}, 'Accuracy')),
      h('div', { class: 'stat', id: 'res-bulls', 'data-n': String(r.cash.bulls) }, h('b', {}, String(r.cash.bulls)), h('span', {}, 'Bullseyes')),
      h('div', { class: `stat${r.bestCombo >= 2 ? ' gold' : ''}`, id: 'res-combo', 'data-n': String(r.bestCombo || 0) }, h('b', {}, r.bestCombo >= 2 ? `×${r.bestCombo}` : '—'), h('span', {}, 'Best combo')));
    counter.innerHTML = '';
    counter.className = 'cure-counter tally-board';
    counter.append(h('div', { class: 'cc-text' }, h('b', { id: 'res-cures-total', 'data-n': String(app.save.cures) }, `Neighbours cured: ${money(app.save.cures)}`),
      h('small', {}, r.cash.cured ? `+${r.cash.cured} this wave · ${10 - (app.save.cures % 10)} more and someone new moves in` : `${10 - (app.save.cures % 10)} more and someone new moves in`)),
    h('span', { html: tallySvg(app.save.cures) }));
    throwsEl.replaceChildren(...r.items.map((x) => h('span', { class: `rt ${x.outcome === 'cured' ? x.result : x.outcome}${x.kind === 'boss' ? ' boss' : ''}${x.twin ? ' twin' : ''}`, 'data-show': x.show, 'data-outcome': x.outcome, title: x.kind === 'boss' ? `${x.name}: ${x.say}` : x.say },
      x.kind === 'boss' ? h('small', {}, 'BOSS') : null, x.show, x.result === 'bull' ? ' ★' : '')));
    pay.replaceChildren(...r.cash.rows.map((row) => h('tr', { class: row.amount ? '' : 'zero', 'data-row': row.id, 'data-amount': String(row.amount) },
      h('td', {}, row.label, row.id !== 'final' ? h('small', {}, `×${row.count}`) : null), h('td', { html: `${COIN} ${money(row.amount)}` }))),
    h('tr', { class: 'total', 'data-row': 'total', 'data-amount': String(r.cash.total) }, h('td', {}, 'Total'), h('td', { html: `${COIN} ${money(r.cash.total)}` })));
    $('#res-next-text').textContent = r.cleared ? `${r.streetName} again` : r.stopped ? `Wave ${r.bank.nextWave}` : `Wave ${r.bank.nextWave}`;
  }
  return { show, hide() {}, get last() { return last; } };
}

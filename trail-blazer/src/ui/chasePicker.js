// The Ghost Chase picker (v1.9, lab/SPEC.md §4.2): a chip row after "Chase a ghost" on a trail card: "My best" and each family member who
// has a ghost on this trail (a colour dot, their name, their vehicle and the time their ghost finishes in). Tapping one starts the chase.
// The panel says what is different: no clock, the ghost is the clock, both start on the first GAS.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { fmtTime } from '../data/medals.js';
import { ghostLabel } from '../meta/ghosts.js';

export function createChasePicker(app) {
  const panel = $('#panel-chase');
  const list = $('#chase-list');
  const sub = $('#chase-sub');
  let onPick = null;

  const vehicleName = (id) => { const v = (app.vehicles || []).find((x) => x.id === id); return v ? v.name : 'Ranger 150'; };
  function close() { panel.hidden = true; onPick = null; }
  $('#chase-cancel').addEventListener('click', close);
  panel.addEventListener('pointerdown', (e) => { if (e.target === panel) close(); });

  /** choices: [{ playerId, name, color, time, vehicle, own }] (src/meta/ghosts.js chaseChoices); pick(choice) starts the chase. */
  function open(trail, choices, pick) {
    onPick = pick;
    sub.textContent = `${trail.name}: race a ghost. There is no clock: the ghost is the clock. Press GAS and you both go!`;
    list.replaceChildren(...choices.map((g, i) => {
      const chip = h('button', { class: 'chase-chip', 'data-ghost': g.own ? 'me' : g.playerId, 'data-sfx': '', style: { '--c': g.color || '#c9d1ff' },
        'aria-label': `${g.own ? 'My best' : g.name}, ${vehicleName(g.vehicle)}, finishes in ${fmtTime(g.time)}` },
      h('i', { class: 'cc-dot', 'aria-hidden': 'true' }),
      h('span', {}, h('b', {}, g.own ? 'My best' : ghostLabel(g)), h('small', {}, `${vehicleName(g.vehicle)}${g.own ? '' : ' · ' + g.name + '\'s best'}`)),
      h('span', { class: 'cc-time' }, fmtTime(g.time)));
      chip.addEventListener('click', () => { const f = onPick; close(); if (f) f(g); });
      return chip;
    }));
    panel.hidden = false;
    const first = list.querySelector('.chase-chip');
    if (first) { try { first.focus({ preventScroll: true }); } catch (_) { /* ignore */ } }
  }
  return { open, close, get isOpen() { return !panel.hidden; } };
}

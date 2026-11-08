// The Sandbox's "Site goals" card: eight optional little goals with a star each, checked automatically while the child
// builds (twice a second, never inside a frame's drawing), a gentle toast and a chime the first time one is met, and a card
// that lists them with the numbers the game shows in metres. Nothing here has a timer, a penalty or a "not yet" message:
// an unmet goal is simply an empty star.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { icon } from '../../../spell-jump/src/ui/icons.js';
import { GOALS, evaluateGoals } from '../goals.mjs';
import { Audio } from '../../../spell-jump/src/audio.js';
import { Sound } from '../meta/sound.js';
import { app, persist } from './state.js';
import { modal, toast } from './hud.js';

let tick = -1;
/** The numbers from the last check, for the card. */
let meters = { tallest: 0, stacked: 0, materials: 0 };

/** Checks the goals twice a simulated second while the sandbox is open; a goal met for the first time is saved with a star. */
export function goalStep(yard) {
  if (yard.round.id || app.screen !== 'play') return;
  const t = Math.floor(yard.time * 2);
  if (t === tick) return;
  tick = t;
  const got = evaluateGoals(yard);
  meters = got;
  const have = app.save.goals;
  const fresh = got.done.filter((id) => !have.includes(id));
  if (!fresh.length) return;
  for (const id of fresh) have.push(id);
  persist();
  const goal = GOALS.find((g) => g.id === fresh[0]);
  Audio.coin();
  Sound.placed();
  toast(`Site goal: ${goal.text}!`);
  if ($('#modal').hidden === false) renderGoals();
}

/** Opens the card. */
export function openGoals() {
  if (!app.yard || app.yard.round.id) return;
  $('#tray').hidden = true;
  meters = evaluateGoals(app.yard);
  const stars = app.save.goals.length;
  modal(
    'Site goals',
    [
      h('p', { class: 'goals-intro' }, 'Try one, try them all, or just build. A star stays once you have earned it.'),
      h(
        'div',
        { class: 'goals-meters', id: 'goal-meters' },
        h('span', {}, `Tallest stack ${meters.tallest.toFixed(1)} m`),
        h('span', {}, `${meters.materials} materials on site`),
        h('span', { id: 'goal-stars' }, `${stars} of ${GOALS.length} stars`),
      ),
      h('ul', { class: 'goal-list', id: 'goal-list' }, ...GOALS.map(goalRow)),
      h('div', { class: 'modal-actions' }, h('button', { class: 'btn btn-gold btn-big', id: 'goals-close', onclick: () => $('#modal-close').click() }, 'Back to building')),
    ],
    { kind: 'goals' },
  );
}

function goalRow(g) {
  const done = app.save.goals.includes(g.id);
  return h(
    'li',
    { class: 'goal' + (done ? ' done' : ''), 'data-goal': g.id, 'aria-label': `${g.text}${done ? ', done' : ''}` },
    h('span', { class: 'star', html: icon('star') }),
    h('span', {}, g.text),
  );
}

/** Redraws the open card (a goal was met while it was up). */
function renderGoals() {
  const list = $('#goal-list');
  if (!list) return;
  list.replaceChildren(...GOALS.map(goalRow));
  $('#goal-stars').textContent = `${app.save.goals.length} of ${GOALS.length} stars`;
}

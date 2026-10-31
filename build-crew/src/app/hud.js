// The heads-up display around the yard: toasts, the one-line hint, the shared modal sheet, the progress counter and
// Grab button, and the drive deck's machine cards with their per-machine tool label and extra joint buttons. What
// differs by machine on screen comes from the MACHINE_UI table, keyed by kind like the physics and scene tables.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { icon } from '../../../spell-jump/src/ui/icons.js';
import { MACHINES } from '../content.mjs';
import { Music } from '../meta/music.js';
import { app, account } from './state.js';

/** HUD details for each machine kind.
 *  - toolLabel: the tool stick's caption.
 *  - joints: which extra joint buttons (data-hold axes) the deck shows.
 *  - art: the card picture's arm and tool, drawn in the machine's color c.
 *  - releaseHint: a hint after releasing a load, when the tool needs a second move to let go.
 *  - carriesBall: the sandbox's Wrecking ball button switches to this machine (mirrors physics.mjs). */
export const MACHINE_UI = {
  skid: {
    toolLabel: 'LIFT & TILT',
    joints: ['tilt'],
    art: (c) => '<path d="M37 20L49 30L60 31v7H49" fill="none" stroke="' + c + '" stroke-width="6"/>',
    releaseHint: 'Tilt the bucket forward to pour your block out.',
    carriesBall: false,
  },
  excavator: {
    toolLabel: 'BOOM & STICK',
    joints: ['swing', 'tilt'],
    art: (c) => '<path d="M39 25L46 5L57 17L54 32h7" stroke="' + c + '" stroke-width="6" fill="none"/>',
    releaseHint: null,
    carriesBall: false,
  },
  crane: {
    toolLabel: 'HOIST & SWING',
    joints: ['extend'],
    art: (c) =>
      '<path d="M39 29L48 3L60 10" stroke="' +
      c +
      '" stroke-width="6" fill="none"/><path d="M59 10v20h-6" stroke="#bcc8d2" stroke-width="2"/>',
    releaseHint: null,
    carriesBall: true,
  },
};

/** A short message that fades after a few seconds. */
export function toast(text) {
  const e = h('div', { class: 'toast' }, text);
  $('#toasts').append(e);
  setTimeout(() => e.remove(), 4200);
}

/** Replaces the hint line. */
export function showHint(text) {
  $('#hint').textContent = text;
}

/** Opens the modal sheet with a title and content. Play time stops and the controls and music pause while it is up. */
export function modal(title, children) {
  account();
  app.controls?.setEnabled(false);
  $('#modal-body').replaceChildren(h('h2', { id: 'modal-title' }, title), ...children);
  $('#modal').hidden = false;
  app.playStart = null;
  Music.play(false);
  $('#modal-close').focus();
}

/** Closes the modal (and any on-screen keyboard in it) and resumes play, controls and music. */
export function closeModal() {
  app.keyboard?.destroy();
  app.keyboard = null;
  $('#modal').hidden = true;
  app.paused = false;
  app.controls?.setEnabled(app.screen === 'play' && !app.pz?.isOpen);
  account();
  Music.play(true);
  $('#pause').focus();
}

/** The small SVG picture on a machine card: a chassis and cab in the machine's color plus its arm and tool. */
export function machineArt(kind) {
  const c = MACHINES[kind].color;
  return (
    '<svg viewBox="0 0 64 46" aria-hidden="true"><path d="M6 31h47v10H6z" fill="#0b121a"/>' +
    '<path d="M10 35h38" stroke="#687888" stroke-width="3"/>' +
    `<path d="M17 9h23v25H17z" fill="${c}"/><path d="M21 13h15v13H21z" fill="#203e50"/>` +
    '<path d="M23 14v11m-3 3h18" stroke="#93b0be" stroke-width="1.5"/>' +
    MACHINE_UI[kind].art(c) +
    '</svg>'
  );
}

/** Rebuilds the machine cards for this yard, the tool stick's label and the joint buttons for the active machine. */
export function renderMachines() {
  const yard = app.yard;
  const el = $('#machines');
  el.replaceChildren(
    ...yard.machines.map((m, i) =>
      h(
        'button',
        {
          class: 'machine-card' + (yard.active === i ? ' on' : ''),
          'data-machine': m.kind,
          'aria-pressed': String(yard.active === i),
          onclick() {
            app.yard.select(i);
            renderMachines();
            showHint(MACHINES[m.kind].hint);
          },
        },
        h('span', { html: machineArt(m.kind) }),
        h('span', {}, h('b', {}, MACHINES[m.kind].name), h('small', {}, MACHINES[m.kind].label)),
      ),
    ),
  );
  const ui = MACHINE_UI[yard.machine.kind];
  $('#tool-label').innerHTML = `${ui.toolLabel} <small>I J K L</small>`;
  for (const b of document.querySelectorAll('[data-hold]')) {
    const axis = b.dataset.hold.split(':')[0];
    b.hidden = !ui.joints.includes(axis);
  }
  updateUI();
}

/** Keeps the Grab/Release button and the progress line current; touches the DOM only when they change. */
export function updateUI() {
  const yard = app.yard;
  if (!yard) return;
  const grab = $('#grab'),
    held = String(!!yard.held);
  if (grab.dataset.held !== held) {
    grab.dataset.held = held;
    grab.innerHTML = `${icon(yard.held ? 'air' : 'land')} ${yard.held ? 'Release' : 'Grab'} <kbd>SPACE</kbd>`;
  }
  const text = app.mission
    ? `${app.mission.status.count} / ${app.mission.status.total} placed`
    : `${yard.blocks.length} materials on site`;
  if ($('#progress').textContent !== text) $('#progress').textContent = text;
}

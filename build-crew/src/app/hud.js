// The heads-up display around the yard: toasts, the one-line hint, the shared modal sheet, the progress counter and
// Grab button, and the drive deck's machine cards with their per-machine tool label and extra joint buttons. What
// differs by machine on screen comes from the MACHINE_UI table, keyed by kind like the physics and scene tables.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { icon } from '../../../spell-jump/src/ui/icons.js';
import { MACHINES, touchHint } from '../content.mjs';
import { ruleLine } from '../missions.mjs';
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
  // WL-06 wheel loader (0.6): its own card (an articulated loader with a big bucket), lift and tilt like the skid steer.
  loader: {
    toolLabel: 'LIFT & TILT',
    joints: ['tilt'],
    card: (c) =>
      '<path d="M4 30h52v5H4z" fill="#0b121a"/><path d="M4 30V21l3-3h15v12z" fill="' +
      c +
      '" stroke="#0b121a" stroke-width="1.5"/><path d="M22 30V9h12l2 21z" fill="' +
      c +
      '" stroke="#0b121a" stroke-width="1.5"/><path d="M25 12h8l1 9h-9z" fill="#203e50"/>' +
      '<path d="M36 26V20h9l2 6z" fill="' +
      c +
      '" stroke="#0b121a" stroke-width="1.5"/><path d="M40 16L54 28" stroke="' +
      c +
      '" stroke-width="4"/><path d="M50 22l11 2 1 13-10 1-3-6z" fill="' +
      c +
      '" stroke="#0b121a" stroke-width="1.5"/>' +
      '<circle cx="13" cy="36" r="6" fill="#161c21" stroke="#93b0be" stroke-width="1.5"/><circle cx="41" cy="36" r="6" fill="#161c21" stroke="#93b0be" stroke-width="1.5"/>',
    releaseHint: 'Tilt the bucket forward to pour your block out.',
    carriesBall: false,
  },
  // The Lab machines: `card` is the whole card picture (they are not the skid-steer-style chassis the others share),
  // `noGrab` hides the Grab button (loads ride on the bed or the tines).
  dump: {
    toolLabel: 'TIP BED',
    joints: [],
    card: (c) =>
      '<path d="M3 31h57v4H3z" fill="#0b121a"/><path d="M5 20L37 13v16H5z" fill="' +
      c +
      '" stroke="#0b121a" stroke-width="1.5"/><path d="M39 17h10l5 7v7H39z" fill="' +
      c +
      '" stroke="#0b121a" stroke-width="1.5"/><path d="M42 19h5l3 5h-8z" fill="#203e50"/>' +
      '<circle cx="13" cy="36" r="5.2" fill="#161c21" stroke="#93b0be" stroke-width="1.5"/><circle cx="24" cy="36" r="5.2" fill="#161c21" stroke="#93b0be" stroke-width="1.5"/><circle cx="48" cy="36" r="5.2" fill="#161c21" stroke="#93b0be" stroke-width="1.5"/>' +
      '<path d="M20 32L28 22" stroke="#93b0be" stroke-width="2.4"/>',
    releaseHint: null,
    carriesBall: false,
    noGrab: true,
  },
  fork: {
    toolLabel: 'MAST LIFT & TILT',
    joints: ['tilt'],
    card: (c) =>
      '<path d="M8 28h26v7H8z" fill="#0b121a"/><path d="M9 21h25v9H9z" fill="' +
      c +
      '" stroke="#0b121a" stroke-width="1.5"/><path d="M17 9h13v12" fill="none" stroke="#93b0be" stroke-width="2"/>' +
      '<path d="M19 12h9v7h-9z" fill="#203e50"/><path d="M40 5h3v31h-3z" fill="#93b0be"/><path d="M43 31h16v3H43z" fill="#c9d3da"/>' +
      '<path d="M45 22v9h-3" fill="none" stroke="#93b0be" stroke-width="2"/>' +
      '<circle cx="28" cy="35" r="5" fill="#161c21" stroke="#93b0be" stroke-width="1.5"/><circle cx="14" cy="37" r="3.6" fill="#161c21" stroke="#93b0be" stroke-width="1.5"/>',
    releaseHint: null,
    carriesBall: false,
    noGrab: true,
  },
};

/** True when the page uses the touch layout (a touch screen is the main pointer, or ?touch=1). */
export const isTouch = () => document.documentElement.classList.contains('touch');

/** The hint as shown on this device: the touch wording on a touch screen, otherwise unchanged. */
export function hintText(text) {
  if (!isTouch() || !text) return text;
  return touchHint(text);
}

/** Short vibration (ms or a pattern) for grabbing and placing, where the device has it. Off in calm motion. */
function buzz(pattern) {
  try {
    if (isTouch() && !app.settings.reducedMotion && app.settings.haptics !== false) navigator.vibrate?.(pattern);
  } catch {}
}

/** Toasts wait here while another is showing, so two messages never stack over the hint or each other. */
const toastQueue = [];
let toastOn = false;

/** A short message that fades after a few seconds. One shows at a time in a slot just under the hint line (never over
 *  it or the drive deck); the next waits its turn. A message already waiting is not queued twice, and a backlog is
 *  trimmed to the newest few so an old message never arrives late. */
export function toast(text) {
  if (toastQueue.includes(text)) return;
  toastQueue.push(text);
  while (toastQueue.length > 3) toastQueue.shift();
  if (!toastOn) nextToast();
}

function nextToast() {
  const text = toastQueue.shift();
  if (text === undefined) {
    toastOn = false;
    return;
  }
  toastOn = true;
  const e = h('div', { class: 'toast' }, text);
  $('#toasts').replaceChildren(e);
  placeToasts();
  setTimeout(() => {
    e.remove();
    nextToast();
  }, 3600);
}

/** Puts the toast slot centered under the hint line (or where it would be when the hint is empty), kept inside the
 *  window. On the title, which has no hint, it falls back to the stylesheet's position. */
function placeToasts() {
  const slot = $('#toasts'),
    hint = $('#hint');
  if ($('#hud').hidden) {
    slot.style.top = slot.style.left = '';
    return;
  }
  const box = hint.getBoundingClientRect(),
    top = box.height ? box.bottom : parseFloat(getComputedStyle(hint).top) || 0,
    half = (slot.firstChild?.getBoundingClientRect().width || 0) / 2,
    center = box.height ? box.left + box.width / 2 : innerWidth / 2;
  slot.style.top = top + 8 + 'px';
  slot.style.left = Math.max(half + 8, Math.min(innerWidth - half - 8, center)) + 'px';
}

/** How long a hint stays up on a touch screen before the strip goes back to the job's goal (ms). */
const HINT_MS = 7000;
let hintTimer = 0;

/** Replaces the hint line. On a touch screen it is a slim strip under the top bar that falls back to the job's goal
 *  after a few seconds, so it never stays over the yard longer than it is useful. */
export function showHint(text) {
  const el = $('#hint');
  clearTimeout(hintTimer);
  el.classList.remove('goal');
  el.textContent = hintText(text);
  if (text && isTouch()) {
    hintTimer = setTimeout(() => {
      if (app.jobDone) return;
      el.classList.add('goal');
      el.textContent = $('#goal').textContent;
    }, HINT_MS);
  }
  if (toastOn) placeToasts();
}

/** Opens the modal sheet with a title and content. Play time stops and the controls and music pause while it is up.
 *  `kind` ('pause', 'results', 'board') lets the stylesheet size the sheet like the family's matching panel. */
export function modal(title, children, { kind = '' } = {}) {
  account();
  app.labResults?.destroy();
  app.labResults = null;
  app.controls?.setEnabled(false);
  $('#modal-title').textContent = title;
  $('#modal .modal-card').dataset.kind = kind;
  $('#modal-body').replaceChildren(...children);
  $('#modal').hidden = false;
  app.playStart = null;
  Music.play(false);
  $('#modal-close').focus();
}

/** Closes the modal (and any on-screen keyboard in it) and resumes play, controls and music. */
export function closeModal() {
  app.labResults?.destroy();
  app.labResults = null;
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
  if (MACHINE_UI[kind].card) return `<svg viewBox="0 0 64 46" aria-hidden="true">${MACHINE_UI[kind].card(c)}</svg>`;
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
  $('#grab').hidden = !!ui.noGrab;
  $('#tool-label').innerHTML =
    `${ui.toolLabel} <small class="kb">I J K L</small><small class="drag">drag the stick</small>`;
  for (const b of document.querySelectorAll('[data-hold]')) {
    const axis = b.dataset.hold.split(':')[0];
    b.hidden = !ui.joints.includes(axis);
  }
  updateUI();
  measureInsets();
}

/** On a touch screen, tells the camera how much of the screen the top bar and the bottom controls cover, so it frames
 *  the machine in the free band between them. Call it when the window changes shape or the HUD appears. */
export function measureInsets() {
  const scene = app.scene,
    hud = $('#hud');
  if (!scene) return;
  if (!isTouch() || hud.hidden) {
    scene.setInsets(0, 0);
    return;
  }
  const bar = $('.hud-top').getBoundingClientRect(),
    cluster = $('.work-buttons').getBoundingClientRect();
  scene.setInsets(Math.round(bar.bottom + 30), cluster.height ? Math.round(innerHeight - cluster.top + 10) : 0);
}

/** Cached lookups for the per-frame update, so a frame does not search the page. */
const refs = {};
let lastYard = null,
  lastHeld = false,
  lastCount = 0;

/** Vibrates briefly when a block is grabbed or let go and for a little longer when it is placed on the outline. */
function haptics(yard) {
  const held = !!yard.held,
    count = app.mission?.status.count ?? 0;
  if (lastYard !== yard) lastYard = yard;
  else {
    if (held !== lastHeld) buzz(held ? 14 : 8);
    if (count > lastCount) buzz([22, 40, 30]);
  }
  lastHeld = held;
  lastCount = count;
}

/** Keeps the Grab/Release button and the progress line current; touches the DOM only when they change. */
export function updateUI() {
  const yard = app.yard;
  if (!yard) return;
  const grab = (refs.grab ||= $('#grab')),
    progress = (refs.progress ||= $('#progress')),
    held = String(!!yard.held);
  // Grab glows while a block is in reach (the block itself glows in the yard)
  const ready = String(!!app.grabReady && !yard.held);
  if (grab.dataset.ready !== ready) {
    grab.dataset.ready = ready;
    grab.classList.toggle('ready', ready === 'true');
  }
  if (grab.dataset.held !== held) {
    grab.dataset.held = held;
    grab.innerHTML = `${icon(yard.held ? 'air' : 'land')} ${yard.held ? 'Release' : 'Grab'} <kbd>SPACE</kbd>`;
  }
  // The counter's text is rebuilt only when its numbers change (no string is made on the frames in between). A blueprint
  // adds its build challenge on a second line: "Grabs 4 · par 9" or "Height 3.6 m · target 6.4 m" (never a clock).
  const mission = app.mission,
    n = mission ? mission.status.count : yard.blocks.length,
    of = mission ? mission.status.total : -1,
    challenge = app.challenge;
  if (challenge?.active) challenge.grabs = yard.grabs;
  // a job's site rule (the hillside's "Keep blocks off the grass") takes the same second line
  const line = challenge?.active ? challenge.label() : mission ? ruleLine(yard.round) : '';
  if (refs.n !== n || refs.of !== of || refs.line !== line || !progress.textContent) {
    refs.n = n;
    refs.of = of;
    refs.line = line;
    const main = mission ? `${n} / ${of} placed` : isTouch() ? `${n} materials` : `${n} materials on site`;
    progress.textContent = main;
    progress.classList.toggle('with-challenge', !!line);
    if (line) progress.append(h('small', { id: 'challenge', class: challenge?.met ? 'met' : '' }, line));
  }
  haptics(yard);
}

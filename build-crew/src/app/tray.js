// The sandbox tools: the materials tray (spawn any toy in any paint color at the striped bay, up to 64 at once),
// terrain stamps placed by tapping the ground, the daylight slider, the wrecking ball, clearing the site (after a
// confirming second tap), and saving the site with a thumbnail to this builder's one slot. A full yard says so instead
// of silently deleting anything.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { TOYS, COLORS } from '../content.mjs';
import { normalizeYard } from '../meta/save.mjs';
import { app, persist, flush } from './state.js';
import { MACHINE_UI, toast, showHint, renderMachines, updateUI } from './hud.js';
import { say } from './voice.js';

/** Where tray materials arrive: the striped spawn bay. */
const BAY = { x: -10, z: 10 };

/** Fills the tray: a button per toy type, the color swatches and the terrain stamps. */
export function buildTray() {
  $('#toys').replaceChildren(
    ...Object.entries(TOYS).map(([kind, d]) =>
      h(
        'button',
        {
          'data-spawn': kind,
          onclick() {
            const yard = app.yard;
            if (yard.blocks.length >= 64) {
              toast('Material limit reached. Save the site or clear room for more.');
              return;
            }
            // New materials drop in stacks of eight, each stack a little higher, so they never spawn inside each other.
            const body = yard.spawn({
              type: kind,
              color: app.spawnColor,
              x: BAY.x,
              y: 4 + Math.floor(yard.blocks.length / 8) * 0.4,
              z: BAY.z,
            });
            if (body) {
              app.scene.emit({ x: BAY.x, y: 3, z: BAY.z });
              updateUI();
            }
          },
        },
        d.name,
      ),
    ),
  );
  $('#colors').replaceChildren(
    ...COLORS.map((color) =>
      h('button', {
        class: 'swatch' + (color === app.spawnColor ? ' on' : ''),
        'aria-label': `Material color ${color}`,
        style: { background: color },
        onclick() {
          app.spawnColor = color;
          buildTray();
        },
      }),
    ),
  );
  $('#terrain').replaceChildren(
    ...['hill', 'pit', 'ramp', 'water'].map((kind) =>
      h(
        'button',
        {
          'data-stamp': kind,
          onclick() {
            app.stamp = kind;
            $('#tray').hidden = true;
            showHint(`Tap a clear patch of ground for your ${kind}.`);
          },
        },
        kind[0].toUpperCase() + kind.slice(1),
      ),
    ),
  );
}

/** Opens or closes the tray. */
export function toggleTray() {
  $('#tray').hidden = !$('#tray').hidden;
  disarmClear();
  buildTray();
  fitTray();
}

export function closeTray() {
  $('#tray').hidden = true;
  disarmClear();
}

/** Caps the tray's height to the room between its top edge and the drive deck, so on a small window it scrolls inside
 *  that room instead of running under the deck's buttons. The deck changes height with the machine (extra joint buttons),
 *  so main.js calls this again whenever the deck or the window resizes. */
export function fitTray() {
  const tray = $('#tray');
  // On a touch screen the tray is a sheet placed by the stylesheet (above the sticks, scrolling inside itself).
  if (document.documentElement.classList.contains('touch')) {
    tray.style.maxHeight = '';
    return;
  }
  if (tray.hidden) return;
  const deck = document.querySelector('.drive-deck').getBoundingClientRect();
  tray.style.maxHeight = '';
  const room = deck.top - tray.getBoundingClientRect().top - 10;
  if (room > 0) tray.style.maxHeight = Math.max(140, room) + 'px';
}

/** A tap on the yard while a terrain stamp is chosen (sandbox only) places it there. */
export function placeStamp(e) {
  const { yard, scene, stamp } = app;
  if (!stamp || yard.round.id) return;
  const p = scene.groundPoint(e);
  if (p) {
    if (yard.stamp(stamp, p.x, p.z)) {
      scene.syncStamps();
      toast('Terrain placed.');
      app.stamp = null;
    } else toast('Try a clear patch. There is room for twelve terrain pieces.');
  }
}

let clearTimer = 0;

/** Puts the Clear site button back to its resting state and forgets a pending confirmation. */
function disarmClear() {
  clearTimeout(clearTimer);
  clearTimer = 0;
  const button = $('#clear-yard');
  button.textContent = 'Clear site';
  button.classList.remove('armed');
  $('#clear-ask').textContent = '';
}

/** Removes every toy from the sandbox, but only after a second tap. The first tap asks "Clear site?" and turns the
 *  button into "Yes, clear"; if the child does nothing it quietly goes back after four seconds. A confirm was chosen
 *  over an undo toast because it needs no countdown or pressure text on screen (SPEC kid rules) and nothing has to
 *  be restored: the build is untouched until the child says yes. */
export function clearSite() {
  const yard = app.yard;
  if (!clearTimer) {
    if (!yard.blocks.length) {
      toast('The site is already clear.');
      return;
    }
    const button = $('#clear-yard');
    button.textContent = 'Yes, clear';
    button.classList.add('armed');
    $('#clear-ask').textContent = 'Clear site?';
    clearTimer = setTimeout(disarmClear, 4000);
    return;
  }
  disarmClear();
  yard.release();
  for (const b of yard.blocks) yard.world.removeRigidBody(b.body);
  yard.blocks = [];
  updateUI();
  toast('Site cleared.');
}

/** Switches to the machine that carries the wrecking ball and hangs it (or takes it down). */
export function toggleWreckingBall() {
  const yard = app.yard;
  const i = yard.machines.findIndex((m) => MACHINE_UI[m.kind].carriesBall);
  if (i >= 0) {
    yard.select(i);
    yard.wreck();
    renderMachines();
  }
}

/** Saves the sandbox (toys, machines, stamps, daylight) to this builder's slot, plus a device-only thumbnail. If
 *  storage refuses, the previous good save stays in place. */
export function saveYard() {
  flush();
  const snapshot = normalizeYard({ ...app.yard.snapshot(), daylight: app.scene.daylight });
  const old = app.save.yard;
  app.save.yard = snapshot;
  if (!persist()) {
    app.save.yard = old;
    return;
  }
  try {
    localStorage.setItem(`buildCrew.${app.playerId}.thumb`, app.scene.thumbnail());
  } catch {}
  toast('Site saved.');
  say('Site saved.');
}

/** Wires the daylight slider: a custom button-style slider (no native input) driven by pointer drag or the arrow,
 *  Home and End keys. */
export function bindDaylight() {
  const slider = $('#daylight');
  function daylight(n) {
    const scene = app.scene;
    scene.daylightTo(Math.max(0, Math.min(1, n)));
    slider.setAttribute('aria-valuenow', Math.round(scene.daylight * 100));
    slider.querySelector('i').style.left = `${scene.daylight * 100}%`;
  }
  function slide(e) {
    const r = slider.getBoundingClientRect();
    daylight((e.clientX - r.left) / r.width);
  }
  slider.onpointerdown = (e) => {
    slider.setPointerCapture(e.pointerId);
    slide(e);
  };
  slider.onpointermove = (e) => {
    if (slider.hasPointerCapture(e.pointerId)) slide(e);
  };
  slider.onkeydown = (e) => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.code)) {
      e.preventDefault();
      const scene = app.scene;
      daylight(
        e.code === 'Home' ? 0 : e.code === 'End' ? 1 : scene.daylight + (e.code === 'ArrowRight' ? 0.05 : -0.05),
      );
    }
  };
}

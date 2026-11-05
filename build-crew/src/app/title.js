// The title screen: the builder profiles (shared with the family's other games), adding a builder with the shared
// on-screen keyboard, the start buttons, the job board, the saved-site card and the "looks" earned as job rewards
// (paints, decals and the bell horn). Returning here from a job stops speech, saves and lets sync apply.
import * as Profiles from '../../../spell-jump/src/spelling/profiles.js';
import { createKeyboard } from '../../../spell-jump/src/spelling/keyboard.js';
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { refreshStreak } from '../../../spell-jump/src/meta/engagement.js';
import { icon } from '../../../spell-jump/src/ui/icons.js';
import { BLUEPRINTS, LAB_MACHINES, MACHINES, labVehicleId, JOB_COUNT, SITE_JOBS } from '../content.mjs';
import { blueprintSvg } from '../blueprint.mjs';
import { labBridge } from '../meta/labBridge.js';
import { VEHICLE_PRICE } from './vehiclePrice.mjs';
import { loadSave } from '../meta/save.mjs';
import { Music } from '../meta/music.js';
import { Sound } from '../meta/sound.js';
import { app, persist, account, applyLook } from './state.js';
import { toast, modal, closeModal } from './hud.js';
import { applyVoice, hush } from './voice.js';
import { startRound } from './rounds.js';

/** Paint rewards in the order the looks row shows them; Original appears once any paint is earned. */
const PAINT_LOOKS = [
  ['stock', 'Original'],
  ['cream', 'Limestone'],
  ['leaf', 'Forest'],
  ['sky', 'Steel blue'],
  ['sunset', 'Sunset'],
  ['graphite', 'Graphite'],
  ['harbor', 'Harbor blue'],
  ['sage', 'Sage'],
  ['rust', 'Rust'],
];
/** The decals in the looks row: their button label and the toast that names them. */
const DECAL_LOOKS = {
  star: ['★ Decal', 'A star for your crew!'],
  stripe: ['▧ Stripes', 'Racing stripes!'],
  chevron: ['» Chevrons', 'Chevron decal on.'],
  anchor: ['⚓ Anchor', 'Anchor decal on.'],
  mountain: ['▲ Mountain', 'Mountain decal on.'],
};
/** The horns in the order the horn button cycles through them (the stock air horn is always there). */
const HORN_ORDER = ['stock', 'bell', 'ferry', 'steam'];

/** The "Who is building?" sheet: a name typed on the shared on-screen keyboard creates a builder and selects it. */
export function newPlayer() {
  let name = '';
  const out = h('div', { class: 'name-display', role: 'status' }, 'Your name');
  app.keyboard?.destroy();
  const keyboard = createKeyboard({
    enterLabel: 'Ready',
    onKey(c) {
      name = (name + c).slice(0, Profiles.MAX_NAME);
      draw();
    },
    onBackspace() {
      name = name.slice(0, -1);
      draw();
    },
    onEnter() {
      const family = app.family;
      const p = Profiles.createPlayer(family, name, Profiles.PLAYER_COLORS[family.players.length % 6]);
      if (!p) return;
      closeModal();
      selectPlayer(p.id);
    },
  });
  app.keyboard = keyboard;
  function draw() {
    out.textContent = name || 'Your name';
    keyboard.setEnterEnabled(!!Profiles.cleanName(name));
  }
  modal('Who is building?', [
    h('p', {}, 'Your jobs, equipment and saved site stay with this profile.'),
    out,
    keyboard.el,
  ]);
  keyboard.setActive(true);
  draw();
}

/** Tells the Lab who is building (it keeps one doc per builder; choosing another builder attaches again). */
export function attachLab(id) {
  const p = Profiles.playerById(app.family, id);
  if (p)
    labBridge.attach({
      playerId: id,
      name: p.name,
      color: p.color,
      reducedMotion: app.settings.reducedMotion,
      sound: app.settings.sound,
    });
}

/** Switches to builder `id`: saves the previous builder's time, loads this one's save and voice. */
export function selectPlayer(id) {
  account();
  persist();
  app.playerId = id;
  app.save = loadSave(id);
  app.family.lastPlayer = id;
  Profiles.writeFamily(app.family);
  refreshStreak(app.save, Date.now());
  persist();
  attachLab(id);
  hush();
  app.voiceKey = '';
  applyVoice();
  renderTitle();
}

/** Runs `then` for the current builder, or asks who is building first. */
export function ensurePlayer(then) {
  if (app.playerId) {
    then();
    return;
  }
  newPlayer();
}

/** Redraws the title panel for the current builder: profiles, progress, start label, saved site and looks. */
export function renderTitle() {
  const { family, playerId, save } = app;
  const row = $('#profile-row');
  row.replaceChildren(
    ...family.players.map((p) =>
      h(
        'button',
        {
          class: 'profile-button' + (p.id === playerId ? ' on' : ''),
          'data-profile': p.id,
          onclick: () => selectPlayer(p.id),
        },
        h('span', { class: 'avatar-dot', style: { background: p.color } }, p.name[0].toUpperCase()),
        p.name,
      ),
    ),
  );
  if (family.players.length < Profiles.MAX_PLAYERS) {
    row.append(h('button', { class: 'profile-button', id: 'add-player', onclick: newPlayer }, '+ Add builder'));
  }
  // The twenty jobs are the count; the Lab blueprints (ids 101 to 104) are extra and never change it.
  const jobsDone = save.done.filter((id) => id <= JOB_COUNT).length;
  $('#done-total').textContent = `${jobsDone} / ${JOB_COUNT}`;
  $('#play').firstChild.textContent = jobsDone === JOB_COUNT ? 'Build again ' : jobsDone ? 'Resume ' : 'Start building ';
  $('#my-yard').hidden = !save.yard;
  $('#saved-thumb').replaceChildren();
  if (save.yard) {
    try {
      const src = localStorage.getItem(`buildCrew.${playerId}.thumb`);
      if (src) $('#saved-thumb').append(h('img', { src, alt: 'Your saved construction yard' }));
    } catch {}
  }
  renderLooks(save);
  renderLab();
}

/** The title's two Lab buttons ("The Lab" and "Gallery") exist only once the Lab has loaded: with /lab/ missing or
 *  blocked they never appear and the title is exactly the game's own. */
export function renderLab() {
  const on = labBridge.ready && !!app.playerId;
  for (const id of ['lab-open', 'lab-gallery']) $('#' + id).hidden = !on;
}

/** The looks row: earned paints (plus Original), the star and stripe decals, and the bell horn. The buttons change
 *  the current builder's save when pressed. */
function renderLooks(save) {
  const looks = $('#looks');
  looks.replaceChildren();
  const anyPaint = PAINT_LOOKS.some(([r]) => r !== 'stock' && save.rewards.includes(r));
  for (const [k, label] of PAINT_LOOKS) {
    if ((k === 'stock' && anyPaint) || save.rewards.includes(k)) {
      looks.append(
        h(
          'button',
          {
            'aria-pressed': String(save.paint === k),
            onclick() {
              app.save.paint = k;
              persist();
              applyLook();
              renderTitle();
            },
          },
          label,
        ),
      );
    }
  }
  for (const [decal, [label, said]] of Object.entries(DECAL_LOOKS)) {
    if (save.rewards.includes(decal)) {
      looks.append(
        h(
          'button',
          {
            'aria-pressed': String(save.decal === decal),
            onclick() {
              app.save.decal = app.save.decal === decal ? 'none' : decal;
              persist();
              applyLook();
              toast(said);
              renderTitle();
            },
          },
          label,
        ),
      );
    }
  }
  // One horn button cycles through the horns this builder has earned and sounds the one now fitted.
  const horns = HORN_ORDER.filter((k) => k === 'stock' || save.rewards.includes(k));
  if (horns.length > 1) {
    looks.append(
      h(
        'button',
        {
          id: 'horn-look',
          onclick() {
            app.save.horn = horns[(horns.indexOf(app.save.horn) + 1) % horns.length];
            persist();
            Sound.horn(app.save.horn);
          },
        },
        '♫ Horn',
      ),
    );
  }
}

/** The job board: every job with its reward; a job opens once the one before it is done (all of them in tests). Below it,
 *  once the Lab has loaded, a Blueprints row and a Vehicles row show the Lab's extras with their lock and price: a tap on
 *  a locked one opens the Lab shop at Build Crew, a tap on an owned blueprint starts it. */
export function jobBoard() {
  const save = app.save;
  const lab = labBridge.ready;
  const own = (id) => labBridge.owns(id);
  // The jobs, site by site (the yard, the harbor, the hillside): each site is a row with its code and how many of its
  // jobs are done. A site whose first job is not open yet still shows its jobs, locked, so the road ahead is visible.
  const sites = SITE_JOBS.flatMap(({ site, code, jobs }) => [
    h(
      'h3',
      { class: 'board-row site-row', 'data-site': site },
      code,
      h('small', {}, `${jobs.filter((r) => save.done.includes(r.id)).length} / ${jobs.length}`),
    ),
    h(
      'div',
      { class: 'job-grid', 'data-site-jobs': site },
      ...jobs.map((r) =>
        h(
          'button',
          {
            class: 'job-tile',
            'data-job': r.id,
            'data-site': site,
            disabled: !app.testing && r.id > 1 && !save.done.includes(r.id - 1),
            onclick: () => startRound(r.id),
          },
          h('b', {}, `${save.done.includes(r.id) ? '✓ ' : ''}${String(r.id).padStart(2, '0')} / ${r.title}`),
          h('small', {}, r.reward),
        ),
      ),
    ),
  ]);
  modal('The job board', [
    h('p', {}, 'Complete jobs to unlock equipment and finishes. Replay any completed job.'),
    ...sites,
    lab ? h('h3', { class: 'board-row' }, 'Blueprints') : null,
    lab
      ? h(
          'div',
          { class: 'job-grid blueprints', id: 'blueprint-row' },
          ...BLUEPRINTS.map((r) => {
            const owned = own(r.lab);
            return h(
              'button',
              {
                class: 'job-tile blueprint' + (owned ? '' : ' locked'),
                'data-job': r.id,
                'data-owned': String(owned),
                onclick: () => (owned ? startRound(r.id) : labBridge.openShop({})),
              },
              h('span', { class: 'bp-art', html: blueprintSvg(r) }),
              h('b', {}, owned ? '' : h('span', { class: 'lock', html: icon('lock') }), `${save.done.includes(r.id) ? '✓ ' : ''}${r.title}`),
              h('small', {}, owned ? 'Blueprint' : `${r.price.toLocaleString('en-US')} Lab coins`),
            );
          }),
        )
      : null,
    lab ? h('h3', { class: 'board-row' }, 'Vehicles') : null,
    lab
      ? h(
          'div',
          { class: 'job-grid vehicles', id: 'vehicle-row' },
          ...LAB_MACHINES.map((k) => {
            const owned = own(labVehicleId(k));
            return h(
              'button',
              {
                class: 'job-tile vehicle' + (owned ? '' : ' locked'),
                'data-vehicle': k,
                'data-owned': String(owned),
                onclick: () => (owned ? startRound(0) : labBridge.openShop({})),
              },
              h('b', {}, owned ? '' : h('span', { class: 'lock', html: icon('lock') }), MACHINES[k].label),
              h('small', {}, owned ? 'In your sandbox' : `${VEHICLE_PRICE[k].toLocaleString('en-US')} Lab coins`),
            );
          }),
        )
      : null,
  ].filter(Boolean));
}

/** Back to the title ("Back to base"): stops speech and input, saves, frames the whole yard and lets sync run. */
export function showTitle() {
  hush();
  account();
  persist();
  app.controls.clear();
  app.controls.setEnabled(false);
  app.screen = 'title';
  app.paused = false;
  closeModal();
  app.screen = 'title';
  app.controls.setEnabled(false);
  $('#hud').hidden = true;
  $('#title').hidden = $('#title-head').hidden = $('#title-foot').hidden = false;
  const scene = app.scene;
  scene.overview = true;
  scene.yaw = -0.68;
  scene.pitch = 0.68;
  scene.distance = 35;
  renderTitle();
  Music.play(true);
  app.updater.check();
  app.sync.syncNow();
}

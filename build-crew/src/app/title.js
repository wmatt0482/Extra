// The menu screens, laid out like the family's other games: the "Who's building?" picker and the New builder screen
// (src/app/players.js draws them; the players are the family's, shared with every game), then the home screen: the
// builder's top bar, the logo, Start building and the menu (Sandbox, the job board, the saved site, Parents, the Lab),
// and the "looks" earned as job rewards (paints, decals and the horns). Going home from a job stops speech, saves and
// lets sync apply. app.screen is 'players', 'newplayer', 'title' (home) or 'play'.
import * as Profiles from '../../../spell-jump/src/spelling/profiles.js';
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { refreshStreak } from '../../../spell-jump/src/meta/engagement.js';
import { icon } from '../../../spell-jump/src/ui/icons.js';
import { BLUEPRINTS, LAB_MACHINES, MACHINES, labVehicleId, JOB_COUNT, SITE_JOBS } from '../content.mjs';
import { jobPayout, payoutText, measureLine } from '../payout.mjs';
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
import { createPlayers, hardHat } from './players.js';

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

let menus = null;

/** Creates the picker and the New builder screen (main.js calls it once, after the Parent Zone exists). */
export function initMenus() {
  menus = createPlayers({
    onPick: selectPlayer,
    onNew: showNewPlayer,
    onBack: showPlayers,
    onParents: () => app.openParents(),
  });
}

/** Shows one menu screen ('players', 'newplayer' or 'title') over the live yard; the HUD and the other menus hide. */
function showMenu(name) {
  if (app.screen === 'newplayer' && name !== 'newplayer') menus.hideNew();
  app.screen = name;
  $('#screen-players').hidden = name !== 'players';
  $('#screen-newplayer').hidden = name !== 'newplayer';
  $('#title').hidden = name !== 'title';
  $('#hud').hidden = true;
  document.documentElement.dataset.screen = name;
}

/** "Who's building?": the family's players and New player. Leaving a builder saves their time first. */
export function showPlayers() {
  leavePlay();
  showMenu('players');
  menus.showPicker();
}

/** The New builder screen (a name on the on-screen keyboard and a colour). */
export function showNewPlayer() {
  showMenu('newplayer');
  menus.showNew();
}

/** Switches to builder `id`: saves the previous builder's time, loads this one's save and voice, then goes home. */
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
  showTitle();
}

/** Runs `then` for the current builder, or asks who is building first. */
export function ensurePlayer(then) {
  if (app.playerId && Profiles.playerById(app.family, app.playerId)) {
    then();
    return;
  }
  showPlayers();
}

/** Redraws whichever menu is up (after sync or the Parent Zone changed the family); a builder who is gone sends the
 *  home screen back to the picker. */
export function refreshMenus() {
  if (app.screen === 'players') menus.showPicker();
  else if (app.screen === 'title') {
    if (!app.playerId || !Profiles.playerById(app.family, app.playerId)) showPlayers();
    else renderTitle();
  }
}

/** Redraws the home screen for the current builder: the top bar, progress, the start label, saved site and looks. */
export function renderTitle() {
  const { family, playerId, save } = app;
  const p = Profiles.playerById(family, playerId);
  if (p) {
    $('#title-avatar').innerHTML = hardHat(p.color);
    $('#title-player').textContent = p.name;
    $('#btn-player').dataset.profile = p.id;
    $('#btn-player').style.setProperty('--c', p.color);
  }
  // The twenty jobs are the count; the Lab blueprints (ids 101 to 104) are extra and never change it.
  const jobsDone = save.done.filter((id) => id <= JOB_COUNT).length;
  $('#done-total').textContent = `${jobsDone} / ${JOB_COUNT}`;
  $('#title-jobs').textContent = `${jobsDone} / ${JOB_COUNT}`;
  const streak = save.streak?.count || 0;
  $('#title-streak').hidden = !streak;
  $('#title-streak').dataset.count = String(streak);
  $('#title-streak-n').textContent = String(streak);
  $('#play-label').textContent = jobsDone === JOB_COUNT ? 'Build again' : jobsDone ? 'Next job' : 'Start building';
  $('#my-yard').hidden = !save.yard;
  $('#saved-thumb').replaceChildren();
  if (save.yard) {
    try {
      const src = localStorage.getItem(`buildCrew.${playerId}.thumb`);
      if (src) $('#saved-thumb').append(h('img', { src, alt: 'Your saved construction yard' }));
    } catch {}
  }
  renderSound();
  renderLooks(save);
  renderLab();
}

/** The home screen's sound button shows whether sound is on. */
export function renderSound() {
  const b = $('#sound-title');
  b.setAttribute('aria-label', app.settings.sound ? 'Sound on' : 'Sound off');
  b.setAttribute('aria-pressed', String(!!app.settings.sound));
  b.classList.toggle('off', !app.settings.sound);
}

/** The home menu's two Lab buttons ("The Lab" and "Gallery") exist only once the Lab has loaded: with /lab/ missing or
 *  blocked they never appear and the menu is exactly the game's own. The menu grid is told how many buttons show, and
 *  an odd last one spans the row. */
export function renderLab() {
  const on = labBridge.ready && !!app.playerId;
  for (const id of ['lab-open', 'lab-gallery']) $('#' + id).hidden = !on;
  const row = $('#title .menu-row'),
    shown = [...row.children].filter((b) => !b.hidden);
  row.dataset.count = String(shown.length);
  for (const b of shown) b.classList.toggle('wide', shown.length % 2 === 1 && b === shown.at(-1));
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
      ...jobs.map((r) => {
        const done = save.done.includes(r.id),
          shut = !app.testing && r.id > 1 && !save.done.includes(r.id - 1);
        // a card like Trail Blazer's trail list: the job number in a square (filled yellow once done, a lock until it
        // opens), the job's name, and what it unlocks
        return h(
          'button',
          {
            class: 'card job-tile' + (done ? ' done' : ''),
            'data-job': r.id,
            'data-site': site,
            disabled: shut,
            onclick: () => startRound(r.id),
          },
          h(
            'span',
            { class: 'jt-num', 'aria-hidden': 'true' },
            shut ? h('span', { class: 'lock', html: icon('lock') }) : String(r.id).padStart(2, '0'),
          ),
          h('b', {}, h('span', { class: 'sr-only' }, `Job ${r.id}${done ? ', done' : ''}: `), r.title),
          h('small', {}, r.reward),
          // what the job pays in the Lab (only once the Lab is there), and the blueprint's measurements in metres
          lab ? h('small', { class: 'pay' }, payoutText(jobPayout(r, { replay: done }))) : null,
          measureLine(r) ? h('small', { class: 'measure' }, measureLine(r)) : null,
        );
      }),
    ),
  ]);
  modal(
    'Job board',
    [
      h('p', { class: 'board-intro' }, 'Complete jobs to unlock equipment and finishes. Replay any completed job.'),
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
                  class: 'card job-tile blueprint' + (owned ? '' : ' locked'),
                  'data-job': r.id,
                  'data-owned': String(owned),
                  onclick: () => (owned ? startRound(r.id) : labBridge.openShop({})),
                },
                h('span', { class: 'bp-art', html: blueprintSvg(r) }),
                h(
                  'b',
                  {},
                  owned ? '' : h('span', { class: 'lock', html: icon('lock') }),
                  `${save.done.includes(r.id) ? '✓ ' : ''}${r.title}`,
                ),
                h('small', {}, owned ? 'Blueprint' : `${labBridge.price(r.lab, r.price).toLocaleString('en-US')} Lab coins`),
                lab ? h('small', { class: 'pay' }, payoutText(jobPayout(r, { replay: save.done.includes(r.id) }))) : null,
                h('small', { class: 'measure' }, measureLine(r)),
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
                  class: 'card job-tile vehicle' + (owned ? '' : ' locked'),
                  'data-vehicle': k,
                  'data-owned': String(owned),
                  onclick: () => (owned ? startRound(0) : labBridge.openShop({})),
                },
                h('b', {}, owned ? '' : h('span', { class: 'lock', html: icon('lock') }), MACHINES[k].label),
                h('small', {}, owned ? 'In your sandbox' : `${labBridge.price(labVehicleId(k), VEHICLE_PRICE[k]).toLocaleString('en-US')} Lab coins`),
              );
            }),
          )
        : null,
    ].filter(Boolean),
    { kind: 'board' },
  );
}

/** Stops a job or the sandbox, if one is open: speech, input and play time stop, the save is written, the camera frames
 *  the whole yard and sync may apply again. */
function leavePlay() {
  hush();
  account();
  persist();
  app.controls.clear();
  app.controls.setEnabled(false);
  app.paused = false;
  if (!$('#modal').hidden) closeModal();
  app.controls.setEnabled(false);
  const scene = app.scene;
  if (scene && app.screen === 'play') {
    scene.overview = true;
    scene.yaw = -0.68;
    scene.pitch = 0.68;
    scene.distance = 35;
  }
}

/** Home ("Back to base"): the builder's home screen over the whole yard; music plays, updates and sync may run. */
export function showTitle() {
  const fromPlay = app.screen === 'play';
  leavePlay();
  showMenu('title');
  renderTitle();
  Music.play(true);
  if (fromPlay) {
    app.updater.check();
    app.sync.syncNow();
  }
}

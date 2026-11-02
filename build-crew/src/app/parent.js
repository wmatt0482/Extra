// The Parent Zone adapter. The shared zone from Spell Jump owns the PIN, the family's builders, sync and the voice
// picker; this file gives it Build Crew's hooks (saves, settings, voice preparation, import/export) and adds two
// panels to its unlocked views: a Report with jobs completed and minutes played per day (the child never sees play
// time), and an Options switch that unlocks every implemented machine and the wrecking ball for one builder.
import * as Profiles from '../../../spell-jump/src/spelling/profiles.js';
import { tts } from '../../../spell-jump/src/spelling/tts.js';
import { createParentZone } from '../../../spell-jump/src/ui/parentZone.js';
import { dayChart, lastDays } from '../../../spell-jump/src/ui/chart.js';
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { Audio } from '../../../spell-jump/src/audio.js';
import { VERSION } from '../content.mjs';
import { defaultSave, loadSave } from '../meta/save.mjs';
import { writeSave } from '../meta/sync.js';
import { Music } from '../meta/music.js';
import { labBridge } from '../meta/labBridge.js';
import { app, account, flush, setSetting } from './state.js';
import { toast } from './hud.js';
import { applyVoice, cloudDefault, prepareVoice } from './voice.js';
import { newPlayer, renderTitle } from './title.js';

/** Creates the shared Parent Zone with Build Crew's adapter, adds the report and options panels whenever the zone
 *  shows its unlocked views, and wires the title's Parents button. */
export function initParentZone() {
  app.pz = createParentZone(parentAdapter());
  new MutationObserver(parentExtras).observe($('#pz'), {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-view'],
  });
  $('#parents').onclick = () => {
    flush();
    app.controls.setEnabled(false);
    Music.play(false);
    app.pz.open(app.playerId);
  };
}

/** What the shared zone needs from the game. */
function parentAdapter() {
  return {
    get family() {
      return app.family;
    },
    get currentPlayerId() {
      return app.playerId;
    },
    audio: Audio,
    tts,
    cloud: app.cloud,
    sync: app.sync,
    version: VERSION,
    toast,
    ping: app.ping,
    wordsFor: Profiles.loadWords,
    saveWordsFor: Profiles.writeWords,
    persistFamily: () => Profiles.writeFamily(app.family),
    onOptionsChanged(id) {
      if (id === app.playerId) {
        app.voiceKey = '';
        applyVoice();
      }
    },
    cloudDefault,
    /** A natural voice was picked for builder `id`: make Build Crew's lines in it (not the Spell Jump word list, which
     *  this game never speaks). Another builder's lines are made when that builder is chosen. */
    cloudPrepareFor: async (id) => {
      if (id === app.playerId) await prepareVoice();
    },
    settingsFor: () => ({ ...app.settings, shake: 0 }),
    setSettingFor: (_, k, v) => setSetting(k, v),
    /** A parent's reset: a fresh save whose newer resetAt wins over every synced copy. */
    resetGameFor(id) {
      const fresh = defaultSave();
      fresh.resetAt = Date.now();
      writeSave(id, fresh);
      if (id === app.playerId) app.save = fresh;
    },
    removePlayer(id) {
      Profiles.removePlayer(app.family, id);
      if (id === app.playerId) {
        app.playerId = app.family.players[0]?.id || null;
        app.save = app.playerId ? loadSave(app.playerId) : defaultSave();
      }
    },
    /** Picks up anything the parent changed, then resumes the screen underneath. */
    onParentZoneClosed() {
      app.family = Profiles.loadFamily();
      app.save = app.playerId ? loadSave(app.playerId) : defaultSave();
      applyVoice();
      renderTitle();
      app.controls.setEnabled(app.screen === 'play' && $('#modal').hidden);
      account();
      Music.play(true);
    },
    reloadNow() {
      flush();
      location.reload();
    },
    go: () => newPlayer(),
    async exportProgress(id) {
      return JSON.stringify({
        game: 'build-crew',
        name: Profiles.playerById(app.family, id)?.name,
        save: loadSave(id),
      });
    },
    /** Imports a transfer from another device, merging it into the builder of the same name (or a new builder). */
    async importProgress(text) {
      try {
        if (text.length > 200000) return { ok: false, error: 'That transfer is too large.' };
        const r = JSON.parse(text);
        if (r.game !== 'build-crew' || !r.save) return { ok: false, error: 'Use a Build Crew transfer.' };
        const family = app.family;
        let p = family.players.find((p) => p.name === Profiles.cleanName(r.name));
        if (!p) p = Profiles.createPlayer(family, r.name);
        if (!p) return { ok: false, error: 'Add a player or make room for this builder first.' };
        const { mergeBc } = await import('../meta/save.mjs');
        writeSave(p.id, mergeBc({ updatedAt: Date.now(), data: loadSave(p.id) }, { updatedAt: 0, data: r.save }));
        return { ok: true, message: 'Build Crew progress imported.', mode: 'add' };
      } catch {
        return { ok: false, error: 'That transfer could not be read.' };
      }
    },
  };
}

/** Runs on every change inside the zone and adds Build Crew's panel to the Report or Options tab once. */
function parentExtras() {
  if ($('#pz').hidden || $('#pz').dataset.view !== 'main') return;
  const id = $('#pz .pz-ptab.on')?.dataset.player || app.playerId;
  if (!id) return;
  const data = id === app.playerId ? app.save : loadSave(id),
    content = $('#pz .pz-content');
  if (!content) return;
  if (content.dataset.tab === 'report' && !$('#bc-report', content)) content.replaceChildren(report(data));
  if (content.dataset.tab === 'options' && !$('#bc-options', content)) content.prepend(options(id, data));
}

/** Jobs completed and active minutes for each of the last 28 days, with the shared day charts. No scores. */
function report(data) {
  const days = lastDays(28);
  return h(
    'div',
    { class: 'bc-report', id: 'bc-report' },
    h('h3', {}, 'Build Crew'),
    h('p', { class: 'sub' }, 'Creative play. Completed jobs and active play time; no scores or accuracy grades.'),
    h(
      'div',
      { class: 'pz-scores' },
      h('div', { class: 'stat' }, h('b', {}, `${data.done.filter((j) => j <= 10).length} / 10`), h('span', {}, 'Jobs completed')),
    ),
    dayChart({
      days,
      title: 'Jobs completed each day',
      series: [{ label: 'Jobs', color: '#5c8e72', kind: 'bar', values: days.map((d) => data.play[d]?.rounds || 0) }],
    }),
    dayChart({
      days,
      title: 'Minutes played each day',
      left: { unit: 'm' },
      series: [
        {
          label: 'Minutes',
          color: '#bc8052',
          kind: 'line',
          values: days.map((d) => Math.round((data.play[d]?.seconds || 0) / 6) / 10),
        },
      ],
    }),
    qualityPanel(),
  );
}

/** What the picture-quality controller decided on this device: the device tier, the resolution it started at and ended
 *  at, the shadows, the physics step budget, the first-second test and each change with the reason. For a parent
 *  (or whoever helps with a slow tablet); the child never sees it. */
function qualityPanel() {
  const q = app.scene?.quality?.summary();
  if (!q) return h('div');
  const bench = typeof q.benchmark === 'string' ? q.benchmark : `${q.benchmark.frameMs} ms frames, ${q.benchmark.renderMs} ms drawing (${q.benchmark.verdict})`;
  const rows = [
    ['Quality tier', q.tier],
    ['Resolution', q.startPixelRatio === q.pixelRatio ? `${q.pixelRatio}x` : `${q.startPixelRatio}x, now ${q.pixelRatio}x`],
    ['Shadows', q.shadows],
    ['Physics', `60 steps a second, up to ${q.maxPhysicsSteps} per picture${q.interpolated ? ', smoothed between steps' : ''}`],
    ['First-second test', bench],
  ];
  return h(
    'div',
    { class: 'bc-quality', id: 'bc-quality' },
    h('h3', {}, 'Picture quality on this device'),
    h('p', { class: 'sub' }, 'The game lowers its picture detail by itself on a slow device and never raises it again until the page is reloaded.'),
    ...rows.map(([k, v]) => h('p', { class: 'sub' }, h('b', {}, k + ': '), String(v))),
    h(
      'p',
      { class: 'sub' },
      h('b', {}, 'Changes this session: '),
      q.decisions.length
        ? q.decisions.map((d) => `${d.what} ${d.from} to ${d.to} at ${d.at} s (${d.why})`).join('; ')
        : 'none',
    ),
  );
}

/** The free-play unlock switch for one builder; it is stored in that builder's save and syncs with it. */
function options(id, data) {
  const toggle = h(
    'button',
    {
      id: 'bc-unlock',
      role: 'switch',
      'aria-checked': String(data.unlockAll),
      onclick() {
        data.unlockAll = !data.unlockAll;
        writeSave(id, data);
        this.setAttribute('aria-checked', String(data.unlockAll));
        this.textContent = data.unlockAll ? 'All three machines available' : 'Use job rewards';
      },
    },
    data.unlockAll ? 'All three machines available' : 'Use job rewards',
  );
  return h(
    'div',
    { id: 'bc-options' },
    h('h3', {}, 'Build Crew free play'),
    h(
      'p',
      { class: 'sub' },
      'Unlock all implemented machines and the wrecking ball for this builder. Story jobs stay in order.',
    ),
    toggle,
    // The Lab row: shown only once the Lab has loaded. The PIN was just entered, so the Lab's grown-ups panel opens unlocked.
    labBridge.ready
      ? h(
          'div',
          { id: 'bc-lab' },
          h('h3', {}, 'The Lab'),
          h('p', { class: 'sub' }, 'Lab coins, quests, the family board and the Lab switches for the whole family.'),
          h(
            'button',
            {
              id: 'bc-lab-open',
              onclick() {
                $('#pz-close')?.click();
                labBridge.openParent({ unlocked: true });
              },
            },
            'Open the Lab grown-ups panel',
          ),
        )
      : null,
  );
}

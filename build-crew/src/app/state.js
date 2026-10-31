// The app's shared state and session bookkeeping. Every app module reads and writes the one `app` object: who is
// playing and their save, the current physics yard, scene and mission, which screen is up, and the shared services
// main.js creates (sync, voice, controls, Parent Zone, updater). This file also owns the three things every screen
// needs: saving (persist), counting active play time per day for the parent report (account), and the device-local
// settings. Nothing here runs until main.js calls initState(), so the order of start-up stays explicit.
import * as Profiles from '../../../spell-jump/src/spelling/profiles.js';
import { dayKey } from '../../../spell-jump/src/ui/chart.js';
import { $ } from '../../../spell-jump/src/ui/dom.js';
import { Audio } from '../../../spell-jump/src/audio.js';
import { COLORS } from '../content.mjs';
import { defaultSave, loadSave } from '../meta/save.mjs';
import { writeSave } from '../meta/sync.js';
import { Music } from '../meta/music.js';
import { Sound } from '../meta/sound.js';
import { toast } from './hud.js';

/** The shared state. Fields are filled by initState() and by main.js as services are created. */
export const app = {};

/** True only on a developer's own machine: localhost, 127.0.0.1, ::1 or a .local name. */
export const isLocalHost = (host = location.hostname) =>
  host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1' || host.endsWith('.local');

/** Reads the URL flags, device settings and the last builder's save. ?test=1 adds test hooks and opens every job;
 *  the game loop then stops stepping on its own so tests advance the simulation explicitly. The flag is honored only
 *  on a local host, so a child who adds ?test=1 on the live site gets the normal game and no unlocked jobs. */
export function initState() {
  app.params = new URLSearchParams(location.search);
  app.testing = isLocalHost() && app.params.get('test') === '1';
  app.settings = readSettings();
  app.family = Profiles.loadFamily();
  app.playerId = app.family.lastPlayer || app.family.players[0]?.id || null;
  app.save = app.playerId ? loadSave(app.playerId) : defaultSave();
  Object.assign(app, {
    yard: null,
    scene: null,
    mission: null,
    screen: 'title',
    paused: false,
    keyboard: null,
    stamp: null,
    spawnColor: COLORS[0],
    playStart: null,
    lastChime: 0,
    hintIndex: 0,
    said: new Set(),
    voiceKey: '',
    pz: undefined,
  });
}

/** Device-local settings: sound, music and reduced motion (defaulting to the system preference). */
function readSettings() {
  try {
    return {
      sound: true,
      music: true,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      ...JSON.parse(localStorage.getItem('buildCrew.settings') || '{}'),
    };
  } catch {
    return { sound: true, music: true, reducedMotion: false };
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Writes the current builder's save; on failure tells the child, gently, that the previous save is safe. */
export function persist() {
  if (app.playerId && !writeSave(app.playerId, app.save)) {
    toast('The device could not save. Your previous save is safe.');
    return false;
  }
  return true;
}

/** Changes one setting, stores it on this device and applies every setting to the audio, music and scene. */
export function setSetting(k, v) {
  app.settings[k] = v;
  try {
    localStorage.setItem('buildCrew.settings', JSON.stringify(app.settings));
  } catch {}
  Audio.setSound(app.settings.sound);
  Audio.music(false);
  Music.on(app.settings.music);
  Sound.on(app.settings.sound);
  document.documentElement.classList.toggle('reduced-motion', app.settings.reducedMotion);
  if (app.scene) app.scene.reducedMotion = app.settings.reducedMotion;
}

/** Only visible, unpaused play on a job or the sandbox counts as play time (SPEC §7). */
export const activePlay = () =>
  app.screen === 'play' && !app.paused && !app.pz?.isOpen && !document.hidden && $('#modal').hidden;

/** Adds the play time since the last call to the save, split at local midnight so each day gets its own minutes,
 *  then restarts the clock if play is still active. Call it whenever play may start or stop. */
export function account() {
  const now = Date.now();
  if (app.playStart !== null && app.playerId) {
    let from = app.playStart;
    while (from < now) {
      const end = new Date(from);
      end.setHours(24, 0, 0, 0);
      const to = Math.min(now, end.getTime());
      const key = dayKey(from);
      app.save.play[key] ||= { rounds: 0, seconds: 0 };
      app.save.play[key].seconds += (to - from) / 1000;
      from = to;
    }
  }
  app.playStart = activePlay() ? now : null;
}

/** Counts play time and saves: before a reload, opening the Parent Zone or saving the site. */
export function flush() {
  account();
  persist();
}

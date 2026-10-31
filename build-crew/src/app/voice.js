// Spoken lines, using the shared natural-voice pipeline (Google voices through /api/tts, made ahead as clips). The rule
// of that pipeline is that a clip plays only for the exact text it was made from, so this file works to have a clip
// for every line before it is spoken, and never lets the device ("robot") voice stand in for a line the natural
// voice should have said:
//  - Every line the game can say is a static string in content.mjs (SPOKEN / VOICE_LINES). At builder select they are
//    prepared in small batches in the order a child needs them (this job first), one batch at a time, and the batches
//    step aside whenever a line is waiting for its own clip, so a line never queues behind a long background request.
//  - say() waits for the clip as long as it reasonably can (WAIT_MS). A line whose clip could not be fetched is
//    skipped (the words are on screen); it is never handed to the device voice. The device voice speaks only when the
//    natural voice is not in use at all: no family code, a parent chose a device voice, or the service has no key.
//  - A line is played straight from its clip (cloud.play), not through tts.say(), because tts.say() hands a clip that
//    is slow to load (4 s) to the device voice. A slow clip is retried instead.
//  - Nothing is spoken before a builder is chosen. A new builder in a family with a code but no chosen voice gets the
//    default natural voice first; say() waits for that choice before deciding which voice to use.
import * as Profiles from '../../../spell-jump/src/spelling/profiles.js';
import { tts } from '../../../spell-jump/src/spelling/tts.js';
import { createCloudVoice } from '../../../spell-jump/src/spelling/cloudVoice.js';
import { DEFAULT_CLOUD_VOICE } from '../../../spell-jump/src/tts/voices.js';
import { Audio } from '../../../spell-jump/src/audio.js';
import { $ } from '../../../spell-jump/src/ui/dom.js';
import { ROUNDS, SPOKEN, VOICE_LINES, TRAY_TIP, SPOKEN_TOASTS, speakable } from '../content.mjs';
import { Music } from '../meta/music.js';
import { app, sleep } from './state.js';

/** How long a line waits for its clip (preparing it on the server, then loading it) before it is skipped. */
export const WAIT_MS = 9000;
/** Clips asked for per background request: small enough that a waiting line never queues behind a long one. */
const BATCH = 8;
const KNOWN = new Set(VOICE_LINES);

let speechEpoch = 0; // bumped by every interrupting say() and by hush(): speech still waiting for its turn is dropped
let tail = Promise.resolve(); // the speech in turn: queued lines (hints, toasts) start after the one before them
let waiting = 0; // lines waiting for their clip; background preparation pauses while this is above zero
let pump = 0; // identifies the running background preparation, so a newer one replaces it
let defaultTask = null;
let defaultAskedAt = 0;
const recent = { text: '', at: 0 };

/** Creates the cloud voice on the family's sync code and routes speech through it; speaking ducks the music. */
export function createVoice() {
  const cloud = createCloudVoice({ getCode: () => app.sync.code, getWords: () => [], audio: Audio });
  app.cloud = cloud;
  tts.setCloud(cloud);
  tts.setOnSpeaking(duck);
  cloud.onChange(() => app.pz?.onCloudStatus());
  watchScreen();
  return cloud;
}

const duck = (on) => {
  Audio.voice(on);
  Music.duck(on);
};
// Clips follow each other and a newer one cuts the older: the music comes back up only when none is playing.
let playing = 0;
function duckBy(d) {
  const was = playing;
  playing = Math.max(0, playing + d);
  if (!was && playing) duck(true);
  if (was && !playing) duck(false);
}

/** Applies the current builder's voice options. When the builder, their cloud voice or the family code changed,
 *  prepares the known lines again; a family with a code but no chosen voice gets the default natural voice. */
export function applyVoice() {
  const { cloud, sync, playerId } = app;
  if (!playerId) return;
  const o = Profiles.playerOptions(app.family, playerId);
  tts.setRate(o.rate);
  tts.setVoice(o.voiceName ? { name: o.voiceName, lang: o.voiceLang } : null);
  cloud.setVoice(o.cloudVoice || '');
  const key = `${playerId}|${cloud.voice}|${sync.code || ''}`;
  if (key !== app.voiceKey) {
    app.voiceKey = key;
    prepareVoice();
  }
  if (o.cloudVoice === undefined && sync.code) cloudDefault(playerId);
}

/** Picks the default natural voice (the same one Spell Jump and Wagon West default to) for builder `id` once the voice
 *  service reports it is available. Resolves when decided; asks the service at most once a minute per attempt. */
export function cloudDefault(id) {
  if (defaultTask) return defaultTask;
  if (!id || !app.sync.code || Profiles.playerOptions(app.family, id).cloudVoice !== undefined) return Promise.resolve();
  if (Date.now() - defaultAskedAt < 60000) return Promise.resolve();
  defaultAskedAt = Date.now();
  defaultTask = (async () => {
    try {
      const key = await app.cloud.status();
      const o = Profiles.playerOptions(app.family, id);
      if (key && app.sync.code && Profiles.playerById(app.family, id) && o.cloudVoice === undefined) {
        Profiles.setPlayerOption(app.family, id, 'cloudVoice', DEFAULT_CLOUD_VOICE);
        Profiles.writeFamily(app.family);
        if (id === app.playerId) {
          app.voiceKey = '';
          applyVoice();
        }
        app.pz?.onCloudStatus();
      }
    } catch {
      // the service is unreachable: the device voice stays until the next try
    } finally {
      defaultTask = null;
    }
  })();
  return defaultTask;
}

/** The lines this builder needs first: this job's, the machine they are driving, then the fixed lines, then the rest. */
function priorityLines() {
  const next = ROUNDS.find((r) => !app.save?.done.includes(r.id)) || ROUNDS[0];
  const current = app.yard?.round?.id ? app.yard.round : next;
  return [...new Set([...SPOKEN.job(current), ...SPOKEN.job(next), ...SPOKEN.fixed, ...VOICE_LINES])];
}

/** Prepares every known line in the background, a small batch at a time, pausing while a line is waiting for its own
 *  clip. A newer call replaces the one running. */
export function prepareVoice() {
  const cloud = app.cloud;
  if (!app.playerId || !cloud.active) return Promise.resolve();
  const mine = ++pump;
  const todo = priorityLines().filter((t) => !cloud.has(t));
  return (async () => {
    for (let i = 0; i < todo.length && mine === pump; i += BATCH) {
      while (waiting > 0 && mine === pump) await sleep(120);
      if (mine !== pump) return;
      const res = await cloud.prepare(todo.slice(i, i + BATCH)).catch(() => null);
      if (!res || (!res.ok && res.error !== 'no-voice')) await sleep(1500); // offline, limit: do not hammer the service
      if (res && ['no-key', 'forbidden', 'daily-limit'].includes(res.error)) return;
    }
  })();
}

/** Whether the natural voice is the voice for this builder right now: chosen, in a family, and the service can make
 *  clips (it has a key and accepts the family). When false the device voice is the right and only voice. */
function naturalVoice() {
  const cloud = app.cloud;
  return cloud.active && cloud.server.key !== false && cloud.server.error !== 'forbidden';
}

/** Resolves once the natural clips for `texts` are ready, or after `ms`; true when every clip is ready. Resolves true
 *  at once without a natural voice. Lines already waiting never queue behind background preparation. */
export async function voiceFor(texts, ms = WAIT_MS, stale = () => false) {
  const cloud = app.cloud;
  if (!naturalVoice()) return true;
  const list = [...new Set([].concat(texts))].filter(Boolean);
  const missing = () => list.filter((t) => !cloud.has(t));
  if (!missing().length) return true;
  waiting++;
  try {
    const end = Date.now() + ms;
    // the service may need a moment (a first request, a slow phone network): ask again, quietly, until the deadline
    while (missing().length && Date.now() < end && !stale()) {
      const res = await Promise.race([cloud.prepare(missing()).catch(() => null), sleep(Math.max(0, end - Date.now())).then(() => 'late')]);
      if (res === 'late' || (res && ['no-key', 'forbidden', 'daily-limit'].includes(res.error))) break;
      if (missing().length) await sleep(700);
    }
    return !missing().length;
  } finally {
    waiting--;
  }
}

/** Plays the clip for `text`, trying again when it is slow to load. true: it played to the end. */
async function playClip(text, mine) {
  const cloud = app.cloud;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (mine !== speechEpoch || document.hidden) return false;
    duckBy(1);
    let res;
    try {
      res = await cloud.play(text);
    } finally {
      duckBy(-1);
    }
    if (res === 'ok') return true;
    if (res === 'cancel') return false;
  }
  return false;
}

/** The voice for one line: the natural clip, the device voice only when the natural voice is not in use, else nothing.
 *  `extra` lines (first-use hints, toasts, the tray tip) are only ever read in the natural voice: the device voice keeps
 *  to the job, the reward and the save. */
async function speakOne(text, mine, extra = false) {
  if (!text || !app.playerId || mine !== speechEpoch || document.hidden) return null;
  // a builder in a family with a code but no chosen voice: wait for the default to be picked before choosing a voice
  if (defaultTask) await Promise.race([defaultTask, sleep(4000)]);
  if (mine !== speechEpoch) return null;
  if (naturalVoice()) {
    const ready = await voiceFor([text], WAIT_MS, () => mine !== speechEpoch);
    if (mine !== speechEpoch || document.hidden) return null;
    if (naturalVoice()) {
      // the clip could not be made in time (or the service is unreachable): stay silent, the words are on screen
      if (!ready) return null;
      app.lastEngine = 'cloud';
      return (await playClip(text, mine)) ? true : null;
    }
  }
  if (extra) return null;
  app.lastEngine = 'device';
  return tts.say(text);
}

/** Says `text`. By default it cuts off whatever is being said; { queue: true } waits for the speech before it instead
 *  (hints and toasts), and is dropped if a line that cuts in or hush() comes first, or when it waited longer than
 *  maxAgeMs and the moment has passed. Resolves true when it was spoken. */
export function say(text, { queue = false, extra = false, maxAgeMs = 0 } = {}) {
  const line = speakable(text);
  const born = Date.now();
  if (queue && line === recent.text && Date.now() - recent.at < 5000) return Promise.resolve(null);
  if (!queue) {
    speechEpoch++;
    tts.cancel();
  }
  recent.text = line;
  recent.at = Date.now();
  const mine = speechEpoch;
  const turn = queue
    ? tail.then(() => (maxAgeMs && Date.now() - born > maxAgeMs ? null : speakOne(line, mine, extra)))
    : speakOne(line, mine, extra);
  tail = turn.catch(() => null);
  return turn.catch(() => null);
}

/** Stops speech now and cancels any line still waiting for its clip or its turn. */
export function hush() {
  speechEpoch++;
  tts.cancel();
}

// ---- first-use lines: hints, toasts and the tray tip -----------------------------------------------------------------
// The HUD (hud.js, tray.js) shows hints, toasts and the tray without knowing about the voice. This watches those three
// places and reads, once per builder per device, each hint the first time it appears, the toasts worth hearing, and
// the tray tip the first time the tray opens. Only lines that were prepared (KNOWN) are ever spoken.
/** Toasts the device voice may also read (it keeps its short footprint: the job, the reward and the save). tray.js shows
 *  the toast only; the voice reads it from here, so it is never said twice. */
const DEVICE_TOASTS = ['Site saved.'];
const heardKey = () => `buildCrew.${app.playerId}.heard`;
function heard(line) {
  try {
    return JSON.parse(localStorage.getItem(heardKey()) || '[]').includes(line);
  } catch {
    return false;
  }
}
function markHeard(line) {
  try {
    const list = JSON.parse(localStorage.getItem(heardKey()) || '[]');
    if (!list.includes(line)) localStorage.setItem(heardKey(), JSON.stringify([...list, line].slice(-80)));
  } catch {}
}

/** Reads `line` after the current speech; with `once`, only the first time this builder meets it. */
const queued = new Set();
function sayFirst(raw, once = true, extra = true) {
  const line = speakable(raw);
  if (!app.playerId || !KNOWN.has(line) || queued.has(line) || (once && heard(line))) return;
  queued.add(line);
  say(line, { queue: true, extra, maxAgeMs: 10000 })
    .then((spoken) => spoken && once && markHeard(line))
    .finally(() => queued.delete(line));
}

function watchScreen() {
  const watch = (el, opts, fn) => el && new MutationObserver(fn).observe(el, opts);
  watch($('#hint'), { childList: true, characterData: true, subtree: true }, () => {
    // on a touch screen the strip falls back to the job's goal after a few seconds (class 'goal'): the goal was read when
    // the job started, so that change is not a hint
    if ($('#hint').classList.contains('goal')) return;
    const text = $('#hint').textContent.trim();
    if (text && !app.jobDone) sayFirst(text);
  });
  watch($('#toasts'), { childList: true }, (records) => {
    for (const r of records)
      for (const n of r.addedNodes) {
        const text = n.textContent?.trim();
        if (text && SPOKEN_TOASTS.includes(text)) sayFirst(text, false, !DEVICE_TOASTS.includes(text));
      }
  });
  watch($('#tray'), { attributes: true, attributeFilter: ['hidden'] }, () => {
    if (!$('#tray').hidden) sayFirst(TRAY_TIP);
  });
}

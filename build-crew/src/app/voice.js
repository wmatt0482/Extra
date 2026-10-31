// Spoken instructions, using the shared natural-voice pipeline the same way Wagon West does (SPEC §5). When a builder
// is picked (or their voice options or the family code change) every known phrase is prepared as a natural clip in
// the background; before saying anything new, say() awaits voiceFor() for at most 2.5 s so speech starts with the
// natural voice when it can and falls back to the device voice when it cannot. A newer say() cancels an older one.
import * as Profiles from '../../../spell-jump/src/spelling/profiles.js';
import { tts } from '../../../spell-jump/src/spelling/tts.js';
import { createCloudVoice } from '../../../spell-jump/src/spelling/cloudVoice.js';
import { DEFAULT_CLOUD_VOICE } from '../../../spell-jump/src/tts/voices.js';
import { Audio } from '../../../spell-jump/src/audio.js';
import { VOICE_LINES } from '../content.mjs';
import { Music } from '../meta/music.js';
import { app, sleep } from './state.js';

let defaultPending = false;
let speechEpoch = 0;

/** Creates the cloud voice on the family's sync code and routes speech through it; speaking ducks the music. */
export function createVoice() {
  const cloud = createCloudVoice({ getCode: () => app.sync.code, getWords: () => [], audio: Audio });
  app.cloud = cloud;
  tts.setCloud(cloud);
  tts.setOnSpeaking((on) => {
    Audio.voice(on);
    Music.duck(on);
  });
  cloud.onChange(() => app.pz?.onCloudStatus());
  return cloud;
}

/** Applies the current builder's voice options. When the builder, their cloud voice or the family code changed,
 *  prepares the known phrases again; a family with a code but no chosen voice gets the default natural voice. */
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

/** Picks the default natural voice for builder `id` once the voice service reports it is available. */
export async function cloudDefault(id) {
  if (defaultPending) return;
  defaultPending = true;
  try {
    const cloud = app.cloud;
    await cloud.status();
    const o = Profiles.playerOptions(app.family, id);
    if (cloud.server.key && app.sync.code && o.cloudVoice === undefined) {
      Profiles.setPlayerOption(app.family, id, 'cloudVoice', DEFAULT_CLOUD_VOICE);
      Profiles.writeFamily(app.family);
      if (id === app.playerId) {
        app.voiceKey = '';
        applyVoice();
      }
    }
  } finally {
    defaultPending = false;
  }
}

/** Prepares every known phrase (and the voice list) in the background. */
export function prepareVoice() {
  const cloud = app.cloud;
  if (!app.playerId || !cloud.active) return;
  cloud.prepareList().catch(() => {});
  cloud.prepare(VOICE_LINES).catch(() => {});
}

/** Resolves once the natural clips for `texts` are ready, or after 2.5 s, or at once without a natural voice. */
export function voiceFor(texts) {
  const cloud = app.cloud;
  if (!cloud.active) return Promise.resolve();
  const needed = [...new Set(texts)].filter((t) => !cloud.has(t));
  return needed.length ? Promise.race([cloud.prepare(needed).catch(() => null), sleep(2500)]) : Promise.resolve();
}

/** Says `text` after its clip is ready, unless something newer was said meanwhile or the tab is hidden. */
export async function say(text) {
  const epoch = ++speechEpoch;
  tts.cancel();
  await voiceFor([text]);
  if (epoch !== speechEpoch || document.hidden) return;
  return tts.say(text);
}

/** Stops speech now and cancels any say() still waiting for its clip. */
export function hush() {
  speechEpoch++;
  tts.cancel();
}

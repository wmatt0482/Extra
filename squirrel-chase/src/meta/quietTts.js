// Squirrel Chase's tts for Spell Jump's shared spell panel (SPEC §1, §2): the natural cloud voice or silence, NEVER the device ("robot") voice.
// The panel talks to a tts object (word, sentence, word; letters as typed). This one is its own instance of Spell Jump's createTTS with the
// device speech engine replaced by an engine that cannot speak: it answers every utterance with an immediate error. So:
//   - when the player's natural voice has the clips (cloud.active and every clip made), tts.js plays them through the cloud engine and never
//     touches the engine below;
//   - when a clip is missing, or there is no natural voice, the "speech" fails at once and the panel does what it always does when speech
//     fails: it shows the word for 3 s ("Look, then spell it") and covers it. Nothing is ever spoken by the device.
import { createTTS } from '../../../spell-jump/src/spelling/tts.js';

const VOICE = { name: 'Squirrel Chase (silent)', lang: 'en-US', localService: true, default: true };
/** The speech engine that never speaks: every utterance fails at once ('synthesis-failed'), so the panel falls back to showing the word. */
export const SILENT_ENGINE = {
  speaking: false, pending: false,
  getVoices: () => [VOICE],
  speak(u) { setTimeout(() => { try { if (u && u.onerror) u.onerror({ error: 'synthesis-failed' }); } catch (_) { /* ignore */ } }, 0); },
  cancel() {}, resume() {}, pause() {}, addEventListener() {}, removeEventListener() {},
};

export function createQuietTts() {
  const t = createTTS();
  t.useBackend(SILENT_ENGINE);
  return t;
}

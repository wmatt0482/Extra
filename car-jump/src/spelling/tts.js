// Text-to-speech for Spell Jump (R6: letters are spoken by name, speech is synthesized on device).
// A thin wrapper over the Web Speech API's speechSynthesis with the iOS quirks handled:
//  - voices arrive late (voiceschanged) → the voice is re-picked whenever the list changes
//  - the first speak must happen inside a user gesture → unlock() speaks a silent utterance from a tap
//  - long utterances can be cut off → text is split into short chunks spoken one after another
//  - a new utterance right after cancel() can be dropped → cancel() first, then a short delay before speaking
//  - onend sometimes never fires → every utterance also resolves on an estimated-duration timer
//  - speech can exist and still be silent (no voices installed, an iframe without audio permission, iOS before
//    the first tap, a paused iOS synth): voicesReady() waits up to 1.5 s for voices, and an utterance that has not
//    fired onstart 1.5 s after speak() counts as a failure. say() resolves true only when speech really started,
//    so the spell panel / test screen can fall back to "Look, then spell it" (never a silent panel with no word).
//  - iOS can leave the synth `paused` after an interruption → resume() before speaking and on every tap (unlock)
// Test hook: if `window.__ttsBackend` is set before boot (an object with speak/cancel/getVoices, like
// speechSynthesis), it is used instead of the real one; `tts.useBackend(b)` swaps it at runtime.
import { letterName } from './words.js';

const RATES = { slow: 0.68, normal: 0.9 };
const LETTER_RATE = { slow: 0.75, normal: 0.95 };
const PREFERRED = /(Samantha|Ava|Allison|Susan|Nicky|Natural|Enhanced|Premium|Google US English|Aria|Jenny|Zira)/i;
const CHUNK = 140;
export const START_TIMEOUT_MS = 1500;   // no onstart within this → speech is treated as unavailable for this attempt
export const VOICES_TIMEOUT_MS = 1500;  // getVoices() still empty this long after asking → no voices

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function splitChunks(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= CHUNK) return t ? [t] : [];
  const parts = t.match(/[^.!?;,]+[.!?;,]*\s*/g) || [t];
  const out = [];
  let cur = '';
  for (const p of parts) {
    if ((cur + p).length > CHUNK && cur) { out.push(cur.trim()); cur = ''; }
    if (p.length > CHUNK) { for (let i = 0; i < p.length; i += CHUNK) out.push(p.slice(i, i + CHUNK).trim()); continue; }
    cur += p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function createTTS() {
  const g = typeof window !== 'undefined' ? window : globalThis;
  let synth = g.__ttsBackend || g.speechSynthesis || null;
  const Utter = g.SpeechSynthesisUtterance || function FakeUtterance(text) { this.text = text; };
  let voice = null, voiceCount = 0, rate = 'normal', unlocked = false, gen = 0, busy = 0, idleTimer = 0;
  let onSpeaking = () => {};
  // health: 'unknown' until something was tried; 'ok' after an utterance really started; 'no-voices' / 'no-start' /
  // 'error' after a failed attempt (the next attempt tries again, and one success clears it)
  let health = 'unknown', lastOkAt = 0, failures = 0;
  const voiceWaiters = new Set();

  function pickVoice() {
    if (!synth || typeof synth.getVoices !== 'function') return;
    let voices = [];
    try { voices = synth.getVoices() || []; } catch (_) { voices = []; }
    const us = voices.filter((v) => /^en[-_]US$/i.test(v.lang || ''));
    const en = voices.filter((v) => /^en/i.test(v.lang || ''));
    const pool = us.length ? us : en;
    voiceCount = voices.length;
    voice = pool.find((v) => PREFERRED.test(v.name) && v.localService !== false) || pool.find((v) => PREFERRED.test(v.name)) || pool.find((v) => v.default) || pool[0] || null;
    if (voiceCount) for (const w of [...voiceWaiters]) w();
  }
  // resolves true once getVoices() lists at least one voice (voiceschanged or polling), false after `ms`
  function voicesReady(ms = VOICES_TIMEOUT_MS) {
    if (!synth) return Promise.resolve(false);
    pickVoice();
    if (voiceCount) return Promise.resolve(true);
    return new Promise((resolve) => {
      let poll = 0, t = 0;
      const done = (ok) => { clearInterval(poll); clearTimeout(t); voiceWaiters.delete(onVoices); resolve(ok); };
      const onVoices = () => done(true);
      voiceWaiters.add(onVoices);
      poll = setInterval(pickVoice, 250);   // some browsers never fire voiceschanged
      t = setTimeout(() => { pickVoice(); if (!voiceCount) { health = 'no-voices'; failures++; } done(voiceCount > 0); }, ms);
    });
  }
  function resumeIfPaused() {
    try { if (synth && synth.paused && typeof synth.resume === 'function') synth.resume(); } catch (_) { /* ignore */ }
  }
  function watchVoices() {
    if (!synth) return;
    pickVoice();
    try {
      if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', pickVoice);
      else synth.onvoiceschanged = pickVoice;
    } catch (_) { /* ignore */ }
  }
  watchVoices();

  function setBusy(delta) {
    busy = Math.max(0, busy + delta);
    clearTimeout(idleTimer);
    if (busy > 0) onSpeaking(true);
    else idleTimer = setTimeout(() => { if (!busy) onSpeaking(false); }, 180);
  }

  // speak one chunk; resolves 'ok' when it started (onstart) and then ended / timed out, 'fail' when it never
  // started within START_TIMEOUT_MS or errored before starting, 'cancel' when newer speech replaced it
  // (iOS sometimes drops onend: estimated-duration timer)
  function speakChunk(text, r, myGen) {
    return new Promise((resolve) => {
      if (myGen !== gen || !synth) { resolve(synth ? 'cancel' : 'fail'); return; }
      let done = false, started = false, tEnd = 0;
      const finish = (ok) => { if (done) return; done = true; clearTimeout(tStart); clearTimeout(tEnd); setBusy(-1); resolve(ok ? 'ok' : myGen !== gen ? 'cancel' : 'fail'); };
      const fail = (why) => {
        if (done) return;
        if (myGen === gen) { health = why; failures++; }    // a cancel (newer speech) is not a failure
        try { if (myGen === gen) synth.cancel(); } catch (_) { /* ignore */ }
        finish(false);
      };
      let u;
      try {
        u = new Utter(text);
        u.lang = 'en-US';
        try { if (voice) u.voice = voice; } catch (_) { /* a voice from another backend: keep the default */ }
        u.rate = r; u.pitch = 1.05; u.volume = 1;
        u.onstart = () => {
          if (started || done) return;
          started = true; health = 'ok'; lastOkAt = Date.now();
          clearTimeout(tStart);
          tEnd = setTimeout(() => finish(true), 700 + (text.length * 95) / r);
        };
        // a backend that ends without ever firing onstart did speak (or at least did not hang)
        u.onend = () => { if (!started && myGen === gen) u.onstart(); finish(started); };
        u.onerror = (e) => {
          const err = e && e.error;
          if (started || err === 'interrupted' || err === 'canceled') finish(started);
          else fail('error');
        };
      } catch (_) { resolve('fail'); return; }
      setBusy(1);
      const tStart = setTimeout(() => (started ? null : fail('no-start')), START_TIMEOUT_MS);
      resumeIfPaused();
      try { synth.speak(u); } catch (_) { fail('error'); }
      resumeIfPaused();
    });
  }

  async function speak(text, r) {
    const chunks = splitChunks(text);
    if (!synth) return false;
    if (!chunks.length) return true;
    const myGen = ++gen;
    let wasSpeaking = false;
    try { wasSpeaking = !!(synth.speaking || synth.pending); synth.cancel(); } catch (_) { /* ignore */ }
    if (wasSpeaking) await sleep(60);
    for (const c of chunks) {
      if (myGen !== gen) return null;
      const res = await speakChunk(c, r, myGen);
      if (res === 'fail') return false;
      if (res === 'cancel') return null;
    }
    return true;
  }

  const available = () => !!synth && (typeof g.SpeechSynthesisUtterance === 'function' || !!g.__ttsBackend || synth !== g.speechSynthesis);
  const api = {
    get available() { return available(); },
    // best current guess that speech works: the API exists and the last attempt did not fail
    get working() { return available() && (health === 'ok' || health === 'unknown') && (voiceCount > 0 || health === 'ok'); },
    get health() { return available() ? health : 'missing'; },
    get voiceCount() { return voiceCount; },
    get failures() { return failures; },
    get lastOkAt() { return lastOkAt; },
    // one-time "Speech isn't available on this device…" hint, shared by the spell panel and the test screen
    hintShown: false,
    get unlocked() { return unlocked; },
    get voiceName() { return voice ? voice.name : ''; },
    /** Before an attempt that needs speech: true when the API exists and voices are listed (waits ≤ 1.5 s). */
    async ready() {
      if (!available()) return false;
      resumeIfPaused();
      return voicesReady();
    },
    voicesReady,
    get rate() { return rate; },
    setRate(r) { rate = RATES[r] ? r : 'normal'; },
    // duck music / hold sound effects while the voice talks: fn(true) when speech starts, fn(false) when idle
    setOnSpeaking(fn) { onSpeaking = typeof fn === 'function' ? fn : () => {}; },
    // call from inside a tap: iOS only lets speech start from a user gesture the first time
    // (also called on every later tap: an iOS synth left `paused` by an interruption is resumed)
    unlock() {
      if (!synth) return;
      resumeIfPaused();
      if (unlocked) return;
      unlocked = true;
      pickVoice();
      try { const u = new Utter(' '); u.volume = 0; u.lang = 'en-US'; synth.speak(u); } catch (_) { /* ignore */ }
    },
    /** Resolves true when the speech really started (onstart), false when it is unavailable or never started
     *  (no onstart within 1.5 s / an error), null when newer speech or cancel() cut it off first. */
    say(text) { return speak(text, RATES[rate]); },
    sayLetter(ch) { return speak(letterName(ch), LETTER_RATE[rate]); },
    // Spell a word letter by letter (SOS). onLetter(i, ch) fires as each letter starts, so tiles can light in sync.
    async spell(word, onLetter, { gap = 260 } = {}) {
      const chars = Array.from(String(word || ''));
      const myGen = ++gen;
      try { synth && synth.cancel(); } catch (_) { /* ignore */ }
      for (let i = 0; i < chars.length; i++) {
        if (myGen !== gen) return false;
        try { if (onLetter) onLetter(i, chars[i]); } catch (_) { /* ignore */ }
        // after a failed start, light the tiles on a timer instead of waiting 1.5 s per silent letter
        if (synth && health !== 'no-start' && health !== 'error' && health !== 'no-voices') await speakChunk(letterName(chars[i]), LETTER_RATE[rate], myGen);
        else await sleep(420);
        if (myGen !== gen) return false;
        await sleep(gap);
      }
      return true;
    },
    cancel() {
      gen++;
      try { synth && synth.cancel(); } catch (_) { /* ignore */ }
    },
    useBackend(b) { synth = b || g.speechSynthesis || null; voice = null; voiceCount = 0; health = 'unknown'; watchVoices(); },
  };
  return api;
}

export const tts = createTTS();
export default tts;

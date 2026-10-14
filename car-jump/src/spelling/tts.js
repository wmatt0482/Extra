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
// Clarity (v3.1): browser voices clip a short word spoken on its own, so a word is presented the way a teacher
// gives a spelling test: "The word is, neighbor." → the sentence → "neighbor." (buildPresentation), as separate
// utterances with a short pause between them. Commas / periods make the pauses (no SSML in browsers). A parent can
// give a pronunciation override ("say as") that replaces the word wherever it is spoken. The voice is the best
// English voice on the device (rankVoices: Premium / Enhanced > Microsoft Natural > Google US > en-US > en-*,
// novelty voices last) unless the Parent Zone picked one (setVoice; absent on this device → the ranked default).
// Test hook: if `window.__ttsBackend` is set before boot (an object with speak/cancel/getVoices, like
// speechSynthesis), it is used instead of the real one; `tts.useBackend(b)` swaps it at runtime.
import { letterName } from './words.js';

export const RATES = { veryslow: 0.5, slow: 0.6, normal: 0.85 };
const LETTER_RATE = { veryslow: 0.7, slow: 0.75, normal: 0.95 };
export const PITCH = 1.0;
export const PHRASE_GAP_MS = 280;        // silence between the carrier, the sentence and the repeated word
const CHUNK = 140;
export const START_TIMEOUT_MS = 1500;   // no onstart within this → speech is treated as unavailable for this attempt
export const VOICES_TIMEOUT_MS = 1500;  // getVoices() still empty this long after asking → no voices
export const VOICE_TIP = 'On iPhone or iPad, clearer voices can be downloaded in Settings → Accessibility → Spoken Content → Voices → English (choose an Enhanced or Premium voice), then pick it here.';
export const SAMPLE_PRESENTATION = { word: 'neighbor', sentence: 'My neighbor has a dog.' };

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

// ---------- phrases (pure: unit-tested in tools/spelling-tests.mjs) ----------
const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
/** What the voice says for the word: the parent's "say as" text when given, else the word itself. */
export const spokenForm = ({ word, sayAs } = {}) => clean(sayAs) || clean(word);
const withStop = (s) => (/[.!?]$/.test(s) ? s : s + '.');

/** The utterances that present a word, in order: carrier, sentence (if any), the word again. */
export function buildPresentation({ word, sentence, sayAs } = {}) {
  const w = spokenForm({ word, sayAs });
  if (!w) return [];
  const out = [`The word is, ${w}.`];
  const s = clean(sentence);
  if (s) out.push(withStop(s));
  out.push(`${w}.`);
  return out;
}
/** "Say it again": the word twice in a short carrier (spoken at the slow rate). */
export function buildRepeat({ word, sayAs } = {}) {
  const w = spokenForm({ word, sayAs });
  return w ? `${w}. ${w}.` : '';
}
/** "Syllables": the parent's syllables with a pause after each ("neigh, bor."). */
export function buildSyllables(syllables) {
  const parts = (Array.isArray(syllables) ? syllables : []).map(clean).filter(Boolean);
  return parts.length ? parts.join(', ') + '.' : '';
}

// ---------- voices ----------
const NOVELTY = /\b(Fred|Zarvox|Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Organ|Trinoids|Whisper|Wobble|Junior|Ralph|Kathy|Flo|Grandma|Grandpa|Rocko|Sandy|Shelley|Eddy|Reed)\b|compact|e-?speak/i;
const APPLE_QUALITY = /\b(Premium|Enhanced)\b/i;
const APPLE_NAMES = /^(Ava|Zoe|Evan|Allison|Samantha|Tom)\b/i;
const MS_NATURAL = /\bNatural\b|^Microsoft (Aria|Jenny|Guy|Ana|Michelle|Emma|Brian|Andrew|Christopher|Eric|Roger|Steffan|Libby|Sonia|Ryan|Natasha|William)\b/i;
const GOOGLE_US = /^Google US English/i;
const isEnglish = (v) => !!v && /^en([-_]|$)/i.test(String(v.lang || ''));
const isUS = (v) => /^en[-_]US$/i.test(String(v.lang || ''));

/** Likely quality of one voice: { score, label }. Higher is clearer; novelty voices score 0. */
export function voiceQuality(v) {
  const name = String((v && v.name) || '');
  const uri = String((v && v.voiceURI) || '');
  const us = isUS(v || {});
  if (NOVELTY.test(name) || /compact|espeak/i.test(uri)) return { score: 0, label: 'Novelty' };
  if (/\bPremium\b/i.test(name) || /\.premium\./i.test(uri)) return { score: 56 + (us ? 3 : 0), label: 'Premium' };
  if (APPLE_QUALITY.test(name) || /\.enhanced\./i.test(uri)) return { score: 53 + (us ? 3 : 0), label: 'Enhanced' };
  if (!/Microsoft|Google/i.test(name) && APPLE_NAMES.test(name)) return { score: 50 + (us ? 3 : 0), label: 'Clear' };
  if (MS_NATURAL.test(name)) return { score: 40 + (us ? 3 : 0), label: 'Natural' };
  if (GOOGLE_US.test(name)) return { score: 30, label: 'Google' };
  if (us) return { score: 20, label: '' };
  return { score: 10, label: '' };
}

/** English voices only, best first (Premium / Enhanced > Natural > Google US > other en-US > other en-*;
 *  novelty / compact / eSpeak voices last). Ties: en-US, then the system default, then the original order. */
export function rankVoices(list) {
  const en = (Array.isArray(list) ? list : []).map((v, i) => ({ v, i })).filter(({ v }) => isEnglish(v));
  const key = ({ v, i }) => ({ q: voiceQuality(v).score, us: isUS(v) ? 1 : 0, d: v.default ? 1 : 0, i });
  return en.map((x) => ({ ...x, k: key(x) }))
    .sort((a, b) => b.k.q - a.k.q || b.k.us - a.k.us || b.k.d - a.k.d || a.k.i - b.k.i)
    .map((x) => x.v);
}

export function createTTS() {
  const g = typeof window !== 'undefined' ? window : globalThis;
  let synth = g.__ttsBackend || g.speechSynthesis || null;
  const Utter = g.SpeechSynthesisUtterance || function FakeUtterance(text) { this.text = text; };
  let voice = null, voiceCount = 0, rate = 'normal', unlocked = false, gen = 0, busy = 0, idleTimer = 0, lastCancelAt = 0;
  let pref = null;                 // { name, lang } picked in the Parent Zone (null: the ranked default)
  let onSpeaking = () => {};
  // health: 'unknown' until something was tried; 'ok' after an utterance really started; 'no-voices' / 'no-start' /
  // 'error' after a failed attempt (the next attempt tries again, and one success clears it)
  let health = 'unknown', lastOkAt = 0, failures = 0;
  const voiceWaiters = new Set();

  function listVoices() {
    if (!synth || typeof synth.getVoices !== 'function') return [];
    try { return synth.getVoices() || []; } catch (_) { return []; }
  }
  // the voice for a preference: that exact voice when this device has it, else the best-ranked English voice
  function resolve(p, ranked) {
    if (p && p.name) {
      const same = ranked.filter((v) => v.name === p.name);
      const hit = same.find((v) => !p.lang || String(v.lang).toLowerCase() === String(p.lang).toLowerCase()) || same[0];
      if (hit) return hit;
    }
    return ranked[0] || null;
  }
  function pickVoice() {
    if (!synth || typeof synth.getVoices !== 'function') return;
    const voices = listVoices();
    voiceCount = voices.length;
    voice = resolve(pref, rankVoices(voices));
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
  // (iOS sometimes drops onend: estimated-duration timer). The watchdog is on onstart only, so a longer phrase
  // (the carrier, a sentence) is never cut short by it.
  function speakChunk(text, r, myGen, v = voice) {
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
        u.lang = (v && v.lang) || 'en-US';
        try { if (v) u.voice = v; } catch (_) { /* a voice from another backend: keep the default */ }
        u.rate = r; u.pitch = PITCH; u.volume = 1;
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

  /** Speak phrases one after another (each its own utterance, PHRASE_GAP_MS of silence between them). Always
   *  cancels whatever was speaking first. true: everything started and ended; false: speech never started;
   *  null: newer speech or cancel() cut it off. */
  async function speakSeq(phrases, r, { gap = PHRASE_GAP_MS, voice: v } = {}) {
    const groups = (phrases || []).map(splitChunks).filter((c) => c.length);
    if (!synth) return false;
    if (!groups.length) return true;
    const myGen = ++gen;
    let wasSpeaking = busy > 0 || Date.now() - lastCancelAt < 80;
    try { wasSpeaking = wasSpeaking || !!(synth.speaking || synth.pending); synth.cancel(); } catch (_) { /* ignore */ }
    if (wasSpeaking) await sleep(60);
    for (let gi = 0; gi < groups.length; gi++) {
      if (gi > 0) {
        setBusy(1);                       // keep the music ducked through the pause
        await sleep(gap);
        setBusy(-1);
      }
      for (const c of groups[gi]) {
        if (myGen !== gen) return null;
        const res = await speakChunk(c, r, myGen, v || voice);
        if (res === 'fail') return false;
        if (res === 'cancel') return null;
      }
    }
    return true;
  }
  const speak = (text, r) => speakSeq([text], r);
  const slowRate = () => Math.min(RATES.slow, RATES[rate]);

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
    get voice() { return voice; },
    get voicePref() { return pref ? { ...pref } : null; },
    /** English voices on this device, best first (see rankVoices). */
    voices() { return rankVoices(listVoices()); },
    /** The voice a preference would use here ({name, lang} or null → the ranked default). */
    resolveVoice(p) { return resolve(p, rankVoices(listVoices())); },
    /** Use this voice when the device has it (by name, lang preferred), else the ranked default. null: default. */
    setVoice(p) {
      pref = p && typeof p.name === 'string' && p.name ? { name: p.name, lang: typeof p.lang === 'string' ? p.lang : '' } : null;
      pickVoice();
    },
    /** Before an attempt that needs speech: true when the API exists and voices are listed (waits ≤ 1.5 s). */
    async ready() {
      if (!available()) return false;
      resumeIfPaused();
      return voicesReady();
    },
    voicesReady,
    get rate() { return rate; },
    get rateValue() { return RATES[rate]; },
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
    /** Present a word like a spelling test: "The word is, <word>." → sentence → "<word>." (same result values
     *  as say). info: { word, sentence, sayAs }; opts.voice: speak in this voice instead (Parent Zone ▶ Test). */
    present(info, { voice: v } = {}) { return speakSeq(buildPresentation(info), RATES[rate], { voice: v }); },
    /** "Say it again": "<word>. <word>." at the slow rate. */
    sayAgain(info) { return speakSeq([buildRepeat(info)], slowRate()); },
    /** "Syllables": "neigh, bor." at the slow rate. */
    saySyllables(syllables) { return speakSeq([buildSyllables(syllables)], slowRate()); },
    /** The word once on its own, with a full stop so the voice finishes it (praise after a perfect spell). */
    sayWord(info) { const w = spokenForm(info); return speak(w ? `${w}.` : '', RATES[rate]); },
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
      lastCancelAt = Date.now();
      try { synth && synth.cancel(); } catch (_) { /* ignore */ }
    },
    useBackend(b) { synth = b || g.speechSynthesis || null; voice = null; voiceCount = 0; health = 'unknown'; watchVoices(); },
  };
  return api;
}

export const tts = createTTS();
export default tts;

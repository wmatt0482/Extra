// Text-to-speech for Spell Jump (R6: letters are spoken by name, speech is synthesized on device).
// A thin wrapper over the Web Speech API's speechSynthesis with the browser quirks handled explicitly (v3.2.1):
//  - voices arrive late, and `voiceschanged` may fire several times or never → the voice is re-picked on every
//    change and getVoices() is also polled; an empty list for 1.5 s counts as "no voices" for that word only
//  - Safari (macOS / iOS) only lets speech start from a user gesture the first time → unlock() speaks a very short
//    real utterance ("ready" at volume 0.01) inside the tap (pointerdown of Hear it, the Test buttons, the spell
//    panel opening, and the first tap anywhere). An onerror 'not-allowed' means the gesture rule was not met: the
//    next tap unlocks again, and the spell panel shows "Tap Hear it to turn on the voice" once
//  - Chrome remote voices ("Google US English") can take 2-5 s before onstart on first use → the onstart
//    watchdog is 5 s for the first utterance of the session (and the first in a newly used voice), 3 s afterwards
//  - a watchdog that fires is NOT permanent: that one word falls back to "Look, then spell it" and the next word
//    tries speech again. Only GIVE_UP_AFTER (3) onstart failures in a row make the app assume speech is
//    unavailable for the session (ready() → false at once, automatic speech is skipped); a Hear it / Test / Speech
//    check tap re-probes (reprobe()), and any utterance that really starts clears it
//  - Chrome garbage-collects SpeechSynthesisUtterance objects nobody references, which silently cuts speech off
//    → every utterance in flight is kept in `activeUtterances` until its onend / onerror
//  - Chrome's synth can stay `speaking` after cancel() and `paused` after a tab switch → every new phrase
//    sequence cancels, resumes when paused, and cancels again if `speaking` is still true 300 ms later
//  - long utterances can be cut off → text is split into short chunks spoken one after another; onend sometimes
//    never fires → every chunk also resolves on an estimated-duration timer
// say() / present() resolve true only when speech really started, so the spell panel / test screen can fall back
// to "Look, then spell it" (never a silent panel with no word).
// Clarity (v3.1): browser voices clip a short word spoken on its own, so a word is presented the way a teacher
// gives a spelling test: "The word is, neighbor." → the sentence → "neighbor." (buildPresentation), as separate
// short utterances with a short pause between them (never joined). Commas / periods make the pauses (no SSML in
// browsers). A parent can give a pronunciation override ("say as") that replaces the word wherever it is spoken.
// The voice is the best English voice on the device (rankVoices: Premium / Enhanced > Microsoft Natural > Google US
// > en-US > en-*, novelty voices last; within the same quality, on-device voices before online ones because they
// start at once) unless the Parent Zone picked one (setVoice; absent on this device → the ranked default) or chose
// "Use default system voice" (SYSTEM_VOICE: no voice is set on the utterance, the browser picks).
// runCheck() is the Parent Zone "Speech check": it speaks "The word is, neighbor." inside the tap and logs every
// step with timestamps (API, voices, chosen voice, speak(), onstart / onend / onerror, watchdog).
// Test hook: if `window.__ttsBackend` is set before boot (an object with speak/cancel/getVoices, like
// speechSynthesis), it is used instead of the real one; `tts.useBackend(b)` swaps it at runtime.
import { letterName } from './words.js';

export const RATES = { veryslow: 0.5, slow: 0.6, normal: 0.85 };
const LETTER_RATE = { veryslow: 0.7, slow: 0.75, normal: 0.95 };
export const PITCH = 1.0;
export const PHRASE_GAP_MS = 280;        // silence between the carrier, the sentence and the repeated word
const CHUNK = 140;
export const FIRST_START_TIMEOUT_MS = 5000;  // onstart watchdog for the session's first utterance (and a new voice's)
export const START_TIMEOUT_MS = 3000;        // onstart watchdog afterwards: no onstart → this one attempt failed
export const GIVE_UP_AFTER = 3;              // onstart failures in a row before speech counts as off for the session
export const STUCK_MS = 300;                 // still `speaking` this long after cancel() → cancel() again
export const VOICES_TIMEOUT_MS = 1500;       // getVoices() still empty this long after asking → no voices (this word)
export const UNLOCK_TEXT = 'ready';          // the gesture unlock speaks a real (nearly silent) word, not a space
export const UNLOCK_VOLUME = 0.01;
export const SYSTEM_VOICE = ':system';       // stored voice choice "Use default system voice" (no voice set)
export const CHECK_PHRASE = 'The word is, neighbor.';
const MAX_ACTIVE = 32;                       // a backend that never ends utterances must not grow the list forever
/** Every utterance handed to speak() and not yet ended / errored (Chrome GC bug: unreferenced ones go silent). */
export const activeUtterances = [];
function holdUtterance(u) {
  activeUtterances.push(u);
  if (activeUtterances.length > MAX_ACTIVE) activeUtterances.splice(0, activeUtterances.length - MAX_ACTIVE);
}
function releaseUtterance(u) { const i = activeUtterances.indexOf(u); if (i >= 0) activeUtterances.splice(i, 1); }
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
 *  novelty / compact / eSpeak voices last). Within the same quality score, on-device voices (localService !== false)
 *  come before online ones (they start at once; online voices can take seconds on first use). Further ties: en-US,
 *  then the system default, then the original order. */
export function rankVoices(list) {
  const en = (Array.isArray(list) ? list : []).map((v, i) => ({ v, i })).filter(({ v }) => isEnglish(v));
  const key = ({ v, i }) => ({ q: voiceQuality(v).score, local: v.localService === false ? 0 : 1, us: isUS(v) ? 1 : 0, d: v.default ? 1 : 0, i });
  return en.map((x) => ({ ...x, k: key(x) }))
    .sort((a, b) => b.k.q - a.k.q || b.k.local - a.k.local || b.k.us - a.k.us || b.k.d - a.k.d || a.k.i - b.k.i)
    .map((x) => x.v);
}

/** opts (tests): { firstStartMs, startMs, giveUpAfter, stuckMs } override the watchdog / give-up constants. */
export function createTTS(opts = {}) {
  const g = typeof window !== 'undefined' ? window : globalThis;
  const FIRST_MS = opts.firstStartMs || FIRST_START_TIMEOUT_MS;
  const NEXT_MS = opts.startMs || START_TIMEOUT_MS;
  const GIVE_UP = opts.giveUpAfter || GIVE_UP_AFTER;
  const STUCK = opts.stuckMs || STUCK_MS;
  let synth = g.__ttsBackend || g.speechSynthesis || null;
  const Utter = g.SpeechSynthesisUtterance || function FakeUtterance(text) { this.text = text; };
  let voice = null, voiceCount = 0, rate = 'normal', unlocked = false, gen = 0, busy = 0, idleTimer = 0, lastCancelAt = 0;
  let pref = null;                 // { name, lang } picked in the Parent Zone, { system: true } for the system voice, null: ranked
  let onSpeaking = () => {};
  // health: 'unknown' until something was tried; 'ok' after an utterance really started; 'no-voices' / 'no-start' /
  // 'error' / 'not-allowed' after a failed attempt. A failure is per attempt: the next word tries again, and one
  // start clears it. `streak` counts onstart failures in a row; GIVE_UP of them → gaveUp (off for the session).
  let health = 'unknown', lastOkAt = 0, failures = 0, streak = 0, lastError = '', needsTap = false;
  let stuckCancels = 0, watchdogs = 0;
  const triedVoices = new Set();   // voices that already had one watched utterance (their first one gets FIRST_MS)
  const voiceWaiters = new Set();
  const history = [];              // the last few speech events, for the Speech check log
  const note = (msg) => { history.push({ at: Date.now(), msg }); if (history.length > 12) history.shift(); };
  const gaveUp = () => streak >= GIVE_UP;

  function markStart() {
    if (gaveUp()) note('speech started again');
    health = 'ok'; lastOkAt = Date.now(); streak = 0; needsTap = false; unlocked = true;
  }
  function markFail(why, detail = '') {
    health = why; failures++; streak++;
    if (why === 'not-allowed') { unlocked = false; needsTap = true; }
    note(`${why}${detail ? ' · ' + detail : ''}${gaveUp() ? ` (${streak} in a row: speech off for this session until a tap)` : ''}`);
  }
  const voiceKey = (v) => (v ? `${v.name}|${v.lang}` : ':default');
  // 5 s for the first watched utterance of the session and the first one in a newly used voice (a Chrome online
  // voice can take 2-5 s to start the first time), 3 s afterwards
  const startTimeout = (v) => (triedVoices.has(voiceKey(v)) ? NEXT_MS : FIRST_MS);

  function listVoices() {
    if (!synth || typeof synth.getVoices !== 'function') return [];
    try { return synth.getVoices() || []; } catch (_) { return []; }
  }
  // the voice for a preference: none for the system voice, that exact voice when this device has it, else the
  // best-ranked English voice
  function resolve(p, ranked) {
    if (p && p.system) return null;
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
      t = setTimeout(() => {
        pickVoice();
        if (!voiceCount && health !== 'ok') { health = 'no-voices'; failures++; note(`no voices listed after ${ms} ms`); }
        done(voiceCount > 0);
      }, ms);
    });
  }
  function resumeIfPaused() {
    try { if (synth && synth.paused && typeof synth.resume === 'function') synth.resume(); } catch (_) { /* ignore */ }
  }
  const isSpeaking = () => { try { return !!(synth && synth.speaking); } catch (_) { return false; } };
  // voiceschanged may fire many times: one listener per backend, removed when the backend is swapped
  let watched = null;
  function watchVoices() {
    if (watched && watched !== synth) {
      try { if (typeof watched.removeEventListener === 'function') watched.removeEventListener('voiceschanged', pickVoice); else if (watched.onvoiceschanged === pickVoice) watched.onvoiceschanged = null; } catch (_) { /* ignore */ }
      watched = null;
    }
    if (!synth) return;
    pickVoice();
    if (watched === synth) return;
    try {
      if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', pickVoice);
      else synth.onvoiceschanged = pickVoice;
      watched = synth;
    } catch (_) { /* ignore */ }
  }
  watchVoices();

  function setBusy(delta) {
    busy = Math.max(0, busy + delta);
    clearTimeout(idleTimer);
    if (busy > 0) onSpeaking(true);
    else idleTimer = setTimeout(() => { if (!busy) onSpeaking(false); }, 180);
  }

  function makeUtterance(text, r, v, volume = 1) {
    const u = new Utter(text);
    u.lang = (v && v.lang) || 'en-US';
    try { if (v) u.voice = v; } catch (_) { /* a voice from another backend: keep the default */ }
    u.rate = r; u.pitch = PITCH; u.volume = volume;
    return u;
  }

  // speak one chunk; resolves 'ok' when it started (onstart) and then ended / timed out, 'fail' when it never
  // started within the watchdog (5 s first, then 3 s) or errored before starting, 'cancel' when newer speech
  // replaced it (iOS sometimes drops onend: estimated-duration timer). The watchdog is on onstart only, so a longer
  // phrase (the carrier, a sentence) is never cut short by it.
  function speakChunk(text, r, myGen, v = voice) {
    return new Promise((resolve) => {
      if (myGen !== gen || !synth) { resolve(synth ? 'cancel' : 'fail'); return; }
      let done = false, started = false, tEnd = 0, tStart = 0;
      const startMs = startTimeout(v);
      triedVoices.add(voiceKey(v));
      const finish = (ok) => { if (done) return; done = true; clearTimeout(tStart); clearTimeout(tEnd); setBusy(-1); resolve(ok ? 'ok' : myGen !== gen ? 'cancel' : 'fail'); };
      const fail = (why, detail) => {
        if (done) return;
        if (myGen === gen) markFail(why, detail);    // a cancel (newer speech) is not a failure
        try { if (myGen === gen) synth.cancel(); } catch (_) { /* ignore */ }
        finish(false);
      };
      let u;
      try {
        u = makeUtterance(text, r, v);
        u.onstart = () => {
          if (started || done) return;
          started = true; markStart();
          clearTimeout(tStart);
          tEnd = setTimeout(() => finish(true), 700 + (text.length * 95) / r);
        };
        // a backend that ends without ever firing onstart did speak (or at least did not hang)
        u.onend = () => { releaseUtterance(u); if (!started && myGen === gen) u.onstart(); finish(started); };
        u.onerror = (e) => {
          releaseUtterance(u);
          const err = (e && e.error) || '';
          lastError = err || 'unknown';
          if (err === 'not-allowed' && !started) fail('not-allowed', `"${text}"`);
          else if (started || err === 'interrupted' || err === 'canceled') finish(started);
          else fail('error', `${lastError} · "${text}"`);
        };
      } catch (_) { resolve('fail'); return; }
      setBusy(1);
      tStart = setTimeout(() => {
        if (started || done) return;
        releaseUtterance(u);
        if (myGen !== gen) { finish(false); return; }   // newer speech replaced it: not a failure
        watchdogs++;
        fail('no-start', `no onstart after ${startMs} ms · "${text}"`);
      }, startMs);
      resumeIfPaused();
      holdUtterance(u);
      try { synth.speak(u); } catch (e) { releaseUtterance(u); fail('error', `speak() threw ${e && e.message}`); }
      resumeIfPaused();
    });
  }

  // before a new sequence: cancel what is playing, resume a paused synth, and when the synth still claims to be
  // speaking STUCK ms later, cancel again (Chrome can get stuck with speaking === true). false: newer speech won.
  async function settle(myGen) {
    let wasSpeaking = busy > 0 || Date.now() - lastCancelAt < 80;
    try { wasSpeaking = wasSpeaking || !!(synth.speaking || synth.pending); synth.cancel(); } catch (_) { /* ignore */ }
    resumeIfPaused();
    if (isSpeaking()) {
      const t0 = Date.now();
      while (isSpeaking() && Date.now() - t0 < STUCK) { await sleep(50); if (myGen !== gen) return false; }
      if (isSpeaking()) {
        stuckCancels++; note(`synth still speaking ${STUCK} ms after cancel(): cancelled again`);
        try { synth.cancel(); } catch (_) { /* ignore */ }
        resumeIfPaused();
        await sleep(60);
      }
    } else if (wasSpeaking) await sleep(60);
    return myGen === gen;
  }

  /** Speak phrases one after another (each its own utterance, PHRASE_GAP_MS of silence between them). Always
   *  cancels whatever was speaking first. true: everything started and ended; false: speech never started (or speech
   *  is off for this session after GIVE_UP failures in a row: nothing is tried); null: newer speech or cancel() cut
   *  it off. */
  async function speakSeq(phrases, r, { gap = PHRASE_GAP_MS, voice: v } = {}) {
    const groups = (phrases || []).map(splitChunks).filter((c) => c.length);
    if (!synth) return false;
    if (!groups.length) return true;
    if (gaveUp()) return false;
    const myGen = ++gen;
    if (!(await settle(myGen))) return null;
    const useVoice = v === SYSTEM_VOICE ? null : (v || voice);
    for (let gi = 0; gi < groups.length; gi++) {
      if (gi > 0) {
        setBusy(1);                       // keep the music ducked through the pause
        await sleep(gap);
        setBusy(-1);
      }
      for (const c of groups[gi]) {
        if (myGen !== gen) return null;
        const res = await speakChunk(c, r, myGen, useVoice);
        if (res === 'fail') return false;
        if (res === 'cancel') return null;
      }
    }
    return true;
  }
  const speak = (text, r) => speakSeq([text], r);
  const slowRate = () => Math.min(RATES.slow, RATES[rate]);
  const failedLast = () => gaveUp() || health === 'no-start' || health === 'error' || health === 'no-voices' || health === 'not-allowed';

  let lastCheck = null;
  /** Parent Zone "Speech check": speak CHECK_PHRASE right away (call it inside the tap: nothing is awaited before
   *  speak()) and log each step with a timestamp. onLine(line, lines) fires for every new line. Resolves
   *  { ok, lines, text }; the log is kept (lastCheck) until the next check. */
  function runCheck({ header = [], onLine = () => {}, phrase = CHECK_PHRASE, endWaitMs = 10000 } = {}) {
    const now = () => (g.performance && typeof g.performance.now === 'function' ? g.performance.now() : Date.now());
    const t0 = now();
    const lines = [];
    const stamp = new Date();
    const push = (line) => { lines.push(line); lastCheck.text = lines.join('\n'); try { onLine(line, lines); } catch (_) { /* ignore */ } };
    lastCheck = { at: stamp.getTime(), lines, text: '' };
    const log = (msg) => push(`[+${Math.round(now() - t0)} ms] ${msg}`);
    push(`Speech check · ${stamp.toLocaleString('en-US')}`);
    for (const h of header) push(String(h));
    const hasSynth = !!synth, hasUtter = typeof g.SpeechSynthesisUtterance === 'function' || !!g.__ttsBackend;
    log(`API present: ${available() ? 'yes' : 'no'} (speechSynthesis: ${hasSynth ? (g.__ttsBackend && synth === g.__ttsBackend ? 'test backend' : 'yes') : 'missing'}, SpeechSynthesisUtterance: ${hasUtter ? 'yes' : 'missing'})`);
    if (history.length) {
      log(`recent speech events (${history.length}):`);
      for (const h of history) push(`    ${new Date(h.at).toLocaleTimeString('en-US')} ${h.msg}`);
    }
    if (!available()) {
      log('result: this browser has no speech synthesis. Words are shown for 3 s instead.');
      return Promise.resolve({ ok: false, lines: lines.slice(), text: lines.join('\n') });
    }
    pickVoice();
    const all = listVoices();
    const en = rankVoices(all);
    log(`voices: ${all.length} (${en.length} English, ${en.filter((x) => x.localService !== false).length} on-device)${all.length ? '' : ' (the list may still be loading, or this browser lists none)'}`);
    const v = voice;
    log(v ? `chosen voice: ${v.name} · ${v.lang || '?'} · localService: ${v.localService === false ? 'false (online voice: the first word can take a few seconds)' : String(v.localService !== undefined ? v.localService : 'unknown')}${v.default ? ' · system default' : ''}`
      : `chosen voice: none set (${pref && pref.system ? '"Use default system voice" picked' : 'no English voice listed'}: the browser picks)`);
    log(`synth state: speaking ${isSpeaking()}, pending ${!!synth.pending}, paused ${!!synth.paused} · health ${health}${gaveUp() ? ` (off for this session after ${streak} failures in a row)` : ''} · gesture unlock ${unlocked ? 'done' : 'not yet'}`);
    // inside the tap: cancel, resume, then speak at once (no await before speak())
    gen++; lastCancelAt = Date.now();
    try { synth.cancel(); } catch (_) { /* ignore */ }
    resumeIfPaused();
    if (gaveUp()) streak = GIVE_UP - 1;      // re-probe: one success turns speech back on
    const myGen = gen;
    const startMs = startTimeout(v);
    triedVoices.add(voiceKey(v));
    return new Promise((resolve) => {
      let started = false, done = false, tW = 0, tE = 0;
      let u;
      const end = (ok) => {
        if (done) return; done = true;
        clearTimeout(tW); clearTimeout(tE); setBusy(-1); releaseUtterance(u);
        log(ok ? 'result: speech started, so the voice works here. Heard nothing? Check the volume, the mute switch and Bluetooth audio.'
          : health === 'not-allowed' ? 'result: the browser blocked speech until a tap. Tap "Run speech check" again.'
            : 'result: no speech started. Words are shown for 3 s instead; the app tries the voice again on the next word.');
        resolve({ ok, lines: lines.slice(), text: lines.join('\n') });
      };
      try { u = makeUtterance(phrase, RATES[rate], v); } catch (e) { log(`could not make an utterance: ${e && e.message}`); markFail('error', 'utterance'); end(false); return; }
      u.onstart = () => {
        if (started || done) return;
        started = true; markStart(); clearTimeout(tW);
        log(`onstart after ${Math.round(now() - tSpeak)} ms`);
        tE = setTimeout(() => { log(`onend not received ${endWaitMs} ms after onstart (some browsers drop it)`); end(true); }, endWaitMs);
      };
      u.onend = () => {
        releaseUtterance(u);
        if (done) return;
        if (!started) { log('onend without an onstart'); started = true; markStart(); }
        log(`onend after ${Math.round(now() - tSpeak)} ms`);
        end(true);
      };
      u.onerror = (e) => {
        releaseUtterance(u);
        const code = (e && e.error) || 'unknown';
        lastError = code;
        if (done) return;
        log(`onerror: ${code} after ${Math.round(now() - tSpeak)} ms`);
        if (!started && myGen === gen && code !== 'interrupted' && code !== 'canceled') markFail(code === 'not-allowed' ? 'not-allowed' : 'error', `${code} · speech check`);
        end(started);
      };
      setBusy(1);
      holdUtterance(u);
      log(`speak() called: "${phrase}" (onstart watchdog ${startMs} ms)`);
      const tSpeak = now();
      tW = setTimeout(() => {
        if (started || done) return;
        watchdogs++;
        log(`watchdog fired: no onstart after ${startMs} ms`);
        markFail('no-start', `no onstart after ${startMs} ms · speech check`);
        try { synth.cancel(); } catch (_) { /* ignore */ }
        end(false);
      }, startMs);
      try { synth.speak(u); } catch (e) { log(`speak() threw: ${e && e.message}`); markFail('error', 'speak() threw'); end(false); }
      resumeIfPaused();
    });
  }

  const available = () => !!synth && (typeof g.SpeechSynthesisUtterance === 'function' || !!g.__ttsBackend || synth !== g.speechSynthesis);
  const api = {
    get available() { return available(); },
    // best current guess that speech works: the API exists, speech is not off for the session and the last attempt
    // did not fail
    get working() { return available() && !gaveUp() && (health === 'ok' || health === 'unknown') && (voiceCount > 0 || health === 'ok'); },
    get health() { return available() ? health : 'missing'; },
    get voiceCount() { return voiceCount; },
    get failures() { return failures; },
    /** onstart failures in a row (reset by any utterance that starts). */
    get failStreak() { return streak; },
    /** true after GIVE_UP_AFTER onstart failures in a row: speech counts as off until a tap re-probes. */
    get gaveUp() { return gaveUp(); },
    /** the last onerror code ('' when none) */
    get lastError() { return lastError; },
    /** an onerror 'not-allowed' happened and no utterance started since: a tap is needed */
    get needsTap() { return needsTap; },
    get lastOkAt() { return lastOkAt; },
    get stats() { return { stuckCancels, watchdogs, failures, streak, active: activeUtterances.length }; },
    get lastCheck() { return lastCheck ? { at: lastCheck.at, lines: lastCheck.lines.slice(), text: lastCheck.lines.join('\n') } : null; },
    /** the onstart watchdog the next utterance in this voice gets (5 s first, then 3 s) */
    startTimeoutFor(v = voice) { return startTimeout(v === SYSTEM_VOICE ? null : v); },
    // one-time hints shared by the spell panel and the test screen: "Speech isn't available…" and "Tap Hear it…"
    hintShown: false,
    tapHintShown: false,
    get unlocked() { return unlocked; },
    get voiceName() { return voice ? voice.name : ''; },
    get voice() { return voice; },
    get voicePref() { return pref ? { ...pref } : null; },
    /** "Use default system voice" is picked (no voice is set on the utterances). */
    get systemVoice() { return !!(pref && pref.system); },
    /** English voices on this device, best first (see rankVoices). */
    voices() { return rankVoices(listVoices()); },
    /** The voice a preference would use here ({name, lang} or null → the ranked default; SYSTEM_VOICE → null). */
    resolveVoice(p) { return resolve(p && p.name === SYSTEM_VOICE ? { system: true } : p, rankVoices(listVoices())); },
    /** Use this voice when the device has it (by name, lang preferred), else the ranked default. null: default.
     *  { name: SYSTEM_VOICE }: no voice set on the utterance (the browser's default). */
    setVoice(p) {
      if (p && p.name === SYSTEM_VOICE) pref = { system: true, name: SYSTEM_VOICE, lang: '' };
      else pref = p && typeof p.name === 'string' && p.name ? { name: p.name, lang: typeof p.lang === 'string' ? p.lang : '' } : null;
      pickVoice();
    },
    /** Before an attempt that needs speech: true when the API exists and voices are listed (waits ≤ 1.5 s) or speech
     *  already started this session; false at once when speech is off for the session (GIVE_UP failures in a row). */
    async ready() {
      if (!available()) return false;
      resumeIfPaused();
      if (gaveUp()) return false;
      if (health === 'ok') { pickVoice(); return true; }
      return voicesReady();
    },
    voicesReady,
    /** A tap on Hear it / Test / Speech check: when speech is off for the session, allow one more attempt (one
     *  success turns it back on; one more failure turns it off again). */
    reprobe() { if (gaveUp()) { streak = GIVE_UP - 1; note('re-probe (tap)'); } },
    get rate() { return rate; },
    get rateValue() { return RATES[rate]; },
    setRate(r) { rate = RATES[r] ? r : 'normal'; },
    // duck music / hold sound effects while the voice talks: fn(true) when speech starts, fn(false) when idle
    setOnSpeaking(fn) { onSpeaking = typeof fn === 'function' ? fn : () => {}; },
    // call from inside a tap (pointerdown): Safari only lets speech start from a user gesture the first time, so
    // the first call speaks a real, nearly silent word ("ready" at volume 0.01) in the chosen voice (this also warms
    // up a slow online voice). Later calls only resume a synth left `paused` (iOS interruptions, Chrome tab
    // switches); after an onerror 'not-allowed' the next tap unlocks again.
    unlock() {
      if (!synth) return;
      resumeIfPaused();
      if (unlocked) return;
      pickVoice();
      try {
        const u = makeUtterance(UNLOCK_TEXT, 1, voice, UNLOCK_VOLUME);
        u.onstart = () => markStart();
        u.onend = () => releaseUtterance(u);
        u.onerror = (e) => {
          releaseUtterance(u);
          if (e && e.error === 'not-allowed') { unlocked = false; needsTap = true; lastError = 'not-allowed'; note('unlock: not-allowed'); }
        };
        holdUtterance(u);
        synth.speak(u);
        unlocked = true;                  // speak() was called inside the gesture: Safari's rule is met
      } catch (_) { /* ignore */ }
      resumeIfPaused();
    },
    /** Resolves true when the speech really started (onstart), false when it is unavailable or never started
     *  (no onstart within 5 s / 3 s, an error, or speech off for the session), null when newer speech or cancel()
     *  cut it off first. */
    say(text) { return speak(text, RATES[rate]); },
    /** Present a word like a spelling test: "The word is, <word>." → sentence → "<word>." (same result values
     *  as say). info: { word, sentence, sayAs }; opts.voice: speak in this voice instead (Parent Zone ▶ Test;
     *  SYSTEM_VOICE: no voice set). */
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
      resumeIfPaused();
      for (let i = 0; i < chars.length; i++) {
        if (myGen !== gen) return false;
        try { if (onLetter) onLetter(i, chars[i]); } catch (_) { /* ignore */ }
        // after a failed start, light the tiles on a timer instead of waiting for the watchdog on every silent letter
        if (synth && !failedLast()) await speakChunk(letterName(chars[i]), LETTER_RATE[rate], myGen);
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
    /** Parent Zone "Speech check" (see runCheck above). */
    runCheck,
    useBackend(b) {
      synth = b || g.speechSynthesis || null; voice = null; voiceCount = 0; health = 'unknown'; streak = 0; needsTap = false;
      unlocked = false; triedVoices.clear(); watchVoices();
    },
  };
  return api;
}

export const tts = createTTS();
export default tts;

// Text-to-speech for Spell Jump (R6: letters are spoken by name, speech is synthesized on device).
// A thin wrapper over the Web Speech API's speechSynthesis with the iOS quirks handled:
//  - voices arrive late (voiceschanged) → the voice is re-picked whenever the list changes
//  - the first speak must happen inside a user gesture → unlock() speaks a silent utterance from a tap
//  - long utterances can be cut off → text is split into short chunks spoken one after another
//  - a new utterance right after cancel() can be dropped → cancel() first, then a short delay before speaking
//  - onend sometimes never fires → every utterance also resolves on an estimated-duration timer
// Test hook: if `window.__ttsBackend` is set before boot (an object with speak/cancel/getVoices, like
// speechSynthesis), it is used instead of the real one; `tts.useBackend(b)` swaps it at runtime.
import { letterName } from './words.js';

const RATES = { slow: 0.68, normal: 0.9 };
const LETTER_RATE = { slow: 0.75, normal: 0.95 };
const PREFERRED = /(Samantha|Ava|Allison|Susan|Nicky|Natural|Enhanced|Premium|Google US English|Aria|Jenny|Zira)/i;
const CHUNK = 140;

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
  let voice = null, rate = 'normal', unlocked = false, gen = 0, busy = 0, idleTimer = 0;
  let onSpeaking = () => {};

  function pickVoice() {
    if (!synth || typeof synth.getVoices !== 'function') return;
    let voices = [];
    try { voices = synth.getVoices() || []; } catch (_) { voices = []; }
    const us = voices.filter((v) => /^en[-_]US$/i.test(v.lang || ''));
    const en = voices.filter((v) => /^en/i.test(v.lang || ''));
    const pool = us.length ? us : en;
    voice = pool.find((v) => PREFERRED.test(v.name) && v.localService !== false) || pool.find((v) => PREFERRED.test(v.name)) || pool.find((v) => v.default) || pool[0] || null;
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

  // speak one chunk; resolves on end / error / estimated timeout (iOS sometimes drops onend)
  function speakChunk(text, r, myGen) {
    return new Promise((resolve) => {
      if (myGen !== gen || !synth) { resolve(); return; }
      let done = false;
      const finish = () => { if (done) return; done = true; clearTimeout(t); setBusy(-1); resolve(); };
      let u;
      try {
        u = new Utter(text);
        u.lang = 'en-US';
        try { if (voice) u.voice = voice; } catch (_) { /* a voice from another backend: keep the default */ }
        u.rate = r; u.pitch = 1.05; u.volume = 1;
        u.onend = finish; u.onerror = finish;
      } catch (_) { resolve(); return; }
      setBusy(1);
      const t = setTimeout(finish, 700 + (text.length * 95) / r);
      try { synth.speak(u); } catch (_) { finish(); }
    });
  }

  async function speak(text, r) {
    const chunks = splitChunks(text);
    if (!chunks.length || !synth) return;
    const myGen = ++gen;
    let wasSpeaking = false;
    try { wasSpeaking = !!(synth.speaking || synth.pending); synth.cancel(); } catch (_) { /* ignore */ }
    if (wasSpeaking) await sleep(60);
    for (const c of chunks) {
      if (myGen !== gen) return;
      await speakChunk(c, r, myGen);
    }
  }

  const api = {
    get available() { return !!synth && (typeof g.SpeechSynthesisUtterance === 'function' || !!g.__ttsBackend); },
    get unlocked() { return unlocked; },
    get voiceName() { return voice ? voice.name : ''; },
    get rate() { return rate; },
    setRate(r) { rate = RATES[r] ? r : 'normal'; },
    // duck music / hold sound effects while the voice talks: fn(true) when speech starts, fn(false) when idle
    setOnSpeaking(fn) { onSpeaking = typeof fn === 'function' ? fn : () => {}; },
    // call from inside a tap: iOS only lets speech start from a user gesture the first time
    unlock() {
      if (unlocked || !synth) return;
      unlocked = true;
      pickVoice();
      try { const u = new Utter(' '); u.volume = 0; u.lang = 'en-US'; synth.speak(u); } catch (_) { /* ignore */ }
    },
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
        if (synth) await speakChunk(letterName(chars[i]), LETTER_RATE[rate], myGen);
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
    useBackend(b) { synth = b || g.speechSynthesis || null; voice = null; watchVoices(); },
  };
  return api;
}

export const tts = createTTS();
export default tts;

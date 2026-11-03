// Spell Jump's own handling of the natural (cloud) voice, v3.8.1: ONE place that gets the clips ready and sits between
// the spell panel / the Qualifier and src/spelling/tts.js. (Written after the owner applied a brand-new class list
// and every word was read in the device "robot" voice, which the children cannot understand.)
//
// Why it happened: the cloud engine plays a phrase only from a clip made for that exact text, and a brand-new list
// means every carrier phrase ("The word is, <word>."), sentence, "<word>.", "<word>. <word>." and every letter is
// a text the server has never made. The whole list was asked for in one background request (up to 80 texts, 300 ms +
// 120 ms per text at the server, so ~10 s), cloudVoice.prepare runs ONE request per voice at a time, so the first
// word's own request queued behind it, the spell panel waited 3 s, and a missing clip sends the whole phrase to the
// device voice. Wagon West 1.3.2 and Build Crew 0.4 fixed the same thing by preparing in small batches, next-needed
// lines first, stepping aside while a line waits, and waiting longer. Spell Jump follows the same design with one
// difference: a dictated word must be HEARD, so silence is never the answer, the device voice is:
//   1. prepare(): the list's clips in small batches (BATCH), ordered by what the child will hear first (orderTexts:
//      the next race's words and sentences, the letters, the rest of the mission, then the rest of the list); a batch
//      never starts while a line is waiting for its own clip (`waiting`).
//   2. the facade (`tts` below, a Proxy over the real tts): before it speaks a word's lines it makes sure their clips
//      are there and loaded, asking again quietly, for up to WAIT_MS (12 s). The spell panel shows "Getting the voice
//      ready…" meanwhile (prepareWord → the panel's voiceWaitMs). Only when the natural voice cannot be used at all
//      (no family code, no key, refused, offline, the daily limit) or the clip has still not come after that, the
//      device voice says the line.
//   3. never interleaved: once the device voice has said a line of a word, the rest of that word (Say it again,
//      Syllables, the spelling out, its sentence) stays with the device voice until the next word begins.
// Nothing in tts.js or the other games changes: tts.js still decides clip-or-device when it is asked to speak; this
// layer makes sure that a clip exists and is loaded before it is asked, and forces the device voice (the cloud engine
// detached for that one call) when the word has fallen back.
import { buildPresentation, buildRepeat, buildSyllables, spokenForm } from './tts.js';
import { cloudLetterText, sharedTexts, wordTexts } from './cloudVoice.js';
import { LETTER_NAMES } from './words.js';
import { MISSION_SIZE, dayKey, buildMission } from './scheduler.js';

/** How long a line waits for its clip (the server making it, then loading it) before the device voice says it. */
export const WAIT_MS = 12000;
/** Clips asked for per background request: small enough that a waiting line never queues behind a long one. */
export const BATCH = 8;
const RETRY_MS = 700;          // a waiting line asks again this often, quietly
const HARD = ['no-key', 'forbidden', 'daily-limit', 'no-voice', 'no-code'];   // answers that will not change by asking again
const WARM_FIRST = 40;         // the first texts of a list are also fetched + decoded ahead of time

const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const norm = (w) => clean(w).toLowerCase();
const uniq = (list) => [...new Set(list.map(clean).filter(Boolean))];
const lettersOf = (word) => uniq(Array.from(String(word || '')).map(cloudLetterText));
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The words the next missions will say, in order, as list entries (word, sentence, syllables, sayAs): the scheduler's
 *  own mission order, without touching the data. */
export function nextMissionEntries(d, now, opts = {}, wordInfo = (x) => ({ word: x })) {
  if (!d || !d.lists) return [];
  const t = d.today && d.today.date === dayKey(now) ? d.today : { count: 0, newCount: 0 };
  if (t.count >= MISSION_SIZE) return [];
  const words = buildMission(d, now, { size: MISSION_SIZE, newPerDay: opts.newPerDay, newToday: t.newCount, includeReview: opts.includeReview });
  return words.map((w) => wordInfo(w));
}

/**
 * Every text a list needs, in the order the child will need them.
 *   entries: the active list's words ({ word, sentence, syllables, sayAs }); mission: the next mission's entries in order;
 *   perRace: words per race; qualifier: the Qualifier is due, so every word of the list is dictated first.
 */
export function orderTexts(entries = [], { mission = [], perRace = 2, qualifier = false } = {}) {
  const present = (e) => buildPresentation(e);
  const extras = (e) => [buildRepeat(e), buildSyllables(e.syllables)];
  const head = qualifier ? entries : mission.slice(0, Math.max(1, perRace));
  const rest = qualifier ? mission : mission.slice(head.length);
  const letters = [...Object.keys(LETTER_NAMES), "'", '-', ' '].map(cloudLetterText);
  return uniq([
    ...head.flatMap(present),                 // the next race's words and sentences
    ...letters,                               // every word is spelled out aloud, and a typed letter is said
    ...head.flatMap(extras),
    ...rest.flatMap(present),                 // the rest of the mission
    ...rest.flatMap(extras),
    ...entries.flatMap((e) => wordTexts(e)),  // the rest of the list
    ...sharedTexts(),                         // the sample, the Test voice phrase …
  ]);
}

/**
 * deps: { tts (the real src/spelling/tts.js engine), cloud (cloudVoice), sleep?, now?, waitMs? }
 * Returns { tts: the facade the spell panel / the Qualifier use, prepare(texts, opts), prepareNow(texts, voice),
 *           waitMs, waiting, stats }.
 */
export function createSpellVoice({ tts, cloud, sleep = defaultSleep, now = Date.now, waitMs = WAIT_MS } = {}) {
  const g = typeof window !== 'undefined' ? window : globalThis;
  // test hook (like window.__ttsBackend): window.__spellVoiceWaitMs shortens the wait
  const wait = () => (g.__spellVoiceWaitMs > 0 ? g.__spellVoiceWaitMs : waitMs);
  let seq = 0;                  // bumped by every line spoken and by cancel(): a line still waiting for its clip stops
  let waiting = 0;              // lines waiting for their clip: the background preparation steps aside while this is above 0
  let episode = { key: '', device: false };    // the word being practised; device: its lines now go to the device voice
  const stats = { waited: 0, device: 0, cloud: 0 };

  // ---- can the server make clips for us right now? ----
  function canMake() {
    if (!cloud || !cloud.active) return false;
    const s = cloud.server;
    if (s.key === false || s.error === 'forbidden' || s.error === 'daily-limit') return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    return true;
  }
  const have = (texts) => texts.every((t) => cloud.has(t));
  const ready = (texts) => have(texts) && (typeof cloud.loaded !== 'function' || cloud.loaded(texts));

  /** Resolves true once the clips of `texts` are made, fetched and decoded; false after `ms`, or when the natural voice
   *  cannot make them at all (no key, refused, offline, daily limit). Asks again quietly until then. */
  async function ensure(texts, token, ms = wait()) {
    const list = uniq(texts);
    if (!list.length || ready(list)) return true;
    const end = now() + ms;
    waiting++;
    stats.waited++;
    try {
      let offline = 0;
      while (now() < end && token === seq) {
        const missing = list.filter((t) => !cloud.has(t));
        if (missing.length) {
          if (!canMake()) return false;
          const res = await Promise.race([cloud.prepare(missing).catch(() => null), sleep(Math.max(0, end - now())).then(() => 'late')]);
          if (res === 'late') break;
          if (res && HARD.includes(res.error)) return false;
          if (res && res.error === 'offline' && ++offline >= 2) return false;
          if (list.some((t) => !cloud.has(t))) await sleep(RETRY_MS);
        } else if (typeof cloud.preload !== 'function' || await Promise.race([cloud.preload(list), sleep(Math.max(0, end - now())).then(() => false)])) {
          return true;
        } else if (!canMake()) return false;                 // the clips cannot be fetched (offline)
        else if (now() < end) await sleep(RETRY_MS);         // a clip that would not load (gone from the server: made again)
      }
      return false;
    } finally { waiting--; }
  }

  // ---- the background preparation: small batches, next-needed first, stepping aside ----
  const jobs = [];              // { key, voice, todo, warm, resolve }
  let pumping = false;
  /** Prepare these texts in the background, BATCH at a time, in this order. A newer call with the same key replaces the
   *  one waiting (the same player's list changed); `front` puts it before the others (the player who is about to play).
   *  Resolves when its batches have run (or it was replaced or could not go on). */
  function prepare(texts, { key = 'list', voice = cloud && cloud.voice, front = false } = {}) {
    if (!cloud || !voice || !cloud.code) return Promise.resolve(null);
    const todo = uniq(texts || []).filter((t) => !cloud.has(t, voice));
    for (let i = jobs.length - 1; i >= 0; i--) if (jobs[i].key === key && jobs[i].voice === voice) { jobs[i].resolve(null); jobs.splice(i, 1); }
    if (!todo.length) return Promise.resolve({ ok: true });
    return new Promise((resolve) => {
      const job = { key, voice, todo, warm: WARM_FIRST, resolve, fails: 0 };
      if (front) jobs.unshift(job); else jobs.push(job);
      pump();
    });
  }
  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      while (jobs.length) {
        while (waiting > 0) await sleep(120);                  // a line is waiting for its own clip: never queue behind a batch
        const job = jobs[0];
        if (!job) break;
        const batch = job.todo.splice(0, BATCH).filter((t) => !cloud.has(t, job.voice));
        if (!batch.length) { if (!job.todo.length) { jobs.splice(jobs.indexOf(job), 1); job.resolve({ ok: true }); } continue; }
        let res = null;
        try { res = await cloud.prepare(batch, job.voice); } catch (_) { res = null; }
        if (res && res.ok) {
          job.fails = 0;
          const w = batch.slice(0, job.warm); job.warm -= w.length;
          if (w.length) { try { cloud.warm(w, job.voice); } catch (_) { /* ignore */ } }
        } else {
          job.fails++;
          const hard = res && HARD.includes(res.error);
          if (hard && (res.error === 'no-key' || res.error === 'forbidden' || res.error === 'daily-limit')) { for (const j of jobs.splice(0)) j.resolve(res); continue; }
          if (hard || job.fails >= 2) { const i = jobs.indexOf(job); if (i >= 0) jobs.splice(i, 1); job.resolve(res); continue; }
          await sleep(1500);                                    // offline, a server hiccup: do not hammer the service
        }
        if (!job.todo.length && jobs[0] === job) { jobs.shift(); job.resolve({ ok: true }); }
      }
    } finally { pumping = false; }
  }
  /** A request the screen is waiting for (Parent Zone ▶ Test): the background batches step aside meanwhile. */
  async function prepareNow(texts, voice = cloud && cloud.voice) {
    waiting++;
    try { return await cloud.prepare(texts, voice); } finally { waiting--; }
  }

  // ---- speaking ----
  const episodeFor = (key) => {
    const k = norm(key);
    if (k && k !== episode.key) episode = { key: k, device: false };
    return episode;
  };
  /** Run an engine call with the device voice only (the cloud engine detached for the call: tts.js picks its engine when it
   *  is called). Nothing else changes: ducking, the watchdogs and the results are the device engine's own. */
  function device(run) {
    if (!cloud) return run();
    try { cloud.stop(); } catch (_) { /* ignore */ }
    tts.setCloud(null);
    try { return run(); } finally { tts.setCloud(cloud); }
  }
  /** One spoken line (the engine call `run`) for the word `key` whose clips are `texts`. cut: what a superseded line resolves. */
  function line(key, texts, run, cut = null) {
    const ep = episodeFor(key);
    if (!cloud || !cloud.active) return run();                // no natural voice in use: the device voice, as ever
    if (ep.device) { stats.device++; return device(run); }    // never the cloud voice for a word the device voice has begun
    const clips = uniq(texts);
    if (ready(clips)) { stats.cloud++; return afterRun(ep, run()); }
    const my = ++seq;
    return (async () => {
      const ok = await ensure(clips, my);
      if (my !== seq) return cut;
      if (!ok) { ep.device = true; stats.device++; return device(run); }
      stats.cloud++;
      return afterRun(ep, run());
    })();
  }
  // a clip that would not play inside tts.js hands the rest to the device voice: the word stays there
  function afterRun(ep, p) {
    return Promise.resolve(p).then((r) => { if (r === true && tts.engine === 'device' && cloud && cloud.active) ep.device = true; return r; });
  }

  const asking = new Set();     // typed letters whose clip is being asked for
  const wordKeyOf = (info) => (info && (info.word || info.sayAs)) || '';
  const facade = {
    present(info, o = {}) {
      if (o && o.voice) return tts.present(info, o);          // an explicit voice (Parent Zone ▶ Test): not ours
      return line(wordKeyOf(info), buildPresentation(info), () => tts.present(info));
    },
    sayAgain(info) { return line(wordKeyOf(info), [buildRepeat(info)], () => tts.sayAgain(info)); },
    saySyllables(syllables) { return line('', [buildSyllables(syllables)], () => tts.saySyllables(syllables)); },
    sayWord(info) { const w = spokenForm(info); return line(wordKeyOf(info), w ? [`${w}.`] : [], () => tts.sayWord(info)); },
    say(text) { return line('', [text], () => tts.say(text)); },
    spell(word, onLetter, o) { return line(word, lettersOf(word), () => tts.spell(word, onLetter, o), false); },
    /** A typed (or collected) letter is said by its clip. A letter whose clip is not there yet is not read by the device
     *  voice while the natural voice can still make it: it is asked for and skipped (it is an echo, not a dictated word). */
    sayLetter(ch) {
      if (!cloud || !cloud.active) return tts.sayLetter(ch);
      if (episode.device) return device(() => tts.sayLetter(ch));
      const t = cloudLetterText(ch);
      if (cloud.has(t) || !/^[A-Z]$/.test(t)) return tts.sayLetter(ch);
      if (!canMake()) return device(() => tts.sayLetter(ch));
      if (!asking.has(t)) { asking.add(t); prepareNow([t]).catch(() => {}).then(() => asking.delete(t)); }
      return Promise.resolve(null);
    },
    /** Before a word: starts its episode and resolves once all it will say (and spell) is ready, up to the wait; null when
     *  nothing is to be waited for. The spell panel / Qualifier show "Getting the voice ready…" meanwhile. */
    prepareWord(info) {
      const ep = (episode = { key: norm(wordKeyOf(info)), device: false });
      if (!cloud || !cloud.active) return null;
      const texts = uniq([...wordTexts(info), ...lettersOf(info && info.word)]);
      if (ready(texts)) return null;
      const my = ++seq;
      return ensure(texts, my).then((ok) => { if (!ok && my === seq) ep.device = true; return ok; }, () => false);
    },
    cancel() { seq++; return tts.cancel(); },
  };
  const proxy = new Proxy(facade, {
    get(target, prop) { return prop in target ? target[prop] : Reflect.get(tts, prop, tts); },
    set(target, prop, value) { return Reflect.set(tts, prop, value, tts); },
    has(target, prop) { return prop in target || prop in tts; },
  });

  return {
    tts: proxy, prepare, prepareNow, ensure: (texts, ms) => ensure(texts, ++seq, ms),
    get waitMs() { return wait(); },
    get waiting() { return waiting; },
    get queued() { return jobs.length; },
    get stats() { return { ...stats }; },
  };
}

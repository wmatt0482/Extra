// Kid-rule text audit of Wagon West's content (SPEC §1): no death, lives, timers, countdowns or "wrong" in anything a child
// reads or hears. Run from the repo root:
//   node wagon-west/tools/content-audit.mjs
// What it walks (every string, at any depth, in every export):
//   1. every module in src/content/*  (cards, companions, events, legs, letters, lookouts, nations, people)
//   2. the kid-facing tables in src/journey/*  (deeds, upgrades, challenge kinds and labels, skills, event payload text)
//   3. every word-problem story problems.js can tell (each kind, a spread of facts and seasons), the work shown after a miss
//   4. the string literals in the source of src/journey/*.js and src/content/*.js (comments skipped), as ui-smoke does for the UI
//   5. (v1.3.2) the natural voice's coverage: every string the UI can speak is reachable by prepareVoice (src/meta/voiceTexts.js
//      collectVoiceTexts, the one list main.js prepares): the trail's content walked on its own (lookouts, nations, events,
//      companions, cards, people and their offers, deeds, the letters' templates) and the string literals the source hands to the
//      voice (effectToast / toast second argument, say:, app.say, sayWait, a card's text:), each compared with the collected list;
//      lines that exist only at run time are listed by name and prepared just in time (speech.js ready()).
//   6. (v1.4) the weapon words: WEAPONS (guns, gunshots, rifles, muskets, pistols, bullets, shoot, shot ...) in every walked string and
//      every string literal, except the two exact phrases of WEAPON_ALLOW ('Far-off rifles', 'The far-off crack of rifles beyond the
//      ridge.'), which may occur only in TRAIL_FACTS['far-off-crack'] and the card 'far-off-crack' and must both be in that fact (SPEC
//      v1.4 section 1.7); and the voice walk of the new content (finds, junk, wishes, MOMENTS, quests, trail facts, the new cards and
//      deeds, the companions' help lines, the new letter lines, DOG_LINES filled with 'Frodo'), each reachable by
//      collectVoiceTexts({ legId, playerName: 'Mia', dogName: 'Frodo' }) for some leg.
// The Parent Zone is for grown-ups and is not here. Exit code 1 on any hit.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Source of truth: BANNED in wagon-west/tools/ui-smoke.mjs. That file runs a browser on import, so the list is duplicated
// here; keep the two identical (the self-check below fails if ui-smoke's copy has drifted).
export const BANNED = /\b(kill(s|ed|ing)?|die[sd]?|dying|dead|death|grave|blood|gun|lives|life left|wrong|timer|countdown|hurry|time'?s up|seconds? left|game over|lose|lost|fail(ed)?|dysentery|snakebite|starv(e|ing|ed))\b/i;

// (v1.4, SPEC section 1.7) weapon words: no gun is drawn, named in the UI, a toast or a letter. Two exact phrases of one trail fact are
// allowed. Source of truth for both constants: tools/ui-smoke.mjs (the same drift check as BANNED).
export const WEAPONS = /\b(guns?|gunshots?|gunfire|rifles?|muskets?|pistols?|bullets?|shoot|shoots|shooting|shot)\b/i;
export const WEAPON_ALLOW = ['Far-off rifles', 'The far-off crack of rifles beyond the ridge.'];
const ALLOW_FILES = ['src/content/trailFacts.js', 'src/content/cards.js'];       // the only modules that may hold the phrases
const ALLOW_OWNER = 'far-off-crack';                                                // ... and only inside the fact / the card of this id

const hits = [];
let seen = 0;
const stripAllowed = (t) => WEAPON_ALLOW.reduce((x, p) => x.split(p).join(' '), String(t));
const hasAllowed = (t) => WEAPON_ALLOW.some((p) => String(t).includes(p));
/** Check one string: the banned words, then the weapon words (after taking out an allowed phrase where it is allowed: `owner` is the
 *  id of the object the string belongs to). */
const note = (where, s, owner = null) => {
  const t = String(s);
  const short = t.replace(/\s+/g, ' ').slice(0, 90);
  const m = t.match(BANNED);
  if (m) hits.push(`${where}: "${m[0]}" in "${short}"`);
  let rest = t;
  if (hasAllowed(t)) {
    if (owner === ALLOW_OWNER) rest = stripAllowed(t);               // (the fact and its card, wherever the journey re-exports them)
    else hits.push(`${where}: an allowed weapon phrase outside TRAIL_FACTS['${ALLOW_OWNER}'] and its card (no stray allowance) in "${short}"`);
  }
  const w = rest.match(WEAPONS);
  if (w) hits.push(`${where}: weapon word "${w[0]}" in "${short}"`);
};

/** Walk any value: strings are checked, arrays / objects recursed (cycle-safe), functions skipped. `owner` = the id of the nearest object with one. */
function walk(v, where, stack = new Set(), owner = null) {
  if (typeof v === 'string') { seen++; note(where, v, owner); return; }
  if (!v || typeof v !== 'object' || stack.has(v)) return;
  stack.add(v);
  const own = typeof v.id === 'string' ? v.id : owner;
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`, stack, own));
  else for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`, stack, own);
  stack.delete(v);
}

// 0. the list must match ui-smoke's
const smoke = readFileSync(path.join(root, 'tools/ui-smoke.mjs'), 'utf8').match(/^const BANNED = (\/.*\/i);/m);
if (!smoke) { console.log('could not find BANNED in tools/ui-smoke.mjs'); process.exit(1); }
if (smoke[1] !== String(BANNED)) { console.log(`the banned list drifted from ui-smoke.mjs:\n  smoke ${smoke[1]}\n  audit ${BANNED}`); process.exit(1); }

const smokeWeap = readFileSync(path.join(root, 'tools/ui-smoke.mjs'), 'utf8').match(/^const WEAPONS = (\/.*\/i);/m);
const smokeAllow = readFileSync(path.join(root, 'tools/ui-smoke.mjs'), 'utf8').match(/^const WEAPON_ALLOW = (\[.*\]);/m);
if (!smokeWeap || smokeWeap[1] !== String(WEAPONS)) { console.log(`the weapon list drifted from ui-smoke.mjs:\n  smoke ${smokeWeap && smokeWeap[1]}\n  audit ${WEAPONS}`); process.exit(1); }
if (!smokeAllow || JSON.stringify(eval(smokeAllow[1])) !== JSON.stringify(WEAPON_ALLOW)) { console.log(`the weapon allowlist drifted from ui-smoke.mjs:\n  smoke ${smokeAllow && smokeAllow[1]}\n  audit ${JSON.stringify(WEAPON_ALLOW)}`); process.exit(1); }

const jsIn = (dir) => readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.js')).sort().map((f) => `${dir}/${f}`);
const files = [...jsIn('src/content'), ...jsIn('src/journey')];

// 1 + 2. every export of every module
const mods = {};
for (const f of files) {
  mods[f] = await import(pathToFileURL(path.join(root, f)).href);
  for (const [name, val] of Object.entries(mods[f])) if (typeof val !== 'function') walk(val, `${f}:${name}`);
}

// (v1.4) the allowlist and the content agree: TRAIL_FACTS['far-off-crack'] holds both exact phrases (its title, its text)
{
  const TF = mods['src/content/trailFacts.js'];
  const fact = TF && (TF.TRAIL_FACTS || []).find((x) => x.id === ALLOW_OWNER);
  if (!TF) console.log(`SKIP weapons allowlist agreement: src/content/trailFacts.js is not in this tree yet`);
  else if (!fact) hits.push(`TRAIL_FACTS has no '${ALLOW_OWNER}' fact`);
  else for (const ph of WEAPON_ALLOW) if (!`${fact.title} ${fact.text}`.includes(ph)) hits.push(`TRAIL_FACTS['${ALLOW_OWNER}'] no longer contains the allowed phrase "${ph}"`);
}

// the text the journey layer builds at run time: today's challenge on every leg, every day key (all six kinds come up)
const { createJourney, startLeg } = mods['src/journey/sim.js'];
const { dailyChallenge } = mods['src/journey/challenge.js'];
const { LEGS: ALL_LEGS } = mods['src/content/legs.js'];
for (const leg of ALL_LEGS) {
  for (let d = 0; d < 24; d++) {
    const J = createJourney({ seed: d + 1 });
    startLeg(J, leg.id);
    const c = dailyChallenge(J, `2026-01-${d + 1}`);
    if (c) walk({ text: c.text, say: c.say }, `challenge:${leg.id}:${c.kind}`);
  }
}

// 3. the word problems: every kind x a spread of facts x the seasons x every nation / leg
const { problemFor, PROBLEM_KINDS } = mods['src/journey/problems.js'];
const { NATIONS } = mods['src/content/nations.js'];
const { SEASONS, LEGS } = mods['src/content/legs.js'];
const FACTS = [null, '2x3', '3x4', '4x6', '5x5', '6x7', '7x8', '8x9', '9x9', '12x12', '11x2', '10x10', '23x4', '56/7', '63/9', '42/6', '81/9', '144/12', '36/4'];
let problems = 0;
for (const kind of PROBLEM_KINDS) {
  for (const fact of FACTS) {
    for (const season of SEASONS) {
      for (let seed = 1; seed <= 6; seed++) {
        let state = seed * 2654435761 >>> 0;
        const rand = () => { state = (state + 0x6D2B79F5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        const leg = LEGS[(seed + problems) % LEGS.length];
        const nation = kind === 'trade' ? NATIONS[(seed + problems) % NATIONS.length].id : undefined;
        let p = null;
        try { p = problemFor({ kind, fact, leg, season: season.id, rand, nation, have: 7, cash: 40, shelf: 4 }); } catch (_) { p = null; }
        if (!p) continue;
        problems++;
        walk({ text: p.text, say: p.say, work: p.work, parts: p.parts }, `problem:${kind}:${fact}`);
      }
    }
  }
}

// 4. string literals in the source (comments skipped), like ui-smoke's staticAudit for the UI
const lit = [];
for (const f of files) {
  const src = readFileSync(path.join(root, f), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const strings = src.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || [];
  for (const s of strings) {
    seen++;
    const m = s.match(BANNED);
    const short = s.replace(/\s+/g, ' ').slice(0, 90);
    if (m) lit.push(`${f}: "${m[0]}" in ${short}`);
    // (v1.4) the weapon words in a literal: the two allowed phrases only in the modules that hold the fact and its card
    let rest = s;
    if (hasAllowed(s)) { if (ALLOW_FILES.includes(f)) rest = stripAllowed(s); else lit.push(`${f}: an allowed weapon phrase outside its fact and card in ${short}`); }
    const w = rest.match(WEAPONS);
    if (w) lit.push(`${f}: weapon word "${w[0]}" in ${short}`);
  }
}
// a literal is a hit only if the same text is not already reported from the walk above
for (const h of lit) if (!hits.some((x) => h.includes(x.split(' in ')[1] || '\u0000'))) hits.push(`source ${h}`);

// 5. the natural voice: everything the UI can say that is known ahead is in the list prepareVoice() asks for
const { collectVoiceTexts, allVoiceTexts, spoken } = await import(pathToFileURL(path.join(root, 'src/meta/voiceTexts.js')).href);
const { speechChunks } = await import(pathToFileURL(path.join(root, 'src/meta/speech.js')).href);
const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const stripStop = (t) => norm(t).replace(/[.!?]$/, '');
// what prepareVoice can reach: its list for every leg (a leg's letters are prepared when that leg starts), as clip pieces
const reachable = new Set();
for (const leg of ALL_LEGS) for (const t of speechChunks(collectVoiceTexts({ legId: leg.id, playerName: 'Mia', dogName: 'Frodo' }).ordered)) reachable.add(norm(t));
const reachableLoose = new Set([...reachable].map(stripStop));
const has = (t) => speechChunks([t]).every((c) => reachable.has(norm(c)) || reachableLoose.has(stripStop(c)));
const missingVoice = [];
const need = (where, t) => { if (t && norm(t) && !has(t)) missingVoice.push(`${where}: "${norm(t).slice(0, 100)}"`); };
const regexQuote = (t) => t.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
// 5a. the content, walked on its own (not through the collector)
const { LOOKOUTS } = mods['src/content/lookouts.js'];
const { EVENTS } = mods['src/content/events.js'];
const { COMPANIONS } = mods['src/content/companions.js'];
const { CARDS } = mods['src/content/cards.js'];
const { PEOPLE } = mods['src/content/people.js'];
const { DEEDS } = mods['src/journey/deeds.js'];
const { LETTER_LINES, LETTER_OPEN } = mods['src/content/letters.js'];
for (const [id, l] of Object.entries(LOOKOUTS)) need(`lookout ${id}`, l.say || l.text);
for (const n of NATIONS) need(`nation ${n.id}`, n.fact && (n.fact.say || n.fact.text));
for (const e of EVENTS) need(`event ${e.id}`, e.say || e.text);
for (const c of COMPANIONS) {
  for (const l of (c.lines.trail || [])) need(`companion ${c.id} line`, l);
  need(`companion ${c.id} tired`, c.lines.tired); need(`companion ${c.id} happy`, c.lines.happy); need(`companion ${c.id} skill`, `${c.name}: ${c.skill.text}`);
}
for (const c of CARDS) need(`card ${c.id}`, c.say || (c.fact && (c.fact.say || c.fact.text)) || (typeof c.fact === 'string' ? c.fact : ''));
for (const p of PEOPLE) { need(`person ${p.id}`, p.lines.join(' ')); if (p.gift && p.gift.text) need(`person ${p.id} gift`, p.gift.text); }
for (const d of DEEDS) need(`deed ${d.id}`, d.say);
for (const o of LETTER_OPEN) need('letter opening', spoken(o));
// the letters' templates: each one matches a collected line (a line that tells a number of pounds is said just in time)
for (const [key, list] of Object.entries(LETTER_LINES)) {
  for (const line of list) {
    if (/\{food\}/.test(line)) continue;
    const re = new RegExp('^' + regexQuote(line).replace(/\{(\w+)\}/g, '.+') + '$');
    if (![...reachable].some((t) => re.test(t))) missingVoice.push(`letter line ${key}: "${line.slice(0, 80)}"`);
  }
}
// 5a'. (v1.4) the new content, walked on its own: every find, junk, wish, MOMENTS line, quest line, trail fact, fish landing line, bait line,
// companion help line and DOG_LINES (filled with 'Frodo'); the new cards and deeds are in the loops above (every CARDS / DEEDS entry)
const sayOf1 = (x) => (x ? x.say || x.text || '' : '');
const leaves = (v, out = []) => {                       // every line in a tree of { text, say } leaves, strings and arrays
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => leaves(x, out));
  else if (v && typeof v === 'object') { if ('text' in v || 'say' in v) out.push(sayOf1(v)); else Object.values(v).forEach((x) => leaves(x, out)); }
  return out;
};
const have14 = ['finds', 'fish', 'moments', 'quests', 'trailFacts'].map((m) => !!mods[`src/content/${m}.js`]);
if (!have14.every(Boolean)) console.log('SKIP the voice walk of the 1.4 content: not every src/content module (finds, fish, moments, quests, trailFacts) is in this tree yet');
else {
  const { FINDS, WISHES } = mods['src/content/finds.js'];
  const { FISH, JUNK, BAITS } = mods['src/content/fish.js'];
  const { MOMENTS, DOG_LINES } = mods['src/content/moments.js'];
  const { QUESTS } = mods['src/content/quests.js'];
  const { TRAIL_FACTS } = mods['src/content/trailFacts.js'];
  for (const f of FINDS) need(`find ${f.id}`, sayOf1(f));
  for (const j of JUNK) need(`junk ${j.id}`, sayOf1(j));
  for (const w of WISHES) need(`wish ${w.id}`, sayOf1(w));
  for (const f of FISH) need(`fish ${f.id} landing`, sayOf1(f.land));
  for (const b of BAITS) need(`bait ${b.id}`, b.text);
  for (const t of leaves(MOMENTS)) need('MOMENTS line', t);
  for (const [k, t] of Object.entries(DOG_LINES)) need(`DOG_LINES.${k}`, String(t).replace(/\{dog\}/g, 'Frodo'));
  for (const f of TRAIL_FACTS) need(`trail fact ${f.id}`, sayOf1(f));
  for (const q of QUESTS) {
    need(`quest ${q.id} item`, sayOf1(q.item)); need(`quest ${q.id} mailed`, sayOf1(q.mailed));
    for (const st of q.steps || []) need(`quest ${q.id} clue at ${st.at}`, (st.lines || []).join(' '));
    need(`quest ${q.id} owner`, (q.owner.lines || []).join(' '));
  }
  for (const c of COMPANIONS) need(`companion ${c.id} help`, c.lines && c.lines.help);
}
// 5b. the string literals the source hands to the voice (effectToast / toast second argument, say:, app.say, sayWait, a card's text:)
const dynamic = [];
const voiceFiles = [...jsIn('src/ui').filter((f) => !/parentZone/.test(f)), 'src/main.js'];
const LIT = '(`(?:[^`\\\\]|\\\\.)*`|\'(?:[^\'\\\\\\n]|\\\\.)*\')';
const callSites = [
  ['effectToast second argument', new RegExp('effectToast\\(\\s*' + LIT + '\\s*,\\s*' + LIT + '\\s*\\)', 'g'), 2],
  ['toast second argument', new RegExp('\\btoast\\(\\s*' + LIT + '\\s*,\\s*' + LIT + '\\s*\\)', 'g'), 2],
  ['say:', new RegExp('\\bsay:\\s*' + LIT, 'g'), 1],
  ['app.say(', new RegExp('app\\.say\\(\\s*' + LIT + '\\s*\\)', 'g'), 1],
  ['sayWait(', new RegExp('sayWait\\(\\s*' + LIT, 'g'), 1],
  ['showCard / card.show text:', new RegExp('(?:showCard|card\\.show)\\(\\{[^\\n]*?\\btext:\\s*' + LIT, 'g'), 1],
];
let sites = 0;
for (const f of voiceFiles) {
  const src = readFileSync(path.join(root, f), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  for (const [label, re, grp] of callSites) {
    for (const m of src.matchAll(re)) {
      if (/showCard|card\.show/.test(label) && /\bsay:/.test(m[0] + src.slice(m.index + m[0].length, src.indexOf('\n', m.index + m[0].length)))) continue;      // (the card says its `say:`, not its text)
      sites++;
      const lit = m[grp];
      const body = lit.slice(1, -1).replace(/\\(['`\\])/g, '$1');
      if (lit[0] !== '`') { need(`${f} ${label}`, spoken(body)); continue; }
      const literal = body.replace(/\$\{[^}]*\}/g, '');
      if (literal.replace(/\s+/g, '').length < 12) { dynamic.push(`${f} ${label}: ${lit.slice(0, 60)}`); continue; }
      const re2 = new RegExp('^' + regexQuote(body.replace(/\$\{[^}]*\}/g, '\u0000')).replace(/\u0000/g, '.+') + '$');
      if (![...reachable].some((t) => re2.test(t))) missingVoice.push(`${f} ${label}: ${lit.slice(0, 90)}`);
    }
  }
}
// main.js must really prepare this list
const mainSrc = readFileSync(path.join(root, 'src/main.js'), 'utf8');
if (!/collectVoiceTexts\(/.test(mainSrc) || !/prepareBulk\(/.test(mainSrc)) missingVoice.push('src/main.js prepareVoice() does not prepare collectVoiceTexts() through speech.prepareBulk()');
for (const t of allVoiceTexts({ playerName: 'Mia', dogName: 'Frodo' })) need('allVoiceTexts', t);
console.log(`voice coverage: ${reachable.size} prepared lines reachable (a leg's list: ${collectVoiceTexts({ legId: 'fort-kearny', playerName: 'Mia', dogName: 'Frodo' }).ordered.length}), ${sites} call sites read, ${dynamic.length} built at run time and prepared just in time`);
for (const d of dynamic) console.log('  · ' + d);

console.log(`content audit: ${files.length} modules, ${problems} word problems, ${seen} strings checked`);
if (missingVoice.length) {
  console.log(`\n${missingVoice.length} spoken string${missingVoice.length === 1 ? '' : 's'} not reachable by prepareVoice:`);
  for (const m of missingVoice.slice(0, 40)) console.log('  ✗ ' + m);
  process.exit(1);
}
if (hits.length) {
  console.log(`\n${hits.length} banned word${hits.length === 1 ? '' : 's'} found:`);
  for (const h of hits) console.log('  ✗ ' + h);
  process.exit(1);
}
console.log('NO BANNED WORDS IN THE CONTENT; EVERY SPOKEN STRING IS PREPARED OR PREPARED JUST IN TIME');

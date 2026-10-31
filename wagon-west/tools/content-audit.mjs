// Kid-rule text audit of Wagon West's content (SPEC §1): no death, lives, timers, countdowns or "wrong" in anything a child
// reads or hears. Run from the repo root:
//   node wagon-west/tools/content-audit.mjs
// What it walks (every string, at any depth, in every export):
//   1. every module in src/content/*  (cards, companions, events, legs, letters, lookouts, nations, people)
//   2. the kid-facing tables in src/journey/*  (deeds, upgrades, challenge kinds and labels, skills, event payload text)
//   3. every word-problem story problems.js can tell (each kind, a spread of facts and seasons), the work shown after a miss
//   4. the string literals in the source of src/journey/*.js and src/content/*.js (comments skipped), as ui-smoke does for the UI
// The Parent Zone is for grown-ups and is not here. Exit code 1 on any hit.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Source of truth: BANNED in wagon-west/tools/ui-smoke.mjs. That file runs a browser on import, so the list is duplicated
// here; keep the two identical (the self-check below fails if ui-smoke's copy has drifted).
export const BANNED = /\b(kill(s|ed|ing)?|die[sd]?|dying|dead|death|grave|blood|gun|lives|life left|wrong|timer|countdown|hurry|time'?s up|seconds? left|game over|lose|lost|fail(ed)?|dysentery|snakebite|starv(e|ing|ed))\b/i;

const hits = [];
let seen = 0;
const note = (where, s) => { const m = String(s).match(BANNED); if (m) hits.push(`${where}: "${m[0]}" in "${String(s).replace(/\s+/g, ' ').slice(0, 90)}"`); };

/** Walk any value: strings are checked, arrays / objects recursed (cycle-safe), functions skipped. */
function walk(v, where, stack = new Set()) {
  if (typeof v === 'string') { seen++; note(where, v); return; }
  if (!v || typeof v !== 'object' || stack.has(v)) return;
  stack.add(v);
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`, stack));
  else for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`, stack);
  stack.delete(v);
}

// 0. the list must match ui-smoke's
const smoke = readFileSync(path.join(root, 'tools/ui-smoke.mjs'), 'utf8').match(/^const BANNED = (\/.*\/i);/m);
if (!smoke) { console.log('could not find BANNED in tools/ui-smoke.mjs'); process.exit(1); }
if (smoke[1] !== String(BANNED)) { console.log(`the banned list drifted from ui-smoke.mjs:\n  smoke ${smoke[1]}\n  audit ${BANNED}`); process.exit(1); }

const jsIn = (dir) => readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.js')).sort().map((f) => `${dir}/${f}`);
const files = [...jsIn('src/content'), ...jsIn('src/journey')];

// 1 + 2. every export of every module
const mods = {};
for (const f of files) {
  mods[f] = await import(pathToFileURL(path.join(root, f)).href);
  for (const [name, val] of Object.entries(mods[f])) if (typeof val !== 'function') walk(val, `${f}:${name}`);
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
    if (m) lit.push(`${f}: "${m[0]}" in ${s.replace(/\s+/g, ' ').slice(0, 90)}`);
  }
}
// a literal is a hit only if the same text is not already reported from the walk above
for (const h of lit) if (!hits.some((x) => h.includes(x.split(' in ')[1] || '\u0000'))) hits.push(`source ${h}`);

console.log(`content audit: ${files.length} modules, ${problems} word problems, ${seen} strings checked`);
if (hits.length) {
  console.log(`\n${hits.length} banned word${hits.length === 1 ? '' : 's'} found:`);
  for (const h of hits) console.log('  ✗ ' + h);
  process.exit(1);
}
console.log('NO BANNED WORDS IN THE CONTENT');

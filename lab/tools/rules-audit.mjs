// The kid-rule audit (lab/SPEC.md §7.1 "Rules audit"): node lab/tools/rules-audit.mjs [extra file or folder ...]
// Scans every STRING the Lab can show (string and template literals in lab/src/**/*.js, the text of lab/index.html) and every sentence the data
// builds at run time (quest texts, item names, goal texts, the odds table) for:
//   banned words (kill|die|dead|dies|death, lose|lost|expire|expired|missed|failed|fail|timer|countdown|hurry|last chance|ends in|resets in|left today),
//   off-origin links (http:// or https://, but the SVG / XLink namespaces), native inputs outside ui/parent.js (<input|<textarea|<select|contenteditable
//   or createElement('input')), multiple-choice patterns, and rank numerals (1st, 2nd, 3rd, 4th ..., rank, last place).
// Comments and identifiers are not scanned. A game stream extends the audit for its new strings by passing its files or folders on the
// command line, or by adding them to EXTRA_PATHS below (paths from the repo root). Exit code 1 on any hit.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const EXTRA_PATHS = [];            // e.g. 'car-jump/src/meta/labBridge.js', 'car-jump/src/ui/testBoss.js'

export const BANNED = [
  ['violence word', /\b(kill(s|ed|ing)?|die|dies|died|dead|death)\b/i],
  ['loss / pressure word', /\b(lose|loses|losing|lost|expire|expires|expired|missed|failed|fail|fails|timer|countdown|hurry|last chance|ends in|resets in|left today)\b/i],
  ['rank numeral', /\b(1st|2nd|3rd|\d+th)\b|\brank(s|ed|ing)?\b|\blast place\b/i],
  ['multiple choice', /multiple[\s-]?choice/i],
];
const OFF_ORIGIN = /https?:\/\/(?!www\.w3\.org\/(2000\/svg|1999\/xlink)\b)/i;
const NATIVE_INPUT = /<\s*(input|textarea|select)\b|contenteditable|createElement\(\s*['"`](input|textarea|select)\b/i;

/** Strings of a JS source: [{ text, line }] for every '...', "..." and `...` literal (comments are skipped). */
export function jsStrings(src) {
  const out = []; let i = 0, line = 1;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c, start = line; let text = ''; i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\') { text += src[i + 1] === 'n' ? ' ' : src[i + 1]; i += 2; continue; }
        if (src[i] === '\n') { line++; if (q !== '`') break; }
        text += src[i]; i++;
      }
      i++;
      out.push({ text, line: start });
      continue;
    }
    if (c === '/' && /[=(,:;!&|?{}\[]\s*$/.test(src.slice(Math.max(0, i - 3), i))) {          // a regex literal: skip it (words inside patterns are not shown)
      i++; while (i < src.length && src[i] !== '/' && src[i] !== '\n') { if (src[i] === '\\') i++; i++; } i++; continue;
    }
    i++;
  }
  return out;
}
/** The visible text of an HTML page: tags dropped (their text/alt/title/aria-label attributes kept), <script> and <style> bodies skipped. */
export function htmlStrings(src) {
  const out = [];
  const plain = src.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  plain.split('\n').forEach((l, i) => {
    for (const m of l.matchAll(/(?:alt|title|aria-label|placeholder)="([^"]*)"/g)) out.push({ text: m[1], line: i + 1 });
    const t = l.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').trim();
    if (t) out.push({ text: t, line: i + 1 });
  });
  return out;
}

/** Audit a list of { text, where } and return the findings. */
export function auditStrings(items) {
  const hits = [];
  for (const { text, where } of items) {
    if (!text || text.length < 2) continue;
    for (const [what, re] of BANNED) { const m = re.exec(text); if (m) hits.push(`${where}: ${what} "${m[0]}" in "${text.slice(0, 80)}"`); }
    if (OFF_ORIGIN.test(text)) hits.push(`${where}: off-origin link in "${text.slice(0, 80)}"`);
  }
  return hits;
}
export function auditSource(path, src) {
  const rel = relative(ROOT, path);
  const hits = [];
  const isHtml = /\.html?$/.test(path);
  const strs = (isHtml ? htmlStrings(src) : jsStrings(src)).map((s) => ({ text: s.text, where: `${rel}:${s.line}` }));
  hits.push(...auditStrings(strs));
  if (!/ui\/parent\.js$/.test(path.replace(/\\/g, '/'))) {
    const code = isHtml ? src.replace(/<!--[\s\S]*?-->/g, '') : src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const m = NATIVE_INPUT.exec(code);
    if (m) hits.push(`${rel}: native input "${m[0]}" outside ui/parent.js`);
  }
  if (isHtml) for (const m of src.matchAll(/(?:href|src|action)="(https?:\/\/[^"]*)"/g)) if (OFF_ORIGIN.test(m[1])) hits.push(`${rel}: off-origin ${m[1]}`);
  return hits;
}

function walk(p) {
  if (!existsSync(p)) return [];
  if (!statSync(p).isDirectory()) return [p];
  return readdirSync(p).flatMap((f) => walk(join(p, f)));
}
export async function audit(extra = []) {
  const files = [
    ...walk(join(ROOT, 'lab/src')).filter((f) => /\.js$/.test(f)),
    ...['lab/index.html'].map((f) => join(ROOT, f)).filter(existsSync),
    ...[...EXTRA_PATHS, ...extra].flatMap((p) => walk(resolve(ROOT, p))).filter((f) => /\.(js|mjs|html)$/.test(f)),
  ];
  const hits = [];
  for (const f of new Set(files)) hits.push(...auditSource(f, readFileSync(f, 'utf8')));
  // the sentences the data builds at run time
  const { QUESTS } = await import('../src/data/quests.js');
  const { questText, QUEST_BY_ID } = await import('../src/core/quests.js');
  const { voiceTexts } = await import('../src/core/view.js');
  const { crateOddsTable } = await import('../src/core/crate.js');
  const { FAMILY_GOALS } = await import('../src/data/goals.js');
  const { ITEMS } = await import('../src/data/catalog.js');
  const runtime = [];
  for (const q of QUESTS) for (const n of new Set([q.easy, q.mid, q.hard])) for (const g of [false, true]) runtime.push({ text: questText({ id: q.id, target: n }, g), where: `quest ${q.id} (${n})` });
  for (const t of voiceTexts()) runtime.push({ text: t, where: 'voiceTexts' });
  for (const g of FAMILY_GOALS) for (const n of [1, 3, 90, 750]) { runtime.push({ text: g.text.replace('{n}', n), where: `goal ${g.id}` }); runtime.push({ text: g.gentle.replace('{n}', n), where: `goal ${g.id} (gentle)` }); }
  const odds = crateOddsTable(); runtime.push({ text: odds.pity, where: 'odds' }, { text: odds.duplicates, where: 'odds' }, { text: odds.note, where: 'odds' });
  for (const i of ITEMS) runtime.push({ text: `${i.name} ${i.how || ''}`, where: `item ${i.id}` });
  void QUEST_BY_ID;
  hits.push(...auditStrings(runtime));
  return { files: [...new Set(files)].length, runtime: runtime.length, hits };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // the audit must be able to fail: check its own detectors first
  const bad = auditStrings([['You lose 5 coins', 1], ['The timer ends in 3', 1], ['Dead end', 1], ['Rank 1st place', 1], ['see https://example.com', 1], ['Last chance!', 1], ['multiple choice', 1], ['Play and win', 0]].map(([text, n]) => ({ text, where: 'x' + n })));
  if (bad.length < 7 || bad.some((h) => h.startsWith('x0'))) { console.error('rules-audit self-check failed', bad); process.exit(2); }
  const r = await audit(process.argv.slice(2));
  console.log(`rules audit: ${r.files} files, ${r.runtime} generated sentences`);
  if (r.hits.length) { console.log(r.hits.map((h) => '  - ' + h).join('\n')); console.log(`${r.hits.length} finding(s)`); process.exit(1); }
  console.log('clean: no banned words, off-origin links, native inputs, multiple choice or rank numerals');
}

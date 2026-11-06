#!/usr/bin/env node
// Case Files content tests (no dependencies). Run: node case-files/tools/content-tests.mjs
// Validates schema (SPEC §5), id integrity, banned words, word counts, readability (warn only),
// arc target-word encounter counts, facts sources, timeline/question counts, and flags
// possibly ambiguous questions (blind-solve heuristic, warn only).
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { readabilityGrade, countWords, splitSentences } from './content/readability.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// The content files are ES modules inside a repo whose package.json has no "type"; silence Node's reparse notice.
process.removeAllListeners('warning');
const { TRAINING, ARCS, CASE_BY_ID } = await import(pathToFileURL(path.join(here, '../src/content/index.js')).href);

const failures = [];
const warnings = [];
const fail = (cid, msg) => failures.push(`[${cid}] ${msg}`);
const warn = (cid, msg) => warnings.push(`[${cid}] ${msg}`);

const BANNED = /\b(kill|kills|killed|killing|die|dies|died|dying|dead|death|deaths|lost|lives|gun|guns|blood|bloody|weapon|weapons|shoot|shoots|shooting|shot)\b/i;
const TYPES = new Set(['evidence', 'inference', 'word', 'main']);
const STDS = new Set(['4R1', '4R2', '4R3', '4R4']);
const WHO = new Set(['chief', 'partner', 'archivist']);
const KINDS = new Set(['logbook', 'witness', 'letter', 'placard', 'notice', 'note', 'newspaper']);

function strings(o, out = []) {
  if (typeof o === 'string') out.push(o);
  else if (Array.isArray(o)) o.forEach((x) => strings(x, out));
  else if (o && typeof o === 'object') Object.values(o).forEach((x) => strings(x, out));
  return out;
}

function docText(d) { return d.paragraphs.map((p) => p.map((s) => s.text).join(' ')).join('\n'); }

function checkCase(c, isTraining) {
  const id = c.id || '(no id)';
  const req = (cond, msg) => { if (!cond) fail(id, msg); return cond; };

  // ---- shape
  for (const k of ['id', 'arc', 'title', 'setting', 'objective', 'knowledge', 'teaser']) req(typeof c[k] === 'string' && c[k].trim(), `missing string ${k}`);
  req(Number.isInteger(c.order), 'order must be an integer');
  req(Array.isArray(c.facts), 'facts must be an array');
  req(c.closing && WHO.has(c.closing.who) && c.closing.text, 'closing needs who + text');
  req(c.report && Array.isArray(c.report.keywords) && c.report.keywords.length >= 3, 'report.keywords needs 3+ entries');

  // ---- docs
  req(Array.isArray(c.docs), 'docs must be an array');
  const docs = c.docs || [];
  req(isTraining ? docs.length === 2 : docs.length >= 2 && docs.length <= 4, `docs count ${docs.length} out of range`);
  const stretchCount = docs.filter((d) => d.stretch).length;
  if (isTraining) req(stretchCount === 0, 'training should have no stretch doc'); else req(stretchCount === 1, `needs exactly one stretch doc, has ${stretchCount}`);
  const sentences = new Map(); // id -> {text, docId}
  const docIds = new Set();
  for (const d of docs) {
    req(typeof d.id === 'string' && /^d\d+$/.test(d.id), `bad doc id ${d.id}`);
    req(!docIds.has(d.id), `duplicate doc id ${d.id}`); docIds.add(d.id);
    for (const k of ['title', 'from']) req(typeof d[k] === 'string' && d[k].trim(), `doc ${d.id} missing ${k}`);
    req(KINDS.has(d.kind), `doc ${d.id} unknown kind ${d.kind}`);
    req(typeof d.stretch === 'boolean', `doc ${d.id} stretch must be boolean`);
    req(Array.isArray(d.paragraphs) && d.paragraphs.length >= 1, `doc ${d.id} needs paragraphs`);
    for (const p of d.paragraphs || []) {
      req(Array.isArray(p) && p.length >= 1, `doc ${d.id} has an empty paragraph`);
      for (const s of p) {
        req(s && typeof s.id === 'string' && typeof s.text === 'string' && s.text.trim(), `doc ${d.id} bad sentence ${JSON.stringify(s)}`);
        if (!s) continue;
        req(new RegExp(`^${d.id}s\\d+$`).test(s.id), `sentence id ${s.id} does not match ${d.id}s<n>`);
        req(!sentences.has(s.id), `duplicate sentence id ${s.id}`);
        sentences.set(s.id, { text: s.text, docId: d.id });
        const n = countWords(s.text);
        if (n > 45) warn(id, `${s.id} is ${n} words long (tappable sentences should stay short)`);
        if (/[.!?]["')]?\s+[A-Z]/.test(s.text.replace(/\b(Mr|Mrs|Ms|Dr|St)\./g, ''))) warn(id, `${s.id} may hold two sentences: "${s.text.slice(0, 50)}..."`);
      }
    }
  }
  const sid = (x, what) => req(sentences.has(x), `${what} points to missing sentence ${x}`);

  // ---- words
  req(Array.isArray(c.words) && c.words.length >= 2 && c.words.length <= 3, 'words must have 2-3 entries');
  for (const w of c.words || []) {
    req(w.word && w.meaning, `word entry incomplete ${JSON.stringify(w)}`);
    if (sid(w.sentenceId, `word ${w.word}`)) req(sentences.get(w.sentenceId).text.toLowerCase().includes(String(w.word).toLowerCase()), `word "${w.word}" does not appear in ${w.sentenceId}`);
  }

  // ---- briefing
  req(Array.isArray(c.briefing) && c.briefing.length >= 2 && c.briefing.length <= 6, 'briefing must have 2-6 lines');
  for (const b of c.briefing || []) {
    req(WHO.has(b.who) && typeof b.text === 'string' && b.text.trim(), 'bad briefing line');
    if (b.text && countWords(b.text) > 40) warn(id, `briefing line is long: "${b.text.slice(0, 40)}..."`);
  }

  // ---- questions
  const qn = (c.questions || []).length;
  req(isTraining ? qn === 3 : qn >= 4 && qn <= 6, `question count ${qn} out of range`);
  const qids = new Set();
  const typesSeen = new Set();
  for (const q of c.questions || []) {
    req(q.id && !qids.has(q.id), `bad/duplicate question id ${q.id}`); qids.add(q.id);
    req(TYPES.has(q.type), `${q.id} bad type ${q.type}`); typesSeen.add(q.type);
    req(STDS.has(q.std), `${q.id} bad std ${q.std}`);
    for (const k of ['prompt', 'hint', 'model', 'why']) req(typeof q[k] === 'string' && q[k].trim(), `${q.id} missing ${k}`);
    req(Array.isArray(q.answer) && q.answer.length >= 1, `${q.id} needs answer ids`);
    (q.answer || []).forEach((a) => sid(a, `${q.id}.answer`));
    blindSolve(id, q, sentences, c);
  }
  if (!isTraining) for (const t of ['evidence', 'inference', 'word', 'main']) if (!typesSeen.has(t)) warn(id, `no "${t}" question`);

  // ---- timeline
  const t = c.timeline;
  if (req(t && (t.kind === 'sequence' || t.kind === 'cause') && t.prompt && Array.isArray(t.items), 'timeline malformed')) {
    req(isTraining ? t.items.length === 4 : t.items.length >= 5 && t.items.length <= 7, `timeline has ${t.items.length} items`);
    const tids = new Set();
    for (const it of t.items) {
      req(it.id && !tids.has(it.id) && typeof it.text === 'string' && it.text.trim(), `bad timeline item ${JSON.stringify(it)}`); tids.add(it.id);
      sid(it.proof, `timeline ${it.id}`);
    }
    req(Array.isArray(t.given) && t.given.length >= 1 && t.given.length < t.items.length, 'timeline.given must list 1+ pre-placed indexes, fewer than all items');
    req(new Set(t.given).size === (t.given || []).length, 'timeline.given has duplicates');
    for (const g of t.given || []) req(Number.isInteger(g) && g >= 0 && g < t.items.length, `timeline.given index ${g} out of range`);
    if (!isTraining) req((t.given || []).length === 2, 'timeline should give exactly 2 items');
  }

  // ---- solution
  const s = c.solution;
  if (req(s && s.prompt && Array.isArray(s.answers) && s.answers.length >= 1 && Array.isArray(s.proof) && s.proof.length >= 1, 'solution malformed')) {
    s.proof.forEach((p) => sid(p, 'solution.proof'));
    const norm = (x) => x.toLowerCase().replace(/\bthe\b/g, '').replace(/\s+/g, ' ').trim();
    for (const a of s.answers) {
      if (norm(c.title).includes(norm(a)) && norm(a).length > 2) fail(id, `solution answer "${a}" is guessable from the title`);
    }
  }

  // ---- facts
  for (const f of c.facts || []) {
    req(f.claim && /^https?:\/\/\S+$/.test(f.source || ''), `fact needs claim + http(s) source: ${JSON.stringify(f).slice(0, 80)}`);
  }
  if (!isTraining) req((c.facts || []).length >= 2, 'arc case needs at least 2 sourced facts');

  // ---- banned words (every string in the case)
  for (const str of strings(c)) {
    const m = BANNED.exec(str);
    if (m) fail(id, `banned word "${m[0]}" in: "${str.slice(0, 70)}"`);
  }
  // pressure words
  for (const str of strings({ briefing: c.briefing, closing: c.closing, teaser: c.teaser })) {
    if (/\b(hurry|quick(ly)?|countdown|only \d+ left|don't lose)\b/i.test(str)) warn(id, `pressure wording: "${str.slice(0, 60)}"`);
  }

  // ---- word counts and readability
  const per = docs.map((d) => ({ id: d.id, stretch: d.stretch, words: countWords(docText(d)), fk: readabilityGrade(docText(d)) }));
  const total = per.reduce((a, d) => a + d.words, 0);
  const [lo, hi] = isTraining ? [300, 500] : [600, 1200];
  req(total >= lo && total <= hi, `total words ${total} outside ${lo}-${hi}`);
  return { id, title: c.title, total, per };
}

// Blind-solve heuristic: how much does each sentence overlap the question prompt? If a sentence that
// is not keyed overlaps as much as the keyed one, a human should re-read the question.
const STOP = new Set('the a an of to in on at is was were are be it its that this which what who how why when where and or for with as by from his her their he she they i my me we our you your not no do did does has have had so but if then than there here'.split(' '));
function words(s) { return s.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w) && w.length > 2); }
function stem(w) { return w.replace(/(ing|ed|es|s)$/, ''); }
function blindSolve(cid, q, sentences, c) {
  const pw = new Set(words(q.prompt.replace(/^which sentence( in the [a-z' ]+?)?/i, '')).map(stem));
  const score = (text) => words(text).map(stem).filter((w) => pw.has(w)).length;
  const keyScore = Math.max(...q.answer.map((a) => (sentences.get(a) ? score(sentences.get(a).text) : 0)));
  for (const [sidx, v] of sentences) {
    if (q.answer.includes(sidx)) continue;
    const sc = score(v.text);
    if (sc >= 2 && sc > keyScore) warn(cid, `${q.id}: ${sidx} overlaps the prompt more than the key (${sc} vs ${keyScore}); blind-solve by hand: "${v.text.slice(0, 60)}..."`);
  }
}

// ---------- run
const reports = [];
reports.push(checkCase(TRAINING, true));
const seenIds = new Set([TRAINING.id]);
for (const arc of ARCS) {
  if (!(arc.id && arc.title && arc.blurb && Array.isArray(arc.knowledge) && Array.isArray(arc.cases))) fail(arc.id || 'arc', 'arc needs id/title/blurb/knowledge/cases');
  arc.cases.forEach((c, i) => {
    if (seenIds.has(c.id)) fail(c.id, 'duplicate case id'); seenIds.add(c.id);
    if (c.arc !== arc.id) fail(c.id, `arc field ${c.arc} != ${arc.id}`);
    if (c.order !== i + 1) fail(c.id, `order ${c.order} expected ${i + 1}`);
    reports.push(checkCase(c, false));
  });
  if (arc.cases.length !== 5) fail(arc.id, `arc has ${arc.cases.length} cases, expected 5`);
  if (arc.knowledge.length !== arc.cases.length) fail(arc.id, 'arc.knowledge should list one line per case');
  // target words: docs + briefing + closing lines
  const body = arc.cases.map((c) => [...c.docs.map(docText), ...c.briefing.map((b) => b.text), c.closing.text].join('\n')).join('\n');
  const tw = arc.targetWords || [];
  if (tw.length < 8 || tw.length > 10) fail(arc.id, `needs 8-10 target words, has ${tw.length}`);
  console.log(`\nTarget words for arc "${arc.id}" (docs + briefings + closing lines):`);
  for (const w of tw) {
    const re = new RegExp(`\\b(${w.forms.join('|')})\\b`, 'gi');
    const n = (body.match(re) || []).length;
    const perCase = arc.cases.map((c) => {
      const b = [...c.docs.map(docText), ...c.briefing.map((x) => x.text), c.closing.text].join('\n');
      return (b.match(re) || []).length;
    });
    console.log(`  ${w.word.padEnd(10)} ${String(n).padStart(3)}  (per case: ${perCase.join(', ')})`);
    if (n < 12) fail(arc.id, `target word "${w.word}" met only ${n} times (need 12)`);
  }
}
if (Object.keys(CASE_BY_ID).length !== seenIds.size) fail('index', 'CASE_BY_ID is missing cases');

console.log('\nWords and Flesch-Kincaid grade per document (core ~5, stretch higher; warn only):');
for (const r of reports) {
  console.log(`  ${r.id}: ${r.total} words`);
  for (const d of r.per) {
    console.log(`    ${d.id}${d.stretch ? ' (stretch)' : '        '}  ${String(d.words).padStart(4)} words  FK ${d.fk.toFixed(1)}`);
    if (!d.stretch && r.id !== 'training' && d.fk > 7.5) warn(r.id, `${d.id} core doc FK ${d.fk.toFixed(1)} is above ~7`);
    if (d.stretch && d.fk < 6) warn(r.id, `${d.id} stretch doc FK ${d.fk.toFixed(1)} is below 6`);
  }
}

if (warnings.length) { console.log(`\n${warnings.length} warning(s):`); warnings.forEach((w) => console.log('  warn ' + w)); }
if (failures.length) { console.log(`\n${failures.length} FAILURE(S):`); failures.forEach((f) => console.log('  FAIL ' + f)); process.exit(1); }
console.log('\nContent tests passed.');

#!/usr/bin/env node
// Pip's Squirrel Chase content tests (no dependencies). Run: node squirrel-chase/tools/content-tests.mjs
// Checks the content contract in docs/CONTENT-GUIDE.md: schema, routes, clue -> next-city consistency, clue ambiguity,
// fact sources (and that each is listed in docs/SOURCES.md), kid-rule banned words, map coordinates, stops x witnesses,
// leads, city coverage, hideout templates. Readability and long lines are warnings only. Exits 1 on any failure.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readabilityGrade, countWords, splitSentences } from './content/readability.mjs';
import { SIGNATURES, GIVEAWAYS } from './content/signatures.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
process.removeAllListeners('warning'); // the repo package.json has no "type"; silence Node's ES-module reparse notice
const content = await import(pathToFileURL(path.join(here, '../src/content/index.js')).href);
const { CITIES, CASES, GANG, ARCS, HIDEOUT_TEMPLATES, MAP_BOUNDS, toMap } = content;
const sourcesDoc = readFileSync(path.join(here, '../docs/SOURCES.md'), 'utf8');

const failures = [];
const warnings = [];
let checks = 0;
const ok = (cond, where, msg) => { checks++; if (!cond) failures.push(`[${where}] ${msg}`); return !!cond; };
const warn = (where, msg) => warnings.push(`[${where}] ${msg}`);
const str = (v) => typeof v === 'string' && v.trim().length > 0;
const isUrl = (v) => typeof v === 'string' && /^https?:\/\/[^\s]+\.[^\s]+/.test(v);

// Kid rules (SPEC §1 + this task): never in any string.
const BANNED = /\b(kill(s|ed|ing)?|die[sd]?|dying|dead|death|deaths|lost|lives|gun(s)?|blood(y)?|jail(ed)?|arrest(s|ed)?|punish(es|ed|ment)?|steal(s|ing)?|stole(n)?|thie(f|ves)|weapon(s)?|shoot(s|ing)?|prison|cops?)\b/i;
const PRESSURE = /\b(hurry|countdown|quick(ly)?!|time is running out|before it'?s too late|last chance|game over|fail(ed|ure)?)\b/i;
const WHO_BRIEF = new Set(['chief', 'pip', 'wen']);
const GANG_IDS = new Set(GANG.map((g) => g.id));
const CITY = Object.fromEntries(CITIES.map((c) => [c.id, c]));
const CLUE = new Map();

function strings(o, out = [], at = '') {
  if (typeof o === 'string') out.push([at, o]);
  else if (Array.isArray(o)) o.forEach((x, i) => strings(x, out, `${at}[${i}]`));
  else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => strings(v, out, at ? `${at}.${k}` : k));
  return out;
}

// ------------------------------------------------------------------ GANG
ok(Array.isArray(GANG) && GANG.length === 5, 'gang', 'needs exactly 5 members');
ok(GANG.filter((g) => g.role === 'leader').length === 1 && GANG.find((g) => g.role === 'leader')?.id === 'scrabble', 'gang', 'Scrabble is the one leader');
const animals = new Set(GANG.map((g) => g.animal));
for (const a of ['squirrel', 'raccoon', 'crow', 'possum', 'goat']) ok(animals.has(a), 'gang', `missing the ${a}`);
for (const g of GANG) {
  for (const k of ['id', 'name', 'animal', 'pronoun', 'role', 'personality', 'reason', 'catchphrase', 'look', 'apology']) ok(str(g[k]), `gang ${g.id}`, `missing ${k}`);
  ok(g.colour && str(g.colour.name) && /^#[0-9A-Fa-f]{6}$/.test(g.colour.hex || ''), `gang ${g.id}`, 'colour needs name + #rrggbb hex');
}
ok(new Set(GANG.map((g) => g.colour?.hex)).size === GANG.length, 'gang', 'every member needs a different colour');

// ------------------------------------------------------------------ CITIES
ok(Array.isArray(CITIES) && CITIES.length >= 11, 'cities', 'needs the 11 tour cities (+ optional extras)');
for (const need of ['rochester', 'buffalo', 'niagara-falls', 'syracuse', 'albany', 'cooperstown', 'corning', 'lake-placid', 'saratoga-springs', 'ithaca', 'new-york-city']) ok(CITY[need], 'cities', `missing ${need}`);
ok(new Set(CITIES.map((c) => c.id)).size === CITIES.length, 'cities', 'duplicate city id');
for (const c of CITIES) {
  const at = `city ${c.id}`;
  ok(/^[a-z]+(-[a-z]+)*$/.test(c.id), at, 'id must be kebab-case');
  for (const k of ['name', 'sign', 'scene']) ok(str(c[k]), at, `missing ${k}`);
  ok(/^[A-Z ]+$/.test(c.sign || ''), at, `sign "${c.sign}" must be capital letters and spaces only`);
  // coordinates
  const { x, y } = c.coords || {};
  ok(Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1, at, `coords ${JSON.stringify(c.coords)} must be within 0..1`);
  ok(c.latLng && c.latLng.lat > MAP_BOUNDS.south && c.latLng.lat < MAP_BOUNDS.north && c.latLng.lng > MAP_BOUNDS.west && c.latLng.lng < MAP_BOUNDS.east, at, 'latLng outside the map box');
  if (c.latLng) { const p = toMap(c.latLng.lat, c.latLng.lng); ok(Math.abs(p.x - x) < 1e-9 && Math.abs(p.y - y) < 1e-9, at, 'coords do not match toMap(latLng)'); }
  // facts
  ok(Array.isArray(c.facts) && c.facts.length >= 3 && c.facts.length <= 4, at, `needs 3-4 facts, has ${c.facts?.length}`);
  for (const [i, f] of (c.facts || []).entries()) {
    ok(str(f.text), at, `fact ${i} missing text`);
    ok(isUrl(f.source), at, `fact ${i} needs an http(s) source`);
    ok(sourcesDoc.includes(f.source), at, `fact ${i} source not listed in docs/SOURCES.md: ${f.source}`);
  }
  // clues
  ok(Array.isArray(c.clues) && c.clues.length >= 6, at, `needs 6+ clues, has ${c.clues?.length}`);
  for (const k of c.clues || []) {
    const ck = `clue ${k.id}`;
    ok(new RegExp(`^${c.id}-c\\d+$`).test(k.id || ''), ck, `id must look like ${c.id}-c<n>`);
    ok(!CLUE.has(k.id), ck, 'duplicate clue id');
    CLUE.set(k.id, { ...k, city: c.id });
    ok(str(k.text), ck, 'missing text');
    const hasFact = Number.isInteger(k.fact) && c.facts[k.fact];
    ok(hasFact || isUrl(k.source), ck, 'needs `fact` (valid index) or its own http(s) `source`');
    if (!hasFact && isUrl(k.source)) ok(sourcesDoc.includes(k.source), ck, `source not listed in docs/SOURCES.md: ${k.source}`);
    if (hasFact && k.source !== undefined) ok(false, ck, 'give `fact` or `source`, not both');
    for (const [cid, pats] of Object.entries(GIVEAWAYS)) for (const p of pats) ok(!p.test(k.text), ck, `names a city outright (${p}) — clues must not say the place`);
    const own = (SIGNATURES[c.id] || []).some((p) => p.test(k.text));
    ok(own, ck, `does not hit any of ${c.id}'s signature phrases (tools/content/signatures.mjs): "${k.text}"`);
    for (const [cid, pats] of Object.entries(SIGNATURES)) if (cid !== c.id) for (const p of pats) ok(!p.test(k.text), ck, `also matches ${cid}'s signature ${p}: could point to two cities`);
  }
}
ok(Object.keys(SIGNATURES).every((id) => CITY[id]) && CITIES.every((c) => SIGNATURES[c.id] && GIVEAWAYS[c.id]), 'signatures', 'signatures.mjs must list exactly the tour cities');
const clueTexts = [...CLUE.values()].map((k) => k.text.toLowerCase());
ok(new Set(clueTexts).size === clueTexts.length, 'clues', 'two clues have the same text');

// ------------------------------------------------------------------ CASES
ok(Array.isArray(CASES) && CASES.length === 6, 'cases', 'needs exactly 6 cases');
ok(CASES.map((c) => c.id).join() === 'ny-01,ny-02,ny-03,ny-04,ny-05,ny-06', 'cases', 'ids must be ny-01..ny-06 in order');
const usedClues = new Map();
const citiesUsed = new Set();
for (const cs of CASES) {
  const at = cs.id;
  for (const k of ['id', 'arc', 'title', 'lead', 'teaser']) ok(str(cs[k]), at, `missing ${k}`);
  ok(Number.isInteger(cs.order), at, 'order must be an integer');
  ok(GANG_IDS.has(cs.lead), at, `lead ${cs.lead} is not a gang member`);
  ok(Array.isArray(cs.crew) && cs.crew.includes(cs.lead) && cs.crew.every((g) => GANG_IDS.has(g)), at, 'crew must be gang ids and include the lead');
  // briefing
  ok(Array.isArray(cs.briefing) && cs.briefing.length >= 2 && cs.briefing.length <= 4, at, 'briefing needs 2-4 lines');
  for (const b of cs.briefing || []) ok(WHO_BRIEF.has(b.who) && str(b.text), at, `bad briefing line ${JSON.stringify(b)}`);
  ok((cs.briefing || []).some((b) => b.who === 'chief'), at, 'the Chief gives the briefing');
  // route + stops
  const route = cs.route || [];
  ok(route.length >= 3 && route.length <= 4, at, `route needs 3-4 cities, has ${route.length}`);
  ok(new Set(route).size === route.length, at, 'route visits a city twice');
  for (const r of route) { ok(CITY[r], at, `route city ${r} does not exist`); citiesUsed.add(r); }
  ok(Array.isArray(cs.stops) && cs.stops.length === route.length, at, 'one stop per route city');
  for (const [i, st] of (cs.stops || []).entries()) {
    const sat = `${at} stop ${i + 1} (${st.city})`;
    ok(st.city === route[i], sat, `stop city must equal route[${i}] (${route[i]})`);
    ok(Array.isArray(st.witnesses) && st.witnesses.length === 2, sat, 'needs exactly 2 witnesses');
    const last = i === route.length - 1;
    for (const wt of st.witnesses || []) {
      for (const k of ['name', 'role', 'line', 'note']) ok(str(wt[k]), sat, `witness missing ${k}`);
      ok(!/\b(squirrel|raccoon|crow|possum|goat)\b/i.test(wt.role || '') && !GANG.some((g) => g.name === wt.name), sat, `${wt.name}: the gang's animals are never witnesses`);
      if (last) {
        ok(wt.clueId === null, sat, `${wt.name}: at the hideout city the note leads to the hideout, clueId must be null`);
      } else {
        const k = CLUE.get(wt.clueId);
        ok(k, sat, `${wt.name}: unknown clueId ${wt.clueId}`);
        if (k) {
          ok(k.city === route[i + 1], sat, `${wt.name}: clue ${wt.clueId} points to ${k.city}, but the next city is ${route[i + 1]}`);
          ok(wt.note === k.text, sat, `${wt.name}: note must be the clue's text`);
          ok(!usedClues.has(wt.clueId), sat, `clue ${wt.clueId} already used in ${usedClues.get(wt.clueId)}`);
          usedClues.set(wt.clueId, sat);
        }
      }
    }
    if (!last && st.witnesses?.length === 2) ok(st.witnesses[0].clueId !== st.witnesses[1].clueId, sat, 'the two witnesses need different clues');
  }
  // sign
  const sg = cs.sign || {};
  const legs = route.length - 1;
  ok(sg.city === route[0], at, 'the sign must be in the first route city (where the case starts)');
  ok(CITY[sg.city] && sg.text === CITY[sg.city].sign, at, 'sign.text must be that city\'s sign');
  ok(Array.isArray(sg.swiped) && sg.swiped.length >= 3 && new Set(sg.swiped).size === sg.swiped.length, at, 'sign.swiped needs 3+ distinct indexes');
  ok((sg.swiped || []).every((ix) => Number.isInteger(ix) && /[A-Z]/.test(sg.text?.[ix] || '')), at, 'sign.swiped must point at letters');
  ok((sg.swiped || []).map((ix) => sg.text?.[ix]).join('') === sg.letters, at, 'sign.letters must match the swiped positions in order');
  ok(sg.word === null || sg.word === sg.letters, at, 'sign.word is the swiped letters as a word (or null when they are not a word)');
  ok((sg.swiped || []).length > legs, at, `swipe more letters (${sg.swiped?.length}) than travel legs (${legs}) so some come back at the hideout`);
  ok(sg.gaps === [...(sg.text || '')].map((ch, ix) => (sg.swiped.includes(ix) ? '_' : ch)).join(''), at, 'sign.gaps must be text with _ at each swiped index');
  // hideout + postcard
  const ho = cs.hideout || {};
  ok(ho.city === route[route.length - 1], at, 'hideout.city must be the last route city');
  for (const k of ['place', 'description']) ok(str(ho[k]), at, `hideout missing ${k}`);
  ok(Array.isArray(ho.gangLines) && ho.gangLines.length >= 3, at, 'hideout needs 3+ gang lines');
  for (const gl of ho.gangLines || []) ok(cs.crew?.includes(gl.who) && str(gl.text), at, `gang line by ${gl.who} must be a crew member with text`);
  ok((ho.gangLines || []).some((gl) => gl.who === cs.lead && /sorry/i.test(gl.text)), at, 'the lead must say sorry at the hideout');
  const pc = cs.postcard || {};
  ok(pc.city === ho.city, at, 'postcard.city must be the hideout city');
  ok(Array.isArray(pc.facts) && pc.facts.length === 2 && pc.facts[0]?.text !== pc.facts[1]?.text, at, 'postcard needs 2 different facts');
  for (const f of pc.facts || []) ok(CITY[pc.city]?.facts.some((cf) => cf.text === f.text && cf.source === f.source), at, `postcard fact is not in ${pc.city}'s facts: ${f.text}`);
  ok(ARCS.some((a) => a.id === cs.arc && a.cases.includes(cs.id)), at, `arc ${cs.arc} must list this case`);
}
// leads: ny-01..ny-05 all different; Scrabble leads the finale; the goat leads exactly one case
const leads = CASES.map((c) => c.lead);
ok(new Set(leads.slice(0, 5)).size === 5, 'cases', `ny-01..ny-05 need five different leads, got ${leads.slice(0, 5).join(', ')}`);
ok(leads[5] === 'scrabble', 'cases', 'Scrabble leads the finale ny-06');
ok(leads.filter((l) => l === 'bleatrice').length === 1, 'cases', 'the goat leads exactly one case');
ok(new Set(CASES.map((c) => c.sign?.text)).size === CASES.length, 'cases', 'every case hits a different sign');
ok(new Set(CASES.map((c) => c.hideout?.city)).size === CASES.length, 'cases', 'every case has a different hideout city');
for (const c of CITIES) ok(citiesUsed.has(c.id), 'cases', `${c.id} is never visited by any case`);

// ------------------------------------------------------------------ ARCS
ok(Array.isArray(ARCS) && ARCS[0]?.id === 'ny', 'arcs', 'first arc is ny');
const ny = ARCS.find((a) => a.id === 'ny');
ok(ny && str(ny.title) && str(ny.blurb) && ny.cases.join() === CASES.map((c) => c.id).join(), 'arcs', 'ny arc lists ny-01..ny-06 in order');
const usa = ARCS.find((a) => a.id === 'usa');
ok(usa && str(usa.title) && str(usa.blurb) && Array.isArray(usa.cases) && usa.cases.length === 0, 'arcs', 'usa placeholder arc with no cases');

// ------------------------------------------------------------------ HIDEOUT TEMPLATES
ok(Array.isArray(HIDEOUT_TEMPLATES) && HIDEOUT_TEMPLATES.length >= 10, 'templates', 'needs 10 templates');
ok(new Set(HIDEOUT_TEMPLATES.map((t) => t.id)).size === HIDEOUT_TEMPLATES.length, 'templates', 'duplicate template id');
for (const t of HIDEOUT_TEMPLATES) {
  const n = (t.text.match(/\{w\}/g) || []).length;
  ok(n >= 2 && n <= 3, `template ${t.id}`, `needs 2-3 {w} slots, has ${n}`);
  ok(Array.isArray(t.slots) && t.slots.length === n && t.slots.every((s) => s === 'noun' || s === 'any'), `template ${t.id}`, 'slots must list noun|any for each {w}');
  ok(!/\{(?!w\})/.test(t.text), `template ${t.id}`, 'unknown placeholder');
  // a noun slot must follow "the"; an any slot must sit inside quotation marks
  const parts = t.text.split('{w}');
  t.slots?.forEach((s, i) => {
    const before = parts[i];
    if (s === 'noun') ok(/\bthe $/i.test(before), `template ${t.id}`, `noun slot ${i + 1} should follow "the "`);
    else ok(/"$/.test(before), `template ${t.id}`, `any slot ${i + 1} should be inside quotation marks`);
  });
  const filled = t.text.replace(/\{w\}/g, 'apple');
  ok(/^[A-Z].*[.!?]"?$/.test(filled), `template ${t.id}`, 'must be one sentence starting with a capital and ending with . ! or ?');
}
ok(HIDEOUT_TEMPLATES.some((t) => t.slots.every((s) => s === 'any')), 'templates', 'at least one template must accept any words');

// ------------------------------------------------------------------ every string: banned words, no links outside sources, readability
const all = [
  ...strings(GANG, [], 'GANG'), ...strings(CITIES, [], 'CITIES'), ...strings(CASES, [], 'CASES'),
  ...strings(ARCS, [], 'ARCS'), ...strings(HIDEOUT_TEMPLATES, [], 'TEMPLATES'),
];
for (const [at, s] of all) {
  const isSource = /\.source$/.test(at);
  if (!isSource) {
    const m = s.match(BANNED);
    ok(!m, at, `kid rule: banned word "${m?.[0]}" in "${s}"`);
    ok(!/https?:\/\/|www\./i.test(s), at, 'no links in kid-facing text');
    const pm = s.match(PRESSURE);
    ok(!pm, at, `kid rule: pressure word "${pm?.[0]}" in "${s}"`);
  }
}
// readability (warn only): text the child reads
const readable = all.filter(([at]) => /(facts\[\d+\]\.text|clues\[\d+\]\.text|briefing\[\d+\]\.text|witnesses\[\d+\]\.(line|note)|gangLines\[\d+\]\.text|\.description|\.teaser|\.blurb|\.place)$/.test(at));
let longest = 0;
const seen = new Set(); // postcards and travel notes copy facts and clues; warn once per text
for (const [at, s] of readable) {
  if (seen.has(s)) continue;
  seen.add(s);
  for (const sent of splitSentences(s)) {
    const n = countWords(sent);
    longest = Math.max(longest, n);
    if (n > 20) warn(at, `long sentence (${n} words): "${sent}"`);
  }
  const g = readabilityGrade(s);
  if (countWords(s) >= 8 && g > 7) warn(at, `reads at about grade ${g.toFixed(1)}: "${s}"`);
}
const allText = readable.map(([, s]) => s).join(' ');

// ------------------------------------------------------------------ report
const factCount = CITIES.reduce((a, c) => a + c.facts.length, 0);
const clueCount = CLUE.size;
console.log(`Squirrel Chase content: ${CITIES.length} cities, ${factCount} facts, ${clueCount} clues, ${CASES.length} cases, ${CASES.reduce((a, c) => a + c.stops.length * 2, 0)} witnesses, ${HIDEOUT_TEMPLATES.length} templates.`);
console.log(`Readable text: about grade ${readabilityGrade(allText).toFixed(1)} overall; longest sentence ${longest} words.`);
for (const wmsg of warnings) console.log(`  warn ${wmsg}`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL ${f}`);
  console.log(`${failures.length} failure(s) in ${checks} checks.`);
  process.exit(1);
}
console.log(`All ${checks} checks passed${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`);

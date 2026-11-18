#!/usr/bin/env node
// Pip's Squirrel Chase content tests (no dependencies). Run: node squirrel-chase/tools/content-tests.mjs
// Checks the content contract in docs/CONTENT-GUIDE.md: schema, routes, clue -> next-city consistency, clue ambiguity,
// fact sources (and that each is listed in docs/SOURCES.md), kid-rule banned words, map coordinates, stops x witnesses,
// leads, city coverage, hideout templates, and the USA Tour (arc map, usCoords on every usa-route city, Chief's running gag,
// finale). Readability and long lines are warnings only. Exits 1 on any failure.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readabilityGrade, countWords, splitSentences } from './content/readability.mjs';
import { SIGNATURES, GIVEAWAYS } from './content/signatures.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
process.removeAllListeners('warning'); // the repo package.json has no "type"; silence Node's ES-module reparse notice
const content = await import(pathToFileURL(path.join(here, '../src/content/index.js')).href);
const { CITIES, CASES, GANG, ARCS, HIDEOUT_TEMPLATES, MAP_BOUNDS, toMap, US_MAP_BOUNDS, toUsMap } = content;
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
// Each tour (arc) is the set of cities its cases visit. A clue only has to be unambiguous among the cities of its own tour
// (the corridor Boston / New York City / Philadelphia / Washington is checked in the USA tour); New York City is on both.
const TOUR = {};
for (const cs of CASES) { TOUR[cs.arc] ||= new Set(); for (const r of cs.route) TOUR[cs.arc].add(r); }
const rivals = (id) => new Set(Object.values(TOUR).filter((t) => t.has(id)).flatMap((t) => [...t]).filter((x) => x !== id));

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
ok(Array.isArray(CITIES) && CITIES.length >= 22, 'cities', 'needs the 11 New York tour cities + the 11 new USA cities (+ optional extras)');
for (const need of ['rochester', 'buffalo', 'niagara-falls', 'syracuse', 'albany', 'cooperstown', 'corning', 'lake-placid', 'saratoga-springs', 'ithaca', 'new-york-city',
  'boston', 'philadelphia', 'washington-dc', 'cape-canaveral', 'new-orleans', 'san-antonio', 'st-louis', 'chicago', 'denver', 'seattle', 'san-francisco']) ok(CITY[need], 'cities', `missing ${need}`);
ok(new Set(CITIES.map((c) => c.id)).size === CITIES.length, 'cities', 'duplicate city id');
for (const c of CITIES) {
  const at = `city ${c.id}`;
  ok(/^[a-z]+(-[a-z]+)*$/.test(c.id), at, 'id must be kebab-case');
  for (const k of ['name', 'sign', 'scene']) ok(str(c[k]), at, `missing ${k}`);
  ok(/^[A-Z ]+$/.test(c.sign || ''), at, `sign "${c.sign}" must be capital letters and spaces only`);
  // coordinates: NY cities sit on the New York map box; the USA-only cities have coords: null. Every city a usa case uses has usCoords.
  if (c.coords === null) {
    ok(c.usCoords, at, 'a city without NY coords (coords: null) needs usCoords');
  } else {
    const { x, y } = c.coords || {};
    ok(Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1, at, `coords ${JSON.stringify(c.coords)} must be within 0..1`);
    ok(c.latLng && c.latLng.lat > MAP_BOUNDS.south && c.latLng.lat < MAP_BOUNDS.north && c.latLng.lng > MAP_BOUNDS.west && c.latLng.lng < MAP_BOUNDS.east, at, 'latLng outside the NY map box');
    if (c.latLng) { const p = toMap(c.latLng.lat, c.latLng.lng); ok(Math.abs(p.x - x) < 1e-9 && Math.abs(p.y - y) < 1e-9, at, 'coords do not match toMap(latLng)'); }
  }
  if (c.usCoords !== undefined) {
    const u = c.usCoords || {};
    ok(Number.isFinite(u.x) && Number.isFinite(u.y) && u.x >= 0 && u.x <= 1 && u.y >= 0 && u.y <= 1, at, `usCoords ${JSON.stringify(c.usCoords)} must be within 0..1`);
    ok(c.latLng.lat > US_MAP_BOUNDS.south && c.latLng.lat < US_MAP_BOUNDS.north && c.latLng.lng > US_MAP_BOUNDS.west && c.latLng.lng < US_MAP_BOUNDS.east, at, 'latLng outside the USA map box');
    const p = toUsMap(c.latLng.lat, c.latLng.lng);
    ok(Math.abs(p.x - u.x) < 1e-9 && Math.abs(p.y - u.y) < 1e-9, at, 'usCoords do not match toUsMap(latLng)');
  }
  ok(c.altSigns === undefined || (Array.isArray(c.altSigns) && c.altSigns.every((t) => /^[A-Z ]+$/.test(t))), at, 'altSigns must be capital letters and spaces');
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
    for (const cid of [c.id, ...rivals(c.id)]) for (const p of GIVEAWAYS[cid] || []) ok(!p.test(k.text), ck, `names a city outright (${p}) — clues must not say the place`);
    const own = (SIGNATURES[c.id] || []).some((p) => p.test(k.text));
    ok(own, ck, `does not hit any of ${c.id}'s signature phrases (tools/content/signatures.mjs): "${k.text}"`);
    for (const cid of rivals(c.id)) for (const p of SIGNATURES[cid] || []) ok(!p.test(k.text), ck, `also matches ${cid}'s signature ${p}: could point to two cities`);
  }
}
ok(Object.keys(SIGNATURES).every((id) => CITY[id]) && CITIES.every((c) => SIGNATURES[c.id] && GIVEAWAYS[c.id]), 'signatures', 'signatures.mjs must list exactly the tour cities');
const clueTexts = [...CLUE.values()].map((k) => k.text.toLowerCase());
ok(new Set(clueTexts).size === clueTexts.length, 'clues', 'two clues have the same text');

// ------------------------------------------------------------------ CASES
ok(Array.isArray(CASES) && CASES.length === 12, 'cases', 'needs exactly 12 cases (6 New York + 6 USA)');
ok(CASES.map((c) => c.id).join() === 'ny-01,ny-02,ny-03,ny-04,ny-05,ny-06,usa-01,usa-02,usa-03,usa-04,usa-05,usa-06', 'cases', 'ids must be ny-01..ny-06 then usa-01..usa-06 in order');
ok(CASES.every((c) => c.order === Number(c.id.slice(-2))), 'cases', 'order must match the number in the id');
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
  for (const r of route) {
    ok(CITY[r], at, `route city ${r} does not exist`);
    citiesUsed.add(r);
    // the map that draws this case needs the city's coordinates (usa: usCoords on every route city; ny: NY coords, never null)
    const arcDef = ARCS.find((a) => a.id === cs.arc);
    if (arcDef?.map === 'usa') ok(CITY[r]?.usCoords && Number.isFinite(CITY[r].usCoords.x), at, `${r} needs usCoords to be drawn on the USA map`);
    else ok(CITY[r]?.coords && Number.isFinite(CITY[r].coords.x), at, `${r} needs NY coords to be drawn on the New York map`);
  }
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
  ok(CITY[sg.city] && (sg.text === CITY[sg.city].sign || (CITY[sg.city].altSigns || []).includes(sg.text)), at, 'sign.text must be that city\'s sign (or one of its altSigns)');
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
// leads: in each tour the first five cases have five different leads, Scrabble leads the finale, the goat leads exactly one case
for (const arcId of ['ny', 'usa']) {
  const cs6 = CASES.filter((c) => c.arc === arcId);
  const leads = cs6.map((c) => c.lead);
  ok(cs6.length === 6, `cases ${arcId}`, `${arcId} needs 6 cases`);
  ok(new Set(leads.slice(0, 5)).size === 5, `cases ${arcId}`, `${arcId}-01..05 need five different leads, got ${leads.slice(0, 5).join(', ')}`);
  ok(leads[5] === 'scrabble', `cases ${arcId}`, `Scrabble leads the ${arcId} finale`);
  ok(leads.filter((l) => l === 'bleatrice').length === 1, `cases ${arcId}`, 'the goat leads exactly one case');
  ok(cs6[5]?.crew.length === 5, `cases ${arcId}`, `the ${arcId} finale has the whole gang`);
}
ok(new Set(CASES.map((c) => c.sign?.text)).size === CASES.length, 'cases', 'every case hits a different sign');
ok(new Set(CASES.map((c) => c.hideout?.city)).size === CASES.length, 'cases', 'every case has a different hideout city');
ok(new Set(CASES.map((c) => c.title)).size === CASES.length, 'cases', 'every case has its own title');
// USA tour specifics: starts in New York City, finale comes home to New York City, every tour city is visited
const usaCases = CASES.filter((c) => c.arc === 'usa');
ok(usaCases[0]?.route[0] === 'new-york-city', 'usa', 'the USA tour starts in New York City');
ok(usaCases[5]?.hideout.city === 'new-york-city' && usaCases[5]?.route.at(-1) === 'new-york-city', 'usa', 'the USA finale comes home to New York City');
for (const id of ['new-york-city', 'boston', 'philadelphia', 'washington-dc', 'cape-canaveral', 'new-orleans', 'san-antonio', 'st-louis', 'chicago', 'denver', 'seattle', 'san-francisco']) ok(TOUR.usa?.has(id), 'usa', `${id} is not on any usa route`);
ok(TOUR.usa?.size === 12, 'usa', `the USA tour visits exactly its 12 cities, got ${TOUR.usa?.size}`);
for (const id of [...(TOUR.usa || [])]) ok(CITY[id]?.usCoords, 'usa', `${id} (on a usa route) needs usCoords`);
for (const c of CITIES) if (!TOUR.ny.has(c.id)) ok(c.coords === null, `city ${c.id}`, 'cities that are not on a New York route have coords: null');
// every usa-route clue that points at a city is aimed at the next stop; at least one hop crosses the country (needs a plane)
const hop = (a, b) => Math.hypot(CITY[a].latLng.lat - CITY[b].latLng.lat, CITY[a].latLng.lng - CITY[b].latLng.lng);
ok(usaCases.some((c) => c.route.some((r, i) => i > 0 && hop(c.route[i - 1], r) > 15)), 'usa', 'the tour should include a cross-country hop');
// Chief's running gag: a wrong gang name in every briefing except each tour's finale, where he gets it right; names never repeat
const wrongNames = [];
for (const arcId of ['ny', 'usa']) {
  CASES.filter((c) => c.arc === arcId).forEach((cs, i, all) => {
    const chief = cs.briefing.filter((b) => b.who === 'chief').map((b) => b.text).join(' ');
    const m = chief.match(/\b(?:the |The )?([A-Z][a-z]+) Gang\b/);
    if (i < all.length - 1) {
      ok(m && m[1] !== 'Scribble', cs.id, `the Chief gets the gang's name wrong in the briefing (found ${m?.[1]})`);
      ok(cs.briefing.some((b) => b.who === 'pip' && /Scribble/.test(b.text)), cs.id, 'Pip corrects him: Scribble');
      if (m) wrongNames.push(m[1]);
    } else {
      ok(m && m[1] === 'Scribble', cs.id, 'in the finale the Chief says Scribble Gang correctly');
    }
  });
}
ok(new Set(wrongNames).size === wrongNames.length, 'cases', `the Chief's wrong names must be new every time: ${wrongNames.join(', ')}`);
for (const c of CITIES) ok(citiesUsed.has(c.id), 'cases', `${c.id} is never visited by any case`);

// ------------------------------------------------------------------ ARCS
ok(Array.isArray(ARCS) && ARCS.map((a) => a.id).join() === 'ny,usa', 'arcs', 'arcs are ny, usa in order');
const ny = ARCS.find((a) => a.id === 'ny');
ok(ny && ny.map === 'ny' && str(ny.title) && str(ny.blurb) && ny.cases.join() === CASES.filter((c) => c.arc === 'ny').map((c) => c.id).join() && ny.cases.length === 6, 'arcs', 'ny arc (map ny) lists ny-01..ny-06 in order');
const usa = ARCS.find((a) => a.id === 'usa');
ok(usa && usa.map === 'usa' && str(usa.title) && str(usa.blurb) && usa.cases.join() === 'usa-01,usa-02,usa-03,usa-04,usa-05,usa-06', 'arcs', 'usa arc (map usa) lists usa-01..usa-06 in order');
ok(CASES.every((c) => ARCS.find((a) => a.id === c.arc)?.cases.includes(c.id)), 'arcs', 'every case belongs to its arc');
ok(/^## USA Tour$/m.test(sourcesDoc), 'sources', 'docs/SOURCES.md needs a "USA Tour" section');
for (const c of CITIES.filter((x) => x.usCoords && !TOUR.ny.has(x.id))) ok(new RegExp(`^### ${c.name.replace(/[.]/g, '\\.')}$`, 'm').test(sourcesDoc), 'sources', `docs/SOURCES.md needs a "### ${c.name}" heading`);

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

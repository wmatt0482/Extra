// The trail map (SPEC §12; v1.5 §5.1): one inline SVG drawn from the legs' `map` points (a 1000 × 600 box, east on the right, Independence at
// [940, 330]). It draws EVERY way: the emigrant trunk, the three forks (each option as its own line: the South Pass ways, Oregon or California at
// Fort Hall, the raft or the Barlow Road at The Dalles), the Gold Road south from the Willamette farm to Coloma, and the voyage home as a dotted
// line up the coast. Lines already travelled (the ledger's journeys, and the journey in progress up to the wagon) are inked in the wagon's paint
// colour (on a dark outline, so a pale canvas shows on the paper); the lines not yet travelled are faint and dashed but always visible: the choice
// is never hidden. A way that is not open yet (the Lander Road before 1858) has a small lock and its year. The two farms stand at their
// `map` points as a small tent, cabin, farm with a barn or a full farm that grows with homesteadView().built; a tap opens the homestead. The
// family's other wagons are small wagons in their own colour (a tap says whose). Pure drawing: no state of its own.
//   drawMap(svg, { J, inLeg, paint, labels: 'next' | 'all', stickers, family, onFamily, ledger, farm, onFarm, year, pending })
//   → { next: { name, id } | null, at: { legsDone, p }, edges, travelled }
import { ALL_LEGS, LEG_BY_ID } from '../content/legs.js';
import { ROUTES, FORKS, SITES } from '../content/routes.js';
import { planRoute } from '../journey/route.js';

const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  for (const k of kids) if (k != null) e.append(typeof k === 'string' ? document.createTextNode(k) : k);
  return e;
}

export const VIEWBOX = [20, 50, 960, 460];            // x, y, w, h: the part of the 1000 × 600 box the routes use
const START = { emigrant: 'independence', 'gold-road': 'farm-willamette' };

/** The point of a stop on the map: a leg's `map`, or a route's start. */
export function pointOf(id) {
  if (id === 'independence') return ROUTES.emigrant.start.map;
  if (id === 'farm-willamette') return ROUTES['gold-road'].start.map;
  const l = LEG_BY_ID[id];
  return l && l.map ? l.map : null;
}
const nameOf = (id) => {
  if (id === 'independence') return ROUTES.emigrant.start.name.split(',')[0];
  if (id === 'farm-willamette') return 'Your farm';
  const l = LEG_BY_ID[id];
  return l ? (l.stop && l.stop.name) || l.name : id;
};
const kindOf = (id) => {
  if (id === 'independence') return 'start';
  if (id === 'farm-willamette') return 'start';
  const l = LEG_BY_ID[id];
  return (l && l.stop && l.stop.kind) || 'landmark';
};

// every plan the routes can make (3 × 2 × 2 emigrant plans and the Gold Road) → the edges of the map: [from, to]
let EDGE_CACHE = null;
function allEdges() {
  if (EDGE_CACHE) return EDGE_CACHE;
  const seen = new Map();
  const add = (route, force) => {
    const plan = planRoute(route, {}, { year: 3000, journeyN: 99, force });
    let prev = START[route];
    for (const p of plan) { const k = `${prev}>${p.id}`; if (!seen.has(k)) seen.set(k, { from: prev, to: p.id, route }); prev = p.id; }
  };
  for (const sp of FORKS['south-pass'].options) for (const fh of FORKS['fort-hall'].options) for (const td of FORKS['the-dalles'].options) add('emigrant', { 'south-pass': sp.id, 'fort-hall': fh.id, 'the-dalles': td.id });
  add('gold-road', {});
  EDGE_CACHE = [...seen.values()];
  return EDGE_CACHE;
}
/** The edges (a Set of 'a>b') one journey travelled: from the route and the forks it took. */
export function edgesOfJourney(route, branches, ctx = {}) {
  const out = new Set();
  const plan = planRoute(route || 'emigrant', branches || {}, ctx);
  let prev = START[route || 'emigrant'] || START.emigrant;
  for (const p of plan) { out.add(`${prev}>${p.id}`); prev = p.id; }
  return out;
}

function stopMark(id, reached, next) {
  const [x, y] = pointOf(id) || [0, 0];
  const kind = kindOf(id);
  const fill = reached ? '#7a4a24' : '#fff6e0', stroke = next ? '#d9653b' : '#7a4a24';
  const g = el('g', { class: `map-stop k-${kind}${reached ? ' reached' : ''}${next ? ' next' : ''}`, 'data-leg': id });
  const r = next ? 15 : 11;
  if (kind === 'fort') g.append(el('rect', { x: x - r, y: y - r, width: r * 2, height: r * 2, rx: 3, fill, stroke, 'stroke-width': 4 }));
  else if (kind === 'river') g.append(el('circle', { cx: x, cy: y, r, fill: reached ? '#3f86ad' : '#d8eef7', stroke: next ? '#d9653b' : '#3f86ad', 'stroke-width': 4 }));
  else if (kind === 'home') g.append(el('path', { d: `M${x - r} ${y + r}V${y - 2}L${x} ${y - r - 4}L${x + r} ${y - 2}V${y + r}Z`, fill, stroke, 'stroke-width': 4, 'stroke-linejoin': 'round' }));
  else if (kind === 'start') g.append(el('circle', { cx: x, cy: y, r: 8, fill: '#7a4a24', stroke: '#7a4a24', 'stroke-width': 3 }));
  else if (kind === 'gold') g.append(el('path', { d: `M${x} ${y - r - 3}L${x + r} ${y}L${x} ${y + r + 3}L${x - r} ${y}Z`, fill: reached ? '#e8b33a' : '#fff6e0', stroke: next ? '#d9653b' : '#a8740f', 'stroke-width': 4, 'stroke-linejoin': 'round' }));
  else {
    const s = r + 3, d = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? s * 0.45 : s; d.push(`${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`); }
    g.append(el('path', { d: `M${d.join('L')}Z`, fill: reached ? '#e8b33a' : '#fff6e0', stroke, 'stroke-width': 3, 'stroke-linejoin': 'round' }));
  }
  return g;
}

/** A tiny covered wagon centred on (x, y). */
function wagonMark(x, y, paint = '#f3ead7') {
  return el('g', { class: 'map-wagon', transform: `translate(${x.toFixed(1)} ${(y - 26).toFixed(1)}) scale(1.05)` },
    el('ellipse', { cx: 0, cy: 26, rx: 30, ry: 5, fill: 'rgba(60,35,15,.25)' }),
    el('rect', { x: -22, y: 6, width: 44, height: 10, rx: 2, fill: '#6b4426' }),
    el('path', { d: 'M-21 7 Q0 -26 21 7Z', fill: paint, stroke: '#6b4426', 'stroke-width': 3 }),
    el('circle', { cx: -13, cy: 18, r: 7, fill: '#fff6e0', stroke: '#4a2c16', 'stroke-width': 3 }),
    el('circle', { cx: 13, cy: 18, r: 7, fill: '#fff6e0', stroke: '#4a2c16', 'stroke-width': 3 }));
}
/** A small family wagon (one of the other players) at (x, y), in their colour; a roomy transparent hit area for a finger. */
function famWagon(x, y, color, id, dog = false) {
  const g = el('g', { class: 'map-fam', 'data-player': id, 'data-dog': dog ? '1' : '0', role: 'button', tabindex: 0, 'aria-label': dog ? 'A wagon from your family, with a dog. Tap to see whose.' : 'A wagon from your family. Tap to see whose.', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` });
  g.append(el('circle', { class: 'fam-hit', cx: 0, cy: 0, r: 30, fill: 'transparent', stroke: 'none' }),
    el('ellipse', { cx: 0, cy: 12, rx: 17, ry: 3, fill: 'rgba(60,35,15,.25)' }),
    el('rect', { x: -12, y: 2, width: 24, height: 6, rx: 1.5, fill: '#6b4426' }),
    el('path', { d: 'M-11.5 3 Q0 -15 11.5 3Z', fill: color || '#f3ead7', stroke: '#4a2c16', 'stroke-width': 2 }),
    el('circle', { cx: -7, cy: 10, r: 4, fill: '#fff6e0', stroke: '#4a2c16', 'stroke-width': 2 }),
    el('circle', { cx: 7, cy: 10, r: 4, fill: '#fff6e0', stroke: '#4a2c16', 'stroke-width': 2 }));
  if (dog) g.append(el('text', { class: 'fam-dog', x: 17, y: 12, 'font-size': 15, 'aria-hidden': 'true' }, '🐕'));      // (v1.4: a small dog beside a wagon whose journey has one)
  return g;
}

/** How built a farm is, 0 (a tent) … 3 (a full farm): from homesteadView().built / of and the pieces. */
export function farmStage(site) {
  const pieces = (site && site.pieces) || {};
  const n = Object.keys(pieces).filter((id) => id !== 'trophy-shelf').length;
  if (!pieces.cabin) return 0;
  if (pieces.barn && pieces['frame-house']) return 3;
  if (pieces.barn) return 2;
  return n >= 1 ? 1 : 1;
}
/** A farm glyph at its point: a tent, a cabin, a farm with a barn, a full farm (a frame house, a barn, a fence); a roomy hit area. */
function farmMark(siteId, site, onFarm) {
  const [x, y] = (SITES.find((s) => s.id === siteId) || {}).map || [0, 0];
  const stage = farmStage(site);
  const g = el('g', { class: `map-farm stage-${stage}`, 'data-site': siteId, 'data-stage': String(stage), role: 'button', tabindex: 0, 'aria-label': `${(site && site.name) || 'Your farm'}: tap to visit` });
  g.append(el('circle', { class: 'farm-hit', cx: x, cy: y, r: 30, fill: 'transparent', stroke: 'none' }));
  g.append(el('ellipse', { cx: x, cy: y + 14, rx: 26, ry: 6, fill: 'rgba(60,35,15,.22)' }));
  if (stage === 0) g.append(el('path', { d: `M${x - 14} ${y + 12}L${x} ${y - 14}L${x + 14} ${y + 12}Z`, fill: '#f3ead7', stroke: '#6b4426', 'stroke-width': 3, 'stroke-linejoin': 'round' }), el('path', { d: `M${x + 18} ${y + 12}q4-8 0-12q6 4 4 12z`, fill: '#d9653b' }));
  else {
    const body = stage === 3 ? '#e9d8b4' : '#a8744a';
    g.append(el('rect', { x: x - 14, y: y - 4, width: 28, height: 17, rx: 2, fill: body, stroke: '#4a2c16', 'stroke-width': 3 }),
      el('path', { d: `M${x - 18} ${y - 3}L${x} ${y - 19}L${x + 18} ${y - 3}Z`, fill: stage === 3 ? '#b8553a' : '#7a4a24', stroke: '#4a2c16', 'stroke-width': 3, 'stroke-linejoin': 'round' }),
      el('rect', { x: x - 3, y: y + 3, width: 6, height: 10, fill: '#4a2c16' }));
    if (stage >= 2) g.append(el('rect', { x: x + 18, y: y - 2, width: 16, height: 15, rx: 2, fill: '#b8553a', stroke: '#4a2c16', 'stroke-width': 3 }), el('path', { d: `M${x + 16} ${y - 1}L${x + 26} ${y - 11}L${x + 36} ${y - 1}Z`, fill: '#7a4a24', stroke: '#4a2c16', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
    if (stage === 3) g.append(el('path', { d: `M${x - 40} ${y + 14}H${x - 20}M${x - 40} ${y + 8}H${x - 20}M${x - 36} ${y + 5}V${y + 17}M${x - 26} ${y + 5}V${y + 17}`, stroke: '#6b4426', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }));
  }
  const tap = () => { if (typeof onFarm === 'function') onFarm(siteId); };
  g.addEventListener('click', tap);
  g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } });
  return g;
}

/** The party's point on the map: a leg's start is the stop before it in the journey's plan (the route's start for the first leg). */
export function partyPoint(J, { inLeg = false } = {}) {
  if (!J) return { x: pointOf('independence')[0], y: pointOf('independence')[1], legsDone: 0, p: 0 };
  const plan = Array.isArray(J.plan) && J.plan.length ? J.plan : null;
  const i = Math.max(0, Number(J.legIndex) || 0);
  const route = J.route || 'emigrant';
  const ids = plan ? plan.map((p) => p.id) : [];
  if (J.done) { const last = ids[ids.length - 1]; const pt = (last && pointOf(last)) || pointOf(START[route]); return { x: pt[0], y: pt[1], legsDone: ids.length, p: 0 }; }
  const fromId = i > 0 ? ids[i - 1] : START[route] || 'independence';
  const toId = ids[i] || J.legId;
  const a = pointOf(fromId) || pointOf('independence'), b = pointOf(toId) || a;
  const leg = LEG_BY_ID[toId] || {};
  const miles = (plan && plan[i] && plan[i].miles) || leg.miles || 1;
  const p = inLeg && miles ? Math.max(0, Math.min(1, (Number(J.milesDone) || 0) / miles)) : 0;
  return { x: a[0] + (b[0] - a[0]) * p, y: a[1] + (b[1] - a[1]) * p, legsDone: i, p, fromId, toId };
}

export function drawMap(svg, { J = null, inLeg = false, paint, labels = 'next', stickers = [], family = [], onFamily = null, ledger = null, farm = null, onFarm = null, year = 1847, pending = null } = {}) {
  svg.setAttribute('viewBox', VIEWBOX.join(' '));
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const kids = [];
  kids.push(el('rect', { x: VIEWBOX[0], y: VIEWBOX[1], width: VIEWBOX[2], height: VIEWBOX[3], rx: 22, fill: '#f6e7c4', class: 'map-paper' }));
  // the coast far west, the mountains, a river or two (decoration)
  kids.push(el('path', { d: 'M20 50H46C34 150 56 250 34 330C22 400 50 460 38 510H20Z', fill: '#cfe6ee', opacity: '.85' }));
  kids.push(el('path', { d: 'M330 120 L372 76 L410 120 L450 70 L494 124 Z M600 150 L640 106 L682 150 Z M262 300 L300 252 L340 300 Z', fill: '#d9c39a', opacity: '.55' }));
  kids.push(el('path', { d: 'M80 470 C 200 450, 300 490, 470 462 S 760 468, 930 452', fill: 'none', stroke: '#b9d9e6', 'stroke-width': 8, 'stroke-linecap': 'round', opacity: '.7' }));
  // the edges: every way, faint; the travelled ones inked
  const travelled = new Set();
  const L = ledger || { journeys: [] };
  for (const j of Array.isArray(L.journeys) ? L.journeys : []) {
    try { for (const e of edgesOfJourney(j.route, j.branches, { year: j.year, journeyN: j.journeyN })) travelled.add(e); } catch (_) { /* a journey from an unknown route */ }
  }
  const plan = J && Array.isArray(J.plan) ? J.plan : [];
  const at = partyPoint(J, { inLeg });
  const nowEdges = new Set();
  if (J && plan.length) {
    let prev = START[J.route || 'emigrant'] || 'independence';
    plan.forEach((p, i) => { const k = `${prev}>${p.id}`; if (i < at.legsDone || J.done) travelled.add(k); else if (i === at.legsDone) nowEdges.add(k); prev = p.id; });
  }
  const pos = (id) => pointOf(id);
  const lineD = (e) => {
    const a = pos(e.from), b = pos(e.to);
    if (!a || !b) return null;
    if (LEG_BY_ID[e.to] && LEG_BY_ID[e.to].voyage) { const mx = Math.min(a[0], b[0]) - 60, my = (a[1] + b[1]) / 2; return `M${a[0]} ${a[1]}Q${mx} ${my} ${b[0]} ${b[1]}`; }
    const mx = (a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.08, my = (a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.08;
    return `M${a[0]} ${a[1]}Q${mx.toFixed(1)} ${my.toFixed(1)} ${b[0]} ${b[1]}`;
  };
  const lockedLeg = (id) => { const l = LEG_BY_ID[id]; return !!(l && l.fromYear && year < l.fromYear); };
  const edges = allEdges().slice();
  // a journey on a plan the routes do not make (a 1.3 journey in progress keeps its twelve legs) draws its own edges too
  if (J && plan.length) { let prev = START[J.route || 'emigrant'] || 'independence'; for (const p of plan) { if (!edges.some((e) => e.from === prev && e.to === p.id)) edges.push({ from: prev, to: p.id, route: J.route || 'emigrant' }); prev = p.id; } }
  for (const e of edges) {
    const d = lineD(e);
    if (!d) continue;
    const voyage = !!(LEG_BY_ID[e.to] && LEG_BY_ID[e.to].voyage);
    const locked = lockedLeg(e.to);
    const k = `${e.from}>${e.to}`;
    kids.push(el('path', { d, fill: 'none', stroke: locked ? '#b8a584' : '#9a7a52', 'stroke-width': 5, 'stroke-dasharray': voyage ? '2 10' : '5 12', 'stroke-linecap': 'round', opacity: locked ? '.55' : '.9', class: 'map-ahead', 'data-edge': k }));
  }
  const inkEdges = edges.filter((e) => travelled.has(`${e.from}>${e.to}`));
  for (const e of inkEdges) {
    const d = lineD(e);
    if (!d) continue;
    const voyage = !!(LEG_BY_ID[e.to] && LEG_BY_ID[e.to].voyage);
    const k = `${e.from}>${e.to}`;
    kids.push(el('path', { d, fill: 'none', stroke: '#4a2c16', 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-dasharray': voyage ? '2 14' : null, class: 'map-done-under' }));
    kids.push(el('path', { d, fill: 'none', stroke: paint || '#f3ead7', 'stroke-width': 7.5, 'stroke-linecap': 'round', 'stroke-dasharray': voyage ? '2 12' : null, class: 'map-done', 'data-edge': k }));
  }
  // the leg under way: inked up to the wagon
  const a0 = at.fromId ? pointOf(at.fromId) : null;
  if (J && !J.done && a0 && (at.p > 0)) {
    kids.push(el('path', { d: `M${a0[0]} ${a0[1]}L${at.x.toFixed(1)} ${at.y.toFixed(1)}`, fill: 'none', stroke: '#4a2c16', 'stroke-width': 12, 'stroke-linecap': 'round', class: 'map-done-under' }));
    kids.push(el('path', { d: `M${a0[0]} ${a0[1]}L${at.x.toFixed(1)} ${at.y.toFixed(1)}`, fill: 'none', stroke: paint || '#f3ead7', 'stroke-width': 7.5, 'stroke-linecap': 'round', class: 'map-done map-now' }));
  }
  // the stops: every leg of every way, the ones travelled filled
  const reached = new Set();
  for (const k of travelled) reached.add(k.split('>')[1]);
  if (J) plan.forEach((p, i) => { if (i < at.legsDone || (i === at.legsDone && J.trip && J.trip.arrived) || J.done) reached.add(p.id); });
  const nextId = J && !J.done && plan[at.legsDone] ? plan[at.legsDone].id : (J ? null : 'kansas-river');
  const seenStop = new Set();
  const stopIds = ['independence', ...ALL_LEGS.map((l) => l.id), 'farm-willamette'];
  for (const id of stopIds) {
    if (seenStop.has(id) || !pointOf(id)) continue;
    seenStop.add(id);
    const site = SITES.find((s) => s.ends.includes(id));
    const siteHere = site && farm && farm.sites && farm.sites[site.id];
    if (siteHere && (id === 'willamette-valley' || id === 'barlow-road' || id === 'home-by-sea' || id === 'sacramento-valley')) continue;         // the farm stands there instead
    if (id === 'farm-willamette' && farm && farm.sites && farm.sites.willamette) continue;
    kids.push(stopMark(id, reached.has(id) || (id === 'independence' && !!J), id === nextId));
  }
  // locked ways: a small lock and the year
  for (const l of ALL_LEGS) {
    if (!lockedLeg(l.id)) continue;
    const [x, y] = pointOf(l.id);
    kids.push(el('g', { class: 'map-lock', 'data-leg': l.id, 'aria-label': `${l.name} opens in ${l.fromYear}` },
      el('rect', { x: x - 11, y: y - 40, width: 22, height: 16, rx: 3, fill: '#6b4426' }),
      el('path', { d: `M${x - 6} ${y - 40}v-5a6 6 0 0 1 12 0v5`, fill: 'none', stroke: '#6b4426', 'stroke-width': 3 }),
      el('text', { x, y: y - 56 - 4, 'text-anchor': 'middle', class: 'map-label small lock-year' }, String(l.fromYear))));
  }
  // the farms
  if (farm && farm.sites) for (const s of SITES) if (farm.sites[s.id]) kids.push(farmMark(s.id, farm.sites[s.id], onFarm));
  // names: the next stop (title) or every stop of the ways travelled and the current one (journal)
  const label = (id, dy = -22, cls = '') => {
    const [x, y] = pointOf(id);
    kids.push(el('text', { x: Math.max(80, Math.min(930, x)), y: y + dy, 'text-anchor': 'middle', class: `map-label${cls}`, 'data-for': id }, nameOf(id)));
  };
  if (labels === 'all') {
    const placed = [];
    const wanted = [...new Set([...reached, ...plan.map((p) => p.id), 'independence'])].filter((id) => pointOf(id));
    wanted.forEach((id, i) => {
      const [x, y] = pointOf(id);
      for (const dy of [i % 2 === 0 ? -18 : 32, i % 2 === 0 ? 32 : -18, -46]) {
        if (placed.some(([px, py]) => Math.abs(px - x) < 92 && Math.abs(py - (y + dy)) < 22)) continue;
        placed.push([x, y + dy]);
        kids.push(el('text', { x: Math.max(70, Math.min(940, x)), y: y + dy, 'text-anchor': 'middle', class: 'map-label small' + (reached.has(id) ? ' got' : ''), 'data-for': id }, nameOf(id)));
        return;
      }
    });
  } else if (nextId && !(J && J.done)) label(nextId);
  if (pending && pointOf(pending.at)) {                       // a choice waits at this stop: the title says so, the map circles it
    const [x, y] = pointOf(pending.at);
    kids.push(el('circle', { cx: x, cy: y, r: 20, fill: 'none', stroke: '#d9653b', 'stroke-width': 4, 'stroke-dasharray': '6 5', class: 'map-fork-ring', 'data-fork': pending.id }));
  }
  kids.push(wagonMark(at.x, at.y, paint));
  // the family's other wagons, a little below the trail so they never cover a stop's name or this wagon
  const seenAt = {};
  for (const f of Array.isArray(family) ? family : []) {
    if (!f || !f.J) continue;
    const fa = partyPoint(f.J, { inLeg: !!f.inLeg });
    const key = `${fa.legsDone}:${Math.round(fa.p * 10)}:${f.J.route || ''}`;
    const k = seenAt[key] = (seenAt[key] || 0) + 1;
    const g = famWagon(fa.x + (k - 1) * 30, fa.y + 32, f.color, f.id, !!(f.J && f.J.dog));
    const tap = () => { if (typeof onFamily === 'function') onFamily(f); };
    g.addEventListener('click', tap);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } });
    kids.push(g);
  }
  svg.replaceChildren(...kids);
  svg.dataset.family = String((Array.isArray(family) ? family : []).filter((f) => f && f.J).length);
  svg.dataset.legsDone = String(at.legsDone);
  svg.dataset.p = at.p.toFixed(2);
  svg.dataset.travelled = String([...new Set(inkEdges.map((e) => `${e.from}>${e.to}`))].length);
  return { next: nextId ? { id: nextId, name: nameOf(nextId) } : null, at, travelled };
}
/** The stop's name for the title's aria-label (a leg id, or a route's start). */
export const stopName = nameOf;

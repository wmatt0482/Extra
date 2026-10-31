// The trail map (SPEC §12: the title "the map: the trail drawn to the party's position, the next stop"; the journal's
// map page): one inline SVG (viewBox 1000 × 300), Independence on the right (east), the Willamette Valley on the left
// (west), the stops spaced by real miles along a gently wavy line, the trail travelled drawn solid and the rest dashed,
// each stop a dot (a ring for a river, a square for a fort, a star for a landmark, a house for home), the covered
// wagon at the party's position and the next stop named. Pure drawing from the legs (src/content/legs.js) and where
// the party is; no state of its own.
// v1.2: `family` draws the family's other players as small wagons in their own colour at their stops (the title only; no
// names or scores on the map: a tap tells whose wagon it is, via onFamily).
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  for (const k of kids) if (k != null) e.append(typeof k === 'string' ? document.createTextNode(k) : k);
  return e;
}

/** The stops' points: [{ x, y, name, kind, legId }] (index 0 = Independence). */
export function stopPoints(legs) {
  const total = Math.max(1, legs.reduce((a, l) => a + (l.miles || 0), 0));
  const pts = [{ x: 930, y: 180, name: (legs[0] && legs[0].from) || 'Independence', kind: 'start', legId: null }];
  let acc = 0;
  legs.forEach((l, i) => {
    acc += l.miles || 0;
    const x = 930 - (acc / total) * 860;
    const y = 165 + Math.sin((i + 1) * 1.15) * 55 - (l.biome === 'mountains' ? 25 : 0);
    pts.push({ x, y, name: (l.stop && l.stop.name) || l.name, kind: (l.stop && l.stop.kind) || 'landmark', legId: l.id, sticker: l.sticker });
  });
  return pts;
}

/** Where the party is: { legsDone, p (0 … 1 into the current leg) } from the journey (J may be null: at the start). */
export function partyAt(J, legs, { inLeg = false } = {}) {
  if (!J) return { legsDone: 0, p: 0 };
  if (J.done) return { legsDone: legs.length, p: 0 };
  const i = Math.max(0, Math.min(legs.length - 1, Number(J.legIndex) || 0));
  const leg = legs[i];
  const p = inLeg && leg && leg.miles ? Math.max(0, Math.min(1, (Number(J.milesDone) || 0) / leg.miles)) : 0;
  return { legsDone: i, p };
}

function stopMark(pt, reached, next) {
  const fill = reached ? '#7a4a24' : '#fff6e0', stroke = next ? '#d9653b' : '#7a4a24';
  const g = el('g', { class: `map-stop k-${pt.kind}${reached ? ' reached' : ''}${next ? ' next' : ''}`, 'data-leg': pt.legId || 'start' });
  const r = next ? 13 : 10;
  if (pt.kind === 'fort') g.append(el('rect', { x: pt.x - r, y: pt.y - r, width: r * 2, height: r * 2, rx: 3, fill, stroke, 'stroke-width': 4 }));
  else if (pt.kind === 'river') g.append(el('circle', { cx: pt.x, cy: pt.y, r, fill: reached ? '#3f86ad' : '#d8eef7', stroke: next ? '#d9653b' : '#3f86ad', 'stroke-width': 4 }));
  else if (pt.kind === 'home') g.append(el('path', { d: `M${pt.x - r} ${pt.y + r}V${pt.y - 2}L${pt.x} ${pt.y - r - 4}L${pt.x + r} ${pt.y - 2}V${pt.y + r}Z`, fill, stroke, 'stroke-width': 4, 'stroke-linejoin': 'round' }));
  else if (pt.kind === 'start') g.append(el('circle', { cx: pt.x, cy: pt.y, r: 8, fill: '#7a4a24', stroke: '#7a4a24', 'stroke-width': 3 }));
  else {
    const s = r + 3, d = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? s * 0.45 : s; d.push(`${(pt.x + Math.cos(a) * rr).toFixed(1)} ${(pt.y + Math.sin(a) * rr).toFixed(1)}`); }
    g.append(el('path', { d: `M${d.join('L')}Z`, fill: reached ? '#e8b33a' : '#fff6e0', stroke, 'stroke-width': 3, 'stroke-linejoin': 'round' }));
  }
  return g;
}

/** A tiny covered wagon centred on (x, y). */
function wagonMark(x, y, paint = '#f3ead7') {
  return el('g', { class: 'map-wagon', transform: `translate(${x.toFixed(1)} ${(y - 22).toFixed(1)})` },
    el('ellipse', { cx: 0, cy: 26, rx: 30, ry: 5, fill: 'rgba(60,35,15,.25)' }),
    el('rect', { x: -22, y: 6, width: 44, height: 10, rx: 2, fill: '#6b4426' }),
    el('path', { d: 'M-21 7 Q0 -26 21 7Z', fill: paint, stroke: '#6b4426', 'stroke-width': 3 }),
    el('circle', { cx: -13, cy: 18, r: 7, fill: '#fff6e0', stroke: '#4a2c16', 'stroke-width': 3 }),
    el('circle', { cx: 13, cy: 18, r: 7, fill: '#fff6e0', stroke: '#4a2c16', 'stroke-width': 3 }));
}

/**
 * Draw the map into an <svg>. opts: { legs, J, inLeg (the leg is under way: place the wagon by milesDone), paint,
 * labels: 'next' (the title: the next stop only) | 'all' (the journal: every stop), stickers: [ids earned] }.
 */
/** A small family wagon (one of the other players) at (x, y), in their colour; a roomy transparent hit area for a finger. */
function famWagon(x, y, color, id) {
  const g = el('g', { class: 'map-fam', 'data-player': id, role: 'button', tabindex: 0, 'aria-label': 'A wagon from your family. Tap to see whose.', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` });
  g.append(el('circle', { class: 'fam-hit', cx: 0, cy: 0, r: 34, fill: 'transparent', stroke: 'none' }),
    el('ellipse', { cx: 0, cy: 12, rx: 17, ry: 3, fill: 'rgba(60,35,15,.25)' }),
    el('rect', { x: -12, y: 2, width: 24, height: 6, rx: 1.5, fill: '#6b4426' }),
    el('path', { d: 'M-11.5 3 Q0 -15 11.5 3Z', fill: color || '#f3ead7', stroke: '#4a2c16', 'stroke-width': 2 }),
    el('circle', { cx: -7, cy: 10, r: 4, fill: '#fff6e0', stroke: '#4a2c16', 'stroke-width': 2 }),
    el('circle', { cx: 7, cy: 10, r: 4, fill: '#fff6e0', stroke: '#4a2c16', 'stroke-width': 2 }));
  return g;
}

export function drawMap(svg, { legs = [], J = null, inLeg = false, paint, labels = 'next', stickers = [], family = [], onFamily = null } = {}) {
  svg.setAttribute('viewBox', '0 0 1000 300');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const pts = stopPoints(legs);
  const at = partyAt(J, legs, { inLeg });
  const a = pts[Math.min(at.legsDone, pts.length - 1)], b = pts[Math.min(at.legsDone + 1, pts.length - 1)];
  const wx = a.x + (b.x - a.x) * at.p, wy = a.y + (b.y - a.y) * at.p;
  const kids = [];
  kids.push(el('rect', { x: 0, y: 0, width: 1000, height: 300, rx: 22, fill: '#f6e7c4', class: 'map-paper' }));
  // mountains far west, a river or two, prairie grass east (decoration)
  kids.push(el('path', { d: 'M70 120 L120 60 L160 110 L200 50 L250 120 Z M300 128 L345 72 L390 128 Z', fill: '#d9c39a', opacity: '.8' }));
  kids.push(el('path', { d: 'M60 250 C 200 230, 300 270, 470 245 S 760 250, 960 236', fill: 'none', stroke: '#b9d9e6', 'stroke-width': 8, 'stroke-linecap': 'round', opacity: '.8' }));
  const path = (from, to) => pts.slice(from, to + 1).map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
  kids.push(el('path', { d: path(0, pts.length - 1), fill: 'none', stroke: '#9a7a52', 'stroke-width': 5, 'stroke-dasharray': '4 12', 'stroke-linecap': 'round', class: 'map-ahead' }));
  const done = `${path(0, at.legsDone)}L${wx.toFixed(1)} ${wy.toFixed(1)}`;
  kids.push(el('path', { d: done, fill: 'none', stroke: '#7a4a24', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'map-done' }));
  const nextIdx = Math.min(pts.length - 1, at.legsDone + 1);
  pts.forEach((p, i) => kids.push(stopMark(p, i <= at.legsDone, i === nextIdx && !(J && J.done))));
  if (labels === 'all') {
    pts.forEach((p, i) => {
      const above = i % 2 === 0;
      const got = p.sticker && stickers.includes(p.sticker.id);
      kids.push(el('text', { x: p.x, y: above ? p.y - 22 : p.y + 34, 'text-anchor': 'middle', class: 'map-label small' + (got ? ' got' : '') }, p.name));
    });
  } else if (!(J && J.done)) {
    const n = pts[nextIdx];
    kids.push(el('text', { x: Math.max(110, Math.min(890, n.x)), y: n.y - 26, 'text-anchor': 'middle', class: 'map-label' }, n.name));
  }
  kids.push(wagonMark(wx, wy, paint));
  // the family's other wagons, a little below the trail so they never cover a stop's name or this wagon
  const seenAt = {};
  for (const f of Array.isArray(family) ? family : []) {
    if (!f || !f.J) continue;
    const fa = partyAt(f.J, legs, { inLeg: !!f.inLeg });
    const pa = pts[Math.min(fa.legsDone, pts.length - 1)], pb = pts[Math.min(fa.legsDone + 1, pts.length - 1)];
    const x = pa.x + (pb.x - pa.x) * fa.p, y = pa.y + (pb.y - pa.y) * fa.p;
    const key = `${fa.legsDone}:${Math.round(fa.p * 10)}`;
    const k = seenAt[key] = (seenAt[key] || 0) + 1;
    const g = famWagon(x + (k - 1) * 30, y + 34, f.color, f.id);
    const tap = () => { if (typeof onFamily === 'function') onFamily(f); };
    g.addEventListener('click', tap);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } });
    kids.push(g);
  }
  svg.replaceChildren(...kids);
  svg.dataset.family = String((Array.isArray(family) ? family : []).filter((f) => f && f.J).length);
  svg.dataset.legsDone = String(at.legsDone);
  svg.dataset.p = at.p.toFixed(2);
  return { pts, at, next: pts[nextIdx] };
}

// The yard's new art (Lab integration v1, lab/SPEC.md §4.3): the tower in three stages, the Lab's fence finishes and tower
// toppers. Everything is a list of tiny shape primitives so ONE drawing serves every place that shows it: the wave scene and the
// bonus round (canvas 2D, `paint2d`), the title yard and the Yard preview (SVG, `toSvg`) and the Lab's shop preview (`paintPreview`
// in labLooks.js). Pure: no DOM, no storage. Cosmetic only: nothing here touches the road, the aim or a zone.
//
// A primitive: { k: 'r' rect x y w h | 'c' circle x y r | 'e' ellipse x y rx ry | 'p' polygon pts [[x, y]…] | 'l' line x y x2 y2 | 'pl' polyline pts,
//   f fill, s stroke, sw stroke width (units), o opacity, pulse (flickers a little with time) }.
const OUT = '#120f18';
const WOOD = '#6b4a2a', WOOD_D = '#4a3320', STONE = '#7d7773', STONE_L = '#8a8590', GOLD = '#ffd23f';
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const R = (x, y, w, h, f, extra = {}) => ({ k: 'r', x, y, w, h, f, s: OUT, sw: 2, ...extra });
const C = (x, y, r, f, extra = {}) => ({ k: 'c', x, y, r, f, ...extra });
const P = (pts, f, extra = {}) => ({ k: 'p', pts, f, s: OUT, sw: 2, ...extra });
const L = (x, y, x2, y2, s, sw = 2, extra = {}) => ({ k: 'l', x, y, x2, y2, s, sw, ...extra });

/** Stages: 1 the lookout post, 2 the watchtower, 3 the beacon. → { prims, w, h, top: {x, y} (the roof peak), front: {x, y, w, h} (where a banner hangs) }. */
export function towerPrims(stage) {
  const shadow = { k: 'e', x: 0, y: 0, rx: 36, ry: 5, f: '#000', o: 0.28 };
  if (stage <= 0) return { prims: [], w: 0, h: 0, top: { x: 0, y: 0 }, front: { x: 0, y: 0, w: 0, h: 0 } };
  if (stage === 1) {
    const prims = [shadow,
      R(-30, -64, 7, 64, WOOD), R(23, -64, 7, 64, WOOD),
      L(-26, -2, 26, -60, WOOD_D, 3), L(26, -2, -26, -60, WOOD_D, 3),
      R(-38, -72, 76, 8, '#8a5a32'),
      R(-30, -100, 60, 28, '#7a5633'),
      L(-30, -93, 30, -93, WOOD_D, 1.2, { o: 0.7 }), L(-30, -86, 30, -86, WOOD_D, 1.2, { o: 0.7 }), L(-30, -79, 30, -79, WOOD_D, 1.2, { o: 0.7 }),
      C(0, -89, 24, '#ffd25a', { o: 0.16, pulse: true, s: null }),
      R(-10, -95, 20, 14, '#ffd25a', { o: 0.95 }),
      P([[-40, -100], [0, -122], [40, -100]], '#3a2a22')];
    return { prims, w: 80, h: 122, top: { x: 0, y: -122 }, front: { x: -30, y: -100, w: 60, h: 28 } };
  }
  if (stage === 2) {
    const prims = [shadow,
      R(-30, -122, 60, 122, STONE),
      L(-30, -30, 30, -30, '#3a3734', 1.6, { o: 0.7 }), L(-30, -60, 30, -60, '#3a3734', 1.6, { o: 0.7 }), L(-30, -90, 30, -90, '#3a3734', 1.6, { o: 0.7 }),
      L(-8, -30, -8, -60, '#3a3734', 1.4, { o: 0.6 }), L(12, -60, 12, -90, '#3a3734', 1.4, { o: 0.6 }), L(0, -90, 0, -122, '#3a3734', 1.4, { o: 0.6 }),
      R(-4, -98, 8, 24, '#1b1a24'), R(-4, -48, 8, 18, '#1b1a24'),
      R(-18, -178, 36, 30, WOOD),
      C(0, -164, 22, '#ffd25a', { o: 0.14, pulse: true, s: null }), R(-6, -170, 12, 11, '#ffd25a', { o: 0.95 }),
      R(-38, -134, 76, 12, STONE_L),
      R(-38, -150, 14, 16, STONE_L), R(-7, -150, 14, 16, STONE_L), R(24, -150, 14, 16, STONE_L),
      P([[-26, -178], [0, -200], [26, -178]], '#3a2a22')];
    return { prims, w: 80, h: 200, top: { x: 0, y: -200 }, front: { x: -30, y: -122, w: 60, h: 72 } };
  }
  const half = (y) => 30 - (10 * -y) / 170;       // the shaft narrows from 30 at the ground to 20 at 170
  const band = (y1, y2, f) => P([[-half(y1), y1], [half(y1), y1], [half(y2), y2], [-half(y2), y2]], f, { sw: 0 });
  const prims = [shadow,
    P([[-30, 0], [30, 0], [20, -170], [-20, -170]], '#d8d4cc'),
    band(-40, -72, '#b8562a'), band(-112, -144, '#b8562a'),
    P([[-30, 0], [30, 0], [20, -170], [-20, -170]], 'none', { sw: 2.4 }),
    R(-6, -22, 12, 20, '#2a2430'),
    R(-4, -96, 8, 18, '#1b1a24'),
    R(-30, -182, 60, 10, '#4a4658'),
    L(-28, -194, 28, -194, '#4a4658', 2),
    C(0, -200, 64, '#ffe9a0', { o: 0.2, pulse: true, s: null }),
    R(-16, -218, 32, 36, '#fff2a0'),
    L(-5, -218, -5, -182, OUT, 1.6), L(5, -218, 5, -182, OUT, 1.6),
    C(0, -200, 11, '#ffffff', { o: 0.85, pulse: true, s: null }),
    P([[-22, -218], [0, -244], [22, -218]], '#26252b')];
  return { prims, w: 80, h: 244, top: { x: 0, y: -244 }, front: { x: -20, y: -170, w: 40, h: 96 } };
}

/** A tower topper (the Lab's `ff.tower.*` items) for a tower built by towerPrims(): the anchor is the roof peak. */
export function topperPrims(id, tw) {
  const a = tw.top, f = tw.front;
  const pole = [L(a.x, a.y, a.x, a.y - 38, WOOD_D, 3)];
  switch (id) {
    case 'flagred': return [...pole, P([[a.x + 1, a.y - 38], [a.x + 30, a.y - 30], [a.x + 1, a.y - 20]], '#e23a3a')];
    case 'flaglab': return [...pole, P([[a.x + 1, a.y - 40], [a.x + 34, a.y - 31], [a.x + 1, a.y - 18]], '#19b6a6'),
      P([[a.x + 10, a.y - 33], [a.x + 15, a.y - 33], [a.x + 15, a.y - 29], [a.x + 21, a.y - 22], [a.x + 5, a.y - 22], [a.x + 10, a.y - 29]], '#ffffff', { sw: 0 })];
    case 'lanternblue': {
      const x = f.x + f.w * 0.84, y = f.y - 2;
      return [L(x, y, x, y + 12, OUT, 2), C(x, y + 22, 18, '#5fa8ff', { o: 0.3, pulse: true, s: null }), R(x - 7, y + 12, 14, 18, '#2c7bff', { o: 0.95 }), R(x - 8, y + 9, 16, 4, OUT, { sw: 0 })];
    }
    case 'banner': {
      const x0 = f.x + 7, x1 = f.x + f.w - 7, y0 = f.y + 5, y1 = f.y + f.h * 0.92, m = (x0 + x1) / 2;
      return [P([[x0, y0], [x1, y0], [x1, y1], [m, y1 - f.h * 0.16], [x0, y1]], '#7b3fe4', { s: GOLD, sw: 2.2 }), L(x0, y0 + 1, x1, y0 + 1, GOLD, 3), C(m, y0 + (y1 - y0) * 0.42, Math.max(4, f.w * 0.1), GOLD, { sw: 1.4 })];
    }
    case 'glowtop': return [C(a.x, a.y - 12, 30, '#7ff5ff', { o: 0.22, pulse: true, s: null }), C(a.x, a.y - 12, 10, '#7ff5ff', { sw: 2 }), C(a.x - 3, a.y - 15, 3, '#ffffff', { s: null }),
      L(a.x, a.y - 30, a.x, a.y - 38, '#7ff5ff', 2.5), L(a.x - 14, a.y - 20, a.x - 20, a.y - 24, '#7ff5ff', 2.5), L(a.x + 14, a.y - 20, a.x + 20, a.y - 24, '#7ff5ff', 2.5)];
    case 'crowntop': return [P([[a.x - 14, a.y - 2], [a.x - 14, a.y - 22], [a.x - 7, a.y - 13], [a.x, a.y - 26], [a.x + 7, a.y - 13], [a.x + 14, a.y - 22], [a.x + 14, a.y - 2]], GOLD),
      R(a.x - 14, a.y - 6, 28, 6, '#e8a91a', { sw: 1.6 }), C(a.x, a.y - 3, 2.2, '#e23a3a', { s: null }), C(a.x - 8, a.y - 3, 1.8, '#5fa8ff', { s: null }), C(a.x + 8, a.y - 3, 1.8, '#5fa8ff', { s: null })];
    default: return [];
  }
}

const fenceCache = new Map();
/**
 * A fence finish (the Lab's `ff.fence.*` items) as a strip along the top of a fence: x 0 … w, y 0 = the fence's top edge, y h = its foot.
 * Painted OVER whichever fence the yard has: colour, edge and an optional glow (SPEC §4.3).
 */
export function finishPrims(id, w, h) {
  const key = `${id}:${Math.round(w)}:${Math.round(h)}`;
  if (fenceCache.has(key)) return fenceCache.get(key);
  const out = [];
  const W = Math.max(40, Math.round(w)), H = Math.max(12, Math.round(h));
  switch (id) {
    case 'candy':
      for (let x = 0, i = 0; x < W; x += 12, i++) { out.push(R(x, -2, 12, 7, i % 2 ? '#ffffff' : '#ff6fa8', { sw: 1.2 })); out.push(R(x, H - 6, 12, 7, i % 2 ? '#ff6fa8' : '#ffffff', { sw: 1.2 })); }
      break;
    case 'moss':
      for (let x = 0, i = 0; x < W; x += 15, i++) {
        const j = hash(i);
        out.push({ k: 'e', x: x + 7, y: 2 + j * 3, rx: 8 + j * 4, ry: 4 + j * 2, f: '#4f8f3a', o: 0.92 });
        out.push({ k: 'e', x: x + 3, y: H - 3 + j * 3, rx: 6 + j * 4, ry: 3 + j * 2, f: '#3a7a2e', o: 0.9 });
        if (j > 0.55) out.push(C(x + 9, H * 0.55, 2.4 + j * 2, '#6fbf4f', { o: 0.9 }));
      }
      break;
    case 'neon':
      out.push(R(0, -5, W, 11, '#35f0ff', { s: null, o: 0.18, pulse: true }), R(0, H - 5, W, 11, '#35f0ff', { s: null, o: 0.18, pulse: true }));
      out.push(L(0, 0, W, 0, '#35f0ff', 3), L(0, H, W, H, '#35f0ff', 3), L(0, 0, W, 0, '#ffffff', 1, { o: 0.8 }));
      break;
    case 'goldtrim':
      out.push(R(-2, -3, W + 4, 6, GOLD, { sw: 1.4 }), R(-2, H - 2, W + 4, 5, GOLD, { sw: 1.4 }));
      for (let x = 20; x < W; x += 60) out.push(C(x, -6, 4.2, GOLD, { sw: 1.4 }), L(x, -2, x, 2, OUT, 1));
      break;
    case 'frost':
      out.push(R(-2, -4, W + 4, 9, '#dff6ff', { o: 0.9, sw: 1.2 }), R(0, -8, W, 5, '#bfeaff', { s: null, o: 0.18, pulse: true }));
      for (let x = 5, i = 0; x < W; x += 14, i++) out.push(P([[x, 5], [x + 7, 5], [x + 3.5, 6 + 7 + hash(i) * 9]], '#bfeaff', { sw: 1.1, o: 0.95 }));
      for (let x = 30, i = 0; x < W; x += 70, i++) out.push(L(x - 4, -10 - hash(i) * 4, x + 4, -10 - hash(i) * 4, '#ffffff', 1.6), L(x, -14 - hash(i) * 4, x, -6 - hash(i) * 4, '#ffffff', 1.6));
      break;
    case 'vines': {
      const pts = [];
      for (let x = 0; x <= W; x += 6) pts.push([x, 3 + Math.sin(x * 0.09) * 3.2]);
      out.push({ k: 'pl', pts, s: '#2f7a2a', sw: 3.2 });
      for (let x = 8, i = 0; x < W; x += 17, i++) {
        const y = 3 + Math.sin(x * 0.09) * 3.2, up = i % 2 ? 1 : -1;
        out.push(C(x, y + up * 4.4, 3.6, i % 3 ? '#4fbf3a' : '#7fd65a', { sw: 1.2 }));
        if (i % 4 === 0) out.push(L(x, y, x + 3, Math.min(H, y + 14 + hash(i) * 10), '#2f7a2a', 2), C(x + 3, Math.min(H, y + 15 + hash(i) * 10), 2.6, '#4fbf3a', { sw: 1 }));
        if (i % 7 === 3) out.push(C(x + 2, y - 1, 2.1, '#ffd23f', { s: null }));
      }
      break;
    }
    default: break;
  }
  fenceCache.set(key, out);
  return out;
}

/** Draw primitives on a 2D canvas context: world = (ox + x·k, oy + y·k); t seconds drives `pulse`; lwMax caps the outline. */
export function paint2d(ctx, prims, ox, oy, k, t = 0, lwMax = 3) {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const p of prims) {
    const a = (p.o == null ? 1 : p.o) * (p.pulse ? 0.8 + 0.2 * Math.sin(t * 3 + (p.x || 0) * 0.1) : 1);
    ctx.globalAlpha = a;
    if (p.k === 'r') {
      if (p.f && p.f !== 'none') { ctx.fillStyle = p.f; ctx.fillRect(ox + p.x * k, oy + p.y * k, p.w * k, p.h * k); }
      if (p.s && p.sw) { ctx.strokeStyle = p.s; ctx.lineWidth = Math.min(lwMax, Math.max(1, p.sw * k)); ctx.strokeRect(ox + p.x * k, oy + p.y * k, p.w * k, p.h * k); }
    } else if (p.k === 'c' || p.k === 'e') {
      ctx.beginPath();
      if (p.k === 'c') ctx.arc(ox + p.x * k, oy + p.y * k, Math.max(0.5, p.r * k), 0, Math.PI * 2);
      else ctx.ellipse(ox + p.x * k, oy + p.y * k, Math.max(0.5, p.rx * k), Math.max(0.5, p.ry * k), 0, 0, Math.PI * 2);
      if (p.f && p.f !== 'none') { ctx.fillStyle = p.f; ctx.fill(); }
      if (p.s && p.sw) { ctx.strokeStyle = p.s; ctx.lineWidth = Math.min(lwMax, Math.max(1, p.sw * k)); ctx.stroke(); }
    } else if (p.k === 'p' || p.k === 'pl') {
      ctx.beginPath();
      p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * k, oy + y * k) : ctx.moveTo(ox + x * k, oy + y * k)));
      if (p.k === 'p') ctx.closePath();
      if (p.f && p.f !== 'none') { ctx.fillStyle = p.f; ctx.fill(); }
      if (p.s && p.sw) { ctx.strokeStyle = p.s; ctx.lineWidth = Math.min(lwMax, Math.max(1, p.sw * k)); ctx.stroke(); }
    } else if (p.k === 'l') {
      ctx.strokeStyle = p.s; ctx.lineWidth = Math.min(lwMax * 1.4, Math.max(1, p.sw * k));
      ctx.beginPath(); ctx.moveTo(ox + p.x * k, oy + p.y * k); ctx.lineTo(ox + p.x2 * k, oy + p.y2 * k); ctx.stroke();
    }
  }
  ctx.restore();
}

const n1 = (x) => Math.round(x * 100) / 100;
/** The same primitives as SVG markup, in a group moved to (ox, oy) and scaled by k. */
export function toSvg(prims, ox, oy, k, cls = '') {
  let s = `<g${cls ? ` class="${cls}"` : ''} transform="translate(${n1(ox)} ${n1(oy)}) scale(${n1(k * 1000) / 1000})" stroke-linejoin="round" stroke-linecap="round">`;
  for (const p of prims) {
    const st = `${p.s && p.sw ? ` stroke="${p.s}" stroke-width="${p.sw}"` : ''}${p.o != null ? ` opacity="${p.o}"` : ''}`;
    const fill = p.f && p.f !== 'none' ? p.f : 'none';
    if (p.k === 'r') s += `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${fill}"${st}/>`;
    else if (p.k === 'c') s += `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${fill}"${st}/>`;
    else if (p.k === 'e') s += `<ellipse cx="${p.x}" cy="${p.y}" rx="${p.rx}" ry="${p.ry}" fill="${fill}"${st}/>`;
    else if (p.k === 'p') s += `<polygon points="${p.pts.map((q) => q.map(n1).join(',')).join(' ')}" fill="${fill}"${st}/>`;
    else if (p.k === 'pl') s += `<polyline points="${p.pts.map((q) => q.map(n1).join(',')).join(' ')}" fill="none"${st}/>`;
    else if (p.k === 'l') s += `<line x1="${p.x}" y1="${p.y}" x2="${p.x2}" y2="${p.y2}" stroke="${p.s}" stroke-width="${p.sw}"${p.o != null ? ` opacity="${p.o}"` : ''}/>`;
  }
  return s + '</g>';
}

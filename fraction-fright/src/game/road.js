// The road IS the number line. Geometry (value <-> css px), the label set (0, ½, 1 and every whole are ALWAYS
// labelled whatever the app passes; finer ticks only while the item asks), and the drawing of the road band, the
// line, ticks, labels, landmarks, the true-spot flag, the fraction drawn as unit jumps from 0, and the aim reticle.
// Nothing here allocates per frame beyond a few numbers; text goes through render.js' sprite cache.

import { TAU, clamp, lerp, parseFractionText, fractionLabel, denominatorOf, easeOut, popScale, withAlpha, shade, hash2, mulberry32 } from './util.js';
import { spriteText, OUT } from './render.js';

// value -> label text for the benchmarks the engine adds itself
function benchmarkText(v) {
  if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
  return fractionLabel(v, 2);
}

// Build the road geometry for a view. spec: { from, to, labels, ticks, landmarks }.
export function makeRoad(spec = {}, view) {
  const from = Number.isFinite(Number(spec.from)) ? Number(spec.from) : 0;
  let to = Number.isFinite(Number(spec.to)) ? Number(spec.to) : 1;
  if (to <= from) to = from + 1;
  const span = to - from;
  const W = view.W, H = view.H, portrait = H > W;
  const pad = portrait ? Math.max(24, W * 0.075) : Math.max(34, W * 0.085);
  const x0 = pad, x1 = W - pad;
  const y = Math.round(H * (portrait ? 0.6 : 0.64));
  const band = portrait ? clamp(H * 0.05, 26, 40) : clamp(H * 0.085, 24, 44); // half-height of the dirt band
  const fontPx = clamp(Math.min(W, H) * 0.058, 15, 26);

  // labels: strings (parsed) or { at, text }; the benchmarks are added when missing
  const labels = new Map();
  const add = (at, text, major) => {
    if (!Number.isFinite(at) || at < from - 1e-9 || at > to + 1e-9) return;
    const k = Math.round(at * 1e6);
    const cur = labels.get(k);
    if (!cur || (major && !cur.major)) labels.set(k, { at, text: text || (cur && cur.text) || benchmarkText(at), major: !!major || !!(cur && cur.major) });
  };
  for (const l of Array.isArray(spec.labels) ? spec.labels : []) {
    if (l == null) continue;
    if (typeof l === 'object') add(Number(l.at), String(l.text ?? l.label ?? benchmarkText(Number(l.at))), true);
    else { const v = parseFractionText(l); if (v != null) add(v, String(l), true); }
  }
  // non-negotiable benchmarks: 0, ½, 1 and every whole on the road
  for (let w = Math.ceil(from); w <= to + 1e-9; w++) add(w, null, true);
  if (from <= 0.5 && to >= 0.5) add(0.5, '½', true);
  else if (span <= 1) add(from + span / 2, benchmarkText(from + span / 2), true);
  const labelList = [...labels.values()].sort((a, b) => a.at - b.at);

  const ticks = [];
  for (const t of Array.isArray(spec.ticks) ? spec.ticks : []) {
    const at = typeof t === 'number' ? t : Number(t && t.at);
    if (!Number.isFinite(at) || at < from || at > to) continue;
    if (labels.has(Math.round(at * 1e6))) continue;
    ticks.push({ at, text: t && typeof t === 'object' && t.label != null ? String(t.label) : null });
  }
  const landmarks = [];
  for (const m of Array.isArray(spec.landmarks) ? spec.landmarks : []) {
    const at = typeof m === 'number' ? m : Number(m && m.at);
    if (!Number.isFinite(at)) continue;
    landmarks.push({ at: clamp(at, from, to), kind: (m && m.kind) || 'grave', text: m && m.label != null ? String(m.label) : null });
  }

  const toPx = (v) => x0 + ((v - from) / span) * (x1 - x0);
  const fromPx = (px) => from + ((px - x0) / (x1 - x0)) * span;
  // road furniture (cosmetic, seeded by the size): puddles that catch the moon, a manhole
  const prand = mulberry32(hash2(W, H));
  const puddles = [];
  for (let i = 0; i < (portrait ? 2 : 3); i++) puddles.push({ x: W * (0.12 + prand() * 0.76), y: y + band * (prand() < 0.5 ? -0.55 : 0.55), rx: 22 + prand() * 26, ry: 5 + prand() * 3 });
  const manhole = { x: W * (0.55 + prand() * 0.2), y: y + band * 0.5, r: clamp(band * 0.42, 9, 16) };
  return { from, to, span, x0, x1, y, band, fontPx, labels: labelList, ticks, landmarks, toPx, fromPx, portrait, puddles, manhole,
    toX01: (v) => (v - from) / span, fromX01: (u) => from + u * span };
}

// ticks the current item asks for: its own list, or the road's fine ticks, or every 1/den when the item names one
export function ticksForItem(road, item) {
  if (!item) return null;
  const own = Array.isArray(item.ticks) ? item.ticks : null;
  if (own) return own.map((t) => (typeof t === 'number' ? { at: t, text: null } : { at: Number(t.at), text: t.label != null ? String(t.label) : null })).filter((t) => Number.isFinite(t.at) && t.at >= road.from && t.at <= road.to);
  if (road.ticks.length) return road.ticks;
  const den = item.den || (item.jumps && item.jumps.unit > 0 ? Math.round(1 / item.jumps.unit) : denominatorOf(item.show));
  if (!den || den < 2 || den > 24) return null;
  const out = [];
  for (let n = Math.ceil(road.from * den); n <= road.to * den + 1e-9; n++) {
    const at = n / den;
    if (road.labels.some((l) => Math.abs(l.at - at) < 1e-9)) continue;
    out.push({ at, text: null });
  }
  return out;
}

// ---------- drawing ----------
// the cracked asphalt band: baked into the backdrop bitmap once (render.js buildBackdrop)
export function paintRoadBand(c, road, W, rand) {
  const { y, band, x0, x1 } = road;
  c.fillStyle = '#26232e'; c.fillRect(0, y - band, W, band * 2);
  // worn patches and tar lines
  c.fillStyle = '#2d2a37';
  for (let i = 0; i < W / 90; i++) { const px = rand() * W, py = y - band * 0.6 + rand() * band * 1.2; c.beginPath(); c.ellipse(px, py, 30 + rand() * 50, 5 + rand() * 8, 0, 0, TAU); c.fill(); }
  c.strokeStyle = '#141219'; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
  for (let i = 0; i < W / 70; i++) {
    let px = rand() * W, py = y - band + 6 + rand() * (band * 2 - 12);
    c.beginPath(); c.moveTo(px, py);
    for (let k = 0; k < 4; k++) { px += (rand() - 0.3) * 40; py += (rand() - 0.5) * band * 0.6; c.lineTo(px, clamp(py, y - band + 3, y + band - 3)); }
    c.stroke();
  }
  // fine cracks
  c.strokeStyle = '#3a3646'; c.lineWidth = 1.2;
  for (let i = 0; i < W / 40; i++) {
    let px = rand() * W, py = y - band + 4 + rand() * (band * 2 - 8);
    c.beginPath(); c.moveTo(px, py);
    for (let k = 0; k < 3; k++) { px += (rand() - 0.5) * 24; py += (rand() - 0.5) * 14; c.lineTo(px, clamp(py, y - band + 2, y + band - 2)); }
    c.stroke();
  }
  // edges: a pale worn line and the curb
  c.fillStyle = '#3a3646'; c.fillRect(0, y - band, W, 3); c.fillRect(0, y + band - 3, W, 3);
  c.fillStyle = '#141219'; c.fillRect(0, y - band - 2, W, 2); c.fillRect(0, y + band, W, 2);
  // puddles reflecting the moon
  for (const p of road.puddles) {
    c.fillStyle = '#1b2033'; c.beginPath(); c.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU); c.fill();
    c.fillStyle = withAlpha('#efe3b4', 0.22); c.beginPath(); c.ellipse(p.x + p.rx * 0.25, p.y - p.ry * 0.2, p.rx * 0.42, p.ry * 0.32, 0, 0, TAU); c.fill();
    c.strokeStyle = withAlpha('#5a5a78', 0.6); c.lineWidth = 1; c.beginPath(); c.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU); c.stroke();
  }
  // the manhole
  const m = road.manhole;
  c.fillStyle = '#1e1b26'; c.strokeStyle = '#141219'; c.lineWidth = 2;
  c.beginPath(); c.ellipse(m.x, m.y, m.r, m.r * 0.5, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#34303f'; c.beginPath(); c.ellipse(m.x, m.y - 1, m.r * 0.9, m.r * 0.42, 0, 0, TAU); c.fill();
  c.strokeStyle = '#1e1b26'; c.lineWidth = 1.2;
  for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(m.x - m.r * 0.7, m.y - 1 + i * m.r * 0.13); c.lineTo(m.x + m.r * 0.7, m.y - 1 + i * m.r * 0.13); c.stroke(); }
  // a faint dark strip under the number line so splats never hide it
  c.fillStyle = withAlpha('#000000', 0.22); c.fillRect(x0 - 14, y - 7, x1 - x0 + 28, 14);
}
// per frame: nothing but a soft shadow strip under the line (the band itself is baked)
export function drawRoadBand(ctx, road, pal, t, W) {
  ctx.fillStyle = withAlpha('#000000', 0.1);
  ctx.fillRect(0, road.y - 5, W, 10);
}

// a rusted iron road marker (tick post): base at (x, y), height h
function ironPost(ctx, x, y, h, w, lw, major) {
  ctx.lineWidth = lw * 1.2; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
  ctx.fillStyle = '#6e3a1c';
  roundRect(ctx, x - w / 2, y - h, w, h * 2, w * 0.35); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#a4552a'; ctx.fillRect(x - w / 2 + 1, y - h + 3, Math.max(1, w * 0.3), h * 2 - 6);
  ctx.fillStyle = '#4a2412'; ctx.fillRect(x - w / 2 + 1, y - h * 0.35, w - 2, 2.5); ctx.fillRect(x - w / 2 + 1, y + h * 0.4, w - 2, 2.5);
  ctx.fillStyle = '#3a2a2a'; roundRect(ctx, x - w / 2 - 1.5, y - h - 3, w + 3, 5, 1.5); ctx.fill(); ctx.stroke();
  if (major) { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(x, y - h * 0.8); ctx.lineTo(x + w * 0.45, y - h * 0.62); ctx.lineTo(x, y - h * 0.44); ctx.lineTo(x - w * 0.45, y - h * 0.62); ctx.closePath(); ctx.fill(); ctx.stroke(); }
}
// the number line itself: line, major markers, optional fine ticks (alpha 0..1)
export function drawNumberLine(ctx, road, pal, fineTicks, fineAlpha, lw) {
  const { x0, x1, y, fontPx } = road;
  ctx.lineCap = 'round';
  ctx.lineWidth = lw * 3; ctx.strokeStyle = OUT;
  ctx.beginPath(); ctx.moveTo(x0 - 8, y); ctx.lineTo(x1 + 8, y); ctx.stroke();
  ctx.lineWidth = lw * 1.6; ctx.strokeStyle = pal.line;
  ctx.beginPath(); ctx.moveTo(x0 - 8, y); ctx.lineTo(x1 + 8, y); ctx.stroke();
  ctx.lineWidth = lw * 0.5; ctx.strokeStyle = withAlpha('#ffffff', 0.35);
  ctx.beginPath(); ctx.moveTo(x0 - 8, y - lw * 0.4); ctx.lineTo(x1 + 8, y - lw * 0.4); ctx.stroke();
  if (fineTicks && fineAlpha > 0.01) {
    ctx.globalAlpha = fineAlpha;
    const h = road.band * 0.4;
    for (let i = 0; i < fineTicks.length; i++) ironPost(ctx, road.toPx(fineTicks[i].at), y, h, Math.max(4, lw * 2.2), lw, false);
    for (let i = 0; i < fineTicks.length; i++) if (fineTicks[i].text) spriteText(ctx, fineTicks[i].text, fontPx * 0.72, road.toPx(fineTicks[i].at), y - h - fontPx * 0.5, pal.tickFine, true);
    ctx.globalAlpha = 1;
  }
  const th = road.band * 0.64;
  for (let i = 0; i < road.labels.length; i++) ironPost(ctx, road.toPx(road.labels[i].at), y, th, Math.max(6, lw * 3.2), lw, true);
}
// labels are drawn LAST on the road layer so no effect ever covers them: dented metal signs hung under the line
export function drawRoadLabels(ctx, road, pal, lw) {
  const { y, fontPx } = road;
  const ly = y + road.band + fontPx * 1.05;
  for (let i = 0; i < road.labels.length; i++) {
    const l = road.labels[i];
    const x = road.toPx(l.at);
    const w = Math.max(fontPx * 1.7, fontPx * 0.7 * l.text.length + fontPx * 0.7), h = fontPx * 1.5;
    const tilt = (((i * 7) % 5) - 2) * 0.012;
    ctx.save(); ctx.translate(x, ly); ctx.rotate(tilt);
    ctx.lineJoin = 'round';
    // chain from the line to the sign
    ctx.strokeStyle = OUT; ctx.lineWidth = lw * 1.4;
    ctx.beginPath(); ctx.moveTo(-fontPx * 0.4, -h / 2); ctx.lineTo(-fontPx * 0.3, -h / 2 - fontPx * 0.45); ctx.moveTo(fontPx * 0.4, -h / 2); ctx.lineTo(fontPx * 0.3, -h / 2 - fontPx * 0.45); ctx.stroke();
    ctx.fillStyle = OUT; roundRect(ctx, -w / 2 - lw, -h / 2 - lw, w + lw * 2, h + lw * 2, 3); ctx.fill();
    ctx.fillStyle = pal.plaque; roundRect(ctx, -w / 2, -h / 2, w, h, 2.5); ctx.fill();
    // bevel + a dent + rust bloom + bolts
    ctx.fillStyle = withAlpha('#ffffff', 0.14); ctx.fillRect(-w / 2, -h / 2, w, 2); ctx.fillRect(-w / 2, -h / 2, 2, h);
    ctx.fillStyle = withAlpha('#000000', 0.25); ctx.fillRect(-w / 2, h / 2 - 2.5, w, 2.5);
    ctx.strokeStyle = withAlpha('#ffffff', 0.18); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(w * 0.28, -h * 0.1, h * 0.28, 2.6, 4.3); ctx.stroke();
    ctx.fillStyle = withAlpha('#b8562a', 0.35); ctx.beginPath(); ctx.ellipse(-w * 0.3, h * 0.25, w * 0.18, h * 0.16, 0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9aa0ad'; ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.8;
    for (const bx of [-w / 2 + 5, w / 2 - 5]) { ctx.beginPath(); ctx.arc(bx, -h / 2 + 5, 2.2, 0, TAU); ctx.fill(); ctx.stroke(); }
    spriteText(ctx, l.text, fontPx * 1.05, 0, 1, pal.label, true);
    ctx.restore();
  }
}
export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// landmarks stand behind the road (graves, trees, lanterns, a well) at their value
export function drawLandmarks(ctx, road, pal, t, lw) {
  const base = road.y - road.band - 2;
  const s = clamp(road.band * 1.4, 26, 60);
  for (let i = 0; i < road.landmarks.length; i++) {
    const m = road.landmarks[i];
    const x = road.toPx(m.at);
    ctx.lineWidth = lw * 1.2; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (m.kind === 'tree') {
      ctx.lineWidth = lw * 3.2; ctx.strokeStyle = OUT;
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + s * 0.05, base - s * 0.7); ctx.lineTo(x - s * 0.25, base - s * 1.05); ctx.moveTo(x + s * 0.05, base - s * 0.7); ctx.lineTo(x + s * 0.3, base - s * 1.0); ctx.moveTo(x + s * 0.02, base - s * 0.4); ctx.lineTo(x - s * 0.28, base - s * 0.6); ctx.stroke();
      ctx.lineWidth = lw * 1.6; ctx.strokeStyle = '#2a1d2e';
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + s * 0.05, base - s * 0.7); ctx.lineTo(x - s * 0.25, base - s * 1.05); ctx.moveTo(x + s * 0.05, base - s * 0.7); ctx.lineTo(x + s * 0.3, base - s * 1.0); ctx.moveTo(x + s * 0.02, base - s * 0.4); ctx.lineTo(x - s * 0.28, base - s * 0.6); ctx.stroke();
    } else if (m.kind === 'lantern') {
      ctx.fillStyle = '#2a2734';
      ctx.fillRect(x - s * 0.05, base - s * 0.95, s * 0.1, s * 0.95); ctx.strokeRect(x - s * 0.05, base - s * 0.95, s * 0.1, s * 0.95);
      const g = 0.75 + 0.25 * Math.sin(t * 6 + x);
      ctx.fillStyle = withAlpha('#ff9a2e', 0.2 * g);
      ctx.beginPath(); ctx.arc(x, base - s * 1.05, s * 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1b1a24'; roundRect(ctx, x - s * 0.14, base - s * 1.22, s * 0.28, s * 0.32, s * 0.04); ctx.fill(); ctx.stroke();
      ctx.fillStyle = withAlpha('#ffb13b', 0.85 * g); roundRect(ctx, x - s * 0.08, base - s * 1.17, s * 0.16, s * 0.2, 1); ctx.fill();
    } else if (m.kind === 'well') {
      ctx.fillStyle = '#4a4658';
      roundRect(ctx, x - s * 0.3, base - s * 0.4, s * 0.6, s * 0.4, s * 0.06); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a2a1e';
      ctx.beginPath(); ctx.moveTo(x - s * 0.4, base - s * 0.72); ctx.lineTo(x, base - s * 1.0); ctx.lineTo(x + s * 0.4, base - s * 0.72); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else { // grave, a little crooked
      ctx.save(); ctx.translate(x, base); ctx.rotate(((i % 3) - 1) * 0.08);
      ctx.fillStyle = pal.grave;
      roundRect(ctx, -s * 0.24, -s * 0.66, s * 0.48, s * 0.66, s * 0.2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = withAlpha('#000000', 0.3);
      roundRect(ctx, -s * 0.13, -s * 0.52, s * 0.26, s * 0.07, 2); ctx.fill();
      roundRect(ctx, -s * 0.13, -s * 0.38, s * 0.26, s * 0.05, 2); ctx.fill();
      ctx.strokeStyle = withAlpha('#000000', 0.4); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 0.66); ctx.lineTo(s * 0.04, -s * 0.5); ctx.lineTo(s * 0.12, -s * 0.36); ctx.stroke();
      ctx.restore();
    }
    if (m.text) spriteText(ctx, m.text, road.fontPx * 0.7, x, base - s * 1.25, '#ffffff', true);
  }
}

// the aim reticle on the road at value v
export function drawReticle(ctx, road, v, pal, t, lw, strength = 1) {
  const x = road.toPx(v), y = road.y;
  const r = road.band * 0.55;
  const pulse = 1 + 0.08 * Math.sin(t * 8);
  ctx.globalAlpha = strength;
  ctx.lineWidth = lw * 2.6; ctx.strokeStyle = OUT;
  ctx.beginPath(); ctx.ellipse(x, y, r * pulse * 1.3, r * pulse * 0.6, 0, 0, TAU); ctx.stroke();
  ctx.lineWidth = lw * 1.3; ctx.strokeStyle = pal.reticle;
  ctx.beginPath(); ctx.ellipse(x, y, r * pulse * 1.3, r * pulse * 0.6, 0, 0, TAU); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r * 1.9, y); ctx.lineTo(x - r * 0.9, y); ctx.moveTo(x + r * 0.9, y); ctx.lineTo(x + r * 1.9, y);
  ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x, y - r * 0.5); ctx.moveTo(x, y + r * 0.5); ctx.lineTo(x, y + r * 1.2);
  ctx.stroke();
  ctx.fillStyle = pal.reticle;
  ctx.beginPath(); ctx.arc(x, y, lw * 1.6, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
}

// the true-spot flag: an iron pole with a torn rust pennant that shows the fraction; k = 0..1 pop
export function drawFlag(ctx, road, value, text, k, pal, lw, t) {
  if (k <= 0) return;
  const x = road.toPx(value), y = road.y;
  const s = popScale(Math.min(1, k));
  const h = road.band * 2.0 * s;
  const fz = road.fontPx * 0.95;
  ctx.lineWidth = lw * 2.4; ctx.strokeStyle = OUT; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  ctx.lineWidth = lw * 1.1; ctx.strokeStyle = '#8a8fa0';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  const w = Math.max(fz * 1.9, fz * 0.75 * text.length + fz * 0.9) * s, fh = fz * 1.35 * s;
  const wave = Math.sin(t * 6) * 2 * s;
  ctx.fillStyle = pal.flag;
  ctx.lineWidth = lw * 1.5; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - h); ctx.lineTo(x + w, y - h + wave); ctx.lineTo(x + w * 0.9, y - h + fh * 0.3 + wave); ctx.lineTo(x + w * 0.78, y - h + fh / 2 + wave * 0.5); ctx.lineTo(x + w * 0.92, y - h + fh * 0.72 + wave); ctx.lineTo(x + w * 0.84, y - h + fh + wave); ctx.lineTo(x, y - h + fh);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = withAlpha('#000000', 0.18); ctx.fillRect(x, y - h + fh * 0.75, w * 0.84, fh * 0.25);
  if (s > 0.6) spriteText(ctx, text, fz * s, x + w * 0.4, y - h + fh / 2 + wave * 0.5, '#ffffff', true);
  ctx.fillStyle = withAlpha(pal.flag, 0.35 + 0.25 * Math.sin(t * 7));
  ctx.beginPath(); ctx.ellipse(x, y, road.band * 0.5 * s, road.band * 0.22 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(x, y, lw * 2.2 * s, 0, TAU); ctx.fill();
}
// the fraction drawn as unit jumps from `from`: n arcs of `unit`, the last one may be partial to reach `target`
// (when the target is not a whole number of units). progress 0..1 reveals them one by one. Returns the arc count.
export function jumpPlan(road, item) {
  const target = Number(item && item.target);
  if (!Number.isFinite(target)) return null;
  let unit = item && item.jumps && item.jumps.unit > 0 ? Number(item.jumps.unit) : null;
  if (!unit) { const d = (item && item.den) || denominatorOf(item && item.show); unit = d && d > 1 && d <= 24 ? 1 / d : null; }
  if (!unit) unit = target > 1.5 ? 1 : target > 0 ? target : 1;
  // too many arcs read as noise: fall back to wholes + the remainder (e.g. 2 3/4 on a 0-3 road with eighths)
  const dist = target - road.from;
  let count = Math.round(dist / unit);
  if (Math.abs(count * unit - dist) > 1e-6) count = Math.floor(dist / unit + 1e-9);
  if (count > 12) { unit = 1; count = Math.floor(dist + 1e-9); }
  const arcs = [];
  let at = road.from;
  for (let i = 0; i < count; i++) { arcs.push({ a: at, b: at + unit, unit: true }); at += unit; }
  if (target - at > 1e-6) arcs.push({ a: at, b: target, unit: false });
  if (!arcs.length) arcs.push({ a: road.from, b: target, unit: false });
  const den = unit > 0 && unit < 1 ? Math.round(1 / unit) : 1;
  return { arcs, unit, count, den, unitText: fractionLabel(unit, den) };
}
export function drawJumps(ctx, road, plan, progress, pal, lw) {
  if (!plan || progress <= 0) return;
  const y = road.y, n = plan.arcs.length;
  const hMax = Math.min(road.band * 1.25, Math.max(14, (road.x1 - road.x0) / Math.max(4, n) * 0.5));
  const fz = road.fontPx * 0.78;
  for (let i = 0; i < n; i++) {
    const k = clamp(progress * n - i, 0, 1);
    if (k <= 0) break;
    const arc = plan.arcs[i];
    const xa = road.toPx(arc.a), xb = road.toPx(arc.b);
    const xe = lerp(xa, xb, easeOut(k));
    // partial parabola from xa to xe (a jump arc)
    ctx.lineWidth = lw * 2.6; ctx.strokeStyle = OUT; ctx.lineCap = 'round';
    arcPath(ctx, xa, xb, xe, y, hMax);
    ctx.stroke();
    ctx.lineWidth = lw * 1.3; ctx.strokeStyle = arc.unit ? pal.jump : pal.jumpPart;
    arcPath(ctx, xa, xb, xe, y, hMax);
    ctx.stroke();
    if (k >= 1) {
      // landing dot and the count above the apex
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.arc(xb, y, lw * 2, 0, TAU); ctx.fill();
      ctx.fillStyle = arc.unit ? pal.jump : pal.jumpPart;
      ctx.beginPath(); ctx.arc(xb, y, lw * 1.1, 0, TAU); ctx.fill();
      if (arc.unit && n <= 12) spriteText(ctx, String(i + 1), fz, (xa + xb) / 2, y - hMax - fz * 0.55, pal.jump, true);
    }
  }
  if (progress >= 1 && plan.count > 0 && plan.unit < 1 && n <= 12) {
    // "3 × ¼" above the last unit arc's number
    const last = plan.arcs[plan.count - 1];
    const text = `${plan.count} × ${plan.unitText}`;
    spriteText(ctx, text, fz * 0.85, (road.toPx(last.a) + road.toPx(last.b)) / 2, y - hMax - fz * 1.7, pal.jump, true);
  }
}
function arcPath(ctx, xa, xb, xe, y, h) {
  ctx.beginPath();
  const steps = 14;
  for (let s = 0; s <= steps; s++) {
    const x = lerp(xa, xe, s / steps);
    const u = (x - xa) / Math.max(1e-6, xb - xa);
    const yy = y - h * 4 * u * (1 - u) - 1;
    if (s === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
  }
}

// the nudge arrow after a near miss: from the landing toward the true spot, bouncing
export function drawNudge(ctx, road, fromV, toV, pal, t, lw, alpha = 1) {
  const xa = road.toPx(fromV), xb = road.toPx(toV);
  if (Math.abs(xb - xa) < 6) return;
  const dir = Math.sign(xb - xa);
  const y = road.y - road.band * 0.72;
  const bob = Math.sin(t * 7) * 3;
  const x1 = xa + dir * 10 + bob * dir, x2 = xb - dir * 10 + bob * dir;
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [w, c] of [[lw * 3.2, OUT], [lw * 1.6, pal.nudge]]) {
    ctx.lineWidth = w; ctx.strokeStyle = c;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    const ah = Math.min(12, Math.abs(x2 - x1) * 0.4);
    ctx.beginPath(); ctx.moveTo(x2 - dir * ah, y - ah * 0.8); ctx.lineTo(x2, y); ctx.lineTo(x2 - dir * ah, y + ah * 0.8); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export const ROAD_PAL = {
  line: '#e9dcb0', tickFine: '#ffb347', plaque: '#3a3e48', label: '#ffffff',
  reticle: '#5ff0ff', flag: '#c9521f', jump: '#ffb020', jumpPart: '#ff5d8f', nudge: '#9dff2e', grave: '#5d5a70',
};
export function roadPalette(look) {
  const p = { ...ROAD_PAL };
  if (look && look.lineColor) p.line = look.lineColor;
  return p;
}

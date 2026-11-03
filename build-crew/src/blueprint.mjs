// Blueprint pictures: the front view of a Lab blueprint's ghost pieces as white lines on blueprint blue, drawn as an SVG
// string (the job-complete sheet and the job board) or onto a 2D canvas (the Lab shop card, labLooks.js). It reads only
// the job's ghost list, so it is pure and needs no browser; the same rectangles are drawn both ways.
import { TOYS } from './content.mjs';

/** The front view (looking along z) of each ghost: a rectangle per piece in metres (x across, y up from the ground),
 *  plus the bounds of the whole build. A barrel and a pipe are drawn as their rounded profile (`round`). */
export function blueprintRects(round) {
  const rects = (round.ghosts || []).map((g) => {
    const [w, h] = TOYS[g.type].size;
    return { x: g.x - w / 2, y: g.y - h / 2, w, h, round: !!TOYS[g.type].round, type: g.type };
  });
  const x0 = Math.min(...rects.map((r) => r.x)),
    x1 = Math.max(...rects.map((r) => r.x + r.w)),
    y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { rects, x0, x1, top: y1 };
}

/** The picture as an SVG string, 320 x 190 units: the pieces in white outline on the blue, a ground line and a height
 *  dimension line (and a NEAT BUILD stamp when `neat`). */
export function blueprintSvg(round, { neat = false } = {}) {
  const { rects, x0, x1, top } = blueprintRects(round),
    pad = 28,
    scale = Math.min((320 - 2 * pad) / (x1 - x0), (190 - 2 * pad - 14) / top),
    ox = (320 - (x1 - x0) * scale) / 2 - x0 * scale,
    gy = 190 - pad;
  const px = (x) => (ox + x * scale).toFixed(1),
    py = (y) => (gy - y * scale).toFixed(1);
  let out =
    `<rect x="2" y="2" width="316" height="186" rx="3" fill="#143a5c" stroke="#e8f1f7" stroke-width="2"/>` +
    Array.from({ length: 15 }, (_, i) => `<path d="M${10 + i * 20} 6V184" stroke="#e8f1f7" stroke-opacity="0.08"/>`).join('') +
    Array.from({ length: 9 }, (_, i) => `<path d="M6 ${10 + i * 20}H314" stroke="#e8f1f7" stroke-opacity="0.08"/>`).join('') +
    `<path d="M10 ${gy}H310" stroke="#e8f1f7" stroke-width="2"/>`;
  for (const r of rects) {
    const x = px(r.x),
      y = py(r.y + r.h),
      w = (r.w * scale).toFixed(1),
      h = (r.h * scale).toFixed(1);
    out += r.round
      ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${(r.w * scale * 0.2).toFixed(1)}" fill="#e8f1f7" fill-opacity="0.12" stroke="#e8f1f7" stroke-width="2.5"/>` +
        `<path d="M${x} ${(+y + h * 0.22).toFixed(1)}h${w}M${x} ${(+y + h * 0.78).toFixed(1)}h${w}" stroke="#e8f1f7" stroke-opacity="0.6"/>`
      : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#e8f1f7" fill-opacity="0.12" stroke="#e8f1f7" stroke-width="2.5"/>` +
        `<path d="M${x} ${y}l${w} ${h}M${(+x + +w).toFixed(1)} ${y}l-${w} ${h}" stroke="#e8f1f7" stroke-opacity="0.25"/>`;
  }
  // the height dimension line at the right, with its tick marks and the number
  const dx = (+px(x1) + 14).toFixed(1);
  out +=
    `<path d="M${dx} ${gy}V${py(top)}M${(+dx - 5).toFixed(1)} ${gy}h10M${(+dx - 5).toFixed(1)} ${py(top)}h10" stroke="#f2b538" stroke-width="2"/>` +
    `<text x="${(+dx + 8).toFixed(1)}" y="${(gy - (top * scale) / 2 + 4).toFixed(1)}" font-family="ui-monospace,Consolas,monospace" font-size="11" font-weight="700" fill="#f2b538">${top.toFixed(1)} m</text>` +
    `<text x="14" y="20" font-family="ui-monospace,Consolas,monospace" font-size="12" font-weight="700" fill="#e8f1f7">${round.title.toUpperCase()} / BLUEPRINT ${round.id - 100}</text>`;
  if (neat)
    out +=
      `<g transform="rotate(-4 262 20)"><rect x="214" y="8" width="96" height="24" fill="#143a5c" stroke="#f2b538" stroke-width="2.5"/>` +
      `<text x="262" y="25" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="13" font-weight="700" fill="#f2b538">NEAT BUILD</text></g>`;
  return `<svg viewBox="0 0 320 190" role="img" aria-hidden="true" focusable="false">${out}</svg>`;
}

/** The same picture drawn into a 2D canvas context of w x h pixels (the shop card). */
export function paintBlueprint(ctx, round, w, h) {
  const { rects, x0, x1, top } = blueprintRects(round),
    pad = Math.min(w, h) * 0.12,
    scale = Math.min((w - 2 * pad) / (x1 - x0), (h - 2 * pad) / top),
    ox = (w - (x1 - x0) * scale) / 2 - x0 * scale,
    gy = h - pad;
  ctx.fillStyle = '#143a5c';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#e8f1f7';
  ctx.lineWidth = Math.max(1.5, w / 90);
  ctx.beginPath();
  ctx.moveTo(pad * 0.4, gy);
  ctx.lineTo(w - pad * 0.4, gy);
  ctx.stroke();
  for (const r of rects) {
    const x = ox + r.x * scale,
      y = gy - (r.y + r.h) * scale;
    ctx.fillStyle = 'rgba(232,241,247,0.14)';
    ctx.fillRect(x, y, r.w * scale, r.h * scale);
    ctx.strokeRect(x, y, r.w * scale, r.h * scale);
  }
}

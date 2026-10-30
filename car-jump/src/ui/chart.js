// Parent Zone charts (Oct 30: "some sort of chart to the parents reporting for each game so we can see progress
// over time"): one inline SVG over calendar days, no library, no network, drawn only inside the PIN-locked Parent
// Zone (Spell Jump, Trail Blazer and Fraction Fright import it from /spell-jump/).
//   dayChart({ days, series, left, right, height }) → <figure class="pz-chart"> (the legend, the SVG, a caption)
//     days:   ['YYYY-MM-DD', …] ascending (lastDays(n, now) builds the last n)
//     series: [{ label, color, values: (number | null)[] (one per day; null = no data that day), kind: 'line' | 'bar',
//               axis: 'left' | 'right' (right is a percentage, 0..100), dashed?: bool }]
//     left:   { max?: number (else the series' max, rounded up), unit?: string } · right: { label?: '%' }
//   lastDays(n, now) → the day keys; dayKey(ms) → 'YYYY-MM-DD' (local time, the same as the games' own)
// The SVG scales to its box (viewBox); labels every few days; a caption says "no data yet" when every value is empty.
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (ms) => { const t = new Date(ms); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
export function lastDays(n, now = Date.now()) {
  const out = [];
  const t = new Date(now); t.setHours(12, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(t.getTime() - i * 86400000));
  return out;
}
const SVG = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  for (const kid of kids) if (kid != null) e.append(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  return e;
}
const html = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  for (const kid of kids) if (kid != null) e.append(kid);
  return e;
};
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
/** A friendly axis top: 5, 10, 20, 25, 50, 100, 200 … at or above the value (never 0). */
export function niceMax(v) {
  if (!(v > 0)) return 5;
  const steps = [1, 2, 4, 5, 10, 20, 25, 40, 50, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000];
  for (const s of steps) if (s >= v) return s;
  return Math.ceil(v / 1000) * 1000;
}
const dayLabel = (k, short) => {
  const t = new Date(k + 'T12:00:00');
  return short ? t.toLocaleDateString('en-US', { weekday: 'short' }) : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export function dayChart({ days = [], series = [], left = {}, right = {}, height = 200, title = '', id = '' } = {}) {
  const W = 640, H = height, ML = 38, MR = series.some((s) => s.axis === 'right') ? 40 : 14, MT = 12, MB = 26;
  const n = Math.max(1, days.length);
  const iw = W - ML - MR, ih = H - MT - MB;
  const step = iw / n;
  const x = (i) => ML + (i + 0.5) * step;
  const leftSeries = series.filter((s) => s.axis !== 'right');
  const lmax = niceMax(left.max != null ? left.max : Math.max(0, ...leftSeries.flatMap((s) => s.values.filter(isNum))));
  const yL = (v) => MT + ih - (Math.max(0, Math.min(lmax, v)) / lmax) * ih;
  const yR = (v) => MT + ih - (Math.max(0, Math.min(100, v)) / 100) * ih;
  const y = (s, v) => (s.axis === 'right' ? yR(v) : yL(v));
  const any = series.some((s) => s.values.some((v) => isNum(v) && v > 0));
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'pz-chart-svg', role: 'img', 'aria-label': title || 'chart', preserveAspectRatio: 'none' });
  const g = el('g', { class: 'grid' });
  for (const f of [0, 0.5, 1]) {
    const yy = MT + ih - f * ih;
    g.append(el('line', { x1: ML, x2: W - MR, y1: yy, y2: yy, class: f === 0 ? 'axis' : 'gridline' }));
    g.append(el('text', { x: ML - 6, y: yy + 4, 'text-anchor': 'end', class: 'tick' }, `${lmax % 2 && f === 0.5 ? (lmax * f).toFixed(1) : Math.round(lmax * f)}${left.unit || ''}`));
    if (MR > 14) g.append(el('text', { x: W - MR + 6, y: yy + 4, 'text-anchor': 'start', class: 'tick' }, `${Math.round(100 * f)}${right.label || '%'}`));
  }
  svg.append(g);
  // day labels: every k-th day so about 6 fit
  const k = Math.max(1, Math.ceil(n / 6));
  const labels = el('g', { class: 'days' });
  // consecutive days (a week or less) are named by weekday; sparse dates (test days) and longer ranges by month + day
  const consecutive = days.every((d, i) => !i || new Date(d + 'T12:00:00') - new Date(days[i - 1] + 'T12:00:00') === 86400000);
  days.forEach((d, i) => { if ((n - 1 - i) % k === 0) labels.append(el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', class: 'tick' }, dayLabel(d, consecutive && n <= 7))); });
  svg.append(labels);
  // bars first (behind the lines), split side by side when several
  const bars = series.filter((s) => s.kind === 'bar');
  bars.forEach((s, bi) => {
    const bw = Math.max(2, (step * 0.62) / bars.length);
    const grp = el('g', { class: 'bars', 'data-series': s.label, fill: s.color });
    s.values.forEach((v, i) => {
      if (!isNum(v)) return;
      const top = y(s, v);
      grp.append(el('rect', { x: x(i) - (step * 0.62) / 2 + bi * bw, y: top, width: bw - (bars.length > 1 ? 1 : 0), height: Math.max(0, MT + ih - top), rx: 2 }));
    });
    svg.append(grp);
  });
  for (const s of series.filter((q) => q.kind !== 'bar')) {
    let d = '', open = false;
    const dots = el('g', { class: 'dots', fill: s.color });
    s.values.forEach((v, i) => {
      if (!isNum(v)) { open = false; return; }
      d += `${open ? 'L' : 'M'}${x(i).toFixed(1)} ${y(s, v).toFixed(1)}`;
      open = true;
      if (n <= 31) dots.append(el('circle', { cx: x(i), cy: y(s, v), r: 2.6 }));
    });
    if (d) svg.append(el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': s.dashed ? '6 5' : null, 'data-series': s.label }));
    svg.append(dots);
  }
  const legend = html('div', { class: 'pz-legend' }, ...series.map((s) => html('span', { class: 'lg', 'data-series': s.label }, html('i', { class: `sw ${s.kind === 'bar' ? 'bar' : 'line'}${s.dashed ? ' dashed' : ''}`, style: `--c:${s.color}` }), s.label)));
  const fig = html('figure', { class: 'pz-chart', id: id || null, 'data-empty': String(!any) }, title ? html('figcaption', {}, title) : null, legend, svg,
    any ? null : html('div', { class: 'pz-chart-empty' }, 'No data yet: the chart fills in as they play.'));
  return fig;
}

/** A segmented range picker for the charts (4 weeks / 12 weeks); onChange(days). */
export function rangeChips(current, onChange, id = 'chart-range') {
  const wrap = html('div', { class: 'pz-chips', id, role: 'tablist' });
  for (const [n, label] of [[14, '2 weeks'], [28, '4 weeks'], [84, '12 weeks']]) {
    const b = html('button', { class: 'chip' + (n === current ? ' on' : ''), role: 'tab', 'aria-selected': String(n === current), 'data-days': String(n), 'data-sfx': '' }, label);
    b.addEventListener('click', () => { if (n !== current) onChange(n); });
    wrap.append(b);
  }
  return wrap;
}

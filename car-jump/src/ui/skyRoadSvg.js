// The Sky Road as a small SVG (the title's Sky card and the track screen's locked gate): 15 cloud stones climbing to the Sky Gate,
// the ones walked so far in gold. Pure string builder; no DOM.
import { SKY_ROAD_STEPS } from '../meta/skyRoad.js';

export function miniRoadSvg(n) {
  const done = n >= SKY_ROAD_STEPS;
  let out = '<svg viewBox="0 0 66 40" xmlns="http://www.w3.org/2000/svg">';
  out += '<path d="M53 15 a5 6 0 0 1 10 0 v9 h-10 z" fill="' + (done ? '#ffe08a' : 'rgba(255,255,255,.3)') + '" stroke="' + (done ? '#fff6cf' : 'rgba(255,255,255,.75)') + '" stroke-width="1.4"/>';
  for (let i = 1; i <= SKY_ROAD_STEPS; i++) {
    const u = (i - 0.5) / SKY_ROAD_STEPS;
    const x = 4 + 44 * u + 3 * Math.sin(u * 7), y = 35 - 19 * u - 3 * Math.sin(u * Math.PI);
    const on = i <= n;
    out += '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="' + (3.4 - 1.1 * u).toFixed(2) + '" ry="' + (2 - 0.6 * u).toFixed(2) + '" fill="' + (on ? '#ffcf1a' : 'rgba(255,255,255,.42)') + '"' + (on ? ' stroke="#fff3c0" stroke-width=".6"' : '') + '/>';
  }
  return out + '</svg>';
}

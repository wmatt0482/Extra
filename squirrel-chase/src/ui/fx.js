// Small DOM helpers the screens share: art as a node, and the flights (the plane / train between two cities, a letter onto the sign).
import { h } from '../../../spell-jump/src/ui/dom.js';

/** Art that may be an SVG string or an element, as an element with the given class. */
export function artBox(art, cls = '', label = '') {
  const el = h('span', { class: `art ${cls}`.trim(), 'aria-hidden': label ? null : 'true', role: label ? 'img' : null, 'aria-label': label || null });
  if (art && typeof art === 'object' && art.nodeType === 1) el.append(art);
  else el.innerHTML = String(art || '');
  return el;
}
const rectOf = (el) => (el ? el.getBoundingClientRect() : null);
const centre = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const reduced = () => document.documentElement.classList.contains('reduced-motion') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

/** Fly a small element from one rect to another (fixed position, Web Animations). Resolves when it lands. */
export function fly(el, from, to, { ms = 700, arc = 40, rotate = 0 } = {}) {
  document.body.append(el);
  const a = centre(from), b = centre(to);
  const w = el.offsetWidth || 32, hh = el.offsetHeight || 32;
  el.style.cssText += `;position:fixed;left:${a.x - w / 2}px;top:${a.y - hh / 2}px;z-index:300;pointer-events:none;margin:0`;
  const dx = b.x - a.x, dy = b.y - a.y;
  const done = () => { el.remove(); };
  if (reduced() || !el.animate) { done(); return Promise.resolve(); }
  const anim = el.animate([
    { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
    { transform: `translate(${dx / 2}px,${dy / 2 - arc}px) scale(1.25) rotate(${rotate / 2}deg)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px,${dy}px) scale(.9) rotate(${rotate}deg)`, opacity: 1 },
  ], { duration: ms, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'forwards' });
  return anim.finished.then(done, done);
}
export const rectOfEl = rectOf;
export const isReduced = reduced;

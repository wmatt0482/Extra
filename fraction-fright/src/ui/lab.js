// The Zombie Lab (SPEC §4): the short lesson before the first street (Nuraydin et al. 2022: the same game without a
// lesson did not transfer), replayable from the title. About 60–90 s, interactive, one line of at most 8 words on
// screen at a time (read aloud too), arrows instead of text where possible.
//   1  "A fraction is a number on the road."          the road 0 → 1, with 0, ½ and 1 labelled
//   2  "Drag to cut the road into 4 jumps."          the kid drags a jump size from 0; 4 equal jumps land on 1;
//                                                      the jumps are named ¼, 2/4, ¾
//   3  "Lob slime at three quarters!"                 throw 1 (a real throw, recorded like any other)
//   4  "Drag to cut the road into 3 jumps."          ⅓, ⅔
//   5  "Lob slime at two thirds!"                     throw 2
//   6  "½ is the same spot on every road."            2/4, 3/6 and 4/8 line up on ½ (the benchmark)
//   7  "Lob slime at four eighths!"                   throw 3 (it lands on ½)
//   8  "+100 XP · Streets open"
// After a throw the true spot is shown (the flag and the fraction drawn as jumps) with "N % close"; a throw off the
// spot gets one more try, then the lab shows it and moves on (no score, nothing lost).
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { classify, closeText, fracName, isHit, paeOf } from '../skills/items.js';

const NS = 'http://www.w3.org/2000/svg';
const X0 = 90, X1 = 910, Y = 170;          // the road in the SVG (viewBox 0 0 1000 300)
const sx = (x01) => X0 + x01 * (X1 - X0);
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); return e; };
const TOL = 0.10;

export const LAB_STEPS = [
  { id: 'intro', say: 'A fraction is a number on the road.' },
  { id: 'cut4', say: 'Drag to cut the road into 4 jumps.', parts: 4 },
  { id: 'tap34', say: 'Lob slime at three quarters!', n: 3, d: 4 },
  { id: 'cut3', say: 'Drag to cut the road into 3 jumps.', parts: 3 },
  { id: 'tap23', say: 'Lob slime at two thirds!', n: 2, d: 3 },
  { id: 'half', say: '½ is the same spot on every road.', voice: 'One half is the same spot on every road.' },
  { id: 'tap48', say: 'Lob slime at four eighths!', n: 4, d: 8 },
  { id: 'done', say: '+100 XP · Streets open', voice: 'Streets open!' },
];

export function createLab(app) {
  const body = $('#lab-body'), foot = $('#lab-foot'), dots = $('#lab-steps');
  let step = 0, tries = 0, cutDone = false, busy = false, raf = 0, timers = [], firstRun = true;
  const say = h('p', { class: 'lab-say', id: 'lab-say', 'aria-live': 'polite' });
  const sub = h('p', { class: 'lab-sub', id: 'lab-sub' });
  const svg = svgEl('svg', { class: 'lab-road', id: 'lab-road', viewBox: '0 0 1000 300', preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': 'The road: a number line from 0 to 1' });
  body.replaceChildren(say, svg, sub);
  $('#lab-back').addEventListener('click', () => app.labExit());

  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  function clearTimers() { for (const t of timers) clearTimeout(t); timers = []; cancelAnimationFrame(raf); }
  function line(text, voice) { say.textContent = text; app.say(voice || text.replace('½', 'one half')); }

  // ---------- drawing ----------
  let layer = null;
  function road({ parts = 0, labels = [], ghost = null, extra = '' } = {}) {
    svg.replaceChildren();
    svg.append(svgEl('rect', { x: X0 - 30, y: Y - 22, width: X1 - X0 + 60, height: 44, rx: 12, fill: '#2c2b31' }));
    svg.append(svgEl('line', { x1: X0, y1: Y, x2: X1, y2: Y, stroke: '#fff3d6', 'stroke-width': 5 }));
    for (let k = 1; k < parts; k++) svg.append(svgEl('line', { x1: sx(k / parts), y1: Y - 14, x2: sx(k / parts), y2: Y + 14, stroke: '#fff3d6', 'stroke-width': 3, opacity: 0.85, class: 'lab-tick' }));
    // 0, ½ and 1 stay labelled, always
    for (const [x, t] of [[0, '0'], [0.5, '½'], [1, '1']]) {
      svg.append(svgEl('line', { x1: sx(x), y1: Y - 22, x2: sx(x), y2: Y + 22, stroke: '#fff3d6', 'stroke-width': 5 }));
      const tx = svgEl('text', { x: sx(x), y: Y + 66, 'text-anchor': 'middle', 'font-size': 40, fill: '#fff', stroke: '#0e0d10', 'stroke-width': 6, 'paint-order': 'stroke', class: 'lab-label' }); tx.textContent = t; svg.append(tx);
    }
    for (const l of labels) {
      const tx = svgEl('text', { x: sx(l.at), y: Y - 74, 'text-anchor': 'middle', 'font-size': 34, fill: '#ffcf3a', stroke: '#0e0d10', 'stroke-width': 6, 'paint-order': 'stroke', class: 'lab-name', 'data-at': l.at }); tx.textContent = l.text; svg.append(tx);
    }
    if (ghost != null) {
      const g = svgEl('g', { class: 'lab-ghost', opacity: 0.8 });
      g.append(svgEl('path', { d: `M${sx(0)} ${Y - 8} Q ${sx(ghost / 2)} ${Y - 90} ${sx(ghost)} ${Y - 8}`, fill: 'none', stroke: '#a6ff2e', 'stroke-width': 4, 'stroke-dasharray': '10 8' }));
      g.append(svgEl('path', { d: `M${sx(ghost) - 12} ${Y - 30} L${sx(ghost)} ${Y - 8} L${sx(ghost) + 12} ${Y - 30} Z`, fill: '#a6ff2e' }));
      svg.append(g);
    }
    if (extra) svg.insertAdjacentHTML('beforeend', extra);
    layer = svgEl('g', { class: 'lab-layer' });
    svg.append(layer);
  }
  function jumps(unit, count, color = '#ffcf3a', y = Y) {
    const g = svgEl('g', { class: 'lab-jumps', 'data-count': count });
    for (let k = 0; k < count; k++) {
      const a = sx(k * unit), b = sx((k + 1) * unit);
      g.append(svgEl('path', { d: `M${a} ${y - 6} Q ${(a + b) / 2} ${y - 6 - Math.max(30, (b - a) * 0.55)} ${b} ${y - 6}`, fill: 'none', stroke: color, 'stroke-width': 4 }));
    }
    return g;
  }
  function flag(x01, text) {
    const g = svgEl('g', { class: 'lab-flag' });
    g.append(svgEl('rect', { x: sx(x01) - 2, y: Y - 92, width: 4, height: 92, fill: '#fff' }));
    g.append(svgEl('path', { d: `M${sx(x01) + 2} ${Y - 92} L${sx(x01) + 48} ${Y - 80} L${sx(x01) + 2} ${Y - 68} Z`, fill: '#ffcf3a' }));
    const t = svgEl('text', { x: sx(x01) + 26, y: Y - 104, 'text-anchor': 'middle', 'font-size': 26, fill: '#ffcf3a', stroke: '#0e0d10', 'stroke-width': 5, 'paint-order': 'stroke' }); t.textContent = text; g.append(t);
    return g;
  }
  function reticle(x01) {
    let r = svg.querySelector('.lab-reticle');
    if (!r) { r = svgEl('g', { class: 'lab-reticle' }); r.append(svgEl('circle', { r: 18, fill: 'none', stroke: '#a6ff2e', 'stroke-width': 4 }), svgEl('line', { x1: 0, y1: -70, x2: 0, y2: -18, stroke: '#a6ff2e', 'stroke-width': 3, 'stroke-dasharray': '8 6' })); svg.append(r); }
    r.setAttribute('transform', `translate(${sx(x01)} ${Y})`);
  }

  // ---------- input: drag along the road, let go ----------
  const toX01 = (e) => {
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return 0.5;
    const p = pt.matrixTransform(m.inverse());
    return Math.max(0, Math.min(1, (p.x - X0) / (X1 - X0)));
  };
  let dragging = false;
  svg.addEventListener('pointerdown', (e) => { if (busy) return; dragging = true; try { svg.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } move(toX01(e)); });
  svg.addEventListener('pointermove', (e) => { if (dragging) move(toX01(e)); });
  svg.addEventListener('pointerup', (e) => { if (!dragging) return; dragging = false; act(toX01(e)); });
  svg.addEventListener('pointercancel', () => { dragging = false; });

  function move(x) {
    const s = LAB_STEPS[step];
    if (s.parts && !cutDone) {
      // the jump size follows the finger: equal jumps from 0 as far as the road goes
      layer.replaceChildren();
      const unit = Math.max(0.05, x);
      layer.append(jumps(unit, Math.max(1, Math.floor(1 / unit + 1e-6)), '#a6ff2e'));
    } else if (s.d) reticle(x);
  }
  /** The kid let go at x (0 … 1): the step's action (also the test hook). */
  function act(x) {
    const s = LAB_STEPS[step];
    if (busy) return false;
    if (s.parts && !cutDone) return cut(x, s.parts);
    if (s.d) return lob(x, s);
    return false;
  }

  function cut(x, parts) {
    const unit = 1 / parts;
    if (Math.abs(x - unit) <= 0.04) {
      cutDone = true; busy = true;
      app.sfx.cure();
      road({ parts });
      layer.append(jumps(unit, parts, '#a6ff2e'));
      const names = parts === 4 ? ['¼', '2/4', '¾'] : ['⅓', '⅔'];
      const spoken = parts === 4 ? ['one quarter', 'two quarters', 'three quarters'] : ['one third', 'two thirds'];
      line(parts === 4 ? 'Four equal jumps!' : 'Three equal jumps!');
      names.forEach((t, i) => later(() => {
        const tx = svgEl('text', { x: sx((i + 1) * unit), y: Y - 74, 'text-anchor': 'middle', 'font-size': 34, fill: '#ffcf3a', stroke: '#0e0d10', 'stroke-width': 6, 'paint-order': 'stroke', class: 'lab-name' });
        tx.textContent = t; layer.append(tx); app.say(spoken[i]);
      }, 500 + i * 700));
      later(() => { busy = false; next(); }, 900 + names.length * 700);
      return true;
    }
    tries++;
    app.audio.oops(true);
    road({ ghost: tries >= 2 ? unit : null });
    line(`${parts} equal jumps land right on 1.`, `${parts} equal jumps land right on 1. Try again!`);
    return false;
  }

  function lob(x, s) {
    busy = true;
    const ret = svg.querySelector('.lab-reticle');
    if (ret) ret.remove();
    const target = s.n / s.d;
    const pae = paeOf(x, target);
    const result = classify(x - target, TOL);
    app.sfx.lob();
    const ball = svgEl('circle', { r: 14, fill: app.gooColor(), stroke: '#1d3b10', 'stroke-width': 3, class: 'lab-ball' });
    layer.append(ball);
    const t0 = performance.now(), dur = app.reducedMotion() ? 1 : 520;
    const fx = 500, fy = 300, tx = sx(x);
    const fly = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      ball.setAttribute('cx', String(fx + (tx - fx) * k));
      ball.setAttribute('cy', String(fy + (Y - fy) * k - Math.sin(Math.PI * k) * 200));
      if (k < 1) { raf = requestAnimationFrame(fly); return; }
      landed(x, s, result, pae);
    };
    raf = requestAnimationFrame(fly);
    return true;
  }
  function landed(x, s, result, pae) {
    const target = s.n / s.d;
    app.sfx.land(result);
    app.recordLabThrow({ n: s.n, d: s.d, pae, result });
    layer.append(svgEl('ellipse', { cx: sx(x), cy: Y, rx: isHit(result) ? 44 : 18, ry: isHit(result) ? 18 : 8, fill: app.gooColor(), opacity: isHit(result) ? 0.95 : 0.55, class: 'lab-splat', 'data-result': result }));
    // the true spot: the flag and the fraction drawn as jumps
    layer.append(jumps(1 / s.d, s.n), flag(target, `${s.n}/${s.d}`));
    if (isHit(result)) {
      line(result === 'bull' ? `Bullseye! ${closeText(pae)}` : `Thunk! ${closeText(pae)}`);
      later(() => { busy = false; next(); }, 1500);
      return;
    }
    tries++;
    if (tries >= 2) {
      line(`${closeText(pae)}. Here it is!`, `${closeText(pae)}. Here is ${fracName(s.n, s.d)}.`);
      later(() => { busy = false; next(); }, 2200);
      return;
    }
    line(`${closeText(pae)}. Here it is! Again!`, `${closeText(pae)}. Here it is. One more time!`);
    later(() => { busy = false; showStep(); }, 2200);
  }

  // ---------- steps ----------
  function paintDots() { dots.replaceChildren(...LAB_STEPS.slice(0, -1).map((_, i) => h('i', { class: i <= step ? 'on' : '' }))); }
  function nextBtn(text = 'Next') {
    const b = h('button', { class: 'btn btn-slime btn-big', id: 'lab-next', 'data-sfx': '' }, text, h('span', { html: app.icon('right') }));
    b.addEventListener('click', next);
    return b;
  }
  function showStep() {
    clearTimers();
    const s = LAB_STEPS[step];
    cutDone = false; busy = false;
    sub.textContent = '';
    foot.replaceChildren();
    paintDots();
    body.dataset.step = s.id;
    if (s.id === 'intro') {
      road({ extra: `<path d="M${sx(0)} ${Y - 50} L${sx(1) - 20} ${Y - 50}" stroke="#a6ff2e" stroke-width="6" stroke-dasharray="14 10"/><path d="M${sx(1) - 30} ${Y - 64} L${sx(1)} ${Y - 50} L${sx(1) - 30} ${Y - 36} Z" fill="#a6ff2e"/>` });
      foot.append(nextBtn());
    } else if (s.parts) {
      road({});
      layer.append(svgEl('circle', { cx: sx(0), cy: Y, r: 14, fill: '#a6ff2e', class: 'lab-start' }));
    } else if (s.d) {
      road({ parts: s.d });                // the cut stays as ticks (count the jumps); only 0, ½ and 1 are named
      reticle(0.5);
    } else if (s.id === 'half') {
      const rows = [[4, '2/4'], [6, '3/6'], [8, '4/8']];
      let extra = `<line x1="${sx(0.5)}" y1="8" x2="${sx(0.5)}" y2="${Y + 24}" stroke="#ffd23a" stroke-width="4" stroke-dasharray="10 8"/>`;
      rows.forEach(([dd, t], i) => {
        const y = 22 + i * 44;
        extra += `<line x1="${X0}" y1="${y}" x2="${X1}" y2="${y}" stroke="#b9b3a3" stroke-width="4"/>`;
        for (let k = 0; k <= dd; k++) extra += `<line x1="${sx(k / dd)}" y1="${y - 11}" x2="${sx(k / dd)}" y2="${y + 11}" stroke="#b9b3a3" stroke-width="4"/>`;
        extra += `<text x="${sx(0.5) + 12}" y="${y - 6}" font-size="30" fill="#ffd23a" stroke="#0e0d10" stroke-width="6" paint-order="stroke" class="lab-same">${t}</text>`;
      });
      road({ extra });
      foot.append(nextBtn());
    } else if (s.id === 'done') {
      road({ labels: [{ at: 0.25, text: '¼' }, { at: 0.75, text: '¾' }] });
      const r = app.finishLab();
      body.dataset.first = String(!!r.first);
      foot.append(nextBtn('Streets'));
      foot.firstChild.id = 'lab-streets';
      app.audio.fanfare();
      if (!r.first) { line('Lab done. Streets open.'); return; }   // the +100 XP is for the first time only
    }
    line(s.say, s.voice);
  }
  function next() {
    tries = 0;
    if (step >= LAB_STEPS.length - 1) { app.labExit({ toStreets: true }); return; }
    step += 1;
    showStep();
  }

  return {
    show() { step = 0; tries = 0; firstRun = !app.labDone(); showStep(); },
    hide() { clearTimers(); dragging = false; app.tts.cancel(); },
    get step() { return LAB_STEPS[step].id; },
    get busy() { return busy; },
    get firstRun() { return firstRun; },
    act, next,
  };
}

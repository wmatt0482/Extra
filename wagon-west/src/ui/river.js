// The river crossing (SPEC v1.2 §3 "Rivers are a choice", §12): at a river stop the child picks how to cross, on a
// choice card with three big buttons and one line each:
//   Ford   "Walk the wagon across. Tap on the calm water."  the scene's timing tap (scene.startFord({ seed, width })):
//          each push says "Good push!" or "Whoa, a wave!" on the card's status line; fordEnd { soaked } →
//          crossRiver(J, { how: 'ford', soaked })
//   Float  "Raft it over: toss the rope, then steer past the rocks."  the rope toss first (below), then the scene's
//          steering run (scene.startFloat): bumps counted, floatEnd { bumps } → crossRiver(J, { how: 'float', bumps })
//   Ferry  "The ferryman's fare: spell this week's three words."  Spell Jump's spell panel, dictated by the voice (Look
//          → Cover → Write with its fix-it routine; main.js app.spellWords records each through recordSpell in the
//          child's own Spell Jump word store) → crossRiver(J, { how: 'ferry' })
// The crossing's result (the journey's crossRiver: { line, say, soakedLb, ropeUsed, skill }) is shown and read aloud; a
// soaked sack gets its own line ("A sack of flour got soaked. Soggy biscuits tonight!"), a coil of rope used up and a
// companion's skill (Tomas the carpenter) get theirs (app.skillLine). Nothing is lost at a river but a sack of flour, and
// there is no timer anywhere: the scene waits for the child's own taps and drags.
// The rope toss (v1.0, kept): an SVG number line from this bank (0) to the far bank (1), with 0, ½ and 1 labelled
// (Fraction Fright's rule), the landing fraction said and shown ("the landing is three quarters of the way across"); the
// child drags the rope's aim along the line (or ← →) and taps THROW (or Enter). The landing post shows after every
// throw. Within Fraction Fright's tolerance for the child's tier (toleranceFor, main.js app.ropeFraction) the rope
// catches; a miss is a wet boot and one more throw; after that the ferryman hauls the rope in anyway. "Fractions at
// rivers" off (Parents → Options) skips the rope toss.
import { $, h } from '../../../spell-jump/src/ui/dom.js';

const NS = 'http://www.w3.org/2000/svg';
const X0 = 70, X1 = 930, LINE_Y = 206;
const sx = (v) => X0 + (X1 - X0) * v;
function el(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  for (const k of kids) if (k != null) e.append(typeof k === 'string' ? document.createTextNode(k) : k);
  return e;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The three ways across, with the one line each says. */
export const RIVER_OPTS = Object.freeze([
  { how: 'ford', emoji: '🚶', name: 'Ford', line: 'Walk the wagon across. Tap on the calm water.' },
  { how: 'float', emoji: '🛶', name: 'Float', line: 'Raft it over: toss the rope, then steer past the rocks.' },
  { how: 'ferry', emoji: '⛴️', name: 'Ferry', line: "The ferryman's fare: spell this week's three words." },
]);
export const RIVER_PROMPT = 'How will you cross the river?';
export const RIVER_SAY = `${RIVER_PROMPT} Ford, float, or ferry?`;
export const FORD_LINES = Object.freeze({ title: 'Ford the river', start: 'Tap on the calm water.', good: 'Good push!', bad: 'Whoa, a wave!' });
export const FLOAT_LINES = Object.freeze({ title: 'Float across', start: 'Drag left and right to steer past the rocks.', bump: 'Bump! A rock. Hold on.' });
export const SOAKED_LINE = 'A sack of flour got soaked. Soggy biscuits tonight!';
export const ROPE_LINE = 'The rope held the raft steady. One coil is used up.';
/** Every fixed line the crossing may say (for the natural voice to prepare). */
export const riverChoiceTexts = () => [RIVER_SAY, FORD_LINES.start, FLOAT_LINES.start, SOAKED_LINE, ROPE_LINE];

/** What the ferryman says about a landing (said = "three quarters"): every line, for the natural voice to prepare. */
export const riverLines = (said) => ({
  hear: `The landing is ${said} of the way across.`,
  start: `Rope toss! The landing is ${said} of the way across.`,
  again: `Splash! A wet boot. The landing is ${said} of the way across. One more throw.`,
  close: `Close! The ferryman hauls the rope in. The landing was ${said} of the way across.`,
});
export const RIVER_FIXED = ['Caught the landing!', 'Caught it this time!'];
export const riverTexts = (said) => [...Object.values(riverLines(said)), ...RIVER_FIXED];

export function createRiver(app) {
  const screenEl = $('#screen-river');
  const title = $('#rv-title');
  const choice = $('#rv-choice');
  const opts = $('#rv-opts');
  const words = $('#rv-words');
  const rope = $('#rv-rope');
  const svg = $('#rv-svg');
  const fracBig = $('#rv-frac');
  const fracSay = $('#rv-frac-say');
  const msg = $('#rv-msg');
  const throwBtn = $('#rv-throw');
  const hearBtn = $('#rv-hear');
  const play = $('#rv-play');
  const playTitle = $('#rv-play-title');
  const status = $('#rv-status');
  const result = $('#rv-result');
  const foot = $('#rv-foot');
  const goBtn = $('#rv-go');
  let R = null;         // the rope toss: { f: {n, d, tol, say}, aim, throws, waiter, dragging, done }
  let onDone = null;
  let cur = null;       // the crossing in progress: { cancelled, wake }
  let last = null;      // (tests) the last crossing's choice and result

  // ---------- the rope toss ----------
  function draw() {
    if (!R) return;
    const kids = [
      el('rect', { x: 0, y: 0, width: 1000, height: 260, rx: 18, fill: '#bfe0ee' }),
      el('rect', { x: 0, y: 60, width: 1000, height: 120, fill: '#5aa5cf' }),
      el('path', { d: 'M0 92 Q 60 82 120 92 T 240 92 T 360 92 T 480 92 T 600 92 T 720 92 T 840 92 T 960 92 T 1080 92', fill: 'none', stroke: '#9fd0ea', 'stroke-width': 4, opacity: '.8' }),
      el('path', { d: 'M0 142 Q 60 132 120 142 T 240 142 T 360 142 T 480 142 T 600 142 T 720 142 T 840 142 T 960 142 T 1080 142', fill: 'none', stroke: '#9fd0ea', 'stroke-width': 4, opacity: '.6' }),
      el('rect', { x: 0, y: 40, width: X0, height: 220, fill: '#a07a4c' }),
      el('rect', { x: X1, y: 40, width: 1000 - X1, height: 220, fill: '#8fbf5f' }),
      el('line', { x1: X0, y1: LINE_Y, x2: X1, y2: LINE_Y, stroke: '#3a2416', 'stroke-width': 5, 'stroke-linecap': 'round' }),
    ];
    for (const [v, t] of [[0, '0'], [0.5, '½'], [1, '1']]) {
      kids.push(el('line', { x1: sx(v), y1: LINE_Y - 12, x2: sx(v), y2: LINE_Y + 12, stroke: '#3a2416', 'stroke-width': 5 }));
      kids.push(el('text', { x: sx(v), y: LINE_Y + 42, 'text-anchor': 'middle', class: 'rv-tick' }, t));
    }
    // after a throw: the rope's arc, the landing post (the true spot), a ring or a splash
    if (R.last) {
      const ax = sx(R.last.aim);
      kids.push(el('path', { d: `M${X0} 50 Q ${(X0 + ax) / 2} -30 ${ax} ${LINE_Y - 30}`, fill: 'none', stroke: '#c8a46a', 'stroke-width': 5, 'stroke-dasharray': '10 6', class: 'rv-arc' }));
      if (!R.last.hit) kids.push(el('circle', { cx: ax, cy: LINE_Y - 30, r: 22, fill: 'none', stroke: '#fff', 'stroke-width': 4, opacity: '.85', class: 'rv-splash' }));
    }
    if (R.last || R.done) {
      const fx = sx(R.f.n / R.f.d);
      kids.push(el('g', { class: 'rv-post', 'data-at': (R.f.n / R.f.d).toFixed(3) },
        el('rect', { x: fx - 6, y: LINE_Y - 76, width: 12, height: 64, rx: 3, fill: '#6b4426' }),
        el('path', { d: `M${fx + 6} ${LINE_Y - 76} l34 10 l-34 10 z`, fill: '#d9653b' }),
        el('text', { x: fx, y: LINE_Y - 86, 'text-anchor': 'middle', class: 'rv-postlabel' }, `${R.f.n}/${R.f.d}`)));
      if (R.last && R.last.hit) kids.push(el('circle', { cx: fx, cy: LINE_Y - 30, r: 26, fill: 'none', stroke: '#7fb85a', 'stroke-width': 6 }));
    }
    // the aim: a rope coil on a pointer, draggable
    const ax = sx(R.aim);
    kids.push(el('g', { class: 'rv-aim', 'data-aim': R.aim.toFixed(3) },
      el('line', { x1: ax, y1: LINE_Y - 34, x2: ax, y2: LINE_Y + 14, stroke: '#f2b33d', 'stroke-width': 6, 'stroke-linecap': 'round' }),
      el('circle', { cx: ax, cy: LINE_Y - 46, r: 15, fill: '#f6e7c4', stroke: '#c8a46a', 'stroke-width': 7 }),
      el('circle', { cx: ax, cy: LINE_Y - 46, r: 5, fill: '#c8a46a' })));
    svg.replaceChildren(...kids);
  }
  const aimFrom = (e) => {
    const m = svg.getScreenCTM();
    if (!m) return R.aim;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(m.inverse());
    return Math.max(0, Math.min(1, (p.x - X0) / (X1 - X0)));
  };
  const canAim = () => R && !R.done && !R.flying;
  function setAim(v) { if (!canAim()) return; R.aim = Math.max(0, Math.min(1, v)); R.moved = true; draw(); }
  svg.addEventListener('pointerdown', (e) => { if (!canAim()) return; e.preventDefault(); R.dragging = true; try { svg.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } setAim(aimFrom(e)); });
  svg.addEventListener('pointermove', (e) => { if (R && R.dragging) setAim(aimFrom(e)); });
  for (const ev of ['pointerup', 'pointercancel']) svg.addEventListener(ev, () => { if (R) R.dragging = false; });
  window.addEventListener('keydown', (e) => {
    if (!canAim() || app.screen !== 'river' || rope.hidden || app.overlayOpen()) return;
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); setAim(R.aim + (e.shiftKey ? 0.05 : 0.01) * (e.code === 'ArrowLeft' ? -1 : 1)); }
    else if (e.code === 'Enter') { e.preventDefault(); throwNow(); }
  });
  throwBtn.addEventListener('click', () => throwNow());
  hearBtn.addEventListener('click', () => { if (R) app.say(riverLines(R.f.say).hear); });

  async function throwNow() {
    if (!canAim()) return;
    const st = R;
    R.flying = true;
    throwBtn.disabled = true;
    app.sfx.toss();
    await sleep(app.beat(450));
    if (R !== st) return;
    const target = R.f.n / R.f.d;
    const hit = Math.abs(R.aim - target) <= R.f.tol + 1e-9;
    R.throws += 1;
    R.last = { aim: R.aim, hit };
    R.flying = false;
    draw();
    if (hit) {
      app.sfx.thunk();
      setMsg(R.throws === 1 ? 'Caught the landing! Right on.' : 'Caught it this time!', 'go');
      app.say(R.throws === 1 ? 'Caught the landing!' : 'Caught it this time!');
      finishRope(true);
      return;
    }
    app.sfx.splash();
    if (R.throws < 2) {
      setMsg(`Splash! A wet boot. The landing is at ${R.f.n}/${R.f.d}. One more throw.`, 'hot');
      app.say(riverLines(R.f.say).again);
      throwBtn.disabled = false;
      return;
    }
    setMsg(`Close! The ferryman hauls the rope in. The landing was at ${R.f.n}/${R.f.d}.`, 'cyan');
    app.say(riverLines(R.f.say).close);
    finishRope(false);
  }
  function finishRope(hit) {
    R.done = true;
    R.hit = hit;
    throwBtn.disabled = true;
    draw();
    const w = R.waiter; R.waiter = null;
    if (w) setTimeout(() => w({ hit, throws: R.throws, f: `${R.f.n}/${R.f.d}` }), app.beat(900));
  }
  function setMsg(t, kind = '') { msg.textContent = t; msg.className = 'rv-msg' + (kind ? ' ' + kind : ''); }

  async function ropeToss() {
    const f = app.ropeFraction();
    R = { f, aim: 0.08, throws: 0, last: null, done: false, flying: false, dragging: false, waiter: null, moved: false };
    words.hidden = true;
    rope.hidden = false;
    fracBig.replaceChildren(h('span', { class: 'fn' }, String(f.n)), h('span', { class: 'fd' }, String(f.d)));
    fracSay.textContent = `The landing is ${f.say} of the way across.`;
    setMsg('Drag the rope to the landing, then THROW.', '');
    throwBtn.disabled = false;
    draw();
    app.voiceFor(riverTexts(f.say)).then(() => { if (R && R.f === f && !R.last) app.say(riverLines(f.say).start); });
    return new Promise((resolve) => { R.waiter = resolve; });
  }

  // ---------- the choice, the scene's ford and float, the result ----------
  function paintChoice() {
    const safe = app.v2.floatSafe();
    opts.replaceChildren(...RIVER_OPTS.map((o) => {
      const note = o.how === 'float' ? h('span', { class: 'rv-opt-note' + (safe.safe ? ' safe' : ''), 'data-safe': String(safe.safe) }, safe.safe ? safe.why : 'No rope: a bump can soak a sack of flour.') : null;
      const b = h('button', { class: 'card rv-opt', 'data-how': o.how, 'data-sfx': '' },
        h('span', { class: 'rv-opt-emoji', 'aria-hidden': 'true' }, o.emoji),
        h('span', { class: 'rv-opt-name' }, o.name),
        h('span', { class: 'rv-opt-line' }, o.line),
        note);
      b.addEventListener('click', () => { if (cur && cur.pick) { const p = cur.pick; cur.pick = null; p(o.how); } });
      return b;
    }));
  }
  /** Wait for a tap on one of the three ways across; null when the child left the river. */
  function choose(run) {
    paintChoice();
    choice.hidden = false;
    app.voiceFor([RIVER_SAY]).then(() => { if (cur === run && !run.cancelled && !choice.hidden) app.say(RIVER_SAY); });
    return new Promise((resolve) => { run.pick = resolve; run.wake = () => resolve(null); });
  }
  function setStatus(text, kind = '') { status.textContent = text; status.className = 'rv-status' + (kind ? ' ' + kind : ''); }
  function showPlay(name, line) {
    choice.hidden = true; words.hidden = true; rope.hidden = true;
    playTitle.textContent = name;
    setStatus(line);
    play.hidden = false;
    screenEl.classList.add('rv-playing');
  }
  function endPlayUi() { screenEl.classList.remove('rv-playing'); play.hidden = true; }

  async function ford(run, leg) {
    showPlay(FORD_LINES.title, FORD_LINES.start);
    app.voiceFor([FORD_LINES.start]).then(() => { if (cur === run && !run.cancelled) app.say(FORD_LINES.start); });
    const end = await app.v2.playMini('startFord', { seed: app.v2.seed('ford'), width: (leg.river && leg.river.width) || 'wide' },
      { end: 'fordEnd', types: ['ford'], onEvent: (e) => { if (e.good) setStatus(FORD_LINES.good, 'go'); else setStatus(FORD_LINES.bad, 'hot'); } });
    endPlayUi();
    if (!end || run.cancelled) return null;
    return app.v2.cross('ford', { soaked: Math.max(0, Number(end.soaked) || 0) });
  }
  async function float(run, leg) {
    let r = null;
    if (app.settings.fractions !== false) {
      words.hidden = true; choice.hidden = true;
      r = await ropeToss();
      if (run.cancelled || app.screen !== 'river') return null;
      rope.hidden = true;
    }
    last.rope = r;
    showPlay(FLOAT_LINES.title, FLOAT_LINES.start);
    app.voiceFor([FLOAT_LINES.start]).then(() => { if (cur === run && !run.cancelled) app.say(FLOAT_LINES.start); });
    let counted = 0;
    const end = await app.v2.playMini('startFloat', { seed: app.v2.seed('float'), width: (leg.river && leg.river.width) || 'wide' },
      { end: 'floatEnd', types: ['float'], onEvent: (e) => { if (e.bump) { counted += 1; setStatus(FLOAT_LINES.bump, 'hot'); } } });
    endPlayUi();
    if (!end || run.cancelled) return null;
    const bumps = Number.isFinite(Number(end.bumps)) ? Math.max(0, Number(end.bumps)) : counted;
    return app.v2.cross('float', { bumps });
  }
  async function ferry(run) {
    choice.hidden = true;
    words.hidden = false;
    const w = await app.spellWords(3, { context: 'river' });
    last.words = w;
    if (w.cancelled || run.cancelled) return null;
    words.hidden = true;
    return app.v2.cross('ferry', {});
  }
  function showResult(cr) {
    choice.hidden = true; words.hidden = true; rope.hidden = true;
    result.textContent = cr.line || 'You are across the river.';
    result.hidden = false;
    // the crossing's line, then a soaked sack's line and a used coil of rope's: shown at once, read aloud in turn; the
    // companion's skill line (Tomas) follows, since it speaks too
    const said = [cr.say || cr.line];
    if (cr.soakedLb > 0) { app.effectToast(SOAKED_LINE); said.push(SOAKED_LINE); }
    if (cr.ropeUsed) { app.effectToast(ROPE_LINE); said.push(ROPE_LINE); }
    app.voiceFor(said).then(() => app.sayAll(said)).then(() => { if (cr.skill && app.screen === 'river') app.skillLine(cr.skill); });
    app.scene.celebrate('river');
    app.sfx.cheer();
    foot.hidden = false;
  }

  goBtn.addEventListener('click', () => { if (onDone) { const d = onDone; onDone = null; d(); } });

  return {
    get rope() { return R ? { ...R, f: { ...R.f } } : null; },
    /** Tests: aim at v (0 … 1). */
    aimAt(v) { setAim(v); },
    throwNow,
    get last() { return last; },
    show() {},
    /** Leaving the river (the back button, the pause menu, a sync): end whatever the scene is running; the crossing
     *  resolves { cancelled: true } and nothing is lost. */
    hide() {
      const c = cur;
      cur = null;
      if (c) { c.cancelled = true; if (c.wake) c.wake(); }
      if (R && R.waiter) { const w = R.waiter; R.waiter = null; w(null); }
      app.v2.endPlay();
      endPlayUi();
    },
    /** The whole crossing. Resolves { how, words?, rope?, result } or { cancelled }. */
    async run({ leg }) {
      R = null;
      onDone = null;
      const run = { cancelled: false, pick: null, wake: null };
      cur = run;
      last = { how: '', words: null, rope: null, result: null };
      app.go('river');
      cur = run;                      // (app.go hides the screens it leaves, not this one)
      title.textContent = `${(leg.stop && leg.stop.name) || leg.name} crossing`;
      choice.hidden = true; words.hidden = true; rope.hidden = true; play.hidden = true; result.hidden = true; foot.hidden = true;
      screenEl.classList.remove('rv-playing');
      setMsg('');
      app.scene.setBackdrop('river');
      await sleep(app.beat(500));
      if (cur !== run) return { cancelled: true };
      const how = await choose(run);
      if (!how || cur !== run) return { cancelled: true };
      last.how = how;
      let cr = null;
      if (how === 'ford') cr = await ford(run, leg);
      else if (how === 'float') cr = await float(run, leg);
      else cr = await ferry(run);
      if (!cr || cur !== run || app.screen !== 'river') return { cancelled: true, words: last.words };
      last.result = cr;
      showResult(cr);
      app.v2.checkDeeds();
      await new Promise((resolve) => { onDone = resolve; });
      if (cur === run) cur = null;
      return { how, words: last.words, rope: last.rope, result: cr };
    },
  };
}

// Rendering budgets (SPEC §6) and the adaptive quality controller. The scene starts at no more than 1.5x device pixels
// and steps down to 1, 0.75 and 0.6 after sustained slow frames, halving the shadow map at the lower tiers and, as a
// last resort on a phone, drawing contact discs only. It never steps back up within a session: a device that was slow
// once is likely to be slow again, and flickering resolution is worse than a slightly softer image.
//
// Phones get their own device tier (chosen once, from touch support, the screen size and the pointer type): a 512
// shadow map that redraws on every other frame, fewer particles and tire marks, at most two physics steps a frame and
// interpolated drawing so motion stays smooth at 30 fps. A one-second benchmark of the first frames can start the
// phone below 1.5x when the device is clearly slow. Every decision is kept in a log the Parent Zone report shows.

/** The device tiers. `maxSteps` bounds the physics steps per drawn frame; `interpolate` draws between the last two
 *  physics steps; `shadowEvery` redraws the shadow map every n-th frame; `shadowRange` is the half-width (m) of the
 *  sun's shadow box; `preserve` keeps the drawing buffer (only the desktop needs it, for screenshots). */
export const TIERS = {
  desktop: {
    name: 'desktop',
    maxDpr: 1.5,
    shadowMap: 1024,
    shadowEvery: 1,
    shadowRange: 25,
    particles: 120,
    tireMarks: 36,
    maxSteps: 3,
    interpolate: false,
    preserve: true,
    benchmark: false,
  },
  tablet: {
    name: 'tablet',
    maxDpr: 1.5,
    shadowMap: 1024,
    shadowEvery: 1,
    shadowRange: 25,
    particles: 96,
    tireMarks: 30,
    maxSteps: 3,
    interpolate: true,
    preserve: false,
    benchmark: true,
  },
  phone: {
    name: 'phone',
    maxDpr: 1.5,
    shadowMap: 512,
    shadowEvery: 2,
    shadowRange: 21,
    particles: 48,
    tireMarks: 18,
    maxSteps: 2,
    interpolate: true,
    preserve: false,
    benchmark: true,
  },
};

/** Chooses the device tier. A phone has touch input as its main pointer and a short screen side of 500 CSS pixels or
 *  less; a tablet is a touch device up to 1100. `?tier=phone|tablet|desktop` forces one (for testing). */
export function detectTier() {
  const forced = new URLSearchParams(globalThis.location?.search || '').get('tier');
  if (TIERS[forced]) return TIERS[forced];
  try {
    const touch = (navigator.maxTouchPoints || 0) > 0,
      coarse = matchMedia('(pointer: coarse)').matches || matchMedia('(any-pointer: coarse)').matches,
      short = Math.min(screen.width || innerWidth, screen.height || innerHeight, innerWidth, innerHeight);
    if (touch && coarse) return short <= 500 ? TIERS.phone : short <= 1100 ? TIERS.tablet : TIERS.desktop;
  } catch {}
  return TIERS.desktop;
}

/** The tier this page runs at. */
export const TIER = detectTier();

/** Fixed caps that every scene module sizes its pools from (the tier lowers the particle and tire-mark caps). */
export const BUDGET = {
  maxDpr: TIER.maxDpr,
  /** Dust, exhaust, glitter and confetti particles alive at once. */
  particles: TIER.particles,
  /** Tire-mark pairs kept on the ground (two instances each). */
  tireMarks: TIER.tireMarks,
  /** Instances per toy type: one per toy, and a pallet draws seven slats. */
  toys: 64,
  palletSlats: 448,
  shadowMap: TIER.shadowMap,
  lowShadowMap: 512,
};

/** The starting device pixel ratio. */
export function initialPixelRatio() {
  return Math.min(devicePixelRatio || 1, BUDGET.maxDpr);
}

/** The next lower pixel ratio tier. */
function lowerTier(ratio) {
  return ratio > 1 ? 1 : ratio > 0.75 ? 0.75 : 0.6;
}

const median = (a) => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : 0);

/** Frames ignored before the benchmark (shader compiles and first uploads), frames it samples, and how long it may
 *  take on the wall clock (ms). */
const BENCH = { skip: 12, frames: 48, maxMs: 1400 };

/** Watches frame times, runs the phone benchmark and lowers the resolution after about 45 more slow frames than
 *  fast ones. Its decisions are kept in `log` for the Parent Zone report. */
export class Quality {
  constructor(renderer, sun, resize, tier = TIER) {
    this.renderer = renderer;
    this.sun = sun;
    this.resize = resize;
    this.tier = tier;
    this.slowFrames = 0;
    this.frame = 0;
    this.shadows = tier.shadowMap + (tier.shadowEvery > 1 ? ' (every other frame)' : '');
    this.contactOnly = false;
    this.startDpr = renderer.getPixelRatio();
    this.t0 = performance.now();
    /** The benchmark: samples while it runs, then its result. */
    this.bench = tier.benchmark ? { seen: 0, frames: [], renders: [], from: 0, result: null } : null;
    /** Decisions in order: { at (s since start), what, from, to, why }. */
    this.log = [];
    renderer.shadowMap.autoUpdate = tier.shadowEvery <= 1;
  }

  /** Called just before each draw: with a half-rate shadow map, asks for a shadow redraw on every n-th frame only. */
  beforeRender() {
    const every = this.tier.shadowEvery;
    if (every > 1 && !this.contactOnly) this.renderer.shadowMap.needsUpdate = this.frame++ % every === 0;
  }

  /** ms is this frame's CPU render cost and frameMs the wall time since the last frame. A frame is slow when
   *  rendering takes over 18 ms or the frame interval over 28 ms. */
  adapt(ms, frameMs) {
    if (this.bench && !this.bench.result) this.runBenchmark(ms, frameMs);
    this.slowFrames = ms > 18 || frameMs > 28 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
    const ratio = this.renderer.getPixelRatio();
    if (this.slowFrames > 45 && ratio > 0.6) {
      this.slowFrames = 0;
      this.setRatio(lowerTier(ratio), 'frames stayed slow');
      if (ratio <= 1) {
        // Already at 1x or lower: the shadow map is the next biggest cost.
        if (this.sun.shadow.mapSize.x > BUDGET.lowShadowMap) this.shadowSize(BUDGET.lowShadowMap, 'frames stayed slow');
        else if (this.tier.name === 'phone') this.dropShadows('frames stayed slow at the lowest resolution');
      }
      this.resize();
    } else if (this.slowFrames > 45) {
      // Lowest resolution and still slow: a phone gives up the shadow map for contact discs.
      this.slowFrames = 0;
      if (this.tier.name === 'phone') this.dropShadows('frames stayed slow at the lowest resolution');
    }
  }

  /** The first-second benchmark: the median frame interval and render cost of the first drawn frames decide whether
   *  a phone starts below 1.5x (never below 1x here; the adaptive steps handle anything worse). */
  runBenchmark(ms, frameMs) {
    const b = this.bench;
    if (document.hidden) {
      b.seen = 0;
      b.frames.length = b.renders.length = 0;
      return;
    }
    if (++b.seen <= BENCH.skip) return;
    if (!b.from) b.from = performance.now();
    b.frames.push(frameMs);
    b.renders.push(ms);
    if (b.frames.length < BENCH.frames && performance.now() - b.from < BENCH.maxMs) return;
    const frame = median(b.frames),
      render = median(b.renders);
    // A heavy device takes more than 14 ms of CPU to draw or can't keep 25 fps; a middling one more than 8 ms or 38 fps.
    const heavy = render > 14 || frame > 40,
      middling = render > 8 || frame > 26;
    b.result = { frameMs: Math.round(frame * 10) / 10, renderMs: Math.round(render * 10) / 10, verdict: 'fast' };
    const ratio = this.renderer.getPixelRatio();
    const target = heavy ? 1 : middling ? 1.25 : ratio;
    if (target < ratio) {
      b.result.verdict = heavy ? 'slow' : 'middling';
      this.setRatio(Math.max(1, target), `benchmark: ${b.result.frameMs} ms frames, ${b.result.renderMs} ms draw`);
      this.resize();
    }
    if (heavy && this.tier.name === 'phone' && frame > 55) this.dropShadows('benchmark: frames over 55 ms');
    b.frames = b.renders = null;
  }

  setRatio(to, why) {
    const from = this.renderer.getPixelRatio();
    if (from === to) return;
    this.renderer.setPixelRatio(to);
    this.note('resolution', `${from}x`, `${to}x`, why);
  }

  shadowSize(size, why) {
    const from = this.sun.shadow.mapSize.x;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this.sun.shadow.needsUpdate = true;
    this.note('shadow map', from, size, why);
    this.shadows = String(size);
  }

  /** Contact discs only: the sun stops casting shadows (the discs under every toy remain). */
  dropShadows(why) {
    if (this.contactOnly) return;
    this.contactOnly = true;
    this.sun.castShadow = false;
    this.renderer.shadowMap.autoUpdate = true;
    this.note('shadows', this.shadows, 'contact discs only', why);
    this.shadows = 'contact discs only';
  }

  note(what, from, to, why) {
    this.log.push({ at: Math.round((performance.now() - this.t0) / 100) / 10, what, from, to, why });
  }

  /** What the Parent Zone report and the performance hook show. */
  summary() {
    const t = this.tier;
    return {
      tier: t.name,
      pixelRatio: this.renderer.getPixelRatio(),
      startPixelRatio: this.startDpr,
      shadows: this.shadows,
      particles: BUDGET.particles,
      maxPhysicsSteps: t.maxSteps,
      interpolated: t.interpolate,
      benchmark: this.bench?.result || (this.bench ? 'running' : 'not used'),
      decisions: this.log.slice(),
    };
  }
}

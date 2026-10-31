// Rendering budgets (SPEC §6) and the adaptive quality controller. The yard must stay smooth on an iPad and a modest
// laptop, so the scene starts at no more than 1.5x device pixels and steps down to 1, 0.75 and 0.6 after sustained
// slow frames, halving the shadow map at the lower tiers. It never steps back up within a session: a device that was
// slow once is likely to be slow again, and flickering resolution is worse than a slightly softer image.

/** Fixed caps that every scene module sizes its pools from. */
export const BUDGET = {
  maxDpr: 1.5,
  /** Dust, exhaust, glitter and confetti particles alive at once. */
  particles: 120,
  /** Tire-mark pairs kept on the ground (two instances each). */
  tireMarks: 36,
  /** Instances per toy type: one per toy, and a pallet draws seven slats. */
  toys: 64,
  palletSlats: 448,
  shadowMap: 1024,
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

/** Watches frame times and lowers the resolution after about 45 more slow frames than fast ones. */
export class Quality {
  constructor(renderer, sun, resize) {
    this.renderer = renderer;
    this.sun = sun;
    this.resize = resize;
    this.slowFrames = 0;
  }

  /** ms is this frame's CPU render cost and frameMs the wall time since the last frame. A frame is slow when
   *  rendering takes over 18 ms or the frame interval over 28 ms. */
  adapt(ms, frameMs) {
    this.slowFrames = ms > 18 || frameMs > 28 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
    const ratio = this.renderer.getPixelRatio();
    if (this.slowFrames > 45 && ratio > 0.6) {
      this.slowFrames = 0;
      this.renderer.setPixelRatio(lowerTier(ratio));
      if (ratio <= 1) {
        // Already at 1x or lower: the shadow map is the next biggest cost.
        this.sun.shadow.mapSize.set(BUDGET.lowShadowMap, BUDGET.lowShadowMap);
        this.sun.shadow.map?.dispose();
        this.sun.shadow.map = null;
        this.sun.shadow.needsUpdate = true;
      }
      this.resize();
    }
  }
}

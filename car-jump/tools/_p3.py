p='src/game/engine.js'
s=open(p).read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt, (s.count(a), a[:80])
    s=s.replace(a,b)

rep("""import * as R from './render.js';""","""import * as R from './render.js';
import * as SR from './skyRender.js';""")

# render: background
rep("""    R.drawBackground(ctx, view, cam, bd, t, run ? run.spaceK : 0);
    R.worldTransform(ctx, view, cam);""","""    const sky = !!course.sky;
    const prog = run ? run.skyT : 0;
    if (sky) SR.drawSkyBackground(ctx, view, cam, bd, t, prog, run ? run.spaceK : 0);
    else R.drawBackground(ctx, view, cam, bd, t, run ? run.spaceK : 0);
    R.worldTransform(ctx, view, cam);""")
rep("""    R.drawTerrain(ctx, course, bd, vis, lw, cam);
    R.drawRamp(ctx, course, bd, vis, lw);""","""    if (sky) SR.drawSkyWorld(ctx, course, bd, vis, lw, cam, t);
    else R.drawTerrain(ctx, course, bd, vis, lw, cam);
    R.drawRamp(ctx, course, bd, vis, lw);
    if (sky) {
      // the near cloud sea over the island undersides (screen space), then back to the world
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      SR.drawSeaNear(ctx, view, cam, bd, t, prog);
      R.worldTransform(ctx, view, cam);
    }""")
rep("""      for (const pr of r.props) {
        if (pr.smashed || pr.x < vis.x0 - 9""","""      if (sky) for (const w of course.wells) if (w.x + w.R > vis.x0 && w.x - w.R < vis.x1 && w.y + w.R > vis.y0 && w.y - w.R < vis.y1) SR.drawWell(ctx, w, t, lw);
      for (const pr of r.props) {
        if (pr.smashed || pr.x < vis.x0 - 9""")
# air loop: boost rings
rep("""        } else if (a.kind === 'ring') {
          const k = a.hit ? clamp((t - a.hitT) / 0.45, 0, 1) : 0;
          if (k < 1) R.drawRing(ctx, a, t, 'back', lw, k);
        } else if (a.hit) continue;""","""        } else if (a.kind === 'ring') {
          const k = a.hit ? clamp((t - a.hitT) / 0.45, 0, 1) : 0;
          if (k < 1) R.drawRing(ctx, a, t, 'back', lw, k);
        } else if (a.kind === 'boost') {
          const k = a.hit ? clamp((t - a.hitT) / 0.5, 0, 1) : 0;
          if (k < 1) SR.drawBoostRing(ctx, a, t, 'back', lw, k);
        } else if (a.hit) continue;""")
rep("""      if (!r.carGone) drawCar(r, lw);
      for (let i = 0; i < A.length; i++) {
        const a = A[i];
        if (a.kind !== 'ring' || a.gone || !airVis(a, 4)) continue;""","""      const gt = r.gate;
      const gk = gt && gt.hit ? clamp((t - gt.hitT) / 0.8, 0, 1) : 0;
      if (gt && gk < 1 && airVis(gt, gt.r * 2)) SR.drawGate(ctx, gt, t, 'back', lw, r.frozen ? 0 : gk, r.frozen);
      if (r.frozen && !r.carGone) SR.drawIdleGlow(ctx, r.com.x, r.com.y + Math.sin(t * 2.2) * 0.3, t, Math.max(2.6, (r.geom.maxX - r.geom.minX) * 0.7));
      if (!r.carGone) drawCar(r, lw);
      if (gt && gk < 1 && airVis(gt, gt.r * 2)) SR.drawGate(ctx, gt, t, 'front', lw, r.frozen ? 0 : gk, r.frozen);
      for (let i = 0; i < A.length; i++) {
        const a = A[i];
        if ((a.kind !== 'ring' && a.kind !== 'boost') || a.gone || !airVis(a, 4)) continue;""")
rep("""        const k = a.hit ? clamp((t - a.hitT) / 0.45, 0, 1) : 0;
        if (k < 1) R.drawRing(ctx, a, t, 'front', lw, k);
      }""","""        const k = a.hit ? clamp((t - a.hitT) / (a.kind === 'boost' ? 0.5 : 0.45), 0, 1) : 0;
        if (k < 1) { if (a.kind === 'boost') SR.drawBoostRing(ctx, a, t, 'front', lw, k); else R.drawRing(ctx, a, t, 'front', lw, k); }
      }""")
# drawCar: hover when frozen + dark rim in the night sky
rep("""    // Grand Finale wobble: the car rattles and swells before it goes up""","""    // frozen at the Spell Boost gate: the car hovers gently (the only thing that moves besides the clouds)
    if (r.frozen) ctx.translate(0, Math.sin(r.realT * 2.2) * 0.3);
    // Grand Finale wobble: the car rattles and swells before it goes up""")
rep("""    g.rim = r.bd.night || r.spaceK > 0.25 ? 'rgba(225,232,255,0.9)' : null; // dark cars stay readable in space""","""    g.rim = r.bd.night || r.spaceK > 0.25 || (r.sky && r.bd.starK >= 0.9 && r.skyT > 0.55) ? 'rgba(225,232,255,0.9)' : null; // dark cars stay readable in space""")
# camera for the sky: show the cloud sea under the islands
rep("""    visH = clamp(visH, 14, 170);""","""    visH = clamp(visH, r.sky ? 22 : 14, 170);""")
rep("""    const gAhead = Math.min(surf, r.course.surfaceY(tx));""","""    const gAhead = r.sky ? r.course.sky.sea : Math.min(surf, r.course.surfaceY(tx)); // the sky keeps the cloud sea in the frame""")
open(p,'w').write(s)

p='src/game/render.js'
s=open(p).read()
rep("""import { drawChassis, drawWheel } from './car.js';""","""import { drawChassis, drawWheel } from './car.js';
import { createSkyBackdrop } from './skyRender.js';""")
rep("""export function createBackdrop(track, seed) {
  const rand""","""export function createBackdrop(track, seed) {
  if (track.era === 'sky') return createSkyBackdrop(track, seed); // v4.0 Sky Era (src/game/skyRender.js)
  const rand""")
open(p,'w').write(s)

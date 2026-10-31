// The scene façade the app uses: one Three.js renderer, the site environment, and the current round's toys,
// fixtures, machines and effects, drawn from the physics yard every frame. It owns no game rules; it only shows the
// Yard it is given. The work is split by responsibility: environment.js (sky, lights, floor, scenery), toys.js,
// machines.js, effects.js, camera.js and quality.js, sharing materials and geometry through kit.js. No
// postprocessing; repeated parts are instanced so the yard stays within SPEC §6's draw-call and triangle budgets.
import * as T from '../../vendor/three.module.js';
import { Kit } from './kit.js';
import { YARD_THEME, buildEnvironment, syncStamps, applyDaylight } from './environment.js';
import { ToyLayer } from './toys.js';
import { buildMachine, syncMachine, buildWreckingBall, syncWreckingBall } from './machines.js';
import { Effects } from './effects.js';
import { CameraRig } from './camera.js';
import { Quality, initialPixelRatio } from './quality.js';

/** The ground plane that taps on the yard are projected onto. */
const GROUND = new T.Plane(new T.Vector3(0, 1, 0), 0);

export class Scene {
  /** Creates the renderer on `canvas` and builds the site. reducedMotion turns off particles, the celebration sweep
   *  and camera easing; the app may change it later. */
  constructor(canvas, { reducedMotion = false } = {}, theme = YARD_THEME) {
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
    this.scene = new T.Scene();
    this.scene.fog = new T.Fog(theme.fog.color, theme.fog.near, theme.fog.far);
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(initialPixelRatio());
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.rig = new CameraRig();
    this.daylight = 0.72;
    this.kit = new Kit();
    this.ray = new T.Raycaster();
    this.ndc = new T.Vector2();
    this.tapPoint = new T.Vector3();
    this.machineModels = [];
    this.env = buildEnvironment(this.scene, this.kit, theme);
    this.effects = new Effects(this.scene, this.kit, () => this.reducedMotion);
    this.toys = new ToyLayer(this.kit);
    this.resize = () => {
      const w = canvas.clientWidth,
        h = canvas.clientHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', this.resize);
    this.resize();
    this.quality = new Quality(this.renderer, this.env.sun, this.resize);
  }

  /** The camera and its follow state live in the rig; these keep the app's existing scene.* fields working. */
  get camera() {
    return this.rig.camera;
  }
  get target() {
    return this.rig.target;
  }
  get yaw() {
    return this.rig.yaw;
  }
  set yaw(v) {
    this.rig.yaw = v;
  }
  get pitch() {
    return this.rig.pitch;
  }
  set pitch(v) {
    this.rig.pitch = v;
  }
  get distance() {
    return this.rig.distance;
  }
  set distance(v) {
    this.rig.distance = v;
  }
  get overview() {
    return this.rig.overview;
  }
  set overview(v) {
    this.rig.overview = v;
  }
  get sweep() {
    return this.rig.sweep;
  }
  set sweep(v) {
    this.rig.sweep = v;
  }

  /** Removes the current round's meshes and frees the GPU resources that belong only to it. */
  clearRound() {
    if (!this.roundGroup) return;
    this.scene.remove(this.roundGroup);
    this.roundGroup.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      if (o.userData.ownGeometry) o.geometry.dispose();
      if (o.userData.ownMaterial) {
        o.material.map?.dispose();
        o.material.dispose();
      }
      if (o.isLineSegments) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
    this.env.hillGeo?.dispose();
    this.env.hillGeo = null;
    this.machineModels = [];
    this.effects.clear();
  }

  /** Shows a new physics yard: toys, the pad and ghosts, props, machines, the wrecking ball and stamps. The camera
   *  returns to the overview until the app moves it. */
  setRound(yard) {
    this.clearRound();
    this.yard = yard;
    this.roundGroup = new T.Group();
    this.scene.add(this.roundGroup);
    this.toys.buildMeshes(this.roundGroup);
    this.effects.attachRound(this.roundGroup);
    this.toys.buildFixtures(this.roundGroup, yard.round);
    yard.machines.forEach((m) => this.machineModels.push(buildMachine(this.kit, this.roundGroup, m.kind)));
    this.wreckMesh = buildWreckingBall(this.kit, this.roundGroup);
    this.stampGroup = new T.Group();
    this.roundGroup.add(this.stampGroup);
    this.syncStamps();
    this.overview = true;
    this.sweep = 0;
  }

  /** Redraws the terrain stamps after the yard gains one. */
  syncStamps() {
    if (!this.stampGroup) return;
    syncStamps(this.env, this.kit, this.stampGroup, this.yard.stamps);
  }

  /** Sets the daylight slider's value, 0 (night) to 1 (day). */
  daylightTo(n) {
    this.daylight = n;
    applyDaylight(this.env, n);
  }

  /** Sprays a few particles (dust, glitter, a spawn puff). */
  emit(position, color, count) {
    this.effects.emit(position, color, count);
  }

  orbit(dx, dy) {
    this.rig.orbit(dx, dy);
  }

  zoom(delta) {
    this.rig.zoom(delta);
  }

  /** Where a click or tap lands on the ground plane, or null above the horizon. The returned vector is reused by the
   *  next call, so read it straight away. */
  groundPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.x) / rect.width) * 2 - 1, -((e.clientY - rect.y) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray.ray.intersectPlane(GROUND, this.tapPoint);
  }

  /** Draws one frame. status is the mission status (ghost highlights); poses may be passed when the game loop
   *  already read them from the yard this frame, otherwise they are read here. */
  render(dt, status, poses = null) {
    if (!this.yard) return;
    const yard = this.yard;
    const frame = poses || yard.poses();
    this.toys.update(frame);
    this.effects.updateContacts(frame, yard);
    this.toys.updateGhosts(status, yard.time);
    yard.machines.forEach((m, i) => syncMachine(this.kit, this.machineModels[i], m, this));
    this.effects.trail(yard);
    this.effects.drawMarks(yard);
    this.effects.updateParticles(dt);
    syncWreckingBall(this.wreckMesh, yard);
    this.rig.update(dt, yard.machine, yard.round.pad, this.reducedMotion);
    this.renderer.render(this.scene, this.camera);
  }

  /** A small JPEG of the current view for the saved-site card on the title. */
  thumbnail() {
    this.render(0);
    const cv = document.createElement('canvas');
    cv.width = 320;
    cv.height = 180;
    cv.getContext('2d').drawImage(this.canvas, 0, 0, 320, 180);
    return cv.toDataURL('image/jpeg', 0.65);
  }

  /** Feeds one frame's timings to the adaptive quality controller. */
  adapt(ms, frameMs) {
    this.quality.adapt(ms, frameMs);
  }

  /** Releases everything: the round, every geometry and material in the scene, the textures and the renderer. */
  destroy() {
    window.removeEventListener('resize', this.resize);
    this.clearRound();
    const geometries = new Set(),
      materials = new Set();
    this.scene.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    this.env.labelTexture.dispose();
    this.env.gravelTexture.dispose();
    this.renderer.dispose();
  }
}

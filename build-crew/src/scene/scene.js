// The scene façade the app uses: one Three.js renderer, the site environment, and the current round's toys,
// fixtures, machines and effects, drawn from the physics yard every frame. It owns no game rules; it only shows the
// Yard it is given. The work is split by responsibility: environment.js (sky, lights, floor, scenery), toys.js,
// machines.js, effects.js, camera.js and quality.js, sharing materials and geometry through kit.js. No
// postprocessing; repeated parts are instanced so the yard stays within SPEC §6's draw-call and triangle budgets.
import * as T from '../../vendor/three.module.js';
import { Kit } from './kit.js';
import {
  YARD_THEME,
  THEMES,
  buildEnvironment,
  disposeEnvironment,
  syncStamps,
  applyDaylight,
  toyTexture,
} from './environment.js';
import { ToyLayer } from './toys.js';
import { buildMachine, syncMachine, buildWreckingBall, syncWreckingBall } from './machines.js';
import { Effects } from './effects.js';
import { CameraRig } from './camera.js';
import { Quality, TIER, initialPixelRatio } from './quality.js';
import { TOYS } from '../content.mjs';

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
      stencil: false,
      // Only a desktop needs the buffer kept (screenshots); on a phone keeping it costs a copy every frame.
      preserveDrawingBuffer: TIER.preserve,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(initialPixelRatio());
    this.renderer.shadowMap.enabled = true;
    // The cheaper filter on a phone, where a 512 map is soft enough already.
    this.renderer.shadowMap.type = TIER.name === 'phone' ? T.PCFShadowMap : T.PCFSoftShadowMap;
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
    /** The block the next Grab would pick up (its id, or null) and whether the forward arrow shows: the app sets both every
     *  frame during play, so a menu, a pause or a finished job never shows them. */
    this.glowId = null;
    this.arrowOn = false;
    this.aids = null;
    // The painted toys wear the yard's gravel grain on every site (it belongs to the scene, not to a site).
    this.toyTexture = toyTexture();
    this.kit.mat('#ffffff').map = this.toyTexture;
    this.env = buildEnvironment(this.scene, this.kit, theme);
    /** How many times the site has been rebuilt since the page opened (the switch is checked by the browser smoke). */
    this.siteBuilds = 1;
    this.effects = new Effects(this.scene, this.kit, () => this.reducedMotion);
    this.toys = new ToyLayer(this.kit);
    this.resize = () => {
      const w = canvas.clientWidth,
        h = canvas.clientHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
      this.rig.resized(w, h);
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
    this.roundGroup = null;
  }

  /** Moves the scene to another work site (the yard, the harbor or the hillside): the old site's lights, sky, scenery,
   *  ground, materials and textures are freed and the new site's are built, keeping the daylight and the picture-quality
   *  decisions (the shadow map size and whether the sun casts shadows at all). Nothing happens when the site is current. */
  setSite(id) {
    const theme = THEMES[id] || YARD_THEME;
    if (this.env.theme === theme) return;
    const old = this.env.sun;
    this.clearRound();
    disposeEnvironment(this.scene, this.env, this.kit);
    this.scene.fog.color.set(theme.fog.color);
    this.scene.fog.near = theme.fog.near;
    this.scene.fog.far = theme.fog.far;
    this.env = buildEnvironment(this.scene, this.kit, theme);
    const sun = this.env.sun;
    sun.castShadow = old.castShadow;
    sun.shadow.mapSize.copy(old.shadow.mapSize);
    this.quality.sun = sun;
    applyDaylight(this.env, this.daylight);
    this.siteBuilds++;
  }

  /** The site on show ('yard', 'harbor' or 'hillside'). */
  get site() {
    return this.env.theme.id;
  }

  /** Shows a new physics yard: toys, the pad and ghosts, props, machines, the wrecking ball and stamps. The camera
   *  returns to the overview until the app moves it. A yard on another site moves the scene to that site first. */
  setRound(yard) {
    this.setSite(yard.site?.id || 'yard');
    this.clearRound();
    this.yard = yard;
    this.roundGroup = new T.Group();
    this.scene.add(this.roundGroup);
    this.toys.buildMeshes(this.roundGroup);
    this.effects.attachRound(this.roundGroup);
    this.toys.buildFixtures(this.roundGroup, yard.round, (x, z) => yard.groundAt(x, z));
    this.carDrive = null;
    yard.machines.forEach((m) => this.machineModels.push(buildMachine(this.kit, this.roundGroup, m.kind)));
    this.wreckMesh = buildWreckingBall(this.kit, this.roundGroup);
    this.buildAids(this.roundGroup);
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

  /** The finished bridge's toy car crosses it: from the near end of the beam (`from`, x) to the far end (`to`), at the
   *  beam's top, over `ms` (straight to the far end in calm motion). */
  crossBridge(from, to, top, ms = 2600) {
    if (!this.toys.car) return;
    this.carDrive = { from, to, top, t0: performance.now(), ms: this.reducedMotion ? 1 : ms };
  }

  driveCar() {
    const d = this.carDrive,
      car = this.toys.car;
    if (!d || !car) return;
    const p = Math.min(1, (performance.now() - d.t0) / d.ms);
    car.position.set(d.from + (d.to - d.from) * p, d.top, car.position.z);
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

  /** Sets how many pixels at the top and bottom of the screen the controls cover; the camera frames the machine in
   *  the free band between them. */
  setInsets(top, bottom) {
    this.rig.setInsets(top, bottom);
  }

  /** Draws one frame. status is the mission status (ghost highlights); poses may be passed when the game loop
   *  already read them from the yard this frame, otherwise they are read here. With `blend` (an Interpolator that
   *  holds the last two physics steps) the toys and machines are drawn between those steps instead. */
  render(dt, status, poses = null, blend = null) {
    if (!this.yard) return;
    const yard = this.yard;
    const frame = blend ? blend.poses() : poses || yard.poses();
    if (blend) blend.apply(yard);
    this.toys.update(frame);
    this.effects.updateContacts(frame, yard);
    this.toys.updateGhosts(status, yard.time);
    for (let i = 0; i < yard.machines.length; i++) syncMachine(this.kit, this.machineModels[i], yard.machines[i], this);
    this.updateAids(frame, yard);
    this.effects.trail(yard);
    this.effects.drawMarks(yard);
    this.effects.updateParticles(dt);
    syncWreckingBall(this.wreckMesh, yard);
    this.driveCar();
    this.rig.update(dt, yard.machine, yard.round.pad, this.reducedMotion);
    if (blend) blend.restore(yard);
    this.quality.beforeRender();
    this.renderer.render(this.scene, this.camera);
  }

  /** Where a world point is on screen, in CSS pixels (the pop over a placed block). The result is a fresh object. */
  screenPoint(x, y, z) {
    const v = this.tapPoint.set(x, y, z).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.x + ((v.x + 1) / 2) * rect.width, y: rect.y + ((1 - v.y) / 2) * rect.height, behind: v.z > 1 };
  }

  /** The two small helpers drawn over the ground: a glowing ring and box round the block Grab would pick up, and an arrow
   *  on the ground ahead of the machine you drive, which says which way is forward (the front and the back of a machine are
   *  hard to tell apart from the isometric camera). Both are single meshes that move; nothing is built per frame. */
  buildAids(group) {
    const kit = this.kit,
      own = (o) => {
        o.userData.ownGeometry = true;
        o.userData.ownMaterial = true;
        o.renderOrder = 5;
        o.visible = false;
        group.add(o);
        return o;
      };
    // the glow: a box a little bigger than the block, soft and bright, with a ring under it
    const box = new T.BoxGeometry(1, 1, 1),
      shell = own(new T.Mesh(box, new T.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.3, depthWrite: false, fog: false }))),
      ring = own(new T.Mesh(new T.RingGeometry(0.66, 1, 40), new T.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.9, depthWrite: false, side: T.DoubleSide, fog: false })));
    shell.userData.ownGeometry = true;
    const edges = new T.LineSegments(new T.EdgesGeometry(box), new T.LineBasicMaterial({ color: '#fff4b8', fog: false }));
    edges.userData.ownGeometry = true;
    edges.userData.ownMaterial = true;
    shell.add(edges);
    ring.rotation.x = -Math.PI / 2;
    // the arrow: a tail and a head lying flat, pointing along +z (the machine's heading), amber over a dark edge
    const arrow = (grow, y) => {
      const w = 0.2 + grow,
        hw = 0.62 + grow,
        tail = 1.1 + grow,
        tip = 1.9 + grow * 1.6,
        pts = [[-w, 0], [w, 0], [w, tail], [-w, tail], [-hw, tail], [hw, tail], [0, tip]],
        idx = [0, 1, 2, 0, 2, 3, 4, 5, 6],
        g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pts.flatMap(([x, z]) => [x, y, z]), 3));
      g.setIndex(idx);
      return g;
    };
    const back = own(new T.Mesh(arrow(0.1, 0), new T.MeshBasicMaterial({ color: '#10161b', transparent: true, opacity: 0.55, depthWrite: false, side: T.DoubleSide, fog: false }))),
      front = new T.Mesh(arrow(0, 0.012), new T.MeshBasicMaterial({ color: '#ffc42e', transparent: true, opacity: 0.92, depthWrite: false, side: T.DoubleSide, fog: false }));
    front.userData.ownGeometry = true;
    front.userData.ownMaterial = true;
    back.add(front);
    this.aids = { shell, ring, arrow: back, front };
  }

  /** Places the aids for this frame: the glow on the block `glowId` names (drawn from the same poses as the toys), the arrow
   *  ahead of the active machine. */
  updateAids(poses, yard) {
    const a = this.aids;
    if (!a) return;
    const pulse = this.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(yard.time * 5);
    const pose = this.glowId == null ? null : poses.find((p) => p.id === this.glowId);
    a.shell.visible = a.ring.visible = !!pose;
    if (pose) {
      const d = TOYS[pose.type].size,
        g = yard.groundAt(pose.position.x, pose.position.z);
      a.shell.position.copy(pose.position);
      a.shell.quaternion.copy(pose.rotation);
      a.shell.scale.set(d[0] * 1.16, d[1] * 1.16, d[2] * 1.16);
      a.shell.material.opacity = 0.34 + 0.26 * pulse;
      const r = Math.hypot(d[0], d[2]) * 0.62 * (1 + 0.06 * pulse);
      a.ring.position.set(pose.position.x, g + 0.09, pose.position.z);
      a.ring.scale.set(r, r, 1);
    }
    const m = yard.machine;
    a.arrow.visible = this.arrowOn && !!m;
    if (a.arrow.visible) {
      const nudge = this.reducedMotion ? 0 : 0.18 * Math.sin(yard.time * 3.2),
        dist = 3.7 + nudge,
        x = m.x + Math.sin(m.yaw) * dist,
        z = m.z + Math.cos(m.yaw) * dist;
      a.arrow.position.set(x, yard.groundAt(x, z) + 0.1, z);
      a.arrow.rotation.set(-(m.pitch || 0), m.yaw, 0, 'YXZ');
      a.front.material.opacity = 0.8 + 0.15 * pulse;
    }
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
    for (const t of this.env.textures) t.dispose();
    this.toyTexture.dispose();
    this.renderer.dispose();
  }
}

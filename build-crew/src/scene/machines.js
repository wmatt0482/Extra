// The machine models and their per-frame pose. Each kind is its own machine with its own silhouette and cab:
//  - SS-01 skid steer: a short boxy body on four small wheels, an open ROPS cage with a seat, lap bar and joysticks,
//    vertical-lift arms that pivot on rear links and run down the body sides to a wide, low bucket.
//  - EX-02 excavator: crawler tracks with shoes, sprocket, idler and rollers; a house that slews on a swing bearing
//    with the cab offset to the left, engine deck, counterweight, hand rail and stack; a bent boom, stick and toothed
//    bucket on a four-bar linkage, with boom, stick and bucket cylinders.
//  - CR-03 crawler crane: long wide tracks; a slewing house with a long low cab at the front, counterweight slabs,
//    an A-frame gantry, an open winch drum, a four-chord lattice boom on boom-hoist cables, and a hook block over the
//    lifting magnet.
// The MACHINE table says what each kind builds and how it is posed from the physics joints. Static parts merge into
// one mesh per layer (paint, vertex-colored detail, glass) per moving piece (kit.js Parts); wheels, track shoes,
// sprockets, hydraulic barrels and rods and ropes are instanced. A paint reward recolors every paint-layer mesh and the
// cylinder barrels; the dark frames, glass, tires, tracks, hook block and the number plate keep their colors. A decal
// reward shows a star or stripes on the roof and the sides; the bell horn replaces the small stock horn on the roof.
// rewardArt() draws the large reward picture the job-complete sheet shows, in each machine's own profile.
import * as T from '../../vendor/three.module.js';
import { MACHINES } from '../content.mjs';
import { SKID_BUCKET } from '../physics.mjs';
import { Parts, canvasTexture } from './kit.js';

/** Scene parts for each machine kind.
 *  - gear: 'wheels' (skid steering on four tires) or 'tracks' (crawler shoes that scroll as each side moves).
 *  - tool: 'bucket' or 'magnet', built at the physics grab point.
 *  - cabSwings: the house and cab slew with the boom (excavator, crane) or stay on the body (skid steer).
 *  - scoops: dust kicks up from the tool when it is lowered while driving (effects.js reads this).
 *  - lattice: the boom is an open lattice (crane) rather than a plate box.
 *  - settle: how far the body pitches on its suspension when the machine speeds up or stops (lighter = more).
 *  - build: makes the model's parts; pose: places its arms, cylinders and ropes from the joints and the tool tip. */
export const MACHINE = {
  skid: {
    gear: 'wheels',
    tool: 'bucket',
    cabSwings: false,
    scoops: true,
    lattice: false,
    settle: 1,
    build: buildSkid,
    pose: poseSkid,
  },
  excavator: {
    gear: 'tracks',
    tool: 'bucket',
    cabSwings: true,
    scoops: true,
    lattice: false,
    settle: 0.55,
    build: buildExcavator,
    pose: poseExcavator,
  },
  crane: {
    gear: 'tracks',
    tool: 'magnet',
    cabSwings: true,
    scoops: false,
    lattice: true,
    settle: 0.35,
    build: buildCrane,
    pose: poseCrane,
  },
};

/** Body colors when a paint reward is chosen (stock keeps the machine's own color). */
export const PAINTS = { cream: '#c6c3b4', leaf: '#486c53', sky: '#3c7d9c', sunset: '#d86c38' };

/** Detail colors shared by every model. */
const C = {
  frame: '#262f37',
  frameLight: '#353f48',
  steel: '#55626c',
  pin: '#8b979f',
  rubber: '#161c21',
  tread: '#232a30',
  rim: '#9aa2a8',
  seat: '#2b3237',
  bar: '#1c2328',
  grille: '#141a1f',
  hose: '#14191d',
  lens: '#f6f1d2',
  tail: '#b8352b',
  amber: '#ef8c22',
  rail: '#e0aa30',
  rope: '#8b9ba5',
  ropeDrum: '#6f7c84',
  hook: '#e2a12a',
  edge: '#3a444c',
  magnet: '#263d4e',
  shoe: '#3b444b',
};

/** Seconds the horn on the roof swells when it sounds. */
const HONK_MS = 420;

/** The skid steer's arm linkage (metres, body frame, [z, y]): each lift arm pivots at P on a rear link that turns
 *  about R on the tower, and pins to the bucket at B; tuned so the bucket rises on the physics' vertical path. */
const SKID = {
  armX: 0.86,
  R: { z: -0.85, y: 1.2 },
  link: 0.65,
  arm: 3.25,
  /** The bucket's arm pin and tilt-cylinder ear in the bucket's frame. */
  pin: new T.Vector3(0, -0.12, -0.8),
  ear: new T.Vector3(0, 0.2, -0.8),
  wheel: { r: 0.42, x: 0.92, z: 0.6, width: 0.34 },
};

/** The excavator's arm (house frame): boom foot F, boom and stick lengths, and the bucket's pins in its frame. */
const EXC = {
  F: { z: 0.4, y: 1.7 },
  boom: 4.6,
  stick: 3.3,
  /** The bucket is drawn at this scale about the grab point (big enough to hold a 1.2 m block). */
  bucketScale: 0.9,
  pin: new T.Vector3(0, 0.78, -0.6).multiplyScalar(0.9),
  ear: new T.Vector3(0, 0.8, -0.18).multiplyScalar(0.9),
  /** The four-bar linkage: the side link pivots on the stick at S, the bucket link meets it at J. */
  S: new T.Vector3(0, 0.1, 3.3 - 0.42),
  sideLink: 0.46,
  bucketLink: 0.5,
  track: { x: 1.05, width: 0.52, front: 1.3, rear: -1.3, y: 0.47, r: 0.4, pitch: 0.24 },
};

/** The crane's boom (house frame): foot F, lattice length, half width and depth, the gantry apex and drum. */
const CRN = {
  F: { z: 1.25, y: 1.9 },
  boom: 13,
  head: 0.32,
  gantry: new T.Vector3(0, 4.4, -1.3),
  drum: { z: 0.15, y: 2.65, r: 0.3 },
  track: { x: 1.25, width: 0.62, front: 1.75, rear: -1.75, y: 0.52, r: 0.44, pitch: 0.3 },
};

/** The crane's head sheaves: their centre's height off the boom axis and their radius. */
const SHEAVE = { y: -0.02, r: 0.28 };

/** Scratch vectors for the per-frame pose, so syncing never allocates. */
const S = {
  tip: new T.Vector3(),
  a: new T.Vector3(),
  b: new T.Vector3(),
  c: new T.Vector3(),
  d: new T.Vector3(),
  e: new T.Vector3(),
  dir: new T.Vector3(),
  q: new T.Quaternion(),
};
const UP = new T.Vector3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Builds a machine of `kind` into `group` and returns its parts and per-frame state. */
export function buildMachine(kit, group, kind) {
  const row = MACHINE[kind],
    d = MACHINES[kind];
  const root = new T.Group();
  group.add(root);
  const sprung = new T.Group();
  root.add(sprung);
  const model = {
    kind,
    root,
    sprung,
    paint: 'stock',
    paintable: [],
    actuators: [],
    decals: { star: [], stripe: [] },
    state: { time: null, yaw: 0, speed: 0, pitch: 0, pitchRate: 0, travel: [0, 0] },
  };
  row.build(kit, model, d);
  return model;
}

/** Merges a Parts list under `parent`, registering its paint mesh for paint rewards. */
function finish(kit, model, parts, parent, c, options) {
  const meshes = parts.build(parent, kit.paintMat(c), options);
  if (meshes.body) model.paintable.push(meshes.body);
  return meshes;
}

/** A group under `parent` at (x, y, z). */
function group(parent, x = 0, y = 0, z = 0) {
  const g = new T.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// ---- Shared fittings: number plate, decals, horns, cylinders, ropes, wheels and tracks ----

/** The unit-code plate (amber code on slate, BUILD CREW underneath), facing -z (the machine's back) at (x, y, z). */
function plate(parent, d, x, y, z, w = 1.1) {
  const texture = canvasTexture(256, 128, (pc) => {
    pc.fillStyle = '#172531';
    pc.fillRect(0, 0, 256, 128);
    pc.strokeStyle = '#f0b436';
    pc.lineWidth = 5;
    pc.strokeRect(5, 5, 246, 118);
    pc.fillStyle = '#f0b436';
    pc.font = 'bold 50px monospace';
    pc.textAlign = 'center';
    pc.fillText(d.name, 128, 62);
    pc.fillStyle = '#c6d5df';
    pc.font = '19px monospace';
    pc.fillText('BUILD CREW', 128, 99);
  });
  const mesh = new T.Mesh(new T.PlaneGeometry(w, w / 2), new T.MeshBasicMaterial({ map: texture }));
  mesh.position.set(x, y, z);
  mesh.rotation.y = Math.PI;
  mesh.userData.ownGeometry = mesh.userData.ownMaterial = true;
  parent.add(mesh);
  return mesh;
}

/** The star and stripe decal textures, drawn once per page. */
let decalArt;
function decalTextures() {
  return (decalArt ||= {
    star: canvasTexture(128, 128, (c) => {
      c.fillStyle = '#172531';
      c.fillRect(4, 4, 120, 120);
      c.strokeStyle = '#f2b538';
      c.lineWidth = 6;
      c.strokeRect(7, 7, 114, 114);
      c.fillStyle = '#f2b538';
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 24 : 54,
          a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        c.lineTo(64 + Math.cos(a) * r, 66 + Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
    }),
    roofStripes: canvasTexture(128, 128, (c) => {
      for (const x of [30, 98]) {
        c.fillStyle = '#172531';
        c.fillRect(x - 14, 0, 28, 128);
        c.fillStyle = '#edf2f6';
        c.fillRect(x - 3, 0, 6, 128);
      }
    }),
    sideStripe: canvasTexture(256, 32, (c) => {
      c.fillStyle = '#172531';
      c.fillRect(0, 2, 256, 28);
      c.fillStyle = '#edf2f6';
      c.fillRect(0, 14, 256, 4);
    }),
  });
}

/** Adds one decal plane: `which` is 'star' or 'stripe', `art` the texture key, (w, h) its size, placed at (x, y, z)
 *  with Euler rotation (rx, ry, rz) under `parent`. It is lit like the paint under it and pulled just clear of it. */
function decal(model, parent, which, art, w, h, [x, y, z], [rx, ry, rz]) {
  const mesh = new T.Mesh(
    new T.PlaneGeometry(w, h),
    new T.MeshStandardMaterial({
      map: decalTextures()[art],
      transparent: true,
      roughness: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    }),
  );
  mesh.userData.ownGeometry = mesh.userData.ownMaterial = true;
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.visible = false;
  parent.add(mesh);
  model.decals[which].push(mesh);
}

/** A roof decal pair (star and stripes) of size s x t centred at (x, y, z), facing up. */
function roofDecals(model, parent, x, y, z, s, t = s) {
  decal(
    model,
    parent,
    'star',
    'star',
    Math.min(s, t) * 0.62,
    Math.min(s, t) * 0.62,
    [x, y, z],
    [-Math.PI / 2, 0, Math.PI],
  );
  decal(model, parent, 'stripe', 'roofStripes', s, t, [x, y, z], [-Math.PI / 2, 0, 0]);
}

/** The two horns: a small dark steel trumpet (stock) and the brass bell horn earned at job 7, at (x, y, z) facing
 *  forward. Both are built from their own geometry and only one shows at a time. */
function horns(kit, model, parent, x, y, z) {
  const make = (color, extra, length, mouth, throat) => {
    const g = new T.Group();
    extra = { ...extra, side: T.DoubleSide };
    const flare = new T.Mesh(new T.CylinderGeometry(mouth, throat, length, 12, 1, true), kit.mat(color, extra));
    flare.rotation.x = Math.PI / 2;
    flare.position.z = length / 2;
    const base = new T.Mesh(new T.CylinderGeometry(throat * 1.5, throat * 1.8, 0.2, 8), kit.mat('#26333e'));
    base.position.set(0, -0.1, 0.02);
    const neck = new T.Mesh(new T.CylinderGeometry(throat * 0.9, throat * 0.9, 0.12, 8), kit.mat(color, extra));
    neck.rotation.x = Math.PI / 2;
    neck.position.z = 0.02;
    for (const m of [flare, base, neck]) {
      m.userData.ownGeometry = true;
      g.add(m);
    }
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const stock = make('#3a4752', { roughness: 0.5, metalness: 0.5 }, 0.36, 0.11, 0.04);
  const bell = make('#d4a537', { roughness: 0.3, metalness: 0.75 }, 0.6, 0.26, 0.06);
  bell.visible = false;
  model.horns = { stock, bell };
}

/** Instanced cylinder barrels (in the paint, so a paint reward recolors them) and chrome rods for `count` hydraulic
 *  cylinders, plus `links` extra solid barrel instances for linkage bars. */
function hydraulics(kit, model, c, count, links = 0) {
  const geo = kit.cylinder8(8);
  const barrels = new T.InstancedMesh(geo, kit.paintMat(c), count + links),
    rods = new T.InstancedMesh(geo, kit.mat('#d2dbe1', { metalness: 0.65, roughness: 0.28 }), count);
  barrels.castShadow = true;
  for (const m of [barrels, rods]) {
    m.frustumCulled = false;
    model.root.add(m);
  }
  model.paintable.push(barrels);
  model.hyd = { barrels, rods, links: [] };
}

/** Registers a hydraulic cylinder from point la on object A (barrel end) to point lb on object B (rod end), with a
 *  barrel `barrel` metres long and radius r. Points are in each object's own frame. */
function actuator(model, A, la, B, lb, barrel, r) {
  model.actuators.push({ A, la: new T.Vector3(...la), B, lb: new T.Vector3(...lb), barrel, r });
}

/** Point `local` on object obj, in the machine root's frame (into out). Matrices must be current. */
function inRoot(model, obj, local, out) {
  out.copy(local);
  obj.localToWorld(out);
  return model.root.worldToLocal(out);
}

/** Sets instance i of `mesh` to a cylinder or bar of radius r from a to b. */
function segment(kit, mesh, i, a, b, r) {
  const t = kit.tmp;
  t.position.copy(a).add(b).multiplyScalar(0.5);
  t.quaternion.setFromUnitVectors(UP, S.dir.subVectors(b, a).normalize());
  t.scale.set(r * 2, Math.max(0.001, a.distanceTo(b)), r * 2);
  t.updateMatrix();
  mesh.setMatrixAt(i, t.matrix);
}

/** Places every hydraulic cylinder: the barrel from its base toward the rod end and the rod out of the barrel, so it
 *  extends and retracts with the joints. Linkage bars registered in model.hyd.links are solid barrels. */
function poseHydraulics(kit, model) {
  const { barrels, rods, links } = model.hyd;
  model.actuators.forEach((h, i) => {
    const a = inRoot(model, h.A, h.la, S.a),
      b = inRoot(model, h.B, h.lb, S.b),
      len = a.distanceTo(b),
      barrel = Math.min(h.barrel, len - 0.12);
    S.dir.subVectors(b, a).normalize();
    segment(kit, barrels, i, a, S.c.copy(a).addScaledVector(S.dir, barrel), h.r);
    segment(kit, rods, i, S.d.copy(a).addScaledVector(S.dir, barrel - 0.08), b, h.r * 0.5);
  });
  links.forEach(([a, b, r], k) => segment(kit, barrels, model.actuators.length + k, a, b, r));
  barrels.instanceMatrix.needsUpdate = true;
  rods.instanceMatrix.needsUpdate = true;
}

/** Instanced ropes or cables (count of them) under the machine root. */
function ropes(kit, model, count) {
  const mesh = new T.InstancedMesh(kit.cylinder8(6), kit.mat('#7d8b94', { metalness: 0.4, roughness: 0.5 }), count);
  mesh.frustumCulled = false;
  model.root.add(mesh);
  model.ropes = mesh;
}

/** One rubber tire with chunky staggered lugs, a steel rim and lug nuts, axle along x, rim facing +x. */
function wheelGeometry(kit, { r, width }) {
  const p = new Parts(kit);
  p.cyl(0, 0, 0, r - 0.04, width, C.rubber, { axis: 'x', seg: 12 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2,
      x = i % 2 ? 0.075 : -0.075;
    p.place(x, Math.cos(a) * (r - 0.03), Math.sin(a) * (r - 0.03), width * 0.55, 0.08, 0.13, a, 0, 0).add(
      kit.boxGeo,
      C.tread,
    );
  }
  p.cyl(width / 2, 0, 0, r * 0.56, 0.04, C.rim, { axis: 'x', seg: 8 });
  p.cyl(width / 2 + 0.03, 0, 0, r * 0.22, 0.06, C.frame, { axis: 'x', seg: 8 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    p.box(width / 2 + 0.03, Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36, 0.05, 0.05, 0.05, C.frame);
  }
  return p.geometry();
}

/** The skid steer's four wheels as one instanced mesh: model.wheels lists each wheel's position and side. */
function buildWheels(kit, model) {
  const w = SKID.wheel,
    mesh = new T.InstancedMesh(wheelGeometry(kit, w), kit.detailMat(), 4);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.ownGeometry = true;
  model.root.add(mesh);
  model.wheels = { mesh, list: [] };
  for (const x of [w.x, -w.x]) for (const z of [-w.z, w.z]) model.wheels.list.push({ x, z, side: x > 0 ? 0 : 1 });
}

/** Spins each wheel by its side's travel: when the skid steer turns on the spot, the two sides roll opposite ways. */
function poseWheels(kit, model) {
  const { mesh, list } = model.wheels,
    t = kit.tmp,
    r = SKID.wheel.r;
  list.forEach((w, i) => {
    t.position.set(w.x, r, w.z);
    t.rotation.set(model.state.travel[w.side] / r, w.x > 0 ? 0 : Math.PI, 0);
    t.scale.setScalar(1);
    t.updateMatrix();
    mesh.setMatrixAt(i, t.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

/** One track's loop length and the point and outward angle at distance s along it: the top run forward, around the
 *  front idler, back along the ground and up round the rear sprocket (the way the shoes move when driving ahead). */
function trackPath(tr, s, out) {
  const run = tr.front - tr.rear,
    arc = Math.PI * tr.r,
    total = 2 * run + 2 * arc;
  s = ((s % total) + total) % total;
  let a;
  if (s < run) {
    out.set(0, tr.y + tr.r, tr.rear + s);
    a = Math.PI / 2;
  } else if (s < run + arc) {
    a = Math.PI / 2 - (s - run) / tr.r;
    out.set(0, tr.y + Math.sin(a) * tr.r, tr.front + Math.cos(a) * tr.r);
  } else if (s < 2 * run + arc) {
    out.set(0, tr.y - tr.r, tr.front - (s - run - arc));
    a = -Math.PI / 2;
  } else {
    a = -Math.PI / 2 - (s - 2 * run - arc) / tr.r;
    out.set(0, tr.y + Math.sin(a) * tr.r, tr.rear + Math.cos(a) * tr.r);
  }
  return a;
}

/** Crawler undercarriage: two track frames with rollers and idlers, the car body and swing bearing (merged), instanced
 *  track shoes with grousers and instanced drive sprockets. */
function buildTracks(kit, model, tr) {
  const p = new Parts(kit),
    len = tr.front - tr.rear;
  for (const k of [-1, 1]) {
    const x = k * tr.x;
    p.box(x, tr.y, (tr.front + tr.rear) / 2, tr.width * 0.78, tr.r * 1.15, len - 0.1, C.frame);
    p.box(x, tr.y + tr.r * 0.62, (tr.front + tr.rear) / 2, tr.width * 0.5, 0.06, len * 0.8, C.frameLight);
    const rollers = 4 + Math.round(len / 2.6);
    for (let i = 0; i < rollers; i++) {
      const z = tr.rear + 0.55 + (i * (len - 1.1)) / (rollers - 1);
      p.cyl(x, tr.y - tr.r + 0.17, z, 0.11, tr.width * 0.86, C.steel, { axis: 'x', seg: 8 });
    }
    for (const z of [-0.3, 0.3]) p.cyl(x, tr.y + tr.r - 0.11, z * len, 0.07, tr.width * 0.5, C.steel, { axis: 'x' });
    // The front idler and its tensioner block.
    p.cyl(x, tr.y, tr.front, tr.r - 0.07, tr.width * 0.8, C.steel, { axis: 'x', seg: 12 });
    p.cyl(x + k * tr.width * 0.42, tr.y, tr.front, 0.13, 0.05, C.frame, { axis: 'x', seg: 8 });
    // Final drive housing inboard of the sprocket.
    p.cyl(x - k * tr.width * 0.55, tr.y, tr.rear, 0.24, 0.24, C.frame, { axis: 'x', seg: 10 });
  }
  p.box(0, tr.y + 0.12, 0, (tr.x - tr.width / 2) * 2 + 0.1, 0.45, 1.5, C.frame);
  p.cyl(0, tr.y + tr.r + 0.06, 0, tr.x * 0.8, 0.16, C.steel, { seg: 16 });
  p.cyl(0, tr.y + tr.r + 0.15, 0, tr.x * 0.72, 0.04, C.frame, { seg: 16 });
  finish(kit, model, p, model.root, '#000');
  // Track shoes: a plate and a grouser bar that faces outward.
  const shoe = new Parts(kit);
  shoe.box(0, 0, 0, tr.width, 0.05, tr.pitch * 0.86, C.shoe);
  shoe.box(0, 0.045, -tr.pitch * 0.18, tr.width, 0.05, 0.05, C.tread);
  const per = Math.round((2 * len + 2 * Math.PI * tr.r) / tr.pitch);
  const shoes = new T.InstancedMesh(shoe.geometry(), kit.detailMat(), per * 2);
  shoes.receiveShadow = true;
  shoes.frustumCulled = false;
  shoes.userData.ownGeometry = true;
  model.root.add(shoes);
  // Drive sprockets: a toothed wheel that turns with its side.
  const sp = new Parts(kit);
  sp.cyl(0, 0, 0, tr.r - 0.1, tr.width * 0.5, C.frame, { axis: 'x', seg: 10 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    sp.place(0, Math.cos(a) * (tr.r - 0.1), Math.sin(a) * (tr.r - 0.1), tr.width * 0.36, 0.14, 0.09, a, 0, 0).add(
      kit.boxGeo,
      C.steel,
    );
  }
  sp.cyl(0, 0, 0, 0.1, tr.width * 0.62, C.pin, { axis: 'x', seg: 8 });
  const sprockets = new T.InstancedMesh(sp.geometry(), kit.detailMat(), 2);
  sprockets.castShadow = true;
  sprockets.frustumCulled = false;
  sprockets.userData.ownGeometry = true;
  model.root.add(sprockets);
  model.tracks = { tr, shoes, sprockets, per };
}

/** Scrolls each side's shoes along the loop by that side's travel and turns its sprocket. */
function poseTracks(kit, model) {
  const { tr, shoes, sprockets, per } = model.tracks,
    t = kit.tmp,
    total = 2 * (tr.front - tr.rear) + 2 * Math.PI * tr.r;
  for (let k = 0; k < 2; k++) {
    const x = k ? -tr.x : tr.x,
      travel = model.state.travel[k];
    for (let i = 0; i < per; i++) {
      const a = trackPath(tr, (i * total) / per + travel, t.position);
      t.position.x = x;
      t.rotation.set(Math.PI / 2 - a, 0, 0);
      t.scale.setScalar(1);
      t.updateMatrix();
      shoes.setMatrixAt(k * per + i, t.matrix);
    }
    t.position.set(x, tr.y, tr.rear);
    t.rotation.set(travel / tr.r, 0, 0);
    t.updateMatrix();
    sprockets.setMatrixAt(k, t.matrix);
  }
  shoes.instanceMatrix.needsUpdate = true;
  sprockets.instanceMatrix.needsUpdate = true;
}

/** The point at distance rA from A and rB from B (2D points {z, y}) on the counter-clockwise side of A->B when side
 *  is 1 (clockwise when -1). When the two cannot meet, the point lies on the line, as close as the lengths allow. */
function meet(A, rA, B, rB, side, out) {
  const dz = B.z - A.z,
    dy = B.y - A.y,
    dist = Math.hypot(dz, dy) || 1e-6,
    d = clamp(dist, Math.abs(rA - rB) + 1e-4, rA + rB - 1e-4),
    a = (rA * rA - rB * rB + d * d) / (2 * d),
    h = Math.sqrt(Math.max(0, rA * rA - a * a)),
    uz = dz / dist,
    uy = dy / dist;
  out.z = A.z + uz * a - side * uy * h;
  out.y = A.y + uy * a + side * uz * h;
  return out;
}

/** Turns a group about its x axis so its +z points from (z, y) point a toward b, and stretches it to reach b when
 *  `length` is given (the model's built length). */
function aim(g, a, b, length) {
  g.position.set(g.position.x, a.y, a.z);
  g.rotation.x = Math.atan2(-(b.y - a.y), b.z - a.z);
  if (length) g.scale.z = Math.hypot(b.y - a.y, b.z - a.z) / length;
}

// ---- SS-01 skid steer ----

function buildSkid(kit, model, d) {
  const { root, sprung } = model,
    c = d.color,
    p = new Parts(kit),
    { armX, R, link, arm } = SKID;
  // Lower frame between the wheels, with axle housings and a sloped nose.
  p.box(0, 0.56, -0.17, 1.4, 0.64, 2.16, C.frame);
  p.prism(
    [
      [0.9, 0.24],
      [1.08, 0.5],
      [1.08, 0.88],
      [0.9, 0.88],
    ],
    -0.66,
    0.66,
    C.frame,
  );
  for (const x of [-0.72, 0.72]) for (const z of [-0.6, 0.6]) p.cyl(x, 0.42, z, 0.13, 0.12, C.steel, { axis: 'x' });
  // Upper body: tub under the cage, rear engine housing and rear door, in paint.
  p.box(0, 0.98, -0.2, 1.46, 0.2, 2.1, c, { layer: 'body' });
  p.box(0, 1.27, -0.9, 1.44, 0.38, 0.72, c, { layer: 'body' });
  p.prism(
    [
      [-1.26, 1.46],
      [-0.54, 1.46],
      [-0.6, 1.52],
      [-1.2, 1.52],
    ],
    -0.7,
    0.7,
    c,
    { layer: 'body' },
  );
  p.box(0, 0.98, -1.285, 1.22, 0.8, 0.05, c, { layer: 'body' });
  for (let y = 0.7; y < 1.0; y += 0.07) p.box(0, y, -1.315, 0.9, 0.035, 0.02, C.grille);
  for (const x of [-0.56, 0.56]) {
    p.box(x, 1.35, -1.3, 0.16, 0.1, 0.04, C.tail);
    p.box(x, 1.22, -1.3, 0.16, 0.08, 0.04, C.lens);
  }
  for (const x of [-0.725, 0.725])
    for (let z = -1.15; z < -0.65; z += 0.1) p.box(x, 1.28, z, 0.02, 0.24, 0.04, C.grille);
  // Hood grille, exhaust stack with muffler and cap (right rear).
  for (let x = -0.4; x <= 0.41; x += 0.1) p.box(x, 1.525, -0.95, 0.04, 0.02, 0.45, C.grille);
  p.cyl(-0.5, 1.6, -1.05, 0.11, 0.18, C.steel, { axis: 'z' });
  p.cyl(-0.5, 1.85, -1.08, 0.045, 0.6, C.steel);
  p.cyl(-0.5, 2.17, -1.08, 0.06, 0.05, C.bar);
  // Towers at the rear corners carry the lift-link pivots.
  const tower = [
    [-1.27, 0.98],
    [-0.55, 0.98],
    [-0.6, 1.36],
    [-0.78, 1.58],
    [-1.0, 1.6],
    [-1.27, 1.48],
  ];
  p.prism(tower, 0.7, 0.79, c, { layer: 'body' });
  p.prism(tower, -0.79, -0.7, c, { layer: 'body' });
  p.cyl(0, R.y, R.z, 0.07, 2.04, C.pin, { axis: 'x' });
  // Lift-cylinder base lugs low on the frame sides.
  for (const x of [-0.8, 0.8]) p.box(x, 0.62, -0.95, 0.08, 0.16, 0.16, C.steel);
  // The ROPS cage: corner posts, side screens of bars, header, sill, rear window, painted roof.
  const cz = [-0.5, 0.76];
  for (const x of [-0.58, 0.58]) {
    for (const z of cz) p.box(x, 1.56, z, 0.08, 0.98, 0.08, C.bar);
    for (const y of [1.34, 1.58, 1.82]) p.box(x, y, 0.13, 0.04, 0.04, 1.26, C.bar);
    for (const z of [-0.08, 0.34]) p.box(x, 1.56, z, 0.04, 0.96, 0.04, C.bar);
    p.box(x, 1.56, 0.85, 0.04, 0.5, 0.04, C.rail);
  }
  p.box(0, 1.99, 0.76, 1.16, 0.08, 0.08, C.bar);
  p.box(0, 1.12, 0.76, 1.16, 0.06, 0.08, C.bar);
  p.box(0, 1.6, -0.52, 1.1, 0.8, 0.03, '#000', { layer: 'glass' });
  p.box(0, 2.07, 0.13, 1.3, 0.07, 1.44, c, { layer: 'body' });
  p.box(0, 2.02, 0.13, 1.22, 0.04, 1.36, C.bar);
  // Inside: seat, lap bar, joystick pods and grips, and a floor plate.
  p.box(0, 1.3, -0.16, 0.56, 0.12, 0.48, C.seat);
  p.box(0, 1.62, -0.41, 0.54, 0.56, 0.1, C.seat, { rx: -0.14 });
  p.box(0, 1.14, 0.35, 1.0, 0.03, 0.75, C.frameLight);
  for (const x of [-0.42, 0.42]) {
    p.box(x, 1.5, -0.08, 0.04, 0.04, 0.5, C.rail);
    p.box(x, 1.28, 0.1, 0.16, 0.26, 0.32, C.bar);
    p.cyl(x, 1.5, 0.16, 0.025, 0.2, C.steel);
    p.box(x, 1.64, 0.17, 0.07, 0.1, 0.07, C.bar);
    p.box(x, 1.7, 0.19, 0.03, 0.03, 0.03, C.amber);
  }
  p.box(0, 1.5, 0.17, 0.88, 0.04, 0.04, C.rail);
  // Lights: two front work lights on the header, two on the rear of the roof, and the beacon.
  for (const x of [-0.45, 0.45]) {
    p.box(x, 2.11, 0.8, 0.16, 0.11, 0.08, C.bar);
    p.box(x, 2.11, 0.845, 0.12, 0.08, 0.02, C.lens);
    p.box(x, 2.11, -0.56, 0.16, 0.1, 0.06, C.bar);
    p.box(x, 2.11, -0.595, 0.12, 0.07, 0.02, C.lens);
  }
  p.cyl(0.42, 2.135, -0.3, 0.1, 0.05, C.bar);
  p.cyl(0.42, 2.23, -0.3, 0.075, 0.15, C.amber);
  // Front step between the arms.
  p.box(0, 0.98, 1.0, 0.9, 0.05, 0.24, C.steel);
  finish(kit, model, p, sprung, c);
  plate(sprung, d, 0, 1.24, -1.32, 0.86);
  roofDecals(model, sprung, 0, 2.108, 0.13, 1.2, 1.32);
  horns(kit, model, sprung, -0.3, 2.31, 0.5);
  buildWheels(kit, model);

  // Rear links (both sides turn together) and the lift arms with their front cross tube.
  const links = group(sprung, 0, R.y, R.z),
    lp = new Parts(kit);
  for (const x of [-1, 1]) lp.box(x * (armX + 0.1), 0, link / 2, 0.06, 0.16, link + 0.12, C.steel);
  finish(kit, model, lp, links, c);
  const arms = group(sprung),
    ap = new Parts(kit);
  const profile = [
    [-0.14, 0.11],
    [-0.12, -0.13],
    [arm * 0.62, 0.17],
    [arm - 0.2, -0.12],
    [arm + 0.12, -0.1],
    [arm + 0.1, 0.14],
    [arm * 0.68, 0.44],
  ];
  for (const x of [-1, 1]) {
    ap.prism(profile, x * armX - 0.065, x * armX + 0.065, c, { layer: 'body' });
    ap.cyl(x * (armX + 0.05), 0, 0, 0.075, 0.22, C.pin, { axis: 'x' });
    ap.cyl(x * armX, 0, arm, 0.07, 0.2, C.pin, { axis: 'x' });
    ap.box(x * armX, 0.36, arm * 0.68, 0.16, 0.08, 0.2, C.frame);
    // Hydraulic hoses along the top of each arm.
    ap.bar([x * (armX - 0.04), 0.13, 0.3], [x * (armX - 0.04), 0.42, arm * 0.66], 0.035, C.hose);
  }
  ap.cyl(0, 0.3, arm * 0.68, 0.085, armX * 2, c, { axis: 'x', layer: 'body' });
  for (const x of [-0.42, 0.42]) ap.box(x, 0.38, arm * 0.68, 0.1, 0.12, 0.16, C.steel);
  finish(kit, model, ap, arms, c);
  // Decals on the arms' outer faces: a star near the pivot, a stripe along the rear run.
  const slope = Math.atan2(0.3, arm * 0.62);
  for (const k of [-1, 1]) {
    const x = k * (armX + 0.068),
      ry = (k * Math.PI) / 2;
    decal(model, arms, 'star', 'star', 0.32, 0.32, [x, 0.17, arm * 0.36], [0, ry, k > 0 ? Math.PI - slope : slope]);
    decal(
      model,
      arms,
      'stripe',
      'sideStripe',
      1.6,
      0.12,
      [x, 0.15, arm * 0.36],
      [0, ry, k > 0 ? Math.PI - slope : slope],
    );
  }

  // The bucket, built from the physics outline: floor, back, sloped side plates, spill guard, cutting edge, coupler.
  const bucket = group(root),
    bp = new Parts(kit),
    B = SKID_BUCKET;
  bucket.rotation.order = 'YXZ';
  bp.box(0, B.floor.y, (B.floor.z[0] + B.floor.z[1]) / 2, B.width, B.floor.thick, B.floor.z[1] - B.floor.z[0], c, {
    layer: 'body',
  });
  bp.box(0, (B.back.y[0] + B.back.y[1]) / 2, B.back.z, B.width, B.back.y[1] - B.back.y[0], B.back.thick, c, {
    layer: 'body',
  });
  for (const k of [-1, 1])
    bp.prism(B.side, k > 0 ? B.sideX[0] : -B.sideX[1], k > 0 ? B.sideX[1] : -B.sideX[0], c, { layer: 'body' });
  bp.box(0, B.back.y[1] + 0.02, B.back.z + 0.08, B.width, 0.05, 0.2, c, { layer: 'body', rx: -0.35 });
  bp.box(0, B.floor.y - 0.02, B.floor.z[1] + 0.06, B.width + 0.04, 0.07, 0.17, C.edge);
  for (const k of [-1, 1]) bp.box(k * 1.15, -0.5, 0.64, 0.14, 0.2, 0.04, C.edge);
  bp.box(0, -0.2, -0.735, 1.9, 0.66, 0.07, C.frame);
  for (const x of [-armX, armX]) bp.box(x, SKID.pin.y, SKID.pin.z, 0.16, 0.2, 0.16, C.steel);
  for (const x of [-0.42, 0.42]) bp.box(x, SKID.ear.y, SKID.ear.z, 0.12, 0.16, 0.14, C.steel);
  finish(kit, model, bp, bucket, c);

  hydraulics(kit, model, c, 4);
  for (const k of [-1, 1]) {
    actuator(model, sprung, [k * 0.8, 0.62, -0.95], arms, [k * (armX - 0.06), -0.06, 1.15], 1.0, 0.075);
    actuator(model, arms, [k * 0.42, 0.42, arm * 0.68 - 0.02], bucket, [k * 0.42, SKID.ear.y, SKID.ear.z], 0.72, 0.06);
  }
  Object.assign(model, { links, arms, bucket });
}

/** Skid steer: the bucket sits at the grab point with its tilt; each lift arm pins to it at B and pivots at P, which
 *  the rear link swings about R so the bucket can rise straight up; cylinders follow the arms and the bucket. */
function poseSkid(kit, model, m, tip) {
  const { root, sprung, links, arms, bucket } = model;
  bucket.position.copy(tip);
  bucket.rotation.set(m.tilt, 0, 0);
  root.updateMatrixWorld(true);
  const B = inRoot(model, bucket, SKID.pin, S.a);
  // B in the sprung body's frame.
  root.localToWorld(B);
  sprung.worldToLocal(B);
  const pin = { z: B.z, y: B.y },
    P = meet(SKID.R, SKID.link, pin, SKID.arm, 1, { z: 0, y: 0 });
  aim(links, SKID.R, P);
  arms.position.x = 0;
  aim(arms, P, pin, SKID.arm);
}

// ---- EX-02 excavator ----

function buildExcavator(kit, model, d) {
  const { root, sprung } = model,
    c = d.color,
    E = EXC;
  buildTracks(kit, model, E.track);
  const house = group(sprung),
    p = new Parts(kit);
  // Revolving frame, counterweight with a rounded back, engine hood with grilles, right-hand tank box.
  p.box(0, 1.1, -0.05, 2.5, 0.2, 2.6, C.frame);
  const cw = [
    [-1.25, -1.2],
    [1.25, -1.2],
    [1.25, -1.6],
    [1.0, -1.9],
    [0.45, -2.02],
    [-0.45, -2.02],
    [-1.0, -1.9],
    [-1.25, -1.6],
  ];
  p.plan(cw, 1.02, 1.95, c, { layer: 'body' });
  p.plan(
    cw.map(([x, z]) => [x * 1.01, z * 1.005]),
    1.0,
    1.1,
    C.frame,
  );
  p.box(0, 1.58, -0.75, 2.5, 0.76, 0.9, c, { layer: 'body' });
  p.box(0, 1.99, -0.78, 2.3, 0.07, 0.8, c, { layer: 'body' });
  for (let x = -1.0; x <= -0.2; x += 0.13) p.box(x, 2.03, -0.78, 0.06, 0.02, 0.62, C.grille);
  for (const x of [-1.256, 1.256])
    for (let z = -1.1; z < -0.4; z += 0.1) p.box(x, 1.62, z, 0.02, 0.42, 0.045, C.grille);
  p.box(-0.78, 1.5, 0.45, 0.94, 0.6, 1.5, c, { layer: 'body' });
  p.box(-1.256, 1.5, 0.45, 0.02, 0.5, 0.025, C.grille);
  p.box(-0.78, 1.805, 0.45, 0.9, 0.02, 1.45, C.frameLight);
  // Rear lamps in the counterweight, exhaust stack and air cleaner.
  for (const x of [-0.75, 0.75]) p.box(x, 1.75, -1.92, 0.16, 0.09, 0.05, C.tail, { ry: x > 0 ? 0.5 : -0.5 });
  p.cyl(-0.6, 2.28, -1.0, 0.06, 0.6, C.steel);
  p.cyl(-0.6, 2.6, -1.0, 0.075, 0.06, C.bar);
  p.cyl(-0.25, 2.1, -1.0, 0.12, 0.2, C.frameLight);
  // Boom foot plates and boom-cylinder base lugs.
  const foot = [
    [-0.25, 1.2],
    [1.05, 1.2],
    [0.85, 1.95],
    [0.2, 2.02],
  ];
  p.prism(foot, 0.21, 0.28, c, { layer: 'body' });
  p.prism(foot, -0.28, -0.21, c, { layer: 'body' });
  for (const x of [-0.31, 0.31]) p.box(x, 1.32, 1.0, 0.12, 0.16, 0.2, C.steel);
  p.cyl(0, E.F.y, E.F.z, 0.1, 0.6, C.pin, { axis: 'x' });
  // The cab: front-left, a tall box with a big raked front window, door glass, side and rear glass.
  const cab = [
    [-0.3, 1.2],
    [1.22, 1.2],
    [1.24, 1.5],
    [1.08, 2.68],
    [0.96, 2.78],
    [-0.22, 2.78],
    [-0.3, 2.62],
  ];
  p.prism(cab, 0.32, 1.24, c, { layer: 'body' });
  p.bar([0.78, 1.52, 1.252], [0.78, 2.64, 1.097], 0.8, '#000', { layer: 'glass', d: 0.03 });
  p.prism(
    [
      [0.02, 1.48],
      [1.12, 1.48],
      [1.0, 2.62],
      [0.02, 2.62],
    ],
    1.24,
    1.255,
    '#000',
    { layer: 'glass' },
  );
  p.prism(
    [
      [0.25, 1.62],
      [1.1, 1.62],
      [0.99, 2.6],
      [0.25, 2.6],
    ],
    0.305,
    0.32,
    '#000',
    { layer: 'glass' },
  );
  p.box(0.78, 2.2, -0.305, 0.7, 0.55, 0.02, '#000', { layer: 'glass' });
  for (const x of [0.335, 1.225]) p.bar([x, 1.48, 1.255], [x, 2.7, 1.075], 0.05, C.bar);
  p.box(1.258, 2.05, 0.56, 0.02, 1.15, 0.05, C.bar);
  p.bar([0.62, 1.62, 1.26], [0.78, 2.3, 1.18], 0.025, C.bar);
  p.box(0.78, 2.81, 0.25, 0.86, 0.05, 1.0, C.frameLight);
  p.cyl(0.95, 2.86, -0.05, 0.1, 0.06, C.bar);
  p.cyl(0.95, 2.96, -0.05, 0.075, 0.15, C.amber);
  for (const x of [0.5, 1.05]) {
    p.box(x, 2.88, 0.95, 0.16, 0.1, 0.1, C.bar);
    p.box(x, 2.88, 1.005, 0.12, 0.07, 0.02, C.lens);
  }
  // Hand rail on the right-hand deck, mirrors.
  for (const z of [-0.15, 0.5, 1.12]) p.box(-1.18, 2.06, z, 0.045, 0.5, 0.045, C.rail);
  p.box(-1.18, 2.31, 0.48, 0.05, 0.05, 1.32, C.rail);
  p.box(-1.18, 2.06, 0.48, 0.035, 0.035, 1.3, C.rail);
  p.box(-1.18, 2.45, 1.12, 0.03, 0.28, 0.03, C.bar);
  p.box(-1.18, 2.62, 1.14, 0.04, 0.2, 0.14, C.bar);
  p.box(1.3, 2.35, 1.12, 0.03, 0.4, 0.03, C.bar);
  p.box(1.33, 2.55, 1.14, 0.04, 0.18, 0.12, C.bar);
  finish(kit, model, p, house, c);
  plate(house, d, 0, 1.5, -2.03, 0.88);
  roofDecals(model, house, 0.78, 2.84, 0.25, 0.8, 0.96);
  for (const k of [-1, 1]) {
    decal(model, house, 'star', 'star', 0.44, 0.44, [k * 1.258, 1.68, -0.76], [0, (k * Math.PI) / 2, 0]);
    decal(model, house, 'stripe', 'sideStripe', 2.75, 0.16, [k * 1.259, 1.3, -0.2], [0, (k * Math.PI) / 2, 0]);
  }
  horns(kit, model, house, 0.55, 3.0, 0.7);

  // The boom: a bent box with hoses and a work light; built along +z from the foot pin.
  const boom = group(house, 0, E.F.y, E.F.z),
    bp = new Parts(kit),
    L = E.boom;
  bp.prism(
    [
      [-0.3, 0.1],
      [-0.25, -0.22],
      [L * 0.5, 0.02],
      [L + 0.15, -0.18],
      [L + 0.2, 0.12],
      [L * 0.55, 0.62],
      [0, 0.3],
    ],
    -0.2,
    0.2,
    c,
    {
      layer: 'body',
    },
  );
  bp.cyl(0, 0, L, 0.1, 0.5, C.pin, { axis: 'x' });
  for (const x of [-0.27, 0.27]) bp.box(x, -0.1, 1.9, 0.12, 0.2, 0.22, C.steel);
  bp.box(0, 0.7, L * 0.53, 0.16, 0.18, 0.22, C.steel);
  for (const x of [-0.09, 0.09]) {
    bp.bar([x, 0.32, 0.2], [x, 0.66, L * 0.55], 0.04, C.hose);
    bp.bar([x, 0.66, L * 0.55], [x, 0.18, L - 0.1], 0.04, C.hose);
  }
  bp.box(0.24, 0.4, 1.3, 0.1, 0.12, 0.14, C.bar);
  bp.box(0.24, 0.4, 1.375, 0.08, 0.09, 0.02, C.lens);
  finish(kit, model, bp, boom, c);
  // The stick: tapered, with its heel behind the boom pin; built along +z from the boom-tip pin.
  const stick = group(house),
    sp = new Parts(kit),
    Ls = E.stick;
  sp.prism(
    [
      [-0.8, 0.05],
      [-0.66, -0.3],
      [0.2, -0.22],
      [Ls + 0.08, -0.11],
      [Ls + 0.12, 0.1],
      [0.3, 0.28],
      [-0.5, 0.26],
    ],
    -0.16,
    0.16,
    c,
    {
      layer: 'body',
    },
  );
  sp.cyl(0, 0, Ls, 0.08, 0.42, C.pin, { axis: 'x' });
  sp.cyl(0, E.S.y, E.S.z, 0.06, 0.4, C.pin, { axis: 'x' });
  sp.box(0, -0.2, -0.7, 0.14, 0.14, 0.16, C.steel);
  sp.box(0, 0.36, 0.15, 0.14, 0.14, 0.18, C.steel);
  sp.bar([0.12, 0.3, 0.0], [0.12, 0.14, Ls - 0.5], 0.04, C.hose);
  finish(kit, model, sp, stick, c);
  // The bucket: side plates, a curved shell, cutting edge with five teeth, and the pin ears.
  const bucket = group(root),
    shell = group(bucket),
    kp = new Parts(kit),
    k0 = 1 / E.bucketScale;
  bucket.rotation.order = 'YXZ';
  shell.scale.setScalar(E.bucketScale);
  const curve = [
    [-0.62, 0.74],
    [-0.78, 0.38],
    [-0.78, -0.1],
    [-0.62, -0.46],
    [-0.35, -0.68],
    [0.05, -0.76],
    [0.45, -0.69],
    [0.72, -0.55],
  ];
  const sidePlate = [...curve, [0.72, -0.42], [0.1, 0.2], [-0.3, 0.74]];
  for (const k of [-1, 1]) kp.prism(sidePlate, k > 0 ? 0.68 : -0.74, k > 0 ? 0.74 : -0.68, c, { layer: 'body' });
  for (let i = 0; i < curve.length - 1; i++) {
    const [z0, y0] = curve[i],
      [z1, y1] = curve[i + 1];
    kp.bar([0, y0, z0], [0, y1, z1], 1.38, c, { layer: 'body', d: 0.07 });
  }
  kp.bar([0, -0.6, 0.62], [0, -0.5, 0.84], 1.44, C.edge, { d: 0.07 });
  for (let i = 0; i < 5; i++) {
    const x = -0.56 + i * 0.28;
    kp.prism(
      [
        [0.74, -0.58],
        [1.04, -0.43],
        [0.76, -0.45],
      ],
      x - 0.06,
      x + 0.06,
      C.edge,
    );
  }
  for (const x of [-0.2, 0.2]) {
    kp.prism(
      [
        [-0.72, 0.6],
        [-0.15, 0.62],
        [-0.12, 0.88],
        [-0.66, 0.9],
      ],
      x - 0.04,
      x + 0.04,
      C.steel,
    );
  }
  kp.cyl(0, E.pin.y * k0, E.pin.z * k0, 0.075, 0.5, C.pin, { axis: 'x' });
  kp.cyl(0, E.ear.y * k0, E.ear.z * k0, 0.065, 0.5, C.pin, { axis: 'x' });
  finish(kit, model, kp, shell, c);

  hydraulics(kit, model, c, 4, 2);
  for (const k of [-1, 1]) actuator(model, house, [k * 0.31, 1.32, 1.0], boom, [k * 0.27, -0.12, 1.9], 1.15, 0.085);
  actuator(model, boom, [0, 0.74, L * 0.53], stick, [0, -0.2, -0.7], 1.45, 0.08);
  actuator(model, stick, [0, 0.38, 0.15], stick, [0, 0, 0], 1.9, 0.07);
  model.joint = new T.Vector3();
  Object.assign(model, { house, boom, stick, bucket });
}

/** Excavator: the bucket hangs at the grab point with its curl; the boom and stick solve a two-link reach from the
 *  boom foot to the bucket pin, elbow up; the four-bar linkage and the three cylinders follow. */
function poseExcavator(kit, model, m, tip) {
  const { root, house, boom, stick, bucket } = model,
    E = EXC;
  house.rotation.y = m.swing;
  bucket.position.copy(tip);
  bucket.rotation.set(m.tilt, m.swing, 0);
  root.updateMatrixWorld(true);
  const W = inRoot(model, bucket, E.pin, S.a);
  root.localToWorld(W);
  house.worldToLocal(W);
  const w = { z: W.z, y: W.y },
    elbow = meet(E.F, E.boom, w, E.stick, 1, { z: 0, y: 0 });
  aim(boom, E.F, elbow);
  stick.position.x = 0;
  aim(stick, elbow, w, E.stick);
  root.updateMatrixWorld(true);
  // The linkage in the stick's frame: side link from S, bucket link to the bucket's ear, meeting at J.
  const ear = inRoot(model, bucket, E.ear, S.b);
  root.localToWorld(ear);
  stick.worldToLocal(ear);
  // Of the two places the links can meet, the one on the bucket cylinder's side of the stick.
  const sPin = { z: E.S.z, y: E.S.y },
    earPin = { z: ear.z, y: ear.y },
    J1 = meet(sPin, E.sideLink, earPin, E.bucketLink, 1, { z: 0, y: 0 }),
    J2 = meet(sPin, E.sideLink, earPin, E.bucketLink, -1, { z: 0, y: 0 }),
    J = J1.y > J2.y ? J1 : J2;
  model.joint.set(0, J.y, J.z);
  const h = model.actuators[3];
  h.lb.copy(model.joint);
  const j = inRoot(model, stick, model.joint, S.c).clone(),
    s = inRoot(model, stick, E.S, S.d).clone(),
    e = inRoot(model, bucket, E.ear, S.e).clone();
  model.hyd.links = [
    [s, j, 0.055],
    [j, e, 0.055],
  ];
}

// ---- CR-03 crawler crane ----

function buildCrane(kit, model, d) {
  const { root, sprung } = model,
    c = d.color,
    K = CRN;
  buildTracks(kit, model, K.track);
  const house = group(sprung),
    p = new Parts(kit);
  // Deck, machinery house with louvres and a roof walkway, counterweight slabs, boom foot plates.
  p.box(0, 1.15, -0.3, 2.3, 0.2, 3.4, C.frame);
  p.box(-0.3, 1.82, -0.55, 1.6, 1.14, 2.7, c, { layer: 'body' });
  p.box(-0.3, 2.405, -0.55, 1.5, 0.03, 2.6, C.frameLight);
  for (let z = -1.6; z < -0.4; z += 0.12) p.box(-1.105, 1.95, z, 0.02, 0.6, 0.05, C.grille);
  p.box(-1.105, 1.7, 0.35, 0.02, 0.9, 0.03, C.grille);
  for (let i = 0; i < 4; i++) p.box(0, 1.41 + i * 0.3, -2.25, 2.1, 0.27, 0.6, c, { layer: 'body' });
  p.box(0, 1.85, -2.22, 2.0, 1.2, 0.5, C.frame);
  for (const x of [-0.7, 0.7]) p.box(x, 2.53, -2.25, 0.14, 0.1, 0.14, C.steel);
  const foot = [
    [0.6, 1.25],
    [1.55, 1.25],
    [1.5, 2.1],
    [0.9, 2.2],
  ];
  for (const x of [-0.5, 0.5]) p.prism(foot, x - 0.04, x + 0.04, C.frameLight);
  p.cyl(0, K.F.y, K.F.z, 0.1, 1.08, C.pin, { axis: 'x' });
  // The long low operator cab at the front left: raked windscreen, long side window, roof skylight.
  p.prism(
    [
      [-0.7, 1.25],
      [1.75, 1.25],
      [1.86, 1.55],
      [1.66, 2.28],
      [-0.7, 2.28],
    ],
    0.55,
    1.3,
    c,
    { layer: 'body' },
  );
  p.bar([0.925, 1.6, 1.865], [0.925, 2.22, 1.69], 0.64, '#000', { layer: 'glass', d: 0.03 });
  p.prism(
    [
      [0.05, 1.56],
      [1.68, 1.56],
      [1.56, 2.18],
      [0.05, 2.18],
    ],
    1.3,
    1.315,
    '#000',
    { layer: 'glass' },
  );
  p.prism(
    [
      [0.7, 1.62],
      [1.62, 1.62],
      [1.52, 2.18],
      [0.7, 2.18],
    ],
    0.535,
    0.55,
    '#000',
    { layer: 'glass' },
  );
  p.box(0.925, 2.29, 1.2, 0.55, 0.02, 0.7, '#000', { layer: 'glass' });
  p.box(1.318, 1.87, 0.55, 0.02, 0.66, 0.05, C.bar);
  p.bar([0.75, 1.65, 1.875], [0.92, 2.15, 1.72], 0.025, C.bar);
  for (const x of [0.62, 1.22]) {
    p.box(x, 2.34, 1.62, 0.14, 0.09, 0.09, C.bar);
    p.box(x, 2.34, 1.67, 0.1, 0.06, 0.02, C.lens);
  }
  p.cyl(0.92, 2.31, -0.45, 0.1, 0.06, C.bar);
  p.cyl(0.92, 2.41, -0.45, 0.075, 0.15, C.amber);
  // Gantry (A-frame) with its sheaves, the winch drum frame, exhaust stack, hand rails.
  for (const x of [-0.55, 0.55]) {
    const top = [x * 0.82, K.gantry.y, K.gantry.z];
    p.bar([x, 2.4, -0.8], top, 0.11, c, { layer: 'body' });
    p.bar([x, 2.4, -1.85], top, 0.11, c, { layer: 'body' });
    p.cyl(x * 0.55, K.gantry.y, K.gantry.z, 0.16, 0.07, C.frame, { axis: 'x', seg: 10 });
  }
  p.cyl(0, K.gantry.y, K.gantry.z, 0.06, 1.0, C.pin, { axis: 'x' });
  for (const x of [-0.64, 0.64]) p.box(x, 2.62, K.drum.z, 0.06, 0.5, 0.8, C.frame);
  p.cyl(-0.85, 2.72, -1.55, 0.06, 0.65, C.steel);
  p.cyl(-0.85, 3.06, -1.55, 0.075, 0.05, C.bar);
  for (const z of [-1.75, -0.95, -0.15, 0.6]) p.box(-1.05, 2.66, z, 0.045, 0.52, 0.045, C.rail);
  p.box(-1.05, 2.9, -0.57, 0.05, 0.05, 2.4, C.rail);
  p.box(-1.05, 2.66, -0.57, 0.035, 0.035, 2.4, C.rail);
  for (const x of [-0.55, 0.15]) p.box(x, 2.66, -1.75, 0.045, 0.52, 0.045, C.rail);
  p.box(-0.45, 2.9, -1.75, 1.2, 0.05, 0.05, C.rail);
  finish(kit, model, p, house, c);
  plate(house, d, 0, 1.86, -2.56, 0.9);
  roofDecals(model, house, 0.925, 2.29, 0.05, 0.62, 1.2);
  decal(model, house, 'star', 'star', 0.5, 0.5, [-1.107, 1.95, -1.05], [0, -Math.PI / 2, 0]);
  decal(model, house, 'star', 'star', 0.5, 0.5, [0.507, 1.95, -1.35], [0, Math.PI / 2, 0]);
  decal(model, house, 'stripe', 'sideStripe', 2.6, 0.16, [-1.108, 1.45, -0.55], [0, -Math.PI / 2, 0]);
  decal(model, house, 'stripe', 'sideStripe', 1.1, 0.16, [0.508, 1.45, -1.35], [0, Math.PI / 2, 0]);
  horns(kit, model, house, 0.68, 2.39, 0.35);

  // The winch drum: rope wraps between flanges, with spokes and a bright clamp so its turning shows.
  const drum = group(house, 0, K.drum.y, K.drum.z),
    dp = new Parts(kit);
  dp.cyl(0, 0, 0, K.drum.r, 1.1, C.ropeDrum, { axis: 'x', seg: 12 });
  for (const x of [-0.56, 0.56]) {
    dp.cyl(x, 0, 0, K.drum.r + 0.1, 0.05, C.frame, { axis: 'x', seg: 12 });
    for (let i = 0; i < 4; i++)
      dp.place(x * 1.06, 0, 0, 0.03, (K.drum.r + 0.08) * 2, 0.06, (i * Math.PI) / 4, 0, 0).add(kit.boxGeo, C.steel);
  }
  dp.box(0, K.drum.r + 0.01, 0, 0.9, 0.05, 0.09, C.hook);
  finish(kit, model, dp, drum, c);
  // The lattice boom: four chords and zigzag lacing on all four faces, foot pins and a head with sheaves.
  const boom = group(house, 0, K.F.y, K.F.z),
    lp = new Parts(kit),
    L = K.boom;
  const half = (s) => [
    s < L - 1.8 ? 0.4 : 0.4 - ((s - (L - 1.8)) / 1.8) * 0.18,
    s < 1.4 ? 0.1 + (s / 1.4) * 0.22 : s < L - 1.8 ? 0.32 : 0.32 - ((s - (L - 1.8)) / 1.8) * 0.15,
  ];
  const stations = [0, 1.4];
  for (let i = 1; i <= 11; i++) stations.push(1.4 + (i * (L - 3.2)) / 11);
  stations.push(L - 0.9, L);
  const corner = (s, sx, sy) => {
    const [w, h] = half(s);
    return [sx * w, sy * h, s];
  };
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    for (const [a, b] of [
      [0, 1.4],
      [1.4, L - 1.8],
      [L - 1.8, L],
    ])
      lp.bar(corner(a, sx, sy), corner(b, sx, sy), 0.1, c, { layer: 'body' });
  }
  for (let i = 0; i < stations.length - 1; i++) {
    const s0 = stations[i],
      s1 = stations[i + 1],
      f = i % 2 ? 1 : -1;
    for (const sy of [-1, 1]) lp.bar(corner(s0, f, sy), corner(s1, -f, sy), 0.05, c, { layer: 'body' });
    for (const sx of [-1, 1]) lp.bar(corner(s0, sx, f), corner(s1, sx, -f), 0.05, c, { layer: 'body' });
  }
  for (const s of [1.4, L - 1.8]) {
    for (const sy of [-1, 1]) lp.bar(corner(s, -1, sy), corner(s, 1, sy), 0.06, c, { layer: 'body' });
  }
  lp.box(0, 0, L + 0.08, 0.5, 0.34, 0.36, C.frameLight);
  for (const x of [-0.13, 0.13])
    lp.cyl(x, SHEAVE.y, L + K.head - 0.04, SHEAVE.r, 0.08, C.frame, { axis: 'x', seg: 12 });
  lp.cyl(0, SHEAVE.y, L + K.head - 0.04, 0.05, 0.42, C.pin, { axis: 'x' });
  for (const x of [-0.3, 0.3]) lp.box(x, 0.36, L - 0.7, 0.06, 0.12, 0.2, C.steel);
  lp.box(0, 0.22, L + 0.28, 0.12, 0.08, 0.12, C.tail);
  finish(kit, model, lp, boom, c);
  // The hook: a magnet on four chains under a hook block whose sheave the load line reeves.
  const hook = group(root),
    hp = new Parts(kit);
  hook.rotation.order = 'YXZ';
  hp.cyl(0, 0.62, 0, 0.55, 0.16, C.magnet, { seg: 12 });
  hp.cyl(0, 0.75, 0, 0.36, 0.1, c, { layer: 'body', seg: 10 });
  hp.box(0, 0.83, 0.18, 0.2, 0.08, 0.12, C.frame);
  for (const [x, z] of [
    [-0.28, -0.28],
    [0.28, -0.28],
    [0.28, 0.28],
    [-0.28, 0.28],
  ])
    hp.bar([x, 0.8, z], [0, 1.3, 0], 0.035, C.steel);
  hp.box(0, 1.33, 0, 0.12, 0.08, 0.12, C.hook);
  hp.bar([0, 1.36, 0], [0, 1.5, 0.08], 0.06, C.hook);
  hp.box(0, 1.76, 0, 0.18, 0.5, 0.44, C.hook);
  for (const x of [-0.12, 0.12]) {
    hp.box(x, 1.76, 0, 0.04, 0.58, 0.52, C.hook);
    for (const y of [1.62, 1.88]) hp.box(x * 1.2, y, 0, 0.01, 0.06, 0.5, C.bar, { rx: 0.6 });
  }
  hp.cyl(0, 1.86, 0, 0.21, 0.14, C.frame, { axis: 'x', seg: 10 });
  finish(kit, model, hp, hook, c);
  ropes(kit, model, 6);
  Object.assign(model, { house, drum, boom, hook });
}

/** Crawler crane: the boom luffs so its head sheave sits right above the grab point at the physics reach, the hook
 *  hangs at the grab point on two falls, the boom-hoist cables run to the gantry and the drum pays out the rope. */
function poseCrane(kit, model, m, tip) {
  const { root, house, drum, boom, hook, ropes: rp } = model,
    K = CRN;
  house.rotation.y = m.swing;
  hook.position.copy(tip);
  hook.rotation.set(0, m.swing, 0);
  root.updateMatrixWorld(true);
  const T0 = S.a.copy(tip);
  root.localToWorld(T0);
  house.worldToLocal(T0);
  // Luff the boom so the load line leaves the front of the head sheave right above the hook.
  const cy = SHEAVE.y,
    cz = K.boom + K.head - 0.04;
  let angle = 1.2;
  for (let i = 0; i < 4; i++)
    angle = Math.acos(clamp((T0.z - K.F.z - SHEAVE.r + cy * Math.sin(angle)) / cz, 0.05, 0.99));
  boom.rotation.x = -angle;
  root.updateMatrixWorld(true);
  const sheaveY = K.F.y + cy * Math.cos(angle) + cz * Math.sin(angle),
    sheaveZ = K.F.z - cy * Math.sin(angle) + cz * Math.cos(angle) + SHEAVE.r;
  const pts = (obj, x, y, z) => inRoot(model, obj, S.c.set(x, y, z), S.c).clone();
  const fall = [pts(house, -0.12, sheaveY, sheaveZ), pts(house, 0.12, sheaveY, sheaveZ)];
  drum.rotation.x = (fall[0].y - tip.y) / K.drum.r;
  const lines = [
    [pts(house, -0.3, K.gantry.y, K.gantry.z), pts(boom, -0.3, 0.36, K.boom - 0.7)],
    [pts(house, 0.3, K.gantry.y, K.gantry.z), pts(boom, 0.3, 0.36, K.boom - 0.7)],
    [fall[0], pts(hook, -0.08, 1.98, 0)],
    [fall[1], pts(hook, 0.08, 1.98, 0)],
    [pts(house, 0, K.drum.y + K.drum.r, K.drum.z), pts(boom, 0, 0.36, 1.1)],
    [pts(boom, 0, 0.36, 1.1), pts(boom, 0, 0.26, K.boom + K.head - 0.04)],
  ];
  lines.forEach(([a, b], i) => segment(kit, rp, i, a, b, i < 2 ? 0.03 : 0.025));
  rp.instanceMatrix.needsUpdate = true;
}

// ---- Per frame ----

/** Moves a machine model to its physics state: chassis and suspension settle, wheel spin or track scroll, the
 *  tool at the grab point, the arms and cylinders from the joints, decals, horn and paint. `look` is the scene:
 *  { paint, decal, horn, honkAt, yard } from the builder's chosen rewards. */
export function syncMachine(kit, model, m, look) {
  const row = MACHINE[m.kind],
    { root, sprung, state } = model;
  root.position.set(m.x, m.y - 0.7, m.z);
  root.rotation.y = m.yaw;
  // Time since the last frame in simulated seconds (0 while paused), for travel and the suspension spring.
  const now = look.yard?.time ?? 0,
    dt = state.time === null ? 0 : clamp(now - state.time, 0, 0.25);
  state.time = now;
  // The chassis's real forward speed and turn rate since the last frame (a parked machine reads 0 even if its last
  // drive speed is still stored; a reset or restore jump reads as no motion).
  let speed = dt > 0 ? ((m.x - state.x) * Math.sin(m.yaw) + (m.z - state.z) * Math.cos(m.yaw)) / dt : 0,
    turn = dt > 0 ? (m.yaw - state.yaw) / dt : 0;
  if (Math.abs(speed) > 8 || Math.abs(turn) > 4) speed = turn = 0;
  const half = row.gear === 'wheels' ? SKID.wheel.x : model.tracks.tr.x;
  // Each side moves at the chassis speed less the turn: turning on the spot rolls the two sides opposite ways.
  state.travel[0] += (speed - turn * half) * dt;
  state.travel[1] += (speed + turn * half) * dt;
  // The body pitches against acceleration on a damped spring: it dips when the machine stops and squats as it goes.
  const accel = dt > 0 ? (speed - state.speed) / dt : 0,
    target = clamp(-accel * 0.0028, -0.05, 0.05) * row.settle;
  for (let left = dt; left > 1e-6; left -= 1 / 120) {
    const h = Math.min(left, 1 / 120);
    state.pitchRate += (-150 * (state.pitch - target) - 7 * state.pitchRate) * h;
    state.pitch += state.pitchRate * h;
  }
  state.yaw = m.yaw;
  if (dt > 0 || state.x === undefined) Object.assign(state, { speed, x: m.x, z: m.z });
  sprung.rotation.x = state.pitch;
  sprung.position.y = -Math.abs(state.pitch) * 0.6;
  if (row.gear === 'wheels') poseWheels(kit, model);
  else poseTracks(kit, model);
  // The tip in the chassis frame: the boom's swing and reach, at the lift height above the chassis base.
  const tip = S.tip.set(Math.sin(m.swing) * m.reach, m.lift - (m.y - 0.7), Math.cos(m.swing) * m.reach);
  row.pose(kit, model, m, tip);
  if (model.hyd) {
    root.updateMatrixWorld(true);
    poseHydraulics(kit, model);
  }
  const which = look.decal === 'star' || look.decal === 'stripe' ? look.decal : null;
  for (const k of ['star', 'stripe']) for (const mesh of model.decals[k]) mesh.visible = which === k;
  const bell = look.horn === 'bell';
  model.horns.bell.visible = bell;
  model.horns.stock.visible = !bell;
  const horn = bell ? model.horns.bell : model.horns.stock;
  // The horn on the roof swells for a moment when it sounds (only on the machine being driven).
  const age = look.yard?.machine === m && look.honkAt ? (performance.now() - look.honkAt) / HONK_MS : 1;
  horn.scale.setScalar(age >= 0 && age < 1 ? 1 + 0.4 * Math.sin(age * Math.PI) : 1);
  paintMachine(kit, model, m.kind, look.paint);
}

/** Paints the whole machine in `paint` (a PAINTS key) or back to its stock color. Only the paint-layer meshes and the
 *  cylinder barrels change; the dark frames, glass, tires, tracks, decals and the number plate keep theirs. */
function paintMachine(kit, model, kind, paint) {
  const key = PAINTS[paint] ? paint : 'stock';
  if (model.paint === key) return;
  model.paint = key;
  const body = kit.paintMat(PAINTS[key] || MACHINES[kind].color);
  for (const part of model.paintable) part.material = body;
}

/** The wrecking ball's mesh, hidden until the crane hangs it. */
export function buildWreckingBall(kit, group) {
  const mesh = new T.Mesh(new T.IcosahedronGeometry(0.85, 1), kit.mat('#495f60', { metalness: 0.55, roughness: 0.4 }));
  mesh.userData.ownGeometry = true;
  mesh.castShadow = true;
  group.add(mesh);
  mesh.visible = false;
  return mesh;
}

/** Shows the wrecking ball where its physics body is. */
export function syncWreckingBall(mesh, yard) {
  mesh.visible = !!yard.ball;
  if (yard.ball) mesh.position.copy(yard.ball.translation());
}

// ---- The reward picture for the job-complete sheet ----

const INK = '#0b121a';
const GLASS = '#24465a';
const AMBER = '#f2b538';
const CHROME = '#c9d3da';

/** The machine's side profile in SVG (320 x 190 units, facing right) filled with `paint`, dark-edged, with its unit
 *  code on a plate on the body. Each kind has its own outline: the skid steer's cage, arms and low bucket; the
 *  excavator's tracks, slewing house, boom, stick and toothed bucket; the crane's long tracks, gantry, lattice boom
 *  and hook. `extra` is drawn on top (a decal on the body, say). */
function machineProfile(kind, paint, extra = '') {
  const edge = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
  const thin = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"`;
  const plate = (x, y, w = 58, h = 24) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#172531" stroke="${INK}" stroke-width="2"/>` +
    `<text x="${x + w / 2}" y="${y + h * 0.74}" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-weight="700" font-size="${h * 0.66}" fill="${AMBER}">${MACHINES[kind].name}</text>`;
  const arm = (d, w, color = paint) =>
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 8}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const ram = (x1, y1, x2, y2, f = 0.55) => {
    const mx = x1 + (x2 - x1) * f,
      my = y1 + (y2 - y1) * f;
    return arm(`M${x1} ${y1}L${x2} ${y2}`, 3, CHROME) + arm(`M${x1} ${y1}L${mx} ${my}`, 6);
  };
  const wheel = (x, y, r) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#151e25" ${edge}/>` +
    `<circle cx="${x}" cy="${y}" r="${r - 3}" fill="none" stroke="#2c363e" stroke-width="5" stroke-dasharray="5 5"/>` +
    `<circle cx="${x}" cy="${y}" r="${r * 0.5}" fill="#9aa2a8" ${thin}/><circle cx="${x}" cy="${y}" r="${r * 0.18}" fill="#26313b"/>`;
  const track = (x, w, top = 136) =>
    `<rect x="${x}" y="${top}" width="${w}" height="${172 - top}" rx="${(172 - top) / 2}" fill="#202b33" ${edge}/>` +
    `<rect x="${x + 2}" y="${top + 2}" width="${w - 4}" height="${168 - top}" rx="${(168 - top) / 2}" fill="none" stroke="#56606a" stroke-width="4" stroke-dasharray="6 4"/>` +
    `<circle cx="${x + 18}" cy="${(top + 172) / 2}" r="${(172 - top) / 2 - 5}" fill="#3a444c" stroke="#6e7a84" stroke-width="4" stroke-dasharray="4 3"/>` +
    `<circle cx="${x + w - 18}" cy="${(top + 172) / 2}" r="${(172 - top) / 2 - 6}" fill="#55626c" ${thin}/>` +
    Array.from(
      { length: 4 },
      (_, i) => `<circle cx="${x + 46 + (i * (w - 92)) / 3}" cy="${166}" r="5" fill="#6e7a84" ${thin}/>`,
    ).join('');
  let body;
  if (kind === 'skid') {
    body =
      `<rect x="92" y="120" width="116" height="30" fill="#26313b" ${edge}/>` +
      `<path d="M84 134V98L126 96V118H206L212 134Z" fill="${paint}" ${edge}/>` +
      `<path d="M84 98V70L102 66L120 96Z" fill="${paint}" ${edge}/>` +
      `<rect x="92" y="78" width="6" height="20" fill="#55626c" ${thin}/>` +
      `<path d="M130 118V56H190V118" fill="none" ${edge}/>` +
      `<path d="M130 74H190M130 92H190M150 56V118M170 56V118" stroke="${INK}" stroke-width="2.5"/>` +
      `<path d="M140 116L136 80H146L150 106H166" fill="none" stroke="#2b3237" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M176 108L182 92" stroke="${INK}" stroke-width="3"/><circle cx="182" cy="90" r="3" fill="${AMBER}"/>` +
      `<rect x="124" y="48" width="72" height="9" fill="${paint}" ${edge}/>` +
      `<rect x="134" y="40" width="10" height="8" fill="${AMBER}" ${thin}/>` +
      arm('M104 96L98 70', 5, '#55626c') +
      ram(112, 126, 154, 88) +
      arm('M98 70L230 90L262 136', 12) +
      ram(232, 96, 256, 120, 0.5) +
      `<path d="M254 112L258 162H306L304 146Z" fill="${paint}" ${edge}/>` +
      `<path d="M262 163H310" stroke="#34434d" stroke-width="6" stroke-linecap="round"/>` +
      plate(87, 100, 36, 16) +
      extra +
      wheel(122, 150, 23) +
      wheel(180, 150, 23);
  } else if (kind === 'excavator') {
    body =
      track(40, 196) +
      `<rect x="92" y="126" width="92" height="10" fill="#26313b" ${edge}/>` +
      `<path d="M42 128Q30 112 40 94H130V128Z" fill="${paint}" ${edge}/>` +
      `<path d="M58 94V80M88 94V80M118 94V80M54 80H122" fill="none" stroke="#e0aa30" stroke-width="4" stroke-linecap="round"/>` +
      `<rect x="98" y="72" width="6" height="22" fill="#55626c" ${thin}/>` +
      `<path d="M128 128V58Q128 50 136 50H166L178 128Z" fill="${paint}" ${edge}/>` +
      `<path d="M136 60H164L173 120H136Z" fill="${GLASS}" ${thin}/><path d="M152 60V120" stroke="${INK}" stroke-width="2.5"/>` +
      `<rect x="140" y="42" width="10" height="8" fill="${AMBER}" ${thin}/>` +
      ram(182, 122, 206, 70, 0.5) +
      arm('M176 108Q192 46 236 32', 15) +
      ram(206, 46, 238, 20, 0.5) +
      arm('M228 22L276 102', 11) +
      ram(240, 30, 272, 84, 0.55) +
      `<path d="M266 92L296 106L300 140L284 146L262 128Z" fill="${paint}" ${edge}/>` +
      `<path d="M300 140L310 134M292 144L302 140M284 146L292 144" stroke="#34434d" stroke-width="5" stroke-linecap="round"/>` +
      plate(44, 98, 46, 16) +
      extra;
  } else {
    const foot = [180, 100],
      headPt = [284, 14],
      dx = headPt[0] - foot[0],
      dy = headPt[1] - foot[1],
      len = Math.hypot(dx, dy),
      nx = (-dy / len) * 8,
      ny = (dx / len) * 8;
    let zig = '';
    for (let i = 0; i <= 12; i++) {
      const f = i / 12,
        s = i % 2 ? 1 : -1;
      zig += `${i ? 'L' : 'M'}${(foot[0] + dx * f + nx * s).toFixed(1)} ${(foot[1] + dy * f + ny * s).toFixed(1)}`;
    }
    const chord = (s) =>
      `M${foot[0] + nx * s} ${foot[1] + ny * s}L${headPt[0] + nx * s * 0.6} ${headPt[1] + ny * s * 0.6}`;
    body =
      track(28, 224, 138) +
      `<rect x="96" y="128" width="104" height="10" fill="#26313b" ${edge}/>` +
      `<rect x="54" y="84" width="128" height="46" fill="${paint}" ${edge}/>` +
      [0, 1, 2, 3]
        .map((i) => `<rect x="30" y="${76 + i * 14}" width="28" height="13" fill="${paint}" ${thin}/>`)
        .join('') +
      `<path d="M176 130V94H222L232 130Z" fill="${paint}" ${edge}/>` +
      `<path d="M184 100H218L226 124H184Z" fill="${GLASS}" ${thin}/>` +
      `<rect x="192" y="86" width="10" height="8" fill="${AMBER}" ${thin}/>` +
      `<circle cx="132" cy="76" r="10" fill="#6f7c84" ${edge}/><path d="M124 72L140 80" stroke="${AMBER}" stroke-width="3"/>` +
      arm('M78 84L94 40L112 84', 5) +
      `<path d="M94 40L${headPt[0] - 6} ${headPt[1] + 4}M98 42L${headPt[0] - 4} ${headPt[1] + 8}" stroke="#7d8b94" stroke-width="2"/>` +
      `<path d="M132 76L182 98" stroke="#7d8b94" stroke-width="2"/>` +
      arm(chord(1), 4) +
      arm(chord(-1), 4) +
      `<path d="${zig}" fill="none" stroke="${paint}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="${zig}" fill="none" stroke="${INK}" stroke-width="1" stroke-linejoin="round" opacity="0.6"/>` +
      `<circle cx="${headPt[0] + 2}" cy="${headPt[1] + 2}" r="7" fill="#26313b" ${thin}/>` +
      `<path d="M${headPt[0] + 7} ${headPt[1] + 4}V120M${headPt[0] + 3} ${headPt[1] + 6}V120" stroke="#7d8b94" stroke-width="2"/>` +
      `<rect x="${headPt[0] - 3}" y="118" width="16" height="20" fill="${C.hook}" ${thin}/>` +
      `<path d="M${headPt[0] + 5} 138V144M${headPt[0] + 5} 144L${headPt[0] - 8} 152M${headPt[0] + 5} 144L${headPt[0] + 18} 152" stroke="#55626c" stroke-width="2.5"/>` +
      `<rect x="${headPt[0] - 12}" y="150" width="34" height="10" fill="#263d4e" ${thin}/>` +
      plate(66, 92, 50, 18) +
      extra;
  }
  return `<path d="M20 174H300" stroke="#465460" stroke-width="3"/>` + body;
}

/** A star or stripe decal drawn large on the machine, where the 3D machine wears it: along the skid steer's lift arm
 *  (its decals sit on the arms' outer faces), along the house sides of the excavator and the crane. It clears the
 *  number plate and the running gear. */
function decalOnBody(kind, which) {
  if (which === 'stripe') {
    if (kind === 'skid')
      return `<path d="M108 73L218 89" stroke="#172531" stroke-width="9" stroke-linecap="round"/><path d="M108 73L218 89" stroke="#edf2f6" stroke-width="3" stroke-linecap="round"/>`;
    const [x, y, w] = kind === 'excavator' ? [40, 116, 136] : [58, 116, 122];
    return `<rect x="${x}" y="${y}" width="${w}" height="9" fill="#172531" stroke="${INK}" stroke-width="2"/><rect x="${x}" y="${y + 3}" width="${w}" height="3" fill="#edf2f6"/>`;
  }
  const [cx, cy, r] = kind === 'skid' ? [150, 80, 10] : kind === 'excavator' ? [112, 106, 9] : [152, 104, 10],
    pts = Array.from({ length: 10 }, (_, i) => {
      const rad = i % 2 ? r * 0.42 : r,
        a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      return `${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + 1 + Math.sin(a) * rad).toFixed(1)}`;
    }).join(' ');
  const box = r * 1.45;
  return `<rect x="${cx - box}" y="${cy - box}" width="${box * 2}" height="${box * 2}" fill="#172531" stroke="${AMBER}" stroke-width="3"/><polygon points="${pts}" fill="${AMBER}"/>`;
}
/** The large brass bell horn on its mount, as in the 3D roof fitting. */
function hornArt() {
  return (
    `<rect x="40" y="132" width="100" height="26" fill="#172531" stroke="${INK}" stroke-width="3"/>` +
    `<rect x="56" y="112" width="26" height="22" fill="#26333e" stroke="${INK}" stroke-width="3"/>` +
    `<path d="M70 114L208 60L274 52V152L208 118L72 130Z" fill="#d4a537" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M208 60L208 118" stroke="${INK}" stroke-width="3"/><path d="M92 120L204 82" stroke="#f3d78a" stroke-width="5" stroke-linecap="round"/>` +
    `<ellipse cx="274" cy="102" rx="16" ry="50" fill="#8a6418" stroke="${INK}" stroke-width="4"/>` +
    `<ellipse cx="274" cy="102" rx="8" ry="34" fill="#3b2a0b"/>` +
    `<path d="M300 64Q316 102 300 140M310 50Q336 102 310 154" fill="none" stroke="${AMBER}" stroke-width="4" stroke-linecap="round"/>`
  );
}

/** The yard badge with the wrecking ball on its chain. */
function badgeArt() {
  return (
    `<path d="M104 24L152 12L200 24V96Q200 134 152 156Q104 134 104 96Z" fill="#172531" stroke="${AMBER}" stroke-width="6" stroke-linejoin="round"/>` +
    `<path d="M120 36L152 28L184 36V94Q184 122 152 140Q120 122 120 94Z" fill="none" stroke="#465460" stroke-width="3"/>` +
    `<text x="152" y="76" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-weight="700" font-size="26" fill="${AMBER}">YARD</text>` +
    `<path d="M133 100L147 114L173 86" fill="none" stroke="#edf2f6" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M236 12V70" stroke="#8b9ba5" stroke-width="5" stroke-dasharray="9 5"/>` +
    `<circle cx="236" cy="104" r="36" fill="#495f60" stroke="${INK}" stroke-width="4"/><path d="M216 92Q226 78 244 80" fill="none" stroke="#8fa8a9" stroke-width="5" stroke-linecap="round"/>` +
    `<rect x="226" y="62" width="20" height="14" fill="#263d4e" stroke="${INK}" stroke-width="3"/>`
  );
}

/** The large picture for a reward on the job-complete sheet, as an SVG string. `unlock` is the reward id from the
 *  job table, `kind` the machine just used and `paint` its current paint. A paint is shown on the machine, a machine
 *  in its own colors, a decal on the body, the horn alone and the yard badge with the wrecking ball. */
export function rewardArt(unlock, kind = 'skid', paint = 'stock') {
  let inner;
  if (PAINTS[unlock]) inner = machineProfile(kind, PAINTS[unlock]);
  else if (MACHINES[unlock]) inner = machineProfile(unlock, MACHINES[unlock].color);
  else if (unlock === 'star' || unlock === 'stripe')
    inner = machineProfile(kind, PAINTS[paint] || MACHINES[kind].color, decalOnBody(kind, unlock));
  else if (unlock === 'bell') inner = `<g transform="translate(-34 6)">${hornArt()}</g>`;
  else inner = badgeArt();
  return `<svg viewBox="0 0 320 190" role="img" aria-hidden="true" focusable="false">${inner}</svg>`;
}

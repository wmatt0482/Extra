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
import { SKID_BUCKET, DUMP, FORK, LOADER, bedAngle, gateAngle, forkCarriage } from '../physics.mjs';
import { LAB_PAINT } from '../meta/labLooks.js';
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
  // WL-06 wheel loader (0.6): big tyres on two frames that bend at the hinge ('custom' gear, posed by the model).
  loader: {
    gear: 'custom',
    tool: 'bucket',
    cabSwings: false,
    scoops: true,
    lattice: false,
    settle: 0.6,
    build: buildLoader,
    pose: poseLoader,
  },
  // The Lab machines. 'custom' gear means the model builds and poses its own wheels (poseGear); the half track and
  // the steering come from the model (gearHalf, steerLimit).
  dump: {
    gear: 'custom',
    tool: 'bed',
    cabSwings: false,
    scoops: false,
    lattice: false,
    settle: 0.5,
    build: buildDump,
    pose: poseDump,
  },
  fork: {
    gear: 'custom',
    tool: 'forks',
    cabSwings: false,
    scoops: false,
    lattice: false,
    settle: 0.8,
    build: buildFork,
    pose: poseFork,
  },
};

/** Body colors when a paint reward is chosen (stock keeps the machine's own color). */
export const PAINTS = {
  cream: '#c6c3b4',
  leaf: '#486c53',
  sky: '#3c7d9c',
  sunset: '#d86c38',
  // the harbor and the hillside (0.6)
  graphite: '#4a5157',
  harbor: '#2c6f8c',
  sage: '#7e8f69',
  rust: '#9b4b2c',
};

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
  steelHi: '#7b8892',
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
  q1: new T.Quaternion(),
  e1: new T.Euler(),
  e2: new T.Euler(),
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
    decals: { star: [], stripe: [], labmark: [], flame: [], rivets: [], anchor: [], mountain: [], chevron: [] },
    state: { time: null, yaw: 0, speed: 0, pitch: 0, pitchRate: 0, travel: [0, 0], steer: 0 },
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
    // The Lab decals (bc.decal.*): the Lab mark, a flame, and a band of rivets.
    labmark: canvasTexture(128, 128, (c) => {
      c.fillStyle = '#172531';
      c.fillRect(4, 4, 120, 120);
      c.strokeStyle = '#f2b538';
      c.lineWidth = 6;
      c.strokeRect(7, 7, 114, 114);
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        c.lineTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46);
      }
      c.closePath();
      c.lineWidth = 5;
      c.stroke();
      c.fillStyle = '#f2b538';
      c.beginPath();
      c.moveTo(54, 34);
      c.lineTo(74, 34);
      c.lineTo(74, 56);
      c.lineTo(92, 92);
      c.lineTo(36, 92);
      c.lineTo(54, 56);
      c.closePath();
      c.fill();
    }),
    flame: canvasTexture(128, 128, (c) => {
      c.fillStyle = '#172531';
      c.fillRect(4, 4, 120, 120);
      c.strokeStyle = '#ee7d1a';
      c.lineWidth = 6;
      c.strokeRect(7, 7, 114, 114);
      c.fillStyle = '#ee7d1a';
      c.beginPath();
      c.moveTo(64, 18);
      c.bezierCurveTo(100, 46, 96, 100, 64, 106);
      c.bezierCurveTo(30, 100, 30, 62, 50, 44);
      c.bezierCurveTo(54, 62, 64, 56, 64, 18);
      c.fill();
      c.fillStyle = '#f6d65e';
      c.beginPath();
      c.ellipse(64, 84, 15, 21, 0, 0, Math.PI * 2);
      c.fill();
    }),
    rivetsRoof: canvasTexture(128, 128, (c) => {
      for (const x of [30, 98]) {
        c.fillStyle = '#172531';
        c.fillRect(x - 14, 0, 28, 128);
        c.fillStyle = '#c9d3da';
        for (let y = 8; y < 128; y += 16) {
          c.beginPath();
          c.arc(x, y, 4, 0, Math.PI * 2);
          c.fill();
        }
      }
    }),
    rivetsSide: canvasTexture(256, 32, (c) => {
      c.fillStyle = '#172531';
      c.fillRect(0, 2, 256, 28);
      c.fillStyle = '#c9d3da';
      for (let x = 8; x < 256; x += 16) {
        c.beginPath();
        c.arc(x, 16, 4, 0, Math.PI * 2);
        c.fill();
      }
    }),
    // The harbor and hillside decals (0.6): an anchor and a mountain badge take the star's place, hazard chevrons the
    // stripe's.
    anchor: badge((c) => {
      c.strokeStyle = '#f2b538';
      c.fillStyle = '#f2b538';
      c.lineWidth = 9;
      c.beginPath();
      c.arc(64, 34, 10, 0, Math.PI * 2);
      c.stroke();
      c.fillRect(59, 44, 10, 52);
      c.fillRect(42, 52, 44, 9);
      c.beginPath();
      c.arc(64, 72, 30, 0.15 * Math.PI, 0.85 * Math.PI);
      c.stroke();
      for (const [x, d] of [
        [37, -1],
        [91, 1],
      ]) {
        c.beginPath();
        c.moveTo(x - 9 * d, 80);
        c.lineTo(x + 5 * d, 74);
        c.lineTo(x + 2 * d, 92);
        c.fill();
      }
    }),
    mountain: badge((c) => {
      c.fillStyle = '#f2b538';
      c.beginPath();
      c.moveTo(16, 100);
      c.lineTo(52, 36);
      c.lineTo(70, 66);
      c.lineTo(82, 50);
      c.lineTo(112, 100);
      c.closePath();
      c.fill();
      c.fillStyle = '#edf2f6';
      c.beginPath();
      c.moveTo(52, 36);
      c.lineTo(62, 54);
      c.lineTo(54, 50);
      c.lineTo(46, 56);
      c.closePath();
      c.fill();
    }),
    chevronRoof: canvasTexture(128, 128, (c) => {
      for (const x of [30, 98]) {
        c.save();
        c.beginPath();
        c.rect(x - 14, 0, 28, 128);
        c.clip();
        c.fillStyle = '#1d252b';
        c.fillRect(x - 14, 0, 28, 128);
        c.fillStyle = '#f2b538';
        for (let y = -28; y < 140; y += 28) {
          c.beginPath();
          c.moveTo(x - 14, y);
          c.lineTo(x, y + 12);
          c.lineTo(x + 14, y);
          c.lineTo(x + 14, y + 12);
          c.lineTo(x, y + 24);
          c.lineTo(x - 14, y + 12);
          c.closePath();
          c.fill();
        }
        c.restore();
      }
    }),
    chevronSide: canvasTexture(256, 32, (c) => {
      c.fillStyle = '#1d252b';
      c.fillRect(0, 2, 256, 28);
      c.fillStyle = '#f2b538';
      for (let x = -16; x < 272; x += 24) {
        c.beginPath();
        c.moveTo(x, 2);
        c.lineTo(x + 12, 2);
        c.lineTo(x + 24, 16);
        c.lineTo(x + 12, 30);
        c.lineTo(x, 30);
        c.lineTo(x + 12, 16);
        c.closePath();
        c.fill();
      }
    }),
  });
}

/** A square slate badge with the amber frame the star wears, its emblem drawn by `draw`. */
function badge(draw) {
  return canvasTexture(128, 128, (c) => {
    c.fillStyle = '#172531';
    c.fillRect(4, 4, 120, 120);
    c.strokeStyle = '#f2b538';
    c.lineWidth = 6;
    c.strokeRect(7, 7, 114, 114);
    draw(c);
  });
}

/** The Lab decals that stand in for each of the original two when a look is drawn, and the texture each one uses: the
 *  Lab mark and the flame take the star's place; the rivets take the stripe's (the roof pair or a side band). */
const LAB_DECALS = {
  star: [
    ['labmark', () => 'labmark'],
    ['flame', () => 'flame'],
    // the job decals of the harbor and the hillside (0.6) wear the star's and the stripe's places the same way
    ['anchor', () => 'anchor'],
    ['mountain', () => 'mountain'],
  ],
  stripe: [
    ['rivets', (art) => (art === 'roofStripes' ? 'rivetsRoof' : 'rivetsSide')],
    ['chevron', (art) => (art === 'roofStripes' ? 'chevronRoof' : 'chevronSide')],
  ],
};

/** Adds one decal plane: `which` is 'star' or 'stripe', `art` the texture key, (w, h) its size, placed at (x, y, z)
 *  with Euler rotation (rx, ry, rz) under `parent`. It is lit like the paint under it and pulled just clear of it. */
function decal(model, parent, which, art, w, h, [x, y, z], [rx, ry, rz]) {
  for (const [key, texture] of [[which, art], ...LAB_DECALS[which].map(([k, tex]) => [k, tex(art)])]) {
    const mesh = new T.Mesh(
      new T.PlaneGeometry(w, h),
      new T.MeshStandardMaterial({
        map: decalTextures()[texture],
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
    model.decals[key].push(mesh);
  }
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
  // The ferry horn (job 15): a pair of chrome trumpets side by side, a long and a short one.
  const ferry = make('#c9d3da', { roughness: 0.25, metalness: 0.8 }, 0.62, 0.16, 0.05);
  const twin = make('#c9d3da', { roughness: 0.25, metalness: 0.8 }, 0.44, 0.13, 0.045);
  parent.remove(twin);
  twin.position.set(-0.25, 0, -0.05);
  ferry.add(twin);
  ferry.visible = false;
  // The steam horn (job 20): an upright brass whistle with a bell mouth and a pull lever.
  const steam = new T.Group();
  const brass = kit.mat('#c8a040', { roughness: 0.3, metalness: 0.75 });
  for (const [geo, y] of [
    [new T.CylinderGeometry(0.07, 0.07, 0.36, 10), 0.08],
    [new T.CylinderGeometry(0.11, 0.08, 0.1, 10), 0.3],
    [new T.CylinderGeometry(0.05, 0.09, 0.12, 8), -0.16],
  ]) {
    const m = new T.Mesh(geo, brass);
    m.position.y = y;
    m.userData.ownGeometry = true;
    steam.add(m);
  }
  steam.position.set(x, y + 0.08, z);
  parent.add(steam);
  steam.visible = false;
  model.horns = { stock, bell, ferry, steam };
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

// ---- Wheels for the Lab machines ----

/** A set of wheels that share one geometry, as one instanced mesh under the machine root. `list` gives each wheel's
 *  { x, z, side, steer }: `side` is 0 (right) or 1 (left) for the travel it spins by, `steer` how much the steering
 *  angle turns it (negative for rear steering). Wheels on the left (x < 0) are turned round so the rim faces out. */
function wheelSet(kit, model, spec, list) {
  const mesh = new T.InstancedMesh(wheelGeometry(kit, spec), kit.detailMat(), list.length);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.ownGeometry = true;
  model.root.add(mesh);
  (model.wheelSets ||= []).push({ mesh, list: list.map((w) => ({ steer: 0, ...w, side: w.x > 0 ? 0 : 1 })), r: spec.r });
}

/** Spins each wheel by its side's travel and turns the steered ones by the steering angle. */
function poseWheelSets(kit, model) {
  const t = kit.tmp,
    steer = model.state.steer;
  for (const { mesh, list, r } of model.wheelSets) {
    list.forEach((w, i) => {
      t.position.set(w.x, r, w.z);
      S.q.setFromEuler(S.e1.set(0, steer * w.steer, 0));
      S.q1.setFromEuler(S.e1.set(model.state.travel[w.side] / r, 0, 0));
      S.q.multiply(S.q1);
      if (w.x < 0) S.q.multiply(S.q1.setFromEuler(S.e1.set(0, Math.PI, 0)));
      t.quaternion.copy(S.q);
      t.scale.setScalar(1);
      t.updateMatrix();
      mesh.setMatrixAt(i, t.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---- WL-06 wheel loader ----

/** The wheel loader: an articulated loader. The rear frame (on the sprung body) carries the engine hood with its side
 *  louvres and rear grille, the counterweight with the unit plate, the cab with glass all round on its ROPS posts, the
 *  fenders, steps, hand rails, stack and beacon. The front frame turns about the hinge by half the articulation (the
 *  physics turns the bucket the same way) and carries the two lift arms, which pivot on its towers and pin to the
 *  bucket's side plates, the cross tube, the tilt and lift cylinders and the big bucket built from the physics outline
 *  (LOADER.bucket). Four big lugged tyres: the rear pair on the rear frame, the front pair turning with the front frame.
 *  Two steering cylinders cross the hinge. */
function buildLoader(kit, model, d) {
  const { root, sprung } = model,
    c = d.color,
    L = LOADER,
    B = L.bucket,
    p = new Parts(kit),
    armX = B.sideX[1] + 0.08;
  // ---- rear frame: rails, axle, hood, counterweight, fenders, tanks, steps
  p.box(0, 0.95, -1.45, 1.24, 0.5, 2.9, C.frame);
  p.cyl(0, 0.78, L.rearAxle, 0.12, 2.0, C.steel, { axis: 'x' });
  p.cyl(0, 0.78, L.rearAxle, 0.3, 0.7, C.frame, { axis: 'x', seg: 10 });
  p.prism(
    [
      [-3.0, 1.2],
      [-1.15, 1.2],
      [-1.15, 2.15],
      [-1.35, 2.3],
      [-2.75, 2.3],
      [-3.05, 2.05],
    ],
    -0.8,
    0.8,
    c,
    { layer: 'body' },
  );
  for (const x of [-0.81, 0.81]) for (let z = -2.7; z < -1.5; z += 0.11) p.box(x, 1.75, z, 0.02, 0.6, 0.05, C.grille);
  for (let x = -0.55; x <= 0.56; x += 0.11) p.box(x, 2.31, -2.1, 0.05, 0.02, 1.0, C.grille);
  // counterweight with its rear grille, lights and the plate (facing back)
  p.prism(
    [
      [-3.35, 0.7],
      [-2.95, 0.7],
      [-2.95, 2.05],
      [-3.25, 1.95],
      [-3.4, 1.4],
    ],
    -1.05,
    1.05,
    c,
    { layer: 'body' },
  );
  for (let y = 1.5; y < 1.95; y += 0.08) p.box(0, y, -3.26, 1.2, 0.035, 0.03, C.grille);
  for (const x of [-0.82, 0.82]) {
    p.box(x, 1.72, -3.3, 0.2, 0.12, 0.05, C.tail);
    p.box(x, 1.56, -3.3, 0.2, 0.08, 0.05, C.amber);
  }
  for (const x of [-1, 1]) {
    p.box(x * 1.06, 1.68, L.rearAxle, 0.6, 0.08, 1.7, c, { layer: 'body' });
    p.box(x * 1.06, 1.55, L.rearAxle - 0.9, 0.6, 0.3, 0.08, c, { layer: 'body', rx: 0.5 });
    // the fuel tank (left) and the hydraulic tank (right) between the hood and the cab
    p.box(x * 0.72, 1.35, -0.75, 0.4, 0.55, 0.7, x < 0 ? C.frameLight : c, x < 0 ? {} : { layer: 'body' });
  }
  // the left-hand steps and the hand rails up to the cab door
  for (const [y, z] of [
    [0.55, -0.55],
    [0.95, -0.6],
    [1.35, -0.65],
  ])
    p.box(-0.95, y, z, 0.42, 0.05, 0.36, C.steel);
  p.bar([-1.16, 0.6, -0.4], [-1.16, 2.4, -0.55], 0.04, C.rail);
  p.bar([-1.16, 0.6, -0.9], [-1.16, 2.4, -1.05], 0.04, C.rail);
  // exhaust stack, air cleaner, beacon
  p.cyl(0.42, 2.7, -2.4, 0.07, 0.9, C.steel, { seg: 8 });
  p.cyl(0.42, 3.17, -2.4, 0.09, 0.05, C.bar);
  p.cyl(-0.42, 2.5, -2.2, 0.15, 0.4, C.frameLight, { seg: 10 });
  // ---- the cab on the rear frame, just behind the hinge: floor, ROPS posts, glass, roof, lights
  const cz0 = -1.15,
    cz1 = 0.35;
  p.box(0, 1.55, (cz0 + cz1) / 2, 1.5, 0.12, cz1 - cz0 + 0.1, C.frame);
  for (const x of [-0.7, 0.7]) for (const z of [cz0, cz1]) p.box(x, 2.45, z, 0.09, 1.7, 0.09, C.bar);
  p.box(0, 2.45, cz1 + 0.01, 1.32, 1.4, 0.03, '#000', { layer: 'glass', rx: -0.05 });
  p.box(0, 2.45, cz0 - 0.01, 1.32, 1.4, 0.03, '#000', { layer: 'glass' });
  for (const x of [-0.71, 0.71]) {
    p.box(x, 2.45, (cz0 + cz1) / 2, 0.03, 1.4, cz1 - cz0 - 0.1, '#000', { layer: 'glass' });
    p.box(x, 1.95, (cz0 + cz1) / 2, 0.035, 0.05, cz1 - cz0, C.bar);
  }
  p.box(0, 3.35, (cz0 + cz1) / 2, 1.62, 0.12, cz1 - cz0 + 0.3, c, { layer: 'body' });
  p.box(0, 3.27, (cz0 + cz1) / 2, 1.5, 0.05, cz1 - cz0 + 0.2, C.bar);
  for (const x of [-0.55, 0.55]) {
    p.box(x, 3.47, cz1 + 0.12, 0.2, 0.12, 0.1, C.bar);
    p.box(x, 3.47, cz1 + 0.175, 0.15, 0.08, 0.02, C.lens);
    p.box(x, 3.47, cz0 - 0.12, 0.2, 0.12, 0.1, C.bar);
    p.box(x, 3.47, cz0 - 0.175, 0.15, 0.08, 0.02, C.lens);
    // mirrors on arms out from the cab's front posts
    p.bar([x * 1.27, 2.9, cz1], [x * 1.8, 2.9, cz1 + 0.1], 0.04, C.bar);
    p.box(x * 1.85, 2.8, cz1 + 0.1, 0.08, 0.36, 0.22, C.steel);
  }
  p.cyl(0.5, 3.48, -0.6, 0.08, 0.1, C.bar);
  p.cyl(0.5, 3.6, -0.6, 0.07, 0.16, C.amber);
  // inside: seat, steering column and wheel, joystick pod
  p.box(0, 1.85, -0.6, 0.55, 0.14, 0.5, C.seat);
  p.box(0, 2.2, -0.85, 0.55, 0.65, 0.1, C.seat);
  p.bar([0, 1.7, 0.1], [0, 2.15, -0.05], 0.06, C.bar);
  p.cyl(0, 2.2, -0.08, 0.18, 0.04, C.bar, { axis: 'y', seg: 12, rx: -0.6 });
  p.box(0.4, 1.95, -0.45, 0.16, 0.3, 0.3, C.bar);
  // the hinge's rear knuckles
  for (const y of [0.8, 1.5]) p.box(0, y, -0.12, 0.5, 0.16, 0.3, C.frameLight);
  finish(kit, model, p, sprung, c);
  plate(sprung, d, 0, 1.25, -3.42, 0.9);
  roofDecals(model, sprung, 0, 3.415, (cz0 + cz1) / 2, 1.4, 1.5);
  // the hood sides carry a decal too
  for (const k of [-1, 1]) {
    decal(model, sprung, 'star', 'star', 0.55, 0.55, [k * 0.815, 1.8, -2.1], [0, (k * Math.PI) / 2, 0]);
    decal(model, sprung, 'stripe', 'sideStripe', 1.7, 0.14, [k * 0.815, 1.32, -2.05], [0, (k * Math.PI) / 2, 0]);
  }
  horns(kit, model, sprung, -0.4, 3.49, -0.2);

  // ---- the front frame: turns about the hinge by half the articulation
  const front = group(root),
    fp = new Parts(kit);
  fp.box(0, 1.0, 1.05, 1.15, 0.55, 2.1, C.frame);
  fp.cyl(0, 0.78, L.frontAxle, 0.12, 2.0, C.steel, { axis: 'x' });
  fp.cyl(0, 0.78, L.frontAxle, 0.32, 0.7, C.frame, { axis: 'x', seg: 10 });
  for (const y of [0.85, 1.45]) fp.box(0, y, 0.12, 0.42, 0.14, 0.3, C.steel);
  fp.cyl(0, 1.15, 0, 0.06, 0.9, C.pin);
  for (const k of [-1, 1]) {
    // the tower plates on the front frame, the pivot shaft out to the arm and its brace
    fp.prism(
      [
        [0.15, 1.15],
        [1.3, 1.15],
        [L.arm.z + 0.3, L.arm.y + 0.1],
        [L.arm.z - 0.35, L.arm.y + 0.2],
      ],
      k * 0.58 - 0.07,
      k * 0.58 + 0.07,
      c,
      { layer: 'body' },
    );
    fp.cyl(k * (armX + 0.5) / 2, L.arm.y, L.arm.z, 0.1, armX - 0.5, C.steel, { axis: 'x' });
    fp.bar([k * 0.6, 1.25, 1.35], [k * (armX - 0.12), L.arm.y - 0.08, L.arm.z + 0.1], 0.13, c, { layer: 'body' });
    fp.cyl(k * (armX - 0.02), L.arm.y, L.arm.z, 0.11, 0.16, C.pin, { axis: 'x' });
    // fenders over the front tyres, and the work lights on the towers
    fp.box(k * 1.05, 1.72, L.frontAxle + 0.05, 0.6, 0.08, 1.4, c, { layer: 'body' });
    fp.box(k * 1.05, 1.55, L.frontAxle + 0.78, 0.6, 0.3, 0.08, c, { layer: 'body', rx: -0.5 });
    fp.box(k * 0.62, 1.95, 0.95, 0.22, 0.16, 0.12, C.bar);
    fp.box(k * 0.62, 1.95, 1.015, 0.17, 0.11, 0.02, C.lens);
  }
  // the lift cylinders' and the tilt cylinder's base lugs
  for (const k of [-1, 1]) fp.box(k * 0.75, 0.9, 1.75, 0.14, 0.24, 0.24, C.steel);
  fp.box(0, 1.6, 1.2, 0.3, 0.3, 0.3, C.steel);
  finish(kit, model, fp, front, c);
  const arms = group(front, 0, L.arm.y, L.arm.z),
    ap = new Parts(kit);
  for (const k of [-1, 1]) {
    ap.prism(
      [
        [-0.22, 0.17],
        [-0.22, -0.15],
        [L.length * 0.55, -0.23],
        [L.length + 0.1, -0.12],
        [L.length + 0.1, 0.12],
        [L.length * 0.45, 0.21],
      ],
      k * armX - 0.07,
      k * armX + 0.07,
      c,
      { layer: 'body' },
    );
    ap.cyl(k * armX, 0, L.length, 0.1, 0.24, C.pin, { axis: 'x' });
    ap.bar([k * (armX - 0.08), 0.2, 0.1], [k * (armX - 0.08), 0.26, L.length * 0.8], 0.04, C.hose);
    ap.box(k * armX, -0.28, L.length * 0.42, 0.18, 0.12, 0.24, C.steel);
  }
  ap.cyl(0, 0.08, L.length * 0.62, 0.1, armX * 2, c, { axis: 'x', layer: 'body' });
  ap.box(0, 0.2, L.length * 0.62, 0.32, 0.22, 0.3, C.steel);
  finish(kit, model, ap, arms, c);
  for (const k of [-1, 1]) decal(model, arms, 'stripe', 'sideStripe', 1.9, 0.13, [k * (armX + 0.072), 0.02, L.length * 0.5], [0, (k * Math.PI) / 2, 0]);

  // ---- the bucket, from the physics outline: floor, back, sloped side plates, spill guard, cutting edge, wear strips
  const bucket = group(front),
    bp = new Parts(kit);
  bucket.rotation.order = 'YXZ';
  bp.box(0, B.floor.y, (B.floor.z[0] + B.floor.z[1]) / 2, B.width, B.floor.thick, B.floor.z[1] - B.floor.z[0], c, { layer: 'body' });
  bp.box(0, (B.back.y[0] + B.back.y[1]) / 2, B.back.z, B.width, B.back.y[1] - B.back.y[0], B.back.thick, c, { layer: 'body' });
  for (const k of [-1, 1])
    bp.prism(B.side, k > 0 ? B.sideX[0] : -B.sideX[1], k > 0 ? B.sideX[1] : -B.sideX[0], c, { layer: 'body' });
  bp.box(0, B.back.y[1] + 0.03, B.back.z + 0.1, B.width, 0.06, 0.26, c, { layer: 'body', rx: -0.4 });
  bp.box(0, B.floor.y - 0.03, B.floor.z[1] + 0.08, B.width + 0.05, 0.09, 0.22, C.edge);
  for (let x = -1.2; x <= 1.21; x += 0.6) bp.box(x, B.floor.y - 0.08, -0.1, 0.12, 0.05, 1.4, C.edge);
  for (const k of [-1, 1]) bp.box(k * (B.sideX[1] - 0.02), -0.52, B.floor.z[1] - 0.02, 0.16, 0.24, 0.05, C.edge);
  // the back plate's ribs and the tilt link's ears
  for (const x of [-0.75, 0.75]) bp.box(x, -0.15, B.back.z - 0.1, 0.12, 0.85, 0.08, C.frame);
  bp.box(0, 0.25, B.back.z - 0.12, 0.3, 0.22, 0.18, C.steel);
  finish(kit, model, bp, bucket, c);

  // the four tyres: the rear pair on the rear frame, the front pair re-posed with the front frame each frame
  const r = 0.78,
    list = [];
  for (const x of [-1.02, 1.02]) {
    list.push({ x, z: L.rearAxle });
    list.push({ x, z: L.frontAxle, front: true });
  }
  wheelSet(kit, model, { r, width: 0.56 }, list);
  model.gearHalf = 1.02;
  model.steerLimit = 0;

  // cylinders: two lift, one tilt, two steering across the hinge
  hydraulics(kit, model, c, 5);
  for (const k of [-1, 1]) {
    actuator(model, front, [k * 0.75, 0.9, 1.75], arms, [k * (armX - 0.1), -0.3, L.length * 0.42], 1.1, 0.1);
    actuator(model, sprung, [k * 0.55, 1.0, -0.75], front, [k * 0.55, 1.0, 0.75], 0.7, 0.07);
  }
  actuator(model, front, [0, 1.6, 1.2], bucket, [0, 0.25, B.back.z - 0.15], 1.0, 0.11);
  Object.assign(model, { front, arms, bucket });
}

/** Wheel loader: the front frame turns by half the articulation; the arms pivot so their end meets the bucket on its
 *  arc; the bucket sits on the grab point with its tilt; the front tyres follow the front frame. */
function poseLoader(kit, model, m) {
  const { front, arms, bucket } = model,
    L = LOADER,
    half = (m.artic || 0) / 2,
    phi = Math.asin(clamp((m.lift - L.arm.y) / L.length, -0.999, 0.999)),
    reach = L.arm.z + L.length * Math.cos(phi);
  front.rotation.y = half;
  arms.rotation.x = -phi;
  bucket.position.set(0, m.lift, reach);
  bucket.rotation.set(m.tilt, 0, 0);
  // the front tyres: on the front frame's axle, turned with it
  const t = kit.tmp;
  for (const set of model.wheelSets) {
    set.list.forEach((w, i) => {
      if (!w.front) return;
      t.position.set(Math.cos(half) * w.x + Math.sin(half) * w.z, set.r, -Math.sin(half) * w.x + Math.cos(half) * w.z);
      S.q.setFromEuler(S.e1.set(0, half, 0));
      S.q1.setFromEuler(S.e1.set(model.state.travel[w.side] / set.r, 0, 0));
      S.q.multiply(S.q1);
      if (w.x < 0) S.q.multiply(S.q1.setFromEuler(S.e1.set(0, Math.PI, 0)));
      t.quaternion.copy(S.q);
      t.scale.setScalar(1);
      t.updateMatrix();
      set.mesh.setMatrixAt(i, t.matrix);
    });
    set.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---- DT-04 dump truck ----

/** The truck: a ladder frame on a front axle and a twin rear axle, a short-nosed cab with a raked windscreen, and a
 *  steel-floored bed that hinges at the back, lifts on a hydraulic ram and opens its tailgate as it tips. Every size
 *  that matters to the physics (the hinge, the bed's length, width and wall height, the tailgate) is read from DUMP. */
function buildDump(kit, model, d) {
  const { sprung } = model,
    c = d.color,
    B = DUMP.bed,
    p = new Parts(kit);
  const half = B.inner / 2 + B.wall;
  // ---- frame, axles, springs, tank, rear underride bar, mud flaps
  for (const x of [-0.7, 0.7]) p.box(x, 1.1, 0.05, 0.22, 0.34, 5.35, C.frame);
  for (const z of [-2.45, -1.5, -0.55, 0.4, 1.3, 2.3, 2.7]) p.box(0, 1.08, z, 1.4, 0.2, 0.16, C.frameLight);
  for (const z of [-1.95, -0.85]) {
    p.cyl(0, 0.6, z, 0.09, 2.3, C.steel, { axis: 'x' });
    p.cyl(0, 0.6, z, 0.24, 0.5, C.frame, { axis: 'x', seg: 10 });
    for (const x of [-0.85, 0.85]) {
      p.box(x, 0.8, z, 0.12, 0.07, 1.15, C.steel);
      p.box(x, 0.9, z, 0.18, 0.1, 0.2, C.frameLight);
    }
  }
  p.bar([0, 0.62, -1.95], [0, 1.0, -1.5], 0.07, C.steel);
  p.cyl(0, 0.6, 1.75, 0.08, 2.3, C.steel, { axis: 'x' });
  for (const x of [-0.85, 0.85]) p.box(x, 0.8, 1.75, 0.12, 0.07, 1.0, C.steel);
  p.cyl(-0.98, 0.95, 0.35, 0.3, 1.2, C.steel, { axis: 'z', seg: 12 });
  for (const z of [-0.1, 0.8]) p.box(-0.98, 0.93, z, 0.64, 0.05, 0.05, C.frame);
  p.cyl(0.98, 0.9, 0.35, 0.14, 0.8, C.frameLight, { axis: 'z', seg: 8 });
  p.box(0, 0.85, -2.64, 2.2, 0.2, 0.14, C.steel);
  for (const x of [-1.15, 1.15]) p.box(x, 0.46, -2.58, 0.55, 0.5, 0.04, C.rubber);
  for (const x of [-0.85, 0.85]) {
    p.box(x, 1.2, -2.68, 0.3, 0.16, 0.05, C.tail);
    p.box(x, 1.02, -2.68, 0.3, 0.1, 0.05, C.amber);
    p.box(x * 0.45, 1.2, -2.68, 0.14, 0.14, 0.05, C.lens);
  }
  // ---- fenders over the twin axle and the front wheels, and the cab's two steps
  for (const x of [-1.15, 1.15]) {
    p.box(x, 1.3, -1.4, 0.68, 0.1, 2.35, c, { layer: 'body' });
    p.box(x, 1.39, 1.78, 0.7, 0.1, 1.45, c, { layer: 'body' });
    p.box(x, 1.2, 2.5, 0.7, 0.08, 0.3, c, { layer: 'body', rx: -0.5 });
    p.box(x * 0.96, 0.75, 1.0, 0.5, 0.06, 0.3, C.steel);
    p.box(x * 0.96, 1.0, 1.06, 0.5, 0.06, 0.28, C.steel);
  }
  // ---- sub-frame under the bed, hinge brackets and the hinge pin
  for (const x of [-0.82, 0.82]) p.box(x, 1.4, -0.5, 0.2, 0.12, 3.8, C.frame);
  p.cyl(0, DUMP.hinge.y - 0.05, DUMP.hinge.z, 0.09, 2.3, C.pin, { axis: 'x' });
  for (const x of [-1.0, 1.0]) p.box(x, 1.5, DUMP.hinge.z + 0.08, 0.22, 0.26, 0.4, C.frameLight);
  // ---- cab: painted shell with a raked windscreen, hood, grille, bumper, lights
  const cab = [
    [1.32, 1.3],
    [2.3, 1.3],
    [2.3, 2.05],
    [2.0, 2.95],
    [1.32, 2.95],
  ];
  p.prism(cab, -1.1, 1.1, c, { layer: 'body' });
  p.prism(
    [
      [1.34, 1.3],
      [2.28, 1.3],
      [2.28, 2.03],
      [1.99, 2.93],
      [1.34, 2.93],
    ],
    -1.08,
    1.08,
    C.frame,
  );
  p.box(0, 1.68, 2.55, 1.9, 0.76, 0.52, c, { layer: 'body' });
  p.box(0, 2.07, 2.55, 1.7, 0.05, 0.46, c, { layer: 'body' });
  for (let y = 1.42; y < 1.95; y += 0.1) p.box(0, y, 2.82, 1.3, 0.05, 0.04, C.grille);
  p.box(0, 1.2, 2.88, 2.1, 0.22, 0.16, C.steel);
  p.box(0, 1.2, 2.96, 1.9, 0.05, 0.02, C.frame);
  for (const x of [-0.78, 0.78]) {
    p.box(x, 1.76, 2.82, 0.28, 0.2, 0.05, C.bar);
    p.box(x, 1.76, 2.855, 0.22, 0.14, 0.02, C.lens);
    p.box(x, 1.5, 2.82, 0.2, 0.08, 0.04, C.amber);
  }
  // windscreen, side and rear glass, door shut-lines, handles, mirrors
  p.box(0, 2.52, 2.145, 1.86, 0.78, 0.03, '#000', { layer: 'glass', rx: -0.41 });
  p.box(0, 2.58, 1.3, 1.5, 0.5, 0.03, '#000', { layer: 'glass' });
  for (const k of [-1, 1]) {
    p.box(k * 1.105, 2.55, 1.88, 0.03, 0.55, 0.78, '#000', { layer: 'glass' });
    p.box(k * 1.105, 2.0, 1.88, 0.03, 0.04, 0.92, C.frame);
    p.box(k * 1.108, 1.95, 1.55, 0.04, 0.08, 0.2, C.pin);
    p.bar([k * 1.1, 2.55, 2.25], [k * 1.4, 2.5, 2.4], 0.04, C.bar);
    p.box(k * 1.43, 2.45, 2.42, 0.07, 0.4, 0.24, C.bar);
    p.box(k * 1.43, 2.45, 2.42, 0.075, 0.34, 0.2, C.steel);
  }
  // inside the cab: seat, steering wheel and column, dash
  p.box(0.35, 1.7, 1.78, 0.5, 0.14, 0.5, C.seat);
  p.box(0.35, 2.05, 1.52, 0.5, 0.7, 0.1, C.seat);
  p.bar([0.35, 1.8, 2.1], [0.35, 2.05, 2.0], 0.05, C.bar);
  p.cyl(0.35, 2.12, 1.97, 0.2, 0.04, C.bar, { axis: 'y', seg: 12 });
  p.box(0, 2.0, 2.18, 1.9, 0.18, 0.3, C.frameLight);
  // roof: visor, light bar, beacon, exhaust stack with a cap, air intake
  p.box(0, 3.0, 2.0, 2.3, 0.06, 0.55, c, { layer: 'body' });
  for (const x of [-0.7, -0.23, 0.23, 0.7]) {
    p.box(x, 3.07, 2.15, 0.28, 0.12, 0.1, C.bar);
    p.box(x, 3.07, 2.205, 0.22, 0.08, 0.02, C.lens);
  }
  p.cyl(0.8, 3.1, 1.55, 0.09, 0.09, C.bar);
  p.cyl(0.8, 3.19, 1.55, 0.07, 0.14, C.amber);
  p.cyl(1.2, 2.35, 1.5, 0.075, 2.1, C.pin, { seg: 8 });
  p.cyl(1.2, 3.42, 1.5, 0.1, 0.05, C.bar, { seg: 8 });
  p.bar([1.2, 1.5, 1.5], [1.1, 1.5, 1.55], 0.1, C.frameLight);
  for (const y of [1.6, 2.2]) p.box(1.14, y, 1.5, 0.08, 0.06, 0.16, C.steel);
  p.box(-1.0, 2.9, 1.6, 0.1, 0.3, 0.1, C.frameLight);
  // sloped plate under the cab and a hand rail along each step
  for (const k of [-1, 1]) p.box(k * 1.12, 2.28, 1.32, 0.04, 0.5, 0.03, C.rail);
  finish(kit, model, p, sprung, c);
  plate(sprung, d, 0, 1.06, -2.72, 0.9);
  roofDecals(model, sprung, 0, 3.034, 1.7, 1.5, 0.7);
  horns(kit, model, sprung, -0.55, 3.04, 1.45);
  // ---- the wheels: a steered front pair and two rear axles (r 0.6 m, 0.5 m wide), 1.15 m either side
  const list = [];
  for (const x of [-1.15, 1.15]) {
    list.push({ x, z: 1.75, steer: 1 });
    for (const z of [-1.95, -0.85]) list.push({ x, z });
  }
  wheelSet(kit, model, { r: 0.6, width: 0.5 }, list);
  model.gearHalf = 1.15;
  model.steerLimit = 0.5;

  // ---- the bed: floor, side walls with ribs, headboard with a cab shield (a group that tips about the hinge)
  const bed = group(sprung, 0, DUMP.hinge.y, DUMP.hinge.z),
    bp = new Parts(kit),
    L = B.length;
  bp.box(0, -B.floor / 2, L / 2, half * 2, B.floor, L, C.edge);
  bp.box(0, -B.floor - 0.01, L / 2, half * 2 - 0.1, 0.02, L - 0.1, C.frame);
  for (let z = 0.35; z < L; z += 0.7) bp.box(0, -0.24, z, 2.3, 0.14, 0.12, C.frame);
  for (const x of [-0.75, 0.75]) bp.box(x, -0.25, L / 2, 0.14, 0.16, L - 0.1, C.frameLight);
  for (const k of [-1, 1]) {
    const x = k * (B.inner / 2 + B.wall / 2);
    bp.box(x, B.wallH / 2, L / 2, B.wall, B.wallH, L, c, { layer: 'body' });
    bp.box(x, B.wallH + 0.04, L / 2, B.wall + 0.1, 0.1, L + 0.1, C.steel);
    bp.box(x, 0.02, L / 2, B.wall + 0.1, 0.1, L + 0.1, C.steel);
    for (let z = 0.35; z < L; z += 0.95) bp.box(k * (half + 0.045), B.wallH / 2, z, 0.09, B.wallH - 0.12, 0.14, c, { layer: 'body' });
    // wear plates on the inside of the wall
    bp.box(k * (B.inner / 2 - 0.01), 0.5, L / 2, 0.02, 0.7, L - 0.2, C.frameLight);
  }
  bp.box(0, (B.headH - B.floor) / 2, L + 0.08, half * 2, B.headH + B.floor, 0.16, c, { layer: 'body' });
  bp.box(0, B.headH + 0.04, L + 0.08, half * 2 + 0.1, 0.1, 0.24, C.steel);
  bp.box(0, 0.7, L - 0.01, B.inner, 1.3, 0.02, C.frameLight);
  for (const x of [-0.7, 0, 0.7]) bp.box(x, 0.9, L + 0.18, 0.12, 1.5, 0.08, c, { layer: 'body' });
  // the cab shield that overhangs the cab roof, with a steel edge and two lamps
  bp.box(0, B.headH - 0.05, L + 0.55, half * 2 + 0.1, 0.1, 1.0, c, { layer: 'body', rx: 0.08 });
  bp.box(0, B.headH - 0.1, L + 1.02, half * 2 + 0.1, 0.2, 0.08, C.steel);
  for (const x of [-0.9, 0.9]) {
    bp.box(x, B.headH + 0.1, L + 0.18, 0.2, 0.12, 0.1, C.bar);
    bp.box(x, B.headH + 0.1, L + 0.235, 0.16, 0.08, 0.02, C.tail);
  }
  // rear corner posts and the bed's hinge ears
  for (const x of [-1.0, 1.0]) bp.box(x, -0.12, 0.1, 0.24, 0.3, 0.3, C.frameLight);
  // ram mounts under the front of the bed
  bp.box(0, -0.32, 2.4, 0.4, 0.1, 0.3, C.frameLight);
  finish(kit, model, bp, bed, c);
  // star and stripe (and the Lab decals) on both outer walls
  for (const k of [-1, 1]) {
    const x = k * (half + 0.1);
    decal(model, bed, 'star', 'star', 0.8, 0.8, [x, 0.72, L * 0.5], [0, (k * Math.PI) / 2, 0]);
    decal(model, bed, 'stripe', 'sideStripe', 2.6, 0.17, [x, 0.22, L * 0.5], [0, (k * Math.PI) / 2, 0]);
  }
  // ---- the tailgate: a painted plate hinged along the bottom of the bed's back edge
  const gate = group(bed),
    gp = new Parts(kit),
    G = DUMP.gate;
  gp.box(0, G.h / 2, -G.t / 2, B.inner, G.h, G.t, c, { layer: 'body' });
  for (const y of [0.25, 0.65, 1.05]) gp.box(0, y, -G.t - 0.015, B.inner - 0.2, 0.1, 0.03, C.frame);
  gp.box(0, G.h - 0.03, -G.t / 2, B.inner + 0.04, 0.08, G.t + 0.04, C.steel);
  for (const x of [-1.18, 1.18]) {
    gp.cyl(x, 0.02, -G.t / 2, 0.08, 0.2, C.pin, { axis: 'x' });
    gp.box(x, G.h - 0.1, -G.t - 0.04, 0.14, 0.2, 0.06, C.steel);
  }
  finish(kit, model, gp, gate, c);
  hydraulics(kit, model, c, 1);
  actuator(model, sprung, [0, 1.0, -1.9], bed, [0, -0.3, 2.4], 1.2, 0.13);
  Object.assign(model, { bed, gate });
}

/** Dump truck: the bed turns about the hinge by the lift joint's tip, the tailgate drops open as it rises, and the ram
 *  extends between the frame and the bed's underside. */
function poseDump(kit, model, m) {
  const a = bedAngle(m.lift);
  model.bed.rotation.x = -a;
  model.gate.rotation.x = -gateAngle(a);
}

// ---- FL-05 forklift ----

/** The forklift: a compact counterbalance truck with a rounded counterweight, an operator's seat under an overhead
 *  guard, big front drive wheels and small rear steering wheels, and a two-stage mast with a carriage, load backrest and
 *  two tapered tines. The mast, carriage and tines hang from the machine root, not the sprung body, so they sit exactly
 *  where the physics tool is; the lift ram, tilt rams and chains follow the joints. */
function buildFork(kit, model, d) {
  const { root, sprung } = model,
    c = d.color,
    F = FORK,
    p = new Parts(kit);
  // ---- lower frame, floor, step, engine cover, counterweight with a rounded back
  p.box(0, 0.72, -0.1, 1.5, 0.5, 2.3, C.frame);
  p.box(0, 0.98, 0.55, 1.34, 0.07, 1.25, C.steel);
  for (let z = 0.0; z < 1.1; z += 0.18) p.box(0, 1.02, z + 0.1, 1.2, 0.015, 0.05, C.frameLight);
  p.box(0, 1.2, -0.12, 1.06, 0.46, 0.95, c, { layer: 'body' });
  const cw = [
    [-0.78, -0.55],
    [0.78, -0.55],
    [0.82, -1.25],
    [0.6, -1.46],
    [-0.6, -1.46],
    [-0.82, -1.25],
  ];
  p.plan(cw, 0.55, 1.5, c, { layer: 'body' });
  p.plan(
    cw.map(([x, z]) => [x * 0.92, z * 0.97 + 0.03]),
    1.5,
    1.58,
    c,
    { layer: 'body' },
  );
  p.plan(
    cw.map(([x, z]) => [x * 1.01, z * 1.01]),
    0.5,
    0.6,
    C.frame,
  );
  for (let y = 0.8; y < 1.35; y += 0.1) p.box(0, y, -1.47, 0.9, 0.05, 0.03, C.grille);
  for (const x of [-0.6, 0.6]) {
    p.box(x, 1.3, -1.46, 0.2, 0.12, 0.05, C.tail);
    p.box(x, 1.12, -1.46, 0.2, 0.08, 0.05, C.lens);
  }
  p.box(0, 0.5, -0.95, 0.8, 0.07, 0.08, C.steel);
  // LPG cylinder on a bracket behind the seat
  p.cyl(0, 1.74, -1.06, 0.22, 0.8, C.steel, { axis: 'x', seg: 12 });
  p.cyl(0.42, 1.74, -1.06, 0.14, 0.06, C.frame, { axis: 'x' });
  for (const x of [-0.25, 0.25]) p.box(x, 1.74, -1.06, 0.05, 0.46, 0.5, C.bar);
  p.box(0, 1.6, -0.95, 0.5, 0.14, 0.4, C.frameLight);
  // operator's seat, steering column and wheel, levers, dash
  p.box(0, 1.5, -0.25, 0.54, 0.12, 0.5, C.seat);
  p.box(0, 1.82, -0.52, 0.52, 0.62, 0.1, C.seat, { rx: -0.14 });
  p.box(0, 1.22, -0.3, 0.3, 0.3, 0.1, C.frameLight);
  p.bar([0, 1.1, 0.5], [0, 1.62, 0.34], 0.07, C.bar);
  p.cyl(0, 1.66, 0.32, 0.22, 0.04, C.bar, { axis: 'y', seg: 12, rx: 0.4 });
  p.box(0, 1.3, 0.78, 0.9, 0.5, 0.18, C.frameLight);
  p.box(0, 1.58, 0.78, 0.9, 0.06, 0.2, c, { layer: 'body' });
  for (const x of [-0.34, 0.34]) {
    p.bar([x, 1.15, 0.45], [x, 1.7, 0.6], 0.035, C.steel);
    p.box(x, 1.72, 0.61, 0.07, 0.07, 0.07, C.amber);
  }
  // front fenders over the drive wheels, headlights, and the cowl plate at the mast
  for (const x of [-0.8, 0.8]) {
    p.box(x, 1.0, 0.55, 0.5, 0.07, 1.05, c, { layer: 'body' });
    p.box(x, 0.8, 1.13, 0.5, 0.06, 0.2, c, { layer: 'body', rx: 0.8 });
  }
  p.box(0, 0.85, 1.13, 1.2, 0.5, 0.16, C.frame);
  // the overhead guard: four posts, a roof frame and its bar grating, lamps and beacon
  const posts = [
    [-0.7, 0.8],
    [0.7, 0.8],
    [-0.7, -0.62],
    [0.7, -0.62],
  ];
  for (const [x, z] of posts) p.box(x, 1.72, z, 0.075, 1.35, 0.075, c, { layer: 'body' });
  p.box(0, 2.4, 0.09, 1.52, 0.07, 1.54, c, { layer: 'body' });
  for (let x = -0.62; x <= 0.63; x += 0.124) p.box(x, 2.43, 0.09, 0.03, 0.03, 1.5, C.bar);
  for (const z of [-0.45, -0.05, 0.35, 0.72]) p.box(0, 2.43, z, 1.4, 0.03, 0.03, C.bar);
  for (const x of [-0.5, 0.5]) {
    p.box(x, 2.34, 0.82, 0.18, 0.1, 0.08, C.bar);
    p.box(x, 2.34, 0.865, 0.14, 0.07, 0.02, C.lens);
  }
  p.cyl(0.55, 2.47, -0.5, 0.08, 0.06, C.bar);
  p.cyl(0.55, 2.55, -0.5, 0.06, 0.14, C.amber);
  // mirrors
  for (const k of [-1, 1]) {
    p.bar([k * 0.7, 2.3, 0.7], [k * 0.88, 2.2, 0.8], 0.03, C.bar);
    p.box(k * 0.9, 2.2, 0.8, 0.04, 0.2, 0.14, C.steel);
  }
  finish(kit, model, p, sprung, c);
  plate(sprung, d, 0, 0.9, -1.51, 0.74);
  roofDecals(model, sprung, 0, 1.585, -1.0, 0.8, 0.7);
  horns(kit, model, sprung, -0.45, 2.47, 0.4);
  for (const k of [-1, 1]) {
    decal(model, sprung, 'star', 'star', 0.42, 0.42, [k * 0.83, 1.0, -0.95], [0, (k * Math.PI) / 2, 0]);
    decal(model, sprung, 'stripe', 'sideStripe', 0.7, 0.14, [k * 0.83, 0.68, -0.95], [0, (k * Math.PI) / 2, 0]);
  }
  // wheels: big drive wheels in front, small steering wheels behind (they turn against the turn)
  wheelSet(kit, model, { r: 0.45, width: 0.4 }, [-1, 1].map((k) => ({ x: k * 0.78, z: 0.55 })));
  wheelSet(kit, model, { r: 0.33, width: 0.3 }, [-1, 1].map((k) => ({ x: k * 0.55, z: -0.95, steer: -1 })));
  model.gearHalf = 0.78;
  model.steerLimit = 0.6;

  // ---- the mast (tilts about its foot): outer uprights, cross bars, base plate; the inner stage slides up inside it
  const mast = group(root, 0, F.mast.y, F.mast.z),
    mp = new Parts(kit);
  for (const x of [-0.5, 0.5]) {
    mp.box(x, 1.0, 0, 0.2, 2.9, 0.2, C.steel);
    mp.box(x, 1.0, 0.11, 0.2, 2.9, 0.03, C.frameLight);
    mp.box(x + (x > 0 ? 0.11 : -0.11), 1.0, 0, 0.03, 2.9, 0.2, C.frameLight);
  }
  for (const y of [-0.3, 0.7, 1.7, 2.4]) mp.box(0, y, -0.02, 1.2, 0.12, 0.14, C.frame);
  mp.cyl(0, -0.3, 0.02, 0.16, 0.6, C.frame, { axis: 'x' });
  finish(kit, model, mp, mast, c);
  const inner = group(mast),
    ip = new Parts(kit);
  for (const x of [-0.36, 0.36]) ip.box(x, 1.05, 0.09, 0.13, 2.7, 0.16, C.steelHi);
  for (const y of [0.4, 2.35]) ip.box(0, y, 0.09, 0.84, 0.1, 0.12, C.frame);
  ip.box(0, 2.43, 0.04, 0.2, 0.1, 0.12, C.pin);
  finish(kit, model, ip, inner, c);
  // ---- the carriage: plate and rollers, the load backrest (a grid), two L-shaped tapered tines
  const carriage = group(root),
    cp = new Parts(kit),
    T0 = F.tine;
  cp.box(0, -0.0, -0.1, 1.4, 0.32, 0.1, C.frame);
  cp.box(0, 0.55, -0.1, 1.4, 0.2, 0.1, C.frame);
  for (const x of [-0.36, 0.36]) {
    cp.box(x, 0.2, -0.14, 0.18, 0.7, 0.16, C.steel);
    cp.cyl(x * 1.7, 0.2, -0.05, 0.07, 0.1, C.pin, { axis: 'z', seg: 8 });
  }
  const back = F.back;
  for (let x = -0.7; x <= 0.71; x += 0.2333) cp.box(x, back.h / 2 - T0.t, T0.heel - back.t / 2, 0.05, back.h, back.t, C.bar);
  for (const y of [0.08, 0.42, 0.76, back.h - T0.t - 0.02]) cp.box(0, y, T0.heel - back.t / 2, back.w, 0.06, back.t, C.bar);
  for (const k of [-1, 1]) {
    const x = k * T0.x;
    cp.prism(
      [
        [T0.heel, -T0.t],
        [T0.heel + T0.len - 0.3, -T0.t],
        [T0.heel + T0.len, -T0.t * 0.45],
        [T0.heel + T0.len, -T0.t * 0.2],
        [T0.heel + T0.len - 0.3, 0],
        [T0.heel, 0],
      ],
      x - T0.w / 2,
      x + T0.w / 2,
      C.shoe,
    );
    cp.box(x, 0.46, T0.heel - back.t - 0.03, T0.w, 0.98, 0.08, C.steel);
    cp.box(x, 0.0, T0.heel + 0.1, T0.w + 0.04, 0.02, 0.2, C.frameLight);
  }
  finish(kit, model, cp, carriage, c);
  hydraulics(kit, model, c, 3);
  actuator(model, mast, [0, -0.28, 0.1], inner, [0, 1.9, 0.12], 1.6, 0.075);
  for (const k of [-1, 1]) actuator(model, sprung, [k * 0.5, 1.0, 0.85], mast, [k * 0.5, 0.78, -0.12], 0.55, 0.05);
  ropes(kit, model, 2);
  Object.assign(model, { mast, inner, carriage });
}

/** Forklift: the mast and carriage follow the physics' lift and tilt exactly, the inner stage slides up once the
 *  carriage has risen past the free-lift height, and a chain runs from the inner mast's head to each side of the
 *  carriage. */
function poseFork(kit, model, m) {
  const { mast, inner, carriage, ropes: rp } = model,
    c = forkCarriage(m),
    ext = Math.max(0, m.lift - 1.2);
  mast.rotation.x = -m.tilt;
  inner.position.y = ext;
  carriage.position.set(0, c.y, c.z);
  carriage.rotation.x = -m.tilt;
  model.root.updateMatrixWorld(true);
  const pts = (obj, x, y, z) => inRoot(model, obj, S.c.set(x, y, z), S.c).clone();
  for (const [i, k] of [-1, 1].entries())
    segment(kit, rp, i, pts(inner, k * 0.2, 2.43, 0.2), pts(carriage, k * 0.3, F_CHAIN, -0.17), 0.018);
  rp.instanceMatrix.needsUpdate = true;
}
/** Height of the chain's lower fixing on the carriage (its frame: the tine top plane is y = 0). */
const F_CHAIN = 0.66;

// ---- Per frame ----

/** Moves a machine model to its physics state: chassis and suspension settle, wheel spin or track scroll, the
 *  tool at the grab point, the arms and cylinders from the joints, decals, horn and paint. `look` is the scene:
 *  { paint, decal, horn, honkAt, yard } from the builder's chosen rewards. */
export function syncMachine(kit, model, m, look) {
  const row = MACHINE[m.kind],
    { root, sprung, state } = model;
  root.position.set(m.x, m.y - 0.7, m.z);
  // the heading, and on a slope the pitch (nose up) and roll the physics chassis has (physics.mjs chassisQ)
  root.rotation.set(-(m.pitch || 0), m.yaw, m.roll || 0, 'YXZ');
  // Time since the last frame in simulated seconds (0 while paused), for travel and the suspension spring.
  const now = look.yard?.time ?? 0,
    dt = state.time === null ? 0 : clamp(now - state.time, 0, 0.25);
  state.time = now;
  // The chassis's real forward speed and turn rate since the last frame (a parked machine reads 0 even if its last
  // drive speed is still stored; a reset or restore jump reads as no motion).
  let speed = dt > 0 ? ((m.x - state.x) * Math.sin(m.yaw) + (m.z - state.z) * Math.cos(m.yaw)) / dt : 0,
    turn = dt > 0 ? (m.yaw - state.yaw) / dt : 0;
  if (Math.abs(speed) > 8 || Math.abs(turn) > 4) speed = turn = 0;
  const half = row.gear === 'wheels' ? SKID.wheel.x : row.gear === 'tracks' ? model.tracks.tr.x : model.gearHalf;
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
  else if (row.gear === 'tracks') poseTracks(kit, model);
  else {
    // The steering angle follows the turn rate (a rear-steered wheel turns against it).
    state.steer += (clamp(turn * 0.8, -model.steerLimit, model.steerLimit) - state.steer) * 0.25;
    poseWheelSets(kit, model);
  }
  // The tip in the chassis frame: the boom's swing and reach, at the lift height above the chassis base (on a terrain
  // site the lift is already measured from the ground there). The physics keeps that point level on a slope, so it is
  // turned back into the pitched and rolled chassis's frame for the arms to solve to.
  const terrain = !!look.yard?.site?.terrain;
  const tip = S.tip.set(
    Math.sin(m.swing) * m.reach,
    terrain ? m.lift : m.lift - (m.y - 0.7),
    Math.cos(m.swing) * m.reach,
  );
  if (m.pitch || m.roll) tip.applyQuaternion(S.q.setFromEuler(S.e2.set(-m.pitch, 0, m.roll, 'YXZ')).invert());
  row.pose(kit, model, m, tip);
  if (model.hyd) {
    root.updateMatrixWorld(true);
    poseHydraulics(kit, model);
  }
  const which = Object.hasOwn(model.decals, look.decal) ? look.decal : null;
  for (const k in model.decals) for (const mesh of model.decals[k]) mesh.visible = which === k;
  const fitted = Object.hasOwn(model.horns, look.horn) ? look.horn : 'stock';
  for (const k in model.horns) model.horns[k].visible = k === fitted;
  const horn = model.horns[fitted];
  // The horn on the roof swells for a moment when it sounds (only on the machine being driven).
  const age = look.yard?.machine === m && look.honkAt ? (performance.now() - look.honkAt) / HONK_MS : 1;
  horn.scale.setScalar(age >= 0 && age < 1 ? 1 + 0.4 * Math.sin(age * Math.PI) : 1);
  paintMachine(kit, model, m.kind, look.paint);
}

/** Paints the whole machine in `paint` (a PAINTS key, a Lab paint id from labLooks.js, or stock). Only the paint-layer
 *  meshes and the cylinder barrels change; the dark frames, glass, tires, tracks, decals and the number plate keep
 *  theirs. A Lab paint with a second colour (the checker) wears a two-colour check. */
function paintMachine(kit, model, kind, paint) {
  const key = PAINTS[paint] || LAB_PAINT[paint] ? paint : 'stock';
  if (model.paint === key) return;
  model.paint = key;
  const lab = LAB_PAINT[key],
    body = lab?.alt
      ? kit.checkerMat(lab.color, lab.alt)
      : lab?.metal
        ? kit.mat(lab.color, { flatShading: true, roughness: 0.32, metalness: 0.65 })
        : kit.paintMat(lab?.color || PAINTS[key] || MACHINES[kind].color);
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
  } else if (kind === 'loader') {
    body =
      `<rect x="50" y="118" width="196" height="16" fill="#26313b" ${edge}/>` +
      `<path d="M26 134V102L34 94H112V134Z" fill="${paint}" ${edge}/>` +
      `<path d="M40 104V124M48 104V124M56 104V124M64 104V124" stroke="${INK}" stroke-width="2.5"/>` +
      `<rect x="94" y="66" width="7" height="28" fill="#55626c" ${thin}/>` +
      `<path d="M112 120V50Q112 42 120 42H164L172 120Z" fill="${paint}" ${edge}/>` +
      `<path d="M120 52H160L166 112H120Z" fill="${GLASS}" ${thin}/><path d="M142 52V112" stroke="${INK}" stroke-width="2.5"/>` +
      `<rect x="128" y="34" width="10" height="8" fill="${AMBER}" ${thin}/>` +
      `<path d="M170 132V106H222L230 132Z" fill="${paint}" ${edge}/>` +
      `<path d="M176 106V78L198 74L206 106Z" fill="${paint}" ${edge}/>` +
      ram(206, 124, 234, 102, 0.5) +
      arm('M190 80L266 128', 13) +
      ram(196, 96, 252, 110, 0.5) +
      `<path d="M248 98L298 106L308 156L260 162L248 140Z" fill="${paint}" ${edge}/>` +
      `<path d="M258 163H312" stroke="#34434d" stroke-width="7" stroke-linecap="round"/>` +
      plate(32, 106, 46, 16) +
      extra +
      wheel(78, 146, 30) +
      wheel(212, 146, 30);
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
  if (which === 'stripe' || which === 'chevron') {
    // a band: white on slate (the stripe) or amber hazard chevrons on black
    const band = (x, y, w) =>
      which === 'stripe'
        ? `<rect x="${x}" y="${y}" width="${w}" height="9" fill="#172531" stroke="${INK}" stroke-width="2"/><rect x="${x}" y="${y + 3}" width="${w}" height="3" fill="#edf2f6"/>`
        : `<rect x="${x}" y="${y - 2}" width="${w}" height="13" fill="#1d252b" stroke="${INK}" stroke-width="2"/>` +
          Array.from({ length: Math.floor(w / 10) }, (_, i) => `<path d="M${x + i * 10 + 1} ${y - 1}h4l5 5.5l-5 5.5h-4l5-5.5z" fill="${AMBER}"/>`).join('');
    if (kind === 'skid')
      return which === 'stripe'
        ? `<path d="M108 73L218 89" stroke="#172531" stroke-width="9" stroke-linecap="round"/><path d="M108 73L218 89" stroke="#edf2f6" stroke-width="3" stroke-linecap="round"/>`
        : `<g transform="rotate(8.3 108 73)">${band(108, 69, 110)}</g>`;
    const [x, y, w] = kind === 'excavator' ? [40, 116, 136] : kind === 'loader' ? [34, 112, 74] : [58, 116, 122];
    return band(x, y, w);
  }
  const [cx, cy, r] =
    kind === 'skid' ? [150, 80, 10] : kind === 'excavator' ? [112, 106, 9] : kind === 'loader' ? [72, 102, 9] : [152, 104, 10];
  const box = r * 1.45,
    frame = `<rect x="${cx - box}" y="${cy - box}" width="${box * 2}" height="${box * 2}" fill="#172531" stroke="${AMBER}" stroke-width="3"/>`;
  if (which === 'anchor')
    return (
      frame +
      `<g fill="none" stroke="${AMBER}" stroke-width="2.4" stroke-linecap="round"><circle cx="${cx}" cy="${cy - r * 0.62}" r="${r * 0.2}"/>` +
      `<path d="M${cx} ${cy - r * 0.42}V${cy + r * 0.8}M${cx - r * 0.45} ${cy - r * 0.2}H${cx + r * 0.45}M${cx - r * 0.8} ${cy + r * 0.2}Q${cx - r * 0.7} ${cy + r * 0.85} ${cx} ${cy + r * 0.85}Q${cx + r * 0.7} ${cy + r * 0.85} ${cx + r * 0.8} ${cy + r * 0.2}"/></g>`
    );
  if (which === 'mountain')
    return (
      frame +
      `<path d="M${cx - r * 1.1} ${cy + r * 0.8}L${cx - r * 0.3} ${cy - r * 0.75}L${cx + r * 0.15} ${cy}L${cx + r * 0.45} ${cy - r * 0.4}L${cx + r * 1.1} ${cy + r * 0.8}Z" fill="${AMBER}"/>` +
      `<path d="M${cx - r * 0.3} ${cy - r * 0.75}L${cx - r * 0.08} ${cy - r * 0.3}L${cx - r * 0.5} ${cy - r * 0.32}Z" fill="#edf2f6"/>`
    );
  const pts = Array.from({ length: 10 }, (_, i) => {
    const rad = i % 2 ? r * 0.42 : r,
      a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    return `${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + 1 + Math.sin(a) * rad).toFixed(1)}`;
  }).join(' ');
  return frame + `<polygon points="${pts}" fill="${AMBER}"/>`;
}
/** The ferry horn: two chrome trumpets side by side on one mount. */
function ferryArt() {
  const trumpet = (y, len, mouth, shade) =>
    `<path d="M70 ${y - 6}L${70 + len} ${y - mouth}V${y + mouth}L70 ${y + 6}Z" fill="${shade}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
    `<ellipse cx="${70 + len}" cy="${y}" rx="${mouth * 0.32}" ry="${mouth}" fill="#5d6b74" stroke="${INK}" stroke-width="4"/>`;
  return (
    `<rect x="36" y="128" width="104" height="26" fill="#172531" stroke="${INK}" stroke-width="3"/>` +
    `<rect x="54" y="66" width="22" height="64" fill="#26333e" stroke="${INK}" stroke-width="3"/>` +
    trumpet(78, 196, 30, '#c9d3da') +
    trumpet(112, 140, 22, '#aab6bf') +
    `<path d="M292 50Q308 80 292 110M302 40Q326 80 302 120" fill="none" stroke="${AMBER}" stroke-width="4" stroke-linecap="round"/>`
  );
}
/** The steam horn: an upright brass whistle with its bell, valve and pull cord. */
function steamArt() {
  return (
    `<rect x="110" y="150" width="100" height="16" fill="#172531" stroke="${INK}" stroke-width="3"/>` +
    `<rect x="148" y="126" width="24" height="26" fill="#26333e" stroke="${INK}" stroke-width="3"/>` +
    `<rect x="138" y="40" width="44" height="88" rx="6" fill="#c8a040" stroke="${INK}" stroke-width="4"/>` +
    `<path d="M140 64H180M140 100H180" stroke="#8a6418" stroke-width="3"/><rect x="150" y="108" width="20" height="10" fill="#3b2a0b"/>` +
    `<path d="M128 40Q160 18 192 40Z" fill="#d4b056" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M182 116H214V150" fill="none" stroke="#8b979f" stroke-width="3"/><circle cx="214" cy="152" r="5" fill="${AMBER}"/>` +
    `<path d="M150 30Q140 14 152 2M170 30Q182 12 168 0" fill="none" stroke="#edf2f6" stroke-width="5" stroke-linecap="round" opacity="0.8"/>`
  );
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
  // The reward pictures draw the four job machines; the Lab machines are never a job's working machine.
  if (!['skid', 'excavator', 'crane', 'loader'].includes(kind)) kind = 'skid';
  let inner;
  if (PAINTS[unlock]) inner = machineProfile(kind, PAINTS[unlock]);
  else if (MACHINES[unlock] && !MACHINES[unlock].lab) inner = machineProfile(unlock, MACHINES[unlock].color);
  else if (['star', 'stripe', 'chevron', 'anchor', 'mountain'].includes(unlock))
    inner = machineProfile(kind, PAINTS[paint] || MACHINES[kind].color, decalOnBody(kind, unlock));
  else if (unlock === 'bell') inner = `<g transform="translate(-34 6)">${hornArt()}</g>`;
  else if (unlock === 'ferry') inner = ferryArt();
  else if (unlock === 'steam') inner = steamArt();
  else inner = badgeArt();
  return `<svg viewBox="0 0 320 190" role="img" aria-hidden="true" focusable="false">${inner}</svg>`;
}

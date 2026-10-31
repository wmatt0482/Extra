// The machine models and their per-frame pose. Every machine shares a chassis, a cab with tinted glass, a safety
// frame, lights, a work beacon and a number plate; the MACHINE table below says what differs by kind: wheels or
// tracks, how many arm pieces it has, its tool (an open bucket or a magnet), whether the cab turns with the boom, and
// how its arms are posed from the physics joints. A fourth machine is a new row here plus its row in physics.mjs.
// Models are batched into a few instanced meshes; only the arms, rope, hydraulics, wheels, decals and horn move or
// change. A paint reward recolors every body-colored part (cab panels, arms, bucket frame, hubs) and leaves the dark
// frames, glass, tracks and the number plate alone; a decal reward shows a star or stripes on the roof and sides; the
// bell horn replaces the small stock horn on the roof with a brass one. rewardArt() draws the large reward picture
// the job-complete sheet shows.
import * as T from '../../vendor/three.module.js';
import { MACHINES } from '../content.mjs';
import { canvasTexture } from './kit.js';

/** Scene parts for each machine kind.
 *  - gear: builds the running gear (wheels or tracks) and collects the spinning wheels.
 *  - arms: how many arm meshes pose() uses; spare ones are hidden.
 *  - tool: builds the tool at the grab point.
 *  - cabSwings: the cab turns with the boom (excavator, crane) or stays fixed (skid steer).
 *  - scoops: dust kicks up from the tool when it is lowered while driving.
 *  - lattice: instanced lattice struts on the boom (crane only).
 *  - pose: places the arms, hydraulics and rope from the machine's joints and the tool tip. */
export const MACHINE = {
  skid: {
    gear: buildWheels,
    arms: 2,
    tool: bucket(2.4, 1.16),
    cabSwings: false,
    scoops: true,
    lattice: 0,
    pose: poseLoaderArms,
  },
  excavator: {
    gear: buildTracks,
    arms: 4,
    tool: bucket(1.5, 0.72),
    cabSwings: true,
    scoops: true,
    lattice: 0,
    pose: poseExcavatorArm,
  },
  crane: {
    gear: buildTracks,
    arms: 4,
    tool: buildMagnet,
    cabSwings: true,
    scoops: false,
    lattice: 12,
    pose: poseCraneBoom,
  },
};

/** Body colors when a paint reward is chosen (stock keeps the machine's own color). */
export const PAINTS = { cream: '#c6c3b4', leaf: '#486c53', sky: '#3c7d9c', sunset: '#d86c38' };

/** The steel of the odd arm pieces on a stock machine. */
const ARM_STEEL = '#657787';

/** Seconds the horn on the roof swells when it sounds. */
const HONK_MS = 420;

/** Scratch vectors for the per-frame pose, so syncing never allocates. */
const S = {
  tip: new T.Vector3(),
  base: new T.Vector3(),
  joint: new T.Vector3(),
  a: new T.Vector3(),
  b: new T.Vector3(),
  offset: new T.Vector3(),
  dir: new T.Vector3(),
};
const UP = new T.Vector3(0, 1, 0);

/** Builds a machine of `kind` into `group` and returns its moving parts. */
export function buildMachine(kit, group, kind) {
  const row = MACHINE[kind],
    d = MACHINES[kind],
    c = d.color;
  const root = new T.Group();
  group.add(root);
  const wheels = [];
  kit.box(root, 0, 0.65, 0, 2, 0.65, 2.5, '#26313b');
  row.gear(kit, root, wheels, c);
  const cab = new T.Group();
  root.add(cab);
  const { decal, decals, horns } = buildCab(kit, cab, d);
  const arms = [];
  for (let i = 0; i < row.arms; i++) {
    const a = new T.Mesh(kit.boxGeo, kit.mat(i % 2 ? ARM_STEEL : c));
    a.castShadow = true;
    root.add(a);
    arms.push(a);
  }
  const tool = new T.Group();
  root.add(tool);
  row.tool(kit, tool, c);
  const rope = new T.Mesh(kit.cylGeo, kit.mat('#8b9ba5'));
  root.add(rope);
  const hydraulics = [];
  for (let i = 0; i < 2; i++) {
    const h = new T.Mesh(kit.cylGeo, kit.mat('#b9c7d1', { metalness: 0.5, roughness: 0.4 }));
    root.add(h);
    hydraulics.push(h);
  }
  const lattice = row.lattice ? new T.InstancedMesh(kit.boxGeo, kit.mat('#d5dce2'), row.lattice) : null;
  if (lattice) {
    lattice.frustumCulled = false;
    lattice.castShadow = true;
    root.add(lattice);
  }
  // Everything but the moving parts merges into instanced meshes.
  kit.batch(cab, new Set([decal]));
  kit.batch(tool);
  kit.batch(root, new Set([...arms, rope, ...hydraulics, ...wheels, decal]));
  // Every part still wearing the body color is repainted by a paint reward; the arms are handled one by one.
  const body = kit.mat(c),
    paintable = [];
  root.traverse((o) => {
    if ((o.isMesh || o.isInstancedMesh) && o.material === body && !arms.includes(o)) paintable.push(o);
  });
  return { root, cab, wheels, arms, bucket: tool, rope, hydraulics, decal, decals, horns, lattice, paintable, paint: 'stock' };
}

/** Four rubber tires with painted hubs: the skid steer turns on the spot. */
function buildWheels(kit, root, wheels, c) {
  for (const x of [-1.02, 1.02]) {
    for (const z of [-0.85, 0.85]) {
      const w = kit.cylinder(root, x, 0.58, z, 0.49, 0.38, '#151e25');
      w.rotation.z = Math.PI / 2;
      wheels.push(w);
      const hub = kit.cylinder(root, x * 1.18, 0.58, z, 0.23, 0.025, c);
      hub.rotation.z = Math.PI / 2;
    }
  }
}

/** Two crawler tracks with cleats and three road wheels each. */
function buildTracks(kit, root, wheels) {
  for (const x of [-1.05, 1.05]) {
    kit.box(root, x, 0.44, 0, 0.48, 0.68, 3.1, '#202b33');
    for (let z = -1.4; z < 1.5; z += 0.32) kit.box(root, x, 0.79, z, 0.54, 0.09, 0.13, '#56606a');
    for (const z of [-1, 0, 1]) {
      const w = kit.cylinder(root, x * 1.04, 0.48, z, 0.3, 0.51, '#6e7a84');
      w.rotation.z = Math.PI / 2;
      wheels.push(w);
    }
  }
}

/** An open bucket of the given width (floor, back, two sides) with teeth; `side` is the side plates' offset. */
function bucket(width, side) {
  return (kit, tool, c) => {
    kit.box(tool, 0, -0.56, 0, width, 0.15, 1.3, c);
    kit.box(tool, 0, -0.23, -0.6, width, 0.7, 0.12, c);
    for (const x of [-1, 1]) kit.box(tool, x * side, -0.25, 0, 0.12, 0.7, 1.3, c);
    for (let x = -0.6; x <= 0.6; x += 0.4) kit.box(tool, x, -0.55, 0.76, 0.18, 0.15, 0.45, '#34434d');
  };
}

/** The crane's lifting magnet. */
function buildMagnet(kit, tool, c) {
  kit.cylinder(tool, 0, 0.35, 0, 0.52, 0.3, '#263d4e');
  kit.cylinder(tool, 0, 0.55, 0, 0.3, 0.2, c);
}

/** The cab every machine shares: body, glass, safety frame, exhaust stack, vents, beacon, lights and the number
 *  plate on the back. Returns the decal patch, which stays separate so a reward can show or turn it. */
function buildCab(kit, cab, d) {
  const c = d.color;
  kit.box(cab, 0, 1.1, -0.5, 1.95, 0.5, 1.75, c);
  kit.box(cab, 0, 1.85, -0.4, 1.5, 1.5, 1.5, c);
  kit.box(cab, 0, 2.03, 0.365, 1.29, 0.9, 0.04, '#203c50');
  kit.box(cab, -0.77, 2.03, -0.4, 0.04, 0.9, 1.25, '#24465a');
  kit.box(cab, 0.77, 2.03, -0.4, 0.04, 0.9, 1.25, '#24465a');
  kit.box(cab, 0, 2.65, -0.4, 1.7, 0.15, 1.7, c);
  kit.cylinder(cab, 0.65, 2.85, -0.9, 0.07, 0.7, '#26333e');
  for (const x of [-0.68, 0.68]) kit.box(cab, x, 2.03, 0.405, 0.085, 1.04, 0.1, '#263440');
  kit.box(cab, 0, 1.57, 0.405, 1.4, 0.09, 0.1, '#263440');
  kit.box(cab, 0, 2.48, 0.405, 1.4, 0.09, 0.1, '#263440');
  kit.box(cab, 0, 2.03, 0.41, 0.055, 0.93, 0.08, '#638092');
  for (let z = -0.95; z < 0.1; z += 0.22) {
    for (const x of [-0.8, 0.8]) kit.box(cab, x, 2.05, z, 0.045, 1.05, 0.035, '#263440');
  }
  kit.box(cab, 0, 1.18, -1.4, 1.7, 0.55, 0.4, c);
  for (let x = -0.65; x < 0.7; x += 0.18) kit.box(cab, x, 1.25, -1.62, 0.07, 0.3, 0.035, '#283640');
  kit.cylinder(cab, -0.48, 2.81, -0.7, 0.13, 0.19, '#ef8c22');
  kit.cylinder(cab, -0.48, 2.69, -0.7, 0.16, 0.06, '#263440');
  kit.box(cab, 0, 1.15, -1.4, 1.6, 0.18, 0.05, '#202c35');
  for (let x = -0.65; x < 0.7; x += 0.25) kit.box(cab, x, 1.14, -1.44, 0.13, 0.17, 0.035, '#b7bfc0');
  for (const x of [-0.65, 0.65]) kit.ball(cab, x, 1.15, 1, 0.1, '#e0efff');
  const plateTexture = canvasTexture(256, 128, (pc) => {
    pc.fillStyle = '#172531';
    pc.fillRect(0, 0, 256, 128);
    pc.fillStyle = '#f0b436';
    pc.font = 'bold 50px monospace';
    pc.textAlign = 'center';
    pc.fillText(d.name, 128, 59);
    pc.fillStyle = '#c6d5df';
    pc.font = '19px monospace';
    pc.fillText('BUILD CREW', 128, 97);
  });
  const plate = new T.Mesh(new T.PlaneGeometry(1.3, 0.65), new T.MeshBasicMaterial({ map: plateTexture }));
  plate.position.set(0, 1.94, -1.165);
  plate.rotation.y = Math.PI;
  plate.userData.ownGeometry = plate.userData.ownMaterial = true;
  cab.add(plate);
  return { ...buildDecals(kit, cab), horns: buildHorns(kit, cab) };
}

/** A decal plane of the given size showing `texture`, lit like the paint under it and pulled just clear of it. */
function decalPlane(texture, w, h) {
  const m = new T.Mesh(
    new T.PlaneGeometry(w, h),
    new T.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    }),
  );
  m.userData.ownGeometry = m.userData.ownMaterial = true;
  return m;
}

/** The star and stripe decal sets. Each is a group of planes (roof and both sides) that turns on and off as a whole;
 *  `decal` is the parent group of both. The marks are dark slate with amber and white edges, so they read against
 *  every paint, in the same industrial spirit as the number plate. */
function buildDecals(kit, cab) {
  const star = canvasTexture(128, 128, (c) => {
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
  });
  const roofStripes = canvasTexture(128, 128, (c) => {
    for (const x of [30, 98]) {
      c.fillStyle = '#172531';
      c.fillRect(x - 14, 0, 28, 128);
      c.fillStyle = '#edf2f6';
      c.fillRect(x - 3, 0, 6, 128);
    }
  });
  const sideStripe = canvasTexture(256, 32, (c) => {
    c.fillStyle = '#172531';
    c.fillRect(0, 2, 256, 28);
    c.fillStyle = '#edf2f6';
    c.fillRect(0, 14, 256, 4);
  });
  const stars = new T.Group(),
    stripes = new T.Group(),
    decal = new T.Group();
  const roofStar = decalPlane(star, 0.8, 0.8);
  roofStar.position.set(0, 2.742, -0.1);
  roofStar.rotation.set(-Math.PI / 2, 0, Math.PI);
  stars.add(roofStar);
  const roofBands = decalPlane(roofStripes, 1.7, 1.7);
  roofBands.position.set(0, 2.742, -0.4);
  roofBands.rotation.x = -Math.PI / 2;
  stripes.add(roofBands);
  for (const side of [-1, 1]) {
    const sideStar = decalPlane(star, 0.5, 0.5);
    sideStar.position.set(side * 0.99, 1.1, -0.3);
    sideStar.rotation.y = (side * Math.PI) / 2;
    stars.add(sideStar);
    const band = decalPlane(sideStripe, 1.75, 0.22);
    band.position.set(side * 0.99, 1.1, -0.5);
    band.rotation.y = (side * Math.PI) / 2;
    stripes.add(band);
  }
  decal.add(stars, stripes);
  cab.add(decal);
  return { decal, decals: { star: stars, stripe: stripes } };
}

/** The two roof horns: a small dark steel trumpet (stock) and the brass bell horn earned at job 7. Both are built
 *  from their own geometry so they never merge into the batched cab; only one shows at a time. */
function buildHorns(kit, cab) {
  const make = (color, extra, length, mouth, throat, x) => {
    const g = new T.Group();
    extra = { ...extra, side: T.DoubleSide };
    const flare = new T.Mesh(new T.CylinderGeometry(mouth, throat, length, 14, 1, true), kit.mat(color, extra));
    flare.rotation.x = Math.PI / 2;
    flare.position.z = length / 2;
    const base = new T.Mesh(new T.CylinderGeometry(throat * 1.5, throat * 1.8, 0.2, 10), kit.mat('#26333e'));
    base.position.set(0, -0.1, 0.02);
    const neck = new T.Mesh(new T.CylinderGeometry(throat * 0.9, throat * 0.9, 0.12, 8), kit.mat(color, extra));
    neck.rotation.x = Math.PI / 2;
    neck.position.z = 0.02;
    for (const m of [flare, base, neck]) {
      m.userData.ownGeometry = true;
      m.castShadow = true;
      g.add(m);
    }
    g.position.set(x, 2.84, -0.82);
    cab.add(g);
    return g;
  };
  const stock = make('#3a4752', { roughness: 0.5, metalness: 0.5 }, 0.4, 0.12, 0.04, 0.16);
  const bell = make('#d4a537', { roughness: 0.3, metalness: 0.75 }, 0.62, 0.27, 0.06, 0.16);
  bell.visible = false;
  return { stock, bell };
}

/** Stretches a unit cylinder or box between points a and b, `width` thick. */
function segment(mesh, a, b, width = 0.18) {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, S.dir.subVectors(b, a).normalize());
  mesh.scale.set(width, a.distanceTo(b), width);
}

/** out = from + (dx, dy, dz). */
function shift(out, from, dx, dy, dz) {
  return out.copy(from).add(S.offset.set(dx, dy, dz));
}

/** Skid steer: two loader arms from the cab sides down to the bucket, each with a lift cylinder. */
function poseLoaderArms(model, m, tip) {
  const { arms, rope, hydraulics } = model;
  for (let k = 0; k < 2; k++) {
    const x = k ? 0.9 : -0.9;
    segment(arms[k], S.a.set(x, 1.4, -0.5), shift(S.b, tip, x, -0.1, -0.5), 0.18);
  }
  rope.visible = false;
  hydraulics.forEach((h, k) => {
    const x = k ? 0.9 : -0.9;
    segment(h, S.a.set(x, 1.1, 0), shift(S.b, tip, x, 0, -0.5), 0.08);
  });
}

/** Excavator: boom up to an elbow, stick down to the bucket, a cylinder along each. */
function poseExcavatorArm(model, m, tip) {
  const { arms, rope, hydraulics } = model;
  const elbow = S.joint.set(
      Math.sin(m.swing) * m.reach * 0.38,
      Math.max(3.5, m.lift + 1.8),
      Math.cos(m.swing) * m.reach * 0.38,
    ),
    base = S.base.set(0, 1.7, 0.3);
  segment(arms[0], base, elbow, 0.4);
  segment(arms[1], elbow, tip, 0.3);
  arms[2].visible = arms[3].visible = false;
  segment(hydraulics[0], shift(S.a, base, 0.3, 0.2, 0), shift(S.b, elbow, 0.3, -0.3, 0), 0.08);
  segment(hydraulics[1], shift(S.a, elbow, -0.2, -0.2, 0), shift(S.b, tip, -0.2, 0.4, 0), 0.07);
  rope.visible = false;
}

/** Crane: a boom with two side chords and lattice struts up to the boom head, the hoist rope down to the magnet,
 *  and one luffing cylinder. */
function poseCraneBoom(model, m, tip, kit) {
  const { arms, rope, hydraulics, lattice } = model;
  const top = S.joint.set(Math.sin(m.swing) * m.reach, Math.max(8, m.lift + 2), Math.cos(m.swing) * m.reach),
    base = S.base.set(0, 2, 0);
  segment(arms[0], base, top, 0.42);
  segment(arms[1], shift(S.a, base, 0.35, 0, 0), shift(S.b, top, 0.35, 0, 0), 0.15);
  segment(arms[2], shift(S.a, base, -0.35, 0, 0), shift(S.b, top, -0.35, 0, 0), 0.15);
  arms[3].visible = false;
  const tmp = kit.tmp;
  for (let j = 0; j < 12; j++) {
    const a = S.a
        .copy(base)
        .lerp(top, j / 12)
        .add(S.offset.set(j % 2 ? 0.35 : -0.35, 0, 0)),
      b = S.b
        .copy(base)
        .lerp(top, (j + 1) / 12)
        .add(S.offset.set(j % 2 ? -0.35 : 0.35, 0, 0));
    segment(tmp, a, b, 0.075);
    tmp.updateMatrix();
    lattice.setMatrixAt(j, tmp.matrix);
  }
  lattice.instanceMatrix.needsUpdate = true;
  segment(rope, top, shift(S.b, tip, 0, 0.5, 0), 0.045);
  segment(hydraulics[0], S.a.set(0, 1.5, 1), S.b.copy(top).multiplyScalar(0.4), 0.12);
  hydraulics[1].visible = false;
}

/** Moves a machine model to its physics state: chassis, cab swing, tool at the grab point, arms, decals, horn, wheel
 *  spin and paint. `look` is the scene: { paint, decal, horn, honkAt, yard } from the builder's chosen rewards. */
export function syncMachine(kit, model, m, look) {
  const row = MACHINE[m.kind];
  const { root, cab, bucket } = model;
  root.position.set(m.x, m.y - 0.7, m.z);
  root.rotation.y = m.yaw;
  cab.rotation.y = row.cabSwings ? m.swing : 0;
  // The tip in the chassis frame: the boom's swing and reach, at the lift height above the chassis base.
  const tip = S.tip.set(Math.sin(m.swing) * m.reach, m.lift - (m.y - 0.7), Math.cos(m.swing) * m.reach);
  bucket.position.copy(tip);
  bucket.rotation.set(m.tilt, m.swing, 0);
  row.pose(model, m, tip, kit);
  const { star, stripe } = model.decals;
  model.decal.visible = !!look.decal && look.decal !== 'none';
  star.visible = look.decal === 'star';
  stripe.visible = look.decal === 'stripe';
  const bell = look.horn === 'bell';
  model.horns.bell.visible = bell;
  model.horns.stock.visible = !bell;
  const horn = bell ? model.horns.bell : model.horns.stock;
  // The horn on the roof swells for a moment when it sounds (only on the machine being driven).
  const age = look.yard?.machine === m && look.honkAt ? (performance.now() - look.honkAt) / HONK_MS : 1;
  horn.scale.setScalar(age >= 0 && age < 1 ? 1 + 0.4 * Math.sin(age * Math.PI) : 1);
  model.wheels.forEach((w) => (w.rotation.x += m.speed * 0.02));
  paintMachine(kit, model, m.kind, look.paint);
}

/** Paints the whole machine in `paint` (a PAINTS key) or back to its stock colors. Only the parts that wear the
 *  machine's body color change; the dark frames, glass, tracks, tires, decals and the number plate keep theirs. A
 *  stock machine keeps its alternate steel arm pieces; a painted one has every arm piece in the paint. */
function paintMachine(kit, model, kind, paint) {
  const key = PAINTS[paint] ? paint : 'stock';
  if (model.paint === key) return;
  model.paint = key;
  const body = kit.mat(PAINTS[key] || MACHINES[kind].color);
  for (const part of model.paintable) part.material = body;
  model.arms.forEach((a, i) => (a.material = key === 'stock' && i % 2 ? kit.mat(ARM_STEEL) : body));
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

/** The machine's side profile in SVG (320 x 190 units, facing right) filled with `paint`, dark-edged, with its unit
 *  code on a plate on the body. `extra` is drawn on top (a decal on the body, say). */
function machineProfile(kind, paint, extra = '') {
  const edge = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
  const plate = (x, y, w = 58, h = 24) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#172531" stroke="${INK}" stroke-width="2"/>` +
    `<text x="${x + w / 2}" y="${y + h * 0.72}" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-weight="700" font-size="${h * 0.62}" fill="${AMBER}">${MACHINES[kind].name}</text>`;
  const wheel = (x, y, r) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#151e25" ${edge}/><circle cx="${x}" cy="${y}" r="${r * 0.42}" fill="${paint}" ${edge}/>`;
  const track = (x, w) =>
    `<rect x="${x}" y="134" width="${w}" height="36" rx="18" fill="#202b33" ${edge}/>` +
    [0, 1, 2].map((i) => `<circle cx="${x + 20 + (i * (w - 40)) / 2}" cy="152" r="9" fill="#6e7a84" ${edge}/>`).join('');
  const arm = (d, w) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 8}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${paint}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  let body;
  if (kind === 'skid') {
    body =
      arm('M168 88L246 96L262 126', 12) +
      `<path d="M242 108L292 118V158L252 152Z" fill="${paint}" ${edge}/>` +
      `<path d="M244 154H290" stroke="#34434d" stroke-width="7" stroke-linecap="round"/>` +
      `<path d="M50 140V104L98 100L110 66H172L186 100H232V140Z" fill="${paint}" ${edge}/>` +
      `<path d="M120 74H166L176 98H110Z" fill="${GLASS}" ${edge}/>` +
      plate(119, 104, 54, 21) +
      extra +
      wheel(92, 150, 24) +
      wheel(198, 150, 24);
  } else if (kind === 'excavator') {
    body =
      track(40, 190) +
      `<path d="M52 134V92H92L96 58H158L166 92H196V134Z" fill="${paint}" ${edge}/>` +
      `<path d="M104 66H152L158 90H100Z" fill="${GLASS}" ${edge}/>` +
      arm('M150 90L206 40L268 100', 13) +
      `<path d="M258 92L296 104L282 140L252 124Z" fill="${paint}" ${edge}/>` +
      plate(62, 100) +
      extra;
  } else {
    body =
      track(40, 190) +
      arm('M130 92L270 22', 11) +
      `<path d="M270 22V116" stroke="#8b9ba5" stroke-width="3"/>` +
      `<rect x="254" y="114" width="32" height="14" fill="#263d4e" ${edge}/><rect x="262" y="106" width="16" height="10" fill="${paint}" ${edge}/>` +
      `<path d="M52 134V94H96L100 62H152L160 94H196V134Z" fill="${paint}" ${edge}/>` +
      `<path d="M108 70H146L152 92H104Z" fill="${GLASS}" ${edge}/>` +
      plate(62, 102) +
      extra;
  }
  return `<path d="M20 174H300" stroke="#465460" stroke-width="3"/>` + body;
}

/** A star or stripe decal drawn large on the machine's body, to match what the 3D machine wears. It sits clear of
 *  the number plate and the wheels: a stripe along the lower body (behind the wheels on the skid steer), a star on
 *  the free part of the body. */
function decalOnBody(kind, which) {
  const skid = kind === 'skid';
  if (which === 'stripe') {
    const [x, y, w, h] = skid ? [52, 126, 180, 12] : [128, 116, 68, 14];
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#172531" stroke="${INK}" stroke-width="2"/><rect x="${x}" y="${y + h / 2 - 2}" width="${w}" height="4" fill="#edf2f6"/>`;
  }
  const [cx, cy, r] = skid ? [84, 113, 12] : [166, 108, 17],
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

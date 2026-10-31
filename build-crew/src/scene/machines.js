// The machine models and their per-frame pose. Every machine shares a chassis, a cab with tinted glass, a safety
// frame, lights, a work beacon and a number plate; the MACHINE table below says what differs by kind: wheels or
// tracks, how many arm pieces it has, its tool (an open bucket or a magnet), whether the cab turns with the boom, and
// how its arms are posed from the physics joints. A fourth machine is a new row here plus its row in physics.mjs.
// Models are batched into a few instanced meshes; only the arms, rope, hydraulics, wheels and decal move.
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

/** Arm colors when a paint reward is chosen (stock keeps the machine's own color). */
export const PAINTS = { cream: '#c6c3b4', leaf: '#486c53', sky: '#3c7d9c', sunset: '#d86c38' };

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
  const decal = buildCab(kit, cab, d);
  const arms = [];
  for (let i = 0; i < row.arms; i++) {
    const a = new T.Mesh(kit.boxGeo, kit.mat(i % 2 ? '#657787' : c));
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
  return { root, cab, wheels, arms, bucket: tool, rope, hydraulics, decal, lattice };
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
  const decal = kit.box(cab, 0.79, 1.6, -0.4, 0.025, 0.45, 0.45, '#e9aa26');
  decal.name = 'crew-decal';
  return decal;
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

/** Moves a machine model to its physics state: chassis, cab swing, tool at the grab point, arms, decal, wheel spin
 *  and paint. `look` is { paint, decal } from the builder's chosen rewards. */
export function syncMachine(kit, model, m, look) {
  const row = MACHINE[m.kind];
  const { root, cab, arms, bucket } = model;
  root.position.set(m.x, m.y - 0.7, m.z);
  root.rotation.y = m.yaw;
  cab.rotation.y = row.cabSwings ? m.swing : 0;
  // The tip in the chassis frame: the boom's swing and reach, at the lift height above the chassis base.
  const tip = S.tip.set(Math.sin(m.swing) * m.reach, m.lift - (m.y - 0.7), Math.cos(m.swing) * m.reach);
  bucket.position.copy(tip);
  bucket.rotation.set(m.tilt, m.swing, 0);
  row.pose(model, m, tip, kit);
  model.decal.visible = look.decal !== 'none' && !!look.decal;
  model.decal.rotation.x = look.decal === 'star' ? Math.PI / 4 : 0;
  model.wheels.forEach((w) => (w.rotation.x += m.speed * 0.02));
  if (look.paint && look.paint !== 'stock') {
    const paint = PAINTS[look.paint];
    if (paint) for (const a of arms) a.material = kit.mat(paint);
  }
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

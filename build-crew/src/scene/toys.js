// The toys and each round's fixtures. Every toy type is one instanced mesh redrawn from the physics poses each
// frame, so 64 toys cost seven draw calls: painted blocks, beams and slabs get a dark steel frame on their edges,
// pallets are drawn as seven slats, barrels and pipes are cylinders and glass is a translucent pane. The fixtures are
// the blue delivery pad, the glowing ghost outlines of a blueprint job, the job's props (platform, wall) and markers.
import * as T from '../../vendor/three.module.js';
import { TOYS } from '../content.mjs';
import { BUDGET } from './quality.js';

/** Toy types drawn with a steel edge frame. */
const FRAMED = new Set(['cube', 'beam', 'slab']);

/** Pallet slats in the pallet's own frame: five deck boards, then the two runners (matching its physics colliders). */
const PALLET_SLATS = Array.from({ length: 7 }, (_, k) =>
  new T.Matrix4().compose(
    new T.Vector3(k < 5 ? -0.84 + k * 0.42 : k === 5 ? -0.8 : 0.8, k < 5 ? 0.15 : -0.075, 0),
    new T.Quaternion(),
    new T.Vector3(0.3, k < 5 ? 0.15 : 0.3, 1.8),
  ),
);
const PALLET_WOOD = '#b38c5c';

/** Blueprint ghost colors: amber while open, green once a toy matches (fill, then edge lines). */
const GHOST = { open: '#ffb81f', openEdge: '#ffe08a', match: '#38e86a', matchEdge: '#d4ffd9' };

/** Colors parsed once per hex string, so drawing a frame never parses a color string. */
const colorCache = new Map();
const colorOf = (hex) => {
  let c = colorCache.get(hex);
  if (!c) colorCache.set(hex, (c = new T.Color(hex)));
  return c;
};
const GHOST_COLORS = Object.fromEntries(Object.entries(GHOST).map(([k, v]) => [k, new T.Color(v)]));

/** Scratch objects for the per-frame pallet transforms. */
const scratch = {
  position: new T.Vector3(),
  rotation: new T.Quaternion(),
  one: new T.Vector3(1, 1, 1),
  pallet: new T.Matrix4(),
  slat: new T.Matrix4(),
};

export class ToyLayer {
  constructor(kit) {
    this.kit = kit;
    this.meshes = {};
    this.ghosts = [];
    this.counts = {};
  }

  /** Creates this round's instanced toy meshes and the edge-frame mesh in the round group. */
  buildMeshes(group) {
    const kit = this.kit;
    this.meshes = {};
    for (const kind of Object.keys(TOYS)) {
      const d = TOYS[kind];
      const geo =
        kind === 'pipe' ? new T.CylinderGeometry(0.5, 0.5, 1, 12, 1, true) : d.round ? kit.cylGeo : kit.boxGeo;
      const mat =
        kind === 'glass'
          ? kit.mat('#b7e5dc', { transparent: true, opacity: 0.5, roughness: 0.22 })
          : kit.mat('#ffffff', {});
      const m = new T.InstancedMesh(geo, mat, kind === 'pallet' ? BUDGET.palletSlats : BUDGET.toys);
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      if (kind === 'pipe') m.userData.ownGeometry = true;
      group.add(m);
      this.meshes[kind] = m;
    }
    this.frames = new T.InstancedMesh(frameGeometry(kit), kit.mat('#34434b', { metalness: 0.4, roughness: 0.6 }), 64);
    this.frames.userData.ownGeometry = true;
    this.frames.frustumCulled = false;
    this.frames.castShadow = true;
    group.add(this.frames);
  }

  /** Adds the delivery pad, the blueprint's ghost outlines, the job's props and any job marker. `ground(x, z)` is the
   *  site's ground height (the barge deck and the hillside terrace are not at y = 0). */
  buildFixtures(group, round, ground = () => 0) {
    const kit = this.kit,
      pad = round.pad;
    // the blue delivery pad (not painted where it lies over water or a ravine), and a hillside job's orange pit pad
    for (const [p, fill, edge] of [
      [pad.mark === false ? null : pad, '#256e88', '#d1e6ef'],
      [round.source, '#b8642c', '#f1c27a'],
    ]) {
      if (!p) continue;
      const y = ground(p.x, p.z);
      kit.box(group, p.x, y + 0.025, p.z, p.w, 0.035, p.d, fill);
      for (const side of [-1, 1]) {
        kit.box(group, p.x + (side * p.w) / 2, y + 0.053, p.z, 0.12, 0.035, p.d, edge);
        kit.box(group, p.x, y + 0.053, p.z + (side * p.d) / 2, p.w, 0.035, 0.12, edge);
      }
    }
    this.car = null;
    for (const d of round.decor || []) if (d.kind === 'car') this.car = toyCar(kit, group, d.x, ground(d.x, d.z), d.z);
    this.ghosts = [];
    for (const g of round.ghosts || []) {
      const geo = new T.BoxGeometry(...TOYS[g.type].size),
        mat = new T.MeshBasicMaterial({ color: GHOST.open, transparent: true, opacity: 0.3, depthWrite: false });
      const ghost = new T.Mesh(geo, mat);
      ghost.position.set(g.x, g.y, g.z);
      ghost.userData.ownGeometry = true;
      ghost.userData.ownMaterial = true;
      group.add(ghost);
      const edges = new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({ color: GHOST.openEdge }));
      ghost.add(edges);
      ghost.userData.edges = edges;
      this.ghosts.push(ghost);
    }
    for (const p of round.props || []) {
      if (p.kind === 'barrier') {
        // a run of concrete quay barriers: sloped-foot blocks with black and amber hazard bands
        const n = Math.round(p.size[2] / 1.5);
        for (let i = 0; i < n; i++) {
          const z = p.z - p.size[2] / 2 + (i + 0.5) * (p.size[2] / n);
          kit.box(group, p.x, 0.2, z, p.size[0] + 0.2, 0.4, p.size[2] / n - 0.06, '#c9ccc6');
          kit.box(group, p.x, 0.75, z, p.size[0], 0.7, p.size[2] / n - 0.06, '#c9ccc6');
          kit.box(group, p.x, 0.9, z, p.size[0] + 0.02, 0.14, p.size[2] / n - 0.4, i % 2 ? '#1d252b' : '#e1a531');
        }
        continue;
      }
      kit.box(group, p.x, p.y, p.z, ...p.size, p.kind === 'platform' ? '#556675' : '#787b73');
      if (p.kind === 'wall') {
        for (let y = 0.35; y < 3; y += 0.7) kit.box(group, p.x + 0.31, y, p.z, 0.025, 0.035, p.size[2], '#515f66');
      }
    }
    // A job's height flag (round.flag: x, z, height) shows how tall the stack must be.
    if (round.flag) {
      const { x, z, height } = round.flag;
      kit.cylinder(group, x, height / 2, z, 0.04, height, '#e7dec2');
      kit.box(group, x + 0.6, height - 0.2, z, 1.2, 0.6, 0.04, '#de7754');
    }
  }

  /** Writes every toy's pose into its type's instanced mesh (and the edge frames). */
  update(poses) {
    const kit = this.kit,
      tmp = kit.tmp;
    let frameCount = 0;
    const counts = this.counts;
    for (const kind in this.meshes) counts[kind] = 0;
    for (let i = 0; i < poses.length; i++) {
      const b = poses[i],
        d = TOYS[b.type],
        mesh = this.meshes[b.type];
      tmp.position.copy(b.position);
      tmp.quaternion.copy(b.rotation);
      tmp.scale.set(d.size[0], d.size[1], d.size[2]);
      tmp.updateMatrix();
      if (FRAMED.has(b.type)) this.frames.setMatrixAt(frameCount++, tmp.matrix);
      if (b.type === 'pallet') {
        const { position, rotation, one, pallet, slat } = scratch;
        position.set(b.position.x, b.position.y, b.position.z);
        rotation.set(b.rotation.x, b.rotation.y, b.rotation.z, b.rotation.w);
        pallet.compose(position, rotation, one);
        for (const local of PALLET_SLATS) {
          slat.multiplyMatrices(pallet, local);
          mesh.setMatrixAt(counts[b.type], slat);
          mesh.setColorAt(counts[b.type]++, colorOf(PALLET_WOOD));
        }
      } else {
        mesh.setMatrixAt(counts[b.type], tmp.matrix);
        mesh.setColorAt(counts[b.type]++, colorOf(b.color));
      }
    }
    this.frames.count = frameCount;
    this.frames.instanceMatrix.needsUpdate = true;
    for (const kind in this.meshes) {
      const m = this.meshes[kind];
      m.count = counts[kind];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  /** Ghosts are amber (the complement of the blue pad, so they stand out) and breathe gently with the yard clock;
   *  while a toy matches one it turns a solid, brighter green. */
  updateGhosts(status, time) {
    for (let i = 0; i < this.ghosts.length; i++) {
      const g = this.ghosts[i],
        good = status?.matches?.[i] != null;
      g.material.color.copy(good ? GHOST_COLORS.match : GHOST_COLORS.open);
      g.material.opacity = good ? 0.5 : 0.3 + Math.sin(time * 2) * 0.06;
      g.userData.edges.material.color.copy(good ? GHOST_COLORS.matchEdge : GHOST_COLORS.openEdge);
    }
  }
}

/** The ravine job's toy car: a slate die-cast pickup on four black wheels, facing +x, waiting at (x, y, z). */
function toyCar(kit, group, x, y, z) {
  const car = new T.Group();
  car.position.set(x, y, z);
  group.add(car);
  kit.box(car, 0, 0.42, 0, 1.7, 0.34, 0.8, '#3b4a55');
  kit.box(car, -0.15, 0.74, 0, 0.7, 0.32, 0.74, '#3b4a55');
  kit.box(car, 0.21, 0.74, 0, 0.03, 0.26, 0.66, '#2b5168');
  kit.box(car, 0.86, 0.46, 0, 0.04, 0.12, 0.6, '#d9dfe1');
  kit.box(car, -0.55, 0.62, 0, 0.6, 0.04, 0.82, '#e1a531');
  for (const wx of [-0.55, 0.55]) for (const wz of [-0.38, 0.38]) {
    const w = kit.cylinder(car, wx, 0.2, wz, 0.2, 0.14, '#161c21');
    w.rotation.x = Math.PI / 2;
  }
  return car;
}

/** One geometry for a block's edge frame: twelve thin bars along the edges of a unit cube, merged so that every
 *  framed toy is one instance (scaled to the toy) of one mesh. */
function frameGeometry(kit) {
  const frameParts = [];
  for (let axis = 0; axis < 3; axis++) {
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        const g = kit.boxGeo.clone(),
          scale = [0.045, 0.045, 0.045],
          offset = [0, 0, 0];
        scale[axis] = 1.014;
        offset[(axis + 1) % 3] = a * 0.485;
        offset[(axis + 2) % 3] = b * 0.485;
        g.scale(...scale);
        g.translate(...offset);
        frameParts.push(g);
      }
    }
  }
  const frameGeo = new T.BufferGeometry(),
    positions = [],
    normals = [];
  for (const g of frameParts) {
    const n = g.toNonIndexed();
    positions.push(...n.attributes.position.array);
    normals.push(...n.attributes.normal.array);
    n.dispose();
    g.dispose();
  }
  frameGeo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  frameGeo.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  return frameGeo;
}

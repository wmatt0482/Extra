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

/** Scratch objects for the per-frame pallet transforms. */
const scratch = {
  position: new T.Vector3(),
  rotation: new T.Quaternion(),
  one: new T.Vector3(1, 1, 1),
  pallet: new T.Matrix4(),
  slat: new T.Matrix4(),
};

/** Extra markers for particular jobs, keyed by job id: job 8's height flag shows how tall the stack must be. */
const JOB_MARKERS = {
  8(kit, group) {
    kit.cylinder(group, 6, 2.5, 5, 0.04, 5, '#e7dec2');
    kit.box(group, 6.6, 4.8, 5, 1.2, 0.6, 0.04, '#de7754');
  },
};

export class ToyLayer {
  constructor(kit) {
    this.kit = kit;
    this.meshes = {};
    this.ghosts = [];
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

  /** Adds the delivery pad, the blueprint's ghost outlines, the job's props and any job marker. */
  buildFixtures(group, round) {
    const kit = this.kit,
      pad = round.pad;
    kit.box(group, pad.x, 0.025, pad.z, pad.w, 0.035, pad.d, '#256e88');
    for (const side of [-1, 1]) {
      kit.box(group, pad.x + (side * pad.w) / 2, 0.053, pad.z, 0.12, 0.035, pad.d, '#d1e6ef');
      kit.box(group, pad.x, 0.053, pad.z + (side * pad.d) / 2, pad.w, 0.035, 0.12, '#d1e6ef');
    }
    this.ghosts = [];
    for (const g of round.ghosts || []) {
      const geo = new T.BoxGeometry(...TOYS[g.type].size),
        mat = new T.MeshBasicMaterial({ color: '#a4f0d4', transparent: true, opacity: 0.2, depthWrite: false });
      const ghost = new T.Mesh(geo, mat);
      ghost.position.set(g.x, g.y, g.z);
      ghost.userData.ownGeometry = true;
      ghost.userData.ownMaterial = true;
      group.add(ghost);
      const edges = new T.LineSegments(
        new T.EdgesGeometry(geo),
        new T.LineBasicMaterial({ color: '#ceffe3', transparent: true, opacity: 0.75 }),
      );
      ghost.add(edges);
      this.ghosts.push(ghost);
    }
    for (const p of round.props || []) {
      kit.box(group, p.x, p.y, p.z, ...p.size, p.kind === 'platform' ? '#556675' : '#787b73');
      if (p.kind === 'wall') {
        for (let y = 0.35; y < 3; y += 0.7) kit.box(group, p.x + 0.31, y, p.z, 0.025, 0.035, p.size[2], '#515f66');
      }
    }
    JOB_MARKERS[round.id]?.(kit, group);
  }

  /** Writes every toy's pose into its type's instanced mesh (and the edge frames). */
  update(poses) {
    const kit = this.kit,
      tmp = kit.tmp;
    let frameCount = 0;
    const counts = Object.fromEntries(Object.keys(TOYS).map((k) => [k, 0]));
    for (const b of poses) {
      const d = TOYS[b.type],
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
          mesh.setColorAt(counts[b.type]++, kit.color.set(PALLET_WOOD));
        }
      } else {
        mesh.setMatrixAt(counts[b.type], tmp.matrix);
        mesh.setColorAt(counts[b.type]++, kit.color.set(b.color));
      }
    }
    this.frames.count = frameCount;
    this.frames.instanceMatrix.needsUpdate = true;
    for (const [kind, m] of Object.entries(this.meshes)) {
      m.count = counts[kind];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  /** Ghosts turn green while a toy matches them and otherwise breathe gently with the yard clock. */
  updateGhosts(status, time) {
    this.ghosts.forEach((g, i) => {
      const good = status?.matches?.[i] != null;
      g.material.color.set(good ? '#91f38a' : '#adf6e1');
      g.material.opacity = good ? 0.33 : 0.16 + Math.sin(time * 2) * 0.04;
    });
  }
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

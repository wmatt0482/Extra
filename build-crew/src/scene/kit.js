// The scene's shared toolkit: one cached material per color, the unit geometries every model is built from, scratch
// objects for per-frame matrix work, and helpers that add a box, cylinder or ball to a group. All scene modules build
// through the same kit so that identical parts share a material and geometry, which is what lets batch() merge them
// into a few instanced draw calls.
import * as T from '../../vendor/three.module.js';

export class Kit {
  constructor() {
    /** Scratch color and transform, reused every frame instead of allocating. */
    this.color = new T.Color();
    this.tmp = new T.Object3D();
    this.materials = {};
    /** Unit shapes: models scale these rather than creating their own geometry. */
    this.boxGeo = new T.BoxGeometry(1, 1, 1);
    this.cylGeo = new T.CylinderGeometry(0.5, 0.5, 1, 12);
    this.sphereGeo = new T.IcosahedronGeometry(1, 0);
    this.circleGeo = new T.CircleGeometry(1, 16);
  }

  /** The shared matte material for color c (plus any extra material options), created on first use. */
  mat(c, extra = {}) {
    const key = c + JSON.stringify(extra);
    return (this.materials[key] ||= new T.MeshStandardMaterial({ color: c, roughness: 0.86, metalness: 0, ...extra }));
  }

  /** Adds a shadow-casting box of size (sx, sy, sz) centred at (x, y, z), turned rot radians about y. */
  box(parent, x, y, z, sx, sy, sz, c, rot = 0) {
    const m = new T.Mesh(this.boxGeo, this.mat(c));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.y = rot;
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  /** Adds an upright cylinder of radius r and height h centred at (x, y, z). */
  cylinder(parent, x, y, z, r, h, c) {
    const m = new T.Mesh(this.cylGeo, this.mat(c));
    m.position.set(x, y, z);
    m.scale.set(r * 2, h, r * 2);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  /** Adds a low-poly ball of radius r centred at (x, y, z). */
  ball(parent, x, y, z, r, c) {
    const m = new T.Mesh(this.sphereGeo, this.mat(c));
    m.position.set(x, y, z);
    m.scale.setScalar(r);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  /** Merges static kit meshes under `group` into one InstancedMesh per geometry and material pair, keeping their
   *  current transforms. Meshes in `skip` stay separate because they move or change material later. A pair used only
   *  once is left alone. This keeps the yard and each machine within the draw-call budget. */
  batch(group, skip = new Set()) {
    group.updateMatrixWorld(true);
    const inverse = new T.Matrix4().copy(group.matrixWorld).invert(),
      buckets = new Map();
    const shared = [this.boxGeo, this.cylGeo, this.sphereGeo];
    group.traverse((o) => {
      if (o.isMesh && !o.isInstancedMesh && !skip.has(o) && shared.includes(o.geometry)) {
        const key = o.geometry.uuid + o.material.uuid;
        let list = buckets.get(key);
        if (!list) {
          list = [];
          buckets.set(key, list);
        }
        list.push(o);
      }
    });
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const source = list[0],
        mesh = new T.InstancedMesh(source.geometry, source.material, list.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      list.forEach((o, i) => {
        mesh.setMatrixAt(i, new T.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
        o.removeFromParent();
      });
      group.add(mesh);
    }
  }
}

/** A canvas texture with the given size, painted by draw(context), in sRGB. Used for the sign and number plates. */
export function canvasTexture(width, height, draw) {
  const cv = document.createElement('canvas');
  cv.width = width;
  cv.height = height;
  draw(cv.getContext('2d'));
  const texture = new T.CanvasTexture(cv);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

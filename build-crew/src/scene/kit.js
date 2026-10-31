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

  /** A unit cylinder (radius 0.5, height 1) with `seg` sides, cached per side count. */
  cylinder8(seg = 8) {
    return ((this.cylinders ||= {})[seg] ||= new T.CylinderGeometry(0.5, 0.5, 1, seg));
  }

  /** The flat-shaded material every model's vertex-colored detail layer shares. */
  detailMat() {
    return this.mat('#ffffff', { vertexColors: true, flatShading: true, roughness: 0.78 });
  }

  /** Tinted cab glass: darker and glossier than paint, so a cab reads as glazed from any angle. */
  glassMat() {
    return this.mat('#2b5168', { flatShading: true, roughness: 0.16, metalness: 0.45 });
  }

  /** A machine's flat-shaded paint in color c (what a paint reward swaps on every body part). */
  paintMat(c) {
    return this.mat(c, { flatShading: true, roughness: 0.62 });
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

/** Collects a model's static pieces (boxes, cylinders, extruded profiles) and merges them into one mesh per layer:
 *  'body' wears the machine's paint material, 'detail' is a single vertex-colored material shared by every model (so
 *  dark frames, steel, lights and tires of many colors cost one draw call), and 'glass' is the tinted cab glass. A
 *  machine's fixed frame, its swinging house and each moving arm are separate Parts, so a moving piece is one or two
 *  draw calls however much detail it carries. Coordinates are in the parent group's frame. */
export class Parts {
  constructor(kit) {
    this.kit = kit;
    this.layers = {};
    this.m = new T.Matrix4();
    this.n = new T.Matrix3();
    this.q = new T.Quaternion();
    this.e = new T.Euler();
    this.v = new T.Vector3();
    this.s = new T.Vector3();
    this.p = new T.Vector3();
  }

  /** Adds `geo` (a unit shape) transformed by the matrix in this.m, in color c, to layer. */
  add(geo, c, layer = 'detail') {
    const L = (this.layers[layer] ||= { pos: [], nor: [], col: [] });
    const src = geo.index ? geo.toNonIndexed() : geo;
    const pos = src.attributes.position,
      nor = src.attributes.normal;
    this.n.getNormalMatrix(this.m);
    const color = this.kit.color.set(c);
    for (let i = 0; i < pos.count; i++) {
      this.v.fromBufferAttribute(pos, i).applyMatrix4(this.m);
      L.pos.push(this.v.x, this.v.y, this.v.z);
      this.v.fromBufferAttribute(nor, i).applyMatrix3(this.n).normalize();
      L.nor.push(this.v.x, this.v.y, this.v.z);
      L.col.push(color.r, color.g, color.b);
    }
    if (src !== geo) src.dispose();
    return this;
  }

  /** Sets this.m from a position, a scale and an Euler rotation (radians, order XYZ unless `order` says). */
  place(x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, order = 'XYZ') {
    this.q.setFromEuler(this.e.set(rx, ry, rz, order));
    this.m.compose(this.p.set(x, y, z), this.q, this.s.set(sx, sy, sz));
    return this;
  }

  /** A box of size (sx, sy, sz) centred at (x, y, z), optionally rotated. */
  box(x, y, z, sx, sy, sz, c, { rx = 0, ry = 0, rz = 0, layer } = {}) {
    return this.place(x, y, z, sx, sy, sz, rx, ry, rz).add(this.kit.boxGeo, c, layer);
  }

  /** A cylinder of radius r and length h centred at (x, y, z) along axis 'x', 'y' or 'z', with `seg` sides. */
  cyl(x, y, z, r, h, c, { axis = 'y', seg = 8, layer, rx = 0 } = {}) {
    const rot = axis === 'x' ? [rx, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2 + rx, 0, 0] : [rx, 0, 0];
    return this.place(x, y, z, r * 2, h, r * 2, ...rot).add(this.kit.cylinder8(seg), c, layer);
  }

  /** A bar of square section `w` (or w x d) from point a to point b, each [x, y, z]. */
  bar(a, b, w, c, { layer, d = w } = {}) {
    const A = new T.Vector3(...a),
      B = new T.Vector3(...b),
      len = A.distanceTo(B);
    this.q.setFromUnitVectors(this.v.set(0, 1, 0), B.clone().sub(A).normalize());
    this.m.compose(A.add(B).multiplyScalar(0.5), this.q, this.s.set(w, len, d));
    return this.add(this.kit.boxGeo, c, layer);
  }

  /** A side profile: polygon points [[z, y], ...] extruded across x from x0 to x1. */
  prism(points, x0, x1, c, { layer } = {}) {
    const geo = new T.ExtrudeGeometry(new T.Shape(points.map(([z, y]) => new T.Vector2(z, y))), {
      depth: x1 - x0,
      bevelEnabled: false,
    });
    // Shape x -> z, shape y -> y, extrusion -> -x, starting at x1 (a proper rotation, so faces keep their winding).
    this.m.set(0, 0, -1, x1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1);
    this.add(geo, c, layer);
    geo.dispose();
    return this;
  }

  /** A floor plan: polygon points [[x, z], ...] extruded up from y0 to y1. */
  plan(points, y0, y1, c, { layer } = {}) {
    const geo = new T.ExtrudeGeometry(new T.Shape(points.map(([x, z]) => new T.Vector2(x, -z))), {
      depth: y1 - y0,
      bevelEnabled: false,
    });
    // Shape x -> x, shape y -> -z, extrusion -> y, starting at y0.
    this.m.set(1, 0, 0, 0, 0, 0, 1, y0, 0, -1, 0, 0, 0, 0, 0, 1);
    this.add(geo, c, layer);
    geo.dispose();
    return this;
  }

  /** Merges every layer into one mesh under `parent`. `body` is the paint material; returns { body, detail, glass }
   *  (a layer with no pieces is absent). Each mesh owns its geometry, so clearing the round frees it. */
  build(parent, body, { shadow = true } = {}) {
    const out = {},
      mats = { body, detail: this.kit.detailMat(), glass: this.kit.glassMat() };
    for (const [name, L] of Object.entries(this.layers)) {
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(L.pos, 3));
      geo.setAttribute('normal', new T.Float32BufferAttribute(L.nor, 3));
      if (name === 'detail') geo.setAttribute('color', new T.Float32BufferAttribute(L.col, 3));
      geo.computeBoundingSphere();
      const mesh = new T.Mesh(geo, mats[name] || mats.detail);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      mesh.userData.ownGeometry = true;
      parent.add(mesh);
      out[name] = mesh;
    }
    this.layers = {};
    return out;
  }

  /** The detail layer's pieces as one geometry with vertex colors (for an InstancedMesh such as a wheel or a track
   *  shoe), leaving the parts list empty. */
  geometry() {
    const L = this.layers.detail || { pos: [], nor: [], col: [] },
      geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(L.pos, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(L.nor, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(L.col, 3));
    geo.computeBoundingSphere();
    this.layers = {};
    return geo;
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

// The site around the jobs: sky, fog and lights, the gravel floor tiles, terrain stamps, and the scenery outside the
// working area (road, fence, workshop, loading bay, containers, shed, trees, hills, cones, stones, a pallet rack and
// the site sign). Everything here is built once per page from a site theme object, so a second site (the harbor or
// the hillside in SPEC §3) is a new theme: its palette, its sign and its list of scenery features. Static scenery is
// batched into instanced meshes; only the floor tiles and the stamps change after that.
import * as T from '../../vendor/three.module.js';
import { canvasTexture } from './kit.js';
import { BUDGET, TIER } from './quality.js';
import { HILL, RAMP_FACES, RECESS, hillProfile, rampPoints } from '../terrain.mjs';

/** The first-flight yard (SPEC §5): gravel, weathered steel and muted greens under a pale industrial sky. */
export const YARD_THEME = {
  id: 'yard',
  fog: { color: '#8b9fae', near: 75, far: 160 },
  hemi: { sky: '#b4d0ed', ground: '#685d4d', intensity: 1.85 },
  sun: { color: '#fff0d8', intensity: 3.3, position: [-15, 30, 12] },
  sky: { top: '#5485b0', bottom: '#b5c0c8' },
  /** The daylight slider: light intensities at night (base) and how much full day adds, the dusk sun color below
   *  `dusk`, and the night sky below `night`. */
  daylight: {
    sun: { base: 0.3, range: 3.6, day: '#fff0db', dusk: '#e7a9bd' },
    hemi: { base: 0.65, range: 1.7 },
    dusk: 0.4,
    night: 0.35,
    nightSky: { top: '#243e68', bottom: '#9f9ba4' },
  },
  gravel: { base: '#c5c8c5', dark: '#a5aaa7', light: '#e0e1dc' },
  ground: '#627660',
  tiles: ['#6d7772', '#6e7873'],
  stamps: {
    water: '#73b4bd',
    bank: '#b29c72',
    slope: '#baa478',
    mound: '#6e5d40',
    pitFloor: '#151a1f',
    pitWall: '#3a3029',
    pitRim: '#d9a42c',
  },
  /** The scenery to build, in order. Each name is a function in FEATURES below. */
  features: ['road', 'fence', 'workshop', 'bay', 'containers', 'shed', 'trees', 'hills', 'cones', 'stones', 'rack'],
  road: { surface: '#3c4650', line: '#d4cfb5' },
  fence: { post: '#64727a', rail: '#4d5a62' },
  workshop: { wall: '#586b79', roof: '#283e50', door: '#364952', slat: '#83949c', rib: '#718493' },
  bay: { dark: '#26313b', light: '#e9aa26', lane: '#d9c787' },
  containers: { body: '#385e70', rib: '#618293' },
  shed: { wall: '#b55a34', roof: '#283e50', window: '#264959' },
  trees: { count: 22, trunk: '#916d4c', leaves: ['#3c624b', '#4c7155', '#577659'] },
  hills: { count: 9, colors: ['#7f927d', '#6f856e', '#8c9b87'] },
  cones: {
    spots: [
      [-13, -10],
      [13, 10],
      [13, -13],
      [-12, 13],
    ],
    base: '#283440',
    cone: '#dd6529',
    cap: '#d9dfe1',
  },
  stones: { count: 40, color: '#798174' },
  rack: {
    x: -9,
    z: -20.2,
    bays: 3,
    bayWidth: 2.6,
    post: '#2f5b86',
    beam: '#d8742a',
    wood: '#7a6a52',
    crate: '#8f7650',
  },
  sign: { text: 'BUILD CREW', post: '#2d3d49', board: '#172531', ink: '#f1b539' },
};

/** The floor tile grid: 4 m tiles with centres from -14 to 14, matching physics.mjs. */
const TILE = { half: 14, size: 4 };

/** Builds the lights, sky and scenery into `scene` and returns the parts that change later: the lights and sky (for
 *  daylight), the floor tiles (for stamps) and the textures to dispose. */
export function buildEnvironment(scene, kit, theme = YARD_THEME) {
  const env = { theme };
  env.hemi = new T.HemisphereLight(theme.hemi.sky, theme.hemi.ground, theme.hemi.intensity);
  scene.add(env.hemi);
  env.sun = makeSun(theme);
  scene.add(env.sun);
  env.sky = makeSky(theme);
  scene.add(env.sky);
  env.gravelTexture = makeGravel(theme);
  // The shared white material carries the gravel: the floor tiles and the painted toys both use it.
  kit.mat('#ffffff').map = env.gravelTexture;
  env.static = new T.Group();
  scene.add(env.static);
  env.yardGroup = new T.Group();
  scene.add(env.yardGroup);
  // The ground around the yard is four slabs rather than one big one, so nothing sits above the floor tiles' footprint
  // and a pit's dark floor (0.9 m down) is not hidden by the lawn.
  for (const [x, z, w, d] of [
    [0, -70.5, 250, 109],
    [0, 70.5, 250, 109],
    [-70.5, 0, 109, 32],
    [70.5, 0, 109, 32],
  ]) {
    kit.box(env.static, x, -1.3, z, w, 1, d, theme.ground);
  }
  for (let x = -TILE.half; x <= TILE.half; x += TILE.size) {
    for (let z = -TILE.half; z <= TILE.half; z += TILE.size) {
      const tile = kit.box(env.yardGroup, x, -0.5, z, 4, 1, 4, (x + z) % 8 === 0 ? theme.tiles[0] : theme.tiles[1]);
      tile.name = `tile:${x}:${z}`;
    }
  }
  for (const feature of theme.features) FEATURES[feature](env.static, kit, theme[feature]);
  makeSign(env, kit, theme.sign);
  kit.batch(env.static);
  batchFloor(env, kit);
  return env;
}

/** The single shadow-casting light. Its shadow box covers the whole working area (the tier sets its size and the map). */
function makeSun(theme) {
  const sun = new T.DirectionalLight(theme.sun.color, theme.sun.intensity);
  sun.position.set(...theme.sun.position);
  sun.castShadow = true;
  sun.shadow.mapSize.set(BUDGET.shadowMap, BUDGET.shadowMap);
  // A phone's smaller shadow map covers a tighter box (the working area plus its margin) to keep the texels small.
  const r = TIER.shadowRange;
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 80 });
  sun.shadow.normalBias = 0.08;
  sun.shadow.bias = -0.0006;
  return sun;
}

/** A large inside-out sphere with a vertical gradient from the horizon color to the zenith color. */
function makeSky(theme) {
  return new T.Mesh(
    new T.SphereGeometry(120, 24, 12),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: { top: { value: new T.Color(theme.sky.top) }, bottom: { value: new T.Color(theme.sky.bottom) } },
      vertexShader:
        'varying float h; void main(){h=position.y/120.0;' +
        'gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:
        'varying float h;uniform vec3 top;uniform vec3 bottom;' +
        'void main(){gl_FragColor=vec4(mix(bottom,top,smoothstep(-0.1,0.7,h)),1.0);}',
    }),
  );
}

/** A small tiling gravel texture, speckled with a fixed pattern so every visit looks the same. */
function makeGravel(theme) {
  const texture = canvasTexture(128, 128, (gc) => {
    gc.fillStyle = theme.gravel.base;
    gc.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1900; i++) {
      const x = (i * 73) % 128,
        y = (i * 47 + Math.floor(i / 128) * 23) % 128;
      gc.fillStyle = i % 3 ? theme.gravel.dark : theme.gravel.light;
      gc.fillRect(x, y, i % 4 === 0 ? 2 : 1, 1);
    }
  });
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(3, 3);
  return texture;
}

/** The scenery builders a theme can list, each adding meshes to the static group from its own palette entry. */
const FEATURES = {
  /** A service road down the west side with dashed centre lines. */
  road(group, kit, c) {
    kit.box(group, -23, -0.11, 2, 8, 0.18, 150, c.surface);
    for (let z = -60; z < 65; z += 7) kit.box(group, -23, 0.005, z, 0.15, 0.025, 2.4, c.line);
  },

  /** The steel perimeter: posts every 2.8 m and two rails, with a gate gap on the south side. */
  fence(group, kit, c) {
    for (let i = -16; i <= 16; i += 2.8) {
      for (const side of [-1, 1]) {
        kit.box(group, i, 0.95, side * 17, 0.19, 1.9, 0.19, c.post);
        kit.box(group, side * 17, 0.95, i, 0.19, 1.9, 0.19, c.post);
      }
      for (const y of [0.55, 1.25]) {
        kit.box(group, i, y, -17, 2.8, 0.18, 0.12, c.rail);
        kit.box(group, 17, y, i, 0.12, 0.18, 2.8, c.rail);
        if (i > 0 || i < -6) kit.box(group, i, y, 17, 2.8, 0.18, 0.12, c.rail);
      }
    }
  },

  /** A corrugated workshop north of the fence, with two roller doors. */
  workshop(group, kit, c) {
    kit.box(group, 4, 2.3, -23, 16, 4.6, 6, c.wall);
    kit.box(group, 4, 4.8, -23, 17, 0.45, 7, c.roof);
    for (const x of [-1, 6]) {
      kit.box(group, x, 1.9, -19.95, 4.8, 3.8, 0.1, c.door);
      for (let y = 0.45; y < 3.8; y += 0.45) kit.box(group, x, y, -19.85, 4.5, 0.04, 0.04, c.slat);
    }
    for (let x = -3.8; x < 12; x += 0.55) kit.box(group, x, 2.3, -19.91, 0.06, 4.5, 0.09, c.rib);
  },

  /** The striped spawn bay where tray materials arrive, and its painted lane lines. */
  bay(group, kit, c) {
    for (let i = 0; i < 15; i++) {
      kit.box(group, -10 + i * 0.43, 0.018, 9.7, 0.2, 0.025, 1.2, i % 2 ? c.dark : c.light, -0.55);
    }
    for (const x of [-12, -4]) kit.box(group, x, 0.02, 10, 0.12, 0.04, 4, c.lane);
    kit.box(group, -8, 0.025, 12, 8, 0.04, 0.12, c.lane);
  },

  /** Three ribbed shipping containers east of the fence. */
  containers(group, kit, c) {
    for (let i = 0; i < 3; i++) {
      kit.box(group, 18.5, 1.25, -12 + i * 3.2, 2.5, 2.5, 2.8, c.body);
      for (let z = -13.3 + i * 3.2; z < -10.7 + i * 3.2; z += 0.32) {
        kit.box(group, 17.22, 1.25, z, 0.05, 2.4, 0.065, c.rib);
      }
    }
  },

  /** A small site office beside the workshop. */
  shed(group, kit, c) {
    kit.box(group, 12, 1.5, -20, 2, 3, 3, c.wall);
    kit.box(group, 12, 3.1, -20, 2.3, 0.2, 3.3, c.roof);
    kit.box(group, 12, 1.9, -18.45, 0.8, 1, 0.08, c.window);
  },

  /** Low-poly trees on a golden-angle ring outside the fence. */
  trees(group, kit, c) {
    for (let i = 0; i < c.count; i++) {
      const a = i * 2.399,
        r = 24 + (i % 5) * 3;
      tree(group, kit, c, Math.sin(a) * r, Math.cos(a) * r, 0.8 + (i % 3) * 0.18);
    }
  },

  /** Flattened green hills along the northern horizon. */
  hills(group, kit, c) {
    for (let i = 0; i < c.count; i++) {
      const m = kit.ball(group, -50 + i * 14, 2, -60, 16 + (i % 3) * 5, c.colors[i % 3]);
      m.scale.y = 0.5;
      m.scale.z = 0.6;
    }
  },

  /** Traffic cones on rubber bases at the yard's corners. */
  cones(group, kit, c) {
    for (const [x, z] of c.spots) {
      kit.box(group, x, 0.08, z, 0.9, 0.16, 0.9, c.base);
      const cone = new T.Mesh(new T.ConeGeometry(0.32, 1, 8), kit.mat(c.cone));
      cone.position.set(x, 0.64, z);
      cone.castShadow = true;
      group.add(cone);
      kit.cylinder(group, x, 0.7, z, 0.23, 0.17, c.cap);
    }
  },

  /** Deterministic small stones outside the maneuvering lanes. */
  stones(group, kit, c) {
    for (let i = 0; i < c.count; i++) {
      const a = i * 1.67,
        x = Math.sin(a) * (18 + (i % 8)),
        z = Math.cos(a) * (18 + (i % 6));
      kit.ball(group, x, 0.12, z, 0.16 + (i % 3) * 0.09, c.color);
    }
  },

  /** A steel pallet rack behind the north fence: blue uprights, orange load beams and three shelves of pallets with a
   *  few crates, so the spare stock reads as scenery rather than a toy in the yard. */
  rack(group, kit, c) {
    const { x, z, bays, bayWidth } = c,
      length = bays * bayWidth,
      left = x - length / 2;
    for (let i = 0; i <= bays; i++) {
      for (const dz of [-0.7, 0.7]) kit.box(group, left + i * bayWidth, 1.75, z + dz, 0.14, 3.5, 0.14, c.post);
    }
    for (const y of [1.05, 2.15, 3.25]) {
      for (const dz of [-0.7, 0.7]) kit.box(group, x, y, z + dz, length, 0.16, 0.1, c.beam);
    }
    for (let b = 0; b < bays; b++) {
      const bx = left + (b + 0.5) * bayWidth;
      for (const [k, y] of [0.14, 1.205, 2.305].entries()) {
        kit.box(group, bx, y, z, bayWidth - 0.4, 0.14, 1.2, c.wood);
        if ((b + k) % 2 === 0) kit.box(group, bx, y + 0.5, z, bayWidth - 0.9, 0.86, 0.95, c.crate);
      }
    }
  },
};

/** One tree: a trunk and three leaf balls, its green picked from the palette by position. */
function tree(group, kit, c, x, z, s = 1) {
  const p = new T.Group();
  p.position.set(x, 0, z);
  group.add(p);
  kit.cylinder(p, 0, 0.9 * s, 0, 0.18 * s, 1.8 * s, c.trunk);
  const leaves = [
    [0, 2.4, 0, 1.2],
    [-0.65, 2.1, 0.1, 0.8],
    [0.6, 2.6, 0, 0.8],
  ];
  for (const [a, b, d, r] of leaves) {
    kit.ball(p, a * s, b * s, d * s, r * s, c.leaves[Math.floor((x + z + 100) % 3)]);
  }
}

/** The site sign on two posts, with its name painted on a canvas texture. */
function makeSign(env, kit, c) {
  env.sign = new T.Group();
  env.static.add(env.sign);
  kit.box(env.sign, -12, 1.5, -15, 0.18, 3, 0.18, c.post);
  kit.box(env.sign, -8, 1.5, -15, 0.18, 3, 0.18, c.post);
  kit.box(env.sign, -10, 2.7, -15, 5, 1.5, 0.2, c.board);
  const texture = canvasTexture(512, 128, (ctx) => {
    ctx.fillStyle = c.board;
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = c.ink;
    ctx.font = '900 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.text, 256, 83);
  });
  const label = new T.Mesh(new T.PlaneGeometry(4.6, 1.15), new T.MeshBasicMaterial({ map: texture }));
  label.position.set(-10, 2.7, -14.88);
  env.static.add(label);
  env.labelTexture = texture;
}

/** Replaces the individual floor tiles with one instanced mesh, remembering each tile's position and color so
 *  that stamps can lower a tile later. */
function batchFloor(env, kit) {
  env.floorTiles = env.yardGroup.children.map((m) => ({
    x: m.position.x,
    z: m.position.z,
    color: m.material.color.clone(),
  }));
  env.yardGroup.clear();
  env.floorMesh = new T.InstancedMesh(kit.boxGeo, kit.mat('#ffffff'), env.floorTiles.length);
  env.floorMesh.receiveShadow = true;
  env.floorMesh.frustumCulled = false;
  env.floorMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  env.yardGroup.add(env.floorMesh);
  updateFloor(env, kit, []);
}

/** Positions every floor tile, lowering those under a pit or water stamp. */
function updateFloor(env, kit, stamps) {
  const tmp = kit.tmp;
  env.floorTiles.forEach((p, i) => {
    const st = stamps.find((s) => s.x === p.x && s.z === p.z);
    const h = Object.hasOwn(RECESS, st?.kind) ? RECESS[st.kind] : 0;
    tmp.position.set(p.x, h - 0.5, p.z);
    tmp.rotation.set(0, 0, 0);
    tmp.scale.set(4, 1, 4);
    tmp.updateMatrix();
    env.floorMesh.setMatrixAt(i, tmp.matrix);
    env.floorMesh.setColorAt(i, st?.kind === 'pit' ? kit.color.set(env.theme.stamps.pitFloor) : p.color);
  });
  env.floorMesh.instanceMatrix.needsUpdate = true;
  env.floorMesh.instanceColor.needsUpdate = true;
}

/** The mound's mesh: a lathe of the same profile the physics hull is built from (terrain.mjs), flat shaded. Built once
 *  per round and freed by the scene with the round. */
function hillGeometry(env) {
  if (!env.hillGeo) {
    const profile = hillProfile().map(({ r, y }) => new T.Vector2(r, y));
    env.hillGeo = new T.LatheGeometry(profile, HILL.sides);
  }
  return env.hillGeo;
}

/** The ramp's mesh: the wedge whose corners the physics hull is built from (terrain.mjs), flat shaded. */
function rampGeometry(env) {
  if (!env.rampGeo) {
    const p = rampPoints(),
      out = [];
    for (const face of RAMP_FACES) for (const i of face) out.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    env.rampGeo = new T.BufferGeometry();
    env.rampGeo.setAttribute('position', new T.Float32BufferAttribute(out, 3));
    env.rampGeo.computeVertexNormals();
  }
  return env.rampGeo;
}

/** Redraws the terrain stamps into stampGroup. A hill is a low earth mound; a pit is a dark floor 0.9 m down inside
 *  dark walls with a raised amber rim around its opening; water is a shallow bed with a blue surface and sandy banks;
 *  a ramp is a wedge. Each matches its collider in physics.mjs. */
export function syncStamps(env, kit, stampGroup, stamps) {
  const c = env.theme.stamps;
  stampGroup.clear();
  updateFloor(env, kit, stamps);
  for (const s of stamps) {
    if (s.kind === 'pit' || s.kind === 'water') {
      const pit = s.kind === 'pit';
      if (!pit) kit.box(stampGroup, s.x, -0.08, s.z, 3.9, 0.05, 3.9, c.water);
      for (const x of [-1, 1]) {
        kit.box(stampGroup, s.x + x * 1.96, -0.45, s.z, 0.08, 0.9, 4, pit ? c.pitWall : c.bank);
        kit.box(stampGroup, s.x, -0.45, s.z + x * 1.96, 4, 0.9, 0.08, pit ? c.pitWall : c.bank);
        if (pit) {
          // The rim: a low raised frame around the opening, so the hole reads from far away and from above.
          kit.box(stampGroup, s.x + x * 1.87, 0.04, s.z, 0.26, 0.08, 4, c.pitRim);
          kit.box(stampGroup, s.x, 0.04, s.z + x * 1.87, 3.48, 0.08, 0.26, c.pitRim);
        }
      }
    } else if (s.kind === 'hill') {
      const mound = new T.Mesh(hillGeometry(env), kit.mat(c.mound, { flatShading: true }));
      mound.position.set(s.x, 0, s.z);
      mound.castShadow = mound.receiveShadow = true;
      stampGroup.add(mound);
    } else {
      const wedge = new T.Mesh(rampGeometry(env), kit.mat(c.slope, { flatShading: true }));
      wedge.position.set(s.x, 0, s.z);
      wedge.castShadow = wedge.receiveShadow = true;
      stampGroup.add(wedge);
    }
  }
}

/** Sets the daylight (0 night .. 1 day): light intensities, the dusk sun color and the night sky. */
export function applyDaylight(env, n) {
  const d = env.theme.daylight;
  env.sun.intensity = d.sun.base + n * d.sun.range;
  env.hemi.intensity = d.hemi.base + n * d.hemi.range;
  env.sun.color.set(n < d.dusk ? d.sun.dusk : d.sun.day);
  env.sky.material.uniforms.top.value.set(n < d.night ? d.nightSky.top : env.theme.sky.top);
  env.sky.material.uniforms.bottom.value.set(n < d.night ? d.nightSky.bottom : env.theme.sky.bottom);
}

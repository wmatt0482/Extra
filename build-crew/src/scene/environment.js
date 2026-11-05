// The site around the jobs: sky, fog and lights, the gravel floor tiles, terrain stamps, and the scenery outside the
// working area (road, fence, workshop, loading bay, containers, shed, trees, hills, cones, stones, a pallet rack and
// the site sign). Everything here is built once per page from a site theme object, so a second site (the harbor or
// the hillside in SPEC §3) is a new theme: its palette, its sign and its list of scenery features. Static scenery is
// batched into instanced meshes; only the floor tiles and the stamps change after that.
import * as T from '../../vendor/three.module.js';
import { canvasTexture } from './kit.js';
import { BUDGET, TIER } from './quality.js';
import { HILL as MOUND, RAMP_FACES, RECESS, hillProfile, rampPoints } from '../terrain.mjs';
import { SITES, HARBOR, HILL, hillsideSurface } from '../sites.mjs';

/** The first-flight yard (SPEC §5): gravel, weathered steel and muted greens under a pale industrial sky. */
export const YARD_THEME = {
  id: 'yard',
  floor: 'tiles',
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

/** The daylight slider's lights, shared by the two newer sites with their own dusk colour and night sky. */
const daylight = (dusk, nightSky) => ({
  sun: { base: 0.3, range: 3.5, day: '#fff1dc', dusk },
  hemi: { base: 0.65, range: 1.65 },
  dusk: 0.4,
  night: 0.35,
  nightSky,
});

/** The harbor (SPEC §5 future palette, in the 0.2 industrial direction): a concrete quay under a pale coastal sky, seafoam
 *  water, a slate barge with a rust-orange gunwale, stacked containers in muted rust, teal, olive and slate, and a
 *  rust-orange ship-to-shore crane over the berth. */
export const HARBOR_THEME = {
  id: 'harbor',
  floor: 'quay',
  fog: { color: '#a7bcc2', near: 70, far: 165 },
  hemi: { sky: '#cfe2ea', ground: '#5a6763', intensity: 1.8 },
  sun: { color: '#fff4e3', intensity: 3.2, position: [-17, 30, 11] },
  sky: { top: '#6e9dbb', bottom: '#d4e1e3' },
  daylight: daylight('#e4a99a', { top: '#1f3a5c', bottom: '#8e9aa6' }),
  quay: {
    texture: { base: '#8d928f', dark: '#7d8380', light: '#a1a5a2' },
    joint: '#7d8481',
    line: '#e1b23b',
    kerb: '#c6c9c3',
    wall: '#77807e',
    cap: '#5c6462',
    fender: '#1d2327',
    chain: '#59636a',
    bollard: '#26323b',
    weed: '#3d5a4f',
  },
  water: { color: '#4d8a88', foam: '#d3ebe5', bed: '#2c4646' },
  barge: {
    hull: '#33434e',
    band: '#c5652c',
    deck: '#68665e',
    plate: '#5b5953',
    rim: '#c96a2f',
    bollard: '#1f2930',
    rope: '#b9a37a',
    mark: '#e4e0d2',
  },
  stacks: {
    colors: ['#3e6a77', '#9a4c2d', '#6c785d', '#bf8a32', '#4b5661', '#7d3f37'],
    rib: '#2a3138',
  },
  stsCrane: { steel: '#c5652c', dark: '#26323b', cab: '#d7dcdf', glass: '#2b5168', rail: '#5c6462' },
  warehouse: { wall: '#5f707c', roof: '#2b3e4e', door: '#3a4b55', slat: '#87979f', rib: '#71848f' },
  harborFence: { post: '#64727a', rail: '#4d5a62' },
  lamps: { pole: '#3a4650', head: '#d9dfe1', glow: '#f6efc9' },
  ships: { hull: '#2e3d48', band: '#9a4c2d', house: '#d9ddd8', stack: '#c5652c' },
  breakwater: { rock: '#7b8380', light: '#c94a3a', tower: '#e6e2d8' },
  sign: { text: 'BUILD CREW', sub: 'HARBOR / BERTH 4', post: '#2d3d49', board: '#172531', ink: '#f1b539' },
  features: ['harborFence', 'stacks', 'stsCrane', 'warehouse', 'lamps', 'ships', 'breakwater'],
};

/** The hillside: sage grass, terracotta soil and rock, warm gravel haul roads and amber evening light, with pines on
 *  the hills round the site. */
export const HILLSIDE_THEME = {
  id: 'hillside',
  floor: 'terrain',
  fog: { color: '#c0b598', near: 70, far: 158 },
  hemi: { sky: '#eadbb6', ground: '#6a583c', intensity: 1.7 },
  sun: { color: '#ffd9a2', intensity: 3.4, position: [-21, 25, 9] },
  sky: { top: '#6b8fb0', bottom: '#e8d0a2' },
  daylight: daylight('#e69a6a', { top: '#26375a', bottom: '#a28f86' }),
  terrain: {
    grass: ['#8a9a6b', '#7f9163', '#93a273'],
    grassSlope: ['#a29a62', '#998f5a'],
    gravel: ['#b8a487', '#ae9a7d', '#c2ae90'],
    gravelSlope: ['#a38b6c', '#9b8365'],
    rock: '#a65e3b',
    rockDark: '#8c4c30',
    mud: ['#5d4532', '#56402f'],
    puddle: '#3b3a33',
  },
  hillFence: { post: '#64727a', rail: '#4d5a62' },
  pines: { count: 34, trunk: '#6d5038', leaves: ['#46644a', '#3e5a43', '#566f4f'] },
  farHills: { colors: ['#93a072', '#a7865a', '#8a9a6b'] },
  boulders: { color: '#9a6a4c', dark: '#7e5640' },
  vergePosts: { post: '#e1a531', band: '#1d252b' },
  roadMarkers: { post: '#e8e2cf', band: '#d9612b' },
  cabin: { wall: '#c27a43', roof: '#2b3e4e', window: '#264959', skid: '#3a444c' },
  sign: { text: 'BUILD CREW', sub: 'HILLSIDE / CUT 7', post: '#2d3d49', board: '#172531', ink: '#f1b539' },
  features: ['hillFence', 'pines', 'farHills', 'boulders', 'vergePosts', 'roadMarkers', 'cabin'],
};

/** The theme for each site id (sites.mjs). */
export const THEMES = { yard: YARD_THEME, harbor: HARBOR_THEME, hillside: HILLSIDE_THEME };

/** The floor tile grid: 4 m tiles with centres from -14 to 14, matching physics.mjs. */
const TILE = { half: 14, size: 4 };

/** Builds the lights, sky and scenery into `scene` and returns the parts that change later: the lights and sky (for
 *  daylight), the floor tiles (for stamps) and the textures to dispose. */
export function buildEnvironment(scene, kit, theme = YARD_THEME) {
  // The site builds through its own material cache (the shared geometries stay the kit's), so switching site can free
  // every material, texture and buffer that belonged only to the old one (disposeEnvironment).
  kit = Object.assign(Object.create(kit), { materials: {} });
  const env = { theme, kit, textures: [] };
  env.root = new T.Group();
  env.root.name = `site:${theme.id}`;
  scene.add(env.root);
  env.hemi = new T.HemisphereLight(theme.hemi.sky, theme.hemi.ground, theme.hemi.intensity);
  env.root.add(env.hemi);
  env.sun = makeSun(theme);
  env.root.add(env.sun);
  env.sky = makeSky(theme);
  env.root.add(env.sky);
  env.static = new T.Group();
  env.root.add(env.static);
  env.yardGroup = new T.Group();
  env.root.add(env.yardGroup);
  FLOORS[theme.floor || 'tiles'](env, kit, theme);
  for (const feature of theme.features) FEATURES[feature](env.static, kit, theme[feature], env);
  makeSign(env, kit, theme.sign);
  kit.batch(env.static);
  if ((theme.floor || 'tiles') === 'tiles') batchFloor(env, kit);
  return env;
}

/** The ground each kind of site stands on. */
const FLOORS = {
  /** The yard: the lawn round the outside and the 4 m gravel floor tiles that the sandbox's stamps can lower. */
  tiles(env, kit, theme) {
    env.gravelTexture = makeGravel(theme);
    env.textures.push(env.gravelTexture);
    // The site's white material carries the gravel on the floor tiles.
    kit.mat('#ffffff').map = env.gravelTexture;
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
  },

  /** The harbor: a concrete quay (cast in 4 m bays with joints, a yellow safety line and a kerb along the edge), the
   *  quay wall down into the water with rubber fenders, the water out to the horizon, the moored barge and the piles. */
  quay(env, kit, theme) {
    const c = theme.quay,
      H = HARBOR,
      g = env.static;
    env.concreteTexture = makeGravel({ gravel: c.texture });
    // the same grain as the yard's floor: one 128 px tile every 1.4 m across the whole slab
    env.concreteTexture.repeat.set((120 + H.edge) / 1.4, 240 / 1.4);
    env.textures.push(env.concreteTexture);
    const slab = kit.mat('#ffffff', { roughness: 0.92 });
    slab.map = env.concreteTexture;
    // the quay apron and the land behind it, as one slab with its top at y = 0
    const quay = new T.Mesh(kit.boxGeo, slab);
    quay.position.set((H.edge - 120) / 2, -1.8, 0);
    quay.scale.set(120 + H.edge, 3.6, 240);
    quay.receiveShadow = true;
    g.add(quay);
    // the cast bays' joints and the yellow line along the edge
    for (let x = -14; x < H.edge; x += 4) kit.box(g, x, 0.004, 0, 0.06, 0.012, 34, c.joint);
    for (let z = -16; z <= 16; z += 4) kit.box(g, (H.edge - 18) / 2, 0.004, z, H.edge + 18, 0.012, 0.06, c.joint);
    kit.box(g, H.edge - 1.1, 0.006, 5.25, 0.18, 0.014, 23.5, c.line);
    kit.box(g, H.edge - 1.1, 0.006, -14, 0.18, 0.014, 6, c.line);
    const k = H.kerb;
    kit.box(g, k.x, k.h / 2, (k.z[0] + k.z[1]) / 2, k.w, k.h, k.z[1] - k.z[0], c.kerb);
    // the quay wall's face, its capping beam and the fenders hanging on it
    kit.box(g, H.edge - 0.25, (H.water.bed - 0.4) / 2, 0, 0.5, -H.water.bed + 0.4, 240, c.wall);
    kit.box(g, H.edge + 0.02, -0.15, 0, 0.12, 0.3, 240, c.cap);
    for (let z = -15; z <= 16; z += 3.4) {
      kit.box(g, H.edge + 0.18, -0.75, z, 0.3, 0.9, 0.7, c.fender);
      kit.cylinder(g, H.edge + 0.22, -0.32, z, 0.06, 0.25, c.chain);
    }
    // bollards along the edge (outside the barge's mooring lines they are just street furniture)
    for (const z of [-15.5, -4.5, 1.5, 8.5, 14.5]) {
      kit.cylinder(g, 9.55, 0.3, z, 0.22, 0.6, c.bollard);
      kit.cylinder(g, 9.55, 0.62, z, 0.3, 0.08, c.bollard);
    }
    // the water: one sheet out to the horizon, with foam along the quay wall and the barge's hull
    const water = new T.Mesh(kit.boxGeo, kit.mat(theme.water.color, { roughness: 0.18, metalness: 0.15 }));
    water.position.set(H.edge + 110, H.water.level - 0.05, 0);
    water.scale.set(220, 0.1, 400);
    water.receiveShadow = true;
    g.add(water);
    env.water = water;
    const foam = kit.mat(theme.water.foam, { transparent: true, opacity: 0.45, roughness: 0.6 });
    for (const [x, z, w, d] of [
      [H.edge + 0.45, 0, 0.5, 60],
      [H.barge.x[0] - 0.15, 3, 0.35, 16.6],
      [H.barge.x[1] + 0.15, 3, 0.35, 16.6],
      [13.7, H.barge.z[0] - 0.15, 5.7, 0.35],
      [13.7, H.barge.z[1] + 0.15, 5.7, 0.35],
    ]) {
      const f = new T.Mesh(kit.boxGeo, foam);
      f.position.set(x, H.water.level + 0.005, z);
      f.scale.set(w, 0.02, d);
      g.add(f);
    }
    // the dark harbor bed seen through the shallows by the quay
    kit.box(g, H.edge + 15, H.water.bed - 0.5, 0, 30, 1, 60, theme.water.bed);
    buildBarge(g, kit, theme.barge);
    for (const p of H.piles) {
      kit.box(g, p.x, (H.water.bed - 0.4) / 2 + 0.0, p.z, p.size, -H.water.bed + 0.4, p.size, c.wall);
      kit.box(g, p.x, -0.06, p.z, p.size + 0.12, 0.12, p.size + 0.12, c.cap);
      kit.box(g, p.x, H.water.level + 0.25, p.z, p.size + 0.06, 0.5, p.size + 0.06, c.weed);
    }
  },

  /** The hillside: the same height function the physics heightfield samples (sites.mjs), drawn as one flat-shaded mesh
   *  at the same half-metre cells inside the fence and coarser cells out to the hills. The surface colour comes from the
   *  site's own map: sage grass, warm gravel on the work areas and the haul road, terracotta rock where it is steep, and
   *  dark mud with glossy puddles. */
  terrain(env, kit, theme) {
    const site = SITES.hillside,
      c = theme.terrain,
      inner = HILL.grid.size / 2;
    const geo = terrainGeometry(site, c, -inner, inner, HILL.grid.cell, null);
    const outer = terrainGeometry(site, c, -64, 64, 2, inner);
    for (const g of [geo, outer]) {
      const mesh = new T.Mesh(g, kit.mat('#ffffff', { vertexColors: true, flatShading: true, roughness: 0.95 }));
      mesh.receiveShadow = true;
      mesh.userData.ownGeometry = true;
      env.yardGroup.add(mesh);
    }
    // a skirt down from the fine mesh's rim, so the two grids never show a gap where they meet
    const rim = [];
    for (let i = 0; i < 4; i++) {
      for (let t = -inner; t < inner; t += 1) {
        const p = (u) => (i === 0 ? [u, -inner] : i === 1 ? [inner, u] : i === 2 ? [-u, inner] : [-inner, -u]);
        const [x0, z0] = p(t),
          [x1, z1] = p(t + 1);
        const y0 = site.height(x0, z0),
          y1 = site.height(x1, z1);
        rim.push(x0, y0, z0, x1, y1, z1, x1, y1 - 1.5, z1, x0, y0, z0, x1, y1 - 1.5, z1, x0, y0 - 1.5, z0);
      }
    }
    const skirt = new T.BufferGeometry();
    skirt.setAttribute('position', new T.Float32BufferAttribute(rim, 3));
    skirt.computeVertexNormals();
    const skirtMesh = new T.Mesh(skirt, kit.mat(c.rock, { side: T.DoubleSide }));
    skirtMesh.userData.ownGeometry = true;
    env.yardGroup.add(skirtMesh);
    // puddles: glossy dark water lying in the mud where the ground is flat
    const puddle = kit.mat(c.puddle, { roughness: 0.12, metalness: 0.2 });
    for (const r of HILL.mud) {
      for (let i = 0; i < 7; i++) {
        const x = r.x[0] + 0.8 + (((i * 0.618) % 1) * (r.x[1] - r.x[0] - 1.6)),
          z = r.z[0] + 0.8 + (((i * 0.382 + 0.2) % 1) * (r.z[1] - r.z[0] - 1.6));
        const tilt =
          Math.abs(site.height(x + 0.8, z) - site.height(x - 0.8, z)) +
          Math.abs(site.height(x, z + 0.8) - site.height(x, z - 0.8));
        if (tilt > 0.02) continue;
        const p = new T.Mesh(kit.circleGeo, puddle);
        p.rotation.x = -Math.PI / 2;
        p.position.set(x, site.height(x, z) + 0.012, z);
        p.scale.set(0.5 + (i % 3) * 0.3, 0.35 + (i % 2) * 0.25, 1);
        p.receiveShadow = true;
        env.static.add(p);
      }
    }
  },
};

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

/** The speckle the painted toys wear (the yard's gravel grain, made once per page; every site's toys share it). */
export const toyTexture = () => makeGravel(YARD_THEME);

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

  // ---- The harbor ----

  /** The quay's security fence on the three land sides (the water side is open), with a gate gap to the south. */
  harborFence(group, kit, c) {
    for (let i = -16; i <= 9.6; i += 2.8) {
      for (const side of [-1, 1]) kit.box(group, i, 0.95, side * 17, 0.19, 1.9, 0.19, c.post);
      for (const y of [0.55, 1.25]) {
        kit.box(group, i + 1.4 > 10 ? i + 0.2 : i + 1.4, y, -17, i + 1.4 > 10 ? 0.4 : 2.8, 0.18, 0.12, c.rail);
        if (i > 0 || i < -6) kit.box(group, Math.min(i + 1.4, 9.4), y, 17, 2.8, 0.18, 0.12, c.rail);
      }
    }
    for (let i = -16; i <= 16; i += 2.8) {
      kit.box(group, -17, 0.95, i, 0.19, 1.9, 0.19, c.post);
      for (const y of [0.55, 1.25]) kit.box(group, -17, y, i + 1.4, 0.12, 0.18, 2.8, c.rail);
    }
  },

  /** Stacks of ribbed shipping containers outside the fence to the west and north, two and three high. */
  stacks(group, kit, c) {
    const box = (x, y, z, rot, i) => {
      const color = c.colors[i % c.colors.length];
      const g = new T.Group();
      g.position.set(x, y, z);
      g.rotation.y = rot;
      group.add(g);
      kit.box(g, 0, 1.3, 0, 6.1, 2.6, 2.45, color);
      for (let k = -2.8; k <= 2.8; k += 0.4) kit.box(g, k, 1.3, 1.24, 0.06, 2.45, 0.04, c.rib);
      kit.box(g, 3.06, 1.3, 0, 0.04, 2.5, 2.3, c.rib);
    };
    let i = 0;
    for (const [x0, z0, rows, rot] of [
      [-26, -10, 4, Math.PI / 2],
      [-31, 4, 3, Math.PI / 2],
      [-12, 23, 3, 0],
    ]) {
      // a row of stacks side by side (each container lies along its own length), one to three high
      for (let r = 0; r < rows; r++) {
        const high = 1 + ((i * 7) % 3);
        for (let h = 0; h < high; h++) box(rot ? x0 + r * 2.7 : x0, h * 2.62, rot ? z0 : z0 + r * 2.7, rot, i + h);
        i++;
      }
    }
  },

  /** A rust-orange ship-to-shore crane straddling the quay edge north of the berth, its boom out over the water. */
  stsCrane(group, kit, c) {
    // its four legs stand on the quay (behind the fence's north line), the boom reaches out over the water
    const z0 = 24,
      x0 = 1,
      x1 = 9;
    for (const x of [x0, x1]) {
      for (const z of [z0 - 4, z0 + 4]) kit.box(group, x, 9, z, 0.9, 18, 0.9, c.steel);
      kit.box(group, x, 0.5, z0, 1.4, 1, 10, c.dark);
      // the sill beam between each pair of legs
      kit.box(group, x, 10, z0, 0.7, 0.7, 8.8, c.steel);
    }
    // the portal beam and the boom out over the water, the backreach over the land
    for (const z of [z0 - 4, z0 + 4]) kit.box(group, (x0 + x1) / 2 + 6, 18.4, z, 46, 1.1, 0.8, c.steel);
    for (let x = -11; x <= 32; x += 3.4) kit.box(group, x + (x0 + x1) / 2 - 5, 18.4, z0, 0.3, 0.9, 8, c.steel);
    kit.box(group, (x0 + x1) / 2 + 6, 19, z0, 46, 0.2, 8.8, c.dark);
    // the apex frame, the trolley and its cab
    kit.box(group, x0 + 1, 24, z0, 0.8, 11, 0.8, c.steel);
    kit.box(group, x0 + 1, 29.6, z0, 2.4, 0.6, 2.4, c.dark);
    kit.box(group, 22, 17.3, z0, 3, 1.6, 3.4, c.cab);
    kit.box(group, 22, 17.1, z0 - 1.72, 2.6, 1, 0.05, c.glass);
    kit.box(group, 22, 13, z0, 2.6, 0.5, 2.6, c.dark);
    // the rails it runs on, along the quay north of the fence
    for (const x of [x0, x1]) kit.box(group, x, 0.05, 26, 0.3, 0.1, 17, c.rail);
  },

  /** A long corrugated transit shed behind the quay to the north-west. */
  warehouse(group, kit, c) {
    kit.box(group, -12, 3, -26, 22, 6, 9, c.wall);
    kit.box(group, -12, 6.3, -26, 23, 0.6, 10, c.roof);
    for (const x of [-18, -12, -6]) {
      kit.box(group, x, 2.2, -21.45, 4.2, 4.4, 0.1, c.door);
      for (let y = 0.45; y < 4.4; y += 0.45) kit.box(group, x, y, -21.36, 3.9, 0.04, 0.04, c.slat);
    }
    for (let x = -22.6; x < -1.5; x += 0.6) kit.box(group, x, 3, -21.42, 0.06, 5.9, 0.08, c.rib);
  },

  /** Quay lamp masts along the back of the quay. */
  lamps(group, kit, c) {
    for (const z of [-19, 19]) {
      for (const x of [-10, 2]) {
        kit.cylinder(group, x, 4.5, z, 0.14, 9, c.pole);
        kit.box(group, x + 0.6, 9, z, 1.4, 0.18, 0.5, c.head);
        kit.box(group, x + 0.9, 8.88, z, 0.7, 0.06, 0.36, c.glow);
      }
    }
  },

  /** Two cargo ships at anchor out in the roads, low on the horizon. */
  ships(group, kit, c) {
    for (const [x, z, s] of [
      [70, -40, 1],
      [92, 30, 0.8],
    ]) {
      kit.box(group, x, -0.4, z, 9 * s, 3 * s, 46 * s, c.hull);
      kit.box(group, x, 0.6 * s, z, 9.1 * s, 0.6 * s, 46.2 * s, c.band);
      kit.box(group, x, 3.5 * s, z - 18 * s, 8 * s, 6 * s, 6 * s, c.house);
      kit.box(group, x, 7.5 * s, z - 19 * s, 1.6 * s, 3 * s, 1.6 * s, c.stack);
      for (let k = -12; k <= 12; k += 6) kit.box(group, x, 2.4 * s, z + k * s, 7.6 * s, 2.6 * s, 5 * s, '#4b5661');
    }
  },

  /** The breakwater across the harbor mouth with its light tower. */
  breakwater(group, kit, c) {
    for (let z = -60; z <= -20; z += 4) kit.ball(group, 46 + (z % 8 === 0 ? 1 : 0), -0.6, z, 2.8, c.rock);
    kit.cylinder(group, 46, 3.5, -20, 1.2, 7, c.tower);
    kit.cylinder(group, 46, 6.2, -20, 1.25, 1, c.light);
    kit.cylinder(group, 46, 7.4, -20, 0.8, 1.2, '#2b3e4e');
  },

  // ---- The hillside ----

  /** The site fence, its posts and rails following the ground. */
  hillFence(group, kit, c) {
    const h = SITES.hillside.height;
    for (let i = -16; i <= 16; i += 2.8) {
      for (const side of [-1, 1]) {
        kit.box(group, i, h(i, side * 17) + 0.95, side * 17, 0.19, 1.9, 0.19, c.post);
        kit.box(group, side * 17, h(side * 17, i) + 0.95, i, 0.19, 1.9, 0.19, c.post);
      }
      for (const y of [0.55, 1.25]) {
        for (const side of [-1, 1]) {
          const a = h(i, side * 17),
            b = h(i + 2.8, side * 17);
          if (!(side === -1 && i > -6 && i < 0)) kit.box(group, i + 1.4, (a + b) / 2 + y, side * 17, 2.8, 0.18, 0.12, c.rail);
          const p = h(side * 17, i),
            q = h(side * 17, i + 2.8),
            bar = kit.box(group, side * 17, (p + q) / 2 + y, i + 1.4, 0.12, 0.18, Math.hypot(2.8, q - p), c.rail);
          bar.rotation.x = -Math.atan2(q - p, 2.8);
        }
      }
    }
  },

  /** Pines on the hills round the site: stacked cones in dark sage greens. */
  pines(group, kit, c) {
    const h = SITES.hillside.height;
    for (let i = 0; i < c.count; i++) {
      const a = i * 2.399,
        r = 23 + (i % 6) * 4.5,
        x = Math.sin(a) * r,
        z = Math.cos(a) * r,
        s = 0.9 + (i % 4) * 0.22,
        y = h(x, z);
      kit.cylinder(group, x, y + 0.8 * s, z, 0.2 * s, 1.6 * s, c.trunk);
      for (const [k, [r0, hh]] of [
        [1.6, 2.2],
        [1.2, 1.9],
        [0.75, 1.6],
      ].entries()) {
        const cone = new T.Mesh(kit.coneGeo || (kit.coneGeo = new T.ConeGeometry(1, 1, 7)), kit.mat(c.leaves[(i + k) % 3], { flatShading: true }));
        cone.position.set(x, y + (1.6 + k * 1.15 + hh / 2) * s, z);
        cone.scale.set(r0 * s, hh * s, r0 * s);
        cone.castShadow = true;
        group.add(cone);
      }
    }
  },

  /** Flattened hills on the horizon in sage and terracotta. */
  farHills(group, kit, c) {
    for (let i = 0; i < 12; i++) {
      const a = -1.3 + i * 0.32,
        r = 78 + (i % 3) * 6,
        m = kit.ball(group, Math.sin(a) * r, 2, -Math.cos(a) * r, 18 + (i % 3) * 6, c.colors[i % 3]);
      m.scale.y = 0.55;
    }
    for (let i = 0; i < 6; i++) {
      const m = kit.ball(group, -60 + i * 24, 1, 82, 20, c.colors[(i + 1) % 3]);
      m.scale.y = 0.5;
    }
  },

  /** Terracotta boulders on the rock shoulder and along the ravine. */
  boulders(group, kit, c) {
    const h = SITES.hillside.height;
    for (const [x, z, r] of [
      [14.5, -10, 0.9],
      [15.2, -2, 1.2],
      [14.1, 6, 0.8],
      [15.6, 12, 1.1],
      [3.6, 15.6, 0.7],
      [8.6, 16, 0.9],
      [-15.6, 15.2, 0.8],
      [12.8, -14.8, 0.6],
    ]) {
      const b = kit.ball(group, x, h(x, z) + r * 0.45, z, r, (x + z) % 2 > 0.5 ? c.color : c.dark);
      b.scale.y = 0.7;
    }
  },

  /** Amber marker posts along both sides of the grass verge on the lower yard. */
  vergePosts(group, kit, c) {
    const h = SITES.hillside.height;
    for (const x of [-4.5, -1.5]) {
      for (let z = -15; z <= -4; z += 2.2) {
        kit.box(group, x, h(x, z) + 0.45, z, 0.14, 0.9, 0.14, c.post);
        kit.box(group, x, h(x, z) + 0.7, z, 0.15, 0.12, 0.15, c.band);
      }
    }
  },

  /** White delineator posts with orange bands along both edges of the haul road up the slope. */
  roadMarkers(group, kit, c) {
    const h = SITES.hillside.height;
    for (const x of [-12.3, -3.7]) {
      for (let z = -2.5; z <= 6.5; z += 1.8) {
        kit.box(group, x, h(x, z) + 0.55, z, 0.12, 1.1, 0.12, c.post);
        kit.box(group, x, h(x, z) + 0.92, z, 0.13, 0.14, 0.13, c.band);
      }
    }
  },

  /** A portable site cabin on skids on the terrace beyond the north fence. */
  cabin(group, kit, c) {
    const y = SITES.hillside.height(-6, 21);
    kit.box(group, -6, y + 0.15, 21, 6.4, 0.3, 2.6, c.skid);
    kit.box(group, -6, y + 1.6, 21, 6, 2.6, 2.5, c.wall);
    kit.box(group, -6, y + 3, 21, 6.3, 0.2, 2.8, c.roof);
    for (const x of [-7.8, -4.2]) kit.box(group, x, y + 1.9, 19.74, 1.2, 0.8, 0.05, c.window);
  },
};

/** The moored barge: a slate hull with a rust-orange band riding in the water, a plated steel deck, the low gunwale round
 *  it, bollards at its corners with mooring lines to the quay, and white draught marks. Its sizes are the physics
 *  barge's (sites.mjs HARBOR.barge). */
function buildBarge(group, kit, c) {
  const b = HARBOR.barge,
    W = HARBOR.water,
    cx = (b.x[0] + b.x[1]) / 2,
    cz = (b.z[0] + b.z[1]) / 2,
    w = b.x[1] - b.x[0],
    d = b.z[1] - b.z[0];
  kit.box(group, cx, (b.deck + W.level - 1.6) / 2, cz, w, b.deck - W.level + 1.6, d, c.hull);
  kit.box(group, cx, W.level + 0.45, cz, w + 0.04, 0.22, d + 0.04, c.band);
  kit.box(group, cx, b.deck - 0.02, cz, w - 0.1, 0.04, d - 0.1, c.deck);
  for (let z = b.z[0] + 1; z < b.z[1]; z += 2) kit.box(group, cx, b.deck + 0.004, z, w - 0.8, 0.012, 0.04, c.plate);
  for (const k of [-1, 1]) {
    kit.box(group, cx + (k * (w - b.rimW)) / 2, b.deck + b.rim / 2, cz, b.rimW, b.rim, d, c.rim);
    kit.box(group, cx, b.deck + b.rim / 2, cz + (k * (d - b.rimW)) / 2, w, b.rim, b.rimW, c.rim);
  }
  for (const z of [b.z[0] + 0.8, b.z[1] - 0.8]) {
    kit.cylinder(group, b.x[0] + 0.55, b.deck + b.rim + 0.15, z, 0.16, 0.3, c.bollard);
    // the mooring line from the barge's bollard to the quay's
    const line = kit.box(group, (b.x[0] + 0.55 + 9.55) / 2, 0.15, z, 0.06, 0.06, Math.hypot(b.x[0] + 0.55 - 9.55, 0.5), c.rope);
    line.rotation.y = Math.PI / 2;
  }
  for (let z = b.z[0] + 2; z < b.z[1]; z += 4) kit.box(group, b.x[0] - 0.02, W.level + 0.05, z, 0.02, 0.5, 0.08, c.mark);
}

/** The hillside's ground as a flat-shaded triangle mesh from `from` to `to` (both axes) in `cell` metre squares, leaving
 *  out the inner square of half-width `hole` when given. Each triangle is coloured by the surface at its middle. */
function terrainGeometry(site, c, from, to, cell, hole) {
  const pos = [],
    col = [],
    color = new T.Color(),
    n = Math.round((to - from) / cell);
  // The shade varies in soft 3 m patches (never triangle by triangle), and rock is banded by height like strata.
  const hash = (a, b) => Math.abs((Math.sin(a * 12.9898 + b * 78.233) * 43758.5453) % 1);
  const pick = (x, z) => {
    const s = hillsideSurface(x, z),
      k = Math.floor(hash(Math.floor(x / 3), Math.floor(z / 3)) * 3),
      // the haul slope reads as a slope: its grass is drier and its gravel darker than on the level ground
      e = 0.3,
      sloped = Math.hypot(site.height(x + e, z) - site.height(x - e, z), site.height(x, z + e) - site.height(x, z - e)) / (2 * e) > 0.1;
    if (s === 'mud') return c.mud[k % 2];
    if (s === 'gravel') return sloped ? c.gravelSlope[k % 2] : c.gravel[k];
    if (s === 'rock') return Math.floor(site.height(x, z) * 2.2) % 2 ? c.rock : c.rockDark;
    return sloped ? c.grassSlope[k % 2] : c.grass[k];
  };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x0 = from + i * cell,
        z0 = from + j * cell,
        x1 = x0 + cell,
        z1 = z0 + cell;
      if (hole && x0 >= -hole && x1 <= hole && z0 >= -hole && z1 <= hole) continue;
      const h = site.height;
      // Two triangles per cell, wound so their faces point up.
      for (const tri of [
        [
          [x0, z0],
          [x0, z1],
          [x1, z0],
        ],
        [
          [x1, z0],
          [x0, z1],
          [x1, z1],
        ],
      ]) {
        const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3,
          mz = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        // a slight shade per triangle keeps the faceted look without speckle
        color.set(pick(mx, mz)).multiplyScalar(0.97 + hash(mx, mz) * 0.06);
        for (const [x, z] of tri) {
          pos.push(x, h(x, z), z);
          col.push(color.r, color.g, color.b);
        }
      }
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Frees everything a site built: its lights (and the shadow map), the sky, the static scenery's merged and instanced
 *  meshes and their own geometries, the materials made through the site's own cache, and its textures. The geometries
 *  shared through the kit stay. */
export function disposeEnvironment(scene, env, kit) {
  scene.remove(env.root);
  const shared = new Set([kit.boxGeo, kit.cylGeo, kit.sphereGeo, kit.circleGeo, ...Object.values(kit.cylinders || {})]);
  env.root.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
    if (o.geometry && !shared.has(o.geometry)) o.geometry.dispose();
    if (o.isLight) o.dispose?.();
  });
  env.sky.material.dispose();
  for (const m of Object.values(env.kit.materials)) m.dispose();
  if (Object.hasOwn(env.kit, 'cylinders')) for (const g of Object.values(env.kit.cylinders)) g.dispose();
  if (Object.hasOwn(env.kit, 'coneGeo')) env.kit.coneGeo.dispose();
  for (const t of env.textures) t.dispose();
  env.labelTexture?.dispose();
  env.label?.material.dispose();
  env.label?.geometry.dispose();
}

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
    ctx.textAlign = 'center';
    if (c.sub) {
      // a newer site's sign: the crew's name and, under a rule, the site and its code
      ctx.font = '900 44px sans-serif';
      ctx.fillText(c.text, 256, 56);
      ctx.fillRect(56, 70, 400, 4);
      ctx.fillStyle = '#c6d5df';
      ctx.font = '700 30px monospace';
      ctx.fillText(c.sub, 256, 108);
    } else {
      ctx.font = '900 52px sans-serif';
      ctx.fillText(c.text, 256, 83);
    }
  });
  const label = new T.Mesh(new T.PlaneGeometry(4.6, 1.15), new T.MeshBasicMaterial({ map: texture }));
  label.position.set(-10, 2.7, -14.88);
  env.static.add(label);
  env.labelTexture = texture;
  env.label = label;
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
    env.hillGeo = new T.LatheGeometry(profile, MOUND.sides);
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
  // only the yard's tiled floor takes stamps (the sandbox)
  if (!env.floorMesh) return;
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

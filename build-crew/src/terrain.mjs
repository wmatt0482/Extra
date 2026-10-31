// The shapes of the sandbox's terrain stamps that both layers must agree on: physics.mjs builds colliders from them
// and scene/environment.js draws them, so what a child sees is exactly what a toy or machine meets. Pure numbers, no
// Three.js or Rapier, so the Node tests and the browser read the same data.

/** A hill is a low spherical-cap mound on one 4 m tile: `radius` across at the ground, `height` at the crown, built
 *  from `sides` facets and a few rings so it reads as a rounded earth mound. */
export const HILL = { radius: 2, height: 0.6, sides: 12, rings: [1, 0.74, 0.48, 0.22] };

/** A pit is a 0.9 m deep recess of one tile with a raised rim; the shallow water's bed is 0.3 m down. */
export const RECESS = { pit: -0.9, water: -0.3 };

/** The mound's surface height at distance r from its centre (0 beyond the foot). */
export function hillHeight(r) {
  const { radius: a, height: h } = HILL;
  const sphere = (a * a + h * h) / (2 * h);
  return r >= a ? 0 : Math.max(0, Math.sqrt(sphere * sphere - r * r) - (sphere - h));
}

/** The hill's profile from the foot up to the crown as {r, y} pairs. */
export const hillProfile = () => [
  ...HILL.rings.map((k) => ({ r: k * HILL.radius, y: hillHeight(k * HILL.radius) })),
  { r: 0, y: HILL.height },
];

/** Every vertex of the faceted mound relative to its centre, as a flat [x, y, z, ...] list: a ring per profile entry
 *  and the crown. The drawn mesh (a lathe of the same profile) and the physics convex hull both use these points. */
export function hillPoints() {
  const out = [];
  for (const { r, y } of hillProfile()) {
    if (r === 0) out.push(0, y, 0);
    else {
      for (let i = 0; i < HILL.sides; i++) {
        const a = (i / HILL.sides) * Math.PI * 2;
        out.push(r * Math.sin(a), y, r * Math.cos(a));
      }
    }
  }
  return out;
}

/** A ramp is a wedge on one 4 m tile: flat on the ground at its low edge (z = -2) and `rise` metres tall at its high
 *  edge (z = +2), a straight slope between. */
export const RAMP = { half: 2, rise: 1.8 };

/** The wedge's surface height at local depth dz (-half..half) from the tile centre. */
export const rampHeight = (dz) => ((dz + RAMP.half) / (2 * RAMP.half)) * RAMP.rise;

/** The wedge's six corners relative to the tile centre as a flat [x, y, z, ...] list, shared by the drawn mesh and the
 *  physics convex hull. */
export function rampPoints() {
  const { half: h, rise: r } = RAMP;
  return [-h, 0, -h, h, 0, -h, -h, 0, h, h, 0, h, -h, r, h, h, r, h];
}

/** The wedge's faces as triples of corner indexes into rampPoints(), wound counter-clockwise seen from outside. */
export const RAMP_FACES = [
  [0, 5, 1], [0, 4, 5], // the slope
  [2, 5, 4], [2, 3, 5], // the tall back
  [0, 2, 4], // left side
  [1, 5, 3], // right side
  [0, 3, 2], [0, 1, 3], // underside
];

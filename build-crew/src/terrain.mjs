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

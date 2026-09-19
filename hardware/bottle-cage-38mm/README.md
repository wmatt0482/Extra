# Clamp-on water bottle cage — 38 mm round tube

A bolt-on bottle cage for a bike frame with no bottle bosses. Two printed
halves clamp around a 38 mm tube; the cage is part of the front half. Designed
to print in PETG on a Bambu machine with **no supports**, oriented exactly as
the STLs are exported.

![assembly](img/assembly.png)

| printed parts | section |
|---|---|
| ![parts](img/parts.png) | ![section](img/section.png) |

## What's in here

| File | What it is |
|---|---|
| `bottle_cage_38.scad` | the parametric source — every dimension lives here |
| `stl/bottle_cage_38mm_testring.stl` | **print this first** — 14 mm slice of both clamp halves, ~20 min |
| `stl/bottle_cage_38mm_cage.stl` | main body: front clamp half + cage |
| `stl/bottle_cage_38mm_backplate.stl` | rear clamp half |
| `stl/bottle_cage_38mm_adapter.stl` | alternative: clamp + standard 64 mm bottle bosses, if you'd rather bolt on a shop-bought cage |

You need `cage` + `backplate`, or `adapter` + `backplate`. Not both.

## Hardware

- 4 × **M5 × 25 mm** socket head cap screw (stainless)
- 4 × **M5 nyloc nut** — or plain nuts with threadlocker
- 4 × M5 washer under the bolt heads (spreads load on the plastic)
- A ~45 mm wide strip cut from an old inner tube, as a shim

M5 × 20 mm also works if you skip the shim. The nut pockets are 4.6 mm deep,
so a 5 mm nyloc sits very slightly proud — that's fine, it still can't spin.

## Key dimensions

| | |
|---|---|
| Clamp bore | Ø38.8 mm (for a Ø38.0 tube + shim) |
| Clamp band height | 40 mm of straight tube needed |
| Total tube length needed | ~125 mm clear |
| Bottle bore | Ø77 mm, closed to Ø74 by three internal ribs |
| Cage height | 122 mm |
| Stick-out from tube surface | ~92 mm |
| Cage part | 89 × 83 × 122 mm, 88 cm³ |
| Backplate | 22 × 70 × 40 mm, 19 cm³ |

## Print settings (Bambu Studio, PETG, 0.4 nozzle)

- **Orientation: leave it alone.** The STLs are already oriented so the layers
  run the right way — the clamp's hoop load and the collar's spring action are
  both in-plane, not pulling layers apart.
- **Supports: none.** Every overhang in the model is ≥ 45°. The sloped collar
  underside is a 0.70 mm micro-staircase at ~49°, which bridges fine.
- Layer height **0.2 mm**
- **4 wall loops** (the 3.2 mm cage wall then prints fully solid)
- Top/bottom **5 layers**
- Infill **25–30 % gyroid** — this matters for the clamp band and the web
- Cooling: PETG profile default (low). More cooling = weaker layer bonding.
- **Glue stick on the plate.** PETG bonds hard to bare PEI and can tear the
  coating off. This is the one that bites people.
- Dry the filament if the spool has been open a while.
- Optional: paint the layer seam onto the back of the cage so it isn't sitting
  on the collar tips that flex.

Cage + backplate together are roughly 100 g and somewhere in the 6–8 hour
range at 0.2 mm — that's an estimate, the slicer will tell you properly.

## Assembly

1. Print the **test ring** and check it on the tube. It's a 14 mm slice of the
   real clamp, so if it seats, the full part seats. Cheap insurance against a
   mis-measured or slightly ovalised tube.
2. Print the cage and backplate.
3. Press an M5 nut into each of the four hex pockets in the cage's lugs. They
   are 8.4 mm across flats — snug. A bolt pulled through from the back seats
   them if they're tight.
4. Wrap one layer of inner-tube rubber around the tube where the clamp goes.
   It protects the paint, takes up slop, and is most of what stops the cage
   rotating under load.
5. Cage on the front, backplate on the back, four bolts in from the back with
   washers. Tighten in a cross pattern, evenly — the gap between the halves
   should stay roughly equal top and bottom.
6. **Snug plus about a quarter turn, ~2–3 N·m.** These are plastic lugs; you
   will strip or crush them long before an M5 bolt complains.
7. Check the bottle clears your knee, the crank, and the frame before riding.
8. **Re-check the bolts after the first ride.** PETG creeps under load and the
   first few heat cycles will let the clamp settle.

Loading the bottle: base in through the mouth at mid height, drop it into the
cup, then swing the top in past the collar. It comes out the same way.

## Changing anything

The two numbers worth checking are at the top of `bottle_cage_38.scad`:

```scad
tube_d   = 38.0;   // measure your tube
bottle_d = 74.0;   // measure your bottle
```

The ribs absorb roughly ±1.5 mm of bottle diameter, so anything from about
72.5 to 75.5 mm works without touching a thing. Outside that, change
`bottle_d` and re-export. Install OpenSCAD (free) and:

```bash
openscad -o cage.stl      -D 'part="cage"'      bottle_cage_38.scad
openscad -o backplate.stl -D 'part="backplate"' bottle_cage_38.scad
openscad -o adapter.stl   -D 'part="adapter"'   bottle_cage_38.scad
openscad -o testring.stl  -D 'part="testring"'  bottle_cage_38.scad
```

## The adapter variant

`adapter` replaces the cage with a flat pad carrying the bicycle-standard
64 mm boss spacing, so you can bolt a normal cage to it. The bosses are 4.2 mm
pilot holes 11 mm deep — thread-form them with an M5 bolt or tap them M5.
Use **M5 × 12 to M5 × 15** cage bolts; longer ones will bottom out. It pushes
the cage about 13 mm further off the tube than the integrated version does.

## Design notes

- The clamp is two separate halves rather than a hinged C-clamp, so all the
  bolt load goes into gripping the tube instead of into flexing a plastic
  hinge. The 4 mm gap between the halves never closes.
- The clamp band sits at the bottom of the part so it prints off the plate
  with no overhang, and so the bottle's weight enters the clamp directly
  through the floor rather than through a long cantilever.
- The cage barrel wraps 176°, which is wide enough that the bottle slides in
  sideways without forcing anything. Retention is the 240° cup at the base and
  the 240° sprung collar at the top, which the bottle snaps past. The collar
  wall is thinned to 2.6 mm so it has somewhere to flex.
- The web between the clamp and the cage is generated as a solid block that
  the tube bore and the bottle bore carve back, so it meets both at full
  thickness with no knife edges.
- The 2D clamp cross-section is filleted before extrusion, so the lug roots —
  the highest-stress feature on the part — are radiused rather than sharp.

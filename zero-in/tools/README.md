# tools/

## `ballistics_reference.py`

A line-by-line Python port of the Swift ballistic solver in
`ZeroInCore/Sources/ZeroInCore/Ballistics/` (`DragTables.swift`,
`Atmosphere+Ballistics.swift`, `BallisticSolver.swift`): same G1/G7 tables,
constants, RK4 integrator, zero solve and MPBR search. It is also a comparison
harness against [py-ballisticcalc](https://pypi.org/project/py-ballisticcalc/), an
independent open-source solver.

**If you change the Swift solver, make the same change here and re-run the script.**

### Setup

```sh
python3 -m venv .venv
.venv/bin/pip install py-ballisticcalc      # tested with 3.1.1
```

### Usage

```sh
.venv/bin/python tools/ballistics_reference.py                 # compare; exits 1 on any failure
.venv/bin/python tools/ballistics_reference.py --update-swift  # compare + regenerate test vectors
.venv/bin/python tools/ballistics_reference.py --print-swift   # compare + print the vectors
python3 tools/ballistics_reference.py --port-only              # port's own tables, no dependency
```

`--update-swift` rewrites the block between `// BEGIN GENERATED REFERENCE VECTORS`
and `// END GENERATED REFERENCE VECTORS` in
`ZeroInCore/Tests/ZeroInCoreTests/BallisticsTests.swift`. Each row has `ref*`
values (py-ballisticcalc, checked with the physics tolerances) and `port*` values
(this port, checked tightly so Swift/Python drift is caught).

### What is compared

Standard atmosphere, 100-yd zero, 1.5" sight height unless noted, 0–1000 yd every
100 yd, calm and with a 10 mph 3 o'clock wind:

| Load | BC | MV |
|---|---|---|
| .308 Win 168 gr SMK | G1 0.462 and G7 0.224 | 2650 fps |
| 6.5 Creedmoor 140 gr ELD-M | G7 0.315 | 2710 fps |
| .223 Rem 55 gr FMJ (also 50-yd zero, 2.6" sight height) | G1 0.243 | 3240 fps |
| .22 LR 40 gr (50-yd zero) | G1 0.138 | 1080 fps |
| .300 Win Mag 180 gr | G1 0.507 | 2960 fps |

plus .308 G1 at 10° uphill, at 6000 ft / 40 °F / 24.0 inHg, at 90 °F / 80 % RH, and
with a 10:30 quartering headwind; the zero angle of every case; and MPBR for a 6"
vital zone on the .308.

Tolerances (every range ≤ 800 yd): path within max(0.5 in, 1.5 %), drift within
max(0.5 in, 3 %), velocity within 1 %; zero angle within 1 %; MPBR within 2 % (zero)
and 1.5 % (max range).

Typical agreement is far tighter than that (≤ 0.11 in path at 800 yd for every
centerfire case). The largest differences come from modelling choices that
py-ballisticcalc makes differently:

- py-ballisticcalc varies air density with the bullet's height along the path. ZeroIn
  uses the firing-point atmosphere throughout. This shows up on the 10° uphill case
  (velocity −0.4 % and path 0.3 in at 800 yd) and the .22 LR, which drops ~150 ft by
  800 yd (path −1.5 in of −1860 in).
- py-ballisticcalc interpolates the drag table with PCHIP splines; ZeroIn uses linear
  interpolation (as JBM does).
- py-ballisticcalc computes air density with the CIPM-2007 formula; ZeroIn uses
  ideal-gas moist air (they agree to within 0.05 %).

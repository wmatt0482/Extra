# ZeroIn — build spec (v1)

iOS 17, SwiftUI + SwiftData, no third-party dependencies, iPhone portrait. Bundle id `com.wmatt.zeroin`. The module
API agreement is `docs/CONTRACTS.md`; this file is the product and the math.

## 1. User stories

- As a shooter with a new scope I pick my rifle and load, shoot a group at 25 yd, photograph the target and am told
  exactly how many clicks to dial, so I waste less ammunition.
- As a hunter I want my 100 yd zero checked at 25 yd at the start of the day, without driving to a 100 yd range.
- I want to see what my load does at distance (drop, wind, velocity, energy) for today's conditions, and carry a
  card of it.
- I want the app to use MOA or MIL and yards or meters, whichever I think in.
- I want the sights of every rifle I own remembered, and what I did on each trip to the range.

## 2. Screens

Tabs: **Range · Library · Ballistics · Settings** (`RootView`, SF Symbols `scope`, `books.vertical`,
`chart.line.uptrend.xyaxis`, `gearshape`). Each tab owns its `NavigationStack`.

1. **Range** (`RangeHomeView`): sessions for the active profile; start a session at a distance with conditions;
   photograph or pick a target; calibrate; mark the point of aim; mark holes (Vision-assisted suggestions the
   shooter confirms); review stats and correction; save a `ShotGroupRecord`; mark the correction applied.
2. **Library** (`LibraryView`): `@Query` list of `RifleProfile`; create wizard (firearm from catalog or custom,
   ammo for that caliber or custom, scope: click value and unit, sight height, zero range, name); edit, duplicate,
   delete; `ProfilePicker(selection:)` for other tabs.
3. **Ballistics** (`BallisticsView`):
   - Header: active profile (`@AppStorage("activeProfileID")` resolved through `@Query`), a button that opens
     `ProfilePicker` in a sheet, the load line "168 gr · G1 0.462 · 2650 fps · zero 100 yd". No profiles: a message
     pointing to Library.
   - Conditions: altitude (ft), temperature (°F), station pressure (inHg), humidity (%), wind speed (mph),
     wind direction (12-button clock, default 3 o'clock, plus a 0 to 359 degree field), inclination (degrees).
     Persisted as JSON `ShotConditions` in `@AppStorage("ballisticsConditions")`. "Use standard" resets the
     atmosphere. Shows air density ratio and speed of sound.
   - Zero: launch angle in the chosen angular unit; expected impact at 25 / 50 / 100 / 200 yd ("0.6 in low");
     max point-blank range for a 4 / 6 / 8 / 10 in vital zone with the suggested zero range.
   - DOPE table: max range 300 / 500 / 800 / 1000 / 1200 or custom, step 10 / 25 / 50 / 100 (in the display
     distance unit). Columns: range, path, come-up (angle / whole clicks on the profile's scope), wind drift
     (linear L/R and angle), velocity, energy, time. The first row below Mach 1.2 is shaded.
   - Range card: plain text via `ShareLink`.
4. **Settings** (`SettingsView`): angular, distance and linear units; default sight-in distance; default click
   value for new profiles; about (version from the bundle); how corrections are signed.

## 3. Sight-in math

Target space: inches from the point of aim (POA), +x right, +y up. For a group of shots `sᵢ`:

```
center   = mean(sᵢ)
expected = where a correctly zeroed rifle prints at the shooting distance (0,0 when shooting AT the zero range)
error    = expected − center                  inches, target space
angular  = error / (unit.inchesPer100yd × distanceYards / 100)
clicks   = round(angular / clickValue)        in the scope's click unit
```

`Correction.elevation = angular.y` (+ = UP) and `Correction.windage = angular.x` (+ = RIGHT). The residual after
whole clicks is shown so the shooter can see what is left.

**Worked example.** 100 yd, quarter-MOA scope, 5 shots whose center is 2.0 in low and 1.0 in left of the POA,
`center = (−1.0, −2.0)`, `expected = (0, 0)`:

```
error = (0, 0) − (−1.0, −2.0) = (+1.0, +2.0)
1 MOA at 100 yd = 1.047 in
elevation = 2.0 / 1.047 = 1.91 MOA  →  1.91 / 0.25 = 7.64  →  8 clicks UP
windage   = 1.0 / 1.047 = 0.96 MOA  →  0.96 / 0.25 = 3.82  →  4 clicks RIGHT
```

Whole clicks dial 2.00 MOA and 1.00 MOA, overshooting the exact answer by 0.09 MOA up and 0.04 MOA right (the
residual the review screen shows). Inches scale with distance: the same 2.0 in miss at 50 yd is 3.82 MOA, so it
takes about 15 clicks.

Angular units (1 unit at 100 yd): MOA 1.0472 in, MIL 3.6 in, IPHY 1.000 in. Conversions between them are exact
through inches-at-100-yd.

## 4. Sighting in at a distance other than the zero range

A rifle zeroed at 100 yd does not generally print on the POA at 25 yd. The bore is angled up through the line of
sight, so the path crosses it near the muzzle (the near zero) and again at the zero range, and the sight sits above
the bore. Depending on sight height and load, a 25 yd group lands a fraction of an inch high or low of the POA
(for example 0.6 in low on a tall AR-style sight height). The expected impact is not zero, and correcting a 25 yd
group onto the bullseye would ruin the 100 yd zero.

`BallisticSolver.expectedImpact(atYards:)` returns where the bullet should print at the session distance for the
profile's zero range and the session's conditions: `x` from wind, `y` from the path. The Range tab passes it as
`expectedImpact` to `GroupAnalyzer.correction`, which moves the group center onto *that* point instead of the POA.
The review screen says so: "Zeroing at 100 yd from 25 yd: bullets should print 0.6 in low". Wind at the sight-in
distance is usually small; the expected `x` is included so the correction still holds in a crosswind.

The Ballistics tab shows the same expected impacts at 25 / 50 / 100 / 200 yd so a shooter can plan a short-range
sight-in before the trip. Always finish with a group at the real zero range.

## 5. Ballistics model

- 3-DOF point-mass in a frame with x downrange along the line of sight, y up, z right. Gravity 32.174 ft/s²,
  with the inclination angle cos-scaling the gravity component.
- Drag from the standard G1 or G7 tables (Cd versus Mach, linearly interpolated); retardation scales with
  `1/BC` (lb/in²) and the air density ratio. Integrated with RK4 at about 0.5 yd steps.
- Atmosphere: station pressure, temperature and humidity give density (vapor-pressure correction) and speed of
  sound. `Atmosphere.standard` is the ICAO sea-level standard (59 °F, 29.92 inHg, dry).
- Wind by integrating velocity relative to the air mass. Direction is where the wind blows *from*, clockwise from
  the line of fire: 0 headwind, 90 from the right (3 o'clock), 180 tailwind, 270 from the left. A wind from the
  right pushes the bullet left (negative `windageInches`).
- The zero is always solved in calm air; wind is applied only to the trajectory.
- Line of sight starts at (0, −sightHeight); the bullet starts at (0, 0) with the zero launch angle above the line
  of sight.
- Come-up for a row is `−path` converted to the chosen angular unit; wind hold is `−windage`. Clicks are
  converted to the scope's own unit first, then rounded.
- Validated against `py-ballisticcalc` via `tools/ballistics_reference.py`: 2 % on drop and 0.5 in on drift at
  500 yd.
- Not modeled in v1: Coriolis, spin drift, aerodynamic jump, BC varying with velocity (use a G7 BC where one is
  published).

The Ballistics tab runs the solver off the main actor (`Task.detached`) in a small `@Observable` model that
recomputes when the profile, conditions, range, step or vital zone change, and drops stale results.

## 6. Data model (SwiftData, `ZeroIn/Persistence/Models.swift`)

```
RifleProfile ──cascade──▶ SightInSession ──cascade──▶ ShotGroupRecord
```

- `RifleProfile`: name, firearm (name, catalog id, caliber, barrel length, twist, category), load (ammo name,
  weight, diameter, BC, drag model, muzzle velocity), sight (height, click value and unit, zero range), zero
  confirmed flag and date, notes. Catalog picks are copied in, not referenced.
- `SightInSession`: date, distance, flat conditions (altitude, temperature, pressure, humidity, wind), notes.
- `ShotGroupRecord`: shots (JSON `[Point2D]`), expected impact, optional target photo file name, cached stats,
  the correction and whether it was applied.
- Enums are stored as raw strings. Target photos live in `Documents/Targets` (`TargetImageStore`).
- Preferences are `UserDefaults` via `@AppStorage`; keys are in `AppSettings` (`angularUnit`, `distanceUnit`,
  `linearUnit`, `activeProfileID`, `defaultSightInDistance`, `defaultClickValue`, `ballisticsConditions`,
  `ballisticsMaxRange`, `ballisticsStep`, `ballisticsVitalZone`).
- If the on-disk store cannot be opened the app falls back to an in-memory store and shows a banner saying
  changes will not be kept.

## 7. Non-goals (v1)

- No cloud, accounts or analytics; nothing is uploaded.
- No ballistic-solver extras: no Coriolis, spin drift, custom drag curves or multi-BC.
- No live rangefinder, scope or chronograph integration.
- No target shooting scoring or competition features; no shotgun pattern analysis.
- No iPad or landscape layouts; no Android.
- Not a substitute for confirming zero on paper at the real range.

## 8. Roadmap

1. Coriolis and spin drift (needs latitude, azimuth and twist, which the profile already stores).
2. Import from Bluetooth chronographs (muzzle velocity strings) and weather meters (Kestrel-class) into profile
   and conditions.
3. iCloud sync of profiles and sessions (SwiftData CloudKit).
4. Apple Watch: today's come-up card, and a haptic click counter while dialing.
5. Per-load velocity versus temperature table; custom BC-versus-velocity curves.

## 9. Project and build

`project.yml` (XcodeGen 2.4x) is the source of truth; the committed `ZeroIn.xcodeproj` is the same project written
by hand in Xcode 16 format (`PBXFileSystemSynchronizedRootGroup` for `ZeroIn/`, a local package reference to
`ZeroInCore`). Deployment target iOS 17.0, iPhone only, portrait. Info.plist is generated (`INFOPLIST_KEY_*`):
camera and photo-library usage strings, launch screen, scene manifest. Core tests: `cd ZeroInCore && swift test`.

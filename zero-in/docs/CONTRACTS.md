# ZeroIn — module contracts

Four workstreams build this app in parallel. This file is the agreement
between them: the exact public API each module exposes. **Implement these
signatures exactly; consume them exactly.** If you must change one, say so in
your final report so the integrator can reconcile.

Already written (do not re-create, do read them):

| File | Contents |
|---|---|
| `ZeroInCore/Package.swift` | SPM package, iOS 17 / macOS 14, no deps |
| `ZeroInCore/Sources/ZeroInCore/Units/Units.swift` | `AngularUnit`, `DistanceUnit`, `LinearUnit`, `Angular`, `Conversions` |
| `ZeroInCore/Sources/ZeroInCore/Units/Scope.swift` | `ScopeSpec`, `Correction`, `TurretDirection` |
| `ZeroInCore/Sources/ZeroInCore/Ballistics/BallisticTypes.swift` | `DragModel`, `Projectile`, `Atmosphere`, `WindCondition`, `ShotConditions`, `TrajectoryPoint` |
| `ZeroInCore/Sources/ZeroInCore/GroupAnalysis/Point2D.swift` | `Point2D` |
| `ZeroInCore/Sources/ZeroInCore/Catalog/CatalogTypes.swift` | `Catalog`, `CatalogCaliber`, `CatalogFirearm`, `CatalogAmmo`, `CatalogTarget`, `FirearmCategory` |
| `ZeroIn/Persistence/Models.swift` | SwiftData `RifleProfile`, `SightInSession`, `ShotGroupRecord` |

Sign conventions (everywhere):

- Target space: inches relative to point of aim (POA). **+x = shooter's right, +y = up.**
- Image space: pixels, +y down.
- `Correction`: **+elevation = dial UP, +windage = dial RIGHT** (turret labels).
  A group that hits low-left produces a positive elevation and positive windage correction.
- `TrajectoryPoint.pathInches`: bullet height vs. line of sight, **negative = below**.
- `TrajectoryPoint.windageInches`: **+ = pushed right**. A wind from 3 o'clock (90°) gives negative windage.
- Internal math is always yards / inches / fps / °F / inHg. UI converts for display.

---

## 1. Ballistics (`ZeroInCore/Sources/ZeroInCore/Ballistics/`) — workstream A

```swift
/// Standard drag tables. Cd as a function of Mach, linearly interpolated.
public enum DragTables {
    public static func dragCoefficient(_ model: DragModel, mach: Double) -> Double
}

public extension Atmosphere {
    /// Air density ratio vs ICAO sea-level standard (1.0 at .standard).
    var densityRatio: Double { get }
    /// Local speed of sound, fps (≈1116.45 at .standard).
    var speedOfSoundFPS: Double { get }
}

/// 3-DOF point-mass solver. Immutable after init; cheap to create.
public struct BallisticSolver {
    public let projectile: Projectile
    public let scope: ScopeSpec
    public let conditions: ShotConditions

    public init(projectile: Projectile, scope: ScopeSpec, conditions: ShotConditions = .standard)

    /// Launch angle above the line of sight (radians) that zeros the rifle at
    /// `scope.zeroRangeYards` in `conditions` with NO wind (zero is always
    /// solved in calm air; wind is applied only to the trajectory).
    public func zeroAngleRadians() -> Double

    /// Trajectory rows from 0 to `maxRangeYards` inclusive, every `stepYards`.
    /// Stops early if the bullet falls below -5000 in or velocity < 100 fps.
    public func trajectory(maxRangeYards: Double, stepYards: Double) -> [TrajectoryPoint]

    /// Single row at an arbitrary range (interpolated from a fine internal step).
    public func point(atYards yards: Double) -> TrajectoryPoint

    /// Maximum point-blank range for a vital zone of the given diameter:
    /// the zero range and far range at which the path stays within ±vital/2.
    public func maxPointBlankRange(vitalZoneInches: Double) -> (zeroRangeYards: Double, maxRangeYards: Double)

    /// Where the bullet should print at `yards` when the scope is zeroed at
    /// `scope.zeroRangeYards` — the "expected impact" for a 25-yd sight-in of a
    /// 100-yd zero. Returns target-space inches (x from wind, y from path).
    public func expectedImpact(atYards yards: Double) -> Point2D
}
```

Implementation notes for workstream A:

- Integrate with RK4 (or a small fixed step, ≤ 0.5 yd equivalent) in a frame where
  x is downrange along the line of sight, y is up, z is right. Gravity 32.174 ft/s²,
  applied with inclination (cos component along y).
- Retardation uses the standard G-function approach: BC in lb/in² scales the
  standard projectile's drag; density ratio from `Atmosphere` scales it further.
  Speed of sound from temperature (and humidity, small effect).
- Humidity affects density slightly (use the standard vapor-pressure correction);
  it is fine to approximate but document it.
- Wind: crosswind drift via the classic lag formula or by integrating relative
  velocity; headwind/tailwind via relative velocity. Integrating relative velocity
  is preferred.
- Line of sight starts at (0, -sightHeight) relative to the bore; the bullet
  starts at (0, 0) with the launch angle above the LOS.
- Validate against a Python reference (see `tools/`): drop and drift for several
  known loads must match `py-ballisticcalc` within 2% / 0.5 in at 500 yd.

## 2. Group analysis (`ZeroInCore/Sources/ZeroInCore/GroupAnalysis/`) — workstream B

```swift
public struct GroupStats: Codable, Hashable, Sendable {
    public var shotCount: Int
    /// Mean point of impact, target inches from POA.
    public var center: Point2D
    /// Center-to-center distance of the two farthest shots, inches.
    public var extremeSpreadInches: Double
    /// Mean distance of shots from `center`, inches.
    public var meanRadiusInches: Double
    public var horizontalSpreadInches: Double   // max x - min x
    public var verticalSpreadInches: Double     // max y - min y
    public var radialStdDevInches: Double       // std dev of distances from center

    public func extremeSpread(in unit: AngularUnit, atYards: Double) -> Double
    public func meanRadius(in unit: AngularUnit, atYards: Double) -> Double
}

public enum GroupAnalyzer {
    /// nil when `shots` is empty. A single shot has zero spread.
    public static func stats(_ shots: [Point2D]) -> GroupStats?

    /// Turret correction that moves `groupCenter` onto `expectedImpact`.
    /// +elevation = UP, +windage = RIGHT.
    public static func correction(groupCenter: Point2D, expectedImpact: Point2D = .zero,
                                  distanceYards: Double, unit: AngularUnit) -> Correction

    /// Optional outlier flagging: indices of shots farther than
    /// `sigma` radial std devs from the center (never flags when count < 4).
    public static func outliers(_ shots: [Point2D], sigma: Double = 2.5) -> [Int]
}

/// Maps photo pixels to target inches.
public struct TargetCalibration: Codable, Hashable, Sendable {
    /// Two-point scale: `a` and `b` are pixel positions `knownInches` apart;
    /// `poaPixel` is the point of aim. Assumes the photo is square to the target.
    public static func twoPoint(a: Point2D, b: Point2D, knownInches: Double, poaPixel: Point2D) -> TargetCalibration

    /// Four-corner homography: pixel corners of a rectangle of known physical
    /// size, in order top-left, top-right, bottom-right, bottom-left. Corrects
    /// perspective from an off-axis photo.
    public static func fourCorner(corners: [Point2D], widthInches: Double, heightInches: Double,
                                  poaPixel: Point2D) -> TargetCalibration?

    /// Pixel → target inches relative to POA (+y up).
    public func targetPoint(fromPixel p: Point2D) -> Point2D
    /// Target inches → pixel (for drawing overlays).
    public func pixel(fromTargetPoint t: Point2D) -> Point2D
    /// Approximate pixels per inch near the POA (for sizing hole markers).
    public var pixelsPerInch: Double { get }
}

/// 3×3 projective transform, row-major. Used by TargetCalibration; public for tests.
public struct Homography: Codable, Hashable, Sendable {
    public var m: [Double]   // 9 values
    public static func fit(from src: [Point2D], to dst: [Point2D]) -> Homography?  // 4 pairs, DLT
    public func apply(_ p: Point2D) -> Point2D
    public func inverted() -> Homography?
}
```

Workstream B also owns the **Range feature** in the app
(`ZeroIn/Features/Range/`): capture/pick a photo, calibrate, mark the POA,
mark holes (with Vision-assisted auto-detect as a suggestion), review stats +
correction, save a `ShotGroupRecord` to the current `SightInSession`, and let
the shooter mark the correction as applied. Plus
`ZeroIn/Persistence/TargetImageStore.swift`:

```swift
enum TargetImageStore {
    static func save(_ image: UIImage, id: UUID) throws -> String   // returns file name
    static func load(_ fileName: String) -> UIImage?
    static func delete(_ fileName: String)
}
```

## 3. Catalog + Library — workstream C

Owns `ZeroIn/Resources/Catalog/{calibers,firearms,ammo,targets}.json`,
`ZeroIn/Persistence/CatalogStore.swift`, and `ZeroIn/Features/Library/`.

```swift
/// Loads the bundled catalog once. Observable so views can search.
@Observable final class CatalogStore {
    static let shared: CatalogStore
    private(set) var catalog: Catalog     // .empty until loaded; load() is called at init
    func load()
}
```

Library feature: list profiles (`@Query`), create a profile via a wizard
(pick firearm from catalog or enter custom → pick ammo for that caliber or
custom → scope: click value, unit, sight height, zero range → name), edit any
field later, delete, duplicate. Also a `ProfilePicker` view other features can
present to choose the active profile:

```swift
struct ProfilePicker: View {
    @Binding var selection: RifleProfile?
}

struct ProfileEditorView: View {           // sheet; nil profile = create
    init(profile: RifleProfile?)
}
```

Active-profile selection is a UUID string in `@AppStorage("activeProfileID")`.

## 4. App shell, Ballistics UI, Settings, project — workstream D

Owns `ZeroIn/App/`, `ZeroIn/Features/Ballistics/`, `ZeroIn/Features/Settings/`,
`ZeroIn/Assets.xcassets`, `project.yml`, `ZeroIn.xcodeproj`, `README.md`, `SPEC.md`.

```swift
/// User preferences via @AppStorage. Keys are the property names.
struct AppSettings {   // namespace of static keys + helpers
    static let angularUnitKey = "angularUnit"        // AngularUnit raw, default "moa"
    static let distanceUnitKey = "distanceUnit"      // DistanceUnit raw, default "yards"
    static let linearUnitKey = "linearUnit"          // LinearUnit raw, default "inches"
    static let activeProfileIDKey = "activeProfileID"
}

@main struct ZeroInApp: App   // ModelContainer for [RifleProfile, SightInSession, ShotGroupRecord]
struct RootView: View          // TabView: Range · Library · Ballistics · Settings
```

Tabs and their entry views:

| Tab | Entry view | Owner |
|---|---|---|
| Range | `RangeHomeView()` | B |
| Library | `LibraryView()` | C |
| Ballistics | `BallisticsView()` | D |
| Settings | `SettingsView()` | D |

Ballistics tab: pick active profile, edit conditions (atmosphere, wind,
inclination), show zero info (launch angle, MPBR for a chosen vital zone,
expected impact at common sight-in distances 25/50/100/200), and a DOPE table
(range, path in/cm, come-up in the chosen unit + clicks, wind drift for the set
wind, velocity, energy, time) with step and max range controls. Also a compact
"range card" share sheet (text).

## Build

`project.yml` is the source of truth for the Xcode project (XcodeGen). The
committed `ZeroIn.xcodeproj` uses Xcode 16 synchronized folders so new files
need no project edits. Bundle id `com.wmatt.zeroin`, iOS 17.0 deployment target,
camera + photo-library usage strings set via `INFOPLIST_KEY_*` build settings.

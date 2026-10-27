import Foundation

/// 3-DOF point-mass solver. Immutable after init; cheap to create.
///
/// Physics (mirrored line by line in `tools/ballistics_reference.py`, which validates it
/// against py-ballisticcalc):
/// - Frame: x downrange along the line of sight (LOS), y perpendicular to it (up), z to
///   the shooter's right. The bullet leaves the bore at the origin; the LOS runs parallel
///   to x at y = +sight height, so at the muzzle `pathInches == -sightHeightInches`.
/// - Gravity (32.174 ft/s²) is rotated into the LOS frame for the look angle:
///   g = (−g·sin θ, −g·cos θ, 0). No "rifleman's rule" approximation.
/// - Drag: a = −K · densityRatio · Cd(M) · |v_rel| · v_rel / BC, with v_rel the velocity
///   relative to the air mass (wind), M = |v_rel| / speed of sound, Cd from the G1/G7
///   table and K = ρ₀·π / (8·144) for BCs in lb/in² (ρ₀ = 0.0764742 lb/ft³).
/// - Integrator: classic RK4 at a fixed 0.0005 s step; table rows are linear
///   interpolations between steps (error ~1e-6 ft).
/// - Air density and the speed of sound are constant along the path (taken from
///   `conditions.atmosphere`).
public struct BallisticSolver: Sendable {
    public let projectile: Projectile
    public let scope: ScopeSpec
    public let conditions: ShotConditions

    /// Precomputed constants + integrator.
    private let model: FlightModel
    /// Launch angle above the LOS that zeros the rifle (solved once in `init`).
    private let zeroAngle: Double

    /// Creates a solver and solves the zero angle for `scope.zeroRangeYards`
    /// (a handful of short integrations; well under a millisecond for typical zeros).
    public init(projectile: Projectile, scope: ScopeSpec, conditions: ShotConditions = .standard) {
        self.projectile = projectile
        self.scope = scope
        self.conditions = conditions
        let model = FlightModel(projectile: projectile, sightHeightInches: scope.sightHeightInches,
                                conditions: conditions)
        self.model = model
        // The rifle is zeroed on level ground in calm air; the shot's inclination and
        // wind apply only to the trajectory (this is what every shooter actually does).
        let zeroModel: FlightModel
        if conditions.inclinationDegrees == 0 {
            zeroModel = model
        } else {
            let level = ShotConditions(atmosphere: conditions.atmosphere, wind: .calm, inclinationDegrees: 0)
            zeroModel = FlightModel(projectile: projectile, sightHeightInches: scope.sightHeightInches,
                                    conditions: level)
        }
        self.zeroAngle = zeroModel.solveZeroAngle(rangeFeet: scope.zeroRangeYards * 3.0)
    }

    /// Launch angle above the line of sight (radians) that zeros the rifle at
    /// `scope.zeroRangeYards` in this atmosphere on level ground with NO wind
    /// (zero is always solved flat and calm; wind and inclination apply only to the trajectory).
    public func zeroAngleRadians() -> Double {
        zeroAngle
    }

    /// Trajectory rows from 0 to `maxRangeYards` inclusive, every `stepYards`.
    /// Stops early if the bullet falls below -5000 in or velocity < 100 fps.
    /// Rows are interpolated at exactly 0, step, 2·step, …; returns `[]` when
    /// `stepYards` is not a positive finite number or `maxRangeYards < 0`.
    public func trajectory(maxRangeYards: Double, stepYards: Double) -> [TrajectoryPoint] {
        guard stepYards > 0, stepYards.isFinite, maxRangeYards >= 0 else { return [] }
        let samples = model.integrate(angle: zeroAngle, withWind: true, maxRangeFeet: maxRangeYards * 3.0,
                                      minPathFeet: FlightModel.minimumPathInches / 12.0)
        var rows: [TrajectoryPoint] = []
        let count = Int(min(maxRangeYards / stepYards + 1e-9, Double(FlightModel.maxRows)).rounded(.down))
        rows.reserveCapacity(count + 1)
        let lastX = samples[samples.count - 1].x
        for k in 0...count {
            let yards = Double(k) * stepYards
            let x = yards * 3.0
            if x > lastX + 1e-9 {
                break  // trajectory terminated early (too slow / too low)
            }
            rows.append(makePoint(samples, x: x))
        }
        return rows
    }

    /// Single row at an arbitrary range (interpolated from a fine internal step).
    /// Negative ranges are treated as 0; if the bullet stops (velocity < 100 fps or
    /// path below -5000 in) before `yards`, the last computed point is returned.
    public func point(atYards yards: Double) -> TrajectoryPoint {
        let target = yards > 0 ? yards : 0.0  // also maps NaN to 0
        let samples = model.integrate(angle: zeroAngle, withWind: true, maxRangeFeet: target * 3.0,
                                      minPathFeet: FlightModel.minimumPathInches / 12.0)
        let x = min(target * 3.0, samples[samples.count - 1].x)
        return makePoint(samples, x: x)
    }

    /// Maximum point-blank range for a vital zone of the given diameter:
    /// the zero range and far range at which the path stays within ±vital/2.
    ///
    /// Searches the launch angle whose apex is exactly +vital/2 above the LOS (calm air,
    /// same atmosphere / inclination / sight height), then reports where that path
    /// crosses the LOS on the way down (`zeroRangeYards`, the far zero you would sight
    /// in at) and where it falls to −vital/2 (`maxRangeYards`). Returns (0, 0) for a
    /// non-positive vital zone.
    public func maxPointBlankRange(vitalZoneInches: Double) -> (zeroRangeYards: Double, maxRangeYards: Double) {
        guard vitalZoneInches > 0 else { return (0, 0) }
        let halfFeet = vitalZoneInches / 24.0
        let capFeet = 3000.0 * 3.0
        let model = self.model

        func apex(of samples: [FlightModel.Sample]) -> Double {
            var best = -Double.infinity
            for s in samples {
                best = max(best, s.y - model.sightHeightFeet)
            }
            return best
        }
        func run(_ angle: Double) -> [FlightModel.Sample] {
            model.integrate(angle: angle, withWind: false, maxRangeFeet: capFeet, minPathFeet: -halfFeet)
        }

        var lo = 0.0
        let loSamples = run(lo)
        if apex(of: loSamples) >= halfFeet {
            return (0, 0)
        }
        var hi = 0.002
        var hiSamples = run(hi)
        var expansions = 0
        while apex(of: hiSamples) < halfFeet && expansions < 12 {
            lo = hi
            hi *= 2.0
            hiSamples = run(hi)
            expansions += 1
        }
        if apex(of: hiSamples) < halfFeet {
            return (0, 0)  // cannot raise the apex that high (should not happen)
        }

        var bestSamples = hiSamples
        for _ in 0..<60 {
            let mid = 0.5 * (lo + hi)
            let midSamples = run(mid)
            let midApex = apex(of: midSamples)
            if midApex < halfFeet {
                lo = mid
            } else {
                hi = mid
                bestSamples = midSamples
            }
            if abs(midApex - halfFeet) < 1e-7 || hi - lo < 1e-12 {
                bestSamples = midSamples
                break
            }
        }

        let samples = bestSamples
        var apexIndex = 0
        var best = -Double.infinity
        for (i, s) in samples.enumerated() {
            let p = s.y - model.sightHeightFeet
            if p > best {
                best = p
                apexIndex = i
            }
        }
        let zeroX = model.descendingCrossing(samples, from: apexIndex, levelFeet: 0.0)
        let farX = model.descendingCrossing(samples, from: apexIndex, levelFeet: -halfFeet)
        return (zeroX / 3.0, farX / 3.0)
    }

    /// Where the bullet should print at `yards` when the scope is zeroed at
    /// `scope.zeroRangeYards` — the "expected impact" for a 25-yd sight-in of a
    /// 100-yd zero. Returns target-space inches (x from wind, y from path).
    public func expectedImpact(atYards yards: Double) -> Point2D {
        let p = point(atYards: yards)
        return Point2D(x: p.windageInches, y: p.pathInches)
    }

    // MARK: - Internals

    /// Builds a table row from the integrator samples at downrange distance `x` (feet).
    private func makePoint(_ samples: [FlightModel.Sample], x: Double) -> TrajectoryPoint {
        let s = model.interpolate(samples, x: x)
        let path = (s.y - model.sightHeightFeet) * 12.0
        let boreY = s.x * tan(zeroAngle)
        return TrajectoryPoint(
            rangeYards: s.x / 3.0,
            pathInches: path,
            windageInches: s.z * 12.0,
            velocityFPS: s.v,
            energyFtLb: Conversions.energyFtLb(grains: projectile.weightGrains, fps: s.v),
            timeSeconds: s.t,
            mach: s.v / model.speedOfSound,
            dropFromBoreInches: min((s.y - boreY) * 12.0, 0.0)
        )
    }
}

/// The environment-dependent constants and the RK4 integrator behind `BallisticSolver`.
/// Units: feet, seconds, ft/s.
struct FlightModel: Sendable {
    /// One integrator step.
    struct Sample: Sendable {
        var t: Double
        var x: Double
        var y: Double
        var z: Double
        /// Ground speed, fps.
        var v: Double
    }

    static let gravity = 32.174  // ft/s²
    /// Standard retardation constant for BCs in lb/in²:
    /// a = ρ·v²·Cd·A / (2m), A = π d²/4 in² ÷ 144, BC = m/d² (lb/in²)
    /// ⇒ a = (ρ₀·π / (8·144)) · densityRatio · Cd · v² / BC, ρ₀ = 0.0764742 lb/ft³ (ICAO).
    static let standardAirDensity = 0.0764742  // lb/ft³
    static let dragConstant = standardAirDensity * Double.pi / (8.0 * 144.0)  // ≈ 2.08551e-4
    static let timeStep = 0.0005  // s
    static let minimumVelocity = 100.0  // fps
    static let minimumPathInches = -5000.0
    static let maxSteps = 400_000  // 200 s of flight: a hard stop never reached in practice
    static let maxRows = 100_000  // guards `trajectory` against absurd step sizes
    static let fpsPerMPH = 5280.0 / 3600.0
    /// Zero-solve sentinel for "the bullet never got that far".
    static let notReachedPathInches = -1.0e6

    let table: DragTables.Table
    let muzzleVelocity: Double
    let speedOfSound: Double
    /// K · densityRatio / BC, so drag acceleration = dragFactor · Cd · |v_rel| · v_rel.
    let dragFactor: Double
    let gravityX: Double
    let gravityY: Double
    let sightHeightFeet: Double
    /// Air-mass velocity in the LOS frame, fps.
    let windX: Double
    let windY: Double
    let windZ: Double

    init(projectile: Projectile, sightHeightInches: Double, conditions: ShotConditions) {
        table = DragTables.table(for: projectile.dragModel)
        muzzleVelocity = projectile.muzzleVelocityFPS
        let ratio = conditions.atmosphere.densityRatio
        speedOfSound = conditions.atmosphere.speedOfSoundFPS
        let bc = projectile.bc > 0 ? projectile.bc : 1e-6
        dragFactor = FlightModel.dragConstant * ratio / bc
        let look = conditions.inclinationDegrees * Double.pi / 180.0
        let cosLook = cos(look)
        let sinLook = sin(look)
        // Gravity in the line-of-sight frame (x along LOS, y perpendicular up).
        gravityX = -FlightModel.gravity * sinLook
        gravityY = -FlightModel.gravity * cosLook
        sightHeightFeet = sightHeightInches / 12.0
        // The wind blows horizontally (world frame); rotate it into the LOS frame.
        let headFPS = conditions.wind.headwindMPH * FlightModel.fpsPerMPH
        let crossFPS = conditions.wind.crosswindMPH * FlightModel.fpsPerMPH
        let horizontalAir = -headFPS  // a headwind moves the air toward the shooter (−x)
        windX = horizontalAir * cosLook
        windY = -horizontalAir * sinLook
        windZ = -crossFPS  // wind from the right (+cross) moves the air toward −z (left)
    }

    /// Hybrid secant / bisection on the launch angle so that the calm-air path at
    /// `rangeFeet` is zero (to 1e-4 in). Converges in ~4–6 integrations for normal loads.
    func solveZeroAngle(rangeFeet: Double) -> Double {
        guard rangeFeet > 0, muzzleVelocity > FlightModel.minimumVelocity else { return 0 }
        let tolerance = 1e-4  // inches

        var a0 = 0.0
        var f0 = pathAt(angle: a0, rangeFeet: rangeFeet)
        if abs(f0) < tolerance { return a0 }
        var a1 = min(max(-f0 / (rangeFeet * 12.0), -0.5), 0.5)
        var f1 = pathAt(angle: a1, rangeFeet: rangeFeet)
        // Bracket: the highest angle known to print low (f < 0) and the lowest known to print high.
        var negA: Double? = nil
        var posA: Double? = nil
        for _ in 0..<60 {
            if abs(f1) < tolerance { return a1 }
            for (a, fa) in [(a0, f0), (a1, f1)] {
                if fa < 0 {
                    if negA == nil || a > negA! { negA = a }
                } else {
                    if posA == nil || a < posA! { posA = a }
                }
            }
            let denom = f1 - f0
            var a2 = denom != 0 ? a1 - f1 * (a1 - a0) / denom : Double.nan
            if let n = negA, let p = posA {
                let lo = min(n, p)
                let hi = max(n, p)
                if !a2.isFinite || a2 <= lo || a2 >= hi {
                    a2 = 0.5 * (lo + hi)
                }
            } else if !a2.isFinite {
                a2 = a1 + 2.0 * (a1 - a0)
            }
            a2 = min(max(a2, -0.5), 1.0)
            a0 = a1
            f0 = f1
            a1 = a2
            f1 = pathAt(angle: a1, rangeFeet: rangeFeet)
        }
        return a1
    }

    /// Calm-air path (inches) at `rangeFeet` for a launch angle; sentinel if never reached.
    func pathAt(angle: Double, rangeFeet: Double) -> Double {
        let samples = integrate(angle: angle, withWind: false, maxRangeFeet: rangeFeet,
                                minPathFeet: -Double.infinity)
        let last = samples[samples.count - 1]
        if last.x < rangeFeet {
            return FlightModel.notReachedPathInches
        }
        let y = interpolate(samples, x: rangeFeet).y
        return (y - sightHeightFeet) * 12.0
    }

    /// Range (ft) where the path first falls through `levelFeet` at or after index
    /// `start`; the last sample's range if it never does.
    func descendingCrossing(_ samples: [Sample], from start: Int, levelFeet: Double) -> Double {
        var i = start
        while i < samples.count - 1 {
            let p0 = samples[i].y - sightHeightFeet
            let p1 = samples[i + 1].y - sightHeightFeet
            if p0 >= levelFeet && p1 < levelFeet {
                let f = (p0 - levelFeet) / (p0 - p1)
                return samples[i].x + f * (samples[i + 1].x - samples[i].x)
            }
            i += 1
        }
        return samples[samples.count - 1].x
    }

    /// Linear interpolation of a sample at downrange distance `x` (ft); clamps to the ends.
    /// `samples` must be non-empty with strictly increasing `x` (guaranteed by `integrate`).
    func interpolate(_ samples: [Sample], x: Double) -> Sample {
        let n = samples.count
        if x <= samples[0].x { return samples[0] }
        if x >= samples[n - 1].x { return samples[n - 1] }
        var lo = 0
        var hi = n - 1
        while hi - lo > 1 {
            let mid = (lo + hi) / 2
            if samples[mid].x <= x {
                lo = mid
            } else {
                hi = mid
            }
        }
        let a = samples[lo]
        let b = samples[hi]
        let f = (x - a.x) / (b.x - a.x)
        return Sample(t: a.t + f * (b.t - a.t), x: x, y: a.y + f * (b.y - a.y),
                      z: a.z + f * (b.z - a.z), v: a.v + f * (b.v - a.v))
    }

    /// Drag + gravity acceleration for a ground velocity, given the air-mass velocity.
    @inline(__always)
    private func acceleration(_ vx: Double, _ vy: Double, _ vz: Double,
                              _ wx: Double, _ wy: Double, _ wz: Double) -> (Double, Double, Double) {
        let rx = vx - wx
        let ry = vy - wy
        let rz = vz - wz
        let speed = (rx * rx + ry * ry + rz * rz).squareRoot()
        let d = dragFactor * table.dragCoefficient(atMach: speed / speedOfSound) * speed
        return (gravityX - d * rx, gravityY - d * ry, -d * rz)
    }

    /// RK4 point-mass integration in the LOS frame. Returns every step; the first
    /// sample is the muzzle. Stops after the first sample at or beyond `maxRangeFeet`,
    /// or below `minPathFeet` while descending, or slower than `minimumVelocity`, or no
    /// longer moving downrange.
    func integrate(angle: Double, withWind: Bool, maxRangeFeet: Double, minPathFeet: Double) -> [Sample] {
        var vx = muzzleVelocity * cos(angle)
        var vy = muzzleVelocity * sin(angle)
        var vz = 0.0
        var x = 0.0
        var y = 0.0
        var z = 0.0
        var t = 0.0
        let wx = withWind ? windX : 0.0
        let wy = withWind ? windY : 0.0
        let wz = withWind ? windZ : 0.0
        let h = FlightModel.timeStep
        let sh = sightHeightFeet

        var samples: [Sample] = []
        if muzzleVelocity > 0, maxRangeFeet.isFinite {
            let estimate = maxRangeFeet / (muzzleVelocity * h)
            samples.reserveCapacity(Int(min(max(estimate * 1.5, 16.0), 200_000.0)))
        }
        samples.append(Sample(t: 0, x: 0, y: 0, z: 0, v: muzzleVelocity))

        var steps = 0
        while steps < FlightModel.maxSteps {
            steps += 1
            let (a1x, a1y, a1z) = acceleration(vx, vy, vz, wx, wy, wz)
            let v2x = vx + 0.5 * h * a1x
            let v2y = vy + 0.5 * h * a1y
            let v2z = vz + 0.5 * h * a1z
            let (a2x, a2y, a2z) = acceleration(v2x, v2y, v2z, wx, wy, wz)
            let v3x = vx + 0.5 * h * a2x
            let v3y = vy + 0.5 * h * a2y
            let v3z = vz + 0.5 * h * a2z
            let (a3x, a3y, a3z) = acceleration(v3x, v3y, v3z, wx, wy, wz)
            let v4x = vx + h * a3x
            let v4y = vy + h * a3y
            let v4z = vz + h * a3z
            let (a4x, a4y, a4z) = acceleration(v4x, v4y, v4z, wx, wy, wz)

            x += h / 6.0 * (vx + 2.0 * v2x + 2.0 * v3x + v4x)
            y += h / 6.0 * (vy + 2.0 * v2y + 2.0 * v3y + v4y)
            z += h / 6.0 * (vz + 2.0 * v2z + 2.0 * v3z + v4z)
            vx += h / 6.0 * (a1x + 2.0 * a2x + 2.0 * a3x + a4x)
            vy += h / 6.0 * (a1y + 2.0 * a2y + 2.0 * a3y + a4y)
            vz += h / 6.0 * (a1z + 2.0 * a2z + 2.0 * a3z + a4z)
            t += h

            let speed = (vx * vx + vy * vy + vz * vz).squareRoot()
            samples.append(Sample(t: t, x: x, y: y, z: z, v: speed))
            if x >= maxRangeFeet { break }
            if speed < FlightModel.minimumVelocity || vx <= 0 { break }
            if vy < 0 && (y - sh) < minPathFeet { break }
        }
        return samples
    }
}

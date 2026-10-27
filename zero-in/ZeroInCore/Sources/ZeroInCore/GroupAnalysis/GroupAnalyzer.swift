import Foundation

/// Pure functions that turn shot positions (target inches) into statistics and
/// a scope correction.
public enum GroupAnalyzer {
    /// nil when `shots` is empty. A single shot has zero spread.
    public static func stats(_ shots: [Point2D]) -> GroupStats? {
        guard !shots.isEmpty else { return nil }
        let n = Double(shots.count)
        let center = centroid(shots)

        var extreme = 0.0
        for i in shots.indices {
            for j in shots.indices where j > i {
                extreme = max(extreme, shots[i].distance(to: shots[j]))
            }
        }

        let radii = shots.map { $0.distance(to: center) }
        let meanRadius = radii.reduce(0, +) / n
        let variance = radii.reduce(0) { $0 + ($1 - meanRadius) * ($1 - meanRadius) } / n

        let xs = shots.map(\.x), ys = shots.map(\.y)
        let hSpread = (xs.max() ?? 0) - (xs.min() ?? 0)
        let vSpread = (ys.max() ?? 0) - (ys.min() ?? 0)

        return GroupStats(shotCount: shots.count, center: center, extremeSpreadInches: extreme,
                          meanRadiusInches: meanRadius, horizontalSpreadInches: hSpread,
                          verticalSpreadInches: vSpread, radialStdDevInches: max(0, variance).squareRoot())
    }

    /// Turret correction that moves `groupCenter` onto `expectedImpact`.
    /// +elevation = UP, +windage = RIGHT. A group that prints low-left of where
    /// it should gives positive elevation and positive windage.
    public static func correction(groupCenter: Point2D, expectedImpact: Point2D = .zero,
                                  distanceYards: Double, unit: AngularUnit) -> Correction {
        let elevation = Angular.angular(fromInches: expectedImpact.y - groupCenter.y,
                                        atYards: distanceYards, unit: unit)
        let windage = Angular.angular(fromInches: expectedImpact.x - groupCenter.x,
                                      atYards: distanceYards, unit: unit)
        return Correction(elevation: elevation, windage: windage, unit: unit)
    }

    /// Optional outlier ("flier") flagging: indices of shots farther than
    /// `sigma` radial standard deviations from the center. Never flags when
    /// count < 4.
    ///
    /// Each shot is judged leave-one-out so a flier cannot mask itself: its
    /// distance from the center of the *other* shots is compared with
    /// `sigma × RSD`, where RSD = sqrt(Σr² / (m − 1)) is the radial standard
    /// deviation (√(σx² + σy²)) of those m other shots about their own center.
    public static func outliers(_ shots: [Point2D], sigma: Double = 2.5) -> [Int] {
        guard shots.count >= 4 else { return [] }
        var flagged: [Int] = []
        for i in shots.indices {
            var others = shots
            others.remove(at: i)
            let c = centroid(others)
            let sumSq = others.reduce(0) { $0 + ($1 - c).length * ($1 - c).length }
            let rsd = (sumSq / Double(others.count - 1)).squareRoot()
            guard rsd > 1e-12 else { continue }
            if shots[i].distance(to: c) > sigma * rsd {
                flagged.append(i)
            }
        }
        return flagged
    }

    static func centroid(_ points: [Point2D]) -> Point2D {
        guard !points.isEmpty else { return .zero }
        let sum = points.reduce(Point2D.zero, +)
        return sum / Double(points.count)
    }
}

import Foundation
import ZeroInCore

/// Display helpers shared by the Range screens. Internal math is always
/// yards / inches; these convert to the user's preferred units.
enum RangeFormat {
    static func number(_ value: Double, digits: Int = 2) -> String {
        value.formatted(.number.precision(.fractionLength(digits)))
    }

    static func distance(yards: Double, unit: DistanceUnit) -> String {
        let v = unit.fromYards(yards)
        let digits = abs(v - v.rounded()) < 0.05 ? 0 : 1
        return "\(number(v, digits: digits)) \(unit.label)"
    }

    static func linear(inches: Double, unit: LinearUnit, digits: Int = 2) -> String {
        "\(number(unit.fromInches(inches), digits: digits)) \(unit.label)"
    }

    static func angular(_ value: Double, unit: AngularUnit, digits: Int = 2) -> String {
        "\(number(value, digits: digits)) \(unit.label)"
    }

    /// Group center offset, e.g. "1.50 in low · 0.75 in left".
    static func offset(_ p: Point2D, unit: LinearUnit) -> String {
        let v = p.y >= 0 ? "high" : "low"
        let h = p.x >= 0 ? "right" : "left"
        return "\(linear(inches: abs(p.y), unit: unit)) \(v) · \(linear(inches: abs(p.x), unit: unit)) \(h)"
    }

    static func clicks(_ n: Int) -> String { n == 1 ? "1 click" : "\(n) clicks" }

    /// "UP 6 clicks · RIGHT 3 clicks" (zero axes are omitted; "No change" if both are zero).
    static func clickSummary(_ correction: Correction, scope: ScopeSpec) -> String {
        let k = correction.clicks(on: scope)
        var parts: [String] = []
        if k.elevation != 0 { parts.append("\(k.elevation > 0 ? "UP" : "DOWN") \(clicks(abs(k.elevation)))") }
        if k.windage != 0 { parts.append("\(k.windage > 0 ? "RIGHT" : "LEFT") \(clicks(abs(k.windage)))") }
        return parts.isEmpty ? "No change" : parts.joined(separator: " · ")
    }

    /// One line explaining a non-zero expected impact, or nil when sighting in
    /// at the zero range. "Zeroing at 100 yd from 25 yd: bullets should print 0.6 in low".
    static func expectedImpactLine(expected: Point2D, zeroYards: Double, sessionYards: Double,
                                   distanceUnit: DistanceUnit, linearUnit: LinearUnit) -> String? {
        guard abs(zeroYards - sessionYards) > 0.5 else { return nil }
        let prefix = "Zeroing at \(distance(yards: zeroYards, unit: distanceUnit)) from \(distance(yards: sessionYards, unit: distanceUnit))"
        var pieces: [String] = []
        if abs(expected.y) >= 0.05 {
            pieces.append("\(linear(inches: abs(expected.y), unit: linearUnit, digits: 1)) \(expected.y < 0 ? "low" : "high")")
        }
        if abs(expected.x) >= 0.05 {
            pieces.append("\(linear(inches: abs(expected.x), unit: linearUnit, digits: 1)) \(expected.x < 0 ? "left" : "right")")
        }
        if pieces.isEmpty { return "\(prefix): bullets should print on the point of aim" }
        return "\(prefix): bullets should print \(pieces.joined(separator: " and "))"
    }
}

/// Reads the unit preferences with safe fallbacks.
struct RangeUnits {
    var angular: AngularUnit
    var distance: DistanceUnit
    var linear: LinearUnit

    init(angularRaw: String, distanceRaw: String, linearRaw: String) {
        angular = AngularUnit(rawValue: angularRaw) ?? .moa
        distance = DistanceUnit(rawValue: distanceRaw) ?? .yards
        linear = LinearUnit(rawValue: linearRaw) ?? .inches
    }
}

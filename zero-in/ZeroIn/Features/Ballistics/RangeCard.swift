import Foundation
import ZeroInCore

extension RifleProfile {
    /// "168 gr · G1 0.462 · 2650 fps · zero 100 yd"
    func loadSummary(units: UnitsFormatter) -> String {
        "\(String(format: "%g", bulletWeightGrains)) gr · "
        + "\(dragModel.label) \(String(format: "%.3f", ballisticCoefficient)) · "
        + "\(String(format: "%.0f", muzzleVelocityFPS)) fps · "
        + "zero \(units.range(zeroRangeYards))"
    }
}

/// Builds the plain-text range card shared from the Ballistics tab.
enum RangeCard {
    static func text(profile: RifleProfile, conditions: ShotConditions, rows: [TrajectoryPoint],
                     units: UnitsFormatter, angularUnit: AngularUnit) -> String {
        let scope = profile.scope
        var lines: [String] = []
        lines.append("RANGE CARD · \(profile.name)")
        lines.append("\(profile.firearmName) · \(profile.caliberName)")
        lines.append("Load: \(profile.ammoName.isEmpty ? "—" : profile.ammoName)")
        lines.append(profile.loadSummary(units: units))
        lines.append("Scope: \(String(format: "%g", scope.clickValue)) \(scope.clickUnit.label)/click, "
                     + "sight height \(units.linear(scope.sightHeightInches))")
        lines.append("Conditions: \(conditions.atmosphere.summary)")
        var windLine = "Wind: \(conditions.wind.summary)"
        if abs(conditions.inclinationDegrees) >= 0.5 {
            windLine += " · slope \(UnitsFormatter.number(conditions.inclinationDegrees, decimals: 0))°"
        }
        lines.append(windLine)
        lines.append("")
        lines.append("Range | Come-up (\(angularUnit.label) / clicks) | Wind (\(angularUnit.label))")

        for row in rows {
            let up = row.correction(in: angularUnit)
            let clicks = up.clicks(on: scope).elevation
            let range = UnitsFormatter.number(units.distanceUnit.fromYards(row.rangeYards), decimals: 0)
            var line = "\(range) \(units.distanceUnit.label) | "
            line += "\(clicks == 0 ? "—" : units.clicks(clicks, direction: up.elevationDirection)) "
            line += "(\(UnitsFormatter.number(up.elevation, decimals: 1)) \(angularUnit.label))"
            let drift = row.windage(in: angularUnit)
            if abs(row.windageInches) >= 0.05 {
                // The card says which way to HOLD / dial, the opposite of the push.
                let dial = drift > 0 ? "LEFT" : "RIGHT"
                line += " | wind \(dial) \(UnitsFormatter.number(abs(drift), decimals: 1))"
            }
            lines.append(line)
        }
        lines.append("")
        lines.append("Dial = direction impact moves. Verify with your own chronograph and confirm zero on paper.")
        lines.append("Made with ZeroIn")
        return lines.joined(separator: "\n")
    }
}

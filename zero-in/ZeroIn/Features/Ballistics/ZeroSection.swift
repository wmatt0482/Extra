import SwiftUI
import ZeroInCore

/// Launch angle, expected impact at common sight-in distances, and MPBR.
struct ZeroSection: View {
    let result: BallisticsResult?
    let zeroRangeYards: Double
    let units: UnitsFormatter
    let angularUnit: AngularUnit
    @Binding var vitalZoneInches: Double

    private let vitalZones: [Double] = [4, 6, 8, 10]

    var body: some View {
        Section {
            LabeledContent("Zero range", value: units.range(zeroRangeYards))
            if let result {
                LabeledContent("Launch angle", value: launchAngleText(result))
            } else {
                LabeledContent("Launch angle", value: "…")
            }
        } header: {
            Text("Zero")
        } footer: {
            Text("Launch angle is how far the bore points above your line of sight so the bullet crosses it at the zero range.")
        }

        Section {
            if let result {
                ForEach(result.impacts, id: \.yards) { impact in
                    LabeledContent(units.range(impact.yards), value: Self.impactText(impact.offset, units: units))
                }
            }
        } header: {
            Text("Expected impact for this zero")
        } footer: {
            Text("Where the bullet prints relative to your point of aim. Use the closer distances to sight in on a short range, then confirm the zero on paper.")
        }

        Section {
            Picker("Vital zone", selection: $vitalZoneInches) {
                ForEach(vitalZones, id: \.self) { Text("\(Int($0)) in").tag($0) }
            }
            .pickerStyle(.segmented)
            .frame(minHeight: 44)
            if let result {
                LabeledContent("Suggested zero", value: units.range(result.mpbrZeroYards))
                LabeledContent("Max point-blank range", value: units.range(result.mpbrMaxYards))
            }
        } header: {
            Text("Point-blank range")
        } footer: {
            Text("Zero at the suggested range and hold dead on: the bullet stays inside the vital zone out to the max range.")
        }
    }

    private func launchAngleText(_ result: BallisticsResult) -> String {
        units.angular(result.launchAngleRadians / angularUnit.radians, unit: angularUnit)
    }

    /// "0.6 in low", "on point", "1.2 in high, 0.4 in left".
    static func impactText(_ p: Point2D, units: UnitsFormatter) -> String {
        var parts: [String] = []
        if abs(p.y) < 0.05 {
            parts.append("on point")
        } else {
            parts.append("\(units.linear(abs(p.y))) \(p.y < 0 ? "low" : "high")")
        }
        if abs(p.x) >= 0.05 {
            parts.append("\(units.linear(abs(p.x))) \(p.x < 0 ? "left" : "right")")
        }
        return parts.joined(separator: ", ")
    }
}

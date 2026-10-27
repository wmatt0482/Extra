import SwiftUI
import UIKit
import ZeroInCore

/// The turret adjustment in big type: direction, whole clicks, angle, residual.
struct CorrectionCard: View {
    let correction: Correction
    let scope: ScopeSpec
    let displayUnit: AngularUnit
    var title: String = "Dial"

    var body: some View {
        let clicks = correction.clicks(on: scope)
        let shown = correction.converted(to: displayUnit)
        let residual = correction.residual(on: scope).converted(to: displayUnit)
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.headline).foregroundStyle(.secondary)
            axisRow(clicks: clicks.elevation, angle: shown.elevation,
                    positive: ("UP", "arrow.up"), negative: ("DOWN", "arrow.down"), axis: "Elevation")
            axisRow(clicks: clicks.windage, angle: shown.windage,
                    positive: ("RIGHT", "arrow.right"), negative: ("LEFT", "arrow.left"), axis: "Windage")
            Text("\(RangeFormat.number(scope.clickValue, digits: 2)) \(scope.clickUnit.label) per click · left over after whole clicks: \(signed(residual.elevation)) elev, \(signed(residual.windage)) wind \(displayUnit.label)")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    private func axisRow(clicks: Int, angle: Double, positive: (String, String), negative: (String, String),
                         axis: String) -> some View {
        let (word, symbol) = clicks >= 0 ? positive : negative
        return HStack(alignment: .firstTextBaseline, spacing: 12) {
            if clicks == 0 {
                Image(systemName: "checkmark.circle")
                    .font(.system(size: 30, weight: .bold))
                    .foregroundStyle(.green)
                Text("\(axis) OK")
                    .font(.system(size: 30, weight: .bold, design: .rounded))
            } else {
                Image(systemName: symbol)
                    .font(.system(size: 34, weight: .heavy))
                    .foregroundStyle(Color.accentColor)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(word) \(RangeFormat.clicks(abs(clicks)))")
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    Text(RangeFormat.angular(abs(angle), unit: displayUnit))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func signed(_ v: Double) -> String {
        v.formatted(.number.precision(.fractionLength(2)).sign(strategy: .always()))
    }
}

/// Group size and position in the user's linear and angular units.
struct GroupStatsCard: View {
    let stats: GroupStats
    let distanceYards: Double
    let units: RangeUnits

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Group").font(.headline).foregroundStyle(.secondary)
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 8) {
                ForEach(rows) { row in
                    GridRow {
                        Text(row.label).foregroundStyle(.secondary)
                        Text(row.value).monospacedDigit()
                    }
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    private func sizeText(_ inches: Double) -> String {
        let angle = Angular.angular(fromInches: inches, atYards: distanceYards, unit: units.angular)
        return "\(RangeFormat.linear(inches: inches, unit: units.linear)) · \(RangeFormat.angular(angle, unit: units.angular))"
    }

    private struct StatRow: Identifiable {
        let label: String
        let value: String
        var id: String { label }
    }

    private var rows: [StatRow] {
        let size = "\(RangeFormat.linear(inches: stats.horizontalSpreadInches, unit: units.linear)) × \(RangeFormat.linear(inches: stats.verticalSpreadInches, unit: units.linear))"
        return [StatRow(label: "Shots", value: "\(stats.shotCount)"),
                StatRow(label: "Extreme spread", value: sizeText(stats.extremeSpreadInches)),
                StatRow(label: "Mean radius", value: sizeText(stats.meanRadiusInches)),
                StatRow(label: "Width × height", value: size),
                StatRow(label: "Center", value: RangeFormat.offset(stats.center, unit: units.linear))]
    }
}

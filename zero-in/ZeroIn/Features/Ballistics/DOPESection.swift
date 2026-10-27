import SwiftUI
import ZeroInCore

/// Max range / step controls plus the scrollable DOPE table.
struct DOPESection: View {
    let result: BallisticsResult?
    let isComputing: Bool
    let scope: ScopeSpec
    let units: UnitsFormatter
    let angularUnit: AngularUnit
    @Binding var maxRange: Double      // display distance unit
    @Binding var step: Double          // display distance unit

    @State private var customMax = false

    private let maxPresets: [Double] = [300, 500, 800, 1000, 1200]
    private let stepPresets: [Double] = [10, 25, 50, 100]

    private var isCustom: Bool { customMax || !maxPresets.contains(maxRange) }
    private var unitLabel: String { units.distanceUnit.label }

    var body: some View {
        Section {
            Picker("Max range", selection: maxSelection) {
                ForEach(maxPresets, id: \.self) { Text("\(Int($0)) \(unitLabel)").tag($0) }
                Text("Custom").tag(0.0)
            }
            .frame(minHeight: 44)
            if isCustom {
                NumberFieldRow(title: "Custom max", unit: unitLabel, value: $maxRange)
            }
            Picker("Step", selection: $step) {
                ForEach(stepPresets, id: \.self) { Text("\(Int($0))").tag($0) }
            }
            .pickerStyle(.segmented)
            .frame(minHeight: 44)
        } header: {
            Text("DOPE table")
        } footer: {
            Text("Come-up is in \(angularUnit.label) and whole clicks on this scope (negative = dial down). Wind drift is for the wind set above; L or R is the way the bullet is pushed.")
        }

        Section {
            if let result {
                DOPETable(rows: result.rows, transonicIndex: result.transonicIndex,
                          scope: scope, units: units, angularUnit: angularUnit)
                    .listRowInsets(EdgeInsets())
                if result.transonicIndex != nil {
                    Label("Shaded row: the bullet drops below Mach 1.2, where drop and drift get less predictable.",
                          systemImage: "waveform.path.ecg")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            } else if isComputing {
                HStack { ProgressView(); Text("Calculating…").foregroundStyle(.secondary) }
            } else {
                Text("Check the profile's ballistic coefficient and muzzle velocity.")
                    .foregroundStyle(.secondary)
            }
        }
    }

    /// 0 means "Custom".
    private var maxSelection: Binding<Double> {
        Binding(
            get: { isCustom ? 0 : maxRange },
            set: { newValue in
                if newValue == 0 {
                    customMax = true
                } else {
                    customMax = false
                    maxRange = newValue
                }
            })
    }
}

/// Fixed-width monospaced columns in a horizontal scroll view.
struct DOPETable: View {
    let rows: [TrajectoryPoint]
    let transonicIndex: Int?
    let scope: ScopeSpec
    let units: UnitsFormatter
    let angularUnit: AngularUnit

    private struct Column {
        let title: String
        let width: CGFloat
    }

    private var columns: [Column] {
        [Column(title: "Range \(units.distanceUnit.label)", width: 70),
         Column(title: "Path \(units.linearUnit.label)", width: 66),
         Column(title: "Up \(angularUnit.label) / clk", width: 104),
         Column(title: "Wind \(units.linearUnit.label) / \(angularUnit.label)", width: 112),
         Column(title: "fps", width: 56),
         Column(title: "ft-lb", width: 60),
         Column(title: "Time s", width: 60)]
    }

    var body: some View {
        let cols = columns
        ScrollView(.horizontal, showsIndicators: true) {
            VStack(spacing: 0) {
                rowView(cells: cols.map(\.title), widths: cols.map(\.width), header: true, shaded: false)
                Divider()
                ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                    rowView(cells: cells(for: row), widths: cols.map(\.width),
                            header: false, shaded: index == transonicIndex)
                }
            }
            .padding(.horizontal, 8)
        }
    }

    private func rowView(cells: [String], widths: [CGFloat], header: Bool, shaded: Bool) -> some View {
        let font: Font = header ? Font.caption2.weight(.semibold) : Font.system(.footnote, design: .monospaced)
        return HStack(spacing: 0) {
            ForEach(Array(cells.enumerated()), id: \.offset) { index, text in
                Text(text)
                    .font(font)
                    .foregroundStyle(header ? Color.secondary : Color.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .frame(width: widths[index], alignment: .trailing)
            }
        }
        .frame(minHeight: header ? 32 : 30)
        .background(shaded ? Color.orange.opacity(0.18) : Color.clear)
    }

    private func cells(for row: TrajectoryPoint) -> [String] {
        let correction = row.correction(in: angularUnit)
        let clicks = correction.clicks(on: scope).elevation
        let up = "\(UnitsFormatter.number(correction.elevation, decimals: 1)) / \(clicks)"

        let drift = row.windageInches
        var wind = "—"
        if abs(drift) >= 0.05 {
            let linear = UnitsFormatter.number(units.linearUnit.fromInches(abs(drift)), decimals: 1)
            let angular = UnitsFormatter.number(abs(row.windage(in: angularUnit)), decimals: 1)
            wind = "\(linear) \(drift > 0 ? "R" : "L") / \(angular)"
        }
        return [UnitsFormatter.number(units.distanceUnit.fromYards(row.rangeYards), decimals: 0),
                UnitsFormatter.number(units.linearUnit.fromInches(row.pathInches), decimals: 1),
                up,
                wind,
                UnitsFormatter.number(row.velocityFPS, decimals: 0),
                UnitsFormatter.number(row.energyFtLb, decimals: 0),
                UnitsFormatter.number(row.timeSeconds, decimals: 2)]
    }
}

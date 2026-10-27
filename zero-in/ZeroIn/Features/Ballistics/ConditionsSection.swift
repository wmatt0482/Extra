import SwiftUI
import UIKit
import ZeroInCore

/// Atmosphere, wind and inclination inputs for the Ballistics tab.
struct ConditionsSection: View {
    @Binding var conditions: ShotConditions

    var body: some View {
        Section {
            NumberFieldRow(title: "Altitude", unit: "ft", value: $conditions.atmosphere.altitudeFeet)
            NumberFieldRow(title: "Temperature", unit: "°F", value: $conditions.atmosphere.temperatureF)
            NumberFieldRow(title: "Station pressure", unit: "inHg", value: $conditions.atmosphere.pressureInHg)
            NumberFieldRow(title: "Humidity", unit: "%", value: $conditions.atmosphere.humidityPercent)

            HStack(spacing: 12) {
                Button("Use standard") {
                    conditions.atmosphere = .standard
                }
                Button("Standard at altitude") {
                    conditions.atmosphere = .standard(atAltitudeFeet: conditions.atmosphere.altitudeFeet)
                }
            }
            .buttonStyle(.bordered)
            .frame(minHeight: 44)

            let air = conditions.sanitized.atmosphere
            LabeledContent("Air density", value: "\(UnitsFormatter.number(air.densityRatio, decimals: 3)) × standard")
            LabeledContent("Speed of sound", value: "\(UnitsFormatter.number(air.speedOfSoundFPS, decimals: 0)) fps")
        } header: {
            Text("Conditions")
        } footer: {
            Text("Station pressure is what a barometer reads where you stand, not the sea-level corrected number from a weather report.")
        }

        Section("Wind") {
            NumberFieldRow(title: "Speed", unit: "mph", value: $conditions.wind.speedMPH)
            VStack(alignment: .leading, spacing: 8) {
                Text("Wind from (clock, 12 = into your face)")
                WindClockPicker(degrees: windDegrees)
            }
            .padding(.vertical, 4)
            NumberFieldRow(title: "Direction", unit: "°", value: windDegrees)
            NumberFieldRow(title: "Inclination", unit: "°", value: $conditions.inclinationDegrees)
            Text("Wind: \(conditions.wind.summary). Positive inclination is uphill.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    /// Wind direction kept in 0..<360.
    private var windDegrees: Binding<Double> {
        Binding(
            get: { conditions.wind.directionDegrees },
            set: { newValue in
                var d = newValue.truncatingRemainder(dividingBy: 360)
                if d < 0 { d += 360 }
                conditions.wind.directionDegrees = d
            })
    }
}

/// Twelve large buttons, one per clock position. 3 = wind from the right.
struct WindClockPicker: View {
    @Binding var degrees: Double

    private let positions = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 6), count: 6)

    private var selected: Int? { WindCondition(speedMPH: 1, directionDegrees: degrees).clockPosition }

    var body: some View {
        LazyVGrid(columns: columns, spacing: 6) {
            ForEach(positions, id: \.self) { n in
                let isSelected = selected == n
                Button {
                    degrees = Double(n % 12) * 30
                } label: {
                    Text("\(n)")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(isSelected ? Color.accentColor : Color(.secondarySystemFill),
                                    in: RoundedRectangle(cornerRadius: 8))
                        .foregroundStyle(isSelected ? Color.white : Color.primary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(n) o'clock")
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
    }
}

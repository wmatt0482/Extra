import SwiftUI
import ZeroInCore

/// Edits a copy of `ShotConditions`; `onSave` receives the result.
/// Inputs are imperial (°F, inHg, ft, mph), matching the model's storage.
struct SessionConditionsSheet: View {
    var onSave: (ShotConditions) -> Void
    @State private var conditions: ShotConditions
    @Environment(\.dismiss) private var dismiss

    init(conditions: ShotConditions, onSave: @escaping (ShotConditions) -> Void) {
        self.onSave = onSave
        _conditions = State(initialValue: conditions)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Atmosphere") {
                    numberRow("Temperature", $conditions.atmosphere.temperatureF, "°F")
                    numberRow("Station pressure", $conditions.atmosphere.pressureInHg, "inHg")
                    numberRow("Altitude", $conditions.atmosphere.altitudeFeet, "ft")
                    numberRow("Humidity", $conditions.atmosphere.humidityPercent, "%")
                    Button("Use standard atmosphere for this altitude") {
                        let humidity = conditions.atmosphere.humidityPercent
                        conditions.atmosphere = .standard(atAltitudeFeet: conditions.atmosphere.altitudeFeet)
                        conditions.atmosphere.humidityPercent = humidity
                    }
                }
                Section {
                    numberRow("Wind speed", $conditions.wind.speedMPH, "mph")
                    Picker("From", selection: clockBinding) {
                        ForEach(1...12, id: \.self) { Text("\($0) o'clock").tag($0) }
                    }
                } header: {
                    Text("Wind")
                } footer: {
                    Text("3 o'clock is wind from your right, 12 is a headwind. Most shooters zero in calm air and leave this at 0.")
                }
                Section {
                    Button("Reset to standard", role: .destructive) { conditions = .standard }
                }
            }
            .navigationTitle("Conditions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(conditions)
                        dismiss()
                    }
                }
            }
        }
    }

    private var clockBinding: Binding<Int> {
        Binding(get: {
            let c = Int((conditions.wind.directionDegrees / 30).rounded()) % 12
            return c <= 0 ? c + 12 : c
        }, set: {
            conditions.wind.directionDegrees = Double($0 % 12) * 30
        })
    }

    private func numberRow(_ label: String, _ value: Binding<Double>, _ unit: String) -> some View {
        HStack {
            Text(label)
            Spacer()
            TextField(label, value: value, format: .number.precision(.fractionLength(0...2)))
                .keyboardType(.numbersAndPunctuation)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 110)
            Text(unit).foregroundStyle(.secondary).frame(minWidth: 36, alignment: .leading)
        }
        .frame(minHeight: 44)
    }

    /// "59 °F · 29.92 inHg · 0 ft · calm"
    static func summary(_ c: ShotConditions) -> String {
        let a = c.atmosphere
        var parts = ["\(RangeFormat.number(a.temperatureF, digits: 0)) °F",
                     "\(RangeFormat.number(a.pressureInHg, digits: 2)) inHg",
                     "\(RangeFormat.number(a.altitudeFeet, digits: 0)) ft"]
        if c.wind.speedMPH > 0 {
            let clock = Int((c.wind.directionDegrees / 30).rounded()) % 12
            parts.append("wind \(RangeFormat.number(c.wind.speedMPH, digits: 0)) mph from \(clock <= 0 ? clock + 12 : clock) o'clock")
        } else {
            parts.append("calm")
        }
        return parts.joined(separator: " · ")
    }
}

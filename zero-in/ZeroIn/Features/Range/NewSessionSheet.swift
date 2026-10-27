import SwiftData
import SwiftUI
import ZeroInCore

/// Pick a distance (and optionally conditions) and start a sight-in session.
/// Presets are in the user's distance unit (25/50/100/200 yd or m).
struct NewSessionSheet: View {
    let profile: RifleProfile
    var onCreate: (SightInSession) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @AppStorage(AppSettings.distanceUnitKey) private var distanceRaw = DistanceUnit.yards.rawValue

    @State private var preset: Double? = 100
    @State private var customDistance: Double = 100
    @State private var conditions = ShotConditions.standard
    @State private var showConditions = false
    @State private var didLoad = false

    static let presets: [Double] = [25, 50, 100, 200]

    private var unit: DistanceUnit { DistanceUnit(rawValue: distanceRaw) ?? .yards }
    private var distanceInUnit: Double { preset ?? customDistance }
    private var distanceYards: Double { unit.toYards(distanceInUnit) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Distance", selection: $preset) {
                        ForEach(Self.presets, id: \.self) { p in
                            Text("\(Int(p)) \(unit.label)").tag(Optional(p))
                        }
                        Text("Custom").tag(Double?.none)
                    }
                    .pickerStyle(.segmented)
                    .frame(minHeight: 44)
                    if preset == nil {
                        HStack {
                            TextField("Distance", value: $customDistance, format: .number.precision(.fractionLength(0...1)))
                                .keyboardType(.decimalPad)
                                .font(.title3)
                            Text(unit.label).foregroundStyle(.secondary)
                        }
                    }
                } header: {
                    Text("Distance to target")
                } footer: {
                    Text(distanceFooter)
                }

                Section("Conditions") {
                    Text(SessionConditionsSheet.summary(conditions))
                        .font(.callout)
                    Button("Edit conditions") { showConditions = true }
                        .frame(minHeight: 44)
                }
            }
            .navigationTitle("New session")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Start") { create() }
                        .disabled(!(distanceYards > 0 && distanceYards < 5000))
                }
            }
            .sheet(isPresented: $showConditions) {
                SessionConditionsSheet(conditions: conditions) { conditions = $0 }
            }
            .onAppear(perform: loadDefaults)
        }
    }

    private var distanceFooter: String {
        let zero = RangeFormat.distance(yards: profile.zeroRangeYards, unit: unit)
        if abs(distanceYards - profile.zeroRangeYards) <= 0.5 {
            return "Shooting at your zero range (\(zero)): groups should center on the point of aim."
        }
        return "Your zero is \(zero). ZeroIn accounts for where bullets should print at this distance."
    }

    private func loadDefaults() {
        guard !didLoad else { return }
        didLoad = true
        // Settings' default sight-in distance (yards), shown in the display unit.
        let startInUnit = unit.fromYards(AppSettings.defaultSightInDistance())
        if let match = Self.presets.first(where: { abs($0 - startInUnit) < 0.5 }) {
            preset = match
        } else {
            preset = nil
            customDistance = startInUnit.rounded()
        }
        // Start from the last session's weather; it's usually the same range.
        if let last = profile.sortedSessions.first {
            conditions = last.conditions
        }
    }

    private func create() {
        let session = SightInSession(profile: profile, distanceYards: distanceYards, conditions: conditions)
        context.insert(session)
        session.profile = profile
        if !profile.sessions.contains(where: { $0.id == session.id }) {
            profile.sessions.append(session)
        }
        try? context.save()
        dismiss()
        onCreate(session)
    }
}

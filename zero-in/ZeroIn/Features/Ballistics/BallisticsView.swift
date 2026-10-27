import SwiftUI
import SwiftData
import ZeroInCore

/// Ballistics tab: conditions, zero information, DOPE table and range card.
struct BallisticsView: View {
    @Query(sort: \RifleProfile.name) private var profiles: [RifleProfile]

    @AppStorage(AppSettings.activeProfileIDKey) private var activeID = ""
    @AppStorage(AppSettings.ballisticsConditionsKey) private var conditionsJSON = ""
    @AppStorage(AppSettings.angularUnitKey) private var angularRaw = AngularUnit.moa.rawValue
    @AppStorage(AppSettings.distanceUnitKey) private var distanceRaw = DistanceUnit.yards.rawValue
    @AppStorage(AppSettings.linearUnitKey) private var linearRaw = LinearUnit.inches.rawValue
    @AppStorage(AppSettings.ballisticsMaxRangeKey) private var maxRange = 500.0
    @AppStorage(AppSettings.ballisticsStepKey) private var step = 25.0
    @AppStorage(AppSettings.ballisticsVitalZoneKey) private var vitalZone = 6.0

    @State private var model = BallisticsModel()
    @State private var showPicker = false

    private var angularUnit: AngularUnit { AngularUnit(rawValue: angularRaw) ?? .moa }
    private var units: UnitsFormatter {
        UnitsFormatter(distance: DistanceUnit(rawValue: distanceRaw) ?? .yards,
                       linear: LinearUnit(rawValue: linearRaw) ?? .inches)
    }

    private var activeProfile: RifleProfile? {
        profiles.first { $0.id.uuidString == activeID }
    }

    private var conditionsBinding: Binding<ShotConditions> {
        Binding(get: { ConditionsStore.decode(conditionsJSON) },
                set: { conditionsJSON = ConditionsStore.encode($0) })
    }

    private var profileSelection: Binding<RifleProfile?> {
        Binding(get: { activeProfile },
                set: { activeID = $0?.id.uuidString ?? "" })
    }

    /// nil when there is no profile or its numbers cannot be solved.
    private var input: BallisticsInput? {
        guard let p = activeProfile,
              p.ballisticCoefficient > 0, p.muzzleVelocityFPS > 100,
              p.bulletWeightGrains > 0, p.zeroRangeYards > 0 else { return nil }
        let distance = units.distanceUnit
        let stepYards = max(1, distance.toYards(step))
        let maxYards = min(max(distance.toYards(maxRange), stepYards), 3_000)
        return BallisticsInput(projectile: p.projectile, scope: p.scope,
                               conditions: ConditionsStore.decode(conditionsJSON).sanitized,
                               maxRangeYards: maxYards, stepYards: stepYards,
                               vitalZoneInches: vitalZone)
    }

    var body: some View {
        NavigationStack {
            Form {
                ProfileHeaderSection(profile: activeProfile, hasProfiles: !profiles.isEmpty,
                                     units: units, onChoose: { showPicker = true })
                if let profile = activeProfile {
                    ConditionsSection(conditions: conditionsBinding)
                    ZeroSection(result: model.result, zeroRangeYards: profile.zeroRangeYards,
                                units: units, angularUnit: angularUnit, vitalZoneInches: $vitalZone)
                    DOPESection(result: model.result, isComputing: model.isComputing,
                                scope: profile.scope, units: units, angularUnit: angularUnit,
                                maxRange: $maxRange, step: $step)
                    shareSection(profile)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Ballistics")
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { dismissKeyboard() }
                }
            }
            .sheet(isPresented: $showPicker) {
                ProfilePicker(selection: profileSelection)
                    .presentationDetents([.medium, .large])
            }
        }
        .onAppear { normalizeSelection() }
        .onChange(of: profiles.map(\.id)) { _, _ in normalizeSelection() }
        .onChange(of: activeID) { _, _ in showPicker = false }
        .onChange(of: input, initial: true) { _, newValue in model.update(newValue) }
    }

    @ViewBuilder
    private func shareSection(_ profile: RifleProfile) -> some View {
        if let rows = model.result?.rows, !rows.isEmpty {
            Section {
                ShareLink(item: RangeCard.text(profile: profile,
                                               conditions: ConditionsStore.decode(conditionsJSON).sanitized,
                                               rows: rows, units: units, angularUnit: angularUnit),
                          subject: Text("Range card · \(profile.name)")) {
                    Label("Share range card", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                }
            } footer: {
                Text("Plain text: profile, load, zero, conditions, then come-up and wind at every step.")
            }
        }
    }

    /// Keeps the stored active-profile ID pointing at a profile that exists.
    private func normalizeSelection() {
        guard activeProfile == nil, let first = profiles.first else { return }
        activeID = first.id.uuidString
    }
}

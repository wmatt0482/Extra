import SwiftData
import SwiftUI
import ZeroInCore

/// One sight-in session: summary, groups with corrections, net dialed, confirm zero.
struct SessionDetailView: View {
    @Bindable var session: SightInSession

    @Environment(\.modelContext) private var context
    @AppStorage(AppSettings.angularUnitKey) private var angularRaw = AngularUnit.moa.rawValue
    @AppStorage(AppSettings.distanceUnitKey) private var distanceRaw = DistanceUnit.yards.rawValue
    @AppStorage(AppSettings.linearUnitKey) private var linearRaw = LinearUnit.inches.rawValue

    @State private var showCapture = false
    @State private var showConditions = false
    @State private var showConfirmZero = false

    private var units: RangeUnits { RangeUnits(angularRaw: angularRaw, distanceRaw: distanceRaw, linearRaw: linearRaw) }
    private var scope: ScopeSpec { session.profile?.scope ?? ScopeSpec() }

    var body: some View {
        List {
            summarySection
            netSection
            groupsSection
            if let profile = session.profile { zeroSection(profile) }
        }
        .navigationTitle(RangeFormat.distance(yards: session.distanceYards, unit: units.distance))
        .safeAreaInset(edge: .bottom) {
            Button { showCapture = true } label: {
                Label("Add group", systemImage: "plus.viewfinder")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 54)
            }
            .buttonStyle(.borderedProminent)
            .disabled(session.profile == nil)
            .padding()
            .background(.bar)
        }
        .sheet(isPresented: $showCapture) {
            GroupCaptureFlow(session: session)
        }
        .sheet(isPresented: $showConditions) {
            SessionConditionsSheet(conditions: session.conditions) { newValue in
                session.conditions = newValue
                try? context.save()
            }
        }
    }

    private var summarySection: some View {
        Section {
            LabeledContent("Date") { Text(session.date, format: .dateTime.month().day().year().hour().minute()) }
            if let profile = session.profile {
                LabeledContent("Rifle", value: profile.name)
                LabeledContent("Zero range", value: RangeFormat.distance(yards: profile.zeroRangeYards, unit: units.distance))
            }
            LabeledContent("Distance", value: RangeFormat.distance(yards: session.distanceYards, unit: units.distance))
            Button { showConditions = true } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Conditions").foregroundStyle(.primary)
                    Text(SessionConditionsSheet.summary(session.conditions)).font(.caption).foregroundStyle(.secondary)
                }
                .frame(minHeight: 44)
            }
        }
    }

    @ViewBuilder
    private var netSection: some View {
        let applied = session.sortedGroups.filter(\.correctionApplied)
        if !applied.isEmpty {
            let net = netDialed(applied)
            let shown = net.converted(to: units.angular)
            Section("Net correction dialed") {
                VStack(alignment: .leading, spacing: 4) {
                    Text(RangeFormat.clickSummary(net, scope: scope)).font(.title2.bold())
                    Text(netDetail(shown, groupCount: applied.count))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }
        }
    }

    private func netDetail(_ shown: Correction, groupCount: Int) -> String {
        let up = shown.elevation >= 0 ? "up" : "down"
        let right = shown.windage >= 0 ? "right" : "left"
        let elev = RangeFormat.angular(abs(shown.elevation), unit: shown.unit)
        let wind = RangeFormat.angular(abs(shown.windage), unit: shown.unit)
        let groups = groupCount == 1 ? "1 group" : "\(groupCount) groups"
        return "\(elev) \(up) · \(wind) \(right) from \(groups)"
    }

    /// Sum of the whole clicks actually dialed, as a correction in click units.
    private func netDialed(_ applied: [ShotGroupRecord]) -> Correction {
        var elevationClicks = 0
        var windageClicks = 0
        for group in applied {
            let k = group.correction.clicks(on: scope)
            elevationClicks += k.elevation
            windageClicks += k.windage
        }
        return Correction(elevation: Double(elevationClicks) * scope.clickValue,
                          windage: Double(windageClicks) * scope.clickValue, unit: scope.clickUnit)
    }

    private var groupsSection: some View {
        Section("Groups") {
            let groups = session.sortedGroups
            if groups.isEmpty {
                Text("No groups yet. Shoot 3–5 rounds at the point of aim, then tap Add group.")
                    .foregroundStyle(.secondary)
            }
            ForEach(groups) { group in
                GroupRowView(group: group, scope: scope, distanceYards: session.distanceYards, units: units)
            }
            .onDelete { offsets in deleteGroups(groups, at: offsets) }
        }
    }

    private func zeroSection(_ profile: RifleProfile) -> some View {
        Section {
            Button { showConfirmZero = true } label: {
                Label(profile.zeroConfirmed ? "Zero confirmed — confirm again" : "Confirm zero",
                      systemImage: profile.zeroConfirmed ? "checkmark.seal.fill" : "checkmark.seal")
                    .frame(minHeight: 44)
            }
            .alert("Confirm zero?", isPresented: $showConfirmZero) {
                Button("Confirm") {
                    profile.zeroConfirmed = true
                    profile.zeroConfirmedAt = Date()
                    profile.updatedAt = Date()
                    try? context.save()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text(confirmMessage(profile))
            }
        } footer: {
            if profile.zeroConfirmed, let at = profile.zeroConfirmedAt {
                Text("\(profile.name) zero confirmed \(at.formatted(date: .abbreviated, time: .shortened)).")
            } else {
                Text("Confirm once a group centers where it should.")
            }
        }
    }

    private func confirmMessage(_ profile: RifleProfile) -> String {
        let zero = RangeFormat.distance(yards: profile.zeroRangeYards, unit: units.distance)
        if abs(session.distanceYards - profile.zeroRangeYards) > 0.5 {
            return "This session is at \(RangeFormat.distance(yards: session.distanceYards, unit: units.distance)). It's best to verify at \(zero) before confirming."
        }
        return "Mark \(profile.name) as zeroed at \(zero)."
    }

    private func deleteGroups(_ groups: [ShotGroupRecord], at offsets: IndexSet) {
        for index in offsets where groups.indices.contains(index) {
            let group = groups[index]
            if let name = group.imageFileName { TargetImageStore.delete(name) }
            session.groups.removeAll { $0.id == group.id }
            context.delete(group)
        }
        try? context.save()
    }
}

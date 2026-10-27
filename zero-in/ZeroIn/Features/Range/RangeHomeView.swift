import SwiftData
import SwiftUI
import ZeroInCore

/// Range tab: the active rifle, "New session", and that rifle's past sessions.
struct RangeHomeView: View {
    @Environment(\.modelContext) private var context
    @AppStorage(AppSettings.activeProfileIDKey) private var activeProfileID = ""
    @AppStorage(AppSettings.distanceUnitKey) private var distanceRaw = DistanceUnit.yards.rawValue
    @Query(sort: \RifleProfile.name) private var profiles: [RifleProfile]

    @State private var path: [SightInSession] = []
    @State private var showPicker = false
    @State private var pickerSelection: RifleProfile?
    @State private var showNewSession = false
    @State private var createdSession: SightInSession?
    /// `-demoCapture`: the session whose capture flow is shown on the sample target.
    @State private var demoCaptureSession: SightInSession?
    @State private var didStartDemoCapture = false

    private var activeProfile: RifleProfile? { profiles.first { $0.id.uuidString == activeProfileID } }
    private var distanceUnit: DistanceUnit { DistanceUnit(rawValue: distanceRaw) ?? .yards }

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if let profile = activeProfile {
                    profileContent(profile)
                } else {
                    noProfile
                }
            }
            .navigationTitle("Range")
            .navigationDestination(for: SightInSession.self) { session in
                SessionDetailView(session: session)
            }
            .sheet(isPresented: $showPicker) { pickerSheet }
            .sheet(isPresented: $showNewSession, onDismiss: openCreatedSession) {
                if let profile = activeProfile {
                    NewSessionSheet(profile: profile) { session in createdSession = session }
                }
            }
            .sheet(item: $demoCaptureSession) { session in
                GroupCaptureFlow(session: session, demoStep: LaunchOptions.demoCaptureStep)
            }
        }
        .task { await presentDemoCaptureIfRequested() }
    }

    // MARK: Content

    private func profileContent(_ profile: RifleProfile) -> some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(profile.name).font(.title2.bold())
                        Spacer()
                        Button("Change") { presentPicker() }
                            .buttonStyle(.bordered)
                    }
                    Text("\(profile.firearmName) · \(profile.caliberName)")
                        .foregroundStyle(.secondary)
                    Text(profile.ammoName).font(.callout).foregroundStyle(.secondary)
                    HStack(spacing: 6) {
                        Image(systemName: profile.zeroConfirmed ? "checkmark.seal.fill" : "scope")
                            .foregroundStyle(profile.zeroConfirmed ? Color.green : Color.secondary)
                        Text(zeroStatus(profile)).font(.callout)
                    }
                }
                .padding(.vertical, 4)

                Button { showNewSession = true } label: {
                    Label("New session", systemImage: "plus.circle.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 50)
                }
                .buttonStyle(.borderedProminent)
                .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
            }

            Section("Sessions") {
                let sessions = profile.sortedSessions
                if sessions.isEmpty {
                    Text("No sessions yet. Start one when you're at the range.")
                        .foregroundStyle(.secondary)
                }
                ForEach(sessions) { session in
                    NavigationLink(value: session) { sessionRow(session) }
                }
                .onDelete { offsets in deleteSessions(sessions, at: offsets) }
            }
        }
    }

    private func sessionRow(_ session: SightInSession) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(RangeFormat.distance(yards: session.distanceYards, unit: distanceUnit)).font(.headline)
                Spacer()
                Text(session.date, format: .dateTime.month().day().year())
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Text(groupCountText(session.groups.count))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(minHeight: 44)
    }

    private func groupCountText(_ count: Int) -> String {
        switch count {
        case 0: return "No groups"
        case 1: return "1 group"
        default: return "\(count) groups"
        }
    }

    private var noProfile: some View {
        ContentUnavailableView {
            Label("Choose a rifle", systemImage: "scope")
        } description: {
            Text(profiles.isEmpty
                 ? "Create a rifle profile in the Library tab first: firearm, ammo and scope."
                 : "Pick the rifle profile you're sighting in.")
        } actions: {
            if !profiles.isEmpty {
                Button("Choose rifle") { presentPicker() }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
            }
        }
    }

    /// ProfilePicker brings its own NavigationStack and dismisses itself.
    private var pickerSheet: some View {
        ProfilePicker(selection: $pickerSelection)
            .onChange(of: pickerSelection) { _, newValue in
                guard let newValue else { return }
                activeProfileID = newValue.id.uuidString
                showPicker = false
            }
    }

    // MARK: Actions

    /// Push a just-created session once the sheet is gone (pushing during
    /// the dismissal animation is unreliable).
    private func openCreatedSession() {
        guard let session = createdSession else { return }
        createdSession = nil
        path.append(session)
    }

    /// `-demoCapture <step>`: once per launch, after RootView's `-seedDemo`
    /// task has run, open the capture flow for the active profile's newest
    /// session (the seeded 100 yd one). Retries briefly while the seed lands.
    @MainActor
    private func presentDemoCaptureIfRequested() async {
        guard LaunchOptions.demoCaptureStep != nil, !didStartDemoCapture else { return }
        didStartDemoCapture = true
        for _ in 0..<10 {
            try? await Task.sleep(for: .milliseconds(500))
            if let session = activeProfile?.sortedSessions.first {
                demoCaptureSession = session
                return
            }
        }
    }

    private func presentPicker() {
        pickerSelection = activeProfile
        showPicker = true
    }

    private func zeroStatus(_ profile: RifleProfile) -> String {
        let zero = RangeFormat.distance(yards: profile.zeroRangeYards, unit: distanceUnit)
        if profile.zeroConfirmed, let at = profile.zeroConfirmedAt {
            return "\(zero) zero confirmed \(at.formatted(date: .abbreviated, time: .omitted))"
        }
        return "\(zero) zero · not confirmed"
    }

    private func deleteSessions(_ sessions: [SightInSession], at offsets: IndexSet) {
        for index in offsets where sessions.indices.contains(index) {
            let session = sessions[index]
            for group in session.groups {
                if let name = group.imageFileName { TargetImageStore.delete(name) }
            }
            path.removeAll { $0.id == session.id }
            session.profile?.sessions.removeAll { $0.id == session.id }
            context.delete(session)
        }
        try? context.save()
    }
}

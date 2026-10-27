import SwiftUI
import SwiftData
import ZeroInCore

/// Library tab: the shooter's saved rifle + load + scope profiles.
struct LibraryView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \RifleProfile.updatedAt, order: .reverse) private var profiles: [RifleProfile]
    @AppStorage(AppSettings.activeProfileIDKey) private var activeProfileID: String = ""
    @AppStorage(AppSettings.distanceUnitKey) private var distanceUnitRaw: String = DistanceUnit.yards.rawValue

    @State private var showingEditor = false
    @State private var pendingDelete: RifleProfile?

    private var distanceUnit: DistanceUnit { DistanceUnit(rawValue: distanceUnitRaw) ?? .yards }

    var body: some View {
        NavigationStack {
            Group {
                if profiles.isEmpty {
                    emptyState
                } else {
                    profileList
                }
            }
            .navigationTitle("Library")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingEditor = true
                    } label: {
                        Label("Add rifle", systemImage: "plus")
                    }
                }
            }
            .navigationDestination(for: RifleProfile.self) { profile in
                ProfileDetailView(profile: profile)
            }
            .sheet(isPresented: $showingEditor) {
                ProfileEditorView(profile: nil)
            }
            .confirmationDialog(
                "Delete \(pendingDelete?.name ?? "profile")?",
                isPresented: Binding(get: { pendingDelete != nil },
                                     set: { if !$0 { pendingDelete = nil } }),
                titleVisibility: .visible,
                presenting: pendingDelete
            ) { profile in
                Button("Delete profile and its sessions", role: .destructive) { delete(profile) }
                Button("Cancel", role: .cancel) {}
            } message: { _ in
                Text("This also deletes its range sessions and target groups.")
            }
        }
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No rifles yet", systemImage: "scope")
        } description: {
            Text("Save a rifle, load and scope to get trajectories and sight-in corrections.")
        } actions: {
            Button("Add your first rifle") { showingEditor = true }
                .buttonStyle(.borderedProminent)
        }
    }

    private var profileList: some View {
        List {
            ForEach(profiles) { profile in
                NavigationLink(value: profile) {
                    ProfileRowView(profile: profile,
                                   isActive: profile.id.uuidString == activeProfileID,
                                   distanceUnit: distanceUnit)
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        pendingDelete = profile
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
                .swipeActions(edge: .leading) {
                    Button {
                        activeProfileID = profile.id.uuidString
                    } label: {
                        Label("Make active", systemImage: "checkmark.circle")
                    }
                    .tint(.green)
                }
                .contextMenu {
                    Button {
                        activeProfileID = profile.id.uuidString
                    } label: {
                        Label("Make active", systemImage: "checkmark.circle")
                    }
                    Button {
                        duplicate(profile)
                    } label: {
                        Label("Duplicate", systemImage: "plus.square.on.square")
                    }
                    Button(role: .destructive) {
                        pendingDelete = profile
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
    }

    private func duplicate(_ profile: RifleProfile) {
        let copy = profile.duplicated()
        modelContext.insert(copy)
        try? modelContext.save()
    }

    private func delete(_ profile: RifleProfile) {
        if profile.id.uuidString == activeProfileID {
            activeProfileID = profiles.first { $0.id != profile.id }?.id.uuidString ?? ""
        }
        modelContext.delete(profile)
        try? modelContext.save()
        pendingDelete = nil
    }
}

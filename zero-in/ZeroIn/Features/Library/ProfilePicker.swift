import SwiftUI
import SwiftData
import ZeroInCore

/// Simple list sheet for choosing a profile; used by other tabs.
struct ProfilePicker: View {
    @Binding var selection: RifleProfile?

    @Environment(\.dismiss) private var dismiss
    @Query(sort: \RifleProfile.updatedAt, order: .reverse) private var profiles: [RifleProfile]

    var body: some View {
        NavigationStack {
            Group {
                if profiles.isEmpty {
                    ContentUnavailableView("No profiles yet",
                                           systemImage: "scope",
                                           description: Text("Add a rifle in the Library tab first."))
                } else {
                    List(profiles) { profile in
                        Button {
                            selection = profile
                            dismiss()
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(profile.name).font(.headline).foregroundStyle(.primary)
                                    Text(profile.firearmSummary).font(.subheadline).foregroundStyle(.secondary)
                                    Text(profile.ammoName).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                if profile.id == selection?.id {
                                    Image(systemName: "checkmark").foregroundStyle(Color.accentColor)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Choose profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

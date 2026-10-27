import SwiftUI
import ZeroInCore

/// Top of the Ballistics tab: the active profile, its load, and a way to switch.
struct ProfileHeaderSection: View {
    let profile: RifleProfile?
    let hasProfiles: Bool
    let units: UnitsFormatter
    let onChoose: () -> Void

    var body: some View {
        Section {
            if let profile {
                VStack(alignment: .leading, spacing: 4) {
                    Text(profile.name).font(.headline)
                    Text("\(profile.firearmName) · \(profile.caliberName)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(profile.loadSummary(units: units))
                        .font(.subheadline.monospacedDigit())
                }
                .padding(.vertical, 4)
                if hasProfiles {
                    Button {
                        onChoose()
                    } label: {
                        Label("Change profile", systemImage: "arrow.left.arrow.right")
                            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    }
                }
            } else if hasProfiles {
                Button {
                    onChoose()
                } label: {
                    Label("Choose a profile", systemImage: "person.crop.rectangle")
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                }
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    Label("No profiles yet", systemImage: "books.vertical")
                        .font(.headline)
                    Text("Create a rifle profile in the Library tab to see drop, wind and come-up for your load.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 8)
            }
        } header: {
            Text("Active profile")
        }
    }
}

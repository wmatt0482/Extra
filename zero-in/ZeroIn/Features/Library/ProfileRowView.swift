import SwiftUI
import ZeroInCore

/// One row of the Library list.
struct ProfileRowView: View {
    let profile: RifleProfile
    let isActive: Bool
    let distanceUnit: DistanceUnit

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: isActive ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(isActive ? Color.green : Color.secondary.opacity(0.4))
                .imageScale(.large)
                .accessibilityLabel(isActive ? "Active profile" : "Not active")
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(profile.name).font(.headline)
                    if profile.zeroConfirmed {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundStyle(Color.blue)
                            .accessibilityLabel("Zero confirmed")
                    }
                }
                Text(profile.firearmSummary)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(profile.ammoName)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text("Zero \(profile.zeroRangeText(unit: distanceUnit))")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 2)
    }
}

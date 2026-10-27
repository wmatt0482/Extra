import SwiftData
import SwiftUI
import UIKit
import ZeroInCore

/// One saved group in a session: thumbnail, size, correction, "dialed" toggle.
struct GroupRowView: View {
    let group: ShotGroupRecord
    let scope: ScopeSpec
    let distanceYards: Double
    let units: RangeUnits

    @Environment(\.modelContext) private var context

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            TargetThumbnail(fileName: group.imageFileName)
                .frame(width: 76, height: 76)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(group.label).font(.headline)
                    Spacer()
                    Text(group.createdAt, style: .time).font(.caption).foregroundStyle(.secondary)
                }
                Text(sizeLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(RangeFormat.clickSummary(group.correction, scope: scope))
                    .font(.title3.bold())
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                Toggle("Dialed", isOn: Binding(get: { group.correctionApplied },
                                               set: { group.correctionApplied = $0; try? context.save() }))
                    .font(.subheadline)
            }
        }
        .padding(.vertical, 4)
    }

    private var sizeLine: String {
        let es = Angular.angular(fromInches: group.extremeSpreadInches, atYards: distanceYards, unit: units.angular)
        let count = group.shotCount == 1 ? "1 shot" : "\(group.shotCount) shots"
        return "\(count) · ES \(RangeFormat.linear(inches: group.extremeSpreadInches, unit: units.linear)) (\(RangeFormat.angular(es, unit: units.angular))) · \(RangeFormat.offset(group.center, unit: units.linear))"
    }
}

/// Loads a saved target photo's thumbnail off the main thread.
struct TargetThumbnail: View {
    let fileName: String?
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8).fill(Color(.tertiarySystemFill))
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                Image(systemName: "target").font(.title2).foregroundStyle(.secondary)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .task(id: fileName) {
            image = await Self.loadThumbnail(fileName)
        }
    }

    static func loadThumbnail(_ fileName: String?) async -> UIImage? {
        guard let fileName else { return nil }
        return await Task.detached(priority: .utility) { () -> UIImage? in
            guard let full = TargetImageStore.load(fileName) else { return nil }
            let longSide = max(full.size.width, full.size.height)
            guard longSide > 0 else { return nil }
            let s = min(1, 240 / longSide)
            return full.preparingThumbnail(of: CGSize(width: full.size.width * s, height: full.size.height * s)) ?? full
        }.value
    }
}

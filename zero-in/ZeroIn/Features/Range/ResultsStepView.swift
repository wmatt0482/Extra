import SwiftData
import SwiftUI
import ZeroInCore

/// Step 5: overlay, stats, correction, save, and "I dialed this".
struct ResultsStepView: View {
    @Bindable var model: GroupCaptureModel
    let session: SightInSession
    var onSave: () -> Void

    @Environment(\.modelContext) private var context
    @AppStorage(AppSettings.angularUnitKey) private var angularRaw = AngularUnit.moa.rawValue
    @AppStorage(AppSettings.distanceUnitKey) private var distanceRaw = DistanceUnit.yards.rawValue
    @AppStorage(AppSettings.linearUnitKey) private var linearRaw = LinearUnit.inches.rawValue

    private var units: RangeUnits { RangeUnits(angularRaw: angularRaw, distanceRaw: distanceRaw, linearRaw: linearRaw) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let image = model.image {
                    TargetCanvasView(image: image, markers: model.markers, polylines: model.polylines,
                                     allowsPanZoom: false)
                        .frame(height: 300)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    legend
                }

                if let note = model.demoNote {
                    DemoNoteLabel(text: note)
                }

                if let line = expectedLine {
                    Label(line, systemImage: "scope")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }

                if let correction = model.correction {
                    CorrectionCard(correction: correction, scope: model.scope, displayUnit: units.angular)
                }
                if let stats = model.stats {
                    GroupStatsCard(stats: stats, distanceYards: model.distanceYards, units: units)
                }

                saveSection
            }
            .padding()
        }
    }

    private var expectedLine: String? {
        guard let profile = session.profile else { return nil }
        return RangeFormat.expectedImpactLine(expected: model.expectedImpact, zeroYards: profile.zeroRangeYards,
                                              sessionYards: model.distanceYards,
                                              distanceUnit: units.distance, linearUnit: units.linear)
    }

    private var legend: some View {
        HStack(spacing: 14) {
            legendItem(.green, "Aim")
            legendItem(.red, "Holes")
            legendItem(.yellow, "Group center")
            if model.expectedImpact != .zero { legendItem(.cyan, "Expected") }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }

    private func legendItem(_ color: Color, _ text: String) -> some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(text)
        }
    }

    @ViewBuilder
    private var saveSection: some View {
        if let record = model.savedRecord {
            Label("Saved as \(record.label)", systemImage: "checkmark.circle.fill")
                .font(.headline)
                .foregroundStyle(.green)
            Toggle(isOn: Binding(get: { record.correctionApplied },
                                 set: { record.correctionApplied = $0; try? context.save() })) {
                VStack(alignment: .leading) {
                    Text("I dialed this correction").font(.headline)
                    Text("Counts toward the session's net correction.").font(.caption).foregroundStyle(.secondary)
                }
            }
            .frame(minHeight: 50)
        } else {
            Button(action: onSave) {
                Label("Save group", systemImage: "square.and.arrow.down")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 54)
            }
            .buttonStyle(.borderedProminent)
            .disabled(model.stats == nil)
        }
    }
}

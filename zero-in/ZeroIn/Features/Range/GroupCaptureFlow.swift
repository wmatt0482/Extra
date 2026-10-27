import SwiftData
import SwiftUI
import UIKit
import ZeroInCore

/// Multi-step sheet: photo → scale → point of aim → holes → results/save.
struct GroupCaptureFlow: View {
    let session: SightInSession

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @State private var model: GroupCaptureModel
    @State private var saveError: String?

    init(session: SightInSession) {
        self.session = session
        _model = State(initialValue: GroupCaptureModel(distanceYards: session.distanceYards,
                                                       expectedImpact: Self.expectedImpact(for: session),
                                                       scope: session.profile?.scope ?? ScopeSpec()))
    }

    /// Where bullets should print at the session distance for the profile's
    /// zero: (0, 0) when sighting in at the zero range itself.
    static func expectedImpact(for session: SightInSession) -> Point2D {
        guard let profile = session.profile,
              abs(session.distanceYards - profile.zeroRangeYards) > 0.5 else { return .zero }
        let solver = BallisticSolver(projectile: profile.projectile, scope: profile.scope,
                                     conditions: session.conditions)
        let p = solver.expectedImpact(atYards: session.distanceYards)
        return (p.x.isFinite && p.y.isFinite) ? p : .zero
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                StepIndicator(current: model.step)
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                if model.step != .results { bottomBar }
            }
            .navigationTitle("Add group")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(model.savedRecord == nil ? "Cancel" : "Done") { dismiss() }
                }
                if model.step == .results && model.savedRecord == nil {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Back") { model.back() }
                    }
                }
            }
            .alert("Couldn't save the group", isPresented: Binding(get: { saveError != nil },
                                                                   set: { if !$0 { saveError = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(saveError ?? "")
            }
        }
        .interactiveDismissDisabled(model.image != nil && model.savedRecord == nil)
    }

    @ViewBuilder
    private var content: some View {
        switch model.step {
        case .photo:
            PhotoStepView(model: model)
        case .calibrate:
            CalibrateStepView(model: model)
        case .aim, .holes:
            MarkStepView(model: model)
        case .results:
            ResultsStepView(model: model, session: session, onSave: save)
        }
    }

    private var bottomBar: some View {
        HStack(spacing: 12) {
            if model.step != .photo {
                Button { model.back() } label: {
                    Label("Back", systemImage: "chevron.left").frame(maxWidth: .infinity, minHeight: 50)
                }
                .buttonStyle(.bordered)
            }
            Button { model.next() } label: {
                Label(model.step == .holes ? "See results" : "Next", systemImage: "chevron.right")
                    .labelStyle(TrailingIconLabelStyle())
                    .frame(maxWidth: .infinity, minHeight: 50)
            }
            .buttonStyle(.borderedProminent)
            .disabled(!model.canAdvance(from: model.step))
        }
        .font(.headline)
        .padding()
        .background(.bar)
    }

    private func save() {
        guard model.savedRecord == nil, let stats = model.stats, let correction = model.correction else { return }
        let record = ShotGroupRecord(session: session, label: "Group \(session.groups.count + 1)",
                                     shots: model.shotsInches, expectedImpact: model.expectedImpact,
                                     imageFileName: nil, stats: stats, correction: correction)
        if let image = model.image {
            let annotated = TargetAnnotator.render(image, markers: model.markers)
            record.imageFileName = try? TargetImageStore.save(annotated, id: record.id)
        }
        context.insert(record)
        record.session = session
        if !session.groups.contains(where: { $0.id == record.id }) {
            session.groups.append(record)
        }
        do {
            try context.save()
            model.savedRecord = record
        } catch {
            saveError = error.localizedDescription
            model.savedRecord = record   // it is still in the context; autosave will retry
        }
    }
}

/// "Photo · Scale · Aim · Holes · Results" with the current step highlighted.
private struct StepIndicator: View {
    let current: GroupCaptureModel.Step

    var body: some View {
        HStack(spacing: 4) {
            ForEach(GroupCaptureModel.Step.allCases) { step in
                VStack(spacing: 4) {
                    Capsule()
                        .fill(step.rawValue <= current.rawValue ? Color.accentColor : Color.secondary.opacity(0.3))
                        .frame(height: 4)
                    Text(step.title)
                        .font(.caption2.weight(step == current ? .bold : .regular))
                        .foregroundStyle(step == current ? .primary : .secondary)
                }
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Step \(current.rawValue + 1) of \(GroupCaptureModel.Step.allCases.count): \(current.title)")
    }
}

private struct TrailingIconLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 6) {
            configuration.title
            configuration.icon
        }
    }
}

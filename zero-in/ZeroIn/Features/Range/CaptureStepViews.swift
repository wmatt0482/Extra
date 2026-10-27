import PhotosUI
import SwiftUI
import UIKit
import ZeroInCore

// MARK: - Step 1: photo

struct PhotoStepView: View {
    @Bindable var model: GroupCaptureModel
    @State private var pickerItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var isLoading = false
    @State private var loadError: String?

    var body: some View {
        VStack(spacing: 16) {
            Group {
                if let image = model.image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                } else if isLoading {
                    ProgressView("Loading photo…")
                } else {
                    ContentUnavailableView("Photograph the target", systemImage: "camera.viewfinder",
                                           description: Text("Shoot square-on, fill the frame, and include the whole target or a printed grid."))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if let loadError {
                Text(loadError).font(.footnote).foregroundStyle(.red)
            }

            HStack(spacing: 12) {
                Button { showCamera = true } label: {
                    Label("Camera", systemImage: "camera").frame(maxWidth: .infinity, minHeight: 50)
                }
                .buttonStyle(.borderedProminent)
                .disabled(!CameraPicker.isAvailable)

                PhotosPicker(selection: $pickerItem, matching: .images) {
                    Label("Library", systemImage: "photo.on.rectangle").frame(maxWidth: .infinity, minHeight: 50)
                }
                .buttonStyle(.bordered)
            }
            .font(.headline)

            VStack(spacing: 4) {
                Button {
                    loadError = nil
                    model.useSampleTarget()
                } label: {
                    Label("Use a sample target", systemImage: "target").frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.bordered)
                .font(.subheadline.weight(.semibold))
                .disabled(isLoading)
                Text("Practice the flow on a printed-style target")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { model.setPhoto($0) }
                .ignoresSafeArea()
        }
        .onChange(of: pickerItem) { _, item in
            guard let item else { return }
            Task { await load(item) }
        }
    }

    @MainActor
    private func load(_ item: PhotosPickerItem) async {
        isLoading = true
        loadError = nil
        defer {
            isLoading = false
            pickerItem = nil
        }
        do {
            if let data = try await item.loadTransferable(type: Data.self), let image = UIImage(data: data) {
                model.setPhoto(image)
            } else {
                loadError = "That photo couldn't be read."
            }
        } catch {
            loadError = error.localizedDescription
        }
    }
}

// MARK: - Step 2: scale

struct CalibrateStepView: View {
    @Bindable var model: GroupCaptureModel
    @AppStorage(AppSettings.linearUnitKey) private var linearRaw = LinearUnit.inches.rawValue

    private var linear: LinearUnit { LinearUnit(rawValue: linearRaw) ?? .inches }
    private var targets: [CatalogTarget] { CatalogStore.shared.catalog.targets }

    var body: some View {
        VStack(spacing: 0) {
            if let image = model.image {
                TargetCanvasView(image: image, markers: model.markers, polylines: model.polylines,
                                 onTap: { p, r in model.handleTap(at: p, hitRadius: r) },
                                 onMoveMarker: { id, p in model.moveMarker(id: id, to: p) })
            }
            controls
        }
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("Method", selection: Binding(get: { model.method }, set: { model.setMethod($0) })) {
                ForEach(GroupCaptureModel.CalibrationMethod.allCases) { Text($0.title).tag($0) }
            }
            .pickerStyle(.segmented)

            HStack {
                Picker("Target", selection: Binding(get: { model.selectedTargetID },
                                                    set: { id in model.applyPreset(targets.first { $0.id == id }) })) {
                    Text("Custom size").tag(String?.none)
                    ForEach(targets) { Text($0.name).tag(Optional($0.id)) }
                }
                .pickerStyle(.menu)
                Spacer()
                if model.method == .knownDistance {
                    lengthField("Distance", value: $model.knownInches)
                } else {
                    lengthField("W", value: $model.targetWidthInches)
                    Text("×")
                    lengthField("H", value: $model.targetHeightInches)
                }
                Text(linear.label).foregroundStyle(.secondary)
            }

            HStack(alignment: .firstTextBaseline) {
                Text(instruction).font(.callout)
                Spacer()
                Button("Undo") { model.undoLast() }
                    .disabled(model.calibrationPoints.isEmpty)
                    .frame(minHeight: 44)
            }
        }
        .padding()
        .background(.bar)
    }

    private func lengthField(_ title: String, value: Binding<Double>) -> some View {
        TextField(title, value: Binding(get: { linear.fromInches(value.wrappedValue) },
                                        set: { value.wrappedValue = linear.toInches($0) }),
                  format: .number.precision(.fractionLength(0...3)))
            .keyboardType(.decimalPad)
            .multilineTextAlignment(.trailing)
            .textFieldStyle(.roundedBorder)
            .frame(width: 76)
    }

    private var instruction: String {
        let n = model.calibrationPoints.count
        let needed = model.method.pointCount
        if n < needed {
            if model.method == .knownDistance {
                return "Tap two points a known distance apart (e.g. grid lines): point \(n + 1) of 2."
            }
            return "Tap the target's corners in order. Next: \(model.calibrationLabels[n])."
        }
        if let cal = model.calibration {
            return "Scale ≈ \(RangeFormat.number(cal.pixelsPerInch / linear.fromInches(1), digits: 0)) px/\(linear.label). Drag points to fine-tune."
        }
        return "Those corners don't form a valid rectangle. Drag them into place or Undo."
    }
}

// MARK: - Steps 3 & 4: point of aim and holes

struct MarkStepView: View {
    @Bindable var model: GroupCaptureModel

    var body: some View {
        VStack(spacing: 0) {
            if let image = model.image {
                TargetCanvasView(image: image, markers: model.markers, polylines: model.polylines,
                                 onTap: { p, r in model.handleTap(at: p, hitRadius: r) },
                                 onMoveMarker: { id, p in model.moveMarker(id: id, to: p) })
            }
            VStack(alignment: .leading, spacing: 10) {
                if model.step == .aim { aimControls } else { holeControls }
            }
            .padding()
            .background(.bar)
        }
    }

    private var aimControls: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(model.poaPixel == nil
                 ? "Tap the center of the bull — your point of aim."
                 : "Point of aim set. Drag it to fine-tune or tap elsewhere to move it.")
                .font(.callout)
            Spacer()
        }
    }

    @ViewBuilder
    private var holeControls: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("\(model.holes.count) hole\(model.holes.count == 1 ? "" : "s")")
                .font(.title2.bold())
                .monospacedDigit()
            Text("Tap each hole. Tap a marker to remove it; drag to nudge.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        HStack(spacing: 12) {
            Button {
                Task { await model.autoDetect() }
            } label: {
                HStack {
                    if model.isDetecting { ProgressView() } else { Image(systemName: "wand.and.stars") }
                    Text("Auto-detect")
                }
                .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.bordered)
            .disabled(model.isDetecting)

            if model.holes.contains(where: \.isSuggested) {
                Button("Clear suggestions") { model.clearSuggestions() }
                    .frame(minHeight: 44)
            }
            Button("Undo") { model.undoLast() }
                .disabled(model.holes.isEmpty)
                .frame(minHeight: 44)
        }
        if let message = model.detectionMessage {
            Text(message).font(.footnote).foregroundStyle(.secondary)
        }
        if let note = model.demoNote {
            DemoNoteLabel(text: note)
        }
    }
}

/// The `-demoCapture` caption: what auto-detect found on the sample target.
struct DemoNoteLabel: View {
    let text: String

    var body: some View {
        Label(text, systemImage: "wand.and.stars")
            .font(.caption)
            .foregroundStyle(.secondary)
    }
}

import Foundation
import Observation
import SwiftUI
import UIKit
import ZeroInCore

/// State for the multi-step "add a group" flow. Every position is stored in
/// image pixels; target inches are derived through the calibration.
@Observable
final class GroupCaptureModel {
    enum Step: Int, CaseIterable, Identifiable {
        case photo, calibrate, aim, holes, results
        var id: Int { rawValue }
        var title: String {
            switch self {
            case .photo: return "Photo"
            case .calibrate: return "Scale"
            case .aim: return "Aim"
            case .holes: return "Holes"
            case .results: return "Results"
            }
        }
    }

    enum CalibrationMethod: String, CaseIterable, Identifiable {
        case knownDistance, corners
        var id: String { rawValue }
        var title: String { self == .knownDistance ? "Known distance" : "Target corners" }
        var pointCount: Int { self == .knownDistance ? 2 : 4 }
    }

    struct Hole: Identifiable, Equatable {
        let id = UUID()
        var pixel: Point2D
        var isSuggested: Bool
    }

    // Context (fixed for the flow)
    let distanceYards: Double
    let expectedImpact: Point2D
    let scope: ScopeSpec
    /// One bullet hole's diameter for auto-detect: the profile's bullet
    /// diameter + 0.02 in when known, else the usual .30-cal tear.
    let nominalHoleDiameterInches: Double

    // Step 1
    var step: Step = .photo
    var image: UIImage?

    // Step 2
    /// Change via `setMethod(_:)` so stale points are cleared.
    private(set) var method: CalibrationMethod = .knownDistance
    var selectedTargetID: String?
    var knownInches: Double = 1
    var targetWidthInches: Double = 8.5
    var targetHeightInches: Double = 11
    var bullDiameterInches: Double?
    var calibrationPoints: [Point2D] = []

    // Step 3 / 4
    var poaPixel: Point2D?
    var holes: [Hole] = []
    var isDetecting = false
    var detectionMessage: String?
    /// Set only by `applyDemo(step:)`: what auto-detect found on the sample
    /// target, shown on the Holes and Results steps (CI screenshots).
    var demoNote: String?

    // After saving
    var savedRecord: ShotGroupRecord?

    init(distanceYards: Double, expectedImpact: Point2D, scope: ScopeSpec,
         nominalHoleDiameterInches: Double = HoleDetector.defaultNominalHoleDiameterInches) {
        self.distanceYards = distanceYards
        self.expectedImpact = expectedImpact
        self.scope = scope
        self.nominalHoleDiameterInches = (nominalHoleDiameterInches > 0 && nominalHoleDiameterInches.isFinite)
            ? nominalHoleDiameterInches : HoleDetector.defaultNominalHoleDiameterInches
    }

    // MARK: Photo

    /// Bakes orientation and downsizes to ≤ `maxDimension` px on the long side
    /// at scale 1, so `image.size` is the pixel size used everywhere.
    static func prepared(_ source: UIImage, maxDimension: CGFloat = 2000) -> UIImage {
        let pixelW = source.size.width * source.scale, pixelH = source.size.height * source.scale
        guard pixelW > 0, pixelH > 0 else { return source }
        let factor = min(1, maxDimension / max(pixelW, pixelH))
        let size = CGSize(width: (pixelW * factor).rounded(), height: (pixelH * factor).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            source.draw(in: CGRect(origin: .zero, size: size))
        }
    }

    /// `prepare: false` keeps the image exactly as given (it must already be
    /// upright and at scale 1); used for the sample target, whose ground-truth
    /// pixel positions must not be rescaled.
    func setPhoto(_ source: UIImage, prepare: Bool = true) {
        image = prepare ? Self.prepared(source) : source
        calibrationPoints = []
        poaPixel = nil
        holes = []
        detectionMessage = nil
        demoNote = nil
        savedRecord = nil
    }

    /// Loads the synthetic practice target (`SampleTarget`) as the photo and
    /// moves on to calibration, as if the shooter had taken that picture.
    func useSampleTarget() {
        setPhoto(SampleTarget.render(), prepare: false)
        step = .calibrate
    }

    // MARK: Calibration

    func setMethod(_ newMethod: CalibrationMethod) {
        guard newMethod != method else { return }
        method = newMethod
        calibrationPoints = []
    }

    func applyPreset(_ target: CatalogTarget?) {
        selectedTargetID = target?.id
        guard let target else { bullDiameterInches = nil; return }
        knownInches = target.gridSpacingInches ?? target.widthInches
        targetWidthInches = target.widthInches
        targetHeightInches = target.heightInches
        bullDiameterInches = target.bullDiameterInches
    }

    var calibrationLabels: [String] {
        method == .knownDistance ? ["1", "2"] : ["TL", "TR", "BR", "BL"]
    }

    var calibrationComplete: Bool {
        guard calibrationPoints.count == method.pointCount else { return false }
        return method == .knownDistance ? knownInches > 0 : (targetWidthInches > 0 && targetHeightInches > 0)
    }

    /// The calibration (needs the POA; before it is set, the image center stands in).
    var calibration: TargetCalibration? {
        guard calibrationComplete, let image else { return nil }
        let poa = poaPixel ?? Point2D(x: Double(image.size.width) / 2, y: Double(image.size.height) / 2)
        switch method {
        case .knownDistance:
            return TargetCalibration.twoPoint(a: calibrationPoints[0], b: calibrationPoints[1],
                                              knownInches: knownInches, poaPixel: poa)
        case .corners:
            return TargetCalibration.fourCorner(corners: calibrationPoints, widthInches: targetWidthInches,
                                                heightInches: targetHeightInches, poaPixel: poa)
        }
    }

    // MARK: Results

    var shotsInches: [Point2D] {
        guard let cal = calibration, poaPixel != nil else { return [] }
        return holes.map { cal.targetPoint(fromPixel: $0.pixel) }
    }

    var stats: GroupStats? { GroupAnalyzer.stats(shotsInches) }

    /// In the scope's click unit so click counts are exact.
    var correction: Correction? {
        guard let stats else { return nil }
        return GroupAnalyzer.correction(groupCenter: stats.center, expectedImpact: expectedImpact,
                                        distanceYards: distanceYards, unit: scope.clickUnit)
    }

    // MARK: Navigation

    func canAdvance(from s: Step) -> Bool {
        switch s {
        case .photo: return image != nil
        case .calibrate: return calibrationComplete && calibration != nil
        case .aim: return poaPixel != nil
        case .holes: return !holes.isEmpty && calibration != nil
        case .results: return false
        }
    }

    func next() {
        guard canAdvance(from: step), let n = Step(rawValue: step.rawValue + 1) else { return }
        step = n
    }

    func back() {
        guard savedRecord == nil, let p = Step(rawValue: step.rawValue - 1) else { return }
        step = p
    }

    // MARK: Canvas interaction

    func handleTap(at pixel: Point2D, hitRadius: Double) {
        switch step {
        case .calibrate:
            if calibrationPoints.count < method.pointCount { calibrationPoints.append(pixel) }
        case .aim:
            poaPixel = pixel
        case .holes:
            if let i = holes.indices.min(by: { holes[$0].pixel.distance(to: pixel) < holes[$1].pixel.distance(to: pixel) }),
               holes[i].pixel.distance(to: pixel) <= hitRadius {
                holes.remove(at: i)
            } else {
                holes.append(Hole(pixel: pixel, isSuggested: false))
            }
        case .photo, .results:
            break
        }
    }

    func moveMarker(id: String, to pixel: Point2D) {
        if id == "poa" {
            poaPixel = pixel
        } else if id.hasPrefix("cal-"), let i = Int(id.dropFirst(4)), calibrationPoints.indices.contains(i) {
            calibrationPoints[i] = pixel
        } else if id.hasPrefix("hole-"), let i = holes.firstIndex(where: { "hole-\($0.id.uuidString)" == id }) {
            holes[i].pixel = pixel
        }
    }

    func undoLast() {
        switch step {
        case .calibrate: if !calibrationPoints.isEmpty { calibrationPoints.removeLast() }
        case .aim: poaPixel = nil
        case .holes: if !holes.isEmpty { holes.removeLast() }
        default: break
        }
    }

    // MARK: Markers

    private var calibrationMarkers: [CanvasMarker] {
        calibrationPoints.enumerated().map { i, p in
            CanvasMarker(id: "cal-\(i)", kind: .calibration, pixel: p,
                         label: calibrationLabels.indices.contains(i) ? calibrationLabels[i] : nil,
                         draggable: step == .calibrate)
        }
    }

    private var poaMarker: [CanvasMarker] {
        guard let poaPixel else { return [] }
        return [CanvasMarker(id: "poa", kind: .poa, pixel: poaPixel, label: "POA", draggable: step == .aim)]
    }

    private var holeMarkers: [CanvasMarker] {
        holes.map {
            CanvasMarker(id: "hole-\($0.id.uuidString)", kind: $0.isSuggested ? .suggestedHole : .hole,
                         pixel: $0.pixel, draggable: step == .holes)
        }
    }

    var markers: [CanvasMarker] {
        switch step {
        case .photo: return []
        case .calibrate: return calibrationMarkers
        case .aim: return calibrationMarkers + poaMarker
        case .holes: return poaMarker + holeMarkers
        case .results: return poaMarker + holeMarkers + resultMarkers
        }
    }

    private var resultMarkers: [CanvasMarker] {
        guard let cal = calibration, let stats else { return [] }
        var out = [CanvasMarker(id: "center", kind: .groupCenter, pixel: cal.pixel(fromTargetPoint: stats.center))]
        if expectedImpact != .zero {
            out.append(CanvasMarker(id: "expected", kind: .expectedImpact,
                                    pixel: cal.pixel(fromTargetPoint: expectedImpact), label: "Expected"))
        }
        return out
    }

    var polylines: [CanvasPolyline] {
        switch step {
        case .calibrate, .aim:
            guard calibrationPoints.count >= 2 else { return [] }
            return [CanvasPolyline(id: "cal", points: calibrationPoints, closed: method == .corners, color: .blue)]
        case .results:
            guard let cal = calibration, let stats else { return [] }
            return [CanvasPolyline(id: "corr", points: [cal.pixel(fromTargetPoint: stats.center),
                                                        cal.pixel(fromTargetPoint: expectedImpact)], color: .yellow)]
        default:
            return []
        }
    }

    // MARK: Auto-detect

    @MainActor
    func autoDetect() async {
        guard let image, let cal = calibration, !isDetecting else { return }
        isDetecting = true
        detectionMessage = nil
        let bullRadiusPixels = bullDiameterInches.map { $0 / 2 * cal.pixelsPerInch }
        let found = await HoleDetector.detect(in: image, pixelsPerInch: cal.pixelsPerInch,
                                              nominalHoleDiameterInches: nominalHoleDiameterInches,
                                              poaPixel: poaPixel, excludeRadiusPixels: bullRadiusPixels,
                                              existing: holes.map(\.pixel))
        holes.append(contentsOf: found.map { Hole(pixel: $0, isSuggested: true) })
        detectionMessage = found.isEmpty
            ? "No holes found automatically. Tap each hole instead."
            : "Added \(found.count) suggestion\(found.count == 1 ? "" : "s") (orange). Tap any wrong one to remove it."
        isDetecting = false
    }

    func clearSuggestions() {
        holes.removeAll { $0.isSuggested }
    }

    // MARK: Demo (`-demoCapture <step>`)

    /// Loads the sample target and fills in its ground truth up to `name`
    /// ("photo", "calibrate", "aim", "holes" or "results"), then shows that
    /// step. Holes come from the real auto-detect; only if it finds nothing are
    /// the sample's known hole positions used. Unknown names do nothing.
    @MainActor
    func applyDemo(step name: String) async {
        let target: Step
        switch name.lowercased() {
        case "photo": target = .photo
        case "calibrate", "scale": target = .calibrate
        case "aim": target = .aim
        case "holes": target = .holes
        case "results": target = .results
        default: return
        }

        setPhoto(SampleTarget.render(), prepare: false)
        step = .photo
        guard target.rawValue >= Step.calibrate.rawValue else { return }

        // Two grid intersections 1.00 in apart.
        setMethod(.knownDistance)
        knownInches = SampleTarget.calibrationInches
        calibrationPoints = SampleTarget.calibrationPixels
        step = .calibrate
        guard target.rawValue >= Step.aim.rawValue else { return }

        poaPixel = SampleTarget.poaPixel
        step = .aim
        guard target.rawValue >= Step.holes.rawValue else { return }

        await autoDetect()
        let found = holes.count
        if found == 0 {
            holes = SampleTarget.shotPixels.map { Hole(pixel: $0, isSuggested: false) }
            demoNote = "Auto-detect found 0 holes · using sample positions"
        } else {
            let matched = Self.matchedCount(detected: holes.map(\.pixel), truth: SampleTarget.shotPixels,
                                            tolerance: 0.15 * SampleTarget.pixelsPerInch)
            demoNote = "Auto-detect found \(found) hole\(found == 1 ? "" : "s") · "
                + "\(matched) of \(SampleTarget.shotPixels.count) match the sample"
        }
        step = target
    }

    /// Greedy one-to-one pairing: repeatedly takes the closest remaining
    /// (detection, true hole) pair within `tolerance`, so each detection
    /// accounts for at most one true hole. Returns the number of true holes paired.
    static func matchedCount(detected: [Point2D], truth: [Point2D], tolerance: Double) -> Int {
        var pairs: [(distance: Double, detection: Int, truth: Int)] = []
        for (i, p) in detected.enumerated() {
            for (j, t) in truth.enumerated() {
                let distance = p.distance(to: t)
                if distance <= tolerance { pairs.append((distance: distance, detection: i, truth: j)) }
            }
        }
        pairs.sort { $0.distance < $1.distance }
        var usedDetections = Set<Int>(), usedTruth = Set<Int>()
        for pair in pairs where !usedDetections.contains(pair.detection) && !usedTruth.contains(pair.truth) {
            usedDetections.insert(pair.detection)
            usedTruth.insert(pair.truth)
        }
        return usedTruth.count
    }
}

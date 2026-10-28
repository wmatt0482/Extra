import CoreImage
import CoreImage.CIFilterBuiltins
import Foundation
import UIKit
import Vision
import ZeroInCore

/// Best-effort bullet-hole finder. Suggestions only: the shooter always
/// reviews them, and manual taps remain the primary path.
enum HoleDetector {
    /// Lets a CGImage cross into the detached task.
    private struct ImageBox: @unchecked Sendable { let cgImage: CGImage }

    /// The usual .30-cal tear, used when the bullet diameter is unknown.
    static let defaultNominalHoleDiameterInches = 0.30

    /// Returns candidate hole centers in image pixels (+y down).
    /// - pixelsPerInch: from the calibration; with `nominalHoleDiameterInches`
    ///   it gives one hole's size in pixels, which sizes the blob filters and
    ///   splits blobs of touching holes (see `BlobSplitter`).
    /// - nominalHoleDiameterInches: one hole's diameter (bullet diameter +
    ///   0.02 in when known); non-positive values fall back to the default.
    /// - excludeRadiusPixels: ignore anything this close to the POA (printed bull).
    /// - existing: holes already marked; candidates on top of them are skipped.
    /// Best-effort: returns [] on any failure.
    static func detect(in image: UIImage, pixelsPerInch: Double,
                       nominalHoleDiameterInches: Double = HoleDetector.defaultNominalHoleDiameterInches,
                       poaPixel: Point2D?, excludeRadiusPixels: Double?, existing: [Point2D]) async -> [Point2D] {
        guard let cg = image.cgImage, pixelsPerInch > 0, pixelsPerInch.isFinite else { return [] }
        let holeInches = (nominalHoleDiameterInches > 0 && nominalHoleDiameterInches.isFinite)
            ? nominalHoleDiameterInches : defaultNominalHoleDiameterInches
        let holeDiameterPixels = holeInches * pixelsPerInch
        let box = ImageBox(cgImage: cg)
        return await Task.detached(priority: .userInitiated) {
            HoleDetector.detectSync(box.cgImage, holeDiameterPixels: holeDiameterPixels, poaPixel: poaPixel,
                                    excludeRadiusPixels: excludeRadiusPixels, existing: existing)
        }.value
    }

    private static func detectSync(_ cgImage: CGImage, holeDiameterPixels: Double, poaPixel: Point2D?,
                                   excludeRadiusPixels: Double?, existing: [Point2D]) -> [Point2D] {
        let width = Double(cgImage.width), height = Double(cgImage.height)
        guard width > 0, height > 0, holeDiameterPixels > 0, holeDiameterPixels.isFinite else { return [] }
        let d = holeDiameterPixels

        // Grayscale, boost contrast, then hard threshold so holes are solid blobs.
        let gray = CIFilter.colorControls()
        gray.inputImage = CIImage(cgImage: cgImage)
        gray.saturation = 0
        gray.contrast = 1.6
        let threshold = CIFilter.colorThreshold()
        threshold.inputImage = gray.outputImage
        threshold.threshold = 0.35
        guard let prepared = threshold.outputImage else { return [] }

        let request = VNDetectContoursRequest()
        request.detectsDarkOnLight = true
        request.contrastAdjustment = 1.0
        request.maximumImageDimension = 1024
        let handler = VNImageRequestHandler(ciImage: prepared, options: [:])
        do {
            try handler.perform([request])
        } catch {
            return []
        }
        guard let observation = request.results?.first else { return [] }

        // Candidates closer than this to an earlier blob's or an already
        // marked hole are duplicates. Centers split from one blob may sit
        // closer together than this and are all kept.
        let minSeparation = 0.5 * d
        var found: [Point2D] = []
        for index in 0..<observation.contourCount {
            guard let contour = try? observation.contour(at: index) else { continue }
            // Normalized coordinates, origin bottom-left. Cheap size check
            // first: half a hole up to a little over four holes across.
            let box = contour.normalizedPath.boundingBox
            let boxWidth = Double(box.width) * width, boxHeight = Double(box.height) * height
            guard boxWidth > 0, boxHeight > 0,
                  max(boxWidth, boxHeight) >= 0.5 * d, max(boxWidth, boxHeight) <= 4.5 * d else { continue }
            let polygon: [Point2D] = contour.normalizedPoints.map { point in
                Point2D(x: Double(point.x) * width, y: (1 - Double(point.y)) * height)
            }
            let centers = BlobSplitter.holeCenters(polygon: polygon, nominalDiameter: d)
            var accepted: [Point2D] = []
            for center in centers {
                if let poa = poaPixel, let r = excludeRadiusPixels, center.distance(to: poa) < r { continue }
                if found.contains(where: { $0.distance(to: center) < minSeparation }) { continue }
                if existing.contains(where: { $0.distance(to: center) < minSeparation }) { continue }
                accepted.append(center)
            }
            found.append(contentsOf: accepted)
            if found.count >= 40 { break }
        }
        return found
    }
}

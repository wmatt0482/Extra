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

    /// Returns candidate hole centers in image pixels (+y down).
    /// - pixelsPerInch: from the calibration, used to keep blobs ~0.15"–0.6" across.
    /// - excludeRadiusPixels: ignore anything this close to the POA (printed bull).
    /// - existing: holes already marked; candidates on top of them are skipped.
    static func detect(in image: UIImage, pixelsPerInch: Double, poaPixel: Point2D?,
                       excludeRadiusPixels: Double?, existing: [Point2D]) async -> [Point2D] {
        guard let cg = image.cgImage, pixelsPerInch > 0 else { return [] }
        let box = ImageBox(cgImage: cg)
        return await Task.detached(priority: .userInitiated) {
            HoleDetector.detectSync(box.cgImage, pixelsPerInch: pixelsPerInch, poaPixel: poaPixel,
                       excludeRadiusPixels: excludeRadiusPixels, existing: existing)
        }.value
    }

    private static func detectSync(_ cgImage: CGImage, pixelsPerInch: Double, poaPixel: Point2D?,
                                   excludeRadiusPixels: Double?, existing: [Point2D]) -> [Point2D] {
        let width = Double(cgImage.width), height = Double(cgImage.height)
        guard width > 0, height > 0 else { return [] }

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

        let minDiameter = 0.15 * pixelsPerInch, maxDiameter = 0.6 * pixelsPerInch
        var found: [Point2D] = []
        for index in 0..<observation.contourCount {
            guard let contour = try? observation.contour(at: index) else { continue }
            // Normalized coordinates, origin bottom-left.
            let box = contour.normalizedPath.boundingBox
            let w = Double(box.width) * width, h = Double(box.height) * height
            guard w > 0, h > 0 else { continue }
            guard min(w, h) / max(w, h) >= 0.6 else { continue }            // roughly round
            let diameter = (w + h) / 2
            guard diameter >= minDiameter, diameter <= maxDiameter else { continue }
            let center = Point2D(x: Double(box.midX) * width, y: (1 - Double(box.midY)) * height)
            if let poa = poaPixel, let r = excludeRadiusPixels, center.distance(to: poa) < r { continue }
            let minSeparation = diameter * 0.75
            if found.contains(where: { $0.distance(to: center) < minSeparation }) { continue }
            if existing.contains(where: { $0.distance(to: center) < minSeparation }) { continue }
            found.append(center)
            if found.count >= 40 { break }
        }
        return found
    }
}

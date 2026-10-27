import Foundation

/// Maps photo pixels (+y down) to target inches relative to the point of aim
/// (+x right, +y up), and back.
public struct TargetCalibration: Codable, Hashable, Sendable {
    /// Pixel → target inches (POA at the origin, +y up).
    public let pixelToTarget: Homography
    /// Target inches → pixel.
    public let targetToPixel: Homography
    /// Approximate pixels per inch near the POA (for sizing hole markers),
    /// from the local Jacobian of `targetToPixel` at the origin.
    public let pixelsPerInch: Double

    /// Builds a calibration from any pixel → target homography. nil when it
    /// is not invertible.
    public init?(pixelToTarget: Homography) {
        guard let inverse = pixelToTarget.inverted() else { return nil }
        self.init(pixelToTarget: pixelToTarget, targetToPixel: inverse)
    }

    private init(pixelToTarget: Homography, targetToPixel: Homography) {
        self.pixelToTarget = pixelToTarget
        self.targetToPixel = targetToPixel
        let area = targetToPixel.areaScale(at: .zero)
        self.pixelsPerInch = area.isFinite ? area.squareRoot() : 0
    }

    /// Two-point scale: `a` and `b` are pixel positions `knownInches` apart;
    /// `poaPixel` is the point of aim. Assumes the photo is square to the
    /// target and upright (no rotation or perspective correction).
    /// Degenerate input (coincident points, non-positive distance) falls back
    /// to 1 px per inch rather than producing non-finite values.
    public static func twoPoint(a: Point2D, b: Point2D, knownInches: Double, poaPixel: Point2D) -> TargetCalibration {
        let pixels = a.distance(to: b)
        let inches = abs(knownInches)
        let ppi = (pixels > 1e-9 && inches > 1e-9 && pixels.isFinite && inches.isFinite) ? pixels / inches : 1
        let s = 1 / ppi   // inches per pixel
        let toTarget = Homography(m: [s, 0, -s * poaPixel.x,
                                      0, -s, s * poaPixel.y,
                                      0, 0, 1])
        let toPixel = Homography(m: [ppi, 0, poaPixel.x,
                                     0, -ppi, poaPixel.y,
                                     0, 0, 1])
        return TargetCalibration(pixelToTarget: toTarget, targetToPixel: toPixel)
    }

    /// Four-corner homography: pixel corners of a rectangle of known physical
    /// size, in order top-left, top-right, bottom-right, bottom-left. Corrects
    /// perspective from an off-axis photo. nil for degenerate input.
    public static func fourCorner(corners: [Point2D], widthInches: Double, heightInches: Double,
                                  poaPixel: Point2D) -> TargetCalibration? {
        guard corners.count == 4, widthInches > 0, heightInches > 0 else { return nil }
        // Rectangle in target inches with its top-left at the origin, +y up.
        let rect = [Point2D(x: 0, y: 0), Point2D(x: widthInches, y: 0),
                    Point2D(x: widthInches, y: -heightInches), Point2D(x: 0, y: -heightInches)]
        guard let toRect = Homography.fit(from: corners, to: rect) else { return nil }
        let poaInRect = toRect.apply(poaPixel)
        guard poaInRect.x.isFinite, poaInRect.y.isFinite else { return nil }
        let toTarget = Homography.translation(dx: -poaInRect.x, dy: -poaInRect.y) * toRect
        return TargetCalibration(pixelToTarget: toTarget)
    }

    /// Pixel → target inches relative to POA (+y up).
    public func targetPoint(fromPixel p: Point2D) -> Point2D {
        pixelToTarget.apply(p)
    }

    /// Target inches → pixel (for drawing overlays).
    public func pixel(fromTargetPoint t: Point2D) -> Point2D {
        targetToPixel.apply(t)
    }
}

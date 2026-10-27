import UIKit
import ZeroInCore

/// A synthetic, photo-like target for practicing the capture flow (and for the
/// CI screenshots of it): a 12 × 18 in sheet with a 1 in grid and a 1 in orange
/// bull, lying on a cardboard backdrop, with five bullet holes.
///
/// The holes are the DemoData group: centered 0.75 in left and 1.50 in low of
/// the bull (UP 6 / RIGHT 3 clicks on a 1/4-MOA scope at 100 yd). Everything is
/// drawn upright and square-on at exactly `pixelsPerInch`, so the ground-truth
/// pixel positions below are exact as long as the image is used at its native
/// size (see `GroupCaptureModel.useSampleTarget()`).
enum SampleTarget {
    /// Print resolution of the paper in the rendered image.
    static let pixelsPerInch: Double = 120
    /// Paper size in inches (width × height).
    static let paperSize = CGSize(width: 12, height: 18)
    /// Backdrop visible around the paper on every side, pixels.
    static let marginPixels: Double = 16
    /// Rendered image size in pixels (scale 1): the paper plus the margin.
    static let imageSize = CGSize(width: Double(SampleTarget.paperSize.width) * SampleTarget.pixelsPerInch + 2 * SampleTarget.marginPixels,
                                  height: Double(SampleTarget.paperSize.height) * SampleTarget.pixelsPerInch + 2 * SampleTarget.marginPixels)
    /// The center of the bull (= the paper center = the image center), pixels.
    static let poaPixel = Point2D(x: Double(SampleTarget.imageSize.width) / 2,
                                  y: Double(SampleTarget.imageSize.height) / 2)
    /// Bullet hole diameter, inches.
    static let holeDiameterInches: Double = 0.30
    /// Bull diameter, inches.
    static let bullDiameterInches: Double = 1

    /// Group center in target inches (+x right, +y up from the bull).
    static let groupCenterInches = Point2D(x: -0.75, y: -1.5)
    /// Each shot relative to the group center, inches (they sum to zero).
    static let shotOffsetsInches = [Point2D(x: 0.35, y: 0.2), Point2D(x: -0.4, y: 0.1), Point2D(x: 0.1, y: -0.35),
                                    Point2D(x: -0.1, y: 0.3), Point2D(x: 0.05, y: -0.25)]
    /// Shot centers in target inches.
    static let shotsInches: [Point2D] = SampleTarget.shotOffsetsInches.map { SampleTarget.groupCenterInches + $0 }
    /// Shot centers in image pixels (+y down).
    static let shotPixels: [Point2D] = SampleTarget.shotsInches.map { SampleTarget.pixel(forTargetInches: $0) }

    /// Two grid intersections exactly `calibrationInches` apart (up and right of
    /// the bull, clear of the holes), for a known-distance calibration.
    static let calibrationPixels: [Point2D] = [SampleTarget.pixel(forTargetInches: Point2D(x: 2, y: 3)),
                                               SampleTarget.pixel(forTargetInches: Point2D(x: 3, y: 3))]
    static let calibrationInches: Double = 1

    /// Target inches (relative to the bull, +y up) → image pixels (+y down).
    static func pixel(forTargetInches p: Point2D) -> Point2D {
        Point2D(x: poaPixel.x + p.x * pixelsPerInch, y: poaPixel.y - p.y * pixelsPerInch)
    }

    // MARK: Rendering

    /// Draws the target at scale 1, `imageSize` pixels. Deterministic: the
    /// same image every time.
    static func render() -> UIImage {
        let size = imageSize
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            let cg = ctx.cgContext
            var rng = SeededGenerator(seed: 0x5EED_2E50)
            Self.drawBackdrop(cg, size: size)
            Self.drawPaper(cg)
            Self.drawGrid(cg)
            Self.drawBull(cg)
            Self.drawLabel()
            for p in Self.shotPixels {
                Self.drawHole(cg, at: CGPoint(x: p.x, y: p.y), rng: &rng)
            }
            Self.drawLighting(cg, size: size)
            Self.drawNoise(cg, size: size, rng: &rng)
        }
    }

    private static var paperRect: CGRect {
        CGRect(x: marginPixels, y: marginPixels,
               width: Double(paperSize.width) * pixelsPerInch, height: Double(paperSize.height) * pixelsPerInch)
    }

    private static func rgb(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat = 1) -> CGColor {
        UIColor(red: r, green: g, blue: b, alpha: a).cgColor
    }

    /// Cardboard target backer, a little darker than the paper.
    private static func drawBackdrop(_ cg: CGContext, size: CGSize) {
        cg.setFillColor(rgb(0.60, 0.51, 0.40))
        cg.fill(CGRect(origin: .zero, size: size))
    }

    /// Off-white sheet with a soft drop shadow.
    private static func drawPaper(_ cg: CGContext) {
        cg.saveGState()
        cg.setShadow(offset: CGSize(width: 2, height: 4), blur: 8, color: rgb(0, 0, 0, 0.35))
        cg.setFillColor(rgb(0.97, 0.96, 0.93))
        cg.fill(paperRect)
        cg.restoreGState()
    }

    /// Light-gray 1 in grid; lines pass through the bull center.
    private static func drawGrid(_ cg: CGContext) {
        let rect = paperRect
        let step = CGFloat(pixelsPerInch)
        cg.saveGState()
        cg.setStrokeColor(rgb(0.80, 0.82, 0.84))
        cg.setLineWidth(2)
        for k in 0...Int(paperSize.width) {
            let x = rect.minX + CGFloat(k) * step
            cg.move(to: CGPoint(x: x, y: rect.minY))
            cg.addLine(to: CGPoint(x: x, y: rect.maxY))
        }
        for k in 0...Int(paperSize.height) {
            let y = rect.minY + CGFloat(k) * step
            cg.move(to: CGPoint(x: rect.minX, y: y))
            cg.addLine(to: CGPoint(x: rect.maxX, y: y))
        }
        cg.strokePath()
        cg.restoreGState()
    }

    /// Solid orange bull, `bullDiameterInches` across, at the paper center.
    private static func drawBull(_ cg: CGContext) {
        let r = CGFloat(bullDiameterInches / 2 * pixelsPerInch)
        let c = CGPoint(x: poaPixel.x, y: poaPixel.y)
        cg.setFillColor(rgb(0.98, 0.46, 0.08))
        cg.fillEllipse(in: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))
    }

    /// Small printed caption along the top edge (kept small and light so the
    /// hole detector ignores it).
    private static func drawLabel() {
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 18, weight: .semibold),
            .foregroundColor: UIColor(red: 0.62, green: 0.63, blue: 0.65, alpha: 1),
        ]
        let text = "ZEROIN SAMPLE TARGET  ·  1 IN GRID" as NSString
        text.draw(at: CGPoint(x: paperRect.minX + 14, y: paperRect.minY + 10), withAttributes: attributes)
    }

    /// A dark, slightly ragged hole about `holeDiameterInches` across, with a
    /// faint gray rim of torn paper.
    private static func drawHole(_ cg: CGContext, at center: CGPoint, rng: inout SeededGenerator) {
        let radius = CGFloat(holeDiameterInches / 2 * pixelsPerInch)
        let rim = radius * 1.2
        cg.setFillColor(rgb(0.45, 0.43, 0.40, 0.30))
        cg.fillEllipse(in: CGRect(x: center.x - rim, y: center.y - rim, width: rim * 2, height: rim * 2))

        let vertexCount = 20
        let phase = Double.random(in: 0..<(2 * Double.pi), using: &rng)
        let path = CGMutablePath()
        for i in 0..<vertexCount {
            let angle = phase + Double(i) / Double(vertexCount) * 2 * Double.pi
            let r = radius * CGFloat(Double.random(in: 0.9...1.07, using: &rng))
            let p = CGPoint(x: center.x + r * CGFloat(cos(angle)), y: center.y + r * CGFloat(sin(angle)))
            if i == 0 { path.move(to: p) } else { path.addLine(to: p) }
        }
        path.closeSubpath()
        cg.addPath(path)
        cg.setFillColor(rgb(0.07, 0.06, 0.06))
        cg.fillPath()
    }

    /// Uneven light (brighter top-left) and a mild vignette, like a phone photo.
    private static func drawLighting(_ cg: CGContext, size: CGSize) {
        let space = CGColorSpaceCreateDeviceRGB()
        let linearColors = [rgb(1, 1, 1, 0.07), rgb(0, 0, 0, 0.06)] as CFArray
        if let gradient = CGGradient(colorsSpace: space, colors: linearColors, locations: [0, 1]) {
            cg.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: size.width, y: size.height), options: [])
        }
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let halfDiagonal = (size.width * size.width + size.height * size.height).squareRoot() / 2
        let vignetteColors = [rgb(0, 0, 0, 0), rgb(0, 0, 0, 0.12)] as CFArray
        if let gradient = CGGradient(colorsSpace: space, colors: vignetteColors, locations: [0, 1]) {
            cg.drawRadialGradient(gradient, startCenter: center, startRadius: halfDiagonal * 0.45,
                                  endCenter: center, endRadius: halfDiagonal, options: [.drawsAfterEndLocation])
        }
    }

    /// Fine sensor-style speckle (1–2 px, very faint) so the image isn't flat.
    private static func drawNoise(_ cg: CGContext, size: CGSize, rng: inout SeededGenerator) {
        let width = Double(size.width), height = Double(size.height)
        for _ in 0..<12_000 {
            let x = Double.random(in: 0..<width, using: &rng)
            let y = Double.random(in: 0..<height, using: &rng)
            let side = Double.random(in: 1...2, using: &rng)
            let white: CGFloat = Bool.random(using: &rng) ? 1 : 0
            let alpha = CGFloat(Double.random(in: 0.03...0.08, using: &rng))
            cg.setFillColor(rgb(white, white, white, alpha))
            cg.fill(CGRect(x: CGFloat(x), y: CGFloat(y), width: CGFloat(side), height: CGFloat(side)))
        }
    }
}

/// SplitMix64: a tiny deterministic generator so the sample image is identical
/// on every run.
private struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed
    }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}

import UIKit
import ZeroInCore

/// Burns the markers into a copy of the photo for the saved thumbnail, so a
/// group's holes and center are visible later without the calibration.
enum TargetAnnotator {
    static func render(_ image: UIImage, markers: [CanvasMarker]) -> UIImage {
        let size = image.size
        let unit = max(size.width, size.height) / 120   // marker size scales with the photo
        let format = UIGraphicsImageRendererFormat()
        format.scale = image.scale
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            image.draw(in: CGRect(origin: .zero, size: size))
            let cg = ctx.cgContext
            cg.setLineWidth(max(2, unit / 4))
            for marker in markers {
                let p = CGPoint(x: marker.pixel.x, y: marker.pixel.y)
                switch marker.kind {
                case .hole, .suggestedHole:
                    cg.setStrokeColor(UIColor.systemRed.cgColor)
                    cg.strokeEllipse(in: CGRect(x: p.x - unit, y: p.y - unit, width: unit * 2, height: unit * 2))
                case .poa:
                    cg.setStrokeColor(UIColor.systemGreen.cgColor)
                    cg.move(to: CGPoint(x: p.x - unit * 1.5, y: p.y))
                    cg.addLine(to: CGPoint(x: p.x + unit * 1.5, y: p.y))
                    cg.move(to: CGPoint(x: p.x, y: p.y - unit * 1.5))
                    cg.addLine(to: CGPoint(x: p.x, y: p.y + unit * 1.5))
                    cg.strokePath()
                case .groupCenter:
                    cg.setFillColor(UIColor.systemYellow.cgColor)
                    cg.fillEllipse(in: CGRect(x: p.x - unit * 0.6, y: p.y - unit * 0.6, width: unit * 1.2, height: unit * 1.2))
                case .expectedImpact:
                    cg.setStrokeColor(UIColor.systemCyan.cgColor)
                    cg.strokeEllipse(in: CGRect(x: p.x - unit * 1.2, y: p.y - unit * 1.2, width: unit * 2.4, height: unit * 2.4))
                case .calibration:
                    break
                }
            }
        }
    }
}

import Foundation

/// Maps between image pixels (+y down, origin top-left) and view points for an
/// image drawn aspect-fit inside a view, then zoomed by `zoom` and panned by
/// (`panX`, `panY`) view points. Pure value math so the app's target canvas
/// can keep every coordinate conversion in one tested place.
///
///     scale  = fitScale × zoom                     (view points per pixel)
///     origin = (view − image × scale) / 2 + pan    (image top-left, view points)
///     view   = origin + pixel × scale
public struct CanvasTransform: Hashable, Sendable {
    public var imageWidth: Double
    public var imageHeight: Double
    public var viewWidth: Double
    public var viewHeight: Double
    public var zoom: Double
    public var panX: Double
    public var panY: Double

    public static let minZoom = 1.0
    public static let maxZoom = 12.0

    public init(imageWidth: Double, imageHeight: Double, viewWidth: Double, viewHeight: Double,
                zoom: Double = 1, panX: Double = 0, panY: Double = 0) {
        self.imageWidth = imageWidth
        self.imageHeight = imageHeight
        self.viewWidth = viewWidth
        self.viewHeight = viewHeight
        self.zoom = zoom
        self.panX = panX
        self.panY = panY
    }

    /// Aspect-fit scale at zoom 1.
    public var fitScale: Double {
        guard imageWidth > 0, imageHeight > 0, viewWidth > 0, viewHeight > 0 else { return 1 }
        return min(viewWidth / imageWidth, viewHeight / imageHeight)
    }

    /// View points per image pixel.
    public var scale: Double { fitScale * zoom }

    public var originX: Double { (viewWidth - imageWidth * scale) / 2 + panX }
    public var originY: Double { (viewHeight - imageHeight * scale) / 2 + panY }

    /// Displayed image size in view points.
    public var displayedWidth: Double { imageWidth * scale }
    public var displayedHeight: Double { imageHeight * scale }

    public func viewPoint(fromPixel p: Point2D) -> Point2D {
        Point2D(x: originX + p.x * scale, y: originY + p.y * scale)
    }

    public func pixel(fromViewPoint v: Point2D) -> Point2D {
        let s = scale > 0 ? scale : 1
        return Point2D(x: (v.x - originX) / s, y: (v.y - originY) / s)
    }

    /// Converts a length in view points to image pixels.
    public func pixels(fromViewLength length: Double) -> Double {
        scale > 0 ? length / scale : length
    }

    public func isInsideImage(_ p: Point2D) -> Bool {
        p.x >= 0 && p.y >= 0 && p.x <= imageWidth && p.y <= imageHeight
    }

    /// The pixel moved to the nearest point inside the image.
    public func clampedToImage(_ p: Point2D) -> Point2D {
        Point2D(x: min(max(p.x, 0), imageWidth), y: min(max(p.y, 0), imageHeight))
    }

    /// Same transform with the pan limited so the image cannot be pushed out
    /// of view: an edge can travel past the view's edge by at most `slack`
    /// (fraction of the view size), which lets corners be brought inward.
    public func clampedPan(slack: Double = 0.4) -> CanvasTransform {
        var t = self
        let maxX = max(0, (displayedWidth - viewWidth) / 2) + viewWidth * slack
        let maxY = max(0, (displayedHeight - viewHeight) / 2) + viewHeight * slack
        t.panX = min(max(panX, -maxX), maxX)
        t.panY = min(max(panY, -maxY), maxY)
        return t
    }

    /// Same transform at `newZoom` (clamped to min/max), keeping the pixel
    /// under the view point `anchor` fixed on screen.
    public func zoomed(to newZoom: Double, anchor: Point2D) -> CanvasTransform {
        let z = min(max(newZoom, Self.minZoom), Self.maxZoom)
        let p = pixel(fromViewPoint: anchor)
        var t = self
        t.zoom = z
        let s = t.scale
        t.panX = anchor.x - p.x * s - (viewWidth - imageWidth * s) / 2
        t.panY = anchor.y - p.y * s - (viewHeight - imageHeight * s) / 2
        return t
    }
}

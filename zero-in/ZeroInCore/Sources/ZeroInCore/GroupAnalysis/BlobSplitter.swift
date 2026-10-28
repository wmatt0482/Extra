import Foundation

/// Turns the outline of one dark blob found on a target photo into bullet-hole
/// centers. Holes in a tight group touch or overlap, and an image-based
/// detector then sees several holes as one blob; this estimates how many holes
/// the blob holds from its area (relative to one nominal hole) and its
/// elongation, and spreads that many centers along its long axis.
///
/// Pure geometry on a polygon in pixels (any orientation, either winding), so
/// it is shared by the app's Vision-based detector and unit tests.
public enum BlobSplitter {
    /// Area, centroid and principal-axis extents of a blob outline.
    public struct Shape: Hashable, Sendable {
        /// Polygon area, pixels².
        public let area: Double
        /// Area centroid, pixels.
        public let centroid: Point2D
        /// Unit vector along the principal (long) axis.
        public let axis: Point2D
        /// Extent of the outline along `axis`, pixels.
        public let length: Double
        /// Extent of the outline across `axis`, pixels.
        public let width: Double
        /// `area` divided by the area of one nominal hole, π (d/2)².
        public let areaRatio: Double
    }

    /// At or above this area ratio a blob is always treated as several holes.
    public static let splitAreaRatio = 1.6
    /// Heavily overlapping pairs (centers well under one diameter apart) cover
    /// less than 1.6 holes of area but are clearly elongated: a blob at least
    /// this much longer than wide, with at least `elongatedSplitAreaRatio` of
    /// area, is also split. A single torn hole stays under ~1.2 : 1. The area
    /// floor is below 1 because the nominal diameter (bullet + 0.02 in) is
    /// usually a little larger than the tear the paper actually shows.
    public static let splitElongation = 1.25
    public static let elongatedSplitAreaRatio = 0.9
    /// Most holes placed in one blob.
    public static let maxHolesPerBlob = 4

    /// The blob's shape measures, or nil for a degenerate outline (fewer than
    /// three points, zero area, non-finite values) or a non-positive diameter.
    public static func shape(of polygon: [Point2D], nominalDiameter: Double) -> Shape? {
        guard polygon.count >= 3, nominalDiameter > 0, nominalDiameter.isFinite else { return nil }
        // Shoelace sums for area, first and second moments (Green's theorem),
        // relative to the first vertex for numerical stability.
        let origin = polygon[0]
        let count = polygon.count
        var twiceArea = 0.0
        var sumX = 0.0, sumY = 0.0
        var sumXX = 0.0, sumYY = 0.0, sumXY = 0.0
        for i in 0..<count {
            let p = polygon[i] - origin
            let q = polygon[(i + 1) % count] - origin
            let cross = p.x * q.y - q.x * p.y
            twiceArea += cross
            sumX += (p.x + q.x) * cross
            sumY += (p.y + q.y) * cross
            sumXX += (p.x * p.x + p.x * q.x + q.x * q.x) * cross
            sumYY += (p.y * p.y + p.y * q.y + q.y * q.y) * cross
            sumXY += (p.x * q.y + 2 * p.x * p.y + 2 * q.x * q.y + q.x * p.y) * cross
        }
        let signedArea = twiceArea / 2
        guard signedArea.isFinite, abs(signedArea) > 1e-9 else { return nil }
        // Dividing by the signed area makes the moments independent of winding.
        let meanX = sumX / (6 * signedArea)
        let meanY = sumY / (6 * signedArea)
        let covXX = sumXX / (12 * signedArea) - meanX * meanX
        let covYY = sumYY / (12 * signedArea) - meanY * meanY
        let covXY = sumXY / (24 * signedArea) - meanX * meanY
        // Largest-eigenvalue eigenvector of the 2×2 covariance.
        let theta = 0.5 * atan2(2 * covXY, covXX - covYY)
        let axis = Point2D(x: cos(theta), y: sin(theta))
        let centroid = origin + Point2D(x: meanX, y: meanY)

        var alongMin = Double.infinity, alongMax = -Double.infinity
        var acrossMin = Double.infinity, acrossMax = -Double.infinity
        for point in polygon {
            let v = point - centroid
            let along = v.x * axis.x + v.y * axis.y
            let across = v.y * axis.x - v.x * axis.y
            alongMin = min(alongMin, along)
            alongMax = max(alongMax, along)
            acrossMin = min(acrossMin, across)
            acrossMax = max(acrossMax, across)
        }
        let area = abs(signedArea)
        let ratio = area / (Double.pi * nominalDiameter * nominalDiameter / 4)
        let length = alongMax - alongMin, width = acrossMax - acrossMin
        guard centroid.x.isFinite, centroid.y.isFinite, axis.x.isFinite, axis.y.isFinite,
              length.isFinite, width.isFinite, ratio.isFinite else { return nil }
        return Shape(area: area, centroid: centroid, axis: axis, length: length, width: width, areaRatio: ratio)
    }

    /// Whether a blob is treated as several merged holes.
    public static func isMerged(_ shape: Shape) -> Bool {
        if shape.areaRatio >= splitAreaRatio { return true }
        return shape.areaRatio >= elongatedSplitAreaRatio && shape.length >= splitElongation * shape.width
    }

    /// Hole centers for one blob outline, in the polygon's coordinates.
    /// `nominalDiameter` is one hole's diameter in the same units (pixels).
    ///
    /// - One hole: roughly round (short/long ≥ 0.6), 0.5–2 diameters across;
    ///   the center is the area centroid.
    /// - Merged holes: n = round(area ratio) clamped to 2...4, placed evenly
    ///   along the principal axis through the centroid, spaced so the outer
    ///   centers sit half a hole diameter in from the blob's ends (spacing
    ///   clamped to 0.3–1.0 diameters). The blob must be 0.6–2 diameters wide
    ///   (rejects grid lines and other thin marks), at most ~4 holes long and
    ///   hold at most ~4 holes of area.
    /// - Anything else (or degenerate input): [].
    public static func holeCenters(polygon: [Point2D], nominalDiameter d: Double) -> [Point2D] {
        guard let s = shape(of: polygon, nominalDiameter: d), s.length > 0, s.width > 0 else { return [] }
        if !isMerged(s) {
            let size = (s.length + s.width) / 2
            guard s.width / s.length >= 0.6, size >= 0.5 * d, size <= 2 * d else { return [] }
            return [s.centroid]
        }
        guard s.width >= 0.6 * d, s.width <= 2 * d,
              s.length <= (Double(maxHolesPerBlob) + 0.25) * d,
              s.areaRatio <= Double(maxHolesPerBlob) + 0.8 else { return [] }
        let n = min(max(Int(s.areaRatio.rounded()), 2), maxHolesPerBlob)
        // In a row of holes the blob's width is one hole's actual diameter,
        // which may be a little under nominal (paper closes up, edge pixels).
        let holeDiameter = min(s.width, d)
        let rawSpacing = (s.length - holeDiameter) / Double(n - 1)
        let spacing = min(max(rawSpacing, 0.3 * d), d)
        return (0..<n).map { k in
            let offset = (Double(k) - Double(n - 1) / 2) * spacing
            return s.centroid + s.axis * offset
        }
    }
}

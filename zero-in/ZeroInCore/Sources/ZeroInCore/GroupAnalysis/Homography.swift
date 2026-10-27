import Foundation

/// 3×3 projective transform, row-major:
///
///     | m0 m1 m2 |   | x |
///     | m3 m4 m5 | · | y |   then divide by the third component.
///     | m6 m7 m8 |   | 1 |
///
/// Used by `TargetCalibration`; public for tests.
public struct Homography: Codable, Hashable, Sendable {
    public var m: [Double]   // 9 values

    public init(m: [Double]) {
        precondition(m.count == 9, "Homography needs 9 values")
        self.m = m
    }

    public static let identity = Homography(m: [1, 0, 0, 0, 1, 0, 0, 0, 1])

    /// Pure translation by (dx, dy).
    public static func translation(dx: Double, dy: Double) -> Homography {
        Homography(m: [1, 0, dx, 0, 1, dy, 0, 0, 1])
    }

    /// Matrix product. `(a * b).apply(p) == a.apply(b.apply(p))`.
    public static func * (a: Homography, b: Homography) -> Homography {
        var r = [Double](repeating: 0, count: 9)
        for row in 0..<3 {
            for col in 0..<3 {
                var s = 0.0
                for k in 0..<3 { s += a.m[row * 3 + k] * b.m[k * 3 + col] }
                r[row * 3 + col] = s
            }
        }
        return Homography(m: r)
    }

    /// Direct linear transform from exactly 4 point correspondences (no three
    /// collinear). Coordinates are Hartley-normalized first for numerical
    /// stability, then the 8×8 system (h33 = 1) is solved by Gaussian
    /// elimination with partial pivoting. Returns nil for degenerate input.
    public static func fit(from src: [Point2D], to dst: [Point2D]) -> Homography? {
        guard src.count == 4, dst.count == 4 else { return nil }
        guard let ts = normalizingTransform(src), let td = normalizingTransform(dst),
              let tdInv = td.inverted() else { return nil }
        let s = src.map { ts.apply($0) }
        let d = dst.map { td.apply($0) }

        var rows: [[Double]] = []
        for i in 0..<4 {
            let x = s[i].x, y = s[i].y, u = d[i].x, v = d[i].y
            rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
            rows.append([0, 0, 0, x, y, 1, -v * x, -v * y, v])
        }
        guard let h = solveLinearSystem(rows) else { return nil }
        let normalized = Homography(m: h + [1])
        let result = (tdInv * normalized * ts).scaledToUnitCorner()
        guard result.m.allSatisfy({ $0.isFinite }), result.inverted() != nil else { return nil }
        return result
    }

    /// Maps a point, including the perspective divide. Returns non-finite
    /// coordinates for points on the transform's line at infinity.
    public func apply(_ p: Point2D) -> Point2D {
        let w = m[6] * p.x + m[7] * p.y + m[8]
        let x = m[0] * p.x + m[1] * p.y + m[2]
        let y = m[3] * p.x + m[4] * p.y + m[5]
        return Point2D(x: x / w, y: y / w)
    }

    /// Inverse via the adjugate and determinant. nil when (nearly) singular.
    public func inverted() -> Homography? {
        let a = m[0], b = m[1], c = m[2]
        let d = m[3], e = m[4], f = m[5]
        let g = m[6], h = m[7], i = m[8]
        let det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
        let scale = m.map { abs($0) }.max() ?? 0
        guard det.isFinite, scale > 0, abs(det) > 1e-12 * scale * scale * scale else { return nil }
        let adj = [e * i - f * h, c * h - b * i, b * f - c * e,
                   f * g - d * i, a * i - c * g, c * d - a * f,
                   d * h - e * g, b * g - a * h, a * e - b * d]
        return Homography(m: adj.map { $0 / det }).scaledToUnitCorner()
    }

    /// |det J| of the mapping at `p`: how much a tiny area around `p` is
    /// scaled (destination area per unit source area).
    public func areaScale(at p: Point2D) -> Double {
        let w = m[6] * p.x + m[7] * p.y + m[8]
        let q = apply(p)
        let dudx = (m[0] - q.x * m[6]) / w
        let dudy = (m[1] - q.x * m[7]) / w
        let dvdx = (m[3] - q.y * m[6]) / w
        let dvdy = (m[4] - q.y * m[7]) / w
        return abs(dudx * dvdy - dudy * dvdx)
    }

    /// Same transform with m8 scaled to 1 (when it is safely non-zero).
    func scaledToUnitCorner() -> Homography {
        guard abs(m[8]) > 1e-12 else { return self }
        return Homography(m: m.map { $0 / m[8] })
    }

    /// Hartley normalization: centroid to the origin, mean distance √2.
    static func normalizingTransform(_ pts: [Point2D]) -> Homography? {
        let n = Double(pts.count)
        let c = pts.reduce(Point2D.zero, +) / n
        let meanDist = pts.reduce(0) { $0 + $1.distance(to: c) } / n
        guard meanDist > 1e-12, meanDist.isFinite else { return nil }
        let s = 2.0.squareRoot() / meanDist
        return Homography(m: [s, 0, -s * c.x, 0, s, -s * c.y, 0, 0, 1])
    }

    /// Solves A·x = b for an n×(n+1) augmented matrix by Gaussian elimination
    /// with partial pivoting. nil when singular.
    static func solveLinearSystem(_ augmented: [[Double]]) -> [Double]? {
        var a = augmented
        let n = a.count
        guard n > 0, a.allSatisfy({ $0.count == n + 1 }) else { return nil }
        for col in 0..<n {
            var pivot = col
            for r in (col + 1)..<max(col + 1, n) where abs(a[r][col]) > abs(a[pivot][col]) {
                pivot = r
            }
            guard abs(a[pivot][col]) > 1e-12 else { return nil }
            if pivot != col { a.swapAt(pivot, col) }
            for r in (col + 1)..<max(col + 1, n) {
                let factor = a[r][col] / a[col][col]
                if factor == 0 { continue }
                for k in col...n { a[r][k] -= factor * a[col][k] }
            }
        }
        var x = [Double](repeating: 0, count: n)
        for r in stride(from: n - 1, through: 0, by: -1) {
            var s = a[r][n]
            for k in (r + 1)..<max(r + 1, n) { s -= a[r][k] * x[k] }
            x[r] = s / a[r][r]
        }
        return x
    }
}

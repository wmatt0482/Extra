import Foundation

/// A 2-D point. In target space the units are inches relative to the point of
/// aim, +x to the shooter's right and +y up. In image space the units are
/// pixels with +y down (the usual bitmap convention).
public struct Point2D: Codable, Hashable, Sendable {
    public var x: Double
    public var y: Double

    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }

    public static let zero = Point2D(x: 0, y: 0)

    public static func + (a: Point2D, b: Point2D) -> Point2D { Point2D(x: a.x + b.x, y: a.y + b.y) }
    public static func - (a: Point2D, b: Point2D) -> Point2D { Point2D(x: a.x - b.x, y: a.y - b.y) }
    public static func * (a: Point2D, s: Double) -> Point2D { Point2D(x: a.x * s, y: a.y * s) }
    public static func / (a: Point2D, s: Double) -> Point2D { Point2D(x: a.x / s, y: a.y / s) }

    public var length: Double { (x * x + y * y).squareRoot() }
    public func distance(to other: Point2D) -> Double { (self - other).length }
}

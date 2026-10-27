import Foundation

/// Summary statistics for one group of shots, in target space (inches relative
/// to the point of aim, +x right, +y up).
public struct GroupStats: Codable, Hashable, Sendable {
    public var shotCount: Int
    /// Mean point of impact, target inches from POA.
    public var center: Point2D
    /// Center-to-center distance of the two farthest shots, inches.
    public var extremeSpreadInches: Double
    /// Mean distance of shots from `center`, inches.
    public var meanRadiusInches: Double
    /// max x - min x, inches.
    public var horizontalSpreadInches: Double
    /// max y - min y, inches.
    public var verticalSpreadInches: Double
    /// Population standard deviation of the shots' distances from `center`, inches.
    public var radialStdDevInches: Double

    public init(shotCount: Int, center: Point2D, extremeSpreadInches: Double, meanRadiusInches: Double,
                horizontalSpreadInches: Double, verticalSpreadInches: Double, radialStdDevInches: Double) {
        self.shotCount = shotCount
        self.center = center
        self.extremeSpreadInches = extremeSpreadInches
        self.meanRadiusInches = meanRadiusInches
        self.horizontalSpreadInches = horizontalSpreadInches
        self.verticalSpreadInches = verticalSpreadInches
        self.radialStdDevInches = radialStdDevInches
    }

    /// Extreme spread as an angle at the given range.
    public func extremeSpread(in unit: AngularUnit, atYards: Double) -> Double {
        Angular.angular(fromInches: extremeSpreadInches, atYards: atYards, unit: unit)
    }

    /// Mean radius as an angle at the given range.
    public func meanRadius(in unit: AngularUnit, atYards: Double) -> Double {
        Angular.angular(fromInches: meanRadiusInches, atYards: atYards, unit: unit)
    }
}

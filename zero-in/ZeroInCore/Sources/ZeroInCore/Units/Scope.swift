import Foundation

/// Describes the sighting system on a firearm: turret click value, sight height
/// over bore, and the range the shooter wants it zeroed at.
public struct ScopeSpec: Codable, Hashable, Sendable {
    /// Value of one turret click in `clickUnit` (e.g. 0.25 MOA, 0.1 MIL).
    public var clickValue: Double
    public var clickUnit: AngularUnit
    /// Height of the optical centerline above the bore centerline, inches.
    public var sightHeightInches: Double
    /// Intended zero range, yards.
    public var zeroRangeYards: Double

    public init(clickValue: Double = 0.25, clickUnit: AngularUnit = .moa,
                sightHeightInches: Double = 1.5, zeroRangeYards: Double = 100) {
        self.clickValue = clickValue
        self.clickUnit = clickUnit
        self.sightHeightInches = sightHeightInches
        self.zeroRangeYards = zeroRangeYards
    }

    public static let quarterMOA = ScopeSpec(clickValue: 0.25, clickUnit: .moa)
    public static let tenthMIL = ScopeSpec(clickValue: 0.1, clickUnit: .mil)
}

/// A scope adjustment. Signs follow turret labeling: positive elevation means
/// dial UP (impact moves up); positive windage means dial RIGHT (impact moves right).
public struct Correction: Codable, Hashable, Sendable {
    public var elevation: Double
    public var windage: Double
    public var unit: AngularUnit

    public init(elevation: Double, windage: Double, unit: AngularUnit) {
        self.elevation = elevation
        self.windage = windage
        self.unit = unit
    }

    public func converted(to target: AngularUnit) -> Correction {
        Correction(elevation: Angular.convert(elevation, from: unit, to: target),
                   windage: Angular.convert(windage, from: unit, to: target),
                   unit: target)
    }

    /// Whole clicks on the given scope, rounded to nearest. Signs as above.
    public func clicks(on scope: ScopeSpec) -> (elevation: Int, windage: Int) {
        let c = converted(to: scope.clickUnit)
        guard scope.clickValue > 0 else { return (0, 0) }
        return (Int((c.elevation / scope.clickValue).rounded()),
                Int((c.windage / scope.clickValue).rounded()))
    }

    /// Leftover error after dialing whole clicks, in `unit`.
    public func residual(on scope: ScopeSpec) -> Correction {
        let k = clicks(on: scope)
        let dialed = Correction(elevation: Double(k.elevation) * scope.clickValue,
                                windage: Double(k.windage) * scope.clickValue,
                                unit: scope.clickUnit).converted(to: unit)
        return Correction(elevation: elevation - dialed.elevation,
                          windage: windage - dialed.windage, unit: unit)
    }

    public var elevationDirection: TurretDirection { TurretDirection.vertical(elevation) }
    public var windageDirection: TurretDirection { TurretDirection.horizontal(windage) }
}

public enum TurretDirection: String, Codable, Sendable {
    case up = "UP", down = "DOWN", left = "LEFT", right = "RIGHT", none = "—"

    static func vertical(_ v: Double, deadband: Double = 1e-9) -> TurretDirection {
        if v > deadband { return .up }
        if v < -deadband { return .down }
        return .none
    }

    static func horizontal(_ v: Double, deadband: Double = 1e-9) -> TurretDirection {
        if v > deadband { return .right }
        if v < -deadband { return .left }
        return .none
    }
}

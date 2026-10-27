import Foundation

/// Angular units used for scope adjustments and trajectory output.
///
/// Conventions used throughout ZeroInCore:
/// - 1 MOA (true minute of angle) subtends 1.047197551 inches at 100 yards.
/// - 1 MIL (milliradian) subtends 3.6 inches at 100 yards.
/// - 1 IPHY ("shooter's MOA") subtends exactly 1.0 inch at 100 yards.
public enum AngularUnit: String, Codable, CaseIterable, Hashable, Sendable {
    case moa
    case mil
    case iphy

    /// Inches subtended at exactly 100 yards by one unit.
    public var inchesPerHundredYards: Double {
        switch self {
        case .moa: return 1.047_197_551
        case .mil: return 3.6
        case .iphy: return 1.0
        }
    }

    /// Short label for UI ("MOA", "MIL", "IPHY").
    public var label: String {
        switch self {
        case .moa: return "MOA"
        case .mil: return "MIL"
        case .iphy: return "IPHY"
        }
    }

    /// Radians per one unit (used by the ballistic solver for launch angles).
    public var radians: Double {
        switch self {
        case .moa: return .pi / 10_800
        case .mil: return 0.001
        case .iphy: return atan(1.0 / 3600.0)
        }
    }
}

/// Linear distance units for ranges (the app's internal math is always yards).
public enum DistanceUnit: String, Codable, CaseIterable, Hashable, Sendable {
    case yards
    case meters

    public var label: String {
        switch self {
        case .yards: return "yd"
        case .meters: return "m"
        }
    }

    public func toYards(_ value: Double) -> Double {
        switch self {
        case .yards: return value
        case .meters: return value / 0.9144
        }
    }

    public func fromYards(_ yards: Double) -> Double {
        switch self {
        case .yards: return yards
        case .meters: return yards * 0.9144
        }
    }
}

/// Linear units for drop / group size on the target.
public enum LinearUnit: String, Codable, CaseIterable, Hashable, Sendable {
    case inches
    case centimeters

    public var label: String {
        switch self {
        case .inches: return "in"
        case .centimeters: return "cm"
        }
    }

    public func fromInches(_ inches: Double) -> Double {
        switch self {
        case .inches: return inches
        case .centimeters: return inches * 2.54
        }
    }

    public func toInches(_ value: Double) -> Double {
        switch self {
        case .inches: return value
        case .centimeters: return value / 2.54
        }
    }
}

/// Pure conversion helpers between linear offsets on a target and angular units.
public enum Angular {
    /// Converts a linear offset (inches) at a given range (yards) to an angular value.
    /// Returns 0 when `yards` is not positive.
    public static func angular(fromInches inches: Double, atYards yards: Double, unit: AngularUnit) -> Double {
        guard yards > 0 else { return 0 }
        return inches / (unit.inchesPerHundredYards * yards / 100.0)
    }

    /// Converts an angular value to the linear offset (inches) it subtends at a range (yards).
    public static func inches(fromAngular value: Double, atYards yards: Double, unit: AngularUnit) -> Double {
        value * unit.inchesPerHundredYards * yards / 100.0
    }

    /// Converts between angular units (exact, via inches-at-100).
    public static func convert(_ value: Double, from: AngularUnit, to: AngularUnit) -> Double {
        guard from != to else { return value }
        return value * from.inchesPerHundredYards / to.inchesPerHundredYards
    }
}

public enum Conversions {
    public static let feetPerYard = 3.0
    public static let inchesPerFoot = 12.0
    public static let grainsPerPound = 7000.0
    public static let fpsPerMps = 3.280_839_895
    public static let footPoundsPerJoule = 0.737_562_149

    public static func fahrenheit(fromCelsius c: Double) -> Double { c * 9 / 5 + 32 }
    public static func celsius(fromFahrenheit f: Double) -> Double { (f - 32) * 5 / 9 }
    public static func inHg(fromHPa hPa: Double) -> Double { hPa * 0.029_529_98 }
    public static func hPa(fromInHg inHg: Double) -> Double { inHg / 0.029_529_98 }
    public static func feet(fromMeters m: Double) -> Double { m * 3.280_839_895 }
    public static func meters(fromFeet ft: Double) -> Double { ft / 3.280_839_895 }
    public static func mph(fromKph kph: Double) -> Double { kph * 0.621_371_192 }
    public static func kph(fromMph mph: Double) -> Double { mph / 0.621_371_192 }

    /// Kinetic energy in foot-pounds for a bullet of `grains` at `fps`.
    public static func energyFtLb(grains: Double, fps: Double) -> Double {
        grains * fps * fps / 450_437.0
    }
}

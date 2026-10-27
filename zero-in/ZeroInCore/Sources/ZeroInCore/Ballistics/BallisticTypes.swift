import Foundation

/// Standard drag model the ballistic coefficient was referenced to.
public enum DragModel: String, Codable, CaseIterable, Hashable, Sendable {
    case g1
    case g7

    public var label: String { rawValue.uppercased() }
}

/// What leaves the muzzle.
public struct Projectile: Codable, Hashable, Sendable {
    /// Ballistic coefficient in lb/in², referenced to `dragModel`.
    public var bc: Double
    public var dragModel: DragModel
    public var weightGrains: Double
    public var diameterInches: Double
    public var muzzleVelocityFPS: Double

    public init(bc: Double, dragModel: DragModel, weightGrains: Double,
                diameterInches: Double, muzzleVelocityFPS: Double) {
        self.bc = bc
        self.dragModel = dragModel
        self.weightGrains = weightGrains
        self.diameterInches = diameterInches
        self.muzzleVelocityFPS = muzzleVelocityFPS
    }
}

/// Shooting-site atmosphere. Pressure is *station* pressure (what a barometer
/// at the firing line reads), not sea-level corrected.
public struct Atmosphere: Codable, Hashable, Sendable {
    public var altitudeFeet: Double
    public var temperatureF: Double
    public var pressureInHg: Double
    public var humidityPercent: Double

    public init(altitudeFeet: Double = 0, temperatureF: Double = 59,
                pressureInHg: Double = 29.92, humidityPercent: Double = 0) {
        self.altitudeFeet = altitudeFeet
        self.temperatureF = temperatureF
        self.pressureInHg = pressureInHg
        self.humidityPercent = humidityPercent
    }

    /// ICAO standard sea-level atmosphere (59 °F, 29.92 inHg, dry).
    public static let standard = Atmosphere()

    /// Standard atmosphere at a given altitude (temperature and pressure follow
    /// the ICAO lapse rate). Convenience for shooters who only know elevation.
    public static func standard(atAltitudeFeet altitude: Double) -> Atmosphere {
        let tempF = 59.0 - 0.003_566 * altitude
        let tempRankine = tempF + 459.67
        let pressure = 29.92 * pow(tempRankine / 518.67, 5.2559)
        return Atmosphere(altitudeFeet: altitude, temperatureF: tempF,
                          pressureInHg: pressure, humidityPercent: 0)
    }
}

/// Wind at the firing line. `directionDegrees` is where the wind blows FROM,
/// measured clockwise from the line of fire: 0 = headwind (from the target),
/// 90 = from the shooter's right (3 o'clock), 180 = tailwind, 270 = from the left.
public struct WindCondition: Codable, Hashable, Sendable {
    public var speedMPH: Double
    public var directionDegrees: Double

    public init(speedMPH: Double = 0, directionDegrees: Double = 90) {
        self.speedMPH = speedMPH
        self.directionDegrees = directionDegrees
    }

    public static let calm = WindCondition(speedMPH: 0, directionDegrees: 90)

    /// Convenience for clock-face input (3 = from the right, 9 = from the left, 12 = headwind).
    public init(speedMPH: Double, clock: Double) {
        self.init(speedMPH: speedMPH, directionDegrees: (clock.truncatingRemainder(dividingBy: 12)) * 30)
    }

    /// Crosswind component, mph. Positive blows from right to left
    /// (i.e. pushes the bullet to the LEFT).
    public var crosswindMPH: Double { speedMPH * sin(directionDegrees * .pi / 180) }
    /// Headwind component, mph. Positive = headwind (slows the bullet).
    public var headwindMPH: Double { speedMPH * cos(directionDegrees * .pi / 180) }
}

/// Everything about the shot other than the gun and the bullet.
public struct ShotConditions: Codable, Hashable, Sendable {
    public var atmosphere: Atmosphere
    public var wind: WindCondition
    /// Uphill/downhill look angle in degrees (positive = uphill). 0 for flat.
    public var inclinationDegrees: Double

    public init(atmosphere: Atmosphere = .standard, wind: WindCondition = .calm, inclinationDegrees: Double = 0) {
        self.atmosphere = atmosphere
        self.wind = wind
        self.inclinationDegrees = inclinationDegrees
    }

    public static let standard = ShotConditions()
}

/// One row of a trajectory table. All linear values are inches, all angular
/// conversions are relative to the line of sight at this range.
public struct TrajectoryPoint: Codable, Hashable, Sendable {
    public var rangeYards: Double
    /// Bullet height relative to the line of sight. Negative = below (bullet drop).
    public var pathInches: Double
    /// Wind deflection. Positive = bullet pushed to the shooter's RIGHT.
    public var windageInches: Double
    public var velocityFPS: Double
    public var energyFtLb: Double
    public var timeSeconds: Double
    public var mach: Double
    /// Total gravity drop from the bore line (always ≤ 0). Informational.
    public var dropFromBoreInches: Double

    public init(rangeYards: Double, pathInches: Double, windageInches: Double, velocityFPS: Double,
                energyFtLb: Double, timeSeconds: Double, mach: Double, dropFromBoreInches: Double) {
        self.rangeYards = rangeYards
        self.pathInches = pathInches
        self.windageInches = windageInches
        self.velocityFPS = velocityFPS
        self.energyFtLb = energyFtLb
        self.timeSeconds = timeSeconds
        self.mach = mach
        self.dropFromBoreInches = dropFromBoreInches
    }

    /// Bullet path as an angle (negative = below line of sight).
    public func path(in unit: AngularUnit) -> Double {
        Angular.angular(fromInches: pathInches, atYards: rangeYards, unit: unit)
    }

    /// Wind deflection as an angle (positive = right).
    public func windage(in unit: AngularUnit) -> Double {
        Angular.angular(fromInches: windageInches, atYards: rangeYards, unit: unit)
    }

    /// Turret correction that would center the bullet at this range from the
    /// current zero: dial UP by `elevation`, dial RIGHT by `windage`.
    public func correction(in unit: AngularUnit) -> Correction {
        Correction(elevation: -path(in: unit), windage: -windage(in: unit), unit: unit)
    }
}

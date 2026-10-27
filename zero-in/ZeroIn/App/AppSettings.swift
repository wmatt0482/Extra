import Foundation
import ZeroInCore

/// Namespace for user-preference keys (all stored in `UserDefaults` via
/// `@AppStorage`) plus small readers for code that is not a SwiftUI view.
struct AppSettings {
    // Contract keys
    static let angularUnitKey = "angularUnit"            // AngularUnit raw, default "moa"
    static let distanceUnitKey = "distanceUnit"          // DistanceUnit raw, default "yards"
    static let linearUnitKey = "linearUnit"              // LinearUnit raw, default "inches"
    static let activeProfileIDKey = "activeProfileID"    // RifleProfile.id.uuidString

    // Settings tab
    /// Default sight-in distance, yards (Range tab may use it as its starting distance).
    static let defaultSightInDistanceKey = "defaultSightInDistance"
    /// Default turret click value for new profiles, in the profile's click unit.
    static let defaultClickValueKey = "defaultClickValue"

    // Ballistics tab
    static let ballisticsConditionsKey = "ballisticsConditions"   // JSON of ShotConditions
    static let ballisticsMaxRangeKey = "ballisticsMaxRange"       // in the display distance unit
    static let ballisticsStepKey = "ballisticsStep"               // in the display distance unit
    static let ballisticsVitalZoneKey = "ballisticsVitalZone"     // inches

    static let fallbackSightInDistanceYards = 100.0
    static let fallbackClickValue = 0.25

    static func angularUnit(_ defaults: UserDefaults = .standard) -> AngularUnit {
        AngularUnit(rawValue: defaults.string(forKey: angularUnitKey) ?? "") ?? .moa
    }

    static func distanceUnit(_ defaults: UserDefaults = .standard) -> DistanceUnit {
        DistanceUnit(rawValue: defaults.string(forKey: distanceUnitKey) ?? "") ?? .yards
    }

    static func linearUnit(_ defaults: UserDefaults = .standard) -> LinearUnit {
        LinearUnit(rawValue: defaults.string(forKey: linearUnitKey) ?? "") ?? .inches
    }

    static func defaultSightInDistance(_ defaults: UserDefaults = .standard) -> Double {
        let v = defaults.double(forKey: defaultSightInDistanceKey)
        return v > 0 ? v : fallbackSightInDistanceYards
    }

    static func defaultClickValue(_ defaults: UserDefaults = .standard) -> Double {
        let v = defaults.double(forKey: defaultClickValueKey)
        return v > 0 ? v : fallbackClickValue
    }
}

/// Formats numbers for display, honoring the distance and linear unit settings.
/// Internal values are always yards / inches; callers pass those.
struct UnitsFormatter {
    var distanceUnit: DistanceUnit
    var linearUnit: LinearUnit

    init(distance: DistanceUnit = AppSettings.distanceUnit(),
         linear: LinearUnit = AppSettings.linearUnit()) {
        self.distanceUnit = distance
        self.linearUnit = linear
    }

    /// Yards in, display range out: "100 yd" or "91 m".
    func range(_ yards: Double) -> String {
        "\(Self.number(distanceUnit.fromYards(yards), decimals: 0)) \(distanceUnit.label)"
    }

    /// Inches in, display length out (one decimal): "2.5 in" or "6.4 cm".
    func linear(_ inches: Double) -> String {
        "\(Self.number(linearUnit.fromInches(inches), decimals: 1)) \(linearUnit.label)"
    }

    /// Angular value with two decimals and its unit label: "4.20 MOA".
    func angular(_ value: Double, unit: AngularUnit) -> String {
        "\(Self.number(value, decimals: 2)) \(unit.label)"
    }

    /// Turret instruction: "UP 6", "RIGHT 3", or "—" when there is nothing to dial.
    func clicks(_ n: Int, direction: TurretDirection) -> String {
        guard n != 0, direction != .none else { return TurretDirection.none.rawValue }
        return "\(direction.rawValue) \(abs(n))"
    }

    /// `String(format:)` that never prints "-0.0".
    static func number(_ value: Double, decimals: Int) -> String {
        let scale = pow(10.0, Double(decimals))
        let rounded = (value * scale).rounded() / scale
        return String(format: "%.\(decimals)f", rounded == 0 ? 0 : rounded)
    }
}

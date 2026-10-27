import Foundation
import ZeroInCore

/// Persists the Ballistics tab's `ShotConditions` as JSON in `@AppStorage`.
enum ConditionsStore {
    /// 3 o'clock wind, standard atmosphere, flat shot.
    static let defaults = ShotConditions(atmosphere: .standard,
                                         wind: WindCondition(speedMPH: 0, directionDegrees: 90),
                                         inclinationDegrees: 0)

    static func decode(_ json: String) -> ShotConditions {
        guard let data = json.data(using: .utf8), !data.isEmpty,
              let value = try? JSONDecoder().decode(ShotConditions.self, from: data) else { return defaults }
        return value
    }

    static func encode(_ conditions: ShotConditions) -> String {
        guard let data = try? JSONEncoder().encode(conditions),
              let text = String(data: data, encoding: .utf8) else { return "" }
        return text
    }
}

extension ShotConditions {
    /// Clamps typed values into ranges the solver can handle.
    var sanitized: ShotConditions {
        var c = self
        c.atmosphere.altitudeFeet = min(max(c.atmosphere.altitudeFeet, -1_500), 30_000)
        c.atmosphere.temperatureF = min(max(c.atmosphere.temperatureF, -60), 140)
        c.atmosphere.pressureInHg = min(max(c.atmosphere.pressureInHg, 10), 32)
        c.atmosphere.humidityPercent = min(max(c.atmosphere.humidityPercent, 0), 100)
        c.wind.speedMPH = min(max(c.wind.speedMPH, 0), 60)
        c.inclinationDegrees = min(max(c.inclinationDegrees, -60), 60)
        return c
    }
}

extension WindCondition {
    /// Clock position (1...12) when the direction sits exactly on one.
    var clockPosition: Int? {
        let c = directionDegrees / 30
        guard abs(c - c.rounded()) < 0.001 else { return nil }
        let n = ((Int(c.rounded()) % 12) + 12) % 12
        return n == 0 ? 12 : n
    }

    /// "calm", "10 mph from 3 o'clock", "5 mph from 45°".
    var summary: String {
        guard speedMPH > 0.05 else { return "calm" }
        let speed = UnitsFormatter.number(speedMPH, decimals: 0)
        if let clock = clockPosition { return "\(speed) mph from \(clock) o'clock" }
        return "\(speed) mph from \(UnitsFormatter.number(directionDegrees, decimals: 0))°"
    }
}

extension Atmosphere {
    /// "0 ft · 59°F · 29.92 inHg · 0% RH"
    var summary: String {
        "\(UnitsFormatter.number(altitudeFeet, decimals: 0)) ft · "
        + "\(UnitsFormatter.number(temperatureF, decimals: 0))°F · "
        + "\(UnitsFormatter.number(pressureInHg, decimals: 2)) inHg · "
        + "\(UnitsFormatter.number(humidityPercent, decimals: 0))% RH"
    }
}

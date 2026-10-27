import Foundation

/// Air-property constants shared by the `Atmosphere` extension (imperial units).
enum AirConstants {
    /// ICAO sea-level standard station pressure, inHg.
    static let standardPressureInHg = 29.92
    /// ICAO sea-level standard temperature, 59 °F in degrees Rankine.
    static let standardTemperatureRankine = 518.67
    /// °F → °R offset.
    static let rankineOffset = 459.67
    /// Speed of sound in dry air: a = 49.0223 · √T(°R) fps (= √(γ R T) for air).
    static let speedOfSoundCoefficient = 49.0223
    /// 1 − M_vapor / M_dry_air (18.015 / 28.965): how much lighter water vapour is than dry air.
    static let vaporDensityFactor = 0.3780
    /// hPa → inHg.
    static let inHgPerHPa = 0.029_529_98

    /// Saturation vapour pressure over water (Arden Buck, 1996), inHg.
    static func saturationVaporPressureInHg(temperatureF: Double) -> Double {
        let tc = (temperatureF - 32.0) * 5.0 / 9.0
        let hPa = 6.1121 * exp((18.678 - tc / 234.5) * (tc / (257.14 + tc)))
        return hPa * inHgPerHPa
    }
}

public extension Atmosphere {
    /// Air density ratio vs ICAO sea-level standard (1.0 at `.standard`).
    ///
    /// Ideal-gas moist air from *station* pressure, temperature and relative humidity:
    /// ρ/ρ₀ = (P − 0.378·Pv) / 29.92 · 518.67 / T(°R), where Pv = RH · Psat(T)
    /// (Buck's saturation-pressure formula). `altitudeFeet` is not used: station
    /// pressure already reflects the elevation. Matches the CIPM-2007 density used by
    /// py-ballisticcalc to within ~0.05 %.
    var densityRatio: Double {
        let tempRankine = max(temperatureF + AirConstants.rankineOffset, 1.0)
        let rh = min(max(humidityPercent, 0.0), 100.0) / 100.0
        let vaporPressure = rh * AirConstants.saturationVaporPressureInHg(temperatureF: temperatureF)
        // Moist air: ρ = (Pd·Md + Pv·Mv) / (R·T) = (P − 0.378·Pv)·Md / (R·T)
        let effectivePressure = max(pressureInHg - AirConstants.vaporDensityFactor * vaporPressure, 0.0)
        return (effectivePressure / AirConstants.standardPressureInHg)
            * (AirConstants.standardTemperatureRankine / tempRankine)
    }

    /// Local speed of sound, fps (≈1116.45 at `.standard`).
    ///
    /// a = 49.0223 · √T(°R). Humidity is ignored (it raises the speed of sound by
    /// < 0.3 % even in hot, saturated air).
    var speedOfSoundFPS: Double {
        let tempRankine = max(temperatureF + AirConstants.rankineOffset, 1.0)
        return AirConstants.speedOfSoundCoefficient * tempRankine.squareRoot()
    }
}

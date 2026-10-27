import Foundation
import SwiftData
import ZeroInCore

// SwiftData models for ZeroIn. Enums are stored as raw strings so the schema
// stays simple; typed accessors live in the extensions below.
//
// Ownership: RifleProfile ──cascade──▶ SightInSession ──cascade──▶ ShotGroupRecord

/// A saved "setup": one firearm + one load + one scope, with its zero.
/// Catalog picks are copied in (not referenced) so the profile stays valid
/// if the bundled catalog changes, and so every field can be customized.
@Model
final class RifleProfile {
    @Attribute(.unique) var id: UUID
    var name: String
    var createdAt: Date
    var updatedAt: Date

    // Firearm
    var firearmName: String
    var catalogFirearmID: String?
    var caliberName: String
    var catalogCaliberID: String?
    var barrelLengthInches: Double?
    var twistInches: Double?
    var firearmCategoryRaw: String

    // Load
    var ammoName: String
    var catalogAmmoID: String?
    var bulletWeightGrains: Double
    var bulletDiameterInches: Double
    var ballisticCoefficient: Double
    var dragModelRaw: String
    var muzzleVelocityFPS: Double

    // Sight
    var sightHeightInches: Double
    var clickValue: Double
    var clickUnitRaw: String
    var zeroRangeYards: Double

    // Zero status
    var zeroConfirmed: Bool
    var zeroConfirmedAt: Date?

    var notes: String

    @Relationship(deleteRule: .cascade, inverse: \SightInSession.profile)
    var sessions: [SightInSession]

    init(name: String,
         firearmName: String, catalogFirearmID: String? = nil,
         caliberName: String, catalogCaliberID: String? = nil,
         barrelLengthInches: Double? = nil, twistInches: Double? = nil,
         firearmCategory: FirearmCategory = .boltAction,
         ammoName: String, catalogAmmoID: String? = nil,
         bulletWeightGrains: Double, bulletDiameterInches: Double,
         ballisticCoefficient: Double, dragModel: DragModel, muzzleVelocityFPS: Double,
         sightHeightInches: Double = 1.5, clickValue: Double = 0.25, clickUnit: AngularUnit = .moa,
         zeroRangeYards: Double = 100, notes: String = "") {
        self.id = UUID()
        self.name = name
        self.createdAt = Date()
        self.updatedAt = Date()
        self.firearmName = firearmName
        self.catalogFirearmID = catalogFirearmID
        self.caliberName = caliberName
        self.catalogCaliberID = catalogCaliberID
        self.barrelLengthInches = barrelLengthInches
        self.twistInches = twistInches
        self.firearmCategoryRaw = firearmCategory.rawValue
        self.ammoName = ammoName
        self.catalogAmmoID = catalogAmmoID
        self.bulletWeightGrains = bulletWeightGrains
        self.bulletDiameterInches = bulletDiameterInches
        self.ballisticCoefficient = ballisticCoefficient
        self.dragModelRaw = dragModel.rawValue
        self.muzzleVelocityFPS = muzzleVelocityFPS
        self.sightHeightInches = sightHeightInches
        self.clickValue = clickValue
        self.clickUnitRaw = clickUnit.rawValue
        self.zeroRangeYards = zeroRangeYards
        self.zeroConfirmed = false
        self.zeroConfirmedAt = nil
        self.notes = notes
        self.sessions = []
    }
}

extension RifleProfile {
    var firearmCategory: FirearmCategory {
        get { FirearmCategory(rawValue: firearmCategoryRaw) ?? .boltAction }
        set { firearmCategoryRaw = newValue.rawValue }
    }

    var dragModel: DragModel {
        get { DragModel(rawValue: dragModelRaw) ?? .g1 }
        set { dragModelRaw = newValue.rawValue }
    }

    var clickUnit: AngularUnit {
        get { AngularUnit(rawValue: clickUnitRaw) ?? .moa }
        set { clickUnitRaw = newValue.rawValue }
    }

    var projectile: Projectile {
        Projectile(bc: ballisticCoefficient, dragModel: dragModel, weightGrains: bulletWeightGrains,
                   diameterInches: bulletDiameterInches, muzzleVelocityFPS: muzzleVelocityFPS)
    }

    var scope: ScopeSpec {
        ScopeSpec(clickValue: clickValue, clickUnit: clickUnit,
                  sightHeightInches: sightHeightInches, zeroRangeYards: zeroRangeYards)
    }

    /// Sessions newest first.
    var sortedSessions: [SightInSession] { sessions.sorted { $0.date > $1.date } }
}

/// One trip to the range with one profile at one distance.
@Model
final class SightInSession {
    @Attribute(.unique) var id: UUID
    var date: Date
    var distanceYards: Double
    var notes: String

    // Conditions (stored flat; defaults are the ICAO standard atmosphere)
    var altitudeFeet: Double
    var temperatureF: Double
    var pressureInHg: Double
    var humidityPercent: Double
    var windSpeedMPH: Double
    var windDirectionDegrees: Double

    var profile: RifleProfile?

    @Relationship(deleteRule: .cascade, inverse: \ShotGroupRecord.session)
    var groups: [ShotGroupRecord]

    init(profile: RifleProfile, distanceYards: Double, date: Date = Date(),
         conditions: ShotConditions = .standard, notes: String = "") {
        self.id = UUID()
        self.date = date
        self.distanceYards = distanceYards
        self.notes = notes
        self.altitudeFeet = conditions.atmosphere.altitudeFeet
        self.temperatureF = conditions.atmosphere.temperatureF
        self.pressureInHg = conditions.atmosphere.pressureInHg
        self.humidityPercent = conditions.atmosphere.humidityPercent
        self.windSpeedMPH = conditions.wind.speedMPH
        self.windDirectionDegrees = conditions.wind.directionDegrees
        self.profile = profile
        self.groups = []
    }
}

extension SightInSession {
    var conditions: ShotConditions {
        get {
            ShotConditions(atmosphere: Atmosphere(altitudeFeet: altitudeFeet, temperatureF: temperatureF,
                                                  pressureInHg: pressureInHg, humidityPercent: humidityPercent),
                           wind: WindCondition(speedMPH: windSpeedMPH, directionDegrees: windDirectionDegrees))
        }
        set {
            altitudeFeet = newValue.atmosphere.altitudeFeet
            temperatureF = newValue.atmosphere.temperatureF
            pressureInHg = newValue.atmosphere.pressureInHg
            humidityPercent = newValue.atmosphere.humidityPercent
            windSpeedMPH = newValue.wind.speedMPH
            windDirectionDegrees = newValue.wind.directionDegrees
        }
    }

    /// Groups oldest first (the order they were shot).
    var sortedGroups: [ShotGroupRecord] { groups.sorted { $0.createdAt < $1.createdAt } }
}

/// One group of shots on one target photo, with the correction it produced.
@Model
final class ShotGroupRecord {
    @Attribute(.unique) var id: UUID
    var createdAt: Date
    var label: String

    /// Shot impacts in target space (inches from point of aim, +x right, +y up),
    /// JSON-encoded `[Point2D]`.
    var shotsJSON: Data
    /// Where the bullets were *expected* to land at this distance relative to
    /// the point of aim (non-zero when sighting in at a distance other than the
    /// zero range), inches. Usually (0, 0).
    var expectedImpactX: Double
    var expectedImpactY: Double

    /// File name of the saved target photo inside the app's Documents/Targets
    /// directory, if one was captured.
    var imageFileName: String?

    // Cached stats (inches)
    var shotCount: Int
    var centerX: Double
    var centerY: Double
    var extremeSpreadInches: Double
    var meanRadiusInches: Double

    // The correction computed from this group, in `correctionUnitRaw`
    // (+elevation = UP, +windage = RIGHT).
    var correctionElevation: Double
    var correctionWindage: Double
    var correctionUnitRaw: String
    /// True once the shooter says they dialed this correction into the scope.
    var correctionApplied: Bool

    var session: SightInSession?

    init(session: SightInSession, label: String, shots: [Point2D], expectedImpact: Point2D = .zero,
         imageFileName: String? = nil, stats: GroupStats?, correction: Correction) {
        self.id = UUID()
        self.createdAt = Date()
        self.label = label
        self.shotsJSON = (try? JSONEncoder().encode(shots)) ?? Data()
        self.expectedImpactX = expectedImpact.x
        self.expectedImpactY = expectedImpact.y
        self.imageFileName = imageFileName
        self.shotCount = stats?.shotCount ?? shots.count
        self.centerX = stats?.center.x ?? 0
        self.centerY = stats?.center.y ?? 0
        self.extremeSpreadInches = stats?.extremeSpreadInches ?? 0
        self.meanRadiusInches = stats?.meanRadiusInches ?? 0
        self.correctionElevation = correction.elevation
        self.correctionWindage = correction.windage
        self.correctionUnitRaw = correction.unit.rawValue
        self.correctionApplied = false
        self.session = session
    }
}

extension ShotGroupRecord {
    var shots: [Point2D] {
        get { (try? JSONDecoder().decode([Point2D].self, from: shotsJSON)) ?? [] }
        set { shotsJSON = (try? JSONEncoder().encode(newValue)) ?? Data() }
    }

    var expectedImpact: Point2D { Point2D(x: expectedImpactX, y: expectedImpactY) }
    var center: Point2D { Point2D(x: centerX, y: centerY) }

    var correction: Correction {
        Correction(elevation: correctionElevation, windage: correctionWindage,
                   unit: AngularUnit(rawValue: correctionUnitRaw) ?? .moa)
    }
}

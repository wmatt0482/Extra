import Foundation
import ZeroInCore

extension RifleProfile {
    /// An independent copy (new id, no sessions, zero not confirmed).
    func duplicated() -> RifleProfile {
        RifleProfile(name: "\(name) copy",
                     firearmName: firearmName, catalogFirearmID: catalogFirearmID,
                     caliberName: caliberName, catalogCaliberID: catalogCaliberID,
                     barrelLengthInches: barrelLengthInches, twistInches: twistInches,
                     firearmCategory: firearmCategory,
                     ammoName: ammoName, catalogAmmoID: catalogAmmoID,
                     bulletWeightGrains: bulletWeightGrains, bulletDiameterInches: bulletDiameterInches,
                     ballisticCoefficient: ballisticCoefficient, dragModel: dragModel,
                     muzzleVelocityFPS: muzzleVelocityFPS,
                     sightHeightInches: sightHeightInches, clickValue: clickValue, clickUnit: clickUnit,
                     zeroRangeYards: zeroRangeYards, notes: notes)
    }

    /// "Ruger American Rifle · 6.5 Creedmoor"
    var firearmSummary: String {
        [firearmName, caliberName].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    /// Zero range formatted in the user's distance unit, e.g. "100 yd".
    func zeroRangeText(unit: DistanceUnit) -> String {
        "\(LibraryFormat.number(unit.fromYards(zeroRangeYards), maxDigits: 0)) \(unit.label)"
    }

    var clickText: String {
        "\(LibraryFormat.number(clickValue, maxDigits: 3)) \(clickUnit.label)/click"
    }

    var bcText: String {
        "\(dragModel.label) \(LibraryFormat.number(ballisticCoefficient, maxDigits: 3))"
    }

    var totalGroupCount: Int {
        sessions.reduce(0) { $0 + $1.groups.count }
    }
}

enum LibraryFormat {
    /// Locale-aware number with up to `maxDigits` fraction digits and no trailing zeros.
    static func number(_ value: Double, maxDigits: Int) -> String {
        value.formatted(.number.precision(.fractionLength(0...maxDigits)))
    }
}

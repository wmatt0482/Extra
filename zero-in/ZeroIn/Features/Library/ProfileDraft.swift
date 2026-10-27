import Foundation
import ZeroInCore

/// Editable value-type copy of a `RifleProfile`, so the editor can be cancelled
/// without touching the SwiftData model.
struct ProfileDraft {
    enum Source: String, CaseIterable, Hashable {
        case catalog, custom
        var label: String { self == .catalog ? "Catalog" : "Custom" }
    }

    var name = ""
    var notes = ""

    // Firearm
    var firearmSource: Source = .catalog
    var catalogFirearmID: String?
    var firearmName = ""
    var category: FirearmCategory = .boltAction
    var catalogCaliberID: String?
    var caliberName = ""
    var barrel: Double?
    var twist: Double?

    // Load
    var ammoSource: Source = .catalog
    var catalogAmmoID: String?
    var ammoName = ""
    var weight: Double?
    var diameter: Double?
    var bc: Double?
    var dragModel: DragModel = .g1
    var muzzleVelocity: Double?

    // Scope
    var sightHeight: Double? = 1.5
    var clickValue: Double = 0.25
    var clickUnit: AngularUnit = .moa
    var zeroRangeYards: Double? = 100

    init(profile: RifleProfile?, defaultZeroYards: Double = 100) {
        zeroRangeYards = defaultZeroYards
        guard let p = profile else { return }
        name = p.name
        notes = p.notes
        firearmSource = p.catalogFirearmID != nil ? .catalog : .custom
        catalogFirearmID = p.catalogFirearmID
        firearmName = p.firearmName
        category = p.firearmCategory
        catalogCaliberID = p.catalogCaliberID
        caliberName = p.caliberName
        barrel = p.barrelLengthInches
        twist = p.twistInches
        ammoSource = p.catalogAmmoID != nil ? .catalog : .custom
        catalogAmmoID = p.catalogAmmoID
        ammoName = p.ammoName
        weight = p.bulletWeightGrains
        diameter = p.bulletDiameterInches
        bc = p.ballisticCoefficient
        dragModel = p.dragModel
        muzzleVelocity = p.muzzleVelocityFPS
        sightHeight = p.sightHeightInches
        clickValue = p.clickValue
        clickUnit = p.clickUnit
        zeroRangeYards = p.zeroRangeYards
    }

    // MARK: - Derived

    /// "<firearm> · <ammo>" suggestion for the profile name.
    var suggestedName: String {
        [firearmName, ammoName]
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    var effectiveName: String {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? suggestedName : trimmed
    }

    /// Human-readable list of what still blocks saving (empty when valid).
    var problems: [String] {
        var list: [String] = []
        if firearmName.trimmingCharacters(in: .whitespaces).isEmpty { list.append("rifle") }
        if caliberName.trimmingCharacters(in: .whitespaces).isEmpty { list.append("caliber") }
        if (weight ?? 0) <= 0 { list.append("bullet weight") }
        if (bc ?? 0) <= 0 { list.append("ballistic coefficient") }
        if (muzzleVelocity ?? 0) <= 0 { list.append("muzzle velocity") }
        if (diameter ?? 0) <= 0 { list.append("bullet diameter") }
        if (sightHeight ?? 0) <= 0 { list.append("sight height") }
        if clickValue <= 0 { list.append("click value") }
        if (zeroRangeYards ?? 0) <= 0 { list.append("zero range") }
        if effectiveName.isEmpty { list.append("name") }
        return list
    }

    var isValid: Bool { problems.isEmpty }

    // MARK: - Catalog picks

    mutating func applyFirearm(_ f: CatalogFirearm, catalog: Catalog) {
        firearmSource = .catalog
        catalogFirearmID = f.id
        firearmName = f.displayName
        category = f.category
        barrel = f.barrelLengthInches
        twist = f.twistInches
        sightHeight = f.typicalSightHeightInches
        if let c = catalog.caliber(id: f.caliberID) {
            applyCaliber(c, catalog: catalog)
        }
    }

    mutating func applyCaliber(_ c: CatalogCaliber, catalog: Catalog) {
        catalogCaliberID = c.id
        caliberName = c.name
        diameter = c.bulletDiameterInches
        // A catalog load for a different caliber no longer applies.
        if let aid = catalogAmmoID, let a = catalog.ammo(id: aid), a.caliberID != c.id {
            clearAmmo()
        }
    }

    mutating func applyAmmo(_ a: CatalogAmmo) {
        ammoSource = .catalog
        catalogAmmoID = a.id
        ammoName = a.displayName
        weight = a.bulletWeightGrains
        dragModel = a.preferredDragModel
        bc = a.preferredBC
        muzzleVelocity = a.muzzleVelocityFPS
    }

    mutating func clearAmmo() {
        catalogAmmoID = nil
        ammoName = ""
        weight = nil
        bc = nil
        muzzleVelocity = nil
    }

    // MARK: - Persistence

    /// Copies the draft into a model object (new or existing) and stamps `updatedAt`.
    func apply(to p: RifleProfile) {
        p.name = effectiveName
        p.notes = notes
        p.firearmName = firearmName.trimmingCharacters(in: .whitespaces)
        p.catalogFirearmID = firearmSource == .catalog ? catalogFirearmID : nil
        p.firearmCategory = category
        p.caliberName = caliberName
        p.catalogCaliberID = catalogCaliberID
        p.barrelLengthInches = barrel
        p.twistInches = twist
        p.ammoName = ammoName.trimmingCharacters(in: .whitespaces)
        p.catalogAmmoID = ammoSource == .catalog ? catalogAmmoID : nil
        p.bulletWeightGrains = weight ?? 0
        p.bulletDiameterInches = diameter ?? 0
        p.ballisticCoefficient = bc ?? 0
        p.dragModel = dragModel
        p.muzzleVelocityFPS = muzzleVelocity ?? 0
        p.sightHeightInches = sightHeight ?? 0
        p.clickValue = clickValue
        p.clickUnit = clickUnit
        p.zeroRangeYards = zeroRangeYards ?? 100
        p.updatedAt = Date()
    }

    func makeProfile() -> RifleProfile {
        let p = RifleProfile(name: effectiveName, firearmName: firearmName,
                             caliberName: caliberName, ammoName: ammoName,
                             bulletWeightGrains: weight ?? 0, bulletDiameterInches: diameter ?? 0,
                             ballisticCoefficient: bc ?? 0, dragModel: dragModel,
                             muzzleVelocityFPS: muzzleVelocity ?? 0)
        apply(to: p)
        return p
    }
}

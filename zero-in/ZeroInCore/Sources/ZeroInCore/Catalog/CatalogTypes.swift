import Foundation

/// Broad firearm category for browsing/filtering the catalog.
public enum FirearmCategory: String, Codable, CaseIterable, Hashable, Sendable {
    case boltAction
    case semiAuto
    case leverAction
    case singleShot
    case rimfire
    case muzzleloader
    case shotgun
    case handgun

    public var label: String {
        switch self {
        case .boltAction: return "Bolt action"
        case .semiAuto: return "Semi-auto"
        case .leverAction: return "Lever action"
        case .singleShot: return "Single shot"
        case .rimfire: return "Rimfire"
        case .muzzleloader: return "Muzzleloader"
        case .shotgun: return "Shotgun"
        case .handgun: return "Handgun"
        }
    }
}

/// A cartridge / chambering. Joins firearms to ammo.
public struct CatalogCaliber: Codable, Hashable, Identifiable, Sendable {
    /// Stable slug, e.g. "308-win", "65-creedmoor", "223-rem", "22-lr".
    public var id: String
    /// Display name, e.g. ".308 Winchester".
    public var name: String
    /// Nominal bullet diameter, inches (e.g. 0.308).
    public var bulletDiameterInches: Double
    /// Optional aliases for search ("7.62x51", "7.62 NATO").
    public var aliases: [String]?

    public init(id: String, name: String, bulletDiameterInches: Double, aliases: [String]? = nil) {
        self.id = id
        self.name = name
        self.bulletDiameterInches = bulletDiameterInches
        self.aliases = aliases
    }
}

public struct CatalogFirearm: Codable, Hashable, Identifiable, Sendable {
    /// Stable slug, e.g. "ruger-american-308".
    public var id: String
    public var make: String
    public var model: String
    public var category: FirearmCategory
    /// Joins to `CatalogCaliber.id`.
    public var caliberID: String
    public var barrelLengthInches: Double?
    /// Rifling twist, inches per turn (10 means 1:10).
    public var twistInches: Double?
    /// Typical scope-centerline height over bore for this platform, inches
    /// (≈1.5 for a bolt gun with low rings, ≈2.6 for an AR-15).
    public var typicalSightHeightInches: Double
    public var notes: String?

    public init(id: String, make: String, model: String, category: FirearmCategory, caliberID: String,
                barrelLengthInches: Double? = nil, twistInches: Double? = nil,
                typicalSightHeightInches: Double = 1.5, notes: String? = nil) {
        self.id = id
        self.make = make
        self.model = model
        self.category = category
        self.caliberID = caliberID
        self.barrelLengthInches = barrelLengthInches
        self.twistInches = twistInches
        self.typicalSightHeightInches = typicalSightHeightInches
        self.notes = notes
    }

    public var displayName: String { "\(make) \(model)" }
}

public struct CatalogAmmo: Codable, Hashable, Identifiable, Sendable {
    /// Stable slug, e.g. "hornady-eld-match-308-168".
    public var id: String
    public var make: String
    /// Product line, e.g. "ELD Match", "Fusion", "Core-Lokt".
    public var line: String
    /// Joins to `CatalogCaliber.id`.
    public var caliberID: String
    public var bulletWeightGrains: Double
    /// Bullet name if distinct from the line, e.g. "Sierra MatchKing".
    public var bulletName: String?
    public var g1BC: Double?
    public var g7BC: Double?
    /// Manufacturer-published muzzle velocity, fps, from `testBarrelLengthInches`.
    public var muzzleVelocityFPS: Double
    public var testBarrelLengthInches: Double?
    public var notes: String?

    public init(id: String, make: String, line: String, caliberID: String, bulletWeightGrains: Double,
                bulletName: String? = nil, g1BC: Double? = nil, g7BC: Double? = nil,
                muzzleVelocityFPS: Double, testBarrelLengthInches: Double? = nil, notes: String? = nil) {
        self.id = id
        self.make = make
        self.line = line
        self.caliberID = caliberID
        self.bulletWeightGrains = bulletWeightGrains
        self.bulletName = bulletName
        self.g1BC = g1BC
        self.g7BC = g7BC
        self.muzzleVelocityFPS = muzzleVelocityFPS
        self.testBarrelLengthInches = testBarrelLengthInches
        self.notes = notes
    }

    public var displayName: String {
        let grains = bulletWeightGrains.rounded() == bulletWeightGrains
            ? String(Int(bulletWeightGrains)) : String(bulletWeightGrains)
        return "\(make) \(line) \(grains) gr"
    }

    /// G7 when published (better for boat-tail rifle bullets), otherwise G1.
    public var preferredDragModel: DragModel { g7BC != nil ? .g7 : .g1 }

    public var preferredBC: Double { g7BC ?? g1BC ?? 0 }

    /// Builds a solver projectile. `diameterInches` comes from the caliber.
    public func projectile(diameterInches: Double, muzzleVelocityOverride: Double? = nil,
                           dragModel: DragModel? = nil) -> Projectile {
        let model = dragModel ?? preferredDragModel
        let bc: Double
        switch model {
        case .g7: bc = g7BC ?? g1BC ?? 0
        case .g1: bc = g1BC ?? g7BC ?? 0
        }
        return Projectile(bc: bc, dragModel: model, weightGrains: bulletWeightGrains,
                          diameterInches: diameterInches,
                          muzzleVelocityFPS: muzzleVelocityOverride ?? muzzleVelocityFPS)
    }
}

/// A target preset used to calibrate photo scale (known physical dimensions).
public struct CatalogTarget: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var widthInches: Double
    public var heightInches: Double
    /// Grid spacing in inches when the target is printed on a grid (nil otherwise).
    public var gridSpacingInches: Double?
    /// Diameter of the bull / aiming dot, inches, if any.
    public var bullDiameterInches: Double?
    public var notes: String?

    public init(id: String, name: String, widthInches: Double, heightInches: Double,
                gridSpacingInches: Double? = nil, bullDiameterInches: Double? = nil, notes: String? = nil) {
        self.id = id
        self.name = name
        self.widthInches = widthInches
        self.heightInches = heightInches
        self.gridSpacingInches = gridSpacingInches
        self.bullDiameterInches = bullDiameterInches
        self.notes = notes
    }
}

/// The bundled catalog, decoded from three JSON files in the app bundle:
/// `calibers.json`, `firearms.json`, `ammo.json`, `targets.json`.
public struct Catalog: Codable, Hashable, Sendable {
    public var calibers: [CatalogCaliber]
    public var firearms: [CatalogFirearm]
    public var ammo: [CatalogAmmo]
    public var targets: [CatalogTarget]

    public init(calibers: [CatalogCaliber], firearms: [CatalogFirearm], ammo: [CatalogAmmo], targets: [CatalogTarget]) {
        self.calibers = calibers
        self.firearms = firearms
        self.ammo = ammo
        self.targets = targets
    }

    public static let empty = Catalog(calibers: [], firearms: [], ammo: [], targets: [])

    /// Decodes the four JSON documents. Each file is a top-level JSON array.
    public static func load(calibersJSON: Data, firearmsJSON: Data, ammoJSON: Data, targetsJSON: Data) throws -> Catalog {
        let d = JSONDecoder()
        return Catalog(calibers: try d.decode([CatalogCaliber].self, from: calibersJSON),
                       firearms: try d.decode([CatalogFirearm].self, from: firearmsJSON),
                       ammo: try d.decode([CatalogAmmo].self, from: ammoJSON),
                       targets: try d.decode([CatalogTarget].self, from: targetsJSON))
    }

    public func caliber(id: String) -> CatalogCaliber? { calibers.first { $0.id == id } }
    public func firearm(id: String) -> CatalogFirearm? { firearms.first { $0.id == id } }
    public func ammo(id: String) -> CatalogAmmo? { ammo.first { $0.id == id } }
    public func target(id: String) -> CatalogTarget? { targets.first { $0.id == id } }

    public func ammo(forCaliberID caliberID: String) -> [CatalogAmmo] {
        ammo.filter { $0.caliberID == caliberID }
    }

    public func firearms(forCaliberID caliberID: String) -> [CatalogFirearm] {
        firearms.filter { $0.caliberID == caliberID }
    }

    /// Case-insensitive search across make, model, caliber name and aliases.
    public func searchFirearms(_ query: String) -> [CatalogFirearm] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return firearms }
        return firearms.filter { f in
            let cal = caliber(id: f.caliberID)
            let hay = ([f.make, f.model, cal?.name ?? ""] + (cal?.aliases ?? [])).joined(separator: " ").lowercased()
            return q.split(separator: " ").allSatisfy { hay.contains($0) }
        }
    }

    public func searchAmmo(_ query: String, caliberID: String? = nil) -> [CatalogAmmo] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        let pool = caliberID.map { ammo(forCaliberID: $0) } ?? ammo
        guard !q.isEmpty else { return pool }
        return pool.filter { a in
            let cal = caliber(id: a.caliberID)
            let hay = ([a.make, a.line, a.bulletName ?? "", String(Int(a.bulletWeightGrains)), cal?.name ?? ""]
                       + (cal?.aliases ?? [])).joined(separator: " ").lowercased()
            return q.split(separator: " ").allSatisfy { hay.contains($0) }
        }
    }

    /// Referential-integrity check used by the catalog unit tests.
    public func validate() -> [String] {
        var problems: [String] = []
        let calIDs = Set(calibers.map(\.id))
        if calIDs.count != calibers.count { problems.append("duplicate caliber ids") }
        if Set(firearms.map(\.id)).count != firearms.count { problems.append("duplicate firearm ids") }
        if Set(ammo.map(\.id)).count != ammo.count { problems.append("duplicate ammo ids") }
        for f in firearms where !calIDs.contains(f.caliberID) { problems.append("firearm \(f.id) references unknown caliber \(f.caliberID)") }
        for a in ammo {
            if !calIDs.contains(a.caliberID) { problems.append("ammo \(a.id) references unknown caliber \(a.caliberID)") }
            if a.g1BC == nil && a.g7BC == nil { problems.append("ammo \(a.id) has no BC") }
            if a.muzzleVelocityFPS <= 0 { problems.append("ammo \(a.id) has no muzzle velocity") }
        }
        return problems
    }
}

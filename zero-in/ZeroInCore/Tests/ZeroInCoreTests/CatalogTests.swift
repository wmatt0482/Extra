import XCTest
import ZeroInCore

/// Decodes the bundled catalog JSON straight from the app's Resources folder
/// (the SPM test target cannot see the app bundle) and checks its integrity.
final class CatalogTests: XCTestCase {

    /// .../zero-in/ZeroInCore/Tests/ZeroInCoreTests/CatalogTests.swift -> .../zero-in/ZeroIn/Resources/Catalog
    private static var catalogDirectory: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()               // ZeroInCoreTests
            .appendingPathComponent("../../../ZeroIn/Resources/Catalog", isDirectory: true)
            .standardizedFileURL
    }

    private func loadCatalog() throws -> Catalog {
        let dir = Self.catalogDirectory
        func data(_ name: String) throws -> Data {
            try Data(contentsOf: dir.appendingPathComponent("\(name).json"))
        }
        return try Catalog.load(calibersJSON: data("calibers"), firearmsJSON: data("firearms"),
                                ammoJSON: data("ammo"), targetsJSON: data("targets"))
    }

    func testCatalogDecodesAndValidates() throws {
        let catalog = try loadCatalog()
        XCTAssertEqual(catalog.validate(), [])
    }

    func testCountsMeetMinimums() throws {
        let c = try loadCatalog()
        XCTAssertGreaterThanOrEqual(c.calibers.count, 40)
        XCTAssertGreaterThanOrEqual(c.firearms.count, 70)
        XCTAssertGreaterThanOrEqual(c.ammo.count, 140)
        XCTAssertGreaterThanOrEqual(c.targets.count, 12)
    }

    func testEveryCaliberHasFirearmAndAmmo() throws {
        let c = try loadCatalog()
        for cal in c.calibers {
            XCTAssertFalse(c.firearms(forCaliberID: cal.id).isEmpty, "no firearm for \(cal.id)")
            XCTAssertGreaterThanOrEqual(c.ammo(forCaliberID: cal.id).count, 2, "too few loads for \(cal.id)")
        }
    }

    func testEveryFirearmCategoryDecoded() throws {
        let c = try loadCatalog()
        let used = Set(c.firearms.map(\.category))
        XCTAssertEqual(used, Set(FirearmCategory.allCases))
    }

    func testValuesAreInSaneRanges() throws {
        let c = try loadCatalog()
        for a in c.ammo {
            if let g1 = a.g1BC { XCTAssertTrue((0.08...0.9).contains(g1), "\(a.id) G1 \(g1)") }
            if let g7 = a.g7BC { XCTAssertTrue((0.08...0.45).contains(g7), "\(a.id) G7 \(g7)") }
            XCTAssertTrue((600...4500).contains(a.muzzleVelocityFPS), "\(a.id) MV")
            XCTAssertTrue((15...600).contains(a.bulletWeightGrains), "\(a.id) weight")
        }
        for f in c.firearms {
            XCTAssertTrue((0.3...3.5).contains(f.typicalSightHeightInches), "\(f.id) sight height")
        }
    }

    func testCaliberDiameters() throws {
        let c = try loadCatalog()
        XCTAssertEqual(c.caliber(id: "223-rem")?.bulletDiameterInches ?? 0, 0.224, accuracy: 0.0005)
        XCTAssertEqual(c.caliber(id: "65-creedmoor")?.bulletDiameterInches ?? 0, 0.264, accuracy: 0.0005)
        XCTAssertEqual(c.caliber(id: "270-win")?.bulletDiameterInches ?? 0, 0.277, accuracy: 0.0005)
        XCTAssertEqual(c.caliber(id: "308-win")?.bulletDiameterInches ?? 0, 0.308, accuracy: 0.0005)
        XCTAssertEqual(c.caliber(id: "9mm")?.bulletDiameterInches ?? 0, 0.355, accuracy: 0.0005)
        XCTAssertEqual(c.caliber(id: "44-mag")?.bulletDiameterInches ?? 0, 0.429, accuracy: 0.0005)
        XCTAssertEqual(c.caliber(id: "22-lr")?.bulletDiameterInches ?? 0, 0.223, accuracy: 0.0005)
    }

    func testFirearmSearch() throws {
        let c = try loadCatalog()
        let hits = c.searchFirearms("tikka 6.5")
        XCTAssertFalse(hits.isEmpty)
        XCTAssertTrue(hits.allSatisfy { $0.make == "Tikka" })
        XCTAssertTrue(hits.contains { $0.caliberID == "65-creedmoor" })

        // Aliases resolve through the caliber.
        XCTAssertTrue(c.searchFirearms("7.62x51").contains { $0.caliberID == "308-win" })
        XCTAssertTrue(c.searchFirearms("5.56").contains { $0.caliberID == "223-rem" })
        XCTAssertEqual(c.searchFirearms("").count, c.firearms.count)
        XCTAssertTrue(c.searchFirearms("zzzz-no-such-gun").isEmpty)
    }

    func testAmmoSearch() throws {
        let c = try loadCatalog()
        let eld = c.searchAmmo("eld", caliberID: "65-creedmoor")
        XCTAssertFalse(eld.isEmpty)
        XCTAssertTrue(eld.allSatisfy { $0.caliberID == "65-creedmoor" })
        XCTAssertTrue(c.searchAmmo("hornady 140").contains { $0.id == "hornady-match-65-creedmoor-140" })
    }

    func testProjectilePrefersG7WhenPresent() throws {
        let c = try loadCatalog()
        let both = try XCTUnwrap(c.ammo.first { $0.g1BC != nil && $0.g7BC != nil })
        let p = both.projectile(diameterInches: 0.264)
        XCTAssertEqual(p.dragModel, .g7)
        XCTAssertEqual(p.bc, both.g7BC)

        let eldm = try XCTUnwrap(c.ammo(id: "hornady-match-65-creedmoor-140"))
        let proj = eldm.projectile(diameterInches: 0.264, muzzleVelocityOverride: 2650)
        XCTAssertEqual(proj.dragModel, .g7)
        XCTAssertEqual(proj.bc, 0.326, accuracy: 0.001)
        XCTAssertEqual(proj.muzzleVelocityFPS, 2650)
        XCTAssertEqual(proj.weightGrains, 140)

        let g1Only = try XCTUnwrap(c.ammo.first { $0.g7BC == nil })
        let q = g1Only.projectile(diameterInches: 0.308)
        XCTAssertEqual(q.dragModel, .g1)
        XCTAssertEqual(q.bc, g1Only.g1BC)
        // Forcing G1 on a load that has both uses the G1 value.
        XCTAssertEqual(eldm.projectile(diameterInches: 0.264, dragModel: .g1).bc, eldm.g1BC)
    }

    func testCatalogJoinsResolve() throws {
        let c = try loadCatalog()
        for f in c.firearms { XCTAssertNotNil(c.caliber(id: f.caliberID), f.id) }
        for a in c.ammo { XCTAssertNotNil(c.caliber(id: a.caliberID), a.id) }
    }
}

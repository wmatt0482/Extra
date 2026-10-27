import Foundation
import Observation
import OSLog
import ZeroInCore

/// Firearms of one category, for sectioned lists.
struct FirearmGroup: Identifiable {
    let category: FirearmCategory
    let firearms: [CatalogFirearm]
    var id: FirearmCategory { category }
}

/// Loads the bundled catalog once. Observable so views can search.
@Observable
final class CatalogStore {
    static let shared = CatalogStore()

    private(set) var catalog: Catalog = .empty

    private static let log = Logger(subsystem: "com.wmatt.zeroin", category: "Catalog")

    init() {
        load()
    }

    /// Reads calibers/firearms/ammo/targets JSON from the app bundle.
    /// Looks in the bundle root first, then in a "Catalog" folder reference.
    func load() {
        guard let calibers = Self.data(named: "calibers"),
              let firearms = Self.data(named: "firearms"),
              let ammo = Self.data(named: "ammo"),
              let targets = Self.data(named: "targets") else {
            Self.log.error("Catalog JSON files not found in bundle")
            return
        }
        do {
            let loaded = try Catalog.load(calibersJSON: calibers, firearmsJSON: firearms,
                                          ammoJSON: ammo, targetsJSON: targets)
            for problem in loaded.validate() {
                Self.log.warning("Catalog problem: \(problem, privacy: .public)")
            }
            catalog = loaded
            Self.log.info("Catalog loaded: \(loaded.calibers.count) calibers, \(loaded.firearms.count) firearms, \(loaded.ammo.count) loads, \(loaded.targets.count) targets")
        } catch {
            Self.log.error("Catalog decode failed: \(String(describing: error), privacy: .public)")
        }
    }

    private static func data(named name: String) -> Data? {
        let url = Bundle.main.url(forResource: name, withExtension: "json")
            ?? Bundle.main.url(forResource: name, withExtension: "json", subdirectory: "Catalog")
        guard let url else { return nil }
        return try? Data(contentsOf: url)
    }

    // MARK: - Helpers

    /// Display name for a catalog caliber ID, if known.
    func caliberName(for id: String?) -> String? {
        guard let id else { return nil }
        return catalog.caliber(id: id)?.name
    }

    /// All calibers, sorted by display name (numeric-aware).
    var calibersSortedByName: [CatalogCaliber] {
        catalog.calibers.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    /// Firearms in one category, sorted by name then caliber.
    func firearmsGrouped(by category: FirearmCategory) -> [CatalogFirearm] {
        sorted(catalog.firearms.filter { $0.category == category })
    }

    /// Firearms matching a search query, grouped into non-empty category sections.
    func groupedFirearms(matching query: String = "") -> [FirearmGroup] {
        let found = catalog.searchFirearms(query)
        return FirearmCategory.allCases.compactMap { cat in
            let items = sorted(found.filter { $0.category == cat })
            return items.isEmpty ? nil : FirearmGroup(category: cat, firearms: items)
        }
    }

    /// Calibers matching a query on name or alias, sorted by name.
    func calibers(matching query: String) -> [CatalogCaliber] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return calibersSortedByName }
        return calibersSortedByName.filter { c in
            let hay = ([c.name] + (c.aliases ?? [])).joined(separator: " ").lowercased()
            return q.split(separator: " ").allSatisfy { hay.contains($0) }
        }
    }

    private func sorted(_ list: [CatalogFirearm]) -> [CatalogFirearm] {
        list.sorted {
            let a = $0.displayName, b = $1.displayName
            if a != b { return a.localizedStandardCompare(b) == .orderedAscending }
            return (catalog.caliber(id: $0.caliberID)?.name ?? "")
                .localizedStandardCompare(catalog.caliber(id: $1.caliberID)?.name ?? "") == .orderedAscending
        }
    }
}

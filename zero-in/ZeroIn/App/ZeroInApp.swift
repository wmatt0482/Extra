import SwiftUI
import SwiftData
import ZeroInCore

@main
struct ZeroInApp: App {
    private let container: ModelContainer
    private let storeIsTemporary: Bool

    init() {
        let made = Self.makeContainer()
        container = made.container
        storeIsTemporary = made.temporary
        // Load the bundled catalog now so the Library opens instantly.
        _ = CatalogStore.shared
    }

    var body: some Scene {
        WindowGroup {
            RootView(storeIsTemporary: storeIsTemporary)
        }
        .modelContainer(container)
    }

    /// Opens the on-disk store; if that fails (corrupt store, failed migration)
    /// falls back to an in-memory store so the app still launches. The flag
    /// lets the UI warn that nothing will be saved.
    private static func makeContainer() -> (container: ModelContainer, temporary: Bool) {
        let schema = Schema([RifleProfile.self, SightInSession.self, ShotGroupRecord.self])
        do {
            let disk = ModelConfiguration(schema: schema)
            return (try ModelContainer(for: schema, configurations: disk), false)
        } catch {
            let memory = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
            do {
                return (try ModelContainer(for: schema, configurations: memory), true)
            } catch {
                fatalError("ZeroIn could not create a data store: \(error)")
            }
        }
    }
}

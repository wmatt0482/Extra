import SwiftUI
import SwiftData

struct RootView: View {
    /// True when the on-disk store failed to open and data is in memory only.
    var storeIsTemporary: Bool = false

    @Environment(\.modelContext) private var modelContext
    @State private var selection: AppTab = LaunchOptions.initialTab ?? .range

    var body: some View {
        TabView(selection: $selection) {
            RangeHomeView()
                .tabItem { Label("Range", systemImage: "scope") }
                .tag(AppTab.range)
            LibraryView()
                .tabItem { Label("Library", systemImage: "books.vertical") }
                .tag(AppTab.library)
            BallisticsView()
                .tabItem { Label("Ballistics", systemImage: "chart.line.uptrend.xyaxis") }
                .tag(AppTab.ballistics)
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(AppTab.settings)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            if storeIsTemporary {
                Text("Storage unavailable: changes will be lost when you close the app.")
                    .font(.footnote.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .padding(.horizontal, 16)
                    .background(.red)
                    .foregroundStyle(.white)
            }
        }
        .task {
            if LaunchOptions.seedDemo {
                DemoData.seedIfNeeded(into: modelContext)
            }
        }
    }
}

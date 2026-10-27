import SwiftUI

struct RootView: View {
    /// True when the on-disk store failed to open and data is in memory only.
    var storeIsTemporary: Bool = false

    var body: some View {
        TabView {
            RangeHomeView()
                .tabItem { Label("Range", systemImage: "scope") }
            LibraryView()
                .tabItem { Label("Library", systemImage: "books.vertical") }
            BallisticsView()
                .tabItem { Label("Ballistics", systemImage: "chart.line.uptrend.xyaxis") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
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
    }
}

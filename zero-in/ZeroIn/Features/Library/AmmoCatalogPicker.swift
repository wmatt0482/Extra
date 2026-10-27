import SwiftUI
import ZeroInCore

/// Searchable catalog list of factory loads for one caliber. Pushed from the editor.
struct AmmoCatalogPicker: View {
    let caliberID: String?
    var selectedID: String?
    let onSelect: (CatalogAmmo) -> Void

    @Environment(\.dismiss) private var dismiss
    private let store = CatalogStore.shared
    @State private var query = ""

    var body: some View {
        Group {
            if let caliberID {
                list(for: caliberID)
            } else {
                ContentUnavailableView("Pick a caliber first",
                                       systemImage: "scope",
                                       description: Text("Choose the rifle, then pick a load for its caliber."))
            }
        }
        .navigationTitle("Choose ammo")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func list(for caliberID: String) -> some View {
        let loads = store.catalog.searchAmmo(query, caliberID: caliberID).sorted {
            if $0.make != $1.make { return $0.make < $1.make }
            if $0.line != $1.line { return $0.line < $1.line }
            return $0.bulletWeightGrains < $1.bulletWeightGrains
        }
        return List {
            if loads.isEmpty {
                ContentUnavailableView.search(text: query)
            }
            ForEach(loads) { ammo in
                Button {
                    onSelect(ammo)
                    dismiss()
                } label: {
                    row(ammo)
                }
            }
        }
        .searchable(text: $query, prompt: "Maker, line or weight")
    }

    private func row(_ a: CatalogAmmo) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(a.displayName).foregroundStyle(.primary)
                if let bullet = a.bulletName {
                    Text(bullet).font(.caption).foregroundStyle(.secondary)
                }
                Text(detail(a)).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            if a.id == selectedID {
                Image(systemName: "checkmark").foregroundStyle(Color.accentColor)
            }
        }
    }

    private func detail(_ a: CatalogAmmo) -> String {
        var parts: [String] = []
        if let g1 = a.g1BC { parts.append("G1 \(LibraryFormat.number(g1, maxDigits: 3))") }
        if let g7 = a.g7BC { parts.append("G7 \(LibraryFormat.number(g7, maxDigits: 3))") }
        parts.append("\(LibraryFormat.number(a.muzzleVelocityFPS, maxDigits: 0)) fps")
        return parts.joined(separator: " · ")
    }
}

import SwiftUI
import ZeroInCore

/// Searchable catalog list of firearms, grouped by category. Pushed from the editor.
struct FirearmCatalogPicker: View {
    var selectedID: String?
    let onSelect: (CatalogFirearm) -> Void

    @Environment(\.dismiss) private var dismiss
    private let store = CatalogStore.shared
    @State private var query = ""

    var body: some View {
        let groups = store.groupedFirearms(matching: query)
        List {
            if groups.isEmpty {
                ContentUnavailableView.search(text: query)
            }
            ForEach(groups) { group in
                Section(group.category.label) {
                    ForEach(group.firearms) { firearm in
                        Button {
                            onSelect(firearm)
                            dismiss()
                        } label: {
                            row(firearm)
                        }
                    }
                }
            }
        }
        .navigationTitle("Choose firearm")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, prompt: "Make, model or caliber")
    }

    private func row(_ f: CatalogFirearm) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(f.displayName).foregroundStyle(.primary)
                Text(detail(f)).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            if f.id == selectedID {
                Image(systemName: "checkmark").foregroundStyle(Color.accentColor)
            }
        }
    }

    private func detail(_ f: CatalogFirearm) -> String {
        var parts = [store.caliberName(for: f.caliberID) ?? f.caliberID]
        if let b = f.barrelLengthInches {
            parts.append("\(LibraryFormat.number(b, maxDigits: 2))\" barrel")
        }
        if let t = f.twistInches {
            parts.append("1:\(LibraryFormat.number(t, maxDigits: 2))")
        }
        return parts.joined(separator: " · ")
    }
}

/// Searchable list of catalog calibers, for custom firearms.
struct CaliberPicker: View {
    var selectedID: String?
    let onSelect: (CatalogCaliber) -> Void

    @Environment(\.dismiss) private var dismiss
    private let store = CatalogStore.shared
    @State private var query = ""

    var body: some View {
        let calibers = store.calibers(matching: query)
        List {
            if calibers.isEmpty {
                ContentUnavailableView.search(text: query)
            }
            ForEach(calibers) { cal in
                Button {
                    onSelect(cal)
                    dismiss()
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(cal.name).foregroundStyle(.primary)
                            Text("Bullet diameter \(LibraryFormat.number(cal.bulletDiameterInches, maxDigits: 3)) in")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if cal.id == selectedID {
                            Image(systemName: "checkmark").foregroundStyle(Color.accentColor)
                        }
                    }
                }
            }
        }
        .navigationTitle("Choose caliber")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, prompt: "Caliber")
    }
}

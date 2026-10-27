import SwiftUI
import SwiftData
import ZeroInCore

/// Create (profile == nil) or edit a rifle profile. Presented as a sheet.
struct ProfileEditorView: View {
    let profile: RifleProfile?

    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query private var allProfiles: [RifleProfile]
    @AppStorage(AppSettings.activeProfileIDKey) private var activeProfileID: String = ""
    @AppStorage(AppSettings.distanceUnitKey) private var distanceUnitRaw: String = DistanceUnit.yards.rawValue

    private let store = CatalogStore.shared
    @State private var draft: ProfileDraft

    init(profile: RifleProfile?) {
        self.profile = profile
        let raw = UserDefaults.standard.string(forKey: AppSettings.distanceUnitKey) ?? ""
        let unit = DistanceUnit(rawValue: raw) ?? .yards
        var initial = ProfileDraft(profile: profile, defaultZeroYards: unit.toYards(100))
        if profile == nil {
            // Settings > "Defaults for new setups" click value (0.1 is the common MIL click).
            let click = AppSettings.defaultClickValue()
            initial.clickValue = click
            if !ClickOptions.values(for: .moa).contains(click) && ClickOptions.values(for: .mil).contains(click) {
                initial.clickUnit = .mil
            }
        }
        _draft = State(initialValue: initial)
    }

    private var distanceUnit: DistanceUnit { DistanceUnit(rawValue: distanceUnitRaw) ?? .yards }

    var body: some View {
        NavigationStack {
            Form {
                rifleSection
                ammoSection
                scopeSection
                nameSection
            }
            .navigationTitle(profile == nil ? "New Rifle" : "Edit Rifle")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(!draft.isValid)
                }
            }
            .onChange(of: draft.firearmSource) { _, newValue in
                if newValue == .custom { draft.catalogFirearmID = nil }
            }
            .onChange(of: draft.ammoSource) { _, newValue in
                if newValue == .custom { draft.catalogAmmoID = nil }
            }
            .onChange(of: draft.clickUnit) { _, newUnit in
                draft.clickValue = ClickOptions.values(for: newUnit).first ?? draft.clickValue
            }
        }
    }

    // MARK: - Sections

    private var rifleSection: some View {
        Section("Rifle") {
            Picker("Source", selection: $draft.firearmSource) {
                ForEach(ProfileDraft.Source.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)

            if draft.firearmSource == .catalog {
                NavigationLink {
                    FirearmCatalogPicker(selectedID: draft.catalogFirearmID) { f in
                        draft.applyFirearm(f, catalog: store.catalog)
                    }
                } label: {
                    LabeledContent("Firearm", value: draft.firearmName.isEmpty ? "Choose…" : draft.firearmName)
                }
                if !draft.caliberName.isEmpty {
                    LabeledContent("Caliber", value: draft.caliberName)
                }
            } else {
                TextField("Firearm name", text: $draft.firearmName)
                NavigationLink {
                    CaliberPicker(selectedID: draft.catalogCaliberID) { c in
                        draft.applyCaliber(c, catalog: store.catalog)
                    }
                } label: {
                    LabeledContent("Caliber", value: draft.caliberName.isEmpty ? "Choose…" : draft.caliberName)
                }
                Picker("Type", selection: $draft.category) {
                    ForEach(FirearmCategory.allCases, id: \.self) { Text($0.label).tag($0) }
                }
            }
            NumberRow(title: "Barrel length", value: $draft.barrel, unit: "in")
            NumberRow(title: "Twist (1 in …)", value: $draft.twist, unit: "in")
        }
    }

    private var ammoSection: some View {
        Section {
            Picker("Source", selection: $draft.ammoSource) {
                ForEach(ProfileDraft.Source.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)

            if draft.ammoSource == .catalog {
                NavigationLink {
                    AmmoCatalogPicker(caliberID: draft.catalogCaliberID, selectedID: draft.catalogAmmoID) { a in
                        draft.applyAmmo(a)
                    }
                } label: {
                    LabeledContent("Load", value: draft.ammoName.isEmpty ? "Choose…" : draft.ammoName)
                }
            } else {
                TextField("Load name (e.g. Handload 140 ELD-M)", text: $draft.ammoName)
            }
            NumberRow(title: "Bullet weight", value: $draft.weight, unit: "gr")
            NumberRow(title: "Ballistic coefficient", value: $draft.bc, unit: nil)
            Picker("Drag model", selection: $draft.dragModel) {
                ForEach(DragModel.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
            NumberRow(title: "Muzzle velocity", value: $draft.muzzleVelocity, unit: "fps")
            if draft.catalogCaliberID == nil {
                NumberRow(title: "Bullet diameter", value: $draft.diameter, unit: "in")
            } else {
                LabeledContent("Bullet diameter",
                               value: "\(LibraryFormat.number(draft.diameter ?? 0, maxDigits: 3)) in (from caliber)")
            }
        } header: {
            Text("Ammo")
        } footer: {
            Text("Edit MV to your chronograph. Factory velocities come from test barrels and vary rifle to rifle.")
        }
    }

    private var scopeSection: some View {
        Section("Scope") {
            Picker("Click unit", selection: $draft.clickUnit) {
                ForEach(AngularUnit.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
            Picker("Click value", selection: $draft.clickValue) {
                ForEach(ClickOptions.values(for: draft.clickUnit, including: draft.clickValue), id: \.self) { v in
                    Text("\(LibraryFormat.number(v, maxDigits: 3)) \(draft.clickUnit.label)").tag(v)
                }
            }
            NumberRow(title: "Sight height", value: $draft.sightHeight, unit: "in")
            NumberRow(title: "Zero range", value: zeroRangeDisplay, unit: distanceUnit.label)
        }
    }

    private var nameSection: some View {
        Section {
            TextField(draft.suggestedName.isEmpty ? "Profile name" : draft.suggestedName, text: $draft.name)
            if !draft.suggestedName.isEmpty && draft.name != draft.suggestedName {
                Button("Use \"\(draft.suggestedName)\"") { draft.name = draft.suggestedName }
            }
            TextField("Notes", text: $draft.notes, axis: .vertical)
                .lineLimit(1...4)
        } header: {
            Text("Name")
        } footer: {
            if !draft.isValid {
                Text("Still needed: \(draft.problems.joined(separator: ", ")).")
            }
        }
    }

    // MARK: - Helpers

    /// Zero range shown and edited in the user's distance unit; stored in yards.
    private var zeroRangeDisplay: Binding<Double?> {
        Binding<Double?>(
            get: { draft.zeroRangeYards.map { distanceUnit.fromYards($0) } },
            set: { draft.zeroRangeYards = $0.map { distanceUnit.toYards($0) } }
        )
    }

    private func save() {
        guard draft.isValid else { return }
        if let profile {
            draft.apply(to: profile)
        } else {
            let hasActive = allProfiles.contains { $0.id.uuidString == activeProfileID }
            let created = draft.makeProfile()
            modelContext.insert(created)
            if !hasActive { activeProfileID = created.id.uuidString }
        }
        try? modelContext.save()
        dismiss()
    }
}

/// Common turret click values per angular unit.
enum ClickOptions {
    static func values(for unit: AngularUnit) -> [Double] {
        switch unit {
        case .moa: return [0.25, 0.125, 0.5, 1.0]
        case .mil: return [0.1, 0.05, 0.2]
        case .iphy: return [0.25, 0.5, 1.0]
        }
    }

    /// Options plus the current value, so a stored custom value still displays.
    static func values(for unit: AngularUnit, including current: Double) -> [Double] {
        let base = values(for: unit)
        return base.contains(current) ? base : base + [current]
    }
}

/// Label + right-aligned decimal field + optional unit suffix.
struct NumberRow: View {
    let title: String
    @Binding var value: Double?
    var unit: String?

    var body: some View {
        HStack {
            Text(title)
            Spacer()
            TextField("–", value: $value, format: .number)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 110)
            if let unit {
                Text(unit).foregroundStyle(.secondary)
            }
        }
    }
}

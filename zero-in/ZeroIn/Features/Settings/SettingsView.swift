import SwiftUI
import ZeroInCore

struct SettingsView: View {
    @AppStorage(AppSettings.angularUnitKey) private var angularRaw = AngularUnit.moa.rawValue
    @AppStorage(AppSettings.distanceUnitKey) private var distanceRaw = DistanceUnit.yards.rawValue
    @AppStorage(AppSettings.linearUnitKey) private var linearRaw = LinearUnit.inches.rawValue
    @AppStorage(AppSettings.defaultSightInDistanceKey) private var sightInYards = AppSettings.fallbackSightInDistanceYards
    @AppStorage(AppSettings.defaultClickValueKey) private var clickValue = AppSettings.fallbackClickValue

    private let clickValues: [Double] = [0.1, 0.125, 0.25, 0.5, 1.0]

    private var units: UnitsFormatter {
        UnitsFormatter(distance: DistanceUnit(rawValue: distanceRaw) ?? .yards,
                       linear: LinearUnit(rawValue: linearRaw) ?? .inches)
    }

    var body: some View {
        NavigationStack {
            Form {
                unitsSection
                defaultsSection
                helpSection
                aboutSection
            }
            .navigationTitle("Settings")
        }
    }

    private var unitsSection: some View {
        Section {
            Picker("Angular unit", selection: $angularRaw) {
                ForEach(AngularUnit.allCases, id: \.self) { Text($0.label).tag($0.rawValue) }
            }
            .pickerStyle(.segmented)
            .frame(minHeight: 44)
            Picker("Distance", selection: $distanceRaw) {
                ForEach(DistanceUnit.allCases, id: \.self) { Text($0 == .yards ? "Yards" : "Meters").tag($0.rawValue) }
            }
            .pickerStyle(.segmented)
            .frame(minHeight: 44)
            Picker("Drop and group size", selection: $linearRaw) {
                ForEach(LinearUnit.allCases, id: \.self) { Text($0 == .inches ? "Inches" : "Centimeters").tag($0.rawValue) }
            }
            .pickerStyle(.segmented)
            .frame(minHeight: 44)
        } header: {
            Text("Units")
        } footer: {
            Text("MOA is a true minute of angle (1.047 in at 100 yd). MIL is a milliradian (3.6 in at 100 yd). IPHY is \"shooter's MOA\": exactly 1 in at 100 yd.")
        }
    }

    private var defaultsSection: some View {
        Section {
            Stepper(value: $sightInYards, in: 10...300, step: 5) {
                LabeledContent("Sight-in distance", value: units.range(sightInYards))
            }
            .frame(minHeight: 44)
            Picker("Click value", selection: $clickValue) {
                ForEach(clickValues, id: \.self) { Text(String(format: "%g", $0)).tag($0) }
            }
            .frame(minHeight: 44)
        } header: {
            Text("Defaults for new setups")
        } footer: {
            Text("The click value is in the unit of the profile's scope (for example 0.25 MOA or 0.1 MIL). You can change both on any profile.")
        }
    }

    private var helpSection: some View {
        Section("How corrections are signed") {
            VStack(alignment: .leading, spacing: 8) {
                Text("UP and RIGHT mean the direction your impact will move when you turn the turret, which is the way the turret arrows point.")
                Text("A group that landed low and left needs UP and RIGHT. A group high and right needs DOWN and LEFT.")
                Text("Corrections are rounded to whole clicks on your scope; the screen shows what is left over.")
                    .foregroundStyle(.secondary)
            }
            .font(.subheadline)
            .padding(.vertical, 4)
        }
    }

    private var aboutSection: some View {
        Section {
            LabeledContent("Version", value: Self.versionString)
            Text("Catalog ballistic coefficients and muzzle velocities are manufacturer-published or typical values. Check them against the box and your chronograph, and always confirm your zero on paper.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        } header: {
            Text("About")
        }
    }

    private static var versionString: String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = info?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}

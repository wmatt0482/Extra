import SwiftUI
import SwiftData
import UIKit
import ZeroInCore

/// Read-only summary of one profile with Edit / Make active actions.
struct ProfileDetailView: View {
    let profile: RifleProfile

    @AppStorage(AppSettings.activeProfileIDKey) private var activeProfileID: String = ""
    @AppStorage(AppSettings.distanceUnitKey) private var distanceUnitRaw: String = DistanceUnit.yards.rawValue
    @State private var showingEditor = false

    private var distanceUnit: DistanceUnit { DistanceUnit(rawValue: distanceUnitRaw) ?? .yards }
    private var isActive: Bool { profile.id.uuidString == activeProfileID }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                activeBanner
                card("Rifle", icon: "scope") {
                    line("Firearm", profile.firearmName)
                    line("Caliber", profile.caliberName)
                    line("Type", profile.firearmCategory.label)
                    if let b = profile.barrelLengthInches {
                        line("Barrel", "\(LibraryFormat.number(b, maxDigits: 2)) in")
                    }
                    if let t = profile.twistInches {
                        line("Twist", "1:\(LibraryFormat.number(t, maxDigits: 2))")
                    }
                }
                card("Load", icon: "circle.hexagongrid") {
                    line("Ammo", profile.ammoName)
                    line("Bullet weight", "\(LibraryFormat.number(profile.bulletWeightGrains, maxDigits: 1)) gr")
                    line("BC", profile.bcText)
                    line("Muzzle velocity", "\(LibraryFormat.number(profile.muzzleVelocityFPS, maxDigits: 0)) fps")
                    line("Bullet diameter", "\(LibraryFormat.number(profile.bulletDiameterInches, maxDigits: 3)) in")
                }
                card("Scope", icon: "viewfinder") {
                    line("Clicks", profile.clickText)
                    line("Sight height", "\(LibraryFormat.number(profile.sightHeightInches, maxDigits: 2)) in")
                    line("Zero range", profile.zeroRangeText(unit: distanceUnit))
                }
                card("Zero status", icon: profile.zeroConfirmed ? "checkmark.seal.fill" : "seal") {
                    if profile.zeroConfirmed {
                        line("Status", "Confirmed")
                        if let date = profile.zeroConfirmedAt {
                            line("Confirmed", date.formatted(date: .abbreviated, time: .omitted))
                        }
                    } else {
                        line("Status", "Not confirmed")
                    }
                    line("Sessions", "\(profile.sessions.count)")
                    line("Groups recorded", "\(profile.totalGroupCount)")
                    Button(profile.zeroConfirmed ? "Clear confirmation" : "Mark zero confirmed") {
                        toggleZeroConfirmed()
                    }
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                if !profile.notes.isEmpty {
                    card("Notes", icon: "note.text") {
                        Text(profile.notes).frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(profile.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Edit") { showingEditor = true }
            }
        }
        .sheet(isPresented: $showingEditor) {
            ProfileEditorView(profile: profile)
        }
    }

    @ViewBuilder
    private var activeBanner: some View {
        if isActive {
            Label("Active profile", systemImage: "checkmark.circle.fill")
                .foregroundStyle(Color.green)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            Button {
                activeProfileID = profile.id.uuidString
            } label: {
                Label("Make active", systemImage: "checkmark.circle")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private func toggleZeroConfirmed() {
        profile.zeroConfirmed.toggle()
        profile.zeroConfirmedAt = profile.zeroConfirmed ? Date() : nil
        profile.updatedAt = Date()
    }

    private func card<Content: View>(_ title: String, icon: String,
                                     @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: icon).font(.headline)
            content()
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    private func line(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label).foregroundStyle(.secondary)
            Spacer()
            Text(value).multilineTextAlignment(.trailing)
        }
        .font(.subheadline)
    }
}

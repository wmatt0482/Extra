import Foundation
import SwiftData
import ZeroInCore

/// Seeds a realistic profile with two sessions so screenshots and first runs
/// have something to show. Only runs when the store has no profiles.
enum DemoData {
    @MainActor
    static func seedIfNeeded(into context: ModelContext) {
        let existing = (try? context.fetchCount(FetchDescriptor<RifleProfile>())) ?? 0
        guard existing == 0 else { return }

        // Tikka T3x in .308 Win with Federal Gold Medal Match 168 gr SMK, 1/4-MOA scope, 100 yd zero.
        let profile = RifleProfile(name: "Tikka T3x · FGMM 168",
                                   firearmName: "Tikka T3x Lite", catalogFirearmID: "tikka-t3x-lite-308-win",
                                   caliberName: ".308 Winchester", catalogCaliberID: "308-win",
                                   barrelLengthInches: 22.4, twistInches: 11, firearmCategory: .boltAction,
                                   ammoName: "Federal Gold Medal Match 168 gr",
                                   catalogAmmoID: "federal-gold-medal-match-308-win-168",
                                   bulletWeightGrains: 168, bulletDiameterInches: 0.308,
                                   ballisticCoefficient: 0.462, dragModel: .g1, muzzleVelocityFPS: 2650,
                                   sightHeightInches: 1.5, clickValue: 0.25, clickUnit: .moa, zeroRangeYards: 100)
        context.insert(profile)

        // Session 1: 100 yd, one group 1.50 in low and 0.75 in left → UP 6 / RIGHT 3 clicks.
        let session = SightInSession(profile: profile, distanceYards: 100,
                                     date: Date().addingTimeInterval(-3600))
        context.insert(session)
        session.profile = profile
        let center = Point2D(x: -0.75, y: -1.5)
        let offsets = [Point2D(x: 0.35, y: 0.2), Point2D(x: -0.4, y: 0.1), Point2D(x: 0.1, y: -0.35),
                       Point2D(x: -0.1, y: 0.3), Point2D(x: 0.05, y: -0.25)]
        let shots = offsets.map { center + $0 }
        let stats = GroupAnalyzer.stats(shots)
        let correction = GroupAnalyzer.correction(groupCenter: stats?.center ?? center,
                                                  expectedImpact: .zero, distanceYards: 100, unit: profile.clickUnit)
        let group = ShotGroupRecord(session: session, label: "Group 1", shots: shots,
                                    stats: stats, correction: correction)
        context.insert(group)
        group.session = session
        group.correctionApplied = true

        // Session 2: a 25 yd check from a week earlier.
        let earlier = SightInSession(profile: profile, distanceYards: 25,
                                     date: Date().addingTimeInterval(-8 * 86_400))
        context.insert(earlier)
        earlier.profile = profile

        try? context.save()
        UserDefaults.standard.set(profile.id.uuidString, forKey: AppSettings.activeProfileIDKey)
    }
}

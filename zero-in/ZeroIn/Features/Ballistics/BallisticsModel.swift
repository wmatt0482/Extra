import Foundation
import Observation
import ZeroInCore

/// Everything the solver needs for one table. Plain values, so it can cross
/// to a background task and be compared to detect changes.
struct BallisticsInput: Hashable, Sendable {
    var projectile: Projectile
    var scope: ScopeSpec
    var conditions: ShotConditions
    var maxRangeYards: Double
    var stepYards: Double
    var vitalZoneInches: Double
}

struct ImpactEstimate: Sendable {
    let yards: Double
    /// Target-space inches: +x right, +y up.
    let offset: Point2D
}

struct BallisticsResult: Sendable {
    /// Rows from the first step out to the max range (the 0 yd row is dropped).
    var rows: [TrajectoryPoint]
    var launchAngleRadians: Double
    var impacts: [ImpactEstimate]
    var mpbrZeroYards: Double
    var mpbrMaxYards: Double
    /// Index in `rows` of the first row that drops below Mach 1.2, if the
    /// bullet starts faster than that.
    var transonicIndex: Int?

    static let impactDistances: [Double] = [25, 50, 100, 200]

    static func compute(_ input: BallisticsInput) -> BallisticsResult {
        let solver = BallisticSolver(projectile: input.projectile, scope: input.scope,
                                     conditions: input.conditions)
        let rows = solver.trajectory(maxRangeYards: input.maxRangeYards, stepYards: input.stepYards)
            .filter { $0.rangeYards > 0 }
        let impacts = impactDistances.map {
            ImpactEstimate(yards: $0, offset: solver.expectedImpact(atYards: $0))
        }
        let mpbr = solver.maxPointBlankRange(vitalZoneInches: input.vitalZoneInches)
        var transonic: Int?
        if let idx = rows.firstIndex(where: { $0.mach < 1.2 }), idx > 0 { transonic = idx }
        return BallisticsResult(rows: rows, launchAngleRadians: solver.zeroAngleRadians(),
                                impacts: impacts, mpbrZeroYards: mpbr.zeroRangeYards,
                                mpbrMaxYards: mpbr.maxRangeYards, transonicIndex: transonic)
    }
}

/// Recomputes the table whenever the view hands it a new input. The solver
/// runs on a background task; stale results are dropped.
@Observable
final class BallisticsModel {
    private(set) var result: BallisticsResult?
    private(set) var isComputing = false

    @ObservationIgnored private var task: Task<Void, Never>?
    @ObservationIgnored private var generation = 0

    @MainActor
    func update(_ input: BallisticsInput?) {
        task?.cancel()
        generation += 1
        let current = generation
        guard let input else {
            result = nil
            isComputing = false
            return
        }
        isComputing = true
        task = Task { @MainActor [weak self] in
            let computed = await Task.detached(priority: .userInitiated) {
                BallisticsResult.compute(input)
            }.value
            guard let self, !Task.isCancelled, current == self.generation else { return }
            self.result = computed
            self.isComputing = false
        }
    }
}

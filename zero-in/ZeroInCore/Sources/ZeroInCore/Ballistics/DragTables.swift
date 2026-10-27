import Foundation

/// Standard drag tables. Cd as a function of Mach, linearly interpolated.
///
/// The G1 (79 rows) and G7 (84 rows) tables are the standard BRL drag functions as
/// published by JBM Ballistics / GNU Ballistics (Cd vs. Mach 0…5). Lookups outside
/// the table are clamped to the first / last row.
public enum DragTables {
    /// Drag coefficient of the standard projectile for `model` at `mach`
    /// (linear interpolation between table rows, clamped at both ends).
    public static func dragCoefficient(_ model: DragModel, mach: Double) -> Double {
        table(for: model).dragCoefficient(atMach: mach)
    }

    /// The table for a drag model (internal: the solver keeps a reference to avoid
    /// re-resolving the static on every integrator stage).
    static func table(for model: DragModel) -> Table {
        switch model {
        case .g1: return g1
        case .g7: return g7
        }
    }

    /// One drag function: parallel arrays of Mach numbers (strictly increasing) and Cd.
    struct Table: Sendable {
        let mach: [Double]
        let cd: [Double]

        /// Linear interpolation with a binary search for the bracketing rows.
        func dragCoefficient(atMach m: Double) -> Double {
            let n = mach.count
            // `!(m > first)` also routes NaN to the first row.
            if !(m > mach[0]) { return cd[0] }
            if m >= mach[n - 1] { return cd[n - 1] }
            var lo = 0
            var hi = n - 1
            // Invariant: mach[lo] <= m < mach[hi]
            while hi - lo > 1 {
                let mid = (lo + hi) / 2
                if mach[mid] <= m {
                    lo = mid
                } else {
                    hi = mid
                }
            }
            let t = (m - mach[lo]) / (mach[hi] - mach[lo])
            return cd[lo] + t * (cd[hi] - cd[lo])
        }
    }

    /// Standard G1 (flat-base) drag function, 79 rows.
    static let g1 = Table(
        mach: [
            0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45,
            0.5, 0.55, 0.6, 0.7, 0.725, 0.75, 0.775, 0.8, 0.825, 0.85,
            0.875, 0.9, 0.925, 0.95, 0.975, 1.0, 1.025, 1.05, 1.075, 1.1,
            1.125, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5, 1.55,
            1.6, 1.65, 1.7, 1.75, 1.8, 1.85, 1.9, 1.95, 2.0, 2.05,
            2.1, 2.15, 2.2, 2.25, 2.3, 2.35, 2.4, 2.45, 2.5, 2.6,
            2.7, 2.8, 2.9, 3.0, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6,
            3.7, 3.8, 3.9, 4.0, 4.2, 4.4, 4.6, 4.8, 5.0,
        ],
        cd: [
            0.2629, 0.2558, 0.2487, 0.2413, 0.2344, 0.2278, 0.2214, 0.2155, 0.2104, 0.2061,
            0.2032, 0.202, 0.2034, 0.2165, 0.223, 0.2313, 0.2417, 0.2546, 0.2706, 0.2901,
            0.3136, 0.3415, 0.3734, 0.4084, 0.4448, 0.4805, 0.5136, 0.5427, 0.5677, 0.5883,
            0.6053, 0.6191, 0.6393, 0.6518, 0.6589, 0.6621, 0.6625, 0.6607, 0.6573, 0.6528,
            0.6474, 0.6413, 0.6347, 0.628, 0.621, 0.6141, 0.6072, 0.6003, 0.5934, 0.5867,
            0.5804, 0.5743, 0.5685, 0.563, 0.5577, 0.5527, 0.5481, 0.5438, 0.5397, 0.5325,
            0.5264, 0.5211, 0.5168, 0.5133, 0.5105, 0.5084, 0.5067, 0.5054, 0.504, 0.503,
            0.5022, 0.5016, 0.501, 0.5006, 0.4998, 0.4995, 0.4992, 0.499, 0.4988,
        ]
    )

    /// Standard G7 (long boat-tail) drag function, 84 rows.
    static let g7 = Table(
        mach: [
            0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45,
            0.5, 0.55, 0.6, 0.65, 0.7, 0.725, 0.75, 0.775, 0.8, 0.825,
            0.85, 0.875, 0.9, 0.925, 0.95, 0.975, 1.0, 1.025, 1.05, 1.075,
            1.1, 1.125, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.5, 1.55,
            1.6, 1.65, 1.7, 1.75, 1.8, 1.85, 1.9, 1.95, 2.0, 2.05,
            2.1, 2.15, 2.2, 2.25, 2.3, 2.35, 2.4, 2.45, 2.5, 2.55,
            2.6, 2.65, 2.7, 2.75, 2.8, 2.85, 2.9, 2.95, 3.0, 3.1,
            3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.0, 4.2,
            4.4, 4.6, 4.8, 5.0,
        ],
        cd: [
            0.1198, 0.1197, 0.1196, 0.1194, 0.1193, 0.1194, 0.1194, 0.1194, 0.1193, 0.1193,
            0.1194, 0.1193, 0.1194, 0.1197, 0.1202, 0.1207, 0.1215, 0.1226, 0.1242, 0.1266,
            0.1306, 0.1368, 0.1464, 0.166, 0.2054, 0.2993, 0.3803, 0.4015, 0.4043, 0.4034,
            0.4014, 0.3987, 0.3955, 0.3884, 0.381, 0.3732, 0.3657, 0.358, 0.344, 0.3376,
            0.3315, 0.326, 0.3209, 0.316, 0.3117, 0.3078, 0.3042, 0.301, 0.298, 0.2951,
            0.2922, 0.2892, 0.2864, 0.2835, 0.2807, 0.2779, 0.2752, 0.2725, 0.2697, 0.267,
            0.2643, 0.2615, 0.2588, 0.2561, 0.2533, 0.2506, 0.2479, 0.2451, 0.2424, 0.2368,
            0.2313, 0.2258, 0.2205, 0.2154, 0.2106, 0.206, 0.2017, 0.1975, 0.1935, 0.1861,
            0.1793, 0.173, 0.1672, 0.1618,
        ]
    )
}

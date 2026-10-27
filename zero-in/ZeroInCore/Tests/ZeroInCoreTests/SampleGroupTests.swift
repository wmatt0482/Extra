import XCTest
@testable import ZeroInCore

/// The five-shot group drawn on the app's sample target
/// (`ZeroIn/Features/Range/SampleTarget.swift`) and seeded by `DemoData`. These
/// are the numbers the `-demoCapture results` screen must show.
final class SampleGroupTests: XCTestCase {
    private let eps = 1e-9

    /// Mirrors `SampleTarget.groupCenterInches` / `shotOffsetsInches`.
    private let center = Point2D(x: -0.75, y: -1.5)
    private let offsets = [Point2D(x: 0.35, y: 0.2), Point2D(x: -0.4, y: 0.1), Point2D(x: 0.1, y: -0.35),
                           Point2D(x: -0.1, y: 0.3), Point2D(x: 0.05, y: -0.25)]
    private var shots: [Point2D] { offsets.map { center + $0 } }

    func testSampleGroupCenter() throws {
        let s = try XCTUnwrap(GroupAnalyzer.stats(shots))
        XCTAssertEqual(s.shotCount, 5)
        XCTAssertEqual(s.center.x, -0.75, accuracy: eps)
        XCTAssertEqual(s.center.y, -1.5, accuracy: eps)
    }

    func testSampleGroupCorrectionAt100YardsIsUp6Right3() throws {
        let s = try XCTUnwrap(GroupAnalyzer.stats(shots))
        let c = GroupAnalyzer.correction(groupCenter: s.center, expectedImpact: .zero,
                                         distanceYards: 100, unit: .moa)
        XCTAssertEqual(c.elevationDirection, .up)
        XCTAssertEqual(c.windageDirection, .right)
        let clicks = c.clicks(on: .quarterMOA)
        XCTAssertEqual(clicks.elevation, 6)
        XCTAssertEqual(clicks.windage, 3)
    }

    /// The sample image geometry (120 px/in, bull at pixel (736, 1096), +y down)
    /// read back through a two-point calibration on two grid intersections
    /// 1 in apart recovers the same shots and correction.
    func testSamplePixelsRoundTripThroughTwoPointCalibration() throws {
        let ppi = 120.0
        let poa = Point2D(x: 736, y: 1096)
        func pixel(_ t: Point2D) -> Point2D { Point2D(x: poa.x + t.x * ppi, y: poa.y - t.y * ppi) }

        let cal = TargetCalibration.twoPoint(a: pixel(Point2D(x: 2, y: 3)), b: pixel(Point2D(x: 3, y: 3)),
                                             knownInches: 1, poaPixel: poa)
        XCTAssertEqual(cal.pixelsPerInch, ppi, accuracy: 1e-6)

        let measured = shots.map { cal.targetPoint(fromPixel: pixel($0)) }
        for (m, truth) in zip(measured, shots) {
            XCTAssertEqual(m.x, truth.x, accuracy: 1e-9)
            XCTAssertEqual(m.y, truth.y, accuracy: 1e-9)
        }
        let s = try XCTUnwrap(GroupAnalyzer.stats(measured))
        let clicks = GroupAnalyzer.correction(groupCenter: s.center, distanceYards: 100, unit: .moa)
            .clicks(on: .quarterMOA)
        XCTAssertEqual(clicks.elevation, 6)
        XCTAssertEqual(clicks.windage, 3)
    }
}

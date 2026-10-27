import XCTest
@testable import ZeroInCore

final class GroupAnalysisTests: XCTestCase {
    private let eps = 1e-9

    /// A 1" square with a shot in the middle, centered 1.5" low and 0.75" left of the POA.
    private let squareGroup: [Point2D] = [
        Point2D(x: -1.25, y: -2.0), Point2D(x: -0.25, y: -2.0),
        Point2D(x: -1.25, y: -1.0), Point2D(x: -0.25, y: -1.0),
        Point2D(x: -0.75, y: -1.5),
    ]

    // MARK: - stats

    func testFiveShotGroupStats() throws {
        let s = try XCTUnwrap(GroupAnalyzer.stats(squareGroup))
        XCTAssertEqual(s.shotCount, 5)
        XCTAssertEqual(s.center.x, -0.75, accuracy: eps)
        XCTAssertEqual(s.center.y, -1.5, accuracy: eps)
        // Diagonal of a 1" square.
        XCTAssertEqual(s.extremeSpreadInches, 2.0.squareRoot(), accuracy: eps)
        // Four corners at √0.5 from the center, one at 0 → 4·√0.5 / 5.
        XCTAssertEqual(s.meanRadiusInches, 4 * 0.5.squareRoot() / 5, accuracy: eps)
        XCTAssertEqual(s.horizontalSpreadInches, 1.0, accuracy: eps)
        XCTAssertEqual(s.verticalSpreadInches, 1.0, accuracy: eps)
        // Radii {√.5 ×4, 0}: mean 0.565685, variance 0.08 → 0.282843.
        XCTAssertEqual(s.radialStdDevInches, 0.08.squareRoot(), accuracy: eps)
    }

    func testAngularSpreads() throws {
        let s = try XCTUnwrap(GroupAnalyzer.stats(squareGroup))
        XCTAssertEqual(s.extremeSpread(in: .moa, atYards: 100), 2.0.squareRoot() / 1.047_197_551, accuracy: 1e-9)
        XCTAssertEqual(s.extremeSpread(in: .moa, atYards: 200), 2.0.squareRoot() / 1.047_197_551 / 2, accuracy: 1e-9)
        XCTAssertEqual(s.extremeSpread(in: .mil, atYards: 100), 2.0.squareRoot() / 3.6, accuracy: 1e-9)
        XCTAssertEqual(s.meanRadius(in: .iphy, atYards: 50), s.meanRadiusInches * 2, accuracy: 1e-9)
    }

    func testSingleShotHasZeroSpread() throws {
        let s = try XCTUnwrap(GroupAnalyzer.stats([Point2D(x: 0.3, y: -0.7)]))
        XCTAssertEqual(s.shotCount, 1)
        XCTAssertEqual(s.center, Point2D(x: 0.3, y: -0.7))
        XCTAssertEqual(s.extremeSpreadInches, 0)
        XCTAssertEqual(s.meanRadiusInches, 0)
        XCTAssertEqual(s.horizontalSpreadInches, 0)
        XCTAssertEqual(s.verticalSpreadInches, 0)
        XCTAssertEqual(s.radialStdDevInches, 0)
    }

    func testTwoShots() throws {
        let s = try XCTUnwrap(GroupAnalyzer.stats([Point2D(x: 0, y: 0), Point2D(x: 3, y: 4)]))
        XCTAssertEqual(s.extremeSpreadInches, 5, accuracy: eps)
        XCTAssertEqual(s.meanRadiusInches, 2.5, accuracy: eps)
        XCTAssertEqual(s.center.x, 1.5, accuracy: eps)
        XCTAssertEqual(s.center.y, 2.0, accuracy: eps)
        XCTAssertEqual(s.radialStdDevInches, 0, accuracy: eps)
    }

    func testEmptyIsNil() {
        XCTAssertNil(GroupAnalyzer.stats([]))
    }

    func testStatsCodableRoundTrip() throws {
        let s = try XCTUnwrap(GroupAnalyzer.stats(squareGroup))
        let back = try JSONDecoder().decode(GroupStats.self, from: JSONEncoder().encode(s))
        XCTAssertEqual(back, s)
    }

    // MARK: - correction

    func testCorrectionSignsAllQuadrants() {
        // (group center, expected elevation sign, expected windage sign)
        let cases: [(Point2D, Double, Double)] = [
            (Point2D(x: -1, y: -1), 1, 1),    // low-left  → UP, RIGHT
            (Point2D(x: 1, y: -1), 1, -1),    // low-right → UP, LEFT
            (Point2D(x: -1, y: 1), -1, 1),    // high-left → DOWN, RIGHT
            (Point2D(x: 1, y: 1), -1, -1),    // high-right → DOWN, LEFT
        ]
        for (center, elevSign, windSign) in cases {
            let c = GroupAnalyzer.correction(groupCenter: center, distanceYards: 100, unit: .moa)
            XCTAssertEqual(c.unit, .moa)
            XCTAssertEqual(c.elevation.sign == .minus ? -1.0 : 1.0, elevSign, "elevation for \(center)")
            XCTAssertEqual(c.windage.sign == .minus ? -1.0 : 1.0, windSign, "windage for \(center)")
            XCTAssertEqual(abs(c.elevation), 1 / 1.047_197_551, accuracy: 1e-9)
            XCTAssertEqual(abs(c.windage), 1 / 1.047_197_551, accuracy: 1e-9)
        }
        let lowLeft = GroupAnalyzer.correction(groupCenter: Point2D(x: -1, y: -1), distanceYards: 100, unit: .moa)
        XCTAssertEqual(lowLeft.elevationDirection, .up)
        XCTAssertEqual(lowLeft.windageDirection, .right)
        let highRight = GroupAnalyzer.correction(groupCenter: Point2D(x: 1, y: 1), distanceYards: 100, unit: .mil)
        XCTAssertEqual(highRight.elevationDirection, .down)
        XCTAssertEqual(highRight.windageDirection, .left)
    }

    func testCenteredGroupNeedsNoCorrection() {
        let c = GroupAnalyzer.correction(groupCenter: .zero, distanceYards: 100, unit: .moa)
        XCTAssertEqual(c.elevation, 0)
        XCTAssertEqual(c.windage, 0)
        XCTAssertEqual(c.elevationDirection, .none)
    }

    func testCorrectionToQuarterMOAClicks() throws {
        let s = try XCTUnwrap(GroupAnalyzer.stats(squareGroup))   // 1.5" low, 0.75" left
        let c = GroupAnalyzer.correction(groupCenter: s.center, distanceYards: 100, unit: .moa)
        XCTAssertEqual(c.elevation, 1.5 / 1.047_197_551, accuracy: 1e-9)   // 1.432 MOA
        XCTAssertEqual(c.windage, 0.75 / 1.047_197_551, accuracy: 1e-9)    // 0.716 MOA
        let clicks = c.clicks(on: .quarterMOA)
        XCTAssertEqual(clicks.elevation, 6)   // 5.73 → 6 clicks UP
        XCTAssertEqual(clicks.windage, 3)     // 2.86 → 3 clicks RIGHT
        let residual = c.residual(on: .quarterMOA)
        XCTAssertEqual(residual.elevation, c.elevation - 1.5, accuracy: 1e-9)
        XCTAssertEqual(residual.windage, c.windage - 0.75, accuracy: 1e-9)
    }

    func testCorrectionInMilsAtTwentyFiveYards() {
        // 0.9" high and 0.9" right at 25 yd = 0.9 / 0.9 = 1.0 MIL each way.
        let c = GroupAnalyzer.correction(groupCenter: Point2D(x: 0.9, y: 0.9), distanceYards: 25, unit: .mil)
        XCTAssertEqual(c.elevation, -1.0, accuracy: 1e-9)
        XCTAssertEqual(c.windage, -1.0, accuracy: 1e-9)
        let clicks = c.clicks(on: .tenthMIL)
        XCTAssertEqual(clicks.elevation, -10)
        XCTAssertEqual(clicks.windage, -10)
    }

    func testCorrectionUsesExpectedImpact() {
        // Sighting in at 25 yd for a 100-yd zero: bullets should print 0.6" low.
        // A group exactly 0.6" low is already correct.
        let expected = Point2D(x: 0, y: -0.6)
        let onTarget = GroupAnalyzer.correction(groupCenter: expected, expectedImpact: expected,
                                                distanceYards: 25, unit: .moa)
        XCTAssertEqual(onTarget.elevation, 0, accuracy: 1e-12)
        XCTAssertEqual(onTarget.windage, 0, accuracy: 1e-12)
        // A group on the bull is 0.6" too high → dial DOWN.
        let onBull = GroupAnalyzer.correction(groupCenter: .zero, expectedImpact: expected,
                                              distanceYards: 25, unit: .moa)
        XCTAssertEqual(onBull.elevation, -0.6 / (1.047_197_551 / 4), accuracy: 1e-9)
        XCTAssertEqual(onBull.elevationDirection, .down)
    }

    // MARK: - outliers

    func testNoOutliersInTightGroup() {
        XCTAssertEqual(GroupAnalyzer.outliers(squareGroup), [])
    }

    func testFlierIsFlagged() {
        let shots = squareGroup + [Point2D(x: 4, y: 3)]
        XCTAssertEqual(GroupAnalyzer.outliers(shots), [5])
    }

    func testFlierInTheMiddleOfTheList() {
        var shots = squareGroup
        shots.insert(Point2D(x: -6, y: 2), at: 2)
        XCTAssertEqual(GroupAnalyzer.outliers(shots), [2])
    }

    func testNeverFlagsBelowFourShots() {
        let shots = [Point2D(x: 0, y: 0), Point2D(x: 0.1, y: 0), Point2D(x: 10, y: 10)]
        XCTAssertEqual(GroupAnalyzer.outliers(shots), [])
        XCTAssertEqual(GroupAnalyzer.outliers([]), [])
    }

    func testIdenticalShotsAreNotOutliers() {
        let shots = Array(repeating: Point2D(x: 1, y: 1), count: 5)
        XCTAssertEqual(GroupAnalyzer.outliers(shots), [])
    }
}

final class CanvasTransformTests: XCTestCase {
    // 2000 × 1000 image in a 400 × 400 view: fit scale 0.2, letterboxed 100 pt top and bottom.
    private let base = CanvasTransform(imageWidth: 2000, imageHeight: 1000, viewWidth: 400, viewHeight: 400)

    private func assertClose(_ a: Point2D, _ b: Point2D, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertEqual(a.x, b.x, accuracy: 1e-9, file: file, line: line)
        XCTAssertEqual(a.y, b.y, accuracy: 1e-9, file: file, line: line)
    }

    func testAspectFitMapping() {
        XCTAssertEqual(base.fitScale, 0.2, accuracy: 1e-12)
        XCTAssertEqual(base.originX, 0, accuracy: 1e-12)
        XCTAssertEqual(base.originY, 100, accuracy: 1e-12)
        assertClose(base.viewPoint(fromPixel: Point2D(x: 1000, y: 500)), Point2D(x: 200, y: 200))
        assertClose(base.viewPoint(fromPixel: .zero), Point2D(x: 0, y: 100))
        assertClose(base.pixel(fromViewPoint: Point2D(x: 400, y: 300)), Point2D(x: 2000, y: 1000))
    }

    func testRoundTripWithZoomAndPan() {
        var t = base
        t.zoom = 3.7
        t.panX = -55
        t.panY = 23
        for p in [Point2D(x: 0, y: 0), Point2D(x: 1234.5, y: 678.9), Point2D(x: 2000, y: 1000)] {
            let back = t.pixel(fromViewPoint: t.viewPoint(fromPixel: p))
            XCTAssertEqual(back.x, p.x, accuracy: 1e-9)
            XCTAssertEqual(back.y, p.y, accuracy: 1e-9)
        }
        XCTAssertEqual(t.pixels(fromViewLength: 30), 30 / (0.2 * 3.7), accuracy: 1e-9)
    }

    func testZoomKeepsAnchorFixed() {
        let anchor = Point2D(x: 120, y: 260)
        let before = base.pixel(fromViewPoint: anchor)
        let zoomed = base.zoomed(to: 4, anchor: anchor)
        XCTAssertEqual(zoomed.zoom, 4)
        let after = zoomed.pixel(fromViewPoint: anchor)
        XCTAssertEqual(after.x, before.x, accuracy: 1e-9)
        XCTAssertEqual(after.y, before.y, accuracy: 1e-9)
        // Zooming about the view center from an unpanned state keeps pan at zero.
        let centered = base.zoomed(to: 2, anchor: Point2D(x: 200, y: 200))
        XCTAssertEqual(centered.panX, 0, accuracy: 1e-9)
        XCTAssertEqual(centered.panY, 0, accuracy: 1e-9)
    }

    func testZoomIsClamped() {
        XCTAssertEqual(base.zoomed(to: 0.1, anchor: .zero).zoom, CanvasTransform.minZoom)
        XCTAssertEqual(base.zoomed(to: 100, anchor: .zero).zoom, CanvasTransform.maxZoom)
    }

    func testPanClamp() {
        var t = base
        t.panX = 10_000
        t.panY = -10_000
        let c = t.clampedPan(slack: 0.4)
        XCTAssertEqual(c.panX, 160, accuracy: 1e-9)   // image fits horizontally → only slack
        XCTAssertEqual(c.panY, -160, accuracy: 1e-9)
        t.zoom = 2   // displayed 800 × 400 → may pan ±200 + slack horizontally
        XCTAssertEqual(t.clampedPan(slack: 0.4).panX, 360, accuracy: 1e-9)
    }

    func testClampToImage() {
        XCTAssertEqual(base.clampedToImage(Point2D(x: -5, y: 1200)), Point2D(x: 0, y: 1000))
        XCTAssertTrue(base.isInsideImage(Point2D(x: 10, y: 10)))
        XCTAssertFalse(base.isInsideImage(Point2D(x: 10, y: -1)))
    }
}

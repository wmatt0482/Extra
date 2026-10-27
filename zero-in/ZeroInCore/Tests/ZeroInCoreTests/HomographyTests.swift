import XCTest
@testable import ZeroInCore

final class HomographyTests: XCTestCase {
    /// A known, clearly non-affine map from target-rectangle inches (origin at
    /// the top-left corner, +y up) to photo pixels (+y down).
    private let truth = Homography(m: [80, 10, 300,
                                       5, -75, 200,
                                       0.02, 0.01, 1])
    private let width = 8.5, height = 11.0

    private func assertClose(_ a: Point2D, _ b: Point2D, _ tol: Double, _ msg: String = "",
                             file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertEqual(a.x, b.x, accuracy: tol, msg, file: file, line: line)
        XCTAssertEqual(a.y, b.y, accuracy: tol, msg, file: file, line: line)
    }

    // MARK: - Homography

    func testIdentityAndTranslation() {
        let p = Point2D(x: 3, y: -4)
        XCTAssertEqual(Homography.identity.apply(p), p)
        XCTAssertEqual(Homography.translation(dx: 1, dy: 2).apply(p), Point2D(x: 4, y: -2))
    }

    func testCompositionOrder() {
        let t = Homography.translation(dx: 10, dy: 0)
        let s = Homography(m: [2, 0, 0, 0, 2, 0, 0, 0, 1])
        // (t * s) scales first, then translates.
        XCTAssertEqual((t * s).apply(Point2D(x: 1, y: 1)), Point2D(x: 12, y: 2))
        XCTAssertEqual((s * t).apply(Point2D(x: 1, y: 1)), Point2D(x: 22, y: 2))
    }

    func testFitRecoversKnownHomography() throws {
        let src = [Point2D(x: 0, y: 0), Point2D(x: width, y: 0),
                   Point2D(x: width, y: -height), Point2D(x: 0, y: -height)]
        let dst = src.map { truth.apply($0) }
        let fitted = try XCTUnwrap(Homography.fit(from: src, to: dst))
        for (a, b) in zip(fitted.m, truth.m) {
            XCTAssertEqual(a, b, accuracy: 1e-6 * max(1, abs(b)))
        }
        // Points other than the four used for the fit map identically.
        for q in [Point2D(x: 1, y: -1), Point2D(x: 4.25, y: -5.5), Point2D(x: 7.9, y: -10.2)] {
            assertClose(fitted.apply(q), truth.apply(q), 1e-6)
        }
    }

    func testInverseRoundTrip() throws {
        let inv = try XCTUnwrap(truth.inverted())
        for q in [Point2D(x: 0, y: 0), Point2D(x: 2, y: -3), Point2D(x: 8.5, y: -11)] {
            assertClose(inv.apply(truth.apply(q)), q, 1e-9)
        }
        let product = (truth * inv).m
        let id = Homography.identity.m
        let scale = product[8]
        for (a, b) in zip(product, id) { XCTAssertEqual(a / scale, b, accuracy: 1e-9) }
    }

    func testSingularMatrixHasNoInverse() {
        XCTAssertNil(Homography(m: [1, 2, 3, 2, 4, 6, 0, 0, 1]).inverted())
    }

    func testFitRejectsDegenerateInput() {
        let collinear = [Point2D(x: 0, y: 0), Point2D(x: 1, y: 1), Point2D(x: 2, y: 2), Point2D(x: 3, y: 3)]
        let square = [Point2D(x: 0, y: 0), Point2D(x: 1, y: 0), Point2D(x: 1, y: 1), Point2D(x: 0, y: 1)]
        XCTAssertNil(Homography.fit(from: collinear, to: square))
        XCTAssertNil(Homography.fit(from: square, to: collinear))
        XCTAssertNil(Homography.fit(from: Array(square.prefix(3)), to: Array(square.prefix(3))))
        let same = Array(repeating: Point2D(x: 5, y: 5), count: 4)
        XCTAssertNil(Homography.fit(from: same, to: square))
    }

    func testLinearSolverWithPivoting() throws {
        // Leading zero forces a row swap.
        let x = try XCTUnwrap(Homography.solveLinearSystem([[0, 1, 3], [2, 1, 5]]))
        XCTAssertEqual(x[0], 1, accuracy: 1e-12)
        XCTAssertEqual(x[1], 3, accuracy: 1e-12)
        XCTAssertNil(Homography.solveLinearSystem([[1, 2, 3], [2, 4, 6]]))
    }

    // MARK: - TargetCalibration.fourCorner

    func testFourCornerPerspectiveRoundTrip() throws {
        let rect = [Point2D(x: 0, y: 0), Point2D(x: width, y: 0),
                    Point2D(x: width, y: -height), Point2D(x: 0, y: -height)]
        let corners = rect.map { truth.apply($0) }   // TL, TR, BR, BL in pixels
        let poaRect = Point2D(x: 4.25, y: -5.5)       // target center
        let poaPixel = truth.apply(poaRect)
        let cal = try XCTUnwrap(TargetCalibration.fourCorner(corners: corners, widthInches: width,
                                                              heightInches: height, poaPixel: poaPixel))
        assertClose(cal.targetPoint(fromPixel: poaPixel), .zero, 1e-6, "POA maps to origin")
        for q in [Point2D(x: 1, y: -1), Point2D(x: 7, y: -10), Point2D(x: 2, y: -8), Point2D(x: 8.5, y: 0),
                  Point2D(x: 4.75, y: -5.0)] {
            let pixel = truth.apply(q)
            let expected = q - poaRect          // inches from POA, +y up
            assertClose(cal.targetPoint(fromPixel: pixel), expected, 1e-6, "pixel → target \(q)")
            assertClose(cal.pixel(fromTargetPoint: expected), pixel, 1e-6, "target → pixel \(q)")
        }
        // A shot 0.5" right and 0.5" high of the POA appears up-right in the photo.
        let p = cal.pixel(fromTargetPoint: Point2D(x: 0.5, y: 0.5))
        XCTAssertGreaterThan(p.x, poaPixel.x)
        XCTAssertLessThan(p.y, poaPixel.y)
        // Local scale: between the extremes of the map's per-axis scale (≈ 70–85 px/in).
        XCTAssertGreaterThan(cal.pixelsPerInch, 60)
        XCTAssertLessThan(cal.pixelsPerInch, 90)
    }

    func testFourCornerFrontoParallelScale() throws {
        // A 10" × 8" target photographed square-on at 50 px/in, top-left at (100, 60).
        let corners = [Point2D(x: 100, y: 60), Point2D(x: 600, y: 60),
                       Point2D(x: 600, y: 460), Point2D(x: 100, y: 460)]
        let poa = Point2D(x: 350, y: 260)
        let cal = try XCTUnwrap(TargetCalibration.fourCorner(corners: corners, widthInches: 10,
                                                              heightInches: 8, poaPixel: poa))
        XCTAssertEqual(cal.pixelsPerInch, 50, accuracy: 1e-6)
        assertClose(cal.targetPoint(fromPixel: Point2D(x: 400, y: 160)), Point2D(x: 1, y: 2), 1e-9)
    }

    func testFourCornerRejectsBadInput() {
        let corners = [Point2D(x: 0, y: 0), Point2D(x: 1, y: 0), Point2D(x: 1, y: 1), Point2D(x: 0, y: 1)]
        XCTAssertNil(TargetCalibration.fourCorner(corners: Array(corners.prefix(3)), widthInches: 1,
                                                  heightInches: 1, poaPixel: .zero))
        XCTAssertNil(TargetCalibration.fourCorner(corners: corners, widthInches: 0, heightInches: 1, poaPixel: .zero))
    }

    // MARK: - TargetCalibration.twoPoint

    func testTwoPointUpright() {
        // 40 px/in, POA at (500, 400). Two grid lines 1" apart.
        let cal = TargetCalibration.twoPoint(a: Point2D(x: 100, y: 100), b: Point2D(x: 140, y: 100),
                                             knownInches: 1, poaPixel: Point2D(x: 500, y: 400))
        XCTAssertEqual(cal.pixelsPerInch, 40, accuracy: 1e-9)
        // 80 px right and 120 px *down* = 2" right, 3" low.
        assertClose(cal.targetPoint(fromPixel: Point2D(x: 580, y: 520)), Point2D(x: 2, y: -3), 1e-12)
        assertClose(cal.pixel(fromTargetPoint: Point2D(x: -1, y: 1)), Point2D(x: 460, y: 360), 1e-12)
    }

    func testTwoPointRotatedScaledTargetPreservesDistances() throws {
        // Synthetic target: shots in inches, photographed at 37.5 px/in and
        // rotated 12°. Two-point calibration cannot know the rotation, but it
        // must recover the scale, so distances and group sizes match exactly.
        let ppi = 37.5, angle = 12.0 * .pi / 180
        let poaPixel = Point2D(x: 812, y: 604)
        func toPixel(_ t: Point2D) -> Point2D {
            let x = t.x, y = -t.y   // image y is down
            return Point2D(x: poaPixel.x + ppi * (x * cos(angle) - y * sin(angle)),
                           y: poaPixel.y + ppi * (x * sin(angle) + y * cos(angle)))
        }
        let shots = [Point2D(x: 0.4, y: -1.1), Point2D(x: 1.2, y: -0.6), Point2D(x: 0.9, y: -1.7),
                     Point2D(x: 0.1, y: -0.8)]
        // Two grid intersections 2" apart along the (rotated) horizontal.
        let cal = TargetCalibration.twoPoint(a: toPixel(Point2D(x: -1, y: 3)), b: toPixel(Point2D(x: 1, y: 3)),
                                             knownInches: 2, poaPixel: poaPixel)
        XCTAssertEqual(cal.pixelsPerInch, ppi, accuracy: 1e-9)

        let measured = shots.map { cal.targetPoint(fromPixel: toPixel($0)) }
        for (m, s) in zip(measured, shots) {
            XCTAssertEqual(m.length, s.length, accuracy: 1e-9)
        }
        let truthStats = try XCTUnwrap(GroupAnalyzer.stats(shots))
        let measuredStats = try XCTUnwrap(GroupAnalyzer.stats(measured))
        XCTAssertEqual(measuredStats.extremeSpreadInches, truthStats.extremeSpreadInches, accuracy: 1e-9)
        XCTAssertEqual(measuredStats.meanRadiusInches, truthStats.meanRadiusInches, accuracy: 1e-9)
        XCTAssertEqual(measuredStats.center.length, truthStats.center.length, accuracy: 1e-9)
        // Round trip pixel ↔ target is exact.
        for s in shots {
            let px = toPixel(s)
            assertClose(cal.pixel(fromTargetPoint: cal.targetPoint(fromPixel: px)), px, 1e-9)
        }
    }

    func testTwoPointDegenerateDoesNotProduceNaN() {
        let cal = TargetCalibration.twoPoint(a: Point2D(x: 5, y: 5), b: Point2D(x: 5, y: 5),
                                             knownInches: 1, poaPixel: .zero)
        XCTAssertTrue(cal.pixelsPerInch.isFinite)
        XCTAssertTrue(cal.targetPoint(fromPixel: Point2D(x: 3, y: 4)).x.isFinite)
    }

    func testCalibrationCodableRoundTrip() throws {
        let cal = TargetCalibration.twoPoint(a: .zero, b: Point2D(x: 30, y: 40), knownInches: 2,
                                             poaPixel: Point2D(x: 10, y: 10))
        let back = try JSONDecoder().decode(TargetCalibration.self, from: JSONEncoder().encode(cal))
        XCTAssertEqual(back, cal)
    }
}

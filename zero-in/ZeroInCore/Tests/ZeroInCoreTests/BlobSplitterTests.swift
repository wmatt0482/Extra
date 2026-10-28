import Foundation
import XCTest
@testable import ZeroInCore

final class BlobSplitterTests: XCTestCase {
    /// Nominal hole diameter in pixels (0.30 in at 120 px/in, as on the sample target).
    private let d = 36.0

    // MARK: - Helpers

    /// Outline of the union of equal circles, traced as a star-shaped polygon
    /// around their mean: for each ray, the farthest exit point from any circle.
    /// Exact for overlapping circles in a row.
    private func unionOutline(of centers: [Point2D], radius: Double, samples: Int = 360) -> [Point2D] {
        let origin = centers.reduce(Point2D.zero, +) / Double(centers.count)
        return (0..<samples).map { k in
            let theta = 2 * Double.pi * Double(k) / Double(samples)
            let u = Point2D(x: cos(theta), y: sin(theta))
            var farthest = 0.0
            for c in centers {
                let v = c - origin
                let b = v.x * u.x + v.y * u.y
                let disc = b * b - (v.x * v.x + v.y * v.y - radius * radius)
                if disc >= 0 { farthest = max(farthest, b + disc.squareRoot()) }
            }
            return origin + u * farthest
        }
    }

    private func rectangle(center: Point2D, width: Double, height: Double) -> [Point2D] {
        [Point2D(x: center.x - width / 2, y: center.y - height / 2),
         Point2D(x: center.x + width / 2, y: center.y - height / 2),
         Point2D(x: center.x + width / 2, y: center.y + height / 2),
         Point2D(x: center.x - width / 2, y: center.y + height / 2)]
    }

    /// Asserts every true center has its own found center within `tolerance`
    /// (greedy one-to-one pairing).
    private func assertMatches(_ found: [Point2D], _ truth: [Point2D], tolerance: Double,
                               file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertEqual(found.count, truth.count, "center count", file: file, line: line)
        var remaining = found
        for t in truth {
            guard let i = remaining.indices.min(by: { remaining[$0].distance(to: t) < remaining[$1].distance(to: t) }) else {
                XCTFail("no center left for \(t)", file: file, line: line)
                return
            }
            XCTAssertLessThanOrEqual(remaining[i].distance(to: t), tolerance,
                                     "center for \(t) is \(remaining[i])", file: file, line: line)
            remaining.remove(at: i)
        }
    }

    // MARK: - Shape

    func testShapeOfCircle() throws {
        let c = Point2D(x: 250, y: 180)
        let s = try XCTUnwrap(BlobSplitter.shape(of: unionOutline(of: [c], radius: d / 2), nominalDiameter: d))
        XCTAssertEqual(s.areaRatio, 1, accuracy: 0.01)
        XCTAssertEqual(s.centroid.x, c.x, accuracy: 0.01)
        XCTAssertEqual(s.centroid.y, c.y, accuracy: 0.01)
        XCTAssertEqual(s.length, d, accuracy: 0.05)
        XCTAssertEqual(s.width, d, accuracy: 0.05)
    }

    func testShapeAxisFollowsElongation() throws {
        // Two circles along a 30° line: the principal axis is that line.
        let a = Point2D(x: 100, y: 100)
        let dir = Point2D(x: cos(Double.pi / 6), y: sin(Double.pi / 6))
        let outline = unionOutline(of: [a, a + dir * (0.8 * d)], radius: d / 2)
        let s = try XCTUnwrap(BlobSplitter.shape(of: outline, nominalDiameter: d))
        XCTAssertEqual(abs(s.axis.x * dir.x + s.axis.y * dir.y), 1, accuracy: 1e-4)
        XCTAssertEqual(s.length, 1.8 * d, accuracy: 0.05)
        XCTAssertEqual(s.width, d, accuracy: 0.05)
    }

    func testShapeIgnoresWinding() throws {
        let outline = unionOutline(of: [Point2D(x: 10, y: 20), Point2D(x: 10 + 0.8 * d, y: 20)], radius: d / 2)
        let forward = try XCTUnwrap(BlobSplitter.shape(of: outline, nominalDiameter: d))
        let backward = try XCTUnwrap(BlobSplitter.shape(of: Array(outline.reversed()), nominalDiameter: d))
        XCTAssertEqual(forward.area, backward.area, accuracy: 1e-6)
        XCTAssertEqual(forward.centroid.x, backward.centroid.x, accuracy: 1e-6)
        XCTAssertEqual(forward.centroid.y, backward.centroid.y, accuracy: 1e-6)
    }

    // MARK: - Hole centers

    func testSingleCircleIsOneHoleAtCentroid() {
        let c = Point2D(x: 400, y: 300)
        let found = BlobSplitter.holeCenters(polygon: unionOutline(of: [c], radius: d / 2), nominalDiameter: d)
        assertMatches(found, [c], tolerance: 0.02 * d)
    }

    func testTwoOverlappingCirclesSplitIntoTwo() {
        let truth = [Point2D(x: 200, y: 200), Point2D(x: 200 + 0.8 * d, y: 200)]
        let found = BlobSplitter.holeCenters(polygon: unionOutline(of: truth, radius: d / 2), nominalDiameter: d)
        assertMatches(found, truth, tolerance: 0.15 * d)
    }

    func testDiagonalPairSplitsIntoTwo() {
        let a = Point2D(x: 200, y: 200)
        let truth = [a, a + Point2D(x: 0.6, y: 0.8) * (0.8 * d)]
        let found = BlobSplitter.holeCenters(polygon: unionOutline(of: truth, radius: d / 2), nominalDiameter: d)
        assertMatches(found, truth, tolerance: 0.15 * d)
    }

    /// The sample target's touching pair: centers only ~0.37 d apart, so the
    /// blob holds under 1.6 holes of area but is clearly elongated.
    func testHeavilyOverlappingPairSplitsIntoTwo() throws {
        let truth = [Point2D(x: 300, y: 300), Point2D(x: 300 + 0.37 * d, y: 300)]
        let outline = unionOutline(of: truth, radius: d / 2)
        let s = try XCTUnwrap(BlobSplitter.shape(of: outline, nominalDiameter: d))
        XCTAssertLessThan(s.areaRatio, BlobSplitter.splitAreaRatio)
        let found = BlobSplitter.holeCenters(polygon: outline, nominalDiameter: d)
        assertMatches(found, truth, tolerance: 0.15 * d)
    }

    func testThreeInARowSplitIntoThree() {
        let truth = (0..<3).map { Point2D(x: 150 + Double($0) * 0.8 * d, y: 220) }
        let found = BlobSplitter.holeCenters(polygon: unionOutline(of: truth, radius: d / 2), nominalDiameter: d)
        assertMatches(found, truth, tolerance: 0.15 * d)
    }

    func testFourInARowSplitIntoFour() {
        let truth = (0..<4).map { Point2D(x: 150, y: 120 + Double($0) * 0.85 * d) }
        let found = BlobSplitter.holeCenters(polygon: unionOutline(of: truth, radius: d / 2), nominalDiameter: d)
        assertMatches(found, truth, tolerance: 0.15 * d)
    }

    func testGridLineIsRejected() {
        let line = rectangle(center: Point2D(x: 500, y: 500), width: 10 * d, height: 0.1 * d)
        XCTAssertEqual(BlobSplitter.holeCenters(polygon: line, nominalDiameter: d), [])
        let short = rectangle(center: Point2D(x: 500, y: 500), width: 3 * d, height: 0.2 * d)
        XCTAssertEqual(BlobSplitter.holeCenters(polygon: short, nominalDiameter: d), [])
    }

    func testTooSmallAndTooLargeBlobsAreRejected() {
        let speck = unionOutline(of: [Point2D(x: 50, y: 50)], radius: 0.15 * d)
        XCTAssertEqual(BlobSplitter.holeCenters(polygon: speck, nominalDiameter: d), [])
        let bigDot = unionOutline(of: [Point2D(x: 50, y: 50)], radius: 1.65 * d)
        XCTAssertEqual(BlobSplitter.holeCenters(polygon: bigDot, nominalDiameter: d), [])
    }

    func testDegenerateInputReturnsNothing() {
        XCTAssertEqual(BlobSplitter.holeCenters(polygon: [], nominalDiameter: d), [])
        XCTAssertEqual(BlobSplitter.holeCenters(polygon: [Point2D(x: 1, y: 1), Point2D(x: 2, y: 2)], nominalDiameter: d), [])
        let circle = unionOutline(of: [Point2D(x: 10, y: 10)], radius: d / 2)
        XCTAssertEqual(BlobSplitter.holeCenters(polygon: circle, nominalDiameter: 0), [])
        XCTAssertEqual(BlobSplitter.holeCenters(polygon: circle, nominalDiameter: -d), [])
        XCTAssertNil(BlobSplitter.shape(of: [Point2D(x: 0, y: 0), Point2D(x: 1, y: 1), Point2D(x: 2, y: 2)],
                                        nominalDiameter: d))
    }
}

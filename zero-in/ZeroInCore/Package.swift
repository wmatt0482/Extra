// swift-tools-version: 5.9
// ZeroInCore: platform-independent math for the ZeroIn app.
// Ballistics (G1/G7 point-mass solver), shot-group analysis, scope corrections,
// unit conversions and the bundled firearm/ammo catalog types.
// No UIKit/SwiftUI here, so `swift test` runs on macOS and Linux.
import PackageDescription

let package = Package(
    name: "ZeroInCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "ZeroInCore", targets: ["ZeroInCore"]),
    ],
    targets: [
        .target(name: "ZeroInCore", path: "Sources/ZeroInCore"),
        .testTarget(name: "ZeroInCoreTests", dependencies: ["ZeroInCore"], path: "Tests/ZeroInCoreTests"),
    ]
)

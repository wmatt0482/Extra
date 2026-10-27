import SwiftUI
import UIKit
import ZeroInCore

/// Something drawn on the target photo, positioned in image pixels.
struct CanvasMarker: Identifiable, Equatable {
    enum Kind: Equatable { case calibration, poa, hole, suggestedHole, groupCenter, expectedImpact }
    var id: String
    var kind: Kind
    var pixel: Point2D
    var label: String? = nil
    var draggable: Bool = false
}

/// A line (open or closed) through image-pixel points, e.g. the calibration quad.
struct CanvasPolyline: Identifiable, Equatable {
    var id: String
    var points: [Point2D]
    var closed: Bool = false
    var color: Color = .blue
}

/// Zoomable / pannable target photo with markers. All callbacks speak image
/// pixels; every view↔pixel conversion goes through `CanvasTransform`.
struct TargetCanvasView: View {
    let image: UIImage
    var markers: [CanvasMarker] = []
    var polylines: [CanvasPolyline] = []
    var allowsPanZoom: Bool = true
    /// Tap at an image pixel, with the finger-sized hit radius converted to pixels.
    var onTap: ((Point2D, Double) -> Void)? = nil
    /// A draggable marker was moved to a new pixel position.
    var onMoveMarker: ((String, Point2D) -> Void)? = nil

    @State private var zoom: Double = 1
    @State private var panX: Double = 0
    @State private var panY: Double = 0
    @State private var pinchStart: CanvasTransform? = nil
    @State private var drag: DragState? = nil

    private enum DragState {
        case pan(startX: Double, startY: Double)
        case marker(id: String, grabOffset: CGSize)
    }

    /// Finger-sized hit radius in view points (gloves).
    static let hitRadius: Double = 30

    var body: some View {
        GeometryReader { geo in
            let t = transform(for: geo.size)
            ZStack(alignment: .topLeading) {
                Color.black
                Image(uiImage: image)
                    .resizable()
                    .interpolation(.medium)
                    .frame(width: t.displayedWidth, height: t.displayedHeight)
                    .position(x: t.originX + t.displayedWidth / 2, y: t.originY + t.displayedHeight / 2)
                ForEach(polylines) { line in
                    polylinePath(line, t).stroke(line.color, style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
                }
                ForEach(markers) { marker in
                    let v = t.viewPoint(fromPixel: marker.pixel)
                    MarkerGlyph(marker: marker)
                        .position(x: v.x, y: v.y)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .clipped()
            .contentShape(Rectangle())
            .gesture(tapGesture(t), including: onTap != nil ? .all : .none)
            .simultaneousGesture(dragGesture(t), including: (allowsPanZoom || onMoveMarker != nil) ? .all : .none)
            .simultaneousGesture(magnifyGesture(t), including: allowsPanZoom ? .all : .none)
            .overlay(alignment: .bottomTrailing) {
                if allowsPanZoom { zoomButtons(t) }
            }
        }
    }

    private func transform(for size: CGSize) -> CanvasTransform {
        CanvasTransform(imageWidth: Double(image.size.width), imageHeight: Double(image.size.height),
                        viewWidth: Double(size.width), viewHeight: Double(size.height),
                        zoom: zoom, panX: panX, panY: panY)
    }

    private func apply(_ t: CanvasTransform) {
        let c = t.clampedPan()
        zoom = c.zoom
        panX = c.panX
        panY = c.panY
    }

    private func polylinePath(_ line: CanvasPolyline, _ t: CanvasTransform) -> Path {
        Path { path in
            let pts = line.points.map { t.viewPoint(fromPixel: $0) }
            guard let first = pts.first else { return }
            path.move(to: CGPoint(x: first.x, y: first.y))
            for p in pts.dropFirst() { path.addLine(to: CGPoint(x: p.x, y: p.y)) }
            if line.closed && pts.count > 2 { path.closeSubpath() }
        }
    }

    // MARK: Gestures

    private func tapGesture(_ t: CanvasTransform) -> some Gesture {
        SpatialTapGesture()
            .onEnded { value in
                guard let onTap else { return }
                let pixel = t.pixel(fromViewPoint: Point2D(x: Double(value.location.x), y: Double(value.location.y)))
                guard t.isInsideImage(pixel) else { return }
                onTap(pixel, t.pixels(fromViewLength: Self.hitRadius))
            }
    }

    private func dragGesture(_ t: CanvasTransform) -> some Gesture {
        DragGesture(minimumDistance: 6)
            .onChanged { value in
                if pinchStart != nil { return }   // a pinch is in progress
                if drag == nil { drag = beginDrag(at: value.startLocation, t) }
                guard let state = drag else { return }
                switch state {
                case .marker(let id, let grab):
                    let v = Point2D(x: Double(value.location.x + grab.width), y: Double(value.location.y + grab.height))
                    onMoveMarker?(id, t.clampedToImage(t.pixel(fromViewPoint: v)))
                case .pan(let startX, let startY):
                    guard allowsPanZoom else { return }
                    var next = t
                    next.panX = startX + Double(value.translation.width)
                    next.panY = startY + Double(value.translation.height)
                    apply(next)
                }
            }
            .onEnded { _ in drag = nil }
    }

    private func beginDrag(at start: CGPoint, _ t: CanvasTransform) -> DragState {
        if onMoveMarker != nil {
            let s = Point2D(x: Double(start.x), y: Double(start.y))
            let nearest = markers.filter(\.draggable)
                .map { ($0, t.viewPoint(fromPixel: $0.pixel)) }
                .min { $0.1.distance(to: s) < $1.1.distance(to: s) }
            if let hit = nearest, hit.1.distance(to: s) <= Self.hitRadius {
                let v = hit.1
                return .marker(id: hit.0.id, grabOffset: CGSize(width: v.x - s.x, height: v.y - s.y))
            }
        }
        return .pan(startX: panX, startY: panY)
    }

    private func magnifyGesture(_ t: CanvasTransform) -> some Gesture {
        MagnifyGesture()
            .onChanged { value in
                let start = pinchStart ?? t
                if pinchStart == nil { pinchStart = t }
                let anchor = Point2D(x: Double(value.startLocation.x), y: Double(value.startLocation.y))
                apply(start.zoomed(to: start.zoom * Double(value.magnification), anchor: anchor))
            }
            .onEnded { _ in pinchStart = nil }
    }

    private func zoomButtons(_ t: CanvasTransform) -> some View {
        let center = Point2D(x: t.viewWidth / 2, y: t.viewHeight / 2)
        return VStack(spacing: 8) {
            canvasButton("plus.magnifyingglass", "Zoom in") { apply(t.zoomed(to: t.zoom * 1.6, anchor: center)) }
            canvasButton("minus.magnifyingglass", "Zoom out") { apply(t.zoomed(to: t.zoom / 1.6, anchor: center)) }
            canvasButton("arrow.down.right.and.arrow.up.left", "Fit") {
                zoom = 1
                panX = 0
                panY = 0
            }
        }
        .padding(10)
    }

    private func canvasButton(_ symbol: String, _ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.title3.weight(.semibold))
                .frame(width: 48, height: 48)
                .background(.ultraThinMaterial, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// The on-screen symbol for one marker. Fixed screen size regardless of zoom.
private struct MarkerGlyph: View {
    let marker: CanvasMarker

    var body: some View {
        ZStack {
            switch marker.kind {
            case .calibration:
                Crosshair(size: 34, color: .blue)
            case .poa:
                Crosshair(size: 40, color: .green)
                Circle().stroke(Color.green, lineWidth: 2).frame(width: 18, height: 18)
            case .hole:
                Circle().stroke(Color.red, lineWidth: 3).frame(width: 24, height: 24)
                Circle().fill(Color.red).frame(width: 4, height: 4)
            case .suggestedHole:
                Circle().stroke(Color.orange, style: StrokeStyle(lineWidth: 3, dash: [4, 3])).frame(width: 26, height: 26)
                Circle().fill(Color.orange).frame(width: 4, height: 4)
            case .groupCenter:
                Rectangle().fill(Color.black).frame(width: 17, height: 17).rotationEffect(.degrees(45))
                Rectangle().fill(Color.yellow).frame(width: 14, height: 14).rotationEffect(.degrees(45))
            case .expectedImpact:
                Circle().stroke(Color.cyan, lineWidth: 3).frame(width: 30, height: 30)
                Crosshair(size: 16, color: .cyan)
            }
            if let label = marker.label {
                Text(label)
                    .font(.caption.bold())
                    .padding(.horizontal, 4)
                    .background(.black.opacity(0.6), in: RoundedRectangle(cornerRadius: 4))
                    .foregroundStyle(.white)
                    .offset(x: 0, y: -26)
            }
        }
        .allowsHitTesting(false)
    }
}

private struct Crosshair: View {
    let size: CGFloat
    let color: Color

    var body: some View {
        ZStack {
            Rectangle().fill(color).frame(width: size, height: 2)
            Rectangle().fill(color).frame(width: 2, height: size)
            Rectangle().fill(Color.black.opacity(0.5)).frame(width: 2, height: 2)
        }
        .shadow(color: .black.opacity(0.6), radius: 1)
    }
}

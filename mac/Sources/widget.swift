// Desktop widgets, in the style of macOS's own desktop widgets:
//  • Stats (medium): four rings for Food, Happy, Energy and Clean, like the Batteries widget.
//  • Portrait (small): your main Pokémon's face, showing how it feels right now.
// Drag either one anywhere; when you let go it lines up with the macOS widget grid. Click to open the game.

import Cocoa
import SwiftUI

final class WidgetModel: ObservableObject {
    @Published var info: PetInfo?
    @Published var portrait: NSImage?
}

// macOS desktop widget sizes and grid
enum WidgetGrid {
    static let small = NSSize(width: 164, height: 164)
    static let medium = NSSize(width: 344, height: 162)
    static let radius: CGFloat = 23
    static let margin: CGFloat = 16       // from the screen's left edge
    static let colPitch: CGFloat = 180    // small widget (164) + gap (16)
    static let rowTop: CGFloat = 56       // first row, from the top of the screen
    static let rowPitch: CGFloat = 179.5  // widget height + gap
}

// MARK: - Stats widget

struct Ring: View {
    var value: Double?            // 0…1, nil = empty
    var marker: String? = nil     // SF Symbol in a gap at the top (like the charging bolt)
    var size: CGFloat = 64
    var line: CGFloat = 6
    let gap: Double = 0.07

    var body: some View {
        let start = marker == nil ? 0 : gap / 2, end = marker == nil ? 1 : 1 - gap / 2
        let color = (value ?? 1) < 0.2 ? Color(red: 1, green: 0.27, blue: 0.23) : Color.white.opacity(0.82)
        ZStack {
            Circle().inset(by: line / 2).trim(from: start, to: end)
                .stroke(Color.white.opacity(0.12), style: StrokeStyle(lineWidth: line, lineCap: .round))
            if let v = value {
                Circle().inset(by: line / 2).trim(from: start, to: start + (end - start) * max(0.005, min(1, v)))
                    .stroke(color, style: StrokeStyle(lineWidth: line, lineCap: .round))
                    .animation(.easeInOut(duration: 0.6), value: v)
            }
        }
        .rotationEffect(.degrees(-90))
        .frame(width: size, height: size)
        .overlay(alignment: .top) {
            if let m = marker {
                Image(systemName: m).font(.system(size: line * 1.5, weight: .bold))
                    .foregroundColor(.white.opacity(0.82)).offset(y: -line * 0.25)
            }
        }
    }
}

struct StatsCard: View {
    @ObservedObject var model: WidgetModel

    var body: some View {
        let i = model.info
        let live = i != nil && !i!.egg
        let asleep = live && i!.asleep
        HStack(spacing: 50 / 3) {
            slot(live ? i!.food : nil, "fork.knife")
            slot(live ? i!.joy : nil, "heart.fill")
            slot(live ? i!.ene : nil, "bolt.fill", marker: asleep ? "moon.fill" : nil)
            slot(live ? i!.hyg : nil, "sparkles")
        }
        .padding(.top, 5)
        .frame(width: WidgetGrid.medium.width, height: WidgetGrid.medium.height)
        .modifier(WidgetChrome())
    }

    func slot(_ v: Int?, _ symbol: String, marker: String? = nil) -> some View {
        VStack(spacing: 13) {
            Ring(value: v.map { Double($0) / 100 }, marker: marker)
                .overlay(Image(systemName: symbol).font(.system(size: 21, weight: .medium))
                    .foregroundColor(.white.opacity(v == nil ? 0 : 0.72)))
            Text(v.map { "\($0)%" } ?? " ")
                .font(.system(size: 17, weight: .regular)).monospacedDigit()
                .foregroundColor(.white.opacity(0.72))
        }
    }
}

// MARK: - Portrait widget

struct PortraitCard: View {
    @ObservedObject var model: WidgetModel

    var body: some View {
        let i = model.info
        let S = WidgetGrid.small
        ZStack {
            if i?.egg ?? false {
                Ellipse().fill(Color.white.opacity(0.8)).frame(width: 52, height: 66)
            } else if let p = model.portrait {
                Image(nsImage: p).interpolation(.none).resizable().scaledToFill()
                    .opacity((i?.asleep ?? false) ? 0.75 : 1)
            } else {
                Image(systemName: "questionmark").font(.system(size: 30, weight: .medium))
                    .foregroundColor(.white.opacity(0.3))
            }
        }
        .frame(width: S.width, height: S.height)
        .overlay(alignment: .topTrailing) {
            if i?.asleep ?? false {
                Image(systemName: "moon.fill").font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.white.opacity(0.9)).frame(width: 24, height: 24)
                    .background(Circle().fill(Color.black.opacity(0.3))).padding(10)
            }
        }
        .modifier(WidgetChrome(tint: 0))
        .help(i.map { $0.egg ? "Your egg" : "\($0.main.name) · Lv \($0.level)\($0.mood.isEmpty ? "" : " · " + $0.mood)" } ?? "")
    }
}

/// the look shared by both widgets: a dark glass tint, rounded corners and a hairline edge
struct WidgetChrome: ViewModifier {
    var tint: Double = 0.25
    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: WidgetGrid.radius, style: .continuous)
        content
            .background(Color.black.opacity(tint))
            .clipShape(shape)
            .overlay(shape.strokeBorder(Color.white.opacity(0.1), lineWidth: 1))
    }
}

// MARK: - A movable widget window

/// Takes every click on the widget: drag to move it, click to open the game.
final class DragView: NSView {
    var onClick: (() -> Void)?, onDrop: (() -> Void)?
    private var start = NSPoint.zero, origin = NSPoint.zero, moved = false
    override func hitTest(_ p: NSPoint) -> NSView? { frame.contains(p) ? self : nil }
    override func acceptsFirstMouse(for e: NSEvent?) -> Bool { true }
    override func mouseDown(with e: NSEvent) { start = NSEvent.mouseLocation; origin = window?.frame.origin ?? .zero; moved = false }
    override func mouseDragged(with e: NSEvent) {
        let m = NSEvent.mouseLocation
        if !moved && hypot(m.x - start.x, m.y - start.y) < 3 { return }
        moved = true
        window?.setFrameOrigin(NSPoint(x: origin.x + m.x - start.x, y: origin.y + m.y - start.y))
        settle()
    }
    private func settle() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            guard let self, self.moved else { return }
            if NSEvent.pressedMouseButtons != 0 { self.settle(); return }
            self.moved = false; self.onDrop?()
        }
    }
    override func mouseUp(with e: NSEvent) { if moved { moved = false; onDrop?() } else { onClick?() } }
}

final class WidgetPanel {
    let panel: NSPanel
    let size: NSSize
    private let originKey: String, shownKey: String
    private let d = UserDefaults.standard
    var enabled: Bool { d.object(forKey: shownKey) as? Bool ?? true }

    init<V: View>(_ view: V, size: NSSize, originKey: String, shownKey: String, defaultOrigin: (NSRect) -> NSPoint) {
        self.size = size; self.originKey = originKey; self.shownKey = shownKey
        panel = NSPanel(contentRect: NSRect(origin: .zero, size: size), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false; panel.backgroundColor = .clear; panel.hasShadow = false
        // on the desktop, under your windows, like a real widget
        panel.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) + 1)
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        panel.hidesOnDeactivate = false; panel.isReleasedWhenClosed = false

        let bounds = NSRect(origin: .zero, size: size)
        let drag = DragView(frame: bounds)
        let glass = NSVisualEffectView(frame: bounds)
        glass.material = .hudWindow; glass.blendingMode = .behindWindow; glass.state = .active
        glass.appearance = NSAppearance(named: .darkAqua)
        glass.maskImage = WidgetPanel.roundedMask(radius: WidgetGrid.radius)
        let host = NSHostingView(rootView: view)
        host.frame = bounds
        glass.addSubview(host)
        drag.addSubview(glass)
        panel.contentView = drag
        drag.onDrop = { [weak self] in self?.snap(animate: true) }

        if let s = d.string(forKey: originKey) { panel.setFrameOrigin(NSPointFromString(s)) }
        else if let scr = NSScreen.screens.first { panel.setFrameOrigin(defaultOrigin(scr.frame)) }
        snap(animate: false)
        if enabled { panel.orderFrontRegardless() }
    }

    var onClick: (() -> Void)? {
        get { (panel.contentView as? DragView)?.onClick }
        set { (panel.contentView as? DragView)?.onClick = newValue }
    }

    func setEnabled(_ on: Bool) {
        d.set(on, forKey: shownKey)
        if on { panel.orderFrontRegardless() } else { panel.orderOut(nil) }
    }

    /// line up with the nearest spot on the macOS widget grid (kept on screen)
    func snap(animate: Bool) {
        let f = panel.frame, G = WidgetGrid.self
        guard let scr = NSScreen.screens.first(where: { $0.frame.intersects(f) }) ?? NSScreen.screens.first else { return }
        let sf = scr.frame
        let maxCol = max(0, ((sf.width - 2 * G.margin - f.width) / G.colPitch).rounded(.down))
        let maxRow = max(0, ((sf.height - G.rowTop - f.height - G.margin) / G.rowPitch).rounded(.down))
        let col = min(max(0, ((f.minX - sf.minX - G.margin) / G.colPitch).rounded()), maxCol)
        let row = min(max(0, ((sf.maxY - f.maxY - G.rowTop) / G.rowPitch).rounded()), maxRow)
        let top = sf.maxY - G.rowTop - row * G.rowPitch
        let target = NSPoint(x: (sf.minX + G.margin + col * G.colPitch).rounded(), y: (top - f.height).rounded())
        d.set(NSStringFromPoint(target), forKey: originKey)
        guard target != f.origin else { return }
        panel.setFrame(NSRect(origin: target, size: f.size), display: true, animate: animate)
    }

    static func roundedMask(radius r: CGFloat) -> NSImage {
        let side = r * 2 + 1
        let img = NSImage(size: NSSize(width: side, height: side), flipped: false) { rect in
            NSColor.black.setFill()
            NSBezierPath(roundedRect: rect, xRadius: r, yRadius: r).fill()
            return true
        }
        img.capInsets = NSEdgeInsets(top: r, left: r, bottom: r, right: r)
        img.resizingMode = .stretch
        return img
    }
}

// MARK: - Both widgets

final class DesktopWidget {
    let model = WidgetModel()
    var stats: WidgetPanel!, face: WidgetPanel!
    private var portraitKey = ""

    init(onClick: @escaping () -> Void) {
        let G = WidgetGrid.self
        stats = WidgetPanel(StatsCard(model: model), size: G.medium, originKey: "widgetOrigin", shownKey: "showWidget") { sf in
            NSPoint(x: sf.maxX - G.medium.width - 2 * G.margin - G.small.width, y: sf.maxY - G.rowTop - G.medium.height)
        }
        let s = stats.panel.frame
        face = WidgetPanel(PortraitCard(model: model), size: G.small, originKey: "portraitOrigin", shownKey: "showPortraitWidget") { _ in
            NSPoint(x: s.maxX + G.margin, y: s.maxY - G.small.height)   // next to the stats widget
        }
        stats.onClick = onClick; face.onClick = onClick
    }

    func update(_ i: PetInfo?, emotion: String) {
        model.info = i
        guard let i, !i.egg else { return }
        let key = "\(i.main.folder)-\(i.main.shiny)-\(emotion)"
        guard key != portraitKey else { return }
        portraitKey = key
        Task { @MainActor in
            if let p = await Portraits.image(i.main, emotion), key == self.portraitKey { self.model.portrait = p }
        }
    }
}

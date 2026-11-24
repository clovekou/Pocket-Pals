// Desktop widget — a minimal glass card on the desktop, in the style of macOS's Batteries widget:
// your main Pokémon (ring = overall wellbeing, label = level) and four rings for Food, Happy, Energy, Clean.

import Cocoa
import SwiftUI

final class WidgetModel: ObservableObject {
    @Published var info: PetInfo?
    @Published var portrait: NSImage?
}

struct Ring: View {
    var value: Double?            // 0…1, nil = empty slot
    var marker: String? = nil     // SF Symbol sitting in a gap at the top (like the charging bolt)
    var size: CGFloat = 60
    var line: CGFloat = 6
    let gap: Double = 0.07

    var color: Color {
        guard let v = value else { return .clear }
        return v < 0.2 ? Color(red: 1, green: 0.27, blue: 0.23) : Color.white.opacity(0.86)
    }

    var body: some View {
        let start = marker == nil ? 0 : gap / 2
        let end = marker == nil ? 1 : 1 - gap / 2
        ZStack {
            Circle().trim(from: start, to: end)
                .stroke(Color.white.opacity(0.13), style: StrokeStyle(lineWidth: line, lineCap: .round))
            if let v = value {
                Circle().trim(from: start, to: start + (end - start) * max(0.005, min(1, v)))
                    .stroke(color, style: StrokeStyle(lineWidth: line, lineCap: .round))
                    .animation(.easeInOut(duration: 0.6), value: v)
            }
        }
        .rotationEffect(.degrees(-90))
        .frame(width: size, height: size)
        .overlay(alignment: .top) {
            if let m = marker {
                Image(systemName: m)
                    .font(.system(size: line * 1.5, weight: .bold))
                    .foregroundColor(.white.opacity(0.86))
                    .offset(y: -line * 0.75)
            }
        }
    }
}

struct Slot<Icon: View>: View {
    var value: Double?
    var label: String
    var marker: String? = nil
    var help: String
    @ViewBuilder var icon: () -> Icon

    var body: some View {
        VStack(spacing: 12) {
            Ring(value: value, marker: marker).overlay(icon())
            Text(label)
                .font(.system(size: 15, weight: .medium))
                .monospacedDigit()
                .foregroundColor(.white.opacity(value == nil ? 0 : 0.78))
        }
        .help(help)
    }
}

struct WidgetCard: View {
    @ObservedObject var model: WidgetModel

    func pct(_ v: Int) -> Double { Double(v) / 100 }

    var body: some View {
        let i = model.info
        let live = i != nil && !(i?.egg ?? false)
        let avg = i.map { Double($0.food + $0.joy + $0.ene + $0.hyg) / 400 }
        HStack(spacing: 18) {
            Slot(value: i == nil ? nil : (i!.egg ? 1 : avg),
                 label: i == nil ? "–" : (i!.egg ? "Egg" : "Lv \(i!.level)"),
                 marker: (i?.asleep ?? false) ? "moon.fill" : nil,
                 help: i.map { $0.egg ? "Your egg" : "\($0.main.name)\($0.mood.isEmpty ? "" : " · " + $0.mood)" } ?? "Not connected") {
                if i?.egg ?? false {
                    Ellipse().fill(Color.white.opacity(0.8)).frame(width: 20, height: 26)
                } else if let p = model.portrait {
                    Image(nsImage: p).interpolation(.none).resizable()
                        .frame(width: 40, height: 40).clipShape(Circle())
                        .opacity((i?.asleep ?? false) ? 0.6 : 1)
                }
            }
            Slot(value: live ? pct(i!.food) : nil, label: live ? "\(i!.food)%" : "", help: "Food") { symbol("fork.knife", live) }
            Slot(value: live ? pct(i!.joy) : nil, label: live ? "\(i!.joy)%" : "", help: "Happy") { symbol("heart.fill", live) }
            Slot(value: live ? pct(i!.ene) : nil, label: live ? "\(i!.ene)%" : "", help: "Energy") { symbol("bolt.fill", live) }
            Slot(value: live ? pct(i!.hyg) : nil, label: live ? "\(i!.hyg)%" : "", help: "Clean") { symbol("sparkles", live) }
        }
        .padding(.horizontal, 22)
        .padding(.top, 22)
        .padding(.bottom, 18)
        .fixedSize()
    }

    func symbol(_ name: String, _ on: Bool) -> some View {
        Image(systemName: name)
            .font(.system(size: 20, weight: .semibold))
            .foregroundColor(.white.opacity(on ? 0.75 : 0))
    }
}

final class DesktopWidget {
    let model = WidgetModel()
    let panel: NSPanel
    private var portraitKey = ""
    private let d = UserDefaults.standard
    var enabled: Bool { d.object(forKey: "showWidget") as? Bool ?? true }

    init() {
        let host = NSHostingView(rootView: WidgetCard(model: model))
        let size = host.fittingSize
        panel = NSPanel(contentRect: NSRect(origin: .zero, size: size), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false; panel.backgroundColor = .clear; panel.hasShadow = true
        // on the desktop, under your windows, like a real widget
        panel.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) + 1)
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        panel.hidesOnDeactivate = false; panel.isReleasedWhenClosed = false
        panel.isMovableByWindowBackground = true

        let glass = NSVisualEffectView(frame: NSRect(origin: .zero, size: size))
        glass.material = .hudWindow; glass.blendingMode = .behindWindow; glass.state = .active
        glass.appearance = NSAppearance(named: .darkAqua)
        glass.maskImage = DesktopWidget.roundedMask(radius: 24)
        glass.autoresizingMask = [.width, .height]
        host.frame = glass.bounds; host.autoresizingMask = [.width, .height]
        glass.addSubview(host)
        panel.contentView = glass

        if let s = d.string(forKey: "widgetOrigin") { panel.setFrameOrigin(NSPointFromString(s)) }
        else if let scr = NSScreen.screens.first {
            let v = scr.visibleFrame
            panel.setFrameOrigin(NSPoint(x: v.maxX - size.width - 24, y: v.maxY - size.height - 24))
        }
        NotificationCenter.default.addObserver(forName: NSWindow.didMoveNotification, object: panel, queue: .main) { [weak self] _ in
            guard let self else { return }
            self.d.set(NSStringFromPoint(self.panel.frame.origin), forKey: "widgetOrigin")
        }
        if enabled { panel.orderFrontRegardless() }
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

    func setEnabled(_ on: Bool) {
        d.set(on, forKey: "showWidget")
        if on { panel.orderFrontRegardless() } else { panel.orderOut(nil) }
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

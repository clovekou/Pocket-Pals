// Pocket Pals Dock — your Pocket Pals Pokémon walking around your Mac's desktop.
// It floats above every window, on every desktop Space and over full-screen apps,
// and syncs with your Pocket Pals account through your widget key.

import Cocoa
import ImageIO
import ServiceManagement

let REPO = "https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/"
let SPRITES = REPO + "sprite/"
let GAME_URL = URL(string: "https://clovekou.github.io/Pocket-Pals/")!
let PROJECT = "pocket-pals-78f47"

// MARK: - Account data (the public widget card the game publishes for your key)

struct Member: Equatable {
    var sp: Int; var shiny: Bool; var name: String
    var path = ""   // SpriteCollab folder ("0037" or, for regional forms, "0037/0001")
    var folder: String { path.isEmpty ? String(format: "%04d", sp) : path }
    var shinyFolder: String { path.contains("/") ? path + "/0001" : folder + "/0000/0001" }
}

struct PetInfo {
    var main: Member
    var egg = false, asleep = false
    var level = 0, food = 0, joy = 0, ene = 0, hyg = 0
    var mood = "", trainer = ""
    var party: [Member] = []
    var updated: Double = 0
}

enum SyncError: LocalizedError {
    case notFound, denied, http(Int), bad
    var errorDescription: String? {
        switch self {
        case .notFound: return "Key not found. In the game, open Options → Home-screen widget once while signed in."
        case .denied: return "Firebase refused access. Publish the latest firestore.rules."
        case .http(let c): return "Sync failed (error \(c))."
        case .bad: return "Couldn't read your Pokémon from the account."
        }
    }
}

func fsValue(_ v: Any?) -> Any? {
    guard let d = v as? [String: Any] else { return nil }
    if let s = d["stringValue"] as? String { return s }
    if let s = d["integerValue"] as? String { return Double(s) ?? 0 }
    if let n = d["integerValue"] as? NSNumber { return n.doubleValue }
    if let n = d["doubleValue"] as? NSNumber { return n.doubleValue }
    if let b = d["booleanValue"] as? Bool { return b }
    if let a = d["arrayValue"] as? [String: Any] { return ((a["values"] as? [Any]) ?? []).map { fsValue($0) as Any } }
    if let m = d["mapValue"] as? [String: Any] {
        var o: [String: Any] = [:]
        for (k, x) in (m["fields"] as? [String: Any]) ?? [:] { o[k] = fsValue(x) }
        return o
    }
    return nil
}
func num(_ v: Any?) -> Int { if let d = v as? Double { return Int(d.rounded()) }; if let i = v as? Int { return i }; return 0 }

func fetchInfo(_ token: String) async throws -> PetInfo {
    let url = URL(string: "https://firestore.googleapis.com/v1/projects/\(PROJECT)/databases/(default)/documents/widgets/\(token)")!
    var req = URLRequest(url: url); req.cachePolicy = .reloadIgnoringLocalCacheData; req.timeoutInterval = 20
    let (data, resp) = try await URLSession.shared.data(for: req)
    let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
    if code == 404 { throw SyncError.notFound }
    if code == 403 { throw SyncError.denied }
    if code != 200 { throw SyncError.http(code) }
    guard let j = try JSONSerialization.jsonObject(with: data) as? [String: Any], let fields = j["fields"] as? [String: Any] else { throw SyncError.bad }
    var f: [String: Any] = [:]
    for (k, v) in fields { f[k] = fsValue(v) }
    let sp = num(f["sp"]); guard sp > 0 else { throw SyncError.bad }
    var i = PetInfo(main: Member(sp: sp, shiny: f["shiny"] as? Bool ?? false, name: f["name"] as? String ?? "Pokémon", path: f["path"] as? String ?? ""))
    i.egg = f["egg"] as? Bool ?? false; i.asleep = f["asleep"] as? Bool ?? false
    i.level = num(f["level"]); i.food = num(f["food"]); i.joy = num(f["joy"]); i.ene = num(f["ene"]); i.hyg = num(f["hyg"])
    i.mood = f["mood"] as? String ?? ""; i.trainer = f["trainer"] as? String ?? ""
    i.updated = f["updated"] as? Double ?? 0
    i.party = ((f["party"] as? [Any]) ?? []).compactMap { x in
        guard let m = x as? [String: Any], num(m["sp"]) > 0 else { return nil }
        return Member(sp: num(m["sp"]), shiny: m["shiny"] as? Bool ?? false, name: m["name"] as? String ?? "Pokémon", path: m["path"] as? String ?? "")
    }
    return i
}

// MARK: - Sprites (PMD SpriteCollab sheets, cached on disk)

struct Anim {
    let frames: [[CGImage]]   // [direction row][frame]
    let durs: [Int]           // 1/60 s per frame
    let total: Int
    let w: Int, h: Int
    let footPad: Int          // transparent rows under the feet
    let topPad: Int           // transparent rows above the head
    func frame(row: Int, at t: Double) -> CGImage {
        let r = frames[min(max(row, 0), frames.count - 1)]
        var tick = Int(t * 60) % max(total, 1)
        for (i, d) in durs.enumerated() { if tick < d { return r[min(i, r.count - 1)] }; tick -= d }
        return r[0]
    }
}

func topPad(_ img: CGImage) -> Int {
    let w = img.width, h = img.height
    guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                              space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return 0 }
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    guard let p = ctx.data?.assumingMemoryBound(to: UInt8.self) else { return 0 }
    for y in 0..<h {
        for x in 0..<w where p[(y * w + x) * 4 + 3] > 20 { return y }
    }
    return 0
}

func footPad(_ img: CGImage) -> Int {
    let w = img.width, h = img.height
    guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                              space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return 0 }
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    guard let p = ctx.data?.assumingMemoryBound(to: UInt8.self) else { return 0 }
    for y in stride(from: h - 1, through: 0, by: -1) {
        for x in 0..<w where p[(y * w + x) * 4 + 3] > 20 { return h - 1 - y }
    }
    return 0
}

enum Loader {
    static let cacheDir: URL = {
        let u = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("PocketPalsDock", isDirectory: true)
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }()
    static func data(_ path: String, root: String = SPRITES) async -> Data? {
        let file = cacheDir.appendingPathComponent(path.replacingOccurrences(of: "/", with: "_"))
        if let d = try? Data(contentsOf: file) { return d }
        guard let url = URL(string: root + path),
              let (d, r) = try? await URLSession.shared.data(from: url),
              (r as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        try? d.write(to: file)
        return d
    }
    static func load(_ m: Member) async -> [String: Anim]? {
        if m.shiny, let a = await loadFrom(m.shinyFolder + "/") { return a }
        return await loadFrom(m.folder + "/")
    }
    static func loadFrom(_ base: String) async -> [String: Anim]? {
        guard let xml = await data(base + "AnimData.xml"), let doc = try? XMLDocument(data: xml, options: []) else { return nil }
        var info: [String: (copy: String?, w: Int, h: Int, durs: [Int])] = [:]
        for case let e as XMLElement in (try? doc.nodes(forXPath: "//Anim")) ?? [] {
            guard let name = e.elements(forName: "Name").first?.stringValue else { continue }
            let int = { (k: String) in Int(e.elements(forName: k).first?.stringValue ?? "") ?? 0 }
            let durs = e.elements(forName: "Durations").first?.elements(forName: "Duration").compactMap { Int($0.stringValue ?? "") } ?? []
            info[name] = (e.elements(forName: "CopyOf").first?.stringValue, int("FrameWidth"), int("FrameHeight"), durs)
        }
        var out: [String: Anim] = [:]
        for want in ["Walk", "Idle", "Sleep"] {
            var name = want, hops = 0
            while let c = info[name]?.copy, hops < 4 { name = c; hops += 1 }
            guard let i = info[name], i.w > 0, i.h > 0, !i.durs.isEmpty,
                  let png = await data(base + name + "-Anim.png"),
                  let src = CGImageSourceCreateWithData(png as CFData, nil),
                  let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { continue }
            let rows = img.height / i.h, cols = img.width / i.w
            var frames: [[CGImage]] = []
            for r in 0..<rows {
                var row: [CGImage] = []
                for c in 0..<min(cols, i.durs.count) {
                    if let f = img.cropping(to: CGRect(x: c * i.w, y: r * i.h, width: i.w, height: i.h)) { row.append(f) }
                }
                if !row.isEmpty { frames.append(row) }
            }
            guard !frames.isEmpty else { continue }
            out[want] = Anim(frames: frames, durs: i.durs, total: i.durs.reduce(0, +), w: i.w, h: i.h, footPad: footPad(frames[0][0]), topPad: topPad(frames[0][0]))
        }
        guard out["Walk"] != nil else { return nil }
        if out["Idle"] == nil { out["Idle"] = out["Walk"] }
        if out["Sleep"] == nil { out["Sleep"] = out["Idle"] }
        return out
    }
}

// MARK: - Floating windows

func makePanel(_ rect: NSRect) -> NSPanel {
    let p = NSPanel(contentRect: rect, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
    p.isOpaque = false; p.backgroundColor = .clear; p.hasShadow = false
    p.level = .statusBar                    // above normal and full-screen app windows
    p.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
    p.hidesOnDeactivate = false; p.becomesKeyOnlyIfNeeded = true; p.isReleasedWhenClosed = false
    return p
}

final class PetView: NSView {
    weak var pet: Pet?
    var image: CGImage?
    var footPad: CGFloat = 0, scale: CGFloat = 2
    var egg = false, eggShiny = false, wobble: CGFloat = 0
    var zzz = false, phase: Double = 0
    override var isOpaque: Bool { false }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func draw(_ dirtyRect: NSRect) {
        guard let ctx = NSGraphicsContext.current?.cgContext else { return }
        ctx.clear(bounds)
        ctx.interpolationQuality = .none
        let airborne = CGFloat(pet?.y ?? 0)
        // soft ground shadow (shrinks while hopping)
        let sw = bounds.width * 0.42 * max(0.5, 1 - airborne / 160)
        ctx.setFillColor(NSColor.black.withAlphaComponent(0.2).cgColor)
        ctx.fillEllipse(in: CGRect(x: bounds.midX - sw / 2, y: 2, width: sw, height: max(4, 3 * scale)))
        if egg { drawEgg(ctx); return }
        guard let img = image else { return }
        let w = CGFloat(img.width) * scale, h = CGFloat(img.height) * scale
        ctx.draw(img, in: CGRect(x: (bounds.width - w) / 2, y: 4 - footPad * scale, width: w, height: h))
        if zzz {
            let t = phase.truncatingRemainder(dividingBy: 2.4) / 2.4
            for (i, size) in [11.0, 14.0, 17.0].enumerated() {
                let k = (t + Double(i) / 3).truncatingRemainder(dividingBy: 1)
                let a = NSAttributedString(string: "z", attributes: [
                    .font: NSFont.systemFont(ofSize: size * Double(scale) / 2, weight: .heavy),
                    .foregroundColor: NSColor.white.withAlphaComponent(1 - k),
                    .strokeColor: NSColor(calibratedRed: 0.18, green: 0.2, blue: 0.3, alpha: 1 - k), .strokeWidth: -3,
                ])
                a.draw(at: NSPoint(x: bounds.midX + w * 0.18 + CGFloat(k) * 14, y: bounds.height * 0.55 + CGFloat(k) * bounds.height * 0.35))
            }
        }
    }
    func drawEgg(_ ctx: CGContext) {
        let ew = 22 * scale, eh = 28 * scale
        ctx.saveGState()
        ctx.translateBy(x: bounds.midX, y: 4)
        ctx.rotate(by: wobble)
        let r = CGRect(x: -ew / 2, y: 0, width: ew, height: eh)
        ctx.setFillColor((eggShiny ? NSColor(calibratedRed: 0.9, green: 0.95, blue: 1, alpha: 1) : NSColor(calibratedRed: 0.98, green: 0.96, blue: 0.9, alpha: 1)).cgColor)
        ctx.fillEllipse(in: r)
        ctx.setFillColor((eggShiny ? NSColor(calibratedRed: 0.31, green: 0.58, blue: 0.77, alpha: 1) : NSColor(calibratedRed: 0.44, green: 0.75, blue: 0.45, alpha: 1)).cgColor)
        for (x, y, s) in [(-0.22, 0.55, 0.22), (0.18, 0.7, 0.18), (0.12, 0.3, 0.24), (-0.18, 0.2, 0.14)] as [(CGFloat, CGFloat, CGFloat)] {
            ctx.fillEllipse(in: CGRect(x: x * ew - s * ew / 2, y: y * eh - s * ew / 2, width: s * ew, height: s * ew))
        }
        ctx.setStrokeColor(NSColor(calibratedRed: 0.18, green: 0.2, blue: 0.28, alpha: 1).cgColor)
        ctx.setLineWidth(max(2, scale)); ctx.strokeEllipse(in: r)
        ctx.restoreGState()
    }

    override func mouseDown(with e: NSEvent) { pet?.mouseDown() }
    override func mouseDragged(with e: NSEvent) { pet?.mouseDragged() }
    override func mouseUp(with e: NSEvent) { pet?.mouseUp() }
}

struct Env { var ground: CGFloat; var minX: CGFloat; var maxX: CGFloat; var sleeping: Bool; var scale: CGFloat }

final class Pet {
    let member: Member, isMain: Bool, egg: Bool
    var anims: [String: Anim]?
    let panel: NSPanel
    let view = PetView()
    var x: CGFloat, y: CGFloat = 0, vy: CGFloat = 0
    var dir: CGFloat = Bool.random() ? 1 : -1
    var walking = false, until: Double = 0, target: CGFloat = 0
    var animName = "Idle", animT: Double = 0
    var dragging = false, dragOffset = NSPoint.zero, ground: CGFloat = 0
    var onEvent: ((Pet, String) -> Void)?   // "click", "grab", "drop"
    // top of the sprite's head, in screen coordinates
    var headY: CGFloat {
        guard let a = anims?["Idle"] else { return panel.frame.maxY }
        return panel.frame.minY + 4 + CGFloat(a.h - a.footPad - a.topPad) * view.scale
    }
    var size = NSSize(width: 80, height: 80)

    init(member: Member, isMain: Bool, egg: Bool, x: CGFloat, scale: CGFloat) {
        self.member = member; self.isMain = isMain; self.egg = egg; self.x = x
        panel = makePanel(NSRect(x: x, y: 0, width: 80, height: 80))
        view.pet = self; view.egg = egg; view.eggShiny = member.shiny
        panel.contentView = view
        until = CACurrentMediaTime() + Double.random(in: 0.5...4)
        resize(scale)
        if egg { panel.orderFrontRegardless() }
        else {
            Task { @MainActor in
                if let a = await Loader.load(member) { self.anims = a; self.resize(self.view.scale); self.panel.orderFrontRegardless() }
            }
        }
    }
    func resize(_ scale: CGFloat) {
        view.scale = scale
        var w: CGFloat = 26, h: CGFloat = 30
        if let a = anims { for v in a.values { w = max(w, CGFloat(v.w)); h = max(h, CGFloat(v.h - v.footPad)) } }
        size = NSSize(width: w * scale, height: h * scale + 8)
        panel.setContentSize(size)
        view.frame = NSRect(origin: .zero, size: size)
    }
    func close() { panel.orderOut(nil); panel.close() }

    func setAnim(_ n: String) { if n != animName { animName = n; animT = 0 } }

    func tick(_ dt: Double, _ now: Double, _ env: Env) {
        if ground != 0 && env.ground != ground && !dragging { y = max(0, y + ground - env.ground) }
        ground = env.ground
        view.phase = now
        if dragging { view.needsDisplay = true; return }
        // gravity (after a hop or after being dropped)
        if y > 0 || vy > 0 { vy -= 1500 * CGFloat(dt); y += vy * CGFloat(dt); if y <= 0 { y = 0; vy = 0 } }

        if egg {
            let k = now.truncatingRemainder(dividingBy: 4)
            view.wobble = k < 0.8 ? CGFloat(sin(k * 16) * 0.12 * (1 - k / 0.8)) : 0
        } else if env.sleeping {
            setAnim("Sleep"); view.zzz = true; walking = false
        } else {
            view.zzz = false
            if walking {
                let dx = target - x
                if abs(dx) < 2 { walking = false; until = now + Double.random(in: 2...7) }
                else { dir = dx > 0 ? 1 : -1; x += dir * min(abs(dx), 30 * env.scale * CGFloat(dt)) }
                setAnim(walking ? "Walk" : "Idle")
            } else {
                setAnim("Idle")
                if now > until {
                    let lo = env.minX + size.width / 2, hi = env.maxX - size.width / 2
                    let span = min(450, (hi - lo) * 0.8)
                    var t = x + CGFloat.random(in: -span...span)
                    if abs(t - x) < min(80, span / 3) { t = x + (x > (lo + hi) / 2 ? -1 : 1) * min(220, span / 2) }
                    target = min(max(t, lo), hi); walking = true
                }
            }
        }
        x = min(max(x, env.minX + size.width / 2), env.maxX - size.width / 2)
        animT += dt

        if let a = anims?[animName] {
            let row: Int
            switch animName {
            case "Walk": row = dir > 0 ? 2 : 6
            case "Idle": row = a.frames.count >= 8 ? (dir > 0 ? 1 : 7) : 0
            default: row = 0
            }
            view.image = a.frame(row: row, at: animT)
            view.footPad = CGFloat(a.footPad)
        }
        let origin = NSPoint(x: (x - size.width / 2).rounded(), y: (env.ground + y).rounded())
        if panel.frame.origin != origin { panel.setFrameOrigin(origin) }
        view.needsDisplay = true
    }

    // drag to pick it up, click to make it hop and say hi
    private var downAt = NSPoint.zero, moved = false
    func mouseDown() { downAt = NSEvent.mouseLocation; moved = false; dragOffset = NSPoint(x: downAt.x - panel.frame.minX, y: downAt.y - panel.frame.minY) }
    func mouseDragged() {
        let m = NSEvent.mouseLocation
        if !moved && hypot(m.x - downAt.x, m.y - downAt.y) < 4 { return }
        if !dragging { onEvent?(self, "grab") }
        moved = true; dragging = true
        panel.setFrameOrigin(NSPoint(x: m.x - dragOffset.x, y: m.y - dragOffset.y))
        x = panel.frame.midX; y = max(0, panel.frame.minY - ground)
    }
    func mouseUp() {
        if dragging { dragging = false; vy = 0; walking = false; until = CACurrentMediaTime() + 2; onEvent?(self, "drop"); return }
        if y == 0 { vy = 420 }
        onEvent?(self, "click")
    }
}

// Mystery-Dungeon portraits (40×40, one per emotion), cached on disk and in memory
enum Portraits {
    static var cache: [String: NSImage] = [:], missing: Set<String> = []
    @MainActor static func image(_ m: Member, _ emo: String) async -> NSImage? {
        let base = "portrait/" + m.folder + "/"
        for root in (m.shiny ? ["portrait/" + m.shinyFolder + "/", base] : [base]) {
            for e in [emo, "Normal"] {
                let path = root + e + ".png"
                if let i = cache[path] { return i }
                if missing.contains(path) { continue }
                if let d = await Loader.data(path, root: REPO), let i = NSImage(data: d) { cache[path] = i; return i }
                missing.insert(path)
            }
        }
        return nil
    }
}

// a little framed portrait that pops up over your Pokémon's head for a moment
final class PortraitPop {
    let panel = makePanel(.zero)
    let box = NSView(), img = NSImageView()
    weak var pet: Pet?
    var shownAt: Double = 0, until: Double = 0, token = 0
    var enabled: Bool { UserDefaults.standard.object(forKey: "showPortrait") as? Bool ?? true }
    init() {
        box.wantsLayer = true
        box.layer?.backgroundColor = NSColor(calibratedRed: 0.99, green: 0.98, blue: 0.94, alpha: 1).cgColor
        box.layer?.cornerRadius = 10
        box.layer?.borderWidth = 2.5
        box.layer?.borderColor = NSColor(calibratedRed: 0.18, green: 0.2, blue: 0.28, alpha: 1).cgColor
        box.layer?.masksToBounds = true
        img.imageScaling = .scaleProportionallyUpOrDown
        img.wantsLayer = true; img.layer?.magnificationFilter = .nearest
        box.addSubview(img)
        panel.contentView = box
        panel.ignoresMouseEvents = true
    }
    func show(_ emo: String, on p: Pet, scale: CGFloat) {
        guard enabled, !p.egg else { return }
        token += 1; let mine = token
        Task { @MainActor in
            guard let im = await Portraits.image(p.member, emo), mine == self.token else { return }
            let inner = max(36, (20 * scale).rounded()), side = inner + 8
            self.panel.setContentSize(NSSize(width: side, height: side))
            self.box.frame = NSRect(x: 0, y: 0, width: side, height: side)
            self.img.frame = NSRect(x: 4, y: 4, width: inner, height: inner)
            self.img.image = im
            self.pet = p; self.shownAt = CACurrentMediaTime(); self.until = self.shownAt + 2.6
            self.panel.alphaValue = 0
            self.update(self.shownAt)
            self.panel.orderFrontRegardless()
        }
    }
    func hide() { token += 1; pet = nil; panel.orderOut(nil) }
    // follow the Pokémon, fade/rise in, fade out
    func update(_ now: Double) {
        guard let p = pet else { return }
        if now > until { hide(); return }
        let tIn = min(1, (now - shownAt) / 0.18), tOut = min(1, (until - now) / 0.3)
        panel.alphaValue = CGFloat(max(0, min(tIn, tOut)))
        let size = panel.frame.size
        var x = p.panel.frame.midX - size.width / 2
        if let scr = NSScreen.screens.first { x = min(max(x, scr.frame.minX + 4), scr.frame.maxX - size.width - 4) }
        let y = p.headY + 6 - CGFloat(1 - tIn) * 8
        panel.setFrameOrigin(NSPoint(x: x.rounded(), y: y.rounded()))
    }
}

// MARK: - App

func pokeballIcon() -> NSImage {
    let img = NSImage(size: NSSize(width: 18, height: 18), flipped: false) { r in
        let c = NSRect(x: 2, y: 2, width: 14, height: 14)
        NSColor.black.setStroke()
        let o = NSBezierPath(ovalIn: c); o.lineWidth = 1.6; o.stroke()
        let top = NSBezierPath(); top.appendArc(withCenter: NSPoint(x: 9, y: 9), radius: 7, startAngle: 0, endAngle: 180); top.close()
        NSColor.black.setFill(); top.fill()
        let line = NSBezierPath(); line.move(to: NSPoint(x: 2, y: 9)); line.line(to: NSPoint(x: 16, y: 9)); line.lineWidth = 1.6; line.stroke()
        NSColor.black.setFill(); NSBezierPath(ovalIn: NSRect(x: 6, y: 6, width: 6, height: 6)).fill()
        NSGraphicsContext.current?.compositingOperation = .clear
        NSBezierPath(ovalIn: NSRect(x: 7.6, y: 7.6, width: 2.8, height: 2.8)).fill()
        return true
    }
    img.isTemplate = true
    return img
}

final class App: NSObject, NSApplicationDelegate, NSMenuDelegate {
    var status: NSStatusItem!
    var pets: [Pet] = []
    var petSig = ""
    var info: PetInfo?
    var lastError: String?
    var lastSync: Date?
    let portrait = PortraitPop()
    var widget: DesktopWidget!
    var nextPop = CACurrentMediaTime() + Double.random(in: 8...20)
    var last = CACurrentMediaTime()
    let d = UserDefaults.standard

    var token: String { get { d.string(forKey: "token") ?? "" } set { d.set(newValue, forKey: "token") } }
    var scale: CGFloat { CGFloat(d.object(forKey: "scale") as? Double ?? 3) }
    var clickThrough: Bool { d.bool(forKey: "clickThrough") }
    var onDock: Bool { d.object(forKey: "onDock") as? Bool ?? true }
    var position: String { d.string(forKey: "position") ?? "walk" }
    /// off = it keeps walking and playing on your Mac even while it's asleep in the game
    var followSleep: Bool { d.object(forKey: "followSleep") as? Bool ?? true }
    var petAsleep: Bool { followSleep && (info?.asleep ?? false) }

    func applicationDidFinishLaunching(_ n: Notification) {
        NSApp.setActivationPolicy(.accessory)
        buildMainMenu()
        status = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        status.button?.image = pokeballIcon()
        status.button?.toolTip = "Pocket Pals Dock"
        let menu = NSMenu(); menu.delegate = self; status.menu = menu
        widget = DesktopWidget()

        let anim = Timer(timeInterval: 1.0 / 30, repeats: true) { [weak self] _ in self?.tick() }
        RunLoop.main.add(anim, forMode: .common)
        let syncTimer = Timer(timeInterval: 10, repeats: true) { [weak self] _ in self?.sync() }
        RunLoop.main.add(syncTimer, forMode: .common)
        NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { [weak self] _ in self?.sync() }

        if CommandLine.arguments.contains("--demo") {   // preview without an account
            var i = PetInfo(main: Member(sp: 778, shiny: false, name: "Mimikyu")); i.level = 24; i.mood = "Feeling great!"
            i.food = 92; i.joy = 100; i.ene = 64; i.hyg = 15
            info = i; apply(i); return
        }
        if token.isEmpty { DispatchQueue.main.async { self.askToken() } } else { sync() }
    }

    // an Edit menu so ⌘V works in the key box
    func buildMainMenu() {
        let main = NSMenu(), appItem = NSMenuItem(), editItem = NSMenuItem()
        main.addItem(appItem); main.addItem(editItem)
        let appMenu = NSMenu(); appMenu.addItem(withTitle: "Quit Pocket Pals Dock", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit
        NSApp.mainMenu = main
    }

    // Full screen: is a window filling the screen? (On Macs with a notch it starts just under the notch,
    // so it's "full width, reaching the bottom edge, starting near the top".) The Dock is hidden then.
    var fullScreen = false, fsCheckedAt: Double = 0
    func checkFullScreen(_ scr: NSScreen) {
        guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { fullScreen = false; return }
        let me = ProcessInfo.processInfo.processIdentifier, size = scr.frame.size
        fullScreen = list.contains { w in
            guard (w[kCGWindowOwnerPID as String] as? Int32) != me, (w[kCGWindowLayer as String] as? Int) == 0,
                  let b = w[kCGWindowBounds as String] as? [String: CGFloat] else { return false }
            let x = b["X"] ?? -1, y = b["Y"] ?? -1, wd = b["Width"] ?? 0, ht = b["Height"] ?? 0
            return abs(x) < 1 && abs(wd - size.width) < 1 && y >= 0 && y <= 60 && abs((y + ht) - size.height) < 1
        }
    }
    // In full screen the Dock slides up when the pointer touches the bottom edge, and hides again when it leaves.
    var dockPeek = false, edgeSince: Double = 0
    func updateDockPeek(_ scr: NSScreen, _ now: Double, dockH: CGFloat) {
        let m = NSEvent.mouseLocation
        guard fullScreen, dockH > 0, scr.frame.contains(NSPoint(x: m.x, y: max(m.y, scr.frame.minY))) else { dockPeek = false; edgeSince = 0; return }
        if m.y <= scr.frame.minY + 1.5 { if edgeSince == 0 { edgeSince = now }; if now - edgeSince > 0.25 { dockPeek = true } }
        else { edgeSince = 0; if m.y > scr.frame.minY + dockH + 12 { dockPeek = false } }
    }
    var groundNow: CGFloat?

    func tick() {
        let now = CACurrentMediaTime(), dt = min(0.1, now - last); last = now
        guard let scr = NSScreen.screens.first else { return }
        if now - fsCheckedAt > 0.4 { fsCheckedAt = now; checkFullScreen(scr) }
        let dockH = max(0, scr.visibleFrame.minY - scr.frame.minY)
        updateDockPeek(scr, now, dockH: dockH)
        let dockUp = !fullScreen || dockPeek
        let target = scr.frame.minY + (onDock && dockUp ? dockH : 0)
        // glide with the Dock as it slides up and down
        var g = groundNow ?? target
        g += (target - g) * min(1, CGFloat(dt) * 14); if abs(target - g) < 0.5 { g = target }
        groundNow = g
        var lo = scr.frame.minX, hi = scr.frame.maxX
        let zone = max(220, 90 * scale)
        if position == "right" { lo = hi - zone } else if position == "left" { hi = lo + zone }
        let env = Env(ground: g, minX: lo, maxX: hi, sleeping: petAsleep, scale: scale)
        for p in pets { p.tick(dt, now, env) }
        if now > nextPop {
            nextPop = now + Double.random(in: 30...75)
            if let p = pets.first, info != nil, !petAsleep, !p.dragging { portrait.show(moodEmotion(), on: p, scale: scale) }
        }
        portrait.update(now)
    }

    func sync() {
        let t = token; guard !t.isEmpty else { return }
        Task { @MainActor in
            do { let i = try await fetchInfo(t); self.lastError = nil; self.lastSync = Date(); self.apply(i) }
            catch { self.lastError = error.localizedDescription }
        }
    }

    func apply(_ i: PetInfo) {
        info = i
        widget.update(i, emotion: widgetEmotion())
        var want: [(Member, Bool, Bool)] = [(i.main, true, i.egg)]
        let sig = want.map { "\($0.0.sp)-\($0.0.shiny)-\($0.2)" }.joined(separator: ",")
        if sig == petSig { return }
        petSig = sig
        let oldX = pets.first?.x
        portrait.hide()
        pets.forEach { $0.close() }
        guard let scr = NSScreen.screens.first else { return }
        pets = want.enumerated().map { (k, w) in
            let x = k == 0 ? (oldX ?? scr.frame.midX) : CGFloat.random(in: scr.frame.minX + 120...scr.frame.maxX - 120)
            let p = Pet(member: w.0, isMain: w.1, egg: w.2, x: x, scale: scale)
            p.panel.ignoresMouseEvents = clickThrough
            p.onEvent = { [weak self] p, e in self?.react(p, e) }
            return p
        }
    }

    // the portrait's expression follows how your Pokémon is doing (same rules as the game's widget)
    func moodEmotion() -> String {
        guard let i = info else { return "Normal" }
        let low = min(i.food, i.joy, i.ene, i.hyg), avg = Double(i.food + i.joy + i.ene + i.hyg) / 4
        if low < 15 { return ["Crying", "Teary-Eyed", "Sad"].randomElement()! }
        if low < 30 { return i.ene == low ? "Sigh" : i.food == low ? "Worried" : "Sad" }
        if avg >= 85 { return ["Joyous", "Happy", "Inspired"].randomElement()! }
        if avg >= 65 { return ["Happy", "Happy", "Determined", "Normal"].randomElement()! }
        return "Normal"
    }

    // a steady (not random) expression for the widget's portrait
    func widgetEmotion() -> String {
        guard let i = info else { return "Normal" }
        let low = min(i.food, i.joy, i.ene, i.hyg), avg = Double(i.food + i.joy + i.ene + i.hyg) / 4
        if low < 15 { return "Sad" }
        if low < 30 { return i.ene == low ? "Sigh" : i.food == low ? "Worried" : "Sad" }
        return avg >= 65 ? "Happy" : "Normal"
    }

    func react(_ p: Pet, _ event: String) {
        guard let i = info, !petAsleep else { return }
        let low = min(i.food, i.joy, i.ene, i.hyg)
        switch event {
        case "grab": portrait.show("Surprised", on: p, scale: scale)
        case "drop": portrait.show("Dizzy", on: p, scale: scale)
        default: portrait.show(low < 30 ? moodEmotion() : ["Happy", "Joyous"].randomElement()!, on: p, scale: scale)
        }
        nextPop = max(nextPop, CACurrentMediaTime() + 20)
    }

    // MARK: menu
    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        func info(_ s: String, bold: Bool = false) {
            let it = NSMenuItem(title: s, action: nil, keyEquivalent: "")
            if bold { it.attributedTitle = NSAttributedString(string: s, attributes: [.font: NSFont.boldSystemFont(ofSize: 14)]) }
            it.isEnabled = false; menu.addItem(it)
        }
        if let i = self.info {
            info(i.egg ? "Your egg" : "\(i.main.name)  ·  Lv \(i.level)", bold: true)
            if !i.mood.isEmpty { info(i.mood) }
            if !i.egg { info("Food \(i.food)   Happy \(i.joy)   Energy \(i.ene)   Clean \(i.hyg)") }
            var foot = i.trainer.isEmpty ? "" : "Trainer \(i.trainer)"
            if i.updated > 0 {
                let m = Int((Date().timeIntervalSince1970 * 1000 - i.updated) / 60000)
                foot += (foot.isEmpty ? "" : "  ·  ") + (m < 1 ? "updated just now" : m < 60 ? "updated \(m) min ago" : m < 1440 ? "updated \(m / 60) h ago" : "updated \(m / 1440) d ago")
            }
            if !foot.isEmpty { info(foot) }
        } else if token.isEmpty {
            info("Not connected to an account", bold: true)
        } else {
            info("Loading your Pokémon…", bold: true)
        }
        if let e = lastError { info("⚠︎ " + e) }
        menu.addItem(.separator())


        let sizeItem = NSMenuItem(title: "Size", action: nil, keyEquivalent: ""), sizes = NSMenu()
        for (name, v) in [("Small", 1.5), ("Medium", 2.0), ("Large", 3.0), ("Huge", 4.0)] {
            let it = NSMenuItem(title: name, action: #selector(setSize(_:)), keyEquivalent: "")
            it.representedObject = v; it.target = self; it.state = abs(Double(scale) - v) < 0.01 ? .on : .off; sizes.addItem(it)
        }
        sizeItem.submenu = sizes; menu.addItem(sizeItem)

        let walkItem = NSMenuItem(title: "Walk on", action: nil, keyEquivalent: ""), walks = NSMenu()
        for (name, v) in [("Top of the Dock", true), ("Bottom of the screen", false)] {
            let it = NSMenuItem(title: name, action: #selector(setWalk(_:)), keyEquivalent: "")
            it.representedObject = v; it.target = self; it.state = onDock == v ? .on : .off; walks.addItem(it)
        }
        walkItem.submenu = walks; menu.addItem(walkItem)

        let posItem = NSMenuItem(title: "Position", action: nil, keyEquivalent: ""), poss = NSMenu()
        for (name, v) in [("Walk around the whole screen", "walk"), ("Stay in the right corner", "right"), ("Stay in the left corner", "left")] {
            let it = NSMenuItem(title: name, action: #selector(setPosition(_:)), keyEquivalent: "")
            it.representedObject = v; it.target = self; it.state = position == v ? .on : .off; poss.addItem(it)
        }
        posItem.submenu = poss; menu.addItem(posItem)

        let slItem = NSMenuItem(title: "When asleep in the game", action: nil, keyEquivalent: ""), sls = NSMenu()
        for (name, v) in [("Sleep on my Mac too", true), ("Keep doing its own thing", false)] {
            let it = NSMenuItem(title: name, action: #selector(setFollowSleep(_:)), keyEquivalent: "")
            it.representedObject = v; it.target = self; it.state = followSleep == v ? .on : .off; sls.addItem(it)
        }
        slItem.submenu = sls; menu.addItem(slItem)

        let sb = NSMenuItem(title: "Show portrait reactions", action: #selector(togglePortrait), keyEquivalent: "")
        sb.state = portrait.enabled ? .on : .off; sb.target = self; menu.addItem(sb)

        let wd = NSMenuItem(title: "Show desktop widget", action: #selector(toggleWidget), keyEquivalent: "")
        wd.state = widget.enabled ? .on : .off; wd.target = self; menu.addItem(wd)

        let ct = NSMenuItem(title: "Click-through (ignore the mouse)", action: #selector(toggleClickThrough), keyEquivalent: "")
        ct.state = clickThrough ? .on : .off; ct.target = self; menu.addItem(ct)

        let login = NSMenuItem(title: "Open at login", action: #selector(toggleLogin), keyEquivalent: "")
        login.state = SMAppService.mainApp.status == .enabled ? .on : .off; login.target = self; menu.addItem(login)
        menu.addItem(.separator())

        for (t, a, k) in [("Open Pocket Pals", #selector(openGame), "o"), ("Sync now", #selector(syncNow), "r"), ("Change account key…", #selector(changeKey), "")] as [(String, Selector, String)] {
            let it = NSMenuItem(title: t, action: a, keyEquivalent: k); it.target = self; menu.addItem(it)
        }
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Pocket Pals Dock", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    }

    @objc func setSize(_ s: NSMenuItem) { d.set(s.representedObject as? Double ?? 2, forKey: "scale"); pets.forEach { $0.resize(scale) } }
    @objc func setPosition(_ s: NSMenuItem) { d.set(s.representedObject as? String ?? "walk", forKey: "position") }
    @objc func setFollowSleep(_ s: NSMenuItem) { d.set(s.representedObject as? Bool ?? true, forKey: "followSleep"); if petAsleep { portrait.hide() } }
    @objc func setWalk(_ s: NSMenuItem) { d.set(s.representedObject as? Bool ?? true, forKey: "onDock") }
    @objc func togglePortrait() { d.set(!portrait.enabled, forKey: "showPortrait"); if !portrait.enabled { portrait.hide() } }
    @objc func toggleClickThrough() { d.set(!clickThrough, forKey: "clickThrough"); pets.forEach { $0.panel.ignoresMouseEvents = clickThrough } }
    @objc func toggleLogin() {
        do {
            if SMAppService.mainApp.status == .enabled { try SMAppService.mainApp.unregister() } else { try SMAppService.mainApp.register() }
        } catch {
            alert("Couldn't change Open at login", "Move Pocket Pals Dock into your Applications folder and try again.\n\n\(error.localizedDescription)")
        }
    }
    @objc func toggleWidget() { widget.setEnabled(!widget.enabled) }
    @objc func openGame() { NSWorkspace.shared.open(GAME_URL) }
    @objc func syncNow() { sync() }
    @objc func changeKey() { askToken() }

    func alert(_ title: String, _ text: String) {
        NSApp.activate(ignoringOtherApps: true)
        let a = NSAlert(); a.messageText = title; a.informativeText = text; a.runModal()
    }

    static func extractKey(_ s: String) -> String? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        if let r = t.range(of: #"TOKEN\s*=\s*"([a-z0-9]{20,})""#, options: .regularExpression) {
            return String(t[r]).components(separatedBy: "\"")[1]
        }
        return t.range(of: #"^[a-z0-9]{20,64}$"#, options: .regularExpression) != nil ? t : nil
    }

    func askToken() {
        NSApp.activate(ignoringOtherApps: true)
        let a = NSAlert()
        a.messageText = "Connect your Pocket Pals account"
        a.informativeText = "In the game (signed in), open Options → Home-screen widget and tap “Copy key for desktop app”. Then paste the key here."
        let f = NSTextField(frame: NSRect(x: 0, y: 0, width: 320, height: 24))
        f.placeholderString = "Paste your key here"
        if let clip = NSPasteboard.general.string(forType: .string), let k = App.extractKey(clip) { f.stringValue = k }
        a.accessoryView = f
        a.addButton(withTitle: "Connect"); a.addButton(withTitle: token.isEmpty ? "Not now" : "Cancel")
        a.window.initialFirstResponder = f
        guard a.runModal() == .alertFirstButtonReturn else { return }
        guard let k = App.extractKey(f.stringValue) else { alert("That doesn't look like a key", "Copy it again from the game: Options → Home-screen widget → Copy key for desktop app."); return }
        Task { @MainActor in
            do {
                let i = try await fetchInfo(k)
                self.token = k; self.lastError = nil; self.lastSync = Date(); self.petSig = ""; self.apply(i)
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { if let p = self.pets.first, !(self.followSleep && i.asleep) { self.portrait.show("Joyous", on: p, scale: self.scale) } }
            } catch { self.alert("Couldn't connect", error.localizedDescription) }
        }
    }
}

let app = NSApplication.shared
let delegate = App()
app.delegate = delegate
app.run()

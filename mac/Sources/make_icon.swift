// Draws the app icon (a Poké Ball on a blue rounded square) to the PNG path given.
import Cocoa
let size = 1024.0
let img = NSImage(size: NSSize(width: size, height: size), flipped: false) { _ in
    let bg = NSBezierPath(roundedRect: NSRect(x: 100, y: 100, width: 824, height: 824), xRadius: 190, yRadius: 190)
    NSGradient(starting: NSColor(calibratedRed: 0.26, green: 0.34, blue: 0.77, alpha: 1), ending: NSColor(calibratedRed: 0.11, green: 0.14, blue: 0.34, alpha: 1))!.draw(in: bg, angle: -90)
    let c = NSPoint(x: 512, y: 500), r = 290.0
    let top = NSBezierPath(); top.appendArc(withCenter: c, radius: r, startAngle: 0, endAngle: 180); top.close()
    NSColor(calibratedRed: 0.89, green: 0.21, blue: 0.05, alpha: 1).setFill(); top.fill()
    let bot = NSBezierPath(); bot.appendArc(withCenter: c, radius: r, startAngle: 180, endAngle: 360); bot.close()
    NSColor(calibratedRed: 0.98, green: 0.97, blue: 0.93, alpha: 1).setFill(); bot.fill()
    let ink = NSColor(calibratedRed: 0.18, green: 0.2, blue: 0.28, alpha: 1)
    ink.setStroke(); ink.setFill()
    let ring = NSBezierPath(ovalIn: NSRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)); ring.lineWidth = 34; ring.stroke()
    NSBezierPath(rect: NSRect(x: c.x - r, y: c.y - 20, width: r * 2, height: 40)).fill()
    NSBezierPath(ovalIn: NSRect(x: c.x - 95, y: c.y - 95, width: 190, height: 190)).fill()
    NSColor.white.setFill(); NSBezierPath(ovalIn: NSRect(x: c.x - 58, y: c.y - 58, width: 116, height: 116)).fill()
    // a small paw-print trail along the bottom, for "walking"
    NSColor.white.withAlphaComponent(0.85).setFill()
    for (i, x) in [230.0, 380.0, 640.0, 790.0].enumerated() { NSBezierPath(ovalIn: NSRect(x: x, y: i % 2 == 0 ? 150 : 168, width: 46, height: 38)).fill() }
    return true
}
let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))

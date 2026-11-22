// Draws the Pocket Pals app icon as 32×32 pixel art, scaled up crisply.
// usage: swift tools/make_icon.swift <size> <out.png> [maskable]
import Cocoa
let size = Int(CommandLine.arguments[1])!, out = CommandLine.arguments[2]
let maskable = CommandLine.arguments.count > 3
let N = 32
func hex(_ h: UInt32) -> NSColor { NSColor(calibratedRed: CGFloat((h >> 16) & 255) / 255, green: CGFloat((h >> 8) & 255) / 255, blue: CGFloat(h & 255) / 255, alpha: 1) }
var px = [[NSColor?]](repeating: [NSColor?](repeating: nil, count: N), count: N)   // [y][x], y = 0 at top
func set(_ x: Int, _ y: Int, _ c: NSColor) { if x >= 0 && x < N && y >= 0 && y < N { px[y][x] = c } }

// background: night-blue gradient with a few twinkles
for y in 0..<N { for x in 0..<N {
    let t = CGFloat(y) / CGFloat(N - 1)
    set(x, y, hex(0x4256c4).blended(withFraction: t, of: hex(0x1d2457))!)
} }
for (x, y, c) in [(4, 5, 0xffffff), (27, 4, 0xffd34d), (25, 9, 0xffffff), (6, 25, 0xffd34d), (28, 23, 0xffffff), (3, 14, 0x9fb0ff)] as [(Int, Int, UInt32)] { set(x, y, hex(c)) }
for (x, y) in [(26, 3), (26, 5), (25, 4), (27, 4)] { set(x, y, hex(0xffd34d)) }   // little sparkle

// ground shadow
for x in 9...22 { set(x, 28, hex(0x141a40)) }
for x in 11...20 { set(x, 29, hex(0x141a40)) }

// Poké Ball (centre 15.5, 15, radius 11)
let cx = 15.5, cy = 15.0, r = 11.2
let ink = hex(0x1b1d2e), red = hex(0xe8402a), redDark = hex(0xb0261a), redLight = hex(0xff7a5c)
let cream = hex(0xf7f3e8), creamDark = hex(0xcfc8b8)
for y in 0..<N { for x in 0..<N {
    let dx = Double(x) + 0.5 - cx, dy = Double(y) + 0.5 - cy, d = (dx * dx + dy * dy).squareRoot()
    guard d <= r else { continue }
    if d > r - 1.25 { set(x, y, ink); continue }
    if abs(dy) < 1.3 { set(x, y, ink); continue }                         // middle band
    let shade = dx * 0.55 + dy * 0.45 > 4.2                               // lower-right shadow
    if dy < 0 { set(x, y, shade ? redDark : red) } else { set(x, y, shade ? creamDark : cream) }
} }
for (x, y) in [(9, 8), (10, 7), (11, 6), (9, 9), (10, 6), (12, 6)] { set(x, y, redLight) }   // shine
for (x, y) in [(8, 9), (8, 10), (9, 7)] { set(x, y, hex(0xffffff)) }
// centre button
for y in 0..<N { for x in 0..<N {
    let dx = Double(x) + 0.5 - cx, dy = Double(y) + 0.5 - cy, d = (dx * dx + dy * dy).squareRoot()
    if d <= 3.6 { set(x, y, d > 2.3 ? ink : (dx + dy > 1.2 ? creamDark : hex(0xffffff))) }
} }

// render (maskable icons keep the art inside the middle 80%)
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
let ctx = NSGraphicsContext(bitmapImageRep: rep)!; NSGraphicsContext.current = ctx
ctx.shouldAntialias = false; ctx.imageInterpolation = .none
hex(0x1d2457).setFill(); NSRect(x: 0, y: 0, width: size, height: size).fill()
let inset = maskable ? Double(size) * 0.1 : 0, cell = (Double(size) - inset * 2) / Double(N)
if maskable {   // fill the safe-zone border with the background gradient ends
    for y in 0..<size { let t = CGFloat(y) / CGFloat(size - 1); hex(0x1d2457).blended(withFraction: t, of: hex(0x4256c4))!.setFill(); NSRect(x: 0, y: y, width: size, height: 1).fill() }
}
for y in 0..<N { for x in 0..<N {
    guard let c = px[y][x] else { continue }
    let x0 = (inset + Double(x) * cell).rounded(.down), x1 = (inset + Double(x + 1) * cell).rounded(.down)
    let yTop = (inset + Double(y) * cell).rounded(.down), yBot = (inset + Double(y + 1) * cell).rounded(.down)
    c.setFill()
    NSRect(x: x0, y: Double(size) - yBot, width: x1 - x0, height: yBot - yTop).fill()
} }
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))

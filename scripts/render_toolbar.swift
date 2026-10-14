import AppKit

// Safari tints this alpha-only template; use the same menu-and-pointer motif.
let root = URL(fileURLWithPath: CommandLine.arguments[1])
for size in [16, 32, 64] {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let transform = NSAffineTransform()
    transform.scale(by: CGFloat(size) / 20)
    transform.concat()
    NSColor.black.setStroke()
    NSColor.black.setFill()
    let menu = NSBezierPath()
    menu.move(to: NSPoint(x: 8, y: 3))
    menu.line(to: NSPoint(x: 4, y: 3))
    menu.curve(to: NSPoint(x: 2, y: 5), controlPoint1: NSPoint(x: 2.9, y: 3), controlPoint2: NSPoint(x: 2, y: 3.9))
    menu.line(to: NSPoint(x: 2, y: 15))
    menu.curve(to: NSPoint(x: 4, y: 17), controlPoint1: NSPoint(x: 2, y: 16.1), controlPoint2: NSPoint(x: 2.9, y: 17))
    menu.line(to: NSPoint(x: 15, y: 17))
    menu.curve(to: NSPoint(x: 17, y: 15), controlPoint1: NSPoint(x: 16.1, y: 17), controlPoint2: NSPoint(x: 17, y: 16.1))
    menu.line(to: NSPoint(x: 17, y: 10))
    menu.lineWidth = 1.5
    menu.lineCapStyle = .round
    menu.stroke()
    for y in [13.0, 9.5] {
        let line = NSBezierPath()
        line.move(to: NSPoint(x: 5, y: y))
        line.line(to: NSPoint(x: y == 13 ? 13 : 8, y: y))
        line.lineWidth = 1.5
        line.lineCapStyle = .round
        line.stroke()
    }
    let cursor = NSBezierPath()
    cursor.move(to: NSPoint(x: 10, y: 10))
    for point in [NSPoint(x: 10, y: 1.5), NSPoint(x: 12.5, y: 3.8), NSPoint(x: 14.1, y: 0.5), NSPoint(x: 15.8, y: 1.3), NSPoint(x: 14.2, y: 4.5), NSPoint(x: 18, y: 4.5)] { cursor.line(to: point) }
    cursor.close()
    cursor.fill()
    NSGraphicsContext.restoreGraphicsState()
    try rep.representation(using: .png, properties: [:])!.write(to: root.appendingPathComponent("src/icons/toolbar-\(size).png"))
}

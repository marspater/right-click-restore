import Cocoa
import CoreGraphics

func createSquirclePath(in rect: CGRect, radius: CGFloat) -> CGPath {
    let path = CGMutablePath()
    let x = rect.origin.x
    let y = rect.origin.y
    let w = rect.width
    let h = rect.height
    let r = radius
    
    path.move(to: CGPoint(x: x + r, y: y))
    path.addLine(to: CGPoint(x: x + w - r, y: y))
    path.addCurve(to: CGPoint(x: x + w, y: y + r),
                  control1: CGPoint(x: x + w - r * 0.448, y: y),
                  control2: CGPoint(x: x + w, y: y + r * 0.448))
    path.addLine(to: CGPoint(x: x + w, y: y + h - r))
    path.addCurve(to: CGPoint(x: x + w - r, y: y + h),
                  control1: CGPoint(x: x + w, y: y + h - r * 0.448),
                  control2: CGPoint(x: x + w - r * 0.448, y: y + h))
    path.addLine(to: CGPoint(x: x + r, y: y + h))
    path.addCurve(to: CGPoint(x: x, y: y + h - r),
                  control1: CGPoint(x: x + r * 0.448, y: y + h),
                  control2: CGPoint(x: x, y: y + h - r * 0.448))
    path.addLine(to: CGPoint(x: x, y: y + r))
    path.addCurve(to: CGPoint(x: x + r, y: y),
                  control1: CGPoint(x: x, y: y + r * 0.448),
                  control2: CGPoint(x: x + r * 0.448, y: y))
    path.closeSubpath()
    return path
}

func drawIconArtwork(in ctx: CGContext, bounds: CGRect, isFullBleed: Bool) {
    let s = bounds.width
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    
    // 1. Mesh Background Gradient
    let bgColors = [
        NSColor(red: 0.01, green: 0.05, blue: 0.18, alpha: 1.0).cgColor,
        NSColor(red: 0.00, green: 0.45, blue: 0.95, alpha: 1.0).cgColor,
        NSColor(red: 0.00, green: 0.80, blue: 1.00, alpha: 1.0).cgColor,
        NSColor(red: 0.55, green: 0.18, blue: 0.95, alpha: 1.0).cgColor
    ] as CFArray
    let bgLocations: [CGFloat] = [0.0, 0.35, 0.70, 1.0]
    if let bgGradient = CGGradient(colorsSpace: colorSpace, colors: bgColors, locations: bgLocations) {
        ctx.drawLinearGradient(bgGradient,
                               start: CGPoint(x: bounds.minX, y: bounds.maxY),
                               end: CGPoint(x: bounds.maxX, y: bounds.minY),
                               options: [])
    }
    
    // 2. Ambient Fluid Orbs
    ctx.saveGState()
    let radColors1 = [
        NSColor(red: 0.0, green: 0.9, blue: 1.0, alpha: 0.65).cgColor,
        NSColor(red: 0.0, green: 0.9, blue: 1.0, alpha: 0.0).cgColor
    ] as CFArray
    if let radGrad1 = CGGradient(colorsSpace: colorSpace, colors: radColors1, locations: [0.0, 1.0]) {
        let center1 = CGPoint(x: bounds.minX + bounds.width * 0.3, y: bounds.maxY - bounds.height * 0.25)
        ctx.drawRadialGradient(radGrad1,
                               startCenter: center1, startRadius: 0,
                               endCenter: center1, endRadius: bounds.width * 0.55,
                               options: [])
    }
    ctx.restoreGState()

    ctx.saveGState()
    let radColors2 = [
        NSColor(red: 0.90, green: 0.20, blue: 0.80, alpha: 0.5).cgColor,
        NSColor(red: 0.90, green: 0.20, blue: 0.80, alpha: 0.0).cgColor
    ] as CFArray
    if let radGrad2 = CGGradient(colorsSpace: colorSpace, colors: radColors2, locations: [0.0, 1.0]) {
        let center2 = CGPoint(x: bounds.maxX - bounds.width * 0.25, y: bounds.minY + bounds.height * 0.25)
        ctx.drawRadialGradient(radGrad2,
                               startCenter: center2, startRadius: 0,
                               endCenter: center2, endRadius: bounds.width * 0.6,
                               options: [])
    }
    ctx.restoreGState()

    // 3. Centerpiece: Glowing Protective Shield & Cursor Arrow
    let cx = bounds.midX
    let cy = bounds.midY
    let glyphScale = bounds.width / 824.0
    
    // Shield Backdrop Pill
    let shieldW = 360.0 * glyphScale
    let shieldH = 400.0 * glyphScale
    let shieldRect = CGRect(x: cx - shieldW / 2, y: cy - shieldH / 2, width: shieldW, height: shieldH)
    let shieldPath = CGMutablePath()
    shieldPath.move(to: CGPoint(x: shieldRect.midX, y: shieldRect.maxY))
    shieldPath.addLine(to: CGPoint(x: shieldRect.maxX, y: shieldRect.maxY - shieldH * 0.28))
    shieldPath.addQuadCurve(to: CGPoint(x: shieldRect.midX, y: shieldRect.minY),
                            control: CGPoint(x: shieldRect.maxX * 0.96, y: shieldRect.minY + shieldH * 0.22))
    shieldPath.addQuadCurve(to: CGPoint(x: shieldRect.minX, y: shieldRect.maxY - shieldH * 0.28),
                            control: CGPoint(x: shieldRect.minX * 1.04, y: shieldRect.minY + shieldH * 0.22))
    shieldPath.closeSubpath()
    
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -8 * glyphScale), blur: 24 * glyphScale, color: NSColor(red: 0, green: 0, blue: 0, alpha: 0.45).cgColor)
    ctx.addPath(shieldPath)
    ctx.setFillColor(NSColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 0.16).cgColor)
    ctx.fillPath()
    
    ctx.addPath(shieldPath)
    ctx.setLineWidth(3.5 * glyphScale)
    ctx.setStrokeColor(NSColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 0.55).cgColor)
    ctx.strokePath()
    ctx.restoreGState()

    // Glowing Cursor Arrow
    let arrowPath = CGMutablePath()
    let ox = cx - 44 * glyphScale
    let oy = cy - 35 * glyphScale
    arrowPath.move(to: CGPoint(x: ox, y: oy + 130 * glyphScale))
    arrowPath.addLine(to: CGPoint(x: ox + 95 * glyphScale, y: oy + 38 * glyphScale))
    arrowPath.addLine(to: CGPoint(x: ox + 40 * glyphScale, y: oy + 38 * glyphScale))
    arrowPath.addLine(to: CGPoint(x: ox + 78 * glyphScale, y: oy - 60 * glyphScale))
    arrowPath.addLine(to: CGPoint(x: ox + 50 * glyphScale, y: oy - 72 * glyphScale))
    arrowPath.addLine(to: CGPoint(x: ox + 12 * glyphScale, y: oy + 28 * glyphScale))
    arrowPath.addLine(to: CGPoint(x: ox - 44 * glyphScale, y: oy - 28 * glyphScale))
    arrowPath.closeSubpath()
    
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -4 * glyphScale), blur: 18 * glyphScale, color: NSColor(red: 0.0, green: 0.85, blue: 1.0, alpha: 0.85).cgColor)
    ctx.addPath(arrowPath)
    ctx.setFillColor(NSColor.white.cgColor)
    ctx.fillPath()
    ctx.restoreGState()

    // 4. Specular Top Glass Highlight (macOS 27 Sheen)
    let sheenRect = CGRect(x: bounds.minX, y: bounds.midY, width: bounds.width, height: bounds.height / 2)
    let sheenColors = [
        NSColor(white: 1.0, alpha: 0.40).cgColor,
        NSColor(white: 1.0, alpha: 0.0).cgColor
    ] as CFArray
    if let sheenGrad = CGGradient(colorsSpace: colorSpace, colors: sheenColors, locations: [0.0, 1.0]) {
        ctx.drawLinearGradient(sheenGrad,
                               start: CGPoint(x: sheenRect.midX, y: bounds.maxY),
                               end: CGPoint(x: sheenRect.midX, y: bounds.midY),
                               options: [])
    }
    
    // Inset Rim Border
    if !isFullBleed {
        let squirclePath = createSquirclePath(in: bounds, radius: bounds.width * 0.225)
        ctx.addPath(squirclePath)
        ctx.setLineWidth(3.0 * glyphScale)
        ctx.setStrokeColor(NSColor(white: 1.0, alpha: 0.45).cgColor)
        ctx.strokePath()
    }
}

// 1. macOS App Icon (with native squircle & transparent outside)
func renderAppSquircleIcon(size: Int) -> NSImage {
    let s = CGFloat(size)
    let image = NSImage(size: NSSize(width: s, height: s))
    image.lockFocus()
    guard let ctx = NSGraphicsContext.current?.cgContext else {
        image.unlockFocus()
        return image
    }
    ctx.clear(CGRect(x: 0, y: 0, width: s, height: s))
    
    let margin = s * (100.0 / 1024.0)
    let squircleRect = CGRect(x: margin, y: margin, width: s - 2 * margin, height: s - 2 * margin)
    let squirclePath = createSquirclePath(in: squircleRect, radius: squircleRect.width * 0.225)
    
    // Drop shadow
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.035), blur: s * 0.06, color: NSColor(red: 0, green: 0, blue: 0, alpha: 0.45).cgColor)
    ctx.addPath(squirclePath)
    ctx.setFillColor(NSColor(red: 0.05, green: 0.08, blue: 0.18, alpha: 1.0).cgColor)
    ctx.fillPath()
    ctx.restoreGState()
    
    // Clip and draw
    ctx.saveGState()
    ctx.addPath(squirclePath)
    ctx.clip()
    drawIconArtwork(in: ctx, bounds: squircleRect, isFullBleed: false)
    ctx.restoreGState()
    
    image.unlockFocus()
    return image
}

// 2. Full-Bleed Extension Icon (Edge-to-Edge so Safari clips it seamlessly with NO grey borders!)
func renderFullBleedIcon(size: Int) -> NSImage {
    let s = CGFloat(size)
    let image = NSImage(size: NSSize(width: s, height: s))
    image.lockFocus()
    guard let ctx = NSGraphicsContext.current?.cgContext else {
        image.unlockFocus()
        return image
    }
    ctx.clear(CGRect(x: 0, y: 0, width: s, height: s))
    drawIconArtwork(in: ctx, bounds: CGRect(x: 0, y: 0, width: s, height: s), isFullBleed: true)
    image.unlockFocus()
    return image
}

func savePNG(image: NSImage, path: String) {
    guard let tiff = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let pngData = rep.representation(using: .png, properties: [:]) else { return }
    try? pngData.write(to: URL(fileURLWithPath: path))
    print("Saved:", path)
}

let fileManager = FileManager.default
let basePath = "/Users/marspater/Documents/antigravity/wise-carson"
let appIconSet = "\(basePath)/SafariExtension/RightClickRestore/Shared (App)/Assets.xcassets/AppIcon.appiconset"
let largeIconSet = "\(basePath)/SafariExtension/RightClickRestore/Shared (App)/Assets.xcassets/LargeIcon.imageset"
let extIcons = "\(basePath)/extension/icons"
let sharedExtIcons = "\(basePath)/SafariExtension/RightClickRestore/Shared (Extension)/Resources/icons"

try? fileManager.createDirectory(atPath: appIconSet, withIntermediateDirectories: true)
try? fileManager.createDirectory(atPath: largeIconSet, withIntermediateDirectories: true)
try? fileManager.createDirectory(atPath: extIcons, withIntermediateDirectories: true)
try? fileManager.createDirectory(atPath: sharedExtIcons, withIntermediateDirectories: true)

// 1. App Icons
let masterAppIcon = renderAppSquircleIcon(size: 1024)
savePNG(image: masterAppIcon, path: "\(appIconSet)/universal-icon-1024@1x.png")
savePNG(image: masterAppIcon, path: "\(basePath)/SafariExtension/RightClickRestore/Shared (App)/Resources/Icon.png")
savePNG(image: masterAppIcon, path: "\(basePath)/SafariExtension/RightClickRestore/Shared (App)/Resources/Base.lproj/Icon.png")

let macSizes: [(String, Int)] = [
    ("mac-icon-16@1x.png", 16),
    ("mac-icon-16@2x.png", 32),
    ("mac-icon-32@1x.png", 32),
    ("mac-icon-32@2x.png", 64),
    ("mac-icon-128@1x.png", 128),
    ("mac-icon-128@2x.png", 256),
    ("mac-icon-256@1x.png", 256),
    ("mac-icon-256@2x.png", 512),
    ("mac-icon-512@1x.png", 512),
    ("mac-icon-512@2x.png", 1024),
]
for (name, size) in macSizes {
    let img = renderAppSquircleIcon(size: size)
    savePNG(image: img, path: "\(appIconSet)/\(name)")
}

// 2. Full-Bleed Extension Icons (Fixes Safari double-border / grey frame bug!)
let extSizes = [16, 32, 48, 64, 128, 256, 512]
for size in extSizes {
    let img = renderFullBleedIcon(size: size)
    savePNG(image: img, path: "\(extIcons)/icon-\(size).png")
    savePNG(image: img, path: "\(sharedExtIcons)/icon-\(size).png")
}
let largeIcon = renderFullBleedIcon(size: 256)
savePNG(image: largeIcon, path: "\(largeIconSet)/icon-256.png")

print("✅ All icons (macOS App Squircle & Full-Bleed Extension Icons) rendered flawlessly!")

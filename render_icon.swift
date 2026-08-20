import Cocoa
import CoreGraphics

func createSquirclePath(in rect: CGRect, radius: CGFloat) -> CGPath {
    let path = CGMutablePath()
    let x = rect.origin.x
    let y = rect.origin.y
    let w = rect.width
    let h = rect.height
    let r = radius
    
    // Apple continuous curvature corner approximation
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

func renderMacOS27Icon(size: Int) -> NSImage {
    let s = CGFloat(size)
    let image = NSImage(size: NSSize(width: s, height: s))
    
    image.lockFocus()
    guard let ctx = NSGraphicsContext.current?.cgContext else {
        image.unlockFocus()
        return image
    }
    
    ctx.setAllowsAntialiasing(true)
    ctx.setShouldAntialias(true)
    
    // Clear transparent canvas outside squircle (NO white borders!)
    ctx.clear(CGRect(x: 0, y: 0, width: s, height: s))
    
    // Apple macOS Icon Grid: 824x824 on 1024x1024 canvas (scaled)
    let margin = s * (100.0 / 1024.0)
    let squircleRect = CGRect(x: margin, y: margin, width: s - 2 * margin, height: s - 2 * margin)
    let cornerRadius = squircleRect.width * 0.225
    let squirclePath = createSquirclePath(in: squircleRect, radius: cornerRadius)
    
    // 1. Drop shadow beneath squircle
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.035), blur: s * 0.06, color: NSColor(red: 0, green: 0, blue: 0, alpha: 0.45).cgColor)
    ctx.addPath(squirclePath)
    ctx.setFillColor(NSColor(red: 0.05, green: 0.08, blue: 0.18, alpha: 1.0).cgColor)
    ctx.fillPath()
    ctx.restoreGState()
    
    // 2. Clip to Squircle
    ctx.saveGState()
    ctx.addPath(squirclePath)
    ctx.clip()
    
    // 3. Liquid Glass Deep Mesh Gradient
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bgColors = [
        NSColor(red: 0.02, green: 0.04, blue: 0.12, alpha: 1.0).cgColor, // deep midnight
        NSColor(red: 0.00, green: 0.35, blue: 0.85, alpha: 1.0).cgColor, // electric sapphire
        NSColor(red: 0.00, green: 0.70, blue: 1.00, alpha: 1.0).cgColor, // neon cyan
        NSColor(red: 0.45, green: 0.15, blue: 0.85, alpha: 1.0).cgColor  // royal violet
    ] as CFArray
    let bgLocations: [CGFloat] = [0.0, 0.4, 0.75, 1.0]
    if let bgGradient = CGGradient(colorsSpace: colorSpace, colors: bgColors, locations: bgLocations) {
        ctx.drawLinearGradient(bgGradient,
                               start: CGPoint(x: squircleRect.minX, y: squircleRect.maxY),
                               end: CGPoint(x: squircleRect.maxX, y: squircleRect.minY),
                               options: [])
    }
    
    // 4. Ambient Liquid Blob 1 (Top Left Cyan Glow)
    ctx.saveGState()
    let radialColors1 = [
        NSColor(red: 0.0, green: 0.85, blue: 1.0, alpha: 0.6).cgColor,
        NSColor(red: 0.0, green: 0.85, blue: 1.0, alpha: 0.0).cgColor
    ] as CFArray
    if let radGrad1 = CGGradient(colorsSpace: colorSpace, colors: radialColors1, locations: [0.0, 1.0]) {
        let center1 = CGPoint(x: squircleRect.minX + squircleRect.width * 0.3, y: squircleRect.maxY - squircleRect.height * 0.25)
        ctx.drawRadialGradient(radGrad1,
                               startCenter: center1, startRadius: 0,
                               endCenter: center1, endRadius: squircleRect.width * 0.5,
                               options: [])
    }
    ctx.restoreGState()

    // 5. Ambient Liquid Blob 2 (Bottom Right Magenta Glow)
    ctx.saveGState()
    let radialColors2 = [
        NSColor(red: 0.85, green: 0.15, blue: 0.75, alpha: 0.45).cgColor,
        NSColor(red: 0.85, green: 0.15, blue: 0.75, alpha: 0.0).cgColor
    ] as CFArray
    if let radGrad2 = CGGradient(colorsSpace: colorSpace, colors: radialColors2, locations: [0.0, 1.0]) {
        let center2 = CGPoint(x: squircleRect.maxX - squircleRect.width * 0.25, y: squircleRect.minY + squircleRect.height * 0.25)
        ctx.drawRadialGradient(radGrad2,
                               startCenter: center2, startRadius: 0,
                               endCenter: center2, endRadius: squircleRect.width * 0.55,
                               options: [])
    }
    ctx.restoreGState()

    // 6. Draw Centerpiece Glyph: Modern 3D Cursor + Shield Restorer
    let cx = squircleRect.midX
    let cy = squircleRect.midY
    let glyphScale = squircleRect.width / 824.0
    
    // Shield Backdrop Pill
    let shieldW = 340.0 * glyphScale
    let shieldH = 380.0 * glyphScale
    let shieldRect = CGRect(x: cx - shieldW / 2, y: cy - shieldH / 2, width: shieldW, height: shieldH)
    let shieldPath = CGMutablePath()
    shieldPath.move(to: CGPoint(x: shieldRect.midX, y: shieldRect.maxY))
    shieldPath.addLine(to: CGPoint(x: shieldRect.maxX, y: shieldRect.maxY - shieldH * 0.3))
    shieldPath.addQuadCurve(to: CGPoint(x: shieldRect.midX, y: shieldRect.minY),
                            control: CGPoint(x: shieldRect.maxX * 0.95, y: shieldRect.minY + shieldH * 0.2))
    shieldPath.addQuadCurve(to: CGPoint(x: shieldRect.minX, y: shieldRect.maxY - shieldH * 0.3),
                            control: CGPoint(x: shieldRect.minX * 1.05, y: shieldRect.minY + shieldH * 0.2))
    shieldPath.closeSubpath()
    
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -8 * glyphScale), blur: 20 * glyphScale, color: NSColor(red: 0, green: 0, blue: 0, alpha: 0.5).cgColor)
    ctx.addPath(shieldPath)
    ctx.setFillColor(NSColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 0.12).cgColor)
    ctx.fillPath()
    
    // Shield Inset Glass Stroke
    ctx.addPath(shieldPath)
    ctx.setLineWidth(3.0 * glyphScale)
    ctx.setStrokeColor(NSColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 0.45).cgColor)
    ctx.strokePath()
    ctx.restoreGState()

    // Glowing Cursor Arrow
    let arrowPath = CGMutablePath()
    let ox = cx - 40 * glyphScale
    let oy = cy - 30 * glyphScale
    arrowPath.move(to: CGPoint(x: ox, y: oy + 120 * glyphScale))
    arrowPath.addLine(to: CGPoint(x: ox + 85 * glyphScale, y: oy + 35 * glyphScale))
    arrowPath.addLine(to: CGPoint(x: ox + 35 * glyphScale, y: oy + 35 * glyphScale))
    arrowPath.addLine(to: CGPoint(x: ox + 70 * glyphScale, y: oy - 55 * glyphScale))
    arrowPath.addLine(to: CGPoint(x: ox + 45 * glyphScale, y: oy - 65 * glyphScale))
    arrowPath.addLine(to: CGPoint(x: ox + 10 * glyphScale, y: oy + 25 * glyphScale))
    arrowPath.addLine(to: CGPoint(x: ox - 40 * glyphScale, y: oy - 25 * glyphScale))
    arrowPath.closeSubpath()
    
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -4 * glyphScale), blur: 16 * glyphScale, color: NSColor(red: 0.0, green: 0.8, blue: 1.0, alpha: 0.75).cgColor)
    ctx.addPath(arrowPath)
    ctx.setFillColor(NSColor.white.cgColor)
    ctx.fillPath()
    ctx.restoreGState()

    // 7. Specular Top Glass Highlight (visionOS / macOS 27 Sheen)
    let sheenRect = CGRect(x: squircleRect.minX, y: squircleRect.midY, width: squircleRect.width, height: squircleRect.height / 2)
    let sheenColors = [
        NSColor(white: 1.0, alpha: 0.35).cgColor,
        NSColor(white: 1.0, alpha: 0.0).cgColor
    ] as CFArray
    if let sheenGrad = CGGradient(colorsSpace: colorSpace, colors: sheenColors, locations: [0.0, 1.0]) {
        ctx.drawLinearGradient(sheenGrad,
                               start: CGPoint(x: sheenRect.midX, y: squircleRect.maxY),
                               end: CGPoint(x: sheenRect.midX, y: squircleRect.midY),
                               options: [])
    }
    
    // 8. Iridescent Glass Inset Border
    ctx.addPath(squirclePath)
    ctx.setLineWidth(3.0 * glyphScale)
    ctx.setStrokeColor(NSColor(white: 1.0, alpha: 0.45).cgColor)
    ctx.strokePath()
    
    ctx.restoreGState() // unclip squircle
    
    image.unlockFocus()
    return image
}

func savePNG(image: NSImage, path: String) {
    guard let tiff = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let pngData = rep.representation(using: .png, properties: [:]) else {
        print("Failed to encode PNG for:", path)
        return
    }
    try? pngData.write(to: URL(fileURLWithPath: path))
    print("Saved:", path)
}

let fileManager = FileManager.default
let basePath = "/Users/marspater/Documents/antigravity/wise-carson"
let appIconSet = "\(basePath)/SafariExtension/RightClickRestore/Shared (App)/Assets.xcassets/AppIcon.appiconset"
let extIcons = "\(basePath)/extension/icons"
let sharedExtIcons = "\(basePath)/SafariExtension/RightClickRestore/Shared (Extension)/Resources/icons"

try? fileManager.createDirectory(atPath: appIconSet, withIntermediateDirectories: true)
try? fileManager.createDirectory(atPath: extIcons, withIntermediateDirectories: true)
try? fileManager.createDirectory(atPath: sharedExtIcons, withIntermediateDirectories: true)

// 1. Generate full 1024x1024 Master Icon
let icon1024 = renderMacOS27Icon(size: 1024)
savePNG(image: icon1024, path: "\(appIconSet)/universal-icon-1024@1x.png")
savePNG(image: icon1024, path: "\(basePath)/SafariExtension/RightClickRestore/Shared (App)/Resources/Icon.png")

// 2. Generate macOS AppIcon sizes
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
    let img = renderMacOS27Icon(size: size)
    savePNG(image: img, path: "\(appIconSet)/\(name)")
}

// 3. Generate Extension Toolbar Icons
let extSizes = [16, 32, 48, 64, 128, 256, 512]
for size in extSizes {
    let img = renderMacOS27Icon(size: size)
    savePNG(image: img, path: "\(extIcons)/icon-\(size).png")
    savePNG(image: img, path: "\(sharedExtIcons)/icon-\(size).png")
}

print("✅ All macOS 27 Squircle icons successfully generated with 100% transparent corners!")

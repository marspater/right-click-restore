import AppKit
import Foundation

// MARK: - Path Resolution

let fileURL = URL(fileURLWithPath: #file)
let scriptsDir = fileURL.deletingLastPathComponent()
let projectRoot = scriptsDir.deletingLastPathComponent()
let appDir = projectRoot.appendingPathComponent("SafariExtension/RightClickRestore/Shared (App)")
let ictoolPath = "/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool"

// MARK: - AppKit / CoreGraphics Resizing

func resize(image: NSImage, pixelWidth: Int, pixelHeight: Int, to destination: URL) throws {
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: pixelWidth,
        pixelsHigh: pixelHeight,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!
    rep.size = NSSize(width: pixelWidth, height: pixelHeight)

    NSGraphicsContext.saveGraphicsState()
    guard let context = NSGraphicsContext(bitmapImageRep: rep) else {
        fatalError("Failed to initialize NSGraphicsContext with NSBitmapImageRep")
    }
    NSGraphicsContext.current = context
    context.imageInterpolation = .high

    image.draw(
        in: NSRect(x: 0, y: 0, width: pixelWidth, height: pixelHeight),
        from: .zero,
        operation: .copy,
        fraction: 1.0
    )
    NSGraphicsContext.restoreGraphicsState()

    guard let pngData = rep.representation(using: .png, properties: [:]) else {
        fatalError("Failed to encode PNG representation for \(destination.lastPathComponent)")
    }

    try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
    try pngData.write(to: destination)
}

// MARK: - 1. Export Master Canvas via Icon Composer ictool

let scratchDir = FileManager.default.temporaryDirectory.appendingPathComponent("rightclick-icons-\(UUID().uuidString)")
try FileManager.default.createDirectory(at: scratchDir, withIntermediateDirectories: true)
defer {
    try? FileManager.default.removeItem(at: scratchDir)
}

let masterURL = scratchDir.appendingPathComponent("master.png")
let iconDocumentURL = projectRoot.appendingPathComponent("Assets/RestoreIcon.icon")

guard FileManager.default.fileExists(atPath: ictoolPath) else {
    fatalError("Icon Composer ictool not found at \(ictoolPath)")
}

let ictoolProc = Process()
ictoolProc.executableURL = URL(fileURLWithPath: ictoolPath)
ictoolProc.arguments = [
    iconDocumentURL.path,
    "--export-image",
    "--output-file", masterURL.path,
    "--platform", "macOS",
    "--rendition", "Default",
    "--width", "1024",
    "--height", "1024",
    "--scale", "1",
    "--design-generation", "27"
]
try ictoolProc.run()
ictoolProc.waitUntilExit()

guard ictoolProc.terminationStatus == 0, FileManager.default.fileExists(atPath: masterURL.path) else {
    fatalError("Icon Composer ictool failed to export master canvas from \(iconDocumentURL.path)")
}

guard let masterImage = NSImage(contentsOf: masterURL) else {
    fatalError("Failed to load exported master image into NSImage from \(masterURL.path)")
}

// MARK: - 2. Populate Xcode Asset Catalog (AppIcon.appiconset)

struct AppIconCatalog: Codable {
    struct ImageEntry: Codable {
        let size: String
        let filename: String?
        let scale: String?
    }
    let images: [ImageEntry]
}

let catalogDir = appDir.appendingPathComponent("Assets.xcassets/AppIcon.appiconset")
let contentsData = try Data(contentsOf: catalogDir.appendingPathComponent("Contents.json"))
let catalog = try JSONDecoder().decode(AppIconCatalog.self, from: contentsData)

for item in catalog.images {
    guard let filename = item.filename else { continue }
    let baseDim = Int(item.size.components(separatedBy: "x").first ?? "1024") ?? 1024
    let scaleMultiplier = Int(item.scale?.replacingOccurrences(of: "x", with: "") ?? "1") ?? 1
    let pixelSize = baseDim * scaleMultiplier
    try resize(image: masterImage, pixelWidth: pixelSize, pixelHeight: pixelSize, to: catalogDir.appendingPathComponent(filename))
}

// MARK: - 3. Web Extension Fallback Icons

for size in [16, 32, 48, 64, 128, 256, 512] {
    try resize(image: masterImage, pixelWidth: size, pixelHeight: size, to: projectRoot.appendingPathComponent("src/icons/icon-\(size).png"))
}

try resize(image: masterImage, pixelWidth: 256, pixelHeight: 256, to: appDir.appendingPathComponent("Assets.xcassets/LargeIcon.imageset/icon-256.png"))
try resize(image: masterImage, pixelWidth: 1024, pixelHeight: 1024, to: appDir.appendingPathComponent("Resources/Icon.png"))
try resize(image: masterImage, pixelWidth: 1024, pixelHeight: 1024, to: appDir.appendingPathComponent("Resources/Base.lproj/Icon.png"))

// MARK: - 4. Generate macOS ICNS Bundle via iconutil

let iconsetDir = scratchDir.appendingPathComponent("AppIcon.iconset")
try FileManager.default.createDirectory(at: iconsetDir, withIntermediateDirectories: true)

for size in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let suffix = scale == 2 ? "@2x" : ""
        let targetFile = iconsetDir.appendingPathComponent("icon_\(size)x\(size)\(suffix).png")
        try resize(image: masterImage, pixelWidth: size * scale, pixelHeight: size * scale, to: targetFile)
    }
}

let iconutilProc = Process()
iconutilProc.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
iconutilProc.arguments = ["-c", "icns", iconsetDir.path, "-o", appDir.appendingPathComponent("Resources/AppIcon.icns").path]
try iconutilProc.run()
iconutilProc.waitUntilExit()

guard iconutilProc.terminationStatus == 0 else {
    fatalError("iconutil failed to produce AppIcon.icns")
}

// MARK: - 5. Render Safari Toolbar Template Icons (AppKit Vector Drawing)

for size in [16, 32, 64] {
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: size,
        pixelsHigh: size,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)

    let transform = NSAffineTransform()
    transform.scale(by: CGFloat(size) / 20.0)
    transform.concat()

    NSColor.black.setStroke()
    NSColor.black.setFill()

    // Menu outline
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

    // Menu items
    for y in [13.0, 9.5] {
        let line = NSBezierPath()
        line.move(to: NSPoint(x: 5, y: y))
        line.line(to: NSPoint(x: y == 13.0 ? 13.0 : 8.0, y: y))
        line.lineWidth = 1.5
        line.lineCapStyle = .round
        line.stroke()
    }

    // Pointer cursor
    let cursor = NSBezierPath()
    cursor.move(to: NSPoint(x: 10, y: 10))
    for point in [
        NSPoint(x: 10, y: 1.5),
        NSPoint(x: 12.5, y: 3.8),
        NSPoint(x: 14.1, y: 0.5),
        NSPoint(x: 15.8, y: 1.3),
        NSPoint(x: 14.2, y: 4.5),
        NSPoint(x: 18, y: 4.5)
    ] {
        cursor.line(to: point)
    }
    cursor.close()
    cursor.fill()

    NSGraphicsContext.restoreGraphicsState()

    guard let toolbarPng = rep.representation(using: .png, properties: [:]) else {
        fatalError("Failed to encode toolbar PNG for size \(size)")
    }
    try toolbarPng.write(to: projectRoot.appendingPathComponent("src/icons/toolbar-\(size).png"))
}

print("✅ AppKit & CoreGraphics: all raster icons and toolbar templates successfully rendered.")

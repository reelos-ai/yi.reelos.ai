import AppKit
import Foundation

let fileManager = FileManager.default
let root = URL(fileURLWithPath: fileManager.currentDirectoryPath)
let iconset = root.appendingPathComponent("build/icon.iconset")
try? fileManager.removeItem(at: iconset)
try fileManager.createDirectory(at: iconset, withIntermediateDirectories: true)

func color(_ hex: UInt32, alpha: CGFloat = 1) -> NSColor {
  NSColor(
    calibratedRed: CGFloat((hex >> 16) & 0xff) / 255,
    green: CGFloat((hex >> 8) & 0xff) / 255,
    blue: CGFloat(hex & 0xff) / 255,
    alpha: alpha
  )
}

func ellipse(_ rect: NSRect, fill: NSColor) {
  fill.setFill()
  NSBezierPath(ovalIn: rect).fill()
}

func drawIcon(size: Int, to url: URL) throws {
  guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: size,
    pixelsHigh: size,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bitmapFormat: [],
    bytesPerRow: 0,
    bitsPerPixel: 0
  ) else { throw NSError(domain: "Icon", code: 1) }

  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
  guard let context = NSGraphicsContext.current?.cgContext else { throw NSError(domain: "Icon", code: 2) }
  context.scaleBy(x: CGFloat(size) / 1024, y: CGFloat(size) / 1024)

  let background = NSBezierPath(roundedRect: NSRect(x: 36, y: 36, width: 952, height: 952), xRadius: 220, yRadius: 220)
  color(0x06111a).setFill()
  background.fill()
  color(0xb89554).setStroke()
  background.lineWidth = 18
  background.stroke()

  color(0x17232b).setFill()
  NSBezierPath(roundedRect: NSRect(x: 110, y: 110, width: 804, height: 804), xRadius: 170, yRadius: 170).fill()

  let gold = color(0xd9bd7d)
  let ivory = color(0xf1e7cc)
  let ink = color(0x071019)
  let cx: CGFloat = 512, cy: CGFloat = 512, radius: CGFloat = 252

  ellipse(NSRect(x: cx-radius, y: cy-radius, width: radius*2, height: radius*2), fill: ink)

  let leftHalf = NSBezierPath()
  leftHalf.move(to: NSPoint(x: cx, y: cy + radius))
  leftHalf.appendArc(withCenter: NSPoint(x: cx, y: cy), radius: radius, startAngle: 90, endAngle: 270)
  leftHalf.line(to: NSPoint(x: cx, y: cy + radius))
  leftHalf.close()
  ivory.setFill()
  leftHalf.fill()

  ellipse(NSRect(x: cx-radius/2, y: cy, width: radius, height: radius), fill: ivory)
  ellipse(NSRect(x: cx-radius/2, y: cy-radius, width: radius, height: radius), fill: ink)
  ellipse(NSRect(x: cx-34, y: cy+radius/2-34, width: 68, height: 68), fill: ink)
  ellipse(NSRect(x: cx-34, y: cy-radius/2-34, width: 68, height: 68), fill: ivory)

  gold.setStroke()
  let ring = NSBezierPath(ovalIn: NSRect(x: cx-radius-22, y: cy-radius-22, width: (radius+22)*2, height: (radius+22)*2))
  ring.lineWidth = 12
  ring.stroke()

  func trigram(y: CGFloat, broken: Bool) {
    gold.setFill()
    for row in 0..<3 {
      let yy = y + CGFloat(row) * 34
      if broken {
        NSBezierPath(roundedRect: NSRect(x: 350, y: yy, width: 132, height: 14), xRadius: 7, yRadius: 7).fill()
        NSBezierPath(roundedRect: NSRect(x: 542, y: yy, width: 132, height: 14), xRadius: 7, yRadius: 7).fill()
      } else {
        NSBezierPath(roundedRect: NSRect(x: 350, y: yy, width: 324, height: 14), xRadius: 7, yRadius: 7).fill()
      }
    }
  }
  trigram(y: 824, broken: false)
  trigram(y: 116, broken: true)

  NSGraphicsContext.restoreGraphicsState()
  guard let png = bitmap.representation(using: .png, properties: [:]) else { throw NSError(domain: "Icon", code: 3) }
  try png.write(to: url)
}

let variants: [(String, Int)] = [
  ("icon_16x16.png", 16), ("icon_16x16@2x.png", 32),
  ("icon_32x32.png", 32), ("icon_32x32@2x.png", 64),
  ("icon_128x128.png", 128), ("icon_128x128@2x.png", 256),
  ("icon_256x256.png", 256), ("icon_256x256@2x.png", 512),
  ("icon_512x512.png", 512), ("icon_512x512@2x.png", 1024),
]
for (name, size) in variants {
  try drawIcon(size: size, to: iconset.appendingPathComponent(name))
}

let iconutil = Process()
iconutil.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
iconutil.arguments = ["-c", "icns", iconset.path, "-o", root.appendingPathComponent("build/icon.icns").path]
try iconutil.run()
iconutil.waitUntilExit()
guard iconutil.terminationStatus == 0 else { throw NSError(domain: "Icon", code: 4) }
print("Generated build/icon.icns")

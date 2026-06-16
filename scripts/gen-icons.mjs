// Генерация иконок трея без внешних зависимостей (PNG кодируем вручную через zlib).
// Рисуем значок-«облачко сообщения» с антиалиасингом (суперсэмпл 3×3).
//   tray.png / @2x          — акцентный (Windows/Linux трей)
//   tray-template.png / @2x — чёрный с альфой (macOS template: адаптируется к меню-бару)
// Запуск: node scripts/gen-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'build')
mkdirSync(outDir, { recursive: true })

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0, 0); return b }
function chunk(type, data) { const body = Buffer.concat([Buffer.from(type, 'ascii'), data]); return Buffer.concat([u32(data.length), body, u32(crc32(body))]) }
function png(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4) }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

// форма «облачко сообщения» в нормализованных координатах [0..1]
function inBubble(nx, ny) {
  // скруглённый прямоугольник (тело)
  const x0 = 0.12, y0 = 0.18, x1 = 0.88, y1 = 0.64, rr = 0.16
  let inRect = false
  if (nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1) {
    const cx = Math.min(Math.max(nx, x0 + rr), x1 - rr)
    const cy = Math.min(Math.max(ny, y0 + rr), y1 - rr)
    inRect = Math.hypot(nx - cx, ny - cy) <= rr
  }
  // хвостик снизу-слева (треугольник)
  const tri = (ax, ay, bx, by, cx, cy) => {
    const d1 = (nx - bx) * (ay - by) - (ax - bx) * (ny - by)
    const d2 = (nx - cx) * (by - cy) - (bx - cx) * (ny - cy)
    const d3 = (nx - ax) * (cy - ay) - (cx - ax) * (ny - ay)
    const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0
    return !(neg && pos)
  }
  const inTail = tri(0.26, 0.58, 0.46, 0.58, 0.28, 0.82)
  return inRect || inTail
}

function bubbleIcon(size, color) {
  const rgba = Buffer.alloc(size * size * 4)
  const S = 3 // суперсэмпл
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let hit = 0
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const nx = (x + (sx + 0.5) / S) / size
      const ny = (y + (sy + 0.5) / S) / size
      if (inBubble(nx, ny)) hit++
    }
    const a = Math.round((hit / (S * S)) * 255)
    const i = (y * size + x) * 4
    rgba[i] = color[0]; rgba[i + 1] = color[1]; rgba[i + 2] = color[2]; rgba[i + 3] = a
  }
  return png(size, size, rgba)
}

const ACCENT = [224, 69, 123] // #e0457b
const BLACK = [0, 0, 0]
writeFileSync(path.join(outDir, 'tray.png'), bubbleIcon(32, ACCENT))
writeFileSync(path.join(outDir, 'tray@2x.png'), bubbleIcon(64, ACCENT))
writeFileSync(path.join(outDir, 'tray-template.png'), bubbleIcon(32, BLACK))
writeFileSync(path.join(outDir, 'tray-template@2x.png'), bubbleIcon(64, BLACK))
console.log('tray icons written to', outDir)

// Генерация иконки трея без внешних зависимостей: рисуем кружок акцентного цвета и
// кодируем PNG вручную (zlib). Запуск: node scripts/gen-icons.mjs → build/tray.png
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
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6 // 8-bit RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4) }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

function circleIcon(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const c = (size - 1) / 2, r = size / 2 - 1
  const col = [224, 69, 123] // var(--accent) #e0457b
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x - c, dy = y - c, dist = Math.hypot(dx, dy)
    let a = 0
    if (dist <= r - 1) a = 255
    else if (dist < r) a = Math.round((r - dist) * 255) // мягкий край (AA)
    const i = (y * size + x) * 4
    rgba[i] = col[0]; rgba[i + 1] = col[1]; rgba[i + 2] = col[2]; rgba[i + 3] = a
  }
  return png(size, size, rgba)
}

writeFileSync(path.join(outDir, 'tray.png'), circleIcon(32))
writeFileSync(path.join(outDir, 'tray@2x.png'), circleIcon(64))
console.log('icons written to', outDir)

/**
 * Generates favicon assets from public/favicon.svg using sharp.
 * Run with: bun run gen:icons
 *
 * Outputs:
 *   src/app/icon.png        — 512×512, Next.js app icon
 *   src/app/apple-icon.png  — 180×180, Apple touch icon
 *   src/app/favicon.ico     — 32×32 PNG wrapped in ICO container
 */

import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svgPath = join(root, 'public', 'favicon.svg')

/** Wrap a PNG buffer in a minimal single-image ICO container. */
function pngToIco(png: Buffer, size: number): Buffer {
  const ICONDIR_SIZE = 6
  const DIRENTRY_SIZE = 16
  const dataOffset = ICONDIR_SIZE + DIRENTRY_SIZE // 22

  const buf = Buffer.alloc(dataOffset + png.length)

  // ICONDIR
  buf.writeUInt16LE(0, 0) // idReserved
  buf.writeUInt16LE(1, 2) // idType: 1 = ICO
  buf.writeUInt16LE(1, 4) // idCount: 1 image

  // ICONDIRENTRY
  buf.writeUInt8(size === 256 ? 0 : size, 6) // bWidth (0 = 256)
  buf.writeUInt8(size === 256 ? 0 : size, 7) // bHeight
  buf.writeUInt8(0, 8)                        // bColorCount (true-color)
  buf.writeUInt8(0, 9)                        // bReserved
  buf.writeUInt16LE(1, 10)                    // wPlanes
  buf.writeUInt16LE(32, 12)                   // wBitCount
  buf.writeUInt32LE(png.length, 14)           // dwBytesInRes
  buf.writeUInt32LE(dataOffset, 18)           // dwImageOffset

  png.copy(buf, dataOffset)
  return buf
}

async function main() {
  const base = sharp(svgPath, { density: 300 })

  // 512×512 — Next.js app icon
  await base.clone().resize(512, 512).png().toFile(join(root, 'src/app/icon.png'))
  console.log('✓ src/app/icon.png (512×512)')

  // 180×180 — Apple touch icon
  await base.clone().resize(180, 180).png().toFile(join(root, 'src/app/apple-icon.png'))
  console.log('✓ src/app/apple-icon.png (180×180)')

  // 32×32 → ICO
  const png32 = await base.clone().resize(32, 32).png().toBuffer()
  writeFileSync(join(root, 'src/app/favicon.ico'), pngToIco(png32, 32))
  console.log('✓ src/app/favicon.ico (32×32)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

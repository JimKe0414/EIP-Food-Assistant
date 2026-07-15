import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const source = fileURLToPath(new URL('../public/icons/app-icon.svg', import.meta.url))
const output = new URL('../public/icons/', import.meta.url)
await mkdir(output, { recursive: true })

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['shortcut-log.png', 96],
  ['shortcut-recommend.png', 96]
]) {
  await sharp(source).resize(size, size).png({ compressionLevel: 9 }).toFile(fileURLToPath(new URL(name, output)))
}

console.log('PWA icons generated')

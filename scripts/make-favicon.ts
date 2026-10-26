import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { faviconImage } from '@/lib/favicon'

/**
 * Writes src/app/favicon.ico: the favicon at 16, 32 and 48 px, each a PNG
 * inside the ICO (browsers have read that since Vista). Browsers ask for
 * /favicon.ico on their own, whatever the page's <link> tags say.
 *
 *   npm run favicon        run from the repo root; commit the result
 *
 * Only needs re-running when src/lib/favicon.tsx changes.
 */
const SIZES = [16, 32, 48]

async function main() {
  const pngs = await Promise.all(SIZES.map(async (n) => Buffer.from(await (await faviconImage(n)).arrayBuffer())))

  // ICONDIR: reserved 0, type 1 (icon), image count. Then one 16-byte entry per image, then the images.
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)

  let offset = header.length + 16 * pngs.length
  const entries = pngs.map((png, i) => {
    const e = Buffer.alloc(16)
    e.writeUInt8(SIZES[i], 0) // width
    e.writeUInt8(SIZES[i], 1) // height
    e.writeUInt16LE(1, 4) // colour planes
    e.writeUInt16LE(32, 6) // bits per pixel
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += png.length
    return e
  })

  const out = join(process.cwd(), 'src/app/favicon.ico')
  await writeFile(out, Buffer.concat([header, ...entries, ...pngs]))
  console.log(`wrote ${out} (${SIZES.join(', ')} px, ${offset} bytes)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

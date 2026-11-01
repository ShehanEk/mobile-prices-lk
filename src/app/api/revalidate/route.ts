import { revalidateTag } from 'next/cache'
import { timingSafeEqual } from 'node:crypto'

/**
 * The only way the site's cache is cleared. GitHub's nightly normalize run
 * (`normalize.yml`) calls it when it finishes; every page and cached read
 * shares the tag `catalog` and has no timer, so without this call the site
 * keeps showing the previous prices.
 */

function authorized(request: Request): boolean {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) return false

  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const a = Buffer.from(token)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Two-argument form: the single-argument `revalidateTag(tag)` is deprecated in Next 16.
  revalidateTag('catalog', 'max')

  return Response.json({ revalidated: 'catalog' })
}

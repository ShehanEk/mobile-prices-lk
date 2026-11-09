import type { MetadataRoute } from 'next'

import { canonical } from '@/lib/site'

/**
 * Every page is crawlable. The main job of this file is to point at the
 * sitemap, which is how the phone pages get discovered in reasonable time.
 *
 * `/api` is disallowed to keep it out of search results, not to protect it — a
 * robots file is a request. What protects the revalidate handler is its token.
 *
 * Googlebot alone also skips the OG image routes (`/opengraph-image`,
 * `/<brand>/opengraph-image`, `/<brand>/<phone>/opengraph-image`): on the
 * sister site they ate crawl budget meant for real pages. Other bots keep them
 * so Facebook, WhatsApp and X link previews still work.
 */
const DISALLOW = ['/api']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: 'Googlebot', allow: '/', disallow: [...DISALLOW, '/*opengraph-image'] },
      { userAgent: '*', allow: '/', disallow: DISALLOW },
    ],
    sitemap: canonical('/sitemap.xml'),
    host: canonical('/').replace(/\/$/, ''),
  }
}

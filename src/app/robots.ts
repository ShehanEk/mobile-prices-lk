import type { MetadataRoute } from 'next'

import { canonical } from '@/lib/site'

/**
 * Every page is crawlable. The main job of this file is to point at the
 * sitemap, which is how the phone pages get discovered in reasonable time.
 *
 * `/api` is disallowed to keep it out of search results, not to protect it — a
 * robots file is a request. What protects the revalidate handler is its token.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api'] },
    sitemap: canonical('/sitemap.xml'),
    host: canonical('/').replace(/\/$/, ''),
  }
}

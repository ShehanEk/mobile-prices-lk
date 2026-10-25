import type { MetadataRoute } from 'next'

import type { PhoneSummary } from '@/lib/prices'
import { canonical } from '@/lib/site'
import { loadDeals, loadDirectory } from '@/queries/phones'

/**
 * Every indexable URL: home, price drops (only while there are any), each
 * brand, each phone. `lastModified` is the day a price was last confirmed,
 * not the build time, so a crawler can come back to the pages that moved.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [directory, deals] = await Promise.all([loadDirectory(), loadDeals()])
  const brands = Object.entries(directory).filter(([, list]) => list.length > 0)
  const newest = (list: PhoneSummary[]) => list.map((p) => p.updatedOn).sort().at(-1)!

  return [
    { url: canonical('/'), lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    ...(deals.length > 0
      ? [{ url: canonical('/deals'), lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 }]
      : []),
    ...brands.map(([slug, list]) => ({
      url: canonical(`/${slug}`),
      lastModified: new Date(newest(list)),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...brands.flatMap(([slug, list]) =>
      list.map((p) => ({
        url: canonical(`/${slug}/${p.phoneId}`),
        lastModified: new Date(p.updatedOn),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      })),
    ),
  ]
}

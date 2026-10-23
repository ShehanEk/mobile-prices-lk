import { createWooScraper } from './woocommerce'

/** celltronics.lk — "Mobile Phones" (term 62). robots.txt allows all.
 * "Company Mobile Phones" (5384) is not taken: it mixes tablets and network gear. */
export const celltronics = createWooScraper({
  shop: 'celltronics.lk',
  baseUrl: 'https://celltronics.lk',
  categoryIds: { phones: { id: 62, label: 'Mobile Phones' } },
})

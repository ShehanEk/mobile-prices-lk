import { createWooScraper } from './woocommerce'

/** idealz.lk — "Smartphones" (term 47). robots.txt allows all. */
export const idealz = createWooScraper({
  shop: 'idealz.lk',
  baseUrl: 'https://idealz.lk',
  categoryIds: { phones: { id: 47, label: 'Smartphones' } },
})

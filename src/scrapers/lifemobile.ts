import { createWooScraper } from './woocommerce'

/** lifemobile.lk — "Mobile Phones" (term 252). robots.txt allows all. */
export const lifemobile = createWooScraper({
  shop: 'lifemobile.lk',
  baseUrl: 'https://lifemobile.lk',
  categoryIds: { phones: { id: 252, label: 'Mobile Phones' } },
})

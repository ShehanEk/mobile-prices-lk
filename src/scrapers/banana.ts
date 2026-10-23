import { createWooScraper } from './woocommerce'

/** banana.lk — "Mobile Phones" (term 225). robots.txt allows all but add-to-cart. */
export const banana = createWooScraper({
  shop: 'banana.lk',
  baseUrl: 'https://banana.lk',
  categoryIds: { phones: { id: 225, label: 'Mobile Phones' } },
})

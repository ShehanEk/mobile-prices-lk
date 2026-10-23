import { createWooScraper } from './woocommerce'

/** geniusmobile.lk — "Smartphones" (term 70). robots.txt allows all. */
export const geniusmobile = createWooScraper({
  shop: 'geniusmobile.lk',
  baseUrl: 'https://www.geniusmobile.lk',
  categoryIds: { phones: { id: 70, label: 'Smartphones' } },
})

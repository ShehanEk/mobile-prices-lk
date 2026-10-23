import { createWooScraper } from './woocommerce'

/** doctormobile.lk — "Mobile Phones" (term 4103). robots.txt allows all.
 * Its pre-owned shelf (7188) sits under 4103 and is dropped by `isNotNew`. */
export const doctormobile = createWooScraper({
  shop: 'doctormobile.lk',
  baseUrl: 'https://doctormobile.lk',
  categoryIds: { phones: { id: 4103, label: 'Mobile Phones' } },
})

import type { PhoneSummary } from './prices'
import { SITE_NAME, canonical } from './site'

const IN_STOCK = 'https://schema.org/InStock'
const OUT_OF_STOCK = 'https://schema.org/OutOfStock'

/**
 * The phone page's Product, or null when no shop has a current price. Google
 * rejects a Product without offers, review or rating, so a page with only
 * stale prices carries just its breadcrumb. No `image`: the share image is
 * drawn on demand and robots keeps Googlebot off it.
 */
export function productJsonLd(phone: PhoneSummary, name: string, path: string) {
  const current = phone.offers.filter((o) => !o.stale)
  if (current.length === 0) return null
  const prices = current.map((o) => o.priceLkr)

  return {
    '@type': 'Product',
    name,
    url: canonical(path),
    category: 'Mobile phone',
    brand: { '@type': 'Brand', name: phone.brand },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'LKR',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: current.length,
      availability: phone.inStockShops > 0 ? IN_STOCK : OUT_OF_STOCK,
      offers: current.map((o) => ({
        '@type': 'Offer',
        price: o.priceLkr,
        priceCurrency: 'LKR',
        url: o.url,
        availability: o.inStock ? IN_STOCK : OUT_OF_STOCK,
        seller: { '@type': 'Organization', name: o.shop },
      })),
    },
  }
}

/** The home page's WebSite and Organization: Google reads the site name from these. */
export function siteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': canonical('/#website'),
        name: SITE_NAME,
        alternateName: 'Mobile Prices LK',
        url: canonical('/'),
        inLanguage: 'en-LK',
        publisher: { '@id': canonical('/#organization') },
      },
      {
        '@type': 'Organization',
        '@id': canonical('/#organization'),
        name: SITE_NAME,
        url: canonical('/'),
        logo: canonical('/apple-icon'),
      },
    ],
  }
}

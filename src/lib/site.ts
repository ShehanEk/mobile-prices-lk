import { BRANDS, slug } from '@/normalize/phone'

/**
 * Site identity, used by metadata, canonical URLs, the sitemap and JSON-LD.
 *
 * The absolute origin has to be known at build time, because canonical URLs
 * and sitemap entries cannot be relative. On Vercel the production domain is
 * supplied automatically; set NEXT_PUBLIC_SITE_URL once mobileprices.lk points
 * at it (phase 4), or every canonical keeps the vercel.app host.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')
).replace(/\/$/, '')

export const SITE_NAME = 'MobilePrices.lk'

export const canonical = (path: string) => `${SITE_URL}${path}`

/**
 * The six launch shops, in the canvas order. Keep in step with
 * `src/scrapers/index.ts`: the footer tells visitors these are the shops we
 * cover.
 */
export const TRACKED_SHOPS = [
  'lifemobile.lk',
  'celltronics.lk',
  'geniusmobile.lk',
  'banana.lk',
  'idealz.lk',
  'doctormobile.lk',
] as const

/** A brand is also its URL: /samsung, /oneplus, /oppo. */
const BY_SLUG = new Map(BRANDS.map((b) => [slug(b), b]))

/** Every in-scope brand's slug, in the canonical brand order. */
export const BRAND_SLUGS: string[] = [...BY_SLUG.keys()]

export const brandFromSlug = (value: string): string | null => BY_SLUG.get(value) ?? null

/**
 * Pale tint and darker ink per brand, for tiles and the brand page band. The
 * first eight are the canvas's; the canvas has none for the other eight, which
 * reuse them in the same order. Brands are text, never logos (decisions,
 * 2026-10-23).
 */
const TINTS: [tint: string, ink: string][] = [
  ['#EEF1F5', '#1A1F2B'], // Apple
  ['#E9EEFF', '#3B55C9'], // Samsung
  ['#FDEDE1', '#A4511F'], // Xiaomi
  ['#F5E9FB', '#8A3BA8'], // Honor
  ['#FDE9E6', '#B23A30'], // Huawei
  ['#E3F5EC', '#1E7A55'], // OPPO
  ['#E1F3F8', '#1D6F86'], // vivo
  ['#FCF0DC', '#8C5E1A'], // realme
]

export function brandStyle(brand: string): { tint: string; ink: string } {
  const [tint, ink] = TINTS[Math.max(0, BRANDS.indexOf(brand)) % TINTS.length]
  return { tint, ink }
}

/** The home page's "Latest flagships", in card order; edited by hand when new flagships launch. */
export const FLAGSHIPS = [
  { brand: 'Apple', model: 'iPhone 17 Pro Max' },
  { brand: 'Apple', model: 'iPhone 17 Pro' },
  { brand: 'Apple', model: 'iPhone 17' },
  { brand: 'Samsung', model: 'Galaxy S26 Ultra' },
  { brand: 'Samsung', model: 'Galaxy S26' },
  { brand: 'Samsung', model: 'Galaxy Z Fold 7' },
  { brand: 'Google', model: 'Pixel 10 Pro' },
  { brand: 'Google', model: 'Pixel 10' },
] as const

/** "Samsung Galaxy S26 Ultra": the name people search for. */
export const phoneName = (p: { brand: string; model: string }) => `${p.brand} ${p.model}`

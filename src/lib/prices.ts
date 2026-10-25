import type { Warranty } from '@/db/schema'

/**
 * The price rules, in one pure module the pages, the share images and the
 * tests all read.
 *
 * - Cheapest overall: any warranty class, `unstated` included.
 * - With company warranty: `company` or `apple` (Apple's own counts).
 * - A listing not seen for more than STALE_AFTER_DAYS is shown "last seen" and
 *   never holds a headline, as on PCPrice.lk.
 * - In stock beats out of stock for a headline; out of stock holds one only
 *   when nothing current is in stock.
 */

/** How old a listing may be before its price is presented as last-seen. */
export const STALE_AFTER_DAYS = 7

export type Offer = {
  shop: string
  warranty: Warranty
  /** The shop's own warranty wording, or null when it states none. */
  warrantyText: string | null
  priceLkr: number
  url: string
  inStock: boolean
  /** ISO timestamp of the scrape that saw this price. */
  seenAt: string
  /** Sri Lanka date of `seenAt`, YYYY-MM-DD. */
  seenOn: string
  stale: boolean
}

/** A `listings` row as Drizzle returns it (`numeric` comes back as a string). */
export type ListingRow = {
  shop: string
  warranty: Warranty
  warrantyText: string | null
  priceLkr: string | number
  url: string
  inStock: boolean
  scrapedAt: Date | string
}

export type PhoneRow = {
  phoneId: string
  brand: string
  model: string
  ramGb: number | null
  storageGb: number
  esimOnly: boolean
}

/** A phone configuration with its offers and headline prices, as every page reads it. */
export type PhoneSummary = PhoneRow & {
  brandSlug: string
  /** In `sortOffers` order. */
  offers: Offer[]
  overall: Offer | null
  company: Offer | null
  /** Distinct shops listing it. */
  shops: number
  /** Distinct shops with a current, in-stock price. */
  inStockShops: number
  /** Newest `seenOn`, for the sitemap. */
  updatedOn: string
  /** Newest `seenAt`, for "Checked 25 Oct at 03:00". */
  checkedAt: string
}

export type Headlines = { overall: Offer | null; company: Offer | null }

/** One day of the 90-day chart: lowest in-stock price, any warranty and company warranty. */
export type HistoryPoint = { day: string; anyLkr: number; companyLkr: number | null }

/** One day's lowest in-stock price, any warranty: what price drops are judged on. */
export type PricePoint = { day: string; lowestLkr: number }

const colomboDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Colombo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const colomboDay = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', day: 'numeric', month: 'short' })
const colomboTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** The calendar day in Sri Lanka, which is what `price_history.recorded_on` holds. */
export const sriLankaDate = (d: Date) => colomboDate.format(d)

/** "25 Oct at 03:00", Sri Lanka time. */
export const checkedLabel = (iso: string) => `${colomboDay.format(new Date(iso))} at ${colomboTime.format(new Date(iso))}`

export function toOffer(row: ListingRow, now: Date): Offer {
  const seen = row.scrapedAt instanceof Date ? row.scrapedAt : new Date(row.scrapedAt)
  return {
    shop: row.shop,
    warranty: row.warranty,
    warrantyText: row.warrantyText?.trim() || null,
    priceLkr: Number(row.priceLkr),
    url: row.url,
    inStock: row.inStock,
    seenAt: seen.toISOString(),
    seenOn: sriLankaDate(seen),
    stale: seen.getTime() < now.getTime() - STALE_AFTER_DAYS * 86_400_000,
  }
}

export const isCompany = (w: Warranty) => w === 'company' || w === 'apple'

const rank = (o: Offer) => (o.stale ? 2 : o.inStock ? 0 : 1)

/** In stock, then out of stock, then last seen; cheapest first within each. */
export function sortOffers(offers: Offer[]): Offer[] {
  return [...offers].sort((a, b) => rank(a) - rank(b) || a.priceLkr - b.priceLkr)
}

export function headlines(offers: Offer[]): Headlines {
  const current = sortOffers(offers.filter((o) => !o.stale))
  return { overall: current[0] ?? null, company: current.find((o) => isCompany(o.warranty)) ?? null }
}

/** Every current price, out of stock included ("6 shops · Rs 339,900 to Rs 389,900"). */
export function priceRange(offers: Offer[]): { low: number; high: number } | null {
  const prices = offers.filter((o) => !o.stale).map((o) => o.priceLkr)
  return prices.length ? { low: Math.min(...prices), high: Math.max(...prices) } : null
}

/** `offers` must not be empty: a phone with no listing has no page. */
export function summarisePhone(phone: PhoneRow, brandSlug: string, offers: Offer[]): PhoneSummary {
  const sorted = sortOffers(offers)
  const { overall, company } = headlines(sorted)
  const newest = sorted.reduce((a, b) => (a.seenAt >= b.seenAt ? a : b))
  return {
    phoneId: phone.phoneId,
    brand: phone.brand,
    model: phone.model,
    ramGb: phone.ramGb,
    storageGb: phone.storageGb,
    esimOnly: phone.esimOnly,
    brandSlug,
    offers: sorted,
    overall,
    company,
    shops: new Set(sorted.map((o) => o.shop)).size,
    inStockShops: new Set(sorted.filter((o) => o.inStock && !o.stale).map((o) => o.shop)).size,
    updatedOn: newest.seenOn,
    checkedAt: newest.seenAt,
  }
}

export const sizeLabel = (gb: number) => (gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`)

/** "12 GB · 256 GB", "16 GB · 1 TB", Apple "256 GB" or "256 GB · eSIM". */
export function configLabel(p: { ramGb: number | null; storageGb: number; esimOnly: boolean }): string {
  return [p.ramGb !== null ? `${p.ramGb} GB` : null, sizeLabel(p.storageGb), p.esimOnly ? 'eSIM' : null]
    .filter(Boolean)
    .join(' · ')
}

export const rupees = (n: number) => `Rs ${Math.round(n).toLocaleString('en-LK')}`

/** The badge on each price. Apple's own warranty is named, in the company colour. */
export const WARRANTY_BADGE: Record<Warranty, string> = {
  company: 'Company',
  apple: 'Apple warranty',
  shop: 'Shop',
  unstated: 'Not stated',
}

/** The same, in running text: "doctormobile.lk · shop warranty". */
export const WARRANTY_PHRASE: Record<Warranty, string> = {
  company: 'company warranty',
  apple: 'Apple warranty',
  shop: 'shop warranty',
  unstated: 'warranty not stated',
}

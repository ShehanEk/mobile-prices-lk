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

export type Headlines<T = Offer> = { overall: T | null; company: T | null }

/** What `sortOffers` reads, so the brand-page cards can use it on their slimmer rows. */
type RankedOffer = Pick<Offer, 'priceLkr' | 'inStock' | 'stale'>

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

/** "25 Oct", Sri Lanka time. */
export const dayLabel = (iso: string) => colomboDay.format(new Date(iso))

/** "25 Oct at 03:00", Sri Lanka time. */
export const checkedLabel = (iso: string) => `${dayLabel(iso)} at ${colomboTime.format(new Date(iso))}`

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

const rank = (o: RankedOffer) => (o.stale ? 2 : o.inStock ? 0 : 1)

/** In stock, then out of stock, then last seen; cheapest first within each. */
export function sortOffers<T extends RankedOffer>(offers: T[]): T[] {
  return [...offers].sort((a, b) => rank(a) - rank(b) || a.priceLkr - b.priceLkr)
}

export function headlines<T extends RankedOffer & Pick<Offer, 'warranty'>>(offers: T[]): Headlines<T> {
  const current = sortOffers(offers.filter((o) => !o.stale))
  return { overall: current[0] ?? null, company: current.find((o) => isCompany(o.warranty)) ?? null }
}

/** What a brand-page card says about its price: current and in stock, current but out of stock, or only old listings. */
export type CardStanding = { kind: 'stock' } | { kind: 'out' } | { kind: 'seen'; on: string }

/**
 * What a brand-page card shows for the offers still allowed by its filters:
 * the headline rule of the phone page, so a card never disagrees with it. With
 * nothing current, the cheapest old offer is shown, last seen on its own date.
 * `company` is the phone page's company offer, so it may be out of stock.
 */
export function cardPrices<T extends RankedOffer & Pick<Offer, 'warranty' | 'seenAt'>>(
  offers: T[],
): { overall: T; company: T | null; standing: CardStanding } | null {
  const { overall, company } = headlines(offers)
  if (overall) return { overall, company, standing: overall.inStock ? { kind: 'stock' } : { kind: 'out' } }
  const [oldest] = sortOffers(offers)
  return oldest ? { overall: oldest, company: null, standing: { kind: 'seen', on: dayLabel(oldest.seenAt) } } : null
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

/** One "Latest flagships" card: a model at its cheapest current configuration. */
export type FlagshipCard = {
  brand: string
  model: string
  brandSlug: string
  /** The configuration holding `priceLkr`, which the card links to. */
  phoneId: string
  priceLkr: number
  /** "3 configurations", or the one configuration's label. */
  configs: string
  /** True when the configuration shown is eSIM only. */
  esimOnly: boolean
  /** Distinct shops with it in stock now, on any configuration. */
  shops: number
  /** "3 shops", or "Out of stock" when no shop has it in stock. */
  shopsLabel: string
}

/**
 * The home page's flagship cards, in `list` order. A model's price is the best
 * headline across its configurations (in stock beats out of stock, stale never
 * counts); a model with no current price is left out. Configurations and shops
 * are counted the same way: only those with a current price, and in stock.
 */
export function flagshipCards(phones: PhoneSummary[], list: readonly { brand: string; model: string }[]): FlagshipCard[] {
  return list.flatMap(({ brand, model }) => {
    const live = phones.filter((p) => p.brand === brand && p.model === model && p.overall)
    const [best] = [...live].sort((a, b) => Number(!a.overall!.inStock) - Number(!b.overall!.inStock) || a.overall!.priceLkr - b.overall!.priceLkr)
    if (!best) return []
    const shops = new Set(live.flatMap((p) => p.offers.filter((o) => o.inStock && !o.stale).map((o) => o.shop))).size
    return [
      {
        brand,
        model,
        brandSlug: best.brandSlug,
        phoneId: best.phoneId,
        priceLkr: best.overall!.priceLkr,
        configs: live.length === 1 ? configLabel(best) : `${live.length} configurations`,
        esimOnly: best.esimOnly,
        shops,
        shopsLabel: shops === 0 ? 'Out of stock' : `${shops} ${shops === 1 ? 'shop' : 'shops'}`,
      },
    ]
  })
}

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

/** Equal by what a shopper sees; the cache returns copies, so never compare offers by identity. */
const sameOffer = (a: Offer, b: Offer) => a.shop === b.shop && a.warranty === b.warranty && a.priceLkr === b.priceLkr

/**
 * The meta description for a phone page, kept under the ~155 characters Google
 * shows: the name and the lead always go in, the rest only while it fits.
 * `lead` is also the share-card description.
 */
export function phoneDescription(
  name: string,
  phone: Pick<PhoneSummary, 'overall' | 'company' | 'shops'>,
): { description: string; lead: string } {
  const { overall, company, shops } = phone
  const lead = overall
    ? `from ${rupees(overall.priceLkr)} at ${overall.shop} (${WARRANTY_PHRASE[overall.warranty]}).`
    : 'no price confirmed this week; last seen prices listed.'

  let description = `${name} price in Sri Lanka: ${lead}`
  for (const piece of [
    company && !(overall && sameOffer(company, overall)) ? `With company warranty from ${rupees(company.priceLkr)}.` : '',
    `${shops} ${shops === 1 ? 'shop' : 'shops'} compared, updated daily.`,
  ]) {
    if (piece && description.length + 1 + piece.length <= 155) description += ` ${piece}`
  }
  return { description, lead }
}

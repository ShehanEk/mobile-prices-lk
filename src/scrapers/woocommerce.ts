import { politeGet } from '@/lib/http'

import type { Category, ScrapeOptions, ScrapedRow, Scraper } from './types'

/**
 * The phone shops listed in `src/scrapers/index.ts` run WordPress +
 * WooCommerce, so they share this fetch flow over the WooCommerce Store API:
 * public, JSON, and carrying the product's own attribute table alongside price
 * and stock. No HTML parsing.
 *
 * The Store API is the storefront's own read endpoint. No shop's robots.txt
 * disallows it (see docs/retailers.md).
 *
 * Request pattern, all through `politeGet`, one at a time:
 *   1. `products?category=<id>&per_page=100&page=N`, until a short page.
 *   2. For that page's variable products, one batched
 *      `products?type=variation&parent=<id,id,...>&per_page=100&page=N`
 *      (again until a short page) instead of one request per variation. The
 *      variations come back with their own price and stock; the product's
 *      `variations` list (via `variantGroups`) still decides the grouping.
 *   3. A 403 or 429 on any request throws: the shop is rate-limiting or
 *      challenging us, and we stop rather than push through it.
 */

export type WooCategoryId = { id: number; label: string }

export type WooConfig = {
  shop: string
  baseUrl: string
  /** Canonical category → WooCommerce term id, or several. */
  categoryIds: Partial<Record<Category, WooCategoryId | WooCategoryId[]>>
  /**
   * The attribute holding the brand, for shops whose product names leave it
   * out ("Galaxy A18" with "Brand: Samsung" beside it). The brand is put in
   * front of the title when the name does not already contain it.
   */
  brandAttribute?: string
}

const PER_PAGE = 100

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  times: '×',
  hellip: '…',
}

/**
 * WordPress returns product names HTML-encoded, and JSON does not decode them.
 *
 * An HTML scraper gets this for free from its parser. Here the entity survives
 * into the title, and from there into the product id: "Galaxy A56 &#8211; 5G"
 * would mint an id with "8211" in it, as though it were part of the model name.
 */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name) => NAMED_ENTITIES[name.toLowerCase()] ?? whole)
}

/**
 * Conditions that are not new stock, however the shop has filed them: a lower
 * price for a different condition, with no way to say so on the row.
 */
const NOT_NEW = /\b(open[\s-]*box|used|refurb(?:ished)?|pre[\s-]*owned|b[\s-]*grade)\b/i

export type StoreProduct = {
  id: number
  name: string
  permalink: string
  type?: string
  sku?: string
  short_description?: string
  prices?: {
    price?: string
    regular_price?: string
    currency_code?: string
    currency_minor_unit?: number
  }
  /** On a variation: the id of its variable product. */
  parent?: number
  is_purchasable?: boolean
  is_in_stock?: boolean
  is_on_backorder?: boolean
  stock_availability?: { text?: string }
  images?: { src?: string }[]
  categories?: { name?: string; slug?: string }[]
  attributes?: { name?: string; terms?: { name?: string; slug?: string }[] }[]
  variations?: { id: number; attributes?: { name?: string; value?: string }[] }[]
}

export type VariantGroup = { attrs: Record<string, string>; variationIds: number[] }

const COLOUR = /colou?r/i
const WARRANTY = /warrant/i

/**
 * Store API prices are integer minor units as a string: "168050000" with
 * `currency_minor_unit: 2` is 1,680,500.00 LKR. Reading the field as a number
 * without dividing would have made every price a hundred times too large.
 */
export function toRupees(
  raw: string | undefined,
  minorUnit: number | undefined,
): number | null {
  if (!raw) return null
  const value = Number(raw)
  if (!Number.isFinite(value)) return null
  const places = Number.isFinite(minorUnit) ? (minorUnit as number) : 2
  return value / 10 ** places
}

/** The product's own attribute table, flattened for the payload. */
function toSpecs(product: StoreProduct): Record<string, string> | undefined {
  const specs: Record<string, string> = {}
  for (const attribute of product.attributes ?? []) {
    const label = attribute.name ? decodeEntities(attribute.name).trim() : ''
    const value = (attribute.terms ?? [])
      .map((t) => (t.name ? decodeEntities(t.name).trim() : ''))
      .filter(Boolean)
      .join(', ')
    if (label && value) specs[label] = value
  }
  // Shops that put the warranty in the short description (geniusmobile.lk) are
  // read from here by `warrantyText`; the raw text is kept as a spec too.
  const warranty = product.short_description
    ? decodeEntities(product.short_description.replace(/<[^>]*>/g, '')).trim()
    : ''
  if (warranty) specs['Short description'] = warranty

  return Object.keys(specs).length > 0 ? specs : undefined
}

/**
 * A variable product's variations, grouped by every choice except colour.
 *
 * Phone shops list one product per model with storage, colour and warranty as
 * options, each priced on its own; the product's headline price is only the
 * cheapest option (idealz.lk shows 0). Colours share a price and merge, so one
 * group is one row. Variation values are slugs ("3gb-32gb"), mapped back to
 * the shop's own wording through the product's attribute terms.
 */
export function variantGroups(product: StoreProduct): VariantGroup[] {
  const termName = (attribute: string, slug: string) => {
    const term = product.attributes
      ?.find((a) => a.name === attribute)
      ?.terms?.find((t) => t.slug === slug)
    return term?.name ? decodeEntities(term.name).trim() : slug
  }

  const groups = new Map<string, VariantGroup>()
  for (const variation of product.variations ?? []) {
    const attrs: Record<string, string> = {}
    for (const a of variation.attributes ?? []) {
      if (!a.name || COLOUR.test(a.name)) continue
      attrs[decodeEntities(a.name).trim()] = a.value ? termName(a.name, a.value) : ''
    }
    const key = JSON.stringify(Object.entries(attrs).sort())
    const group = groups.get(key) ?? { attrs, variationIds: [] }
    group.variationIds.push(variation.id)
    groups.set(key, group)
  }
  return [...groups.values()]
}

/** The product name plus its options, warranty left out: "KXD A07 3GB / 32GB". */
export function variantTitle(name: string, attrs: Record<string, string>): string {
  const options = Object.entries(attrs)
    .filter(([label, value]) => value && !WARRANTY.test(label))
    .map(([, value]) => value)
  return [name, ...options].join(' ')
}

/**
 * The warranty as the shop words it: the chosen option, else the product's
 * warranty attribute, else the sentence in its short description that names
 * one. Classified in normalize (phase 2), never here.
 */
export function warrantyText(product: StoreProduct, attrs: Record<string, string> = {}): string | null {
  const chosen = Object.entries(attrs).find(([label]) => WARRANTY.test(label))?.[1]
  if (chosen) return chosen

  const attribute = product.attributes
    ?.find((a) => a.name && WARRANTY.test(a.name))
    ?.terms?.map((t) => (t.name ? decodeEntities(t.name).trim() : ''))
    .filter(Boolean)
    .join(', ')
  if (attribute) return attribute

  const text = product.short_description
    ? decodeEntities(product.short_description.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ')
    : ''
  const match = text.match(/[^|]{0,40}\bwarrant\w*[^|]{0,40}/i)
  return match ? match[0].trim() : null
}

/** Used, pre-owned or open-box, by its name or by the shelf it sits on. */
export function isNotNew(product: StoreProduct): boolean {
  if (NOT_NEW.test(product.name)) return true
  return (product.categories ?? []).some((c) => NOT_NEW.test(`${c.name ?? ''} ${c.slug ?? ''}`))
}

// `is_in_stock` can be true for backordered items too ("Available on
// backorder" while flagged in stock). Taking the flag at face value would
// advertise same-day availability for phones that have to be ordered in.
const onBackorder = (p: StoreProduct) =>
  p.is_on_backorder === true || /backorder/i.test(p.stock_availability?.text ?? '')
const buyable = (p: StoreProduct) => p.is_in_stock === true && !onBackorder(p)
const hasPrice = (p: StoreProduct) => typeof p.prices?.price === 'string' && p.prices.price !== ''

/**
 * A parsed variation is trusted only if it is an object with a numeric id. A
 * `null` body, or an error object such as `{ code, message }`, is not one.
 */
export function isUsableVariation(value: unknown): value is StoreProduct {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'number'
  )
}

/**
 * The variation that prices a group: the first buyable one that has a price
 * (colours share a price, so one is enough), else the first with a price.
 * Null when none is usable.
 */
export function pickPriced(candidates: unknown[]): StoreProduct | null {
  const priced = candidates.filter(isUsableVariation).filter(hasPrice)
  return priced.find(buyable) ?? priced[0] ?? null
}

/** More than 10% of variable groups unpriced (judged only from 10 groups up) fails the shop. */
export function failedGroupsExceeded(failed: number, attempted: number): boolean {
  return attempted >= 10 && failed / attempted > 0.1
}

/**
 * A 403 or 429 means the shop is challenging or rate-limiting us. Stop the
 * shop (the run records a failure) rather than carry on to the next request.
 */
export function assertNotBlocked(shop: string, status: number, url: string): void {
  if (status === 403 || status === 429) {
    throw new Error(`${shop}: HTTP ${status} on ${url}, stopping (blocked or rate-limited)`)
  }
}

export function createWooScraper(config: WooConfig): Scraper {
  const api = `${config.baseUrl}/wp-json/wc/store/v1/products`
  const categories = Object.keys(config.categoryIds) as Category[]

  /** One row: the product's identity, priced from itself or one variation. */
  function toRow(
    product: StoreProduct,
    priced: StoreProduct,
    title: string,
    attrs: Record<string, string>,
    category: Category,
    meta: WooCategoryId,
    specs: Record<string, string> | undefined,
    brand: string | undefined,
  ): ScrapedRow {
    const priceLkr = toRupees(priced.prices?.price, priced.prices?.currency_minor_unit)
    return {
      shop: config.shop,
      sourceUrl: product.permalink,
      rawTitle: variantTitle(title, attrs),
      rawPriceText:
        priced.prices?.price != null ? `${priced.prices.currency_code ?? 'LKR'} ${priceLkr ?? ''}` : null,
      payload: {
        category,
        retailerCategory:
          product.categories
            ?.map((c) => (c.name ? decodeEntities(c.name) : c.slug))
            .filter(Boolean)
            .join(', ') || meta.label,
        externalId: String(priced.id),
        productId: String(product.id),
        // A variable product with no variations still looks like a simple one,
        // with a headline price that is often 0; phase 2 tells them apart here.
        productType: product.type ?? null,
        purchasable: priced.is_purchasable ?? null,
        // The variation's own page link, which carries its option choices.
        variationUrl:
          priced.permalink && priced.permalink !== product.permalink ? priced.permalink : null,
        brand: brand ?? null,
        priceLkr,
        listPriceLkr: toRupees(priced.prices?.regular_price, priced.prices?.currency_minor_unit),
        inStock: buyable(priced),
        preOrder: onBackorder(priced),
        imageUrl: product.images?.[0]?.src ?? null,
        sku: priced.sku || product.sku || null,
        stockText: priced.stock_availability?.text ?? null,
        variant: attrs,
        warrantyText: warrantyText(product, attrs),
        specs,
      },
    }
  }

  return {
    shop: config.shop,
    baseUrl: config.baseUrl,
    categories,

    async scrape(opts: ScrapeOptions = {}) {
      const log = opts.log ?? (() => {})
      const wanted = opts.categories?.length ? opts.categories : categories
      const rows: ScrapedRow[] = []

      // Variable-product groups across the whole shop, for the failure gate.
      let attemptedGroups = 0
      let failedGroups = 0

      /** Every request goes through here: a 403 or 429 stops the shop. */
      const get = async (url: string) => {
        const res = await politeGet(url)
        assertNotBlocked(config.shop, res.status, url)
        return res
      }

      /**
       * All variations of the given products, by id: one request per 100
       * variations rather than one per variation. Colours are kept, since the
       * product's own variation list says which ids belong to which group.
       */
      const fetchVariations = async (parentIds: number[]): Promise<Map<number, StoreProduct>> => {
        const byId = new Map<number, StoreProduct>()
        for (let page = 1; ; page++) {
          const url = `${api}?type=variation&parent=${parentIds.join(',')}&per_page=${PER_PAGE}&page=${page}`
          const res = await get(url)
          if (res.status !== 200) {
            log(`  HTTP ${res.status} fetching variations (page ${page}), groups left unpriced`)
            break
          }
          let batch: unknown[]
          try {
            const parsed: unknown = JSON.parse(res.body)
            batch = Array.isArray(parsed) ? parsed : []
          } catch {
            log(`  variations page ${page} was not JSON, groups left unpriced`)
            break
          }
          const before = byId.size
          for (const v of batch) if (isUsableVariation(v)) byId.set(v.id, v)
          // A short page ends it; a page that adds nothing new guards against a
          // server that ignores `page`.
          if (batch.length < PER_PAGE || byId.size === before) break
        }
        return byId
      }

      for (const category of wanted) {
        for (const meta of [config.categoryIds[category] ?? []].flat()) {
          const found: ScrapedRow[] = []
          const maxPages = opts.maxPages ?? Infinity
          const cap = opts.maxProducts ?? Infinity
          let page = 1

          // The Store API reports totals in headers the fetch helper does not
          // surface, so pagination stops on a short page instead.
          while (page <= maxPages) {
            const url = `${api}?category=${meta.id}&per_page=${PER_PAGE}&page=${page}`
            const res = await get(url)
            if (res.status !== 200) {
              log(`  ${category}: HTTP ${res.status} on page ${page}, stopping`)
              break
            }

            let batch: StoreProduct[]
            try {
              const parsed: unknown = JSON.parse(res.body)
              batch = Array.isArray(parsed) ? (parsed as StoreProduct[]) : []
            } catch {
              log(`  ${category}: page ${page} was not JSON, stopping`)
              break
            }

            // Pick this page's products first, so the variations of all of
            // them can be fetched together. Stop picking once the cap is
            // covered, so a capped run does not fetch what it will not use.
            const picked: {
              product: StoreProduct
              title: string
              specs: Record<string, string> | undefined
              brand: string | undefined
              groups: VariantGroup[]
            }[] = []
            let expectedRows = 0
            for (const product of batch) {
              if (found.length + expectedRows >= cap) break
              const name = product.name ? decodeEntities(product.name).trim() : ''
              if (!name || isNotNew(product)) continue

              const specs = toSpecs(product)
              const brand = config.brandAttribute ? specs?.[config.brandAttribute] : undefined
              const title =
                brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name
              const groups = product.type === 'variable' ? variantGroups(product) : []
              picked.push({ product, title, specs, brand, groups })
              expectedRows += Math.max(1, groups.length)
            }

            const parentIds = picked.filter((p) => p.groups.length > 0).map((p) => p.product.id)
            const variations = parentIds.length > 0 ? await fetchVariations(parentIds) : new Map<number, StoreProduct>()

            for (const { product, title, specs, brand, groups } of picked) {
              if (groups.length === 0) {
                if (found.length < cap) found.push(toRow(product, product, title, {}, category, meta, specs, brand))
                continue
              }

              for (const group of groups) {
                if (found.length >= cap) break
                attemptedGroups++
                const priced = pickPriced(group.variationIds.map((id) => variations.get(id)))
                if (!priced) {
                  failedGroups++
                  log(`  ${config.shop}: no usable variation for "${title}" ${JSON.stringify(group.attrs)}`)
                  continue
                }
                found.push(toRow(product, priced, title, group.attrs, category, meta, specs, brand))
              }
            }

            if (found.length >= cap || batch.length < PER_PAGE) break
            page++
          }

          rows.push(...found)
          log(`  ${category} (${meta.label}): ${found.length} rows`)
        }
      }

      if (failedGroupsExceeded(failedGroups, attemptedGroups)) {
        throw new Error(
          `${config.shop}: ${failedGroups} of ${attemptedGroups} variable groups had no usable variation (over 10%), failing the shop`,
        )
      }

      return rows
    },
  }
}

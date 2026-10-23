import { politeGet } from '@/lib/http'

import type { Category, ScrapeOptions, ScrapedRow, Scraper } from './types'

/**
 * The phone shops listed in `src/scrapers/index.ts` run WordPress +
 * WooCommerce, so they share this fetch flow over the WooCommerce Store API:
 * public, JSON, and carrying the product's own attribute table alongside price
 * and stock. No HTML parsing.
 *
 * The Store API is the storefront's own read endpoint. No shop's robots.txt
 * disallows it (check `per_page`; see docs/status.md).
 */

export type WooCategoryId = { id: number; label: string }

export type WooConfig = {
  shop: string
  baseUrl: string
  /** Canonical category → WooCommerce term id, or several. */
  categoryIds: Partial<Record<Category, WooCategoryId | WooCategoryId[]>>
  /**
   * The attribute holding the brand, for shops whose product names leave it
   * out: tecroot.lk lists "Pro B760M-P DDR4" with "Brands: MSI" beside it. The
   * brand is put in front of the title, because every extractor reads the
   * brand from there.
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
 * The other scrapers get this for free because they parse markup with cheerio.
 * Here the entity survives into the title, and from there into the part id: two
 * colours of "Corsair 3200D RS ARGB Mid-Tower Case &#8211; White" both minted
 * `corsair-3200d-rs-8211-atx`, with the numeric entity sitting in the id as
 * though it were part of the model name.
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
  // pcbuilders consistently puts the warranty here ("3 YEARS WARRANTY"). Nothing
  // reads it yet.
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

export function createWooScraper(config: WooConfig): Scraper {
  const api = `${config.baseUrl}/wp-json/wc/store/v1/products`
  const categories = Object.keys(config.categoryIds) as Category[]

  // `is_in_stock` is true for backordered items too — over half of
  // pcbuilders' graphics cards are "Available on backorder" while flagged in
  // stock. Taking the flag at face value would have advertised same-day
  // availability for parts that have to be ordered in.
  const onBackorder = (p: StoreProduct) =>
    p.is_on_backorder === true || /backorder/i.test(p.stock_availability?.text ?? '')
  const buyable = (p: StoreProduct) => p.is_in_stock === true && !onBackorder(p)

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
            const res = await politeGet(url)
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

            for (const product of batch) {
              if (found.length >= cap) break
              const name = product.name ? decodeEntities(product.name).trim() : ''
              if (!name || isNotNew(product)) continue

              const specs = toSpecs(product)
              const brand = config.brandAttribute ? specs?.[config.brandAttribute] : undefined
              const title =
                brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name

              const groups = product.type === 'variable' ? variantGroups(product) : []
              if (groups.length === 0) {
                found.push(toRow(product, product, title, {}, category, meta, specs, brand))
                continue
              }

              for (const group of groups) {
                if (found.length >= cap) break
                let priced: StoreProduct | null = null
                for (const id of group.variationIds) {
                  const res = await politeGet(`${api}/${id}`)
                  if (res.status !== 200) continue
                  try {
                    priced = JSON.parse(res.body) as StoreProduct
                  } catch {
                    continue
                  }
                  // One buyable colour is enough: colours share a price.
                  if (buyable(priced)) break
                }
                if (priced) found.push(toRow(product, priced, title, group.attrs, category, meta, specs, brand))
              }
            }

            if (found.length >= cap || batch.length < PER_PAGE) break
            page++
          }

          rows.push(...found)
          log(`  ${category} (${meta.label}): ${found.length} rows`)
        }
      }

      return rows
    },
  }
}

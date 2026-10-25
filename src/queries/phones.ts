import { unstable_cache } from 'next/cache'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'

import { getDb } from '@/db'
import { listings, phoneSpecs, phones, priceHistory } from '@/db/schema'
import { findDeals, type Deal } from '@/lib/deals'
import { summarisePhone, toOffer, type HistoryPoint, type Offer, type PhoneSummary, type PricePoint } from '@/lib/prices'
import { BRAND_SLUGS, brandFromSlug } from '@/lib/site'

/**
 * The catalogue as the pages read it.
 *
 * Cached one entry per brand from day one. A single entry for every phone grows
 * toward the 2 MB Next.js allows per entry, and over the limit the write fails
 * silently and the old entry keeps being served: the bug that froze PCPrice.lk's
 * prices. Every entry shares the tag `catalog`, which /api/revalidate clears
 * after the nightly run; otherwise entries expire after 30 minutes.
 *
 * Each `read*` is the uncached query; each `load*` is its cached twin.
 */

const CACHE = { revalidate: 1800, tags: ['catalog'] }

export type Directory = Record<string, PhoneSummary[]>

export async function readBrand(brandSlug: string): Promise<PhoneSummary[]> {
  const brand = brandFromSlug(brandSlug)
  if (!brand) return []

  const db = getDb()
  const ofBrand = db.select({ phoneId: phones.phoneId }).from(phones).where(eq(phones.brand, brand))
  const [rows, offerRows] = await Promise.all([
    db.select().from(phones).where(eq(phones.brand, brand)),
    db.select().from(listings).where(inArray(listings.phoneId, ofBrand)),
  ])

  const now = new Date()
  const byPhone = new Map<string, Offer[]>()
  for (const l of offerRows) {
    const list = byPhone.get(l.phoneId)
    if (list) list.push(toOffer(l, now))
    else byPhone.set(l.phoneId, [toOffer(l, now)])
  }

  // A phone with no listing has no page.
  const out = rows.flatMap((p) => {
    const offers = byPhone.get(p.phoneId)
    return offers?.length ? [summarisePhone(p, brandSlug, offers)] : []
  })

  // Buyable first, then cheapest: the question is where to buy.
  const price = (p: PhoneSummary) => p.overall?.priceLkr ?? Number.MAX_SAFE_INTEGER
  return out.sort((a, b) => Number(b.inStockShops > 0) - Number(a.inStockShops > 0) || price(a) - price(b))
}

export const loadBrand = unstable_cache(readBrand, ['brand-phones'], CACHE)

export async function loadDirectory(): Promise<Directory> {
  const lists = await Promise.all(BRAND_SLUGS.map((s) => loadBrand(s)))
  return Object.fromEntries(BRAND_SLUGS.map((s, i) => [s, lists[i]]))
}

export async function findPhone(brandSlug: string, phoneId: string): Promise<PhoneSummary | null> {
  if (!brandFromSlug(brandSlug)) return null
  return (await loadBrand(brandSlug)).find((p) => p.phoneId === phoneId) ?? null
}

/**
 * 90 days of daily lows for one phone: any warranty, and company warranty
 * (company or Apple). In-stock prices only, so the chart agrees with the
 * headline prices above it.
 *
 * Cached per phone, not per brand: 90 days for every phone of a big brand
 * would approach the 2 MB entry limit, and each page needs only its own.
 */
export async function readPhoneHistory(phoneId: string): Promise<HistoryPoint[]> {
  const rows = await getDb()
    .select({
      day: priceHistory.recordedOn,
      any: sql<string>`min(${priceHistory.priceLkr})`,
      company: sql<string | null>`min(${priceHistory.priceLkr}) filter (where ${priceHistory.warranty} in ('company', 'apple'))`,
    })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.phoneId, phoneId),
        eq(priceHistory.inStock, true),
        sql`${priceHistory.recordedOn} >= current_date - 90`,
      ),
    )
    .groupBy(priceHistory.recordedOn)
    .orderBy(asc(priceHistory.recordedOn))

  return rows.map((r) => ({
    day: String(r.day),
    anyLkr: Number(r.any),
    companyLkr: r.company === null ? null : Number(r.company),
  }))
}

export const loadPhoneHistory = unstable_cache(readPhoneHistory, ['phone-history'], CACHE)

/**
 * The last 31 days of each phone's daily lowest in-stock price (any warranty)
 * for one brand: what price drops are judged on. Cached per brand like the
 * directory; 31 days of one number per phone stays far under the entry limit.
 */
export async function readLows(brandSlug: string): Promise<Record<string, PricePoint[]>> {
  const brand = brandFromSlug(brandSlug)
  if (!brand) return {}

  const rows = await getDb()
    .select({
      phoneId: priceHistory.phoneId,
      day: priceHistory.recordedOn,
      lowest: sql<string>`min(${priceHistory.priceLkr})`,
    })
    .from(priceHistory)
    .innerJoin(phones, eq(phones.phoneId, priceHistory.phoneId))
    .where(and(eq(phones.brand, brand), eq(priceHistory.inStock, true), sql`${priceHistory.recordedOn} >= current_date - 31`))
    .groupBy(priceHistory.phoneId, priceHistory.recordedOn)
    .orderBy(asc(priceHistory.phoneId), asc(priceHistory.recordedOn))

  const out: Record<string, PricePoint[]> = {}
  for (const r of rows) (out[r.phoneId] ??= []).push({ day: String(r.day), lowestLkr: Number(r.lowest) })
  return out
}

export const loadLows = unstable_cache(readLows, ['brand-lows'], CACHE)

/** Today's price drops across every brand. Computed from cached reads; costs no extra query. */
export async function loadDeals(): Promise<Deal[]> {
  const [directory, lows] = await Promise.all([loadDirectory(), Promise.all(BRAND_SLUGS.map((s) => loadLows(s)))])
  return findDeals(directory, Object.assign({}, ...lows))
}

export type PhoneSpecs = {
  gsmarenaUrl: string
  mainCamera: string | null
  display: string | null
  network: string | null
  colours: string | null
}

/** GSMArena specs for one brand's models, keyed by model. Matched rows only. */
export async function readSpecs(brandSlug: string): Promise<Record<string, PhoneSpecs>> {
  const brand = brandFromSlug(brandSlug)
  if (!brand) return {}
  const rows = await getDb()
    .select()
    .from(phoneSpecs)
    .where(and(eq(phoneSpecs.brand, brand), eq(phoneSpecs.matched, true)))
  return Object.fromEntries(
    rows.flatMap((r) =>
      r.gsmarenaUrl
        ? [[r.model, { gsmarenaUrl: r.gsmarenaUrl, mainCamera: r.mainCamera, display: r.display, network: r.network, colours: r.colours }]]
        : [],
    ),
  )
}

export const loadSpecs = unstable_cache(readSpecs, ['brand-specs'], CACHE)

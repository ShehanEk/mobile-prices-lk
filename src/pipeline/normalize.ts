import { inArray, isNull, sql } from 'drizzle-orm'

import { getDb } from '@/db'
import { listings, phones, priceHistory, rawListings } from '@/db/schema'
import type { Warranty } from '@/db/schema'
import { extractPhone } from '@/normalize/phone'
import type { PhoneDrop, PhoneIdentity } from '@/normalize/phone'
import { warrantyOf } from '@/normalize/warranty'

/**
 * Stage 3 of the pipeline: turn `raw_listings` into `phones`, current
 * `listings` (one price per phone + shop + warranty class) and daily
 * `price_history`.
 *
 * Rules decide everything they can. The two hooks below are where the Claude
 * fallback plugs in (Task 5); until then they decline, and the row is dropped
 * or filed as `unstated` respectively.
 */

/** Below this a price is a placeholder ("1", "0"), not a real phone price. */
const MIN_PLAUSIBLE_PRICE_LKR = 1000

export type NormalizeOptions = {
  limit?: number
  redo?: boolean
  dryRun?: boolean
  noAi?: boolean
  maxModelCalls?: number
  log?: (m: string) => void
}

export type NormalizeResult = {
  considered: number
  matchedByRule: number
  matchedByModel: number
  /** extractPhone drop reasons, plus 'no-price'. */
  dropped: Record<string, number>
  /** Rows the model was asked about and declined. Always 0 with --no-ai. */
  unmatched: number
  warrantyByModel: number
  warrantyUnclear: number
  /** On a dry run, the number that would be written. */
  phonesCreated: number
  listingsWritten: number
  historyRows: number
  modelCalls: number
}

/**
 * HOOK (Task 5 fills this): ask the model for the identity of a title the rules
 * could not place. Return null to decline. Only called for `brand` and
 * `no-model` drops, and never with --no-ai.
 */
async function resolveUnclearTitle(
  _rawTitle: string,
  _shop: string,
): Promise<PhoneIdentity | null> {
  return null
}

/**
 * HOOK (Task 5 fills this): ask the model which warranty class an unclear
 * wording is. Return 'unstated' to decline. Never called with --no-ai.
 */
async function resolveUnclearWarranty(_text: string | null): Promise<Warranty> {
  return 'unstated'
}

type Candidate = {
  rawId: number
  phoneId: string
  shop: string
  warranty: Warranty
  warrantyText: string | null
  priceLkr: number
  url: string
  inStock: boolean
  scrapedAt: Date
}

/**
 * Which of two rows for the same key to keep, as a positive number when `b`
 * beats `a`.
 *
 * In stock wins before cheapest. Cheapest alone reads as obviously right until
 * a shop carries the same phone twice, once buyable and once not: it would
 * advertise a price you cannot pay. Ties go to the more recent scrape.
 */
function better(a: Candidate, b: Candidate): number {
  return (
    Number(b.inStock) - Number(a.inStock) ||
    a.priceLkr - b.priceLkr ||
    b.scrapedAt.getTime() - a.scrapedAt.getTime()
  )
}

function keepBest(map: Map<string, Candidate>, key: string, c: Candidate) {
  const existing = map.get(key)
  if (!existing || better(existing, c) > 0) map.set(key, c)
}

export async function runNormalize(opts: NormalizeOptions = {}): Promise<NormalizeResult> {
  const log = opts.log ?? ((m: string) => console.log(m))
  const db = getDb()

  const raw = await db
    .select()
    .from(rawListings)
    .where(opts.redo ? sql`true` : isNull(rawListings.normalizedAt))
    .orderBy(rawListings.scrapedAt, rawListings.id)
    .limit(opts.limit ?? 20000)

  const result: NormalizeResult = {
    considered: raw.length,
    matchedByRule: 0,
    matchedByModel: 0,
    dropped: {},
    unmatched: 0,
    warrantyByModel: 0,
    warrantyUnclear: 0,
    phonesCreated: 0,
    listingsWritten: 0,
    historyRows: 0,
    modelCalls: 0,
  }
  const drop = (reason: string) => {
    result.dropped[reason] = (result.dropped[reason] ?? 0) + 1
  }

  const existingIds = new Set(
    (await db.select({ id: phones.phoneId }).from(phones)).map((p) => p.id),
  )
  const newPhones = new Map<string, PhoneIdentity>()
  // One best row per (phone, shop, warranty) for the current listing, and per
  // (phone, shop, warranty, day) for history, so a backlog lands on its own days.
  const bestListing = new Map<string, Candidate>()
  const bestHistory = new Map<string, Candidate>()

  for (const row of raw) {
    const payload = (row.rawPayload ?? {}) as Record<string, unknown>

    let identity: PhoneIdentity | null = null
    const extracted = extractPhone(row.rawTitle)
    if ('drop' in extracted) {
      const reason: PhoneDrop['drop'] = extracted.drop
      if (!opts.noAi && (reason === 'brand' || reason === 'no-model')) {
        identity = await resolveUnclearTitle(row.rawTitle, row.shop)
        if (identity) result.matchedByModel++
        else result.unmatched++
      }
      if (!identity) {
        drop(reason)
        continue
      }
    } else {
      identity = extracted
      result.matchedByRule++
    }

    // Checked before the warranty so a row that cannot be priced never costs a
    // model call.
    const price = Number(payload.priceLkr)
    if (!Number.isFinite(price) || price < MIN_PLAUSIBLE_PRICE_LKR) {
      drop('no-price')
      continue
    }

    const w = warrantyOf(row.rawTitle, payload)
    let warranty: Warranty
    if (w.warranty) {
      warranty = w.warranty
    } else {
      result.warrantyUnclear++
      warranty = opts.noAi ? 'unstated' : await resolveUnclearWarranty(w.text)
    }

    if (!existingIds.has(identity.phoneId) && !newPhones.has(identity.phoneId)) {
      newPhones.set(identity.phoneId, identity)
    }

    const candidate: Candidate = {
      rawId: row.id,
      phoneId: identity.phoneId,
      shop: row.shop,
      warranty,
      warrantyText: w.text,
      priceLkr: price,
      url: String(payload.variationUrl ?? row.sourceUrl),
      inStock: payload.inStock !== false,
      scrapedAt: row.scrapedAt,
    }
    const key = [candidate.phoneId, candidate.shop, candidate.warranty].join('\u0000')
    keepBest(bestListing, key, candidate)
    keepBest(bestHistory, `${key}\u0000${row.scrapedAt.toISOString().slice(0, 10)}`, candidate)
  }

  result.phonesCreated = newPhones.size
  result.listingsWritten = bestListing.size
  result.historyRows = bestHistory.size

  const droppedText =
    Object.entries(result.dropped)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, n]) => `${reason}=${n}`)
      .join(', ') || 'none'
  log(
    `resolved ${result.matchedByRule} by rule, ${result.matchedByModel} by model, ` +
      `${result.unmatched} unmatched; warranty: ${result.warrantyByModel} by model, ` +
      `${result.warrantyUnclear} unclear`,
  )
  log(`dropped: ${droppedText}`)

  if (opts.dryRun) {
    log(
      `dry run, nothing written; would write ${result.phonesCreated} new phones, ` +
        `${result.listingsWritten} listings, ${result.historyRows} price-history rows`,
    )
    return result
  }

  // --- writes. Neon's HTTP driver has no transactions, so the order is what
  // keeps a crash harmless: phones first (foreign key), rows stamped last, and
  // every statement is an upsert so a re-run converges.

  const phoneValues = [...newPhones.values()].map((p) => ({
    phoneId: p.phoneId,
    brand: p.brand,
    model: p.model,
    ramGb: p.ramGb,
    storageGb: p.storageGb,
    esimOnly: p.esimOnly,
  }))
  for (let i = 0; i < phoneValues.length; i += 100) {
    await db.insert(phones).values(phoneValues.slice(i, i + 100)).onConflictDoNothing()
  }

  const listingValues = [...bestListing.values()].map((c) => ({
    phoneId: c.phoneId,
    shop: c.shop,
    warranty: c.warranty,
    warrantyText: c.warrantyText,
    priceLkr: String(c.priceLkr),
    url: c.url,
    inStock: c.inStock,
    scrapedAt: c.scrapedAt,
  }))
  for (let i = 0; i < listingValues.length; i += 100) {
    await db
      .insert(listings)
      .values(listingValues.slice(i, i + 100))
      .onConflictDoUpdate({
        target: [listings.phoneId, listings.shop, listings.warranty],
        set: {
          warrantyText: sql`excluded.warranty_text`,
          priceLkr: sql`excluded.price_lkr`,
          url: sql`excluded.url`,
          inStock: sql`excluded.in_stock`,
          scrapedAt: sql`excluded.scraped_at`,
        },
        // A --redo over old rows must not overwrite a newer price.
        setWhere: sql`${listings.scrapedAt} <= excluded.scraped_at`,
      })
  }

  const historyValues = [...bestHistory.values()].map((c) => ({
    phoneId: c.phoneId,
    shop: c.shop,
    warranty: c.warranty,
    recordedOn: c.scrapedAt.toISOString().slice(0, 10),
    priceLkr: String(c.priceLkr),
    // Stock is stored with the point; it cannot be looked up afterwards.
    inStock: c.inStock,
  }))
  for (let i = 0; i < historyValues.length; i += 100) {
    await db
      .insert(priceHistory)
      .values(historyValues.slice(i, i + 100))
      .onConflictDoUpdate({
        target: [
          priceHistory.phoneId,
          priceHistory.shop,
          priceHistory.warranty,
          priceHistory.recordedOn,
        ],
        set: { priceLkr: sql`excluded.price_lkr`, inStock: sql`excluded.in_stock` },
      })
  }

  // Stamp every row looked at, dropped or not, so the next run skips titles
  // that will never resolve.
  const ids = raw.map((r) => r.id)
  for (let i = 0; i < ids.length; i += 200) {
    await db
      .update(rawListings)
      .set({ normalizedAt: new Date() })
      .where(inArray(rawListings.id, ids.slice(i, i + 200)))
  }

  log(
    `wrote ${result.phonesCreated} new phones, ${result.listingsWritten} listings, ` +
      `${result.historyRows} price-history rows`,
  )
  return result
}

import type { Warranty } from '@/db/schema'

import { colomboDate } from './best-row'

/**
 * Pure helper for replacing a listing whose warranty class changed. Kept apart
 * from the database code so it can be tested on their own.
 *
 * A shop product is (phone, shop, url); the warranty class is only a label on
 * it. Upserting by (phone, shop, warranty) writes the new class and leaves the
 * old one behind, so the product would show two prices.
 */

type Keyed = { phoneId: string; shop: string; warranty: Warranty }
export type ListingRef = Keyed & { url: string; scrapedAt: Date }
export type HistoryRef = Keyed & { recordedOn: string }

const keyOf = (r: Keyed) => [r.phoneId, r.shop, r.warranty].join('\u0000')
const productOf = (r: { phoneId: string; shop: string; url: string }) => [r.phoneId, r.shop, r.url].join('\u0000')

/**
 * Which stored rows a run's writes replace.
 *
 * A stored listing is superseded when this run writes the same product under
 * another class from a scrape at least as new. A key this run writes itself is
 * never superseded: another product of that class may hold it, and the upsert
 * settles that.
 *
 * Its history point goes too when it was recorded on the same Colombo day the
 * replacing row was scraped (the shop had that one class all day, so the old
 * point was only ever the wrong label). Earlier days stay: they were true then.
 */
export function findSuperseded(
  stored: ListingRef[],
  written: ListingRef[],
  writtenHistory: (Keyed & { scrapedAt: Date })[],
): { listings: ListingRef[]; history: HistoryRef[] } {
  const writtenKeys = new Set(written.map(keyOf))
  const historyKeys = new Set(writtenHistory.map((h) => `${keyOf(h)}\u0000${colomboDate(h.scrapedAt)}`))
  const byProduct = new Map<string, ListingRef[]>()
  for (const w of written) {
    const k = productOf(w)
    byProduct.set(k, [...(byProduct.get(k) ?? []), w])
  }

  const listings: ListingRef[] = []
  const history: HistoryRef[] = []
  for (const s of stored) {
    if (writtenKeys.has(keyOf(s))) continue
    const newer = (byProduct.get(productOf(s)) ?? []).filter((w) => s.scrapedAt.getTime() <= w.scrapedAt.getTime())
    if (!newer.length) continue
    listings.push(s)
    const day = colomboDate(s.scrapedAt)
    if (newer.some((w) => colomboDate(w.scrapedAt) === day) && !historyKeys.has(`${keyOf(s)}\u0000${day}`)) {
      history.push({ phoneId: s.phoneId, shop: s.shop, warranty: s.warranty, recordedOn: day })
    }
  }
  return { listings, history }
}

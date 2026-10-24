import type { Warranty } from '@/db/schema'

import { colomboDate } from './best-row'

/**
 * Pure helpers for replacing a listing whose warranty class changed. Kept apart
 * from the database code so they can be tested on their own.
 *
 * A shop product is (phone, shop, url); the warranty class is only a label on
 * it. Upserting by (phone, shop, warranty) writes the new class and leaves the
 * old one behind, so the product would show two prices. One rule settles it:
 * per product, the latest-scraped class wins and every other class goes, from
 * this run's own writes, from the stored listings and from the history.
 *
 * Known limit: a stored listing keeps only its winning product's url. If
 * products A and B share a class key and A changes class while B is not in the
 * run (--limit, deferred, no price), the key goes until B is next normalized.
 * 16 variable-product rows share a parent url today.
 */

type Keyed = { phoneId: string; shop: string; warranty: Warranty }
export type ListingRef = Keyed & { url: string; scrapedAt: Date }
export type HistoryRef = Keyed & { recordedOn: string }

const keyOf = (r: Keyed) => [r.phoneId, r.shop, r.warranty].join('\u0000')
const productOf = (r: { phoneId: string; shop: string; url: string }) => [r.phoneId, r.shop, r.url].join('\u0000')

/**
 * The candidates left once a product's older classes are dropped: one whose
 * product has a candidate of another class from a later Colombo day is stale.
 * A --redo spanning two scrape days would otherwise write the old class back.
 * Judged by day, not by timestamp: one scrape is inserted in chunks with
 * slightly different times, and two classes of a product on the same day both
 * stay.
 */
export function dropStale<T extends ListingRef>(candidates: T[]): T[] {
  const byProduct = new Map<string, T[]>()
  for (const c of candidates) {
    const k = productOf(c)
    byProduct.set(k, [...(byProduct.get(k) ?? []), c])
  }
  return candidates.filter(
    (c) =>
      !byProduct
        .get(productOf(c))!
        .some((o) => o.warranty !== c.warranty && colomboDate(o.scrapedAt) > colomboDate(c.scrapedAt)),
  )
}

/**
 * Which stored rows a run's writes replace. `written` and `writtenHistory` are
 * what this run upserts (the per-key winners); they decide which keys and
 * (key, day) points are protected. `candidates` (listings after `dropStale`)
 * and `scraped` (every row of the run) say what each product did, including
 * a product that lost its key to another product: it still changed class.
 * They default to the winners.
 *
 * A stored listing is superseded when the run has the same product under
 * another class from a scrape at least as new. A key this run writes itself is
 * never superseded: another product of that class may hold it, and the upsert
 * settles that.
 *
 * Each superseded class also loses its history on every day the run scraped
 * the product (the shop had the new class that day, so the old point was only
 * the wrong label), unless that (key, day) is itself written this run. Days
 * this run does not scrape stay: they were true then.
 */
export function findSuperseded(
  stored: ListingRef[],
  written: ListingRef[],
  writtenHistory: ListingRef[],
  candidates: ListingRef[] = written,
  scraped: ListingRef[] = writtenHistory,
): { listings: ListingRef[]; history: HistoryRef[] } {
  const writtenKeys = new Set(written.map(keyOf))
  const historyKeys = new Set(writtenHistory.map((h) => `${keyOf(h)}\u0000${colomboDate(h.scrapedAt)}`))
  const byProduct = new Map<string, ListingRef[]>()
  for (const w of candidates) {
    const k = productOf(w)
    byProduct.set(k, [...(byProduct.get(k) ?? []), w])
  }
  const daysByProduct = new Map<string, Set<string>>()
  for (const h of scraped) {
    const k = productOf(h)
    daysByProduct.set(k, (daysByProduct.get(k) ?? new Set()).add(colomboDate(h.scrapedAt)))
  }

  const listings: ListingRef[] = []
  const history: HistoryRef[] = []
  for (const s of stored) {
    if (writtenKeys.has(keyOf(s))) continue
    const newer = (byProduct.get(productOf(s)) ?? []).some((w) => w.warranty !== s.warranty && s.scrapedAt.getTime() <= w.scrapedAt.getTime())
    if (!newer) continue
    listings.push(s)
    for (const day of daysByProduct.get(productOf(s)) ?? []) {
      if (!historyKeys.has(`${keyOf(s)}\u0000${day}`)) {
        history.push({ phoneId: s.phoneId, shop: s.shop, warranty: s.warranty, recordedOn: day })
      }
    }
  }
  return { listings, history }
}

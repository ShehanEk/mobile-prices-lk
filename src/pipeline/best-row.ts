/**
 * Pure helpers for choosing which scraped row represents a key. Kept apart from
 * the database code so they can be tested on their own.
 */

type Rankable = { inStock: boolean; priceLkr: number; scrapedAt: Date }

/** Sri Lanka is UTC+05:30 all year (no DST). */
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000

/**
 * The calendar date (YYYY-MM-DD) in Asia/Colombo. The scrapes run 00:00-02:40
 * Sri Lanka time, which is the previous day in UTC, so a UTC date would file
 * every point a day early.
 */
export function colomboDate(d: Date): string {
  return new Date(d.getTime() + COLOMBO_OFFSET_MS).toISOString().slice(0, 10)
}

/**
 * Positive when `b` beats `a` among rows of one day (price history).
 *
 * In stock wins before cheapest. Cheapest alone reads as obviously right until
 * a shop carries the same phone twice, once buyable and once not: it would
 * advertise a price you cannot pay. Ties go to the more recent scrape.
 */
export function betterWithinDay(a: Rankable, b: Rankable): number {
  return (
    Number(b.inStock) - Number(a.inStock) ||
    a.priceLkr - b.priceLkr ||
    b.scrapedAt.getTime() - a.scrapedAt.getTime()
  )
}

/**
 * Positive when `b` beats `a` for the current listing: the newer scrape day
 * always wins, so yesterday's in-stock row never outranks today's out-of-stock
 * one. Within a day, same rule as `betterWithinDay`.
 */
export function betterForListing(a: Rankable, b: Rankable): number {
  const dayA = colomboDate(a.scrapedAt)
  const dayB = colomboDate(b.scrapedAt)
  if (dayA !== dayB) return dayB < dayA ? -1 : 1
  return betterWithinDay(a, b)
}

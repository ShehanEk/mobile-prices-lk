import assert from 'node:assert/strict'
import { test } from 'node:test'

import { betterForListing, betterWithinDay, colomboDate } from './best-row'

test('colomboDate files late-evening UTC under the next Sri Lanka day', () => {
  assert.equal(colomboDate(new Date('2026-10-23T20:39:00Z')), '2026-10-24')
  assert.equal(colomboDate(new Date('2026-10-23T18:29:59Z')), '2026-10-23')
  assert.equal(colomboDate(new Date('2026-10-23T18:30:00Z')), '2026-10-24')
  assert.equal(colomboDate(new Date('2026-10-23T18:00:00Z')), '2026-10-23')
  assert.equal(colomboDate(new Date('2026-12-31T19:00:00Z')), '2027-01-01')
})

const row = (inStock: boolean, priceLkr: number, at: string) => ({
  inStock,
  priceLkr,
  scrapedAt: new Date(at),
})

test('listing: an older day never beats a newer day', () => {
  const yesterdayCheapInStock = row(true, 100000, '2026-10-22T19:00:00Z')
  const todayOutOfStock = row(false, 150000, '2026-10-23T19:00:00Z')
  assert.ok(betterForListing(yesterdayCheapInStock, todayOutOfStock) > 0)
  assert.ok(betterForListing(todayOutOfStock, yesterdayCheapInStock) < 0)
})

test('listing: within one Colombo day, buyable then cheapest then latest', () => {
  const a = row(false, 90000, '2026-10-23T19:00:00Z')
  const b = row(true, 120000, '2026-10-23T20:00:00Z')
  const c = row(true, 110000, '2026-10-23T19:30:00Z')
  assert.ok(betterForListing(a, b) > 0)
  assert.ok(betterForListing(b, c) > 0)
  const d = row(true, 110000, '2026-10-23T21:00:00Z')
  assert.ok(betterForListing(c, d) > 0)
})

test('the day boundary is Colombo midnight, not UTC midnight', () => {
  const lateUtcPrevDay = row(true, 100000, '2026-10-23T19:00:00Z') // 24 Oct 00:30 SL
  const sameSlDayEarlier = row(false, 90000, '2026-10-23T18:40:00Z') // 24 Oct 00:10 SL
  // Same Colombo day, so stock decides, not recency.
  assert.ok(betterForListing(sameSlDayEarlier, lateUtcPrevDay) > 0)
})

test('history: within a day buyable first, then cheapest', () => {
  assert.ok(betterWithinDay(row(false, 1, '2026-10-23T19:00:00Z'), row(true, 9, '2026-10-23T19:00:00Z')) > 0)
  assert.ok(betterWithinDay(row(true, 9, '2026-10-23T19:00:00Z'), row(true, 8, '2026-10-23T19:00:00Z')) > 0)
})

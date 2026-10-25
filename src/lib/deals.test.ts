import assert from 'node:assert/strict'
import { test } from 'node:test'

import { findDeals } from './deals'
import { summarisePhone, toOffer, type PricePoint } from './prices'

const NOW = new Date('2026-10-25T06:00:00Z')
const ID = 'honor-x8d-8gb-256gb'

const phone = (priceLkr: number) =>
  summarisePhone(
    { phoneId: ID, brand: 'Honor', model: 'X8d', ramGb: 8, storageGb: 256, esimOnly: false },
    'honor',
    [
      toOffer(
        { shop: 'lifemobile.lk', warranty: 'shop', warrantyText: null, priceLkr, url: 'https://lifemobile.lk/x8d', inStock: true, scrapedAt: new Date('2026-10-24T21:00:00Z') },
        NOW,
      ),
    ],
  )

/** `n` days before today (2026-10-25 in Sri Lanka), each at `lkr`. */
const days = (n: number, lkr: number): PricePoint[] =>
  Array.from({ length: n }, (_, i) => ({ day: `2026-10-${String(24 - i).padStart(2, '0')}`, lowestLkr: lkr }))

test('a phone 5% under its 30-day median, with 7 or more days on record, is a price drop', () => {
  const [deal] = findDeals({ honor: [phone(95000)] }, { [ID]: days(10, 100000) }, NOW)
  assert.equal(deal.percent, 5)
  assert.equal(deal.savingLkr, 5000)
  assert.equal(deal.usualLkr, 100000)
  assert.equal(deal.lowest, true)
})

test('a phone less than 5% under its median is not a price drop', () => {
  assert.deepEqual(findDeals({ honor: [phone(96000)] }, { [ID]: days(10, 100000) }, NOW), [])
})

test('fewer than 7 days on record is never a price drop', () => {
  assert.deepEqual(findDeals({ honor: [phone(90000)] }, { [ID]: days(6, 100000) }, NOW), [])
})

test('a drop over 30% is left out as a likely matching error', () => {
  assert.deepEqual(findDeals({ honor: [phone(60000)] }, { [ID]: days(10, 100000) }, NOW), [])
})

test('today is the price being judged, not part of the usual price', () => {
  const lows = [...days(7, 100000), { day: '2026-10-25', lowestLkr: 95000 }]
  assert.equal(findDeals({ honor: [phone(95000)] }, { [ID]: lows }, NOW)[0]?.usualLkr, 100000)
})

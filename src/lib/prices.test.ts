import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  checkedLabel,
  configLabel,
  headlines,
  isCompany,
  phoneDescription,
  priceRange,
  rupees,
  sortOffers,
  sriLankaDate,
  summarisePhone,
  toOffer,
  type ListingRow,
} from './prices'

const NOW = new Date('2026-10-25T06:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000)
const offer = (over: Partial<ListingRow> = {}) =>
  toOffer(
    {
      shop: 'lifemobile.lk',
      warranty: 'shop',
      warrantyText: null,
      priceLkr: '100000.00',
      url: 'https://lifemobile.lk/p/1',
      inStock: true,
      scrapedAt: daysAgo(0.5),
      ...over,
    },
    NOW,
  )

test('toOffer reads the numeric price, trims the wording, and dates it in Sri Lanka time', () => {
  const o = offer({ priceLkr: '69714.29', scrapedAt: new Date('2026-10-24T21:30:00Z'), warrantyText: '  1 Year Company Warranty ' })
  assert.equal(o.priceLkr, 69714.29)
  assert.equal(o.warrantyText, '1 Year Company Warranty')
  assert.equal(o.seenOn, '2026-10-25')
})

test('a listing older than 7 days is stale; 7 days or newer is not', () => {
  assert.equal(offer({ scrapedAt: daysAgo(8) }).stale, true)
  assert.equal(offer({ scrapedAt: daysAgo(7) }).stale, false)
  assert.equal(offer({ scrapedAt: daysAgo(6) }).stale, false)
})

test('company warranty means company or Apple', () => {
  assert.equal(isCompany('company'), true)
  assert.equal(isCompany('apple'), true)
  assert.equal(isCompany('shop'), false)
  assert.equal(isCompany('unstated'), false)
})

test('offers sort in stock first, then out of stock, then last seen; cheapest first within each', () => {
  const sorted = sortOffers([
    offer({ shop: 'a', priceLkr: 90000, scrapedAt: daysAgo(10) }),
    offer({ shop: 'b', priceLkr: 95000, inStock: false }),
    offer({ shop: 'c', priceLkr: 120000 }),
    offer({ shop: 'd', priceLkr: 110000 }),
  ])
  assert.deepEqual(sorted.map((o) => o.shop), ['d', 'c', 'b', 'a'])
})

test('cheapest overall counts every warranty class, unstated included', () => {
  const h = headlines([
    offer({ shop: 'celltronics.lk', warranty: 'company', priceLkr: 389900 }),
    offer({ shop: 'idealz.lk', warranty: 'unstated', priceLkr: 336000 }),
    offer({ shop: 'doctormobile.lk', warranty: 'shop', priceLkr: 344433 }),
  ])
  assert.equal(h.overall?.shop, 'idealz.lk')
  assert.equal(h.company?.shop, 'celltronics.lk')
})

test('Apple warranty counts toward the company headline', () => {
  const h = headlines([
    offer({ shop: 'a', warranty: 'apple', priceLkr: 429900 }),
    offer({ shop: 'b', warranty: 'shop', priceLkr: 399000 }),
  ])
  assert.equal(h.company?.warranty, 'apple')
  assert.equal(h.overall?.shop, 'b')
})

test('an in-stock price beats a cheaper out-of-stock one for a headline', () => {
  const h = headlines([
    offer({ shop: 'banana.lk', warranty: 'unstated', priceLkr: 339900, inStock: false }),
    offer({ shop: 'doctormobile.lk', priceLkr: 344433 }),
  ])
  assert.equal(h.overall?.shop, 'doctormobile.lk')
})

test('an out-of-stock price holds a headline only when nothing current is in stock', () => {
  const h = headlines([offer({ shop: 'a', priceLkr: 339900, inStock: false })])
  assert.equal(h.overall?.shop, 'a')
  assert.equal(h.company, null)
})

test('a stale price never holds a headline', () => {
  assert.deepEqual(headlines([offer({ warranty: 'company', priceLkr: 300000, scrapedAt: daysAgo(9) })]), {
    overall: null,
    company: null,
  })
})

test('the price range spans every current price, out of stock included, stale left out', () => {
  assert.deepEqual(
    priceRange([
      offer({ priceLkr: 339900, inStock: false }),
      offer({ priceLkr: 389900 }),
      offer({ priceLkr: 100, scrapedAt: daysAgo(30) }),
    ]),
    { low: 339900, high: 389900 },
  )
  assert.equal(priceRange([offer({ scrapedAt: daysAgo(30) })]), null)
})

test('config labels', () => {
  assert.equal(configLabel({ ramGb: 12, storageGb: 256, esimOnly: false }), '12 GB · 256 GB')
  assert.equal(configLabel({ ramGb: 16, storageGb: 1024, esimOnly: false }), '16 GB · 1 TB')
  assert.equal(configLabel({ ramGb: null, storageGb: 256, esimOnly: false }), '256 GB')
  assert.equal(configLabel({ ramGb: null, storageGb: 256, esimOnly: true }), '256 GB · eSIM')
})

test('rupees rounds to whole rupees with thousands separators', () => {
  assert.equal(rupees(344433), 'Rs 344,433')
  assert.equal(rupees(69714.29), 'Rs 69,714')
})

test('Sri Lanka dates and the checked label', () => {
  assert.equal(sriLankaDate(new Date('2026-10-24T18:29:00Z')), '2026-10-24')
  assert.equal(sriLankaDate(new Date('2026-10-24T18:31:00Z')), '2026-10-25')
  assert.equal(checkedLabel('2026-10-24T21:30:00.000Z'), '25 Oct at 03:00')
})

test('a phone counts each shop once, however many warranty offers it has there', () => {
  const p = summarisePhone(
    { phoneId: 'samsung-galaxy-a57-8gb-256gb', brand: 'Samsung', model: 'Galaxy A57', ramGb: 8, storageGb: 256, esimOnly: false },
    'samsung',
    [
      offer({ shop: 'celltronics.lk', warranty: 'company', priceLkr: 164900 }),
      offer({ shop: 'celltronics.lk', warranty: 'shop', priceLkr: 149988 }),
      offer({ shop: 'banana.lk', warranty: 'unstated', priceLkr: 150000, inStock: false }),
    ],
  )
  assert.equal(p.shops, 2)
  assert.equal(p.inStockShops, 1)
  assert.equal(p.overall?.priceLkr, 149988)
  assert.equal(p.company?.priceLkr, 164900)
  assert.equal(p.offers[0].priceLkr, 149988)
})

const a57 = { phoneId: 'samsung-galaxy-a57-8gb-256gb', brand: 'Samsung', model: 'Galaxy A57', ramGb: 8, storageGb: 256, esimOnly: false }

test('the description leads with the cheapest price and adds the company price once', () => {
  const p = summarisePhone(a57, 'samsung', [
    offer({ shop: 'idealz.lk', warranty: 'shop', priceLkr: 149988 }),
    offer({ shop: 'celltronics.lk', warranty: 'company', priceLkr: 164900 }),
  ])
  const { description, lead } = phoneDescription('Samsung A57', p)
  assert.equal(lead, 'from Rs 149,988 at idealz.lk (shop warranty).')
  assert.equal(
    description,
    'Samsung A57 price in Sri Lanka: from Rs 149,988 at idealz.lk (shop warranty). With company warranty from Rs 164,900. 2 shops compared, updated daily.',
  )
})

test('the description does not repeat the price when one offer is both headlines, even as a copy', () => {
  const p = summarisePhone(a57, 'samsung', [offer({ shop: 'celltronics.lk', warranty: 'company', priceLkr: 164900 })])
  // The cache hands back copies, so the two headlines are equal but never the same object.
  const copy = { ...p, company: p.company && { ...p.company } }
  const { description } = phoneDescription('Samsung Galaxy A57', copy)
  assert.equal(description.match(/Rs 164,900/g)?.length, 1)
})

test('the description says so when nothing is current', () => {
  const p = summarisePhone(a57, 'samsung', [offer({ scrapedAt: daysAgo(30) })])
  assert.equal(phoneDescription('Samsung Galaxy A57', p).lead, 'no price confirmed this week; last seen prices listed.')
})

test('the description stays within 155 characters', () => {
  const p = summarisePhone(a57, 'samsung', [
    offer({ shop: 'geniusmobile.lk', warranty: 'unstated', priceLkr: 149988 }),
    offer({ shop: 'celltronics.lk', warranty: 'company', priceLkr: 164900 }),
  ])
  const { description } = phoneDescription('Samsung Galaxy S26 Ultra 12 GB · 256 GB · eSIM', p)
  assert.ok(description.length <= 155, description)
  assert.ok(description.includes('from Rs 149,988'))
})

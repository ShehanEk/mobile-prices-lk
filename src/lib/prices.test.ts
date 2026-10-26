import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  cardPrices,
  checkedLabel,
  configLabel,
  dayLabel,
  flagshipCards,
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

test('a card prices from the headline rule: in stock beats a cheaper out-of-stock offer, for both lines', () => {
  const c = cardPrices([
    offer({ shop: 'a', warranty: 'company', priceLkr: 300000, inStock: false }),
    offer({ shop: 'b', warranty: 'company', priceLkr: 320000 }),
    offer({ shop: 'c', warranty: 'shop', priceLkr: 310000 }),
  ])
  assert.equal(c?.overall.shop, 'c')
  assert.equal(c?.company?.shop, 'b')
  assert.deepEqual(c?.standing, { kind: 'stock' })
})

test('a card whose only company offer is out of stock still shows that company price, as the phone page does', () => {
  const offers = [
    offer({ shop: 'a', warranty: 'company', priceLkr: 330000, inStock: false }),
    offer({ shop: 'b', warranty: 'shop', priceLkr: 310000 }),
  ]
  const c = cardPrices(offers)
  assert.equal(c?.company?.shop, 'a')
  assert.equal(c?.company?.inStock, false)
  assert.deepEqual(c?.standing, { kind: 'stock' })
  assert.equal(c?.company, headlines(offers).company)
})

test('a card with nothing in stock says out of stock and prices from the cheapest current offer', () => {
  const c = cardPrices([
    offer({ shop: 'a', priceLkr: 340000, inStock: false }),
    offer({ shop: 'b', priceLkr: 330000, inStock: false }),
    offer({ shop: 'c', priceLkr: 300000, scrapedAt: daysAgo(10) }),
  ])
  assert.equal(c?.overall.shop, 'b')
  assert.deepEqual(c?.standing, { kind: 'out' })
})

test('a card with only stale offers is last seen, dated by the offer whose price is shown', () => {
  const c = cardPrices([
    offer({ shop: 'a', warranty: 'company', priceLkr: 300000, scrapedAt: daysAgo(10) }),
    offer({ shop: 'b', priceLkr: 280000, scrapedAt: daysAgo(20) }),
  ])
  assert.equal(c?.overall.shop, 'b')
  assert.deepEqual(c?.standing, { kind: 'seen', on: dayLabel(daysAgo(20).toISOString()) })
  assert.equal(c?.company, null)
})

test('a card with no offers has no prices', () => {
  assert.equal(cardPrices([]), null)
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
  assert.equal(dayLabel('2026-10-11T20:00:00.000Z'), '12 Oct')
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

const config = (id: string, ramGb: number | null, storageGb: number, offers: Parameters<typeof offer>[0][], esimOnly = false) =>
  summarisePhone({ phoneId: id, brand: 'Samsung', model: 'Galaxy S99', ramGb, storageGb, esimOnly }, 'samsung', offers.map(offer))

const LIST = [{ brand: 'Samsung', model: 'Galaxy S99' }]

test('a flagship card is the cheapest current price across the model’s configurations, linked to that configuration', () => {
  const [card] = flagshipCards(
    [
      config('s99-12-256', 12, 256, [{ shop: 'a', priceLkr: 300000 }]),
      config('s99-12-512', 12, 512, [{ shop: 'b', priceLkr: 280000 }]),
      config('s99-16-1tb', 16, 1024, [{ shop: 'a', priceLkr: 420000 }]),
    ],
    LIST,
  )
  assert.equal(card.priceLkr, 280000)
  assert.equal(card.phoneId, 's99-12-512')
  assert.equal(card.brandSlug, 'samsung')
  assert.equal(card.configs, '3 configurations')
})

test('a flagship card prices from an in-stock offer before a cheaper out-of-stock one', () => {
  const [card] = flagshipCards(
    [
      config('s99-12-256', 12, 256, [{ shop: 'a', priceLkr: 250000, inStock: false }]),
      config('s99-12-512', 12, 512, [{ shop: 'b', priceLkr: 290000 }, { shop: 'c', priceLkr: 270000, inStock: false }]),
    ],
    LIST,
  )
  assert.equal(card.priceLkr, 290000)
  assert.equal(card.phoneId, 's99-12-512')
})

test('a flagship card ignores prices older than 7 days, and counts only shops with a current offer', () => {
  const [card] = flagshipCards(
    [
      config('s99-12-256', 12, 256, [{ shop: 'a', priceLkr: 200000, scrapedAt: daysAgo(9) }, { shop: 'b', priceLkr: 310000 }]),
      config('s99-12-512', 12, 512, [{ shop: 'c', priceLkr: 330000 }, { shop: 'b', priceLkr: 335000, inStock: false }]),
    ],
    LIST,
  )
  assert.equal(card.priceLkr, 310000)
  assert.equal(card.shops, 2)
  assert.equal(card.shopsLabel, '2 shops')
})

test('a flagship card counts a shop once across configurations', () => {
  const [card] = flagshipCards(
    [
      config('s99-12-256', 12, 256, [{ shop: 'a', priceLkr: 300000 }, { shop: 'b', priceLkr: 310000 }]),
      config('s99-12-512', 12, 512, [{ shop: 'a', priceLkr: 340000 }]),
    ],
    LIST,
  )
  assert.equal(card.shops, 2)
})

test('a listed model with no current price or no data is skipped; list order is kept', () => {
  const stale = config('s99-12-256', 12, 256, [{ priceLkr: 100000, scrapedAt: daysAgo(10) }])
  const pixel = { ...config('p10-8-128', 8, 128, [{ priceLkr: 230000 }]), brand: 'Google', model: 'Pixel 10', brandSlug: 'google' }
  const cards = flagshipCards([stale, pixel], [LIST[0], { brand: 'Apple', model: 'iPhone 99' }, { brand: 'Google', model: 'Pixel 10' }])
  assert.deepEqual(cards.map((c) => c.model), ['Pixel 10'])
  assert.equal(cards[0].brand, 'Google')

  const reversed = flagshipCards([config('s99-12-256', 12, 256, [{ priceLkr: 300000 }]), pixel], [{ brand: 'Google', model: 'Pixel 10' }, LIST[0]])
  assert.deepEqual(reversed.map((c) => c.model), ['Pixel 10', 'Galaxy S99'])
})

test('a model with one configuration shows its label, and one shop reads "1 shop"', () => {
  const [card] = flagshipCards([config('s99-12-256', 12, 256, [{ priceLkr: 300000 }])], LIST)
  assert.equal(card.configs, '12 GB · 256 GB')
  assert.equal(card.shopsLabel, '1 shop')
  const [esim] = flagshipCards([config('i-256-esim', null, 256, [{ priceLkr: 300000 }], true)], LIST)
  assert.equal(esim.configs, '256 GB · eSIM')
})

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { productJsonLd, siteJsonLd } from './jsonld'
import { summarisePhone, toOffer } from './prices'
import { SITE_NAME } from './site'

const NOW = new Date('2026-10-25T06:00:00Z')
const FRESH = new Date('2026-10-24T21:00:00Z')
const OLD = new Date('2026-09-01T21:00:00Z')

const phone = (...listings: [shop: string, priceLkr: number, scrapedAt: Date, inStock?: boolean][]) =>
  summarisePhone(
    { phoneId: 'honor-400-12gb-512gb', brand: 'Honor', model: '400', ramGb: 12, storageGb: 512, esimOnly: false },
    'honor',
    listings.map(([shop, priceLkr, scrapedAt, inStock = true]) =>
      toOffer({ shop, warranty: 'shop', warrantyText: null, priceLkr, url: `https://${shop}/honor-400`, inStock, scrapedAt }, NOW),
    ),
  )

test('a phone with current prices gets a Product with an AggregateOffer over those prices only', () => {
  const p = productJsonLd(
    phone(['lifemobile.lk', 150000, FRESH], ['banana.lk', 140000, FRESH, false], ['idealz.lk', 120000, OLD]),
    'Honor 400 12 GB · 512 GB',
    '/honor/honor-400-12gb-512gb',
  )!
  assert.equal(p['@type'], 'Product')
  assert.equal(p.offers.lowPrice, 140000)
  assert.equal(p.offers.highPrice, 150000)
  assert.equal(p.offers.offerCount, 2)
  assert.equal(p.offers.availability, 'https://schema.org/InStock')
  assert.deepEqual(p.offers.offers.map((o) => o.seller.name).sort(), ['banana.lk', 'lifemobile.lk'])
  assert.equal('image' in p, false)
})

test('a phone with only stale prices gets no Product, since Google rejects one without offers', () => {
  assert.equal(productJsonLd(phone(['idealz.lk', 120000, OLD]), 'Honor 400', '/honor/honor-400-12gb-512gb'), null)
})

test('the home page names the site for Google', () => {
  const [site, org] = siteJsonLd()['@graph'] as Record<string, unknown>[]
  assert.equal(site['@type'], 'WebSite')
  assert.equal(site.name, SITE_NAME)
  assert.equal(org['@type'], 'Organization')
  assert.match(String(org.logo), /\/apple-icon$/)
})

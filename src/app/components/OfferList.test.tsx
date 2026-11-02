import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { Offer } from '@/lib/prices'

import { OfferList } from './OfferList'

const offer = (shop: string, priceLkr: number, over: Partial<Offer> = {}): Offer => ({
  shop,
  warranty: 'shop',
  warrantyText: null,
  priceLkr,
  url: `https://${shop}/phone`,
  inStock: true,
  seenAt: '2026-11-02T00:00:00.000Z',
  seenOn: '2026-11-02',
  stale: false,
  ...over,
})

const html = (offers: Offer[]) => renderToStaticMarkup(<OfferList offers={offers} />)

/** The server HTML holds the table and the phone cards, so each mark appears twice. */
const pills = (out: string) => out.match(/>Cheapest</g)?.length ?? 0
const NOTE = 'never counts as the cheapest'

// In `sortOffers` order, as the page passes them: buyable first, then cheapest.
const buyableFirst = [offer('a.lk', 100), offer('b.lk', 120), offer('c.lk', 90, { inStock: false })]

test('only the cheapest in-stock offer is marked, in the table and on the cards', () => {
  const out = html(buyableFirst)
  assert.equal(pills(out), 2)
  assert.match(out, /<td[^>]*>[^<]*<span[^>]*>a\.lk<span[^>]*>Cheapest<\/span>/)
  assert.ok(!/b\.lk<span[^>]*>Cheapest/.test(out))
  assert.ok(!/c\.lk<span[^>]*>Cheapest/.test(out))
})

test('nothing is marked when no price can be bought', () => {
  const out = html([offer('a.lk', 100, { inStock: false }), offer('b.lk', 120, { stale: true })])
  assert.equal(pills(out), 0)
})

test('the note explains an out-of-stock or old price, and only then', () => {
  assert.ok(html(buyableFirst).includes(NOTE))
  assert.ok(html([offer('a.lk', 100, { stale: true })]).includes(NOTE))
  assert.ok(!html([offer('a.lk', 100), offer('b.lk', 120)]).includes(NOTE))
})

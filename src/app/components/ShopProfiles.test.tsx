import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { shopStats } from '@/lib/shop-stats'
import { TRACKED_SHOPS } from '@/lib/site'
import { ShopProfiles } from './ShopProfiles'

const [stale, fresh] = TRACKED_SHOPS
const offer = (shop: string, stale = false) => ({ shop, priceLkr: 100, inStock: true, stale })

const out = renderToStaticMarkup(
  <ShopProfiles stats={shopStats([{ offers: [offer(stale, true)] }, { offers: [offer(fresh)] }], TRACKED_SHOPS)} />,
)
const cards = out.split('<h3').slice(1)

test('one card per tracked shop, with no timer or client code', () => {
  assert.equal(cards.length, TRACKED_SHOPS.length)
  assert.ok(!out.includes('<script'))
})

test('a shop whose listings are all stale shows a dash, not 0%', () => {
  assert.match(cards[0], />1<\/span>.*phones listed/)
  assert.match(cards[0], />–<\/span><span[^>]*>in stock/)
  assert.ok(!cards[0].includes('0%'))
})

test('a shop with a recent listing shows its percentage', () => {
  assert.match(cards[1], />100%<\/span><span[^>]*>in stock/)
})

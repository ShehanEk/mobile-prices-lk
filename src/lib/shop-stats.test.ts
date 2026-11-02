import assert from 'node:assert/strict'
import { test } from 'node:test'

import { shopStats } from './shop-stats'

const offer = (shop: string, priceLkr: number, inStock = true, stale = false) => ({
  shop,
  priceLkr,
  inStock,
  stale,
})

test('counts phones listed, and in stock only when recent', () => {
  const { a } = shopStats(
    [
      { offers: [offer('a', 100)] },
      { offers: [offer('a', 100, false)] },
      { offers: [offer('a', 100, true, true)] },
      { offers: [offer('a', 100)] },
    ],
    ['a'],
  )
  assert.equal(a.phones, 4)
  assert.equal(a.inStockPct, 50)
})

test('cheapest only counts phones another shop also has in stock', () => {
  const stats = shopStats(
    [
      { offers: [offer('a', 100), offer('b', 200)] },
      { offers: [offer('a', 300), offer('b', 200)] },
      { offers: [offer('a', 50)] },
      { offers: [offer('a', 50), offer('b', 10, false)] },
    ],
    ['a', 'b'],
  )
  assert.equal(stats.a.cheapestPct, 50)
  assert.equal(stats.b.cheapestPct, 50)
})

test('a tie counts for each tied shop', () => {
  const stats = shopStats([{ offers: [offer('a', 100), offer('b', 100), offer('c', 200)] }], ['a', 'b', 'c'])
  assert.equal(stats.a.cheapestPct, 100)
  assert.equal(stats.b.cheapestPct, 100)
  assert.equal(stats.c.cheapestPct, 0)
})

test('one shop selling a phone under two warranties counts as one phone', () => {
  const { a } = shopStats([{ offers: [offer('a', 100), offer('a', 150)] }], ['a'])
  assert.equal(a.phones, 1)
  assert.equal(a.inStockPct, 100)
  assert.equal(a.cheapestPct, null)
})

test('a shop can be cheapest through its shop warranty offer while its company offer costs more', () => {
  const stats = shopStats([{ offers: [offer('a', 100), offer('a', 300), offer('b', 200)] }], ['a', 'b'])
  assert.equal(stats.a.cheapestPct, 100)
  assert.equal(stats.b.cheapestPct, 0)
})

test('a shop whose listings are all stale has no percentages, not zero', () => {
  const { a } = shopStats([{ offers: [offer('a', 100, true, true), offer('b', 90)] }], ['a'])
  assert.deepEqual(a, { phones: 1, inStockPct: null, cheapestPct: null })
})

test('a shop with no listings gets no percentages, and unknown shops are ignored', () => {
  const stats = shopStats([{ offers: [offer('other', 100)] }], ['a'])
  assert.deepEqual(stats, { a: { phones: 0, inStockPct: null, cheapestPct: null } })
})

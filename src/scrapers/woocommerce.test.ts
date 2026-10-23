import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  assertNotBlocked,
  failedGroupsExceeded,
  isNotNew,
  isUsableVariation,
  pickPriced,
  variantGroups,
  variantTitle,
  warrantyText,
  type StoreProduct,
} from './woocommerce'

// Shaped like doctormobile.lk's "KXD A07", 2026-10-24.
const kxd: StoreProduct = {
  id: 48188,
  name: 'KXD A07',
  permalink: 'https://doctormobile.lk/product/kxd-a07/',
  type: 'variable',
  attributes: [
    { name: 'Capacity', terms: [{ name: '3GB / 32GB', slug: '3gb-32gb' }, { name: '4GB / 64GB', slug: '4gb-64gb' }] },
    { name: 'Colour', terms: [{ name: 'Orange', slug: 'orange' }, { name: 'Dark Blue', slug: 'dark-blue' }] },
    { name: 'Warranty', terms: [{ name: '1 Year Company Warranty', slug: '1-year-company-warranty' }] },
  ],
  variations: [
    { id: 1, attributes: [{ name: 'Capacity', value: '3gb-32gb' }, { name: 'Colour', value: 'orange' }, { name: 'Warranty', value: '1-year-company-warranty' }] },
    { id: 2, attributes: [{ name: 'Capacity', value: '3gb-32gb' }, { name: 'Colour', value: 'dark-blue' }, { name: 'Warranty', value: '1-year-company-warranty' }] },
    { id: 3, attributes: [{ name: 'Capacity', value: '4gb-64gb' }, { name: 'Colour', value: 'orange' }, { name: 'Warranty', value: '1-year-company-warranty' }] },
  ],
}

test('variantGroups merges colours and keeps every other choice', () => {
  const groups = variantGroups(kxd)
  assert.equal(groups.length, 2)
  assert.deepEqual(groups[0], {
    attrs: { Capacity: '3GB / 32GB', Warranty: '1 Year Company Warranty' },
    variationIds: [1, 2],
  })
  assert.deepEqual(groups[1].variationIds, [3])
})

test('variantGroups is empty for a simple product', () => {
  assert.deepEqual(variantGroups({ id: 9, name: 'Galaxy A18 6GB | 128GB', permalink: 'x', type: 'simple' }), [])
})

test('variantTitle adds the options but never the warranty', () => {
  assert.equal(
    variantTitle('KXD A07', { Capacity: '3GB / 32GB', Warranty: '1 Year Company Warranty' }),
    'KXD A07 3GB / 32GB',
  )
  assert.equal(variantTitle('Tecno Camon 50 Pro 8GB RAM 256GB 5G', {}), 'Tecno Camon 50 Pro 8GB RAM 256GB 5G')
})

test('warrantyText prefers the chosen option, then the attribute, then the description', () => {
  assert.equal(warrantyText(kxd, { Warranty: '6 Months Hardware' }), '6 Months Hardware')
  assert.equal(warrantyText(kxd), '1 Year Company Warranty')
  const genius: StoreProduct = {
    id: 7,
    name: 'Honor Choice T10 4G 3GB | 32GB',
    permalink: 'x',
    short_description: '<p>Battery: 5000 mAh lithium-polymer One Year Company Warranty + TRCSL Approved</p>',
  }
  assert.match(warrantyText(genius) ?? '', /One Year Company Warranty/)
  assert.equal(warrantyText({ id: 8, name: 'Galaxy A56', permalink: 'x' }), null)
})

test('isNotNew drops used stock by name or by shelf', () => {
  assert.equal(isNotNew({ id: 1, name: 'iPhone 13 128GB (Used)', permalink: 'x' }), true)
  assert.equal(
    isNotNew({ id: 2, name: 'iPhone 14 Pro', permalink: 'x', categories: [{ name: 'Premium Pre-Owned Phones', slug: 'premium-pre-owned-phones' }] }),
    true,
  )
  assert.equal(isNotNew({ id: 3, name: 'Galaxy S26 Ultra', permalink: 'x', categories: [{ name: 'Mobile Phones' }] }), false)
})

const variation = (over: Partial<StoreProduct>): StoreProduct => ({
  id: 1,
  name: 'v',
  permalink: 'x',
  prices: { price: '1000000' },
  is_in_stock: true,
  ...over,
})

test('isUsableVariation needs a non-null object with a numeric id', () => {
  assert.equal(isUsableVariation(null), false)
  assert.equal(isUsableVariation('x'), false)
  assert.equal(isUsableVariation({ code: 'rest_no_route', message: 'nope' }), false)
  assert.equal(isUsableVariation({ id: '12' }), false)
  assert.equal(isUsableVariation({ id: 12 }), true)
})

test('pickPriced takes the first buyable variation, else the first with a price', () => {
  const outOfStock = variation({ id: 1, is_in_stock: false, prices: { price: '900' } })
  const backorder = variation({ id: 2, is_on_backorder: true, prices: { price: '950' } })
  const buyableOne = variation({ id: 3, prices: { price: '1000' } })
  assert.equal(pickPriced([outOfStock, backorder, buyableOne])?.id, 3)
  assert.equal(pickPriced([outOfStock, backorder])?.id, 1)
})

test('pickPriced ignores unusable and unpriced entries', () => {
  const unpriced = variation({ id: 4, prices: { price: '' } })
  assert.equal(pickPriced([null, undefined, { message: 'x' }, unpriced]), null)
  assert.equal(pickPriced([null, unpriced, variation({ id: 5 })])?.id, 5)
  assert.equal(pickPriced([]), null)
})

test('failedGroupsExceeded needs 10 groups and more than 10% failing', () => {
  assert.equal(failedGroupsExceeded(9, 9), false)
  assert.equal(failedGroupsExceeded(1, 10), false)
  assert.equal(failedGroupsExceeded(2, 10), true)
  assert.equal(failedGroupsExceeded(10, 100), false)
  assert.equal(failedGroupsExceeded(11, 100), true)
})

test('assertNotBlocked throws on 403 and 429 only, naming shop, status and url', () => {
  assert.throws(() => assertNotBlocked('shop.lk', 403, 'https://shop.lk/a'), /shop\.lk.*403.*https:\/\/shop\.lk\/a/)
  assert.throws(() => assertNotBlocked('shop.lk', 429, 'https://shop.lk/a'), /429/)
  assert.doesNotThrow(() => assertNotBlocked('shop.lk', 404, 'https://shop.lk/a'))
  assert.doesNotThrow(() => assertNotBlocked('shop.lk', 200, 'https://shop.lk/a'))
})

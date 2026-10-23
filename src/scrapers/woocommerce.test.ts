import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isNotNew, variantGroups, variantTitle, warrantyText, type StoreProduct } from './woocommerce'

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

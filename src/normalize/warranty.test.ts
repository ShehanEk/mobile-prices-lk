import assert from 'node:assert/strict'
import { test } from 'node:test'

import { classifyWarranty, warrantyOf } from './warranty'

const cases: [string | null, string | null][] = [
  ['1 Year Company Warranty', 'company'],
  ['1 Year Softlogic', 'company'],
  ['1 Year Genxt Company', 'company'],
  // "Gnext" is how several shops misspell GenXT.
  ['1 Year Gnext Warranty', 'company'],
  ['1 Year Gnext Warranty 2nd Year Celltronics Software Warranty', 'company'],
  ['1 Year Abans', 'company'],
  ['1 Year Huawei', 'company'],
  ['2 Year Oppo Company', 'company'],
  ['1 Year Vivo', 'company'],
  ['1 Year Agent Warranty', 'company'],
  ['1 Year Authorized Company', 'company'],
  ['18 Months Company Warranty', 'company'],
  ['18-Month Company Warranty', 'company'],
  ['1st Year Company Warranty 2nd Year Celltronics Software Warranty', 'company'],
  ['1st Year GENXT Warranty 2nd Year Celltronics Software Warranty', 'company'],
  ['ve To Stock Availability 1 Year Company Warranty', 'company'],
  ['1 Year AppleCare (International)', 'apple'],
  ['1 Year Apple Care Warranty', 'apple'],
  ['1 Year AppleCare Warranty 2nd Year Celltronics Software Warranty', 'apple'],
  ['le A20 Pro 2nm chip One Year Apple Care Warranty', 'apple'],
  ['1 Year Software', 'shop'],
  ['6 Months Hardware + 1 Year Software Warranty', 'shop'],
  ['Six Months Hardware + One Year Software Warranty', 'shop'],
  ['6 Month Hardware and 1 Year Software Warranty', 'shop'],
  ['1 Year Hardware + 1 Year Software (+Rs.7,000.00)', 'shop'],
  ['1 Year Software & 1st 6 Months Hardware Warranty', 'shop'],
  ['2 Years Warranty', 'unstated'],
  ['2-YEAR WARRANTY', 'unstated'],
  ['1 Year Warranty', 'unstated'],
  ['18 Months Warranty', 'unstated'],
  [null, 'unstated'],
  ['', 'unstated'],
  ['S FRONT SCREEN & BACK GLASS REPLACEMENT WARRANTY TWO YEARS WARRANTY + TRCSL APPROVED', null],
]

for (const [text, expected] of cases) {
  test(`classifyWarranty(${JSON.stringify(text)}) = ${expected}`, () => {
    assert.equal(classifyWarranty(text), expected)
  })
}

test('warrantyOf prefers the chosen option, then the payload text, then the title', () => {
  assert.deepEqual(
    warrantyOf('Galaxy A57 5G 8GB / 256GB', { variant: { Warranty: '6 Month Hardware and 1 Year Software Warranty' }, warrantyText: 'x' }),
    { text: '6 Month Hardware and 1 Year Software Warranty', warranty: 'shop' },
  )
  assert.deepEqual(
    warrantyOf('Honor X5B 4GB | 64GB', { variant: {}, warrantyText: 'One Year Company Warranty + TRCSL Approved' }),
    { text: 'One Year Company Warranty + TRCSL Approved', warranty: 'company' },
  )
  assert.deepEqual(
    warrantyOf('Samsung Galaxy A37 5G 12GB | 256GB Company Warranty', { variant: {}, warrantyText: null }),
    { text: 'Company Warranty', warranty: 'company' },
  )
  assert.deepEqual(
    warrantyOf('Apple iPhone Air 256GB with Apple Care', { variant: {}, warrantyText: null }),
    { text: 'Apple Care', warranty: 'apple' },
  )
  assert.deepEqual(warrantyOf('Google Pixel 9a 128GB', { variant: {}, warrantyText: null }), { text: null, warranty: 'unstated' })
})

test('shop wording beats a phone brand name, but not a distributor or "company"', () => {
  assert.equal(classifyWarranty('1 Year Samsung Software Warranty'), 'shop')
  assert.equal(classifyWarranty('Google Pixel 1 Year Software'), 'shop')
  assert.equal(classifyWarranty('1 Year Softlogic, 1 Year Software'), 'company')
})

test('warrantyOf skips a blank chosen option', () => {
  assert.deepEqual(
    warrantyOf('Honor X5B 4GB | 64GB', { variant: { Warranty: '  ' }, warrantyText: '1 Year Company Warranty' }),
    { text: '1 Year Company Warranty', warranty: 'company' },
  )
})

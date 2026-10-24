import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  brandsIn,
  cacheUse,
  capInput,
  estimateCostUsd,
  selectCandidates,
  titleEligible,
} from './model-fallback'

test('brandsIn finds brand and family words anywhere in the title', () => {
  assert.deepEqual(brandsIn('New Galaxy A57 5G 8GB 256GB'), ['Samsung'])
  assert.deepEqual(brandsIn('Brand new Xiaom Redmi 15 8GB 256GB'), ['Xiaomi'])
  assert.deepEqual(brandsIn('CMF by Nothing Phone 2 Pro 8GB 256GB'), ['Nothing'])
  assert.deepEqual(brandsIn('Smart phone 8GB 128GB'), [])
  // "moto" is a word on its own, not the start of "motorbike".
  assert.deepEqual(brandsIn('Motorbike phone holder 128GB'), [])
})

test('ruling 1: no-model with storage goes to the model', () => {
  assert.equal(titleEligible('no-model', 'Samsung 8GB RAM 256GB'), true)
})

test('ruling 1: brand drop only with a brand/family word and storage', () => {
  assert.equal(titleEligible('brand', 'Brand New iPhone 17 Pro 256GB'), true)
  assert.equal(titleEligible('brand', 'Hono H1 Plus 4GB 64GB'), false)
  assert.equal(titleEligible('brand', 'Brand New iPhone 17 Pro'), false)
})

test('ruling 1: never used, not-a-phone, no-storage, no-ram', () => {
  for (const drop of ['used', 'not-a-phone', 'no-storage', 'no-ram'] as const) {
    assert.equal(titleEligible(drop, 'Samsung Galaxy A57 8GB 256GB'), false, drop)
  }
})

const phone = (phoneId: string, brand: string, ramGb: number | null, storageGb: number) => ({
  phoneId,
  brand,
  model: phoneId,
  ramGb,
  storageGb,
  esimOnly: false,
})

const pool = [
  phone('samsung-galaxy-a57-8gb-256gb', 'Samsung', 8, 256),
  phone('samsung-galaxy-a57-12gb-256gb', 'Samsung', 12, 256),
  phone('samsung-galaxy-a57-8gb-128gb', 'Samsung', 8, 128),
  phone('xiaomi-redmi-15-8gb-256gb', 'Xiaomi', 8, 256),
  phone('apple-iphone-17-256gb', 'Apple', null, 256),
]

test('ruling 2: same storage, same RAM when stated, same brand', () => {
  const ids = selectCandidates('New Galaxy A57 8GB RAM 256GB', pool).map((c) => c.phoneId)
  assert.deepEqual(ids, ['samsung-galaxy-a57-8gb-256gb'])
})

test('ruling 2: no RAM in the title keeps every RAM of that storage', () => {
  const ids = selectCandidates('New Galaxy A57 256GB', pool).map((c) => c.phoneId)
  assert.deepEqual(ids, ['samsung-galaxy-a57-12gb-256gb', 'samsung-galaxy-a57-8gb-256gb'])
})

test('ruling 2: Apple has no RAM, so a stated RAM does not rule it out', () => {
  const ids = selectCandidates('Brand New iPhone 17 8GB RAM 256GB', pool).map((c) => c.phoneId)
  assert.deepEqual(ids, ['apple-iphone-17-256gb'])
})

test('ruling 2: no storage or no matching phone means no candidates', () => {
  assert.deepEqual(selectCandidates('New Galaxy A57', pool), [])
  assert.deepEqual(selectCandidates('New Galaxy A57 8GB 512GB', pool), [])
})

test('ruling 2: capped at 150', () => {
  const many = Array.from({ length: 200 }, (_, i) => phone(`samsung-x${i}-8gb-256gb`, 'Samsung', 8, 256))
  assert.equal(selectCandidates('Galaxy thing 8GB 256GB', many).length, 150)
})

test('ruling 2: candidates carry what the prompt needs', () => {
  const [c] = selectCandidates('Galaxy A57 8GB RAM 256GB', pool)
  assert.deepEqual(c, {
    phoneId: 'samsung-galaxy-a57-8gb-256gb',
    brand: 'Samsung',
    model: 'samsung-galaxy-a57-8gb-256gb',
    ramGb: 8,
    storageGb: 256,
  })
})

const now = new Date('2026-10-24T12:00:00Z')
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000)

test('ruling 3: nothing cached means ask', () => {
  assert.equal(cacheUse(undefined, now), 'ask')
})

test('ruling 3: an accepted answer is reused forever', () => {
  assert.equal(cacheUse({ answer: 'x', confidence: 'high', decidedAt: daysAgo(400) }, now), 'reuse')
})

test('ruling 3: a decline is reused for 7 days, then asked again', () => {
  assert.equal(cacheUse({ answer: null, confidence: 'low', decidedAt: daysAgo(6.9) }, now), 'reuse')
  assert.equal(cacheUse({ answer: null, confidence: 'low', decidedAt: daysAgo(7) }, now), 'ask')
})

test('ruling 3: a low-confidence answer counts as a decline', () => {
  assert.equal(cacheUse({ answer: 'x', confidence: 'low', decidedAt: daysAgo(1) }, now), 'reuse')
  assert.equal(cacheUse({ answer: 'x', confidence: 'low', decidedAt: daysAgo(8) }, now), 'ask')
})

test('ruling 3: an accepted id no longer on offer is asked again', () => {
  const d = { answer: 'gone-phone', confidence: 'high', decidedAt: daysAgo(1) }
  assert.equal(cacheUse(d, now, false), 'ask')
  assert.equal(cacheUse(d, now, true), 'reuse')
  // A decline has no id to check, so the flag does not apply.
  assert.equal(cacheUse({ answer: null, confidence: 'low', decidedAt: daysAgo(1) }, now, false), 'reuse')
})

test('decision input is capped at 1,000 characters', () => {
  assert.equal(capInput('short'), 'short')
  assert.equal(capInput('x'.repeat(1000)), 'x'.repeat(1000))
  assert.equal(capInput('x'.repeat(5000)), 'x'.repeat(1000))
  // Counted in code points, so an emoji is never cut in half.
  const emoji = '📱'.repeat(1200)
  assert.equal([...capInput(emoji)].length, 1000)
  assert.equal(capInput(emoji), '📱'.repeat(1000))
})

test('cost: Haiku 5.5 at $0.10 / $0.50 per 1M tokens', () => {
  assert.equal(estimateCostUsd(1_000_000, 1_000_000), 0.6)
  assert.equal(estimateCostUsd(0, 0), 0)
})

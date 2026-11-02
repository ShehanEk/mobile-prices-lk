import assert from 'node:assert/strict'
import { test } from 'node:test'

import { chooseReviews, durationSeconds, matchModel, type Candidate } from './youtube'

const models = [
  { brand: 'Samsung', model: 'Galaxy S26' },
  { brand: 'Samsung', model: 'Galaxy S26 Ultra' },
  { brand: 'Samsung', model: 'Galaxy A17' },
  { brand: 'Samsung', model: 'Galaxy A17 5G' },
  { brand: 'Samsung', model: 'Galaxy A37 5G' },
  { brand: 'Apple', model: 'iPhone 17' },
  { brand: 'Apple', model: 'iPhone 17 Pro' },
  { brand: 'Apple', model: 'iPhone 17 Pro Max' },
]

const matched = (title: string) => matchModel(title, models)?.model ?? null

test('a review title matches the exact model', () => {
  assert.equal(matched('Samsung Galaxy S26 Ultra Review: Almost Perfect!'), 'Galaxy S26 Ultra')
  assert.equal(matched('iPhone 17 Pro Max review - a week later'), 'iPhone 17 Pro Max')
  assert.equal(matched('GALAXY S26 REVIEW'), 'Galaxy S26')
})

test('a bigger model never lands on the smaller one', () => {
  assert.equal(matched('iPhone 17 Pro review'), 'iPhone 17 Pro')
  assert.equal(matched('Galaxy S26 FE Review'), null)
  assert.equal(matched('Galaxy S26+ Review'), null)
  assert.equal(matched('Galaxy S26 Plus Review'), null)
  assert.equal(matched('iPhone 17e review'), null)
})

test('only reviews of one phone count', () => {
  assert.equal(matched('iPhone 17 Pro unboxing'), null)
  assert.equal(matched('Galaxy S26 Ultra vs iPhone 17 Pro Max review'), null)
  assert.equal(matched('Galaxy S26 Ultra Comparison Review'), null)
  assert.equal(matched('Reviewing the review of the Galaxy S26 #shorts'), null)
})

test('4G and 5G go to the model sold that way', () => {
  assert.equal(matched('Galaxy A17 5G review'), 'Galaxy A17 5G')
  assert.equal(matched('Galaxy A17 review'), 'Galaxy A17')
  assert.equal(matched('Galaxy A37 review'), 'Galaxy A37 5G')
  assert.equal(matched('Galaxy A37 4G review'), null)
})

test('a model with a generic name needs its brand right before it', () => {
  const list = [
    { brand: 'Xiaomi', model: '14' },
    { brand: 'Xiaomi', model: '8 Lite' },
    { brand: 'realme', model: '6' },
    { brand: 'OnePlus', model: '13S' },
    { brand: 'Honor', model: 'Magic V5' },
    { brand: 'Nothing', model: 'Phone (3)' },
  ]
  const m = (title: string) => matchModel(title, list)?.model ?? null
  assert.equal(m('Xiaomi 14 review'), '14')
  assert.equal(m('Huawei Matebook 14 (2024) Review | Brilliant Everyday OLED Laptop!'), null)
  assert.equal(m('Honor Magic 8 Lite Review | Battery Life For Days!'), null)
  assert.equal(m('Realme GT 6 full review'), null)
  assert.equal(m('One Plus 13S Review: What\'s the S For?'), '13S')
  assert.equal(m('Honor Magic V5 Review'), 'Magic V5')
  assert.equal(m('Nothing Phone (3) review'), 'Phone (3)')
})

test('a further model code makes a different phone', () => {
  const list = [{ brand: 'Nokia', model: 'HMD Fusion' }]
  assert.equal(matchModel('Best Phone For Teens? | HMD Fusion X1 Review', list), null)
  assert.equal(matchModel('HMD Fusion review', list)?.model, 'HMD Fusion')
  assert.equal(matchModel('HMD Fusion 2025 review', list)?.model, 'HMD Fusion')
})

test('a rival named later in the title does not take the review', () => {
  const list = [
    { brand: 'Honor', model: 'Magic V5' },
    { brand: 'Samsung', model: 'Galaxy Z Fold 7' },
  ]
  assert.equal(matchModel('Honor Magic V5 Review | Samsung Galaxy Z Fold 7 Destroyed?', list)?.model, 'Magic V5')
})

test('durationSeconds reads YouTube durations', () => {
  assert.equal(durationSeconds('PT12M34S'), 754)
  assert.equal(durationSeconds('PT1H2M'), 3720)
  assert.equal(durationSeconds('PT45S'), 45)
  assert.equal(durationSeconds('P0D'), 0)
})

const candidate = (over: Partial<Candidate>): Candidate => ({
  brand: 'Apple',
  model: 'iPhone 17',
  videoId: 'aaaaaaaaaaa',
  title: 'iPhone 17 review',
  channel: 'One',
  publishedAt: '2026-01-01T00:00:00Z',
  ...over,
})

test('chooseReviews keeps one per channel, newest, in channel order, at most three', () => {
  const rows = chooseReviews(
    [
      candidate({ videoId: 'old', channel: 'Two', publishedAt: '2026-01-01T00:00:00Z' }),
      candidate({ videoId: 'new', channel: 'Two', publishedAt: '2026-02-01T00:00:00Z' }),
      candidate({ videoId: 'c', channel: 'Four' }),
      candidate({ videoId: 'd', channel: 'Three' }),
      candidate({ videoId: 'e', channel: 'One' }),
      candidate({ videoId: 'other', model: 'iPhone 17 Pro', channel: 'Four' }),
    ],
    ['One', 'Two', 'Three', 'Four'],
  )
  const of = (model: string) => rows.filter((r) => r.model === model)
  assert.deepEqual(
    of('iPhone 17').map((r) => [r.videoId, r.position]),
    [
      ['e', 0],
      ['new', 1],
      ['d', 2],
    ],
  )
  assert.deepEqual(
    of('iPhone 17 Pro').map((r) => [r.videoId, r.position]),
    [['other', 0]],
  )
})

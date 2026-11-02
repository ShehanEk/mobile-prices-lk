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

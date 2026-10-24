import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Warranty } from '@/db/schema'

import { dropStale, findSuperseded } from './superseded'

const row = (warranty: Warranty, at: string, url = 'https://s.lk/a', phoneId = 'p1') => ({
  phoneId,
  shop: 'geniusmobile.lk',
  warranty,
  url,
  scrapedAt: new Date(at),
})

const DAY1 = '2026-10-23T21:10:00Z' // 24 Oct, Sri Lanka
const DAY1_LATER = '2026-10-23T21:40:00Z'
const DAY2 = '2026-10-24T21:10:00Z' // 25 Oct, Sri Lanka

test('the same product under a new class replaces the old one, and so does its same-day history', () => {
  const r = findSuperseded([row('unstated', DAY1)], [row('company', DAY1)], [row('company', DAY1)])
  assert.deepEqual(r.listings, [row('unstated', DAY1)])
  assert.deepEqual(r.history, [{ phoneId: 'p1', shop: 'geniusmobile.lk', warranty: 'unstated', recordedOn: '2026-10-24' }])
})

test('history goes only on days this run writes for the product; earlier days stay', () => {
  const r = findSuperseded([row('unstated', DAY1)], [row('company', DAY2)], [row('company', DAY2)])
  assert.equal(r.listings.length, 1)
  assert.deepEqual(r.history, [{ phoneId: 'p1', shop: 'geniusmobile.lk', warranty: 'unstated', recordedOn: '2026-10-25' }])
})

test('a stored row scraped after the new one is left alone', () => {
  const r = findSuperseded([row('unstated', DAY2)], [row('company', DAY1)], [row('company', DAY1)])
  assert.deepEqual(r, { listings: [], history: [] })
})

test('another url, shop or phone is another product', () => {
  const stored = [
    row('unstated', DAY1, 'https://s.lk/other'),
    { ...row('unstated', DAY1), shop: 'other.lk' },
    row('unstated', DAY1, 'https://s.lk/a', 'p2'),
  ]
  const r = findSuperseded(stored, [row('company', DAY1)], [row('company', DAY1)])
  assert.deepEqual(r, { listings: [], history: [] })
})

test('a key this run writes is never removed, even for the same product', () => {
  // One product offered in two classes, both written this run.
  const written = [row('company', DAY1), row('shop', DAY1)]
  const r = findSuperseded([row('company', DAY1), row('shop', DAY1)], written, written)
  assert.deepEqual(r, { listings: [], history: [] })
})

test('a history point this run writes is kept', () => {
  // The old class is also written, for another product, on the same day.
  const written = [row('company', DAY1), row('unstated', DAY1, 'https://s.lk/b')]
  const r = findSuperseded([row('unstated', DAY1)], [row('company', DAY1)], written)
  assert.equal(r.listings.length, 1)
  assert.deepEqual(r.history, [])
})

test('the history day is the Colombo day, not the UTC day', () => {
  // 18:40Z on the 23rd is 00:10 on the 24th in Colombo.
  const r = findSuperseded([row('unstated', '2026-10-23T17:50:00Z')], [row('company', '2026-10-23T18:40:00Z')], [row('company', '2026-10-23T18:40:00Z')])
  assert.deepEqual(r.history, [{ phoneId: 'p1', shop: 'geniusmobile.lk', warranty: 'unstated', recordedOn: '2026-10-24' }])
})

test('running again changes nothing', () => {
  const written = [row('company', DAY1_LATER)]
  assert.equal(findSuperseded([row('unstated', DAY1), row('company', DAY1)], written, written).listings.length, 1)
  // What the first run leaves behind: only the written class.
  assert.deepEqual(findSuperseded([row('company', DAY1_LATER)], written, written), { listings: [], history: [] })
})

const DAYS = [
  '2026-10-19T21:10:00Z',
  '2026-10-20T21:10:00Z',
  '2026-10-21T21:10:00Z',
  '2026-10-22T21:10:00Z',
  '2026-10-23T21:10:00Z',
] // 20 to 24 Oct, Sri Lanka

test('a redo with two classes of one url keeps only the later one', () => {
  const unstated = row('unstated', DAYS[0])
  const company = row('company', DAYS[4])
  assert.deepEqual(dropStale([unstated, company]), [company])
  assert.deepEqual(dropStale([company, unstated]), [company])
})

test('stale is judged per product, and an equal scrape time is not stale', () => {
  const other = row('unstated', DAYS[0], 'https://s.lk/other')
  const same = [row('unstated', DAY1), row('company', DAY1)]
  assert.deepEqual(dropStale([other, row('company', DAYS[4])]), [other, row('company', DAYS[4])])
  assert.deepEqual(dropStale(same), same)
})

test('after a rule change the old class goes on every day the new class is written', () => {
  // company is now written for all five days; unstated is still stored for the last.
  const history = DAYS.map((d) => row('company', d))
  const r = findSuperseded([row('unstated', DAYS[4])], [row('company', DAYS[4])], history)
  assert.deepEqual(
    r.history.map((h) => h.recordedOn),
    ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'],
  )
  assert.ok(r.history.every((h) => h.warranty === 'unstated'))
})

test('a (key, day) this run writes is never deleted, even for the same product', () => {
  // Day 3 of the same product is also written as unstated: kept.
  const history = [...DAYS.map((d) => row('company', d)), row('unstated', DAYS[2])]
  const r = findSuperseded([row('unstated', DAYS[4])], [row('company', DAYS[4])], history)
  assert.equal(r.history.length, 4)
  assert.ok(!r.history.some((h) => h.recordedOn === '2026-10-22'))
})

test('the history days of another product do not delete this product history', () => {
  const r = findSuperseded([row('unstated', DAY1)], [row('company', DAY1)], [row('company', DAY2, 'https://s.lk/other')])
  assert.equal(r.listings.length, 1)
  assert.deepEqual(r.history, [])
})

test('a product that changed class but lost its new key to another product is still replaced', () => {
  // A (url a) was unstated and is now company; B (url b) is also company, cheaper, and holds that key.
  const a = row('company', DAY2, 'https://s.lk/a')
  const b = row('company', DAY2, 'https://s.lk/b')
  const stored = [row('unstated', DAY1), row('company', DAY1, 'https://s.lk/b')]
  // Winners only: A's change is invisible.
  assert.deepEqual(findSuperseded(stored, [b], [b]), { listings: [], history: [] })
  // With every candidate and every scraped row it is seen.
  const r = findSuperseded(stored, [b], [b], [a, b], [a, b])
  assert.deepEqual(r.listings, [row('unstated', DAY1)])
  assert.deepEqual(r.history, [{ phoneId: 'p1', shop: 'geniusmobile.lk', warranty: 'unstated', recordedOn: '2026-10-25' }])
})

test('a same-class candidate that lost its key does not supersede that class', () => {
  // A is still company, but lost the key to B: nothing about A changed.
  const a = row('company', DAY2, 'https://s.lk/a')
  const b = row('company', DAY2, 'https://s.lk/b')
  const r = findSuperseded([row('company', DAY1, 'https://s.lk/a')], [b], [b], [a, b], [a, b])
  assert.deepEqual(r, { listings: [], history: [] })
})

test('two classes of one product scraped the same day are both kept, whatever the chunk time', () => {
  // Inserted in different 100-row chunks of one scrape, so a few minutes apart.
  const early = row('unstated', '2026-10-23T21:10:00Z')
  const late = row('company', '2026-10-23T21:14:30Z')
  assert.deepEqual(dropStale([early, late]), [early, late])
  assert.deepEqual(dropStale([late, early]), [late, early])
})

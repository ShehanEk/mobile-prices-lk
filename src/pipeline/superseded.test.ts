import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Warranty } from '@/db/schema'

import { findSuperseded } from './superseded'

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

test('history from an earlier day stays', () => {
  const r = findSuperseded([row('unstated', DAY1)], [row('company', DAY2)], [row('company', DAY2)])
  assert.equal(r.listings.length, 1)
  assert.deepEqual(r.history, [])
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
  // 23:50Z and 00:10Z fall on two UTC dates but one Colombo day (24 Oct).
  const same = findSuperseded([row('unstated', '2026-10-23T23:50:00Z')], [row('company', '2026-10-24T00:10:00Z')], [])
  assert.equal(same.history.length, 1)
  // 17:50Z and 18:40Z share a UTC date but straddle Colombo midnight.
  const split = findSuperseded([row('unstated', '2026-10-23T17:50:00Z')], [row('company', '2026-10-23T18:40:00Z')], [])
  assert.equal(split.listings.length, 1)
  assert.deepEqual(split.history, [])
})

test('running again changes nothing', () => {
  const written = [row('company', DAY1_LATER)]
  assert.equal(findSuperseded([row('unstated', DAY1), row('company', DAY1)], written, written).listings.length, 1)
  // What the first run leaves behind: only the written class.
  assert.deepEqual(findSuperseded([row('company', DAY1_LATER)], written, written), { listings: [], history: [] })
})

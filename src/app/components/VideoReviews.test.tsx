import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { VideoReviews } from './VideoReviews'

// Made-up values: the tests check structure, not real videos.
const review = { videoId: 'abc123XYZ_-', title: 'Acme One review', channel: 'Test Channel' }

test('no reviews means no section at all', () => {
  assert.equal(renderToStaticMarkup(<VideoReviews reviews={[]} />), '')
})

test('a review shows its title, channel and thumbnail, with no player until play is pressed', () => {
  const out = renderToStaticMarkup(<VideoReviews reviews={[review]} />)
  assert.match(out, />Video reviews<\/h2>/)
  assert.ok(out.includes('Acme One review'))
  assert.ok(out.includes('Test Channel'))
  assert.ok(out.includes('https://i.ytimg.com/vi/abc123XYZ_-/hqdefault.jpg'))
  assert.match(out, /aria-label="Play Acme One review"/)
  assert.ok(!out.includes('<iframe'))
})

test('one card per review', () => {
  const out = renderToStaticMarkup(<VideoReviews reviews={[review, { ...review, videoId: 'def456XYZ_-' }]} />)
  assert.equal(out.match(/<button/g)?.length, 2)
})

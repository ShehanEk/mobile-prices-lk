import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { PhoneSpecs } from '@/queries/phones'

import { SpecsBlock } from './SpecsBlock'

// Made-up values: the tests check structure, not real specs.
const specs: PhoneSpecs = {
  gsmarenaUrl: 'https://www.gsmarena.com/acme_one-0001.php',
  mainCamera: 'Test camera',
  display: 'Test display',
  network: 'Test network',
  colours: 'Test colours',
}

const html = (s: PhoneSpecs | null) => renderToStaticMarkup(<SpecsBlock brand="Acme" model="One Pro" specs={s} />)

test('a match shows the four rows and credits the page they came from', () => {
  const out = html(specs)
  for (const label of ['Main camera', 'Display', 'Network', 'Colours']) assert.match(out, new RegExp(`<dt[^>]*>${label}</dt>`))
  for (const v of ['Test camera', 'Test display', 'Test network', 'Test colours']) assert.ok(out.includes(v))
  assert.match(out, /<a href="https:\/\/www\.gsmarena\.com\/acme_one-0001\.php"[^>]*>Specs: GSMArena\.com →<\/a>/)
  assert.ok(!out.includes('Full specs on GSMArena'))
})

test('a missing field drops its row', () => {
  const out = html({ ...specs, network: null })
  assert.ok(!out.includes('>Network<'))
  assert.equal(out.match(/<dt/g)?.length, 3)
})

test('no match links only to GSMArena search for brand and model', () => {
  const out = html(null)
  assert.ok(!out.includes('<dt'))
  assert.ok(!out.includes('<h2'))
  assert.match(out, /href="https:\/\/www\.gsmarena\.com\/results\.php3\?sQuickSearch=yes&amp;sName=Acme%20One%20Pro"/)
  assert.match(out, />Full specs on GSMArena →<\/a>/)
})

test('a match with no field values still credits the page, without an empty card', () => {
  const out = html({ ...specs, mainCamera: null, display: null, network: null, colours: null })
  assert.ok(!out.includes('<dt'))
  assert.ok(out.includes('href="https://www.gsmarena.com/acme_one-0001.php"'))
})

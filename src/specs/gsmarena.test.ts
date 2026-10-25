import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isChallenge, makerPageUrl, parseMakerPage, parseSpecPage, pickCandidate, type Candidate } from './gsmarena'

/*
 * Hand-written pages that copy only the structure of m.gsmarena.com as the
 * probe saw it on 2026-10-25 (ids, classes, data-spec keys). Names, ids and
 * values are made up. Real GSMArena pages are never saved in the repo or
 * opened in an agent session: its licence forbids feeding them to AI.
 */
const MAKER_PAGE = `<!doctype html><html><head><title>All Samsung phones</title></head><body>
<div id="list-brands" class="material-card"><div class="general-menu"><ul>
<li><a href="samsung_galaxy_s26_ultra-90001.php"><img src="a.jpg"><strong>Galaxy S26 Ultra</strong></a></li>
<li><a href="samsung_galaxy_s26-90002.php"><img src="b.jpg"><strong>Galaxy S26</strong></a></li>
<li><a href="samsung_galaxy_a16-90003.php"><img src="c.jpg"><strong>Galaxy A16</strong></a></li>
<li><a href="samsung_galaxy_a16_5g-90004.php"><img src="d.jpg"><strong>Galaxy A16</strong></a></li>
<li><a href="samsung_galaxy_tab_s12+_5g-90005.php"><img src="e.jpg"><strong>Galaxy Tab S12+</strong></a></li>
<div class="adv-mid"></div>
<li><a href="samsung_galaxy_a57_5g-90006.php"><img src="f.jpg"><strong>Galaxy A57</strong></a></li>
</ul></div></div>
<div id="nav-review-page-temp"><div class="page"><span class="current">1</span><span class="count">of 29</span></div>
<a href="samsung-phones-f-9-0-p2.php" class="prevnextbutton"></a><a href="samsung-phones-f-9-0-p29.php" id="last-button"></a></div>
</body></html>`

const SPEC_PAGE = `<!doctype html><html><head><title>Samsung Galaxy S26 Ultra - Full phone specifications</title>
<link rel="canonical" href="https://www.gsmarena.com/samsung_galaxy_s26_ultra-90001.php"></head><body>
<h1 class="section nobor">Samsung Galaxy S26 Ultra</h1>
<div id="specs-list">
<table><tbody><tr><th>Network</th></tr><tr><td class="ttl"><a>Technology</a></td><td class="nfo" data-spec="nettech">GSM / HSPA / LTE / 5G</td></tr></tbody></table>
<table><tbody><tr><th>Display</th></tr>
<tr><td class="ttl">Type</td><td class="nfo" data-spec="displaytype">Dynamic LTPO AMOLED 2X, 120Hz, HDR10+, 2600 nits (peak)</td></tr>
<tr><td class="ttl">Size</td><td class="nfo" data-spec="displaysize">6.9 inches, 116.9 cm<sup>2</sup> (~89.9% screen-to-body ratio)</td></tr></tbody></table>
<table><tbody><tr><th>Main Camera</th></tr><tr><td class="ttl">Quad</td><td class="nfo" data-spec="cam1modules">200 MP, f/1.7, (wide)<br />50 MP, f/1.9, (ultrawide)</td></tr></tbody></table>
<table><tbody><tr><th>Misc</th></tr><tr><td class="ttl">Colors</td><td class="nfo" data-spec="colors">Black, Cobalt Violet, White</td></tr></tbody></table>
</div></body></html>`

test('a brand list page gives each phone name and path, and the last page number', () => {
  const page = parseMakerPage(MAKER_PAGE)
  assert.equal(page.title, 'All Samsung phones')
  assert.equal(page.lastPage, 29)
  assert.equal(page.candidates.length, 6)
  assert.deepEqual(page.candidates[0], { name: 'Galaxy S26 Ultra', path: 'samsung_galaxy_s26_ultra-90001.php' })
})

test('a list with no page links is a single page', () => {
  assert.equal(parseMakerPage('<div id="list-brands"><div class="general-menu"><ul></ul></div></div>').lastPage, 1)
})

test('brand list URLs, first page and later pages', () => {
  assert.equal(makerPageUrl({ slug: 'samsung', id: 9 }, 1), 'https://m.gsmarena.com/samsung-phones-9.php')
  assert.equal(makerPageUrl({ slug: 'samsung', id: 9 }, 3), 'https://m.gsmarena.com/samsung-phones-f-9-0-p3.php')
})

const candidates = parseMakerPage(MAKER_PAGE).candidates
const pick = (brand: string, model: string, list: Candidate[] = candidates) => pickCandidate({ brand, model }, list)?.path ?? null

test('rule 1: the model words must match exactly, so S26 is not S26 Ultra', () => {
  assert.equal(pick('Samsung', 'Galaxy S26 Ultra'), 'samsung_galaxy_s26_ultra-90001.php')
  assert.equal(pick('Samsung', 'Galaxy S26'), 'samsung_galaxy_s26-90002.php')
  assert.equal(pick('Samsung', 'Galaxy S25'), null)
})

test('rule 1: a leading brand word and "+" read the same on both sides', () => {
  const list: Candidate[] = [
    { name: 'Infinix Hot 60 Pro', path: 'infinix_hot_60_pro-90020.php' },
    { name: 'Infinix Hot 60 Pro+', path: 'infinix_hot_60_pro+-90021.php' },
  ]
  assert.equal(pick('Infinix', 'Hot 60 Pro+', list), 'infinix_hot_60_pro+-90021.php')
  assert.equal(pick('Infinix', 'Hot 60 Pro', list), 'infinix_hot_60_pro-90020.php')
  assert.equal(pick('Nokia', 'HMD Pulse', [{ name: 'Pulse', path: 'hmd_pulse-90030.php' }]), 'hmd_pulse-90030.php')
})

test('rule 2: a dual-network model takes its network from the GSMArena path', () => {
  assert.equal(pick('Samsung', 'Galaxy A16 5G'), 'samsung_galaxy_a16_5g-90004.php')
  assert.equal(pick('Samsung', 'Galaxy A16 4G'), 'samsung_galaxy_a16-90003.php')
})

test('rule 2: a single-network model takes whatever network GSMArena lists', () => {
  assert.equal(pick('Samsung', 'Galaxy A57'), 'samsung_galaxy_a57_5g-90006.php')
})

test('rule 3: two candidates left after the rules is no match', () => {
  assert.equal(pick('Samsung', 'Galaxy A16'), null)
})

test('a spec page gives the name, source URL, camera, display, network and colours', () => {
  assert.deepEqual(parseSpecPage(SPEC_PAGE), {
    name: 'Samsung Galaxy S26 Ultra',
    url: 'https://www.gsmarena.com/samsung_galaxy_s26_ultra-90001.php',
    mainCamera: '200 MP',
    display: '6.9-inch Dynamic LTPO AMOLED 2X, 120Hz',
    network: '5G',
    colours: 'Black, Cobalt Violet, White',
  })
})

test('network is the newest technology listed', () => {
  const network = (tech: string) => parseSpecPage(`<table><tr><td data-spec="nettech">${tech}</td></tr></table>`).network
  assert.equal(network('GSM / HSPA / LTE'), '4G')
  assert.equal(network('GSM / HSPA'), '3G')
  assert.equal(network('GSM'), '2G')
})

test('a Cloudflare Turnstile page is recognised as a bot check', () => {
  assert.equal(
    isChallenge('<title>GSMArena Turnstile check</title><script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>'),
    true,
  )
  assert.equal(isChallenge(MAKER_PAGE), false)
})

test('a line break inside a list name reads as a space', () => {
  const page = parseMakerPage(
    '<div id="list-brands"><div class="general-menu"><ul><li><a href="samsung_galaxy_s24_ultra-90040.php"><strong>Galaxy S24<br>Ultra</strong></a></li></ul></div></div>',
  )
  assert.deepEqual(page.candidates, [{ name: 'Galaxy S24 Ultra', path: 'samsung_galaxy_s24_ultra-90040.php' }])
  assert.equal(pick('Samsung', 'Galaxy S24 Ultra', page.candidates), 'samsung_galaxy_s24_ultra-90040.php')
})

test('rule 2: a 4G model does not take a 5G-only entry', () => {
  assert.equal(pick('Samsung', 'Galaxy A16 4G', [{ name: 'Galaxy A16', path: 'samsung_galaxy_a16_5g-90050.php' }]), null)
})

test('rule 2: a 5G model does not take an entry with no network marker', () => {
  assert.equal(pick('Samsung', 'Galaxy A16 5G', [{ name: 'Galaxy A16', path: 'samsung_galaxy_a16-90051.php' }]), null)
})

test('rule 2: the network can come from the name alone', () => {
  const list: Candidate[] = [
    { name: 'Galaxy A16 5G', path: 'samsung_galaxy_a16-90052.php' },
    { name: 'Galaxy A16 4G', path: 'samsung_galaxy_a16-90053.php' },
  ]
  assert.equal(pick('Samsung', 'Galaxy A16 5G', list), 'samsung_galaxy_a16-90052.php')
  assert.equal(pick('Samsung', 'Galaxy A16 4G', list), 'samsung_galaxy_a16-90053.php')
})

test('rule 1: Nokia models match with either lead word on either side', () => {
  const nokia = [{ name: 'Nokia G42', path: 'nokia_g42-90060.php' }]
  const hmd = [{ name: 'HMD G42', path: 'hmd_g42-90061.php' }]
  assert.equal(pick('Nokia', 'HMD G42', nokia), 'nokia_g42-90060.php')
  assert.equal(pick('Nokia', 'Nokia G42', hmd), 'hmd_g42-90061.php')
  assert.equal(pick('Nokia', 'G42', nokia), 'nokia_g42-90060.php')
})

test('rule 3: the same entry listed twice is still one candidate', () => {
  const s26 = { name: 'Galaxy S26', path: 'samsung_galaxy_s26-90002.php' }
  assert.equal(pick('Samsung', 'Galaxy S26', [s26, { ...s26 }]), 'samsung_galaxy_s26-90002.php')
  assert.equal(pick('Samsung', 'Galaxy A16', [...candidates, ...candidates]), null)
})

test('a blank spec page has no facts', () => {
  assert.deepEqual(parseSpecPage(''), { name: '', url: null, mainCamera: null, display: null, network: null, colours: null })
})

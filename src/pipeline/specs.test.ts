import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { makerPageUrl } from '@/specs/gsmarena'

import { GAP_MS, pacedGetter, readBrandLists, resolveModel, type Page } from './specs'

/*
 * Made-up pages that copy only the structure of m.gsmarena.com's lists and
 * spec pages. Real pages are never stored here or shown to an agent.
 */
const SAM = { slug: 'samsung', id: 9 }
const HMD = { slug: 'hmd', id: 133 }

function listPage(phones: [name: string, path: string][], current: number, last: number): string {
  const items = phones.map(([n, p]) => `<li><a href="${p}"><strong>${n}</strong></a></li>`).join('')
  const next = current < last ? `<a href="samsung-phones-f-9-0-p${current + 1}.php" class="prevnextbutton"></a>` : ''
  const lastLink = last > 1 ? `<a href="samsung-phones-f-9-0-p${last}.php" id="last-button"></a>` : ''
  return `<title>All Samsung phones</title><div id="list-brands"><div class="general-menu"><ul>${items}</ul></div></div>
    <div id="nav-review-page-temp"><div class="page"><span class="current">${current}</span></div>${next}${lastLink}</div>`
}

const ok = (body: string): Page => ({ status: 200, body, url: 'x', blocked: false })

/** A fake GSMArena: pages by URL, every request recorded. */
function fakeSite(pages: Record<string, Page>) {
  const asked: string[] = []
  const get = async (url: string): Promise<Page> => {
    asked.push(url)
    return pages[url] ?? { status: 404, body: '', url, blocked: false }
  }
  return { asked, get }
}

test('a brand list is read to its last page even after every wanted model is found', async () => {
  const site = fakeSite({
    [makerPageUrl(SAM, 1)]: ok(listPage([['Galaxy S26', 'samsung_galaxy_s26-1.php']], 1, 3)),
    [makerPageUrl(SAM, 2)]: ok(listPage([['Galaxy A16', 'samsung_galaxy_a16-2.php']], 2, 3)),
    [makerPageUrl(SAM, 3)]: ok(listPage([['Galaxy A16', 'samsung_galaxy_a16-3.php']], 3, 3)),
  })
  const list = await readBrandLists([SAM], site.get)
  assert.equal(list.failure, null)
  assert.equal(site.asked.length, 3)
  assert.equal(list.candidates.length, 3)
})

test('a brand with two lists reads both', async () => {
  const site = fakeSite({
    [makerPageUrl(SAM, 1)]: ok(listPage([['Galaxy S26', 'a-1.php']], 1, 1)),
    [makerPageUrl(HMD, 1)]: ok(listPage([['Pulse', 'b-2.php']], 1, 1)),
  })
  const list = await readBrandLists([SAM, HMD], site.get)
  assert.deepEqual(list.candidates.map((c) => c.path), ['a-1.php', 'b-2.php'])
})

test('no phones on page 1 is a list that could not be read', async () => {
  const site = fakeSite({ [makerPageUrl(SAM, 1)]: ok(listPage([], 1, 1)) })
  const list = await readBrandLists([SAM], site.get)
  assert.match(list.failure ?? '', /samsung.*no phones on page 1/)
})

test('a next link with a page count of 1 is a list that could not be read', async () => {
  const body = listPage([['Galaxy S26', 'a-1.php']], 1, 2).replace(/<a [^>]*id="last-button"[^>]*><\/a>/, '')
  const list = await readBrandLists([SAM], fakeSite({ [makerPageUrl(SAM, 1)]: ok(body) }).get)
  assert.match(list.failure ?? '', /samsung.*page count/)
})

test('an empty page before the last page is a list that could not be read', async () => {
  const site = fakeSite({
    [makerPageUrl(SAM, 1)]: ok(listPage([['Galaxy S26', 'a-1.php']], 1, 3)),
    [makerPageUrl(SAM, 2)]: ok(listPage([], 2, 3)),
  })
  const list = await readBrandLists([SAM], site.get)
  assert.match(list.failure ?? '', /samsung.*no phones on page 2 of 3/)
})

test('a list page that is not HTTP 200 is a list that could not be read', async () => {
  const site = fakeSite({
    [makerPageUrl(SAM, 1)]: ok(listPage([['Galaxy S26', 'a-1.php']], 1, 2)),
    [makerPageUrl(SAM, 2)]: { status: 503, body: '', url: 'x', blocked: false },
  })
  const list = await readBrandLists([SAM], site.get)
  assert.match(list.failure ?? '', /samsung.*HTTP 503 on page 2/)
})

const specPage = (nettech: string) =>
  `<link rel="canonical" href="https://www.gsmarena.com/samsung_galaxy_a16_5g-7.php"><h1>Samsung Galaxy A16 5G</h1>
   <table><tr><td data-spec="nettech">${nettech}</td><td data-spec="cam1modules">50 MP, f/1.8</td>
   <td data-spec="displaysize">6.7 inches, 110 cm</td><td data-spec="displaytype">Super AMOLED, 90Hz</td><td data-spec="colors">Blue, Black</td></tr></table>`

const A16_5G = { name: 'Galaxy A16', path: 'samsung_galaxy_a16_5g-7.php' }
const specUrl = 'https://m.gsmarena.com/samsung_galaxy_a16_5g-7.php'

test('a model with one candidate is matched with its four facts and source URL', async () => {
  const site = fakeSite({ [specUrl]: ok(specPage('GSM / HSPA / LTE / 5G')) })
  const r = await resolveModel({ brand: 'Samsung', model: 'Galaxy A16 5G' }, [A16_5G], site.get)
  assert.deepEqual(r, {
    outcome: 'matched',
    path: 'samsung_galaxy_a16_5g-7.php',
    row: {
      brand: 'Samsung',
      model: 'Galaxy A16 5G',
      matched: true,
      gsmarenaUrl: 'https://www.gsmarena.com/samsung_galaxy_a16_5g-7.php',
      mainCamera: '50 MP',
      display: '6.7-inch Super AMOLED, 90Hz',
      network: '5G',
      colours: 'Blue, Black',
    },
  })
  assert.deepEqual(site.asked, [specUrl])
})

test('a model with no candidate is unmatched without a request', async () => {
  const site = fakeSite({})
  const r = await resolveModel({ brand: 'Samsung', model: 'Galaxy Z99' }, [A16_5G], site.get)
  assert.equal(r.outcome, 'unmatched')
  assert.equal(site.asked.length, 0)
})

test('a 5G model is rejected as unmatched when its page says 4G', async () => {
  const site = fakeSite({ [specUrl]: ok(specPage('GSM / HSPA / LTE')) })
  const r = await resolveModel({ brand: 'Samsung', model: 'Galaxy A16 5G' }, [A16_5G], site.get)
  assert.equal(r.outcome, 'unmatched')
  assert.match(r.outcome === 'unmatched' ? r.why : '', /network/)
})

test('a 4G model is rejected when the page it picked says 5G', async () => {
  const path = 'samsung_galaxy_a16-8.php'
  const site = fakeSite({ [`https://m.gsmarena.com/${path}`]: ok(specPage('GSM / HSPA / LTE / 5G')) })
  const r = await resolveModel({ brand: 'Samsung', model: 'Galaxy A16 4G' }, [{ name: 'Galaxy A16', path }], site.get)
  assert.equal(r.outcome, 'unmatched')
})

test('a spec page that is not HTTP 200 is retried next run, not marked unmatched', async () => {
  const site = fakeSite({ [specUrl]: { status: 500, body: '', url: specUrl, blocked: false } })
  const r = await resolveModel({ brand: 'Samsung', model: 'Galaxy A16 5G' }, [A16_5G], site.get)
  assert.equal(r.outcome, 'retry')
})

// --- the paced getter ---------------------------------------------------------

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

function stubFetch(responses: Response[]) {
  const calls: { url: string; redirect: RequestRedirect | undefined }[] = []
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), redirect: init?.redirect })
    return responses[calls.length - 1] ?? new Response('', { status: 200 })
  }) as typeof fetch
  return calls
}

test('GSMArena fetches never follow a redirect, and a redirect counts as blocked', async () => {
  const calls = stubFetch([new Response('', { status: 302, headers: { location: 'https://elsewhere.example/' } })])
  const http = pacedGetter(5, 0)
  const page = await http.get('https://r1.example/a')
  assert.equal(calls[0].redirect, 'manual')
  assert.equal(page.status, 302)
  assert.equal(page.blocked, true)
})

test('403, 429 and a bot check are blocked; a normal page is not', async () => {
  stubFetch([
    new Response('', { status: 403 }),
    new Response('', { status: 429 }),
    new Response('<title>Turnstile check</title>', { status: 200 }),
    new Response('<h1>fine</h1>', { status: 200 }),
  ])
  const http = pacedGetter(5, 0)
  assert.equal((await http.get('https://b1.example/a')).blocked, true)
  assert.equal((await http.get('https://b2.example/a')).blocked, true)
  assert.equal((await http.get('https://b3.example/a')).blocked, true)
  assert.equal((await http.get('https://b4.example/a')).blocked, false)
})

test('a 5xx is returned as is: no retry, so exactly one request', async () => {
  const calls = stubFetch([new Response('', { status: 503 }), new Response('', { status: 200 })])
  const page = await pacedGetter(5, 0).get('https://e1.example/a')
  assert.equal(page.status, 503)
  assert.equal(calls.length, 1)
})

test('the request budget stops the run before it is exceeded', async () => {
  const calls = stubFetch([])
  const http = pacedGetter(2, 0)
  await http.get('https://u1.example/a')
  await http.get('https://u2.example/a')
  await assert.rejects(http.get('https://u3.example/a'), /request budget of 2 used/)
  assert.equal(calls.length, 2)
  assert.equal(http.count, 2)
})

test('requests are GAP_MS apart', () => {
  assert.equal(GAP_MS, 5000)
})

test('a 200 page with none of the four facts is retried next run, not stored as matched', async () => {
  const site = fakeSite({ [specUrl]: ok('<html><head><title>Please wait</title></head><body><h1>Samsung Galaxy A16 5G</h1></body></html>') })
  const r = await resolveModel({ brand: 'Samsung', model: 'Galaxy A16 5G' }, [A16_5G], site.get)
  assert.equal(r.outcome, 'retry')
})

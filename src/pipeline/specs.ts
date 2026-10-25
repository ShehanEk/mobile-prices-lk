import { sql } from 'drizzle-orm'

import { getDb } from '@/db'
import { phoneSpecs, type NewPhoneSpecsRow } from '@/db/schema'
import { politeGet } from '@/lib/http'
import {
  GSMARENA,
  MAKERS,
  isChallenge,
  makerPageUrl,
  networkContradicts,
  parseMakerPage,
  parseSpecPage,
  pickCandidate,
  type Candidate,
  type Maker,
} from '@/specs/gsmarena'

/**
 * The specs job: for each (brand, model) with no stored specs, find its
 * GSMArena page by rules and keep main camera, display, network and colours.
 *
 * Conduct (docs/decisions.md, 2026-10-25): one request every 5 s, no retries,
 * no redirects followed, the honest bot user agent from src/lib/http.ts. The run
 * stops on 403, 429, a redirect or a bot check; we never try to get past one.
 * GSMArena's search sits behind a bot check, so models are found on the brand's
 * list pages instead, and a brand's whole list is read before any model is
 * matched: "exactly one entry fits" can only be said once every entry has been
 * seen.
 *
 * Idempotent: a matched model is never fetched again; an unmatched one is
 * retried after 30 days; a model whose page could not be read is still wanted
 * next run. Nothing fetched here is ever sent to Claude.
 */

export const GAP_MS = 5000
export const RETRY_AFTER_DAYS = 30

export type SpecsOptions = { maxRequests?: number; dryRun?: boolean; log?: (m: string) => void }

export type SpecsResult = {
  wanted: number
  requests: number
  matched: number
  unmatched: number
  /** Models left for the next run: their brand's list or their page could not be read, or the brand has no list. */
  skipped: number
  /** Brands whose list could not be read (not the ones with no list configured). */
  failedBrands: string[]
  /** GSMArena answered 403, 429, a redirect or a bot check: the run stopped and failed. */
  blocked: boolean
  stopped: string | null
}

export type Page = { status: number; body: string; url: string; blocked: boolean }
export type Get = (url: string) => Promise<Page>

/** The run ends here: the budget is used up, or GSMArena said stop. Not an error. */
class Stop extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isRedirect = (status: number) => status >= 300 && status < 400

/** GETs at least `gapMs` apart, counted against a budget. No retries (each would be another request) and no redirects followed. */
export function pacedGetter(maxRequests: number, gapMs: number = GAP_MS) {
  let last = 0
  let count = 0
  return {
    get count() {
      return count
    },
    async get(url: string): Promise<Page> {
      if (count >= maxRequests) throw new Stop(`request budget of ${maxRequests} used`)
      const wait = last + gapMs - Date.now()
      if (wait > 0) await sleep(wait)
      last = Date.now()
      count++
      const res = await politeGet(url, { retries: 0, redirect: 'manual' })
      return {
        status: res.status,
        body: res.body,
        url: res.url,
        blocked: res.status === 403 || res.status === 429 || isRedirect(res.status) || isChallenge(res.body),
      }
    },
  }
}

/** Why a blocked page stopped the run. Status and host only, never page content. */
function blockReason(page: Page, url: string): string {
  const what = isRedirect(page.status) ? ' (a redirect, which is never followed)' : isChallenge(page.body) ? ' with a bot check' : ''
  return `HTTP ${page.status}${what} from ${new URL(url).host}`
}

/**
 * Every phone on a brand's GSMArena list(s), all pages. `failure` is set when a
 * list could not be read in full: a partial list proves nothing about what is
 * missing from it, so the caller must not mark any model unmatched from it.
 */
export async function readBrandLists(makers: Maker[], get: Get): Promise<{ candidates: Candidate[]; failure: string | null }> {
  const candidates: Candidate[] = []
  for (const maker of makers) {
    let lastPage = 1
    for (let page = 1; page <= lastPage; page++) {
      const res = await get(makerPageUrl(maker, page))
      if (res.status !== 200) return { candidates, failure: `${maker.slug}: HTTP ${res.status} on page ${page}` }
      const parsed = parseMakerPage(res.body)
      if (page === 1) {
        lastPage = parsed.lastPage
        // A next link with a count of 1: the page count did not parse, not a short list.
        if (parsed.lastPage === 1 && parsed.hasNext) return { candidates, failure: `${maker.slug}: page count not found on page 1` }
      }
      if (parsed.candidates.length === 0) {
        return { candidates, failure: `${maker.slug}: no phones on page ${page}${page > 1 ? ` of ${lastPage}` : ''}` }
      }
      candidates.push(...parsed.candidates)
    }
  }
  return { candidates, failure: null }
}

export type Resolution =
  | { outcome: 'matched'; row: NewPhoneSpecsRow; path: string }
  /** Looked up and nothing fits: stored as unmatched, retried after 30 days. */
  | { outcome: 'unmatched'; why: string }
  /** The page could not be read: stored nothing, wanted again next run. */
  | { outcome: 'retry'; why: string }

/** One model against its brand's whole list: pick the entry, read its page, and check the network agrees. */
export async function resolveModel(phone: { brand: string; model: string }, candidates: Candidate[], get: Get): Promise<Resolution> {
  const c = pickCandidate(phone, candidates)
  if (!c) return { outcome: 'unmatched', why: 'no single GSMArena entry fits' }

  const page = await get(`${GSMARENA}/${c.path}`)
  if (page.status !== 200) return { outcome: 'retry', why: `HTTP ${page.status} on its page` }

  const specs = parseSpecPage(page.body)
  if (networkContradicts(phone.model, specs.network)) {
    return { outcome: 'unmatched', why: `network on its page (${specs.network}) differs from the model` }
  }
  return {
    outcome: 'matched',
    path: c.path,
    row: {
      brand: phone.brand,
      model: phone.model,
      matched: true,
      gsmarenaUrl: specs.url ?? `${GSMARENA}/${c.path}`,
      mainCamera: specs.mainCamera,
      display: specs.display,
      network: specs.network,
      colours: specs.colours,
    },
  }
}

export async function runSpecs(opts: SpecsOptions = {}): Promise<SpecsResult> {
  const log = opts.log ?? console.log
  const http = pacedGetter(opts.maxRequests ?? 1000)
  const db = getDb()

  const res = await db.execute(sql`
    select distinct p.brand, p.model
    from phones p
    left join phone_specs s on s.brand = p.brand and s.model = p.model
    where s.brand is null
       or (not s.matched and s.fetched_at < now() - make_interval(days => ${RETRY_AFTER_DAYS}))
    order by p.brand, p.model
  `)
  const wanted = res.rows as { brand: string; model: string }[]
  const byBrand = new Map<string, string[]>()
  for (const w of wanted) byBrand.set(w.brand, [...(byBrand.get(w.brand) ?? []), w.model])

  const result: SpecsResult = {
    wanted: wanted.length,
    requests: 0,
    matched: 0,
    unmatched: 0,
    skipped: 0,
    failedBrands: [],
    blocked: false,
    stopped: null,
  }

  const save = async (row: NewPhoneSpecsRow) => {
    if (opts.dryRun) return
    const values = { ...row, fetchedAt: new Date() }
    await db.insert(phoneSpecs).values(values).onConflictDoUpdate({ target: [phoneSpecs.brand, phoneSpecs.model], set: values })
  }

  // Every GSMArena fetch goes through here, so a block always ends the run.
  const get: Get = async (url) => {
    const page = await http.get(url)
    if (page.blocked) {
      result.blocked = true
      throw new Stop(blockReason(page, url))
    }
    return page
  }
  // Models of one brand can share a GSMArena page; read it once.
  const pages = new Map<string, Page>()
  const getOnce: Get = async (url) => {
    const seen = pages.get(url)
    if (seen) return seen
    const page = await get(url)
    pages.set(url, page)
    return page
  }

  try {
    for (const [brand, models] of byBrand) {
      const makers = MAKERS[brand]
      if (!makers) {
        log(`  ${brand}: no GSMArena list configured, ${models.length} models skipped`)
        result.skipped += models.length
        continue
      }

      const list = await readBrandLists(makers, get)
      if (list.failure) {
        log(`  FAILED ${brand}: list not read (${list.failure}); ${models.length} models left for the next run`)
        result.failedBrands.push(brand)
        result.skipped += models.length
        continue
      }

      pages.clear()
      for (const model of models) {
        const r = await resolveModel({ brand, model }, list.candidates, getOnce)
        if (r.outcome === 'retry') {
          log(`  ${brand} ${model}: ${r.why}; left for the next run`)
          result.skipped++
        } else if (r.outcome === 'unmatched') {
          await save({ brand, model, matched: false })
          result.unmatched++
          log(`  unmatched: ${brand} ${model} (${r.why})`)
        } else {
          await save(r.row)
          result.matched++
          log(`  matched: ${brand} ${model} -> ${r.path}`)
        }
      }
    }
  } catch (err) {
    if (!(err instanceof Stop)) throw err
    result.stopped = err.message
  }

  result.requests = http.count
  log(`specs: ${result.matched} matched, ${result.unmatched} unmatched, ${result.requests} requests, ${result.wanted} models wanted`)
  if (result.skipped > 0) log(`skipped: ${result.skipped} models left for the next run${result.failedBrands.length ? ` (lists not read: ${result.failedBrands.join(', ')})` : ''}`)
  if (result.stopped) log(`stopped: ${result.stopped}`)
  return result
}

/**
 * `npm run specs -- --probe`: does GSMArena answer this machine, are the brand
 * list ids right, and do the selectors still find things? About 20 requests,
 * 5 s apart, no database. Prints status codes, counts, host names and yes/no
 * only, never page text.
 */
export async function probeSpecs(log: (m: string) => void = console.log): Promise<boolean> {
  const http = pacedGetter(40)
  let ok = true
  const yn = (v: boolean) => (v ? 'yes' : 'NO')
  const host = (u: string) => new URL(u).host

  const index = await http.get(`${GSMARENA}/makers.php3`)
  log(`makers.php3: HTTP ${index.status} ${host(index.url)}${index.blocked ? ' BLOCKED' : ''}`)
  if (index.blocked || index.status !== 200) {
    log('probe: FAILED')
    return false
  }
  const listed = new Map([...index.body.matchAll(/href="([a-z0-9]+)-phones-(\d+)\.php"/g)].map((m) => [m[1], Number(m[2])]))

  let firstPhone: string | null = null
  for (const [brand, makers] of Object.entries(MAKERS)) {
    for (const maker of makers) {
      const id = listed.get(maker.slug)
      const idOk = id === maker.id
      if (!idOk) ok = false
      const page = await http.get(makerPageUrl(maker, 1))
      if (page.blocked) {
        log(`  ${brand} (${maker.slug}-${maker.id}): HTTP ${page.status} BLOCKED (${blockReason(page, page.url)})`)
        log('probe: FAILED')
        return false
      }
      const parsed = parseMakerPage(page.body)
      const titleOk = parsed.title.toLowerCase().includes(maker.slug)
      const phonesOk = parsed.candidates.length > 0
      const pagesOk = !(parsed.lastPage === 1 && parsed.hasNext)
      log(
        `  ${brand} (${maker.slug}-${maker.id}): HTTP ${page.status}, id on makers page ${yn(idOk)}${idOk ? '' : ` (lists ${id ?? 'none'})`}, ` +
          `title has brand ${yn(titleOk)}, phones ${parsed.candidates.length} (>0 ${yn(phonesOk)}), ` +
          `pages ${parsed.lastPage} (readable ${yn(pagesOk)}), bot check ${isChallenge(page.body) ? 'YES' : 'no'}`,
      )
      if (page.status !== 200 || !titleOk || !phonesOk || !pagesOk) ok = false
      firstPhone ??= parsed.candidates[0]?.path ?? null
    }
  }

  if (firstPhone) {
    const page = await http.get(`${GSMARENA}/${firstPhone}`)
    const s = parseSpecPage(page.body)
    log(
      `  spec page: HTTP ${page.status}${page.blocked ? ' BLOCKED' : ''}, bot check ${isChallenge(page.body) ? 'YES' : 'no'}, ` +
        `camera ${yn(!!s.mainCamera)}, display ${yn(!!s.display)}, network ${yn(!!s.network)}, colours ${yn(!!s.colours)}`,
    )
    if (page.status !== 200 || page.blocked || !s.mainCamera || !s.display || !s.network || !s.colours) ok = false
  } else {
    ok = false
  }

  log(ok ? 'probe: ok' : 'probe: FAILED')
  return ok
}

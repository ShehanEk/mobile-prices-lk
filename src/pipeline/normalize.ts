import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'

import { getDb } from '@/db'
import { listings, modelDecisions, phones, priceHistory, rawListings, warrantyEnum } from '@/db/schema'
import type { Warranty } from '@/db/schema'
import { MODEL, aiAvailable, classifyWarrantyText, matchTitle } from '@/normalize/ai'
import type { AiAnswer } from '@/normalize/ai'
import { extractPhone } from '@/normalize/phone'
import type { PhoneIdentity } from '@/normalize/phone'
import { warrantyOf } from '@/normalize/warranty'

import { betterForListing, betterWithinDay, colomboDate } from './best-row'
import { cacheUse, capInput, estimateCostUsd, selectCandidates, titleEligible } from './model-fallback'
import { dropStale, findSuperseded } from './superseded'

/**
 * Stage 3 of the pipeline: turn `raw_listings` into `phones`, current
 * `listings` (one price per phone + shop + warranty class) and daily
 * `price_history`.
 *
 * Rules decide everything they can. What they leave unclear goes to Claude
 * Haiku 5.5 (`src/normalize/ai.ts`), which picks from a list we supply or
 * declines. Every answer is stored in `model_decisions`, so a text costs one
 * call ever. With --no-ai or no ANTHROPIC_API_KEY nothing is asked: unclear
 * titles are dropped and unclear warranty is filed as `unstated`.
 */

/** Below this a price is a placeholder ("1", "0"), not a real phone price. */
const MIN_PLAUSIBLE_PRICE_LKR = 1000

const DEFAULT_MAX_MODEL_CALLS = 300

const isWarranty = (v: string): v is Warranty => (warrantyEnum.enumValues as readonly string[]).includes(v)

export type NormalizeOptions = {
  limit?: number
  redo?: boolean
  dryRun?: boolean
  noAi?: boolean
  maxModelCalls?: number
  log?: (m: string) => void
}

export type NormalizeResult = {
  considered: number
  matchedByRule: number
  matchedByModel: number
  /** extractPhone drop reasons, plus 'no-price'. */
  dropped: Record<string, number>
  /** Rows the model was asked about and declined. Always 0 with --no-ai. */
  unmatched: number
  warrantyByModel: number
  warrantyUnclear: number
  /** On a dry run, the number that would be written. */
  phonesCreated: number
  listingsWritten: number
  historyRows: number
  /** Old-class listings and history points replaced because a product changed class. On a dry run, the number that would be. A history point may name a day with no stored row; its delete then does nothing. */
  supersededListings: number
  supersededHistory: number
  modelCalls: number
  /** Rows left for the next run (model budget spent or the API failing); not stamped. */
  deferred: number
}

type Candidate = {
  rawId: number
  phoneId: string
  shop: string
  warranty: Warranty
  warrantyText: string | null
  priceLkr: number
  url: string
  inStock: boolean
  scrapedAt: Date
}

function keepBest(
  map: Map<string, Candidate>,
  key: string,
  c: Candidate,
  better: (a: Candidate, b: Candidate) => number,
) {
  const existing = map.get(key)
  if (!existing || better(existing, c) > 0) map.set(key, c)
}

export async function runNormalize(opts: NormalizeOptions = {}): Promise<NormalizeResult> {
  const log = opts.log ?? ((m: string) => console.log(m))
  const db = getDb()

  const rowLimit = opts.limit ?? 20000
  const raw = await db
    .select()
    .from(rawListings)
    .where(opts.redo ? sql`true` : isNull(rawListings.normalizedAt))
    // A plain run takes the oldest unprocessed rows first, so repeated runs drain
    // a backlog. --redo sees every row, so a limit must keep the newest ones.
    .orderBy(...(opts.redo ? [desc(rawListings.scrapedAt), desc(rawListings.id)] : [rawListings.scrapedAt, rawListings.id]))
    .limit(rowLimit)

  if (opts.redo && raw.length >= rowLimit) {
    log(`warning: --redo read ${rowLimit} rows, the limit; older rows were not covered and keep their old class`)
  }

  const result: NormalizeResult = {
    considered: raw.length,
    matchedByRule: 0,
    matchedByModel: 0,
    dropped: {},
    unmatched: 0,
    warrantyByModel: 0,
    warrantyUnclear: 0,
    phonesCreated: 0,
    listingsWritten: 0,
    historyRows: 0,
    supersededListings: 0,
    supersededHistory: 0,
    modelCalls: 0,
    deferred: 0,
  }
  const drop = (reason: string) => {
    result.dropped[reason] = (result.dropped[reason] ?? 0) + 1
  }

  const existing = await db
    .select({
      phoneId: phones.phoneId,
      brand: phones.brand,
      model: phones.model,
      ramGb: phones.ramGb,
      storageGb: phones.storageGb,
      esimOnly: phones.esimOnly,
    })
    .from(phones)
  const existingIds = new Set(existing.map((p) => p.phoneId))
  const newPhones = new Map<string, PhoneIdentity>()
  const extracted = raw.map((row) => extractPhone(row.rawTitle))

  // --- model fallback state
  const useAi = !opts.noAi && aiAvailable()
  if (!opts.noAi && !useAi) log('ANTHROPIC_API_KEY is not set; model fallback off')
  const maxCalls = opts.maxModelCalls ?? DEFAULT_MAX_MODEL_CALLS
  const now = new Date()
  // Phones the model may pick from: the catalogue plus every phone the rules
  // found in this batch, so a title can match a phone first seen today.
  const pool = new Map<string, PhoneIdentity>(existing.map((p) => [p.phoneId, p]))
  for (const e of extracted) if (!('drop' in e) && !pool.has(e.phoneId)) pool.set(e.phoneId, e)
  type Decision = { answer: string | null; confidence: string; reason: string; decidedAt: Date }
  const decisions = new Map<string, Decision>()
  if (useAi) {
    for (const d of await db.select().from(modelDecisions)) {
      decisions.set(`${d.kind}\u0000${d.input}`, d)
    }
  }
  const tokens = { input: 0, output: 0 }
  let cacheHits = 0
  let aiStopped = false
  const deferred = new Set<number>()

  /**
   * The stored answer when it may be reused (ruling 3), otherwise one call,
   * stored. Null when no answer can be had this run (budget spent or the API
   * failing): the row is left for the next run. `usable` says whether a stored
   * answer is still on offer; one that is not is asked again.
   */
  const decide = async <T extends string>(
    kind: 'title' | 'warranty',
    fullInput: string,
    call: () => Promise<AiAnswer<T>>,
    usable: (answer: string) => boolean,
  ): Promise<(Decision & { fresh: boolean }) | null> => {
    const input = capInput(fullInput)
    const key = `${kind}\u0000${input}`
    const cached = decisions.get(key)
    if (cached && cacheUse(cached, now, cached.answer === null || usable(cached.answer)) === 'reuse') {
      cacheHits++
      return { ...cached, fresh: false }
    }
    if (aiStopped || result.modelCalls >= maxCalls) return null
    result.modelCalls++
    const a = await call()
    tokens.input += a.usage.inputTokens
    tokens.output += a.usage.outputTokens
    if (a.failed) {
      // Not stored: an API failure is not a decline. Stop asking this run; the
      // rows are retried next run.
      log(`  model call failed, no more calls this run: ${a.reason}`)
      aiStopped = true
      return null
    }
    const d: Decision = { answer: a.answer, confidence: a.confidence, reason: a.reason, decidedAt: new Date() }
    decisions.set(key, d)
    if (!opts.dryRun) {
      const values = { answer: d.answer, confidence: d.confidence, reason: d.reason, model: MODEL, decidedAt: d.decidedAt }
      await db
        .insert(modelDecisions)
        .values({ kind, input, ...values })
        .onConflictDoUpdate({ target: [modelDecisions.kind, modelDecisions.input], set: values })
    }
    return { ...d, fresh: true }
  }
  // One best row per (phone, shop, warranty) for the current listing, and per
  // (phone, shop, warranty, Colombo day) for history, so a backlog lands on its own days.
  const scraped: Candidate[] = []
  const bestListing = new Map<string, Candidate>()
  const bestHistory = new Map<string, Candidate>()

  for (const [i, row] of raw.entries()) {
    const payload = (row.rawPayload ?? {}) as Record<string, unknown>
    const price = Number(payload.priceLkr)
    const priced = Number.isFinite(price) && price >= MIN_PLAUSIBLE_PRICE_LKR

    let identity: PhoneIdentity | null = null
    const e = extracted[i]
    if ('drop' in e) {
      // Only a row that can be priced is worth a model call.
      const candidates =
        useAi && priced && titleEligible(e.drop, row.rawTitle)
          ? selectCandidates(row.rawTitle, pool.values())
          : []
      if (candidates.length) {
        const d = await decide(
          'title',
          `${row.shop}\u0000${row.rawTitle}`,
          () => matchTitle(row.rawTitle, candidates),
          (id) => candidates.some((c) => c.phoneId === id),
        )
        if (!d) {
          deferred.add(row.id)
          continue
        }
        // A low-confidence guess is no match: an unmatched row is a gap, a
        // wrong one is a wrong price in front of a buyer.
        identity = d.answer && d.confidence === 'high' ? (pool.get(d.answer) ?? null) : null
        if (identity) {
          result.matchedByModel++
          // These are the only rows a model decided; the log is their audit trail.
          if (d.fresh) log(`  model: "${row.rawTitle}" -> ${identity.phoneId} (${d.reason})`)
        } else {
          result.unmatched++
          if (d.fresh) log(`  model declined: "${row.rawTitle}" (${d.reason})`)
        }
      }
      if (!identity) {
        drop(e.drop)
        continue
      }
    } else {
      identity = e
      result.matchedByRule++
    }

    // Checked before the warranty so a row that cannot be priced never costs a
    // model call.
    if (!priced) {
      drop('no-price')
      continue
    }

    const w = warrantyOf(row.rawTitle, payload)
    let warranty: Warranty = 'unstated'
    if (w.warranty) {
      warranty = w.warranty
    } else {
      result.warrantyUnclear++
      const text = w.text
      if (useAi && text) {
        const d = await decide('warranty', text, () => classifyWarrantyText(text), isWarranty)
        if (!d) {
          deferred.add(row.id)
          continue
        }
        const answer = d.answer !== null && isWarranty(d.answer) ? d.answer : undefined
        // A decline or a low-confidence answer files the row as `unstated`.
        if (answer && d.confidence === 'high') {
          warranty = answer
          result.warrantyByModel++
          if (d.fresh) log(`  model warranty: "${text}" -> ${answer}`)
        } else if (d.fresh) {
          log(`  model warranty declined: "${text}" (${d.reason})`)
        }
      }
    }

    if (!existingIds.has(identity.phoneId) && !newPhones.has(identity.phoneId)) {
      newPhones.set(identity.phoneId, identity)
    }

    const candidate: Candidate = {
      rawId: row.id,
      phoneId: identity.phoneId,
      shop: row.shop,
      warranty,
      warrantyText: w.text,
      priceLkr: price,
      url: String(payload.variationUrl ?? row.sourceUrl),
      inStock: payload.inStock !== false,
      scrapedAt: row.scrapedAt,
    }
    const key = [candidate.phoneId, candidate.shop, candidate.warranty].join('\u0000')
    scraped.push(candidate)
    keepBest(bestHistory, `${key}\u0000${colomboDate(row.scrapedAt)}`, candidate, betterWithinDay)
  }

  // A product's older classes in this run are stale: only the latest-scraped
  // class becomes the current listing (history keeps every day as scraped).
  const current = dropStale(scraped)
  for (const c of current) {
    keepBest(bestListing, [c.phoneId, c.shop, c.warranty].join('\u0000'), c, betterForListing)
  }

  result.phonesCreated = newPhones.size
  result.listingsWritten = bestListing.size
  result.historyRows = bestHistory.size

  // A product is (phone, shop, url); a changed warranty class would otherwise
  // leave its old-class row beside the new one. Read-only, so a dry run counts too.
  const superseded = findSuperseded(
    await db
      .select({
        phoneId: listings.phoneId,
        shop: listings.shop,
        warranty: listings.warranty,
        url: listings.url,
        scrapedAt: listings.scrapedAt,
      })
      .from(listings),
    [...bestListing.values()],
    [...bestHistory.values()],
    current,
    scraped,
  )
  result.supersededListings = superseded.listings.length
  result.supersededHistory = superseded.history.length

  const droppedText =
    Object.entries(result.dropped)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, n]) => `${reason}=${n}`)
      .join(', ') || 'none'
  log(
    `resolved ${result.matchedByRule} by rule, ${result.matchedByModel} by model, ` +
      `${result.unmatched} unmatched; warranty: ${result.warrantyByModel} by model, ` +
      `${result.warrantyUnclear} unclear`,
  )
  log(`dropped: ${droppedText}`)
  if (useAi) {
    log(
      `model: ${result.modelCalls} calls (limit ${maxCalls}), ${cacheHits} answers reused, ` +
        `${tokens.input} input / ${tokens.output} output tokens, ` +
        `~$${estimateCostUsd(tokens.input, tokens.output).toFixed(4)}; ` +
        `${deferred.size} rows left for the next run`,
    )
  }
  result.deferred = deferred.size

  if (opts.dryRun) {
    log(
      `dry run, nothing written; would write ${result.phonesCreated} new phones, ` +
        `${result.listingsWritten} listings, ${result.historyRows} price-history rows; ` +
        `would remove ${result.supersededListings + result.supersededHistory} superseded rows ` +
        `(${result.supersededListings} listings, ${result.supersededHistory} history)`,
    )
    return result
  }

  // --- writes. Neon's HTTP driver has no transactions, so the order is what
  // keeps a crash harmless: phones first (foreign key), rows stamped last, and
  // every statement is an upsert so a re-run converges. Superseded rows are
  // deleted after the upserts: the deletes never touch a key written this run,
  // so a crash between them leaves a duplicate that the re-run removes, never
  // a gap.

  const phoneValues = [...newPhones.values()].map((p) => ({
    phoneId: p.phoneId,
    brand: p.brand,
    model: p.model,
    ramGb: p.ramGb,
    storageGb: p.storageGb,
    esimOnly: p.esimOnly,
  }))
  for (let i = 0; i < phoneValues.length; i += 100) {
    await db.insert(phones).values(phoneValues.slice(i, i + 100)).onConflictDoNothing()
  }

  const listingValues = [...bestListing.values()].map((c) => ({
    phoneId: c.phoneId,
    shop: c.shop,
    warranty: c.warranty,
    warrantyText: c.warrantyText,
    priceLkr: String(c.priceLkr),
    url: c.url,
    inStock: c.inStock,
    scrapedAt: c.scrapedAt,
  }))
  for (let i = 0; i < listingValues.length; i += 100) {
    await db
      .insert(listings)
      .values(listingValues.slice(i, i + 100))
      .onConflictDoUpdate({
        target: [listings.phoneId, listings.shop, listings.warranty],
        set: {
          warrantyText: sql`excluded.warranty_text`,
          priceLkr: sql`excluded.price_lkr`,
          url: sql`excluded.url`,
          inStock: sql`excluded.in_stock`,
          scrapedAt: sql`excluded.scraped_at`,
        },
        // A --redo over old rows must not overwrite a newer price.
        setWhere: sql`${listings.scrapedAt} <= excluded.scraped_at`,
      })
  }

  const historyValues = [...bestHistory.values()].map((c) => ({
    phoneId: c.phoneId,
    shop: c.shop,
    warranty: c.warranty,
    recordedOn: colomboDate(c.scrapedAt),
    priceLkr: String(c.priceLkr),
    // Stock is stored with the point; it cannot be looked up afterwards.
    inStock: c.inStock,
  }))
  for (let i = 0; i < historyValues.length; i += 100) {
    await db
      .insert(priceHistory)
      .values(historyValues.slice(i, i + 100))
      .onConflictDoUpdate({
        target: [
          priceHistory.phoneId,
          priceHistory.shop,
          priceHistory.warranty,
          priceHistory.recordedOn,
        ],
        set: { priceLkr: sql`excluded.price_lkr`, inStock: sql`excluded.in_stock` },
      })
  }

  for (let i = 0; i < superseded.listings.length; i += 100) {
    await db.delete(listings).where(
      or(
        ...superseded.listings
          .slice(i, i + 100)
          .map((r) => and(eq(listings.phoneId, r.phoneId), eq(listings.shop, r.shop), eq(listings.warranty, r.warranty))),
      ),
    )
  }
  for (let i = 0; i < superseded.history.length; i += 100) {
    await db.delete(priceHistory).where(
      or(
        ...superseded.history
          .slice(i, i + 100)
          .map((r) =>
            and(
              eq(priceHistory.phoneId, r.phoneId),
              eq(priceHistory.shop, r.shop),
              eq(priceHistory.warranty, r.warranty),
              eq(priceHistory.recordedOn, r.recordedOn),
            ),
          ),
      ),
    )
  }

  // Stamp every row looked at, dropped or not, so the next run skips titles
  // that will never resolve. Rows the model could not be asked about this run
  // stay unstamped and are retried.
  const ids = raw.filter((r) => !deferred.has(r.id)).map((r) => r.id)
  for (let i = 0; i < ids.length; i += 200) {
    await db
      .update(rawListings)
      .set({ normalizedAt: new Date() })
      .where(inArray(rawListings.id, ids.slice(i, i + 200)))
  }

  log(
    `wrote ${result.phonesCreated} new phones, ${result.listingsWritten} listings, ` +
      `${result.historyRows} price-history rows; ` +
      `${result.supersededListings + result.supersededHistory} superseded rows removed ` +
      `(${result.supersededListings} listings, ${result.supersededHistory} history)`,
  )
  return result
}

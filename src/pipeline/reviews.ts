import { lt, sql } from 'drizzle-orm'
import { z } from 'zod'

import { getDb } from '@/db'
import { phoneReviews, phones } from '@/db/schema'
import { CHANNELS, MIN_SECONDS, chooseReviews, durationSeconds, matchModel, type Candidate } from '@/reviews/youtube'

/**
 * The reviews job: read each trusted channel's recent uploads through the
 * YouTube Data API, match titles to our models, and keep up to three per model.
 *
 * Runs before normalize, so new links go live when normalize clears the cache.
 * Each API call here costs 1 quota unit (the free allowance is 10,000 a day);
 * search, at 100 units a call, is never used.
 *
 * Idempotent: it reads the same window every night and replaces what is stored.
 * Any failure, or finding nothing at all, stops the run before a write, so the
 * site keeps yesterday's reviews. The key travels in a header, so no log or
 * error ever quotes it.
 */

const API = 'https://www.googleapis.com/youtube/v3'
const MAX_AGE_DAYS = 3 * 365
/** 50 videos a page: a limit on one channel's cost, far past MAX_AGE_DAYS for any of ours. */
const MAX_PAGES = 40

const Channels = z.object({
  items: z.array(z.object({ contentDetails: z.object({ relatedPlaylists: z.object({ uploads: z.string() }) }) })).optional(),
})
const Uploads = z.object({
  nextPageToken: z.string().optional(),
  items: z.array(
    z.object({
      snippet: z.object({ title: z.string() }),
      contentDetails: z.object({ videoId: z.string(), videoPublishedAt: z.string().optional() }),
    }),
  ),
})
const Videos = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      contentDetails: z.object({ duration: z.string() }),
      status: z.object({ privacyStatus: z.string(), embeddable: z.boolean() }),
    }),
  ),
})

export type ReviewsOptions = {
  apiKey: string
  dryRun?: boolean
  log?: (m: string) => void
}

export type ReviewsResult = {
  models: number
  videosRead: number
  candidates: number
  reviews: number
  modelsWithReviews: number
  requests: number
}

export async function runReviews(opts: ReviewsOptions): Promise<ReviewsResult> {
  const log = opts.log ?? console.log
  const db = getDb()
  let requests = 0

  const get = async <T>(path: string, params: Record<string, string>, schema: z.ZodType<T>): Promise<T> => {
    requests++
    const res = await fetch(`${API}/${path}?${new URLSearchParams(params)}`, {
      headers: { 'X-Goog-Api-Key': opts.apiKey },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`YouTube ${path}: HTTP ${res.status}`)
    return schema.parse(await res.json())
  }

  const models = await db.selectDistinct({ brand: phones.brand, model: phones.model }).from(phones)
  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000).toISOString()

  let videosRead = 0
  const candidates: Candidate[] = []
  for (const channel of CHANNELS) {
    const found = await get('channels', { part: 'contentDetails', forHandle: channel.handle }, Channels)
    const uploads = found.items?.[0]?.contentDetails.relatedPlaylists.uploads
    if (!uploads) throw new Error(`YouTube has no channel @${channel.handle}`)

    let read = 0
    let matched = 0
    let pageToken: string | undefined
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await get(
        'playlistItems',
        { part: 'snippet,contentDetails', playlistId: uploads, maxResults: '50', ...(pageToken && { pageToken }) },
        Uploads,
      )
      read += res.items.length
      const tooOld = res.items.some((v) => v.contentDetails.videoPublishedAt !== undefined && v.contentDetails.videoPublishedAt < cutoff)
      for (const v of res.items) {
        const publishedAt = v.contentDetails.videoPublishedAt
        const m = publishedAt && publishedAt >= cutoff ? matchModel(v.snippet.title, models) : null
        if (!m) continue
        matched++
        candidates.push({ ...m, videoId: v.contentDetails.videoId, title: v.snippet.title, channel: channel.name, publishedAt: publishedAt! })
      }
      pageToken = res.nextPageToken
      if (tooOld || !pageToken) break
    }
    videosRead += read
    log(`  ${channel.name}: ${read} videos read, ${matched} matched`)
  }

  // Keep only what can actually play here: public, embeddable, and long enough to be a review.
  const playable = new Set<string>()
  const ids = [...new Set(candidates.map((c) => c.videoId))]
  for (let i = 0; i < ids.length; i += 50) {
    const res = await get('videos', { part: 'contentDetails,status', id: ids.slice(i, i + 50).join(','), maxResults: '50' }, Videos)
    for (const v of res.items) {
      if (v.status.privacyStatus === 'public' && v.status.embeddable && durationSeconds(v.contentDetails.duration) >= MIN_SECONDS) playable.add(v.id)
    }
  }

  const rows = chooseReviews(
    candidates.filter((c) => playable.has(c.videoId)),
    CHANNELS.map((c) => c.name),
  )
  // Nothing at all means the API or our rules changed, not that every review vanished.
  if (rows.length === 0) throw new Error(`no reviews found in ${videosRead} videos; keeping what is stored`)

  if (!opts.dryRun) {
    const fetchedAt = new Date()
    for (let i = 0; i < rows.length; i += 200) {
      await db
        .insert(phoneReviews)
        .values(
          rows.slice(i, i + 200).map((r) => ({
            brand: r.brand,
            model: r.model,
            videoId: r.videoId,
            position: r.position,
            title: r.title,
            channel: r.channel,
            publishedAt: new Date(r.publishedAt),
            fetchedAt,
          })),
        )
        .onConflictDoUpdate({
          target: [phoneReviews.brand, phoneReviews.model, phoneReviews.videoId],
          set: {
            position: sql`excluded.position`,
            title: sql`excluded.title`,
            channel: sql`excluded.channel`,
            publishedAt: sql`excluded.published_at`,
            fetchedAt: sql`excluded.fetched_at`,
          },
        })
    }
    await db.delete(phoneReviews).where(lt(phoneReviews.fetchedAt, fetchedAt))
  }

  const result: ReviewsResult = {
    models: models.length,
    videosRead,
    candidates: candidates.length,
    reviews: rows.length,
    modelsWithReviews: new Set(rows.map((r) => `${r.brand}\u0000${r.model}`)).size,
    requests,
  }
  log(`reviews: ${result.reviews} reviews for ${result.modelsWithReviews} of ${result.models} models, ${result.videosRead} videos read, ${result.requests} requests`)
  return result
}

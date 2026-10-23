import { boolean, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

/** What we browse. Tablets are the first add-on; see docs/decisions.md. */
export const categoryEnum = pgEnum('category', ['phones'])

/**
 * Raw scrape output, written before any normalization so ingest can be
 * reprocessed without re-scraping. Never mutated except to stamp `normalizedAt`.
 */
export const rawListings = pgTable(
  'raw_listings',
  {
    id: serial('id').primaryKey(),
    shop: text('shop').notNull(),
    sourceUrl: text('source_url').notNull(),
    rawTitle: text('raw_title').notNull(),
    rawPriceText: text('raw_price_text'),
    rawPayload: jsonb('raw_payload'),
    scrapedAt: timestamp('scraped_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    normalizedAt: timestamp('normalized_at', { withTimezone: true }),
  },
  (t) => [index('raw_listings_pending_idx').on(t.normalizedAt, t.scrapedAt)],
)

export const runKindEnum = pgEnum('run_kind', ['scrape', 'normalize'])
export const runStatusEnum = pgEnum('run_status', ['running', 'ok', 'failed', 'abandoned'])
/** Who started the run. `ci` is GitHub Actions, `desktop` the tray app, `cli` a terminal. */
export const runActorEnum = pgEnum('run_actor', ['ci', 'desktop', 'cli'])

/**
 * What actually happened on each pipeline run.
 *
 * Two jobs, and the second is the surprising one.
 *
 * 1. **A record.** `RunResult` and `NormalizeResult` were printed and thrown
 *    away, which is why the admin dashboard has to admit it "cannot tell a
 *    failed run from a run that found nothing new" — the scrapers throw before
 *    writing, so silence looked identical either way.
 *
 * 2. **A lease.** The row is written with `status = 'running'` *before* the work
 *    starts, and a partial unique index on `(shop) where status='running' and
 *    kind='scrape'` makes a second concurrent scrape of the same shop fail to
 *    insert. That unique violation is the answer "someone else has it", not an
 *    error. GitHub's `concurrency` groups only coordinate runs inside GitHub;
 *    this is what stops the desktop app scraping a retailer that CI is already
 *    scraping. A table of only *completed* runs could not do that.
 *
 * Rows outlive the parts they describe, so there is no foreign key: the point of
 * the table is diagnosing runs, including ones that produced nothing.
 */
export const pipelineRuns = pgTable(
  'pipeline_runs',
  {
    id: serial('id').primaryKey(),
    kind: runKindEnum('kind').notNull(),
    /** Null for normalize, which is not per-shop. */
    shop: text('shop'),
    status: runStatusEnum('status').notNull().default('running'),
    actor: runActorEnum('actor').notNull(),
    /** Machine name, so two operators' runs are tellable apart. */
    host: text('host'),
    /** A dry run holds no lease and is recorded only if it is recorded at all. */
    dryRun: boolean('dry_run').notNull().default(false),

    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),

    // RunResult, flattened — these three are asked about constantly.
    scraped: integer('scraped'),
    inserted: integer('inserted'),
    withPrice: integer('with_price'),

    /** NormalizeResult verbatim. Its shape will move; this table is for triage. */
    stats: jsonb('stats'),

    /** First line of the throw. This is the field the dashboard was missing. */
    error: text('error'),
    /** Last few KB of the run log, for when the error alone is not enough. */
    logTail: text('log_tail'),
  },
  (t) => [index('pipeline_runs_recent_idx').on(t.kind, t.shop, t.startedAt)],
)

export type RawListing = typeof rawListings.$inferSelect
export type NewRawListing = typeof rawListings.$inferInsert
export type PipelineRun = typeof pipelineRuns.$inferSelect
export type NewPipelineRun = typeof pipelineRuns.$inferInsert

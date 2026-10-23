import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

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

/** How a price is backed. See docs/decisions.md (warranty is an offer attribute). */
export const warrantyEnum = pgEnum('warranty', ['company', 'shop', 'apple', 'unstated'])
export type Warranty = (typeof warrantyEnum.enumValues)[number]

/** One row per phone: brand + model + RAM + storage. The id is the public URL. */
export const phones = pgTable('phones', {
  phoneId: text('phone_id').primaryKey(),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  /** Null for Apple, which never states RAM. */
  ramGb: integer('ram_gb'),
  storageGb: integer('storage_gb').notNull(),
  esimOnly: boolean('esim_only').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Current price per (phone, shop, warranty), overwritten each run. */
export const listings = pgTable(
  'listings',
  {
    phoneId: text('phone_id').notNull().references(() => phones.phoneId, { onDelete: 'cascade' }),
    shop: text('shop').notNull(),
    warranty: warrantyEnum('warranty').notNull(),
    /** The shop's own wording, shown under the badge. */
    warrantyText: text('warranty_text'),
    priceLkr: numeric('price_lkr', { precision: 12, scale: 2 }).notNull(),
    url: text('url').notNull(),
    inStock: boolean('in_stock').notNull(),
    scrapedAt: timestamp('scraped_at', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.phoneId, t.shop, t.warranty] })],
)

/** Append-only daily points, one per (phone, shop, warranty, day). */
export const priceHistory = pgTable(
  'price_history',
  {
    phoneId: text('phone_id').notNull().references(() => phones.phoneId, { onDelete: 'cascade' }),
    shop: text('shop').notNull(),
    warranty: warrantyEnum('warranty').notNull(),
    recordedOn: date('recorded_on').notNull(),
    priceLkr: numeric('price_lkr', { precision: 12, scale: 2 }).notNull(),
    inStock: boolean('in_stock').notNull(),
  },
  (t) => [primaryKey({ columns: [t.phoneId, t.shop, t.warranty, t.recordedOn] })],
)

/**
 * Every answer the model gave, so the same text is never asked twice and every
 * model-decided row can be audited. `answer` is a phone_id (kind 'title'), a
 * warranty class (kind 'warranty'), or null for a decline.
 */
export const modelDecisions = pgTable(
  'model_decisions',
  {
    id: serial('id').primaryKey(),
    kind: text('kind').notNull(),
    /** 'title': `${shop}\u0000${rawTitle}`; 'warranty': the warranty text. */
    input: text('input').notNull(),
    answer: text('answer'),
    confidence: text('confidence').notNull(),
    reason: text('reason').notNull(),
    model: text('model').notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('model_decisions_kind_input_idx').on(t.kind, t.input)],
)

export type RawListing = typeof rawListings.$inferSelect
export type NewRawListing = typeof rawListings.$inferInsert
export type PipelineRun = typeof pipelineRuns.$inferSelect
export type NewPipelineRun = typeof pipelineRuns.$inferInsert
export type Phone = typeof phones.$inferSelect
export type NewPhone = typeof phones.$inferInsert
export type Listing = typeof listings.$inferSelect
export type NewListing = typeof listings.$inferInsert
export type PriceHistoryRow = typeof priceHistory.$inferSelect
export type ModelDecision = typeof modelDecisions.$inferSelect

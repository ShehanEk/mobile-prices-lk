# Phase 1 — Shops and Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nightly-ready scraper that lands every new phone listing from the six launch shops in `raw_listings`, one row per storage/RAM/warranty option.

**Architecture:** Copy PCPrice.lk's scrape pipeline (polite HTTP client, WooCommerce Store API scraper, sanity gate, run leases) into this repo unchanged where possible. Extend the shared WooCommerce scraper to read each non-colour variation's own price. No normalizing, no site: those are phases 2 and 3.

**Tech Stack:** TypeScript, tsx, `node:test`, Drizzle ORM, Neon Postgres (HTTP driver), GitHub Actions.

**Spec:** [docs/requirements.md](../../requirements.md), [docs/architecture.md](../../architecture.md), [docs/retailers.md](../../retailers.md), [docs/decisions.md](../../decisions.md). Source to copy from: `D:\SERV Projects\local pc parts picker` (read-only).

## Global Constraints

- Never edit anything under `D:\SERV Projects\local pc parts picker`.
- robots.txt respected; every request through `src/lib/http.ts` (serialised per host, 1.5 s floor). Never parallelise requests to one shop.
- Do not get past bot challenges. A shop that blocks is left out.
- Scrapers do no matching and no warranty classification: raw text goes into `payload`.
- Used, pre-owned, refurbished and open-box listings are dropped.
- No AI attribution in commits. No secrets in the repo (`.env*` is gitignored).
- Phase 1 copies only the pipeline. The Next.js site comes over from PCPrice.lk in phase 3.
- Tests: `node:test` via `tsx --test`, pure functions only.

## File Structure

| Path | Responsibility | Source |
|---|---|---|
| `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `drizzle.config.ts` | Tooling | New / copied |
| `src/lib/http.ts` | Polite fetch | Copied, user agent changed |
| `src/db/index.ts` | Lazy Neon connection | Copied |
| `src/db/schema.ts` | `raw_listings`, `pipeline_runs`, enums | Cut down from PCPrice |
| `src/pipeline/scrape.ts`, `src/pipeline/runs.ts`, `scripts/scrape.ts` | Run a shop, sanity gate, leases, CLI | Copied (one import changed) |
| `src/scrapers/types.ts` | `ScrapedRow`, `Scraper` | Copied |
| `src/scrapers/woocommerce.ts` | Store API flow + variations | Copied, extended |
| `src/scrapers/woocommerce.test.ts` | Tests for the pure helpers | New |
| `src/scrapers/<shop>.ts` ×6, `src/scrapers/index.ts` | Shop config | New |
| `.github/workflows/scrape.yml` + 6 callers | Nightly runs | Copied pattern |

---

### Task 1: Pipeline skeleton

**Files:**
- Create: `package.json`, `tsconfig.json`, `.env.example`, `src/db/schema.ts`, `src/scrapers/index.ts`
- Copy unchanged from PCPrice: `.gitignore`, `drizzle.config.ts`, `src/db/index.ts`, `src/scrapers/types.ts`, `src/pipeline/scrape.ts`, `scripts/scrape.ts`
- Copy then modify: `src/lib/http.ts`, `src/pipeline/runs.ts`

**Interfaces:**
- Produces: `Category = 'phones'`; `Scraper`, `ScrapedRow`, `ScrapeOptions` (unchanged shapes); `scrapers: Record<string, Scraper>`; `npm run scrape`, `npm test`, `npm run db:generate`, `npm run db:migrate`.

- [ ] **Step 1: Copy the unchanged files**

```bash
SRC="/d/SERV Projects/local pc parts picker"
cd "/d/SERV Projects/local phone price picker"
mkdir -p src/db src/lib src/pipeline src/scrapers scripts
cp "$SRC/.gitignore" "$SRC/drizzle.config.ts" .
cp "$SRC/src/db/index.ts" src/db/
cp "$SRC/src/lib/http.ts" src/lib/
cp "$SRC/src/scrapers/types.ts" src/scrapers/
cp "$SRC/src/pipeline/scrape.ts" "$SRC/src/pipeline/runs.ts" src/pipeline/
cp "$SRC/scripts/scrape.ts" scripts/
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "mobileprices-lk",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "scrape": "tsx --env-file-if-exists=.env.local scripts/scrape.ts",
    "test": "tsx --test src/scrapers/woocommerce.test.ts",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@neondatabase/serverless": "^1.1.0",
    "drizzle-orm": "^0.45.2"
  },
  "devDependencies": {
    "@types/node": "^20",
    "dotenv": "^17.4.2",
    "drizzle-kit": "^0.31.10",
    "tsx": "^4.23.12",
    "typescript": "^5"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["esnext"],
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["node"],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write `.env.example`**

```bash
# Pooled connection (Neon Dashboard → Connect → pooled)
DATABASE_URL="postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require"

# Direct connection, for drizzle-kit migrations (same host without -pooler)
DATABASE_URL_UNPOOLED="postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"

# Optional overrides for the scraper
SCRAPER_USER_AGENT=""
SCRAPER_DELAY_MS=""
```

- [ ] **Step 5: Write `src/db/schema.ts`**

Copy `rawListings`, the three run enums and `pipelineRuns` verbatim from PCPrice's `src/db/schema.ts` (lines 140–158 and 265–325), with this header and enum:

```ts
import { boolean, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

/** What we browse. Tablets are the first add-on; see docs/decisions.md. */
export const categoryEnum = pgEnum('category', ['phones'])
```

and end the file with:

```ts
export type RawListing = typeof rawListings.$inferSelect
export type NewRawListing = typeof rawListings.$inferInsert
export type PipelineRun = typeof pipelineRuns.$inferSelect
export type NewPipelineRun = typeof pipelineRuns.$inferInsert
```

`phones`, `listings` and `price_history` are phase 2.

- [ ] **Step 6: Point the user agent at this project**

In `src/lib/http.ts` replace the default user agent string:

```ts
const DEFAULT_UA =
  envOverride('SCRAPER_USER_AGENT') ??
  'MobilePricesBot/0.1 (+https://pcprice.lk; sister site in development)'
```

- [ ] **Step 7: Cut the normalize import from `runs.ts`**

`src/pipeline/runs.ts` line 6 imports `NormalizeResult` from `./normalize`, which does not exist until phase 2. Replace it with:

```ts
/** Phase 2 replaces this with the normalizer's result type. */
type NormalizeResult = Record<string, unknown>
```

- [ ] **Step 8: Empty scraper registry**

`src/scrapers/index.ts`:

```ts
import type { Scraper } from './types'

export const scrapers: Record<string, Scraper> = {}

export const shopKeys = Object.keys(scrapers)

export function getScraper(shop: string): Scraper {
  const scraper = scrapers[shop]
  if (!scraper) {
    throw new Error(`Unknown shop "${shop}". Known: ${shopKeys.join(', ')}`)
  }
  return scraper
}

export * from './types'
```

- [ ] **Step 9: Install and check**

Run: `npm install` then `npm run typecheck`
Expected: no errors.

Run: `npm run scrape`
Expected: usage line `usage: npm run scrape -- <shop|all> ...` and exit 1.

- [ ] **Step 10: Generate the first migration**

Run: `npm run db:generate`
Expected: a new `drizzle/0000_*.sql` creating `raw_listings` and `pipeline_runs` (no database needed).

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore .env.example drizzle.config.ts drizzle src scripts
git commit -m "Copy PCPrice.lk scrape pipeline for phones"
```

---

### Task 2: Per-option prices in the WooCommerce scraper

**Files:**
- Copy then modify: `src/scrapers/woocommerce.ts` (from PCPrice)
- Create: `src/scrapers/woocommerce.test.ts`

**Interfaces:**
- Consumes: `politeGet` from `@/lib/http`; `Category`, `ScrapedRow`, `Scraper`, `ScrapeOptions` from `./types`.
- Produces: `createWooScraper(config: WooConfig): Scraper` (same config shape as PCPrice); exported pure helpers `variantGroups(product: StoreProduct): VariantGroup[]`, `variantTitle(name: string, attrs: Record<string, string>): string`, `warrantyText(product: StoreProduct, attrs?: Record<string, string>): string | null`, `isNotNew(product: StoreProduct): boolean`; types `StoreProduct`, `VariantGroup = { attrs: Record<string, string>; variationIds: number[] }`.
- New payload fields on every row: `variant: Record<string, string>` (empty for simple products), `warrantyText: string | null`, `productId: string`. `externalId` is the variation id when there is one.

- [ ] **Step 1: Copy the file**

```bash
cp "/d/SERV Projects/local pc parts picker/src/scrapers/woocommerce.ts" src/scrapers/
```

- [ ] **Step 2: Write the failing tests**

`src/scrapers/woocommerce.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isNotNew, variantGroups, variantTitle, warrantyText, type StoreProduct } from './woocommerce'

// Shaped like doctormobile.lk's "KXD A07", 2026-10-24.
const kxd: StoreProduct = {
  id: 48188,
  name: 'KXD A07',
  permalink: 'https://doctormobile.lk/product/kxd-a07/',
  type: 'variable',
  attributes: [
    { name: 'Capacity', terms: [{ name: '3GB / 32GB', slug: '3gb-32gb' }, { name: '4GB / 64GB', slug: '4gb-64gb' }] },
    { name: 'Colour', terms: [{ name: 'Orange', slug: 'orange' }, { name: 'Dark Blue', slug: 'dark-blue' }] },
    { name: 'Warranty', terms: [{ name: '1 Year Company Warranty', slug: '1-year-company-warranty' }] },
  ],
  variations: [
    { id: 1, attributes: [{ name: 'Capacity', value: '3gb-32gb' }, { name: 'Colour', value: 'orange' }, { name: 'Warranty', value: '1-year-company-warranty' }] },
    { id: 2, attributes: [{ name: 'Capacity', value: '3gb-32gb' }, { name: 'Colour', value: 'dark-blue' }, { name: 'Warranty', value: '1-year-company-warranty' }] },
    { id: 3, attributes: [{ name: 'Capacity', value: '4gb-64gb' }, { name: 'Colour', value: 'orange' }, { name: 'Warranty', value: '1-year-company-warranty' }] },
  ],
}

test('variantGroups merges colours and keeps every other choice', () => {
  const groups = variantGroups(kxd)
  assert.equal(groups.length, 2)
  assert.deepEqual(groups[0], {
    attrs: { Capacity: '3GB / 32GB', Warranty: '1 Year Company Warranty' },
    variationIds: [1, 2],
  })
  assert.deepEqual(groups[1].variationIds, [3])
})

test('variantGroups is empty for a simple product', () => {
  assert.deepEqual(variantGroups({ id: 9, name: 'Galaxy A18 6GB | 128GB', permalink: 'x', type: 'simple' }), [])
})

test('variantTitle adds the options but never the warranty', () => {
  assert.equal(
    variantTitle('KXD A07', { Capacity: '3GB / 32GB', Warranty: '1 Year Company Warranty' }),
    'KXD A07 3GB / 32GB',
  )
  assert.equal(variantTitle('Tecno Camon 50 Pro 8GB RAM 256GB 5G', {}), 'Tecno Camon 50 Pro 8GB RAM 256GB 5G')
})

test('warrantyText prefers the chosen option, then the attribute, then the description', () => {
  assert.equal(warrantyText(kxd, { Warranty: '6 Months Hardware' }), '6 Months Hardware')
  assert.equal(warrantyText(kxd), '1 Year Company Warranty')
  const genius: StoreProduct = {
    id: 7,
    name: 'Honor Choice T10 4G 3GB | 32GB',
    permalink: 'x',
    short_description: '<p>Battery: 5000 mAh lithium-polymer One Year Company Warranty + TRCSL Approved</p>',
  }
  assert.match(warrantyText(genius) ?? '', /One Year Company Warranty/)
  assert.equal(warrantyText({ id: 8, name: 'Galaxy A56', permalink: 'x' }), null)
})

test('isNotNew drops used stock by name or by shelf', () => {
  assert.equal(isNotNew({ id: 1, name: 'iPhone 13 128GB (Used)', permalink: 'x' }), true)
  assert.equal(
    isNotNew({ id: 2, name: 'iPhone 14 Pro', permalink: 'x', categories: [{ name: 'Premium Pre-Owned Phones', slug: 'premium-pre-owned-phones' }] }),
    true,
  )
  assert.equal(isNotNew({ id: 3, name: 'Galaxy S26 Ultra', permalink: 'x', categories: [{ name: 'Mobile Phones' }] }), false)
})
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npm test`
Expected: FAIL — `variantGroups` (and the other helpers) are not exported.

- [ ] **Step 4: Extend the types and add the helpers**

In `src/scrapers/woocommerce.ts`, replace the `StoreProduct` type with:

```ts
export type StoreProduct = {
  id: number
  name: string
  permalink: string
  type?: string
  sku?: string
  short_description?: string
  prices?: {
    price?: string
    regular_price?: string
    currency_code?: string
    currency_minor_unit?: number
  }
  is_in_stock?: boolean
  is_on_backorder?: boolean
  stock_availability?: { text?: string }
  images?: { src?: string }[]
  categories?: { name?: string; slug?: string }[]
  attributes?: { name?: string; terms?: { name?: string; slug?: string }[] }[]
  variations?: { id: number; attributes?: { name?: string; value?: string }[] }[]
}

export type VariantGroup = { attrs: Record<string, string>; variationIds: number[] }

const COLOUR = /colou?r/i
const WARRANTY = /warrant/i
```

Add after `toSpecs`:

```ts
/**
 * A variable product's variations, grouped by every choice except colour.
 *
 * Phone shops list one product per model with storage, colour and warranty as
 * options, each priced on its own; the product's headline price is only the
 * cheapest option (idealz.lk shows 0). Colours share a price and merge, so one
 * group is one row. Variation values are slugs ("3gb-32gb"), mapped back to
 * the shop's own wording through the product's attribute terms.
 */
export function variantGroups(product: StoreProduct): VariantGroup[] {
  const termName = (attribute: string, slug: string) => {
    const term = product.attributes
      ?.find((a) => a.name === attribute)
      ?.terms?.find((t) => t.slug === slug)
    return term?.name ? decodeEntities(term.name).trim() : slug
  }

  const groups = new Map<string, VariantGroup>()
  for (const variation of product.variations ?? []) {
    const attrs: Record<string, string> = {}
    for (const a of variation.attributes ?? []) {
      if (!a.name || COLOUR.test(a.name)) continue
      attrs[decodeEntities(a.name).trim()] = a.value ? termName(a.name, a.value) : ''
    }
    const key = JSON.stringify(Object.entries(attrs).sort())
    const group = groups.get(key) ?? { attrs, variationIds: [] }
    group.variationIds.push(variation.id)
    groups.set(key, group)
  }
  return [...groups.values()]
}

/** The product name plus its options, warranty left out: "KXD A07 3GB / 32GB". */
export function variantTitle(name: string, attrs: Record<string, string>): string {
  const options = Object.entries(attrs)
    .filter(([label, value]) => value && !WARRANTY.test(label))
    .map(([, value]) => value)
  return [name, ...options].join(' ')
}

/**
 * The warranty as the shop words it: the chosen option, else the product's
 * warranty attribute, else the sentence in its short description that names
 * one. Classified in normalize (phase 2), never here.
 */
export function warrantyText(product: StoreProduct, attrs: Record<string, string> = {}): string | null {
  const chosen = Object.entries(attrs).find(([label]) => WARRANTY.test(label))?.[1]
  if (chosen) return chosen

  const attribute = product.attributes
    ?.find((a) => a.name && WARRANTY.test(a.name))
    ?.terms?.map((t) => (t.name ? decodeEntities(t.name).trim() : ''))
    .filter(Boolean)
    .join(', ')
  if (attribute) return attribute

  const text = product.short_description
    ? decodeEntities(product.short_description.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ')
    : ''
  const match = text.match(/[^|]{0,40}\bwarrant\w*[^|]{0,40}/i)
  return match ? match[0].trim() : null
}

/** Used, pre-owned or open-box, by its name or by the shelf it sits on. */
export function isNotNew(product: StoreProduct): boolean {
  if (NOT_NEW.test(product.name)) return true
  return (product.categories ?? []).some((c) => NOT_NEW.test(`${c.name ?? ''} ${c.slug ?? ''}`))
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: all 5 tests PASS.

- [ ] **Step 6: Fetch each option's price in `scrape()`**

Replace the body of the `for (const product of batch)` loop, and the cap, so that:
1. The cap stops work early (variation requests are the expensive part).
2. A simple product gives one row, as before.
3. A variable product gives one row per `VariantGroup`, priced from one of its variations: the first in stock, else the last one read.

```ts
            for (const product of batch) {
              if (found.length >= cap) break
              const name = product.name ? decodeEntities(product.name).trim() : ''
              if (!name || isNotNew(product)) continue

              const specs = toSpecs(product)
              const brand = config.brandAttribute ? specs?.[config.brandAttribute] : undefined
              const title =
                brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name

              const groups = product.type === 'variable' ? variantGroups(product) : []
              if (groups.length === 0) {
                found.push(toRow(product, product, title, {}, category, meta, specs, brand))
                continue
              }

              for (const group of groups) {
                if (found.length >= cap) break
                let priced: StoreProduct | null = null
                for (const id of group.variationIds) {
                  const res = await politeGet(`${api}/${id}`)
                  if (res.status !== 200) continue
                  try {
                    priced = JSON.parse(res.body) as StoreProduct
                  } catch {
                    continue
                  }
                  // One buyable colour is enough: colours share a price.
                  if (buyable(priced)) break
                }
                if (priced) found.push(toRow(product, priced, title, group.attrs, category, meta, specs, brand))
              }
            }

            if (found.length >= cap || batch.length < PER_PAGE) break
            page++
          }

          rows.push(...found)
          log(`  ${category} (${meta.label}): ${found.length} rows`)
```

with `const cap = opts.maxProducts ?? Infinity` declared beside `maxPages`, and these two helpers inside `createWooScraper` (after `const categories = ...`), moving the old row-building code into `toRow`:

```ts
  // `is_in_stock` is true for backordered items too — over half of
  // pcbuilders' graphics cards are "Available on backorder" while flagged in
  // stock. Taking the flag at face value would have advertised same-day
  // availability for parts that have to be ordered in.
  const onBackorder = (p: StoreProduct) =>
    p.is_on_backorder === true || /backorder/i.test(p.stock_availability?.text ?? '')
  const buyable = (p: StoreProduct) => p.is_in_stock === true && !onBackorder(p)

  /** One row: the product's identity, priced from itself or one variation. */
  function toRow(
    product: StoreProduct,
    priced: StoreProduct,
    title: string,
    attrs: Record<string, string>,
    category: Category,
    meta: WooCategoryId,
    specs: Record<string, string> | undefined,
    brand: string | undefined,
  ): ScrapedRow {
    const priceLkr = toRupees(priced.prices?.price, priced.prices?.currency_minor_unit)
    return {
      shop: config.shop,
      sourceUrl: product.permalink,
      rawTitle: variantTitle(title, attrs),
      rawPriceText:
        priced.prices?.price != null ? `${priced.prices.currency_code ?? 'LKR'} ${priceLkr ?? ''}` : null,
      payload: {
        category,
        retailerCategory:
          product.categories
            ?.map((c) => (c.name ? decodeEntities(c.name) : c.slug))
            .filter(Boolean)
            .join(', ') || meta.label,
        externalId: String(priced.id),
        productId: String(product.id),
        brand: brand ?? null,
        priceLkr,
        listPriceLkr: toRupees(priced.prices?.regular_price, priced.prices?.currency_minor_unit),
        inStock: buyable(priced),
        preOrder: onBackorder(priced),
        imageUrl: product.images?.[0]?.src ?? null,
        sku: priced.sku || product.sku || null,
        stockText: priced.stock_availability?.text ?? null,
        variant: attrs,
        warrantyText: warrantyText(product, attrs),
        specs,
      },
    }
  }
```

Delete the old inline row-building block and the old `capped` slice. Update the file's header comment to say it serves the phone shops listed in `src/scrapers/index.ts`.

- [ ] **Step 7: Check**

Run: `npm test && npm run typecheck`
Expected: tests PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/scrapers/woocommerce.ts src/scrapers/woocommerce.test.ts
git commit -m "Price each storage and warranty option separately"
```

---

### Task 3: The six shops

**Files:**
- Create: `src/scrapers/lifemobile.ts`, `celltronics.ts`, `geniusmobile.ts`, `banana.ts`, `idealz.ts`, `doctormobile.ts`
- Modify: `src/scrapers/index.ts`

**Interfaces:**
- Consumes: `createWooScraper` from Task 2.
- Produces: shop keys `lifemobile.lk`, `celltronics.lk`, `geniusmobile.lk`, `banana.lk`, `idealz.lk`, `doctormobile.lk`.

- [ ] **Step 1: Write the six configs**

Each file follows this shape (term ids from docs/retailers.md, checked 2026-10-23):

```ts
import { createWooScraper } from './woocommerce'

/** lifemobile.lk — "Mobile Phones" (term 252). robots.txt allows all. */
export const lifemobile = createWooScraper({
  shop: 'lifemobile.lk',
  baseUrl: 'https://lifemobile.lk',
  categoryIds: { phones: { id: 252, label: 'Mobile Phones' } },
})
```

| File | export | baseUrl | term id | label |
|---|---|---|---|---|
| `lifemobile.ts` | `lifemobile` | `https://lifemobile.lk` | 252 | Mobile Phones |
| `celltronics.ts` | `celltronics` | `https://celltronics.lk` | 62 | Mobile Phones |
| `geniusmobile.ts` | `geniusmobile` | `https://www.geniusmobile.lk` | 70 | Smartphones |
| `banana.ts` | `banana` | `https://banana.lk` | 225 | Mobile Phones |
| `idealz.ts` | `idealz` | `https://idealz.lk` | 47 | Smartphones |
| `doctormobile.ts` | `doctormobile` | `https://doctormobile.lk` | 4103 | Mobile Phones |

Comments to carry: celltronics — "Company Mobile Phones" (5384) is not taken: it mixes tablets and network gear; doctormobile — its pre-owned shelf (7188) sits under 4103 and is dropped by `isNotNew`.

- [ ] **Step 2: Register them**

In `src/scrapers/index.ts`:

```ts
import { banana } from './banana'
import { celltronics } from './celltronics'
import { doctormobile } from './doctormobile'
import { geniusmobile } from './geniusmobile'
import { idealz } from './idealz'
import { lifemobile } from './lifemobile'
import type { Scraper } from './types'

export const scrapers: Record<string, Scraper> = {
  'lifemobile.lk': lifemobile,
  'celltronics.lk': celltronics,
  'geniusmobile.lk': geniusmobile,
  'banana.lk': banana,
  'idealz.lk': idealz,
  'doctormobile.lk': doctormobile,
}
```

(keep `shopKeys`, `getScraper` and `export * from './types'`).

- [ ] **Step 3: Smoke-test every shop**

Run, one at a time (no database needed):

```bash
npm run scrape -- doctormobile.lk --dry-run --max-products 5
```

Repeat for each of the six. Expected for each: `[shop] scraped=5 withPrice=5 inserted=0 (dry run)` and exit 0. Each title is product name + options (for example `KXD A07 3GB / 32GB`).

- [ ] **Step 4: Full dry run and counts**

Run: `npm run scrape -- all --dry-run`
Expected: `6/6 scrapers ok`. Record each shop's row count and run time in docs/retailers.md (new "First full run" line per shop). lifemobile.lk is the long one (~45–60 min).

- [ ] **Step 5: Commit**

```bash
git add src/scrapers docs/retailers.md
git commit -m "Add the six launch phone shops"
```

---

### Task 4: Database and first real run (needs Shehan)

**Files:**
- Create: `.env.local` (not committed)
- Modify: `docs/status.md` (create it: what is live and where it is set up)

- [ ] **Step 1: Shehan creates the Neon project**

Neon Console → New project `mobileprices`, region `AWS ap-southeast-1 (Singapore)`. Copy the pooled and direct connection strings into `.env.local` as `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.

- [ ] **Step 2: Migrate**

Run: `npm run db:migrate`
Expected: migration `0000` applied.

- [ ] **Step 3: Real run**

Run: `npm run scrape -- all`
Expected: `6/6 scrapers ok`, rows inserted.

- [ ] **Step 4: Check what landed**

```bash
npx tsx --env-file=.env.local -e "import('@/db').then(async ({ getDb }) => { const { sql } = await import('drizzle-orm'); console.log((await getDb().execute(sql\`select shop, count(*) from raw_listings group by shop order by shop\`)).rows) })"
```

Expected: six shops, counts matching Task 3 Step 4.

- [ ] **Step 5: Commit**

Write `docs/status.md` (Neon project name and region, date of first run, row counts) and commit it.

---

### Task 5: Nightly workflows (needs a GitHub repo)

**Files:**
- Create: `.github/workflows/scrape.yml`, `.github/workflows/scrape-<shop>.yml` ×6

- [ ] **Step 1: Shehan creates the GitHub repo and adds secrets**

Repo (private is fine), `DATABASE_URL` under Settings → Secrets → Actions. Push `docs/planning` merged into `main`.

- [ ] **Step 2: Copy the reusable workflow**

Copy PCPrice's `.github/workflows/scrape.yml` and change the `categories` input default to `phones`. Keep `set -o pipefail` and the "Require configuration" step.

- [ ] **Step 3: Six callers, staggered**

Pattern (from PCPrice `scrape-tecroot.yml`):

```yaml
name: scrape celltronics.lk

on:
  schedule:
    - cron: '30 18 * * *'
  workflow_dispatch:

jobs:
  scrape:
    uses: ./.github/workflows/scrape.yml
    with:
      shop: celltronics.lk
      timeout_minutes: 30
    secrets: inherit
```

| Shop | cron (UTC) | Sri Lanka | timeout |
|---|---|---|---|
| celltronics.lk | `30 18 * * *` | 00:00 | 30 |
| geniusmobile.lk | `0 19 * * *` | 00:30 | 20 |
| banana.lk | `15 19 * * *` | 00:45 | 15 |
| idealz.lk | `30 19 * * *` | 01:00 | 15 |
| doctormobile.lk | `45 19 * * *` | 01:15 | 15 |
| lifemobile.lk | `0 20 * * *` | 01:30 | 90 |

- [ ] **Step 4: Check which shops block GitHub's runners**

Run each workflow once by hand (Actions → workflow → Run workflow). For any shop answering 403/429 from the runner: remove its `schedule`, keep `workflow_dispatch`, and record it in docs/retailers.md. Those shops then need the desktop app (a later task, only if any fail).

- [ ] **Step 5: Commit**

```bash
git add .github docs/retailers.md
git commit -m "Nightly scrape workflows for the six shops"
```

---

## Self-review

- Spec coverage: six launch shops (Task 3), per-option prices for storage/RAM/warranty (Task 2), used stock dropped (Task 2 `isNotNew`), robots/politeness (copied `http.ts`), raw landing + sanity gate (Task 1), GitHub runner check (Task 5). Matching, warranty classification and the site are phases 2–3 by design.
- Names used across tasks: `createWooScraper`, `variantGroups`, `variantTitle`, `warrantyText`, `isNotNew`, `StoreProduct`, `VariantGroup`, payload `variant` / `warrantyText` / `productId`. Consistent.

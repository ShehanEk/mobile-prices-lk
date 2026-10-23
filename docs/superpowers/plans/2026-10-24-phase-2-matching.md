# Phase 2 — Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the nightly `raw_listings` rows into `phones`, `listings` and `price_history`: one phone per brand + model + RAM + storage, one price per (phone, shop, warranty type), with Claude Haiku 5.5 settling only the titles and warranty texts the rules can't.

**Architecture:** PCPrice.lk's normalize stage, cut down to one category: deterministic extraction first (pure, tested), a price floor, best-row-per-key, append-only daily history, `normalized_at` stamping. A model fallback copied from PCPrice's `src/normalize/ai.ts`, moved to Claude Haiku 5.5 with structured outputs, whose decisions are cached in a table so each unclear text is asked once ever.

**Tech Stack:** TypeScript, tsx, `node:test`, Drizzle ORM, Neon, `@anthropic-ai/sdk` + `zod`, GitHub Actions.

**Spec:** [docs/requirements.md](../../requirements.md), [docs/architecture.md](../../architecture.md) (sections "Data model differences", "Identity", "Warranty: how it is read", "Model fallback for unclear rows"), [docs/decisions.md](../../decisions.md). Source to copy from (read-only): `D:\SERV Projects\local pc parts picker` — `src/pipeline/normalize.ts`, `src/normalize/ai.ts`, `scripts/normalize.ts`.

## Global Constraints

- Never edit anything under `D:\SERV Projects\local pc parts picker`.
- Identity: `phone_id` = brand + model + RAM + storage, slugged (`samsung-galaxy-a56-8gb-256gb`). Apple: no RAM (`apple-iphone-17-pro-256gb`), `-esim` suffix when the title says eSIM. Colour never in the id. 4G/5G never in the id except models on the curated dual-network list.
- An Android (non-Apple) listing without RAM is dropped, never guessed. A listing without storage is dropped.
- Warranty is not identity. Classes: `company`, `shop`, `apple`, `unstated`. Listings are keyed `(phone_id, shop, warranty)`.
- Scope: new smartphones from the 16 brands (Apple, Samsung, Xiaomi incl. Redmi/POCO, Honor, Huawei, OPPO, vivo, realme, OnePlus, Google, Motorola, Nothing incl. CMF, Tecno, Infinix, ZTE incl. nubia, Nokia/HMD). Tablets, watches, earbuds, feature phones, other brands: dropped.
- Price floor: rows under Rs 1,000 are not listed (0 = no price at idealz/lifemobile). Prices are stored as the shop shows them (lifemobile's decimals are real; verified on its page 2026-10-24).
- The model only picks from a supplied list or declines; never invents a phone or recalls a spec. Only `confidence: "high"` answers are used. Every model decision is logged and stored in `model_decisions`; the same input is never sent twice.
- Model: `claude-haiku-5-5`, effort `low`, structured outputs via `client.messages.parse` + `zodOutputFormat` (no forced `tool_choice`, no `temperature`, no `budget_tokens`). A `refusal` stop reason counts as a decline. A missing `ANTHROPIC_API_KEY` degrades the run (rows stay unmatched), never fails it.
- Tests: `node:test` via `tsx --test`, pure functions only, no network. No AI attribution in commits; commits are GPG-signed — if signing fails, stop and report, never bypass. No secrets in the repo.
- Database migrations are applied by Shehan (`npm run db:migrate`); a hook blocks agents from running it.

## File Structure

| Path | Responsibility |
|---|---|
| `src/db/schema.ts` | + `warrantyEnum`, `phones`, `listings`, `priceHistory`, `modelDecisions` |
| `drizzle/0001_*.sql` | Generated migration for the above |
| `src/normalize/warranty.ts` (+ `.test.ts`) | `classifyWarranty(text)` and `warrantyOf(row)` — pure |
| `src/normalize/phone.ts` (+ `.test.ts`) | `extractPhone(title)` → identity or a drop reason — pure |
| `src/normalize/ai.ts` | Haiku 5.5 fallback: `matchTitle`, `classifyWarrantyText` |
| `src/pipeline/normalize.ts` | The run: rules → model → floor → listings → history → stamp |
| `scripts/normalize.ts` | CLI (`npm run normalize [-- --dry-run --redo --no-ai --limit N --max-model-calls N]`) |
| `.github/workflows/normalize.yml` | Nightly at 21:30 UTC (03:00 Sri Lanka), after every scrape |

---

### Task 1: Schema for phones, listings, history and model decisions

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0001_*.sql` (generated)
- Modify: `src/pipeline/runs.ts` (replace the `NormalizeResult` stub with an import once Task 4 exists — leave for Task 4)

**Interfaces:**
- Produces: tables `phones`, `listings`, `price_history`, `model_decisions`; enum `warranty` = `company | shop | apple | unstated`; types `Phone`, `NewPhone`, `Listing`, `NewListing`, `PriceHistoryRow`, `ModelDecision`; `Warranty` type exported from schema.

- [ ] **Step 1: Add to `src/db/schema.ts`** (keep existing tables; add `numeric`, `date`, `primaryKey`, `uniqueIndex` to the import)

```ts
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

export type Phone = typeof phones.$inferSelect
export type NewPhone = typeof phones.$inferInsert
export type Listing = typeof listings.$inferSelect
export type NewListing = typeof listings.$inferInsert
export type PriceHistoryRow = typeof priceHistory.$inferSelect
export type ModelDecision = typeof modelDecisions.$inferSelect
```

- [ ] **Step 2: Generate and check**

Run: `npm run db:generate` then `npm run typecheck`
Expected: `drizzle/0001_*.sql` creating the enum and four tables; typecheck clean. Do not run `db:migrate`.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts drizzle
git commit -m "Add phones, listings, price history and model decisions tables"
```

Shehan then runs `npm run db:migrate` (controller asks).

---

### Task 2: Warranty classifier

**Files:**
- Create: `src/normalize/warranty.ts`, `src/normalize/warranty.test.ts`
- Modify: `package.json` (`test` script runs every `*.test.ts` file listed explicitly)

**Interfaces:**
- Consumes: `Warranty` from `@/db/schema`.
- Produces: `classifyWarranty(text: string | null | undefined): Warranty | null` (null = unclear → model); `warrantyOf(rawTitle: string, payload: { variant?: Record<string,string>; warrantyText?: string | null }): { text: string | null; warranty: Warranty | null }`.

- [ ] **Step 1: Write the failing tests** — every case below is real wording from the 2026-10-24 scrape.

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { classifyWarranty, warrantyOf } from './warranty'

const cases: [string | null, string | null][] = [
  ['1 Year Company Warranty', 'company'],
  ['1 Year Softlogic', 'company'],
  ['1 Year Genxt Company', 'company'],
  ['1 Year Abans', 'company'],
  ['1 Year Huawei', 'company'],
  ['2 Year Oppo Company', 'company'],
  ['1 Year Vivo', 'company'],
  ['1 Year Agent Warranty', 'company'],
  ['1 Year Authorized Company', 'company'],
  ['18 Months Company Warranty', 'company'],
  ['18-Month Company Warranty', 'company'],
  ['1st Year Company Warranty 2nd Year Celltronics Software Warranty', 'company'],
  ['1st Year GENXT Warranty 2nd Year Celltronics Software Warranty', 'company'],
  ['ve To Stock Availability 1 Year Company Warranty', 'company'],
  ['1 Year AppleCare (International)', 'apple'],
  ['1 Year Apple Care Warranty', 'apple'],
  ['1 Year AppleCare Warranty 2nd Year Celltronics Software Warranty', 'apple'],
  ['le A20 Pro 2nm chip One Year Apple Care Warranty', 'apple'],
  ['1 Year Software', 'shop'],
  ['6 Months Hardware + 1 Year Software Warranty', 'shop'],
  ['Six Months Hardware + One Year Software Warranty', 'shop'],
  ['6 Month Hardware and 1 Year Software Warranty', 'shop'],
  ['1 Year Hardware + 1 Year Software (+Rs.7,000.00)', 'shop'],
  ['1 Year Software & 1st 6 Months Hardware Warranty', 'shop'],
  ['2 Years Warranty', 'unstated'],
  ['2-YEAR WARRANTY', 'unstated'],
  ['1 Year Warranty', 'unstated'],
  ['18 Months Warranty', 'unstated'],
  [null, 'unstated'],
  ['', 'unstated'],
  ['S FRONT SCREEN & BACK GLASS REPLACEMENT WARRANTY TWO YEARS WARRANTY + TRCSL APPROVED', null],
]

for (const [text, expected] of cases) {
  test(`classifyWarranty(${JSON.stringify(text)}) = ${expected}`, () => {
    assert.equal(classifyWarranty(text), expected)
  })
}

test('warrantyOf prefers the chosen option, then the payload text, then the title', () => {
  assert.deepEqual(
    warrantyOf('Galaxy A57 5G 8GB / 256GB', { variant: { Warranty: '6 Month Hardware and 1 Year Software Warranty' }, warrantyText: 'x' }),
    { text: '6 Month Hardware and 1 Year Software Warranty', warranty: 'shop' },
  )
  assert.deepEqual(
    warrantyOf('Honor X5B 4GB | 64GB', { variant: {}, warrantyText: 'One Year Company Warranty + TRCSL Approved' }),
    { text: 'One Year Company Warranty + TRCSL Approved', warranty: 'company' },
  )
  assert.deepEqual(
    warrantyOf('Samsung Galaxy A37 5G 12GB | 256GB Company Warranty', { variant: {}, warrantyText: null }),
    { text: 'Company Warranty', warranty: 'company' },
  )
  assert.deepEqual(
    warrantyOf('Apple iPhone Air 256GB with Apple Care', { variant: {}, warrantyText: null }),
    { text: 'Apple Care', warranty: 'apple' },
  )
  assert.deepEqual(warrantyOf('Google Pixel 9a 128GB', { variant: {}, warrantyText: null }), { text: null, warranty: 'unstated' })
})
```

- [ ] **Step 2: Run to see it fail**

Set `"test": "tsx --test src/scrapers/woocommerce.test.ts src/normalize/warranty.test.ts"`. Run `npm test`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/normalize/warranty.ts`**

```ts
import type { Warranty } from '@/db/schema'

/**
 * Warranty wording → class, by rule. Order matters: a row naming AppleCare or
 * a company warranty for the first year is that, even when a shop adds its own
 * software warranty for the second ("1st Year Company Warranty 2nd Year
 * Celltronics Software Warranty").
 *
 * Null means unclear: the caller hands it to the model, which picks a class or
 * declines. A bare duration ("2 Years Warranty") is not unclear, it is
 * unstated: nothing in it says who backs the phone.
 */
const APPLE = /apple\s*care|apple\s+warranty/i
const COMPANY =
  /company|agent|authori[sz]ed|official|\b(softlogic|abans|genxt|singer|dialog|samsung|huawei|oppo|vivo|honor|xiaomi|realme|tecno|infinix|nokia|motorola|oneplus|google|zte|nothing)\b/i
const SHOP = /software|hardware|shop\s+warranty/i
const BARE_DURATION =
  /^\s*(?:\d+|one|two|three|six|twelve|eighteen)(?:st|nd)?\s*-?\s*(?:years?|months?)\s*(?:warranty)?\s*$/i

export function classifyWarranty(text: string | null | undefined): Warranty | null {
  const t = (text ?? '').trim()
  if (!t) return 'unstated'
  if (APPLE.test(t)) return 'apple'
  if (COMPANY.test(t)) return 'company'
  if (SHOP.test(t)) return 'shop'
  if (BARE_DURATION.test(t)) return 'unstated'
  return null
}

/** Phrases some shops put in the title instead of a field. */
const TITLE_PHRASE = /(apple\s*care|(?:\w+\s+)?company\s+warranty|genxt\s+warranty)/i

/**
 * The warranty a row was sold with: the chosen option first (celltronics,
 * lifemobile, doctormobile price per warranty), then the scraper's raw text,
 * then a phrase in the title (geniusmobile, celltronics).
 */
export function warrantyOf(
  rawTitle: string,
  payload: { variant?: Record<string, string>; warrantyText?: string | null },
): { text: string | null; warranty: Warranty | null } {
  const chosen = Object.entries(payload.variant ?? {}).find(([k]) => /warrant/i.test(k))?.[1]
  const text = chosen || payload.warrantyText || rawTitle.match(TITLE_PHRASE)?.[1]?.replace(/^with\s+/i, '') || null
  return { text, warranty: classifyWarranty(text) }
}
```

Adjust only if a test case disagrees; the test list is the spec. Keep `TITLE_PHRASE` returning "Company Warranty" for "… 256GB Company Warranty" (strip a leading word that is a size or `|`).

- [ ] **Step 4: Run** `npm test` → all pass. `npm run typecheck` → clean.

- [ ] **Step 5: Commit** `git commit -m "Classify warranty wording by rule"`

---

### Task 3: Phone identity extractor

**Files:**
- Create: `src/normalize/phone.ts`, `src/normalize/phone.test.ts`
- Modify: `package.json` (`test` adds `src/normalize/phone.test.ts`)

**Interfaces:**
- Produces:

```ts
export type PhoneIdentity = {
  phoneId: string
  brand: string          // canonical: 'Samsung', 'Xiaomi', 'Apple', 'Nothing', …
  model: string          // display: 'Galaxy A56', 'Redmi Note 13 Pro 5G', 'iPhone 17 Pro'
  ramGb: number | null   // null only for Apple
  storageGb: number
  esimOnly: boolean
}
export type PhoneDrop = { drop: 'not-a-phone' | 'brand' | 'no-storage' | 'no-ram' | 'used' | 'no-model' }
export function extractPhone(rawTitle: string): PhoneIdentity | PhoneDrop
export function slug(text: string): string
export const BRANDS: readonly string[]   // the 16, canonical spelling
```

Rules (each one is a test below):
1. **Clean:** replace `<br>`, `⎢`, `|`, `–`, `—` with spaces; collapse spaces; `( 3a )` → `(3a)`.
2. **Used / non-phone:** drop `used|refurb|pre-owned|open box` (`used`); drop `\b(tab|tablet|ipad|matepad|pad|watch|buds|band)\b` (`not-a-phone`).
3. **Brand:** first matching of: leading brand word (case-insensitive, incl. typos `xiaom`, `hono`), or family word anywhere at the start: `iPhone`→Apple, `Galaxy`→Samsung, `Redmi|POCO|Mi \d`→Xiaomi, `Pixel`→Google, `Moto`→Motorola, `CMF`→Nothing, `nubia`→ZTE, `HMD`→Nokia (brand 'Nokia'). Anything else → `brand`.
4. **Memory:** in order — `(\d+)\s*\+\s*\d+\s*GB` = RAM is the first number (virtual RAM ignored); `(\d+)\s*GB\s*(?:RAM)?\s*[|/+\-]?\s*(\d+)\s*(GB|TB)` = RAM, storage; bare `(\d+)\s*\+\s*(\d+)\b` (`A14 6+128`) = RAM, storage; `(\d+)\s*GB\s+RAM` = RAM; storage = the largest of `\d+\s*(GB|TB)` or a bare `16|32|64|128|256|512` after a separator, in {16, 32, 64, 128, 256, 512, 1024, 2048}. RAM must be ≤ 24 and < storage.
5. **Missing:** no storage → `no-storage`. Non-Apple without RAM → `no-ram`.
6. **Model:** the title after the brand word, cut at the first memory token; strip `5G|4G` (except the dual-network list), `E-?SIM` (sets `esimOnly`, Apple only), `with Apple Care`, `(\w+ )?Company Warranty`, `GENXT Warranty`, `with Free Gift`, `Foldable`, a trailing `- Colour Name`, empty brackets and stray punctuation. Normalise: Samsung model always starts `Galaxy`; `Flip6`→`Flip 6`, `Fold8`→`Fold 8`; Xiaomi `Mi 13T`→`13T`; Google `10 Pro XL`→`Pixel 10 Pro XL`; Motorola `G04S`/`Moto G04S`→`Moto G04s` (a model of letters+digits after `Moto` keeps `Moto`); `CMF Phone 2 Pro` keeps `CMF`. Empty → `no-model`.
7. **Aliases:** `iPhone 17 Air` → `iPhone Air` (Apple sells it as iPhone Air).
8. **Dual-network list:** `const DUAL_NETWORK = ['galaxy a15', 'galaxy a16', 'galaxy a17', 'galaxy a05s', 'redmi note 13', 'redmi 13c', 'redmi a5', 'realme note 60x', 'oppo a6x', 'infinix hot 60']` — for these, `4G`/`5G` stays in the model.
9. **Id:** `slug([brand, model, ram && `${ram}gb`, `${storage}gb`, esimOnly && 'esim'])` with `slug` = lowercase, `+` → `-plus` (Hot 60 Pro and Hot 60 Pro+ are different phones), `TB` storage in GB (1 TB = 1024), other non-alphanumerics → `-`, trimmed. Brand word is not repeated (`Nothing Phone (1)` → `nothing-phone-1-12gb-256gb`). The dual-network list matches the model without its network token exactly (`Redmi Note 13` is on it, `Redmi Note 13 Pro` is not).

- [ ] **Step 1: Write the failing tests** — real titles from the 2026-10-24 scrape.

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { extractPhone } from './phone'

const ids: [string, string][] = [
  ['Samsung Galaxy A56 (8GB RAM 128GB)', 'samsung-galaxy-a56-8gb-128gb'],
  ['Galaxy A57 5G 8GB / 256GB', 'samsung-galaxy-a57-8gb-256gb'],
  ['Samsung Galaxy A57 5G 12GB RAM 256GB Company Warranty', 'samsung-galaxy-a57-12gb-256gb'],
  ['SAMSUNG Galaxy S26 Ultra 5G 12GB + 256GB', 'samsung-galaxy-s26-ultra-12gb-256gb'],
  ['Samsung Galaxy S24 FE-5G (8GB RAM 256GB)', 'samsung-galaxy-s24-fe-8gb-256gb'],
  ['Samsung Galaxy S24 FE 5G 8GB | 128GB', 'samsung-galaxy-s24-fe-8gb-128gb'],
  ['Samsung Galaxy Z Flip 6 12GB RAM 256GB', 'samsung-galaxy-z-flip-6-12gb-256gb'],
  ['Samsung Galaxy Z Fold 7 (12GB RAM 512GB)', 'samsung-galaxy-z-fold-7-12gb-512gb'],
  ['Samsung Galaxy A14 6+128', 'samsung-galaxy-a14-6gb-128gb'],
  ['Samsung Galaxy A16 5G (8GB RAM 256GB)', 'samsung-galaxy-a16-5g-8gb-256gb'],
  ['Samsung Galaxy A15 4G 8GB RAM 128GB', 'samsung-galaxy-a15-4g-8gb-128gb'],
  ['Xiaomi Redmi Note 13 Pro 5G (8GB RAM 256GB)', 'xiaomi-redmi-note-13-pro-8gb-256gb'],
  ['Redmi Note 13 8GB-256GB', 'xiaomi-redmi-note-13-8gb-256gb'],
  ['Redmi 12 6GB+128GB', 'xiaomi-redmi-12-6gb-128gb'],
  ['REDMI 15 6GB + 128GB', 'xiaomi-redmi-15-6gb-128gb'],
  ['Xiaomi Redmi 13 4G 6GB RAM 128GB GENXT Warranty', 'xiaomi-redmi-13-6gb-128gb'],
  ['Xiaomi Mi 13T 5G 12GB RAM 256GB', 'xiaomi-13t-12gb-256gb'],
  ['Xiaomi Poco X6 Pro 5G 8GB RAM 256GB', 'xiaomi-poco-x6-pro-8gb-256gb'],
  ['Apple iPhone 17 Pro Max 256GB', 'apple-iphone-17-pro-max-256gb'],
  ['Apple iphone 18 pro 256GB', 'apple-iphone-18-pro-256gb'],
  ['Apple iPhone 17 <br>256GB', 'apple-iphone-17-256gb'],
  ['Apple iPhone 17 (256GB) E-SIM', 'apple-iphone-17-256gb-esim'],
  ['Apple iPhone 16e 128GB (E-sim) with Apple Care', 'apple-iphone-16e-128gb-esim'],
  ['Apple iPhone 16 Pro Max (E-Sim) 1TB with Apple Care', 'apple-iphone-16-pro-max-1024gb-esim'],
  ['Apple iPhone 17 Air 256GB', 'apple-iphone-air-256gb'],
  ['Apple iPhone Air 256GB with Apple Care', 'apple-iphone-air-256gb'],
  ['Google Pixel 8 Pro (12GB RAM 256GB)', 'google-pixel-8-pro-12gb-256gb'],
  ['Google 10 Pro XL 12GB | 512GB', 'google-pixel-10-pro-xl-12gb-512gb'],
  ['Google Pixel 9 Pro Fold 16GB RAM 256GB', 'google-pixel-9-pro-fold-16gb-256gb'],
  ['HONOR Magic V5 Foldable 16GB RAM 512GB', 'honor-magic-v5-16gb-512gb'],
  ['HONOR X9d – 12GB/256GB', 'honor-x9d-12gb-256gb'],
  ['Honor X7D (8GB / 256GB )', 'honor-x7d-8gb-256gb'],
  ['MOTO G04S 4GB ⎢ 64GB', 'motorola-moto-g04s-4gb-64gb'],
  ['Motorola Moto G06 Power 4GB RAM 64GB', 'motorola-moto-g06-power-4gb-64gb'],
  ['Moto e40 4GB RAM 64GB – Carbon Gray', 'motorola-moto-e40-4gb-64gb'],
  ['Motorola Edge 60 12GB RAM 256GB 5G', 'motorola-edge-60-12gb-256gb'],
  ['Nothing Phone (1) 12GB RAM 256GB', 'nothing-phone-1-12gb-256gb'],
  ['NOTHING Phone ( 3a ) Lite 8GB / 128GB', 'nothing-phone-3a-lite-8gb-128gb'],
  ['CMF Phone 2 Pro 8GB / 128GB', 'nothing-cmf-phone-2-pro-8gb-128gb'],
  ['OnePlus Nord N20 SE 4GB RAM 128GB', 'oneplus-nord-n20-se-4gb-128gb'],
  ['Infinix Hot 60 Pro+ 8GB | 256GB', 'infinix-hot-60-pro-plus-8gb-256gb'],
  ['Infinix Hot 60 Pro 8GB | 256GB', 'infinix-hot-60-pro-8gb-256gb'],
  ['Oppo A6x 4G 4GB | 128GB', 'oppo-a6x-4g-4gb-128gb'],
  ['Realme Note 60x 4G (4GB RAM 64GB)', 'realme-note-60x-4g-4gb-64gb'],
  ['Motorola Moto G24 Power 8+8GB RAM 128GB', 'motorola-moto-g24-power-8gb-128gb'],
  ['OnePlus 6 128GB -Mirror Black 8GB RAM', 'oneplus-6-8gb-128gb'],
]
for (const [title, id] of ids) {
  test(`id: ${title}`, () => {
    const r = extractPhone(title)
    assert.ok('phoneId' in r, `dropped: ${JSON.stringify(r)}`)
    assert.equal(r.phoneId, id)
  })
}

const drops: [string, string][] = [
  ['Samsung Galaxy Tab S6 Lite 2024 (4GB RAM 128GB)', 'not-a-phone'],
  ['Honor Pad X9a 8GB | 256GB', 'not-a-phone'],
  ['Blackview Color 8 8+8GB RAM 128GB', 'brand'],
  ['Softlogic Max 222 2025', 'brand'],
  ['Alcatel 1021', 'brand'],
  ['Nokia 105 with Company Warranty', 'no-storage'],
  ['Samsung Galaxy S21 Ultra 5G with Free Gift', 'no-storage'],
  ['Google Pixel 7 ⎢256', 'no-ram'],
  ['Google Pixel 9a 128GB', 'no-ram'],
  ['iPhone 13 128GB (Used)', 'used'],
]
for (const [title, reason] of drops) {
  test(`drop ${reason}: ${title}`, () => {
    assert.deepEqual(extractPhone(title), { drop: reason })
  })
}

test('display fields', () => {
  assert.deepEqual(extractPhone('Galaxy A57 5G 8GB / 256GB'), {
    phoneId: 'samsung-galaxy-a57-8gb-256gb', brand: 'Samsung', model: 'Galaxy A57', ramGb: 8, storageGb: 256, esimOnly: false,
  })
  assert.deepEqual(extractPhone('Apple iPhone 17 (256GB) E-SIM'), {
    phoneId: 'apple-iphone-17-256gb-esim', brand: 'Apple', model: 'iPhone 17', ramGb: null, storageGb: 256, esimOnly: true,
  })
})
```

- [ ] **Step 2: Run to see it fail** (`npm test`, module not found).

- [ ] **Step 3: Implement `src/normalize/phone.ts`** following rules 1–9, with a doc comment per rule naming the title that forced it (style of PCPrice's `extract.ts`). Pure; no imports beyond types. Anchor every noise pattern (PCPrice decision: unanchored short patterns ate model names).

- [ ] **Step 4: Run** `npm test` → all pass; `npm run typecheck` → clean.

- [ ] **Step 5: Measure on real data (read-only)**

Write `scripts/_coverage.mts` (not committed): read `.superpowers/p2/rows.json` if present, else query `raw_listings` (distinct latest rows) with `@neondatabase/serverless`; run `extractPhone` on every title; print counts per drop reason, per shop, and 40 random kept ids. Target: ≥ 85% of rows from in-scope brands with storage resolve to an id. Paste the counts into the report. Fix rules only with a new test case per fix.

- [ ] **Step 6: Commit** `git commit -m "Extract phone identity from titles"`

---

### Task 4: Normalize run and CLI

**Files:**
- Create: `src/pipeline/normalize.ts`, `scripts/normalize.ts`
- Modify: `package.json` (`"normalize": "tsx --env-file-if-exists=.env.local scripts/normalize.ts"`), `src/pipeline/runs.ts` (import `NormalizeResult` from `./normalize`, delete the stub)

**Interfaces:**
- Consumes: `extractPhone`, `warrantyOf`, schema tables, `getDb`, `startRun`/`finishRun`/`reapStaleRuns`/`detectActor` from `./runs`.
- Produces: `runNormalize(opts: NormalizeOptions): Promise<NormalizeResult>` with

```ts
export type NormalizeOptions = { limit?: number; redo?: boolean; dryRun?: boolean; noAi?: boolean; maxModelCalls?: number; log?: (m: string) => void }
export type NormalizeResult = {
  considered: number
  matchedByRule: number
  matchedByModel: number
  dropped: Record<string, number>     // extractPhone drop reasons + 'no-price'
  unmatched: number
  warrantyByModel: number
  warrantyUnclear: number
  phonesCreated: number
  listingsWritten: number
  historyRows: number
  modelCalls: number
}
```

Steps (copy the shape of PCPrice `runNormalize`, lines 265–533, dropping specs, curated catalog and overrides):

- [ ] **Step 1:** Load unprocessed `raw_listings` (`normalized_at is null`, or all with `--redo`), default limit 20000, ordered by `scraped_at`.
- [ ] **Step 2:** For each row: `extractPhone(rawTitle)`; on a drop, count the reason and mark processed. (Task 5 adds the model path for `no-model`/`brand`-less-but-storage rows; leave a single clearly named hook `resolveUnclearTitle` returning null for now.)
- [ ] **Step 3:** `warrantyOf(rawTitle, payload)`; a null class is left for Task 5's `resolveUnclearWarranty` hook (returning `'unstated'` for now) and counted in `warrantyUnclear`.
- [ ] **Step 4:** Price floor: `priceLkr < 1000` or not finite → `dropped['no-price']++`, mark processed.
- [ ] **Step 5:** Collect new phones (insert `onConflictDoNothing`), then the best row per `(phoneId, shop, warranty)`: buyable first, then cheapest (PCPrice comment carried over). URL = `payload.variationUrl ?? sourceUrl`; `inStock = payload.inStock !== false`.
- [ ] **Step 6:** Upsert `listings` on the 3-column key; upsert today's `price_history` on the 4-column key (refreshes the same day's point). Chunks of 100.
- [ ] **Step 7:** Stamp `normalized_at` on every considered row (chunks of 200).
- [ ] **Step 8:** Log the three summary lines (resolved / dropped by reason / wrote) — the workflow greps them.
- [ ] **Step 9: CLI `scripts/normalize.ts`** — flags `--limit N`, `--redo`, `--dry-run`, `--no-ai`, `--max-model-calls N`; wraps the run in `startRun({ kind: 'normalize', shop: null, actor, dryRun })` / `finishRun` exactly as `scripts/scrape.ts` does; exits 1 on failure.
- [ ] **Step 10: Verify**
  - `npm test`, `npm run typecheck`.
  - `npm run normalize -- --dry-run --no-ai` against Neon (needs Task 1's migration applied — the controller confirms first). Report the three summary lines.
- [ ] **Step 11: Commit** `git commit -m "Normalize raw rows into phones and listings"`

---

### Task 5: Claude Haiku 5.5 fallback

**Files:**
- Create: `src/normalize/ai.ts`
- Modify: `src/pipeline/normalize.ts` (fill the two hooks), `package.json` (+ `@anthropic-ai/sdk`, `zod`), `.env.example` (+ `ANTHROPIC_API_KEY=""`)

**Interfaces:**
- Produces:

```ts
export const MODEL = 'claude-haiku-5-5'
export function aiAvailable(): boolean
export type TitleCandidate = { phoneId: string; brand: string; model: string; ramGb: number | null; storageGb: number }
export async function matchTitle(rawTitle: string, candidates: TitleCandidate[]): Promise<{ answer: string | null; confidence: 'high' | 'low'; reason: string }>
export async function classifyWarrantyText(text: string): Promise<{ answer: Warranty | null; confidence: 'high' | 'low'; reason: string }>
```

- [ ] **Step 1: Install** `npm install @anthropic-ai/sdk zod`.
- [ ] **Step 2: Write `src/normalize/ai.ts`** — copy PCPrice's file header and rules (choose from the list or decline; never recall specs; declining is correct), adapted to phones:
  - Title system prompt rules: the same phone means same brand, same model line and suffix (Pro, Pro Max, Plus, Ultra, FE, Lite, e, s, a are different phones), same RAM and storage; colour, warranty, bundled gifts and 4G/5G wording don't make a different phone; never settle for the nearest candidate.
  - Warranty system prompt: classes `company` (the brand's official Sri Lankan agent or distributor backs it), `shop` (the shop's own, often "software" or "hardware" warranty), `apple` (AppleCare / Apple's warranty), `unstated` (nothing says who backs it); decline (`null`) when the text is not about a phone warranty.
  - Call shape (structured outputs; Haiku 5.5 thinking is adaptive, keep it cheap):

```ts
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'

const TitleAnswer = z.object({
  phone_id: z.string().nullable(),
  confidence: z.enum(['high', 'low']),
  reason: z.string(),
})

const response = await getClient().messages.parse({
  model: MODEL,
  max_tokens: 1024,
  output_config: { effort: 'low', format: zodOutputFormat(TitleAnswer) },
  system: TITLE_SYSTEM,
  messages: [{ role: 'user', content: [`Listing title: ${rawTitle}`, '', 'Candidates:', ...candidates.map((c) => `- ${c.phoneId} | ${c.brand} ${c.model} | ${c.ramGb ?? '-'}GB RAM | ${c.storageGb}GB`)].join('\n') }],
})
if (response.stop_reason === 'refusal' || !response.parsed_output) return { answer: null, confidence: 'low', reason: `no answer (${response.stop_reason})` }
```

  - Guard: accept `phone_id` only if it is in the candidate list; any thrown error → decline with the message as reason (this path must never fail a run).
- [ ] **Step 3: Fill the hooks in `src/pipeline/normalize.ts`**
  - **Which titles go to the model:** rows dropped as `no-model` or `brand` only when the title has storage (`extractPhone` found storage) — never `used`, `not-a-phone`, `no-storage`, `no-ram`. Candidates: phones with the same `storageGb` (and same `ramGb` when the title states RAM), from the current `phones` table plus phones created this run; if a brand word or family is present, same brand only; cap 150 candidates; zero candidates → no call.
  - **Cache:** before calling, look up `model_decisions` by `(kind, input)`; reuse a stored answer (even a decline) without calling. After calling, insert the decision. Input key: titles `${shop}\u0000${rawTitle}`, warranty the text.
  - **Budget:** stop calling after `maxModelCalls` (default 300) per run; remaining unclear rows stay unclear and are retried next run (they are not stamped `normalized_at`).
  - Log every accepted model answer: `  model: "<title>" -> <phone_id> (<reason>)` / `  model warranty: "<text>" -> <class>`.
  - Unclear warranty → `classifyWarrantyText`; a decline or low confidence → `unstated`.
- [ ] **Step 4: Verify** `npm test`, `npm run typecheck`. With `ANTHROPIC_API_KEY` set in `.env.local` (controller confirms Shehan added it): `npm run normalize -- --dry-run --max-model-calls 20`; report model calls, accepted answers with reasons, and estimated cost from `response.usage` (log total input/output tokens per run).
- [ ] **Step 5: Commit** `git commit -m "Ask Claude Haiku 5.5 about titles and warranty text the rules can't settle"`

---

### Task 6: First real run, spot check, nightly job

**Files:**
- Create: `.github/workflows/normalize.yml`
- Modify: `docs/status.md`, `docs/architecture.md` (only if behaviour differs from what it says), `scripts/nightly-home.cmd` (none — normalize runs on GitHub)

- [ ] **Step 1: Real run** `npm run normalize` (not dry). Record the summary lines in docs/status.md (new "First normalize run" table: rows considered, matched by rule / by model, dropped by reason, phones, listings).
- [ ] **Step 2: Spot check 30 phones** (read-only query): for 30 random phone ids with ≥ 2 shops, list each shop's title, warranty and price. Check no phone mixes two RAM/storage configs or two models. Record the result (n correct / 30) in the report; any wrong merge gets a failing test in Task 3's file and a fix before continuing.
- [ ] **Step 3: Nightly workflow** `.github/workflows/normalize.yml` — `schedule: '30 21 * * *'` (03:00 Sri Lanka, after the 01:30 home-PC scrape) and `workflow_dispatch`; same "Require configuration" step for `DATABASE_URL`; warn (not fail) when `ANTHROPIC_API_KEY` is missing; `npm ci`; `set -o pipefail`; `npm run normalize 2>&1 | tee /tmp/normalize.log`; summary = the three summary lines; timeout 20 minutes; concurrency group `normalize`.
- [ ] **Step 4: Commit** `git commit -m "Nightly normalize job and first run results"`; Shehan adds the `ANTHROPIC_API_KEY` Actions secret.

---

## Self-review

- Spec coverage: identity rules (Task 3, rules 1–9 incl. RAM required, Apple no RAM, eSIM, colour merge, 4G/5G list), warranty classes and reading order (Task 2), listings keyed (phone, shop, warranty) and history with warranty (Tasks 1, 4), price floor (Task 4), Haiku 5.5 fallback with cache, high-confidence only, logging, missing-key degrade (Task 5), nightly normalize (Task 6). The site is phase 3.
- Placeholders: none; Task 3 code is specified by rules + test cases (the tests are the spec), other code given in full.
- Names: `extractPhone`, `PhoneIdentity`, `PhoneDrop`, `slug`, `classifyWarranty`, `warrantyOf`, `matchTitle`, `classifyWarrantyText`, `MODEL`, `runNormalize`, `NormalizeResult`, tables `phones`/`listings`/`priceHistory`/`modelDecisions`, enum `warrantyEnum`/`Warranty` — consistent across tasks.

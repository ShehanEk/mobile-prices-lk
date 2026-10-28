# Architecture (draft)

Same shape as PCPrice.lk: nightly scrape → `raw_listings` → normalize →
static pages kept a day, cache cleared nightly by `/api/revalidate`.
Read [PCPrice.lk's architecture](https://github.com/ShehanEk/sl-pc-part-picker/blob/master/docs/architecture.md)
and [pipeline](https://github.com/ShehanEk/sl-pc-part-picker/blob/master/docs/pipeline.md)
first. This page lists only what differs.

## Codebase: copy PCPrice.lk, then delete

A new repo, started from a copy of PCPrice.lk's files (fresh git history),
then cut down. No shared package.

| Keep as is | Rewrite | Delete |
|---|---|---|
| `src/lib/http.ts` (polite fetch) | `src/normalize/extract.ts` → `extractPhone` only | `src/compat/`, `/build`, `build-store.ts` |
| `src/scrapers/woocommerce.ts` + `types.ts` | `src/db/schema.ts` (see below) | `src/catalog/` (no spec catalogs) |
| `src/pipeline/scrape.ts`, `runs.ts`, sanity gate | `src/lib/site.ts` (name, brands as "categories") | — |
| `src/lib/deals.ts`, `search.ts`, `og.tsx`, `Analytics.tsx` | Phone page and list page UI (designed on canvas first) | PC scrapers (gamestreet, nanotek …) |
| `/api/revalidate`, `next.config.ts` headers, workflows | `src/queries/seo.ts` (cache per brand) | `src/queries/parts.ts` (already dead) |

**Why copy, not share:** each brand repo stands alone (no shared config). A
shared package would mean versioning and publishing across two repos for one
operator. **Cost:** a fix to `http.ts` or `woocommerce.ts` must be ported by
hand. They change rarely; note each port in both `decisions.md` files.

**Desktop app:** not copied at first. Phase 1 checks whether any launch shop
blocks GitHub's runners (several sit behind Cloudflare). Copy it only if one
does.

## Data model differences

- `parts` → **`phones`**, keyed by `phone_id`: `apple-iphone-17-pro-256gb`,
  `samsung-galaxy-a56-8gb-256gb`. Columns: brand, model, storage_gb, ram_gb,
  esim_only, plus display specs read from listings (screen, chipset, battery)
  as nullable.
- `listings` key becomes **`(phone_id, shop, warranty)`**, not
  `(part_id, shop)`. celltronics.lk sells one phone with a choice of warranty
  at different prices, so one shop can have two real offers.
- `listings.warranty` is an enum: `company`, `shop`, `apple`, `unstated`, with
  the raw text kept beside it.
- `price_history` gains the same `warranty` column, so the chart can draw
  company-warranty prices separately.

## Identity: what "the same phone" means

| Folded into `phone_id` | Not folded in |
|---|---|
| Brand + model (Pro, Max, Ultra, FE, Plus, Lite are model words) | Colour (always merges) |
| Storage | Warranty (an offer attribute, filterable) |
| RAM, for every brand except Apple | Bundled gifts, "free" items |
| eSIM-only, for iPhones whose title says so | 4G/5G, except models on a short curated list sold both ways |

- An Android listing with no RAM is **dropped**, like a laptop with no config
  on PCPrice.lk. RAM is in the title or a `Capacity` attribute at all six
  launch shops. "3+8GB" and "6+6GB" mean physical RAM 3 and 6 (the rest is
  virtual).
- Apple never states RAM, so iPhones key on model + storage (+ eSIM).

## Variable products

Most launch shops list one product per phone with storage, colour and
warranty as WooCommerce variations, and the product's own price is the
cheapest variation (idealz.lk shows 0). The scraper reads each variation's
price from the Store API, **one request per distinct storage × warranty**,
skipping colour-only variations. That is the step PCPrice.lk skipped for
tecroot.lk RAM. Estimated cost: lifemobile.lk ~1,700 products, about 45–60
minutes a night at 1.5s per request.

## Warranty: how it is read

In order, first match wins:

1. The `Warranty` attribute or variation (celltronics, lifemobile, doctormobile).
2. The title: "(Samsung Warranty)", "with Apple Care".
3. The short description: "One Year Company Warranty", "Six Months Hardware +
   One Year Software Warranty" (geniusmobile).
4. Otherwise `unstated`.

Classification: "company", "official", "<brand> warranty" → `company`;
"software warranty", "N months hardware", "shop warranty" → `shop`;
"Apple Care", "Apple warranty" → `apple`. Unclassified text stays
`unstated` with the raw text logged, so new phrasings are found by reading
the rejects.

## Model fallback for unclear rows (phase 2)

Rules run first on every row; the Claude API sees only what they leave
unclear. Same contract as PCPrice.lk's `src/normalize/ai.ts`, which is copied
and extended:

| Unclear case | The model is given | It answers |
|---|---|---|
| Title the extractor can't resolve to a `phone_id` | The title, the shop's option values, and the existing `phone_id`s for that brand | One of those ids, or "none" |
| Warranty text the classifier can't place | The raw warranty text | `company`, `shop`, `apple` or `unstated` |

- It never recalls a spec or invents a phone: it picks from what it was given
  or declines. Only high-confidence answers are used.
- Every model decision is logged with its reason, and stored per
  `(shop, raw title)` / per warranty text, so the same text is never asked
  twice. Nightly calls are only for text not seen before.
- `ANTHROPIC_API_KEY` in `.env.local` and as a GitHub Actions secret. A missing
  key degrades the run (rows stay unmatched), never fails it.
- Model: Claude Haiku 5.5 (`claude-haiku-5-5`); see [decisions](decisions.md).

## Rendering and caching

One "category" (phones) would be one cache entry and risks the 2 MB limit
that silently froze PCPrice.lk's prices. Cache **per brand** from day one.

Pages and cached reads keep for a day (tag `catalog`). The last step of
`normalize.yml` calls `/api/revalidate`, which is the routine refresh; the day
is a backstop. Refreshing every 30 minutes re-read the catalogue up to 48
times a day and used up PCPrice.lk's free Neon transfer
([decision](decisions.md#2026-10-29--caches-keep-a-day-the-nightly-run-is-the-refresh)).

## Hosting and cost

| Item | Choice | Cost |
|---|---|---|
| Web | New Vercel project, same team as PCPrice.lk | $0 on Hobby (see open question on Hobby vs Pro) |
| Database | **New Neon project**, not a second database in PCPrice's | $0 on the free plan; catalogue is smaller than PCPrice's |
| Jobs | GitHub Actions in the new repo | $0 if public; private repos get 2,000 free minutes/month, a nightly run uses ~60–90 |
| Domain | `mobileprices.lk`, Standard, LK Domain Registry | LKR 8,000/year |
| Model | None at launch | $0 |

A separate Neon project keeps each brand's data, credentials and limits
apart and costs nothing extra.

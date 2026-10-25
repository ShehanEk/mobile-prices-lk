# Phase 3 — Site: design

Status: approved in chat, 2026-10-25. Builds the pages on the
[design canvas](https://claude.ai/artifact/5c2UPCMy6WQSiMyJBveBwv) over the
phase 2 tables. Lists only what differs from PCPrice.lk.

## Pages

| Route | From the canvas | Notes |
|---|---|---|
| `/` | Home | Search, "Cheapest today", brand tiles, warranty explainer, shop list in the footer |
| `/[brand]` | Brand list | Filters: warranty, storage, RAM, shop, in stock; sort by price or shop count |
| `/[brand]/[phoneId]` | Phone page, and Phone page at 390px | Configuration chips, two headline prices, every-price table with a "Company warranty only" switch, 90-day chart, specs block |
| `/search`, `/privacy`, `/deals` | — | As PCPrice.lk |
| OG images, `sitemap.ts`, `robots.ts`, `/api/revalidate` | — | As PCPrice.lk |

- **Nav:** Brands, Price drops, Search. No "Shops" link.
- **Price drops:** PCPrice's rule unchanged (≥5% under the 30-day median,
  ≥7 days on record). The home section and the nav link appear only when at
  least one phone qualifies.

## Code

Copy PCPrice.lk's Next.js app setup and these files unchanged, then adapt
names: `src/lib/deals.ts`, `search.ts`, `og.tsx`, `Analytics.tsx`,
`SearchBox.tsx`, `/api/revalidate`, `next.config.ts` headers, `robots.ts`,
`sitemap.ts`. Rewrite the pages, `src/lib/site.ts` (brands in place of
categories) and `src/queries/` for phones. Cache per brand
(`unstable_cache`, 30-minute revalidate, tag cleared by `/api/revalidate`).

## Price rules

- **Cheapest overall:** any warranty class, `unstated` included.
- **With company warranty:** `company` or `apple`. The Apple badge reads
  "Apple warranty" in the company colour.
- **Old prices:** a listing older than 7 days is shown as "last seen", as on
  PCPrice.lk (`STALE_AFTER_DAYS = 7`).
- In-stock prices win headline slots over out-of-stock ones.

## Specs from GSMArena

GSMArena gave permission by email on 2026-10-25 (Shehan keeps the email).
Its licence asks for attribution and forbids feeding its pages to AI.

- **Job:** `npm run specs`, nightly after normalize. For each
  `(brand, model)` with no stored specs: search GSMArena, pick the result by
  rules (brand + model words, 4G/5G when the model is on the dual-network
  list), fetch that page, keep main camera, display, network and colours.
  Selectors adapted from [mobile-specs-api](https://github.com/RevengerNick/mobile-specs-api)
  (MIT, credited in the file).
- **Never the model:** no GSMArena text goes to Claude.
- **Table:** `phone_specs` keyed by `(brand, model)`: `gsmarena_url`,
  `main_camera`, `display`, `network`, `colours`, `fetched_at`, plus
  `matched` (false = searched, no confident match; retried after 30 days).
- **Conduct:** honest user agent, one request every 5 s, stop the run on
  403/429. 834 models today ≈ 1,700 requests, a 2–3 hour first backfill
  that may take several nights; re-runs only fetch what is missing.
- **Where it runs:** GitHub Actions if GSMArena answers its runners,
  otherwise the home PC script. Checked in the first task.
- **On the page:** the specs block shows when a match exists, with
  "Specs: GSMArena.com →" linking the source page. With no match, only a
  "Full specs on GSMArena →" search link.

## Testing

- `node:test` for the price rules, staleness, the GSMArena result picker and
  the spec parser (saved GSMArena pages as fixtures).
- `next build` passes.
- Browser check at 375px and desktop for each page against the canvas;
  the phone page shows both headline prices on the first screen at 375px.

## Not in this phase

Vercel env vars, domain, GA4 property, Search Console (phase 4). Tablets.

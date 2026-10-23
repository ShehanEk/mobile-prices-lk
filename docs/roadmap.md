# Roadmap

Estimates are working hours with Claude doing the coding. Each phase ends
with something checkable.

## Phase 0 — Decide (~15 minutes left)

Done 2026-10-23 except registering the domain. Answer any new [open questions](open-questions.md); record each in
[decisions](decisions.md). Register `mobileprices.lk`.

## Phase 1 — Shops and scraper (~6 hours)

1. Copy PCPrice.lk into this repo and delete what [architecture](architecture.md#codebase-copy-pcpricelk-then-delete) lists.
2. New Neon project; schema with `phones` and warranty on `listings`.
3. Point `woocommerce.ts` at the six shops; add per-variation fetching.
4. One manual GitHub Actions run per shop to see which block the runners.
5. **Done when:** a dry run lands every shop's phones in `raw_listings`.

## Phase 2 — Matching (~6 hours)

1. `extractPhone` + warranty classifier, with `node:test` cases from real titles.
2. Read the rejected titles per shop; fix or accept each pattern.
3. **Done when:** ≥90% of in-scope rows match, and no phone page mixes two
   storage or RAM configs (spot-check 30).

## Phase 3 — Site (~10 hours)

1. Phone page and brand list designed on a Claude Design canvas, approved.
2. Build them; reuse deals, search, share images, analytics.
3. **Done when:** 375px check passes and a phone page shows both headline prices.

## Phase 4 — Launch (~2 hours)

1. Vercel project, domain, GA4 property, Search Console, sitemap.
2. Nightly schedule on; first three nights watched.
3. **Done when:** prices refresh overnight with no manual step.

## After launch

Tablets; phase-2 shops ([retailers](retailers.md#later-phase-2)); TRCSL badge
if the data supports it.

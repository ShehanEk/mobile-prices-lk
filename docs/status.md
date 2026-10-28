# Status

What is live and how it is set up. Update this when something ships or a
setting moves. Why each choice was made is in [decisions](decisions.md).

Last updated 29 October 2026.

## Live

- **Scraper:** six shops into `raw_listings`, nightly.
  - banana.lk and idealz.lk on GitHub Actions (00:45 and 01:00 Sri Lanka time).
  - lifemobile, celltronics, geniusmobile and doctormobile from Shehan's PC:
    Windows scheduled task "MobilePrices nightly scrape" runs
    `scripts/nightly-home.cmd` at 01:30, wakes the PC from sleep, and catches
    up after a missed night, then runs normalize so its rows are matched straight
    away (since 2026-10-25); the site shows them after the 03:00 GitHub run
    clears the cache. Logs in `logs/nightly-<date>.log`.
- **First real run (2026-10-24):**

  | Shop | Rows | With a price | Time |
  |---|---|---|---|
  | lifemobile.lk | 2,439 | 2,344 | 258 s |
  | celltronics.lk | 451 | 429 | 59 s |
  | geniusmobile.lk | 358 | 358 | 10 s |
  | banana.lk | 123 | 122 | 11 s |
  | idealz.lk | 52 | 37 | 10 s |
  | doctormobile.lk | 27 | 27 | 7 s |

- **Normalize (matching):** `npm run normalize` turns `raw_listings` into
  `phones`, `listings` (one price per phone + shop + warranty class) and daily
  `price_history`. Rules first; Claude Haiku 5.5 only for warranty text (and
  titles) the rules can't settle, cached in `model_decisions`.
  - Nightly on GitHub Actions at 03:00 Sri Lanka time (`normalize.yml`), after
    the 01:30 home-PC scrape (GitHub often starts it up to 2 hours late). The
    `ANTHROPIC_API_KEY` secret is set (2026-10-25).
- **First normalize run (2026-10-24):** `--redo --max-model-calls 60` over the
  6,900 stored rows (one scrape day, Sri Lanka date).

  | | Result |
  |---|---|
  | Rows resolved by rule / by model / unmatched | 5,496 / 0 / 0 |
  | Dropped | brand 704, no storage 376, no RAM 316, not a phone 8 |
  | Priced under LKR 1,000 (dropped after matching) | 232 |
  | Phones | 1,324 |
  | Listings by warranty | company 951, shop 747, apple 186, not stated 250 (2,134) |
  | Price history | 2,134 rows, all dated 2026-10-24 |
  | Warranty set by the model | 42 rows (16 distinct texts) |
  | Model calls | 16 of 60, 11,753 input / 1,131 output tokens, about $0.002 |
  | Spot check, 30 random phones at 2+ shops | 30 / 30 correct |

  The first run left 84 duplicate rows (old warranty class beside the new one);
  they were removed on 2026-10-24, which gives the post-cleanup numbers above.
- **Site (phase 3, built, not deployed):** Next.js 16 pages over the phase 2
  tables: home, brand lists (`/samsung`), phone pages
  (`/samsung/samsung-galaxy-s26-ultra-12gb-256gb`), search, price drops,
  privacy, share images, sitemap, robots, `/api/revalidate`. Reads are cached
  one entry per brand (tag `catalog`, kept a day; the nightly normalize run
  clears it through `/api/revalidate`). Prices older than
  7 days show as "last seen". Price drops and their nav link appear once a
  phone qualifies: at least 5% under its 30-day median price, with at least 7
  days on record. A phone page shows a Specs block when its model
  is matched on GSMArena ("Specs: GSMArena.com →" links the page); otherwise
  only "Full specs on GSMArena →" linking its search. Deploying, the domain,
  GA4 and Search Console are phase 4.
- **Specs from GSMArena:** `npm run specs`, nightly on GitHub Actions at
  04:00 Sri Lanka time (`specs.yml`, `--max-requests 1000`; moved from the
  home PC on 2026-10-26 after a probe passed), one request every 5 s, stops on
  403/429/redirect/bot check. If GSMArena starts blocking the runners, remove
  the schedule and run it from `nightly-home.cmd` again. Models are found on GSMArena's brand lists; its search is
  behind a bot check.
- **First specs backfill (2026-10-25/26):** 686 of 834 models matched, 148
  unmatched (retried after 30 days, or now with `--retry-unmatched`). Three
  runs: 784 + 132 + 159 requests. 37 spec pages with no specs on them were
  refetched after the fix that stops storing such a page as matched.
  Spot check, 20 random matches: 19 / 20 URL slugs name the same phone; 20 / 20 network-consistent.

## Setup outside the repo

| What | Where | State |
|---|---|---|
| Database | Neon project `mobileprices`, AWS us-east-2 (Ohio) | Migrations `0000`–`0003` applied |
| Repo | [ShehanEk/mobile-prices-lk](https://github.com/ShehanEk/mobile-prices-lk), public | PRs #1–#7 merged; `main` has phases 1–3 |
| Domain | `mobileprices.lk` | Not registered yet |
| Nightly cache clearing | GitHub Actions variable `SITE_URL`, secret `REVALIDATE_SECRET`; Vercel `REVALIDATE_SECRET` (Production), same value | Step added to `normalize.yml` 2026-10-29; settings not yet confirmed. A missing setting shows as a warning on the run |

## Open items

- **Stale listings after a warranty class change.** Fixed 2026-10-24: normalize now lets the latest-scraped class win per product and deletes the old-class listing and its history on the days written, and the 34 stale rows (plus 8 more from the Genext rule) are gone.
- **`--redo` reads only the newest 20,000 rows.** Normalize logs a warning when
  it hits the limit; rows beyond it are not re-matched and keep their old
  class. Raise `--limit` or run in slices once `raw_listings` outgrows it.
- **Dual-network list (`src/normalize/phone.ts`)** needs a check every few
  months: a model newly sold as both 4G and 5G merges until listed.
- **A spec page with no specs, an empty list page 1, or a redirect stops
  every nightly specs run** (exit 1) until someone looks. Symptom:
  `stopped: HTTP 200 but no specs on a spec page` (or `no phones on a list
  page`, or `HTTP 301 (a redirect, which is never followed)`) in
  `logs/nightly-<date>.log`. The log never names the page: the last
  `matched:` line shows how far the run got, so the model after it is the one
  to look at on GSMArena. Fix: run `npm run specs -- --probe`. A brand line
  saying `id DIFFERS` or `BLOCKED` means that brand's list id moved: correct it
  in `MAKERS` (`src/specs/gsmarena.ts`). If the probe passes, check whether
  GSMArena's layout changed (`src/specs/gsmarena.ts`); a redirect that comes
  back on the next night means GSMArena moved a page we fetch. If the probe
  fails, GSMArena is blocking this machine: wait a day.
- **12 matched models** have a GSMArena page name that differs from our model
  name (8 of them Xiaomi). Shehan to eyeball them.
- **Share-image fonts on the first Vercel deploy.** `src/lib/og.tsx` reads
  `assets/fonts` via `process.cwd()`; check a share image renders with the
  fonts once deployed.
- **Brand colours.** The canvas gave tints for eight brands; the other eight
  reuse them in order (`src/lib/site.ts`). Pick distinct ones on the canvas if
  wanted.

- **Reset the Neon password.** The connection string was shared in a chat
  on 2026-10-24. Reset `neondb_owner`'s password in Neon and update
  `.env.local` (and the GitHub secret once it exists).
- **Four shops block GitHub's runners** (lifemobile, celltronics,
  geniusmobile, doctormobile: 403 on 2026-10-24). Only banana.lk and
  idealz.lk run nightly on GitHub (00:45 and 01:00 Sri Lanka time). The other
  four run from Shehan's PC (above); if the PC is off, they go stale.
- **Migrations need `pg`.** drizzle-kit falls back to
  `@neondatabase/serverless`, which needs WebSockets that Node 20 lacks, and
  then exits without applying anything. `pg` is a dev dependency for that
  reason.

## Known limits

- **Two normalize runs on the same Sri Lanka day:** the later run's row is
  stored for the day, not the in-stock/cheapest pick across both runs.

# Status

What is live and how it is set up. Update this when something ships or a
setting moves. Why each choice was made is in [decisions](decisions.md).

Last updated 24 October 2026.

## Live

- **Scraper:** six shops into `raw_listings`, nightly.
  - banana.lk and idealz.lk on GitHub Actions (00:45 and 01:00 Sri Lanka time).
  - lifemobile, celltronics, geniusmobile and doctormobile from Shehan's PC:
    Windows scheduled task "MobilePrices nightly scrape" runs
    `scripts/nightly-home.cmd` at 01:30, wakes the PC from sleep, and catches
    up after a missed night. Logs in `logs/nightly-<date>.log`.
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
    the 01:30 home-PC scrape. Without the `ANTHROPIC_API_KEY` secret it still
    runs; unclear warranty text shows as not stated.
- **First normalize run (2026-10-24):** `--redo --max-model-calls 60` over the
  6,900 stored rows (one scrape day, Sri Lanka date).

  | | Result |
  |---|---|
  | Rows resolved by rule / by model / unmatched | 5,496 / 0 / 0 |
  | Dropped | brand 704, no storage 376, no RAM 316, not a phone 8 |
  | Priced under LKR 1,000 (dropped after matching) | 232 |
  | Phones | 1,324 |
  | Listings by warranty | company 943, shop 747, apple 186, not stated 292 (2,168) |
  | Price history | 2,168 rows, all dated 2026-10-24 |
  | Warranty set by the model | 42 rows (16 distinct texts) |
  | Model calls | 16 of 60, 11,753 input / 1,131 output tokens, about $0.002 |
  | Spot check, 30 random phones at 2+ shops | 30 / 30 correct |

  The 2,168 includes 34 stale "not stated" listings (and 34 history rows)
  left when the model moved their warranty class to company (Gnext text).
  Without them: 2,134 listings, 258 not stated. See open items.
- **Not built yet:** the site.

## Setup outside the repo

| What | Where | State |
|---|---|---|
| Database | Neon project `mobileprices`, AWS us-east-2 (Ohio) | Migration `0000` applied: `raw_listings`, `pipeline_runs`, lease indexes |
| Repo | [ShehanEk/mobile-prices-lk](https://github.com/ShehanEk/mobile-prices-lk), public | `main` = planning docs; phase 1 in PR #1 |
| Domain | `mobileprices.lk` | Not registered yet |

## Open items

- **`ANTHROPIC_API_KEY` GitHub Actions secret.** Add it so the nightly job can
  ask the model (until then unclear text shows as not stated).
- **Stale listings after a warranty class change.** Fixed 2026-10-24: normalize now replaces the old-class listing and same-day history row, and the 34 stale rows (plus 8 more from the Genext rule) are gone.
- **Dual-network list (`src/normalize/phone.ts`)** needs a check every few
  months: a model newly sold as both 4G and 5G merges until listed.
- **Query-side staleness.** A listing whose shop stops listing a phone keeps
  its last price; the site must hide or caption listings older than ~3 days
  (home-PC shops go stale when the PC is off).

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

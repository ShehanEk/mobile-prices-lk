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

- **Not built yet:** matching to phones, warranty classification, the site.

## Setup outside the repo

| What | Where | State |
|---|---|---|
| Database | Neon project `mobileprices`, AWS us-east-2 (Ohio) | Migration `0000` applied: `raw_listings`, `pipeline_runs`, lease indexes |
| Repo | [ShehanEk/mobile-prices-lk](https://github.com/ShehanEk/mobile-prices-lk), public | `main` = planning docs; phase 1 in PR #1 |
| Domain | `mobileprices.lk` | Not registered yet |

## Open items

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

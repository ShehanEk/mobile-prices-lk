# Decisions

Short dated entries for what is locked. Open items live in
[open questions](open-questions.md). PCPrice.lk's own log is
[here](https://github.com/ShehanEk/sl-pc-part-picker/blob/master/docs/decisions.md);
its lessons apply unless an entry below says otherwise.

## 2026-10-23 — A sister site to PCPrice.lk, for phones

A separate site and repo that answers "which Sri Lankan shop sells this phone
cheapest". Planning first; no app code until the open questions are answered.

## 2026-10-23 — Scraping conduct carried over from PCPrice.lk

robots.txt is respected even where it costs coverage. A shop that blocks
automated access (Cloudflare challenge, bot verification, 429 to the first
request) is left out unless it allows our crawler or sends a feed.

## 2026-10-23 — Scope: new smartphones, 16 major brands

Smartphones only, new only, from the brands in
[requirements](requirements.md#scope). Used, pre-owned, refurbished,
open-box, tablets, wearables and feature phones are out at launch. Tablets
are the first add-on.

## 2026-10-23 — Warranty is an offer attribute, not part of identity

One page per phone. Each price carries a warranty badge (`company`, `shop`,
`apple`, `unstated`) and the list pages filter on it. Phone pages show two
headline prices: cheapest with company warranty, and cheapest overall.
Listings are keyed `(phone_id, shop, warranty)`.

## 2026-10-23 — Copy PCPrice.lk, then delete; no shared package

This repo starts as a copy of PCPrice.lk's files with fresh history, cut down
to what phones need ([architecture](architecture.md#codebase-copy-pcpricelk-then-delete)).
Fixes to the copied `http.ts` or `woocommerce.ts` are ported by hand and noted
in both decision logs.

## 2026-10-23 — Six WooCommerce shops at launch

lifemobile.lk, celltronics.lk, geniusmobile.lk, banana.lk, idealz.lk and
doctormobile.lk, all through the WooCommerce Store API. Big chains (Singer,
Abans, Softlogic, Fono) and xmobile, phonecity, wasi come after launch.

## 2026-10-23 — The site is MobilePrices.lk

Domain `mobileprices.lk`, Standard package at the LK Domain Registry
(LKR 8,000/year), nameservers on Vercel. Chosen over `phoneprices.lk`, which
sits one letter from `phoneprice.lk`, a dormant competing site.
`phoneprice.lk` and `mobileprice.lk` were already registered.

## 2026-10-23 — New Vercel project and new Neon project

Both on free plans, separate from PCPrice.lk's, so the brands share no
credentials or limits. Cost: the domain only.

## 2026-10-23 — 4G and 5G merge unless a model is sold both ways

`phone_id` ignores 4G/5G, except for models on a short curated list in the
repo that ship in both (for example Galaxy A18 4G and 5G).

## 2026-10-23 — Prices with no stated warranty are shown, badged

Badge "Warranty not stated". They count toward "cheapest overall", never
toward "cheapest with company warranty".

## 2026-10-23 — Brands appear as text, never logos

Brand names are coloured text tiles in the site's own font. No brand logos:
they are trademarks, Apple's guidelines forbid its logo without written
permission, and a mix of logos and text would look uneven.

## 2026-10-23 — Design: soft PCPrice.lk colours, type-led, no imagery

Approved on the [design canvas](https://claude.ai/artifact/5c2UPCMy6WQSiMyJBveBwv)
(home, brand list, phone page, phone page at 390px).

- **Colours:** PCPrice.lk's soft palette: ink `#1A1F2B`, blue accent
  `#3467D7`, pale panels `#F2F4F9`, and pale tint + darker ink per brand.
  Warranty: company = pale blue, shop = pale amber, not stated = outline.
  Cheapest price = pale green.
- **Type:** Bricolage Grotesque for headings and prices, Geist for text.
- **No phone images or drawings, no brand logos.** Pages are names, prices
  and colour tints only.
- **Phone page:** two headline prices (cheapest overall, cheapest with company
  warranty), then every price with a warranty badge and a "Company warranty
  only" switch.
- **No "Popular" section** until there is real data for it.
- **Subtle motion:** cards lift 2px on hover, buttons brighten, chips and
  table rows tint, "→" links nudge right, first content fades up on load
  (0.5s). All off under `prefers-reduced-motion`.

Rejected along the way: bold saturated colours, Apple and Material palettes,
dark panels, drawn phones.

## 2026-10-24 — Shops that block GitHub run from a home PC

lifemobile, celltronics, geniusmobile and doctormobile answer GitHub's
runners with 403 and a home connection normally. They run nightly from
Shehan's PC through Windows Task Scheduler (`scripts/nightly-home.cmd`), the
same route PCPrice.lk takes with its desktop app, without building an app.
The bot user agent stays honest; nothing is spoofed.

**Cost.** The four shops (~95% of rows) go stale on nights the PC is off. An
always-on device at home is the fix if that happens often.

## 2026-10-24 — The Claude API settles rows the rules can't

Phase 2 matching is rules first. Titles that don't resolve to a phone, and
warranty text that doesn't classify, go to the Claude API, which picks from a
supplied list or declines. Decisions are logged and remembered per text, so
each unclear text costs one call ever. Details in
[architecture](architecture.md#model-fallback-for-unclear-rows-phase-2).

Model: **Claude Haiku 5.5** (`claude-haiku-5-5`, $0.10 / $0.50 per 1M tokens
in / out). Picking from a supplied list doesn't need a bigger model; estimated
~$0.15 for the first run and ~$0.25 a month after. Revisit only if its
declines or wrong picks show up in the logged decisions.

## 2026-10-25 — Apple warranty counts as company warranty

On iPhone pages, "Apple warranty" prices count toward the "With company
warranty" headline. The badge reads "Apple warranty" in the company colour.

## 2026-10-25 — Phone specs come from GSMArena, with permission

GSMArena's terms need written permission for use on another site; it was
given by email on 2026-10-25 (Shehan keeps the email). A nightly job matches
each model by rules, one request every 5 s, and stores camera, display,
network and colours. Pages credit GSMArena with a link. Its licence forbids
feeding its pages to AI, so no GSMArena text goes to Claude.

The open-source [mobile-specs-api](https://github.com/RevengerNick/mobile-specs-api)
is used only as a parser reference (MIT): running it would add a server that
scrapes live on every request.

## 2026-10-25 — No Shops page; price drops wait for data

The "Shops" nav link is dropped; the footer lists the six shops. Price drops
use PCPrice.lk's rule unchanged and appear only once a phone qualifies (about
a week after launch).

## 2026-10-26 — Favicon: "m" monogram

Chosen from three options on the [design canvas](https://claude.ai/artifact/5c2UPCMy6WQSiMyJBveBwv)
(board "Favicon options"): a white Bricolage Grotesque "m" on the ink tile
(`#1A1F2B`, rounded) with a green (`#3DBA6E`) dot, echoing ".lk" in the
wordmark. Rendered to PNG, because a favicon can't load web fonts; served as
`favicon.ico`, the 32 px icon and the 180 px Apple icon.

## 2026-10-26 — Home v2: latest flagships, no warranty explainer

Approved on the [design canvas](https://claude.ai/artifact/5c2UPCMy6WQSiMyJBveBwv)
(board "Home v2"). Order: hero, Shop by brand, **Latest flagships**, Below
their usual price (still hidden until a phone qualifies), footer. The
"three kinds of warranty" block is removed: every price carries its badge.

"Latest flagships" is a hand-kept list of 8 models in `src/lib/site.ts`,
edited when new flagships launch, not a "Popular" ranking: there is still no
data for popularity. Each card shows the model's cheapest current price
across its configurations and how many shops sell it.

## 2026-10-26 — The specs job runs nightly on GitHub

The probe on GitHub's runners printed `probe: ok` (all 17 brand lists, no
bot check), so the nightly specs run moved from the home PC to `specs.yml`
at 22:30 UTC (04:00 Sri Lanka). Specs now update when the PC is off. If
GSMArena starts blocking the runners, the run stops itself; the schedule
then comes out and the specs lines go back into `nightly-home.cmd`.

## 2026-11-01 — No automatic Vercel deployments

`vercel.json` sets `git.deploymentEnabled: false`: pushes and merges no
longer deploy, preview or production. Shehan deploys by hand from the Vercel
dashboard. Prices are unaffected: the site reads the database, so nightly
data still shows after the cache clear below; only code changes wait for a
deploy.

## 2026-11-01 — The site's cache is cleared only when GitHub's normalize finishes

To keep Vercel costs down, pages and cached reads have no timer
(`revalidate = false`; it was 30 minutes, which rebuilt visited pages all day
for prices that change once a night). `normalize.yml` calls
`/api/revalidate` as its last step; nothing else clears the cache, the home
PC's normalize included. The cost: rows the PC scrapes after GitHub's 03:00
normalize show the next night, unless the normalize workflow is run by hand.
No routine deploys, redeploys, cache clears or live-site checks.

## 2026-11-02 — Video reviews on phone pages, from trusted channels

The last section of a phone page shows up to three YouTube reviews per model,
hidden when none match. A nightly job (`reviews.yml`, 02:30 Sri Lanka time,
before normalize clears the cache) reads the uploads of a hand-kept channel list
(`src/reviews/youtube.ts`) through the YouTube Data API's free quota. Search
costs 100 units a call, so it is never used. A title must say "review" and name
exactly one model: wrong is worse than missing.

The page shows a thumbnail and loads `youtube-nocookie.com` only on play, so
reviews don't slow the page; the privacy page says what YouTube sees. Cost: free
quota, no extra Vercel builds.

## 2026-11-02 — Home: price drops before flagships

"Below their usual price" now sits above "Latest flagships", changing the
order set in Home v2. Still hidden until a phone qualifies.

## 2026-11-02 — Phone page: cheapest marked in the table, no headline boxes

Approved on the [design canvas](https://claude.ai/artifact/5c2UPCMy6WQSiMyJBveBwv)
(board "Phone page"). The two boxes from 2026-10-23 ("Cheapest overall", "With
company warranty") are gone. As on PCPrice.lk, the cheapest in-stock row has a
light blue tint and a "Cheapest" pill, which follows the "Company warranty
only" switch; a line under the list says out-of-stock and last-seen prices
never count. Share images, brand cards and search descriptions still use both
prices.

## 2026-11-03 — Shop profiles on the home page

Approved on the [design canvas](https://claude.ai/artifact/5c2UPCMy6WQSiMyJBveBwv)
(boards "Shop profiles"). Ported from PCPrice.lk by hand. A sideways row of shop
cards is the last home section, above the footer, so phones come first. No section
was removed, and the 2026-10-25 "no Shops page" decision stands: no page or nav
link. Each card has the shop's links and branches, three numbers from our own
listings, and up to 5 review notes in `src/lib/shops.ts`, refreshed by hand every 3
months (`docs/shop-reviews.md`). No auto-rotate, no new table, no recurring AI cost.

Numbers count phone configurations, not listings, so a phone sold under two
warranties counts once. Cheapest compares any warranty, as "Cheapest overall" does.
A shop whose listings are all stale shows "–", because a stopped sync says nothing
about the shop.

"Genuine products" from PCPrice.lk is "Genuine phones" here. It also covers official
versus grey imports, and Warranty also covers company versus shop terms.

**Deliberate risk.** Google's terms restrict content derived from its reviews.
Reading them by hand each quarter and publishing only our own short summary, a
count and a link back was chosen knowingly. The Places API was rejected on
PCPrice.lk because it returns about 5 reviews per place.

## 2026-11-03 — Home: no "Cheapest today" board

The hero board is gone. It listed the four phones the most shops stock, so its
title promised something it did not show. The search leads the hero alone.

## 2026-11-09 — A phone bundle is the phone

"Galaxy A10 + Full Glue Tempered Glass + Back Cover – Bundle Pack" and "Black
Shark 2 Gaming Phone with Left Game Controller" count as Galaxy A10 and Black
Shark 2, as "With Buds" already did. Before, each became a phone page of its own.

## 2026-10-25 — GSMArena specs: found through brand lists, run from the home PC

GSMArena's search answers our honest bot user agent with a Cloudflare
Turnstile check; its brand lists and spec pages answer normally (probe from
Shehan's PC, 2026-10-25). We never get past a bot check, so the specs job
finds each model on its brand's list (newest first) instead of searching. A
brand's whole list is read before any model is matched, because "exactly one
entry fits" needs every entry seen; a list that cannot be read in full marks
nothing unmatched. A match is dropped when the spec page's 4G/5G contradicts
the model. Requests are 5 s apart with no retries and no redirects followed;
403, 429, a redirect or a bot check stops the run. The site's "Full specs on
GSMArena →" fallback still links to the search, which people can use.

The job runs nightly from the home PC after normalize (`--max-requests 400`).
If the manual `specs` workflow's probe on GitHub prints `probe: ok`, the
schedule moves to GitHub and leaves the home script. Test pages are
hand-written from the markup's structure; real GSMArena pages are not stored
in the repo or shown to AI.

## 2026-10-23 — Process carried over from PCPrice.lk

UI is designed on a Claude Design canvas and approved before coding.
Decisions go here as dated entries. No AI attribution in commits. No secrets
in the repo.

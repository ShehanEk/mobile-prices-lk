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

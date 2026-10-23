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

## 2026-10-23 — Process carried over from PCPrice.lk

UI is designed on a Claude Design canvas and approved before coding.
Decisions go here as dated entries. No AI attribution in commits. No secrets
in the repo.

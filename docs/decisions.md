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

## 2026-10-23 — Process carried over from PCPrice.lk

UI is designed on a Claude Design canvas and approved before coding.
Decisions go here as dated entries. No AI attribution in commits. No secrets
in the repo.

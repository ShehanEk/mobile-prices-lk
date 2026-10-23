# Retailers

Checked 23 October 2026 from a residential connection, with PCPrice.lk's bot
user agent. **Not yet checked from GitHub's runners** (phase 1 task).

## Launch shops

All six are WordPress + WooCommerce, the Store API
(`/wp-json/wc/store/v1/products`) answers, and robots.txt allows it.

| Shop | Phone category (term id) | robots.txt | Notes |
|---|---|---|---|
| lifemobile.lk | Mobile Phones (252), 1,662 | Allows all; Cloudflare content signal `search=yes, ai-train=no` | Prices with decimals (69714.29): check what the shown price is before launch |
| celltronics.lk | Mobile Phones (62), 449; also "Company Mobile Phones" (5384) | Allows all | `Warranty` is a variation, priced per option |
| geniusmobile.lk | Smartphones (70), 357 | Allows all | Simple products, one per storage; warranty and "TRCSL Approved" in short description |
| banana.lk | Mobile Phones (225), 123 | Allows all but add-to-cart | No warranty field |
| idealz.lk | Smartphones (47), 27 | Allows all | Variable iPhones show price 0 on the product; per-variation prices needed |
| doctormobile.lk | Mobile Phones (4103), 19 | Allows all | `Capacity` attribute "8GB / 256GB"; pre-owned sub-category 7188 must be skipped |

## Later (phase 2)

| Shop | Why later |
|---|---|
| xmobile.lk | WooCommerce, but robots.txt disallows `/wp-json/`: needs an HTML scraper |
| phonecity.lk | WooCommerce, `Crawl-delay: 10` |
| wasi.lk | WooCommerce, general electronics, `Crawl-delay: 30` |
| singersl.com, buyabans.com, mysoftlogic.lk, fono.lk | Big chains, mostly company warranty; custom platforms, one HTML scraper each |

## Left out

| Shop | Reason |
|---|---|
| presentsolution.lk | "Bot Verification" page (403) on every request |
| buyphonez.lk | Cloudflare "Attention Required" block |
| simplytek.lk | Answers 429 `local_rate_limited` to the first request |
| daraz.lk | Marketplace of third-party sellers; robots.txt disallows `/catalog/` |
| ikman.lk | Classifieds, mostly used phones |
| phoneprice.lk | A competing price site, not a shop (origin down, 522) |

# Requirements — MobilePrices.lk (draft)

A sister site to [PCPrice.lk](https://pcprice.lk) for one question: **which Sri
Lankan shop sells this phone cheapest, and with what warranty?**

Everything not listed here works as PCPrice.lk does. Its docs are the
reference: [architecture](https://github.com/ShehanEk/sl-pc-part-picker/blob/master/docs/architecture.md),
[decisions](https://github.com/ShehanEk/sl-pc-part-picker/blob/master/docs/decisions.md),
[pipeline](https://github.com/ShehanEk/sl-pc-part-picker/blob/master/docs/pipeline.md).

Status: draft, 23 October 2026. Anything not yet in [decisions](decisions.md) waits on
[open questions](open-questions.md).

## Scope

- **Smartphones, new only.** No tablets, watches, earbuds or feature phones at
  launch. Tablets are the first add-on: same matching, same shops.
- **Used, pre-owned, refurbished and open-box are dropped**, as on PCPrice.lk.
  doctormobile.lk keeps a "Premium Pre-Owned Phones" shelf beside new ones.
- **Major brands only**, title must start with one: Apple, Samsung, Xiaomi
  (Redmi, POCO), Honor, Huawei, OPPO, vivo, realme, OnePlus, Google, Motorola,
  Nothing (CMF), Tecno, Infinix, ZTE (nubia), Nokia/HMD.

## What a visitor gets

1. **Phone page:** every shop's price for that exact phone (model + storage +
   RAM), with a **warranty badge** on each price.
2. **Two headline prices:** cheapest with **company warranty**, and cheapest
   overall. Shop-warranty ("6 months hardware, 1 year software") prices are
   much lower; showing only one number would hide why.
3. **Brand list pages** with filters: brand, storage, RAM, price, warranty
   type, in stock, shop.
4. **Deals, search, price history chart, share images, GA4, `/privacy`** —
   unchanged from PCPrice.lk.

Not built: a builder, compatibility checks, spec catalogs, user accounts,
reviews.

## Shops at launch

Six phone specialists, all WooCommerce with the public Store API open to our
crawler on 23 October 2026. Details in [retailers.md](retailers.md).

| Shop | Phones listed | Warranty given as |
|---|---|---|
| lifemobile.lk | 1,662 | `Warranty` attribute |
| celltronics.lk | 449 | `Warranty` attribute (sometimes a choice, priced per option) |
| geniusmobile.lk | 357 | Text in the short description |
| banana.lk | 123 | Not stated |
| idealz.lk | 27 | Not stated |
| doctormobile.lk | 19 | `Warranty` attribute |

## Non-functional

- Same conduct as PCPrice.lk: robots.txt respected, 1.5s per host, no
  getting past bot challenges, honest bot user agent.
- Same cost target: free tiers plus the domain (see
  [architecture](architecture.md#hosting-and-cost)).
- Phone pages readable at 375px with the cheapest price on the first screen.

'use client'

import { useState } from 'react'

import type { Warranty } from '@/db/schema'
import { WARRANTY_BADGE, dayLabel, isCompany, rupees, type Offer } from '@/lib/prices'

/**
 * Every price for one phone, each with its warranty badge, and the "Company
 * warranty only" switch. Offers arrive in `sortOffers` order, so the first
 * current in-stock one shown is the cheapest: its row is tinted and carries the
 * "Cheapest" pill, as on PCPrice.lk's table.
 *
 * The full list is in the server HTML; the switch only hides rows.
 */

const BADGE: Record<Warranty, string> = {
  company: 'bg-company text-company-ink',
  // "Apple warranty" in the company colour (decisions, 2026-10-25).
  apple: 'bg-company text-company-ink',
  shop: 'bg-shop text-shop-ink',
  unstated: 'edge-strong text-ink-3',
}

const live = (o: Offer) => o.inStock && !o.stale
const stockText = (o: Offer) => (o.stale ? `Last seen ${dayLabel(o.seenAt)}` : o.inStock ? 'In stock' : 'Out of stock')
const key = (o: Offer) => `${o.shop}|${o.warranty}`

function Badge({ warranty, small = false }: { warranty: Warranty; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full font-bold ${
        small ? 'h-6 px-[9px] text-[12px]' : 'h-[26px] px-2.5 text-[13px]'
      } ${BADGE[warranty]}`}
    >
      {WARRANTY_BADGE[warranty]}
    </span>
  )
}

function Price({ offer }: { offer: Offer }) {
  return (
    <span className={`flex-none whitespace-nowrap text-[17px] ${live(offer) ? 'font-bold' : 'font-semibold text-ink-3'}`}>
      {rupees(offer.priceLkr)}
    </span>
  )
}

function ShopName({ shop, best }: { shop: string; best: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {shop}
      {best && (
        <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-full bg-accent px-[9px] text-[12px] font-semibold text-on-accent">
          Cheapest
        </span>
      )}
    </span>
  )
}

export function OfferList({ offers }: { offers: Offer[] }) {
  const [companyOnly, setCompanyOnly] = useState(false)
  const shown = companyOnly ? offers.filter((o) => isCompany(o.warranty)) : offers
  const best = shown.find(live) ?? null

  return (
    <section aria-labelledby="every-price" className="mt-5 flex flex-col gap-3 sm:mt-10 sm:gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <h2 id="every-price" className="m-0 font-display text-[24px] font-bold tracking-[-0.03em] sm:text-[30px]">
          Every price <span className="text-ink-3">{shown.length}</span>
        </h2>
        <button
          type="button"
          aria-pressed={companyOnly}
          onClick={() => setCompanyOnly((on) => !on)}
          className="btn glass inline-flex h-11 cursor-pointer items-center gap-2 rounded-full pl-1.5 pr-3.5 text-[13px] font-semibold text-ink sm:h-12 sm:gap-3 sm:pl-2 sm:pr-[18px] sm:text-[15px]"
        >
          <span
            aria-hidden
            className={`relative h-6 w-9 rounded-full transition-colors motion-reduce:transition-none sm:h-7 sm:w-11 ${
              companyOnly ? 'bg-accent' : 'bg-line-strong'
            }`}
          >
            <span
              className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/20%)] transition-[left] motion-reduce:transition-none sm:h-[22px] sm:w-[22px] ${
                companyOnly ? 'left-[15px] sm:left-[19px]' : 'left-[3px]'
              }`}
            />
          </span>
          <span className="sm:hidden">Company only</span>
          <span className="hidden sm:inline">Company warranty only</span>
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="m-0 rounded-[28px] bg-panel px-5 py-4 text-[15px] text-ink-2">
          No shop lists this phone with company warranty right now.
        </p>
      ) : (
        <>
          <div className="edge-card hidden overflow-x-auto rounded-[28px] bg-card md:block">
            <table className="w-full min-w-[720px] border-collapse text-[15px]">
              <thead>
                <tr className="text-left text-[13px] uppercase tracking-[0.06em] text-ink-3">
                  <th scope="col" className="px-6 py-4 font-semibold">Shop</th>
                  <th scope="col" className="px-3 py-4 font-semibold">Warranty</th>
                  <th scope="col" className="px-3 py-4 font-semibold">Stock</th>
                  <th scope="col" className="px-3 py-4 text-right font-semibold">Price</th>
                  <th scope="col" className="px-6 py-4">
                    <span className="sr-only">Link</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => (
                  <tr key={key(o)} className={`row border-t border-line ${o === best ? 'bg-cheapest' : ''}`}>
                    <td className="px-6 py-[18px] font-semibold">
                      <ShopName shop={o.shop} best={o === best} />
                    </td>
                    <td className="px-3 py-[18px]">
                      <span className="flex flex-col items-start gap-1">
                        <Badge warranty={o.warranty} />
                        <span className="text-[13px] text-ink-3">{o.warrantyText ?? 'No warranty on the listing'}</span>
                      </span>
                    </td>
                    <td className="px-3 py-[18px]">
                      <span className={live(o) ? 'font-semibold text-best-ink' : 'text-ink-3'}>{stockText(o)}</span>
                    </td>
                    <td className="px-3 py-[18px] text-right">
                      <Price offer={o} />
                    </td>
                    <td className="px-6 py-[18px] text-right">
                      <a href={o.url} target="_blank" rel="noopener nofollow" className="btn inline-flex h-9 items-center whitespace-nowrap rounded-full bg-cheapest px-3.5 font-semibold text-accent">
                        Visit shop →<span className="sr-only"> (opens {o.shop} in a new tab)</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
            {shown.map((o) => (
              <li key={key(o)}>
                <a
                  href={o.url}
                  target="_blank"
                  rel="noopener nofollow"
                  className={`lift flex items-center gap-3 rounded-3xl p-4 ${o === best ? 'bg-cheapest shadow-[inset_0_0_0_1.5px_var(--color-accent)]' : 'edge-card bg-card'}`}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="text-[16px] font-semibold">
                      <ShopName shop={o.shop} best={o === best} />
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge warranty={o.warranty} small />
                      <span className={`text-[13px] ${live(o) ? 'font-semibold text-best-ink' : 'text-ink-3'}`}>{stockText(o)}</span>
                    </span>
                  </span>
                  <Price offer={o} />
                  <span className="sr-only"> (opens {o.shop} in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>

          {shown.some((o) => !live(o)) && (
            <p className="m-0 text-[13px] text-ink-3">
              An out-of-stock or last-seen price is shown for reference and never counts as the cheapest.
            </p>
          )}
        </>
      )}
    </section>
  )
}

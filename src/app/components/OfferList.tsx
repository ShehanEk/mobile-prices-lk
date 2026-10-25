'use client'

import { useState } from 'react'

import type { Warranty } from '@/db/schema'
import { WARRANTY_BADGE, dayLabel, isCompany, rupees, type Offer } from '@/lib/prices'

/**
 * Every price for one phone, each with its warranty badge, and the "Company
 * warranty only" switch. Offers arrive in `sortOffers` order, so the first
 * current in-stock one shown is the cheapest and gets the green pill.
 *
 * The full list is in the server HTML; the switch only hides rows.
 */

const BADGE: Record<Warranty, string> = {
  company: 'bg-company text-company-ink',
  // "Apple warranty" in the company colour (decisions, 2026-10-25).
  apple: 'bg-company text-company-ink',
  shop: 'bg-shop text-shop-ink',
  unstated: 'edge-strong bg-white text-ink-3',
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

function Price({ offer, best }: { offer: Offer; best: boolean }) {
  const style = best
    ? 'inline-block rounded-xl bg-best px-3 py-1.5 font-extrabold text-best-ink'
    : live(offer)
      ? 'font-bold'
      : 'font-semibold text-ink-3'
  return <span className={`flex-none whitespace-nowrap text-[17px] ${style}`}>{rupees(offer.priceLkr)}</span>
}

export function OfferList({ offers }: { offers: Offer[] }) {
  const [companyOnly, setCompanyOnly] = useState(false)
  const shown = companyOnly ? offers.filter((o) => isCompany(o.warranty)) : offers
  const best = shown.find(live) ?? null

  return (
    <section aria-labelledby="every-price" className="mt-5 flex flex-col gap-3 sm:mt-16 sm:gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <h2 id="every-price" className="m-0 font-display text-[24px] font-bold tracking-[-0.03em] sm:text-[30px]">
          Every price <span className="text-ink-3">{shown.length}</span>
        </h2>
        <button
          type="button"
          aria-pressed={companyOnly}
          onClick={() => setCompanyOnly((on) => !on)}
          className="btn inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-panel pl-1.5 pr-3 text-[13px] font-semibold text-ink sm:gap-3 sm:pl-2 sm:pr-4 sm:text-[15px]"
        >
          <span
            aria-hidden
            className={`relative h-6 w-9 rounded-full transition-colors motion-reduce:transition-none sm:h-7 sm:w-11 ${
              companyOnly ? 'bg-accent' : 'bg-line-strong'
            }`}
          >
            <span
              className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-[left] motion-reduce:transition-none sm:h-[22px] sm:w-[22px] ${
                companyOnly ? 'left-[15px] sm:left-[19px]' : 'left-[3px]'
              }`}
            />
          </span>
          <span className="sm:hidden">Company only</span>
          <span className="hidden sm:inline">Company warranty only</span>
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="m-0 rounded-3xl bg-panel px-5 py-4 text-[15px] text-ink-2">
          No shop lists this phone with company warranty right now.
        </p>
      ) : (
        <>
          <div className="edge hidden overflow-x-auto rounded-3xl md:block">
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
                  <tr key={key(o)} className="row border-t border-line">
                    <td className="px-6 py-[18px] font-semibold">{o.shop}</td>
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
                      <Price offer={o} best={o === best} />
                    </td>
                    <td className="px-6 py-[18px] text-right">
                      <a href={o.url} target="_blank" rel="noopener nofollow" className="go whitespace-nowrap font-semibold text-accent">
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
                <a href={o.url} target="_blank" rel="noopener nofollow" className="lift edge flex items-center gap-3 rounded-[20px] p-4">
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="text-[16px] font-semibold">{o.shop}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge warranty={o.warranty} small />
                      <span className={`text-[13px] ${live(o) ? 'font-semibold text-best-ink' : 'text-ink-3'}`}>{stockText(o)}</span>
                    </span>
                  </span>
                  <Price offer={o} best={o === best} />
                  <span className="sr-only"> (opens {o.shop} in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

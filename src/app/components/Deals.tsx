'use client'

import Link from 'next/link'
import { useState } from 'react'

import type { DealItem } from '@/lib/deals'
import { rupees } from '@/lib/prices'

function Saving({ deal }: { deal: DealItem }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-best px-2.5 py-1 text-[13px] font-semibold text-best-ink">
      −{deal.percent}% · {rupees(deal.savingLkr)} less
    </span>
  )
}

/** `inks` maps a brand name to its ink colour, from `brandStyle` on the server. */
export function DealsList({ deals, inks }: { deals: DealItem[]; inks: Record<string, string> }) {
  const [brand, setBrand] = useState<string | null>(null)
  const counts = new Map<string, number>()
  for (const d of deals) counts.set(d.brand, (counts.get(d.brand) ?? 0) + 1)
  const shown = brand ? deals.filter((d) => d.brand === brand) : deals

  const chip = (on: boolean) =>
    `inline-flex h-10 cursor-pointer items-center rounded-full px-4 text-[14px] font-semibold ${on ? 'bg-ink text-white' : 'chip edge-strong'}`

  return (
    <div className="flex flex-col gap-5">
      {counts.size > 1 && (
        <div role="group" aria-label="Filter price drops by brand" className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={brand === null} onClick={() => setBrand(null)} className={chip(brand === null)}>
            All {deals.length}
          </button>
          {[...counts].map(([b, n]) => (
            <button key={b} type="button" aria-pressed={brand === b} onClick={() => setBrand(b)} className={chip(brand === b)}>
              {b} {n}
            </button>
          ))}
        </div>
      )}

      <section aria-labelledby="drops-count" className="edge overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between gap-2.5 border-b border-line px-5 py-3.5">
          <h2 id="drops-count" aria-live="polite" className="m-0 text-[15px] font-semibold">
            {shown.length} {shown.length === 1 ? 'price drop' : 'price drops'} today
          </h2>
          <span className="text-[13px] text-ink-3">Biggest saving first</span>
        </div>
        <ul className="m-0 list-none p-0">
          {shown.map((d) => (
            <li key={d.phoneId} className="border-b border-line last:border-b-0">
              <Link href={`/${d.brandSlug}/${d.phoneId}`} className="row flex flex-wrap items-center gap-x-[18px] gap-y-2 px-5 py-4">
                <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
                  <span className="text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: inks[d.brand] }}>
                    {d.brand}
                  </span>
                  <span className="text-[16px] font-semibold">
                    {d.model} <span className="font-normal text-ink-3">{d.config}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Saving deal={d} />
                    {d.lowest && (
                      <span className="rounded-full bg-company px-2.5 py-1 text-[12px] font-semibold text-company-ink">Lowest in 30 days</span>
                    )}
                  </span>
                </span>
                <span className="flex flex-col gap-0.5 sm:ml-auto sm:items-end sm:text-right">
                  <span className="whitespace-nowrap font-display text-[22px] font-extrabold tracking-[-0.03em]">{rupees(d.priceLkr)}</span>
                  <span className="text-[13px] text-ink-2">
                    at {d.shop} · usually <span className="line-through">{rupees(d.usualLkr)}</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="m-0 bg-panel px-5 py-3.5 text-[13px] text-ink-3">
          “Usually” is the median of the lowest in-stock price on each of the last 30 days we checked. Prices change
          between our checks; confirm with the shop before you buy.
        </p>
      </section>
    </div>
  )
}

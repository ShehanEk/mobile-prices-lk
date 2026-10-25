'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import type { Warranty } from '@/db/schema'
import { configLabel, dayLabel, isCompany, rupees, sizeLabel } from '@/lib/prices'

/**
 * The filterable list on a brand page, adapted from PCPrice's CategoryList.
 *
 * Filtering runs in the browser so the page stays prerendered: the first HTML
 * holds every phone, out of stock included. A brand page is the crawl path to
 * its phone pages, so a filter that dropped rows on the server would orphan
 * them.
 *
 * Unticking a warranty class or a shop re-prices every card from the offers
 * still allowed: the question here is "where is it cheapest, on my terms".
 */

export type BrandRow = {
  phoneId: string
  href: string
  model: string
  ramGb: number | null
  storageGb: number
  esimOnly: boolean
  offers: {
    shop: string
    warranty: Warranty
    priceLkr: number
    /** In stock and seen recently. */
    buyable: boolean
    /** Not seen for over a week: shown as last seen, never as a current price. */
    stale: boolean
    seenAt: string
  }[]
}

type WarrantyFilter = 'company' | 'shop' | 'unstated'
type Sort = 'low' | 'high' | 'shops'

const WARRANTY_FILTERS: { key: WarrantyFilter; label: string; dot: string }[] = [
  { key: 'company', label: 'Company', dot: 'bg-accent' },
  { key: 'shop', label: 'Shop', dot: 'bg-shop-dot' },
  { key: 'unstated', label: 'Not stated', dot: 'shadow-[inset_0_0_0_2px_#69707F]' },
]

/** Apple's own warranty files under Company (decisions, 2026-10-25). */
const filterOf = (w: Warranty): WarrantyFilter => (w === 'company' || w === 'apple' ? 'company' : w)

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

const legend = 'mb-3 p-0 text-[13px] font-bold uppercase tracking-[0.06em] text-ink-3'
const checkRow = 'flex min-h-10 cursor-pointer items-center gap-2.5 text-[15px]'
const checkbox = 'h-[18px] w-[18px] accent-ink'

function Chip({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return (
    <label
      className={`inline-flex h-10 cursor-pointer items-center rounded-full px-3.5 text-[14px] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
        on ? 'bg-ink text-white' : 'chip edge-strong'
      }`}
    >
      <input type="checkbox" checked={on} onChange={onChange} className="sr-only" />
      {label}
    </label>
  )
}

/** What a card says about its price: current and in stock, current but out of stock, or only old listings. */
type Standing = { kind: 'stock' } | { kind: 'out' } | { kind: 'seen'; on: string }

export function BrandList({ rows, shops }: { rows: BrandRow[]; shops: string[] }) {
  const [warranties, setWarranties] = useState<Set<WarrantyFilter>>(new Set(['company', 'shop', 'unstated']))
  const [storage, setStorage] = useState<Set<number>>(new Set())
  const [ram, setRam] = useState<Set<number>>(new Set())
  const [shopsOn, setShopsOn] = useState<Set<string>>(new Set(shops))
  const [inStockOnly, setInStockOnly] = useState(false)
  const [sort, setSort] = useState<Sort>('low')
  const [open, setOpen] = useState(false)

  const storages = useMemo(() => [...new Set(rows.map((r) => r.storageGb))].sort((a, b) => a - b), [rows])
  const rams = useMemo(
    () => [...new Set(rows.flatMap((r) => (r.ramGb === null ? [] : [r.ramGb])))].sort((a, b) => a - b),
    [rows],
  )

  const shown = useMemo(() => {
    const priced = rows.flatMap((row) => {
      if (storage.size && !storage.has(row.storageGb)) return []
      if (ram.size && (row.ramGb === null || !ram.has(row.ramGb))) return []
      const offers = row.offers.filter((o) => shopsOn.has(o.shop) && warranties.has(filterOf(o.warranty)))
      if (offers.length === 0) return []
      const current = offers.filter((o) => !o.stale)
      const buyable = current.filter((o) => o.buyable)
      if (inStockOnly && buyable.length === 0) return []

      const lowest = (list: typeof offers) => Math.min(...list.map((o) => o.priceLkr))
      const company = buyable.filter((o) => isCompany(o.warranty))
      const newest = offers.reduce((a, b) => (a.seenAt >= b.seenAt ? a : b)).seenAt
      const standing: Standing = buyable.length
        ? { kind: 'stock' }
        : current.length
          ? { kind: 'out' }
          : { kind: 'seen', on: dayLabel(newest) }
      return [
        {
          row,
          standing,
          price: lowest(buyable.length ? buyable : current.length ? current : offers),
          company: company.length ? lowest(company) : null,
          shops: new Set(offers.map((o) => o.shop)).size,
        },
      ]
    })
    return priced.sort(
      (a, b) =>
        Number(b.standing.kind === 'stock') - Number(a.standing.kind === 'stock') ||
        (sort === 'shops' ? b.shops - a.shops : 0) ||
        (sort === 'high' ? b.price - a.price : a.price - b.price),
    )
  }, [rows, storage, ram, shopsOn, warranties, inStockOnly, sort])

  const summary =
    (storage.size ? ` with ${[...storage].sort((a, b) => a - b).map(sizeLabel).join(' or ')}` : '') +
    (inStockOnly ? ', in stock' : '')

  const reset = () => {
    setWarranties(new Set(['company', 'shop', 'unstated']))
    setStorage(new Set())
    setRam(new Set())
    setShopsOn(new Set(shops))
    setInStockOnly(false)
  }

  return (
    <div className="flex flex-wrap items-start gap-6 lg:gap-10">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="filters"
        onClick={() => setOpen((o) => !o)}
        className="chip edge-strong inline-flex h-11 cursor-pointer items-center rounded-full px-4 text-[15px] font-semibold lg:hidden"
      >
        {open ? 'Hide filters' : 'Filters'}
      </button>

      <aside id="filters" aria-label="Filters" className={`${open ? 'flex' : 'hidden'} min-w-0 flex-[1_1_240px] flex-col gap-7 lg:flex`}>
        <fieldset className="m-0 border-0 p-0">
          <legend className={legend}>Warranty</legend>
          <div className="flex flex-col gap-1">
            {WARRANTY_FILTERS.map((f) => (
              <label key={f.key} className={checkRow}>
                <input
                  type="checkbox"
                  checked={warranties.has(f.key)}
                  onChange={() => setWarranties((s) => toggle(s, f.key))}
                  className={checkbox}
                />
                <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${f.dot}`} />
                {f.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="m-0 border-0 p-0">
          <legend className={legend}>Storage</legend>
          <div className="flex flex-wrap gap-2">
            {storages.map((gb) => (
              <Chip key={gb} on={storage.has(gb)} label={sizeLabel(gb)} onChange={() => setStorage((s) => toggle(s, gb))} />
            ))}
          </div>
        </fieldset>

        {rams.length > 0 && (
          <fieldset className="m-0 border-0 p-0">
            <legend className={legend}>RAM</legend>
            <div className="flex flex-wrap gap-2">
              {rams.map((gb) => (
                <Chip key={gb} on={ram.has(gb)} label={`${gb} GB`} onChange={() => setRam((s) => toggle(s, gb))} />
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="m-0 border-0 p-0">
          <legend className={legend}>Shop</legend>
          <div className="flex flex-col gap-1">
            {shops.map((shop) => (
              <label key={shop} className={`${checkRow} min-h-9`}>
                <input type="checkbox" checked={shopsOn.has(shop)} onChange={() => setShopsOn((s) => toggle(s, shop))} className={checkbox} />
                {shop}
              </label>
            ))}
          </div>
        </fieldset>

        <label className={`${checkRow} font-semibold`}>
          <input type="checkbox" checked={inStockOnly} onChange={() => setInStockOnly((v) => !v)} className={checkbox} />
          In stock only
        </label>
      </aside>

      <section aria-label="Phones" className="rise min-w-0 flex-[999_1_640px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-[15px] text-ink-2" aria-live="polite">
            <strong className="text-ink">
              {shown.length} {shown.length === 1 ? 'phone' : 'phones'}
            </strong>
            {summary}
          </p>
          <label className="flex items-center gap-2 text-[14px] text-ink-3">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-10 rounded-xl border border-line-strong bg-white px-3 text-[14px] text-ink"
            >
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
              <option value="shops">Most shops</option>
            </select>
          </label>
        </div>

        {shown.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-3xl bg-panel px-6 py-5 text-[15px] text-ink-2">
            No phone matches these filters.
            <button type="button" onClick={reset} className="cursor-pointer font-semibold text-accent">
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-4 p-0">
            {shown.map((p) => (
              <li key={p.row.phoneId} className="flex min-w-0 flex-[1_1_260px]">
                <Link href={p.row.href} className="lift edge flex w-full flex-col gap-2.5 rounded-3xl p-[22px]">
                  <span className="text-[17px] font-semibold">{p.row.model}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {configLabel(p.row)
                      .split(' · ')
                      .map((c) => (
                        <span key={c} className="rounded-lg bg-panel px-[9px] py-1 text-[13px] font-semibold">
                          {c}
                        </span>
                      ))}
                  </span>
                  <span className="mt-1 flex items-baseline gap-2">
                    <span className={`font-display text-[24px] font-extrabold tracking-[-0.03em] ${p.standing.kind === 'stock' ? '' : 'text-ink-3'}`}>
                      {rupees(p.price)}
                    </span>
                    <span className="text-[14px] text-ink-3">
                      {p.standing.kind === 'stock'
                        ? `${p.shops} ${p.shops === 1 ? 'shop' : 'shops'}`
                        : p.standing.kind === 'out'
                          ? 'out of stock'
                          : `Last seen ${p.standing.on}`}
                    </span>
                  </span>
                  {p.company !== null && (
                    <span className="flex items-center gap-2 text-[14px] text-accent">
                      <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
                      Company warranty from {rupees(p.company)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

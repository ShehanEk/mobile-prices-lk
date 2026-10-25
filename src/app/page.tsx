import Link from 'next/link'

import { SearchBox } from './components/SearchBox'
import { SiteFooter, SiteHeader } from './components/SiteChrome'
import { toDealItems, type DealItem } from '@/lib/deals'
import { rupees, sizeLabel, type PhoneSummary } from '@/lib/prices'
import { BRAND_SLUGS, TRACKED_SHOPS, brandFromSlug, brandStyle } from '@/lib/site'
import { loadDeals, loadDirectory } from '@/queries/phones'

export const revalidate = 1800

/**
 * "Cheapest today": the four phones the most shops have in stock, one
 * configuration per model, each at its cheapest in-stock price. A stand-in for
 * popularity that the data supports (decisions: no "Popular" section until
 * there is real data for it).
 */
function cheapestToday(phones: PhoneSummary[]): PhoneSummary[] {
  const seen = new Set<string>()
  return phones
    .filter((p) => p.overall?.inStock)
    .sort((a, b) => b.inStockShops - a.inStockShops || a.overall!.priceLkr - b.overall!.priceLkr)
    .filter((p) => {
      const key = `${p.brand}|${p.model}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 4)
}

/** "12/256 GB" on the board; iPhones show storage only. */
const shortConfig = (p: PhoneSummary) => (p.ramGb === null ? sizeLabel(p.storageGb) : `${p.ramGb}/${sizeLabel(p.storageGb)}`)

function DropCard({ deal }: { deal: DealItem }) {
  const { tint, ink } = brandStyle(deal.brand)
  return (
    <Link href={`/${deal.brandSlug}/${deal.phoneId}`} className="lift flex min-w-0 flex-[1_1_250px] flex-col overflow-hidden rounded-3xl bg-white shadow-card">
      <span className="flex h-[104px] items-end justify-between gap-3 p-5" style={{ background: tint, color: ink }}>
        <span className="font-display text-[44px] font-bold leading-[0.9] tracking-[-0.04em]">−{deal.percent}%</span>
        <span className="text-[14px] font-bold">{deal.brand}</span>
      </span>
      <span className="flex flex-col gap-1.5 px-5 pb-5 pt-[18px]">
        <span className="text-[16px] font-semibold">{deal.model}</span>
        <span className="text-[14px] text-ink-3">{deal.config}</span>
        <span className="mt-1.5 flex items-baseline gap-2.5">
          <span className="font-display text-[24px] font-extrabold tracking-[-0.03em]">{rupees(deal.priceLkr)}</span>
          <span className="text-[14px] text-ink-3 line-through">{rupees(deal.usualLkr)}</span>
        </span>
        <span className="text-[14px] text-ink-2">at {deal.shop}</span>
      </span>
    </Link>
  )
}

const WARRANTY_KINDS = [
  { title: 'Company warranty', text: 'From the brand’s official agent in Sri Lanka. Usually the highest price.', className: 'bg-company' },
  { title: 'Shop warranty', text: 'The shop covers it, often 6 months hardware and 1 year software.', className: 'bg-shop' },
  { title: 'Not stated', text: 'The shop doesn’t say. Ask before you pay.', className: 'edge bg-white' },
]

export default async function HomePage() {
  const [directory, deals] = await Promise.all([loadDirectory(), loadDeals()])
  const brands = BRAND_SLUGS.filter((s) => directory[s].length > 0)
  const board = cheapestToday(Object.values(directory).flat())
  const drops = toDealItems(deals).slice(0, 4)

  return (
    <>
      <SiteHeader />

      <section className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-12 px-4 pb-14 pt-10 sm:px-6 sm:pt-[72px]">
        <div className="rise flex min-w-0 flex-[999_1_520px] flex-col gap-7">
          <p className="m-0 inline-flex items-center gap-2 self-start rounded-full bg-panel py-1.5 pl-2 pr-3 text-[13px] font-semibold text-ink-2">
            <span aria-hidden className="h-2 w-2 rounded-full bg-live" />
            {TRACKED_SHOPS.length} shops · prices checked every night
          </p>
          <h1 className="m-0 font-display text-[clamp(40px,5.6vw,72px)] font-bold leading-[0.95] tracking-[-0.045em]">
            Find the cheapest place to buy your <span className="rounded-[0.14em] bg-company px-[0.12em] text-accent">next phone</span>.
          </h1>
          <p className="m-0 max-w-[520px] text-[17px] leading-normal text-ink-2 sm:text-[19px]">
            Every price for the exact phone you want, from Sri Lanka’s phone shops. Company warranty or shop warranty, always labelled.
          </p>
          <SearchBox large />
        </div>

        {board.length > 0 && (
          <div className="rise edge-card flex min-w-0 flex-[1_1_380px] flex-col rounded-3xl bg-white px-5 pb-6 pt-7 [animation-delay:0.12s] sm:px-7">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">Cheapest today</span>
              <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-3">
                <span aria-hidden className="h-2 w-2 rounded-full bg-live" />
                In stock
              </span>
            </div>
            {board.map((p) => (
              <Link key={p.phoneId} href={`/${p.brandSlug}/${p.phoneId}`} className="row -mx-3 flex items-baseline justify-between gap-4 border-t border-line-soft px-3 py-4">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[17px] font-semibold">{p.model}</span>
                  <span className="text-[14px] text-ink-3">
                    {shortConfig(p)} · {p.overall!.shop}
                  </span>
                </span>
                <span className="whitespace-nowrap font-display text-[24px] font-extrabold tracking-[-0.03em] sm:text-[26px]">{rupees(p.overall!.priceLkr)}</span>
              </Link>
            ))}
            {drops.length > 0 && (
              <Link href="/deals" className="mt-2 border-t border-line-soft pt-4 text-[15px] font-semibold text-accent">
                See today’s price drops →
              </Link>
            )}
          </div>
        )}
      </section>

      <section id="brands" className="mx-auto max-w-[1200px] scroll-mt-4 px-4 pb-16 pt-6 sm:px-6">
        <h2 className="m-0 mb-5 font-display text-[32px] font-bold tracking-[-0.03em]">Shop by brand</h2>
        <div className="flex flex-wrap gap-3">
          {brands.map((s) => {
            const name = brandFromSlug(s)!
            const { tint, ink } = brandStyle(name)
            return (
              <Link
                key={s}
                href={`/${s}`}
                className="lift inline-flex h-[60px] items-center rounded-2xl px-[22px] font-display text-[20px] font-bold tracking-[-0.03em]"
                style={{ background: tint, color: ink }}
              >
                {name}
              </Link>
            )
          })}
        </div>
      </section>

      {drops.length > 0 && (
        <section id="drops" className="bg-panel">
          <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="m-0 mb-1.5 font-display text-[32px] font-bold tracking-[-0.03em]">Below their usual price</h2>
                <p className="m-0 text-[16px] text-ink-2">Compared with each phone’s usual price over the last 30 days.</p>
              </div>
              <Link href="/deals" className="go text-[15px] font-semibold text-accent">
                See all price drops →
              </Link>
            </div>
            <div className="flex flex-wrap gap-4">
              {drops.map((d) => (
                <DropCard key={d.phoneId} deal={d} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-[72px]">
        <div className="flex flex-wrap gap-10 rounded-3xl bg-panel p-6 sm:p-12">
          <div className="min-w-0 flex-[1_1_300px]">
            <h2 className="m-0 mb-3 font-display text-[30px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[36px]">
              The same phone can have three kinds of warranty.
            </h2>
            <p className="m-0 text-[16px] leading-[1.55] text-ink-3">
              That is why prices differ so much between shops. Every price here carries a label, so you know what you are paying for.
            </p>
          </div>
          <div className="flex min-w-0 flex-[2_1_520px] flex-wrap gap-3">
            {WARRANTY_KINDS.map((k) => (
              <div key={k.title} className={`flex flex-[1_1_200px] flex-col gap-2 rounded-[20px] p-[22px] ${k.className}`}>
                <span className="text-[17px] font-bold">{k.title}</span>
                <span className="text-[15px] leading-normal">{k.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}

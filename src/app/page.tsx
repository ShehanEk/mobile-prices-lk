import { ViewTransition } from 'react'
import Link from 'next/link'

import { SearchBox } from './components/SearchBox'
import { ShopProfiles } from './components/ShopProfiles'
import { SiteFooter, SiteHeader } from './components/SiteChrome'
import { toDealItems, type DealItem } from '@/lib/deals'
import { flagshipCards, rupees, type FlagshipCard } from '@/lib/prices'
import { shopStats } from '@/lib/shop-stats'
import { BRAND_SLUGS, FLAGSHIPS, TRACKED_SHOPS, brandFromSlug, brandVars } from '@/lib/site'
import { loadDeals, loadDirectory } from '@/queries/phones'

export const revalidate = false

function DropCard({ deal }: { deal: DealItem }) {
  const { tint, ink } = brandVars(deal.brand)
  return (
    <Link href={`/${deal.brandSlug}/${deal.phoneId}`} className="lift edge-card flex min-w-0 flex-[1_1_250px] flex-col rounded-[28px] bg-card p-2">
      <span className="flex h-[104px] items-end justify-between gap-3 rounded-[20px] p-[18px]" style={{ background: tint, color: ink }}>
        <span className="font-display text-[44px] font-bold leading-[0.9] tracking-[-0.045em]">−{deal.percent}%</span>
        <span className="text-[14px] font-semibold">{deal.brand}</span>
      </span>
      <span className="flex flex-col gap-1.5 px-3 pb-3 pt-4">
        <span className="text-[16px] font-semibold">{deal.model}</span>
        <span className="text-[14px] text-ink-3">{deal.config}</span>
        <span className="mt-1.5 flex items-baseline gap-2.5">
          <span className="font-display text-[24px] font-bold tracking-[-0.03em]">{rupees(deal.priceLkr)}</span>
          <span className="text-[14px] text-ink-3 line-through">{rupees(deal.usualLkr)}</span>
        </span>
        <span className="text-[14px] text-ink-2">at {deal.shop}</span>
      </span>
    </Link>
  )
}

function FlagshipTile({ card }: { card: FlagshipCard }) {
  const { tint, ink } = brandVars(card.brand)
  return (
    <Link href={`/${card.brandSlug}/${card.phoneId}`} className="lift edge-card flex min-w-0 flex-col gap-3.5 rounded-[28px] bg-card p-[22px]">
      <span className="inline-flex h-[26px] items-center self-start rounded-full px-2.5 text-[13px] font-semibold" style={{ background: tint, color: ink }}>
        {card.brand}
      </span>
      <span className="flex flex-col gap-1">
        <ViewTransition name={`phone-${card.phoneId}`} share="morph" default="none">
          <span className="font-display text-[22px] font-bold leading-[1.1] tracking-[-0.03em]">{card.model}</span>
        </ViewTransition>
        <span className="text-[14px] text-ink-3">{card.configs}</span>
      </span>
      <span className="mt-auto flex flex-col gap-0.5">
        <span className="text-[13px] text-ink-3">{card.esimOnly ? 'From · eSIM model' : 'From'}</span>
        <span className="whitespace-nowrap font-display text-[28px] font-bold tracking-[-0.035em]">{rupees(card.priceLkr)}</span>
      </span>
      <span className="flex items-center justify-between gap-3 border-t border-line pt-3.5 text-[14px] text-ink-2">
        <span>{card.shopsLabel}</span>
        <span className="inline-flex h-8 items-center rounded-full bg-cheapest px-3.5 font-semibold text-accent">Compare</span>
      </span>
    </Link>
  )
}

export default async function HomePage() {
  const [directory, deals] = await Promise.all([loadDirectory(), loadDeals()])
  const brands = BRAND_SLUGS.filter((s) => directory[s].length > 0)
  const flagships = flagshipCards(Object.values(directory).flat(), FLAGSHIPS)
  const drops = toDealItems(deals).slice(0, 4)
  const stats = shopStats(Object.values(directory).flat(), TRACKED_SHOPS)

  return (
    <>
      <SiteHeader current="home" />

      <section className="mx-auto max-w-[1200px] px-5 pb-12 pt-10 sm:px-6 sm:pb-20 sm:pt-[88px]">
        <div className="rise flex flex-col items-start gap-5 sm:items-center sm:gap-6 sm:text-center">
          <p className="glass m-0 inline-flex h-[34px] items-center gap-2 rounded-full pl-3 pr-3.5 text-[13px] font-semibold text-ink-2">
            <span aria-hidden className="h-2 w-2 rounded-full bg-live" />
            {TRACKED_SHOPS.length} shops · prices checked every night
          </p>
          <h1 className="m-0 max-w-[920px] font-display text-[clamp(42px,6vw,76px)] font-bold leading-[1.02] tracking-[-0.045em]">
            Find the cheapest place to buy your <span className="text-accent">next phone</span>.
          </h1>
          <p className="m-0 max-w-[580px] text-[17px] leading-normal text-ink-2 sm:text-[20px]">
            Every price for the exact phone you want, from Sri Lanka’s phone shops. Company warranty or shop warranty, always labelled.
          </p>
          <div className="flex w-full justify-center sm:mt-3">
            <SearchBox large />
          </div>
        </div>
      </section>

      <section id="brands" className="mx-auto max-w-[1200px] scroll-mt-24 px-5 pb-12 sm:px-6 sm:pb-[72px]">
        <h2 className="m-0 mb-4 font-display text-[26px] font-bold tracking-[-0.03em] sm:mb-5 sm:text-[34px]">Shop by brand</h2>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {brands.map((s) => {
            const name = brandFromSlug(s)!
            const { tint, ink } = brandVars(name)
            return (
              <ViewTransition key={s} name={`brand-${s}`} share="morph" default="none">
              <Link
                href={`/${s}`}
                className="lift inline-flex h-11 items-center rounded-full px-[18px] font-display text-[16px] font-semibold tracking-[-0.02em] shadow-[inset_0_1px_0_var(--glass-hi),inset_0_0_0_1px_var(--color-line)] sm:h-[52px] sm:px-[22px] sm:text-[18px]"
                style={{ background: tint, color: ink }}
              >
                {name}
              </Link>
              </ViewTransition>
            )
          })}
        </div>
      </section>

      {drops.length > 0 && (
        <section id="drops">
          <div className="mx-auto max-w-[1200px] px-5 pb-12 sm:px-6 sm:pb-[72px]">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4 sm:mb-6">
              <div>
                <h2 className="m-0 mb-1.5 font-display text-[26px] font-bold tracking-[-0.03em] sm:text-[34px]">Below their usual price</h2>
                <p className="m-0 text-[15px] text-ink-2 sm:text-[16px]">Compared with each phone’s usual price over the last 30 days.</p>
              </div>
              <Link href="/deals" className="glass inline-flex h-11 items-center rounded-full px-[18px] text-[15px] font-semibold text-accent">
                See all price drops →
              </Link>
            </div>
            <div className="flex flex-wrap gap-3 sm:gap-5">
              {drops.map((d) => (
                <DropCard key={d.phoneId} deal={d} />
              ))}
            </div>
          </div>
        </section>
      )}

      {flagships.length > 0 && (
        <section id="flagships" className="mx-2 rounded-[36px] bg-panel sm:mx-auto sm:max-w-[1232px] sm:rounded-[40px]">
          <div className="mx-auto max-w-[1200px] px-3 pb-4 pt-7 sm:px-12 sm:pb-14 sm:pt-14">
            <div className="mb-5 px-2 sm:mb-6 sm:px-0">
              <h2 className="m-0 mb-1.5 font-display text-[26px] font-bold tracking-[-0.03em] sm:text-[34px]">Latest flagships</h2>
              <p className="m-0 text-[15px] text-ink-2 sm:text-[16px]">The newest top models from Apple, Samsung and Google, at their lowest price today.</p>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3 sm:gap-5">
              {flagships.map((f) => (
                <FlagshipTile key={`${f.brand}|${f.model}`} card={f} />
              ))}
            </div>
          </div>
        </section>
      )}

      <ShopProfiles stats={stats} />

      <SiteFooter />
    </>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ViewTransition } from 'react'

import { OfferList } from '@/app/components/OfferList'
import { PriceChart } from '@/app/components/PriceChart'
import { SiteFooter, SiteHeader } from '@/app/components/SiteChrome'
import { SpecsBlock } from '@/app/components/SpecsBlock'
import { VideoReviews } from '@/app/components/VideoReviews'
import { checkedLabel, configLabel, phoneDescription, priceRange, rupees } from '@/lib/prices'
import { SITE_NAME, canonical, phoneName } from '@/lib/site'
import { findPhone, loadBrand, loadDirectory, loadPhoneHistory, loadReviews, loadSpecs } from '@/queries/phones'

/**
 * A page per phone configuration: /samsung/samsung-galaxy-s26-ultra-12gb-256gb.
 *
 * Every price leads, each with its warranty badge and the cheapest marked in
 * the list, as on PCPrice.lk. Then the 90-day chart, the specs and any video
 * reviews.
 */

export const revalidate = false

type Params = { params: Promise<{ brand: string; phoneId: string }> }

// Phones added after a deploy render on first request (dynamicParams is on); an unknown id still gets notFound().
export async function generateStaticParams() {
  const directory = await loadDirectory()
  return Object.entries(directory).flatMap(([brand, list]) => list.map((p) => ({ brand, phoneId: p.phoneId })))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { brand, phoneId } = await params
  const phone = await findPhone(brand, phoneId)
  if (!phone) return {}

  const name = `${phoneName(phone)} ${configLabel(phone)}`
  const path = `/${brand}/${phone.phoneId}`
  const { description, lead } = phoneDescription(name, phone)

  return {
    title: `${name} price in Sri Lanka`,
    description,
    alternates: { canonical: canonical(path) },
    openGraph: {
      title: `${name} price in Sri Lanka | ${SITE_NAME}`,
      description: lead[0].toUpperCase() + lead.slice(1),
      url: canonical(path),
      type: 'website',
    },
  }
}

export default async function PhonePage({ params }: Params) {
  const { brand, phoneId } = await params
  const phone = await findPhone(brand, phoneId)
  if (!phone) notFound()

  const [siblings, history, specs, reviews] = await Promise.all([loadBrand(brand), loadPhoneHistory(phone.phoneId), loadSpecs(brand), loadReviews(brand)])
  const configs = siblings
    .filter((p) => p.model === phone.model)
    .sort((a, b) => (a.ramGb ?? 0) - (b.ramGb ?? 0) || a.storageGb - b.storageGb || Number(a.esimOnly) - Number(b.esimOnly))
  const range = priceRange(phone.offers)
  const name = phoneName(phone)
  const path = `/${brand}/${phone.phoneId}`
  const current = phone.offers.filter((o) => !o.stale)

  const rangeLine = `${phone.shops} ${phone.shops === 1 ? 'shop' : 'shops'} · ${
    !range ? 'no price confirmed this week' : range.low === range.high ? rupees(range.low) : `${rupees(range.low)} to ${rupees(range.high)}`
  }`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: canonical('/') },
          { '@type': 'ListItem', position: 2, name: phone.brand, item: canonical(`/${brand}`) },
          { '@type': 'ListItem', position: 3, name, item: canonical(path) },
        ],
      },
      {
        '@type': 'Product',
        name: `${name} ${configLabel(phone)}`,
        url: canonical(path),
        image: canonical(`${path}/opengraph-image`),
        category: 'Mobile phone',
        brand: { '@type': 'Brand', name: phone.brand },
        ...(range && {
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'LKR',
            lowPrice: range.low,
            highPrice: range.high,
            offerCount: current.length,
            availability: phone.inStockShops > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            offers: current.map((o) => ({
              '@type': 'Offer',
              price: o.priceLkr,
              priceCurrency: 'LKR',
              url: o.url,
              availability: o.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              seller: { '@type': 'Organization', name: o.shop },
            })),
          },
        }),
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <SiteHeader current="brands" back={{ href: `/${brand}`, label: phone.brand }} />

      <main className="mx-auto max-w-[1200px] px-4 pb-8 pt-5 sm:px-6 sm:pb-20 sm:pt-9">
        <nav aria-label="Breadcrumb" className="glass mb-7 hidden h-9 items-center gap-1.5 rounded-full pl-2.5 pr-4 text-[14px] font-medium text-ink-3 sm:inline-flex">
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <Link href={`/${brand}`} className="text-ink-2">
            {phone.brand}
          </Link>{' '}
          <span aria-hidden>/</span> {phone.model}
        </nav>

        <section className="rise flex flex-col gap-5 sm:gap-7">
          <div className="pt-2 sm:pt-0">
            <ViewTransition name={`phone-${phone.phoneId}`} share="morph" default="none">
              <h1 className="m-0 font-display text-[44px] font-bold leading-[0.98] tracking-[-0.045em] sm:text-[clamp(40px,5.6vw,72px)]">
                {name}
              </h1>
            </ViewTransition>
            <p className="m-0 mt-2.5 text-[15px] text-ink-2 sm:mt-3.5 sm:text-[17px]">{rangeLine}</p>
          </div>

          <div role="group" aria-label="Memory and storage" className="flex flex-col gap-2.5">
            <span className="hidden text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3 sm:block">Memory and storage</span>
            <div className="-mx-4 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
              <div className="glass inline-flex gap-0.5 whitespace-nowrap rounded-full p-1">
              {configs.map((c) =>
                c.phoneId === phone.phoneId ? (
                  <Link
                    key={c.phoneId}
                    href={`/${brand}/${c.phoneId}`}
                    aria-current="page"
                    className="inline-flex h-11 flex-none items-center rounded-full bg-[var(--segment)] px-4 text-[15px] font-semibold text-ink shadow-[0_2px_8px_rgb(0_0_0/12%),inset_0_0_0_0.5px_var(--color-line)] sm:px-5"
                  >
                    {configLabel(c)}
                  </Link>
                ) : (
                  <Link
                    key={c.phoneId}
                    href={`/${brand}/${c.phoneId}`}
                    className="chip inline-flex h-11 flex-none items-center rounded-full px-4 text-[15px] font-medium text-ink-2 sm:px-5"
                  >
                    {configLabel(c)}
                  </Link>
                ),
              )}
              </div>
            </div>
          </div>

          <p className="m-0 -mt-2 text-[13px] text-ink-3 sm:mt-0 sm:text-[14px]">
            Prices for any colour. Checked {checkedLabel(phone.checkedAt)}.
          </p>
        </section>

        <OfferList offers={phone.offers} />

        <section aria-label="Price history and specs" className="mt-5 flex flex-wrap gap-5 sm:mt-16 sm:gap-6">
          {history.length > 1 && <PriceChart points={history} />}
          <SpecsBlock brand={phone.brand} model={phone.model} specs={specs[phone.model] ?? null} />
        </section>

        <div className="mt-4 flex flex-col gap-2.5 rounded-[28px] bg-panel p-5 sm:hidden">
          <span className="font-display text-[20px] font-bold tracking-[-0.02em]">Why prices differ</span>
          <span className="text-[15px] leading-normal text-ink-2">
            {phone.brand === 'Apple'
              ? 'Apple warranty is Apple’s own. Shop warranty is the shop’s own, often 6 months hardware and 1 year software.'
              : `Company warranty comes from ${phone.brand}’s official agent. Shop warranty is the shop’s own, often 6 months hardware and 1 year software.`}
          </span>
        </div>

        <VideoReviews reviews={reviews[phone.model] ?? []} />
      </main>

      <SiteFooter />
    </>
  )
}

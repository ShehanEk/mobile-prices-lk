import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { OfferList } from '@/app/components/OfferList'
import { PriceChart } from '@/app/components/PriceChart'
import { SiteFooter, SiteHeader } from '@/app/components/SiteChrome'
import { checkedLabel, configLabel, phoneDescription, priceRange, rupees, WARRANTY_PHRASE, type Offer } from '@/lib/prices'
import { SITE_NAME, canonical, phoneName } from '@/lib/site'
import { findPhone, loadBrand, loadDirectory, loadPhoneHistory } from '@/queries/phones'

/**
 * A page per phone configuration: /samsung/samsung-galaxy-s26-ultra-12gb-256gb.
 *
 * Two headline prices lead, because the warranty decides the price: cheapest
 * overall (any warranty) and cheapest with company warranty (Apple's own
 * counts). At 375px both sit on the first screen; the company one shrinks to a
 * single row there, as on the canvas's phone board. Then every price with its
 * badge and the 90-day chart.
 */

export const revalidate = 1800

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

const label = 'text-[12px] font-bold uppercase tracking-[0.06em] sm:text-[13px]'
const bigPrice = 'font-display text-[40px] font-extrabold leading-[1.05] tracking-[-0.04em]'

function GoToShop({ offer, className }: { offer: Offer; className: string }) {
  return (
    <a href={offer.url} target="_blank" rel="noopener nofollow" className={`btn ${className}`}>
      Go to shop →<span className="sr-only"> (opens {offer.shop} in a new tab)</span>
    </a>
  )
}

function OverallCard({ offer }: { offer: Offer | null }) {
  return (
    <div className="flex flex-col gap-1 rounded-3xl bg-best p-5 sm:flex-[1_1_320px] sm:gap-1.5 sm:px-[22px] sm:pb-5 sm:pt-[22px]">
      <span className={label}>Cheapest overall</span>
      {offer ? (
        <>
          <span className={bigPrice}>{rupees(offer.priceLkr)}</span>
          <span className="text-[15px]">
            {offer.shop} · {WARRANTY_PHRASE[offer.warranty]}
            {offer.inStock ? '' : ' · out of stock'}
          </span>
          <GoToShop
            offer={offer}
            className="mt-3 flex h-12 items-center justify-center rounded-full bg-ink px-[18px] text-[16px] font-semibold text-white sm:mt-2.5 sm:inline-flex sm:h-11 sm:self-start sm:text-[15px]"
          />
        </>
      ) : (
        <span className="text-[15px] text-ink-2">No shop has confirmed a price in the last 7 days. Last seen prices are below.</span>
      )}
    </div>
  )
}

function CompanyCard({ offer }: { offer: Offer | null }) {
  if (!offer) {
    return (
      <div className="flex flex-col gap-1 rounded-3xl bg-company px-5 py-[18px] sm:flex-[1_1_320px] sm:gap-1.5 sm:p-[22px]">
        <span className={label}>With company warranty</span>
        <span className="text-[15px] text-ink-2">No shop lists this phone with company warranty right now.</span>
      </div>
    )
  }
  return (
    <>
      {/* Phone: one compact row, so both headline prices fit the first screen at 375px. */}
      <div className="flex items-center gap-3 rounded-3xl bg-company px-5 py-[18px] sm:hidden">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className={label}>With company warranty</span>
          <span className="font-display text-[26px] font-extrabold tracking-[-0.03em]">{rupees(offer.priceLkr)}</span>
          <span className="text-[14px]">
            {offer.shop}
            {offer.inStock ? '' : ' · out of stock'}
          </span>
        </span>
        <a
          href={offer.url}
          target="_blank"
          rel="noopener nofollow"
          aria-label={`Go to ${offer.shop} (opens in a new tab)`}
          className="btn flex h-12 w-12 flex-none items-center justify-center rounded-full bg-accent text-[20px] font-bold text-white"
        >
          →
        </a>
      </div>
      <div className="hidden flex-[1_1_320px] flex-col gap-1.5 rounded-3xl bg-company px-[22px] pb-5 pt-[22px] sm:flex">
        <span className={label}>With company warranty</span>
        <span className={bigPrice}>{rupees(offer.priceLkr)}</span>
        <span className="text-[15px]">
          {offer.shop} · {offer.warrantyText ?? WARRANTY_PHRASE[offer.warranty]}
          {offer.inStock ? '' : ' · out of stock'}
        </span>
        <GoToShop
          offer={offer}
          className="mt-2.5 inline-flex h-11 items-center self-start rounded-full bg-accent px-[18px] text-[15px] font-semibold text-white"
        />
      </div>
    </>
  )
}

export default async function PhonePage({ params }: Params) {
  const { brand, phoneId } = await params
  const phone = await findPhone(brand, phoneId)
  if (!phone) notFound()

  const [siblings, history] = await Promise.all([loadBrand(brand), loadPhoneHistory(phone.phoneId)])
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
      <SiteHeader current="brands" />

      <main className="mx-auto max-w-[1200px] px-4 pb-8 pt-4 sm:px-6 sm:pb-20 sm:pt-7">
        <nav aria-label="Breadcrumb" className="mb-6 hidden text-[14px] text-ink-3 sm:block">
          <Link href={`/${brand}`} className="text-ink-3">
            {phone.brand}
          </Link>{' '}
          <span aria-hidden>/</span> {phone.model}
        </nav>

        <section className="rise flex flex-col gap-5 sm:gap-7">
          <div className="pt-2 sm:pt-0">
            <p className="m-0 text-[14px] font-semibold text-accent sm:mb-2 sm:text-[15px]">{phone.brand}</p>
            <h1 className="m-0 mt-1 font-display text-[48px] font-extrabold leading-[0.92] tracking-[-0.05em] sm:mt-0 sm:text-[clamp(40px,5.6vw,72px)] sm:font-bold">
              {phone.model}
            </h1>
            <p className="m-0 mt-2.5 text-[15px] text-ink-2 sm:mt-3.5 sm:text-[17px]">{rangeLine}</p>
          </div>

          <div role="group" aria-label="Memory and storage" className="flex flex-col gap-2.5">
            <span className="hidden text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3 sm:block">Memory and storage</span>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              {configs.map((c) =>
                c.phoneId === phone.phoneId ? (
                  <Link
                    key={c.phoneId}
                    href={`/${brand}/${c.phoneId}`}
                    aria-current="page"
                    className="inline-flex h-11 flex-none items-center rounded-full bg-ink px-4 text-[15px] font-semibold text-white sm:px-[18px]"
                  >
                    {configLabel(c)}
                  </Link>
                ) : (
                  <Link
                    key={c.phoneId}
                    href={`/${brand}/${c.phoneId}`}
                    className="chip edge-strong inline-flex h-11 flex-none items-center rounded-full px-4 text-[15px] font-semibold sm:px-[18px]"
                  >
                    {configLabel(c)}
                  </Link>
                ),
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <OverallCard offer={phone.overall} />
            <CompanyCard offer={phone.company} />
          </div>
          <p className="m-0 -mt-2 text-[13px] text-ink-3 sm:mt-0 sm:text-[14px]">
            Prices for any colour. Checked {checkedLabel(phone.checkedAt)}.
          </p>
        </section>

        <OfferList offers={phone.offers} />

        {history.length > 1 && (
          <section aria-label="Price history" className="mt-5 flex flex-wrap gap-6 sm:mt-16">
            <PriceChart points={history} />
          </section>
        )}

        <div className="mt-5 flex flex-col gap-2.5 rounded-3xl bg-panel p-5 sm:hidden">
          <span className="font-display text-[20px] font-bold tracking-[-0.02em]">Why prices differ</span>
          <span className="text-[15px] leading-normal text-ink-2">
            {phone.brand === 'Apple'
              ? 'Apple warranty is Apple’s own. Shop warranty is the shop’s own, often 6 months hardware and 1 year software.'
              : `Company warranty comes from ${phone.brand}’s official agent. Shop warranty is the shop’s own, often 6 months hardware and 1 year software.`}
          </span>
        </div>
      </main>

      <SiteFooter />
    </>
  )
}

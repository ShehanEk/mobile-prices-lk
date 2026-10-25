import type { Metadata } from 'next'
import Link from 'next/link'

import { DealsList } from '../components/Deals'
import { SiteFooter, SiteHeader } from '../components/SiteChrome'
import { toDealItems } from '@/lib/deals'
import { SITE_NAME, brandStyle, canonical } from '@/lib/site'
import { loadDeals } from '@/queries/phones'

/** Phones below their usual price. Rebuilt with the catalogue, at most every 30 minutes. */

export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Phone price drops in Sri Lanka',
  description:
    'Phones selling below their usual price in Sri Lanka today, from local shops. Checked every night against each phone’s last 30 days.',
  alternates: { canonical: canonical('/deals') },
  openGraph: { title: `Phone price drops in Sri Lanka | ${SITE_NAME}`, url: canonical('/deals'), type: 'website' },
}

export default async function DealsPage() {
  const deals = toDealItems(await loadDeals())
  const inks = Object.fromEntries([...new Set(deals.map((d) => d.brand))].map((b) => [b, brandStyle(b).ink]))

  return (
    <>
      <SiteHeader current="deals" />
      <main className="mx-auto max-w-[1000px] px-4 pb-20 pt-7 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-[14px] text-ink-3">
          <Link href="/" className="text-ink-3">
            Home
          </Link>{' '}
          <span aria-hidden>/</span> Price drops
        </nav>
        <h1 className="m-0 mt-6 font-display text-[clamp(36px,5vw,56px)] font-bold leading-none tracking-[-0.045em]">
          Phone price drops in Sri Lanka
        </h1>
        <p className="m-0 mt-4 max-w-[64ch] text-[16px] leading-relaxed text-ink-2">
          Phones selling below their usual price right now. A phone makes this list when its cheapest in-stock price is at
          least 5% under its typical price over the last 30 days. Checked every night.
        </p>
        <div className="mt-8">
          {deals.length > 0 ? (
            <DealsList deals={deals} inks={inks} />
          ) : (
            <p className="edge-strong m-0 rounded-3xl px-6 py-5 text-[15px] leading-relaxed text-ink-2">
              No phone is more than 5% below its usual price today. Prices are checked every night, so look again tomorrow,
              or{' '}
              <Link href="/#brands" className="text-accent underline underline-offset-2">
                browse by brand
              </Link>
              .
            </p>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}

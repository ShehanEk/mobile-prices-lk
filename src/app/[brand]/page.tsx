import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ViewTransition } from 'react'

import { BrandList, type BrandRow } from '@/app/components/BrandList'
import { SiteFooter, SiteHeader } from '@/app/components/SiteChrome'
import { rupees, type PhoneSummary } from '@/lib/prices'
import { BRAND_SLUGS, SITE_NAME, TRACKED_SHOPS, brandFromSlug, brandVars, canonical, phoneName } from '@/lib/site'
import { loadBrand, loadDirectory } from '@/queries/phones'

/**
 * One list page per brand: /samsung, /apple. These exist to be found ("samsung
 * phone price sri lanka") and are the crawl path to every phone page.
 */

export const revalidate = false

type Params = { params: Promise<{ brand: string }> }

// A brand that gains its first phone after a deploy renders on first request (dynamicParams is on).
export async function generateStaticParams() {
  const directory = await loadDirectory()
  return BRAND_SLUGS.filter((s) => directory[s].length > 0).map((brand) => ({ brand }))
}

/** The meta description, also the line under the page heading. */
function brandDescription(brand: string, phones: PhoneSummary[]): string {
  const inStock = phones.filter((p) => p.overall?.inStock)
  const from = inStock.length ? Math.min(...inStock.map((p) => p.overall!.priceLkr)) : null
  return from !== null
    ? `Compare ${inStock.length} ${brand} phones in stock in Sri Lanka, from ${rupees(from)}. Every price labelled company or shop warranty, updated daily.`
    : `${brand} phone prices from Sri Lankan shops, updated daily.`
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = (await params).brand
  const brand = brandFromSlug(slug)
  if (!brand) return {}

  const title = `${brand} phone prices in Sri Lanka`
  const description = brandDescription(brand, await loadBrand(slug))

  return {
    title,
    description,
    alternates: { canonical: canonical(`/${slug}`) },
    openGraph: { title: `${title} | ${SITE_NAME}`, description, url: canonical(`/${slug}`), type: 'website' },
  }
}

export default async function BrandPage({ params }: Params) {
  const slug = (await params).brand
  const brand = brandFromSlug(slug)
  if (!brand) notFound()

  const directory = await loadDirectory()
  const phones = directory[slug]
  const style = brandVars(brand)
  const brands = BRAND_SLUGS.filter((s) => directory[s].length > 0)
  const listed = new Set(phones.flatMap((p) => p.offers.map((o) => o.shop)))
  const shops = TRACKED_SHOPS.filter((s) => listed.has(s))

  const rows: BrandRow[] = phones.map((p) => ({
    phoneId: p.phoneId,
    href: `/${slug}/${p.phoneId}`,
    model: p.model,
    ramGb: p.ramGb,
    storageGb: p.storageGb,
    esimOnly: p.esimOnly,
    offers: p.offers.map((o) => ({
      shop: o.shop,
      warranty: o.warranty,
      priceLkr: o.priceLkr,
      inStock: o.inStock,
      stale: o.stale,
      seenAt: o.seenAt,
    })),
  }))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: canonical('/') },
          { '@type': 'ListItem', position: 2, name: brand, item: canonical(`/${slug}`) },
        ],
      },
      {
        '@type': 'ItemList',
        name: `${brand} phones available in Sri Lanka`,
        numberOfItems: phones.length,
        itemListElement: phones.slice(0, 100).map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: phoneName(p),
          url: canonical(`/${slug}/${p.phoneId}`),
        })),
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <SiteHeader current="brands" />

      <ViewTransition name={`brand-${slug}`} share="morph" default="none">
      <section className="overflow-hidden" style={{ background: style.tint, color: style.ink }}>
        <div className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-6 sm:pt-12">
          <nav aria-label="Brands" className="-mx-4 mb-7 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:mb-9 sm:flex-wrap sm:px-0">
            {brands.map((s) =>
              s === slug ? (
                <Link key={s} href={`/${s}`} aria-current="page" className="inline-flex h-10 flex-none items-center rounded-full bg-accent px-4 text-[14px] font-bold text-on-accent">
                  {brandFromSlug(s)}
                </Link>
              ) : (
                <Link
                  key={s}
                  href={`/${s}`}
                  className="chip inline-flex h-10 flex-none items-center rounded-full bg-card px-4 text-[14px] font-semibold"
                  style={{ color: style.ink }}
                >
                  {brandFromSlug(s)}
                </Link>
              ),
            )}
          </nav>
          <div className="flex flex-col gap-3 pb-10">
            <h1 className="m-0 flex flex-col gap-2 font-display font-bold">
              <span className="text-[clamp(44px,6vw,80px)] leading-none tracking-[-0.04em]">{brand}</span>
              <span className="text-[20px] leading-tight tracking-[-0.02em] sm:text-[24px]">phone prices in Sri Lanka</span>
            </h1>
            <p className="m-0 max-w-[64ch] text-[15px] leading-normal opacity-80 sm:text-[16px]">{brandDescription(brand, phones)}</p>
          </div>
        </div>
      </section>
      </ViewTransition>

      <main className="mx-auto max-w-[1200px] px-4 pb-20 pt-8 sm:px-6 sm:pt-10">
        <BrandList rows={rows} shops={shops} />
      </main>

      <SiteFooter />
    </>
  )
}

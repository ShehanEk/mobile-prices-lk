import type { Metadata } from 'next'
import Link from 'next/link'

import { SearchBox } from '../components/SearchBox'
import { SiteFooter, SiteHeader } from '../components/SiteChrome'
import { configLabel, rupees } from '@/lib/prices'
import { searchPhones } from '@/lib/search'
import { BRAND_SLUGS, brandFromSlug, brandStyle, canonical } from '@/lib/site'
import { loadDirectory } from '@/queries/phones'

/**
 * Search results, rendered per request from the cached directory. Kept out of
 * the index: a results page for every string anyone types is thin duplicate
 * content, and the brand and phone pages rank for what people search for.
 */

const SHOWN = 50

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }

async function readQuery(searchParams: Props['searchParams']): Promise<string> {
  const q = (await searchParams).q
  return (Array.isArray(q) ? q[0] : (q ?? '')).trim().slice(0, 100)
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = await readQuery(searchParams)
  return {
    title: q ? `“${q}” prices in Sri Lanka` : 'Search phones',
    robots: { index: false, follow: true },
    // Otherwise it inherits the layout's canonical and claims to be the home page.
    alternates: { canonical: canonical('/search') },
  }
}

export default async function SearchPage({ searchParams }: Props) {
  const q = await readQuery(searchParams)
  const directory = await loadDirectory()
  const results = q ? searchPhones(directory, q) : []
  const shown = results.slice(0, SHOWN)
  const brands = BRAND_SLUGS.filter((s) => directory[s].length > 0)

  return (
    <>
      <SiteHeader current="search" />
      <main className="mx-auto max-w-[1000px] px-4 pb-20 pt-8 sm:px-6 sm:pt-10">
        <h1 className="m-0 font-display text-[clamp(32px,4.4vw,48px)] font-bold leading-none tracking-[-0.04em]">
          {q ? `${results.length} ${results.length === 1 ? 'result' : 'results'} for “${q}”` : 'Search phones'}
        </h1>
        <div className="mb-8 mt-6">
          <SearchBox large defaultValue={q} />
        </div>

        {q && results.length === 0 && (
          <div className="flex flex-col gap-3 rounded-3xl bg-panel p-6">
            <p className="m-0 text-[16px]">Nothing matches “{q}”.</p>
            <p className="m-0 text-[15px] text-ink-2">Try fewer words, or a model number on its own. Or browse a brand:</p>
            <div className="flex flex-wrap gap-2">
              {brands.map((s) => (
                <Link key={s} href={`/${s}`} className="chip edge-strong inline-flex h-10 items-center rounded-full bg-white px-4 text-[14px] font-semibold">
                  {brandFromSlug(s)}
                </Link>
              ))}
            </div>
          </div>
        )}

        {shown.length > 0 && (
          <section aria-label="Results" className="edge overflow-hidden rounded-3xl">
            <ul className="m-0 list-none p-0">
              {shown.map((p) => (
                <li key={p.phoneId} className="border-b border-line last:border-b-0">
                  <Link href={`/${p.brandSlug}/${p.phoneId}`} className="row flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4">
                    <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                      <span className="text-[13px] font-semibold" style={{ color: brandStyle(p.brand).ink }}>
                        {p.brand}
                      </span>
                      <span className="text-[16px] font-semibold">{p.model}</span>
                      <span className="text-[14px] text-ink-3">
                        {configLabel(p)} · {p.shops} {p.shops === 1 ? 'shop' : 'shops'}
                      </span>
                    </span>
                    <span className="ml-auto flex flex-col items-end gap-0.5 text-right">
                      {p.overall ? (
                        <>
                          <span className={`whitespace-nowrap font-display text-[20px] font-extrabold tracking-[-0.03em] ${p.overall.inStock ? '' : 'text-ink-3'}`}>
                            {rupees(p.overall.priceLkr)}
                          </span>
                          <span className="text-[13px] text-ink-2">
                            at {p.overall.shop}
                            {p.overall.inStock ? '' : ', out of stock'}
                          </span>
                        </>
                      ) : (
                        <span className="text-[13px] text-ink-3">No price this week</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {results.length > SHOWN && (
              <p className="m-0 bg-panel px-5 py-3 text-[13px] text-ink-3">
                Showing the first {SHOWN} of {results.length}. Add a word to narrow it down.
              </p>
            )}
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  )
}

import { ViewTransition, type ReactNode } from 'react'
import Link from 'next/link'

import { TRACKED_SHOPS } from '@/lib/site'
import { loadDeals } from '@/queries/phones'
import { SearchBox } from './SearchBox'

/**
 * Header and footer shared by every page, Liquid Glass (decisions, 2026-11-09).
 *
 * Nav: Brands, Search. Price drops joins the nav once a phone qualifies. No
 * Shops link (decisions, 2026-10-25); the footer names the six shops instead.
 * The header is a frosted capsule that stays at the top. Below 640px the nav
 * moves to a frosted tab bar at the bottom, with Search as its own round
 * button, and a phone page swaps the wordmark for a link back to its brand.
 */

type NavKey = 'home' | 'brands' | 'deals' | 'search'
type NavLink = { key: NavKey; href: string; label: string; icon: ReactNode }

const icon = (d: ReactNode) => (
  <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
)

const SearchIcon = () => (
  <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
)

/** The wordmark: a phone drawn as two rounded boxes, then "mobileprices.lk". */
export function Wordmark() {
  return (
    <Link href="/" aria-label="MobilePrices.lk home" className="flex items-center gap-2 sm:gap-2.5">
      <span aria-hidden className="flex h-[26px] w-4 rounded-md bg-ink p-[3px] sm:h-[30px] sm:w-5 sm:rounded-[7px]">
        <span className="flex-1 rounded-[3px] bg-live sm:rounded" />
      </span>
      <span className="font-display text-[18px] font-bold tracking-[-0.03em] text-ink sm:text-[20px]">
        mobileprices<span className="text-accent">.lk</span>
      </span>
    </Link>
  )
}

export async function SiteHeader({ current, back }: { current?: NavKey; back?: { href: string; label: string } }) {
  // Price drops appear once a phone qualifies.
  const hasDeals = (await loadDeals()).length > 0
  const links: NavLink[] = [
    { key: 'brands', href: '/#brands', label: 'Brands', icon: icon(<><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></>) },
    ...(hasDeals
      ? [{ key: 'deals' as const, href: '/deals', label: 'Price drops', icon: icon(<><path d="M4 6l6 6 4-4 6 6" /><path d="M20 9v5h-5" /></>) }]
      : []),
  ]
  const tabs: NavLink[] = [{ key: 'home', href: '/', label: 'Home', icon: icon(<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />) }, ...links]

  return (
    <>
      <ViewTransition name="site-header">
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="mx-auto flex max-w-[1152px] items-center gap-6 sm:glass sm:h-16 sm:rounded-full sm:pl-[22px] sm:pr-2.5">
          {back ? (
            <>
              <Link
                href={back.href}
                className="glass flex h-12 items-center gap-1 rounded-full pl-2.5 pr-4 text-[16px] font-semibold sm:hidden"
              >
                <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
                {back.label}
              </Link>
              <span className="hidden sm:flex">
                <Wordmark />
              </span>
            </>
          ) : (
            <span className="glass flex h-12 items-center rounded-full pl-3.5 pr-4 sm:contents">
              <Wordmark />
            </span>
          )}
          <nav aria-label="Main" className="hidden gap-1 text-[15px] font-medium sm:flex">
            {links.map((l) => (
              <Link
                key={l.key}
                href={l.href}
                aria-current={current === l.key ? 'page' : undefined}
                className={`rounded-full px-4 py-2.5 ${current === l.key ? 'bg-panel text-accent' : 'text-ink-2'}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto hidden flex-[0_1_340px] sm:block">
            <SearchBox />
          </div>
        </div>
      </header>
      </ViewTransition>

      <ViewTransition name="tab-bar">
      <nav
        aria-label="Main"
        className="fixed inset-x-3 bottom-[max(16px,env(safe-area-inset-bottom))] z-40 flex items-center gap-2.5 sm:hidden"
      >
        <div className="glass flex h-[62px] flex-1 gap-0.5 rounded-full p-[5px]">
          {tabs.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              aria-current={current === l.key ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold ${
                current === l.key ? 'bg-panel text-accent' : 'text-ink'
              }`}
            >
              {l.icon}
              {l.label}
            </Link>
          ))}
        </div>
        <Link
          href="/search"
          aria-label="Search"
          aria-current={current === 'search' ? 'page' : undefined}
          className={`glass flex h-[62px] w-[62px] flex-none items-center justify-center rounded-full ${current === 'search' ? 'text-accent' : 'text-ink'}`}
        >
          <SearchIcon />
        </Link>
      </nav>
      </ViewTransition>
    </>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-7 gap-y-3 px-5 pb-32 pt-7 text-[14px] text-ink-3 sm:px-6 sm:pb-10">
        <span className="font-display text-[17px] font-bold tracking-[-0.03em] text-ink">
          mobileprices<span className="text-accent">.lk</span>
        </span>
        <span>Prices are each shop’s own, checked nightly. Confirm with the shop before you buy.</span>
        <span className="flex gap-6 sm:ml-auto">
          <Link href="/privacy" className="text-ink-3">
            Privacy
          </Link>
          <a href="https://pcprice.lk" className="text-ink-3">
            PC parts: PCPrice.lk
          </a>
        </span>
        <p className="m-0 w-full">Prices from {TRACKED_SHOPS.join(' · ')}</p>
      </div>
    </footer>
  )
}

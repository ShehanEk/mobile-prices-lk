import Link from 'next/link'

import { TRACKED_SHOPS } from '@/lib/site'
import { loadDeals } from '@/queries/phones'
import { SearchBox } from './SearchBox'

/**
 * Header and footer shared by every page, from the canvas.
 *
 * Nav: Brands, Search. Price drops joins the nav once a phone qualifies. No
 * Shops link (decisions, 2026-10-25); the footer names the six shops instead.
 * Below 640px the nav moves into a menu and search becomes an icon, as on the
 * 390px phone board.
 */

type NavKey = 'brands' | 'deals' | 'search'
type NavLink = { key: NavKey; href: string; label: string }

const SearchIcon = () => (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1F2B" strokeWidth={2} strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
)

/** The wordmark: a phone drawn as two rounded boxes, then "mobileprices.lk". */
export function Wordmark() {
  return (
    <Link href="/" aria-label="MobilePrices.lk home" className="flex items-center gap-2 sm:gap-2.5">
      <span aria-hidden className="flex h-7 w-[18px] rounded-md bg-ink p-[3px] sm:h-[34px] sm:w-[22px] sm:rounded-[7px]">
        <span className="flex-1 rounded-[3px] bg-live sm:rounded" />
      </span>
      <span className="font-display text-[19px] font-extrabold tracking-[-0.03em] text-ink sm:text-[22px]">
        mobileprices<span className="text-accent">.lk</span>
      </span>
    </Link>
  )
}

export async function SiteHeader({ current }: { current?: NavKey }) {
  // Price drops appear once a phone qualifies.
  const hasDeals = (await loadDeals()).length > 0
  const links: NavLink[] = [
    { key: 'brands', href: '/#brands', label: 'Brands' },
    ...(hasDeals ? [{ key: 'deals' as const, href: '/deals', label: 'Price drops' }] : []),
  ]

  const link = (l: NavLink, className: string) => (
    <Link
      key={l.key}
      href={l.href}
      aria-current={current === l.key ? 'page' : undefined}
      className={current === l.key ? `${className} text-accent` : className}
    >
      {l.label}
    </Link>
  )

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-[1200px] items-center gap-2 px-4 py-3 sm:gap-6 sm:px-6 sm:py-[18px]">
        <Wordmark />
        <nav aria-label="Main" className="hidden gap-[22px] text-[15px] font-medium sm:flex">
          {links.map((l) => link(l, ''))}
        </nav>
        <div className="ml-auto hidden flex-[0_1_320px] sm:block">
          <SearchBox />
        </div>

        <Link href="/search" aria-label="Search" className="ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-panel sm:hidden">
          <SearchIcon />
        </Link>
        <details className="relative sm:hidden">
          <summary
            aria-label="Menu"
            className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full bg-panel [&::-webkit-details-marker]:hidden"
          >
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1F2B" strokeWidth={2} strokeLinecap="round">
              <path d="M4 8h16M4 16h16" />
            </svg>
          </summary>
          <nav aria-label="Menu" className="edge-card absolute right-0 top-[52px] z-30 flex w-52 flex-col rounded-2xl bg-white p-2">
            {[...links, { key: 'search' as const, href: '/search', label: 'Search' }].map((l) =>
              link(l, 'flex min-h-11 items-center rounded-xl px-3 text-[16px] font-medium'),
            )}
          </nav>
        </details>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-7 gap-y-3 px-4 pb-10 pt-7 text-[14px] text-ink-3 sm:px-6">
        <span className="font-display text-[17px] font-extrabold tracking-[-0.03em] text-ink">
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

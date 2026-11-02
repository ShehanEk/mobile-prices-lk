import { SHOP_PROFILES, type ShopNote } from '@/lib/shops'
import type { ShopStats } from '@/lib/shop-stats'
import { TRACKED_SHOPS } from '@/lib/site'

const LINK = 'inline-flex min-h-11 flex-none items-center text-[14px] font-semibold text-accent sm:min-h-0'
const LABEL = 'text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3'

const TONE: Record<ShopNote['tone'], { dot: string; ink: string }> = {
  good: { dot: 'bg-best-ink', ink: 'text-ink-2' },
  check: { dot: 'bg-shop-dot', ink: 'text-shop-ink' },
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-display text-[22px] font-extrabold tracking-[-0.03em] sm:text-[24px]">{value}</span>
      <span className="text-[13px] text-ink-2">{label}</span>
    </span>
  )
}

const percent = (value: number | null) => (value === null ? '–' : `${value}%`)

/** A sideways row of shop cards, from the canvas. Nothing moves unless the visitor scrolls it. */
export function ShopProfiles({ stats }: { stats: Record<string, ShopStats> }) {
  return (
    <section id="shops" aria-labelledby="shops-title" className="mx-auto max-w-[1200px] px-4 pb-5 pt-10 sm:px-6 sm:pb-11 sm:pt-16">
      <div className="mb-5 sm:mb-6">
        <h2 id="shops-title" className="m-0 mb-1.5 font-display text-[28px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[32px]">
          Know the shop before you buy
        </h2>
        <p className="m-0 max-w-[720px] text-[15px] leading-normal text-ink-2 sm:text-[16px]">
          What our own price checks show, and what recent Google reviews mention most. Summarised by us every 3 months. Cheapest counts phones another shop also has in stock.
        </p>
      </div>

      <ul className="-mx-4 flex snap-x snap-proximity scroll-pl-4 gap-3 overflow-x-auto px-4 pb-6 pt-1 sm:-mx-6 sm:scroll-pl-6 sm:gap-4 sm:px-6 sm:pb-7">
        {TRACKED_SHOPS.map((shop) => {
          const profile = SHOP_PROFILES[shop]
          const { phones, inStockPct, cheapestPct } = stats[shop]
          return (
            <li key={shop} className="edge-card flex w-[300px] flex-none snap-start flex-col gap-3 rounded-3xl bg-white p-[18px] sm:w-[360px] sm:gap-4 sm:p-[22px]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="m-0 min-w-0 font-display text-[18px] font-bold tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-[20px]">{shop}</h3>
                <a href={profile.website} target="_blank" rel="noopener" className={LINK}>
                  Visit site ↗
                </a>
              </div>

              <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-panel p-3 sm:gap-2 sm:px-3.5">
                <Stat value={phones.toLocaleString('en-LK')} label="phones listed" />
                <Stat value={percent(inStockPct)} label="in stock" />
                <Stat value={percent(cheapestPct)} label="cheapest" />
              </div>

              {profile.branches.length > 0 && (
                <div className="flex flex-col sm:gap-1.5">
                  <span className={LABEL}>Branches</span>
                  {profile.branches.map((b) => (
                    <span key={b.name} className="flex items-center justify-between gap-3 text-[15px]">
                      <span>{b.name}</span>
                      <a href={b.mapsUrl} target="_blank" rel="noopener" className={LINK}>
                        Open in Maps
                      </a>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-1 flex-col gap-2.5 border-t border-line-soft pt-3 sm:pt-3.5">
                <span className={LABEL}>Recent reviews mention</span>
                {profile.reviews ? (
                  <ul className="flex flex-col gap-2">
                    {profile.reviews.notes.map((n) => (
                      <li key={n.attribute} className="flex gap-2.5 text-[14px] leading-[1.4]">
                        <span aria-hidden className={`mt-1.5 h-2 w-2 flex-none rounded-full ${TONE[n.tone].dot}`} />
                        <span className={TONE[n.tone].ink}>
                          <strong className="font-semibold">{n.attribute}.</strong> {n.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-[14px] leading-[1.4] text-ink-2">Not enough recent reviews to summarise.</span>
                )}
                <div className="mt-auto flex flex-col gap-2.5 sm:pt-1">
                  {profile.reviews && (
                    <span className="text-[13px] text-ink-2">
                      From {profile.reviews.count} Google reviews, {profile.reviews.period}
                    </span>
                  )}
                  <a href={profile.reviewsUrl} target="_blank" rel="noopener" className={`${LINK} self-start`}>
                    Read them on Google ↗
                  </a>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

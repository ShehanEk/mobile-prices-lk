import { rupees, type HistoryPoint } from '@/lib/prices'

/**
 * Lowest in-stock price per day over 90 days: any warranty (ink) and company
 * warranty (blue). Server-rendered SVG, no JavaScript, as on PCPrice.lk.
 *
 * Two drawings of the same data, as on the canvas: labelled axes from 640px,
 * and a bare line with a "Down Rs … since …" caption below it, where axis
 * labels would shrink past reading. Callers render it only with ≥ 2 points.
 */

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const dayLabel = (iso: string) => dayFormat.format(new Date(`${iso}T00:00:00Z`))
const thousands = (n: number) => `${Math.round(n / 1000)}k`

type Box = { width: number; left: number; top: number; bottom: number }
const WIDE: Box = { width: 640, left: 56, top: 20, bottom: 160 }
const NARROW: Box = { width: 320, left: 0, top: 10, bottom: 110 }

function plot(points: HistoryPoint[], box: Box) {
  const values = points.flatMap((p) => (p.companyLkr === null ? [p.anyLkr] : [p.anyLkr, p.companyLkr]))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) => box.left + (i * (box.width - box.left)) / (points.length - 1)
  const y = (v: number) => box.top + (1 - (v - min) / span) * (box.bottom - box.top)
  const line = (pick: (p: HistoryPoint) => number | null) =>
    points
      .flatMap((p, i) => {
        const v = pick(p)
        return v === null ? [] : [`${x(i).toFixed(1)},${y(v).toFixed(1)}`]
      })
      .join(' ')
  const last = points.length - 1
  return {
    min,
    max,
    any: line((p) => p.anyLkr),
    company: line((p) => p.companyLkr),
    end: { x: x(last), y: y(points[last].anyLkr) },
  }
}

export function PriceChart({ points }: { points: HistoryPoint[] }) {
  const first = points[0]
  const last = points[points.length - 1]
  const company = points.filter((p) => p.companyLkr !== null)
  const hasCompany = company.length > 1
  const wide = plot(points, WIDE)
  const narrow = plot(points, NARROW)

  const change = last.anyLkr - first.anyLkr
  const since =
    change < 0
      ? `Down ${rupees(-change)} since ${dayLabel(first.day)}`
      : change > 0
        ? `Up ${rupees(change)} since ${dayLabel(first.day)}`
        : `No change since ${dayLabel(first.day)}`
  const label =
    `Lowest in-stock price from ${dayLabel(first.day)} to ${dayLabel(last.day)}: ${rupees(first.anyLkr)} to ${rupees(last.anyLkr)}` +
    (hasCompany
      ? `; with company warranty ${rupees(company[0].companyLkr!)} to ${rupees(company[company.length - 1].companyLkr!)}.`
      : '.')

  return (
    <figure className="m-0 min-w-0 flex-[2_1_560px] rounded-3xl bg-panel p-5 sm:rounded-[28px] sm:p-7">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 sm:mb-[18px]">
        <span className="font-display text-[20px] font-bold tracking-[-0.02em] sm:text-[24px]">
          <span className="sm:hidden">Lowest price, 90 days</span>
          <span className="hidden sm:inline">Lowest price, last 90 days</span>
        </span>
        <span className="w-full text-[14px] text-ink-2 sm:hidden">{since}</span>
        <span className="hidden gap-4 text-[14px] text-ink-2 sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-3.5 rounded-sm bg-ink" />
            Any warranty
          </span>
          {hasCompany && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1 w-3.5 rounded-sm bg-accent" />
              Company warranty
            </span>
          )}
        </span>
      </figcaption>

      <svg role="img" aria-label={label} viewBox="0 0 640 220" className="hidden h-auto w-full sm:block">
        <g stroke="#D5DAE3" strokeWidth="1">
          <line x1="56" y1="20" x2="640" y2="20" />
          <line x1="56" y1="90" x2="640" y2="90" />
          <line x1="56" y1="160" x2="640" y2="160" />
        </g>
        <g fontSize="12" fill="#69707F" style={{ fontFamily: 'var(--font-geist), sans-serif' }}>
          <text x="0" y="24">{thousands(wide.max)}</text>
          <text x="0" y="94">{thousands((wide.min + wide.max) / 2)}</text>
          <text x="0" y="164">{thousands(wide.min)}</text>
          <text x="56" y="210">{dayLabel(first.day)}</text>
          {points.length > 2 && (
            <text x="348" y="210" textAnchor="middle">{dayLabel(points[Math.floor(points.length / 2)].day)}</text>
          )}
          <text x="640" y="210" textAnchor="end">{dayLabel(last.day)}</text>
        </g>
        {hasCompany && <polyline fill="none" stroke="#3467D7" strokeWidth="3" strokeLinejoin="round" points={wide.company} />}
        <polyline fill="none" stroke="#1A1F2B" strokeWidth="3" strokeLinejoin="round" points={wide.any} />
        <circle cx={Math.min(wide.end.x, 634)} cy={wide.end.y} r="6" fill="#3DBA6E" stroke="#1A1F2B" strokeWidth="2" />
      </svg>

      <svg role="img" aria-label={label} viewBox="0 0 320 120" className="block h-auto w-full sm:hidden">
        <g stroke="#D5DAE3" strokeWidth="1">
          <line x1="0" y1="10" x2="320" y2="10" />
          <line x1="0" y1="60" x2="320" y2="60" />
          <line x1="0" y1="110" x2="320" y2="110" />
        </g>
        {hasCompany && <polyline fill="none" stroke="#3467D7" strokeWidth="3" strokeLinejoin="round" points={narrow.company} />}
        <polyline fill="none" stroke="#1A1F2B" strokeWidth="3" strokeLinejoin="round" points={narrow.any} />
        <circle cx={Math.min(narrow.end.x, 314)} cy={narrow.end.y} r="6" fill="#3DBA6E" stroke="#1A1F2B" strokeWidth="2" />
      </svg>
    </figure>
  )
}

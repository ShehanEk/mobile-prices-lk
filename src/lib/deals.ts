import { configLabel, sriLankaDate, type PhoneSummary, type PricePoint } from '@/lib/prices'

/**
 * Phones selling below their usual price. PCPrice.lk's rule, unchanged.
 *
 * A price drop is a phone whose cheapest in-stock price now (any warranty) is
 * at least 5% under the median of its daily lowest in-stock price over the
 * previous 30 days, with at least 7 of those days on record, so a phone we only
 * just started tracking cannot show a drop it never had. Drops over 30% are
 * left out as likely matching errors.
 *
 * "Below usual", not "price cut": it can also be a shop that sells cheaper than
 * the ones we saw before. Either way it is cheaper to buy now.
 */

const THRESHOLD = 0.05
/** Above this the drop is more likely a listing matched to the wrong phone than a real discount. */
const IMPLAUSIBLE = 0.3
const WINDOW_DAYS = 30
const MIN_DAYS = 7

export type Deal = {
  phone: PhoneSummary
  priceLkr: number
  shop: string
  usualLkr: number
  savingLkr: number
  /** Whole percent, rounded. */
  percent: number
  /** Cheaper now than on any day in the window. */
  lowest: boolean
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function findDeals(
  directory: Record<string, PhoneSummary[]>,
  lows: Record<string, PricePoint[]>,
  now = new Date(),
): Deal[] {
  // Sri Lanka days, matching price_history.recorded_on.
  const today = sriLankaDate(now)
  const from = sriLankaDate(new Date(now.getTime() - WINDOW_DAYS * 86_400_000))

  const deals: Deal[] = []
  for (const phones of Object.values(directory)) {
    for (const phone of phones) {
      const best = phone.overall
      if (!best || !best.inStock) continue

      // Today is left out: it is the price being judged, not the norm.
      const inWindow = (lows[phone.phoneId] ?? []).filter((p) => p.day >= from && p.day < today).map((p) => p.lowestLkr)
      if (inWindow.length < MIN_DAYS) continue

      const usual = median(inWindow)
      if (best.priceLkr > usual * (1 - THRESHOLD)) continue
      if (best.priceLkr < usual * (1 - IMPLAUSIBLE)) continue

      deals.push({
        phone,
        priceLkr: best.priceLkr,
        shop: best.shop,
        usualLkr: Math.round(usual),
        savingLkr: Math.round(usual - best.priceLkr),
        percent: Math.round((100 * (usual - best.priceLkr)) / usual),
        lowest: best.priceLkr < Math.min(...inWindow),
      })
    }
  }
  return deals.sort((a, b) => b.percent - a.percent || b.savingLkr - a.savingLkr)
}

/** What the lists and cards render, without the whole phone. */
export type DealItem = {
  brandSlug: string
  brand: string
  phoneId: string
  model: string
  config: string
  priceLkr: number
  shop: string
  usualLkr: number
  savingLkr: number
  percent: number
  lowest: boolean
}

export function toDealItems(deals: Deal[]): DealItem[] {
  return deals.map((d) => ({
    brandSlug: d.phone.brandSlug,
    brand: d.phone.brand,
    phoneId: d.phone.phoneId,
    model: d.phone.model,
    config: configLabel(d.phone),
    priceLkr: d.priceLkr,
    shop: d.shop,
    usualLkr: d.usualLkr,
    savingLkr: d.savingLkr,
    percent: d.percent,
    lowest: d.lowest,
  }))
}

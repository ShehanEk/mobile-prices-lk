import { BLUE, BrandTile, Capsule, OG_SIZE, ogImage } from '@/lib/og'
import { TRACKED_SHOPS } from '@/lib/site'
import { BRANDS } from '@/normalize/phone'

/** The share image for the home page, and for any page without its own. */

export const alt = 'MobilePrices.lk: find the cheapest place to buy a phone in Sri Lanka'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return ogImage({
    body: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', fontWeight: 700, fontSize: 76, lineHeight: 1, letterSpacing: '-0.045em' }}>
          <span>Find the cheapest place</span>
          <span style={{ display: 'flex' }}>
            to buy your&nbsp;<span style={{ color: BLUE }}>next phone</span>
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {BRANDS.slice(0, 8).map((b) => (
            <BrandTile key={b} brand={b} fontSize={26} />
          ))}
        </div>
      </div>
    ),
    footer: <Capsule>{`${TRACKED_SHOPS.length} Sri Lankan shops compared side by side`}</Capsule>,
  })
}

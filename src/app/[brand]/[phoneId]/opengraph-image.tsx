import { DISPLAY, INK, LABEL, MUTED, BLUE, OG_SIZE, TINT_BEST, TINT_COMPANY, ogImage } from '@/lib/og'
import { configLabel, rupees, type Offer } from '@/lib/prices'
import { findPhone } from '@/queries/phones'

/**
 * The share image for a phone page: both headline prices.
 *
 * Drawn on first request rather than at build: only shared pages are ever
 * fetched, and prerendering an image per phone would slow every deploy.
 */

export const revalidate = 1800
export const alt = 'Phone prices in Sri Lanka, with and without company warranty'
export const size = OG_SIZE
export const contentType = 'image/png'

export function generateStaticParams() {
  return []
}

function Headline({ title, offer, tint }: { title: string; offer: Offer | null; tint: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, padding: '24px 28px', borderRadius: 28, background: tint }}>
      <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK }}>{title}</span>
      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 64, lineHeight: 1.05, letterSpacing: '-0.04em', color: offer ? INK : LABEL }}>
        {offer ? rupees(offer.priceLkr) : 'None yet'}
      </span>
      <span style={{ fontSize: 24, color: MUTED }}>{offer ? offer.shop : 'No current price'}</span>
    </div>
  )
}

export default async function Image({ params }: { params: Promise<{ brand: string; phoneId: string }> }) {
  const { brand, phoneId } = await params
  const phone = await findPhone(brand, phoneId)
  if (!phone) return new Response('Not found', { status: 404 })

  return ogImage({
    body: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 26, fontWeight: 600, color: BLUE }}>{phone.brand}</span>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: phone.model.length > 22 ? 60 : 76, lineHeight: 0.95, letterSpacing: '-0.045em' }}>
            {phone.model}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <Headline title="Cheapest overall" offer={phone.overall} tint={TINT_BEST} />
          <Headline title="With company warranty" offer={phone.company} tint={TINT_COMPANY} />
        </div>
      </div>
    ),
    footer: <span>{`${configLabel(phone)} · ${phone.shops} ${phone.shops === 1 ? 'shop' : 'shops'} compared`}</span>,
  })
}

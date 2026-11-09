import { BEST_INK, BLUE, COMPANY_INK, Capsule, Dot, GLASS, GREEN, INK, LABEL, MUTED, OG_SIZE, ogImage } from '@/lib/og'
import { configLabel, rupees, type Offer } from '@/lib/prices'
import { phoneName } from '@/lib/site'
import { findPhone } from '@/queries/phones'

/**
 * The share image for a phone page: both headline prices.
 *
 * Drawn on first request rather than at build: only shared pages are ever
 * fetched, and prerendering an image per phone would slow every deploy.
 */

export const revalidate = false
export const alt = 'Phone prices in Sri Lanka, with and without company warranty'
export const size = OG_SIZE
export const contentType = 'image/png'

export function generateStaticParams() {
  return []
}

function Headline({ title, offer, ink, dot }: { title: string; offer: Offer | null; ink: string; dot: string }) {
  return (
    <div style={{ ...GLASS, display: 'flex', flexDirection: 'column', gap: 8, flex: 1, padding: '26px 30px', borderRadius: 32 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: ink }}>
        <Dot color={dot} />
        {title}
      </span>
      <span style={{ fontWeight: 700, fontSize: 64, lineHeight: 1.05, letterSpacing: '-0.04em', color: offer ? INK : LABEL }}>
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
  const name = phoneName(phone)

  return ogImage({
    body: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        <span style={{ fontWeight: 700, fontSize: name.length > 22 ? 60 : 76, lineHeight: 0.95, letterSpacing: '-0.045em' }}>
          {name}
        </span>
        <div style={{ display: 'flex', gap: 20 }}>
          <Headline title="Cheapest overall" offer={phone.overall} ink={BEST_INK} dot={GREEN} />
          <Headline title="With company warranty" offer={phone.company} ink={COMPANY_INK} dot={BLUE} />
        </div>
      </div>
    ),
    footer: (
      <>
        <Capsule strong>{configLabel(phone)}</Capsule>
        <Capsule>{`${phone.shops} ${phone.shops === 1 ? 'shop' : 'shops'} compared`}</Capsule>
      </>
    ),
  })
}

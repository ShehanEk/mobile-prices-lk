import { BLUE, BrandTile, DISPLAY, LABEL, OG_SIZE, ogImage } from '@/lib/og'
import { rupees } from '@/lib/prices'
import { BRAND_SLUGS, TRACKED_SHOPS, brandFromSlug } from '@/lib/site'
import { loadBrand, loadDirectory } from '@/queries/phones'

/** The share image for a brand page: how many are in stock, and from what price. */

export const revalidate = 1800
export const alt = 'Phone prices in Sri Lanka, compared across local shops'
export const size = OG_SIZE
export const contentType = 'image/png'

export async function generateStaticParams() {
  const directory = await loadDirectory()
  return BRAND_SLUGS.filter((s) => directory[s].length > 0).map((brand) => ({ brand }))
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '22px 28px', borderRadius: 24, background: '#F2F4F9' }}>
      <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: LABEL }}>{label}</span>
      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 46, letterSpacing: '-0.03em', color }}>{value}</span>
    </div>
  )
}

export default async function Image({ params }: { params: Promise<{ brand: string }> }) {
  const slug = (await params).brand
  const brand = brandFromSlug(slug)
  if (!brand) return new Response('Not found', { status: 404 })
  const inStock = (await loadBrand(slug)).filter((p) => p.overall?.inStock)
  const from = inStock.length ? Math.min(...inStock.map((p) => p.overall!.priceLkr)) : null

  return ogImage({
    body: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <BrandTile brand={brand} fontSize={44} />
          <div style={{ display: 'flex', flexDirection: 'column', fontFamily: DISPLAY, fontWeight: 700, fontSize: 60, lineHeight: 1, letterSpacing: '-0.04em' }}>
            <span>phone prices</span>
            <span>in Sri Lanka</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <Stat label="In stock now" value={String(inStock.length)} />
          {from !== null ? <Stat label="From" value={rupees(from)} color={BLUE} /> : null}
          <Stat label="Compared" value={`${TRACKED_SHOPS.length} shops`} />
        </div>
      </div>
    ),
    footer: <span>{`Every ${brand} price, company or shop warranty labelled`}</span>,
  })
}

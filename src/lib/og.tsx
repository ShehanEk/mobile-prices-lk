import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CSSProperties, ReactNode } from 'react'

import { ImageResponse } from 'next/og'

import { brandStyle } from '@/lib/site'

/**
 * The share images: what WhatsApp, Facebook and Google show for a link.
 * Liquid Glass, light only (decisions, 2026-11-10 "Share images").
 *
 * Drawn by `next/og`, which reads flexbox and a subset of CSS and takes only
 * ttf, otf or woff fonts, so it can't use the woff2 files `next/font` serves.
 * The fonts in `assets/fonts` are the site's own faces (OFL, licences beside
 * them). There is no backdrop blur here, so the glass is a white gradient with
 * a bright edge and a soft shadow, over the site's colour glow.
 */

export const OG_SIZE = { width: 1200, height: 630 }

export const font = (file: string) => readFile(join(process.cwd(), 'assets/fonts', file))

const fonts = Promise.all([
  font('inter-latin-400-normal.woff'),
  font('inter-latin-600-normal.woff'),
  font('inter-latin-700-normal.woff'),
]).then(([regular, semibold, bold]) => [
  { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
  { name: 'Inter', data: semibold, weight: 600 as const, style: 'normal' as const },
  { name: 'Inter', data: bold, weight: 700 as const, style: 'normal' as const },
])

export const INK = '#1A1F2B'
export const MUTED = '#545B69'
export const LABEL = '#646B79'
export const BLUE = '#3467D7'
export const GREEN = '#3DBA6E'
export const BEST_INK = '#1E7A55'
export const COMPANY_INK = '#3B55C9'

const EDGE = '1.5px solid rgba(255,255,255,0.95)'
const SHADOW = '0 14px 40px -18px rgba(30,45,90,0.35)'

/** Frosted glass, faked: a white gradient, a bright edge and a soft shadow. */
export const GLASS: CSSProperties = {
  backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,255,255,0.56))',
  border: EDGE,
  boxShadow: SHADOW,
}

/** A small glass capsule: a footer fact or the header's "checked" label. */
export function Capsule({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <div
      style={{
        ...GLASS,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 52,
        padding: '0 22px',
        borderRadius: 26,
        fontSize: 22,
        fontWeight: 600,
        color: strong ? INK : MUTED,
      }}
    >
      {children}
    </div>
  )
}

export const Dot = ({ color }: { color: string }) => (
  <div style={{ display: 'flex', width: 10, height: 10, borderRadius: 5, background: color }} />
)

/** A brand as the home page shows it: its name on its tint, never a logo. */
export function BrandTile({ brand, fontSize }: { brand: string; fontSize: number }) {
  const { tint, ink } = brandStyle(brand)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: fontSize * 2.1,
        padding: `0 ${fontSize * 0.9}px`,
        borderRadius: fontSize * 1.05,
        background: tint,
        color: ink,
        border: EDGE,
        fontWeight: 700,
        fontSize,
        letterSpacing: '-0.03em',
      }}
    >
      {brand}
    </div>
  )
}

function Wordmark() {
  return (
    <div style={{ ...GLASS, display: 'flex', alignItems: 'center', gap: 12, height: 64, padding: '0 26px 0 20px', borderRadius: 32 }}>
      <div style={{ display: 'flex', width: 24, height: 38, padding: 4, borderRadius: 8, background: INK }}>
        <div style={{ display: 'flex', flex: 1, borderRadius: 4, background: GREEN }} />
      </div>
      <div style={{ display: 'flex', fontWeight: 700, fontSize: 28, letterSpacing: '-0.03em' }}>
        mobileprices<span style={{ color: BLUE }}>.lk</span>
      </div>
    </div>
  )
}

/** The frame every share image shares: glass header row, body, and a row of footer capsules. */
export async function ogImage({ body, footer }: { body: ReactNode; footer: ReactNode }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 56px',
          backgroundColor: '#F2F3F7',
          backgroundImage: [
            'radial-gradient(circle at 8% 0%, rgba(52,103,215,0.26), rgba(52,103,215,0) 45%)',
            'radial-gradient(circle at 96% 12%, rgba(61,186,110,0.20), rgba(61,186,110,0) 40%)',
            'radial-gradient(circle at 60% 105%, rgba(224,166,58,0.20), rgba(224,166,58,0) 42%)',
          ].join(', '),
          color: INK,
          fontFamily: 'Inter',
          letterSpacing: '-0.01em',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Wordmark />
          <Capsule>
            <Dot color={GREEN} />
            Prices checked every night
          </Capsule>
        </div>
        {body}
        <div style={{ display: 'flex', gap: 12 }}>{footer}</div>
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts },
  )
}

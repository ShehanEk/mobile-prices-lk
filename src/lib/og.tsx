import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ReactNode } from 'react'

import { ImageResponse } from 'next/og'

import { brandStyle } from '@/lib/site'

/**
 * The share images: what WhatsApp, Facebook and Google show for a link.
 *
 * Drawn by `next/og`, which reads flexbox and a subset of CSS and takes only
 * ttf, otf or woff fonts, so it can't use the woff2 files `next/font` serves.
 * The fonts in `assets/fonts` are the site's own faces (OFL, licences beside
 * them). Colours are the canvas's hex values.
 */

export const OG_SIZE = { width: 1200, height: 630 }

const font = (file: string) => readFile(join(process.cwd(), 'assets/fonts', file))

const fonts = Promise.all([
  font('bricolage-grotesque-latin-700-normal.woff'),
  font('bricolage-grotesque-latin-800-normal.woff'),
  font('geist-latin-400-normal.woff'),
  font('geist-latin-600-normal.woff'),
]).then(([bold, extrabold, regular, semibold]) => [
  { name: 'Bricolage Grotesque', data: bold, weight: 700 as const, style: 'normal' as const },
  { name: 'Bricolage Grotesque', data: extrabold, weight: 800 as const, style: 'normal' as const },
  { name: 'Geist', data: regular, weight: 400 as const, style: 'normal' as const },
  { name: 'Geist', data: semibold, weight: 600 as const, style: 'normal' as const },
])

export const INK = '#1A1F2B'
export const MUTED = '#586070'
export const LABEL = '#69707F'
export const BLUE = '#3467D7'
export const DISPLAY = 'Bricolage Grotesque'
export const TINT_BEST = '#E3F5EC'
export const TINT_COMPANY = '#E9EEFF'

/** A brand as the home page shows it: its name on its tint, never a logo. */
export function BrandTile({ brand, fontSize }: { brand: string; fontSize: number }) {
  const { tint, ink } = brandStyle(brand)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: `${fontSize * 0.55}px ${fontSize * 1.1}px`,
        borderRadius: fontSize * 0.8,
        background: tint,
        color: ink,
        fontFamily: DISPLAY,
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ display: 'flex', width: 30, height: 46, padding: 4, borderRadius: 9, background: INK }}>
        <div style={{ display: 'flex', flex: 1, borderRadius: 5, background: '#3DBA6E' }} />
      </div>
      <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: 32, letterSpacing: '-0.03em' }}>
        mobileprices<span style={{ color: BLUE }}>.lk</span>
      </div>
    </div>
  )
}

/** The frame every share image shares: wordmark row, body, and a ruled footer. */
export async function ogImage({ chip, body, footer }: { chip?: ReactNode; body: ReactNode; footer: ReactNode }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          backgroundColor: '#FFFFFF',
          color: INK,
          fontFamily: 'Geist',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Wordmark />
          {chip}
        </div>
        {body}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 26,
            borderTop: '2px solid #E8EBF2',
            fontSize: 24,
            color: MUTED,
          }}
        >
          {footer}
          <span>Prices checked every night</span>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts },
  )
}

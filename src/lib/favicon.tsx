import { ImageResponse } from 'next/og'

import { DISPLAY, INK, font } from '@/lib/og'

/**
 * The favicon: a white Bricolage "m" on the ink tile, with a green dot like
 * the "." in ".lk". A favicon can't load web fonts, so it is drawn here by
 * `next/og`; `icon.tsx`, `apple-icon.tsx` and `scripts/make-favicon.ts` all
 * call this. Every measure is a fraction of the tile, so one drawing serves
 * 16 px to 180 px.
 */

const GREEN = '#3DBA6E'

/** Glyph and dot placement as fractions of the tile, so the "m" and dot together sit centred with equal side margins. */
const M_SIZE = 0.7
const M_LEFT = 0.0487
const M_TOP = 0.1061
const DOT_SIZE = 0.18
const DOT_LEFT = 0.7265
const DOT_TOP = 0.5095

const m = font('bricolage-grotesque-latin-800-normal.woff')

export async function faviconImage(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: size * (7 / 32),
          background: INK,
        }}
      >
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: size * M_LEFT,
            top: size * M_TOP,
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: size * M_SIZE,
            lineHeight: 1,
            color: '#FFFFFF',
          }}
        >
          m
        </div>
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: size * DOT_LEFT,
            top: size * DOT_TOP,
            width: size * DOT_SIZE,
            height: size * DOT_SIZE,
            borderRadius: size,
            background: GREEN,
          }}
        />
      </div>
    ),
    { width: size, height: size, fonts: [{ name: DISPLAY, data: await m, weight: 800, style: 'normal' }] },
  )
}

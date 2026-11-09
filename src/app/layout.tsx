import type { Metadata, Viewport } from 'next'
import { ViewTransition, type ReactNode } from 'react'
import { Inter } from 'next/font/google'
import './globals.css'

import { SITE_NAME, SITE_URL } from '@/lib/site'
import { Analytics } from './components/Analytics'

/**
 * The system face leads (San Francisco on Apple devices, per the Liquid Glass
 * design); Inter stands in elsewhere. See --font-sans in globals.css.
 */
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

/** Pages stay cached until /api/revalidate clears `catalog`, after GitHub's nightly normalize run. */
export const revalidate = false

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — phone prices in Sri Lanka`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Compare phone prices across Sri Lankan shops. Every price says whether it comes with company warranty or shop warranty. Updated every night.',
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  openGraph: { siteName: SITE_NAME, locale: 'en_LK', type: 'website', url: SITE_URL },
  twitter: { card: 'summary_large_image' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  category: 'shopping',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f3f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0c10' },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-LK" className={`${inter.variable} h-full`}>
      <body className="relative min-h-full font-sans antialiased">
        <div aria-hidden className="glow" />
        {/* Every navigation crossfades the page; named parts morph (globals.css, "Page transitions"). */}
        <ViewTransition default="page">{children}</ViewTransition>
        <Analytics />
      </body>
    </html>
  )
}

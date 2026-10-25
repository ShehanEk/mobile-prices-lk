import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Bricolage_Grotesque, Geist } from 'next/font/google'
import './globals.css'

import { SITE_NAME, SITE_URL } from '@/lib/site'
import { Analytics } from './components/Analytics'

/** Headings, prices and the wordmark. Variable, with the optical-size axis the canvas uses. */
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
  axes: ['opsz'],
})

/** Running text. */
const sans = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' })

/** Every page refreshes at most every 30 minutes, or when /api/revalidate clears `catalog`. */
export const revalidate = 1800

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

export const viewport: Viewport = { themeColor: '#ffffff' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-LK" className={`${display.variable} ${sans.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}

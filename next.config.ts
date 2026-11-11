import type { NextConfig } from 'next'

/**
 * Sent on every response. There is no Content-Security-Policy: Next needs a
 * per-request nonce for its inline scripts, and reading one makes every page
 * render on demand, which would undo prerendering the phone pages.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // No one has a reason to put the site in a frame; this stops clickjacking.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Shops still see visits came from us, but never which page or search.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
]

/**
 * Production on a *.vercel.app host moves to the real domain, so search
 * engines see one copy of the site. Only once NEXT_PUBLIC_SITE_URL is set, and
 * never on preview deployments, which live on vercel.app hosts too.
 */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
const toSiteDomain =
  SITE_URL && process.env.VERCEL_ENV === 'production'
    ? [{ source: '/:path*', has: [{ type: 'host' as const, value: '.*\\.vercel\\.app' }], destination: `${SITE_URL}/:path*`, permanent: true }]
    : []

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  async redirects() {
    return toSiteDomain
  },
}

export default nextConfig

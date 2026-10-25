import Script from 'next/script'

/**
 * Google Analytics 4, on the production deployment only: VERCEL_ENV is
 * "production" there and unset locally or "preview" on preview deployments,
 * so neither is ever counted.
 *
 * PCPrice.lk's Measurement ID is not reused: this site gets its own GA4
 * property in phase 4, set as NEXT_PUBLIC_GA_ID. Until then nothing loads.
 */
const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || ''

// A malformed ID is ignored rather than interpolated into the inline script.
const GA_ID =
  process.env.VERCEL_ENV === 'production' && /^G-[A-Z0-9]+$/.test(MEASUREMENT_ID)
    ? MEASUREMENT_ID
    : null

export function Analytics() {
  if (!GA_ID) return null
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
    </>
  )
}

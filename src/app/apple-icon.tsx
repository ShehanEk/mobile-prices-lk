import { faviconImage } from '@/lib/favicon'

/** The home-screen icon iOS asks for, served at /apple-icon. */

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return faviconImage(size.width)
}

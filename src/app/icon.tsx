import { faviconImage } from '@/lib/favicon'

/** The browser-tab icon, served at /icon. The browser scales it to 16 px. */

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return faviconImage(size.width)
}

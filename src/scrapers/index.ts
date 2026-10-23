import { banana } from './banana'
import { celltronics } from './celltronics'
import { doctormobile } from './doctormobile'
import { geniusmobile } from './geniusmobile'
import { idealz } from './idealz'
import { lifemobile } from './lifemobile'
import type { Scraper } from './types'

export const scrapers: Record<string, Scraper> = {
  'lifemobile.lk': lifemobile,
  'celltronics.lk': celltronics,
  'geniusmobile.lk': geniusmobile,
  'banana.lk': banana,
  'idealz.lk': idealz,
  'doctormobile.lk': doctormobile,
}

export const shopKeys = Object.keys(scrapers)

export function getScraper(shop: string): Scraper {
  const scraper = scrapers[shop]
  if (!scraper) {
    throw new Error(`Unknown shop "${shop}". Known: ${shopKeys.join(', ')}`)
  }
  return scraper
}

export * from './types'

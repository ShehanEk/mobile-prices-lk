import type { Scraper } from './types'

export const scrapers: Record<string, Scraper> = {}

export const shopKeys = Object.keys(scrapers)

export function getScraper(shop: string): Scraper {
  const scraper = scrapers[shop]
  if (!scraper) {
    throw new Error(`Unknown shop "${shop}". Known: ${shopKeys.join(', ')}`)
  }
  return scraper
}

export * from './types'

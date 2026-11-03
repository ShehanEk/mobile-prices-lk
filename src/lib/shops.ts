import type { TRACKED_SHOPS } from './site'

/**
 * What the home page says about each shop. Branches come from the shop's own
 * site, or its Google listing where the site lists none. Review notes are
 * refreshed by hand every 3 months: see docs/shop-reviews.md for the steps and
 * the rules notes must follow.
 *
 * This holds our own summary and a count, never review text.
 */
export type ShopNote = {
  /** Warranty covers company versus shop terms; Genuine phones covers official versus grey imports. */
  attribute: 'Warranty' | 'Genuine phones' | 'Customer care' | 'Delivery' | 'Price and stock'
  /** `check` is a prompt to the buyer, never a rating of the shop. */
  tone: 'good' | 'check'
  text: string
}

export type ShopProfile = {
  website: string
  branches: { name: string; mapsUrl: string }[]
  reviewsUrl: string
  /** Null when there are too few recent reviews to summarise. */
  reviews: {
    reviewedOn: string
    /** As shown on the card, e.g. "Aug–Oct 2026". */
    period: string
    count: number
    notes: ShopNote[]
  } | null
}

const maps = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`

export const SHOP_PROFILES: Record<(typeof TRACKED_SHOPS)[number], ShopProfile> = {
  'lifemobile.lk': {
    website: 'https://lifemobile.lk',
    branches: [{ name: 'Liberty Plaza, Colombo 03', mapsUrl: maps('Life Mobile Lanka, Liberty Plaza, Colombo 03') }],
    reviewsUrl: maps('Life Mobile Lanka, Liberty Plaza, Colombo 03'),
    reviews: {
      reviewedOn: '2026-11-03',
      period: 'Aug–Oct 2026',
      count: 18,
      notes: [{ attribute: 'Customer care', tone: 'good', text: 'Staff often described as friendly and helpful.' }],
    },
  },
  'celltronics.lk': {
    website: 'https://celltronics.lk',
    branches: [{ name: 'R. A. De Mel Mawatha, Colombo 03', mapsUrl: maps('Celltronics, 351 R. A. De Mel Mawatha, Colombo 03') }],
    reviewsUrl: maps('Celltronics, 351 R. A. De Mel Mawatha, Colombo 03'),
    reviews: {
      reviewedOn: '2026-11-03',
      period: 'Aug–Oct 2026',
      count: 39,
      notes: [
        { attribute: 'Warranty', tone: 'check', text: 'Check what the warranty covers before buying.' },
        { attribute: 'Genuine phones', tone: 'good', text: 'Buyers mention genuine products.' },
        { attribute: 'Customer care', tone: 'good', text: 'Staff often praised for patient help, in store and on WhatsApp.' },
        { attribute: 'Delivery', tone: 'good', text: 'Buyers report fast delivery, some within a day.' },
        { attribute: 'Price and stock', tone: 'check', text: 'Compare prices, and confirm stock before you visit.' },
      ],
    },
  },
  'geniusmobile.lk': {
    website: 'https://geniusmobile.lk',
    branches: [{ name: 'Liberty Plaza, Colombo 03', mapsUrl: maps('Genius Mobile, G-57 Liberty Plaza, Colombo 03') }],
    reviewsUrl: maps('Genius Mobile, G-57 Liberty Plaza, Colombo 03'),
    reviews: {
      reviewedOn: '2026-11-03',
      period: 'Aug–Oct 2026',
      count: 16,
      notes: [
        { attribute: 'Genuine phones', tone: 'good', text: 'Buyers mention genuine products.' },
        { attribute: 'Customer care', tone: 'good', text: 'Staff often described as friendly and professional.' },
      ],
    },
  },
  'banana.lk': {
    website: 'https://banana.lk',
    branches: [{ name: 'Liberty Plaza, Colombo 03', mapsUrl: maps('Banana.lk, 250/1 Liberty Plaza, Colombo 03') }],
    reviewsUrl: maps('Banana.lk, 250/1 Liberty Plaza, Colombo 03'),
    reviews: {
      reviewedOn: '2026-11-03',
      period: 'Aug–Oct 2026',
      count: 30,
      notes: [
        { attribute: 'Genuine phones', tone: 'good', text: 'Buyers mention genuine phones in good condition.' },
        { attribute: 'Customer care', tone: 'check', text: 'Staff often praised. Some recent visits went less well.' },
        { attribute: 'Price and stock', tone: 'good', text: 'Many buyers call the prices fair, and some mention good trade-in deals.' },
      ],
    },
  },
  'idealz.lk': {
    website: 'https://idealz.lk',
    branches: [
      { name: 'Liberty Plaza, Colombo 03', mapsUrl: maps('iDealz Lanka, Liberty Plaza, Colombo 03') },
      { name: 'Marino Mall, Colombo 03', mapsUrl: maps('iDealz Lanka, Marino Mall, Colombo 03') },
      { name: 'iDealz Prime, Colombo 04', mapsUrl: maps('iDealz Prime, 86 Galle Road, Colombo 04') },
    ],
    reviewsUrl: maps('iDealz Lanka, Liberty Plaza, Colombo 03'),
    reviews: {
      reviewedOn: '2026-11-03',
      period: 'Aug–Oct 2026',
      count: 18,
      notes: [
        { attribute: 'Genuine phones', tone: 'check', text: 'Check the box seal and warranty before paying.' },
        { attribute: 'Customer care', tone: 'good', text: 'Staff described as patient and helpful.' },
      ],
    },
  },
  'doctormobile.lk': {
    website: 'https://doctormobile.lk',
    branches: [
      { name: 'Bambalapitiya, Colombo 04', mapsUrl: maps('Doctor Mobile, Fortune Arcade, Bambalapitiya, Colombo 04') },
      { name: 'Liberty Plaza, Colombo 03', mapsUrl: maps('Doctor Mobile, 43N Liberty Plaza, Colombo 03') },
    ],
    reviewsUrl: maps('Doctor Mobile, Fortune Arcade, Bambalapitiya, Colombo 04'),
    reviews: {
      reviewedOn: '2026-11-03',
      period: 'Aug–Oct 2026',
      count: 18,
      notes: [{ attribute: 'Customer care', tone: 'check', text: 'Staff described as friendly. Ask what repairs and returns cover.' }],
    },
  },
}

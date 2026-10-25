import { configLabel, type PhoneSummary } from '@/lib/prices'

/**
 * Phone search over the directory the pages already load. ~1,300 phones is
 * small enough that a scan beats running a search index.
 *
 * Matching is by word, not substring (PCPrice.lk's lesson): each query word
 * must *start* a word of the name, and a short number must *be* one, so "7"
 * finds the 7 of "Galaxy S7", never the start of "75". Runs of two or three
 * words are also tried joined, so "s26ultra" and "256gb" still match. A name
 * containing the whole query as typed ranks first.
 */
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

function matchesWord(nameWords: string[], q: string): boolean {
  const exact = /^\d{1,2}$/.test(q)
  for (let i = 0; i < nameWords.length; i++) {
    let joined = ''
    for (let len = 0; len < 3 && i + len < nameWords.length; len++) {
      joined += nameWords[i + len]
      if (exact ? joined === q : joined.startsWith(q)) return true
    }
  }
  return false
}

export function searchPhones(directory: Record<string, PhoneSummary[]>, query: string): PhoneSummary[] {
  const queryWords = words(query)
  if (queryWords.length === 0) return []
  const phrase = squash(query)

  const hits: { phone: PhoneSummary; phrase: boolean }[] = []
  for (const phones of Object.values(directory)) {
    for (const phone of phones) {
      const nameWords = words(`${phone.brand} ${phone.model} ${configLabel(phone)}`)
      if (queryWords.every((q) => matchesWord(nameWords, q))) {
        hits.push({ phone, phrase: squash(`${phone.brand} ${phone.model}`).includes(phrase) })
      }
    }
  }

  // Then buyable first, then cheapest: the question being asked is where to buy.
  const price = (p: PhoneSummary) => p.overall?.priceLkr ?? Number.MAX_SAFE_INTEGER
  return hits
    .sort(
      (a, b) =>
        Number(b.phrase) - Number(a.phrase) ||
        Number(b.phone.inStockShops > 0) - Number(a.phone.inStockShops > 0) ||
        price(a.phone) - price(b.phone),
    )
    .map((h) => h.phone)
}

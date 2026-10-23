import type { Warranty } from '@/db/schema'

/**
 * Warranty wording → class, by rule. Order matters: a row naming AppleCare or
 * a company warranty for the first year is that, even when a shop adds its own
 * software warranty for the second ("1st Year Company Warranty 2nd Year
 * Celltronics Software Warranty").
 *
 * Null means unclear: the caller hands it to the model, which picks a class or
 * declines. A bare duration ("2 Years Warranty") is not unclear, it is
 * unstated: nothing in it says who backs the phone.
 */
const APPLE = /apple\s*care|apple\s+warranty/i
const COMPANY =
  /company|\bagent\b|authori[sz]ed|\bofficial\b|\b(softlogic|abans|genxt|gnext|singer|dialog)\b/i
// Phone brands name the maker, so they only count once no shop wording is present.
const BRAND =
  /\b(samsung|huawei|oppo|vivo|honor|xiaomi|realme|tecno|infinix|nokia|motorola|oneplus|google|zte)\b/i
const SHOP = /software|hardware|shop\s+warranty/i
const BARE_DURATION =
  /^\s*(?:\d+|one|two|three|six|twelve|eighteen)(?:st|nd)?\s*-?\s*(?:years?|months?)\s*(?:warranty)?\s*$/i

export function classifyWarranty(text: string | null | undefined): Warranty | null {
  const t = (text ?? '').trim()
  if (!t) return 'unstated'
  if (APPLE.test(t)) return 'apple'
  if (COMPANY.test(t)) return 'company'
  if (SHOP.test(t)) return 'shop'
  if (BRAND.test(t)) return 'company'
  if (BARE_DURATION.test(t)) return 'unstated'
  return null
}

/**
 * Phrases some shops put in the title instead of a field. The optional lead
 * word must be a whole word starting with a letter, so a size ("256GB Company Warranty") is not
 * taken as part of the phrase.
 */
const TITLE_PHRASE = /(apple\s*care|(?:\b[a-z]\w*\s+)?company\s+warranty|genxt\s+warranty)/i

/**
 * The warranty a row was sold with: the chosen option first (celltronics,
 * lifemobile, doctormobile price per warranty), then the scraper's raw text,
 * then a phrase in the title (geniusmobile, celltronics).
 */
export function warrantyOf(
  rawTitle: string,
  payload: { variant?: Record<string, string>; warrantyText?: string | null },
): { text: string | null; warranty: Warranty | null } {
  const chosen = Object.entries(payload.variant ?? {}).find(([k]) => /warrant/i.test(k))?.[1]?.trim()
  const text = chosen || payload.warrantyText || rawTitle.match(TITLE_PHRASE)?.[1]?.replace(/^with\s+/i, '') || null
  return { text, warranty: classifyWarranty(text) }
}

import type { TitleCandidate } from '@/normalize/ai'
import { parseMemory } from '@/normalize/phone'
import type { PhoneDrop, PhoneIdentity } from '@/normalize/phone'

/**
 * Pure decisions around the model fallback, kept apart from the API call so
 * they can be tested without a network: which titles go to the model, which
 * phones it may choose from, and when a stored answer is reused.
 */

/**
 * A brand or family word anywhere in the title. Wider than extractPhone's
 * leading-word check on purpose: "Brand New Galaxy A57" is dropped as `brand`
 * by the rules but is plainly a Samsung.
 */
const BRAND_ANYWHERE: [RegExp, string][] = [
  [/\b(?:apple|iphone)\b/i, 'Apple'],
  [/\b(?:samsung|galaxy)\b/i, 'Samsung'],
  [/\b(?:xiaomi?|redmi|poco)\b/i, 'Xiaomi'],
  [/\bhonou?r\b/i, 'Honor'],
  [/\bhuawei\b/i, 'Huawei'],
  [/\boppo\b/i, 'OPPO'],
  [/\bvivo\b/i, 'vivo'],
  [/\brealme\b/i, 'realme'],
  [/\boneplus\b/i, 'OnePlus'],
  [/\b(?:google|pixel)\b/i, 'Google'],
  [/\b(?:motorola|moto)\b/i, 'Motorola'],
  [/\b(?:nothing|cmf)\b/i, 'Nothing'],
  [/\btecno\b/i, 'Tecno'],
  [/\binfinix\b/i, 'Infinix'],
  [/\b(?:zte|nubia)\b/i, 'ZTE'],
  [/\b(?:nokia|hmd)\b/i, 'Nokia'],
]

export function brandsIn(title: string): string[] {
  return BRAND_ANYWHERE.filter(([re]) => re.test(title)).map(([, brand]) => brand)
}

/**
 * Ruling 1. Only `no-model` drops, and `brand` drops that still name an
 * in-scope brand or family, and only when the title states storage. Used,
 * not-a-phone, no-storage and no-ram rows are never sent: the rules were sure.
 */
export function titleEligible(drop: PhoneDrop['drop'], title: string): boolean {
  if (drop !== 'no-model' && drop !== 'brand') return false
  if (parseMemory(title).storageGb === null) return false
  return drop === 'no-model' || brandsIn(title).length > 0
}

export const MAX_CANDIDATES = 150

/**
 * Ruling 2. Phones the model may choose from: same storage; same RAM when the
 * title states it (Apple phones carry no RAM, so a stated RAM does not rule
 * them out); same brand when a brand or family word is present. Sorted by id
 * so the prompt, and so the answer, is stable across runs.
 */
export function selectCandidates(
  title: string,
  pool: Iterable<PhoneIdentity>,
  cap = MAX_CANDIDATES,
): TitleCandidate[] {
  const { ramGb, storageGb } = parseMemory(title)
  if (storageGb === null) return []
  const brands = brandsIn(title)
  const out: TitleCandidate[] = []
  for (const p of pool) {
    if (p.storageGb !== storageGb) continue
    if (ramGb !== null && p.ramGb !== null && p.ramGb !== ramGb) continue
    if (brands.length && !brands.includes(p.brand)) continue
    out.push({ phoneId: p.phoneId, brand: p.brand, model: p.model, ramGb: p.ramGb, storageGb: p.storageGb })
  }
  return out.sort((a, b) => a.phoneId.localeCompare(b.phoneId)).slice(0, cap)
}

/** Ruling 3. How long a decline stands before the text is asked about again. */
export const DECLINE_TTL_MS = 7 * 86_400_000

/**
 * Ruling 3. An accepted (non-null, high-confidence) answer is reused forever;
 * a decline, including a low-confidence answer, only for 7 days, so a phone
 * added to the catalogue since can still be matched.
 */
export function cacheUse(
  decision: { answer: string | null; confidence: string; decidedAt: Date } | undefined,
  now: Date,
): 'reuse' | 'ask' {
  if (!decision) return 'ask'
  if (decision.answer !== null && decision.confidence === 'high') return 'reuse'
  return now.getTime() - decision.decidedAt.getTime() < DECLINE_TTL_MS ? 'reuse' : 'ask'
}

/** Claude Haiku 5.5: $0.10 per 1M input tokens, $0.50 per 1M output tokens. */
export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * 0.1 + outputTokens * 0.5) / 1_000_000
}

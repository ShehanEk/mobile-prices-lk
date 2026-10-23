import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'

import type { Warranty } from '@/db/schema'

/**
 * The one place a model is used in this codebase: titles and warranty wording
 * the rules could not settle, at normalize time. Adapted from PCPrice.lk.
 *
 * Two rules shape these prompts:
 *
 *  - The model only ever *chooses among candidates we supply*, never recalls a
 *    specification from memory. Every fact it sees is one we read off a page.
 *  - It runs at normalize time, never at query time, and every answer is
 *    stored in `model_decisions`, so each text costs one call ever.
 *
 * Declining is a first-class answer. An unmatched row is a gap in the data; a
 * wrongly matched row is a wrong price shown to a real buyer.
 */

export const MODEL = 'claude-haiku-5-5'

export type TitleCandidate = {
  phoneId: string
  brand: string
  model: string
  ramGb: number | null
  storageGb: number
}

export type Usage = { inputTokens: number; outputTokens: number }

export type AiAnswer<T> = {
  answer: T | null
  confidence: 'high' | 'low'
  reason: string
  /** Tokens billed for this call; zero when no call was made. */
  usage: Usage
  /** The call itself failed (network, auth, overload): not a decline, so not stored. */
  failed?: true
}

let client: Anthropic | null = null

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
    client = new Anthropic({ apiKey })
  }
  return client
}

const NO_USAGE: Usage = { inputTokens: 0, outputTokens: 0 }

const usageOf = (r: { usage: { input_tokens: number; output_tokens: number } }): Usage => ({
  inputTokens: r.usage.input_tokens,
  outputTokens: r.usage.output_tokens,
})

const failureReason = (err: unknown) =>
  `ai call failed: ${err instanceof Error ? err.message : String(err)}`

const TITLE_SYSTEM = `You match a Sri Lankan shop's phone listing title to a canonical phone.

You will be given a listing title and a list of candidate phones. Choose the
candidate that is the SAME phone, or decline.

Rules:
- Only choose a candidate from the supplied list. Never invent a phone_id.
- Judge only from the title text given. Do not use remembered specifications.
- The same phone means the same brand, the same model line and the same model
  suffix, and the same RAM and storage.
- A suffix is part of the phone's name, not decoration. Pro, Pro Max, Plus,
  Ultra, FE, Lite, e, s and a each denote a different phone at a different
  price: "Galaxy S25 FE" is NOT "Galaxy S25". "iPhone 16e" is NOT "iPhone 16".
  "Redmi Note 15 Pro" is NOT "Redmi Note 15". "Galaxy A05s" is NOT "Galaxy A05".
- Different RAM or storage means a DIFFERENT phone: "8GB 256GB" is not
  "12GB 256GB".
- Colour, warranty wording, bundled gifts and 4G/5G wording do not make a
  different phone.
- Never settle for the nearest available candidate. If the exact phone is not
  in the list, return null even when something close to it is. "The closest
  match is X" is always the wrong answer — return null instead.
- If no candidate is clearly the same phone, return null. Declining is correct
  and expected — a wrong match shows a shopper the wrong price.`

const TitleAnswer = z.object({
  phone_id: z.string().nullable(),
  confidence: z.enum(['high', 'low']),
  reason: z.string(),
})

/**
 * Ask the model to pick a phone for a title the rules could not place.
 * Declines when the model does, when it names an id we did not offer, or when
 * anything goes wrong: this path must never fail a run.
 */
export async function matchTitle(
  rawTitle: string,
  candidates: TitleCandidate[],
): Promise<AiAnswer<string>> {
  if (candidates.length === 0) {
    return { answer: null, confidence: 'low', reason: 'no candidates supplied', usage: NO_USAGE }
  }
  try {
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: 'low', format: zodOutputFormat(TitleAnswer) },
      system: TITLE_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            `Listing title: ${rawTitle}`,
            '',
            'Candidates:',
            ...candidates.map(
              (c) => `- ${c.phoneId} | ${c.brand} ${c.model} | ${c.ramGb ?? '-'}GB RAM | ${c.storageGb}GB`,
            ),
          ].join('\n'),
        },
      ],
    })
    const usage = usageOf(response)
    const out = response.parsed_output
    if (response.stop_reason === 'refusal' || !out) {
      return { answer: null, confidence: 'low', reason: `no answer (${response.stop_reason})`, usage }
    }
    // Guard against a hallucinated id: only accept something we offered.
    const chosen = out.phone_id && candidates.some((c) => c.phoneId === out.phone_id) ? out.phone_id : null
    const reason = out.phone_id && !chosen ? `not a candidate: ${out.phone_id} (${out.reason})` : out.reason
    return { answer: chosen, confidence: out.confidence, reason, usage }
  } catch (err) {
    return { answer: null, confidence: 'low', reason: failureReason(err), usage: NO_USAGE, failed: true }
  }
}

const WARRANTY_SYSTEM = `You classify the warranty wording a Sri Lankan phone shop attached to a listing.

Classes:
- company: the brand's official Sri Lankan agent or distributor backs the phone
  ("Softlogic warranty", "agent warranty", "1 year local warranty from the
  authorised distributor").
- shop: the shop backs it itself, often called a "software" or "hardware"
  warranty, or named after the shop.
- apple: AppleCare or Apple's own warranty.
- unstated: the text gives a warranty but nothing in it says who backs it.

Rules:
- Judge only from the text given. Do not use remembered facts about shops.
- If the text is not about a phone's warranty at all, return null.
- If you cannot tell between classes, return null or answer with low
  confidence. Declining is correct and expected.`

const WarrantyAnswer = z.object({
  warranty: z.enum(['company', 'shop', 'apple', 'unstated']).nullable(),
  confidence: z.enum(['high', 'low']),
  reason: z.string(),
})

/** Same contract as matchTitle: declines on anything unexpected, never throws. */
export async function classifyWarrantyText(text: string): Promise<AiAnswer<Warranty>> {
  try {
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: 'low', format: zodOutputFormat(WarrantyAnswer) },
      system: WARRANTY_SYSTEM,
      messages: [{ role: 'user', content: `Warranty text: ${text}` }],
    })
    const usage = usageOf(response)
    const out = response.parsed_output
    if (response.stop_reason === 'refusal' || !out) {
      return { answer: null, confidence: 'low', reason: `no answer (${response.stop_reason})`, usage }
    }
    return { answer: out.warranty, confidence: out.confidence, reason: out.reason, usage }
  } catch (err) {
    return { answer: null, confidence: 'low', reason: failureReason(err), usage: NO_USAGE, failed: true }
  }
}

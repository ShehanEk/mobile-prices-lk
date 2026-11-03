/**
 * Which YouTube videos count as a review of which phone. No network here.
 *
 * Wrong is worse than missing: a title must say "review" and name exactly one
 * of our models, so a phone with no clear match shows no reviews at all.
 */

/** The reviewers we trust, in the order they are preferred when a phone has more than three. */
export const CHANNELS = [
  { handle: 'mkbhd', name: 'MKBHD' },
  { handle: 'Mrwhosetheboss', name: 'Mrwhosetheboss' },
  { handle: 'Dave2D', name: 'Dave2D' },
  { handle: 'UnboxTherapy', name: 'Unbox Therapy' },
  { handle: 'techspurt', name: 'TechSpurt' },
  { handle: 'GSMArenaOfficial', name: 'GSMArena' },
  { handle: 'AndroidAuthority', name: 'Android Authority' },
]

export const MAX_REVIEWS = 3
/** Shorter than this is a Short or a teaser, not a review. */
export const MIN_SECONDS = 180

export type Model = { brand: string; model: string }

export type Candidate = Model & {
  videoId: string
  title: string
  channel: string
  publishedAt: string
}

/** Words that make a different phone: "Galaxy S26 FE" is not a "Galaxy S26". */
const VARIANTS = new Set(['pro', 'max', 'ultra', 'plus', 'fe', 'mini', 'lite', 'air', 'neo', 'edge', 'fold', 'flip', 'se', 'turbo', 'prime'])
const NETWORKS = new Set(['4g', '5g'])
/** Words in a title that mean it isn't a review of one phone: Shorts, comparisons and accessories. */
const NOT_A_REVIEW = new Set(['shorts', 'vs', 'versus', 'comparison', 'case', 'cases'])
/** Product lines that name the phone alone. Any other model needs its brand right before it: "14" is not a phone without "Xiaomi". */
const SELF_NAMED = new Set(['iphone', 'pixel', 'galaxy', 'redmi', 'poco', 'moto', 'hmd', 'nubia', 'nord', 'reno', 'camon', 'pova', 'cmf'])
/** A further model code: "HMD Fusion X1" is not an "HMD Fusion". Years and memory sizes don't count. */
const MODEL_CODE = /^(?!20\d\d$)(?!\d+gb$)[a-z]{0,2}\d+[a-z]?$/

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/one[ -]?plus/g, 'oneplus')
    .replaceAll('+', ' plus ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

function runsOf(haystack: string[], needle: string[]): number[] {
  const at: number[] = []
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    if (needle.every((t, j) => haystack[i + j] === t)) at.push(i)
  }
  return at
}

/**
 * The one model a video reviews, or null. The earliest in the title wins, since
 * rivals come later ("Magic V5 Review | Z Fold 7 Destroyed?"), then the one with
 * the most words. Sections after the first to say "review" are ignored, so
 * "Edge 70 Review | iPhone Air, Get In The Bin!" is not about an iPhone Air.
 */
export function matchModel<T extends Model>(title: string, models: T[]): T | null {
  if (tokens(title).some((w) => NOT_A_REVIEW.has(w))) return null

  const sections = title.split('|')
  const reviewAt = sections.findIndex((s) => tokens(s).includes('review'))
  if (reviewAt === -1) return null
  const t = tokens(sections.slice(0, reviewAt + 1).join(' '))

  const parsed = models.map((m) => {
    const words = tokens(m.model)
    const network = NETWORKS.has(words.at(-1) ?? '') ? (words.at(-1) as string) : null
    return { m, core: network ? words.slice(0, -1) : words, network }
  })
  const key = (core: string[]) => core.join(' ')

  const fits = parsed
    .flatMap(({ m, core, network }) => {
      const brand = tokens(m.brand)[0]
      const sold = (n: string | null) => parsed.some((p) => key(p.core) === key(core) && p.network === n)
      const at = runsOf(t, core).find((i) => {
        if (core[0] !== brand && !SELF_NAMED.has(core[0]) && t[i - 1] !== brand) return false
        const next = t[i + core.length]
        if (next !== undefined && NETWORKS.has(next)) return next === network || (network === null && !sold(next))
        if (next !== undefined && (VARIANTS.has(next) || MODEL_CODE.test(next))) return false
        // No network in the title: it means the plain model when one is sold, else this one.
        return network === null || !sold(null)
      })
      return at === undefined ? [] : [{ m, at, words: core.length }]
    })
    .sort((a, b) => a.at - b.at || b.words - a.words)

  return fits[0]?.m ?? null
}

/** Seconds in a YouTube duration such as PT1H2M3S. */
export function durationSeconds(iso: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso)
  if (!m) return 0
  const [d, h, min, s] = m.slice(1).map((v) => Number(v ?? 0))
  return d * 86400 + h * 3600 + min * 60 + s
}

/** For each model: the newest video per channel, in `channelOrder`, up to MAX_REVIEWS. */
export function chooseReviews(candidates: Candidate[], channelOrder: string[]): (Candidate & { position: number })[] {
  const byModel = new Map<string, Map<string, Candidate>>()
  for (const c of candidates) {
    const key = `${c.brand}\u0000${c.model}`
    const channels = byModel.get(key) ?? new Map<string, Candidate>()
    const seen = channels.get(c.channel)
    if (!seen || c.publishedAt > seen.publishedAt) channels.set(c.channel, c)
    byModel.set(key, channels)
  }
  return [...byModel.values()].flatMap((channels) =>
    channelOrder
      .flatMap((name) => channels.get(name) ?? [])
      .slice(0, MAX_REVIEWS)
      .map((c, position) => ({ ...c, position })),
  )
}

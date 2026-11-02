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

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replaceAll('+', ' plus ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

function indexOfRun(haystack: string[], needle: string[]): number {
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    if (needle.every((t, j) => haystack[i + j] === t)) return i
  }
  return -1
}

/** The one model a video reviews, or null. The model with the most words wins, so "S26 Ultra" beats "S26". */
export function matchModel<T extends Model>(title: string, models: T[]): T | null {
  const t = tokens(title)
  if (!t.includes('review') || t.includes('shorts') || t.includes('vs') || t.includes('versus') || t.includes('comparison')) return null

  const parsed = models.map((m) => {
    const words = tokens(m.model)
    const network = NETWORKS.has(words.at(-1) ?? '') ? (words.at(-1) as string) : null
    return { m, core: network ? words.slice(0, -1) : words, network }
  })
  const key = (core: string[]) => core.join(' ')

  const fits = parsed
    .filter(({ core, network }) => {
      const at = indexOfRun(t, core)
      if (at === -1) return false
      const next = t[at + core.length]
      if (next !== undefined && VARIANTS.has(next)) return false
      const sold = (n: string | null) => parsed.some((p) => key(p.core) === key(core) && p.network === n)
      if (next !== undefined && NETWORKS.has(next)) return next === network || (network === null && !sold(next))
      // No network in the title: it means the plain model when one is sold, else this one.
      return network === null || !sold(null)
    })
    .sort((a, b) => b.core.length - a.core.length)

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

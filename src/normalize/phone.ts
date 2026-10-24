/**
 * Deterministic phone identity from a listing title: brand + model + RAM +
 * storage, so the same phone at different shops shares one id.
 *
 * Wrong identity is the failure that matters. Too coarse and two phones share
 * a price; too fine and one phone's prices split. When the rules cannot tell,
 * the listing is dropped with a reason rather than guessed — the model
 * fallback (Task 5) sees only those.
 *
 * Every noise pattern is anchored to word edges: in PCPrice an unanchored
 * short pattern ate model names.
 */

export type PhoneIdentity = {
  phoneId: string
  brand: string
  model: string
  /** Null only for Apple, which does not sell iPhones by RAM. */
  ramGb: number | null
  storageGb: number
  esimOnly: boolean
}

export type PhoneDrop = {
  drop: 'not-a-phone' | 'brand' | 'no-storage' | 'no-ram' | 'used' | 'no-model'
}

/** The 16 in-scope brands, canonical spelling. */
export const BRANDS: readonly string[] = [
  'Apple', 'Samsung', 'Xiaomi', 'Honor', 'Huawei', 'OPPO', 'vivo', 'realme',
  'OnePlus', 'Google', 'Motorola', 'Nothing', 'Tecno', 'Infinix', 'ZTE', 'Nokia',
]

/**
 * Rule 8. Models sold in both a 4G and a 5G version as different phones: for
 * these the network stays in the model ("Galaxy A16 5G"). Everything else
 * drops it, so "Galaxy A57 5G" and "Galaxy A57" are one phone. Matched against
 * the model without its network token, exactly: "Redmi Note 13" is listed,
 * "Redmi Note 13 Pro" is not.
 */
const DUAL_NETWORK = [
  'galaxy a15', 'galaxy a16', 'galaxy a17', 'galaxy a05s', 'redmi note 13',
  'redmi 13c', 'redmi a5', 'realme note 60x', 'oppo a6x', 'infinix hot 60',
  // Ruling 5: the 2026-10-24 scrape lists each of these as both 4G and 5G, the
  // 5G one 10k–25k LKR dearer ("Xiaomi Redmi Note 15 4G/5G 8GB RAM 256GB").
  'redmi note 12 pro', 'redmi note 13 pro', 'redmi note 14', 'redmi note 14 pro',
  'redmi note 15', 'redmi 15', 'redmi 15c', 'galaxy a07', 'galaxy a14',
  'galaxy m14', 'tecno camon 50 pro',
  // Fix round 1: a 4G title without its token ("Xiaomi Redmi Note 10 4GB RAM,
  // 128GB") merged with the 5G one at a >35% price gap.
  'redmi note 10', 'xiaomi 11 lite', 'galaxy m32', 'galaxy a13', 'galaxy a22',
  'poco m4 pro', 'redmi note 11 pro', 'pixel 4a',
]

/**
 * Rule 9. Lowercase, `+` → `-plus` ("Hot 60 Pro+" and "Hot 60 Pro" are
 * different phones), any other run of non-alphanumerics → `-`.
 */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Rule 1. "Apple iPhone 17 <br>256GB", "MOTO G04S 4GB ⎢ 64GB", "HONOR X9d –
 * 12GB/256GB": markup and decorative separators become spaces;
 * "NOTHING Phone ( 3a ) Lite" → "Phone (3a) Lite".
 */
function clean(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/[⎢|–—]/g, ' ')
    .replace(/\(\s*([^()]*?)\s*\)/g, '($1)')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Rule 2. "iPhone 13 128GB (Used)". */
const USED = /(?<![a-z])(?:used|refurb\w*|pre-?owned|open\s+box)(?![a-z])/i

/**
 * Rule 2. "Samsung Galaxy Tab S6 Lite", "Honor Pad X9a", "Apple MacBook Air
 * M2": not phones. Only the part before "with" is checked: "Honor 400 Pro 5G
 * 12GB RAM 512GB With Buds" is a phone sold with earbuds.
 */
const NOT_A_PHONE =
  /\b(?:tab|tablet|ipad|matepad|pad|watch|buds|band|macbook|matebook|magicbook|galaxy\s+book|laptop|notebook)\b/i
const isNotAPhone = (title: string) => NOT_A_PHONE.test(title.split(/\bwith\b/i)[0])

/**
 * Rule 3. A leading brand word, including the typo shops ship ("Xiaom"). Not
 * "Hono": that is its own feature-phone brand ("Hono H1 Plus"), ruling 6.
 * The brand word is not part of the model.
 */
const BRAND_WORDS: [RegExp, string][] = [
  [/^apple\b/i, 'Apple'],
  [/^samsung\b/i, 'Samsung'],
  [/^xiaomi?\b/i, 'Xiaomi'],
  [/^honou?r\b/i, 'Honor'],
  [/^huawei\b/i, 'Huawei'],
  [/^oppo\b/i, 'OPPO'],
  [/^vivo\b/i, 'vivo'],
  [/^realme\b/i, 'realme'],
  [/^oneplus\b/i, 'OnePlus'],
  [/^google\b/i, 'Google'],
  [/^motorola\b/i, 'Motorola'],
  [/^nothing\b/i, 'Nothing'],
  [/^tecno\b/i, 'Tecno'],
  [/^infinix\b/i, 'Infinix'],
  [/^zte\b/i, 'ZTE'],
  [/^nokia\b/i, 'Nokia'],
]

/**
 * Rule 3. Titles that start with the family instead of the maker: "Galaxy A57
 * 5G", "Redmi Note 13", "MOTO G04S", "CMF Phone 2 Pro". The family word stays
 * in the model.
 */
const FAMILY_WORDS: [RegExp, string][] = [
  [/^iphone\b/i, 'Apple'],
  [/^galaxy\b/i, 'Samsung'],
  [/^(?:redmi|poco)\b|^mi\s*\d/i, 'Xiaomi'],
  [/^pixel\b/i, 'Google'],
  [/^moto\b/i, 'Motorola'],
  [/^cmf\b/i, 'Nothing'],
  [/^nubia\b/i, 'ZTE'],
  [/^hmd\b/i, 'Nokia'],
]

function findBrand(title: string): { brand: string; rest: string } | null {
  for (const [re, brand] of BRAND_WORDS) {
    const m = title.match(re)
    if (m) return { brand, rest: title.slice(m[0].length).trim() }
  }
  for (const [re, brand] of FAMILY_WORDS) {
    if (re.test(title)) return { brand, rest: title }
  }
  return null
}

const STORAGE_SIZES = new Set([16, 32, 64, 128, 256, 512, 1024, 2048])

/** Separators a bare size may follow: "Google Pixel 7 ⎢256". */
const SEPARATOR = '[⎢|/–—,(-]'

/**
 * A memory pair "N+M": "8+8GB", "Spark Go 1 3+3GB", "Smart 8 3 +3GB",
 * "Blade V50 Design 4 + 10GB", and "Tecno Spark 20 8+ 8GB", "Spark 30 4G 8+
 * 8GB", "Spark 30C 5G 4+ 4GB" (the plus glued on the left, but the number
 * before it follows a token with a digit in it). Not "Samsung Galaxy Note 10+
 * 12GB" or "realme 12+ 5G": a number glued to "+" with a space after,
 * straight after a plain word, is the model's "+".
 */
const PLUS_PAIR = '(?<![a-z0-9])(\\d+)(?:\\s*\\+(?=\\d)|\\s+\\+\\s*|(?<=\\d[a-z]*\\s+\\d+)\\+\\s+)(\\d+)'

/**
 * Where the name ends and memory begins: a size with a unit, a "6+128" pair,
 * or a bare size after a separator — the same three shapes parseMemory reads,
 * so the model cut and the memory scan agree on what counts as memory.
 */
const MEMORY_START = new RegExp(
  `(?<![a-z0-9])\\d+\\s*(?:gb|tb)(?![a-z])|${PLUS_PAIR}|${SEPARATOR}\\s*(?:16|32|64|128|256|512)(?![0-9a-z.])`,
  'i',
)

/**
 * Rule 4. RAM and storage, tried in order; the first RAM that is plausible
 * (≤ 24 GB and less than storage) wins:
 *
 * 1. "Moto G24 Power 8+8GB RAM 128GB": RAM is the first number; the second
 *    is virtual RAM, which is not a spec.
 * 2. "8GB RAM 128GB", "8GB / 256GB", "12GB + 256GB", "8GB-256GB".
 * 3. "Samsung Galaxy A14 6+128": a bare pair.
 * 4. "OnePlus 6 128GB -Mirror Black 8GB RAM": RAM named on its own.
 *
 * Storage is the largest size with a unit, or a bare one after a separator
 * ("Pixel 7 ⎢256"), that is a size phones ship in. The number before a size
 * must not touch a letter, so "S24+ 12GB" is not RAM 24.
 */
export function parseMemory(title: string): { ramGb: number | null; storageGb: number | null } {
  // "Samsung Galaxy S24 Ultra (12GB RAM512GB)": a size glued to RAM/ROM.
  const t = title.replace(/<br\s*\/?>/gi, ' ').replace(/\b(ram|rom)(?=\d)/gi, '$1 ')
  const sizes: number[] = []
  for (const m of t.matchAll(/(?<![a-z0-9])(\d+)\s*(gb|tb)(?![a-z])/gi)) {
    sizes.push(Number(m[1]) * (m[2].toLowerCase() === 'tb' ? 1024 : 1))
  }
  for (const m of t.matchAll(new RegExp(`${SEPARATOR}\\s*(16|32|64|128|256|512)(?![0-9a-z.])`, 'gi'))) {
    sizes.push(Number(m[1]))
  }
  const pair = t.match(new RegExp(`${PLUS_PAIR}(?![0-9])`, 'i'))
  if (pair) sizes.push(Number(pair[2]))
  const storage = sizes.filter((n) => STORAGE_SIZES.has(n))
  const storageGb = storage.length ? Math.max(...storage) : null

  const rams: string[] = []
  const virtual = t.match(new RegExp(`${PLUS_PAIR}\\s*gb`, 'i'))
  if (virtual) rams.push(virtual[1])
  for (const m of t.matchAll(/(?<![a-z0-9])(\d+)\s*gb\s*(?:ram)?\s*[|⎢/+\-–]?\s*(\d+)\s*(?:gb|tb)/gi)) rams.push(m[1])
  if (pair) rams.push(pair[1])
  for (const m of t.matchAll(/(?<![a-z0-9])(\d+)\s*gb\s+ram\b/gi)) rams.push(m[1])
  const ramGb =
    rams.map(Number).find((n) => n > 0 && n <= 24 && (storageGb === null || n < storageGb)) ?? null

  return { ramGb, storageGb }
}

/** Rule 6. "4G"/"5G" as a whole token, also when glued on: "Galaxy S24 FE-5G". */
const NETWORK = /(?<![a-z0-9])([45]g)(?![a-z0-9])/i

/**
 * Rule 6. "Apple iPhone 17 (256GB) E-SIM", and "Apple iPhone 16 128GB E – Sim"
 * whose dash cleaning turns into a space.
 */
const ESIM = /(?<![a-z0-9])e\s*-?\s*sim(?![a-z0-9])/i

/**
 * Rule 6. Words that are not the model. The memory cut removes most of them
 * (they follow the sizes); these are the ones that come before.
 */
const NOISE: RegExp[] = [
  // "Apple iPhone 16e 128GB (E-sim) with Apple Care"
  new RegExp(ESIM.source, 'gi'),
  /\bwith\s+apple\s*care\b/gi,
  // "Nokia 105 with Company Warranty"; the lead word is a known one, never a
  // model word ("Galaxy A05s Company Warranty" keeps A05s).
  /(?:\b(?:with|samsung|genxt|softlogic|abans|official)\s+)?\bcompany\s+warranty\b/gi,
  // "Xiaomi Redmi 13 4G 6GB RAM 128GB GENXT Warranty"; spellings as in warranty.ts
  /\b(?:genxt|genext|gnext)\s+warranty\b/gi,
  // "Samsung Galaxy S21 Ultra 5G with Free Gift"
  /\bwith\s+free\s+gift\b/gi,
  // "HONOR Magic V5 Foldable 16GB RAM 512GB": Magic V5 only comes foldable.
  /\bfoldable\b/gi,
  // "CMF by Nothing Phone 1" is the "CMF Phone 1" other shops list.
  /\bby\s+nothing\b/gi,
]

/**
 * Colour is never identity. Most colours follow the sizes and fall to the
 * memory cut; these come before them, at the end of the name: "Apple iPhone
 * 12 Purple – Genxt Warranty 128GB", "Apple iPhone 7 RED", "Apple iPhone 8
 * Product (RED)". Anchored to the end, so "nubia Red Magic" keeps its name.
 */
const COLOURS = 'red|purple|black|white|blue|green|gold|silver|pink|yellow|graphite|midnight|starlight|gr[ae]y'
const TRAILING_COLOUR = new RegExp(`\\s+(?:\\(?product\\)?\\s*)?\\(?(?:${COLOURS})\\)?$`, 'i')

/**
 * "OnePlus 6 -Mirror Black": a dash and words ending in a colour. Words that
 * are not a colour stay: "Infinix Note 40 Pro -Racing Edition" is its own phone.
 */
const DASH_COLOUR = new RegExp(`\\s-\\s*(?:[a-z]+\\s+)*(?:${COLOURS})\\s*$`, 'i')

/** Canonical case for family words shops write in any case: "REDMI 15", "Apple iphone 18 pro". */
const FAMILY_CASE: Record<string, string> = {
  iphone: 'iPhone', galaxy: 'Galaxy', redmi: 'Redmi', poco: 'POCO', pixel: 'Pixel',
  moto: 'Moto', cmf: 'CMF', nubia: 'nubia', hmd: 'HMD',
}

function displayCase(model: string): string {
  return model
    .split(' ')
    .map((w) => {
      const family = FAMILY_CASE[w.toLowerCase()]
      if (family) return family
      if (/^[a-z]+$/.test(w)) return w[0].toUpperCase() + w.slice(1)
      if (/^[A-Z]{4,}$/.test(w)) return w[0] + w.slice(1).toLowerCase()
      return w
    })
    .join(' ')
}

/**
 * Rule 6. Per-brand spellings that would otherwise split one phone in two.
 */
function normaliseModel(brand: string, model: string): string {
  // "Samsung Galaxy Z Flip6" → "Galaxy Z Flip 6"; likewise "Honor Play10",
  // "OnePlus Nord CE3", "Samsung Galaxy Note10+", which other shops space.
  // Two or more letters, so single-letter series ("A56", "X9c") are untouched.
  model = model.replace(/\b([a-z]{2,})(\d)/gi, '$1 $2')
  if (brand === 'Samsung' && !/^galaxy\b/i.test(model)) model = `Galaxy ${model}`
  // "Xiaomi Mi 13T 5G" → "13T": Xiaomi dropped "Mi" from the name.
  if (brand === 'Xiaomi') model = model.replace(/^mi\s+(?=\d)/i, '')
  // "Google 10 Pro XL" → "Pixel 10 Pro XL"
  if (brand === 'Google' && !/^pixel\b/i.test(model)) model = `Pixel ${model}`
  if (brand === 'Motorola') {
    // "MOTO G04S" and "Motorola G04S" → "Moto G04s": a letter + digits model
    // keeps "Moto"; anything else ("Moto Edge 60") is named without it.
    model = model.replace(/^moto\s+(?![a-z]\d)/i, '')
    const m = model.match(/^(?:moto\s+)?([a-z])(\d+)([a-z]*)\b(.*)$/i)
    if (m) model = `Moto ${m[1].toUpperCase()}${m[2]}${m[3].toLowerCase()}${m[4]}`
  }
  // Rule 7. "Apple iPhone 17 Air 256GB": Apple sells it as iPhone Air.
  if (brand === 'Apple') model = model.replace(/^iphone\s+17\s+air$/i, 'iPhone Air')
  return model
}

export function extractPhone(rawTitle: string): PhoneIdentity | PhoneDrop {
  const title = clean(rawTitle)
  if (USED.test(title)) return { drop: 'used' }
  if (isNotAPhone(title)) return { drop: 'not-a-phone' }
  const found = findBrand(title)
  if (!found) return { drop: 'brand' }
  const { brand } = found

  // Rule 5. Never guess a size: a listing without storage, or an Android
  // without RAM, cannot be told apart from its siblings.
  const memory = parseMemory(rawTitle)
  if (memory.storageGb === null) return { drop: 'no-storage' }
  const ramGb = brand === 'Apple' ? null : memory.ramGb
  if (brand !== 'Apple' && ramGb === null) return { drop: 'no-ram' }

  // Rule 6. The model is what sits between the brand word and the first
  // memory token. Cut on the raw title so a bare size after a separator
  // ("⎢256") still counts as memory.
  const raw = rawTitle.replace(/<br\s*\/?>/gi, ' ')
  const cut = raw.search(MEMORY_START)
  const head = clean(cut === -1 ? raw : raw.slice(0, cut))
  let model = findBrand(head)?.rest ?? ''

  const esimOnly = brand === 'Apple' && ESIM.test(title)
  for (const re of NOISE) model = model.replace(re, ' ')
  // The network can follow the sizes: "Tecno Camon 50 Pro 8GB RAM 256GB 5G".
  const network = (model.match(NETWORK) ?? title.match(NETWORK))?.[1]?.toUpperCase()
  model = model.replace(new RegExp(NETWORK.source, 'gi'), ' ')
  model = model
    .replace(DASH_COLOUR, ' ')
    .replace(/\s-\s*/g, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–,:;/()]+|[\s\-–,:;/(]+$/g, '')
    .replace(TRAILING_COLOUR, '')
    .trim()
  if (!model) return { drop: 'no-model' }

  model = displayCase(normaliseModel(brand, model))
  if (network && isDualNetwork(brand, model)) model = `${model} ${network}`

  const phoneId = slug(
    [brand, model, ramGb && `${ramGb}gb`, `${memory.storageGb}gb`, esimOnly && 'esim']
      .filter(Boolean)
      .join(' '),
  )
  return { phoneId, brand, model, ramGb, storageGb: memory.storageGb, esimOnly }
}

function isDualNetwork(brand: string, model: string): boolean {
  const m = model.toLowerCase()
  return DUAL_NETWORK.includes(m) || DUAL_NETWORK.includes(`${brand.toLowerCase()} ${m}`)
}

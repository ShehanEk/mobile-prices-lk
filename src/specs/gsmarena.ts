import * as cheerio from 'cheerio'

/**
 * GSMArena pages → the four facts a phone page shows: main camera, display,
 * network, colours. Pure: no network here (the job is src/pipeline/specs.ts).
 *
 * Selectors adapted from mobile-specs-api by RevengerNick (MIT licence, 2025),
 * https://github.com/RevengerNick/mobile-specs-api, files
 * src/parser/parser.phone-details.ts and src/parser/parser.service.ts. Ours
 * read m.gsmarena.com, which is what GSMArena serves our bot user agent
 * (www.gsmarena.com 302-redirects it), so the list markup differs from theirs.
 *
 * GSMArena gave written permission (email, 2026-10-25). Its licence forbids
 * feeding its pages to AI: nothing read here is ever sent to Claude.
 */

export const GSMARENA = 'https://m.gsmarena.com'

export type Maker = { slug: string; id: number }

/**
 * GSMArena's brand lists per in-scope brand. Page 1 is `{slug}-phones-{id}.php`.
 * Checked by `npm run specs -- --probe` against GSMArena's makers page.
 * Redmi and POCO are listed under Xiaomi, CMF under Nothing, nubia under ZTE;
 * HMD has its own list beside Nokia's.
 */
export const MAKERS: Record<string, Maker[]> = {
  Apple: [{ slug: 'apple', id: 48 }],
  Samsung: [{ slug: 'samsung', id: 9 }],
  Xiaomi: [{ slug: 'xiaomi', id: 80 }],
  Honor: [{ slug: 'honor', id: 121 }],
  Huawei: [{ slug: 'huawei', id: 58 }],
  OPPO: [{ slug: 'oppo', id: 82 }],
  vivo: [{ slug: 'vivo', id: 98 }],
  realme: [{ slug: 'realme', id: 118 }],
  OnePlus: [{ slug: 'oneplus', id: 95 }],
  Google: [{ slug: 'google', id: 107 }],
  Motorola: [{ slug: 'motorola', id: 4 }],
  Nothing: [{ slug: 'nothing', id: 128 }],
  Tecno: [{ slug: 'tecno', id: 120 }],
  Infinix: [{ slug: 'infinix', id: 119 }],
  ZTE: [{ slug: 'zte', id: 62 }],
  Nokia: [
    { slug: 'nokia', id: 1 },
    { slug: 'hmd', id: 130 },
  ],
}

export function makerPageUrl(maker: Maker, page: number): string {
  return page === 1
    ? `${GSMARENA}/${maker.slug}-phones-${maker.id}.php`
    : `${GSMARENA}/${maker.slug}-phones-f-${maker.id}-0-p${page}.php`
}

export type Candidate = { name: string; path: string }

/** Cloudflare's Turnstile page, which GSMArena puts in front of its search. We never get past it. */
export function isChallenge(html: string): boolean {
  return /challenges\.cloudflare\.com|Turnstile check/i.test(html)
}

const text = (s: string) => s.replace(/\s+/g, ' ').trim()

/** A brand list page: each phone's name and path, newest first, and how many pages the list has. */
export function parseMakerPage(html: string): { title: string; candidates: Candidate[]; lastPage: number } {
  const $ = cheerio.load(html)
  // "Galaxy S24<br>Ultra" must read as two words, not "S24Ultra".
  $('#list-brands br').replaceWith(' ')
  const candidates = $('#list-brands .general-menu li a')
    .toArray()
    .flatMap((a) => {
      const path = $(a).attr('href')
      const name = text($(a).find('strong').text())
      return path && name ? [{ name, path }] : []
    })
  const last = $('#last-button').attr('href')?.match(/-p(\d+)\.php$/)
  return { title: text($('title').first().text()), candidates, lastPage: last ? Number(last[1]) : 1 }
}

export type ParsedSpecs = {
  name: string
  /** The page's canonical (www) URL, for the attribution link. */
  url: string | null
  mainCamera: string | null
  display: string | null
  network: string | null
  colours: string | null
}

/** A spec page: the `data-spec` cells mobile-specs-api reads, reduced to what the phone page shows. */
export function parseSpecPage(html: string): ParsedSpecs {
  const $ = cheerio.load(html)
  const spec = (key: string) => text($(`[data-spec="${key}"]`).first().text()) || null

  const camera = spec('cam1modules')?.match(/(\d+(?:\.\d+)?)\s*MP/i)
  const size = spec('displaysize')?.match(/^(\d+(?:\.\d+)?)\s*inches/i)
  // "Dynamic LTPO AMOLED 2X, 120Hz, HDR10+, 2600 nits (peak)" → the panel and its refresh rate.
  const type = spec('displaytype')?.split(',').slice(0, 2).map((s) => s.trim()).join(', ') ?? null
  const display = [size ? `${size[1]}-inch` : null, type].filter(Boolean).join(' ') || null
  const tech = spec('nettech')
  const network = !tech
    ? null
    : /\b5G\b/i.test(tech)
      ? '5G'
      : /\bLTE\b/i.test(tech)
        ? '4G'
        : /HSPA|UMTS|EVDO|CDMA2000/i.test(tech)
          ? '3G'
          : '2G'

  return {
    name: text($('h1').first().text()),
    url: $('link[rel="canonical"]').attr('href') ?? null,
    mainCamera: camera ? `${camera[1]} MP` : null,
    display,
    network,
    colours: spec('colors'),
  }
}

/** Words that may lead a GSMArena name for a brand and are dropped on both sides (rule 1). */
const LEADS: Record<string, string[]> = { Nokia: ['nokia', 'hmd'] }

function words(name: string, brand: string): string {
  const leads = LEADS[brand] ?? [brand.toLowerCase()]
  return name
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b[45]g\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(new RegExp(`^(?:${leads.join('|')}) `), '')
}

const networkOf = (model: string) => model.match(/\b([45])G\b/i)?.[1] ?? null

function candidateNetwork(c: Candidate): string | null {
  const fromPath = c.path.match(/_([45])g(?=[-_+.])/i)?.[1]
  return fromPath ?? networkOf(c.name)
}

/** The one GSMArena entry for this brand + model by the rules above, or null. */
export function pickCandidate(phone: { brand: string; model: string }, candidates: Candidate[]): Candidate | null {
  const want = words(phone.model, phone.brand)
  const net = networkOf(phone.model)
  const unique = [...new Map(candidates.map((c) => [c.path, c])).values()]
  const same = unique.filter((c) => words(c.name, phone.brand) === want)
  const fitting = net === '5' ? same.filter((c) => candidateNetwork(c) === '5') : net === '4' ? same.filter((c) => candidateNetwork(c) !== '5') : same
  const exact = net ? fitting.filter((c) => candidateNetwork(c) === net) : []
  const pool = exact.length > 0 ? exact : fitting
  return pool.length === 1 ? pool[0] : null
}

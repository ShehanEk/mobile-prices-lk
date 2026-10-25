import type { PhoneSpecs } from '@/queries/phones'

/**
 * Specs from GSMArena, credited with a link to the page they came from
 * (permission by email, 2026-10-25; its licence asks for attribution). With no
 * confident match there is only a link to GSMArena's search, so nobody reads a
 * spec we guessed.
 */
export function SpecsBlock({ brand, model, specs }: { brand: string; model: string; specs: PhoneSpecs | null }) {
  const search = `https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName=${encodeURIComponent(`${brand} ${model}`)}`
  const all: [string, string | null][] = specs
    ? [
        ['Main camera', specs.mainCamera],
        ['Display', specs.display],
        ['Network', specs.network],
        ['Colours', specs.colours],
      ]
    : []
  const rows = all.filter((r): r is [string, string] => r[1] !== null)

  if (!specs || rows.length === 0) {
    return (
      <p className="m-0 min-w-0 flex-[1_1_300px] self-center text-[15px]">
        <a href={specs?.gsmarenaUrl ?? search} target="_blank" rel="noopener" className="go font-semibold text-accent">
          {specs ? 'Specs: GSMArena.com →' : 'Full specs on GSMArena →'}
        </a>
      </p>
    )
  }

  return (
    <section aria-labelledby="specs" className="edge flex min-w-0 flex-[1_1_300px] flex-col gap-4 rounded-3xl p-5 sm:rounded-[28px] sm:p-7">
      <h2 id="specs" className="m-0 font-display text-[20px] font-bold tracking-[-0.02em] sm:text-[24px]">
        Specs
      </h2>
      <dl className="m-0 flex flex-col">
        {rows.map(([label, value], i) => (
          <div key={label} className={`flex justify-between gap-3 py-3 ${i < rows.length - 1 ? 'border-b border-line' : ''}`}>
            <dt className="text-ink-3">{label}</dt>
            <dd className="m-0 text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <a href={specs.gsmarenaUrl} target="_blank" rel="noopener" className="go self-start text-[13px] font-semibold text-accent">
        Specs: GSMArena.com →
      </a>
    </section>
  )
}

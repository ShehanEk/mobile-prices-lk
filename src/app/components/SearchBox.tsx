import Form from 'next/form'

/**
 * Phone search. A plain GET to /search, so it works before JavaScript loads;
 * `next/form` makes the submit a client-side navigation once it has.
 *
 * `large` is the home page's hero box with its Compare button. The header's
 * compact box submits on Enter.
 */
export function SearchBox({ large = false, defaultValue }: { large?: boolean; defaultValue?: string }) {
  const id = large ? 'search-hero' : 'search-header'
  return (
    <Form action="/search" role="search" className={large ? 'w-full max-w-[560px]' : 'w-full'}>
      <label htmlFor={id} className="sr-only">
        {large ? 'Search a phone' : 'Search phones'}
      </label>
      <div
        className={`flex items-center rounded-full focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
          large ? 'edge-search h-16 gap-3 bg-white pl-[22px] pr-2' : 'h-11 gap-2.5 bg-panel px-4'
        }`}
      >
        <svg
          aria-hidden
          width={large ? 22 : 18}
          height={large ? 22 : 18}
          viewBox="0 0 24 24"
          fill="none"
          stroke={large ? '#1A1F2B' : '#69707F'}
          strokeWidth={2}
          strokeLinecap="round"
          className="flex-none"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          id={id}
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder={large ? 'Try “Galaxy S26 Ultra” or “iPhone 18”' : 'Search phones'}
          autoComplete="off"
          enterKeyHint="search"
          className={`min-w-0 flex-1 bg-transparent text-ink outline-none ${large ? 'text-[17px]' : 'text-[15px]'}`}
        />
        {large && (
          <button
            type="submit"
            className="btn h-12 flex-none cursor-pointer rounded-full bg-accent px-[22px] text-[16px] font-semibold text-white"
          >
            Compare
          </button>
        )}
      </div>
    </Form>
  )
}

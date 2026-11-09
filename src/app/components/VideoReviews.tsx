import type { PhoneReview } from '@/queries/phones'

import { ReviewPlayer } from './ReviewPlayer'

/** Up to three YouTube reviews of this model; the section disappears when there are none. */
export function VideoReviews({ reviews }: { reviews: PhoneReview[] }) {
  if (reviews.length === 0) return null

  return (
    <section aria-labelledby="reviews" className="mt-5 flex flex-col gap-3 sm:mt-16 sm:gap-4">
      <h2 id="reviews" className="m-0 font-display text-[24px] font-bold tracking-[-0.03em] sm:text-[30px]">
        Video reviews
      </h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-3 sm:gap-4">
        {reviews.map((r) => (
          <div key={r.videoId} className="edge-card flex min-w-0 flex-col rounded-[26px] bg-card p-1.5 sm:rounded-[28px] sm:p-2">
            <ReviewPlayer videoId={r.videoId} title={r.title} />
            <div className="flex flex-col gap-1 px-3 pb-2.5 pt-3 sm:px-3 sm:pb-3 sm:pt-3.5">
              <span className="text-[16px] font-semibold leading-[1.3] sm:text-[17px]">{r.title}</span>
              <span className="text-[13px] text-ink-2 sm:text-[14px]">{r.channel}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

'use client'

import { useState } from 'react'

/**
 * A YouTube thumbnail until someone presses play. Three real players would slow
 * every phone page, and YouTube only hears about a view after that press.
 */
export function ReviewPlayer({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false)

  return (
    <div className="relative aspect-video bg-ink">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play ${title}`}
          className="absolute inset-0 flex cursor-pointer items-center justify-center border-0 bg-transparent p-0"
        >
          {/* YouTube's own image: next/image would bill Vercel to resize it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            width={480}
            height={360}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="btn relative flex h-14 w-14 items-center justify-center rounded-full bg-white sm:h-16 sm:w-16">
            <svg aria-hidden width="26" height="26" viewBox="0 0 24 24" fill="#1A1F2B">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Mobile sticky add-to-bag bar, design system 438:4283.
 *
 * A 56px ink bar inside a 76px padded tray, pinned to the bottom of the viewport.
 * The frame draws it over the first screen of Product / Mobile, so it is present
 * from the top of the page rather than appearing on scroll.
 */
export default function ProductStickyAddToCart({
  label,
  disabled = false,
  onClick,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [nearEnd, setNearEnd] = useState(false)

  // The bar is fixed, so at the foot of the page it would sit on top of the
  // footer permanently. This sentinel marks the end of the product content: once
  // it comes into view the footer is arriving and the bar stands down. Without an
  // IntersectionObserver (or before hydration) the bar simply stays visible,
  // which is the design's own state.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => setNearEnd(entry.isIntersecting),
      { rootMargin: '0px 0px 120px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full lg:hidden" />

      <div
        className={`fixed inset-x-0 bottom-0 z-40 bg-surface-secondary px-[16px] py-[10px] transition-opacity duration-200 lg:hidden ${
          nearEnd ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-hidden={nearEnd}
          tabIndex={nearEnd ? -1 : undefined}
          className="flex h-[56px] w-full items-center justify-between bg-sako-ink-900 px-[17px] transition-colors hover:bg-sako-ink-800 disabled:bg-sako-gray-500"
        >
          {/* Label first, arrow second. justify-between then lands the label on the
              inline start - the right, in Hebrew - with the arrow opposite, which is
              how the frame reads once it is mirrored out of its LTR artboard. */}
          <span className="font-ploni text-[12px] font-bold text-text-inverse">{label}</span>
          {/* U+2199 turned 90 degrees, exactly as the frame builds it. Ploni carries
              the glyph in both Black and Bold, so it needs no icon asset. */}
          <span aria-hidden="true" className="flex h-[14px] w-[32px] items-center justify-center">
            <span className="rotate-90 font-ploni text-[22px] font-black leading-none text-text-inverse">
              &#8601;
            </span>
          </span>
        </button>
      </div>
    </>
  )
}

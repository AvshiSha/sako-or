'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const COLLAPSED_MAX_HEIGHT = 72 // ~3 lines of prose

interface ReadMoreContentProps {
  children: React.ReactNode
  lng?: 'en' | 'he'
  className?: string
}

const labels = {
  en: { readMore: 'Read More', showLess: 'Show Less' },
  he: { readMore: 'קרא עוד', showLess: 'הצג פחות' },
}

export default function ReadMoreContent({
  children,
  lng = 'en',
  className,
}: ReadMoreContentProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [needsToggle, setNeedsToggle] = useState(false)
  const [fullHeight, setFullHeight] = useState(COLLAPSED_MAX_HEIGHT)

  const measure = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    const scrollHeight = el.scrollHeight
    setFullHeight(scrollHeight)
    setNeedsToggle(scrollHeight > COLLAPSED_MAX_HEIGHT + 8)
  }, [])

  useEffect(() => {
    measure()
    const el = contentRef.current
    if (!el) return

    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure, children])

  const t = labels[lng]

  return (
    <div className={cn('w-full', className)}>
      <div
        ref={contentRef}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{
          maxHeight: expanded || !needsToggle ? fullHeight : COLLAPSED_MAX_HEIGHT,
        }}
      >
        {children}
      </div>
      {needsToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'mt-4 text-sm font-medium text-[#856D55] hover:text-[#6d5844] underline-offset-2 hover:underline transition-colors',
            lng === 'he' ? 'text-right w-full' : 'text-left'
          )}
          aria-expanded={expanded}
        >
          {expanded ? t.showLess : t.readMore}
        </button>
      )}
    </div>
  )
}
